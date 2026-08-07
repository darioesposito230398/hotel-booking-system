require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
let stripe;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}
const { body, validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');

// Sconto promozionale applicato al cliente (10% sul prezzo pieno)
const BOOKING_DISCOUNT = 0.10;

// PayPal — il cliente AUTORIZZA alla prenotazione (serve un conto PayPal),
// l'addebito avviene SOLO alla conferma. Nessun rimborso automatico.
const PAYPAL_BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

const PAYPAL_CONFIRM_HOURS = parseInt(process.env.PAYPAL_CONFIRM_HOURS || '24', 10);

// Email (SMTP). Se non configurato, le email vengono salvate nei log.
const SMTP = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from: process.env.SMTP_FROM || process.env.SMTP_USER || 'Hotel Vittorio Veneto <info@hotelvittorioveneto.com>'
};
let smtpTransporter = null;
function getTransporter() {
  if (!SMTP.host || !SMTP.user || !SMTP.pass) return null;
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: SMTP.host,
      port: SMTP.port,
      secure: SMTP.port === 465,
      auth: { user: SMTP.user, pass: SMTP.pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 20000,
      greetingTimeout: 15000,
      socketTimeout: 20000
    });
    smtpTransporter.on('error', (err) => {
      console.error('[SMTP ERROR EVENT]', err && err.message || err);
    });
  }
  return smtpTransporter;
}
async function sendEmail(to, subject, html) {
  const t = getTransporter();
  if (!t) {
    console.log(`[EMAIL LOG] (SMTP non configurato)\nA: ${to}\nOggetto: ${subject}\n${html}\n`);
    return;
  }
  try {
    await t.sendMail({ from: SMTP.from, to, subject, html });
    console.log(`[EMAIL INVIATA] ${to} :: ${subject}`);
  } catch (err) {
    console.error(`[EMAIL ERRORE] A: ${to}\n${err.message}`);
    throw err;
  }
}

let paypalTokenCache = null;
let paypalTokenExpiry = 0;

async function paypalGetToken() {
  if (paypalTokenCache && Date.now() < paypalTokenExpiry) return paypalTokenCache;
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  if (!clientId || !secret) {
    throw new Error('PayPal non configurato (mancano PAYPAL_CLIENT_ID / PAYPAL_SECRET)');
  }
  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Errore PayPal auth: ${res.status} ${text}`);
  }
  const data = await res.json();
  paypalTokenCache = data.access_token;
  paypalTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return paypalTokenCache;
}

async function paypalCreateOrder(amount) {
  const token = await paypalGetToken();
  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      intent: 'AUTHORIZE',
      purchase_units: [{
        amount: {
          currency_code: 'EUR',
          value: amount.toFixed(2)
        }
      }]
    })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Errore PayPal create order: ${res.status} ${text}`);
  }
  return (await res.json()).id;
}

// Hold the amount (no charge). Returns the authorization id.
async function paypalAuthorizeOrder(orderId) {
  const token = await paypalGetToken();
  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/authorize`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Errore PayPal authorize: ${res.status} ${text}`);
  }
  const data = await res.json();
  const auth = data?.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!auth) {
    throw new Error('Nessuna autorizzazione PayPal restituita');
  }
  return auth.id;
}

// Charge the held amount (on confirm). Returns capture id.
async function paypalCaptureAuth(authId) {
  const token = await paypalGetToken();
  const res = await fetch(`${PAYPAL_BASE}/v2/payments/authorizations/${authId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Errore PayPal capture: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.id;
}

// Release the held amount (on reject / timeout).
async function paypalVoidAuth(authId) {
  const token = await paypalGetToken();
  const res = await fetch(`${PAYPAL_BASE}/v2/payments/authorizations/${authId}/void`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Errore PayPal void: ${res.status} ${text}`);
  }
  return res.json();
}


const app = express();
const PORT = process.env.PORT || 5000;

// ---- Helper email / descrizione prenotazione ----
function fmtMoney(n) {
  return '€' + (parseFloat(n) || 0).toFixed(2);
}
function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}
function nightsBetween(checkIn, checkOut) {
  return Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000));
}

async function bookingForEmail(id) {
  const r = await pool.query(`
    SELECT br.*, rt.name AS room_type_name
    FROM booking_requests br
    JOIN room_types rt ON br.room_type_id = rt.id
    WHERE br.id = $1
  `, [id]);
  return r.rows[0];
}

function bookingHtml(booking) {
  const nights = nightsBetween(booking.check_in, booking.check_out);
  const balance = Math.max(0, (parseFloat(booking.total_price) || 0) - (parseFloat(booking.first_night_amount) || 0));
  const method = booking.payment_method === 'bonifico' ? 'Bonifico istantaneo' : 'PayPal';
  const rows = [
    ['Nome e cognome', booking.guest_name],
    ['Email', booking.guest_email],
    ['Telefono', booking.guest_phone || 'Non fornito'],
    ['Camera', booking.room_type_name],
    ['Check-in', fmtDate(booking.check_in)],
    ['Check-out', fmtDate(booking.check_out)],
    ['Notti', String(nights)],
    ['Ospiti', String(booking.num_guests)],
    ['Totale soggiorno', fmtMoney(booking.total_price)],
    ['Acconto prima notte', booking.first_night_amount ? fmtMoney(booking.first_night_amount) : '—'],
    ['Saldo in struttura', balance > 0 ? fmtMoney(balance) : '—'],
    ['Metodo di pagamento', method],
    ['Riferimento prenotazione', booking.booking_number ? `N. ${booking.booking_number}` : '#' + booking.id]
  ];
  if (booking.notes) rows.push(['Note del cliente', booking.notes]);

  let list = '';
  rows.forEach(([k, v]) => {
    list += `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#555;white-space:nowrap"><strong>${k}</strong></td><td style="padding:8px 12px;border-bottom:1px solid #eee">${v || ''}</td></tr>`;
  });

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1b2430;max-width:600px;margin:0 auto">
      <h2 style="color:#0d3b2e">Hotel Vittorio Veneto · Napoli</h2>
      <table style="width:100%;border-collapse:collapse;margin-top:14px">${list}</table>
    </div>`;
}

// Rifiuto / non confermata
async function sendRejectionEmail(booking) {
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1b2430;max-width:600px;margin:0 auto">
    <h2 style="color:#0d3b2e">Prenotazione non confermata</h2>
    <p>Ciao <strong>${booking.guest_name}</strong>,</p>
    <p>purtroppo non possiamo confermare la tua prenotazione. Nessun addebito è stato effettuato e, se avevi effettuato un pagamento, l'importo è stato trattenuto/rilasciato come previsto.</p>
    ${bookingHtml(booking)}
    <p>Per qualsiasi domanda scrivici a <strong>info@hotelvittorioveneto.com</strong>.</p>
  </div>`;
  await sendEmail(booking.guest_email, 'Prenotazione non confermata - Hotel Vittorio Veneto', html);
}

// Bonifico: invia IBAN e chiede di effettuare il bonifico
async function sendIbanEmail(booking) {
  const r = await pool.query("SELECT config_key, config_value FROM payment_config WHERE config_key IN ('bonifico_iban','bonifico_intestatario')");
  const info = {};
  r.rows.forEach(row => { info[row.config_key] = row.config_value; });
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1b2430;max-width:600px;margin:0 auto">
    <h2 style="color:#0d3b2e">Pagamento con bonifico istantaneo</h2>
    <p>Ciao <strong>${booking.guest_name}</strong>,</p>
    <p>la tua richiesta è stata <strong>pre-confermata</strong>. Per completare il pagamento dell'acconto della prima notte effettua un <strong>bonifico istantaneo</strong> a:</p>
    <table style="width:100%;border-collapse:collapse;margin-top:10px">
      <tr><td style="padding:8px 12px;border:1px solid #eee"><strong>A favore di</strong></td><td style="padding:8px 12px;border:1px solid #eee">${info.bonifico_intestatario || '—'}</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #eee"><strong>IBAN</strong></td><td style="padding:8px 12px;border:1px solid #eee;font-size:16px;letter-spacing:1px">${info.bonifico_iban || 'I dati bancari verranno inviati a breve.'}</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #eee"><strong>Importo da versare</strong></td><td style="padding:8px 12px;border:1px solid #eee">${fmtMoney(booking.first_night_amount)}</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #eee"><strong>Riferimento</strong></td><td style="padding:8px 12px;border:1px solid #eee">Prenotazione ${booking.booking_number ? `N. ${booking.booking_number}` : '#' + booking.id}</td></tr>
    </table>
    <p>Una volta ricevuto il pagamento, confermeremo definitivamente la prenotazione.</p>
    ${bookingHtml(booking)}
    <p>Per l'orario e le istruzioni di check-in resta valido quanto indicato in questa email: se arrivi dopo le 19:00 scrivi a <strong>info@hotelvittorioveneto.com</strong> con l'orario di arrivo e ti forniremo le istruzioni per il check-in a distanza.</p>
  </div>`;
  await sendEmail(booking.guest_email, 'Acconto prima notte - Bonifico - Hotel Vittorio Veneto', html);
}

// Conferma definitiva
async function sendConfirmationEmail(booking) {
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1b2430;max-width:600px;margin:0 auto">
    <h2 style="color:#0d3b2e">Prenotazione confermata!</h2>
    <p>Ciao <strong>${booking.guest_name}</strong>,</p>
    <p>La tua prenotazione è stata <strong>confermata</strong>. Grazie per aver scelto l'Hotel Vittorio Veneto.</p>
    ${bookingHtml(booking)}
    <h3 style="color:#0d3b2e;margin-top:24px">Informazioni utili e regole</h3>
    <ul style="line-height:1.7">
      <li><strong>Check-in</strong> dalle 14:00 · <strong>Check-out</strong> entro le 11:00.</li>
      <li>Se arrivi <strong>dopo le 19:00</strong>, scrivi a <strong>info@hotelvittorioveneto.com</strong> indicando l'orario di arrivo: ti invieremo tutte le istruzioni per il <strong>check-in a distanza</strong>.</li>
      <li>Il saldo del soggiorno si paga in struttura (contanti o carta all'arrivo).</li>
      <li>Al check-in è richiesto un documento d'identità valido.</li>
      <li>Per eventuali modifiche o cancellazioni contattaci a <strong>info@hotelvittorioveneto.com</strong>.</li>
    </ul>
    <p>Buon soggiorno!<br/>Hotel Vittorio Veneto · Via Milano, 96 · Napoli</p>
  </div>`;
  await sendEmail(booking.guest_email, 'Prenotazione confermata - Hotel Vittorio Veneto', html);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Hotel Booking API is running' });
});

// Initialize database tables
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'reception',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS room_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        base_price DECIMAL(10,2) NOT NULL,
        max_guests INTEGER NOT NULL,
        photo VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS room_daily_prices (
        id SERIAL PRIMARY KEY,
        room_type_id INTEGER NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        UNIQUE (room_type_id, date)
      );

      CREATE TABLE IF NOT EXISTS booking_requests (
        id SERIAL PRIMARY KEY,
        booking_number BIGINT UNIQUE,
        guest_name VARCHAR(255) NOT NULL,
        guest_email VARCHAR(255) NOT NULL,
        guest_phone VARCHAR(50),
        check_in DATE NOT NULL,
        check_out DATE NOT NULL,
        room_type_id INTEGER REFERENCES room_types(id),
        num_guests INTEGER NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        first_night_amount DECIMAL(10,2),
        payment_method VARCHAR(20) DEFAULT 'card',
        id_document TEXT,
        notes TEXT,
        stripe_payment_method_id VARCHAR(255),
        stripe_customer_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        payment_status VARCHAR(50) DEFAULT 'tokenized',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS payment_config (
        id SERIAL PRIMARY KEY,
        config_key VARCHAR(100) UNIQUE NOT NULL,
        config_value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS room_photos (
        id SERIAL PRIMARY KEY,
        room_type_id INTEGER NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
        data TEXT NOT NULL,
        position INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert default payment config if not exists
    await client.query(`
      INSERT INTO payment_config (config_key, config_value)
      VALUES ('payment_action', 'charge_on_confirm')
      ON CONFLICT (config_key) DO NOTHING;
    `);
    await client.query(`
      INSERT INTO payment_config (config_key, config_value)
      VALUES ('bonifico_iban', ''), ('bonifico_intestatario', 'Hotel Vittorio Veneto')
      ON CONFLICT (config_key) DO NOTHING;
    `);

    // Seed default admin account (email + password, hashed)
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'info@hotelvittorioveneto.com';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Hotel9698+';
    const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await client.query(`
      INSERT INTO users (email, password) VALUES ($1, $2)
      ON CONFLICT (email) DO NOTHING;
    `, [ADMIN_EMAIL, adminHash]);

        // Ensure photo column exists on existing tables
    await client.query('ALTER TABLE room_types ADD COLUMN IF NOT EXISTS photo VARCHAR(255)');
    await client.query('ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS first_night_amount DECIMAL(10,2)');
    await client.query("ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'card'");
    await client.query('ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS id_document TEXT');
    await client.query('ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS paypal_order_id VARCHAR(128)');
    await client.query('ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS paypal_auth_id VARCHAR(128)');
    await client.query('ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS paypal_capture_id VARCHAR(128)');
    await client.query('ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS booking_number BIGINT');
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_number ON booking_requests(booking_number)
    `);

    // Progressive booking numbers: 9610001, 9610002, ...
    await client.query(`
      CREATE SEQUENCE IF NOT EXISTS booking_number_seq START WITH 9610001 INCREMENT BY 1
    `);
    await client.query(`
      SELECT setval('booking_number_seq',
        GREATEST(
          (SELECT COALESCE(MAX(booking_number), 9610000) FROM booking_requests),
          9610001
        )
      )
    `);
    // Assign numbers to any existing bookings still missing one
    await client.query(`
      UPDATE booking_requests
      SET booking_number = nextval('booking_number_seq')
      WHERE booking_number IS NULL
    `);
    // Remove ID documents from already-closed bookings (privacy)
    await client.query(`
      UPDATE booking_requests SET id_document = NULL WHERE status IN ('cancelled', 'rejected', 'voided')
    `);

    // Seed room types only if none exist (so admin edits persist across restarts)
    const existingRooms = await client.query('SELECT COUNT(*) AS count FROM room_types');
    if (parseInt(existingRooms.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO room_types (name, description, base_price, max_guests, photo) VALUES
        ('Singola Bagno Condiviso', 'Camera singola con TV, scrivania, armadio e bagno condiviso. 12 m²', 45.00, 1, 'singola-bagno-comune.jpg'),
        ('Doppia/Twin Bagno Condiviso', 'Camera doppia o matrimoniale con TV, scrivania, balcone e bagno condiviso. 15 m²', 55.00, 2, 'doppia-standard.jpg'),
        ('Singola Bagno Privato', 'Camera singola con aria condizionata, TV, bagno privato con bidet. 12 m²', 60.00, 1, 'singola-bagno-privato.png'),
        ('Doppia Standard', 'Camera doppia con bagno privato, TV, balcone. 15 m²', 75.00, 2, 'doppia-standard.jpg'),
        ('Tripla Standard', 'Camera triple con bagno privato, TV, balcone. 18 m²', 90.00, 3, 'tripla-standard.jpg');
      `);
    }

    // Remove any trailing price text from room names (e.g. "Singola Bagno Condiviso 45 euro")
    await client.query(`
      UPDATE room_types
      SET name = TRIM(REGEXP_REPLACE(name, '[[:space:]]*[€eE0-9.,]+[[:space:]]*(€|euro|Euro|EURO)?[[:space:]]*$', ''))
      WHERE name ~ '[[:space:]]+[€0-9][0-9.,]*(€|euro|Euro|EURO)?$'
    `);

    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}

// Seed foto esistenti: carica nella tabella room_photos le immagini legacy
// (backend/assets/rooms, copia di quelle usate in home) per ogni tipologia.
// Ogni camera viene marcata come "seeded" così non risemina se l'admin le
// elimina in seguito.
async function seedRoomPhotos() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_meta (
        meta_key VARCHAR(100) PRIMARY KEY,
        meta_value TEXT
      )
    `);
    // Rimuove il vecchio flag globale (il primo seed è fallito, va ritentato)
    await client.query(`DELETE FROM app_meta WHERE meta_key = 'room_photos_seeded'`);

    // Mappa nome camera -> immagine legacy (usata anche in home)
    const ROOM_PHOTO_MAP = {
      'Singola Bagno Condiviso': 'singola-bagno-comune.jpg',
      'Singola Bagno Privato': 'singola-bagno-privato.png',
      'Doppia Standard': 'doppia-standard.jpg',
      'Doppia/Twin Bagno Condiviso': 'doppia-standard.jpg',
      'Tripla Standard': 'tripla-standard.jpg'
    };

    const rooms = await client.query(`
      SELECT id, name, photo FROM room_types ORDER BY id
    `);
    for (const room of rooms.rows) {
      const seededKey = `photo_seed_${room.id}`;
      const done = await client.query(
        'SELECT meta_value FROM app_meta WHERE meta_key = $1',
        [seededKey]
      );
      if (done.rows.length > 0) continue;

      const existing = await client.query(
        'SELECT COUNT(*) AS count FROM room_photos WHERE room_type_id = $1',
        [room.id]
      );
      if (parseInt(existing.rows[0].count, 10) > 0) {
        await client.query(
          'INSERT INTO app_meta (meta_key, meta_value) VALUES ($1, $2) ON CONFLICT (meta_key) DO NOTHING',
          [seededKey, '1']
        );
        continue;
      }

      const filename = room.photo || ROOM_PHOTO_MAP[room.name];
      if (!filename) continue;

      const dataUrl = loadPhotoAsDataUrl(filename);
      if (!dataUrl) {
        console.log(`[PHOTOS] Impossibile caricare "${filename}"`);
        continue;
      }
      await client.query(
        'INSERT INTO room_photos (room_type_id, data, position) VALUES ($1, $2, 0)',
        [room.id, dataUrl]
      );
      await client.query(
        'INSERT INTO app_meta (meta_key, meta_value) VALUES ($1, $2) ON CONFLICT (meta_key) DO NOTHING',
        [seededKey, '1']
      );
      console.log(`[PHOTOS] Foto seed per tipologia ${room.id}: ${filename}`);
    }
  } finally {
    client.release();
  }
}

function loadPhotoAsDataUrl(filename) {
  const mime = String(filename).toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  const filePath = path.join(__dirname, 'assets', 'rooms', filename);
  try {
    const data = fs.readFileSync(filePath);
    return `data:${mime};base64,${data.toString('base64')}`;
  } catch (err) {
    return null;
  }
}

// Diagnostica: stato del seed foto (senza dati sensibili)
app.get('/api/debug/seed', async (req, res) => {
  try {
    const meta = await pool.query('SELECT meta_key, meta_value FROM app_meta ORDER BY meta_key');
    const photos = await pool.query(
      'SELECT room_type_id, COUNT(*) AS count FROM room_photos GROUP BY room_type_id'
    );
    res.json({ meta: meta.rows, photos: photos.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Diagnostica: stato SMTP (senza esporre la password)
app.get('/api/debug/smtp', async (req, res) => {
  res.json({
    configured: !!(SMTP.host && SMTP.user && SMTP.pass),
    host: SMTP.host || null,
    port: Number(SMTP.port),
    user: SMTP.user || null,
    from: SMTP.from || null
  });
});

// Diagnostica: prova a inviare un'email di test e restituisce l'errore esatto
app.post('/api/debug/send-test', async (req, res) => {
  const { to } = req.body || {};
  if (!to) return res.status(400).json({ error: 'Indirizzo destinatario mancante (body: { "to": "..." })' });
  const t = getTransporter();
  if (!t) {
    return res.status(400).json({ error: 'SMTP non configurato. Imposta SMTP_HOST / SMTP_USER / SMTP_PASS su Render.' });
  }
  try {
    await t.sendMail({
      from: SMTP.from,
      to,
      subject: 'Test email - Hotel Vittorio Veneto',
      html: '<p>Questa è un\'email di prova dal sistema di prenotazioni.</p><p>Se la ricevi, la configurazione SMTP funziona.</p>'
    });
    res.json({ ok: true, message: 'Email di test inviata a ' + to });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, code: err.code });
  }
});

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Routes

// Auth routes
// Registrazione disabilitata: l'accesso è riservato all'account admin
app.post('/api/auth/register', async (req, res) => {
  res.status(403).json({ error: 'Registrazione non disponibile. Utilizza le credenziali dell’hotel.' });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Room types routes
app.get('/api/room-types', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM room_types ORDER BY base_price');
    const photosResult = await pool.query('SELECT room_type_id, id, data FROM room_photos ORDER BY position, id');
    const photosByRoom = {};
    photosResult.rows.forEach(p => {
      (photosByRoom[p.room_type_id] = photosByRoom[p.room_type_id] || []).push(p);
    });
    const rooms = result.rows.map(r => ({
      ...r,
      photos: photosByRoom[r.id] || []
    }));
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: upload a photo for a room
app.post('/api/room-types/:id/photos', authenticateToken, async (req, res) => {
  try {
    const { data } = req.body;
    const roomId = parseInt(req.params.id, 10);
    if (!data) {
      return res.status(400).json({ error: 'Foto mancante' });
    }
    if (typeof data === 'string' && data.length > 20 * 1024 * 1024) {
      return res.status(413).json({ error: 'La foto è troppo grande (max 20 MB).' });
    }
    const posResult = await pool.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM room_photos WHERE room_type_id = $1',
      [roomId]
    );
    const position = parseInt(posResult.rows[0].next, 10);
    const result = await pool.query(
      'INSERT INTO room_photos (room_type_id, data, position) VALUES ($1, $2, $3) RETURNING id, data, position',
      [roomId, data, position]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: delete a room photo
app.delete('/api/room-types/:id/photos/:photoId', authenticateToken, async (req, res) => {
  try {
    const roomId = parseInt(req.params.id, 10);
    const photoId = parseInt(req.params.photoId, 10);
    const result = await pool.query(
      'DELETE FROM room_photos WHERE id = $1 AND room_type_id = $2 RETURNING id',
      [photoId, roomId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Foto non trovata' });
    }
    res.json({ message: 'Foto eliminata' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Compute effective price (per-day overrides) for a date range
async function getEffectivePrice(roomTypeId, checkIn, checkOut) {
  const room = await pool.query(
    'SELECT base_price FROM room_types WHERE id = $1',
    [roomTypeId]
  );
  if (room.rows.length === 0) {
    const err = new Error('Room type not found');
    err.status = 404;
    throw err;
  }
  const basePrice = parseFloat(room.rows[0].base_price);
  const start = new Date(checkIn);
  const end = new Date(checkOut);

  const overrides = await pool.query(`
    SELECT date, price FROM room_daily_prices
    WHERE room_type_id = $1 AND date >= $2::date AND date < $3::date
  `, [roomTypeId, checkIn, checkOut]);

  const overrideMap = {};
  overrides.rows.forEach(r => {
    overrideMap[r.date.toISOString().slice(0, 10)] = parseFloat(r.price);
  });

  const days = [];
  let total = 0;
  let nights = 0;
  const cursor = new Date(start);
  while (cursor < end) {
    const key = cursor.toISOString().slice(0, 10);
    const price = overrideMap[key] !== undefined ? overrideMap[key] : basePrice;
    days.push({ date: key, price });
    total += price;
    nights += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  const roundedTotal = Math.round(total * 100) / 100;
  const discountedTotal = Math.round(roundedTotal * (1 - BOOKING_DISCOUNT) * 100) / 100;
  return { nights, total: roundedTotal, discountedTotal, discount: BOOKING_DISCOUNT, basePrice, days };
}

// Public quote: effective total for a date range
app.get('/api/quote', async (req, res) => {
  try {
    const { roomTypeId, checkIn, checkOut } = req.query;
    const result = await getEffectivePrice(roomTypeId, checkIn, checkOut);
    const firstNight = result.days.length > 0 ? result.days[0].price : 0;
    const firstNightAmount = Math.round(firstNight * (1 - result.discount) * 100) / 100;
    res.json({ ...result, firstNight, firstNightAmount });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Admin: get daily price overrides for a room in a period
app.get('/api/room-types/:id/prices', authenticateToken, async (req, res) => {
  try {
    const { from, to } = req.query;
    const result = await pool.query(`
      SELECT date, price FROM room_daily_prices
      WHERE room_type_id = $1 AND date >= $2::date AND date <= $3::date
      ORDER BY date
    `, [req.params.id, from, to]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: set/clear daily prices for a room (stripe-style booking)
// Body: { prices: { "2026-08-05": 85, "2026-08-06": null, ... } }
// A null value clears the override (reverts to base price).
app.put('/api/room-types/:id/prices', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { prices } = req.body;
    if (!prices || typeof prices !== 'object') {
      return res.status(400).json({ error: 'prices map is required' });
    }

    await client.query('BEGIN');
    for (const [date, value] of Object.entries(prices)) {
      if (value === null || value === undefined || value === '') {
        await client.query(
          'DELETE FROM room_daily_prices WHERE room_type_id = $1 AND date = $2::date',
          [id, date]
        );
      } else {
        await client.query(`
          INSERT INTO room_daily_prices (room_type_id, date, price)
          VALUES ($1, $2::date, $3)
          ON CONFLICT (room_type_id, date) DO UPDATE SET price = $3
        `, [id, date, parseFloat(value)]);
      }
    }
    await client.query('COMMIT');
    res.json({ message: 'Prices updated' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Room types admin - create
app.post('/api/room-types', authenticateToken, async (req, res) => {
  try {
    const { name, description, base_price, max_guests, photo } = req.body;

    if (!name || base_price === undefined || base_price === null) {
      return res.status(400).json({ error: 'Name and base_price are required' });
    }

    const result = await pool.query(`
      INSERT INTO room_types (name, description, base_price, max_guests, photo)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [name, description || '', parseFloat(base_price), parseInt(max_guests, 10) || 1, photo || null]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Room types CRUD - update
app.put('/api/room-types/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, base_price, max_guests, photo } = req.body;

    const result = await pool.query(`
      UPDATE room_types
      SET name = $1, description = $2, base_price = $3, max_guests = $4, photo = $5
      WHERE id = $6
      RETURNING *
    `, [
      name,
      description || '',
      parseFloat(base_price),
      parseInt(max_guests, 10) || 1,
      photo || null,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room type not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Room types CRUD - delete
app.delete('/api/room-types/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const bookingWithRoom = await pool.query(
      'SELECT id FROM booking_requests WHERE room_type_id = $1 LIMIT 1',
      [id]
    );

    let result;
    if (bookingWithRoom.rows.length > 0) {
      await pool.query('BEGIN');
      await pool.query('UPDATE booking_requests SET room_type_id = NULL WHERE room_type_id = $1', [id]);
      result = await pool.query('DELETE FROM room_types WHERE id = $1 RETURNING *', [id]);
      await pool.query('COMMIT');
    } else {
      result = await pool.query('DELETE FROM room_types WHERE id = $1 RETURNING *', [id]);
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room type not found' });
    }

    res.json({ message: 'Room type deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a PayPal order for the first-night deposit (amount computed server-side)
app.post('/api/paypal/create-order', async (req, res) => {
  try {
    const { roomTypeId, checkIn, checkOut } = req.body;
    const { days, discount } = await getEffectivePrice(roomTypeId, checkIn, checkOut);
    const firstNightFull = days.length > 0 ? days[0].price : 0;
    const firstNightAmount = Math.round(firstNightFull * (1 - discount) * 100) / 100;

    const orderId = await paypalCreateOrder(firstNightAmount);
    res.json({ orderId, firstNightAmount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create booking request (PayPal o bonifico)
app.post('/api/booking-requests', async (req, res) => {
  try {
    const {
      guestName, guestEmail, guestPhone,
      checkIn, checkOut, roomTypeId, numGuests,
      notes, paymentMethod, paypalOrderId, idDocument
    } = req.body;

    if (!guestName || !guestEmail || !checkIn || !checkOut || !roomTypeId || !idDocument) {
      const labels = {
        guestName: 'nome e cognome',
        guestEmail: 'email',
        guestPhone: 'telefono',
        checkIn: 'data di check-in',
        checkOut: 'data di check-out',
        roomTypeId: 'tipologia di camera',
        numGuests: 'numero ospiti',
        idDocument: 'documento d\'identità'
      };
      const missing = [];
      if (!guestName) missing.push(labels.guestName);
      if (!guestEmail) missing.push(labels.guestEmail);
      if (!guestPhone) missing.push(labels.guestPhone);
      if (!checkIn) missing.push(labels.checkIn);
      if (!checkOut) missing.push(labels.checkOut);
      if (!roomTypeId) missing.push(labels.roomTypeId);
      if (!idDocument) missing.push(labels.idDocument);
      return res.status(400).json({
        error: missing.length === 0
          ? 'Compila tutti i campi obbligatori.'
          : `Compila i campi obbligatori: ${missing.join(', ')}.`
      });
    }

    // Calculate total price (per-day, with overrides) and apply discount
    const { discountedTotal, days, discount } = await getEffectivePrice(roomTypeId, checkIn, checkOut);
    const firstNightFull = days.length > 0 ? days[0].price : 0;
    const firstNightAmount = Math.round(firstNightFull * (1 - discount) * 100) / 100;

    // Bonifico istantaneo: nessun pagamento online, l'amministratore verifica manualmente
    if (paymentMethod === 'bonifico') {
      const result = await pool.query(`
        INSERT INTO booking_requests (
          guest_name, guest_email, guest_phone,
          check_in, check_out, room_type_id, num_guests,
          total_price, first_night_amount, id_document, notes,
          payment_method, payment_status, booking_number
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, nextval('booking_number_seq'))
        RETURNING *
      `, [
        guestName, guestEmail, guestPhone,
        checkIn, checkOut, roomTypeId, numGuests,
        discountedTotal, firstNightAmount, idDocument, notes,
        'bonifico', 'bonifico'
      ]);
      return res.status(201).json(result.rows[0]);
    }

    // PayPal: AUTORIZZA (trattiene, NON addebita). Richiede un conto PayPal.
    // Addebito avviene solo alla conferma. Nessun rimborso automatico.
    if (!paypalOrderId) {
      return res.status(400).json({ error: 'paypalOrderId mancante' });
    }

    let authId;
    try {
      authId = await paypalAuthorizeOrder(paypalOrderId);
    } catch (err) {
      return res.status(400).json({
        error: 'Per pagare con PayPal serve un conto PayPal. In alternativa scegli il bonifico istantaneo.'
      });
    }

    const result = await pool.query(`
      INSERT INTO booking_requests (
        guest_name, guest_email, guest_phone,
        check_in, check_out, room_type_id, num_guests,
        total_price, first_night_amount, id_document, notes,
        payment_method, payment_status, paypal_order_id, paypal_auth_id, booking_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, nextval('booking_number_seq'))
      RETURNING *
    `, [
      guestName, guestEmail, guestPhone,
      checkIn, checkOut, roomTypeId, numGuests,
      discountedTotal, firstNightAmount, idDocument, notes,
      'paypal', 'authorized', paypalOrderId, authId
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all booking requests (admin only)
app.get('/api/booking-requests', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT br.*, rt.name as room_type_name, rt.base_price
      FROM booking_requests br
      JOIN room_types rt ON br.room_type_id = rt.id
      ORDER BY br.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get payment config
app.get('/api/payment-config', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM payment_config');
    const config = {};
    result.rows.forEach(row => {
      config[row.config_key] = row.config_value;
    });
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public bonifico info (shown to guests in the booking form)
app.get('/api/bonifico-info', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT config_key, config_value FROM payment_config WHERE config_key IN ('bonifico_iban', 'bonifico_intestatario')"
    );
    const info = {};
    result.rows.forEach(row => {
      info[row.config_key] = row.config_value;
    });
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update payment config
app.put('/api/payment-config', authenticateToken, async (req, res) => {
  try {
    const { payment_action, bonifico_iban, bonifico_intestatario } = req.body;

    const entries = [
      ['payment_action', payment_action],
      ['bonifico_iban', bonifico_iban],
      ['bonifico_intestatario', bonifico_intestatario]
    ].filter(([, value]) => value !== undefined);

    for (const [key, value] of entries) {
      await pool.query(`
        INSERT INTO payment_config (config_key, config_value)
        VALUES ($1, $2)
        ON CONFLICT (config_key) DO UPDATE SET config_value = $2
      `, [key, value]);
    }

    res.json({ message: 'Payment config updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Confirm booking request
// PayPal: la trattenuta viene ADDEBITATA solo adesso (capture). Il cliente non ha pagato prima.
// Bonifico in 2 passi:
//   step='preconfirm' -> invia email con IBAN, la prenotazione resta in attesa ('preconfirmed')
//   step='final'      -> verifica bonifico, conferma definitiva + email di conferma
app.post('/api/booking-requests/:id/confirm', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { step } = req.body;
    
    // Get booking request
    const bookingResult = await client.query(
      'SELECT * FROM booking_requests WHERE id = $1 FOR UPDATE',
      [id]
    );
    
    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking request not found' });
    }
    
    const booking = bookingResult.rows[0];
    
    if (!['pending', 'preconfirmed'].includes(booking.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Booking already processed' });
    }

    if (booking.payment_method === 'bonifico') {
      if (step === 'preconfirm') {
        if (booking.status !== 'pending') {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'IBAN già inviato' });
        }
        await client.query(
          'UPDATE booking_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['preconfirmed', id]
        );
        await client.query('COMMIT');
        // Email con IBAN (fuori transazione)
        try { await sendIbanEmail(booking); } catch (e) { console.error('Errore email IBAN:', e.message); }
        return res.json({ message: 'IBAN inviato al cliente, prenotazione in attesa del bonifico' });
      }

      // step final
      if (booking.status !== 'preconfirmed') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Prima invia l\'IBAN al cliente (pre-conferma)' });
      }
      await client.query(
        'UPDATE booking_requests SET status = $1, payment_status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        ['confirmed', 'bonifico', id]
      );
      await client.query('COMMIT');
      try { await sendConfirmationEmail(booking); } catch (e) { console.error('Errore email conferma:', e.message); }
      return res.json({ message: 'Pagamento verificato e prenotazione confermata' });
    }

    // PayPal: addebita la prima notte ora (l'importo era solo trattenuto)
    if (booking.payment_status === 'authorized' && booking.paypal_auth_id) {
      const captureId = await paypalCaptureAuth(booking.paypal_auth_id);
      await client.query(
        'UPDATE booking_requests SET status = $1, payment_status = $2, paypal_capture_id = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
        ['confirmed', 'captured', captureId, id]
      );
      await client.query('COMMIT');
      try { await sendConfirmationEmail(booking); } catch (e) { console.error('Errore email conferma:', e.message); }
      return res.json({ message: 'Acconto addebitato e prenotazione confermata' });
    }

    // Già addebitato o altro: basta confermare
    await client.query(
      'UPDATE booking_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['confirmed', id]
    );
    
    await client.query('COMMIT');
    try { await sendConfirmationEmail(booking); } catch (e) { console.error('Errore email conferma:', e.message); }
    
    res.json({ message: 'Prenotazione confermata' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Reject booking request
app.post('/api/booking-requests/:id/reject', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'UPDATE booking_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND status IN ($3, $4) RETURNING *',
      ['rejected', id, 'pending', 'preconfirmed']
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking request not found or already processed' });
    }

    // PayPal: rilascia la trattenuta (nessun addebito avvenuto)
    const booking = result.rows[0];
    if (booking.payment_method === 'paypal' && booking.paypal_auth_id) {
      try {
        await paypalVoidAuth(booking.paypal_auth_id);
        await pool.query('UPDATE booking_requests SET payment_status = $1 WHERE id = $2', ['voided', id]);
      } catch (e) {
        console.error('Errore rilascio PayPal:', e.message);
      }
    }

    // Email di rifiuto con tutti i dati della prenotazione
    try { await sendRejectionEmail(booking); } catch (e) { console.error('Errore email rifiuto:', e.message); }

    res.json({ message: 'Prenotazione rifiutata' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel a confirmed booking (hotel or guest cancellation)
app.post('/api/booking-requests/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE booking_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND status = $3 RETURNING *',
      ['cancelled', id, 'confirmed']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Confirmed booking not found' });
    }

    // On cancel, remove the ID document from the database (privacy)
    await pool.query(
      'UPDATE booking_requests SET id_document = NULL WHERE id = $1',
      [id]
    );

    // PayPal già addebitato: emette rimborso
    const booking = result.rows[0];
    if (booking.payment_method === 'paypal' && booking.paypal_capture_id) {
      try {
        // Rimborso gestito manualmente dall'albergo (nessun rimborso automatico)
        await pool.query(
          'UPDATE booking_requests SET payment_status = $1 WHERE id = $2',
          ['refund_pending', id]
        );
      } catch (e) {
        console.error('Errore aggiornamento stato PayPal:', e.message);
      }
    }

    res.json({ message: 'Prenotazione cancellata' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auto-reject pending bookings older than PAYPAL_CONFIRM_HOURS (default 24h)
// and release any PayPal hold.
async function autoRejectExpired() {
  try {
    const expired = await pool.query(
      `SELECT * FROM booking_requests
       WHERE status IN ('pending', 'preconfirmed')
         AND created_at < NOW() - ($1 || ' hours')::interval`,
      [PAYPAL_CONFIRM_HOURS]
    );
    for (const booking of expired.rows) {
      if (booking.payment_method === 'paypal' && booking.paypal_auth_id) {
        try {
          await paypalVoidAuth(booking.paypal_auth_id);
          await pool.query(
            'UPDATE booking_requests SET status = $1, payment_status = $2, id_document = NULL WHERE id = $3',
            ['rejected', 'voided', booking.id]
          );
        } catch (e) {
          console.error('Errore auto-rilasciamento PayPal:', e.message);
          await pool.query(
            'UPDATE booking_requests SET status = $1, id_document = NULL WHERE id = $2',
            ['rejected', booking.id]
          );
        }
      } else {
        await pool.query(
          'UPDATE booking_requests SET status = $1, id_document = NULL WHERE id = $2',
          ['rejected', booking.id]
        );
      }
      try { await sendRejectionEmail(booking); } catch (e) { console.error('Errore email rifiuto:', e.message); }
    }
  } catch (e) {
    console.error('Errore auto-rifiuto scaduti:', e.message);
  }
}

// Start server
// Non lasciare che errori non gestiti (es. TLS/SMTP) uccidano il processo
process.on('unhandledRejection', (reason) => {
  console.error('[UNCAUGHT REJECTION]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err && err.stack || err);
});

initDatabase()
  .then(async () => {
    console.log('Database initialized');
    try {
      await seedRoomPhotos();
    } catch (e) {
      console.error('Errore seed foto camere:', e.message);
    }
  })
  .catch((err) => {
    console.error('Database init error:', err.message);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Job periodico: auto-rifiuto prenotazioni pending oltre le ore configurate
    autoRejectExpired();
    setInterval(autoRejectExpired, 15 * 60 * 1000);
  });

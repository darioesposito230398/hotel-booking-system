require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
let stripe;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}
const { body, validationResult } = require('express-validator');

// Sconto promozionale applicato al cliente (10% sul prezzo pieno)
const BOOKING_DISCOUNT = 0.10;

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

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

    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}

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
    res.json(result.rows);
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

// Stripe payment method tokenization
// La carta viene addebitata SOLO per la prima notte; il resto si paga in struttura.
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { roomTypeId, checkIn, checkOut, numGuests } = req.body;

    // Calculate total price (per-day, with overrides) and apply discount
    const { total, discountedTotal, days, discount } = await getEffectivePrice(roomTypeId, checkIn, checkOut);

    // Importo addebitato = solo la prima notte, scontata
    const firstNightFull = days.length > 0 ? days[0].price : 0;
    const firstNightAmount = Math.round(firstNightFull * (1 - discount) * 100) / 100;

    // Create a PaymentIntent with the first-night amount but don't charge yet
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(firstNightAmount * 100), // Stripe uses cents
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      firstNightAmount,
      totalPrice: firstNightAmount,
      originalTotal: total,
      discountedTotal,
      discount,
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Create booking request
app.post('/api/booking-requests', async (req, res) => {
  try {
    const {
      guestName, guestEmail, guestPhone,
      checkIn, checkOut, roomTypeId, numGuests,
      notes, paymentIntentId, paymentMethod
    } = req.body;

    // Calculate total price (per-day, with overrides) and apply discount
    const { discountedTotal, days, discount } = await getEffectivePrice(roomTypeId, checkIn, checkOut);
    const nights = days.length;
    const firstNightFull = days.length > 0 ? days[0].price : 0;
    const firstNightAmount = Math.round(firstNightFull * (1 - discount) * 100) / 100;

    const method = paymentMethod === 'bonifico' ? 'bonifico' : 'card';

    // For bank transfer: no Stripe involved, admin verifies the transfer manually
    if (method === 'bonifico') {
      const result = await pool.query(`
        INSERT INTO booking_requests (
          guest_name, guest_email, guest_phone,
          check_in, check_out, room_type_id, num_guests,
          total_price, first_night_amount, notes,
          payment_method, payment_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        guestName, guestEmail, guestPhone,
        checkIn, checkOut, roomTypeId, numGuests,
        discountedTotal, firstNightAmount, notes,
        'bonifico', 'bonifico'
      ]);
      return res.status(201).json(result.rows[0]);
    }

    // Retrieve payment method from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Create Stripe customer and attach payment method
    const customer = await stripe.customers.create({
      email: guestEmail,
      name: guestName,
      payment_method: paymentIntent.payment_method,
      invoice_settings: { default_payment_method: paymentIntent.payment_method }
    });

    // Save booking request
    const result = await pool.query(`
      INSERT INTO booking_requests (
        guest_name, guest_email, guest_phone,
        check_in, check_out, room_type_id, num_guests,
        total_price, first_night_amount, notes,
        stripe_payment_method_id, stripe_customer_id,
        payment_method, payment_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      guestName, guestEmail, guestPhone,
      checkIn, checkOut, roomTypeId, numGuests,
      discountedTotal, firstNightAmount, notes,
      paymentIntent.payment_method, customer.id,
      'card', 'card'
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
app.post('/api/booking-requests/:id/confirm', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { payment_action } = req.body;
    
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
    
    if (booking.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Booking already processed' });
    }

    // Bonifico: nessun addebito Stripe, l'amministratore verifica il bonifico manualmente
    if (booking.payment_method === 'bonifico') {
      await client.query(
        'UPDATE booking_requests SET status = $1, payment_status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        ['confirmed', 'bonifico', id]
      );
      await client.query('COMMIT');
      return res.json({ message: 'Pagamento verificato e prenotazione confermata' });
    }

    // Importo addebitato = solo la prima notte (il resto si paga in struttura)
    const chargeAmount = booking.first_night_amount
      ? parseFloat(booking.first_night_amount)
      : parseFloat(booking.total_price);

    // Process payment based on config
    if (payment_action === 'charge_on_confirm') {
      // Charge the customer (solo prima notte)
      await stripe.paymentIntents.create({
        amount: Math.round(chargeAmount * 100),
        currency: 'eur',
        customer: booking.stripe_customer_id,
        payment_method: booking.stripe_payment_method_id,
        off_session: true,
        confirm: true
      });
      
      await client.query(
        'UPDATE booking_requests SET status = $1, payment_status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        ['confirmed', 'charged', id]
      );
    } else if (payment_action === 'authorize_only') {
      // Just authorize (pre-auth) - prima notte
      await stripe.paymentIntents.create({
        amount: Math.round(chargeAmount * 100),
        currency: 'eur',
        customer: booking.stripe_customer_id,
        payment_method: booking.stripe_payment_method_id,
        capture_method: 'manual',
        off_session: true,
        confirm: true
      });
      
      await client.query(
        'UPDATE booking_requests SET status = $1, payment_status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        ['confirmed', 'authorized', id]
      );
    } else {
      // No payment action, just confirm
      await client.query(
        'UPDATE booking_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        ['confirmed', id]
      );
    }
    
    await client.query('COMMIT');
    
    res.json({ message: 'Booking confirmed successfully' });
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
      'UPDATE booking_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND status = $3 RETURNING *',
      ['rejected', id, 'pending']
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking request not found or already processed' });
    }
    
    res.json({ message: 'Booking rejected' });
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

    res.json({ message: 'Booking cancelled' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
initDatabase()
  .then(() => {
    console.log('Database initialized');
  })
  .catch((err) => {
    console.error('Database init error:', err.message);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });

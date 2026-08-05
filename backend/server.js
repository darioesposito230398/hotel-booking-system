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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

    // Seed room types only if none exist (so admin edits persist across restarts)
    const existingRooms = await client.query('SELECT COUNT(*) AS count FROM room_types');
    if (parseInt(existingRooms.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO room_types (name, description, base_price, max_guests) VALUES
        ('Singola Bagno Condiviso', 'Camera singola con TV, scrivania, armadio e bagno condiviso. 12 m²', 45.00, 1),
        ('Doppia/Twin Bagno Condiviso', 'Camera doppia o matrimoniale con TV, scrivania, balcone e bagno condiviso. 15 m²', 55.00, 2),
        ('Singola Bagno Privato', 'Camera singola con aria condizionata, TV, bagno privato con bidet. 12 m²', 60.00, 1),
        ('Doppia Standard', 'Camera doppia con bagno privato, TV, balcone. 15 m²', 75.00, 2),
        ('Tripla Standard', 'Camera triple con bagno privato, TV, balcone. 18 m²', 90.00, 3);
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
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email',
      [email, hashedPassword]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: error.message });
  }
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

// Room types admin - create
app.post('/api/room-types', authenticateToken, async (req, res) => {
  try {
    const { name, description, base_price, max_guests } = req.body;

    if (!name || base_price === undefined || base_price === null) {
      return res.status(400).json({ error: 'Name and base_price are required' });
    }

    const result = await pool.query(`
      INSERT INTO room_types (name, description, base_price, max_guests)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [name, description || '', parseFloat(base_price), parseInt(max_guests, 10) || 1]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Room types CRUD - update
app.put('/api/room-types/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, base_price, max_guests } = req.body;

    const result = await pool.query(`
      UPDATE room_types
      SET name = $1, description = $2, base_price = $3, max_guests = $4
      WHERE id = $5
      RETURNING *
    `, [
      name,
      description || '',
      parseFloat(base_price),
      parseInt(max_guests, 10) || 1,
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
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { roomTypeId, checkIn, checkOut, numGuests } = req.body;
    
    // Calculate total price
    const roomType = await pool.query('SELECT * FROM room_types WHERE id = $1', [roomTypeId]);
    if (roomType.rows.length === 0) {
      return res.status(404).json({ error: 'Room type not found' });
    }
    
    const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
    const totalPrice = roomType.rows[0].base_price * nights;
    
    // Create a PaymentIntent with amount but don't charge yet
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalPrice * 100), // Stripe uses cents
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
    });
    
    res.json({
      clientSecret: paymentIntent.client_secret,
      totalPrice,
      nights
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create booking request
app.post('/api/booking-requests', async (req, res) => {
  try {
    const {
      guestName, guestEmail, guestPhone,
      checkIn, checkOut, roomTypeId, numGuests,
      notes, paymentIntentId
    } = req.body;
    
    // Retrieve payment method from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    // Calculate total price
    const roomType = await pool.query('SELECT * FROM room_types WHERE id = $1', [roomTypeId]);
    const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
    const totalPrice = roomType.rows[0].base_price * nights;
    
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
        total_price, notes, stripe_payment_method_id, stripe_customer_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      guestName, guestEmail, guestPhone,
      checkIn, checkOut, roomTypeId, numGuests,
      totalPrice, notes, paymentIntent.payment_method, customer.id
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

// Update payment config
app.put('/api/payment-config', authenticateToken, async (req, res) => {
  try {
    const { payment_action } = req.body;
    
    await pool.query(`
      INSERT INTO payment_config (config_key, config_value)
      VALUES ('payment_action', $1)
      ON CONFLICT (config_key) DO UPDATE SET config_value = $1
    `, [payment_action]);
    
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
    
    // Process payment based on config
    if (payment_action === 'charge_on_confirm') {
      // Charge the customer
      await stripe.paymentIntents.create({
        amount: Math.round(booking.total_price * 100),
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
      // Just authorize (pre-auth)
      await stripe.paymentIntents.create({
        amount: Math.round(booking.total_price * 100),
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

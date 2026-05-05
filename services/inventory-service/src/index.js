const express = require('express');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.'
});

app.use(apiLimiter);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://inventory:password@localhost:5432/inventorydb'
});

// Initialize database
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id SERIAL PRIMARY KEY,
        product_id INTEGER UNIQUE NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        reserved_quantity INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

initDB();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'inventory-service' });
});

// Get inventory for product
app.get('/inventory/:product_id', async (req, res) => {
  const { product_id } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM inventory WHERE product_id = $1',
      [product_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found in inventory' });
    }

    const inventory = result.rows[0];
    res.json({
      product_id: inventory.product_id,
      available_quantity: inventory.quantity - inventory.reserved_quantity,
      total_quantity: inventory.quantity,
      reserved_quantity: inventory.reserved_quantity
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Update inventory
app.put('/inventory/:product_id', async (req, res) => {
  const { product_id } = req.params;
  const { quantity } = req.body;

  if (quantity === undefined || quantity < 0) {
    return res.status(400).json({ error: 'Valid quantity is required' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO inventory (product_id, quantity)
      VALUES ($1, $2)
      ON CONFLICT (product_id)
      DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [product_id, quantity]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

// Reserve inventory
app.post('/inventory/:product_id/reserve', async (req, res) => {
  const { product_id } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Valid quantity is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check current inventory
    const current = await client.query(
      'SELECT * FROM inventory WHERE product_id = $1 FOR UPDATE',
      [product_id]
    );

    if (current.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found in inventory' });
    }

    const inventory = current.rows[0];
    const available = inventory.quantity - inventory.reserved_quantity;

    if (available < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient inventory' });
    }

    // Reserve quantity
    await client.query(
      'UPDATE inventory SET reserved_quantity = reserved_quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE product_id = $2',
      [quantity, product_id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Inventory reserved successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error reserving inventory:', error);
    res.status(500).json({ error: 'Failed to reserve inventory' });
  } finally {
    client.release();
  }
});

// Release reserved inventory
app.post('/inventory/:product_id/release', async (req, res) => {
  const { product_id } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Valid quantity is required' });
  }

  try {
    await pool.query(
      'UPDATE inventory SET reserved_quantity = GREATEST(reserved_quantity - $1, 0), updated_at = CURRENT_TIMESTAMP WHERE product_id = $2',
      [quantity, product_id]
    );

    res.json({ message: 'Inventory released successfully' });
  } catch (error) {
    console.error('Error releasing inventory:', error);
    res.status(500).json({ error: 'Failed to release inventory' });
  }
});

// Get all inventory
app.get('/inventory', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory ORDER BY product_id');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

const PORT = process.env.PORT || 8006;
app.listen(PORT, () => {
  console.log(`Inventory service running on port ${PORT}`);
});
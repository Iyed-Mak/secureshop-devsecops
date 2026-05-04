const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://order:password@localhost:5432/orderdb'
});

// Initialize database
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        total_amount DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price DECIMAL(10,2) NOT NULL
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
  res.json({ status: 'ok', service: 'order-service' });
});

// Create order
app.post('/orders', async (req, res) => {
  let { user_id, items, product_id, quantity, price } = req.body;

  if (!items) {
    if (product_id == null || quantity == null) {
      return res.status(400).json({ error: 'user_id and items are required' });
    }

    items = [{
      product_id,
      quantity,
      price: price || 0
    }];
  }

  if (!user_id) {
    user_id = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : 1;
  }

  if (!user_id || !items || items.length === 0) {
    return res.status(400).json({ error: 'user_id and items are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fill in missing prices from product service
    for (const item of items) {
      if (item.price == null || item.price === 0) {
        try {
          const response = await fetch(`http://product-service:8002/products/${item.product_id}`);
          if (response.ok) {
            const product = await response.json();
            item.price = product.price || 0;
          }
        } catch (error) {
          console.warn('Could not fetch product price:', error);
          item.price = item.price || 0;
        }
      }
    }

    // Calculate total
    let total = 0;
    for (const item of items) {
      total += item.price * item.quantity;
    }

    // Create order
    const orderResult = await client.query(
      'INSERT INTO orders (user_id, total_amount) VALUES ($1, $2) RETURNING id',
      [user_id, total]
    );
    const orderId = orderResult.rows[0].id;

    // Add order items
    for (const item of items) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
        [orderId, item.product_id, item.quantity, item.price]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ order_id: orderId, status: 'created', total_amount: total });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
    client.release();
  }
});

// Get orders for user
app.get('/orders', async (req, res) => {
  const user_id = req.query.user_id ? parseInt(req.query.user_id, 10) : 1;

  try {
    const orders = await pool.query(`
      SELECT o.*, json_agg(oi.*) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.user_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `, [user_id]);

    res.json(orders.rows);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get order by ID
app.get('/orders/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const order = await pool.query(`
      SELECT o.*, json_agg(oi.*) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.id = $1
      GROUP BY o.id
    `, [id]);

    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order.rows[0]);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Update order status
app.put('/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'status is required' });
  }

  try {
    const result = await pool.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

const PORT = process.env.PORT || 8003;
app.listen(PORT, () => {
  console.log(`Order service running on port ${PORT}`);
});
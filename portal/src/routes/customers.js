const express = require('express');
const router = express.Router();
const winston = require('winston');

// Get database connections from server module
let pgPool;
setTimeout(() => {
  const server = require('../../server');
  pgPool = server.pgPool;
}, 0);

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Get all customers
router.get('/', async (req, res) => {
  try {
    const result = await pgPool.query(
      'SELECT * FROM customers ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching customers:', err);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Get single customer by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await pgPool.query(
      'SELECT * FROM customers WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error fetching customer:', err);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// Create new customer
router.post('/', async (req, res) => {
  try {
    const customer = req.body;
    const query = `
      INSERT INTO customers (
        name, contact_name, email, phone,
        address, city, state, zip
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [
      customer.company_name || customer.name, customer.contact_name, customer.email,
      customer.phone, customer.address, customer.city,
      customer.state, customer.zip
    ];
    
    const result = await pgPool.query(query, values);
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error creating customer:', err);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Update customer
router.put('/:id', async (req, res) => {
  try {
    const customer = req.body;
    const query = `
      UPDATE customers SET
        name = $2, contact_name = $3, email = $4, phone = $5,
        address = $6, city = $7, state = $8, zip = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const values = [
      req.params.id, customer.company_name || customer.name, customer.contact_name,
      customer.email, customer.phone, customer.address,
      customer.city, customer.state, customer.zip
    ];
    
    const result = await pgPool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error updating customer:', err);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Delete customer
router.delete('/:id', async (req, res) => {
  try {
    // Check if customer has equipment
    const equipmentCheck = await pgPool.query(
      'SELECT COUNT(*) FROM equipment WHERE customer_id = $1',
      [req.params.id]
    );
    
    if (parseInt(equipmentCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete customer with associated equipment' 
      });
    }
    
    const result = await pgPool.query(
      'DELETE FROM customers WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json({ success: true });
  } catch (err) {
    logger.error('Error deleting customer:', err);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// Get customer with equipment count
router.get('/:id/summary', async (req, res) => {
  try {
    const customerResult = await pgPool.query(
      'SELECT * FROM customers WHERE id = $1',
      [req.params.id]
    );
    
    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const equipmentResult = await pgPool.query(
      'SELECT COUNT(*) as equipment_count FROM equipment WHERE customer_id = $1',
      [req.params.id]
    );
    
    const customer = customerResult.rows[0];
    customer.equipment_count = parseInt(equipmentResult.rows[0].equipment_count);
    
    res.json(customer);
  } catch (err) {
    logger.error('Error fetching customer summary:', err);
    res.status(500).json({ error: 'Failed to fetch customer summary' });
  }
});

module.exports = router;
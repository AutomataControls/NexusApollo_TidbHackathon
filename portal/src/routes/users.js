const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
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

// Get all users
router.get('/', async (req, res) => {
  try {
    const result = await pgPool.query(
      'SELECT id, username, name, email, role, last_login FROM users ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    logger.error('Failed to fetch users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get single user
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pgPool.query(
      'SELECT id, username, name, email, role, last_login FROM users WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Failed to fetch user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create user
router.post('/', async (req, res) => {
  try {
    const { username, name, email, password, role = 'viewer' } = req.body;
    
    // Check if username exists
    const existing = await pgPool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert user
    const result = await pgPool.query(
      `INSERT INTO users (username, password, name, email, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, name, email, role, created_at`,
      [username, hashedPassword, name, email, role]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Failed to create user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, name, email, password, role } = req.body;
    
    // Check if user exists
    const existing = await pgPool.query(
      'SELECT id FROM users WHERE id = $1',
      [id]
    );
    
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    let query = `
      UPDATE users 
      SET username = $1, name = $2, email = $3, role = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING id, username, name, email, role
    `;
    let params = [username, name, email, role, id];
    
    // If password provided, update it
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = `
        UPDATE users 
        SET username = $1, name = $2, email = $3, role = $4, password = $5, updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING id, username, name, email, role
      `;
      params = [username, name, email, role, hashedPassword, id];
    }
    
    const result = await pgPool.query(query, params);
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Failed to update user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent deleting the last admin
    const adminCount = await pgPool.query(
      "SELECT COUNT(*) FROM users WHERE role = 'admin'"
    );
    
    if (adminCount.rows[0].count <= 1) {
      const userRole = await pgPool.query(
        'SELECT role FROM users WHERE id = $1',
        [id]
      );
      
      if (userRole.rows[0]?.role === 'admin') {
        return res.status(400).json({ error: 'Cannot delete the last admin user' });
      }
    }
    
    const result = await pgPool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
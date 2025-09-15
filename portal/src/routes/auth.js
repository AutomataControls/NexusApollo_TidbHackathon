const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Get database connections from server module
let pgPool;
setTimeout(() => {
  const server = require('../../server');
  pgPool = server.pgPool;
  initializeDefaultUser();
}, 0);

// Initialize default DevOps user if not exists
async function initializeDefaultUser() {
  try {
    // Check if users table exists and create default user
    const checkUser = await pgPool.query(
      "SELECT * FROM users WHERE username = 'DevOps'"
    );
    
    if (checkUser.rows.length === 0) {
      // Hash the default password
      const hashedPassword = await bcrypt.hash('Invertedskynet2$', 10);
      
      // Create default DevOps user
      await pgPool.query(`
        INSERT INTO users (username, password, name, email, role)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (username) DO NOTHING
      `, ['DevOps', hashedPassword, 'DevOps Administrator', 'devops@apollonexus.com', 'admin']);
      
      console.log('Default DevOps user created');
    }
  } catch (error) {
    console.error('Error initializing default user:', error);
  }
}

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    console.log('Login attempt:', { username: req.body.username, hasPassword: !!req.body.password });
    const { username, password } = req.body;

    // Find user in database
    const result = await pgPool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid username or password' 
      });
    }

    const user = result.rows[0];

    // Verify password
    // For Demo user, use plain text comparison (for hackathon demo)
    let isValidPassword;
    if (user.username === 'Demo') {
      isValidPassword = password === user.password;
    } else {
      isValidPassword = await bcrypt.compare(password, user.password);
    }
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid username or password' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username,
        role: user.role 
      },
      process.env.JWT_SECRET || 'apollo-nexus-secret-key',
      { expiresIn: '24h' }
    );

    // Return user data (without password)
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Validate token endpoint
router.get('/validate', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Logout endpoint (mainly for logging/audit)
router.post('/logout', authenticateToken, (req, res) => {
  // In a real app, you might want to blacklist the token or log the logout
  res.json({ success: true });
});

// Change password endpoint
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    // Find user in database
    const result = await pgPool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password in database
    await pgPool.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, userId]
    );

    res.json({ success: true, message: 'Password updated successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Middleware to authenticate token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'apollo-nexus-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Export middleware for use in other routes
router.authenticateToken = authenticateToken;

module.exports = router;
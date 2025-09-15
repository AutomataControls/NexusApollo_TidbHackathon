const express = require('express');
const router = express.Router();
const winston = require('winston');
const { Resend } = require('resend');

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

// Get all settings
router.get('/', async (req, res) => {
  try {
    const result = await pgPool.query('SELECT * FROM system_settings');
    
    // Convert array of key-value pairs to object
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    
    // Merge with defaults
    const fullSettings = {
      general: settings.general || {
        companyName: 'AutomataNexus',
        timezone: 'America/New_York',
        dateFormat: 'MM/DD/YYYY',
        temperatureUnit: 'F'
      },
      notifications: settings.notifications || {
        emailEnabled: true,
        emailFrom: 'noreply@automatacontrols.com',
        criticalAlerts: true,
        warningAlerts: true,
        dailyDigest: true,
        digestTime: '08:00'
      },
      energy: settings.energy || {
        utilityProvider: 'Default Utility',
        kwhRate: 0.15,
        demandRate: 25.00,
        currency: 'USD',
        billingCycle: 'monthly'
      },
      hardware: settings.hardware || {
        sensorPollInterval: 1000,
        dataRetentionDays: 90,
        enableHailo: true,
        enableApollo: true
      }
    };
    
    res.json(fullSettings);
  } catch (err) {
    logger.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings
router.put('/', async (req, res) => {
  try {
    const settings = req.body;
    
    // Update each setting category
    for (const [key, value] of Object.entries(settings)) {
      if (typeof value === 'object') {
        await pgPool.query(`
          INSERT INTO system_settings (key, value)
          VALUES ($1, $2)
          ON CONFLICT (key) DO UPDATE
          SET value = $2, updated_at = CURRENT_TIMESTAMP
        `, [key, JSON.stringify(value)]);
      }
    }
    
    res.json({ success: true, settings });
  } catch (err) {
    logger.error('Error updating settings:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Get specific setting
router.get('/:key', async (req, res) => {
  try {
    const result = await pgPool.query(
      'SELECT value FROM system_settings WHERE key = $1',
      [req.params.key]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    res.json(result.rows[0].value);
  } catch (err) {
    logger.error('Error fetching setting:', err);
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
});

// Test email configuration
router.post('/test-email', async (req, res) => {
  try {
    // Get email settings
    const result = await pgPool.query(
      'SELECT value FROM system_settings WHERE key = $1',
      ['notifications']
    );
    
    const notifications = result.rows[0]?.value || {};
    
    if (!notifications.emailEnabled) {
      return res.status(400).json({ error: 'Email notifications are disabled' });
    }
    
    // Create Resend client
    const resend = new Resend(process.env.RESEND_API);
    
    // Send test email
    await resend.emails.send({
      from: notifications.emailFrom || process.env.EMAIL_FROM || 'noreply@automatacontrols.com',
      to: req.body.email || req.user?.email || process.env.DEFAULT_RECIPIENT || 'devops@automatacontrols.com',
      subject: 'Apollo Nexus - Test Email',
      html: `
        <h2>Apollo Nexus Email Test</h2>
        <p>This is a test email from your Apollo Nexus system.</p>
        <p>If you received this email, your email configuration is working correctly.</p>
        <hr>
        <p><small>Sent from Apollo Nexus at ${new Date().toLocaleString()}</small></p>
      `
    });
    
    res.json({ success: true, message: 'Test email sent' });
  } catch (err) {
    logger.error('Error sending test email:', err);
    res.status(500).json({ error: 'Failed to send test email', details: err.message });
  }
});

// User management endpoints
router.get('/users', async (req, res) => {
  try {
    const result = await pgPool.query(`
      SELECT id, username, name, email, role, last_login, created_at
      FROM users
      ORDER BY created_at DESC
    `);
    
    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching users:', err);
    // Return mock data for now
    res.json([
      {
        id: 1,
        username: 'admin',
        name: 'Administrator',
        email: 'admin@apollonexus.com',
        role: 'admin',
        lastLogin: new Date().toISOString()
      },
      {
        id: 2,
        username: 'demo',
        name: 'Demo User',
        email: 'demo@apollonexus.com',
        role: 'technician',
        lastLogin: new Date().toISOString()
      }
    ]);
  }
});

// Create user
router.post('/users', async (req, res) => {
  try {
    const { username, name, email, role, password } = req.body;
    
    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pgPool.query(`
      INSERT INTO users (username, name, email, role, password)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, name, email, role, created_at
    `, [username, name, email, role, hashedPassword]);
    
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
router.put('/users/:id', async (req, res) => {
  try {
    const { name, email, role } = req.body;
    
    const result = await pgPool.query(`
      UPDATE users
      SET name = $2, email = $3, role = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, username, name, email, role
    `, [req.params.id, name, email, role]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error updating user:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    // Don't allow deleting the last admin
    const adminCount = await pgPool.query(
      "SELECT COUNT(*) FROM users WHERE role = 'admin'"
    );
    
    const userResult = await pgPool.query(
      'SELECT role FROM users WHERE id = $1',
      [req.params.id]
    );
    
    if (userResult.rows[0]?.role === 'admin' && parseInt(adminCount.rows[0].count) <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last admin user' });
    }
    
    await pgPool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    logger.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// System info endpoint
router.get('/system/info', async (req, res) => {
  try {
    const hardwareManager = require('../../hardware/hardwareManager');
    const tidbService = require('../../services/tidbVectorService');

    // Get database sizes
    const pgSize = await pgPool.query(`
      SELECT pg_database_size(current_database()) as size
    `);

    // Get sensor data count
    const sensorDb = require('../../server').sensorDb;
    const sensorCount = await new Promise((resolve, reject) => {
      sensorDb.get('SELECT COUNT(*) as count FROM sensor_readings', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    // Get TiDB stats
    let tidbInfo = {
      connected: false,
      patterns: 0,
      embeddings: 0,
      inferences: 0,
      solutions: 0
    };

    try {
      // Check if TiDB is connected and get stats
      if (!tidbService.connection) {
        await tidbService.connect();
      }

      const stats = await tidbService.getVectorStats();
      tidbInfo = {
        connected: true,
        patterns: stats.patterns || 0,
        embeddings: stats.embeddings || 0,
        inferences: stats.inferences || 0,
        solutions: stats.solutions || 0
      };
    } catch (tidbError) {
      logger.warn('TiDB not connected or error getting stats:', tidbError.message);
      // Keep default tidbInfo values
    }

    res.json({
      version: '1.0.0',
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: {
        postgres: {
          size: parseInt(pgSize.rows[0].size),
          connected: true
        },
        sqlite: {
          sensorCount: sensorCount,
          connected: true
        },
        tidb: tidbInfo
      },
      hardware: hardwareManager.getStatus()
    });
  } catch (err) {
    logger.error('Error fetching system info:', err);
    res.status(500).json({ error: 'Failed to fetch system info' });
  }
});

// Backup settings
router.post('/backup', async (req, res) => {
  try {
    // Get all settings
    const settings = await pgPool.query('SELECT * FROM system_settings');
    const customers = await pgPool.query('SELECT * FROM customers');
    const equipment = await pgPool.query('SELECT * FROM equipment');
    const sensorConfigs = await pgPool.query('SELECT * FROM sensor_configs');
    
    const backup = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      data: {
        settings: settings.rows,
        customers: customers.rows,
        equipment: equipment.rows,
        sensorConfigs: sensorConfigs.rows
      }
    };
    
    res.json(backup);
  } catch (err) {
    logger.error('Error creating backup:', err);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// Restore settings
router.post('/restore', async (req, res) => {
  try {
    const backup = req.body;
    
    if (!backup.version || !backup.data) {
      return res.status(400).json({ error: 'Invalid backup format' });
    }
    
    // Begin transaction
    await pgPool.query('BEGIN');
    
    try {
      // Restore settings
      if (backup.data.settings) {
        for (const setting of backup.data.settings) {
          await pgPool.query(`
            INSERT INTO system_settings (key, value)
            VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE SET value = $2
          `, [setting.key, setting.value]);
        }
      }
      
      await pgPool.query('COMMIT');
      res.json({ success: true, message: 'Backup restored successfully' });
    } catch (err) {
      await pgPool.query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    logger.error('Error restoring backup:', err);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

module.exports = router;
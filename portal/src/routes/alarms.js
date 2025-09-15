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

// Get all alarms with optional filters
router.get('/', async (req, res) => {
  try {
    const { 
      equipment_id, 
      severity, 
      status, 
      start_date, 
      end_date 
    } = req.query;
    
    let query = `
      SELECT 
        a.*,
        e.location_name as equipment_name,
        c.name as customer_name
      FROM alarms a
      LEFT JOIN equipment e ON a.equipment_id = e.id
      LEFT JOIN customers c ON e.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (equipment_id) {
      query += ` AND a.equipment_id = $${++paramCount}`;
      params.push(equipment_id);
    }

    if (severity) {
      query += ` AND a.severity = $${++paramCount}`;
      params.push(severity);
    }

    if (status === 'active') {
      query += ` AND a.resolved = false`;
    } else if (status === 'resolved') {
      query += ` AND a.resolved = true`;
    } else if (status === 'unacknowledged') {
      query += ` AND a.acknowledged = false AND a.resolved = false`;
    }

    if (start_date) {
      query += ` AND a.timestamp >= $${++paramCount}`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND a.timestamp <= $${++paramCount}`;
      params.push(end_date);
    }

    query += ` ORDER BY a.timestamp DESC LIMIT 1000`;

    const result = await pgPool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching alarms:', err);
    res.status(500).json({ error: 'Failed to fetch alarms' });
  }
});

// Get single alarm
router.get('/:id', async (req, res) => {
  try {
    const result = await pgPool.query(
      'SELECT * FROM alarms WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alarm not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error fetching alarm:', err);
    res.status(500).json({ error: 'Failed to fetch alarm' });
  }
});

// Create new alarm (usually done automatically by the system)
router.post('/', async (req, res) => {
  try {
    const alarm = req.body;
    const query = `
      INSERT INTO alarms (
        equipment_id, type, source, value, severity,
        timestamp, acknowledged, resolved, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const values = [
      alarm.equipment_id,
      alarm.type,
      alarm.source,
      alarm.value,
      alarm.severity,
      alarm.timestamp || new Date().toISOString(),
      false,
      false,
      alarm.notes
    ];
    
    const result = await pgPool.query(query, values);
    
    // Emit to WebSocket clients
    const io = req.app.get('io');
    if (io) {
      io.emit('alarm', result.rows[0]);
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error creating alarm:', err);
    res.status(500).json({ error: 'Failed to create alarm' });
  }
});

// Acknowledge alarm
router.post('/:id/acknowledge', async (req, res) => {
  try {
    const { acknowledged_by } = req.body;
    
    const query = `
      UPDATE alarms SET
        acknowledged = true,
        acknowledged_by = $2,
        acknowledged_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND resolved = false
      RETURNING *
    `;
    
    const result = await pgPool.query(query, [req.params.id, acknowledged_by]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alarm not found or already resolved' });
    }
    
    // Emit to WebSocket clients
    const io = req.app.get('io');
    if (io) {
      io.emit('alarm-acknowledged', req.params.id, acknowledged_by);
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error acknowledging alarm:', err);
    res.status(500).json({ error: 'Failed to acknowledge alarm' });
  }
});

// Resolve alarm
router.post('/:id/resolve', async (req, res) => {
  try {
    const { notes } = req.body;
    
    const query = `
      UPDATE alarms SET
        resolved = true,
        resolved_at = CURRENT_TIMESTAMP,
        notes = COALESCE($2, notes)
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pgPool.query(query, [req.params.id, notes]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alarm not found' });
    }
    
    // Emit to WebSocket clients
    const io = req.app.get('io');
    if (io) {
      io.emit('alarm-resolved', req.params.id);
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error resolving alarm:', err);
    res.status(500).json({ error: 'Failed to resolve alarm' });
  }
});

// Get alarm statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const { equipment_id, days = 7 } = req.query;
    
    let whereClause = `WHERE timestamp >= CURRENT_DATE - INTERVAL '${days} days'`;
    const params = [];
    
    if (equipment_id) {
      whereClause += ' AND equipment_id = $1';
      params.push(equipment_id);
    }
    
    const query = `
      SELECT 
        COUNT(*) FILTER (WHERE resolved = false) as active_count,
        COUNT(*) FILTER (WHERE resolved = false AND severity >= 3) as critical_count,
        COUNT(*) FILTER (WHERE resolved = false AND severity = 2) as warning_count,
        COUNT(*) FILTER (WHERE resolved = false AND severity = 1) as info_count,
        COUNT(*) FILTER (WHERE resolved = false AND acknowledged = false) as unacknowledged_count,
        COUNT(*) FILTER (WHERE DATE(timestamp) = CURRENT_DATE) as today_count,
        COUNT(*) as total_count
      FROM alarms
      ${whereClause}
    `;
    
    const result = await pgPool.query(query, params);
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error fetching alarm stats:', err);
    res.status(500).json({ error: 'Failed to fetch alarm statistics' });
  }
});

// Delete alarm (admin only)
router.delete('/:id', async (req, res) => {
  try {
    const result = await pgPool.query(
      'DELETE FROM alarms WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alarm not found' });
    }
    
    res.json({ success: true });
  } catch (err) {
    logger.error('Error deleting alarm:', err);
    res.status(500).json({ error: 'Failed to delete alarm' });
  }
});

module.exports = router;
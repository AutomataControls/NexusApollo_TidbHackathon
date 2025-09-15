const express = require('express');
const router = express.Router();
const winston = require('winston');

// Get database connections from server module
let pgPool, sensorDb;
setTimeout(() => {
  const server = require('../../server');
  pgPool = server.pgPool;
  sensorDb = server.sensorDb;
}, 0);

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Get all equipment or filter by customer
router.get('/', async (req, res) => {
  try {
    const { customer_id } = req.query;
    let query = `
      SELECT 
        e.*,
        c.name as customer_name,
        c.contact_name as customer_contact
      FROM equipment e
      LEFT JOIN customers c ON e.customer_id = c.id
    `;
    const params = [];
    
    if (customer_id) {
      query += ' WHERE e.customer_id = $1';
      params.push(customer_id);
    }
    
    query += ' ORDER BY e.created_at DESC';
    
    const result = await pgPool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching equipment:', err);
    res.status(500).json({ error: 'Failed to fetch equipment' });
  }
});

// Get single equipment by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await pgPool.query(`
      SELECT 
        e.*,
        c.name as customer_name,
        c.contact_name as customer_contact
      FROM equipment e
      LEFT JOIN customers c ON e.customer_id = c.id
      WHERE e.id = $1
    `, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error fetching equipment:', err);
    res.status(500).json({ error: 'Failed to fetch equipment' });
  }
});

// Create new equipment
router.post('/', async (req, res) => {
  try {
    const equipment = req.body;
    const query = `
      INSERT INTO equipment (
        customer_id, location_name, equipment_type, manufacturer,
        model_number, serial_number, install_date, warranty_expiry,
        refrigerant_type, refrigerant_amount, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      equipment.customer_id, equipment.location_name, equipment.equipment_type,
      equipment.manufacturer, equipment.model_number,
      equipment.serial_number && equipment.serial_number !== '' ? equipment.serial_number : null,
      equipment.install_date || null,
      equipment.warranty_expiry && equipment.warranty_expiry !== '' ? equipment.warranty_expiry : null,
      equipment.refrigerant_type, equipment.refrigerant_amount, equipment.notes
    ];

    const result = await pgPool.query(query, values);
    const newEquipment = result.rows[0];

    // Register equipment with TiDB vector service
    try {
      const fetch = require('node-fetch');
      const location = {
        lat: 37.7749 + (Math.random() - 0.5) * 0.2,
        lng: -122.4194 + (Math.random() - 0.5) * 0.2,
        address: equipment.location_name
      };

      // Register equipment in TiDB with location and initial sensor data
      await fetch(`http://localhost:8001/api/vector/equipment/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization
        },
        body: JSON.stringify({
          equipmentId: newEquipment.id,
          equipmentType: equipment.equipment_type,
          location,
          sensorData: {
            supply_air_temp: 55 + Math.random() * 10,
            return_air_temp: 75 + Math.random() * 5,
            outside_air_temp: 70 + Math.random() * 20,
            compressor_current: 20 + Math.random() * 10
          },
          testMode: false
        })
      });
      logger.info(`Equipment ${newEquipment.id} registered with TiDB vector service`);
    } catch (tidbError) {
      logger.error('Failed to register equipment with TiDB:', tidbError);
      // Continue even if TiDB registration fails
    }

    res.json(newEquipment);
  } catch (err) {
    logger.error('Error creating equipment:', err);
    res.status(500).json({ error: 'Failed to create equipment' });
  }
});

// Update equipment
router.put('/:id', async (req, res) => {
  try {
    const equipment = req.body;
    const query = `
      UPDATE equipment SET
        customer_id = $2, location_name = $3, equipment_type = $4,
        manufacturer = $5, model_number = $6, serial_number = $7,
        install_date = $8, warranty_expiry = $9,
        refrigerant_type = $10, refrigerant_amount = $11,
        notes = $12, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const values = [
      req.params.id, equipment.customer_id, equipment.location_name,
      equipment.equipment_type, equipment.manufacturer, equipment.model_number,
      equipment.serial_number && equipment.serial_number !== '' ? equipment.serial_number : null, 
      equipment.install_date || null, 
      equipment.warranty_expiry && equipment.warranty_expiry !== '' ? equipment.warranty_expiry : null,
      equipment.refrigerant_type, equipment.refrigerant_amount, equipment.notes
    ];
    
    const result = await pgPool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error updating equipment:', err);
    res.status(500).json({ error: 'Failed to update equipment' });
  }
});

// Delete equipment
router.delete('/:id', async (req, res) => {
  try {
    // Delete related sensor configs first
    await pgPool.query('DELETE FROM sensor_configs WHERE equipment_id = $1', [req.params.id]);
    
    // Delete equipment
    const result = await pgPool.query(
      'DELETE FROM equipment WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }
    
    res.json({ success: true });
  } catch (err) {
    logger.error('Error deleting equipment:', err);
    res.status(500).json({ error: 'Failed to delete equipment' });
  }
});

// Get equipment health status
router.get('/:id/health', async (req, res) => {
  try {
    // Get recent sensor readings from SQLite
    
    const readings = await new Promise((resolve, reject) => {
      sensorDb.all(
        `SELECT * FROM sensor_readings 
         WHERE equipment_id = ? 
         ORDER BY timestamp DESC 
         LIMIT 100`,
        [req.params.id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    
    // Calculate health metrics
    const health = {
      status: 'healthy',
      lastReading: readings[0]?.timestamp,
      faultCount: 0,
      efficiency: 0,
      power: 0
    };
    
    if (readings.length > 0) {
      const latest = readings[0];
      const faults = JSON.parse(latest.fault_predictions || '[]');
      health.faultCount = faults.length;
      health.efficiency = latest.efficiency_prediction;
      health.power = latest.power_prediction;
      
      // Determine overall status
      if (faults.some(f => f.severity >= 3)) {
        health.status = 'critical';
      } else if (faults.length > 0) {
        health.status = 'warning';
      }
    }
    
    res.json(health);
  } catch (err) {
    logger.error('Error fetching equipment health:', err);
    res.status(500).json({ error: 'Failed to fetch equipment health' });
  }
});

module.exports = router;
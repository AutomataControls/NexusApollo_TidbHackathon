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

// Hardware manager and demo data generator
const hardwareManager = require('../../hardware/hardwareManager');
const demoDataGenerator = require('../../services/demoDataGenerator');

// Get sensor configurations for equipment
router.get('/config', async (req, res) => {
  try {
    const { equipment_id } = req.query;
    if (!equipment_id) {
      return res.status(400).json({ error: 'equipment_id required' });
    }
    
    const query = `
      SELECT * FROM sensor_configs 
      WHERE equipment_id = $1 
      ORDER BY sensor_name
    `;
    
    const result = await pgPool.query(query, [equipment_id]);
    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching sensor configs:', err);
    res.status(500).json({ error: 'Failed to fetch sensor configs' });
  }
});

// Create new sensor configuration
router.post('/config', async (req, res) => {
  try {
    const config = req.body;
    const query = `
      INSERT INTO sensor_configs (
        equipment_id, sensor_name, sensor_type, sensor_model,
        board_type, board_address, channel, input_range,
        units, calibration_offset, calibration_scale,
        scale_min, scale_max, alarm_low, alarm_high,
        enabled, port
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;
    
    const values = [
      config.equipment_id, config.sensor_name, config.sensor_type, config.sensor_model,
      config.board_type, config.board_address, config.channel, config.input_range,
      config.units, config.calibration_offset || 0, config.calibration_scale || 1,
      config.scale_min, config.scale_max, config.alarm_low, config.alarm_high,
      config.enabled !== false, config.port
    ];
    
    const result = await pgPool.query(query, values);
    
    // Load the new configuration into hardware manager
    await hardwareManager.loadSensorConfig(config.equipment_id, [result.rows[0]]);
    
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error creating sensor config:', err);
    res.status(500).json({ error: 'Failed to create sensor config' });
  }
});

// Update sensor configuration
router.put('/config', async (req, res) => {
  try {
    const config = req.body;
    const query = `
      UPDATE sensor_configs SET
        sensor_name = $2, sensor_type = $3, sensor_model = $4,
        board_type = $5, board_address = $6, channel = $7, input_range = $8,
        units = $9, calibration_offset = $10, calibration_scale = $11,
        scale_min = $12, scale_max = $13, alarm_low = $14, alarm_high = $15,
        enabled = $16, port = $17, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const values = [
      config.id, config.sensor_name, config.sensor_type, config.sensor_model,
      config.board_type, config.board_address, config.channel, config.input_range,
      config.units, config.calibration_offset || 0, config.calibration_scale || 1,
      config.scale_min, config.scale_max, config.alarm_low, config.alarm_high,
      config.enabled !== false, config.port
    ];
    
    const result = await pgPool.query(query, values);
    
    // Reload all sensor configs for this equipment
    const configsResult = await pgPool.query(
      'SELECT * FROM sensor_configs WHERE equipment_id = $1',
      [result.rows[0].equipment_id]
    );
    await hardwareManager.loadSensorConfig(result.rows[0].equipment_id, configsResult.rows);
    
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error updating sensor config:', err);
    res.status(500).json({ error: 'Failed to update sensor config' });
  }
});

// Delete sensor configuration
router.delete('/config/:id', async (req, res) => {
  try {
    // Get equipment_id before deleting
    const configResult = await pgPool.query(
      'SELECT equipment_id FROM sensor_configs WHERE id = $1',
      [req.params.id]
    );
    
    if (configResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sensor config not found' });
    }
    
    const equipmentId = configResult.rows[0].equipment_id;
    
    // Delete the config
    await pgPool.query('DELETE FROM sensor_configs WHERE id = $1', [req.params.id]);
    
    // Reload remaining configs
    const remainingConfigs = await pgPool.query(
      'SELECT * FROM sensor_configs WHERE equipment_id = $1',
      [equipmentId]
    );
    await hardwareManager.loadSensorConfig(equipmentId, remainingConfigs.rows);
    
    res.json({ success: true });
  } catch (err) {
    logger.error('Error deleting sensor config:', err);
    res.status(500).json({ error: 'Failed to delete sensor config' });
  }
});

// Scan for available hardware devices
router.get('/scan', async (req, res) => {
  try {
    const devices = await hardwareManager.scanDevices();
    res.json(devices);
  } catch (err) {
    logger.error('Error scanning devices:', err);
    res.status(500).json({ error: 'Failed to scan devices' });
  }
});

// Test a sensor configuration
router.post('/test', async (req, res) => {
  try {
    const config = req.body;
    const result = await hardwareManager.testSensor(config);
    res.json(result);
  } catch (err) {
    logger.error('Error testing sensor:', err);
    res.status(500).json({ error: 'Failed to test sensor' });
  }
});

// Get real-time sensor readings
router.get('/readings/:equipmentId', async (req, res) => {
  try {
    // Check if demo mode is enabled (passed as query parameter)
    const isDemoMode = req.query.demo === 'true';

    if (isDemoMode) {
      // Get equipment details for demo data generation
      const equipmentQuery = await pgPool.query(
        'SELECT * FROM equipment WHERE id = $1',
        [req.params.equipmentId]
      );

      const equipment = equipmentQuery.rows[0];
      const equipmentType = equipment?.equipment_type || 'RTU';

      // Generate demo sensor data
      const demoData = demoDataGenerator.generateEquipmentData(
        req.params.equipmentId,
        equipmentType
      );

      // Format to match expected sensor reading structure
      const readings = Object.entries(demoData.readings).map(([type, reading]) => ({
        sensor_name: type.replace(/_/g, ' ').toUpperCase(),
        sensor_type: type,
        value: reading.value,
        unit: reading.unit,
        status: reading.status,
        timestamp: reading.timestamp,
        anomaly_detected: reading.anomaly_detected,
        anomaly_severity: reading.anomaly_severity
      }));

      res.json(readings);
    } else {
      // Read real sensor data from hardware
      const readings = await hardwareManager.readAllSensors(req.params.equipmentId);
      res.json(readings);
    }
  } catch (err) {
    logger.error('Error reading sensors:', err);
    // Return empty array if no config found
    if (err.message && err.message.includes('No sensor configuration')) {
      res.json([]);
    } else {
      res.status(500).json({ error: 'Failed to read sensors' });
    }
  }
});

// Get power metrics for equipment (MFM384 3-phase power meter)
router.get('/power-metrics/:equipmentId', async (req, res) => {
  try {
    // Check if demo mode
    const isDemoMode = req.query.demo === 'true' || req.user?.username === 'Demo';

    if (isDemoMode) {
      // Generate demo power metrics for 460V 3-phase system
      const metrics = {
        voltage_l1n: 266 + (Math.random() - 0.5) * 4,
        voltage_l2n: 265 + (Math.random() - 0.5) * 4,
        voltage_l3n: 267 + (Math.random() - 0.5) * 4,
        voltage_l12: 460 + (Math.random() - 0.5) * 6,
        voltage_l23: 458 + (Math.random() - 0.5) * 6,
        voltage_l31: 461 + (Math.random() - 0.5) * 6,
        current_l1: 45 + (Math.random() - 0.5) * 8,
        current_l2: 43 + (Math.random() - 0.5) * 8,
        current_l3: 44 + (Math.random() - 0.5) * 8,
        power: 28.5 + (Math.random() - 0.5) * 5,
        power_factor: 0.88 + (Math.random() - 0.5) * 0.05,
        frequency: 60 + (Math.random() - 0.5) * 0.2,
        energy: 1247.3 + Math.random() * 10
      };
      res.json(metrics);
    } else {
      // Try to read from MFM384 power meter
      const powerMetrics = await hardwareManager.readPowerMetrics(req.params.equipmentId);
      if (powerMetrics) {
        res.json(powerMetrics);
      } else {
        res.status(404).json({ error: 'No power meter configured for this equipment' });
      }
    }
  } catch (err) {
    logger.error('Error reading power metrics:', err);
    res.status(500).json({ error: 'Failed to read power metrics' });
  }
});

module.exports = router;
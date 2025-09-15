const express = require('express');
const router = express.Router();
const path = require('path');
const winston = require('winston');

// Get database connections from server module
let sensorDb, pgPool;
setTimeout(() => {
  const server = require('../../server');
  sensorDb = server.sensorDb;
  pgPool = server.pgPool;
}, 0);

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Get energy consumption data
router.get('/consumption', async (req, res) => {
  try {
    const { 
      equipment_id, 
      start_date, 
      end_date,
      interval = 'hour' // hour, day, week, month
    } = req.query;

    if (!equipment_id) {
      return res.status(400).json({ error: 'equipment_id required' });
    }

    const startTimestamp = start_date ? new Date(start_date).getTime() / 1000 : Date.now() / 1000 - 86400 * 30;
    const endTimestamp = end_date ? new Date(end_date).getTime() / 1000 : Date.now() / 1000;

    // Determine grouping based on interval
    let groupBy;
    switch (interval) {
      case 'hour':
        groupBy = 3600;
        break;
      case 'day':
        groupBy = 86400;
        break;
      case 'week':
        groupBy = 604800;
        break;
      case 'month':
        groupBy = 2592000;
        break;
      default:
        groupBy = 3600;
    }

    const query = `
      SELECT 
        CAST(timestamp / ${groupBy} AS INTEGER) * ${groupBy} as period,
        AVG(power_prediction) as avg_power,
        MAX(power_prediction) as peak_power,
        MIN(power_prediction) as min_power,
        COUNT(*) as reading_count
      FROM sensor_readings
      WHERE equipment_id = ?
        AND timestamp >= ?
        AND timestamp <= ?
      GROUP BY period
      ORDER BY period ASC
    `;

    sensorDb.all(query, [equipment_id, startTimestamp, endTimestamp], (err, rows) => {
      if (err) {
        logger.error('Error fetching consumption data:', err);
        return res.status(500).json({ error: 'Failed to fetch consumption data' });
      }

      // Calculate energy (kWh) from power readings
      const data = rows.map(row => ({
        timestamp: new Date(row.period * 1000).toISOString(),
        consumption: row.avg_power * (groupBy / 3600), // Convert to kWh
        avgPower: row.avg_power,
        peakPower: row.peak_power,
        minPower: row.min_power
      }));

      res.json(data);
    });
  } catch (err) {
    logger.error('Error in consumption endpoint:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Get energy cost analysis
router.get('/costs', async (req, res) => {
  try {
    const { equipment_id, start_date, end_date } = req.query;

    if (!equipment_id) {
      return res.status(400).json({ error: 'equipment_id required' });
    }

    // Get utility rates from settings
    const settingsResult = await pgPool.query(
      'SELECT * FROM system_settings WHERE key = $1',
      ['energy_rates']
    );

    const rates = settingsResult.rows[0]?.value || {
      kwhRate: 0.15,
      demandRate: 25.00,
      peakHours: { start: 14, end: 20 },
      peakRate: 0.25
    };

    const startTimestamp = start_date ? new Date(start_date).getTime() / 1000 : Date.now() / 1000 - 86400 * 30;
    const endTimestamp = end_date ? new Date(end_date).getTime() / 1000 : Date.now() / 1000;

    // Get daily consumption and peak demand
    const query = `
      SELECT 
        DATE(timestamp, 'unixepoch') as date,
        SUM(power_prediction) / COUNT(*) * 24 as daily_kwh,
        MAX(power_prediction) as peak_demand,
        COUNT(*) FILTER (WHERE CAST(strftime('%H', timestamp, 'unixepoch') AS INTEGER) 
          BETWEEN ${rates.peakHours.start} AND ${rates.peakHours.end}) as peak_hours_count,
        COUNT(*) as total_count
      FROM sensor_readings
      WHERE equipment_id = ?
        AND timestamp >= ?
        AND timestamp <= ?
      GROUP BY date
      ORDER BY date ASC
    `;

    sensorDb.all(query, [equipment_id, startTimestamp, endTimestamp], (err, rows) => {
      if (err) {
        logger.error('Error fetching cost data:', err);
        return res.status(500).json({ error: 'Failed to fetch cost data' });
      }

      // Calculate costs
      const data = rows.map(row => {
        const peakKwh = row.daily_kwh * (row.peak_hours_count / row.total_count);
        const offPeakKwh = row.daily_kwh - peakKwh;
        
        const energyCost = (peakKwh * rates.peakRate) + (offPeakKwh * rates.kwhRate);
        const demandCost = row.peak_demand * rates.demandRate / 30; // Daily portion
        
        return {
          date: row.date,
          consumption: row.daily_kwh,
          peakDemand: row.peak_demand,
          energyCost: energyCost,
          demandCost: demandCost,
          totalCost: energyCost + demandCost
        };
      });

      // Calculate summary
      const summary = {
        totalConsumption: data.reduce((sum, d) => sum + d.consumption, 0),
        totalCost: data.reduce((sum, d) => sum + d.totalCost, 0),
        avgDailyCost: data.length > 0 ? data.reduce((sum, d) => sum + d.totalCost, 0) / data.length : 0,
        peakDemand: Math.max(...data.map(d => d.peakDemand)),
        data: data
      };

      res.json(summary);
    });
  } catch (err) {
    logger.error('Error in costs endpoint:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Get real-time power data
router.get('/realtime/:equipmentId', async (req, res) => {
  try {
    const { equipmentId } = req.params;
    
    // Get latest sensor readings
    const query = `
      SELECT 
        timestamp,
        sensor_values,
        power_prediction
      FROM sensor_readings
      WHERE equipment_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `;

    sensorDb.get(query, [equipmentId], (err, row) => {
      if (err) {
        logger.error('Error fetching realtime data:', err);
        return res.status(500).json({ error: 'Failed to fetch realtime data' });
      }

      if (!row) {
        return res.json({
          currentPower: 0,
          voltage: { L1: 0, L2: 0, L3: 0 },
          current: { L1: 0, L2: 0, L3: 0 },
          powerFactor: 0,
          frequency: 60,
          timestamp: new Date().toISOString()
        });
      }

      // Parse sensor values
      const sensorValues = JSON.parse(row.sensor_values || '[]');
      const powerData = {
        currentPower: row.power_prediction || 0,
        voltage: { L1: 0, L2: 0, L3: 0 },
        current: { L1: 0, L2: 0, L3: 0 },
        powerFactor: 0.85,
        frequency: 60,
        timestamp: new Date(row.timestamp * 1000).toISOString()
      };

      // Extract electrical values from sensors
      sensorValues.forEach(sensor => {
        if (sensor.name.includes('VOLTAGE_L1')) powerData.voltage.L1 = sensor.value;
        if (sensor.name.includes('VOLTAGE_L2')) powerData.voltage.L2 = sensor.value;
        if (sensor.name.includes('VOLTAGE_L3')) powerData.voltage.L3 = sensor.value;
        if (sensor.name.includes('CURRENT_L1')) powerData.current.L1 = sensor.value;
        if (sensor.name.includes('CURRENT_L2')) powerData.current.L2 = sensor.value;
        if (sensor.name.includes('CURRENT_L3')) powerData.current.L3 = sensor.value;
        if (sensor.name.includes('POWER_FACTOR')) powerData.powerFactor = sensor.value;
        if (sensor.name.includes('FREQUENCY')) powerData.frequency = sensor.value;
      });

      res.json(powerData);
    });
  } catch (err) {
    logger.error('Error in realtime endpoint:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Update utility rates
router.put('/rates', async (req, res) => {
  try {
    const rates = req.body;
    
    await pgPool.query(`
      INSERT INTO system_settings (key, value)
      VALUES ('energy_rates', $1)
      ON CONFLICT (key) DO UPDATE
      SET value = $1, updated_at = CURRENT_TIMESTAMP
    `, [JSON.stringify(rates)]);
    
    res.json({ success: true, rates });
  } catch (err) {
    logger.error('Error updating rates:', err);
    res.status(500).json({ error: 'Failed to update rates' });
  }
});

// Get utility rates
router.get('/rates', async (req, res) => {
  try {
    const result = await pgPool.query(
      'SELECT value FROM system_settings WHERE key = $1',
      ['energy_rates']
    );
    
    const rates = result.rows[0]?.value || {
      kwhRate: 0.15,
      demandRate: 25.00,
      peakHours: { start: 14, end: 20 },
      peakRate: 0.25,
      utilityProvider: 'Default Utility',
      billingCycle: 'monthly'
    };
    
    res.json(rates);
  } catch (err) {
    logger.error('Error fetching rates:', err);
    res.status(500).json({ error: 'Failed to fetch rates' });
  }
});

// Get energy efficiency metrics
router.get('/efficiency/:equipmentId', async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const { days = 30 } = req.query;
    
    const startTimestamp = Date.now() / 1000 - (days * 86400);
    
    const query = `
      SELECT 
        DATE(timestamp, 'unixepoch') as date,
        AVG(efficiency_prediction) as avg_efficiency,
        MIN(efficiency_prediction) as min_efficiency,
        MAX(efficiency_prediction) as max_efficiency
      FROM sensor_readings
      WHERE equipment_id = ?
        AND timestamp >= ?
      GROUP BY date
      ORDER BY date ASC
    `;
    
    sensorDb.all(query, [equipmentId, startTimestamp], (err, rows) => {
      if (err) {
        logger.error('Error fetching efficiency data:', err);
        return res.status(500).json({ error: 'Failed to fetch efficiency data' });
      }
      
      res.json({
        current: rows[rows.length - 1]?.avg_efficiency || 0,
        average: rows.reduce((sum, r) => sum + r.avg_efficiency, 0) / rows.length || 0,
        trend: rows
      });
    });
  } catch (err) {
    logger.error('Error in efficiency endpoint:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

module.exports = router;
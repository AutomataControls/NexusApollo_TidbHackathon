const express = require('express');
const router = express.Router();
const path = require('path');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Get database connections from server module
let sensorDb, pgPool;
setTimeout(() => {
  const server = require('../../server');
  sensorDb = server.sensorDb;
  pgPool = server.pgPool;
}, 0);

// Hardware and AI inference managers
const hardwareManager = require('../../hardware/hardwareManager');
// const apolloInference = require('../../ai/apolloInference'); // Not implemented yet
const apolloInference = { 
  predict: async () => ({ faults: [], efficiency: 85 }) 
};

// Run diagnostics for equipment
router.post('/run/:equipmentId', async (req, res) => {
  try {
    const { equipmentId } = req.params;
    
    // Get current sensor readings
    const sensorData = await hardwareManager.readAllSensors(equipmentId);
    
    // Run Apollo AI inference
    const predictions = await apolloInference.predict(sensorData);
    
    // Calculate health score based on predictions
    const healthScore = calculateHealthScore(predictions);
    
    // Generate recommendations
    const recommendations = generateRecommendations(predictions, sensorData);
    
    // Store diagnostic results
    await storeDiagnosticResult(equipmentId, predictions, healthScore);
    
    const result = {
      timestamp: new Date().toISOString(),
      equipment_id: parseInt(equipmentId),
      faults: predictions.faults || [],
      efficiency: predictions.efficiency || 85,
      health_score: healthScore,
      recommendations: recommendations,
      sensor_readings: formatSensorReadings(sensorData)
    };
    
    // Emit to WebSocket clients
    const io = req.app.get('io');
    if (io) {
      io.emit('diagnostics-result', result);
    }
    
    res.json(result);
  } catch (err) {
    logger.error('Error running diagnostics:', err);
    res.status(500).json({ error: 'Failed to run diagnostics' });
  }
});

// Get diagnostic history
router.get('/history/:equipmentId', async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const { days = 30 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const query = `
      SELECT * FROM diagnostic_results
      WHERE equipment_id = $1
        AND created_at >= $2
      ORDER BY created_at DESC
    `;
    
    const result = await pgPool.query(query, [equipmentId, startDate]);
    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching diagnostic history:', err);
    res.status(500).json({ error: 'Failed to fetch diagnostic history' });
  }
});

// Get fault statistics
router.get('/faults/stats/:equipmentId', async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const { days = 30 } = req.query;
    
    const startTimestamp = Date.now() / 1000 - (days * 86400);
    
    const query = `
      SELECT 
        fault_predictions,
        COUNT(*) as occurrence_count
      FROM sensor_readings
      WHERE equipment_id = ?
        AND timestamp >= ?
        AND fault_predictions IS NOT NULL
        AND fault_predictions != '[]'
      GROUP BY fault_predictions
    `;
    
    sensorDb.all(query, [equipmentId, startTimestamp], (err, rows) => {
      if (err) {
        logger.error('Error fetching fault stats:', err);
        return res.status(500).json({ error: 'Failed to fetch fault statistics' });
      }
      
      // Parse and aggregate fault types
      const faultCounts = {};
      rows.forEach(row => {
        try {
          const faults = JSON.parse(row.fault_predictions);
          faults.forEach(fault => {
            faultCounts[fault.type] = (faultCounts[fault.type] || 0) + row.occurrence_count;
          });
        } catch (e) {
          // Skip invalid JSON
        }
      });
      
      res.json({
        faultCounts,
        totalOccurrences: Object.values(faultCounts).reduce((sum, count) => sum + count, 0),
        uniqueFaultTypes: Object.keys(faultCounts).length
      });
    });
  } catch (err) {
    logger.error('Error in fault stats endpoint:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Get efficiency trends
router.get('/efficiency/:equipmentId', async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const { interval = 'day', days = 30 } = req.query;
    
    const startTimestamp = Date.now() / 1000 - (days * 86400);
    let groupBy;
    
    switch (interval) {
      case 'hour':
        groupBy = 'strftime("%Y-%m-%d %H:00", timestamp, "unixepoch")';
        break;
      case 'day':
        groupBy = 'DATE(timestamp, "unixepoch")';
        break;
      case 'week':
        groupBy = 'strftime("%Y-W%W", timestamp, "unixepoch")';
        break;
      default:
        groupBy = 'DATE(timestamp, "unixepoch")';
    }
    
    const query = `
      SELECT 
        ${groupBy} as period,
        AVG(efficiency_prediction) as avg_efficiency,
        MIN(efficiency_prediction) as min_efficiency,
        MAX(efficiency_prediction) as max_efficiency,
        COUNT(*) as reading_count
      FROM sensor_readings
      WHERE equipment_id = ?
        AND timestamp >= ?
        AND efficiency_prediction IS NOT NULL
      GROUP BY period
      ORDER BY period ASC
    `;
    
    sensorDb.all(query, [equipmentId, startTimestamp], (err, rows) => {
      if (err) {
        logger.error('Error fetching efficiency trends:', err);
        return res.status(500).json({ error: 'Failed to fetch efficiency trends' });
      }
      
      res.json(rows);
    });
  } catch (err) {
    logger.error('Error in efficiency trends endpoint:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Get recommended maintenance actions
router.get('/maintenance/:equipmentId', async (req, res) => {
  try {
    const { equipmentId } = req.params;
    
    // Get equipment details
    const equipmentResult = await pgPool.query(
      'SELECT * FROM equipment WHERE id = $1',
      [equipmentId]
    );
    
    if (equipmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }
    
    const equipment = equipmentResult.rows[0];
    
    // Get recent diagnostic results
    const diagnosticResult = await pgPool.query(`
      SELECT * FROM diagnostic_results
      WHERE equipment_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [equipmentId]);
    
    // Generate maintenance recommendations based on:
    // 1. Fault history
    // 2. Equipment age
    // 3. Last maintenance date
    // 4. Efficiency trends
    
    const recommendations = [];
    const installDate = new Date(equipment.install_date);
    const ageInYears = (Date.now() - installDate.getTime()) / (365 * 24 * 60 * 60 * 1000);
    
    // Age-based maintenance
    if (ageInYears > 10) {
      recommendations.push({
        priority: 'high',
        type: 'major_overhaul',
        description: 'Equipment is over 10 years old. Consider major overhaul or replacement.',
        estimatedCost: 5000
      });
    } else if (ageInYears > 5) {
      recommendations.push({
        priority: 'medium',
        type: 'comprehensive_service',
        description: 'Equipment is over 5 years old. Schedule comprehensive service.',
        estimatedCost: 1500
      });
    }
    
    // Fault-based maintenance
    const recentFaults = diagnosticResult.rows.flatMap(r => r.fault_predictions || []);
    const faultTypes = [...new Set(recentFaults.map(f => f.type))];
    
    if (faultTypes.includes('compressor_failure')) {
      recommendations.push({
        priority: 'critical',
        type: 'compressor_service',
        description: 'Compressor issues detected. Immediate service required.',
        estimatedCost: 2500
      });
    }
    
    if (faultTypes.includes('refrigerant_leak')) {
      recommendations.push({
        priority: 'high',
        type: 'leak_repair',
        description: 'Refrigerant leak detected. Schedule leak detection and repair.',
        estimatedCost: 800
      });
    }
    
    res.json({
      equipment: equipment,
      recommendations: recommendations,
      nextScheduledMaintenance: calculateNextMaintenance(equipment),
      maintenanceHistory: [] // Would fetch from maintenance_logs table
    });
  } catch (err) {
    logger.error('Error fetching maintenance recommendations:', err);
    res.status(500).json({ error: 'Failed to fetch maintenance recommendations' });
  }
});

// Get hardware status
router.get('/hardware', async (req, res) => {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Check for MegaIND board
    const { stdout: boardList } = await execAsync('megaind -list');
    const boardDetected = boardList.includes('1 board(s) detected');
    
    let boardInfo = null;
    if (boardDetected) {
      const { stdout: info } = await execAsync('megaind 0 board');
      // Parse board info
      const match = info.match(/Firmware ver ([\d.]+), CPU temperature (\d+) C, Power source ([\d.]+) V, Raspberry ([\d.]+) V/);
      if (match) {
        boardInfo = {
          firmware: match[1],
          temperature: parseInt(match[2]),
          powerSource: parseFloat(match[3]),
          raspberryVoltage: parseFloat(match[4])
        };
      }
      
      // Read some analog inputs
      const channels = {};
      for (let i = 1; i <= 4; i++) {
        const { stdout: voltage } = await execAsync(`megaind 0 uinrd ${i}`);
        const { stdout: current } = await execAsync(`megaind 0 iinrd ${i}`);
        channels[`channel_${i}`] = {
          voltage: parseFloat(voltage),
          current: parseFloat(current)
        };
      }
      boardInfo.channels = channels;
    }
    
    res.json({
      success: true,
      hardware: {
        megaind: {
          detected: boardDetected,
          info: boardInfo
        }
      }
    });
  } catch (error) {
    logger.error('Hardware check error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Helper functions
function calculateHealthScore(predictions) {
  let score = 100;
  
  // Deduct points based on faults
  if (predictions.faults) {
    predictions.faults.forEach(fault => {
      score -= fault.severity * 10 * fault.confidence;
    });
  }
  
  // Factor in efficiency
  if (predictions.efficiency) {
    const efficiencyFactor = predictions.efficiency / 100;
    score = score * efficiencyFactor;
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

function generateRecommendations(predictions, sensorData) {
  const recommendations = [];
  
  if (predictions.faults) {
    predictions.faults.forEach(fault => {
      switch (fault.type) {
        case 'low_refrigerant':
          recommendations.push('Schedule refrigerant leak detection and recharge');
          break;
        case 'compressor_failure':
          recommendations.push('Immediate compressor inspection required');
          recommendations.push('Check electrical connections and motor windings');
          break;
        case 'filter_clogged':
          recommendations.push('Replace air filters immediately');
          recommendations.push('Implement monthly filter inspection schedule');
          break;
        case 'efficiency_degradation':
          recommendations.push('Perform comprehensive system cleaning');
          recommendations.push('Check and calibrate all sensors');
          break;
      }
    });
  }
  
  // Add efficiency-based recommendations
  if (predictions.efficiency < 80) {
    recommendations.push('System efficiency below target - schedule tune-up');
  }
  
  return [...new Set(recommendations)]; // Remove duplicates
}

function formatSensorReadings(sensorData) {
  return sensorData.map(sensor => ({
    name: sensor.name,
    value: sensor.value,
    unit: sensor.unit,
    status: determineSensorStatus(sensor)
  }));
}

function determineSensorStatus(sensor) {
  // Determine if sensor reading is normal, warning, or critical
  if (sensor.alarm_high && sensor.value > sensor.alarm_high) {
    return 'critical';
  }
  if (sensor.alarm_low && sensor.value < sensor.alarm_low) {
    return 'critical';
  }
  
  // Add more sophisticated logic based on sensor type
  return 'normal';
}

async function storeDiagnosticResult(equipmentId, predictions, healthScore) {
  try {
    await pgPool.query(`
      INSERT INTO diagnostic_results (
        equipment_id, fault_predictions, efficiency_score, 
        health_score, created_at
      ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    `, [
      equipmentId,
      JSON.stringify(predictions.faults || []),
      predictions.efficiency || 0,
      healthScore
    ]);
  } catch (err) {
    logger.error('Error storing diagnostic result:', err);
  }
}

function calculateNextMaintenance(equipment) {
  const lastMaintenance = equipment.last_maintenance_date || equipment.install_date;
  const nextDate = new Date(lastMaintenance);
  nextDate.setMonth(nextDate.getMonth() + 3); // Quarterly maintenance
  return nextDate.toISOString();
}

module.exports = router;
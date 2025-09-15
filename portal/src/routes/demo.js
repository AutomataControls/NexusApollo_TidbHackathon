const express = require('express');
const router = express.Router();
const demoDataGenerator = require('../../services/demoDataGenerator');
const demoSeeder = require('../../services/demoSeeder');

// Get demo system metrics
router.get('/metrics', (req, res) => {
  const metrics = demoDataGenerator.generateSystemMetrics();
  res.json(metrics);
});

// Get demo equipment data
router.get('/equipment/:equipmentId', async (req, res) => {
  const { equipmentId } = req.params;
  const { type = 'RTU' } = req.query;

  const data = await demoDataGenerator.generateEquipmentData(equipmentId, type);
  res.json(data);
});

// Get demo historical data
router.get('/historical/:equipmentId', (req, res) => {
  const { equipmentId } = req.params;
  const { type = 'RTU', hours = 24, interval = 5 } = req.query;
  
  const data = demoDataGenerator.generateHistoricalData(
    equipmentId, 
    type, 
    parseInt(hours), 
    parseInt(interval)
  );
  res.json(data);
});

// Get demo alarms
router.get('/alarms', (req, res) => {
  const alarms = [];
  const count = Math.floor(Math.random() * 5) + 2;
  
  for (let i = 0; i < count; i++) {
    const severity = Math.random() > 0.7 ? 'critical' : Math.random() > 0.4 ? 'warning' : 'info';
    alarms.push(demoDataGenerator.generateAlarm(
      { id: i + 1, location_name: `Equipment ${i + 1}` },
      severity
    ));
  }
  
  res.json(alarms);
});

// Get demo sensor reading for specific sensor
router.get('/sensor/:sensorType', async (req, res) => {
  const { sensorType } = req.params;
  const { equipmentType = 'RTU' } = req.query;

  const reading = await demoDataGenerator.generateSensorReading(sensorType, equipmentType);
  res.json(reading);
});

// Batch demo data for multiple equipment
router.post('/batch', async (req, res) => {
  const { equipment } = req.body;

  if (!equipment || !Array.isArray(equipment)) {
    return res.status(400).json({ error: 'Equipment array required' });
  }

  const data = await demoDataGenerator.generateBatchData(equipment);
  res.json(data);
});

// Start continuous demo data seeding to TiDB
router.post('/seeder/start', async (req, res) => {
  const { interval = 10000 } = req.body; // Default 10 seconds
  await demoSeeder.start(interval);
  res.json({
    success: true,
    message: `Demo seeder started, pushing to TiDB every ${interval/1000} seconds`
  });
});

// Stop demo data seeding
router.post('/seeder/stop', (req, res) => {
  demoSeeder.stop();
  res.json({ success: true, message: 'Demo seeder stopped' });
});

// Get seeder status
router.get('/seeder/status', (req, res) => {
  res.json({
    running: demoSeeder.isRunning,
    equipmentCount: demoSeeder.equipmentList.length
  });
});

// Seed historical data burst for impressive demos
router.post('/seeder/burst', async (req, res) => {
  const { hours = 24, dataPoints = 100 } = req.body;

  try {
    await demoSeeder.seedHistoricalBurst(hours, dataPoints);
    res.json({
      success: true,
      message: `Generated ${dataPoints} historical data points over ${hours} hours`
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate historical burst',
      message: error.message
    });
  }
});

module.exports = router;
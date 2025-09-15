#!/usr/bin/env node
/**
 * Apollo Nexus™ Portal Server
 * Advanced HVAC Fault Detection & Energy Optimization Platform
 * Copyright © 2024 AutomataNexus, LLC. All rights reserved.
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs').promises;
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const winston = require('winston');
const ModbusRTU = require('modbus-serial');
const ModelService = require('./services/modelService');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://192.168.0.77:3000', 'http://192.168.0.77:3001', 'https://apollo-anc-3c7a20.automatacontrols.com'],
    credentials: true
  }
});

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(__dirname, '..', 'logs', 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(__dirname, '..', 'logs', 'combined.log') }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// PostgreSQL connection for customer/equipment data
const pgPool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'apollo_nexus',
  user: process.env.POSTGRES_USER || 'apollo',
  password: process.env.POSTGRES_PASS,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// SQLite connection for sensor data
const sensorDb = new sqlite3.Database(
  path.join(__dirname, 'data', 'sensor_data.db'),
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => {
    if (err) {
      logger.error('Failed to open sensor database:', err);
    } else {
      logger.info('Connected to sensor database');
      initializeSensorDb();
    }
  }
);

// Initialize sensor database tables
async function initializeSensorDb() {
  const schema = await fs.readFile(
    path.join(__dirname, '..', 'database', 'schema.sql'),
    'utf8'
  ).catch(() => "");
  
  // Extract SQLite portion
  const sqliteSchema = schema.split('-- sensor_data.sql (SQLite)')[1];
  
  // Execute schema line by line, ignoring index exists errors
  const statements = sqliteSchema ? sqliteSchema.split(';').filter(s => s.trim()) : [];
  
  statements.forEach(statement => {
    if (statement.trim()) {
      sensorDb.run(statement + ';', (err) => {
        if (err && !err.message.includes('already exists')) {
          logger.error('Failed to execute statement:', err);
        }
      });
    }
  });
  
  logger.info('Sensor database initialized');
  
  // Create outdoor conditions table for AI calculations
  sensorDb.run(`
        CREATE TABLE IF NOT EXISTS outdoor_conditions (
          id INTEGER PRIMARY KEY,
          temperature REAL,
          humidity REAL,
          pressure REAL,
          location TEXT,
          zip_code TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
  `, (err) => {
    if (err) {
      logger.error('Failed to create outdoor_conditions table:', err);
    } else {
      logger.info('Outdoor conditions table ready');
    }
  });
  
  // Create model inferences table
  sensorDb.run(`
        CREATE TABLE IF NOT EXISTS model_inferences (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          equipment_id INTEGER,
          model_output TEXT,
          inference_time_ms REAL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
  `, (err) => {
    if (err) {
      logger.error('Failed to create model_inferences table:', err);
    } else {
      logger.info('Model inferences table ready');
    }
  });
}

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // We'll configure this separately for the React app
}));
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://192.168.0.77:3000', 'http://192.168.0.77:3001', 'https://apollo-anc-3c7a20.automatacontrols.com'],
  credentials: true
}));
app.use(express.json({ limit: process.env.MAX_UPLOAD_SIZE || '100mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.MAX_UPLOAD_SIZE || '100mb' }));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build')));
}

// Hardware interfaces
const hardwareManager = require('./hardware/hardwareManager');
// const apolloInference = require('./src/ai/apolloInference'); // Not implemented yet
const apolloInference = { 
  isLoaded: () => false, 
  loadModel: async () => {}, 
  predict: async () => ({ faults: [], efficiency: 0 }) 
};

// WebSocket connection tracking
const connections = new Map();

// Health check endpoint
app.get('/api/health', async (req, res) => {
  // Check TiDB connection status
  const tidbService = require('./services/tidbVectorService');
  let tidbConnected = false;

  try {
    // Check if TiDB is connected
    if (tidbService.connection) {
      // Try a simple ping query
      await tidbService.connection.execute('SELECT 1');
      tidbConnected = true;
    }
  } catch (error) {
    // TiDB not connected or error
    tidbConnected = false;
  }

  res.json({
    status: 'online',
    services: {
      hardware: hardwareManager.isInitialized() ? 'ready' : 'offline',
      apollo: apolloInference.isLoaded() ? 'loaded' : 'offline',
      tidb: tidbConnected ? 'connected' : 'disconnected'
    },
    monitoring: !!monitoringInterval,
    timestamp: new Date().toISOString()
  });
});

// Import Demo restrictions middleware
const { restrictDemoUser, isDemoUser } = require('./src/middleware/demoRestrictions');

// API Routes
app.use('/api/auth', require('./src/routes/auth'));

// Apply Demo restrictions to protected routes
app.use('/api/customers', restrictDemoUser, require('./src/routes/customers'));
app.use('/api/equipment', restrictDemoUser, require('./src/routes/equipment'));
app.use('/api/sensors', restrictDemoUser, require('./src/routes/sensors'));
app.use('/api/energy', restrictDemoUser, require('./src/routes/energy'));
app.use('/api/vector', isDemoUser, require('./src/routes/vectorSearch')); // Allow read, but middleware will check for writes
app.use('/api/diagnostics', restrictDemoUser, require('./src/routes/diagnostics'));
app.use('/api/alarms', restrictDemoUser, require('./src/routes/alarms'));
app.use('/api/reports', restrictDemoUser, require('./src/routes/reports'));
app.use('/api/settings', restrictDemoUser, require('./src/routes/settings'));
app.use('/api/users', restrictDemoUser, require('./src/routes/users'));
app.use('/api/ai-models', restrictDemoUser, require('./src/routes/ai-models'));
app.use('/api/database', restrictDemoUser, require('./src/routes/database'));
app.use('/api/demo', isDemoUser, require('./src/routes/demo'));


// Real-time sensor monitoring
let monitoringInterval = null;
let currentEquipmentId = null;

function startMonitoring(equipmentId) {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }
  
  currentEquipmentId = equipmentId;
  
  monitoringInterval = setInterval(async () => {
    try {
      // Read sensors from hardware
      const sensorData = await hardwareManager.readAllSensors(equipmentId);
      
      // Calculate power metrics
      const powerMetrics = calculatePowerMetrics(sensorData);
      
      // Run Apollo inference
      const predictions = await apolloInference.predict(sensorData);
      
      // Store in database
      storeSensorReading(equipmentId, sensorData, powerMetrics, predictions);
      
      // Emit to connected clients
      io.emit('sensor-update', {
        equipmentId,
        timestamp: new Date().toISOString(),
        sensors: sensorData,
        power: powerMetrics,
        predictions
      });
      
      // Check for alarms
      checkAlarms(sensorData, powerMetrics, predictions);
      
    } catch (error) {
      logger.error('Monitoring error:', error);
    }
  }, parseInt(process.env.SENSOR_POLL_INTERVAL) || 1000);
}

function calculatePowerMetrics(sensorData) {
  const metrics = {
    totalKw: 0,
    voltage: { L1: 0, L2: 0, L3: 0 },
    current: { L1: 0, L2: 0, L3: 0 },
    powerFactor: 0,
    thd: 0,
    kva: 0,
    kvar: 0
  };
  
  // Extract electrical sensors
  sensorData.forEach(sensor => {
    if (sensor.type === 'voltage') {
      if (sensor.name.includes('L1')) metrics.voltage.L1 = sensor.value;
      if (sensor.name.includes('L2')) metrics.voltage.L2 = sensor.value;
      if (sensor.name.includes('L3')) metrics.voltage.L3 = sensor.value;
    } else if (sensor.type === 'current') {
      if (sensor.name.includes('L1')) metrics.current.L1 = sensor.value;
      if (sensor.name.includes('L2')) metrics.current.L2 = sensor.value;
      if (sensor.name.includes('L3')) metrics.current.L3 = sensor.value;
    } else if (sensor.name === 'POWER_FACTOR') {
      metrics.powerFactor = sensor.value;
    } else if (sensor.name === 'THD') {
      metrics.thd = sensor.value;
    }
  });
  
  // Calculate 3-phase power (kW)
  const sqrtThree = Math.sqrt(3);
  const avgVoltage = (metrics.voltage.L1 + metrics.voltage.L2 + metrics.voltage.L3) / 3;
  const avgCurrent = (metrics.current.L1 + metrics.current.L2 + metrics.current.L3) / 3;
  
  metrics.kva = (sqrtThree * avgVoltage * avgCurrent) / 1000;
  metrics.totalKw = metrics.kva * (metrics.powerFactor || 0.85);
  metrics.kvar = Math.sqrt(Math.pow(metrics.kva, 2) - Math.pow(metrics.totalKw, 2));
  
  return metrics;
}

function storeSensorReading(equipmentId, sensorData, powerMetrics, predictions) {
  const timestamp = Date.now() / 1000; // Unix timestamp with milliseconds
  
  const stmt = sensorDb.prepare(`
    INSERT INTO sensor_readings 
    (equipment_id, timestamp, sensor_values, fault_predictions, efficiency_prediction, power_prediction)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    equipmentId,
    timestamp,
    JSON.stringify(sensorData),
    JSON.stringify(predictions.faults),
    predictions.efficiency,
    powerMetrics.totalKw,
    (err) => {
      if (err) {
        logger.error('Failed to store sensor reading:', err);
      }
    }
  );
  
  stmt.finalize();
  
  // Also update aggregated trends every minute
  const currentMinute = Math.floor(timestamp / 60) * 60;
  updateTrends(equipmentId, currentMinute, sensorData, powerMetrics, predictions);
}

function updateTrends(equipmentId, timestamp, sensorData, powerMetrics, predictions) {
  // This would aggregate data for the trend charts
  const stmt = sensorDb.prepare(`
    INSERT OR REPLACE INTO sensor_trends
    (equipment_id, timestamp, sensor_averages, fault_counts, efficiency_avg, power_avg)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  // Calculate averages (simplified - in production this would aggregate properly)
  const sensorAverages = {};
  sensorData.forEach(sensor => {
    sensorAverages[sensor.name] = sensor.value;
  });
  
  const faultCounts = {};
  predictions.faults.forEach(fault => {
    faultCounts[fault.type] = (faultCounts[fault.type] || 0) + 1;
  });
  
  stmt.run(
    equipmentId,
    timestamp,
    JSON.stringify(sensorAverages),
    JSON.stringify(faultCounts),
    predictions.efficiency,
    powerMetrics.totalKw
  );
  
  stmt.finalize();
}

function checkAlarms(sensorData, powerMetrics, predictions) {
  // Check sensor limits
  sensorData.forEach(sensor => {
    if (sensor.alarm_high && sensor.value > sensor.alarm_high) {
      triggerAlarm('sensor_high', sensor.name, `${sensor.value} ${sensor.units}`, 2);
    } else if (sensor.alarm_low && sensor.value < sensor.alarm_low) {
      triggerAlarm('sensor_low', sensor.name, `${sensor.value} ${sensor.units}`, 2);
    }
  });
  
  // Check fault predictions
  predictions.faults.forEach(fault => {
    if (fault.confidence > 0.8) {
      triggerAlarm('fault_detected', fault.type, `Confidence: ${(fault.confidence * 100).toFixed(1)}%`, fault.severity);
    }
  });
  
  // Check power anomalies
  if (powerMetrics.powerFactor < 0.85) {
    triggerAlarm('low_power_factor', 'Power Factor', powerMetrics.powerFactor.toFixed(2), 1);
  }
  
  if (powerMetrics.thd > 5) {
    triggerAlarm('high_thd', 'Harmonic Distortion', `${powerMetrics.thd.toFixed(1)}%`, 2);
  }
}

function triggerAlarm(type, source, value, severity) {
  const alarm = {
    id: Date.now(),
    type,
    source,
    value,
    severity,
    timestamp: new Date().toISOString(),
    equipmentId: currentEquipmentId
  };
  
  // Emit alarm to all connected clients
  io.emit('alarm', alarm);
  
  // Store in database
  pgPool.query(
    `INSERT INTO fault_history 
     (equipment_id, fault_type, severity, detected_at, auto_detected, notes)
     VALUES ($1, $2, $3, NOW(), true, $4)`,
    [currentEquipmentId, type, severity, `${source}: ${value}`]
  );
  
  // Send email alerts if enabled
  if (process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true') {
    sendAlarmEmail(alarm);
  }
}

async function sendAlarmEmail(alarm) {
  // This would integrate with Resend API
  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'noreply@automatacontrols.com',
      to: await getAlarmRecipients(alarm.severity),
      subject: `Apollo Nexus Alert: ${alarm.type}`,
      html: `
        <h2>Apollo Nexus Alert</h2>
        <p><strong>Type:</strong> ${alarm.type}</p>
        <p><strong>Source:</strong> ${alarm.source}</p>
        <p><strong>Value:</strong> ${alarm.value}</p>
        <p><strong>Severity:</strong> Level ${alarm.severity}</p>
        <p><strong>Time:</strong> ${alarm.timestamp}</p>
        <p><strong>Equipment ID:</strong> ${alarm.equipmentId}</p>
      `
    });
  } catch (error) {
    logger.error('Failed to send alarm email:', error);
  }
}

async function getAlarmRecipients(severity) {
  const result = await pgPool.query(
    'SELECT email FROM alarm_recipients WHERE severity_threshold <= $1',
    [severity]
  );
  return result.rows.map(row => row.email);
}

// WebSocket handlers
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  connections.set(socket.id, { socket, authenticated: false });
  
  socket.on('authenticate', async (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      connections.get(socket.id).authenticated = true;
      connections.get(socket.id).userId = decoded.userId;
      socket.emit('authenticated', { success: true });
    } catch (error) {
      socket.emit('authenticated', { success: false, error: 'Invalid token' });
    }
  });
  
  socket.on('start-monitoring', (equipmentId) => {
    if (!connections.get(socket.id)?.authenticated) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }
    
    logger.info(`Starting monitoring for equipment ${equipmentId}`);
    startMonitoring(equipmentId);
    socket.emit('monitoring-started', { equipmentId });
  });
  
  socket.on('stop-monitoring', () => {
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      monitoringInterval = null;
      currentEquipmentId = null;
      socket.emit('monitoring-stopped');
    }
  });
  
  socket.on('read-sensors', async (equipmentId) => {
    try {
      const sensorData = await hardwareManager.readAllSensors(equipmentId);
      const powerMetrics = calculatePowerMetrics(sensorData);
      socket.emit('sensor-data', { sensorData, powerMetrics });
    } catch (error) {
      socket.emit('error', { message: 'Failed to read sensors', error: error.message });
    }
  });
  
  socket.on('run-diagnostics', async (equipmentId) => {
    try {
      const sensorData = await hardwareManager.readAllSensors(equipmentId);
      const predictions = await apolloInference.predict(sensorData);
      socket.emit('diagnostics-result', predictions);
    } catch (error) {
      socket.emit('error', { message: 'Diagnostics failed', error: error.message });
    }
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
    connections.delete(socket.id);
  });
});

// Export for other modules
module.exports = {
  pgPool,
  sensorDb,
  app,
  server,
  io
};

// MFM384 Power Meter Class
class MFM384PowerMeter {
  constructor() {
    this.client = new ModbusRTU();
    this.connected = false;
  }

  async connect(port = '/dev/ttyUSB0', baudRate = 9600, slaveId = 1) {
    try {
      await this.client.connectRTUBuffered(port, { baudRate });
      this.client.setID(slaveId);
      this.connected = true;
      logger.info(`MFM384 connected on ${port} at ${baudRate} baud, slave ID ${slaveId}`);
      return true;
    } catch (error) {
      logger.error('MFM384 connection failed:', error);
      this.connected = false;
      return false;
    }
  }

  async readFloat32(address) {
    try {
      const result = await this.client.readInputRegisters(address, 2);
      // Convert from Big Endian (ABCD format) as per MFM384 documentation
      const buffer = Buffer.allocUnsafe(4);
      buffer.writeUInt16BE(result.data[0], 0);
      buffer.writeUInt16BE(result.data[1], 2);
      return buffer.readFloatBE(0);
    } catch (error) {
      logger.error(`Failed to read MFM384 register ${address}:`, error);
      throw error;
    }
  }

  async readPowerMetrics() {
    if (!this.connected) {
      throw new Error('MFM384 not connected');
    }

    try {
      // Read all power metrics from MFM384 registers
      const [
        v12, v23, v31,    // Line-to-Line voltages (0x08, 0x0A, 0x0C)
        i1, i2, i3,       // Phase currents (0x10, 0x12, 0x14)
        totalKW,          // Total active power (0x2A)
        totalKVA,         // Total apparent power (0x2C) 
        totalKVAr,        // Total reactive power (0x2E)
        avgPF,            // Average power factor (0x36)
        frequency         // Frequency (0x38)
      ] = await Promise.all([
        this.readFloat32(0x08), // V12
        this.readFloat32(0x0A), // V23
        this.readFloat32(0x0C), // V31
        this.readFloat32(0x10), // I1
        this.readFloat32(0x12), // I2
        this.readFloat32(0x14), // I3
        this.readFloat32(0x2A), // Total kW
        this.readFloat32(0x2C), // Total kVA
        this.readFloat32(0x2E), // Total kVAr
        this.readFloat32(0x36), // Avg PF
        this.readFloat32(0x38)  // Frequency
      ]);

      return {
        voltages: { v12, v23, v31 },
        currents: { i1, i2, i3 },
        power: {
          totalKW,
          totalKVA, 
          totalKVAr,
          powerFactor: avgPF
        },
        frequency,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to read MFM384 power metrics:', error);
      throw error;
    }
  }

  disconnect() {
    if (this.connected) {
      this.client.close(() => {
        this.connected = false;
        logger.info('MFM384 disconnected');
      });
    }
  }
}

// Initialize MFM384 instance
const mfm384 = new MFM384PowerMeter();

// Initialize AI Model Service
let modelService = null;

// Power Metrics API endpoint
app.get('/api/power/metrics/:equipmentId', async (req, res) => {
  try {
    const { equipmentId } = req.params;

    // Get MFM384 configuration for this equipment
    const configResult = await pgPool.query(`
      SELECT * FROM sensor_configs 
      WHERE equipment_id = $1 AND board_type = 'mfm384' 
      LIMIT 1
    `, [equipmentId]);

    if (configResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'No MFM384 power meter configured for this equipment' 
      });
    }

    const config = configResult.rows[0];

    // Connect to MFM384 if not already connected
    if (!mfm384.connected) {
      const connected = await mfm384.connect(
        config.port || '/dev/ttyUSB0',
        9600, // Standard baud rate
        config.board_address || 1
      );
      
      if (!connected) {
        return res.status(500).json({ error: 'Failed to connect to MFM384' });
      }
    }

    // Read power metrics from MFM384
    const powerMetrics = await mfm384.readPowerMetrics();

    // Also get separate CT sensor readings for comparison
    const ctReadings = await pgPool.query(`
      SELECT sr.*, sc.sensor_name, sc.units
      FROM sensor_configs sc
      LEFT JOIN sensor_readings sr ON sr.sensor_config_id = sc.id
      WHERE sc.equipment_id = $1 
      AND sc.sensor_type = 'current' 
      AND sc.board_type != 'mfm384'
      AND sr.timestamp > NOW() - INTERVAL '1 minute'
      ORDER BY sr.timestamp DESC
      LIMIT 3
    `, [equipmentId]);

    const ctCurrents = {
      l1: ctReadings.rows.find(r => r.sensor_name.includes('L1') || r.sensor_name.includes('1'))?.value || null,
      l2: ctReadings.rows.find(r => r.sensor_name.includes('L2') || r.sensor_name.includes('2'))?.value || null,
      l3: ctReadings.rows.find(r => r.sensor_name.includes('L3') || r.sensor_name.includes('3'))?.value || null
    };

    res.json({
      mfm384: powerMetrics,
      separateCTs: ctCurrents,
      equipmentId: parseInt(equipmentId)
    });

  } catch (error) {
    logger.error('Power metrics API error:', error);
    res.status(500).json({ 
      error: 'Failed to read power metrics',
      message: error.message 
    });
  }
});

// Store outdoor temperature for AI calculations
app.post('/api/weather/outdoor-temp', async (req, res) => {
  try {
    const { temperature, humidity, pressure, location, zipCode } = req.body;
    
    // Store in SQLite sensor database for quick access
    await new Promise((resolve, reject) => {
      sensorDb.run(`
        INSERT OR REPLACE INTO outdoor_conditions 
        (id, temperature, humidity, pressure, location, zip_code, timestamp)
        VALUES (1, ?, ?, ?, ?, ?, datetime('now'))
      `, [temperature, humidity, pressure, location, zipCode], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Emit to connected monitoring systems
    io.emit('outdoor-conditions-update', {
      temperature,
      humidity, 
      pressure,
      location,
      zipCode,
      timestamp: new Date().toISOString()
    });
    
    logger.info(`Outdoor conditions updated: ${temperature}°F, ${humidity}% RH at ${location}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to update outdoor conditions:', error);
    res.status(500).json({ error: 'Failed to update outdoor conditions' });
  }
});

// Get current outdoor conditions for AI models
app.get('/api/weather/outdoor-temp', async (req, res) => {
  try {
    const conditions = await new Promise((resolve, reject) => {
      sensorDb.get(
        'SELECT * FROM outdoor_conditions WHERE id = 1',
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    res.json(conditions || { temperature: null, humidity: null });
  } catch (error) {
    logger.error('Failed to get outdoor conditions:', error);
    res.status(500).json({ error: 'Failed to get outdoor conditions' });
  }
});

// Run 8-Model Diagnostic Analysis
app.post('/api/diagnostics/run/:equipmentId', async (req, res) => {
  try {
    const { equipmentId } = req.params;
    
    if (!modelService || !modelService.isLoaded()) {
      return res.status(503).json({ 
        error: 'AI models not ready',
        loaded: modelService ? modelService.models : null 
      });
    }
    
    // Get current sensor readings
    const sensorReadings = await new Promise((resolve, reject) => {
      sensorDb.all(
        `SELECT sc.sensor_name, sr.value, sc.units, sc.sensor_type
         FROM sensor_configs sc
         LEFT JOIN sensor_readings sr ON sr.sensor_config_id = sc.id
         WHERE sc.equipment_id = ? AND sr.timestamp > datetime('now', '-1 minute')
         ORDER BY sr.timestamp DESC`,
        [equipmentId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
    
    // Format sensor data for models
    const sensorData = {};
    sensorReadings.forEach(reading => {
      sensorData[reading.sensor_name] = reading.value;
    });
    
    // Run full 8-model diagnosis
    const diagnosis = await modelService.runFullDiagnosis(sensorData);
    
    // Store results in database
    await new Promise((resolve, reject) => {
      sensorDb.run(
        `INSERT INTO model_inferences (equipment_id, model_output, inference_time_ms, timestamp)
         VALUES (?, ?, ?, datetime('now'))`,
        [equipmentId, JSON.stringify(diagnosis), diagnosis.inferenceTimeMs],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    // Emit results via WebSocket
    io.emit('diagnosis-complete', {
      equipmentId: parseInt(equipmentId),
      diagnosis,
      timestamp: new Date().toISOString()
    });
    
    res.json(diagnosis);
    
  } catch (error) {
    logger.error('Diagnostics error:', error);
    res.status(500).json({ 
      error: 'Failed to run diagnostics',
      message: error.message 
    });
  }
});

// Get AI model status
app.get('/api/models/status', (req, res) => {
  if (!modelService) {
    return res.status(503).json({ error: 'Model service not initialized' });
  }
  
  res.json({
    loaded: modelService.isLoaded(),
    models: modelService.models,
    timestamp: new Date().toISOString()
  });
});

// Hailo NPU API endpoints
app.get('/api/hailo/status', async (req, res) => {
  try {
    // Use Python script to get actual device status
    const pythonScript = path.join(__dirname, 'hailo_inference.py');
    
    try {
      const { stdout, stderr } = await execAsync(`python3 "${pythonScript}" status`);
      
      if (stderr && !stderr.includes('Warning')) {
        logger.warn('Python script stderr:', stderr);
      }
      
      let status;
      try {
        status = JSON.parse(stdout);
      } catch (parseError) {
        throw new Error('Invalid JSON from Python script');
      }
      
      res.json({
        ...status,
        timestamp: new Date().toISOString()
      });
    } catch (scriptError) {
      // Fallback to hailortcli if Python script fails
      try {
        const { stdout: scanOut } = await execAsync('hailortcli scan');
        const hasDevice = scanOut.includes('Device:');
        
        if (hasDevice) {
          // Get detailed device info
          const { stdout: infoOut } = await execAsync('hailortcli fw-control identify');
          
          // Parse device info
          let deviceName = 'Hailo-8';
          let temperature = null;
          let serialNumber = null;
          
          const nameMatch = infoOut.match(/Board Name:\s*(.+)/);
          if (nameMatch) {
            deviceName = nameMatch[1].trim();
          }
          
          const serialMatch = infoOut.match(/Serial Number:\s*(.+)/);
          if (serialMatch) {
            serialNumber = serialMatch[1].trim();
          }
          
          // Try to get temperature (may not be available on all devices)
          try {
            const { stdout: tempOut } = await execAsync('hailortcli measure-power --measure-time 1');
            const tempMatch = tempOut.match(/average temperature:\s*([\d.]+)/i);
            if (tempMatch) {
              temperature = parseFloat(tempMatch[1]);
            }
          } catch (e) {
            // Temperature not available
            temperature = null;
          }
          
          res.json({
            online: true,
            device: deviceName,
            temperature,
            power: 5, // Typical Hailo-8 power consumption
            utilization: 0, // Will need actual measurement
            serialNumber,
            timestamp: new Date().toISOString()
          });
        } else {
          res.json({
            online: false,
            error: 'Hailo device not detected',
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        res.json({
          online: false,
          error: 'Hailo device not detected',
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    logger.error('Hailo status error:', error);
    res.status(500).json({ error: 'Failed to get Hailo status' });
  }
});

app.get('/api/hailo/models', async (req, res) => {
  try {
    // Use Python script to get actual model status
    const pythonScript = path.join(__dirname, 'hailo_inference.py');
    
    try {
      const { stdout, stderr } = await execAsync(`python3 "${pythonScript}" models`);
      
      if (stderr && !stderr.includes('Warning')) {
        logger.warn('Python script stderr:', stderr);
      }
      
      let models;
      try {
        models = JSON.parse(stdout);
      } catch (parseError) {
        throw new Error('Invalid JSON from Python script');
      }
      
      res.json(models);
    } catch (scriptError) {
      // Fallback to modelService if Python script fails
      const fs = require('fs');
      const models = {};
      const modelNames = ['apollo', 'aquilo', 'boreas', 'naiad', 'vulcan', 'zephyrus', 'colossus', 'gaia'];
      
      modelNames.forEach(name => {
        const modelPath = `/home/Automata/mydata/apollo-nexus/models/${name}_simple.hef`;
        let size = null;
        let loaded = false;
        
        // Try to get file size
        try {
          const stats = fs.statSync(modelPath);
          size = (stats.size / (1024 * 1024)).toFixed(2); // Size in MB
          loaded = modelService?.models?.[name]?.loaded || false;
        } catch (e) {
          // File doesn't exist or can't be accessed
        }
        
        models[name] = {
          loaded: loaded,
          path: modelPath,
          size: size,
          version: 'v1.0'
        };
      });
      
      res.json(models);
    }
  } catch (error) {
    logger.error('Hailo models error:', error);
    res.status(500).json({ error: 'Failed to get model status' });
  }
});

app.get('/api/hailo/stats', async (req, res) => {
  try {
    // Get inference statistics from database
    const stats = await new Promise((resolve, reject) => {
      sensorDb.all(
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN date(timestamp) = date('now') THEN 1 END) as today,
          AVG(inference_time_ms) as avgTime,
          MAX(timestamp) as lastRun
         FROM model_inferences`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows[0] || {});
        }
      );
    });
    
    res.json({
      total: stats.total || 0,
      today: stats.today || 0,
      avgTime: Math.round(stats.avgTime || 0),
      lastRun: stats.lastRun || null
    });
  } catch (error) {
    logger.error('Failed to get inference stats:', error);
    res.json({
      total: 0,
      today: 0,
      avgTime: 0,
      lastRun: null
    });
  }
});

app.post('/api/hailo/diagnose', async (req, res) => {
  try {
    const { equipmentId, mode = 'simultaneous' } = req.body;
    
    if (!equipmentId) {
      return res.status(400).json({ error: 'Equipment ID required' });
    }
    
    // Get current sensor readings
    let sensorData = {};
    
    try {
      const sensorReadings = await hardwareManager.readAllSensors(equipmentId);
      sensorReadings.forEach(reading => {
        if (reading.value !== null && !reading.error) {
          // Convert sensor names to format expected by Python script
          const pythonName = reading.name.toLowerCase().replace(/ /g, '_');
          sensorData[pythonName] = reading.value;
        }
      });
    } catch (sensorError) {
      // If no sensors configured, use current readings from other sources
      logger.info(`No sensors for equipment ${equipmentId}, using default readings`);
      
      // Try to get latest readings from database
      const latestReadings = await new Promise((resolve, reject) => {
        sensorDb.all(
          `SELECT sensor_name, value FROM sensor_readings 
           WHERE equipment_id = ? 
           AND timestamp > datetime('now', '-5 minutes')
           GROUP BY sensor_name 
           ORDER BY timestamp DESC`,
          [equipmentId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });
      
      if (latestReadings.length > 0) {
        latestReadings.forEach(row => {
          const pythonName = row.sensor_name.toLowerCase().replace(/ /g, '_');
          sensorData[pythonName] = row.value;
        });
      } else {
        // Use reasonable default values for HVAC system
        sensorData = {
          supply_air_temp: 55.0,
          return_air_temp: 75.0,
          outside_air_temp: 85.0,
          mixed_air_temp: 65.0,
          supply_air_pressure: 1.5,
          return_air_pressure: 1.2,
          filter_pressure_drop: 0.3,
          supply_air_flow: 1000.0,
          return_air_flow: 950.0,
          compressor_current: 15.0,
          fan_motor_current: 5.0,
          power_consumption: 3500.0,
          supply_air_humidity: 45.0,
          return_air_humidity: 50.0,
          setpoint_temp: 72.0,
          damper_position: 50.0,
          valve_position: 30.0,
          compressor_status: 1,
          fan_status: 1
        };
      }
    }
    
    // Call Python script for actual Hailo inference with simultaneous mode
    const startTime = Date.now();
    const pythonScript = path.join(__dirname, 'hailo_inference.py');
    const sensorDataJson = JSON.stringify(sensorData);
    
    // Use selected mode (simultaneous or sequential)
    const { stdout, stderr } = await execAsync(
      `python3 "${pythonScript}" diagnose '${sensorDataJson}' ${mode}`
    );
    
    if (stderr && !stderr.includes('Warning')) {
      logger.warn('Python script stderr:', stderr);
    }
    
    let diagnosis;
    try {
      diagnosis = JSON.parse(stdout);
    } catch (parseError) {
      logger.error('Failed to parse Python output:', stdout);
      throw new Error('Invalid response from Hailo inference');
    }
    
    const inferenceTimeMs = Date.now() - startTime;
    diagnosis.inferenceTimeMs = inferenceTimeMs;
    
    // Store results in database
    await new Promise((resolve, reject) => {
      sensorDb.run(
        `INSERT INTO model_inferences (equipment_id, model_output, inference_time_ms, timestamp)
         VALUES (?, ?, ?, datetime('now'))`,
        [equipmentId, JSON.stringify(diagnosis), inferenceTimeMs],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    // Emit results via WebSocket
    io.emit('diagnosis-complete', {
      equipmentId: parseInt(equipmentId),
      diagnosis,
      timestamp: new Date().toISOString()
    });
    
    res.json(diagnosis);
    
  } catch (error) {
    logger.error('Hailo diagnose error:', error);
    res.status(500).json({ 
      error: 'Failed to run diagnosis',
      message: error.message 
    });
  }
});

// Inference control endpoints
let inferenceInterval = null;
let inferenceMode = 'simultaneous';

app.post('/api/inference/start', async (req, res) => {
  try {
    const { equipmentId, mode = 'simultaneous' } = req.body;
    
    if (!equipmentId) {
      return res.status(400).json({ error: 'Equipment ID required' });
    }
    
    // Clear any existing interval
    if (inferenceInterval) {
      clearInterval(inferenceInterval);
    }
    
    // Store the mode for the interval
    inferenceMode = mode;
    
    // Run inference every 30 seconds
    const runInference = async () => {
      try {
        // Get current sensor data
        const sensorReadings = await hardwareManager.readAllSensors(equipmentId);
        
        if (sensorReadings && sensorReadings.length > 0) {
          // Call Hailo diagnosis endpoint
          const pythonScript = path.join(__dirname, 'hailo_inference.py');
          const sensorData = {};
          
          sensorReadings.forEach(reading => {
            if (reading.value !== null && !reading.error) {
              const pythonName = reading.name.toLowerCase().replace(/ /g, '_');
              sensorData[pythonName] = reading.value;
            }
          });
          
          // Use the specified mode for real-time inference
          const { stdout } = await execAsync(
            `python3 "${pythonScript}" diagnose '${JSON.stringify(sensorData)}' ${inferenceMode}`,
            { timeout: 10000 }
          );
          
          const diagnosis = JSON.parse(stdout);
          diagnosis.equipmentId = equipmentId;
          diagnosis.timestamp = new Date().toISOString();
          
          // Emit result via WebSocket
          io.emit('inference-result', diagnosis);
          
          // Store in database
          await new Promise((resolve, reject) => {
            sensorDb.run(
              `INSERT INTO model_inferences (equipment_id, model_output, inference_time_ms, timestamp)
               VALUES (?, ?, ?, datetime('now'))`,
              [equipmentId, JSON.stringify(diagnosis), diagnosis.inferenceTimeMs || 0],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }
      } catch (error) {
        logger.error('Inference error:', error);
      }
    };
    
    // Run immediately
    runInference();
    
    // Then run every 30 seconds
    inferenceInterval = setInterval(runInference, 30000);
    
    res.json({ success: true, message: 'Inference started' });
  } catch (error) {
    logger.error('Failed to start inference:', error);
    res.status(500).json({ error: 'Failed to start inference' });
  }
});

app.post('/api/inference/stop', async (req, res) => {
  try {
    if (inferenceInterval) {
      clearInterval(inferenceInterval);
      inferenceInterval = null;
    }
    
    res.json({ success: true, message: 'Inference stopped' });
  } catch (error) {
    logger.error('Failed to stop inference:', error);
    res.status(500).json({ error: 'Failed to stop inference' });
  }
});

// Get inference status
app.get('/api/inference/status', (req, res) => {
  res.json({
    running: !!inferenceInterval,
    mode: inferenceMode,
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    services: {
      database: pgPool ? 'connected' : 'disconnected',
      sensorDb: sensorDb ? 'connected' : 'disconnected',
      mfm384: mfm384.connected ? 'connected' : 'disconnected',
      aiModels: modelService?.isLoaded() ? 'ready' : 'not ready'
    }
  });
});

// Serve React app for all other routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Real-time sensor monitoring (variable already declared above)
const SENSOR_POLL_INTERVAL = parseInt(process.env.SENSOR_POLL_INTERVAL) || 5000; // 5 seconds default

async function startSensorMonitoring() {
  logger.info(`Starting real-time sensor monitoring (${SENSOR_POLL_INTERVAL}ms interval)`);
  
  // Load all equipment with sensor configurations
  const equipmentResult = await pgPool.query(`
    SELECT DISTINCT e.id, e.location_name, e.customer_id
    FROM equipment e
    INNER JOIN sensor_configs sc ON sc.equipment_id = e.id
    WHERE sc.enabled = true
  `);
  
  const equipment = equipmentResult.rows;
  logger.info(`Monitoring sensors for ${equipment.length} equipment units`);
  
  // Load sensor configurations for each equipment
  for (const eq of equipment) {
    const configResult = await pgPool.query(`
      SELECT * FROM sensor_configs 
      WHERE equipment_id = $1 AND enabled = true
    `, [eq.id]);
    
    if (configResult.rows.length > 0) {
      await hardwareManager.loadSensorConfig(eq.id, configResult.rows);
    }
  }
  
  // Start polling interval
  monitoringInterval = setInterval(async () => {
    for (const eq of equipment) {
      try {
        // Read all sensors for this equipment
        const readings = await hardwareManager.readAllSensors(eq.id);
        
        // Store readings in database - using the actual schema structure
        if (readings.length > 0) {
          const timestamp = Date.now() / 1000; // Unix timestamp
          const sensorValues = {};
          
          // Build sensor values JSON object
          for (const reading of readings) {
            if (reading.value !== null && !reading.error) {
              sensorValues[reading.name] = reading.value;
            }
          }
          
          // Store in SQLite sensor_readings table if we have valid data
          if (Object.keys(sensorValues).length > 0) {
            sensorDb.run(`
              INSERT INTO sensor_readings (
                equipment_id, timestamp, sensor_values, fault_predictions, efficiency_prediction, power_prediction
              ) VALUES (?, ?, ?, ?, ?, ?)
            `, [eq.id, timestamp, JSON.stringify(sensorValues), null, null, null]);
          }
          
          // Check for alarms for each reading
          for (const reading of readings) {
            if (reading.value !== null && !reading.error) {
              if (reading.alarm_low !== null && reading.value < reading.alarm_low) {
                io.emit('sensor-alarm', {
                  equipment_id: eq.id,
                  sensor_name: reading.name,
                  value: reading.value,
                  alarm_type: 'low',
                  threshold: reading.alarm_low
                });
              }
              
              if (reading.alarm_high !== null && reading.value > reading.alarm_high) {
                io.emit('sensor-alarm', {
                  equipment_id: eq.id,
                  sensor_name: reading.name,
                  value: reading.value,
                  alarm_type: 'high',
                  threshold: reading.alarm_high
                });
              }
            }
          }
        }
        
        // Emit sensor update via WebSocket
        io.emit('sensor-update', {
          equipment_id: eq.id,
          equipment_name: eq.name,
          customer_id: eq.customer_id,
          readings: readings,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        logger.error(`Error reading sensors for equipment ${eq.id}:`, error);
        io.emit('sensor-error', {
          equipment_id: eq.id,
          error: error.message
        });
      }
    }
  }, SENSOR_POLL_INTERVAL);
  
  // Also emit sensor updates when clients specifically request
  io.on('connection', (socket) => {
    socket.on('request-sensor-update', async (equipmentId) => {
      try {
        const readings = await hardwareManager.readAllSensors(equipmentId);
        socket.emit('sensor-update', {
          equipment_id: equipmentId,
          readings: readings,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        socket.emit('sensor-error', {
          equipment_id: equipmentId,
          error: error.message
        });
      }
    });
  });
}

// Initialize hardware and AI
async function initialize() {
  try {
    logger.info('Initializing Apollo Nexus...');
    
    // Initialize hardware interfaces
    await hardwareManager.initialize();
    logger.info('Hardware interfaces initialized');
    
    // Initialize AI Model Service with 8-model system
    modelService = new ModelService(logger, sensorDb);
    logger.info('Apollo Nexus 8-Model System initialized');
    
    // Test database connections
    await pgPool.query('SELECT 1');
    logger.info('PostgreSQL connected');
    
    // Start server
    const PORT = process.env.PORT || 8001;
    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`Apollo Nexus server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`Tunnel domain: ${process.env.TUNNEL_DOMAIN}`);
      
      // Start real-time sensor monitoring
      startSensorMonitoring();
    });
    
  } catch (error) {
    logger.error('Failed to initialize:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }
  
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  await pgPool.end();
  sensorDb.close();
  
  process.exit(0);
});

// Export for use in other modules
module.exports = { sensorDb, pgPool };

// Start the application
initialize();
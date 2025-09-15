/**
 * Hardware Manager for Apollo Nexus
 * Manages all hardware interfaces including:
 * - Sequent Microsystems boards
 * - SELEC MFM384 power meters
 * - WitMotion vibration sensors
 * - Various 0-10V sensors (QVM62.1, PX3DLX02, etc)
 */

const winston = require('winston');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Hardware drivers
const SelecMFM384 = require('./selecMFM384');
const SequentBoards = require('./sequentBoards');
const WitMotionSensor = require('./witMotionSensor');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

class HardwareManager {
  constructor() {
    this.initialized = false;
    this.devices = {
      powerMeters: new Map(),
      sequentBoards: new Map(),
      vibrationSensors: new Map()
    };
    this.sensorConfigs = new Map(); // equipmentId -> sensor configs
    
    // Drivers for specific board types
    this.selecMFM384 = SelecMFM384;
    this.sequentBoards = SequentBoards;
    this.witMotion = WitMotionSensor;
    
    // RS485 ports from environment
    this.rs485Ports = [
      process.env.RS485_PORT_1,
      process.env.RS485_PORT_2, 
      process.env.RS485_PORT_3,
      process.env.RS485_PORT_4
    ].filter(Boolean);
  }
  
  async initialize() {
    logger.info('Initializing hardware manager...');
    
    try {
      // Scan for USB devices
      await this.scanUSBDevices();
      
      // Initialize Sequent boards
      await this.initializeSequentBoards();
      
      // Initialize Hailo if available
      await this.checkHailo();
      
      this.initialized = true;
      logger.info('Hardware manager initialized successfully');
      
    } catch (error) {
      logger.error('Hardware initialization failed:', error);
      throw error;
    }
  }
  
  async scanUSBDevices() {
    try {
      // List USB serial devices
      const { stdout } = await execAsync('ls -la /dev/ttyUSB* /dev/ttyACM* 2>/dev/null || true');
      const devices = stdout.split('\n').filter(line => line.includes('tty'));
      
      logger.info(`Found ${devices.length} USB serial devices`);
      
      // Log configured RS485 ports
      logger.info(`Configured RS485 ports: ${this.rs485Ports.join(', ')}`);
      
      // Try to identify devices
      for (const device of devices) {
        const port = device.split(' ').pop();
        if (port && port.startsWith('/dev/')) {
          await this.identifyDevice(port);
        }
      }
    } catch (error) {
      logger.error('Error scanning USB devices:', error);
    }
  }
  
  async identifyDevice(port) {
    // Check device info using udevadm
    try {
      const { stdout } = await execAsync(`udevadm info -q property -n ${port}`);
      
      // Parse device properties
      const props = {};
      stdout.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          props[key] = value;
        }
      });
      
      logger.info(`Device ${port} info:`, {
        vendor: props.ID_VENDOR,
        product: props.ID_MODEL,
        serial: props.ID_SERIAL_SHORT
      });
      
      // Auto-detect known devices
      // You can add vendor/product ID matching here
      
    } catch (error) {
      logger.debug(`Could not get info for ${port}`);
    }
  }
  
  async initializeSequentBoards() {
    try {
      const boards = await SequentBoards.scanAll();
      
      for (const board of boards) {
        this.devices.sequentBoards.set(board.address, board);
        logger.info(`Found Sequent board: ${board.type} at address 0x${board.address.toString(16)}`);
      }
    } catch (error) {
      logger.error('Error initializing Sequent boards:', error);
    }
  }
  
  async checkHailo() {
    try {
      const { stdout } = await execAsync('ls /dev/hailo* 2>/dev/null || true');
      if (stdout.trim()) {
        logger.info('Hailo device detected:', stdout.trim());
        this.hailoDevice = stdout.trim();
      }
    } catch (error) {
      logger.debug('No Hailo device found');
    }
  }
  
  // Add a SELEC MFM384 power meter
  async addPowerMeter(config) {
    const { id, port, slaveId, name } = config;
    
    try {
      const meter = new SelecMFM384(port, slaveId);
      await meter.connect();
      
      this.devices.powerMeters.set(id, {
        id,
        name,
        type: 'MFM384',
        instance: meter,
        port,
        slaveId
      });
      
      logger.info(`Added power meter: ${name} on ${port} (Slave ${slaveId})`);
      return true;
      
    } catch (error) {
      logger.error(`Failed to add power meter ${name}:`, error);
      throw error;
    }
  }
  
  // Add a WitMotion vibration sensor
  async addVibrationSensor(config) {
    const { id, port, slaveId, name, mountLocation } = config;
    
    try {
      const sensor = new WitMotionSensor(port, slaveId);
      await sensor.connect();
      
      this.devices.vibrationSensors.set(id, {
        id,
        name,
        type: 'WT901C485',
        instance: sensor,
        port,
        slaveId,
        mountLocation
      });
      
      logger.info(`Added vibration sensor: ${name} on ${port} (Slave ${slaveId})`);
      return true;
      
    } catch (error) {
      logger.error(`Failed to add vibration sensor ${name}:`, error);
      throw error;
    }
  }
  
  // Load sensor configuration for equipment
  async loadSensorConfig(equipmentId, configs) {
    this.sensorConfigs.set(equipmentId, configs);
    
    // Initialize any configured power meters or vibration sensors
    for (const config of configs) {
      if (config.board_type === 'mfm384' && !this.devices.powerMeters.has(config.board_address)) {
        try {
          await this.addPowerMeter({
            id: config.board_address,
            port: config.port || this.rs485Ports[0] || '/dev/ttyUSB0',
            slaveId: parseInt(config.board_address),
            name: config.sensor_name
          });
        } catch (err) {
          logger.error(`Failed to add power meter ${config.sensor_name}: ${err.message}`);
          // Continue loading other sensors even if this one fails
        }
      } else if (config.board_type === 'witmotion' && !this.devices.vibrationSensors.has(config.board_address)) {
        try {
          await this.addVibrationSensor({
            id: config.board_address,
            port: config.port || this.rs485Ports[1] || '/dev/ttyUSB1',
            slaveId: parseInt(config.board_address),
            name: config.sensor_name,
            mountLocation: config.location
          });
        } catch (err) {
          logger.error(`Failed to add vibration sensor ${config.sensor_name}: ${err.message}`);
          // Continue loading other sensors even if this one fails
        }
      }
    }
  }
  
  // Read sensor value based on configuration
  async readSensor(config) {
    try {
      let rawValue;
      
      switch (config.board_type) {
        case 'mfm384':
          // MFM384 not currently connected - skip reading
          logger.warn(`MFM384 sensor ${config.sensor_name} skipped - device not connected`);
          return null;
          break;
          
        case 'megabas':
        case 'megaind':
        case '16univin':
          rawValue = await this.sequentBoards.readValue(config);
          
          // Apply 0-10V scaling for analog inputs
          if (config.input_range === '0-10V' && config.scale_min !== undefined && config.scale_max !== undefined) {
            // Convert 0-10V to actual measurement range
            const voltagePercent = rawValue / 10.0; // 0-10V to 0-1
            rawValue = config.scale_min + (voltagePercent * (config.scale_max - config.scale_min));
          }
          
          // Handle 10K thermistor readings (convert resistance to temperature)
          if ((config.input_range === '10K-2' || config.input_range === '10K-3') && 
              (config.sensor_type === 'temperature' || config.sensor_type === 'air_temp' || 
               config.sensor_type === 'water_temp' || config.sensor_type === 'refrigerant_temp')) {
            const resistance = rawValue;
            let A, B, C;
            
            if (config.input_range === '10K-2') {
              // Steinhart-Hart coefficients for 10K Type 2 thermistor
              A = 0.001125308852122;
              B = 0.000234711863267;
              C = 0.000000085663516;
            } else {
              // Steinhart-Hart coefficients for 10K Type 3 thermistor
              A = 0.001129148;
              B = 0.000234125;
              C = 0.0000000876741;
            }
            
            const kelvin = 1 / (A + B * Math.log(resistance) + C * Math.pow(Math.log(resistance), 3));
            rawValue = (kelvin - 273.15) * 9/5 + 32; // Convert to Fahrenheit
          }
          break;
          
        case 'witmotion':
          rawValue = await this.witMotion.readValue(config);
          break;
          
        default:
          throw new Error(`Unknown board type: ${config.board_type}`);
      }
      
      // Apply calibration (ensure values are numbers)
      const scale = parseFloat(config.calibration_scale) || 1;
      const offset = parseFloat(config.calibration_offset) || 0;
      const calibratedValue = (rawValue * scale) + offset;
      
      return {
        value: calibratedValue,
        unit: config.units,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error reading sensor:', error);
      throw error;
    }
  }
  
  // Scan for available devices
  async scanDevices() {
    const detectedDevices = [];
    
    // Scan for Sequent boards
    try {
      const boards = await this.sequentBoards.scanAll();
      boards.forEach(board => {
        detectedDevices.push({
          type: 'sequent',
          name: board.name,
          address: `0x${board.address.toString(16)}`,
          channels: board.channels,
          status: 'connected'
        });
      });
    } catch (error) {
      logger.error('Error scanning Sequent boards:', error);
    }
    
    // Check for RS485 devices
    try {
      const { stdout } = await execAsync('ls /dev/ttyUSB* 2>/dev/null || true');
      const usbPorts = stdout.split('\n').filter(p => p.trim());
      
      for (const port of usbPorts) {
        detectedDevices.push({
          type: 'rs485',
          name: 'RS485 Device',
          address: 'Unknown',
          port: port.trim(),
          status: 'disconnected'
        });
      }
    } catch (error) {
      logger.error('Error scanning USB devices:', error);
    }
    
    return detectedDevices;
  }
  
  // Test a sensor configuration
  async testSensor(config) {
    try {
      const reading = await this.readSensor(config);
      return {
        success: true,
        value: reading.value,
        unit: reading.unit
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Get device status
  getStatus() {
    return {
      initialized: this.initialized,
      devices: {
        powerMeters: Array.from(this.devices.powerMeters.values()).map(d => ({
          id: d.id,
          name: d.name,
          type: d.type,
          port: d.port,
          connected: d.instance.connected
        })),
        sequentBoards: Array.from(this.devices.sequentBoards.values()),
        vibrationSensors: Array.from(this.devices.vibrationSensors.values()).map(d => ({
          id: d.id,
          name: d.name,
          type: d.type,
          port: d.port,
          connected: d.instance.connected
        }))
      },
      hailo: this.hailoDevice ? 'available' : 'not found'
    };
  }
  
  isInitialized() {
    return this.initialized;
  }
  
  // Read all sensors for a given equipment
  async readAllSensors(equipmentId) {
    const configs = this.sensorConfigs.get(equipmentId);
    if (!configs) {
      throw new Error(`No sensor configuration found for equipment ${equipmentId}`);
    }
    
    const readings = [];
    
    for (const config of configs) {
      try {
        const reading = await this.readSensor(config);
        readings.push({
          id: config.id,
          name: config.sensor_name,
          type: config.sensor_type,
          value: reading.value,
          unit: reading.unit,
          timestamp: reading.timestamp,
          alarm_low: config.alarm_low,
          alarm_high: config.alarm_high
        });
      } catch (error) {
        logger.error(`Failed to read sensor ${config.sensor_name}:`, error);
        // Add error reading
        readings.push({
          id: config.id,
          name: config.sensor_name,
          type: config.sensor_type,
          value: null,
          unit: config.units,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return readings;
  }

  // Auto-detect hardware devices
  async detectDevices() {
    logger.info('Starting hardware device auto-detection...');
    const detectedDevices = [];
    
    // 1. Detect I2C devices (Sequent boards)
    try {
      const { stdout } = await execAsync('i2cdetect -y 1 2>/dev/null || true');
      if (stdout) {
        const i2cAddresses = this.parseI2CDetect(stdout);
        
        for (const address of i2cAddresses) {
          const boardType = this.identifySequentBoard(address);
          if (boardType) {
            detectedDevices.push({
              type: 'i2c',
              boardType,
              address,
              stack: 0,
              status: 'detected'
            });
            logger.info(`Detected ${boardType} at I2C address 0x${address.toString(16)}`);
          }
        }
      }
    } catch (error) {
      logger.warn('I2C detection failed (normal if not on Raspberry Pi):', error.message);
    }
    
    // 2. Detect RS485 devices
    for (let portIndex = 0; portIndex < this.rs485Ports.length; portIndex++) {
      const port = this.rs485Ports[portIndex];
      if (!port) continue;
      
      logger.info(`Scanning RS485 port ${portIndex + 1}: ${port}`);
      
      // Check if port exists
      try {
        await execAsync(`test -e ${port}`);
      } catch {
        logger.warn(`Port ${port} does not exist`);
        continue;
      }
      
      // Try to detect WitMotion sensors
      for (let address = 1; address <= 5; address++) {
        const witMotion = await this.probeWitMotion(port, address);
        if (witMotion) {
          detectedDevices.push({
            type: 'rs485',
            deviceType: 'witmotion',
            model: 'WT901C485',
            port,
            address,
            status: 'detected'
          });
          logger.info(`Detected WitMotion sensor at ${port} address ${address}`);
        }
      }
      
      // Try to detect SELEC MFM384 meters
      for (let address = 1; address <= 5; address++) {
        const mfm384 = await this.probeMFM384(port, address);
        if (mfm384) {
          detectedDevices.push({
            type: 'rs485',
            deviceType: 'mfm384',
            model: 'MFM384',
            port,
            address,
            status: 'detected'
          });
          logger.info(`Detected SELEC MFM384 at ${port} address ${address}`);
        }
      }
    }
    
    // 3. Check for Hailo AI accelerator
    try {
      const { stdout } = await execAsync('ls /dev/hailo* 2>/dev/null || true');
      if (stdout.trim()) {
        detectedDevices.push({
          type: 'ai',
          deviceType: 'hailo',
          device: stdout.trim(),
          status: 'detected'
        });
        logger.info('Detected Hailo AI accelerator');
      }
    } catch (error) {
      logger.debug('No Hailo device found');
    }
    
    logger.info(`Auto-detection complete. Found ${detectedDevices.length} devices`);
    return detectedDevices;
  }

  parseI2CDetect(output) {
    const addresses = [];
    const lines = output.split('\n');
    
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      // Extract hex values from line (skip row address)
      const matches = line.match(/[0-9a-f]{2}/gi);
      if (matches) {
        // First match is row address, skip it
        for (let j = 1; j < matches.length; j++) {
          const value = matches[j];
          if (value !== '--' && value !== 'UU') {
            addresses.push(parseInt(value, 16));
          }
        }
      }
    }
    
    return addresses;
  }

  identifySequentBoard(address) {
    // Known Sequent board default addresses
    const boardMap = {
      0x48: 'megabas',   // MegaBAS default
      0x50: 'megaind',   // MegaIND default  
      0x20: '8relind',   // 8-relay default
      0x27: '16relind',  // 16-relay default
      0x40: '16univin',  // 16-universal input default
      0x4C: '16univin',  // 16-universal input alt
      0x30: '16uout',    // 16-universal output default
      // Add more addresses as needed
    };
    
    // Also check stack addresses (base + stack * 1)
    for (const [baseAddr, boardType] of Object.entries(boardMap)) {
      const base = parseInt(baseAddr);
      // Check up to stack 7
      for (let stack = 0; stack < 8; stack++) {
        if (address === base + stack) {
          return boardType;
        }
      }
    }
    
    return null;
  }

  async probeWitMotion(port, address) {
    try {
      const sensor = new WitMotionSensor(port, address);
      
      // Try to connect with short timeout
      const timeout = setTimeout(() => {
        sensor.disconnect();
      }, 1000);
      
      await sensor.connect();
      const test = await sensor.readVibration();
      clearTimeout(timeout);
      
      if (test && typeof test.x === 'number') {
        await sensor.disconnect();
        return { address, detected: true };
      }
    } catch (error) {
      // Not a WitMotion sensor at this address
    }
    return null;
  }

  async probeMFM384(port, address) {
    try {
      const meter = new SelecMFM384(port, address);
      
      // Try to connect with short timeout
      const timeout = setTimeout(() => {
        meter.disconnect();
      }, 1000);
      
      await meter.connect();
      const test = await meter.readVoltage();
      clearTimeout(timeout);
      
      if (test && typeof test.L1 === 'number') {
        await meter.disconnect();
        return { address, detected: true };
      }
    } catch (error) {
      // Not a MFM384 at this address
    }
    return null;
  }
}

module.exports = new HardwareManager();
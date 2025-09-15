/**
 * Hardware Manager for Apollo Nexus
 * Manages all hardware interfaces including:
 * - Sequent Microsystems boards
 * - SELEC MFM384 power meters
 * - WitMotion vibration sensors
 * - Hailo AI accelerator
 */

const winston = require('winston');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Hardware drivers
const SelecMFM384 = require('./selecMFM384');
const SequentBoards = require('../../hardware/sequentBoards');
const WitMotionSensor = require('../../hardware/witMotionSensor');

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
        await this.addPowerMeter({
          id: config.board_address,
          port: config.port || '/dev/ttyUSB0',
          slaveId: parseInt(config.board_address),
          name: config.sensor_name
        });
      } else if (config.board_type === 'witmotion' && !this.devices.vibrationSensors.has(config.board_address)) {
        await this.addVibrationSensor({
          id: config.board_address,
          port: config.port || '/dev/ttyUSB1',
          slaveId: parseInt(config.board_address),
          name: config.sensor_name,
          mountLocation: config.location
        });
      }
    }
  }
  
  // Read all sensors for an equipment
  async readAllSensors(equipmentId) {
    const configs = this.sensorConfigs.get(equipmentId) || [];
    const sensorData = [];
    
    // Read from each configured sensor
    for (const config of configs) {
      try {
        const readings = await this.readSensor(config);
        sensorData.push(...readings);
      } catch (error) {
        logger.error(`Error reading sensor ${config.sensor_name}:`, error);
      }
    }
    
    return sensorData;
  }
  
  // Read individual sensor based on configuration
  async readSensor(config) {
    const { board_type, board_address, channel, sensor_type, input_range } = config;
    
    switch (board_type) {
      case 'mfm384':
        return await this.readPowerMeter(board_address);
        
      case 'megabas':
        return await this.readMegaBAS(board_address, channel, input_range);
        
      case 'megaind':
        return await this.readMegaIND(board_address, channel, input_range);
        
      case '16univin':
        return await this.read16UnivIn(board_address, channel, input_range);
        
      case 'witmotion':
        return await this.readVibrationSensor(board_address);
        
      default:
        throw new Error(`Unknown board type: ${board_type}`);
    }
  }
  
  // Read SELEC MFM384 power meter
  async readPowerMeter(meterId) {
    const meter = this.devices.powerMeters.get(meterId);
    if (!meter) {
      throw new Error(`Power meter ${meterId} not found`);
    }
    
    const data = await meter.instance.getAllMeasurements();
    return meter.instance.formatForApollo();
  }
  
  // Read Sequent MegaBAS
  async readMegaBAS(address, channel, inputRange) {
    const board = this.devices.sequentBoards.get(address);
    if (!board || board.type !== 'megabas') {
      throw new Error(`MegaBAS board at ${address} not found`);
    }
    
    return await SequentBoards.readMegaBAS(address, channel, inputRange);
  }
  
  // Read Sequent MegaIND
  async readMegaIND(address, channel, inputRange) {
    const board = this.devices.sequentBoards.get(address);
    if (!board || board.type !== 'megaind') {
      throw new Error(`MegaIND board at ${address} not found`);
    }
    
    return await SequentBoards.readMegaIND(address, channel, inputRange);
  }
  
  // Read Sequent 16-UNIV-IN
  async read16UnivIn(address, channel, inputRange) {
    const board = this.devices.sequentBoards.get(address);
    if (!board || board.type !== '16univin') {
      throw new Error(`16-UNIV-IN board at ${address} not found`);
    }
    
    return await SequentBoards.read16UnivIn(address, channel, inputRange);
  }
  
  // Read WitMotion vibration sensor
  async readVibrationSensor(sensorId) {
    const sensor = this.devices.vibrationSensors.get(sensorId);
    if (!sensor) {
      throw new Error(`Vibration sensor ${sensorId} not found`);
    }
    
    const data = await sensor.instance.readAll();
    return sensor.instance.formatForApollo();
  }
  
  // Start real-time monitoring for equipment
  async startMonitoring(equipmentId, callback) {
    const configs = this.sensorConfigs.get(equipmentId) || [];
    
    // Start monitoring for power meters
    for (const config of configs) {
      if (config.board_type === 'mfm384') {
        const meter = this.devices.powerMeters.get(config.board_address);
        if (meter) {
          meter.instance.startMonitoring((err, apolloData, rawData) => {
            if (!err) {
              callback({
                type: 'power_meter',
                data: apolloData,
                raw: rawData
              });
            }
          }, 1000); // 1 second interval
        }
      } else if (config.board_type === 'witmotion') {
        const sensor = this.devices.vibrationSensors.get(config.board_address);
        if (sensor) {
          sensor.instance.startMonitoring((err, apolloData, rawData) => {
            if (!err) {
              callback({
                type: 'vibration',
                data: apolloData,
                raw: rawData
              });
            }
          }, 100); // 100ms interval for vibration
        }
      }
    }
    
    // Poll Sequent boards
    this.sequentPollingInterval = setInterval(async () => {
      for (const config of configs) {
        if (config.board_type.includes('mega') || config.board_type.includes('univ')) {
          try {
            const data = await this.readSensor(config);
            callback({
              type: 'sequent',
              data: data
            });
          } catch (error) {
            logger.error(`Error polling ${config.board_type}:`, error);
          }
        }
      }
    }, 1000);
  }
  
  // Stop monitoring
  stopMonitoring() {
    // Stop power meter monitoring
    for (const meter of this.devices.powerMeters.values()) {
      meter.instance.stopMonitoring();
    }
    
    // Stop vibration monitoring
    for (const sensor of this.devices.vibrationSensors.values()) {
      sensor.instance.stopMonitoring();
    }
    
    // Stop Sequent polling
    if (this.sequentPollingInterval) {
      clearInterval(this.sequentPollingInterval);
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
}

module.exports = new HardwareManager();
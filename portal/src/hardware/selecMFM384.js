/**
 * SELEC MFM384-R-CE Power Meter Driver
 * 3-Phase 4-Wire Power Analyzer with Modbus RTU
 * 
 * Key Features:
 * - True RMS measurements for voltage and current
 * - Power (kW, kVA, kVAR) measurements
 * - Power factor and frequency
 * - Energy metering (kWh, kVAh, kVARh)
 * - THD for voltage and current
 * - Demand measurements
 * - Individual harmonics up to 31st
 */

const ModbusRTU = require('modbus-serial');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

class SelecMFM384 {
  constructor(port, slaveId = 1, options = {}) {
    this.port = port;
    this.slaveId = slaveId;
    this.client = new ModbusRTU();
    
    // Default RS485 settings for MFM384
    this.baudRate = options.baudRate || 9600;
    this.dataBits = options.dataBits || 8;
    this.stopBits = options.stopBits || 1;
    this.parity = options.parity || 'none';
    
    this.connected = false;
    this.lastReadTime = null;
    this.cache = {};
    this.cacheTimeout = 100; // ms
    
    // Register map for MFM384-R-CE
    this.registers = {
      // System Parameters (Float32 - 2 registers each)
      voltage: {
        L1_N: 0x0000,    // V L1-N
        L2_N: 0x0002,    // V L2-N
        L3_N: 0x0004,    // V L3-N
        avg_LN: 0x0006,  // V Avg L-N
        L1_L2: 0x0008,   // V L1-L2
        L2_L3: 0x000A,   // V L2-L3
        L3_L1: 0x000C,   // V L3-L1
        avg_LL: 0x000E   // V Avg L-L
      },
      
      current: {
        L1: 0x0010,      // I L1
        L2: 0x0012,      // I L2
        L3: 0x0014,      // I L3
        N: 0x0016,       // I N (Neutral)
        avg: 0x0018      // I Avg
      },
      
      power: {
        kW_L1: 0x001A,   // kW L1
        kW_L2: 0x001C,   // kW L2
        kW_L3: 0x001E,   // kW L3
        kW_total: 0x0020, // kW Total
        
        kVA_L1: 0x0022,  // kVA L1
        kVA_L2: 0x0024,  // kVA L2
        kVA_L3: 0x0026,  // kVA L3
        kVA_total: 0x0028, // kVA Total
        
        kVAR_L1: 0x002A, // kVAR L1
        kVAR_L2: 0x002C, // kVAR L2
        kVAR_L3: 0x002E, // kVAR L3
        kVAR_total: 0x0030 // kVAR Total
      },
      
      powerFactor: {
        L1: 0x0032,      // PF L1
        L2: 0x0034,      // PF L2
        L3: 0x0036,      // PF L3
        avg: 0x0038      // PF Avg
      },
      
      frequency: 0x003A,  // Frequency Hz
      
      thd: {
        voltage_L1: 0x003C, // THD V L1 %
        voltage_L2: 0x003E, // THD V L2 %
        voltage_L3: 0x0040, // THD V L3 %
        current_L1: 0x0042, // THD I L1 %
        current_L2: 0x0044, // THD I L2 %
        current_L3: 0x0046  // THD I L3 %
      },
      
      energy: {
        kWh_import: 0x0048,    // kWh Import (4 registers - Int64)
        kWh_export: 0x004C,    // kWh Export (4 registers - Int64)
        kVAh: 0x0050,          // kVAh (4 registers - Int64)
        kVARh_import: 0x0054,  // kVARh Import (4 registers - Int64)
        kVARh_export: 0x0058   // kVARh Export (4 registers - Int64)
      },
      
      demand: {
        kW_present: 0x005C,    // Present Demand kW
        kW_max: 0x005E,        // Max Demand kW
        kVA_present: 0x0060,   // Present Demand kVA
        kVA_max: 0x0062        // Max Demand kVA
      },
      
      // System info
      ct_primary: 0x0200,      // CT Primary (Int16)
      ct_secondary: 0x0201,    // CT Secondary (Int16)
      pt_primary: 0x0202,      // PT Primary (Int16)
      pt_secondary: 0x0203     // PT Secondary (Int16)
    };
  }
  
  async connect() {
    try {
      await this.client.connectRTUBuffered(this.port, {
        baudRate: this.baudRate,
        dataBits: this.dataBits,
        stopBits: this.stopBits,
        parity: this.parity
      });
      
      this.client.setID(this.slaveId);
      this.client.setTimeout(2000);
      
      this.connected = true;
      logger.info(`Connected to SELEC MFM384 on ${this.port} (Slave ID: ${this.slaveId})`);
      
      // Read device info to verify connection
      const info = await this.getSystemInfo();
      logger.info('MFM384 System Info:', info);
      
      return true;
    } catch (error) {
      logger.error('Failed to connect to MFM384:', error.message);
      this.connected = false;
      throw error;
    }
  }
  
  async disconnect() {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
      logger.info('Disconnected from MFM384');
    }
  }
  
  // Read 32-bit float from 2 Modbus registers (big-endian)
  async readFloat32(address) {
    try {
      // Check cache first
      const now = Date.now();
      const cacheKey = `float32_${address}`;
      
      if (this.cache[cacheKey] && (now - this.cache[cacheKey].time < this.cacheTimeout)) {
        return this.cache[cacheKey].value;
      }
      
      const result = await this.client.readHoldingRegisters(address, 2);
      const buffer = Buffer.allocUnsafe(4);
      
      // MFM384 uses big-endian float format
      buffer.writeUInt16BE(result.data[0], 0);
      buffer.writeUInt16BE(result.data[1], 2);
      
      const value = buffer.readFloatBE(0);
      
      // Cache the result
      this.cache[cacheKey] = { value, time: now };
      
      return value;
    } catch (error) {
      logger.error(`Error reading float32 at address ${address}:`, error.message);
      throw error;
    }
  }
  
  // Read 64-bit integer from 4 Modbus registers (for energy values)
  async readInt64(address) {
    try {
      const result = await this.client.readHoldingRegisters(address, 4);
      
      // Combine 4 16-bit registers into 64-bit value
      let value = 0;
      for (let i = 0; i < 4; i++) {
        value = (value << 16) | result.data[i];
      }
      
      return value;
    } catch (error) {
      logger.error(`Error reading int64 at address ${address}:`, error.message);
      throw error;
    }
  }
  
  // Get all voltage measurements
  async getVoltages() {
    const voltages = {};
    
    for (const [key, address] of Object.entries(this.registers.voltage)) {
      try {
        voltages[key] = await this.readFloat32(address);
      } catch (error) {
        voltages[key] = null;
      }
    }
    
    return voltages;
  }
  
  // Get all current measurements
  async getCurrents() {
    const currents = {};
    
    for (const [key, address] of Object.entries(this.registers.current)) {
      try {
        currents[key] = await this.readFloat32(address);
      } catch (error) {
        currents[key] = null;
      }
    }
    
    return currents;
  }
  
  // Get all power measurements
  async getPower() {
    const power = {};
    
    for (const [key, address] of Object.entries(this.registers.power)) {
      try {
        power[key] = await this.readFloat32(address);
      } catch (error) {
        power[key] = null;
      }
    }
    
    return power;
  }
  
  // Get power factor measurements
  async getPowerFactor() {
    const pf = {};
    
    for (const [key, address] of Object.entries(this.registers.powerFactor)) {
      try {
        pf[key] = await this.readFloat32(address);
      } catch (error) {
        pf[key] = null;
      }
    }
    
    return pf;
  }
  
  // Get frequency
  async getFrequency() {
    try {
      return await this.readFloat32(this.registers.frequency);
    } catch (error) {
      return null;
    }
  }
  
  // Get THD measurements
  async getTHD() {
    const thd = {};
    
    for (const [key, address] of Object.entries(this.registers.thd)) {
      try {
        thd[key] = await this.readFloat32(address);
      } catch (error) {
        thd[key] = null;
      }
    }
    
    return thd;
  }
  
  // Get energy measurements
  async getEnergy() {
    const energy = {};
    
    for (const [key, address] of Object.entries(this.registers.energy)) {
      try {
        energy[key] = await this.readInt64(address) / 1000; // Convert to kWh
      } catch (error) {
        energy[key] = null;
      }
    }
    
    return energy;
  }
  
  // Get demand measurements
  async getDemand() {
    const demand = {};
    
    for (const [key, address] of Object.entries(this.registers.demand)) {
      try {
        demand[key] = await this.readFloat32(address);
      } catch (error) {
        demand[key] = null;
      }
    }
    
    return demand;
  }
  
  // Get system configuration info
  async getSystemInfo() {
    try {
      const ct_primary = await this.client.readHoldingRegisters(this.registers.ct_primary, 1);
      const ct_secondary = await this.client.readHoldingRegisters(this.registers.ct_secondary, 1);
      const pt_primary = await this.client.readHoldingRegisters(this.registers.pt_primary, 1);
      const pt_secondary = await this.client.readHoldingRegisters(this.registers.pt_secondary, 1);
      
      return {
        ct_ratio: `${ct_primary.data[0]}:${ct_secondary.data[0]}`,
        pt_ratio: `${pt_primary.data[0]}:${pt_secondary.data[0]}`,
        ct_primary: ct_primary.data[0],
        ct_secondary: ct_secondary.data[0],
        pt_primary: pt_primary.data[0],
        pt_secondary: pt_secondary.data[0]
      };
    } catch (error) {
      logger.error('Error reading system info:', error.message);
      return null;
    }
  }
  
  // Get all measurements in a single call (optimized for real-time monitoring)
  async getAllMeasurements() {
    const measurements = {
      timestamp: new Date().toISOString(),
      voltages: await this.getVoltages(),
      currents: await this.getCurrents(),
      power: await this.getPower(),
      powerFactor: await this.getPowerFactor(),
      frequency: await this.getFrequency(),
      thd: await this.getTHD(),
      energy: await this.getEnergy(),
      demand: await this.getDemand()
    };
    
    // Calculate additional metrics
    measurements.calculated = {
      voltage_imbalance: this.calculateImbalance([
        measurements.voltages.L1_N,
        measurements.voltages.L2_N,
        measurements.voltages.L3_N
      ]),
      current_imbalance: this.calculateImbalance([
        measurements.currents.L1,
        measurements.currents.L2,
        measurements.currents.L3
      ])
    };
    
    this.lastReadTime = Date.now();
    return measurements;
  }
  
  // Calculate percentage imbalance
  calculateImbalance(values) {
    const validValues = values.filter(v => v !== null && v !== undefined);
    if (validValues.length < 3) return null;
    
    const avg = validValues.reduce((a, b) => a + b, 0) / validValues.length;
    const maxDeviation = Math.max(...validValues.map(v => Math.abs(v - avg)));
    
    return (maxDeviation / avg) * 100;
  }
  
  // Format data for Apollo Nexus sensor format
  formatForApollo() {
    if (!this.lastMeasurements) return [];
    
    const m = this.lastMeasurements;
    const sensors = [];
    
    // Voltage sensors
    sensors.push(
      { name: 'VOLTAGE_L1', type: 'voltage', value: m.voltages.L1_N, units: 'V', location: 'electrical_panel' },
      { name: 'VOLTAGE_L2', type: 'voltage', value: m.voltages.L2_N, units: 'V', location: 'electrical_panel' },
      { name: 'VOLTAGE_L3', type: 'voltage', value: m.voltages.L3_N, units: 'V', location: 'electrical_panel' }
    );
    
    // Current sensors
    sensors.push(
      { name: 'CURRENT_L1', type: 'current', value: m.currents.L1, units: 'A', location: 'electrical_panel' },
      { name: 'CURRENT_L2', type: 'current', value: m.currents.L2, units: 'A', location: 'electrical_panel' },
      { name: 'CURRENT_L3', type: 'current', value: m.currents.L3, units: 'A', location: 'electrical_panel' },
      { name: 'CURRENT_N', type: 'current', value: m.currents.N, units: 'A', location: 'electrical_panel' }
    );
    
    // Power sensors
    sensors.push(
      { name: 'POWER_TOTAL', type: 'power', value: m.power.kW_total, units: 'kW', location: 'electrical_panel' },
      { name: 'POWER_L1', type: 'power', value: m.power.kW_L1, units: 'kW', location: 'electrical_panel' },
      { name: 'POWER_L2', type: 'power', value: m.power.kW_L2, units: 'kW', location: 'electrical_panel' },
      { name: 'POWER_L3', type: 'power', value: m.power.kW_L3, units: 'kW', location: 'electrical_panel' }
    );
    
    // Power quality sensors
    sensors.push(
      { name: 'POWER_FACTOR', type: 'power_factor', value: m.powerFactor.avg, units: '', location: 'electrical_panel' },
      { name: 'FREQUENCY', type: 'frequency', value: m.frequency, units: 'Hz', location: 'electrical_panel' },
      { name: 'THD_VOLTAGE_L1', type: 'thd', value: m.thd.voltage_L1, units: '%', location: 'electrical_panel' },
      { name: 'THD_CURRENT_L1', type: 'thd', value: m.thd.current_L1, units: '%', location: 'electrical_panel' }
    );
    
    // Energy sensors
    sensors.push(
      { name: 'ENERGY_KWH', type: 'energy', value: m.energy.kWh_import, units: 'kWh', location: 'electrical_panel' },
      { name: 'DEMAND_KW', type: 'demand', value: m.demand.kW_present, units: 'kW', location: 'electrical_panel' },
      { name: 'DEMAND_MAX_KW', type: 'demand_max', value: m.demand.kW_max, units: 'kW', location: 'electrical_panel' }
    );
    
    // Calculated values
    sensors.push(
      { name: 'VOLTAGE_IMBALANCE', type: 'imbalance', value: m.calculated.voltage_imbalance, units: '%', location: 'electrical_panel' },
      { name: 'CURRENT_IMBALANCE', type: 'imbalance', value: m.calculated.current_imbalance, units: '%', location: 'electrical_panel' }
    );
    
    return sensors.filter(s => s.value !== null && s.value !== undefined);
  }
  
  // Continuous monitoring
  async startMonitoring(callback, interval = 1000) {
    if (!this.connected) {
      throw new Error('Not connected to MFM384');
    }
    
    this.monitoringInterval = setInterval(async () => {
      try {
        this.lastMeasurements = await this.getAllMeasurements();
        const apolloData = this.formatForApollo();
        callback(null, apolloData, this.lastMeasurements);
      } catch (error) {
        callback(error, null, null);
      }
    }, interval);
    
    logger.info(`Started monitoring MFM384 every ${interval}ms`);
  }
  
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Stopped monitoring MFM384');
    }
  }
}

module.exports = SelecMFM384;
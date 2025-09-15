/**
 * SELEC MFM384 Power Meter Driver
 * 3-phase power meter with RS485 Modbus RTU interface
 */

const ModbusRTU = require('modbus-serial');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// MFM384 Modbus register map
const REGISTERS = {
  // Voltage registers (V)
  VOLTAGE_L1: 0x0000,
  VOLTAGE_L2: 0x0002,
  VOLTAGE_L3: 0x0004,
  VOLTAGE_LN_AVG: 0x0006,
  VOLTAGE_L1_L2: 0x0008,
  VOLTAGE_L2_L3: 0x000A,
  VOLTAGE_L3_L1: 0x000C,
  VOLTAGE_LL_AVG: 0x000E,
  
  // Current registers (A)
  CURRENT_L1: 0x0010,
  CURRENT_L2: 0x0012,
  CURRENT_L3: 0x0014,
  CURRENT_N: 0x0016,
  CURRENT_AVG: 0x0018,
  
  // Power registers (kW)
  POWER_L1: 0x001A,
  POWER_L2: 0x001C,
  POWER_L3: 0x001E,
  POWER_TOTAL: 0x0020,
  
  // Reactive power (kVAR)
  REACTIVE_L1: 0x0022,
  REACTIVE_L2: 0x0024,
  REACTIVE_L3: 0x0026,
  REACTIVE_TOTAL: 0x0028,
  
  // Apparent power (kVA)
  APPARENT_L1: 0x002A,
  APPARENT_L2: 0x002C,
  APPARENT_L3: 0x002E,
  APPARENT_TOTAL: 0x0030,
  
  // Power factor
  PF_L1: 0x0032,
  PF_L2: 0x0034,
  PF_L3: 0x0036,
  PF_AVG: 0x0038,
  
  // Frequency
  FREQUENCY: 0x003A,
  
  // THD
  THD_V_L1: 0x003C,
  THD_V_L2: 0x003E,
  THD_V_L3: 0x0040,
  THD_I_L1: 0x0042,
  THD_I_L2: 0x0044,
  THD_I_L3: 0x0046,
  
  // Energy registers (kWh)
  ENERGY_IMP: 0x0048,
  ENERGY_EXP: 0x004C,
  ENERGY_TOTAL: 0x0050,
  
  // Maximum demand
  MAX_DEMAND: 0x0054,
  
  // System parameters
  CT_PRIMARY: 0x0100,
  CT_SECONDARY: 0x0102,
  PT_PRIMARY: 0x0104,
  PT_SECONDARY: 0x0106
};

class SelecMFM384 {
  constructor(port, slaveId) {
    this.port = port;
    this.slaveId = slaveId;
    this.client = new ModbusRTU();
    this.connected = false;
    this.ctRatio = 1;
    this.ptRatio = 1;
  }

  async connect() {
    try {
      await this.client.connectRTUBuffered(this.port, {
        baudRate: parseInt(process.env.RS485_BAUDRATE) || 9600,
        dataBits: 8,
        parity: 'none',
        stopBits: 1
      });
      
      this.client.setID(this.slaveId);
      this.client.setTimeout(1000);
      
      // Read CT and PT ratios
      await this.readTransformerRatios();
      
      this.connected = true;
      logger.info(`SELEC MFM384 connected on ${this.port} (Slave ${this.slaveId})`);
      
    } catch (error) {
      throw new Error(`Failed to connect to MFM384: ${error.message}`);
    }
  }

  disconnect() {
    if (this.client.isOpen) {
      this.client.close();
      this.connected = false;
    }
  }

  // Read CT and PT ratios for scaling
  async readTransformerRatios() {
    try {
      const ctData = await this.client.readHoldingRegisters(REGISTERS.CT_PRIMARY, 2);
      const ptData = await this.client.readHoldingRegisters(REGISTERS.PT_PRIMARY, 2);
      
      const ctPrimary = ctData.data[0];
      const ctSecondary = ctData.data[1] || 5;
      const ptPrimary = ptData.data[0];
      const ptSecondary = ptData.data[1] || 1;
      
      this.ctRatio = ctPrimary / ctSecondary;
      this.ptRatio = ptPrimary / ptSecondary;
      
      logger.debug(`MFM384 CT ratio: ${this.ctRatio}, PT ratio: ${this.ptRatio}`);
    } catch (error) {
      logger.warn('Could not read transformer ratios, using defaults');
      this.ctRatio = 1;
      this.ptRatio = 1;
    }
  }

  // Convert two 16-bit registers to 32-bit float
  registersToFloat(registers) {
    const buffer = Buffer.allocUnsafe(4);
    buffer.writeUInt16BE(registers[1], 0);
    buffer.writeUInt16BE(registers[0], 2);
    return buffer.readFloatBE(0);
  }

  // Read all electrical parameters
  async readAllParameters() {
    try {
      const data = {};
      
      // Read voltages
      const voltages = await this.client.readHoldingRegisters(REGISTERS.VOLTAGE_L1, 8);
      data.voltage = {
        L1: this.registersToFloat([voltages.data[0], voltages.data[1]]),
        L2: this.registersToFloat([voltages.data[2], voltages.data[3]]),
        L3: this.registersToFloat([voltages.data[4], voltages.data[5]]),
        avg: this.registersToFloat([voltages.data[6], voltages.data[7]])
      };
      
      // Read line-to-line voltages
      const llVoltages = await this.client.readHoldingRegisters(REGISTERS.VOLTAGE_L1_L2, 8);
      data.voltageLL = {
        L1_L2: this.registersToFloat([llVoltages.data[0], llVoltages.data[1]]),
        L2_L3: this.registersToFloat([llVoltages.data[2], llVoltages.data[3]]),
        L3_L1: this.registersToFloat([llVoltages.data[4], llVoltages.data[5]]),
        avg: this.registersToFloat([llVoltages.data[6], llVoltages.data[7]])
      };
      
      // Read currents
      const currents = await this.client.readHoldingRegisters(REGISTERS.CURRENT_L1, 10);
      data.current = {
        L1: this.registersToFloat([currents.data[0], currents.data[1]]),
        L2: this.registersToFloat([currents.data[2], currents.data[3]]),
        L3: this.registersToFloat([currents.data[4], currents.data[5]]),
        N: this.registersToFloat([currents.data[6], currents.data[7]]),
        avg: this.registersToFloat([currents.data[8], currents.data[9]])
      };
      
      // Read power
      const power = await this.client.readHoldingRegisters(REGISTERS.POWER_L1, 8);
      data.power = {
        L1: this.registersToFloat([power.data[0], power.data[1]]),
        L2: this.registersToFloat([power.data[2], power.data[3]]),
        L3: this.registersToFloat([power.data[4], power.data[5]]),
        total: this.registersToFloat([power.data[6], power.data[7]])
      };
      
      // Read reactive power
      const reactive = await this.client.readHoldingRegisters(REGISTERS.REACTIVE_L1, 8);
      data.reactive = {
        L1: this.registersToFloat([reactive.data[0], reactive.data[1]]),
        L2: this.registersToFloat([reactive.data[2], reactive.data[3]]),
        L3: this.registersToFloat([reactive.data[4], reactive.data[5]]),
        total: this.registersToFloat([reactive.data[6], reactive.data[7]])
      };
      
      // Read apparent power
      const apparent = await this.client.readHoldingRegisters(REGISTERS.APPARENT_L1, 8);
      data.apparent = {
        L1: this.registersToFloat([apparent.data[0], apparent.data[1]]),
        L2: this.registersToFloat([apparent.data[2], apparent.data[3]]),
        L3: this.registersToFloat([apparent.data[4], apparent.data[5]]),
        total: this.registersToFloat([apparent.data[6], apparent.data[7]])
      };
      
      // Read power factor
      const pf = await this.client.readHoldingRegisters(REGISTERS.PF_L1, 8);
      data.powerFactor = {
        L1: this.registersToFloat([pf.data[0], pf.data[1]]),
        L2: this.registersToFloat([pf.data[2], pf.data[3]]),
        L3: this.registersToFloat([pf.data[4], pf.data[5]]),
        avg: this.registersToFloat([pf.data[6], pf.data[7]])
      };
      
      // Read frequency
      const freq = await this.client.readHoldingRegisters(REGISTERS.FREQUENCY, 2);
      data.frequency = this.registersToFloat([freq.data[0], freq.data[1]]);
      
      // Read THD
      const thd = await this.client.readHoldingRegisters(REGISTERS.THD_V_L1, 12);
      data.thd = {
        voltage: {
          L1: this.registersToFloat([thd.data[0], thd.data[1]]),
          L2: this.registersToFloat([thd.data[2], thd.data[3]]),
          L3: this.registersToFloat([thd.data[4], thd.data[5]])
        },
        current: {
          L1: this.registersToFloat([thd.data[6], thd.data[7]]),
          L2: this.registersToFloat([thd.data[8], thd.data[9]]),
          L3: this.registersToFloat([thd.data[10], thd.data[11]])
        }
      };
      
      // Read energy
      const energy = await this.client.readHoldingRegisters(REGISTERS.ENERGY_IMP, 12);
      data.energy = {
        import: this.registersToFloat([energy.data[0], energy.data[1], energy.data[2], energy.data[3]]),
        export: this.registersToFloat([energy.data[4], energy.data[5], energy.data[6], energy.data[7]]),
        total: this.registersToFloat([energy.data[8], energy.data[9], energy.data[10], energy.data[11]])
      };
      
      return data;
    } catch (error) {
      logger.error('Error reading MFM384 parameters:', error);
      throw error;
    }
  }

  // Read specific value based on sensor configuration
  async readValue(config) {
    try {
      const { sensor_type, channel } = config;
      let register, value;
      
      switch (sensor_type) {
        case 'voltage':
          if (channel === 1) register = REGISTERS.VOLTAGE_L1;
          else if (channel === 2) register = REGISTERS.VOLTAGE_L2;
          else if (channel === 3) register = REGISTERS.VOLTAGE_L3;
          else register = REGISTERS.VOLTAGE_LN_AVG;
          break;
          
        case 'current':
          if (channel === 1) register = REGISTERS.CURRENT_L1;
          else if (channel === 2) register = REGISTERS.CURRENT_L2;
          else if (channel === 3) register = REGISTERS.CURRENT_L3;
          else register = REGISTERS.CURRENT_AVG;
          break;
          
        case 'power':
          register = REGISTERS.POWER_TOTAL;
          break;
          
        case 'power_factor':
          register = REGISTERS.PF_AVG;
          break;
          
        case 'frequency':
          register = REGISTERS.FREQUENCY;
          break;
          
        case 'energy':
          register = REGISTERS.ENERGY_TOTAL;
          break;
          
        default:
          throw new Error(`Unknown sensor type for MFM384: ${sensor_type}`);
      }
      
      const result = await this.client.readHoldingRegisters(register, 2);
      
      // Handle 32-bit energy register
      if (sensor_type === 'energy') {
        const energyData = await this.client.readHoldingRegisters(register, 4);
        value = this.registersToFloat([
          energyData.data[0], 
          energyData.data[1], 
          energyData.data[2], 
          energyData.data[3]
        ]);
      } else {
        value = this.registersToFloat([result.data[0], result.data[1]]);
      }
      
      return value;
    } catch (error) {
      logger.error('Error reading MFM384 value:', error);
      throw error;
    }
  }

  // Reset energy counters
  async resetEnergy() {
    try {
      // Write password (default: 1000)
      await this.client.writeRegister(0x0200, 1000);
      
      // Reset command
      await this.client.writeRegister(0x0201, 1);
      
      logger.info('MFM384 energy counters reset');
      return true;
    } catch (error) {
      logger.error('Failed to reset energy:', error);
      throw error;
    }
  }

  // Set demand interval (minutes)
  async setDemandInterval(minutes) {
    try {
      if (minutes < 1 || minutes > 60) {
        throw new Error('Demand interval must be between 1 and 60 minutes');
      }
      
      // Write password
      await this.client.writeRegister(0x0200, 1000);
      
      // Set interval
      await this.client.writeRegister(0x0110, minutes);
      
      logger.info(`Set MFM384 demand interval to ${minutes} minutes`);
      return true;
    } catch (error) {
      logger.error('Failed to set demand interval:', error);
      throw error;
    }
  }
}

module.exports = SelecMFM384;
/**
 * WitMotion WT901C485 Vibration Sensor Driver
 * 9-axis sensor with RS485 interface
 */

const SerialPort = require('serialport');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// WT901C485 register addresses
const REGISTERS = {
  SAVE: 0x00,
  CALIBRATION: 0x01,
  OUTPUT_RATE: 0x03,
  BAUD_RATE: 0x04,
  AXIS_CONFIG: 0x05,
  
  // Data registers
  AX_L: 0x34,
  AX_H: 0x35,
  AY_L: 0x36,
  AY_H: 0x37,
  AZ_L: 0x38,
  AZ_H: 0x39,
  
  GX_L: 0x3A,
  GX_H: 0x3B,
  GY_L: 0x3C,
  GY_H: 0x3D,
  GZ_L: 0x3E,
  GZ_H: 0x3F,
  
  HX_L: 0x40,
  HX_H: 0x41,
  HY_L: 0x42,
  HY_H: 0x43,
  HZ_L: 0x44,
  HZ_H: 0x45,
  
  ROLL_L: 0x46,
  ROLL_H: 0x47,
  PITCH_L: 0x48,
  PITCH_H: 0x49,
  YAW_L: 0x4A,
  YAW_H: 0x4B,
  
  TEMP_L: 0x4C,
  TEMP_H: 0x4D
};

class WitMotionSensor {
  constructor(port, slaveId) {
    this.port = port;
    this.slaveId = slaveId;
    this.serialPort = null;
    this.connected = false;
    this.buffer = Buffer.alloc(0);
  }

  async connect() {
    try {
      this.serialPort = new SerialPort(this.port, {
        baudRate: parseInt(process.env.RS485_BAUDRATE) || 9600,
        dataBits: 8,
        parity: 'none',
        stopBits: 1
      });

      await new Promise((resolve, reject) => {
        this.serialPort.on('open', () => {
          logger.info(`WitMotion sensor connected on ${this.port}`);
          this.connected = true;
          resolve();
        });
        
        this.serialPort.on('error', (err) => {
          logger.error(`WitMotion sensor error:`, err);
          reject(err);
        });
      });

      // Set up data handler
      this.serialPort.on('data', (data) => {
        this.buffer = Buffer.concat([this.buffer, data]);
        this.processBuffer();
      });

    } catch (error) {
      throw new Error(`Failed to connect to WitMotion sensor: ${error.message}`);
    }
  }

  disconnect() {
    if (this.serialPort && this.serialPort.isOpen) {
      this.serialPort.close();
      this.connected = false;
    }
  }

  // Read register using Modbus RTU protocol
  async readRegister(register, count = 1) {
    return new Promise((resolve, reject) => {
      const request = this.buildModbusRequest(0x03, register, count);
      
      this.serialPort.write(request, (err) => {
        if (err) {
          reject(err);
          return;
        }
      });

      // Wait for response
      const timeout = setTimeout(() => {
        reject(new Error('Read timeout'));
      }, 1000);

      const responseHandler = (response) => {
        clearTimeout(timeout);
        resolve(response);
      };

      this.once('modbusResponse', responseHandler);
    });
  }

  // Build Modbus RTU request
  buildModbusRequest(functionCode, register, count) {
    const buffer = Buffer.allocUnsafe(8);
    
    buffer.writeUInt8(this.slaveId, 0);           // Slave address
    buffer.writeUInt8(functionCode, 1);           // Function code
    buffer.writeUInt16BE(register, 2);            // Register address
    buffer.writeUInt16BE(count, 4);               // Register count
    
    // Calculate CRC16
    const crc = this.calculateCRC16(buffer.slice(0, 6));
    buffer.writeUInt16LE(crc, 6);
    
    return buffer;
  }

  // Calculate Modbus CRC16
  calculateCRC16(buffer) {
    let crc = 0xFFFF;
    
    for (let i = 0; i < buffer.length; i++) {
      crc ^= buffer[i];
      
      for (let j = 0; j < 8; j++) {
        if (crc & 0x0001) {
          crc = (crc >> 1) ^ 0xA001;
        } else {
          crc = crc >> 1;
        }
      }
    }
    
    return crc;
  }

  // Process incoming data buffer
  processBuffer() {
    while (this.buffer.length >= 5) {
      // Check for valid Modbus response
      if (this.buffer[0] === this.slaveId) {
        const functionCode = this.buffer[1];
        
        if (functionCode === 0x03) {
          const byteCount = this.buffer[2];
          const expectedLength = 5 + byteCount; // Address + FC + Count + Data + CRC
          
          if (this.buffer.length >= expectedLength) {
            const response = this.buffer.slice(0, expectedLength);
            this.buffer = this.buffer.slice(expectedLength);
            
            // Verify CRC
            const receivedCRC = response.readUInt16LE(response.length - 2);
            const calculatedCRC = this.calculateCRC16(response.slice(0, -2));
            
            if (receivedCRC === calculatedCRC) {
              this.emit('modbusResponse', response.slice(3, -2)); // Return data bytes
            }
          } else {
            break; // Wait for more data
          }
        } else {
          // Invalid response, skip byte
          this.buffer = this.buffer.slice(1);
        }
      } else {
        // Not our slave ID, skip byte
        this.buffer = this.buffer.slice(1);
      }
    }
  }

  // Read all sensor data
  async readAllData() {
    try {
      // Read acceleration, gyro, magnetic, angle, and temperature
      // Starting from AX_L (0x34) to TEMP_H (0x4D) = 26 registers
      const data = await this.readRegister(REGISTERS.AX_L, 26);
      
      const readings = {
        acceleration: {
          x: this.parseValue(data, 0) / 32768 * 16, // ±16g range
          y: this.parseValue(data, 2) / 32768 * 16,
          z: this.parseValue(data, 4) / 32768 * 16,
          unit: 'g'
        },
        gyroscope: {
          x: this.parseValue(data, 6) / 32768 * 2000, // ±2000°/s range
          y: this.parseValue(data, 8) / 32768 * 2000,
          z: this.parseValue(data, 10) / 32768 * 2000,
          unit: '°/s'
        },
        magnetic: {
          x: this.parseValue(data, 12),
          y: this.parseValue(data, 14),
          z: this.parseValue(data, 16),
          unit: 'mG'
        },
        angle: {
          roll: this.parseValue(data, 18) / 32768 * 180,  // ±180°
          pitch: this.parseValue(data, 20) / 32768 * 180,
          yaw: this.parseValue(data, 22) / 32768 * 180,
          unit: '°'
        },
        temperature: this.parseValue(data, 24) / 100, // °C
        vibration: this.calculateVibration(
          this.parseValue(data, 0) / 32768 * 16,
          this.parseValue(data, 2) / 32768 * 16,
          this.parseValue(data, 4) / 32768 * 16
        )
      };
      
      return readings;
    } catch (error) {
      logger.error('Error reading WitMotion data:', error);
      throw error;
    }
  }

  // Parse 16-bit signed value from buffer
  parseValue(buffer, offset) {
    const low = buffer[offset];
    const high = buffer[offset + 1];
    let value = (high << 8) | low;
    
    // Convert to signed
    if (value > 32767) {
      value -= 65536;
    }
    
    return value;
  }

  // Calculate overall vibration magnitude
  calculateVibration(ax, ay, az) {
    // RMS of acceleration vector magnitude
    const magnitude = Math.sqrt(ax * ax + ay * ay + az * az);
    return {
      value: magnitude,
      unit: 'g',
      severity: this.getVibrationSeverity(magnitude)
    };
  }

  // Determine vibration severity based on ISO 10816
  getVibrationSeverity(magnitude) {
    if (magnitude < 0.71) return 'good';
    if (magnitude < 1.8) return 'satisfactory';
    if (magnitude < 4.5) return 'unsatisfactory';
    return 'unacceptable';
  }

  // Read value for hardware manager interface
  async readValue(config) {
    const data = await this.readAllData();
    
    // Return vibration magnitude by default
    return data.vibration.value;
  }

  // Calibrate sensor (zero gyroscope)
  async calibrate() {
    try {
      // Send calibration command
      const request = this.buildModbusRequest(0x06, REGISTERS.CALIBRATION, 0x0001);
      
      this.serialPort.write(request, (err) => {
        if (err) {
          throw err;
        }
      });
      
      // Wait for calibration to complete
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      logger.info('WitMotion sensor calibrated');
      return true;
    } catch (error) {
      logger.error('Calibration failed:', error);
      throw error;
    }
  }

  // Set output rate (Hz)
  async setOutputRate(rate) {
    const rateMap = {
      1: 0x01,
      2: 0x02,
      5: 0x03,
      10: 0x04,
      20: 0x05,
      50: 0x06,
      100: 0x07,
      200: 0x0B
    };
    
    const value = rateMap[rate];
    if (!value) {
      throw new Error(`Invalid output rate: ${rate}Hz`);
    }
    
    try {
      const request = this.buildModbusRequest(0x06, REGISTERS.OUTPUT_RATE, value);
      this.serialPort.write(request);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Save configuration
      const saveRequest = this.buildModbusRequest(0x06, REGISTERS.SAVE, 0x0000);
      this.serialPort.write(saveRequest);
      
      logger.info(`Set WitMotion output rate to ${rate}Hz`);
      return true;
    } catch (error) {
      logger.error('Failed to set output rate:', error);
      throw error;
    }
  }
}

// Add EventEmitter capabilities
const EventEmitter = require('events');
Object.setPrototypeOf(WitMotionSensor.prototype, EventEmitter.prototype);

module.exports = WitMotionSensor;
/**
 * Sequent Microsystems Board Driver
 * Supports: MegaBAS, MegaIND, 8RelIND, 16RelIND, 16UnivIn, 16UOut
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Board definitions with I2C addresses and capabilities
const BOARD_TYPES = {
  MEGABAS: {
    name: 'MegaBAS',
    baseAddress: 0x48,
    addressRange: 8,
    capabilities: {
      analogIn: 8,      // 8 x 0-10V inputs
      analogOut: 4,     // 4 x 0-10V outputs
      digitalIn: 8,     // 8 x opto-isolated inputs
      digitalOut: 4,    // 4 x relay outputs
      rs485: 2          // 2 x RS485 ports
    },
    command: 'megabas'
  },
  MEGAIND: {
    name: 'MegaIND',
    baseAddress: 0x50,
    addressRange: 8,
    capabilities: {
      analogIn: 8,      // 8 x 0-10V/4-20mA inputs
      analogOut: 4,     // 4 x 0-10V/4-20mA outputs
      digitalIn: 8,     // 8 x opto-isolated inputs
      digitalOut: 8,    // 8 x relay outputs
      rs485: 1          // 1 x RS485 port
    },
    command: 'megaind'
  },
  '8RELIND': {
    name: '8RelIND',
    baseAddress: 0x38,
    addressRange: 8,
    capabilities: {
      digitalOut: 8     // 8 x relay outputs
    },
    command: '8relind'
  },
  '16RELIND': {
    name: '16RelIND',
    baseAddress: 0x30,
    addressRange: 8,
    capabilities: {
      digitalOut: 16    // 16 x relay outputs
    },
    command: '16relind'
  },
  '16UNIVIN': {
    name: '16-UNIV-IN',
    baseAddress: 0x58,  // Corrected base address (0x58 + 4 = 0x5c for stack 4)
    addressRange: 8,
    capabilities: {
      universalIn: 16   // 16 x universal inputs (0-10V, 10K, PT1000)
    },
    command: '16univin'
  },
  '16UOUT': {
    name: '16-U-OUT',
    baseAddress: 0x58,
    addressRange: 8,
    capabilities: {
      analogOut: 16     // 16 x 0-10V outputs
    },
    command: '16uout'
  }
};

class SequentBoards {
  constructor() {
    this.detectedBoards = new Map();
  }

  // Scan for all Sequent boards
  async scanAll() {
    const boards = [];
    
    for (const [typeKey, boardDef] of Object.entries(BOARD_TYPES)) {
      for (let stack = 0; stack < boardDef.addressRange; stack++) {
        const address = boardDef.baseAddress + stack;
        const exists = await this.checkBoardExists(boardDef.command, stack);
        
        if (exists) {
          const board = {
            type: typeKey,
            name: boardDef.name,
            address: address,
            stack: stack,
            capabilities: boardDef.capabilities,
            command: boardDef.command
          };
          
          boards.push(board);
          this.detectedBoards.set(address, board);
          logger.info(`Found ${boardDef.name} at stack ${stack} (0x${address.toString(16)})`);
        }
      }
    }
    
    return boards;
  }

  // Check if a board exists at given stack position
  async checkBoardExists(command, stack) {
    try {
      // Try to read board info
      const { stdout } = await execAsync(`${command} ${stack} board`);
      return stdout.includes('rev') || stdout.includes('V');
    } catch (error) {
      // Board doesn't exist at this stack
      return false;
    }
  }

  // Read value from board based on configuration
  async readValue(config) {
    const { board_type, board_address, channel, input_range } = config;
    
    // board_address is the stack number, we need to find the board by stack
    let board = null;
    for (const [addr, b] of this.detectedBoards) {
      if (b.stack === board_address) {
        board = b;
        break;
      }
    }
    
    if (!board) {
      throw new Error(`Board not found at stack ${board_address}`);
    }

    let value;
    
    switch (board_type.toUpperCase()) {
      case 'MEGABAS':
      case 'MEGAIND':
        value = await this.readMegaBoard(board, channel, config.sensor_type);
        break;
        
      case '16UNIVIN':
        value = await this.read16UnivIn(board, channel, input_range);
        break;
        
      default:
        throw new Error(`Read not supported for board type: ${board_type}`);
    }
    
    return value;
  }

  // Read from MegaBAS/MegaIND boards
  async readMegaBoard(board, channel, sensorType) {
    try {
      let command;
      
      if (sensorType === 'voltage' || sensorType === 'current' || 
          sensorType === 'temperature' || sensorType === 'pressure' ||
          sensorType === 'flow' || sensorType === 'air_velocity' ||
          sensorType === 'differential_pressure') {
        // Analog input
        command = `${board.command} ${board.stack} aread ${channel}`;
      } else if (sensorType === 'digital') {
        // Digital input
        command = `${board.command} ${board.stack} dread ${channel}`;
      } else {
        throw new Error(`Unknown sensor type: ${sensorType}`);
      }
      
      const { stdout } = await execAsync(command);
      const value = parseFloat(stdout.trim());
      
      if (isNaN(value)) {
        throw new Error(`Invalid reading from board: ${stdout}`);
      }
      
      return value;
    } catch (error) {
      logger.error(`Error reading from ${board.name}:`, error);
      throw error;
    }
  }

  // Read from 16-UNIV-IN board
  async read16UnivIn(board, channel, inputRange) {
    try {
      let command;
      
      switch (inputRange) {
        case '0-10V':
          command = `${board.command} ${board.stack} uinrd ${channel}`;
          break;
          
        case '10K-2':
        case '10K-3':
          // Read resistance for 10K thermistor
          command = `${board.command} ${board.stack} 10kinrd ${channel}`;
          break;
          
        case '1K':
          // Read resistance for 1K thermistor
          command = `${board.command} ${board.stack} 1kinrd ${channel}`;
          break;
          
        case 'PT1000':
          // For PT1000, still read as 10K and convert
          command = `${board.command} ${board.stack} 10kinrd ${channel}`;
          break;
          
        default:
          throw new Error(`Unknown input range: ${inputRange}`);
      }
      
      const { stdout } = await execAsync(command);
      const value = parseFloat(stdout.trim());
      
      if (isNaN(value)) {
        throw new Error(`Invalid reading from board: ${stdout}`);
      }
      
      return value;
    } catch (error) {
      logger.error(`Error reading from 16-UNIV-IN:`, error);
      throw error;
    }
  }

  // Write to analog output
  async writeAnalog(boardType, stack, channel, value) {
    try {
      const board = BOARD_TYPES[boardType.toUpperCase()];
      if (!board) {
        throw new Error(`Unknown board type: ${boardType}`);
      }
      
      const command = `${board.command} ${stack} awrite ${channel} ${value}`;
      await execAsync(command);
      
      logger.debug(`Wrote ${value}V to ${boardType} stack ${stack} channel ${channel}`);
      return true;
    } catch (error) {
      logger.error(`Error writing to analog output:`, error);
      throw error;
    }
  }

  // Control relay output
  async writeRelay(boardType, stack, relay, state) {
    try {
      const board = BOARD_TYPES[boardType.toUpperCase()];
      if (!board) {
        throw new Error(`Unknown board type: ${boardType}`);
      }
      
      const command = `${board.command} ${stack} rwrite ${relay} ${state ? 1 : 0}`;
      await execAsync(command);
      
      logger.debug(`Set relay ${relay} to ${state} on ${boardType} stack ${stack}`);
      return true;
    } catch (error) {
      logger.error(`Error controlling relay:`, error);
      throw error;
    }
  }

  // Get board information
  async getBoardInfo(boardType, stack) {
    try {
      const board = BOARD_TYPES[boardType.toUpperCase()];
      if (!board) {
        throw new Error(`Unknown board type: ${boardType}`);
      }
      
      const { stdout } = await execAsync(`${board.command} ${stack} board`);
      
      // Parse board info
      const info = {
        type: boardType,
        stack: stack,
        address: board.baseAddress + stack,
        version: stdout.match(/rev\s*(\d+\.\d+)/i)?.[1] || 'unknown',
        capabilities: board.capabilities
      };
      
      return info;
    } catch (error) {
      logger.error(`Error getting board info:`, error);
      throw error;
    }
  }

  // Calibrate analog input
  async calibrateInput(boardType, stack, channel, refVoltage) {
    try {
      const board = BOARD_TYPES[boardType.toUpperCase()];
      if (!board) {
        throw new Error(`Unknown board type: ${boardType}`);
      }
      
      const command = `${board.command} ${stack} acal ${channel} ${refVoltage}`;
      await execAsync(command);
      
      logger.info(`Calibrated ${boardType} stack ${stack} channel ${channel} to ${refVoltage}V`);
      return true;
    } catch (error) {
      logger.error(`Error calibrating input:`, error);
      throw error;
    }
  }
}

module.exports = new SequentBoards();
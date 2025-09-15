/**
 * Demo Data Seeder for TiDB Cloud
 * Continuously generates and pushes demo data to TiDB for hackathon demo
 */

const demoDataGenerator = require('./demoDataGenerator');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

class DemoSeeder {
  constructor() {
    this.isRunning = false;
    this.interval = null;
    this.equipmentList = [
      { id: 'demo_rtu_1', equipment_type: 'RTU' },
      { id: 'demo_rtu_2', equipment_type: 'RTU' },
      { id: 'demo_chiller_1', equipment_type: 'Chiller' },
      { id: 'demo_ahu_1', equipment_type: 'AHU' },
      { id: 'demo_ahu_2', equipment_type: 'AHU' },
      { id: 'demo_pump_1', equipment_type: 'Pump' },
      { id: 'demo_fan_1', equipment_type: 'Fan' },
      { id: 'demo_compressor_1', equipment_type: 'Compressor' }
    ];
  }

  async start(intervalMs = 10000) {
    if (this.isRunning) {
      logger.info('Demo seeder already running');
      return;
    }

    this.isRunning = true;
    logger.info(`Starting demo data seeder (pushing to TiDB every ${intervalMs/1000}s)`);

    // Initial seed
    await this.seedData();

    // Continuous seeding
    this.interval = setInterval(async () => {
      await this.seedData();
    }, intervalMs);
  }

  async seedData() {
    try {
      logger.info('Seeding demo data to TiDB Cloud...');
      
      for (const equipment of this.equipmentList) {
        await demoDataGenerator.generateEquipmentData(
          equipment.id,
          equipment.equipment_type
        );
      }

      logger.info(`Successfully seeded data for ${this.equipmentList.length} equipment units`);
    } catch (error) {
      logger.error('Failed to seed demo data:', error);
    }
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    logger.info('Demo seeder stopped');
  }

  // Generate a burst of historical data for impressive demos
  async seedHistoricalBurst(hours = 24, dataPoints = 100) {
    logger.info(`Generating ${dataPoints} historical data points over ${hours} hours...`);
    
    const interval = (hours * 60) / dataPoints; // minutes between data points
    const now = Date.now();
    
    for (let i = dataPoints; i > 0; i--) {
      const timestamp = new Date(now - (i * interval * 60 * 1000));
      
      // Temporarily set the base time for consistent readings
      demoDataGenerator.baseTime = timestamp.getTime();
      
      for (const equipment of this.equipmentList) {
        await demoDataGenerator.generateEquipmentData(
          equipment.id,
          equipment.equipment_type
        );
      }
    }
    
    // Reset base time
    demoDataGenerator.baseTime = Date.now();
    logger.info('Historical data burst complete');
  }
}

module.exports = new DemoSeeder();
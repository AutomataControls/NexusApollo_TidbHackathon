#!/usr/bin/env node
/**
 * Database initialization script for Apollo Nexus
 * Creates PostgreSQL and SQLite databases with schema
 */

const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

console.log('Apollo Nexus Database Initialization');
console.log('====================================');

// PostgreSQL connection
const pgPool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: 'postgres', // Connect to default database first
  user: process.env.POSTGRES_USER || 'apollo',
  password: process.env.POSTGRES_PASS
});

async function initPostgreSQL() {
  console.log('Initializing PostgreSQL database...');
  
  try {
    // Create database if it doesn't exist
    const dbName = process.env.POSTGRES_DB || 'apollo_nexus';
    
    try {
      await pgPool.query(`CREATE DATABASE ${dbName}`);
      console.log(`Created database: ${dbName}`);
    } catch (err) {
      if (err.code === '42P04') {
        console.log(`Database ${dbName} already exists`);
      } else {
        throw err;
      }
    }
    
    // Close connection to postgres database
    await pgPool.end();
    
    // Connect to apollo_nexus database
    const apolloPool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT || 5432,
      database: dbName,
      user: process.env.POSTGRES_USER || 'apollo',
      password: process.env.POSTGRES_PASS
    });
    
    // Read and execute schema
    const schema = await fs.readFile(
      path.join(__dirname, '..', '..', 'database', 'schema.sql'),
      'utf8'
    );
    
    // Split schema into PostgreSQL portion
    const pgSchema = schema.split('-- SQLite schema')[0];
    
    // Execute each statement separately
    const statements = pgSchema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      try {
        await apolloPool.query(statement + ';');
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.error(`Error executing: ${statement.substring(0, 50)}...`);
          console.error(err.message);
        }
      }
    }
    
    console.log('PostgreSQL schema created successfully');
    
    // Insert default data
    await insertDefaultData(apolloPool);
    
    await apolloPool.end();
    
  } catch (err) {
    console.error('PostgreSQL initialization failed:', err);
    throw err;
  }
}

async function initSQLite() {
  console.log('\nInitializing SQLite database...');
  
  const dbPath = path.join(__dirname, '..', 'data', 'sensor_data.db');
  
  // Ensure data directory exists
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  
  const db = new sqlite3.Database(dbPath);
  
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create sensor_readings table
      db.run(`
        CREATE TABLE IF NOT EXISTS sensor_readings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          equipment_id INTEGER NOT NULL,
          timestamp REAL NOT NULL,
          sensor_values TEXT NOT NULL,
          fault_predictions TEXT,
          efficiency_prediction REAL,
          power_prediction REAL
        )
      `);
      
      // Create indexes
      db.run('CREATE INDEX IF NOT EXISTS idx_readings_equipment ON sensor_readings(equipment_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON sensor_readings(timestamp)');
      
      // Create sensor_trends table
      db.run(`
        CREATE TABLE IF NOT EXISTS sensor_trends (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          equipment_id INTEGER NOT NULL,
          timestamp INTEGER NOT NULL,
          sensor_averages TEXT NOT NULL,
          fault_counts TEXT,
          efficiency_avg REAL,
          power_avg REAL,
          UNIQUE(equipment_id, timestamp)
        )
      `);
      
      // Create indexes for trends
      db.run('CREATE INDEX IF NOT EXISTS idx_trends_equipment ON sensor_trends(equipment_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_trends_timestamp ON sensor_trends(timestamp)');
      
      db.close((err) => {
        if (err) {
          console.error('SQLite initialization failed:', err);
          reject(err);
        } else {
          console.log('SQLite database created successfully');
          resolve();
        }
      });
    });
  });
}

async function insertDefaultData(pool) {
  console.log('\nInserting default data...');
  
  try {
    // Check if admin user exists
    const userCheck = await pool.query("SELECT id FROM users WHERE username = 'admin'");
    
    if (userCheck.rows.length === 0) {
      // Create default admin user
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await pool.query(`
        INSERT INTO users (username, password, name, email, role)
        VALUES ($1, $2, $3, $4, $5)
      `, ['admin', hashedPassword, 'Administrator', 'admin@apollonexus.com', 'admin']);
      
      console.log('Created default admin user (username: admin, password: admin123)');
    }
    
    // Insert default system settings
    const settings = {
      general: {
        companyName: 'AutomataNexus',
        timezone: 'America/New_York',
        dateFormat: 'MM/DD/YYYY',
        temperatureUnit: 'F'
      },
      energy: {
        utilityProvider: 'Default Utility',
        kwhRate: 0.15,
        demandRate: 25.00,
        currency: 'USD',
        billingCycle: 'monthly'
      }
    };
    
    for (const [key, value] of Object.entries(settings)) {
      await pool.query(`
        INSERT INTO system_settings (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key) DO NOTHING
      `, [key, JSON.stringify(value)]);
    }
    
    console.log('Default settings inserted');
    
  } catch (err) {
    console.error('Error inserting default data:', err);
  }
}

// Run initialization
async function main() {
  try {
    await initPostgreSQL();
    await initSQLite();
    
    console.log('\n✅ Database initialization complete!');
    console.log('\nYou can now start the Apollo Nexus server with:');
    console.log('  npm start');
    
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Database initialization failed:', err);
    process.exit(1);
  }
}

main();
/**
 * Test TiDB Connection
 * Verifies connection to TiDB Cloud with proper SSL configuration
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testConnection() {
  console.log('🔍 Testing TiDB Cloud connection...\n');

  // Display connection parameters (without password)
  console.log('Connection parameters:');
  console.log(`  Host: ${process.env.TIDB_HOST}`);
  console.log(`  Port: ${process.env.TIDB_PORT || 4000}`);
  console.log(`  User: ${process.env.TIDB_USER}`);
  console.log(`  Database: ${process.env.TIDB_DATABASE || 'test'}`);
  console.log(`  CA Path: ${process.env.TIDB_CA_PATH}`);
  console.log('');

  // Check if CA certificate exists
  if (process.env.TIDB_CA_PATH) {
    if (fs.existsSync(process.env.TIDB_CA_PATH)) {
      console.log('✅ CA certificate found');
    } else {
      console.log('❌ CA certificate not found at specified path');
      process.exit(1);
    }
  }

  // Configure SSL
  let sslConfig = {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  };

  if (process.env.TIDB_CA_PATH && fs.existsSync(process.env.TIDB_CA_PATH)) {
    sslConfig.ca = fs.readFileSync(process.env.TIDB_CA_PATH);
    console.log('✅ CA certificate loaded\n');
  }

  try {
    // Create connection
    console.log('Attempting to connect...');
    const connection = await mysql.createConnection({
      host: process.env.TIDB_HOST,
      port: parseInt(process.env.TIDB_PORT) || 4000,
      user: process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      database: process.env.TIDB_DATABASE || 'test',
      ssl: sslConfig
    });

    console.log('✅ Connected to TiDB Cloud successfully!\n');

    // Test query
    const [rows] = await connection.execute('SELECT VERSION() as version');
    console.log('TiDB Version:', rows[0].version);

    // Check if tables exist
    console.log('\n📊 Checking vector tables:');
    const tables = [
      'fault_pattern_vectors',
      'model_inference_vectors',
      'sensor_embeddings',
      'solution_vectors'
    ];

    for (const table of tables) {
      try {
        const [result] = await connection.execute(
          `SELECT COUNT(*) as count FROM ${table}`
        );
        console.log(`  ✅ ${table}: ${result[0].count} records`);
      } catch (err) {
        console.log(`  ❌ ${table}: Table does not exist`);
      }
    }

    await connection.end();
    console.log('\n🎉 Connection test completed successfully!');

  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    console.error('\nError details:');
    console.error('  Code:', error.code);
    console.error('  Errno:', error.errno);
    console.error('  SQL State:', error.sqlState);
    console.error('  SQL Message:', error.sqlMessage);

    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n💡 Check your TiDB Cloud credentials:');
      console.log('  1. Username format should be: {prefix}.root');
      console.log('  2. Password should be copied exactly from TiDB Cloud console');
      console.log('  3. Make sure you\'re using the correct cluster');
    }

    process.exit(1);
  }
}

testConnection();
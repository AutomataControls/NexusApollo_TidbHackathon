#!/usr/bin/env node
/**
 * Fix TiDB Vector Tables with Correct Dimensions
 * This script drops and recreates the vector tables with proper dimensions
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const fs = require('fs');

async function fixTables() {
  console.log('Connecting to TiDB...');

  // Load CA certificate
  let sslConfig = {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  };

  if (process.env.TIDB_CA_PATH && fs.existsSync(process.env.TIDB_CA_PATH)) {
    sslConfig.ca = fs.readFileSync(process.env.TIDB_CA_PATH);
    console.log('Using CA certificate:', process.env.TIDB_CA_PATH);
  }

  const connection = await mysql.createConnection({
    host: process.env.TIDB_HOST,
    port: parseInt(process.env.TIDB_PORT) || 4000,
    user: process.env.TIDB_USER,
    password: process.env.TIDB_PASSWORD,
    database: process.env.TIDB_DATABASE || 'test',
    ssl: sslConfig
  });

  console.log('Connected to TiDB successfully');

  const sensorDim = parseInt(process.env.VECTOR_DIMENSION_SENSOR) || 1536;
  const modelDim = parseInt(process.env.VECTOR_DIMENSION_MODEL) || 256;

  console.log(`Using dimensions: sensor=${sensorDim}, model=${modelDim}`);

  try {
    // Drop existing tables
    console.log('Dropping existing tables...');
    await connection.execute('DROP TABLE IF EXISTS fault_pattern_vectors');
    await connection.execute('DROP TABLE IF EXISTS model_inference_vectors');
    await connection.execute('DROP TABLE IF EXISTS sensor_embeddings');
    await connection.execute('DROP TABLE IF EXISTS solution_vectors');

    // Recreate with correct dimensions
    console.log('Creating fault_pattern_vectors table...');
    await connection.execute(`
      CREATE TABLE fault_pattern_vectors (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        pattern_name VARCHAR(255) NOT NULL,
        pattern_vector VECTOR(${sensorDim}) NOT NULL COMMENT 'hnsw(distance=cosine)',
        specialist_model VARCHAR(50),
        severity INT,
        cost_impact DECIMAL(10,2),
        energy_impact DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Creating model_inference_vectors table...');
    await connection.execute(`
      CREATE TABLE model_inference_vectors (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        equipment_id INT,
        model_name VARCHAR(50),
        inference_vector VECTOR(${sensorDim}) NOT NULL COMMENT 'hnsw(distance=cosine)',
        fault_detected BOOLEAN,
        confidence DECIMAL(5,4),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Creating sensor_embeddings table...');
    await connection.execute(`
      CREATE TABLE sensor_embeddings (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        equipment_id INT NOT NULL,
        sensor_data JSON,
        embedding_vector VECTOR(${sensorDim}) NOT NULL COMMENT 'hnsw(distance=cosine)',
        anomaly_score DECIMAL(5,4),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_equipment_timestamp (equipment_id, timestamp)
      )
    `);

    console.log('Creating solution_vectors table...');
    await connection.execute(`
      CREATE TABLE solution_vectors (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        fault_type VARCHAR(100),
        solution_text TEXT,
        solution_vector VECTOR(${modelDim}) NOT NULL COMMENT 'hnsw(distance=cosine)',
        success_rate DECIMAL(5,2),
        avg_repair_time INT,
        parts_required JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Tables recreated successfully with correct dimensions!');

    // Add some sample data
    console.log('Adding sample fault patterns...');
    const patterns = [
      { name: 'Low Refrigerant', model: 'BOREAS', severity: 3, cost: 450, energy: 25 },
      { name: 'Dirty Filter', model: 'ZEPHYRUS', severity: 2, cost: 150, energy: 15 },
      { name: 'Compressor Failure', model: 'VULCAN', severity: 5, cost: 3500, energy: 40 },
      { name: 'Thermostat Malfunction', model: 'AQUILO', severity: 2, cost: 250, energy: 10 }
    ];

    for (const pattern of patterns) {
      const vector = new Array(sensorDim).fill(0).map(() => Math.random() * 2 - 1);
      const vectorStr = `[${vector.join(',')}]`;

      await connection.execute(
        `INSERT INTO fault_pattern_vectors
         (pattern_name, pattern_vector, specialist_model, severity, cost_impact, energy_impact)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [pattern.name, vectorStr, pattern.model, pattern.severity, pattern.cost, pattern.energy]
      );
    }

    console.log(`Added ${patterns.length} sample fault patterns`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
    console.log('Connection closed');
  }
}

fixTables().catch(console.error);
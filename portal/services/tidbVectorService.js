/**
 * TiDB Vector Service for Apollo Nexus
 * Implements vector search capabilities for HVAC diagnostics
 * Part of TiDB AgentX Hackathon submission
 */

const mysql = require('mysql2/promise');
const winston = require('winston');
const fs = require('fs');

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

class TiDBVectorService {
  constructor() {
    this.connection = null;

    // Load CA certificate if path is provided
    let sslConfig = {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true
    };

    if (process.env.TIDB_CA_PATH && fs.existsSync(process.env.TIDB_CA_PATH)) {
      sslConfig.ca = fs.readFileSync(process.env.TIDB_CA_PATH);
    }

    this.config = {
      host: process.env.TIDB_HOST,
      port: parseInt(process.env.TIDB_PORT) || 4000,
      user: process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      database: process.env.TIDB_DATABASE || 'test',
      ssl: sslConfig,
      waitForConnections: true,
      connectionLimit: 1, // Optimized for serverless as per TiDB docs
      maxIdle: 1,
      enableKeepAlive: true,
      queueLimit: 0
    };

    this.vectorDimensions = {
      sensor: parseInt(process.env.VECTOR_DIMENSION_SENSOR) || 1536,
      model: parseInt(process.env.VECTOR_DIMENSION_MODEL) || 256
    };
  }

  async connect() {
    try {
      if (!this.connection) {
        this.connection = await mysql.createPool(this.config);
        logger.info('Connected to TiDB Cloud successfully');

        // Initialize vector tables
        await this.initializeVectorTables();
      }
      return true;
    } catch (error) {
      logger.error('Failed to connect to TiDB:', error);
      throw error;
    }
  }

  async initializeVectorTables() {
    try {
      // Create fault pattern vectors table
      await this.connection.execute(`
        CREATE TABLE IF NOT EXISTS fault_pattern_vectors (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          pattern_name VARCHAR(255) NOT NULL,
          pattern_vector VECTOR(${this.vectorDimensions.sensor}) NOT NULL COMMENT 'hnsw(distance=cosine)',
          specialist_model VARCHAR(50),
          severity INT,
          cost_impact DECIMAL(10,2),
          energy_impact DECIMAL(10,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create model inference vectors table
      await this.connection.execute(`
        CREATE TABLE IF NOT EXISTS model_inference_vectors (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          equipment_id INT,
          model_name VARCHAR(50),
          inference_vector VECTOR(${this.vectorDimensions.sensor}) NOT NULL COMMENT 'hnsw(distance=cosine)',
          fault_detected BOOLEAN,
          confidence DECIMAL(5,4),
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create sensor embeddings table
      await this.connection.execute(`
        CREATE TABLE IF NOT EXISTS sensor_embeddings (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          equipment_id INT NOT NULL,
          sensor_data JSON,
          embedding_vector VECTOR(${this.vectorDimensions.sensor}) NOT NULL COMMENT 'hnsw(distance=cosine)',
          anomaly_score DECIMAL(5,4),
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_equipment_timestamp (equipment_id, timestamp)
        )
      `);

      // Create solution knowledge base
      await this.connection.execute(`
        CREATE TABLE IF NOT EXISTS solution_vectors (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          fault_type VARCHAR(100),
          solution_text TEXT,
          solution_vector VECTOR(${this.vectorDimensions.model}) NOT NULL COMMENT 'hnsw(distance=cosine)',
          success_rate DECIMAL(5,2),
          avg_repair_time INT,
          parts_required JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      logger.info('Vector tables initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize vector tables:', error);
      throw error;
    }
  }

  /**
   * Generate embedding vector from sensor data
   * Creates high-dimensional vector from sensor readings for TiDB vector search
   */
  generateSensorEmbedding(sensorData) {
    const dimensions = this.vectorDimensions.sensor;
    const vector = new Array(dimensions).fill(0);

    // Extract sensor values
    const values = [];
    for (const [key, value] of Object.entries(sensorData)) {
      if (typeof value === 'number') {
        values.push(value);
      }
    }

    // If we have sensor values, distribute them across the vector
    if (values.length > 0) {
      // Use sensor values to generate a pseudo-random but deterministic embedding
      for (let i = 0; i < dimensions; i++) {
        let sum = 0;
        for (let j = 0; j < values.length; j++) {
          // Create different combinations of sensor values for each dimension
          sum += values[j] * Math.sin((i + 1) * (j + 1) * Math.PI / dimensions);
        }
        // Normalize to [-1, 1] range
        vector[i] = Math.tanh(sum / values.length);
      }
    } else {
      // Random vector if no sensor data
      for (let i = 0; i < dimensions; i++) {
        vector[i] = Math.random() * 2 - 1;
      }
    }

    return this.normalizeVector(vector);
  }

  extractFeatures(sensorData) {
    const features = [];

    // Primary sensor features
    if (sensorData.supply_air_temp) features.push(sensorData.supply_air_temp);
    if (sensorData.return_air_temp) features.push(sensorData.return_air_temp);
    if (sensorData.outside_air_temp) features.push(sensorData.outside_air_temp);
    if (sensorData.mixed_air_temp) features.push(sensorData.mixed_air_temp);
    if (sensorData.supply_air_pressure) features.push(sensorData.supply_air_pressure);
    if (sensorData.return_air_pressure) features.push(sensorData.return_air_pressure);
    if (sensorData.compressor_current) features.push(sensorData.compressor_current);
    if (sensorData.fan_motor_current) features.push(sensorData.fan_motor_current);
    if (sensorData.power_consumption) features.push(sensorData.power_consumption);

    // Derived features
    if (sensorData.supply_air_temp && sensorData.return_air_temp) {
      features.push(sensorData.supply_air_temp - sensorData.return_air_temp); // Delta T
    }

    // Add padding if needed
    while (features.length < 128) {
      features.push(0);
    }

    return features;
  }

  applyTransformations(features) {
    const transformed = [...features];

    // Apply Fourier transform for frequency domain features
    for (let i = 0; i < features.length; i++) {
      const freq = Math.sin(2 * Math.PI * i / features.length) * features[i];
      transformed.push(freq);
    }

    // Add random projections for non-linear relationships
    for (let i = 0; i < 256; i++) {
      let projection = 0;
      for (let j = 0; j < features.length; j++) {
        projection += features[j] * Math.sin(i * j);
      }
      transformed.push(projection);
    }

    return transformed;
  }

  normalizeVector(vector) {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  }

  /**
   * Store sensor embedding in TiDB
   */
  async storeSensorEmbedding(equipmentId, sensorData, embedding) {
    try {
      const vectorStr = `[${embedding.join(',')}]`;

      await this.connection.execute(
        `INSERT INTO sensor_embeddings
         (equipment_id, sensor_data, embedding_vector, anomaly_score)
         VALUES (?, ?, ?, ?)`,
        [
          equipmentId,
          JSON.stringify(sensorData),
          vectorStr,
          this.calculateAnomalyScore(embedding)
        ]
      );

      return true;
    } catch (error) {
      logger.error('Failed to store sensor embedding:', error);
      throw error;
    }
  }

  /**
   * Find similar fault patterns using vector search
   */
  async findSimilarPatterns(modelName, sensorVector, limit = 10) {
    try {
      const vectorStr = `[${sensorVector.join(',')}]`;
      const limitNum = parseInt(limit) || 10;

      const [rows] = await this.connection.execute(
        `SELECT
          pattern_name,
          specialist_model,
          severity,
          cost_impact,
          energy_impact,
          VEC_COSINE_DISTANCE(pattern_vector, ?) as distance
         FROM fault_pattern_vectors
         WHERE specialist_model = ? OR specialist_model IS NULL
         ORDER BY distance
         LIMIT ${limitNum}`,
        [vectorStr, modelName]
      );

      return rows;
    } catch (error) {
      logger.error('Failed to find similar patterns:', error);
      throw error;
    }
  }

  /**
   * Search historical sensor data for similar conditions
   */
  async searchHistoricalConditions(embedding, equipmentId, hoursBack = 168) {
    try {
      const vectorStr = `[${embedding.join(',')}]`;
      const hoursNum = parseInt(hoursBack) || 168;

      const [rows] = await this.connection.execute(
        `SELECT
          id,
          sensor_data,
          anomaly_score,
          timestamp,
          VEC_L2_DISTANCE(embedding_vector, ?) as distance
         FROM sensor_embeddings
         WHERE equipment_id = ?
         AND timestamp > DATE_SUB(NOW(), INTERVAL ${hoursNum} HOUR)
         ORDER BY distance
         LIMIT 20`,
        [vectorStr, parseInt(equipmentId) || 1]
      );

      return rows;
    } catch (error) {
      logger.error('Failed to search historical conditions:', error);
      throw error;
    }
  }

  /**
   * Store model inference with vector
   */
  async storeModelInference(equipmentId, modelName, inferenceVector, faultDetected, confidence) {
    try {
      const vectorStr = `[${inferenceVector.join(',')}]`;

      await this.connection.execute(
        `INSERT INTO model_inference_vectors
         (equipment_id, model_name, inference_vector, fault_detected, confidence)
         VALUES (?, ?, ?, ?, ?)`,
        [equipmentId, modelName, vectorStr, faultDetected, confidence]
      );

      return true;
    } catch (error) {
      logger.error('Failed to store model inference:', error);
      throw error;
    }
  }

  /**
   * Find solutions for detected faults
   */
  async findSolutions(faultType, limit = 5) {
    try {
      // Generate a simple embedding for the fault type
      const faultVector = this.generateFaultEmbedding(faultType);
      const vectorStr = `[${faultVector.join(',')}]`;
      const limitNum = parseInt(limit) || 5;

      const [rows] = await this.connection.execute(
        `SELECT
          fault_type,
          solution_text,
          success_rate,
          avg_repair_time,
          parts_required,
          VEC_COSINE_DISTANCE(solution_vector, ?) as distance
         FROM solution_vectors
         WHERE fault_type LIKE ?
         ORDER BY distance, success_rate DESC
         LIMIT ${limitNum}`,
        [vectorStr, `%${faultType}%`]
      );

      return rows;
    } catch (error) {
      logger.error('Failed to find solutions:', error);
      throw error;
    }
  }

  generateFaultEmbedding(faultType) {
    const dimensions = this.vectorDimensions.model;
    const vector = new Array(dimensions).fill(0);

    // Generate deterministic embedding based on fault type string
    for (let i = 0; i < dimensions; i++) {
      let hash = 0;
      for (let j = 0; j < faultType.length; j++) {
        hash += faultType.charCodeAt(j) * Math.sin((i + 1) * (j + 1) * Math.PI / dimensions);
      }
      vector[i] = Math.tanh(hash / faultType.length);
    }

    return this.normalizeVector(vector);
  }

  calculateAnomalyScore(embedding) {
    // Simple anomaly score based on vector magnitude deviation
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    const expectedMagnitude = Math.sqrt(embedding.length);
    return Math.min(1, Math.abs(magnitude - expectedMagnitude) / expectedMagnitude);
  }

  /**
   * Get vector search statistics
   */
  async getVectorStats() {
    try {
      const [patterns] = await this.connection.execute(
        'SELECT COUNT(*) as count FROM fault_pattern_vectors'
      );

      const [embeddings] = await this.connection.execute(
        'SELECT COUNT(*) as count FROM sensor_embeddings'
      );

      const [inferences] = await this.connection.execute(
        'SELECT COUNT(*) as count FROM model_inference_vectors'
      );

      const [solutions] = await this.connection.execute(
        'SELECT COUNT(*) as count FROM solution_vectors'
      );

      return {
        patterns: patterns[0].count,
        embeddings: embeddings[0].count,
        inferences: inferences[0].count,
        solutions: solutions[0].count
      };
    } catch (error) {
      logger.error('Failed to get vector stats:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
      logger.info('Disconnected from TiDB');
    }
  }
}

module.exports = new TiDBVectorService();
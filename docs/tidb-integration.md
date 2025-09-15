# TiDB Cloud Integration Guide

## Overview

Nexus Apollo integrates with TiDB Cloud's serverless vector database for advanced fault pattern matching and similarity search. The system uses Hierarchical Navigable Small World (HNSW) indexing for ultra-fast vector searches across historical HVAC fault data.

## TiDB Cloud Setup

### 1. Cluster Configuration

- **Cluster Type**: Serverless Tier
- **Region**: AWS us-east-1 (N. Virginia)
- **Vector Dimensions**: 384 (all-MiniLM-L6-v2 embeddings)
- **Index Type**: HNSW with cosine similarity
- **Connection Method**: Public endpoint with SSL

### 2. Connection Details

```javascript
// Connection configuration
const tidbConfig = {
  host: 'gateway01.us-east-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: 'BXtyZ4HePSFkmJW.root',
  password: process.env.TIDB_PASSWORD, // Stored securely
  database: 'apollo_vector',
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  }
};
```

## Database Schema

### 1. Vector Tables

```sql
-- Equipment fault patterns table
CREATE TABLE equipment_fault_patterns (
  id INT PRIMARY KEY AUTO_INCREMENT,
  equipment_type VARCHAR(50) NOT NULL,
  fault_code VARCHAR(20) NOT NULL,
  fault_description TEXT,
  symptoms TEXT,
  resolution TEXT,
  embedding VECTOR(384) NOT NULL COMMENT 'all-MiniLM-L6-v2 embedding',
  severity ENUM('critical', 'warning', 'info') DEFAULT 'warning',
  occurrence_count INT DEFAULT 0,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_equipment_type (equipment_type),
  INDEX idx_fault_code (fault_code),
  VECTOR INDEX idx_embedding (embedding) USING HNSW
);

-- Historical sensor patterns
CREATE TABLE sensor_patterns (
  id INT PRIMARY KEY AUTO_INCREMENT,
  pattern_id VARCHAR(36) UNIQUE,
  equipment_id INT,
  pattern_type VARCHAR(50),
  sensor_data JSON,
  pattern_embedding VECTOR(384),
  anomaly_score FLOAT,
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  VECTOR INDEX idx_pattern (pattern_embedding) USING HNSW
);

-- Maintenance knowledge base
CREATE TABLE maintenance_kb (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255),
  content TEXT,
  category VARCHAR(50),
  tags JSON,
  content_embedding VECTOR(384),
  relevance_score FLOAT DEFAULT 0,
  view_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  VECTOR INDEX idx_content (content_embedding) USING HNSW
);
```

### 2. HNSW Index Configuration

```sql
-- Configure HNSW parameters for optimal performance
ALTER TABLE equipment_fault_patterns
SET tiflash replica 1;

-- Set HNSW specific parameters
SET GLOBAL tidb_vector_index_ef_construction = 200;  -- Higher = better accuracy, slower build
SET GLOBAL tidb_vector_index_m = 16;  -- Number of bi-directional links
SET GLOBAL tidb_vector_index_ef_search = 100;  -- Search accuracy parameter
```

## Vector Embedding Generation

### 1. Text Embedding Service

```javascript
// services/embeddingService.js
const { pipeline } = require('@xenova/transformers');

class EmbeddingService {
  constructor() {
    this.model = null;
    this.modelName = 'Xenova/all-MiniLM-L6-v2';
  }

  async initialize() {
    // Load the embedding model
    this.model = await pipeline('feature-extraction', this.modelName);
  }

  async generateEmbedding(text) {
    if (!this.model) {
      await this.initialize();
    }

    // Generate embedding
    const output = await this.model(text, {
      pooling: 'mean',
      normalize: true
    });

    // Convert to array and ensure 384 dimensions
    const embedding = Array.from(output.data);
    if (embedding.length !== 384) {
      throw new Error(`Invalid embedding dimension: ${embedding.length}`);
    }

    return embedding;
  }

  async batchEmbed(texts) {
    const embeddings = [];
    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      embeddings.push(embedding);
    }
    return embeddings;
  }
}

module.exports = new EmbeddingService();
```

### 2. Fault Pattern Embedding

```javascript
// services/faultPatternService.js
const embeddingService = require('./embeddingService');
const tidbClient = require('./tidbClient');

async function addFaultPattern(equipmentType, faultData) {
  // Combine relevant text for embedding
  const textToEmbed = `
    Equipment: ${equipmentType}
    Fault: ${faultData.code} - ${faultData.description}
    Symptoms: ${faultData.symptoms}
    Resolution: ${faultData.resolution}
  `.trim();

  // Generate embedding
  const embedding = await embeddingService.generateEmbedding(textToEmbed);

  // Store in TiDB
  const query = `
    INSERT INTO equipment_fault_patterns
    (equipment_type, fault_code, fault_description, symptoms, resolution, embedding, severity)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  await tidbClient.execute(query, [
    equipmentType,
    faultData.code,
    faultData.description,
    faultData.symptoms,
    faultData.resolution,
    JSON.stringify(embedding),
    faultData.severity || 'warning'
  ]);
}
```

## Vector Search Implementation

### 1. Similarity Search

```javascript
// services/vectorSearch.js
const tidbClient = require('./tidbClient');
const embeddingService = require('./embeddingService');

class VectorSearchService {
  async searchSimilarFaults(query, equipmentType = null, limit = 10) {
    // Generate query embedding
    const queryEmbedding = await embeddingService.generateEmbedding(query);

    // Build SQL query with vector search
    let sql = `
      SELECT
        id,
        equipment_type,
        fault_code,
        fault_description,
        symptoms,
        resolution,
        severity,
        VEC_COSINE_DISTANCE(embedding, ?) as distance
      FROM equipment_fault_patterns
    `;

    const params = [JSON.stringify(queryEmbedding)];

    if (equipmentType) {
      sql += ' WHERE equipment_type = ?';
      params.push(equipmentType);
    }

    sql += `
      ORDER BY distance ASC
      LIMIT ?
    `;
    params.push(limit);

    const results = await tidbClient.execute(sql, params);

    // Convert distance to similarity score (1 - distance for cosine)
    return results.map(row => ({
      ...row,
      similarity: 1 - row.distance,
      confidence: this.calculateConfidence(1 - row.distance)
    }));
  }

  calculateConfidence(similarity) {
    // Map similarity to confidence with threshold
    if (similarity > 0.9) return 'high';
    if (similarity > 0.7) return 'medium';
    return 'low';
  }

  async hybridSearch(query, filters = {}) {
    // Combine vector search with metadata filtering
    const queryEmbedding = await embeddingService.generateEmbedding(query);

    let sql = `
      SELECT
        *,
        VEC_COSINE_DISTANCE(embedding, ?) as distance
      FROM equipment_fault_patterns
      WHERE 1=1
    `;

    const params = [JSON.stringify(queryEmbedding)];

    // Add filters
    if (filters.equipmentType) {
      sql += ' AND equipment_type = ?';
      params.push(filters.equipmentType);
    }

    if (filters.severity) {
      sql += ' AND severity = ?';
      params.push(filters.severity);
    }

    if (filters.minOccurrences) {
      sql += ' AND occurrence_count >= ?';
      params.push(filters.minOccurrences);
    }

    sql += ' ORDER BY distance ASC LIMIT 20';

    return await tidbClient.execute(sql, params);
  }
}

module.exports = new VectorSearchService();
```

### 2. Anomaly Detection

```javascript
// services/anomalyDetection.js
async function detectAnomalies(sensorData) {
  // Convert sensor data to embedding
  const sensorText = formatSensorData(sensorData);
  const embedding = await embeddingService.generateEmbedding(sensorText);

  // Search for similar historical patterns
  const sql = `
    SELECT
      pattern_id,
      anomaly_score,
      VEC_COSINE_DISTANCE(pattern_embedding, ?) as distance
    FROM sensor_patterns
    WHERE VEC_COSINE_DISTANCE(pattern_embedding, ?) < 0.3
    ORDER BY distance ASC
    LIMIT 5
  `;

  const results = await tidbClient.execute(sql, [
    JSON.stringify(embedding),
    JSON.stringify(embedding)
  ]);

  // If no similar patterns found, it's potentially anomalous
  if (results.length === 0) {
    return {
      isAnomaly: true,
      confidence: 0.9,
      message: 'Unusual pattern detected - no historical match'
    };
  }

  // Calculate anomaly score based on nearest neighbors
  const avgDistance = results.reduce((sum, r) => sum + r.distance, 0) / results.length;
  const isAnomaly = avgDistance > 0.15;

  return {
    isAnomaly,
    confidence: isAnomaly ? avgDistance * 2 : 1 - avgDistance,
    similarPatterns: results,
    message: isAnomaly ? 'Potential anomaly detected' : 'Normal operation'
  };
}
```

## API Integration

### 1. REST Endpoints

```javascript
// routes/vectorSearch.js
const express = require('express');
const router = express.Router();
const vectorSearch = require('../services/vectorSearch');

// Search for similar faults
router.post('/search', async (req, res) => {
  try {
    const { query, equipmentType, limit = 10 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const results = await vectorSearch.searchSimilarFaults(
      query,
      equipmentType,
      limit
    );

    res.json({
      success: true,
      results,
      count: results.length,
      query
    });
  } catch (error) {
    console.error('Vector search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Add new fault pattern
router.post('/patterns', async (req, res) => {
  try {
    const { equipmentType, fault } = req.body;
    await addFaultPattern(equipmentType, fault);
    res.json({ success: true, message: 'Pattern added successfully' });
  } catch (error) {
    console.error('Pattern addition error:', error);
    res.status(500).json({ error: 'Failed to add pattern' });
  }
});

// Get pattern statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await tidbClient.execute(`
      SELECT
        COUNT(*) as total_patterns,
        COUNT(DISTINCT equipment_type) as equipment_types,
        AVG(occurrence_count) as avg_occurrences
      FROM equipment_fault_patterns
    `);

    res.json(stats[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

module.exports = router;
```

### 2. WebSocket Real-time Search

```javascript
// websocket/vectorSearchSocket.js
module.exports = (io) => {
  io.on('connection', (socket) => {
    // Real-time vector search
    socket.on('vector:search', async (data) => {
      try {
        const { query, equipmentType } = data;

        // Perform search
        const results = await vectorSearch.searchSimilarFaults(
          query,
          equipmentType,
          5
        );

        // Emit results
        socket.emit('vector:results', {
          query,
          results,
          timestamp: new Date()
        });
      } catch (error) {
        socket.emit('vector:error', {
          message: 'Search failed',
          error: error.message
        });
      }
    });

    // Continuous anomaly monitoring
    socket.on('vector:monitor', async (data) => {
      const { equipmentId } = data;

      // Set up periodic checking
      const interval = setInterval(async () => {
        try {
          // Get latest sensor data
          const sensorData = await getSensorData(equipmentId);

          // Check for anomalies
          const anomalyResult = await detectAnomalies(sensorData);

          if (anomalyResult.isAnomaly) {
            socket.emit('vector:anomaly', {
              equipmentId,
              ...anomalyResult,
              timestamp: new Date()
            });
          }
        } catch (error) {
          console.error('Anomaly detection error:', error);
        }
      }, 5000); // Check every 5 seconds

      // Clean up on disconnect
      socket.on('disconnect', () => {
        clearInterval(interval);
      });
    });
  });
};
```

## Performance Optimization

### 1. Connection Pooling

```javascript
// config/tidbPool.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'gateway01.us-east-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: 'BXtyZ4HePSFkmJW.root',
  password: process.env.TIDB_PASSWORD,
  database: 'apollo_vector',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  }
});

module.exports = pool;
```

### 2. Caching Strategy

```javascript
// services/vectorCache.js
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 }); // 10 minute cache

class VectorCache {
  generateKey(query, equipmentType) {
    return `vector:${equipmentType || 'all'}:${query.toLowerCase()}`;
  }

  async get(query, equipmentType) {
    const key = this.generateKey(query, equipmentType);
    return cache.get(key);
  }

  async set(query, equipmentType, results) {
    const key = this.generateKey(query, equipmentType);
    cache.set(key, results);
  }

  flush() {
    cache.flushAll();
  }

  getStats() {
    return cache.getStats();
  }
}

module.exports = new VectorCache();
```

### 3. Batch Processing

```javascript
// services/batchProcessor.js
class BatchProcessor {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.batchSize = 50;
    this.interval = 5000; // 5 seconds
  }

  async addToQueue(data) {
    this.queue.push(data);

    if (this.queue.length >= this.batchSize) {
      await this.processBatch();
    }
  }

  async processBatch() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const batch = this.queue.splice(0, this.batchSize);

    try {
      // Generate embeddings in batch
      const texts = batch.map(item => item.text);
      const embeddings = await embeddingService.batchEmbed(texts);

      // Prepare batch insert
      const values = batch.map((item, index) => [
        item.equipmentType,
        item.faultCode,
        item.description,
        JSON.stringify(embeddings[index])
      ]);

      // Batch insert to TiDB
      await tidbClient.batchInsert(
        'equipment_fault_patterns',
        ['equipment_type', 'fault_code', 'fault_description', 'embedding'],
        values
      );

    } catch (error) {
      console.error('Batch processing error:', error);
      // Re-queue failed items
      this.queue.unshift(...batch);
    } finally {
      this.processing = false;
    }
  }

  startAutoProcess() {
    setInterval(() => this.processBatch(), this.interval);
  }
}

module.exports = new BatchProcessor();
```

## Monitoring and Metrics

### 1. Query Performance Tracking

```javascript
// middleware/vectorMetrics.js
const prometheus = require('prom-client');

// Create metrics
const searchDuration = new prometheus.Histogram({
  name: 'tidb_vector_search_duration_seconds',
  help: 'Duration of vector search queries',
  labelNames: ['equipment_type', 'result_count']
});

const searchCounter = new prometheus.Counter({
  name: 'tidb_vector_searches_total',
  help: 'Total number of vector searches',
  labelNames: ['equipment_type']
});

const embeddingDuration = new prometheus.Histogram({
  name: 'embedding_generation_duration_seconds',
  help: 'Duration of embedding generation'
});

// Middleware
function trackVectorSearch(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;

    if (req.path.includes('/search')) {
      searchDuration.observe(
        {
          equipment_type: req.body?.equipmentType || 'all',
          result_count: res.locals?.resultCount || 0
        },
        duration
      );

      searchCounter.inc({
        equipment_type: req.body?.equipmentType || 'all'
      });
    }
  });

  next();
}

module.exports = { trackVectorSearch, searchDuration, searchCounter, embeddingDuration };
```

### 2. Health Checks

```javascript
// services/tidbHealth.js
async function checkTiDBHealth() {
  try {
    // Test basic connectivity
    const start = Date.now();
    await tidbClient.execute('SELECT 1');
    const pingTime = Date.now() - start;

    // Check vector index status
    const indexStatus = await tidbClient.execute(`
      SELECT
        TABLE_NAME,
        INDEX_NAME,
        CARDINALITY
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE INDEX_NAME LIKE '%vector%'
    `);

    // Get table statistics
    const tableStats = await tidbClient.execute(`
      SELECT
        TABLE_NAME,
        TABLE_ROWS,
        AVG_ROW_LENGTH,
        DATA_LENGTH
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'apollo_vector'
    `);

    return {
      status: 'healthy',
      pingTime,
      indexStatus,
      tableStats,
      timestamp: new Date()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date()
    };
  }
}

module.exports = { checkTiDBHealth };
```

## Troubleshooting

### Common Issues

1. **Slow Vector Searches**
   - Check HNSW index parameters
   - Verify embedding dimensions match (384)
   - Consider increasing `ef_search` parameter
   - Monitor TiDB Cloud metrics dashboard

2. **Connection Timeouts**
   - Verify SSL certificate validity
   - Check network connectivity to TiDB Cloud
   - Increase connection timeout settings
   - Use connection pooling

3. **Embedding Dimension Mismatch**
   - Ensure all embeddings are 384 dimensions
   - Validate embedding model output
   - Check for truncation in storage

4. **High Memory Usage**
   - Implement result pagination
   - Use streaming for large result sets
   - Optimize embedding cache size
   - Monitor model memory usage

## Best Practices

1. **Embedding Quality**
   - Use consistent text preprocessing
   - Include relevant context in embedding text
   - Regularly update embedding model
   - Validate embedding quality with test queries

2. **Search Optimization**
   - Pre-filter with metadata before vector search
   - Use appropriate distance thresholds
   - Implement result caching for common queries
   - Batch similar searches together

3. **Data Management**
   - Regularly clean up old patterns
   - Update occurrence counts for patterns
   - Maintain embedding version consistency
   - Backup vector data regularly

4. **Security**
   - Use environment variables for credentials
   - Implement rate limiting on search endpoints
   - Validate and sanitize search queries
   - Monitor for unusual search patterns
const express = require('express');
const router = express.Router();
const winston = require('winston');

// Get database connections from server module
let pgPool;
setTimeout(() => {
  const server = require('../../server');
  pgPool = server.pgPool;
  
  // Create table if it doesn't exist
  createAIConfigTable();
}, 0);

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

async function createAIConfigTable() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ai_model_configs (
        id SERIAL PRIMARY KEY,
        equipment_id INTEGER NOT NULL,
        apollo_enabled BOOLEAN DEFAULT true,
        aquilo_enabled BOOLEAN DEFAULT true,
        boreas_enabled BOOLEAN DEFAULT true,
        naiad_enabled BOOLEAN DEFAULT true,
        vulcan_enabled BOOLEAN DEFAULT true,
        zephyrus_enabled BOOLEAN DEFAULT true,
        colossus_enabled BOOLEAN DEFAULT true,
        gaia_enabled BOOLEAN DEFAULT true,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(equipment_id)
      )
    `;
    
    await pgPool.query(createTableQuery);
    logger.info('AI model configs table ready');
  } catch (err) {
    logger.error('Error creating AI model configs table:', err);
  }
}

// GET /api/ai-models/config/:equipmentId
router.get('/config/:equipmentId', async (req, res) => {
  try {
    const { equipmentId } = req.params;
    
    // Try to get existing config
    let result = await pgPool.query(
      'SELECT * FROM ai_model_configs WHERE equipment_id = $1',
      [equipmentId]
    );
    
    // If no config exists, create default (all enabled)
    if (result.rows.length === 0) {
      const insertQuery = `
        INSERT INTO ai_model_configs (
          equipment_id, apollo_enabled, aquilo_enabled, boreas_enabled,
          naiad_enabled, vulcan_enabled, zephyrus_enabled, colossus_enabled, gaia_enabled
        ) VALUES ($1, true, true, true, true, true, true, true, true)
        RETURNING *
      `;
      result = await pgPool.query(insertQuery, [equipmentId]);
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error fetching AI model config:', err);
    res.status(500).json({ error: 'Failed to fetch AI model configuration' });
  }
});

// POST /api/ai-models/config/:equipmentId
router.post('/config/:equipmentId', async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const {
      apollo_enabled,
      aquilo_enabled,
      boreas_enabled,
      naiad_enabled,
      vulcan_enabled,
      zephyrus_enabled,
      colossus_enabled,
      gaia_enabled
    } = req.body;
    
    const upsertQuery = `
      INSERT INTO ai_model_configs (
        equipment_id, apollo_enabled, aquilo_enabled, boreas_enabled,
        naiad_enabled, vulcan_enabled, zephyrus_enabled, colossus_enabled, 
        gaia_enabled, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (equipment_id) 
      DO UPDATE SET
        apollo_enabled = $2,
        aquilo_enabled = $3,
        boreas_enabled = $4,
        naiad_enabled = $5,
        vulcan_enabled = $6,
        zephyrus_enabled = $7,
        colossus_enabled = $8,
        gaia_enabled = $9,
        updated_at = NOW()
      RETURNING *
    `;
    
    const result = await pgPool.query(upsertQuery, [
      equipmentId,
      apollo_enabled,
      aquilo_enabled,
      boreas_enabled,
      naiad_enabled,
      vulcan_enabled,
      zephyrus_enabled,
      colossus_enabled,
      gaia_enabled
    ]);
    
    logger.info(`Updated AI model config for equipment ${equipmentId}`);
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error updating AI model config:', err);
    res.status(500).json({ error: 'Failed to update AI model configuration' });
  }
});

module.exports = router;
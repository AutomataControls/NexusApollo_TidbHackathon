const express = require('express');
const router = express.Router();
const winston = require('winston');
const { Parser } = require('json2csv');
const jwt = require('jsonwebtoken');

// Get database connections from server module
let pgPool, sensorDb;
setTimeout(() => {
  const server = require('../../server');
  pgPool = server.pgPool;
  sensorDb = server.sensorDb;
}, 0);

// TiDB service
const tidbService = require('../../services/tidbVectorService');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Authentication middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Get database info - tables and schemas
router.get('/info', authenticate, async (req, res) => {
  try {
    const pgTables = await pgPool.query(`
      SELECT 
        table_name as name,
        'postgres' as type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const sqliteTables = await new Promise((resolve, reject) => {
      sensorDb.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(r => ({ name: r.name, type: 'sqlite' })));
      });
    });

    res.json([...pgTables.rows, ...sqliteTables]);
  } catch (error) {
    logger.error('Failed to fetch database info:', error);
    res.status(500).json({ error: 'Failed to fetch database info' });
  }
});

// Query table data with pagination
router.get('/query', authenticate, async (req, res) => {
  try {
    const { table, page = 1, limit = 50, db = 'postgres', search } = req.query;
    const offset = (page - 1) * limit;
    const limitNum = parseInt(limit) || 50;
    const pageNum = parseInt(page) || 1;

    if (!table) {
      return res.status(400).json({ error: 'Table name required' });
    }

    // Sanitize table name to prevent SQL injection
    const validTableName = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table);
    if (!validTableName) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    let rows = [];
    let total = 0;

    if (db === 'tidb') {
      // TiDB query
      try {
        // Ensure TiDB is connected
        if (!tidbService.connection) {
          await tidbService.connect();
        }

        // For TiDB, we'll query the vector tables
        let query = `SELECT * FROM ${table}`;
        let countQuery = `SELECT COUNT(*) as count FROM ${table}`;
        const params = [];

        if (search) {
          // Add basic search on pattern_name or other text fields
          if (table === 'fault_pattern_vectors') {
            query += ` WHERE pattern_name LIKE ?`;
            countQuery += ` WHERE pattern_name LIKE ?`;
            params.push(`%${search}%`);
          } else if (table === 'solution_vectors') {
            query += ` WHERE fault_type LIKE ? OR solution_text LIKE ?`;
            countQuery += ` WHERE fault_type LIKE ? OR solution_text LIKE ?`;
            params.push(`%${search}%`, `%${search}%`);
          }
        }

        // Get total count
        const [countResult] = await tidbService.connection.execute(countQuery, params);
        total = countResult[0].count;

        // Get paginated data with explicit LIMIT values
        query += ` LIMIT ${limitNum} OFFSET ${offset}`;
        const [dataResult] = await tidbService.connection.execute(query, params);

        // Process vector fields for display
        rows = dataResult.map(row => {
          const processedRow = { ...row };
          // Convert vector fields to readable format
          if (processedRow.pattern_vector) {
            processedRow.pattern_vector = `[${processedRow.pattern_vector.length} dimensions]`;
          }
          if (processedRow.inference_vector) {
            processedRow.inference_vector = `[${processedRow.inference_vector.length} dimensions]`;
          }
          if (processedRow.embedding_vector) {
            processedRow.embedding_vector = `[${processedRow.embedding_vector.length} dimensions]`;
          }
          if (processedRow.solution_vector) {
            processedRow.solution_vector = `[${processedRow.solution_vector.length} dimensions]`;
          }
          return processedRow;
        });
      } catch (tidbError) {
        logger.error('TiDB query failed:', tidbError);
        return res.status(500).json({ error: 'TiDB query failed: ' + tidbError.message });
      }
    } else if (db === 'postgres') {
      // PostgreSQL query
      let whereClause = '';
      const params = [];
      
      if (search) {
        // Get column names first
        const columnsResult = await pgPool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1
        `, [table]);
        
        const searchConditions = columnsResult.rows.map((col, index) => {
          params.push(`%${search}%`);
          return `CAST(${col.column_name} AS TEXT) ILIKE $${index + 1}`;
        });
        
        if (searchConditions.length > 0) {
          whereClause = `WHERE ${searchConditions.join(' OR ')}`;
        }
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM ${table} ${whereClause}`;
      const countResult = await pgPool.query(countQuery, params);
      total = parseInt(countResult.rows[0].count);

      // Get paginated data
      params.push(limit, offset);
      const dataQuery = `
        SELECT * FROM ${table} 
        ${whereClause}
        ORDER BY 1
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `;
      const dataResult = await pgPool.query(dataQuery, params);
      rows = dataResult.rows;
      
    } else if (db === 'sqlite') {
      // SQLite query
      await new Promise((resolve, reject) => {
        let whereClause = '';
        const params = [];
        
        if (search) {
          // For SQLite, we'll do a simple search on all columns
          whereClause = `WHERE `;
          // This is simplified - in production, you'd want to get column names first
          params.push(`%${search}%`);
        }
        
        // Get total count
        const countQuery = `SELECT COUNT(*) as count FROM ${table} ${whereClause}`;
        sensorDb.get(countQuery, params, (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          total = row.count;
          
          // Get paginated data
          const dataQuery = `
            SELECT * FROM ${table}
            ${whereClause}
            LIMIT ? OFFSET ?
          `;
          sensorDb.all(dataQuery, [...params, limit, offset], (err, data) => {
            if (err) reject(err);
            else {
              rows = data;
              resolve();
            }
          });
        });
      });
    }

    res.json({ rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    logger.error('Query failed:', error);
    res.status(500).json({ error: 'Query failed' });
  }
});

// Export table data
router.get('/export', authenticate, async (req, res) => {
  try {
    const { table, format = 'json', db = 'postgres' } = req.query;

    if (!table) {
      return res.status(400).json({ error: 'Table name required' });
    }

    // Sanitize table name
    const validTableName = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table);
    if (!validTableName) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    let rows = [];

    if (db === 'tidb') {
      // Ensure TiDB is connected
      if (!tidbService.connection) {
        await tidbService.connect();
      }

      const [result] = await tidbService.connection.execute(`SELECT * FROM ${table}`);

      // Process vector fields for export
      rows = result.map(row => {
        const processedRow = { ...row };
        // Convert vector fields to string representation
        if (processedRow.pattern_vector) {
          processedRow.pattern_vector = `[vector:${processedRow.pattern_vector.length}d]`;
        }
        if (processedRow.inference_vector) {
          processedRow.inference_vector = `[vector:${processedRow.inference_vector.length}d]`;
        }
        if (processedRow.embedding_vector) {
          processedRow.embedding_vector = `[vector:${processedRow.embedding_vector.length}d]`;
        }
        if (processedRow.solution_vector) {
          processedRow.solution_vector = `[vector:${processedRow.solution_vector.length}d]`;
        }
        return processedRow;
      });
    } else if (db === 'postgres') {
      const result = await pgPool.query(`SELECT * FROM ${table}`);
      rows = result.rows;
    } else if (db === 'sqlite') {
      rows = await new Promise((resolve, reject) => {
        sensorDb.all(`SELECT * FROM ${table}`, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
    }

    if (format === 'csv') {
      const fields = rows.length > 0 ? Object.keys(rows[0]) : [];
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(rows);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${table}.csv"`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${table}.json"`);
      res.json(rows);
    }
  } catch (error) {
    logger.error('Export failed:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

// Get table schema
router.get('/schema/:table', authenticate, async (req, res) => {
  try {
    const { table } = req.params;
    const { db = 'postgres' } = req.query;

    // Sanitize table name
    const validTableName = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table);
    if (!validTableName) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    if (db === 'postgres') {
      const result = await pgPool.query(`
        SELECT 
          column_name as name,
          data_type as type,
          is_nullable = 'YES' as nullable,
          column_default as default_value
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      
      res.json(result.rows);
    } else if (db === 'sqlite') {
      const schema = await new Promise((resolve, reject) => {
        sensorDb.all(`PRAGMA table_info(${table})`, (err, rows) => {
          if (err) reject(err);
          else {
            resolve(rows.map(r => ({
              name: r.name,
              type: r.type,
              nullable: r.notnull === 0,
              default_value: r.dflt_value
            })));
          }
        });
      });
      
      res.json(schema);
    }
  } catch (error) {
    logger.error('Failed to fetch schema:', error);
    res.status(500).json({ error: 'Failed to fetch schema' });
  }
});

// Execute custom query (read-only)
router.post('/execute', authenticate, async (req, res) => {
  try {
    const { query, db = 'postgres' } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query required' });
    }

    // Only allow SELECT queries
    const cleanQuery = query.trim().toUpperCase();
    if (!cleanQuery.startsWith('SELECT')) {
      return res.status(403).json({ error: 'Only SELECT queries are allowed' });
    }

    let result;

    if (db === 'postgres') {
      const queryResult = await pgPool.query(query);
      result = {
        rows: queryResult.rows,
        rowCount: queryResult.rowCount,
        fields: queryResult.fields.map(f => f.name)
      };
    } else if (db === 'sqlite') {
      result = await new Promise((resolve, reject) => {
        sensorDb.all(query, (err, rows) => {
          if (err) reject(err);
          else {
            resolve({
              rows: rows,
              rowCount: rows.length,
              fields: rows.length > 0 ? Object.keys(rows[0]) : []
            });
          }
        });
      });
    }

    res.json(result);
  } catch (error) {
    logger.error('Query execution failed:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
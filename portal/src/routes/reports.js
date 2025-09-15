const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const winston = require('winston');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const Handlebars = require('handlebars');

// Get database connections from server module
let sensorDb, pgPool;
setTimeout(() => {
  const server = require('../../server');
  sensorDb = server.sensorDb;
  pgPool = server.pgPool;
}, 0);

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Generate report based on template
router.get('/generate', async (req, res) => {
  try {
    const {
      template,
      start_date,
      end_date,
      customer_id,
      equipment_id,
      format = 'json'
    } = req.query;

    if (!template) {
      return res.status(400).json({ error: 'Report template required' });
    }

    let reportData;
    
    switch (template) {
      case 'energy-summary':
        reportData = await generateEnergySummary(start_date, end_date, customer_id, equipment_id);
        break;
      case 'fault-analysis':
        reportData = await generateFaultAnalysis(start_date, end_date, customer_id, equipment_id);
        break;
      case 'maintenance-history':
        reportData = await generateMaintenanceHistory(customer_id, equipment_id);
        break;
      case 'efficiency-trends':
        reportData = await generateEfficiencyTrends(start_date, end_date, equipment_id);
        break;
      case 'cost-analysis':
        reportData = await generateCostAnalysis(start_date, end_date, customer_id, equipment_id);
        break;
      case 'compliance-report':
        reportData = await generateComplianceReport(customer_id, equipment_id);
        break;
      case 'executive-summary':
        reportData = await generateExecutiveSummary(start_date, end_date, customer_id);
        break;
      case 'sensor-diagnostics':
        reportData = await generateSensorDiagnostics(equipment_id);
        break;
      case 'apollo-predictions':
        reportData = await generateApolloPredictions(start_date, end_date, equipment_id);
        break;
      case 'power-quality':
        reportData = await generatePowerQualityReport(start_date, end_date, equipment_id);
        break;
      case 'environmental-impact':
        reportData = await generateEnvironmentalReport(start_date, end_date, customer_id);
        break;
      case 'equipment-lifecycle':
        reportData = await generateLifecycleReport(equipment_id);
        break;
      case 'comparative-analysis':
        reportData = await generateComparativeAnalysis(customer_id);
        break;
      case 'alarm-history':
        reportData = await generateAlarmHistory(start_date, end_date, equipment_id);
        break;
      case 'runtime-analysis':
        reportData = await generateRuntimeAnalysis(start_date, end_date, equipment_id);
        break;
      case 'temperature-profile':
        reportData = await generateTemperatureProfile(start_date, end_date, equipment_id);
        break;
      default:
        return res.status(400).json({ error: 'Invalid report template' });
    }

    // Format output based on requested format
    switch (format) {
      case 'pdf':
        const pdfBuffer = await generatePDF(reportData, template);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${template}-${Date.now()}.pdf`);
        res.send(pdfBuffer);
        break;
      case 'html':
        const html = await generateHTML(reportData, template);
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
        break;
      case 'excel':
        const excelBuffer = await generateExcel(reportData, template);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${template}-${Date.now()}.xlsx`);
        res.send(excelBuffer);
        break;
      case 'csv':
        const csv = generateCSV(reportData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${template}-${Date.now()}.csv`);
        res.send(csv);
        break;
      default:
        res.json(reportData);
    }
  } catch (err) {
    logger.error('Error generating report:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Report generation functions
async function generateEnergySummary(startDate, endDate, customerId, equipmentId) {
  const start = startDate ? new Date(startDate).getTime() / 1000 : Date.now() / 1000 - 86400 * 30;
  const end = endDate ? new Date(endDate).getTime() / 1000 : Date.now() / 1000;
  
  // Build equipment filter
  let equipmentIds = [];
  if (equipmentId) {
    equipmentIds = [equipmentId];
  } else if (customerId) {
    const result = await pgPool.query(
      'SELECT id FROM equipment WHERE customer_id = $1',
      [customerId]
    );
    equipmentIds = result.rows.map(r => r.id);
  } else {
    // No filters - get all equipment
    const result = await pgPool.query('SELECT id FROM equipment');
    equipmentIds = result.rows.map(r => r.id);
  }
  
  if (equipmentIds.length === 0) {
    return { error: 'No equipment found' };
  }
  
  // Get consumption data
  const placeholders = equipmentIds.map((_, i) => `?`).join(',');
  const query = `
    SELECT 
      equipment_id,
      DATE(timestamp, 'unixepoch') as date,
      SUM(power_prediction) / COUNT(*) * 24 as daily_kwh,
      MAX(power_prediction) as peak_demand
    FROM sensor_readings
    WHERE equipment_id IN (${placeholders})
      AND timestamp >= ?
      AND timestamp <= ?
    GROUP BY equipment_id, date
    ORDER BY date ASC
  `;
  
  return new Promise((resolve, reject) => {
    sensorDb.all(query, [...equipmentIds, start, end], async (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Get equipment details
      const equipmentResult = await pgPool.query(
        'SELECT e.*, c.name as customer_name FROM equipment e JOIN customers c ON e.customer_id = c.id WHERE e.id = ANY($1)',
        [equipmentIds]
      );
      
      // Aggregate data
      const summary = {
        reportType: 'Energy Usage Summary',
        period: {
          start: new Date(start * 1000).toISOString(),
          end: new Date(end * 1000).toISOString()
        },
        totalKwh: rows.reduce((sum, r) => sum + r.daily_kwh, 0),
        totalCost: 0, // Calculate based on rates
        peakDemand: Math.max(...rows.map(r => r.peak_demand)),
        avgDaily: rows.length > 0 ? rows.reduce((sum, r) => sum + r.daily_kwh, 0) / rows.length : 0,
        equipment: equipmentResult.rows,
        dailyData: rows,
        costBreakdown: [] // Would calculate based on utility rates
      };
      
      resolve(summary);
    });
  });
}

async function generateFaultAnalysis(startDate, endDate, customerId, equipmentId) {
  const start = startDate || new Date(Date.now() - 86400000 * 30).toISOString();
  const end = endDate || new Date().toISOString();
  
  let whereClause = 'WHERE f.detected_at BETWEEN $1 AND $2';
  const params = [start, end];
  
  if (equipmentId) {
    whereClause += ' AND f.equipment_id = $3';
    params.push(equipmentId);
  } else if (customerId) {
    whereClause += ' AND e.customer_id = $3';
    params.push(customerId);
  }
  
  const query = `
    SELECT 
      f.*,
      e.location_name,
      e.model_number,
      c.name as customer_name
    FROM fault_history f
    JOIN equipment e ON f.equipment_id = e.id
    JOIN customers c ON e.customer_id = c.id
    ${whereClause}
    ORDER BY f.detected_at DESC
  `;
  
  const result = await pgPool.query(query, params);
  
  // Analyze fault patterns
  const faultsByType = {};
  const faultsBySeverity = { 1: 0, 2: 0, 3: 0 };
  const faultsByEquipment = {};
  
  result.rows.forEach(fault => {
    faultsByType[fault.fault_type] = (faultsByType[fault.fault_type] || 0) + 1;
    faultsBySeverity[fault.severity] = (faultsBySeverity[fault.severity] || 0) + 1;
    faultsByEquipment[fault.equipment_id] = (faultsByEquipment[fault.equipment_id] || 0) + 1;
  });
  
  return {
    reportType: 'Fault Analysis Report',
    period: { start, end },
    totalFaults: result.rows.length,
    faultsByType,
    faultsBySeverity,
    faultsByEquipment,
    faults: result.rows,
    mtbf: calculateMTBF(result.rows), // Mean Time Between Failures
    topIssues: Object.entries(faultsByType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }))
  };
}

async function generateMaintenanceHistory(customerId, equipmentId) {
  let whereClause = 'WHERE 1=1';
  const params = [];
  
  if (equipmentId) {
    whereClause += ' AND m.equipment_id = $1';
    params.push(equipmentId);
  } else if (customerId) {
    whereClause += ' AND e.customer_id = $1';
    params.push(customerId);
  }
  
  const query = `
    SELECT 
      m.*,
      e.location_name,
      e.model_number,
      c.name as customer_name
    FROM maintenance_logs m
    JOIN equipment e ON m.equipment_id = e.id
    JOIN customers c ON e.customer_id = c.id
    ${whereClause}
    ORDER BY m.service_date DESC
  `;
  
  const result = await pgPool.query(query, params);
  
  return {
    reportType: 'Maintenance History Report',
    totalServices: result.rows.length,
    maintenanceByType: groupBy(result.rows, 'service_type'),
    maintenanceByEquipment: groupBy(result.rows, 'equipment_id'),
    history: result.rows,
    upcomingMaintenance: [] // Would calculate based on schedules
  };
}

async function generateEfficiencyTrends(startDate, endDate, equipmentId) {
  if (!equipmentId) {
    return { error: 'Equipment ID required for efficiency trends' };
  }
  
  const start = startDate ? new Date(startDate).getTime() / 1000 : Date.now() / 1000 - 86400 * 90;
  const end = endDate ? new Date(endDate).getTime() / 1000 : Date.now() / 1000;
  
  const query = `
    SELECT 
      DATE(timestamp, 'unixepoch') as date,
      AVG(efficiency_prediction) as avg_efficiency,
      MIN(efficiency_prediction) as min_efficiency,
      MAX(efficiency_prediction) as max_efficiency
    FROM sensor_readings
    WHERE equipment_id = ?
      AND timestamp >= ?
      AND timestamp <= ?
      AND efficiency_prediction IS NOT NULL
    GROUP BY date
    ORDER BY date ASC
  `;
  
  return new Promise((resolve, reject) => {
    sensorDb.all(query, [equipmentId, start, end], async (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Get equipment details
      const equipmentResult = await pgPool.query(
        'SELECT e.*, c.name as customer_name FROM equipment e JOIN customers c ON e.customer_id = c.id WHERE e.id = $1',
        [equipmentId]
      );
      
      const currentEfficiency = rows[rows.length - 1]?.avg_efficiency || 0;
      const avgEfficiency = rows.reduce((sum, r) => sum + r.avg_efficiency, 0) / rows.length || 0;
      
      resolve({
        reportType: 'Efficiency Trends Report',
        equipment: equipmentResult.rows[0],
        period: {
          start: new Date(start * 1000).toISOString(),
          end: new Date(end * 1000).toISOString()
        },
        currentEfficiency,
        averageEfficiency: avgEfficiency,
        trend: rows,
        degradationRate: calculateDegradationRate(rows),
        recommendations: generateEfficiencyRecommendations(currentEfficiency, avgEfficiency)
      });
    });
  });
}

async function generateCostAnalysis(startDate, endDate, customerId, equipmentId) {
  // Similar to energy summary but with detailed cost breakdowns
  const energyData = await generateEnergySummary(startDate, endDate, customerId, equipmentId);
  
  // Get utility rates
  const ratesResult = await pgPool.query(
    'SELECT value FROM system_settings WHERE key = $1',
    ['energy_rates']
  );
  
  const rates = ratesResult.rows[0]?.value || {
    kwhRate: 0.15,
    demandRate: 25.00
  };
  
  // Calculate costs
  const energyCost = energyData.totalKwh * rates.kwhRate;
  const demandCost = energyData.peakDemand * rates.demandRate;
  const totalCost = energyCost + demandCost;
  
  return {
    reportType: 'Cost Analysis Report',
    period: energyData.period,
    costs: {
      energy: energyCost,
      demand: demandCost,
      total: totalCost
    },
    consumption: energyData.totalKwh,
    peakDemand: energyData.peakDemand,
    rates: rates,
    projectedAnnualCost: totalCost * 12, // If monthly
    savingsOpportunities: identifySavingsOpportunities(energyData)
  };
}

async function generateComplianceReport(customerId, equipmentId) {
  // Check equipment certifications, maintenance schedules, etc.
  let whereClause = 'WHERE 1=1';
  const params = [];
  
  if (equipmentId) {
    whereClause += ' AND e.id = $1';
    params.push(equipmentId);
  } else if (customerId) {
    whereClause += ' AND e.customer_id = $1';
    params.push(customerId);
  }
  
  const query = `
    SELECT 
      e.*,
      c.name as customer_name,
      COUNT(DISTINCT m.id) as maintenance_count,
      MAX(m.service_date) as last_service_date
    FROM equipment e
    JOIN customers c ON e.customer_id = c.id
    LEFT JOIN maintenance_logs m ON e.id = m.equipment_id
    ${whereClause}
    GROUP BY e.id, c.name
  `;
  
  const result = await pgPool.query(query, params);
  
  const complianceItems = result.rows.map(equipment => {
    const issues = [];
    
    // Check warranty status
    if (equipment.warranty_expiry && new Date(equipment.warranty_expiry) < new Date()) {
      issues.push('Warranty expired');
    }
    
    // Check maintenance frequency
    const lastService = equipment.last_service_date ? new Date(equipment.last_service_date) : null;
    const daysSinceService = lastService ? (Date.now() - lastService.getTime()) / 86400000 : Infinity;
    
    if (daysSinceService > 90) {
      issues.push('Overdue for maintenance');
    }
    
    // Check refrigerant type compliance
    if (['R22', 'R11', 'R12'].includes(equipment.refrigerant_type)) {
      issues.push('Uses phased-out refrigerant');
    }
    
    return {
      equipment,
      compliant: issues.length === 0,
      issues
    };
  });
  
  return {
    reportType: 'Compliance Report',
    totalEquipment: result.rows.length,
    compliantCount: complianceItems.filter(i => i.compliant).length,
    nonCompliantCount: complianceItems.filter(i => !i.compliant).length,
    items: complianceItems,
    recommendations: generateComplianceRecommendations(complianceItems)
  };
}

// Helper functions
function calculateMTBF(faults) {
  if (faults.length < 2) return null;
  
  const sortedFaults = faults.sort((a, b) => 
    new Date(a.detected_at).getTime() - new Date(b.detected_at).getTime()
  );
  
  let totalTime = 0;
  for (let i = 1; i < sortedFaults.length; i++) {
    const timeDiff = new Date(sortedFaults[i].detected_at).getTime() - 
                     new Date(sortedFaults[i-1].detected_at).getTime();
    totalTime += timeDiff;
  }
  
  return totalTime / (sortedFaults.length - 1) / 86400000; // Days
}

function groupBy(array, key) {
  return array.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) result[group] = [];
    result[group].push(item);
    return result;
  }, {});
}

function calculateDegradationRate(efficiencyData) {
  if (efficiencyData.length < 2) return 0;
  
  const firstEfficiency = efficiencyData[0].avg_efficiency;
  const lastEfficiency = efficiencyData[efficiencyData.length - 1].avg_efficiency;
  const days = efficiencyData.length;
  
  return ((firstEfficiency - lastEfficiency) / firstEfficiency * 100) / days * 365; // Annual %
}

function generateEfficiencyRecommendations(current, average) {
  const recommendations = [];
  
  if (current < 80) {
    recommendations.push('Immediate maintenance required - efficiency critically low');
  } else if (current < 85) {
    recommendations.push('Schedule maintenance - efficiency below target');
  }
  
  if (current < average * 0.95) {
    recommendations.push('Recent efficiency decline detected - investigate root cause');
  }
  
  return recommendations;
}

function identifySavingsOpportunities(energyData) {
  const opportunities = [];
  
  if (energyData.peakDemand > energyData.avgDaily * 2) {
    opportunities.push({
      type: 'demand_management',
      description: 'Implement demand response to reduce peak charges',
      estimatedSavings: energyData.peakDemand * 25 * 0.2 // 20% reduction
    });
  }
  
  opportunities.push({
    type: 'efficiency_improvement',
    description: 'Upgrade to high-efficiency equipment',
    estimatedSavings: energyData.totalKwh * 0.15 * 0.25 // 25% reduction
  });
  
  return opportunities;
}

function generateComplianceRecommendations(items) {
  const recommendations = [];
  const refrigerantIssues = items.filter(i => 
    i.issues.includes('Uses phased-out refrigerant')
  );
  
  if (refrigerantIssues.length > 0) {
    recommendations.push(`${refrigerantIssues.length} units require refrigerant retrofit or replacement`);
  }
  
  const maintenanceIssues = items.filter(i => 
    i.issues.includes('Overdue for maintenance')
  );
  
  if (maintenanceIssues.length > 0) {
    recommendations.push(`Schedule maintenance for ${maintenanceIssues.length} units immediately`);
  }
  
  return recommendations;
}

// PDF generation
async function generatePDF(data, template) {
  const doc = new PDFDocument();
  const chunks = [];
  
  doc.on('data', chunk => chunks.push(chunk));
  
  // Add content based on template
  doc.fontSize(20).text(data.reportType, 50, 50);
  doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`, 50, 80);
  
  // Add report-specific content
  // This is simplified - real implementation would have detailed formatting
  doc.text(JSON.stringify(data, null, 2), 50, 120);
  
  doc.end();
  
  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// HTML generation
async function generateHTML(data, template) {
  // Register Handlebars helpers
  Handlebars.registerHelper('formatDate', function(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  });
  
  Handlebars.registerHelper('formatNumber', function(num) {
    if (num === null || num === undefined) return '0';
    return Number(num).toLocaleString('en-US', { maximumFractionDigits: 2 });
  });
  
  Handlebars.registerHelper('formatCurrency', function(amount) {
    if (amount === null || amount === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  });
  
  Handlebars.registerHelper('eq', function(a, b) {
    return a === b;
  });
  
  const templatePath = path.join(__dirname, '../templates/report.hbs');
  const templateContent = fs.readFileSync(templatePath, 'utf-8');
  const compiledTemplate = Handlebars.compile(templateContent);
  
  // Prepare data for template
  const reportData = {
    title: data.reportType || 'System Report',
    company: {
      name: 'AutomataNexus, LLC',
      email: 'DevOps@AutomataNexus.com',
      phone: '260-993-2025',
      website: 'www.automatanexus.com',
      tagline: 'Advanced HVAC Monitoring & AI Solutions'
    },
    generatedAt: new Date(),
    year: new Date().getFullYear(),
    data: data,
    equipment: data.equipment ? data.equipment[0] : null,
    customer: data.equipment && data.equipment[0] ? { name: data.equipment[0].customer_name } : null,
    aiModels: [
      { name: 'FaultPredict AI', status: 'Active' },
      { name: 'EnergyOptimizer AI', status: 'Active' },
      { name: 'MaintenanceScheduler AI', status: 'Active' },
      { name: 'AnomalyDetector AI', status: 'Active' },
      { name: 'EfficiencyAnalyzer AI', status: 'Active' },
      { name: 'PredictiveDiagnostics AI', status: 'Active' },
      { name: 'LoadBalancer AI', status: 'Active' },
      { name: 'WeatherAdapter AI', status: 'Active' }
    ],
    complianceBadges: [
      'ISO 9001:2015',
      'ASHRAE 90.1',
      'Energy Star',
      'LEED Certified'
    ]
  };
  
  return compiledTemplate(reportData);
}

// Excel generation
async function generateExcel(data, template) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Report');
  
  // Add headers and data based on template
  worksheet.columns = [
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Value', key: 'value', width: 15 }
  ];
  
  // Add rows (simplified)
  if (data.dailyData) {
    data.dailyData.forEach(row => {
      worksheet.addRow({ date: row.date, value: row.daily_kwh });
    });
  }
  
  return workbook.xlsx.writeBuffer();
}

// CSV generation
function generateCSV(data) {
  // Simplified CSV generation
  let csv = 'Date,Value\n';
  
  if (data.dailyData) {
    data.dailyData.forEach(row => {
      csv += `${row.date},${row.daily_kwh}\n`;
    });
  }
  
  return csv;
}

// Additional report generators
async function generateExecutiveSummary(startDate, endDate, customerId) {
  const period = { 
    start: startDate || new Date(Date.now() - 30 * 86400000).toISOString(),
    end: endDate || new Date().toISOString()
  };
  
  // Gather all key metrics
  const [energyData, faultData, costData] = await Promise.all([
    generateEnergySummary(period.start, period.end, customerId, null),
    generateFaultAnalysis(period.start, period.end, customerId, null),
    generateCostAnalysis(period.start, period.end, customerId, null)
  ]);
  
  // Get customer info
  const customerResult = await pgPool.query(
    'SELECT * FROM customers WHERE id = $1',
    [customerId]
  );
  
  return {
    reportType: 'Executive Summary',
    customer: customerResult.rows[0],
    period,
    keyMetrics: {
      totalEnergy: energyData.totalKwh,
      totalCost: costData.costs.total,
      averageEfficiency: energyData.avgDaily,
      totalFaults: faultData.totalFaults,
      criticalFaults: Object.values(faultData.faultsBySeverity)[2] || 0
    },
    highlights: [
      `Total energy consumption: ${energyData.totalKwh.toFixed(0)} kWh`,
      `Operating cost: $${costData.costs.total.toFixed(2)}`,
      `${faultData.totalFaults} faults detected, ${faultData.faultsBySeverity[3] || 0} critical`,
      `Peak demand: ${energyData.peakDemand.toFixed(1)} kW`
    ],
    recommendations: [
      ...costData.savingsOpportunities,
      ...generateExecutiveRecommendations(energyData, faultData, costData)
    ]
  };
}

async function generateSensorDiagnostics(equipmentId) {
  if (!equipmentId) {
    return { error: 'Equipment ID required' };
  }
  
  // Get latest sensor readings
  const query = `
    SELECT *
    FROM sensor_readings
    WHERE equipment_id = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `;
  
  return new Promise((resolve, reject) => {
    sensorDb.get(query, [equipmentId], async (err, latestReading) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Get sensor configuration
      const sensorConfig = await pgPool.query(
        'SELECT * FROM sensor_configs WHERE equipment_id = $1',
        [equipmentId]
      );
      
      // Analyze sensor health
      const sensorValues = JSON.parse(latestReading?.sensor_values || '[]');
      const diagnostics = sensorValues.map(sensor => {
        const config = sensorConfig.rows.find(c => c.name === sensor.name);
        const inRange = sensor.value >= (config?.min_value || 0) && 
                       sensor.value <= (config?.max_value || 999999);
        
        return {
          name: sensor.name,
          value: sensor.value,
          units: sensor.units,
          status: inRange ? 'normal' : 'out-of-range',
          lastUpdate: new Date(latestReading.timestamp * 1000),
          config: config
        };
      });
      
      resolve({
        reportType: 'Sensor Diagnostics Report',
        equipmentId,
        timestamp: new Date(),
        totalSensors: diagnostics.length,
        healthySensors: diagnostics.filter(s => s.status === 'normal').length,
        sensors: diagnostics,
        recommendations: generateSensorRecommendations(diagnostics)
      });
    });
  });
}

async function generateApolloPredictions(startDate, endDate, equipmentId) {
  if (!equipmentId) {
    return { error: 'Equipment ID required' };
  }
  
  const start = startDate ? new Date(startDate).getTime() / 1000 : Date.now() / 1000 - 86400 * 7;
  const end = endDate ? new Date(endDate).getTime() / 1000 : Date.now() / 1000;
  
  // Get both old sensor_readings and new model_inferences data
  const sensorQuery = `
    SELECT 
      timestamp,
      fault_predictions,
      efficiency_prediction,
      power_prediction
    FROM sensor_readings
    WHERE equipment_id = ?
      AND timestamp >= ?
      AND timestamp <= ?
      AND fault_predictions IS NOT NULL
    ORDER BY timestamp DESC
  `;
  
  const inferenceQuery = `
    SELECT 
      timestamp,
      model_output,
      inference_time_ms
    FROM model_inferences
    WHERE equipment_id = ?
      AND timestamp >= datetime(?, 'unixepoch')
      AND timestamp <= datetime(?, 'unixepoch')
    ORDER BY timestamp DESC
  `;
  
  return new Promise((resolve, reject) => {
    // Get sensor readings
    sensorDb.all(sensorQuery, [equipmentId, start, end], (err, sensorRows) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Get model inference results (8-model ensemble)
      sensorDb.all(inferenceQuery, [equipmentId, start, end], (inferenceErr, inferenceRows) => {
        if (inferenceErr) {
          logger.warn('Could not fetch model inferences:', inferenceErr);
          inferenceRows = [];
        }
        
        // Process inference results from 8-model ensemble
        const modelResults = {
          apollo: { detections: 0, avgConfidence: 0, totalRuns: 0 },
          aquilo: { detections: 0, avgConfidence: 0, totalRuns: 0 },
          boreas: { detections: 0, avgConfidence: 0, totalRuns: 0 },
          naiad: { detections: 0, avgConfidence: 0, totalRuns: 0 },
          vulcan: { detections: 0, avgConfidence: 0, totalRuns: 0 },
          zephyrus: { detections: 0, avgConfidence: 0, totalRuns: 0 },
          colossus: { detections: 0, avgConfidence: 0, totalRuns: 0 },
          gaia: { detections: 0, avgConfidence: 0, totalRuns: 0 }
        };
        
        let totalInferenceTime = 0;
        let multiStreamCount = 0;
        
        inferenceRows.forEach(row => {
          try {
            const output = JSON.parse(row.model_output);
            totalInferenceTime += row.inference_time_ms || 0;
            
            if (output.mode === 'simultaneous') {
              multiStreamCount++;
            }
            
            // Process each model's results
            if (output.models) {
              Object.keys(output.models).forEach(modelName => {
                const modelData = output.models[modelName];
                if (modelResults[modelName]) {
                  modelResults[modelName].totalRuns++;
                  if (modelData.fault_detected) {
                    modelResults[modelName].detections++;
                    modelResults[modelName].avgConfidence += modelData.confidence || 0;
                  }
                }
              });
            }
          } catch (e) {
            // Skip invalid JSON
          }
        });
        
        // Calculate averages for each model
        Object.keys(modelResults).forEach(model => {
          if (modelResults[model].detections > 0) {
            modelResults[model].avgConfidence /= modelResults[model].detections;
          }
        });
        
        // Aggregate old-style predictions
        const allFaults = [];
        sensorRows.forEach(row => {
          const faults = JSON.parse(row.fault_predictions || '[]');
          faults.forEach(fault => {
            allFaults.push({
              ...fault,
              timestamp: new Date(row.timestamp * 1000)
            });
          });
        });
        
        // Group faults by type
        const faultsByType = {};
        allFaults.forEach(fault => {
          if (!faultsByType[fault.type]) {
            faultsByType[fault.type] = {
              count: 0,
              avgConfidence: 0,
              maxConfidence: 0
            };
          }
          faultsByType[fault.type].count++;
          faultsByType[fault.type].avgConfidence += fault.confidence;
          faultsByType[fault.type].maxConfidence = Math.max(
            faultsByType[fault.type].maxConfidence,
            fault.confidence
          );
        });
        
        // Calculate averages
        Object.keys(faultsByType).forEach(type => {
          faultsByType[type].avgConfidence /= faultsByType[type].count;
        });
        
        resolve({
          reportType: 'Nexus Apollo™ AI Predictions Report',
          equipmentId,
          period: {
            start: new Date(start * 1000).toISOString(),
            end: new Date(end * 1000).toISOString()
          },
          totalPredictions: sensorRows.length + inferenceRows.length,
          faultsDetected: allFaults.length,
          faultsByType,
          avgEfficiency: sensorRows.length > 0 
            ? sensorRows.reduce((sum, r) => sum + r.efficiency_prediction, 0) / sensorRows.length 
            : 0,
          trends: sensorRows.map(r => ({
            timestamp: new Date(r.timestamp * 1000),
            efficiency: r.efficiency_prediction,
            power: r.power_prediction,
            faultCount: JSON.parse(r.fault_predictions || '[]').length
          })),
          // New 8-model ensemble results
          hailoNPU: {
            enabled: inferenceRows.length > 0,
            totalInferences: inferenceRows.length,
            multiStreamRuns: multiStreamCount,
            avgInferenceTime: inferenceRows.length > 0 
              ? (totalInferenceTime / inferenceRows.length).toFixed(2) 
              : 0,
            modelPerformance: modelResults,
            ensembleConsensus: calculateEnsembleConsensus(modelResults)
          },
          insights: generateAIInsights(modelResults, faultsByType, inferenceRows.length)
        });
      });
    });
  });
}

// Helper function to calculate ensemble consensus
function calculateEnsembleConsensus(modelResults) {
  const models = Object.keys(modelResults);
  const detectingModels = models.filter(m => modelResults[m].detections > 0);
  return {
    consensus: (detectingModels.length / models.length * 100).toFixed(1),
    detectingModels: detectingModels.length,
    totalModels: models.length,
    criticalModels: detectingModels.filter(m => 
      ['apollo', 'gaia', 'vulcan'].includes(m) && modelResults[m].avgConfidence > 0.7
    ).length
  };
}

// Helper function to generate AI insights
function generateAIInsights(modelResults, faultsByType, inferenceCount) {
  const insights = [];
  
  if (inferenceCount > 0) {
    insights.push(`Hailo-8 NPU processed ${inferenceCount} multi-model inferences`);
    
    // Find most active model
    const mostActive = Object.entries(modelResults)
      .sort((a, b) => b[1].detections - a[1].detections)[0];
    if (mostActive[1].detections > 0) {
      insights.push(`${mostActive[0].toUpperCase()} model detected the most issues (${mostActive[1].detections} detections)`);
    }
    
    // Check for safety concerns
    if (modelResults.gaia.detections > 0 && modelResults.gaia.avgConfidence > 0.6) {
      insights.push('⚠️ GAIA safety model has detected potential safety concerns');
    }
    
    // Check for electrical issues
    if (modelResults.aquilo.detections > 0 && modelResults.aquilo.avgConfidence > 0.7) {
      insights.push('⚡ AQUILO detected electrical anomalies requiring attention');
    }
  }
  
  return insights;
}

async function generatePowerQualityReport(startDate, endDate, equipmentId) {
  if (!equipmentId) {
    return { error: 'Equipment ID required' };
  }
  
  const start = startDate ? new Date(startDate).getTime() / 1000 : Date.now() / 1000 - 86400;
  const end = endDate ? new Date(endDate).getTime() / 1000 : Date.now() / 1000;
  
  // Get power quality metrics from sensor readings
  const query = `
    SELECT 
      timestamp,
      sensor_values
    FROM sensor_readings
    WHERE equipment_id = ?
      AND timestamp >= ?
      AND timestamp <= ?
    ORDER BY timestamp ASC
  `;
  
  return new Promise((resolve, reject) => {
    sensorDb.all(query, [equipmentId, start, end], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Extract power quality metrics
      const metrics = {
        voltage: { L1: [], L2: [], L3: [] },
        current: { L1: [], L2: [], L3: [] },
        powerFactor: [],
        thd: [],
        frequency: []
      };
      
      rows.forEach(row => {
        const sensors = JSON.parse(row.sensor_values || '[]');
        sensors.forEach(sensor => {
          if (sensor.name.includes('VOLTAGE_L1')) metrics.voltage.L1.push(sensor.value);
          if (sensor.name.includes('VOLTAGE_L2')) metrics.voltage.L2.push(sensor.value);
          if (sensor.name.includes('VOLTAGE_L3')) metrics.voltage.L3.push(sensor.value);
          if (sensor.name.includes('CURRENT_L1')) metrics.current.L1.push(sensor.value);
          if (sensor.name.includes('CURRENT_L2')) metrics.current.L2.push(sensor.value);
          if (sensor.name.includes('CURRENT_L3')) metrics.current.L3.push(sensor.value);
          if (sensor.name.includes('POWER_FACTOR')) metrics.powerFactor.push(sensor.value);
          if (sensor.name.includes('THD')) metrics.thd.push(sensor.value);
          if (sensor.name.includes('FREQUENCY')) metrics.frequency.push(sensor.value);
        });
      });
      
      // Calculate statistics
      const calculateStats = (arr) => {
        if (arr.length === 0) return { avg: 0, min: 0, max: 0, std: 0 };
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
        const min = Math.min(...arr);
        const max = Math.max(...arr);
        const std = Math.sqrt(arr.reduce((sum, x) => sum + Math.pow(x - avg, 2), 0) / arr.length);
        return { avg, min, max, std };
      };
      
      resolve({
        reportType: 'Power Quality Report',
        equipmentId,
        period: {
          start: new Date(start * 1000).toISOString(),
          end: new Date(end * 1000).toISOString()
        },
        voltage: {
          L1: calculateStats(metrics.voltage.L1),
          L2: calculateStats(metrics.voltage.L2),
          L3: calculateStats(metrics.voltage.L3),
          imbalance: calculateVoltageImbalance(metrics.voltage)
        },
        current: {
          L1: calculateStats(metrics.current.L1),
          L2: calculateStats(metrics.current.L2),
          L3: calculateStats(metrics.current.L3),
          imbalance: calculateCurrentImbalance(metrics.current)
        },
        powerFactor: calculateStats(metrics.powerFactor),
        harmonics: {
          thd: calculateStats(metrics.thd),
          violations: metrics.thd.filter(v => v > 5).length
        },
        frequency: calculateStats(metrics.frequency),
        compliance: evaluatePowerQualityCompliance(metrics)
      });
    });
  });
}

async function generateEnvironmentalReport(startDate, endDate, customerId) {
  // Calculate carbon footprint and environmental impact
  const energyData = await generateEnergySummary(startDate, endDate, customerId, null);
  
  const co2PerKwh = 0.92; // lbs CO2 per kWh (US average)
  const carbonFootprint = energyData.totalKwh * co2PerKwh;
  
  return {
    reportType: 'Environmental Impact Report',
    period: energyData.period,
    metrics: {
      totalEnergy: energyData.totalKwh,
      carbonFootprint: carbonFootprint,
      co2Tonnes: carbonFootprint / 2204.62, // Convert lbs to metric tonnes
      equivalentTrees: Math.round(carbonFootprint / 39.6), // Trees needed to offset
      equivalentCars: Math.round(carbonFootprint / 8887) // Cars off road for a year
    },
    breakdown: energyData.equipment.map(eq => ({
      equipment: eq.location_name,
      energy: eq.energy || 0,
      carbon: (eq.energy || 0) * co2PerKwh
    })),
    recommendations: [
      'Consider renewable energy sources',
      'Implement energy efficiency measures',
      'Schedule equipment during off-peak hours'
    ]
  };
}

async function generateLifecycleReport(equipmentId) {
  if (!equipmentId) {
    return { error: 'Equipment ID required' };
  }
  
  // Get equipment details and history
  const equipmentResult = await pgPool.query(
    'SELECT * FROM equipment WHERE id = $1',
    [equipmentId]
  );
  
  const maintenanceResult = await pgPool.query(
    'SELECT * FROM maintenance_logs WHERE equipment_id = $1 ORDER BY service_date ASC',
    [equipmentId]
  );
  
  const faultResult = await pgPool.query(
    'SELECT * FROM fault_history WHERE equipment_id = $1',
    [equipmentId]
  );
  
  const equipment = equipmentResult.rows[0];
  const age = equipment.install_date ? 
    (Date.now() - new Date(equipment.install_date).getTime()) / (365 * 86400000) : 0;
  
  const expectedLife = getExpectedLifespan(equipment.equipment_type);
  const remainingLife = Math.max(0, expectedLife - age);
  
  return {
    reportType: 'Equipment Lifecycle Report',
    equipment,
    lifecycle: {
      age: age.toFixed(1),
      expectedLife,
      remainingLife: remainingLife.toFixed(1),
      percentLifeUsed: (age / expectedLife * 100).toFixed(1)
    },
    maintenanceHistory: {
      total: maintenanceResult.rows.length,
      frequency: maintenanceResult.rows.length / Math.max(1, age),
      lastService: maintenanceResult.rows[maintenanceResult.rows.length - 1]?.service_date,
      history: maintenanceResult.rows
    },
    faultHistory: {
      total: faultResult.rows.length,
      rate: faultResult.rows.length / Math.max(1, age),
      byType: groupBy(faultResult.rows, 'fault_type')
    },
    recommendations: generateLifecycleRecommendations(age, expectedLife, faultResult.rows)
  };
}

async function generateComparativeAnalysis(customerId) {
  // Compare equipment performance
  const equipmentResult = await pgPool.query(
    'SELECT * FROM equipment WHERE customer_id = $1',
    [customerId]
  );
  
  const comparisons = [];
  
  for (const equipment of equipmentResult.rows) {
    // Get recent performance metrics
    const query = `
      SELECT 
        AVG(efficiency_prediction) as avg_efficiency,
        AVG(power_prediction) as avg_power,
        COUNT(CASE WHEN fault_predictions != '[]' THEN 1 END) as fault_count
      FROM sensor_readings
      WHERE equipment_id = ?
        AND timestamp > ?
    `;
    
    const metrics = await new Promise((resolve, reject) => {
      sensorDb.get(query, [equipment.id, Date.now() / 1000 - 86400 * 30], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    comparisons.push({
      equipment,
      metrics
    });
  }
  
  // Rank by efficiency
  comparisons.sort((a, b) => (b.metrics?.avg_efficiency || 0) - (a.metrics?.avg_efficiency || 0));
  
  return {
    reportType: 'Comparative Analysis Report',
    customerId,
    equipmentCount: comparisons.length,
    comparisons,
    bestPerformer: comparisons[0],
    worstPerformer: comparisons[comparisons.length - 1],
    insights: generateComparativeInsights(comparisons)
  };
}

async function generateAlarmHistory(startDate, endDate, equipmentId) {
  let whereClause = 'WHERE 1=1';
  const params = [];
  
  if (startDate) {
    whereClause += ' AND timestamp >= $' + (params.length + 1);
    params.push(new Date(startDate).toISOString());
  }
  
  if (endDate) {
    whereClause += ' AND timestamp <= $' + (params.length + 1);
    params.push(new Date(endDate).toISOString());
  }
  
  if (equipmentId) {
    whereClause += ' AND equipment_id = $' + (params.length + 1);
    params.push(equipmentId);
  }
  
  const query = `
    SELECT *
    FROM alarm_history
    ${whereClause}
    ORDER BY timestamp DESC
  `;
  
  const result = await pgPool.query(query, params);
  
  return {
    reportType: 'Alarm History Report',
    period: { start: startDate, end: endDate },
    totalAlarms: result.rows.length,
    alarmsByType: groupBy(result.rows, 'alarm_type'),
    alarmsBySeverity: groupBy(result.rows, 'severity'),
    alarmsByEquipment: groupBy(result.rows, 'equipment_id'),
    history: result.rows,
    patterns: identifyAlarmPatterns(result.rows)
  };
}

async function generateRuntimeAnalysis(startDate, endDate, equipmentId) {
  if (!equipmentId) {
    return { error: 'Equipment ID required' };
  }
  
  const start = startDate ? new Date(startDate).getTime() / 1000 : Date.now() / 1000 - 86400 * 30;
  const end = endDate ? new Date(endDate).getTime() / 1000 : Date.now() / 1000;
  
  // Get runtime data (simplified - assumes equipment is running when power > threshold)
  const query = `
    SELECT 
      DATE(timestamp, 'unixepoch') as date,
      COUNT(CASE WHEN power_prediction > 5 THEN 1 END) * 100.0 / COUNT(*) as runtime_percent,
      COUNT(CASE WHEN power_prediction > 5 THEN 1 END) * 5 / 60.0 as runtime_hours
    FROM sensor_readings
    WHERE equipment_id = ?
      AND timestamp >= ?
      AND timestamp <= ?
    GROUP BY date
    ORDER BY date ASC
  `;
  
  return new Promise((resolve, reject) => {
    sensorDb.all(query, [equipmentId, start, end], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      const totalHours = rows.reduce((sum, r) => sum + r.runtime_hours, 0);
      const avgDaily = totalHours / rows.length;
      
      resolve({
        reportType: 'Runtime Analysis Report',
        equipmentId,
        period: {
          start: new Date(start * 1000).toISOString(),
          end: new Date(end * 1000).toISOString()
        },
        totalRuntime: totalHours,
        averageDailyRuntime: avgDaily,
        utilizationRate: (avgDaily / 24 * 100).toFixed(1),
        dailyRuntime: rows,
        patterns: identifyRuntimePatterns(rows)
      });
    });
  });
}

async function generateTemperatureProfile(startDate, endDate, equipmentId) {
  if (!equipmentId) {
    return { error: 'Equipment ID required' };
  }
  
  const start = startDate ? new Date(startDate).getTime() / 1000 : Date.now() / 1000 - 86400 * 7;
  const end = endDate ? new Date(endDate).getTime() / 1000 : Date.now() / 1000;
  
  const query = `
    SELECT 
      timestamp,
      sensor_values
    FROM sensor_readings
    WHERE equipment_id = ?
      AND timestamp >= ?
      AND timestamp <= ?
    ORDER BY timestamp ASC
  `;
  
  return new Promise((resolve, reject) => {
    sensorDb.all(query, [equipmentId, start, end], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Extract temperature readings
      const temperatures = {
        supply: [],
        return: [],
        outdoor: [],
        space: []
      };
      
      rows.forEach(row => {
        const sensors = JSON.parse(row.sensor_values || '[]');
        const timestamp = new Date(row.timestamp * 1000);
        
        sensors.forEach(sensor => {
          if (sensor.name.includes('SUPPLY_TEMP')) {
            temperatures.supply.push({ timestamp, value: sensor.value });
          } else if (sensor.name.includes('RETURN_TEMP')) {
            temperatures.return.push({ timestamp, value: sensor.value });
          } else if (sensor.name.includes('OUTDOOR_TEMP')) {
            temperatures.outdoor.push({ timestamp, value: sensor.value });
          } else if (sensor.name.includes('SPACE_TEMP')) {
            temperatures.space.push({ timestamp, value: sensor.value });
          }
        });
      });
      
      // Calculate temperature differentials and statistics
      const supplyStats = calculateStats(temperatures.supply.map(t => t.value));
      const returnStats = calculateStats(temperatures.return.map(t => t.value));
      const deltaT = temperatures.supply.map((s, i) => ({
        timestamp: s.timestamp,
        value: Math.abs(s.value - (temperatures.return[i]?.value || s.value))
      }));
      
      resolve({
        reportType: 'Temperature Profile Report',
        equipmentId,
        period: {
          start: new Date(start * 1000).toISOString(),
          end: new Date(end * 1000).toISOString()
        },
        statistics: {
          supply: supplyStats,
          return: returnStats,
          deltaT: calculateStats(deltaT.map(d => d.value))
        },
        profiles: {
          supply: temperatures.supply,
          return: temperatures.return,
          outdoor: temperatures.outdoor,
          space: temperatures.space,
          deltaT
        },
        insights: generateTemperatureInsights(temperatures, deltaT)
      });
    });
  });
}

// Helper functions for new reports
function generateExecutiveRecommendations(energy, faults, costs) {
  const recommendations = [];
  
  if (faults.totalFaults > 10) {
    recommendations.push({
      priority: 'high',
      action: 'Schedule comprehensive maintenance',
      impact: 'Reduce fault frequency by 50%'
    });
  }
  
  if (energy.peakDemand > energy.avgDaily * 2) {
    recommendations.push({
      priority: 'medium',
      action: 'Implement demand management strategy',
      impact: `Save $${(costs.costs.demand * 0.2).toFixed(2)} monthly`
    });
  }
  
  return recommendations;
}

function generateSensorRecommendations(diagnostics) {
  const recommendations = [];
  const failedSensors = diagnostics.filter(s => s.status !== 'normal');
  
  if (failedSensors.length > 0) {
    recommendations.push(`Calibrate or replace ${failedSensors.length} sensors`);
  }
  
  return recommendations;
}

function calculateVoltageImbalance(voltage) {
  const avg = (voltage.L1.reduce((a, b) => a + b, 0) / voltage.L1.length +
               voltage.L2.reduce((a, b) => a + b, 0) / voltage.L2.length +
               voltage.L3.reduce((a, b) => a + b, 0) / voltage.L3.length) / 3;
  
  const maxDev = Math.max(
    Math.abs(voltage.L1.reduce((a, b) => a + b, 0) / voltage.L1.length - avg),
    Math.abs(voltage.L2.reduce((a, b) => a + b, 0) / voltage.L2.length - avg),
    Math.abs(voltage.L3.reduce((a, b) => a + b, 0) / voltage.L3.length - avg)
  );
  
  return (maxDev / avg * 100).toFixed(2);
}

function calculateCurrentImbalance(current) {
  return calculateVoltageImbalance(current); // Same calculation
}

function evaluatePowerQualityCompliance(metrics) {
  const issues = [];
  
  if (metrics.powerFactor.length > 0 && 
      metrics.powerFactor.reduce((a, b) => a + b, 0) / metrics.powerFactor.length < 0.9) {
    issues.push('Power factor below 0.9');
  }
  
  if (metrics.thd.filter(v => v > 5).length > metrics.thd.length * 0.1) {
    issues.push('THD exceeds 5% limit');
  }
  
  return {
    compliant: issues.length === 0,
    issues
  };
}

function getExpectedLifespan(equipmentType) {
  const lifespans = {
    'AHU': 20,
    'RTU': 15,
    'Chiller': 25,
    'Boiler': 30,
    'Pump': 15,
    'Cooling Tower': 20
  };
  return lifespans[equipmentType] || 20;
}

function generateLifecycleRecommendations(age, expectedLife, faults) {
  const recommendations = [];
  const lifePercent = age / expectedLife * 100;
  
  if (lifePercent > 80) {
    recommendations.push('Begin planning for equipment replacement');
  } else if (lifePercent > 60) {
    recommendations.push('Increase maintenance frequency');
  }
  
  if (faults.length > age * 2) {
    recommendations.push('High fault rate - consider major overhaul');
  }
  
  return recommendations;
}

function generateComparativeInsights(comparisons) {
  const insights = [];
  const avgEfficiency = comparisons.reduce((sum, c) => sum + (c.metrics?.avg_efficiency || 0), 0) / comparisons.length;
  
  insights.push(`Average fleet efficiency: ${avgEfficiency.toFixed(1)}%`);
  
  const underperformers = comparisons.filter(c => (c.metrics?.avg_efficiency || 0) < avgEfficiency * 0.9);
  if (underperformers.length > 0) {
    insights.push(`${underperformers.length} units performing below average`);
  }
  
  return insights;
}

function identifyAlarmPatterns(alarms) {
  const patterns = [];
  
  // Group by hour of day
  const byHour = {};
  alarms.forEach(alarm => {
    const hour = new Date(alarm.timestamp).getHours();
    byHour[hour] = (byHour[hour] || 0) + 1;
  });
  
  // Find peak hours
  const peakHour = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];
  if (peakHour) {
    patterns.push(`Most alarms occur at ${peakHour[0]}:00 (${peakHour[1]} alarms)`);
  }
  
  return patterns;
}

function identifyRuntimePatterns(runtime) {
  const patterns = [];
  
  const weekdayAvg = runtime
    .filter(r => new Date(r.date).getDay() >= 1 && new Date(r.date).getDay() <= 5)
    .reduce((sum, r) => sum + r.runtime_hours, 0) / runtime.length * 7 / 5;
    
  const weekendAvg = runtime
    .filter(r => new Date(r.date).getDay() === 0 || new Date(r.date).getDay() === 6)
    .reduce((sum, r) => sum + r.runtime_hours, 0) / runtime.length * 7 / 2;
  
  if (weekdayAvg > weekendAvg * 1.5) {
    patterns.push('Significantly higher runtime on weekdays');
  }
  
  return patterns;
}

function generateTemperatureInsights(temperatures, deltaT) {
  const insights = [];
  
  const avgDeltaT = deltaT.reduce((sum, d) => sum + d.value, 0) / deltaT.length;
  if (avgDeltaT < 10) {
    insights.push('Low temperature differential may indicate reduced cooling capacity');
  } else if (avgDeltaT > 25) {
    insights.push('High temperature differential may indicate excessive load');
  }
  
  return insights;
}

function calculateStats(arr) {
  if (!arr || arr.length === 0) return { avg: 0, min: 0, max: 0, std: 0 };
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const std = Math.sqrt(arr.reduce((sum, x) => sum + Math.pow(x - avg, 2), 0) / arr.length);
  return { avg, min, max, std };
}

// Get saved reports
router.get('/saved', async (req, res) => {
  try {
    const result = await pgPool.query(`
      SELECT * FROM saved_reports
      ORDER BY created_at DESC
      LIMIT 100
    `);
    
    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching saved reports:', err);
    res.status(500).json({ error: 'Failed to fetch saved reports' });
  }
});

// Save report
router.post('/save', async (req, res) => {
  try {
    const { name, template, parameters, data } = req.body;
    
    const result = await pgPool.query(`
      INSERT INTO saved_reports (name, template, parameters, data, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [name, template, JSON.stringify(parameters), JSON.stringify(data), req.user?.userId || 'system']);
    
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error saving report:', err);
    res.status(500).json({ error: 'Failed to save report' });
  }
});

// Schedule a report
router.post('/schedule', async (req, res) => {
  try {
    const { 
      template, 
      name, 
      frequency, 
      time, 
      dayOfWeek, 
      dayOfMonth,
      recipients,
      format,
      parameters
    } = req.body;
    
    // Store the schedule in the database
    const result = await pgPool.query(`
      INSERT INTO report_schedules 
      (template, name, frequency, time, day_of_week, day_of_month, 
       recipients, format, parameters, created_by, enabled)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      template, name, frequency, time, dayOfWeek, dayOfMonth, 
      recipients, format, JSON.stringify(parameters), 
      req.user?.userId || 'system', true
    ]);
    
    res.json({ 
      success: true, 
      schedule: result.rows[0],
      message: 'Report scheduled successfully'
    });
  } catch (err) {
    logger.error('Error scheduling report:', err);
    res.status(500).json({ error: 'Failed to schedule report' });
  }
});

// Get scheduled reports
router.get('/schedules', async (req, res) => {
  try {
    const result = await pgPool.query(`
      SELECT * FROM report_schedules 
      WHERE enabled = true
      ORDER BY created_at DESC
    `);
    
    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching schedules:', err);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// Delete a scheduled report
router.delete('/schedule/:id', async (req, res) => {
  try {
    await pgPool.query(
      'UPDATE report_schedules SET enabled = false WHERE id = $1',
      [req.params.id]
    );
    
    res.json({ success: true, message: 'Schedule removed' });
  } catch (err) {
    logger.error('Error deleting schedule:', err);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// Get trends data for charts
router.get('/trends', async (req, res) => {
  try {
    const { start_date, end_date, equipment_id, interval } = req.query;
    
    if (!equipment_id) {
      return res.status(400).json({ error: 'Equipment ID required' });
    }
    
    const start = start_date ? new Date(start_date).getTime() / 1000 : Date.now() / 1000 - 86400;
    const end = end_date ? new Date(end_date).getTime() / 1000 : Date.now() / 1000;
    
    const query = `
      SELECT 
        timestamp,
        sensor_values,
        efficiency_prediction,
        power_prediction
      FROM sensor_readings
      WHERE equipment_id = ?
        AND timestamp >= ?
        AND timestamp <= ?
      ORDER BY timestamp ASC
    `;
    
    sensorDb.all(query, [equipment_id, start, end], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch trends' });
      }
      
      // Format data for the chart
      const trendData = rows.map(row => {
        const sensors = JSON.parse(row.sensor_values || '[]');
        const dataPoint = {
          time: new Date(row.timestamp * 1000).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          timestamp: row.timestamp
        };
        
        // Extract key metrics
        sensors.forEach(sensor => {
          if (sensor.name.includes('SUPPLY_TEMP')) dataPoint.temperature = sensor.value;
          if (sensor.name.includes('HUMIDITY')) dataPoint.humidity = sensor.value;
          if (sensor.name.includes('SETPOINT')) dataPoint.setpoint = sensor.value;
        });
        
        dataPoint.energy = row.power_prediction || 0;
        dataPoint.efficiency = row.efficiency_prediction || 0;
        
        return dataPoint;
      });
      
      res.json(trendData);
    });
  } catch (err) {
    logger.error('Error fetching trends:', err);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

// Get latest sensor readings
router.get('/latest/:equipment_id', async (req, res) => {
  try {
    const { equipment_id } = req.params;
    
    const query = `
      SELECT *
      FROM sensor_readings
      WHERE equipment_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `;
    
    sensorDb.get(query, [equipment_id], (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch latest readings' });
      }
      
      if (!row) {
        return res.json({ sensors: [], power: 0, efficiency: 85 });
      }
      
      res.json({
        sensors: JSON.parse(row.sensor_values || '[]'),
        power: row.power_prediction || 0,
        efficiency: row.efficiency_prediction || 85,
        runtime: 0, // Would be calculated from historical data
        timestamp: row.timestamp
      });
    });
  } catch (err) {
    logger.error('Error fetching latest readings:', err);
    res.status(500).json({ error: 'Failed to fetch latest readings' });
  }
});

module.exports = router;
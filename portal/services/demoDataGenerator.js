const tidbVectorService = require('./tidbVectorService');

class DemoDataGenerator {
  constructor() {
    this.baseTime = Date.now();
    this.tidbService = tidbVectorService;
    this.tidbConnected = false;
    this.initializeTiDB();
    this.sensorTypes = {
      temperature: { min: 18, max: 26, unit: '°C', fluctuation: 0.5 },
      humidity: { min: 30, max: 70, unit: '%', fluctuation: 2 },
      pressure: { min: 980, max: 1020, unit: 'hPa', fluctuation: 1 },
      co2: { min: 400, max: 1000, unit: 'ppm', fluctuation: 20 },
      vibration: { min: 0.1, max: 2.5, unit: 'mm/s', fluctuation: 0.2 },
      airflow: { min: 0.5, max: 3.0, unit: 'm/s', fluctuation: 0.3 },
      power: { min: 1.2, max: 4.8, unit: 'kW', fluctuation: 0.4 },
      current: { min: 5, max: 20, unit: 'A', fluctuation: 1 },
      voltage: { min: 220, max: 240, unit: 'V', fluctuation: 2 },
      frequency: { min: 49.8, max: 50.2, unit: 'Hz', fluctuation: 0.05 },
      bearing_temp: { min: 35, max: 65, unit: '°C', fluctuation: 2 },
      refrigerant_pressure: { min: 100, max: 300, unit: 'psi', fluctuation: 10 },
      water_flow: { min: 10, max: 50, unit: 'L/min', fluctuation: 2 },
      filter_pressure_drop: { min: 20, max: 150, unit: 'Pa', fluctuation: 5 }
    };
    
    this.equipmentProfiles = {
      'RTU': ['temperature', 'humidity', 'pressure', 'airflow', 'power', 'filter_pressure_drop'],
      'Chiller': ['temperature', 'refrigerant_pressure', 'water_flow', 'power', 'vibration'],
      'AHU': ['temperature', 'humidity', 'airflow', 'filter_pressure_drop', 'power'],
      'Heat Pump': ['temperature', 'refrigerant_pressure', 'power', 'current', 'airflow'],
      'Boiler': ['temperature', 'pressure', 'water_flow', 'power', 'bearing_temp'],
      'DOAS': ['temperature', 'humidity', 'co2', 'airflow', 'filter_pressure_drop', 'power'],
      'Greenhouse': ['temperature', 'humidity', 'co2', 'airflow', 'water_flow'],
      'Steambundle': ['temperature', 'pressure', 'water_flow', 'bearing_temp', 'vibration'],
      'VAV': ['airflow', 'temperature', 'pressure', 'power', 'vibration'],
      'Pump': ['vibration', 'bearing_temp', 'water_flow', 'power', 'current'],
      'Fan': ['vibration', 'airflow', 'power', 'current', 'bearing_temp'],
      'Compressor': ['temperature', 'refrigerant_pressure', 'vibration', 'power', 'current']
    };
    
    this.anomalyPatterns = {
      normal: { probability: 0.85, severity: 0 },
      minor: { probability: 0.10, severity: 1, deviation: 0.15 },
      moderate: { probability: 0.04, severity: 2, deviation: 0.30 },
      severe: { probability: 0.01, severity: 3, deviation: 0.50 }
    };
  }

  generateSinusoidalValue(base, amplitude, frequency, offset = 0) {
    const time = (Date.now() - this.baseTime) / 1000;
    return base + amplitude * Math.sin(frequency * time + offset);
  }

  addNoise(value, noiseLevel = 0.02) {
    return value * (1 + (Math.random() - 0.5) * noiseLevel);
  }

  detectAnomaly() {
    const rand = Math.random();
    if (rand < this.anomalyPatterns.severe.probability) return this.anomalyPatterns.severe;
    if (rand < this.anomalyPatterns.moderate.probability + this.anomalyPatterns.severe.probability) return this.anomalyPatterns.moderate;
    if (rand < this.anomalyPatterns.minor.probability + this.anomalyPatterns.moderate.probability + this.anomalyPatterns.severe.probability) return this.anomalyPatterns.minor;
    return this.anomalyPatterns.normal;
  }

  async initializeTiDB() {
    try {
      await this.tidbService.connect();
      this.tidbConnected = true;
      console.log('Demo generator connected to TiDB Cloud');
    } catch (error) {
      console.error('Failed to connect demo generator to TiDB:', error);
      this.tidbConnected = false;
    }
  }

  async generateSensorReading(sensorType, equipmentType = 'RTU') {
    const config = this.sensorTypes[sensorType];
    if (!config) return null;

    const anomaly = this.detectAnomaly();
    const baseValue = (config.min + config.max) / 2;
    const range = (config.max - config.min) / 2;

    let value = this.generateSinusoidalValue(baseValue, range * 0.3, 0.1);
    value = this.addNoise(value, 0.05);

    if (anomaly.severity > 0) {
      const deviation = anomaly.deviation * range;
      value += (Math.random() > 0.5 ? 1 : -1) * deviation;
    }

    value = Math.max(config.min * 0.9, Math.min(config.max * 1.1, value));

    const reading = {
      sensor_id: `demo_${sensorType}_${Date.now()}`,
      sensor_type: sensorType,
      value: parseFloat(value.toFixed(2)),
      unit: config.unit,
      timestamp: new Date().toISOString(),
      equipment_type: equipmentType,
      anomaly_detected: anomaly.severity > 1,
      anomaly_severity: anomaly.severity,
      status: anomaly.severity === 0 ? 'normal' : anomaly.severity === 1 ? 'warning' : anomaly.severity === 2 ? 'alert' : 'critical'
    };

    // Push to TiDB Cloud if connected
    if (this.tidbConnected) {
      try {
        await this.tidbService.insertSensorReading({
          equipmentId: `demo_${equipmentType}`,
          sensorData: { [sensorType]: value },
          metadata: {
            anomaly_detected: reading.anomaly_detected,
            severity: reading.anomaly_severity,
            demo_mode: true
          }
        });
      } catch (error) {
        console.error('Failed to insert demo data to TiDB:', error);
      }
    }

    return reading;
  }

  async generateEquipmentData(equipmentId, equipmentType = 'RTU') {
    const sensorTypes = this.equipmentProfiles[equipmentType] || this.equipmentProfiles['RTU'];
    const readings = {};
    const sensorValues = {};

    for (const sensorType of sensorTypes) {
      const reading = await this.generateSensorReading(sensorType, equipmentType);
      if (reading) {
        readings[sensorType] = reading;
        sensorValues[sensorType] = reading.value;
      }
    }

    const hasAnomaly = Object.values(readings).some(r => r.anomaly_detected);
    const maxSeverity = Math.max(...Object.values(readings).map(r => r.anomaly_severity));

    const equipmentData = {
      equipment_id: equipmentId,
      equipment_type: equipmentType,
      timestamp: new Date().toISOString(),
      readings,
      overall_status: maxSeverity === 0 ? 'healthy' : maxSeverity === 1 ? 'attention' : maxSeverity === 2 ? 'warning' : 'critical',
      health_score: Math.max(0, 100 - (maxSeverity * 25)),
      has_anomaly: hasAnomaly,
      diagnostics: this.generateDiagnostics(readings, equipmentType)
    };

    // Push complete equipment reading to TiDB
    if (this.tidbConnected) {
      try {
        await this.tidbService.insertSensorReading({
          equipmentId: equipmentId,
          sensorData: sensorValues,
          metadata: {
            equipment_type: equipmentType,
            overall_status: equipmentData.overall_status,
            health_score: equipmentData.health_score,
            has_anomaly: hasAnomaly,
            demo_mode: true,
            diagnostics: equipmentData.diagnostics
          }
        });
      } catch (error) {
        console.error('Failed to insert equipment data to TiDB:', error);
      }
    }

    return equipmentData;
  }

  generateDiagnostics(readings, equipmentType) {
    const diagnostics = [];
    
    Object.entries(readings).forEach(([sensorType, reading]) => {
      if (reading.anomaly_severity > 1) {
        diagnostics.push({
          type: sensorType,
          message: this.getDiagnosticMessage(sensorType, reading, equipmentType),
          recommendation: this.getRecommendation(sensorType, reading, equipmentType),
          priority: reading.anomaly_severity
        });
      }
    });
    
    return diagnostics;
  }

  getDiagnosticMessage(sensorType, reading, equipmentType) {
    const messages = {
      temperature: `Temperature ${reading.value > this.sensorTypes[sensorType].max * 0.9 ? 'too high' : 'too low'} at ${reading.value}${reading.unit}`,
      humidity: `Humidity level abnormal at ${reading.value}${reading.unit}`,
      pressure: `Pressure irregularity detected at ${reading.value}${reading.unit}`,
      vibration: `Excessive vibration detected at ${reading.value}${reading.unit}`,
      airflow: `Airflow restriction detected at ${reading.value}${reading.unit}`,
      power: `Power consumption anomaly at ${reading.value}${reading.unit}`,
      bearing_temp: `Bearing temperature elevated at ${reading.value}${reading.unit}`,
      refrigerant_pressure: `Refrigerant pressure issue at ${reading.value}${reading.unit}`,
      water_flow: `Water flow rate abnormal at ${reading.value}${reading.unit}`,
      filter_pressure_drop: `Filter pressure drop high at ${reading.value}${reading.unit}`
    };
    return messages[sensorType] || `${sensorType} anomaly detected`;
  }

  getRecommendation(sensorType, reading, equipmentType) {
    const recommendations = {
      temperature: 'Check thermostat settings and inspect heat exchangers',
      humidity: 'Verify humidity control systems and check for leaks',
      pressure: 'Inspect ductwork for obstructions and check dampers',
      vibration: 'Schedule bearing inspection and check alignment',
      airflow: 'Clean or replace filters, check fan operation',
      power: 'Review electrical connections and motor efficiency',
      bearing_temp: 'Lubricate bearings and schedule maintenance',
      refrigerant_pressure: 'Check for refrigerant leaks and compressor operation',
      water_flow: 'Inspect pumps and check for blockages',
      filter_pressure_drop: 'Replace filter media immediately'
    };
    return recommendations[sensorType] || 'Schedule maintenance inspection';
  }

  async generateBatchData(equipmentList) {
    const results = [];
    for (const equipment of equipmentList) {
      const data = await this.generateEquipmentData(
        equipment.id,
        equipment.equipment_type || 'RTU'
      );
      results.push(data);
    }
    return results;
  }

  generateHistoricalData(equipmentId, equipmentType, hours = 24, interval = 5) {
    const data = [];
    const dataPoints = (hours * 60) / interval;
    const now = Date.now();
    
    for (let i = dataPoints; i >= 0; i--) {
      const timestamp = new Date(now - (i * interval * 60 * 1000));
      this.baseTime = timestamp.getTime();
      
      const reading = this.generateEquipmentData(equipmentId, equipmentType);
      reading.timestamp = timestamp.toISOString();
      data.push(reading);
    }
    
    this.baseTime = Date.now();
    return data;
  }

  generateAlarm(equipment, severity = 'warning') {
    const alarmTypes = {
      warning: {
        messages: [
          'Efficiency degradation detected',
          'Maintenance required soon',
          'Performance below optimal'
        ],
        priority: 2
      },
      critical: {
        messages: [
          'Equipment failure imminent',
          'Critical threshold exceeded',
          'Immediate attention required'
        ],
        priority: 1
      },
      info: {
        messages: [
          'Scheduled maintenance reminder',
          'Filter replacement due',
          'Calibration recommended'
        ],
        priority: 3
      }
    };
    
    const alarmConfig = alarmTypes[severity] || alarmTypes.warning;
    const message = alarmConfig.messages[Math.floor(Math.random() * alarmConfig.messages.length)];
    
    return {
      id: `alarm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      equipment_id: equipment.id,
      equipment_name: equipment.location_name || `Equipment ${equipment.id}`,
      severity,
      priority: alarmConfig.priority,
      message,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      resolved: false
    };
  }

  generateSystemMetrics() {
    return {
      total_equipment: Math.floor(Math.random() * 50) + 20,
      active_alarms: Math.floor(Math.random() * 10),
      energy_consumption: parseFloat((Math.random() * 100 + 50).toFixed(2)),
      system_efficiency: parseFloat((Math.random() * 20 + 75).toFixed(1)),
      co2_saved: parseFloat((Math.random() * 500 + 100).toFixed(0)),
      uptime_percentage: parseFloat((Math.random() * 5 + 94).toFixed(2)),
      ai_predictions_today: Math.floor(Math.random() * 1000) + 500,
      maintenance_scheduled: Math.floor(Math.random() * 5) + 2,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new DemoDataGenerator();
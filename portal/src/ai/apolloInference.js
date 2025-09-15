/**
 * Apollo AI Inference Module
 * Handles fault detection and efficiency prediction using the trained Apollo model
 */

const tf = require('@tensorflow/tfjs-node');
const path = require('path');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

class ApolloInference {
  constructor() {
    this.model = null;
    this.isLoaded = false;
    this.featureNames = [
      'discharge_pressure', 'suction_pressure', 'discharge_temp', 'suction_temp',
      'superheat', 'subcooling', 'evaporator_approach', 'condenser_approach',
      'compressor_current_1', 'compressor_current_2', 'compressor_current_3',
      'discharge_air_temp', 'return_air_temp', 'outside_air_temp',
      'evaporator_fan_current', 'condenser_fan_current', 'compressor_runtime',
      'power_consumption', 'efficiency_ratio', 'vibration_level'
    ];
    
    this.faultTypes = [
      'normal_operation',
      'low_refrigerant',
      'refrigerant_leak',
      'compressor_failure',
      'condenser_fouling',
      'evaporator_fouling',
      'fan_motor_fault',
      'sensor_drift',
      'electrical_issue',
      'mechanical_wear'
    ];
  }

  async loadModel() {
    try {
      const modelPath = path.join(__dirname, '..', '..', '..', 'models', 'apollo_model', 'model.json');
      
      // Check if model exists
      const fs = require('fs');
      if (!fs.existsSync(modelPath)) {
        logger.warn('Apollo model not found, using mock predictions');
        this.isLoaded = false;
        return;
      }
      
      this.model = await tf.loadLayersModel(`file://${modelPath}`);
      this.isLoaded = true;
      logger.info('Apollo AI model loaded successfully');
    } catch (error) {
      logger.error('Failed to load Apollo model:', error);
      this.isLoaded = false;
    }
  }

  async predict(sensorData) {
    try {
      if (!this.isLoaded) {
        // Return mock predictions for demo
        return this.mockPredict(sensorData);
      }

      // Extract features from sensor data
      const features = this.extractFeatures(sensorData);
      
      // Normalize features
      const normalizedFeatures = this.normalizeFeatures(features);
      
      // Create tensor
      const input = tf.tensor2d([normalizedFeatures]);
      
      // Run inference
      const predictions = await this.model.predict(input).array();
      
      // Clean up
      input.dispose();
      
      // Process predictions
      return this.processPredictions(predictions[0], sensorData);
    } catch (error) {
      logger.error('Prediction error:', error);
      return this.mockPredict(sensorData);
    }
  }

  extractFeatures(sensorData) {
    const features = [];
    
    // Map sensor readings to feature vector
    const sensorMap = {
      'DISCHARGE_PRESSURE': 0,
      'SUCTION_PRESSURE': 1,
      'DISCHARGE_TEMP': 2,
      'SUCTION_TEMP': 3,
      'SUPERHEAT': 4,
      'SUBCOOLING': 5,
      'EVAP_APPROACH': 6,
      'COND_APPROACH': 7,
      'COMP_CURRENT_L1': 8,
      'COMP_CURRENT_L2': 9,
      'COMP_CURRENT_L3': 10,
      'DISCHARGE_AIR_TEMP': 11,
      'RETURN_AIR_TEMP': 12,
      'OUTSIDE_AIR_TEMP': 13,
      'EVAP_FAN_CURRENT': 14,
      'COND_FAN_CURRENT': 15,
      'COMP_RUNTIME': 16,
      'POWER': 17,
      'EFFICIENCY': 18,
      'VIBRATION': 19
    };
    
    // Initialize with default values
    for (let i = 0; i < this.featureNames.length; i++) {
      features[i] = 0;
    }
    
    // Fill in actual sensor values
    sensorData.forEach(sensor => {
      const index = sensorMap[sensor.name];
      if (index !== undefined) {
        features[index] = sensor.value;
      }
    });
    
    // Calculate derived features if not present
    if (features[4] === 0 && features[3] > 0 && features[1] > 0) {
      // Calculate superheat
      features[4] = features[3] - this.getSaturationTemp(features[1]);
    }
    
    if (features[5] === 0 && features[2] > 0 && features[0] > 0) {
      // Calculate subcooling
      features[5] = this.getSaturationTemp(features[0]) - features[2];
    }
    
    return features;
  }

  normalizeFeatures(features) {
    // Simple min-max normalization
    const ranges = {
      0: [0, 500],    // discharge_pressure
      1: [0, 200],    // suction_pressure
      2: [0, 250],    // discharge_temp
      3: [0, 100],    // suction_temp
      4: [0, 50],     // superheat
      5: [0, 50],     // subcooling
      6: [0, 20],     // evaporator_approach
      7: [0, 20],     // condenser_approach
      8: [0, 100],    // compressor_current
      9: [0, 100],
      10: [0, 100],
      11: [0, 150],   // discharge_air_temp
      12: [0, 100],   // return_air_temp
      13: [-20, 120], // outside_air_temp
      14: [0, 50],    // fan_current
      15: [0, 50],
      16: [0, 24],    // runtime hours
      17: [0, 100],   // power
      18: [0, 20],    // efficiency
      19: [0, 10]     // vibration
    };
    
    return features.map((value, index) => {
      const [min, max] = ranges[index] || [0, 100];
      return (value - min) / (max - min);
    });
  }

  processPredictions(predictions, sensorData) {
    const faults = [];
    const threshold = 0.3; // Confidence threshold
    
    // Find detected faults
    predictions.forEach((confidence, index) => {
      if (index > 0 && confidence > threshold) { // Skip normal operation
        faults.push({
          type: this.faultTypes[index],
          confidence: confidence,
          severity: this.calculateSeverity(this.faultTypes[index], confidence),
          description: this.getFaultDescription(this.faultTypes[index]),
          affected_component: this.getAffectedComponent(this.faultTypes[index])
        });
      }
    });
    
    // Sort by confidence
    faults.sort((a, b) => b.confidence - a.confidence);
    
    // Calculate efficiency
    const efficiency = this.calculateEfficiency(sensorData, faults);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(faults, efficiency, sensorData);
    
    return {
      faults: faults.slice(0, 5), // Top 5 faults
      efficiency: efficiency,
      health_score: this.calculateHealthScore(faults, efficiency),
      recommendations: recommendations
    };
  }

  calculateSeverity(faultType, confidence) {
    const severityMap = {
      'compressor_failure': 3,
      'refrigerant_leak': 3,
      'low_refrigerant': 2,
      'electrical_issue': 3,
      'condenser_fouling': 2,
      'evaporator_fouling': 2,
      'fan_motor_fault': 2,
      'sensor_drift': 1,
      'mechanical_wear': 2
    };
    
    const baseSeverity = severityMap[faultType] || 1;
    return confidence > 0.8 ? baseSeverity : Math.max(1, baseSeverity - 1);
  }

  getFaultDescription(faultType) {
    const descriptions = {
      'low_refrigerant': 'System is operating with insufficient refrigerant charge',
      'refrigerant_leak': 'Active refrigerant leak detected in the system',
      'compressor_failure': 'Compressor showing signs of imminent failure',
      'condenser_fouling': 'Condenser coils are dirty or blocked',
      'evaporator_fouling': 'Evaporator coils need cleaning',
      'fan_motor_fault': 'Fan motor electrical or mechanical issue',
      'sensor_drift': 'One or more sensors showing calibration drift',
      'electrical_issue': 'Electrical anomaly detected in power consumption',
      'mechanical_wear': 'Excessive mechanical wear detected'
    };
    
    return descriptions[faultType] || 'Unknown fault condition';
  }

  getAffectedComponent(faultType) {
    const components = {
      'low_refrigerant': 'Refrigeration Circuit',
      'refrigerant_leak': 'Refrigeration Circuit',
      'compressor_failure': 'Compressor',
      'condenser_fouling': 'Condenser',
      'evaporator_fouling': 'Evaporator',
      'fan_motor_fault': 'Fan Motor',
      'sensor_drift': 'Control System',
      'electrical_issue': 'Electrical System',
      'mechanical_wear': 'Mechanical Components'
    };
    
    return components[faultType] || 'System';
  }

  calculateEfficiency(sensorData, faults) {
    let baseEfficiency = 85; // Base efficiency
    
    // Reduce efficiency based on faults
    faults.forEach(fault => {
      baseEfficiency -= fault.severity * 5 * fault.confidence;
    });
    
    // Adjust based on operating conditions
    const power = sensorData.find(s => s.name === 'POWER')?.value || 0;
    const cooling = sensorData.find(s => s.name === 'COOLING_OUTPUT')?.value || power * 3.5;
    
    if (power > 0) {
      const eer = cooling / power;
      const eerFactor = Math.min(1, eer / 12); // Normalize to expected EER
      baseEfficiency = baseEfficiency * eerFactor;
    }
    
    return Math.max(0, Math.min(100, baseEfficiency));
  }

  calculateHealthScore(faults, efficiency) {
    let score = 100;
    
    // Deduct for faults
    faults.forEach(fault => {
      score -= fault.severity * 10 * fault.confidence;
    });
    
    // Factor in efficiency
    score = score * (efficiency / 100);
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  generateRecommendations(faults, efficiency, sensorData) {
    const recommendations = [];
    
    // Fault-based recommendations
    faults.forEach(fault => {
      switch (fault.type) {
        case 'low_refrigerant':
          recommendations.push('Check for refrigerant leaks and recharge system to proper levels');
          break;
        case 'compressor_failure':
          recommendations.push('Schedule immediate compressor inspection - failure imminent');
          recommendations.push('Check compressor oil levels and electrical connections');
          break;
        case 'condenser_fouling':
          recommendations.push('Clean condenser coils to improve heat rejection');
          break;
        case 'evaporator_fouling':
          recommendations.push('Clean evaporator coils and replace air filters');
          break;
      }
    });
    
    // Efficiency-based recommendations
    if (efficiency < 70) {
      recommendations.push('System efficiency critically low - comprehensive service required');
    } else if (efficiency < 80) {
      recommendations.push('Schedule preventive maintenance to improve efficiency');
    }
    
    // Operating condition recommendations
    const dischargePressure = sensorData.find(s => s.name === 'DISCHARGE_PRESSURE')?.value || 0;
    if (dischargePressure > 400) {
      recommendations.push('High discharge pressure - check condenser airflow and ambient conditions');
    }
    
    return [...new Set(recommendations)].slice(0, 5); // Remove duplicates, limit to 5
  }

  getSaturationTemp(pressure) {
    // Simplified R410A pressure-temperature relationship
    // In real implementation, use proper refrigerant property tables
    return 0.0875 * pressure + 10;
  }

  // Mock predictions for when model isn't loaded
  mockPredict(sensorData) {
    const randomFaults = [];
    
    // Simulate some faults based on sensor values
    const dischargePressure = sensorData.find(s => s.name === 'DISCHARGE_PRESSURE')?.value || 0;
    const suctionPressure = sensorData.find(s => s.name === 'SUCTION_PRESSURE')?.value || 0;
    
    if (dischargePressure > 400) {
      randomFaults.push({
        type: 'condenser_fouling',
        confidence: 0.75,
        severity: 2,
        description: 'Condenser coils are dirty or blocked',
        affected_component: 'Condenser'
      });
    }
    
    if (suctionPressure < 50) {
      randomFaults.push({
        type: 'low_refrigerant',
        confidence: 0.65,
        severity: 2,
        description: 'System is operating with insufficient refrigerant charge',
        affected_component: 'Refrigeration Circuit'
      });
    }
    
    const efficiency = 75 + Math.random() * 20;
    const health_score = 70 + Math.random() * 25;
    
    return {
      faults: randomFaults,
      efficiency: efficiency,
      health_score: Math.round(health_score),
      recommendations: this.generateRecommendations(randomFaults, efficiency, sensorData)
    };
  }

  isLoaded() {
    return this.isLoaded;
  }
}

module.exports = new ApolloInference();
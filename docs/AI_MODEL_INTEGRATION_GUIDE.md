# Integration Guide: 8-Model System into Apollo Nexus

## Quick Start Integration

### 1. Backend API Updates

#### New Model Service (model.service.js)
```javascript
const { HailoDevice } = require('@hailo/node-sdk');
const modelConfigs = require('./model-configs');

class ModelService {
  constructor() {
    this.device = new HailoDevice();
    this.models = {};
    this.initializeModels();
  }

  async initializeModels() {
    const modelNames = ['aquilo', 'boreas', 'naiad', 'vulcan', 
                       'zephyrus', 'colossus', 'gaia', 'apollo'];
    
    for (const name of modelNames) {
      this.models[name] = await this.device.loadModel(
        `./models/${name}_quantized.hef`,
        modelConfigs[name]
      );
    }
  }

  async runFullDiagnosis(sensorData) {
    // Stage 1: Parallel specialist inference
    const specialistResults = await Promise.all([
      this.models.aquilo.infer(sensorData.electrical),
      this.models.boreas.infer(sensorData.refrigeration),
      this.models.naiad.infer(sensorData.water),
      this.models.vulcan.infer(sensorData.mechanical),
      this.models.zephyrus.infer(sensorData.airflow)
    ]);

    // Stage 2: Sequential aggregation
    const colossusInput = this.concatenateOutputs(specialistResults);
    const colossusResult = await this.models.colossus.infer(colossusInput);

    // Stage 3: Safety validation
    const gaiaInput = [...specialistResults, colossusResult];
    const gaiaResult = await this.models.gaia.infer(gaiaInput);

    // Stage 4: Master coordination
    const apolloInput = {
      specialists: specialistResults,
      colossus: colossusResult,
      gaia: gaiaResult,
      raw: sensorData
    };
    const finalDiagnosis = await this.models.apollo.infer(apolloInput);

    return {
      specialists: this.formatSpecialistResults(specialistResults),
      aggregation: colossusResult,
      safety: gaiaResult,
      final: finalDiagnosis,
      timestamp: new Date()
    };
  }
}
```

#### API Routes (models.routes.js)
```javascript
const express = require('express');
const router = express.Router();
const modelService = require('./model.service');

// Full system diagnosis
router.post('/diagnose', async (req, res) => {
  try {
    const { equipmentId } = req.body;
    const sensorData = await getSensorData(equipmentId);
    const diagnosis = await modelService.runFullDiagnosis(sensorData);
    
    // Store results
    await saveDiagnosisResults(equipmentId, diagnosis);
    
    // Emit real-time updates
    io.to(`equipment-${equipmentId}`).emit('diagnosis-complete', diagnosis);
    
    res.json(diagnosis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Individual model endpoints
router.get('/electrical/analysis/:equipmentId', async (req, res) => {
  const result = await modelService.models.aquilo.infer(
    await getElectricalData(req.params.equipmentId)
  );
  res.json(result);
});

// ... similar for other specialists
```

### 2. Frontend React Components

#### Model Dashboard Component
```jsx
import React, { useState, useEffect } from 'react';
import { Card, Grid, Progress, Alert } from '@mui/material';
import { useWebSocket } from './hooks/useWebSocket';

const ModelDashboard = ({ equipmentId }) => {
  const [modelStates, setModelStates] = useState({
    aquilo: { status: 'idle', confidence: 0, lastFault: null },
    boreas: { status: 'idle', confidence: 0, lastFault: null },
    naiad: { status: 'idle', confidence: 0, lastFault: null },
    vulcan: { status: 'idle', confidence: 0, lastFault: null },
    zephyrus: { status: 'idle', confidence: 0, lastFault: null },
    colossus: { status: 'idle', confidence: 0, lastFault: null },
    gaia: { status: 'idle', confidence: 0, lastFault: null },
    apollo: { status: 'idle', confidence: 0, decision: null }
  });

  const { subscribe } = useWebSocket();

  useEffect(() => {
    // Subscribe to model updates
    const unsubscribers = [
      subscribe('aquilo-fault', data => updateModel('aquilo', data)),
      subscribe('boreas-fault', data => updateModel('boreas', data)),
      subscribe('naiad-fault', data => updateModel('naiad', data)),
      subscribe('vulcan-fault', data => updateModel('vulcan', data)),
      subscribe('zephyrus-fault', data => updateModel('zephyrus', data)),
      subscribe('colossus-analysis', data => updateModel('colossus', data)),
      subscribe('gaia-alert', data => updateModel('gaia', data)),
      subscribe('apollo-decision', data => updateModel('apollo', data))
    ];

    return () => unsubscribers.forEach(unsub => unsub());
  }, [equipmentId]);

  const updateModel = (modelName, data) => {
    setModelStates(prev => ({
      ...prev,
      [modelName]: {
        status: data.status || 'active',
        confidence: data.confidence || 0,
        lastFault: data.fault || prev[modelName].lastFault,
        decision: data.decision || prev[modelName].decision
      }
    }));
  };

  return (
    <Grid container spacing={3}>
      {/* Specialist Models */}
      <Grid item xs={12}>
        <h2>Specialist Models</h2>
      </Grid>
      
      {['aquilo', 'boreas', 'naiad', 'vulcan', 'zephyrus'].map(model => (
        <Grid item xs={12} md={4} lg={2.4} key={model}>
          <ModelCard 
            name={model}
            state={modelStates[model]}
            icon={getModelIcon(model)}
          />
        </Grid>
      ))}

      {/* Aggregation Layer */}
      <Grid item xs={12}>
        <h2>Aggregation & Validation</h2>
      </Grid>
      
      <Grid item xs={12} md={6}>
        <ModelCard 
          name="colossus"
          state={modelStates.colossus}
          icon="⚡"
          size="large"
        />
      </Grid>
      
      <Grid item xs={12} md={6}>
        <ModelCard 
          name="gaia"
          state={modelStates.gaia}
          icon="🛡️"
          size="large"
        />
      </Grid>

      {/* Master Coordinator */}
      <Grid item xs={12}>
        <ApolloMasterCard state={modelStates.apollo} />
      </Grid>
    </Grid>
  );
};

const ModelCard = ({ name, state, icon, size = 'normal' }) => {
  const getStatusColor = (status) => {
    switch(status) {
      case 'active': return 'primary';
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  return (
    <Card sx={{ p: 2, height: size === 'large' ? 200 : 150 }}>
      <div style={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <span style={{ fontSize: 24, mr: 1 }}>{icon}</span>
        <h3 style={{ textTransform: 'capitalize' }}>{name}</h3>
      </div>
      
      <Progress 
        variant="determinate" 
        value={state.confidence * 100}
        color={getStatusColor(state.status)}
      />
      
      {state.lastFault && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {state.lastFault}
        </Alert>
      )}
    </Card>
  );
};
```

#### Apollo Master View Component
```jsx
const ApolloMasterCard = ({ state }) => {
  return (
    <Card sx={{ p: 3, background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)' }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <h2 style={{ color: 'white' }}>Apollo Master Coordinator</h2>
          
          {state.decision && (
            <div style={{ color: 'white' }}>
              <h3>System Diagnosis:</h3>
              <p>{state.decision.diagnosis}</p>
              
              <h3>Recommended Actions:</h3>
              <ol>
                {state.decision.actions.map((action, idx) => (
                  <li key={idx}>{action}</li>
                ))}
              </ol>
              
              <h3>Energy Optimization:</h3>
              <p>Potential Savings: ${state.decision.savings}/month</p>
            </div>
          )}
        </Grid>
        
        <Grid item xs={12} md={4}>
          <ConsensusGauge consensus={state.decision?.consensus || 0} />
          <ConfidenceMeter confidence={state.confidence} />
        </Grid>
      </Grid>
    </Card>
  );
};
```

### 3. WebSocket Integration

#### Socket.IO Server Updates
```javascript
// server/socket.js
const modelService = require('./services/model.service');

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('start-monitoring', async (equipmentId) => {
    socket.join(`equipment-${equipmentId}`);
    
    // Start real-time model inference
    const intervalId = setInterval(async () => {
      try {
        const sensorData = await getSensorData(equipmentId);
        
        // Run lightweight specialist inference
        const quickResults = await modelService.runQuickDiagnosis(sensorData);
        
        // Emit individual model results
        for (const [model, result] of Object.entries(quickResults)) {
          if (result.fault) {
            socket.emit(`${model}-fault`, result);
          }
        }
        
        // Run full diagnosis every 5th cycle
        if (Date.now() % 5 === 0) {
          const fullDiagnosis = await modelService.runFullDiagnosis(sensorData);
          socket.emit('apollo-decision', fullDiagnosis.final);
        }
      } catch (error) {
        socket.emit('error', error.message);
      }
    }, 1000); // 1Hz for specialists
    
    socket.on('disconnect', () => {
      clearInterval(intervalId);
    });
  });
});
```

### 4. Database Integration

#### Sequelize Models
```javascript
// models/ModelInference.js
module.exports = (sequelize, DataTypes) => {
  const ModelInference = sequelize.define('ModelInference', {
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    equipmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Equipment',
        key: 'id'
      }
    },
    modelName: {
      type: DataTypes.ENUM('aquilo', 'boreas', 'naiad', 'vulcan', 
                           'zephyrus', 'colossus', 'gaia', 'apollo'),
      allowNull: false
    },
    faultDetected: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    confidence: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    inferenceTimeMs: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    rawOutput: {
      type: DataTypes.JSONB,
      allowNull: false
    }
  });

  ModelInference.associate = (models) => {
    ModelInference.belongsTo(models.Equipment);
  };

  return ModelInference;
};
```

### 5. Configuration Files

#### model-configs.json
```json
{
  "aquilo": {
    "inputShape": [64, 7],
    "outputShape": {
      "faultLogits": [13],
      "severity": [5],
      "phaseHealth": [3],
      "powerQuality": [1]
    },
    "preprocessor": "electrical",
    "postprocessor": "electricalFaults"
  },
  "boreas": {
    "inputShape": [80, 7],
    "outputShape": {
      "faultLogits": [16],
      "efficiency": [1],
      "chargeLevel": [5],
      "componentHealth": [8]
    },
    "preprocessor": "refrigeration",
    "postprocessor": "refrigerationFaults"
  },
  // ... other models
}
```

### 6. Environment Variables

#### .env updates
```bash
# Hailo Configuration
HAILO_DEVICE_ID=0
HAILO_POWER_MODE=performance
HAILO_LOG_LEVEL=info

# Model Paths
MODEL_BASE_PATH=/opt/apollo-nexus/models
MODEL_AQUILO_PATH=${MODEL_BASE_PATH}/aquilo_quantized.hef
MODEL_BOREAS_PATH=${MODEL_BASE_PATH}/boreas_quantized.hef
MODEL_NAIAD_PATH=${MODEL_BASE_PATH}/naiad_quantized.hef
MODEL_VULCAN_PATH=${MODEL_BASE_PATH}/vulcan_quantized.hef
MODEL_ZEPHYRUS_PATH=${MODEL_BASE_PATH}/zephyrus_quantized.hef
MODEL_COLOSSUS_PATH=${MODEL_BASE_PATH}/colossus_quantized.hef
MODEL_GAIA_PATH=${MODEL_BASE_PATH}/gaia_quantized.hef
MODEL_APOLLO_PATH=${MODEL_BASE_PATH}/apollo_quantized.hef

# Inference Settings
INFERENCE_BATCH_SIZE=1
INFERENCE_TIMEOUT_MS=100
SPECIALIST_INFERENCE_RATE_HZ=1
FULL_DIAGNOSIS_RATE_HZ=0.2
```

### 7. Deployment Script

#### deploy-models.sh
```bash
#!/bin/bash

echo "Deploying 8-Model System to Apollo Nexus"

# Stop existing services
sudo systemctl stop apollo-nexus

# Convert PyTorch models to Hailo format
echo "Converting models to Hailo format..."
for model in aquilo boreas naiad vulcan zephyrus colossus gaia apollo; do
    echo "Converting $model..."
    python3 tools/convert_to_hailo.py \
        --model-path models/${model}_final_advanced.pth \
        --output-path models/${model}_quantized.hef \
        --calibration-data data/${model}_calibration.npz
done

# Copy models to deployment directory
sudo cp models/*.hef /opt/apollo-nexus/models/

# Update database schema
echo "Updating database schema..."
cd /opt/apollo-nexus
npm run migrate

# Restart services
sudo systemctl start apollo-nexus
sudo systemctl status apollo-nexus

echo "Deployment complete!"
```

This integration guide provides the essential code updates needed to integrate the 8-model system into your existing Apollo Nexus application.
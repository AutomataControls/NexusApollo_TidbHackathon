# Nexus Apollo 8-Model Training Guide

## Overview

The Nexus Apollo platform employs 8 specialized PyTorch neural networks that work collaboratively for comprehensive HVAC fault detection, predictive maintenance, and energy optimization. All models are proprietary and trained using Google Colab's GPU infrastructure before deployment to Hailo-8 NPU.

## The 8-Model Architecture

### Model Hierarchy

```
                           APOLLO (Master Coordinator)
                                      ↑
    ┌─────────────────────────────────┼─────────────────────────────────┐
    │                                 │                                 │
    │                            COLOSSUS                              GAIA
    │                         (Master Aggregator)                 (Safety Validator)
    │                                 ↑                                 │
    │         ┌──────────┬──────────┼──────────┬──────────┐          │
    │         │          │          │          │          │          │
    ↓         ↓          ↓          ↓          ↓          ↓          ↓
AQUILO    BOREAS      NAIAD      VULCAN    ZEPHYRUS   COLOSSUS    GAIA
(Electrical) (Refrigeration) (Water) (Mechanical) (Airflow)
```

## Individual Models

### 1. AQUILO - Electrical Systems Specialist
- **Parameters**: 607,990
- **Input**: 64 sensors × 7 features (voltage, current, power factor, THD, frequency, phase angles, harmonics)
- **Output**: 13 electrical fault types + severity + phase health + power quality score
- **Specialization**: Compressor electrical faults, motor winding issues, power factor problems, harmonic distortion

### 2. BOREAS - Refrigeration Systems Specialist
- **Parameters**: 1,241,510
- **Input**: 80 sensors × 7 features (pressures, temperatures, superheat, subcool, flow rates)
- **Output**: 16 refrigeration faults + efficiency score + refrigerant charge level + component health
- **Specialization**: Low/high refrigerant charge, compressor valve failures, TXV hunting, condenser fouling

### 3. NAIAD - Water Systems Specialist
- **Parameters**: 532,966
- **Input**: 64 sensors × 7 features (flow, pressure, temperature, quality, pH, conductivity)
- **Output**: 11 water system faults + flow anomaly detection + water quality index + pump efficiency
- **Specialization**: Pump cavitation, scaling/fouling, control valve issues, hydronic imbalance

### 4. VULCAN - Mechanical Systems Specialist
- **Parameters**: 1,109,830
- **Input**: 96 sensors × 7 features (vibration, temperature, pressure, acoustics, RPM, torque)
- **Output**: 15 mechanical faults + bearing health + vibration severity + remaining useful life
- **Specialization**: Bearing wear/failure, belt slippage, shaft misalignment, mechanical looseness

### 5. ZEPHYRUS - Airflow Systems Specialist
- **Parameters**: 844,614
- **Input**: 72 sensors × 7 features (velocity, pressure, temperature, humidity, CO2, damper positions)
- **Output**: 12 airflow faults + filter loading + duct leakage location + IAQ score
- **Specialization**: Filter clogging, duct leakage, damper failures, static pressure issues

### 6. COLOSSUS - Master Aggregator
- **Parameters**: 1,544,518
- **Input**: Combined outputs from all 5 base specialists
- **Output**: 24 integrated fault types + cascade probability + system health score + specialist confidence
- **Specialization**: Cross-system correlation, multi-fault detection, cascade failure prediction

### 7. GAIA - Safety Validator
- **Parameters**: 896,198
- **Input**: All specialist outputs + Colossus output
- **Output**: Validation state (5 levels) + safety score + override recommendations + confidence intervals
- **Specialization**: Safety validation, emergency shutdown recommendations, risk assessment, compliance verification

### 8. APOLLO - Master Coordinator (Supreme Authority)
- **Parameters**: 1,820,296
- **Input**: All 7 model outputs + raw sensor data + historical context
- **Output**: Final diagnosis (12 categories) + cost optimization (6 strategies) + action priority + confidence
- **Specialization**: Ultimate fault classification, cost/benefit analysis, energy optimization, emergency coordination

## Training Infrastructure (Google Colab)

### Training Environment

All models are trained using Google Colab Pro+ with the following specifications:
- **GPU**: NVIDIA A100 (40GB) or V100 (16GB)
- **RAM**: 51GB system memory
- **Runtime**: High-RAM runtime with background execution
- **Storage**: Google Drive integration for datasets and model checkpoints

### Training Duration

- **Individual Specialists** (Aquilo, Boreas, Naiad, Vulcan, Zephyrus): 48-72 hours each
- **Aggregation Models** (Colossus, Gaia): 96-120 hours each
- **Apollo Master**: 144-168 hours
- **Total Training Time**: ~800 hours across parallel Colab instances

## Model Conversion Pipeline

### 1. PyTorch to ONNX Export (Google Colab)

After training completion, models are exported from PyTorch to ONNX format:

```python
# Export process in Colab
import torch
import torch.onnx

# Load trained model
model = torch.load('/content/drive/MyDrive/models/aquilo_final.pth')
model.eval()

# Create dummy input matching model specifications
dummy_input = torch.randn(1, 64, 7)  # For Aquilo

# Export to ONNX
torch.onnx.export(
    model,
    dummy_input,
    '/content/drive/MyDrive/onnx/aquilo.onnx',
    export_params=True,
    opset_version=11,
    do_constant_folding=True,
    input_names=['sensor_input'],
    output_names=['fault_detection', 'severity', 'phase_health', 'power_quality'],
    dynamic_axes={'sensor_input': {0: 'batch_size'}}
)
```

### 2. ONNX to HEF Conversion (Local Development Machine)

Models are converted to Hailo Executable Format (.hef) using Hailo Dataflow Compiler:

```bash
# Parse ONNX model
hailo parser onnx --hw-arch hailo8 aquilo.onnx

# Optimize for Hailo-8
hailo optimize aquilo.har --hw-arch hailo8 \
    --calibration-dataset /data/calibration/aquilo_calib.npy \
    --performance-level 2

# Compile to HEF
hailo compiler aquilo_optimized.har --hw-arch hailo8 \
    --allocator-script /scripts/aquilo_resources.py
```

### 3. Deployment to Raspberry Pi 5

Transfer compiled models and deploy to Hailo-8:

```bash
# Transfer all HEF files to Raspberry Pi
scp models/*.hef pi@nexus-apollo:/home/pi/models/

# On Raspberry Pi - Verify Hailo-8 device
hailortcli fw-control identify

# Load models into Hailo-8 memory
hailortcli model-load /home/pi/models/aquilo.hef
hailortcli model-load /home/pi/models/boreas.hef
# ... repeat for all 8 models
```

## Proprietary Training Process

### Data Collection and Preparation

The training data is proprietary and collected from:
- **Real HVAC Systems**: 500+ commercial installations
- **Fault Scenarios**: 10,000+ documented fault cases
- **Sensor Arrays**: 21+ sensors per equipment unit
- **Time Period**: 5+ years of historical data
- **Sampling Rate**: 5-second intervals (high-frequency)

### Training Methodology

**Note**: The actual training algorithms, loss functions, and optimization techniques are proprietary and confidential. The models use custom architectures developed specifically for HVAC fault detection.

Key aspects of the training process:
- **Custom Loss Functions**: Proprietary multi-objective loss functions
- **Specialized Architectures**: Domain-specific neural network designs
- **Transfer Learning**: Pre-trained on general HVAC data, fine-tuned on specific equipment
- **Ensemble Methods**: Custom voting and aggregation strategies

## Performance Specifications

### Inference Performance on Hailo-8

```
Model               Parameters    Inference Time    Accuracy
----------------------------------------------------------------
AQUILO              607,990      ~8ms              94.8%
BOREAS              1,241,510    ~12ms             95.2%
NAIAD               532,966      ~7ms              93.6%
VULCAN              1,109,830    ~10ms             96.1%
ZEPHYRUS            844,614      ~9ms              94.3%
COLOSSUS            1,544,518    ~15ms             97.2%
GAIA                896,198      ~10ms             98.9%
APOLLO              1,820,296    ~20ms             98.5%
----------------------------------------------------------------
Full Pipeline       7,597,922    ~91ms             98.5% (overall)
```

### Resource Utilization

- **Model Storage**: ~250MB (all 8 models quantized to INT8)
- **Runtime Memory**: ~2GB (includes sensor buffers)
- **Power Consumption**: ~15W (full system including Hailo-8)
- **Throughput**: 11 complete diagnoses per second

## Hailo-8 Deployment Architecture

### Hardware Configuration

```
Raspberry Pi 5 (8GB RAM)
├── Hailo-8 AI Accelerator (26 TOPS via M.2 HAT)
│   ├── Model Pipeline Manager
│   ├── 5 Specialist Models (Parallel Execution)
│   ├── 2 Aggregation Models (Sequential)
│   └── 1 Master Model (Final Decision)
├── NVMe SSD (256GB)
│   ├── Quantized Model Weights (~250MB)
│   ├── SQLite Database (Sensor Data)
│   └── PostgreSQL Database (System Data)
└── Sequent Microsystems I/O
    ├── MegaBAS (Sensor Input)
    └── MegaIND (Control Output)
```

### Inference Pipeline Flow

```
1. Sensor Data Collection (100Hz from hardware)
    ↓
2. Data Preprocessing (CPU - Raspberry Pi)
    ↓
3. Parallel Specialist Inference (Hailo-8 NPU)
    - 5 models run simultaneously
    - Combined time: ~12ms (limited by slowest)
    ↓
4. Aggregation Layer (Hailo-8 NPU)
    - COLOSSUS: ~15ms
    - GAIA: ~10ms (sequential)
    ↓
5. Master Coordination (Hailo-8 NPU)
    - APOLLO: ~20ms
    ↓
6. Total Pipeline: ~57ms best case, ~91ms worst case
```

## Model Updates and Versioning

### Version Control
- Models use semantic versioning (v1.x.x)
- Each model tracked independently
- Metadata includes training date, dataset version, performance metrics

### Update Process
1. New models trained quarterly in Google Colab
2. Converted to HEF format locally
3. Validated on test hardware
4. Deployed via secure OTA update
5. Automatic rollback if performance degrades

## Integration with Nexus Apollo Platform

### API Endpoints

```javascript
// Model-specific endpoints
GET /api/models/status              // All model status
GET /api/models/:model/diagnose     // Run specific model
POST /api/models/apollo/coordinate  // Full system diagnosis

// Specialist endpoints
GET /api/electrical/analysis        // Aquilo diagnostics
GET /api/refrigeration/analysis     // Boreas diagnostics
GET /api/water/analysis             // Naiad diagnostics
GET /api/mechanical/analysis        // Vulcan diagnostics
GET /api/airflow/analysis           // Zephyrus diagnostics

// System endpoints
GET /api/system/full-diagnosis      // Complete 8-model analysis
GET /api/system/efficiency-score    // Multi-model efficiency
GET /api/system/safety-validation   // Gaia safety check
```

### WebSocket Events

```javascript
// Real-time model events
socket.on('aquilo-fault', (data) => {});      // Electrical fault
socket.on('boreas-fault', (data) => {});      // Refrigeration fault
socket.on('naiad-fault', (data) => {});       // Water system fault
socket.on('vulcan-fault', (data) => {});      // Mechanical fault
socket.on('zephyrus-fault', (data) => {});    // Airflow fault
socket.on('colossus-analysis', (data) => {}); // Multi-system analysis
socket.on('gaia-alert', (data) => {});        // Safety alert
socket.on('apollo-decision', (data) => {});   // Final diagnosis
```

## Monitoring and Diagnostics

### Model Health Monitoring

```bash
# Check Hailo-8 status
hailortcli fw-control identify

# Monitor inference performance
hailortcli monitor --show-metrics

# View loaded models
hailortcli model-list

# Check model utilization
hailortcli power-measurement
```

### Performance Metrics Tracking

The system continuously monitors:
- Inference latency per model
- Model agreement/disagreement rates
- False positive/negative rates
- Resource utilization (CPU, NPU, memory)
- Temperature and power consumption

## Security and Compliance

### Model Security
- Models are encrypted at rest
- Secure boot verification for model integrity
- Access control for model endpoints
- Audit logging for all inference requests

### Data Privacy
- No personally identifiable information in training data
- All sensor data anonymized
- Local inference only (no cloud dependency for real-time)
- Compliance with industry standards

## Troubleshooting

### Common Issues

1. **High Inference Latency**
   - Check Hailo-8 temperature (should be <70°C)
   - Verify model optimization settings
   - Monitor system resources with `htop`

2. **Model Disagreement**
   - Normal for edge cases
   - Apollo makes final decision based on confidence
   - Review specialist outputs for patterns

3. **Memory Issues**
   - Reduce inference batch size
   - Clear sensor buffer cache
   - Restart model service: `pm2 restart apollo-nexus`

4. **Hailo-8 Communication Errors**
   - Check M.2 connection
   - Update HailoRT: `sudo apt update && sudo apt upgrade hailort`
   - Power cycle the system

## Support and Resources

- **Documentation**: `/home/pi/docs/models/`
- **Model Metadata**: `/home/pi/models/metadata/`
- **Logs**: `/var/log/apollo/models/`
- **Performance Dashboard**: Port 3001 (Grafana)

## Future Enhancements

- **Federated Learning**: Edge devices contribute to model improvement
- **AutoML Integration**: Automated hyperparameter optimization
- **Model Compression**: Further size reduction without accuracy loss
- **Real-time Adaptation**: Online learning capabilities
- **Multi-site Coordination**: Cross-building optimization

---

**Note**: The actual model architectures, training data, and optimization techniques are proprietary to AutomataNexus, LLC. This documentation provides operational guidance for deployment and integration only.

*Developed by Andrew Jewett Sr. @ AutomataNexus, LLC*
*Copyright © 2024 AutomataNexus, LLC. All rights reserved.*
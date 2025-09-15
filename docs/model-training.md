# Nexus Apollo Model Training Guide

## Overview

The Nexus Apollo platform uses 8 specialized PyTorch models for HVAC fault detection and predictive maintenance. Models are trained using Google Colab's GPU infrastructure and deployed to Hailo-8 NPU on Raspberry Pi 5.

## Training Pipeline

### 1. Environment Setup (Google Colab)

Models are trained in Google Colab using proprietary datasets and algorithms. The training pipeline includes:

- **Data Source**: Historical sensor data from PostgreSQL and SQLite databases
- **Training Framework**: PyTorch with CUDA acceleration
- **Training Duration**: 48-72 hours per model on T4/A100 GPUs
- **Validation Split**: 80/20 train/validation with time-series aware splitting

### 2. Model Architecture Overview

The platform employs 8 specialized models:

1. **Apollo Primary Model**: Main fault detection and classification
2. **Compressor Failure Predictor**: Early detection of compressor issues
3. **Refrigerant Leak Detector**: Identify refrigerant loss patterns
4. **Energy Optimization Model**: Optimize setpoints for energy efficiency
5. **Filter Status Classifier**: Determine filter replacement needs
6. **Economizer Fault Detector**: Identify economizer damper issues
7. **Sensor Validation Network**: Detect sensor drift and failures
8. **Predictive Maintenance Scheduler**: Optimize maintenance scheduling

Each model is optimized for specific HVAC fault patterns and equipment types.

## Model Conversion Pipeline

### 1. PyTorch to ONNX Export

After training in Google Colab, models are exported to ONNX format:

```python
# Export trained model to ONNX
torch.onnx.export(
    model,
    dummy_input,
    "model.onnx",
    export_params=True,
    opset_version=11,
    do_constant_folding=True,
    input_names=['input'],
    output_names=['output'],
    dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}}
)
```

### 2. ONNX to HEF Conversion

Models are converted to Hailo Executable Format (.hef) for deployment:

```bash
# Step 1: Parse ONNX model
hailo parser onnx model.onnx --hw-arch hailo8

# Step 2: Optimize for Hailo-8
hailo optimize model.har --hw-arch hailo8 --calib-dataset calibration_data.npy

# Step 3: Compile to HEF
hailo compiler model_optimized.har --hw-arch hailo8
```

### 3. Deployment to Raspberry Pi 5

Transfer and deployment process:

```bash
# Transfer HEF file to Raspberry Pi
scp model.hef pi@nexus-apollo:/home/pi/models/

# Upload to Hailo-8 NPU
hailortcli fw-control identify
hailortcli fw-update model.hef
```

## Performance Specifications

### Inference Performance
- **Average Latency**: <100ms per inference
- **Throughput**: 50+ inferences per second
- **Power Consumption**: <5W during inference
- **Model Size**: 15-30MB per HEF file

### Accuracy Metrics
- **Fault Detection Accuracy**: 94.7%
- **False Positive Rate**: <2%
- **Compressor Failure Prediction**: 89% accuracy (7-day horizon)
- **Energy Optimization**: 15-20% energy reduction achieved

## Data Pipeline

### 1. Data Collection

Real-time sensor data is collected from:
- 21+ sensors per equipment unit
- 5-second sampling intervals
- Modbus TCP and GPIO interfaces
- Sequent Microsystems relay boards

### 2. Feature Engineering

Key features extracted for model training:
- Temperature differentials (superheat, subcooling)
- Pressure ratios and trends
- Electrical consumption patterns
- Vibration and acoustic signatures
- Historical maintenance records

### 3. Data Preprocessing

- Outlier detection and removal
- Missing value interpolation
- Normalization and scaling
- Time-series windowing (24-hour segments)

## Model Updates and Versioning

### Version Control
- Models versioned using semantic versioning (v1.x.x)
- Changelog maintained for each model update
- Rollback capability to previous versions

### Update Schedule
- Quarterly model retraining with accumulated data
- Monthly performance evaluation
- Emergency updates for critical issues

### Performance Monitoring
- Real-time accuracy tracking
- Drift detection algorithms
- Automated alerts for degraded performance

## Hardware Requirements

### Training Infrastructure (Google Colab)
- GPU: NVIDIA T4 or A100
- RAM: 25GB minimum
- Storage: 100GB for datasets
- Runtime: Colab Pro recommended

### Deployment Hardware (Raspberry Pi 5)
- Hailo-8 AI Accelerator (26 TOPS)
- 8GB RAM minimum
- 256GB NVMe SSD
- Active cooling required

## Security and Compliance

### Model Security
- Encrypted model storage
- Secure transfer protocols
- Access control and authentication
- Audit logging for all model operations

### Data Privacy
- No personally identifiable information in training data
- Aggregated and anonymized sensor readings
- Compliance with industry standards

## Integration with Nexus Apollo

### Model Serving
Models are served through the Express.js backend:
- REST API endpoints for inference requests
- WebSocket streaming for real-time predictions
- Batch processing for historical analysis

### Results Storage
Predictions stored in PostgreSQL with:
- Timestamp and confidence scores
- Equipment and sensor associations
- Alert generation for critical faults

## Monitoring and Diagnostics

### Model Health Checks
- Inference latency monitoring
- Memory usage tracking
- Temperature monitoring of Hailo-8
- Error rate tracking

### Diagnostic Tools
```bash
# Check Hailo-8 status
hailortcli fw-control identify

# Monitor inference performance
hailortcli monitor

# View model information
hailortcli parse-hef model.hef
```

## Troubleshooting

### Common Issues

1. **High Inference Latency**
   - Check Hailo-8 temperature
   - Verify model optimization settings
   - Monitor system resources

2. **Low Accuracy**
   - Validate input data quality
   - Check sensor calibration
   - Review recent model updates

3. **Memory Issues**
   - Reduce batch size
   - Implement model pruning
   - Clear inference cache

4. **Hailo-8 Communication Errors**
   - Check PCIe connection
   - Update Hailo drivers
   - Restart HailoRT service

## Support and Resources

- Internal documentation: `/home/pi/docs/models/`
- Hailo Developer Zone: https://hailo.ai/developer-zone/
- System logs: `/var/log/apollo/models/`
- Performance metrics: Grafana dashboard on port 3001

## Future Enhancements

- Federated learning for privacy-preserving updates
- Edge-to-cloud hybrid inference
- Multi-modal sensor fusion
- Automated hyperparameter optimization
- Real-time model adaptation
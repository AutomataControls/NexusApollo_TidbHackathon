# Sensor Calibration Guide

## Overview

Accurate sensor calibration is critical for the Nexus Apollo platform's fault detection and predictive maintenance capabilities. This guide covers calibration procedures for all supported sensor types.

## Supported Sensor Types

### Temperature Sensors
- **RTD PT100/PT1000**: 3/4-wire platinum resistance thermometers
- **Thermocouples**: Type K, J, T for high-temperature applications
- **Thermistors**: 10K NTC for space temperature monitoring
- **Digital**: DS18B20 one-wire sensors for distributed monitoring

### Pressure Sensors
- **Transducers**: 4-20mA output, 0-500 PSI range
- **Differential**: For filter status and airflow monitoring
- **Static**: Building pressure monitoring
- **Refrigerant**: High/low side pressure monitoring

### Current Sensors
- **Split-Core CTs**: 0-100A, 0-200A ranges
- **Solid-Core CTs**: Higher accuracy for permanent installations
- **Hall Effect**: DC current monitoring

### Flow Sensors
- **Ultrasonic**: Non-invasive pipe flow measurement
- **Turbine**: High-accuracy liquid flow
- **Differential Pressure**: Air flow through ducts

### Humidity Sensors
- **Capacitive**: ±2% RH accuracy
- **Resistive**: Lower cost, ±5% RH accuracy

## Calibration Equipment Required

### Essential Tools
- **Fluke 87V Multimeter**: For electrical measurements
- **Fluke 754 Process Calibrator**: For 4-20mA loop calibration
- **Precision RTD Simulator**: For temperature sensor calibration
- **Pressure Calibrator**: Fluke 719 or equivalent
- **Decade Resistance Box**: For RTD simulation
- **Current Source**: 0-24mA precision source

### Reference Standards
- **NIST-Traceable Thermometer**: ±0.1°F accuracy
- **Deadweight Tester**: For pressure calibration
- **Precision Resistors**: 0.01% tolerance for current shunt calibration

## Temperature Sensor Calibration

### RTD PT100 Calibration

```javascript
// calibration/rtd_calibration.js
const { exec } = require('child_process');
const fs = require('fs').promises;

class RTDCalibrator {
  constructor() {
    this.calibrationPoints = [
      { temp: 32, resistance: 100.00 },   // Ice point
      { temp: 77, resistance: 109.73 },   // Room temp
      { temp: 212, resistance: 138.51 }   // Boiling point
    ];
  }

  async calibrateSensor(channel, actualTemp) {
    // Read raw ADC value
    const rawValue = await this.readRawADC(channel);

    // Calculate resistance from ADC
    const resistance = this.adcToResistance(rawValue);

    // Apply Callendar-Van Dusen equation
    const calculatedTemp = this.resistanceToTemp(resistance);

    // Calculate offset
    const offset = actualTemp - calculatedTemp;

    // Store calibration
    await this.saveCalibration(channel, {
      offset,
      gain: 1.0,
      timestamp: new Date(),
      actualTemp,
      calculatedTemp,
      resistance
    });

    return {
      channel,
      offset,
      error: Math.abs(offset),
      resistance
    };
  }

  adcToResistance(adcValue) {
    // For 16-bit ADC with 2.5V reference and 1K reference resistor
    const vref = 2.5;
    const rref = 1000;
    const voltage = (adcValue / 65535) * vref;
    return (voltage * rref) / (vref - voltage);
  }

  resistanceToTemp(resistance) {
    // Callendar-Van Dusen equation for PT100
    const R0 = 100.0; // Resistance at 0°C
    const A = 3.9083e-3;
    const B = -5.775e-7;

    // Simplified equation for positive temperatures
    const temp = (-R0 * A + Math.sqrt(R0 * R0 * A * A - 4 * R0 * B * (R0 - resistance))) / (2 * R0 * B);

    // Convert to Fahrenheit
    return (temp * 9/5) + 32;
  }

  async readRawADC(channel) {
    return new Promise((resolve, reject) => {
      exec(`megabas 0 aread ${channel}`, (error, stdout) => {
        if (error) reject(error);
        resolve(parseInt(stdout));
      });
    });
  }

  async saveCalibration(channel, data) {
    const calibrationFile = `/home/pi/apollo-nexus/calibration/rtd_ch${channel}.json`;
    await fs.writeFile(calibrationFile, JSON.stringify(data, null, 2));
  }
}

// Usage
const calibrator = new RTDCalibrator();
calibrator.calibrateSensor(1, 72.5).then(result => {
  console.log('Calibration complete:', result);
});
```

### Multi-Point Calibration

```javascript
// calibration/multipoint_calibration.js
class MultiPointCalibration {
  constructor() {
    this.points = [];
  }

  async performCalibration(channel, referencePoints) {
    const measurements = [];

    for (const point of referencePoints) {
      console.log(`Apply ${point.reference}°F to sensor ${channel}`);
      console.log('Press Enter when stable...');
      await this.waitForInput();

      const reading = await this.readSensor(channel);
      measurements.push({
        reference: point.reference,
        measured: reading,
        error: reading - point.reference
      });
    }

    // Calculate correction coefficients using least squares
    const correction = this.calculateCorrection(measurements);

    // Apply and save calibration
    await this.applyCalibration(channel, correction);

    return {
      channel,
      measurements,
      correction,
      rmsError: this.calculateRMSError(measurements)
    };
  }

  calculateCorrection(measurements) {
    // Linear regression for offset and gain
    const n = measurements.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    measurements.forEach(m => {
      sumX += m.measured;
      sumY += m.reference;
      sumXY += m.measured * m.reference;
      sumX2 += m.measured * m.measured;
    });

    const gain = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const offset = (sumY - gain * sumX) / n;

    return { gain, offset };
  }

  calculateRMSError(measurements) {
    const squaredErrors = measurements.map(m => Math.pow(m.error, 2));
    const meanSquaredError = squaredErrors.reduce((a, b) => a + b, 0) / measurements.length;
    return Math.sqrt(meanSquaredError);
  }

  async applyCalibration(channel, correction) {
    const config = {
      channel,
      gain: correction.gain,
      offset: correction.offset,
      calibratedAt: new Date(),
      nextCalibrationDue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
    };

    await fs.writeFile(
      `/home/pi/apollo-nexus/calibration/sensor_${channel}.json`,
      JSON.stringify(config, null, 2)
    );
  }

  waitForInput() {
    return new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
  }

  async readSensor(channel) {
    // Read and return sensor value
    const raw = await this.readRawADC(channel);
    return this.convertToTemp(raw);
  }
}
```

## Pressure Sensor Calibration

### 4-20mA Pressure Transducer

```javascript
// calibration/pressure_calibration.js
class PressureCalibration {
  constructor() {
    this.rangeMin = 0;    // PSI
    this.rangeMax = 500;  // PSI
    this.currentMin = 4;  // mA
    this.currentMax = 20; // mA
  }

  async calibrateTransducer(channel) {
    console.log('Pressure Transducer Calibration');
    console.log('================================');

    // Zero point calibration
    console.log('Apply 0 PSI (atmospheric pressure)');
    await this.waitForStable();
    const zeroReading = await this.readCurrent(channel);

    // Span calibration
    console.log('Apply known pressure (use deadweight tester)');
    const knownPressure = await this.promptValue('Enter applied pressure (PSI): ');
    await this.waitForStable();
    const spanReading = await this.readCurrent(channel);

    // Calculate calibration factors
    const actualSpan = spanReading - zeroReading;
    const expectedSpan = (knownPressure / this.rangeMax) * (this.currentMax - this.currentMin);

    const calibration = {
      zeroOffset: this.currentMin - zeroReading,
      spanCorrection: expectedSpan / actualSpan,
      calibrationPressure: knownPressure,
      zeroReading,
      spanReading
    };

    await this.saveCalibration(channel, calibration);

    return calibration;
  }

  currentToPressure(current, calibration = null) {
    let correctedCurrent = current;

    if (calibration) {
      correctedCurrent = (current + calibration.zeroOffset) * calibration.spanCorrection;
    }

    // Linear scaling from 4-20mA to pressure range
    const pressure = ((correctedCurrent - this.currentMin) / (this.currentMax - this.currentMin)) *
                    (this.rangeMax - this.rangeMin) + this.rangeMin;

    return Math.max(0, pressure); // Ensure non-negative
  }

  async readCurrent(channel) {
    // Read voltage across 250Ω shunt resistor
    const voltage = await this.readVoltage(channel);
    return voltage / 0.250; // Convert to mA (V = I * R, R = 250Ω = 0.250kΩ)
  }

  async readVoltage(channel) {
    return new Promise((resolve, reject) => {
      exec(`megaind 0 uread ${channel}`, (error, stdout) => {
        if (error) reject(error);
        resolve(parseFloat(stdout));
      });
    });
  }

  async saveCalibration(channel, data) {
    const calibrationFile = `/home/pi/apollo-nexus/calibration/pressure_ch${channel}.json`;
    await fs.writeFile(calibrationFile, JSON.stringify({
      ...data,
      timestamp: new Date(),
      nextCalibrationDue: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) // 6 months
    }, null, 2));
  }

  waitForStable() {
    return new Promise(resolve => {
      setTimeout(() => {
        console.log('Reading stabilized');
        resolve();
      }, 5000);
    });
  }

  promptValue(question) {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise(resolve => {
      readline.question(question, answer => {
        readline.close();
        resolve(parseFloat(answer));
      });
    });
  }
}
```

## Current Sensor Calibration

### Split-Core CT Calibration

```javascript
// calibration/ct_calibration.js
class CTCalibration {
  constructor() {
    this.ctRatio = 100; // 100:5 CT
    this.burdenResistor = 20; // Ohms
  }

  async calibrateCT(channel, actualCurrent) {
    // Read voltage across burden resistor
    const voltage = await this.readVoltage(channel);

    // Calculate secondary current
    const secondaryCurrent = voltage / this.burdenResistor;

    // Calculate primary current
    const measuredCurrent = secondaryCurrent * this.ctRatio;

    // Calculate correction factor
    const correctionFactor = actualCurrent / measuredCurrent;

    const calibration = {
      channel,
      ctRatio: this.ctRatio,
      burdenResistor: this.burdenResistor,
      correctionFactor,
      actualCurrent,
      measuredCurrent,
      error: Math.abs(actualCurrent - measuredCurrent),
      errorPercent: (Math.abs(actualCurrent - measuredCurrent) / actualCurrent) * 100
    };

    await this.saveCalibration(channel, calibration);

    return calibration;
  }

  async performPhaseCalibration(channel) {
    // For power factor correction
    console.log('Phase Angle Calibration');
    console.log('Apply known resistive load (unity power factor)');

    const voltage = await this.readVoltage(channel);
    const current = await this.readCurrent(channel);

    // Sample voltage and current simultaneously
    const samples = await this.collectSamples(channel, 1000); // 1000 samples

    // Calculate phase shift using FFT
    const phaseShift = this.calculatePhaseShift(samples);

    return {
      channel,
      phaseShift,
      correctionAngle: -phaseShift // Correction to apply
    };
  }

  calculatePhaseShift(samples) {
    // Simplified phase calculation using zero-crossing detection
    let voltageZeroCrossings = [];
    let currentZeroCrossings = [];

    for (let i = 1; i < samples.length; i++) {
      // Detect voltage zero crossings
      if (samples[i-1].voltage < 0 && samples[i].voltage >= 0) {
        voltageZeroCrossings.push(i);
      }

      // Detect current zero crossings
      if (samples[i-1].current < 0 && samples[i].current >= 0) {
        currentZeroCrossings.push(i);
      }
    }

    // Calculate average phase difference
    let phaseDiff = 0;
    const comparisons = Math.min(voltageZeroCrossings.length, currentZeroCrossings.length);

    for (let i = 0; i < comparisons; i++) {
      phaseDiff += currentZeroCrossings[i] - voltageZeroCrossings[i];
    }

    // Convert sample difference to degrees
    const samplesPerCycle = samples.length / 10; // Assuming 10 cycles captured
    const phaseShiftDegrees = (phaseDiff / comparisons) * (360 / samplesPerCycle);

    return phaseShiftDegrees;
  }

  async collectSamples(channel, count) {
    const samples = [];
    for (let i = 0; i < count; i++) {
      const voltage = await this.readVoltage(channel);
      const current = await this.readCurrent(channel);
      samples.push({ voltage, current, timestamp: Date.now() });
    }
    return samples;
  }

  async saveCalibration(channel, data) {
    const calibrationFile = `/home/pi/apollo-nexus/calibration/ct_ch${channel}.json`;
    await fs.writeFile(calibrationFile, JSON.stringify({
      ...data,
      timestamp: new Date(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
    }, null, 2));
  }
}
```

## Automated Calibration System

### Calibration Scheduler

```javascript
// calibration/scheduler.js
const cron = require('node-cron');
const { Pool } = require('pg');

class CalibrationScheduler {
  constructor() {
    this.pool = new Pool({
      host: 'localhost',
      database: 'apollo_nexus',
      user: 'DevOps',
      password: 'Invertedskynet2$'
    });
  }

  async initialize() {
    // Create calibration tracking table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS sensor_calibrations (
        id SERIAL PRIMARY KEY,
        sensor_id VARCHAR(50) NOT NULL,
        sensor_type VARCHAR(50),
        channel INT,
        calibrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        next_calibration_due TIMESTAMP,
        calibration_data JSONB,
        performed_by VARCHAR(100),
        status VARCHAR(20) DEFAULT 'pending'
      )
    `);

    // Schedule daily calibration check
    cron.schedule('0 6 * * *', () => {
      this.checkCalibrationsDue();
    });

    // Schedule monthly drift check
    cron.schedule('0 0 1 * *', () => {
      this.performDriftAnalysis();
    });
  }

  async checkCalibrationsDue() {
    const result = await this.pool.query(`
      SELECT * FROM sensor_calibrations
      WHERE next_calibration_due <= NOW() + INTERVAL '7 days'
      AND status = 'active'
    `);

    for (const sensor of result.rows) {
      await this.notifyCalibrationDue(sensor);
    }
  }

  async performDriftAnalysis() {
    // Analyze sensor drift over time
    const result = await this.pool.query(`
      SELECT
        sensor_id,
        sensor_type,
        calibration_data->>'offset' as offset,
        calibration_data->>'gain' as gain,
        calibrated_at
      FROM sensor_calibrations
      WHERE calibrated_at > NOW() - INTERVAL '1 year'
      ORDER BY sensor_id, calibrated_at
    `);

    const driftAnalysis = this.analyzeDrift(result.rows);
    await this.saveDriftReport(driftAnalysis);
  }

  analyzeDrift(calibrations) {
    const sensorDrift = {};

    // Group by sensor
    calibrations.forEach(cal => {
      if (!sensorDrift[cal.sensor_id]) {
        sensorDrift[cal.sensor_id] = {
          offsets: [],
          gains: [],
          dates: []
        };
      }

      sensorDrift[cal.sensor_id].offsets.push(parseFloat(cal.offset));
      sensorDrift[cal.sensor_id].gains.push(parseFloat(cal.gain));
      sensorDrift[cal.sensor_id].dates.push(cal.calibrated_at);
    });

    // Calculate drift rates
    const analysis = {};
    Object.keys(sensorDrift).forEach(sensorId => {
      const data = sensorDrift[sensorId];

      if (data.offsets.length > 1) {
        const offsetDrift = this.calculateDriftRate(data.offsets, data.dates);
        const gainDrift = this.calculateDriftRate(data.gains, data.dates);

        analysis[sensorId] = {
          offsetDriftRate: offsetDrift,
          gainDriftRate: gainDrift,
          recommendedCalibrationInterval: this.recommendInterval(offsetDrift, gainDrift)
        };
      }
    });

    return analysis;
  }

  calculateDriftRate(values, dates) {
    // Linear regression to find drift rate
    const n = values.length;
    const x = dates.map(d => new Date(d).getTime());
    const y = values;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += x[i];
      sumY += y[i];
      sumXY += x[i] * y[i];
      sumX2 += x[i] * x[i];
    }

    // Drift rate (change per day)
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope * 86400000; // Convert to per day
  }

  recommendInterval(offsetDrift, gainDrift) {
    // Recommend calibration interval based on drift rate
    const maxDrift = Math.max(Math.abs(offsetDrift), Math.abs(gainDrift));

    if (maxDrift < 0.001) return 365; // Annual
    if (maxDrift < 0.01) return 180;  // Semi-annual
    if (maxDrift < 0.1) return 90;    // Quarterly
    return 30; // Monthly
  }

  async notifyCalibrationDue(sensor) {
    // Send notification via email or system alert
    console.log(`Calibration due for sensor: ${sensor.sensor_id}`);

    // Update database
    await this.pool.query(`
      UPDATE sensor_calibrations
      SET status = 'due'
      WHERE id = $1
    `, [sensor.id]);
  }

  async saveDriftReport(analysis) {
    const reportPath = `/home/pi/apollo-nexus/reports/drift_analysis_${Date.now()}.json`;
    await fs.writeFile(reportPath, JSON.stringify(analysis, null, 2));
  }
}
```

## Field Calibration Procedures

### Pre-Calibration Checklist

```markdown
## Sensor Calibration Checklist

### Preparation
- [ ] Equipment powered off and locked out
- [ ] Calibration equipment verified and within calibration date
- [ ] Reference standards available
- [ ] Calibration forms/software ready
- [ ] Safety equipment (PPE) available

### Environmental Conditions
- [ ] Temperature: 68-77°F (record: ___°F)
- [ ] Humidity: 30-70% RH (record: ___%)
- [ ] No excessive vibration
- [ ] No electromagnetic interference

### Sensor Inspection
- [ ] Visual inspection - no damage
- [ ] Connections secure
- [ ] Wiring intact
- [ ] Mounting secure
- [ ] No contamination or debris

### Documentation
- [ ] Previous calibration records reviewed
- [ ] Drift analysis reviewed
- [ ] As-found readings recorded
- [ ] As-left readings recorded
- [ ] Calibration certificate completed
```

### Step-by-Step RTD Calibration

```bash
#!/bin/bash
# field_calibration.sh

echo "==================================="
echo "Nexus Apollo RTD Field Calibration"
echo "==================================="

# Step 1: Record as-found readings
echo "Step 1: Recording as-found readings..."
node /home/pi/apollo-nexus/calibration/record_as_found.js

# Step 2: Disconnect sensor
echo "Step 2: Disconnect RTD from terminals"
read -p "Press Enter when disconnected..."

# Step 3: Measure sensor resistance
echo "Step 3: Measure RTD resistance at current temperature"
read -p "Enter measured resistance (Ohms): " resistance
read -p "Enter reference temperature (°F): " temp

# Step 4: Connect calibrator
echo "Step 4: Connect decade resistance box to input terminals"
read -p "Press Enter when connected..."

# Step 5: Apply calibration points
echo "Step 5: Applying calibration points..."

# Ice point (32°F = 100.00Ω for PT100)
echo "Set resistance to 100.00Ω (32°F)"
read -p "Press Enter when stable..."
node /home/pi/apollo-nexus/calibration/capture_point.js 1 32 100.00

# Room temp (77°F = 109.73Ω for PT100)
echo "Set resistance to 109.73Ω (77°F)"
read -p "Press Enter when stable..."
node /home/pi/apollo-nexus/calibration/capture_point.js 1 77 109.73

# High point (212°F = 138.51Ω for PT100)
echo "Set resistance to 138.51Ω (212°F)"
read -p "Press Enter when stable..."
node /home/pi/apollo-nexus/calibration/capture_point.js 1 212 138.51

# Step 6: Calculate and apply corrections
echo "Step 6: Calculating calibration corrections..."
node /home/pi/apollo-nexus/calibration/apply_corrections.js 1

# Step 7: Reconnect sensor
echo "Step 7: Reconnect RTD sensor"
read -p "Press Enter when connected..."

# Step 8: Verify calibration
echo "Step 8: Verifying calibration..."
node /home/pi/apollo-nexus/calibration/verify_calibration.js 1

echo "Calibration complete!"
echo "Certificate saved to: /home/pi/apollo-nexus/calibration/certificates/"
```

## Calibration Validation

### Accuracy Verification

```javascript
// calibration/validation.js
class CalibrationValidator {
  constructor() {
    this.tolerances = {
      temperature: 1.0,  // ±1°F
      pressure: 2.0,     // ±2% of span
      current: 1.0,      // ±1% of reading
      humidity: 3.0      // ±3% RH
    };
  }

  async validateCalibration(sensorType, channel) {
    const testPoints = this.getTestPoints(sensorType);
    const results = [];

    for (const point of testPoints) {
      // Apply reference
      console.log(`Apply ${point.reference} ${point.unit}`);
      await this.waitForStable();

      // Read sensor
      const reading = await this.readCalibratedValue(channel);

      // Calculate error
      const error = reading - point.reference;
      const errorPercent = (error / point.reference) * 100;

      // Check tolerance
      const passed = Math.abs(errorPercent) <= this.tolerances[sensorType];

      results.push({
        reference: point.reference,
        reading,
        error,
        errorPercent,
        passed
      });
    }

    // Generate report
    const report = {
      sensorType,
      channel,
      timestamp: new Date(),
      results,
      overallPass: results.every(r => r.passed),
      maxError: Math.max(...results.map(r => Math.abs(r.errorPercent)))
    };

    await this.saveValidationReport(report);

    return report;
  }

  getTestPoints(sensorType) {
    const points = {
      temperature: [
        { reference: 32, unit: '°F' },
        { reference: 77, unit: '°F' },
        { reference: 150, unit: '°F' },
        { reference: 212, unit: '°F' }
      ],
      pressure: [
        { reference: 0, unit: 'PSI' },
        { reference: 125, unit: 'PSI' },
        { reference: 250, unit: 'PSI' },
        { reference: 375, unit: 'PSI' },
        { reference: 500, unit: 'PSI' }
      ],
      current: [
        { reference: 0, unit: 'A' },
        { reference: 25, unit: 'A' },
        { reference: 50, unit: 'A' },
        { reference: 75, unit: 'A' },
        { reference: 100, unit: 'A' }
      ]
    };

    return points[sensorType] || [];
  }

  async saveValidationReport(report) {
    const filename = `validation_${report.sensorType}_${Date.now()}.json`;
    const filepath = `/home/pi/apollo-nexus/calibration/validation/${filename}`;

    await fs.writeFile(filepath, JSON.stringify(report, null, 2));

    // Update database
    await this.pool.query(`
      INSERT INTO calibration_validations
      (sensor_type, channel, validation_date, passed, max_error, report_path)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      report.sensorType,
      report.channel,
      report.timestamp,
      report.overallPass,
      report.maxError,
      filepath
    ]);
  }
}
```

## Calibration Certificates

### Certificate Generation

```javascript
// calibration/certificate.js
const PDFDocument = require('pdfkit');
const fs = require('fs');

class CalibrationCertificate {
  async generate(calibrationData) {
    const doc = new PDFDocument();
    const filename = `cert_${calibrationData.sensorId}_${Date.now()}.pdf`;
    const stream = fs.createWriteStream(`/home/pi/apollo-nexus/certificates/${filename}`);

    doc.pipe(stream);

    // Header
    doc.fontSize(20).text('Calibration Certificate', { align: 'center' });
    doc.fontSize(16).text('Nexus Apollo HVAC Intelligence Platform', { align: 'center' });
    doc.moveDown();

    // Certificate number
    doc.fontSize(12).text(`Certificate No: ${this.generateCertNumber()}`);
    doc.text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();

    // Equipment details
    doc.fontSize(14).text('Equipment Details', { underline: true });
    doc.fontSize(12);
    doc.text(`Sensor ID: ${calibrationData.sensorId}`);
    doc.text(`Sensor Type: ${calibrationData.sensorType}`);
    doc.text(`Channel: ${calibrationData.channel}`);
    doc.text(`Location: ${calibrationData.location}`);
    doc.moveDown();

    // Calibration results
    doc.fontSize(14).text('Calibration Results', { underline: true });
    doc.fontSize(12);

    // Results table
    const tableTop = doc.y;
    const tableHeaders = ['Test Point', 'Reference', 'As Found', 'As Left', 'Error'];

    // Draw table...
    calibrationData.results.forEach((result, i) => {
      const y = tableTop + (i + 1) * 20;
      doc.text(result.testPoint, 50, y);
      doc.text(result.reference.toString(), 150, y);
      doc.text(result.asFound.toString(), 250, y);
      doc.text(result.asLeft.toString(), 350, y);
      doc.text(`${result.error}%`, 450, y);
    });

    doc.moveDown(calibrationData.results.length * 2);

    // Certification
    doc.fontSize(14).text('Certification', { underline: true });
    doc.fontSize(12);
    doc.text('This certifies that the above instrument has been calibrated using standards traceable to NIST.');
    doc.text(`Next calibration due: ${calibrationData.nextDue}`);
    doc.moveDown();

    // Signature
    doc.text(`Calibrated by: ${calibrationData.technician}`);
    doc.text(`Signature: _________________________`);

    doc.end();

    return filename;
  }

  generateCertNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `NAC-${year}${month}-${random}`;
  }
}
```

## Troubleshooting Calibration Issues

### Common Problems and Solutions

1. **Unstable Readings**
   - Check for loose connections
   - Verify proper shielding on sensor cables
   - Allow adequate settling time
   - Check for EMI interference

2. **Non-Linear Response**
   - Perform multi-point calibration
   - Check sensor specifications
   - Verify input circuit design
   - Consider polynomial correction

3. **Drift Between Calibrations**
   - Analyze environmental factors
   - Check sensor age and condition
   - Review historical calibration data
   - Consider more frequent calibration

4. **Calibration Out of Range**
   - Verify sensor specifications
   - Check reference standard accuracy
   - Inspect for sensor damage
   - Review wiring and connections

## Best Practices

1. **Documentation**
   - Record all calibration data
   - Maintain calibration history
   - Document environmental conditions
   - Track calibration equipment certification

2. **Quality Assurance**
   - Use NIST-traceable standards
   - Perform validation after calibration
   - Implement peer review process
   - Regular audit of procedures

3. **Preventive Maintenance**
   - Regular sensor cleaning
   - Periodic connection checks
   - Environmental protection
   - Spare sensor inventory

4. **Training**
   - Technician certification program
   - Regular procedure updates
   - Safety training
   - Equipment operation training
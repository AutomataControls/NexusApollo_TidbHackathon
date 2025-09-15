# Apollo Nexus™ Sensor Integration Guide

## Overview

Apollo Nexus supports a wide variety of sensors through multiple hardware interfaces including Sequent Microsystems boards and RS485 devices. This guide covers the integration of various sensor types for comprehensive HVAC monitoring.

## Supported Sensor Types

### 1. Air Velocity Sensors
- **Siemens QVM62.1**: 0-10V output air velocity sensor
  - Ranges: 0-16 ft/s, 0-33 ft/s, 0-49 ft/s
  - Connection: 0-10V input on MegaBAS or 16-UNIV-IN boards
  - Applications: Duct airflow monitoring, VAV control verification

### 2. Differential Pressure Sensors
- **Veris PX3DLX02**: Bluetooth-enabled differential pressure/air velocity transducer
  - Ranges: 0-0.1" to 0-10" WC (7 selectable ranges)
  - Connection: 0-10V input on MegaBAS or 16-UNIV-IN boards
  - Applications: Filter status, duct static pressure, building pressure

### 3. Refrigerant Pressure Sensors
- **Johnson Controls P499 Series**: Electronic pressure transducers for refrigerant monitoring
  - **P499VAP-105C**: 0-500 psi, 0-10V output, 1/8"-27 NPT fitting
  - **P499VAP-107C**: 0-750 psi, 0-10V output, 1/8"-27 NPT fitting
  - **P499VCP-105C**: 0-500 psi, 0-10V output, 1/4" SAE 45° flare fitting with depressor
  - **P499VCP-107C**: 0-750 psi, 0-10V output, 1/4" SAE 45° flare fitting with depressor
  - Connection: 0-10V input on MegaBAS or 16-UNIV-IN boards
  - Supply Voltage: 12-30 VDC
  - Accuracy: ±1% full span over compensated temperature range
  - Applications: Refrigerant high/low side pressure monitoring, compressor protection, system diagnostics
  - Media Compatibility: All media compatible with 17-4PH stainless steel, including ammonia and most refrigerants

### 4. Temperature Sensors
- **Belimo 10K-2 NTC**: Duct air temperature sensor
  - Range: -50°C to 150°C (-58°F to 302°F)
  - Connection: 10K thermistor input on MegaBAS board
  - Applications: Supply/return air temperature monitoring
  
- **Belimo 01CT-5LL**: Cable temperature sensor
  - Range: -40°C to 150°C (-40°F to 300°F)
  - Connection: 10K thermistor input on MegaBAS board
  - Applications: Water temperature, refrigerant line temperature

### 5. Current Transformers
- **Generic 0-10V CT**: User-scalable current transformers
  - Ranges: 0-20A, 0-50A, 0-100A (user selectable)
  - Connection: 0-10V input on any universal input board
  - Applications: Motor current monitoring, power consumption

### 6. Power Meters (Previously Integrated)
- **SELEC MFM384**: 3-phase power analyzer via RS485
- **WitMotion WT901C485**: Vibration sensor via RS485

## Hardware Connection Guide

### Sequent MegaBAS Board
- **8 Universal Inputs**: Support 0-10V, 10K thermistor, PT1000, dry contact
- **I2C Address**: 0x20-0x27 (stack addressable)
- **Supported Sensors**:
  - QVM62.1 Air Velocity (0-10V mode)
  - PX3DLX02 Differential Pressure (0-10V mode)
  - P499 Refrigerant Pressure (0-10V mode)
  - Belimo Temperature Sensors (10K-3 mode)
  - Current Transformers (0-10V mode)

### Sequent 16-UNIV-IN Board
- **16 Universal Inputs**: Support 0-10V, 0-20mA, 4-20mA, PT1000
- **I2C Address**: 0x40-0x47 (stack addressable)
- **Higher channel count for large installations**

## Configuration Process

### 1. Hardware Setup
```bash
# Verify board detection
i2cdetect -y 1

# Expected output shows addresses like:
# 0x20 - MegaBAS board
# 0x40 - 16-UNIV-IN board
```

### 2. Sensor Configuration in Apollo Nexus

1. Navigate to **Sensors** page
2. Select the equipment to configure
3. Click **Add Sensor**
4. Configure the following:
   - **Sensor Name**: Descriptive name (e.g., "Supply Air Velocity", "Refrigerant High Side Pressure")
   - **Sensor Type**: Select from dropdown (Air Velocity, Differential Pressure, Refrigerant Pressure, etc.)
   - **Sensor Model**: Select specific model (QVM62.1, PX3DLX02, P499VAP-105C, etc.)
   - **Board Type**: MegaBAS or 16-UNIV-IN
   - **Board Address**: I2C address of the board
   - **Channel**: Input channel number (1-8 for MegaBAS, 1-16 for 16-UNIV-IN)
   - **Input Range**: Match to sensor type (0-10V, 10K-3, etc.)
   - **Measurement Range**: For models with multiple ranges
   - **Units**: Automatically set based on sensor type
   - **Scaling**: For 0-10V inputs, set min/max values
   - **Alarms**: Optional high/low alarm thresholds

### 3. Wiring Examples

#### QVM62.1 Air Velocity Sensor
```
QVM62.1 Terminal Block:
G  -> 24VAC
M  -> Common/Ground
U1 -> MegaBAS Channel Input (0-10V mode)
```

#### PX3DLX02 Differential Pressure
```
PX3DLX02 Terminals:
PWR -> 24VAC/DC
GND -> Common
VOUT -> MegaBAS Channel Input (0-10V mode)
```

#### P499 Refrigerant Pressure Transducer
```
P499 with Packard Connector (requires WHA-PKD3-200C wire harness):
Red Wire (SUPPLY)   -> 24VDC Power Supply
White Wire (OUTPUT) -> MegaBAS Channel Input (0-10V mode)
Black Wire (COMMON) -> Common/Ground

Pressure Connection:
- Style 49: 1/8"-27 NPT external thread
- Style 47: 1/4" SAE 45° flare with Schrader depressor
```

#### Belimo 10K Temperature Sensor
```
10K-2 Sensor:
Wire 1 -> MegaBAS Channel + (10K-3 mode)
Wire 2 -> MegaBAS Channel -
```

## Scaling and Calibration

### 0-10V Sensor Scaling
For sensors with 0-10V output, the scaling formula is:
```
Actual Value = Scale Min + (Voltage / 10) × (Scale Max - Scale Min)
```

Example for QVM62.1 set to 0-33 ft/s range:
- Scale Min: 0
- Scale Max: 33
- At 5V input: Actual = 0 + (5/10) × (33-0) = 16.5 ft/s

### P499 Refrigerant Pressure Scaling Examples
**P499VAP-105C (0-500 psi):**
- Scale Min: 0
- Scale Max: 500
- At 7V input: Actual = 0 + (7/10) × (500-0) = 350 psi

**P499VAP-107C (0-750 psi):**
- Scale Min: 0
- Scale Max: 750
- At 4V input: Actual = 0 + (4/10) × (750-0) = 300 psi

### Temperature Sensor Conversion
10K Type 3 thermistors use the Steinhart-Hart equation:
```javascript
// Automatic conversion in hardware manager
const kelvin = 1 / (A + B * ln(R) + C * ln(R)³)
const fahrenheit = (kelvin - 273.15) × 9/5 + 32
```

### Calibration Options
- **Offset**: Add/subtract a fixed value from readings
- **Scale**: Multiply readings by a factor
- Formula: `Final Value = (Raw Value × Scale) + Offset`

## Testing and Verification

### 1. Use the Test Sensor Feature
- Click "Test Sensor" button in configuration
- Verifies hardware communication
- Displays current reading

### 2. Real-time Monitoring
- Navigate to Dashboard
- View live sensor values
- Check trend graphs

### 3. Troubleshooting Common Issues

**No Reading / Communication Error**:
- Verify I2C address with `i2cdetect -y 1`
- Check wiring connections
- Ensure correct input range selected
- For P499: Verify 12-30VDC supply voltage present

**Incorrect Values**:
- Verify scaling parameters
- Check sensor range selection
- Use calibration offset if needed
- For P499: Confirm pressure range matches sensor model

**Unstable Readings**:
- Add shielded cable for 0-10V signals
- Ensure proper grounding
- Check for electrical interference
- For P499: Avoid severe pressure pulsations on high-side connections

## Best Practices

1. **Sensor Naming Convention**:
   - Use location + measurement type
   - Examples: "AHU1_Supply_Temp", "Chiller_Discharge_Pressure", "Compressor1_High_Side_Pressure"

2. **Channel Organization**:
   - Group similar sensors on same board
   - Reserve channels 1-4 for critical measurements
   - Document channel assignments

3. **Alarm Settings**:
   - Set alarms 10% beyond normal operating range
   - Use severity levels appropriately
   - Test alarm notifications
   - For refrigerant pressures: Set high pressure cutouts and low pressure alarms based on system requirements

4. **Maintenance**:
   - Calibrate sensors annually
   - Document calibration dates
   - Keep spare sensors for critical points
   - For P499: Perform leak tests after installation

5. **P499 Installation Guidelines**:
   - Mount on top side of refrigerant lines to prevent oil accumulation
   - Position away from compressor discharge to avoid pressure pulsations
   - Use proper torque on fittings to prevent leaks
   - Ensure environmental protection (IP67 rated)

## Integration with Apollo AI

All sensor data feeds into the Apollo fault detection model:
- Air velocity changes indicate damper/fan issues
- Pressure differentials reveal filter loading
- Temperature patterns identify refrigeration problems
- Current monitoring detects motor issues
- **Refrigerant pressure monitoring enables**:
  - Low refrigerant charge detection
  - High pressure cutout protection
  - Compressor efficiency analysis
  - System performance optimization
  - Predictive maintenance for refrigeration components

The AI continuously analyzes sensor relationships to predict failures before they occur.

## API Reference

### Read Sensor Configuration
```http
GET /api/sensors/config?equipment_id=123
```

### Test Sensor
```http
POST /api/sensors/test
{
  "sensor_type": "refrigerant_pressure",
  "sensor_model": "P499VAP-105C",
  "board_type": "megabas",
  "board_address": 32,
  "channel": 1,
  "input_range": "0-10V",
  "scale_min": 0,
  "scale_max": 500
}
```

### Real-time Data
```javascript
// WebSocket connection
socket.on('sensor-update', (data) => {
  console.log('Sensor readings:', data.sensors);
});
```
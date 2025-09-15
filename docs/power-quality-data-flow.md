# Power Quality Data Flow Documentation

## Overview
This document details the complete data flow for the Power Quality tab in the Nexus Apollo HVAC monitoring portal, tracing sensor data from hardware collection to calculated results displayed in the UI.

## Data Flow Architecture

### 1. Hardware Layer - SELEC MFM384 Power Meter

**Location**: `/home/Automata/mydata/apollo-nexus/portal/hardware/selecMFM384.js`

The SELEC MFM384 is a 3-phase power meter that connects via RS485 Modbus RTU interface and provides comprehensive electrical measurements.

#### Primary Sensor Readings:
- **Voltage (V)**: Line-to-neutral voltages for L1, L2, L3 and average
- **Current (A)**: Line currents for L1, L2, L3, neutral, and average  
- **Power (kW)**: Real power per phase and total
- **Reactive Power (kVAR)**: Reactive power per phase and total
- **Apparent Power (kVA)**: Apparent power per phase and total
- **Power Factor**: Per phase and average power factor
- **Frequency (Hz)**: System frequency
- **Energy (kWh)**: Import, export, and total energy counters
- **THD**: Total Harmonic Distortion for voltage and current

#### Modbus Register Map:
```javascript
VOLTAGE_L1: 0x0000    // L1-N voltage
VOLTAGE_L2: 0x0002    // L2-N voltage  
VOLTAGE_L3: 0x0004    // L3-N voltage
CURRENT_L1: 0x0010    // L1 current
CURRENT_L2: 0x0012    // L2 current
CURRENT_L3: 0x0014    // L3 current
POWER_TOTAL: 0x0020   // Total real power
REACTIVE_TOTAL: 0x0028 // Total reactive power
APPARENT_TOTAL: 0x0030 // Total apparent power
PF_AVG: 0x0038        // Average power factor
FREQUENCY: 0x003A     // System frequency
```

### 2. Hardware Manager Layer

**Location**: `/home/Automata/mydata/apollo-nexus/portal/hardware/hardwareManager.js`

The Hardware Manager acts as an abstraction layer between the specific hardware drivers and the application:

#### Key Functions:
- `readSensor(config)` - Reads individual sensor values based on configuration
- `readAllSensors(equipmentId)` - Reads all configured sensors for equipment
- `addPowerMeter(config)` - Initializes SELEC MFM384 power meters

#### Data Processing:
1. Raw Modbus register values are converted from 16-bit registers to 32-bit floats
2. CT/PT ratio scaling is applied for current and voltage transformers
3. Calibration scaling and offset are applied: `(rawValue * scale) + offset`
4. Values are packaged with units and timestamp

### 3. API Layer - Real-time Data Endpoint

**Location**: `/home/Automata/mydata/apollo-nexus/portal/src/routes/energy.js:145-196`

The `/api/energy/realtime` endpoint provides current power quality data:

#### Data Collection Process:
1. Queries SQLite `sensor_readings` table for latest readings within 5 minutes
2. Groups sensor data by equipment ID
3. Extracts electrical parameters from JSON sensor values:
   ```javascript
   if (sensor.name.includes('VOLTAGE_L1')) powerData.voltage.L1 = sensor.value;
   if (sensor.name.includes('CURRENT_L1')) powerData.current.L1 = sensor.value;
   if (sensor.name.includes('POWER_FACTOR')) powerData.powerFactor = sensor.value;
   ```

#### Data Storage Format:
Sensor readings are stored in SQLite with this structure:
```sql
CREATE TABLE sensor_readings (
  id INTEGER PRIMARY KEY,
  equipment_id INTEGER,
  sensor_data TEXT,  -- JSON containing all sensor values
  timestamp DATETIME
);
```

### 4. Frontend Data Processing

**Location**: `/home/Automata/mydata/apollo-nexus/apollo-ui/src/app/dashboard/energy/page.tsx:804-932`

The Power Quality tab calculates derived electrical parameters from base measurements:

#### Base Measurements (from API):
- `realtimePower.voltage.L1/L2/L3` - Phase voltages
- `realtimePower.current.L1/L2/L3` - Phase currents  
- `realtimePower.currentPower` - Total real power
- `realtimePower.powerFactor` - Power factor
- `realtimePower.frequency` - System frequency

#### Calculated Values:

**1. Apparent Power (kVA)**
```javascript
// Formula: S = P / cos(φ) where P = real power, φ = power factor angle
apparentPower = realtimePower.currentPower / realtimePower.powerFactor
```

**2. Reactive Power (kVAR)**  
```javascript
// Formula: Q = P × tan(φ) where φ = arccos(power factor)
reactivePower = realtimePower.currentPower * Math.tan(Math.acos(realtimePower.powerFactor))
```

**3. Load Balance (%)**
```javascript
// Calculates phase imbalance based on current differences
const maxDiff = Math.max(
  Math.abs(current.L1 - current.L2),
  Math.abs(current.L2 - current.L3), 
  Math.abs(current.L3 - current.L1)
);
const maxCurrent = Math.max(current.L1, current.L2, current.L3);
loadBalance = 100 - (maxDiff / maxCurrent * 100);
```

#### Quality Indicators:
- **Voltage**: Green badge if within ±5% of nominal (120V), red if outside range
- **Power Factor**: Green if > 0.9, gray if lower  
- **Frequency**: Green if within ±0.5 Hz of 60 Hz, red if outside range

### 5. Real-time Updates

**Protocol**: WebSocket via Socket.IO
**Update Frequency**: Every 5 seconds (configurable)

The frontend subscribes to real-time power updates and refreshes the Power Quality display automatically.

## Data Flow Summary

```
SELEC MFM384 → Hardware Manager → SQLite Database → API Endpoint → Frontend Calculations → UI Display
     ↓              ↓                ↓               ↓              ↓                    ↓
Raw Modbus     Scaled Values    JSON Storage    REST API    Derived Values      Live Dashboard
Registers      + Calibration    with Timestamp   Response    + Quality Checks    with Indicators
```

## Key Technical Details

1. **Data Persistence**: High-frequency sensor readings stored in SQLite for performance
2. **Real-time**: WebSocket connection provides live updates every 5 seconds
3. **Calculations**: Frontend performs electrical calculations for derived parameters
4. **Quality Monitoring**: Color-coded indicators show parameter health status
5. **Three-phase Support**: Full support for L1, L2, L3 phase monitoring
6. **Precision**: All values displayed with appropriate decimal precision (1-2 places)

## Error Handling

- Missing sensors return default values (0.0)
- Hardware communication failures are logged and return null values
- Frontend uses optional chaining (`?.`) to prevent crashes on missing data
- Quality indicators turn red to alert users of out-of-range conditions
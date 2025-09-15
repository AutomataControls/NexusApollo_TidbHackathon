-- PostgreSQL schema for customer and equipment data
-- Database: apollo_nexus

-- User authentication table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    email VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer information
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),
    country VARCHAR(100) DEFAULT 'USA',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Equipment types
CREATE TABLE IF NOT EXISTS equipment_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50), -- 'chiller', 'ahu', 'vrf', 'boiler', etc.
    manufacturer VARCHAR(100),
    model_prefix VARCHAR(50)
);

-- Equipment installations
CREATE TABLE IF NOT EXISTS equipment (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    location_name VARCHAR(255) NOT NULL,
    equipment_type VARCHAR(100),
    manufacturer VARCHAR(100),
    model_number VARCHAR(100),
    serial_number VARCHAR(100) UNIQUE,
    install_date DATE,
    warranty_expiry DATE,
    refrigerant_type VARCHAR(20), -- 'R22', 'R410A', 'R407C', etc.
    refrigerant_amount DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sensor configurations
CREATE TABLE IF NOT EXISTS sensor_configs (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
    sensor_name VARCHAR(100) NOT NULL,
    sensor_type VARCHAR(50) NOT NULL, -- 'voltage', 'current', 'temperature', 'pressure', 'flow', 'vibration', 'air_velocity', 'differential_pressure', etc.
    sensor_model VARCHAR(50), -- 'QVM62.1', 'PX3DLX02', '10K-2', '01CT-5LL', etc.
    board_type VARCHAR(50) NOT NULL, -- 'megabas', 'megaind', '16univin', 'witmotion', 'mfm384'
    board_address INTEGER NOT NULL, -- I2C address or Modbus address
    channel INTEGER,
    input_range VARCHAR(50), -- '0-10V', '10K-3', 'PT1000', etc.
    units VARCHAR(20) NOT NULL,
    calibration_offset DECIMAL(10,4) DEFAULT 0,
    calibration_scale DECIMAL(10,4) DEFAULT 1,
    scale_min DECIMAL(10,4), -- For 0-10V scaling
    scale_max DECIMAL(10,4), -- For 0-10V scaling
    alarm_low DECIMAL(10,4),
    alarm_high DECIMAL(10,4),
    enabled BOOLEAN DEFAULT true,
    port VARCHAR(50), -- For RS485 devices
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Maintenance logs
CREATE TABLE IF NOT EXISTS maintenance_logs (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER REFERENCES equipment(id),
    technician_name VARCHAR(255),
    service_date DATE,
    service_type VARCHAR(50), -- 'preventive', 'repair', 'emergency'
    description TEXT,
    parts_replaced TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fault history
CREATE TABLE IF NOT EXISTS fault_history (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER REFERENCES equipment(id),
    fault_type VARCHAR(100),
    severity INTEGER,
    detected_at TIMESTAMP,
    resolved_at TIMESTAMP,
    auto_detected BOOLEAN DEFAULT true,
    notes TEXT
);

-- Alarms table
CREATE TABLE IF NOT EXISTS alarms (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    source VARCHAR(100) NOT NULL,
    value VARCHAR(255),
    severity INTEGER NOT NULL CHECK (severity IN (1, 2, 3)),
    timestamp TIMESTAMP NOT NULL,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Diagnostic results table
CREATE TABLE IF NOT EXISTS diagnostic_results (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
    fault_predictions JSONB,
    efficiency_score DECIMAL(5,2),
    health_score INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Saved reports table
CREATE TABLE IF NOT EXISTS saved_reports (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    template VARCHAR(50) NOT NULL,
    parameters JSONB,
    data JSONB,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alarm recipients table
CREATE TABLE IF NOT EXISTS alarm_recipients (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    severity_threshold INTEGER DEFAULT 1,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Report schedules table
CREATE TABLE IF NOT EXISTS report_schedules (
    id SERIAL PRIMARY KEY,
    template VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    frequency VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
    time TIME NOT NULL,
    day_of_week INTEGER, -- 0-6 for weekly reports
    day_of_month INTEGER, -- 1-31 for monthly reports
    recipients TEXT[] NOT NULL,
    format VARCHAR(10) NOT NULL, -- 'pdf', 'excel', 'csv'
    parameters JSONB,
    created_by VARCHAR(100),
    enabled BOOLEAN DEFAULT true,
    last_run TIMESTAMP,
    next_run TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_equipment_customer ON equipment(customer_id);
CREATE INDEX idx_sensor_equipment ON sensor_configs(equipment_id);
CREATE INDEX idx_fault_equipment ON fault_history(equipment_id);
CREATE INDEX idx_fault_detected ON fault_history(detected_at);
CREATE INDEX idx_alarms_equipment ON alarms(equipment_id);
CREATE INDEX idx_alarms_timestamp ON alarms(timestamp);
CREATE INDEX idx_diagnostic_equipment ON diagnostic_results(equipment_id);

-- SQLite schema for high-frequency sensor data
-- File: sensor_data.db

/*
SQLite database for sensor readings
This is kept separate for performance and portability
*/

-- sensor_data.sql (SQLite)
CREATE TABLE IF NOT EXISTS sensor_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id INTEGER NOT NULL,
    timestamp REAL NOT NULL, -- Unix timestamp with microseconds
    sensor_values TEXT NOT NULL, -- JSON array of all sensor values
    fault_predictions TEXT, -- JSON array of fault predictions from Apollo
    efficiency_prediction REAL,
    power_prediction REAL
);

-- Create indexes for fast queries
CREATE INDEX idx_readings_equipment ON sensor_readings(equipment_id);
CREATE INDEX idx_readings_timestamp ON sensor_readings(timestamp);

-- Aggregated data for trending (1-minute averages)
CREATE TABLE IF NOT EXISTS sensor_trends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id INTEGER NOT NULL,
    timestamp INTEGER NOT NULL, -- Unix timestamp (minute precision)
    sensor_averages TEXT NOT NULL, -- JSON object with sensor averages
    fault_counts TEXT, -- JSON object with fault occurrence counts
    efficiency_avg REAL,
    power_avg REAL,
    UNIQUE(equipment_id, timestamp)
);

CREATE INDEX idx_trends_equipment ON sensor_trends(equipment_id);
CREATE INDEX idx_trends_timestamp ON sensor_trends(timestamp);
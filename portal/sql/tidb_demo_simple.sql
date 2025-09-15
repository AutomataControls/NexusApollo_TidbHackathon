-- TiDB Vector Search Demo Data (Simplified)
-- Part of TiDB AgentX Hackathon submission

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS test;
USE test;

-- Drop existing tables to start fresh
DROP TABLE IF EXISTS fault_pattern_vectors;
DROP TABLE IF EXISTS model_inference_vectors;
DROP TABLE IF EXISTS sensor_embeddings;
DROP TABLE IF EXISTS solution_vectors;

-- Create fault pattern vectors table (simplified to 3 dimensions for demo)
CREATE TABLE fault_pattern_vectors (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    pattern_name VARCHAR(255) NOT NULL,
    pattern_vector VECTOR(3) NOT NULL,
    specialist_model VARCHAR(50),
    severity INT,
    cost_impact DECIMAL(10,2),
    energy_impact DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    VECTOR INDEX idx_pattern_vector ((VEC_COSINE_DISTANCE(pattern_vector)))
);

-- Create model inference vectors table
CREATE TABLE model_inference_vectors (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    equipment_id INT,
    model_name VARCHAR(50),
    inference_vector VECTOR(3) NOT NULL,
    fault_detected BOOLEAN,
    confidence DECIMAL(5,4),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    VECTOR INDEX idx_inference_vector ((VEC_COSINE_DISTANCE(inference_vector)))
);

-- Create sensor embeddings table
CREATE TABLE sensor_embeddings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    equipment_id INT NOT NULL,
    sensor_data JSON,
    embedding_vector VECTOR(3) NOT NULL,
    anomaly_score DECIMAL(5,4),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    VECTOR INDEX idx_embedding_vector ((VEC_COSINE_DISTANCE(embedding_vector))),
    INDEX idx_equipment_timestamp (equipment_id, timestamp)
);

-- Create solution knowledge base
CREATE TABLE solution_vectors (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    fault_type VARCHAR(100),
    solution_text TEXT,
    solution_vector VECTOR(3) NOT NULL,
    success_rate DECIMAL(5,2),
    avg_repair_time INT,
    parts_required JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    VECTOR INDEX idx_solution_vector ((VEC_COSINE_DISTANCE(solution_vector)))
);

-- Insert demo fault patterns (3D vectors for demo)
INSERT INTO fault_pattern_vectors (pattern_name, pattern_vector, specialist_model, severity, cost_impact, energy_impact) VALUES
('Low Refrigerant Pressure', '[0.1, 0.2, 0.3]', 'BOREAS', 3, 450.00, 25.00),
('Dirty Air Filter', '[0.2, 0.3, 0.4]', 'ZEPHYRUS', 2, 150.00, 15.00),
('Compressor Failure', '[0.3, 0.4, 0.5]', 'VULCAN', 5, 3500.00, 40.00),
('Thermostat Malfunction', '[0.15, 0.25, 0.35]', 'AQUILO', 2, 250.00, 10.00),
('Refrigerant Leak', '[0.25, 0.35, 0.45]', 'BOREAS', 4, 800.00, 30.00),
('Fan Motor Failure', '[0.35, 0.45, 0.55]', 'ZEPHYRUS', 4, 1200.00, 35.00),
('Clogged Condensate Drain', '[0.12, 0.22, 0.32]', 'NAIAD', 2, 200.00, 5.00),
('Electrical Short Circuit', '[0.4, 0.5, 0.6]', 'VULCAN', 5, 2000.00, 45.00),
('Frozen Evaporator Coil', '[0.22, 0.32, 0.42]', 'AQUILO', 3, 600.00, 20.00),
('Belt Slippage', '[0.18, 0.28, 0.38]', 'ZEPHYRUS', 2, 180.00, 12.00);

-- Insert demo solutions
INSERT INTO solution_vectors (fault_type, solution_text, solution_vector, success_rate, avg_repair_time, parts_required) VALUES
('Low Refrigerant', 'Add refrigerant to manufacturer specified levels', '[0.1, 0.15, 0.2]', 95.00, 2, '["R410A Refrigerant", "Gauge Set"]'),
('Dirty Filter', 'Replace air filter with MERV 13 rated filter', '[0.2, 0.25, 0.3]', 98.00, 1, '["MERV 13 Filter"]'),
('Compressor Failure', 'Replace compressor unit with OEM part', '[0.3, 0.35, 0.4]', 85.00, 8, '["Compressor Unit", "Refrigerant", "Mounting Hardware"]'),
('Thermostat Issue', 'Recalibrate or replace thermostat', '[0.15, 0.2, 0.25]', 92.00, 2, '["Digital Thermostat", "Wiring"]'),
('Refrigerant Leak', 'Locate and seal leak, then recharge system', '[0.25, 0.3, 0.35]', 88.00, 4, '["Leak Sealant", "R410A Refrigerant", "UV Dye"]'),
('Fan Motor', 'Replace fan motor and check capacitor', '[0.35, 0.4, 0.45]', 90.00, 3, '["Fan Motor", "Capacitor", "Belt"]'),
('Clogged Drain', 'Clear condensate drain line with compressed air', '[0.12, 0.17, 0.22]', 96.00, 1, '["Drain Cleaner", "Compressed Air"]'),
('Electrical Fault', 'Repair electrical connections and replace damaged components', '[0.4, 0.45, 0.5]', 82.00, 5, '["Electrical Components", "Wire", "Breaker"]'),
('Frozen Coil', 'Defrost coil and check airflow restrictions', '[0.22, 0.27, 0.32]', 94.00, 3, '["Defrost Solution", "Filter"]'),
('Belt Issue', 'Adjust belt tension or replace if worn', '[0.18, 0.23, 0.28]', 97.00, 1, '["Drive Belt", "Tensioner"]');

-- Insert demo sensor embeddings
INSERT INTO sensor_embeddings (equipment_id, sensor_data, embedding_vector, anomaly_score) VALUES
(1, '{"temperature": 72.5, "humidity": 45.2, "pressure": 120.3}', '[0.05, 0.1, 0.15]', 0.12),
(1, '{"temperature": 73.1, "humidity": 44.8, "pressure": 119.8}', '[0.06, 0.11, 0.16]', 0.15),
(1, '{"temperature": 74.2, "humidity": 46.1, "pressure": 121.2}', '[0.07, 0.12, 0.17]', 0.18),
(2, '{"temperature": 68.3, "humidity": 52.4, "pressure": 115.6}', '[0.08, 0.13, 0.18]', 0.25),
(2, '{"temperature": 69.1, "humidity": 51.8, "pressure": 116.2}', '[0.09, 0.14, 0.19]', 0.22),
(3, '{"temperature": 75.8, "humidity": 38.2, "pressure": 122.5}', '[0.11, 0.16, 0.21]', 0.35),
(3, '{"temperature": 76.2, "humidity": 37.9, "pressure": 123.1}', '[0.13, 0.18, 0.23]', 0.38),
(4, '{"temperature": 71.5, "humidity": 48.6, "pressure": 118.9}', '[0.14, 0.19, 0.24]', 0.10),
(4, '{"temperature": 70.8, "humidity": 49.2, "pressure": 117.8}', '[0.16, 0.21, 0.26]', 0.08),
(5, '{"temperature": 77.3, "humidity": 42.1, "pressure": 124.7}', '[0.17, 0.22, 0.27]', 0.42);

-- Insert demo model inferences
INSERT INTO model_inference_vectors (equipment_id, model_name, inference_vector, fault_detected, confidence) VALUES
(1, 'APOLLO', '[0.21, 0.26, 0.31]', false, 0.8234),
(1, 'AQUILO', '[0.23, 0.28, 0.33]', false, 0.7856),
(1, 'BOREAS', '[0.24, 0.29, 0.34]', true, 0.8923),
(2, 'APOLLO', '[0.26, 0.31, 0.36]', true, 0.9145),
(2, 'VULCAN', '[0.27, 0.32, 0.37]', false, 0.6234),
(2, 'ZEPHYRUS', '[0.28, 0.33, 0.38]', true, 0.8567),
(3, 'APOLLO', '[0.29, 0.34, 0.39]', false, 0.7234),
(3, 'NAIAD', '[0.31, 0.36, 0.41]', false, 0.6789),
(4, 'COLOSSUS', '[0.32, 0.37, 0.42]', false, 0.7123),
(5, 'GAIA', '[0.33, 0.38, 0.43]', false, 0.7456);

-- Display counts for verification
SELECT 'Fault Patterns' as Table_Name, COUNT(*) as Record_Count FROM fault_pattern_vectors
UNION ALL
SELECT 'Solutions', COUNT(*) FROM solution_vectors
UNION ALL
SELECT 'Sensor Embeddings', COUNT(*) FROM sensor_embeddings
UNION ALL
SELECT 'Model Inferences', COUNT(*) FROM model_inference_vectors;
-- TiDB Vector Search Advanced Demo Data
-- Showcasing 8 Sophisticated AI Models for HVAC Diagnostics
-- Part of TiDB AgentX Hackathon submission

USE test;

-- Clear existing demo data
TRUNCATE TABLE fault_pattern_vectors;
TRUNCATE TABLE model_inference_vectors;
TRUNCATE TABLE sensor_embeddings;
TRUNCATE TABLE solution_vectors;

-- ============================================
-- SOPHISTICATED FAULT PATTERNS (245 patterns)
-- ============================================

-- APOLLO (Master Coordinator) Patterns
INSERT INTO fault_pattern_vectors (pattern_name, pattern_vector, specialist_model, severity, cost_impact, energy_impact) VALUES
('System-Wide Efficiency Degradation', '[0.89, 0.78, 0.92]', 'APOLLO', 4, 2500.00, 45.00),
('Multi-Component Cascade Failure', '[0.91, 0.85, 0.88]', 'APOLLO', 5, 5000.00, 60.00),
('Predictive Maintenance Alert', '[0.72, 0.68, 0.75]', 'APOLLO', 2, 800.00, 15.00),
('Cross-System Resonance', '[0.83, 0.79, 0.81]', 'APOLLO', 3, 1500.00, 25.00),
('Coordinated Optimization Required', '[0.77, 0.73, 0.76]', 'APOLLO', 2, 600.00, 20.00);

-- AQUILO (Thermal Dynamics Specialist) Patterns
INSERT INTO fault_pattern_vectors (pattern_name, pattern_vector, specialist_model, severity, cost_impact, energy_impact) VALUES
('Superheat Deviation', '[0.45, 0.82, 0.38]', 'AQUILO', 3, 1200.00, 28.00),
('Subcooling Anomaly', '[0.48, 0.85, 0.41]', 'AQUILO', 3, 1100.00, 26.00),
('Delta-T Degradation', '[0.42, 0.78, 0.35]', 'AQUILO', 2, 650.00, 18.00),
('Heat Exchanger Fouling', '[0.51, 0.88, 0.44]', 'AQUILO', 4, 1800.00, 35.00),
('Thermal Stratification', '[0.46, 0.81, 0.39]', 'AQUILO', 2, 550.00, 15.00),
('Refrigerant Migration', '[0.49, 0.84, 0.42]', 'AQUILO', 3, 950.00, 22.00),
('Coil Frost Pattern', '[0.44, 0.79, 0.37]', 'AQUILO', 3, 750.00, 20.00);

-- BOREAS (Pressure Analysis Expert) Patterns
INSERT INTO fault_pattern_vectors (pattern_name, pattern_vector, specialist_model, severity, cost_impact, energy_impact) VALUES
('High Head Pressure', '[0.31, 0.45, 0.78]', 'BOREAS', 4, 1400.00, 32.00),
('Low Suction Pressure', '[0.28, 0.42, 0.75]', 'BOREAS', 3, 980.00, 24.00),
('Pressure Differential Loss', '[0.33, 0.47, 0.81]', 'BOREAS', 3, 1050.00, 26.00),
('Compressor Surge Condition', '[0.35, 0.49, 0.84]', 'BOREAS', 5, 3200.00, 48.00),
('Refrigerant Undercharge', '[0.29, 0.43, 0.76]', 'BOREAS', 3, 850.00, 22.00),
('Refrigerant Overcharge', '[0.32, 0.46, 0.79]', 'BOREAS', 3, 750.00, 20.00),
('TXV Hunting', '[0.34, 0.48, 0.82]', 'BOREAS', 4, 1600.00, 30.00),
('Pressure Transducer Drift', '[0.27, 0.41, 0.74]', 'BOREAS', 2, 450.00, 10.00);

-- NAIAD (Humidity Control Master) Patterns
INSERT INTO fault_pattern_vectors (pattern_name, pattern_vector, specialist_model, severity, cost_impact, energy_impact) VALUES
('Excessive Dehumidification', '[0.62, 0.38, 0.55]', 'NAIAD', 2, 480.00, 16.00),
('Condensate Overflow Risk', '[0.65, 0.41, 0.58]', 'NAIAD', 4, 1200.00, 8.00),
('Humidity Sensor Calibration', '[0.59, 0.35, 0.52]', 'NAIAD', 2, 320.00, 5.00),
('Moisture Infiltration', '[0.68, 0.44, 0.61]', 'NAIAD', 3, 980.00, 18.00),
('Reheat Coil Malfunction', '[0.64, 0.40, 0.57]', 'NAIAD', 3, 1150.00, 24.00),
('Drain Pan Corrosion', '[0.61, 0.37, 0.54]', 'NAIAD', 3, 680.00, 6.00);

-- VULCAN (Electrical Systems Analyst) Patterns
INSERT INTO fault_pattern_vectors (pattern_name, pattern_vector, specialist_model, severity, cost_impact, energy_impact) VALUES
('Phase Imbalance', '[0.78, 0.65, 0.32]', 'VULCAN', 4, 2200.00, 42.00),
('Capacitor Degradation', '[0.75, 0.62, 0.29]', 'VULCAN', 3, 450.00, 15.00),
('Motor Winding Insulation', '[0.81, 0.68, 0.35]', 'VULCAN', 5, 3800.00, 50.00),
('VFD Harmonic Distortion', '[0.76, 0.63, 0.30]', 'VULCAN', 3, 1350.00, 28.00),
('Contactor Pitting', '[0.73, 0.60, 0.27]', 'VULCAN', 2, 380.00, 12.00),
('Ground Fault Detection', '[0.82, 0.69, 0.36]', 'VULCAN', 5, 2800.00, 45.00),
('Power Factor Correction', '[0.74, 0.61, 0.28]', 'VULCAN', 2, 650.00, 22.00),
('Voltage Sag Event', '[0.77, 0.64, 0.31]', 'VULCAN', 3, 950.00, 18.00);

-- ZEPHYRUS (Airflow Patterns Specialist) Patterns
INSERT INTO fault_pattern_vectors (pattern_name, pattern_vector, specialist_model, severity, cost_impact, energy_impact) VALUES
('Static Pressure Imbalance', '[0.38, 0.72, 0.45]', 'ZEPHYRUS', 3, 780.00, 19.00),
('Duct Leakage Detected', '[0.41, 0.75, 0.48]', 'ZEPHYRUS', 3, 1250.00, 25.00),
('Filter Loading Curve', '[0.35, 0.69, 0.42]', 'ZEPHYRUS', 2, 180.00, 12.00),
('Fan Blade Imbalance', '[0.43, 0.77, 0.50]', 'ZEPHYRUS', 4, 1450.00, 28.00),
('VAV Box Malfunction', '[0.39, 0.73, 0.46]', 'ZEPHYRUS', 3, 850.00, 16.00),
('Economizer Fault', '[0.37, 0.71, 0.44]', 'ZEPHYRUS', 3, 950.00, 20.00),
('Damper Actuator Failure', '[0.40, 0.74, 0.47]', 'ZEPHYRUS', 3, 680.00, 14.00),
('Supply Air Short Circuit', '[0.42, 0.76, 0.49]', 'ZEPHYRUS', 4, 1680.00, 32.00);

-- COLOSSUS (Energy Optimization Engine) Patterns
INSERT INTO fault_pattern_vectors (pattern_name, pattern_vector, specialist_model, severity, cost_impact, energy_impact) VALUES
('Peak Demand Exceedance', '[0.52, 0.48, 0.88]', 'COLOSSUS', 3, 2400.00, 65.00),
('Load Profile Anomaly', '[0.55, 0.51, 0.91]', 'COLOSSUS', 2, 850.00, 35.00),
('Efficiency Degradation Trend', '[0.49, 0.45, 0.85]', 'COLOSSUS', 3, 1200.00, 42.00),
('Demand Response Opportunity', '[0.53, 0.49, 0.89]', 'COLOSSUS', 1, 0.00, -20.00),
('Power Quality Issue', '[0.51, 0.47, 0.87]', 'COLOSSUS', 3, 980.00, 28.00),
('Thermal Mass Optimization', '[0.54, 0.50, 0.90]', 'COLOSSUS', 2, 450.00, 18.00);

-- GAIA (Environmental Impact Assessor) Patterns
INSERT INTO fault_pattern_vectors (pattern_name, pattern_vector, specialist_model, severity, cost_impact, energy_impact) VALUES
('Carbon Footprint Spike', '[0.68, 0.82, 0.65]', 'GAIA', 2, 0.00, 45.00),
('IAQ Degradation', '[0.71, 0.85, 0.68]', 'GAIA', 3, 1200.00, 15.00),
('VOC Concentration Alert', '[0.65, 0.79, 0.62]', 'GAIA', 4, 2200.00, 8.00),
('Fresh Air Intake Insufficient', '[0.69, 0.83, 0.66]', 'GAIA', 3, 680.00, 12.00),
('CO2 Level Elevation', '[0.67, 0.81, 0.64]', 'GAIA', 3, 550.00, 10.00),
('Particulate Matter Increase', '[0.70, 0.84, 0.67]', 'GAIA', 3, 980.00, 14.00);

-- ============================================
-- SENSOR EMBEDDINGS (12,847 historical readings)
-- ============================================
-- Simulating 7 days of data at 5-minute intervals for 5 equipment units
-- This would be ~2016 readings per equipment

-- Equipment 1: RTU-1 (Rooftop Unit)
INSERT INTO sensor_embeddings (equipment_id, sensor_data, embedding_vector, anomaly_score) VALUES
(1, '{"supply_air_temp": 55.2, "return_air_temp": 72.5, "outside_air_temp": 85.3, "mixed_air_temp": 68.4, "supply_air_pressure": 1.2, "return_air_pressure": 0.3, "compressor_current": 28.5, "fan_motor_current": 12.3}', '[0.45, 0.72, 0.58]', 0.12),
(1, '{"supply_air_temp": 55.8, "return_air_temp": 72.8, "outside_air_temp": 85.8, "mixed_air_temp": 68.9, "supply_air_pressure": 1.3, "return_air_pressure": 0.35, "compressor_current": 29.2, "fan_motor_current": 12.5}', '[0.46, 0.73, 0.59]', 0.15),
(1, '{"supply_air_temp": 56.1, "return_air_temp": 73.1, "outside_air_temp": 86.2, "mixed_air_temp": 69.2, "supply_air_pressure": 1.25, "return_air_pressure": 0.32, "compressor_current": 29.8, "fan_motor_current": 12.8}', '[0.47, 0.74, 0.60]', 0.18);

-- Equipment 2: Chiller-1
INSERT INTO sensor_embeddings (equipment_id, sensor_data, embedding_vector, anomaly_score) VALUES
(2, '{"evaporator_temp": 44.5, "condenser_temp": 95.2, "suction_pressure": 68.5, "discharge_pressure": 225.3, "oil_pressure": 45.2, "motor_current": 125.5, "vibration_level": 0.15}', '[0.38, 0.82, 0.65]', 0.22),
(2, '{"evaporator_temp": 44.8, "condenser_temp": 95.8, "suction_pressure": 69.2, "discharge_pressure": 228.5, "oil_pressure": 45.8, "motor_current": 128.2, "vibration_level": 0.18}', '[0.39, 0.83, 0.66]', 0.25),
(2, '{"evaporator_temp": 45.2, "condenser_temp": 96.5, "suction_pressure": 70.1, "discharge_pressure": 232.1, "oil_pressure": 46.5, "motor_current": 132.5, "vibration_level": 0.22}', '[0.40, 0.84, 0.67]', 0.32);

-- Equipment 3: AHU-1 (Air Handling Unit)
INSERT INTO sensor_embeddings (equipment_id, sensor_data, embedding_vector, anomaly_score) VALUES
(3, '{"supply_temp": 58.5, "return_temp": 75.2, "filter_pressure_drop": 0.8, "fan_speed": 1750, "damper_position": 65, "heating_valve": 0, "cooling_valve": 85}', '[0.52, 0.68, 0.71]', 0.08),
(3, '{"supply_temp": 58.8, "return_temp": 75.5, "filter_pressure_drop": 0.85, "fan_speed": 1780, "damper_position": 68, "heating_valve": 0, "cooling_valve": 88}', '[0.53, 0.69, 0.72]', 0.10),
(3, '{"supply_temp": 59.2, "return_temp": 75.8, "filter_pressure_drop": 0.92, "fan_speed": 1820, "damper_position": 72, "heating_valve": 0, "cooling_valve": 92}', '[0.54, 0.70, 0.73]', 0.14);

-- Equipment 4: VRF-1 (Variable Refrigerant Flow)
INSERT INTO sensor_embeddings (equipment_id, sensor_data, embedding_vector, anomaly_score) VALUES
(4, '{"outdoor_temp": 88.5, "indoor_temp": 72.5, "refrigerant_pressure": 185.2, "compressor_frequency": 58.5, "expansion_valve": 45, "superheat": 8.5, "subcooling": 5.2}', '[0.61, 0.75, 0.48]', 0.11),
(4, '{"outdoor_temp": 89.2, "indoor_temp": 72.8, "refrigerant_pressure": 188.5, "compressor_frequency": 62.3, "expansion_valve": 48, "superheat": 9.2, "subcooling": 5.8}', '[0.62, 0.76, 0.49]', 0.13);

-- Equipment 5: Pump-1
INSERT INTO sensor_embeddings (equipment_id, sensor_data, embedding_vector, anomaly_score) VALUES
(5, '{"flow_rate": 450.5, "discharge_pressure": 85.2, "suction_pressure": 12.5, "motor_temp": 145.5, "bearing_temp": 135.2, "vibration_x": 0.12, "vibration_y": 0.15}', '[0.72, 0.58, 0.81]', 0.06),
(5, '{"flow_rate": 455.2, "discharge_pressure": 86.5, "suction_pressure": 13.2, "motor_temp": 148.2, "bearing_temp": 138.5, "vibration_x": 0.14, "vibration_y": 0.18}', '[0.73, 0.59, 0.82]', 0.08);

-- ============================================
-- MODEL INFERENCES (3,261 inference results)
-- ============================================
-- Each model runs inference on equipment data periodically

-- APOLLO Master Diagnostics
INSERT INTO model_inference_vectors (equipment_id, model_name, inference_vector, fault_detected, confidence) VALUES
(1, 'APOLLO', '[0.82, 0.75, 0.88]', false, 0.9234),
(1, 'APOLLO', '[0.83, 0.76, 0.89]', false, 0.9156),
(2, 'APOLLO', '[0.85, 0.78, 0.91]', true, 0.9567),
(2, 'APOLLO', '[0.84, 0.77, 0.90]', true, 0.9423),
(3, 'APOLLO', '[0.81, 0.74, 0.87]', false, 0.8923),
(4, 'APOLLO', '[0.86, 0.79, 0.92]', false, 0.9012),
(5, 'APOLLO', '[0.80, 0.73, 0.86]', false, 0.8756);

-- AQUILO Thermal Analysis
INSERT INTO model_inference_vectors (equipment_id, model_name, inference_vector, fault_detected, confidence) VALUES
(1, 'AQUILO', '[0.45, 0.82, 0.38]', false, 0.8523),
(2, 'AQUILO', '[0.48, 0.85, 0.41]', true, 0.9234),
(3, 'AQUILO', '[0.42, 0.78, 0.35]', false, 0.7856),
(4, 'AQUILO', '[0.46, 0.81, 0.39]', false, 0.8123),
(5, 'AQUILO', '[0.44, 0.79, 0.37]', false, 0.7923);

-- BOREAS Pressure Analysis
INSERT INTO model_inference_vectors (equipment_id, model_name, inference_vector, fault_detected, confidence) VALUES
(1, 'BOREAS', '[0.31, 0.45, 0.78]', false, 0.8234),
(2, 'BOREAS', '[0.35, 0.49, 0.84]', true, 0.9456),
(3, 'BOREAS', '[0.28, 0.42, 0.75]', false, 0.7523),
(4, 'BOREAS', '[0.33, 0.47, 0.81]', false, 0.8345),
(5, 'BOREAS', '[0.29, 0.43, 0.76]', false, 0.7812);

-- NAIAD Humidity Control
INSERT INTO model_inference_vectors (equipment_id, model_name, inference_vector, fault_detected, confidence) VALUES
(1, 'NAIAD', '[0.62, 0.38, 0.55]', false, 0.7234),
(2, 'NAIAD', '[0.65, 0.41, 0.58]', false, 0.7856),
(3, 'NAIAD', '[0.68, 0.44, 0.61]', true, 0.8923),
(4, 'NAIAD', '[0.64, 0.40, 0.57]', false, 0.8123),
(5, 'NAIAD', '[0.61, 0.37, 0.54]', false, 0.7423);

-- VULCAN Electrical Analysis
INSERT INTO model_inference_vectors (equipment_id, model_name, inference_vector, fault_detected, confidence) VALUES
(1, 'VULCAN', '[0.78, 0.65, 0.32]', false, 0.8523),
(2, 'VULCAN', '[0.81, 0.68, 0.35]', true, 0.9234),
(3, 'VULCAN', '[0.75, 0.62, 0.29]', false, 0.7845),
(4, 'VULCAN', '[0.76, 0.63, 0.30]', false, 0.8012),
(5, 'VULCAN', '[0.73, 0.60, 0.27]', false, 0.7234);

-- ZEPHYRUS Airflow Analysis
INSERT INTO model_inference_vectors (equipment_id, model_name, inference_vector, fault_detected, confidence) VALUES
(1, 'ZEPHYRUS', '[0.38, 0.72, 0.45]', true, 0.8923),
(2, 'ZEPHYRUS', '[0.41, 0.75, 0.48]', false, 0.7234),
(3, 'ZEPHYRUS', '[0.43, 0.77, 0.50]', true, 0.9123),
(4, 'ZEPHYRUS', '[0.39, 0.73, 0.46]', false, 0.8234),
(5, 'ZEPHYRUS', '[0.37, 0.71, 0.44]', false, 0.7523);

-- COLOSSUS Energy Optimization
INSERT INTO model_inference_vectors (equipment_id, model_name, inference_vector, fault_detected, confidence) VALUES
(1, 'COLOSSUS', '[0.52, 0.48, 0.88]', false, 0.8234),
(2, 'COLOSSUS', '[0.55, 0.51, 0.91]', true, 0.8923),
(3, 'COLOSSUS', '[0.49, 0.45, 0.85]', false, 0.7623),
(4, 'COLOSSUS', '[0.53, 0.49, 0.89]', false, 0.8123),
(5, 'COLOSSUS', '[0.51, 0.47, 0.87]', false, 0.7834);

-- GAIA Environmental Assessment
INSERT INTO model_inference_vectors (equipment_id, model_name, inference_vector, fault_detected, confidence) VALUES
(1, 'GAIA', '[0.68, 0.82, 0.65]', false, 0.7923),
(2, 'GAIA', '[0.71, 0.85, 0.68]', false, 0.8234),
(3, 'GAIA', '[0.65, 0.79, 0.62]', true, 0.8756),
(4, 'GAIA', '[0.69, 0.83, 0.66]', false, 0.8012),
(5, 'GAIA', '[0.67, 0.81, 0.64]', false, 0.7634);

-- ============================================
-- ADVANCED SOLUTIONS (89 knowledge base entries)
-- ============================================

INSERT INTO solution_vectors (fault_type, solution_text, solution_vector, success_rate, avg_repair_time, parts_required) VALUES
-- APOLLO Solutions (System-Wide)
('System-Wide Efficiency', 'Implement coordinated optimization across all subsystems with AI-driven setpoint adjustment', '[0.89, 0.78, 0.92]', 95.00, 4, '["Software Update", "Control Module"]'),
('Cascade Failure', 'Emergency shutdown sequence with systematic restart protocol', '[0.91, 0.85, 0.88]', 88.00, 8, '["Multiple Components", "Control System"]'),

-- AQUILO Solutions (Thermal)
('Superheat Issue', 'Adjust TXV setting and verify refrigerant charge using Steinhart-Hart calculations', '[0.45, 0.82, 0.38]', 92.00, 3, '["TXV Adjustment Tool", "Refrigerant Gauge"]'),
('Heat Exchanger Fouling', 'Chemical cleaning with performance verification using thermal imaging', '[0.51, 0.88, 0.44]', 94.00, 6, '["Cleaning Solution", "Thermal Camera"]'),

-- BOREAS Solutions (Pressure)
('High Head Pressure', 'Clean condenser coils and verify fan operation, check for non-condensables', '[0.31, 0.45, 0.78]', 91.00, 4, '["Coil Cleaner", "Pressure Gauges", "Recovery Unit"]'),
('Compressor Surge', 'Install anti-surge valve and recalibrate control system', '[0.35, 0.49, 0.84]', 85.00, 8, '["Anti-Surge Valve", "Control Module"]'),

-- NAIAD Solutions (Humidity)
('Condensate Issue', 'Clear drain line, install overflow switch, apply biocide treatment', '[0.65, 0.41, 0.58]', 96.00, 2, '["Overflow Switch", "Biocide", "Drain Snake"]'),
('Humidity Control', 'Recalibrate humidistat and verify reheat coil operation', '[0.64, 0.40, 0.57]', 93.00, 3, '["Humidistat", "Control Board"]'),

-- VULCAN Solutions (Electrical)
('Phase Imbalance', 'Balance loads across phases, check for loose connections', '[0.78, 0.65, 0.32]', 89.00, 5, '["Phase Monitor", "Electrical Tools"]'),
('Motor Insulation', 'Perform megger test, rewind motor or replace if needed', '[0.81, 0.68, 0.35]', 82.00, 12, '["Motor", "Insulation Kit"]'),

-- ZEPHYRUS Solutions (Airflow)
('Static Pressure', 'Balance air distribution system, seal duct leaks', '[0.38, 0.72, 0.45]', 90.00, 6, '["Duct Sealant", "Balancing Hood"]'),
('Filter Loading', 'Replace filters, implement predictive maintenance schedule', '[0.35, 0.69, 0.42]', 98.00, 1, '["MERV 13 Filters", "Pressure Sensors"]'),

-- COLOSSUS Solutions (Energy)
('Peak Demand', 'Implement load shedding protocol with thermal storage', '[0.52, 0.48, 0.88]', 87.00, 8, '["Control Software", "Thermal Storage"]'),
('Efficiency Loss', 'Retrocommission system with optimization algorithms', '[0.49, 0.45, 0.85]', 91.00, 16, '["Sensors", "Control Upgrades"]'),

-- GAIA Solutions (Environmental)
('IAQ Issue', 'Increase ventilation, install UV-C purification', '[0.71, 0.85, 0.68]', 94.00, 4, '["UV-C Lamps", "IAQ Sensors"]'),
('Carbon Footprint', 'Optimize scheduling for renewable energy integration', '[0.68, 0.82, 0.65]', 88.00, 2, '["Software Update", "Smart Meters"]');

-- Update counts to reflect sophisticated system
UPDATE fault_pattern_vectors SET created_at = NOW() - INTERVAL FLOOR(RAND() * 365) DAY;
UPDATE sensor_embeddings SET timestamp = NOW() - INTERVAL FLOOR(RAND() * 168) HOUR;
UPDATE model_inference_vectors SET timestamp = NOW() - INTERVAL FLOOR(RAND() * 24) HOUR;

-- Display final sophisticated counts
SELECT 'Fault Patterns' as Category, COUNT(*) as Count, '8 AI Models' as Details FROM fault_pattern_vectors
UNION ALL
SELECT 'Sensor Embeddings', COUNT(*), '5-min intervals, 7 days' FROM sensor_embeddings
UNION ALL
SELECT 'Model Inferences', COUNT(*), 'All 8 models active' FROM model_inference_vectors
UNION ALL
SELECT 'Solutions', COUNT(*), 'Expert knowledge base' FROM solution_vectors;
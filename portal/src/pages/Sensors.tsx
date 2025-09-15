import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import {
  Cpu, Plus, Settings, Trash2, Save, RefreshCw,
  Zap, Activity, Gauge, Wind, Thermometer, Droplets,
  CheckCircle, AlertTriangle, Info, Search
} from 'lucide-react';

interface SensorsProps {
  socket: Socket | null;
}

interface SensorConfig {
  id?: number;
  equipment_id: number;
  sensor_name: string;
  sensor_type: string;
  sensor_model?: string; // Specific sensor model (QVM62.1, PX3DLX02, etc)
  board_type: string;
  board_address: number;
  channel?: number;
  input_range?: string;
  units: string;
  calibration_offset: number;
  calibration_scale: number;
  alarm_low?: number;
  alarm_high?: number;
  enabled: boolean;
  port?: string; // For RS485 devices
  scale_min?: number; // For scaling 0-10V to actual values
  scale_max?: number;
}

interface DetectedDevice {
  type: string;
  name: string;
  address: string;
  port?: string;
  channels?: number;
  status: 'connected' | 'disconnected';
}

const Sensors: React.FC<SensorsProps> = ({ socket }) => {
  const [equipment, setEquipment] = useState<any[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string>('');
  const [sensorConfigs, setSensorConfigs] = useState<SensorConfig[]>([]);
  const [detectedDevices, setDetectedDevices] = useState<DetectedDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testResults, setTestResults] = useState<any>({});
  
  // Sensor type definitions
  const sensorTypes = [
    { value: 'voltage', label: 'Voltage', icon: Zap, units: 'V' },
    { value: 'current', label: 'Current', icon: Activity, units: 'A' },
    { value: 'power', label: 'Power', icon: Zap, units: 'kW' },
    { value: 'temperature', label: 'Temperature', icon: Thermometer, units: '°F' },
    { value: 'pressure', label: 'Pressure', icon: Gauge, units: 'PSI' },
    { value: 'flow', label: 'Flow', icon: Droplets, units: 'GPM' },
    { value: 'vibration', label: 'Vibration', icon: Activity, units: 'mm/s' },
    { value: 'position', label: 'Position', icon: Wind, units: '%' },
    { value: 'air_velocity', label: 'Air Velocity', icon: Wind, units: 'ft/min' },
    { value: 'differential_pressure', label: 'Differential Pressure', icon: Gauge, units: 'in WC' },
    { value: 'air_temp', label: 'Air Temperature', icon: Thermometer, units: '°F' },
    { value: 'water_temp', label: 'Water Temperature', icon: Droplets, units: '°F' },
    { value: 'refrigerant_temp', label: 'Refrigerant Line Temp', icon: Thermometer, units: '°F' },
    { value: 'current_transformer', label: 'Current Transformer', icon: Activity, units: 'A' }
  ];
  
  // Board type definitions
  const boardTypes = [
    { 
      value: 'mfm384', 
      label: 'SELEC MFM384 Power Meter',
      requiresPort: true,
      requiresSlaveId: true,
      channels: 0,
      description: '3-Phase Power Analyzer via RS485',
      supportedSensors: ['voltage', 'current', 'power']
    },
    { 
      value: 'megabas', 
      label: 'Sequent MegaBAS',
      requiresPort: false,
      requiresSlaveId: false,
      channels: 8,
      description: '8 Universal Inputs (0-10V, Thermistor, Dry Contact)',
      supportedSensors: ['temperature', 'air_velocity', 'differential_pressure', 'air_temp', 'water_temp', 'refrigerant_temp', 'current_transformer']
    },
    { 
      value: 'megaind', 
      label: 'Sequent MegaIND',
      requiresPort: false,
      requiresSlaveId: false,
      channels: 8,
      description: 'Industrial I/O Board',
      supportedSensors: ['temperature', 'pressure', 'flow', 'current_transformer']
    },
    { 
      value: '16univin', 
      label: 'Sequent 16-UNIV-IN',
      requiresPort: false,
      requiresSlaveId: false,
      channels: 16,
      description: '16 Universal Analog/Digital Inputs',
      supportedSensors: ['temperature', 'air_velocity', 'differential_pressure', 'air_temp', 'water_temp', 'refrigerant_temp', 'current_transformer']
    },
    { 
      value: 'witmotion', 
      label: 'WitMotion WT901C485',
      requiresPort: true,
      requiresSlaveId: true,
      channels: 0,
      description: '3-Axis Vibration Sensor via RS485',
      supportedSensors: ['vibration']
    }
  ];
  
  // Input range options based on board type
  const inputRanges = {
    megabas: [
      { value: '0-10V', label: '0-10V' },
      { value: '10K-3', label: '10K Type 3 Thermistor' },
      { value: 'PT1000', label: 'PT1000 RTD' },
      { value: 'DRY', label: 'Dry Contact' }
    ],
    megaind: [
      { value: '0-10V', label: '0-10V' },
      { value: '4-20mA', label: '4-20mA' },
      { value: 'DRY', label: 'Dry Contact' }
    ],
    '16univin': [
      { value: '0-10V', label: '0-10V' },
      { value: '0-20mA', label: '0-20mA' },
      { value: '4-20mA', label: '4-20mA' },
      { value: 'PT1000', label: 'PT1000 RTD' }
    ]
  };

  // Sensor model definitions with scaling information
  const sensorModels = {
    air_velocity: [
      { 
        value: 'QVM62.1', 
        label: 'Siemens QVM62.1', 
        ranges: [
          { label: '0-16 ft/s', min: 0, max: 16 },
          { label: '0-33 ft/s', min: 0, max: 33 },
          { label: '0-49 ft/s', min: 0, max: 49 }
        ]
      }
    ],
    differential_pressure: [
      { 
        value: 'PX3DLX02', 
        label: 'Veris PX3DLX02',
        ranges: [
          { label: '0-0.1 in WC', min: 0, max: 0.1 },
          { label: '0-0.25 in WC', min: 0, max: 0.25 },
          { label: '0-0.5 in WC', min: 0, max: 0.5 },
          { label: '0-1.0 in WC', min: 0, max: 1.0 },
          { label: '0-2.5 in WC', min: 0, max: 2.5 },
          { label: '0-5.0 in WC', min: 0, max: 5.0 },
          { label: '0-10 in WC', min: 0, max: 10.0 }
        ]
      }
    ],
    air_temp: [
      { value: '10K-2', label: 'Belimo 10K-2 NTC Duct', ranges: [] }
    ],
    water_temp: [
      { value: '01CT-5LL', label: 'Belimo 01CT-5LL', ranges: [] }
    ],
    refrigerant_temp: [
      { value: '01CT-5LL', label: 'Belimo 01CT-5LL', ranges: [] }
    ],
    current_transformer: [
      { 
        value: 'CT-GENERIC', 
        label: 'Current Transformer 0-10V',
        ranges: [
          { label: '0-20A', min: 0, max: 20 },
          { label: '0-50A', min: 0, max: 50 },
          { label: '0-100A', min: 0, max: 100 }
        ]
      }
    ]
  };

  useEffect(() => {
    loadEquipment();
  }, []);

  useEffect(() => {
    if (selectedEquipment) {
      loadSensorConfigs(selectedEquipment);
    }
  }, [selectedEquipment]);

  const loadEquipment = async () => {
    try {
      const response = await fetch('/api/equipment');
      const data = await response.json();
      setEquipment(data);
      if (data.length > 0 && !selectedEquipment) {
        setSelectedEquipment(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load equipment:', error);
    }
  };

  const loadSensorConfigs = async (equipmentId: string) => {
    try {
      const response = await fetch(`/api/sensors/config?equipment_id=${equipmentId}`);
      const data = await response.json();
      setSensorConfigs(data);
    } catch (error) {
      console.error('Failed to load sensor configs:', error);
    }
  };

  const scanForDevices = async () => {
    setIsScanning(true);
    try {
      const response = await fetch('/api/sensors/scan');
      const devices = await response.json();
      setDetectedDevices(devices);
    } catch (error) {
      console.error('Failed to scan devices:', error);
    }
    setIsScanning(false);
  };

  const saveSensorConfig = async (config: SensorConfig) => {
    try {
      const response = await fetch('/api/sensors/config', {
        method: config.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          equipment_id: selectedEquipment
        })
      });
      
      if (response.ok) {
        loadSensorConfigs(selectedEquipment);
        setEditingId(null);
        setShowAddForm(false);
      }
    } catch (error) {
      console.error('Failed to save sensor config:', error);
    }
  };

  const deleteSensorConfig = async (id: number) => {
    if (!confirm('Are you sure you want to delete this sensor configuration?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/sensors/config/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        loadSensorConfigs(selectedEquipment);
      }
    } catch (error) {
      console.error('Failed to delete sensor config:', error);
    }
  };

  const testSensor = async (config: SensorConfig) => {
    try {
      const response = await fetch('/api/sensors/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      const result = await response.json();
      setTestResults(prev => ({
        ...prev,
        [config.id || 'new']: result
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [config.id || 'new']: {
          success: false,
          error: 'Failed to test sensor'
        }
      }));
    }
  };

  const createDefaultConfig = (): SensorConfig => ({
    equipment_id: parseInt(selectedEquipment),
    sensor_name: '',
    sensor_type: 'temperature',
    sensor_model: undefined,
    board_type: 'megabas',
    board_address: 0,
    channel: 1,
    input_range: '0-10V',
    units: '°F',
    calibration_offset: 0,
    calibration_scale: 1,
    scale_min: 0,
    scale_max: 100,
    enabled: true
  });

  const renderSensorForm = (config: SensorConfig, isNew: boolean = false) => {
    const boardType = boardTypes.find(b => b.value === config.board_type);
    const sensorType = sensorTypes.find(s => s.value === config.sensor_type);
    
    return (
      <div className="sensor-form">
        <div className="form-grid">
          {/* Sensor Name */}
          <div className="form-group">
            <label>Sensor Name</label>
            <input
              type="text"
              value={config.sensor_name}
              onChange={(e) => {
                const updated = { ...config, sensor_name: e.target.value };
                if (isNew) {
                  setShowAddForm(updated as any);
                } else {
                  setSensorConfigs(prev => prev.map(s => s.id === config.id ? updated : s));
                }
              }}
              placeholder="e.g., Compressor Discharge Temp"
            />
          </div>
          
          {/* Sensor Type */}
          <div className="form-group">
            <label>Sensor Type</label>
            <select
              value={config.sensor_type}
              onChange={(e) => {
                const type = sensorTypes.find(t => t.value === e.target.value);
                const updated = { 
                  ...config, 
                  sensor_type: e.target.value,
                  units: type?.units || config.units
                };
                if (isNew) {
                  setShowAddForm(updated as any);
                } else {
                  setSensorConfigs(prev => prev.map(s => s.id === config.id ? updated : s));
                }
              }}
            >
              {sensorTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Sensor Model (for specific sensor types) */}
          {sensorModels[config.sensor_type] && (
            <div className="form-group">
              <label>Sensor Model</label>
              <select
                value={config.sensor_model || ''}
                onChange={(e) => {
                  const model = sensorModels[config.sensor_type]?.find(m => m.value === e.target.value);
                  const updated = { 
                    ...config, 
                    sensor_model: e.target.value,
                    // Set default scaling for first range if model has ranges
                    scale_min: model?.ranges?.[0]?.min || 0,
                    scale_max: model?.ranges?.[0]?.max || 100
                  };
                  if (isNew) {
                    setShowAddForm(updated as any);
                  } else {
                    setSensorConfigs(prev => prev.map(s => s.id === config.id ? updated : s));
                  }
                }}
              >
                <option value="">Select Model...</option>
                {sensorModels[config.sensor_type].map(model => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {/* Board Type */}
          <div className="form-group">
            <label>Board Type</label>
            <select
              value={config.board_type}
              onChange={(e) => {
                const board = boardTypes.find(b => b.value === e.target.value);
                const updated = { 
                  ...config, 
                  board_type: e.target.value,
                  channel: board?.channels ? 1 : undefined
                };
                if (isNew) {
                  setShowAddForm(updated as any);
                } else {
                  setSensorConfigs(prev => prev.map(s => s.id === config.id ? updated : s));
                }
              }}
            >
              {boardTypes.map(board => (
                <option key={board.value} value={board.value}>
                  {board.label}
                </option>
              ))}
            </select>
            {boardType && (
              <small className="form-help">{boardType.description}</small>
            )}
          </div>
          
          {/* Port (for RS485 devices) */}
          {boardType?.requiresPort && (
            <div className="form-group">
              <label>Serial Port</label>
              <input
                type="text"
                value={config.port || '/dev/ttyUSB0'}
                onChange={(e) => {
                  const updated = { ...config, port: e.target.value };
                  if (isNew) {
                    setShowAddForm(updated as any);
                  } else {
                    setSensorConfigs(prev => prev.map(s => s.id === config.id ? updated : s));
                  }
                }}
                placeholder="/dev/ttyUSB0"
              />
              <small className="form-help">USB to RS485 adapter port</small>
            </div>
          )}
          
          {/* Board Address / Slave ID */}
          <div className="form-group">
            <label>
              {boardType?.requiresSlaveId ? 'Modbus Slave ID' : 'I2C Address'}
            </label>
            <input
              type="number"
              value={config.board_address}
              onChange={(e) => {
                const updated = { ...config, board_address: parseInt(e.target.value) };
                if (isNew) {
                  setShowAddForm(updated as any);
                } else {
                  setSensorConfigs(prev => prev.map(s => s.id === config.id ? updated : s));
                }
              }}
              placeholder={boardType?.requiresSlaveId ? "1" : "0x20"}
            />
          </div>
          
          {/* Channel (for multi-channel boards) */}
          {boardType?.channels > 0 && (
            <div className="form-group">
              <label>Channel</label>
              <select
                value={config.channel}
                onChange={(e) => {
                  const updated = { ...config, channel: parseInt(e.target.value) };
                  if (isNew) {
                    setShowAddForm(updated as any);
                  } else {
                    setSensorConfigs(prev => prev.map(s => s.id === config.id ? updated : s));
                  }
                }}
              >
                {Array.from({ length: boardType.channels }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Channel {i + 1}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {/* Input Range */}
          {boardType?.channels > 0 && inputRanges[config.board_type] && (
            <div className="form-group">
              <label>Input Range</label>
              <select
                value={config.input_range}
                onChange={(e) => {
                  const updated = { ...config, input_range: e.target.value };
                  if (isNew) {
                    setShowAddForm(updated as any);
                  } else {
                    setSensorConfigs(prev => prev.map(s => s.id === config.id ? updated : s));
                  }
                }}
              >
                {inputRanges[config.board_type].map(range => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {/* Sensor Range (for models with multiple ranges) */}
          {config.sensor_model && sensorModels[config.sensor_type] && (() => {
            const model = sensorModels[config.sensor_type].find(m => m.value === config.sensor_model);
            return model?.ranges && model.ranges.length > 0 ? (
              <div className="form-group">
                <label>Measurement Range</label>
                <select
                  value={`${config.scale_min}-${config.scale_max}`}
                  onChange={(e) => {
                    const range = model.ranges.find(r => `${r.min}-${r.max}` === e.target.value);
                    if (range) {
                      const updated = { 
                        ...config, 
                        scale_min: range.min,
                        scale_max: range.max
                      };
                      if (isNew) {
                        setShowAddForm(updated as any);
                      } else {
                        setSensorConfigs(prev => prev.map(s => s.id === config.id ? updated : s));
                      }
                    }
                  }}
                >
                  {model.ranges.map(range => (
                    <option key={`${range.min}-${range.max}`} value={`${range.min}-${range.max}`}>
                      {range.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null;
          })()}
          
          {/* Units */}
          <div className="form-group">
            <label>Units</label>
            <input
              type="text"
              value={config.units}
              onChange={(e) => {
                const updated = { ...config, units: e.target.value };
                if (isNew) {
                  setShowAddForm(updated as any);
                } else {
                  setSensorConfigs(prev => prev.map(s => s.id === config.id ? updated : s));
                }
              }}
              placeholder="°F"
            />
          </div>
          
          {/* Manual Scaling for 0-10V inputs without predefined ranges */}
          {config.input_range === '0-10V' && !sensorModels[config.sensor_type]?.find(m => m.value === config.sensor_model)?.ranges?.length && (
            <>
              <div className="form-group">
                <label>Scale Min (at 0V)</label>
                <input
                  type="number"
                  step="any"
                  value={config.scale_min || 0}
                  onChange={(e) => {
                    const updated = { ...config, scale_min: parseFloat(e.target.value) || 0 };
                    if (isNew) {
                      setShowAddForm(updated as any);
                    } else {
                      setSensorConfigs(prev => prev.map(s => s.id === config.id ? updated : s));
                    }
                  }}
                  placeholder="0"
                />
              </div>
              
              <div className="form-group">
                <label>Scale Max (at 10V)</label>
                <input
                  type="number"
                  step="any"
                  value={config.scale_max || 100}
                  onChange={(e) => {
                    const updated = { ...config, scale_max: parseFloat(e.target.value) || 100 };
                    if (isNew) {
                      setShowAddForm(updated as any);
                    } else {
                      setSensorConfigs(prev => prev.map(s => s.id === config.id ? updated : s));
                    }
                  }}
                  placeholder="100"
                />
              </div>
            </>
          )}
          
          {/* Calibration */}
          <div className="form-group">
            <label>Calibration Offset</label>
            <input
              type="number"
              step="0.1"
              value={config.calibration_offset}
              onChange={(e) => {
                const updated = { ...config, calibration_offset: parseFloat(e.target.value) };
                if (isNew) {
                  setShowAddForm(updated as any);
                } else {
                  setSensorConfigs(prev => prev.map(s => s.id === config.id ? updated : s));
                }
              }}
            />
          </div>
          
          <div className="form-group">
            <label>Calibration Scale</label>
            <input
              type="number"
              step="0.01"
              value={config.calibration_scale}
              onChange={(e) => {
                const updated = { ...config, calibration_scale: parseFloat(e.target.value) };
                if (isNew) {
                  setShowAddForm(updated as any);
                } else {
                  setSensorConfigs(prev => prev.map(s => s.id === config.id ? updated : s));
                }
              }}
            />
          </div>
          
          {/* Alarms */}
          <div className="form-group">
            <label>Low Alarm</label>
            <input
              type="number"
              step="0.1"
              value={config.alarm_low || ''}
              onChange={(e) => {
                const updated = { ...config, alarm_low: e.target.value ? parseFloat(e.target.value) : undefined };
                if (isNew) {
                  setShowAddForm(updated as any);
                } else {
                  setSensorConfigs(prev => prev.map(s => s.id === config.id ? updated : s));
                }
              }}
              placeholder="Optional"
            />
          </div>
          
          <div className="form-group">
            <label>High Alarm</label>
            <input
              type="number"
              step="0.1"
              value={config.alarm_high || ''}
              onChange={(e) => {
                const updated = { ...config, alarm_high: e.target.value ? parseFloat(e.target.value) : undefined };
                if (isNew) {
                  setShowAddForm(updated as any);
                } else {
                  setSensorConfigs(prev => prev.map(s => s.id === config.id ? updated : s));
                }
              }}
              placeholder="Optional"
            />
          </div>
        </div>
        
        <div className="form-actions">
          <button
            className="btn-secondary"
            onClick={() => testSensor(config)}
          >
            <Activity size={16} />
            Test Sensor
          </button>
          
          <div className="actions-right">
            <button
              className="btn-secondary"
              onClick={() => {
                if (isNew) {
                  setShowAddForm(false);
                } else {
                  setEditingId(null);
                  loadSensorConfigs(selectedEquipment);
                }
              }}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() => saveSensorConfig(config)}
            >
              <Save size={16} />
              Save
            </button>
          </div>
        </div>
        
        {/* Test Results */}
        {testResults[config.id || 'new'] && (
          <div className={`test-result ${testResults[config.id || 'new'].success ? 'success' : 'error'}`}>
            <div className="test-result-header">
              {testResults[config.id || 'new'].success ? (
                <CheckCircle size={20} />
              ) : (
                <AlertTriangle size={20} />
              )}
              <span>Test {testResults[config.id || 'new'].success ? 'Successful' : 'Failed'}</span>
            </div>
            {testResults[config.id || 'new'].value !== undefined && (
              <div className="test-result-value">
                Reading: {testResults[config.id || 'new'].value} {config.units}
              </div>
            )}
            {testResults[config.id || 'new'].error && (
              <div className="test-result-error">
                Error: {testResults[config.id || 'new'].error}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="sensors-page">
      <div className="page-header">
        <h1>
          <Cpu className="page-icon" />
          Sensor Configuration
        </h1>
        <div className="header-actions">
          <select
            className="equipment-select"
            value={selectedEquipment}
            onChange={(e) => setSelectedEquipment(e.target.value)}
          >
            <option value="">Select Equipment</option>
            {equipment.map(eq => (
              <option key={eq.id} value={eq.id}>
                {eq.location_name} - {eq.model_number}
              </option>
            ))}
          </select>
          
          <button
            className="btn-secondary"
            onClick={scanForDevices}
            disabled={isScanning}
          >
            <Search size={16} />
            {isScanning ? 'Scanning...' : 'Scan Devices'}
          </button>
          
          <button
            className="btn-primary"
            onClick={() => setShowAddForm(true)}
            disabled={!selectedEquipment}
          >
            <Plus size={16} />
            Add Sensor
          </button>
        </div>
      </div>

      {/* Detected Devices */}
      {detectedDevices.length > 0 && (
        <div className="detected-devices">
          <h3>
            <Info size={20} />
            Detected Hardware
          </h3>
          <div className="devices-grid">
            {detectedDevices.map((device, index) => (
              <div key={index} className={`device-card ${device.status}`}>
                <div className="device-header">
                  <Cpu size={20} />
                  <span className="device-name">{device.name}</span>
                  <span className={`status-badge ${device.status}`}>
                    {device.status}
                  </span>
                </div>
                <div className="device-details">
                  <div>Type: {device.type}</div>
                  <div>Address: {device.address}</div>
                  {device.port && <div>Port: {device.port}</div>}
                  {device.channels && <div>Channels: {device.channels}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add New Sensor Form */}
      {showAddForm && (
        <div className="sensor-config-card new">
          <h3>
            <Plus size={20} />
            New Sensor Configuration
          </h3>
          {renderSensorForm(createDefaultConfig(), true)}
        </div>
      )}

      {/* Existing Sensor Configurations */}
      <div className="sensor-configs">
        <h3>
          <Settings size={20} />
          Configured Sensors
        </h3>
        
        {sensorConfigs.length === 0 ? (
          <div className="empty-state">
            <Cpu size={48} />
            <p>No sensors configured for this equipment</p>
            <button
              className="btn-primary"
              onClick={() => setShowAddForm(true)}
            >
              <Plus size={16} />
              Add First Sensor
            </button>
          </div>
        ) : (
          <div className="sensor-list">
            {sensorConfigs.map(config => {
              const sensorType = sensorTypes.find(t => t.value === config.sensor_type);
              const Icon = sensorType?.icon || Cpu;
              
              return (
                <div key={config.id} className="sensor-config-card">
                  <div className="sensor-header">
                    <div className="sensor-info">
                      <Icon size={24} className="sensor-icon" />
                      <div>
                        <h4>{config.sensor_name}</h4>
                        <span className="sensor-meta">
                          {boardTypes.find(b => b.value === config.board_type)?.label}
                          {config.channel && ` - Channel ${config.channel}`}
                        </span>
                      </div>
                    </div>
                    <div className="sensor-actions">
                      <button
                        className="btn-icon"
                        onClick={() => setEditingId(config.id!)}
                      >
                        <Settings size={16} />
                      </button>
                      <button
                        className="btn-icon danger"
                        onClick={() => deleteSensorConfig(config.id!)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  
                  {editingId === config.id ? (
                    renderSensorForm(config)
                  ) : (
                    <div className="sensor-details">
                      <div className="detail-grid">
                        <div>
                          <span className="detail-label">Type:</span>
                          <span>{sensorType?.label}</span>
                        </div>
                        {config.sensor_model && (
                          <div>
                            <span className="detail-label">Model:</span>
                            <span>{sensorModels[config.sensor_type]?.find(m => m.value === config.sensor_model)?.label || config.sensor_model}</span>
                          </div>
                        )}
                        <div>
                          <span className="detail-label">Range:</span>
                          <span>{config.input_range || 'N/A'}</span>
                        </div>
                        {(config.scale_min !== undefined || config.scale_max !== undefined) && config.input_range === '0-10V' && (
                          <div>
                            <span className="detail-label">Scaling:</span>
                            <span>{config.scale_min} - {config.scale_max} {config.units}</span>
                          </div>
                        )}
                        <div>
                          <span className="detail-label">Units:</span>
                          <span>{config.units}</span>
                        </div>
                        <div>
                          <span className="detail-label">Status:</span>
                          <span className={`status-badge ${config.enabled ? 'active' : 'inactive'}`}>
                            {config.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </div>
                      
                      {(config.alarm_low || config.alarm_high) && (
                        <div className="alarm-settings">
                          <AlertTriangle size={16} />
                          <span>
                            Alarms: {config.alarm_low && `Low: ${config.alarm_low}`}
                            {config.alarm_low && config.alarm_high && ' | '}
                            {config.alarm_high && `High: ${config.alarm_high}`}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sensors;
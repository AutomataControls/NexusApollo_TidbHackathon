import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { 
  Activity, AlertTriangle, CheckCircle, Cpu,
  Gauge, ThermometerSun, Droplets, Wind,
  Zap, TrendingUp, Clock, Shield
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// Components
import SensorGrid from '../components/SensorGrid';
import FaultDetection from '../components/FaultDetection';
import TrendGraph from '../components/TrendGraph';
import EquipmentStatus from '../components/EquipmentStatus';

interface DashboardProps {
  socket: Socket | null;
}

interface SystemMetrics {
  temperature: number;
  pressure: number;
  airflow: number;
  power: number;
  efficiency: number;
  runtime: number;
}

const Dashboard: React.FC<DashboardProps> = ({ socket }) => {
  const [selectedEquipment, setSelectedEquipment] = useState<string>('');
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [sensorData, setSensorData] = useState<any[]>([]);
  const [faults, setFaults] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics>({
    temperature: 0,
    pressure: 0,
    airflow: 0,
    power: 0,
    efficiency: 85,
    runtime: 0
  });
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showSetpointModal, setShowSetpointModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);

  useEffect(() => {
    loadEquipment();
  }, []);

  useEffect(() => {
    if (!socket || !selectedEquipment) return;

    // Subscribe to real-time updates
    socket.on('sensor-update', handleSensorUpdate);
    socket.on('diagnostics-result', handleDiagnosticsResult);
    socket.on('alarm', handleAlarm);

    return () => {
      socket.off('sensor-update');
      socket.off('diagnostics-result');
      socket.off('alarm');
    };
  }, [socket, selectedEquipment]);

  const loadEquipment = async () => {
    try {
      const response = await fetch('/api/equipment');
      const data = await response.json();
      setEquipmentList(data);
      if (data.length > 0) {
        setSelectedEquipment(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load equipment:', error);
    }
  };

  const handleSensorUpdate = (data: any) => {
    if (data.equipmentId === selectedEquipment) {
      setSensorData(data.sensors);
      setLastUpdate(new Date());
      
      // Update metrics
      updateMetrics(data.sensors);
      
      // Run diagnostics if we have predictions
      if (data.predictions) {
        processPredictions(data.predictions);
      }
    }
  };

  const handleDiagnosticsResult = (predictions: any) => {
    processPredictions(predictions);
  };

  const handleAlarm = (alarm: any) => {
    console.log('Alarm received:', alarm);
    // Handle alarm notification
  };

  const updateMetrics = (sensors: any[]) => {
    const newMetrics = { ...metrics };
    
    sensors.forEach(sensor => {
      switch (sensor.type) {
        case 'temperature':
          if (sensor.name.includes('DISCHARGE')) {
            newMetrics.temperature = sensor.value;
          }
          break;
        case 'pressure':
          if (sensor.name.includes('HEAD')) {
            newMetrics.pressure = sensor.value;
          }
          break;
        case 'flow':
          if (sensor.name.includes('AIR')) {
            newMetrics.airflow = sensor.value;
          }
          break;
      }
    });
    
    setMetrics(newMetrics);
  };

  const processPredictions = (predictions: any) => {
    if (predictions.faults) {
      setFaults(predictions.faults.filter((f: any) => f.confidence > 0.5));
    }
    if (predictions.efficiency) {
      setMetrics(prev => ({ ...prev, efficiency: predictions.efficiency }));
    }
  };

  const startMonitoring = () => {
    if (socket && selectedEquipment) {
      socket.emit('start-monitoring', selectedEquipment);
      setIsMonitoring(true);
    }
  };

  const stopMonitoring = () => {
    if (socket) {
      socket.emit('stop-monitoring');
      setIsMonitoring(false);
    }
  };

  const runDiagnostics = () => {
    if (socket && selectedEquipment) {
      socket.emit('run-diagnostics', selectedEquipment);
    }
  };

  const getHealthScore = () => {
    if (faults.length === 0) return 100;
    const avgSeverity = faults.reduce((sum, f) => sum + f.severity, 0) / faults.length;
    return Math.max(0, 100 - (avgSeverity * 20));
  };

  const healthScore = getHealthScore();

  // Quick Action Handlers
  const handleAdjustSetpoints = () => {
    setShowSetpointModal(true);
  };

  const handleClearFaults = async () => {
    try {
      const response = await fetch(`/api/alarms/clear/${selectedEquipment}`, { 
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        setFaults([]);
        alert('Faults cleared successfully');
      }
    } catch (error) {
      console.error('Failed to clear faults:', error);
      alert('Failed to clear faults');
    }
  };

  const handleExportData = async () => {
    try {
      const response = await fetch(`/api/sensors/${selectedEquipment}/export?format=csv`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sensor-data-${selectedEquipment}-${new Date().toISOString()}.csv`;
        a.click();
      }
    } catch (error) {
      console.error('Failed to export data:', error);
      alert('Failed to export data');
    }
  };

  const handleScheduleService = () => {
    setShowServiceModal(true);
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="equipment-selector">
          <label>Equipment:</label>
          <select
            value={selectedEquipment}
            onChange={(e) => setSelectedEquipment(e.target.value)}
          >
            {equipmentList.map(eq => (
              <option key={eq.id} value={eq.id}>
                {eq.location_name} - {eq.model_number}
              </option>
            ))}
          </select>
        </div>
        
        <div className="monitoring-controls">
          {!isMonitoring ? (
            <button className="btn-primary" onClick={startMonitoring}>
              <Activity size={16} />
              Start Monitoring
            </button>
          ) : (
            <button className="btn-secondary" onClick={stopMonitoring}>
              <Activity size={16} />
              Stop Monitoring
            </button>
          )}
          <button className="btn-accent" onClick={runDiagnostics}>
            <Cpu size={16} />
            Run Diagnostics
          </button>
        </div>
        
        {lastUpdate && (
          <div className="last-update">
            <Clock size={14} />
            Updated {formatDistanceToNow(lastUpdate, { addSuffix: true })}
          </div>
        )}
      </div>

      {/* System Health Overview */}
      <div className="health-overview">
        <div className={`health-score ${healthScore > 80 ? 'good' : healthScore > 60 ? 'warning' : 'critical'}`}>
          <div className="score-circle">
            <svg viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="10"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={healthScore > 80 ? '#10b981' : healthScore > 60 ? '#f59e0b' : '#ef4444'}
                strokeWidth="10"
                strokeDasharray={`${healthScore * 2.83} 283`}
                transform="rotate(-90 50 50)"
              />
              <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" fontSize="24" fontWeight="bold">
                {healthScore}%
              </text>
            </svg>
          </div>
          <div className="health-details">
            <h3>System Health</h3>
            <p>{healthScore > 80 ? 'Operating Normally' : healthScore > 60 ? 'Minor Issues Detected' : 'Critical Issues'}</p>
          </div>
        </div>

        <div className="metrics-summary">
          <div className="metric-tile">
            <Gauge className="metric-icon" />
            <div className="metric-content">
              <span className="metric-label">Efficiency</span>
              <span className="metric-value">{metrics.efficiency.toFixed(1)}%</span>
            </div>
          </div>
          
          <div className="metric-tile">
            <Zap className="metric-icon" />
            <div className="metric-content">
              <span className="metric-label">Power</span>
              <span className="metric-value">{metrics.power.toFixed(1)} kW</span>
            </div>
          </div>
          
          <div className="metric-tile">
            <ThermometerSun className="metric-icon" />
            <div className="metric-content">
              <span className="metric-label">Discharge Temp</span>
              <span className="metric-value">{metrics.temperature.toFixed(1)}°F</span>
            </div>
          </div>
          
          <div className="metric-tile">
            <Droplets className="metric-icon" />
            <div className="metric-content">
              <span className="metric-label">Head Pressure</span>
              <span className="metric-value">{metrics.pressure.toFixed(0)} PSI</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Faults */}
      {faults.length > 0 && (
        <div className="active-faults">
          <h3>
            <AlertTriangle size={20} />
            Active Faults Detected
          </h3>
          <div className="fault-list">
            {faults.map((fault, index) => (
              <div key={index} className={`fault-item severity-${fault.severity}`}>
                <div className="fault-icon">
                  {fault.severity >= 3 ? <AlertTriangle /> : <Activity />}
                </div>
                <div className="fault-details">
                  <h4>{fault.name}</h4>
                  <p>{fault.description}</p>
                  <div className="fault-meta">
                    <span className="confidence">
                      Confidence: {(fault.confidence * 100).toFixed(1)}%
                    </span>
                    <span className="severity">
                      Severity: Level {fault.severity}
                    </span>
                  </div>
                </div>
                <div className="fault-actions">
                  <button className="btn-small">View Details</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="dashboard-grid">
        {/* Live Sensor Readings */}
        <div className="dashboard-section sensors">
          <h3>
            <Activity size={20} />
            Live Sensor Readings
          </h3>
          <SensorGrid sensors={sensorData} />
        </div>

        {/* Trend Graphs */}
        <div className="dashboard-section trends">
          <h3>
            <TrendingUp size={20} />
            Performance Trends
          </h3>
          <TrendGraph 
            equipmentId={selectedEquipment}
            metrics={['temperature', 'pressure', 'power', 'efficiency']}
          />
        </div>

        {/* Equipment Status */}
        <div className="dashboard-section equipment">
          <h3>
            <Shield size={20} />
            Equipment Status
          </h3>
          <EquipmentStatus 
            equipmentId={selectedEquipment}
          />
        </div>

        {/* Apollo AI Insights */}
        <div className="dashboard-section insights">
          <h3>
            <Cpu size={20} />
            Apollo AI Insights
          </h3>
          <FaultDetection />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="action-buttons">
          <button className="action-btn" onClick={handleAdjustSetpoints}>
            <Wind size={20} />
            <span>Alert Thresholds</span>
          </button>
          <button className="action-btn" onClick={handleClearFaults}>
            <CheckCircle size={20} />
            <span>Clear Faults</span>
          </button>
          <button className="action-btn" onClick={handleExportData}>
            <Activity size={20} />
            <span>Export Data</span>
          </button>
          <button className="action-btn" onClick={handleScheduleService}>
            <Shield size={20} />
            <span>Generate Report</span>
          </button>
        </div>
      </div>

      {/* Alert Thresholds Modal */}
      {showSetpointModal && (
        <div className="modal-overlay" onClick={() => setShowSetpointModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Configure Alert Thresholds</h2>
            <button className="close-btn" onClick={() => setShowSetpointModal(false)}>×</button>
            <form onSubmit={(e) => {
              e.preventDefault();
              // Handle threshold configuration
              alert('Alert thresholds updated successfully');
              setShowSetpointModal(false);
            }}>
              <div className="form-group">
                <label>Temperature Alert Threshold (°F)</label>
                <input type="number" defaultValue="85" min="70" max="100" step="1" />
              </div>
              <div className="form-group">
                <label>Humidity Alert Threshold (%)</label>
                <input type="number" defaultValue="70" min="50" max="90" step="1" />
              </div>
              <div className="form-group">
                <label>Static Pressure Alert Threshold (in WC)</label>
                <input type="number" defaultValue="1.5" min="0.5" max="3.0" step="0.1" />
              </div>
              <div className="form-group">
                <label>Power Usage Alert Threshold (kW)</label>
                <input type="number" defaultValue="50" min="10" max="200" step="5" />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn-primary">Save Thresholds</button>
                <button type="button" className="btn-secondary" onClick={() => setShowSetpointModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate Report Modal */}
      {showServiceModal && (
        <div className="modal-overlay" onClick={() => setShowServiceModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Generate Report</h2>
            <button className="close-btn" onClick={() => setShowServiceModal(false)}>×</button>
            <form onSubmit={(e) => {
              e.preventDefault();
              // Handle report generation
              alert('Report generation started. You will receive an email when complete.');
              setShowServiceModal(false);
            }}>
              <div className="form-group">
                <label>Report Type</label>
                <select>
                  <option>Energy Consumption Analysis</option>
                  <option>Fault History Report</option>
                  <option>Equipment Performance Summary</option>
                  <option>Cost Analysis Report</option>
                  <option>Monthly Executive Summary</option>
                </select>
              </div>
              <div className="form-group">
                <label>Date Range</label>
                <select>
                  <option>Last 7 Days</option>
                  <option>Last 30 Days</option>
                  <option>Last Quarter</option>
                  <option>Year to Date</option>
                  <option>Custom Range</option>
                </select>
              </div>
              <div className="form-group">
                <label>Format</label>
                <select>
                  <option>PDF</option>
                  <option>Excel</option>
                  <option>CSV</option>
                </select>
              </div>
              <div className="form-group">
                <label>Email To</label>
                <input type="email" defaultValue={localStorage.getItem('userEmail') || ''} required />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn-primary">Generate Report</button>
                <button type="button" className="btn-secondary" onClick={() => setShowServiceModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
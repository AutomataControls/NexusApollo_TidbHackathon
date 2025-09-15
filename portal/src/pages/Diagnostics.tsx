import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import {
  Brain, Play, AlertTriangle, CheckCircle, XCircle,
  TrendingUp, TrendingDown, Activity, RefreshCw,
  FileText, Download, Gauge, Zap, Thermometer, Wind
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell, PieChart, Pie
} from 'recharts';

interface DiagnosticsProps {
  socket: Socket | null;
}

interface Equipment {
  id: number;
  location_name: string;
  model_number: string;
  customer_name?: string;
}

interface DiagnosticResult {
  timestamp: string;
  equipment_id: number;
  faults: FaultPrediction[];
  efficiency: number;
  health_score: number;
  recommendations: string[];
  sensor_readings: SensorReading[];
}

interface FaultPrediction {
  type: string;
  confidence: number;
  severity: number;
  description: string;
  affected_component: string;
}

interface SensorReading {
  name: string;
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
}

const Diagnostics: React.FC<DiagnosticsProps> = ({ socket }) => {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<DiagnosticResult | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'history'>('overview');

  // Fault type configurations
  const faultTypes = {
    'low_refrigerant': { icon: Thermometer, color: '#ef4444' },
    'compressor_failure': { icon: Zap, color: '#dc2626' },
    'fan_motor_fault': { icon: Wind, color: '#f59e0b' },
    'sensor_drift': { icon: Activity, color: '#f97316' },
    'filter_clogged': { icon: Wind, color: '#fbbf24' },
    'efficiency_degradation': { icon: TrendingDown, color: '#fb923c' }
  };

  useEffect(() => {
    loadEquipment();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('diagnostics-result', handleDiagnosticsResult);
      socket.on('sensor-update', handleSensorUpdate);
      
      return () => {
        socket.off('diagnostics-result');
        socket.off('sensor-update');
      };
    }
  }, [socket]);

  const loadEquipment = async () => {
    try {
      const response = await fetch('/api/equipment');
      const data = await response.json();
      
      // Fetch customer names for each equipment
      const equipmentWithCustomers = await Promise.all(
        data.map(async (eq: any) => {
          const customerRes = await fetch(`/api/customers/${eq.customer_id}`);
          const customer = await customerRes.json();
          return { ...eq, customer_name: customer.name };
        })
      );
      
      setEquipment(equipmentWithCustomers);
      if (equipmentWithCustomers.length > 0 && !selectedEquipment) {
        setSelectedEquipment(equipmentWithCustomers[0].id.toString());
      }
    } catch (error) {
      console.error('Failed to load equipment:', error);
    }
  };

  const handleDiagnosticsResult = (result: DiagnosticResult) => {
    setLastResult(result);
    setIsRunning(false);
    
    // Add to historical data
    setHistoricalData(prev => [...prev.slice(-99), {
      timestamp: result.timestamp,
      health_score: result.health_score,
      efficiency: result.efficiency,
      fault_count: result.faults.length
    }]);
  };

  const handleSensorUpdate = (data: any) => {
    if (data.equipmentId === parseInt(selectedEquipment) && data.predictions) {
      const result: DiagnosticResult = {
        timestamp: data.timestamp,
        equipment_id: data.equipmentId,
        faults: data.predictions.faults || [],
        efficiency: data.predictions.efficiency || 0,
        health_score: data.predictions.health_score || 0,
        recommendations: data.predictions.recommendations || [],
        sensor_readings: data.sensors || []
      };
      handleDiagnosticsResult(result);
    }
  };

  const runDiagnostics = () => {
    if (!socket || !selectedEquipment) return;
    
    setIsRunning(true);
    socket.emit('run-diagnostics', parseInt(selectedEquipment));
  };

  const getSeverityColor = (severity: number) => {
    if (severity >= 3) return '#ef4444'; // red
    if (severity >= 2) return '#f59e0b'; // yellow
    return '#10b981'; // green
  };

  const getSeverityLabel = (severity: number) => {
    if (severity >= 3) return 'Critical';
    if (severity >= 2) return 'Warning';
    return 'Info';
  };

  const getHealthStatus = (score: number) => {
    if (score >= 90) return { label: 'Excellent', color: '#10b981' };
    if (score >= 75) return { label: 'Good', color: '#3b82f6' };
    if (score >= 60) return { label: 'Fair', color: '#f59e0b' };
    return { label: 'Poor', color: '#ef4444' };
  };

  const exportReport = () => {
    if (!lastResult) return;
    
    const report = {
      equipment: equipment.find(eq => eq.id === parseInt(selectedEquipment)),
      diagnostic_results: lastResult,
      generated_at: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostic-report-${selectedEquipment}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const radialData = lastResult ? [{
    name: 'Health',
    value: lastResult.health_score,
    fill: getHealthStatus(lastResult.health_score).color
  }] : [];

  const faultDistribution = lastResult ? 
    Object.entries(
      lastResult.faults.reduce((acc, fault) => {
        acc[fault.type] = (acc[fault.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ).map(([type, count]) => ({
      name: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: count,
      fill: faultTypes[type as keyof typeof faultTypes]?.color || '#6b7280'
    })) : [];

  return (
    <div className="diagnostics-page">
      <div className="page-header">
        <h1>
          <Brain className="page-icon" />
          Apollo AI Diagnostics
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
                {eq.customer_name} - {eq.location_name}
              </option>
            ))}
          </select>
          
          <button
            className="btn-primary"
            onClick={runDiagnostics}
            disabled={!selectedEquipment || isRunning}
          >
            {isRunning ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Running Analysis...
              </>
            ) : (
              <>
                <Play size={16} />
                Run Diagnostics
              </>
            )}
          </button>
          
          {lastResult && (
            <button
              className="btn-secondary"
              onClick={exportReport}
            >
              <Download size={16} />
              Export Report
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-nav">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Detailed Analysis
        </button>
        <button
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && lastResult && (
        <div className="diagnostics-overview">
          <div className="metrics-grid">
            {/* Health Score */}
            <div className="metric-card large">
              <h3>System Health Score</h3>
              <div className="health-gauge">
                <ResponsiveContainer width="100%" height={200}>
                  <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" data={radialData}>
                    <RadialBar dataKey="value" cornerRadius={10} fill={radialData[0]?.fill} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="gauge-center">
                  <span className="gauge-value">{lastResult.health_score}%</span>
                  <span className="gauge-label">{getHealthStatus(lastResult.health_score).label}</span>
                </div>
              </div>
            </div>

            {/* Efficiency */}
            <div className="metric-card">
              <div className="metric-header">
                <Gauge size={20} />
                <h3>Efficiency Rating</h3>
              </div>
              <div className="metric-value">
                {lastResult.efficiency.toFixed(1)}%
                {lastResult.efficiency < 85 && (
                  <TrendingDown size={20} className="text-danger" />
                )}
              </div>
              <p className="metric-description">
                {lastResult.efficiency >= 90 ? 'Operating at peak efficiency' :
                 lastResult.efficiency >= 80 ? 'Good efficiency, minor optimization possible' :
                 'Efficiency below target, maintenance recommended'}
              </p>
            </div>

            {/* Fault Count */}
            <div className="metric-card">
              <div className="metric-header">
                <AlertTriangle size={20} />
                <h3>Active Faults</h3>
              </div>
              <div className="metric-value">
                {lastResult.faults.length}
                {lastResult.faults.filter(f => f.severity >= 3).length > 0 && (
                  <span className="critical-badge">
                    {lastResult.faults.filter(f => f.severity >= 3).length} Critical
                  </span>
                )}
              </div>
              <div className="fault-summary">
                {lastResult.faults.length === 0 ? (
                  <span className="text-success">
                    <CheckCircle size={16} /> No faults detected
                  </span>
                ) : (
                  <span className="text-warning">
                    Immediate attention required
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Fault Distribution */}
          {faultDistribution.length > 0 && (
            <div className="chart-card">
              <h3>Fault Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={faultDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {faultDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Recommendations */}
          {lastResult.recommendations.length > 0 && (
            <div className="recommendations-card">
              <h3>
                <FileText size={20} />
                AI Recommendations
              </h3>
              <ul className="recommendations-list">
                {lastResult.recommendations.map((rec, index) => (
                  <li key={index}>
                    <CheckCircle size={16} className="text-primary" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Details Tab */}
      {activeTab === 'details' && lastResult && (
        <div className="diagnostics-details">
          {/* Detected Faults */}
          <div className="faults-section">
            <h3>Detected Faults</h3>
            {lastResult.faults.length === 0 ? (
              <div className="no-faults">
                <CheckCircle size={48} className="text-success" />
                <p>No faults detected in the system</p>
              </div>
            ) : (
              <div className="faults-grid">
                {lastResult.faults.map((fault, index) => {
                  const FaultIcon = faultTypes[fault.type as keyof typeof faultTypes]?.icon || AlertTriangle;
                  return (
                    <div key={index} className={`fault-card severity-${fault.severity}`}>
                      <div className="fault-header">
                        <FaultIcon size={24} />
                        <div>
                          <h4>{fault.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h4>
                          <span className={`severity-badge ${getSeverityLabel(fault.severity).toLowerCase()}`}>
                            {getSeverityLabel(fault.severity)}
                          </span>
                        </div>
                      </div>
                      <p className="fault-description">{fault.description}</p>
                      <div className="fault-details">
                        <div className="detail-item">
                          <span className="detail-label">Component:</span>
                          <span>{fault.affected_component}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Confidence:</span>
                          <span>{(fault.confidence * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sensor Readings */}
          <div className="sensors-section">
            <h3>Current Sensor Readings</h3>
            <div className="sensors-grid">
              {lastResult.sensor_readings.map((sensor, index) => (
                <div key={index} className={`sensor-card status-${sensor.status}`}>
                  <div className="sensor-name">{sensor.name}</div>
                  <div className="sensor-value">
                    {sensor.value.toFixed(1)} {sensor.unit}
                  </div>
                  <div className={`sensor-status ${sensor.status}`}>
                    {sensor.status === 'normal' && <CheckCircle size={14} />}
                    {sensor.status === 'warning' && <AlertTriangle size={14} />}
                    {sensor.status === 'critical' && <XCircle size={14} />}
                    {sensor.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="diagnostics-history">
          {historicalData.length > 0 ? (
            <>
              <div className="chart-card">
                <h3>Health Score Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={historicalData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis domain={[0, 100]} />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="health_score" 
                      stroke="#10b981" 
                      name="Health Score"
                      strokeWidth={2}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="efficiency" 
                      stroke="#3b82f6" 
                      name="Efficiency"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card">
                <h3>Fault Count History</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={historicalData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="fault_count" 
                      stroke="#ef4444" 
                      fill="#fca5a5"
                      name="Faults"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <Activity size={48} />
              <p>No historical data available</p>
              <p className="text-muted">Run diagnostics to start building history</p>
            </div>
          )}
        </div>
      )}

      {/* Initial State */}
      {!lastResult && activeTab === 'overview' && (
        <div className="empty-state">
          <Brain size={64} />
          <h3>No Diagnostic Data Available</h3>
          <p>Select equipment and run diagnostics to analyze system health</p>
          <button
            className="btn-primary"
            onClick={runDiagnostics}
            disabled={!selectedEquipment || isRunning}
          >
            <Play size={16} />
            Run First Diagnostic
          </button>
        </div>
      )}
    </div>
  );
};

export default Diagnostics;
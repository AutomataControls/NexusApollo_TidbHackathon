import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import {
  Bell, AlertTriangle, CheckCircle, XCircle, Clock,
  Filter, Download, Trash2, Volume2, VolumeX,
  TrendingUp, Shield, RefreshCw, ChevronDown, Info
} from 'lucide-react';

interface AlarmsProps {
  socket: Socket | null;
}

interface Alarm {
  id: number;
  equipment_id: number;
  equipment_name?: string;
  customer_name?: string;
  type: string;
  source: string;
  value: string;
  severity: number;
  timestamp: string;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved: boolean;
  resolved_at?: string;
  notes?: string;
}

interface AlarmStats {
  total: number;
  critical: number;
  warning: number;
  info: number;
  unacknowledged: number;
  todayCount: number;
}

const Alarms: React.FC<AlarmsProps> = ({ socket }) => {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [filteredAlarms, setFilteredAlarms] = useState<Alarm[]>([]);
  const [stats, setStats] = useState<AlarmStats>({
    total: 0,
    critical: 0,
    warning: 0,
    info: 0,
    unacknowledged: 0,
    todayCount: 0
  });
  const [filter, setFilter] = useState({
    severity: 'all',
    status: 'active',
    equipment: 'all',
    timeRange: '24h'
  });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedAlarms, setSelectedAlarms] = useState<Set<number>>(new Set());
  const [expandedAlarm, setExpandedAlarm] = useState<number | null>(null);
  
  // Alarm type configurations
  const alarmTypes = {
    'sensor_high': { label: 'Sensor High', color: '#f59e0b' },
    'sensor_low': { label: 'Sensor Low', color: '#3b82f6' },
    'fault_detected': { label: 'Fault Detected', color: '#ef4444' },
    'low_power_factor': { label: 'Low Power Factor', color: '#f97316' },
    'high_thd': { label: 'High THD', color: '#dc2626' },
    'communication_loss': { label: 'Communication Loss', color: '#6b7280' },
    'maintenance_due': { label: 'Maintenance Due', color: '#8b5cf6' }
  };

  useEffect(() => {
    loadAlarms();
    
    // Set up real-time alarm updates
    if (socket) {
      socket.on('alarm', handleNewAlarm);
      socket.on('alarm-acknowledged', handleAlarmAcknowledged);
      socket.on('alarm-resolved', handleAlarmResolved);
      
      return () => {
        socket.off('alarm');
        socket.off('alarm-acknowledged');
        socket.off('alarm-resolved');
      };
    }
  }, [socket]);

  useEffect(() => {
    applyFilters();
    calculateStats();
  }, [alarms, filter]);

  const loadAlarms = async () => {
    try {
      const response = await fetch('/api/alarms');
      const data = await response.json();
      
      // Enrich with equipment and customer names
      const enrichedAlarms = await Promise.all(
        data.map(async (alarm: Alarm) => {
          try {
            const eqResponse = await fetch(`/api/equipment/${alarm.equipment_id}`);
            const equipment = await eqResponse.json();
            const custResponse = await fetch(`/api/customers/${equipment.customer_id}`);
            const customer = await custResponse.json();
            
            return {
              ...alarm,
              equipment_name: equipment.location_name,
              customer_name: customer.name
            };
          } catch {
            return alarm;
          }
        })
      );
      
      setAlarms(enrichedAlarms);
    } catch (error) {
      console.error('Failed to load alarms:', error);
    }
  };

  const handleNewAlarm = (alarm: Alarm) => {
    setAlarms(prev => [alarm, ...prev]);
    
    // Play sound if enabled
    if (soundEnabled && alarm.severity >= 2) {
      const audio = new Audio('/alarm-sound.mp3');
      audio.play().catch(() => {});
    }
    
    // Show notification if supported
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`Apollo Nexus Alert: ${alarm.type}`, {
        body: `${alarm.source}: ${alarm.value}`,
        icon: '/icon-192.png'
      });
    }
  };

  const handleAlarmAcknowledged = (alarmId: number, acknowledgedBy: string) => {
    setAlarms(prev => prev.map(alarm => 
      alarm.id === alarmId 
        ? { ...alarm, acknowledged: true, acknowledged_by: acknowledgedBy, acknowledged_at: new Date().toISOString() }
        : alarm
    ));
  };

  const handleAlarmResolved = (alarmId: number) => {
    setAlarms(prev => prev.map(alarm => 
      alarm.id === alarmId 
        ? { ...alarm, resolved: true, resolved_at: new Date().toISOString() }
        : alarm
    ));
  };

  const applyFilters = () => {
    let filtered = [...alarms];
    
    // Severity filter
    if (filter.severity !== 'all') {
      filtered = filtered.filter(a => a.severity === parseInt(filter.severity));
    }
    
    // Status filter
    switch (filter.status) {
      case 'active':
        filtered = filtered.filter(a => !a.resolved);
        break;
      case 'unacknowledged':
        filtered = filtered.filter(a => !a.acknowledged && !a.resolved);
        break;
      case 'resolved':
        filtered = filtered.filter(a => a.resolved);
        break;
    }
    
    // Time range filter
    const now = new Date();
    let startTime = new Date();
    switch (filter.timeRange) {
      case '1h':
        startTime.setHours(now.getHours() - 1);
        break;
      case '24h':
        startTime.setDate(now.getDate() - 1);
        break;
      case '7d':
        startTime.setDate(now.getDate() - 7);
        break;
      case '30d':
        startTime.setDate(now.getDate() - 30);
        break;
    }
    if (filter.timeRange !== 'all') {
      filtered = filtered.filter(a => new Date(a.timestamp) >= startTime);
    }
    
    // Sort by timestamp descending
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    setFilteredAlarms(filtered);
  };

  const calculateStats = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    setStats({
      total: alarms.filter(a => !a.resolved).length,
      critical: alarms.filter(a => !a.resolved && a.severity >= 3).length,
      warning: alarms.filter(a => !a.resolved && a.severity === 2).length,
      info: alarms.filter(a => !a.resolved && a.severity === 1).length,
      unacknowledged: alarms.filter(a => !a.resolved && !a.acknowledged).length,
      todayCount: alarms.filter(a => new Date(a.timestamp) >= today).length
    });
  };

  const acknowledgeAlarm = async (alarmId: number) => {
    try {
      await fetch(`/api/alarms/${alarmId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledged_by: 'Current User' }) // Replace with actual user
      });
      
      handleAlarmAcknowledged(alarmId, 'Current User');
    } catch (error) {
      console.error('Failed to acknowledge alarm:', error);
    }
  };

  const resolveAlarm = async (alarmId: number, notes?: string) => {
    try {
      await fetch(`/api/alarms/${alarmId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      });
      
      handleAlarmResolved(alarmId);
    } catch (error) {
      console.error('Failed to resolve alarm:', error);
    }
  };

  const acknowledgeSelected = async () => {
    for (const alarmId of selectedAlarms) {
      await acknowledgeAlarm(alarmId);
    }
    setSelectedAlarms(new Set());
  };

  const exportAlarms = () => {
    const data = filteredAlarms.map(alarm => ({
      ...alarm,
      severity_label: getSeverityLabel(alarm.severity),
      type_label: alarmTypes[alarm.type as keyof typeof alarmTypes]?.label || alarm.type
    }));
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alarms-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  const getSeverityIcon = (severity: number) => {
    if (severity >= 3) return <XCircle className="text-danger" />;
    if (severity === 2) return <AlertTriangle className="text-warning" />;
    return <Info className="text-info" />;
  };

  const getSeverityLabel = (severity: number) => {
    if (severity >= 3) return 'Critical';
    if (severity === 2) return 'Warning';
    return 'Info';
  };

  const getSeverityClass = (severity: number) => {
    if (severity >= 3) return 'critical';
    if (severity === 2) return 'warning';
    return 'info';
  };

  return (
    <div className="alarms-page">
      <div className="page-header">
        <h1>
          <Bell className="page-icon" />
          Alarms & Notifications
        </h1>
        <div className="header-actions">
          <button
            className="btn-icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Mute Alarms' : 'Enable Sound'}
          >
            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          
          <button
            className="btn-secondary"
            onClick={exportAlarms}
          >
            <Download size={16} />
            Export
          </button>
          
          <button
            className="btn-secondary"
            onClick={requestNotificationPermission}
          >
            <Bell size={16} />
            Enable Notifications
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="alarm-stats">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Active Alarms</div>
        </div>
        <div className="stat-card critical">
          <div className="stat-value">{stats.critical}</div>
          <div className="stat-label">Critical</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value">{stats.warning}</div>
          <div className="stat-label">Warning</div>
        </div>
        <div className="stat-card info">
          <div className="stat-value">{stats.info}</div>
          <div className="stat-label">Info</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.unacknowledged}</div>
          <div className="stat-label">Unacknowledged</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.todayCount}</div>
          <div className="stat-label">Today</div>
        </div>
      </div>

      {/* Filters */}
      <div className="alarm-filters">
        <div className="filter-group">
          <label>Severity</label>
          <select
            value={filter.severity}
            onChange={(e) => setFilter({ ...filter, severity: e.target.value })}
          >
            <option value="all">All Severities</option>
            <option value="3">Critical Only</option>
            <option value="2">Warning</option>
            <option value="1">Info</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label>Status</label>
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          >
            <option value="active">Active</option>
            <option value="unacknowledged">Unacknowledged</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label>Time Range</label>
          <select
            value={filter.timeRange}
            onChange={(e) => setFilter({ ...filter, timeRange: e.target.value })}
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>
        
        {selectedAlarms.size > 0 && (
          <button
            className="btn-primary"
            onClick={acknowledgeSelected}
          >
            <CheckCircle size={16} />
            Acknowledge Selected ({selectedAlarms.size})
          </button>
        )}
      </div>

      {/* Alarms List */}
      <div className="alarms-list">
        {filteredAlarms.length === 0 ? (
          <div className="empty-state">
            <Bell size={48} />
            <p>No alarms found</p>
            <p className="text-muted">Alarms will appear here when triggered</p>
          </div>
        ) : (
          filteredAlarms.map(alarm => (
            <div
              key={alarm.id}
              className={`alarm-card ${getSeverityClass(alarm.severity)} ${alarm.acknowledged ? 'acknowledged' : ''} ${alarm.resolved ? 'resolved' : ''}`}
            >
              <div className="alarm-header">
                <div className="alarm-select">
                  <input
                    type="checkbox"
                    checked={selectedAlarms.has(alarm.id)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedAlarms);
                      if (e.target.checked) {
                        newSelected.add(alarm.id);
                      } else {
                        newSelected.delete(alarm.id);
                      }
                      setSelectedAlarms(newSelected);
                    }}
                    disabled={alarm.resolved}
                  />
                </div>
                
                <div className="alarm-severity">
                  {getSeverityIcon(alarm.severity)}
                </div>
                
                <div className="alarm-info">
                  <h4>
                    {alarmTypes[alarm.type as keyof typeof alarmTypes]?.label || alarm.type}
                    {alarm.resolved && <span className="resolved-badge">Resolved</span>}
                  </h4>
                  <div className="alarm-meta">
                    <span>{alarm.customer_name} - {alarm.equipment_name}</span>
                    <span className="separator">•</span>
                    <span>{alarm.source}: {alarm.value}</span>
                    <span className="separator">•</span>
                    <Clock size={14} />
                    <span>{new Date(alarm.timestamp).toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="alarm-actions">
                  {!alarm.acknowledged && !alarm.resolved && (
                    <button
                      className="btn-secondary small"
                      onClick={() => acknowledgeAlarm(alarm.id)}
                    >
                      <CheckCircle size={14} />
                      Acknowledge
                    </button>
                  )}
                  
                  {alarm.acknowledged && !alarm.resolved && (
                    <button
                      className="btn-primary small"
                      onClick={() => {
                        const notes = prompt('Resolution notes (optional):');
                        if (notes !== null) {
                          resolveAlarm(alarm.id, notes);
                        }
                      }}
                    >
                      <Shield size={14} />
                      Resolve
                    </button>
                  )}
                  
                  <button
                    className="btn-icon"
                    onClick={() => setExpandedAlarm(expandedAlarm === alarm.id ? null : alarm.id)}
                  >
                    <ChevronDown
                      size={16}
                      className={expandedAlarm === alarm.id ? 'rotate-180' : ''}
                    />
                  </button>
                </div>
              </div>
              
              {expandedAlarm === alarm.id && (
                <div className="alarm-details">
                  {alarm.acknowledged && (
                    <div className="detail-row">
                      <span className="detail-label">Acknowledged by:</span>
                      <span>{alarm.acknowledged_by} at {new Date(alarm.acknowledged_at!).toLocaleString()}</span>
                    </div>
                  )}
                  {alarm.resolved && (
                    <div className="detail-row">
                      <span className="detail-label">Resolved at:</span>
                      <span>{new Date(alarm.resolved_at!).toLocaleString()}</span>
                    </div>
                  )}
                  {alarm.notes && (
                    <div className="detail-row">
                      <span className="detail-label">Notes:</span>
                      <span>{alarm.notes}</span>
                    </div>
                  )}
                  <div className="detail-row">
                    <span className="detail-label">Alarm ID:</span>
                    <span className="mono">{alarm.id}</span>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Alarms;
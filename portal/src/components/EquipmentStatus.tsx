import React, { useState, useEffect } from 'react';
import { 
  Power, Fan, Thermometer, Droplets, 
  AlertCircle, CheckCircle, Settings, Activity 
} from 'lucide-react';

interface Equipment {
  id: string;
  name: string;
  type: 'AHU' | 'RTU' | 'VAV' | 'FCU' | 'PUMP' | 'CHILLER';
  status: 'running' | 'stopped' | 'fault' | 'maintenance';
  runtime: number; // hours
  efficiency: number; // percentage
  parameters: {
    supplyTemp?: number;
    returnTemp?: number;
    fanSpeed?: number;
    valvePosition?: number;
    flowRate?: number;
    pressure?: number;
  };
  lastMaintenance: Date;
  nextMaintenance: Date;
}

interface EquipmentStatusProps {
  equipmentId?: string;
  onStatusChange?: (equipment: Equipment) => void;
}

const EquipmentStatus: React.FC<EquipmentStatusProps> = ({ equipmentId, onStatusChange }) => {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch equipment data
  useEffect(() => {
    const fetchEquipment = async () => {
      try {
        let url = '/api/equipment';
        if (equipmentId) {
          url += `/${equipmentId}`;
        }

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          const equipmentList = Array.isArray(data) ? data : [data];
          
          // Transform API data to component format
          const formattedEquipment = equipmentList.map(eq => ({
            id: eq.id,
            name: eq.location_name || eq.model_number,
            type: eq.equipment_type as Equipment['type'],
            status: 'stopped' as const, // Will be updated by real-time data
            runtime: 0, // Will be calculated from logs
            efficiency: 85, // Default, will be updated by Apollo
            parameters: {
              supplyTemp: 0,
              returnTemp: 0,
              fanSpeed: 0,
              valvePosition: 0,
              flowRate: 0,
              pressure: 0
            },
            lastMaintenance: new Date(eq.last_service || Date.now()),
            nextMaintenance: new Date(Date.now() + 90 * 86400000) // 90 days default
          }));

          setEquipment(formattedEquipment);
        }
      } catch (error) {
        console.error('Failed to fetch equipment:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEquipment();
  }, [equipmentId]);

  useEffect(() => {
    // Listen for real-time updates via WebSocket or polling
    const fetchRealtimeData = async () => {
      if (equipment.length === 0) return;

      try {
        const promises = equipment.map(eq => 
          fetch(`/api/sensors/latest/${eq.id}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }).then(res => res.json())
        );

        const results = await Promise.all(promises);
        
        setEquipment(prev => prev.map((eq, index) => {
          const sensorData = results[index];
          if (!sensorData || !sensorData.sensors) return eq;

          // Extract parameters from sensor data
          const params: any = {};
          sensorData.sensors.forEach((sensor: any) => {
            if (sensor.name.includes('SUPPLY_TEMP')) params.supplyTemp = sensor.value;
            if (sensor.name.includes('RETURN_TEMP')) params.returnTemp = sensor.value;
            if (sensor.name.includes('FAN_SPEED')) params.fanSpeed = sensor.value;
            if (sensor.name.includes('VALVE_POSITION')) params.valvePosition = sensor.value;
            if (sensor.name.includes('FLOW_RATE')) params.flowRate = sensor.value;
            if (sensor.name.includes('PRESSURE')) params.pressure = sensor.value;
          });

          return {
            ...eq,
            status: sensorData.power > 5 ? 'running' : 'stopped',
            efficiency: sensorData.efficiency || eq.efficiency,
            parameters: { ...eq.parameters, ...params },
            runtime: sensorData.runtime || eq.runtime
          };
        }));
      } catch (error) {
        console.error('Failed to fetch real-time data:', error);
      }
    };

    const interval = setInterval(fetchRealtimeData, 5000);
    fetchRealtimeData(); // Initial fetch

    return () => clearInterval(interval);
  }, [equipment.length]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <CheckCircle className="status-icon running" />;
      case 'stopped': return <Power className="status-icon stopped" />;
      case 'fault': return <AlertCircle className="status-icon fault" />;
      case 'maintenance': return <Settings className="status-icon maintenance" />;
      default: return <Activity className="status-icon" />;
    }
  };

  const getEquipmentIcon = (type: string) => {
    switch (type) {
      case 'AHU':
      case 'RTU':
      case 'VAV':
      case 'FCU':
        return <Fan className="equipment-icon" />;
      case 'PUMP':
        return <Droplets className="equipment-icon" />;
      case 'CHILLER':
        return <Thermometer className="equipment-icon" />;
      default:
        return <Settings className="equipment-icon" />;
    }
  };

  const toggleEquipment = (eq: Equipment) => {
    const newStatus: Equipment['status'] = eq.status === 'running' ? 'stopped' : 'running';
    const updated = equipment.map(e => 
      e.id === eq.id ? { ...e, status: newStatus } : e
    );
    setEquipment(updated);
    
    if (onStatusChange) {
      onStatusChange({ ...eq, status: newStatus });
    }
  };

  const formatRuntime = (hours: number) => {
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    return `${days}d ${remainingHours}h`;
  };

  const getDaysUntilMaintenance = (date: Date) => {
    const days = Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="equipment-status">
      <div className="equipment-grid">
        {equipment.map(eq => (
          <div 
            key={eq.id} 
            className={`equipment-card ${eq.status}`}
            onClick={() => setSelectedEquipment(eq)}
          >
            <div className="equipment-header">
              {getEquipmentIcon(eq.type)}
              <div className="equipment-info">
                <h4>{eq.name}</h4>
                <span className="equipment-id">{eq.id}</span>
              </div>
              {getStatusIcon(eq.status)}
            </div>
            
            <div className="equipment-metrics">
              <div className="metric">
                <span className="metric-label">Runtime</span>
                <span className="metric-value">{formatRuntime(eq.runtime)}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Efficiency</span>
                <span className="metric-value">{eq.efficiency}%</span>
              </div>
            </div>
            
            {eq.parameters.supplyTemp !== undefined && (
              <div className="equipment-params">
                <div className="param">
                  <Thermometer size={14} />
                  <span>Supply: {eq.parameters.supplyTemp.toFixed(1)}°F</span>
                </div>
                {eq.parameters.fanSpeed !== undefined && (
                  <div className="param">
                    <Fan size={14} />
                    <span>Fan: {eq.parameters.fanSpeed.toFixed(0)}%</span>
                  </div>
                )}
              </div>
            )}
            
            <div className="equipment-maintenance">
              <span className="maintenance-label">Next Service:</span>
              <span className={`maintenance-days ${getDaysUntilMaintenance(eq.nextMaintenance) < 30 ? 'soon' : ''}`}>
                {getDaysUntilMaintenance(eq.nextMaintenance)} days
              </span>
            </div>
            
            <button 
              className={`btn-control ${eq.status === 'running' ? 'stop' : 'start'}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleEquipment(eq);
              }}
            >
              {eq.status === 'running' ? 'Stop' : 'Start'}
            </button>
          </div>
        ))}
      </div>
      
      {selectedEquipment && (
        <div className="equipment-detail-modal" onClick={() => setSelectedEquipment(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>{selectedEquipment.name} Details</h3>
            <button className="close-btn" onClick={() => setSelectedEquipment(null)}>×</button>
            
            <div className="detail-grid">
              <div className="detail-section">
                <h4>Operating Parameters</h4>
                {Object.entries(selectedEquipment.parameters).map(([key, value]) => (
                  <div key={key} className="detail-item">
                    <span className="detail-label">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                    <span className="detail-value">
                      {typeof value === 'number' ? value.toFixed(1) : value}
                      {key.includes('Temp') ? '°F' : key.includes('Speed') || key.includes('Position') ? '%' : ''}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="detail-section">
                <h4>Maintenance History</h4>
                <div className="detail-item">
                  <span className="detail-label">Last Service:</span>
                  <span className="detail-value">{selectedEquipment.lastMaintenance.toLocaleDateString()}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Next Service:</span>
                  <span className="detail-value">{selectedEquipment.nextMaintenance.toLocaleDateString()}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Total Runtime:</span>
                  <span className="detail-value">{formatRuntime(selectedEquipment.runtime)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EquipmentStatus;
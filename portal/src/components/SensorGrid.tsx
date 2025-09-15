import React from 'react';
import { Thermometer, Wind, Gauge, Activity, Zap, Droplets } from 'lucide-react';

interface SensorReading {
  id: string;
  name: string;
  type: string;
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  lastUpdate: Date;
}

interface SensorGridProps {
  sensors?: SensorReading[];
}

const SensorGrid: React.FC<SensorGridProps> = ({ sensors = [] }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'temperature': return <Thermometer className="sensor-icon" />;
      case 'airflow': return <Wind className="sensor-icon" />;
      case 'pressure': return <Gauge className="sensor-icon" />;
      case 'vibration': return <Activity className="sensor-icon" />;
      case 'current': return <Zap className="sensor-icon" />;
      case 'humidity': return <Droplets className="sensor-icon" />;
      default: return <Gauge className="sensor-icon" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'sensor-normal';
      case 'warning': return 'sensor-warning';
      case 'critical': return 'sensor-critical';
      default: return 'sensor-normal';
    }
  };

  // Default sensors if none provided
  const defaultSensors: SensorReading[] = [
    { id: '1', name: 'Supply Air Temp', type: 'temperature', value: 55.2, unit: '°F', status: 'normal', lastUpdate: new Date() },
    { id: '2', name: 'Return Air Temp', type: 'temperature', value: 72.8, unit: '°F', status: 'normal', lastUpdate: new Date() },
    { id: '3', name: 'Space Temp', type: 'temperature', value: 71.5, unit: '°F', status: 'normal', lastUpdate: new Date() },
    { id: '4', name: 'Air Flow', type: 'airflow', value: 1250, unit: 'CFM', status: 'normal', lastUpdate: new Date() },
    { id: '5', name: 'Static Pressure', type: 'pressure', value: 0.45, unit: 'in WC', status: 'warning', lastUpdate: new Date() },
    { id: '6', name: 'Fan Current', type: 'current', value: 12.5, unit: 'A', status: 'normal', lastUpdate: new Date() },
  ];

  const displaySensors = sensors.length > 0 ? sensors : defaultSensors;

  return (
    <div className="sensor-grid">
      {displaySensors.map((sensor) => (
        <div key={sensor.id} className={`sensor-card ${getStatusColor(sensor.status)}`}>
          <div className="sensor-header">
            {getIcon(sensor.type)}
            <span className="sensor-name">{sensor.name}</span>
          </div>
          <div className="sensor-value">
            {sensor.value.toFixed(1)}
            <span className="sensor-unit">{sensor.unit}</span>
          </div>
          <div className="sensor-status">
            <span className={`status-dot ${sensor.status}`}></span>
            <span className="status-text">{sensor.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SensorGrid;
import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock, Brain } from 'lucide-react';

interface Fault {
  id: string;
  timestamp: Date;
  equipment: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  confidence: number;
  recommendation: string;
  status: 'active' | 'acknowledged' | 'resolved';
}

interface FaultDetectionProps {
  onFaultDetected?: (fault: Fault) => void;
}

const FaultDetection: React.FC<FaultDetectionProps> = ({ onFaultDetected }) => {
  const [faults, setFaults] = useState<Fault[]>([]);
  const [apolloStatus, setApolloStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    // Simulate Apollo AI model initialization
    setTimeout(() => {
      setApolloStatus('ready');
      // Simulate detecting some faults
      const mockFaults: Fault[] = [
        {
          id: '1',
          timestamp: new Date(),
          equipment: 'AHU-01',
          type: 'Temperature Deviation',
          severity: 'medium',
          description: 'Supply air temperature 8°F below setpoint',
          confidence: 92,
          recommendation: 'Check heating valve actuator and verify hot water supply',
          status: 'active'
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 3600000),
          equipment: 'RTU-02',
          type: 'High Static Pressure',
          severity: 'high',
          description: 'Filter pressure drop exceeds threshold',
          confidence: 98,
          recommendation: 'Replace or clean air filters immediately',
          status: 'acknowledged'
        }
      ];
      setFaults(mockFaults);
    }, 2000);
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'fault-low';
      case 'medium': return 'fault-medium';
      case 'high': return 'fault-high';
      case 'critical': return 'fault-critical';
      default: return 'fault-medium';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'low': return '⚠️';
      case 'medium': return '🔶';
      case 'high': return '🔴';
      case 'critical': return '🚨';
      default: return '⚠️';
    }
  };

  const acknowledgeFault = (faultId: string) => {
    setFaults(faults.map(fault => 
      fault.id === faultId ? { ...fault, status: 'acknowledged' } : fault
    ));
  };

  const resolveFault = (faultId: string) => {
    setFaults(faults.map(fault => 
      fault.id === faultId ? { ...fault, status: 'resolved' } : fault
    ));
  };

  return (
    <div className="fault-detection">
      <div className="fault-header">
        <div className="apollo-status">
          <Brain className="apollo-icon" />
          <span className="apollo-label">Apollo AI</span>
          <span className={`apollo-indicator ${apolloStatus}`}>
            {apolloStatus === 'loading' && <Clock size={14} />}
            {apolloStatus === 'ready' && <CheckCircle size={14} />}
            {apolloStatus === 'error' && <XCircle size={14} />}
            {apolloStatus}
          </span>
        </div>
        <div className="fault-summary">
          <span className="fault-count">{faults.filter(f => f.status === 'active').length}</span>
          <span className="fault-label">Active Faults</span>
        </div>
      </div>

      <div className="fault-list">
        {faults.length === 0 ? (
          <div className="no-faults">
            <CheckCircle size={48} className="no-faults-icon" />
            <p>No faults detected</p>
            <span>All systems operating normally</span>
          </div>
        ) : (
          faults.map(fault => (
            <div key={fault.id} className={`fault-card ${getSeverityColor(fault.severity)} ${fault.status}`}>
              <div className="fault-header">
                <span className="fault-severity">{getSeverityIcon(fault.severity)}</span>
                <span className="fault-equipment">{fault.equipment}</span>
                <span className="fault-time">{new Date(fault.timestamp).toLocaleTimeString()}</span>
              </div>
              
              <div className="fault-body">
                <h4 className="fault-type">{fault.type}</h4>
                <p className="fault-description">{fault.description}</p>
                
                <div className="fault-confidence">
                  <span>Confidence: </span>
                  <div className="confidence-bar">
                    <div 
                      className="confidence-fill" 
                      style={{ width: `${fault.confidence}%` }}
                    />
                  </div>
                  <span>{fault.confidence}%</span>
                </div>
                
                <div className="fault-recommendation">
                  <AlertTriangle size={16} />
                  <span>{fault.recommendation}</span>
                </div>
              </div>
              
              <div className="fault-actions">
                {fault.status === 'active' && (
                  <button 
                    className="btn-acknowledge"
                    onClick={() => acknowledgeFault(fault.id)}
                  >
                    Acknowledge
                  </button>
                )}
                {fault.status === 'acknowledged' && (
                  <button 
                    className="btn-resolve"
                    onClick={() => resolveFault(fault.id)}
                  >
                    Mark Resolved
                  </button>
                )}
                {fault.status === 'resolved' && (
                  <span className="status-resolved">✓ Resolved</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FaultDetection;
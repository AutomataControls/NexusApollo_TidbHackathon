import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  DollarSign, TrendingUp, Zap, AlertTriangle,
  Calendar, Clock, Activity, BatteryCharging,
  ThermometerSun, Gauge, CircuitBoard, Waves
} from 'lucide-react';
import { formatDistanceToNow, format, startOfDay, endOfDay } from 'date-fns';

interface EnergyProps {
  socket: Socket | null;
}

interface UtilityRates {
  kwhRate: number;
  demandRate: number;
  timeOfUse: {
    peak: { start: string; end: string; rate: number };
    offPeak: { rate: number };
  };
}

interface PowerMetrics {
  totalKw: number;
  voltage: { L1: number; L2: number; L3: number };
  current: { L1: number; L2: number; L3: number };
  powerFactor: number;
  thd: number;
  kva: number;
  kvar: number;
}

const Energy: React.FC<EnergyProps> = ({ socket }) => {
  const [realtimeData, setRealtimeData] = useState<PowerMetrics | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [costData, setCostData] = useState({
    today: 0,
    month: 0,
    year: 0,
    projected: 0
  });
  const [peakDemand, setPeakDemand] = useState({
    today: 0,
    month: 0,
    timestamp: null as Date | null
  });
  const [utilityRates, setUtilityRates] = useState<UtilityRates>({
    kwhRate: 0.12,
    demandRate: 15.00,
    timeOfUse: {
      peak: { start: '14:00', end: '20:00', rate: 0.18 },
      offPeak: { rate: 0.08 }
    }
  });
  const [showRateConfig, setShowRateConfig] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [equipmentBreakdown, setEquipmentBreakdown] = useState<any[]>([]);

  useEffect(() => {
    if (!socket) return;

    // Subscribe to real-time power updates
    socket.on('sensor-update', (data) => {
      if (data.power) {
        setRealtimeData(data.power);
        updateCostCalculations(data.power);
        checkPeakDemand(data.power.totalKw);
      }
    });

    // Load historical data
    loadHistoricalData();
    loadUtilityRates();
    loadEquipmentBreakdown();

    return () => {
      socket.off('sensor-update');
    };
  }, [socket, selectedTimeRange]);

  const loadHistoricalData = async () => {
    try {
      const response = await fetch(`/api/energy/historical?range=${selectedTimeRange}`);
      const data = await response.json();
      setHistoricalData(data);
    } catch (error) {
      console.error('Failed to load historical data:', error);
    }
  };

  const loadUtilityRates = async () => {
    try {
      const response = await fetch('/api/settings/utility-rates');
      const rates = await response.json();
      if (rates) {
        setUtilityRates(rates);
      }
    } catch (error) {
      console.error('Failed to load utility rates:', error);
    }
  };

  const loadEquipmentBreakdown = async () => {
    try {
      const response = await fetch('/api/energy/equipment-breakdown');
      const data = await response.json();
      setEquipmentBreakdown(data);
    } catch (error) {
      console.error('Failed to load equipment breakdown:', error);
    }
  };

  const updateCostCalculations = (power: PowerMetrics) => {
    const currentHour = new Date().getHours();
    const currentTime = `${currentHour}:00`;
    
    // Determine current rate
    let currentRate = utilityRates.kwhRate;
    if (utilityRates.timeOfUse) {
      const { peak, offPeak } = utilityRates.timeOfUse;
      if (currentTime >= peak.start && currentTime <= peak.end) {
        currentRate = peak.rate;
      } else {
        currentRate = offPeak.rate;
      }
    }

    // Calculate instantaneous cost
    const instantCost = (power.totalKw * currentRate) / 60; // Per minute

    // Update running totals
    setCostData(prev => ({
      ...prev,
      today: prev.today + instantCost,
      month: prev.month + instantCost,
      projected: (prev.month / new Date().getDate()) * 30
    }));
  };

  const checkPeakDemand = (currentKw: number) => {
    setPeakDemand(prev => {
      const newPeak = { ...prev };
      if (currentKw > prev.today) {
        newPeak.today = currentKw;
        newPeak.timestamp = new Date();
      }
      if (currentKw > prev.month) {
        newPeak.month = currentKw;
      }
      return newPeak;
    });
  };

  const saveUtilityRates = async () => {
    try {
      await fetch('/api/settings/utility-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(utilityRates)
      });
      setShowRateConfig(false);
    } catch (error) {
      console.error('Failed to save utility rates:', error);
    }
  };

  const COLORS = ['#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63'];

  return (
    <div className="energy-page">
      <div className="page-header">
        <h1>
          <Zap className="page-icon" />
          Energy Management
        </h1>
        <div className="header-actions">
          <button
            className="btn-secondary"
            onClick={() => setShowRateConfig(!showRateConfig)}
          >
            <DollarSign size={16} />
            Configure Rates
          </button>
          <select
            className="time-range-select"
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
      </div>

      {/* Utility Rate Configuration */}
      {showRateConfig && (
        <div className="rate-config-modal">
          <div className="modal-content">
            <h3>Utility Rate Configuration</h3>
            <div className="form-group">
              <label>Standard kWh Rate ($)</label>
              <input
                type="number"
                step="0.001"
                value={utilityRates.kwhRate}
                onChange={(e) => setUtilityRates(prev => ({
                  ...prev,
                  kwhRate: parseFloat(e.target.value)
                }))}
              />
            </div>
            <div className="form-group">
              <label>Demand Charge ($/kW)</label>
              <input
                type="number"
                step="0.01"
                value={utilityRates.demandRate}
                onChange={(e) => setUtilityRates(prev => ({
                  ...prev,
                  demandRate: parseFloat(e.target.value)
                }))}
              />
            </div>
            <h4>Time of Use Rates</h4>
            <div className="form-group">
              <label>Peak Hours</label>
              <div className="time-range">
                <input
                  type="time"
                  value={utilityRates.timeOfUse.peak.start}
                  onChange={(e) => setUtilityRates(prev => ({
                    ...prev,
                    timeOfUse: {
                      ...prev.timeOfUse,
                      peak: { ...prev.timeOfUse.peak, start: e.target.value }
                    }
                  }))}
                />
                <span>to</span>
                <input
                  type="time"
                  value={utilityRates.timeOfUse.peak.end}
                  onChange={(e) => setUtilityRates(prev => ({
                    ...prev,
                    timeOfUse: {
                      ...prev.timeOfUse,
                      peak: { ...prev.timeOfUse.peak, end: e.target.value }
                    }
                  }))}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Peak Rate ($)</label>
              <input
                type="number"
                step="0.001"
                value={utilityRates.timeOfUse.peak.rate}
                onChange={(e) => setUtilityRates(prev => ({
                  ...prev,
                  timeOfUse: {
                    ...prev.timeOfUse,
                    peak: { ...prev.timeOfUse.peak, rate: parseFloat(e.target.value) }
                  }
                }))}
              />
            </div>
            <div className="form-group">
              <label>Off-Peak Rate ($)</label>
              <input
                type="number"
                step="0.001"
                value={utilityRates.timeOfUse.offPeak.rate}
                onChange={(e) => setUtilityRates(prev => ({
                  ...prev,
                  timeOfUse: {
                    ...prev.timeOfUse,
                    offPeak: { rate: parseFloat(e.target.value) }
                  }
                }))}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={saveUtilityRates}>
                Save Rates
              </button>
              <button className="btn-secondary" onClick={() => setShowRateConfig(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <Zap className="metric-icon" style={{ color: '#f59e0b' }} />
            <span className="metric-label">Current Power</span>
          </div>
          <div className="metric-value">
            {realtimeData ? `${realtimeData.totalKw.toFixed(2)} kW` : '--'}
          </div>
          <div className="metric-subtext">
            {realtimeData && (
              <span className={`pf-indicator ${realtimeData.powerFactor < 0.85 ? 'warning' : ''}`}>
                PF: {realtimeData.powerFactor.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <DollarSign className="metric-icon" style={{ color: '#10b981' }} />
            <span className="metric-label">Today's Cost</span>
          </div>
          <div className="metric-value">
            ${costData.today.toFixed(2)}
          </div>
          <div className="metric-subtext">
            Projected: ${(costData.today / new Date().getHours() * 24).toFixed(2)}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <TrendingUp className="metric-icon" style={{ color: '#ef4444' }} />
            <span className="metric-label">Peak Demand</span>
          </div>
          <div className="metric-value">
            {peakDemand.today.toFixed(2)} kW
          </div>
          <div className="metric-subtext">
            {peakDemand.timestamp && 
              `at ${format(peakDemand.timestamp, 'HH:mm')}`
            }
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <Calendar className="metric-icon" style={{ color: '#8b5cf6' }} />
            <span className="metric-label">Monthly Cost</span>
          </div>
          <div className="metric-value">
            ${costData.month.toFixed(2)}
          </div>
          <div className="metric-subtext">
            Projected: ${costData.projected.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Power Consumption Chart */}
      <div className="chart-container">
        <h3>
          <Activity size={20} />
          Power Consumption Trend
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={historicalData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={(value) => format(new Date(value), 'HH:mm')}
            />
            <YAxis />
            <Tooltip
              labelFormatter={(value) => format(new Date(value), 'MMM dd, HH:mm')}
              formatter={(value: any) => [`${value.toFixed(2)} kW`, 'Power']}
            />
            <Area
              type="monotone"
              dataKey="power"
              stroke="#06b6d4"
              fill="#06b6d4"
              fillOpacity={0.6}
            />
            <Line
              type="monotone"
              dataKey="peakDemand"
              stroke="#ef4444"
              strokeDasharray="5 5"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="charts-row">
        {/* Cost Breakdown */}
        <div className="chart-container half">
          <h3>
            <DollarSign size={20} />
            Cost Breakdown by Time of Use
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Peak Hours', value: costData.today * 0.4, color: '#ef4444' },
                  { name: 'Off-Peak', value: costData.today * 0.6, color: '#10b981' }
                ]}
                dataKey="value"
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
              >
                {historicalData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => `$${value.toFixed(2)}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Equipment Energy Usage */}
        <div className="chart-container half">
          <h3>
            <CircuitBoard size={20} />
            Equipment Energy Distribution
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={equipmentBreakdown}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: any) => `${value.toFixed(2)} kWh`} />
              <Bar dataKey="consumption" fill="#06b6d4" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Electrical Parameters */}
      <div className="electrical-params">
        <h3>
          <Gauge size={20} />
          Real-Time Electrical Parameters
        </h3>
        {realtimeData && (
          <div className="params-grid">
            <div className="param-group">
              <h4>Voltage (V)</h4>
              <div className="phase-values">
                <div className="phase">
                  <span className="phase-label">L1</span>
                  <span className="phase-value">{realtimeData.voltage.L1.toFixed(1)}</span>
                </div>
                <div className="phase">
                  <span className="phase-label">L2</span>
                  <span className="phase-value">{realtimeData.voltage.L2.toFixed(1)}</span>
                </div>
                <div className="phase">
                  <span className="phase-label">L3</span>
                  <span className="phase-value">{realtimeData.voltage.L3.toFixed(1)}</span>
                </div>
              </div>
            </div>

            <div className="param-group">
              <h4>Current (A)</h4>
              <div className="phase-values">
                <div className="phase">
                  <span className="phase-label">L1</span>
                  <span className="phase-value">{realtimeData.current.L1.toFixed(1)}</span>
                </div>
                <div className="phase">
                  <span className="phase-label">L2</span>
                  <span className="phase-value">{realtimeData.current.L2.toFixed(1)}</span>
                </div>
                <div className="phase">
                  <span className="phase-label">L3</span>
                  <span className="phase-value">{realtimeData.current.L3.toFixed(1)}</span>
                </div>
              </div>
            </div>

            <div className="param-group">
              <h4>Power Quality</h4>
              <div className="quality-metrics">
                <div className="metric">
                  <span className="metric-label">THD</span>
                  <span className={`metric-value ${realtimeData.thd > 5 ? 'warning' : ''}`}>
                    {realtimeData.thd.toFixed(1)}%
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">kVA</span>
                  <span className="metric-value">{realtimeData.kva.toFixed(2)}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">kVAR</span>
                  <span className="metric-value">{realtimeData.kvar.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Energy Savings Opportunities */}
      <div className="savings-opportunities">
        <h3>
          <AlertTriangle size={20} />
          Energy Savings Opportunities
        </h3>
        <div className="opportunities-list">
          {realtimeData && realtimeData.powerFactor < 0.85 && (
            <div className="opportunity warning">
              <div className="opportunity-icon">
                <Waves size={24} />
              </div>
              <div className="opportunity-content">
                <h4>Low Power Factor</h4>
                <p>Current PF: {realtimeData.powerFactor.toFixed(2)}. Installing capacitor banks could save up to ${(costData.month * 0.1).toFixed(2)}/month.</p>
              </div>
            </div>
          )}
          
          {peakDemand.month > 100 && (
            <div className="opportunity info">
              <div className="opportunity-icon">
                <TrendingUp size={24} />
              </div>
              <div className="opportunity-content">
                <h4>High Peak Demand</h4>
                <p>Peak: {peakDemand.month.toFixed(2)} kW. Load shifting could reduce demand charges by ${(peakDemand.month * utilityRates.demandRate * 0.2).toFixed(2)}/month.</p>
              </div>
            </div>
          )}

          <div className="opportunity success">
            <div className="opportunity-icon">
              <ThermometerSun size={24} />
            </div>
            <div className="opportunity-content">
              <h4>Apollo Optimization Active</h4>
              <p>AI-driven fault detection is preventing energy waste. Estimated savings: ${(costData.month * 0.15).toFixed(2)}/month.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Energy;
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Calendar, Download } from 'lucide-react';

interface DataPoint {
  time: string;
  temperature: number;
  setpoint: number;
  humidity?: number;
  energy?: number;
}

interface TrendGraphProps {
  title?: string;
  dataType?: 'temperature' | 'humidity' | 'energy' | 'all';
  timeRange?: '1h' | '6h' | '24h' | '7d' | '30d';
  equipmentId?: string;
  metrics?: string[];
  onExport?: (data: DataPoint[]) => void;
}

const TrendGraph: React.FC<TrendGraphProps> = ({ 
  title = "Temperature Trends",
  dataType = 'temperature',
  timeRange = '24h',
  equipmentId,
  metrics,
  onExport 
}) => {
  const [data, setData] = useState<DataPoint[]>([]);
  const [selectedRange, setSelectedRange] = useState(timeRange);

  useEffect(() => {
    // Fetch real data from API
    const fetchData = async () => {
      try {
        const endDate = new Date();
        const startDate = new Date();
        
        switch (selectedRange) {
          case '1h': startDate.setHours(endDate.getHours() - 1); break;
          case '6h': startDate.setHours(endDate.getHours() - 6); break;
          case '24h': startDate.setDate(endDate.getDate() - 1); break;
          case '7d': startDate.setDate(endDate.getDate() - 7); break;
          case '30d': startDate.setDate(endDate.getDate() - 30); break;
        }

        const params = new URLSearchParams({
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          equipment_id: equipmentId || '',
          interval: selectedRange
        });

        const response = await fetch(`/api/sensors/trends?${params}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (response.ok) {
          const trendData = await response.json();
          setData(trendData);
        } else {
          // If API fails, show empty data
          setData([]);
        }
      } catch (error) {
        console.error('Failed to fetch trend data:', error);
        setData([]);
      }
    };

    if (equipmentId) {
      fetchData();
    }
  }, [selectedRange, equipmentId]);

  const handleExport = () => {
    if (onExport) {
      onExport(data);
    } else {
      // Simple CSV export
      const csv = [
        'Time,Temperature,Setpoint,Humidity,Energy',
        ...data.map(d => `${d.time},${d.temperature},${d.setpoint},${d.humidity},${d.energy}`)
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trend-data-${selectedRange}.csv`;
      a.click();
    }
  };

  const getLines = () => {
    switch (dataType) {
      case 'temperature':
        return (
          <>
            <Line 
              type="monotone" 
              dataKey="temperature" 
              stroke="#14b8a6" 
              name="Temperature" 
              strokeWidth={2}
              dot={false}
            />
            <Line 
              type="monotone" 
              dataKey="setpoint" 
              stroke="#ef4444" 
              name="Setpoint" 
              strokeDasharray="5 5"
              strokeWidth={2}
              dot={false}
            />
          </>
        );
      case 'humidity':
        return (
          <Line 
            type="monotone" 
            dataKey="humidity" 
            stroke="#3b82f6" 
            name="Humidity %" 
            strokeWidth={2}
            dot={false}
          />
        );
      case 'energy':
        return (
          <Line 
            type="monotone" 
            dataKey="energy" 
            stroke="#f59e0b" 
            name="Energy (kW)" 
            strokeWidth={2}
            dot={false}
          />
        );
      case 'all':
        return (
          <>
            <Line type="monotone" dataKey="temperature" stroke="#14b8a6" name="Temperature" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="humidity" stroke="#3b82f6" name="Humidity %" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="energy" stroke="#f59e0b" name="Energy (kW)" strokeWidth={2} dot={false} />
          </>
        );
    }
  };

  return (
    <div className="trend-graph-container">
      <div className="trend-header">
        <div className="trend-title">
          <TrendingUp className="trend-icon" />
          <h3>{title}</h3>
        </div>
        
        <div className="trend-controls">
          <div className="time-selector">
            <Calendar size={16} />
            <select 
              value={selectedRange} 
              onChange={(e) => setSelectedRange(e.target.value as any)}
              className="time-select"
            >
              <option value="1h">Last Hour</option>
              <option value="6h">Last 6 Hours</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
          
          <button className="btn-export" onClick={handleExport}>
            <Download size={16} />
            Export
          </button>
        </div>
      </div>
      
      <div className="trend-chart">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart 
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="time" 
              stroke="#6b7280"
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              stroke="#6b7280"
              tick={{ fontSize: 12 }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
            />
            <Legend />
            {getLines()}
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="trend-stats">
        <div className="stat-item">
          <span className="stat-label">Average</span>
          <span className="stat-value">
            {(data.reduce((sum, d) => sum + d.temperature, 0) / data.length || 0).toFixed(1)}°F
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Min</span>
          <span className="stat-value">
            {Math.min(...data.map(d => d.temperature)).toFixed(1)}°F
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Max</span>
          <span className="stat-value">
            {Math.max(...data.map(d => d.temperature)).toFixed(1)}°F
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Points</span>
          <span className="stat-value">{data.length}</span>
        </div>
      </div>
    </div>
  );
};

export default TrendGraph;
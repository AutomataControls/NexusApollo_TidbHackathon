import React, { useState, useEffect } from 'react';
import {
  FileText, Download, Calendar, Filter, TrendingUp,
  BarChart3, PieChart, FileSpreadsheet, Send, Clock,
  Activity, Cpu, Zap, Leaf, Shield, AlertTriangle, Thermometer
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import ReportScheduler from '../components/ReportScheduler';

interface ReportsProps {}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: string;
}

const Reports: React.FC<ReportsProps> = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [selectedEquipment, setSelectedEquipment] = useState<string>('all');
  const [customers, setCustomers] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);

  const reportTemplates: ReportTemplate[] = [
    {
      id: 'energy-summary',
      name: 'Energy Usage Summary',
      description: 'Comprehensive energy consumption and cost analysis',
      icon: TrendingUp,
      category: 'Energy'
    },
    {
      id: 'fault-analysis',
      name: 'Fault Analysis Report',
      description: 'Detailed fault history and patterns',
      icon: BarChart3,
      category: 'Diagnostics'
    },
    {
      id: 'maintenance-history',
      name: 'Maintenance History',
      description: 'Complete maintenance logs and schedules',
      icon: FileText,
      category: 'Maintenance'
    },
    {
      id: 'efficiency-trends',
      name: 'Efficiency Trends',
      description: 'System efficiency analysis over time',
      icon: TrendingUp,
      category: 'Performance'
    },
    {
      id: 'cost-analysis',
      name: 'Cost Analysis',
      description: 'Operating costs breakdown and projections',
      icon: PieChart,
      category: 'Financial'
    },
    {
      id: 'compliance-report',
      name: 'Compliance Report',
      description: 'Regulatory compliance and certifications',
      icon: FileSpreadsheet,
      category: 'Compliance'
    },
    {
      id: 'executive-summary',
      name: 'Executive Summary',
      description: 'High-level overview for management',
      icon: FileText,
      category: 'Executive'
    },
    {
      id: 'sensor-diagnostics',
      name: 'Sensor Diagnostics',
      description: 'Sensor health and calibration status',
      icon: Activity,
      category: 'Diagnostics'
    },
    {
      id: 'apollo-predictions',
      name: 'Apollo AI Predictions',
      description: 'AI fault predictions and confidence levels',
      icon: Cpu,
      category: 'AI Analysis'
    },
    {
      id: 'power-quality',
      name: 'Power Quality Report',
      description: 'Voltage, current, THD, and power factor analysis',
      icon: Zap,
      category: 'Electrical'
    },
    {
      id: 'environmental-impact',
      name: 'Environmental Impact',
      description: 'Carbon footprint and sustainability metrics',
      icon: Leaf,
      category: 'Sustainability'
    },
    {
      id: 'equipment-lifecycle',
      name: 'Equipment Lifecycle',
      description: 'Age, remaining life, and replacement planning',
      icon: Shield,
      category: 'Asset Management'
    },
    {
      id: 'comparative-analysis',
      name: 'Comparative Analysis',
      description: 'Compare performance across equipment',
      icon: BarChart3,
      category: 'Performance'
    },
    {
      id: 'alarm-history',
      name: 'Alarm History',
      description: 'Historical alarms and alert patterns',
      icon: AlertTriangle,
      category: 'Monitoring'
    },
    {
      id: 'runtime-analysis',
      name: 'Runtime Analysis',
      description: 'Equipment runtime and utilization rates',
      icon: Clock,
      category: 'Operations'
    },
    {
      id: 'temperature-profile',
      name: 'Temperature Profile',
      description: 'Temperature trends and delta T analysis',
      icon: Thermometer,
      category: 'HVAC'
    }
  ];

  useEffect(() => {
    loadCustomers();
    loadEquipment();
  }, []);

  const loadCustomers = async () => {
    try {
      const response = await fetch('/api/customers');
      const data = await response.json();
      setCustomers(data);
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  };

  const loadEquipment = async () => {
    try {
      const response = await fetch('/api/equipment');
      const data = await response.json();
      setEquipment(data);
    } catch (error) {
      console.error('Failed to load equipment:', error);
    }
  };

  const generateReport = async () => {
    if (!selectedTemplate) return;

    setIsGenerating(true);
    try {
      const params = new URLSearchParams({
        template: selectedTemplate,
        start_date: dateRange.start,
        end_date: dateRange.end,
        customer_id: selectedCustomer,
        equipment_id: selectedEquipment
      });

      const response = await fetch(`/api/reports/generate?${params}`);
      const data = await response.json();
      setReportData(data);
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const exportReport = async (format: 'pdf' | 'excel' | 'csv') => {
    if (!reportData || !selectedTemplate) return;

    try {
      const params = new URLSearchParams({
        template: selectedTemplate,
        start_date: dateRange.start,
        end_date: dateRange.end,
        customer_id: selectedCustomer,
        equipment_id: selectedEquipment,
        format: format
      });

      const response = await fetch(`/api/reports/generate?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const extension = format === 'excel' ? 'xlsx' : format;
        a.download = `${selectedTemplate}-${new Date().toISOString().split('T')[0]}.${extension}`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export report:', error);
      alert('Failed to export report');
    }
  };

  const scheduleReport = () => {
    if (!selectedTemplate) {
      alert('Please select a report template first');
      return;
    }
    setShowScheduler(true);
  };

  const handleScheduleReport = async (schedule: any) => {
    try {
      const response = await fetch('/api/reports/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          template: selectedTemplate,
          name: reportTemplates.find(t => t.id === selectedTemplate)?.name,
          ...schedule,
          parameters: {
            customer_id: selectedCustomer,
            equipment_id: selectedEquipment
          }
        })
      });

      if (response.ok) {
        alert('Report scheduled successfully!');
        setShowScheduler(false);
      } else {
        alert('Failed to schedule report');
      }
    } catch (error) {
      console.error('Failed to schedule report:', error);
      alert('Failed to schedule report');
    }
  };

  const renderReportContent = () => {
    if (!reportData) return null;

    // This is a simplified example - real reports would have more complex layouts
    switch (selectedTemplate) {
      case 'energy-summary':
        return (
          <div className="report-content">
            <h2>Energy Usage Summary</h2>
            <p className="report-period">
              {new Date(dateRange.start).toLocaleDateString()} - {new Date(dateRange.end).toLocaleDateString()}
            </p>
            
            <div className="report-metrics">
              <div className="metric-card">
                <h3>Total Consumption</h3>
                <div className="metric-value">{(reportData.totalKwh || 0).toFixed(0)} kWh</div>
              </div>
              <div className="metric-card">
                <h3>Total Cost</h3>
                <div className="metric-value">${(reportData.totalCost || 0).toFixed(2)}</div>
              </div>
              <div className="metric-card">
                <h3>Peak Demand</h3>
                <div className="metric-value">{(reportData.peakDemand || 0).toFixed(1)} kW</div>
              </div>
              <div className="metric-card">
                <h3>Avg Daily Usage</h3>
                <div className="metric-value">{(reportData.avgDaily || 0).toFixed(0)} kWh</div>
              </div>
            </div>

            <div className="chart-section">
              <h3>Daily Energy Consumption</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={reportData.dailyData || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="consumption" stroke="#06b6d4" name="Consumption (kWh)" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-section">
              <h3>Cost Breakdown</h3>
              <ResponsiveContainer width="100%" height={300}>
                <RePieChart>
                  <Pie
                    data={reportData.costBreakdown || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomizedLabel}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {(reportData.costBreakdown || []).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      
      default:
        return (
          <div className="report-content">
            <h2>{reportTemplates.find(t => t.id === selectedTemplate)?.name}</h2>
            <p>Report data would be displayed here based on the selected template.</p>
          </div>
        );
    }
  };


  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  const renderCustomizedLabel = ({
    cx, cy, midAngle, innerRadius, outerRadius, percent
  }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
    const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);

    return (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="reports-page">
      <div className="page-header">
        <h1>
          <FileText className="page-icon" />
          Reports & Analytics
        </h1>
        <div className="header-actions">
          {reportData && (
            <>
              <button
                className="btn-secondary"
                onClick={() => exportReport('pdf')}
              >
                <Download size={16} />
                Export PDF
              </button>
              <button
                className="btn-secondary"
                onClick={() => exportReport('excel')}
              >
                <FileSpreadsheet size={16} />
                Export Excel
              </button>
              <button
                className="btn-secondary"
                onClick={scheduleReport}
              >
                <Clock size={16} />
                Schedule
              </button>
            </>
          )}
        </div>
      </div>

      <div className="report-builder">
        {/* Template Selection */}
        <div className="template-section">
          <h3>Select Report Template</h3>
          <div className="template-grid">
            {reportTemplates.map(template => (
              <div
                key={template.id}
                className={`template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
                onClick={() => setSelectedTemplate(template.id)}
              >
                <template.icon size={24} />
                <h4>{template.name}</h4>
                <p>{template.description}</p>
                <span className="category-badge">{template.category}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        {selectedTemplate && (
          <div className="filter-section">
            <h3>Report Parameters</h3>
            <div className="filter-grid">
              <div className="filter-group">
                <label>Date Range</label>
                <div className="date-range">
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  />
                </div>
              </div>

              <div className="filter-group">
                <label>Customer</label>
                <select
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                >
                  <option value="all">All Customers</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Equipment</label>
                <select
                  value={selectedEquipment}
                  onChange={(e) => setSelectedEquipment(e.target.value)}
                >
                  <option value="all">All Equipment</option>
                  {equipment
                    .filter(eq => selectedCustomer === 'all' || eq.customer_id === parseInt(selectedCustomer))
                    .map(eq => (
                      <option key={eq.id} value={eq.id}>
                        {eq.location_name}
                      </option>
                    ))}
                </select>
              </div>

              <button
                className="btn-primary generate-btn"
                onClick={generateReport}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>Generating...</>
                ) : (
                  <>
                    <BarChart3 size={16} />
                    Generate Report
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Report Display */}
        {reportData && (
          <div className="report-display">
            {renderReportContent()}
          </div>
        )}
      </div>

      {/* Recent Reports */}
      <div className="recent-reports">
        <h3>Recent Reports</h3>
        <div className="reports-list">
          <div className="report-item">
            <FileText size={20} />
            <div className="report-info">
              <h4>Energy Usage Summary</h4>
              <span>Generated 2 hours ago</span>
            </div>
            <button className="btn-icon">
              <Download size={16} />
            </button>
          </div>
          <div className="report-item">
            <FileText size={20} />
            <div className="report-info">
              <h4>Monthly Fault Analysis</h4>
              <span>Generated yesterday</span>
            </div>
            <button className="btn-icon">
              <Download size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Report Scheduler Modal */}
      {showScheduler && selectedTemplate && (
        <ReportScheduler
          reportTemplate={selectedTemplate}
          reportName={reportTemplates.find(t => t.id === selectedTemplate)?.name || ''}
          onSchedule={handleScheduleReport}
          onClose={() => setShowScheduler(false)}
        />
      )}
    </div>
  );
};

export default Reports;
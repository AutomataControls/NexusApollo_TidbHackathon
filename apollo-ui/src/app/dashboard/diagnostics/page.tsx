'use client';

import { useState, useEffect } from 'react';
import { 
  Activity,
  Play,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Wrench,
  FileText,
  Download,
  RefreshCw,
  Shield,
  Cpu,
  Gauge,
  AlertCircle,
  Calendar,
  DollarSign,
  ChevronRight,
  Info,
  Settings2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format } from 'date-fns';
import io, { Socket } from 'socket.io-client';

interface Equipment {
  id: number;
  location_name: string;
  equipment_type: string;
  install_date: string;
  warranty_expiry: string;
}

interface DiagnosticResult {
  timestamp: string;
  equipment_id: number;
  faults: Fault[];
  efficiency: number;
  health_score: number;
  recommendations: string[];
  sensor_readings: SensorReading[];
}

interface Fault {
  type: string;
  severity: number;
  confidence: number;
  description: string;
}

interface SensorReading {
  name: string;
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
}

interface FaultStats {
  faultCounts: { [key: string]: number };
  totalOccurrences: number;
  uniqueFaultTypes: number;
}

interface MaintenanceRecommendation {
  priority: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  estimatedCost: number;
}

interface MaintenanceData {
  equipment: Equipment;
  recommendations: MaintenanceRecommendation[];
  nextScheduledMaintenance: string;
  maintenanceHistory: any[];
}

const CHART_COLORS = {
  primary: '#14b8a6',
  secondary: '#f97316',
  tertiary: '#f59e0b',
  danger: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b'
};

const faultTypeLabels: { [key: string]: string } = {
  'low_refrigerant': 'Low Refrigerant',
  'compressor_failure': 'Compressor Failure',
  'filter_clogged': 'Clogged Filter',
  'efficiency_degradation': 'Efficiency Degradation',
  'sensor_drift': 'Sensor Drift',
  'valve_malfunction': 'Valve Malfunction',
  'belt_slippage': 'Belt Slippage',
  'bearing_wear': 'Bearing Wear'
};

export default function DiagnosticsPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string>('');
  const [currentDiagnostic, setCurrentDiagnostic] = useState<DiagnosticResult | null>(null);
  const [diagnosticHistory, setDiagnosticHistory] = useState<DiagnosticResult[]>([]);
  const [faultStats, setFaultStats] = useState<FaultStats | null>(null);
  const [efficiencyTrends, setEfficiencyTrends] = useState<any[]>([]);
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedFault, setSelectedFault] = useState<Fault | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check demo mode
    const isDemoMode = localStorage.getItem('demoMode') === 'true';
    setDemoMode(isDemoMode);

    fetchEquipment();

    // Setup WebSocket connection
    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8001');
    
    socketInstance.on('connect', () => {
      console.log('Connected to diagnostics socket');
    });
    
    socketInstance.on('diagnostics-result', (result: DiagnosticResult) => {
      if (result.equipment_id.toString() === selectedEquipment) {
        setCurrentDiagnostic(result);
        toast({
          title: 'Diagnostics Complete',
          description: `Health Score: ${result.health_score}%`
        });
      }
    });
    
    setSocket(socketInstance);
    
    return () => {
      socketInstance.disconnect();
    };
  }, [selectedEquipment]);

  useEffect(() => {
    if (selectedEquipment) {
      fetchDiagnosticHistory();
      fetchFaultStats();
      fetchEfficiencyTrends();
      fetchMaintenanceRecommendations();
    }
  }, [selectedEquipment]);

  const fetchEquipment = async () => {
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // Demo equipment with diagnostic metadata
      const demoEquipment: Equipment[] = [
        { id: 1, location_name: 'RTU-1', equipment_type: 'RTU', install_date: '2022-01-15', warranty_expiry: '2025-01-15' },
        { id: 2, location_name: 'Chiller-1', equipment_type: 'Chiller', install_date: '2021-06-10', warranty_expiry: '2024-06-10' },
        { id: 3, location_name: 'AHU-1', equipment_type: 'AHU', install_date: '2022-03-20', warranty_expiry: '2025-03-20' },
        { id: 4, location_name: 'RTU-2', equipment_type: 'RTU', install_date: '2021-11-05', warranty_expiry: '2024-11-05' },
        { id: 5, location_name: 'Pump-1', equipment_type: 'Pump', install_date: '2023-02-28', warranty_expiry: '2026-02-28' }
      ];
      setEquipment(demoEquipment);
      setSelectedEquipment('1');
      setLoading(false);
    } else {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/equipment`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await response.json();
        setEquipment(data);
        if (data.length > 0) {
          setSelectedEquipment(data[0].id.toString());
        }
      } catch (error) {
        console.error('Failed to fetch equipment:', error);
        toast({
          title: 'Error',
          description: 'Failed to load equipment',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const fetchDiagnosticHistory = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/diagnostics/history/${selectedEquipment}?days=30`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      const data = await response.json();
      setDiagnosticHistory(data);
      if (data.length > 0) {
        setCurrentDiagnostic(data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch diagnostic history:', error);
    }
  };

  const fetchFaultStats = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/diagnostics/faults/stats/${selectedEquipment}?days=30`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      const data = await response.json();
      setFaultStats(data);
    } catch (error) {
      console.error('Failed to fetch fault stats:', error);
    }
  };

  const fetchEfficiencyTrends = async () => {
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // Generate demo efficiency trends for the last 30 days
      const demoTrends = [];
      const now = new Date();

      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);

        const baseEfficiency = 82 + Math.sin(i * 0.2) * 5;
        demoTrends.push({
          period: date.toISOString(),
          avg_efficiency: baseEfficiency + (Math.random() - 0.5) * 3,
          min_efficiency: baseEfficiency - 5 + Math.random() * 2,
          max_efficiency: baseEfficiency + 5 + Math.random() * 2,
          equipment_id: parseInt(selectedEquipment)
        });
      }

      setEfficiencyTrends(demoTrends);
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/diagnostics/efficiency/${selectedEquipment}?interval=day&days=30`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      const data = await response.json();
      setEfficiencyTrends(data);
    } catch (error) {
      console.error('Failed to fetch efficiency trends:', error);
    }
  };

  const fetchMaintenanceRecommendations = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/diagnostics/maintenance/${selectedEquipment}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      const data = await response.json();
      setMaintenanceData(data);
    } catch (error) {
      console.error('Failed to fetch maintenance recommendations:', error);
    }
  };

  const runDiagnostics = async () => {
    setRunning(true);

    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // Simulate diagnostic run
      setTimeout(() => {
        const demoResult: DiagnosticResult = {
          timestamp: new Date().toISOString(),
          equipment_id: parseInt(selectedEquipment),
          health_score: 75 + Math.random() * 20,
          efficiency: 82 + Math.random() * 10,
          faults: Math.random() > 0.5 ? [
            {
              type: 'efficiency_degradation',
              severity: 2,
              confidence: 0.85,
              description: 'System efficiency below optimal threshold'
            }
          ] : [],
          recommendations: [
            'Schedule preventive maintenance',
            'Clean air filters',
            'Check refrigerant levels'
          ],
          sensor_readings: [
            { name: 'Supply Air Temp', value: 72.5, unit: '°F', status: 'normal' },
            { name: 'Return Air Temp', value: 75.2, unit: '°F', status: 'normal' },
            { name: 'Compressor Current', value: 45.2, unit: 'A', status: 'warning' },
            { name: 'Filter Pressure', value: 0.8, unit: 'inWC', status: 'critical' }
          ]
        };

        setCurrentDiagnostic(demoResult);
        toast({
          title: 'Diagnostics Complete',
          description: `Health Score: ${demoResult.health_score.toFixed(0)}%`
        });
        setRunning(false);
      }, 3000);
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/diagnostics/run/${selectedEquipment}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        setCurrentDiagnostic(result);
        await fetchDiagnosticHistory();
        await fetchFaultStats();
        
        toast({
          title: 'Diagnostics Complete',
          description: `Health Score: ${result.health_score}%`
        });
      } else {
        throw new Error('Failed to run diagnostics');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to run diagnostics',
        variant: 'destructive'
      });
    } finally {
      setRunning(false);
    }
  };

  const exportReport = () => {
    if (!currentDiagnostic) return;
    
    const report = {
      timestamp: currentDiagnostic.timestamp,
      equipment_id: currentDiagnostic.equipment_id,
      health_score: currentDiagnostic.health_score,
      efficiency: currentDiagnostic.efficiency,
      faults: currentDiagnostic.faults,
      recommendations: currentDiagnostic.recommendations,
      sensor_readings: currentDiagnostic.sensor_readings
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostic-report-${selectedEquipment}-${new Date().toISOString()}.json`;
    a.click();
  };

  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-green-600 dark:text-green-400';
    if (score >= 70) return 'text-amber-600 dark:text-amber-400';
    if (score >= 50) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getHealthBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Excellent</Badge>;
    if (score >= 70) return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">Good</Badge>;
    if (score >= 50) return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">Fair</Badge>;
    return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">Poor</Badge>;
  };

  const getSeverityBadge = (severity: number) => {
    if (severity >= 3) return <Badge variant="destructive">Critical</Badge>;
    if (severity >= 2) return <Badge className="bg-amber-100 text-amber-700">Warning</Badge>;
    return <Badge variant="secondary">Minor</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'high':
        return <Badge className="bg-orange-100 text-orange-700">High</Badge>;
      case 'medium':
        return <Badge className="bg-amber-100 text-amber-700">Medium</Badge>;
      default:
        return <Badge variant="secondary">Low</Badge>;
    }
  };

  const getFaultChartData = () => {
    if (!faultStats?.faultCounts) return [];
    
    return Object.entries(faultStats.faultCounts).map(([type, count]) => ({
      name: faultTypeLabels[type] || type,
      value: count
    }));
  };

  const getRadarChartData = () => {
    if (!currentDiagnostic?.sensor_readings) return [];
    
    const categories = ['Temperature', 'Pressure', 'Flow', 'Vibration', 'Current', 'Efficiency'];
    return categories.map(category => ({
      metric: category,
      value: Math.random() * 100, // This would be calculated from actual sensor readings
      fullMark: 100
    }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-teal-500 dark:from-teal-400 dark:to-teal-300 bg-clip-text text-transparent">
            AI Diagnostics
          </h1>
          <p className="text-muted-foreground mt-1">
            Apollo AI-powered fault detection and system analysis
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportReport} disabled={!currentDiagnostic}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <Button 
            className="btn-primary" 
            onClick={runDiagnostics}
            disabled={running || !selectedEquipment}
          >
            {running ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Running Analysis...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run Diagnostics
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Equipment Selector */}
      <Card>
        <CardContent className="pt-6">
          <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Select equipment for diagnostics" />
            </SelectTrigger>
            <SelectContent>
              {equipment.map(eq => (
                <SelectItem key={eq.id} value={eq.id.toString()}>
                  {eq.location_name} - {eq.equipment_type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Health Overview */}
      {currentDiagnostic && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="hover-lift">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Health Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${getHealthColor(currentDiagnostic.health_score)}`}>
                {currentDiagnostic.health_score}%
              </div>
              <Progress 
                value={currentDiagnostic.health_score} 
                className="mt-2"
              />
              <div className="mt-2">
                {getHealthBadge(currentDiagnostic.health_score)}
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Efficiency
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">
                  {currentDiagnostic.efficiency}%
                </div>
                <Gauge className="h-8 w-8 text-teal-500" />
              </div>
              <div className="flex items-center text-xs text-muted-foreground mt-2">
                {efficiencyTrends.length > 1 && (
                  efficiencyTrends[efficiencyTrends.length - 1].avg_efficiency > 
                  efficiencyTrends[efficiencyTrends.length - 2].avg_efficiency ? (
                    <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                  )
                )}
                vs previous
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Faults
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-amber-600">
                  {currentDiagnostic.faults.length}
                </div>
                <AlertTriangle className="h-8 w-8 text-amber-500" />
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {currentDiagnostic.faults.filter(f => f.severity >= 3).length} critical
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Last Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  {format(new Date(currentDiagnostic.timestamp), 'MMM dd')}
                </div>
                <Clock className="h-8 w-8 text-gray-500" />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {format(new Date(currentDiagnostic.timestamp), 'HH:mm:ss')}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="analysis" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="faults">Faults</TabsTrigger>
          <TabsTrigger value="sensors">Sensors</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        {/* Analysis Tab */}
        <TabsContent value="analysis">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>System Performance Overview</CardTitle>
                <CardDescription>
                  Multi-dimensional analysis of system health
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={getRadarChartData()}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar 
                      name="Current" 
                      dataKey="value" 
                      stroke={CHART_COLORS.primary}
                      fill={CHART_COLORS.primary}
                      fillOpacity={0.6} 
                    />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fault Distribution</CardTitle>
                <CardDescription>
                  Breakdown of detected issues by type
                </CardDescription>
              </CardHeader>
              <CardContent>
                {getFaultChartData().length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={getFaultChartData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => entry.name}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {getFaultChartData().map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={Object.values(CHART_COLORS)[index % Object.values(CHART_COLORS).length]} 
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px]">
                    <div className="text-center">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No faults detected</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {currentDiagnostic && currentDiagnostic.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>AI Recommendations</CardTitle>
                <CardDescription>
                  Apollo AI suggested actions based on analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {currentDiagnostic.recommendations.map((rec, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 bg-mint-50 dark:bg-mint-900/10 rounded-lg">
                      <Info className="h-4 w-4 text-teal-600 dark:text-teal-400 mt-0.5" />
                      <span className="text-sm">{rec}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Faults Tab */}
        <TabsContent value="faults">
          <Card>
            <CardHeader>
              <CardTitle>Detected Faults</CardTitle>
              <CardDescription>
                Current issues identified by Apollo AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentDiagnostic && currentDiagnostic.faults.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fault Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Confidence</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentDiagnostic.faults.map((fault, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                              <span className="font-medium">
                                {faultTypeLabels[fault.type] || fault.type}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            {fault.description || 'No description available'}
                          </TableCell>
                          <TableCell>{getSeverityBadge(fault.severity)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={fault.confidence * 100} className="w-16" />
                              <span className="text-sm">{(fault.confidence * 100).toFixed(0)}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedFault(fault);
                                setIsDetailDialogOpen(true);
                              }}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <Alert className="bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    No faults detected. System is operating normally.
                  </AlertDescription>
                </Alert>
              )}

              {faultStats && faultStats.totalOccurrences > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-3">30-Day Fault Statistics</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground">Total Occurrences</div>
                        <div className="text-2xl font-bold">{faultStats.totalOccurrences}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground">Unique Fault Types</div>
                        <div className="text-2xl font-bold">{faultStats.uniqueFaultTypes}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground">Avg Daily Faults</div>
                        <div className="text-2xl font-bold">
                          {(faultStats.totalOccurrences / 30).toFixed(1)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sensors Tab */}
        <TabsContent value="sensors">
          <Card>
            <CardHeader>
              <CardTitle>Sensor Status</CardTitle>
              <CardDescription>
                Current readings from all configured sensors
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentDiagnostic?.sensor_readings && currentDiagnostic.sensor_readings.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {currentDiagnostic.sensor_readings.map((sensor, index) => (
                    <Card key={index} className="hover-lift">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-2">
                          <div className="font-medium text-sm">{sensor.name}</div>
                          <Badge variant={
                            sensor.status === 'normal' ? 'default' :
                            sensor.status === 'warning' ? 'secondary' : 'destructive'
                          }>
                            {sensor.status}
                          </Badge>
                        </div>
                        <div className="text-2xl font-bold">
                          {typeof sensor.value === 'number' ? sensor.value.toFixed(1) : sensor.value} <span className="text-sm">{sensor.unit}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No sensor readings available. Run diagnostics to get current readings.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle>Efficiency Trends</CardTitle>
              <CardDescription>
                System efficiency over the last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={efficiencyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="period" 
                    tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                  />
                  <YAxis domain={[0, 100]} />
                  <Tooltip 
                    labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="avg_efficiency" 
                    name="Average" 
                    stroke={CHART_COLORS.primary} 
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="max_efficiency" 
                    name="Maximum" 
                    stroke={CHART_COLORS.success} 
                    strokeDasharray="5 5"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="min_efficiency" 
                    name="Minimum" 
                    stroke={CHART_COLORS.danger} 
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Maintenance Recommendations</CardTitle>
                <CardDescription>
                  Suggested maintenance actions based on diagnostics
                </CardDescription>
              </CardHeader>
              <CardContent>
                {maintenanceData?.recommendations && maintenanceData.recommendations.length > 0 ? (
                  <div className="space-y-4">
                    {maintenanceData.recommendations.map((rec, index) => (
                      <div key={index} className="p-4 border rounded-lg hover-lift">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Wrench className="h-5 w-5 text-teal-500" />
                            <span className="font-medium">{rec.type.replace(/_/g, ' ').toUpperCase()}</span>
                          </div>
                          {getPriorityBadge(rec.priority)}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {rec.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-sm">
                            <DollarSign className="h-3 w-3" />
                            <span>Estimated Cost: ${rec.estimatedCost.toLocaleString()}</span>
                          </div>
                          <Button size="sm" variant="outline">
                            Schedule
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      No immediate maintenance required. System is in good condition.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Equipment Information</CardTitle>
              </CardHeader>
              <CardContent>
                {maintenanceData?.equipment && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Install Date</div>
                      <div className="font-medium">
                        {format(new Date(maintenanceData.equipment.install_date), 'MMM dd, yyyy')}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Warranty Expiry</div>
                      <div className="font-medium">
                        {maintenanceData.equipment.warranty_expiry ? 
                          format(new Date(maintenanceData.equipment.warranty_expiry), 'MMM dd, yyyy') : 
                          'N/A'
                        }
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Next Scheduled Maintenance</div>
                      <div className="font-medium">
                        {maintenanceData.nextScheduledMaintenance ? 
                          format(new Date(maintenanceData.nextScheduledMaintenance), 'MMM dd, yyyy') : 
                          'Not scheduled'
                        }
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Equipment Age</div>
                      <div className="font-medium">
                        {Math.floor((Date.now() - new Date(maintenanceData.equipment.install_date).getTime()) / (365 * 24 * 60 * 60 * 1000))} years
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Fault Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fault Details</DialogTitle>
            <DialogDescription>
              Detailed information about the detected fault
            </DialogDescription>
          </DialogHeader>
          {selectedFault && (
            <div className="space-y-4">
              <div>
                <Label>Fault Type</Label>
                <p className="font-medium">{faultTypeLabels[selectedFault.type] || selectedFault.type}</p>
              </div>
              <div>
                <Label>Description</Label>
                <p className="text-sm text-muted-foreground">
                  {selectedFault.description || 'No detailed description available'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Severity Level</Label>
                  <div className="mt-1">{getSeverityBadge(selectedFault.severity)}</div>
                </div>
                <div>
                  <Label>Confidence</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={selectedFault.confidence * 100} className="flex-1" />
                    <span className="text-sm">{(selectedFault.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
              <Separator />
              <div>
                <Label>Recommended Actions</Label>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li className="text-sm">Schedule immediate inspection</li>
                  <li className="text-sm">Check related components</li>
                  <li className="text-sm">Document fault occurrence</li>
                </ul>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
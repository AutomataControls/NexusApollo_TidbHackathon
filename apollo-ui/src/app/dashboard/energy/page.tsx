'use client';

import { useState, useEffect } from 'react';
import { 
  Zap,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Calendar,
  Download,
  Settings,
  AlertCircle,
  Gauge,
  Battery,
  Cpu,
  Clock,
  Sun,
  Moon,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
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

interface Equipment {
  id: number;
  location_name: string;
  equipment_type: string;
}

interface ConsumptionData {
  timestamp: string;
  consumption: number;
  avgPower: number;
  peakPower: number;
  minPower: number;
}

interface CostData {
  date: string;
  consumption: number;
  peakDemand: number;
  energyCost: number;
  demandCost: number;
  totalCost: number;
}

interface CostSummary {
  totalConsumption: number;
  totalCost: number;
  avgDailyCost: number;
  peakDemand: number;
  data: CostData[];
}

interface PowerData {
  currentPower: number;
  voltage: {
    L1: number;
    L2: number;
    L3: number;
  };
  current: {
    L1: number;
    L2: number;
    L3: number;
  };
  powerFactor: number;
  frequency: number;
  timestamp: string;
}

interface EfficiencyData {
  current: number;
  average: number;
  trend: Array<{
    date: string;
    avg_efficiency: number;
    min_efficiency: number;
    max_efficiency: number;
  }>;
}

interface UtilityRates {
  kwhRate: number;
  demandRate: number;
  peakHours: {
    start: number;
    end: number;
  };
  peakRate: number;
  utilityProvider: string;
  billingCycle: string;
}

const CHART_COLORS = {
  primary: '#14b8a6',
  secondary: '#f97316',
  tertiary: '#f59e0b',
  danger: '#ef4444',
  success: '#10b981'
};

export default function EnergyPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string>('');
  const [consumption, setConsumption] = useState<ConsumptionData[]>([]);
  const [costData, setCostData] = useState<CostSummary | null>(null);
  const [realtimePower, setRealtimePower] = useState<PowerData | null>(null);
  const [efficiency, setEfficiency] = useState<EfficiencyData | null>(null);
  const [utilityRates, setUtilityRates] = useState<UtilityRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('24h');
  const [interval, setInterval] = useState('hour');
  const [isRatesDialogOpen, setIsRatesDialogOpen] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const { toast } = useToast();

  const [ratesForm, setRatesForm] = useState({
    kwhRate: '',
    demandRate: '',
    peakStart: '',
    peakEnd: '',
    peakRate: '',
    utilityProvider: '',
    billingCycle: 'monthly'
  });

  useEffect(() => {
    // Check demo mode
    const isDemoMode = localStorage.getItem('demoMode') === 'true';
    setDemoMode(isDemoMode);

    fetchEquipment();
    fetchUtilityRates();

    // Listen for demo mode changes
    const handleDemoModeChange = (event: CustomEvent) => {
      setDemoMode(event.detail);
      fetchEquipment();
    };

    window.addEventListener('demoModeChanged', handleDemoModeChange as any);
    return () => {
      window.removeEventListener('demoModeChanged', handleDemoModeChange as any);
    };
  }, []);

  useEffect(() => {
    if (selectedEquipment) {
      // Auto-adjust interval based on date range
      if (dateRange === '1h' || dateRange === '4h') {
        setInterval('hour');
      } else if (dateRange === '8h' || dateRange === '16h' || dateRange === '24h') {
        setInterval('hour');
      } else if (dateRange === '48h' || dateRange === '7d') {
        setInterval('day');
      } else if (dateRange === '30d') {
        setInterval('day');
      } else {
        setInterval('week');
      }
      
      fetchConsumption();
      fetchCosts();
      fetchEfficiency();
      fetchRealtimePower();
      
      const refreshInterval = window.setInterval(() => {
        fetchRealtimePower();
      }, 5000);
      
      return () => clearInterval(refreshInterval);
    }
  }, [selectedEquipment, dateRange]);

  const fetchEquipment = async () => {
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // Demo equipment
      const demoEquipment = [
        { id: 1, location_name: 'RTU-1', equipment_type: 'RTU' },
        { id: 2, location_name: 'Chiller-1', equipment_type: 'Chiller' },
        { id: 3, location_name: 'AHU-1', equipment_type: 'AHU' },
        { id: 4, location_name: 'RTU-2', equipment_type: 'RTU' },
        { id: 5, location_name: 'Pump-1', equipment_type: 'Pump' }
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

  const fetchConsumption = async () => {
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // Generate demo consumption data
      const demoData: ConsumptionData[] = [];
      const now = new Date();
      for (let i = 23; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 3600000);
        demoData.push({
          timestamp: timestamp.toISOString(),
          consumption: 12 + Math.random() * 8,
          avgPower: 15 + Math.random() * 10,
          peakPower: 20 + Math.random() * 15,
          minPower: 10 + Math.random() * 5
        });
      }
      setConsumption(demoData);
      return;
    }

    try {
      const startDate = new Date();
      // Parse the date range
      if (dateRange === '1h') {
        startDate.setHours(startDate.getHours() - 1);
      } else if (dateRange === '4h') {
        startDate.setHours(startDate.getHours() - 4);
      } else if (dateRange === '8h') {
        startDate.setHours(startDate.getHours() - 8);
      } else if (dateRange === '16h') {
        startDate.setHours(startDate.getHours() - 16);
      } else if (dateRange === '24h') {
        startDate.setHours(startDate.getHours() - 24);
      } else if (dateRange === '48h') {
        startDate.setHours(startDate.getHours() - 48);
      } else if (dateRange === '7d') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (dateRange === '30d') {
        startDate.setDate(startDate.getDate() - 30);
      } else {
        startDate.setDate(startDate.getDate() - 90);
      }
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/energy/consumption?` +
        `equipment_id=${selectedEquipment}&` +
        `start_date=${startDate.toISOString()}&` +
        `interval=${interval}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      const data = await response.json();
      setConsumption(data);
    } catch (error) {
      console.error('Failed to fetch consumption:', error);
    }
  };

  const fetchCosts = async () => {
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // Generate demo cost data
      const demoCostData: CostData[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const consumption = 280 + Math.random() * 120;
        const energyCost = consumption * 0.12;
        const peakDemand = 35 + Math.random() * 15;
        const demandCost = peakDemand * 15;
        demoCostData.push({
          date: date.toISOString(),
          consumption,
          peakDemand,
          energyCost,
          demandCost,
          totalCost: energyCost + demandCost
        });
      }

      const totalConsumption = demoCostData.reduce((sum, d) => sum + d.consumption, 0);
      const totalCost = demoCostData.reduce((sum, d) => sum + d.totalCost, 0);

      setCostData({
        totalConsumption,
        totalCost,
        avgDailyCost: totalCost / demoCostData.length,
        peakDemand: Math.max(...demoCostData.map(d => d.peakDemand)),
        data: demoCostData
      });
      return;
    }

    try {
      const startDate = new Date();
      // Parse the date range
      if (dateRange === '1h') {
        startDate.setHours(startDate.getHours() - 1);
      } else if (dateRange === '4h') {
        startDate.setHours(startDate.getHours() - 4);
      } else if (dateRange === '8h') {
        startDate.setHours(startDate.getHours() - 8);
      } else if (dateRange === '16h') {
        startDate.setHours(startDate.getHours() - 16);
      } else if (dateRange === '24h') {
        startDate.setHours(startDate.getHours() - 24);
      } else if (dateRange === '48h') {
        startDate.setHours(startDate.getHours() - 48);
      } else if (dateRange === '7d') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (dateRange === '30d') {
        startDate.setDate(startDate.getDate() - 30);
      } else {
        startDate.setDate(startDate.getDate() - 90);
      }
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/energy/costs?` +
        `equipment_id=${selectedEquipment}&` +
        `start_date=${startDate.toISOString()}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      const data = await response.json();
      setCostData(data);
    } catch (error) {
      console.error('Failed to fetch costs:', error);
    }
  };

  const fetchRealtimePower = async () => {
    if (!selectedEquipment) return;

    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // Generate demo realtime power data
      setRealtimePower({
        currentPower: 22.5 + (Math.random() - 0.5) * 5,
        voltage: {
          L1: 120 + (Math.random() - 0.5) * 4,
          L2: 119 + (Math.random() - 0.5) * 4,
          L3: 121 + (Math.random() - 0.5) * 4
        },
        current: {
          L1: 65 + (Math.random() - 0.5) * 10,
          L2: 63 + (Math.random() - 0.5) * 10,
          L3: 64 + (Math.random() - 0.5) * 10
        },
        powerFactor: 0.92 + (Math.random() - 0.5) * 0.1,
        frequency: 60 + (Math.random() - 0.5) * 0.2,
        timestamp: new Date().toISOString()
      });
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/energy/realtime/${selectedEquipment}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      const data = await response.json();
      setRealtimePower(data);
    } catch (error) {
      console.error('Failed to fetch realtime power:', error);
    }
  };

  const fetchEfficiency = async () => {
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // Generate demo efficiency data
      const trend = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const avg = 82 + Math.random() * 10;
        trend.push({
          date: date.toISOString(),
          avg_efficiency: avg,
          min_efficiency: avg - 5 - Math.random() * 5,
          max_efficiency: avg + 5 + Math.random() * 5
        });
      }

      setEfficiency({
        current: 85.5 + (Math.random() - 0.5) * 8,
        average: 84.2,
        trend
      });
      return;
    }

    try {
      let days;
      // Convert hours to days for the efficiency endpoint
      if (dateRange === '1h') {
        days = 0.042; // ~1 hour
      } else if (dateRange === '4h') {
        days = 0.167; // ~4 hours
      } else if (dateRange === '8h') {
        days = 0.333; // ~8 hours
      } else if (dateRange === '16h') {
        days = 0.667; // ~16 hours
      } else if (dateRange === '24h') {
        days = 1;
      } else if (dateRange === '48h') {
        days = 2;
      } else if (dateRange === '7d') {
        days = 7;
      } else if (dateRange === '30d') {
        days = 30;
      } else {
        days = 90;
      }
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/energy/efficiency/${selectedEquipment}?days=${days}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      const data = await response.json();
      setEfficiency(data);
    } catch (error) {
      console.error('Failed to fetch efficiency:', error);
    }
  };

  const fetchUtilityRates = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/energy/rates`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setUtilityRates(data);
      setRatesForm({
        kwhRate: data.kwhRate.toString(),
        demandRate: data.demandRate.toString(),
        peakStart: data.peakHours.start.toString(),
        peakEnd: data.peakHours.end.toString(),
        peakRate: data.peakRate.toString(),
        utilityProvider: data.utilityProvider,
        billingCycle: data.billingCycle
      });
    } catch (error) {
      console.error('Failed to fetch utility rates:', error);
    }
  };

  const updateUtilityRates = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/energy/rates`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          kwhRate: parseFloat(ratesForm.kwhRate),
          demandRate: parseFloat(ratesForm.demandRate),
          peakHours: {
            start: parseInt(ratesForm.peakStart),
            end: parseInt(ratesForm.peakEnd)
          },
          peakRate: parseFloat(ratesForm.peakRate),
          utilityProvider: ratesForm.utilityProvider,
          billingCycle: ratesForm.billingCycle
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setUtilityRates(data.rates);
        setIsRatesDialogOpen(false);
        toast({
          title: 'Success',
          description: 'Utility rates updated successfully'
        });
        // Refresh cost data with new rates
        fetchCosts();
      } else {
        throw new Error('Failed to update rates');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update utility rates',
        variant: 'destructive'
      });
    }
  };

  const exportData = () => {
    if (!costData) return;
    
    const csv = [
      ['Date', 'Consumption (kWh)', 'Energy Cost ($)', 'Demand Cost ($)', 'Total Cost ($)'],
      ...costData.data.map(row => [
        row.date,
        row.consumption.toFixed(2),
        row.energyCost.toFixed(2),
        row.demandCost.toFixed(2),
        row.totalCost.toFixed(2)
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `energy-report-${selectedEquipment}-${new Date().toISOString()}.csv`;
    a.click();
  };

  const isPeakHour = () => {
    if (!utilityRates) return false;
    const hour = new Date().getHours();
    return hour >= utilityRates.peakHours.start && hour <= utilityRates.peakHours.end;
  };

  const getEfficiencyColor = (value: number) => {
    if (value >= 90) return 'text-green-600 dark:text-green-400';
    if (value >= 80) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
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
            Energy Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor energy consumption, costs, and efficiency
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsRatesDialogOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Utility Rates
          </Button>
          <Button className="btn-primary" onClick={exportData}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Equipment & Date Range Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select equipment" />
              </SelectTrigger>
              <SelectContent>
                {equipment.map(eq => (
                  <SelectItem key={eq.id} value={eq.id.toString()}>
                    {eq.location_name} - {eq.equipment_type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last 1 Hour</SelectItem>
                <SelectItem value="4h">Last 4 Hours</SelectItem>
                <SelectItem value="8h">Last 8 Hours</SelectItem>
                <SelectItem value="16h">Last 16 Hours</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="48h">Last 48 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={interval} onValueChange={setInterval}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hour">Hourly</SelectItem>
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover-lift">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Current Power
              {isPeakHour() ? (
                <Sun className="h-4 w-4 text-amber-500" />
              ) : (
                <Moon className="h-4 w-4 text-slate-500" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {realtimePower?.currentPower?.toFixed(1) || '0.0'} kW
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {isPeakHour() ? 'Peak Hours' : 'Off-Peak'}
            </div>
          </CardContent>
        </Card>

        <Card className="hover-lift">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today's Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              ${costData?.data[costData.data.length - 1]?.totalCost?.toFixed(2) || '0.00'}
            </div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              {costData && costData.data.length > 1 && (
                <>
                  {costData.data[costData.data.length - 1].totalCost > 
                   costData.data[costData.data.length - 2].totalCost ? (
                    <TrendingUp className="h-3 w-3 text-red-500 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-green-500 mr-1" />
                  )}
                  vs yesterday
                </>
              )}
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
            <div className={`text-2xl font-bold ${getEfficiencyColor(efficiency?.current || 0)}`}>
              {efficiency?.current?.toFixed(1) || '0.0'}%
            </div>
            <Progress 
              value={efficiency?.current || 0} 
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>

        <Card className="hover-lift">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Peak Demand
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {costData?.peakDemand?.toFixed(1) || '0.0'} kW
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              This billing period
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="consumption" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="consumption">Consumption</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="power">Power Quality</TabsTrigger>
          <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
        </TabsList>

        {/* Consumption Tab */}
        <TabsContent value="consumption">
          <Card>
            <CardHeader>
              <CardTitle>Energy Consumption Trend</CardTitle>
              <CardDescription>
                Power consumption over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={consumption}>
                  <defs>
                    <linearGradient id="colorConsumption" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy HH:mm')}
                    formatter={(value: number) => [`${value.toFixed(2)} kWh`, 'Consumption']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="consumption" 
                    stroke={CHART_COLORS.primary}
                    fillOpacity={1} 
                    fill="url(#colorConsumption)" 
                  />
                </AreaChart>
              </ResponsiveContainer>

              <div className="mt-6">
                <h4 className="font-medium mb-3">Consumption Summary</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-mint-50 dark:bg-mint-900/10 rounded-lg">
                    <div className="text-sm text-muted-foreground">Total Consumption</div>
                    <div className="text-xl font-bold">
                      {costData?.totalConsumption?.toFixed(0) || '0'} kWh
                    </div>
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
                    <div className="text-sm text-muted-foreground">Average Daily</div>
                    <div className="text-xl font-bold">
                      {(costData?.totalConsumption || 0 / (costData?.data.length || 1)).toFixed(0)} kWh
                    </div>
                  </div>
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-lg">
                    <div className="text-sm text-muted-foreground">Peak Load</div>
                    <div className="text-xl font-bold">
                      {Math.max(...consumption.map(c => c.peakPower), 0).toFixed(1)} kW
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Costs Tab */}
        <TabsContent value="costs">
          <Card>
            <CardHeader>
              <CardTitle>Energy Costs Analysis</CardTitle>
              <CardDescription>
                Daily energy and demand charges
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={costData?.data || []}>
                  <defs>
                    <linearGradient id="colorEnergyCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorDemandCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="demandCost"
                    name="Demand Cost"
                    stackId="1"
                    stroke={CHART_COLORS.secondary}
                    fill="url(#colorDemandCost)"
                  />
                  <Area
                    type="monotone"
                    dataKey="energyCost"
                    name="Energy Cost"
                    stackId="1"
                    stroke={CHART_COLORS.primary}
                    fill="url(#colorEnergyCost)"
                  />
                </AreaChart>
              </ResponsiveContainer>

              <div className="mt-6">
                <h4 className="font-medium mb-3">Cost Breakdown</h4>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Consumption</TableHead>
                        <TableHead>Energy Cost</TableHead>
                        <TableHead>Demand Cost</TableHead>
                        <TableHead>Total Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {costData?.data.slice(-7).reverse().map((row) => (
                        <TableRow key={row.date}>
                          <TableCell>{format(new Date(row.date), 'MMM dd')}</TableCell>
                          <TableCell>{row.consumption.toFixed(1)} kWh</TableCell>
                          <TableCell>${row.energyCost.toFixed(2)}</TableCell>
                          <TableCell>${row.demandCost.toFixed(2)}</TableCell>
                          <TableCell className="font-medium">${row.totalCost.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground">Period Total</div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        ${costData?.totalCost?.toFixed(2) || '0.00'}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground">Average Daily</div>
                      <div className="text-2xl font-bold">
                        ${costData?.avgDailyCost?.toFixed(2) || '0.00'}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground">Projected Monthly</div>
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        ${((costData?.avgDailyCost || 0) * 30).toFixed(2)}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Power Quality Tab */}
        <TabsContent value="power">
          <Card>
            <CardHeader>
              <CardTitle>Power Quality Monitoring</CardTitle>
              <CardDescription>
                Real-time electrical parameters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Voltage */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-teal-500" />
                    Voltage (V)
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">L1-N</span>
                      <Badge variant={realtimePower?.voltage.L1 && Math.abs(realtimePower.voltage.L1 - 120) < 6 ? 'default' : 'destructive'}>
                        {realtimePower?.voltage?.L1?.toFixed(1) || '0.0'} V
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">L2-N</span>
                      <Badge variant={realtimePower?.voltage.L2 && Math.abs(realtimePower.voltage.L2 - 120) < 6 ? 'default' : 'destructive'}>
                        {realtimePower?.voltage?.L2?.toFixed(1) || '0.0'} V
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">L3-N</span>
                      <Badge variant={realtimePower?.voltage.L3 && Math.abs(realtimePower.voltage.L3 - 120) < 6 ? 'default' : 'destructive'}>
                        {realtimePower?.voltage?.L3?.toFixed(1) || '0.0'} V
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Current */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Current (A)
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">L1</span>
                      <Badge>{realtimePower?.current?.L1?.toFixed(1) || '0.0'} A</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">L2</span>
                      <Badge>{realtimePower?.current?.L2?.toFixed(1) || '0.0'} A</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">L3</span>
                      <Badge>{realtimePower?.current?.L3?.toFixed(1) || '0.0'} A</Badge>
                    </div>
                  </div>
                </div>

                {/* Other Parameters */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-orange-500" />
                    Parameters
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Power Factor</span>
                      <Badge variant={realtimePower?.powerFactor && realtimePower.powerFactor > 0.9 ? 'default' : 'secondary'}>
                        {realtimePower?.powerFactor?.toFixed(2) || '0.00'}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Frequency</span>
                      <Badge variant={realtimePower?.frequency && Math.abs(realtimePower.frequency - 60) < 0.5 ? 'default' : 'destructive'}>
                        {realtimePower?.frequency?.toFixed(1) || '60.0'} Hz
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Power</span>
                      <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300">
                        {realtimePower?.currentPower?.toFixed(1) || '0.0'} kW
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gradient-to-r from-teal-50 to-mint-50 dark:from-teal-900/20 dark:to-mint-900/20 rounded-lg">
                  <div className="text-xs text-muted-foreground">Apparent Power</div>
                  <div className="text-lg font-bold">
                    {(realtimePower?.currentPower && realtimePower?.powerFactor ? 
                      realtimePower.currentPower / realtimePower.powerFactor : 0).toFixed(1)} kVA
                  </div>
                </div>
                <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg">
                  <div className="text-xs text-muted-foreground">Reactive Power</div>
                  <div className="text-lg font-bold">
                    {(realtimePower?.currentPower && realtimePower?.powerFactor ? 
                      realtimePower.currentPower * Math.tan(Math.acos(realtimePower.powerFactor)) : 0).toFixed(1)} kVAR
                  </div>
                </div>
                <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg">
                  <div className="text-xs text-muted-foreground">Load Balance</div>
                  <div className="text-lg font-bold">
                    {realtimePower ? (
                      100 - (Math.max(
                        Math.abs(realtimePower.current.L1 - realtimePower.current.L2),
                        Math.abs(realtimePower.current.L2 - realtimePower.current.L3),
                        Math.abs(realtimePower.current.L3 - realtimePower.current.L1)
                      ) / Math.max(realtimePower.current.L1, realtimePower.current.L2, realtimePower.current.L3) * 100)
                    ).toFixed(0) : '0'}%
                  </div>
                </div>
                <div className="p-4 bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 rounded-lg">
                  <div className="text-xs text-muted-foreground">Last Update</div>
                  <div className="text-sm font-medium">
                    {realtimePower ? format(new Date(realtimePower.timestamp), 'HH:mm:ss') : '--:--:--'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Efficiency Tab */}
        <TabsContent value="efficiency">
          <Card>
            <CardHeader>
              <CardTitle>Equipment Efficiency</CardTitle>
              <CardDescription>
                System efficiency trends and metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={efficiency?.trend || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
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
                    name="Peak" 
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Current Efficiency</span>
                      <Gauge className="h-4 w-4 text-teal-500" />
                    </div>
                    <div className={`text-3xl font-bold ${getEfficiencyColor(efficiency?.current || 0)}`}>
                      {efficiency?.current?.toFixed(1) || '0.0'}%
                    </div>
                    <Progress 
                      value={efficiency?.current || 0} 
                      className="mt-2"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Period Average</span>
                      <Activity className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className={`text-3xl font-bold ${getEfficiencyColor(efficiency?.average || 0)}`}>
                      {efficiency?.average?.toFixed(1) || '0.0'}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      {efficiency?.average && efficiency.current && (
                        <span className={efficiency.current >= efficiency.average ? 'text-green-600' : 'text-red-600'}>
                          {efficiency.current >= efficiency.average ? (
                            <span className="flex items-center gap-1">
                              <ChevronUp className="h-3 w-3" />
                              {(efficiency.current - efficiency.average).toFixed(1)}% above avg
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <ChevronDown className="h-3 w-3" />
                              {(efficiency.average - efficiency.current).toFixed(1)}% below avg
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Efficiency Target</span>
                      <Battery className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                      85.0%
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      Industry standard
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Separator className="my-6" />

              <div>
                <h4 className="font-medium mb-3">Efficiency Recommendations</h4>
                <div className="space-y-2">
                  {efficiency && efficiency.current < 80 && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">Low Efficiency Detected</div>
                        <div className="text-xs text-muted-foreground">
                          Schedule maintenance to improve system performance
                        </div>
                      </div>
                    </div>
                  )}
                  {efficiency && efficiency.current >= 80 && efficiency.current < 90 && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">Moderate Efficiency</div>
                        <div className="text-xs text-muted-foreground">
                          Consider optimizing setpoints and control strategies
                        </div>
                      </div>
                    </div>
                  )}
                  {efficiency && efficiency.current >= 90 && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/10 rounded-lg flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">Excellent Efficiency</div>
                        <div className="text-xs text-muted-foreground">
                          System is operating at optimal efficiency levels
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Utility Rates Dialog */}
      <Dialog open={isRatesDialogOpen} onOpenChange={setIsRatesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Utility Rate Configuration</DialogTitle>
            <DialogDescription>
              Configure electricity rates for cost calculations
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>kWh Rate ($/kWh)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={ratesForm.kwhRate}
                  onChange={(e) => setRatesForm({...ratesForm, kwhRate: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Demand Rate ($/kW)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={ratesForm.demandRate}
                  onChange={(e) => setRatesForm({...ratesForm, demandRate: e.target.value})}
                />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Peak Start Hour</Label>
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={ratesForm.peakStart}
                  onChange={(e) => setRatesForm({...ratesForm, peakStart: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Peak End Hour</Label>
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={ratesForm.peakEnd}
                  onChange={(e) => setRatesForm({...ratesForm, peakEnd: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Peak Rate ($/kWh)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={ratesForm.peakRate}
                  onChange={(e) => setRatesForm({...ratesForm, peakRate: e.target.value})}
                />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Utility Provider</Label>
                <Input
                  value={ratesForm.utilityProvider}
                  onChange={(e) => setRatesForm({...ratesForm, utilityProvider: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Billing Cycle</Label>
                <Select 
                  value={ratesForm.billingCycle}
                  onValueChange={(value) => setRatesForm({...ratesForm, billingCycle: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="bi-monthly">Bi-Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRatesDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={updateUtilityRates} className="btn-primary">
              Save Rates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
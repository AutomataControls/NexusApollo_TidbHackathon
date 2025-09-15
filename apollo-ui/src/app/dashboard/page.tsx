'use client';

import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Activity,
  Zap,
  ThermometerSun,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Gauge,
  Wind,
  Droplets,
  DollarSign,
  Cpu,
  Cloud,
  CloudRain,
  CloudSnow,
  Sun,
  Brain
} from 'lucide-react';
import { calculateSystemTemps, getRefrigerantType } from '@/utils/refrigerantCalculations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings2 } from 'lucide-react';

interface SensorReading {
  name: string;
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  timestamp?: string;
}

interface Equipment {
  id: number;
  location_name: string;
  equipment_type: string;
  customer_id: number;
  status?: string;
  health_score?: number;
  efficiency?: number;
  power?: number;
  refrigerant_type?: string;
  refrigerant_amount?: number;
}

interface Alarm {
  id: number;
  type: string;
  severity: number;
  equipment_id: number;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export default function DashboardPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<number | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  
  // Real-time data from API/WebSocket
  const [sensorData, setSensorData] = useState<SensorReading[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [activeAlarms, setActiveAlarms] = useState<Alarm[]>([]);
  const [inferenceStatus, setInferenceStatus] = useState<'idle' | 'running' | 'stopped'>('idle');
  const [inferenceResult, setInferenceResult] = useState<any>(null);
  const [energyMetrics, setEnergyMetrics] = useState({
    currentPower: 0,
    dailyConsumption: 0,
    dailyCost: 0,
    efficiency: 85,
    powerFactor: 0.9
  });
  const [trendData, setTrendData] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState({
    totalEquipment: 0,
    onlineEquipment: 0,
    criticalAlarms: 0,
    warningAlarms: 0,
    avgEfficiency: 0
  });
  const [weatherData, setWeatherData] = useState<any>(null);
  const [weatherZipCode, setWeatherZipCode] = useState<string>('46795');
  const [weatherDialogOpen, setWeatherDialogOpen] = useState(false);
  const [tempZipCode, setTempZipCode] = useState<string>('46795');
  const [ptChartOpen, setPtChartOpen] = useState(false);
  const [selectedRefrigerant, setSelectedRefrigerant] = useState<string>('R-410A');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Check demo mode from localStorage
    const isDemoMode = localStorage.getItem('demoMode') === 'true';
    setDemoMode(isDemoMode);

    // If demo mode, set demo inference data
    if (isDemoMode) {
      setInferenceStatus('running');
      setInferenceResult({
        final: {
          diagnosis: 'All systems operating within normal parameters. Minor efficiency optimization recommended.',
          consensus: 0.15
        },
        models: {
          APOLLO: { fault_detected: false, confidence: 0.92 },
          AQUILO: { fault_detected: false, confidence: 0.88 },
          BOREAS: { fault_detected: false, confidence: 0.85 },
          NAIAD: { fault_detected: false, confidence: 0.79 },
          VULCAN: { fault_detected: false, confidence: 0.91 },
          ZEPHYRUS: { fault_detected: true, confidence: 0.73 },
          COLOSSUS: { fault_detected: false, confidence: 0.86 },
          GAIA: { fault_detected: false, confidence: 0.94 }
        },
        mode: 'simultaneous',
        inferenceTimeMs: 42
      });
    }

    // Restore state from localStorage
    const savedCustomer = localStorage.getItem('selectedCustomer');
    const savedEquipment = localStorage.getItem('selectedEquipment');
    const savedConfigLoaded = localStorage.getItem('configLoaded');
    const savedMonitoring = localStorage.getItem('monitoringEnabled');
    const savedZipCode = localStorage.getItem('weatherZipCode');

    if (savedCustomer) setSelectedCustomer(parseInt(savedCustomer));
    if (savedEquipment) setSelectedEquipment(parseInt(savedEquipment));
    if (savedConfigLoaded === 'true') setConfigLoaded(true);
    if (savedMonitoring === 'true') setMonitoringEnabled(true);
    if (savedZipCode) {
      setWeatherZipCode(savedZipCode);
      setTempZipCode(savedZipCode);
    }

    // Initialize WebSocket connection
    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8001', {
      auth: { token }
    });

    socketInstance.on('connect', () => {
      console.log('Connected to Nexus Apollo server');
      socketInstance.emit('authenticate', token);
      
      // Resume monitoring if it was enabled
      if (savedMonitoring === 'true' && savedEquipment && savedConfigLoaded === 'true') {
        socketInstance.emit('start-monitoring', parseInt(savedEquipment));
      }
    });

    socketInstance.on('sensor-update', (data: any) => {
      console.log('Sensor update received:', data);
      if (data.sensors) {
        setSensorData(data.sensors);
      }
      if (data.power) {
        setEnergyMetrics(prev => ({
          ...prev,
          currentPower: data.power.totalKw || prev.currentPower,
          powerFactor: data.power.powerFactor || prev.powerFactor
        }));
      }
      if (data.predictions) {
        setEnergyMetrics(prev => ({
          ...prev,
          efficiency: data.predictions.efficiency || prev.efficiency
        }));
      }
    });

    socketInstance.on('alarm', (alarm: Alarm) => {
      console.log('New alarm:', alarm);
      setActiveAlarms(prev => [alarm, ...prev].slice(0, 10));
    });

    socketInstance.on('diagnostics-result', (result: any) => {
      console.log('Diagnostics result:', result);
    });

    // Listen for inference results
    socketInstance.on('inference-result', (result: any) => {
      console.log('Inference result:', result);
      setInferenceResult(result);
      setInferenceStatus('running');
    });

    socketInstance.on('diagnosis-complete', (result: any) => {
      console.log('Diagnosis complete:', result);
      setInferenceResult(result.diagnosis);
    });

    setSocket(socketInstance);

    // Fetch initial data from API
    fetchDashboardData();
    fetchWeatherData();

    // Fetch weather data every 10 minutes
    const weatherInterval = setInterval(fetchWeatherData, 10 * 60 * 1000);

    // Listen for demo mode changes
    const handleDemoModeChange = (event: CustomEvent) => {
      setDemoMode(event.detail);
      fetchDashboardData();  // Refetch data with new mode
    };

    window.addEventListener('demoModeChanged', handleDemoModeChange as any);

    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
      }
      clearInterval(weatherInterval);
      window.removeEventListener('demoModeChanged', handleDemoModeChange as any);
    };
  }, []);


  const fetchDashboardData = async () => {
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    try {
      if (isDemoMode) {
        // Use demo data
        const demoCustomers = [
          { id: 1, name: 'Demo Facility A', city: 'Fort Wayne', state: 'IN' },
          { id: 2, name: 'Demo Facility B', city: 'Indianapolis', state: 'IN' },
          { id: 3, name: 'Demo Facility C', city: 'Chicago', state: 'IL' }
        ];
        setCustomers(demoCustomers);

        const demoEquipment = [
          { id: 1, location_name: 'RTU-1', equipment_type: 'RTU', customer_id: 1, status: 'online', health_score: 92, efficiency: 88 },
          { id: 2, location_name: 'Chiller-1', equipment_type: 'Chiller', customer_id: 1, status: 'online', health_score: 85, efficiency: 82 },
          { id: 3, location_name: 'AHU-1', equipment_type: 'AHU', customer_id: 2, status: 'online', health_score: 95, efficiency: 90 },
          { id: 4, location_name: 'RTU-2', equipment_type: 'RTU', customer_id: 2, status: 'warning', health_score: 75, efficiency: 72 },
          { id: 5, location_name: 'Pump-1', equipment_type: 'Pump', customer_id: 3, status: 'online', health_score: 88, efficiency: 86 }
        ];
        setEquipment(demoEquipment);

        // Fetch demo alarms
        const alarmsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/demo/alarms`, { headers });
        const alarmsData = await alarmsRes.json();
        setActiveAlarms(alarmsData);

        // Calculate system health
        calculateSystemHealth(demoEquipment, alarmsData);
      } else {
        // Fetch real data
        const customersRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers`, { headers });
        const customersData = await customersRes.json();
        setCustomers(customersData);

        const equipmentRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/equipment`, { headers });
        const equipmentData = await equipmentRes.json();
        setEquipment(equipmentData);

        const alarmsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/alarms?status=active`, { headers });
        const alarmsData = await alarmsRes.json();
        setActiveAlarms(alarmsData);

        calculateSystemHealth(equipmentData, alarmsData);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  const startMonitoring = (equipmentId: number) => {
    if (socket && monitoringEnabled) {
      socket.emit('start-monitoring', equipmentId);
    }
  };

  const stopMonitoring = () => {
    if (socket) {
      socket.emit('stop-monitoring');
      setSensorData([]);
    }
  };

  const loadEquipmentConfig = async () => {
    if (!selectedEquipment) return;

    const token = localStorage.getItem('token');
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    try {
      if (isDemoMode) {
        // In demo mode, just set config loaded and fetch demo data
        setConfigLoaded(true);
        localStorage.setItem('configLoaded', 'true');
        fetchTrendData(selectedEquipment);
        if (monitoringEnabled) {
          fetchEnergyData(selectedEquipment);
        }
      } else {
        // Load sensor configuration
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/sensors/config/${selectedEquipment}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (response.ok) {
          setConfigLoaded(true);
          localStorage.setItem('configLoaded', 'true');

          // Start monitoring if enabled
          if (monitoringEnabled) {
            startMonitoring(selectedEquipment);
            // Only fetch energy data when monitoring is active
            fetchEnergyData(selectedEquipment);
          }
          // Fetch trend data (can load even without monitoring)
          fetchTrendData(selectedEquipment);
        }
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const toggleMonitoring = async (enabled: boolean) => {
    setMonitoringEnabled(enabled);
    localStorage.setItem('monitoringEnabled', enabled.toString());
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (enabled && selectedEquipment && configLoaded) {
      if (!isDemoMode) {
        startMonitoring(selectedEquipment);
      }
      // Start fetching power metrics when monitoring is enabled
      fetchEnergyData(selectedEquipment);
      // Set up periodic refresh
      const interval = setInterval(() => {
        fetchEnergyData(selectedEquipment);
      }, 5000);
      // Store interval ID for cleanup
      (window as any).powerMetricsInterval = interval;
      
      // Start Hailo inference with multi-stream mode if sensors are configured
      // Note: Inference will start automatically even if no sensors yet, as they may be configured later
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/inference/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            equipmentId: selectedEquipment,
            mode: 'simultaneous'  // Use multi-stream mode for all 8 models
          })
        });
        
        if (response.ok) {
          setInferenceStatus('running');
          console.log('Hailo inference started with multi-stream mode');
        }
      } catch (error) {
        console.error('Failed to start inference:', error);
      }
    } else {
      stopMonitoring();
      // Clear power metrics interval
      if ((window as any).powerMetricsInterval) {
        clearInterval((window as any).powerMetricsInterval);
        delete (window as any).powerMetricsInterval;
      }
      
      // Stop Hailo inference
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/inference/stop`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ equipmentId: selectedEquipment })
        });
        
        if (response.ok) {
          setInferenceStatus('stopped');
          setInferenceResult(null);
          console.log('Hailo inference stopped');
        }
      } catch (error) {
        console.error('Failed to stop inference:', error);
      }
      
      // Clear power data when monitoring stops
      setEnergyMetrics({
        currentPower: 0,
        dailyConsumption: 0,
        dailyCost: 0,
        efficiency: 85,
        powerFactor: 0.9
      });
    }
  };

  const fetchWeatherData = async (zipOverride?: string) => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API;
      const zipCode = zipOverride || weatherZipCode;
      const units = process.env.NEXT_PUBLIC_WEATHER_UNITS || 'imperial';
      
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?zip=${zipCode},US&units=${units}&appid=${apiKey}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setWeatherData(data);
        
        // Send outdoor conditions to backend for AI calculations
        if (data.main) {
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/weather/outdoor-temp`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              temperature: data.main.temp,
              humidity: data.main.humidity,
              pressure: data.main.pressure,
              location: data.name,
              zipCode: zipCode
            })
          }).catch(err => console.error('Failed to update outdoor conditions:', err));
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error fetching weather data:', error);
      return false;
    }
  };

  const fetchEnergyData = async (equipmentId: number) => {
    const token = localStorage.getItem('token');
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // Generate demo energy metrics
      setEnergyMetrics({
        currentPower: 22.5 + (Math.random() - 0.5) * 5,
        dailyConsumption: 380 + Math.random() * 50,
        dailyCost: 45.60 + Math.random() * 10,
        efficiency: 82 + Math.random() * 10,
        powerFactor: 0.88 + Math.random() * 0.1
      });

      // Generate demo sensor readings with refrigerant and system temps
      const highPressure = 225 + (Math.random() - 0.5) * 20;
      const lowPressure = 68 + (Math.random() - 0.5) * 10;
      const suctionLineTemp = 55 + (Math.random() - 0.5) * 5;
      const liquidLineTemp = 85 + (Math.random() - 0.5) * 5;

      setSensorData([
        // 460V 3-phase system voltages (Line-to-Line ~460V, Line-to-Neutral ~266V)
        { name: 'VOLTAGE_L12', value: 460 + (Math.random() - 0.5) * 6, unit: 'V', status: 'normal' },
        { name: 'VOLTAGE_L23', value: 458 + (Math.random() - 0.5) * 6, unit: 'V', status: 'normal' },
        { name: 'VOLTAGE_L31', value: 461 + (Math.random() - 0.5) * 6, unit: 'V', status: 'normal' },
        { name: 'VOLTAGE_L1N', value: 266 + (Math.random() - 0.5) * 4, unit: 'V', status: 'normal' },
        { name: 'VOLTAGE_L2N', value: 265 + (Math.random() - 0.5) * 4, unit: 'V', status: 'normal' },
        { name: 'VOLTAGE_L3N', value: 267 + (Math.random() - 0.5) * 4, unit: 'V', status: 'normal' },
        { name: 'CURRENT_L1', value: 45 + (Math.random() - 0.5) * 8, unit: 'A', status: 'normal' },
        { name: 'CURRENT_L2', value: 43 + (Math.random() - 0.5) * 8, unit: 'A', status: 'normal' },
        { name: 'CURRENT_L3', value: 44 + (Math.random() - 0.5) * 8, unit: 'A', status: 'normal' },
        { name: 'SUPPLY_TEMP', value: 55 + (Math.random() - 0.5) * 3, unit: '°F', status: 'normal' },
        { name: 'RETURN_TEMP', value: 75 + (Math.random() - 0.5) * 3, unit: '°F', status: 'normal' },
        { name: 'FILTER_PRESSURE', value: 0.5 + (Math.random() - 0.5) * 0.2, unit: 'inWC', status: Math.random() > 0.8 ? 'warning' : 'normal' },
        // Add refrigerant pressures
        { name: 'HIGH_PRESSURE', value: highPressure, unit: 'PSI', status: 'normal' },
        { name: 'LOW_PRESSURE', value: lowPressure, unit: 'PSI', status: 'normal' },
        // Add line temperatures for proper calculation
        { name: 'SUCTION_LINE_TEMP', value: suctionLineTemp, unit: '°F', status: 'normal' },
        { name: 'SLT', value: suctionLineTemp, unit: '°F', status: 'normal' }, // Alias
        { name: 'LIQUID_LINE_TEMP', value: liquidLineTemp, unit: '°F', status: 'normal' },
        { name: 'LLT', value: liquidLineTemp, unit: '°F', status: 'normal' }, // Alias
        // Legacy fields for backward compatibility
        { name: 'SH', value: 12 + (Math.random() - 0.5) * 3, unit: '°F', status: 'normal' },
        { name: 'SC', value: 8 + (Math.random() - 0.5) * 2, unit: '°F', status: 'normal' },
        { name: 'DLT', value: 95 + (Math.random() - 0.5) * 5, unit: '°F', status: 'normal' }
      ]);
      return;
    }

    try {
      // Fetch from MFM384 power metrics endpoint
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/power/metrics/${equipmentId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        
        if (data.mfm384) {
          setEnergyMetrics(prev => ({
            ...prev,
            currentPower: data.mfm384.power.totalKW || 0,
            powerFactor: data.mfm384.power.powerFactor || 0
          }));
          
          // Update sensor data with MFM384 voltage and current readings
          setSensorData(prev => {
            // Remove old voltage/current readings
            const filtered = prev.filter(s => 
              !s.name.includes('VOLTAGE_') && !s.name.includes('CURRENT_')
            );
            
            // Add MFM384 readings
            return [
              ...filtered,
              { name: 'VOLTAGE_L12', value: data.mfm384.voltages.v12, unit: 'V', status: 'normal' },
              { name: 'VOLTAGE_L23', value: data.mfm384.voltages.v23, unit: 'V', status: 'normal' },
              { name: 'VOLTAGE_L31', value: data.mfm384.voltages.v31, unit: 'V', status: 'normal' },
              { name: 'CURRENT_L1', value: data.mfm384.currents.i1, unit: 'A', status: 'normal' },
              { name: 'CURRENT_L2', value: data.mfm384.currents.i2, unit: 'A', status: 'normal' },
              { name: 'CURRENT_L3', value: data.mfm384.currents.i3, unit: 'A', status: 'normal' }
            ];
          });
        }
      }
    } catch (error) {
      console.error('Error fetching power metrics:', error);
    }
  };

  const fetchTrendData = async (equipmentId: number) => {
    const token = localStorage.getItem('token');
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // Generate demo trend data
      const demoTrends = [];
      for (let i = 23; i >= 0; i--) {
        const timestamp = new Date(Date.now() - i * 3600000);
        demoTrends.push({
          timestamp: timestamp.toISOString(),
          temperature: 72 + Math.sin(i / 4) * 5 + (Math.random() - 0.5) * 2,
          humidity: 45 + Math.sin(i / 3) * 10 + (Math.random() - 0.5) * 3,
          power: 20 + Math.sin(i / 6) * 8 + (Math.random() - 0.5) * 2,
          efficiency: 85 + Math.sin(i / 5) * 5 + (Math.random() - 0.5) * 2
        });
      }
      setTrendData(demoTrends);
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/reports/trends?equipment_id=${equipmentId}&interval=hour`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      setTrendData(data || []);
    } catch (error) {
      console.error('Error fetching trend data:', error);
    }
  };

  const calculateSystemHealth = (equipmentData: Equipment[], alarmsData: Alarm[]) => {
    const onlineCount = equipmentData.filter(e => e.status !== 'offline').length;
    const criticalCount = alarmsData.filter(a => a.severity >= 3 && !a.acknowledged).length;
    const warningCount = alarmsData.filter(a => a.severity === 2 && !a.acknowledged).length;
    
    setSystemHealth({
      totalEquipment: equipmentData.length,
      onlineEquipment: onlineCount,
      criticalAlarms: criticalCount,
      warningAlarms: warningCount,
      avgEfficiency: equipmentData.reduce((sum, e) => sum + (e.efficiency || 85), 0) / equipmentData.length
    });
  };

  const getSensorIcon = (sensorName: string) => {
    if (sensorName.includes('TEMP')) return <ThermometerSun className="h-4 w-4" />;
    if (sensorName.includes('PRESSURE')) return <Gauge className="h-4 w-4" />;
    if (sensorName.includes('FLOW')) return <Wind className="h-4 w-4" />;
    if (sensorName.includes('HUMIDITY')) return <Droplets className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  const getSensorStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      case 'warning': return 'text-amber-600 bg-amber-100 dark:bg-amber-900/20';
      default: return 'text-teal-600 bg-teal-100 dark:bg-teal-900/20';
    }
  };

  const getWeatherIcon = (weatherCode: string) => {
    if (weatherCode?.includes('01')) return <Sun className="h-5 w-5 text-yellow-500" />;
    if (weatherCode?.includes('02') || weatherCode?.includes('03') || weatherCode?.includes('04')) 
      return <Cloud className="h-5 w-5 text-gray-500" />;
    if (weatherCode?.includes('09') || weatherCode?.includes('10') || weatherCode?.includes('11')) 
      return <CloudRain className="h-5 w-5 text-blue-500" />;
    if (weatherCode?.includes('13')) return <CloudSnow className="h-5 w-5 text-blue-300" />;
    return <Sun className="h-5 w-5 text-yellow-500" />;
  };

  const handleWeatherZipUpdate = async () => {
    // Validate zip code format (5 digits)
    if (!/^\d{5}$/.test(tempZipCode)) {
      alert('Please enter a valid 5-digit US zip code');
      return;
    }
    
    // Try fetching weather for new zip
    const success = await fetchWeatherData(tempZipCode);
    if (success) {
      setWeatherZipCode(tempZipCode);
      localStorage.setItem('weatherZipCode', tempZipCode);
      setWeatherDialogOpen(false);
    } else {
      alert('Failed to fetch weather for this zip code. Please check if it\'s valid.');
    }
  };

  // When equipment is selected, get its refrigerant type
  useEffect(() => {
    if (selectedEquipment) {
      const eq = equipment.find(e => e.id === selectedEquipment);
      if (eq && eq.refrigerant_type) {
        setSelectedRefrigerant(eq.refrigerant_type);
      }
    }
  }, [selectedEquipment, equipment]);

  // P/T Chart Data for different refrigerants
  const getPTData = (refrigerant: string) => {
    const data: { [key: string]: { temp: number; pressure: number }[] } = {
      'R-410A': [
        { temp: -60, pressure: 5.4 },
        { temp: -50, pressure: 9.3 },
        { temp: -40, pressure: 14.7 },
        { temp: -30, pressure: 22.1 },
        { temp: -20, pressure: 32.0 },
        { temp: -10, pressure: 45.1 },
        { temp: 0, pressure: 62.0 },
        { temp: 10, pressure: 83.2 },
        { temp: 20, pressure: 109.6 },
        { temp: 30, pressure: 141.8 },
        { temp: 40, pressure: 180.8 },
        { temp: 50, pressure: 227.3 },
        { temp: 60, pressure: 282.1 },
        { temp: 70, pressure: 346.3 },
        { temp: 80, pressure: 420.7 },
        { temp: 90, pressure: 506.5 },
        { temp: 100, pressure: 604.7 },
        { temp: 110, pressure: 716.4 },
        { temp: 120, pressure: 842.8 }
      ],
      'R-22': [
        { temp: -60, pressure: 2.4 },
        { temp: -50, pressure: 4.9 },
        { temp: -40, pressure: 8.8 },
        { temp: -30, pressure: 14.6 },
        { temp: -20, pressure: 22.9 },
        { temp: -10, pressure: 34.3 },
        { temp: 0, pressure: 49.3 },
        { temp: 10, pressure: 68.5 },
        { temp: 20, pressure: 92.6 },
        { temp: 30, pressure: 122.2 },
        { temp: 40, pressure: 158.2 },
        { temp: 50, pressure: 201.2 },
        { temp: 60, pressure: 252.1 },
        { temp: 70, pressure: 311.9 },
        { temp: 80, pressure: 381.5 },
        { temp: 90, pressure: 461.9 },
        { temp: 100, pressure: 554.1 },
        { temp: 110, pressure: 659.2 },
        { temp: 120, pressure: 778.3 }
      ],
      'R-134a': [
        { temp: -60, pressure: 0.3 },
        { temp: -50, pressure: 1.3 },
        { temp: -40, pressure: 3.7 },
        { temp: -30, pressure: 7.8 },
        { temp: -20, pressure: 14.1 },
        { temp: -10, pressure: 23.2 },
        { temp: 0, pressure: 35.7 },
        { temp: 10, pressure: 52.3 },
        { temp: 20, pressure: 73.5 },
        { temp: 30, pressure: 100.3 },
        { temp: 40, pressure: 133.1 },
        { temp: 50, pressure: 172.9 },
        { temp: 60, pressure: 220.4 },
        { temp: 70, pressure: 276.5 },
        { temp: 80, pressure: 342.2 },
        { temp: 90, pressure: 418.4 },
        { temp: 100, pressure: 506.1 },
        { temp: 110, pressure: 606.4 },
        { temp: 120, pressure: 720.3 }
      ],
      'R-404A': [
        { temp: -60, pressure: 4.5 },
        { temp: -50, pressure: 8.2 },
        { temp: -40, pressure: 13.4 },
        { temp: -30, pressure: 20.8 },
        { temp: -20, pressure: 30.8 },
        { temp: -10, pressure: 44.1 },
        { temp: 0, pressure: 61.2 },
        { temp: 10, pressure: 82.8 },
        { temp: 20, pressure: 109.8 },
        { temp: 30, pressure: 142.8 },
        { temp: 40, pressure: 182.6 },
        { temp: 50, pressure: 230.2 },
        { temp: 60, pressure: 286.5 },
        { temp: 70, pressure: 352.6 },
        { temp: 80, pressure: 429.5 },
        { temp: 90, pressure: 518.4 },
        { temp: 100, pressure: 620.4 },
        { temp: 110, pressure: 736.7 },
        { temp: 120, pressure: 868.5 }
      ],
      'R-407C': [
        { temp: -60, pressure: 3.5 },
        { temp: -50, pressure: 6.7 },
        { temp: -40, pressure: 11.4 },
        { temp: -30, pressure: 18.2 },
        { temp: -20, pressure: 27.4 },
        { temp: -10, pressure: 39.8 },
        { temp: 0, pressure: 55.9 },
        { temp: 10, pressure: 76.5 },
        { temp: 20, pressure: 102.2 },
        { temp: 30, pressure: 133.8 },
        { temp: 40, pressure: 172.2 },
        { temp: 50, pressure: 218.2 },
        { temp: 60, pressure: 272.9 },
        { temp: 70, pressure: 337.3 },
        { temp: 80, pressure: 412.4 },
        { temp: 90, pressure: 499.4 },
        { temp: 100, pressure: 599.5 },
        { temp: 110, pressure: 713.7 },
        { temp: 120, pressure: 843.4 }
      ],
      'R-454B': [
        { temp: -60, pressure: 4.8 },
        { temp: -50, pressure: 8.5 },
        { temp: -40, pressure: 13.8 },
        { temp: -30, pressure: 21.2 },
        { temp: -20, pressure: 31.2 },
        { temp: -10, pressure: 44.5 },
        { temp: 0, pressure: 61.6 },
        { temp: 10, pressure: 83.2 },
        { temp: 20, pressure: 110.2 },
        { temp: 30, pressure: 143.2 },
        { temp: 40, pressure: 183.0 },
        { temp: 50, pressure: 230.6 },
        { temp: 60, pressure: 287.0 },
        { temp: 70, pressure: 353.2 },
        { temp: 80, pressure: 430.2 },
        { temp: 90, pressure: 519.2 },
        { temp: 100, pressure: 621.3 },
        { temp: 110, pressure: 737.7 },
        { temp: 120, pressure: 869.6 }
      ],
      'R-508B': [
        { temp: -60, pressure: 25.8 },
        { temp: -50, pressure: 36.5 },
        { temp: -40, pressure: 50.2 },
        { temp: -30, pressure: 67.5 },
        { temp: -20, pressure: 88.8 },
        { temp: -10, pressure: 114.7 },
        { temp: 0, pressure: 145.8 },
        { temp: 10, pressure: 182.7 },
        { temp: 20, pressure: 226.2 },
        { temp: 30, pressure: 277.0 },
        { temp: 40, pressure: 335.9 },
        { temp: 50, pressure: 403.8 },
        { temp: 60, pressure: 481.5 },
        { temp: 70, pressure: 570.0 },
        { temp: 80, pressure: 670.3 },
        { temp: 90, pressure: 783.5 },
        { temp: 100, pressure: 910.7 },
        { temp: 110, pressure: 1053.0 },
        { temp: 120, pressure: 1211.5 }
      ],
      'R-32': [
        { temp: -60, pressure: 7.2 },
        { temp: -50, pressure: 12.1 },
        { temp: -40, pressure: 19.0 },
        { temp: -30, pressure: 28.3 },
        { temp: -20, pressure: 40.6 },
        { temp: -10, pressure: 56.6 },
        { temp: 0, pressure: 77.0 },
        { temp: 10, pressure: 102.5 },
        { temp: 20, pressure: 134.0 },
        { temp: 30, pressure: 172.3 },
        { temp: 40, pressure: 218.5 },
        { temp: 50, pressure: 273.5 },
        { temp: 60, pressure: 338.5 },
        { temp: 70, pressure: 414.5 },
        { temp: 80, pressure: 502.8 },
        { temp: 90, pressure: 604.7 },
        { temp: 100, pressure: 721.4 },
        { temp: 110, pressure: 854.4 },
        { temp: 120, pressure: 1005.0 }
      ]
    };
    
    return data[refrigerant] || data['R-410A'];
  };

  // Calculate temperature from pressure for a given refrigerant
  const calculateTempFromPressure = (pressure: number, refrigerant: string) => {
    if (!pressure || pressure === 0) return '--';
    
    const ptData = getPTData(refrigerant);
    
    // Find the two closest pressure points
    let lowerPoint = ptData[0];
    let upperPoint = ptData[ptData.length - 1];
    
    for (let i = 0; i < ptData.length - 1; i++) {
      if (pressure >= ptData[i].pressure && pressure <= ptData[i + 1].pressure) {
        lowerPoint = ptData[i];
        upperPoint = ptData[i + 1];
        break;
      }
    }
    
    // Linear interpolation
    const pressureRange = upperPoint.pressure - lowerPoint.pressure;
    const tempRange = upperPoint.temp - lowerPoint.temp;
    const pressureDiff = pressure - lowerPoint.pressure;
    const temp = lowerPoint.temp + (pressureDiff / pressureRange) * tempRange;
    
    return temp.toFixed(1);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          System Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Real-time monitoring and control
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="card-mint hover:shadow-xl transition-all duration-300">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Environment
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setWeatherDialogOpen(true)}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {weatherData ? (
              <>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {Math.round(weatherData.main?.temp || 0)}°F
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(weatherData.main?.humidity || 0)}% RH
                  </span>
                  {getWeatherIcon(weatherData.weather?.[0]?.icon)}
                </div>
                <div className="mt-2">
                  <span className="text-xs text-muted-foreground">
                    {weatherData.name} • {weatherData.weather?.[0]?.description}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    --°F
                  </span>
                  <Cloud className="ml-auto h-5 w-5 text-gray-400" />
                </div>
                <div className="mt-2">
                  <span className="text-xs text-muted-foreground">Loading weather...</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="card-mint hover:shadow-xl transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {equipment.find(e => e.id === selectedEquipment)?.equipment_type === 'Chiller' ? 'Supply Water' : 'Supply Air'} Temp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {sensorData.find(s => s.name.includes('SUPPLY_TEMP'))?.value.toFixed(1) || '--.-'}
              </span>
              <span className="text-sm text-muted-foreground">°F</span>
              <ThermometerSun className="ml-auto h-5 w-5 text-blue-400" />
            </div>
            <div className="mt-2">
              {(() => {
                const isChiller = equipment.find(e => e.id === selectedEquipment)?.equipment_type === 'Chiller';
                if (isChiller) {
                  return (
                    <span className="text-xs text-muted-foreground">
                      Return: {sensorData.find(s => s.name.includes('RETURN_TEMP'))?.value.toFixed(1) || '--.-'}°F
                    </span>
                  );
                } else {
                  // For air systems, show CFM if QVM62.1 sensor is configured
                  const velocitySensor = sensorData.find(s => 
                    s.name.includes('AIR_VELOCITY') || 
                    s.name.includes('SUPPLY_AIR_VELOCITY') ||
                    s.name.includes('QVM62')
                  );
                  
                  if (velocitySensor) {
                    // Calculate CFM from velocity (ft/s) and duct area
                    // Assuming standard duct area is configured or use velocity directly
                    const velocity = velocitySensor.value;
                    // Get duct area from sensor config or use default
                    const ductArea = 4.0; // sq ft (24"x24" duct as default)
                    const cfm = (velocity * ductArea * 60).toFixed(0);
                    
                    return (
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground block">
                          Return: {sensorData.find(s => s.name.includes('RETURN_TEMP'))?.value.toFixed(1) || '--.-'}°F
                        </span>
                        <span className="text-xs text-teal-600 dark:text-teal-400 font-medium">
                          {cfm} CFM @ {velocity.toFixed(1)} ft/s
                        </span>
                      </div>
                    );
                  } else {
                    return (
                      <span className="text-xs text-muted-foreground">
                        Return: {sensorData.find(s => s.name.includes('RETURN_TEMP'))?.value.toFixed(1) || '--.-'}°F
                      </span>
                    );
                  }
                }
              })()}
            </div>
          </CardContent>
        </Card>

        <Card className="card-mint hover:shadow-xl transition-all duration-300">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Refrigerant Pressure
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setPtChartOpen(true)}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline space-x-2">
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {sensorData.find(s => s.name.includes('HIGH_PRESSURE'))?.value.toFixed(0) || '---'}/{sensorData.find(s => s.name.includes('LOW_PRESSURE'))?.value.toFixed(0) || '---'}
              </span>
              <span className="text-sm text-muted-foreground">PSI</span>
              <Gauge className="ml-auto h-5 w-5 text-teal-400" />
            </div>
            <div className="mt-2">
              <span className="text-xs text-muted-foreground">
                High/Low Side
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="card-mint hover:shadow-xl transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              System Temps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-3">
              {(() => {
                const currentEquipment = equipment.find(e => e.id === selectedEquipment);
                const highPressure = sensorData.find(s => s.name.includes('HIGH_PRESSURE'))?.value;
                const lowPressure = sensorData.find(s => s.name.includes('LOW_PRESSURE'))?.value;
                const suctionLineTemp = sensorData.find(s => s.name.includes('SUCTION_LINE_TEMP'))?.value ||
                                       sensorData.find(s => s.name.includes('SLT'))?.value || 55;
                const liquidLineTemp = sensorData.find(s => s.name.includes('LIQUID_LINE_TEMP'))?.value ||
                                      sensorData.find(s => s.name.includes('LLT'))?.value || 85;

                if (highPressure && lowPressure && currentEquipment) {
                  const refrigerant = getRefrigerantType(currentEquipment);
                  const temps = calculateSystemTemps(
                    highPressure,
                    lowPressure,
                    suctionLineTemp,
                    liquidLineTemp,
                    refrigerant
                  );

                  return (
                    <>
                      <div className="flex items-baseline space-x-1">
                        <span className="text-xl font-bold text-blue-500">
                          {temps.superheat}°/{temps.suctionLineTemp}°
                        </span>
                        <span className="text-xs text-muted-foreground">SH/SLT</span>
                      </div>
                      <div className="flex items-baseline space-x-1">
                        <span className="text-xl font-bold text-orange-500">
                          {temps.subcooling}°/{temps.liquidLineTemp}°
                        </span>
                        <span className="text-xs text-muted-foreground">SC/LLT</span>
                      </div>
                    </>
                  );
                } else {
                  // Fallback to raw values if calculations can't be performed
                  return (
                    <>
                      <div className="flex items-baseline space-x-1">
                        <span className="text-xl font-bold text-blue-500">
                          {sensorData.find(s => s.name.includes('SH'))?.value.toFixed(0) || '--'}°/{sensorData.find(s => s.name.includes('SLT'))?.value.toFixed(0) || '--'}°
                        </span>
                        <span className="text-xs text-muted-foreground">SH/SLT</span>
                      </div>
                      <div className="flex items-baseline space-x-1">
                        <span className="text-xl font-bold text-orange-500">
                          {sensorData.find(s => s.name.includes('SC'))?.value.toFixed(0) || '--'}°/{sensorData.find(s => s.name.includes('DLT'))?.value.toFixed(0) || '--'}°
                        </span>
                        <span className="text-xs text-muted-foreground">SC/DLT</span>
                      </div>
                    </>
                  );
                }
              })()}
              <ThermometerSun className="ml-auto h-5 w-5 text-amber-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer & Equipment Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Equipment Configuration</CardTitle>
          <CardDescription>Select customer and equipment to monitor</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Customer Selection */}
          <div>
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Select Customer</h4>
            <div className="flex flex-wrap gap-2">
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => {
                    setSelectedCustomer(customer.id);
                    setSelectedEquipment(null);
                    setConfigLoaded(false);
                    localStorage.setItem('selectedCustomer', customer.id.toString());
                    localStorage.removeItem('selectedEquipment');
                    localStorage.removeItem('configLoaded');
                    localStorage.removeItem('monitoringEnabled');
                    setMonitoringEnabled(false);
                    stopMonitoring();
                  }}
                  className={`px-4 py-2 rounded-lg border transition-all duration-200 ${
                    selectedCustomer === customer.id
                      ? 'bg-teal-50 dark:bg-teal-900/10 border-teal-500 text-teal-700 dark:text-teal-300'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="text-sm font-medium">{customer.name}</div>
                  <div className="text-xs text-muted-foreground">{customer.city}, {customer.state}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Equipment Selection - Only show for selected customer */}
          {selectedCustomer && (
            <div>
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Select Equipment</h4>
              <div className="flex flex-wrap gap-2">
                {equipment
                  .filter(eq => eq.customer_id === selectedCustomer)
                  .map((eq) => (
                    <button
                      key={eq.id}
                      onClick={() => {
                        setSelectedEquipment(eq.id);
                        setConfigLoaded(false);
                        localStorage.setItem('selectedEquipment', eq.id.toString());
                        localStorage.removeItem('configLoaded');
                        localStorage.removeItem('monitoringEnabled');
                        setMonitoringEnabled(false);
                        stopMonitoring();
                      }}
                      className={`px-4 py-2 rounded-lg border transition-all duration-200 ${
                        selectedEquipment === eq.id
                          ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-500 text-orange-700 dark:text-orange-300'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="text-sm font-medium">{eq.location_name}</div>
                      <div className="text-xs text-muted-foreground">{eq.equipment_type}</div>
                    </button>
                  ))}
                {equipment.filter(eq => eq.customer_id === selectedCustomer).length === 0 && (
                  <div className="text-sm text-muted-foreground py-2">No equipment found for this customer</div>
                )}
              </div>
            </div>
          )}

          {/* Load Config Button */}
          {selectedEquipment && !configLoaded && (
            <div className="flex items-center gap-4 pt-2">
              <Button 
                onClick={loadEquipmentConfig}
                className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white hover:shadow-xl"
              >
                Load Configuration
              </Button>
              <span className="text-sm text-muted-foreground">
                Load saved sensor configuration for {equipment.find(eq => eq.id === selectedEquipment)?.location_name}
              </span>
            </div>
          )}

          {/* Monitoring Toggle */}
          {configLoaded && (
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-3">
                <Switch
                  checked={monitoringEnabled}
                  onCheckedChange={toggleMonitoring}
                  className="data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-400"
                />
                <div>
                  <div className="text-sm font-medium">Sensor Monitoring</div>
                  <div className="text-xs text-muted-foreground">
                    {monitoringEnabled ? 'Actively reading sensors' : 'Monitoring paused'}
                  </div>
                </div>
              </div>
              {monitoringEnabled && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs text-green-600 dark:text-green-400">Live</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="sensors" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sensors" className="hover:shadow-xl transition-all duration-200">Live Sensors</TabsTrigger>
          <TabsTrigger value="trends" className="hover:shadow-xl transition-all duration-200">Trends</TabsTrigger>
          <TabsTrigger value="alarms" className="hover:shadow-xl transition-all duration-200">Alarms</TabsTrigger>
          <TabsTrigger value="inference" className="hover:shadow-xl transition-all duration-200">Inference</TabsTrigger>
        </TabsList>

        <TabsContent value="sensors" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Sensor Readings</CardTitle>
                <CardDescription>Real-time sensor data from hardware</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-2">
                    {monitoringEnabled && sensorData.length === 0 ? (
                      <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-800 dark:text-amber-200">
                          <div className="font-semibold mb-1">No sensors configured for this equipment</div>
                          <div className="text-sm">Go to Dashboard → Sensors to add sensor configurations.</div>
                        </AlertDescription>
                      </Alert>
                    ) : sensorData.length > 0 ? (
                      sensorData.map((sensor, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border ${getSensorStatusColor(sensor.status)}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {getSensorIcon(sensor.name)}
                              <span className="font-medium text-sm">{sensor.name}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-lg font-bold">{sensor.value.toFixed(1)}</span>
                              <span className="text-sm ml-1 text-muted-foreground">{sensor.unit}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <Alert>
                        <AlertDescription>
                          No sensor data available. Select equipment to start monitoring.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Power Metrics</CardTitle>
                <CardDescription>Electrical parameters</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Voltage L12/L23/L31</div>
                      <div className="font-mono text-lg">
                        {sensorData.find(s => s.name === 'VOLTAGE_L12')?.value.toFixed(0) || '---'} /
                        {sensorData.find(s => s.name === 'VOLTAGE_L23')?.value.toFixed(0) || '---'} /
                        {sensorData.find(s => s.name === 'VOLTAGE_L31')?.value.toFixed(0) || '---'} V
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Current L1-L2-L3</div>
                      <div className="font-mono text-lg">
                        {sensorData.find(s => s.name === 'CURRENT_L1')?.value.toFixed(1) || '---'} /
                        {sensorData.find(s => s.name === 'CURRENT_L2')?.value.toFixed(1) || '---'} /
                        {sensorData.find(s => s.name === 'CURRENT_L3')?.value.toFixed(1) || '---'} A
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Total Power</div>
                      <div className="font-mono text-2xl font-bold text-teal-600 dark:text-teal-400">
                        {energyMetrics.currentPower.toFixed(2)} kW
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Power Factor</div>
                      <div className="font-mono text-2xl font-bold">
                        {energyMetrics.powerFactor.toFixed(3)}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>Historical data visualization</CardDescription>
            </CardHeader>
            <CardContent>
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                    <XAxis 
                      dataKey="time" 
                      className="text-xs"
                      tick={{ fill: 'currentColor' }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fill: 'currentColor' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--background)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="temperature" 
                      stroke="#14b8a6" 
                      strokeWidth={2}
                      dot={false}
                      name="Temperature (°F)"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="humidity" 
                      stroke="#06b6d4" 
                      strokeWidth={2}
                      dot={false}
                      name="Humidity (%)"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="energy" 
                      stroke="#f59e0b" 
                      strokeWidth={2}
                      dot={false}
                      name="Power (kW)"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="efficiency" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      dot={false}
                      name="Efficiency (%)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Alert>
                  <AlertDescription>
                    No trend data available. Data will appear as the system collects readings.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alarms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Alarms</CardTitle>
              <CardDescription>Current system alerts and warnings</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {activeAlarms.length > 0 ? (
                    activeAlarms.map((alarm) => (
                      <div
                        key={alarm.id}
                        className={`p-4 rounded-lg border ${
                          alarm.severity >= 3
                            ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                            : alarm.severity === 2
                            ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
                            : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <AlertTriangle className={`h-4 w-4 ${
                                alarm.severity >= 3 ? 'text-red-600' : 
                                alarm.severity === 2 ? 'text-amber-600' : 'text-blue-600'
                              }`} />
                              <span className="font-medium">{alarm.type}</span>
                              <Badge variant={alarm.severity >= 3 ? "destructive" : "secondary"}>
                                Severity {alarm.severity}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Equipment #{alarm.equipment_id} - {alarm.message}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(alarm.timestamp).toLocaleString()}
                            </p>
                          </div>
                          {!alarm.acknowledged && (
                            <button className="btn-secondary px-3 py-1 text-xs">
                              Acknowledge
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                      <AlertDescription className="text-green-700 dark:text-green-400">
                        No active alarms. All systems operating normally.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inference" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Inference Status</CardTitle>
              <CardDescription>Hailo-8 NPU model inference for fault detection</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedEquipment ? (
                <div className="space-y-4">
                  {/* Check if monitoring is enabled - but show demo data in demo mode */}
                  {!monitoringEnabled && !demoMode ? (
                    <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Enable "Sensor Monitoring" in Equipment Configuration to start AI inference
                      </AlertDescription>
                    </Alert>
                  ) : sensorData.length === 0 && !demoMode ? (
                    <Alert className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        No sensors configured for this equipment. Please configure sensors to enable AI fault detection.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-4">
                      {/* Inference Status */}
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Brain className="h-5 w-5 text-teal-600" />
                          <div>
                            <div className="font-medium">Multi-Stream Inference</div>
                            <div className="text-sm text-muted-foreground">
                              All 8 models running simultaneously on Hailo-8 NPU
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {inferenceStatus === 'running' ? (
                            <>
                              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                              <span className="text-sm text-green-600 dark:text-green-400">Active</span>
                              <Badge className="ml-2 bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300">
                                Multi-Stream
                              </Badge>
                            </>
                          ) : (
                            <>
                              <div className="h-2 w-2 bg-gray-400 rounded-full" />
                              <span className="text-sm text-gray-600 dark:text-gray-400">Idle</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Model Assignments */}
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-muted-foreground">8-Model Ensemble (Parallel Execution)</div>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { name: 'APOLLO', desc: 'Master Coordinator', color: 'bg-amber-500' },
                            { name: 'AQUILO', desc: 'Electrical', color: 'bg-sky-500' },
                            { name: 'BOREAS', desc: 'Refrigeration', color: 'bg-indigo-500' },
                            { name: 'NAIAD', desc: 'Flow Systems', color: 'bg-blue-500' },
                            { name: 'VULCAN', desc: 'Mechanical', color: 'bg-red-500' },
                            { name: 'ZEPHYRUS', desc: 'Airflow', color: 'bg-green-500' },
                            { name: 'COLOSSUS', desc: 'Aggregator', color: 'bg-purple-500' },
                            { name: 'GAIA', desc: 'Safety', color: 'bg-emerald-500' }
                          ].map(model => (
                            <div 
                              key={model.name} 
                              className={`p-2 text-xs border rounded flex flex-col gap-1 ${
                                inferenceStatus === 'running' ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/10' : ''
                              }`}
                              title={model.desc}
                            >
                              <div className="flex items-center gap-1">
                                <div className={`h-1.5 w-1.5 rounded-full ${
                                  inferenceStatus === 'running' ? `${model.color} animate-pulse` : 'bg-gray-400'
                                }`} />
                                <span className="font-medium">{model.name}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground">{model.desc}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Latest Inference Result */}
                      <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
                        <div className="text-sm font-medium mb-2">Latest Multi-Stream Analysis</div>
                        {inferenceResult ? (
                          <div className="space-y-3">
                            {inferenceResult.final ? (
                              <div className={`text-sm p-3 rounded-lg ${
                                inferenceResult.final.consensus > 0.7 ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                                inferenceResult.final.consensus > 0.3 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                                'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              }`}>
                                <div className="font-medium">{inferenceResult.final.diagnosis}</div>
                                <div className="text-xs mt-1">
                                  Consensus: {(inferenceResult.final.consensus * 100).toFixed(0)}% 
                                  {inferenceResult.mode === 'simultaneous' && ' • Multi-Stream'}
                                </div>
                              </div>
                            ) : null}
                            
                            {/* Show individual model results if available */}
                            {inferenceResult.models && Object.keys(inferenceResult.models).length > 0 && (
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground font-medium">Model Outputs:</div>
                                <div className="grid grid-cols-2 gap-1">
                                  {Object.entries(inferenceResult.models).slice(0, 4).map(([model, result]: [string, any]) => (
                                    <div key={model} className="text-[10px] flex items-center gap-1">
                                      <div className={`h-1 w-1 rounded-full ${
                                        result.fault_detected ? 'bg-red-500' : 'bg-green-500'
                                      }`} />
                                      <span className="font-medium">{model.toUpperCase()}:</span>
                                      <span className="text-muted-foreground">
                                        {result.confidence ? `${(result.confidence * 100).toFixed(0)}%` : 'OK'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {inferenceResult.inferenceTimeMs && (
                              <div className="text-xs text-muted-foreground border-t pt-2">
                                Total inference time: {inferenceResult.inferenceTimeMs}ms
                                {inferenceResult.mode === 'simultaneous' && ' (parallel execution)'}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-xs text-muted-foreground">
                              Waiting for inference results...
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Models will analyze sensor data every 30 seconds
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Alert>
                  <AlertDescription>
                    Please select equipment from the dropdown above to view inference status
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* P/T Chart Dialog */}
      <Dialog open={ptChartOpen} onOpenChange={setPtChartOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Refrigerant P/T Chart</DialogTitle>
            <DialogDescription>
              Pressure-Temperature relationship for {selectedRefrigerant}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Refrigerant Selector */}
            <div className="flex items-center gap-4">
              <Label>Refrigerant Type:</Label>
              <select
                value={selectedRefrigerant}
                onChange={(e) => setSelectedRefrigerant(e.target.value)}
                className="px-3 py-1 border rounded-md bg-white dark:bg-gray-800"
              >
                <option value="R-410A">R-410A</option>
                <option value="R-22">R-22</option>
                <option value="R-134a">R-134a</option>
                <option value="R-404A">R-404A</option>
                <option value="R-407C">R-407C</option>
                <option value="R-454B">R-454B</option>
                <option value="R-508B">R-508B</option>
                <option value="R-32">R-32</option>
                <option value="R-744 (CO2)">R-744 (CO2)</option>
                <option value="R-290 (Propane)">R-290 (Propane)</option>
              </select>
            </div>
            
            {/* P/T Chart */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={getPTData(selectedRefrigerant)}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                  <XAxis 
                    dataKey="temp" 
                    label={{ value: 'Temperature (°F)', position: 'insideBottom', offset: -5 }}
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <YAxis 
                    label={{ value: 'Pressure (PSIG)', angle: -90, position: 'insideLeft' }}
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--background)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="pressure" 
                    stroke="#14b8a6" 
                    strokeWidth={2}
                    dot={false}
                    name="Saturation Pressure"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* Current Values Display */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">High Side (Discharge)</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold">
                    {sensorData.find(s => s.name.includes('HIGH_PRESSURE'))?.value.toFixed(0) || '---'}
                  </span>
                  <span className="text-sm text-muted-foreground">PSIG</span>
                </div>
                <div className="text-sm text-teal-600 dark:text-teal-400 mt-1">
                  ≈ {calculateTempFromPressure(sensorData.find(s => s.name.includes('HIGH_PRESSURE'))?.value || 0, selectedRefrigerant)}°F
                </div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Low Side (Suction)</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold">
                    {sensorData.find(s => s.name.includes('LOW_PRESSURE'))?.value.toFixed(0) || '---'}
                  </span>
                  <span className="text-sm text-muted-foreground">PSIG</span>
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  ≈ {calculateTempFromPressure(sensorData.find(s => s.name.includes('LOW_PRESSURE'))?.value || 0, selectedRefrigerant)}°F
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setPtChartOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Weather Zip Code Dialog */}
      <Dialog open={weatherDialogOpen} onOpenChange={setWeatherDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Weather Location</DialogTitle>
            <DialogDescription>
              Enter a US zip code to get weather data for a different location
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="zipCode" className="text-right">
                Zip Code
              </Label>
              <Input
                id="zipCode"
                value={tempZipCode}
                onChange={(e) => setTempZipCode(e.target.value)}
                placeholder="46795"
                className="col-span-3"
                maxLength={5}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Current location: {weatherData?.name || 'Unknown'}
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setTempZipCode(weatherZipCode);
                setWeatherDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleWeatherZipUpdate}>
              Update Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
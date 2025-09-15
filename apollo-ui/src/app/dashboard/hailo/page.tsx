'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sparkles,
  Cpu,
  Activity,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Brain,
  Wind,
  Droplets,
  Gauge,
  Flame,
  TreePine,
  Shield,
  Crown,
  AlertTriangle,
  BarChart3,
  RefreshCw,
  Settings,
  Snowflake,
  Network
} from 'lucide-react';

const modelIcons = {
  apollo: Network,
  aquilo: Zap,
  boreas: Snowflake,
  naiad: Droplets,
  vulcan: Settings,
  zephyrus: Wind,
  colossus: Gauge,
  gaia: TreePine
};

const modelColors = {
  apollo: 'text-amber-500',
  aquilo: 'text-sky-500',
  boreas: 'text-indigo-500',
  naiad: 'text-blue-500',
  vulcan: 'text-red-500',
  zephyrus: 'text-green-500',
  colossus: 'text-purple-500',
  gaia: 'text-emerald-500'
};

interface DeviceStatus {
  online: boolean;
  device?: string;
  temperature?: number | null;
  power?: number;
  utilization?: number;
  tops?: number;
  max_tops?: number;
  error?: string;
  timestamp: string;
}

interface InferenceStats {
  total: number;
  today: number;
  avgTime: number;
  lastRun: string | null;
}

interface Model {
  loaded: boolean;
  path?: string;
  size?: number | null;
  version?: string;
}

interface Equipment {
  id: number;
  location_name: string;
  make: string;
  model: string;
}

interface DiagnosticResults {
  inferenceTimeMs: number;
  mode?: string;
  final?: {
    diagnosis: string;
    consensus: number;
  };
  models?: Record<string, any>;
}

export default function HailoPage() {
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [models, setModels] = useState<Record<string, Model>>({});
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [runningDiagnosis, setRunningDiagnosis] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResults | null>(null);
  const [simultaneousMode, setSimultaneousMode] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [inferenceStats, setInferenceStats] = useState<InferenceStats>({
    total: 0,
    today: 0,
    avgTime: 0,
    lastRun: null
  });

  useEffect(() => {
    // Check demo mode
    const isDemoMode = localStorage.getItem('demoMode') === 'true';
    setDemoMode(isDemoMode);

    fetchDeviceStatus();
    fetchModelStatus();
    fetchEquipment();
    fetchInferenceStats();

    const interval = setInterval(() => {
      fetchDeviceStatus();
      fetchModelStatus();
      fetchInferenceStats();
    }, 5000);

    // Listen for demo mode changes
    const handleDemoModeChange = (event: CustomEvent) => {
      setDemoMode(event.detail);
      fetchEquipment();
      fetchInferenceStats();
    };

    window.addEventListener('demoModeChanged', handleDemoModeChange as any);

    return () => {
      clearInterval(interval);
      window.removeEventListener('demoModeChanged', handleDemoModeChange as any);
    };
  }, []);

  const fetchDeviceStatus = async () => {
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // Simulated device status for demo
      setDeviceStatus({
        online: true,
        device: 'Hailo-8 (Demo)',
        temperature: 42.5,
        power: 8.2,
        utilization: 78,
        tops: 20.5,
        max_tops: 26,
        timestamp: new Date().toISOString()
      });
    } else {
      try {
        const response = await fetch('http://localhost:8001/api/hailo/status', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await response.json();
        setDeviceStatus(data);
      } catch (error) {
        console.error('Error fetching device status:', error);
        setDeviceStatus(null);
      }
    }
  };

  const fetchModelStatus = async () => {
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // Simulated model status for demo
      setModels({
        apollo: { loaded: true, path: '/models/apollo.hef', size: 12.5, version: '1.0' },
        aquilo: { loaded: true, path: '/models/aquilo.hef', size: 10.2, version: '1.0' },
        boreas: { loaded: true, path: '/models/boreas.hef', size: 11.8, version: '1.0' },
        naiad: { loaded: true, path: '/models/naiad.hef', size: 9.5, version: '1.0' },
        vulcan: { loaded: true, path: '/models/vulcan.hef', size: 13.2, version: '1.0' },
        zephyrus: { loaded: true, path: '/models/zephyrus.hef', size: 8.9, version: '1.0' },
        colossus: { loaded: true, path: '/models/colossus.hef', size: 15.3, version: '1.0' },
        gaia: { loaded: true, path: '/models/gaia.hef', size: 14.7, version: '1.0' }
      });
    } else {
      try {
        const response = await fetch('http://localhost:8001/api/hailo/models', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await response.json();
        setModels(data || {});
      } catch (error) {
        console.error('Error fetching model status:', error);
        setModels({});
      }
    }
  };

  const fetchEquipment = async () => {
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // Demo equipment
      setEquipment([
        { id: 1, location_name: 'RTU-1', make: 'Carrier', model: '48TC' },
        { id: 2, location_name: 'Chiller-1', make: 'Trane', model: 'CVHF' },
        { id: 3, location_name: 'AHU-1', make: 'York', model: 'YK' },
        { id: 4, location_name: 'RTU-2', make: 'Lennox', model: 'L7742' },
        { id: 5, location_name: 'Pump-1', make: 'Grundfos', model: 'CR-95' }
      ]);
    } else {
      try {
        const response = await fetch('http://localhost:8001/api/equipment', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await response.json();
        // Ensure data is an array
        setEquipment(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching equipment:', error);
        setEquipment([]);
      }
    }
  };

  const fetchInferenceStats = async () => {
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // Demo inference stats
      setInferenceStats({
        total: 3847,
        today: 342,
        avgTime: 28.5,
        lastRun: new Date(Date.now() - 30000).toISOString()
      });
    } else {
      try {
        const response = await fetch('http://localhost:8001/api/hailo/stats', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await response.json();
        setInferenceStats(data || { total: 0, today: 0, avgTime: 0, lastRun: null });
      } catch (error) {
        console.error('Error fetching inference stats:', error);
        setInferenceStats({ total: 0, today: 0, avgTime: 0, lastRun: null });
      }
    }
  };

  const runDiagnosis = async () => {
    if (!selectedEquipment) {
      alert('Please select equipment first');
      return;
    }

    setRunningDiagnosis(true);
    setDiagnosticResults(null);

    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // Simulate diagnosis for demo
      setTimeout(() => {
        setDiagnosticResults({
          inferenceTimeMs: simultaneousMode ? 28 : 145,
          mode: simultaneousMode ? 'simultaneous' : 'sequential',
          final: {
            diagnosis: 'System operating within normal parameters. Minor efficiency degradation detected in cooling cycle.',
            consensus: 0.15
          },
          models: {
            apollo: { fault_detected: false, confidence: 0.92 },
            aquilo: { fault_detected: false, confidence: 0.88 },
            boreas: { fault_detected: true, confidence: 0.35 },
            naiad: { fault_detected: false, confidence: 0.95 },
            vulcan: { fault_detected: false, confidence: 0.91 },
            zephyrus: { fault_detected: false, confidence: 0.89 },
            colossus: { fault_detected: false, confidence: 0.90 },
            gaia: { fault_detected: false, confidence: 0.94 }
          }
        });
        setRunningDiagnosis(false);
      }, 2000);
    } else {
      try {
        const response = await fetch('http://localhost:8001/api/hailo/diagnose', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            equipmentId: selectedEquipment,
            mode: simultaneousMode ? 'simultaneous' : 'sequential'
          })
        });
        const data = await response.json();
        setDiagnosticResults(data);
      } catch (error) {
        console.error('Error running diagnosis:', error);
        alert('Failed to run diagnosis');
      } finally {
        setRunningDiagnosis(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-teal-500 dark:from-teal-400 dark:to-teal-300 bg-clip-text text-transparent">
            Hailo-8 NPU Control Center
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            8-Model HVAC Fault Detection System
          </p>
        </div>
        <Button onClick={() => { fetchDeviceStatus(); fetchModelStatus(); }} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Device Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Cpu className="mr-2 h-5 w-5 text-teal-500" />
            Hailo-8 Device Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {deviceStatus ? (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center">
                    {deviceStatus.online ? (
                      <Badge variant="outline" className="text-teal-600 border-teal-600 dark:text-teal-400 dark:border-teal-400">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Online
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-gray-400 border-gray-400">
                        <XCircle className="mr-1 h-3 w-3" />
                        Offline
                      </Badge>
                    )}
                  </div>
                  {deviceStatus.device && (
                    <p className="text-sm font-medium">{deviceStatus.device}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">Pi CPU Temp</p>
                <p className="text-2xl font-bold">{deviceStatus.temperature || '--'}°C</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">Power Usage</p>
                <p className="text-2xl font-bold">
                  {deviceStatus.power !== null && deviceStatus.power !== undefined 
                    ? `${deviceStatus.power.toFixed(2)}W` 
                    : '--W'}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">TOPS Usage</p>
                <p className="text-2xl font-bold">
                  {deviceStatus.tops !== null && deviceStatus.tops !== undefined 
                    ? `${deviceStatus.tops}/${deviceStatus.max_tops || 26}` 
                    : '--/26'}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">Utilization</p>
                <div className="flex items-center space-x-2">
                  <Progress value={deviceStatus.utilization || 0} className="flex-1" />
                  <span className="text-sm font-medium">{deviceStatus.utilization || 0}%</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Loading device status...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Model Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.entries({
          apollo: 'Master Coordinator',
          aquilo: 'Electrical Specialist',
          boreas: 'Refrigeration Expert',
          naiad: 'Flow Systems Analyst',
          vulcan: 'Mechanical Monitor',
          zephyrus: 'Airflow Controller',
          colossus: 'Pattern Aggregator',
          gaia: 'Safety Validator'
        }).map(([modelId, description]) => {
          const Icon = modelIcons[modelId as keyof typeof modelIcons];
          const colorClass = modelColors[modelId as keyof typeof modelColors];
          const model = models[modelId] || {};
          
          return (
            <Card key={modelId} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm">
                  <div className="flex items-center">
                    <Icon className={`mr-2 h-4 w-4 ${colorClass}`} />
                    {modelId.toUpperCase()}
                  </div>
                  {model.loaded ? (
                    <Badge variant="outline" className="text-teal-600 border-teal-600 dark:text-teal-400 dark:border-teal-400">
                      Loaded
                    </Badge>
                  ) : model.size ? (
                    <Badge variant="outline" className="text-gray-600 border-gray-400 dark:text-gray-400 dark:border-gray-500">
                      Ready
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-red-400 border-red-400">
                      Not Found
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  {description}
                </p>
                <div className="text-xs space-y-1">
                  <p>Size: {model.size !== null && model.size !== undefined ? `${model.size} MB` : '-- MB'}</p>
                  <p>Version: {model.version || 'v1.0'}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Inference Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="mr-2 h-5 w-5 text-teal-500" />
            Inference Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Inferences</p>
              <p className="text-2xl font-bold">{inferenceStats.total}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">Today</p>
              <p className="text-2xl font-bold">{inferenceStats.today}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg Time</p>
              <p className="text-2xl font-bold">{inferenceStats.avgTime}ms</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">Last Run</p>
              <p className="text-sm font-medium">
                {inferenceStats.lastRun ? new Date(inferenceStats.lastRun).toLocaleString() : 'Never'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Run Diagnosis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Activity className="mr-2 h-5 w-5 text-teal-500" />
              Run Diagnosis
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Multi-Stream Mode
              </label>
              <button
                onClick={() => setSimultaneousMode(!simultaneousMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  simultaneousMode ? 'bg-teal-500' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  simultaneousMode ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </CardTitle>
          <CardDescription>
            {simultaneousMode 
              ? 'Run all 8 models simultaneously using NPU multi-stream capability' 
              : 'Run each model sequentially for debugging'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <select
              className="flex-1 p-2 border rounded-lg dark:bg-gray-800"
              value={selectedEquipment || ''}
              onChange={(e) => setSelectedEquipment(e.target.value)}
              disabled={runningDiagnosis}
            >
              <option value="">Select Equipment</option>
              {equipment.map(eq => (
                <option key={eq.id} value={eq.id}>
                  {eq.location_name} - {eq.make} {eq.model}
                </option>
              ))}
            </select>
            <Button 
              onClick={runDiagnosis}
              disabled={!selectedEquipment || runningDiagnosis}
              className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700"
            >
              {runningDiagnosis ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Diagnosis
                </>
              )}
            </Button>
          </div>

          {diagnosticResults && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">Diagnosis Complete</p>
                  <p>Mode: {diagnosticResults.mode === 'simultaneous' ? '🚀 Multi-Stream Simultaneous' : '📊 Sequential'}</p>
                  <p>Total Time: {diagnosticResults.inferenceTimeMs}ms</p>
                  <p>Result: {diagnosticResults.final?.diagnosis || 'No issues detected'}</p>
                  <p>Consensus: {((diagnosticResults.final?.consensus ?? 0) * 100).toFixed(1)}%</p>
                  {diagnosticResults.mode === 'simultaneous' && diagnosticResults.models && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      All 8 models executed in parallel on Hailo-8 NPU
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
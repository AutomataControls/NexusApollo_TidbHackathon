'use client';

import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Search,
  Activity,
  Zap,
  Brain,
  AlertTriangle,
  TrendingUp,
  CheckCircle,
  Gauge,
  Wind,
  Droplets,
  Flame,
  Snowflake,
  Tornado,
  Mountain,
  Globe,
  Play,
  RefreshCw,
  Database,
  GitBranch,
  Sparkles,
  Target,
  Layers
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';

// Model configurations matching the diagnostic agent
const aiModels = [
  { id: 'APOLLO', name: 'APOLLO', icon: Brain, color: 'text-amber-500', description: 'Master Coordinator' },
  { id: 'AQUILO', name: 'AQUILO', icon: Wind, color: 'text-sky-500', description: 'Thermal Dynamics' },
  { id: 'BOREAS', name: 'BOREAS', icon: Snowflake, color: 'text-cyan-500', description: 'Pressure Analysis' },
  { id: 'NAIAD', name: 'NAIAD', icon: Droplets, color: 'text-blue-500', description: 'Humidity Control' },
  { id: 'VULCAN', name: 'VULCAN', icon: Flame, color: 'text-orange-500', description: 'Electrical Systems' },
  { id: 'ZEPHYRUS', name: 'ZEPHYRUS', icon: Tornado, color: 'text-purple-500', description: 'Airflow Patterns' },
  { id: 'COLOSSUS', name: 'COLOSSUS', icon: Mountain, color: 'text-gray-500', description: 'Energy Optimization' },
  { id: 'GAIA', name: 'GAIA', icon: Globe, color: 'text-emerald-500', description: 'Environmental Impact' }
];

// Workflow steps with detailed descriptions
const workflowSteps = [
  {
    id: 1,
    name: 'Data Ingestion',
    icon: Database,
    description: 'Collect & embed sensor data',
    details: 'Ingesting 21 sensor readings: temperatures, pressures, electrical, vibration. Converting to 1536-dim embeddings using OpenAI Ada-002.'
  },
  {
    id: 2,
    name: 'TiDB Vector Search',
    icon: Search,
    description: 'Find similar patterns',
    details: 'Searching TiDB for similar fault patterns using HNSW index. Comparing against 3,847 historical patterns with cosine similarity.'
  },
  {
    id: 3,
    name: 'AI Analysis',
    icon: Brain,
    description: 'Run 8 model inference',
    details: 'Triggering AQUILO, BOREAS, NAIAD, VULCAN, ZEPHYRUS → COLOSSUS (consensus) → GAIA (safety) → APOLLO (master).'
  },
  {
    id: 4,
    name: 'External Tools',
    icon: GitBranch,
    description: 'Query external APIs',
    details: 'Accessing weather API, manufacturer databases, warranty systems, and maintenance history for context.'
  },
  {
    id: 5,
    name: 'Solution Generation',
    icon: Sparkles,
    description: 'Generate recommendations',
    details: 'APOLLO synthesizes inputs from all models and TiDB matches to generate prioritized repair recommendations.'
  },
  {
    id: 6,
    name: 'Action Execution',
    icon: Target,
    description: 'Execute actions',
    details: 'Final actions: relay control, setpoint adjustments, maintenance scheduling, and alert generation.'
  }
];

export default function VectorSearchPage() {
  const [loading, setLoading] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<string>('1');
  const [equipment, setEquipment] = useState<any[]>([]);
  const [workflowActive, setWorkflowActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [workflowResults, setWorkflowResults] = useState<any>(null);
  const [vectorStats, setVectorStats] = useState<any>(null);
  const [patterns, setPatterns] = useState<any[]>([]);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [modelConfidence, setModelConfidence] = useState<any[]>([]);
  const [autoRun, setAutoRun] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [autoRunInterval, setAutoRunInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Load demo mode from localStorage
    const savedDemoMode = localStorage.getItem('demoMode') === 'true';
    setDemoMode(savedDemoMode);

    fetchEquipment();
    fetchVectorStats();
    initializeWebSocket();

    return () => {
      if (socket) socket.close();
      if (autoRunInterval) clearInterval(autoRunInterval);
    };
  }, []);

  // Listen for demo mode changes
  useEffect(() => {
    const handleDemoModeChange = (event: CustomEvent) => {
      const newDemoMode = event.detail;
      setDemoMode(newDemoMode);
    };

    window.addEventListener('demoModeChanged', handleDemoModeChange as any);

    return () => {
      window.removeEventListener('demoModeChanged', handleDemoModeChange as any);
    };
  }, []);

  // Re-fetch data when demo mode changes
  useEffect(() => {
    fetchVectorStats();
    fetchEquipment();
  }, [demoMode]);

  // Auto-run effect
  useEffect(() => {
    if (autoRun && selectedEquipment && !workflowActive) {
      // Run immediately when enabled
      runDiagnosticWorkflow();

      // Set up interval to run every 30 seconds
      const interval = setInterval(() => {
        if (!workflowActive) {
          runDiagnosticWorkflow();
        }
      }, 30000); // Run every 30 seconds

      setAutoRunInterval(interval);
    } else {
      // Clear interval when auto-run is disabled or conditions not met
      if (autoRunInterval) {
        clearInterval(autoRunInterval);
        setAutoRunInterval(null);
      }
    }

    return () => {
      if (autoRunInterval) {
        clearInterval(autoRunInterval);
      }
    };
  }, [autoRun, selectedEquipment]);

  const toggleDemoMode = () => {
    const newDemoMode = !demoMode;
    setDemoMode(newDemoMode);
    localStorage.setItem('demoMode', newDemoMode.toString());

    // Emit event to notify other components
    window.dispatchEvent(new CustomEvent('demoModeChanged', { detail: newDemoMode }));
  };

  const initializeWebSocket = () => {
    const token = localStorage.getItem('token');
    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8001', {
      auth: { token }
    });

    socketInstance.on('workflow-complete', (data) => {
      setWorkflowResults(data);
      setWorkflowActive(false);
      setCurrentStep(0);
    });

    socketInstance.on('workflow-error', (data) => {
      console.error('Workflow error:', data);
      setWorkflowActive(false);
      setCurrentStep(0);
    });

    setSocket(socketInstance);
  };

  const fetchEquipment = async () => {
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // Demo equipment
      const demoEquipment = [
        { id: 1, location_name: 'RTU-1', equipment_type: 'RTU' },
        { id: 2, location_name: 'Chiller-1', equipment_type: 'Chiller' },
        { id: 3, location_name: 'AHU-1', equipment_type: 'AHU' },
        { id: 4, location_name: 'Heat Pump-1', equipment_type: 'Heat Pump' },
        { id: 5, location_name: 'Boiler-1', equipment_type: 'Boiler' }
      ];
      setEquipment(demoEquipment);
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/equipment`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setEquipment(data);
    } catch (error) {
      console.error('Failed to fetch equipment:', error);
    }
  };

  const fetchVectorStats = async () => {
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // Demo stats
      setVectorStats({
        success: true,
        stats: {
          patterns: 128,
          embeddings: 42,
          inferences: 256,
          solutions: 64
        },
        dimensions: {
          sensor: 1536,
          model: 256
        },
        timestamp: new Date().toISOString()
      });
    } else {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vector/stats`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await response.json();
        setVectorStats(data);
      } catch (error) {
        console.error('Failed to fetch vector stats:', error);
      }
    }
  };

  const runDiagnosticWorkflow = async () => {
    if (!selectedEquipment) return;

    setLoading(true);
    setWorkflowActive(true);
    setCurrentStep(1);

    try {
      // Get current sensor data
      const sensorResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sensors/readings/${selectedEquipment}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const sensorData = await sensorResponse.json();

      // Get equipment details
      const selectedEquipmentData = equipment.find(eq => eq.id.toString() === selectedEquipment.toString());

      // Generate location data (could be enhanced with real geolocation)
      const location = {
        lat: 37.7749 + (Math.random() - 0.5) * 0.1,  // San Francisco area
        lng: -122.4194 + (Math.random() - 0.5) * 0.1,
        address: selectedEquipmentData?.location_name || 'Equipment Location'
      };

      // Generate weather data (could be enhanced with real weather API)
      const weatherData = {
        temperature: 68 + Math.random() * 20,
        humidity: 45 + Math.random() * 35,
        pressure: 29.92 + Math.random() * 0.5,
        windSpeed: Math.random() * 15,
        conditions: ['Clear', 'Partly Cloudy', 'Cloudy'][Math.floor(Math.random() * 3)]
      };

      // Store equipment test data in TiDB with contextual information
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vector/equipment/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          equipmentId: selectedEquipment,
          sensorData: sensorData[0] || {},
          location,
          weatherData,
          demo: demoMode,
          testResults: {
            initiatedBy: 'user',
            timestamp: new Date().toISOString()
          }
        })
      });

      // Execute workflow
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vector/diagnose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          equipmentId: selectedEquipment,
          sensorData: sensorData[0] || {},
          demo: demoMode  // Send demo flag
        })
      });

      const result = await response.json();

      // Simulate step progression
      for (let i = 2; i <= 6; i++) {
        await new Promise(resolve => setTimeout(resolve, 800));
        setCurrentStep(i);
      }

      setWorkflowResults(result.workflow);

      // Update visualizations
      if (result.workflow.steps.vectorSearch) {
        setPatterns(result.workflow.steps.vectorSearch.patterns || []);
        setHistoricalData(result.workflow.steps.vectorSearch.historical || []);
      }

      if (result.workflow.steps.aiAnalysis) {
        const models = result.workflow.steps.aiAnalysis.models;
        const confidenceData = Object.keys(models).map(model => ({
          model,
          confidence: models[model].confidence * 100,
          faultDetected: models[model].faultDetected
        }));
        setModelConfidence(confidenceData);
      }

    } catch (error) {
      console.error('Workflow failed:', error);
    } finally {
      setLoading(false);
      setWorkflowActive(false);
      setCurrentStep(0);
    }
  };

  const initializePatterns = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vector/init/patterns`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const result = await response.json();
      if (result.success) {
        fetchVectorStats();
      }
    } catch (error) {
      console.error('Failed to initialize patterns:', error);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">TiDB Vector Search</h1>
          <p className="text-muted-foreground">
            AI-powered diagnostic workflow with vector similarity search
          </p>
        </div>
        <button
          onClick={toggleDemoMode}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all ${
            demoMode
              ? 'bg-gradient-to-r from-orange-50 to-gray-50 dark:from-orange-950/20 dark:to-gray-900/20 border-orange-200/50 dark:border-orange-900/50 text-orange-600 dark:text-orange-400'
              : 'bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400'
          } hover:shadow-lg`}
        >
          <Layers className="h-4 w-4" />
          <span className="font-medium text-sm">Demo Mode</span>
          <div className={`w-10 h-5 rounded-full p-0.5 transition-colors ${
            demoMode ? 'bg-black dark:bg-black' : 'bg-gray-300 dark:bg-gray-600'
          }`}>
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
              demoMode ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </div>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fault Patterns</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {demoMode ? 3847 : (vectorStats?.stats?.patterns || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Historical fault patterns</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Embeddings</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {demoMode ? 128479 : (vectorStats?.stats?.embeddings || 0)}
            </div>
            <p className="text-xs text-muted-foreground">1536-dimensional vectors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Model Inferences</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {demoMode ? 42618 : (vectorStats?.stats?.inferences || 0)}
            </div>
            <p className="text-xs text-muted-foreground">8 AI models active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solutions</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {demoMode ? 892 : (vectorStats?.stats?.solutions || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Expert recommendations</p>
          </CardContent>
        </Card>
      </div>

      {/* Workflow Control */}
      <Card>
        <CardHeader>
          <CardTitle>Diagnostic Workflow</CardTitle>
          <CardDescription>
            Execute 6-step AI agent workflow with TiDB vector search
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Label>Select Equipment</Label>
              <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose equipment" />
                </SelectTrigger>
                <SelectContent>
                  {equipment.map((eq) => (
                    <SelectItem key={eq.id} value={eq.id.toString()}>
                      {eq.location_name} - {eq.equipment_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Label htmlFor="auto-run">Auto-run</Label>
              <Switch
                id="auto-run"
                checked={autoRun}
                onCheckedChange={setAutoRun}
                className="data-[state=checked]:bg-green-600"
              />
              {autoRun && (
                <span className="text-xs text-green-600 animate-pulse">
                  Every 30s
                </span>
              )}
            </div>

            <Button
              onClick={runDiagnosticWorkflow}
              disabled={loading || workflowActive}
              className="min-w-[150px]"
            >
              {workflowActive ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Workflow
                </>
              )}
            </Button>

            {vectorStats?.stats?.patterns === 0 && (
              <Button
                onClick={initializePatterns}
                variant="outline"
              >
                Initialize Patterns
              </Button>
            )}
          </div>

          {/* Workflow Steps Progress */}
          <div className="grid grid-cols-6 gap-2">
            {workflowSteps.map((step) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isComplete = currentStep > step.id;

              return (
                <div
                  key={step.id}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    isActive
                      ? 'border-primary bg-primary/10'
                      : isComplete
                        ? 'border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-900/10'
                        : 'border-muted'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-2">
                    <Icon className={`h-6 w-6 ${
                      isActive
                        ? 'text-primary animate-pulse'
                        : isComplete
                          ? 'text-sky-300'
                          : 'text-muted-foreground'
                    }`} />
                    <span className="text-xs font-medium text-center">{step.name}</span>
                    {isActive && (
                      <p className="text-xs text-muted-foreground mt-1 text-center">
                        {step.details}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Results Tabs */}
      {workflowResults && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="patterns">Patterns</TabsTrigger>
            <TabsTrigger value="models">AI Models</TabsTrigger>
            <TabsTrigger value="solutions">Solutions</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
            <TabsTrigger value="correlation">Correlation</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Workflow Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="text-2xl font-bold">{workflowResults.duration}ms</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Faults Detected</p>
                    <p className="text-2xl font-bold text-orange-500">
                      {workflowResults.steps?.aiAnalysis?.faults?.length || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Confidence</p>
                    <p className="text-2xl font-bold">
                      {((workflowResults.steps?.aiAnalysis?.masterDiagnosis?.confidence || 0) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Actions</p>
                    <p className="text-2xl font-bold text-green-500">
                      {workflowResults.steps?.actions?.actions?.length || 0}
                    </p>
                  </div>
                </div>

                <Separator className="my-4" />

                <div>
                  <h4 className="font-semibold mb-2">Master Diagnosis (APOLLO)</h4>
                  <Alert>
                    <Brain className="h-4 w-4" />
                    <AlertDescription>
                      {workflowResults.steps?.aiAnalysis?.masterDiagnosis?.diagnosis || 'No diagnosis available'}
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patterns" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Similar Fault Patterns</CardTitle>
                <CardDescription>
                  Vector similarity search results from TiDB
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {patterns.map((pattern, idx) => (
                      <div key={idx} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{pattern.pattern_name}</p>
                            <p className="text-sm text-muted-foreground">
                              Model: {pattern.specialist_model} | Severity: {pattern.severity}/5
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant={pattern.distance < 0.3 ? "destructive" : "secondary"}>
                              Distance: {pattern.distance?.toFixed(3)}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              Cost: ${pattern.cost_impact}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="models" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI Model Analysis</CardTitle>
                <CardDescription>
                  8 specialized models running in parallel
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {aiModels.map((model) => {
                    const Icon = model.icon;
                    const result = workflowResults.steps?.aiAnalysis?.models?.[model.id];

                    return (
                      <Card key={model.id}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <Icon className={`h-5 w-5 ${model.color}`} />
                            {result?.faultDetected && (
                              <Badge variant="destructive" className="text-xs">
                                Fault
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="font-semibold">{model.name}</p>
                          <p className="text-xs text-muted-foreground">{model.description}</p>
                          <div className="mt-2">
                            <Progress
                              value={(result?.confidence || 0) * 100}
                              className="h-2"
                            />
                            <p className="text-xs mt-1">
                              {((result?.confidence || 0) * 100).toFixed(1)}% confidence
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="solutions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Generated Solutions</CardTitle>
                <CardDescription>
                  Recommendations from vector knowledge base
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {workflowResults.steps?.solutions?.solutions?.map((solution: any, idx: number) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{solution.fault}</h4>
                        <Badge>{solution.model}</Badge>
                      </div>
                      {solution.recommendations?.map((rec: any, recIdx: number) => (
                        <div key={recIdx} className="ml-4 mt-2 p-2 bg-muted/50 rounded">
                          <p className="text-sm">{rec.solution}</p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                            <span>Success: {rec.successRate}%</span>
                            <span>Time: {rec.repairTime}h</span>
                            <span>Cost: ${rec.cost}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Executed Actions</CardTitle>
                <CardDescription>
                  Automated responses and maintenance requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {workflowResults.steps?.actions?.actions?.map((action: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {action.type === 'maintenance_request' && <Gauge className="h-5 w-5 text-blue-500" />}
                        {action.type === 'alert' && <AlertTriangle className="h-5 w-5 text-orange-500" />}
                        {action.type === 'energy_adjustment' && <Zap className="h-5 w-5 text-yellow-500" />}
                        <div>
                          <p className="font-medium capitalize">{action.type.replace('_', ' ')}</p>
                          <p className="text-sm text-muted-foreground">{action.description || action.message}</p>
                        </div>
                      </div>
                      <Badge variant={action.status === 'scheduled' ? 'default' : 'secondary'}>
                        {action.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="correlation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI Models × TiDB Cross-Correlation</CardTitle>
                <CardDescription>
                  Interactive visualization of diagnostic correlations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Radar Chart - AI Model Confidence vs Vector Distance */}
                  <div>
                    <h4 className="text-sm font-semibold mb-4">Model Confidence vs Pattern Similarity</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart data={aiModels.map(model => {
                        const modelResult = workflowResults?.steps?.aiAnalysis?.models?.[model.id];
                        const avgDistance = patterns.length > 0
                          ? patterns.reduce((sum, p) => sum + (p.distance || 0), 0) / patterns.length
                          : 0;
                        return {
                          model: model.name,
                          confidence: (modelResult?.confidence || 0) * 100,
                          similarity: Math.max(0, (1 - avgDistance) * 100),
                          threshold: 75
                        };
                      })}>
                        <PolarGrid stroke="#e5e7eb" />
                        <PolarAngleAxis dataKey="model" tick={{ fontSize: 10 }} />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <Radar
                          name="AI Confidence"
                          dataKey="confidence"
                          stroke="#f97316"
                          fill="#fed7aa"
                          fillOpacity={0.6}
                        />
                        <Radar
                          name="TiDB Similarity"
                          dataKey="similarity"
                          stroke="#0ea5e9"
                          fill="#bae6fd"
                          fillOpacity={0.6}
                        />
                        <Radar
                          name="Threshold"
                          dataKey="threshold"
                          stroke="#dc2626"
                          strokeDasharray="5 5"
                          fill="transparent"
                        />
                        <Legend />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Correlation Matrix */}
                  <div>
                    <h4 className="text-sm font-semibold mb-4">Fault Pattern Correlation Matrix</h4>
                    <div className="grid grid-cols-4 gap-1">
                      {patterns.slice(0, 16).map((pattern, idx) => {
                        const intensity = 1 - (pattern.distance || 0);
                        const severity = pattern.severity || 0;
                        return (
                          <div
                            key={idx}
                            className="relative group cursor-pointer transition-transform hover:scale-110"
                            style={{
                              backgroundColor: `rgba(251, 146, 60, ${intensity})`,
                              aspectRatio: '1/1'
                            }}
                          >
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-xs font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                S{severity}
                              </span>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {pattern.pattern_name?.slice(0, 20)}...
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">Low Match</span>
                      <div className="flex-1 mx-2 h-2 bg-gradient-to-r from-orange-100 to-orange-500 rounded" />
                      <span className="text-xs text-muted-foreground">High Match</span>
                    </div>
                  </div>
                </div>

                {/* Time Series Correlation */}
                <Separator className="my-6" />
                <div>
                  <h4 className="text-sm font-semibold mb-4">Temporal Correlation Analysis</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={historicalData.slice(0, 20).map((item, idx) => ({
                      time: `T-${20 - idx}`,
                      anomaly: item.anomaly_score ? item.anomaly_score * 100 : Math.random() * 100,
                      confidence: modelConfidence[idx % modelConfidence.length]?.confidence || Math.random() * 100,
                      vectorMatch: (1 - (item.distance || Math.random())) * 100
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="anomaly"
                        stackId="1"
                        stroke="#ef4444"
                        fill="#fca5a5"
                        fillOpacity={0.6}
                        name="Anomaly Score"
                      />
                      <Area
                        type="monotone"
                        dataKey="confidence"
                        stackId="2"
                        stroke="#f97316"
                        fill="#fed7aa"
                        fillOpacity={0.6}
                        name="AI Confidence"
                      />
                      <Area
                        type="monotone"
                        dataKey="vectorMatch"
                        stackId="3"
                        stroke="#0ea5e9"
                        fill="#bae6fd"
                        fillOpacity={0.6}
                        name="Vector Match"
                      />
                      <Legend />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Interactive Correlation Score */}
                <Separator className="my-6" />
                <div className="bg-gradient-to-r from-orange-50 to-sky-50 dark:from-orange-950/20 dark:to-sky-950/20 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-semibold">Overall Correlation Score</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Cross-correlation between 8 AI models and TiDB vector patterns
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-sky-500">
                        {(
                          ((workflowResults?.steps?.aiAnalysis?.masterDiagnosis?.confidence || 0) * 100 +
                          (patterns.length > 0 ? (1 - patterns[0]?.distance || 0) * 100 : 0)) / 2
                        ).toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Combined confidence metric
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="text-center">
                      <Sparkles className="h-8 w-8 mx-auto text-orange-500 mb-2" />
                      <p className="text-sm font-medium">Pattern Matches</p>
                      <p className="text-2xl font-bold">{patterns.length}</p>
                    </div>
                    <div className="text-center">
                      <Brain className="h-8 w-8 mx-auto text-sky-500 mb-2" />
                      <p className="text-sm font-medium">Models Agree</p>
                      <p className="text-2xl font-bold">
                        {Object.values(workflowResults?.steps?.aiAnalysis?.models || {}).filter((m: any) => m.faultDetected).length}/8
                      </p>
                    </div>
                    <div className="text-center">
                      <Target className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                      <p className="text-sm font-medium">Accuracy</p>
                      <p className="text-2xl font-bold">
                        {((workflowResults?.steps?.aiAnalysis?.masterDiagnosis?.confidence || 0) * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
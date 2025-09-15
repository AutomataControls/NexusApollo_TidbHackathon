'use client';

import { useState, useEffect } from 'react';
import { 
  FileText,
  Download,
  Calendar,
  Clock,
  Filter,
  Settings,
  Play,
  Save,
  Send,
  Mail,
  Printer,
  FileSpreadsheet,
  FileText as FilePdf,
  Eye,
  ChevronRight,
  Zap,
  AlertTriangle,
  Wrench,
  TrendingUp,
  DollarSign,
  Shield,
  Activity,
  Cpu,
  ThermometerSun,
  Leaf,
  BarChart3,
  Bell,
  Timer,
  Target,
  RefreshCw,
  AlertCircle,
  Trash
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
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

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: string;
  parameters: string[];
  formats: string[];
}

interface SavedReport {
  id: number;
  name: string;
  template: string;
  parameters: any;
  data: any;
  created_at: string;
  created_by: string;
}

interface ScheduledReport {
  id: number;
  name: string;
  template: string;
  frequency: string;
  time: string;
  recipients: string;
  format: string;
  enabled: boolean;
  next_run: string;
}

interface Equipment {
  id: number;
  location_name: string;
  equipment_type: string;
}

interface Customer {
  id: number;
  company_name: string;
}

const reportTemplates: ReportTemplate[] = [
  {
    id: 'energy-summary',
    name: 'Energy Usage Summary',
    description: 'Comprehensive energy consumption and cost analysis',
    icon: Zap,
    category: 'Energy',
    parameters: ['date_range', 'customer', 'equipment'],
    formats: ['html', 'pdf', 'excel', 'csv', 'json']
  },
  {
    id: 'fault-analysis',
    name: 'Fault Analysis',
    description: 'Detailed fault patterns and root cause analysis',
    icon: AlertTriangle,
    category: 'Diagnostics',
    parameters: ['date_range', 'customer', 'equipment'],
    formats: ['html', 'pdf', 'excel', 'json']
  },
  {
    id: 'maintenance-history',
    name: 'Maintenance History',
    description: 'Complete maintenance records and service history',
    icon: Wrench,
    category: 'Maintenance',
    parameters: ['customer', 'equipment'],
    formats: ['html', 'pdf', 'excel', 'csv']
  },
  {
    id: 'efficiency-trends',
    name: 'Efficiency Trends',
    description: 'System efficiency analysis and degradation tracking',
    icon: TrendingUp,
    category: 'Performance',
    parameters: ['date_range', 'equipment'],
    formats: ['html', 'pdf', 'excel', 'json']
  },
  {
    id: 'cost-analysis',
    name: 'Cost Analysis',
    description: 'Detailed operational cost breakdown and projections',
    icon: DollarSign,
    category: 'Financial',
    parameters: ['date_range', 'customer', 'equipment'],
    formats: ['html', 'pdf', 'excel']
  },
  {
    id: 'compliance-report',
    name: 'Compliance Report',
    description: 'Regulatory compliance and certification status',
    icon: Shield,
    category: 'Compliance',
    parameters: ['customer', 'equipment'],
    formats: ['html', 'pdf']
  },
  {
    id: 'executive-summary',
    name: 'Executive Summary',
    description: 'High-level overview for management',
    icon: BarChart3,
    category: 'Executive',
    parameters: ['date_range', 'customer'],
    formats: ['html', 'pdf']
  },
  {
    id: 'sensor-diagnostics',
    name: 'Sensor Diagnostics',
    description: 'Sensor health and calibration status',
    icon: Activity,
    category: 'Diagnostics',
    parameters: ['equipment'],
    formats: ['html', 'pdf', 'json']
  },
  {
    id: 'apollo-predictions',
    name: 'Apollo AI Predictions',
    description: 'AI-generated fault predictions and insights',
    icon: Cpu,
    category: 'AI Analytics',
    parameters: ['date_range', 'equipment'],
    formats: ['html', 'pdf', 'json']
  },
  {
    id: 'power-quality',
    name: 'Power Quality Report',
    description: 'Electrical parameters and power quality metrics',
    icon: Zap,
    category: 'Energy',
    parameters: ['date_range', 'equipment'],
    formats: ['html', 'pdf', 'excel']
  },
  {
    id: 'environmental-impact',
    name: 'Environmental Impact',
    description: 'Carbon footprint and environmental metrics',
    icon: Leaf,
    category: 'Sustainability',
    parameters: ['date_range', 'customer'],
    formats: ['html', 'pdf']
  },
  {
    id: 'equipment-lifecycle',
    name: 'Equipment Lifecycle',
    description: 'Equipment age, lifecycle status, and replacement planning',
    icon: Timer,
    category: 'Maintenance',
    parameters: ['equipment'],
    formats: ['html', 'pdf', 'excel']
  },
  {
    id: 'comparative-analysis',
    name: 'Comparative Analysis',
    description: 'Compare performance across multiple equipment',
    icon: BarChart3,
    category: 'Performance',
    parameters: ['customer'],
    formats: ['html', 'pdf', 'excel']
  },
  {
    id: 'alarm-history',
    name: 'Alarm History',
    description: 'Historical alarm data and patterns',
    icon: Bell,
    category: 'Operations',
    parameters: ['date_range', 'equipment'],
    formats: ['html', 'pdf', 'excel', 'csv']
  },
  {
    id: 'runtime-analysis',
    name: 'Runtime Analysis',
    description: 'Equipment runtime hours and utilization',
    icon: Timer,
    category: 'Operations',
    parameters: ['date_range', 'equipment'],
    formats: ['html', 'pdf', 'excel']
  },
  {
    id: 'temperature-profile',
    name: 'Temperature Profile',
    description: 'Temperature trends and thermal performance',
    icon: ThermometerSun,
    category: 'Performance',
    parameters: ['date_range', 'equipment'],
    formats: ['html', 'pdf', 'json']
  }
];

const categories = [...new Set(reportTemplates.map(t => t.category))];

export default function ReportsPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const { toast } = useToast();

  // Report parameters
  const [parameters, setParameters] = useState({
    start_date: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    customer_id: 'all',
    equipment_id: 'all',
    format: 'pdf'
  });

  // Schedule parameters
  const [scheduleParams, setScheduleParams] = useState({
    name: '',
    frequency: 'weekly',
    time: '08:00',
    dayOfWeek: '1',
    dayOfMonth: '1',
    recipients: '',
    format: 'pdf'
  });

  useEffect(() => {
    // Check demo mode
    const isDemoMode = localStorage.getItem('demoMode') === 'true';
    setDemoMode(isDemoMode);

    fetchInitialData();

    // Listen for demo mode changes
    const handleDemoModeChange = (event: CustomEvent) => {
      setDemoMode(event.detail);
      fetchInitialData();
    };

    window.addEventListener('demoModeChanged', handleDemoModeChange as any);
    return () => {
      window.removeEventListener('demoModeChanged', handleDemoModeChange as any);
    };
  }, []);

  const fetchInitialData = async () => {
    try {
      await Promise.all([
        fetchEquipment(),
        fetchCustomers(),
        fetchSavedReports(),
        fetchScheduledReports()
      ]);
    } finally {
      setLoading(false);
    }
  };

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
    } else {
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
    }
  };

  const fetchCustomers = async () => {
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // Demo customers
      const demoCustomers = [
        { id: 1, company_name: 'Demo Facility A' },
        { id: 2, company_name: 'Demo Facility B' },
        { id: 3, company_name: 'Demo Facility C' }
      ];
      setCustomers(demoCustomers);
    } else {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await response.json();
        setCustomers(data);
      } catch (error) {
        console.error('Failed to fetch customers:', error);
      }
    }
  };

  const fetchSavedReports = async () => {
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // Demo saved reports
      const demoSavedReports: SavedReport[] = [
        {
          id: 1,
          name: 'Energy Usage Summary - Nov 2024',
          template: 'energy-summary',
          parameters: {},
          data: { totalConsumption: 12547, avgDaily: 418, peakDemand: 85 },
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          created_by: 'Demo User'
        },
        {
          id: 2,
          name: 'Monthly Fault Analysis',
          template: 'fault-analysis',
          parameters: {},
          data: { totalFaults: 23, criticalFaults: 2, resolvedFaults: 21 },
          created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          created_by: 'Demo User'
        },
        {
          id: 3,
          name: 'Executive Summary Q4 2024',
          template: 'executive-summary',
          parameters: {},
          data: { efficiency: 87.5, uptime: 99.2, costSavings: 15420 },
          created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          created_by: 'Demo Manager'
        }
      ];
      setSavedReports(demoSavedReports);
    } else {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/saved`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await response.json();
        setSavedReports(data);
      } catch (error) {
        console.error('Failed to fetch saved reports:', error);
      }
    }
  };

  const fetchScheduledReports = async () => {
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // Demo scheduled reports
      const demoScheduledReports: ScheduledReport[] = [
        {
          id: 1,
          name: 'Weekly Energy Report',
          template: 'energy-summary',
          frequency: 'weekly',
          time: '08:00',
          recipients: 'manager@demo.com, operations@demo.com',
          format: 'pdf',
          enabled: true,
          next_run: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 2,
          name: 'Monthly Maintenance Report',
          template: 'maintenance-history',
          frequency: 'monthly',
          time: '09:00',
          recipients: 'maintenance@demo.com',
          format: 'excel',
          enabled: true,
          next_run: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 3,
          name: 'Daily Alarm Summary',
          template: 'alarm-history',
          frequency: 'daily',
          time: '17:00',
          recipients: 'ops@demo.com',
          format: 'csv',
          enabled: false,
          next_run: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];
      setScheduledReports(demoScheduledReports);
    } else {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/schedules`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await response.json();
        setScheduledReports(data);
      } catch (error) {
        console.error('Failed to fetch scheduled reports:', error);
      }
    }
  };

  const generateReport = async (format: string = parameters.format, save: boolean = false) => {
    if (!selectedTemplate) return;
    
    setGenerating(true);
    try {
      const params = new URLSearchParams({
        template: selectedTemplate.id,
        format: format,
        ...Object.entries(parameters).reduce((acc, [key, value]) => {
          if (value && key !== 'format' && value !== 'all' && value !== 'select') {
            acc[key] = value;
          }
          return acc;
        }, {} as any)
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/reports/generate?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (format === 'json') {
        const data = await response.json();
        setPreviewData(data);
        setIsPreviewDialogOpen(true);
        
        if (save) {
          await saveReport(data);
        }
      } else {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedTemplate.id}-${Date.now()}.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
      }

      toast({
        title: 'Success',
        description: `Report ${save ? 'saved' : 'generated'} successfully`
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate report',
        variant: 'destructive'
      });
    } finally {
      setGenerating(false);
    }
  };

  const saveReport = async (data: any) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: `${selectedTemplate?.name} - ${format(new Date(), 'MMM dd, yyyy')}`,
          template: selectedTemplate?.id,
          parameters,
          data
        })
      });
      
      await fetchSavedReports();
    } catch (error) {
      console.error('Failed to save report:', error);
    }
  };

  const scheduleReport = async () => {
    if (!selectedTemplate) return;
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...scheduleParams,
          template: selectedTemplate.id,
          parameters
        })
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Report scheduled successfully'
        });
        setIsScheduleDialogOpen(false);
        await fetchScheduledReports();
      } else {
        throw new Error('Failed to schedule report');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to schedule report',
        variant: 'destructive'
      });
    }
  };

  const emailReport = async () => {
    if (!selectedTemplate) return;
    
    setSendingEmail(true);
    try {
      const allRecipients = emailRecipients + (emailRecipients ? ',' : '') + (process.env.NEXT_PUBLIC_DEFAULT_RECIPIENT || 'DevOps@AutomataNexus.com');
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          template: selectedTemplate.id,
          recipients: allRecipients,
          format: parameters.format,
          parameters
        })
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Report sent successfully'
        });
        setIsEmailDialogOpen(false);
        setEmailRecipients('');
      } else {
        throw new Error('Failed to send report');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send report',
        variant: 'destructive'
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const deleteSchedule = async (id: number) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/schedule/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Schedule removed successfully'
        });
        await fetchScheduledReports();
      } else {
        throw new Error('Failed to delete schedule');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove schedule',
        variant: 'destructive'
      });
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Energy': return Zap;
      case 'Diagnostics': return Activity;
      case 'Maintenance': return Wrench;
      case 'Performance': return TrendingUp;
      case 'Financial': return DollarSign;
      case 'Compliance': return Shield;
      case 'Executive': return BarChart3;
      case 'AI Analytics': return Cpu;
      case 'Sustainability': return Leaf;
      case 'Operations': return Settings;
      default: return FileText;
    }
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
            Reports & Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate comprehensive reports and schedule automated delivery
          </p>
        </div>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="templates">Report Templates</TabsTrigger>
          <TabsTrigger value="saved">Saved Reports</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled Reports</TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Template List */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Available Reports</CardTitle>
                  <CardDescription>
                    Select a report template to configure and generate
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-6">
                      {categories.map(category => {
                        const CategoryIcon = getCategoryIcon(category);
                        const templates = reportTemplates.filter(t => t.category === category);
                        
                        return (
                          <div key={category}>
                            <div className="flex items-center gap-2 mb-3">
                              <CategoryIcon className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                              <h3 className="font-semibold">{category}</h3>
                            </div>
                            <div className="grid gap-2">
                              {templates.map(template => {
                                const Icon = template.icon;
                                const isSelected = selectedTemplate?.id === template.id;
                                
                                return (
                                  <div
                                    key={template.id}
                                    onClick={() => setSelectedTemplate(template)}
                                    className={`p-4 rounded-lg border cursor-pointer transition-all hover-lift ${
                                      isSelected 
                                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' 
                                        : 'border-border hover:border-teal-300'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-start gap-3">
                                        <Icon className="h-5 w-5 text-teal-600 dark:text-teal-400 mt-0.5" />
                                        <div>
                                          <div className="font-medium">{template.name}</div>
                                          <div className="text-sm text-muted-foreground">
                                            {template.description}
                                          </div>
                                        </div>
                                      </div>
                                      {isSelected && (
                                        <ChevronRight className="h-5 w-5 text-teal-600" />
                                      )}
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                      {template.formats.map(format => (
                                        <Badge key={format} variant="secondary" className="text-xs">
                                          {format.toUpperCase()}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Configuration Panel */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Report Configuration</CardTitle>
                  <CardDescription>
                    {selectedTemplate ? selectedTemplate.name : 'Select a report template'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedTemplate ? (
                    <div className="space-y-4">
                      {selectedTemplate.parameters.includes('date_range') && (
                        <div className="space-y-2">
                          <Label>Date Range</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              type="date"
                              value={parameters.start_date}
                              onChange={(e) => setParameters({...parameters, start_date: e.target.value})}
                            />
                            <Input
                              type="date"
                              value={parameters.end_date}
                              onChange={(e) => setParameters({...parameters, end_date: e.target.value})}
                            />
                          </div>
                        </div>
                      )}

                      {selectedTemplate.parameters.includes('customer') && (
                        <div className="space-y-2">
                          <Label>Customer (Optional)</Label>
                          <Select
                            value={parameters.customer_id}
                            onValueChange={(value) => setParameters({...parameters, customer_id: value})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="All customers" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Customers</SelectItem>
                              {customers.map(customer => (
                                <SelectItem key={customer.id} value={customer.id.toString()}>
                                  {customer.company_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {selectedTemplate.parameters.includes('equipment') && (
                        <div className="space-y-2">
                          <Label>Equipment {selectedTemplate.parameters.includes('customer') ? '(Optional)' : ''}</Label>
                          <Select
                            value={parameters.equipment_id}
                            onValueChange={(value) => setParameters({...parameters, equipment_id: value})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select equipment" />
                            </SelectTrigger>
                            <SelectContent>
                              {!selectedTemplate.parameters.includes('customer') && (
                                <SelectItem value="select">Select Equipment</SelectItem>
                              )}
                              {selectedTemplate.parameters.includes('customer') && (
                                <SelectItem value="all">All Equipment</SelectItem>
                              )}
                              {equipment.map(eq => (
                                <SelectItem key={eq.id} value={eq.id.toString()}>
                                  {eq.location_name} - {eq.equipment_type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Output Format</Label>
                        <RadioGroup
                          value={parameters.format}
                          onValueChange={(value) => setParameters({...parameters, format: value})}
                        >
                          {selectedTemplate.formats.map(format => (
                            <div key={format} className="flex items-center space-x-2">
                              <RadioGroupItem 
                                value={format} 
                                className="border-gray-400 text-black data-[state=checked]:border-black data-[state=checked]:bg-black"
                              />
                              <Label className="flex items-center gap-2 cursor-pointer">
                                {format === 'html' && <FileText className="h-4 w-4" />}
                                {format === 'pdf' && <FilePdf className="h-4 w-4" />}
                                {format === 'excel' && <FileSpreadsheet className="h-4 w-4" />}
                                {format === 'csv' && <FileText className="h-4 w-4" />}
                                {format === 'json' && <FileText className="h-4 w-4" />}
                                {format.toUpperCase()}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <Button
                          className="w-full btn-primary"
                          onClick={() => generateReport()}
                          disabled={generating}
                        >
                          {generating ? (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Download className="mr-2 h-4 w-4" />
                              Generate Report
                            </>
                          )}
                        </Button>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            onClick={() => generateReport('json', true)}
                            disabled={generating}
                          >
                            <Save className="mr-2 h-4 w-4" />
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setIsScheduleDialogOpen(true)}
                          >
                            <Clock className="mr-2 h-4 w-4" />
                            Schedule
                          </Button>
                        </div>
                        
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setIsEmailDialogOpen(true)}
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Email Report
                        </Button>
                        
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => generateReport('json', false)}
                          disabled={generating}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Preview
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Select a report template to configure generation options
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Saved Reports Tab */}
        <TabsContent value="saved">
          <Card>
            <CardHeader>
              <CardTitle>Saved Reports</CardTitle>
              <CardDescription>
                Previously generated and saved reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              {savedReports.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No saved reports found. Generate and save a report to see it here.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {savedReports.map(report => (
                    <div key={report.id} className="p-4 border rounded-lg hover-lift">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{report.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            Template: {reportTemplates.find(t => t.id === report.template)?.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Created {format(new Date(report.created_at), 'MMM dd, yyyy HH:mm')}
                            {report.created_by && ` by ${report.created_by}`}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPreviewData(report.data);
                            setIsPreviewDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scheduled Reports Tab */}
        <TabsContent value="scheduled">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Reports</CardTitle>
              <CardDescription>
                Automated report generation and delivery
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scheduledReports.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No scheduled reports found. Schedule a report to automate generation.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {scheduledReports.map(schedule => (
                    <div key={schedule.id} className="p-4 border rounded-lg hover-lift">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">{schedule.name}</h4>
                            {schedule.enabled ? (
                              <Badge className="bg-green-100 text-green-700">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Paused</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Template: {reportTemplates.find(t => t.id === schedule.template)?.name}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>Frequency: {schedule.frequency}</span>
                            <span>Time: {schedule.time}</span>
                            <span>Format: {schedule.format.toUpperCase()}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Recipients: {schedule.recipients}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteSchedule(schedule.id)}
                        >
                          <Trash className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Schedule Dialog */}
      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Report</DialogTitle>
            <DialogDescription>
              Set up automatic report generation and delivery
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Report Name</Label>
              <Input
                value={scheduleParams.name}
                onChange={(e) => setScheduleParams({...scheduleParams, name: e.target.value})}
                placeholder="e.g., Weekly Energy Report"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={scheduleParams.frequency}
                  onValueChange={(value) => setScheduleParams({...scheduleParams, frequency: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Time</Label>
                <Input
                  type="time"
                  value={scheduleParams.time}
                  onChange={(e) => setScheduleParams({...scheduleParams, time: e.target.value})}
                />
              </div>
            </div>

            {scheduleParams.frequency === 'weekly' && (
              <div className="space-y-2">
                <Label>Day of Week</Label>
                <Select
                  value={scheduleParams.dayOfWeek}
                  onValueChange={(value) => setScheduleParams({...scheduleParams, dayOfWeek: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Monday</SelectItem>
                    <SelectItem value="2">Tuesday</SelectItem>
                    <SelectItem value="3">Wednesday</SelectItem>
                    <SelectItem value="4">Thursday</SelectItem>
                    <SelectItem value="5">Friday</SelectItem>
                    <SelectItem value="6">Saturday</SelectItem>
                    <SelectItem value="0">Sunday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {scheduleParams.frequency === 'monthly' && (
              <div className="space-y-2">
                <Label>Day of Month</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={scheduleParams.dayOfMonth}
                  onChange={(e) => setScheduleParams({...scheduleParams, dayOfMonth: e.target.value})}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Recipients (comma-separated emails)</Label>
              <Input
                value={scheduleParams.recipients}
                onChange={(e) => setScheduleParams({...scheduleParams, recipients: e.target.value})}
                placeholder="user1@example.com, user2@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Format</Label>
              <Select
                value={scheduleParams.format}
                onValueChange={(value) => setScheduleParams({...scheduleParams, format: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={scheduleReport} className="btn-primary">
              Schedule Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Report Preview</DialogTitle>
            <DialogDescription>
              {previewData?.reportType || 'Report Data'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <div className="space-y-4">
              {previewData && (
                <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">
                  {JSON.stringify(previewData, null, 2)}
                </pre>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={() => generateReport('pdf')} className="btn-primary">
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email Report</DialogTitle>
            <DialogDescription>
              Send this report via email. A copy will always be sent to DevOps@AutomataNexus.com
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Additional Recipients (comma-separated)</Label>
              <Input
                value={emailRecipients}
                onChange={(e) => setEmailRecipients(e.target.value)}
                placeholder="user@example.com, manager@company.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Report Format</Label>
              <RadioGroup
                value={parameters.format}
                onValueChange={(value) => setParameters({...parameters, format: value})}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem 
                    value="html" 
                    className="border-gray-400 text-black data-[state=checked]:border-black data-[state=checked]:bg-black"
                  />
                  <Label>HTML (Best for viewing)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem 
                    value="pdf" 
                    className="border-gray-400 text-black data-[state=checked]:border-black data-[state=checked]:bg-black"
                  />
                  <Label>PDF (Best for printing)</Label>
                </div>
              </RadioGroup>
            </div>
            
            <Alert>
              <AlertDescription>
                The report will be sent to:
                <ul className="list-disc list-inside mt-2 text-sm">
                  <li>DevOps@AutomataNexus.com (default)</li>
                  {emailRecipients && emailRecipients.split(',').map((email, i) => (
                    <li key={i}>{email.trim()}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={emailReport} 
              className="btn-primary"
              disabled={sendingEmail}
            >
              {sendingEmail ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Report
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { 
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Search,
  Volume2,
  VolumeX,
  Download,
  RefreshCw,
  ChevronRight,
  Calendar,
  User,
  Shield,
  Zap,
  ThermometerSun,
  Wind,
  Gauge,
  Activity,
  MessageSquare
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { format, formatDistanceToNow } from 'date-fns';
import io, { Socket } from 'socket.io-client';

interface Alarm {
  id: number;
  equipment_id: number;
  equipment_name: string;
  customer_name: string;
  type: string;
  source: string;
  value: number;
  severity: number;
  timestamp: string;
  acknowledged: boolean;
  acknowledged_by: string;
  acknowledged_at: string;
  resolved: boolean;
  resolved_at: string;
  notes: string;
}

interface AlarmStats {
  active_count: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  unacknowledged_count: number;
  today_count: number;
  total_count: number;
}

interface Equipment {
  id: number;
  location_name: string;
  equipment_type: string;
}

const CHART_COLORS = {
  critical: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  resolved: '#10b981'
};

const alarmTypes: Record<string, { label: string; icon: any; color: string }> = {
  'temperature_high': { label: 'High Temperature', icon: ThermometerSun, color: 'text-red-500' },
  'temperature_low': { label: 'Low Temperature', icon: ThermometerSun, color: 'text-blue-500' },
  'pressure_high': { label: 'High Pressure', icon: Gauge, color: 'text-red-500' },
  'pressure_low': { label: 'Low Pressure', icon: Gauge, color: 'text-amber-500' },
  'flow_low': { label: 'Low Flow', icon: Wind, color: 'text-amber-500' },
  'power_failure': { label: 'Power Failure', icon: Zap, color: 'text-red-600' },
  'sensor_fault': { label: 'Sensor Fault', icon: Activity, color: 'text-orange-500' },
  'efficiency_low': { label: 'Low Efficiency', icon: Activity, color: 'text-amber-600' },
  'maintenance_due': { label: 'Maintenance Due', icon: Shield, color: 'text-blue-600' }
};

export default function AlarmsPage() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [stats, setStats] = useState<AlarmStats | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedAlarm, setSelectedAlarm] = useState<Alarm | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [acknowledgeNotes, setAcknowledgeNotes] = useState('');
  const [resolveNotes, setResolveNotes] = useState('');
  const { toast } = useToast();

  // Filters
  const [statusFilter, setStatusFilter] = useState('active');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [equipmentFilter, setEquipmentFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchEquipment();
    fetchAlarms();
    fetchStats();
    
    // Setup WebSocket connection
    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8001');
    
    socketInstance.on('connect', () => {
      console.log('Connected to alarm socket');
    });
    
    socketInstance.on('alarm', (alarm: Alarm) => {
      handleNewAlarm(alarm);
    });
    
    socketInstance.on('alarm-acknowledged', (alarmId: number, acknowledgedBy: string) => {
      setAlarms(prev => prev.map(a => 
        a.id === alarmId 
          ? { ...a, acknowledged: true, acknowledged_by: acknowledgedBy, acknowledged_at: new Date().toISOString() }
          : a
      ));
      fetchStats();
    });
    
    socketInstance.on('alarm-resolved', (alarmId: number) => {
      setAlarms(prev => prev.map(a => 
        a.id === alarmId 
          ? { ...a, resolved: true, resolved_at: new Date().toISOString() }
          : a
      ));
      fetchStats();
    });
    
    setSocket(socketInstance);
    
    return () => {
      socketInstance.disconnect();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats();
    }, 30000); // Refresh stats every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const fetchAlarms = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (severityFilter !== 'all') params.append('severity', severityFilter);
      if (equipmentFilter !== 'all') params.append('equipment_id', equipmentFilter);
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/alarms?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      const data = await response.json();
      setAlarms(data);
    } catch (error) {
      console.error('Failed to fetch alarms:', error);
      toast({
        title: 'Error',
        description: 'Failed to load alarms',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/alarms/stats/summary?days=7`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch alarm stats:', error);
    }
  };

  const fetchEquipment = async () => {
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

  const handleNewAlarm = (alarm: Alarm) => {
    setAlarms(prev => [alarm, ...prev]);
    fetchStats();
    
    // Play sound if enabled
    if (soundEnabled && alarm.severity >= 2) {
      playAlarmSound();
    }
    
    // Show toast notification
    toast({
      title: `New ${getSeverityLabel(alarm.severity)} Alarm`,
      description: `${alarm.equipment_name}: ${alarm.type}`,
      variant: alarm.severity >= 3 ? 'destructive' : 'default'
    });
  };

  const playAlarmSound = () => {
    // In a real app, you'd play an actual sound file
    const audio = new Audio('/alarm-sound.mp3');
    audio.play().catch(() => {
      // Handle autoplay restrictions
    });
  };

  const acknowledgeAlarm = async (alarmId: number) => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/alarms/${alarmId}/acknowledge`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ 
            acknowledged_by: user.name || 'Unknown',
            notes: acknowledgeNotes 
          })
        }
      );
      
      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Alarm acknowledged'
        });
        setAcknowledgeNotes('');
        fetchAlarms();
      } else {
        throw new Error('Failed to acknowledge alarm');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to acknowledge alarm',
        variant: 'destructive'
      });
    }
  };

  const resolveAlarm = async (alarmId: number) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/alarms/${alarmId}/resolve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ notes: resolveNotes })
        }
      );
      
      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Alarm resolved'
        });
        setResolveNotes('');
        setIsDetailDialogOpen(false);
        fetchAlarms();
      } else {
        throw new Error('Failed to resolve alarm');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to resolve alarm',
        variant: 'destructive'
      });
    }
  };

  const exportAlarms = () => {
    const csv = [
      ['Timestamp', 'Equipment', 'Type', 'Severity', 'Value', 'Status', 'Notes'],
      ...filteredAlarms.map(alarm => [
        alarm.timestamp,
        alarm.equipment_name,
        alarm.type,
        getSeverityLabel(alarm.severity),
        alarm.value,
        alarm.resolved ? 'Resolved' : alarm.acknowledged ? 'Acknowledged' : 'Active',
        alarm.notes || ''
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alarms-${new Date().toISOString()}.csv`;
    a.click();
  };

  const getSeverityIcon = (severity: number) => {
    if (severity >= 3) return <XCircle className="h-5 w-5 text-red-500" />;
    if (severity === 2) return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    return <Info className="h-5 w-5 text-blue-500" />;
  };

  const getSeverityLabel = (severity: number) => {
    if (severity >= 3) return 'Critical';
    if (severity === 2) return 'Warning';
    return 'Info';
  };

  const getSeverityBadge = (severity: number) => {
    if (severity >= 3) return <Badge variant="destructive">Critical</Badge>;
    if (severity === 2) return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">Warning</Badge>;
    return <Badge variant="secondary">Info</Badge>;
  };

  const getStatusBadge = (alarm: Alarm) => {
    if (alarm.resolved) {
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Resolved</Badge>;
    }
    if (alarm.acknowledged) {
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Acknowledged</Badge>;
    }
    return <Badge variant="destructive">Active</Badge>;
  };

  const getAlarmTypeInfo = (type: string) => {
    return alarmTypes[type] || { 
      label: type.replace(/_/g, ' ').toUpperCase(), 
      icon: AlertCircle,
      color: 'text-gray-500'
    };
  };

  const filteredAlarms = alarms.filter(alarm => {
    const matchesSearch = searchTerm === '' || 
      alarm.equipment_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alarm.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alarm.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && !alarm.resolved) ||
      (statusFilter === 'resolved' && alarm.resolved) ||
      (statusFilter === 'unacknowledged' && !alarm.acknowledged && !alarm.resolved);
    
    const matchesSeverity = severityFilter === 'all' ||
      alarm.severity.toString() === severityFilter;
    
    const matchesEquipment = equipmentFilter === 'all' ||
      alarm.equipment_id.toString() === equipmentFilter;
    
    return matchesSearch && matchesStatus && matchesSeverity && matchesEquipment;
  });

  const getChartData = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return format(date, 'MMM dd');
    });

    const data = last7Days.map(day => {
      const dayAlarms = alarms.filter(a => format(new Date(a.timestamp), 'MMM dd') === day);
      return {
        date: day,
        critical: dayAlarms.filter(a => a.severity >= 3).length,
        warning: dayAlarms.filter(a => a.severity === 2).length,
        info: dayAlarms.filter(a => a.severity === 1).length
      };
    });

    return data;
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
            Alarm Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor and respond to system alarms and alerts
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Mute alarms' : 'Enable alarm sounds'}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </Button>
          <Button variant="outline" onClick={fetchAlarms}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button className="btn-primary" onClick={exportAlarms}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="hover-lift">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Bell className="h-5 w-5 text-red-500" />
                <span className="text-xs text-muted-foreground">Active</span>
              </div>
              <div className="text-2xl font-bold">{stats.active_count}</div>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <span className="text-xs text-muted-foreground">Critical</span>
              </div>
              <div className="text-2xl font-bold text-red-600">{stats.critical_count}</div>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <span className="text-xs text-muted-foreground">Warning</span>
              </div>
              <div className="text-2xl font-bold text-amber-600">{stats.warning_count}</div>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Info className="h-5 w-5 text-blue-500" />
                <span className="text-xs text-muted-foreground">Info</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">{stats.info_count}</div>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <MessageSquare className="h-5 w-5 text-orange-500" />
                <span className="text-xs text-muted-foreground">Unack'd</span>
              </div>
              <div className="text-2xl font-bold text-orange-600">{stats.unacknowledged_count}</div>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Calendar className="h-5 w-5 text-teal-500" />
                <span className="text-xs text-muted-foreground">Today</span>
              </div>
              <div className="text-2xl font-bold">{stats.today_count}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active">Active Alarms</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Active Alarms Tab */}
        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Active Alarms</CardTitle>
              <CardDescription>
                Real-time monitoring of system alarms
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search alarms..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="unacknowledged">Unacknowledged</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="3">Critical</SelectItem>
                    <SelectItem value="2">Warning</SelectItem>
                    <SelectItem value="1">Info</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Equipment</SelectItem>
                    {equipment.map(eq => (
                      <SelectItem key={eq.id} value={eq.id.toString()}>
                        {eq.location_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Alarms Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAlarms.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          No alarms found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAlarms.slice(0, 50).map((alarm) => {
                        const typeInfo = getAlarmTypeInfo(alarm.type);
                        const Icon = typeInfo.icon;
                        
                        return (
                          <TableRow 
                            key={alarm.id}
                            className={!alarm.acknowledged && !alarm.resolved ? 'bg-red-50/50 dark:bg-red-900/10' : ''}
                          >
                            <TableCell>
                              {getSeverityIcon(alarm.severity)}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  {format(new Date(alarm.timestamp), 'MMM dd, HH:mm')}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(alarm.timestamp), { addSuffix: true })}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{alarm.equipment_name}</div>
                                <div className="text-xs text-muted-foreground">{alarm.customer_name}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Icon className={`h-4 w-4 ${typeInfo.color}`} />
                                <span>{typeInfo.label}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono">{alarm.value}</span>
                            </TableCell>
                            <TableCell>{getSeverityBadge(alarm.severity)}</TableCell>
                            <TableCell>{getStatusBadge(alarm)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {!alarm.acknowledged && !alarm.resolved && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => acknowledgeAlarm(alarm.id)}
                                  >
                                    Ack
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedAlarm(alarm);
                                    setIsDetailDialogOpen(true);
                                  }}
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {filteredAlarms.length > 50 && (
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  Showing first 50 alarms. Use filters to narrow results.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Alarm History</CardTitle>
              <CardDescription>
                Historical alarm data and resolution tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {alarms.filter(a => a.resolved).slice(0, 100).map((alarm) => {
                    const typeInfo = getAlarmTypeInfo(alarm.type);
                    const Icon = typeInfo.icon;
                    
                    return (
                      <div key={alarm.id} className="p-4 border rounded-lg hover-lift">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${typeInfo.color}`} />
                            <span className="font-medium">{alarm.equipment_name}</span>
                            {getSeverityBadge(alarm.severity)}
                          </div>
                          <Badge className="bg-green-100 text-green-700">Resolved</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{typeInfo.label}</p>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Occurred:</span>
                            <span className="ml-2">{format(new Date(alarm.timestamp), 'MMM dd, HH:mm')}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Resolved:</span>
                            <span className="ml-2">
                              {alarm.resolved_at ? format(new Date(alarm.resolved_at), 'MMM dd, HH:mm') : '-'}
                            </span>
                          </div>
                          {alarm.acknowledged_by && (
                            <div>
                              <span className="text-muted-foreground">Ack'd by:</span>
                              <span className="ml-2">{alarm.acknowledged_by}</span>
                            </div>
                          )}
                          {alarm.notes && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Notes:</span>
                              <span className="ml-2">{alarm.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>7-Day Alarm Trend</CardTitle>
                <CardDescription>
                  Alarm frequency by severity over the last week
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getChartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="critical" stackId="a" fill={CHART_COLORS.critical} name="Critical" />
                    <Bar dataKey="warning" stackId="a" fill={CHART_COLORS.warning} name="Warning" />
                    <Bar dataKey="info" stackId="a" fill={CHART_COLORS.info} name="Info" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Alarm Distribution by Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={Object.entries(
                          alarms.reduce((acc, alarm) => {
                            acc[alarm.type] = (acc[alarm.type] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>)
                        ).map(([type, count]) => ({
                          name: getAlarmTypeInfo(type).label,
                          value: count
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => entry.name}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {Object.values(CHART_COLORS).map((color, index) => (
                          <Cell key={`cell-${index}`} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Resolution Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-mint-50 dark:bg-mint-900/10 rounded-lg">
                      <div className="text-sm text-muted-foreground">Average Resolution Time</div>
                      <div className="text-2xl font-bold">
                        {alarms.filter(a => a.resolved && a.resolved_at).length > 0 
                          ? Math.round(
                              alarms
                                .filter(a => a.resolved && a.resolved_at)
                                .reduce((sum, a) => {
                                  const duration = new Date(a.resolved_at!).getTime() - new Date(a.timestamp).getTime();
                                  return sum + duration;
                                }, 0) / 
                              alarms.filter(a => a.resolved && a.resolved_at).length / 
                              (1000 * 60)
                            ) + ' min'
                          : 'N/A'
                        }
                      </div>
                    </div>
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
                      <div className="text-sm text-muted-foreground">Resolution Rate</div>
                      <div className="text-2xl font-bold">
                        {alarms.length > 0 
                          ? Math.round((alarms.filter(a => a.resolved).length / alarms.length) * 100) + '%'
                          : 'N/A'
                        }
                      </div>
                    </div>
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-lg">
                      <div className="text-sm text-muted-foreground">Acknowledgment Rate</div>
                      <div className="text-2xl font-bold">
                        {alarms.length > 0 
                          ? Math.round((alarms.filter(a => a.acknowledged).length / alarms.length) * 100) + '%'
                          : 'N/A'
                        }
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Alarm Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Alarm Details</DialogTitle>
            <DialogDescription>
              Complete information about the selected alarm
            </DialogDescription>
          </DialogHeader>
          {selectedAlarm && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Equipment</Label>
                  <p className="font-medium">{selectedAlarm.equipment_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedAlarm.customer_name}</p>
                </div>
                <div>
                  <Label>Type</Label>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const typeInfo = getAlarmTypeInfo(selectedAlarm.type);
                      const Icon = typeInfo.icon;
                      return (
                        <>
                          <Icon className={`h-4 w-4 ${typeInfo.color}`} />
                          <span>{typeInfo.label}</span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Severity</Label>
                  <div className="mt-1">{getSeverityBadge(selectedAlarm.severity)}</div>
                </div>
                <div>
                  <Label>Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedAlarm)}</div>
                </div>
                <div>
                  <Label>Value</Label>
                  <p className="font-mono font-medium">{selectedAlarm.value}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Occurred</Label>
                  <p>{format(new Date(selectedAlarm.timestamp), 'MMM dd, yyyy HH:mm:ss')}</p>
                </div>
                {selectedAlarm.acknowledged && (
                  <div>
                    <Label>Acknowledged</Label>
                    <p>{selectedAlarm.acknowledged_at ? format(new Date(selectedAlarm.acknowledged_at), 'MMM dd, yyyy HH:mm:ss') : '-'}</p>
                    <p className="text-sm text-muted-foreground">by {selectedAlarm.acknowledged_by}</p>
                  </div>
                )}
                {selectedAlarm.resolved && (
                  <div>
                    <Label>Resolved</Label>
                    <p>{selectedAlarm.resolved_at ? format(new Date(selectedAlarm.resolved_at), 'MMM dd, yyyy HH:mm:ss') : '-'}</p>
                  </div>
                )}
              </div>

              {selectedAlarm.notes && (
                <div>
                  <Label>Notes</Label>
                  <p className="text-sm mt-1">{selectedAlarm.notes}</p>
                </div>
              )}

              {!selectedAlarm.resolved && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Resolution Notes</Label>
                    <Textarea
                      placeholder="Enter notes about the resolution..."
                      value={resolveNotes}
                      onChange={(e) => setResolveNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
              Close
            </Button>
            {selectedAlarm && !selectedAlarm.acknowledged && !selectedAlarm.resolved && (
              <Button 
                variant="outline"
                onClick={() => acknowledgeAlarm(selectedAlarm.id)}
              >
                Acknowledge
              </Button>
            )}
            {selectedAlarm && !selectedAlarm.resolved && (
              <Button 
                className="btn-primary"
                onClick={() => resolveAlarm(selectedAlarm.id)}
              >
                Resolve Alarm
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
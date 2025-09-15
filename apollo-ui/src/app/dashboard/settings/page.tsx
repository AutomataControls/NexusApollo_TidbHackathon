'use client';

import { useState, useEffect } from 'react';
import { 
  Settings,
  Save,
  Bell,
  Zap,
  Users,
  Shield,
  Database,
  Mail,
  Globe,
  Clock,
  Download,
  Upload,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  User,
  Plus,
  Trash,
  Edit,
  Key,
  Server,
  HardDrive,
  Cpu,
  Activity,
  Info,
  TestTube,
  DollarSign,
  ThermometerSun
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
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';

interface SystemSettings {
  general: {
    companyName: string;
    timezone: string;
    dateFormat: string;
    temperatureUnit: string;
  };
  notifications: {
    emailEnabled: boolean;
    emailFrom: string;
    criticalAlerts: boolean;
    warningAlerts: boolean;
    dailyDigest: boolean;
    digestTime: string;
  };
  energy: {
    utilityProvider: string;
    kwhRate: number;
    demandRate: number;
    currency: string;
    billingCycle: string;
  };
  hardware: {
    sensorPollInterval: number;
    dataRetentionDays: number;
    enableHailo: boolean;
    enableApollo: boolean;
  };
}

interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  last_login?: string;
  created_at?: string;
}

interface SystemInfo {
  version: string;
  nodeVersion: string;
  platform: string;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
  database: {
    postgres: {
      size: number;
      connected: boolean;
    };
    sqlite: {
      sensorCount: number;
      connected: boolean;
    };
    tidb?: {
      connected: boolean;
      patterns: number;
      embeddings: number;
      inferences: number;
      solutions: number;
    };
  };
  hardware: any;
}

const timezones = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC'
];

const dateFormats = [
  { value: 'MM/DD/YYYY', label: '12/31/2024' },
  { value: 'DD/MM/YYYY', label: '31/12/2024' },
  { value: 'YYYY-MM-DD', label: '2024-12-31' }
];

const currencies = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' }
];

const userRoles = [
  { value: 'admin', label: 'Administrator', color: 'text-red-600' },
  { value: 'operator', label: 'Operator', color: 'text-blue-600' },
  { value: 'technician', label: 'Technician', color: 'text-green-600' },
  { value: 'viewer', label: 'Viewer', color: 'text-gray-600' }
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const { toast } = useToast();

  const [userForm, setUserForm] = useState({
    username: '',
    name: '',
    email: '',
    role: 'viewer',
    password: ''
  });

  useEffect(() => {
    fetchSettings();
    fetchUsers();
    fetchSystemInfo();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api'}/settings`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load settings',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api'}/users`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setUsers(data);
        } else {
          console.error('Invalid users data format:', data);
          setUsers([]);
        }
      } else {
        console.error('Failed to fetch users:', response.status);
        setUsers([]);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
    }
  };

  const fetchSystemInfo = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api'}/settings/system/info`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setSystemInfo(data);
    } catch (error) {
      console.error('Failed to fetch system info:', error);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api'}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Settings saved successfully'
        });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const testEmail = async () => {
    setTestingEmail(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api'}/settings/test-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ email: user.email || 'test@example.com' })
      });

      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Test email sent successfully'
        });
      } else {
        throw new Error(data.error || 'Failed to send test email');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send test email',
        variant: 'destructive'
      });
    } finally {
      setTestingEmail(false);
    }
  };

  const handleUserSubmit = async () => {
    try {
      const url = editingUser 
        ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api'}/users/${editingUser.id}`
        : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api'}/users`;
      
      const response = await fetch(url, {
        method: editingUser ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(userForm)
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `User ${editingUser ? 'updated' : 'created'} successfully`
        });
        setIsUserDialogOpen(false);
        resetUserForm();
        await fetchUsers();
      } else {
        throw new Error('Failed to save user');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save user',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api'}/users/${deleteUserId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'User deleted successfully'
        });
        await fetchUsers();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete user');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user',
        variant: 'destructive'
      });
    } finally {
      setDeleteUserId(null);
    }
  };

  const exportBackup = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api'}/settings/backup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const backup = await response.json();
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nexus-apollo-backup-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        toast({
          title: 'Success',
          description: 'Backup exported successfully'
        });
      } else {
        throw new Error('Failed to export backup');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export backup',
        variant: 'destructive'
      });
    }
  };

  const importBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api'}/settings/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(backup)
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Backup restored successfully'
        });
        await fetchSettings();
      } else {
        throw new Error('Failed to restore backup');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to restore backup',
        variant: 'destructive'
      });
    }
  };

  const resetUserForm = () => {
    setUserForm({
      username: '',
      name: '',
      email: '',
      role: 'viewer',
      password: ''
    });
    setEditingUser(null);
  };

  const openEditUserDialog = (user: User) => {
    setEditingUser(user);
    setUserForm({
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      password: ''
    });
    setIsUserDialogOpen(true);
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  if (loading || !settings) {
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
            System Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure system preferences and manage users
          </p>
        </div>
        <Button 
          className="btn-primary"
          onClick={saveSettings}
          disabled={saving}
        >
          {saving ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="energy">Energy</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        {/* General Settings Tab */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Configure basic system preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company">Company Name</Label>
                  <Input
                    id="company"
                    value={settings.general.companyName}
                    onChange={(e) => setSettings({
                      ...settings,
                      general: { ...settings.general, companyName: e.target.value }
                    })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={settings.general.timezone}
                    onValueChange={(value) => setSettings({
                      ...settings,
                      general: { ...settings.general, timezone: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map(tz => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateFormat">Date Format</Label>
                  <Select
                    value={settings.general.dateFormat}
                    onValueChange={(value) => setSettings({
                      ...settings,
                      general: { ...settings.general, dateFormat: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dateFormats.map(format => (
                        <SelectItem key={format.value} value={format.value}>
                          {format.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tempUnit">Temperature Unit</Label>
                  <Select
                    value={settings.general.temperatureUnit}
                    onValueChange={(value) => setSettings({
                      ...settings,
                      general: { ...settings.general, temperatureUnit: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="F">Fahrenheit (°F)</SelectItem>
                      <SelectItem value="C">Celsius (°C)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-medium mb-4">Hardware Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pollInterval">Sensor Poll Interval (ms)</Label>
                    <Input
                      id="pollInterval"
                      type="number"
                      value={settings.hardware.sensorPollInterval}
                      onChange={(e) => setSettings({
                        ...settings,
                        hardware: { ...settings.hardware, sensorPollInterval: parseInt(e.target.value) }
                      })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="retention">Data Retention (days)</Label>
                    <Input
                      id="retention"
                      type="number"
                      value={settings.hardware.dataRetentionDays}
                      onChange={(e) => setSettings({
                        ...settings,
                        hardware: { ...settings.hardware, dataRetentionDays: parseInt(e.target.value) }
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Hailo AI</Label>
                      <p className="text-xs text-muted-foreground">Use Hailo accelerator for inference</p>
                    </div>
                    <Switch
                      checked={settings.hardware.enableHailo}
                      onCheckedChange={(checked) => setSettings({
                        ...settings,
                        hardware: { ...settings.hardware, enableHailo: checked }
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Apollo AI</Label>
                      <p className="text-xs text-muted-foreground">Use Apollo AI for diagnostics</p>
                    </div>
                    <Switch
                      checked={settings.hardware.enableApollo}
                      onCheckedChange={(checked) => setSettings({
                        ...settings,
                        hardware: { ...settings.hardware, enableApollo: checked }
                      })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Configure email and alert preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Enable email notifications</p>
                </div>
                <Switch
                  checked={settings.notifications.emailEnabled}
                  onCheckedChange={(checked) => setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, emailEnabled: checked }
                  })}
                />
              </div>

              {settings.notifications.emailEnabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="emailFrom">From Email Address</Label>
                    <Input
                      id="emailFrom"
                      type="email"
                      value={settings.notifications.emailFrom}
                      onChange={(e) => setSettings({
                        ...settings,
                        notifications: { ...settings.notifications, emailFrom: e.target.value }
                      })}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={testEmail}
                      disabled={testingEmail}
                    >
                      {testingEmail ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <TestTube className="mr-2 h-4 w-4" />
                          Send Test Email
                        </>
                      )}
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Alert Types</h3>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Critical Alerts</Label>
                        <p className="text-sm text-muted-foreground">
                          Send emails for critical system alarms
                        </p>
                      </div>
                      <Switch
                        checked={settings.notifications.criticalAlerts}
                        onCheckedChange={(checked) => setSettings({
                          ...settings,
                          notifications: { ...settings.notifications, criticalAlerts: checked }
                        })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Warning Alerts</Label>
                        <p className="text-sm text-muted-foreground">
                          Send emails for warning level alarms
                        </p>
                      </div>
                      <Switch
                        checked={settings.notifications.warningAlerts}
                        onCheckedChange={(checked) => setSettings({
                          ...settings,
                          notifications: { ...settings.notifications, warningAlerts: checked }
                        })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Daily Digest</Label>
                        <p className="text-sm text-muted-foreground">
                          Send daily summary email
                        </p>
                      </div>
                      <Switch
                        checked={settings.notifications.dailyDigest}
                        onCheckedChange={(checked) => setSettings({
                          ...settings,
                          notifications: { ...settings.notifications, dailyDigest: checked }
                        })}
                      />
                    </div>

                    {settings.notifications.dailyDigest && (
                      <div className="space-y-2">
                        <Label htmlFor="digestTime">Digest Send Time</Label>
                        <Input
                          id="digestTime"
                          type="time"
                          value={settings.notifications.digestTime}
                          onChange={(e) => setSettings({
                            ...settings,
                            notifications: { ...settings.notifications, digestTime: e.target.value }
                          })}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Energy Settings Tab */}
        <TabsContent value="energy">
          <Card>
            <CardHeader>
              <CardTitle>Energy & Billing Settings</CardTitle>
              <CardDescription>
                Configure utility rates and billing parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="provider">Utility Provider</Label>
                  <Input
                    id="provider"
                    value={settings.energy.utilityProvider}
                    onChange={(e) => setSettings({
                      ...settings,
                      energy: { ...settings.energy, utilityProvider: e.target.value }
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={settings.energy.currency}
                    onValueChange={(value) => setSettings({
                      ...settings,
                      energy: { ...settings.energy, currency: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map(currency => (
                        <SelectItem key={currency.value} value={currency.value}>
                          {currency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="kwhRate">Energy Rate (per kWh)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      id="kwhRate"
                      type="number"
                      step="0.01"
                      value={settings.energy.kwhRate}
                      onChange={(e) => setSettings({
                        ...settings,
                        energy: { ...settings.energy, kwhRate: parseFloat(e.target.value) }
                      })}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="demandRate">Demand Rate (per kW)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      id="demandRate"
                      type="number"
                      step="0.01"
                      value={settings.energy.demandRate}
                      onChange={(e) => setSettings({
                        ...settings,
                        energy: { ...settings.energy, demandRate: parseFloat(e.target.value) }
                      })}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billing">Billing Cycle</Label>
                  <Select
                    value={settings.energy.billingCycle}
                    onValueChange={(value) => setSettings({
                      ...settings,
                      energy: { ...settings.energy, billingCycle: value }
                    })}
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

              <Alert className="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription>
                  These rates are used for cost calculations in energy reports and real-time monitoring
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>
                    Manage system users and permissions
                  </CardDescription>
                </div>
                <Button 
                  className="btn-primary"
                  onClick={() => {
                    resetUserForm();
                    setIsUserDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => {
                        const roleInfo = userRoles.find(r => r.value === user.role);
                        
                        return (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.username}</TableCell>
                            <TableCell>{user.name}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={roleInfo?.color}>
                                {roleInfo?.label || user.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {user.last_login 
                                ? format(new Date(user.last_login), 'MMM dd, yyyy')
                                : 'Never'
                              }
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditUserDialog(user)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleteUserId(user.id)}
                                  disabled={user.username === 'admin'}
                                >
                                  <Trash className="h-4 w-4 text-red-500" />
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system">
          <div className="space-y-6">
            {/* System Information */}
            <Card>
              <CardHeader>
                <CardTitle>System Information</CardTitle>
                <CardDescription>
                  Current system status and resource usage
                </CardDescription>
              </CardHeader>
              <CardContent>
                {systemInfo && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-3">Version Info</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">System Version:</span>
                          <span className="font-mono">{systemInfo.version}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Node Version:</span>
                          <span className="font-mono">{systemInfo.nodeVersion}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Platform:</span>
                          <span className="font-mono">{systemInfo.platform}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Uptime:</span>
                          <span>{formatUptime(systemInfo.uptime)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Memory Usage</h4>
                      <div className="space-y-2 text-sm">
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Heap Used:</span>
                            <span>{formatBytes(systemInfo.memory.heapUsed)}</span>
                          </div>
                          <Progress 
                            value={(systemInfo.memory.heapUsed / systemInfo.memory.heapTotal) * 100}
                            className="h-2"
                          />
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Heap Total:</span>
                          <span>{formatBytes(systemInfo.memory.heapTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">RSS:</span>
                          <span>{formatBytes(systemInfo.memory.rss)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Database</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">PostgreSQL:</span>
                          <div className="flex items-center gap-2">
                            <span>{formatBytes(systemInfo.database.postgres.size)}</span>
                            {systemInfo.database.postgres.connected ? (
                              <Badge className="bg-green-100 text-green-700">Connected</Badge>
                            ) : (
                              <Badge variant="destructive">Disconnected</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">SQLite Records:</span>
                          <div className="flex items-center gap-2">
                            <span>{systemInfo.database.sqlite.sensorCount.toLocaleString()}</span>
                            {systemInfo.database.sqlite.connected ? (
                              <Badge className="bg-green-100 text-green-700">Connected</Badge>
                            ) : (
                              <Badge variant="destructive">Disconnected</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">TiDB Vector:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs">
                              {systemInfo.database.tidb ? (
                                `${systemInfo.database.tidb.embeddings.toLocaleString()} vectors`
                              ) : (
                                'No data'
                              )}
                            </span>
                            {systemInfo.database.tidb?.connected ? (
                              <Badge className="bg-green-100 text-green-700">Connected</Badge>
                            ) : (
                              <Badge variant="secondary">Not Connected</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Hardware Status</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Hardware Manager:</span>
                          <Badge className="bg-green-100 text-green-700">Active</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Apollo AI:</span>
                          <Badge variant={settings.hardware.enableApollo ? 'default' : 'secondary'}>
                            {settings.hardware.enableApollo ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Hailo Accelerator:</span>
                          <Badge variant={settings.hardware.enableHailo ? 'default' : 'secondary'}>
                            {settings.hardware.enableHailo ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Backup & Restore */}
            <Card>
              <CardHeader>
                <CardTitle>Backup & Restore</CardTitle>
                <CardDescription>
                  Export and import system configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Button variant="outline" onClick={exportBackup}>
                    <Download className="mr-2 h-4 w-4" />
                    Export Backup
                  </Button>
                  <div>
                    <input
                      type="file"
                      id="import-backup"
                      accept=".json"
                      className="hidden"
                      onChange={importBackup}
                    />
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById('import-backup')?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Import Backup
                    </Button>
                  </div>
                </div>
                <Alert className="mt-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Backups include all system settings, customer data, and equipment configurations.
                    Sensor readings and historical data are not included.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* User Dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
            <DialogDescription>
              {editingUser ? 'Update user information' : 'Create a new system user'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={userForm.username}
                onChange={(e) => setUserForm({...userForm, username: e.target.value})}
                disabled={!!editingUser}
              />
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={userForm.name}
                onChange={(e) => setUserForm({...userForm, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({...userForm, email: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={userForm.role}
                onValueChange={(value) => setUserForm({...userForm, role: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {userRoles.map(role => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!editingUser && (
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUserSubmit} className="btn-primary">
              {editingUser ? 'Update' : 'Create'} User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user
              and revoke their access to the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { 
  Gauge,
  Plus,
  Search,
  Settings,
  Trash,
  Edit,
  Activity,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle,
  TestTube,
  Cpu,
  RefreshCw,
  Terminal,
  Hash,
  Zap,
  ThermometerSun,
  Wind,
  Droplets,
  Waves
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
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SensorConfig {
  id: number;
  equipment_id: number;
  sensor_name: string;
  sensor_type: string;
  sensor_model: string;
  board_type: string;
  board_address: number;
  channel: number;
  input_range: string;
  units: string;
  calibration_offset: number;
  calibration_scale: number;
  scale_min: number;
  scale_max: number;
  alarm_low: number;
  alarm_high: number;
  enabled: boolean;
  port: string;
  created_at: string;
  updated_at: string;
}

interface Equipment {
  id: number;
  location_name: string;
  equipment_type: string;
}

interface HardwareDevice {
  type: string;
  address: number;
  port: string;
  model: string;
  channels: number;
  status: string;
}

interface SensorReading {
  sensor_name: string;
  value: number;
  units: string;
  timestamp: string;
  status: 'normal' | 'warning' | 'alarm';
}

const sensorTypes = [
  { value: 'temperature', label: 'Temperature', icon: ThermometerSun },
  { value: 'air_velocity', label: 'Air Velocity', icon: Wind },
  { value: 'differential_pressure', label: 'Differential Pressure', icon: Gauge },
  { value: 'refrigerant_pressure', label: 'Refrigerant Pressure', icon: Gauge },
  { value: 'current', label: 'Current', icon: Zap },
  { value: 'power', label: 'Power', icon: Zap },
  { value: 'vibration', label: 'Vibration', icon: Waves },
  { value: 'pressure', label: 'Pressure', icon: Gauge },
  { value: 'flow', label: 'Flow', icon: Wind },
  { value: 'humidity', label: 'Humidity', icon: Droplets },
  { value: 'voltage', label: 'Voltage', icon: Activity }
];

const boardTypes = [
  'megabas',
  'megaind', 
  '8relind',
  '16relind',
  '16univin',
  '16uout',
  'mfm384',
  'witmotion'
];

const inputRanges = [
  '0-10V',
  '0-5V',
  '4-20mA',
  '0-20mA',
  '10K-2',  // 10K Type 2 thermistor (always type 2)
  'PT100',
  'PT1000',
  'Digital',
  'RS485'
];

const unitOptions = {
  temperature: ['°F', '°C', 'K'],
  pressure: ['PSI', 'Pa', 'kPa', 'Bar', 'inH2O', 'inWC'],
  flow: ['CFM', 'GPM', 'L/min', 'm³/h'],
  humidity: ['%RH', 'g/kg'],
  vibration: ['mm/s', 'in/s', 'g'],
  current: ['A', 'mA'],
  voltage: ['V', 'mV', 'kV'],
  power: ['W', 'kW', 'MW', 'HP'],
  air_velocity: ['ft/s', 'm/s'],
  differential_pressure: ['inWC', 'Pa', 'kPa'],
  refrigerant_pressure: ['PSI', 'kPa']
};

// Sensor model configurations with auto-populated values
const sensorModels = {
  temperature: [
    {
      model: 'Belimo 10K-2',
      board_type: '16univin',  // Changed to 16univin since that's what you're using
      input_range: '10K-2',
      units: '°F',
      scale_min: -58,
      scale_max: 302,
      description: 'Duct air temperature sensor'
    },
    {
      model: 'Belimo 01CT-5LL',
      board_type: '16univin',  // Changed to 16univin since that's what you're using
      input_range: '10K-2',
      units: '°F',
      scale_min: -40,
      scale_max: 300,
      description: 'Cable temperature sensor'
    }
  ],
  air_velocity: [
    {
      model: 'Siemens QVM62.1 (0-16 ft/s)',
      board_type: 'megabas',
      input_range: '0-10V',
      units: 'ft/s',
      scale_min: 0,
      scale_max: 16,
      description: 'Air velocity sensor 0-16 ft/s range'
    },
    {
      model: 'Siemens QVM62.1 (0-33 ft/s)',
      board_type: 'megabas',
      input_range: '0-10V',
      units: 'ft/s',
      scale_min: 0,
      scale_max: 33,
      description: 'Air velocity sensor 0-33 ft/s range'
    },
    {
      model: 'Siemens QVM62.1 (0-49 ft/s)',
      board_type: 'megabas',
      input_range: '0-10V',
      units: 'ft/s',
      scale_min: 0,
      scale_max: 49,
      description: 'Air velocity sensor 0-49 ft/s range'
    }
  ],
  differential_pressure: [
    {
      model: 'Veris PX3DLX02 (0-0.1"WC)',
      board_type: 'megabas',
      input_range: '0-10V',
      units: 'inWC',
      scale_min: 0,
      scale_max: 0.1,
      description: 'Differential pressure 0-0.1" WC'
    },
    {
      model: 'Veris PX3DLX02 (0-1"WC)',
      board_type: 'megabas',
      input_range: '0-10V',
      units: 'inWC',
      scale_min: 0,
      scale_max: 1.0,
      description: 'Differential pressure 0-1" WC'
    },
    {
      model: 'Veris PX3DLX02 (0-10"WC)',
      board_type: 'megabas',
      input_range: '0-10V',
      units: 'inWC',
      scale_min: 0,
      scale_max: 10.0,
      description: 'Differential pressure 0-10" WC'
    }
  ],
  refrigerant_pressure: [
    {
      model: 'Johnson Controls P499VAP-105C',
      board_type: 'megabas',
      input_range: '0-10V',
      units: 'PSI',
      scale_min: 0,
      scale_max: 500,
      description: '0-500 psi, 1/8"-27 NPT fitting'
    },
    {
      model: 'Johnson Controls P499VAP-107C',
      board_type: 'megabas',
      input_range: '0-10V',
      units: 'PSI',
      scale_min: 0,
      scale_max: 750,
      description: '0-750 psi, 1/8"-27 NPT fitting'
    },
    {
      model: 'Johnson Controls P499VCP-105C',
      board_type: 'megabas',
      input_range: '0-10V',
      units: 'PSI',
      scale_min: 0,
      scale_max: 500,
      description: '0-500 psi, 1/4" SAE flare fitting'
    },
    {
      model: 'Johnson Controls P499VCP-107C',
      board_type: 'megabas',
      input_range: '0-10V',
      units: 'PSI',
      scale_min: 0,
      scale_max: 750,
      description: '0-750 psi, 1/4" SAE flare fitting'
    }
  ],
  current: [
    {
      model: 'Generic 0-10V CT (0-20A)',
      board_type: '16univin',
      input_range: '0-10V',
      units: 'A',
      scale_min: 0,
      scale_max: 20,
      description: 'Current transformer 0-20A'
    },
    {
      model: 'Generic 0-10V CT (0-50A)',
      board_type: '16univin',
      input_range: '0-10V',
      units: 'A',
      scale_min: 0,
      scale_max: 50,
      description: 'Current transformer 0-50A'
    },
    {
      model: 'Generic 0-10V CT (0-100A)',
      board_type: '16univin',
      input_range: '0-10V',
      units: 'A',
      scale_min: 0,
      scale_max: 100,
      description: 'Current transformer 0-100A'
    }
  ],
  power: [
    {
      model: 'SELEC MFM384',
      board_type: 'mfm384',
      input_range: 'RS485',
      units: 'kW',
      scale_min: 0,
      scale_max: 1000,
      description: '3-phase power analyzer'
    }
  ],
  vibration: [
    {
      model: 'WitMotion WT901C485',
      board_type: 'witmotion',
      input_range: 'RS485',
      units: 'mm/s',
      scale_min: 0,
      scale_max: 100,
      description: 'Vibration sensor with RS485'
    }
  ]
};

// Board address defaults based on hardware type
// These are STACK numbers, not I2C addresses!
const boardAddressDefaults = {
  'megabas': 0, // Stack 0 (I2C 0x48)
  'megaind': 0, // Stack 0 (I2C 0x50)
  '16univin': 4, // Stack 4 (I2C 0x5c) - currently connected
  '16uout': 0, // Stack 0 default
  '8relind': 0, // Stack 0 default
  '16relind': 0, // Stack 0 default
  'mfm384': 1, // RS485 slave address
  'witmotion': 1 // RS485 slave address
};

// Special board types that don't need channel/input range
const specialBoardTypes = ['mfm384', 'witmotion'];

// Map sensor types to which AI model processes them
const sensorTypeToAIModel = {
  temperature: 'BOREAS/ZEPHYRUS',
  air_velocity: 'ZEPHYRUS', 
  differential_pressure: 'ZEPHYRUS',
  refrigerant_pressure: 'BOREAS',
  current: 'AQUILO',
  power: 'AQUILO',
  vibration: 'VULCAN',
  pressure: 'BOREAS/NAIAD',
  flow: 'NAIAD',
  humidity: 'ZEPHYRUS',
  voltage: 'AQUILO'
};


export default function SensorsPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string>('');
  const [sensorConfigs, setSensorConfigs] = useState<SensorConfig[]>([]);
  const [availableDevices, setAvailableDevices] = useState<HardwareDevice[]>([]);
  const [liveReadings, setLiveReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [testing, setTesting] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteSensorId, setDeleteSensorId] = useState<number | null>(null);
  const [editingSensor, setEditingSensor] = useState<SensorConfig | null>(null);
  const [socket, setSocket] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    sensor_name: '',
    sensor_type: 'temperature',
    sensor_model: '',
    board_type: '',
    board_address: '',
    channel: '',
    input_range: '0-10V',
    units: '°F',
    calibration_offset: '0',
    calibration_scale: '1',
    scale_min: '0',
    scale_max: '100',
    alarm_low: '',
    alarm_high: '',
    enabled: true,
    port: '/dev/ttyUSB0'
  });

  const [selectedSensorModel, setSelectedSensorModel] = useState<any>(null);

  useEffect(() => {
    // Check demo mode
    const isDemoMode = localStorage.getItem('demoMode') === 'true';
    setDemoMode(isDemoMode);

    fetchEquipment();

    // Initialize WebSocket connection
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || '';
    const newSocket = io(socketUrl);
    
    newSocket.on('connect', () => {
      console.log('Connected to sensor monitoring');
      setIsConnected(true);
      toast({
        title: 'Connected',
        description: 'Real-time sensor monitoring active',
      });
    });
    
    newSocket.on('disconnect', () => {
      console.log('Disconnected from sensor monitoring');
      setIsConnected(false);
      toast({
        title: 'Disconnected',
        description: 'Real-time sensor monitoring offline',
        variant: 'destructive'
      });
    });
    
    newSocket.on('sensor-update', (data) => {
      // Update live readings if this is for the selected equipment
      if (data.equipment_id?.toString() === selectedEquipment) {
        setLiveReadings(data.readings || []);
        setLastUpdate(new Date());
      }
    });
    
    newSocket.on('sensor-alarm', (data) => {
      // Show alarm notification
      toast({
        title: `Sensor Alarm: ${data.sensor_name}`,
        description: `Value ${data.value} ${data.alarm_type === 'high' ? 'exceeded high' : 'below low'} threshold of ${data.threshold}`,
        variant: 'destructive'
      });
    });
    
    newSocket.on('sensor-error', (data) => {
      if (data.equipment_id?.toString() === selectedEquipment) {
        toast({
          title: 'Sensor Error',
          description: data.error,
          variant: 'destructive'
        });
      }
    });
    
    setSocket(newSocket);
    
    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (selectedEquipment) {
      fetchSensorConfigs();
      fetchLiveReadings(); // Initial fetch
      
      // Request real-time updates for this equipment
      if (socket && isConnected) {
        socket.emit('request-sensor-update', selectedEquipment);
      }
    }
  }, [selectedEquipment, socket, isConnected]);

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

  const fetchSensorConfigs = async () => {
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // Demo sensor configs - different for each equipment type
      const equipmentType = equipment.find(e => e.id.toString() === selectedEquipment)?.equipment_type || 'RTU';
      let demoConfigs: SensorConfig[] = [];

      // Base config that all equipment has
      const baseConfigs = [
        {
          id: 1,
          equipment_id: parseInt(selectedEquipment),
          sensor_name: 'Supply Air Temperature',
          sensor_type: 'temperature',
          sensor_model: 'Belimo 10K-2',
          board_type: '16univin',
          board_address: 4,
          channel: 1,
          input_range: '10K-2',
          units: '°F',
          calibration_offset: 0,
          calibration_scale: 1,
          scale_min: -58,
          scale_max: 302,
          alarm_low: 45,
          alarm_high: 95,
          enabled: true,
          port: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 2,
          equipment_id: parseInt(selectedEquipment),
          sensor_name: 'Return Air Temperature',
          sensor_type: 'temperature',
          sensor_model: 'Belimo 10K-2',
          board_type: '16univin',
          board_address: 4,
          channel: 2,
          input_range: '10K-2',
          units: '°F',
          calibration_offset: 0,
          calibration_scale: 1,
          scale_min: -58,
          scale_max: 302,
          alarm_low: 50,
          alarm_high: 90,
          enabled: true,
          port: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      // Equipment-specific sensors
      if (equipmentType === 'RTU' || equipmentType === 'AHU') {
        demoConfigs = [
          ...baseConfigs,
          {
            id: 3,
            equipment_id: parseInt(selectedEquipment),
            sensor_name: 'Mixed Air Temperature',
            sensor_type: 'temperature',
            sensor_model: 'Belimo 10K-2',
            board_type: '16univin',
            board_address: 4,
            channel: 3,
            input_range: '10K-2',
            units: '°F',
            calibration_offset: 0,
            calibration_scale: 1,
            scale_min: -58,
            scale_max: 302,
            alarm_low: 35,
            alarm_high: 85,
            enabled: true,
            port: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 4,
            equipment_id: parseInt(selectedEquipment),
            sensor_name: 'Filter Differential Pressure',
            sensor_type: 'differential_pressure',
            sensor_model: 'Veris PX3DLX02 (0-1"WC)',
            board_type: 'megabas',
            board_address: 0,
            channel: 1,
            input_range: '0-10V',
            units: 'inWC',
            calibration_offset: 0,
            calibration_scale: 1,
            scale_min: 0,
            scale_max: 1,
            alarm_low: 0,
            alarm_high: 0.8,
            enabled: true,
            port: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 5,
            equipment_id: parseInt(selectedEquipment),
            sensor_name: 'Compressor Current',
            sensor_type: 'current',
            sensor_model: 'Generic 0-10V CT (0-50A)',
            board_type: '16univin',
            board_address: 4,
            channel: 5,
            input_range: '0-10V',
            units: 'A',
            calibration_offset: 0,
            calibration_scale: 1,
            scale_min: 0,
            scale_max: 50,
            alarm_low: 0,
            alarm_high: 45,
            enabled: true,
            port: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ];
      } else if (equipmentType === 'Chiller') {
        demoConfigs = [
          {
            id: 1,
            equipment_id: parseInt(selectedEquipment),
            sensor_name: 'Chilled Water Supply',
            sensor_type: 'temperature',
            sensor_model: 'Belimo 10K-2',
            board_type: '16univin',
            board_address: 4,
            channel: 1,
            input_range: '10K-2',
            units: '°F',
            calibration_offset: 0,
            calibration_scale: 1,
            scale_min: 32,
            scale_max: 100,
            alarm_low: 38,
            alarm_high: 48,
            enabled: true,
            port: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 2,
            equipment_id: parseInt(selectedEquipment),
            sensor_name: 'Chilled Water Return',
            sensor_type: 'temperature',
            sensor_model: 'Belimo 10K-2',
            board_type: '16univin',
            board_address: 4,
            channel: 2,
            input_range: '10K-2',
            units: '°F',
            calibration_offset: 0,
            calibration_scale: 1,
            scale_min: 32,
            scale_max: 100,
            alarm_low: 45,
            alarm_high: 60,
            enabled: true,
            port: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 3,
            equipment_id: parseInt(selectedEquipment),
            sensor_name: 'Condenser Water Supply',
            sensor_type: 'temperature',
            sensor_model: 'Belimo 10K-2',
            board_type: '16univin',
            board_address: 4,
            channel: 3,
            input_range: '10K-2',
            units: '°F',
            calibration_offset: 0,
            calibration_scale: 1,
            scale_min: 32,
            scale_max: 120,
            alarm_low: 70,
            alarm_high: 95,
            enabled: true,
            port: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 4,
            equipment_id: parseInt(selectedEquipment),
            sensor_name: 'Chiller Current',
            sensor_type: 'current',
            sensor_model: 'Generic 0-10V CT (0-100A)',
            board_type: '16univin',
            board_address: 4,
            channel: 4,
            input_range: '0-10V',
            units: 'A',
            calibration_offset: 0,
            calibration_scale: 1,
            scale_min: 0,
            scale_max: 100,
            alarm_low: 0,
            alarm_high: 85,
            enabled: true,
            port: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ];
      } else if (equipmentType === 'Pump') {
        demoConfigs = [
          {
            id: 1,
            equipment_id: parseInt(selectedEquipment),
            sensor_name: 'Pump Inlet Pressure',
            sensor_type: 'pressure',
            sensor_model: 'Johnson Controls P499VAP-105C',
            board_type: 'megabas',
            board_address: 0,
            channel: 1,
            input_range: '0-10V',
            units: 'PSI',
            calibration_offset: 0,
            calibration_scale: 1,
            scale_min: 0,
            scale_max: 100,
            alarm_low: 10,
            alarm_high: 80,
            enabled: true,
            port: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 2,
            equipment_id: parseInt(selectedEquipment),
            sensor_name: 'Pump Outlet Pressure',
            sensor_type: 'pressure',
            sensor_model: 'Johnson Controls P499VAP-105C',
            board_type: 'megabas',
            board_address: 0,
            channel: 2,
            input_range: '0-10V',
            units: 'PSI',
            calibration_offset: 0,
            calibration_scale: 1,
            scale_min: 0,
            scale_max: 100,
            alarm_low: 20,
            alarm_high: 90,
            enabled: true,
            port: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 3,
            equipment_id: parseInt(selectedEquipment),
            sensor_name: 'Pump Motor Current',
            sensor_type: 'current',
            sensor_model: 'Generic 0-10V CT (0-20A)',
            board_type: '16univin',
            board_address: 4,
            channel: 3,
            input_range: '0-10V',
            units: 'A',
            calibration_offset: 0,
            calibration_scale: 1,
            scale_min: 0,
            scale_max: 20,
            alarm_low: 0,
            alarm_high: 18,
            enabled: true,
            port: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 4,
            equipment_id: parseInt(selectedEquipment),
            sensor_name: 'Pump Vibration',
            sensor_type: 'vibration',
            sensor_model: 'WitMotion WT901C485',
            board_type: 'witmotion',
            board_address: 1,
            channel: 0,
            input_range: 'RS485',
            units: 'mm/s',
            calibration_offset: 0,
            calibration_scale: 1,
            scale_min: 0,
            scale_max: 50,
            alarm_low: 0,
            alarm_high: 25,
            enabled: true,
            port: '/dev/ttyUSB0',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ];
      } else {
        // Default configs
        demoConfigs = [...baseConfigs];
      }

      setSensorConfigs(demoConfigs);
    } else {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/sensors/config?equipment_id=${selectedEquipment}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
        const data = await response.json();
        setSensorConfigs(data);
      } catch (error) {
        console.error('Failed to fetch sensor configs:', error);
      }
    }
  };

  const fetchLiveReadings = async () => {
    if (!selectedEquipment) return;

    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // Demo live readings - different for each equipment type
      const equipmentType = equipment.find(e => e.id.toString() === selectedEquipment)?.equipment_type || 'RTU';
      let demoReadings: SensorReading[] = [];

      if (equipmentType === 'RTU' || equipmentType === 'AHU') {
        demoReadings = [
          {
            sensor_name: 'Supply Air Temperature',
            value: 55 + (Math.random() - 0.5) * 5,
            units: '°F',
            timestamp: new Date().toISOString(),
            status: 'normal'
          },
          {
            sensor_name: 'Return Air Temperature',
            value: 75 + (Math.random() - 0.5) * 3,
            units: '°F',
            timestamp: new Date().toISOString(),
            status: 'normal'
          },
          {
            sensor_name: 'Mixed Air Temperature',
            value: 65 + (Math.random() - 0.5) * 5,
            units: '°F',
            timestamp: new Date().toISOString(),
            status: 'normal'
          },
          {
            sensor_name: 'Filter Differential Pressure',
            value: 0.45 + (Math.random() - 0.5) * 0.2,
            units: 'inWC',
            timestamp: new Date().toISOString(),
            status: Math.random() > 0.9 ? 'alarm' : 'normal'
          },
          {
            sensor_name: 'Compressor Current',
            value: 28.5 + (Math.random() - 0.5) * 10,
            units: 'A',
            timestamp: new Date().toISOString(),
            status: Math.random() > 0.8 ? 'warning' : 'normal'
          }
        ];
      } else if (equipmentType === 'Chiller') {
        demoReadings = [
          {
            sensor_name: 'Chilled Water Supply',
            value: 44 + (Math.random() - 0.5) * 2,
            units: '°F',
            timestamp: new Date().toISOString(),
            status: 'normal'
          },
          {
            sensor_name: 'Chilled Water Return',
            value: 54 + (Math.random() - 0.5) * 2,
            units: '°F',
            timestamp: new Date().toISOString(),
            status: 'normal'
          },
          {
            sensor_name: 'Condenser Water Supply',
            value: 85 + (Math.random() - 0.5) * 5,
            units: '°F',
            timestamp: new Date().toISOString(),
            status: 'normal'
          },
          {
            sensor_name: 'Chiller Current',
            value: 65 + (Math.random() - 0.5) * 15,
            units: 'A',
            timestamp: new Date().toISOString(),
            status: Math.random() > 0.85 ? 'warning' : 'normal'
          }
        ];
      } else if (equipmentType === 'Pump') {
        demoReadings = [
          {
            sensor_name: 'Pump Inlet Pressure',
            value: 45 + (Math.random() - 0.5) * 10,
            units: 'PSI',
            timestamp: new Date().toISOString(),
            status: 'normal'
          },
          {
            sensor_name: 'Pump Outlet Pressure',
            value: 65 + (Math.random() - 0.5) * 10,
            units: 'PSI',
            timestamp: new Date().toISOString(),
            status: 'normal'
          },
          {
            sensor_name: 'Pump Motor Current',
            value: 12 + (Math.random() - 0.5) * 4,
            units: 'A',
            timestamp: new Date().toISOString(),
            status: Math.random() > 0.9 ? 'warning' : 'normal'
          },
          {
            sensor_name: 'Pump Vibration',
            value: 5.5 + (Math.random() - 0.5) * 3,
            units: 'mm/s',
            timestamp: new Date().toISOString(),
            status: Math.random() > 0.95 ? 'alarm' : 'normal'
          }
        ];
      } else {
        // Default readings
        demoReadings = [
          {
            sensor_name: 'Supply Air Temperature',
            value: 72.5 + (Math.random() - 0.5) * 5,
            units: '°F',
            timestamp: new Date().toISOString(),
            status: 'normal'
          },
          {
            sensor_name: 'Return Air Temperature',
            value: 75.2 + (Math.random() - 0.5) * 3,
            units: '°F',
            timestamp: new Date().toISOString(),
            status: 'normal'
          }
        ];
      }

      setLiveReadings(demoReadings);
    } else {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/sensors/readings/${selectedEquipment}?demo=${isDemoMode}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
        const data = await response.json();
        setLiveReadings(data);
      } catch (error) {
        console.error('Failed to fetch live readings:', error);
      }
    }
  };

  const scanForDevices = async () => {
    setScanning(true);
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    if (isDemoMode) {
      // Demo devices simulation
      setTimeout(() => {
        const demoDevices = [
          {
            type: 'MegaBAS',
            model: 'Building Automation System',
            address: 0x48,
            port: 'I2C',
            channels: 8,
            status: 'online'
          },
          {
            type: 'MegaIND',
            model: 'Industrial I/O Board',
            address: 0x50,
            port: 'I2C',
            channels: 8,
            status: 'online'
          },
          {
            type: '16UnivIn',
            model: 'Universal Input Board',
            address: 0x5c,
            port: 'I2C',
            channels: 16,
            status: 'online'
          },
          {
            type: 'MFM384',
            model: '3-Phase Power Meter',
            address: 1,
            port: '/dev/ttyUSB0',
            channels: 1,
            status: 'online'
          }
        ];
        setAvailableDevices(demoDevices);
        toast({
          title: 'Scan Complete',
          description: `Found ${demoDevices.length} hardware devices`
        });
        setScanning(false);
      }, 2000); // Simulate scan delay
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sensors/scan`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setAvailableDevices(data);
      toast({
        title: 'Scan Complete',
        description: `Found ${data.length} hardware devices`
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to scan for devices',
        variant: 'destructive'
      });
    } finally {
      setScanning(false);
    }
  };

  const testSensorConfig = async () => {
    setTesting(true);
    try {
      const payload = {
        ...formData,
        equipment_id: parseInt(selectedEquipment),
        board_address: parseInt(formData.board_address),
        channel: specialBoardTypes.includes(formData.board_type) ? 0 : parseInt(formData.channel),
        calibration_offset: parseFloat(formData.calibration_offset) || 0,
        calibration_scale: parseFloat(formData.calibration_scale) || 1,
        scale_min: parseFloat(formData.scale_min),
        scale_max: parseFloat(formData.scale_max)
      };
      
      console.log('Testing sensor config:', payload);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sensors/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Test failed:', response.status, errorData);
        throw new Error(`Test failed: ${errorData}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: 'Test Successful',
          description: `Reading: ${data.value} ${formData.units}`
        });
      } else {
        throw new Error(data.error || 'Test failed');
      }
    } catch (error: any) {
      console.error('Test error:', error);
      toast({
        title: 'Test Failed',
        description: error.message || 'Could not read from sensor',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleAddSensor = async () => {
    try {
      const payload = {
        ...formData,
        equipment_id: parseInt(selectedEquipment),
        board_address: parseInt(formData.board_address),
        channel: specialBoardTypes.includes(formData.board_type) ? 0 : parseInt(formData.channel),
        calibration_offset: parseFloat(formData.calibration_offset),
        calibration_scale: parseFloat(formData.calibration_scale),
        scale_min: parseFloat(formData.scale_min),
        scale_max: parseFloat(formData.scale_max),
        alarm_low: formData.alarm_low ? parseFloat(formData.alarm_low) : null,
        alarm_high: formData.alarm_high ? parseFloat(formData.alarm_high) : null
      };
      
      console.log('Sending sensor config:', payload);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sensors/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Server response:', response.status, errorData);
        throw new Error(`Server error: ${response.status} - ${errorData}`);
      }
      
      const newSensor = await response.json();
      setSensorConfigs([...sensorConfigs, newSensor]);
      setIsAddDialogOpen(false);
      resetForm();
      toast({
        title: 'Success',
        description: 'Sensor configuration added'
      });
      
      // Refresh sensor configs
      fetchSensorConfigs();
    } catch (error: any) {
      console.error('Error adding sensor:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add sensor configuration',
        variant: 'destructive'
      });
    }
  };

  const handleEditSensor = async () => {
    if (!editingSensor) return;
    
    try {
      const payload = {
        ...formData,
        id: editingSensor.id,
        equipment_id: parseInt(selectedEquipment),
        board_address: parseInt(formData.board_address),
        channel: specialBoardTypes.includes(formData.board_type) ? 0 : parseInt(formData.channel),
        calibration_offset: parseFloat(formData.calibration_offset),
        calibration_scale: parseFloat(formData.calibration_scale),
        scale_min: parseFloat(formData.scale_min),
        scale_max: parseFloat(formData.scale_max),
        alarm_low: formData.alarm_low ? parseFloat(formData.alarm_low) : null,
        alarm_high: formData.alarm_high ? parseFloat(formData.alarm_high) : null
      };
      
      console.log('Updating sensor config:', payload);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sensors/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Server response:', response.status, errorData);
        throw new Error(`Server error: ${response.status} - ${errorData}`);
      }
      
      const updatedSensor = await response.json();
      setSensorConfigs(sensorConfigs.map(s => 
        s.id === updatedSensor.id ? updatedSensor : s
      ));
      setIsEditDialogOpen(false);
      resetForm();
      toast({
        title: 'Success',
        description: 'Sensor configuration updated'
      });
      
      // Refresh sensor configs
      fetchSensorConfigs();
    } catch (error: any) {
      console.error('Error updating sensor:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update sensor configuration',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteSensor = async () => {
    if (!deleteSensorId) return;
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/sensors/config/${deleteSensorId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      if (response.ok) {
        setSensorConfigs(sensorConfigs.filter(s => s.id !== deleteSensorId));
        setDeleteSensorId(null);
        toast({
          title: 'Success',
          description: 'Sensor configuration deleted'
        });
      } else {
        throw new Error('Failed to delete sensor');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete sensor configuration',
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      sensor_name: '',
      sensor_type: 'temperature',
      sensor_model: '',
      board_type: '',
      board_address: '',
      channel: '',
      input_range: '0-10V',
      units: '°F',
      calibration_offset: '0',
      calibration_scale: '1',
      scale_min: '0',
      scale_max: '100',
      alarm_low: '',
      alarm_high: '',
      enabled: true,
      port: '/dev/ttyUSB0'
    });
    setSelectedSensorModel(null);
    setEditingSensor(null);
  };

  // Handle sensor model selection and auto-populate configuration
  const handleSensorModelChange = (modelString: string) => {
    const modelConfig = sensorModels[formData.sensor_type as keyof typeof sensorModels]?.find(
      m => m.model === modelString
    );
    
    if (modelConfig) {
      setSelectedSensorModel(modelConfig);
      const defaultAddress = boardAddressDefaults[modelConfig.board_type as keyof typeof boardAddressDefaults];
      const isSpecialBoard = specialBoardTypes.includes(modelConfig.board_type);
      
      setFormData(prev => ({
        ...prev,
        sensor_model: modelConfig.model,
        board_type: modelConfig.board_type,
        board_address: defaultAddress?.toString() || '',
        input_range: modelConfig.input_range,
        units: modelConfig.units,
        scale_min: modelConfig.scale_min.toString(),
        scale_max: modelConfig.scale_max.toString(),
        channel: isSpecialBoard ? '0' : prev.channel,
        port: modelConfig.board_type.includes('485') ? '/dev/ttyUSB0' : ''
      }));
    } else {
      setFormData(prev => ({ ...prev, sensor_model: modelString }));
      setSelectedSensorModel(null);
    }
  };

  // Handle sensor type change
  const handleSensorTypeChange = (sensorType: string) => {
    const defaultUnits = unitOptions[sensorType as keyof typeof unitOptions]?.[0] || '°F';
    setFormData(prev => ({
      ...prev,
      sensor_type: sensorType,
      units: defaultUnits,
      sensor_model: '',
      board_type: '',
      board_address: '',
      input_range: '0-10V',
      scale_min: '0',
      scale_max: '100'
    }));
    setSelectedSensorModel(null);
  };

  const openEditDialog = (sensor: SensorConfig) => {
    setEditingSensor(sensor);
    setFormData({
      sensor_name: sensor.sensor_name,
      sensor_type: sensor.sensor_type,
      sensor_model: sensor.sensor_model,
      board_type: sensor.board_type,
      board_address: sensor.board_address.toString(),
      channel: sensor.channel.toString(),
      input_range: sensor.input_range,
      units: sensor.units,
      calibration_offset: sensor.calibration_offset.toString(),
      calibration_scale: sensor.calibration_scale.toString(),
      scale_min: sensor.scale_min.toString(),
      scale_max: sensor.scale_max.toString(),
      alarm_low: sensor.alarm_low?.toString() || '',
      alarm_high: sensor.alarm_high?.toString() || '',
      enabled: sensor.enabled,
      port: sensor.port
    });
    setIsEditDialogOpen(true);
  };

  const getSensorIcon = (type: string) => {
    const sensorType = sensorTypes.find(t => t.value === type);
    return sensorType ? sensorType.icon : Gauge;
  };

  // Power Metrics Card Component
  const PowerMetricsCard = ({ selectedEquipment }: { selectedEquipment: string }) => {
    const [powerMetrics, setPowerMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      fetchPowerMetrics();
    }, [selectedEquipment]);

    const fetchPowerMetrics = async () => {
      const isDemoMode = localStorage.getItem('demoMode') === 'true';
      setLoading(true);

      if (isDemoMode) {
        // Generate demo power metrics for 460V 3-phase system
        setTimeout(() => {
          setPowerMetrics({
            voltage_l1n: 266 + (Math.random() - 0.5) * 4,
            voltage_l2n: 265 + (Math.random() - 0.5) * 4,
            voltage_l3n: 267 + (Math.random() - 0.5) * 4,
            voltage_l12: 460 + (Math.random() - 0.5) * 6,
            voltage_l23: 458 + (Math.random() - 0.5) * 6,
            voltage_l31: 461 + (Math.random() - 0.5) * 6,
            current_l1: 45 + (Math.random() - 0.5) * 8,
            current_l2: 43 + (Math.random() - 0.5) * 8,
            current_l3: 44 + (Math.random() - 0.5) * 8,
            power: 28.5 + (Math.random() - 0.5) * 5,
            power_factor: 0.88 + (Math.random() - 0.5) * 0.05,
            frequency: 60 + (Math.random() - 0.5) * 0.2,
            energy: 1247.3 + Math.random() * 10
          });
          setLoading(false);
        }, 500);
        return;
      }

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/sensors/power-metrics/${selectedEquipment}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
        if (response.ok) {
          const data = await response.json();
          setPowerMetrics(data);
        } else {
          setPowerMetrics(null);
        }
      } catch (error) {
        console.error('Failed to fetch power metrics:', error);
        setPowerMetrics(null);
      } finally {
        setLoading(false);
      }
    };

    if (loading) {
      return (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Power Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32" />
          </CardContent>
        </Card>
      );
    }

    if (!powerMetrics) {
      return null;
    }

    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Power Metrics (MFM384)</CardTitle>
          <CardDescription>3-Phase electrical measurements</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Voltage (L-L)</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>L1-L2:</span>
                  <span className="font-mono">{powerMetrics.voltage_l12?.toFixed(1)} V</span>
                </div>
                <div className="flex justify-between">
                  <span>L2-L3:</span>
                  <span className="font-mono">{powerMetrics.voltage_l23?.toFixed(1)} V</span>
                </div>
                <div className="flex justify-between">
                  <span>L3-L1:</span>
                  <span className="font-mono">{powerMetrics.voltage_l31?.toFixed(1)} V</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Current</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>L1:</span>
                  <span className="font-mono">{powerMetrics.current_l1?.toFixed(1)} A</span>
                </div>
                <div className="flex justify-between">
                  <span>L2:</span>
                  <span className="font-mono">{powerMetrics.current_l2?.toFixed(1)} A</span>
                </div>
                <div className="flex justify-between">
                  <span>L3:</span>
                  <span className="font-mono">{powerMetrics.current_l3?.toFixed(1)} A</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Power</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Active:</span>
                  <span className="font-mono">{powerMetrics.power?.toFixed(2)} kW</span>
                </div>
                <div className="flex justify-between">
                  <span>PF:</span>
                  <span className="font-mono">{powerMetrics.power_factor?.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Energy:</span>
                  <span className="font-mono">{powerMetrics.energy?.toFixed(1)} kWh</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const getReadingStatus = (reading: SensorReading) => {
    switch (reading.status) {
      case 'normal':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Normal</Badge>;
      case 'warning':
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">Warning</Badge>;
      case 'alarm':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">Alarm</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
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
            Sensor Configuration
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure and monitor sensors for HVAC equipment
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={scanForDevices}
            disabled={scanning}
          >
            {scanning ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Wifi className="mr-2 h-4 w-4" />
                Scan Devices
              </>
            )}
          </Button>
          <Button 
            className="btn-primary"
            onClick={() => setIsAddDialogOpen(true)}
            disabled={!selectedEquipment}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Sensor
          </Button>
        </div>
      </div>

      {/* Equipment Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Equipment</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Select equipment to configure" />
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

      {selectedEquipment && (
        <Tabs defaultValue="configuration" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
            <TabsTrigger value="live">Live Readings</TabsTrigger>
            <TabsTrigger value="devices">Hardware Devices</TabsTrigger>
          </TabsList>

          {/* Configuration Tab */}
          <TabsContent value="configuration">
            <Card>
              <CardHeader>
                <CardTitle>Sensor Configurations</CardTitle>
                <CardDescription>
                  Configure sensor mappings to hardware channels
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sensor</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Board</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead>Range</TableHead>
                        <TableHead>Units</TableHead>
                        <TableHead>Alarms</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sensorConfigs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground">
                            No sensors configured
                          </TableCell>
                        </TableRow>
                      ) : (
                        sensorConfigs.map((sensor) => {
                          const Icon = getSensorIcon(sensor.sensor_type);
                          return (
                            <TableRow key={sensor.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4 text-teal-500" />
                                  <span className="font-medium">{sensor.sensor_name}</span>
                                </div>
                              </TableCell>
                              <TableCell>{sensor.sensor_type}</TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <div>{sensor.board_type}</div>
                                  <div className="text-muted-foreground">@{sensor.board_address}</div>
                                </div>
                              </TableCell>
                              <TableCell>CH{sensor.channel}</TableCell>
                              <TableCell>{sensor.input_range}</TableCell>
                              <TableCell>{sensor.units}</TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  {sensor.alarm_low && <div>L: {sensor.alarm_low}</div>}
                                  {sensor.alarm_high && <div>H: {sensor.alarm_high}</div>}
                                </div>
                              </TableCell>
                              <TableCell>
                                {sensor.enabled ? (
                                  <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                                ) : (
                                  <Badge variant="secondary">Disabled</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditDialog(sensor)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeleteSensorId(sensor.id)}
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

          {/* Live Readings Tab */}
          <TabsContent value="live">
            <Card>
              <CardHeader>
                <CardTitle>Live Sensor Readings</CardTitle>
                <CardDescription>
                  Real-time data from configured sensors
                </CardDescription>
              </CardHeader>
              <CardContent>
                {liveReadings.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No live readings available. Configure sensors first.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {liveReadings.map((reading, index) => {
                      const Icon = getSensorIcon(
                        sensorConfigs.find(s => s.sensor_name === reading.sensor_name)?.sensor_type || 'temperature'
                      );
                      return (
                        <Card key={index} className="hover-lift">
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Icon className="h-5 w-5 text-teal-500" />
                                <span className="font-medium">{reading.sensor_name}</span>
                              </div>
                              {getReadingStatus(reading)}
                            </div>
                            <div className="text-3xl font-bold">
                              {typeof reading.value === 'number' ? reading.value.toFixed(1) : reading.value} <span className="text-lg">{reading.units}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {new Date(reading.timestamp).toLocaleTimeString()}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Power Metrics Card */}
            <PowerMetricsCard selectedEquipment={selectedEquipment} />
          </TabsContent>

          {/* Hardware Devices Tab */}
          <TabsContent value="devices">
            <Card>
              <CardHeader>
                <CardTitle>Available Hardware Devices</CardTitle>
                <CardDescription>
                  Detected hardware boards and interfaces
                </CardDescription>
              </CardHeader>
              <CardContent>
                {availableDevices.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No devices found. Click "Scan Devices" to search for hardware.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availableDevices.map((device, index) => (
                      <Card key={index}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">
                              <div className="flex items-center gap-2">
                                <Cpu className="h-4 w-4" />
                                {device.type}
                              </div>
                            </CardTitle>
                            <Badge variant={device.status === 'online' ? 'default' : 'secondary'}>
                              {device.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Model:</span>
                              <span>{device.model}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Address:</span>
                              <span className="font-mono">
                                {device.port === 'I2C' ? `0x${device.address.toString(16).toUpperCase()}` : device.address}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Port:</span>
                              <span className="font-mono">{device.port}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Channels:</span>
                              <span>{device.channels}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false);
          setIsEditDialogOpen(false);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditDialogOpen ? 'Edit Sensor Configuration' : 'Add Sensor Configuration'}
            </DialogTitle>
            <DialogDescription>
              Configure sensor hardware mapping and parameters
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sensor Name</Label>
                <Input
                  value={formData.sensor_name}
                  onChange={(e) => setFormData({...formData, sensor_name: e.target.value})}
                  placeholder="e.g., Supply Air Temperature"
                />
              </div>
              <div className="space-y-2">
                <Label>Sensor Type</Label>
                <Select
                  value={formData.sensor_type}
                  onValueChange={handleSensorTypeChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sensorTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sensor Model Selection */}
            <div className="space-y-2">
              <Label>Sensor Model</Label>
              <Select
                value={formData.sensor_model}
                onValueChange={handleSensorModelChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sensor model for auto-configuration" />
                </SelectTrigger>
                <SelectContent>
                  {sensorModels[formData.sensor_type as keyof typeof sensorModels]?.map(model => (
                    <SelectItem key={model.model} value={model.model}>
                      <div>
                        <div className="font-medium">{model.model}</div>
                        <div className="text-xs text-muted-foreground">{model.description}</div>
                      </div>
                    </SelectItem>
                  )) || (
                    <SelectItem value="custom" disabled>
                      No predefined models for this sensor type
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {selectedSensorModel && (
                <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded border text-sm">
                  <div className="text-green-700 dark:text-green-300 font-medium mb-1">Auto-configured:</div>
                  <div className="text-green-600 dark:text-green-400">
                    Board: {selectedSensorModel.board_type} • Range: {selectedSensorModel.input_range} • 
                    Scale: {selectedSensorModel.scale_min}-{selectedSensorModel.scale_max} {selectedSensorModel.units}
                  </div>
                </div>
              )}
            </div>

            {/* Hardware Config */}
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Board Type {selectedSensorModel && <span className="text-xs text-green-600 dark:text-green-400">(auto-set)</span>}</Label>
                <Select
                  value={formData.board_type}
                  onValueChange={(value) => {
                    const defaultAddress = boardAddressDefaults[value as keyof typeof boardAddressDefaults];
                    setFormData({
                      ...formData, 
                      board_type: value,
                      board_address: defaultAddress?.toString() || formData.board_address
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select board" />
                  </SelectTrigger>
                  <SelectContent>
                    {boardTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Stack Number {selectedSensorModel && <span className="text-xs text-green-600 dark:text-green-400">(auto-set)</span>}</Label>
                <Input
                  type="number"
                  value={formData.board_address}
                  onChange={(e) => setFormData({...formData, board_address: e.target.value})}
                  placeholder="Stack 0-7"
                />
                {formData.board_type && boardAddressDefaults[formData.board_type as keyof typeof boardAddressDefaults] !== undefined && (
                  <div className="text-xs text-muted-foreground">
                    Default for {formData.board_type}: Stack {boardAddressDefaults[formData.board_type as keyof typeof boardAddressDefaults]}
                    {formData.board_type === 'megabas' && ' (Currently at 0x48)'}
                    {formData.board_type === '16univin' && ' (Currently at 0x5c)'}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Channel {specialBoardTypes.includes(formData.board_type) && <span className="text-xs text-muted-foreground">(not required)</span>}</Label>
                <Input
                  type="number"
                  value={formData.channel}
                  onChange={(e) => setFormData({...formData, channel: e.target.value})}
                  placeholder={specialBoardTypes.includes(formData.board_type) ? 'N/A' : '1-16'}
                  disabled={specialBoardTypes.includes(formData.board_type)}
                />
                <div className="text-xs text-muted-foreground">
                  {formData.board_type === 'MegaBAS' && 'MegaBAS: 1-8 channels'}
                  {formData.board_type === '16UnivIn' && '16UnivIn: 1-16 channels'}
                  {formData.board_type === 'SELEC MFM384' && '3-phase power meter (no channel needed)'}
                  {formData.board_type === 'WitMotion WT901C485' && 'Vibration sensor (no channel needed)'}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Input Range {selectedSensorModel && <span className="text-xs text-green-600 dark:text-green-400">(auto-set)</span>} {specialBoardTypes.includes(formData.board_type) && <span className="text-xs text-muted-foreground">(preset)</span>}</Label>
                <Select
                  value={formData.input_range}
                  onValueChange={(value) => setFormData({...formData, input_range: value})}
                  disabled={specialBoardTypes.includes(formData.board_type)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {inputRanges.map(range => (
                      <SelectItem key={range} value={range}>{range}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Port {selectedSensorModel && <span className="text-xs text-green-600 dark:text-green-400">(auto-set)</span>}</Label>
                <Input
                  value={formData.port}
                  onChange={(e) => setFormData({...formData, port: e.target.value})}
                  placeholder="/dev/ttyUSB0"
                />
                <div className="text-xs text-muted-foreground">
                  {formData.board_type?.includes('485') ? 'RS485 devices need serial port' : 'I2C devices don\'t need port'}
                </div>
              </div>
            </div>

            {/* Scaling */}
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Units {selectedSensorModel && <span className="text-xs text-green-600 dark:text-green-400">(auto-set)</span>}</Label>
                <Select
                  value={formData.units}
                  onValueChange={(value) => setFormData({...formData, units: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {unitOptions[formData.sensor_type as keyof typeof unitOptions]?.map(unit => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nexus AI Model (Routes To)</Label>
                <div className="flex items-center h-10 px-3 rounded-md border bg-muted">
                  <span className="text-sm font-medium">
                    {sensorTypeToAIModel[formData.sensor_type as keyof typeof sensorTypeToAIModel] || 'APOLLO (Master)'}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  This sensor data is processed by the {sensorTypeToAIModel[formData.sensor_type as keyof typeof sensorTypeToAIModel] || 'APOLLO'} AI model
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Scale Min {selectedSensorModel && <span className="text-xs text-green-600 dark:text-green-400">(auto-set)</span>}</Label>
                <Input
                  type="number"
                  value={formData.scale_min}
                  onChange={(e) => setFormData({...formData, scale_min: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Scale Max {selectedSensorModel && <span className="text-xs text-green-600 dark:text-green-400">(auto-set)</span>}</Label>
                <Input
                  type="number"
                  value={formData.scale_max}
                  onChange={(e) => setFormData({...formData, scale_max: e.target.value})}
                />
              </div>
            </div>

            {/* Calibration */}
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Calibration Offset</Label>
                <Input
                  type="number"
                  value={formData.calibration_offset}
                  onChange={(e) => setFormData({...formData, calibration_offset: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Calibration Scale</Label>
                <Input
                  type="number"
                  value={formData.calibration_scale}
                  onChange={(e) => setFormData({...formData, calibration_scale: e.target.value})}
                />
              </div>
            </div>

            {/* Alarms */}
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Alarm Low</Label>
                <Input
                  type="number"
                  value={formData.alarm_low}
                  onChange={(e) => setFormData({...formData, alarm_low: e.target.value})}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>Alarm High</Label>
                <Input
                  type="number"
                  value={formData.alarm_high}
                  onChange={(e) => setFormData({...formData, alarm_high: e.target.value})}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({...formData, enabled: checked})}
              />
              <Label htmlFor="enabled">Sensor Enabled</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={testSensorConfig}
              disabled={testing || !formData.board_type || !formData.board_address || (!formData.channel && !specialBoardTypes.includes(formData.board_type))}
            >
              {testing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube className="mr-2 h-4 w-4" />
                  Test Sensor
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setIsEditDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={isEditDialogOpen ? handleEditSensor : handleAddSensor}
              className="btn-primary"
            >
              {isEditDialogOpen ? 'Update' : 'Add'} Sensor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteSensorId} onOpenChange={() => setDeleteSensorId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the sensor
              configuration and stop monitoring this sensor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteSensor}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
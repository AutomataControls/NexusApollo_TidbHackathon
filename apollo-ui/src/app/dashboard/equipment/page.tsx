'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Cpu, 
  Calendar,
  AlertCircle,
  Settings,
  Trash,
  Edit,
  Activity,
  ThermometerSun,
  Wind,
  Gauge,
  CheckCircle,
  XCircle,
  Clock,
  Building,
  MapPin,
  Hash
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
  DialogTrigger,
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
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface Equipment {
  id: number;
  customer_id: number;
  location_name: string;
  equipment_type: string;
  manufacturer: string;
  model_number: string;
  serial_number: string;
  install_date: string;
  warranty_expiry: string;
  refrigerant_type: string;
  refrigerant_amount: number;
  notes: string;
  created_at: string;
  updated_at: string;
  // Joined customer fields from backend
  customer_name?: string;
  customer_contact?: string;
}

interface EquipmentHealth {
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  lastReading: string;
  faultCount: number;
  efficiency: number;
  power: number;
}

interface Customer {
  id: number;
  company_name?: string;
  name?: string;  // Backend returns 'name' not 'company_name'
}

const equipmentTypes = [
  'Air Handler Unit (AHU)',
  'Rooftop Unit (RTU)',
  'Variable Air Volume (VAV)',
  'Fan Coil Unit (FCU)',
  'Chiller',
  'Boiler',
  'Heat Pump',
  'Split System',
  'Package Unit'
];

const refrigerantTypes = [
  'R-410A',
  'R-32',
  'R-134a',
  'R-407C',
  'R-404A',
  'R-454B',
  'R-508B',
  'R-22',
  'R-744 (CO2)',
  'R-290 (Propane)'
];

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [healthData, setHealthData] = useState<{ [key: number]: EquipmentHealth }>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCustomer, setFilterCustomer] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteEquipmentId, setDeleteEquipmentId] = useState<number | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    customer_id: '',
    location_name: '',
    equipment_type: '',
    manufacturer: '',
    model_number: '',
    serial_number: '',
    install_date: '',
    warranty_expiry: '',
    refrigerant_type: '',
    refrigerant_amount: '',
    notes: ''
  });

  useEffect(() => {
    fetchEquipment();
    fetchCustomers();
  }, []);

  const fetchEquipment = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/equipment`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setEquipment(data);
      
      // Fetch health status for each equipment
      data.forEach((eq: Equipment) => {
        fetchEquipmentHealth(eq.id);
      });
    } catch (error) {
      console.error('Failed to fetch equipment:', error);
      toast({
        title: 'Error',
        description: 'Failed to load equipment data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      console.log('Fetched customers:', data);
      setCustomers(data);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  };

  const fetchEquipmentHealth = async (id: number) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/equipment/${id}/health`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setHealthData(prev => ({ ...prev, [id]: data }));
    } catch (error) {
      console.error('Failed to fetch equipment health:', error);
    }
  };

  const handleAddEquipment = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/equipment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        const newEquipment = await response.json();
        setEquipment([newEquipment, ...equipment]);
        fetchEquipmentHealth(newEquipment.id);
        setIsAddDialogOpen(false);
        resetForm();
        toast({
          title: 'Success',
          description: 'Equipment added successfully'
        });
      } else {
        throw new Error('Failed to add equipment');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add equipment',
        variant: 'destructive'
      });
    }
  };

  const handleEditEquipment = async () => {
    if (!selectedEquipment) return;
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/equipment/${selectedEquipment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        const updatedEquipment = await response.json();
        setEquipment(equipment.map(eq => 
          eq.id === updatedEquipment.id ? updatedEquipment : eq
        ));
        setIsEditDialogOpen(false);
        resetForm();
        toast({
          title: 'Success',
          description: 'Equipment updated successfully'
        });
      } else {
        throw new Error('Failed to update equipment');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update equipment',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteEquipment = async () => {
    if (!deleteEquipmentId) return;
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/equipment/${deleteEquipmentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        setEquipment(equipment.filter(eq => eq.id !== deleteEquipmentId));
        setDeleteEquipmentId(null);
        toast({
          title: 'Success',
          description: 'Equipment deleted successfully'
        });
      } else {
        throw new Error('Failed to delete equipment');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete equipment',
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      customer_id: '',
      location_name: '',
      equipment_type: '',
      manufacturer: '',
      model_number: '',
      serial_number: '',
      install_date: '',
      warranty_expiry: '',
      refrigerant_type: '',
      refrigerant_amount: '',
      notes: ''
    });
    setSelectedEquipment(null);
  };

  const openEditDialog = (eq: Equipment) => {
    setSelectedEquipment(eq);
    setFormData({
      customer_id: eq.customer_id.toString(),
      location_name: eq.location_name,
      equipment_type: eq.equipment_type,
      manufacturer: eq.manufacturer,
      model_number: eq.model_number,
      serial_number: eq.serial_number,
      install_date: eq.install_date?.split('T')[0] || '',
      warranty_expiry: eq.warranty_expiry?.split('T')[0] || '',
      refrigerant_type: eq.refrigerant_type || '',
      refrigerant_amount: eq.refrigerant_amount?.toString() || '',
      notes: eq.notes || ''
    });
    setIsEditDialogOpen(true);
  };

  const filteredEquipment = equipment.filter(eq => {
    const matchesSearch = eq.location_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         eq.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         eq.model_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || eq.equipment_type === filterType;
    const matchesCustomer = filterCustomer === 'all' || eq.customer_id.toString() === filterCustomer;
    return matchesSearch && matchesType && matchesCustomer;
  });

  const getStatusBadge = (health?: EquipmentHealth) => {
    if (!health) return <Badge variant="secondary">Unknown</Badge>;
    
    switch (health.status) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Healthy</Badge>;
      case 'warning':
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">Warning</Badge>;
      case 'critical':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">Critical</Badge>;
      case 'offline':
        return <Badge variant="secondary">Offline</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getCustomerName = (eq: Equipment) => {
    // First try to use joined customer data from backend
    if (eq.customer_name) {
      return eq.customer_name;
    }
    // Fallback to looking up in customers array
    const customer = customers.find(c => c.id === eq.customer_id);
    return customer?.name || 'Unknown';
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
            Equipment Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage and monitor HVAC equipment across all customers
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary">
              <Plus className="mr-2 h-4 w-4" />
              Add Equipment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Equipment</DialogTitle>
              <DialogDescription>
                Enter the equipment details to add it to the system
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer">Customer</Label>
                  <Select
                    value={formData.customer_id}
                    onValueChange={(value) => setFormData({...formData, customer_id: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(customer => (
                        <SelectItem key={customer.id} value={customer.id.toString()}>
                          {customer.name || 'Unknown Customer'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location Name</Label>
                  <Input
                    id="location"
                    value={formData.location_name}
                    onChange={(e) => setFormData({...formData, location_name: e.target.value})}
                    placeholder="e.g., Building A - Rooftop"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Equipment Type</Label>
                  <Select
                    value={formData.equipment_type}
                    onValueChange={(value) => setFormData({...formData, equipment_type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {equipmentTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Input
                    id="manufacturer"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({...formData, manufacturer: e.target.value})}
                    placeholder="e.g., Carrier"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="model">Model Number</Label>
                  <Input
                    id="model"
                    value={formData.model_number}
                    onChange={(e) => setFormData({...formData, model_number: e.target.value})}
                    placeholder="e.g., 48TFE004"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serial">Serial Number</Label>
                  <Input
                    id="serial"
                    value={formData.serial_number}
                    onChange={(e) => setFormData({...formData, serial_number: e.target.value})}
                    placeholder="e.g., 1234567890"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="install">Install Date</Label>
                  <Input
                    id="install"
                    type="date"
                    value={formData.install_date}
                    onChange={(e) => setFormData({...formData, install_date: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="warranty">Warranty Expiry</Label>
                  <Input
                    id="warranty"
                    type="date"
                    value={formData.warranty_expiry}
                    onChange={(e) => setFormData({...formData, warranty_expiry: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="refrigerant">Refrigerant Type</Label>
                  <Select
                    value={formData.refrigerant_type}
                    onValueChange={(value) => setFormData({...formData, refrigerant_type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select refrigerant" />
                    </SelectTrigger>
                    <SelectContent>
                      {refrigerantTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Refrigerant Amount (lbs)</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={formData.refrigerant_amount}
                    onChange={(e) => setFormData({...formData, refrigerant_amount: e.target.value})}
                    placeholder="e.g., 12.5"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Additional notes about this equipment..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddEquipment} className="btn-primary">
                Add Equipment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="hover-lift">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Equipment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{equipment.length}</div>
              <Cpu className="h-8 w-8 text-teal-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover-lift">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Healthy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-green-600">
                {Object.values(healthData).filter(h => h.status === 'healthy').length}
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover-lift">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-amber-600">
                {Object.values(healthData).filter(h => h.status === 'warning').length}
              </div>
              <AlertCircle className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover-lift">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Critical
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-red-600">
                {Object.values(healthData).filter(h => h.status === 'critical').length}
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Equipment List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by location, serial, or model..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Equipment Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {equipmentTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCustomer} onValueChange={setFilterCustomer}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {customers.map(customer => (
                  <SelectItem key={customer.id} value={customer.id.toString()}>
                    {customer.name || 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Equipment Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Efficiency</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEquipment.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No equipment found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEquipment.map((eq) => (
                    <TableRow key={eq.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          {eq.location_name}
                        </div>
                      </TableCell>
                      <TableCell>{eq.equipment_type}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          {getCustomerName(eq)}
                        </div>
                      </TableCell>
                      <TableCell>{eq.model_number}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Hash className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono text-xs">{eq.serial_number}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(healthData[eq.id])}</TableCell>
                      <TableCell>
                        {healthData[eq.id] ? (
                          <div className="flex items-center gap-2">
                            <Gauge className="h-4 w-4 text-teal-500" />
                            <span>{healthData[eq.id].efficiency}%</span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(eq)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteEquipmentId(eq.id)}
                          >
                            <Trash className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Equipment</DialogTitle>
            <DialogDescription>
              Update the equipment details
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-customer">Customer</Label>
                <Select
                  value={formData.customer_id}
                  onValueChange={(value) => setFormData({...formData, customer_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(customer => (
                      <SelectItem key={customer.id} value={customer.id.toString()}>
                        {customer.name || 'Unknown'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-location">Location Name</Label>
                <Input
                  id="edit-location"
                  value={formData.location_name}
                  onChange={(e) => setFormData({...formData, location_name: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-type">Equipment Type</Label>
                <Select
                  value={formData.equipment_type}
                  onValueChange={(value) => setFormData({...formData, equipment_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipmentTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-manufacturer">Manufacturer</Label>
                <Input
                  id="edit-manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({...formData, manufacturer: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-model">Model Number</Label>
                <Input
                  id="edit-model"
                  value={formData.model_number}
                  onChange={(e) => setFormData({...formData, model_number: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-serial">Serial Number</Label>
                <Input
                  id="edit-serial"
                  value={formData.serial_number}
                  onChange={(e) => setFormData({...formData, serial_number: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-install">Install Date</Label>
                <Input
                  id="edit-install"
                  type="date"
                  value={formData.install_date}
                  onChange={(e) => setFormData({...formData, install_date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-warranty">Warranty Expiry</Label>
                <Input
                  id="edit-warranty"
                  type="date"
                  value={formData.warranty_expiry}
                  onChange={(e) => setFormData({...formData, warranty_expiry: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-refrigerant">Refrigerant Type</Label>
                <Select
                  value={formData.refrigerant_type}
                  onValueChange={(value) => setFormData({...formData, refrigerant_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select refrigerant" />
                  </SelectTrigger>
                  <SelectContent>
                    {refrigerantTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-amount">Refrigerant Amount (lbs)</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  value={formData.refrigerant_amount}
                  onChange={(e) => setFormData({...formData, refrigerant_amount: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditEquipment} className="btn-primary">
              Update Equipment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteEquipmentId} onOpenChange={() => setDeleteEquipmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the equipment
              and all associated sensor configurations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteEquipment}
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
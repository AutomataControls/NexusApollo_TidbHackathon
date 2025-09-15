import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import {
  Server, Plus, Edit2, Trash2, Save, X, Search,
  MapPin, Calendar, Shield, Snowflake, AlertCircle,
  Settings, Activity, BarChart3, ChevronRight
} from 'lucide-react';

interface EquipmentProps {
  socket: Socket | null;
}

interface Equipment {
  id?: number;
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
  created_at?: string;
  updated_at?: string;
}

interface Customer {
  id: number;
  name: string;
}

const Equipment: React.FC<EquipmentProps> = ({ socket }) => {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Equipment>({
    customer_id: 0,
    location_name: '',
    equipment_type: 'Split System',
    manufacturer: '',
    model_number: '',
    serial_number: '',
    install_date: '',
    warranty_expiry: '',
    refrigerant_type: 'R410A',
    refrigerant_amount: 0,
    notes: ''
  });

  const equipmentTypes = [
    'Split System',
    'Package Unit',
    'Chiller',
    'VRF System',
    'Heat Pump',
    'Air Handler',
    'Boiler',
    'Cooling Tower',
    'Rooftop Unit',
    'Mini Split'
  ];

  const refrigerantTypes = [
    'R22',
    'R410A',
    'R407C',
    'R134a',
    'R404A',
    'R32',
    'R454B',
    'R290',
    'R600a'
  ];

  useEffect(() => {
    loadCustomers();
    loadEquipment();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      loadEquipment();
    }
  }, [selectedCustomer]);

  const loadCustomers = async () => {
    try {
      const response = await fetch('/api/customers');
      const data = await response.json();
      setCustomers(data);
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  };

  const loadEquipment = async () => {
    try {
      let url = '/api/equipment';
      if (selectedCustomer) {
        url += `?customer_id=${selectedCustomer}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      setEquipment(data);
    } catch (error) {
      console.error('Failed to load equipment:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`/api/equipment${editingId ? `/${editingId}` : ''}`, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        loadEquipment();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save equipment:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this equipment? All associated sensor configurations will also be deleted.')) {
      return;
    }

    try {
      const response = await fetch(`/api/equipment/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        loadEquipment();
      }
    } catch (error) {
      console.error('Failed to delete equipment:', error);
    }
  };

  const handleEdit = (equipment: Equipment) => {
    setFormData(equipment);
    setEditingId(equipment.id!);
    setShowAddForm(true);
  };

  const resetForm = () => {
    setFormData({
      customer_id: parseInt(selectedCustomer) || 0,
      location_name: '',
      equipment_type: 'Split System',
      manufacturer: '',
      model_number: '',
      serial_number: '',
      install_date: '',
      warranty_expiry: '',
      refrigerant_type: 'R410A',
      refrigerant_amount: 0,
      notes: ''
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  const navigateToSensors = (equipmentId: number) => {
    // This would typically use React Router
    window.location.hash = `#sensors/${equipmentId}`;
  };

  const startMonitoring = (equipmentId: number) => {
    if (socket) {
      socket.emit('start-monitoring', equipmentId);
    }
  };

  const filteredEquipment = equipment.filter(eq =>
    eq.location_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    eq.model_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    eq.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    eq.manufacturer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCustomerName = (customerId: number) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || 'Unknown';
  };

  const isWarrantyExpired = (expiryDate: string) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  return (
    <div className="equipment-page">
      <div className="page-header">
        <h1>
          <Server className="page-icon" />
          Equipment
        </h1>
        <div className="header-actions">
          <select
            className="customer-filter"
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
          >
            <option value="">All Customers</option>
            {customers.map(customer => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
          
          <div className="search-bar">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search equipment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <button
            className="btn-primary"
            onClick={() => {
              setFormData({ ...formData, customer_id: parseInt(selectedCustomer) || 0 });
              setShowAddForm(true);
            }}
          >
            <Plus size={16} />
            Add Equipment
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="equipment-form-card">
          <h3>
            {editingId ? <Edit2 size={20} /> : <Plus size={20} />}
            {editingId ? 'Edit Equipment' : 'New Equipment'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Customer</label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: parseInt(e.target.value) })}
                  required
                >
                  <option value="">Select Customer</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Location Name</label>
                <input
                  type="text"
                  value={formData.location_name}
                  onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                  required
                  placeholder="Rooftop Unit #1"
                />
              </div>

              <div className="form-group">
                <label>Equipment Type</label>
                <select
                  value={formData.equipment_type}
                  onChange={(e) => setFormData({ ...formData, equipment_type: e.target.value })}
                  required
                >
                  {equipmentTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Manufacturer</label>
                <input
                  type="text"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  required
                  placeholder="Carrier"
                />
              </div>

              <div className="form-group">
                <label>Model Number</label>
                <input
                  type="text"
                  value={formData.model_number}
                  onChange={(e) => setFormData({ ...formData, model_number: e.target.value })}
                  required
                  placeholder="38AKS024"
                />
              </div>

              <div className="form-group">
                <label>Serial Number</label>
                <input
                  type="text"
                  value={formData.serial_number}
                  onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                  required
                  placeholder="1234567890"
                />
              </div>

              <div className="form-group">
                <label>Install Date</label>
                <input
                  type="date"
                  value={formData.install_date}
                  onChange={(e) => setFormData({ ...formData, install_date: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Warranty Expiry</label>
                <input
                  type="date"
                  value={formData.warranty_expiry}
                  onChange={(e) => setFormData({ ...formData, warranty_expiry: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Refrigerant Type</label>
                <select
                  value={formData.refrigerant_type}
                  onChange={(e) => setFormData({ ...formData, refrigerant_type: e.target.value })}
                >
                  {refrigerantTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Refrigerant Amount (lbs)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.refrigerant_amount}
                  onChange={(e) => setFormData({ ...formData, refrigerant_amount: parseFloat(e.target.value) || 0 })}
                  placeholder="12.5"
                />
              </div>

              <div className="form-group full-width">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes about this equipment..."
                  rows={3}
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={resetForm}
              >
                <X size={16} />
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                <Save size={16} />
                {editingId ? 'Update' : 'Save'} Equipment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Equipment List */}
      <div className="equipment-grid">
        {filteredEquipment.length === 0 ? (
          <div className="empty-state">
            <Server size={48} />
            <p>No equipment found</p>
            {searchTerm && (
              <button
                className="btn-secondary"
                onClick={() => setSearchTerm('')}
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          filteredEquipment.map(eq => (
            <div key={eq.id} className="equipment-card">
              <div className="equipment-header">
                <div className="equipment-title">
                  <Server size={24} />
                  <div>
                    <h4>{eq.location_name}</h4>
                    <span className="equipment-type">{eq.equipment_type}</span>
                  </div>
                </div>
                <div className="equipment-actions">
                  <button
                    className="btn-icon"
                    onClick={() => handleEdit(eq)}
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    className="btn-icon danger"
                    onClick={() => handleDelete(eq.id!)}
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="equipment-details">
                <div className="detail-row">
                  <span className="detail-label">Customer:</span>
                  <span>{getCustomerName(eq.customer_id)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Model:</span>
                  <span>{eq.manufacturer} {eq.model_number}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Serial:</span>
                  <span className="mono">{eq.serial_number}</span>
                </div>
                {eq.install_date && (
                  <div className="detail-row">
                    <Calendar size={14} />
                    <span>Installed: {new Date(eq.install_date).toLocaleDateString()}</span>
                  </div>
                )}
                {eq.warranty_expiry && (
                  <div className="detail-row">
                    <Shield size={14} className={isWarrantyExpired(eq.warranty_expiry) ? 'text-danger' : 'text-success'} />
                    <span className={isWarrantyExpired(eq.warranty_expiry) ? 'text-danger' : ''}>
                      Warranty: {new Date(eq.warranty_expiry).toLocaleDateString()}
                      {isWarrantyExpired(eq.warranty_expiry) && ' (Expired)'}
                    </span>
                  </div>
                )}
                {eq.refrigerant_type && (
                  <div className="detail-row">
                    <Snowflake size={14} />
                    <span>{eq.refrigerant_type} ({eq.refrigerant_amount} lbs)</span>
                  </div>
                )}
              </div>

              <div className="equipment-footer">
                <button
                  className="btn-secondary small"
                  onClick={() => navigateToSensors(eq.id!)}
                >
                  <Settings size={14} />
                  Configure Sensors
                </button>
                <button
                  className="btn-primary small"
                  onClick={() => startMonitoring(eq.id!)}
                >
                  <Activity size={14} />
                  Start Monitoring
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Equipment;
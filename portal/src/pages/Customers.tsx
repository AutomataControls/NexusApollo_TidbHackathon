import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import {
  Users, Plus, Edit2, Trash2, Save, X, Search,
  Phone, Mail, MapPin, Building, User, Calendar
} from 'lucide-react';

interface CustomersProps {
  socket: Socket | null;
}

interface Customer {
  id?: number;
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  created_at?: string;
  updated_at?: string;
}

const Customers: React.FC<CustomersProps> = ({ socket }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Customer>({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: ''
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const response = await fetch('/api/customers');
      const data = await response.json();
      setCustomers(data);
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`/api/customers${editingId ? `/${editingId}` : ''}`, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        loadCustomers();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save customer:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this customer?')) {
      return;
    }

    try {
      const response = await fetch(`/api/customers/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        loadCustomers();
      }
    } catch (error) {
      console.error('Failed to delete customer:', error);
    }
  };

  const handleEdit = (customer: Customer) => {
    setFormData(customer);
    setEditingId(customer.id!);
    setShowAddForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      contact_name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zip: ''
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="customers-page">
      <div className="page-header">
        <h1>
          <Users className="page-icon" />
          Customers
        </h1>
        <div className="header-actions">
          <div className="search-bar">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            className="btn-primary"
            onClick={() => setShowAddForm(true)}
          >
            <Plus size={16} />
            Add Customer
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="customer-form-card">
          <h3>
            {editingId ? <Edit2 size={20} /> : <Plus size={20} />}
            {editingId ? 'Edit Customer' : 'New Customer'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Company Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="ABC Corporation"
                />
              </div>

              <div className="form-group">
                <label>Contact Name</label>
                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  required
                  placeholder="John Smith"
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="john.smith@example.com"
                />
              </div>

              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="form-group full-width">
                <label>Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                  placeholder="123 Main Street"
                />
              </div>

              <div className="form-group">
                <label>City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  required
                  placeholder="New York"
                />
              </div>

              <div className="form-group">
                <label>State</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  required
                  maxLength={2}
                  placeholder="NY"
                />
              </div>

              <div className="form-group">
                <label>Zip Code</label>
                <input
                  type="text"
                  value={formData.zip}
                  onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                  required
                  placeholder="10001"
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
                {editingId ? 'Update' : 'Save'} Customer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Customer List */}
      <div className="customers-grid">
        {filteredCustomers.length === 0 ? (
          <div className="empty-state">
            <Users size={48} />
            <p>No customers found</p>
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
          filteredCustomers.map(customer => (
            <div key={customer.id} className="customer-card">
              <div className="customer-header">
                <Building size={24} />
                <h4>{customer.name}</h4>
              </div>
              
              <div className="customer-details">
                <div className="detail-item">
                  <User size={16} />
                  <span>{customer.contact_name}</span>
                </div>
                <div className="detail-item">
                  <Mail size={16} />
                  <a href={`mailto:${customer.email}`}>{customer.email}</a>
                </div>
                <div className="detail-item">
                  <Phone size={16} />
                  <a href={`tel:${customer.phone}`}>{customer.phone}</a>
                </div>
                <div className="detail-item">
                  <MapPin size={16} />
                  <span>{customer.address}<br />{customer.city}, {customer.state} {customer.zip}</span>
                </div>
                {customer.created_at && (
                  <div className="detail-item">
                    <Calendar size={16} />
                    <span>Customer since {new Date(customer.created_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              <div className="customer-actions">
                <button
                  className="btn-icon"
                  onClick={() => handleEdit(customer)}
                >
                  <Edit2 size={16} />
                </button>
                <button
                  className="btn-icon danger"
                  onClick={() => handleDelete(customer.id!)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Customers;
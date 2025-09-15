import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon, Save, User, Bell, Mail,
  Database, Cpu, Shield, Key, Globe, Clock,
  DollarSign, Thermometer, AlertTriangle, Check
} from 'lucide-react';
import UserModal from '../components/UserModal';

interface SettingsProps {}

interface SystemSettings {
  general: {
    companyName: string;
    timezone: string;
    dateFormat: string;
    temperatureUnit: 'F' | 'C';
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
  users: Array<{
    id: number;
    username: string;
    name: string;
    email: string;
    role: string;
    lastLogin: string;
  }>;
}

const Settings: React.FC<SettingsProps> = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'energy' | 'hardware' | 'users'>('general');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [settings, setSettings] = useState<SystemSettings>({
    general: {
      companyName: 'AutomataNexus',
      timezone: 'America/New_York',
      dateFormat: 'MM/DD/YYYY',
      temperatureUnit: 'F'
    },
    notifications: {
      emailEnabled: true,
      emailFrom: 'noreply@automatacontrols.com',
      criticalAlerts: true,
      warningAlerts: true,
      dailyDigest: true,
      digestTime: '08:00'
    },
    energy: {
      utilityProvider: 'ConEd',
      kwhRate: 0.15,
      demandRate: 25.00,
      currency: 'USD',
      billingCycle: 'monthly'
    },
    hardware: {
      sensorPollInterval: 1000,
      dataRetentionDays: 90,
      enableHailo: true,
      enableApollo: true
    },
    users: []
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  useEffect(() => {
    loadSettings();
    loadUsers();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      setSettings(prev => ({ ...prev, ...data }));
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const users = await response.json();
      setSettings(prev => ({ ...prev, users }));
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      setHasChanges(false);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (category: keyof SystemSettings, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...(prev[category] as any),
        [key]: value
      }
    }));
    setHasChanges(true);
  };

  const testEmailConnection = async () => {
    setTestingEmail(true);
    try {
      await fetch('/api/settings/test-email', { method: 'POST' });
      alert('Test email sent successfully!');
    } catch (error) {
      alert('Failed to send test email');
    } finally {
      setTestingEmail(false);
    }
  };

  const addUser = () => {
    setEditingUser(null);
    setShowUserModal(true);
  };

  const editUser = (user: any) => {
    setEditingUser(user);
    setShowUserModal(true);
  };

  const saveUser = async (userData: any) => {
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(userData)
      });

      if (response.ok) {
        // Reload users
        loadUsers();
        setShowUserModal(false);
        alert(editingUser ? 'User updated successfully!' : 'User created successfully!');
      } else {
        alert('Failed to save user');
      }
    } catch (error) {
      console.error('Failed to save user:', error);
      alert('Failed to save user');
    }
  };


  const tabs = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'energy', label: 'Energy & Billing', icon: DollarSign },
    { id: 'hardware', label: 'Hardware', icon: Cpu },
    { id: 'users', label: 'Users', icon: User }
  ];

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>
          <SettingsIcon className="page-icon" />
          System Settings
        </h1>
        <div className="header-actions">
          {hasChanges && (
            <span className="unsaved-changes">
              <AlertTriangle size={16} />
              Unsaved changes
            </span>
          )}
          <button
            className="btn-primary"
            onClick={saveSettings}
            disabled={!hasChanges || saving}
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="settings-container">
        {/* Tab Navigation */}
        <div className="settings-tabs">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id as any)}
              >
                <Icon size={20} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="settings-content">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="settings-section">
              <h2>General Settings</h2>
              
              <div className="setting-group">
                <label>Company Name</label>
                <input
                  type="text"
                  value={settings.general.companyName}
                  onChange={(e) => updateSetting('general', 'companyName', e.target.value)}
                />
              </div>

              <div className="setting-group">
                <label>Timezone</label>
                <select
                  value={settings.general.timezone}
                  onChange={(e) => updateSetting('general', 'timezone', e.target.value)}
                >
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                </select>
              </div>

              <div className="setting-group">
                <label>Date Format</label>
                <select
                  value={settings.general.dateFormat}
                  onChange={(e) => updateSetting('general', 'dateFormat', e.target.value)}
                >
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>

              <div className="setting-group">
                <label>Temperature Unit</label>
                <div className="radio-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      value="F"
                      checked={settings.general.temperatureUnit === 'F'}
                      onChange={() => updateSetting('general', 'temperatureUnit', 'F')}
                    />
                    <span>Fahrenheit (°F)</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      value="C"
                      checked={settings.general.temperatureUnit === 'C'}
                      onChange={() => updateSetting('general', 'temperatureUnit', 'C')}
                    />
                    <span>Celsius (°C)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Notification Settings */}
          {activeTab === 'notifications' && (
            <div className="settings-section">
              <h2>Notification Settings</h2>
              
              <div className="setting-group">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={settings.notifications.emailEnabled}
                    onChange={(e) => updateSetting('notifications', 'emailEnabled', e.target.checked)}
                  />
                  <span>Enable Email Notifications</span>
                </label>
              </div>

              {settings.notifications.emailEnabled && (
                <>
                  <div className="setting-group">
                    <label>From Email Address</label>
                    <input
                      type="email"
                      value={settings.notifications.emailFrom}
                      onChange={(e) => updateSetting('notifications', 'emailFrom', e.target.value)}
                    />
                  </div>

                  <div className="setting-group">
                    <label>Alert Types</label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={settings.notifications.criticalAlerts}
                        onChange={(e) => updateSetting('notifications', 'criticalAlerts', e.target.checked)}
                      />
                      <span>Critical Alerts</span>
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={settings.notifications.warningAlerts}
                        onChange={(e) => updateSetting('notifications', 'warningAlerts', e.target.checked)}
                      />
                      <span>Warning Alerts</span>
                    </label>
                  </div>

                  <div className="setting-group">
                    <label className="toggle-label">
                      <input
                        type="checkbox"
                        checked={settings.notifications.dailyDigest}
                        onChange={(e) => updateSetting('notifications', 'dailyDigest', e.target.checked)}
                      />
                      <span>Daily Digest Email</span>
                    </label>
                    {settings.notifications.dailyDigest && (
                      <input
                        type="time"
                        value={settings.notifications.digestTime}
                        onChange={(e) => updateSetting('notifications', 'digestTime', e.target.value)}
                      />
                    )}
                  </div>

                  <button
                    className="btn-secondary"
                    onClick={testEmailConnection}
                    disabled={testingEmail}
                  >
                    <Mail size={16} />
                    {testingEmail ? 'Sending...' : 'Send Test Email'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Energy Settings */}
          {activeTab === 'energy' && (
            <div className="settings-section">
              <h2>Energy & Billing Settings</h2>
              
              <div className="setting-group">
                <label>Utility Provider</label>
                <input
                  type="text"
                  value={settings.energy.utilityProvider}
                  onChange={(e) => updateSetting('energy', 'utilityProvider', e.target.value)}
                />
              </div>

              <div className="setting-group">
                <label>Energy Rate ($/kWh)</label>
                <input
                  type="number"
                  step="0.001"
                  value={settings.energy.kwhRate}
                  onChange={(e) => updateSetting('energy', 'kwhRate', parseFloat(e.target.value))}
                />
              </div>

              <div className="setting-group">
                <label>Demand Rate ($/kW)</label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.energy.demandRate}
                  onChange={(e) => updateSetting('energy', 'demandRate', parseFloat(e.target.value))}
                />
              </div>

              <div className="setting-group">
                <label>Currency</label>
                <select
                  value={settings.energy.currency}
                  onChange={(e) => updateSetting('energy', 'currency', e.target.value)}
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD ($)</option>
                </select>
              </div>

              <div className="setting-group">
                <label>Billing Cycle</label>
                <select
                  value={settings.energy.billingCycle}
                  onChange={(e) => updateSetting('energy', 'billingCycle', e.target.value)}
                >
                  <option value="monthly">Monthly</option>
                  <option value="bimonthly">Bi-Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
            </div>
          )}

          {/* Hardware Settings */}
          {activeTab === 'hardware' && (
            <div className="settings-section">
              <h2>Hardware Settings</h2>
              
              <div className="setting-group">
                <label>Sensor Poll Interval (ms)</label>
                <input
                  type="number"
                  min="100"
                  max="10000"
                  step="100"
                  value={settings.hardware.sensorPollInterval}
                  onChange={(e) => updateSetting('hardware', 'sensorPollInterval', parseInt(e.target.value))}
                />
                <small>How often to read sensor values (100-10000ms)</small>
              </div>

              <div className="setting-group">
                <label>Data Retention (days)</label>
                <input
                  type="number"
                  min="7"
                  max="365"
                  value={settings.hardware.dataRetentionDays}
                  onChange={(e) => updateSetting('hardware', 'dataRetentionDays', parseInt(e.target.value))}
                />
                <small>How long to keep detailed sensor data</small>
              </div>

              <div className="setting-group">
                <label>Hardware Features</label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.hardware.enableHailo}
                    onChange={(e) => updateSetting('hardware', 'enableHailo', e.target.checked)}
                  />
                  <span>Enable Hailo AI Accelerator</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.hardware.enableApollo}
                    onChange={(e) => updateSetting('hardware', 'enableApollo', e.target.checked)}
                  />
                  <span>Enable Apollo AI Inference</span>
                </label>
              </div>

              <div className="hardware-status">
                <h3>Hardware Status</h3>
                <div className="status-grid">
                  <div className="status-item">
                    <Cpu size={16} />
                    <span>Sequent Boards</span>
                    <span className="status online">Connected</span>
                  </div>
                  <div className="status-item">
                    <Database size={16} />
                    <span>Database</span>
                    <span className="status online">Online</span>
                  </div>
                  <div className="status-item">
                    <Shield size={16} />
                    <span>Apollo AI</span>
                    <span className="status online">Loaded</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* User Management */}
          {activeTab === 'users' && (
            <div className="settings-section">
              <div className="section-header">
                <h2>User Management</h2>
                <button className="btn-primary" onClick={addUser}>
                  <User size={16} />
                  Add User
                </button>
              </div>
              
              <div className="users-list">
                {settings.users.length === 0 ? (
                  <div className="empty-state">
                    <User size={48} />
                    <p>No users configured</p>
                  </div>
                ) : (
                  settings.users.map(user => (
                    <div key={user.id} className="user-card">
                      <div className="user-avatar">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="user-info">
                        <h4>{user.name}</h4>
                        <p>{user.email}</p>
                        <span className="user-meta">
                          Role: {user.role} • Last login: {new Date(user.lastLogin).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="user-actions">
                        <button className="btn-icon" title="Reset Password">
                          <Key size={16} />
                        </button>
                        <button className="btn-icon" onClick={() => editUser(user)} title="Edit User">
                          <SettingsIcon size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Modal */}
      {showUserModal && (
        <UserModal
          user={editingUser}
          onSave={saveUser}
          onClose={() => {
            setShowUserModal(false);
            setEditingUser(null);
          }}
        />
      )}
    </div>
  );
};

export default Settings;
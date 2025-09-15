import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Server, Cpu, Brain,
  Zap, Bell, FileText, Settings, LogOut,
  ChevronLeft, ChevronRight
} from 'lucide-react';

interface SidebarProps {
  user: any;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout }) => {
  const [collapsed, setCollapsed] = React.useState(false);

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/customers', icon: Users, label: 'Customers' },
    { path: '/equipment', icon: Server, label: 'Equipment' },
    { path: '/sensors', icon: Cpu, label: 'Sensors' },
    { path: '/diagnostics', icon: Brain, label: 'Diagnostics' },
    { path: '/energy', icon: Zap, label: 'Energy' },
    { path: '/alarms', icon: Bell, label: 'Alarms' },
    { path: '/reports', icon: FileText, label: 'Reports' },
    { path: '/settings', icon: Settings, label: 'Settings', adminOnly: true }
  ];

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="logo">
          <img src="/logo.png" alt="Apollo Nexus" />
          {!collapsed && <span>Apollo Nexus™</span>}
        </div>
        <button
          className="toggle-btn"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map(item => {
          if (item.adminOnly && user?.role !== 'admin') return null;
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={20} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          {!collapsed && (
            <div className="user-details">
              <span className="user-name">{user?.name || 'User'}</span>
              <span className="user-role">{user?.role || 'Technician'}</span>
            </div>
          )}
        </div>
        <button
          className="logout-btn"
          onClick={onLogout}
          title="Logout"
        >
          <LogOut size={20} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';

// Components
import Sidebar from './components/Sidebar';
import WeatherBar from './components/WeatherBar';
import AuthGuard from './components/AuthGuard';
import ThemeToggle from './components/ThemeToggle';

// Pages
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Equipment from './pages/Equipment';
import Sensors from './pages/Sensors';
import Diagnostics from './pages/Diagnostics';
import Energy from './pages/Energy';
import Alarms from './pages/Alarms';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Login from './pages/Login';

// Services
import { AuthService } from './services/authService';
import { ApiService } from './services/apiService';

// Styles are loaded via index.html

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [systemStatus, setSystemStatus] = useState({
    online: true,
    hardware: false,
    apollo: false
  });

  useEffect(() => {
    // Check authentication on mount
    const token = AuthService.getToken();
    if (token) {
      AuthService.validateToken(token).then(valid => {
        if (valid) {
          setIsAuthenticated(true);
          setUser(AuthService.getUser());
          initializeSocket(token);
        }
      });
    }

    // Check system health
    checkSystemHealth();
    const healthInterval = setInterval(checkSystemHealth, 30000);

    return () => {
      clearInterval(healthInterval);
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const initializeSocket = (token: string) => {
    const socketInstance = io(process.env.REACT_APP_API_URL || '', {
      auth: { token }
    });

    socketInstance.on('connect', () => {
      console.log('Connected to Apollo Nexus server');
      socketInstance.emit('authenticate', token);
    });

    socketInstance.on('authenticated', (response) => {
      if (response.success) {
        console.log('Socket authenticated');
      }
    });

    socketInstance.on('system-status', (status) => {
      setSystemStatus(status);
    });

    setSocket(socketInstance);
  };

  const checkSystemHealth = async () => {
    try {
      const health = await ApiService.get('/health');
      setSystemStatus({
        online: true,
        hardware: health.services.hardware === 'ready',
        apollo: health.services.apollo === 'loaded'
      });
    } catch (error) {
      setSystemStatus(prev => ({ ...prev, online: false }));
    }
  };

  const handleLogin = async (credentials: { username: string; password: string }) => {
    try {
      const response = await AuthService.login(credentials);
      if (response.success) {
        setIsAuthenticated(true);
        setUser(response.user);
        initializeSocket(response.token);
        return { success: true };
      }
      return { success: false, error: response.error };
    } catch (error) {
      return { success: false, error: 'Login failed' };
    }
  };

  const handleLogout = () => {
    AuthService.logout();
    setIsAuthenticated(false);
    setUser(null);
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <div className="app">
        <WeatherBar systemStatus={systemStatus} />
        <div className="app-container">
          <Sidebar user={user} onLogout={handleLogout} />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard socket={socket} />} />
              <Route path="/customers" element={
                <AuthGuard>
                  <Customers socket={socket} />
                </AuthGuard>
              } />
              <Route path="/equipment" element={
                <AuthGuard>
                  <Equipment socket={socket} />
                </AuthGuard>
              } />
              <Route path="/sensors" element={
                <AuthGuard>
                  <Sensors socket={socket} />
                </AuthGuard>
              } />
              <Route path="/diagnostics" element={
                <AuthGuard>
                  <Diagnostics socket={socket} />
                </AuthGuard>
              } />
              <Route path="/energy" element={
                <AuthGuard>
                  <Energy socket={socket} />
                </AuthGuard>
              } />
              <Route path="/alarms" element={
                <AuthGuard>
                  <Alarms socket={socket} />
                </AuthGuard>
              } />
              <Route path="/reports" element={
                <AuthGuard>
                  <Reports />
                </AuthGuard>
              } />
              <Route path="/settings" element={
                <AuthGuard requireAdmin>
                  <Settings />
                </AuthGuard>
              } />
            </Routes>
          </main>
        </div>
        <ThemeToggle />
      </div>
    </Router>
  );
};

export default App;
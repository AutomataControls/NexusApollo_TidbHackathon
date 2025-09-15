import React, { useState } from 'react';
import { Lock, User, AlertCircle, Loader } from 'lucide-react';

interface LoginProps {
  onLogin: (credentials: { username: string; password: string }) => Promise<{ success: boolean; error?: string }>;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await onLogin(credentials);
      if (!result.success) {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <img src="/logo.png" alt="Apollo Nexus" className="login-logo" />
          <h1>Apollo Nexus™</h1>
          <p>HVAC Intelligence Platform</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <h2>Sign In</h2>
          
          {error && (
            <div className="error-message">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">
              <User size={20} />
              Username
            </label>
            <input
              id="username"
              type="text"
              value={credentials.username}
              onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
              placeholder="Enter your username"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              <Lock size={20} />
              Password
            </label>
            <input
              id="password"
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={loading || !credentials.username || !credentials.password}
          >
            {loading ? (
              <>
                <Loader size={20} className="animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>

          <div className="login-footer">
            <p>© 2024 AutomataNexus, LLC. All rights reserved.</p>
          </div>
        </form>

        <div className="login-info">
          <h3>Welcome to Apollo Nexus</h3>
          <p>Advanced AI-powered HVAC fault detection and energy optimization platform.</p>
          <ul>
            <li>Real-time equipment monitoring</li>
            <li>Predictive fault detection</li>
            <li>Energy cost optimization</li>
            <li>Comprehensive reporting</li>
          </ul>
          <div className="demo-credentials">
            <h4>Demo Credentials</h4>
            <p>Username: demo</p>
            <p>Password: apollo2024</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
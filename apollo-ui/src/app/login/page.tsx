'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Lock, User, AlertCircle, Loader, Sun, Moon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTheme } from 'next-themes';

export default function LoginPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
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
      const response = await fetch(`http://localhost:8001/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (data.success) {
        // Store token
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Redirect to dashboard
        router.push('/dashboard');
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Unable to connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-mint-50 to-teal-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Theme Toggle Button */}
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="absolute top-6 right-6 p-3 rounded-lg bg-white dark:bg-gray-800 border border-border
                   shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <Sun className="h-5 w-5 text-amber-500" />
        ) : (
          <Moon className="h-5 w-5 text-slate-700" />
        )}
      </button>

      <div className="w-full max-w-5xl px-6 flex gap-8">
        {/* Left Side - Login Form */}
        <div className="flex-1">
          <Card className="border-0 shadow-2xl bg-white/95 dark:bg-gray-800/95 backdrop-blur">
            <CardHeader className="space-y-4 pb-6">
              <div className="flex justify-center mb-4">
                <Image
                  src="/automata-nexus-logo.png"
                  alt="AutomataNexus"
                  width={200}
                  height={60}
                  priority
                  className="dark:brightness-110"
                />
              </div>
              <div className="space-y-2 text-center">
                <CardTitle className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-teal-500 dark:from-teal-400 dark:to-teal-300 bg-clip-text text-transparent">
                  Nexus Apollo™
                </CardTitle>
                <CardDescription className="text-base">
                  HVAC Intelligence Platform
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive" className="bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm font-medium flex items-center gap-2">
                    <User className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    Username
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={credentials.username}
                    onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                    className="h-11 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700
                             focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20
                             transition-all duration-200"
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium flex items-center gap-2">
                    <Lock className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={credentials.password}
                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                    className="h-11 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700
                             focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20
                             transition-all duration-200"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !credentials.username || !credentials.password}
                  className="btn-primary w-full h-11 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 text-center text-sm text-muted-foreground">
              <p className="text-xs">
                © 2024 AutomataNexus, LLC. All rights reserved.
              </p>
            </CardFooter>
          </Card>
        </div>

        {/* Right Side - Info Panel */}
        <div className="flex-1 hidden lg:flex flex-col justify-center space-y-6">
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur rounded-2xl p-8 shadow-xl
                        border border-teal-100 dark:border-gray-700">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
              Welcome to Nexus Apollo
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Advanced AI-powered HVAC fault detection and energy optimization platform
            </p>
            
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 rounded-full bg-teal-500 mt-2"></div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    Real-time Monitoring
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Track equipment performance with live sensor data
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 rounded-full bg-amber-500 mt-2"></div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    Predictive Diagnostics
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    AI-powered fault detection before failures occur
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 rounded-full bg-orange-500 mt-2"></div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    Energy Optimization
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Reduce costs with intelligent energy management
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 rounded-full bg-red-400 mt-2"></div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    Comprehensive Reporting
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Detailed analytics and performance insights
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-teal-500/10 to-mint-500/10 dark:from-teal-900/20 dark:to-mint-900/20
                        rounded-xl p-6 border border-teal-200/50 dark:border-teal-800/50">
            <p className="text-sm font-medium text-teal-700 dark:text-teal-400 mb-2">
              Controller Status
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Serial: {process.env.NEXT_PUBLIC_CONTROLLER_SERIAL}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {process.env.NEXT_PUBLIC_CONTROLLER_NAME}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
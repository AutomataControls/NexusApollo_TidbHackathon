'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutDashboard,
  Users,
  Cpu,
  Gauge,
  Activity,
  AlertTriangle,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Zap,
  ThermometerSun,
  Bell,
  ChevronDown,
  Brain,
  Database,
  Sparkles,
  Search
} from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Hailo-8 NPU', href: '/dashboard/hailo', icon: Sparkles },
  { name: 'AI Models', href: '/dashboard/ai-models', icon: Brain },
  { name: 'Vector Search', href: '/dashboard/vector-search', icon: Search },
  { name: 'Customers', href: '/dashboard/customers', icon: Users },
  { name: 'Equipment', href: '/dashboard/equipment', icon: Cpu },
  { name: 'Sensors', href: '/dashboard/sensors', icon: Gauge },
  { name: 'Energy', href: '/dashboard/energy', icon: Zap },
  { name: 'Diagnostics', href: '/dashboard/diagnostics', icon: Activity },
  { name: 'Alarms', href: '/dashboard/alarms', icon: AlertTriangle },
  { name: 'Reports', href: '/dashboard/reports', icon: FileText },
  { name: 'Database', href: '/dashboard/database', icon: Database },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState(0);
  const [systemStatus, setSystemStatus] = useState({
    online: true,
    hardware: false,
    ai: false,
  });

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (!token || !userData) {
      router.push('/login');
      return;
    }
    
    setUser(JSON.parse(userData));
    
    // Check system status
    checkSystemHealth();
    const interval = setInterval(checkSystemHealth, 30000);
    
    return () => clearInterval(interval);
  }, [router]);

  const checkSystemHealth = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setSystemStatus({
        online: true,
        hardware: data.services?.hardware === 'ready',
        ai: data.services?.apollo === 'loaded'
      });
    } catch (error) {
      setSystemStatus(prev => ({ ...prev, online: false }));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-mint-50 to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-white/95 dark:bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="flex h-16 items-center px-4">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          {/* Logo */}
          <div className="flex items-center space-x-3 ml-4 lg:ml-0">
            <Image
              src="/automata-nexus-logo.png"
              alt="AutomataNexus"
              width={150}
              height={40}
              className="dark:brightness-110"
            />
            <Separator orientation="vertical" className="h-8" />
            <span className="text-xl font-bold bg-gradient-to-r from-teal-600 to-teal-500 dark:from-teal-400 dark:to-teal-300 bg-clip-text text-transparent">
              Nexus Apollo™
            </span>
          </div>

          {/* Right side items */}
          <div className="ml-auto flex items-center space-x-4">
            {/* System Status */}
            <div className="hidden md:flex items-center space-x-2">
              <Badge variant={systemStatus.online ? "default" : "destructive"} className="px-2 py-1">
                <span className={`w-2 h-2 rounded-full mr-2 ${systemStatus.online ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                {systemStatus.online ? 'Online' : 'Offline'}
              </Badge>
              {systemStatus.hardware && (
                <Badge variant="secondary" className="px-2 py-1">
                  <Cpu className="w-3 h-3 mr-1" />
                  Hardware
                </Badge>
              )}
              {systemStatus.ai && (
                <Badge variant="secondary" className="px-2 py-1">
                  <Activity className="w-3 h-3 mr-1" />
                  AI
                </Badge>
              )}
            </div>

            {/* Notifications */}
            <button className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <Bell className="h-5 w-5" />
              {notifications > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5 text-amber-500" />
              ) : (
                <Moon className="h-5 w-5 text-slate-700" />
              )}
            </button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback className="bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300">
                    {user?.name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden lg:block text-sm font-medium">{user?.name || 'User'}</span>
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <span className="text-sm">{user?.email}</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <span className="text-sm">Role: {user?.role}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={cn(
          "fixed lg:static inset-y-0 left-0 z-40 w-64 transform transition-transform duration-300 ease-in-out lg:transform-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          "bg-white/95 dark:bg-gray-900/95 backdrop-blur border-r border-border h-[calc(100vh-4rem)] mt-16"
        )}>
          <ScrollArea className="h-full py-4">
            <nav className="space-y-1 px-3">
              {navigation.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 transform",
                      isActive
                        ? "bg-gradient-to-r from-teal-50 to-mint-50 dark:from-teal-900/20 dark:to-mint-900/20 text-teal-700 dark:text-teal-300 shadow-md"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 hover:shadow-lg hover:-translate-y-0.5 hover:shadow-gray-400/30 dark:hover:shadow-black/30"
                    )}
                  >
                    <item.icon className={cn(
                      "mr-3 h-5 w-5 flex-shrink-0",
                      isActive ? "text-teal-600 dark:text-teal-400" : "text-gray-400 dark:text-gray-500"
                    )} />
                    {item.name}
                    {item.name === 'Alarms' && notifications > 0 && (
                      <Badge variant="destructive" className="ml-auto">
                        {notifications}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-8 px-3">
              <Separator />
              <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200/50 dark:border-orange-800/50">
                <div className="flex items-center mb-2">
                  <ThermometerSun className="h-5 w-5 text-orange-600 dark:text-orange-400 mr-2" />
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">System Overview</span>
                </div>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <p>Monitoring: Active</p>
                  <p>AI Models: 8 Loaded</p>
                  <p>Hailo NPU: Ready</p>
                </div>
              </div>
            </div>
          </ScrollArea>
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 lg:hidden z-30"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Demo User Notice */}
            {user?.username === 'Demo' && (
              <Alert className="mb-4 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <strong>Demo Mode:</strong> You are logged in as a Demo user. Some features are restricted for safety.
                  You can view all data and use the Vector Search demo, but cannot modify settings or control equipment.
                </AlertDescription>
              </Alert>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, User, Search, Settings, History, Sparkles } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Jobs from './pages/Jobs';
import SettingsPage from './pages/Settings';
import ApplicationHistory from './pages/History';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/profile', icon: User, label: 'Profile' },
  { to: '/jobs', icon: Search, label: 'Jobs' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen overflow-hidden">
      {/* Mesh gradient background */}
      <div className="mesh-gradient" />

      {/* Animated gradient orbs */}
      <div className="orb-container">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="orb orb-4" />
      </div>

      {/* Noise texture overlay for depth */}
      <div className="noise-overlay" />

      <div className="relative z-10 min-h-screen flex">
        {/* Glass Sidebar */}
        <aside className="w-72 glass-sidebar m-4 mr-0 flex flex-col rounded-2xl">
          {/* Logo */}
          <div className="p-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-xl blur-lg opacity-50" />
                <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-primary via-primary to-accent flex items-center justify-center shadow-lg">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gradient">JobSlave</h1>
                <p className="text-[11px] text-muted-foreground font-medium tracking-wide">AUTO APPLICATIONS</p>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-4 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4">
            <div className="space-y-1.5">
              {navItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={cn(
                      'group flex items-center gap-3 px-4 py-3 rounded-xl transition-smooth relative overflow-hidden',
                      isActive
                        ? 'nav-active text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    )}
                  >
                    <div className={cn(
                      'icon-container w-9 h-9 rounded-lg flex items-center justify-center transition-smooth',
                      isActive
                        ? 'bg-primary/15 shadow-sm'
                        : 'bg-transparent group-hover:bg-secondary'
                    )}>
                      <item.icon className={cn(
                        'w-[18px] h-[18px] transition-all',
                        isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                      )} />
                    </div>
                    <span className={cn(
                      'font-medium text-sm',
                      isActive ? 'text-foreground' : ''
                    )}>{item.label}</span>
                    {isActive && (
                      <div className="ml-auto flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </nav>

          {/* Footer */}
          <div className="p-3 mx-3 mb-4 rounded-xl glass-card">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-75" />
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">LMStudio Connected</p>
                <p className="text-[10px] text-muted-foreground">Local AI • v1.0.0</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-4 overflow-auto custom-scrollbar">
          <div className="glass-panel min-h-full p-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/history" element={<ApplicationHistory />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </div>
        </main>
      </div>

      <Toaster />
    </div>
  );
}

export default App;

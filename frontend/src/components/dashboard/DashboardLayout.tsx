import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Trophy,
  Wallet,
  User,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  Target,
  Sun,
  Moon,
  Globe,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const isAdmin = typeof window !== 'undefined' && localStorage.getItem('auth_is_admin') === 'true';
  const menuItems = [
    { icon: LayoutDashboard, label: t('nav_dashboard'), path: '/dashboard' },
    { icon: TrendingUp, label: t('nav_trading'), path: '/dashboard/trading' },
    { icon: Target, label: t('nav_challenge'), path: '/dashboard/challenge' },
    { icon: Trophy, label: t('nav_leaderboard'), path: '/dashboard/leaderboard' },
    { icon: Wallet, label: t('nav_wallet'), path: '/dashboard/wallet' },
    { icon: User, label: t('nav_profile'), path: '/dashboard/profile' },
  ];
  if (isAdmin) {
    menuItems.push({ icon: Shield, label: t('nav_admin'), path: '/admin' });
  }

  const primaryItems = menuItems.filter((item) =>
    ['/dashboard', '/dashboard/trading', '/dashboard/challenge', '/dashboard/leaderboard'].includes(item.path)
  );
  const accountItems = menuItems.filter((item) =>
    ['/dashboard/wallet', '/dashboard/profile', '/admin'].includes(item.path)
  );

  const pageTitle = (() => {
    const match = menuItems.find((item) => item.path === location.pathname);
    if (match) return match.label;
    if (location.pathname.startsWith('/admin')) return t('nav_admin');
    return t('nav_dashboard');
  })();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background flex app-shell">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col fixed left-0 top-0 h-full bg-sidebar/80 backdrop-blur-2xl border-r border-sidebar-border transition-all duration-300 z-40',
          sidebarOpen ? 'w-64' : 'w-20'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          {sidebarOpen && (
          <Link to="/dashboard" className="flex items-center gap-2">
              <img
                src="/brand-icon.svg"
                alt="TradeSense"
                className="h-9 w-9 rounded-2xl shadow-lg shadow-primary/30"
              />
              <span className="text-lg font-bold">TradeSense</span>
            </Link>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl hover:bg-sidebar-accent transition-colors"
          >
            <ChevronLeft className={cn('w-5 h-5 transition-transform', !sidebarOpen && 'rotate-180')} />
          </button>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 py-4 px-3 space-y-4">
          <div className="space-y-1">
            {sidebarOpen && <div className="px-3 text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Core</div>}
            {primaryItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
                  )}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {sidebarOpen && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
          <div className="space-y-1">
            {sidebarOpen && <div className="px-3 text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Account</div>}
            {accountItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
                  )}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {sidebarOpen && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-sidebar-border">
          <Button
            variant="ghost"
            className={cn('w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10', !sidebarOpen && 'justify-center')}
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span className="ml-3">{t('nav_logout')}</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-background/85 backdrop-blur-2xl border-b border-border z-50 flex items-center justify-between px-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img
            src="/brand-icon.svg"
            alt="TradeSense"
            className="h-9 w-9 rounded-2xl shadow-lg shadow-primary/30"
          />
          <span className="text-lg font-bold">TradeSense</span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-accent"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-16 bg-background z-40 animate-fade-in">
          <nav className="p-4 space-y-1">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-all',
                    isActive
                      ? 'bg-accent text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-accent/50'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 mt-4"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5 mr-3" />
              Logout
            </Button>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main
        className={cn(
          'flex-1 transition-all duration-300 pt-16 lg:pt-0',
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
        )}
      >
        <div className="p-4 lg:p-8 space-y-6">
          <div className="surface-card p-4 lg:p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="section-title">{t('dashboard')}</div>
              <h1 className="text-2xl lg:text-3xl font-semibold">{pageTitle}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'en' | 'fr' | 'ar')}
                  className="bg-transparent text-xs focus:outline-none"
                  aria-label={t('language')}
                >
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="ar">العربية</option>
                </select>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="rounded-full"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4 mr-2" />
                    {t('theme_light')}
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 mr-2" />
                    {t('theme_dark')}
                  </>
                )}
              </Button>
            </div>
          </div>
          <div>{children}</div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;

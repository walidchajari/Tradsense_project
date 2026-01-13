import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  MoreVertical,
  CheckCircle,
  XCircle,
  LayoutDashboard,
  Activity,
  LogOut,
  TrendingUp as TrendingIcon,
  CreditCard,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '@/lib/api';
import { useTheme } from 'next-themes';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

const AdminPanel = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [timeRange, setTimeRange] = useState('7d');
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [contactMessages, setContactMessages] = useState<any[]>([]);
  const [contactLoading, setContactLoading] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [replySending, setReplySending] = useState<number | null>(null);
  const [filters, setFilters] = useState({
    challengeType: 'all',
    status: 'all',
    dateFrom: '',
    dateTo: '',
    withdrawalStatus: 'all',
  });
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [editUser, setEditUser] = useState({ username: '', email: '' });
  const [editAccount, setEditAccount] = useState({
    balance: '',
    equity: '',
    status: 'active',
    challenge_type: '',
    initial_balance: '',
    daily_starting_equity: '',
  });
  const [resetPassword, setResetPassword] = useState('');
  const [paypalForm, setPaypalForm] = useState({
    client_id: '',
    client_secret: '',
    mode: 'sandbox',
    currency_code: 'USD',
  });
  const [cmiForm, setCmiForm] = useState({
    store_id: '',
    shared_secret: '',
    mode: 'test',
  });
  const [cryptoForm, setCryptoForm] = useState({
    api_key: '',
    api_secret: '',
    merchant_id: '',
  });
  const { toast } = useToast();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const buildQueryString = (params: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      search.set(key, String(value));
    });
    const query = search.toString();
    return query ? `?${query}` : '';
  };

  const getRangeParam = () => {
    if (timeRange.toLowerCase() === 'today') return 'today';
    return timeRange;
  };

  const fetchAccounts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/accounts`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      setAccounts(data);
    } catch (error) {
      toast({ title: t('admin_error'), description: t('admin_fetch_accounts_error'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/logs`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      setLogs(data || []);
    } catch (error) {
      setLogs([]);
    }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const query = buildQueryString({
        range: getRangeParam(),
        challenge_type: filters.challengeType !== 'all' ? filters.challengeType : undefined,
        status: filters.status !== 'all' ? filters.status : undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
      });
      const response = await fetch(`${API_BASE_URL}/admin/analytics${query}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to fetch analytics');
      }
      setAnalytics(data);
    } catch (error) {
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchWithdrawals = async () => {
    setWithdrawalsLoading(true);
    try {
      const query = buildQueryString({
        status: filters.withdrawalStatus !== 'all' ? filters.withdrawalStatus : undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
      });
      const response = await fetch(`${API_BASE_URL}/admin/withdrawals${query}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      setWithdrawals(data.items || []);
    } catch (error) {
      setWithdrawals([]);
    } finally {
      setWithdrawalsLoading(false);
    }
  };

  const fetchContactMessages = async () => {
    setContactLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/contacts?limit=10`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      setContactMessages(data.items || []);
      setReplyDrafts((prev) => {
        const next = { ...prev };
        (data.items || []).forEach((item: any) => {
          if (next[item.id] === undefined && !item.reply_message) {
            next[item.id] = '';
          }
        });
        return next;
      });
    } catch (error) {
      setContactMessages([]);
    } finally {
      setContactLoading(false);
    }
  };

  const handleReplyChange = (messageId: number, value: string) => {
    setReplyDrafts((prev) => ({ ...prev, [messageId]: value }));
  };

  const sendContactReply = async (messageId: number) => {
    const reply = (replyDrafts[messageId] || '').trim();
    if (!reply) {
      toast({ title: 'Reply required', description: 'Please write a reply before sending.', variant: 'destructive' });
      return;
    }
    setReplySending(messageId);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/contacts/${messageId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ reply }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to send reply');
      }
      toast({ title: 'Reply sent', description: 'The message has been answered.' });
      setReplyDrafts((prev) => ({ ...prev, [messageId]: '' }));
      fetchContactMessages();
    } catch (error) {
      toast({ title: 'Send failed', description: 'Unable to send the reply.', variant: 'destructive' });
    } finally {
      setReplySending(null);
    }
  };

  useEffect(() => {
    const isAdmin = localStorage.getItem('auth_is_admin') === 'true';
    const token = localStorage.getItem('auth_token');
    if (!token) {
      navigate('/login');
      return;
    }
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }
    fetchAccounts();
    fetchLogs();
    fetchAnalytics();
    fetchContactMessages();
  }, [navigate]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchAnalytics();
    }
  }, [timeRange, filters.challengeType, filters.status, filters.dateFrom, filters.dateTo, activeTab]);

  useEffect(() => {
    if (activeTab === 'payments') {
      fetchWithdrawals();
    }
  }, [filters.withdrawalStatus, filters.dateFrom, filters.dateTo, activeTab]);

  const fetchAccountDetails = async (accountId: number) => {
    setDetailsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/accounts/${accountId}/details`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to load account details');
      }
      setSelectedDetails(data);
      setSelectedAccountId(accountId);
      setEditUser({
        username: data.user?.username || '',
        email: data.user?.email || '',
      });
      setEditAccount({
        balance: data.account?.balance != null ? String(data.account.balance) : '',
        equity: data.account?.equity != null ? String(data.account.equity) : '',
        status: data.account?.status || 'active',
        challenge_type: data.account?.challenge_type || '',
        initial_balance: data.account?.initial_balance != null ? String(data.account.initial_balance) : '',
        daily_starting_equity: data.account?.daily_starting_equity != null ? String(data.account.daily_starting_equity) : '',
      });
    } catch (error) {
      toast({ title: t('admin_error'), description: t('admin_fetch_details_error'), variant: 'destructive' });
    } finally {
      setDetailsLoading(false);
    }
  };

  const handlePayPalChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPaypalForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCmiChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCmiForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCryptoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCryptoForm((prev) => ({ ...prev, [name]: value }));
  };

  const savePayPalConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/paypal/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(paypalForm),
      });
      if (response.ok) {
        toast({ title: t('admin_saved'), description: t('admin_config_updated') });
      } else {
        toast({ title: t('admin_error'), description: t('admin_paypal_save_error'), variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: t('admin_error'), description: t('admin_paypal_save_error'), variant: 'destructive' });
    }
  };

  const saveCmiConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/cmi/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(cmiForm),
      });
      if (response.ok) {
        toast({ title: t('admin_saved'), description: t('admin_config_updated') });
      } else {
        toast({ title: t('admin_error'), description: t('admin_cmi_save_error'), variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: t('admin_error'), description: t('admin_cmi_save_error'), variant: 'destructive' });
    }
  };

  const saveCryptoConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/crypto/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(cryptoForm),
      });
      if (response.ok) {
        toast({ title: t('admin_saved'), description: t('admin_config_updated') });
      } else {
        toast({ title: t('admin_error'), description: t('admin_crypto_save_error'), variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: t('admin_error'), description: t('admin_crypto_save_error'), variant: 'destructive' });
    }
  };

  const updateWithdrawalStatus = async (withdrawalId: number, status: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/withdrawals/${withdrawalId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to update withdrawal');
      }
      toast({ title: t('admin_saved'), description: `Withdrawal ${withdrawalId} -> ${status}` });
      fetchWithdrawals();
      fetchAnalytics();
    } catch (error) {
      toast({ title: t('admin_error'), description: 'Failed to update withdrawal', variant: 'destructive' });
    }
  };

  const handleStatusChange = async (accountId: number, newStatus: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/accounts/${accountId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ status: newStatus.toLowerCase() }),
      });

      if (response.ok) {
        toast({
          title: t('admin_status_updated'),
          description: t('admin_status_updated_desc').replace('{id}', String(accountId)).replace('{status}', newStatus),
        });
        fetchAccounts();
        if (selectedAccountId === accountId) {
          fetchAccountDetails(accountId);
        }
      } else {
        throw new Error('Failed to update status');
      }
    } catch (error) {
      toast({ title: t('admin_error'), description: t('admin_status_update_error'), variant: 'destructive' });
    }
  };

  const parseOptionalNumber = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const saveUserUpdates = async () => {
    if (!selectedDetails?.user?.id) return;
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${selectedDetails.user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          username: editUser.username || undefined,
          email: editUser.email || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to update user');
      }
      toast({ title: t('admin_saved'), description: t('admin_user_updated') });
      fetchAccountDetails(selectedDetails.account.id);
      fetchAccounts();
    } catch (error) {
      toast({ title: t('admin_error'), description: t('admin_user_update_error'), variant: 'destructive' });
    }
  };

  const saveAccountUpdates = async () => {
    if (!selectedDetails?.account?.id) return;
    try {
      const response = await fetch(`${API_BASE_URL}/admin/accounts/${selectedDetails.account.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          balance: parseOptionalNumber(editAccount.balance),
          equity: parseOptionalNumber(editAccount.equity),
          status: editAccount.status || undefined,
          challenge_type: editAccount.challenge_type || undefined,
          initial_balance: parseOptionalNumber(editAccount.initial_balance),
          daily_starting_equity: parseOptionalNumber(editAccount.daily_starting_equity),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to update account');
      }
      toast({ title: t('admin_saved'), description: t('admin_account_updated') });
      fetchAccountDetails(selectedDetails.account.id);
      fetchAccounts();
    } catch (error) {
      toast({ title: t('admin_error'), description: t('admin_account_update_error'), variant: 'destructive' });
    }
  };

  const resetUserPassword = async () => {
    if (!selectedDetails?.user?.id || !resetPassword.trim()) return;
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${selectedDetails.user.id}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ new_password: resetPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to reset password');
      }
      toast({ title: t('admin_saved'), description: t('admin_password_reset') });
      setResetPassword('');
    } catch (error) {
      toast({ title: t('admin_error'), description: t('admin_password_reset_error'), variant: 'destructive' });
    }
  };

  const deleteAccount = async () => {
    if (!selectedDetails?.account?.id) return;
    const confirmed = window.confirm(t('admin_delete_account_confirm'));
    if (!confirmed) return;
    try {
      const response = await fetch(`${API_BASE_URL}/admin/accounts/${selectedDetails.account.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to delete account');
      }
      toast({ title: t('admin_account_deleted'), description: t('admin_account_deleted_desc') });
      setSelectedDetails(null);
      setSelectedAccountId(null);
      fetchAccounts();
    } catch (error) {
      toast({ title: t('admin_error'), description: t('admin_account_delete_error'), variant: 'destructive' });
    }
  };

  const filteredAccounts = accounts.filter(
    (acc) =>
      acc.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.challenge_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = [
    { label: t('admin_total_accounts'), value: accounts.length.toString(), icon: Users, color: 'from-primary to-blue-400' },
    { label: t('admin_active_challenges'), value: accounts.filter(a => a.status === 'active').length.toString(), icon: Activity, color: 'from-emerald-400 to-teal-500' },
    { label: t('admin_funded'), value: accounts.filter(a => a.status === 'funded').length.toString(), icon: CheckCircle, color: 'from-success to-emerald-400' },
    { label: t('admin_failed'), value: accounts.filter(a => a.status === 'failed').length.toString(), icon: XCircle, color: 'from-destructive to-orange-400' },
  ];

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case 'funded':
        return 'bg-success/20 text-success';
      case 'active':
        return 'bg-primary/20 text-primary';
      case 'failed':
        return 'bg-destructive/20 text-destructive';
      default:
        return 'bg-muted/20 text-muted-foreground';
    }
  };

  const computedProfitTotal = accounts.reduce((sum, acc) => {
    const equity = Number(acc.equity ?? 0);
    const initial = Number(acc.initial_balance ?? 0);
    return sum + (equity - initial);
  }, 0);
  const totalAccounts = analytics?.kpis?.total_accounts ?? accounts.length;
  const fundedCount = analytics?.kpis?.funded_count ?? accounts.filter(a => a.status === 'funded').length;
  const failedCount = analytics?.kpis?.failed_count ?? accounts.filter(a => a.status === 'failed').length;
  const activeCount = analytics?.kpis?.active_count ?? accounts.filter(a => a.status === 'active').length;
  const fundedPct = analytics?.kpis?.funded_pct ?? (totalAccounts ? Math.round((fundedCount / totalAccounts) * 100) : 0);
  const failedPct = analytics?.kpis?.failed_pct ?? (totalAccounts ? Math.round((failedCount / totalAccounts) * 100) : 0);
  const profitTotal = analytics?.kpis?.profit_total ?? computedProfitTotal;
  const profitMagnitude = Math.max(Math.abs(profitTotal), 500);
  const profitSign = profitTotal >= 0 ? 1 : -1;
  const formatMoney = (value: number) =>
    value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const sparklineSeries = analytics?.series?.pnl?.length
    ? analytics.series.pnl.map((item: { value: number }) => ({ value: item.value }))
    : [];
  const pnlSeries = analytics?.series?.pnl ?? [];
  const equitySeries = analytics?.series?.growth ?? [];
  const statusChart = analytics?.series?.status?.length
    ? analytics.series.status
    : [
        { name: 'Funded', value: fundedCount },
        { name: 'Active', value: activeCount },
        { name: 'Failed', value: failedCount },
      ];
  const challengeChart = analytics?.series?.challenge?.length
    ? analytics.series.challenge
    : ['starter', 'pro', 'elite', 'demo'].map((tier) => ({
        name: tier.toUpperCase(),
        value: accounts.filter(a => (a.challenge_type || '').toLowerCase() === tier).length,
      }));
  const withdrawalChart = analytics?.series?.withdrawals ?? [];
  const timeRanges = ['Today', '7d', '30d', '90d'];
  const statusColors = ['#22c55e', '#38bdf8', '#f97316'];
  const withdrawalColors = ['#fbbf24', '#38bdf8', '#22c55e', '#ef4444'];
  const kpiCards = [
    {
      label: 'Net Profit',
      value: `${profitTotal >= 0 ? '+' : '-'}${formatMoney(Math.abs(profitTotal))} DH`,
      delta: profitTotal >= 0 ? '+6.2%' : '-3.4%',
      trendUp: profitTotal >= 0,
    },
    {
      label: 'Funded Rate',
      value: `${fundedPct}%`,
      delta: '+4.1%',
      trendUp: true,
    },
    {
      label: 'Failed Rate',
      value: `${failedPct}%`,
      delta: '-1.2%',
      trendUp: false,
    },
    {
      label: 'Active Challenges',
      value: activeCount.toString(),
      delta: '+3.5%',
      trendUp: true,
    },
  ];

  const menuItems = [
    { icon: LayoutDashboard, label: t('dashboard'), id: 'dashboard' },
    { icon: Users, label: t('admin_accounts'), id: 'users' },
    { icon: CreditCard, label: t('admin_payments'), id: 'payments' },
    { icon: Activity, label: t('admin_logs'), id: 'logs' },
  ];

  const showDashboard = activeTab === 'dashboard';
  const showUsers = activeTab === 'users';
  const showPayments = activeTab === 'payments';
  const showLogs = activeTab === 'logs';

  return (
    <div className="min-h-screen bg-background flex app-shell">
      <aside className="w-64 bg-sidebar border-r border-sidebar-border hidden lg:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center">
              <TrendingIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold">TradeSense</span>
              <span className="text-[10px] text-destructive ml-2 font-bold tracking-tighter ring-1 ring-destructive/30 px-1 rounded">ADMIN</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${activeTab === item.id
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <Button
            variant="ghost"
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => navigate('/')}
          >
            <LogOut className="w-5 h-5 mr-3" />
            {t('nav_logout')}
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-8">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t('nav_admin')}</div>
            <h1 className="text-2xl font-semibold">{t('admin_title')}</h1>
            <p className="text-muted-foreground">{t('admin_subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs">
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
              {theme === 'dark' ? t('theme_light') : t('theme_dark')}
            </Button>
          </div>
        </div>

        {showDashboard ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div className="text-sm text-muted-foreground">
                Admin snapshot • {totalAccounts} accounts
              </div>
              <div className="flex items-center gap-2">
                {timeRanges.map((range) => (
                  <Button
                    key={range}
                    variant={timeRange === range ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setTimeRange(range)}
                  >
                    {range}
                  </Button>
                ))}
              </div>
            </div>

            <div className="surface-card p-5 mb-8">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Filters</div>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={filters.challengeType}
                    onChange={(e) => setFilters((prev) => ({ ...prev, challengeType: e.target.value }))}
                    className="rounded-md bg-secondary border border-border px-3 py-2 text-xs"
                  >
                    <option value="all">All Challenges</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="elite">Elite</option>
                    <option value="demo">Demo</option>
                  </select>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                    className="rounded-md bg-secondary border border-border px-3 py-2 text-xs"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="funded">Funded</option>
                    <option value="failed">Failed</option>
                  </select>
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                    className="bg-secondary border-border text-xs h-9"
                  />
                  <Input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                    className="bg-secondary border-border text-xs h-9"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilters({ challengeType: 'all', status: 'all', dateFrom: '', dateTo: '', withdrawalStatus: 'all' })}
                  >
                    Reset
                  </Button>
                </div>
                {analyticsLoading ? (
                  <span className="text-xs text-muted-foreground">Refreshing…</span>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
              {kpiCards.map((card) => (
                <div key={card.label} className="surface-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        {card.label}
                      </div>
                      <div className="text-2xl font-semibold mt-2">{card.value}</div>
                      <div className={`mt-2 inline-flex items-center gap-1 text-xs ${card.trendUp ? 'text-emerald-400' : 'text-orange-300'}`}>
                        {card.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {card.delta}
                      </div>
                    </div>
                    <div className="h-14 w-24">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sparklineSeries}>
                          <Line type="monotone" dataKey="value" stroke="#38bdf8" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {stats.map((stat, index) => (
                <div key={index} className="surface-card p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                      <stat.icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-sm text-muted-foreground">{stat.label}</span>
                  </div>
                  <div className="text-2xl font-bold trading-number">{stat.value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.9fr] gap-6 mb-8">
              <div className="surface-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Performance</div>
                    <h2 className="text-lg font-semibold">Net Profit Trend</h2>
                  </div>
                  <div className="text-xs text-muted-foreground">Range: {timeRange}</div>
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={pnlSeries}>
                      <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.15)" />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="surface-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Status</div>
                    <h2 className="text-lg font-semibold">Funded vs Failed</h2>
                  </div>
                  <div className="text-xs text-muted-foreground">{fundedPct}% funded</div>
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusChart} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3}>
                        {statusChart.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={statusColors[index % statusColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Funded {fundedCount}</span>
                  <span>Active {activeCount}</span>
                  <span>Failed {failedCount}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 mb-8">
              <div className="surface-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Challenges</div>
                    <h2 className="text-lg font-semibold">Challenge Mix</h2>
                  </div>
                  <div className="text-xs text-muted-foreground">Distribution</div>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={challengeChart} barSize={28}>
                      <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.12)" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="surface-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Withdrawals</div>
                    <h2 className="text-lg font-semibold">Cash Flow</h2>
                  </div>
                  <div className="text-xs text-muted-foreground">Requests</div>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={withdrawalChart} dataKey="value" nameKey="name" innerRadius={40} outerRadius={75}>
                        {withdrawalChart.map((_, index) => (
                          <Cell key={`withdraw-${index}`} fill={withdrawalColors[index % withdrawalColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  {withdrawalChart.slice(0, 4).map((item) => (
                    <span key={item.name}>
                      {item.name} {item.value}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 mb-8">
              <div className="surface-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Growth</div>
                    <h2 className="text-lg font-semibold">Account Expansion</h2>
                  </div>
                  <div className="text-xs text-muted-foreground">Last 4 weeks</div>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={equitySeries}>
                      <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.12)" />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <Tooltip />
                      <Area type="monotone" dataKey="value" stroke="#22c55e" fill="rgba(34,197,94,0.2)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="surface-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Alerts</div>
                    <h2 className="text-lg font-semibold">Risk Signals</h2>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-400" />
                      <span>3 accounts near max loss</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">High</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-sky-300" />
                      <span>2 withdrawals pending approval</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Medium</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <span>No compliance breaches today</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Low</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 mb-8">
              <div className="surface-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-4 h-4 text-primary" />
                  <h2 className="text-lg font-semibold">{t('admin_quick_actions')}</h2>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => { fetchAccounts(); fetchLogs(); }}>{t('admin_refresh_data')}</Button>
                  <Button variant="outline" onClick={() => setActiveTab('payments')}>{t('admin_manage_payments')}</Button>
                  <Button variant="outline" onClick={() => setActiveTab('users')}>{t('admin_manage_accounts')}</Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">{t('admin_quick_actions_hint')}</p>
              </div>

              <div className="surface-card p-6">
                <h2 className="text-lg font-semibold mb-4">{t('admin_recent_logs')}</h2>
                <div className="space-y-3 max-h-56 overflow-auto">
                  {logs.length ? logs.slice(0, 6).map((log, index) => (
                    <div key={index} className="flex items-center justify-between text-xs bg-secondary/50 border border-border rounded-lg px-3 py-2">
                      <div>
                        <div className="font-semibold">{log.action}</div>
                        <div className="text-[10px] text-muted-foreground">{log.details}</div>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                      </div>
                    </div>
                  )) : (
                    <div className="text-sm text-muted-foreground">{t('admin_no_logs')}</div>
                  )}
                </div>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setActiveTab('logs')}>
                  {t('admin_view_all_logs')}
                </Button>
              </div>
            </div>

            <div className="surface-card p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Contact Messages</h2>
                <Button variant="outline" size="sm" onClick={fetchContactMessages}>
                  Refresh
                </Button>
              </div>
              {contactLoading ? (
                <div className="text-sm text-muted-foreground">Loading messages...</div>
              ) : contactMessages.length ? (
                <div className="space-y-3 max-h-64 overflow-auto">
                  {contactMessages.map((msg) => (
                    <div key={msg.id} className="rounded-lg border border-border/50 bg-secondary/40 p-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold">{msg.subject || 'General inquiry'}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {msg.created_at ? new Date(msg.created_at).toLocaleString() : '—'}
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {msg.name} • {msg.email}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{msg.message}</p>
                      {msg.reply_message ? (
                        <div className="mt-3 rounded-md border border-border/60 bg-background/60 p-3 text-xs">
                          <div className="text-[11px] text-muted-foreground mb-1">
                            Reply {msg.replied_at ? `• ${new Date(msg.replied_at).toLocaleString()}` : ''}
                          </div>
                          <p className="text-muted-foreground">{msg.reply_message}</p>
                        </div>
                      ) : (
                        <div className="mt-3 space-y-2">
                          <textarea
                            value={replyDrafts[msg.id] || ''}
                            onChange={(event) => handleReplyChange(msg.id, event.target.value)}
                            className="w-full rounded-md border border-border bg-background/60 p-2 text-xs text-foreground"
                            placeholder="Write a reply..."
                            rows={3}
                          />
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              onClick={() => sendContactReply(msg.id)}
                              disabled={replySending === msg.id}
                            >
                              {replySending === msg.id ? 'Sending...' : 'Send reply'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No contact messages yet.</div>
              )}
            </div>
          </>
        ) : null}

        {showPayments ? (
          <div className="space-y-6 mb-8">
            <div className="surface-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Withdrawals</div>
                  <h2 className="text-lg font-semibold">Approval Queue</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={filters.withdrawalStatus}
                    onChange={(e) => setFilters((prev) => ({ ...prev, withdrawalStatus: e.target.value }))}
                    className="rounded-md bg-secondary border border-border px-3 py-2 text-xs"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="paid">Paid</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <Button variant="outline" size="sm" onClick={fetchWithdrawals}>
                    Refresh
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                  className="bg-secondary border-border text-xs h-9"
                />
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                  className="bg-secondary border-border text-xs h-9"
                />
              </div>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-2">User</th>
                      <th className="py-2">Account</th>
                      <th className="py-2">Amount</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Created</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawalsLoading ? (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-xs text-muted-foreground">
                          Loading withdrawals...
                        </td>
                      </tr>
                    ) : withdrawals.length ? (
                      withdrawals.map((item) => (
                        <tr key={item.id} className="border-t border-border/50">
                          <td className="py-3">
                            <div className="font-medium">{item.user_name || '—'}</div>
                            <div className="text-[11px] text-muted-foreground">{item.user_email || ''}</div>
                          </td>
                          <td className="py-3">#{item.account_id}</td>
                          <td className="py-3">{Number(item.amount || 0).toFixed(2)}</td>
                          <td className="py-3 capitalize">{item.status}</td>
                          <td className="py-3 text-xs text-muted-foreground">
                            {item.created_at ? new Date(item.created_at).toLocaleString() : '—'}
                          </td>
                          <td className="py-3">
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateWithdrawalStatus(item.id, 'approved')}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateWithdrawalStatus(item.id, 'paid')}
                              >
                                Mark Paid
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateWithdrawalStatus(item.id, 'rejected')}
                              >
                                Reject
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-xs text-muted-foreground">
                          No withdrawals found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="surface-card p-6">
              <h2 className="text-lg font-semibold mb-4">{t('admin_paypal_config')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{t('admin_paypal_client_id')}</Label>
                  <Input
                    name="client_id"
                    value={paypalForm.client_id}
                    onChange={handlePayPalChange}
                    className="mt-1 bg-secondary border-border"
                    placeholder={t('admin_paypal_client_id_placeholder')}
                  />
                </div>
                <div>
                  <Label>{t('admin_paypal_client_secret')}</Label>
                  <Input
                    name="client_secret"
                    type="password"
                    value={paypalForm.client_secret}
                    onChange={handlePayPalChange}
                    className="mt-1 bg-secondary border-border"
                    placeholder={t('admin_paypal_client_secret_placeholder')}
                  />
                </div>
                <div>
                  <Label>{t('admin_mode')}</Label>
                  <select
                    name="mode"
                    value={paypalForm.mode}
                    onChange={handlePayPalChange}
                    className="mt-1 w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm"
                  >
                    <option value="sandbox">Sandbox</option>
                    <option value="live">Live</option>
                  </select>
                </div>
                <div>
                  <Label>{t('admin_currency')}</Label>
                  <Input
                    name="currency_code"
                    value={paypalForm.currency_code}
                    onChange={handlePayPalChange}
                    className="mt-1 bg-secondary border-border"
                    placeholder={t('admin_currency_placeholder')}
                  />
                </div>
              </div>
              <div className="mt-4">
                <Button onClick={savePayPalConfig}>{t('admin_save_paypal')}</Button>
              </div>
            </div>

            <div className="surface-card p-6">
              <h2 className="text-lg font-semibold mb-4">{t('admin_cmi_config')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{t('admin_cmi_store_id')}</Label>
                  <Input
                    name="store_id"
                    value={cmiForm.store_id}
                    onChange={handleCmiChange}
                    className="mt-1 bg-secondary border-border"
                    placeholder={t('admin_cmi_store_id_placeholder')}
                  />
                </div>
                <div>
                  <Label>{t('admin_cmi_shared_secret')}</Label>
                  <Input
                    name="shared_secret"
                    type="password"
                    value={cmiForm.shared_secret}
                    onChange={handleCmiChange}
                    className="mt-1 bg-secondary border-border"
                    placeholder={t('admin_cmi_shared_secret_placeholder')}
                  />
                </div>
                <div>
                  <Label>{t('admin_mode')}</Label>
                  <select
                    name="mode"
                    value={cmiForm.mode}
                    onChange={handleCmiChange}
                    className="mt-1 w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm"
                  >
                    <option value="test">Test</option>
                    <option value="live">Live</option>
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <Button onClick={saveCmiConfig}>{t('admin_save_cmi')}</Button>
              </div>
            </div>

            <div className="surface-card p-6">
              <h2 className="text-lg font-semibold mb-4">{t('admin_crypto_config')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{t('admin_crypto_api_key')}</Label>
                  <Input
                    name="api_key"
                    value={cryptoForm.api_key}
                    onChange={handleCryptoChange}
                    className="mt-1 bg-secondary border-border"
                    placeholder={t('admin_crypto_api_key_placeholder')}
                  />
                </div>
                <div>
                  <Label>{t('admin_crypto_api_secret')}</Label>
                  <Input
                    name="api_secret"
                    type="password"
                    value={cryptoForm.api_secret}
                    onChange={handleCryptoChange}
                    className="mt-1 bg-secondary border-border"
                    placeholder={t('admin_crypto_api_secret_placeholder')}
                  />
                </div>
                <div>
                  <Label>{t('admin_crypto_merchant_id')}</Label>
                  <Input
                    name="merchant_id"
                    value={cryptoForm.merchant_id}
                    onChange={handleCryptoChange}
                    className="mt-1 bg-secondary border-border"
                    placeholder={t('admin_crypto_merchant_id_placeholder')}
                  />
                </div>
              </div>
              <div className="mt-4">
                <Button onClick={saveCryptoConfig}>{t('admin_save_crypto')}</Button>
              </div>
            </div>
          </div>
        ) : null}

        {showLogs ? (
          <div className="surface-card p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">{t('admin_action_logs')}</h2>
            <div className="space-y-3 max-h-96 overflow-auto">
              {logs.length ? logs.map((log, index) => (
                <div key={index} className="flex items-center justify-between text-sm bg-secondary/50 border border-border rounded-lg px-3 py-2">
                  <div>
                    <div className="font-semibold">{log.action}</div>
                    <div className="text-[10px] text-muted-foreground">{log.details}</div>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                  </div>
                </div>
              )) : (
                <div className="text-sm text-muted-foreground">{t('admin_no_logs')}</div>
              )}
            </div>
          </div>
        ) : null}

        {showUsers ? (
          <div className="space-y-6">
            <div className="surface-card rounded-[32px] border border-border bg-slate-900/60 p-6">
              <div className="flex flex-col gap-2">
                <div className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Admin Control Center</div>
                <h2 className="text-2xl font-semibold">Account Management</h2>
                <p className="text-sm text-muted-foreground max-w-3xl">
                  Manage real-time challenges and keep user statuses synchronized with the prop firm rules.
                </p>
              </div>
            </div>
            <div className="grid gap-6">
              <section className="surface-card rounded-[32px] border border-border bg-slate-900/60 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Accounts</div>
                    <h3 className="text-xl font-semibold">All Challengers</h3>
                  </div>
                  <div className="relative w-full max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder={t('admin_search_accounts')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 h-10 rounded-2xl bg-secondary/60 border border-border text-xs"
                    />
                  </div>
                </div>
                <div className="mt-5 border-t border-border pt-5 space-y-3 max-h-[420px] overflow-auto">
                  {filteredAccounts.length ? (
                    filteredAccounts.map((acc) => {
                      const isSelected = selectedAccountId === acc.id;
                      const balance = Number(acc.balance ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
                      return (
                        <button
                          key={acc.id}
                          onClick={() => fetchAccountDetails(acc.id)}
                          className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                            isSelected
                              ? 'border-primary/60 bg-primary/10'
                              : 'border-border bg-secondary/20 hover:border-primary/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                              <div className="text-base font-semibold">{acc.user_name}</div>
                              <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                <span>{acc.user_email || '—'}</span>
                                <span className="px-2 py-1 rounded-full border border-border text-[10px] uppercase">
                                  {acc.challenge_type || 'N/A'}
                                </span>
                              </div>
                            </div>
                            <div className="text-right space-y-1">
                              <div className="text-sm font-semibold text-success">${balance}</div>
                              <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${statusBadgeClass(acc.status)}`}>
                                {acc.status}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-sm text-muted-foreground">{t('admin_no_accounts')}</div>
                  )}
                </div>
              </section>
              <section className="surface-card rounded-[32px] border border-border bg-slate-900/60 p-6 space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.4em] text-muted-foreground">User Details</div>
                    <h3 className="text-lg font-semibold">{selectedDetails?.user?.username || t('admin_select_account')}</h3>
                  </div>
                  {detailsLoading && (
                    <span className="text-xs text-muted-foreground">{t('admin_loading')}</span>
                  )}
                  {selectedDetails?.account?.status && (
                    <span className={`px-3 py-1 text-xs font-semibold uppercase rounded-full ${statusBadgeClass(selectedDetails.account.status)}`}>
                      {selectedDetails.account.status}
                    </span>
                  )}
                </div>
                {!selectedDetails ? (
                  <p className="text-sm text-muted-foreground">{t('admin_select_account')}</p>
                ) : (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-secondary/40 flex items-center justify-center text-xl font-semibold text-muted-foreground">
                        {(selectedDetails.user?.username || 'U')[0]?.toUpperCase()}
                      </div>
                      <div className="space-y-1">
                        <div className="text-base font-semibold">{selectedDetails.profile?.full_name || selectedDetails.user?.username}</div>
                        <div className="text-xs text-muted-foreground">{selectedDetails.user?.email}</div>
                        <div className="text-xs text-muted-foreground">{selectedDetails.profile?.country || '—'}</div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-border bg-background/40 p-4 space-y-3">
                        <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">{t('admin_user_profile')}</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label>{t('admin_user_name')}</Label>
                            <Input
                              value={editUser.username}
                              onChange={(e) => setEditUser((prev) => ({ ...prev, username: e.target.value }))}
                              className="mt-1 bg-secondary border-border"
                            />
                          </div>
                          <div>
                            <Label>{t('admin_user_email')}</Label>
                            <Input
                              value={editUser.email}
                              onChange={(e) => setEditUser((prev) => ({ ...prev, email: e.target.value }))}
                              className="mt-1 bg-secondary border-border"
                            />
                          </div>
                        </div>
                        <Button size="sm" className="mt-2" onClick={saveUserUpdates}>
                          {t('admin_save_user')}
                        </Button>
                      </div>

                      <div className="rounded-2xl border border-border bg-background/40 p-4 space-y-3">
                        <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">{t('admin_account_settings')}</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label>{t('admin_status')}</Label>
                            <select
                              value={editAccount.status}
                              onChange={(e) => setEditAccount((prev) => ({ ...prev, status: e.target.value }))}
                              className="mt-1 w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm"
                            >
                              <option value="active">active</option>
                              <option value="funded">funded</option>
                              <option value="failed">failed</option>
                            </select>
                          </div>
                          <div>
                            <Label>{t('admin_challenge')}</Label>
                            <select
                              value={editAccount.challenge_type}
                              onChange={(e) => setEditAccount((prev) => ({ ...prev, challenge_type: e.target.value }))}
                              className="mt-1 w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm"
                            >
                              <option value="demo">demo</option>
                              <option value="starter">starter</option>
                              <option value="pro">pro</option>
                              <option value="elite">elite</option>
                            </select>
                          </div>
                          <div>
                            <Label>{t('admin_balance')}</Label>
                            <Input
                              value={editAccount.balance}
                              onChange={(e) => setEditAccount((prev) => ({ ...prev, balance: e.target.value }))}
                              className="mt-1 bg-secondary border-border"
                            />
                          </div>
                          <div>
                            <Label>{t('admin_equity')}</Label>
                            <Input
                              value={editAccount.equity}
                              onChange={(e) => setEditAccount((prev) => ({ ...prev, equity: e.target.value }))}
                              className="mt-1 bg-secondary border-border"
                            />
                          </div>
                          <div>
                            <Label>{t('admin_initial_balance')}</Label>
                            <Input
                              value={editAccount.initial_balance}
                              onChange={(e) => setEditAccount((prev) => ({ ...prev, initial_balance: e.target.value }))}
                              className="mt-1 bg-secondary border-border"
                            />
                          </div>
                          <div>
                            <Label>{t('admin_daily_starting_equity')}</Label>
                            <Input
                              value={editAccount.daily_starting_equity}
                              onChange={(e) => setEditAccount((prev) => ({ ...prev, daily_starting_equity: e.target.value }))}
                              className="mt-1 bg-secondary border-border"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={saveAccountUpdates}>{t('admin_save_account')}</Button>
                          <Button size="sm" variant="success" onClick={() => handleStatusChange(selectedDetails.account.id, 'Funded')}>
                            {t('admin_fund')}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleStatusChange(selectedDetails.account.id, 'Failed')}>
                            {t('admin_fail')}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleStatusChange(selectedDetails.account.id, 'Active')}>
                            {t('admin_reset')}
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-background/40 p-4 space-y-3">
                        <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">{t('admin_security')}</div>
                        <div className="flex flex-col gap-2">
                          <Label>{t('admin_new_password')}</Label>
                          <Input
                            type="password"
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            className="bg-secondary border-border"
                            placeholder="••••••••"
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={resetUserPassword}>
                              {t('admin_reset_password')}
                            </Button>
                            <Button size="sm" variant="destructive" onClick={deleteAccount}>
                              {t('admin_delete_account')}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">{t('admin_open_positions')}</div>
                        {selectedDetails.positions?.length ? (
                          <div className="space-y-2">
                            {selectedDetails.positions.map((pos: any, index: number) => (
                              <div key={index} className="flex items-center justify-between text-sm rounded-2xl border border-border bg-secondary/40 px-3 py-2">
                                <div className="font-semibold">{pos.asset}</div>
                                <div className="text-muted-foreground">{t('admin_qty')} {pos.quantity}</div>
                                <div className="text-muted-foreground">{t('admin_avg')} {pos.avg_entry_price}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">{t('admin_no_positions')}</div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="text-xs uppercase tracking-[0.35em] text-muted-foreground">{t('admin_recent_trades')}</div>
                        {selectedDetails.trades?.length ? (
                          <div className="space-y-2">
                            {selectedDetails.trades.map((trade: any) => (
                              <div key={trade.id} className="flex items-center justify-between text-sm rounded-2xl border border-border bg-secondary/40 px-3 py-2">
                                <div className="font-semibold">{trade.asset}</div>
                                <div className="text-muted-foreground">{trade.type.toUpperCase()}</div>
                                <div className={`font-semibold ${trade.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                                  {trade.profit >= 0 ? '+' : ''}{trade.profit}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">{t('admin_no_trades')}</div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </section>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default AdminPanel;

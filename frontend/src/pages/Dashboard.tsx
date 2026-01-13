import { useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import {
  Wallet,
  TrendingUp,
  AlertTriangle,
  Activity,
  Zap,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  ListChecks,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { API_BASE_URL, useAccountStatsQuery, useMarketOverviewQuery, useAISignalsQuery, useMarketHistory, useNews } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCurrentUserId } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

const ONBOARDING_KEY = 'tradesense.dashboard.onboarding.dismissed';
const TICKER_TAPE_CONFIG = {
  symbols: [
    { proName: 'NASDAQ:AAPL', title: 'Apple' },
    { proName: 'NASDAQ:MSFT', title: 'Microsoft' },
    { proName: 'NASDAQ:TSLA', title: 'Tesla' },
    { proName: 'NASDAQ:NVDA', title: 'Nvidia' },
    { proName: 'NASDAQ:AMZN', title: 'Amazon' },
    { proName: 'NASDAQ:GOOGL', title: 'Alphabet' },
    { proName: 'NASDAQ:META', title: 'Meta' },
    { proName: 'NASDAQ:NFLX', title: 'Netflix' },
    { proName: 'NYSE:JPM', title: 'JPMorgan' },
    { proName: 'NYSE:BAC', title: 'Bank of America' },
    { proName: 'NYSE:V', title: 'Visa' },
    { proName: 'NYSE:MA', title: 'Mastercard' },
    { proName: 'NYSE:XOM', title: 'Exxon Mobil' },
    { proName: 'NYSE:NKE', title: 'Nike' },
    { proName: 'NYSE:DIS', title: 'Disney' },
    { proName: 'NYSE:KO', title: 'Coca-Cola' },
    { proName: 'NASDAQ:PEP', title: 'PepsiCo' },
    { proName: 'NYSE:ORCL', title: 'Oracle' },
    { proName: 'NASDAQ:AMD', title: 'AMD' },
    { proName: 'NASDAQ:INTC', title: 'Intel' },
    { proName: 'BVC:IAM', title: 'Maroc Telecom' },
    { proName: 'BVC:ATW', title: 'Attijariwafa Bank' },
    { proName: 'BVC:BOA', title: 'Bank of Africa' },
    { proName: 'BVC:ADH', title: 'Addoha' },
  ],
  showSymbolLogo: true,
  isTransparent: true,
  displayMode: 'adaptive',
  colorTheme: 'dark',
  locale: 'en',
};

type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  target: 'hero' | 'stats' | 'signals' | 'news';
};

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'hero',
    title: 'Live Pulse',
    description: 'Watch BTC and market data update in real time before diving into trading.',
    target: 'hero',
  },
  {
    id: 'stats',
    title: 'Performance Snapshot',
    description: 'Track balance, equity, profit and drawdown with a single glance.',
    target: 'stats',
  },
  {
    id: 'signals',
    title: 'AI Signals',
    description: 'New signals land here with confidence scores and reasons backed by TradeSense AI.',
    target: 'signals',
  },
  {
    id: 'news',
    title: 'Market Context',
    description: 'Press updates and headlines help you pair decisions with actual events.',
    target: 'news',
  },
];

const trackDashboardEvent = (name: string, detail?: Record<string, unknown>) => {
  if (typeof window === 'undefined') return;
  const win = window as Window & {
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: any[]) => void;
    analytics?: {
      track: (eventName: string, props?: Record<string, unknown>) => void;
    };
  };
  const payload = { event: name, ...detail };
  if (Array.isArray(win.dataLayer)) {
    win.dataLayer.push(payload);
  } else if (typeof win.gtag === 'function') {
    win.gtag('event', name, detail || {});
  } else if (win.analytics?.track) {
    win.analytics.track(name, detail);
  }
};

const Dashboard = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const userId = getCurrentUserId();
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const tickerContainerRef = useRef<HTMLDivElement | null>(null);
  const signalToastRef = useRef<string>('');
  const sessionSuccessTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: accountData, isLoading: accountLoading } = useAccountStatsQuery(userId);
  const account = accountData?.[0];
  const isFunded = account?.status === 'funded';
  const { data: assets = [] } = useMarketOverviewQuery(account?.id);
  const { data: signals = [], isLoading: aiLoading } = useAISignalsQuery(account?.id, isFunded);
  const { news } = useNews();
  const chartSymbols = ['BTC-USD', 'AAPL', 'IAM'];
  const { history, isLoading: historyLoading } = useMarketHistory(chartSymbols, 28);

  const stats = account || {
    balance: 0,
    equity: 0,
    status: 'NO_ACCOUNT',
    challenge_type: 'N/A',
    initial_balance: 10000,
    daily_starting_equity: 10000
  };

  const profitPercent = stats.initial_balance ? ((stats.equity - stats.initial_balance) / stats.initial_balance * 100).toFixed(2) : '0.00';
  const dailyDrawdown = stats.daily_starting_equity ? ((stats.daily_starting_equity - stats.equity) / stats.daily_starting_equity * 100).toFixed(2) : '0.00';
  const heroHighlight = showTour && tourStep === 0;
  const statsHighlight = showTour && tourStep === 1;
  const signalsHighlight = showTour && tourStep === 2;
  const newsHighlight = showTour && tourStep === 3;
  const newSignalBadge = isFunded && signals.some((signal) => Number(signal.confidence ?? 0) >= 70);
  const tourStepData = ONBOARDING_STEPS[tourStep] ?? ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1];
  const isTourFinished = tourStep >= ONBOARDING_STEPS.length;

  const bvcAssets = [
    { name: 'Maroc Telecom', symbol: 'IAM', color: 'bg-blue-500/20', text: 'text-blue-500', char: 'M' },
    { name: 'Attijariwafa Bank', symbol: 'ATW', color: 'bg-green-500/20', text: 'text-green-500', char: 'A' },
    { name: 'Bank of Africa', symbol: 'BOA', color: 'bg-indigo-500/20', text: 'text-indigo-500', char: 'B' },
    { name: 'Addoha', symbol: 'ADH', color: 'bg-red-500/20', text: 'text-red-500', char: 'A' },
  ];

  const assetName = (signal: any) => {
    const bvc = bvcAssets.find(a => a.symbol === signal.symbol);
    if (bvc) return bvc.name;
    return signal.name || signal.symbol;
  };

  const priceFor = (symbol: string) => {
    return assets.find((asset: any) => asset.symbol === symbol)?.price;
  };

  const signalTone = (color: string) => {
    if (color === 'success') return { text: 'text-success', bg: 'bg-success/10', border: 'border-success/20' };
    if (color === 'warning') return { text: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20' };
    if (color === 'destructive') return { text: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20' };
    return { text: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' };
  };

  const sparklinePath = (series: number[], width: number, height: number) => {
    if (!series.length) return '';
    const min = Math.min(...series);
    const max = Math.max(...series);
    const range = max - min || 1;
    return series
      .map((value, index) => {
        const x = (index / (series.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  };

  const chartAssets = [
    { symbol: 'BTC-USD', name: 'Bitcoin', line: '#fb923c', fill: 'rgba(251, 146, 60, 0.35)', tvSymbol: 'BINANCE:BTCUSDT' },
    { symbol: 'AAPL', name: 'Apple', line: '#38bdf8', fill: 'rgba(56, 189, 248, 0.35)', tvSymbol: 'NASDAQ:AAPL' },
    { symbol: 'IAM', name: 'Maroc Telecom', line: '#34d399', fill: 'rgba(52, 211, 153, 0.35)', tvSymbol: 'BVC:IAM' },
  ];

  const assetInfo = (symbol: string) => {
    return assets.find((asset: any) => asset.symbol === symbol);
  };

  const latestPrice = (symbol: string) => {
    return assetInfo(symbol)?.price;
  };

  const latestChange = (symbol: string) => {
    return assetInfo(symbol)?.change_pct;
  };

  const assetCurrency = (symbol: string) => {
    const currency = assetInfo(symbol)?.currency;
    if (currency) return currency;
    if (symbol.endsWith('USD')) return '$';
    return '';
  };

  const formatPrice = (symbol: string) => {
    const price = latestPrice(symbol);
    if (!price) return '---';
    const currency = assetCurrency(symbol);
    if (currency === 'DH') return `${price.toLocaleString()} DH`;
    if (currency) return `${currency}${price.toLocaleString()}`;
    return price.toLocaleString();
  };

  const formatChange = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const formatDelta = (value: number) => {
    if (!Number.isFinite(value)) return '—';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const heroHighlights = [
    { value: '$10M+', label: 'Funded capital' },
    { value: '2,500+', label: 'Active traders' },
    { value: '85%', label: 'Success rate' },
    { value: '24/7', label: 'Risk monitoring' },
  ];

  const recommendations = [
    !isFunded && {
      icon: ShieldCheck,
      title: t('dashboard_reco_funded_title'),
      description: t('dashboard_reco_funded_desc'),
      actionLabel: t('dashboard_reco_funded_action'),
      to: '/dashboard/wallet',
      tone: 'bg-primary/10 text-primary border-primary/20',
    },
    {
      icon: Sparkles,
      title: signals.length ? t('dashboard_reco_signals_title') : t('dashboard_reco_signals_empty_title'),
      description: signals.length ? t('dashboard_reco_signals_desc') : t('dashboard_reco_signals_empty_desc'),
      actionLabel: t('dashboard_reco_signals_action'),
      to: '/dashboard/trading',
      tone: 'bg-success/10 text-success border-success/20',
    },
    {
      icon: Lightbulb,
      title: t('dashboard_reco_watchlist_title'),
      description: t('dashboard_reco_watchlist_desc'),
      actionLabel: t('dashboard_reco_watchlist_action'),
      to: '/dashboard/trading',
      tone: 'bg-secondary/40 text-foreground border-border/60',
    },
    {
      icon: ListChecks,
      title: t('dashboard_reco_rules_title'),
      description: t('dashboard_reco_rules_desc'),
      actionLabel: t('dashboard_reco_rules_action'),
      to: '/dashboard/challenge',
      tone: 'bg-warning/10 text-warning border-warning/20',
    },
  ].filter(Boolean) as Array<{
    icon: typeof Lightbulb;
    title: string;
    description: string;
    actionLabel: string;
    to: string;
    tone: string;
  }>;

  const hasAccount = Boolean(account && account.id);
  const normalizedStatus = (stats.status || '').toLowerCase();
  const checklistSteps = [
    {
      id: 'profile',
      label: t('dashboard_checklist_profile'),
      done: hasAccount,
    },
    {
      id: 'challenge',
      label: t('dashboard_checklist_challenge'),
      done: stats.challenge_type && stats.challenge_type.toLowerCase() !== 'n/a',
    },
    {
      id: 'trade',
      label: t('dashboard_checklist_trade'),
      done: ['active', 'funded'].includes(normalizedStatus),
    },
  ];
  const completedCount = checklistSteps.filter((step) => step.done).length;
  const checklistProgress = Math.round((completedCount / checklistSteps.length) * 100);

  const handleTourAdvance = () => {
    if (!showTour) return;
    setTourStep((prev) => {
      const next = prev + 1;
      if (next >= ONBOARDING_STEPS.length) {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(ONBOARDING_KEY, 'true');
        }
        setShowTour(false);
        trackDashboardEvent('dashboard_tour_complete', { step: ONBOARDING_STEPS[prev]?.id });
        return ONBOARDING_STEPS.length - 1;
      }
      trackDashboardEvent('dashboard_tour_next', { step: ONBOARDING_STEPS[next]?.id });
      return next;
    });
  };

  const handleTourSkip = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ONBOARDING_KEY, 'true');
    }
    setShowTour(false);
    trackDashboardEvent('dashboard_tour_skipped', { step: tourStepData.id });
  };

  const handleStartTradingClick = () => {
    trackDashboardEvent('dashboard_cta_start_trading', { location: 'hero' });
  };

  const handleViewSignalsClick = () => {
    if (!isFunded) return;
    trackDashboardEvent('dashboard_cta_view_signals');
  };

  const TradingViewMini = ({ symbol }: { symbol: string }) => {
    const containerId = useMemo(() => `tv-mini-${symbol.replace(/[^a-z0-9]/gi, '')}`, [symbol]);

    useEffect(() => {
      if (!symbol) return;
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = '';
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
      script.async = true;
      script.innerHTML = JSON.stringify({
        symbol,
        width: '100%',
        height: '90',
        locale: 'en',
        dateRange: '1M',
        colorTheme: 'dark',
        isTransparent: true,
        autosize: true,
        chartOnly: true,
      });
      container.appendChild(script);
    }, [symbol, containerId]);

    return <div id={containerId} className="h-[90px] w-full" />;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = window.localStorage.getItem(ONBOARDING_KEY);
    if (!dismissed) {
      setShowTour(true);
      trackDashboardEvent('dashboard_tour_started', { initialStep: ONBOARDING_STEPS[0].id });
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!tickerContainerRef.current) return;
    tickerContainerRef.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.async = true;
    script.innerHTML = JSON.stringify(TICKER_TAPE_CONFIG);
    tickerContainerRef.current.appendChild(script);
    return () => {
      if (tickerContainerRef.current) {
        tickerContainerRef.current.innerHTML = '';
      }
    };
  }, []);

  useEffect(() => {
    if (!isFunded || !signals.length) return;
    const latestSignal = signals[0];
    const key = `${latestSignal.symbol}-${latestSignal.side}-${latestSignal.confidence}-${latestSignal.reason || ''}`;
    if (signalToastRef.current === key) return;
    signalToastRef.current = key;
    toast({
      title: `${latestSignal.side} · ${assetName(latestSignal)}`,
      description: `${latestSignal.symbol} • ${latestSignal.reason || 'Signal detected'} • ${latestSignal.confidence}% confidence`,
    });
    trackDashboardEvent('ai_signal_toast', {
      symbol: latestSignal.symbol,
      confidence: latestSignal.confidence,
      side: latestSignal.side,
    });
  }, [signals, isFunded, toast]);

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;
    const keepAlive = async () => {
      if (typeof window === 'undefined') return;
      const token = window.localStorage.getItem('auth_token');
      if (!token) return;
      try {
        const response = await fetch(`${API_BASE_URL}/auth/keep-alive`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!isMounted) return;
        if (!response.ok) {
          throw new Error('keep-alive failed');
        }
        if (sessionSuccessTimeout.current) {
          clearTimeout(sessionSuccessTimeout.current);
          sessionSuccessTimeout.current = null;
        }
        setSessionStatus('ok');
        sessionSuccessTimeout.current = window.setTimeout(() => {
          if (isMounted) {
            setSessionStatus('idle');
          }
        }, 5000);
      } catch (error) {
        if (!isMounted) return;
        setSessionStatus('error');
        trackDashboardEvent('session_keep_alive_failed', { error: `${error}` });
      }
    };
    keepAlive();
    const interval = setInterval(keepAlive, 2 * 60 * 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
      if (sessionSuccessTimeout.current) {
        clearTimeout(sessionSuccessTimeout.current);
        sessionSuccessTimeout.current = null;
      }
    };
  }, [userId]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-muted-foreground">
              {t('dashboard_subtitle')} <span className="font-semibold">{stats.status}</span>
            </p>
          </div>
          <Button variant="hero" asChild>
            <Link to="/dashboard/trading" onClick={handleStartTradingClick}>
              {t('dashboard_start_trading')}
            </Link>
          </Button>
        </div>

        <div className="ticker-line w-full overflow-hidden rounded-2xl border border-border/60 bg-[#0b0f14]">
          <div className="tradingview-widget-container" ref={tickerContainerRef}>
            <div className="tradingview-widget-container__widget" />
          </div>
        </div>

        {/* Hero pulse */}
        <section className="surface-card relative overflow-hidden rounded-[30px] border border-primary/30 px-6 py-8 bg-gradient-to-r from-primary/5 via-transparent to-emerald-400/10 animate-hero-glow">
          <div className="pointer-events-none absolute inset-0 opacity-70">
            <div className="absolute top-0 left-0 h-full w-full bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.4),_transparent_45%)]" />
          </div>
          <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <p className="text-xs uppercase tracking-[0.45em] text-muted-foreground">Live hub · AI pulse</p>
              <h2 className="text-3xl md:text-4xl font-bold text-primary leading-tight">
                <span className="block">Trade smarter.</span>
                <span className="block">Get funded.</span>
              </h2>
              <p className="text-muted-foreground max-w-2xl">
                Real-time snapshots, AI-ready signals, and 24/7 execution across Casablanca + global markets. Stay disciplined, finish onboarding, and unlock funding faster.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button variant="hero" asChild size="lg" className="shadow-[0_15px_35px_rgba(56,189,248,0.35)]">
                  <Link to="/dashboard/trading" onClick={handleStartTradingClick}>
                    Start Challenge
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
                <Link
                  to="/dashboard/wallet"
                  className="inline-flex items-center justify-center rounded-[18px] bg-[#fcbf0f] px-5 py-3 text-sm font-semibold text-[#1f2327] transition hover:bg-[#f5b52c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fcbf0f]"
                >
                  <span className="mr-2">View Plans</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {heroHighlights.map((highlight) => (
                  <div
                    key={highlight.label}
                    className="rounded-2xl border border-border/60 bg-background/50 px-4 py-5 text-center transition hover:border-primary/70 hover:shadow-[0_16px_40px_rgba(15,118,255,0.25)]"
                  >
                    <div className="text-xl font-semibold text-primary">{highlight.value}</div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">
                      {highlight.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {chartAssets.map((asset) => (
                <div
                  key={asset.symbol}
                  className="rounded-2xl border border-border/60 bg-background/70 p-4 text-center tracking-tight"
                >
                  <div className="text-xs uppercase text-muted-foreground">{asset.symbol}</div>
                  <div className="text-lg font-semibold">{asset.name}</div>
                  <div className="mt-2 text-base font-mono">{formatPrice(asset.symbol)}</div>
                  <div className="text-sm text-success">{formatChange(latestChange(asset.symbol) ?? null)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {showTour && !isTourFinished && (
          <div className="tour-guide">
            <div className="tour-guide-content">
              <p className="text-[11px] uppercase tracking-[0.4em] text-muted-foreground mb-1">
                Tour {tourStep + 1}/{ONBOARDING_STEPS.length}
              </p>
              <h3 className="text-lg font-semibold">{tourStepData.title}</h3>
              <p className="text-sm text-muted-foreground">{tourStepData.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full border border-border/50 px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
                  onClick={handleTourSkip}
                >
                  Skip tour
                </button>
                <button
                  type="button"
                  className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary/90"
                  onClick={handleTourAdvance}
                >
                  {tourStep + 1 >= ONBOARDING_STEPS.length ? 'Finish tour' : 'Next step'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <section
          className={`surface-card grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6 ${
            statsHighlight ? 'tour-highlight' : ''
          }`}
        >
          {accountLoading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={`stat-skeleton-${idx}`} className="surface-card p-6 animate-pulse">
                <div className="h-4 w-24 rounded bg-muted mb-4" />
                <div className="h-8 w-32 rounded bg-muted" />
              </div>
            ))
          ) : (
          <>
          <div className="surface-card p-6 transition-transform duration-500 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(56,189,248,0.25)] animate-card-float">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">{t('dashboard_account_balance')}</span>
            </div>
            <div className="text-2xl font-bold trading-number">${stats.balance?.toLocaleString()}</div>
          </div>

          <div className="surface-card p-6 transition-transform duration-500 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(34,197,94,0.25)] animate-card-float">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-success" />
              </div>
              <span className="text-sm text-muted-foreground">{t('dashboard_equity')}</span>
            </div>
            <div className="text-2xl font-bold trading-number">${stats.equity?.toLocaleString()}</div>
          </div>

          <div className="surface-card p-6 transition-transform duration-500 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(16,185,129,0.3)] animate-card-float">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
              <span className="text-sm text-muted-foreground">{t('dashboard_total_profit')}</span>
            </div>
            <div className={`text-2xl font-bold trading-number ${parseFloat(profitPercent) >= 0 ? 'text-success' : 'text-destructive'}`}>
              {parseFloat(profitPercent) >= 0 ? '+' : ''}{profitPercent}%
            </div>
          </div>

          <div className="surface-card p-6 transition-transform duration-500 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(249,115,22,0.25)] animate-card-float">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <span className="text-sm text-muted-foreground">{t('dashboard_daily_drawdown')}</span>
            </div>
            <div className="text-2xl font-bold trading-number text-warning">{dailyDrawdown}%</div>
          </div>
          </>
          )}
        </section>

        <div className="surface-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="section-title">{t('dashboard_onboarding')}</div>
              <h2 className="text-lg font-semibold">{t('dashboard_checklist_title')}</h2>
              <p className="text-xs text-muted-foreground mt-1">{t('dashboard_checklist_hint')}</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard/profile">{t('dashboard_onboarding_cta')}</Link>
            </Button>
          </div>
          <div className="mt-6">
            <div className="h-2 rounded-full bg-secondary/40 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-success transition-all duration-500"
                style={{ width: `${checklistProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
              <span>{t('dashboard_onboarding_title')}</span>
              <span>{checklistProgress}%</span>
            </div>
          </div>
          <ul className="mt-6 space-y-3">
            {checklistSteps.map((step) => (
              <li key={step.id} className="flex items-center gap-3">
                <span
                  className={`w-3 h-3 rounded-full ${
                    step.done ? 'bg-success' : 'bg-muted-foreground/60'
                  }`}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">{step.label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {step.done
                      ? t('dashboard_checklist_status_completed')
                      : t('dashboard_checklist_status_pending')}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Challenge Progress */}
        <div className="surface-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">{t('dashboard_challenge_progress')} - {stats.challenge_type}</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              stats.status === 'active' || stats.status === 'funded'
                ? 'bg-success/20 text-success'
                : 'bg-destructive/20 text-destructive'
            }`}>
              {stats.status?.toUpperCase() || 'OFFLINE'}
            </span>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{t('dashboard_profit_target_progress')}</span>
                <span className="text-sm font-medium">{profitPercent}% / 10%</span>
              </div>
              <div className="h-3 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-success rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(0, Math.min(parseFloat(profitPercent) / 10 * 100, 100))}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <section className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6">
          <div className={`surface-card p-6 ${newsHighlight ? 'tour-highlight' : ''}`}>
            <h2 className="text-lg font-semibold mb-4">{t('dashboard_live_hub')}</h2>
            <div className="space-y-4 max-h-[400px] overflow-auto pr-2 custom-scrollbar">
              <div className="flex items-center gap-4 p-3 rounded-lg border border-border/60 bg-gradient-to-r from-primary/10 to-transparent">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                  <span className="text-xl text-orange-500 font-bold">₿</span>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">BTC/USD</div>
                  <div className="text-lg font-bold trading-number">
                    ${priceFor('BTC-USD') ? priceFor('BTC-USD').toLocaleString() : '---'}
                  </div>
                </div>
                <div className="ml-auto">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                </div>
              </div>
              {bvcAssets.map((asset) => (
                <div key={asset.symbol} className="flex items-center gap-4 p-3 rounded-lg transition-colors duration-200 hover:bg-secondary/30">
                  <div className={`w-10 h-10 rounded-xl ${asset.color} flex items-center justify-center`}>
                    <span className={`text-xl ${asset.text} font-bold`}>{asset.char}</span>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">{asset.name}</div>
                    <div className="text-lg font-bold trading-number">
                      {priceFor(asset.symbol) ? `${priceFor(asset.symbol)} DH` : '...'}
                    </div>
                  </div>
                  <div className="ml-auto text-[10px] font-bold text-muted-foreground">BVC</div>
                </div>
              ))}
              <div className="flex items-center gap-4 p-3 rounded-lg transition-colors duration-200 hover:bg-secondary/30">
                <div className="w-10 h-10 rounded-xl bg-gray-500/20 flex items-center justify-center">
                  <span className="text-xl text-white font-bold"></span>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Apple Inc</div>
                  <div className="text-lg font-bold trading-number">
                    ${priceFor('AAPL') ? priceFor('AAPL').toLocaleString() : '---'}
                  </div>
                </div>
                <div className="ml-auto">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="surface-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="section-title">{t('dashboard_reco_title')}</div>
                  <h2 className="text-lg font-semibold">{t('dashboard_reco_subtitle')}</h2>
                </div>
                <span className="text-xs text-muted-foreground">{t('dashboard_reco_hint')}</span>
              </div>
              <div className="space-y-3">
                {recommendations.map((rec) => (
                  <div key={rec.title} className={`rounded-xl border p-4 ${rec.tone}`}>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <rec.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">{rec.title}</div>
                        <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
                        <Button variant="outline" size="sm" className="mt-3" asChild>
                          <Link to={rec.to}>{rec.actionLabel}</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="section-title">{t('dashboard_news_title')}</div>
                  <h2 className="text-lg font-semibold">{t('dashboard_news_subtitle')}</h2>
                </div>
                <span className="text-xs text-muted-foreground">{t('dashboard_news_hint')}</span>
              </div>
              <div className="space-y-3">
                {news.length ? news.slice(0, 5).map((item: any, idx: number) => (
                  <div key={`${item.headline}-${idx}`} className="rounded-xl border border-border/60 bg-secondary/30 p-4">
                    <div className="text-sm font-semibold">{item.headline}</div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.summary}</p>
                    <div className="text-[10px] text-muted-foreground mt-2">
                      {t('dashboard_news_source')} {item.source || '—'}
                    </div>
                  </div>
                )) : (
                  <div className="text-sm text-muted-foreground">{t('dashboard_news_empty')}</div>
                )}
              </div>
            </div>

            <div className={`surface-card p-6 border-primary/30 ${signalsHighlight ? 'tour-highlight' : ''}`}>
              <div className="mb-4 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary flex items-center gap-2 text-xs font-semibold">
                <Zap className="w-4 h-4" />
                {t('dashboard_ai_banner')}
              </div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-lg font-semibold">{t('dashboard_ai_signals')}</h2>
              </div>
              <div className="space-y-4">
                {!isFunded ? (
                  <div className="p-4 rounded-lg bg-secondary/30 text-sm text-center">
                    {t('funded_only_ai')}
                  </div>
                ) : aiLoading ? (
                  <div className="p-4 rounded-lg bg-secondary animate-pulse text-sm text-center">{t('dashboard_ai_loading')}</div>
                ) : signals.length > 0 ? (
                  signals.map((signal, idx) => {
                    const tone = signalTone(signal.color);
                    return (
                      <div key={idx} className={`p-4 rounded-lg ${tone.bg} ${tone.border}`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className={`font-bold ${tone.text}`}>{signal.side} SIGNAL</span>
                          <span className="text-xs text-muted-foreground">{t('dashboard_confidence')} {signal.confidence}%</span>
                        </div>
                        <div className="text-sm font-medium mb-1">{assetName(signal)} ({signal.symbol})</div>
                        <div className="text-xs text-muted-foreground">{signal.reason}</div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 rounded-lg bg-secondary/20 text-sm text-center">{t('dashboard_ai_empty')}</div>
                )}
                <Button
                  variant="outline"
                  className="w-full text-xs h-8"
                  disabled={!isFunded}
                  onClick={handleViewSignalsClick}
                >
                  {t('dashboard_view_all_signals')}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;

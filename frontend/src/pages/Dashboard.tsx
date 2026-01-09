import { useEffect, useMemo } from 'react';
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
  ListChecks
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useAccountStatsQuery, useMarketOverviewQuery, useAISignalsQuery, useMarketHistory, useNews } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCurrentUserId } from '@/lib/auth';

const Dashboard = () => {
  const { t } = useLanguage();
  const userId = getCurrentUserId();
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
            <Link to="/dashboard/trading">{t('dashboard_start_trading')}</Link>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {accountLoading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={`stat-skeleton-${idx}`} className="surface-card p-6 animate-pulse">
                <div className="h-4 w-24 rounded bg-muted mb-4" />
                <div className="h-8 w-32 rounded bg-muted" />
              </div>
            ))
          ) : (
          <>
          <div className="surface-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">{t('dashboard_account_balance')}</span>
            </div>
            <div className="text-2xl font-bold trading-number">${stats.balance?.toLocaleString()}</div>
          </div>

          <div className="surface-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-success" />
              </div>
              <span className="text-sm text-muted-foreground">{t('dashboard_equity')}</span>
            </div>
            <div className="text-2xl font-bold trading-number">${stats.equity?.toLocaleString()}</div>
          </div>

          <div className="surface-card p-6">
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

          <div className="surface-card p-6">
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
        </div>

        {/* Market Pulse */}
        <div className="surface-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <div className="section-title">{t('dashboard_market_pulse')}</div>
              <h2 className="text-lg font-semibold">{t('dashboard_market_pulse_subtitle')}</h2>
            </div>
            <div className="text-xs text-muted-foreground">{t('dashboard_market_pulse_window')}</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {chartAssets.map((asset) => {
              const series = history?.[asset.symbol] || [];
              const path = sparklinePath(series, 240, 80);
              const delta = series.length > 1 ? ((series[series.length - 1] - series[0]) / (series[0] || 1)) * 100 : 0;
              const change = latestChange(asset.symbol);
              return (
                <div key={asset.symbol} className="rounded-xl border border-border/60 bg-secondary/30 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">{asset.symbol}</div>
                      <div className="text-sm font-semibold">{asset.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold trading-number">
                        {formatPrice(asset.symbol)}
                      </div>
                      <div className={`text-xs ${change === null || change === undefined || change < 0 ? 'text-destructive' : 'text-success'}`}>
                        {formatChange(change ?? null)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 h-[90px]">
                    {asset.tvSymbol ? (
                      <TradingViewMini symbol={asset.tvSymbol} />
                    ) : historyLoading ? (
                      <div className="h-full w-full rounded-lg bg-muted animate-pulse" />
                    ) : series.length < 2 ? (
                      <div className="h-full w-full rounded-lg bg-secondary/50 flex items-center justify-center text-xs text-muted-foreground">
                        {t('dashboard_market_no_chart')}
                      </div>
                    ) : (
                      <svg width="100%" height="90" viewBox="0 0 240 80" className="overflow-visible">
                        <defs>
                          <linearGradient id={`chart-${asset.symbol.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={asset.fill} />
                            <stop offset="100%" stopColor="transparent" />
                          </linearGradient>
                        </defs>
                        <path d={path} fill="none" stroke={asset.line} strokeWidth="2.4" />
                        <path
                          d={`${path} L240,80 L0,80 Z`}
                          fill={`url(#chart-${asset.symbol.replace(/[^a-z0-9]/gi, '')})`}
                        />
                      </svg>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t('dashboard_market_trend')}</span>
                    <span className={delta >= 0 ? 'text-success' : 'text-destructive'}>
                      {formatDelta(delta)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="surface-card p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="section-title">{t('dashboard_onboarding')}</div>
              <h2 className="text-lg font-semibold">{t('dashboard_onboarding_title')}</h2>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard/profile">{t('dashboard_onboarding_cta')}</Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            {[
              t('dashboard_onboarding_step_profile'),
              t('dashboard_onboarding_step_plan'),
              t('dashboard_onboarding_step_trade'),
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-lg bg-secondary/40 border border-border/60 px-3 py-2">
                <div className="w-2.5 h-2.5 rounded-full bg-primary/60" />
                <span>{item}</span>
              </div>
            ))}
          </div>
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

        {/* Live Marketplace */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="surface-card p-6">
              <h2 className="text-lg font-semibold mb-4">{t('dashboard_live_hub')}</h2>
              <div className="space-y-4 max-h-[400px] overflow-auto pr-2 custom-scrollbar">
              <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/30 transition-colors">
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
                <div key={asset.symbol} className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/30 transition-colors">
                  <div className={`w-10 h-10 rounded-xl ${asset.color} flex items-center justify-center`}>
                    <span className={`text-xl ${asset.text} font-bold`}>{asset.char}</span>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">{asset.name}</div>
                    <div className="text-lg font-bold trading-number">
                      {priceFor(asset.symbol) ? `${priceFor(asset.symbol)} DH` : '...'}
                    </div>
                  </div>
                  <div className="ml-auto">
                    <span className="text-[10px] font-bold text-muted-foreground">BVC</span>
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/30 transition-colors">
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
          </div>

          <div className="surface-card p-6 border-primary/30">
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
              <Button variant="outline" className="w-full text-xs h-8" disabled={!isFunded}>
                {t('dashboard_view_all_signals')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;

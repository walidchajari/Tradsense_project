import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowUp, ArrowDown, Brain, Zap, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAccountStats, useMarketOverview, useMarketPulse, useMarketHistory, useNews, useAISignals, useCasablancaCompanies, executeTrade } from '@/lib/api';
import { useTheme } from 'next-themes';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCurrentUserId } from '@/lib/auth';

type MarketCategory = 'Nasdaq' | 'Bourse de Casablanca' | 'Forex' | 'Crypto';

type Asset = {
  symbol: string;
  name: string;
  market: MarketCategory;
  currency?: string;
  price?: number;
  change_pct?: number | null;
  volume?: number | null;
};

const Trading = () => {
  const { t } = useLanguage();
  const userId = getCurrentUserId();
  const { account } = useAccountStats(userId);
  const isFunded = account?.status === 'funded';
  const { assets: overviewAssets } = useMarketOverview(account?.id);
  const { companies: casablancaCompanies } = useCasablancaCompanies({ limit: 200, minimal: false });
  const { pulse } = useMarketPulse(account?.id);
  const { news } = useNews();
  const { signals } = useAISignals(account?.id, isFunded);

  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [marketFilter, setMarketFilter] = useState<MarketCategory | 'All'>('All');
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState('0.1');
  const [sortBy, setSortBy] = useState<'price' | 'volume' | 'change'>('price');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [filterMode, setFilterMode] = useState<'all' | 'gainers' | 'losers' | 'high_volume'>('all');
  const [showCompanies, setShowCompanies] = useState(true);
  const [viewMode, setViewMode] = useState<'pro' | 'simple'>('pro');
  const [mobileTab, setMobileTab] = useState<'watchlist' | 'chart' | 'trade'>('chart');
  const [tpSlMode, setTpSlMode] = useState<'percent' | 'price'>('percent');
  const [takeProfit, setTakeProfit] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [tpEnabled, setTpEnabled] = useState(false);
  const [slEnabled, setSlEnabled] = useState(false);
  const { toast } = useToast();

  const coerceNumber = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    const cleaned = value.replace(/\s/g, '').replace(',', '.');
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : undefined;
  };

  const hasBvcAssets = overviewAssets.some((asset) => asset.market === 'Bourse de Casablanca');
  const bvcFallbackAssets: Asset[] = hasBvcAssets
    ? []
    : casablancaCompanies.map((company) => {
        const fallbackPrice =
          coerceNumber(company.closing_price) ??
          coerceNumber(company.opening_price) ??
          coerceNumber(company.high_price) ??
          coerceNumber(company.low_price);
        return {
          symbol: company.ticker,
          name: company.label || company.ticker,
          market: 'Bourse de Casablanca',
          currency: 'DH',
          price: fallbackPrice,
          change_pct: coerceNumber(company.variation),
          volume: null,
        };
      });

  const assets = hasBvcAssets ? overviewAssets : [...overviewAssets, ...bvcFallbackAssets];

  useEffect(() => {
    if (!selectedSymbol && assets.length) {
      const firstWithPrice = assets.find((asset) => asset.price);
      setSelectedSymbol((firstWithPrice || assets[0]).symbol);
    }
  }, [assets, selectedSymbol]);
  const marketOrder: MarketCategory[] = ['Crypto', 'Forex', 'Nasdaq', 'Bourse de Casablanca'];
  const marketLabel = (market: MarketCategory | 'All') => {
    if (market === 'All') return t('trading_market_all');
    if (market === 'Crypto') return t('trading_market_crypto');
    if (market === 'Forex') return t('trading_market_forex');
    if (market === 'Nasdaq') return t('trading_market_nasdaq');
    return t('trading_market_bvc');
  };
  const currentAsset = assets.find(a => a.symbol === selectedSymbol);
  const currentPrice = currentAsset?.price || 0;
  const qtyValue = parseFloat(quantity || '0');
  const isCasablanca = currentAsset?.market === 'Bourse de Casablanca';
  useEffect(() => {
    if (isCasablanca && (!quantity || parseFloat(quantity) < 1)) {
      setQuantity('1');
    }
  }, [isCasablanca, quantity]);
  const getLotSize = (market?: MarketCategory) => {
    if (market === 'Forex') return 100000;
    if (market === 'Nasdaq') return 100;
    if (market === 'Crypto') return 1;
    return 1;
  };
  const lotSize = getLotSize(currentAsset?.market);
  const quantityUnits = isCasablanca ? qtyValue : qtyValue * lotSize;
  const notionalValue = quantityUnits * currentPrice;
  const estPnl = notionalValue * 0.01;
  const tpValue = parseFloat(takeProfit || '0');
  const slValue = parseFloat(stopLoss || '0');
  const tpPrice = currentPrice && tpValue
    ? (tpSlMode === 'percent'
        ? currentPrice * (1 + (orderType === 'buy' ? tpValue : -tpValue) / 100)
        : tpValue)
    : 0;
  const slPrice = currentPrice && slValue
    ? (tpSlMode === 'percent'
        ? currentPrice * (1 + (orderType === 'buy' ? -slValue : slValue) / 100)
        : slValue)
    : 0;

  const formatPrice = (price: number | undefined, currency?: string) => {
    if (!price) return '...';
    const formatted = price.toLocaleString();
    return currency ? `${formatted} ${currency}` : formatted;
  };

  const formatVolume = (volume?: number | null) => {
    if (!volume) return '—';
    if (volume >= 1_000_000_000) return `${(volume / 1_000_000_000).toFixed(2)}B`;
    if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(2)}M`;
    if (volume >= 1_000) return `${(volume / 1_000).toFixed(2)}K`;
    return volume.toFixed(0);
  };

  const getRiskLevel = () => {
    if (!account) return { label: t('trading_risk_low'), color: 'bg-success/20 text-success' };
    const dailyLimit = 0.05;
    const totalLimit = 0.10;
    const dailyDrawdown = account.daily_starting_equity
      ? (account.daily_starting_equity - account.equity) / account.daily_starting_equity
      : 0;
    const totalDrawdown = account.initial_balance
      ? (account.initial_balance - account.equity) / account.initial_balance
      : 0;
    const maxRatio = Math.max(dailyDrawdown / dailyLimit, totalDrawdown / totalLimit);
    if (maxRatio >= 0.8) return { label: t('trading_risk_high'), color: 'bg-destructive/20 text-destructive' };
    if (maxRatio >= 0.5) return { label: t('trading_risk_medium'), color: 'bg-warning/20 text-warning' };
    return { label: t('trading_risk_low'), color: 'bg-success/20 text-success' };
  };

  const getProfitProgress = () => {
    if (!account || !account.initial_balance) return 0;
    const profitPct = ((account.equity - account.initial_balance) / account.initial_balance) * 100;
    return Math.min(Math.max((profitPct / 10) * 100, 0), 100);
  };

  const getIcon = (symbol: string) => {
    if (symbol.startsWith('BTC')) return '₿';
    if (symbol.startsWith('ETH')) return 'Ξ';
    return symbol[0] || '•';
  };
  const getLotUnitLabel = () => {
    if (currentAsset?.market === 'Nasdaq') return t('trading_unit_shares');
    if (currentAsset?.market === 'Crypto') return t('trading_unit_coins');
    return t('trading_unit_units');
  };
  const quantityLabel = isCasablanca ? t('trading_quantity_shares') : t('trading_quantity_lots');
  const qtyLabel = isCasablanca ? t('trading_qty_shares') : t('trading_qty_lots');
  const unitLabel = isCasablanca ? t('trading_unit_shares') : t('trading_unit_lots');

  const handleExecuteTrade = async () => {
    if (!account) {
      toast({ title: "Error", description: "No account found", variant: "destructive" });
      return;
    }

    if (account.status !== 'active' && account.status !== 'funded') {
      toast({ title: "Account Inactive", description: `Account is ${account.status}. Access denied.`, variant: "destructive" });
      return;
    }

    const currentPrice = assets.find((asset) => asset.symbol === selectedSymbol)?.price;
    if (!currentPrice) {
      toast({ title: "Error", description: "Waiting for market price...", variant: "destructive" });
      return;
    }

    if (isCasablanca && qtyValue < 1) {
      toast({ title: "Error", description: `Minimum 1 ${t('trading_unit_shares')}`, variant: "destructive" });
      return;
    }

    const result = await executeTrade({
      account_id: account.id,
      asset: selectedSymbol,
      side: orderType,
      quantity: quantityUnits,
      price: currentPrice,
      market: currentAsset?.market,
      take_profit: tpEnabled && tpPrice > 0 ? tpPrice : undefined,
      stop_loss: slEnabled && slPrice > 0 ? slPrice : undefined
    });

    if (result.error) {
      toast({ title: "Trade Failed", description: result.error, variant: "destructive" });
    } else {
      const tpSummary = tpEnabled && tpValue ? `TP ${tpSlMode === 'percent' ? `${tpValue}%` : tpValue}` : '';
      const slSummary = slEnabled && slValue ? `SL ${tpSlMode === 'percent' ? `${slValue}%` : slValue}` : '';
      const extras = [tpSummary, slSummary].filter(Boolean).join(' • ');
      toast({
        title: `${orderType.toUpperCase()} Executed`,
        description: `${quantity} ${isCasablanca ? t('trading_unit_shares') : t('trading_unit_lots')} of ${selectedSymbol} at ${currentPrice}${extras ? ` (${extras})` : ''}`
      });
    }
  };

  const getTvSymbol = (asset: Asset | undefined) => {
    if (!asset) return 'NASDAQ:AAPL';
    if (asset.market === 'Bourse de Casablanca') return `CSEMA:${asset.symbol}`;
    if (asset.market === 'Nasdaq') return `NASDAQ:${asset.symbol}`;
    if (asset.market === 'Forex') {
      const base = asset.symbol.replace('=X', '');
      return `FX:${base}`;
    }
    if (asset.market === 'Crypto') {
      const base = asset.symbol.replace('-USD', '');
      return `BINANCE:${base}USDT`;
    }
    return asset.symbol;
  };

  const volumeValues = assets.map((asset) => asset.volume || 0).sort((a, b) => b - a);
  const volumeThreshold = volumeValues.length ? volumeValues[Math.floor(volumeValues.length * 0.3)] : 0;

  const filteredAssets = assets.filter((asset) => {
    const matchesMarket = marketFilter === 'All' ? true : asset.market === marketFilter;
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = term
      ? asset.symbol.toLowerCase().includes(term) || asset.name.toLowerCase().includes(term)
      : true;
    const matchesMode = (() => {
      if (filterMode === 'gainers') return (asset.change_pct || 0) > 0;
      if (filterMode === 'losers') return (asset.change_pct || 0) < 0;
      if (filterMode === 'high_volume') return (asset.volume || 0) >= volumeThreshold;
      return true;
    })();
    return matchesMarket && matchesSearch && matchesMode;
  });

  const totalAssets = assets.length;
  const pricedAssets = assets.filter((asset) => asset.price).length;

  const getSortValue = (asset: Asset) => {
    if (sortBy === 'price') return asset.price ?? null;
    if (sortBy === 'volume') return asset.volume ?? null;
    return asset.change_pct ?? null;
  };

  const sortedAssets = [...filteredAssets].sort((a, b) => {
    const aVal = getSortValue(a);
    const bVal = getSortValue(b);
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const groupedAssets = sortedAssets.reduce<Record<string, Asset[]>>((acc, asset) => {
    if (!acc[asset.market]) {
      acc[asset.market] = [];
    }
    acc[asset.market].push(asset);
    return acc;
  }, {});

  const risk = getRiskLevel();
  const riskTone = risk.color.includes('destructive')
    ? 'text-destructive'
    : risk.color.includes('warning')
      ? 'text-warning'
      : 'text-success';
  const profitProgress = getProfitProgress();
  const dailyDrawdownPct = account?.daily_starting_equity
    ? ((account.daily_starting_equity - account.equity) / account.daily_starting_equity) * 100
    : null;
  const totalDrawdownPct = account?.initial_balance
    ? ((account.initial_balance - account.equity) / account.initial_balance) * 100
    : null;
  const historySymbols = sortedAssets.slice(0, 12).map((asset) => asset.symbol);
  const { history } = useMarketHistory(historySymbols, 20, account?.id);

  const buildSparklineFromValues = (values: number[]) => {
    if (!values.length) return '0,50 100,50';
    const min = Math.min(...values);
    const max = Math.max(...values);
    return values.map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = max === min ? 50 : 100 - ((v - min) / (max - min)) * 100;
      return `${x},${y}`;
    }).join(' ');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t('trading_title')}</h1>
          <div className="flex items-center gap-4 text-muted-foreground">
            <p>{t('trading_subtitle')}</p>
            {pulse && pulse.nasdaq && (
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold">NASDAQ:</span>
                <span>{pulse.nasdaq.price}</span>
                <span className={pulse.nasdaq.change_pct > 0 ? 'text-success' : 'text-destructive'}>
                  {pulse.nasdaq.change_pct > 0 ? '+' : ''}{pulse.nasdaq.change_pct?.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        </div>


        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
                {
                  label: t('wallet_balance'),
                  value: account ? `$${account.balance.toLocaleString()}` : '—',
                  tone: 'text-foreground',
                },
                {
                  label: t('wallet_equity'),
                  value: account ? `$${account.equity.toLocaleString()}` : '—',
                  tone: 'text-foreground',
                },
                {
                  label: t('trading_risk'),
                  value: `${risk.label}`,
                  tone: riskTone,
                },
                {
                  label: t('challenge_profit_loss'),
                  value: totalDrawdownPct != null ? `${totalDrawdownPct.toFixed(2)}%` : '—',
                  tone: totalDrawdownPct != null && totalDrawdownPct > 0 ? 'text-destructive' : 'text-success',
                },
              ].map((stat) => (
                <div key={stat.label} className="surface-card px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{stat.label}</div>
                  <div className={`text-lg font-semibold trading-number ${stat.tone}`}>{stat.value}</div>
                </div>
              ))}
            </div>

              <div className="surface-card px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t('trading_view_mode')}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('simple')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    viewMode === 'simple' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'
                  }`}
                >
                  {t('trading_view_simple')}
                </button>
                <button
                  onClick={() => setViewMode('pro')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    viewMode === 'pro' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'
                  }`}
                >
                  {t('trading_view_pro')}
                </button>
              </div>
            </div>

            <div className="lg:hidden surface-card px-3 py-2 flex gap-2">
              {[
                { key: 'chart', label: t('trading_tab_chart') },
                { key: 'trade', label: t('trading_tab_trade') },
                { key: 'watchlist', label: t('trading_tab_watchlist') },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setMobileTab(tab.key as typeof mobileTab)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold ${
                    mobileTab === tab.key ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div className="surface-card p-4 md:p-5">
                <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{t('trading_watchlist')}</h2>
                    <p className="text-xs text-muted-foreground">{t('trading_watchlist_subtitle')}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <div className="px-3 py-1 rounded-full bg-secondary/60 border border-border">
                      {t('trading_assets')} {filteredAssets.length}
                    </div>
                    <div className="px-3 py-1 rounded-full bg-success/10 text-success border border-success/30">
                      {t('trading_live')} {pricedAssets}/{totalAssets}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCompanies((prev) => !prev)}
                      className="rounded-full text-xs h-8"
                    >
                      {showCompanies ? t('trading_hide_companies') : t('trading_show_companies')}
                    </Button>
                  </div>
                </div>

                {viewMode === 'pro' ? (
                  <>
                    <div className="mt-4 grid grid-cols-1 xl:grid-cols-[minmax(240px,1fr)_auto] gap-4">
                      <div className="flex flex-col lg:flex-row gap-3">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder={t('trading_search')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-secondary border-border"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as 'price' | 'volume' | 'change')}
                            className="h-10 rounded-full bg-secondary border border-border px-3 text-xs font-semibold"
                          >
                            <option value="price">{t('trading_sort_price')}</option>
                            <option value="volume">{t('trading_sort_volume')}</option>
                            <option value="change">{t('trading_sort_change')}</option>
                          </select>
                          <button
                            onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
                            className="h-10 px-3 rounded-full border border-border text-xs font-semibold hover:border-primary/50"
                          >
                            {sortDir === 'desc' ? t('trading_sort_desc') : t('trading_sort_asc')}
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap items-center">
                        {(['All', ...marketOrder] as (MarketCategory | 'All')[]).map((market) => (
                          <button
                            key={market}
                            onClick={() => setMarketFilter(market as MarketCategory | 'All')}
                            className={`px-3 py-2 rounded-full text-xs font-semibold border transition-all ${
                              marketFilter === market
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            {marketLabel(market)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        { key: 'all', label: t('trading_filter_all') },
                        { key: 'gainers', label: t('trading_filter_gainers') },
                        { key: 'losers', label: t('trading_filter_losers') },
                        { key: 'high_volume', label: t('trading_filter_volume') },
                      ].map((chip) => (
                        <button
                          key={chip.key}
                          onClick={() => setFilterMode(chip.key as typeof filterMode)}
                          className={`px-3 py-1.5 rounded-full text-[10px] font-semibold border transition-all ${
                            filterMode === chip.key
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="mt-4 flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder={t('trading_search')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 bg-secondary border-border"
                      />
                    </div>
                    <button
                      onClick={() => setMarketFilter('All')}
                      className="px-3 py-2 rounded-full text-xs font-semibold border border-border hover:border-primary/50"
                    >
                      All
                    </button>
                  </div>
                )}
              </div>
              <div className={mobileTab === 'watchlist' ? 'block' : 'hidden lg:block'}>
                {showCompanies ? (
                  marketOrder.map((market) => (
                    (groupedAssets[market] && groupedAssets[market].length > 0) ? (
                    <div key={market}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">{market}</div>
                        <div className="hidden sm:flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span>{t('trading_price')}</span>
                          <span>{t('trading_change')}</span>
                          <span>{t('trading_volume')}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {(groupedAssets[market] || []).map((asset) => (
                          <button
                            key={asset.symbol}
                            onClick={() => setSelectedSymbol(asset.symbol)}
                            className={`grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto] gap-3 items-center px-3 sm:px-4 py-3 rounded-xl border transition-all ${selectedSymbol === asset.symbol
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary/50'
                              }`}
                          >
                            <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center font-bold text-sm">
                              {getIcon(asset.symbol)}
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-semibold">{asset.symbol}</div>
                              <div className="text-[10px] text-muted-foreground line-clamp-1 hidden sm:block">{asset.name}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold trading-number text-success">
                                {formatPrice(asset.price, asset.currency)}
                              </div>
                              <div className="text-[10px] text-muted-foreground sm:hidden">
                                {asset.change_pct != null ? `${asset.change_pct > 0 ? '+' : ''}${asset.change_pct.toFixed(2)}%` : '—'}
                              </div>
                            </div>
                            <div className="hidden sm:flex flex-col items-end gap-1">
                              <span className={`text-xs font-semibold ${asset.change_pct != null && asset.change_pct < 0 ? 'text-destructive' : 'text-success'}`}>
                                {asset.change_pct != null ? `${asset.change_pct > 0 ? '+' : ''}${asset.change_pct.toFixed(2)}%` : '—'}
                              </span>
                              <span className="text-[10px] text-muted-foreground">{t('trading_vol')} {formatVolume(asset.volume)}</span>
                              <svg viewBox="0 0 100 40" className="w-20 h-6">
                                <polyline
                                  fill="none"
                                  stroke={asset.change_pct != null && asset.change_pct < 0 ? '#ef4444' : '#22c55e'}
                                  strokeWidth="2"
                                  points={buildSparklineFromValues(history[asset.symbol] || [])}
                                />
                              </svg>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    ) : null
                  ))
                ) : (
                  <div className="text-xs text-muted-foreground">{t('trading_companies_hidden')}</div>
                )}
              </div>
            </div>

            <div className={`grid grid-cols-1 gap-6 items-start ${mobileTab === 'watchlist' ? 'hidden lg:grid' : 'grid'}`}>
              <div className="surface-card p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-secondary/60 border border-border flex items-center justify-center text-xl font-bold">
                      {currentAsset ? getIcon(currentAsset.symbol) : '•'}
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">
                        {currentAsset?.market || t('trading_market_all')}
                      </div>
                      <div className="text-xl font-bold">{currentAsset?.symbol || '---'}</div>
                      <div className="text-3xl font-bold trading-number mt-1">
                        {currentPrice ? formatPrice(currentPrice, currentAsset?.currency) : '---'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{currentAsset?.name || '—'}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className={`px-3 py-1 rounded-full border border-border/70 text-xs font-semibold ${currentAsset?.change_pct != null && currentAsset.change_pct < 0 ? 'text-destructive' : 'text-success'}`}>
                      {currentAsset?.change_pct != null ? `${currentAsset.change_pct > 0 ? '+' : ''}${currentAsset.change_pct.toFixed(2)}%` : '—'}
                    </div>
                    <div className="px-3 py-1 rounded-full border border-border/70 text-xs font-semibold text-muted-foreground">
                      {t('trading_vol')} {formatVolume(currentAsset?.volume)}
                    </div>
                    <div className={`px-3 py-1 rounded-full flex items-center gap-1 ${risk.color}`} title={t('trading_risk_tooltip')}>
                      <Zap className="w-4 h-4" />
                      <span className="text-xs font-bold">{t('trading_risk')} {risk.label}</span>
                    </div>
                    <div className="relative w-12 h-12">
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: `conic-gradient(#22c55e ${profitProgress}%, rgba(255,255,255,0.08) 0)`,
                        }}
                      />
                      <div className="absolute inset-[6px] rounded-full bg-background flex items-center justify-center text-[10px] font-semibold">
                        {Math.round(profitProgress)}%
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full flex items-center gap-1 ${isFunded ? 'bg-success/20 text-success' : 'bg-secondary text-muted-foreground'}`}>
                      <Zap className="w-4 h-4" />
                      <span className="text-xs font-bold">{isFunded ? t('trading_live_data') : t('funded_only_badge')}</span>
                    </div>
                  </div>
                </div>

                <div className="relative h-[560px] rounded-2xl overflow-hidden border border-primary/10 bg-gradient-to-br from-background via-background to-primary/5">
                  {isFunded ? (
                    <TradingViewWidget symbol={getTvSymbol(currentAsset)} containerId="tradingview_chart" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-secondary/40 text-center px-6">
                      <div className="text-sm font-semibold">{t('funded_only_title')}</div>
                      <div className="text-xs text-muted-foreground">{t('funded_only_charts')}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="surface-card p-6 border-primary/20">
                <h2 className="text-lg font-semibold mb-4">{t('trading_execution')}</h2>
                <div className="grid grid-cols-2 gap-2 mb-6">
                  <button
                    onClick={() => setOrderType('buy')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all ${orderType === 'buy' ? 'bg-success text-success-foreground' : 'bg-secondary text-muted-foreground'
                      }`}
                  >
                    <ArrowUp className="w-4 h-4" />
                    {t('trading_buy')}
                  </button>
                  <button
                    onClick={() => setOrderType('sell')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all ${orderType === 'sell' ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-muted-foreground'
                      }`}
                  >
                    <ArrowDown className="w-4 h-4" />
                    {t('trading_sell')}
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>{quantityLabel}</Label>
                    <Input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="bg-secondary border-border mt-1"
                      step={isCasablanca ? 1 : 0.01}
                      min={isCasablanca ? 1 : 0.01}
                    />
                    {!isCasablanca && currentAsset?.market && (
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        1 {t('trading_unit_lot')} = {lotSize.toLocaleString()} {getLotUnitLabel()}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm font-semibold">{t('trading_tp_sl')}</div>
                      <select
                        value={tpSlMode}
                        onChange={(e) => setTpSlMode(e.target.value as typeof tpSlMode)}
                        className="h-9 rounded-full bg-secondary border border-border px-3 text-xs font-semibold"
                      >
                        <option value="percent">{t('trading_tp_mode_percent')}</option>
                        <option value="price">{t('trading_tp_mode_price')}</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="tp-enabled"
                          checked={tpEnabled}
                          onCheckedChange={(checked) => setTpEnabled(Boolean(checked))}
                        />
                        <Label htmlFor="tp-enabled" className="text-xs font-semibold">
                          {t('trading_take_profit')}
                        </Label>
                        <Input
                          type="number"
                          value={takeProfit}
                          onChange={(e) => setTakeProfit(e.target.value)}
                          placeholder={tpSlMode === 'percent' ? '5' : '105.50'}
                          className="bg-secondary border-border h-9"
                          disabled={!tpEnabled}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="sl-enabled"
                          checked={slEnabled}
                          onCheckedChange={(checked) => setSlEnabled(Boolean(checked))}
                        />
                        <Label htmlFor="sl-enabled" className="text-xs font-semibold">
                          {t('trading_stop_loss')}
                        </Label>
                        <Input
                          type="number"
                          value={stopLoss}
                          onChange={(e) => setStopLoss(e.target.value)}
                          placeholder={tpSlMode === 'percent' ? '2' : '98.10'}
                          className="bg-secondary border-border h-9"
                          disabled={!slEnabled}
                        />
                      </div>
                    </div>
                    {tpSlMode === 'percent' && currentPrice > 0 && (tpEnabled || slEnabled) && (
                      <div className="text-[10px] text-muted-foreground">
                        {tpEnabled && tpValue > 0 && (
                          <span className="mr-3">{t('trading_tp_price')} {tpPrice.toLocaleString()}</span>
                        )}
                        {slEnabled && slValue > 0 && (
                          <span>{t('trading_sl_price')} {slPrice.toLocaleString()}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-lg bg-secondary/50 border border-primary/5">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">{t('trading_market_price')}</span>
                      <span className="font-bold trading-number">{currentPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('trading_asset_type')}</span>
                      <span className="font-medium">{currentAsset?.market || '---'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
                      <div className="text-muted-foreground">{t('trading_side')}</div>
                      <div className="font-semibold">{orderType.toUpperCase()}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
                      <div className="text-muted-foreground">{qtyLabel}</div>
                      <div className="font-semibold">{qtyValue || 0} {unitLabel}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
                      <div className="text-muted-foreground">{t('trading_notional')}</div>
                      <div className="font-semibold">{notionalValue ? notionalValue.toLocaleString() : '—'}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
                      <div className="text-muted-foreground">{t('trading_est')}</div>
                      <div className={`font-semibold ${orderType === 'buy' ? 'text-success' : 'text-destructive'}`}>
                        {estPnl ? `${orderType === 'buy' ? '+' : '-'}${estPnl.toLocaleString()}` : '—'}
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleExecuteTrade}
                    className="w-full"
                    size="xl"
                    variant={orderType === 'buy' ? 'success' : 'destructive'}
                  >
                    {t('trading_execute')} {orderType.toUpperCase()}
                  </Button>

                  <p className="text-[10px] text-center text-muted-foreground mt-4">
                    {t('trading_rules_notice')}
                  </p>
                </div>
              </div>
            </div>

            {viewMode === 'pro' && (
              <div className={`surface-card p-6 ${mobileTab === 'trade' ? 'block' : 'hidden lg:block'}`}>
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">{t('trading_ai_hub')}</h2>
                </div>
                {!isFunded ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                    <div className="font-semibold text-foreground mb-1">{t('funded_only_title')}</div>
                    <div>{t('funded_only_ai')}</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(signals.length ? signals : []).map((signal, index) => (
                      <div key={index} className="p-4 rounded-lg bg-secondary/50 border border-primary/5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{signal.symbol}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${signal.side === 'BUY' ? 'bg-success/20 text-success' : signal.side === 'SELL' ? 'bg-destructive/20 text-destructive' : 'bg-secondary text-muted-foreground'
                            }`}>
                            {signal.side}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="w-4 h-4 text-primary" />
                          <span className="text-sm trading-number">{signal.confidence}% Confidence</span>
                        </div>
                        {signal.reason && signal.reason.includes(';') ? (
                          <ul className="text-xs text-muted-foreground leading-tight list-disc list-inside space-y-1">
                            {signal.reason.split(';').slice(0, 3).map((item, idx) => (
                              <li key={`${signal.symbol}-${idx}`}>{item.trim()}</li>
                            ))}
                          </ul>
                        ) : (
                          <>
                            <p className="text-xs text-muted-foreground leading-tight mb-2">{signal.reason}</p>
                            <div className="flex flex-wrap gap-2 text-[10px]">
                              {['Momentum', 'Trend', 'Risk'].map((item) => (
                                <span key={`${signal.symbol}-${item}`} className="px-2 py-0.5 rounded-full bg-secondary border border-border">
                                  {item}
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {viewMode === 'pro' && (
              <div className="surface-card px-4 py-3 overflow-hidden hidden lg:block">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">{t('trading_live_news')}</div>
                <div className="marquee">
                  <div className="marquee-track">
                    {news.length ? [...news, ...news].map((item, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <span className="text-xs font-semibold">{item.headline}</span>
                        <span className="text-[10px] text-muted-foreground">{item.summary}</span>
                        <span className="text-xs text-primary">•</span>
                      </div>
                    )) : (
                      <div className="text-xs text-muted-foreground">{t('trading_loading_news')}</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

const TradingViewWidget = ({ symbol, containerId }: { symbol: string; containerId: string }) => {
  const { theme } = useTheme();

  useEffect(() => {
    const scriptId = 'tradingview-widget';
    const existing = document.getElementById(scriptId);
    if (!existing) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      document.head.appendChild(script);
    }

    const interval = setInterval(() => {
      if ((window as any).TradingView) {
        const container = document.getElementById(containerId);
        if (container) {
          container.innerHTML = '';
        }
        const isDark = theme === 'dark';
        new (window as any).TradingView.widget({
          autosize: true,
          symbol: symbol,
          interval: 'D',
          timezone: 'Etc/UTC',
          theme: isDark ? 'dark' : 'light',
          style: '1',
          locale: 'en',
          toolbar_bg: isDark ? '#0b0f1a' : '#f7f9fc',
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_side_toolbar: false,
          allow_symbol_change: false,
          studies: [
            "MAExp@tv-basicstudies",
            "MAExp@tv-basicstudies"
          ],
          container_id: containerId,
        });
        clearInterval(interval);
      }
    }, 300);

    return () => clearInterval(interval);
  }, [symbol, containerId, theme]);

  return (
    <div className="w-full h-full" id={containerId} />
  );
};

export default Trading;

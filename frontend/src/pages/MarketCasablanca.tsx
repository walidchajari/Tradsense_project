import React, { useEffect, useMemo, useState } from 'react';
import { AdvancedRealTimeChart } from 'react-ts-tradingview-widgets';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Home, LineChart, Lock, Sparkles, Timer } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { getBvcTradingViewSymbol } from '@/lib/bvc-symbols';

type BvcStock = {
    ticker: string;
    label?: string;
    closing_price?: number | string | null;
    opening_price?: number | string | null;
    high_price?: number | string | null;
    low_price?: number | string | null;
    variation?: number | string | null;
};

const MarketCasablanca = () => {
    const [stocks, setStocks] = useState<BvcStock[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedStock, setSelectedStock] = useState<BvcStock | null>(null);
    const [tvPrefix, setTvPrefix] = useState<'BVC' | 'CSE'>('BVC');
    const [primaryView, setPrimaryView] = useState<'indices' | 'marches'>('marches');
    const [categoryTab, setCategoryTab] = useState<'overview' | 'actions' | 'droits' | 'obligations' | 'fonds'>('overview');
    const getClosingPrice = (stock: BvcStock) =>
        stock.closing_price ?? stock.opening_price ?? stock.high_price ?? stock.low_price ?? '-';

    const coerceNumber = (value: number | string | null | undefined) => {
        if (value === null || value === undefined) return undefined;
        if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
        const cleaned = value.replace(/\s/g, '').replace(',', '.');
        const num = Number(cleaned);
        return Number.isFinite(num) ? num : undefined;
    };

    const formatNumber = (value: number | undefined, options?: Intl.NumberFormatOptions) => {
        if (value === undefined) return '—';
        return new Intl.NumberFormat('fr-FR', options).format(value);
    };

    const formatChange = (value: number | undefined) => {
        if (value === undefined) return '—';
        const sign = value > 0 ? '+' : '';
        return `${sign}${value.toFixed(2)}%`;
    };

    const dateLabel = useMemo(() => {
        const formatter = new Intl.DateTimeFormat('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
        return formatter.format(new Date());
    }, []);

    const stats = useMemo(() => {
        const numeric = stocks
            .map((stock) => ({
                ...stock,
                variationNum: coerceNumber(stock.variation),
                highNum: coerceNumber(stock.high_price),
                lowNum: coerceNumber(stock.low_price),
                closeNum: coerceNumber(stock.closing_price),
                openNum: coerceNumber(stock.opening_price),
            }))
            .filter((stock) => stock.variationNum !== undefined || stock.highNum !== undefined);

        const total = stocks.length;
        const avgChange =
            numeric.length > 0
                ? numeric.reduce((acc, stock) => acc + (stock.variationNum ?? 0), 0) / numeric.length
                : undefined;

        const avgRange =
            numeric.length > 0
                ? numeric.reduce((acc, stock) => {
                      const range = (stock.highNum ?? 0) - (stock.lowNum ?? 0);
                      return acc + (Number.isFinite(range) ? range : 0);
                  }, 0) / numeric.length
                : undefined;

        const topGainer = numeric.reduce((best, stock) => {
            if (stock.variationNum === undefined) return best;
            if (!best || (best.variationNum ?? -Infinity) < stock.variationNum) return stock;
            return best;
        }, undefined as typeof numeric[number] | undefined);

        const topLoser = numeric.reduce((best, stock) => {
            if (stock.variationNum === undefined) return best;
            if (!best || (best.variationNum ?? Infinity) > stock.variationNum) return stock;
            return best;
        }, undefined as typeof numeric[number] | undefined);

        const avgPrice =
            numeric.length > 0
                ? numeric.reduce((acc, stock) => acc + (stock.closeNum ?? stock.openNum ?? 0), 0) / numeric.length
                : undefined;

        return { total, avgChange, avgRange, topGainer, topLoser, avgPrice };
    }, [stocks]);

    const indicesCards = useMemo(() => {
        const base = stats.avgPrice ? stats.avgPrice * 100 : 10000;
        const change = stats.avgChange ?? 0;
        return [
            { name: 'MASI Composite', value: base, change: change },
            { name: 'MADEX Mid-Cap', value: base * 0.92, change: change * 0.8 },
            { name: 'CFG25 Liquide', value: base * 1.06, change: change * 1.1 },
        ];
    }, [stats.avgPrice, stats.avgChange]);

    const summaryCards = [
        {
            title: 'Valeurs suivies',
            value: stats.total !== undefined ? formatNumber(stats.total) : '—',
            footnote: 'Couverture temps reel',
        },
        {
            title: 'Variation moyenne',
            value: formatChange(stats.avgChange),
            footnote: 'Depuis ouverture',
        },
        {
            title: 'Top hausse',
            value: stats.topGainer?.label || stats.topGainer?.ticker || '—',
            footnote: formatChange(stats.topGainer?.variationNum),
        },
        {
            title: 'Fourchette moyenne',
            value: stats.avgRange ? formatNumber(stats.avgRange, { maximumFractionDigits: 2 }) : '—',
            footnote: 'High - low',
        },
    ];

    useEffect(() => {
        let isMounted = true;
        let intervalId: number | null = null;

        const applyData = (data: any) => {
            if (!isMounted) return;
            const items = Array.isArray(data?.items) ? data.items : data?.data;
            if (!Array.isArray(items)) return;
            setStocks(items);
            setSelectedStock((prev) => prev || items[0]);
        };

        const fetchStocks = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/casablanca/companies?limit=500&minimal=false`);
                const data = await response.json();
                applyData(data);
            } catch (error) {
                console.error('Error fetching stocks:', error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchStocks();
        intervalId = window.setInterval(fetchStocks, 5000);

        return () => {
            isMounted = false;
            if (intervalId) window.clearInterval(intervalId);
        };
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="relative overflow-hidden">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_55%)]" />
                <div className="pointer-events-none absolute inset-0 grain-overlay opacity-40" />
                <div className="container mx-auto px-4 pb-16 pt-8 sm:px-6 lg:px-8">
                    <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between reveal-up">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-[0_12px_30px_rgba(56,189,248,0.2)]">
                                <LineChart className="h-6 w-6" />
                            </div>
                            <div>
                                <div className="section-title">Bourse locale</div>
                                <h1 className="text-2xl font-bold sm:text-3xl">Bourse de Casablanca</h1>
                                <p className="text-sm text-muted-foreground">Marches marocains en temps reel, insights et snapshots.</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="glass-card flex flex-wrap items-center gap-4 px-4 py-3 text-xs text-muted-foreground">
                                <div className="flex items-center gap-2 text-foreground">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                                        <Lock className="h-4 w-4" />
                                    </span>
                                    <div>
                                        <div className="text-sm font-semibold text-foreground">Seance fermee</div>
                                        <div className="text-[11px]">{dateLabel}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Timer className="h-4 w-4 text-primary" />
                                    Differe 15 minutes
                                </div>
                            </div>
                            <Link
                                to="/"
                                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-primary/60 hover:text-primary"
                            >
                                <Home className="h-4 w-4" />
                                Accueil
                            </Link>
                        </div>
                    </header>

                    <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                        <div className="glass-card-elevated relative overflow-hidden p-6 sm:p-8 reveal-up" style={{ animationDelay: '80ms' }}>
                            <div className="pointer-events-none absolute right-6 top-6 flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] text-primary">
                                <Sparkles className="h-3 w-3" />
                                Live hub
                            </div>
                            <div className="section-title">Apercu marche</div>
                            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Suivez les valeurs locales en un coup d'oeil.</h2>
                            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
                                Snapshots instantanes, variations et selection dynamique pour naviguer entre indices et marches.
                            </p>
                            <div className="mt-6 flex flex-wrap gap-3">
                                <Link
                                    to="/dashboard/trading"
                                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-[0_16px_40px_rgba(56,189,248,0.35)] transition hover:-translate-y-0.5"
                                >
                                    Explorer les marches
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => setPrimaryView('indices')}
                                    className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-5 py-2 text-sm font-semibold text-foreground transition hover:-translate-y-0.5 hover:border-primary/60"
                                >
                                    Voir les indices
                                </button>
                            </div>
                            <div className="mt-6 grid gap-3 sm:grid-cols-3">
                                {summaryCards.slice(0, 3).map((card) => (
                                    <div key={card.title} className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3 shadow-sm">
                                        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{card.title}</div>
                                        <div className="mt-2 text-lg font-semibold">{card.value}</div>
                                        <div className="text-xs text-muted-foreground">{card.footnote}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="glass-card p-5 sm:p-6 reveal-up" style={{ animationDelay: '140ms' }}>
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="section-title">Spotlight</div>
                                    <h3 className="text-xl font-semibold">
                                        {selectedStock?.label || selectedStock?.ticker || 'Selectionnez une valeur'}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">Variation temps reel, chart pro</p>
                                </div>
                                <div className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                                    {selectedStock?.variation ? formatChange(coerceNumber(selectedStock.variation)) : '—'}
                                </div>
                            </div>
                            <div className="mt-4 min-h-[280px] rounded-2xl border border-border/60 bg-card/60 p-3">
                                {selectedStock && (
                                    <AdvancedRealTimeChart
                                        theme="dark"
                                        autosize
                                        symbol={getBvcTradingViewSymbol(selectedStock.ticker, tvPrefix)}
                                    />
                                )}
                            </div>
                            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span>TV Prefix</span>
                                {(['BVC', 'CSE'] as const).map((prefix) => (
                                    <button
                                        key={prefix}
                                        onClick={() => setTvPrefix(prefix)}
                                        className={`rounded-full border px-3 py-1 transition ${
                                            tvPrefix === prefix
                                                ? 'border-primary bg-primary/15 text-primary'
                                                : 'border-border text-muted-foreground hover:border-primary/40'
                                        }`}
                                    >
                                        {prefix}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 reveal-up" style={{ animationDelay: '200ms' }}>
                        {summaryCards.map((card) => (
                            <div key={card.title} className="surface-card px-4 py-4">
                                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{card.title}</div>
                                <div className="mt-2 text-lg font-semibold">{card.value}</div>
                                <div className="text-xs text-muted-foreground">{card.footnote}</div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-10 flex flex-col gap-5">
                        <div className="flex flex-wrap items-center justify-between gap-3 reveal-up" style={{ animationDelay: '240ms' }}>
                            <div className="inline-flex rounded-full border border-border/70 bg-card p-1">
                                {(['indices', 'marches'] as const).map((view) => (
                                    <button
                                        key={view}
                                        type="button"
                                        onClick={() => setPrimaryView(view)}
                                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                            primaryView === view
                                                ? 'bg-primary text-primary-foreground shadow-[0_10px_30px_rgba(56,189,248,0.3)]'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        {view === 'indices' ? 'Indices' : 'Marches'}
                                    </button>
                                ))}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Donnees differees de 15 minutes • Mise a jour automatique
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-4 border-b border-border/60 pb-3 reveal-up" style={{ animationDelay: '280ms' }}>
                            {([
                                { key: 'overview', label: 'Overview' },
                                { key: 'actions', label: 'Actions' },
                                { key: 'droits', label: 'Droits' },
                                { key: 'obligations', label: 'Obligations' },
                                { key: 'fonds', label: 'Fonds' },
                            ] as const).map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setCategoryTab(tab.key)}
                                    className={`relative text-sm font-semibold transition after:absolute after:-bottom-3 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:rounded-full after:bg-primary after:transition ${
                                        categoryTab === tab.key
                                            ? 'text-foreground after:scale-x-100'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {primaryView === 'indices' ? (
                        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 reveal-up" style={{ animationDelay: '320ms' }}>
                            {indicesCards.map((card) => (
                                <div key={card.name} className="surface-elevated px-5 py-5">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>{card.name}</span>
                                        <span
                                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] ${
                                                card.change >= 0 ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                                            }`}
                                        >
                                            {card.change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                            {formatChange(card.change)}
                                        </span>
                                    </div>
                                    <div className="mt-4 text-2xl font-semibold">{formatNumber(card.value, { maximumFractionDigits: 0 })}</div>
                                    <div className="mt-2 text-xs text-muted-foreground">Indice synthetique base sur les valeurs listees.</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-8 surface-card overflow-hidden reveal-up" style={{ animationDelay: '320ms' }}>
                            <div className="flex items-center justify-between px-5 py-4">
                                <div>
                                    <div className="text-sm font-semibold">Marches {categoryTab === 'overview' ? 'globaux' : categoryTab}</div>
                                    <div className="text-xs text-muted-foreground">Cliquez sur une valeur pour actualiser le chart</div>
                                </div>
                                <div className="text-xs text-muted-foreground">Total: {formatNumber(stocks.length)}</div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
                                            <th className="py-3 px-4 text-left">Ticker</th>
                                            <th className="py-3 px-4 text-left">Nom</th>
                                            <th className="py-3 px-4 text-left">Dernier</th>
                                            <th className="py-3 px-4 text-left">Ouverture</th>
                                            <th className="py-3 px-4 text-left">Plus haut</th>
                                            <th className="py-3 px-4 text-left">Plus bas</th>
                                            <th className="py-3 px-4 text-left">Variation</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stocks.map((stock, index) => {
                                            const change = coerceNumber(stock.variation);
                                            const hasChange = change !== undefined;
                                            return (
                                                <tr
                                                    key={index}
                                                    onClick={() => setSelectedStock(stock)}
                                                    className="cursor-pointer border-t border-border/60 transition-colors hover:bg-secondary/40"
                                                >
                                                    <td className="py-3 px-4 font-medium">{stock.ticker}</td>
                                                    <td className="py-3 px-4 text-muted-foreground">{stock.label}</td>
                                                    <td className="py-3 px-4 trading-number">{getClosingPrice(stock)}</td>
                                                    <td className="py-3 px-4">{stock.opening_price}</td>
                                                    <td className="py-3 px-4">{stock.high_price}</td>
                                                    <td className="py-3 px-4">{stock.low_price}</td>
                                                    <td className={`py-3 px-4 font-semibold ${hasChange && change >= 0 ? 'text-success' : 'text-destructive'}`}>
                                                        {hasChange ? formatChange(change) : '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {!stocks.length && (
                                <div className="px-5 py-6 text-sm text-muted-foreground">
                                    Donnees indisponibles pour le moment. Revenez dans quelques instants.
                                </div>
                            )}
                        </div>
                    )}

                    <div className="mt-8 flex items-center justify-between text-xs text-muted-foreground">
                        <div>Source: Casablanca Exchange • Flux public</div>
                        {stats.topLoser && (
                            <div className="flex items-center gap-2">
                                <span>Top baisse</span>
                                <span className="rounded-full bg-destructive/15 px-2 py-1 text-destructive">
                                    {stats.topLoser.label || stats.topLoser.ticker} {formatChange(stats.topLoser.variationNum)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MarketCasablanca;

import React, { useEffect, useState } from 'react';
import { AdvancedRealTimeChart } from 'react-ts-tradingview-widgets';
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
    const getClosingPrice = (stock: BvcStock) =>
        stock.closing_price ?? stock.opening_price ?? stock.high_price ?? stock.low_price ?? '-';

    useEffect(() => {
        let isMounted = true;
        let intervalId: number | null = null;
        let eventSource: EventSource | null = null;

        const applyData = (data: any) => {
            if (!isMounted) return;
            if (data.status === 'success') {
                setStocks(data.data);
                setSelectedStock((prev) => prev || data.data[0]);
            }
        };

        const fetchStocks = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/bvc/overview`);
                const data = await response.json();
                applyData(data);
            } catch (error) {
                console.error('Error fetching stocks:', error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        const startPolling = () => {
            fetchStocks();
            intervalId = window.setInterval(fetchStocks, 5000);
        };

        try {
            eventSource = new EventSource(`${API_BASE_URL}/bvc/stream`);
            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    applyData(data);
                    if (isMounted) setLoading(false);
                } catch (err) {
                    console.error('Error parsing stream data:', err);
                }
            };
            eventSource.onerror = () => {
                if (eventSource) eventSource.close();
                eventSource = null;
                if (!intervalId) startPolling();
            };
        } catch (err) {
            startPolling();
        }

        return () => {
            isMounted = false;
            if (eventSource) eventSource.close();
            if (intervalId) window.clearInterval(intervalId);
        };
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Casablanca Stock Exchange</h1>
            <div className="surface-card overflow-x-auto">
                <table className="min-w-full">
                    <thead>
                        <tr className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
                            <th className="py-3 px-4 text-left">Ticker</th>
                            <th className="py-3 px-4 text-left">Name</th>
                            <th className="py-3 px-4 text-left">Closing Price</th>
                            <th className="py-3 px-4 text-left">Opening Price</th>
                            <th className="py-3 px-4 text-left">High Price</th>
                            <th className="py-3 px-4 text-left">Low Price</th>
                            <th className="py-3 px-4 text-left">Variation</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stocks.map((stock, index) => (
                            <tr
                                key={index}
                                onClick={() => setSelectedStock(stock)}
                                className="cursor-pointer border-t border-border/60 hover:bg-secondary/40 transition-colors"
                            >
                                <td className="py-3 px-4 font-medium">{stock.ticker}</td>
                                <td className="py-3 px-4 text-muted-foreground">{stock.label}</td>
                                <td className="py-3 px-4 trading-number">{getClosingPrice(stock)}</td>
                                <td className="py-3 px-4">{stock.opening_price}</td>
                                <td className="py-3 px-4">{stock.high_price}</td>
                                <td className="py-3 px-4">{stock.low_price}</td>
                                <td className="py-3 px-4">{stock.variation}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selectedStock && (
                <div className="mt-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <h2 className="text-xl font-bold">{selectedStock.label} ({selectedStock.ticker})</h2>
                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">TV Prefix</span>
                            {(['BVC', 'CSE'] as const).map((prefix) => (
                                <button
                                    key={prefix}
                                    onClick={() => setTvPrefix(prefix)}
                                    className={`px-3 py-1 rounded-full border ${
                                        tvPrefix === prefix
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border text-muted-foreground'
                                    }`}
                                >
                                    {prefix}
                                </button>
                            ))}
                        </div>
                    </div>
                    <AdvancedRealTimeChart
                        theme="light"
                        symbol={getBvcTradingViewSymbol(selectedStock.ticker, tvPrefix)}
                    />
                </div>
            )}
        </div>
    );
};

export default MarketCasablanca;

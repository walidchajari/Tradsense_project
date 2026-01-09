import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Medal, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { API_BASE_URL } from '@/lib/api';
import { cn } from '@/lib/utils';

type LeaderboardRow = {
  user_name: string;
  profit_pct: number;
  status: string;
  trades: number;
};

interface LeaderboardContentProps {
  inDashboard?: boolean;
  showCta?: boolean;
}

const LeaderboardContent = ({ inDashboard = false, showCta = true }: LeaderboardContentProps) => {
  const [timeframe, setTimeframe] = useState('month');
  const [traders, setTraders] = useState<LeaderboardRow[]>([]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/leaderboard`);
        const data = await res.json();
        setTraders(data || []);
      } catch (error) {
        setTraders([]);
      }
    };
    fetchLeaderboard();
  }, []);

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'from-yellow-400 to-yellow-600';
    if (rank === 2) return 'from-gray-300 to-gray-500';
    if (rank === 3) return 'from-amber-600 to-amber-800';
    return 'from-primary/50 to-primary';
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>;
  };

  return (
    <div className={cn(inDashboard ? 'pb-8' : 'pt-24 pb-16')}>
      <div className={cn('container mx-auto px-4', inDashboard && 'max-w-6xl')}>
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Top Performers</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">
            <span className="gradient-text">Leaderboard</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            See how our top traders are performing. Compete with the best and climb the ranks.
          </p>
        </div>

        <div className="flex justify-center gap-2 mb-8">
          {['week', 'month', 'all-time'].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                timeframe === tf
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-secondary/80 text-muted-foreground'
              }`}
            >
              {tf === 'all-time' ? 'All Time' : tf.charAt(0).toUpperCase() + tf.slice(1)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 mb-8 mx-auto max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {traders.slice(0, 3).map((trader, idx) => (
                <div
                  key={`${trader.user_name}-${idx}`}
                  className={`surface-card p-6 text-center relative overflow-hidden ${
                    idx === 0 ? 'md:-mt-4 md:scale-105' : ''
                  }`}
                >
                <div
                  className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${getRankColor(idx + 1)}`}
                  style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}
                >
                  <span className="absolute top-2 right-2 text-white font-bold">#{idx + 1}</span>
                </div>

                <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${getRankColor(idx + 1)} mx-auto mb-4 flex items-center justify-center`}>
                  <span className="text-2xl font-bold text-white">
                    {trader.user_name.split(' ').map((n) => n[0]).join('')}
                  </span>
                </div>

                <h3 className="text-lg font-semibold mb-1">{trader.user_name}</h3>
                <p className="text-sm text-muted-foreground mb-3">🇲🇦</p>
                <div className="text-2xl font-bold text-success trading-number mb-2">
                  {trader.profit_pct >= 0 ? '+' : ''}{trader.profit_pct}%
                </div>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                    trader.status === 'funded' ? 'bg-success/20 text-success' : 'bg-primary/20 text-primary'
                  }`}
                >
                  {trader.status}
                </span>
              </div>
            ))}
          </div>

          <div className="surface-card p-6 flex flex-col justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Rising Trader</div>
              <h3 className="text-xl font-semibold">{traders[0]?.user_name || '—'}</h3>
              <p className="text-sm text-muted-foreground mb-4">Strong momentum this month</p>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-success" />
                <span className="text-2xl font-bold text-success trading-number">
                  {traders[0]?.profit_pct != null ? `${traders[0].profit_pct > 0 ? '+' : ''}${traders[0].profit_pct}%` : '—'}
                </span>
              </div>
            </div>
            <div className="mt-6 text-xs text-muted-foreground">
              Trades: {traders[0]?.trades ?? 0}
            </div>
          </div>
        </div>

        <div className="surface-card overflow-hidden mx-auto max-w-4xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Rank</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Trader</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Country</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Profit</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Trades</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {traders.map((trader, index) => (
                  <tr
                    key={`${trader.user_name}-${index}`}
                    className={`border-t border-border hover:bg-secondary/30 transition-colors ${
                      index < 3 ? 'bg-gradient-to-r from-primary/5 to-transparent' : ''
                    }`}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary">
                        {getRankIcon(index + 1)}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center">
                          <span className="text-sm font-bold text-white">
                            {trader.user_name.split(' ').map((n) => n[0]).join('')}
                          </span>
                        </div>
                        <span className="font-medium">{trader.user_name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-lg">🇲🇦</td>
                    <td className="py-4 px-6">
                      <span className="text-success font-semibold trading-number">
                        {trader.profit_pct >= 0 ? '+' : ''}{trader.profit_pct}%
                      </span>
                    </td>
                    <td className="py-4 px-6 text-muted-foreground">{trader.trades}</td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          trader.status === 'funded' ? 'bg-success/20 text-success' : 'bg-primary/20 text-primary'
                        }`}
                      >
                        {trader.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showCta && (
          <div className="text-center mt-12">
            <Button variant="hero" size="lg" asChild>
              <Link to="/register">
                Join the Competition
                <TrendingUp className="w-5 h-5" />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaderboardContent;

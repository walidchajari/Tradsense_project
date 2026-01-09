import { useMemo, useState } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CreditCard,
  ArrowUpRight,
  Download,
  CheckCircle,
  Clock,
  XCircle,
  Crown,
  Zap,
  Star,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePortfolio, useMarketOverview, executeTrade, requestWithdrawal, useChallenges, useUserChallenges, usePaymentHistory } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCurrentUserId } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';

const planMeta: Record<string, { icon: typeof Star; features: string[]; color: string; popular?: boolean }> = {
  starter: {
    icon: Star,
    features: ['Basic analytics', 'Community access', 'Email support'],
    color: 'from-slate-500 to-slate-600',
  },
  pro: {
    icon: Zap,
    features: ['AI signals', 'Advanced analytics', 'Priority support'],
    color: 'from-primary to-blue-400',
    popular: true,
  },
  elite: {
    icon: Crown,
    features: ['All Pro features', '1-on-1 coaching', 'VIP community'],
    color: 'from-emerald-400 to-teal-500',
  },
};

const Wallet = () => {
  const { t } = useLanguage();
  const [closingPosition, setClosingPosition] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const userId = getCurrentUserId();
  const { portfolio } = usePortfolio(userId);
  const { assets } = useMarketOverview();
  const { challenges } = useChallenges();
  const { userChallenges } = useUserChallenges(userId);
  const { payments } = usePaymentHistory(userId);

  const priceMap = useMemo(() => {
    return assets.reduce<Record<string, number>>((acc, asset) => {
      if (asset.price) {
        acc[asset.symbol] = asset.price;
      }
      return acc;
    }, {});
  }, [assets]);

  const marketMap = useMemo(() => {
    return assets.reduce<Record<string, string>>((acc, asset) => {
      acc[asset.symbol] = asset.market;
      return acc;
    }, {});
  }, [assets]);

  const positionsWithPnL = (portfolio?.positions || []).map((pos: any) => {
    const current = priceMap[pos.asset] || 0;
    const pnl = current ? (current - pos.avg_entry_price) * pos.quantity : 0;
    const pnlPct = pos.avg_entry_price ? (pnl / (pos.avg_entry_price * pos.quantity)) * 100 : 0;
    const marketValue = current ? current * pos.quantity : 0;
    return { ...pos, current, pnl, pnlPct, marketValue };
  });

  const totalPositionValue = positionsWithPnL.reduce((sum: number, pos: any) => sum + (pos.marketValue || 0), 0);

  const currentChallenge = userChallenges[0];
  const currentPlanName = currentChallenge?.challenge_name || (portfolio?.account?.challenge_type || '').toString();
  const currentPlanStatus = currentChallenge?.status || portfolio?.account?.status || 'active';
  const currentPlanStartDate = currentChallenge?.created_at || portfolio?.account?.created_at || null;

  const account = portfolio?.account;
  const hasAccount = Boolean(account);
  const profit = hasAccount
    ? (account?.profit ?? (account?.equity ?? 0) - (account?.initial_balance ?? 0))
    : null;
  const minProfit = account?.withdraw_min_profit ?? 1000;
  const withdrawAllowed = Boolean(account?.withdraw_allowed);

  const handleUpgrade = (planName: string) => {
    const key = planName.toLowerCase();
    navigate(`/checkout?plan=${encodeURIComponent(key)}`);
  };

  const handleClosePosition = async (asset: string, quantity: number, currentPrice: number) => {
    if (!portfolio?.account?.id) {
      toast({ title: 'Error', description: 'No account found', variant: 'destructive' });
      return;
    }
    if (!currentPrice) {
      toast({ title: 'Error', description: 'Waiting for market price...', variant: 'destructive' });
      return;
    }
    setClosingPosition(asset);
    const side = quantity > 0 ? 'sell' : 'buy';
    const result = await executeTrade({
      account_id: portfolio.account.id,
      asset,
      side,
      quantity: Math.abs(quantity),
      price: currentPrice,
      market: marketMap[asset],
    });
    setClosingPosition(null);
    if (result.error) {
      toast({ title: 'Close Failed', description: result.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Position Closed', description: `${asset} ${side.toUpperCase()} filled` });
  };

  const handleWithdraw = async () => {
    if (!account?.id) {
      toast({ title: 'Error', description: 'No account found', variant: 'destructive' });
      return;
    }
    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: 'Error', description: 'Enter a valid amount', variant: 'destructive' });
      return;
    }
    setWithdrawing(true);
    try {
      await requestWithdrawal({ account_id: account.id, amount });
      toast({ title: t('wallet_withdraw_requested'), description: t('wallet_withdraw_requested_desc') });
      setWithdrawAmount('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Withdrawal failed';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setWithdrawing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-warning" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success/20 text-success';
      case 'pending':
        return 'bg-warning/20 text-warning';
      case 'failed':
        return 'bg-destructive/20 text-destructive';
      default:
        return 'bg-secondary text-muted-foreground';
    }
  };

  const plans = useMemo(() => {
    return challenges.map((challenge: any) => {
      const key = String(challenge.name || '').toLowerCase();
      const meta = planMeta[key] || planMeta.pro;
      return {
        id: challenge.id,
        name: challenge.name,
        price: `${challenge.price_dh} DH`,
        account: `$${Number(challenge.initial_balance || 0).toLocaleString()}`,
        icon: meta.icon,
        features: meta.features,
        color: meta.color,
        popular: meta.popular,
      };
    });
  }, [challenges]);

  const formatDate = (value: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">{t('wallet_title')}</h1>
          <p className="text-muted-foreground">{t('wallet_subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="surface-card p-6">
            <div className="text-sm text-muted-foreground mb-1">{t('wallet_balance')}</div>
            <div className="text-2xl font-bold trading-number">${portfolio?.account?.balance?.toLocaleString() || '—'}</div>
          </div>
          <div className="surface-card p-6">
            <div className="text-sm text-muted-foreground mb-1">{t('wallet_equity')}</div>
            <div className="text-2xl font-bold trading-number">${portfolio?.account?.equity?.toLocaleString() || '—'}</div>
          </div>
          <div className="surface-card p-6">
            <div className="text-sm text-muted-foreground mb-1">{t('wallet_open_positions')}</div>
            <div className="text-2xl font-bold trading-number">{positionsWithPnL.length}</div>
          </div>
        </div>

        <div className="surface-card">
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-semibold">{t('wallet_open_positions')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="text-left py-3 px-6 text-xs font-medium text-muted-foreground">{t('wallet_asset')}</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-muted-foreground">{t('wallet_qty')}</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-muted-foreground">{t('wallet_avg_entry')}</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-muted-foreground">{t('wallet_last')}</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-muted-foreground">{t('wallet_pnl')}</th>
                  <th className="text-right py-3 px-6 text-xs font-medium text-muted-foreground">{t('wallet_action')}</th>
                </tr>
              </thead>
              <tbody>
                {positionsWithPnL.length ? positionsWithPnL.map((pos: any, index: number) => (
                  <tr key={`${pos.asset}-${index}`} className="border-t border-border">
                    <td className="py-3 px-6 font-medium">{pos.asset}</td>
                    <td className="py-3 px-6 text-muted-foreground">{pos.quantity}</td>
                    <td className="py-3 px-6 text-muted-foreground">{pos.avg_entry_price?.toLocaleString() || '—'}</td>
                    <td className="py-3 px-6 text-muted-foreground">{pos.current?.toLocaleString() || '—'}</td>
                    <td className={`py-3 px-6 font-semibold ${pos.pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toLocaleString()} ({pos.pnlPct.toFixed(2)}%)
                    </td>
                    <td className="py-3 px-6 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={closingPosition === pos.asset}
                        onClick={() => handleClosePosition(pos.asset, pos.quantity, pos.current)}
                      >
                        {closingPosition === pos.asset ? t('wallet_closing') : t('wallet_close')}
                      </Button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="py-6 px-6 text-sm text-muted-foreground">{t('wallet_no_positions')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="surface-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t('wallet_allocation')}</h2>
            <div className="text-xs text-muted-foreground">
              {t('wallet_total')} {totalPositionValue ? totalPositionValue.toLocaleString() : '—'}
            </div>
          </div>
          <div className="space-y-3">
            {positionsWithPnL.length ? positionsWithPnL.map((pos: any, index: number) => {
              const pct = totalPositionValue ? (pos.marketValue / totalPositionValue) * 100 : 0;
              return (
                <div key={`${pos.asset}-alloc-${index}`} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{pos.asset}</span>
                    <span className="text-muted-foreground">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            }) : (
              <div className="text-sm text-muted-foreground">{t('wallet_allocation_empty')}</div>
            )}
          </div>
        </div>

        <div className="surface-card p-6">
          <h2 className="text-lg font-semibold">{t('wallet_withdraw_title')}</h2>
          <p className="text-sm text-muted-foreground">{t('wallet_withdraw_subtitle')}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-secondary/40 p-4">
              <div className="text-xs text-muted-foreground">{t('wallet_withdraw_available')}</div>
              <div className="text-xl font-semibold trading-number">
                {profit != null ? profit.toLocaleString() : '—'}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-secondary/40 p-4">
              <div className="text-xs text-muted-foreground">{t('wallet_withdraw_min_profit')}</div>
              <div className="text-xl font-semibold trading-number">
                {minProfit.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-secondary/40 p-4">
              <div className="text-xs text-muted-foreground">{t('wallet_withdraw_status')}</div>
              <div className={`text-sm font-semibold ${withdrawAllowed ? 'text-success' : 'text-muted-foreground'}`}>
                {withdrawAllowed ? t('wallet_withdraw_status_ready') : t('wallet_withdraw_status_locked')}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <div className="text-xs text-muted-foreground mb-1">{t('wallet_withdraw_amount')}</div>
              <Input
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0"
                inputMode="decimal"
                className="bg-secondary border-border"
              />
            </div>
            <Button
              variant="hero"
              disabled={!withdrawAllowed || withdrawing}
              onClick={handleWithdraw}
            >
              {withdrawing ? t('wallet_withdraw_processing') : t('wallet_withdraw_request')}
            </Button>
          </div>
          {!withdrawAllowed && (
            <div className="text-xs text-muted-foreground mt-3">
              {t('wallet_withdraw_not_eligible')} {minProfit.toLocaleString()}
            </div>
          )}
        </div>

        <div className="surface-card">
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-semibold">{t('wallet_trade_history')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="text-left py-3 px-6 text-xs font-medium text-muted-foreground">{t('wallet_asset')}</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-muted-foreground">{t('wallet_side')}</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-muted-foreground">{t('wallet_price')}</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-muted-foreground">{t('wallet_qty')}</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-muted-foreground">{t('wallet_pnl')}</th>
                </tr>
              </thead>
              <tbody>
                {(portfolio?.trades || []).length ? (portfolio?.trades || []).map((trade: any, index: number) => (
                  <tr key={`${trade.asset}-${index}`} className="border-t border-border">
                    <td className="py-3 px-6 font-medium">{trade.asset}</td>
                    <td className="py-3 px-6 text-muted-foreground">{trade.type.toUpperCase()}</td>
                    <td className="py-3 px-6 text-muted-foreground">{trade.entry_price?.toLocaleString() || '—'}</td>
                    <td className="py-3 px-6 text-muted-foreground">{trade.quantity}</td>
                    <td className={`py-3 px-6 font-semibold ${trade.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {trade.profit >= 0 ? '+' : ''}{trade.profit?.toLocaleString() || 0}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="py-6 px-6 text-sm text-muted-foreground">{t('wallet_trade_empty')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Current Plan */}
        <div className="surface-card p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">
                    {currentPlanName ? `${currentPlanName} ${t('wallet_challenge')}` : t('wallet_challenge')}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-success/20 text-success text-xs font-medium">
                    {currentPlanStatus}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('wallet_started')} {formatDate(currentPlanStartDate)} • — {t('wallet_days_remaining')}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => handleUpgrade('elite')}>
                <ArrowUpRight className="w-4 h-4 mr-2" />
                {t('wallet_upgrade_plan')}
              </Button>
            </div>
          </div>
        </div>

        {/* Available Plans */}
        <div>
          <h2 className="text-lg font-semibold mb-4">{t('wallet_available_plans')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`surface-card p-6 relative overflow-hidden ${
                  plan.popular ? 'ring-2 ring-primary' : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
                    {t('wallet_popular')}
                  </div>
                )}
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-4`}>
                  <plan.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                <div className="text-2xl font-bold gradient-text mb-1">{plan.price}</div>
                <p className="text-sm text-muted-foreground mb-4">{plan.account} {t('wallet_account')}</p>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-success" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.popular ? 'hero' : 'outline'}
                  className="w-full"
                  onClick={() => handleUpgrade(plan.name)}
                >
                  {currentPlanName && currentPlanName.toLowerCase() === plan.name.toLowerCase()
                    ? t('wallet_current_plan_label')
                    : t('wallet_select_plan')}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Payment History */}
        <div className="surface-card">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('wallet_payment_history')}</h2>
            <Button variant="ghost" size="sm">
              <Download className="w-4 h-4 mr-2" />
              {t('wallet_export')}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">{t('wallet_transaction')}</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">{t('wallet_date')}</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">{t('wallet_method')}</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">{t('wallet_amount')}</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">{t('wallet_status')}</th>
                </tr>
              </thead>
              <tbody>
                {payments.length ? payments.map((payment: any) => (
                  <tr key={payment.id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                    <td className="py-4 px-6">
                      <div>
                        <div className="font-medium">{payment.description}</div>
                        <div className="text-xs text-muted-foreground">{payment.id}</div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-muted-foreground">{formatDate(payment.date)}</td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{payment.method || '—'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-medium trading-number">{payment.amount ? `${payment.amount} DH` : '—'}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                        {getStatusIcon(payment.status)}
                        {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="py-6 px-6 text-sm text-muted-foreground">{t('wallet_payment_empty')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Wallet;

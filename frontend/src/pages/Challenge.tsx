import { useMemo } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import {
  Target,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Info,
  ChevronRight,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAccountStats, useChallenges, useUserChallenges } from '@/lib/api';
import { getCurrentUserId } from '@/lib/auth';

const Challenge = () => {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'paid';
  const userId = getCurrentUserId();
  const { account } = useAccountStats(userId);
  const { challenges } = useChallenges();
  const { userChallenges } = useUserChallenges(userId);

  const challengeData = {
    demo: {
      type: t('challenge_demo_type'),
      badge: 'DEMO',
      badgeColor: 'bg-success/20 text-success',
      balance: 10000,
      equity: 10247.83,
      profitTarget: null,
      profitPercent: 2.48,
      dailyDrawdown: 1.2,
      dailyLimit: 5,
      totalDrawdown: 2.1,
      totalLimit: 10,
      daysRemaining: 5,
      totalDays: 7,
      status: 'ACTIVE',
      canBeFunded: false,
    },
    trial: {
      type: t('challenge_trial_type'),
      badge: 'TRIAL',
      badgeColor: 'bg-warning/20 text-warning',
      balance: 2000,
      equity: 2089.45,
      profitTarget: 8,
      profitPercent: 4.47,
      dailyDrawdown: 0.8,
      dailyLimit: 5,
      totalDrawdown: 1.5,
      totalLimit: 10,
      daysRemaining: 12,
      totalDays: 14,
      status: 'ACTIVE',
      canBeFunded: false,
    },
    paid: {
      type: t('challenge_paid_type'),
      badge: 'PRO',
      badgeColor: 'bg-primary/20 text-primary',
      balance: 10000,
      equity: 10778.90,
      profitTarget: 10,
      profitPercent: 7.79,
      dailyDrawdown: 2.1,
      dailyLimit: 5,
      totalDrawdown: 4.2,
      totalLimit: 10,
      daysRemaining: 21,
      totalDays: 30,
      status: 'ACTIVE',
      canBeFunded: true,
    },
  };

  const backendData = useMemo(() => {
    if (!account) return null;
    const challengeKey = (userChallenges[0]?.challenge_name || account.challenge_type || '').toString().toLowerCase();
    const challengeConfig = challenges.find((c: any) => c.name.toLowerCase() === challengeKey);
    const initialBalance = account.initial_balance ?? account.balance ?? 0;
    const equity = account.equity ?? 0;
    const profitPercent = initialBalance ? ((equity - initialBalance) / initialBalance) * 100 : 0;
    const dailyBase = account.daily_starting_equity ?? initialBalance;
    const dailyDrawdown = dailyBase ? Math.max(0, ((dailyBase - equity) / dailyBase) * 100) : 0;
    const totalDrawdown = initialBalance ? Math.max(0, ((initialBalance - equity) / initialBalance) * 100) : 0;
    const totalDays = 30;
    const createdAt = account.created_at ? new Date(account.created_at) : null;
    const daysElapsed = createdAt ? Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const daysRemaining = Math.max(totalDays - daysElapsed, 0);
    const rawStatus = (account.status || 'active').toLowerCase();
    const status = rawStatus === 'funded' ? 'PASSED' : rawStatus === 'failed' ? 'FAILED' : 'ACTIVE';
    const badge = challengeConfig?.name?.toUpperCase() || (challengeKey ? challengeKey.toUpperCase() : 'PRO');
    return {
      type: challengeConfig?.name || t('challenge_paid_type'),
      badge,
      badgeColor: 'bg-primary/20 text-primary',
      balance: initialBalance,
      equity,
      profitTarget: challengeConfig?.profit_target_pct ?? 10,
      profitPercent: Number(profitPercent.toFixed(2)),
      dailyDrawdown: Number(dailyDrawdown.toFixed(2)),
      dailyLimit: challengeConfig?.max_daily_loss_pct ?? 5,
      totalDrawdown: Number(totalDrawdown.toFixed(2)),
      totalLimit: challengeConfig?.max_total_loss_pct ?? 10,
      daysRemaining,
      totalDays,
      status,
      canBeFunded: account.status === 'funded',
    };
  }, [account, challenges, userChallenges, t]);

  const data = backendData || (challengeData[mode as keyof typeof challengeData] || challengeData.paid);

  const rules = [
    {
      icon: Target,
      title: t('challenge_rule_profit_target'),
      value: data.profitTarget ? `${data.profitTarget}%` : t('challenge_rule_none'),
      current: `${data.profitPercent}%`,
      progress: data.profitTarget ? (data.profitPercent / data.profitTarget) * 100 : 0,
      color: 'text-success',
      bgColor: 'bg-success',
      description: data.profitTarget ? t('challenge_rule_profit_desc') : t('challenge_rule_profit_demo'),
    },
    {
      icon: TrendingDown,
      title: t('challenge_rule_daily_drawdown'),
      value: `${data.dailyLimit}%`,
      current: `${data.dailyDrawdown}%`,
      progress: (data.dailyDrawdown / data.dailyLimit) * 100,
      color: 'text-warning',
      bgColor: 'bg-warning',
      description: t('challenge_rule_daily_desc'),
    },
    {
      icon: AlertTriangle,
      title: t('challenge_rule_total_drawdown'),
      value: `${data.totalLimit}%`,
      current: `${data.totalDrawdown}%`,
      progress: (data.totalDrawdown / data.totalLimit) * 100,
      color: 'text-destructive',
      bgColor: 'bg-destructive',
      description: t('challenge_rule_total_desc'),
    },
    {
      icon: Clock,
      title: t('challenge_rule_time_remaining'),
      value: `${data.totalDays} ${t('challenge_days')}`,
      current: `${data.daysRemaining} ${t('challenge_left')}`,
      progress: ((data.totalDays - data.daysRemaining) / data.totalDays) * 100,
      color: 'text-primary',
      bgColor: 'bg-primary',
      description: t('challenge_rule_time_desc'),
    },
  ];

  const tradingRules = [
    t('challenge_rule_news'),
    t('challenge_rule_risk'),
    t('challenge_rule_sl'),
    t('challenge_rule_weekend'),
    t('challenge_rule_days'),
    t('challenge_rule_bot'),
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">{t('challenge_title')}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${data.badgeColor}`}>
                {data.badge}
              </span>
            </div>
            <p className="text-muted-foreground">{data.type} • {t('challenge_subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-4 py-2 rounded-xl text-sm font-bold ${
              data.status === 'ACTIVE' ? 'bg-primary/20 text-primary' :
              data.status === 'PASSED' ? 'bg-success/20 text-success' :
              'bg-destructive/20 text-destructive'
            }`}>
              {data.status}
            </span>
            <Button variant="hero" asChild>
              <Link to="/dashboard/trading">{t('dashboard_start_trading')}</Link>
            </Button>
          </div>
        </div>

        {/* Demo/Trial Notice */}
        {!data.canBeFunded && (
          <div className="surface-card p-4 border-l-4 border-warning flex items-start gap-3">
            <Info className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">
                {mode === 'demo' ? t('challenge_demo_active') : t('challenge_trial_active')}
              </p>
              <p className="text-sm text-muted-foreground">
                {mode === 'demo' 
                  ? t('challenge_demo_desc')
                  : t('challenge_trial_desc')}
              </p>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <Link to="/checkout?plan=pro">
                  {t('challenge_upgrade')}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Account Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="surface-card p-6">
            <div className="text-sm text-muted-foreground mb-1">{t('challenge_starting_balance')}</div>
            <div className="text-2xl font-bold trading-number">${data.balance.toLocaleString()}</div>
          </div>
          <div className="surface-card p-6">
            <div className="text-sm text-muted-foreground mb-1">{t('challenge_current_equity')}</div>
            <div className="text-2xl font-bold trading-number">${data.equity.toLocaleString()}</div>
          </div>
          <div className="surface-card p-6">
            <div className="text-sm text-muted-foreground mb-1">{t('challenge_profit_loss')}</div>
            <div className={`text-2xl font-bold trading-number ${data.profitPercent >= 0 ? 'text-success' : 'text-destructive'}`}>
              {data.profitPercent >= 0 ? '+' : ''}{data.profitPercent}%
            </div>
          </div>
        </div>

        {/* Progress Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((rule, index) => (
            <div key={index} className="surface-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg ${rule.bgColor}/20 flex items-center justify-center`}>
                  <rule.icon className={`w-5 h-5 ${rule.color}`} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{rule.title}</div>
                  <div className="text-xs text-muted-foreground">{rule.description}</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between mb-2">
                <span className={`text-lg font-bold trading-number ${rule.color}`}>{rule.current}</span>
                <span className="text-sm text-muted-foreground">{t('challenge_limit')} {rule.value}</span>
              </div>
              
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full ${rule.bgColor} rounded-full transition-all duration-500`}
                  style={{ width: `${Math.min(rule.progress, 100)}%` }}
                />
              </div>
              
              {rule.progress >= 80 && rule.title !== t('challenge_rule_profit_target') && (
                <p className="text-xs text-warning mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {t('challenge_approaching_limit')}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Trading Rules */}
        <div className="surface-card p-6">
          <h2 className="text-lg font-semibold mb-4">{t('challenge_rules_title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tradingRules.map((rule, index) => (
              <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                <span className="text-sm">{rule}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Challenge Status Guide */}
        <div className="surface-card p-6">
          <h2 className="text-lg font-semibold mb-4">{t('challenge_status_title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-primary" />
                <span className="font-semibold text-primary">ACTIVE</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('challenge_status_active')}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-success/10 border border-success/20">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-success" />
                <span className="font-semibold text-success">PASSED</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('challenge_status_passed')}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-5 h-5 text-destructive" />
                <span className="font-semibold text-destructive">FAILED</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('challenge_status_failed')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Challenge;

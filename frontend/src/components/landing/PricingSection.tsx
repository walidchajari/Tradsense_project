import { Check, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';

const plans = [
  {
    name: 'Starter',
    price: '200',
    currency: 'DH',
    account: '$5,000',
    features: [
      'Access BVC + US/Crypto (delayed)',
      'Basic TradingView charts',
      '5 trades/day max',
      'Email support',
      '5% Daily drawdown limit',
      '10% Total drawdown limit',
    ],
    popular: false,
    color: 'border-border',
  },
  {
    name: 'Pro',
    price: '500',
    currency: 'DH',
    account: '$10,000',
    features: [
      'Live market data',
      'TradingView + indicators',
      'AI signals (5/day)',
      'Advanced risk tools',
      'Priority support',
      '5% Daily drawdown limit',
      '10% Total drawdown limit',
    ],
    popular: true,
    color: 'border-primary',
  },
  {
    name: 'Elite',
    price: '1000',
    currency: 'DH',
    account: '$25,000',
    features: [
      'Everything in Pro',
      'Unlimited AI signals',
      'AI predictions (multi-asset)',
      'Backtesting + advanced analytics',
      'Bots access (paper)',
      '1:1 coaching monthly',
      '5% Daily drawdown limit',
      '10% Total drawdown limit',
    ],
    popular: false,
    color: 'border-border',
  },
];

const PricingSection = () => {
  const { t } = useLanguage();
  return (
    <section id="pricing" className="py-24 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-hero-pattern opacity-50" />
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Choose Your{' '}
            <span className="gradient-text">Challenge</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Select the account size that fits your trading style. Pass the challenge and trade with our capital.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`surface-card p-8 relative ${plan.popular ? 'border-2 border-primary' : ''} hover:-translate-y-2 transition-all duration-300`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-primary to-emerald-400 rounded-full flex items-center gap-1">
                  <Star className="w-4 h-4 text-white fill-white" />
                  <span className="text-sm font-semibold text-white">Most Popular</span>
                </div>
              )}

              {/* Plan Name */}
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="text-sm text-muted-foreground">
                  {plan.account} Account
                </div>
              </div>

              {/* Price */}
              <div className="text-center mb-8">
                <div className="flex items-end justify-center gap-1">
                  <span className="text-5xl font-bold trading-number">{plan.price}</span>
                  <span className="text-xl text-muted-foreground mb-1">{plan.currency}</span>
                </div>
                <div className="text-sm text-muted-foreground mt-2">One-time fee</div>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, fIndex) => (
                  <li key={fIndex} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-success" />
                    </div>
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <Button
                variant={plan.popular ? 'hero' : 'outline'}
                className="w-full"
                size="lg"
                asChild
              >
                <Link to={`/register?plan=${plan.name.toLowerCase()}`}>
                  Start Challenge
                </Link>
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {[
            { title: t('pricing_meta_duration'), value: '30 days' },
            { title: t('pricing_meta_target'), value: '10%' },
            { title: t('pricing_meta_rules'), value: '5% daily / 10% total' },
          ].map((item) => (
            <div key={item.title} className="surface-card p-4 text-center">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{item.title}</div>
              <div className="text-lg font-semibold mt-2">{item.value}</div>
            </div>
          ))}
        </div>

        {/* Money Back Guarantee */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground text-sm">
            🔒 Secure payment with PayPal & CMI. 14-day refund policy available.
          </p>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;

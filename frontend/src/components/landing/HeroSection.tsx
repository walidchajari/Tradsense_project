import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowRight, Play, TrendingUp, Shield, Zap } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const HeroSection = () => {
  const { t } = useLanguage();
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-hero-pattern" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-400/20 rounded-full blur-[100px]" />

      {/* Grid Pattern */}
      <div className="absolute inset-0 chart-grid opacity-30" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8 animate-fade-in">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">{t('hero_badge')}</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 animate-slide-up">
            <span className="gradient-text">{t('hero_title_line1')}</span>
            <br />
            <span className="text-3xl md:text-5xl lg:text-6xl">{t('hero_title_line2')}</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            {t('hero_subtitle')}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <Button variant="hero" size="xl" asChild>
              <Link to="/register">
                Start Challenge
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button variant="outline" size="xl" asChild>
              <a href="#pricing">
                <Play className="w-5 h-5" />
                {t('hero_view_plans')}
              </a>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto animate-fade-in" style={{ animationDelay: '0.3s' }}>
            {[
              { value: '$10M+', label: t('hero_stat_capital') },
              { value: '2,500+', label: t('hero_stat_traders') },
              { value: '85%', label: t('hero_stat_success') },
              { value: '24/7', label: t('hero_stat_risk') },
            ].map((stat, index) => (
              <div key={index} className="surface-card p-4 text-center">
                <div className="text-2xl md:text-3xl font-bold gradient-text trading-number">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Floating Elements */}
        <div className="absolute left-10 top-1/3 hidden lg:block animate-float">
          <div className="surface-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <div>
              <div className="text-sm font-medium">BTC/USD</div>
              <div className="text-success trading-number text-sm">+5.24%</div>
            </div>
          </div>
        </div>

        <div className="absolute right-10 top-1/2 hidden lg:block animate-float" style={{ animationDelay: '1s' }}>
          <div className="surface-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium">Risk Protected</div>
              <div className="text-muted-foreground text-sm">AI Monitoring</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Building2, LineChart } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const BvcSection = () => {
  const { t } = useLanguage();
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="surface-card p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8 items-center">
          <div>
            <div className="section-title mb-3">{t('bvc_section_title')}</div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('bvc_title')}</h2>
            <p className="text-muted-foreground mb-6">
              {t('bvc_subtitle')}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="hero" asChild>
                <Link to="/dashboard/trading">{t('bvc_cta_primary')}</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/leaderboard">{t('bvc_cta_secondary')}</Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="surface-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-success" />
              </div>
              <div>
                <div className="text-sm font-semibold">{t('bvc_card_shares')}</div>
                <div className="text-xs text-muted-foreground">{t('bvc_card_shares_desc')}</div>
              </div>
            </div>
            <div className="surface-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <LineChart className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold">{t('bvc_card_tv')}</div>
                <div className="text-xs text-muted-foreground">{t('bvc_card_tv_desc')}</div>
              </div>
            </div>
            <div className="surface-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <LineChart className="w-5 h-5 text-warning" />
              </div>
              <div>
                <div className="text-sm font-semibold">{t('bvc_card_risk')}</div>
                <div className="text-xs text-muted-foreground">{t('bvc_card_risk_desc')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BvcSection;

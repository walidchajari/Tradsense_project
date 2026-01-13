import { ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const stories = [
  {
    name: 'Lina Farid',
    profit: '+$3,400',
    trend: '42% ROI',
    roleKey: 'story_lina_role',
    quoteKey: 'story_lina_quote',
  },
  {
    name: 'Omar Idrissi',
    profit: '+$8,200',
    trend: '28% ROI',
    roleKey: 'story_omar_role',
    quoteKey: 'story_omar_quote',
  },
  {
    name: 'Samira Beldi',
    profit: '+$12,500',
    trend: '37% ROI',
    roleKey: 'story_samira_role',
    quoteKey: 'story_samira_quote',
  },
];

const TraderStoriesSection = () => {
  const { t } = useLanguage();
  return (
    <section className="py-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-emerald-400/5" />
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="gradient-text">{t('trader_stories_title')}</span>
          </h2>
          <p className="text-muted-foreground">{t('trader_stories_subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stories.map((story) => (
            <div
              key={story.name}
              className="surface-card p-6 flex flex-col justify-between gap-4 transition-all hover:-translate-y-2 hover:border-primary/30"
            >
              <div>
                <div className="text-sm text-muted-foreground mb-2">{t(story.roleKey)}</div>
                <h3 className="text-xl font-semibold">{story.name}</h3>
                <p className="text-base leading-relaxed text-muted-foreground mt-3">"{t(story.quoteKey)}"</p>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-4">
                <span className="flex items-center gap-1">
                  <ArrowRight className="w-4 h-4 text-primary" />
                  {story.trend}
                </span>
                <span className="text-success font-semibold trading-number">{story.profit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TraderStoriesSection;

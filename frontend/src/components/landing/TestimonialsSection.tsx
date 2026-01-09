import { Star, Quote } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const testimonials = [
  {
    name: 'Ahmed Bennani',
    avatar: 'AB',
    country: '🇲🇦 Morocco',
    profit: '+$4,250',
    roleKey: 'testimonial_ahmed_role',
    contentKey: 'testimonial_ahmed_content',
    rating: 5,
  },
  {
    name: 'Sarah El Amrani',
    avatar: 'SA',
    country: '🇲🇦 Morocco',
    profit: '+$8,120',
    roleKey: 'testimonial_sarah_role',
    contentKey: 'testimonial_sarah_content',
    rating: 5,
  },
  {
    name: 'Youssef Tazi',
    avatar: 'YT',
    country: '🇲🇦 Morocco',
    profit: '+$12,500',
    roleKey: 'testimonial_youssef_role',
    contentKey: 'testimonial_youssef_content',
    rating: 5,
  },
];

const TestimonialsSection = () => {
  const { t } = useLanguage();
  return (
    <section className="py-24 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-hero-pattern opacity-30" />
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="gradient-text">{t('testimonials_title')}</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            {t('testimonials_subtitle')}
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="surface-card p-6 relative hover:border-primary/30 transition-all duration-300 hover:-translate-y-1"
            >
              {/* Quote Icon */}
              <Quote className="absolute top-4 right-4 w-8 h-8 text-primary/20" />

              {/* Header */}
              <div className="flex items-center gap-4 mb-4">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center">
                  <span className="text-sm font-bold text-white">{testimonial.avatar}</span>
                </div>
                <div>
                  <h4 className="font-semibold">{testimonial.name}</h4>
                  <div className="text-sm text-muted-foreground">{t(testimonial.roleKey)}</div>
                </div>
              </div>

              {/* Content */}
              <p className="text-muted-foreground mb-4 leading-relaxed">"{t(testimonial.contentKey)}"</p>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="flex items-center gap-1">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-warning fill-warning" />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{testimonial.country}</span>
                  <span className="text-sm font-semibold text-success trading-number">{testimonial.profit}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;

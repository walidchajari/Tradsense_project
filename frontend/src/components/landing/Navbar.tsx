import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, TrendingUp, Sun, Moon } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from 'next-themes';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const isDark = (resolvedTheme ?? theme) === 'dark';

  const navLinks = [
    { name: t('leaderboard'), to: '/leaderboard' },
    { name: t('pricing'), to: '/#pricing' },
    { name: t('contact'), to: '/contact' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-2xl">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-4 md:grid md:grid-cols-[1fr,auto,1fr] md:items-center">
          {/* Left: Theme + Language + Logo */}
          <div className="flex items-center gap-3 md:justify-self-start">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center shadow-lg shadow-primary/30 group-hover:shadow-primary/50 transition-shadow">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight">
                Trade<span className="gradient-text">Sense</span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="hidden md:inline-flex items-center justify-center w-9 h-9 rounded-full border border-border/70 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
              aria-label={isDark ? t('theme_light') : t('theme_dark')}
              title={isDark ? t('theme_light') : t('theme_dark')}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="hidden md:flex items-center gap-1 rounded-full border border-border/70 bg-card/70 p-1">
              {['en', 'fr', 'ar'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang as any)}
                  className={`text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all ${language === lang ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-primary'
                    }`}
                  aria-pressed={language === lang}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center justify-center gap-1 justify-self-center rounded-full border border-border/60 bg-card/70 px-3 py-1 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.6)] backdrop-blur-xl">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.to}
                className="px-4 py-2 rounded-full text-sm font-semibold text-muted-foreground transition-all hover:text-foreground hover:bg-background/80"
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3 md:justify-self-end">
            <Button variant="ghost" asChild className="px-4">
              <Link to="/login">{t('login')}</Link>
            </Button>
            <Button variant="hero" asChild>
              <Link to="/register">{t('start_challenge')}</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-xl hover:bg-accent transition-colors"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden mt-3 rounded-2xl border border-border/60 bg-card/90 backdrop-blur-xl shadow-[0_24px_50px_-30px_rgba(15,23,42,0.7)] animate-fade-in">
            <div className="flex flex-col gap-2 p-4">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.to}
                  className="px-4 py-3 rounded-xl bg-background/70 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
                  onClick={() => setIsOpen(false)}
                >
                  {link.name}
                </Link>
              ))}

              <div className="flex flex-col gap-3 pt-3 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setTheme(isDark ? 'light' : 'dark')}
                  className="flex items-center justify-center gap-2 text-sm font-semibold px-3 py-2 rounded-xl border border-border/70 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                >
                  {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  {isDark ? t('theme_light') : t('theme_dark')}
                </button>
                <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/70 p-2">
                  {['en', 'fr', 'ar'].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setLanguage(lang as any)}
                      className={`text-sm font-bold flex-1 py-2 rounded-lg ${language === lang ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'
                        }`}
                    >
                      {lang.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button variant="outline" asChild className="w-full">
                  <Link to="/login">{t('login')}</Link>
                </Button>
                <Button variant="hero" asChild className="w-full">
                  <Link to="/register">{t('start_challenge')}</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

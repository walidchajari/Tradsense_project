import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, TrendingUp, Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  const navLinks = [
    { name: t('leaderboard'), to: '/leaderboard' },
    { name: t('pricing'), to: '/#pricing' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/60">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center shadow-lg shadow-primary/30 group-hover:shadow-primary/50 transition-shadow">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">
              Trade<span className="gradient-text">Sense</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.to}
                className="nav-link text-sm font-medium"
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Desktop CTA & Language */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-1 mr-4 border-r border-border/70 pr-4">
              {['en', 'fr', 'ar'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang as any)}
                  className={`text-xs font-semibold px-2 py-1 rounded-full transition-all ${language === lang ? 'bg-primary text-white' : 'text-muted-foreground hover:text-primary'
                    }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>

            <Button variant="ghost" asChild>
              <Link to="/login">{t('login')}</Link>
            </Button>
            <Button variant="hero" asChild>
              <Link to="/register">{t('start_challenge')}</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-accent transition-colors"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-border/50 animate-fade-in">
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.to}
                  className="px-4 py-3 rounded-lg hover:bg-accent transition-colors text-sm font-medium"
                  onClick={() => setIsOpen(false)}
                >
                  {link.name}
                </Link>
              ))}

              <div className="flex gap-4 px-4 py-2 border-y border-border my-2">
                {['en', 'fr', 'ar'].map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang as any)}
                    className={`text-sm font-bold flex-1 py-2 rounded ${language === lang ? 'bg-primary text-white' : 'bg-secondary'
                      }`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2 mt-2 px-4">
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

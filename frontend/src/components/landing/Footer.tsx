import { Link } from 'react-router-dom';
import { TrendingUp, Twitter, Linkedin, Youtube, MessageCircle } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    platform: [
      { name: 'Features', to: '/#features' },
      { name: 'Pricing', to: '/#pricing' },
      { name: 'How It Works', to: '/#how-it-works' },
      { name: 'Leaderboard', to: '/leaderboard' },
    ],
    company: [
      { name: 'About Us', to: '/about' },
      { name: 'Careers', to: '/careers' },
      { name: 'Press', to: '/press' },
      { name: 'Contact', to: '/contact' },
    ],
    legal: [
      { name: 'Terms of Service', to: '/terms' },
      { name: 'Privacy Policy', to: '/privacy' },
      { name: 'Risk Disclosure', to: '/risk' },
      { name: 'Refund Policy', to: '/refund' },
    ],
  };

  const socialLinks = [
    { icon: Twitter, href: 'https://twitter.com' },
    { icon: Linkedin, href: 'https://linkedin.com' },
    { icon: Youtube, href: 'https://youtube.com' },
    { icon: MessageCircle, href: 'https://discord.com' },
  ];

  return (
    <footer className="border-t border-border bg-card/60">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">
                Trade<span className="gradient-text">Sense</span>
              </span>
            </Link>
            <p className="text-muted-foreground mb-6 max-w-sm">
              The next-generation AI-powered prop trading platform. Trade smarter, get funded, and grow your career.
            </p>
            <div className="flex items-center gap-3">
              {socialLinks.map((social, index) => (
                <a
                  key={index}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary/20 hover:text-primary transition-colors"
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Platform Links */}
          <div>
            <h4 className="font-semibold mb-4">Platform</h4>
            <ul className="space-y-3">
              {footerLinks.platform.map((link, index) => (
                <li key={index}>
                  <Link
                    to={link.to}
                    className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link, index) => (
                <li key={index}>
                  <Link
                    to={link.to}
                    className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link, index) => (
                <li key={index}>
                  <Link
                    to={link.to}
                    className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {currentYear} TradeSense AI. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground text-center md:text-right max-w-lg">
            Trading involves substantial risk. Past performance is not indicative of future results.
            Only trade with capital you can afford to lose.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

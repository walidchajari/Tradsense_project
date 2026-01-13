import { useEffect, useRef } from 'react';
import Navbar from '@/components/landing/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import TrustSection from '@/components/landing/TrustSection';
import PillarsSection from '@/components/landing/PillarsSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import PricingSection from '@/components/landing/PricingSection';
import HowItWorksSection from '@/components/landing/HowItWorksSection';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import TraderStoriesSection from '@/components/landing/TraderStoriesSection';
import Footer from '@/components/landing/Footer';

const TICKER_TAPE_CONFIG = {
  symbols: [
    { proName: 'NASDAQ:AAPL', title: 'Apple' },
    { proName: 'NASDAQ:MSFT', title: 'Microsoft' },
    { proName: 'NASDAQ:TSLA', title: 'Tesla' },
    { proName: 'NASDAQ:NVDA', title: 'Nvidia' },
    { proName: 'NASDAQ:AMZN', title: 'Amazon' },
    { proName: 'NASDAQ:GOOGL', title: 'Alphabet' },
    { proName: 'NASDAQ:META', title: 'Meta' },
    { proName: 'NASDAQ:NFLX', title: 'Netflix' },
    { proName: 'NYSE:JPM', title: 'JPMorgan' },
    { proName: 'NYSE:V', title: 'Visa' },
    { proName: 'NYSE:XOM', title: 'Exxon Mobil' },
    { proName: 'NYSE:KO', title: 'Coca-Cola' },
    { proName: 'NASDAQ:AMD', title: 'AMD' },
    { proName: 'BVC:IAM', title: 'Maroc Telecom' },
    { proName: 'BVC:ATW', title: 'Attijariwafa Bank' },
    { proName: 'BVC:BOA', title: 'Bank of Africa' },
    { proName: 'BVC:ADH', title: 'Addoha' },
  ],
  showSymbolLogo: true,
  isTransparent: false,
  displayMode: 'regular',
  colorTheme: 'dark',
  locale: 'en',
};

const Index = () => {
  const tickerContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const doc = document;
    const title = 'TradeSense AI | Prop Trading Maroc & Funding';
    const description =
      'TradeSense AI est la première prop firm africaine avec accès à la Bourse de Casablanca, funding rapide et profils disciplinés.';
    const keywords = 'prop trading maroc, bourse de casablanca, ai trading, traders africains financés';
    doc.title = title;
    const applyMeta = (selector: string, attr: string, value: string) => {
      const el = doc.querySelector(selector);
      if (el) {
        el.setAttribute(attr, value);
      }
    };
    applyMeta('meta[name="description"]', 'content', description);
    applyMeta('meta[property="og:title"]', 'content', title);
    applyMeta('meta[property="og:description"]', 'content', description);
    applyMeta('meta[name="twitter:title"]', 'content', title);
    applyMeta('meta[name="twitter:description"]', 'content', description);
    let keywordsMeta = doc.querySelector('meta[name="keywords"]');
    if (!keywordsMeta) {
      keywordsMeta = doc.createElement('meta');
      keywordsMeta.setAttribute('name', 'keywords');
      doc.head.appendChild(keywordsMeta);
    }
    keywordsMeta.setAttribute('content', keywords);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!tickerContainerRef.current) return;
    tickerContainerRef.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.async = true;
    script.innerHTML = JSON.stringify(TICKER_TAPE_CONFIG);
    tickerContainerRef.current.appendChild(script);
    return () => {
      if (tickerContainerRef.current) {
        tickerContainerRef.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto w-full px-3 pt-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#0f172a] via-[#0b1220] to-[#0a0f1a] shadow-[0_18px_60px_rgba(15,23,42,0.45)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_55%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.18),_transparent_45%)]" />
          <div className="flex items-center justify-end px-5 py-2">
            <div className="hidden sm:flex items-center gap-2 text-xs text-white/60">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Temps reel
            </div>
          </div>
          <div className="border-t border-white/5" />
          <div className="tradingview-widget-container ticker-line-compact min-h-[44px] px-2 py-1" ref={tickerContainerRef}>
            <div className="tradingview-widget-container__widget" />
          </div>
        </div>
      </div>
      <HeroSection />
      <TrustSection />
      <PillarsSection />
      <FeaturesSection />
      <PricingSection />
      <TraderStoriesSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <Footer />
    </div>
  );
};

export default Index;

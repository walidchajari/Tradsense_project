import { useEffect } from 'react';
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

const Index = () => {
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
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

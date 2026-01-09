import { ReactNode } from 'react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

type StaticPageLayoutProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
};

const StaticPageLayout = ({ title, subtitle, children }: StaticPageLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-semibold">{title}</h1>
              {subtitle ? <p className="text-muted-foreground mt-2">{subtitle}</p> : null}
            </div>
            <div className="surface-card p-6 md:p-8 space-y-4 text-muted-foreground">
              {children}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default StaticPageLayout;

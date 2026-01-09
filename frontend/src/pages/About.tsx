import StaticPageLayout from '@/components/landing/StaticPageLayout';

const About = () => {
  return (
    <StaticPageLayout
      title="About Us"
      subtitle="TradeSense AI is a modern prop trading platform built to help traders grow with confidence."
    >
      <p>
        We combine real-time market data, risk management, and AI-driven insights so traders can focus on execution.
        Our mission is simple: make funding accessible and transparent while keeping the trader experience fast,
        clear, and professional.
      </p>
      <p>
        From curated challenges to live dashboards, we design every feature to reduce friction and elevate performance.
        We believe in measurable progress, responsible risk, and tools that scale with you.
      </p>
    </StaticPageLayout>
  );
};

export default About;

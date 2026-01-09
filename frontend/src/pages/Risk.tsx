import StaticPageLayout from '@/components/landing/StaticPageLayout';

const Risk = () => {
  return (
    <StaticPageLayout
      title="Risk Disclosure"
      subtitle="Trading involves substantial risk. Please read carefully."
    >
      <p>
        Trading leveraged products can lead to significant losses. Past performance is not a guarantee of future
        results. Always trade with capital you can afford to lose.
      </p>
      <p>
        Our platform provides tools and analytics to help you manage risk, but final trading decisions are always your
        responsibility.
      </p>
    </StaticPageLayout>
  );
};

export default Risk;

import StaticPageLayout from '@/components/landing/StaticPageLayout';

const Terms = () => {
  return (
    <StaticPageLayout
      title="Terms of Service"
      subtitle="These terms outline the rules and expectations for using TradeSense AI."
    >
      <p>
        By accessing or using the platform, you agree to follow the applicable trading rules, payment terms, and
        eligibility requirements. We reserve the right to update the service and enforce compliance to protect traders
        and the community.
      </p>
      <p>
        If you have questions about these terms, contact us through the support channel or the contact form.
      </p>
    </StaticPageLayout>
  );
};

export default Terms;

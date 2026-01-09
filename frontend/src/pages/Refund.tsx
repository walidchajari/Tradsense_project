import StaticPageLayout from '@/components/landing/StaticPageLayout';

const Refund = () => {
  return (
    <StaticPageLayout
      title="Refund Policy"
      subtitle="Clear and fair rules for refunds and chargebacks."
    >
      <p>
        Challenge fees are non-refundable once the challenge has started. If you experience a billing issue or technical
        error, contact support as soon as possible so we can investigate.
      </p>
      <p>
        Approved refunds are processed back to the original payment method. Processing times may vary by provider.
      </p>
    </StaticPageLayout>
  );
};

export default Refund;

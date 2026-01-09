import StaticPageLayout from '@/components/landing/StaticPageLayout';

const Privacy = () => {
  return (
    <StaticPageLayout
      title="Privacy Policy"
      subtitle="We respect your data and are committed to keeping it secure."
    >
      <p>
        We collect only the information needed to operate the platform, verify accounts, and improve performance.
        Your data is never sold. Access is limited, audited, and protected by modern security practices.
      </p>
      <p>
        You can request access, updates, or deletion of your personal information by contacting support.
      </p>
    </StaticPageLayout>
  );
};

export default Privacy;

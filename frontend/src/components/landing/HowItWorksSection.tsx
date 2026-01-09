import { CreditCard, Target, Award, Wallet } from 'lucide-react';

const steps = [
  {
    icon: CreditCard,
    step: '01',
    title: 'Choose a Plan',
    description: 'Select the challenge that matches your trading experience and goals. Pay a one-time fee to start.',
  },
  {
    icon: Target,
    step: '02',
    title: 'Pass the Challenge',
    description: 'Trade on real market data. Hit 10% profit without exceeding drawdown limits. AI assists you throughout.',
  },
  {
    icon: Award,
    step: '03',
    title: 'Get Funded',
    description: 'Once you pass, you\'re verified as a skilled trader. Receive a funded account to trade with our capital.',
  },
  {
    icon: Wallet,
    step: '04',
    title: 'Trade & Earn',
    description: 'Keep up to 80% of the profits you make. Scale your account as you prove consistent profitability.',
  },
];

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-card/30 to-background" />
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            How It{' '}
            <span className="gradient-text">Works</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            From registration to funded trader in four simple steps. Our AI-powered platform guides you every step of the way.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="relative group">
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-1/2 w-full h-0.5 bg-gradient-to-r from-primary/50 to-transparent" />
              )}

              {/* Card */}
              <div className="surface-card p-6 text-center relative hover:border-primary/30 transition-all duration-300 hover:-translate-y-1">
                {/* Step Number */}
                <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{step.step}</span>
                </div>

                {/* Icon */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-emerald-400/20 flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform duration-300">
                  <step.icon className="w-8 h-8 text-primary" />
                </div>

                {/* Content */}
                <h3 className="text-lg font-semibold mb-3">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;

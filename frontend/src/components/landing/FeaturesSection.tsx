import {
  Brain,
  LineChart,
  Shield,
  Trophy,
  GraduationCap,
  Users
} from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: 'Assistance Trading IA',
    description: 'Signaux Achat/Vente/Stop directement sur la page. Plans de trade personnalisés et alertes de détection de risque.',
    color: 'from-primary to-blue-400',
  },
  {
    icon: LineChart,
    title: "Hub d'Actualités en Direct",
    description: 'Actualités financières en temps réel, résumés de marché par IA et alertes d\'événements économiques.',
    color: 'from-sky-500 to-cyan-400',
  },
  {
    icon: Shield,
    title: 'Gestion des Risques IA',
    description: 'Tri intelligent qui filtre automatiquement les bons trades des risqués pour un parcours plus sûr.',
    color: 'from-success to-emerald-400',
  },
  {
    icon: Users,
    title: 'Zone Communautaire',
    description: 'Partagez des stratégies, rejoignez des groupes thématiques et apprenez des experts.',
    color: 'from-warning to-orange-400',
  },
  {
    icon: GraduationCap,
    title: 'MasterClass Academy',
    description: 'Cours complets du débutant à l\'avancé, webinaires en direct et parcours d\'apprentissage assistés par IA.',
    color: 'from-amber-500 to-orange-400',
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-card/20 to-background" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything You Need to{' '}
            <span className="gradient-text">Trade Smarter</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Our AI-powered platform gives you the tools, insights, and capital to succeed in the markets.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="surface-card p-6 group hover:border-primary/30 transition-all duration-300 hover:-translate-y-1"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Icon */}
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} p-3 mb-5 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="w-full h-full text-white" />
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;

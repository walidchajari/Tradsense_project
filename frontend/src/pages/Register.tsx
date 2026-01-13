import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { TrendingUp, Mail, Lock, Eye, EyeOff, User, Zap, Crown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { registerUser } from '@/lib/api';

type AccountType = 'trial' | 'paid';

const plans = [
  { id: 'starter', name: 'Starter', price: '200 DH', account: '$5,000' },
  { id: 'pro', name: 'Pro', price: '500 DH', account: '$10,000' },
  { id: 'elite', name: 'Elite', price: '1000 DH', account: '$25,000' },
];

const Register = () => {
  const [searchParams] = useSearchParams();
  const defaultPlan = searchParams.get('plan') || 'pro';
  const rawType = searchParams.get('type');
  const defaultType: AccountType = rawType === 'trial' || rawType === 'paid' ? rawType : 'paid';

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    plan: defaultPlan,
    accountType: defaultType,
    acceptTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.acceptTerms) {
      toast({
        title: 'Error',
        description: 'Please accept the terms and conditions',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const data = await registerUser({
        username: formData.fullName,
        email: formData.email,
        password: formData.password,
        account_type: formData.accountType,
        plan: formData.plan,
      });
      const isAdmin = Boolean(data.is_admin);
      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('auth_user_id', String(data.user_id));
      localStorage.setItem('auth_email', data.email);
      localStorage.setItem('auth_username', data.username);
      localStorage.setItem('auth_is_admin', String(isAdmin));

      if (formData.accountType === 'trial') {
        toast({
          title: 'Free Trial Started!',
          description: 'Your $2,000 trial challenge is ready.',
        });
        setTimeout(() => navigate('/dashboard?mode=trial'), 500);
      } else {
        toast({
          title: 'Account Created!',
          description: 'Redirecting to payment...',
        });
        setTimeout(() => navigate(`/checkout?plan=${formData.plan}`), 500);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create account. Try another email.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const accountTypes = [
    {
      id: 'trial' as AccountType,
      icon: Zap,
      title: 'Free Trial',
      description: '$2,000 challenge • Test rules • No funding',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning',
    },
    {
      id: 'paid' as AccountType,
      icon: Crown,
      title: 'Paid Challenge',
      description: 'Full evaluation • Get funded • Real profits',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      borderColor: 'border-primary',
    },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-md py-8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">
              Trade<span className="gradient-text">Sense</span>
            </span>
          </Link>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Create Your Account</h1>
            <p className="text-muted-foreground">
              Choose how you want to start your trading journey
            </p>
          </div>

          {/* Account Type Selection */}
          <div className="space-y-3 mb-6">
            <Label>Account Type</Label>
            <div className="grid grid-cols-1 gap-3">
              {accountTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, accountType: type.id }))}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                    formData.accountType === type.id
                      ? `${type.borderColor} ${type.bgColor}`
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg ${type.bgColor} flex items-center justify-center`}>
                    <type.icon className={`w-5 h-5 ${type.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{type.title}</div>
                    <div className="text-xs text-muted-foreground">{type.description}</div>
                  </div>
                  {formData.accountType === type.id && (
                    <div className={`w-4 h-4 rounded-full ${type.color.replace('text-', 'bg-')}`} />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="h-4" />

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="pl-10 bg-secondary border-border"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="pl-10 bg-secondary border-border"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  className="pl-10 pr-10 bg-secondary border-border"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="pl-10 bg-secondary border-border"
                  required
                />
              </div>
            </div>

            {/* Plan Selection (only for paid) */}
            {formData.accountType === 'paid' && (
              <div className="space-y-3">
                <Label>Select Plan</Label>
                <div className="grid grid-cols-3 gap-3">
                  {plans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, plan: plan.id }))}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        formData.plan === plan.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="text-sm font-semibold">{plan.name}</div>
                      <div className="text-xs text-muted-foreground">{plan.account}</div>
                      <div className="text-sm font-bold text-primary mt-1">{plan.price}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Terms */}
            <div className="flex items-start gap-2">
              <Checkbox
                id="terms"
                checked={formData.acceptTerms}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, acceptTerms: checked as boolean }))
                }
                className="mt-1"
              />
              <Label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">
                I agree to the{' '}
                <Link to="/terms" className="text-primary hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
              </Label>
            </div>

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isLoading}>
              {isLoading
                ? 'Creating Account...'
                : formData.accountType === 'paid'
                ? 'Create Account & Pay'
                : 'Create Free Account'}
            </Button>
          </form>

          {/* Login Link */}
          <p className="text-center text-muted-foreground mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right Side - Visual */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary/10 via-emerald-400/10 to-background items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 chart-grid opacity-20" />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-primary/30 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/3 left-1/4 w-48 h-48 bg-emerald-400/30 rounded-full blur-[80px]" />

        <div className="relative z-10">
          <div className="surface-card p-8 max-w-sm">
            <h3 className="text-2xl font-bold mb-4">Why TradeSense?</h3>
            <ul className="space-y-3">
              {[
                'Try free with no commitment',
                'AI-powered trade signals',
                'Real-time market data',
                'Risk management tools',
                'Community access',
                '80% profit split when funded',
              ].map((item, index) => (
                <li key={index} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-success" />
                  </div>
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;

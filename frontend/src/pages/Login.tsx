import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { GoogleLogin } from '@react-oauth/google';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL, loginUser } from '@/lib/api';

const GOOGLE_AUTH_ENDPOINT = `${API_BASE_URL}/auth/google`;

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const handleGoogleSuccess = async (credentialResponse: { credential?: string | null }) => {
    if (!credentialResponse.credential) {
      toast({
        title: 'Google Login Failed',
        description: 'Missing Google credentials. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(GOOGLE_AUTH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: credentialResponse.credential,
          id_token: credentialResponse.credential,
        }),
      });
      if (!response.ok) {
        throw new Error('Google authentication failed');
      }
      const data = await response.json();
      const isAdmin = Boolean(data.is_admin);
      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('auth_user_id', String(data.user_id));
      localStorage.setItem('auth_email', data.email);
      localStorage.setItem('auth_username', data.username);
      localStorage.setItem('auth_is_admin', String(isAdmin));
      toast({
        title: 'Welcome back!',
        description: isAdmin
          ? 'Login successful. Redirecting to admin...'
          : 'Login successful. Redirecting to dashboard...',
      });
      setTimeout(() => navigate(isAdmin ? '/admin' : '/dashboard'), 500);
    } catch (error) {
      toast({
        title: 'Google Login Failed',
        description: 'Unable to sign in with Google. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const data = await loginUser({ email, password });
      const isAdmin = Boolean(data.is_admin);
      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('auth_user_id', String(data.user_id));
      localStorage.setItem('auth_email', data.email);
      localStorage.setItem('auth_username', data.username);
      localStorage.setItem('auth_is_admin', String(isAdmin));
      toast({
        title: 'Welcome back!',
        description: isAdmin
          ? 'Login successful. Redirecting to admin...'
          : 'Login successful. Redirecting to dashboard...',
      });
      setTimeout(() => navigate(isAdmin ? '/admin' : '/dashboard'), 500);
    } catch (error) {
      toast({
        title: 'Login Failed',
        description: 'Invalid credentials. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 mb-8">
            <img
              src="/brand-icon.svg"
              alt="TradeSense"
              className="h-10 w-10 rounded-xl shadow-lg shadow-primary/20"
            />
            <span className="text-xl font-bold">
              Trade<span className="gradient-text">Sense</span>
            </span>
          </Link>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Welcome back</h1>
            <p className="text-muted-foreground">
              Enter your credentials to access your trading account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="trader@tradesense.ai"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-secondary border-border"
                  required
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

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                  Remember me
                </Label>
              </div>
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Google Sign In */}
          <div className="w-full mb-3">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() =>
                toast({
                  title: 'Google Login Failed',
                  description: 'Unable to sign in with Google. Please try again.',
                  variant: 'destructive',
                })
              }
            />
          </div>

          {/* Register Link */}
          <p className="text-center text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary hover:underline font-medium">
              Start your challenge
            </Link>
          </p>
        </div>
      </div>

      {/* Right Side - Visual */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary/10 via-emerald-400/10 to-background items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 chart-grid opacity-20" />
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/30 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 left-1/4 w-48 h-48 bg-emerald-400/30 rounded-full blur-[80px]" />
        <div className="relative z-10 text-center">
          <div className="text-6xl font-bold gradient-text mb-4">85%</div>
          <p className="text-xl text-muted-foreground">Success Rate</p>
          <p className="text-muted-foreground mt-2">for our funded traders</p>
        </div>
      </div>
    </div>
  );
};

export default Login;

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCurrentUserId } from '@/lib/auth';

declare global {
  interface Window {
    paypal?: any;
  }
}

type Challenge = {
  id: number;
  name: string;
  price_dh: number;
  initial_balance: number;
};

const loadPayPalScript = (clientId: string, currencyCode: string) =>
  new Promise<void>((resolve, reject) => {
    const existing = document.getElementById('paypal-sdk');
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = 'paypal-sdk';
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=${currencyCode}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('PayPal SDK failed to load'));
    document.body.appendChild(script);
  });

const Checkout = () => {
  const [searchParams] = useSearchParams();
  const planParam = (searchParams.get('plan') || 'pro').toLowerCase();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalConfig, setPaypalConfig] = useState<{ client_id: string; currency_code: string } | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const userId = getCurrentUserId();

  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/challenges`);
        const data = await res.json();
        setChallenges(data || []);
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to load challenges', variant: 'destructive' });
      }
    };
    fetchChallenges();
  }, [toast]);

  useEffect(() => {
    const fetchPayPalConfig = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/paypal/config/public`);
        if (!res.ok) {
          return;
        }
        const data = await res.json();
        setPaypalConfig(data);
      } catch (error) {
        setPaypalConfig(null);
      }
    };
    fetchPayPalConfig();
  }, []);

  const selectedChallenge = useMemo(() => {
    if (!challenges.length) return null;
    const match = challenges.find((c) => c.name.toLowerCase() === planParam);
    return match || challenges[0];
  }, [challenges, planParam]);

  useEffect(() => {
    const setupPayPal = async () => {
      if (!paypalConfig || !selectedChallenge) return;
      try {
        await loadPayPalScript(paypalConfig.client_id, paypalConfig.currency_code);
        const container = document.getElementById('paypal-buttons');
        if (container) {
          container.innerHTML = '';
        }
        if (window.paypal && container) {
          window.paypal.Buttons({
            createOrder: async () => {
              const res = await fetch(`${API_BASE_URL}/paypal/create-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  user_id: userId,
                  challenge_id: selectedChallenge.id,
                }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok || !data.id) {
                throw new Error(data.error || 'Failed to create PayPal order');
              }
              return data.id;
            },
            onApprove: async (data: { orderID: string }) => {
              setProcessing('paypal');
              const res = await fetch(`${API_BASE_URL}/paypal/capture-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  order_id: data.orderID,
                  user_id: userId,
                  challenge_id: selectedChallenge.id,
                  }),
              });
              const result = await res.json().catch(() => ({}));
              setProcessing(null);
              if (res.ok && result.status === 'success') {
                toast({ title: 'Payment successful', description: 'Challenge activated' });
                navigate('/dashboard/challenge?mode=paid');
              } else {
                toast({ title: 'Payment error', description: result.error || result.detail || 'PayPal capture failed', variant: 'destructive' });
              }
            },
            onError: () => {
              toast({ title: 'Payment error', description: 'PayPal button failed', variant: 'destructive' });
            },
          }).render('#paypal-buttons');
          setPaypalReady(true);
        }
      } catch (error) {
        setPaypalReady(false);
      }
    };
    setupPayPal();
  }, [paypalConfig, selectedChallenge, toast, navigate]);

  const handleCMIPayment = async () => {
    if (!selectedChallenge) return;
    setProcessing('cmi');
    try {
      const res = await fetch(`${API_BASE_URL}/cmi/generate-form`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          challenge_id: selectedChallenge.id,
        }),
      });
      const data = await res.json();
      if (data.action && data.fields) {
        // Create a temporary form and submit it
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = data.action;

        Object.keys(data.fields).forEach(key => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = data.fields[key];
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to generate CMI form', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'CMI server error', variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const handleCryptoPayment = async () => {
    if (!selectedChallenge) return;
    setProcessing('crypto');
    try {
      const res = await fetch(`${API_BASE_URL}/crypto/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 1, // Use real user id
          challenge_id: selectedChallenge.id,
        }),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to create Crypto order', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Binance Pay server error', variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t('checkout_title')}</h1>
          <p className="text-muted-foreground">{t('checkout_subtitle')}</p>
        </div>

        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold mb-4">{t('checkout_order_summary')}</h2>
            {selectedChallenge ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('checkout_plan_label')}</span>
                  <span className="font-medium">{selectedChallenge.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('checkout_account_size_label')}</span>
                  <span className="font-medium">${selectedChallenge.initial_balance.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('checkout_price_label')}</span>
                  <span className="font-bold trading-number">{selectedChallenge.price_dh} DH</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">{t('checkout_loading')}</div>
            )}
          </div>

          <div id="payment-options" className="surface-card p-6">
            <h2 className="text-lg font-semibold mb-4">{t('checkout_payment_options')}</h2>

            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{t('checkout_paypal_label')}</div>
                  <div className="text-xs text-muted-foreground">
                    {paypalConfig ? t('checkout_paypal_connected') : t('checkout_paypal_not_configured')}
                  </div>
                </div>
                <div id="paypal-buttons" className="min-h-[44px]" />
                {!paypalReady && paypalConfig && (
                  <div className="text-xs text-muted-foreground mt-2">{t('checkout_paypal_loading')}</div>
                )}
                {!paypalConfig && (
                  <div className="text-xs text-destructive mt-2">{t('checkout_paypal_missing')}</div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleCMIPayment}
                  disabled={processing !== null}
                >
                  {processing === 'cmi' ? t('checkout_cmi_loading') : t('checkout_cmi_button')}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleCryptoPayment}
                  disabled={processing !== null}
                >
                  {processing === 'crypto' ? t('checkout_crypto_loading') : t('checkout_crypto_button')}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {selectedChallenge && (
          <div className="fixed bottom-4 left-0 right-0 z-40 px-4 lg:hidden">
            <div className="surface-card px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t('checkout_total')}</div>
                <div className="text-lg font-semibold trading-number">{selectedChallenge.price_dh} DH</div>
              </div>
              <Button variant="hero" asChild>
                <a href="#payment-options">{t('checkout_pay_now')}</a>
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Checkout;

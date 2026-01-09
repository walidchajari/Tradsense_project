import { useState } from 'react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { submitContactMessage } from '@/lib/api';

const Contact = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const updateField = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast({ title: 'Missing details', description: 'Please fill in your name, email, and message.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      await submitContactMessage({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim() || undefined,
        message: form.message.trim(),
      });
      toast({ title: 'Message sent', description: 'We received your message and will get back to you soon.' });
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      toast({ title: 'Send failed', description: 'Unable to send your message right now.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-semibold">Contact Us</h1>
              <p className="text-muted-foreground mt-2">
                Tell us about your question, partnership request, or support issue.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
              <form onSubmit={handleSubmit} className="surface-card p-6 md:p-8 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="contact-name">Full name</Label>
                  <Input
                    id="contact-name"
                    value={form.name}
                    onChange={updateField('name')}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email">Email</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={form.email}
                    onChange={updateField('email')}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-subject">Subject</Label>
                  <Input
                    id="contact-subject"
                    value={form.subject}
                    onChange={updateField('subject')}
                    placeholder="How can we help?"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-message">Message</Label>
                  <Textarea
                    id="contact-message"
                    value={form.message}
                    onChange={updateField('message')}
                    placeholder="Share the details of your request..."
                    rows={6}
                  />
                </div>
                <Button type="submit" variant="hero" disabled={isSubmitting}>
                  {isSubmitting ? 'Sending...' : 'Send message'}
                </Button>
              </form>

              <div className="surface-card p-6 md:p-8 space-y-4 text-muted-foreground">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Support hours</h2>
                  <p className="text-sm">Monday–Friday, 9:00–18:00 (GMT+1)</p>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Email</h2>
                  <p className="text-sm">support@tradesense.ai</p>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Business inquiries</h2>
                  <p className="text-sm">partners@tradesense.ai</p>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Location</h2>
                  <p className="text-sm">Casablanca, Morocco</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Contact;

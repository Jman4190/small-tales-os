'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export function CourseSignupForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'already' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [count, setCount] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === 'loading') return;

    setStatus('loading');

    try {
      const res = await fetch('/api/course/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setMessage(data.message);
        setCount(data.count);
        setEmail('');
      } else if (res.status === 409) {
        setStatus('already');
        setMessage(data.error);
        setCount(data.count);
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong.');
      }
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  };

  return (
    <section id="course-signup" className="py-16 md:py-24 bg-gradient-to-b from-white to-[#F0F4FF]">
      <div className="container px-4 mx-auto max-w-xl text-center">
        <div className="bg-white rounded-2xl border shadow-sm p-8 md:p-10">
          <div className="w-14 h-14 rounded-2xl bg-[#5075FE]/10 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-7 h-7 text-[#5075FE]" />
          </div>

          <h2 className="text-2xl md:text-3xl font-bold text-[#0F0F0F] mb-3 font-[family-name:var(--font-poppins)]">
            Reserve Your Spot
          </h2>

          <p className="text-muted-foreground mb-2">
            Sign up for free — no payment required.
          </p>

          <p className="text-sm text-muted-foreground mb-8">
            Once we hit 100 signups we&apos;ll launch the course. You&apos;ll be the first
            to know and get a chance at an{' '}
            <span className="font-semibold text-[#0F0F0F]">early bird discount</span>{' '}
            on the <span className="font-semibold text-[#0F0F0F]">$9.99</span> price.
          </p>

          {status === 'success' ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
              <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-3" />
              <p className="text-green-800 font-medium">{message}</p>
              {count !== null && (
                <p className="text-green-600 text-sm mt-2">
                  {count} people have signed up so far.
                </p>
              )}
              <p className="text-green-600 text-sm mt-1">
                Check your inbox for a confirmation email.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === 'error' || status === 'already') {
                    setStatus('idle');
                  }
                }}
                required
                className="h-12 text-base rounded-xl"
              />

              <Button
                type="submit"
                disabled={status === 'loading'}
                className="w-full h-12 bg-[#5075FE] hover:bg-[#5075FE]/90 text-white rounded-full text-base font-medium"
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing up...
                  </>
                ) : (
                  'Sign Up Free'
                )}
              </Button>

              {status === 'already' && (
                <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{message}</span>
                </div>
              )}

              {status === 'error' && (
                <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{message}</span>
                </div>
              )}
            </form>
          )}

          <p className="text-xs text-muted-foreground mt-6">
            No spam, ever. We&apos;ll only email you about the course launch.
          </p>
        </div>
      </div>
    </section>
  );
}

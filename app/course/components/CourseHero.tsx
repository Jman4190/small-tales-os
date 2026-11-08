'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, Users } from 'lucide-react';

export function CourseHero() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    fetch('/api/course/signup-count')
      .then((res) => res.json())
      .then((data) => setCount(data.count))
      .catch(() => {});
  }, []);

  const goal = 100;
  const percentage = Math.min((count / goal) * 100, 100);
  const isOversubscribed = count > goal;

  return (
    <section className="relative bg-gradient-to-b from-[#F0F4FF] to-white pt-32 pb-16 md:pt-40 md:pb-24">
      <div className="container px-4 mx-auto max-w-4xl text-center">
        {/* Badge */}
        <div className="flex justify-center mb-6">
          <Badge
            variant="secondary"
            className="bg-[#5075FE]/10 text-[#5075FE] border-[#5075FE]/20 px-4 py-1.5 text-sm font-medium rounded-full"
          >
            <GraduationCap className="w-4 h-4 mr-1.5" />
            Video Course
          </Badge>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-[#0F0F0F] mb-4 font-[family-name:var(--font-poppins)]">
          How to Build Your Own
          <br />
          <span className="text-[#5075FE]">Personalized Children&apos;s Book Business</span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Learn to Build, Operate and Market A Solo AI Business with Codex,
          ChatGPT, Stripe and More
        </p>

        {/* Price */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <span className="text-4xl font-bold text-[#0F0F0F]">$9.99</span>
          <span className="text-muted-foreground text-sm">
            when the course launches
          </span>
        </div>

        {/* Progress tracker */}
        <div className="max-w-md mx-auto bg-white rounded-2xl border shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[#0F0F0F]">
              <Users className="w-4 h-4 text-[#5075FE]" />
              {isOversubscribed ? (
                <span>
                  <span className="text-[#5075FE] font-bold">{count}</span>{' '}
                  signups — Oversubscribed!
                </span>
              ) : (
                <span>
                  <span className="text-[#5075FE] font-bold">{count}</span> of{' '}
                  {goal} signups to unlock
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {Math.round(percentage)}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${percentage}%`,
                background: isOversubscribed
                  ? 'linear-gradient(90deg, #5075FE, #34D399)'
                  : 'linear-gradient(90deg, #5075FE, #7B9BFF)',
              }}
            />
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            {isOversubscribed
              ? 'Goal reached! Sign up to be notified at launch.'
              : 'Sign up free below. No payment required.'}
          </p>

          <a
            href="#course-signup"
            className="mt-4 inline-flex h-10 px-6 items-center justify-center rounded-full bg-[#5075FE] text-white text-sm font-medium hover:bg-[#5075FE]/90 transition-colors"
          >
            Reserve Your Spot
          </a>
        </div>
      </div>
    </section>
  );
}

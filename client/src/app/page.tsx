'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Image from 'next/image';
import { LandingHero } from '@/components/LandingHero';
import { LandingFeatures } from '@/components/LandingFeatures';
import { LandingHowItWorks } from '@/components/LandingHowItWorks';
import { LandingTestimonials } from '@/components/LandingTestimonials';
import { LandingAbout } from '@/components/LandingAbout';
import { LandingFooter } from '@/components/LandingFooter';
import { LandingHeader } from '@/components/LandingHeader';

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w <= 280 && h <= 340) {
      window.location.replace('/watch');
    }
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      router.push('/discover');
    }
  }, [user, isLoading, router]);

  if (isLoading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-3 px-6">
          <Image
            src="/logo-dark.png"
            alt="Harmonix"
            width={586}
            height={695}
            className="h-28 w-auto animate-pulse sm:h-32"
            priority
          />
        </div>
      </div>
    );
  }

  return (
    <div className="landing-container">
      <LandingHeader />

      <main className="landing-main">
        <LandingHero />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingTestimonials />
        <LandingAbout />
      </main>

      <LandingFooter />
    </div>
  );
}

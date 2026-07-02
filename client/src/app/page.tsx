'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Image from 'next/image';
import { LandingHero } from '@/components/LandingHero';
import { LandingFeatures } from '@/components/LandingFeatures';
import { LandingTestimonials } from '@/components/LandingTestimonials';
import { LandingFooter } from '@/components/LandingFooter';
import { LandingHeader } from '@/components/LandingHeader';
import { isCapacitorNative } from '@/lib/capacitor';

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const nativeApp = isCapacitorNative();

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
    if (nativeApp) {
      router.replace(user ? '/dashboard' : '/login');
      return;
    }
    if (user) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router, nativeApp]);

  if (isLoading || user || nativeApp) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-3">
          <Image src="/logo.png" alt="Harmonix" width={2816} height={1536} className="h-12 w-auto animate-pulse" />
          <p className="text-xl font-medium animate-pulse uppercase tracking-widest italic font-black">Harmonix</p>
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
        <LandingTestimonials />
      </main>

      <LandingFooter />
    </div>
  );
}

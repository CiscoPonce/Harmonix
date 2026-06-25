'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import Image from 'next/image';
import { LandingHero } from '@/components/LandingHero';
import { LandingFeatures } from '@/components/LandingFeatures';
import { LandingTestimonials } from '@/components/LandingTestimonials';
import { LandingFooter } from '@/components/LandingFooter';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HarmonixWordmark } from '@/components/HarmonixWordmark';

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  if (isLoading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-black">
        <div className="flex flex-col items-center gap-3">
          <Image src="/logo.png" alt="Harmonix" width={2816} height={1536} className="h-12 w-auto animate-pulse" />
          <p className="text-xl font-medium animate-pulse uppercase tracking-widest italic font-black">Harmonix</p>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-container">
      {/* Landing Navigation */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <HarmonixWordmark href="/" showTagline />

          <div className="landing-nav-links hidden lg:flex">
            <a href="#features" className="landing-nav-link">Features</a>
            <a href="#how-it-works" className="landing-nav-link">How It Works</a>
            <a href="#testimonials" className="landing-nav-link">Testimonials</a>
            <a href="#about" className="landing-nav-link">About</a>
          </div>

          <div className="landing-nav-actions">
            <ThemeToggle />
            <Link href="/login" className="landing-btn-outline">
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      <main className="landing-main">
        <LandingHero />
        <LandingFeatures />
        <LandingTestimonials />
      </main>

      <LandingFooter />
    </div>
  );
}

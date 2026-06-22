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
          <Image src="/logo.png" alt="Harmonix" width={48} height={48} className="animate-pulse" />
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
          <Link href="/" className="landing-logo-link">
            <Image src="/logo.png" alt="Harmonix Logo" width={32} height={32} />
            <div className="landing-logo-text">
              <span className="landing-logo-name">Harmonix</span>
              <span className="landing-logo-sub">Learn Words Through Music</span>
            </div>
          </Link>
          
          <div className="landing-nav-links hidden md:flex">
            <a href="#features" className="landing-nav-link">Features</a>
            <a href="#how-it-works" className="landing-nav-link">How It Works</a>
            <a href="#testimonials" className="landing-nav-link">Testimonials</a>
            <a href="#about" className="landing-nav-link">About</a>
          </div>

          <div className="landing-nav-actions">
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

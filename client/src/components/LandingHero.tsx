'use client';

import Image from 'next/image';
import Link from 'next/link';

export function LandingHero() {
  return (
    <section className="landing-hero">
      {/* Gradient blobs */}
      <div className="landing-blob landing-blob-1" />
      <div className="landing-blob landing-blob-2" />
      <div className="landing-blob landing-blob-3" />

      <div className="landing-hero-inner">
        {/* Left side - Content */}
        <div className="landing-hero-content">
          <div className="landing-hero-logo-block">
            <Image src="/logo.png" alt="Harmonix" width={2816} height={1536} priority className="landing-hero-logo-img" />
            <div className="landing-hero-logo-text">
              <h2 className="landing-hero-brand">Harmonix</h2>
              <p className="landing-hero-tagline">Learn Words Through Music</p>
            </div>
          </div>

          <h1 className="landing-hero-headline">
            Master Vocabulary<br />
            <span className="landing-hero-headline-accent">with Every Beat</span>
          </h1>

          <p className="landing-hero-subtext">
            Unlock language through rhythm and melody. Turn your favorite songs into powerful learning tools.
          </p>

          <div className="landing-hero-actions">
            <Link href="/register" className="landing-btn-primary">
              Get Started Free
            </Link>
            <Link href="#features" className="landing-btn-ghost">
              Watch How It Works
            </Link>
          </div>
        </div>

        {/* Right side - Phone mockup */}
        <div className="landing-hero-visual">
          <div className="landing-phone-mockup">
            <div className="landing-phone-notch" />
            <div className="landing-phone-screen">
              {/* Mini player UI simulation */}
              <div className="landing-phone-header">
                <span className="landing-phone-chevron">‹</span>
                <div className="landing-phone-header-text">
                  <p className="landing-phone-title">Bohemian Rhapsody</p>
                  <p className="landing-phone-artist">Queen</p>
                </div>
              </div>
              <div className="landing-phone-cover">
                <div className="landing-phone-cover-gradient" />
                <div className="landing-phone-cover-icon">♪</div>
              </div>
              <div className="landing-phone-progress">
                <div className="landing-phone-progress-bar">
                  <div className="landing-phone-progress-fill" />
                </div>
                <div className="landing-phone-times">
                  <span>0:12</span>
                  <span>0:30</span>
                </div>
              </div>
              <div className="landing-phone-controls">
                <span>⏮</span>
                <span className="landing-phone-play">▶</span>
                <span>⏭</span>
              </div>
            </div>
            {/* Floating vocab popover - top */}
            <div className="landing-popover landing-popover-1">
              <span className="landing-popover-word">MELANCHOLY</span>
              <p className="landing-popover-def">A deep sadness or gloom; a pensive mood</p>
            </div>
            {/* Floating vocab popover - bottom */}
            <div className="landing-popover landing-popover-2">
              <span className="landing-popover-word">GALILEO</span>
              <p className="landing-popover-def">Reference to the famous astronomer in the lyrics</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

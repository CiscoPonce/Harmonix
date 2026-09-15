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
            {/* Theme-aware transparent logos */}
            <Image
              src="/logo-light.png"
              alt="Harmonix — Learn Words Through Music"
              width={1024}
              height={558}
              priority
              className="landing-hero-logo-img dark:hidden"
            />
            <Image
              src="/logo-dark.png"
              alt="Harmonix — Learn Words Through Music"
              width={1024}
              height={558}
              priority
              className="landing-hero-logo-img hidden dark:block"
            />
          </div>

          <h1 className="landing-hero-headline">
            Learn real words<br />
            <span className="landing-hero-headline-accent">from real songs</span>
          </h1>

          <p className="landing-hero-subtext">
            Each day Harmonix finds a Word of the Day in actual lyrics. Hear it, see the line, then save it to your library.
          </p>

          <div className="landing-hero-actions">
            <Link href="/register" className="landing-btn-primary">
              Get Started Free
            </Link>
            <a href="#how-it-works" className="landing-btn-ghost">
              Watch How It Works
            </a>
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
                  <p className="landing-phone-title">Word of the Day</p>
                  <p className="landing-phone-artist">Échame La Culpa</p>
                </div>
              </div>
              <div className="landing-phone-cover">
                <Image
                  src="/hero-album-cover.jpg"
                  alt="Bohemian Rhapsody Cover"
                  fill
                  className="object-cover"
                  priority
                />
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
              <span className="landing-popover-word">CULPA</span>
              <p className="landing-popover-def">Blame, fault — from a real Spanish lyric</p>
            </div>
            {/* Floating vocab popover - bottom */}
            <div className="landing-popover landing-popover-2">
              <span className="landing-popover-word">Hear it</span>
              <p className="landing-popover-def">Tap for pronunciation, then a 30s song clip</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

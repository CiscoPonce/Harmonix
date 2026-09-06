'use client';

import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/contact';

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer-inner">
        <div className="landing-footer-links">
          <a href={SUPPORT_MAILTO} className="landing-footer-link">Support</a>
          <a href="/privacy" className="landing-footer-link">Privacy</a>
          <a href="/terms" className="landing-footer-link">Terms</a>
        </div>
        <p className="landing-footer-contact">
          Contact:{' '}
          <a href={SUPPORT_MAILTO} className="underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
      <div className="landing-footer-copyright">
        <p>Harmonix &copy; 2026. Learn Words Through Music.</p>
      </div>
    </footer>
  );
}

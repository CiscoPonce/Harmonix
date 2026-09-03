import Link from 'next/link';
import { LandingHeader } from '@/components/LandingHeader';
import { LandingFooter } from '@/components/LandingFooter';

export default function TermsPage() {
  return (
    <div className="landing-container">
      <LandingHeader />
      <main className="landing-main mx-auto max-w-2xl px-6 py-16 text-[#F2F5F3]">
        <h1 className="font-display text-4xl font-bold italic">Terms of use</h1>
        <p className="mt-2 text-sm text-[#9AABA0]">Last updated 3 September 2026</p>
        <div className="mt-8 space-y-4 text-sm leading-relaxed text-[#D5DDD8]">
          <p>
            Harmonix is provided as-is for language learning with licensed 30-second
            previews and, when you connect Spotify Premium, in-app clips on the web.
            You must not use the service to copy or redistribute full tracks or
            lyrics beyond what the app displays for learning.
          </p>
          <p>
            See the{' '}
            <Link href="/privacy" className="underline">
              privacy policy
            </Link>{' '}
            for how account and Spotify data is stored. Contact: info@harmonix.app.
          </p>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}

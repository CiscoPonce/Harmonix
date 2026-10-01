import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/contact';

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="1 October 2026">
      <p>
        These terms cover the Harmonix website and the Harmonix Android app. By
        creating an account or keeping one, you agree to them.
      </p>

      <h2>The service</h2>
      <p>
        Harmonix teaches vocabulary from real song lyrics. Audio in the app is a
        short preview, about 30 seconds, from Deezer or iTunes. On the website,
        a connected Spotify Premium account can play a clip. We do not give you
        the full song file.
      </p>

      <h2>Your account</h2>
      <p>
        You need an account to save words. You are responsible for the email and
        password on that account. You must be 13 or older.
      </p>

      <h2>Music and lyrics</h2>
      <p>
        Lyrics are shown so you can learn a word in context. Do not copy,
        download, or redistribute full tracks or lyric files, and do not use
        Harmonix to build a music library. Previews and lyric lines stay inside
        the learning screens.
      </p>

      <h2>Spotify</h2>
      <p>
        Connecting Spotify is optional. You must follow Spotify&apos;s own terms
        for that account. You can disconnect at any time in Settings. Playlist
        export uses the account you connect.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Do not try to break into another account, scrape the site, or overload
        it. Do not use pronunciation or translations to impersonate someone.
      </p>

      <h2>Changes</h2>
      <p>
        The app and these terms can change as the product changes. The date at
        the top of this page is the latest version. If you keep using Harmonix
        after that date, the new terms apply.
      </p>

      <h2>Contact</h2>
      <p>
        Questions:{' '}
        <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>. See the{' '}
        <Link href="/privacy">privacy policy</Link> for what we store and how to
        delete an account.
      </p>
    </LegalPage>
  );
}

import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';
import { SUPPORT_EMAIL, SUPPORT_MAILTO, SITE_ORIGIN } from '@/lib/contact';

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="8 November 2026">
      <p>
        Harmonix teaches vocabulary from real song lyrics. This policy covers the
        website at{' '}
        <Link href={SITE_ORIGIN}>harmonix.peeporunclub.co.uk</Link> and the
        Harmonix Android app.
      </p>

      <h2>Account</h2>
      <p>When you create an account we store:</p>
      <ul>
        <li>your email address</li>
        <li>a hashed password — never the password itself</li>
        <li>an optional username, short bio, and optional account photo if you choose to add them in Settings (stored privately for your account, never shown publicly, and removable at any time)</li>
        <li>the language you are learning, your home language, and your music style</li>
        <li>voice and display choices, including the dyslexia-friendly font</li>
        <li>learning progress: words, lyric lines, reviews, streaks, playlists, and badges</li>
      </ul>
      <p>
        We use this to sign you in, choose songs in your language and style, and
        show the words you have already learned. We record simple usage events,
        such as opening the app, getting a word, or sharing a postcard, to see
        which features help people learn. They don&apos;t include your email or
        what you type.
      </p>

      <h2>Music, lyrics, and Spotify</h2>
      <p>
        Song search and 30-second previews come from Deezer, with Apple iTunes
        Search as a fallback. Synced lyrics come from LRCLib. We do not host full
        songs.
      </p>
      <p>
        If you connect Spotify we store encrypted access tokens and playlist
        details so you can export a Harmonix playlist and, on the website, play
        clips when you have Spotify Premium. You can disconnect Spotify in
        Settings. We do not sell that data and we do not use it for advertising.
      </p>

      <h2>Pronunciation</h2>
      <p>
        Hear-it sends the word and its language to a text-to-speech service on
        our servers. We cache the audio so the same word does not have to be
        spoken again. The cache is the word, the language, and the audio — not a
        recording of your voice.
      </p>

      <h2>Translations</h2>
      <p>
        To pick a word and write a short translation we may send a lyric line and
        the word to an AI provider (NVIDIA, and OpenRouter if NVIDIA is
        unavailable). We send what that translation needs. We do not send your
        password or email.
      </p>

      <h2>What we do not collect</h2>
      <p>
        We do not collect your location, contacts, or an advertising ID. We only
        store a single profile photo if you explicitly pick one in Settings (on
        Android we use the system photo picker with no gallery permissions). We
        do not show ads. We do not sell your data.
      </p>

      <h2>Children</h2>
      <p>
        Harmonix is not directed at children under 13. Do not create an account
        if you are under 13.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep account data while the account exists. You can delete your
        account directly in Settings (Delete account), or email{' '}
        <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a> from the address on the
        account and ask us to delete it. We delete the account, profile photo,
        and the learning data tied to it. Spotify tokens are removed when you
        disconnect, and again when the account is deleted.
      </p>

      <h2>Security</h2>
      <p>
        The site and the app talk to the server over HTTPS. Passwords are hashed.
        Spotify tokens are encrypted.
      </p>

      <h2>Contact</h2>
      <p>
        Questions:{' '}
        <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>. The{' '}
        <Link href="/terms">terms of use</Link> explain what you can do with the
        music and the app.
      </p>
    </LegalPage>
  );
}

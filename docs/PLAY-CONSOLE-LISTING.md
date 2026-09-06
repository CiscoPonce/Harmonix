# Play Console listing pack — Harmonix

Copy these fields into [Google Play Console](https://play.google.com/console).
Do **not** submit Production until Internal testing works on a real phone.

**Application ID:** `com.harmonix.app`  
**Version for this upload:** `1.0.8` (versionCode `11`)  
**Default language:** English (UK)  
**Type:** App · **Price:** Free  
**Contact / support:** `hello@peeporunclub.co.uk`  
**Privacy:** https://harmonix.peeporunclub.co.uk/privacy  
**Terms:** https://harmonix.peeporunclub.co.uk/terms

---

## 1. Store listing

**App name:** Harmonix

**Short description** (≤80 characters):

```
Learn a new word from real song lyrics — hear it, flip it, remember it.
```

**Full description:**

```
Harmonix teaches vocabulary through the lyrics of songs you already love.

Search a track. Harmonix picks a meaningful word from the lyric line, shows a clear translation, and lets you hear a short preview so the word sits in the music — not a word list.

• Word of the Day from real, synced lyrics
• Search a song and learn a word from that track
• Hear a 30-second preview (Apple / Deezer) — never a full song in-app
• Tap to flip the card and see the line in context
• Pronunciation via on-device-quality TTS
• Optional Spotify connect to export playlists and, on the web, play clips if you have Premium
• Practice strip and a simple daily goal

Languages: learn English, Spanish, French, German, Portuguese or Italian, with the app UI in your home language.

Audio is limited to licensed 30-second previews for language learning. Full tracks open in Spotify or your music app.

Questions: hello@peeporunclub.co.uk
Privacy: https://harmonix.peeporunclub.co.uk/privacy
```

---

## 2. Graphics (upload from the repo)

| Asset | File | Size |
|-------|------|------|
| App icon | `mobile/store/app-icon-512.png` | 512×512 PNG |
| Feature graphic | `mobile/store/feature-graphic.png` | 1024×500 PNG |
| Phone screenshots | Take 2–4 from the emulator or a device (Discover card, search, flipped card, Settings) | Phone |

Screenshots are the one asset this repo cannot invent honestly — capture them after login.

---

## 3. Data safety (form answers)

| Question | Answer |
|----------|--------|
| Does the app collect data? | **Yes** |
| Email | Collected · Account management · Required for app |
| App activity (words learned, reviews) | Collected · App functionality · Required |
| Audio files | Ephemeral TTS / 30s previews — **not** sold, not used for ads |
| Location / contacts / photos | **No** |
| Device IDs / advertising ID | **No** |
| Encrypted in transit | **Yes** (HTTPS) |
| Encrypted at rest | Yes (passwords hashed; Spotify tokens encrypted) |
| Data sold | **No** |
| Data shared with third parties for ads | **No** |
| Users can request deletion | **Yes** — email `hello@peeporunclub.co.uk` from the account address |

---

## 4. Content rating & declarations

- Target age: **13+** (accounts + music lyrics; no UGC chat)
- Not a news app
- Not a government app
- Contains music (licensed previews only)
- No ads
- In-app purchases: **No**

---

## 5. App access (reviewers)

Play reviewers must reach Discover after login.

1. Create a dedicated reviewer account on the live site (or register in-app).
2. Play Console → **App content → App access** → add that email + password.
3. Leave a note:

```
Log in with the credentials above. Home is Discover.
Search “Hey Jude”, tap the first result, flip the card.
Hear it plays a 30-second preview (Apple/iTunes when Deezer is unavailable).
Spotify Connect is optional and limited to testers on the Spotify developer allowlist until Extended Quota is approved.
```

---

## 6. What you do in Console (order)

1. Pay the $25 Play developer fee if the account is new.
2. **Create app** → Harmonix / English (UK) / App / Free.
3. Store listing: paste the copy + upload icon + feature graphic + screenshots.
4. Privacy policy URL + Data safety + Content rating.
5. One-time on your machine (not in git): create `mobile/android/upload-keystore.jks` and `key.properties` — see `mobile/PLAY-STORE.md`.
6. Build the signed AAB (needs JDK 17):

```bash
cd mobile
flutter build appbundle --release \
  --dart-define=API_BASE=https://harmonix.peeporunclub.co.uk/api
```

7. **Testing → Internal testing** → create a release → upload the AAB → add tester Gmail addresses.
8. Testers install from the Internal testing link (not a sideload debug APK).
9. Only after Internal testing is green: Production.

---

## 7. Still blocked until you do it locally

This environment has Flutter but **no JDK**, so the signed AAB cannot be built here. You need:

- Android Studio / JDK 17
- `keytool` keystore (back up the `.jks` + passwords offline — lose them and you cannot update the listing)
- 2–4 phone screenshots
- A reviewer login you created
- Spotify Extended Quota only when people besides you must use Connect

🎵 Harmonix - Project State Document
Version: 3.1 (AI-First, Open-Source SaaS)
Last Updated: June 13, 2026
License: MIT (Open Core Model)
Status: MVP Development Phase (Web PWA)
Executive Summary
Harmonix is a language learning platform that teaches vocabulary through song lyrics. Instead of relying on a massive, pre-populated database, Harmonix utilizes an AI-First Architecture. An AI Agent generates personalized daily vocabulary on-the-fly based on user preferences, which is then strictly validated against real music APIs to ensure 100% accuracy. 
The project is built as an Open-Source MIT licensed initiative, deployed on an existing private VPS. The MVP will launch as a Progressive Web App (PWA) to validate the concept before expanding to native Android and Wear OS applications. Target languages for launch are English, French, and Spanish.
🎯 Core Value Proposition

    Contextual Learning: Learn languages through the music you love (Easy Spanish Rock, Medium French Pop, Hard English Indie).
    AI-Personalized: Infinite, dynamically generated content tailored to the user's exact proficiency level.
    Zero-Friction MVP: Accessible instantly via the web, installable as a PWA, with native mobile apps to follow.
    Open & Transparent: Core codebase is open-source (MIT), building trust and community.

🏛️ System Architecture: The 6 Pillars
The architecture is designed following enterprise-grade system design principles, adapted for a zero-budget, high-efficiency VPS deployment.
1. Monolith & Database Decoupling (Stateless Clients)

    Concept: Separate application logic from data storage to ensure data persistence and stateless scaling.
    Harmonix Implementation: The Frontend (Web PWA / Future Flutter App) is completely stateless regarding core data. It requests the "Daily Word" from the VPS API, displays it, and caches only that specific day's payload locally for offline viewing. If the client crashes, no core data is lost.

2. Scaling & Load Balancing

    Concept: Distributing traffic across multiple servers to prevent overload.
    Harmonix Implementation: For the MVP, the existing private VPS handles traffic. As the user base scales, Nginx acts as a reverse proxy and load balancer. We can horizontally scale by spinning up identical VPS instances behind Nginx, routing traffic via Round Robin or Least Connections without changing the client code.

3. Microservices & API Gateway

    Concept: Breaking a monolith into specialized services behind a single entry point.
    Harmonix Implementation: The VPS backend (Node.js/Express or Python/FastAPI) acts as the API Gateway. It routes requests to modular internal handlers:
        Auth Module: Handles JWT user authentication.
        AI Agent Module: Handles NVIDIA NIM API prompts.
        Validator Module: Handles LRCLib/Deezer API checks.
        Cache Module: Handles SQLite read/writes.

4. Handling Large Files & Async Events (Object Storage)

    Concept: Bypassing backend servers for large file transfers using pre-signed URLs.
    Harmonix Implementation: We never stream full audio files through our VPS. 
        Audio: The backend fetches a 30-second MP3 preview URL from Deezer/iTunes and sends the direct link to the client. The client streams directly from the CDN.
        Future UGC (User Generated Content): When users upload profile pictures or custom lyric snippets, the backend generates a secure pre-signed URL, allowing the client to upload directly to an S3 bucket, bypassing the VPS CPU/RAM entirely.

5. Optimizing Performance: Caching & CDNs

    Concept: Reducing database load and latency using in-memory caches and edge servers.
    Harmonix Implementation:
        Database Caching: SQLite acts as a local cache. Validated songs and daily words are stored for 24 hours to prevent redundant AI and API calls.
        Client Caching: The PWA uses Service Workers to cache the UI shell and the daily JSON payload, allowing offline access.
        CDN: All static assets and external audio previews are served via global CDNs (Deezer's CDN, Cloudflare for our VPS).

6. Rate Limiting

    Concept: Protecting infrastructure from abuse and API quota exhaustion.
    Harmonix Implementation: The API Gateway implements strict rate limiting (e.g., via express-rate-limit). 
        User Level: Limits login attempts and word generation requests to prevent spam.
        Outbound Level: Limits how often the VPS queries NVIDIA NIM and LRCLib, ensuring we never hit external API rate limits. Returns 429 Too Many Requests when thresholds are breached.

🛠️ Technology Stack
Component
	
Technology
	
Justification
Backend
	
Node.js (Express) or Python (FastAPI)
	
Lightweight, excellent API support, easy VPS deployment.
Database
	
SQLite (or PocketBase)
	
Zero-config, file-based, perfect for MVP scale.
AI Engine
	
NVIDIA NIM / API Catalog (Free Tier)
	
100% free inference endpoints (Llama 3, Mistral). OpenAI-compatible SDK.
Frontend (MVP)
	
Next.js / React + Vite (PWA)
	
Fast development, native PWA/Service Worker support.
Frontend (Phase 2)
	
Flutter
	
Single codebase for Android Phone and Wear OS.
Web Server
	
Nginx
	
Reverse proxy, SSL termination, load balancing.
External APIs
Service
	
Purpose
	
Cost
	
Notes
NVIDIA NIM
	
AI Content generation
	
$0 (Free Tier)
	
OpenAI-compatible endpoints. No credit card required.
LRCLib
	
Lyrics database
	
Free
	
Community-driven, no API key required.
Deezer/iTunes
	
30s audio previews
	
Free
	
Direct MP3 URLs for web playback.
Spotify Web API
	
Deep linking & metadata
	
Free
	
Opens full song in Spotify app.
Core Data Flow: The AI Agent + Validator
To prevent AI hallucinations (fake songs/lyrics), we use a strict Generate -> Validate -> Inject loop.

text
1. User opens app -> Frontend calls GET /api/daily-word
         │
         ▼
2. Backend checks SQLite Cache: "Word generated for this user today?"
   ├─ YES -> Return cached JSON.
   └─ NO  -> Proceed to AI Generation.
         │
         ▼
3. AI Agent (NVIDIA NIM): Prompted with user profile (e.g., "French Pop, Medium").
   Returns JSON: { song_title, artist, target_word, translation }.
         │
         ▼
4. Validator Layer: 
   ├─ Query LRCLib API with song_title + artist. (404? -> Retry AI).
   └─ Query Deezer API for audio preview URL. (404? -> Retry AI).
         │
         ▼
5. Real Lyric Injection: 
   Backend fetches actual lyrics from LRCLib, extracts the snippet containing the target_word.
         │
         ▼
6. Save to SQLite Cache -> Return verified JSON to Frontend.
API Response Schema

json
{
  "date": "2026-06-13",
  "word": {
    "text": "Étoile",
    "translation": "Star",
    "part_of_speech": "noun",
    "pronunciation": "/e.twal/",
    "difficulty": "medium"
  },
  "lyric": {
    "snippet": "Tu es mon étoile dans la nuit...",
    "timestamp": "1:23"
  },
  "song": {
    "title": "Étoile",
    "artist": "Indila",
    "genre": "French Pop"
  },
  "audio": {
    "preview_url": "https://cdns-preview-e.dzcdn.net/stream/...",
    "duration_seconds": 30
  },
  "links": {
    "spotify_uri": "spotify:track:3xKsf9qdS1CyvXSMEid6g8"
  }
}
🗄️ Database Schema (Lightweight SQLite)

sql
-- User Profiles
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    target_language TEXT DEFAULT 'es', -- 'en', 'fr', 'es'
    difficulty TEXT DEFAULT 'easy',
    genre TEXT DEFAULT 'rock',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Daily Word Cache (Prevents redundant AI/API calls)
CREATE TABLE daily_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    date TEXT UNIQUE NOT NULL,
    word_json TEXT NOT NULL,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Learning History (Tracks progress for AI personalization)
CREATE TABLE learning_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    word TEXT NOT NULL,
    date TEXT NOT NULL,
    is_learned BOOLEAN DEFAULT FALSE,
    review_count INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Song Cache (Stores validated API responses)
CREATE TABLE song_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_title TEXT NOT NULL,
    artist TEXT NOT NULL,
    lyrics_snippet TEXT,
    audio_preview_url TEXT,
    spotify_uri TEXT,
    last_fetched DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(song_title, artist)
);
💼 Business & Licensing Strategy (MIT Open Core)
The MIT License Approach
The core codebase is released under the MIT License. This allows anyone to view, fork, and use the code. However, we protect our commercial viability through the Open Core / SaaS model:

    Sell the Hosted Service: Anyone can self-host the code, but 99% of users will pay $2.99/mo to avoid managing a VPS, SSL certificates, and configuring NVIDIA API keys.
    Sell the Mobile Experience: The Web PWA is free and open-source. The native Android and Wear OS apps (built in Flutter) will be distributed via the Google Play Store (requiring a one-time $25 developer fee).
    Proprietary Premium Features: Advanced Spaced Repetition (SRS) algorithms, offline audio downloading, and commercial API integrations (LyricFind) will be kept in private, proprietary repositories.

Legal & Copyright Disclaimer
The MIT license applies strictly to the source code. Song lyrics and music metadata are the property of their respective copyright holders. This software is designed for educational and personal use. For commercial distribution, the platform will transition to licensed APIs (e.g., LyricFind) or a User-Generated Content (UGC) model with DMCA safe harbor compliance.
⚠️ Risk Assessment & Mitigations
Risk
	
Impact
	
Mitigation Strategy
AI Hallucinations
	
Fake songs break the app.
	
Validator Layer: AI output is strictly checked against LRCLib/Deezer APIs. Auto-retries on 404.
Copyright Infringement
	
Legal action from labels.
	
Limit snippets to <15 words (Fair Use). Link to official sources. Transition to licensed APIs post-revenue.
API Rate Limits
	
App breaks during traffic spikes.
	
Aggressive SQLite caching. Exponential backoff. Rate limiting middleware on the VPS.
VPS Downtime
	
Single point of failure.
	
Automated daily SQLite backups. Nginx health checks. Future horizontal scaling via load balancer.
App Store Rejection
	
Google rejects "simple" apps.
	
Build robust learning mechanics (quizzes, SRS, progress tracking) to qualify as an educational tool.
🗺️ Development Roadmap
Phase 1: Backend Foundation (Weeks 1-2)

    Configure existing VPS (Nginx, SSL, Node.js/Python environment).
    Initialize SQLite database and run schema.
    Implement JWT user authentication.
    Build AI Agent integration (NVIDIA NIM Free Tier).
    Implement Validator logic (LRCLib + Deezer APIs).
    Create /api/daily-word endpoint with caching.

Phase 2: Web App Frontend (Weeks 3-4)

    Initialize Next.js/React project with PWA support.
    Design dark-mode UI (matching mockups).
    Build Daily Word display and HTML5 audio player.
    Add "Open in Spotify" deep link.
    Configure Web Push Notifications (Firebase/Web Push API).

Phase 3: Testing & Validation (Weeks 5-6)

    Deploy to production VPS.
    Beta test with 20-50 users.
    Monitor AI hallucination rate and API latency.
    Iterate on AI prompts for better pedagogical pacing.

Phase 4: Mobile App Development (Weeks 7-10)

    Set up Flutter environment.
    Build Android Phone UI and Wear OS companion app.
    Implement native push notifications and background sync.
    Test on physical devices.

Phase 5: Commercial Launch (Weeks 11-12)

    Integrate RevenueCat for subscriptions.
    Implement premium features (unlimited words, offline mode).
    Purchase Google Play Developer account ($25).
    Submit to Google Play Store and launch marketing.

💰 Cost Analysis (Zero-Budget MVP)
Service
	
Monthly Cost
	
Notes
VPS Hosting
	
$0.00
	
Utilizing existing private VPS.
AI Engine
	
$0.00
	
NVIDIA NIM / API Catalog (Free Tier).
External APIs
	
$0.00
	
LRCLib, Deezer, iTunes (Free tiers).
Domain Name
	
~$1.00
	
Amortized ~$12/year for .com.
Total
	
~$1.00 / mo
	
Can support 1,000+ active users.
Break-even point: 1 paying subscriber at $2.99/month covers the domain name.
✍️ Author Notes
This document represents the current state of the Harmonix project. By leveraging an existing VPS and NVIDIA's free AI inference endpoints, the project achieves a true zero-budget infrastructure while maintaining enterprise-grade architecture. The focus on English, French, and Spanish provides a massive global addressable market for the MVP.
Key Philosophy: Build the simplest thing that works. Validate with real users via the Web PWA before investing in native mobile apps. Let AI handle content curation, but always validate with real APIs to ensure quality.

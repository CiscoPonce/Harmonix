# LyricWord

AI-first language learning through real music lyrics. Validated vocabulary extraction + spaced repetition tied to actual songs.

## Stack

- Backend: Node.js + Express + SQLite
- Frontend: Next.js 16 App Router
- AI: NVIDIA NIM (`stepfun-ai/step-3.7-flash`)
- Data: LRCLib, Deezer

## Repo layout

- `server/` Express API, SQLite DB, business logic
- `client/` Next.js frontend

## Quickstart

```bash
cd server
cp .env.example .env
npm install
npm start

cd ../client
cp .env.example .env
npm install
npm run dev
```

Then open the client URL (default Next.js) and the backend (default `:3001`).

## Tests

```bash
cd server
npm test
```

## Key rules

- Validation first: AI output is verified against external metadata before the UI sees it.
- Audio previews stay short (copyright limitation).
- Dark-mode minimalist UI.

## Notes for a GitHub push

- `.env`, SQLite DB files, log files, local planning docs, and temp app secrets are ignored by `.gitignore`.
- No CI is configured yet.
- No LICENSE file is included yet.



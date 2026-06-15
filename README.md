# WordWave

AI-first language learning through real music lyrics. Validated vocabulary extraction + spaced repetition tied to actual songs.

## Stack

- **Backend:** Node.js + Express + SQLite
- **Frontend:** Next.js 16 App Router
- **AI:** NVIDIA NIM (`stepfun-ai/step-3.7-flash`)
- **Data:** LRCLib, Deezer

## Repo Layout

- `server/`: Express API, SQLite DB, business logic
- `client/`: Next.js frontend

## Quickstart

### Backend
```bash
cd server
cp .env.example .env
npm install
npm start
```

### Frontend
```bash
cd client
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

## Key Rules

- **Validation First:** AI output is verified against external metadata before the UI sees it.
- **Audio Previews:** Stay short due to copyright limitations.
- **UI:** Dark-mode minimalist design.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.



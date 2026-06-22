# Harmonix

Learn Words Through Music. AI-first language learning through real music lyrics. Validated vocabulary extraction + spaced repetition tied to actual songs.

![Harmonix Logo](./logoharmonix.png)

## Features

- **Word of the Day**: Get one personalized word, hear it in a real song lyric, then dive deeper.
- **Song Search**: Search any song or artist to extract and learn vocabulary from its lyrics.
- **Audio Previews**: Hear the exact moment in the song where the word is sung.
- **Progress Tracking**: Keep your streaks alive and track your daily vocabulary progress.
- **Dynamic Themes**: Minimalist UI with full support for Light and Dark modes.

## Stack

- **Backend:** Node.js + Express + SQLite
- **Frontend:** Next.js 16 App Router (React)
- **Styling:** Tailwind CSS v4
- **AI:** NVIDIA NIM
- **Data:** LRCLib, Deezer

## Repo Layout

- `server/`: Express API, SQLite DB (`harmonix.db`), business logic
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

Then open the client URL (default Next.js `:3009`) and the backend (default `:3001`).

## Tests

```bash
cd server
npm test
```

## Key Rules

- **Validation First:** AI output is verified against external metadata before the UI sees it.
- **Audio Previews:** Stay short due to copyright limitations.
- **UI:** Dynamic Light/Dark-mode minimalist design.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

# Architecture diagrams

Dark-mode overviews of how Harmonix is wired. PNG previews render on GitHub; SVG sources are editable in any browser or VS Code.

**Product surfaces (2026-07-22):** Next.js web + Flutter Android → Express `:3001` + SQLite; Deezer, LRCLib, NVIDIA/OpenRouter, Spotify, Pocket-TTS `:3002`.  
**IA:** Discover (home) · Library · Settings. See [`.planning/ROADMAP.md`](../../.planning/ROADMAP.md).

## Backend architecture

VPS layout: Express gateway, routes, services, SQLite, Next.js proxy, external APIs.

![Harmonix backend architecture](./backend-architecture.png)

Sources: [backend-architecture.svg](./backend-architecture.svg) · [backend-architecture.png](./backend-architecture.png)

## App flow (AI + APIs)

Client screens, API calls, NVIDIA NIM, Deezer/LRCLib, validation, and SQLite cache.

![Harmonix app flow](./app-flow.png)

Sources: [app-flow.svg](./app-flow.svg) · [app-flow.png](./app-flow.png)


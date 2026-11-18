# CheckMate Arena

[![CI](https://github.com/Ashu-1104/checkmate-arena/actions/workflows/ci.yml/badge.svg)](https://github.com/Ashu-1104/checkmate-arena/actions/workflows/ci.yml)

Real-time multiplayer chess in the browser — play friends with an invite link, spectate and chat in live games, and track your stats with an optional account.

<p align="center">
  <img src="./assets/demo.jpg" alt="CheckMate Arena" width="640" />
</p>

## Features

- **Real-time multiplayer** over Server-Sent Events, with spectators and in-game chat; runs on serverless hosts such as Vercel
- **Time controls and chess clocks** from 1+0 bullet to 15+10 rapid; the server keeps the authoritative clock, applies increments and ends games on time
- **Resign and draw offers**, validated on the server (moving declines a pending offer)
- **Elo ratings and a leaderboard** for registered players, with rating changes shown after each game
- **Play vs Computer** against the Stockfish engine at 8 difficulty levels, running in a Web Worker in the browser
- Optional user accounts with stats, profiles and game history
- Game archive with move-by-move review
- Mobile-friendly, light and dark themes

## Tech stack

Next.js 14, React, TypeScript, Tailwind CSS + daisyUI, react-chessboard, chess.js, Stockfish (WebAssembly), Node.js, Express.js, Server-Sent Events, PostgreSQL, Vitest and GitHub Actions, in a pnpm workspace monorepo:

- `client` — Next.js front-end
- `server` — Node.js/Express API and real-time game server
- `types` — type definitions shared by the client and server

## Development

> Node.js 20 or newer is required.

1. Install [pnpm](https://pnpm.io/installation) and run `pnpm install` in the project root.
2. Create `server/.env` with your PostgreSQL connection:
   ```env
   PGHOST=localhost
   PGUSER=checkmate
   PGPASSWORD=checkmate
   PGDATABASE=checkmate
   ```
3. Start both servers with `pnpm dev` (or `pnpm dev:client` / `pnpm dev:server`).
4. Open http://localhost:3000 — the API runs on http://localhost:3001.

Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SITE_URL` in the client environment when deploying.

## Real-time play

Games in progress are stored in PostgreSQL (`live_game`), not in server memory, so any server instance can handle any request:

- Players send moves, chat and draw offers as `POST /v1/live/:code/:action`. Each action runs in a transaction that locks the game, so simultaneous moves are applied one at a time.
- Each browser tab keeps a Server-Sent Events stream open (`GET /v1/live/:code/events`). It delivers the events written by those actions (`live_event`) and records the tab's presence (`live_presence`), which is how players see whether their opponent is connected.
- Clocks have no server timers: a flag that has fallen is detected the next time the game is touched, including by any open stream, about once a second.
- Streams close after a few minutes, and the browser reopens them and resumes from the last event it received.

## Deploying to Vercel

`vercel.json` deploys both apps as one Vercel project with [Services](https://vercel.com/docs/services): the Next.js client serves the site and `/v1/*` goes to the Express API (`server/src/app.ts`), so both share one domain and the session cookie.

1. Import the repository in Vercel and add a Postgres database (**Storage → Neon**), which sets `DATABASE_URL`. Tables are created on first use.
2. Set `SESSION_SECRET` (a long random string), `NODE_ENV=production`, and `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SITE_URL` to the site's URL, for example `https://your-app.vercel.app`.
3. Deploy.

## Testing

```sh
pnpm test                                  # unit tests (server + client)
pnpm --filter server build
pnpm --filter server test:integration      # needs PostgreSQL via PG* env vars
```

The integration tests start the real server and play games over the HTTP actions and event streams, including a game ending on time. CI runs lint, builds and every test against a PostgreSQL service on each push and pull request.

## Third-party software

Play vs Computer uses [Stockfish](https://stockfishchess.org) via [stockfish.js](https://github.com/niklasf/stockfish.js), licensed under the GPLv3. The engine is copied unmodified into `client/public/engine` at install time and runs as a separate Web Worker; its license is served alongside it.

## License

[MIT](./LICENSE)

# KnightLink

Real-time multiplayer chess in the browser — play friends with an invite link, spectate and chat in live games, and track your stats with an optional account.

<p align="center">
  <img src="./assets/demo.jpg" alt="KnightLink" width="640" />
</p>

## Features

- Real-time games between players over WebSockets (Socket.IO)
- Spectate and chat in ongoing games
- Optional user accounts with stats and game history
- Game archive with move-by-move review
- Mobile-friendly, light and dark themes

## Tech stack

Next.js 14, React, TypeScript, Tailwind CSS + daisyUI, react-chessboard, chess.js, Node.js, Express.js, Socket.IO and PostgreSQL, in a pnpm workspace monorepo:

- `client` — Next.js front-end
- `server` — Node.js/Express API and Socket.IO game server
- `types` — type definitions shared by the client and server

## Development

> Node.js 20 or newer is required.

1. Install [pnpm](https://pnpm.io/installation) and run `pnpm install` in the project root.
2. Create `server/.env` with your PostgreSQL connection:
   ```env
   PGHOST=localhost
   PGUSER=knightlink
   PGPASSWORD=knightlink
   PGDATABASE=knightlink
   ```
3. Start both servers with `pnpm dev` (or `pnpm dev:client` / `pnpm dev:server`).
4. Open http://localhost:3000 — the API runs on http://localhost:3001.

Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SITE_URL` in the client environment when deploying.

## Credits

KnightLink is built on [chessu](https://github.com/dotnize/chessu) by nize, released under the MIT License. The original copyright notice is kept in [LICENSE](./LICENSE).

## License

[MIT](./LICENSE)

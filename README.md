Originally created on Ubuntu.

Prerequisites:

- node 24.9.0 (see .nvmrc)

# Installation

`yarn`

# Server process:

Run it: `nohup node server.js > server.log 2>&1 &`
Find it: `pgrep -af "node server.js"`
Kill it: `pkill -f "node server.js"`

### References:

https://chatgpt.com/c/687604bc-8048-800f-a6b5-e6bbb980c529

# Web API

When the server runs (`npm run dev --workspace packages/server`), the Express app listens on port 3000 by default (see `packages/server/src/config.ts`).  
Available endpoints:

- `GET /api/servers` – Summary of all tracked servers with their last snapshot timestamps.
- `GET /api/servers/:type/:host/:port/latest` – Latest snapshot (players, ping, etc.) for the specified server. Returns 404 if none are recorded.
- `GET /api/servers/:type/:host/:port/snapshots?limit=10` – Recent snapshots for the server; optional `limit` (1–100) controls the history depth.

Each endpoint responds with JSON; combine with tools like `curl` or `jq` to inspect data quickly.

The `:type`, `:host`, and `:port` placeholders correspond to the server you are tracking. For example, with the default Rust server configured in `packages/server/src/server.ts` you can request:

```
curl http://localhost:3000/api/servers/rust/136.243.18.104/28017/latest | jq
```

# Web Dashboard

The React dashboard lives in `packages/web` and is built with Vite, React, Mantine, and React Query.

- Install dependencies: `yarn install`
- Run the SPA with hot reload: `yarn dev:web` (served on http://localhost:5173, proxied to the API)
- Click a server name on the overview page to open the detail view with live player lists and charts.
- Build for production: `yarn build:web`
- Preview the production bundle: `yarn preview:web`
- Configure the API target by copying `packages/web/.env.example` to `packages/web/.env` (or export `VITE_API_URL` in the environment) and setting the URL of the deployed server before running `yarn build:web`.

# Internal URLs

These routes are intended for internal diagnostics and are not linked from the main dashboard navigation.

API:

- `GET /api/internal/database-stats` – Database table counts and aggregate size statistics.
- `GET /api/internal/player-sessions` – Aggregated player session metrics used by the internal stats UI.

Web UI:

- `/internal/database-stats` – React page that visualizes the internal database stats and player sessions (calls the API routes above).

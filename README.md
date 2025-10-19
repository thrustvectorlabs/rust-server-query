Originally created on Ubuntu.

Prerequisites:
- gamedig
- jq

# Installation

## gamedig
`$ npm install -g gamedig`

## jq
`$ sudo apt update; sudo apt install jq`

# To query a server:

## Plain JSON
gamedig --type rust --host 185.206.151.10 --port 28015

## Pretty JSON
gamedig --type rust --host 185.206.151.10 --port 28015 --pretty

## Using jq, colorizes output
gamedig --type rust --host 185.206.151.10 --port 28015 --pretty | jq

## Extract certain types of fields from the JSON
gamedig … | jq '.name, .map, .numplayers, .maxplayers'

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

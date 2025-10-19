import express from 'express';
import cors from 'cors';
import { config } from '../config.js';
import {
  getLatestSnapshot,
  getRecentSnapshots,
  listServers,
  type ServerIdentifier,
} from '../database/database.js';

const DEFAULT_SNAPSHOT_LIMIT = 10;
const MAX_SNAPSHOT_LIMIT = 100;

export const startWebServer = () => {
  const app = express();

  app.use(cors());
  app.set('json spaces', 2);

  app.get('/', (_req, res) => {
    res.send('Rust Server Query Web Server is running.');
  });

  app.get('/api/servers', (_req, res) => {
    const servers = listServers();
    res.json({ servers });
  });

  app.get('/api/servers/:type/:host/:port/snapshots', (req, res) => {
    const server = parseServerIdentifier(req.params);
    if (!server) {
      res.status(400).json({ error: 'Invalid server identifier.' });
      return;
    }

    const limit = parseLimit(req.query.limit, DEFAULT_SNAPSHOT_LIMIT, MAX_SNAPSHOT_LIMIT);
    if (limit instanceof Error) {
      res.status(400).json({ error: limit.message });
      return;
    }

    const snapshots = getRecentSnapshots(server, limit);
    res.json({ server, snapshots, limit });
  });

  app.get('/api/servers/:type/:host/:port/latest', (req, res) => {
    const server = parseServerIdentifier(req.params);
    if (!server) {
      res.status(400).json({ error: 'Invalid server identifier.' });
      return;
    }

    const snapshot = getLatestSnapshot(server);
    if (!snapshot) {
      res.status(404).json({ error: 'No snapshots found for server.', server });
      return;
    }

    res.json({ server, snapshot });
  });

  app.listen(config.webServer.port, () => {
    console.log(`Web server is listening on port ${config.webServer.port}`);
  });
};

function parseServerIdentifier(params: Record<string, unknown>): ServerIdentifier | null {
  const type = typeof params.type === 'string' && params.type.length > 0 ? params.type : null;
  const host = typeof params.host === 'string' && params.host.length > 0 ? params.host : null;
  const port = Number(params.port);

  if (!type || !host || !Number.isInteger(port) || port <= 0 || port > 65535) {
    return null;
  }

  return { type, host, port };
}

function parseLimit(
  limitQuery: unknown,
  fallback: number,
  maximum: number,
): number | Error {
  if (limitQuery === undefined) {
    return fallback;
  }

  const limit = Number(limitQuery);
  if (!Number.isInteger(limit) || limit <= 0) {
    return new Error('Query parameter "limit" must be a positive integer.');
  }

  if (limit > maximum) {
    return new Error(`Query parameter "limit" must be <= ${maximum}.`);
  }

  return limit;
}

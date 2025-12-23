import express, { type Request } from 'express';
import cors from 'cors';
import { config } from '../config.js';
import {
  getLatestSnapshot,
  getRecentSnapshots,
  listServers,
  listSnapshotQueryMetrics,
  getDatabaseStats,
  listPlayerSessionStats,
  recordSnapshotQueryMetric,
  type ServerIdentifier,
} from '../database/database.js';
import { logMessage, loggingGroups } from '../logger/logger.js';

const DEFAULT_SNAPSHOT_LIMIT = 10;
const MAX_SNAPSHOT_LIMIT = 100;

export const startWebServer = () => {
  const app = express();

  app.set('trust proxy', true);
  app.use(cors());
  app.set('json spaces', 2);

  app.use((req, _res, next) => {
    const clientIp = extractClientIp(req);
    logMessage(
      loggingGroups.WEBSERVER,
      `${req.method} ${req.originalUrl} from ${clientIp ?? 'unknown client'}`,
    );
    next();
  });

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

    recordSnapshotVisit(req);
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

    recordSnapshotVisit(req);
    res.json({ server, snapshot });
  });

  app.get('/api/metrics/snapshot-queries', (_req, res) => {
    const metrics = listSnapshotQueryMetrics();
    res.json({ metrics });
  });

  app.get('/api/internal/database-stats', (_req, res) => {
    const stats = getDatabaseStats();
    res.json({ stats });
  });

  app.get('/api/internal/player-sessions', (_req, res) => {
    const players = listPlayerSessionStats();
    res.json({ players });
  });

  app.listen(config.webServer.port, () => {
    logMessage(loggingGroups.WEBSERVER, `Web server listening on port ${config.webServer.port}`);
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

function recordSnapshotVisit(req: Request): void {
  const ipAddress = extractClientIp(req);
  if (!ipAddress) {
    return;
  }

  const route = `${req.method} ${resolveRoutePattern(req)}`;
  const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;

  recordSnapshotQueryMetric({
    ipAddress,
    route,
    userAgent,
  });
}

function resolveRoutePattern(req: Request): string {
  const baseUrl = typeof req.baseUrl === 'string' ? req.baseUrl : '';
  const routePath =
    typeof req.route?.path === 'string'
      ? req.route.path
      : typeof req.path === 'string'
        ? req.path
        : req.originalUrl;
  const combined = `${baseUrl}${routePath}`;
  return combined.length > 0 ? combined : req.originalUrl;
}

function extractClientIp(req: Request): string | null {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  } else if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    const first = forwardedFor[0]?.trim();
    if (first) {
      return first;
    }
  }

  if (typeof req.ip === 'string' && req.ip.length > 0) {
    return req.ip;
  }

  if (req.socket?.remoteAddress) {
    return req.socket.remoteAddress;
  }

  return null;
}
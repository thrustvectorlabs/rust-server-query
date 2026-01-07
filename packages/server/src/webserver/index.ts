import express, { type Request } from 'express';
import cors from 'cors';
import { config } from '../config.js';
import {
  getServerSummary,
  listActiveSessions,
  listRecentSessions,
  listServers,
  listApiQueryMetrics,
  getDatabaseStats,
  listPlayerSessionStats,
  recordApiQueryMetric,
  listClientSessionStats,
  type ServerIdentifier,
} from '../database/database.js';
import { logMessage, loggingGroups } from '../logger/logger.js';

const DEFAULT_SESSION_LIMIT = 50;
const MAX_SESSION_LIMIT = 200;

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

  app.use('/api', (req, res, next) => {
    res.on('finish', () => {
      recordApiVisit(req);
    });
    next();
  });

  app.get('/', (_req, res) => {
    res.send('Rust Server Query Web Server is running.');
  });

  app.get('/api/servers', (_req, res) => {
    const servers = listServers();
    res.json({ servers });
  });

  app.get('/api/servers/:type/:host/:port/players', (req, res) => {
    const server = parseServerIdentifier(req.params);
    if (!server) {
      res.status(400).json({ error: 'Invalid server identifier.' });
      return;
    }

    const summary = getServerSummary(server);
    const players = listActiveSessions(server);
    if (!summary) {
      res.json({
        server: {
          type: server.type,
          host: server.host,
          port: server.port,
          name: null,
          map: null,
          currentPlayers: null,
          maxPlayers: null,
          ping: null,
        },
        lastSeenAt: 0,
        players,
      });
      return;
    }

    res.json({ server: summary.server, lastSeenAt: summary.lastSeenAt, players });
  });

  app.get('/api/servers/:type/:host/:port/sessions', (req, res) => {
    const server = parseServerIdentifier(req.params);
    if (!server) {
      res.status(400).json({ error: 'Invalid server identifier.' });
      return;
    }

    const limit = parseLimit(req.query.limit, DEFAULT_SESSION_LIMIT, MAX_SESSION_LIMIT);
    if (limit instanceof Error) {
      res.status(400).json({ error: limit.message });
      return;
    }

    const summary = getServerSummary(server);
    const sessions = listRecentSessions(server, limit);
    if (!summary) {
      res.json({
        server: {
          type: server.type,
          host: server.host,
          port: server.port,
          name: null,
          map: null,
          currentPlayers: null,
          maxPlayers: null,
          ping: null,
        },
        lastSeenAt: 0,
        sessions,
        limit,
      });
      return;
    }

    res.json({ server: summary.server, lastSeenAt: summary.lastSeenAt, sessions, limit });
  });

  app.get('/api/metrics/api-queries', (_req, res) => {
    const metrics = listApiQueryMetrics();
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

  app.get('/api/internal/client-sessions', (_req, res) => {
    const sessions = listClientSessionStats();
    res.json({ sessions });
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

function recordApiVisit(req: Request): void {
  const ipAddress = extractClientIp(req);
  if (!ipAddress) {
    return;
  }

  const route = `${req.method} ${resolveRoutePattern(req)}`;
  const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;

  recordApiQueryMetric({
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

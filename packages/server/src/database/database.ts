import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIRECTORY = resolve(__dirname, '../../data');
const DATABASE_FILENAME = 'server-tracker.db';
export const DATABASE_PATH = resolve(DATA_DIRECTORY, DATABASE_FILENAME);

mkdirSync(DATA_DIRECTORY, { recursive: true });

type BetterSqliteDatabase = InstanceType<typeof Database>;

type ServerRow = {
  server_type: string;
  host: string;
  port: number;
  name: string | null;
  map: string | null;
  max_players: number | null;
  current_players: number | null;
  last_ping: number | null;
  last_seen_at: number;
};

type ActiveSessionRow = {
  id: number;
  player_name: string;
  steam_id: string | null;
  started_at: number;
  last_seen_at: number;
};

type SessionRow = ActiveSessionRow & {
  ended_at: number | null;
};

type DatabaseSummaryRow = {
  total_sessions: number;
  unique_players: number;
  server_count: number;
  active_sessions: number;
};

type PlayerSessionRow = {
  player_name: string;
  session_count: number;
  first_seen: number;
};

type ApiQueryMetricRow = {
  ip_address: string;
  route: string;
  user_agent: string | null;
  last_queried_at: number;
  query_count: number;
};

const db: BetterSqliteDatabase = new Database(DATABASE_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const SCHEMA_VERSION = 2;
const currentVersion = Number(db.pragma('user_version', { simple: true }));

if (currentVersion !== SCHEMA_VERSION) {
  db.exec(`
    DROP TABLE IF EXISTS player_observations;
    DROP TABLE IF EXISTS server_snapshots;
    DROP TABLE IF EXISTS snapshot_query_metrics;
    DROP TABLE IF EXISTS player_sessions;
    DROP TABLE IF EXISTS servers;
    DROP TABLE IF EXISTS api_query_metrics;
  `);
  db.pragma(`user_version = ${SCHEMA_VERSION}`);
}

db.exec(`
CREATE TABLE IF NOT EXISTS servers (
  server_type TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  name TEXT,
  map TEXT,
  max_players INTEGER,
  current_players INTEGER,
  last_ping INTEGER,
  last_seen_at INTEGER NOT NULL,
  PRIMARY KEY (server_type, host, port)
);

CREATE TABLE IF NOT EXISTS player_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_type TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  steam_id TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  last_seen_at INTEGER NOT NULL,
  FOREIGN KEY (server_type, host, port) REFERENCES servers(server_type, host, port) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_query_metrics (
  ip_address TEXT NOT NULL,
  route TEXT NOT NULL,
  user_agent TEXT,
  last_queried_at INTEGER NOT NULL,
  query_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (ip_address, route)
);

CREATE INDEX IF NOT EXISTS idx_player_sessions_active
  ON player_sessions(server_type, host, port, ended_at, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_player_sessions_name
  ON player_sessions(player_name);
CREATE INDEX IF NOT EXISTS idx_api_query_metrics_last
  ON api_query_metrics(last_queried_at);
`);

const closeOpenSessionsStmt = db.prepare<{ timestamp: number }>(`
UPDATE player_sessions
SET ended_at = @timestamp
WHERE ended_at IS NULL
`);

closeOpenSessionsStmt.run({ timestamp: Date.now() });

const upsertServerStmt = db.prepare<{
  serverType: string;
  host: string;
  port: number;
  name: string | null;
  map: string | null;
  maxPlayers: number | null;
  currentPlayers: number | null;
  ping: number | null;
  timestamp: number;
}>(`
INSERT INTO servers (server_type, host, port, name, map, max_players, current_players, last_ping, last_seen_at)
VALUES (@serverType, @host, @port, @name, @map, @maxPlayers, @currentPlayers, @ping, @timestamp)
ON CONFLICT(server_type, host, port) DO UPDATE SET
  name = excluded.name,
  map = excluded.map,
  max_players = excluded.max_players,
  current_players = excluded.current_players,
  last_ping = excluded.last_ping,
  last_seen_at = excluded.last_seen_at;
`);

const selectServersStmt = db.prepare<never, ServerRow>(`
SELECT server_type, host, port, name, map, max_players, current_players, last_ping, last_seen_at
FROM servers
ORDER BY server_type, host, port
`);

const selectServerStmt = db.prepare<{ serverType: string; host: string; port: number }, ServerRow>(`
SELECT server_type, host, port, name, map, max_players, current_players, last_ping, last_seen_at
FROM servers
WHERE server_type = @serverType AND host = @host AND port = @port
`);

const selectActiveSessionsStmt = db.prepare<
  { serverType: string; host: string; port: number },
  ActiveSessionRow
>(`
SELECT id, player_name, steam_id, started_at, last_seen_at
FROM player_sessions
WHERE server_type = @serverType AND host = @host AND port = @port AND ended_at IS NULL
ORDER BY started_at ASC, id ASC
`);

const selectRecentSessionsStmt = db.prepare<
  { serverType: string; host: string; port: number; limit: number },
  SessionRow
>(`
SELECT id, player_name, steam_id, started_at, ended_at, last_seen_at
FROM player_sessions
WHERE server_type = @serverType AND host = @host AND port = @port
ORDER BY started_at DESC, id DESC
LIMIT @limit
`);

const updateActiveSessionStmt = db.prepare<{
  serverType: string;
  host: string;
  port: number;
  playerName: string;
  lastSeenAt: number;
  steamId: string | null;
}>(`
UPDATE player_sessions
SET last_seen_at = @lastSeenAt,
    steam_id = COALESCE(@steamId, steam_id)
WHERE server_type = @serverType
  AND host = @host
  AND port = @port
  AND player_name = @playerName
  AND ended_at IS NULL
`);

const insertSessionStmt = db.prepare<{
  serverType: string;
  host: string;
  port: number;
  playerName: string;
  steamId: string | null;
  startedAt: number;
  lastSeenAt: number;
}>(`
INSERT INTO player_sessions (server_type, host, port, player_name, steam_id, started_at, last_seen_at)
VALUES (@serverType, @host, @port, @playerName, @steamId, @startedAt, @lastSeenAt)
`);

const closeSessionStmt = db.prepare<{ id: number; endedAt: number }>(`
UPDATE player_sessions
SET ended_at = @endedAt
WHERE id = @id
`);

const selectDatabaseSummaryStmt = db.prepare<never, DatabaseSummaryRow>(`
SELECT
  (SELECT COUNT(*) FROM player_sessions) AS total_sessions,
  (SELECT COUNT(DISTINCT player_name) FROM player_sessions) AS unique_players,
  (SELECT COUNT(*) FROM servers) AS server_count,
  (SELECT COUNT(*) FROM player_sessions WHERE ended_at IS NULL) AS active_sessions
`);

const listPlayerSessionsStmt = db.prepare<never, PlayerSessionRow>(`
SELECT player_name, COUNT(*) AS session_count, MIN(started_at) AS first_seen
FROM player_sessions
GROUP BY player_name
ORDER BY session_count DESC, player_name ASC
`);

const upsertApiQueryMetricStmt = db.prepare<{
  ipAddress: string;
  route: string;
  userAgent: string | null;
  timestamp: number;
}>(`
INSERT INTO api_query_metrics (ip_address, route, user_agent, last_queried_at, query_count)
VALUES (@ipAddress, @route, @userAgent, @timestamp, 1)
ON CONFLICT(ip_address, route) DO UPDATE SET
  user_agent = COALESCE(excluded.user_agent, api_query_metrics.user_agent),
  last_queried_at = excluded.last_queried_at,
  query_count = api_query_metrics.query_count + 1;
`);

const selectApiQueryMetricsStmt = db.prepare<never, ApiQueryMetricRow>(`
SELECT ip_address, route, user_agent, last_queried_at, query_count
FROM api_query_metrics
ORDER BY ip_address ASC, route ASC
`);

export interface ServerIdentifier {
  type: string;
  host: string;
  port: number;
}

export interface ServerDetails extends ServerIdentifier {
  name: string | null;
  map: string | null;
  currentPlayers: number | null;
  maxPlayers: number | null;
  ping: number | null;
}

export interface ServerSummary {
  server: ServerDetails;
  lastSeenAt: number;
}

export interface PlayerSessionInput {
  name: string;
  steamId?: string | null;
  startedAt?: number | null;
}

export interface ServerQueryInput {
  server: ServerIdentifier & {
    name?: string | null;
    map?: string | null;
    numPlayers?: number | null;
    maxPlayers?: number | null;
    ping?: number | null;
  };
  players?: PlayerSessionInput[];
  queriedAt?: number;
}

export interface ActivePlayerSession {
  playerName: string;
  steamId: string | null;
  startedAt: number;
  lastSeenAt: number;
}

export interface PlayerSessionRecord extends ActivePlayerSession {
  id: number;
  endedAt: number | null;
}

export interface ApiQueryLogInput {
  ipAddress: string;
  route: string;
  userAgent?: string | null;
  queriedAt?: number;
}

export interface ApiQueryRouteMetric {
  route: string;
  queryCount: number;
  lastQueriedAt: number;
  lastUserAgent: string | null;
}

export interface ApiQueryMetric {
  ipAddress: string;
  totalQueries: number;
  lastQueriedAt: number;
  routes: ApiQueryRouteMetric[];
}

export interface DatabaseStats {
  totalSessions: number;
  uniquePlayers: number;
  activeSessions: number;
  serverCount: number;
}

export interface PlayerSessionStats {
  playerName: string;
  sessionCount: number;
  firstSeen: number;
}

const recordServerQueryTx = db.transaction((query: ServerQueryInput): void => {
  const timestamp = query.queriedAt ?? Date.now();
  const players = query.players ?? [];
  const server = query.server;
  const declaredPlayerCount = sanitizeNumber(server.numPlayers);
  const fallbackPlayerCount = sanitizeNumber(players.length);
  const currentPlayers = declaredPlayerCount ?? fallbackPlayerCount;

  upsertServerStmt.run({
    serverType: server.type,
    host: server.host,
    port: server.port,
    name: server.name ?? null,
    map: server.map ?? null,
    maxPlayers: sanitizeNumber(server.maxPlayers),
    currentPlayers,
    ping: sanitizeNumber(server.ping),
    timestamp,
  });

  const activeSessions = selectActiveSessionsStmt.all({
    serverType: server.type,
    host: server.host,
    port: server.port,
  });

  const seenNames = new Set<string>();

  for (const player of players) {
    const playerName = normalizePlayerName(player.name);
    if (!playerName || seenNames.has(playerName)) {
      continue;
    }

    const steamId = sanitizeText(player.steamId ?? undefined);

    seenNames.add(playerName);

    const updateResult = updateActiveSessionStmt.run({
      serverType: server.type,
      host: server.host,
      port: server.port,
      playerName,
      lastSeenAt: timestamp,
      steamId,
    });

    if (updateResult.changes === 0) {
      const startedAt = sanitizeNumber(player.startedAt) ?? timestamp;
      insertSessionStmt.run({
        serverType: server.type,
        host: server.host,
        port: server.port,
        playerName,
        steamId,
        startedAt,
        lastSeenAt: timestamp,
      });
    }
  }

  for (const session of activeSessions) {
    if (!seenNames.has(session.player_name)) {
      closeSessionStmt.run({ id: session.id, endedAt: timestamp });
    }
  }
});

export function recordServerQuery(query: ServerQueryInput): void {
  recordServerQueryTx(query);
}

export function listServers(): ServerSummary[] {
  const rows = selectServersStmt.all() as ServerRow[];
  return rows.map((row) => ({
    server: {
      type: row.server_type,
      host: row.host,
      port: row.port,
      name: row.name ?? null,
      map: row.map ?? null,
      currentPlayers: sanitizeNumber(row.current_players),
      maxPlayers: sanitizeNumber(row.max_players),
      ping: sanitizeNumber(row.last_ping),
    },
    lastSeenAt: row.last_seen_at,
  }));
}

export function getServerSummary(server: ServerIdentifier): ServerSummary | null {
  const row = selectServerStmt.get({
    serverType: server.type,
    host: server.host,
    port: server.port,
  });

  if (!row) {
    return null;
  }

  return {
    server: {
      type: row.server_type,
      host: row.host,
      port: row.port,
      name: row.name ?? null,
      map: row.map ?? null,
      currentPlayers: sanitizeNumber(row.current_players),
      maxPlayers: sanitizeNumber(row.max_players),
      ping: sanitizeNumber(row.last_ping),
    },
    lastSeenAt: row.last_seen_at,
  };
}

export function listActiveSessions(server: ServerIdentifier): ActivePlayerSession[] {
  const rows = selectActiveSessionsStmt.all({
    serverType: server.type,
    host: server.host,
    port: server.port,
  }) as ActiveSessionRow[];

  return rows.map((row) => ({
    playerName: row.player_name,
    steamId: row.steam_id ?? null,
    startedAt: row.started_at,
    lastSeenAt: row.last_seen_at,
  }));
}

export function listRecentSessions(
  server: ServerIdentifier,
  limit = 25,
): PlayerSessionRecord[] {
  const rows = selectRecentSessionsStmt.all({
    serverType: server.type,
    host: server.host,
    port: server.port,
    limit,
  }) as SessionRow[];

  return rows.map((row) => ({
    id: row.id,
    playerName: row.player_name,
    steamId: row.steam_id ?? null,
    startedAt: row.started_at,
    lastSeenAt: row.last_seen_at,
    endedAt: row.ended_at ?? null,
  }));
}

export function recordApiQueryMetric(log: ApiQueryLogInput): void {
  const ipAddress = sanitizeText(log.ipAddress);
  const route = sanitizeText(log.route);

  if (!ipAddress || !route) {
    return;
  }

  const timestamp = log.queriedAt ?? Date.now();
  const userAgent = sanitizeText(log.userAgent ?? undefined);

  upsertApiQueryMetricStmt.run({
    ipAddress,
    route,
    userAgent,
    timestamp,
  });
}

export function listApiQueryMetrics(): ApiQueryMetric[] {
  const rows = selectApiQueryMetricsStmt.all();
  const metricsByIp = new Map<string, ApiQueryMetric>();

  for (const row of rows) {
    const ip = sanitizeText(row.ip_address);
    const route = sanitizeText(row.route);
    const lastQueriedAt = sanitizeNumber(row.last_queried_at);
    const queryCount = sanitizeNumber(row.query_count);
    const userAgent = sanitizeText(row.user_agent ?? undefined);

    if (!ip || !route || lastQueriedAt === null || queryCount === null) {
      continue;
    }

    let metric = metricsByIp.get(ip);
    if (!metric) {
      metric = {
        ipAddress: ip,
        totalQueries: 0,
        lastQueriedAt,
        routes: [],
      };
      metricsByIp.set(ip, metric);
    }

    metric.totalQueries += queryCount;
    metric.lastQueriedAt = Math.max(metric.lastQueriedAt, lastQueriedAt);
    metric.routes.push({
      route,
      queryCount,
      lastQueriedAt,
      lastUserAgent: userAgent,
    });
  }

  return Array.from(metricsByIp.values())
    .map((metric) => ({
      ...metric,
      routes: metric.routes.sort((a, b) =>
        b.lastQueriedAt === a.lastQueriedAt
          ? b.queryCount - a.queryCount
          : b.lastQueriedAt - a.lastQueriedAt,
      ),
    }))
    .sort((a, b) =>
      b.totalQueries === a.totalQueries
        ? b.lastQueriedAt - a.lastQueriedAt
        : b.totalQueries - a.totalQueries,
    );
}

export function getDatabaseStats(): DatabaseStats {
  const summaryRow = selectDatabaseSummaryStmt.get();

  return {
    totalSessions: sanitizeNumber(summaryRow?.total_sessions) ?? 0,
    uniquePlayers: sanitizeNumber(summaryRow?.unique_players) ?? 0,
    activeSessions: sanitizeNumber(summaryRow?.active_sessions) ?? 0,
    serverCount: sanitizeNumber(summaryRow?.server_count) ?? 0,
  };
}

export function listPlayerSessionStats(): PlayerSessionStats[] {
  const rows = listPlayerSessionsStmt.all();
  return rows.map((row) => ({
    playerName: row.player_name,
    sessionCount: sanitizeNumber(row.session_count) ?? 0,
    firstSeen: sanitizeNumber(row.first_seen) ?? 0,
  }));
}

function sanitizeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sanitizeText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePlayerName(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return '(unnamed player)';
}

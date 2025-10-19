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

type SnapshotKey = {
  serverType: string;
  host: string;
  port: number;
};

type SnapshotKeyWithLimit = SnapshotKey & { limit: number };

type ServerRow = {
  server_type: string;
  host: string;
  port: number;
  name: string | null;
  map: string | null;
  max_players: number | null;
  current_players: number | null;
  last_ping: number | null;
  last_snapshot_at: number;
};

type SnapshotRow = {
  id: number;
  server_type: string;
  host: string;
  port: number;
  name: string | null;
  map: string | null;
  num_players: number | null;
  max_players: number | null;
  ping: number | null;
  queried_at: number;
};

type PlayerRow = {
  player_name: string;
  score: number | null;
  time: number | null;
  raw_json: string | null;
};

const db: BetterSqliteDatabase = new Database(DATABASE_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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
  last_snapshot_at INTEGER NOT NULL,
  PRIMARY KEY (server_type, host, port)
);

CREATE TABLE IF NOT EXISTS server_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_type TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  name TEXT,
  map TEXT,
  num_players INTEGER,
  max_players INTEGER,
  ping INTEGER,
  queried_at INTEGER NOT NULL,
  FOREIGN KEY (server_type, host, port) REFERENCES servers(server_type, host, port) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS player_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  score REAL,
  time REAL,
  raw_json TEXT,
  FOREIGN KEY (snapshot_id) REFERENCES server_snapshots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_server_snapshots_lookup ON server_snapshots(server_type, host, port, queried_at DESC);
CREATE INDEX IF NOT EXISTS idx_player_observations_snapshot ON player_observations(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_player_observations_name ON player_observations(player_name);
`);

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
INSERT INTO servers (server_type, host, port, name, map, max_players, current_players, last_ping, last_snapshot_at)
VALUES (@serverType, @host, @port, @name, @map, @maxPlayers, @currentPlayers, @ping, @timestamp)
ON CONFLICT(server_type, host, port) DO UPDATE SET
  name = excluded.name,
  map = excluded.map,
  max_players = excluded.max_players,
  current_players = excluded.current_players,
  last_ping = excluded.last_ping,
  last_snapshot_at = excluded.last_snapshot_at;
`);

const insertSnapshotStmt = db.prepare<{
  serverType: string;
  host: string;
  port: number;
  name: string | null;
  map: string | null;
  numPlayers: number | null;
  maxPlayers: number | null;
  ping: number | null;
  timestamp: number;
}>(`
INSERT INTO server_snapshots (server_type, host, port, name, map, num_players, max_players, ping, queried_at)
VALUES (@serverType, @host, @port, @name, @map, @numPlayers, @maxPlayers, @ping, @timestamp)
`);

const insertPlayerObservationStmt = db.prepare<{
  snapshotId: number;
  playerName: string;
  score: number | null;
  time: number | null;
  rawJson: string | null;
}>(`
INSERT INTO player_observations (snapshot_id, player_name, score, time, raw_json)
VALUES (@snapshotId, @playerName, @score, @time, @rawJson)
`);

const selectSnapshotByIdStmt = db.prepare<{ id: number }, SnapshotRow>(`
SELECT id, server_type, host, port, name, map, num_players, max_players, ping, queried_at
FROM server_snapshots
WHERE id = @id
`);

const selectLatestSnapshotStmt = db.prepare<SnapshotKey, SnapshotRow>(`
SELECT id, server_type, host, port, name, map, num_players, max_players, ping, queried_at
FROM server_snapshots
WHERE server_type = @serverType AND host = @host AND port = @port
ORDER BY queried_at DESC
LIMIT 1
`);

const selectRecentSnapshotsStmt = db.prepare<SnapshotKeyWithLimit, SnapshotRow>(`
SELECT id, server_type, host, port, name, map, num_players, max_players, ping, queried_at
FROM server_snapshots
WHERE server_type = @serverType AND host = @host AND port = @port
ORDER BY queried_at DESC
LIMIT @limit
`);

const selectSnapshotPlayersStmt = db.prepare<{ snapshotId: number }, PlayerRow>(`
SELECT player_name, score, time, raw_json
FROM player_observations
WHERE snapshot_id = @snapshotId
ORDER BY player_name ASC
`);

const selectServersStmt = db.prepare<never, ServerRow>(`
SELECT server_type, host, port, name, map, max_players, current_players, last_ping, last_snapshot_at
FROM servers
ORDER BY server_type, host, port
`);

const pruneSnapshotsStmt = db.prepare<{
  serverType: string;
  host: string;
  port: number;
  retain: number;
}>(`
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY server_type, host, port ORDER BY queried_at DESC) AS rn
  FROM server_snapshots
  WHERE server_type = @serverType AND host = @host AND port = @port
)
DELETE FROM server_snapshots
WHERE id IN (
  SELECT id FROM ranked WHERE rn > @retain
);
`);

const pruneServersStmt = db.prepare<{ threshold: number }>(`
DELETE FROM servers
WHERE last_snapshot_at < @threshold;
`);

export interface ServerIdentifier {
  type: string;
  host: string;
  port: number;
}

export interface PlayerSnapshotInput {
  name: string;
  score?: number | null;
  time?: number | null;
  raw?: unknown;
}

export interface ServerSnapshotInput {
  server: ServerIdentifier & {
    name?: string | null;
    map?: string | null;
    numPlayers?: number | null;
    maxPlayers?: number | null;
    ping?: number | null;
  };
  players?: PlayerSnapshotInput[];
  queriedAt?: number;
}

export interface PlayerObservation {
  name: string;
  score: number | null;
  time: number | null;
  raw?: unknown;
}

export interface StoredServerSnapshot {
  id: number;
  server: ServerIdentifier & {
    name: string | null;
    map: string | null;
    numPlayers: number | null;
    maxPlayers: number | null;
    ping: number | null;
  };
  queriedAt: number;
  players: PlayerObservation[];
}

export interface StoredServerSummary {
  server: ServerIdentifier & {
    name: string | null;
    map: string | null;
    currentPlayers: number | null;
    maxPlayers: number | null;
    ping: number | null;
  };
  lastSnapshotAt: number;
}

const recordSnapshotTx = db.transaction((snapshot: ServerSnapshotInput): number => {
  const timestamp = snapshot.queriedAt ?? Date.now();
  const players = snapshot.players ?? [];
  const server = snapshot.server;
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

  const insertResult = insertSnapshotStmt.run({
    serverType: server.type,
    host: server.host,
    port: server.port,
    name: server.name ?? null,
    map: server.map ?? null,
    numPlayers: declaredPlayerCount ?? fallbackPlayerCount,
    maxPlayers: sanitizeNumber(server.maxPlayers),
    ping: sanitizeNumber(server.ping),
    timestamp,
  });

  const snapshotId = Number(insertResult.lastInsertRowid);

  for (const player of players) {
    insertPlayerObservationStmt.run({
      snapshotId,
      playerName: player.name,
      score: sanitizeNumber(player.score),
      time: sanitizeNumber(player.time),
      rawJson: serializeRaw(player.raw),
    });
  }

  return snapshotId;
});

export function recordServerSnapshot(snapshot: ServerSnapshotInput): StoredServerSnapshot {
  const snapshotId = recordSnapshotTx(snapshot);
  const stored = getSnapshotById(snapshotId);
  if (!stored) {
    throw new Error(`Failed to read snapshot ${snapshotId} after recording`);
  }
  return stored;
}

export function getLatestSnapshot(server: ServerIdentifier): StoredServerSnapshot | null {
  const row = selectLatestSnapshotStmt.get({
    serverType: server.type,
    host: server.host,
    port: server.port,
  });

  if (!row) {
    return null;
  }

  return mapSnapshotRow(row);
}

export function getRecentSnapshots(
  server: ServerIdentifier,
  limit = 10,
): StoredServerSnapshot[] {
  const rows = selectRecentSnapshotsStmt.all({
    serverType: server.type,
    host: server.host,
    port: server.port,
    limit,
  });
  return rows.map((row) => mapSnapshotRow(row));
}

export function listServers(): StoredServerSummary[] {
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
    lastSnapshotAt: row.last_snapshot_at,
  }));
}

export function pruneOldSnapshots(options: {
  server: ServerIdentifier;
  retain: number;
}): void {
  pruneSnapshotsStmt.run({
    serverType: options.server.type,
    host: options.server.host,
    port: options.server.port,
    retain: options.retain,
  });
}

export function pruneServersInactiveSince(thresholdTimestamp: number): void {
  pruneServersStmt.run({ threshold: thresholdTimestamp });
}

export function closeDatabase(): void {
  db.close();
}

export function getDatabaseConnection(): BetterSqliteDatabase {
  return db;
}

function mapSnapshotRow(row: SnapshotRow): StoredServerSnapshot {
  const playerRows = selectSnapshotPlayersStmt.all({ snapshotId: row.id });
  const players = playerRows.map((playerRow) => ({
    name: playerRow.player_name,
    score: sanitizeNumber(playerRow.score),
    time: sanitizeNumber(playerRow.time),
    raw: deserializeRaw(playerRow.raw_json),
  }));

  return {
    id: row.id,
    server: {
      type: row.server_type,
      host: row.host,
      port: row.port,
      name: row.name ?? null,
      map: row.map ?? null,
      numPlayers: sanitizeNumber(row.num_players),
      maxPlayers: sanitizeNumber(row.max_players),
      ping: sanitizeNumber(row.ping),
    },
    queriedAt: row.queried_at,
    players,
  };
}

function getSnapshotById(id: number): StoredServerSnapshot | null {
  const row = selectSnapshotByIdStmt.get({ id });
  if (!row) {
    return null;
  }
  return mapSnapshotRow(row);
}

function sanitizeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function serializeRaw(raw: unknown): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  try {
    return JSON.stringify(raw);
  } catch {
    return null;
  }
}

function deserializeRaw(rawJson: unknown): unknown {
  if (typeof rawJson !== 'string' || rawJson.length === 0) {
    return undefined;
  }
  try {
    return JSON.parse(rawJson);
  } catch {
    return rawJson;
  }
}

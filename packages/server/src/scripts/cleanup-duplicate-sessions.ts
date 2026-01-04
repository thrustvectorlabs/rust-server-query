#!/usr/bin/env node

import Database from 'better-sqlite3';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIRECTORY = resolve(__dirname, '../../data');
const DATABASE_PATH = resolve(DATA_DIRECTORY, 'server-tracker.db');

type DuplicateGroup = {
  server_type: string;
  host: string;
  port: number;
  player_name: string;
  total: number;
};

type SessionRow = {
  id: number;
  steam_id: string | null;
  started_at: number;
  ended_at: number | null;
  last_seen_at: number;
};

const db = new Database(DATABASE_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const DEFAULT_MERGE_GAP_MS = 5_000;

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');

const mergeGapArg = Array.from(args).find((arg) => arg.startsWith('--merge-gap-ms='));
const mergeGapMs = mergeGapArg
  ? Number.parseInt(mergeGapArg.split('=')[1] ?? '', 10)
  : DEFAULT_MERGE_GAP_MS;

if (!Number.isFinite(mergeGapMs) || mergeGapMs < 0) {
  throw new Error(`Invalid --merge-gap-ms value: ${mergeGapArg ?? ''}`);
}

const selectDuplicateGroupsStmt = db.prepare<never, DuplicateGroup>(`
SELECT server_type, host, port, player_name, COUNT(*) AS total
FROM player_sessions
GROUP BY server_type, host, port, player_name
HAVING total > 1
ORDER BY total DESC, player_name ASC
`);

const selectDuplicateSessionsStmt = db.prepare<
  {
    serverType: string;
    host: string;
    port: number;
    playerName: string;
  },
  SessionRow
>(`
SELECT id, steam_id, started_at, ended_at, last_seen_at
FROM player_sessions
WHERE server_type = @serverType
  AND host = @host
  AND port = @port
  AND player_name = @playerName
ORDER BY started_at ASC, last_seen_at ASC, id ASC
`);

const updateSessionStmt = db.prepare<{
  id: number;
  startedAt: number;
  endedAt: number | null;
  lastSeenAt: number;
  steamId: string | null;
}>(`
UPDATE player_sessions
SET started_at = @startedAt,
    ended_at = @endedAt,
    last_seen_at = @lastSeenAt,
    steam_id = COALESCE(@steamId, steam_id)
WHERE id = @id
`);

const deleteSessionStmt = db.prepare<{ id: number }>(`
DELETE FROM player_sessions
WHERE id = @id
`);

function chooseKeeper(rows: SessionRow[]): SessionRow {
  if (rows.length === 0) {
    throw new Error('No sessions to choose from.');
  }

  return rows.slice(1).reduce<SessionRow>((best, row) => {
    const bestHasSteam = Boolean(best.steam_id);
    const rowHasSteam = Boolean(row.steam_id);
    if (bestHasSteam !== rowHasSteam) {
      return rowHasSteam ? row : best;
    }

    if (row.last_seen_at !== best.last_seen_at) {
      return row.last_seen_at > best.last_seen_at ? row : best;
    }

    return row.id < best.id ? row : best;
  }, rows[0]);
}

function getEffectiveEnd(row: SessionRow): number {
  if (row.ended_at === null) {
    return row.last_seen_at;
  }
  return Math.max(row.ended_at, row.last_seen_at);
}

function mergeCluster(rows: SessionRow[]): {
  keeper: SessionRow;
  startedAt: number;
  endedAt: number | null;
  lastSeenAt: number;
  steamId: string | null;
} {
  const keeper = chooseKeeper(rows);
  let startedAt = rows[0]?.started_at ?? keeper.started_at;
  let lastSeenAt = rows[0]?.last_seen_at ?? keeper.last_seen_at;
  let endedAt: number | null = rows.some((row) => row.ended_at === null) ? null : -1;
  let steamId = keeper.steam_id ?? null;

  for (const row of rows) {
    startedAt = Math.min(startedAt, row.started_at);
    lastSeenAt = Math.max(lastSeenAt, row.last_seen_at);
    if (endedAt !== null && row.ended_at !== null) {
      endedAt = Math.max(endedAt, Math.max(row.ended_at, row.last_seen_at));
    }
    if (!steamId && row.steam_id) {
      steamId = row.steam_id;
    }
  }

  if (endedAt === -1) {
    endedAt = null;
  }

  return {
    keeper,
    startedAt,
    endedAt,
    lastSeenAt,
    steamId,
  };
}

const cleanupTx = db.transaction(() => {
  const groups = selectDuplicateGroupsStmt.all();
  let deleted = 0;
  let merged = 0;
  let updated = 0;

  for (const group of groups) {
    const rows = selectDuplicateSessionsStmt.all({
      serverType: group.server_type,
      host: group.host,
      port: group.port,
      playerName: group.player_name,
    });

    if (rows.length <= 1) {
      continue;
    }

    let currentCluster: SessionRow[] = [];
    let currentEnd = 0;

    const flushCluster = (cluster: SessionRow[]): void => {
      if (cluster.length <= 1) {
        return;
      }

      const mergedCluster = mergeCluster(cluster);
      merged += 1;

      if (!dryRun) {
        updateSessionStmt.run({
          id: mergedCluster.keeper.id,
          startedAt: mergedCluster.startedAt,
          endedAt: mergedCluster.endedAt,
          lastSeenAt: mergedCluster.lastSeenAt,
          steamId: mergedCluster.steamId,
        });
      }
      updated += 1;

      for (const row of cluster) {
        if (row.id === mergedCluster.keeper.id) {
          continue;
        }
        if (!dryRun) {
          deleteSessionStmt.run({ id: row.id });
        }
        deleted += 1;
      }
    };

    for (const row of rows) {
      if (currentCluster.length === 0) {
        currentCluster = [row];
        currentEnd = getEffectiveEnd(row);
        continue;
      }

      const rowStart = row.started_at;
      if (rowStart <= currentEnd + mergeGapMs) {
        currentCluster.push(row);
        currentEnd = Math.max(currentEnd, getEffectiveEnd(row));
        continue;
      }

      flushCluster(currentCluster);
      currentCluster = [row];
      currentEnd = getEffectiveEnd(row);
    }

    flushCluster(currentCluster);
  }

  return {
    groups: groups.length,
    merged,
    updated,
    deleted,
  };
});

const result = cleanupTx();
console.log(
  JSON.stringify(
    {
      action: 'cleanup-duplicate-sessions',
      duplicateGroups: result.groups,
      mergedClusters: result.merged,
      updatedSessions: result.updated,
      deletedSessions: result.deleted,
      dryRun,
      mergeGapMs,
    },
    null,
    2,
  ),
);

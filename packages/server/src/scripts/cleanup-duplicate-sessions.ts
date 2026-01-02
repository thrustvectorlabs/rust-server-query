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
  started_at: number;
  total: number;
};

type SessionRow = {
  id: number;
  ended_at: number | null;
  last_seen_at: number;
};

const db = new Database(DATABASE_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const selectDuplicateGroupsStmt = db.prepare<never, DuplicateGroup>(`
SELECT server_type, host, port, player_name, started_at, COUNT(*) AS total
FROM player_sessions
GROUP BY server_type, host, port, player_name, started_at
HAVING total > 1
ORDER BY total DESC, player_name ASC
`);

const selectDuplicateSessionsStmt = db.prepare<
  {
    serverType: string;
    host: string;
    port: number;
    playerName: string;
    startedAt: number;
  },
  SessionRow
>(`
SELECT id, ended_at, last_seen_at
FROM player_sessions
WHERE server_type = @serverType
  AND host = @host
  AND port = @port
  AND player_name = @playerName
  AND started_at = @startedAt
ORDER BY id ASC
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
    const rowActive = row.ended_at === null;
    const bestActive = best.ended_at === null;
    if (rowActive !== bestActive) {
      return rowActive ? row : best;
    }

    const rowEndedAt = row.ended_at ?? -1;
    const bestEndedAt = best.ended_at ?? -1;
    if (rowEndedAt !== bestEndedAt) {
      return rowEndedAt > bestEndedAt ? row : best;
    }

    if (row.last_seen_at !== best.last_seen_at) {
      return row.last_seen_at > best.last_seen_at ? row : best;
    }

    return row.id < best.id ? row : best;
  }, rows[0]);
}

const cleanupTx = db.transaction(() => {
  const groups = selectDuplicateGroupsStmt.all();
  let deleted = 0;

  for (const group of groups) {
    const rows = selectDuplicateSessionsStmt.all({
      serverType: group.server_type,
      host: group.host,
      port: group.port,
      playerName: group.player_name,
      startedAt: group.started_at,
    });

    if (rows.length <= 1) {
      continue;
    }

    const keeper = chooseKeeper(rows);
    for (const row of rows) {
      if (row.id === keeper.id) {
        continue;
      }
      deleteSessionStmt.run({ id: row.id });
      deleted += 1;
    }
  }

  return { groups: groups.length, deleted };
});

const result = cleanupTx();
console.log(
  JSON.stringify(
    {
      action: 'cleanup-duplicate-sessions',
      duplicateGroups: result.groups,
      deletedSessions: result.deleted,
    },
    null,
    2,
  ),
);

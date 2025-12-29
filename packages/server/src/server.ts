#!/usr/bin/env node

import { GameDig } from 'gamedig';
import { recordServerQuery } from './database/database.js';
import type { PlayerSessionInput, ServerIdentifier } from './database/database.js';
import { startWebServer } from './webserver/index.js';
import { startSocketServer } from './websocket/socket.js';
import { logMessage, loggingGroups } from './logger/logger.js';
import { config } from '../../../config.js';

const DEFAULT_POLL_INTERVAL_SECONDS = 20;

let pollIntervalMs = DEFAULT_POLL_INTERVAL_SECONDS * 1000;
let runContinuously = true;

function usage() {
  console.log(`Usage: ${process.argv[1]} [-i seconds]
  -i  Interval in seconds between queries (default: ${DEFAULT_POLL_INTERVAL_SECONDS}, use 0 to run once)`);
  process.exit(1);
}

// Parse args: only -i <seconds>
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '-i') {
    const val = process.argv[++i];
    if (val === undefined || !/^\d+$/.test(val)) {
      console.error('Error: interval must be a non-negative integer.');
      usage();
    }
    const intervalSeconds = Number(val);
    if (intervalSeconds === 0) {
      runContinuously = false;
    } else {
      runContinuously = true;
      pollIntervalMs = intervalSeconds * 1000;
    }
  } else {
    usage();
  }
}

async function queryServer(server: ServerIdentifier): Promise<boolean> {
  try {
    logMessage(
      loggingGroups.SERVER,
      `Querying ${server.type} server at ${server.host}:${server.port}`,
    );
    const result = await GameDig.query({
      type: server.type,
      host: server.host,
      port: server.port,
    });

    if (!Array.isArray(result.players)) {
      const message = 'Invalid server response: players list missing.';
      console.error(JSON.stringify({ error: message }));
      logMessage(
        loggingGroups.SERVER,
        `Ignoring invalid response from ${server.host}:${server.port}: players list missing`,
      );
      return false;
    }

    const queriedAt = Date.now();
    const players: PlayerSessionInput[] = result.players.map((player) => ({
      name:
        typeof player?.name === 'string' && player.name.trim().length > 0
          ? player.name
          : '(unnamed player)',
      steamId: extractSteamId(player),
      startedAt: extractStartedAt(player, queriedAt),
    }));

    try {
      recordServerQuery({
        server: {
          type: server.type,
          host: server.host,
          port: server.port,
          name: typeof result.name === 'string' ? result.name : undefined,
          map: typeof result.map === 'string' ? result.map : undefined,
          numPlayers:
            typeof (result as { numplayers?: unknown }).numplayers === 'number'
              ? (result as { numplayers?: number }).numplayers
              : players.length,
          maxPlayers: typeof (result as { maxplayers?: unknown }).maxplayers === 'number'
            ? (result as { maxplayers?: number }).maxplayers
            : undefined,
          ping: typeof result.ping === 'number' ? result.ping : undefined,
        },
        players,
        queriedAt,
      });
      const playerCount =
        typeof (result as { numplayers?: unknown }).numplayers === 'number'
          ? (result as { numplayers?: number }).numplayers
          : players.length;
      logMessage(
        loggingGroups.SERVER,
        `Recorded sessions for ${server.host}:${server.port} with ${playerCount} players`,
      );
    } catch (dbError) {
      const message = dbError instanceof Error ? dbError.message : String(dbError);
      console.error(JSON.stringify({ error: `Failed to store sessions: ${message}` }));
      logMessage(
        loggingGroups.SERVER,
        `Failed to store sessions for ${server.host}:${server.port}: ${message}`,
      );
    }

    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Match CLI behavior by printing an error and exiting nonzero for single run
    console.error(JSON.stringify({ error: message }));
    logMessage(
      loggingGroups.SERVER,
      `Error querying server ${server.host}:${server.port}: ${message}`,
    );
    return false;
  }
}

function extractSteamId(player: unknown): string | null {
  if (!player || typeof player !== 'object') {
    return null;
  }

  const record = player as Record<string, unknown>;
  const direct = record.steamId ?? record.steamid ?? record.steamID;
  if (typeof direct === 'string') {
    return direct.trim().length > 0 ? direct.trim() : null;
  }
  if (typeof direct === 'number' && Number.isFinite(direct)) {
    return String(direct);
  }

  const raw = record.raw;
  if (raw && typeof raw === 'object') {
    const rawRecord = raw as Record<string, unknown>;
    const rawValue = rawRecord.steamId ?? rawRecord.steamid ?? rawRecord.steamID;
    if (typeof rawValue === 'string') {
      return rawValue.trim().length > 0 ? rawValue.trim() : null;
    }
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      return String(rawValue);
    }
  }

  return null;
}

function extractStartedAt(player: unknown, queriedAt: number): number | null {
  if (!player || typeof player !== 'object') {
    return null;
  }

  const record = player as Record<string, unknown>;
  const raw = record.raw;
  if (raw && typeof raw === 'object') {
    const rawRecord = raw as Record<string, unknown>;
    const elapsedSeconds = normalizeElapsedSeconds(rawRecord.time);
    if (elapsedSeconds !== null) {
      const startedAt = queriedAt - Math.round(elapsedSeconds * 1000);
      return startedAt > 0 ? startedAt : null;
    }
  }

  return null;
}

function normalizeElapsedSeconds(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  if (value < 0) {
    return null;
  }
  return value;
}

(async function run() {
  if (runContinuously) {
    logMessage(
      loggingGroups.SERVER,
      `Starting continuous polling every ${pollIntervalMs / 1000}s`,
    );
    startWebServer();
    startSocketServer();
  } else {
    logMessage(loggingGroups.SERVER, 'Running single server query');
  }

  let initialSuccess = true;
  for (const server of config.servers) {
    const success = await queryServer(server);
    if (!success) {
      initialSuccess = false;
    }
  }

  if (!runContinuously) {
    if (!initialSuccess) {
      process.exitCode = 2;
    }
    return;
  }

  setInterval(() => {
    for (const server of config.servers) {
      void queryServer(server);
    }
  }, pollIntervalMs);
})();

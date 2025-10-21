#!/usr/bin/env node

import { GameDig } from 'gamedig';
import { recordServerSnapshot } from './database/database.js';
import type { PlayerSnapshotInput } from './database/database.js';
import { startWebServer } from './webserver/index.js';
import { startSocketServer } from './websocket/socket.js';
import { logMessage, loggingGroups } from './logger/logger.js';

// Defaults
const SERVER_TYPE = 'rust';
const SERVER_HOST = '136.243.18.104';
const SERVER_PORT = 28017;
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

async function queryServer(): Promise<boolean> {
  try {
    logMessage(
      loggingGroups.SERVER,
      `Querying ${SERVER_TYPE} server at ${SERVER_HOST}:${SERVER_PORT}`,
    );
    const result = await GameDig.query({
      type: SERVER_TYPE,
      host: SERVER_HOST,
      port: SERVER_PORT,
    });

    const players: PlayerSnapshotInput[] = Array.isArray(result.players)
      ? result.players.map((player) => {
          const name =
            typeof player?.name === 'string' && player.name.trim().length > 0
              ? player.name
              : '(unnamed player)';

          const rawDetails = player?.raw ?? null;
          const timeValue =
            rawDetails && typeof (rawDetails as { time?: unknown }).time === 'number'
              ? (rawDetails as { time?: number }).time
              : undefined;

          return {
            name,
            score: typeof player?.score === 'number' ? player.score : undefined,
            time: timeValue,
            raw: rawDetails ?? player ?? undefined,
          };
        })
      : [];

    try {
      recordServerSnapshot({
        server: {
          type: SERVER_TYPE,
          host: SERVER_HOST,
          port: SERVER_PORT,
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
        queriedAt: Date.now(),
      });
      const playerCount =
        typeof (result as { numplayers?: unknown }).numplayers === 'number'
          ? (result as { numplayers?: number }).numplayers
          : players.length;
      logMessage(
        loggingGroups.SERVER,
        `Stored snapshot for ${SERVER_HOST}:${SERVER_PORT} with ${playerCount} players`,
      );
    } catch (dbError) {
      const message = dbError instanceof Error ? dbError.message : String(dbError);
      console.error(JSON.stringify({ error: `Failed to store snapshot: ${message}` }));
      logMessage(
        loggingGroups.SERVER,
        `Failed to store snapshot for ${SERVER_HOST}:${SERVER_PORT}: ${message}`,
      );
    }

    // Match: jq ".name, .players"
    // console.log(JSON.stringify(result.name));
    // console.log(JSON.stringify(result.players, null, 2));
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Match CLI behavior by printing an error and exiting nonzero for single run
    console.error(JSON.stringify({ error: message }));
    logMessage(
      loggingGroups.SERVER,
      `Error querying server ${SERVER_HOST}:${SERVER_PORT}: ${message}`,
    );
    return false;
  }
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
    logMessage(loggingGroups.SERVER, 'Running single server snapshot query');
  }

  const initialSuccess = await queryServer();

  if (!runContinuously) {
    if (!initialSuccess) {
      process.exitCode = 2;
    }
    return;
  }

  setInterval(() => {
    void queryServer();
  }, pollIntervalMs);
})();

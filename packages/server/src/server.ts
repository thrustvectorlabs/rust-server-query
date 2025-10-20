#!/usr/bin/env node

import { GameDig } from 'gamedig';
import express from 'express';
import { recordServerSnapshot } from './database/database.js';
import type { PlayerSnapshotInput } from './database/database.js';
import { startWebServer } from './webserver/index.js';
import { startSocketServer } from './websocket/socket.js';

// Defaults
const SERVER_TYPE = 'rust';
const SERVER_HOST = '136.243.18.104';
const SERVER_PORT = 28017;

let INTERVAL = 0;

function usage() {
  console.log(`Usage: ${process.argv[1]} [-i seconds]
  -i  Interval in seconds between queries (default: once only)`);
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
    INTERVAL = Number(val);
  } else {
    usage();
  }
}

async function queryServer() {
  try {
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
    } catch (dbError) {
      const message = dbError instanceof Error ? dbError.message : String(dbError);
      console.error(JSON.stringify({ error: `Failed to store snapshot: ${message}` }));
    }

    // Match: jq ".name, .players"
    // console.log(JSON.stringify(result.name));
    // console.log(JSON.stringify(result.players, null, 2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Match CLI behavior by printing an error and exiting nonzero for single run
    console.error(JSON.stringify({ error: message }));
    if (INTERVAL === 0) process.exit(2);
  }
}

(async function run() {
  // Loop with clear and sleep
  // First immediate run
  // Then setInterval
  startWebServer();
  startSocketServer();
  await queryServer();

  setInterval(async () => {
    // console.clear();
    await queryServer();
  }, 20000);
})();

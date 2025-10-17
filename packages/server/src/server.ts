#!/usr/bin/env node

import { GameDig } from 'gamedig';
import express from 'express';

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

    // Match: jq ".name, .players"
    console.log(JSON.stringify(result.name));
    console.log(JSON.stringify(result.players, null, 2));
  } catch (err) {
    // Match CLI behavior by printing an error and exiting nonzero for single run
    console.error(JSON.stringify({ error: err.message || String(err) }));
    if (INTERVAL === 0) process.exit(2);
  }
}

(async function run() {
  if (INTERVAL > 0) {
    // Loop with clear and sleep
    // First immediate run
    // Then setInterval
    await (async () => {
      console.clear();
      await queryServer();
    })();

    setInterval(async () => {
      console.clear();
      await queryServer();
    }, INTERVAL * 1000);
  } else {
    await queryServer();
  }
})();

const app = express();
app.get("/health", (_req, res) => res.json({ ok: true }));
app.listen(3000, () => {
  console.log("Server on http://localhost:3000");
});
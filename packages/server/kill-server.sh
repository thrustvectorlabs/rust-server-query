#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
PID_FILE="$SCRIPT_DIR/server.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "No PID file found at $PID_FILE"
  exit 0
fi

PID=$(cat "$PID_FILE")
if ! kill -0 "$PID" 2>/dev/null; then
  rm -f "$PID_FILE"
  echo "No running process for PID $PID"
  exit 0
fi

if ps -p "$PID" -o command= | grep -q "node dist/server.js"; then
  kill "$PID"
  rm -f "$PID_FILE"
  echo "Killed server PID $PID"
else
  echo "PID $PID does not look like the server process; not killing."
  exit 1
fi

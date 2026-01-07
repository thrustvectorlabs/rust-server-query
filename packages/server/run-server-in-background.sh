#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
PID_FILE="$SCRIPT_DIR/server.pid"
LOG_FILE="$SCRIPT_DIR/app.log"

cd "$SCRIPT_DIR"
nohup node dist/server.js > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

# read srvname srvmap players max <<< $(gamedig --type rust --host 185.206.151.10 --port 28015 --pretty | jq -r '"\(.name) \(.map) \(.numplayers) \(.maxplayers)"')

# printf 'Server: %s\n' "$srvname"
# echo "Map: $srvmap"
# echo "Players: $players/$max"

# Plain command:
# gamedig --type rust --host 185.206.151.10 --port 28015 --pretty | jq ".name, .players"


#!/usr/bin/env bash

# Default server parameters
SERVER_TYPE="rust"
SERVER_HOST="136.243.18.104"
SERVER_PORT="28017"

# Default: run once
INTERVAL=0

usage() {
  echo "Usage: $0 [-i seconds]"
  echo "  -i  Interval in seconds between queries (default: once only)"
  exit 1
}

# Parse options
while getopts "i:" opt; do
  case "$opt" in
    i)
      # Must be a non‑negative integer
      if ! [[ "$OPTARG" =~ ^[0-9]+$ ]]; then
        echo "Error: interval must be a non‑negative integer." >&2
        usage
      fi
      INTERVAL=$OPTARG
      ;;
    *)
      usage
      ;;
  esac
done

# The query function
query_server() {
  gamedig \
    --type "$SERVER_TYPE" \
    --host "$SERVER_HOST" \
    --port "$SERVER_PORT" \
    --pretty \
  | jq ".name, .players"
}

# Run once or loop with sleep
if [ "$INTERVAL" -gt 0 ]; then
  while true; do
    clear
    query_server
    sleep "$INTERVAL"
  done
else
  query_server
fi


#!/usr/bin/env bash

HOST=104.129.132.17
PORT=28015
NOW=$(date +%s)

# Query once
DATA=$(gamedig --type rust --host "$HOST" --port "$PORT" --pretty)

# 1) Name column width: longest name + 2 chars padding
MAX_NAME_LEN=$(jq -r '.players[].name' <<<"$DATA" \
  | awk '{ if (length>max) max=length } END { print max }')
NAME_W=$(( MAX_NAME_LEN + 2 ))

# 2) Time column width: at least as wide as "Signed on" or the timestamp format
LABEL2="Signed on"
# “YYYY-MM-DD HH:MM:SS” is 19 chars
TIMESTAMP_W=19
TIME_W=$(( ${#LABEL2} > TIMESTAMP_W ? ${#LABEL2} : TIMESTAMP_W ))

# 3) Build dash‑lines
DASH1=$(printf '%*s' "$NAME_W" '' | tr ' ' '-')
DASH2=$(printf '%*s' "$TIME_W" '' | tr ' ' '-')

# 4) Print header and divider
printf "%-${NAME_W}s | %-${TIME_W}s\n" "Name" "$LABEL2"
printf "%s-+-%s\n" "$DASH1" "$DASH2"

# 5) Print each player
jq -c '.players[]' <<<"$DATA" | while read -r player; do
  NAME=$(jq -r '.name' <<<"$player")
  SECS=$(jq -r '(.raw.time // .time) | floor' <<<"$player")
  SIGNON_TS=$(( NOW - SECS ))
  SIGNON=$(date -d "@$SIGNON_TS" +"%Y-%m-%d %H:%M:%S")
  printf "%-${NAME_W}s | %-${TIME_W}s\n" "$NAME" "$SIGNON"
done

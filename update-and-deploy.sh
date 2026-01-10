#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$repo_root"


# export NVM_DIR="$HOME/.nvm"

# Load nvm
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
else
  echo "Error: nvm not found at $NVM_DIR"
  exit 1
fi

nvm use
git pull --ff-only

# Force install of all dependencies (including dev) during deploy.
export YARN_PRODUCTION=false

run_in_dir() {
  local dir="$1"; shift
  echo "Running in: $dir"
  ( cd "$dir" && "$@" )
}

cp config.ts config.js

run_in_dir "." yarn install --production=false --check-files
run_in_dir "packages/web" yarn install --production=false --check-files

if [ -f "packages/web/.env" ]; then
  set -a
  . "packages/web/.env"
  set +a
fi

run_in_dir "packages/web" yarn build
run_in_dir "packages/web" ./rsync-to-nginx.sh
run_in_dir "packages/server" yarn install --production=false --check-files
run_in_dir "packages/server" ./kill-server.sh
run_in_dir "packages/server" yarn build
run_in_dir "packages/server" ./run-server-in-background.sh

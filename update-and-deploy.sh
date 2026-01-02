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

run_in_dir() {
  local dir="$1"; shift
  echo "Running in: $dir"
  ( cd "$dir" && "$@" )
}

run_in_dir "." yarn install
run_in_dir "packages/web" yarn install
run_in_dir "packages/web" yarn build
run_in_dir "packages/server" yarn install
run_in_dir "packages/server" yarn build
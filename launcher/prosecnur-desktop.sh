#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d "desktop/node_modules/electron" ]; then
  pnpm --dir desktop install
fi

exec pnpm --dir desktop start

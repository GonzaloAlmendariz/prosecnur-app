#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v pnpm >/dev/null 2>&1; then
  echo "No se encontró pnpm. Instalá Node.js >= 20 y pnpm para usar la ventana de escritorio."
  read -r -p "Presioná Enter para cerrar esta ventana..."
  exit 1
fi

if [ ! -d "desktop/node_modules/electron" ]; then
  echo "Instalando dependencias de la ventana de escritorio..."
  pnpm --dir desktop install
fi

exec pnpm --dir desktop start

#!/usr/bin/env bash
# =============================================================================
# Prosecnur-dev.command — launcher temporal para macOS
# =============================================================================
# Workaround mientras no exista un instalable firmado y autocontenido
# (P-f + P-g del plan). Doble click en Finder abre este .command en
# Terminal.app, que ya tiene permiso TCC a ~/Documents — evita el
# bloqueo que macOS hace al .app unsigned cuando el repo vive en una
# carpeta protegida.
#
# Efecto equivalente a Prosecnur.app en modo DEV:
#   - cd al directorio del repo.
#   - make desktop → pnpm build del frontend + pnpm --dir desktop start
#     (que arranca Electron; Electron a su vez spawea Rscript launch.R).
#
# Diferencia con el .app:
#   - Abre una ventana de Terminal visible que muestra la salida.
#   - Sin checks explícitos de toolchain ni install-r-deps automático
#     (make install-r/install-frontend/install-desktop deben haberse
#     corrido al menos una vez).

set -euo pipefail
cd "$(dirname "$0")"

# Si falta algún setup inicial, avisar y ofrecer correrlo.
if ! command -v Rscript >/dev/null 2>&1; then
  echo "❌ Falta Rscript. Instala R 4.1+ desde https://cran.r-project.org"
  echo "Presiona Enter para cerrar..."
  read -r
  exit 1
fi
if ! command -v pnpm >/dev/null 2>&1; then
  echo "❌ Falta pnpm. Ejecuta: corepack enable  (o npm install -g pnpm)"
  echo "Presiona Enter para cerrar..."
  read -r
  exit 1
fi

# Primera vez: dependencias.
if [ ! -d "frontend/node_modules" ]; then
  echo "→ pnpm install en frontend/ (primera vez)..."
  pnpm --dir frontend install
fi
if [ ! -d "desktop/node_modules/electron" ]; then
  echo "→ pnpm install en desktop/ (primera vez)..."
  pnpm --dir desktop install
fi

# Paquetes R: sentinel en Application Support para no repetir.
R_SENTINEL="$HOME/Library/Application Support/Prosecnur/r-deps-installed"
if [ ! -f "$R_SENTINEL" ]; then
  echo "→ Instalando paquetes R (primera vez, puede tomar varios minutos)..."
  mkdir -p "$(dirname "$R_SENTINEL")"
  Rscript launcher/install-r-deps.R && touch "$R_SENTINEL"
fi

# Levantar la app via make desktop. exec reemplaza el proceso bash con
# make para que Ctrl+C en Terminal mate todo limpio.
echo "→ Lanzando Prosecnur..."
exec make desktop

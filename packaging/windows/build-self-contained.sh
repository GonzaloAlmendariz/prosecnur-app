#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

PACKAGE_NAME="Prosecnur-Windows"
DIST_ROOT="$ROOT/dist.nosync"
CACHE_DIR="$DIST_ROOT/windows-cache"
STAGING="$DIST_ROOT/.windows-staging/$PACKAGE_NAME"
OUT_DIR="$DIST_ROOT/$PACKAGE_NAME"
ZIP_PATH="$DIST_ROOT/${PACKAGE_NAME}-self-contained.zip"

R_VERSION="${PROSECNUR_R_VERSION:-4.5.1}"
ELECTRON_VERSION="${PROSECNUR_ELECTRON_VERSION:-$(node -p "require('./desktop/package.json').devDependencies.electron.replace(/^[^0-9.]*/, '')")}"
R_INSTALLER="R-${R_VERSION}-win.exe"
ELECTRON_ZIP="electron-v${ELECTRON_VERSION}-win32-x64.zip"

mkdir -p "$CACHE_DIR" "$DIST_ROOT"

echo "[Prosecnur] Build frontend..."
make build

mkdir -p "$CACHE_DIR/r-installer" "$CACHE_DIR/r-packages" "$CACHE_DIR/electron"

if [ ! -s "$CACHE_DIR/r-installer/$R_INSTALLER" ]; then
  echo "[Prosecnur] Descargando R $R_VERSION para Windows..."
  if ! curl -fL "https://cloud.r-project.org/bin/windows/base/$R_INSTALLER" -o "$CACHE_DIR/r-installer/$R_INSTALLER"; then
    curl -fL "https://cloud.r-project.org/bin/windows/base/old/$R_VERSION/$R_INSTALLER" -o "$CACHE_DIR/r-installer/$R_INSTALLER"
  fi
else
  echo "[cache] $R_INSTALLER"
fi

if [ ! -s "$CACHE_DIR/electron/$ELECTRON_ZIP" ]; then
  echo "[Prosecnur] Descargando Electron $ELECTRON_VERSION win32-x64..."
  curl -fL "https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/${ELECTRON_ZIP}" -o "$CACHE_DIR/electron/$ELECTRON_ZIP"
else
  echo "[cache] $ELECTRON_ZIP"
fi

echo "[Prosecnur] Descargando/actualizando paquetes R Windows offline..."
Rscript packaging/windows/download-r-win-binaries.R "$CACHE_DIR/r-packages" "$R_VERSION"

rm -rf "$STAGING" "$OUT_DIR" "$ZIP_PATH"
mkdir -p "$STAGING/Internals" "$STAGING/runtime/electron" "$STAGING/runtime/r-installer" "$STAGING/runtime/r-packages"

echo "[Prosecnur] Armando Internals..."
rsync -a --delete --exclude ".DS_Store" --exclude "tests" api/ "$STAGING/Internals/api/"
rsync -a --delete --exclude ".DS_Store" launcher/ "$STAGING/Internals/launcher/"
rsync -a --delete --exclude ".DS_Store" --exclude "node_modules" desktop/ "$STAGING/Internals/desktop/"
mkdir -p "$STAGING/Internals/offline-r"
cp packaging/windows/install-r-deps-offline.R "$STAGING/Internals/offline-r/install-r-deps-offline.R"

echo "[Prosecnur] Armando runtime..."
unzip -q "$CACHE_DIR/electron/$ELECTRON_ZIP" -d "$STAGING/runtime/electron"
cp "$CACHE_DIR/r-installer/$R_INSTALLER" "$STAGING/runtime/r-installer/$R_INSTALLER"
rsync -a --delete "$CACHE_DIR/r-packages/" "$STAGING/runtime/r-packages/"

cp packaging/windows/Prosecnur.bat "$STAGING/Prosecnur.bat"
cp LICENSE "$STAGING/LICENSE"
cp README.md "$STAGING/README_DESARROLLO.md"
cp packaging/LEEME_PRIMERO.md "$STAGING/LEEME_PRIMERO.md"

mv "$STAGING" "$OUT_DIR"
rm -rf "$DIST_ROOT/.windows-staging"

echo "[Prosecnur] Comprimiendo ZIP autosuficiente..."
(cd "$DIST_ROOT" && zip -qr "$(basename "$ZIP_PATH")" "$PACKAGE_NAME")

echo ""
echo "Bundle Windows listo:"
echo "  $OUT_DIR"
echo "ZIP autosuficiente:"
echo "  $ZIP_PATH"

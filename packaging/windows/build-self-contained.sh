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
INSTALLER_PATH="$DIST_ROOT/Prosecnur-Setup.exe"
ASSETS_DIR="$DIST_ROOT/windows-installer-assets"

R_VERSION="${PROSECNUR_R_VERSION:-4.5.1}"
ELECTRON_VERSION="${PROSECNUR_ELECTRON_VERSION:-$(node -p "require('./desktop/package.json').devDependencies.electron.replace(/^[^0-9.]*/, '')")}"
APP_VERSION="$(awk -F': *' '/^Version:/ {print $2; exit}' api/DESCRIPTION)"
if [ -z "$APP_VERSION" ]; then
  echo "[Prosecnur] ERROR: no pude leer Version: de api/DESCRIPTION" >&2
  exit 1
fi
echo "[Prosecnur] Version del paquete: $APP_VERSION"
R_INSTALLER="R-${R_VERSION}-win.exe"
ELECTRON_ZIP="electron-v${ELECTRON_VERSION}-win32-x64.zip"

mkdir -p "$CACHE_DIR" "$DIST_ROOT"
mkdir -p "$ASSETS_DIR"

echo "[Prosecnur] Preparando assets del instalador..."
# Renderizamos los SVGs de packaging/windows/brand/ — replica fiel del HeroLogo
# del home (frontend/src/features/home/HomePage.tsx) + wordmark "Prosecnur".
# Requiere rsvg-convert (brew install librsvg) y ImageMagick.
if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "[Prosecnur] ERROR: falta rsvg-convert. Instala con: brew install librsvg" >&2
  exit 1
fi

# ImageMagick 7 expone el binario `magick`; ImageMagick 6 (apt en Ubuntu) usa
# `convert`. Detectamos cual esta disponible para que el script corra en
# ambas plataformas (mac brew = v7, GH Actions ubuntu = v6).
if command -v magick >/dev/null 2>&1; then
  IM_CMD="magick"
elif command -v convert >/dev/null 2>&1; then
  IM_CMD="convert"
else
  echo "[Prosecnur] ERROR: no encontre ImageMagick (ni 'magick' ni 'convert')." >&2
  echo "  → mac: brew install imagemagick   linux: apt install imagemagick" >&2
  exit 1
fi

BRAND_DIR="$ROOT/packaging/windows/brand"
ICON_TMP="$ASSETS_DIR/.icon-tmp"
mkdir -p "$ICON_TMP"
for size in 16 32 48 64 128 256; do
  rsvg-convert -w "$size" -h "$size" "$BRAND_DIR/icon.svg" -o "$ICON_TMP/icon-$size.png"
done
$IM_CMD "$ICON_TMP/icon-16.png" "$ICON_TMP/icon-32.png" "$ICON_TMP/icon-48.png" \
       "$ICON_TMP/icon-64.png" "$ICON_TMP/icon-128.png" "$ICON_TMP/icon-256.png" \
       "$ASSETS_DIR/prosecnur.ico"
rm -rf "$ICON_TMP"

# wizard.bmp (164x314) y header.bmp (150x57): NSIS exige BMP3 (sin canal alpha).
rsvg-convert -w 164 -h 314 "$BRAND_DIR/wizard.svg" -o "$ASSETS_DIR/wizard.png"
rsvg-convert -w 150 -h 57 "$BRAND_DIR/header.svg" -o "$ASSETS_DIR/header.png"
$IM_CMD "$ASSETS_DIR/wizard.png" -background white -alpha remove -alpha off BMP3:"$ASSETS_DIR/wizard.bmp"
$IM_CMD "$ASSETS_DIR/header.png" -background white -alpha remove -alpha off BMP3:"$ASSETS_DIR/header.bmp"

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

rm -rf "$STAGING" "$OUT_DIR" "$ZIP_PATH" "$INSTALLER_PATH"
mkdir -p "$STAGING/Internals" "$STAGING/runtime/electron" "$STAGING/runtime/r-installer" "$STAGING/runtime/r-packages" "$STAGING/assets"

echo "[Prosecnur] Armando Internals..."
rsync -a --delete --exclude ".DS_Store" --exclude "tests" api/ "$STAGING/Internals/api/"
rsync -a --delete --exclude ".DS_Store" launcher/ "$STAGING/Internals/launcher/"
rsync -a --delete --exclude ".DS_Store" --exclude "node_modules" desktop/ "$STAGING/Internals/desktop/"

# node_modules solo prod de desktop. electron-updater es runtime dep ahora,
# si no esta el require() en main.cjs falla. Resolvemos en una carpeta
# auxiliar para no contaminar el desktop/ del repo (que tiene devDeps como
# electron-builder ~100MB que no necesitamos en el bundle Windows).
echo "[Prosecnur] Instalando deps prod de desktop/..."
DESKTOP_PROD="$DIST_ROOT/.desktop-prod"
rm -rf "$DESKTOP_PROD"
mkdir -p "$DESKTOP_PROD"
cp desktop/package.json "$DESKTOP_PROD/"
cp desktop/pnpm-lock.yaml "$DESKTOP_PROD/"
(cd "$DESKTOP_PROD" && pnpm install --prod --silent --ignore-scripts --node-linker=hoisted)
mkdir -p "$STAGING/Internals/desktop/node_modules"
rsync -a "$DESKTOP_PROD/node_modules/" "$STAGING/Internals/desktop/node_modules/"
rm -rf "$DESKTOP_PROD"

mkdir -p "$STAGING/Internals/offline-r"
cp packaging/windows/install-r-deps-offline.R "$STAGING/Internals/offline-r/install-r-deps-offline.R"

echo "[Prosecnur] Armando runtime..."
unzip -q "$CACHE_DIR/electron/$ELECTRON_ZIP" -d "$STAGING/runtime/electron"
cp "$CACHE_DIR/r-installer/$R_INSTALLER" "$STAGING/runtime/r-installer/$R_INSTALLER"
rsync -a --delete "$CACHE_DIR/r-packages/" "$STAGING/runtime/r-packages/"

cp packaging/windows/Prosecnur.bat "$STAGING/Prosecnur.bat"
cp "$ASSETS_DIR/prosecnur.ico" "$STAGING/assets/prosecnur.ico"
cp LICENSE "$STAGING/LICENSE"
cp README.md "$STAGING/README_DESARROLLO.md"
cp packaging/LEEME_PRIMERO.md "$STAGING/LEEME_PRIMERO.md"

# Sincroniza la version en desktop/package.json del bundle (no toca el repo).
node -e "const fs=require('fs'); const p='$STAGING/Internals/desktop/package.json'; const j=JSON.parse(fs.readFileSync(p)); j.version='$APP_VERSION'; fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');"

mv "$STAGING" "$OUT_DIR"
rm -rf "$DIST_ROOT/.windows-staging"

echo "[Prosecnur] Comprimiendo ZIP autosuficiente..."
(cd "$DIST_ROOT" && zip -qr "$(basename "$ZIP_PATH")" "$PACKAGE_NAME")

echo "[Prosecnur] Compilando instalador clásico NSIS..."
makensis \
  "-DSOURCE_DIR=$OUT_DIR" \
  "-DOUTPUT_FILE=$INSTALLER_PATH" \
  "-DICON_FILE=$ASSETS_DIR/prosecnur.ico" \
  "-DWIZARD_BITMAP=$ASSETS_DIR/wizard.bmp" \
  "-DHEADER_BITMAP=$ASSETS_DIR/header.bmp" \
  "-DAPP_VERSION=$APP_VERSION" \
  packaging/windows/installer.nsi

echo "[Prosecnur] Generando latest.yml para electron-updater..."
LATEST_YML="$DIST_ROOT/latest.yml"
INSTALLER_BASENAME="$(basename "$INSTALLER_PATH")"
INSTALLER_SHA512="$(openssl dgst -sha512 -binary "$INSTALLER_PATH" | openssl base64 -A)"
INSTALLER_SIZE="$(wc -c < "$INSTALLER_PATH" | tr -d '[:space:]')"
RELEASE_DATE="$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")"
cat > "$LATEST_YML" <<EOF
version: $APP_VERSION
files:
  - url: $INSTALLER_BASENAME
    sha512: $INSTALLER_SHA512
    size: $INSTALLER_SIZE
path: $INSTALLER_BASENAME
sha512: $INSTALLER_SHA512
releaseDate: '$RELEASE_DATE'
EOF

echo ""
echo "Bundle Windows listo:"
echo "  $OUT_DIR"
echo "ZIP autosuficiente:"
echo "  $ZIP_PATH"
echo "Instalador clásico:"
echo "  $INSTALLER_PATH"
echo "Manifest del updater:"
echo "  $LATEST_YML"
echo ""
echo "Para publicar release:"
echo "  gh release create v$APP_VERSION \"$INSTALLER_PATH\" \"$LATEST_YML\" --title \"Prosecnur $APP_VERSION\" --notes \"...\""

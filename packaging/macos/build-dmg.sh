#!/usr/bin/env bash
# =============================================================================
# Prosecnur — generador del .dmg autosuficiente para macOS.
#
# Este script:
#   1. Lee la version de api/DESCRIPTION.
#   2. Genera icon.icns a partir del SVG de packaging/windows/brand/icon.svg.
#   3. Descarga R-4.5.1-{arm64,x86_64}.pkg desde CRAN.
#   4. Descarga los .tgz binarios de mac para todas las dependencias R.
#   5. Stagea packaging/macos/r-mac-runtime/ con el .pkg + paquetes + script
#      offline. electron-builder lo copia a Internals/r-mac-runtime/ del .app.
#   6. Ejecuta `electron-builder --mac --<arch>` para arm64 y x64. Cada
#      invocacion produce un .dmg independiente (uno arm64, uno x64) y un
#      latest-mac.yml combinado para el auto-updater.
#
# Requiere: rsvg-convert (brew install librsvg), Rscript con conexion a CRAN,
# Node 20+ con pnpm, iconutil (built-in macOS), curl. NO requiere XCode ni
# certificados Apple Developer (las builds quedan sin firmar — Gatekeeper
# pedira al usuario aprobar manualmente la primera vez).
#
# Uso:
#   bash packaging/macos/build-dmg.sh
#   # solo arm64:
#   PROSECNUR_DMG_ARCHS=arm64 bash packaging/macos/build-dmg.sh
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

DIST_ROOT="$ROOT/dist.nosync"
CACHE_DIR="$DIST_ROOT/mac-cache"
BUILD_RES="$ROOT/packaging/macos/build-resources"
RUNTIME_DIR="$ROOT/packaging/macos/r-mac-runtime"
ICON_SVG="$ROOT/packaging/windows/brand/icon.svg"

R_VERSION="${PROSECNUR_R_VERSION:-4.5.1}"
ARCHS="${PROSECNUR_DMG_ARCHS:-arm64 x64}"
APP_VERSION="$(awk -F': *' '/^Version:/ {print $2; exit}' api/DESCRIPTION)"
if [ -z "$APP_VERSION" ]; then
  echo "[Prosecnur] ERROR: no pude leer Version: de api/DESCRIPTION" >&2
  exit 1
fi
echo "[Prosecnur] Version: $APP_VERSION"
echo "[Prosecnur] Architectures: $ARCHS"

# ----- pre-checks -----------------------------------------------------------
for cmd in rsvg-convert iconutil curl Rscript pnpm; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[Prosecnur] ERROR: falta '$cmd'." >&2
    [ "$cmd" = "rsvg-convert" ] && echo "  → brew install librsvg" >&2
    [ "$cmd" = "pnpm" ] && echo "  → corepack enable" >&2
    exit 1
  fi
done

mkdir -p "$CACHE_DIR" "$DIST_ROOT" "$BUILD_RES"

# ----- 1. frontend bundle ---------------------------------------------------
echo "[Prosecnur] Build frontend..."
make build

# ----- 2. icon.icns desde el SVG --------------------------------------------
ICON_ICNS="$BUILD_RES/icon.icns"
if [ ! -s "$ICON_ICNS" ] || [ "$ICON_SVG" -nt "$ICON_ICNS" ]; then
  echo "[Prosecnur] Generando icon.icns..."
  ICONSET="$BUILD_RES/icon.iconset"
  rm -rf "$ICONSET"
  mkdir -p "$ICONSET"
  # Apple iconset convention: pares por size (1x y 2x).
  for size in 16 32 128 256 512; do
    rsvg-convert -w "$size" -h "$size" "$ICON_SVG" -o "$ICONSET/icon_${size}x${size}.png"
    rsvg-convert -w "$((size*2))" -h "$((size*2))" "$ICON_SVG" -o "$ICONSET/icon_${size}x${size}@2x.png"
  done
  iconutil -c icns "$ICONSET" -o "$ICON_ICNS"
  rm -rf "$ICONSET"
fi

# ----- 3. sincronizar version en desktop/package.json -----------------------
node -e "const fs=require('fs'); const p='$ROOT/desktop/package.json'; const j=JSON.parse(fs.readFileSync(p)); j.version='$APP_VERSION'; fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');"

# ----- 4. instalar deps de desktop ------------------------------------------
echo "[Prosecnur] pnpm install en desktop/..."
(cd "$ROOT/desktop" && pnpm install --frozen-lockfile)

# ----- 5. helper: stage runtime de R por arch -------------------------------
# CRAN usa nombres "arm64" y "x86_64" para macOS. electron-builder usa "arm64"
# y "x64". Mantenemos un mapeo: arch_eb=arm64|x64, arch_cran=arm64|x86_64.
arch_cran_for() {
  case "$1" in
    arm64) echo "arm64" ;;
    x64)   echo "x86_64" ;;
    *) echo "arch desconocida: $1" >&2; exit 1 ;;
  esac
}

build_for_arch() {
  local arch_eb="$1"
  local arch_cran
  arch_cran="$(arch_cran_for "$arch_eb")"

  echo ""
  echo "===================================================================="
  echo "[Prosecnur] Build mac $arch_eb (CRAN: $arch_cran)"
  echo "===================================================================="

  # 5a. R-installer .pkg cacheado.
  local r_pkg="R-$R_VERSION-$arch_cran.pkg"
  local r_pkg_cache="$CACHE_DIR/r-installer/$r_pkg"
  mkdir -p "$CACHE_DIR/r-installer"
  if [ ! -s "$r_pkg_cache" ]; then
    echo "[Prosecnur] Descargando $r_pkg..."
    curl -fL "https://cloud.r-project.org/bin/macosx/big-sur-$arch_cran/base/$r_pkg" -o "$r_pkg_cache"
  else
    echo "[cache] $r_pkg"
  fi

  # 5b. paquetes R binarios mac.
  local pkgs_cache="$CACHE_DIR/r-packages-$arch_cran"
  mkdir -p "$pkgs_cache"
  echo "[Prosecnur] Descargando/actualizando paquetes R binarios mac ($arch_cran)..."
  Rscript packaging/macos/download-r-mac-binaries.R "$pkgs_cache" "$R_VERSION" "$arch_cran"

  # 5c. stagear runtime para esta build.
  rm -rf "$RUNTIME_DIR"
  mkdir -p "$RUNTIME_DIR/r-packages"
  cp "$r_pkg_cache" "$RUNTIME_DIR/$r_pkg"
  cp "$pkgs_cache/"*.tgz "$RUNTIME_DIR/r-packages/" 2>/dev/null || true
  cp "$pkgs_cache/manifest.csv" "$RUNTIME_DIR/r-packages/manifest.csv" 2>/dev/null || true
  cp packaging/macos/install-r-deps-offline.R "$RUNTIME_DIR/install-r-deps-offline.R"

  # 5d. correr electron-builder. --publish=never genera el dmg + latest-mac.yml
  # localmente sin subir nada; el `gh release create` aparte se encarga de eso.
  echo "[Prosecnur] Corriendo electron-builder --mac --$arch_eb..."
  (cd "$ROOT/desktop" && pnpm exec electron-builder --mac --"$arch_eb" --publish=never)
}

# ----- 6. ejecutar builds por arch ------------------------------------------
for arch in $ARCHS; do
  build_for_arch "$arch"
done

# ----- 7. limpiar runtime stage --------------------------------------------
rm -rf "$RUNTIME_DIR"

echo ""
echo "DMGs listos en:"
ls -la "$DIST_ROOT/mac-builder-output/"*.dmg 2>/dev/null || echo "  (no se generaron .dmg)"
echo ""
echo "Manifest del updater:"
ls -la "$DIST_ROOT/mac-builder-output/latest-mac.yml" 2>/dev/null || true
echo ""
echo "Para publicar release con todos los assets (Windows + Mac):"
echo "  gh release create v$APP_VERSION \\"
echo "    \"$DIST_ROOT/Prosecnur-Setup.exe\" \\"
echo "    \"$DIST_ROOT/latest.yml\" \\"
echo "    \"$DIST_ROOT/mac-builder-output/\"*.dmg \\"
echo "    \"$DIST_ROOT/mac-builder-output/latest-mac.yml\" \\"
echo "    --title \"Prosecnur $APP_VERSION\" --notes \"...\""

#!/usr/bin/env bash
# =============================================================================
# Prosecnur — staging del LibreOffice que viaja en el .app de macOS (F6.0b,
# plan de empaquetado P6; docs/qa/inventario-f6-editor-2026-10-09.md, Parte D).
#
#   bash packaging/macos/stage-preview-renderer.sh <arm64|x64> [destino]
#
# 1. Obtiene el DMG de TDF con scripts/fetch-preview-renderer.mjs, que se niega
#    si el sha256 no coincide con packaging/preview-renderer.lock.json.
# 2. Lo monta solo lectura, copia LibreOffice.app con `ditto` (conserva
#    symlinks de los frameworks, permisos y la firma de TDF) y lo desmonta.
# 3. Verifica sobre la copia que el binario es de la arquitectura pedida
#    (`lipo -archs`) y que la firma de TDF sigue intacta
#    (`codesign --verify --deep --strict`). Cualquier fallo aborta.
#
# Destino por defecto: packaging/macos/preview-renderer/<arch>/LibreOffice.app
# (gitignorado). desktop/scripts/after-pack-mac.cjs lo copia después a
# Contents/Resources/Internals/preview-renderer/ del .app.
#
# Caché de descargas: PROSECNUR_PREVIEW_RENDERER_CACHE o, por defecto,
# dist.nosync/mac-cache/preview-renderer. No firma, no publica, no instala.
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

ARCH_EB="${1:-}"
case "$ARCH_EB" in
  arm64) LOCK_KEY="mac-arm64"; LIPO_ARCH="arm64" ;;
  x64)   LOCK_KEY="mac-x64";   LIPO_ARCH="x86_64" ;;
  *)
    echo "[preview-renderer] uso: $0 <arm64|x64> [destino]" >&2
    exit 2
    ;;
esac

DEST_DIR="${2:-$ROOT/packaging/macos/preview-renderer/$ARCH_EB}"
CACHE="${PROSECNUR_PREVIEW_RENDERER_CACHE:-$ROOT/dist.nosync/mac-cache/preview-renderer}"

for cmd in node hdiutil ditto lipo codesign; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[preview-renderer] ERROR: falta '$cmd'." >&2
    exit 1
  fi
done

echo "[preview-renderer] Obteniendo LibreOffice ($LOCK_KEY) verificado contra el lock..."
DMG="$(node "$ROOT/scripts/fetch-preview-renderer.mjs" "$LOCK_KEY" --cache "$CACHE")"
if [ ! -s "$DMG" ]; then
  echo "[preview-renderer] ERROR: el fetcher no devolvió un DMG ($DMG)." >&2
  exit 1
fi

MOUNT_POINT="$(mktemp -d "${TMPDIR:-/tmp}/prosecnur-lo-mount.XXXXXX")"
MOUNTED=0
detach() {
  if [ "$MOUNTED" = "1" ]; then
    hdiutil detach "$MOUNT_POINT" -quiet || hdiutil detach "$MOUNT_POINT" -force -quiet || true
    MOUNTED=0
  fi
  rmdir "$MOUNT_POINT" 2>/dev/null || true
}
trap detach EXIT

hdiutil attach -readonly -nobrowse -noautoopen -mountpoint "$MOUNT_POINT" "$DMG" >/dev/null
MOUNTED=1

SOURCE_APP="$MOUNT_POINT/LibreOffice.app"
if [ ! -x "$SOURCE_APP/Contents/MacOS/soffice" ]; then
  echo "[preview-renderer] ERROR: el DMG no trae LibreOffice.app/Contents/MacOS/soffice." >&2
  exit 1
fi

TARGET_APP="$DEST_DIR/LibreOffice.app"
rm -rf "$TARGET_APP"
mkdir -p "$DEST_DIR"
echo "[preview-renderer] Copiando LibreOffice.app a $DEST_DIR ..."
ditto "$SOURCE_APP" "$TARGET_APP"
detach

# Los permisos de lectura de quien construye no garantizan que sea ejecutable.
SOFFICE="$TARGET_APP/Contents/MacOS/soffice"
if [ ! -x "$SOFFICE" ]; then
  echo "[preview-renderer] ERROR: la copia perdió el ejecutable soffice." >&2
  exit 1
fi

ARCHS_FOUND="$(lipo -archs "$SOFFICE")"
echo "[preview-renderer] lipo -archs soffice: $ARCHS_FOUND"
case " $ARCHS_FOUND " in
  *" $LIPO_ARCH "*) ;;
  *)
    echo "[preview-renderer] ERROR: soffice no es $LIPO_ARCH (es: $ARCHS_FOUND)." >&2
    exit 1
    ;;
esac

echo "[preview-renderer] codesign --verify --deep --strict sobre la copia..."
codesign --verify --deep --strict "$TARGET_APP"

echo "[preview-renderer] OK $(du -sh "$TARGET_APP" | cut -f1) en $TARGET_APP"

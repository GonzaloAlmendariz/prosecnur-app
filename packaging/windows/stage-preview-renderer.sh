#!/usr/bin/env bash
# =============================================================================
# Prosecnur — staging del LibreOffice que viaja en el instalador de Windows
# (F6.0b, plan de empaquetado P7; docs/qa/inventario-f6-editor-2026-10-09.md,
# Parte D). Simétrico de packaging/macos/stage-preview-renderer.sh.
#
#   bash packaging/windows/stage-preview-renderer.sh [destino]
#
# 1. Obtiene el MSI de TDF con scripts/fetch-preview-renderer.mjs, que se niega
#    si el sha256 no coincide con packaging/preview-renderer.lock.json.
# 2. Lo extrae con `msiextract` (msitools) a un directorio de trabajo hermano
#    del destino y mueve el árbol que contiene program/soffice.exe a
#    <destino>/LibreOffice. Nada de lo que el MSI instalaría fuera de su carpeta
#    (Fonts, System, System64, accesos, registro) entra en el payload.
# 3. CRT de Visual C++: el MSI lo trae como merge modules que al instalar van a
#    System32, así que extraer no lo deja en program/. Además System64 recibe
#    dos variantes (amd64 y arm64) en la misma ruta y msiextract deja la última:
#    con 26.2.6.3 quedaban DLL arm64. Por eso las DLL se sacan del CAB con
#    `gcab` por su clave `<dll>_amd64.<GUID>` (scripts/preview-renderer-win.mjs)
#    y se copian a program/ sin pisar nada que TDF ya ponga ahí (despliegue
#    app-local del CRT, el que Microsoft admite junto al ejecutable).
# 4. Verifica que existan program/soffice.exe y vcruntime140.dll, vcruntime140_1
#    y msvcp140 en program/, y que sean PE x86-64. Cualquier fallo aborta.
#
# Destino por defecto: packaging/windows/preview-renderer (gitignorado).
# build-self-contained.sh lo stagea directo en runtime/preview-renderer del
# bundle, que es donde lo buscan desktop/preview-renderer.cjs y
# .preview_renderer_roots en api/R/router_graficos.R
# (<raíz>/runtime/preview-renderer/LibreOffice/program/soffice.exe).
#
# Requiere: node, msiextract, msiinfo y gcab (macOS: brew install msitools;
# Ubuntu: apt install msitools gcab). Caché de descargas:
# PROSECNUR_PREVIEW_RENDERER_CACHE o, por defecto,
# dist.nosync/windows-cache/preview-renderer. No firma, no publica, no instala.
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOCK_KEY="win-x64"
HELPER="$ROOT/scripts/preview-renderer-win.mjs"

DEST_DIR="${1:-$ROOT/packaging/windows/preview-renderer}"
DEST_DIR="${DEST_DIR%/}"
CACHE="${PROSECNUR_PREVIEW_RENDERER_CACHE:-$ROOT/dist.nosync/windows-cache/preview-renderer}"

for cmd in node msiextract msiinfo gcab; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[preview-renderer] ERROR: falta '$cmd' (macOS: brew install msitools; Ubuntu: apt install msitools gcab)." >&2
    exit 1
  fi
done

echo "[preview-renderer] Obteniendo LibreOffice ($LOCK_KEY) verificado contra el lock..."
MSI="$(node "$ROOT/scripts/fetch-preview-renderer.mjs" "$LOCK_KEY" --cache "$CACHE")"
if [ ! -s "$MSI" ]; then
  echo "[preview-renderer] ERROR: el fetcher no devolvió un MSI ($MSI)." >&2
  exit 1
fi

# Trabajo hermano del destino: el árbol (~1.4GB) se mueve, no se copia.
mkdir -p "$(dirname "$DEST_DIR")"
WORK="$(mktemp -d "$DEST_DIR.work.XXXXXX")"
cleanup_work() {
  rm -rf "$WORK"
}
trap cleanup_work EXIT

echo "[preview-renderer] msiextract (tarda ~2 min)..."
msiextract -C "$WORK/msi" "$MSI" >/dev/null

# msiextract nombra la carpeta con el DefaultDir crudo del MSI ("LibreOffice:."
# con msitools 0.106); no se adivina el nombre: se busca el soffice.exe.
SOFFICE_HITS=()
while IFS= read -r hit; do
  SOFFICE_HITS+=("$hit")
done < <(find "$WORK/msi" -mindepth 3 -maxdepth 3 -type f -path '*/program/soffice.exe')
if [ "${#SOFFICE_HITS[@]}" -ne 1 ]; then
  echo "[preview-renderer] ERROR: se esperaba un único */program/soffice.exe en el MSI; hay ${#SOFFICE_HITS[@]}." >&2
  exit 1
fi
SOURCE_TREE="$(dirname "$(dirname "${SOFFICE_HITS[0]}")")"

TARGET_TREE="$DEST_DIR/LibreOffice"
rm -rf "$TARGET_TREE"
mkdir -p "$DEST_DIR"
mv "$SOURCE_TREE" "$TARGET_TREE"
# Lo que el MSI instalaría fuera de su carpeta no viaja.
rm -rf "$WORK/msi"

PROGRAM="$TARGET_TREE/program"

echo "[preview-renderer] CRT de Visual C++ (amd64) desde el CAB del MSI..."
msiinfo export "$MSI" Media >"$WORK/media.tsv"
msiinfo export "$MSI" File >"$WORK/file.tsv"
CAB_NAME="$(node "$HELPER" cabinet "$WORK/media.tsv")"
node "$HELPER" crt-amd64 "$WORK/file.tsv" >"$WORK/crt.tsv"
msiinfo extract "$MSI" "$CAB_NAME" >"$WORK/msi.cab"
mkdir -p "$WORK/cab"
gcab -x -n -C "$WORK/cab" "$WORK/msi.cab"
rm -f "$WORK/msi.cab"

CRT_COPIED=()
while IFS=$'\t' read -r key name; do
  [ -n "$key" ] || continue
  if [ ! -s "$WORK/cab/$key" ]; then
    echo "[preview-renderer] ERROR: el CAB no trae $key." >&2
    exit 1
  fi
  if [ -e "$PROGRAM/$name" ]; then
    echo "[preview-renderer] program/$name ya viene de TDF; no se pisa."
    continue
  fi
  cp "$WORK/cab/$key" "$PROGRAM/$name"
  CRT_COPIED+=("$PROGRAM/$name")
done <"$WORK/crt.tsv"
rm -rf "$WORK/cab"

# ----- verificación fail-closed sobre el árbol final ----------------------
SOFFICE="$PROGRAM/soffice.exe"
for required in soffice.exe soffice.bin vcruntime140.dll vcruntime140_1.dll msvcp140.dll; do
  if [ ! -s "$PROGRAM/$required" ]; then
    echo "[preview-renderer] ERROR: falta program/$required en el staging." >&2
    exit 1
  fi
done
node "$HELPER" pe-amd64 "$SOFFICE" "$PROGRAM/soffice.bin" \
  "$PROGRAM/vcruntime140.dll" "$PROGRAM/vcruntime140_1.dll" "$PROGRAM/msvcp140.dll" \
  ${CRT_COPIED[@]+"${CRT_COPIED[@]}"}

FILE_COUNT="$(find "$TARGET_TREE" -type f | wc -l | tr -d '[:space:]')"
echo "[preview-renderer] CRT copiado a program/: ${#CRT_COPIED[@]} DLL"
echo "[preview-renderer] OK $(du -sh "$TARGET_TREE" | cut -f1) en $FILE_COUNT archivos: $TARGET_TREE"

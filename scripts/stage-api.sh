#!/usr/bin/env bash
# Copia api/ al staging de un instalador por LISTA PERMITIDA: sólo lo versionado
# en git, más el build del front (inst/www, generado y no versionado).
#
# Existe porque copy-tree.sh copia el árbol de trabajo entero con una lista negra,
# y un build local arrastraba lo que hay en la máquina: auditorías en CSV de
# api/outputs, plantillas .bak, Rplots.pdf, historial de R. Fuera de git (un
# tarball) cae a la lista negra y avisa.
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "uso: stage-api.sh SRC DST" >&2
  exit 2
fi

SRC="$1"
DST="$2"

if [ ! -f "$SRC/DESCRIPTION" ]; then
  echo "stage-api.sh: $SRC no es el paquete (falta DESCRIPTION)" >&2
  exit 1
fi
if [ ! -f "$SRC/inst/www/index.html" ]; then
  echo "stage-api.sh: falta $SRC/inst/www/index.html; corre 'make build' antes de empaquetar" >&2
  exit 1
fi

python3 - "$SRC" "$DST" <<'PY'
import fnmatch
import os
import shutil
import subprocess
import sys

src = os.path.abspath(sys.argv[1])
dst = os.path.abspath(sys.argv[2])

# Generado y necesario en runtime: no está en git.
GENERADOS = ["inst/www"]
# Nunca viajan, ni versionados ni sin versionar (por componente de ruta).
EXCLUIDOS = ["tests", "outputs", "man", ".DS_Store", ".Rhistory", ".RData", ".Ruserdata",
             "Rplots.pdf", "*.bak", "*.bak_*", "_problems", "00LOCK-*"]


def excluido(rel):
    return any(fnmatch.fnmatch(parte, patron) for parte in rel.split("/") for patron in EXCLUIDOS)


def recorrer(base):
    for root, dirs, files in os.walk(os.path.join(src, base)):
        dirs[:] = [d for d in dirs if not excluido(d)]
        for f in files:
            yield os.path.relpath(os.path.join(root, f), src).replace(os.sep, "/")


try:
    salida = subprocess.run(["git", "-C", src, "ls-files", "-z"], check=True, capture_output=True).stdout
    rutas = [r for r in salida.decode("utf-8").split("\0") if r]
except (OSError, subprocess.CalledProcessError):
    print("stage-api.sh: AVISO: %s no está en un repo git; se copia el árbol con lista negra" % src, file=sys.stderr)
    rutas = list(recorrer("."))

for g in GENERADOS:
    rutas.extend(recorrer(g))

copiados = 0
for rel in sorted(set(rutas)):
    if excluido(rel):
        continue
    origen = os.path.join(src, rel)
    if not os.path.isfile(origen):  # versionado pero borrado en el árbol de trabajo
        continue
    destino = os.path.join(dst, rel)
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    shutil.copy2(origen, destino)
    copiados += 1

print("stage-api.sh: %d archivos de %s" % (copiados, src))
PY

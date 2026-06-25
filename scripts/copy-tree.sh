#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "uso: copy-tree.sh SRC DST [EXCLUDE...]" >&2
  exit 2
fi

SRC="$1"
DST="$2"
shift 2

if [ ! -d "$SRC" ]; then
  echo "copy-tree.sh: no existe el directorio fuente: $SRC" >&2
  exit 1
fi

python3 - "$SRC" "$DST" "$@" ".DS_Store" ".Rhistory" ".RData" ".Ruserdata" <<'PY'
import os
import stat
import sys

src = os.path.abspath(sys.argv[1])
dst = os.path.abspath(sys.argv[2])
excludes = set(sys.argv[3:])


def relpath(path):
    rel = os.path.relpath(path, src)
    return "" if rel == "." else rel


def ensure_dir(path):
    os.makedirs(path, exist_ok=True)


def copy_mode(source, target):
    try:
        mode = stat.S_IMODE(os.lstat(source).st_mode)
        os.chmod(target, mode)
    except OSError:
        pass


def copy_file(source, target):
    ensure_dir(os.path.dirname(target))
    if os.path.getsize(source) == 0:
        open(target, "wb").close()
        copy_mode(source, target)
        return
    with open(source, "rb", buffering=0) as reader, open(target, "wb", buffering=0) as writer:
        while True:
            chunk = reader.read(1024 * 1024)
            if not chunk:
                break
            writer.write(chunk)
    copy_mode(source, target)


def copy_link(source, target):
    ensure_dir(os.path.dirname(target))
    try:
        os.unlink(target)
    except FileNotFoundError:
        pass
    os.symlink(os.readlink(source), target)


ensure_dir(dst)

for root, dirs, files in os.walk(src, topdown=True, followlinks=False):
    dirs_to_descend = []
    for dirname in dirs:
        if dirname in excludes:
            continue
        source_dir = os.path.join(root, dirname)
        target_dir = os.path.join(dst, relpath(source_dir))
        if os.path.islink(source_dir):
            copy_link(source_dir, target_dir)
        else:
            ensure_dir(target_dir)
            dirs_to_descend.append(dirname)
    dirs[:] = dirs_to_descend

    for filename in files:
        if filename in excludes:
            continue
        source_file = os.path.join(root, filename)
        target_file = os.path.join(dst, relpath(source_file))
        if os.path.islink(source_file):
            copy_link(source_file, target_file)
        elif os.path.isfile(source_file):
            copy_file(source_file, target_file)
PY

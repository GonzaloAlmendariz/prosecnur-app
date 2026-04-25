#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
exec Rscript launcher/install-r-deps.R

#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
Rscript launcher/install-r-deps.R
echo ""
echo "Listo. Ya podés abrir Prosecnur."
read -r -p "Presioná Enter para cerrar esta ventana..."

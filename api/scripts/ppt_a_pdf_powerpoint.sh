#!/bin/bash
# Exporta un .pptx a PDF con PowerPoint DE VERDAD (no LibreOffice, que
# reinterpreta el OOXML). PowerPoint esta en sandbox: la salida tiene que caer
# bajo ~/Documents. La ruta se interpola en el script — pasarla por `argv` da
# «Parameter error (-50)» al coercionar a `POSIX file`.
set -e
IN="$1"; OUT="$2"
rm -f "$OUT"
osascript <<EOF
tell application "Microsoft PowerPoint"
	launch
	with timeout of 900 seconds
		open "$IN"
		set pres to active presentation
		save pres in (POSIX file "$OUT") as save as PDF
		close pres saving no
	end timeout
end tell
EOF
[ -f "$OUT" ] && echo "  ok: $(basename "$OUT") $(pdfinfo "$OUT" | awk '/Pages/{print $2}') paginas" || { echo "  FALLO: no se creo $OUT"; exit 1; }

#!/usr/bin/env bash
# =============================================================================
# instalar-lanzador-mac.sh — lanzador de escritorio para la versión de desarrollo
# =============================================================================
# Instala ~/Applications/Prosecnur.app: un clic abre la versión de desarrollo
# (lo mismo que Prosecnur-dev.command) sin ventana de Terminal y con el ícono
# oficial. Existe porque un alias del Finder a un .command siempre se dibuja
# con el ícono genérico de documento, aunque el .command tenga ícono propio;
# solo un bundle .app muestra el logo.
#
# No reemplaza al instalable firmado (packaging/): es el atajo de desarrollo.
# Si se mueve la carpeta del repo, volver a correrlo. Reejecutarlo deja un
# bundle equivalente, pero no es inocuo: cambia el cdhash y con eso macOS
# olvida el permiso de disco, que hay que reconceder a mano.
#
#   bash scripts/instalar-lanzador-mac.sh
#
# Por qué un applet de AppleScript y no un .app con un script de shell dentro:
# el repo vive bajo ~/Documents, que macOS protege con TCC, así que el
# lanzador necesita que el usuario le dé «Acceso total al disco». Ese permiso
# se concede al binario del bundle, y en un .app cuyo ejecutable es un script
# el binario real es /bin/zsh —un binario de plataforma, que no puede
# sostener el permiso—. El resultado es que macOS niega el acceso en silencio,
# sin preguntar nada, aunque la app aparezca activada en Ajustes del Sistema:
# make arranca y muere con «getcwd: Operation not permitted». osacompile
# produce un bundle con binario propio (Contents/MacOS/applet), y el
# `do shell script` que lanza desde ahí sí hereda el permiso.
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LANZADOR="$HOME/Applications/Prosecnur.app"
ICNS_FUENTE="$REPO_ROOT/packaging/macos/build-resources/icon.icns"
PNG_FUENTE="$REPO_ROOT/desktop/assets/icon.png"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# El ícono se resuelve antes de tocar el disco: si falta, el `rm -rf` de abajo
# ya habría dejado un bundle a medias en ~/Applications.
if [ -f "$ICNS_FUENTE" ]; then
  ICONO_ORIGEN=icns
elif [ -f "$PNG_FUENTE" ]; then
  ICONO_ORIGEN=png
else
  echo "✗ No encontré ni $ICNS_FUENTE ni $PNG_FUENTE" >&2
  exit 1
fi

# Reinstalar borra el bundle desde debajo de un applet en ejecución, y además
# le cambia el cdhash, que es a lo que macOS ató el permiso de disco. Mejor
# negarse que dejar al usuario con la app caída y sin permiso.
if pgrep -f "Prosecnur.app/Contents/MacOS/applet" >/dev/null 2>&1; then
  echo "✗ El lanzador está abierto. Ciérralo (cierra la ventana de Prosecnur) y vuelve a correr esto." >&2
  exit 1
fi

mkdir -p "$HOME/Applications"
rm -rf "$LANZADOR"

# ── Bundle ───────────────────────────────────────────────────────────────────
# El applet solo despacha: toda la lógica vive en lanzador.sh, y los errores
# suben por stderr para que `do shell script` los convierta en una alerta.
cat > "$TMP/lanzador.applescript" <<'APPLESCRIPT'
on run
	set guion to POSIX path of (path to resource "lanzador.sh")
	try
		-- Sin timeout explícito, AppleScript abandonaría la espera a los dos
		-- minutos; aquí el shell queda vivo todo lo que dure la sesión.
		with timeout of 86400 seconds
			do shell script quoted form of guion
		end timeout
	on error mensaje number numero
		if numero is not -128 then
			display alert "Prosecnur no pudo abrir" message mensaje as critical
		end if
	end try
end run
APPLESCRIPT
osacompile -o "$LANZADOR" "$TMP/lanzador.applescript"

# ── Ícono ────────────────────────────────────────────────────────────────────
# El .icns canónico es el que usa el empaquetado de macOS. Si falta, se arma
# desde el PNG que Electron ya fija en el Dock durante dev (mismo logo).
# Conserva el nombre applet.icns que osacompile dejó en el Info.plist.
if [ "$ICONO_ORIGEN" = icns ]; then
  cp "$ICNS_FUENTE" "$LANZADOR/Contents/Resources/applet.icns"
  echo "✓ Ícono tomado de packaging/macos/build-resources/icon.icns"
else
  ICONSET="$TMP/Prosecnur.iconset"
  mkdir -p "$ICONSET"
  for t in 16 32 128 256 512; do
    sips -z "$t" "$t" "$PNG_FUENTE" --out "$ICONSET/icon_${t}x${t}.png" >/dev/null
    sips -z $((t * 2)) $((t * 2)) "$PNG_FUENTE" --out "$ICONSET/icon_${t}x${t}@2x.png" >/dev/null
  done
  iconutil -c icns "$ICONSET" -o "$LANZADOR/Contents/Resources/applet.icns"
  echo "✓ Ícono generado desde desktop/assets/icon.png"
fi

# ── Info.plist ───────────────────────────────────────────────────────────────
# Identificador distinto al del empaquetado (pe.pucp.prosecnur) para que
# LaunchServices no confunda el lanzador de dev con la app instalada.
# LSUIElement: el lanzador no ocupa el Dock; el ícono de ahí es el de Electron.
PLIST="$LANZADOR/Contents/Info.plist"
PB=/usr/libexec/PlistBuddy
"$PB" -c "Set :CFBundleName Prosecnur" "$PLIST"
"$PB" -c "Add :CFBundleDisplayName string Prosecnur" "$PLIST" 2>/dev/null \
  || "$PB" -c "Set :CFBundleDisplayName Prosecnur" "$PLIST"
"$PB" -c "Add :CFBundleIdentifier string pe.pucp.prosecnur.launcher" "$PLIST" 2>/dev/null \
  || "$PB" -c "Set :CFBundleIdentifier pe.pucp.prosecnur.launcher" "$PLIST"
"$PB" -c "Add :CFBundleShortVersionString string dev" "$PLIST" 2>/dev/null \
  || "$PB" -c "Set :CFBundleShortVersionString dev" "$PLIST"
"$PB" -c "Add :LSUIElement bool true" "$PLIST" 2>/dev/null \
  || "$PB" -c "Set :LSUIElement true" "$PLIST"
# osacompile deja CFBundleIconName apuntando al Assets.car que trae el
# pergamino genérico de AppleScript, y esa clave gana sobre CFBundleIconFile:
# sin quitarla, el .icns que acabamos de copiar no se ve en ningún sitio.
"$PB" -c "Delete :CFBundleIconName" "$PLIST" 2>/dev/null || true
rm -f "$LANZADOR/Contents/Resources/Assets.car"

# ── Lógica ───────────────────────────────────────────────────────────────────
# __REPO_ROOT__ se sustituye abajo para no pelear con el escapado del heredoc.
cat > "$LANZADOR/Contents/Resources/lanzador.sh" <<'LANZADOR_SH'
#!/bin/zsh
# Generado por scripts/instalar-lanzador-mac.sh — no editar a mano.
# Equivalente a Prosecnur-dev.command, pero sin Terminal visible: lo que el
# .command imprimía va al log, lo que preguntaba se decide sin stdin (un .app
# del Finder no tiene a quién preguntarle) y lo que mataba el arranque sale
# por stderr, que el applet convierte en una alerta.

# El Finder no hereda el PATH de la terminal.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

REPO_ROOT="__REPO_ROOT__"
LOG="$HOME/Library/Logs/Prosecnur-dev.log"
mkdir -p "$(dirname "$LOG")"

fallar() { print -r -- "$1" >&2; exit 1 }
avisar() {
  osascript -e 'on run argv
    display notification (item 1 of argv) with title "Prosecnur"
  end run' -- "$1" >/dev/null 2>&1
}

cd "$REPO_ROOT" 2>/dev/null || fallar "No encontré la carpeta del proyecto en:

$REPO_ROOT

Si moviste el repo, vuelve a correr scripts/instalar-lanzador-mac.sh"

: >"$LOG"
echo "[lanzador] $(date '+%Y-%m-%d %H:%M:%S') — repo: $REPO_ROOT" >>"$LOG"

# Primer acceso real a un archivo del repo, que vive bajo ~/Documents y está
# protegido por TCC. Sin esta sonda la denegación aparece recién dentro de
# make, como un «getcwd: Operation not permitted» que no dice qué hacer.
if ! head -c 1 Makefile >/dev/null 2>&1; then
  fallar "macOS no deja que Prosecnur lea la carpeta del proyecto:

$REPO_ROOT

Abre Ajustes del Sistema › Privacidad y seguridad › Acceso total al disco y activa Prosecnur. Si ya aparece activado, desactívalo y vuelve a activarlo: el permiso queda atado a la versión firmada del lanzador y reinstalarlo lo invalida."
fi
echo "[lanzador] acceso al repo verificado" >>"$LOG"

# ── Toolchain ───────────────────────────────────────────────────────────────
command -v Rscript >/dev/null 2>&1 || fallar "Falta Rscript.
Instala R 4.1+ desde https://cran.r-project.org"
command -v pnpm >/dev/null 2>&1 || fallar "Falta pnpm.
Ejecuta en Terminal: corepack enable"
command -v node >/dev/null 2>&1 || fallar "Falta Node.js.
Instálalo con: brew install node"
command -v make >/dev/null 2>&1 || fallar "Faltan las Command Line Tools.
Ejecuta en Terminal: xcode-select --install"
echo "[lanzador] toolchain verificado" >>"$LOG"

# ── Dependencias de primera vez ─────────────────────────────────────────────
# Sin Terminal visible no hay barra de progreso: avisamos por notificación
# porque los paquetes de R tardan varios minutos y la ventana no aparece aún.
R_SENTINEL="$HOME/Library/Application Support/Prosecnur/r-deps-installed"
if [ ! -d frontend/node_modules ] || [ ! -d desktop/node_modules/electron ] || [ ! -f "$R_SENTINEL" ]; then
  avisar "Instalando dependencias por primera vez. Puede tomar varios minutos."
fi

if [ ! -d frontend/node_modules ]; then
  echo "[lanzador] pnpm install en frontend/" >>"$LOG"
  pnpm --dir frontend install >>"$LOG" 2>&1 || fallar "Falló pnpm install en frontend/.
Revisa $LOG"
fi
if [ ! -d desktop/node_modules/electron ]; then
  echo "[lanzador] pnpm install en desktop/" >>"$LOG"
  pnpm --dir desktop install >>"$LOG" 2>&1 || fallar "Falló pnpm install en desktop/.
Revisa $LOG"
fi
if [ ! -f "$R_SENTINEL" ]; then
  echo "[lanzador] instalando paquetes R (primera vez)" >>"$LOG"
  mkdir -p "$(dirname "$R_SENTINEL")"
  Rscript launcher/install-r-deps.R >>"$LOG" 2>&1 \
    || fallar "Falló la instalación de paquetes R.
Revisa $LOG"
  touch "$R_SENTINEL"
fi

# Quarto es opcional (solo enumeradores PDF) y su check del .command es
# interactivo. Aquí no se pregunta nada: se anota y se sigue.
command -v quarto >/dev/null 2>&1 \
  || echo "[lanzador] sin Quarto CLI: los enumeradores PDF no estarán disponibles" >>"$LOG"

# ── Arranque ────────────────────────────────────────────────────────────────
case "${PROSECNUR_DEV_RENDERER:-static}" in
  static|bundle|"") MAKE_TARGET="desktop-fast" ;;
  vite|VITE)        MAKE_TARGET="dev-electron-vite" ;;
  *) fallar "PROSECNUR_DEV_RENDERER debe ser 'vite' o quedar vacío/static." ;;
esac
echo "[lanzador] make $MAKE_TARGET" >>"$LOG"

# En el cierre normal no hay nada que apagar desde aquí: al cerrarse la
# ventana, Electron apaga el motor R (before-quit en desktop/main.cjs) y make
# retorna solo. make va en segundo plano para poder atender señales y, si se
# fuerza el cierre del lanzador, propagar el apagado hacia abajo en vez de
# dejar Electron y el backend huérfanos.
#
# Nada de `set -m` aquí: en un zsh sin terminal de control, activar el control
# de trabajos aborta el script sin dejar rastro —el lanzador moría justo en esa
# línea y el log quedaba cortado en "make desktop-fast"—.
make "$MAKE_TARGET" >>"$LOG" 2>&1 &
MAKE_PID=$!

# El apagado recorre el árbol entero en anchura. `pkill -TERM -P $MAKE_PID`
# no basta: alcanza solo a los hijos DIRECTOS de make, y la cadena real es
# make -> bash -c -> pnpm -> electron -> Electron.app -> motor R, así que un
# cierre forzado dejaba Electron y el backend vivos sobre el 8787.
apagar() {
  local objetivos=("$MAKE_PID") nuevos=1 p h
  while [ "$nuevos" -gt 0 ]; do
    nuevos=0
    for p in "${objetivos[@]}"; do
      for h in ${(f)"$(pgrep -P $p 2>/dev/null)"}; do
        [[ -z "$h" ]] && continue
        [[ " ${objetivos[*]} " == *" $h "* ]] && continue
        objetivos+=("$h"); nuevos=$((nuevos + 1))
      done
    done
  done
  kill -TERM "${objetivos[@]}" 2>/dev/null
}
trap 'apagar; exit 143' INT TERM
trap apagar EXIT

wait "$MAKE_PID"
estado=$?
trap - EXIT INT TERM

# 0 = Electron cerró normal. 130/143 = Ctrl+C / apagado del sistema.
if [ "$estado" != 0 ] && [ "$estado" != 130 ] && [ "$estado" != 143 ]; then
  fallar "$(tail -n 6 "$LOG")"
fi
exit 0
LANZADOR_SH

# Sustituir la ruta del repo. El delimitador | cubre los / de la ruta, y el
# escapado cubre lo que sed trataría como sintaxis: & se expande al texto
# coincidente, y | o \ romperían el comando.
REPO_ROOT_SED=$(printf '%s' "$REPO_ROOT" | sed -e 's/[|&\\]/\\&/g')
sed -i '' "s|__REPO_ROOT__|$REPO_ROOT_SED|" "$LANZADOR/Contents/Resources/lanzador.sh"
chmod +x "$LANZADOR/Contents/Resources/lanzador.sh"

# ── Firma ad-hoc ─────────────────────────────────────────────────────────────
# Le da al bundle un cdhash estable, que es a lo que TCC ata el permiso.
# Ojo: volver a correr este instalador cambia el cdhash, así que hay que
# desactivar y reactivar Prosecnur en Acceso total al disco. Es lo esperado.
codesign --force --deep --sign - "$LANZADOR" >/dev/null 2>&1 \
  && echo "✓ Firmado ad-hoc" \
  || echo "⚠ No se pudo firmar el bundle" >&2

# ── Refrescar la caché del ícono ─────────────────────────────────────────────
touch "$LANZADOR"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
  -f "$LANZADOR" >/dev/null 2>&1 || true

echo "✓ $LANZADOR → $REPO_ROOT"
echo "  Log de arranque: ~/Library/Logs/Prosecnur-dev.log"
echo "  Falta una vez: Ajustes del Sistema › Privacidad y seguridad › Acceso"
echo "  total al disco › activar Prosecnur (el repo vive bajo ~/Documents)."

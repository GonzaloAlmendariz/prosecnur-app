#!/usr/bin/env bash
# Higiene de servers de desarrollo de Prosecnur.
#
#   scripts/dev-servers.sh status   → inventario: tipo, pid, puerto, edad, conexiones
#   scripts/dev-servers.sh prune    → mata lo que quedó huérfano
#
# Tres tipos de proceso, porque las sesiones de prueba dejan los tres:
#   vite    — frontends de preview. Huérfano: sin puerto de preview (5170-5199,
#             4848, 4899) o >24 h sin conexiones.
#   R       — backends `launcher/launch.R` que levantó un runner o una sesión.
#             Huérfano: su lanzador murió (ppid 1) y lleva >=2 h sin conexiones,
#             o >24 h sin conexiones.
#   runner  — `ui-quick-check.mjs` que sigue vivo. Sólo sigue vivo después de
#             capturar si se lanzó con --keep-servers; si lleva >=2 h, la sesión
#             que lo dejó ya no lo usa. Se termina con TERM, que también baja su
#             API y su frontend (ver el manejador de señales del runner).
#
# NUNCA toca los puertos del usuario: 8787, 8841 y 5181 (su app, sus backends).
set -euo pipefail

MODE="${1:-status}"
NOW_EPOCH=$(date +%s)
PROTEGIDOS=",8787,8841,5181,"

pid_ports() {
  lsof -nP -iTCP -sTCP:LISTEN -a -p "$1" 2>/dev/null | tail -n +2 | awk '{print $9}' | sed 's/.*://' | sort -u | tr '\n' ',' | sed 's/,$//'
}

pid_established() {
  lsof -nP -iTCP -a -p "$1" 2>/dev/null | grep -c ESTABLISHED || true
}

pid_age_hours() {
  local lstart epoch
  lstart=$(ps -o lstart= -p "$1" 2>/dev/null) || { echo 0; return; }
  epoch=$(date -j -f "%a %b %d %T %Y" "$(echo "$lstart" | xargs)" +%s 2>/dev/null || echo "$NOW_EPOCH")
  echo $(( (NOW_EPOCH - epoch) / 3600 ))
}

es_protegido() {
  local ports="$1" p
  for p in ${ports//,/ }; do
    case "$PROTEGIDOS" in *",$p,"*) return 0 ;; esac
  done
  return 1
}

# tipo<TAB>pid<TAB>ppid por cada proceso de dev
dev_procs() {
  ps -axo pid=,ppid=,command= | while read -r pid ppid cmd; do
    case "$cmd" in
      *grep*) continue ;;
      *vite/bin/vite.js*|*http.server*) printf "vite\t%s\t%s\n" "$pid" "$ppid" ;;
      *launcher/launch.R*) printf "R\t%s\t%s\n" "$pid" "$ppid" ;;
      *scripts/ui-quick-check.mjs*) printf "runner\t%s\t%s\n" "$pid" "$ppid" ;;
    esac
  done
}

echo "TIPO    PID     PUERTOS      EDAD(h)  CONEX  VEREDICTO"
dev_procs | while IFS=$'\t' read -r tipo pid ppid; do
  [ -z "$pid" ] && continue
  ports=$(pid_ports "$pid")
  age=$(pid_age_hours "$pid")
  conns=$(pid_established "$pid")
  verdict="OK"
  action=""
  if es_protegido "$ports"; then
    verdict="DEL USUARIO (no se toca)"
  else
    case "$tipo" in
      vite)
        if ! echo ",$ports," | grep -qE ",(51[7-9][0-9]|4848|4899)," ; then verdict="HUÉRFANO (sin puerto de preview)"; action=kill; fi
        if [ "$conns" -eq 0 ] && [ "$age" -ge 24 ]; then verdict="STALE (>24h sin conexiones)"; action=kill; fi
        ;;
      R)
        if [ "$ppid" -eq 1 ] && [ "$conns" -eq 0 ] && [ "$age" -ge 2 ]; then verdict="HUÉRFANO (su lanzador murió)"; action=kill; fi
        if [ "$conns" -eq 0 ] && [ "$age" -ge 24 ]; then verdict="STALE (>24h sin conexiones)"; action=kill; fi
        ;;
      runner)
        if [ "$age" -ge 2 ]; then verdict="OLVIDADO (--keep-servers, >=2h)"; action=kill; fi
        ;;
    esac
  fi
  printf "%-7s %-7s %-12s %-8s %-6s %s\n" "$tipo" "$pid" "${ports:-—}" "$age" "$conns" "$verdict"
  if [ "$MODE" = "prune" ] && [ "$action" = "kill" ]; then
    kill "$pid" 2>/dev/null && echo "                → terminado"
  fi
done

if [ "$MODE" = "prune" ]; then
  echo "--- después del prune ---"
  sleep 2
  dev_procs | awk -F'\t' '{print "vivo:", $1, $2}' || true
fi

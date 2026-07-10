#!/usr/bin/env bash
# Higiene de servers de desarrollo de Prosecnur.
#
#   scripts/dev-servers.sh status   → inventario: pid, puerto, edad, conexiones
#   scripts/dev-servers.sh prune    → mata (1) vites huérfanos sin puerto de
#                                     preview y (2) servers sin conexiones con
#                                     más de 24 h de vida.
#
# NUNCA toca el backend R (8787): ese lo maneja el usuario o make dev-api.
set -euo pipefail

MODE="${1:-status}"
NOW_EPOCH=$(date +%s)

# PIDs de servers dev: vite del repo + http.server sueltos
dev_pids() {
  ps -axo pid=,lstart=,command= | grep -E "vite/bin/vite\.js|http\.server" | grep -v grep | awk '{print $0}'
}

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

echo "PID     PUERTOS      EDAD(h)  CONEX  VEREDICTO"
dev_pids | while read -r line; do
  pid=$(echo "$line" | awk '{print $1}')
  [ -z "$pid" ] && continue
  ports=$(pid_ports "$pid")
  age=$(pid_age_hours "$pid")
  conns=$(pid_established "$pid")
  # Huérfano: vite sin ningún puerto en el rango de preview (5170-5199) ni 4848/4899
  is_orphan=no
  if ! echo ",$ports," | grep -qE ",(51[7-9][0-9]|4848|4899)," ; then is_orphan=yes; fi
  verdict="OK"
  action=""
  if [ "$is_orphan" = yes ]; then verdict="HUÉRFANO (sin puerto de preview)"; action=kill; fi
  if [ "$conns" -eq 0 ] && [ "$age" -ge 24 ]; then verdict="STALE (>24h sin conexiones)"; action=kill; fi
  printf "%-7s %-12s %-8s %-6s %s\n" "$pid" "${ports:-—}" "$age" "$conns" "$verdict"
  if [ "$MODE" = "prune" ] && [ "$action" = "kill" ]; then
    kill "$pid" 2>/dev/null && echo "        → terminado"
  fi
done

if [ "$MODE" = "prune" ]; then
  echo "--- después del prune ---"
  sleep 1
  dev_pids | awk '{print "vivo:", $1}' || true
fi

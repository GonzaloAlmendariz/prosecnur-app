#!/usr/bin/env Rscript
# Launcher para deploy web (HF Spaces / Fly.io / VPS).
#
# Diferencias con `launch.R` (Electron local):
#   - Usa `library(prosecnurapp)` (paquete instalado), no `devtools::load_all()`.
#   - Default host = "0.0.0.0" para aceptar conexiones del exterior.
#   - Default port = $PORT (env var del hosting; HF Spaces usa 7860, Fly $PORT).
#   - No abre browser.
#   - Bootstrap (.pulso) obligatorio — si falta, sale con error.
#   - Activa `PULSO_PUBLIC_MODE=1` automáticamente — el middleware
#     `forbid_mutations` solo deja pasar endpoints read-only del dashboard.

local({
  tryCatch(Sys.setlocale("LC_ALL", "en_US.UTF-8"), error = function(e) NULL, warning = function(w) NULL)
  if (!isTRUE(l10n_info()[["UTF-8"]])) {
    tryCatch(Sys.setlocale("LC_ALL", "C.UTF-8"), error = function(e) NULL, warning = function(w) NULL)
  }
})
options(encoding = "UTF-8")

suppressPackageStartupMessages(library(prosecnurapp))

# Activar modo público (whitelist de endpoints) ANTES de construir el
# plumber app. Lo lee `forbid_mutations` al mountear los routers.
Sys.setenv(PULSO_PUBLIC_MODE = "1")

port <- as.integer(Sys.getenv("PORT", Sys.getenv("PULSO_PORT", "7860")))
host <- Sys.getenv("PULSO_HOST", "0.0.0.0")

bootstrap_path <- Sys.getenv("PULSO_BOOTSTRAP_PROJECT", "/data/proyecto.pulso")
if (!nzchar(bootstrap_path) || !file.exists(bootstrap_path)) {
  stop(sprintf(
    "[launch_server] PULSO_BOOTSTRAP_PROJECT no existe: '%s'. ",
    bootstrap_path
  ), "El deploy web requiere un .pulso pre-cargado.")
}

cat(sprintf("[launch_server] bootstrap = %s\n", bootstrap_path))
# `load_pulso` es interna del paquete (no exportada en NAMESPACE). En
# Electron local funcionaba vía `devtools::load_all()`. En el deploy
# usamos `library(prosecnurapp)` → accedemos con `:::`.
bs <- tryCatch(prosecnurapp:::load_pulso(bootstrap_path), error = function(e) {
  stop(sprintf("[launch_server] error cargando .pulso: %s", conditionMessage(e)))
})
# ADR 0122 §9: el Space público sólo sirve un .pulso PREPARADO para publicar
# (lista permitida, base podada). Uno entero —el del proyecto— trae la lista de
# encuestadores, la base completa y lo demás: no se sirve.
if (!isTRUE(prosecnurapp:::.publicacion_preparada(prosecnurapp:::session_get(bs$session_id)))) {
  stop("[launch_server] el .pulso no está preparado para publicar: es el del proyecto, entero. ",
       "Prepáralo con el botón Deploy o con `Rscript api/scripts/publicacion_preparar.R --project <proyecto.pulso> --out data/proyecto.pulso`.")
}
# Un tablero sin fuente arranca y publica «Dashboard no disponible»: no se sirve.
# Cubre los .pulso preparados antes de que el snapshot exigiera la fuente.
.bs_estado <- prosecnurapp:::session_get(bs$session_id)
if (identical(as.character(c(.bs_estado$publicacion_preparada$lista, "")[1]), "dashboard")) {
  # Sólo el rechazo del guard se reescribe; cualquier otro error (p. ej. un paquete
  # instalado viejo, sin la función) sale tal cual, con su causa.
  tryCatch(prosecnurapp:::.publicacion_exigir_fuente_dashboard(.bs_estado), api_error = function(e) {
    stop("[launch_server] ", conditionMessage(e), call. = FALSE)
  })
}
Sys.setenv(PULSO_BOOTSTRAP_SID = bs$session_id)
cat(sprintf("[launch_server] sesión SID=%s, escuchando en %s:%d\n",
            bs$session_id, host, port))

# Static dir: cuando el paquete está instalado, vive en system.file().
static_dir <- system.file("www", package = "prosecnurapp")
if (!nzchar(static_dir) || !dir.exists(static_dir)) {
  stop("[launch_server] frontend bundle no encontrado en system.file('www', package='prosecnurapp')")
}

run_app(host = host, port = port, static_dir = static_dir,
        open_browser = FALSE)

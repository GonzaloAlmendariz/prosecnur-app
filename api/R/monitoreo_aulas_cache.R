# monitoreo_aulas_cache.R — cache del dashboard de cursos-horario.
#
# **Aulas era la unica familia de Monitoreo que reconstruia su dashboard en
# CADA request de state.** En el mismo punto del router, territorial pasa por
# `.monitoreo_territorial_map_cache_meta`, acreditacion y telefonico por
# `.monitoreo_acreditacion_repair_cached_dashboard`, y aulas llamaba a
# `monitoreo_aulas_dashboard()` a pelo — fuera del `if (should_build_dashboard)`
# que gobierna la cache del tablero, asi que se reconstruia **incluso cuando el
# dashboard general venia de cache**.
#
# Medido el 2026-08-24 sobre el estudio de 2.616 cursos-horario:
#
#   df -> lista (2.616)   0,9 s
#   normalize_plan        2,1 s
#   dashboard             3,6 s
#   ----------------------------
#   por request           6,6 s
#
# y una apertura de proyecto dispara **6 requests de state** —`include_reports=0`
# dos veces, y los scopes `source`, `advance_summary`, `queries_summary` y
# `validation_summary`—, o sea **~40 s** de los 48 que el backend pasa al 100 %
# de CPU con Plumber bloqueado en un solo hilo. Ese es el «Preparando proyecto
# 86 %» que se queda clavado.
#
# Este archivo existe aparte porque `router_monitoreo.R` esta congelado a
# crecimiento: el router llama con una linea. Mismo motivo y mismo patron que
# `monitoreo_territorial_cache.R` y `monitoreo_acreditacion_cache.R`.
#
# **Cache en memoria del proceso, no en la sesion.** El caso que duele son seis
# requests seguidos en pocos segundos, y para eso no hace falta persistir nada:
# persistirlo obligaria a censar claves nuevas en `session_schema.R` y
# engordaria el `.pulso` con un derivado recalculable. Una entrada por `sid`,
# reemplazada en cuanto cambia el token.

.mac_dashboard_env <- new.env(parent = emptyenv())

#' El token de frescura del dashboard de aulas.
#'
#' Parte del token general del tablero —que ya cubre data, `synced_at` y la
#' particion del config que afecta a los reportes— y le suma **lo que el router
#' anade a `aulas_cfg` DESPUES de calcularlo**: el plan, el control del libro,
#' el recibo de la importacion y los partes de campo. Sin esa parte, importar un
#' libro no invalidaria la cache y la pantalla seguiria enseñando el estado
#' anterior, que es peor que ir lento.
#'
#' @param base token del tablero (`.monitoreo_dashboard_cache_token`).
#' @param plan filas del plan de aulas.
#' @param cfg config de aulas ya enriquecida.
#' @param scope el `report_scope` del request.
#' @return cadena.
#' @export
monitoreo_aulas_cache_token <- function(base, plan, cfg, scope = "full") {
  largo <- function(x) if (is.data.frame(x)) nrow(x) else if (is.list(x)) length(x) else 0L
  # Los partes y el control se comparan por tamaño Y por su marca de lectura: el
  # numero de filas solo no distingue una correccion a mano en el Excel, que es
  # justo el caso que el operativo tiene declarado como posible.
  paste(
    as.character(base %||% ""),
    as.character(scope %||% "full"),
    largo(plan),
    largo(cfg$control),
    largo(cfg$partes_campo),
    as.character((cfg$libro$leido_en %||% cfg$libro$imported_at %||% "")[1]),
    as.character((cfg$agenda_actualizada_en %||% "")[1]),
    sep = "|"
  )
}

#' El dashboard de aulas, reusando el de esta sesion si nada cambio.
#'
#' @param sid id de sesion; con `""` no se cachea (no hay a quien atribuirlo).
#' @param plan filas del plan.
#' @param data respuestas.
#' @param cfg config de aulas.
#' @param token lo que devuelve `monitoreo_aulas_cache_token()`.
#' @return lista con `dashboard` y `hit`.
#' @export
monitoreo_aulas_dashboard_cached <- function(sid, plan, data, cfg, token) {
  sid <- as.character(sid %||% "")[1]
  if (!nzchar(sid) || !nzchar(as.character(token %||% ""))) {
    return(list(dashboard = monitoreo_aulas_dashboard(plan, data, cfg), hit = FALSE))
  }
  guardado <- if (exists(sid, envir = .mac_dashboard_env, inherits = FALSE)) {
    get(sid, envir = .mac_dashboard_env, inherits = FALSE)
  } else NULL
  if (is.list(guardado) && identical(guardado$token, token) && is.list(guardado$dashboard)) {
    return(list(dashboard = guardado$dashboard, hit = TRUE))
  }
  dashboard <- monitoreo_aulas_dashboard(plan, data, cfg)
  # UNA entrada por sesion: la anterior se reemplaza. Guardar por token dejaria
  # el environment creciendo con cada sync de un operativo largo.
  assign(sid, list(token = token, dashboard = dashboard), envir = .mac_dashboard_env)
  list(dashboard = dashboard, hit = FALSE)
}

#' Olvida el dashboard cacheado de una sesion.
#'
#' Lo llama la invalidacion general de caches de Monitoreo. Sin esto, un
#' `.pulso` recien abierto sobre un `sid` reusado leeria el dashboard del
#' proyecto anterior — que es el peor fallo posible de una cache y el mas dificil
#' de ver, porque las cifras son plausibles.
#'
#' @param sid id de sesion. Vacio o `NULL` limpia todo.
#' @return `invisible(NULL)`.
#' @export
monitoreo_aulas_cache_invalidate <- function(sid = "") {
  sid <- as.character(sid %||% "")[1]
  if (!nzchar(sid)) {
    rm(list = ls(envir = .mac_dashboard_env, all.names = TRUE), envir = .mac_dashboard_env)
    return(invisible(NULL))
  }
  if (exists(sid, envir = .mac_dashboard_env, inherits = FALSE)) {
    rm(list = sid, envir = .mac_dashboard_env)
  }
  invisible(NULL)
}

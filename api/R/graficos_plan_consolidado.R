# El informe compartido se propone y se siembra (ADR 0096; ADR 0102)
# ===================================================================
#
# `POST /api/graficos/plan/sugerido` con `scope:"consolidado"` y la siembra del
# preflight consolidado (`graficos_consolidado_preflight`) derivan su plan de la
# MISMA función de este archivo, así lo que se propone, lo que se siembra y lo
# que genera el job son el mismo mazo para el mismo estado.
#
# - ADR 0102: la matriz de equivalencias sólo declara equivalencias. El bloque
#   comparativo que antes se derivaba de ella (diapositiva, gráfico, corte) ya no
#   existe: las láminas que comparan públicos las arma el analista en Gráficos.
# - Sólo participan las bases con release aprobada y vigente; las demás se dicen
#   en `bases_excluidas` (decisión 2).
# - La config es la del cuerpo, portable, y NUNCA se mezcla con la de la base
#   activa (ADR 0040 §6.1). La propuesta no persiste: el estado de la sesión se
#   restaura al salir, igual que hace el preflight.

.GRAFICOS_PLAN_SCOPES <- c("", "consolidado")

# Alcance del plan sugerido, leído de la raíz del cuerpo. ""/ausente = actual.
.graficos_plan_scope <- function(scope) {
  valor <- tolower(trimws(as.character(scope %||% "")[1]))
  if (is.na(valor)) valor <- ""
  if (!valor %in% .GRAFICOS_PLAN_SCOPES) {
    stop_api(400, "E_GRAFICOS_PLAN_SCOPE",
             "scope debe omitirse o ser \"consolidado\".",
             details = list(scope = valor, admitidos = as.list(.GRAFICOS_PLAN_SCOPES)))
  }
  valor
}

.graficos_plan_consolidado_requiere <- function(sid) {
  if (!isTRUE(estudio_is_independent_siblings(sid))) {
    stop_api(409, "E_GRAFICOS_CONSOLIDADO_NO_APLICA",
             "El informe compartido sólo aplica a estudios con bases hermanas independientes.")
  }
  invisible(TRUE)
}

# Config del compartido: la del cuerpo en forma portable sobre los defaults del
# proyecto. No pasa por `.graficos_effective_config`, que leería la de la base activa.
.graficos_plan_consolidado_config <- function(sid, s, config) {
  cfg <- .as_json_list(config) %||% list()
  if (.graficos_is_obj(cfg$config)) cfg <- cfg$config
  cfg$fuente <- NULL
  cfg <- .graficos_consolidado_portable_config(cfg, s$files %||% list())
  cfg$multi_actor_comparisons <- TRUE
  .graficos_normalize_config(.graficos_deep_merge(.graficos_default_config(sid), cfg), sid = sid)
}

# Qué bases participan y cuáles quedan fuera, con su motivo.
.graficos_plan_consolidado_marco <- function(sid, s, sources = NULL) {
  catalog <- .processing_release_catalog(s)
  entries <- catalog$entries %||% list()
  orden <- vapply(entries, function(e) as.character(e$base), character(1))
  sources <- sources %||% .graficos_consolidado_sources(sid, orden)
  disponibles <- intersect(names(sources$data_sources %||% list()), names(sources$inst_sources %||% list()))
  incluidas <- character(0)
  excluidas <- list()
  for (entry in entries) {
    motivo <- if (!isTRUE(entry$approved)) {
      if (identical(entry$status, "stale")) "release_desfasada" else "release_no_aprobada"
    } else if (!entry$base %in% disponibles) {
      "sin_fuente"
    } else ""
    if (nzchar(motivo)) {
      excluidas[[length(excluidas) + 1L]] <- list(base = entry$base, actor = entry$actor, motivo = motivo)
    } else {
      incluidas <- c(incluidas, entry$base)
    }
  }
  list(incluidas = incluidas, excluidas = excluidas, sources = sources)
}

.graficos_plan_consolidado_aviso <- function(code, message) list(code = code, message = message)

# ADR 0102: sin bloque derivado de la matriz no hay avisos sobre ella; queda el de las bases que no entran.
.graficos_plan_consolidado_avisos <- function(excluidas) {
  if (!length(excluidas)) return(list())
  actores <- vapply(excluidas, function(x) as.character(x$actor %||% x$base), character(1))
  list(.graficos_plan_consolidado_aviso("bases_excluidas", sprintf(
    "Sin release aprobada y vigente, quedan fuera de la propuesta: %s.", paste(actores, collapse = ", "))))
}

#' Propuesta del informe compartido (ADR 0096, ADR 0102).
#'
#' La propuesta por fuente de las bases aprobadas. `sources` evita recalcular las fuentes cuando llama el preflight.
#' @noRd
.graficos_plan_sugerido_consolidado <- function(sid, config = NULL, sources = NULL) {
  s <- session_get(sid)
  on.exit({ .session_env[[sid]] <- s }, add = TRUE)
  cfg <- .graficos_plan_consolidado_config(sid, s, config)
  marco <- .graficos_plan_consolidado_marco(sid, s, sources)
  base <- .graficos_suggested_plan(sid, config = cfg, alcance = list(
    config = cfg, fuentes = marco$incluidas, bloque = list(slides = list(), refs = character(0))))
  list(
    ok = TRUE,
    plan = base$plan,
    report_scope = "consolidado",
    fuente = "consolidado",
    bases_incluidas = as.list(marco$incluidas),
    bases_excluidas = marco$excluidas,
    avisos_equivalencias = .graficos_plan_consolidado_avisos(marco$excluidas),
    coverage = base$coverage %||% list(),
    warnings = base$warnings %||% list()
  )
}

# Bloque aditivo `equivalencias` del preflight: los avisos de la siembra (hoy, las bases excluidas).
.graficos_plan_consolidado_resumen <- function(sid, plan, sugerido = NULL) {
  list(
    origen_plan = if (is.null(sugerido)) "autorado" else "derivado",
    avisos = if (is.null(sugerido)) list() else sugerido$avisos_equivalencias %||% list()
  )
}

# Elige la fuente del plan sugerido. Vive aqui y no en el router para que la
# eleccion sea probable sin HTTP (routers delgados).
#
# ADR 0102: la matriz de equivalencias ya no es una fuente (`fuente = "equivalencias"` responde 410 con su motivo).
# ADR 0096: `scope` viene de la RAÍZ del cuerpo, igual que en `/plan/coverage`.
.graficos_plan_sugerido_por_fuente <- function(sid, config = NULL, scope = "") {
  fuente <- tolower(trimws(as.character((config %||% list())$fuente %||% "")[1]))
  if (identical(fuente, "equivalencias")) {
    stop_api(410, "E_GRAFICOS_PLAN_EQUIVALENCIAS_RETIRADO",
             "La matriz de equivalencias ya no arma láminas: las láminas que comparan públicos se arman en Gráficos.")
  }
  if (identical(.graficos_plan_scope(scope), "consolidado")) {
    .graficos_plan_consolidado_requiere(sid)
    return(.graficos_plan_sugerido_consolidado(sid, config = config))
  }
  .graficos_suggested_plan(sid, config = config)
}

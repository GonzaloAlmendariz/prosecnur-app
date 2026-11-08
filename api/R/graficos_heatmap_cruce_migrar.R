# =============================================================================
# graficos_heatmap_cruce_migrar.R — el `p_dim_heatmap` con una pregunta pasa a «Mapa de calor por cruce» (ADR 0137)
# =============================================================================
#
# Es la única migración del retiro (ADR 0137, decisión 1 de Gonzalo): un `p_dim_heatmap` cuyo objetivo es una pregunta
# de respuesta única tiene equivalente 1:1 en `p_heatmap_cruce`. El resto de los tipos retirados se conserva tal cual
# en el plan (graficos_retirados.R).
#
# Contrato:
#   - decidir exige el instrumento de la base (¿el objetivo es una pregunta?), así que no vive en
#     `.graficos_migrar_plan()`, que no lo tiene; corre en el GET de la config, sobre la config guardada en la sesión;
#   - la migración es una mutación real: se escribe con `session_set()`, que marca `project_dirty` UNA vez; la llamada
#     siguiente no encuentra nada que migrar, no escribe y no avisa;
#   - un solo aviso por config («Base «x»: …» en multibase) con las láminas que cambiaron;
#   - sin instrumentos (proyecto sin datos cargados) no se migra nada: el rearmado redirige en memoria y dibuja igual.

#' Migra los `p_dim_heatmap` de pregunta × cruce de un plan a `p_heatmap_cruce`
#'
#' @param plan Plan de la config (`list(slides = ...)`).
#' @param inst_sources Instrumentos por base (o el de una sola base).
#' @param base_defecto Base de la config cuando es la de una base (`graficos_config_por_base`): las referencias sin
#'   calificar se leen ahí.
#' @return El plan con `attr(, "laminas_migradas")` (números de lámina); sin cambios si no había nada que migrar.
#' @keywords internal
.hm_cruce_migrar_plan <- function(plan, inst_sources, base_defecto = NULL) {
  if (!is.list(plan) || !is.list(plan$slides) || !length(plan$slides)) return(plan)
  attr(plan, "laminas_migradas") <- NULL
  if (!is.null(base_defecto) && is.list(inst_sources) && is.null(inst_sources$survey) && base_defecto %in% names(inst_sources)) {
    inst_sources <- inst_sources[base_defecto]
  }
  migradas <- integer()
  for (i in seq_along(plan$slides)) {
    s <- plan$slides[[i]]
    if (!is.list(s) || !is.list(s$payload)) next
    for (slot in names(s$payload)) {
      g <- s$payload[[slot]]
      if (!is.list(g) || !identical(as.character(g$graficador %||% "")[1], "p_dim_heatmap")) next
      args <- .graficos_unwrap_scalar_refs(g$args %||% list())
      if (!.hm_cruce_objetivo_es_pregunta_inst(args$objetivo, args$cruce, inst_sources)) next
      nuevos <- .hm_cruce_args_desde_dim_heatmap(args)
      if (is.null(nuevos)) next
      g$graficador <- "p_heatmap_cruce"
      g$args <- nuevos
      plan$slides[[i]]$payload[[slot]] <- g
      migradas <- c(migradas, i)
    }
  }
  if (length(migradas)) attr(plan, "laminas_migradas") <- unique(migradas)
  plan
}

#' El aviso único de la migración de un plan
#' @keywords internal
.hm_cruce_aviso <- function(laminas) {
  laminas <- sort(unique(as.integer(laminas)))
  if (!length(laminas)) return(character(0))
  lista <- if (length(laminas) == 1L) sprintf("La lámina %d usaba", laminas) else
    sprintf("Las láminas %s y %d usaban", paste(utils::head(laminas, -1L), collapse = ", "), utils::tail(laminas, 1L))
  sprintf(paste0("%s \"Heatmap de dimensiones\" con una pregunta como objetivo, un tipo que ya no existe: ",
                 "ahora %s \"%s\", con las mismas cifras."),
          lista, if (length(laminas) == 1L) "es" else "son", .HM_CRUCE_TITULO)
}

#' Instrumentos de la sesión por base, o `NULL` si el proyecto no tiene datos cargados
#' @keywords internal
.hm_cruce_inst_sesion <- function(sid) {
  inst <- tryCatch(estudio_inst_sources(sid), error = function(e) NULL)
  if (is.list(inst) && length(inst)) return(inst)
  tryCatch(.graficos_processing_sources(sid)$inst_sources, error = function(e) NULL)
}

#' Migra el plan de cada config de Gráficos guardada en la sesión y devuelve su aviso
#'
#' Recorre `graficos_config` y cada `graficos_config_por_base`. Sólo escribe (y marca el proyecto como modificado)
#' la config que cambió.
#' @param sid Sesión.
#' @return Avisos (uno por config migrada); vacío si no había nada que migrar.
#' @keywords internal
.graficos_heatmap_cruce_migrar_sesion <- function(sid) {
  s <- session_get(sid)
  es_dim_heatmap <- function(g) is.list(g) && identical(as.character(g$graficador %||% "")[1], "p_dim_heatmap")
  tiene_dim_heatmap <- function(cfg) {
    sl <- if (is.list(cfg) && is.list(cfg$plan)) cfg$plan$slides else NULL
    is.list(sl) && any(vapply(sl, function(x) is.list(x) && is.list(x$payload) &&
                                any(vapply(x$payload, es_dim_heatmap, logical(1))), logical(1)))
  }
  por_base <- s$graficos_config_por_base
  candidatos <- c(list(s$graficos_config), if (is.list(por_base)) unname(por_base) else list())
  if (!any(vapply(candidatos, tiene_dim_heatmap, logical(1)))) return(character(0))
  inst <- .hm_cruce_inst_sesion(sid)
  if (is.null(inst)) return(character(0))
  avisos <- character()
  migrar <- function(cfg, base = NULL) {
    if (!tiene_dim_heatmap(cfg)) return(NULL)
    plan <- .hm_cruce_migrar_plan(cfg$plan, inst, base_defecto = base)
    laminas <- attr(plan, "laminas_migradas")
    if (!length(laminas)) return(NULL)
    attr(plan, "laminas_migradas") <- NULL
    cfg$plan <- plan
    av <- .hm_cruce_aviso(laminas)
    avisos <<- c(avisos, if (is.null(base)) av else sprintf("Base \"%s\": %s", base, av))
    cfg
  }
  nueva <- migrar(s$graficos_config)
  if (!is.null(nueva)) session_set(sid, "graficos_config", nueva)
  if (is.list(por_base) && length(por_base) && !is.null(names(por_base))) {
    cambio <- FALSE
    for (b in names(por_base)) {
      nueva <- migrar(por_base[[b]], base = b)
      if (is.null(nueva)) next
      por_base[[b]] <- nueva
      cambio <- TRUE
    }
    if (cambio) session_set(sid, "graficos_config_por_base", por_base)
  }
  avisos
}

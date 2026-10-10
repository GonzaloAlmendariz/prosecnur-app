# =============================================================================
# graficos_migrar_poblacion_sesion.R — la migración de la población antigua se guarda en la sesión y se avisa una vez
# =============================================================================
#
# El GET de la config migraba al vuelo y no guardaba: abrir un proyecto y guardarlo sin tocar Gráficos dejaba el .pulso
# con `p_slide_*_graficos_poblacion`, y cada reapertura volvía a migrar y a avisar (al stderr, donde nadie lo leía).
# Contrato (lead, 2026-10-10): migrar el plan de la sesión es una mutación real —marca `project_dirty`, el usuario
# guarda explícito como cualquier cambio—; tras migrar una vez no se vuelve a migrar ni a avisar en esa sesión, y el
# aviso llega en el campo `avisos` del GET de la config.
#
# Sólo se reescribe el `plan` de cada config guardada: el resto sigue siendo lo que el usuario decidió (ADR 0074,
# «presencia = decisión»), sin los defaults que agrega la normalización.

#' Migra el plan de cada config de Gráficos guardada en la sesión y devuelve sus avisos
#'
#' Recorre la config de la sesión (`graficos_config`) y la de cada base (`graficos_config_por_base`). Lo que cambia se
#' escribe con `session_set()`, que marca el proyecto como modificado; lo que ya estaba vigente no se toca.
#'
#' @param sid Sesión.
#' @return Los avisos, en el orden del plan; los de una base van precedidos de «Base «nombre»: ». Vacío si no había
#'   nada que migrar (la segunda llamada de la misma sesión, o un proyecto ya guardado con los tipos vigentes).
#' @keywords internal
.graficos_config_migrar_sesion <- function(sid) {
  s <- session_get(sid)
  avisos <- character()
  migrar <- function(cfg, base = NULL) {
    if (!is.list(cfg) || !is.list(cfg$plan) || !is.list(cfg$plan$slides)) return(NULL)
    plan <- .graficos_migrar_poblacion_antigua(cfg$plan, avisar = TRUE)
    av <- .graficos_avisos_migracion(plan)
    if (!length(av)) return(NULL)
    attr(plan, "avisos_migracion") <- NULL
    cfg$plan <- plan
    avisos <<- c(avisos, if (is.null(base)) av else sprintf("Base «%s»: %s", base, av))
    cfg
  }
  nueva <- migrar(s$graficos_config)
  if (!is.null(nueva)) session_set(sid, "graficos_config", nueva)
  por_base <- s$graficos_config_por_base
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
  unique(avisos)
}

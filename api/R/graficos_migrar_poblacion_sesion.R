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

#' Importa una config de Gráficos: la normaliza, la guarda y devuelve los avisos de su migración
#'
#' El import migraba en silencio (`.graficos_normalize_config` no avisa) y guardaba la config ya vigente: el GET
#' siguiente no tenía nada que migrar ni que avisar, y el usuario nunca sabía que sus láminas cambiaron de tipo. El
#' aviso sale aquí, con el mismo texto que el del GET, en la respuesta del import.
#'
#' @param sid Sesión.
#' @param parsed Cuerpo del import (la config o un sobre con `config`).
#' @return Los avisos de la migración (vacío si el plan ya era vigente).
#' @keywords internal
.graficos_config_importar <- function(sid, parsed) {
  src <- if (.graficos_is_obj(parsed) && .graficos_is_obj(parsed$config)) parsed$config else parsed
  plan <- if (.graficos_is_obj(src)) .graficos_pick_alias(src, "plan") else NULL
  avisos <- if (.graficos_is_obj(plan) && is.list(plan$slides)) .graficos_avisos_migracion(.graficos_migrar_poblacion_antigua(plan)) else character()
  .graficos_config_set(sid, .graficos_normalize_config(parsed, sid = sid))
  avisos
}

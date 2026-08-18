# =============================================================================
# Sincronizar los criterios del marco a la copia del workspace del estudio
# =============================================================================
#
# La UI compara el marco contra `estudio$workspace$aulas_config` para decidir
# el chip «criterios cambiados · reconstruye». Esa copia la mantienen los
# flujos de la UI — pero una config aplicada por API (o por otro flujo)
# construia el marco sin aterrizar en el workspace, y el chip quedaba en
# ambar PERPETUO con el marco recien reconstruido y la misma config (medido
# en HSVG2026: el workspace guardaba los criterios de dias atras, sin
# excepciones ni rangos ni minimos). Es la MISMA familia del resello de la
# decision (calc_muestra_alumnos_por_ch_resello.R): dos copias y solo un
# flujo las mantenia.
#
# La politica: **construir el marco es el momento de verdad de los
# criterios** — al guardarlo, la copia del workspace se alinea con la config
# que lo construyo. El chip queda para lo que debe señalar: ediciones del
# usuario posteriores al marco, que si piden reconstruir.
#
# Solo se sincronizan las claves que el comparador de la UI mira
# (criterios_seleccion y teacher_type_orden): el resto del workspace —
# incluida la decision de alumnos por CH, que tiene su propio resello — no
# se toca.

#' @keywords internal
.cm_criterios_sincronizar_workspace <- function(sid, config) {
  if (!is.list(config)) return(FALSE)
  estado <- session_get(sid, required = FALSE)
  if (!is.list(estado)) return(FALSE)
  estudio <- estado$calc_muestra_estudio
  if (!is.list(estudio)) return(FALSE)
  ws <- estudio$workspace
  if (!is.list(ws)) return(FALSE)
  cfg_ws <- ws$aulas_config
  if (!is.list(cfg_ws)) cfg_ws <- list()
  cfg_ws$criterios_seleccion <- config$criterios_seleccion %||% list()
  cfg_ws$teacher_type_orden <- config$teacher_type_orden %||% list()
  estudio$workspace$aulas_config <- cfg_ws
  session_set(sid, "calc_muestra_estudio", estudio)
  TRUE
}

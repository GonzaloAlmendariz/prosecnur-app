# collection_aulas_siembra.R — de dónde siembra Material su plan de aulas (ADR 0122 §11, X7),
# detrás de un interruptor por estudio (decisión de Meta B del 31 de octubre, reversible).
#
#   - «calculo» (el comportamiento nuevo): Material siembra desde el sorteo de Cálculo de
#     muestra y no desde el plan de Monitoreo, que ya no es su fuente. Si Cálculo no tiene
#     sorteo (un plan que entró a Monitoreo por otro lado), cae al plan de Monitoreo.
#   - «monitoreo» (el de antes): la siembra prefiere el plan de Monitoreo.
#
# Sin elección guardada: «monitoreo» en un estudio que ya sembró desde Monitoreo o que es
# HSVG 2026 (su plan vivo no cambia mientras dure el operativo), y «calculo» en el resto,
# es decir, en los estudios nuevos.

MATERIAL_AULAS_SIEMBRA_MODOS <- c("calculo", "monitoreo")

.mas_es_hsvg <- function(s) {
  est <- tryCatch(.planner_payload(s)$planner$estudio, error = function(e) NULL)
  txt <- paste(c(est$codigo, est$nombre, s$project_path %||% ""), collapse = " ")
  grepl("hsvg|hstvg", txt, ignore.case = TRUE)
}

#' El modo de siembra del plan de aulas de Material y por qué. Lectura pura.
#' @keywords internal
.collection_siembra_modo <- function(s) {
  guardado <- as.character(unlist(s$material_aulas_siembra %||% ""))[1]
  if (!is.na(guardado) && guardado %in% MATERIAL_AULAS_SIEMBRA_MODOS) return(list(modo = guardado, origen = "elegido"))
  modulo <- as.character(((s$collection_state %||% list())$plan$source_ref$module) %||% "")
  if (identical(modulo, "monitoreo")) return(list(modo = "monitoreo", origen = "plan_existente"))
  if (isTRUE(tryCatch(.mas_es_hsvg(s), error = function(e) FALSE))) return(list(modo = "monitoreo", origen = "operativo_hsvg"))
  list(modo = "calculo", origen = "estudio_nuevo")
}

#' GET del interruptor de siembra.
#' @keywords internal
collection_aulas_siembra_get <- function(sid) {
  m <- .collection_siembra_modo(session_get(sid))
  list(ok = TRUE, modo = m$modo, origen = m$origen, modos = as.list(MATERIAL_AULAS_SIEMBRA_MODOS))
}

#' PUT del interruptor de siembra: guarda la elección del estudio. No resiembra: el plan
#' cambia sólo cuando alguien rehace desde Origen.
#' @keywords internal
collection_aulas_siembra_put <- function(sid, modo = NULL) {
  modo <- .mtf_txt(modo)
  if (!modo %in% MATERIAL_AULAS_SIEMBRA_MODOS) {
    stop_api(422, "E_COLLECTION_CAMPAIGN_INVALID", "modo es «calculo» o «monitoreo».")
  }
  session_set(sid, "material_aulas_siembra", modo)
  s <- .mark_project_dirty(session_get(sid), "material_aulas_siembra")
  .session_env[[sid]] <- s
  collection_aulas_siembra_get(sid)
}

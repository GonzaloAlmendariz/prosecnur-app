# collection_aulas_siembra.R — de dónde siembra Material su plan de aulas (ADR 0122 §11, X7),
# detrás de un interruptor por estudio (decisión de Meta B del 31 de octubre, reversible).
#
#   - «calculo» (el comportamiento nuevo): Material siembra desde el sorteo de Cálculo de
#     muestra y no desde el plan de Monitoreo, que ya no es su fuente. Si Cálculo no tiene
#     sorteo (un plan que entró a Monitoreo por otro lado), cae al plan de Monitoreo.
#   - «monitoreo» (el de antes): la siembra prefiere el plan de Monitoreo.
#
# Sin elección guardada: «monitoreo» en un estudio que ya sembró desde Monitoreo, en uno en
# operativo (ya tiene plan de Material y un plan vivo en Monitoreo) o que es HSVG 2026 (su
# plan vivo no cambia mientras dure el operativo), y «calculo» en el resto, es decir, en los
# estudios nuevos.
#
# El operativo se reconoce por el estado, no por el nombre (1 nov 2026): el nombre que deduce
# el Planner de HSVG es «Muestra de cursos-horario» y la ADR 0123 (Q2) deja de exponerlo, y la
# ruta del archivo cambia con sólo copiarlo. Los dos modos sólo difieren cuando hay plan vivo
# en Monitoreo; con él y un plan ya sembrado en Material, cambiar de rama movería un plan en
# pleno campo. El nombre queda como último recurso.

MATERIAL_AULAS_SIEMBRA_MODOS <- c("calculo", "monitoreo")

.mas_es_hsvg <- function(s) {
  est <- tryCatch(.planner_payload(s)$planner$estudio, error = function(e) NULL)
  txt <- paste(c(est$codigo, est$nombre, s$project_path %||% ""), collapse = " ")
  grepl("hsvg|hstvg", txt, ignore.case = TRUE)
}

#' El modo de siembra del plan de aulas de Material y por qué. Lectura pura.
#' @keywords internal
#' TRUE si el estudio ya tiene de dónde sembrar una campaña de aulas: el sorteo de
#' cursos-horario de Cálculo de muestra o el plan de aulas de Monitoreo. Lectura pura.
#'
#' El Planner lo usa para el canal presencial con QR de acreditación (checklist-planner-q5,
#' 4b): sin sorteo, abrir la campaña de aulas sería abrirla vacía.
#' @keywords internal
.collection_hay_sorteo_aulas <- function(s) {
  sel <- s$calc_muestra_aulas_selection
  filas <- if (is.list(sel)) sel$selection else NULL
  NROW(filas) > 0L || NROW(s$monitoreo_aulas_plan) > 0L
}

.collection_siembra_modo <- function(s) {
  guardado <- as.character(unlist(s$material_aulas_siembra %||% ""))[1]
  if (!is.na(guardado) && guardado %in% MATERIAL_AULAS_SIEMBRA_MODOS) return(list(modo = guardado, origen = "elegido"))
  modulo <- as.character(((s$collection_state %||% list())$plan$source_ref$module) %||% "")
  if (identical(modulo, "monitoreo")) return(list(modo = "monitoreo", origen = "plan_existente"))
  sembrado <- length(((s$collection_state %||% list())$plan %||% list())$units %||% list()) > 0L
  if (sembrado && length(.collection_rows(s$monitoreo_aulas_plan))) return(list(modo = "monitoreo", origen = "operativo_en_curso"))
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

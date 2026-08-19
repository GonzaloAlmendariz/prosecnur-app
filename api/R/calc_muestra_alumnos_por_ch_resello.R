# =============================================================================
# Re-sellar la decisión de alumnos por CH cuando el marco se reconstruye
# =============================================================================
#
# La decisión de alumnos por CH se firma contra un marco concreto: su firma
# lleva el `frame_hash`, y un guardado cuya decisión apunte a otro marco borra el
# objetivo de cursos-horario y limpia los resultados
# (`.cm_alumnos_por_ch_preparar_estudio_guardado`). Eso está bien: una decisión
# firmada contra un marco anterior no puede acreditar un objetivo, y hay
# contrato HTTP que lo defiende.
#
# El problema era la secuencia obligada, no el guard:
#
#   1. Se firma la decisión            -> sellada con HASH_A
#   2. El motor EXIGE reconstruir      -> el marco pasa a HASH_B (decision_stale)
#   3. Nadie re-sella la decisión      -> sigue en HASH_A
#   4. Todo guardado posterior la ve stale y borra el objetivo. Para siempre.
#
# El paso 2 lo impone el propio motor, así que el paso 4 deshacía siempre al
# siguiente y Titulares, Reemplazos y Sustento nunca se acreditaban.
#
# Se re-sella al reconstruir porque **el estadístico no depende del marco**
# (decisión de dominio, Gonzalo 2026-08-15): elegir P25, mediana o media es una
# postura metodológica sobre cómo resumir la distribución, no sobre qué
# distribución concreta se está mirando. Reconstruir el marco cambia los valores,
# no la postura.
#
# Lo que NO hace: crear una decisión donde no la había, ni tocar el estadístico
# elegido ni el reparto por facultad. Sólo actualiza el sello. Si el usuario
# cambia el estadístico, la firma cambia igual y el guard invalida como siempre.

#' Actualiza el `frame_hash` de la decisión vigente al del marco recién construido.
#'
#' @param sid sesión
#' @param frame_hash hash del marco que se acaba de guardar
#' @return TRUE si se re-selló, FALSE si no había nada que re-sellar
.cm_alumnos_por_ch_resellar <- function(sid, frame_hash) {
  hash <- .cm_aulas_scalar(frame_hash, "")
  if (!nzchar(hash)) return(FALSE)

  estado <- session_get(sid, required = FALSE)
  if (!is.list(estado)) return(FALSE)

  # Sólo se re-sella una decisión CONFIRMADA. Un sentinela incompleto —schema
  # vacío— debe seguir fallando cerrado en /calcular, no quedar bendecido por
  # una reconstrucción. Devuelve la decisión sellada o NULL si no procede.
  sellar <- function(decision) {
    if (!is.list(decision)) return(NULL)
    firma <- .cm_alumnos_por_ch_decision_signature(decision)
    if (!is.list(firma) || !identical(firma$schema, .cm_alumnos_por_ch_decision_schema)) {
      return(NULL)
    }
    if (identical(.cm_aulas_scalar(decision$frame_hash, ""), hash)) return(NULL)
    decision$frame_hash <- hash
    decision
  }

  hubo <- FALSE

  # Copia 1: el workspace del estudio, de donde el autosave lee la decisión.
  estudio <- estado$calc_muestra_estudio
  ws <- if (is.list(estudio)) estudio$workspace else NULL
  cfg <- if (is.list(ws)) ws$aulas_config else NULL
  sellada <- sellar(if (is.list(cfg)) cfg$alumnos_por_ch_decision else NULL)
  if (!is.null(sellada)) {
    cfg$alumnos_por_ch_decision <- sellada
    ws$aulas_config <- cfg
    estudio$workspace <- ws
    session_set(sid, "calc_muestra_estudio", estudio)
    hubo <- TRUE
  }

  # Copia 2 (espejo): calc_muestra_aulas_config. El guard de los artefactos de
  # Aulas compara la firma del ESTUDIO contra la de esta config, y el guardado
  # del marco la REEMPLAZA por la del frame construido — que carga el hash del
  # marco anterior. Cada copia se sella POR SU CUENTA: la primera versión de
  # este espejo colgaba del sellado del estudio y el early-return «el estudio
  # ya está al día» lo saltaba — 409 decision_stale eterno cuando el hash del
  # marco es estable entre builds (medido 2026-08-19: estudio 3644ce7a…,
  # config 8f676b56…, dos builds seguidos).
  aulas_cfg <- estado$calc_muestra_aulas_config
  espejo <- sellar(if (is.list(aulas_cfg)) aulas_cfg$alumnos_por_ch_decision else NULL)
  if (!is.null(espejo)) {
    aulas_cfg$alumnos_por_ch_decision <- espejo
    session_set(sid, "calc_muestra_aulas_config", aulas_cfg)
    hubo <- TRUE
  }

  hubo
}

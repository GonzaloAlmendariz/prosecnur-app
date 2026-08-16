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

  # El workspace vive dentro del estudio; es de donde el guardado del autosave
  # lee la decisión que después compara.
  estudio <- estado$calc_muestra_estudio
  if (!is.list(estudio)) return(FALSE)
  ws <- estudio$workspace
  if (!is.list(ws)) return(FALSE)
  cfg <- ws$aulas_config
  if (!is.list(cfg)) return(FALSE)
  decision <- cfg$alumnos_por_ch_decision
  if (!is.list(decision)) return(FALSE)

  # Sólo se re-sella una decisión CONFIRMADA. Un sentinela incompleto —schema
  # vacío -- debe seguir fallando cerrado en /calcular, no quedar bendecido por
  # una reconstrucción.
  firma <- .cm_alumnos_por_ch_decision_signature(decision)
  if (!is.list(firma) || !identical(firma$schema, .cm_alumnos_por_ch_decision_schema)) {
    return(FALSE)
  }
  if (identical(.cm_aulas_scalar(decision$frame_hash, ""), hash)) return(FALSE)

  decision$frame_hash <- hash
  cfg$alumnos_por_ch_decision <- decision
  ws$aulas_config <- cfg
  estudio$workspace <- ws
  session_set(sid, "calc_muestra_estudio", estudio)
  TRUE
}

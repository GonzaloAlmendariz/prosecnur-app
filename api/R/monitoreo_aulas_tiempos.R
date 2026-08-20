# Los tiempos del estudio de aulas, para el payload del dashboard.
#
# Vive fuera de `monitoreo_aulas_universitarias.R` —que ya pasa de 1 900
# lineas— y se limita a poner los motores genericos de
# `monitoreo_tiempos_respuesta.R` en la forma que consume la vista.
#
# **Contesta siempre.** Cuando la base no trae marcas de inicio y fin —que es
# justo el caso del estudio de aulas de hoy: 43 columnas y una sola de tiempo,
# `_submission_time`— devuelve `disponible = FALSE` con el motivo. Una
# superficie que sabe que no hay tiempos puede decirlo dentro de su caja; una
# que no recibe nada solo puede desaparecer, y desaparecer es lo que hace que
# nadie se entere de que falta el dato.

#' Bloque de tiempos del dashboard de aulas
#'
#' @param responses Respuestas de la base.
#' @param cfg Config normalizada del perfil.
#' @param aula_por_respuesta Aula de cada respuesta, ya resuelta por el motor.
monitoreo_aulas_tiempos <- function(responses = data.frame(), cfg = list(),
                                    aula_por_respuesta = NULL) {
  disponibilidad <- monitoreo_tiempos_disponibilidad(names(responses))
  criterio <- monitoreo_tiempos_criterio(cfg)
  base <- list(
    disponible = isTRUE(disponibilidad$disponible),
    motivo = disponibilidad$motivo,
    columna_inicio = disponibilidad$inicio,
    columna_fin = disponibilidad$fin,
    criterio = list(
      declarado = isTRUE(criterio$declarado),
      umbral_min = criterio$umbral_min,
      leyenda = criterio$leyenda
    ),
    resumen = NULL,
    marcadas = NULL,
    por_aula = list()
  )
  if (!base$disponible || !NROW(responses)) return(base)

  minutos <- monitoreo_tiempos_por_respuesta(responses, disponibilidad)
  base$resumen <- monitoreo_tiempos_resumen(minutos, cola_min = 120)
  veredicto <- monitoreo_tiempos_veredicto(minutos, criterio)
  base$marcadas <- list(
    declarado = veredicto$declarado,
    n = veredicto$n_marcadas,
    de = veredicto$n_evaluadas
  )

  aulas <- as.character(aula_por_respuesta %||% character(0))
  if (length(aulas) == length(minutos) && any(nzchar(aulas))) {
    tabla <- monitoreo_tiempos_por_grupo(minutos, aulas)
    base$por_aula <- lapply(seq_len(nrow(tabla)), function(i) as.list(tabla[i, ]))
  }
  base
}

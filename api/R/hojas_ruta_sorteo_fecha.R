# Fecha del sorteo junto a su semilla (decisión de Gonzalo, 1 nov 2026).
#
# La muestra guardada (`workspace_outputs$sample`) ya traía la semilla y el algoritmo,
# pero no cuándo se sorteó: Monitoreo sólo podía fechar el envío (aviso I4). La fecha
# se sella al GUARDAR, no al previsualizar, porque la restauración del warm start
# vuelve a calcular el preview de la misma muestra y movería la fecha sin que nadie
# haya sorteado. Regla: una muestra con otra huella (ADR 0118 §3) es un sorteo nuevo
# y lleva la hora de ahora; la misma huella conserva la fecha que ya tenía. Una muestra
# guardada antes de esta regla, sin fecha, se queda sin ella: no se inventa.

.hojas_ruta_ahora_utc <- function() format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")

#' Sella `sorteado_en` en la muestra de unos outputs que se van a guardar.
#' @param previos Outputs guardados hasta ahora (normalizados o no).
#' @param nuevos Outputs que se van a guardar.
#' @param ahora Hora a sellar (ISO 8601 UTC); se inyecta en los tests.
#' @keywords internal
.hojas_ruta_sellar_sorteo <- function(previos, nuevos, ahora = .hojas_ruta_ahora_utc()) {
  nueva <- .hojas_ruta_list_get(nuevos, "sample")
  if (!.hojas_ruta_envio_tiene_bloques(nueva)) return(nuevos)
  previa <- .hojas_ruta_list_get(previos, "sample")
  huella <- .hojas_ruta_sample_fingerprint(nueva)
  misma <- .hojas_ruta_envio_tiene_bloques(previa) && identical(.hojas_ruta_sample_fingerprint(previa), huella)
  nueva$sorteado_en <- if (misma) {
    fecha <- .hojas_ruta_envio_chr(previa$sorteado_en)
    if (nzchar(fecha)) fecha else NULL
  } else {
    ahora
  }
  nuevos$sample <- nueva
  nuevos
}

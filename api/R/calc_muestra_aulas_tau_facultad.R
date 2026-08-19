# τ diferenciado por facultad (EF8b, era EFECTIVIDAD).
#
# Gonzalo, textual (2026-08-19, SUPERSEDE «referencial, no redimensionar»):
# «¿por qué estamos utilizando un indicador de efectividad del 53% en todas
# las facultades cuando cada facultad tiene su propia efectividad
# diferenciada? (…) podemos calcularla por facultad — eso de primeras.»
#
# ESPEJO EXACTO de tauPropioPorFacultad del sustento (frontend,
# sustentoDimensionamientoModel.ts): sobre los escalones APLICADOS de las
# cadenas 2025, Σefectivas/Σelegibles por facultad — la misma clase de tasa
# que el τ del diseño, no la asistencia bruta (otro denominador). Publica
# solo k ≥ 12 aulas aplicadas; con menos, el τ propio es ruido y el
# dimensionamiento cae al global DECLARÁNDOLO por fila.
#
# Paridad verificada sobre el payload vivo HSVG2026 (2026-08-19): DERECHO
# 0.562 (k=16) — MEJOR que el global 0.53; EGC 0.4279 (k=26) y EGL 0.4435
# (k=23) muy por debajo; C&I 0.538 (k=40) ≈ global. Seis facultades
# publicables; nueve con k<12 caen al global.

.cm_tau_k_minimo <- 12L

#' τ propio por facultad desde las filas de cadenas de la referencia
#' (`referencia_asistencia$cadenas_reemplazo$filas`). Devuelve una lista
#' nombrada por clave de facultad: list(tau=, k=) solo para k >= k_minimo.
.cm_tau_por_facultad <- function(cadenas_filas, k_minimo = .cm_tau_k_minimo) {
  out <- list()
  if (!is.list(cadenas_filas) || !length(cadenas_filas)) return(out)
  acc <- list()
  for (cadena in cadenas_filas) {
    if (!is.list(cadena)) next
    clave <- .cm_criterios_fac_key(cadena$facultad %||% "")
    if (!nzchar(clave)) next
    for (escalon in (cadena$escalones %||% list())) {
      if (!is.list(escalon) || !identical(escalon$estado, "aplicado")) next
      efectivas <- .cm_aulas_num(escalon$efectivas, NA_real_)
      elegibles <- .cm_aulas_num(escalon$elegibles, NA_real_)
      if (!is.finite(efectivas) || !is.finite(elegibles) || elegibles <= 0) next
      previo <- acc[[clave]] %||% list(efectivas = 0, elegibles = 0, k = 0L)
      previo$efectivas <- previo$efectivas + efectivas
      previo$elegibles <- previo$elegibles + elegibles
      previo$k <- previo$k + 1L
      acc[[clave]] <- previo
    }
  }
  for (clave in names(acc)) {
    d <- acc[[clave]]
    if (d$k >= k_minimo && d$elegibles > 0) {
      out[[clave]] <- list(tau = d$efectivas / d$elegibles, k = d$k)
    }
  }
  out
}

#' El τ que el dimensionamiento debe usar para UNA facultad: el propio si es
#' publicable, el global si no — con la fuente DECLARADA (VARA 0: el cambio
#' de vara se registra por fila, nunca se aplica en silencio).
.cm_tau_para_dimensionar <- function(facultad, taus_propios, tau_global) {
  clave <- .cm_criterios_fac_key(facultad %||% "")
  propio <- taus_propios[[clave]] %||% NULL
  if (is.list(propio) && is.finite(propio$tau %||% NA_real_)) {
    return(list(tau = propio$tau, fuente = "propio_2025", k = propio$k))
  }
  list(tau = tau_global, fuente = "global", k = 0L)
}

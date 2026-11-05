# =============================================================================
# hojas_ruta_distritos_sorteo.R — distritos de inclusión forzosa y distritos
# sorteados dentro de cada ciudad o área de Lima (ADR 0131 §1c, enmienda del 5/11)
# =============================================================================
#
# «Ir a un distrito solo para una encuesta es muy costoso, además cada ficha o
# ruta debe ser de un distrito en su totalidad» (Gonzalo, 5/11). Es la regla del
# §1b (`hojas_ruta_ciudades_sorteo.R`) un nivel más abajo. Rige con estrato
# provincia y la base de reparto 2025; `rutas_minimas_distrito = 0` la apaga y el
# estrato vuelve al redondeo sistemático del §1.
# =============================================================================

HOJAS_RUTA_RUTAS_MINIMAS_DISTRITO <- 3L

#' Campo `rutas_minimas_distrito` de `sample_size` (3 por defecto; 0 apaga el §1c).
#' Se suma desde `hojas_ruta_tamano_extras_normalizar()`.
hojas_ruta_distritos_normalizar <- function(x = NULL) {
  v <- if (is.list(x)) x$rutas_minimas_distrito else NULL
  v <- suppressWarnings(as.integer(if (is.null(v) || !length(v)) NA else unlist(v)[[1]]))
  if (is.na(v) || v < 0L) v <- HOJAS_RUTA_RUTAS_MINIMAS_DISTRITO
  list(rutas_minimas_distrito = v)
}

#' ¿Rige el §1c? Estrato provincia, base 2025 y mínimo ≥ 1. `params` es `cfg$sample_size`.
hojas_ruta_distritos_activo <- function(params) {
  hojas_ruta_estrato_activo(params) && hojas_ruta_reparto_base_activa(params) &&
    hojas_ruta_distritos_normalizar(params)$rutas_minimas_distrito >= 1L
}

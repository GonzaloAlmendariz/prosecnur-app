# =============================================================================
# hojas_ruta_sorteo_tope.R — PPS con tope en la medida (ADR 0120)
# =============================================================================
#
# El PPS por viviendas (ADR 0117) manda una de cada siete rutas a manzanas de 100
# viviendas o más, y ahí están los condominios y los conjuntos a los que el campo
# no entra (estudio del 2026-10-29 sobre acnur_acg). `pps_tope` es el mismo
# sistemático por distrito con la medida topada: M'_i = min(M_i, c_d), con c_d el
# p95 de M entre las manzanas del distrito con M > 0. π_i = n_d·M'_i/ΣM', con
# certezas por iteración; ninguna manzana con M > 0 queda con π = 0.
#
# Es un método elegible: `pps` sigue siendo el valor por defecto (decisión de
# Gonzalo, 2026-10-29: «Opción, PPS por defecto»). El diseño deja de ser
# autoponderado y la muestra lo avisa (`W_DESIGN_NOT_SELF_WEIGHTING`).
# =============================================================================

HOJAS_RUTA_ALGORITMO_SORTEO_TOPE <- "pps_tope_sistematico_distrito_v1"
HOJAS_RUTA_SORTEO_TOPE_PERCENTIL <- 0.95

.hojas_ruta_sorteo_es_tope <- function(cfg) identical(cfg$sampling_method, "pps_tope")

#' Firma del algoritmo con que se sortean las titulares según el método.
.hojas_ruta_sorteo_firma <- function(cfg) {
  if (.hojas_ruta_sorteo_es_tope(cfg)) HOJAS_RUTA_ALGORITMO_SORTEO_TOPE else HOJAS_RUTA_ALGORITMO_SORTEO
}

#' Las dos firmas vigentes: una muestra con cualquiera de ellas no es v1.
.hojas_ruta_sorteo_firmas_vigentes <- function() c(HOJAS_RUTA_ALGORITMO_SORTEO, HOJAS_RUTA_ALGORITMO_SORTEO_TOPE)

#' Tope del distrito: el p95 (cuantil tipo 7) de la medida entre las manzanas con
#' M > 0. NA si ninguna tiene medida.
.hojas_ruta_sorteo_tope_valor <- function(m) {
  m <- suppressWarnings(as.numeric(m))
  m <- m[is.finite(m) & m > 0]
  if (!length(m)) return(NA_real_)
  as.numeric(stats::quantile(m, HOJAS_RUTA_SORTEO_TOPE_PERCENTIL, names = FALSE, type = 7))
}

#' `cfg` con el tope del distrito fijado en `tope_medida`. El tope es del distrito
#' aunque el sorteo corra por zona: así la π de la zona usa la misma medida.
#' Para los otros métodos devuelve `cfg` tal cual.
.hojas_ruta_sorteo_cfg_distrito <- function(cfg, district_frame) {
  if (!.hojas_ruta_sorteo_es_tope(cfg)) return(cfg)
  cfg$tope_medida <- .hojas_ruta_sorteo_tope_valor(district_frame[[cfg$measure_var]])
  cfg
}

#' Aplica el tope a la medida ya saneada. Sin `tope_medida` (reemplazos), el tope
#' sale del propio `df`.
.hojas_ruta_sorteo_topar <- function(m, cfg) {
  tope <- suppressWarnings(as.numeric(cfg$tope_medida %||% .hojas_ruta_sorteo_tope_valor(m)))
  if (length(tope) != 1L || !is.finite(tope)) return(m)
  pmin(m, tope)
}

#' Lo que la π publicada agrega con tope: el valor del tope y cuántas manzanas del
#' ámbito lo alcanzan.
.hojas_ruta_sorteo_tope_publicado <- function(df, cfg) {
  if (!.hojas_ruta_sorteo_es_tope(cfg)) return(list())
  m <- suppressWarnings(as.numeric(df[[cfg$measure_var]]))
  m[!is.finite(m) | m < 0] <- 0
  tope <- suppressWarnings(as.numeric(cfg$tope_medida %||% .hojas_ruta_sorteo_tope_valor(m)))
  list(
    tope_medida = tope,
    tope_percentil = HOJAS_RUTA_SORTEO_TOPE_PERCENTIL * 100,
    manzanas_topadas = as.integer(if (is.finite(tope)) sum(m > tope) else 0L)
  )
}

#' Aviso único de la muestra con tope: el diseño no es autoponderado y el análisis
#' exige los pesos 1/π publicados.
.hojas_ruta_sorteo_aviso_tope <- function(cfg) {
  if (!.hojas_ruta_sorteo_es_tope(cfg)) return(NULL)
  list(
    level = "warn", code = "W_DESIGN_NOT_SELF_WEIGHTING",
    message = "El sorteo con tope limita el peso de cada manzana al percentil 95 de viviendas de su distrito: la muestra no es autoponderada y se analiza con los pesos 1/π publicados."
  )
}

# =============================================================================
# hojas_ruta_cuota_zona_aleatoria.R — la cuota por zona reparte las rutas al azar
# =============================================================================
#
# ADR 0117, Pendiente resuelto (decisión de Gonzalo, 2026-10-29: «repartir al
# azar»). Con cuota por zona (`row_var = "zona"`), `.hojas_ruta_finalize_quota_cells`
# repartía las rutas de un distrito entre sus zonas con un mayor resto
# DETERMINISTA: con 40-199 zonas y ~25 rutas, las zonas chicas recibían 0 rutas
# con cualquier semilla y sus manzanas tenían π = 0 (27-67 % de las viviendas del
# marco elegible de un distrito de Lima).
#
# Ahora el reparto es un redondeo aleatorio controlado: la zona z recibe ⌊x_z⌋ o
# ⌈x_z⌉ rutas, con x_z = R·P_z/ΣP y E[rutas_z] = x_z, y el total del distrito es
# exactamente R. Las fracciones se resuelven con un sistemático de paso 1 sobre
# las zonas en su orden (estrato implícito), con un arranque uniforme. Toda zona
# con población > 0 tiene probabilidad positiva de recibir ruta.
#
# Reproducible: el arranque sale de la semilla del proyecto (`cfg$seed`) y del
# distrito, en un generador local que no consume el flujo aleatorio del sorteo
# (la misma semilla sigue dando las mismas manzanas dentro de cada zona).
# =============================================================================

#' Semilla local del reparto de un distrito: estable por (semilla, distrito).
.hojas_ruta_cuota_zona_semilla <- function(seed, clave) {
  h <- digest::digest(list("cuota_zona", as.integer(seed), as.character(clave)), algo = "xxhash32")
  # 7 hex caben en un entero positivo de 32 bits.
  as.integer(strtoi(substr(h, 1L, 7L), base = 16L))
}

#' Rutas por zona con redondeo aleatorio controlado.
#'
#' @param weights Población de cada zona, en el orden en que se recorren.
#' @param n_routes Rutas del distrito (entero).
#' @param seed Semilla del proyecto. @param clave Identifica el distrito.
#' @return Entero por zona: ⌊x_z⌋ o ⌈x_z⌉, con suma `n_routes`.
.hojas_ruta_cuota_zona_rutas <- function(weights, n_routes, seed, clave) {
  w <- suppressWarnings(as.numeric(weights))
  w[!is.finite(w) | w < 0] <- 0
  n <- suppressWarnings(as.integer(n_routes))
  if (!length(w)) return(integer(0))
  if (is.na(n) || n <= 0L || sum(w) <= 0) return(integer(length(w)))
  x <- n * w / sum(w)
  base <- floor(x + 1e-9)
  k <- as.integer(round(n - sum(base)))
  if (k > 0L) {
    f <- pmax(0, x - base)
    old_seed <- if (exists(".Random.seed", envir = .GlobalEnv, inherits = FALSE)) {
      get(".Random.seed", envir = .GlobalEnv, inherits = FALSE)
    } else {
      NULL
    }
    on.exit({
      if (is.null(old_seed)) {
        if (exists(".Random.seed", envir = .GlobalEnv, inherits = FALSE)) rm(".Random.seed", envir = .GlobalEnv)
      } else {
        assign(".Random.seed", old_seed, envir = .GlobalEnv)
      }
    }, add = TRUE)
    set.seed(.hojas_ruta_cuota_zona_semilla(seed, clave))
    marcas <- stats::runif(1, 0, 1) + seq_len(k) - 1
    # Una marca que el redondeo deja justo al final cae en la última zona con fracción.
    extra <- pmin(max(which(f > 0)), findInterval(marcas, c(0, cumsum(f)), rightmost.closed = TRUE))
    base[extra] <- base[extra] + 1
  }
  as.integer(base)
}

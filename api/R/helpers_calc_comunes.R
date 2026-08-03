# =============================================================================
# Helpers comunes de cálculo muestral y micro-helpers compartidos del paquete
# =============================================================================
#
# Funciones puras compartidas entre el calculador (`calc_muestra_engine.R`) y
# cualquier otro consumidor de fórmulas estadísticas básicas. No dependen de
# Plumber, sesión ni I/O — sólo aritmética y validación.
#
# Fuente canónica: outputs/fuentes_metodologicas/00_COMPENDIO_METODOLOGICO_PULSO.md §2.

# ---------------------------------------------------------------------------
# Operador null-coalescing canónico del paquete
# ---------------------------------------------------------------------------
#
# Semántica: cae al default cuando `a` es NULL O un escalar NA. Es EXACTAMENTE
# la variante que ganaba históricamente en el namespace (la última en orden de
# collation vivía en `validacion_rule_factory.R`); consolidarla aquí no cambia
# comportamiento. No redefinir `%||%` a nivel top-level en otros archivos del
# paquete: esas copias quedan muertas (la última en collation pisa a las demás)
# y solo confunden sobre qué semántica aplica.
#
# Divergencias deliberadas que NO se fusionan aquí (cubren solo NULL, sin NA):
# las redefiniciones locales dentro de funciones de render (`graficador_*.R`,
# `reporte_plan_ppt.R`, `reporte_plan_word.R`, `reporte_spss.R`,
# `construir_plantilla_ppt.R`, `indicador_dimensiones.R`, `reporte_ficha_tecnica.R`,
# `reporte_filter_helpers.R`) usan `if (!is.null(x)) x else y`; borrarlas les
# cambiaría el manejo de NA escalar en pleno render, así que se quedan locales.
`%||%` <- function(a, b) if (is.null(a) || (length(a) == 1 && is.na(a))) b else a

# ---------------------------------------------------------------------------
# Fórmula clásica de tamaño muestral con FPC y deff
# ---------------------------------------------------------------------------

#' Calcula el tamaño muestral n para una proporción con efecto de diseño.
#'
#' Fórmula clásica con corrección por población finita:
#'
#'   n = (N · z² · p · q · deff) / ((N - 1) · e² + z² · p · q · deff)
#'
#' Cuando N → ∞ se reduce a `n = z² · p · q · deff / e²`.
#'
#' @param N Tamaño del universo (puede ser Inf).
#' @param p Proporción esperada (default 0.5).
#' @param z Valor crítico normal (default 1.96 para 95%).
#' @param e Margen de error (entre 0 y 1).
#' @param deff Efecto del diseño (≥ 1).
#' @return Entero — tamaño muestral redondeado hacia arriba.
calc_n_muestra <- function(N, p = 0.5, z = 1.96, e, deff = 1) {
  if (any(is.na(c(N, p, z, e, deff)))) {
    stop_api(400, "E_CALC_PARAMS",
             "Parámetros del cálculo no pueden ser NA.")
  }
  if (e <= 0 || e >= 1) {
    stop_api(400, "E_CALC_ERROR_RANGO",
             sprintf("El margen de error debe estar en (0, 1), recibido: %s", e))
  }
  if (p < 0 || p > 1) {
    stop_api(400, "E_CALC_P_RANGO",
             sprintf("La proporción p debe estar en [0, 1], recibida: %s", p))
  }
  if (deff < 1) {
    stop_api(400, "E_CALC_DEFF_RANGO",
             sprintf("deff debe ser ≥ 1, recibido: %s", deff))
  }

  q <- 1 - p
  num <- z^2 * p * q * deff
  if (is.infinite(N) || N <= 0) {
    n <- num / e^2
  } else {
    n <- (N * num) / ((N - 1) * e^2 + num)
  }
  as.integer(ceiling(n))
}

#' Inversa de calc_n_muestra: calcula el margen de error real alcanzado por un n dado.
#'
#' @param n Tamaño muestral logrado.
#' @param N Tamaño del universo.
#' @param p Proporción esperada.
#' @param z Valor crítico.
#' @param deff Efecto de diseño.
#' @return Margen de error e (entre 0 y 1) o NA si n inválido.
calc_e_desde_n_muestra <- function(n, N, p = 0.5, z = 1.96, deff = 1) {
  if (is.na(n) || n <= 0) return(NA_real_)
  q <- 1 - p
  num <- z^2 * p * q * deff * pmax(N - n, 0)
  den <- n * pmax(N - 1, 1)
  if (den <= 0) return(NA_real_)
  sqrt(num / den)
}

# ---------------------------------------------------------------------------
# Distribución proporcional con cuadratura
# ---------------------------------------------------------------------------

#' Distribuye un total proporcionalmente a una columna de pesos.
#'
#' Por defecto usa "cuadratura": los residuos del redondeo se absorben en la
#' categoría mayor para que la suma exacta coincida con `n_total`.
#'
#' @param n_total Tamaño total a distribuir.
#' @param pesos Vector numérico con pesos relativos (típicamente N por categoría).
#' @param redondeo `"arriba"`, `"cuadratura"` o
#'   `"round_residuo_controlado"`. El último modo conserva el `round()`
#'   metodológico y aplica el residuo a la categoría de mayor peso; se usa
#'   únicamente en la distribución universitaria P1/P2.
#' @return Vector entero con asignación por categoría.
distribuir_proporcional_pesos <- function(n_total, pesos, redondeo = "cuadratura") {
  if (length(pesos) == 0L) return(integer())
  total_peso <- sum(pesos, na.rm = TRUE)
  if (total_peso <= 0) return(rep(0L, length(pesos)))
  prop <- pesos / total_peso
  crudo <- n_total * prop
  asignado <- if (identical(redondeo, "round_residuo_controlado")) {
    round(crudo)
  } else {
    ceiling(crudo)
  }
  asignado[is.na(asignado)] <- 0L

  if (identical(redondeo, "cuadratura")) {
    asignado <- ajustar_cuadratura_residuo(asignado, n_total, pesos)
  } else if (identical(redondeo, "round_residuo_controlado")) {
    asignado <- ajustar_round_residuo_controlado(asignado, n_total, pesos)
  }
  as.integer(asignado)
}

#' Ajusta el residuo posterior a round() sin alterar la cuadratura legacy.
#'
#' Los empates se resuelven por el orden de entrada. Un residuo positivo se
#' suma a la categoría de mayor peso; uno negativo se descuenta de esa misma
#' categoría y, solo si no alcanza, continúa por peso descendente.
ajustar_round_residuo_controlado <- function(asignado, n_objetivo, pesos) {
  asignado <- as.integer(asignado)
  diff <- as.integer(n_objetivo - sum(asignado))
  if (diff == 0L || !length(asignado)) return(asignado)

  pesos <- suppressWarnings(as.numeric(pesos))
  pesos[!is.finite(pesos)] <- -Inf
  orden <- order(-pesos, seq_along(pesos))
  if (diff > 0L) {
    asignado[orden[[1L]]] <- asignado[orden[[1L]]] + diff
    return(asignado)
  }

  pendiente <- -diff
  for (idx in orden) {
    descuento <- min(asignado[[idx]], pendiente)
    asignado[[idx]] <- asignado[[idx]] - descuento
    pendiente <- pendiente - descuento
    if (pendiente == 0L) break
  }
  asignado
}

#' Ajusta una asignación entera para que su suma == n_objetivo.
#'
#' El residuo se aplica completo a la categoría con mayor peso.
ajustar_cuadratura_residuo <- function(asignado, n_objetivo, pesos = NULL) {
  diff <- n_objetivo - sum(asignado)
  if (diff == 0L) return(asignado)
  idx <- if (!is.null(pesos)) which.max(pesos) else which.max(asignado)
  asignado[idx] <- asignado[idx] + diff
  asignado[asignado < 0L] <- 0L
  asignado
}

# ---------------------------------------------------------------------------
# Helpers de coerción y validación de inputs
# ---------------------------------------------------------------------------
#
# Nota de consolidación (unidad 5.3): `.monitoreo_scalar` delega en `calc_str`
# (comportamiento idéntico). Los demás coercers de monitoreo NO se fusionan
# porque divergen a propósito: `.monitoreo_num`/`.monitoreo_int` toman el
# primer elemento de vectores (calc_num/calc_int devuelven default si
# length != 1), y `.monitoreo_bool` acepta "si"/"sí" y devuelve FALSE ante
# strings no reconocidos (calc_bool solo tokens en inglés y devuelve default).

#' Coerce a número con default si inválido o fuera de rango.
calc_num <- function(x, default, min = -Inf, max = Inf) {
  v <- suppressWarnings(as.numeric(x))
  if (length(v) != 1L || is.na(v) || v < min || v > max) return(default)
  v
}

#' Coerce a string con default si NA o NULL.
calc_str <- function(x, default = "") {
  if (is.null(x)) return(default)
  v <- as.character(x)[1]
  if (is.na(v)) return(default)
  v
}

#' Coerce a enum (string dentro de opciones).
calc_enum <- function(x, opts, default) {
  v <- calc_str(x, default)
  if (!(v %in% opts)) return(default)
  v
}

#' Coerce a entero con default si inválido.
calc_int <- function(x, default, min = -.Machine$integer.max, max = .Machine$integer.max) {
  v <- suppressWarnings(as.integer(x))
  if (length(v) != 1L || is.na(v) || v < min || v > max) return(default)
  v
}

#' Coerce a booleano: acepta TRUE/FALSE, "true"/"false", 0/1.
calc_bool <- function(x, default = FALSE) {
  if (is.null(x)) return(default)
  v <- x[[1]]
  if (is.logical(v)) return(as.logical(v))
  if (is.numeric(v)) return(as.logical(v))
  s <- tolower(as.character(v))
  if (s %in% c("true", "t", "yes", "y", "1")) return(TRUE)
  if (s %in% c("false", "f", "no", "n", "0")) return(FALSE)
  default
}

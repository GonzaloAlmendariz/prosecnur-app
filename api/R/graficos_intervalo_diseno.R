# Intervalo de 95% de una proporción bajo el diseño del estudio (especificación CCSS del 2026-11-04, §2)
# ==================================================================================================
#
# La lámina de hallazgos dibuja cada cifra con su intervalo. Hasta ahora el diseño (el aula como conglomerado) solo
# vivía dentro de la prueba de diferencias (graficos_significancia_diseno.R, ADR 0128). Aquí se calcula el intervalo de
# UNA proporción con la misma linealización, en R base y sin `survey` (que sigue solo en Suggests):
#
# - la cifra es un estimador de razón de dominio, p = Σ w·y / Σ w sobre los casos de su base (los que tienen `y`);
# - el aporte de cada caso es u = w·1[base]·(y − p) / W; se suma por conglomerado (el caso sin aula es su propio
#   conglomerado) y se toma la varianza entre conglomerados dentro de cada estrato (último conglomerado, con reemplazo,
#   sin corrección por población finita), con `.sig_vcov_conglomerados`;
# - el intervalo es p ± t·ee, con t de (conglomerados con casos de la base − estratos) grados de libertad, recortado a
#   [0, 1].
#
# Es lo que da `svymean(~y, subset(svydesign(ids = ~aula, weights = ~w), !is.na(y)))` con `confint(..., df = degf())`:
# el intervalo de Wald con t de la maqueta (`fuente/calc.R`). `test-graficos-intervalo-diseno.R` lo compara contra
# `survey`. Para una suma de filas (Top Two Box, «medio tiempo o tiempo completo») el indicador ya viene sumado por caso
# (`.sig_indicadores_derivar`), así que el intervalo es el de la suma y no la suma de intervalos.

#' Intervalo de confianza de una proporción con el diseño por conglomerados
#'
#' @param y Indicador por caso: 1/0, y `NA` fuera de la base de la cifra.
#' @param cluster Conglomerado de cada caso (`regla$conglomerado`); NULL es muestreo aleatorio simple.
#' @param estrato Estrato de cada caso, o NULL.
#' @param w Peso de cada caso (por defecto 1: los estudios sin ponderación).
#' @param nivel Nivel de confianza.
#' @return `list(p, inferior, superior, ee, n, gl, conglomerados, metodo)` con p e intervalo en proporción (0 a 1).
#' @keywords internal
.intervalo_diseno <- function(y, cluster = NULL, estrato = NULL, w = NULL, nivel = 0.95) {
  y <- suppressWarnings(as.numeric(y))
  n <- length(y)
  w <- if (is.null(w)) rep(1, n) else suppressWarnings(as.numeric(w))
  w[!is.finite(w)] <- 0
  base <- !is.na(y) & w > 0
  metodo <- if (is.null(cluster)) "aleatorio_simple" else "conglomerados"
  vacio <- list(p = NA_real_, inferior = NA_real_, superior = NA_real_, ee = NA_real_, n = sum(base), gl = NA_integer_,
                conglomerados = 0L, metodo = metodo)
  if (!any(base)) return(vacio)
  W <- sum(w[base])
  p <- sum(w[base] * y[base]) / W
  u <- numeric(n)
  u[base] <- w[base] * (y[base] - p) / W
  cl <- .sig_conglomerado_ultimo(cluster, n)
  st <- if (is.null(estrato)) rep("1", n) else {
    s <- trimws(as.character(estrato)); s[is.na(s) | !nzchar(s)] <- ".sin_estrato"; s
  }
  # El conglomerado se identifica dentro de su estrato: dos aulas con el mismo código en estratos distintos son dos.
  clave <- paste(st, cl, sep = "\r")
  U <- rowsum(u, clave, reorder = FALSE)
  estrato_cl <- st[match(rownames(U), clave)]
  V <- .sig_vcov_conglomerados(U, estrato_cl)
  ee <- sqrt(max(0, V[1, 1]))
  # Grados de libertad como `survey::degf()` sobre el dominio: conglomerados y estratos con casos de la base.
  con_base <- unique(clave[base])
  C <- length(con_base)
  H <- length(unique(st[base]))
  gl <- max(1L, as.integer(C - H))
  q <- stats::qt(1 - (1 - nivel) / 2, df = gl)
  list(p = p, inferior = max(0, p - q * ee), superior = min(1, p + q * ee), ee = ee, n = sum(base), gl = gl,
       conglomerados = C, metodo = metodo)
}

#' Intervalo de una cifra sobre una fuente, con el diseño de la regla del estudio
#'
#' @param fuente `.sig_fuente()` (data, survey, choices, orders_list).
#' @param y Indicador por caso (ver `.intervalo_diseno`).
#' @param regla Regla del estudio (`.sig_contexto_render()$regla`): su conglomerado y su estrato.
#' @keywords internal
.intervalo_diseno_fuente <- function(fuente, y, regla, nivel = 0.95) {
  d <- fuente$data
  cl <- if (!is.null(regla$conglomerado) && regla$conglomerado %in% names(d)) d[[regla$conglomerado]] else NULL
  st <- if (!is.null(regla$estrato) && regla$estrato %in% names(d)) d[[regla$estrato]] else NULL
  .intervalo_diseno(y, cluster = cl, estrato = st, w = .peso_vec(d), nivel = nivel)
}

#' Texto del intervalo para el lector: «29% a 41%»
#' @keywords internal
.intervalo_texto <- function(iv) {
  if (is.null(iv) || !is.finite(iv$inferior %||% NA_real_) || !is.finite(iv$superior %||% NA_real_)) return("")
  paste0(.tarjetas_pct(100 * iv$inferior), " a ", .tarjetas_pct(100 * iv$superior))
}

# =============================================================================
# Material de campo › Correo › Seguimiento: estadística de las pruebas de envío
# (prueba de horarios y correo personal). Funciones puras, sin sesión ni red.
#
# - Proporción con intervalo de Wilson al 95 %.
# - Diferencia de proporciones (A menos B) con el intervalo de Newcombe
#   (método 10, híbrido de Wilson): no se sale de [-1, 1] y se porta bien con
#   tasas chicas, que es lo normal en un recordatorio (2 a 5 %).
# - Cochran-Mantel-Haenszel por estratos (públicos): estadístico con
#   corrección de continuidad, como `stats::mantelhaen.test`, razón de odds
#   común de Mantel-Haenszel y su intervalo de Robins, Breslow y Greenland.
#   Se calcula a mano para admitir un solo estrato (mantelhaen.test exige dos).
#
# Todas las tasas se devuelven en escala 0-100 con su conteo y su base.
# =============================================================================

.PRUEBA_Z <- stats::qnorm(0.975)

.prueba_wilson <- function(x, n, z = .PRUEBA_Z) {
  if (is.na(n) || n <= 0) return(c(NA_real_, NA_real_))
  p <- x / n
  den <- 1 + z^2 / n
  centro <- (p + z^2 / (2 * n)) / den
  medio <- z * sqrt(p * (1 - p) / n + z^2 / (4 * n^2)) / den
  c(max(0, centro - medio), min(1, centro + medio))
}

#' Diferencia de proporciones p1 - p2 con el intervalo de Newcombe (híbrido de Wilson).
#' @return list(dif, li, ls) en escala 0-1.
#' @keywords internal
.prueba_newcombe <- function(x1, n1, x2, n2, z = .PRUEBA_Z) {
  if (n1 <= 0 || n2 <= 0) return(list(dif = NA_real_, li = NA_real_, ls = NA_real_))
  p1 <- x1 / n1; p2 <- x2 / n2
  w1 <- .prueba_wilson(x1, n1, z); w2 <- .prueba_wilson(x2, n2, z)
  d <- p1 - p2
  li <- d - sqrt((p1 - w1[1])^2 + (w2[2] - p2)^2)
  ls <- d + sqrt((w1[2] - p1)^2 + (p2 - w2[1])^2)
  list(dif = d, li = li, ls = ls)
}

#' Cochran-Mantel-Haenszel sobre estratos 2x2.
#' @param estratos data.frame con xA, nA, xB, nB (completas y base por grupo).
#' @return list(or, or_li, or_ls, chi2, p, estratos). `or` > 1 favorece al grupo A.
#' @keywords internal
.prueba_cmh <- function(estratos) {
  e <- estratos[estratos$nA > 0 & estratos$nB > 0, , drop = FALSE]
  vacio <- list(or = NA_real_, or_li = NA_real_, or_ls = NA_real_, chi2 = NA_real_, p = NA_real_, estratos = nrow(e))
  if (!nrow(e)) return(vacio)
  # En doble precisión: con públicos de 20 mil el producto de la varianza desborda un entero.
  xA <- as.numeric(e$xA); nA <- as.numeric(e$nA); xB <- as.numeric(e$xB); nB <- as.numeric(e$nB)
  a <- xA; b <- nA - xA; c <- xB; d <- nB - xB; n <- nA + nB
  ok <- n > 1
  a <- a[ok]; b <- b[ok]; c <- c[ok]; d <- d[ok]; n <- n[ok]
  if (!length(n)) return(vacio)
  esperado <- (a + b) * (a + c) / n
  varianza <- (a + b) * (c + d) * (a + c) * (b + d) / (n^2 * (n - 1))
  sv <- sum(varianza)
  chi2 <- if (sv > 0) (abs(sum(a) - sum(esperado)) - 0.5)^2 / sv else NA_real_
  if (!is.na(chi2) && abs(sum(a) - sum(esperado)) < 0.5) chi2 <- 0
  p <- if (is.na(chi2)) NA_real_ else stats::pchisq(chi2, df = 1, lower.tail = FALSE)
  R <- a * d / n; S <- b * c / n
  P <- (a + d) / n; Q <- (b + c) / n
  sR <- sum(R); sS <- sum(S)
  or <- if (sS > 0) sR / sS else NA_real_
  if (!is.na(or) && sR > 0) {
    v <- sum(P * R) / (2 * sR^2) + sum(P * S + Q * R) / (2 * sR * sS) + sum(Q * S) / (2 * sS^2)
    li <- exp(log(or) - .PRUEBA_Z * sqrt(v)); ls <- exp(log(or) + .PRUEBA_Z * sqrt(v))
  } else {
    li <- NA_real_; ls <- NA_real_
  }
  list(or = or, or_li = li, or_ls = ls, chi2 = chi2, p = p, estratos = length(n))
}

# Tasa en 0-100 con un decimal (dos si es menor a 10, como se leen las de un recordatorio).
.prueba_pct <- function(x, n) if (is.na(n) || n <= 0) NA_real_ else round(100 * x / n, 2)

# Veredicto de una comparación: "A", "B" o "empate", con su motivo.
# Gana un grupo sólo si el intervalo de la diferencia no toca el cero.
.prueba_veredicto <- function(li, ls) {
  if (is.na(li) || is.na(ls)) return("sin_datos")
  if (li > 0) return("A")
  if (ls < 0) return("B")
  "empate"
}

# Pocos casos: con menos de 10 completas esperadas en algún grupo, una
# diferencia es tendencia y no conclusión.
.prueba_pocos_casos <- function(xA, nA, xB, nB) {
  if (nA <= 0 || nB <= 0) return(TRUE)
  pool <- (xA + xB) / (nA + nB)
  min(nA, nB) * pool < 10
}

# Fila de comparación de un estrato (o del total): tasas, IC y diferencia.
.prueba_fila <- function(xA, nA, xB, nB) {
  wA <- .prueba_wilson(xA, nA); wB <- .prueba_wilson(xB, nB)
  dif <- .prueba_newcombe(xA, nA, xB, nB)
  list(
    nA = as.integer(nA), xA = as.integer(xA), pctA = .prueba_pct(xA, nA),
    pctA_li = round(100 * wA[1], 2), pctA_ls = round(100 * wA[2], 2),
    nB = as.integer(nB), xB = as.integer(xB), pctB = .prueba_pct(xB, nB),
    pctB_li = round(100 * wB[1], 2), pctB_ls = round(100 * wB[2], 2),
    dif_pp = round(100 * dif$dif, 2), dif_li = round(100 * dif$li, 2), dif_ls = round(100 * dif$ls, 2),
    veredicto = .prueba_veredicto(dif$li, dif$ls),
    pocos_casos = .prueba_pocos_casos(xA, nA, xB, nB)
  )
}

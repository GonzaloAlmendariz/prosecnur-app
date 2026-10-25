# lamina_callouts_sin_solape.R — CCSS-14 y CCSS-22: las cifras chicas que suben sobre una barra apilada o divergente.
#
# `.lam_barra_apilada` (lamina_escala.R) las separaba empujando SIEMPRE a la derecha con un paso fijo de 0.46 in desde
# la primera, y `.lam_laminas_divergentes` con un corrimiento a la derecha: dos cifras de segmentos vecinos («1% 1%»,
# «6% 5%») quedaban con sus codos superpuestos en la misma altura, la de la izquierda clavada y la otra corrida, y la
# del no sustantivo (gris, al final de la barra) podía caer sobre la de su izquierda.
#
# Criterio (conservador, anotado para el lead): NO se omite ninguna cifra. Ninguna de las chicas se puede recuperar de
# otro lado de la lámina: la leyenda nombra categorías, no cifras, y el Top Two Box suma las dos de arriba, que nunca son
# las chicas del extremo bajo ni el no sustantivo. Omitirlas callaría un dato. En su lugar, las cajas se reparten sin
# solaparse con su ancho de tinta medido y un aire mínimo, cada grupo de cifras vecinas centrado sobre sus segmentos
# (no empujado a la derecha), dentro de los bordes de la barra; la guía (el codo) sólo aparece cuando la cifra no
# quedó sobre su segmento.

#' Centros de las cifras chicas sin solaparse
#'
#' Algoritmo de grupos: se recorren de izquierda a derecha; una cifra que pisaría a la anterior se funde con su grupo y
#' el grupo se centra en el promedio de sus segmentos (así el corrimiento se reparte a ambos lados); luego el grupo se
#' encierra en `[x0, x1]`. Con cifras que no caben ni a lo ancho de la barra, se reparten a paso parejo entre los bordes.
#'
#' @param cs Centros de los segmentos (in), en orden de la barra.
#' @param anchos Ancho de tinta de cada cifra (in).
#' @param x0,x1 Bordes donde pueden ir las cajas (in).
#' @param aire Separación mínima entre cajas (in).
#' @return Centros de las cifras (in), en el mismo orden.
#' @keywords internal
.lam_callouts_sin_solape <- function(cs, anchos, x0, x1, aire = 0.12) {
  n <- length(cs); if (!n) return(numeric(0))
  w <- pmax(0, as.numeric(anchos)); w[!is.finite(w)] <- 0
  # Cada cifra ocupa su tinta más el aire; el grupo, la suma.
  ocupa <- w + aire
  grupos <- list()
  colocar <- function(g) {
    total <- sum(ocupa[g]); centro <- mean(cs[g])
    ini <- centro - total / 2
    ini <- max(x0 - aire / 2, min(ini, x1 + aire / 2 - total))
    ini + cumsum(ocupa[g]) - ocupa[g] / 2
  }
  for (k in seq_len(n)) {
    grupos[[length(grupos) + 1L]] <- k
    repeat {
      m <- length(grupos); if (m < 2L) break
      a <- grupos[[m - 1L]]; b <- grupos[[m]]
      pa <- colocar(a); pb <- colocar(b)
      fin_a <- pa[length(pa)] + ocupa[a[length(a)]] / 2; ini_b <- pb[1] - ocupa[b[1]] / 2
      if (ini_b >= fin_a - 1e-9) break
      grupos[[m - 1L]] <- c(a, b); grupos[[m]] <- NULL
    }
  }
  pos <- numeric(n)
  for (g in grupos) pos[g] <- colocar(g)
  pos
}

#' Centros de las cifras chicas de una fila divergente: cada lado se reparte por su cuenta y nunca cruza la línea del
#' centro (verificador de N6, ronda 3); dentro de su lado, sin solaparse y centradas en sus segmentos
#' @param chicas Segmentos chicos de la fila (`list(k, x, w)`), en cualquier orden.
#' @param textos Cifra de cada segmento, indexada por `k`.
#' @param xc Línea del centro. @param x0,x1 Bordes de la fila de barras.
#' @return Centros nombrados por `k`.
#' @keywords internal
.lam_divergentes_callouts <- function(chicas, textos, xc, x0, x1, size = 10.5) {
  out <- numeric(0)
  if (!length(chicas)) return(out)
  k <- vapply(chicas, `[[`, 0, "k"); cs <- vapply(chicas, function(s) s$x + s$w / 2, 0)
  wt <- .lam_ancho_tinta(as.character(textos[k]), size, TRUE)
  for (izq in c(TRUE, FALSE)) {
    m <- if (izq) cs < xc else cs >= xc
    if (!any(m)) next
    o <- order(cs[m])
    lim <- if (izq) c(x0, xc - 0.05) else c(xc + 0.05, x1)
    p <- .lam_callouts_sin_solape(cs[m][o], wt[m][o], lim[1], lim[2], aire = 0.12)
    out[as.character(k[m][o])] <- p
  }
  out
}

# ---- Acotado al defecto (Arte idéntico) --------------------------------------------------------------------------
# El informe Arte aprobado lleva pares «2% ⌐6%» con la colocación anterior (paso fijo a la derecha) y debe salir igual.
# Esa colocación sólo falla cuando los codos de dos cifras se cruzan en la misma altura (cadenas de tres o más cifras
# chicas, «5% 3% 5%») o cuando dos tintas quedan a menos de 0.06 in. Sólo entonces se usa el reparto nuevo.

#' ¿Una colocación cruza codos o encima tintas? Codo de cada cifra: el tramo entre su segmento y su centro
#' @keywords internal
.lam_callouts_chocan <- function(cs, pos, anchos, aire_min = 0.06) {
  if (length(cs) < 2L) return(FALSE)
  o <- order(pos); cs <- cs[o]; pos <- pos[o]; w <- anchos[o]
  a0 <- pmin(cs, pos); a1 <- pmax(cs, pos); con_codo <- abs(pos - cs) > 0.01
  cruce <- FALSE
  for (i in seq_along(cs)) for (j in seq_along(cs)) if (i < j && con_codo[i] && con_codo[j] && a0[j] < a1[i] - 1e-9 && a0[i] < a1[j] - 1e-9) cruce <- TRUE
  cruce || any(diff(pos) - (w[-1] + w[-length(w)]) / 2 < aire_min - 1e-9)
}

#' Centros de las cifras chicas de una barra apilada (lamina_escala.R): la colocación de siempre si no choca; si no, la nueva
#' @keywords internal
.lam_callouts_escala <- function(cs, textos, x, w, size = .std_pt("cifra_fuera")) {
  pos <- cs
  for (k in seq_along(pos)[-1]) pos[k] <- max(pos[k], pos[k - 1] + 0.46)
  m <- length(pos); lim <- x + w - 0.12
  if (m && pos[m] > lim) { pos[m] <- lim; if (m > 1) for (k in (m - 1):1) pos[k] <- min(pos[k], pos[k + 1] - 0.46) }
  anchos <- .lam_ancho_tinta(textos, size, TRUE)
  if (!.lam_callouts_chocan(cs, pos, anchos)) return(pos)
  structure(.lam_callouts_sin_solape(cs, anchos, x - 0.15, x + w + 0.15), reparto = "nuevo")
}

#' Centros de las cifras chicas de una fila divergente: la colocación de siempre (secuencial, sin cruzar el centro) si no
#' choca; si no, `.lam_divergentes_callouts`
#' @keywords internal
.lam_callouts_divergentes <- function(chicas, textos, xc, x0, x1, size = 10.5) {
  if (!length(chicas)) return(numeric(0))
  chicas <- chicas[order(vapply(chicas, `[[`, 0, "x"))]
  k <- vapply(chicas, `[[`, 0, "k"); cs <- vapply(chicas, function(s) s$x + s$w / 2, 0)
  wt <- .lam_ancho_tinta(as.character(textos[k]), size, TRUE)
  pos <- numeric(length(cs)); fin <- -Inf
  for (i in seq_along(cs)) {
    cl <- max(cs[i], fin + 0.06 + wt[i] / 2)
    if (abs(cl - xc) < wt[i] / 2 + 0.05) {
      cl <- if (cs[i] < xc) xc - 0.05 - wt[i] / 2 else xc + 0.05 + wt[i] / 2
      if (cl - wt[i] / 2 < fin + 0.06) cl <- xc + 0.05 + wt[i] / 2
    }
    pos[i] <- cl; fin <- cl + wt[i] / 2
  }
  if (!.lam_callouts_chocan(cs, pos, wt)) return(stats::setNames(pos, as.character(k)))
  structure(.lam_divergentes_callouts(chicas, textos, xc, x0, x1, size), reparto = "nuevo")
}

#' La guía de una cifra chica. Con la colocación de siempre, el tic vertical y el codo horizontal de siempre (Arte idéntico).
#' Con el reparto nuevo, un trazo recto del segmento a la cifra: como los segmentos y las cifras van en el mismo orden,
#' los trazos no se cruzan, mientras que los codos horizontales de una cadena corrida a un lado se montaban en la misma
#' altura y se leían como un solo corchete.
#' @param y Borde superior de la barra. @param alto,y_codo Tic y altura del codo de siempre.
#' @param nuevo `TRUE` si la posición salió del reparto nuevo.
#' @keywords internal
.lam_callout_guia <- function(lz, cs, pos, y, alto, y_codo, nuevo, col, nombre = "guia") {
  if (isTRUE(nuevo)) return(.lam_linea(lz, cs, y - 0.004, pos, y - alto - 0.02, col, pt = 0.9, nombre = nombre))
  .lam_caja(lz, cs - 0.006, y - alto, 0.012, alto, col, nombre = nombre)
  if (abs(pos - cs) > 0.01) .lam_caja(lz, min(cs, pos), y_codo, abs(pos - cs), 0.012, col, nombre = nombre)
  invisible(lz)
}

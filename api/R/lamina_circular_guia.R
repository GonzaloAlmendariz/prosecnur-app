# Cifras de las porciones de una torta con línea guía (frente C, pedido de Gonzalo, CCSS Perfil 2026).
#
# La cifra de una porción chica no se mete donde no cabe ni se encima con la vecina («2%» sobre «1%»): sale fuera del
# disco, unida a su porción por una línea fina. «Chica» es lo mismo que en las barras apiladas (`.lam_tiene_peq`,
# lamina_escala.R): la cifra no cabe a lo ancho de su segmento con 0.12 in de aire. En el disco el segmento es el arco de
# la porción a la altura donde va la cifra.

#' ¿La cifra no cabe en su porción? El umbral de las barras apiladas sobre el arco disponible (in)
#' @keywords internal
.lam_circular_cifra_chica <- function(cifra, arco, size = .std_pt("cifra")) {
  !(arco >= .lam_ancho_txt(cifra, size, TRUE) + 0.12)
}

#' Separa posiciones (sobre una recta o en fracciones del círculo) para que queden a `minimo` sin cambiar su orden
#'
#' Empuja hacia adelante y, si la última se pasa de `tope`, recorre hacia atrás (como las cifras chicas de las apiladas).
#' @keywords internal
.lam_circular_separar <- function(pos, minimo, tope = Inf) {
  if (length(pos) < 2L) return(pos)
  o <- order(pos); p <- pos[o]
  for (k in seq_along(p)[-1]) p[k] <- max(p[k], p[k - 1L] + minimo)
  m <- length(p)
  if (p[m] > tope) { p[m] <- tope; for (k in (m - 1L):1) p[k] <- min(p[k], p[k + 1L] - minimo) }
  out <- pos; out[o] <- p
  out
}

#' Cifras de la torta nativa: dentro de la porción si caben; si no, fuera con su línea guía y sin encimarse
#'
#' @param f,acum Fracción de cada porción y su acumulado (desde las 12, horario).
#' @keywords internal
.lam_circular_cifras <- function(lz, espec, cx, cy, r, f, acum, cols, prefijo = "torta") {
  azul <- .std_color("azul"); tenue <- .std_color("texto_tenue"); k <- length(f)
  mid <- acum[seq_len(k)] + f / 2
  chica <- vapply(seq_len(k), function(i) f[i] > 0 && .lam_circular_cifra_chica(espec$cifras[i], 2 * pi * (r * 0.5) * f[i]), TRUE)
  for (i in which(f > 0 & !chica)) {
    a <- 2 * pi * mid[i]; tx <- cx + r * 0.5 * sin(a); ty <- cy - r * 0.5 * cos(a)
    col_t <- if (!is.null(espec$colores)) .lam_texto_sobre(cols[i]) else if (i == 1L) "#FFFFFF" else azul
    .lam_txt(lz, espec$cifras[i], tx - 0.4, ty - 0.15, 0.8, 0.3, .std_pt("cifra"), col_t, bold = TRUE, align = "center",
             nombre = paste0(prefijo, ":cifra"))
  }
  idx <- which(f > 0 & chica)
  if (!length(idx)) return(invisible(lz))
  # Las cifras de fuera van en un aro a 1.3 r; dos vecinas quedan al menos a lo que mide la caja más ancha.
  R <- r * 1.3
  wbox <- max(0.7, max(.lam_ancho_txt(espec$cifras[idx], .std_pt("cifra_fuera"), TRUE)) + 0.35)   # con los 0.1 in de margen interno
  pos <- .lam_circular_separar(mid[idx], (wbox + 0.05) / (2 * pi * R))
  for (j in seq_along(idx)) {
    i <- idx[j]; a0 <- 2 * pi * mid[i]; a1 <- 2 * pi * pos[j]
    .lam_linea(lz, cx + r * 0.98 * sin(a0), cy - r * 0.98 * cos(a0), cx + R * 0.86 * sin(a1), cy - R * 0.86 * cos(a1),
               tenue, pt = 0.75, nombre = paste0(prefijo, ":guia"))
    tx <- cx + R * sin(a1); ty <- cy - R * cos(a1)
    .lam_txt(lz, espec$cifras[i], tx - wbox / 2, ty - 0.15, wbox, 0.3, .std_pt("cifra_fuera"), azul, bold = TRUE, align = "center",
             nombre = paste0(prefijo, ":cifra_fuera"))
  }
  invisible(lz)
}

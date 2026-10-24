# Cifras de las porciones de una torta o dona con línea guía (frente C, pedidos de Gonzalo, CCSS Perfil 2026).
#
# La cifra de una porción chica no se mete donde no cabe ni se encima con la vecina («2%» sobre «0%»): sale fuera del
# disco unida a su porción por una guía de dos tramos. El primero es recto y radial: sale del borde de la porción, en su
# ángulo medio, perpendicular a la circunferencia, con un largo fijo corto. El segundo es un arco concéntrico que corre
# por fuera del disco hasta el ángulo donde va la cifra; si la cifra cabe en su propio ángulo, el arco mide cero
# («la línea debería ser recta y perpendicular a 90° y luego curvar siguiendo la curvatura de la circunferencia»).
# «Chica» es lo mismo que en las barras apiladas (`.lam_tiene_peq`, lamina_escala.R): la cifra no cabe a lo ancho de su
# segmento con 0.12 in de aire; en el disco el segmento es el arco de la porción a la altura de la cifra. La guía tiene
# el color y el grosor de la de las apiladas (`texto_tenue`, 0.012 in).

.LAM_GUIA_LARGO_IN <- 0.15          # tramo radial
.LAM_GUIA_PT <- 0.012 * 72          # el grosor de la guía de las apiladas (lamina_escala.R)

#' ¿La cifra no cabe en su porción? El umbral de las barras apiladas sobre el arco disponible (in)
#' @keywords internal
.lam_circular_cifra_chica <- function(cifra, arco, size = .std_pt("cifra")) {
  !(arco >= .lam_ancho_txt(cifra, size, TRUE) + 0.12)
}

#' Separa posiciones (fracciones del círculo) para que queden a `minimo` sin cambiar su orden
#'
#' Las que chocan forman un grupo que se abre hacia los dos lados alrededor del promedio de sus posiciones, y los grupos
#' que vuelven a chocar se funden: así una cifra no se va lejos de su porción por empujar sólo hacia adelante.
#' @keywords internal
.lam_circular_separar <- function(pos, minimo, tope = Inf) {
  n <- length(pos)
  if (n < 2L || !is.finite(minimo) || minimo <= 0) return(pos)
  o <- order(pos); p0 <- pos[o]
  grupos <- as.list(seq_len(n))
  lugar <- function(g) mean(p0[g]) + (seq_along(g) - (length(g) + 1) / 2) * minimo
  repeat {
    fundido <- FALSE
    k <- 1L
    while (k < length(grupos)) {
      a <- lugar(grupos[[k]]); b <- lugar(grupos[[k + 1L]])
      if (b[1] - a[length(a)] < minimo - 1e-12) {
        grupos[[k]] <- c(grupos[[k]], grupos[[k + 1L]]); grupos[[k + 1L]] <- NULL; fundido <- TRUE
      } else k <- k + 1L
    }
    if (!fundido) break
  }
  p <- unlist(lapply(grupos, lugar))
  out <- pos; out[o] <- p
  out
}

#' Trazo de la guía en coordenadas polares: el tramo radial y el arco concéntrico
#'
#' @param a0,a1 Ángulo de la porción y de la cifra, en fracciones del círculo (desde las 12, horario).
#' @param r,largo Radio del borde y largo del tramo radial (en las mismas unidades).
#' @return `data.frame(ang, rad)`: dos puntos radiales y, si `a1 != a0`, `n` tramos del arco a radio `r + largo`.
#' @keywords internal
.lam_circular_guia_trazo <- function(a0, a1, r, largo, n = 12L) {
  r1 <- r + largo
  tr <- data.frame(ang = c(a0, a0), rad = c(r, r1))
  if (abs(a1 - a0) > 1e-9) tr <- rbind(tr, data.frame(ang = seq(a0, a1, length.out = n + 1L)[-1L], rad = r1))
  tr
}

#' Dónde va la cifra al final del arco: apenas afuera y alineada según el lado
#' @return `list(hjust, vjust, align)`: a la derecha del centro arranca en el punto, a la izquierda termina en él y arriba
#'   o abajo va centrada.
#' @keywords internal
.lam_circular_cifra_lado <- function(a1) {
  s <- sin(2 * pi * a1); c <- cos(2 * pi * a1)
  if (s > 0.3) return(list(hjust = 0, vjust = 0.5, align = "left"))
  if (s < -0.3) return(list(hjust = 1, vjust = 0.5, align = "right"))
  list(hjust = 0.5, vjust = if (c >= 0) 0 else 1, align = "center")
}

#' Separación mínima (en fracciones del círculo) entre cifras de fuera a radio `R` (in): lo que mide cada cifra a lo
#' largo del arco donde va (a las 12, su ancho; a las 3, su alto) y un respiro
#' @keywords internal
.lam_circular_minimo <- function(ang, w, h, R) {
  necesita <- abs(cos(2 * pi * ang)) * w + abs(sin(2 * pi * ang)) * h + 0.06
  max(necesita) / (2 * pi * R)
}

#' Caja (in) de una cifra de fuera dibujada al final de su guía
#' @keywords internal
.lam_circular_cifra_caja <- function(px, py, w, h, lado) {
  x <- switch(lado$align, left = px, right = px - w, center = px - w / 2)
  y <- if (identical(lado$align, "center")) (if (lado$vjust == 0) py - h else py) else py - h / 2
  c(x = x, y = y, w = w, h = h)
}

#' Cifras de la torta nativa: dentro de la porción si caben; si no, fuera con su guía de dos tramos y sin encimarse
#'
#' @param f,acum Fracción de cada porción y su acumulado (desde las 12, horario).
#' @keywords internal
#' @param r_cifra Radio donde va la cifra dentro (la torta, a media distancia del centro; la dona, a media altura del aro).
#' @param color_sobre `TRUE`: la cifra de dentro toma el color que se lee sobre su porción (la dona); si no, la regla de la
#'   torta (blanca sobre la primera, azul sobre las demás, salvo paleta propia).
.lam_circular_cifras <- function(lz, espec, cx, cy, r, f, acum, cols, prefijo = "torta", r_cifra = r * 0.5, color_sobre = FALSE,
                                 nombre_dentro = paste0(prefijo, ":cifra")) {
  azul <- .std_color("azul"); tenue <- .std_color("texto_tenue"); k <- length(f)
  mid <- acum[seq_len(k)] + f / 2
  chica <- vapply(seq_len(k), function(i) f[i] > 0 && .lam_circular_cifra_chica(espec$cifras[i], 2 * pi * r_cifra * f[i]), TRUE)
  for (i in which(f > 0 & !chica)) {
    a <- 2 * pi * mid[i]; tx <- cx + r_cifra * sin(a); ty <- cy - r_cifra * cos(a)
    col_t <- if (isTRUE(color_sobre) || !is.null(espec$colores)) .lam_texto_sobre(cols[i]) else if (i == 1L) "#FFFFFF" else azul
    .lam_txt(lz, espec$cifras[i], tx - 0.4, ty - 0.15, 0.8, 0.3, .std_pt("cifra"), col_t, bold = TRUE, align = "center",
             nombre = nombre_dentro)
  }
  idx <- which(f > 0 & chica)
  if (!length(idx)) return(invisible(lz))
  size <- .std_pt("cifra_fuera")
  R <- r + .LAM_GUIA_LARGO_IN
  # La caja con sus 0.1 in de margen interno a cada lado; el alto, una línea con sus márgenes.
  wtxt <- .lam_ancho_tinta(espec$cifras[idx], size, TRUE) + 0.24; htxt <- size * 1.2 / 72 + 0.1
  pos <- .lam_circular_separar(mid[idx], .lam_circular_minimo(mid[idx], max(wtxt), htxt, R))   # las cajas, no sólo la tinta
  for (j in seq_along(idx)) {
    i <- idx[j]
    tr <- .lam_circular_guia_trazo(mid[i], pos[j], r, .LAM_GUIA_LARGO_IN)
    xs <- cx + tr$rad * sin(2 * pi * tr$ang); ys <- cy - tr$rad * cos(2 * pi * tr$ang)
    for (s in seq_len(nrow(tr) - 1L)) .lam_linea(lz, xs[s], ys[s], xs[s + 1L], ys[s + 1L], tenue, pt = .LAM_GUIA_PT, nombre = paste0(prefijo, ":guia"))
    lado <- .lam_circular_cifra_lado(pos[j])
    px <- cx + (R + 0.03) * sin(2 * pi * pos[j]); py <- cy - (R + 0.03) * cos(2 * pi * pos[j])
    # La caja de texto lleva 0.1 in de margen a cada lado: se corre para que la tinta quede junto al final de la guía.
    cj <- .lam_circular_cifra_caja(px + switch(lado$align, left = -0.1, right = 0.1, center = 0), py, wtxt[j], htxt, lado)
    .lam_txt(lz, espec$cifras[i], cj[["x"]], cj[["y"]], cj[["w"]], cj[["h"]], size, azul, bold = TRUE, align = lado$align,
             nombre = paste0(prefijo, ":cifra_fuera"))
  }
  invisible(lz)
}

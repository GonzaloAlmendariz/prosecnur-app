# graficador_barras_divergentes_cifras.R — las cifras de la divergente imagen: dentro si caben, fuera con guía si no
#
# Ola 2, E1b (diag4/e1b_repel.R): la divergente que sale como imagen (en una lámina de varios gráficos) ponía todas sus
# cifras con `position_stack`, centradas en su segmento y sin medir: «4%» y «5%» vecinos en el lado negativo se pisaban,
# el cuerpo era 8.5 pt (no el del preset) y las de menos de 3 % (`umbral_etiqueta_pct`) no se escribían, cuando la lámina
# nativa las muestra con guía.
#
# Decisión del lead (invariante «toda cifra legible»): en la imagen cada cifra va dentro de su segmento si su tinta cabe
# (medida en pulgadas con el ancho del lienzo) y, si no, encima de su barra con una guía corta hasta su segmento. Las de
# una misma fila que quedarían montadas se separan hacia afuera del cero. Ninguna se achica ni se oculta. Sólo geometría:
# los valores y su redondeo son los del motor.

#' Posición de cada cifra de la divergente
#'
#' @param lab Filas a rotular (`.item`, `.signo`, `.lado`, `.orden_apilado`, `.lab`), sin el neutro partido (`neu2`).
#' @param df Todas las filas apiladas (incluido `neu2`), para reconstruir los segmentos.
#' @param size_pt Cuerpo de la cifra. @param in_por_unidad Pulgadas por unidad del eje de valores.
#' @param grosor Grosor de la barra en unidades de fila.
#' @return `lab` con `.x`, `.y`, `.hjust`, `.dentro` y, para las de fuera, `.gx`, `.gy0`, `.gy1` (la guía).
#' @keywords internal
.divergentes_cifras_posiciones <- function(lab, df, size_pt, in_por_unidad, grosor) {
  lab$.x <- NA_real_; lab$.y <- as.numeric(lab$.item); lab$.dentro <- TRUE
  lab$.gx <- NA_real_; lab$.gy0 <- NA_real_; lab$.gy1 <- NA_real_
  if (!nrow(lab)) return(lab)
  # Segmentos: cada lado se apila desde el cero; el orden de apilado menor queda más lejos (geom_col).
  seg <- df[, c(".item", ".cat", ".signo", ".lado", ".orden_apilado")]
  seg$x0 <- NA_real_; seg$x1 <- NA_real_
  for (it in unique(seg$.item)) for (neg in c(TRUE, FALSE)) {
    i <- which(seg$.item == it & (seg$.signo < 0) == neg)
    if (!length(i)) next
    i <- i[order(-seg$.orden_apilado[i])]
    fin <- cumsum(seg$.signo[i]); ini <- c(0, utils::head(fin, -1L))
    seg$x0[i] <- ini; seg$x1[i] <- fin
  }
  for (r in seq_len(nrow(lab))) {
    it <- lab$.item[r]; ct <- as.character(lab$.cat[r])
    if (lab$.lado[r] == "neu") {
      j <- which(seg$.item == it & as.character(seg$.cat) == ct)
      lab$.x[r] <- 0; ancho_seg <- sum(abs(seg$x1[j] - seg$x0[j]))
    } else {
      j <- which(seg$.item == it & as.character(seg$.cat) == ct & seg$.lado == lab$.lado[r])[1]
      lab$.x[r] <- (seg$x0[j] + seg$x1[j]) / 2; ancho_seg <- abs(seg$x1[j] - seg$x0[j])
    }
    tinta <- .ancho_texto_in(lab$.lab[r], size_pt)
    lab$.dentro[r] <- nzchar(lab$.lab[r]) && ancho_seg * in_por_unidad >= tinta + 0.06
  }
  # Las de fuera: encima de su barra; las de una fila que se montarían se separan hacia afuera del cero.
  fuera <- which(!lab$.dentro & nzchar(lab$.lab))
  if (length(fuera)) {
    w_u <- (.ancho_texto_in(lab$.lab[fuera], size_pt) + 0.06) / in_por_unidad
    names(w_u) <- fuera
    # G-d (ola 3): ninguna cifra de fuera cruza la línea del cero: la de cada lado se queda entera en su lado.
    margen0 <- 0.04 / in_por_unidad
    for (k in seq_along(fuera)) {
      r <- fuera[k]
      if (lab$.lado[r] == "neu") next
      if (lab$.x[r] < 0) lab$.x[r] <- min(lab$.x[r], -(w_u[k] / 2 + margen0)) else lab$.x[r] <- max(lab$.x[r], w_u[k] / 2 + margen0)
    }
    for (it in unique(lab$.item[fuera])) for (neg in c(TRUE, FALSE)) {
      i <- fuera[lab$.item[fuera] == it & (lab$.x[fuera] < 0) == neg]
      if (length(i) < 2L) next
      i <- i[order(abs(lab$.x[i]))]   # del cero hacia afuera
      for (q in 2:length(i)) {
        a <- i[q - 1L]; z <- i[q]
        hueco <- (w_u[as.character(a)] + w_u[as.character(z)]) / 2
        if (abs(lab$.x[z] - lab$.x[a]) < hueco) lab$.x[z] <- lab$.x[a] + (if (neg) -hueco else hueco)
      }
    }
    lab$.gx[fuera] <- vapply(fuera, function(r) {
      j <- which(seg$.item == lab$.item[r] & as.character(seg$.cat) == as.character(lab$.cat[r]))[1]
      (seg$x0[j] + seg$x1[j]) / 2
    }, 0)
    lab$.gy0[fuera] <- lab$.y[fuera] + grosor / 2
    lab$.y[fuera] <- lab$.y[fuera] + grosor / 2 + 0.06
    lab$.gy1[fuera] <- lab$.y[fuera] - 0.01
  }
  lab$.hjust <- 0.5
  lab
}

#' Pulgadas por unidad del eje de valores de la divergente, con el ancho del lienzo
#'
#' El panel ocupa el lienzo menos la columna de rótulos de las filas y su margen; el eje mide `rango` unidades.
#' @keywords internal
.divergentes_in_por_unidad <- function(ancho, rotulos, size_ejes, rango) {
  a <- suppressWarnings(as.numeric(ancho)[1]); if (length(a) != 1L || !is.finite(a) || a <= 0) a <- 10
  col_rot <- max(c(0, .ancho_texto_in(as.character(rotulos), size_ejes))) + 0.3
  max(0.5, a - col_rot - 0.3) / max(1e-6, rango)
}

#' Grosor de la divergente imagen que deja aire entre una cifra de fuera y la barra de la fila de arriba (O5 ola 3)
#'
#' La cifra que no cabe en su segmento va encima de su barra (`.divergentes_cifras_posiciones`, 0.06 de fila sobre ella). En
#' un lienzo bajo la fila mide ~0.45 in y la cifra de 14 pt llegaba a la barra de arriba. Con el alto del lienzo se mide la
#' fila (el panel sin leyenda, eje, pie y márgenes, entre las filas más la expansión del eje discreto) y, sólo si alguna cifra
#' de fuera tiene una fila encima, la barra baja lo justo para dejar `0.03 in`. Sin alto, el grosor no cambia.
#' @return Grosor en unidades de fila.
#' @keywords internal
.divergentes_grosor_con_aire <- function(df, df_si, grosor, decimales, size_pt, size_ejes, tope, mostrar_saldo, ancho, alto, n_ley,
                                         izq = tope) {
  a <- suppressWarnings(as.numeric(alto)[1])
  if (!length(a) || !is.finite(a) || a <= 0 || !nrow(df)) return(grosor)
  n <- length(levels(df$.item) %||% unique(df$.item))
  dec <- suppressWarnings(as.integer(decimales)[1]); if (!is.finite(dec) || dec < 0) dec <- 0L
  lab <- df[df$.lado != "neu2", , drop = FALSE]
  lab$.lab <- .pulso_fmt_pct_half_up(lab$.valor, dec, escala = 1)
  lab$.lab[!is.finite(lab$.valor) | lab$.valor <= 0] <- ""
  in_u <- .divergentes_in_por_unidad(ancho, levels(df$.item), size_ejes, (izq + tope * (if (isTRUE(mostrar_saldo)) 1.18 else 1)) * 1.1)
  pos <- .divergentes_cifras_posiciones(lab, df, size_pt, in_u, grosor)
  filas_fuera <- as.numeric(pos$.item[!pos$.dentro & nzchar(pos$.lab)])
  if (!is.null(df_si) && nrow(df_si)) {
    lsi <- .pulso_fmt_pct_half_up(df_si$.valor, dec, escala = 1)
    afuera <- nzchar(lsi) & df_si$.valor > 0 & df_si$.w * in_u < .ancho_texto_in(lsi, size_pt) + 0.06
    filas_fuera <- c(filas_fuera, as.numeric(df_si$.item[afuera]))
  }
  if (!any(filas_fuera < n)) return(grosor)   # sólo la fila de arriba: su cifra va al margen, no hay barra encima
  panel <- a - (0.3 * n_ley + 0.3 + 0.25 + 0.25)
  in_fila <- panel / (n + 1.2)
  if (!is.finite(in_fila) || in_fila <= 0) return(grosor)
  texto <- size_pt * 0.75 / 72   # alto de la tinta de «5%» (dígitos y signo, sin descendentes)
  max(0.3, min(grosor, 1 - 0.06 - (texto + 0.03) / in_fila))
}

#' Límite izquierdo del eje de la divergente: lo que llega el desacuerdo más largo, con aire (G-c ola 3)
#'
#' El eje era simétrico (`-tope` a `tope`) y con poco desacuerdo la mitad izquierda del lienzo quedaba vacía. Ahora mide el
#' lado negativo más largo más un 15 %, con un piso de un 12 % del tope para que se lean el cero y las cifras chicas.
#' @keywords internal
.divergentes_tope_izquierdo <- function(df, tope) {
  neg <- df$.signo[df$.signo < 0]
  largo <- if (length(neg)) max(stats::aggregate(abs(neg), by = list(df$.item[df$.signo < 0]), FUN = sum)$x) else 0
  max(largo * 1.15, 0.12 * tope)
}

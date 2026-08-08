# Auditor de composicion de un grafico
# ====================================
#
# PROBLEMA. Las 11.200 lineas de test del motor cubren contrato y estructura:
# que el registry declare lo que declara, que un arg llegue, que una cifra sea
# la correcta. No cubren COMPOSICION —donde cae cada cosa dentro del lienzo— y
# ahi es donde estan los defectos que si llegan al cliente:
#
#   - los ocho del cierre de equivalencias (2026-08-07): un lienzo de 3,56" en
#     un hueco de 6, un top-two-box de 3 pt, titulos de bloque apilados;
#   - el caption anclado al borde absoluto, en agrupadas y en apiladas;
#   - las cifras superpuestas de la serie temporal cuando dos lineas se cruzan.
#
# Ninguno lo habria atrapado un test de estructura, y todos son evidentes en el
# primer render. Este archivo convierte esa mirada en una medicion.
#
# QUE MIDE. Toma un grafico YA CONSTRUIDO y revisa tres cosas sobre los textos
# que dibuja: que ninguno se salga o roce el borde del lienzo, que ninguno se
# pise con otro, y que ninguno sea mas chico que el minimo legible.
#
# LIMITE DECLARADO. El ancho real de un texto depende del dispositivo grafico,
# que no existe hasta que se exporta. Aqui se ESTIMA a partir del numero de
# caracteres y del `size`, contra un ancho de lienzo de referencia. Es una
# aproximacion: sirve para detectar el desborde franco —que es el defecto que
# aparecio cuatro veces— y NO para afinar un margen al milimetro. Un hallazgo es
# una señal para ir a mirar el render, no un veredicto.

# Ancho de lienzo de referencia, en pulgadas. Es el de una lamina 16:9 de las
# que exporta el motor; las estimaciones de ancho de texto se hacen contra el.
.COMPOSICION_ANCHO_REF_IN <- 10

# Ancho estimado de un texto en unidades del eje (fraccion del lienzo).
#
# `size` de ggplot esta en mm de altura de mayuscula; el ancho medio de un
# caracter ronda 0.55 de esa altura en una tipografia de palo seco.
.composicion_ancho_texto <- function(label, size, ancho_lienzo = 1, ancho_ref_in = .COMPOSICION_ANCHO_REF_IN) {
  n <- nchar(as.character(label %||% ""), type = "width")
  n[is.na(n)] <- 0
  size <- suppressWarnings(as.numeric(size))
  size[!is.finite(size)] <- 3
  mm <- n * size * 0.55
  pulgadas <- mm / 25.4
  (pulgadas / ancho_ref_in) * ancho_lienzo
}

# Alto estimado de un texto, en unidades del eje Y.
#
# El lienzo de referencia es 16:9, asi que el alto util es ~0.5625 del ancho.
.composicion_alto_texto <- function(size, alto_lienzo = 1, ancho_ref_in = .COMPOSICION_ANCHO_REF_IN) {
  size <- suppressWarnings(as.numeric(size))
  size[!is.finite(size)] <- 3
  pulgadas <- (size * 1.35) / 25.4
  (pulgadas / (ancho_ref_in * 0.5625)) * alto_lienzo
}

# Todos los textos dibujados, con su caja estimada.
#
# Se leen del objeto CONSTRUIDO y no de las capas crudas: es la unica forma de
# ver la coordenada con la que de verdad se dibuja, despues de que las escalas y
# las posiciones hicieron lo suyo.
.composicion_textos <- function(p) {
  if (!inherits(p, "ggplot")) return(NULL)
  built <- tryCatch(ggplot2::ggplot_build(p), error = function(e) NULL)
  if (is.null(built)) return(NULL)

  pp <- built$layout$panel_params[[1]]
  rx <- pp$x.range %||% c(0, 1)
  ry <- pp$y.range %||% c(0, 1)
  ancho <- diff(rx)
  if (!is.finite(ancho) || ancho <= 0) ancho <- 1
  alto <- diff(ry)
  if (!is.finite(alto) || alto <= 0) alto <- 1

  filas <- list()
  for (i in seq_along(built$data)) {
    d <- built$data[[i]]
    if (!is.data.frame(d) || !all(c("x", "label") %in% names(d))) next
    lab <- as.character(d$label)
    ok <- !is.na(lab) & nzchar(trimws(lab))
    if (!any(ok)) next
    d <- d[ok, , drop = FALSE]

    size <- if ("size" %in% names(d)) d$size else rep(3, nrow(d))
    hjust <- if ("hjust" %in% names(d)) d$hjust else rep(0.5, nrow(d))
    hjust[!is.finite(hjust)] <- 0.5
    vjust <- if ("vjust" %in% names(d)) d$vjust else rep(0.5, nrow(d))
    vjust[!is.finite(vjust)] <- 0.5

    w <- .composicion_ancho_texto(d$label, size, ancho_lienzo = ancho)
    # El alto de la caja se estima igual que el ancho, y el `vjust` se aplica
    # como corresponde: es la unica forma de ver que dos cifras separadas por el
    # anticolision —que mueve el ANCLA, no la coordenada— ya no se pisan.
    h <- .composicion_alto_texto(size, alto_lienzo = alto)
    yv <- if ("y" %in% names(d)) d$y else rep(NA_real_, nrow(d))
    filas[[length(filas) + 1L]] <- data.frame(
      capa = i,
      etiqueta = as.character(d$label),
      x = d$x,
      y = yv,
      size = size,
      x0 = d$x - w * hjust,
      x1 = d$x + w * (1 - hjust),
      y0 = yv - h * vjust,
      y1 = yv + h * (1 - vjust),
      stringsAsFactors = FALSE
    )
  }
  if (!length(filas)) return(NULL)

  out <- do.call(rbind, filas)
  attr(out, "rango_x") <- rx
  attr(out, "rango_y") <- ry
  out
}

# C1 — Ningun texto se sale ni roza el borde del lienzo.
#
# `margen` es la fraccion del ancho que debe quedar libre. El defecto real que
# motiva la regla era un caption anclado en x = 1 con `hjust = 1`: no se salia
# por aritmetica, pero terminaba pegado al borde y en el render se leia cortado.
.composicion_regla_borde <- function(txt, margen = 0.005) {
  if (is.null(txt) || !nrow(txt)) return(NULL)
  rx <- attr(txt, "rango_x") %||% c(0, 1)
  holgura <- diff(rx) * margen
  # El margen se EXIGE, no se tolera. La primera version de esta regla permitia
  # tocar el borde (comparaba contra `rx + holgura`) y por eso no detectaba el
  # defecto que la motivo: un caption anclado en x = 1 con `hjust = 1` termina
  # exactamente en el limite, no lo cruza, y en el render se lee cortado igual.
  fuera <- txt$x0 < (rx[1] + holgura) | txt$x1 > (rx[2] - holgura)
  if (!any(fuera)) return(NULL)
  data.frame(
    regla = "borde",
    etiqueta = txt$etiqueta[fuera],
    detalle = sprintf(
      "texto de %s a %s con lienzo de %s a %s",
      round(txt$x0[fuera], 3), round(txt$x1[fuera], 3),
      round(rx[1], 3), round(rx[2], 3)
    ),
    stringsAsFactors = FALSE
  )
}

# C2 — Dos textos no ocupan el mismo lugar.
#
# Solo se comparan textos de la MISMA capa y a la misma altura: dos etiquetas de
# valor que se pisan es un defecto; una etiqueta de eje "debajo" de un titulo no
# lo es, porque viven en zonas distintas del lienzo.
.composicion_regla_solape <- function(txt) {
  if (is.null(txt) || nrow(txt) < 2L) return(NULL)
  hallazgos <- list()
  for (capa in unique(txt$capa)) {
    d <- txt[txt$capa == capa, , drop = FALSE]
    if (nrow(d) < 2L) next
    d <- d[order(d$x0), , drop = FALSE]
    for (i in seq_len(nrow(d) - 1L)) {
      for (j in seq(i + 1L, nrow(d))) {
        if (!is.finite(d$y0[i]) || !is.finite(d$y0[j])) next
        # Las cajas se cruzan si se solapan en los DOS ejes.
        if (d$y0[j] >= d$y1[i] || d$y1[j] <= d$y0[i]) next
        if (d$x0[j] >= d$x1[i]) break   # ordenado por x0: nada mas adelante toca
        hallazgos[[length(hallazgos) + 1L]] <- data.frame(
          regla = "solape",
          etiqueta = paste0(d$etiqueta[i], " / ", d$etiqueta[j]),
          detalle = sprintf(
            "se cruzan entre %s y %s a la misma altura",
            round(d$x0[j], 3), round(d$x1[i], 3)
          ),
          stringsAsFactors = FALSE
        )
      }
    }
  }
  if (!length(hallazgos)) return(NULL)
  do.call(rbind, hallazgos)
}

# C3 — Ningun texto por debajo del minimo legible.
#
# El defecto historico: un top-two-box dibujado a 3 pt, que en la lamina
# exportada es un borron. El minimo se declara y no se adivina.
.composicion_regla_legible <- function(txt, size_min = 2.2) {
  if (is.null(txt) || !nrow(txt)) return(NULL)
  chico <- is.finite(txt$size) & txt$size < size_min
  if (!any(chico)) return(NULL)
  data.frame(
    regla = "ilegible",
    etiqueta = txt$etiqueta[chico],
    detalle = sprintf("size %s por debajo del minimo %s", round(txt$size[chico], 2), size_min),
    stringsAsFactors = FALSE
  )
}

#' Audita la composición de un gráfico ya construido
#'
#' Devuelve un data frame `(regla, etiqueta, detalle)` con un renglón por
#' hallazgo, o un data frame de cero filas si no encontró nada.
#'
#' No es un veredicto: el ancho de un texto se estima, así que un hallazgo es
#' la señal para ir a mirar el render. Lo que sí garantiza es que un desborde
#' franco deje de pasar inadvertido.
#'
#' @param p Objeto `ggplot`.
#' @param margen_borde Fracción del ancho que debe quedar libre en los costados.
#' @param size_min Tamaño mínimo legible.
#' @keywords internal
graficos_composicion_auditar <- function(p, margen_borde = 0.005, size_min = 2.2) {
  vacio <- data.frame(
    regla = character(0), etiqueta = character(0), detalle = character(0),
    stringsAsFactors = FALSE
  )
  txt <- .composicion_textos(p)
  if (is.null(txt) || !nrow(txt)) return(vacio)

  partes <- list(
    .composicion_regla_borde(txt, margen = margen_borde),
    .composicion_regla_solape(txt),
    .composicion_regla_legible(txt, size_min = size_min)
  )
  partes <- Filter(Negate(is.null), partes)
  if (!length(partes)) return(vacio)

  out <- do.call(rbind, partes)
  rownames(out) <- NULL
  out
}

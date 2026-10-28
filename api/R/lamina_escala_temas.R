# G11/G19 (Gabriela Palacios, revisión de Arte 2026-10-28): «las barras comparativas de una misma pregunta, más
# juntas, y más separación entre preguntas»; «mucho hueco arriba, que los gráficos estén a la altura del logo».
#
# El bloque de escala reparte su alto con un paso de fila único: el aire entre los públicos de un tema y el aire entre
# temas salían casi iguales, y en láminas de pocas filas el paso estirado (hasta el doble) bajaba la primera barra lejos
# del rótulo Top Two Box. Aquí, con el grosor ya decidido, cada tema compacta sus filas a un aire corto y lo que suelta
# pasa a la separación entre temas. Solo geometría: no toca cifras, denominadores, orden ni colores, y el bloque nunca
# crece (el alto que planearon la partición y la multilista sigue siendo una cota).

# Aire entre las barras de un mismo tema (borde a borde) cuando ninguna cifra chica sube entre ellas, en pulgadas.
.LAM_TEMA_AIRE <- 0.14
# Tope del aire entre temas (de la última barra de un tema a la primera del siguiente) cuando sobra alto: lo que pase
# de aquí queda bajo el bloque, no en medio. Un aire que ya era mayor no se recorta.
.LAM_TEMA_AIRE_ENTRE_MAX <- 0.9
# Altura de la primera barra bajo el inicio del bloque cuando su cifra chica sube: la del paso natural (aire 0,24 in),
# para que la cifra no se acerque al rótulo de la columna Top Two Box.
.LAM_TEMA_PRIMERA_CHICA <- 0.24 / 2 + 0.06

#' Compacta las filas de cada tema y pasa el aire a la separación entre temas (G11/G19)
#'
#' @param hn Alto del texto de cada premisa (con su N).
#' @param nf Barras de cada premisa.
#' @param fila Paso de fila uniforme que decidió el bloque.
#' @param g Grosor de barra (final).
#' @param gaps Separación entre premisas que decidió el bloque (una por frontera, con el aire extra de las cifras chicas).
#' @param chica Lista, por premisa, de un lógico por barra: `TRUE` si alguna cifra de esa barra sube sobre ella.
#' @param piso_lab Alto mínimo del paso de fila de cada premisa para que el rótulo del público (y sus respuestas) quepa.
#' @param holgura Holgura de la cifra chica con la barra de arriba (`.lam_holgura_chica()`).
#' @param extra Alto adicional que quien compone le cede al bloque (el aire que soltó arriba, G19); solo va entre temas.
#' @return `list(filas, gaps, pad, alto)`: paso de fila por premisa, separación por frontera, aire extra sobre la
#'   primera premisa y alto total (nunca mayor que el de entrada más `extra`).
#' @keywords internal
.lam_escala_temas_aire <- function(hn, nf, fila, g, gaps, chica, piso_lab = rep(0, length(hn)),
                                   holgura = .lam_holgura_chica(), extra = 0) {
  n <- length(hn)
  gaps <- rep_len(as.numeric(gaps), max(0L, n - 1L))
  alto0 <- sum(pmax(hn, nf * fila)) + sum(gaps)
  sin_cambio <- list(filas = rep(fila, n), gaps = gaps, pad = 0, alto = alto0)
  if (!n || fila - g <= 0) return(sin_cambio)
  # Aire de cada tema: el corto si ninguna cifra chica sube entre sus barras; si sube, el que ella pide (0,28 in de la
  # caja más su holgura, nunca menos que el `aire_cifra_chica` del estándar). Nunca más que el que ya tenía: si el bloque venía apretado, se queda como estaba.
  pide <- vapply(seq_len(n), function(i) {
    ch <- as.logical(chica[[i]]); interior <- length(ch) > 1L && any(ch[-1L])
    if (interior) max(0.28 + holgura, .std_aire_chica()) else max(.LAM_TEMA_AIRE, piso_lab[i] - g)
  }, 0)
  filas <- g + pmin(fila - g, pide)
  # Geometría de una premisa: arriba de su primera barra y abajo de la última, desde el borde de la premisa.
  geo <- function(f) {
    a <- pmax(hn, nf * f); o <- (a - nf * f) / 2
    list(a = a, primera = o + (f - g) / 2 + 0.06, ultima = o + (nf - 1) * f + (f - g) / 2 + 0.06 + g)
  }
  v <- geo(rep(fila, n)); w <- geo(filas)
  pad <- 0
  if (isTRUE(as.logical(chica[[1]])[1])) pad <- max(0, min(v$primera[1], .LAM_TEMA_PRIMERA_CHICA) - w$primera[1])
  if (n == 1L) return(list(filas = filas, gaps = gaps, pad = pad, alto = w$a + pad))
  # Cada frontera conserva al menos el aire que tenía entre barras (la cifra chica de la primera barra del tema que sigue
  # no se acerca a la de arriba) y recibe por partes iguales lo que los temas soltaron.
  idx <- seq_len(n - 1L)
  antes <- (v$a[idx] - v$ultima[idx]) + gaps + v$primera[idx + 1L]
  base <- antes - (w$a[idx] - w$ultima[idx]) - w$primera[idx + 1L]
  reparte <- (alto0 + max(0, extra) - sum(w$a) - pad - sum(base)) / (n - 1L)
  if (!is.finite(reparte) || reparte < 0) return(sin_cambio)
  nuevos <- base + reparte
  # Tope: el aire entre temas no pasa de `.LAM_TEMA_AIRE_ENTRE_MAX` salvo que ya fuera mayor; el sobrante queda abajo.
  entre <- (w$a[idx] - w$ultima[idx]) + nuevos + w$primera[idx + 1L]
  tope <- pmax(antes, .LAM_TEMA_AIRE_ENTRE_MAX)
  nuevos <- nuevos - pmax(0, entre - tope)
  list(filas = filas, gaps = nuevos, pad = pad, alto = sum(w$a) + sum(nuevos) + pad)
}

#' Rótulo de la columna de un box en la lámina nativa, en mayúsculas (G20: «como siempre lo hemos colocado»)
#'
#' Solo el texto que se dibuja en la lámina: la especificación, el Word y la UI conservan «Top Two Box».
#' @keywords internal
.lam_rotulo_box <- function(x) toupper(as.character(x))

# =============================================================================
# lamina_rotulos_columna.R — la columna de rótulos de una lámina de resumen: entera y a su medida (S2, S4, S5)
# =============================================================================
#
# Gonzalo, 2026-11-09, sobre las láminas 4 y 5 del resumen de Arte: «la etiqueta no debe tener esos tres puntos
# suspensivos, y en el segundo las etiquetas del eje tienen demasiado espacio cuando no lo necesitan». Y en la ranura la
# barra de la escala quedaba tan corta que un segmento de 32 % sacaba su cifra.
#
# Regla de la casa para la columna de rótulos de la escala, el contraste y las fortalezas:
#   1. Nunca «…» dentro de un rótulo de un entregable. El rótulo se parte en las líneas que necesite, hasta cuatro.
#   2. El ancho de la columna es el que piden sus rótulos, medido con la tinta real (`.lam_ancho_tinta`): el que deja en
#      una línea a los de largo común (hasta 1.5 veces la mediana); el largo se parte y no carga a la columna con su
#      ancho. Nunca más que el máximo (P11). El ancho que sobra va a las barras o a los puntos.
#   3. Si las filas no caben así, la columna se ensancha (menos líneas, filas más bajas); luego baja la letra hasta el
#      piso; y si aun así no caben, se muestran menos filas —las primeras en la prioridad de la regla— y el pie lo dice.
#   4. Un rótulo que ni en cuatro líneas cabe en el ancho máximo no se corta: va en las que necesita y la lámina avisa
#      al analista que le dé un rótulo corto.
#   5. En una ranura, si el área de barras queda por debajo de lo que pide la escala (`barras`), la columna se angosta
#      hasta donde los rótulos sigan cabiendo en sus líneas.

#' Líneas máximas de un rótulo antes de considerarlo largo
#' @keywords internal
.LAM_ROTULO_MAX_LIN <- 4L

#' Líneas de un rótulo en un cuadro de ancho `w` (sin recorte)
#' @keywords internal
.lam_rotulo_lineas <- function(s, w, size) {
  s <- trimws(as.character(s %||% "")[1]); if (is.na(s)) s <- ""
  length(.lam_tyc_envolver(s, .lam_rotulo_util(s, w, size, FALSE), size, FALSE))
}

#' Ancho mínimo del cuadro para que un rótulo quepa en `lineas` líneas (Inf si ni en `w_max`)
#' @keywords internal
.lam_rotulo_ancho_para <- function(s, lineas, size, w_max, w_min = 0.5) {
  cabe <- function(w) .lam_rotulo_lineas(s, w, size) <= lineas
  if (!cabe(w_max)) return(Inf)
  if (cabe(w_min)) return(w_min)
  lo <- w_min; hi <- w_max
  for (i in 1:12) { mid <- (lo + hi) / 2; if (cabe(mid)) hi <- mid else lo <- mid }
  hi
}

#' Elige letra, ancho de la columna y filas de una lámina de resumen (ver la cabecera)
#'
#' @param textos Rótulos en el orden de la lámina. @param prioridad Prioridad de cada fila (1 = la primera que se queda);
#'   `NULL`, el orden de la lámina.
#' @param w_min,w_max Ancho del cuadro de la columna. @param desde Letra de la lámina (pt).
#' @param alto `function(n_lineas, size)`: la geometría de las filas con esas líneas por rótulo, o `NULL` si no caben.
#' @param n_min Filas mínimas antes de rendirse (`NULL` de vuelta: quien llama decide el respaldo).
#' @param barras `list(fn = function(wq) ancho_de_barras, min = ancho_pedido)` (ranura); `NULL` a página entera.
#' @param serie Rótulos de toda la serie (S6): el ancho y la letra se eligen sobre ellos para que dos láminas que se
#'   continúan compartan la columna; `NULL`, sólo los de la lámina.
#' @return Lista con `k`, `filas` (índices que se dibujan, en el orden de la lámina), `n_total`, `size`, `wq`,
#'   `n_lineas`, `textos`, `largos` (rótulos que ni en cuatro líneas caben), `recortados = 0` y lo que devuelve `alto`.
#' @keywords internal
.lam_rotulos_columna <- function(textos, prioridad = NULL, w_min, w_max, desde, alto, n_min = min(length(textos), 3L),
                                 barras = NULL, serie = NULL, max_lin = .LAM_ROTULO_MAX_LIN) {
  n <- length(textos)
  if (!n || w_max < w_min - 1e-9) return(NULL)
  pr <- suppressWarnings(as.integer(prioridad))
  idx <- if (length(pr) == n && !anyNA(pr)) order(pr, seq_len(n)) else seq_len(n)
  cache <- new.env(parent = emptyenv())
  ancho_para <- function(t, L, size) {
    clave <- paste(L, size, t, sep = "\r")
    if (is.null(cache[[clave]])) cache[[clave]] <- .lam_rotulo_ancho_para(t, L, size, w_max)
    cache[[clave]]
  }
  piso <- .LAM_ROTULO_PT_PISO
  base_col <- if (length(serie)) as.character(serie) else as.character(textos)
  largo_t <- function(t) is.infinite(ancho_para(t, max_lin, piso))
  lineas <- function(t, w, size) {
    clave <- paste("L", round(w, 4), size, t, sep = "\r")
    if (is.null(cache[[clave]])) cache[[clave]] <- .lam_rotulo_lineas(t, w, size)
    cache[[clave]]
  }
  # S2: en una ranura, si con todas las filas el área de barras queda corta, se prueba con menos filas (la columna se
  # angosta con rótulos de más líneas) hasta un 60 % de las que cabían; si ni así, las que cabían con la barra corta.
  reserva <- NULL; k_piso <- 0L
  for (k in unique(c(n, if (n > n_min) seq(n - 1L, max(1L, n_min))))) {
    if (!is.null(reserva) && k < k_piso) return(reserva)
    filas <- sort(idx[seq_len(k)]); tx <- textos[filas]
    col <- if (length(serie)) base_col else tx
    ventana <- if (length(serie) > k) max(k, length(base_col) - k) else 0L
    lg_col <- vapply(col, largo_t, TRUE)
    for (size in .lam_rotulo_pasos_pt(desde)) {
      cortos <- col[!lg_col]
      # El ancho más angosto en que todos caben en sus cuatro líneas: un rótulo largo no ensancha la columna para ir en tres.
      w_lo <- if (length(cortos)) max(vapply(cortos, ancho_para, 0, L = max_lin, size = size)) else w_min
      if (!is.finite(w_lo)) next
      w_lo <- min(w_max, max(w_min, w_lo))
      # El que deja en una línea a los rótulos de largo común: los que no pasan de 1.5 veces la mediana. El largo
      # (un enunciado sin rótulo corto) se parte; no carga a la columna con su ancho (Arte, láminas 4, 5 y 9).
      uno <- vapply(col, ancho_para, 0, L = 1L, size = size)
      uno_m <- pmin(uno, w_max + 1)
      comunes <- uno_m[uno_m <= 1.5 * stats::median(uno_m)]
      w_obj <- min(w_max, max(w_lo, if (length(comunes)) max(comunes) else w_lo))
      alto_de <- function(t, w) {
        nl <- vapply(t, lineas, 0L, w = w, size = size)
        list(nl = nl, h = if (length(formals(alto)) >= 3L) alto(nl, size, w) else alto(nl, size))
      }
      geom <- function(w) {
        a <- alto_de(tx, w)
        if (is.null(a$h)) return(NULL)
        # O1/S6: en una serie la columna y la letra salen de TODAS las filas que elige la regla: el ancho sirve sólo si
        # cabe cada tramo de la serie del largo de la mayor de las dos láminas. Así las dos eligen lo mismo y el área
        # del gráfico no salta al pasar de una a otra.
        if (ventana > 0L) for (i in seq_len(length(base_col) - ventana + 1L)) {
          if (is.null(alto_de(base_col[i:(i + ventana - 1L)], w)$h)) return(NULL)
        }
        c(list(size = size, wq = w, n_lineas = a$nl), a$h)
      }
      cand <- NULL
      for (w in unique(c(w_obj, if (w_max > w_obj) seq(w_obj, w_max, by = 0.1), w_max))) { cand <- geom(w); if (!is.null(cand)) break }
      if (is.null(cand)) next
      if (!is.null(barras) && barras$fn(cand$wq) < barras$min) {
        angostos <- if (cand$wq - 0.1 > w_lo) c(seq(cand$wq - 0.1, w_lo, by = -0.1), w_lo) else w_lo
        for (w in unique(angostos)) {
          if (w > cand$wq - 1e-9 || w < w_lo - 1e-9) next
          e <- geom(w)
          if (is.null(e)) break
          cand <- e
          if (barras$fn(w) >= barras$min) break
        }
      }
      out <- c(cand, list(k = k, filas = filas, n_total = n, textos = tx, largos = tx[vapply(tx, largo_t, TRUE)], recortados = 0L,
                          lineas = max(cand$n_lineas)))
      if (is.null(barras) || barras$fn(cand$wq) >= barras$min) return(out)
      if (is.null(reserva)) { reserva <- out; k_piso <- max(n_min, ceiling(0.6 * k)) }
      break
    }
  }
  reserva
}

#' Aviso al analista por cada rótulo largo que se dibuja (S4): no se corta, se le pide un rótulo corto
#' @keywords internal
.lam_rotulos_largos_aviso <- function(largos) {
  for (t in unique(as.character(largos))) {
    pal <- strsplit(trimws(t), "\\s+")[[1]]
    inicio <- paste(utils::head(pal, 6L), collapse = " ")
    .pulso_aviso(sprintf("El rótulo de \"%s\" es largo: dale un rótulo corto en Gráficos › Identidad › Rótulos cortos.", inicio))
  }
  invisible(length(largos))
}

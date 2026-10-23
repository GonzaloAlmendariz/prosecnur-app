# =============================================================================
# lamina_tabla_costado.R — dónde va la tabla de datos del radar y sus variantes en el PPT (Gonzalo, 2026-10-23)
# =============================================================================
#
# «En el PPT, si no cabe al costado: debajo con aviso; si tampoco, omitir con aviso.» Nunca en silencio.
#
# Medidas (las de la tabla del radar de la lámina 90, `.LAM_RADAR`): primera columna de 2,2 in, 1,15 in por público (o lo
# que pida su encabezado), fila de 0,5 in que baja hasta 0,4 si no caben, letra de 13 pt en el cuerpo y 11 en el
# encabezado (nunca por debajo de la mínima de cifras, 8 pt), 0,3 in de hueco con el gráfico y un gráfico que no baja de
# 3,6 in de ancho. Un criterio que pide dos líneas en la primera columna no se comprime: ocupa lo que pide su texto.
#
# Dos caminos la dibujan:
#   - la lámina nativa de líneas y puntos (`.lam_laminas_pesas`, tabla `ttb` del recetario), y
#   - el camino general (barras, y el respaldo de líneas y puntos), con la tabla nativa genérica
#     (`.tabla_nativa_geom` / `.tabla_nativa_flextable`).
# Los dos deciden con `.lam_tabla_costado_decidir()`, que es pura sobre medidas.

.LAM_TABLA_COSTADO <- list(col1 = 2.2, col = 1.15, fila = 0.5, fila_min = 0.4, hueco = 0.3, hueco_v = 0.2,
                           min_graf_w = 3.6, dy = 0.6, cuerpo_pt = 13, enc_pt = 11, relleno_in = 12 / 72)

# Camino general: la tabla nativa genérica (letra de 12 pt, fila fija de 0,42 in) no se comprime.
.LAM_TABLA_COSTADO_GENERAL <- list(col1 = 2.2, col = 1.15, fila = 0.42, cuerpo_pt = 12, enc_pt = 11, relleno_in = 14 / 72)

#' Medidas de la tabla: anchos de columna y altos de encabezado y fila
#'
#' @param ejes,grupos,encabezado Textos de la tabla (criterios, públicos y encabezado de la primera columna).
#' @param M Constantes (`.LAM_TABLA_COSTADO` o `.LAM_TABLA_COSTADO_GENERAL`).
#' @param comprimible Si la fila puede bajar de `fila` hasta `fila_min` (la tabla `ttb`); el camino general no.
#' @return `list(ws, h_enc, nat, need)`: anchos (in), alto del encabezado, alto natural de la fila y el mínimo.
#' @keywords internal
.lam_tabla_costado_medidas <- function(ejes, grupos, encabezado, M = .LAM_TABLA_COSTADO, comprimible = TRUE) {
  pt <- function(n, size) n * size * 1.2 / 72 + M$relleno_in
  ws <- c(M$col1, pmax(M$col, .lam_ancho_tinta(grupos, M$enc_pt, TRUE) + 0.25))
  lin_c <- if (length(ejes)) max(.lam_lineas_tinta(ejes, M$col1, M$cuerpo_pt, TRUE)) else 1L
  lin_e <- max(c(.lam_lineas_tinta(encabezado, M$col1, M$enc_pt, TRUE),
                 if (length(grupos)) .lam_lineas_tinta(grupos, ws[2], M$enc_pt, TRUE)))
  h_enc <- max(M$fila, round(pt(lin_e, M$enc_pt), 2))
  nat <- if (lin_c <= 1L) M$fila else max(M$fila, round(pt(lin_c, M$cuerpo_pt), 2))
  need <- if (lin_c <= 1L && isTRUE(comprimible)) M$fila_min else nat
  list(ws = ws, h_enc = h_enc, nat = nat, need = need)
}

#' Dónde va la tabla: al costado, debajo o ninguna
#'
#' Al costado si, con la tabla pegada a la derecha de la caja, al gráfico le quedan `min_graf_w` in y las filas caben
#' (la fila baja de `nat` a `need`). Si no, debajo si la tabla cabe a lo ancho y al gráfico le quedan `min_graf_h` in de
#' alto. Si tampoco, `omitir`.
#'
#' @param n_filas Criterios (filas del cuerpo).
#' @param med Salida de `.lam_tabla_costado_medidas()`.
#' @param caja `list(x0, y0, x1, y1)` donde van el gráfico y su tabla, en pulgadas.
#' @param min_graf_w,min_graf_h Lo que no puede perder el gráfico.
#' @param M Constantes.
#' @return `list(lugar, x, y, w, h, h_enc, fila, graf_x1, graf_y1)`; `lugar` es `costado`, `debajo` u `omitir` (sin medidas).
#' @keywords internal
.lam_tabla_costado_decidir <- function(n_filas, med, caja, min_graf_w = .LAM_TABLA_COSTADO$min_graf_w, min_graf_h = 2.4,
                                       M = .LAM_TABLA_COSTADO, dy = M$dy) {
  n <- max(1L, as.integer(n_filas)); w <- sum(med$ws); cw <- caja$x1 - caja$x0; ch <- caja$y1 - caja$y0
  eps <- 1e-6
  if (w + M$hueco + min_graf_w <= cw + 0.01) {
    disp <- ch - dy
    fila <- min(med$nat, (disp - med$h_enc) / n)
    if (fila >= med$need - eps) {
      return(list(lugar = "costado", x = caja$x1 - w, y = caja$y0 + dy, w = w, h = med$h_enc + n * fila,
                  h_enc = med$h_enc, fila = fila, graf_x1 = caja$x1 - w - M$hueco, graf_y1 = caja$y1))
    }
  }
  if (w <= cw + 0.01) {
    fila <- min(med$nat, (ch - M$hueco_v - min_graf_h - med$h_enc) / n)
    if (fila >= med$need - eps) {
      h <- med$h_enc + n * fila
      return(list(lugar = "debajo", x = caja$x0 + (cw - w) / 2, y = caja$y1 - h, w = w, h = h, h_enc = med$h_enc,
                  fila = fila, graf_x1 = caja$x1, graf_y1 = caja$y1 - h - M$hueco_v))
    }
  }
  list(lugar = "omitir")
}

#' Los avisos de una decisión que no es «al costado»
#'
#' Siempre se dicen: la tabla que va debajo o se omite no se mueve en silencio.
#' @keywords internal
.lam_tabla_costado_avisar <- function(d) {
  if (identical(d$lugar, "debajo")) {
    .pulso_aviso(.aviso_en_lamina("la tabla no cabe al costado del gráfico; va debajo."))
  } else if (identical(d$lugar, "omitir")) {
    .pulso_aviso(.aviso_en_lamina("la tabla no cabe ni al costado ni debajo del gráfico; se omitió."))
  }
  invisible(d)
}

# ---- líneas y puntos (lámina nativa de pesas) --------------------------------

#' La caja donde la lámina de líneas y puntos pone su gráfico y su tabla: toda la zona de contenido
#' @keywords internal
.lam_pesas_caja <- function() {
  g_ <- .std_geom
  list(x0 = g_("margen_izq"), y0 = g_("zona_datos_y0"), x1 = g_("ancho") - g_("margen_der"), y1 = g_("contenido_y1"))
}

#' Plan de la tabla de una lámina de líneas y puntos: `NULL` sin tabla; si no, la decisión y las medidas
#'
#' El gráfico pide 3,6 in de ancho de plano más su columna de rótulos (2,4) y la de cifras (1,0), y 0,45 in por criterio.
#' @param espec Espec `pesas` (con `espec$tabla` si la forma pidió tabla).
#' @keywords internal
.lam_pesas_tabla_plan <- function(espec) {
  t <- espec[["tabla"]]
  if (!is.list(t) || !length(t$ejes)) return(NULL)
  k <- length(t$ejes)
  med <- .lam_tabla_costado_medidas(t$ejes, t$grupos, t$encabezado)
  d <- .lam_tabla_costado_decidir(k, med, .lam_pesas_caja(), min_graf_w = .LAM_TABLA_COSTADO$min_graf_w + 3.4,
                                  min_graf_h = 1.35 + 0.45 * k)
  d$med <- med
  d
}

#' Pone la tabla de datos (estilo `ttb` del recetario) donde decidió el plan
#' @keywords internal
.lam_pesas_tabla_emitir <- function(doc, espec, plan) {
  if (is.null(plan) || identical(plan$lugar, "omitir")) return(doc)
  t <- espec[["tabla"]]
  d <- data.frame(t$ejes, t$cifras, check.names = FALSE, stringsAsFactors = FALSE)
  names(d) <- c(t$encabezado, t$grupos)
  .lam_tabla_ttb(doc, d, plan$x, plan$y, plan$med$ws, plan$h_enc, plan$fila)
}

# ---- camino general (barras y respaldo) --------------------------------------

#' Dónde va la tabla nativa genérica de un gráfico que pidió `lugar_auto`, con el cajón real
#'
#' Lo llama `.tabla_nativa_geom()` al colocar la lámina, cuando ya se conoce el cajón (`loc`). Emite el aviso si la tabla no
#' va al costado.
#' @param estilo Estilo de la tabla nativa (`tabla_dibuja`, `tabla_ejes`, `tabla_grupos`, `tabla_encabezado`).
#' @param loc Cajón del gráfico (`left`, `top`, `width`, `height`, en pulgadas).
#' @return `NULL` si se omite; si no, `list(left, top, width, height, graf_w, graf_h, lugar)`.
#' @keywords internal
.lam_tabla_costado_geom <- function(estilo, loc) {
  l <- suppressWarnings(as.numeric(c(loc$left, loc$top, loc$width, loc$height)))
  if (length(l) != 4L || any(!is.finite(l))) return(NULL)
  M <- .LAM_TABLA_COSTADO_GENERAL
  ejes <- estilo$tabla_ejes; grupos <- estilo$tabla_grupos
  k <- length(ejes); p <- length(grupos)
  med <- .lam_tabla_costado_medidas(ejes, grupos, estilo$tabla_encabezado, M = M, comprimible = FALSE)
  caja <- list(x0 = l[1], y0 = l[2], x1 = l[1] + l[3], y1 = l[2] + l[4])
  min_h <- if (identical(estilo$tabla_dibuja, "barras")) 0.9 + 0.17 * k * p else 1.35 + 0.45 * k
  d <- .lam_tabla_costado_decidir(k, med, caja, min_graf_w = .LAM_TABLA_COSTADO$min_graf_w + 1.5, min_graf_h = min_h,
                                  M = .LAM_TABLA_COSTADO, dy = 0.1)
  .lam_tabla_costado_avisar(d)
  if (identical(d$lugar, "omitir")) return(NULL)
  list(left = d$x, top = d$y, width = d$w, height = d$h, lugar = d$lugar, ws = med$ws,
       graf_w = d$graf_x1 - caja$x0, graf_h = d$graf_y1 - caja$y0)
}

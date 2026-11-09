# =============================================================================
# lamina_resumen_ranura_escala.R — la escala del resumen en una ranura: tope de filas y área de barras (S1, S2)
# =============================================================================
#
# Arte, 2026-11-09. S1: con 20 filas en la lámina de dos gráficos la escala no entraba en la ranura (tenía un tope fijo
# de 12 filas) y caía a la imagen de respaldo con las cifras montadas y el eje ilegible. E3: nunca una imagen ilegible.
# Ahora la ranura se queda nativa con las filas que caben, en el orden de la regla (`espec$prioridad`, la misma del
# recorte de página entera), y el pie lo dice en la frase de la regla: «se muestran las 9 más bajas de las 22 bajo 60%…;
# las 13 siguientes no caben en esta lámina». Sólo si ni una fila cabe (o la leyenda no cabe) va a la imagen.
# S2: la barra quedaba tan corta que un segmento de 32 % sacaba su cifra. La columna de rótulos se angosta (rótulos en
# dos o tres líneas, como a página entera) hasta que el área de barras deje a un 30 % su cifra dentro, y la columna de
# «Sin información» se angosta cuando sus valores son chicos.

#' Ancho de la escala que deja dentro la cifra de un segmento de 30 % (S2), con la reserva de las cifras de fuera
#' @param total Unidades del lado más largo del desacuerdo más las del acuerdo (`izq + der` del dibujo).
#' @keywords internal
.lam_rr_div_escala_pedida <- function(total, pt = 10) {
  total * (.lam_ancho_txt("30%", pt, TRUE) + 0.12) / 30 + 1.1
}

#' `izq + der` del dibujo de la escala (como `.lam_rr_divergentes`)
#' @keywords internal
.lam_rr_div_total <- function(espec) {
  C <- espec$categorias; U <- espec$unidades
  neu <- which(C$lado == "neu"); mitades <- if (length(neu)) rowSums(U[, neu, drop = FALSE]) / 2 else rep(0, nrow(U))
  neg <- espec$orden_neg %||% rev(which(C$lado == "neg")); pos <- espec$orden_pos %||% which(C$lado == "pos")
  max(rowSums(U[, neg, drop = FALSE]) + mitades, 1) + max(rowSums(U[, pos, drop = FALSE]) + mitades, 1)
}

#' Ancho de la columna «Sin información» a la medida de sus valores (S2)
#'
#' Se parte del ancho de siempre y se angosta de a 0.05 in mientras la barra más larga siga a la escala de las barras de
#' la escala (`px`) y cada cifra quepa, dentro de su barra o fuera de ella, en la columna; nunca por debajo de 0.55 in.
#' @keywords internal
.lam_rr_div_wsi <- function(espec, wsi0, px, pt = 10) {
  si <- which(espec$categorias$lado == "sin_inf")
  if (!length(si) || !is.finite(px) || px <= 0) return(wsi0)
  v <- espec$unidades[, si[1]]; cif <- espec$cifras[, si[1]]
  max_si <- espec$serie$max_si %||% max(1, max(v))   # la escala que usa el dibujo: la de la serie si la hay (S6)
  ok <- function(wsi) {
    wbar <- (wsi - 0.1) * v / max_si
    tinta <- .lam_ancho_txt(cif, pt, TRUE)
    all(wbar >= tinta + 0.12 | wbar + tinta + 0.15 <= wsi)
  }
  objetivo <- max(0.55, max_si * px + 0.1)
  wsi <- wsi0
  while (wsi - 0.05 >= objetivo - 1e-9 && ok(wsi - 0.05)) wsi <- wsi - 0.05
  wsi
}

#' @keywords internal
.lam_rr_divergentes_geo <- function(espec, x, y, w, h) {
  n <- length(espec$filas); C <- espec$categorias
  if (n < 1L || sum(C$lado == "sin_inf") > 1L) return(list(cabe = FALSE))
  hay_si <- any(C$lado == "sin_inf")
  # Ronda 2, ítem 6: con filas de públicos distintos cada fila dice su n (casos válidos sin ponderar), en una columna a la
  # derecha; para dejarle sitio, la columna de Sin información y la escala ceden un poco.
  ns <- .lam_rr_div_n(espec)
  wn <- if (length(ns)) max(.lam_ancho_tinta(ns, 9.5, FALSE)) + 0.15 else 0
  esc_min <- if (length(ns)) 2.0 else 2.2
  ley <- .lam_rr_div_leyenda(espec, w)
  hley <- 0.27 * length(ley$filas) + 0.08
  disponible <- h - hley - 0.05
  total <- .lam_rr_div_total(espec)
  pedida <- max(esc_min, .lam_rr_div_escala_pedida(total))
  alto <- function(nl, size) {
    necesita <- nl * .lam_rr_lh(size) + 0.05
    a <- function(u) sum(pmax(u, necesita))
    if (a(0.2) > disponible + 1e-9) return(NULL)
    lo <- 0.2; hi <- 0.45
    if (a(hi) <= disponible) lo <- hi else for (it in 1:40) { mid <- (lo + hi) / 2; if (a(mid) <= disponible) lo <- mid else hi <- mid }
    list(u = lo, alturas = pmax(lo, necesita))
  }
  con_wsi <- function(wsi) {
    xb <- x + w - wn - wsi - (if (hay_si) (if (length(ns)) 0.2 else 0.3) else 0)
    w_max <- min(2.4, xb - esc_min - 0.15 - x)
    if (w_max < 1.2) return(NULL)
    f <- .lam_rotulos_columna(espec$filas, espec$prioridad, w_min = 1.2, w_max = w_max, desde = 11, alto = alto, n_min = 1L,
                              barras = list(fn = function(wq) xb - (x + wq + 0.15), min = pedida), serie = espec$serie$filas)
    if (is.null(f)) return(NULL)
    c(f, list(xb = xb, xa = x + f$wq + 0.15, wsi = wsi))
  }
  wsi0 <- if (hay_si) (if (length(ns)) 0.85 else 1.0) else 0
  f <- con_wsi(wsi0)
  if (is.null(f)) return(list(cabe = FALSE))
  if (hay_si) {
    wsi <- .lam_rr_div_wsi(espec, wsi0, (f$xb - f$xa - 1.1) / total)
    if (wsi < wsi0 - 1e-9) { f2 <- con_wsi(wsi); if (!is.null(f2) && f2$k >= f$k) f <- f2 }
  }
  c(f, list(cabe = isTRUE(ley$cabe) && (f$xb - f$xa) >= esc_min - 1e-6, hay_si = hay_si, wn = wn, ns = ns, ley = ley, hley = hley,
            disponible = disponible, g = f$u * 0.74))
}

#' La ranura de la escala muestra menos filas: la frase de la regla se reescribe en el pie (P7, S1)
#'
#' Sin nota de la regla en el pie, la frase se agrega (`.lam_rr_pie_reemplazar_en` agrega la que no encuentra).
#' @keywords internal
.lam_rr_div_reemplazo <- function(espec, geo) {
  quitar_punto <- function(t) sub("[.[:space:]]+$", "", trimws(as.character(t %||% "")[1]))
  viejo <- quitar_punto(espec$texto_regla)
  if (is.na(viejo) || !nzchar(viejo)) viejo <- "\u0001"   # no está en el pie: se agrega
  nuevo <- quitar_punto(.lam_div_resumen_texto(espec, geo$k))
  .LAM_RR_PIE$reemplazos <- c(.LAM_RR_PIE$reemplazos, list(c(viejo = viejo, nuevo = nuevo)))
  TRUE
}

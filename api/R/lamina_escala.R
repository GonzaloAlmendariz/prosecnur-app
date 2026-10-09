# =============================================================================
# lamina_escala.R — el bloque de escala del recetario, dibujado desde la
# especificación (ADR 0093, N1)
# =============================================================================
#
# Porta `barra_apilada()`, `leyenda()`, `geo_likert()`, `alto_bloque()`,
# `etiqueta_ttb()`, `bloque_likert()` y `partir()` de
# `docs/qa/motor-ppt-2026-10-06/herramientas/recetario.R:143-332`. La geometría
# sale de `estandar_pulso.json` y las cifras de `preparar_escala()`: aquí no se
# calcula ningún porcentaje, sólo se ubica lo que la especificación afirma.

# ---- de la especificación a premisas y segmentos -----------------------------

#' Premisas del recetario a partir de la especificación
#'
#' Sin actores, cada fila es una premisa con una sola barra. Con actores
#' (`grupo_id`), la premisa es el grupo y sus filas son las barras de cada actor.
#' Respeta `espec$orden$aplicado`.
#' @keywords internal
.lam_escala_premisas <- function(espec, idx = espec$orden$aplicado) {
  f <- espec$filas
  con_actor <- !all(is.na(f$grupo_id))
  claves <- if (con_actor) f$grupo_id[idx] else as.character(idx)
  out <- list()
  for (k in unique(claves)) {
    ii <- idx[claves == k]
    texto <- if (con_actor) (f$grupo_titulo[ii[1]] %||% f$grupo_id[ii[1]]) else f$rotulo[ii[1]]
    filas <- lapply(ii, function(i) list(i = i, actor = if (con_actor) f$rotulo[i] else "", valid = f$n[i]))
    out[[length(out) + 1L]] <- list(texto = texto, filas = filas)
  }
  out
}

#' Segmentos de una fila, de izquierda a derecha
#' @keywords internal
.lam_escala_seg <- function(espec, i) {
  data.frame(ancho = as.numeric(espec$anchos[i, ]), cifra = as.character(espec$cifras[i, ]),
             color = espec$categorias$color, dibujar = as.logical(espec$dibujar[i, ]), stringsAsFactors = FALSE)
}

# ---- barra apilada y leyenda (recetario.R:143-180) ---------------------------

.lam_tiene_peq <- function(seg, w) any(seg$dibujar & w * seg$ancho < .lam_ancho_txt(seg$cifra, .std_pt("cifra"), TRUE) + 0.12)

#' Barra apilada al 100 %: cifra dentro si cabe a 14 pt; si no, encima con guía
#' @keywords internal
.lam_barra_apilada <- function(lz, x, y, w, seg, h) {
  azul <- .std_color("azul"); tenue <- .std_color("texto_tenue")
  xx <- x; peq <- list(); n <- nrow(seg)
  for (k in seq_len(n)) {
    ws <- if (isTRUE(seg$dibujar[k])) w * seg$ancho[k] else 0
    if (ws > 0.004) .lam_caja(lz, xx, y, ws + (if (k < n) 0.004 else 0), h, seg$color[k], nombre = "segmento")
    if (ws > 0 && ws >= .lam_ancho_txt(seg$cifra[k], .std_pt("cifra"), TRUE) + 0.12) {
      wl <- max(ws, 0.7)
      .lam_txt(lz, seg$cifra[k], xx + ws / 2 - wl / 2, y + (h - 0.3) / 2, wl, 0.3, .std_pt("cifra"),
               .lam_texto_sobre(seg$color[k]), bold = TRUE, align = "center", nombre = "cifra")
    } else if (ws > 0) {
      peq[[length(peq) + 1L]] <- list(c = xx + ws / 2, v = seg$cifra[k])
    }
    xx <- xx + ws
  }
  if (length(peq)) {
    cs <- vapply(peq, `[[`, 0, "c"); pos <- cs
    for (k in seq_along(pos)[-1]) pos[k] <- max(pos[k], pos[k - 1] + 0.46)
    m <- length(pos); lim <- x + w - 0.12
    if (pos[m] > lim) { pos[m] <- lim; if (m > 1) for (k in (m - 1):1) pos[k] <- min(pos[k], pos[k + 1] - 0.46) }
    for (k in seq_along(peq)) {
      .lam_caja(lz, cs[k] - 0.006, y - 0.07, 0.012, 0.07, tenue, nombre = "guia")
      if (abs(pos[k] - cs[k]) > 0.01) .lam_caja(lz, min(cs[k], pos[k]), y - 0.08, abs(pos[k] - cs[k]), 0.012, tenue, nombre = "guia")
      .lam_txt(lz, peq[[k]]$v, pos[k] - 0.32, y - 0.32, 0.64, 0.26, .std_pt("cifra_fuera"), azul, bold = TRUE,
               align = "center", nombre = "cifra_fuera")
    }
  }
  invisible(lz)
}

#' Leyenda centrada en un bloque; junta los ítems si no cabe y nunca sale del margen
#' @keywords internal
.lam_leyenda <- function(lz, y, labels, cols, centrar_en) {
  g <- .std_geom; size <- .std_pt("leyenda")
  ml <- g("margen_izq"); fin <- g("ancho") - g("margen_der")
  wk <- .lam_ancho_tinta(labels, size); ws <- 0.22 + wk; gap <- 0.3
  tot <- sum(ws) + gap * (length(ws) - 1)
  disp <- 2 * min(centrar_en - ml, fin - centrar_en)
  if (tot > disp && length(ws) > 1) { gap <- max(0.15, (disp - sum(ws)) / (length(ws) - 1)); tot <- sum(ws) + gap * (length(ws) - 1) }
  x <- min(max(centrar_en - tot / 2, ml), fin - tot)
  for (k in seq_along(labels)) {
    .lam_caja(lz, x, y + 0.07, 0.15, 0.15, cols[k], nombre = "leyenda:cuadro")
    .lam_txt(lz, labels[k], x + 0.12, y, wk[k] + 0.3, 0.3, size, .std_color("azul"), nombre = "leyenda:texto")
    x <- x + ws[k] + gap
  }
  invisible(lz)
}

# ---- geometría del bloque (recetario.R:224-236) ------------------------------

.lam_escala_sin_actor <- function(premisas) all(vapply(premisas, function(p) all(vapply(p$filas, function(f) !nzchar(f$actor), TRUE)), TRUE))
.lam_escala_ancho_prem <- function(premisas) {
  L <- .std_geom("likert")
  if (.lam_escala_sin_actor(premisas)) L$x_barra - L$x_premisa - 0.25 else L$ancho_premisa
}
.lam_escala_geo <- function(premisas, wp) {
  nb <- sum(vapply(premisas, function(p) length(p$filas), 0))
  g <- .std_grosor(nb, "escala_apilada"); fila <- g + 0.24
  multi <- any(vapply(premisas, function(p) length(p$filas) > 1, TRUE))
  manda <- any(vapply(premisas, function(p) .lam_alto_txt(p$texto, wp, .std_pt("pregunta"), TRUE) > length(p$filas) * fila, TRUE))
  list(g = g, fila = fila, gap = if (multi || manda) 0.26 else 0.08)
}
#' Alto que ocupa un bloque de premisas
#' @keywords internal
.lam_escala_alto <- function(premisas) {
  wp <- .lam_escala_ancho_prem(premisas); geo <- .lam_escala_geo(premisas, wp)
  sum(vapply(premisas, function(p) max(.lam_alto_txt(p$texto, wp, .std_pt("pregunta"), TRUE), length(p$filas) * geo$fila), 0)) +
    geo$gap * (length(premisas) - 1)
}
.lam_escala_alto_util <- function() (.std_geom("zona_datos_y1") - 0.15) - (.std_geom("zona_datos_y0") + 0.1)

#' Partición en «(cont.)» (recetario.R:319-332)
#'
#' Si el bloque no cabe al grosor del estándar, se parte; la letra no encoge.
#' Primero el mínimo de láminas y luego el corte que equilibra los altos. Las
#' premisas son atómicas: un bloque de actores nunca se separa. No recalcula ni
#' reordena.
#' @return Lista de grupos de premisas, uno por lámina.
#' @keywords internal
.lam_escala_partir <- function(premisas, disponible = .lam_escala_alto_util()) {
  n <- length(premisas)
  if (n <= 1L || .lam_escala_alto(premisas) <= disponible) return(list(premisas))
  cabe <- function(ix) all(vapply(split(premisas, ix), .lam_escala_alto, 0) <= disponible)
  for (k in 2:n) {
    mejor <- NULL; mejor_v <- Inf
    for (cs in utils::combn(n - 1, k - 1, simplify = FALSE)) {
      ix <- findInterval(seq_len(n), cs + 1) + 1
      if (!cabe(ix)) next
      altos <- vapply(split(premisas, ix), .lam_escala_alto, 0)
      if (max(altos) - min(altos) < mejor_v) { mejor_v <- max(altos) - min(altos); mejor <- ix }
    }
    if (!is.null(mejor)) return(unname(split(premisas, mejor)))
  }
  lapply(premisas, list)
}

# ---- el bloque (recetario.R:238-317) ----------------------------------------

.lam_etiqueta_box <- function(lz, espec, x, yb, g, i, con_n) {
  verde <- .std_color("verde_top_two_box")
  .lam_txt(lz, espec$box$cifras[i], x, yb + (g - 0.32) / 2 - (if (con_n) 0.1 else 0), 1.5, 0.32, .std_pt("cifra"), verde,
           bold = TRUE, align = "center", nombre = "box:cifra")
  if (con_n) .lam_txt(lz, sprintf("%d de %d", as.integer(espec$box$casos[i]), as.integer(espec$filas$n[i])), x, yb + g / 2 + 0.06,
                      1.5, 0.24, .std_pt("n"), .std_color("texto_tenue"), align = "center", nombre = "box:casos")
}

#' Dibuja un bloque de escala en el lienzo
#'
#' @param solo `TRUE` si el bloque es la lámina entera (sin partición): con una
#'   sola premisa y un solo público, la afirmación encabeza y la barra ocupa el
#'   ancho, como la lámina 216 del recetario.
#' @keywords internal
.lam_bloque_escala <- function(lz, espec, premisas, solo = TRUE) {
  g_ <- .std_geom; L <- g_("likert"); azul <- .std_color("azul"); verde <- .std_color("verde_top_two_box")
  W <- g_("ancho"); MR <- g_("margen_der"); ML <- g_("margen_izq")
  Y_DATOS <- g_("zona_datos_y0"); Y_LEY <- g_("leyenda_y"); Y_BASE <- g_("base_y")
  ttb_col <- !is.null(espec$box$unidades)
  rot_box <- espec$box$rotulo %||% .PPT_ROTULO_TOP_TWO_BOX
  ley <- espec$leyenda; labels <- espec$categorias$rotulo[ley]; cols <- espec$categorias$color[ley]
  respuestas <- function(n) paste(format(as.integer(n), big.mark = ","), "respuestas")
  y0 <- Y_DATOS + 0.1; y1 <- Y_LEY - 0.15

  if (isTRUE(solo) && length(premisas) == 1L && length(premisas[[1]]$filas) == 1L) {
    p <- premisas[[1]]; fl <- p$filas[[1]]; g <- 0.72
    wt <- W - ML - MR - 0.4; ht <- .lam_alto_txt(p$texto, wt, 20, TRUE)
    alto_grupo <- ht + 1.15 + g + 1.0
    yt <- Y_DATOS + max(0.3, (Y_BASE - 0.2 - Y_DATOS - alto_grupo) / 2)
    .lam_txt(lz, p$texto, L$x_premisa, yt, wt, ht, 20, azul, bold = TRUE, nombre = "pregunta")
    yb <- yt + ht + 1.15; xb <- L$x_premisa + 1.75; wb <- L$x_top_two_box - xb - 0.25
    if (nzchar(fl$actor)) .lam_txt(lz, fl$actor, L$x_premisa, yb + g / 2 - 0.18, 1.6, 0.3, .std_pt("actor"), azul, bold = TRUE, nombre = "actor")
    .lam_txt(lz, respuestas(fl$valid), L$x_premisa, yb + g / 2 + 0.08, 1.7, 0.26, .std_pt("n"), .std_color("texto_tenue"), nombre = "respuestas")
    .lam_barra_apilada(lz, xb, yb, wb, .lam_escala_seg(espec, fl$i), g)
    if (ttb_col) {
      .lam_txt(lz, rot_box, L$x_top_two_box - 0.1, yb - 0.45, 1.6, 0.26, .std_pt("rotulo_top_two_box"), verde, bold = TRUE, align = "center", nombre = "box:rotulo")
      .lam_txt(lz, espec$box$cifras[fl$i], L$x_top_two_box - 0.1, yb + g / 2 - 0.3, 1.6, 0.6, 28, verde, bold = TRUE, align = "center", nombre = "box:cifra")
    }
    .lam_leyenda(lz, yb + g + 0.55, labels, cols, centrar_en = xb + wb / 2)
    return(invisible(lz))
  }

  hay_chica <- any(vapply(premisas, function(p) any(vapply(p$filas, function(fl) isTRUE(fl$valid < 30), TRUE)), TRUE))
  wp <- .lam_escala_ancho_prem(premisas); geo <- .lam_escala_geo(premisas, wp)
  g <- geo$g; fila <- geo$fila; gap <- geo$gap
  WB <- if (ttb_col) L$ancho_barra else W - MR - L$x_barra - 0.3
  altos_de <- function() vapply(premisas, function(p) max(.lam_alto_txt(p$texto, wp, .std_pt("pregunta"), TRUE), length(p$filas) * fila), 0)
  altos <- altos_de(); tot <- sum(altos) + gap * (length(premisas) - 1)
  disp <- y1 - y0 - 0.7
  if (tot < 0.88 * disp) {   # pocas filas: se reparte el alto, el grosor no cambia
    f_ <- min(2.0, 0.93 * disp / tot); fila <- fila * f_; gap <- gap * f_
    altos <- altos_de(); tot <- sum(altos) + gap * (length(premisas) - 1)
  }
  nb <- sum(vapply(premisas, function(p) length(p$filas), 0)); extra <- max(0, 0.34 - (fila - g))
  if (extra > 0 && tot + nb * extra <= disp + 0.3) {   # aire para las cifras chicas, sólo si cabe
    fila <- fila + extra; altos <- altos_de(); tot <- sum(altos) + gap * (length(premisas) - 1)
  }
  peq <- any(vapply(premisas, function(p) any(vapply(p$filas, function(fl) .lam_tiene_peq(.lam_escala_seg(espec, fl$i), WB), TRUE)), TRUE))
  if (peq && fila - g < 0.36) g <- max(0.24, fila - 0.36)
  y <- y0 + max(0, (y1 - y0 - tot - 0.5) / 2)
  if (ttb_col) .lam_txt(lz, rot_box, L$x_top_two_box, y - 0.45, 1.5, 0.26, .std_pt("rotulo_top_two_box"), verde, bold = TRUE, align = "center", nombre = "box:rotulo")
  ytop <- y
  for (i in seq_along(premisas)) {
    p <- premisas[[i]]; a <- altos[i]; hp <- .lam_alto_txt(p$texto, wp, .std_pt("pregunta"), TRUE)
    if (i > 1) .lam_caja(lz, ML, y - gap / 2, W - ML - MR, 0.008, .std_color("filete"), nombre = "filete")
    .lam_txt(lz, p$texto, L$x_premisa, y + (a - hp) / 2, wp, hp, .std_pt("pregunta"), azul, bold = TRUE, nombre = "premisa")
    yf <- y + (a - length(p$filas) * fila) / 2
    for (fl in p$filas) {
      yb <- yf + (fila - g) / 2 + 0.06
      if (nzchar(fl$actor)) {
        .lam_txt(lz, fl$actor, L$x_actor, yb + g / 2 - 0.25, L$ancho_actor, 0.3, .std_pt("actor"), azul, bold = TRUE, align = "right", nombre = "actor")
        .lam_txt(lz, respuestas(fl$valid), L$x_actor - 0.4, yb + g / 2, L$ancho_actor + 0.4, 0.26, .std_pt("n"), .std_color("texto_tenue"),
                 align = "right", nombre = "respuestas")
      }
      .lam_barra_apilada(lz, L$x_barra, yb, WB, .lam_escala_seg(espec, fl$i), g)
      if (ttb_col) .lam_etiqueta_box(lz, espec, L$x_top_two_box, yb, g, fl$i, con_n = hay_chica)
      yf <- yf + fila
    }
    y <- y + a + gap
  }
  fin_bloque <- if (ttb_col) L$x_top_two_box + 0.75 else L$x_barra + WB
  .lam_leyenda(lz, min(Y_LEY, ytop + tot + 0.3), labels, cols, centrar_en = (L$x_premisa + fin_bloque) / 2)
  invisible(lz)
}

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
.lam_escala_partir <- function(premisas, disponible = .lam_escala_alto_util(), alto_fn = .lam_escala_alto) {
  n <- length(premisas)
  if (n <= 1L || alto_fn(premisas) <= disponible) return(list(premisas))
  cabe <- function(ix) all(vapply(split(premisas, ix), alto_fn, 0) <= disponible)
  for (k in 2:n) {
    mejor <- NULL; mejor_v <- Inf
    for (cs in utils::combn(n - 1, k - 1, simplify = FALSE)) {
      ix <- findInterval(seq_len(n), cs + 1) + 1
      if (!cabe(ix)) next
      altos <- vapply(split(premisas, ix), alto_fn, 0)
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

# ---- filas con Total y Bottom Two Box (recetario: propuestas_rescatables.R:23-47, lámina 77) ----------

#' Bloque de filas con la fila Total separada y las columnas Top Two Box y Bottom Two Box
#'
#' Una pregunta (opcional) encabeza; las cabeceras de las columnas van encima de las cifras; cada fila lleva
#' su rótulo a la derecha, la barra y las cifras de los box. La fila Total va primera, con un filete bajo su
#' barra y 0.22 in de aire. Grosor de la tabla estándar y aire para las cifras chicas.
#' @keywords internal
.lam_filas_box <- function(lz, espec, filas, x, y, w, pregunta = NULL, wlab = 1.8, g = NULL, fila = NULL) {
  azul <- .std_color("azul"); verde <- .std_color("verde_top_two_box")
  naranja <- .std_color("naranja_bottom_two_box_texto")
  cols <- Filter(Negate(is.null), list(
    if (!is.null(espec$box$unidades)) list(b = espec$box, color = verde),
    if (!is.null(espec$box2$unidades)) list(b = espec$box2, color = naranja)))
  wcol <- 1.25; ncol <- length(cols)
  xb <- x + wlab + 0.12; wb <- w - wlab - 0.12 - ncol * wcol - (if (ncol) 0.15 else 0)
  g <- g %||% .std_grosor(length(filas), "escala_apilada")
  chica <- any(vapply(filas, function(i) .lam_tiene_peq(.lam_escala_seg(espec, i), wb), TRUE))
  fila <- max(fila %||% 0, g + (if (chica) .std_geom("aire_cifra_chica") else 0.2))
  yh <- y
  if (!is.null(pregunta) && nzchar(pregunta)) {
    .lam_txt(lz, pregunta, x - 0.1, y, w, 0.34, .std_pt("pregunta"), azul, bold = TRUE, nombre = "pregunta")
    yh <- y + 0.42
  }
  for (k in seq_along(cols)) {
    xc <- xb + wb + 0.1 + (k - 1) * wcol
    .lam_txt(lz, cols[[k]]$b$rotulo, xc - 0.1, yh, wcol + 0.2, 0.26, .std_pt("rotulo_top_two_box"), cols[[k]]$color,
             bold = TRUE, align = "center", nombre = if (k == 1) "box:rotulo" else "box2:rotulo")
  }
  yy <- yh + 0.3
  for (i in filas) {
    es_tot <- isTRUE(espec$filas$es_total[i]); yb <- yy + (fila - g) / 2
    lab <- espec$filas$rotulo[i]; hl <- .lam_alto_txt(lab, wlab, .std_pt("actor"), TRUE)
    .lam_txt(lz, lab, x, yb + (g - hl) / 2, wlab, hl, .std_pt("actor"), azul, bold = TRUE, align = "right", nombre = "actor")
    .lam_barra_apilada(lz, xb, yb, wb, .lam_escala_seg(espec, i), g)
    for (k in seq_along(cols)) {
      xc <- xb + wb + 0.1 + (k - 1) * wcol
      .lam_txt(lz, cols[[k]]$b$cifras[i], xc, yb + (g - 0.3) / 2, wcol, 0.3, .std_pt("cifra"), cols[[k]]$color,
               bold = TRUE, align = "center", nombre = if (k == 1) "box:cifra" else "box2:cifra")
    }
    if (es_tot) .lam_caja(lz, x, yb + g + 0.08, w, 0.008, .std_color("filete"), nombre = "filete:total")
    yy <- yy + fila + (if (es_tot) 0.22 else 0)
  }
  invisible(yy)
}

#' ¿El bloque va en filas con Total o Bottom Two Box en vez del bloque de premisas?
#' @keywords internal
.lam_escala_en_filas <- function(espec) any(espec$filas$es_total) || !is.null(espec$box2$unidades)

# ---- planificación del modo de filas: bloques, alto y partición --------------------------------------

#' Geometría de una parte en filas: grosor por el número de filas, aire para las cifras chicas
#' @keywords internal
.lam_filas_geo <- function(espec, filas) {
  g_ <- .std_geom; w <- g_("ancho") - g_("margen_izq") - g_("margen_der"); wlab <- 1.8
  ncol <- sum(!is.null(espec$box$unidades), !is.null(espec$box2$unidades))
  wb <- w - wlab - 0.12 - ncol * 1.25 - (if (ncol) 0.15 else 0)
  g <- .std_grosor(length(filas), "escala_apilada")
  chica <- any(vapply(filas, function(i) .lam_tiene_peq(.lam_escala_seg(espec, i), wb), TRUE))
  list(g = g, fila = g + (if (chica) .std_geom("aire_cifra_chica") else 0.2))
}

#' Alto de una parte hecha de bloques (pregunta opcional, cabecera de columnas, filas y aire de la Total)
#' @keywords internal
.lam_filas_alto <- function(espec, bloques) {
  filas <- unlist(lapply(bloques, `[[`, "filas"))
  geo <- .lam_filas_geo(espec, filas)
  sum(vapply(bloques, function(b) {
    (if (!is.null(b$pregunta) && nzchar(b$pregunta)) 0.42 else 0) + 0.3 + length(b$filas) * geo$fila +
      0.22 * sum(espec$filas$es_total[b$filas])
  }, 0)) + 0.2 * (length(bloques) - 1L)
}
.lam_filas_disponible <- function() (.std_geom("leyenda_y") - 0.15) - (.std_geom("zona_datos_y0") + 0.1)

#' Partes en filas: un bloque por premisa (con su título) o uno solo bajo la pregunta
#'
#' Si no cabe, se parte por bloques enteros (un bloque de actores no se separa) y, si un bloque solo no
#' cabe, por filas, repitiendo la fila Total en cada parte: es la referencia de los grupos que resume.
#' La letra no encoge.
#' @return Lista de partes; cada parte, una lista de bloques `list(pregunta, filas)`.
#' @keywords internal
.lam_filas_planear <- function(espec, premisas, disponible = .lam_filas_disponible()) {
  con_grupos <- !all(is.na(espec$filas$grupo_id))
  ids <- function(p) vapply(p$filas, function(f) f$i, 0L)
  bloques <- if (con_grupos) {
    lapply(premisas, function(p) list(pregunta = p$texto, filas = ids(p)))
  } else {
    list(list(pregunta = espec$pregunta, filas = unlist(lapply(premisas, ids))))
  }
  alto <- function(bs) .lam_filas_alto(espec, bs)
  partes <- if (length(bloques) > 1L) .lam_escala_partir(bloques, disponible, alto_fn = alto) else list(bloques)
  out <- list()
  for (parte in partes) {
    if (alto(parte) <= disponible || length(parte) > 1L) { out[[length(out) + 1L]] <- parte; next }
    b <- parte[[1]]; tot <- b$filas[espec$filas$es_total[b$filas]]; resto <- setdiff(b$filas, tot)
    hecho <- FALSE
    for (k in 2:max(2L, length(resto))) {
      # Trozos parejos (10 grupos en tres partes: 4/3/3, no 4/4/2), como el corte parejo del recetario.
      trozos <- split(resto, .barras_leyenda_reparto(length(resto), k))
      cand <- lapply(trozos, function(tr) list(list(pregunta = b$pregunta, filas = c(tot, tr))))
      if (all(vapply(cand, alto, 0) <= disponible)) { out <- c(out, unname(cand)); hecho <- TRUE; break }
    }
    if (!hecho) out <- c(out, lapply(resto, function(r) list(list(pregunta = b$pregunta, filas = c(tot, r)))))
  }
  out
}

#' Dibuja una parte en filas: sus bloques uno bajo otro y la leyenda de la lámina
#' @keywords internal
.lam_bloque_filas <- function(lz, espec, bloques) {
  g_ <- .std_geom
  geo <- .lam_filas_geo(espec, unlist(lapply(bloques, `[[`, "filas")))
  x <- g_("margen_izq"); w <- g_("ancho") - x - g_("margen_der"); y <- g_("zona_datos_y0") + 0.1
  for (k in seq_along(bloques)) {
    if (k > 1L) .lam_caja(lz, x, y - 0.1, w, 0.008, .std_color("filete"), nombre = "filete")
    y <- .lam_filas_box(lz, espec, bloques[[k]]$filas, x = x, y = y, w = w, pregunta = bloques[[k]]$pregunta,
                        g = geo$g, fila = geo$fila) + 0.2
  }
  ley <- espec$leyenda
  .lam_leyenda(lz, g_("leyenda_y") - 0.05, espec$categorias$rotulo[ley], espec$categorias$color[ley], centrar_en = g_("ancho") / 2)
  invisible(lz)
}


# ---- Barras divergentes (lámina 71, recetario_m3a.R:50-77) ---------------------

#' Lámina de barras divergentes: desacuerdo a la izquierda del centro, acuerdo a la derecha y «SIN INF» aparte
#'
#' Afirmaciones en una columna de 4.5 in; segmentos desde el centro hacia afuera con su cifra dentro (o encima con
#' guía si no cabe), la suma de cada lado en coral y en verde, la columna «SIN INF» a la derecha y la leyenda
#' centrada debajo. La escala se acerca al lado de desacuerdo más largo.
#' @keywords internal
.lam_laminas_divergentes <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL,
                                     layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); mr <- g_("margen_der")
  yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1")
  azul <- .std_color("azul"); suave <- .std_color("texto_suave"); tenue <- .std_color("texto_tenue")
  C <- espec$categorias; U <- espec$unidades; X <- espec$cifras; n <- length(espec$filas)
  hay_si <- any(C$lado == "sin_inf"); wsi <- if (hay_si) 0.9 else 0
  xq <- ml + 0.1; wq <- 4.5; xa <- xq + wq + 0.25; wa <- W - mr - xa - wsi - 0.2
  neu <- which(C$lado == "neu"); izq <- espec$total_neg + (if (length(neu)) rowSums(U[, neu, drop = FALSE]) / 2 else 0)
  lo <- ceiling((max(izq) + 5) / 10) * 10; px <- wa / (lo + 100); xc <- xa + lo * px
  y0 <- yt + 0.3; fila <- min(0.74, (yf - y0 - 0.35) / max(1L, n)); g <- min(0.4, fila * 0.55)
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  .lam_txt(lz, "En desacuerdo", xc - 2.2, y0 - 0.4, 2.1, 0.26, 10.5, suave, bold = TRUE, align = "right", nombre = "divergentes:encabezado")
  # «Top Two Box» sólo cuando el lado de acuerdo son exactamente dos categorías (lámina 19).
  .lam_txt(lz, if (length(espec$orden_pos) == 2L) "De acuerdo (Top Two Box)" else "De acuerdo", xc + 0.1, y0 - 0.4, 3, 0.26, 10.5, suave,
           bold = TRUE, nombre = "divergentes:encabezado")
  if (hay_si) .lam_txt(lz, C$rotulo[C$lado == "sin_inf"][1], W - mr - wsi, y0 - 0.4, wsi, 0.26, 10.5, suave, bold = TRUE, align = "center",
                       nombre = "divergentes:encabezado")
  neg <- espec$orden_neg %||% rev(which(C$lado == "neg")); pos <- espec$orden_pos %||% which(C$lado == "pos"); si <- which(C$lado == "sin_inf")
  max_si <- if (hay_si) max(1, max(U[, si])) else 1
  for (i in seq_len(n)) {
    yb <- y0 + (i - 1) * fila + (fila - g) / 2
    hp <- .lam_alto_txt(espec$filas[i], wq, 10.5, TRUE)
    .lam_txt(lz, espec$filas[i], xq, yb + g / 2 - hp / 2, wq, hp, 10.5, azul, bold = TRUE, nombre = "divergentes:afirmacion")
    mitad <- if (length(neu)) sum(U[i, neu]) / 2 else 0
    segs <- list()
    for (k in neu) segs[[length(segs) + 1L]] <- list(k = k, x = xc - mitad * px, w = 2 * mitad * px)
    off <- mitad; for (k in neg) { segs[[length(segs) + 1L]] <- list(k = k, x = xc - (off + U[i, k]) * px, w = U[i, k] * px); off <- off + U[i, k] }
    off <- mitad; for (k in pos) { segs[[length(segs) + 1L]] <- list(k = k, x = xc + off * px, w = U[i, k] * px); off <- off + U[i, k] }
    fin_chica <- -Inf   # fin de la última cifra chica dibujada en la fila
    segs <- segs[order(vapply(segs, `[[`, 0, "x"))]
    for (sg in segs) {
      if (U[i, sg$k] <= 0) next
      .lam_caja(lz, sg$x - 0.002, yb, sg$w + 0.004, g, C$color[sg$k], nombre = "divergentes:segmento")
      if (sg$w >= 0.45) {
        .lam_txt(lz, X[i, sg$k], sg$x - 0.1, yb + (g - 0.28) / 2, sg$w + 0.2, 0.28, 11, azul, bold = TRUE, align = "center", nombre = "divergentes:cifra")
      } else {   # cifra chica encima con su guía, como en las apiladas
        # Si se encimaría con la cifra chica vecina, se corre hacia la derecha a la misma altura y la guía hace un
        # codo hasta ella: entre filas no hay alto para dos niveles (verificador de N6, ronda 2).
        wt <- .lam_ancho_tinta(X[i, sg$k], 10.5, TRUE); cs <- sg$x + sg$w / 2
        cl <- max(cs, fin_chica + 0.06 + wt / 2)
        .lam_caja(lz, cs - 0.006, yb - 0.06, 0.012, 0.06, tenue, nombre = "divergentes:guia")
        if (cl > cs + 0.01) .lam_caja(lz, cs, yb - 0.066, cl - cs, 0.012, tenue, nombre = "divergentes:guia")
        .lam_txt(lz, X[i, sg$k], cl - 0.3, yb - 0.3, 0.6, 0.24, 10.5, azul, bold = TRUE, align = "center", nombre = "divergentes:cifra")
        fin_chica <- cl + wt / 2
      }
    }
    .lam_txt(lz, espec$cifras_pos[i], xc + (espec$total_pos[i] + mitad) * px + 0.08, yb + (g - 0.28) / 2, 0.7, 0.28, 11,
             .std_color("verde_top_two_box"), bold = TRUE, nombre = "divergentes:total_acuerdo")
    .lam_txt(lz, espec$cifras_neg[i], xc - (espec$total_neg[i] + mitad) * px - 0.75, yb + (g - 0.28) / 2, 0.7, 0.28, 11,
             .std_color("coral"), bold = TRUE, align = "right", nombre = "divergentes:total_desacuerdo")
    if (hay_si) {
      v <- U[i, si[1]]
      if (v > 0) .lam_caja(lz, W - mr - wsi + 0.05, yb, (wsi - 0.55) * v / max_si, g, C$color[si[1]], nombre = "divergentes:sin_inf")
      .lam_txt(lz, X[i, si[1]], W - mr - 0.5, yb + (g - 0.26) / 2, 0.5, 0.26, 10.5, suave, bold = TRUE, align = "right", nombre = "divergentes:cifra_sin_inf")
    }
  }
  .lam_caja(lz, xc - 0.006, y0 - 0.1, 0.012, n * fila + 0.15, azul, nombre = "divergentes:centro")
  .lam_leyenda(lz, y0 + n * fila + 0.25, C$rotulo, C$color, centrar_en = W / 2)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:divergentes")
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' ¿Las divergentes caben? Hasta 8 afirmaciones con su texto en la fila (10.5 pt en 4.5 in)
#' @keywords internal
.lam_divergentes_cabe <- function(espec) {
  n <- length(espec$filas); y0 <- .std_geom("zona_datos_y0") + 0.3
  fila <- min(0.74, (.std_geom("contenido_y1") - y0 - 0.35) / max(1L, n))
  # La afirmación puede pasar un poco del alto de su fila (el recetario lleva una de cuatro líneas en 0.74 in).
  # Una sola categoría especial (la columna del recetario es una) y la afirmación puede pasar apenas su fila (el
  # recetario lleva una de cuatro líneas en 0.74 in).
  n >= 1L && n <= 8L && sum(espec$categorias$lado == "sin_inf") <= 1L &&
    all(vapply(espec$filas, function(t) .lam_alto_txt(t, 4.5, 10.5, TRUE) <= fila + 0.06, TRUE))
}

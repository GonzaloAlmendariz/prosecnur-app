# Tramos con formato en el PDF (item 19 revisado y L15).
#
# Un motor para todo texto con formato: se envuelve por ANCHO REAL midiendo cada
# trozo con su fuente —Liberation Sans Narrow Regular, Bold, Italic y
# BoldItalic, la familia del dispositivo (item 22)— y su cuerpo (los encabezados <h*> suman puntos), y se
# dibuja trozo a trozo sobre la linea base. El subrayado es una linea dibujada.
#
# Lo usan el dibujo Y `.form_pdf_block_height()` (leccion de L19): cada sitio
# pide el layout una vez y toma de el las lineas y el alto. Un texto SIN formato
# (o cuyo unico formato es la negrita de un sitio que ya va en negrita) sigue por
# el camino de siempre, asi que su geometria no cambia.

# Mide `s` en npc con el font efectivo. NA si no hay dispositivo abierto.
.form_pdf_medir_npc <- function(s, fontsize, fontface = "plain") {
  tryCatch(
    grid::convertWidth(grid::grobWidth(grid::textGrob(
      s, gp = grid::gpar(fontsize = fontsize, fontface = fontface, lineheight = 1.05))),
      "npc", valueOnly = TRUE),
    error = function(e) NA_real_)
}

.form_pdf_rt_cara <- function(b, i) {
  if (b && i) "bold.italic" else if (b) "bold" else if (i) "italic" else "plain"
}

# Layout de unos tramos a ancho `w` (npc). `base_b`/`base_i`: el peso del sitio
# (una banda va en negrita: ahi la negrita del HTML no cambia nada). `line_h`:
# alto de linea del sitio a cuerpo `fs`; una linea con cuerpo mayor crece en
# proporcion. Devuelve list(lineas, alto, plano, space_w).
.form_pdf_rt_layout <- function(runs, w, fs, line_h, base_b = FALSE, base_i = FALSE,
                                mayusculas = FALSE) {
  if (mayusculas) runs <- .form_rt_mayusculas(runs)
  space_w <- .form_pdf_medir_npc(" ", fs)
  if (!is.finite(space_w)) space_w <- fs * 0.28 / .FORM_PDF_REGION_PT
  palabras <- list(); actual <- list()
  cerrar <- function(forzada = FALSE) {
    if (length(actual)) palabras[[length(palabras) + 1L]] <<- list(frags = actual)
    actual <<- list()
    if (forzada) palabras[[length(palabras) + 1L]] <<- list(br = TRUE)
  }
  for (r in runs) {
    if (.form_rt_es_br(r)) { cerrar(TRUE); next }
    toks <- regmatches(r$t, gregexpr("[^ ]+| +", r$t))[[1]]
    for (tk in toks) {
      if (grepl("^ +$", tk)) { cerrar(); next }
      f <- list(t = tk, b = base_b || isTRUE(r$b), i = base_i || isTRUE(r$i),
                u = isTRUE(r$u), fs = fs + (r$s %||% 0))
      f$w <- .form_pdf_medir_npc(tk, f$fs, .form_pdf_rt_cara(f$b, f$i))
      if (!is.finite(f$w)) f$w <- nchar(tk) * f$fs * 0.5 / .FORM_PDF_REGION_PT
      actual[[length(actual) + 1L]] <- f
    }
  }
  cerrar()
  lineas <- list(); cur <- list(); cur_w <- 0
  nueva <- function(forzada) {
    fsmax <- if (length(cur)) max(vapply(cur, function(p) max(vapply(p$frags, `[[`, numeric(1), "fs")), numeric(1))) else fs
    lineas[[length(lineas) + 1L]] <<- list(palabras = cur, ancho = cur_w, forzada = forzada,
                                            fs = fsmax, h = line_h * max(1, fsmax / fs))
    cur <<- list(); cur_w <<- 0
  }
  for (p in palabras) {
    if (isTRUE(p$br)) { nueva(TRUE); next }
    pw <- sum(vapply(p$frags, `[[`, numeric(1), "w"))
    p$w <- pw
    if (!length(cur)) {
      cur <- list(p); cur_w <- pw
    } else if (cur_w + space_w + pw <= w) {
      cur[[length(cur) + 1L]] <- p; cur_w <- cur_w + space_w + pw
    } else {
      nueva(FALSE); cur <- list(p); cur_w <- pw
    }
  }
  if (length(cur)) nueva(FALSE)
  # Un salto al final de la ultima linea no abre otra.
  lineas <- Filter(function(l) length(l$palabras) > 0, lineas)
  plano <- vapply(lineas, function(l) paste(vapply(l$palabras, function(p)
    paste(vapply(p$frags, `[[`, character(1), "t"), collapse = ""), character(1)), collapse = " "),
    character(1))
  list(lineas = lineas, alto = sum(vapply(lineas, `[[`, numeric(1), "h")),
       plano = plano, space_w = space_w, fs = fs)
}

# Dibuja un layout con la linea de arriba en `y`. `align`: left | center |
# justify (la ultima linea y las que acaban en salto forzado no se justifican).
.form_pdf_rt_draw <- function(lay, x, y, w, col = "black", align = "left") {
  if (!length(lay$lineas)) return(y)
  alto_txt <- function(s, fs) grid::convertHeight(grid::grobHeight(grid::textGrob(
    s, gp = grid::gpar(fontsize = fs))), "npc", valueOnly = TRUE)
  yt <- y
  n <- length(lay$lineas)
  for (li in seq_len(n)) {
    L <- lay$lineas[[li]]
    asc <- alto_txt("Hdl", L$fs)
    base <- yt - asc
    gap <- lay$space_w
    cx <- x
    if (identical(align, "center")) cx <- x + (w - L$ancho) / 2
    if (identical(align, "justify") && li < n && !isTRUE(L$forzada) && length(L$palabras) > 1L) {
      gap <- (w - sum(vapply(L$palabras, `[[`, numeric(1), "w"))) / (length(L$palabras) - 1L)
      if (!is.finite(gap) || gap < 0) gap <- lay$space_w
    }
    for (p in L$palabras) {
      for (f in p$frags) {
        grid::grid.text(f$t, x = grid::unit(cx, "npc"), y = grid::unit(base, "npc"),
                        just = c("left", "bottom"),
                        gp = grid::gpar(fontsize = f$fs, fontface = .form_pdf_rt_cara(f$b, f$i), col = col))
        if (isTRUE(f$u)) {
          yu <- grid::unit(base, "npc") - grid::unit(f$fs * 0.13, "points")
          grid::grid.lines(x = grid::unit(c(cx, cx + f$w), "npc"), y = grid::unit.c(yu, yu),
                           gp = grid::gpar(col = col, lwd = max(0.4, f$fs / 16)))
        }
        cx <- cx + f$w
      }
      cx <- cx + gap
    }
    yt <- yt - L$h
  }
  y - lay$alto
}

# Layout del sitio SOLO si los tramos traen formato visible ahi; NULL si el
# texto va por el camino de siempre.
.form_pdf_rt_si <- function(runs, w, fs, line_h, base_b = FALSE, base_i = FALSE,
                            mayusculas = FALSE) {
  if (!.form_rt_tiene_formato(runs, base_b = base_b, base_i = base_i)) return(NULL)
  .form_pdf_rt_layout(runs, w, fs, line_h, base_b = base_b, base_i = base_i, mayusculas = mayusculas)
}

# Geometria de UNA fila de matriz, compartida por el dibujo y por
# `.form_pdf_block_height()` (L19). `inner` es el ancho de la tabla y `lbl_w_txt`
# el de la columna de etiqueta menos su relleno. Con formato (el `**` del autor
# o HTML) la etiqueta se compone por tramos; sin el, el envoltorio de siempre.
.form_pdf_matrix_fila_geom <- function(item, inner, lbl_w_txt) {
  num <- .form_pdf_clean_text(item$number %||% "")
  subl <- .form_pdf_clean_text(item$subletter %||% "")
  is_parent <- isTRUE(item$is_parent)
  rt <- .form_rt_campo(item, "label")
  if (is_parent) {
    pre <- if (nzchar(num)) paste0(num, ".  ") else ""
    txt_w <- inner - 0.012; indent <- 0
  } else if (nzchar(subl)) {
    pre <- paste0(subl, ")  ")
    txt_w <- lbl_w_txt - 0.012; indent <- 0.012
  } else {
    # El numero ya no viaja en la etiqueta: tiene columna propia (L5).
    pre <- ""
    txt_w <- lbl_w_txt - .FORM_PDF_MATRIX_NUM_W
    indent <- .FORM_PDF_MATRIX_NUM_W
  }
  lbl <- paste0(pre, item$label %||% "")
  if (nzchar(pre)) rt <- c(list(.form_rt_run(pre)), rt)
  lay <- .form_pdf_rt_si(rt, txt_w, 7.3, 0.012)
  lineas <- if (is.null(lay)) .form_pdf_wrap_fit(lbl, txt_w, fontsize = 7.3) else lay$plano
  alto_lbl <- if (is.null(lay)) length(lineas) * 0.012 else lay$alto
  sk <- .form_pdf_clean_text(item$skip %||% "")
  sk_lines <- if (nzchar(sk)) .form_pdf_wrap_fit(sk, lbl_w_txt, fontsize = 6.6, fontface = "italic") else character(0)
  list(num = num, subl = subl, is_parent = is_parent, lbl = lbl, txt_w = txt_w,
       indent = indent, lay = lay, lineas = lineas, alto_lbl = alto_lbl,
       n_lbl = alto_lbl / 0.012, sk_lines = sk_lines,
       h = max(0.018, alto_lbl + length(sk_lines) * 0.012 + 0.007))
}

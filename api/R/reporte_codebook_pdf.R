# =============================================================================
# reporte_codebook_pdf.R
# -----------------------------------------------------------------------------
# Libro de codigos en PDF A4, profesional y elegante, a DOS COLUMNAS.
#   - Indice de variables navegable al inicio (variable -> pagina), calculado
#     con una pasada de layout determinista.
#   - Cabecera en cada pagina: Titulo + Subtitulo parametrizables (navy Pulso).
#   - Pie de pagina formal: logo Pulso-PUCP + fuente + numero de pagina.
#   - Etiquetas de pregunta JUSTIFICADAS (llenan el ancho de la columna).
#   - Flujo automatico de bloques de variable a traves de dos columnas.
#
# Stack: base grDevices::pdf() + grid (la "via de casa", sin binarios externos).
# Reusa los helpers de dibujo de reporte_formulario_pdf.R (.form_pdf_wrap,
# .form_pdf_text, .form_pdf_lines_height) y el extractor de datos del codebook
# panel (.panel_codebook_value_labels), sin dependencias nuevas.
# =============================================================================

.CODEBOOK_PDF_PAGE_W <- 8.27
.CODEBOOK_PDF_PAGE_H <- 11.69

# --- Paleta -----------------------------------------------------------------
.codebook_pdf_palette <- function() {
  list(
    navy = "#002457",  # marca Pulso (titulos, nombres de variable)
    ink  = "#1f2933",  # texto principal
    soft = "#5f6b7a",  # secundario / codigos / notas
    rule = "#d0d5dd",  # regla hairline
    line = "#d8e0ef"   # regla del pie/cabecera
  )
}

# --- Geometria de pagina (compartida por simulacion y render) ----------------
.codebook_pdf_geometry <- function() {
  list(
    y_top    = 0.900,
    y_bottom = 0.082,
    col_x    = c(0.048, 0.516),   # columnas mas anchas (menos margen y canaleta)
    col_w    = 0.436,
    div_x    = 0.500
  )
}

# --- Logo -------------------------------------------------------------------
.codebook_pdf_logo_path <- function() {
  cands <- c(
    system.file("hojas_ruta/assets/logo_pulso.png", package = "prosecnurapp"),
    system.file("www/pulso-pucp-logo.png", package = "prosecnurapp"),
    file.path(getwd(), "api", "inst", "hojas_ruta", "assets", "logo_pulso.png"),
    file.path(getwd(), "api", "inst", "www", "pulso-pucp-logo.png")
  )
  cands <- cands[nzchar(cands) & file.exists(cands)]
  if (length(cands)) cands[[1]] else NA_character_
}

.codebook_pdf_draw_logo <- function(x, y, width_npc = 0.135) {
  path <- .codebook_pdf_logo_path()
  if (is.na(path) || !requireNamespace("png", quietly = TRUE)) return(invisible(FALSE))
  img <- tryCatch(png::readPNG(path), error = function(e) NULL)
  if (is.null(img)) return(invisible(FALSE))
  img_h <- dim(img)[1]; img_w <- dim(img)[2]
  h_npc <- width_npc * (img_h / img_w) * (.CODEBOOK_PDF_PAGE_W / .CODEBOOK_PDF_PAGE_H)
  grid::grid.raster(
    img,
    x = grid::unit(x, "npc"), y = grid::unit(y, "npc"),
    just = c("left", "center"),
    width = grid::unit(width_npc, "npc"),
    height = grid::unit(h_npc, "npc")
  )
  invisible(TRUE)
}

# --- Medicion de ancho de texto en npc (para justificar) --------------------
.codebook_pdf_npc_width <- function(s, gp) {
  if (!nzchar(s)) return(0)
  grid::convertWidth(grid::grobWidth(grid::textGrob(s, gp = gp)),
                     "inches", valueOnly = TRUE) / .CODEBOOK_PDF_PAGE_W
}

# Dibuja un parrafo JUSTIFICADO (ambos margenes) dentro del ancho w.
# La ultima linea y las lineas de una sola palabra van alineadas a la izquierda.
# El conteo de lineas usa el mismo wrap por caracteres que la medicion de altura,
# de modo que la altura del bloque es identica a la consumida al dibujar.
.codebook_pdf_draw_justified <- function(text, x, y, w, chars,
                                         fontsize = 8.0, fontface = "plain",
                                         col = "#1f2933", line_h = 0.0135) {
  lines <- .form_pdf_wrap(text, chars)
  if (!length(lines)) return(y)
  gp <- grid::gpar(fontsize = fontsize, fontface = fontface, col = col, lineheight = 1.05)
  n <- length(lines)
  for (li in seq_len(n)) {
    words <- strsplit(lines[[li]], "\\s+")[[1]]
    words <- words[nzchar(words)]
    if (!length(words)) { y <- y - line_h; next }
    if (li == n || length(words) == 1L) {
      grid::grid.text(paste(words, collapse = " "),
                      x = grid::unit(x, "npc"), y = grid::unit(y, "npc"),
                      just = c("left", "top"), gp = gp)
    } else {
      ww <- vapply(words, function(s) .codebook_pdf_npc_width(s, gp), numeric(1))
      gaps <- length(words) - 1L
      slack <- w - sum(ww)
      gap_w <- if (slack > 0) slack / gaps else .codebook_pdf_npc_width(" ", gp)
      cx <- x
      for (k in seq_along(words)) {
        grid::grid.text(words[[k]], x = grid::unit(cx, "npc"), y = grid::unit(y, "npc"),
                        just = c("left", "top"), gp = gp)
        cx <- cx + ww[[k]] + gap_w
      }
    }
    y <- y - line_h
  }
  y
}

# --- Cabecera y pie ---------------------------------------------------------
.codebook_pdf_header <- function(titulo, subtitulo, pal) {
  .form_pdf_text(titulo, 0.048, 0.968, 0.904, chars = 84, fontsize = 15,
                 fontface = "bold", col = pal$navy, line_h = 0.020)
  if (nzchar(subtitulo)) {
    .form_pdf_text(subtitulo, 0.048, 0.952, 0.904, chars = 130, fontsize = 9.5,
                   col = pal$soft, line_h = 0.014)
  }
  grid::grid.lines(
    x = grid::unit(c(0.048, 0.952), "npc"),
    y = grid::unit(0.918, "npc"),
    gp = grid::gpar(col = pal$navy, lwd = 1.1)
  )
}

.codebook_pdf_footer <- function(page_no, periodo, pal) {
  grid::grid.lines(
    x = grid::unit(c(0.048, 0.952), "npc"),
    y = grid::unit(0.062, "npc"),
    gp = grid::gpar(col = pal$line, lwd = 0.7)
  )
  drew <- .codebook_pdf_draw_logo(0.048, 0.038, width_npc = 0.135)
  if (!isTRUE(drew)) {
    grid::grid.text("PULSO PUCP", x = grid::unit(0.048, "npc"),
                    y = grid::unit(0.038, "npc"), just = c("left", "center"),
                    gp = grid::gpar(fontsize = 8.5, fontface = "bold", col = pal$navy))
  }
  # Centro: mes y anio del estudio (el logo ya identifica a Pulso-PUCP).
  if (nzchar(periodo)) {
    grid::grid.text(periodo, x = grid::unit(0.500, "npc"),
                    y = grid::unit(0.038, "npc"),
                    gp = grid::gpar(fontsize = 8, col = pal$soft))
  }
  grid::grid.text(paste0("Pag. ", page_no), x = grid::unit(0.952, "npc"),
                  y = grid::unit(0.038, "npc"), just = c("right", "center"),
                  gp = grid::gpar(fontsize = 8, col = pal$soft))
}

# --- Rect / marco helpers (top-left en npc) ---------------------------------
.cb_rect <- function(x, y, w, h, fill) {
  grid::grid.rect(x = grid::unit(x + w / 2, "npc"), y = grid::unit(y - h / 2, "npc"),
                  width = grid::unit(w, "npc"), height = grid::unit(h, "npc"),
                  gp = grid::gpar(fill = fill, col = NA))
}
.cb_frame <- function(x1, y_top, x2, y_bot, col, lwd = 0.7) {
  grid::grid.rect(x = grid::unit((x1 + x2) / 2, "npc"), y = grid::unit((y_top + y_bot) / 2, "npc"),
                  width = grid::unit(x2 - x1, "npc"), height = grid::unit(y_top - y_bot, "npc"),
                  gp = grid::gpar(fill = NA, col = col, lwd = lwd))
}

# --- Medicion y dibujo de un bloque de variable (formato TABLA) --------------
# Cada variable es una entrada estructurada: nombre + pregunta + una TABLA con
# encabezados "Codigo | Etiqueta", divisor vertical, marco y zebra sutil.
.CODEBOOK_TBL <- list(
  code_w     = 0.050,  # ancho MINIMO de la columna Codigo (crece con el codigo)
  code_w_max = 0.42,   # ancho MAXIMO como fraccion del ancho de la columna
  name_h = 0.020,   # alto del nombre de variable
  q_lh   = 0.0138,  # alto de linea de la pregunta
  hdr_h  = 0.019,   # alto de la fila de encabezado de la tabla
  row_lh = 0.0126,  # alto de linea dentro de una fila de valor
  row_pad = 0.0060, # relleno vertical por fila de valor
  gap_q  = 0.007,   # espacio entre pregunta y tabla
  gap_bottom = 0.016
)

# Caracteres por linea: calibrado para LLENAR el ancho disponible (antes se
# cortaba muy temprano y dejaba blanco a la derecha). ~150 char/npc a 7.9pt.
.codebook_pdf_label_chars <- function(w) max(14L, floor(w * 150))

# Ancho de la columna "Codigo": crece con el codigo mas largo del bloque
# (p. ej. slugs de SurveyMonkey como "Se_mantienen_igual"), acotado para no
# comerse la columna de Etiqueta. Se mide igual en la simulacion y en el
# dibujo, de modo que el layout determinista se mantiene.
.codebook_pdf_code_w <- function(codes, w) {
  tb <- .CODEBOOK_TBL
  gp_code <- grid::gpar(fontsize = 7.8)
  gp_hdr  <- grid::gpar(fontsize = 7.2, fontface = "bold")
  cw <- vapply(as.character(codes), function(s) .codebook_pdf_npc_width(s, gp_code), numeric(1))
  needed <- max(c(cw, .codebook_pdf_npc_width("Código", gp_hdr)), 0) + 0.014  # padding L+R
  min(max(needed, tb$code_w), tb$code_w_max * w)
}
.codebook_pdf_val_chars   <- function(w, code_w) {
  max(8L, floor((w - code_w - 0.010) * 150))
}
.codebook_pdf_val_lines <- function(lab, w, code_w) {
  max(1L, length(.form_pdf_wrap(lab, .codebook_pdf_val_chars(w, code_w))))
}
.codebook_pdf_row_h <- function(lab, w, code_w) {
  tb <- .CODEBOOK_TBL
  .codebook_pdf_val_lines(lab, w, code_w) * tb$row_lh + tb$row_pad
}

.codebook_pdf_block_height <- function(block, w) {
  tb <- .CODEBOOK_TBL
  code_w <- .codebook_pdf_code_w(block$codes, w)
  q_h    <- .form_pdf_lines_height(.form_pdf_wrap(block$label, .codebook_pdf_label_chars(w)), tb$q_lh, 0.0)
  rows_h <- sum(vapply(block$labels, function(l) .codebook_pdf_row_h(l, w, code_w), numeric(1)))
  tb$name_h + q_h + tb$gap_q + tb$hdr_h + rows_h + tb$gap_bottom
}

.codebook_pdf_draw_block <- function(block, x, y, w, pal) {
  tb <- .CODEBOOK_TBL
  y0 <- y
  header_fill <- "#e9eef6"; zebra_fill <- "#f6f8fb"
  frame_col   <- "#c3ccdb"; div_col    <- "#c9d1de"

  # 1) nombre de variable (navy, bold) con numeración editorial "01 ·"
  name_x <- x
  if (length(block$idx) && is.finite(block$idx)) {
    counter <- sprintf("%02d", as.integer(block$idx))
    grid::grid.text(counter, x = grid::unit(x, "npc"), y = grid::unit(y, "npc"),
                    just = c("left", "top"),
                    gp = grid::gpar(fontsize = 8.7, fontface = "bold", col = "#8792a2"))
    name_x <- x + 0.024
  }
  .form_pdf_text(block$name, name_x, y, w - (name_x - x), chars = max(14L, floor((w - (name_x - x)) * 150)),
                 fontsize = 8.7, fontface = "bold", col = pal$navy, line_h = tb$name_h)
  y <- y - tb$name_h

  # 2) pregunta (alineada a la izquierda; sin justificar para evitar "rios")
  y <- .form_pdf_text(block$label, x, y, w,
                      chars = .codebook_pdf_label_chars(w),
                      fontsize = 7.9, col = pal$ink, line_h = tb$q_lh)
  y <- y - tb$gap_q

  # 3) TABLA de valores: Codigo | Etiqueta
  code_w <- .codebook_pdf_code_w(block$codes, w)
  x_div  <- x + code_w
  x2     <- x + w
  tbl_top <- y
  # 3a) encabezado
  .cb_rect(x, y, w, tb$hdr_h, header_fill)
  grid::grid.text("Código", x = grid::unit(x + code_w / 2, "npc"),
                  y = grid::unit(y - tb$hdr_h / 2, "npc"), just = c("center", "center"),
                  gp = grid::gpar(fontsize = 7.2, fontface = "bold", col = pal$navy))
  grid::grid.text("Etiqueta", x = grid::unit(x_div + 0.006, "npc"),
                  y = grid::unit(y - tb$hdr_h / 2, "npc"), just = c("left", "center"),
                  gp = grid::gpar(fontsize = 7.2, fontface = "bold", col = pal$navy))
  y <- y - tb$hdr_h
  # 3b) filas
  for (i in seq_along(block$codes)) {
    rh <- .codebook_pdf_row_h(block$labels[[i]], w, code_w)
    if ((i %% 2L) == 0L) .cb_rect(x, y, w, rh, zebra_fill)  # zebra en filas pares
    # codigo alineado con la PRIMERA linea de la etiqueta (top), centrado horizontal
    grid::grid.text(block$codes[[i]], x = grid::unit(x + code_w / 2, "npc"),
                    y = grid::unit(y - 0.0016, "npc"), just = c("center", "top"),
                    gp = grid::gpar(fontsize = 7.8, col = pal$ink))
    .form_pdf_text(block$labels[[i]], x_div + 0.006, y - 0.0016, w - code_w - 0.008,
                   chars = .codebook_pdf_val_chars(w, code_w),
                   fontsize = 7.8, col = pal$ink, line_h = tb$row_lh)
    y <- y - rh
  }
  tbl_bot <- y
  # 3c) acento navy sobre el encabezado + divisor vertical + marco
  grid::grid.lines(x = grid::unit(c(x, x2), "npc"),
                   y = grid::unit(c(tbl_top, tbl_top), "npc"),
                   gp = grid::gpar(col = pal$navy, lwd = 1.0))
  grid::grid.lines(x = grid::unit(c(x_div, x_div), "npc"),
                   y = grid::unit(c(tbl_bot, tbl_top), "npc"),
                   gp = grid::gpar(col = div_col, lwd = 0.6))
  grid::grid.lines(x = grid::unit(c(x, x2), "npc"),
                   y = grid::unit(c(tbl_top - tb$hdr_h, tbl_top - tb$hdr_h), "npc"),
                   gp = grid::gpar(col = frame_col, lwd = 0.6))  # regla bajo encabezado
  .cb_frame(x, tbl_top, x2, tbl_bot, frame_col)

  # Avanza EXACTAMENTE la altura medida (para que el indice cuadre con el dibujo).
  y0 - .codebook_pdf_block_height(block, w)
}

# --- Extraccion de bloques --------------------------------------------------
.codebook_pdf_build_blocks <- function(df, ord = NULL, codigos_cond_chr = character(0)) {
  inst <- attr(df, "instrumento_reporte", exact = TRUE)
  var_labels <- (inst %||% list())$var_labels
  get_lbl <- function(v) {
    lb <- attr(df[[v]], "label", exact = TRUE)
    if (is.null(lb) || is.na(lb) || !nzchar(lb)) lb <- var_labels[[v]] %||% ""
    if (is.null(lb) || is.na(lb) || !nzchar(lb)) {
      ov <- (ord %||% list())[[v]]
      lb <- (ov %||% list())$var_label %||% ""
    }
    if (is.null(lb) || is.na(lb) || !nzchar(lb)) lb <- v
    as.character(lb)
  }
  blocks <- list()
  for (v in names(df)) {
    vl <- .panel_codebook_value_labels(df, v, ord = ord, codigos_cond_chr = codigos_cond_chr)
    if (is.null(vl) || !length(vl$codes)) next
    blocks[[length(blocks) + 1L]] <- list(
      name   = v,
      label  = get_lbl(v),
      codes  = as.character(vl$codes),
      labels = as.character(vl$labels),
      idx    = length(blocks) + 1L
    )
  }
  blocks
}

# --- Simulacion de paginas de contenido (determinista) ----------------------
# Devuelve, para cada bloque, la pagina (1-based, relativa al contenido) donde cae.
.codebook_pdf_simulate <- function(blocks, geo) {
  page <- 1L; cur <- 1L
  y <- c(geo$y_top, geo$y_top)
  out <- integer(length(blocks))
  for (i in seq_along(blocks)) {
    h <- .codebook_pdf_block_height(blocks[[i]], geo$col_w)
    if (y[cur] - h < geo$y_bottom) {
      if (cur == 1L) {
        cur <- 2L
      } else {
        page <- page + 1L; cur <- 1L; y <- c(geo$y_top, geo$y_top)
      }
    }
    out[i] <- page
    y[cur] <- y[cur] - h
  }
  out
}

# --- Indice -----------------------------------------------------------------
# Se reparte a lo ancho de la HOJA COMPLETA (dos columnas equilibradas) y se
# estira el interlineado para llenar el alto disponible, en vez de apilar todo
# en una sola columna dejando la pagina medio vacia.
.codebook_pdf_index_layout <- function(n_entries, geo) {
  idx_top     <- 0.858   # bajo el titulo "Indice de variables"
  avail       <- idx_top - geo$y_bottom
  n_cols      <- 2L
  min_entry_h <- 0.0166  # espaciado minimo comodo (define cuantas caben por pagina)
  per_col_max <- max(1L, floor(avail / min_entry_h))
  per_page    <- n_cols * per_col_max
  list(idx_top = idx_top, avail = avail, n_cols = n_cols,
       min_entry_h = min_entry_h, per_col_max = per_col_max,
       per_page = per_page, n_pages = as.integer(ceiling(n_entries / per_page)))
}

.codebook_pdf_draw_index <- function(entries, abs_pages, geo, lay, titulo, subtitulo,
                                     periodo, pal, footer_page_start, page_break) {
  n <- length(entries)
  gp_name <- grid::gpar(fontsize = 8.0, col = pal$navy, fontface = "bold")
  max_entry_h <- 0.034  # tope de estirado (evita renglones flotando si hay pocos)
  page_i <- 0L
  i <- 1L
  while (i <= n) {
    page_i <- page_i + 1L
    page_break()
    .codebook_pdf_header(titulo, subtitulo, pal)
    .codebook_pdf_footer(footer_page_start + page_i - 1L, periodo, pal)
    .form_pdf_text("Índice de variables", 0.048, 0.895, 0.904, chars = 60,
                   fontsize = 10.5, fontface = "bold", col = pal$navy, line_h = 0.016)
    grid::grid.lines(x = grid::unit(c(0.048, 0.952), "npc"), y = grid::unit(0.876, "npc"),
                     gp = grid::gpar(col = pal$rule, lwd = 0.7))

    # Entradas de ESTA pagina, equilibradas entre columnas y estiradas para
    # llenar el alto disponible (hoja completa, no una sola columna).
    n_this    <- min(lay$per_page, n - i + 1L)
    rows_used <- as.integer(ceiling(n_this / lay$n_cols))
    entry_h   <- min(max_entry_h, lay$avail / rows_used)
    for (col in seq_len(lay$n_cols)) {
      if (i > n) break
      x <- geo$col_x[col]; w <- geo$col_w
      y <- lay$idx_top
      for (r in seq_len(rows_used)) {
        if (i > n) break
        nm <- entries[[i]]; pg <- as.character(abs_pages[[i]])
        grid::grid.text(nm, x = grid::unit(x, "npc"), y = grid::unit(y, "npc"),
                        just = c("left", "top"), gp = gp_name)
        grid::grid.text(pg, x = grid::unit(x + w, "npc"), y = grid::unit(y, "npc"),
                        just = c("right", "top"), gp = grid::gpar(fontsize = 8.0, col = pal$soft))
        # lider punteado entre el nombre y el numero
        nm_w <- .codebook_pdf_npc_width(nm, gp_name)
        pg_w <- .codebook_pdf_npc_width(pg, gp_name)
        x1 <- x + nm_w + 0.008; x2 <- x + w - pg_w - 0.008
        if (x2 - x1 > 0.02) {
          grid::grid.lines(x = grid::unit(c(x1, x2), "npc"),
                           y = grid::unit(y - 0.006, "npc"),
                           gp = grid::gpar(col = pal$rule, lwd = 0.5, lty = "dotted"))
        }
        y <- y - entry_h
        i <- i + 1L
      }
    }
  }
  page_i
}

#' Genera el libro de codigos en PDF A4 a dos columnas, con indice.
#' @noRd
reporte_codebook_pdf <- function(df, output_file,
                                 titulo = "Libro de codigos",
                                 subtitulo = "",
                                 ord = NULL,
                                 codigos_solo_si_presentes = NULL,
                                 periodo = "",
                                 incluir_indice = TRUE) {
  stopifnot(is.data.frame(df))
  pal <- .codebook_pdf_palette()
  geo <- .codebook_pdf_geometry()
  ord <- ord %||% (attr(df, "instrumento_reporte", exact = TRUE) %||% list())$orders_list
  codigos_cond_chr <- as.character(codigos_solo_si_presentes %||% character(0))

  blocks <- .codebook_pdf_build_blocks(df, ord = ord, codigos_cond_chr = codigos_cond_chr)
  if (!length(blocks)) stop("No hay variables con etiquetas de valor para el libro de codigos.", call. = FALSE)

  grDevices::pdf(output_file, paper = "a4",
                 width = .CODEBOOK_PDF_PAGE_W, height = .CODEBOOK_PDF_PAGE_H, onefile = TRUE)
  on.exit(grDevices::dev.off(), add = TRUE)

  # grDevices::pdf() ya abre una primera pagina; el primer salto la reutiliza en
  # vez de crear una hoja en blanco al inicio (bug clasico pdf()+grid.newpage()).
  page_started <- FALSE
  page_break <- function() {
    if (page_started) grid::grid.newpage()
    page_started <<- TRUE
  }

  # Layout determinista: pagina de contenido de cada variable + nº de paginas de indice.
  content_page <- .codebook_pdf_simulate(blocks, geo)
  lay <- .codebook_pdf_index_layout(length(blocks), geo)
  n_index_pages <- if (isTRUE(incluir_indice)) lay$n_pages else 0L
  abs_pages <- n_index_pages + content_page

  # 1) Indice
  if (isTRUE(incluir_indice)) {
    .codebook_pdf_draw_index(
      entries = vapply(blocks, function(b) b$name, character(1)),
      abs_pages = abs_pages, geo = geo, lay = lay,
      titulo = titulo, subtitulo = subtitulo, periodo = periodo, pal = pal,
      footer_page_start = 1L, page_break = page_break
    )
  }

  # 2) Contenido
  page_no <- n_index_pages
  current_col <- 1L
  y <- c(geo$y_top, geo$y_top)
  divider_top <- NA_real_

  flush_divider <- function(bottom_y = geo$y_bottom) {
    if (is.na(divider_top)) return(invisible(NULL))
    if ((divider_top - bottom_y) > 0.03) {
      grid::grid.lines(
        x = grid::unit(c(geo$div_x, geo$div_x), "npc"),
        y = grid::unit(c(bottom_y, divider_top), "npc"),
        gp = grid::gpar(col = pal$rule, lwd = 0.5)
      )
    }
    divider_top <<- NA_real_
    invisible(NULL)
  }
  new_page <- function() {
    if (page_no > n_index_pages) flush_divider(geo$y_bottom)
    page_no <<- page_no + 1L
    page_break()
    .codebook_pdf_header(titulo, subtitulo, pal)
    .codebook_pdf_footer(page_no, periodo, pal)
    current_col <<- 1L
    y <<- c(geo$y_top, geo$y_top)
    divider_top <<- NA_real_
  }
  new_page()

  for (block in blocks) {
    h <- .codebook_pdf_block_height(block, geo$col_w)
    if (y[current_col] - h < geo$y_bottom) {
      if (current_col == 1L) current_col <- 2L else new_page()
    }
    if (is.na(divider_top)) divider_top <- y[current_col]
    y[current_col] <- .codebook_pdf_draw_block(block, geo$col_x[current_col], y[current_col], geo$col_w, pal)
  }
  flush_divider(geo$y_bottom)

  invisible(list(path = output_file, n_variables = length(blocks),
                 n_pages = page_no, n_index_pages = n_index_pages))
}

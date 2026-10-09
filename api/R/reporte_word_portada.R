# =============================================================================
# reporte_word_portada.R — portada e índices del Word del recetario (N8.11)
# =============================================================================
#
# Portan `portada_A`, `portada_B`, `portada_C` (recetario_word_identidad.R:71-105) y los índices reales del documento
# (recetario_word.R:132-139): «Contenido» con el campo TOC de los títulos 1 y 2 y los índices de gráficos y de tablas
# con el campo TOC de sus SEQ. Las tres portadas son variantes elegibles (decisión de N7, 2026-10-09: «Dejar las 4 como
# posibilidades, eso incluye las variantes de título y cierre»). Los índices los llena Word al abrir (updateFields de
# `.docx_conformar(revista = TRUE)`); LibreOffice no los llena, así que se verifican en el XML.

#' Párrafo con formato directo del recetario (`parr()` + `tx()`, recetario_word.R:24-27): Arial, interlineado 1.3
#' @param ... Trozos `list(texto, pt, color, negrita, cursiva)`.
#' @keywords internal
.word_parr <- function(doc, ..., align = "left", antes = 0, despues = 8, mantener = FALSE) {
  f <- .std_word("tipografia", "fuente")
  trozos <- lapply(list(...), function(t) {
    t <- c(as.list(t), vector("list", 5L))[1:5]   # texto, pt, color, negrita, cursiva: lo que falte va por defecto
    officer::ftext(as.character(t[[1]]), officer::fp_text(font.family = f, font.size = t[[2]] %||% 10.5, color = t[[3]] %||% .std_word("colores", "texto"),
                                                       bold = isTRUE(t[[4]]), italic = isTRUE(t[[5]])))
  })
  officer::body_add_fpar(doc, do.call(officer::fpar, c(trozos, list(fp_p = officer::fp_par(text.align = align, padding.bottom = despues,
                                                                                           padding.top = antes, line_spacing = 1.3, keep_with_next = mantener)))))
}

#' Filete corto coral de la portada (`filete_coral()`): 0.9 in, 2.5 pt
#' @keywords internal
.word_filete_coral <- function(doc, w = 0.9) {
  ft <- flextable::flextable(data.frame(a = "")) |> flextable::delete_part("header") |> flextable::border_remove() |>
    flextable::width(j = 1, width = w) |> flextable::height(height = 0.02) |>
    flextable::hline_top(border = officer::fp_border(color = .std_word("colores", "acento"), width = 2.5)) |> flextable::padding(padding = 0)
  flextable::body_add_flextable(doc, ft, align = "left")
}

#' Portada del informe en una de sus tres variantes del recetario
#'
#' A: tipográfica (antetítulo, título de 28 pt, filete coral, subtítulo, quién y cuándo). B: banda navy a la izquierda y el
#' texto abajo. C: como A con la ficha del encargo (para quién, por quién, fecha y versión).
#' @param meta Lista con `ante`, `titulo`, `sub`, `para`, `por`, `fecha`, `version` (lo que falte se omite).
#' @keywords internal
.word_portada <- function(doc, meta, variante = c("A", "B", "C")) {
  variante <- match.arg(variante)
  navy <- .std_word("colores", "titulos"); suave <- .std_word("colores", "suave"); txt <- .std_word("colores", "texto")
  m <- lapply(list(ante = "", titulo = "", sub = "", para = "", por = "PULSO PUCP", fecha = "", version = ""), identity)
  m[names(meta)] <- lapply(meta, function(x) as.character(x %||% "")[1])
  if (identical(variante, "B")) {
    f <- .std_word("tipografia", "fuente"); ch <- function(t, pt, col, b = FALSE) flextable::as_chunk(t, props = officer::fp_text(font.family = f, font.size = pt, color = col, bold = b))
    ft <- flextable::flextable(data.frame(a = "", b = "")) |> flextable::delete_part("header") |> flextable::border_remove() |>
      flextable::width(j = 1, width = 0.3) |> flextable::width(j = 2, width = .std_word("pagina", "ancho_util") - 0.3) |>
      flextable::bg(j = 1, bg = navy) |> flextable::height(height = 8.4) |> flextable::hrule(rule = "exact") |> flextable::valign(j = 2, valign = "bottom") |>
      flextable::compose(j = 2, value = flextable::as_paragraph(ch(m$ante, 9, suave, TRUE), "\n\n", ch(m$titulo, 26, navy, TRUE), "\n\n",
                                                                 ch(m$sub, 12, txt), "\n\n\n\n", ch(trimws(paste(m$por, m$fecha, sep = "   ")), 9.5, navy, TRUE))) |>
      flextable::padding(j = 2, padding.left = 28, padding.bottom = 10) |> flextable::line_spacing(space = 1.05)
    return(flextable::body_add_flextable(doc, ft, align = "left"))
  }
  grande <- if (identical(variante, "A")) 28 else 26
  for (k in seq_len(if (identical(variante, "A")) 6L else 5L)) doc <- officer::body_add_par(doc, "")
  if (nzchar(m$ante)) doc <- .word_parr(doc, list(m$ante, 9, suave, TRUE), despues = 10)
  doc <- .word_parr(doc, list(m$titulo, grande, navy, TRUE), despues = 14)
  doc <- .word_filete_coral(doc)
  if (nzchar(m$sub)) doc <- .word_parr(doc, list(m$sub, if (identical(variante, "A")) 13 else 12, txt), antes = 10, despues = if (identical(variante, "A")) 120 else 90)
  if (identical(variante, "A")) {
    doc <- .word_parr(doc, list(m$por, 9.5, navy, TRUE), despues = 2)
    return(if (nzchar(m$fecha)) .word_parr(doc, list(m$fecha, 9.5, suave), despues = 2) else doc)
  }
  fic <- data.frame(k = c("Elaborado para", "Elaborado por", "Fecha", "Versión"), v = c(m$para, m$por, m$fecha, m$version))
  fic <- fic[nzchar(fic$v), , drop = FALSE]
  ft <- flextable::flextable(fic) |> flextable::delete_part("header") |> flextable::border_remove() |>
    flextable::width(j = 1, width = 1.6) |> flextable::width(j = 2, width = 3.2) |> flextable::font(fontname = .std_word("tipografia", "fuente"), part = "all") |>
    flextable::fontsize(size = 9.5) |> flextable::color(j = 1, color = suave) |> flextable::color(j = 2, color = navy) |> flextable::bold(j = 2) |>
    flextable::hline(border = officer::fp_border(color = .std_word("colores", "filete"), width = 0.5)) |>
    flextable::hline_top(border = officer::fp_border(color = navy, width = 0.75)) |>
    flextable::padding(padding.top = 4, padding.bottom = 4) |> flextable::padding(j = 1, padding.left = 0)
  flextable::body_add_flextable(doc, ft, align = "left")
}

#' Índices del informe: «Contenido» (títulos 1 y 2), índice de gráficos y, si hay tablas, índice de tablas; todos campos
#' TOC de Word con la nota de cómo se actualizan (recetario_word.R:132-139)
#' @param con_tablas Si el informe tiene tablas numeradas.
#' @keywords internal
.word_indices <- function(doc, con_tablas = TRUE) {
  navy <- .std_word("colores", "titulos")
  doc <- .word_parr(doc, list("Contenido", 18, navy, TRUE), despues = 10)
  doc <- officer::body_add(doc, officer::block_toc(level = 2))
  doc <- .word_parr(doc, list("Índice de gráficos", 13, navy, TRUE), antes = 16, despues = 6)
  doc <- officer::body_add(doc, officer::block_toc(seq_id = "Gráfico"))
  if (isTRUE(con_tablas)) {
    doc <- .word_parr(doc, list("Índice de tablas", 13, navy, TRUE), antes = 16, despues = 6)
    doc <- officer::body_add(doc, officer::block_toc(seq_id = "Tabla"))
  }
  .word_parr(doc, list("Los índices son campos de Word: se actualizan con clic derecho > Actualizar campos, o seleccionando todo y presionando F9.",
                       8.5, .std_word("colores", "suave"), FALSE, TRUE), antes = 8)
}

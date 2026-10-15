# Columna del codigo de opcion (item 18, checklist 2026-10-15).
#
# Los codigos de texto se partian dentro de su celda: en el .docx de acnur_pdm
# salian «Ye/s», «less1/5», «more_/2h», «NoSa/y». La columna tenia un ancho fijo
# (0.4 in en la lista vertical, 0.28 in en la fila horizontal) pensado para
# codigos de una o dos cifras. En el PDF el ancho salia de CONTAR caracteres
# (`nchar * 0.011`, tope 0.070), sin medir: una letra ancha se salia de la celda.
#
# Escalera (decision del lead, 2026-10-15), en este orden:
#   1. ensanchar la columna hasta el codigo mas ancho MEDIDO, con tope en el
#      DOBLE del ancho actual;
#   2. si ni con el tope cabe, bajar el cuerpo del codigo hasta 7 pt;
#   3. recien entonces, partir.
# Un codigo que ya cabia no cambia nada: el ancho de antes es el piso, asi que
# los instrumentos de codigos numericos salen identicos.
#
# Los codigos se imprimen TAL CUAL (tambien los especiales 90-99): aqui solo se
# decide el ancho y el cuerpo de la celda, nunca el texto.

.FORM_CODIGO_PISO_PT <- 7

# --- PDF ---------------------------------------------------------------------

# Cuerpo y relleno del codigo en la lista de opciones del PDF.
.FORM_PDF_CODIGO_FS <- 7.7
.FORM_PDF_CODIGO_PAD <- 0.008   # npc, los dos lados juntos

# `codes`: codigos visibles (ya limpios). `ancho_actual`: el ancho de columna que
# daba la regla anterior. Devuelve list(code_w, code_fs, lineas = list(chr)).
.form_pdf_codigo_geom <- function(codes, ancho_actual) {
  codes <- as.character(codes)
  codes <- codes[nzchar(codes)]
  tope <- 2 * ancho_actual
  base <- list(code_w = ancho_actual, code_fs = .FORM_PDF_CODIGO_FS,
               lineas = stats::setNames(as.list(codes), codes))
  if (!length(codes)) return(base)
  medir <- function(fs) max(vapply(codes, function(cd) {
    v <- .form_pdf_medir_npc(cd, fs, "bold")
    if (is.finite(v)) v else nchar(cd, type = "width") * fs * 0.55 / .FORM_PDF_REGION_PT
  }, numeric(1)))
  necesita <- medir(.FORM_PDF_CODIGO_FS) + .FORM_PDF_CODIGO_PAD
  if (necesita <= ancho_actual) return(base)
  if (necesita <= tope) {
    base$code_w <- necesita
    return(base)
  }
  # 2. Tope alcanzado: bajar el cuerpo. El ancho del texto escala con el cuerpo.
  base$code_w <- tope
  disponible <- tope - .FORM_PDF_CODIGO_PAD
  ancho_fs <- medir(.FORM_PDF_CODIGO_FS)
  fs <- .FORM_PDF_CODIGO_FS * disponible / ancho_fs
  fs <- floor(fs * 10) / 10
  if (fs >= .FORM_CODIGO_PISO_PT) {
    base$code_fs <- fs
    return(base)
  }
  # 3. Ni a 7 pt cabe: se parte el codigo, a 7 pt, en trozos que si caben.
  base$code_fs <- .FORM_CODIGO_PISO_PT
  base$lineas <- stats::setNames(lapply(codes, function(cd) {
    .form_pdf_partir_codigo(cd, disponible, .FORM_CODIGO_PISO_PT)
  }), codes)
  base
}

# Parte un codigo sin espacios en trozos que quepan en `w` (npc) a `fs`.
.form_pdf_partir_codigo <- function(cd, w, fs) {
  chars <- strsplit(cd, "")[[1]]
  out <- character(0); cur <- ""
  for (ch in chars) {
    cand <- paste0(cur, ch)
    cw <- .form_pdf_medir_npc(cand, fs, "bold")
    if (!is.finite(cw)) cw <- nchar(cand) * fs * 0.55 / .FORM_PDF_REGION_PT
    if (nzchar(cur) && cw > w) {
      out <- c(out, cur); cur <- ch
    } else {
      cur <- cand
    }
  }
  c(out, cur)
}

# --- Word --------------------------------------------------------------------

# Ancho en puntos de un codigo en negrita (los codigos van en negrita). Misma
# aproximacion declarada que `.form_word_ancho_pt` (sans x 0,84), midiendo con el
# peso real.
.form_word_ancho_pt_negrita <- function(txt, size) {
  txt <- .form_pdf_clean_text_safe(txt %||% "")
  if (!nzchar(txt)) return(0)
  w <- tryCatch(
    grid::convertWidth(
      grid::grobWidth(grid::textGrob(txt, gp = grid::gpar(fontsize = size, fontface = "bold"))),
      "points", valueOnly = TRUE),
    error = function(e) NA_real_)
  if (!is.finite(w)) w <- nchar(txt) * size * 0.55
  w * .FORM_WORD_NARROW_RATIO
}

# Relleno de la celda (3 pt por lado, `.form_word_table_base`) + 3 pt de holgura:
# el ancho se estima, no es la metrica exacta de Arial Narrow.
.FORM_WORD_CODIGO_PAD_PT <- 9

# `ancho_actual` en pulgadas (0.4 vertical / 0.28 horizontal). Devuelve
# list(width = pulgadas, size = pt).
.form_word_codigo_geom <- function(codes, ancho_actual, size = .FORM_WORD_SZ) {
  codes <- as.character(codes)
  codes <- codes[nzchar(codes)]
  out <- list(width = ancho_actual, size = size)
  if (!length(codes)) return(out)
  ancho_txt <- max(vapply(codes, .form_word_ancho_pt_negrita, numeric(1), size = size))
  necesita <- (ancho_txt + .FORM_WORD_CODIGO_PAD_PT) / 72
  if (necesita <= ancho_actual) return(out)
  tope <- 2 * ancho_actual
  if (necesita <= tope) {
    out$width <- necesita
    return(out)
  }
  out$width <- tope
  fs <- size * (tope * 72 - .FORM_WORD_CODIGO_PAD_PT) / ancho_txt
  # Medio punto hacia abajo (Word admite medios puntos: w:sz es en medios).
  out$size <- max(.FORM_CODIGO_PISO_PT, floor(fs * 2) / 2)
  out
}

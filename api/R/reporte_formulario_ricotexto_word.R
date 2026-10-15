# Tramos con formato en el Word (item 19 revisado y L15).
#
# Los tramos del modelo (`<campo>_rt`, reporte_formulario_ricotexto.R) se pintan
# como runs con `w:b`/`w:i`/`w:u` y los saltos como `w:br`, siempre en Arial
# Narrow. En un parrafo, con `officer::ftext` + `run_linebreak`; en una celda de
# tabla, con `flextable::as_chunk` (un "\n" en el chunk sale como `w:br`).
#
# `negrita_base`/`italic`: el peso del sitio. Donde todo va en negrita (bandas,
# enunciados) la negrita del HTML no cambia nada; la cursiva y el subrayado si.

.form_word_rt_props <- function(r, size, negrita_base, italic, color) {
  officer::fp_text(font.size = size + (r$s %||% 0),
                   bold = isTRUE(negrita_base) || isTRUE(r$b),
                   italic = isTRUE(italic) || isTRUE(r$i),
                   underlined = isTRUE(r$u),
                   color = color, font.family = .FORM_WORD_FONT)
}

# Funde tramos contiguos que en ESTE sitio se ven igual (con la negrita o la
# cursiva del sitio ya aplicadas): un enunciado en negrita con un `**sujeto**`
# sale en un solo run, como antes.
.form_word_rt_efectivos <- function(runs, negrita_base, italic) {
  out <- list()
  for (r in runs) {
    if (!.form_rt_es_br(r)) {
      r$b <- isTRUE(negrita_base) || isTRUE(r$b)
      r$i <- isTRUE(italic) || isTRUE(r$i)
    }
    n <- length(out)
    if (n && !.form_rt_es_br(r) && !.form_rt_es_br(out[[n]]) &&
        identical(out[[n]][c("b", "i", "u", "s")], r[c("b", "i", "u", "s")])) {
      out[[n]]$t <- paste0(out[[n]]$t, r$t)
    } else {
      out[[n + 1L]] <- r
    }
  }
  out
}

# Runs de un parrafo (`officer::fpar`).
.form_word_rt_ftext <- function(runs, size = .FORM_WORD_SZ, negrita_base = FALSE,
                                italic = FALSE, color = .FORM_WORD_INK) {
  runs <- .form_word_rt_efectivos(runs, negrita_base, italic)
  lapply(runs, function(r) {
    if (.form_rt_es_br(r)) return(officer::run_linebreak())
    officer::ftext(r$t, prop = .form_word_rt_props(r, size, negrita_base, italic, color))
  })
}

# Chunks de una celda (`flextable::as_paragraph`).
.form_word_rt_chunks <- function(runs, size = .FORM_WORD_SZ, negrita_base = FALSE,
                                 italic = FALSE, color = .FORM_WORD_INK) {
  base <- .form_rt_run("")
  runs <- .form_word_rt_efectivos(runs, negrita_base, italic)
  lapply(runs, function(r) {
    if (.form_rt_es_br(r)) {
      return(flextable::as_chunk("\n", props = .form_word_rt_props(base, size, negrita_base, italic, color)))
    }
    flextable::as_chunk(r$t, props = .form_word_rt_props(r, size, negrita_base, italic, color))
  })
}

# Tramos de un enunciado con su prefijo de numero («N.  »).
.form_word_rt_prefijo <- function(prefijo, runs) {
  if (nzchar(prefijo %||% "")) c(list(.form_rt_run(prefijo)), runs) else runs
}

# Tramos alineados a `texto` (el limpio que la funcion va a pintar), o un tramo
# plano si no casan: nunca otras palabras.
.form_word_rt_alinea <- function(rt, texto) {
  .form_rt_campo(list(x = texto, x_rt = rt), "x")
}

# Pista en la misma celda que el enunciado: salto + cursiva a cuerpo menor. Con
# tramos, los suyos (subrayado, negrita...); sin ellos, el chunk de siempre.
.form_word_hint_chunks <- function(hint, hint_rt = NULL) {
  hint <- .form_pdf_clean_text(hint %||% "")
  if (!nzchar(hint)) return(list())
  rt <- .form_word_rt_alinea(hint_rt, hint)
  if (.form_rt_tiene_formato(rt, base_i = TRUE)) {
    return(.form_word_rt_chunks(c(list(.FORM_RT_BR), rt), size = .FORM_WORD_SZ_MIN, italic = TRUE))
  }
  list(flextable::as_chunk(
    paste0("\n", hint),
    props = officer::fp_text(font.size = .FORM_WORD_SZ_MIN, italic = TRUE,
                             color = .FORM_WORD_INK, font.family = .FORM_WORD_FONT)))
}

# Etiquetas de categoria con formato (item 19): se componen por tramos en su
# celda. `cols` es la columna de cada opcion ("label" en la lista vertical, una
# por opcion en la fila horizontal). Solo las que traen formato: el resto queda
# como la escribio flextable, identica a la de antes.
.form_word_opciones_rt <- function(ft, opts, labels, cols) {
  for (k in seq_along(opts)) {
    rt <- .form_word_rt_alinea(opts[[k]]$label_rt, labels[k])
    if (!.form_rt_tiene_formato(rt)) next
    i <- if (length(cols) == 1L) k else 1L
    j <- if (length(cols) == 1L) cols else cols[k]
    ft <- flextable::compose(ft, i = i, j = j, part = "body",
                             value = do.call(flextable::as_paragraph, .form_word_rt_chunks(rt)))
  }
  ft
}

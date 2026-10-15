# L21 — la reserva de paginado de preguntas y bloques `paper` SIGUE AL DIBUJO
# (item 14 del checklist 2026-10-15). Mismo patron que L19 con las bandas
# (`.form_pdf_band_height`): una sola cuenta para el dibujo y para el paginado.
#
# Medido antes de este cambio con el fixture del contrato L19: `question/integer`
# reservaba un 29 % mas de lo que dibujaba y `paper` un 20 % mas. Las causas eran
# todas de «dos cuentas para lo mismo»:
#   - question: 0.04 de caja de campo reservada contra 0.025 dibujada; el
#     enunciado se envolvia SIN el prefijo «N.  » y a 56 caracteres en la
#     reserva, y CON prefijo y a 54 en el dibujo; la pista, a 56 contra 54; el
#     cierre, 0.016 contra 0.013; la condicion de apertura, a 56/118 caracteres
#     contra el ancho real de la columna (42 en una de dos); y el salto no
#     contaba los 0.006 que el dibujo le deja encima.
#   - paper: 0.042 fijos contra banda (`.form_pdf_band_height`) + 0.008 + cierre
#     0.012; el cuerpo a 126 caracteres contra 122; y la casilla de acuerdo del
#     consentimiento (0.032) no se reservaba en absoluto — la unica parte que se
#     quedaba CORTA.
#
# Ahora `.form_pdf_draw_question()` / `.form_pdf_draw_paper()` y
# `.form_pdf_block_height()` leen la geometria de estos helpers. Como envuelven
# con la MISMA funcion y el mismo ancho, ya no hace falta la holgura de 4 pt que
# L19 dejo «porque el envoltorio de la reserva se estima por caracteres y el del
# dibujo por ancho medido»: esa diferencia ya no existe.

# Condicion de apertura: lineas y alto, como los dibuja `.form_pdf_draw_opening`
# (texto a `w - 0.016`, envuelto a `floor((w - 0.012) * chars_factor)`, 0.005
# arriba, 0.0118 por linea y 0.004 abajo).
.form_pdf_opening_geom <- function(text, w, chars_factor = 112) {
  if (!nzchar(text %||% "")) return(list(cw = 0L, lines = character(0), h = 0))
  cw <- max(20L, floor((w - 0.012) * chars_factor))
  lines <- .form_pdf_wrap(text, cw)
  list(cw = cw, lines = lines,
       h = if (length(lines)) 0.005 + length(lines) * 0.0118 + 0.004 else 0)
}

.FORM_PDF_TIPOS_CAMPO <- c("text", "integer", "decimal", "date", "time", "datetime")

# Geometria de una pregunta (o nota) a ancho `w`, en el mismo orden en que la
# dibuja `.form_pdf_draw_question`.
.form_pdf_question_geom <- function(block, w) {
  full <- isTRUE(block$full_width)
  type <- block$type %||% ""
  chars_lbl <- if (full) 118 else 54
  chars_skip <- if (full) 112 else 48
  opening <- .form_pdf_opening_geom(block$opening_condition, w, if (full) 112 else 108)
  # El dibujo resta 0.002 tras la apertura aunque el texto envuelva a cero lineas.
  opening_h <- if (nzchar(block$opening_condition %||% "")) opening$h + 0.002 else 0
  is_note <- identical(type, "note")
  prefix <- if (!is_note && nzchar(block$number %||% "")) paste0(block$number, ".  ") else ""
  tiene_cuerpo <- !is_note &&
    (isTRUE(block$coded_list) ||
       type %in% c("select_one", "select_multiple", .FORM_PDF_TIPOS_CAMPO))
  lbl_lines <- .form_pdf_wrap(paste0(prefix, block$label), chars_lbl)
  hay_hint <- nzchar(block$hint %||% "")
  hint_lines <- if (hay_hint) .form_pdf_wrap(block$hint, chars_lbl) else character(0)
  # Item 19: con formato visible (cursiva, subrayado, saltos, encabezados) el
  # enunciado y la pista se componen por tramos al ancho real del recuadro; el
  # enunciado va en negrita, asi que su negrita del HTML no cuenta como formato.
  txt_w <- if (tiene_cuerpo) w - 0.022 else w - 0.012
  lbl_rt <- .form_rt_campo(block, "label")
  if (nzchar(prefix)) lbl_rt <- c(list(.form_rt_run(prefix)), lbl_rt)
  lbl_lay <- .form_pdf_rt_si(lbl_rt, txt_w, 8.4, 0.0142, base_b = TRUE)
  hint_lay <- if (hay_hint) .form_pdf_rt_si(.form_rt_campo(block, "hint"), txt_w, 7.3, 0.011, base_i = TRUE)
  lbl_alto <- if (is.null(lbl_lay)) length(lbl_lines) * 0.0142 else lbl_lay$alto
  hint_alto <- if (is.null(hint_lay)) length(hint_lines) * 0.011 else hint_lay$alto
  head_h <- if (tiene_cuerpo) {
    lbl_alto + hint_alto + 0.009
  } else {
    lbl_alto + (if (hay_hint) 0.002 + hint_alto else 0) + 0.007
  }
  cuerpo_h <- if (isTRUE(block$coded_list)) {
    0.034
  } else if (type %in% c("select_one", "select_multiple")) {
    opts <- block$options %||% list()
    if (!length(opts)) 0 else {
      w_opt <- w - 0.012
      cm <- .form_pdf_options_code_mark(opts, identical(type, "select_multiple"))
      if (.form_pdf_options_horizontal(opts, w_opt, cm$code_w)) {
        .FORM_PDF_OPCIONES_FILA_H
      } else {
        sum(vapply(opts, function(opt) .form_pdf_option_row_geom(opt, w_opt, cm$code_w, cm$mark_w, cm)$h,
                   numeric(1)))
      }
    }
  } else if (type %in% .FORM_PDF_TIPOS_CAMPO) {
    if (identical(type, "text")) 0.034 else 0.025
  } else if (is_note) {
    0
  } else {
    0.025
  }
  skip_lines <- if (nzchar(block$skip %||% "")) .form_pdf_wrap(block$skip, chars_skip) else character(0)
  skip_h <- if (nzchar(block$skip %||% "")) 0.006 + length(skip_lines) * 0.012 else 0
  list(chars_lbl = chars_lbl, chars_skip = chars_skip, opening = opening,
       prefix = prefix, tiene_cuerpo = tiene_cuerpo, lbl_lines = lbl_lines,
       hint_lines = hint_lines, lbl_lay = lbl_lay, hint_lay = hint_lay,
       lbl_alto = lbl_alto, hint_alto = hint_alto, txt_w = txt_w,
       head_h = head_h, cuerpo_h = cuerpo_h,
       h = opening_h + head_h + cuerpo_h + skip_h + 0.013)
}

# Geometria de un bloque `paper` (banda de titulo + cuerpo justificado + casilla
# de acuerdo del consentimiento), como la dibuja `.form_pdf_draw_paper`.
.form_pdf_paper_geom <- function(block, w = NULL) {
  hay_titulo <- nzchar(block$title %||% "")
  titulo_h <- if (hay_titulo) {
    bh <- .form_pdf_band_height(block$title, 118, rt = .form_rt_campo(block, "title"), w = w)
    if (bh > 0) bh + 0.008 else 0.008
  } else 0
  body_lines <- if (nzchar(block$body %||% "")) .form_pdf_wrap(block$body, 122) else character(0)
  body_lay <- if (length(body_lines) && !is.null(w))
    .form_pdf_rt_si(.form_rt_campo(block, "body"), w - 0.016, 8.1, 0.012)
  body_alto <- if (is.null(body_lay)) length(body_lines) * 0.012 else body_lay$alto
  acuerdo_h <- if (length(block$consent_options %||% list())) 0.010 + 0.016 + 0.006 else 0
  list(body_lines = body_lines, body_lay = body_lay,
       h = titulo_h + body_alto + acuerdo_h + 0.012)
}

# Titulo de la banda de seccion con su sufijo de repetible, como tramos.
.form_pdf_section_rt <- function(block) {
  suf <- .repeat_pdf_section_suffix(isTRUE(block$repeatable), block$repeat_count)
  rt <- .form_rt_campo(block, "title")
  if (nzchar(suf)) rt <- c(rt, list(.form_rt_run(suf)))
  rt
}

# Alto de la pista de una seccion (cursiva 7.5, 0.012 por linea).
.form_pdf_section_hint_alto <- function(block, w) {
  if (!nzchar(block$hint %||% "")) return(0)
  lay <- .form_pdf_rt_si(.form_rt_campo(block, "hint"), w - 0.016, 7.5, 0.012, base_i = TRUE)
  if (!is.null(lay)) return(lay$alto)
  .form_pdf_lines_height(.form_pdf_wrap(block$hint, 112), 0.012)
}

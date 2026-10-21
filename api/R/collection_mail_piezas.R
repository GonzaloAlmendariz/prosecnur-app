# collection_mail_piezas.R — «Biblioteca de piezas gráficas» del correo (E1o).
#
# Pedido: «que se pueda añadir otros elementos gráficos y poder editarlo tipo
# canva interactivo». Decisión: piezas del registro CERRADO de bloques, no un
# lienzo libre (Outlook y Gmail no respetan posiciones libres; ADR 0046 §11).
# Todas se exportan a Mailchimp y SurveyMonkey con tablas, bgcolor e imágenes:
# sin posiciones absolutas, sin SVG y sin CSS como única fuente del aspecto.
#
#   band       { color?: #rrggbb, height?: "s"|"m"|"l" }            banda a todo el ancho de la columna (8/16/32 px)
#   ornament   { style?: "onda"|"puntos"|"linea_doble", color?: #rrggbb }
#              onda: PNG generado (`.cmail_wave_png`, el de E1n) al ancho de la
#              columna de texto, trazo sobre fondo transparente; viaja en el ZIP
#              con ruta relativa. En SurveyMonkey, banda sólida de 4 px.
#   icon_text  { icon: uno de `.CMAIL_ICONS`, text }                  ícono PNG 48 × 48 + texto en una fila
#              En SurveyMonkey el ícono necesita URL https (template.images[id].url);
#              sin ella se omite y la revisión avisa (`icon_text_sm_icon`).
#   two_images { left, right, alt_left, alt_right }                   lado a lado; en teléfono (max-width:480px) se apilan
#   image      + `decorative: true`: alt vacío permitido solo ahí (collection_mail_template.R).
#
# Color por defecto de band, ornament e íconos: `pal$bar` (sobrio: el acento;
# campaña: el relleno del botón, porque el acento suele ser el fondo).
#
# **Regla de Gonzalo (2026-10-21): «Ten cuidado que los elementos no se vean
# deformes».** Ninguna imagen se estira: el ancho y el alto de cada <img> salen
# de la proporción real del archivo (`.cmail_fit`); si un tope recorta un lado,
# el otro se recalcula. Los íconos son cuadrados (48 × 48, se muestran a 24 en
# sobrio y 32 en campaña). La onda se genera al ancho de su columna con su alto
# propio; nunca se escala un PNG ajeno.

.CMAIL_BAND_PX <- c(s = 8L, m = 16L, l = 32L)
.CMAIL_ORNAMENT_STYLES <- c("onda", "puntos", "linea_doble")
# Literales: este archivo se carga antes que collection_mail_render.R (.CMAIL_WIDTH).
# Con `theme.width` (E1p) la columna de texto y el tope de two_images salen de
# `.cmail_text_col()` y `.cmail_pair_max_w()` (collection_mail_ajustes.R); estas
# son las de 600 px y el PNG de la onda se genera siempre a 2 × 504.
.CMAIL_TEXT_COL <- 504L                                       # 600 - 2 × 48 px
.CMAIL_PAIR_GAP <- 8L                                         # medio canal entre las dos imágenes
.CMAIL_PAIR_MAX_W <- 244L                                     # 504 / 2 - 8 px por imagen
.CMAIL_IMAGE_MAX_H <- 600L                                    # tope de alto de una imagen del cuerpo
.CMAIL_ORNAMENT_H <- 24L                                      # alto mostrado de la onda (PNG a 2x)
.CMAIL_ORNAMENT_SM_PX <- 4L
.CMAIL_STACK_CLASS <- "cmail-stack"

# ---- proporción ---------------------------------------------------------------

#' Medidas mostradas sin deformar: ancho `max_w`, alto por la proporción real;
#' si el alto pasa `max_h`, el alto es `max_h` y el ancho se recalcula.
#' @keywords internal
.cmail_fit <- function(size, max_w, max_h = .CMAIL_IMAGE_MAX_H) {
  r <- as.numeric(size$width) / as.numeric(size$height)
  w <- as.numeric(max_w); h <- w / r
  if (h > max_h) { h <- max_h; w <- h * r }
  list(width = max(1L, as.integer(round(w))), height = max(1L, as.integer(round(h))))
}

.cmail_size_ok <- function(size) {
  !is.null(size) && length(size$width) == 1L && length(size$height) == 1L &&
    isTRUE(size$width > 0) && isTRUE(size$height > 0)
}

# ---- validación ---------------------------------------------------------------

#' Problemas de las piezas gráficas (band, ornament, icon_text, two_images).
#' Los enums (`height`, `style`, `icon`) los valida `.cmail_style_problems`.
#' @keywords internal
.cmail_piezas_problems <- function(b, type, path, keys) {
  out <- list()
  push <- function(prop, code, detail) out[[length(out) + 1L]] <<- .cmail_problem(paste0(path, ".", prop), code, detail)
  if (type %in% c("band", "ornament") && !is.null(b$color) && !.cmail_hex_ok(.cmail_one(b$color))) {
    push("color", "bad_color", "color es #rrggbb.")
  }
  if (identical(type, "icon_text")) {
    if (is.null(b$icon)) push("icon", "missing_icon", sprintf("Elige un ícono: %s.", paste(.CMAIL_ICONS, collapse = ", ")))
    out <- c(out, .cmail_text_problems(b$text, paste0(path, ".text"), keys, required = TRUE))
  }
  if (identical(type, "two_images")) {
    for (side in c("left", "right")) {
      if (!.cmail_image_id_ok(.cmail_one(b[[side]]) %||% NA_character_)) {
        push(side, "bad_image_ref", "Cada imagen nombra un archivo del proyecto: a-z, 0-9 y guiones (sin _).")
      }
      out <- c(out, .cmail_alt_problems(b[[paste0("alt_", side)]], paste0(path, ".alt_", side)))
    }
  }
  out
}

# Alt obligatorio, texto plano y sin campos (image y two_images).
.cmail_alt_problems <- function(alt, path) {
  value <- .cmail_one(alt)
  if (is.null(value) || !nzchar(trimws(value))) {
    return(list(.cmail_problem(path, "missing_alt",
      "Toda imagen lleva texto alternativo: es lo que se lee con las imágenes bloqueadas.")))
  }
  out <- .cmail_text_problems(value, path, character(0))
  if (length(.cmail_tokens(value))) out <- c(out, list(.cmail_problem(path, "alt_has_field", "El texto alternativo no admite {{campos}}.")))
  out
}

# ---- imágenes generadas -----------------------------------------------------

.cmail_piece_color <- function(b, pal) tolower(.cmail_one(b$color) %||% pal$bar)
.cmail_hex6 <- function(color) sub("^#", "", tolower(color))
.cmail_icon_id <- function(icon, color) sprintf("icono-%s-%s", icon, .cmail_hex6(color))
.cmail_ornament_id <- function(color) sprintf("ornamento-onda-%s", .cmail_hex6(color))

#' PNG del ornamento «onda»: cinta ondulada de `color` sobre transparente, a 2x
#' del ancho de la columna de texto (1008 × 48, se muestra a 504 × 24).
#' @keywords internal
.cmail_ornament_png <- function(color) {
  dir <- file.path(tempdir(), "prosecnur-cmail-piezas")
  dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  path <- file.path(dir, sprintf("%s.png", .cmail_ornament_id(color)))
  if (file.exists(path)) return(path)
  w <- 2L * .CMAIL_TEXT_COL; h <- 2L * .CMAIL_ORNAMENT_H
  x <- (seq_len(w) - 0.5) / w
  edge <- 21 + 8 * sin(2 * pi * x * 3 + 0.9) + 1.5 * sin(2 * pi * x * 6.4)
  .cmail_wave_png(path, w, h, edge, color, bg = NULL, stroke = 6)
}

.cmail_generated_image <- function(id, path, url = NULL) {
  info <- .cmail_image_info(path)
  list(id = id, path = path, type = "png", size = list(width = info$width, height = info$height),
       bytes = as.numeric(file.info(path)$size), url = url, alt = "",
       export_name = paste0(id, ".png"), generated = TRUE)
}

# URL https declarada para una imagen generada (`template.images[id].url`): la
# que usa SurveyMonkey para mostrar un ícono.
.cmail_declared_url <- function(template, id) {
  u <- .cmail_one(((template$images %||% list())[[id]] %||% list())$url)
  if (!is.null(u) && grepl("^https://", u)) u else NULL
}

#' Imágenes generadas por las piezas (íconos y ondas de ornamento), por id.
#' @keywords internal
.cmail_piezas_images <- function(template) {
  pal <- .cmail_theme_palette(template, .cmail_one(template$theme$accent) %||% .CMAIL_DEFAULT_ACCENT, NULL)
  out <- list()
  for (b in template$blocks %||% list()) {
    type <- .cmail_one(b$type) %||% ""
    if (identical(type, "icon_text")) {
      icon <- .cmail_one(b$icon)
      if (is.null(icon) || !(icon %in% .CMAIL_ICONS)) next
      id <- .cmail_icon_id(icon, pal$bar)
      if (is.null(out[[id]])) out[[id]] <- .cmail_generated_image(id, .cmail_icon_png(icon, pal$bar), .cmail_declared_url(template, id))
    } else if (identical(type, "ornament") && identical(.cmail_style(b, "style", "onda"), "onda")) {
      color <- .cmail_piece_color(b, pal)
      if (!.cmail_hex_ok(color)) next
      id <- .cmail_ornament_id(color)
      if (is.null(out[[id]])) out[[id]] <- .cmail_generated_image(id, .cmail_ornament_png(color))
    }
  }
  out
}

# Imagen generada desde el contexto (la resuelta, o se genera si el render se
# llamó sin resolver las imágenes).
.cmail_ctx_generated <- function(ctx, id, make) {
  ctx$images[[id]] %||% .cmail_generated_image(id, make())
}

# ---- render -------------------------------------------------------------------

.cmail_px_row <- function(color, px) {
  sprintf('<tr><td bgcolor="%s" style="background-color:%s;height:%dpx;line-height:%dpx;font-size:0;mso-line-height-rule:exactly;">&nbsp;</td></tr>',
          color, color, px, px)
}

.cmail_block_band <- function(b, ctx) {
  .cmail_px_row(.cmail_piece_color(b, ctx$pal), .CMAIL_BAND_PX[[.cmail_style(b, "height", "m")]])
}

.cmail_column_table <- function(rows, padding = "14px 48px 14px 48px", align = NULL) {
  sprintf('<tr><td%s class="cmail-pad" style="padding:%s;"><table role="presentation" %scellpadding="0" cellspacing="0" border="0"%s>%s</table></td></tr>',
          if (is.null(align)) "" else sprintf(' align="%s"', align), padding,
          if (is.null(align)) 'width="100%" ' else "", if (is.null(align)) "" else sprintf(' align="%s"', align), rows)
}

.cmail_block_ornament <- function(b, ctx) {
  color <- .cmail_piece_color(b, ctx$pal)
  style <- .cmail_style(b, "style", "onda")
  if (identical(style, "linea_doble")) {
    return(.cmail_column_table(paste0(.cmail_px_row(color, 1L),
                                      '<tr><td style="height:3px;line-height:3px;font-size:0;">&nbsp;</td></tr>',
                                      .cmail_px_row(color, 1L))))
  }
  if (identical(style, "puntos")) {
    dot <- sprintf('<td width="8" bgcolor="%s" style="width:8px;height:8px;line-height:8px;font-size:0;background-color:%s;border-radius:4px;">&nbsp;</td>', color, color)
    gap <- '<td width="12" style="width:12px;font-size:0;line-height:8px;">&nbsp;</td>'
    return(.cmail_column_table(sprintf("<tr>%s</tr>", paste(c(dot, gap, dot, gap, dot), collapse = "")),
                               padding = "16px 48px 16px 48px", align = "center"))
  }
  # Onda: imagen en Mailchimp y en la vista previa; banda sólida en SurveyMonkey.
  if (identical(ctx$dialect, "surveymonkey") && isTRUE(ctx$export)) {
    return(.cmail_column_table(.cmail_px_row(color, .CMAIL_ORNAMENT_SM_PX), padding = "24px 48px 24px 48px"))
  }
  img <- .cmail_ctx_generated(ctx, .cmail_ornament_id(color), function() .cmail_ornament_png(color))
  fit <- .cmail_fit(img$size, .cmail_text_col(ctx$width %||% .CMAIL_WIDTH))
  sprintf('<tr><td class="cmail-pad" style="padding:12px 48px 12px 48px;line-height:0;font-size:0;"><img src="%s" width="%d" height="%d" alt="" style="display:block;width:100%%;max-width:%dpx;height:auto;border:0;outline:none;text-decoration:none;"></td></tr>',
          .cmail_esc(.cmail_image_src(img, ctx)), fit$width, fit$height, fit$width)
}

.cmail_block_icon_text <- function(b, ctx) {
  pal <- ctx$pal
  icon <- .cmail_one(b$icon) %||% "info"
  px <- if (isTRUE(pal$campana)) 32L else 24L
  text_pad <- max(0L, (px - 26L) %/% 2L)
  img <- .cmail_ctx_generated(ctx, .cmail_icon_id(icon, pal$bar), function() .cmail_icon_png(icon, pal$bar))
  src <- .cmail_image_src(img, ctx)
  text <- sprintf('<td valign="top" style="padding-top:%dpx;font-family:%s;font-size:16px;line-height:26px;color:%s;text-align:left;vertical-align:top;"><p style="margin:0;"%s>%s</p></td>',
                  text_pad, .CMAIL_FONT, pal$text, .cmail_prop(ctx, "text"), .cmail_inline(b$text, ctx, links = TRUE))
  # SurveyMonkey sin URL del ícono: se omite (la revisión avisa); el texto queda.
  icon_cell <- if (is.null(src) || !nzchar(src)) "" else sprintf(
    '<td width="%d" valign="top" style="width:%dpx;padding:%dpx 14px 0 0;vertical-align:top;"><img src="%s" width="%d" height="%d" alt="" style="display:block;width:%dpx;height:%dpx;border:0;outline:none;text-decoration:none;"></td>',
    px + 14L, px, max(0L, (26L - px) %/% 2L), .cmail_esc(src), px, px, px, px)
  .cmail_column_table(sprintf("<tr>%s%s</tr>", icon_cell, text), padding = "4px 48px 14px 48px")
}

# Una celda de two_images: la imagen a lo más 244 px de ancho con 600 (224 con
# 560, 264 con 640) y nunca más ancha que su archivo, alto por su proporción;
# tope de alto recalcula el ancho.
.cmail_pair_cell <- function(id, alt, ctx, side) {
  img <- ctx$images[[id]] %||% .cmail_image_placeholder(id)
  size <- if (.cmail_size_ok(img$size)) img$size else list(width = 3, height = 2)
  width <- ctx$width %||% .CMAIL_WIDTH
  pair_max <- .cmail_pair_max_w(width)
  max_w <- if (.cmail_size_ok(img$size)) min(pair_max, as.integer(img$size$width)) else pair_max
  fit <- .cmail_fit(size, max_w)
  src <- .cmail_image_src(img, ctx)
  tag <- if (is.null(src)) {
    sprintf('<span style="display:inline-block;width:%dpx;max-width:100%%;height:%dpx;line-height:%dpx;border:1px dashed #9aa3b5;font-family:%s;font-size:11px;color:#5a6a94;text-align:center;overflow:hidden;">%s</span>',
            fit$width, fit$height, fit$height, .CMAIL_FONT, .cmail_esc(if (nzchar(alt)) alt else id))
  } else {
    sprintf('<img src="%s" width="%d" height="%d" alt="%s"%s style="display:block;width:%dpx;max-width:100%%;height:auto;margin:0 auto;border:0;outline:none;text-decoration:none;">',
            .cmail_esc(src), fit$width, fit$height, .cmail_esc(alt), .cmail_prop(ctx, paste0("alt_", side)), fit$width)
  }
  pad <- if (identical(side, "left")) sprintf("0 %dpx 0 0", .CMAIL_PAIR_GAP) else sprintf("0 0 0 %dpx", .CMAIL_PAIR_GAP)
  sprintf('<td class="%s" width="%d" valign="top" align="center" style="width:50%%;padding:%s;vertical-align:top;">%s</td>',
          .CMAIL_STACK_CLASS, .cmail_text_col(width) %/% 2L, pad, tag)
}

.cmail_block_two_images <- function(b, ctx) {
  cells <- c(
    .cmail_pair_cell(as.character(.cmail_one(b$left) %||% ""), .cmail_one(b$alt_left) %||% "", ctx, "left"),
    .cmail_pair_cell(as.character(.cmail_one(b$right) %||% ""), .cmail_one(b$alt_right) %||% "", ctx, "right")
  )
  .cmail_column_table(sprintf("<tr>%s</tr>", paste(cells, collapse = "")), padding = "6px 48px 18px 48px")
}

#' Medidas mostradas de las imágenes de un two_images (para la nitidez).
#' @keywords internal
.cmail_pair_shown_width <- function(img, width = .CMAIL_WIDTH) {
  if (!.cmail_size_ok(img$size)) return(NULL)
  .cmail_fit(img$size, min(.cmail_pair_max_w(width), as.integer(img$size$width)))$width
}

# Regla del `<head>`: solo si el cuerpo trae celdas apilables.
.cmail_stack_style <- function(body) {
  if (!grepl(sprintf('class="%s"', .CMAIL_STACK_CLASS), body, fixed = TRUE)) return("")
  sprintf('<style type="text/css">@media only screen and (max-width:480px){.%s{display:block !important;width:100%% !important;max-width:100%% !important;padding:0 0 12px 0 !important;}}</style>',
          .CMAIL_STACK_CLASS)
}

# ---- revisión -----------------------------------------------------------------

#' Chequeos de las piezas (solo si la plantilla trae alguna):
#' `piezas_contrast` (warning si una pieza casi no se distingue del fondo:
#' bandas y ornamentos < 1,5:1, íconos < 3:1) e `icon_text_sm_icon` (warning en
#' SurveyMonkey: íconos sin URL https se omiten).
#' @keywords internal
.cmail_piezas_checks <- function(tpl, images, push, dialect = .CMAIL_PLATFORM_DEFAULT) {
  types <- c("band", "ornament", "icon_text")
  pieces <- Filter(function(b) (.cmail_one(b$type) %||% "") %in% types, tpl$blocks %||% list())
  if (!length(pieces)) return(push)
  pal <- .cmail_theme_palette(tpl, .cmail_one(tpl$theme$accent) %||% .CMAIL_DEFAULT_ACCENT, NULL)
  bg <- if (isTRUE(pal$campana)) pal$page_bg else "#ffffff"
  fmt <- function(x) formatC(x, format = "f", digits = 2, decimal.mark = ",")
  faint <- list()
  for (b in pieces) {
    icon <- identical(b$type, "icon_text")
    color <- if (icon) pal$bar else .cmail_piece_color(b, pal)
    if (!.cmail_hex_ok(color)) next
    ratio <- round(.cmail_contrast(color, bg), 2)
    if (ratio < (if (icon) .CMAIL_CONTRAST_UI else 1.5)) {
      faint[[length(faint) + 1L]] <- list(block_id = as.character(b$block_id), color = color, ratio = ratio)
    }
  }
  push(if (length(faint)) {
    .cmail_check("piezas_contrast", "warning", length(faint),
                 sprintf("%d pieza(s) gráfica(s) casi no se distinguen del fondo %s (la menor, %s:1). Elige un color que resalte.",
                         length(faint), bg, fmt(min(vapply(faint, `[[`, 0, "ratio")))),
                 extra = faint, targets = lapply(faint, function(f) .cmail_target(f$block_id, "color")))
  } else {
    .cmail_check("piezas_contrast", "ok", 0L, "Las piezas gráficas se distinguen del fondo.")
  })
  if (identical(dialect, "surveymonkey")) {
    icons <- Filter(function(b) identical(b$type, "icon_text"), pieces)
    sin_url <- Filter(function(b) {
      icon <- .cmail_one(b$icon) %||% ""
      is.null(.cmail_declared_url(tpl, .cmail_icon_id(icon, pal$bar)))
    }, icons)
    if (length(sin_url)) {
      push(.cmail_check("icon_text_sm_icon", "warning", length(sin_url),
                        "SurveyMonkey no aloja imágenes del HTML personalizado: los íconos sin URL https se omiten y el texto sale solo.",
                        targets = lapply(sin_url, function(b) .cmail_target(as.character(b$block_id), "icon"))))
    }
  }
  push
}

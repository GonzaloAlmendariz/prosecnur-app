# collection_mail_destacado.R — la sección «Destacado con imagen» (`feature`;
# GOAL editor de correos profesional, L5; maqueta aprobada SecDestacado).
#
#   feature { eyebrow?, title, text?, image_ref?, alt?, button_text?, url?, layout?, box? }
#
# Un antetítulo, un título, un texto y un botón opcionales junto a una foto. La
# forma (`layout`) es cerrada: la imagen a la izquierda, a la derecha o arriba.
# Sin `image_ref` la sección sale sin imagen (nunca deja un hueco). Con imagen,
# el texto alternativo es obligatorio.
#
# **La imagen nunca se deforma.** Se muestra a su proporción real, a lo más
# del ancho de su ranura (216 px de lado con 600 de columna, toda la columna de
# texto arriba) y nunca más ancha que la mitad de su archivo si eso la dejaría
# borrosa: la revisión lo avisa (`image_width`). El recorte a una proporción
# fija llega con L7.
#
# **Teléfono.** Las dos columnas llevan la clase apilable de two_images
# (`.CMAIL_STACK_CLASS`): bajo 480 px se ponen una debajo de otra, la imagen
# siempre arriba y a todo el ancho (`.CMAIL_FEATURE_IMG_CLASS`). Con la imagen
# a la derecha, la celda de la imagen va primero en el HTML y la fila se dibuja
# de derecha a izquierda (`dir="rtl"`, cada celda vuelve a `ltr`): así, al
# apilarse, la imagen también sube.

.CMAIL_FEATURE_LAYOUTS <- c("izquierda", "derecha", "arriba")
.CMAIL_FEATURE_GAP <- 24L
.CMAIL_FEATURE_IMG_CLASS <- "cmail-feature-img"

# Ancho de la ranura de la imagen: 3/7 de la columna de texto a un lado (216 con
# 600), la columna entera arriba (504 con 600).
.cmail_feature_slot <- function(layout, width = .CMAIL_WIDTH) {
  col <- .cmail_text_col(width %||% .CMAIL_WIDTH)
  if (identical(layout, "arriba")) col else as.integer(round(col * 3 / 7))
}

# Ancho mostrado de la imagen: el de la ranura, sin pasar el natural del archivo.
.cmail_feature_shown <- function(b, img, width = .CMAIL_WIDTH) {
  slot <- .cmail_feature_slot(.cmail_style(b, "layout", "izquierda"), width)
  if (!.cmail_size_ok(img$size)) return(slot)
  as.integer(min(slot, as.integer(img$size$width)))
}

# ---- validación ---------------------------------------------------------------

#' Problemas de un Destacado: título obligatorio, imagen opcional con su alt,
#' botón con su dirección. El enum `layout` lo valida `.cmail_style_problems`.
#' @keywords internal
.cmail_feature_problems <- function(b, path, keys) {
  out <- list()
  add <- function(x) out <<- c(out, x)
  push <- function(prop, code, detail) out[[length(out) + 1L]] <<- .cmail_problem(paste0(path, ".", prop), code, detail)
  add(.cmail_text_problems(b$title, paste0(path, ".title"), keys, required = TRUE))
  add(.cmail_text_problems(b$eyebrow, paste0(path, ".eyebrow"), keys))
  add(.cmail_text_problems(b$text, paste0(path, ".text"), keys))
  if (!is.null(b$image_ref)) {
    if (!.cmail_image_id_ok(.cmail_one(b$image_ref) %||% NA_character_)) {
      push("image_ref", "bad_image_ref", "La imagen nombra un archivo del proyecto: a-z, 0-9 y guiones (sin _).")
    }
    add(.cmail_alt_problems(b$alt, paste0(path, ".alt")))
  }
  button <- .cmail_one(b$button_text)
  if (!is.null(button) && nzchar(trimws(button))) {
    add(.cmail_text_problems(button, paste0(path, ".button_text"), keys))
    add(.cmail_url_problems(b$url, paste0(path, ".url"), keys))
  } else if (!is.null(b$url)) {
    push("button_text", "missing_button_text", "Un enlace necesita el texto de su botón.")
  }
  out
}

# ---- render -------------------------------------------------------------------

.cmail_feature_image <- function(b, ctx, slot) {
  id <- as.character(.cmail_one(b$image_ref) %||% "")
  img <- ctx$images[[id]] %||% .cmail_image_placeholder(id)
  alt <- .cmail_one(b$alt) %||% ""
  size <- if (.cmail_size_ok(img$size)) img$size else list(width = 1, height = 1)
  fit <- .cmail_fit(size, .cmail_feature_shown(b, img, ctx$width))
  src <- .cmail_image_src(img, ctx)
  if (is.null(src)) {
    return(.cmail_preview_hole(fit$width, fit$height, if (nzchar(alt)) alt else id, margin = ""))
  }
  # En teléfono llena el ancho sólo si su archivo da para eso: nunca se agranda una foto chica.
  llena <- !.cmail_size_ok(img$size) || as.integer(img$size$width) >= .cmail_text_col(ctx$width %||% .CMAIL_WIDTH)
  sprintf('<img src="%s" width="%d" height="%d" alt="%s"%s%s style="display:block;width:%dpx;max-width:100%%;height:auto;border:0;outline:none;text-decoration:none;border-radius:8px;">',
          .cmail_esc(src), fit$width, fit$height, .cmail_esc(alt), .cmail_prop(ctx, "alt"),
          if (llena) sprintf(' class="%s"', .CMAIL_FEATURE_IMG_CLASS) else "", fit$width)
}

# El botón dentro de la columna de texto: el mismo de siempre (sólido, el del
# tema), sin su fila propia.
.cmail_feature_button <- function(b, ctx) {
  text <- .cmail_one(b$button_text)
  if (is.null(text) || !nzchar(trimws(text))) return("")
  pal <- ctx$pal
  sprintf(paste0(
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;"><tr>',
    '<td align="center" bgcolor="%s" style="background-color:%s;border-radius:%s;mso-padding-alt:12px 22px;">',
    '<a href="%s" target="_blank"%s style="display:inline-block;padding:12px 22px;border:1px solid %s;border-radius:%s;',
    'font-family:%s;font-size:15px;line-height:20px;font-weight:bold;color:%s;text-decoration:none;">%s</a>',
    '</td></tr></table>'
  ), pal$button_bg, pal$button_bg, pal$button_radius, .cmail_url(b$url, ctx), .cmail_prop(ctx, "button_text"),
  pal$button_bg, pal$button_radius, .CMAIL_FONT, pal$button_fg, .cmail_inline(text, ctx))
}

.cmail_feature_text <- function(b, ctx) {
  pal <- ctx$pal
  eyebrow <- .cmail_one(b$eyebrow)
  text <- .cmail_one(b$text)
  paste0(
    if (!is.null(eyebrow) && nzchar(trimws(eyebrow))) sprintf(
      '<p style="margin:0 0 8px 0;font-family:%s;font-size:12px;line-height:16px;letter-spacing:1.4px;text-transform:uppercase;font-weight:bold;color:%s;"%s>%s</p>',
      .CMAIL_FONT, pal$callout_title, .cmail_prop(ctx, "eyebrow"), .cmail_inline(eyebrow, ctx)) else "",
    # El título en el color de los títulos de recuadro: el acento en Sobrio (o la tinta si no se lee).
    sprintf('<p style="margin:0 0 10px 0;font-family:%s;font-size:22px;line-height:28px;font-weight:bold;color:%s;"%s>%s</p>',
            .CMAIL_FONT, pal$callout_title, .cmail_prop(ctx, "title"), .cmail_inline(b$title, ctx)),
    if (!is.null(text) && nzchar(trimws(text))) sprintf(
      '<p style="margin:0 0 12px 0;font-family:%s;font-size:15px;line-height:23px;color:%s;"%s>%s</p>',
      .CMAIL_FONT, pal$text, .cmail_prop(ctx, "text"), .cmail_inline(text, ctx, links = TRUE)) else "",
    .cmail_feature_button(b, ctx)
  )
}

.cmail_block_feature <- function(b, ctx) {
  layout <- .cmail_style(b, "layout", "izquierda")
  width <- ctx$width %||% .CMAIL_WIDTH
  has_image <- !is.null(.cmail_one(b$image_ref)) && nzchar(.cmail_one(b$image_ref))
  text <- .cmail_feature_text(b, ctx)
  if (!has_image) {
    return(.cmail_column_table(sprintf('<tr><td style="vertical-align:top;">%s</td></tr>', text),
                               padding = "8px 48px 20px 48px"))
  }
  slot <- .cmail_feature_slot(layout, width)
  image <- .cmail_feature_image(b, ctx, slot)
  if (identical(layout, "arriba")) {
    return(.cmail_column_table(sprintf('<tr><td style="padding:0 0 18px 0;line-height:0;font-size:0;">%s</td></tr><tr><td style="vertical-align:top;">%s</td></tr>',
                                       image, text), padding = "8px 48px 20px 48px"))
  }
  gap <- .CMAIL_FEATURE_GAP
  derecha <- identical(layout, "derecha")
  img_cell <- sprintf('<td class="%s" dir="ltr" width="%d" valign="middle" style="width:%dpx;padding:%s;vertical-align:middle;line-height:0;font-size:0;">%s</td>',
                      .CMAIL_STACK_CLASS, slot, slot,
                      if (derecha) sprintf("0 0 0 %dpx", gap) else sprintf("0 %dpx 0 0", gap), image)
  text_cell <- sprintf('<td class="%s" dir="ltr" valign="middle" style="vertical-align:middle;text-align:left;">%s</td>', .CMAIL_STACK_CLASS, text)
  # La imagen siempre primero en el HTML; a la derecha, la fila va de derecha a izquierda.
  row <- sprintf('<tr><td><table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0"%s><tr>%s%s</tr></table></td></tr>',
                 if (derecha) ' dir="rtl"' else "", img_cell, text_cell)
  .cmail_column_table(row, padding = "8px 48px 20px 48px")
}

# Regla del `<head>`: la imagen del Destacado a todo el ancho en teléfono, sólo
# si el cuerpo trae alguna.
.cmail_feature_style <- function(body) {
  if (!grepl(sprintf('class="%s"', .CMAIL_FEATURE_IMG_CLASS), body, fixed = TRUE)) return("")
  sprintf('<style type="text/css">@media only screen and (max-width:480px){.%s{width:100%% !important;height:auto !important;}}</style>',
          .CMAIL_FEATURE_IMG_CLASS)
}

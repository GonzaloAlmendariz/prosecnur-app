# collection_mail_blocks.R — HTML de cada bloque del correo
# (`collection_mail_template/v2`, ADR 0110 §2 y E1g §1/§B).
#
# Cada renderizador devuelve una o más filas `<tr>` de la columna (`ctx$width`,
# 600 px por defecto; collection_mail_ajustes.R). Las celdas con margen lateral
# de 48 px llevan la clase `cmail-pad`, que en teléfono lo baja a 20 px.
# Los estilos salen SOLO de las enumeraciones de collection_mail_styles.R:
# nunca se copia CSS del autor. En preview, la primera fila del bloque lleva
# `data-pulso-block`/`data-pulso-type` y cada texto su `data-pulso-prop`
# (`.cmail_mark_row`, `.cmail_prop`); en export no sale ninguna marca.

.cmail_text_td <- function(inner, padding = "0 48px 18px 48px", align = "left", size = 16L, line = 26L,
                           color = .CMAIL_TEXT_COLOR) {
  a <- .cmail_align_css(align)
  sprintf(
    '<tr><td%s style="padding:%s;font-family:%s;font-size:%dpx;line-height:%dpx;color:%s;%s">%s</td></tr>',
    .cmail_class_attr(a$cls, .CMAIL_PAD_CLASS), padding, .CMAIL_FONT, as.integer(size), as.integer(line), color, a$css, inner
  )
}

# Lista de textos con su prop indexada (desde 0) para las marcas.
.cmail_items_html <- function(items, ctx, prop, links, wrap) {
  items <- unlist(items %||% list(), use.names = FALSE)
  vapply(seq_along(items), function(i) {
    sprintf(wrap, .cmail_prop(ctx, sprintf("%s.%d", prop, i - 1L)), .cmail_inline(items[[i]], ctx, links = links))
  }, "")
}

.cmail_block_paragraph <- function(b, ctx) {
  # Tamaño y tono: collection_mail_styles.R (el acento cae al texto si no se lee).
  px <- .cmail_paragraph_size(b)
  # La apertura de un envío (E1k) es un párrafo cuyo valor vive en `send.opening`.
  prop <- if (identical(b$block_id, .CMAIL_OPENING_ID)) "opening" else "text"
  .cmail_text_td(
    sprintf('<p style="margin:0;"%s>%s</p>', .cmail_prop(ctx, prop), .cmail_inline(b$text, ctx, links = TRUE)),
    # Sin `align` propio, el del tema (justificado por defecto, collection_mail_campana.R).
    align = .cmail_style(b, "align", ctx$pal$text_align),
    size = px[[1]], line = px[[2]],
    color = .cmail_paragraph_color(b, ctx)
  )
}

.cmail_block_heading <- function(b, ctx) {
  title <- identical(.cmail_style(b, "level", "titulo"), "titulo")
  .cmail_text_td(
    sprintf('<p style="margin:0;font-weight:bold;"%s>%s</p>', .cmail_prop(ctx, "text"), .cmail_inline(b$text, ctx)),
    padding = if (title) "14px 48px 12px 48px" else "8px 48px 10px 48px",
    align = .cmail_style(b, "align", ctx$pal$heading_align),
    size = if (title) 22L else 17L, line = if (title) 28L else 24L, color = ctx$pal$text
  )
}

.CMAIL_DIVIDER_PX <- c(s = 8L, m = 16L, l = 32L)

.cmail_block_divider <- function(b, ctx) {
  px <- .CMAIL_DIVIDER_PX[[.cmail_style(b, "size", "m")]]
  if (identical(.cmail_style(b, "style", "linea"), "espacio")) {
    return(sprintf('<tr><td style="height:%dpx;line-height:%dpx;font-size:0;">&nbsp;</td></tr>', px * 2L, px * 2L))
  }
  sprintf(paste0(
    '<tr><td class="%s" style="padding:%dpx 48px %dpx 48px;"><table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0">',
    '<tr><td style="height:1px;line-height:1px;font-size:0;background-color:%s;">&nbsp;</td></tr></table></td></tr>'
  ), .CMAIL_PAD_CLASS, px, px, ctx$pal$border)
}

.CMAIL_BUTTON_PAD <- list(compacto = c(10L, 26L, 14L), normal = c(15L, 40L, 16L), grande = c(18L, 52L, 17L))

.cmail_block_button <- function(b, ctx) {
  pal <- ctx$pal
  pad <- .CMAIL_BUTTON_PAD[[.cmail_style(b, "size", "normal")]]
  outline <- identical(.cmail_style(b, "fill", "solido"), "contorno")
  align <- .cmail_style(b, "align", "center")
  # Sobrio: el acento con texto blanco; campaña: el relleno del tema, píldora.
  bg <- if (outline) pal$outline_bg else pal$button_bg
  fg <- if (outline) pal$outline_fg else pal$button_fg
  border <- if (outline) pal$outline_border else pal$button_bg
  radius <- pal$button_radius
  note <- unlist(b$note %||% list(), use.names = FALSE)
  note_html <- if (length(note)) sprintf(
    '<p style="margin:12px 0 0 0;font-family:%s;font-size:13px;line-height:20px;color:%s;text-align:%s;">%s</p>',
    .CMAIL_FONT, pal$muted, align,
    paste(.cmail_items_html(note, ctx, "note", FALSE, "<span%s>%s</span>"), collapse = "<br>")
  ) else ""
  sprintf(paste0(
    '<tr><td align="%s" class="%s" style="padding:14px 48px 30px 48px;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="%s"><tr>',
    '<td align="center" bgcolor="%s" style="background-color:%s;border-radius:%s;mso-padding-alt:%dpx %dpx;">',
    '<a href="%s" target="_blank"%s style="display:inline-block;padding:%dpx %dpx;border:%s solid %s;border-radius:%s;',
    'font-family:%s;font-size:%dpx;line-height:20px;font-weight:bold;letter-spacing:0.2px;color:%s;text-decoration:none;">%s</a>',
    '</td></tr></table>%s</td></tr>'
  ), align, .CMAIL_PAD_CLASS, align, bg, bg, radius, pad[[1]], pad[[2]], .cmail_url(b$url, ctx), .cmail_prop(ctx, "text"),
  pad[[1]], pad[[2]], if (outline) "2px" else "1px", border, radius, .CMAIL_FONT, pad[[3]], fg,
  .cmail_inline(b$text, ctx), note_html)
}

.cmail_block_callout <- function(b, ctx) {
  title <- .cmail_one(b$title)
  variant <- .cmail_style(b, "variant", "box")
  pal <- ctx$pal
  # El recuadro justifica como los párrafos (sin `align` propio).
  al <- .cmail_align_css(pal$list_align)
  al$cell <- if (identical(pal$list_align, "justify")) al$css else ""
  title_html <- function(wrap) {
    if (is.null(title)) return(character(0))
    sprintf(wrap, .cmail_prop(ctx, "title"), .cmail_inline(title, ctx, links = TRUE))
  }
  if (variant %in% c("bar", "tinte")) {
    inner <- paste(c(
      title_html("<strong%s>%s</strong>"),
      .cmail_items_html(b$items, ctx, "items", TRUE, "<span%s>%s</span>")
    ), collapse = "<br>")
    bar <- identical(variant, "bar")
    panel <- if (bar) pal$panel_bar else pal$panel_tint
    return(sprintf(paste0(
      '<tr><td class="%s" style="padding:0 46px %dpx 46px;"><table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0">',
      '<tr><td%s bgcolor="%s" style="padding:%s;%sbackground-color:%s;font-family:%s;font-size:15px;line-height:23px;color:%s;%s">%s</td></tr>',
      '</table></td></tr>'
    ), .CMAIL_PAD_CLASS, if (bar) 12L else 18L, al$attr, panel,
    if (bar) "14px 18px" else "18px 22px",
    if (bar) sprintf("border-left:3px solid %s;", pal$bar) else "",
    panel, .CMAIL_FONT, pal$text, al$cell, inner))
  }
  # Panel tintado con barra de acento y título en versalitas pequeñas: se lee
  # como un aviso, no como una tabla (revamp 2026-10-21).
  lis <- paste(.cmail_items_html(b$items, ctx, "items", TRUE, '<li style="margin:0 0 8px 0;"%s>%s</li>'), collapse = "")
  sprintf(paste0(
    '<tr><td class="%s" style="padding:4px 48px 24px 48px;"><table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0">',
    '<tr><td%s bgcolor="%s" style="background-color:%s;border-left:3px solid %s;border-radius:0 6px 6px 0;padding:18px 24px 10px 22px;font-family:%s;font-size:15px;line-height:23px;color:%s;%s">',
    '%s<ul style="margin:0 0 8px 0;padding-left:20px;">%s</ul></td></tr></table></td></tr>'
  ), .CMAIL_PAD_CLASS, al$attr, pal$panel_box, pal$panel_box, pal$bar, .CMAIL_FONT, pal$text, al$cell,
  paste(title_html(sprintf('<p style="margin:0 0 10px 0;font-size:12px;line-height:16px;letter-spacing:1px;text-transform:uppercase;color:%s;"><strong%%s>%%s</strong></p>', pal$callout_title)), collapse = ""), lis)
}

.cmail_block_image <- function(b, ctx) {
  id <- as.character(.cmail_one(b$image_ref) %||% "")
  img <- ctx$images[[id]] %||% .cmail_image_placeholder(id)
  bleed <- isTRUE(unlist(b$bleed))
  width <- .cmail_image_width(b, img, ctx$width)
  align <- .cmail_style(b, "align", "center")
  # Decorativa (E1o): alt vacío, aunque el bloque conserve uno.
  alt <- if (isTRUE(unlist(b$decorative))) "" else .cmail_one(b$alt) %||% ""
  src <- .cmail_image_src(img, ctx)
  # Tope de alto (E1o, «nada se deforma»): una imagen muy alta baja su ancho y
  # declara los dos lados por su proporción real; sin tope, height:auto basta
  # (y el HTML de siempre no cambia).
  capped <- .cmail_image_capped(b, img, ctx$width)
  margin <- switch(align, center = "margin:0 auto;", right = "margin:0 0 0 auto;", "")
  tag <- if (is.null(src)) {
    # Hueco de preview (collection_mail_render.R): cede en teléfono y conserva su proporción.
    .cmail_preview_hole(width, max(40L, as.integer(round(width / 2))), if (nzchar(alt)) alt else id, margin)
  } else {
    # A sangre llena la tarjeta (width:100%), como el banner de cabecera: con
    # un ancho fijo el editor de Mailchimp, que dibuja la tarjeta más ancha,
    # dejaba una franja blanca. width="600" (el de la columna) sigue fijándolo en Outlook.
    if (bleed) {
      sprintf('<img src="%s" width="%d" alt="%s" style="display:block;width:100%%;height:auto;border:0;outline:none;text-decoration:none;">',
              .cmail_esc(src), width, .cmail_esc(alt))
    } else if (!is.null(capped)) {
      sprintf('<img src="%s" width="%d" height="%d" alt="%s" style="display:block;width:%dpx;max-width:100%%;height:auto;border:0;outline:none;text-decoration:none;%s">',
              .cmail_esc(src), capped$width, capped$height, .cmail_esc(alt), capped$width, margin)
    } else {
      sprintf('<img src="%s" width="%d" alt="%s" style="display:block;width:%dpx;max-width:100%%;height:auto;border:0;outline:none;text-decoration:none;%s">',
              .cmail_esc(src), width, .cmail_esc(alt), width, margin)
    }
  }
  url <- .cmail_one(b$url)
  if (!is.null(url) && nzchar(trimws(url))) {
    tag <- sprintf('<a href="%s" target="_blank" style="text-decoration:none;">%s</a>', .cmail_url(url, ctx), tag)
  }
  sprintf('<tr><td align="%s"%s style="padding:%s;line-height:0;font-size:0;">%s</td></tr>',
          align, if (bleed) "" else .cmail_class_attr(.CMAIL_PAD_CLASS), if (bleed) "0" else "6px 46px 18px 46px", tag)
}

# Ancho de un bloque image: el declarado; si no, la mitad del natural (imagen a
# 2x), con tope el ancho de la columna (`width`, 600 por defecto); a sangre, el
# de la columna. Si a ese ancho pasaría de 600 px de alto, el ancho se recalcula
# por la proporción (`.cmail_image_capped`).
.cmail_image_width <- function(b, img, width = .CMAIL_WIDTH) {
  capped <- .cmail_image_capped(b, img, width)
  if (!is.null(capped)) return(capped$width)
  .cmail_image_width_raw(b, img, width)
}

.cmail_image_width_raw <- function(b, img, width = .CMAIL_WIDTH) {
  width <- as.integer(width %||% .CMAIL_WIDTH)
  if (isTRUE(unlist(b$bleed))) return(width)
  w <- suppressWarnings(as.integer(unlist(b$width)[1]))
  if (length(w) && !is.na(w)) return(max(40L, min(width, w)))
  natural <- img$size$width
  if (is.null(natural)) return(300L)
  as.integer(max(40L, min(width, round(natural / 2))))
}

# list(width, height) si el tope de alto recorta la imagen (no a sangre); NULL si no.
.cmail_image_capped <- function(b, img, width = .CMAIL_WIDTH) {
  if (isTRUE(unlist(b$bleed)) || !.cmail_size_ok(img$size)) return(NULL)
  w <- .cmail_image_width_raw(b, img, width)
  if (w * img$size$height / img$size$width <= .CMAIL_IMAGE_MAX_H) return(NULL)
  .cmail_fit(img$size, w)
}

# El trato (`b$trato`, collection_mail_trato.R) cambia la palabra del saludo por
# persona; sin trato activo, `.cmail_trato_inline` es `.cmail_inline`.
.cmail_block_greeting <- function(b, ctx) {
  text <- as.character(b$text)
  uses_name <- "nombre" %in% .cmail_tokens(text)
  fallback <- .cmail_one(b$fallback)
  tr <- .cmail_trato_of(b)
  inline <- function(x) .cmail_trato_inline(x, tr, ctx)
  # Con un nombre garantizado para toda la audiencia no hace falta el respaldo.
  if (isTRUE(ctx$export) && uses_name && !is.null(fallback) && !isTRUE(ctx$known$fname)) {
    inner <- .cmail_dialect(ctx)$conditional("FNAME", inline(text), inline(fallback))
    prop <- "text"
  } else if (!isTRUE(ctx$export) && uses_name && !nzchar(trimws(ctx$values$nombre %||% "")) && !is.null(fallback)) {
    inner <- inline(fallback)
    prop <- "fallback"
  } else {
    inner <- inline(text)
    prop <- "text"
  }
  .cmail_text_td(sprintf('<p style="margin:0;"%s>%s</p>', .cmail_prop(ctx, prop), inner), padding = "36px 48px 20px 48px",
                 align = ctx$pal$greeting_align, color = ctx$pal$text)
}

.cmail_block_signature <- function(b, ctx) {
  closing <- .cmail_one(b$closing)
  url <- .cmail_one(b$url)
  pal <- ctx$pal
  # Campaña: firma centrada; sobrio: a la izquierda, como siempre.
  centered <- identical(pal$signature_align, "center")
  # La firma se separa con una línea fina; el nombre manda, la institución va
  # en gris y la web se lee como dominio, sin https:// (revamp 2026-10-21).
  shown <- if (!is.null(url)) sub("/$", "", sub("^https?://(www\\.)?", "", url)) else NULL
  body <- paste(c(
    sprintf('<strong style="color:%s;"%s>%s</strong>', pal$text, .cmail_prop(ctx, "name"), .cmail_inline(b$name, ctx)),
    .cmail_items_html(b$lines, ctx, "lines", TRUE, sprintf('<span style="color:%s;"%%s>%%s</span>', pal$muted)),
    if (!is.null(url)) sprintf('<a href="%s" target="_blank"%s style="color:%s;text-decoration:none;">%s</a>',
                               .cmail_url(url, ctx), .cmail_prop(ctx, "url"), ctx$link, .cmail_esc(shown))
  ), collapse = "<br>")
  paste0(
    if (!is.null(closing)) .cmail_text_td(sprintf('<p style="margin:0;"%s>%s</p>', .cmail_prop(ctx, "closing"), .cmail_inline(closing, ctx)),
                                          padding = "8px 48px 22px 48px", align = pal$signature_align, color = pal$text) else "",
    sprintf('<tr><td class="%s" style="padding:0 48px 40px 48px;"><table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0"><tr><td%s style="border-top:1px solid %s;padding-top:20px;font-family:%s;font-size:14px;line-height:22px;color:%s;%s"><p style="margin:0;">%s</p></td></tr></table></td></tr>',
            .CMAIL_PAD_CLASS, if (centered) ' align="center"' else "", pal$border, .CMAIL_FONT, pal$text, if (centered) "text-align:center;" else "", body)
  )
}

.cmail_block_html <- function(b, ctx) {
  type <- as.character(b$type)
  # Estilo propio (collection_mail_box.R): las filas se leen sobre la caja. El
  # texto y las imágenes con margen tienen el mismo ancho útil que fuera (caja a
  # 24 + celda a 24 = 48); sólo lo que va a sangre llena la caja, 48 px menos.
  box <- .cmail_box_of(b)
  if (!is.null(box)) {
    ctx <- .cmail_box_ctx(box, ctx)
    if (identical(type, "image") && isTRUE(unlist(b$bleed))) {
      ctx$width <- as.integer(ctx$width %||% .CMAIL_WIDTH) - 2L * .CMAIL_BOX_INSET
    }
  }
  html <- switch(type,
    greeting = .cmail_block_greeting(b, ctx),
    paragraph = .cmail_block_paragraph(b, ctx),
    heading = .cmail_block_heading(b, ctx),
    divider = .cmail_block_divider(b, ctx),
    image = .cmail_block_image(b, ctx),
    button = .cmail_block_button(b, ctx),
    callout = .cmail_block_callout(b, ctx),
    list = {
      tag <- if (isTRUE(b$ordered)) "ol" else "ul"
      lis <- paste(.cmail_items_html(b$items, ctx, "items", TRUE, '<li style="margin:0 0 8px 0;"%s>%s</li>'), collapse = "")
      .cmail_text_td(sprintf('<%s style="margin:0;padding-left:22px;">%s</%s>', tag, lis, tag),
                     align = ctx$pal$list_align, color = ctx$pal$text)
    },
    signature = .cmail_block_signature(b, ctx),
    footer_legal = "",
    # Piezas gráficas (E1o): collection_mail_piezas.R.
    band = .cmail_block_band(b, ctx),
    ornament = .cmail_block_ornament(b, ctx),
    icon_text = .cmail_block_icon_text(b, ctx),
    two_images = .cmail_block_two_images(b, ctx),
    ""
  )
  if (!is.null(box)) html <- .cmail_box_wrap(html, box, ctx)
  mark_type <- if (identical(b$block_id, .CMAIL_OPENING_ID)) "opening" else type
  .cmail_mark_row(html, ctx, as.character(b$block_id %||% ""), mark_type)
}

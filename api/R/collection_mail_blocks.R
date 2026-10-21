# collection_mail_blocks.R — HTML de cada bloque del correo
# (`collection_mail_template/v2`, ADR 0110 §2 y E1g §1/§B).
#
# Cada renderizador devuelve una o más filas `<tr>` de la tarjeta de 600 px.
# Los estilos salen SOLO de las enumeraciones de collection_mail_styles.R:
# nunca se copia CSS del autor. En preview, la primera fila del bloque lleva
# `data-pulso-block`/`data-pulso-type` y cada texto su `data-pulso-prop`
# (`.cmail_mark_row`, `.cmail_prop`); en export no sale ninguna marca.

.cmail_text_td <- function(inner, padding = "0 48px 18px 48px", align = "left", size = 16L, line = 26L,
                           color = .CMAIL_TEXT_COLOR) {
  sprintf(
    '<tr><td style="padding:%s;font-family:%s;font-size:%dpx;line-height:%dpx;color:%s;text-align:%s;">%s</td></tr>',
    padding, .CMAIL_FONT, as.integer(size), as.integer(line), color, align, inner
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
  small <- identical(.cmail_style(b, "size", "normal"), "pequeno")
  soft <- identical(.cmail_style(b, "tone", "normal"), "suave")
  # La apertura de un envío (E1k) es un párrafo cuyo valor vive en `send.opening`.
  prop <- if (identical(b$block_id, .CMAIL_OPENING_ID)) "opening" else "text"
  .cmail_text_td(
    sprintf('<p style="margin:0;"%s>%s</p>', .cmail_prop(ctx, prop), .cmail_inline(b$text, ctx, links = TRUE)),
    align = .cmail_style(b, "align", "left"),
    size = if (small) 13L else 16L, line = if (small) 20L else 26L,
    color = if (soft) .CMAIL_MUTED else .CMAIL_TEXT_COLOR
  )
}

.cmail_block_heading <- function(b, ctx) {
  title <- identical(.cmail_style(b, "level", "titulo"), "titulo")
  .cmail_text_td(
    sprintf('<p style="margin:0;font-weight:bold;"%s>%s</p>', .cmail_prop(ctx, "text"), .cmail_inline(b$text, ctx)),
    padding = if (title) "14px 48px 12px 48px" else "8px 48px 10px 48px",
    align = .cmail_style(b, "align", "left"),
    size = if (title) 22L else 17L, line = if (title) 28L else 24L
  )
}

.CMAIL_DIVIDER_PX <- c(s = 8L, m = 16L, l = 32L)

.cmail_block_divider <- function(b, ctx) {
  px <- .CMAIL_DIVIDER_PX[[.cmail_style(b, "size", "m")]]
  if (identical(.cmail_style(b, "style", "linea"), "espacio")) {
    return(sprintf('<tr><td style="height:%dpx;line-height:%dpx;font-size:0;">&nbsp;</td></tr>', px * 2L, px * 2L))
  }
  sprintf(paste0(
    '<tr><td style="padding:%dpx 48px %dpx 48px;"><table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0">',
    '<tr><td style="height:1px;line-height:1px;font-size:0;background-color:%s;">&nbsp;</td></tr></table></td></tr>'
  ), px, px, .CMAIL_BORDER)
}

.CMAIL_BUTTON_PAD <- list(compacto = c(10L, 26L, 14L), normal = c(15L, 40L, 16L), grande = c(18L, 52L, 17L))

.cmail_block_button <- function(b, ctx) {
  accent <- ctx$accent
  pad <- .CMAIL_BUTTON_PAD[[.cmail_style(b, "size", "normal")]]
  outline <- identical(.cmail_style(b, "fill", "solido"), "contorno")
  align <- .cmail_style(b, "align", "center")
  bg <- if (outline) "#ffffff" else accent
  fg <- if (outline) accent else "#ffffff"
  note <- unlist(b$note %||% list(), use.names = FALSE)
  note_html <- if (length(note)) sprintf(
    '<p style="margin:12px 0 0 0;font-family:%s;font-size:13px;line-height:20px;color:%s;text-align:%s;">%s</p>',
    .CMAIL_FONT, .CMAIL_MUTED, align,
    paste(.cmail_items_html(note, ctx, "note", FALSE, "<span%s>%s</span>"), collapse = "<br>")
  ) else ""
  sprintf(paste0(
    '<tr><td align="%s" style="padding:14px 48px 30px 48px;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="%s"><tr>',
    '<td align="center" bgcolor="%s" style="background-color:%s;border-radius:6px;mso-padding-alt:%dpx %dpx;">',
    '<a href="%s" target="_blank"%s style="display:inline-block;padding:%dpx %dpx;border:%s solid %s;border-radius:6px;',
    'font-family:%s;font-size:%dpx;line-height:20px;font-weight:bold;letter-spacing:0.2px;color:%s;text-decoration:none;">%s</a>',
    '</td></tr></table>%s</td></tr>'
  ), align, align, bg, bg, pad[[1]], pad[[2]], .cmail_url(b$url, ctx), .cmail_prop(ctx, "text"),
  pad[[1]], pad[[2]], if (outline) "2px" else "1px", accent, .CMAIL_FONT, pad[[3]], fg,
  .cmail_inline(b$text, ctx), note_html)
}

.cmail_block_callout <- function(b, ctx) {
  title <- .cmail_one(b$title)
  variant <- .cmail_style(b, "variant", "box")
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
    return(sprintf(paste0(
      '<tr><td style="padding:0 46px %dpx 46px;"><table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0">',
      '<tr><td bgcolor="%s" style="padding:%s;%sbackground-color:%s;font-family:%s;font-size:15px;line-height:23px;color:%s;">%s</td></tr>',
      '</table></td></tr>'
    ), if (bar) 12L else 18L, if (bar) "#f5f6f9" else .cmail_tint(ctx$accent),
    if (bar) "14px 18px" else "18px 22px",
    if (bar) sprintf("border-left:3px solid %s;", ctx$accent) else "",
    if (bar) "#f5f6f9" else .cmail_tint(ctx$accent), .CMAIL_FONT, .CMAIL_TEXT_COLOR, inner))
  }
  # Panel tintado con barra de acento y título en versalitas pequeñas: se lee
  # como un aviso, no como una tabla (revamp 2026-10-21).
  lis <- paste(.cmail_items_html(b$items, ctx, "items", TRUE, '<li style="margin:0 0 8px 0;"%s>%s</li>'), collapse = "")
  sprintf(paste0(
    '<tr><td style="padding:4px 48px 24px 48px;"><table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0">',
    '<tr><td bgcolor="%s" style="background-color:%s;border-left:3px solid %s;border-radius:0 6px 6px 0;padding:18px 24px 10px 22px;font-family:%s;font-size:15px;line-height:23px;color:%s;">',
    '%s<ul style="margin:0 0 8px 0;padding-left:20px;">%s</ul></td></tr></table></td></tr>'
  ), .cmail_tint(ctx$accent), .cmail_tint(ctx$accent), ctx$accent, .CMAIL_FONT, .CMAIL_TEXT_COLOR,
  paste(title_html(sprintf('<p style="margin:0 0 10px 0;font-size:12px;line-height:16px;letter-spacing:1px;text-transform:uppercase;color:%s;"><strong%%s>%%s</strong></p>', ctx$accent)), collapse = ""), lis)
}

.cmail_block_image <- function(b, ctx) {
  id <- as.character(.cmail_one(b$image_ref) %||% "")
  img <- ctx$images[[id]] %||% .cmail_image_placeholder(id)
  bleed <- isTRUE(unlist(b$bleed))
  width <- .cmail_image_width(b, img)
  align <- .cmail_style(b, "align", "center")
  alt <- .cmail_one(b$alt) %||% ""
  src <- .cmail_image_src(img, ctx)
  margin <- switch(align, center = "margin:0 auto;", right = "margin:0 0 0 auto;", "")
  tag <- if (is.null(src)) {
    h <- max(40L, as.integer(round(width / 2)))
    sprintf('<span style="display:inline-block;width:%dpx;max-width:100%%;height:%dpx;line-height:%dpx;border:1px dashed #9aa3b5;font-family:%s;font-size:11px;color:#5a6a94;text-align:center;overflow:hidden;">%s</span>',
            width, h, h, .CMAIL_FONT, .cmail_esc(if (nzchar(alt)) alt else id))
  } else {
    # A sangre llena la tarjeta (width:100%), como el banner de cabecera: con
    # un ancho fijo el editor de Mailchimp, que dibuja la tarjeta más ancha,
    # dejaba una franja blanca. width="600" sigue fijándolo en Outlook.
    if (bleed) {
      sprintf('<img src="%s" width="%d" alt="%s" style="display:block;width:100%%;height:auto;border:0;outline:none;text-decoration:none;">',
              .cmail_esc(src), width, .cmail_esc(alt))
    } else {
      sprintf('<img src="%s" width="%d" alt="%s" style="display:block;width:%dpx;max-width:100%%;height:auto;border:0;outline:none;text-decoration:none;%s">',
              .cmail_esc(src), width, .cmail_esc(alt), width, margin)
    }
  }
  url <- .cmail_one(b$url)
  if (!is.null(url) && nzchar(trimws(url))) {
    tag <- sprintf('<a href="%s" target="_blank" style="text-decoration:none;">%s</a>', .cmail_url(url, ctx), tag)
  }
  sprintf('<tr><td align="%s" style="padding:%s;line-height:0;font-size:0;">%s</td></tr>',
          align, if (bleed) "0" else "6px 46px 18px 46px", tag)
}

# Ancho de un bloque image: el declarado; si no, la mitad del natural (imagen a
# 2x), con tope 600; a sangre, 600.
.cmail_image_width <- function(b, img) {
  if (isTRUE(unlist(b$bleed))) return(.CMAIL_WIDTH)
  w <- suppressWarnings(as.integer(unlist(b$width)[1]))
  if (length(w) && !is.na(w)) return(max(40L, min(.CMAIL_WIDTH, w)))
  natural <- img$size$width
  if (is.null(natural)) return(300L)
  as.integer(max(40L, min(.CMAIL_WIDTH, round(natural / 2))))
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
  .cmail_text_td(sprintf('<p style="margin:0;"%s>%s</p>', .cmail_prop(ctx, prop), inner), padding = "36px 48px 20px 48px")
}

.cmail_block_signature <- function(b, ctx) {
  closing <- .cmail_one(b$closing)
  url <- .cmail_one(b$url)
  # La firma se separa con una línea fina; el nombre manda, la institución va
  # en gris y la web se lee como dominio, sin https:// (revamp 2026-10-21).
  shown <- if (!is.null(url)) sub("/$", "", sub("^https?://(www\\.)?", "", url)) else NULL
  body <- paste(c(
    sprintf('<strong style="color:%s;"%s>%s</strong>', .CMAIL_TEXT_COLOR, .cmail_prop(ctx, "name"), .cmail_inline(b$name, ctx)),
    .cmail_items_html(b$lines, ctx, "lines", TRUE, sprintf('<span style="color:%s;"%%s>%%s</span>', .CMAIL_MUTED)),
    if (!is.null(url)) sprintf('<a href="%s" target="_blank"%s style="color:%s;text-decoration:none;">%s</a>',
                               .cmail_url(url, ctx), .cmail_prop(ctx, "url"), ctx$link, .cmail_esc(shown))
  ), collapse = "<br>")
  paste0(
    if (!is.null(closing)) .cmail_text_td(sprintf('<p style="margin:0;"%s>%s</p>', .cmail_prop(ctx, "closing"), .cmail_inline(closing, ctx)),
                                          padding = "8px 48px 22px 48px") else "",
    sprintf('<tr><td style="padding:0 48px 40px 48px;"><table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid %s;padding-top:20px;font-family:%s;font-size:14px;line-height:22px;color:%s;"><p style="margin:0;">%s</p></td></tr></table></td></tr>',
            .CMAIL_BORDER, .CMAIL_FONT, .CMAIL_TEXT_COLOR, body)
  )
}

.cmail_block_html <- function(b, ctx) {
  type <- as.character(b$type)
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
      .cmail_text_td(sprintf('<%s style="margin:0;padding-left:22px;">%s</%s>', tag, lis, tag))
    },
    signature = .cmail_block_signature(b, ctx),
    footer_legal = "",
    ""
  )
  mark_type <- if (identical(b$block_id, .CMAIL_OPENING_ID)) "opening" else type
  .cmail_mark_row(html, ctx, as.character(b$block_id %||% ""), mark_type)
}

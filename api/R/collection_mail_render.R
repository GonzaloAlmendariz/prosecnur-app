# collection_mail_render.R — HTML de correo para `collection_mail_template/v1`
# (ADR 0110 §2).
#
# El render es el ÚNICO que escribe HTML: todo texto de usuario pasa por
# `htmltools::htmlEscape` antes de convertir `**negrita**` y `{{campo}}`.
#
# Forma del HTML, la que leen Gmail, Outlook y Apple Mail sin sorpresas:
# tablas `role="presentation"`, 600 px de ancho máximo, CSS solo inline, botón
# «bulletproof» (celda con color de fondo + enlace con padding, sin imagen),
# `alt` en toda imagen y nada de JavaScript.
#
# Dos modos:
# - `preview`: para la vista de la app. Resuelve los campos con un destinatario
#   (importado o sintético) y puede incrustar las imágenes en base64, porque ese
#   HTML nunca sale de la app.
# - `mailchimp`: deja las etiquetas `*|TAG|*`, el saludo con respaldo
#   condicional (`*|IF:FNAME|*…*|ELSE:|*…*|END:IF|*`), referencia cada imagen por
#   su URL pública o por un marcador `IMAGEN_<id>.png`, y agrega el pie legal con
#   `*|LIST:ADDRESSLINE|*` y `*|UNSUB|*`. Nunca lleva `data:`.

.CMAIL_WIDTH <- 600L
.CMAIL_FONT <- "Arial,Helvetica,sans-serif"
.CMAIL_TEXT_COLOR <- "#1a1a1a"
.CMAIL_BORDER <- "#d6d6d6"

.cmail_esc <- function(x) htmltools::htmlEscape(as.character(x %||% ""), attribute = TRUE)

.cmail_field_index <- function(template) {
  out <- list()
  for (f in template$fields %||% list()) {
    out[[as.character(f$key)]] <- list(
      key = as.character(f$key), tag = as.character(f$tag),
      label = as.character(f$label %||% f$key),
      fallback = .cmail_one(f$fallback)
    )
  }
  out
}

# Valor de un campo en el modo pedido. `ctx$values` trae los valores del
# destinatario en preview; en mailchimp sale la etiqueta.
.cmail_field_value <- function(key, ctx, in_url = FALSE) {
  if (identical(key, "nombre")) {
    if (identical(ctx$mode, "mailchimp")) return("*|FNAME|*")
    return(if (in_url) utils::URLencode(ctx$values$nombre %||% "", reserved = TRUE) else .cmail_esc(ctx$values$nombre %||% ""))
  }
  field <- ctx$fields[[key]]
  if (identical(ctx$mode, "mailchimp")) {
    tag <- sprintf("*|%s|*", field$tag)
    if (!in_url && !is.null(field$fallback) && nzchar(field$fallback)) {
      return(sprintf("*|IF:%s|*%s*|ELSE:|*%s*|END:IF|*", field$tag, tag, .cmail_esc(field$fallback)))
    }
    return(tag)
  }
  value <- ctx$values$fields[[key]] %||% ""
  if (!nzchar(trimws(value)) && !in_url) value <- field$fallback %||% ""
  # En un enlace el valor va crudo: `.cmail_url()` escapa el atributo entero.
  if (in_url) return(value)
  .cmail_esc(value)
}

# Texto de usuario -> HTML inline seguro.
.cmail_inline <- function(text, ctx) {
  out <- .cmail_esc(text)
  out <- gsub("\\*\\*(.+?)\\*\\*", "<strong>\\1</strong>", out, perl = TRUE)
  out <- gsub("\n", "<br>", out, fixed = TRUE)
  keys <- .cmail_tokens(out)
  for (k in keys) {
    pattern <- sprintf("\\{\\{\\s*%s\\s*\\}\\}", k)
    out <- gsub(pattern, .cmail_gsub_safe(.cmail_field_value(k, ctx)), out, perl = TRUE)
  }
  out
}

# Texto plano (asunto, preheader): sin HTML, con campos.
.cmail_plain <- function(text, ctx) {
  out <- gsub("\\*\\*(.+?)\\*\\*", "\\1", as.character(text %||% ""), perl = TRUE)
  for (k in .cmail_tokens(out)) {
    v <- if (identical(ctx$mode, "mailchimp")) {
      if (identical(k, "nombre")) "*|FNAME|*" else sprintf("*|%s|*", ctx$fields[[k]]$tag)
    } else if (identical(k, "nombre")) {
      ctx$values$nombre %||% ""
    } else {
      v0 <- ctx$values$fields[[k]] %||% ""
      if (nzchar(trimws(v0))) v0 else (ctx$fields[[k]]$fallback %||% "")
    }
    out <- gsub(sprintf("\\{\\{\\s*%s\\s*\\}\\}", k), .cmail_gsub_safe(v), out, perl = TRUE)
  }
  out
}

.cmail_gsub_safe <- function(x) gsub("\\\\", "\\\\\\\\", x)

.cmail_url <- function(url, ctx) {
  out <- as.character(url %||% "")
  for (k in .cmail_tokens(out)) {
    out <- gsub(sprintf("\\{\\{\\s*%s\\s*\\}\\}", k), .cmail_gsub_safe(.cmail_field_value(k, ctx, in_url = TRUE)), out, perl = TRUE)
  }
  if (identical(ctx$mode, "preview") && !nzchar(trimws(out))) out <- "#"
  .cmail_esc(out)
}

# ---- imágenes ---------------------------------------------------------------

.cmail_png_size <- function(path) {
  if (is.null(path) || !file.exists(path)) return(NULL)
  con <- file(path, "rb"); on.exit(close(con))
  head <- readBin(con, "raw", 24L)
  if (length(head) < 24L || !identical(head[1:8], as.raw(c(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)))) return(NULL)
  int32 <- function(b) sum(as.integer(b) * c(16777216, 65536, 256, 1))
  list(width = int32(head[17:20]), height = int32(head[21:24]))
}

# Ids de imagen que usa la plantilla, en orden.
.cmail_image_ids <- function(template) {
  h <- template$header %||% list()
  if (identical(h$kind, "banner")) return(as.character(h$image_ref))
  unique(as.character(unlist(h$logo_ids %||% list(), use.names = FALSE)))
}

#' Resuelve las imágenes de la plantilla contra el proyecto.
#'
#' Los archivos son logos del `.pulso` (kind `brand_logo`), igual que la careta
#' del afiche (`.cm_brand_assets_map`). Cada imagen sabe su ruta (si existe),
#' su URL pública (si se declaró), su alt y su marcador de exportación.
#' @keywords internal
.cmail_images_resolve <- function(session, template) {
  ids <- .cmail_image_ids(template)
  paths <- .cm_brand_assets_map(session, ids)
  lapply(stats::setNames(ids, ids), function(id) {
    decl <- (template$images %||% list())[[id]] %||% list()
    path <- paths[[id]]
    list(
      id = id,
      path = path,
      size = .cmail_png_size(path),
      bytes = if (!is.null(path)) as.numeric(file.info(path)$size) else NA_real_,
      url = .cmail_one(decl$url),
      alt = .cmail_one(decl$alt) %||% "",
      export_name = sprintf("%s.png", id),
      placeholder = sprintf("IMAGEN_%s.png", id)
    )
  })
}

.cmail_image_src <- function(img, ctx) {
  if (identical(ctx$mode, "mailchimp")) {
    return(img$url %||% img$placeholder)
  }
  if (!is.null(img$path)) {
    raw <- readBin(img$path, "raw", file.info(img$path)$size)
    return(paste0("data:image/png;base64,", jsonlite::base64_enc(raw)))
  }
  img$url
}

.cmail_img_tag <- function(img, ctx, width, height, style_extra = "") {
  src <- .cmail_image_src(img, ctx)
  if (is.null(src)) {
    # Preview sin archivo ni URL: un hueco con el alt, para que la vista diga qué falta.
    return(sprintf(
      '<span style="display:inline-block;width:%dpx;height:%dpx;line-height:%dpx;border:1px dashed #9aa3b5;font-family:%s;font-size:11px;color:#5a6a94;text-align:center;overflow:hidden;">%s</span>',
      width, height, height, .CMAIL_FONT, .cmail_esc(if (nzchar(img$alt)) img$alt else img$id)
    ))
  }
  sprintf(
    '<img src="%s" width="%d" height="%d" alt="%s" style="display:block;border:0;outline:none;text-decoration:none;width:%dpx;height:%dpx;%s">',
    .cmail_esc(src), width, height, .cmail_esc(img$alt), width, height, style_extra
  )
}

# ---- piezas -------------------------------------------------------------------

.cmail_header_html <- function(template, ctx) {
  h <- template$header
  accent <- ctx$accent
  if (identical(h$kind, "banner")) {
    img <- ctx$images[[as.character(h$image_ref)]]
    src <- .cmail_image_src(img, ctx)
    inner <- if (is.null(src)) .cmail_img_tag(img, ctx, .CMAIL_WIDTH, 300L) else sprintf(
      '<img src="%s" width="%d" alt="%s" style="display:block;border:0;width:100%%;max-width:%dpx;height:auto;">',
      .cmail_esc(src), .CMAIL_WIDTH, .cmail_esc(img$alt), .CMAIL_WIDTH
    )
    return(sprintf('<tr><td style="padding:0;line-height:0;font-size:0;">%s</td></tr>', inner))
  }
  dark <- identical(h$background %||% "light", "dark")
  bg <- if (dark) accent else "#ffffff"
  divider <- if (dark) "#5a6a94" else .CMAIL_BORDER
  height <- if (dark) 46L else 40L
  cells <- character(0)
  ids <- as.character(unlist(h$logo_ids, use.names = FALSE))
  for (i in seq_along(ids)) {
    img <- ctx$images[[ids[[i]]]]
    size <- img$size
    width <- if (is.null(size) || !size$height) 120L else as.integer(min(200, round(size$width / size$height * height)))
    if (i > 1L) {
      cells <- c(cells, sprintf(
        '<td valign="middle" style="padding:0 18px;"><div style="width:1px;height:%dpx;background-color:%s;line-height:%dpx;font-size:0;">&nbsp;</div></td>',
        height, divider, height
      ))
    }
    # Con las imágenes bloqueadas el cliente pinta el alt: que se lea sobre el fondo.
    alt_style <- sprintf("font-family:%s;font-size:13px;color:%s;", .CMAIL_FONT, if (dark) "#ffffff" else .CMAIL_TEXT_COLOR)
    cells <- c(cells, sprintf('<td valign="middle">%s</td>', .cmail_img_tag(img, ctx, width, height, alt_style)))
  }
  border <- if (dark) "" else sprintf("border-bottom:1px solid %s;", .CMAIL_BORDER)
  sprintf(
    '<tr><td bgcolor="%s" align="%s" style="background-color:%s;padding:28px 40px 24px 40px;%s"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>%s</tr></table></td></tr>',
    bg, if (dark) "left" else "center", bg, border, paste(cells, collapse = "")
  )
}

.cmail_text_td <- function(inner, padding = "0 46px 16px 46px", align = "left") {
  sprintf(
    '<tr><td style="padding:%s;font-family:%s;font-size:15px;line-height:24px;color:%s;text-align:%s;">%s</td></tr>',
    padding, .CMAIL_FONT, .CMAIL_TEXT_COLOR, align, inner
  )
}

.cmail_block_html <- function(b, ctx) {
  type <- as.character(b$type)
  switch(type,
    greeting = {
      text <- as.character(b$text)
      uses_name <- "nombre" %in% .cmail_tokens(text)
      fallback <- .cmail_one(b$fallback)
      inner <- if (identical(ctx$mode, "mailchimp") && uses_name && !is.null(fallback)) {
        sprintf("*|IF:FNAME|*%s*|ELSE:|*%s*|END:IF|*", .cmail_inline(text, ctx), .cmail_inline(fallback, ctx))
      } else if (identical(ctx$mode, "preview") && uses_name && !nzchar(trimws(ctx$values$nombre %||% "")) && !is.null(fallback)) {
        .cmail_inline(fallback, ctx)
      } else {
        .cmail_inline(text, ctx)
      }
      .cmail_text_td(sprintf('<p style="margin:0;">%s</p>', inner), padding = "28px 46px 18px 46px")
    },
    paragraph = .cmail_text_td(
      sprintf('<p style="margin:0;">%s</p>', .cmail_inline(b$text, ctx)),
      align = .cmail_one(b$align) %||% "left"
    ),
    button = {
      accent <- ctx$accent
      note <- unlist(b$note %||% list(), use.names = FALSE)
      note_html <- if (length(note)) sprintf(
        '<p style="margin:12px 0 0 0;font-family:%s;font-size:13px;line-height:20px;color:#555555;">%s</p>',
        .CMAIL_FONT, paste(vapply(note, .cmail_inline, "", ctx = ctx), collapse = "<br>")
      ) else ""
      sprintf(paste0(
        '<tr><td align="center" style="padding:12px 46px 26px 46px;">',
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>',
        '<td align="center" bgcolor="%s" style="background-color:%s;mso-padding-alt:15px 48px;">',
        '<a href="%s" target="_blank" style="display:inline-block;padding:15px 48px;border:1px solid %s;',
        'font-family:%s;font-size:16px;line-height:20px;font-weight:bold;color:#ffffff;text-decoration:none;">%s</a>',
        '</td></tr></table>%s</td></tr>'
      ), accent, accent, .cmail_url(b$url, ctx), accent, .CMAIL_FONT, .cmail_inline(b$text, ctx), note_html)
    },
    callout = {
      items <- unlist(b$items, use.names = FALSE)
      title <- .cmail_one(b$title)
      if (identical(.cmail_one(b$variant) %||% "box", "bar")) {
        inner <- paste(c(
          if (!is.null(title)) sprintf("<strong>%s</strong>", .cmail_inline(title, ctx)),
          vapply(items, .cmail_inline, "", ctx = ctx)
        ), collapse = "<br>")
        sprintf(paste0(
          '<tr><td style="padding:0 46px 12px 46px;"><table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0">',
          '<tr><td style="padding:14px 18px;border-left:3px solid %s;background-color:#f5f6f9;font-family:%s;font-size:15px;line-height:23px;color:%s;">%s</td></tr>',
          '</table></td></tr>'
        ), ctx$accent, .CMAIL_FONT, .CMAIL_TEXT_COLOR, inner)
      } else {
        lis <- paste(sprintf('<li style="margin:0 0 8px 0;">%s</li>', vapply(items, .cmail_inline, "", ctx = ctx)), collapse = "")
        sprintf(paste0(
          '<tr><td style="padding:0 46px 18px 46px;"><table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid %s;">',
          '<tr><td style="padding:18px 22px 10px 22px;font-family:%s;font-size:15px;line-height:24px;color:%s;">',
          '%s<ul style="margin:0 0 8px 0;padding-left:22px;">%s</ul></td></tr></table></td></tr>'
        ), .CMAIL_BORDER, .CMAIL_FONT, .CMAIL_TEXT_COLOR,
        if (!is.null(title)) sprintf('<p style="margin:0 0 10px 0;"><strong>%s</strong></p>', .cmail_inline(title, ctx)) else "",
        lis)
      }
    },
    list = {
      tag <- if (isTRUE(b$ordered)) "ol" else "ul"
      lis <- paste(sprintf('<li style="margin:0 0 8px 0;">%s</li>', vapply(unlist(b$items, use.names = FALSE), .cmail_inline, "", ctx = ctx)), collapse = "")
      .cmail_text_td(sprintf('<%s style="margin:0;padding-left:22px;">%s</%s>', tag, lis, tag))
    },
    signature = {
      closing <- .cmail_one(b$closing)
      lines <- vapply(unlist(b$lines %||% list(), use.names = FALSE), .cmail_inline, "", ctx = ctx)
      url <- .cmail_one(b$url)
      body <- paste(c(
        sprintf("<strong>%s</strong>", .cmail_inline(b$name, ctx)),
        lines,
        if (!is.null(url)) sprintf('<a href="%s" target="_blank" style="color:#1a56b8;">%s</a>', .cmail_url(url, ctx), .cmail_url(url, ctx))
      ), collapse = "<br>")
      .cmail_text_td(paste0(
        if (!is.null(closing)) sprintf('<p style="margin:0 0 18px 0;">%s</p>', .cmail_inline(closing, ctx)) else "",
        sprintf('<p style="margin:0;">%s</p>', body)
      ), padding = "10px 46px 36px 46px")
    },
    footer_legal = ""
  )
}

# Pie legal. En mailchimp lleva SIEMPRE la dirección de la lista y la baja,
# exista o no el bloque footer_legal: Mailchimp rechaza la campaña sin ellas.
.cmail_footer_html <- function(template, ctx) {
  footer <- Filter(function(b) identical(b$type, "footer_legal"), template$blocks %||% list())
  footer <- if (length(footer)) footer[[1]] else list()
  text <- .cmail_one(footer$text)
  address <- .cmail_one(footer$address)
  parts <- c(
    if (!is.null(text)) .cmail_inline(text, ctx),
    if (!is.null(address)) .cmail_inline(address, ctx)
  )
  if (identical(ctx$mode, "mailchimp")) {
    parts <- c(parts, "*|LIST:ADDRESSLINE|*",
               '<a href="*|UNSUB|*" target="_blank" style="color:#555555;text-decoration:underline;">Dejar de recibir estos correos</a>')
  } else {
    parts <- c(parts, '<span style="text-decoration:underline;">Dejar de recibir estos correos</span>')
  }
  sprintf(
    '<tr><td align="center" style="padding:18px 30px 24px 30px;font-family:%s;font-size:12px;line-height:18px;color:#555555;">%s</td></tr>',
    .CMAIL_FONT, paste(parts, collapse = "<br>")
  )
}

.cmail_preheader_html <- function(text) {
  if (!nzchar(text)) return("")
  # Relleno invisible: impide que el cliente complete la vista previa con el cuerpo.
  pad <- paste(rep("&#847;&zwnj;&nbsp;", 40L), collapse = "")
  sprintf(
    '<div style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#ffffff;opacity:0;">%s%s</div>',
    htmltools::htmlEscape(text), pad
  )
}

#' Renderiza la plantilla a HTML de correo.
#'
#' @param template plantilla validada.
#' @param mode "preview" o "mailchimp".
#' @param values list(nombre, fields = list(key = valor)) para preview.
#' @param images salida de `.cmail_images_resolve()`.
#' @return list(html, subject, preheader, bytes).
#' @keywords internal
collection_mail_render <- function(template, mode = c("preview", "mailchimp"), values = list(), images = list()) {
  mode <- match.arg(mode)
  ctx <- list(
    mode = mode,
    values = values,
    fields = .cmail_field_index(template),
    images = images,
    accent = .cmail_one(template$theme$accent) %||% .CMAIL_DEFAULT_ACCENT
  )
  for (id in .cmail_image_ids(template)) {
    if (is.null(ctx$images[[id]])) {
      ctx$images[[id]] <- list(id = id, path = NULL, size = NULL, url = NULL, alt = "",
                               placeholder = sprintf("IMAGEN_%s.png", id))
    }
  }
  subject <- .cmail_plain(template$subject, ctx)
  preheader <- .cmail_plain(template$preheader, ctx)
  body_rows <- vapply(template$blocks %||% list(), .cmail_block_html, "", ctx = ctx)
  card <- paste0(
    sprintf('<table role="presentation" width="%d" cellpadding="0" cellspacing="0" border="0" style="width:100%%;max-width:%dpx;border:1px solid %s;background-color:#ffffff;">',
            .CMAIL_WIDTH, .CMAIL_WIDTH, .CMAIL_BORDER),
    .cmail_header_html(template, ctx),
    '<tr><td style="height:8px;line-height:8px;font-size:0;">&nbsp;</td></tr>',
    paste(body_rows, collapse = ""),
    sprintf('<tr><td bgcolor="%s" style="background-color:%s;height:20px;line-height:20px;font-size:0;">&nbsp;</td></tr>',
            if (identical(template$header$background, "dark")) ctx$accent else "#f3f3f3",
            if (identical(template$header$background, "dark")) ctx$accent else "#f3f3f3"),
    "</table>"
  )
  html <- paste0(
    '<!DOCTYPE html>\n<html lang="es" xmlns="http://www.w3.org/1999/xhtml"><head>',
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="x-apple-disable-message-reformatting">',
    '<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">',
    sprintf("<title>%s</title>", htmltools::htmlEscape(subject)),
    "</head>\n",
    '<body style="margin:0;padding:0;background-color:#ffffff;">',
    .cmail_preheader_html(preheader),
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:24px 12px;">',
    card,
    sprintf('<table role="presentation" width="%d" cellpadding="0" cellspacing="0" border="0" style="width:100%%;max-width:%dpx;">%s</table>',
            .CMAIL_WIDTH, .CMAIL_WIDTH, .cmail_footer_html(template, ctx)),
    "</td></tr></table></body></html>\n"
  )
  html <- enc2utf8(html)
  list(
    mode = mode,
    html = html,
    subject = subject,
    preheader = preheader,
    bytes = as.integer(nchar(html, type = "bytes"))
  )
}

# Etiquetas que la plantilla usa de verdad (FNAME incluido si aparece {{nombre}}).
.cmail_used_keys <- function(template) {
  texts <- c(
    as.character(template$subject %||% ""), as.character(template$preheader %||% ""),
    unlist(lapply(template$blocks %||% list(), function(b) {
      unlist(b[setdiff(names(b), c("block_id", "type", "variant", "align", "ordered"))], use.names = FALSE)
    }), use.names = FALSE)
  )
  unique(unlist(lapply(texts, .cmail_tokens), use.names = FALSE))
}

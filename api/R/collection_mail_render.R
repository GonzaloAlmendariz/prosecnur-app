# collection_mail_render.R — HTML de correo para `collection_mail_template/v2`
# (ADR 0110 §2; E1g: estilos cerrados, heading/divider/image, enlaces en el
# texto y marcas de edición).
#
# El render es el ÚNICO que escribe HTML: todo texto de usuario pasa por
# `htmltools::htmlEscape` antes de convertir `**negrita**` y `{{campo}}`.
#
# Forma del HTML, la que leen Gmail, Outlook y Apple Mail sin sorpresas:
# tablas `role="presentation"`, 600 px de ancho máximo, CSS solo inline, botón
# «bulletproof» (celda con color de fondo + enlace con padding, sin imagen),
# `alt` en toda imagen y nada de JavaScript.
#
# Dos modos y un dialecto (E1j; tabla en collection_mail_dialects.R):
# - `preview`: para la vista de la app. Resuelve los campos con un destinatario
#   (importado o sintético) y puede incrustar las imágenes en base64, porque ese
#   HTML nunca sale de la app. El pie es el del dialecto, con enlaces simulados.
# - `export`: el HTML que sale de la app, con las etiquetas del dialecto.
#   En `mailchimp`: `*|TAG|*`, el saludo con respaldo condicional
#   (`*|IF:FNAME|*…*|ELSE:|*…*|END:IF|*`), cada imagen por su URL https declarada
#   o por su nombre de archivo RELATIVO dentro del ZIP importable
#   (`logo-cliente.png`), y el pie legal con `*|LIST:ADDRESSLINE|*` y `*|UNSUB|*`.
#   En `surveymonkey`: `[FirstName]`/`[<sm>]` sin condicionales, imágenes solo por
#   URL https y el pie con `[PrivacyLink]`/`[OptOutLink]`.
#   Nunca lleva `data:` ni `data-pulso-*`.
# `mode = "mailchimp"` es el alias de antes: `export` en dialecto mailchimp,
# byte a byte igual (test de paridad con huella capturada antes del cambio).
#
# Marcas de edición (solo `preview`, E1g §1): cada fila de bloque lleva
# `data-pulso-block`/`data-pulso-type`, la cabecera `__cabecera`, cada texto
# editable `data-pulso-prop` (índice desde 0: `items.2`) y cada valor de campo
# resuelto un `<span data-pulso-field>` teñido. La capa de edición del front se
# monta sobre esas marcas; el HTML que se exporta no las trae.

.CMAIL_WIDTH <- 600L
# Revamp 2026-10-21 («se sigue viendo extremadamente poco profesional»):
# grafito en vez de negro, Helvetica Neue con respaldo Arial, página gris
# azulada suave y bordes casi imperceptibles. Comillas simples dentro de
# style="…": el atributo va entre comillas dobles.
.CMAIL_FONT <- "'Helvetica Neue',Helvetica,Arial,sans-serif"
.CMAIL_TEXT_COLOR <- "#22262e"
.CMAIL_BORDER <- "#e2e6ed"
.CMAIL_MUTED <- "#5f6673"
.CMAIL_PAGE_BG <- "#eef1f5"
.CMAIL_FOOTER_TEXT <- "#8a909c"
.CMAIL_PAD_X <- 48L
.CMAIL_FIELD_TINT <- "#eef3e8"

# ` data-pulso-prop="…"` en preview; nada en export.
.cmail_prop <- function(ctx, prop) {
  if (!isTRUE(ctx$marks)) return("")
  sprintf(' data-pulso-prop="%s"', .cmail_esc(prop))
}

# Marca la primera fila de un bloque (preview).
.cmail_mark_row <- function(html, ctx, block_id, type = NULL) {
  if (!isTRUE(ctx$marks) || !nzchar(html)) return(html)
  attrs <- sprintf(' data-pulso-block="%s"%s', .cmail_esc(block_id),
                   if (!is.null(type)) sprintf(' data-pulso-type="%s"', .cmail_esc(type)) else "")
  sub("^<tr", paste0("<tr", attrs), html)
}

.cmail_esc <- function(x) htmltools::htmlEscape(as.character(x %||% ""), attribute = TRUE)

.cmail_field_index <- function(template) {
  out <- list()
  for (f in template$fields %||% list()) {
    out[[as.character(f$key)]] <- list(
      key = as.character(f$key), tag = as.character(f$tag),
      label = as.character(f$label %||% f$key),
      fallback = .cmail_one(f$fallback),
      sm = .cmail_one(f$sm),
      destino = .cmail_one(f$destino)
    )
  }
  out
}

# Valor de un campo en el modo pedido. `ctx$values` trae los valores del
# destinatario en preview; en export sale la etiqueta del dialecto.
.cmail_field_value <- function(key, ctx, in_url = FALSE) {
  if (identical(key, "nombre")) {
    if (isTRUE(ctx$export)) return(.cmail_dialect(ctx)$name_tag())
    if (in_url) return(utils::URLencode(ctx$values$nombre %||% "", reserved = TRUE))
    return(.cmail_field_span("nombre", .cmail_esc(ctx$values$nombre %||% ""), ctx))
  }
  field <- ctx$fields[[key]]
  if (isTRUE(ctx$export)) {
    d <- .cmail_dialect(ctx)
    tag <- d$field_tag(field)
    if (!in_url && !is.null(field$fallback) && nzchar(field$fallback) && !(key %in% ctx$known$fields)) {
      return(d$conditional(field$tag, tag, .cmail_esc(field$fallback)))
    }
    return(tag)
  }
  value <- ctx$values$fields[[key]] %||% ""
  if (!nzchar(trimws(value)) && !in_url) value <- field$fallback %||% ""
  # En un enlace el valor va crudo: `.cmail_url()` escapa el atributo entero.
  if (in_url) return(value)
  .cmail_field_span(key, .cmail_esc(value), ctx)
}

# En preview, el valor resuelto va teñido y marcado (`data-pulso-field`).
.cmail_field_span <- function(key, html, ctx) {
  if (!isTRUE(ctx$marks)) return(html)
  # En campaña el fondo puede ser oscuro: el tinte claro dejaría el dato ilegible; se marca con un subrayado
  # punteado del mismo color del texto.
  if (isTRUE(ctx$pal$campana)) {
    return(sprintf('<span data-pulso-field="%s" style="border-bottom:1px dashed currentColor;">%s</span>',
                   .cmail_esc(key), html))
  }
  sprintf('<span data-pulso-field="%s" style="background:%s;border-radius:3px;">%s</span>',
          .cmail_esc(key), .CMAIL_FIELD_TINT, html)
}

# Texto de usuario -> HTML inline seguro. Con `links`, `[texto](url)` sale como
# enlace (solo en las propiedades de `.CMAIL_LINK_PROPS`).
.cmail_inline <- function(text, ctx, links = FALSE) {
  out <- .cmail_esc(text)
  # Cada enlace sale por un marcador mientras se leen las marcas de énfasis:
  # un `*` de la URL nunca empareja con uno del texto (collection_mail_marks.R).
  anchors <- character(0)
  if (isTRUE(links)) {
    m <- gregexpr(.CMAIL_LINK_RE, out, perl = TRUE)
    if (m[[1]][[1]] != -1L) {
      anchors <- vapply(regmatches(out, m)[[1]], function(seg) {
        label <- .cmail_marks_html(sub(.CMAIL_LINK_RE, "\\1", seg, perl = TRUE))
        url <- .cmail_unesc(sub(.CMAIL_LINK_RE, "\\2", seg, perl = TRUE))
        sprintf('<a href="%s" target="_blank" style="color:%s;text-decoration:underline;">%s</a>',
                .cmail_url(url, ctx), ctx$link, label)
      }, "", USE.NAMES = FALSE)
      regmatches(out, m) <- list(sprintf("\u0005%d\u0005", seq_along(anchors)))
    }
  }
  out <- .cmail_marks_html(out)
  for (i in seq_along(anchors)) out <- sub(sprintf("\u0005%d\u0005", i), anchors[[i]], out, fixed = TRUE)
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
  out <- .cmail_marks_strip(text)
  for (k in .cmail_tokens(out)) {
    v <- if (isTRUE(ctx$export)) {
      if (identical(k, "nombre")) .cmail_dialect(ctx)$name_tag() else .cmail_dialect(ctx)$field_tag(ctx$fields[[k]])
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

.cmail_unesc <- function(x) {
  for (p in list(c("&lt;", "<"), c("&gt;", ">"), c("&#39;", "'"), c("&quot;", '"'), c("&amp;", "&"))) {
    x <- gsub(p[[1]], p[[2]], x, fixed = TRUE)
  }
  x
}

.cmail_url <- function(url, ctx) {
  out <- as.character(url %||% "")
  for (k in .cmail_tokens(out)) {
    out <- gsub(sprintf("\\{\\{\\s*%s\\s*\\}\\}", k), .cmail_gsub_safe(.cmail_field_value(k, ctx, in_url = TRUE)), out, perl = TRUE)
  }
  if (!isTRUE(ctx$export) && !nzchar(trimws(out))) out <- "#"
  .cmail_esc(out)
}

# ---- imágenes ---------------------------------------------------------------
# Resolución, medidas y `src`: collection_mail_images.R.

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
      # Sin max-width: el editor de Mailchimp dibuja la tarjeta más ancha que
      # 600 px y un tope dejaba una franja blanca al lado (prueba real
      # 2026-10-21). El atributo width="600" sigue fijando el ancho en Outlook.
      '<img src="%s" width="%d" alt="%s" style="display:block;border:0;width:100%%;height:auto;">',
      .cmail_esc(src), .CMAIL_WIDTH, .cmail_esc(img$alt)
    )
    return(.cmail_mark_row(sprintf('<tr><td style="padding:0;line-height:0;font-size:0;">%s</td></tr>', inner),
                           ctx, "__cabecera", "header"))
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
    # El logo conserva su proporción: si a esta altura pasaría de 200 px de ancho, se achica la altura, nunca se
    # aplasta (un logo de 10:1 a 40 px de alto se veía deformado al cortarle el ancho).
    logo_h <- height
    width <- if (is.null(size) || !size$height) 120L else {
      w <- size$width / size$height * height
      if (w > 200) logo_h <- max(16L, as.integer(round(200 / (size$width / size$height))))
      as.integer(min(200, round(w)))
    }
    if (i > 1L) {
      cells <- c(cells, sprintf(
        '<td valign="middle" style="padding:0 18px;"><div style="width:1px;height:%dpx;background-color:%s;line-height:%dpx;font-size:0;">&nbsp;</div></td>',
        height, divider, height
      ))
    }
    # Con las imágenes bloqueadas el cliente pinta el alt: que se lea sobre el fondo.
    alt_style <- sprintf("font-family:%s;font-size:13px;color:%s;", .CMAIL_FONT, if (dark) "#ffffff" else .CMAIL_TEXT_COLOR)
    cells <- c(cells, sprintf('<td valign="middle">%s</td>', .cmail_img_tag(img, ctx, width, logo_h, alt_style)))
  }
  border <- if (dark) "" else sprintf("border-bottom:1px solid %s;", .CMAIL_BORDER)
  .cmail_mark_row(sprintf(
    '<tr><td bgcolor="%s" align="%s" style="background-color:%s;padding:24px 48px 22px 48px;%s"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>%s</tr></table></td></tr>',
    bg, if (dark) "left" else "center", bg, border, paste(cells, collapse = "")
  ), ctx, "__cabecera", "header")
}

# Bloques del cuerpo: collection_mail_blocks.R.

# Pie legal. En export lleva SIEMPRE el pie del dialecto, exista o no el bloque
# footer_legal: Mailchimp rechaza la campaña sin la dirección de la lista y la
# baja; SurveyMonkey exige [OptOutLink]. En preview, el mismo pie simulado.
.cmail_footer_html <- function(template, ctx) {
  footer <- Filter(function(b) identical(b$type, "footer_legal"), template$blocks %||% list())
  footer <- if (length(footer)) footer[[1]] else list()
  text <- .cmail_one(footer$text)
  address <- .cmail_one(footer$address)
  parts <- c(
    if (!is.null(text)) sprintf("<span%s>%s</span>", .cmail_prop(ctx, "text"), .cmail_inline(text, ctx, links = TRUE)),
    if (!is.null(address)) sprintf("<span%s>%s</span>", .cmail_prop(ctx, "address"), .cmail_inline(address, ctx))
  )
  d <- .cmail_dialect(ctx)
  legal <- if (isTRUE(ctx$export)) d$footer() else d$footer_preview()
  # Los enlaces del pie de la plataforma van en gris (#555555): sobre el fondo
  # de campaña se pintan del tono del pie, que sí llega a 4,5:1.
  if (isTRUE(ctx$pal$campana)) legal <- gsub("color:#555555;", sprintf("color:%s;", ctx$pal$footer), legal, fixed = TRUE)
  parts <- c(parts, legal)
  mark <- if (isTRUE(ctx$marks) && !is.null(footer$block_id)) {
    sprintf(' data-pulso-block="%s" data-pulso-type="footer_legal"', .cmail_esc(footer$block_id))
  } else ""
  sprintf(
    '<tr><td align="center"%s style="padding:20px 30px 32px 30px;font-family:%s;font-size:12px;line-height:19px;color:%s;">%s</td></tr>',
    mark, .CMAIL_FONT, ctx$pal$footer, paste(parts, collapse = "<br>")
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

.cmail_first_block_bleeds <- function(template) {
  first <- (template$blocks %||% list())[1][[1]]
  !is.null(first) && identical(first$type, "image") && isTRUE(unlist(first$bleed))
}

#' Renderiza la plantilla a HTML de correo.
#'
#' @param template plantilla validada.
#' @param mode "preview" o "export" ("mailchimp" = export en dialecto mailchimp).
#' @param dialect "mailchimp" o "surveymonkey" (collection_mail_dialects.R).
#' @param values list(nombre, fields = list(key = valor)) para preview.
#' @param images salida de `.cmail_images_resolve()`.
#' @return list(html, subject, preheader, bytes).
#' @keywords internal
collection_mail_render <- function(template, mode = c("preview", "export", "mailchimp"),
                                   dialect = c("mailchimp", "surveymonkey"), values = list(), images = list(),
                                   known = list()) {
  mode <- match.arg(mode)
  dialect <- match.arg(dialect)
  if (identical(mode, "mailchimp")) { mode <- "export"; dialect <- "mailchimp" }
  ctx <- list(
    mode = mode,
    export = identical(mode, "export"),
    dialect = dialect,
    values = values,
    fields = .cmail_field_index(template),
    images = images,
    marks = identical(mode, "preview"),
    # Lo que la audiencia exportada garantiza para TODA persona (`fname`,
    # `saludo`, `fields`): con eso el saludo y los campos salen planos, sin condicionales de Mailchimp
    # que el editor muestra crudas. Sin audiencia (scope «plantilla») no se
    # garantiza nada y el respaldo sigue en el HTML.
    known = known,
    accent = .cmail_one(template$theme$accent) %||% .CMAIL_DEFAULT_ACCENT
  )
  ctx$link <- .cmail_one(template$theme$link) %||% ctx$accent
  # Estilo (sobrio | campana) y alineación: collection_mail_campana.R. En campaña
  # los enlaces del cuerpo van del color del texto.
  ctx$pal <- .cmail_theme_palette(template, ctx$accent, ctx$link)
  ctx$link <- ctx$pal$link
  for (id in .cmail_image_ids(template)) {
    if (is.null(ctx$images[[id]])) ctx$images[[id]] <- .cmail_image_placeholder(id)
  }
  subject <- .cmail_plain(template$subject, ctx)
  preheader <- .cmail_plain(template$preheader, ctx)
  body_rows <- vapply(template$blocks %||% list(), .cmail_block_html, "", ctx = ctx)
  pal <- ctx$pal
  campana <- isTRUE(pal$campana)
  card <- paste0(
    # Campaña: sin tarjeta, la columna lleva el fondo de la página.
    if (campana) sprintf('<table role="presentation" width="%d" cellpadding="0" cellspacing="0" border="0" bgcolor="%s" style="width:100%%;max-width:%dpx;background-color:%s;">',
                         .CMAIL_WIDTH, pal$page_bg, .CMAIL_WIDTH, pal$page_bg)
    else sprintf('<table role="presentation" width="%d" cellpadding="0" cellspacing="0" border="0" style="width:100%%;max-width:%dpx;border:1px solid %s;border-radius:8px;border-collapse:separate;overflow:hidden;background-color:#ffffff;">',
                 .CMAIL_WIDTH, .CMAIL_WIDTH, .CMAIL_BORDER),
    .cmail_header_html(template, ctx),
    # El aire bajo la cabecera separa del texto; si lo primero es una imagen a
    # sangre (un banner bajo la franja de logos) quedaba una raya blanca.
    if (.cmail_first_block_bleeds(template)) "" else '<tr><td style="height:8px;line-height:8px;font-size:0;">&nbsp;</td></tr>',
    paste(body_rows, collapse = ""),
    # Cierre: una línea fina del color de la franja, no un bloque que pese más que el contenido.
    if (campana) "" else sprintf('<tr><td bgcolor="%s" style="background-color:%s;height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>',
                                 .cmail_band_color(template, ctx), .cmail_band_color(template, ctx)),
    "</table>"
  )
  page_bg <- pal$page_bg
  footer_rows <- .cmail_footer_html(template, ctx)
  html <- paste0(
    '<!DOCTYPE html>\n<html lang="es" xmlns="http://www.w3.org/1999/xhtml"><head>',
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="x-apple-disable-message-reformatting">',
    '<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">',
    sprintf("<title>%s</title>", htmltools::htmlEscape(subject)),
    .cmail_justify_style(paste0(card, footer_rows)),
    # two_images se apila en teléfono (E1o, collection_mail_piezas.R).
    .cmail_stack_style(card),
    "</head>\n",
    sprintf('<body style="margin:0;padding:0;background-color:%s;">', page_bg),
    .cmail_preheader_html(preheader),
    sprintf('<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" bgcolor="%s" style="background-color:%s;"><tr><td align="center" style="padding:32px 12px 8px 12px;">',
            page_bg, page_bg),
    card,
    sprintf('<table role="presentation" width="%d" cellpadding="0" cellspacing="0" border="0" style="width:100%%;max-width:%dpx;">%s</table>',
            .CMAIL_WIDTH, .CMAIL_WIDTH, footer_rows),
    "</td></tr>", .cmail_onda_html(ctx), "</table></body></html>\n"
  )
  html <- enc2utf8(html)
  list(
    mode = mode,
    dialect = dialect,
    html = html,
    subject = subject,
    preheader = preheader,
    bytes = as.integer(nchar(html, type = "bytes"))
  )
}

# Franja de cierre de la tarjeta (H-l2): `theme.band` = acento | suave; sin
# declarar, acento con cabecera oscura y gris en el resto (lo de siempre).
.cmail_band_color <- function(template, ctx) {
  band <- .cmail_one(template$theme$band)
  if (identical(band, "acento")) return(ctx$accent)
  if (identical(band, "suave")) return("#f3f3f3")
  if (identical(template$header$background, "dark")) ctx$accent else "#f3f3f3"
}

# Etiquetas que la plantilla usa de verdad (FNAME incluido si aparece {{nombre}}).
.cmail_used_keys <- function(template) {
  texts <- c(
    as.character(template$subject %||% ""), as.character(template$preheader %||% ""),
    unlist(lapply(template$blocks %||% list(), function(b) {
      unlist(b[setdiff(names(b), .CMAIL_NON_TEXT_KEYS)], use.names = FALSE)
    }), use.names = FALSE)
  )
  unique(unlist(lapply(texts, .cmail_tokens), use.names = FALSE))
}

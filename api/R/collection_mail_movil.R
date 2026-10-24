# collection_mail_movil.R — una segunda imagen para el celular en el bloque
# Imagen (GOAL editor de correos profesional, L12).
#
#   image { …, mobile_ref? }
#
# Una pieza ya diseñada (un afiche, una tabla, una infografía) que cabe en
# 600 px se encoge en el celular a ~327 px: sus letras quedan de ~9 px. Con
# `mobile_ref`, el correo lleva las dos: la de PC se oculta bajo 480 px y la
# del celular aparece en su lugar, a todo el ancho de la columna.
#
# **Sin riesgo donde no hay media queries.** La del celular va oculta por
# defecto (`display:none`, `max-height:0`, `mso-hide:all`) y dentro de un
# comentario condicional que Outlook de escritorio no lee: un cliente que no
# aplica la media query muestra la de PC, como siempre. Comparte el texto
# alternativo y el enlace del bloque; no se recorta (es otra pieza, ya
# compuesta para el celular).

.CMAIL_PC_CLASS <- "cmail-pc"
.CMAIL_MOVIL_CLASS <- "cmail-movil"

.cmail_mobile_problems <- function(b, path) {
  if (is.null(b$mobile_ref)) return(list())
  if (.cmail_image_id_ok(.cmail_one(b$mobile_ref) %||% NA_character_)) return(list())
  list(.cmail_problem(paste0(path, ".mobile_ref"), "bad_image_ref",
                      "La imagen del celular nombra un archivo del proyecto: a-z, 0-9 y guiones (sin _)."))
}

.cmail_mobile_ref <- function(b) {
  id <- .cmail_one(b$mobile_ref)
  if (is.null(id) || !nzchar(id)) NULL else id
}

#' La versión del celular de un bloque Imagen, oculta por defecto; "" si no
#' tiene o si su archivo no se puede mostrar (entonces queda la de PC sola).
#' @keywords internal
.cmail_mobile_tag <- function(b, ctx, alt) {
  id <- .cmail_mobile_ref(b)
  if (is.null(id)) return("")
  img <- ctx$images[[id]] %||% .cmail_image_placeholder(id)
  src <- .cmail_image_src(img, ctx)
  # SurveyMonkey sin URL https da `src=""`: sin imagen que mostrar, queda la de PC sola.
  if (is.null(src) || !nzchar(src)) return("")
  # A sangre llena la tarjeta como la de PC; si no, la columna de texto.
  col <- if (isTRUE(unlist(b$bleed))) as.integer(ctx$width %||% .CMAIL_WIDTH) else .cmail_text_col(ctx$width %||% .CMAIL_WIDTH)
  w <- if (.cmail_size_ok(img$size)) as.integer(min(col, img$size$width)) else col
  sprintf(paste0(
    '<!--[if !mso]><!--><div class="%s" style="display:none;max-height:0;overflow:hidden;mso-hide:all;">',
    '<img src="%s" width="%d" alt="%s"%s style="display:block;width:100%%;max-width:%dpx;height:auto;border:0;outline:none;text-decoration:none;margin:0 auto;">',
    '</div><!--<![endif]-->'),
    .CMAIL_MOVIL_CLASS, .cmail_esc(src), w, .cmail_esc(alt), .cmail_prop(ctx, "mobile_ref"), w)
}

# Regla del `<head>`: sólo si el cuerpo trae una versión para el celular.
.cmail_movil_style <- function(body) {
  if (!grepl(sprintf('class="%s"', .CMAIL_MOVIL_CLASS), body, fixed = TRUE)) return("")
  sprintf(paste0('<style type="text/css">@media only screen and (max-width:480px){',
                 '.%s{display:none !important;max-height:0 !important;overflow:hidden !important;}',
                 '.%s{display:block !important;max-height:none !important;overflow:visible !important;}}</style>'),
          .CMAIL_PC_CLASS, .CMAIL_MOVIL_CLASS)
}

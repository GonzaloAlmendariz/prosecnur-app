# collection_mail_ajustes.R — «Ajustes del correo» (E1p): ancho de la columna,
# fondo de la página en estilo sobrio y márgenes en teléfono. Ampliación del
# tema sin cambio de esquema (patrón de `theme.band`/`theme.estilo`).
#
# Decisión de Gonzalo (2026-10-21): «justificado por defecto, sin fondo suave y
# 600 px, pero puedes jugar con ello, el fondo puede ser del mismo color con
# cuentagotas que el encabezado u otro elemento del correo y el ancho cuál es el
# ancho recomendable para teléfono sin que se vea demasiado escueto».
#
#   width    560 | 600 | 640 (número)    ambos estilos; defecto 600
#            La columna (tarjeta en sobrio, columna de color en campaña), el
#            banner de cabecera y la imagen a sangre, la onda del pie, el tope de
#            las imágenes del cuerpo, la columna de texto (ancho − 2 × 48) que
#            usan two_images y el ornamento onda. Con 600 nada cambia.
#   page_bg  "#rrggbb"   ahora también en sobrio: el fondo de la página fuera de
#            la tarjeta. Sin declarar, el gris de siempre (`.CMAIL_PAGE_BG`). Si
#            se declara, el pie (fuera de la tarjeta: dirección y baja) toma la
#            tinta atenuada de más contraste sobre ese fondo, como en campaña, y
#            la revisión mide su contraste.
#
# Teléfono: en `max-width:480px` las celdas del cuerpo con margen lateral de
# 48 px (clase `cmail-pad`) bajan a 20 px. La letra del cuerpo se queda en 16 px.
# La regla del `<head>` se emite siempre.
#
# Chequeo del pie en sobrio: se reusa el código `campana_footer_contrast` (no se
# crea `page_footer_contrast`). Motivo: el front tiene ese código en listas
# cerradas (`MAIL_CHECK_CODES`, rótulo «El pie se lee sobre el fondo», cómo
# arreglarlo y la lectura de Identidad › Estilo); un código nuevo se perdería en
# silencio hasta que el front lo registre. El significado es el mismo en los
# dos estilos: el pie legal sobre `page_bg`, con target `__identidad.page_bg`.

.CMAIL_WIDTHS <- c(560L, 600L, 640L)
.CMAIL_WIDTH_DEFAULT <- 600L
.CMAIL_PAD_CLASS <- "cmail-pad"
.CMAIL_PAD_MOBILE_PX <- 20L
.CMAIL_PAD_COL_PX <- 48L

# ---- ancho --------------------------------------------------------------------

.cmail_width_value <- function(x) {
  if (is.list(x) && length(x) == 1L) x <- x[[1]]
  if (!is.numeric(x) || length(x) != 1L || is.na(x) || !(x %in% .CMAIL_WIDTHS)) return(NULL)
  as.integer(x)
}

#' Ancho de la columna del correo declarado en el tema (560, 600 o 640).
#' @keywords internal
.cmail_theme_width <- function(theme) {
  if (!is.list(theme)) return(.CMAIL_WIDTH_DEFAULT)
  .cmail_width_value(theme[["width"]]) %||% .CMAIL_WIDTH_DEFAULT
}

# Columna de texto: el ancho menos los márgenes laterales (600 -> 504).
.cmail_text_col <- function(width = .CMAIL_WIDTH_DEFAULT) as.integer(width) - 2L * .CMAIL_PAD_COL_PX

# Ancho máximo de cada imagen de two_images: media columna menos medio canal (600 -> 244).
.cmail_pair_max_w <- function(width = .CMAIL_WIDTH_DEFAULT) .cmail_text_col(width) %/% 2L - .CMAIL_PAIR_GAP

# ---- validación ---------------------------------------------------------------

#' Problemas de `theme.width` (los de `page_bg` los da `.cmail_theme_style_problems`).
#' @keywords internal
.cmail_ajustes_problems <- function(theme) {
  if (is.null(theme[["width"]]) || !is.null(.cmail_width_value(theme[["width"]]))) return(list())
  list(.cmail_problem("template.theme.width", "bad_width",
                      sprintf("El ancho del correo es %s px.", paste(.CMAIL_WIDTHS, collapse = ", "))))
}

# ---- teléfono -----------------------------------------------------------------

# ` class="…"` con las clases no vacías.
.cmail_class_attr <- function(...) {
  cls <- c(...)
  cls <- cls[nzchar(cls)]
  if (!length(cls)) "" else sprintf(' class="%s"', paste(cls, collapse = " "))
}

# Regla del `<head>`: márgenes laterales del cuerpo a 20 px en teléfono.
.cmail_pad_style <- function() {
  sprintf('<style type="text/css">@media only screen and (max-width:480px){.%s{padding-left:%dpx !important;padding-right:%dpx !important;}}</style>',
          .CMAIL_PAD_CLASS, .CMAIL_PAD_MOBILE_PX, .CMAIL_PAD_MOBILE_PX)
}

# ---- logos de la cabecera en teléfono ----------------------------------------------
#
# La fila de logos tiene ancho fijo en px: dos logos de 160 px y el divisor (357 px)
# no caben en la tarjeta de un teléfono de 390 px (324 px útiles) y la página se
# desplazaba 33 px en horizontal. En `max-width:480px` cada logo lleva
# `max-width:100%` y `height:auto`: se ACHICA PROPORCIONALMENTE, nunca se aplasta,
# y las celdas reparten el ancho. Si al achicarse alguno quedaría por debajo de
# 90 px (ilegible) en un teléfono de 360 px, los logos se APILAN y el divisor se
# oculta. Outlook ignora las media queries: ahí la fila sigue como en escritorio.
#
# Evidencia (Playwright/Chromium, 2026-10-21): dos logos de 160 px quedan de
# 143,5 px a 390 y de 108,5 px a 320; dos de 200 px (el tope, p. ej. 10:1) de
# 128,5 px a 360 y 108,5 a 320; uno de 200 (10:1) con uno de 160 de 120,5 y
# 96,5 a 320: con dos logos nunca se baja de 90. Tres de 160/150/138 a 360
# quedarían de ~68 px: se apilan. El reparto entre celdas sale proporcional al
# ancho de cada logo, como asume `.cmail_logos_stack`.

.CMAIL_LOGO_CLASS <- "cmail-logo"
.CMAIL_LOGO_CELL_CLASS <- "cmail-logo-cell"
.CMAIL_LOGO_NEXT_CLASS <- "cmail-logo-next"
.CMAIL_LOGO_DIV_CLASS <- "cmail-logo-div"
.CMAIL_LOGO_GAP_PX <- 37L          # divisor: 18 + 1 + 18
.CMAIL_LOGO_MIN_PX <- 90L          # por debajo, un logo deja de leerse
.CMAIL_LOGO_STACK_GAP_PX <- 12L
# Teléfono de referencia de 360 px: menos el margen de la página (12 + 12), el
# borde de la tarjeta (1 + 1) y los márgenes de la cabecera en teléfono (20 + 20).
.CMAIL_LOGO_PHONE_PX <- 360L - 24L - 2L - 2L * .CMAIL_PAD_MOBILE_PX

#' ¿Se apilan los logos en teléfono? Sí cuando, achicados en la misma
#' proporción para caber en el teléfono de referencia, alguno quedaría por
#' debajo de 90 px.
#' @keywords internal
.cmail_logos_stack <- function(widths, avail = .CMAIL_LOGO_PHONE_PX) {
  widths <- as.numeric(widths)
  if (length(widths) < 2L) return(FALSE)
  room <- avail - .CMAIL_LOGO_GAP_PX * (length(widths) - 1L)
  scale <- room / sum(widths)
  if (scale >= 1) return(FALSE)
  any(widths * scale < .CMAIL_LOGO_MIN_PX)
}

# Reglas del `<head>` para la fila de logos (solo si el correo la trae).
.cmail_logo_style <- function(body) {
  # Prefijo: también la fila apilada cuyos logos aún no tienen archivo (preview).
  if (!grepl(sprintf('class="%s', .CMAIL_LOGO_CLASS), body, fixed = TRUE)) return("")
  stack <- if (grepl(sprintf('class="%s', .CMAIL_LOGO_CELL_CLASS), body, fixed = TRUE)) sprintf(
    ".%s{display:block !important;}.%s{padding-top:%dpx !important;}.%s{display:none !important;}",
    .CMAIL_LOGO_CELL_CLASS, .CMAIL_LOGO_NEXT_CLASS, .CMAIL_LOGO_STACK_GAP_PX, .CMAIL_LOGO_DIV_CLASS
  ) else ""
  sprintf('<style type="text/css">@media only screen and (max-width:480px){.%s{max-width:100%% !important;height:auto !important;}%s}</style>',
          .CMAIL_LOGO_CLASS, stack)
}

# ---- fondo de la página en sobrio ------------------------------------------------

#' Fondo de la página y tono del pie en sobrio. Sin `page_bg` (o igual al gris
#' de siempre) las constantes de siempre; con él, la tinta atenuada de más
#' contraste sobre ese fondo, como en campaña.
#' @keywords internal
.cmail_sobrio_page <- function(theme) {
  page_bg <- .cmail_theme_value(theme, "page_bg") %||% .CMAIL_PAGE_BG
  if (identical(page_bg, .CMAIL_PAGE_BG)) {
    return(list(page_bg = .CMAIL_PAGE_BG, footer = .CMAIL_FOOTER_TEXT, page_custom = FALSE))
  }
  ink <- .cmail_best_ink(page_bg, c("#ffffff", .CMAIL_TEXT_COLOR))
  list(page_bg = page_bg, footer = .cmail_soft_ink(ink, page_bg), page_custom = TRUE)
}

# ---- revisión -------------------------------------------------------------------

#' Chequeo del pie legal sobre el fondo de la página (`campana_footer_contrast`;
#' lo usan campaña y sobrio con `page_bg` propio).
#' @keywords internal
.cmail_footer_contrast_check <- function(pal) {
  foot <- round(.cmail_contrast(pal$footer, pal$page_bg), 2)
  fmt <- function(x) formatC(x, format = "f", digits = 2, decimal.mark = ",")
  if (foot < .CMAIL_CONTRAST_MIN) {
    return(.cmail_check("campana_footer_contrast", "error", foot,
                        sprintf("El pie legal sobre el fondo %s tiene contraste %s:1 (mínimo 4,5:1): la dirección y la baja deben leerse. Elige en Identidad un fondo de página más oscuro o más claro.",
                                pal$page_bg, fmt(foot)),
                        targets = list(.cmail_identity_target("page_bg"))))
  }
  .cmail_check("campana_footer_contrast", "ok", foot, sprintf("El pie legal se lee sobre el fondo: %s:1.", fmt(foot)))
}

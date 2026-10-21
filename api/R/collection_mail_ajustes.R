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

# collection_mail_box.R — estilo propio de cada bloque: la «caja» (GOAL editor de
# correos profesional, L2; benchmark docs/qa/benchmark-editores-correo-2026-10.md §2).
#
# Un bloque puede llevar `box = { bg, border, corners, spacing, text }`. Sin
# `box`, el bloque sale exactamente como antes (paridad). Con `box`, sus filas
# van dentro de una tarjeta a 24 px de los bordes del correo, con fondo, borde,
# esquinas, espaciado y color de texto.
#
# **Solo valores cerrados, nunca CSS libre** (como collection_mail_styles.R):
#   bg      papel · tinte · acento · tinta · #rrggbb (color libre)
#   border  ninguno · fino · acento
#   corners rectas · suaves · redondas            (0 · 8 · 16 px)
#   spacing compacto · normal · amplio            (arriba 12 · 20 · 36 px)
#   text    auto · tinta · acento · blanco
# Los nombres de la paleta se guardan como nombre, no como hex: cambiar el
# acento re-viste toda caja «tinte» o «acento» del correo.
#
# **Margen interior.** Las filas de cada bloque traen su margen lateral de 48 px
# (46 en recuadros e imágenes). Dentro de la caja, ese margen baja a 24 px (22)
# para que el texto quede a 48 del borde del correo, como fuera de ella: la
# caja reescribe SOLO el `padding:` de las celdas que escribe este render
# (`.cmail_box_inner_pad`). En teléfono la caja baja a 12 px de los bordes y sus
# celdas a 12 px (el texto, a 24).
#
# **Contraste.** Con `text = auto` la tinta es la que más contrasta con el fondo
# (texto del tema, blanco o tinta oscura); el botón que no se distingue del
# fondo invierte sus colores. Outlook de Windows ignora `border-radius`: la caja
# sale con esquinas rectas ahí (degradación aceptada en el benchmark).

.CMAIL_BOX_KEYS <- c("bg", "border", "corners", "spacing", "text")
.CMAIL_BOX_BG_NAMES <- c("papel", "tinte", "acento", "tinta")
.CMAIL_BOX_ENUMS <- list(
  border = c("ninguno", "fino", "acento"),
  corners = c("rectas", "suaves", "redondas"),
  spacing = c("compacto", "normal", "amplio"),
  text = c("auto", "tinta", "acento", "blanco")
)
.CMAIL_BOX_RADIUS <- c(rectas = 0L, suaves = 8L, redondas = 16L)
.CMAIL_BOX_SPACING <- list(compacto = c(12L, 0L), normal = c(20L, 4L), amplio = c(36L, 20L))
.CMAIL_BOX_INSET <- 24L
.CMAIL_BOX_INSET_MOBILE <- 12L
.CMAIL_BOX_CLASS <- "cmail-box"
# Tipos que no admiten caja: el pie legal no se dibuja como bloque.
.CMAIL_BOX_EXCLUDED <- c("footer_legal")

.cmail_box_hex_ok <- function(x) is.character(x) && length(x) == 1L && grepl("^#[0-9a-fA-F]{6}$", x)

# ---- validación ---------------------------------------------------------------

.cmail_box_problems <- function(box, path) {
  if (!is.list(box) || (length(box) && is.null(names(box)))) {
    return(list(.cmail_problem(path, "bad_box", "box es un objeto con bg, border, corners, spacing y text.")))
  }
  out <- list()
  push <- function(p) out[[length(out) + 1L]] <<- p
  for (k in setdiff(names(box), .CMAIL_BOX_KEYS)) {
    push(.cmail_problem(paste0(path, ".", k), "unknown_key", sprintf("`%s` no pertenece al estilo del bloque.", k)))
  }
  if (!is.null(box$bg)) {
    v <- .cmail_one(box$bg)
    if (is.null(v) || !(v %in% .CMAIL_BOX_BG_NAMES || .cmail_box_hex_ok(v))) {
      push(.cmail_problem(paste0(path, ".bg"), "bad_box_bg",
        sprintf("bg es %s o un color #rrggbb.", paste(.CMAIL_BOX_BG_NAMES, collapse = ", "))))
    }
  }
  for (k in names(.CMAIL_BOX_ENUMS)) {
    if (is.null(box[[k]])) next
    v <- .cmail_one(box[[k]])
    if (is.null(v) || !(v %in% .CMAIL_BOX_ENUMS[[k]])) {
      push(.cmail_problem(paste0(path, ".", k), paste0("bad_box_", k),
        sprintf("%s es %s.", k, paste(.CMAIL_BOX_ENUMS[[k]], collapse = ", "))))
    }
  }
  out
}

# ---- resolución ---------------------------------------------------------------

# La caja del bloque, con sus valores por defecto; NULL si no tiene o no aplica.
.cmail_box_of <- function(b) {
  box <- b$box
  if (!is.list(box) || as.character(b$type %||% "") %in% .CMAIL_BOX_EXCLUDED) return(NULL)
  pick <- function(k, default) .cmail_one(box[[k]]) %||% default
  list(bg = pick("bg", "papel"), border = pick("border", "ninguno"), corners = pick("corners", "suaves"),
       spacing = pick("spacing", "normal"), text = pick("text", "auto"))
}

.cmail_box_bg <- function(box, ctx) {
  accent <- tolower(ctx$accent %||% .CMAIL_DEFAULT_ACCENT)
  switch(box$bg,
    papel = .cmail_card_bg(ctx$pal),
    tinte = .cmail_tint(accent),
    acento = accent,
    tinta = .CMAIL_TEXT_COLOR,
    tolower(box$bg))
}

.cmail_box_ink <- function(box, bg, ctx) {
  accent <- tolower(ctx$accent %||% .CMAIL_DEFAULT_ACCENT)
  switch(box$text,
    tinta = .CMAIL_TEXT_COLOR,
    acento = accent,
    blanco = "#ffffff",
    .cmail_best_ink(bg, unique(c(ctx$pal$text, .CMAIL_TEXT_COLOR, "#ffffff"))))
}

#' Contexto de render de las filas dentro de la caja: la paleta pasa a leerse
#' sobre el fondo de la caja (tinta, gris suave, líneas, paneles y botón).
#' @keywords internal
.cmail_box_ctx <- function(box, ctx) {
  bg <- .cmail_box_bg(box, ctx)
  ink <- .cmail_box_ink(box, bg, ctx)
  pal <- ctx$pal
  pal$box_bg <- bg
  pal$text <- ink
  pal$muted <- .cmail_soft_ink(ink, bg)
  pal$border <- .cmail_mix(ink, bg, 0.18)
  panel <- .cmail_mix(ink, bg, 0.07)
  pal$panel_box <- panel
  pal$panel_bar <- panel
  pal$panel_tint <- panel
  if (.cmail_contrast(pal$bar, bg) < 3) pal$bar <- ink
  if (.cmail_contrast(pal$callout_title, bg) < .CMAIL_CONTRAST_MIN) pal$callout_title <- ink
  # El botón que no se distingue del fondo invierte sus colores.
  if (.cmail_contrast(pal$button_bg, bg) < 3) {
    pal$button_fg <- bg
    pal$button_bg <- ink
  }
  if (.cmail_contrast(pal$outline_fg, bg) < .CMAIL_CONTRAST_MIN) {
    pal$outline_fg <- ink
    pal$outline_border <- ink
  }
  pal$outline_bg <- bg
  ctx$pal <- pal
  if (.cmail_contrast(ctx$link %||% ink, bg) < .CMAIL_CONTRAST_MIN) ctx$link <- ink
  ctx$box <- box
  ctx
}

# ---- render -------------------------------------------------------------------

# Margen lateral de las celdas del bloque dentro de la caja: 48 → 24 y 46 → 22.
.cmail_box_inner_pad <- function(html) {
  # El primer y tercer valor pueden venir como `0` o como `12px`.
  html <- gsub("padding:([0-9]+(?:px)?) 48px ([0-9]+(?:px)?) 48px", "padding:\\1 24px \\2 24px", html, perl = TRUE)
  gsub("padding:([0-9]+(?:px)?) 46px ([0-9]+(?:px)?) 46px", "padding:\\1 22px \\2 22px", html, perl = TRUE)
}

#' Envuelve las filas de un bloque en su caja.
#' @param html las filas `<tr>` del bloque, ya renderizadas con `.cmail_box_ctx`.
#' @keywords internal
.cmail_box_wrap <- function(html, box, ctx) {
  if (!nzchar(html)) return(html)
  bg <- ctx$pal$box_bg
  space <- .CMAIL_BOX_SPACING[[box$spacing]]
  radius <- .CMAIL_BOX_RADIUS[[box$corners]]
  border <- switch(box$border,
    fino = sprintf("border:1px solid %s;", .cmail_mix(ctx$pal$text, bg, 0.22)),
    acento = sprintf("border-left:4px solid %s;", tolower(ctx$accent %||% .CMAIL_DEFAULT_ACCENT)),
    "")
  # La raya de acento sobre un fondo acento no se vería: va en la tinta.
  if (identical(box$border, "acento") && .cmail_contrast(tolower(ctx$accent %||% .CMAIL_DEFAULT_ACCENT), bg) < 3) {
    border <- sprintf("border-left:4px solid %s;", ctx$pal$text)
  }
  sprintf(paste0(
    '<tr><td class="%s" style="padding:0 %dpx 16px %dpx;">',
    '<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0"><tr>',
    '<td bgcolor="%s" style="background-color:%s;%sborder-radius:%dpx;padding:%dpx 0 %dpx 0;">',
    '<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0">%s</table>',
    '</td></tr></table></td></tr>'
  ), .CMAIL_BOX_CLASS, .CMAIL_BOX_INSET, .CMAIL_BOX_INSET, bg, bg, border, radius, space[[1]], space[[2]],
  .cmail_box_inner_pad(html))
}

# Regla del `<head>`: solo si el cuerpo trae alguna caja (sin cajas, el HTML de
# siempre no cambia).
.cmail_box_style <- function(body) {
  if (!grepl(sprintf('class="%s"', .CMAIL_BOX_CLASS), body, fixed = TRUE)) return("")
  # Dentro de la caja, las celdas bajan a 12 px: el texto queda a 24 del borde
  # del teléfono (fuera de la caja, a 20).
  sprintf(paste0('<style type="text/css">@media only screen and (max-width:480px){',
                 '.%s{padding-left:%dpx !important;padding-right:%dpx !important;}',
                 '.%s .%s{padding-left:%dpx !important;padding-right:%dpx !important;}}</style>'),
          .CMAIL_BOX_CLASS, .CMAIL_BOX_INSET_MOBILE, .CMAIL_BOX_INSET_MOBILE,
          .CMAIL_BOX_CLASS, .CMAIL_PAD_CLASS, .CMAIL_BOX_INSET_MOBILE, .CMAIL_BOX_INSET_MOBILE)
}

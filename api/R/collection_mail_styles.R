# collection_mail_styles.R — estilos por bloque, enlaces dentro del texto y
# contraste del acento (ADR 0110, etapa E1g; `collection_mail_template/v2`).
#
# **Solo enumeraciones cerradas, nunca CSS libre.** Cada clave de estilo admite
# una lista fija de valores; el render traduce cada valor a su CSS inline. Una
# clave fuera de `.CMAIL_BLOCK_KEYS` es `unknown_key` (collection_mail_template.R).
#
# **Claves no textuales (H-d).** `.CMAIL_NON_TEXT_KEYS` es la ÚNICA lista de
# claves de bloque que no son texto de usuario. La leen `.cmail_used_keys`
# (render) y `.cmail_key_usage` (usage): antes cada una tenía su lista escrita a
# mano y una clave nueva (`size`, `width`…) se habría leído como texto.
#
# **Enlace dentro del texto.** `[texto](url)` solo en las propiedades de
# `.CMAIL_LINK_PROPS`; la URL pasa por `.cmail_url_problems` (admite campos) y
# los campos de esa URL cuentan como uso «url» (un vacío bloquea el export).

.CMAIL_STYLE_ENUMS <- list(
  # Los valores nuevos (2026-10-23) van al final: los existentes no cambian.
  paragraph = list(align = c("left", "justify", "center", "right"),
                   size = c("normal", "pequeno", "grande", "muy_grande"),
                   tone = c("normal", "suave", "acento")),
  button = list(align = c("center", "left", "right"), size = c("compacto", "normal", "grande"), fill = c("solido", "contorno")),
  callout = list(variant = c("box", "bar", "tinte")),
  heading = list(level = c("titulo", "subtitulo"), align = c("left", "center", "right")),
  divider = list(style = c("linea", "espacio"), size = c("s", "m", "l")),
  image = list(align = c("left", "center", "right")),
  # Piezas gráficas (E1o, collection_mail_piezas.R).
  band = list(height = c("s", "m", "l")),
  ornament = list(style = c("onda", "puntos", "linea_doble")),
  icon_text = list(icon = c("calendario", "reloj", "candado", "sobre", "persona", "grupo",
                            "mapa", "check", "info", "alerta", "regalo", "enlace"))
)

.CMAIL_NON_TEXT_KEYS <- c("block_id", "type", "variant", "align", "ordered", "size", "tone", "fill",
                          "level", "style", "width", "bleed", "image_ref",
                          "decorative", "color", "height", "icon", "left", "right")

# Propiedades que admiten `[texto](url)`, por tipo de bloque.
.CMAIL_LINK_PROPS <- list(
  paragraph = "text", callout = c("title", "items"), list = "items",
  signature = "lines", footer_legal = "text", icon_text = "text"
)

.CMAIL_LINK_RE <- "\\[([^\\]\\n]+)\\]\\(([^()\\s]+)\\)"

.cmail_links <- function(text) {
  if (!is.character(text) || length(text) != 1L || is.na(text)) return(list())
  m <- regmatches(text, gregexpr(.CMAIL_LINK_RE, text, perl = TRUE))[[1]]
  lapply(m, function(x) list(label = sub(.CMAIL_LINK_RE, "\\1", x, perl = TRUE),
                             url = sub(.CMAIL_LINK_RE, "\\2", x, perl = TRUE)))
}

.cmail_has_link <- function(text) {
  is.character(text) && length(text) == 1L && !is.na(text) && grepl(.CMAIL_LINK_RE, text, perl = TRUE)
}

# Problemas de los enlaces de un texto: URL válida donde se permiten; ningún
# enlace donde no.
.cmail_link_problems <- function(text, path, keys, allowed) {
  value <- .cmail_one(text)
  if (is.null(value) || !.cmail_has_link(value)) return(list())
  if (!allowed) {
    return(list(.cmail_problem(path, "link_not_allowed",
      "Este texto no admite enlaces [texto](url); úsalos en párrafos, recuadros, listas, firma o pie.")))
  }
  out <- list()
  for (l in .cmail_links(value)) out <- c(out, .cmail_url_problems(l$url, path, keys))
  out
}

.cmail_link_allowed <- function(type, prop) prop %in% (.CMAIL_LINK_PROPS[[type]] %||% character(0))

# Las claves de estilo del bloque, contra su enumeración.
.cmail_style_problems <- function(b, type, path) {
  enums <- .CMAIL_STYLE_ENUMS[[type]] %||% list()
  out <- list()
  for (k in names(enums)) {
    if (is.null(b[[k]])) next
    v <- .cmail_one(b[[k]])
    if (is.null(v) || !(v %in% enums[[k]])) {
      out[[length(out) + 1L]] <- .cmail_problem(paste0(path, ".", k), paste0("bad_", k),
        sprintf("%s es %s.", k, paste(enums[[k]], collapse = ", ")))
    }
  }
  out
}

.cmail_style <- function(b, key, default) {
  v <- .cmail_one(b[[key]])
  if (is.null(v)) default else v
}

# ---- color --------------------------------------------------------------------

.cmail_rgb <- function(hex) {
  hex <- sub("^#", "", hex)
  as.integer(strtoi(substring(hex, c(1, 3, 5), c(2, 4, 6)), 16L))
}

.cmail_hex <- function(rgb) sprintf("#%02x%02x%02x", rgb[[1]], rgb[[2]], rgb[[3]])

# Acento mezclado con blanco: `white` es la proporción de blanco (0.92 = tinte).
.cmail_tint <- function(hex, white = 0.92) {
  .cmail_hex(as.integer(round(.cmail_rgb(hex) * (1 - white) + 255 * white)))
}

.cmail_luminance <- function(hex) {
  c <- .cmail_rgb(hex) / 255
  c <- ifelse(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055)^2.4)
  sum(c(0.2126, 0.7152, 0.0722) * c)
}

#' Contraste WCAG entre dos colores #rrggbb.
#' @keywords internal
.cmail_contrast <- function(fg, bg) {
  l <- sort(c(.cmail_luminance(fg), .cmail_luminance(bg)), decreasing = TRUE)
  (l[[1]] + 0.05) / (l[[2]] + 0.05)
}

# ---- tamaño y tono del párrafo ---------------------------------------------------

# px de letra y de línea por `size` del párrafo. `normal` y `pequeno` son los
# de siempre (paridad: el pequeño es 13/20, no 13/21).
.CMAIL_PARAGRAPH_SIZE <- list(pequeno = c(13L, 20L), normal = c(16L, 26L),
                              grande = c(18L, 28L), muy_grande = c(21L, 32L))

.cmail_paragraph_size <- function(b) {
  .CMAIL_PARAGRAPH_SIZE[[.cmail_style(b, "size", "normal")]] %||% .CMAIL_PARAGRAPH_SIZE$normal
}

# Fondo sobre el que se lee el cuerpo: la tarjeta blanca en sobrio, la página
# en campaña (sin tarjeta, collection_mail_render.R).
.cmail_card_bg <- function(pal) if (isTRUE(pal$campana)) pal$page_bg else "#ffffff"

#' Tinta del tono `acento`: el acento del tema si se lee sobre el fondo de la
#' tarjeta (≥ `.CMAIL_CONTRAST_MIN`); si no, el texto normal (`ok = FALSE`,
#' chequeo `paragraph_accent_contrast`).
#' @keywords internal
.cmail_accent_ink <- function(pal, accent) {
  accent <- tolower(accent)
  bg <- .cmail_card_bg(pal)
  ratio <- .cmail_contrast(accent, bg)
  ok <- ratio >= .CMAIL_CONTRAST_MIN
  list(color = if (ok) accent else pal$text, ok = ok, ratio = ratio, accent = accent, bg = bg)
}

.cmail_paragraph_color <- function(b, ctx) {
  switch(.cmail_style(b, "tone", "normal"),
         suave = ctx$pal$muted,
         acento = .cmail_accent_ink(ctx$pal, ctx$accent)$color,
         ctx$pal$text)
}

# ---- campos por bloque (targets) ---------------------------------------------

# Dónde aparece cada clave: lista de {block_id, prop}. `prop` con índice desde 0
# para listas («items.2»), igual que `data-pulso-prop`.
.cmail_key_targets <- function(template, keys) {
  out <- list()
  for (b in template$blocks %||% list()) {
    props <- setdiff(names(b), .CMAIL_NON_TEXT_KEYS)
    for (p in props) {
      v <- b[[p]]
      vals <- if (is.list(v)) unlist(v, use.names = FALSE) else v
      if (!is.character(vals)) next
      for (i in seq_along(vals)) {
        hit <- intersect(.cmail_tokens(vals[[i]]), keys)
        if (!length(hit)) next
        prop <- if (is.list(v) || length(vals) > 1L) sprintf("%s.%d", p, i - 1L) else p
        out[[length(out) + 1L]] <- list(block_id = as.character(b$block_id), prop = prop)
      }
    }
  }
  out
}

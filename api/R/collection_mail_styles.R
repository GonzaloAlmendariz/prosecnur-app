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
  paragraph = list(align = c("left", "justify", "center"), size = c("normal", "pequeno"), tone = c("normal", "suave")),
  button = list(align = c("center", "left"), size = c("compacto", "normal", "grande"), fill = c("solido", "contorno")),
  callout = list(variant = c("box", "bar", "tinte")),
  heading = list(level = c("titulo", "subtitulo"), align = c("left", "center")),
  divider = list(style = c("linea", "espacio"), size = c("s", "m", "l")),
  image = list(align = c("left", "center", "right"))
)

.CMAIL_NON_TEXT_KEYS <- c("block_id", "type", "variant", "align", "ordered", "size", "tone", "fill",
                          "level", "style", "width", "bleed", "image_ref")

# Propiedades que admiten `[texto](url)`, por tipo de bloque.
.CMAIL_LINK_PROPS <- list(
  paragraph = "text", callout = c("title", "items"), list = "items",
  signature = "lines", footer_legal = "text"
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

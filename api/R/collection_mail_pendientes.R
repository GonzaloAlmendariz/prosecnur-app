# collection_mail_pendientes.R — textos de relleno entre corchetes que quedan
# por completar en el correo (chequeo `placeholders_pending` de la revisión).
#
# Las plantillas de casa (collection_mail_template.R) traen frases como
# «[fecha límite]» o «[Nombre del estudio]» para que el autor las complete.
# Exportarlas tal cual mandaría «[fecha límite]» a toda la lista: es `error`.
#
# Dónde se busca: asunto y texto de vista previa (`__sobre`), el alt de las
# imágenes de la cabecera (`__cabecera`) y todo texto de cada bloque (párrafos,
# títulos, botón y su nota, aviso con sus items, firma, apertura del envío
# `__apertura`, alt de los bloques imagen). Un texto de relleno es un par de
# corchetes con al menos una letra o cifra dentro, en una sola línea.
#
# Qué NO cuenta:
#   - un enlace `[texto](url)` (collection_mail_styles.R, `.CMAIL_LINK_RE`);
#   - las etiquetas de SurveyMonkey (`.CMAIL_PLATFORM_TAG_RE`, dialects);
#   - el marcador del alt que falta, «[Describe la imagen]», que ya cuenta
#     `images_alt` (collection_mail_images.R).
# Las marcas de énfasis se quitan antes (`.cmail_marks_strip`): la frase se
# informa como la lee la persona, «[fecha límite]» y no «**[fecha límite]**».

.CMAIL_PLACEHOLDER_RE <- "\\[[^\\[\\]\\n]*[[:alnum:]][^\\[\\]\\n]*\\]"
.CMAIL_PLACEHOLDER_MAX_ITEMS <- 10L

# Frases de relleno de un texto, en su orden y con repeticiones.
.cmail_placeholders_in <- function(text) {
  value <- .cmail_one(text)
  if (!is.character(value) || is.na(value) || !nzchar(value)) return(character(0))
  value <- gsub(.CMAIL_LINK_RE, " ", value, perl = TRUE)
  value <- .cmail_marks_strip(value)
  value <- gsub(.CMAIL_PLATFORM_TAG_RE, " ", value, perl = TRUE)
  value <- gsub(.CMAIL_ALT_MARKER, " ", value, fixed = TRUE)
  hits <- regmatches(value, gregexpr(.CMAIL_PLACEHOLDER_RE, value, perl = TRUE))[[1]]
  as.character(hits)
}

# Textos de un bloque con su `prop`: las listas planas van con índice desde 0
# («items.2»), como `.cmail_key_targets`; una propiedad anidada (el trato) se
# señala entera.
.cmail_block_texts <- function(b) {
  out <- list()
  for (p in setdiff(names(b), .CMAIL_NON_TEXT_KEYS)) {
    v <- b[[p]]
    if (is.character(v) && length(v) == 1L) {
      out[[length(out) + 1L]] <- list(prop = p, text = v)
    } else if (is.list(v) || length(v) > 1L) {
      flat <- is.character(v) || all(vapply(v, function(x) is.character(x) && length(x) == 1L, NA))
      vals <- unlist(v, use.names = FALSE)
      if (!is.character(vals)) next
      for (i in seq_along(vals)) {
        out[[length(out) + 1L]] <- list(prop = if (flat) sprintf("%s.%d", p, i - 1L) else p, text = vals[[i]])
      }
    }
  }
  out
}

# Cada aparición: list(phrase, target).
.cmail_placeholder_hits <- function(tpl) {
  hits <- list()
  add <- function(text, target) {
    for (ph in .cmail_placeholders_in(text)) hits[[length(hits) + 1L]] <<- list(phrase = ph, target = target)
  }
  add(tpl$subject, .cmail_target("__sobre", "subject"))
  add(tpl$preheader, .cmail_target("__sobre", "preheader"))
  h <- tpl$header %||% list()
  head_ids <- if (identical(h$kind, "banner")) as.character(h$image_ref) else
    as.character(unlist(h$logo_ids %||% list(), use.names = FALSE))
  for (id in head_ids) add((tpl$images %||% list())[[id]]$alt, .cmail_target("__cabecera"))
  for (b in tpl$blocks %||% list()) {
    for (t in .cmail_block_texts(b)) add(t$text, .cmail_target(as.character(b$block_id), t$prop))
  }
  hits
}

#' Chequeo `placeholders_pending`: textos de relleno entre corchetes.
#'
#' `value` es cuántas frases distintas quedan; `items`, esas frases tal cual
#' (sin repetir, hasta 10); `targets`, una entrada por aparición.
#' @keywords internal
.cmail_placeholder_check <- function(tpl) {
  hits <- .cmail_placeholder_hits(tpl)
  if (!length(hits)) {
    return(.cmail_check("placeholders_pending", "ok", 0L, "No quedan textos entre corchetes por completar."))
  }
  phrases <- unique(vapply(hits, `[[`, "", "phrase"))
  n <- length(phrases)
  detail <- if (n == 1L) {
    sprintf("Queda 1 texto entre corchetes por completar: %s.", phrases[[1]])
  } else {
    sprintf("Quedan %d textos entre corchetes por completar, como %s.", n, phrases[[1]])
  }
  targets <- unique(lapply(hits, `[[`, "target"))
  .cmail_check("placeholders_pending", "error", n, detail,
               extra = as.list(utils::head(phrases, .CMAIL_PLACEHOLDER_MAX_ITEMS)), targets = targets)
}

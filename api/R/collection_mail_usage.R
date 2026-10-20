# collection_mail_usage.R — dónde usa la plantilla cada campo y si el texto de
# respaldo lo cubre ahí (ADR 0110 §2, revisión «sin dato»).
#
# El respaldo NO se aplica en todos lados (D5). En el HTML que se exporta:
#   - enlace (button.url, signature.url, image.url y la URL de un `[texto](url)`
#     dentro del texto): sin respaldo; un vacío rompe el enlace, así que bloquea
#     la exportación;
#   - asunto y preheader: la etiqueta va sola (*|TAG|*), sin respaldo;
#   - {{nombre}} solo tiene respaldo dentro de un saludo con `fallback`
#     (*|IF:FNAME|*); en cualquier otro texto va solo;
#   - un campo del estudio en el cuerpo (o en el saludo) usa su `fallback`
#     (*|IF:TAG|*) si lo declara.

.cmail_usage_add <- function(acc, keys, where) {
  for (k in keys) acc[[k]] <- unique(c(acc[[k]], where))
  acc
}

#' Contextos de uso por clave: url, asunto, preheader, saludo, saludo_sin_respaldo, cuerpo.
#' @keywords internal
.cmail_key_usage <- function(template) {
  acc <- list()
  acc <- .cmail_usage_add(acc, .cmail_tokens(as.character(template$subject %||% "")), "asunto")
  acc <- .cmail_usage_add(acc, .cmail_tokens(as.character(template$preheader %||% "")), "preheader")
  for (b in template$blocks %||% list()) {
    type <- as.character(b$type %||% "")
    url_keys <- .cmail_tokens(.cmail_one(b$url) %||% "")
    if (type %in% c("button", "signature", "image")) acc <- .cmail_usage_add(acc, url_keys, "url")
    texts <- as.character(unlist(b[setdiff(names(b), c(.CMAIL_NON_TEXT_KEYS, "url", "fallback"))], use.names = FALSE))
    # Un `[texto](url)`: los campos de la URL son uso «url»; los del texto, cuerpo.
    link_urls <- unlist(lapply(texts, function(t) vapply(.cmail_links(t), `[[`, "", "url")), use.names = FALSE)
    acc <- .cmail_usage_add(acc, unique(unlist(lapply(link_urls, .cmail_tokens), use.names = FALSE)), "url")
    texts <- gsub(.CMAIL_LINK_RE, "\\1", texts, perl = TRUE)
    keys <- unique(unlist(lapply(texts, .cmail_tokens), use.names = FALSE))
    if (identical(type, "greeting")) {
      has_fb <- !is.null(.cmail_one(b$fallback))
      acc <- .cmail_usage_add(acc, keys, if (has_fb) "saludo" else "saludo_sin_respaldo")
    } else {
      acc <- .cmail_usage_add(acc, keys, "cuerpo")
    }
  }
  acc
}

#' ¿Cubre el respaldo todos los usos de `key`? En SurveyMonkey no hay
#' respaldo (no tiene condicionales): solo cubre si el campo no se usa (H-j3).
#' @keywords internal
.cmail_fallback_covers <- function(key, uses, field_fallback, dialect = .CMAIL_PLATFORM_DEFAULT) {
  if (!length(uses)) return(TRUE)
  if (identical(dialect, "surveymonkey")) return(FALSE)
  if (any(uses %in% c("url", "asunto", "preheader"))) return(FALSE)
  if (identical(key, "nombre")) return(all(uses == "saludo"))
  !is.null(field_fallback) && nzchar(field_fallback)
}

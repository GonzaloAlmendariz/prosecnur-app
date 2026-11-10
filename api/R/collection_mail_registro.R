# collection_mail_registro.R — tú o usted en el mismo correo (GOAL editor de
# correos profesional, L16; Acreditación Institucional 2026: seis públicos cuyo
# cuerpo sólo cambia en el vocativo, el premio y el trato, mantenidos uno por uno).
#
# Contrato (`template.registro`, opcional, dentro de collection_mail_template/v2):
#
#   registro = "tu" | "usted"          # sin él, "usted"
#
# - En cualquier texto del correo, `[[forma de tú|forma de usted]]` escribe una
#   de las dos según el registro de la campaña: «[[Responde|Responda]] la
#   encuesta», «[[Tus|Sus]] respuestas son confidenciales». Una forma puede ir
#   vacía («gracias[[| a usted]]»).
# - Se resuelve como texto en `.cmail_constants_apply()` —la plantilla efectiva
#   de la vista previa, la revisión, la exportación y Mailchimp—, después de los
#   datos de la campaña: un dato puede traer su propia variante.
# - Sin variantes, el HTML sale byte a byte como antes.
# - Un `[[` o `]]` que no forma una variante es un problema de validación: se
#   iría tal cual al destinatario.

.CMAIL_REGISTROS <- c("tu", "usted")
.CMAIL_REGISTRO_DEFAULT <- "usted"
.CMAIL_VARIANTE_RE <- "\\[\\[([^\\[\\]|]*)\\|([^\\[\\]|]*)\\]\\]"

#' Registro de la plantilla: "tu" o "usted" (por defecto).
#' @keywords internal
.cmail_registro_of <- function(t) {
  r <- .cmail_one(t$registro)
  if (!is.null(r) && r %in% .CMAIL_REGISTROS) r else .CMAIL_REGISTRO_DEFAULT
}

.cmail_variantes_sub <- function(x, cual) {
  if (!is.character(x) || !length(x) || !any(grepl("[[", x, fixed = TRUE))) return(x)
  gsub(.CMAIL_VARIANTE_RE, if (identical(cual, "tu")) "\\1" else "\\2", x, perl = TRUE)
}

.cmail_variantes_walk <- function(x, cual) {
  if (is.character(x)) return(.cmail_variantes_sub(x, cual))
  if (is.list(x)) {
    nm <- names(x)
    x <- lapply(x, .cmail_variantes_walk, cual = cual)
    names(x) <- nm
  }
  x
}

#' La plantilla con cada `[[tú|usted]]` escrito según su registro.
#' @keywords internal
.cmail_registro_apply <- function(t) {
  cual <- .cmail_registro_of(t)
  for (k in c("subject", "preheader", "blocks")) if (!is.null(t[[k]])) t[[k]] <- .cmail_variantes_walk(t[[k]], cual)
  t
}

# Cada texto de `x` con su ruta, para validar y contar.
.cmail_registro_textos <- function(x, path) {
  if (is.character(x)) return(stats::setNames(as.list(x), rep(path, length(x))))
  if (!is.list(x)) return(list())
  nm <- names(x)
  out <- list()
  for (i in seq_along(x)) {
    sub <- if (!is.null(nm) && nzchar(nm[[i]])) paste0(path, ".", nm[[i]]) else sprintf("%s[%d]", path, i)
    out <- c(out, .cmail_registro_textos(x[[i]], sub))
  }
  out
}

.cmail_registro_textos_de <- function(template) {
  c(.cmail_registro_textos(template$subject, "template.subject"),
    .cmail_registro_textos(template$preheader, "template.preheader"),
    .cmail_registro_textos(template$blocks, "template.blocks"),
    .cmail_registro_textos(lapply(template$constants %||% list(), function(c) c$value), "template.constants"))
}

#' Problemas de `registro` y de las variantes mal cerradas.
#' @keywords internal
.cmail_registro_problems <- function(template) {
  p <- list()
  if (!is.null(template$registro)) {
    r <- .cmail_one(template$registro)
    if (is.null(r) || !(r %in% .CMAIL_REGISTROS)) {
      p[[length(p) + 1L]] <- .cmail_problem("template.registro", "bad_registro", "El trato es «tu» o «usted».")
    }
  }
  textos <- .cmail_registro_textos_de(template)
  for (i in seq_along(textos)) p <- c(p, .cmail_variante_problems(textos[[i]], names(textos)[[i]]))
  p
}

#' `bad_variante` si un texto trae `[[` o `]]` que no forman una variante. Lo usan
#' la plantilla y los envíos (asunto, vista previa y apertura de cada uno).
#' @keywords internal
.cmail_variante_problems <- function(s, path) {
  s <- .cmail_one(s)
  if (is.null(s) || is.na(s) || (!grepl("[[", s, fixed = TRUE) && !grepl("]]", s, fixed = TRUE))) return(list())
  resto <- gsub(.CMAIL_VARIANTE_RE, "", s, perl = TRUE)
  if (!grepl("[[", resto, fixed = TRUE) && !grepl("]]", resto, fixed = TRUE)) return(list())
  list(.cmail_problem(path, "bad_variante",
    "Una variante de trato se escribe [[forma de tú|forma de usted]]: con una sola barra y cerrada."))
}

#' Cuántas variantes de trato lleva la plantilla (asunto, vista previa, bloques y datos).
#' @keywords internal
.cmail_registro_variantes <- function(template) {
  textos <- unlist(.cmail_registro_textos_de(template), use.names = FALSE)
  if (!length(textos)) return(0L)
  sum(vapply(gregexpr(.CMAIL_VARIANTE_RE, textos, perl = TRUE), function(m) sum(m > 0L), 0L))
}

# collection_mail_text.R — limpieza de texto de los destinatarios del correo
# (ADR 0110 §2). Una sola definición de «correo», «vacío» y «nombre de pila»
# para la importación, la revisión, la vista previa y la exportación.
#
# Correo (unidad = persona contactable, identificada por su correo):
#   - se limpian los espacios duros (NBSP, U+2007, U+202F) y los invisibles
#     (U+200B-U+200D, U+2060, U+FEFF) que trae el copiado desde Excel o la web;
#   - se quita un `mailto:` inicial;
#   - es válido solo si casa `.CMAIL_EMAIL_STRICT_RE` (parte local ASCII sin
#     puntos al borde ni dobles, dominio con al menos un punto y TLD de 2+
#     letras);
#   - se compara en minúsculas y se exporta tal como quedó tras limpiarlo.
#
# Vacío: celda vacía, solo espacios o un marcador estándar de «sin dato»
# (`.CMAIL_EMPTY_MARKERS`, sin distinguir mayúsculas). No hay códigos 90-99:
# esto es una lista de contactos, no una base de respuestas.

.CMAIL_EMAIL_STRICT_RE <- paste0(
  "^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*",
  "@([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\\.)+[A-Za-z]{2,}$"
)
# Para ocultar: cualquier cosa con forma de correo dentro de un texto.
.CMAIL_EMAIL_LIKE_RE <- "[^[:space:]@<>\"']+@[^[:space:]@<>\"']+\\.[^[:space:]@<>\"']+"
.CMAIL_EMAIL_MASK <- "[correo oculto]"
.CMAIL_EMPTY_MARKERS <- c("NA", "N/A", "#N/A", "-", "S/D")
.CMAIL_EMPTY_MARKERS_LABEL <- "NA, N/A, #N/A, -, s/d"
.CMAIL_NAME_PARTICLES <- c("de", "del", "la", "las", "los", "y", "e", "da", "do", "dos", "van", "von")

#' Limpia un texto de celda: espacios duros a espacio, invisibles fuera, trim.
#' @keywords internal
.cmail_clean_text <- function(x) {
  x <- enc2utf8(as.character(x))
  x[is.na(x)] <- ""
  x <- stringi::stri_replace_all_regex(x, "[\\u00A0\\u2007\\u202F]", " ")
  x <- stringi::stri_replace_all_regex(x, "[\\u200B\\u200C\\u200D\\u2060\\uFEFF]", "")
  trimws(x)
}

#' TRUE si la celda cuenta como «sin dato».
#' @keywords internal
.cmail_is_empty <- function(x) {
  v <- .cmail_clean_text(x)
  !nzchar(v) | toupper(v) %in% .CMAIL_EMPTY_MARKERS
}

#' Valor exportable: limpio, y "" si es un marcador de vacío.
#' @keywords internal
.cmail_value <- function(x) {
  v <- .cmail_clean_text(x)
  v[toupper(v) %in% .CMAIL_EMPTY_MARKERS] <- ""
  v
}

#' Correo normalizado (sin espacios al borde, sin `mailto:`, vacío si es marcador).
#' @keywords internal
.cmail_email_normalize <- function(x) {
  v <- .cmail_value(x)
  trimws(sub("^mailto:", "", v, ignore.case = TRUE))
}

.cmail_email_valid <- function(x) grepl(.CMAIL_EMAIL_STRICT_RE, x, perl = TRUE) & !grepl("..", x, fixed = TRUE)

#' Oculta todo valor con forma de correo (D6: nunca llegan a la vista).
#' @keywords internal
.cmail_mask_pii <- function(x) {
  if (is.null(x)) return(x)
  if (is.list(x)) return(lapply(x, .cmail_mask_pii))
  if (!is.character(x)) return(x)
  hit <- !is.na(x) & grepl(.CMAIL_EMAIL_LIKE_RE, x)
  x[hit] <- .CMAIL_EMAIL_MASK
  x
}

#' Tipo título en castellano, con partículas (de, del, la, ...) en minúscula
#' salvo al inicio. Cosmético: es el saludo, no un dato de análisis.
#' @keywords internal
.cmail_title_case <- function(x) {
  x <- gsub("\\s+", " ", .cmail_clean_text(x))
  if (!nzchar(x)) return("")
  t <- stringi::stri_trans_totitle(stringi::stri_trans_tolower(x, locale = "es"),
                                   opts_brkiter = stringi::stri_opts_brkiter(type = "word", locale = "es"))
  words <- strsplit(t, " ", fixed = TRUE)[[1]]
  if (length(words) > 1L) {
    low <- stringi::stri_trans_tolower(words, locale = "es")
    part <- seq_along(words) > 1L & low %in% .CMAIL_NAME_PARTICLES
    words[part] <- low[part]
  }
  paste(words, collapse = " ")
}

.cmail_comma_count <- function(x) lengths(regmatches(x, gregexpr(",", x, fixed = TRUE)))

#' Nombre de pila (FNAME) de una celda.
#'
#' `apellidos_coma_nombres`: con exactamente una coma, lo que va después; con
#' cero o dos o más comas no se puede separar y se usa el nombre completo (sin
#' comas), marcado `unsplit`. `nombre`: la cadena entera; en tipo título si
#' venía toda en mayúsculas o toda en minúsculas.
#' @keywords internal
.cmail_first_name <- function(value, format) {
  value <- .cmail_value(value %||% "")
  if (!length(value) || !nzchar(value[[1]])) return(list(name = "", unsplit = FALSE))
  value <- value[[1]]
  if (identical(format, "apellidos_coma_nombres")) {
    if (.cmail_comma_count(value) == 1L) {
      after <- trimws(sub("^[^,]*,", "", value))
      if (nzchar(after)) return(list(name = .cmail_title_case(after), unsplit = FALSE))
    }
    return(list(name = .cmail_title_case(gsub(",", " ", value, fixed = TRUE)), unsplit = TRUE))
  }
  if (identical(toupper(value), value) || identical(tolower(value), value)) value <- .cmail_title_case(value)
  list(name = value, unsplit = FALSE)
}

#' Formato del nombre: por el encabezado («apellido») o por el contenido (la
#' mitad o más de los valores con exactamente una coma).
#' @keywords internal
.cmail_name_format <- function(name_column, values = NULL) {
  if (is.null(name_column)) return("nombre")
  if (grepl("apellido", .cmail_norm_header(name_column))) return("apellidos_coma_nombres")
  v <- .cmail_value(values %||% character(0))
  v <- v[nzchar(v)]
  if (length(v) && mean(.cmail_comma_count(v) == 1L) >= 0.5) return("apellidos_coma_nombres")
  "nombre"
}

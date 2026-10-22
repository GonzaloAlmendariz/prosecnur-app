# collection_mail_contactos_rotulos.R — rótulos legibles de las columnas de la
# lista de contactos (pestaña Contactos, ADR 0112 §3).
#
# La CLAVE de una columna no cambia nunca (filtros, variables de control y el
# cruce siguen por `key`); solo el `label` que ve la persona. Precedencia:
#   1. la columna del enlace generado -> «Enlace a la encuesta»;
#   2. la columna mapeada a un campo de la plantilla con `label` -> ese label
#      (si dos campos apuntan a la misma columna, gana el primero declarado);
#   3. la clave humanizada (`.cmail_rotulo_de_clave`).
#
# La humanización está alineada con `rotuloDeClave` del front
# (frontend/src/features/recopiladores/correos/camposDeclarados.ts): `_` -> espacio
# y primera letra en mayúscula. Además, `-` -> espacio, un encabezado todo en
# MAYÚSCULAS se baja a minúsculas antes, y se reparan tildes/ñ de palabras
# completas comunes en encabezados ASCII (anio -> año, region -> región, …).
# «ano» se deja tal cual a propósito: es ambiguo.

.CMAIL_ROTULO_TILDES <- c(
  anio = "año", region = "región", telefono = "teléfono", codigo = "código",
  situacion = "situación", condicion = "condición", genero = "género",
  educacion = "educación", pais = "país", numero = "número",
  categoria = "categoría", direccion = "dirección"
)

#' Rótulo legible de una clave de columna («anio_egreso» -> «Año egreso»).
#' @keywords internal
.cmail_rotulo_de_clave <- function(key) {
  key <- as.character(key)
  vapply(key, function(k) {
    if (is.na(k)) return(NA_character_)
    t <- k
    if (!grepl("[[:lower:]]", t) && grepl("[[:upper:]]", t)) t <- tolower(t)
    t <- trimws(gsub("[[:space:]]+", " ", gsub("[_-]+", " ", t)))
    if (!nzchar(t)) return(k)
    words <- strsplit(t, " ", fixed = TRUE)[[1]]
    low <- tolower(words)
    hit <- low %in% names(.CMAIL_ROTULO_TILDES)
    words[hit] <- unname(.CMAIL_ROTULO_TILDES[low[hit]])
    t <- paste(words, collapse = " ")
    paste0(toupper(substr(t, 1L, 1L)), substr(t, 2L, nchar(t)))
  }, "", USE.NAMES = FALSE)
}

# Columna -> label declarado en la plantilla, vía el mapeo del store
# (`mapping$fields[[campo]] = columna`) o porque la columna se llama como el campo.
.cmail_template_column_labels <- function(store, template) {
  out <- character(0)
  fields <- template$fields %||% list()
  if (!is.list(fields)) return(out)
  mapped <- store$mapping$fields %||% list()
  for (f in fields) {
    if (!is.list(f)) next
    key <- .cmail_one(as.list(f$key %||% list(NA_character_)))
    label <- .cmail_one(as.list(f$label %||% list(NA_character_)))
    if (is.null(key) || is.null(label) || !nzchar(trimws(label))) next
    col <- .cmail_one(as.list(mapped[[key]] %||% list(NA_character_)))
    for (cc in unique(c(col, key))) {
      if (nzchar(cc) && !(cc %in% names(out))) out[[cc]] <- trimws(label)
    }
  }
  out
}

#' Rótulos de las columnas `cols` de la lista (named chr key -> label).
#' @keywords internal
.cmail_column_labels <- function(store, template, cols) {
  cols <- as.character(cols)
  declared <- .cmail_template_column_labels(store, template)
  labels <- .cmail_rotulo_de_clave(cols)
  hit <- cols %in% names(declared)
  labels[hit] <- unname(declared[cols[hit]])
  labels[cols == .CMAIL_ENLACE_COLUMN] <- .CMAIL_ENLACE_LABEL
  stats::setNames(labels, cols)
}

# Plantilla de la campaña SOLO para leer rótulos: sin validación estricta (una
# plantilla guardada inválida no debe tumbar la lista; sus rótulos se usan si
# tienen forma y, si no, se humaniza la clave).
.cmail_contactos_template <- function(campaign) {
  .cmail_campaign_template_checked(campaign, strict = FALSE)
}

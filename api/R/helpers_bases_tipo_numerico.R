# helpers_bases_tipo_numerico.R — preguntas que el formulario no declara como número pero lo son
# ==============================================================================================
#
# HSyVbG 2026 (2026-10-22): la edad (P1) es `text` con la restricción
# `regex(., '^(1[89]|[2-9][0-9])$')`, y `indice_vbg` / `indice_hs` son `calculate`
# que devuelven 1 o 0. El SPSS los exportaba como texto y no se podía sacar una media.
# Decisión de Gonzalo: van numéricas.
#
# Regla conservadora: sólo se tratan como numéricas
#   - una pregunta `text` cuya restricción `regex(.)` admite únicamente dígitos, y
#   - un `calculate`,
# y en ambos casos sólo si TODOS sus valores no vacíos son números (la conversión la
# hace `.bases_coerce_spss_types`, que no toca la columna si alguno no lo es).

.bases_regex_solo_digitos <- function(constraint) {
  c0 <- trimws(as.character(constraint %||% ""))
  if (is.na(c0) || !nzchar(c0)) return(FALSE)
  m <- regmatches(c0, regexec("^regex\\(\\s*\\.\\s*,\\s*['\"](.*)['\"]\\s*\\)$", c0))[[1]]
  if (length(m) < 2L) return(FALSE)
  patron <- m[[2]]
  # Fuera de clases de dígitos, cuantificadores, agrupación y anclas no puede haber nada.
  resto <- gsub("\\\\d|\\[[0-9-]+\\]|\\{[0-9,]+\\}|[0-9|()^$?+*]", "", patron)
  nzchar(patron) && !nzchar(resto)
}

#' ¿La fila del instrumento es una pregunta numérica aunque no lo declare su tipo?
#' @noRd
.bases_numerico_no_declarado <- function(row, base) {
  if (identical(base, "calculate")) return(TRUE)
  identical(base, "text") && "constraint" %in% names(row) && .bases_regex_solo_digitos(row$constraint[1L])
}

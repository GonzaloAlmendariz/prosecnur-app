# Resolución defensiva de columnas de etiqueta localizadas en XLSForms.
#
# Muchos instrumentos reales (multilingües, importados de SurveyMonkey/Kobo) no
# traen una columna `label` plana sino columnas localizadas `label::es`,
# `label::spanish (es)`, `hint::es`, etc. Este helper compartido resuelve la
# etiqueta efectiva por fila, prefiriendo español, para que los motores que
# consumen el XLSForm (PDF del cuestionario, instrumento, etc.) no queden con el
# texto vacío. Regla de la casa: no redefinir el micro-helper por módulo.

# Columnas candidatas ordenadas por preferencia para un `kind` ("label"/"hint"):
#   1. la columna plana exacta ("label"/"hint")
#   2. español explícito (::es, ::spanish (es), ::español, castellano…)
#   3. <kind>::<lang> del `default_language` y sus variantes con paréntesis
#   4. cualquier <kind>::* / <kind>_* como último recurso (primer idioma del archivo)
.xlsform_label_col_candidates <- function(nms, lang = "es", kind = "label") {
  if (is.null(nms) || !length(nms)) return(character(0))
  lang <- tolower(trimws(as.character(lang %||% "")))
  if (!nzchar(lang)) lang <- "es"
  kind <- tolower(kind)

  plain <- nms[tolower(nms) == kind]

  explicit <- c(
    paste0(kind, "::", lang),
    paste0(kind, "::", lang, " (", toupper(lang), ")"),
    paste0(kind, "::spanish (es)"), paste0(kind, "::spanish(es)"),
    paste0(kind, "::spanish"), paste0(kind, "::es"),
    paste0(kind, "::espanol (es)"), paste0(kind, "::espanol"),
    paste0(kind, "::español (es)"), paste0(kind, "::español"),
    paste0(kind, "::castellano")
  )
  explicit_ci <- nms[tolower(nms) %in% tolower(unique(explicit))]

  es_grep <- grep(
    sprintf("^%s(::|_).*(\\(es\\)|españ|espanol|spanish|castellano|::es\\b|_es\\b)", kind),
    nms, ignore.case = TRUE, value = TRUE
  )
  any_grep <- grep(sprintf("^%s(::|_)", kind), nms, ignore.case = TRUE, value = TRUE)

  unique(c(plain, explicit_ci, es_grep, any_grep))
}

# Devuelve un vector de longitud nrow(df) con la etiqueta resuelta por fila,
# coalesciendo por prioridad (la primera candidata no vacía gana por fila).
xlsform_coalesce_label <- function(df, lang = "es", kind = c("label", "hint")) {
  kind <- match.arg(kind)
  if (is.null(df) || !nrow(df)) return(character(0))
  n <- nrow(df)
  cols <- intersect(.xlsform_label_col_candidates(names(df), lang, kind), names(df))
  out <- rep("", n)
  for (col in cols) {
    v <- as.character(df[[col]])
    v[is.na(v)] <- ""
    v <- trimws(v)
    take <- !nzchar(out) & nzchar(v)
    if (any(take)) out[take] <- v[take]
    if (all(nzchar(out))) break
  }
  out
}

# Elige la columna de etiqueta preferida (nombre), o NA si no hay ninguna con
# contenido. Útil cuando se necesita el nombre de la columna, no los valores.
xlsform_pick_label_col <- function(df, lang = "es", kind = c("label", "hint")) {
  kind <- match.arg(kind)
  if (is.null(df) || !ncol(df)) return(NA_character_)
  cols <- intersect(.xlsform_label_col_candidates(names(df), lang, kind), names(df))
  for (col in cols) {
    v <- as.character(df[[col]])
    v[is.na(v)] <- ""
    if (any(nzchar(trimws(v)))) return(col)
  }
  if (length(cols)) cols[1L] else NA_character_
}

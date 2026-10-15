# Lecturas del survey del instrumento por nombre de variable.
#
# `x$type[x$name == var][1]` parece inocente pero el survey de un
# XLSForm trae filas sin `name` (begin_group/end_group, notas, filas vacías):
# ahí `NA == var` es NA, el subconjunto lógico devuelve un NA por cada una y
# el `[1]` se queda con el NA de un grupo anterior en vez de la fila de la
# variable. La fila se busca siempre con `which()` sobre nombres no NA.

# Tipo XLSForm en minúsculas de `var` (p. ej. "select_one sn"); "" si el
# survey no la declara o no trae columna `type`.
.inst_tipo_var <- function(surv, var) {
  if (is.null(surv) || !all(c("name", "type") %in% names(surv))) return("")
  i <- which(!is.na(surv$name) & surv$name == var)[1]
  if (is.na(i)) return("")
  tipo <- tolower(as.character(surv$type[i]))
  if (is.na(tipo)) "" else tipo
}

# Etiqueta del instrumento sin el marcado de énfasis de Kobo/ODK: `**negrita**`
# y `*cursiva*` pierden los asteriscos y conservan el texto. Sólo se quitan los
# PARES que abrazan texto (sin espacio pegado por dentro), así que un asterisco
# suelto que es parte del contenido («De 5* a 10*», una llamada de nota) se
# queda. Vectorizada; NA sale "".
.inst_sin_marcado <- function(x) {
  x <- as.character(x %||% character(0))
  x[is.na(x)] <- ""
  x <- gsub("\\*\\*(?=\\S)(.+?)(?<=\\S)\\*\\*", "\\1", x, perl = TRUE)
  x <- gsub("(?<!\\*)\\*(?=[^\\s*])([^*]*?)(?<=[^\\s*])\\*(?!\\*)", "\\1", x, perl = TRUE)
  trimws(gsub("\\s+", " ", x, perl = TRUE))
}

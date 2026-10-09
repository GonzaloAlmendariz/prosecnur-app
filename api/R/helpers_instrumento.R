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

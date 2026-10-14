# Qué pregunta habilita a otra, leído del `relevant` del XLSForm (F3 de checklist-poblacion-y-filtro-2026-10-14).
#
# Al declarar la dependencia entre los dos gráficos de una lámina, el editor propone cuál depende de cuál y con qué
# respuestas, si el formulario lo dice. Sólo se lee la forma simple, la que una persona escribiría en la lámina:
#   selected(${x}, 'c')   ${x} = 'c'   ${x} = c
# unidas por `or` y todas sobre la misma pregunta. Cualquier otra (`and`, `not`, `!=`, comparaciones numéricas, otra
# pregunta) no se propone: la decide quien arma la lámina.

#' La pregunta que habilita a otra y con qué respuestas, desde su `relevant`; `NULL` si no es una condición simple
#' @param relevant La expresión `relevant` de la pregunta.
#' @param survey La hoja survey del instrumento (para hallar la lista de opciones de la pregunta filtro).
#' @param choices La hoja choices del instrumento.
#' @return `list(var, codigos, rotulos)` o `NULL`.
#' @keywords internal
.relevant_habilitada_por <- function(relevant, survey = NULL, choices = NULL) {
  rel <- trimws(as.character(relevant %||% "")[1])
  if (is.na(rel) || !nzchar(rel)) return(NULL)
  rel <- gsub("^\\((.*)\\)$", "\\1", rel)
  partes <- trimws(strsplit(rel, "\\s+or\\s+", perl = TRUE)[[1]])
  if (!length(partes)) return(NULL)
  pat_sel <- "^selected\\(\\s*\\$\\{([A-Za-z_][A-Za-z0-9_.-]*)\\}\\s*,\\s*['\"]([^'\"]+)['\"]\\s*\\)$"
  pat_eq <- "^\\$\\{([A-Za-z_][A-Za-z0-9_.-]*)\\}\\s*=\\s*['\"]?([^'\"\\s()]+)['\"]?$"
  vars <- character(0); codigos <- character(0)
  for (p in partes) {
    p <- gsub("^\\((.*)\\)$", "\\1", trimws(p))
    m <- regmatches(p, regexec(pat_sel, p, perl = TRUE))[[1]]
    if (!length(m)) m <- regmatches(p, regexec(pat_eq, p, perl = TRUE))[[1]]
    if (length(m) != 3L) return(NULL)
    vars <- c(vars, m[2]); codigos <- c(codigos, m[3])
  }
  if (length(unique(vars)) != 1L) return(NULL)
  var <- vars[1]; codigos <- unique(codigos)
  list(var = var, codigos = codigos, rotulos = .relevant_rotulos(var, codigos, survey, choices))
}

#' Los rótulos de los códigos que habilitan, desde la lista de opciones de la pregunta filtro (el código si no hay rótulo)
#' @keywords internal
.relevant_rotulos <- function(var, codigos, survey, choices) {
  if (!is.data.frame(survey) || !is.data.frame(choices) || !("name" %in% names(survey))) return(codigos)
  i <- match(var, as.character(survey$name))
  if (is.na(i)) return(codigos)
  lista <- .graficos_list_name_for_row(survey, i)
  meta <- .graficos_choices_for_list(choices, lista)$items %||% list()
  if (!length(meta)) return(codigos)
  nombres <- vapply(meta, function(x) as.character(x$name %||% ""), "")
  rotulos <- vapply(meta, function(x) as.character(x$label %||% x$name %||% ""), "")
  out <- rotulos[match(codigos, nombres)]
  ifelse(is.na(out) | !nzchar(out), codigos, out)
}

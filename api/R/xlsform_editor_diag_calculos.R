# Diagnóstico de la columna `calculation` en el editor de formularios (checklist editor-conjoint, E5, 2026-11-06).
#
# El parser AST de validación (validacion_ast_parser.R) modela reglas booleanas: en contexto `calculate` deja
# `if`, `int` y `once` como nodos opacos y no admite aritmética (`*`, `div`, `mod`) por diseño, porque el motor de
# validación no la evalúa. Usarlo para avisar sobre fórmulas de cálculo daba falsos avisos: un formulario conjoint
# real recibió 80 «Fórmula no se pudo interpretar» por `int(${r} * 5)`, que la plataforma y el editor leen bien.
#
# Aquí se revisa lo que sí importa en una fórmula de cálculo: que paréntesis y comillas cierren y que cada `${x}`
# exista en el formulario (esto antes se perdía dentro de los `if(...)` opacos).

#' Paréntesis y comillas balanceados, ignorando lo que va entre comillas.
#' @return NULL si la fórmula cierra bien; si no, el motivo en castellano.
#' @keywords internal
.xlsform_calculo_desbalance <- function(expr) {
  chars <- strsplit(expr, "", fixed = TRUE)[[1]]
  profundidad <- 0L
  comilla <- ""
  for (ch in chars) {
    if (nzchar(comilla)) {
      if (identical(ch, comilla)) comilla <- ""
      next
    }
    if (ch %in% c("'", "\"")) {
      comilla <- ch
    } else if (identical(ch, "(")) {
      profundidad <- profundidad + 1L
    } else if (identical(ch, ")")) {
      profundidad <- profundidad - 1L
      if (profundidad < 0L) return("cierra un paréntesis que no se abrió")
    }
  }
  if (nzchar(comilla)) return("deja unas comillas sin cerrar")
  if (profundidad > 0L) return("deja un paréntesis sin cerrar")
  NULL
}

#' Nombres citados con `${x}` en una fórmula, sin repetir.
#' @keywords internal
.xlsform_calculo_referencias <- function(expr) {
  m <- regmatches(expr, gregexpr("\\$\\{\\s*([^}\\s]+)\\s*\\}", expr, perl = TRUE))[[1]]
  unique(trimws(gsub("^\\$\\{|\\}$", "", m)))
}

#' Avisos de una fórmula de cálculo para el panel de avisos del editor.
#'
#' @param expr Texto de la celda `calculation`.
#' @param fila Índice 0-based de la fila en el survey.
#' @param nombres_validos Nombres del survey.
#' @param diag Constructor de avisos (`.xlsform_editor_diag`).
#' @return Lista de avisos (vacía si la fórmula está bien).
#' @keywords internal
.xlsform_editor_diag_calculo <- function(expr, fila, nombres_validos, diag) {
  out <- list()
  motivo <- .xlsform_calculo_desbalance(expr)
  if (!is.null(motivo)) {
    out[[length(out) + 1L]] <- diag(
      id = sprintf("calc-desbalance-%d", fila),
      level = "warn",
      title = "Fórmula incompleta",
      detail = sprintf("La fórmula \"%s\" %s.", substr(expr, 1L, 80L), motivo),
      row_index = fila
    )
  }
  for (ref in setdiff(.xlsform_calculo_referencias(expr), nombres_validos)) {
    out[[length(out) + 1L]] <- diag(
      id = sprintf("ast-missing-ref-calculation-%d-%s", fila, ref),
      level = "warn",
      title = sprintf("Referencia a variable inexistente: \"%s\"", ref),
      detail = sprintf("La fórmula usa ${%s} pero esa pregunta no existe en el formulario.", ref),
      row_index = fila
    )
  }
  out
}

# La identidad del estudio en Cálculo de muestra (ADR 0122).
#
# Nombre y cliente se declaran una sola vez en el Planner. Cálculo ya no los
# escribe; el reporte metodológico los toma de `.planner_identidad()`, que sólo
# trae lo declarado (ADR 0123 §5). Si el Planner no los declara, se conserva lo
# que el estudio de Cálculo tenga.

#' El estudio con el nombre y el cliente del Planner, para el reporte.
#' @param estudio estudio de Cálculo (normalizado).
#' @param s la sesión.
#' @keywords internal
.cm_estudio_con_identidad <- function(estudio, s) {
  ident <- tryCatch(.planner_identidad(s), error = function(e) NULL)
  nombre <- calc_str(ident$nombre, "")
  cliente <- calc_str(ident$cliente, "")
  if (nzchar(nombre)) {
    estudio$titulo <- nombre
    if (is.list(estudio$decision_log) && is.list(estudio$decision_log$estudio)) {
      estudio$decision_log$estudio$titulo <- nombre
    }
  }
  if (nzchar(cliente)) {
    if (!is.list(estudio$contexto)) estudio$contexto <- list()
    estudio$contexto$cliente <- cliente
  }
  estudio
}

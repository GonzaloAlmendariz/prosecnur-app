# hojas_ruta_etapa.R — la etapa operativa (piloto o campo) la declara el Planner
# (ADR 0122; sección `etapa` del Planner, GET /api/planner/calendario).
#
# Hojas de ruta guardaba en `hojas_ruta_active_phase` dos cosas a la vez: qué corrida se
# está mirando (la pestaña Piloto / Campo) y en qué etapa está el estudio. La segunda deja
# de ser suya: si el Planner declara la etapa, manda, y Hojas aterriza en ella, y el envío a
# Material y la campaña territorial la usan cuando nadie pide otra fase. Mientras el Planner
# no la declare, se lee la de Hojas como respaldo. `hojas_ruta_active_phase` sigue siendo la
# pestaña que se mira y Hojas no escribe en el Planner.

# «pilot» / «field» si el Planner declaró la etapa; NA si no.
.hojas_ruta_etapa_planner <- function(s) {
  declarada <- tryCatch(.planner_leer(s)$secciones$etapa, error = function(e) NULL)
  valor <- if (is.list(declarada) && is.list(declarada$valor)) .hojas_ruta_scalar(declarada$valor$valor, "") else ""
  if (!nzchar(valor)) return(NA_character_)
  fase <- .hojas_ruta_phase_normalize(valor, default = "")
  if (nzchar(fase)) fase else NA_character_
}

#' La etapa operativa del estudio para Hojas de ruta: la del Planner si está declarada;
#' si no, la de Hojas (`hojas_ruta_active_phase`). Lectura pura.
#' @keywords internal
.hojas_ruta_etapa <- function(s) {
  planner <- .hojas_ruta_etapa_planner(s)
  if (!is.na(planner)) return(list(fase = planner, origen = "planner"))
  list(fase = .hojas_ruta_phase_normalize(s$hojas_ruta_active_phase %||% "field", default = "field"), origen = "hojas_ruta")
}

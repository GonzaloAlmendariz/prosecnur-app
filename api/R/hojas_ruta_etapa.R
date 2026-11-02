# hojas_ruta_etapa.R — la etapa operativa (piloto o campo) es la corrida que mira Hojas de ruta.
#
# Una sola fase en juego: `hojas_ruta_active_phase` es a la vez la corrida que se mira y la etapa que
# usan los cálculos sin `phase` (previas, sorteo, cuotas, marco elegible, plan de campo), el envío a
# Material y la campaña territorial (revisión de guardian-contratos de la P1, B1).
#
# Hasta el ADR 0124 el Planner podía proponer otra etapa y la barra ofrecía «Alinear». El Planner
# salió como módulo y su cronograma ya no se declara (ADR 0124 §5): la etapa que un `.pulso` viejo
# haya guardado ahí sigue en disco, pero Hojas no la lee.

#' La etapa operativa del estudio: la corrida de Hojas de ruta. Lectura pura.
#' @keywords internal
.hojas_ruta_etapa <- function(s) {
  fase <- .hojas_ruta_phase_normalize(s$hojas_ruta_active_phase %||% "field", default = "field")
  # Sin corrida piloto se mira campo (misma regla que .hojas_ruta_active_run).
  if (identical(fase, "pilot") && is.null((s$hojas_ruta_runs %||% list())$pilot)) fase <- "field"
  list(fase = fase, origen = "hojas_ruta")
}

#' ¿Se puede crear Campo real desde el piloto sin perder nada? No, si la corrida de campo ya tiene
#' muestra sorteada o un envío a Material: crearla desde el piloto la reemplaza entera.
#' @keywords internal
.hojas_ruta_campo_reemplazable <- function(run) {
  if (!is.list(run)) return(list(ok = TRUE, tiene_muestra = FALSE, tiene_envio = FALSE))
  muestra <- .hojas_ruta_envio_tiene_bloques(.hojas_ruta_list_get(run$workspace_outputs, "sample"))
  envio <- !is.null(.hojas_ruta_envio_normalize(run$envio))
  list(ok = !muestra && !envio, tiene_muestra = muestra, tiene_envio = envio)
}

# hojas_ruta_etapa.R — la etapa operativa (piloto o campo) es la corrida que mira Hojas de ruta;
# lo que declara el Planner es una propuesta (ADR 0123 §6, decisión de Gonzalo del 1 nov 2026:
# «fase y ventana: propuesta; se mantiene Alinear en Monitoreo y Hojas»).
#
# Con el ADR 0122 el Planner mandaba: Hojas aterrizaba en su etapa sin clic. Eso dejaba dos fases
# en juego —la que se ve y la guardada en `hojas_ruta_active_phase`— y los cálculos que resuelven la
# corrida sin `phase` (previas, sorteo, cuotas, marco elegible, plan de campo) podían caer en la que
# no se ve (revisión de guardian-contratos de la P1, B1). Ahora hay una sola: `hojas_ruta_active_phase`
# es a la vez la corrida que se mira y la etapa que usan el envío a Material y la campaña territorial
# cuando nadie pide otra fase. La del Planner viaja al lado sólo para avisar y ofrecer «Alinear», que
# es un clic sobre `/api/hojas-ruta/phase`. Hojas no escribe en el Planner.

# «pilot» / «field» si el Planner declaró la etapa; NA si no.
.hojas_ruta_etapa_planner <- function(s) {
  declarada <- tryCatch(.planner_leer(s)$secciones$etapa, error = function(e) NULL)
  valor <- if (is.list(declarada) && is.list(declarada$valor)) .hojas_ruta_scalar(declarada$valor$valor, "") else ""
  if (!nzchar(valor)) return(NA_character_)
  fase <- .hojas_ruta_phase_normalize(valor, default = "")
  if (nzchar(fase)) fase else NA_character_
}

#' La etapa operativa del estudio: la corrida de Hojas de ruta, con la propuesta del Planner al
#' lado (`planner`, NA si no declaró) y si coinciden. Lectura pura.
#' @keywords internal
.hojas_ruta_etapa <- function(s) {
  fase <- .hojas_ruta_phase_normalize(s$hojas_ruta_active_phase %||% "field", default = "field")
  # Sin corrida piloto se mira campo (misma regla que .hojas_ruta_active_run).
  if (identical(fase, "pilot") && is.null((s$hojas_ruta_runs %||% list())$pilot)) fase <- "field"
  planner <- .hojas_ruta_etapa_planner(s)
  list(fase = fase, origen = "hojas_ruta",
       # NA y no NULL: con el serializador de la API (`na = "null"`) sale `null`; un NULL saldría `{}`.
       planner = planner,
       alineada = is.na(planner) || identical(planner, fase))
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

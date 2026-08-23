# De que sorteo viene el plan de aulas que Monitoreo esta mostrando.
#
# `monitoreo_aulas_from_calc()` guarda el `selection_run_id` del sorteo en la
# config de aulas, asi que Monitoreo SIEMPRE supo de donde venia su plan. Lo que
# no habia era la comparacion con el sorteo vigente.
#
# Recopiladores ya la tiene —`.collection_source_vigente()`, con su aviso y su
# boton de rehacer— y Monitoreo no, aunque es DONDE SE MIRA EL AVANCE DEL CAMPO.
# Se re-sortea, Recopiladores avisa y Monitoreo sigue enseñando el avance de un
# plan que ya no existe, sin decir nada.
#
# Tercer consumidor del mismo dato y tercer sitio donde hacia falta la misma
# comparacion.

#' De que corrida del sorteo viene el plan de aulas, y si sigue siendo la vigente.
#'
#' @param s estado de sesion.
#' @return lista con `plan_run_id` (el del plan que Monitoreo muestra),
#'   `selection_run_id` (el del sorteo vigente) y `desfasado`.
#' @export
monitoreo_aulas_origen_vigente <- function(s) {
  s <- s %||% list()
  cfg <- (s$monitoreo_config %||% list())$aulas_universitarias %||% list()
  plan_run <- .monitoreo_scalar(cfg$selection_run_id, "")

  sel <- s$calc_muestra_aulas_selection %||% list()
  vigente <- .monitoreo_scalar(sel$selection_run_id, "")
  # La corrida tambien puede venir en las filas de la seleccion, que es de donde
  # la lee `.collection_source_vigente()`. Se acepta la misma forma para que las
  # dos superficies no discrepen sobre cual es el sorteo vigente.
  if (!nzchar(vigente) && is.data.frame(sel$selection) &&
      "selection_run_id" %in% names(sel$selection) && nrow(sel$selection)) {
    valores <- unique(as.character(sel$selection$selection_run_id))
    valores <- valores[!is.na(valores) & nzchar(valores)]
    if (length(valores) == 1L) vigente <- valores[[1]]
  }

  list(
    plan_run_id = plan_run,
    selection_run_id = vigente,
    # Se afirma SOLO con las dos corridas conocidas y distintas. Un plan traido
    # por libro no trae `selection_run_id` —la distincion ya existe en
    # `AulasOperationsPanel`— y acusarlo de desfasado seria acusarlo por no
    # tener el campo.
    desfasado = nzchar(plan_run) && nzchar(vigente) && !identical(plan_run, vigente)
  )
}

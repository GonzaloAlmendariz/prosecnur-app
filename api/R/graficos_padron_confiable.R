# =============================================================================
# graficos_padron_confiable.R — los padrones que el analista marcó como no confiables (ADR 0135, punto 6)
# =============================================================================
#
# En la tarjeta de grupos, un grupo con «Padrón confiable» apagado conserva lo que se tecleó como padrón, para que al
# volver a encender el interruptor no haya que escribirlo de nuevo. El motor no lo usa para calcular: la base y la tasa
# salen sólo de `universos`. Se guarda en el elemento (`universos_no_confiables`) con el mismo formato que `universos`
# («Docentes TC: 24; Docentes TP: 40»), y como es formal del constructor sobrevive a `.clean_rebuild_args`.

#' Normaliza `universos_no_confiables`: texto «Grupo: n; …» o lista con nombres; `NULL` si llega vacío
#'
#' @param x Lo que escribió la tarjeta.
#' @param contexto Nombre del constructor, para el error.
#' @return `character(1)` o `NULL`.
#' @keywords internal
.graficos_universos_no_confiables <- function(x, contexto) {
  if (is.null(x) || !length(x)) return(NULL)
  if (is.list(x) || (!is.null(names(x)) && length(x) > 1L)) {
    v <- unlist(x)
    if (is.null(names(v)) || any(!nzchar(trimws(names(v))))) {
      .plan_spec_abort(contexto, ": `universos_no_confiables` debe ser un texto «Grupo: n» o una lista con nombres.")
    }
    x <- paste(paste0(trimws(names(v)), ": ", as.character(v)), collapse = "; ")
  }
  if (!is.character(x) || length(x) != 1L) {
    .plan_spec_abort(contexto, ": `universos_no_confiables` debe ser un texto «Grupo: n».")
  }
  x <- trimws(x)
  if (is.na(x) || !nzchar(x)) NULL else x
}

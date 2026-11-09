# =============================================================================
# graficos_significancia_familia_bases.R — una familia de BH por base (ADR 0128 «Familia por base»)
# =============================================================================
#
# Con `correccion = "bh_informe"`, la familia es POR BASE: cada ranura pertenece a la familia de la base que lee
# (`.sig_base_de_lamina`, R12-2; una referencia pelada es la base activa). El worker del export armaba una sola familia,
# la de la base activa, y la lámina de otra base salía «fuera_de_familia»: sin marcas y con aviso. El inspector ya la
# probaba sobre su base, con una familia armada sobre el plan entero.
#
# Ahora el inspector (`.sig_contexto_sesion`) y el export (`.sig_informe_preparar`) arman la familia de cada base con
# la misma función, la misma regla y la misma unidad de comparación: las ranuras de ESA base más las comparaciones de
# Analítica que la base puede responder. Con una sola base no se filtra nada: la familia es bit a bit la de antes.
# Las familias entre públicos (ADR 0138) son otra cosa y no pasan por aquí.

#' Base de una ranura con cruce, o `NA` si la ranura nombra una base que no está en el proyecto
#' @keywords internal
.sig_base_de_lamina_o_na <- function(slide, bases, activa) {
  b <- tryCatch(.sig_base_de_lamina(slide, bases), api_error = function(e) NA_character_)
  if (is.null(b)) activa else as.character(b)[1]   # sin `%||%`: el compartido trata NA como vacío
}

#' El plan de una base: las láminas con cruce que leen esa base (más las que no tienen cruce, que no aportan p)
#'
#' @param plan Plan del informe (`list(slides = ...)` o la lista de láminas).
#' @param base Base cuya familia se arma. @param activa Base de las referencias peladas. @param bases Bases del proyecto.
#' @return El plan con la misma forma; con una sola base, el plan tal cual.
#' @keywords internal
.sig_plan_de_base <- function(plan, base, activa, bases) {
  if (length(bases) <= 1L || !is.list(plan)) return(plan)
  slides <- if (!is.null(plan$slides)) plan$slides else plan
  deja <- vapply(slides, function(s) {
    is.null(.sig_lamina_del_plan(s)) || identical(.sig_base_de_lamina_o_na(s, bases, activa), base)
  }, logical(1))
  if (!is.null(plan$slides)) { plan$slides <- slides[deja]; plan } else slides[deja]
}

#' Bases distintas de la activa que leen las ranuras con cruce del plan
#' @keywords internal
.sig_bases_del_plan <- function(plan, activa, bases) {
  if (length(bases) <= 1L || !is.list(plan)) return(character(0))
  slides <- if (!is.null(plan$slides)) plan$slides else plan
  out <- vapply(Filter(function(s) !is.null(.sig_lamina_del_plan(s)), slides),
                function(s) .sig_base_de_lamina_o_na(s, bases, activa), character(1))
  setdiff(unique(out[!is.na(out)]), activa)
}

#' Contexto de diferencias (regla y familia) de una base: `.sig_contexto_estudio` sobre el plan de esa base
#' @keywords internal
.sig_contexto_estudio_base <- function(data, inst, graficos_config, analitica_config, base, activa, bases) {
  cfg <- graficos_config
  if (is.list(cfg) && !is.null(cfg$plan)) cfg$plan <- .sig_plan_de_base(cfg$plan, base, activa, bases)
  .sig_contexto_estudio(data, inst, cfg, analitica_config)
}

#' Familias de las otras bases del plan, para el render del export
#'
#' @return `list(<base> = list(familia, m))` con las bases cuya regla es `bh_informe`, o `NULL` si no hay ninguna (una
#'   sola base, o el plan sólo lee la activa): la opción del proceso queda como antes.
#' @keywords internal
.sig_familias_otras_bases <- function(ds, is, graficos_config, analitica_config, activa) {
  bases <- names(ds)
  out <- list()
  for (b in .sig_bases_del_plan(graficos_config$plan, activa, bases)) {
    ctx <- .sig_contexto_estudio_base(ds[[b]], is[[b]], graficos_config, analitica_config, b, activa, bases)
    if (identical(ctx$regla$correccion, "bh_informe")) out[[b]] <- list(familia = ctx$familia, m = ctx$m)
  }
  if (length(out)) out else NULL
}

#' Familia con que se marca una lámina del render: la de su base si el export la armó; si no, la de la base activa
#' @keywords internal
.sig_familia_de_fuente <- function(ctx, fuente) {
  base <- as.character(fuente$base %||% NA_character_)[1]
  fams <- ctx$familias
  if (!is.na(base) && is.list(fams) && base %in% names(fams)) return(fams[[base]]$familia)
  ctx$familia
}

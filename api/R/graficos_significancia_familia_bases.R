# =============================================================================
# graficos_significancia_familia_bases.R — una regla por informe y una familia de BH por base (ADR 0128)
# =============================================================================
#
# «Familia por base». Con `correccion = "bh_informe"`, la unidad de la familia es la BASE: cada ranura pertenece a la
# familia de la base que lee (`.sig_base_de_lamina`; una referencia pelada es la base activa). La familia de una base
# son sus ranuras y, sólo en la base de la config de Analítica (hoy la activa), las comparaciones de Analítica. No hay
# control de multiplicidad entre bases.
#
# La regla es UNA por informe (`.sig_regla_informe`): la guardada, tal cual; sin regla guardada, una sola propuesta
# sobre todas las bases, como la regla entre públicos (ADR 0138 P2): Rao-Scott con BH si alguna base trae el
# conglomerado, sin depender del orden de las bases. El inspector (`.sig_contexto_sesion`) y el export
# (`.sig_informe_preparar`) arman las familias con estas funciones, y el render marca cada lámina contra la familia de
# la base que tabuló. Una lámina de base ambigua o desconocida no entra en ninguna familia y se avisa.
#
# Con una sola base no se filtra nada y la regla se propone sobre esa base: todo es bit a bit lo de antes. Las familias
# entre públicos (ADR 0138) son otra cosa y no pasan por aquí.

#' Columnas de todas las bases como un data frame vacío (para proponer la regla), o la base misma si es una sola
#' @keywords internal
.sig_columnas_de_bases <- function(data_sources) {
  ds <- Filter(is.data.frame, data_sources %||% list())
  if (!length(ds)) return(NULL)
  if (length(ds) == 1L) return(ds[[1]])
  cols <- sort(unique(unlist(lapply(ds, names), use.names = FALSE)))
  as.data.frame(stats::setNames(rep(list(character(0)), length(cols)), cols), stringsAsFactors = FALSE)
}

#' La regla del informe: una para todas las bases
#'
#' @return `list(regla, origen)` como `.sig_regla_del_estudio`.
#' @keywords internal
.sig_regla_informe <- function(graficos_config, data_sources, analitica_config = NULL) {
  .sig_regla_del_estudio(graficos_config, .sig_columnas_de_bases(data_sources), analitica_config)
}

#' Base de una ranura con cruce: la que nombra, la activa si es pelada, o `NA` si es ambigua o desconocida
#' @keywords internal
.sig_base_de_lamina_o_na <- function(slide, bases, activa) {
  b <- tryCatch(.sig_base_de_lamina(slide, bases, activa), api_error = function(e) NA_character_)
  if (is.null(b)) activa else as.character(b)[1]   # sin `%||%`: el compartido trata NA como vacío
}

#' Láminas con cruce que no entran en ninguna familia (base ambigua o desconocida), con el motivo
#' @return `data.frame(slide_id, code, mensaje)`; vacío si no hay.
#' @keywords internal
.sig_laminas_sin_familia <- function(plan, activa, bases) {
  slides <- if (is.list(plan)) plan$slides %||% plan else list()
  out <- list()
  for (s in slides) {
    if (is.null(.sig_lamina_del_plan(s))) next
    e <- tryCatch({ .sig_base_de_lamina(s, bases, activa); NULL }, api_error = function(e) e)
    if (!is.null(e)) out[[length(out) + 1L]] <- data.frame(slide_id = as.character(s$id %||% "")[1], code = e$code,
                                                           mensaje = conditionMessage(e), stringsAsFactors = FALSE)
  }
  if (length(out)) do.call(rbind, out) else data.frame(slide_id = character(0), code = character(0), mensaje = character(0))
}

#' Avisa de las láminas que no entran en ninguna familia (message y, en un worker, `.pulso_aviso`)
#' @keywords internal
.sig_avisar_laminas_sin_familia <- function(plan, activa, bases) {
  if (length(bases) <= 1L) return(invisible(NULL))
  sf <- .sig_laminas_sin_familia(plan, activa, bases)
  for (i in seq_len(nrow(sf))) {
    txt <- sprintf("Diferencias: la lámina «%s» no entra en ninguna familia (%s). %s", sf$slide_id[i], sf$code[i],
                   sf$mensaje[i])
    message("[diferencias] ", txt)
    if (exists(".pulso_aviso", mode = "function")) .pulso_aviso(txt)
  }
  invisible(sf)
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

#' Contexto de diferencias de una base: la regla del informe y la familia sobre el plan de esa base
#'
#' Analítica entra sólo en la familia de la base de su config (`activa`).
#' @keywords internal
.sig_contexto_estudio_base <- function(data, inst, graficos_config, analitica_config, base, activa, bases,
                                       regla_informe = NULL) {
  cfg <- graficos_config
  if (is.list(cfg) && !is.null(cfg$plan)) cfg$plan <- .sig_plan_de_base(cfg$plan, base, activa, bases)
  .sig_contexto_estudio(data, inst, cfg, analitica_config, regla_informe = regla_informe,
                        con_analitica = length(bases) <= 1L || identical(base, activa))
}

#' Familias de las otras bases del plan, para el render del export
#'
#' @param regla_informe La regla del informe (`.sig_regla_informe`): una sola, así que o todas las bases tienen familia
#'   de BH o ninguna.
#' @return `list(<base> = list(familia, m))`, o `NULL` sin `bh_informe` o si el plan sólo lee la activa: la opción del
#'   proceso queda como antes.
#' @keywords internal
.sig_familias_otras_bases <- function(ds, is, graficos_config, analitica_config, activa, regla_informe) {
  if (!identical(regla_informe$regla$correccion, "bh_informe")) return(NULL)
  bases <- names(ds)
  out <- list()
  for (b in .sig_bases_del_plan(graficos_config$plan, activa, bases)) {
    ctx <- .sig_contexto_estudio_base(ds[[b]], is[[b]], graficos_config, analitica_config, b, activa, bases,
                                      regla_informe = regla_informe)
    out[[b]] <- list(familia = ctx$familia, m = ctx$m)
  }
  if (length(out)) out else NULL
}

#' El contexto de la base activa con las familias de las otras bases del plan (export y vista previa)
#'
#' Con una sola base, el contexto tal cual. Avisa de las láminas de base ambigua o desconocida.
#' @keywords internal
.sig_contexto_con_familias <- function(ctx, ds, is, graficos_config, analitica_config, activa) {
  if (is.null(ctx) || length(ds) <= 1L) return(ctx)
  ctx$base_familia <- activa
  .sig_avisar_laminas_sin_familia(graficos_config$plan, activa, names(ds))
  rr <- list(regla = ctx$regla, origen = ctx$origen)
  ctx$familias <- tryCatch(.sig_familias_otras_bases(ds, is, graficos_config, analitica_config, activa, rr),
                           error = function(e) {
                             message("[diferencias] no se pudo calcular la familia de otra base: ", conditionMessage(e))
                             NULL
                           })
  ctx
}

#' Familia con que se marca una lámina del render: la de su base
#'
#' La de la base activa (`ctx$familia`) si la lámina la tabuló; la de otra base si el export la armó. Una base que no
#' tiene familia (lámina ambigua o desconocida) lo dice en un message: sus p quedan `fuera_de_familia`.
#' @keywords internal
.sig_familia_de_fuente <- function(ctx, fuente) {
  base <- as.character(fuente$base %||% NA_character_)[1]
  fams <- ctx$familias
  if (!is.na(base) && is.list(fams) && base %in% names(fams)) return(fams[[base]]$familia)
  activa <- ctx$base_familia
  if (!is.na(base) && !is.null(activa) && !identical(base, activa)) {
    message(sprintf("[diferencias] la lámina tabula la base «%s», que no tiene familia en este informe; no se marca.",
                    base))
    # Una familia que no contiene ningún p posible (p = 2): con `exigir_familia`, todo par queda fuera_de_familia. Una
    # tabla vacía no sirve: `.sig_veredictos` la tomaría por «sin familia» y corregiría la lámina sola.
    return(list(p = 2, q = 1, m = 1L))
  }
  ctx$familia
}

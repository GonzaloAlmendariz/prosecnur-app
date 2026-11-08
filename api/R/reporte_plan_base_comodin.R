# =============================================================================
# reporte_plan_base_comodin.R — la base de una lámina de resumen declarada con `base$*` (ADR 0135)
# =============================================================================
#
# `base$*` declara todas las preguntas de escala de una base. La base automática del motor buscaba la variable «*» y la
# lámina salía sin rótulo de base y con un aviso. Aquí la ref comodín se expande a las preguntas de escala de su base
# (`.regla_preguntas_de_base`, lo mismo que elige la regla) y la base se calcula con el helper del motor
# (`.base_auto_from_refs`, local de `reporte_ppt_plan`, por `dynGet` como los renders de convención): la de mayor N por
# público, rotulada por base. Se engancha desde `.plan_tt_caption`: reporte_plan_ppt.R no crece.

#' Refs de un elemento con `base$*` expandidas a las preguntas de escala de su base; `NULL` si no hay comodín
#' @keywords internal
.plan_base_comodin_refs <- function(el, sources) {
  refs <- trimws(as.character(unlist(el$vars %||% list(), use.names = FALSE)))
  refs <- refs[!is.na(refs) & nzchar(refs)]
  comodin <- grepl("\\$\\*$", refs)
  if (!any(comodin)) return(NULL)
  out <- character(0)
  for (r in refs) {
    if (!grepl("\\$\\*$", r)) { out <- c(out, r); next }
    b <- sub("\\$\\*$", "", r)
    vs <- .regla_preguntas_de_base(b, character(0), sources)
    if (length(vs)) out <- c(out, paste0(b, "$", vs))
  }
  unique(out)
}

#' «Base: …» de un elemento con `base$*`; `NULL` si no tiene comodín o el motor no expone su helper
#' @keywords internal
.plan_base_comodin_caption <- function(el, formato) {
  if (!inherits(el, "ppt_element")) return(NULL)
  ds <- dynGet("data_sources", ifnotfound = NULL); is <- dynGet("instrument_sources", ifnotfound = NULL)
  if (!length(ds) || !length(is)) return(NULL)
  refs <- .plan_base_comodin_refs(el, list(data_sources = ds, inst_sources = is))
  if (is.null(refs)) return(NULL)
  base_de <- dynGet(".base_auto_from_refs", ifnotfound = NULL)
  if (!is.function(base_de) || !length(refs)) return(NULL)
  tryCatch(base_de(refs = refs, filtros = el$filtros %||% list(), formato = formato %||% "Base: %s"), error = function(e) NULL)
}

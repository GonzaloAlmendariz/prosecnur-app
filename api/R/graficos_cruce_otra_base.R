# =============================================================================
# graficos_cruce_otra_base.R — aviso cuando el cruce de un gráfico nombra otra base
# =============================================================================
#
# El render resuelve el cruce en la base de la pregunta (`.resolve_ref(cruce, source = ctx_var$source)` en
# reporte_plan_ppt.R: la base auto, la multiapilada, la agrupada, el boxplot, media-rango y el numérico). Un cruce
# escrito `b1$sexo` en un gráfico de `b2$q1` se dibuja con `sexo` de `b2`: el prefijo se ignora. Este paso no cambia
# esa regla, la dice: avisa con `.pulso_aviso` antes de renderizar (B8, revisión de contratos de `excluir_grupos`).
#
# Base de lectura: la de las preguntas del gráfico (`el$source`, el prefijo de `var`/`vars` o `default_source`). Si las
# preguntas leen varias bases o la base no se puede saber, no se avisa: el render ya decide o aborta por su cuenta.
# Las bases se comparan sin mayúsculas, como en el inspector («Fijar base»). No escribe nada en el plan.

#' Recorre los gráficos (`ppt_element`) de cada lámina, también anidados, y aplica `f` a cada uno
#'
#' @param plan Plan (`ppt_plan`). @param f Función `(el) -> el`.
#' @return El plan con los atributos de cada nivel intactos.
#' @keywords internal
.plan_visitar_graficos <- function(plan, f) {
  if (!length(plan)) return(plan)
  visitar <- function(x) {
    if (inherits(x, "ppt_element")) return(f(x))
    if (is.list(x) && !is.data.frame(x) && length(x)) {
      atr <- attributes(x)
      x <- lapply(x, visitar)
      attributes(x) <- atr
    }
    x
  }
  atr <- attributes(plan)
  out <- lapply(plan, function(slide) {
    if (!is.list(slide) || !is.list(slide$slots)) return(slide)
    slide$slots <- visitar(slide$slots)
    slide
  })
  attributes(out) <- atr
  out
}

#' La referencia del cruce que resuelve el render de un elemento, o `NULL`
#'
#' Las barras usan la misma lectura que `excluir_grupos` (`.excluir_grupos_cruce_ref`); el boxplot, media-rango y el
#' numérico, `overrides$cruce %||% el$cruce %||% preset_args$cruce`, como su render.
#' @keywords internal
.cruce_otra_base_ref <- function(el, presets = NULL) {
  tipo <- el$.element_type %||% ""
  if (tipo %in% .EXCLUIR_GRUPOS_TIPOS) return(.excluir_grupos_cruce_ref(el, presets))
  if (!is.list(presets)) presets <- list()
  ref <- (el$overrides %||% list())$cruce %||% el$cruce %||% ((presets[[tipo]] %||% list())$args %||% list())$cruce
  ref <- trimws(as.character(unlist(ref, use.names = FALSE)))
  ref <- ref[!is.na(ref) & nzchar(ref)]
  if (length(ref)) ref[[1]] else NULL
}

#' Avisa si el cruce de un elemento nombra una base distinta de la de su pregunta
#'
#' @param el Elemento del plan. @param default_source Base de las referencias sin calificar. @param presets Presets.
#' @return `TRUE` (invisible) si avisó, `FALSE` si no.
#' @keywords internal
.cruce_otra_base_avisar <- function(el, default_source = NULL, presets = NULL) {
  ref <- .cruce_otra_base_ref(el, presets)
  if (is.null(ref) || !grepl("$", ref, fixed = TRUE)) return(invisible(FALSE))
  base_def <- as.character(el$source %||% default_source %||% NA_character_)[1]
  if (is.na(base_def) || !nzchar(trimws(base_def))) base_def <- NA_character_
  refs <- trimws(as.character(unlist(c(el$var, el$vars), use.names = FALSE)))
  refs <- refs[!is.na(refs) & nzchar(refs)]
  if (!length(refs)) return(invisible(FALSE))
  bases <- unique(vapply(refs, function(r) .excluir_grupos_partir_ref(r, base_def)$base, character(1)))
  if (length(bases) != 1L || is.na(bases[[1]])) return(invisible(FALSE))
  cr <- .excluir_grupos_partir_ref(ref, bases[[1]])
  if (identical(tolower(cr$base), tolower(bases[[1]]))) return(invisible(FALSE))
  .pulso_aviso(sprintf("\"%s\": el cruce nombra la base \"%s\", pero el gráfico lee la base \"%s\"; se agrupa por \"%s\" de \"%s\".",
                       ref, cr$base, bases[[1]], cr$var, bases[[1]]))
  invisible(TRUE)
}

#' Avisa de los cruces escritos con otra base en todos los gráficos del plan (enganche de `reporte_ppt_plan`)
#'
#' @param plan Plan (`ppt_plan`). @param default_source Base de las referencias sin calificar. @param presets Presets.
#' @return El plan, intacto.
#' @keywords internal
.plan_avisar_cruce_otra_base <- function(plan, default_source = NULL, presets = NULL) {
  .plan_visitar_graficos(plan, function(el) {
    .cruce_otra_base_avisar(el, default_source, presets)
    el
  })
}

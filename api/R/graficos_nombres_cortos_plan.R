# =============================================================================
# graficos_nombres_cortos_plan.R — el nombre corto de una pregunta vale en todo el mazo (E4)
# =============================================================================
#
# Prueba con Arte (2026-11-09): las láminas de resumen recortaban con «…» enunciados largos cuyo nombre corto el
# analista ya había escrito en otro gráfico del mazo («Nombre corto de la pregunta», `overrides$etiquetas_vars` de ese
# gráfico, reporte_plan_etiquetas_cortas.R). Ese nombre vivía sólo en su gráfico.
#
# Regla de precedencia en las láminas de resumen (contraste, escala del resumen, fortalezas):
#   1. lo que declara ESE gráfico (su rótulo de fila o su «Nombre corto de la pregunta»);
#   2. el nombre corto que la pregunta tiene en cualquier otro gráfico del plan (el primero, en el orden del plan);
#   3. el enunciado del instrumento.
# El mapa del plan viaja al render en el contexto del informe (`prosecnur.sig_informe`), como las preguntas clave: lo
# fijan el worker del PPT y del Word (`.sig_informe_preparar`) y la vista previa (`.graficos_preview_opciones_motor`).

#' Nombres cortos declarados en los gráficos de un plan: `list(ref = corto)` (la ref como la escribe el gráfico)
#'
#' Recorre las láminas crudas (`payload` del editor) y las construidas (`slots`), y toma `overrides$etiquetas_vars` de
#' cada gráfico. Si dos gráficos nombran distinto la misma pregunta, gana el primero del plan.
#' @keywords internal
.plan_nombres_cortos <- function(plan) {
  out <- list()
  visitar <- function(x, prof = 0L) {
    if (prof > 12L || !is.list(x) || is.data.frame(x)) return(invisible(NULL))
    m <- (x[["overrides"]] %||% list())[["etiquetas_vars"]] %||%
      ((if (is.list(x[["args"]])) x[["args"]][["overrides"]]) %||% list())[["etiquetas_vars"]]
    if (is.list(m) || (is.character(m) && !is.null(names(m)))) {
      for (k in names(m)) {
        v <- as.character(unlist(m[[k]]))[1]
        k <- trimws(k)
        if (nzchar(k) && !is.na(v) && nzchar(trimws(v)) && is.null(out[[k]])) out[[k]] <<- trimws(v)
      }
    }
    for (y in x) visitar(y, prof + 1L)
    invisible(NULL)
  }
  slides <- if (is.list(plan)) plan[["slides"]] %||% plan else list()
  for (s in slides) visitar(s)
  out
}

#' Pone el mapa de nombres cortos del plan en el contexto del informe (sólo si hay alguno)
#' @param ctx Contexto liviano (o NULL: sin contexto de diferencias se crea uno con sólo los nombres cortos;
#'   `.sig_informe_vigente` exige `regla`, así que no inventa una regla de diferencias).
#' @keywords internal
.nombres_cortos_en_contexto <- function(ctx, plan) {
  m <- tryCatch(.plan_nombres_cortos(plan), error = function(e) list())
  # ADR 0141: `plan$rotulos_cortos$preguntas` viaja en el mismo contexto (graficos_rotulos_cortos_plan.R).
  rp <- tryCatch(.rotulos_cortos_preguntas((if (is.list(plan)) plan[["rotulos_cortos"]]) %||% NULL), error = function(e) list())
  if (is.list(ctx)) { ctx$nombres_cortos <- NULL; ctx$rotulos_preguntas <- NULL }
  if (!length(m) && !length(rp)) return(ctx)
  if (!is.list(ctx)) ctx <- list()
  if (length(m)) ctx$nombres_cortos <- m
  if (length(rp)) ctx$rotulos_preguntas <- rp
  ctx
}

#' Nombre corto de una ref según el plan vigente: el del mazo (ADR 0141) y si no el de otro gráfico (E4), o NULL
#' @keywords internal
.nombre_corto_del_plan <- function(ref) {
  # ADR 0141: el nombre corto del mazo (`plan$rotulos_cortos$preguntas`) va antes que el de otro gráfico (E4).
  .rotulo_pregunta_del_plan(ref) %||%
    .rotulo_corto_buscar((getOption("prosecnur.sig_informe", NULL) %||% list())[["nombres_cortos"]], ref)
}

#' ¿El rótulo es el enunciado del instrumento de alguna de las refs? (es decir: nadie lo escribió en este gráfico)
#' @keywords internal
.resumen_es_enunciado <- function(refs, rotulo) {
  if (is.null(rotulo) || is.na(rotulo)) return(TRUE)
  insts <- dynGet("instrument_sources", ifnotfound = NULL)
  if (!length(insts)) return(FALSE)
  r0 <- tolower(gsub("\\s+", " ", trimws(rotulo)))
  for (r in as.character(unlist(refs))) {
    p <- .graficos_ref_parts(r)
    inst <- if (nzchar(p$source %||% "")) insts[[p$source]] else if (length(insts) == 1L) insts[[1]] else NULL
    lab <- tryCatch(.regla_preguntas_rotulo(inst, p$name), error = function(e) NA_character_)
    if (!is.na(lab) && identical(tolower(gsub("\\s+", " ", trimws(lab))), r0)) return(TRUE)
  }
  FALSE
}

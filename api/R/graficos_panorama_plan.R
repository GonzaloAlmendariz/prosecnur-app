# =============================================================================
# graficos_panorama_plan.R — constructor y render del panorama (ADR 0134)
# =============================================================================
#
# `p_panorama()` declara las preguntas de cada público; el render calcula el indicador de cada una (el porcentaje que
# cae en los códigos del `corte`, con filtros y ponderación activos, como el radar entre públicos) y las agrupa por
# base. Se engancha por convención de nombre (`.render_panorama`), como la ola 4: `reporte_plan_ppt.R` no crece.
#
# `base$*` declara todas las preguntas de escala de una base: las `select_one` planas cuya lista tiene los códigos
# del corte, al menos cuatro opciones sustantivas y forma batería o es ordinal declarada (graficos_regla_escala.R).

#' Panorama: todas las preguntas de cada público de un vistazo
#'
#' @param vars Referencias `base$variable`; `base$*` toma todas las preguntas de escala de esa base. Cada base es un
#'   público (una fila de la lámina), en el orden en que aparece.
#' @param corte Códigos de la escala que suman el indicador («4,5»: Top Two Box).
#' @param corte_etiqueta Nombre del indicador para el pie («Top Two Box»).
#' @param referencia Porcentaje de la línea de referencia (60 por defecto); `NA` la apaga.
#' @param mostrar_leyenda `FALSE` quita la leyenda «Mediana del público / Referencia 60%»; `NULL`, como siempre (va).
#' @param mostrar_bajo_umbral `FALSE` quita la columna «Bajo 60%»; `NULL`, como siempre (va).
#' @param regla Cómo se eligen las preguntas entre las de `vars` (ADR 0135, graficos_regla_preguntas.R): `NULL`
#'   dibuja todas las declaradas, como siempre.
#' @export
p_panorama <- function(vars,
                       corte,
                       corte_etiqueta = NULL,
                       referencia = NULL,
                       titulo = NULL,
                       overrides = list(),
                       base = list(),
                       filtros = list(),
                       regla = NULL,
                       mostrar_leyenda = NULL,
                       mostrar_bajo_umbral = NULL) {
  refs <- trimws(as.character(unlist(vars)))
  refs <- refs[!is.na(refs) & nzchar(refs)]
  if (!length(refs)) .plan_spec_abort("p_panorama(): declara en `vars` al menos una pregunta (o `base$*`).")
  if (any(!grepl("\\$", refs))) .plan_spec_abort("p_panorama(): cada referencia va como `base$variable` (o `base$*`).")
  if (!length(.radar_mb_codigos(corte))) .plan_spec_abort("p_panorama(): `corte` debe traer al menos un código de la escala.")
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  ov <- .ppt_slot_override(overrides, "referencia", referencia, "numero", min = 0)
  ov <- .ppt_slot_override(ov, "mostrar_leyenda", mostrar_leyenda, "bool")
  ov <- .ppt_slot_override(ov, "mostrar_bajo_umbral", mostrar_bajo_umbral, "bool")
  el <- list(
    .element_type = "panorama",
    var = NULL,
    vars = refs,
    corte = paste(as.character(unlist(corte)), collapse = ","),
    corte_etiqueta = as.character(corte_etiqueta %||% "")[1],
    title_slide = titulo,
    overrides = ov,
    base = base,
    filtros = .ppt_norm_filters(filtros)
  )
  class(el) <- c("ppt_element", "list")
  .regla_preguntas_en_constructor(el, regla, "p_panorama()", con_estilo = FALSE)   # ADR 0135
}

#' ¿La fila del instrumento es una pregunta de escala con el corte? `select_one` plana con todos los códigos y 4+
#' opciones SUSTANTIVAS (ADR 0135: «Sin información» no cuenta como un nivel de la escala; lo decide
#' `.graficos_no_sustantivos`, el único detector). La definición vive en graficos_regla_indicadores.R.
#' @keywords internal
.panorama_es_escala <- function(inst, var, codigos, baterias = NULL) .regla_preguntas_es_escala(inst, var, codigos, baterias)

#' Expande `base$*` a las preguntas de escala de esa base
#' @keywords internal
.panorama_expandir <- function(refs, codigos, sources) {
  out <- character(0)
  for (r in refs) {
    part <- .graficos_ref_parts(r)
    if (!identical(part$name, "*")) { out <- c(out, r); next }
    inst <- (sources$inst_sources %||% list())[[part$source]]
    datos <- (sources$data_sources %||% list())[[part$source]]
    if (is.null(inst) || !is.data.frame(inst$survey) || !is.data.frame(datos)) {
      stop("panorama: la base `", part$source, "` no existe en el estudio.", call. = FALSE)
    }
    vs <- as.character(inst$survey$name)
    vs <- vs[!is.na(vs) & vs %in% names(datos)]
    bat <- .regla_escala_baterias(inst)
    vs <- vs[vapply(vs, function(v) isTRUE(tryCatch(.panorama_es_escala(inst, v, codigos, bat), error = function(e) FALSE)), TRUE)]
    out <- c(out, paste0(part$source, "$", vs))
  }
  unique(out)
}

#' Datos del panorama: una fila por (público, pregunta) con su indicador en 0–100
#' @keywords internal
.panorama_datos <- function(refs, corte, sources, filtros = list()) {
  codigos <- .radar_mb_codigos(corte)
  if (!length(codigos)) stop_api(400, "E_RADAR_SIN_CORTE", "El panorama necesita un indicador: al menos un código de la escala.")
  refs <- .panorama_expandir(refs, codigos, sources)
  filas <- list()
  for (ref in refs) {
    ctx <- .graficos_consolidado_ref_context(ref, sources)
    if (!isTRUE(ctx$exists)) stop("panorama: la pregunta `", ref, "` no existe en su base.", call. = FALSE)
    if (!isTRUE(.panorama_es_escala(ctx$inst, ctx$resolved_variable, codigos))) {
      stop("panorama: `", ref, "` no es una pregunta de escala con los códigos ", paste(codigos, collapse = ", "), ".", call. = FALSE)
    }
    datos <- .apply_named_filters_safe(sources$data_sources[[ctx$source]], filters = filtros, arg_name = "filtros del panorama", mode = "strict")
    m <- .radar_mb_pct(datos[[ctx$resolved_variable]], codigos, pesos = .radar_mb_pesos(datos))
    if (!is.finite(m$valor)) next   # una pregunta sin respuestas en el filtro no es un punto
    filas[[length(filas) + 1L]] <- data.frame(publico = ctx$source, item = ctx$resolved_variable, valor = m$valor, n = m$n,
                                              stringsAsFactors = FALSE)
  }
  if (!length(filas)) stop_api(400, "E_RADAR_SIN_DATOS", "Ninguna pregunta del panorama tiene respuestas.")
  out <- do.call(rbind, filas)
  out$publico <- factor(.radar_mb_capitalizar(out$publico), levels = unique(.radar_mb_capitalizar(out$publico)))
  out
}

#' @keywords internal
.render_panorama <- function(el, preset_args = list()) {
  data_sources <- dynGet("data_sources", ifnotfound = NULL)
  inst_sources <- dynGet("instrument_sources", ifnotfound = NULL)
  if (!length(data_sources) || !length(inst_sources)) stop("panorama: el render no expone las fuentes del estudio.", call. = FALSE)
  sources <- list(data_sources = data_sources, inst_sources = inst_sources)
  ap <- .regla_preguntas_aplicar_render(el, "panorama", sources); el <- ap$el   # ADR 0135
  if (!is.null(ap$sin_equivalencia)) return(.dumbbell_lamina_sin_equivalencia(ap$sin_equivalencia))   # ADR 0138 §5
  datos <- .panorama_datos(el$vars, el$corte, sources, filtros = el$filtros %||% list())
  base_preset <- if (length(preset_args)) preset_args else .ola4_preset("panorama")
  args <- utils::modifyList(
    list(data = datos, var_publico = "publico", var_item = "item", var_valor = "valor",
         indicador = if (nzchar(el$corte_etiqueta %||% "")) el$corte_etiqueta else "Top Two Box",
         titulo = el$title_slide %||% NULL),
    utils::modifyList(as.list(base_preset %||% list()), as.list(el$overrides %||% list()))
  )
  args <- .keep_formals(graficar_panorama, args, contexto = "graficar_panorama")
  .regla_preguntas_en_espec(do.call(graficar_panorama, args), ap$texto)
}

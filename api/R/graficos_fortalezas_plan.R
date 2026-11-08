# =============================================================================
# graficos_fortalezas_plan.R — constructor y render de fortalezas y alertas (ADR 0135, punto 6)
# =============================================================================
#
# `p_fortalezas()` declara las preguntas de UN público (`base$*` o referencias de una sola base) y su regla; por
# defecto la regla es `extremos` con `n`: las `n` más altas y las `n` más bajas. El render elige con la regla
# compartida (graficos_regla_preguntas.R) y toma las cifras de su misma tabla de indicadores, así que la nota, la
# lámina y el contador del inspector no discrepan. Se engancha por convención de nombre (`.render_fortalezas`):
# `reporte_plan_ppt.R` no crece.

#' Fortalezas y alertas: las preguntas más altas y más bajas de un público
#'
#' @param vars Referencias de una sola base: `base$*` toma todas sus preguntas de escala.
#' @param corte Códigos de la escala que suman el indicador («4,5»: Top Two Box).
#' @param corte_etiqueta Nombre del indicador para el pie («Top Two Box»).
#' @param n Cuántas preguntas van en cada columna.
#' @param regla Cómo se eligen las preguntas (ADR 0135); por defecto `{tipo: "extremos", n}`.
#' @param universos Padrón del público para la base del pie («Docentes: 123»); sin padrón, sólo n.
#' @export
p_fortalezas <- function(vars,
                         corte,
                         corte_etiqueta = NULL,
                         n = 5L,
                         regla = NULL,
                         titulo = NULL,
                         overrides = list(),
                         base = list(),
                         filtros = list(),
                         universos = NULL) {
  refs <- trimws(as.character(unlist(vars)))
  refs <- refs[!is.na(refs) & nzchar(refs)]
  if (!length(refs)) .plan_spec_abort("p_fortalezas(): declara en `vars` las preguntas de un público (o `base$*`).")
  if (any(!grepl("\\$", refs))) .plan_spec_abort("p_fortalezas(): cada referencia va como `base$variable` (o `base$*`).")
  bases <- unique(vapply(refs, function(r) .graficos_ref_parts(r)$source, ""))
  if (length(bases) != 1L) .plan_spec_abort("p_fortalezas(): las preguntas son de un solo público; vienen de ", paste(bases, collapse = ", "), ".")
  if (!length(.radar_mb_codigos(corte))) .plan_spec_abort("p_fortalezas(): `corte` debe traer al menos un código de la escala.")
  k <- suppressWarnings(as.integer(unlist(n))[1])
  if (!is.finite(k) || k < 1L || k > 10L) .plan_spec_abort("p_fortalezas(): `n` va de 1 a 10.")
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  el <- list(
    .element_type = "fortalezas",
    var = NULL,
    vars = refs,
    corte = paste(as.character(unlist(corte)), collapse = ","),
    corte_etiqueta = as.character(corte_etiqueta %||% "")[1],
    n = k,
    universos = universos,
    title_slide = titulo,
    overrides = overrides,
    base = base,
    filtros = .ppt_norm_filters(filtros)
  )
  class(el) <- c("ppt_element", "list")
  regla <- if (is.null(.regla_preguntas_normalizar(regla))) list(tipo = "extremos", n = k) else regla
  .regla_preguntas_en_constructor(el, regla, "p_fortalezas()", con_estilo = FALSE)
}

#' Datos de la lámina desde la regla: una fila por pregunta elegida, con su rótulo, su cifra y sus casos
#' @keywords internal
.fortalezas_datos <- function(el, sources) {
  r <- .regla_preguntas_de_elemento(el, sources)
  ind <- r$indicadores
  temas <- r$evaluacion$temas
  if (!length(temas)) stop("Fortalezas y alertas: la regla no deja ninguna pregunta: ", r$evaluacion$texto, call. = FALSE)
  filas <- ind[match(temas, ind$tema), , drop = FALSE]
  # El rótulo es el de la pregunta, sin el público: la lámina es de uno solo.
  filas$rotulo <- vapply(filas$tema, function(t) {
    ctx <- .graficos_consolidado_ref_context(t, sources)
    .resumen_rotulo_corto(t, .regla_preguntas_rotulo(ctx$inst, ctx$resolved_variable))   # nombre corto de la pregunta
  }, "")
  list(filas = filas, texto = r$evaluacion$texto, publico = .radar_mb_capitalizar(as.character(filas$grupo[1])))
}

#' Base del público en el pie: «Base: Docentes 115 (93%)», o su rango si cambia de pregunta a pregunta
#' @keywords internal
.fortalezas_nota_base <- function(publico, n, universos = NULL) {
  u <- .contraste_universos(universos)
  uni <- if (is.null(u)) NA_real_ else unname(u[.contraste_clave(publico)])
  paste0("Base: ", publico, " ", .contraste_base_grupo(n, if (length(uni)) uni[1] else NA_real_))
}

#' @keywords internal
.render_fortalezas <- function(el, preset_args = list()) {
  data_sources <- dynGet("data_sources", ifnotfound = NULL)
  inst_sources <- dynGet("instrument_sources", ifnotfound = NULL)
  if (!length(data_sources) || !length(inst_sources)) stop("fortalezas: el render no expone las fuentes del estudio.", call. = FALSE)
  d <- .fortalezas_datos(el, list(data_sources = data_sources, inst_sources = inst_sources))
  base_preset <- if (length(preset_args)) preset_args else .ola4_preset("fortalezas")
  args <- utils::modifyList(
    list(data = d$filas, var_rotulo = "rotulo", var_valor = "valor", var_orden = "orden",
         n = if (identical(el$regla$tipo, "extremos")) el$regla$n else el$n %||% 5L,
         publico = d$publico, nota_base = .fortalezas_nota_base(d$publico, d$filas$n, el$universos),
         indicador = if (nzchar(el$corte_etiqueta %||% "")) el$corte_etiqueta else "Top Two Box",
         titulo = el$title_slide %||% NULL),
    utils::modifyList(as.list(base_preset %||% list()), as.list(el$overrides %||% list()))
  )
  args <- .keep_formals(graficar_fortalezas, args, contexto = "graficar_fortalezas")
  .regla_preguntas_en_espec(do.call(graficar_fortalezas, args), d$texto)
}

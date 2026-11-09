# =============================================================================
# graficos_cobertura_plan.R — constructor y render de cobertura y participación (ADR 0135, punto 6)
# =============================================================================
#
# `p_cobertura()` declara los públicos (las bases; `NULL` = todas, en su orden), su padrón y su meta. El render no
# tiene sesión: el padrón y la meta llegan escritos en el payload (`universos`, `metas`), confirmados por el analista
# desde la propuesta de `GET /api/graficos/resumenes/padron` (graficos_padron_por_base.R). Se engancha por convención
# de nombre (`.render_cobertura`): `reporte_plan_ppt.R` no crece.

#' Cobertura y participación: casos, padrón, tasa de respuesta y meta por público
#'
#' @param bases Bases que entran, en su orden (cada una es un público); `NULL` toma todas las del estudio.
#' @param universos Padrón por público, como en el contraste: «Docentes: 123; Estudiantes: 327». Sin padrón, sólo n.
#' @param metas Meta por público en porcentaje del padrón («Docentes: 60%») o en casos («Docentes: 74»).
#' @param extras Filas extra de la columna izquierda, sin barra: lista de `{cifra, rotulo, detalle}`
#'   («34», «egresados(as)», «en 4 grupos focales»), o un texto con una por línea: «34 | egresados(as) | en 4 grupos focales».
#' @param universos_no_confiables Lo tecleado como padrón de un público con «Padrón confiable» apagado («Docentes TC:
#'   24»). Se conserva en el elemento y no entra a ningún cálculo.
#' @param modo `"publicos"` (la de siempre) o `"categorias"`: la versión "Por categorías de una variable" (ADR 0140,
#'   graficos_cobertura_categorias.R).
#' @param variable Con `modo = "categorias"`: la pregunta cuyas categorías se comparan con el universo.
#' @param universo_categorias Con `modo = "categorias"`: el universo tecleado por base,
#'   `{<base>: {modo: "conteos"|"porcentajes", total?, variable?, categorias: [{codigo, etiqueta, valor}]}}`.
#' @param tolerancia_pts Con `modo = "categorias"`: la tolerancia que fija el analista, en puntos (opcional).
#' @export
p_cobertura <- function(bases = NULL,
                        universos = NULL,
                        metas = NULL,
                        extras = list(),
                        titulo = NULL,
                        overrides = list(),
                        base = list(),
                        filtros = list(),
                        universos_no_confiables = NULL,
                        modo = NULL,
                        variable = NULL,
                        universo_categorias = NULL,
                        tolerancia_pts = NULL) {
  bs <- trimws(as.character(unlist(bases %||% character(0))))
  bs <- unique(bs[!is.na(bs) & nzchar(bs)])
  if (any(grepl("$", bs, fixed = TRUE))) .plan_spec_abort("p_cobertura(): `bases` lleva nombres de base, no preguntas.")
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  ex <- .cobertura_extras(extras)
  el <- list(
    .element_type = "cobertura",
    var = NULL,
    vars = NULL,
    bases = if (length(bs)) bs else NULL,
    universos = universos,
    metas = metas,
    extras = ex,
    title_slide = titulo,
    overrides = overrides,
    base = base,
    filtros = .ppt_norm_filters(filtros)
  )
  el$universos_no_confiables <- .graficos_universos_no_confiables(universos_no_confiables, "p_cobertura()")
  md <- .cobcat_texto(modo)
  if (nzchar(md) && !md %in% c("publicos", "categorias")) stop_api(400, "E_COBERTURA_CAT_MODO", "`modo` es \"publicos\" o \"categorias\".")
  if (identical(md, "categorias")) {   # ADR 0140: la versión por categorías (graficos_cobertura_categorias.R)
    el$modo <- md
    el$variable <- .cobcat_variable(variable)   # sin variable todavía (recién elegida la versión): el render lo dice
    el$universo_categorias <- .cobcat_universo_normalizar(universo_categorias)
    el$tolerancia_pts <- .cobcat_tolerancia(tolerancia_pts)
  }
  class(el) <- c("ppt_element", "list")
  el
}

#' Casos de cada base: sus filas tras los filtros de la lámina, sin ponderar
#' @keywords internal
.cobertura_casos <- function(bases, data_sources, filtros = list()) {
  vapply(bases, function(b) {
    nrow(.apply_named_filters_safe(data_sources[[b]], filters = filtros %||% list(), arg_name = "filtros de la cobertura"))
  }, 0)
}

#' @keywords internal
.render_cobertura <- function(el, preset_args = list()) {
  data_sources <- dynGet("data_sources", ifnotfound = NULL)
  if (!length(data_sources)) stop("cobertura: el render no expone las bases del estudio.", call. = FALSE)
  if (identical(el$modo, "categorias")) return(.render_cobertura_categorias(el, data_sources, preset_args))   # ADR 0140
  bases <- el$bases %||% .cobertura_bases_publico(names(data_sources))   # sin las ediciones de una serie (graficos_cobertura_publicos.R)
  faltan <- setdiff(bases, names(data_sources))
  if (length(faltan)) stop("cobertura: la base `", faltan[1], "` no está en el estudio.", call. = FALSE)
  datos <- data.frame(publico = .radar_mb_capitalizar(bases), casos = .cobertura_casos(bases, data_sources, el$filtros),
                      stringsAsFactors = FALSE)
  base_preset <- if (length(preset_args)) preset_args else .ola4_preset("cobertura")
  args <- utils::modifyList(
    list(data = datos, universos = el$universos, metas = el$metas, extras = el$extras, titulo = el$title_slide %||% NULL),
    utils::modifyList(as.list(base_preset %||% list()), as.list(el$overrides %||% list()))
  )
  args <- .keep_formals(graficar_cobertura, args, contexto = "graficar_cobertura")
  p <- do.call(graficar_cobertura, args)
  for (a in attr(p, "pulso_espec")$avisos) warning(a, call. = FALSE)
  p
}

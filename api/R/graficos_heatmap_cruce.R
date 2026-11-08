# =============================================================================
# graficos_heatmap_cruce.R — «Mapa de calor por cruce»: una pregunta por los grupos de otra (ADR 0137, decisión 1)
# =============================================================================
#
# La variante pregunta × cruce nació dentro de `p_dim_heatmap()` (L10-6 y L10-10 de CCSS Perfil, 2026-10-24): con una
# pregunta como objetivo, la lámina es una tabla de calor con el Total y los grupos del cruce en las filas y las
# opciones de la pregunta en las columnas, más la columna Top Two Box opcional. El ADR 0137 retira la familia de
# dimensiones y Gonzalo decidió que esa variante sea un tipo propio (2026-11-08, «Tipo propio»).
#
# Este tipo NO recalcula nada: dibuja con `graficar_heatmap_pregunta_cruce()` (graficos_heatmap_pregunta_cruce.R) y la
# columna del box de graficos_heatmap_top2box.R, con las mismas frecuencias del motor (`.tab_freq`) que usaba la ruta de
# `p_dim_heatmap`. Las cifras, la base y la pieza nativa son las mismas (test-heatmap-cruce.R las compara con las de la
# ruta anterior).
#
# Grano: una fila por grupo del cruce (más el Total), cada fila suma 100 % sobre quienes respondieron la pregunta con
# los filtros de la lámina; el peso, las exclusiones y el orden son los del resto del mazo. La base de la lámina es la
# del Total y los casos de cada fila van entre paréntesis (sin ponderar).
#
# La pregunta se guarda en el elemento como `pregunta` (no `var`): la base de la lámina la declara la especificación,
# como en la ruta anterior, y la base automática del motor no la duplica.

.HM_CRUCE_TITULO <- "Mapa de calor por cruce"

#' Mapa de calor por cruce
#'
#' Tabla de calor de una pregunta de respuesta única por los grupos de otra: el Total y cada grupo del cruce en las
#' filas, las opciones de la pregunta en las columnas (en el orden del instrumento), cada fila suma 100 %. La columna
#' Top Two Box se declara en `overrides` (`top2box`, `top2box_labels`), con el criterio de las multiapiladas.
#'
#' @param var Pregunta de respuesta única (columnas), `"variable"` o `"base$variable"`.
#' @param cruce Pregunta de respuesta única que define los grupos (filas), de la misma base.
#' @param filtros Filtros nombrados de la lámina.
#' @param titulo Título del gráfico.
#' @param overrides Ajustes por gráfico; `top2box` (lógico) y `top2box_labels` (categorías que suma el box).
#' @param base Base declarada (como en los demás elementos del plan).
#' @return Un `ppt_element` de tipo `heatmap_cruce`.
#' @family reporte
#' @export
p_heatmap_cruce <- function(var, cruce, filtros = list(), titulo = NULL, overrides = list(), base = list()) {
  norm_ref <- function(x, nombre) {
    if (!is.character(x) || length(x) != 1L || is.na(x) || !nzchar(trimws(x))) {
      .plan_spec_abort("p_heatmap_cruce(): `", nombre, "` debe ser character(1) no vacío.")
    }
    trimws(x)
  }
  var <- norm_ref(var, "var")
  cruce <- norm_ref(cruce, "cruce")
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  if (!is.list(base)) .plan_spec_abort("`base` debe ser lista.")
  el <- list(
    .element_type = "heatmap_cruce",
    pregunta = var,
    cruce = cruce,
    title_slide = titulo,
    overrides = overrides,
    base = base,
    filtros = .ppt_norm_filters(filtros)
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' Opciones del Top Two Box declaradas en los overrides del elemento
#' @keywords internal
.hm_cruce_box <- function(overrides) {
  ov <- if (is.list(overrides)) overrides else list()
  # `[[` exacto: `ov$top2box` haría match parcial con `top2box_labels`.
  list(top2box = ov[["top2box", exact = TRUE]], top2box_labels = ov[["top2box_labels", exact = TRUE]])
}

#' Renderer del motor para `heatmap_cruce` (lo despacha `.render_element_impl` por `.render_<etype>`)
#' @keywords internal
.render_heatmap_cruce <- function(el, preset_args = list()) {
  resolver <- dynGet(".resolve_ref", ifnotfound = NULL)
  if (!is.function(resolver)) stop("mapa de calor por cruce: el render no expone las fuentes del estudio.", call. = FALSE)
  ficha_retiro <- .graficos_retirado_ficha(el$.retirado_de)
  ctx <- tryCatch({
    ctx_p <- resolver(el$pregunta, arg_name = "var")
    ctx_c <- resolver(el$cruce, source = ctx_p$source, arg_name = "cruce")
    list(p = ctx_p, c = ctx_c)
  }, error = function(e) if (is.null(ficha_retiro)) stop(e) else NULL)
  pregunta <- if (is.null(ctx)) "" else ctx$p$var_requested %||% ctx$p$var
  args <- if (is.null(ctx)) NULL else list(data = ctx$p$data, instrumento = ctx$p$instrumento, objetivo = pregunta,
                                           cruce = ctx$c$var, filtros = el$filtros %||% list())
  misma_base <- !is.null(ctx) && identical(ctx$c$source, ctx$p$source)
  if (is.null(ctx) || !misma_base || !.heatmap_objetivo_es_pregunta(args)) {
    if (!is.null(ficha_retiro)) {
      # Un `p_dim_heatmap` de dimensiones redirigido al reconstruir: no tiene equivalente y sale en blanco (ADR 0137).
      .graficos_retirado_avisar_blanco(ficha_retiro)
      return(ggplot2::ggplot() + ggplot2::theme_void())
    }
    if (!misma_base) stop("mapa de calor por cruce: la pregunta y el cruce deben ser de la misma base.", call. = FALSE)
    .pulso_aviso(.aviso_en_lamina(sprintf(
      "el mapa de calor por cruce necesita dos preguntas de respuesta única de la base; \"%s\" o \"%s\" no lo es.",
      pregunta, ctx$c$var)))
    stop("mapa de calor por cruce: la pregunta o el cruce no son de respuesta única.", call. = FALSE)
  }
  # Las frecuencias, del motor y en la base de la pregunta (`.heatmap_pc_espec` las busca con dynGet).
  tab_motor <- dynGet(".tab_freq", ifnotfound = NULL)
  if (is.function(tab_motor)) {
    .tab_freq <- function(var, filtros = list()) tab_motor(var, filtros = filtros, source = ctx$p$source)
  }
  graficar_heatmap_pregunta_cruce(ctx$p$data, ctx$p$instrumento, pregunta, ctx$c$var, filtros = args$filtros,
                                  box = .hm_cruce_box(el$overrides))
}

#' Args de `p_heatmap_cruce` equivalentes a los de un `p_dim_heatmap` del plan, o `NULL` si no hay objetivo y cruce
#'
#' Conserva filtros, título, overrides (con el Top Two Box) y base; los mandos de dimensiones (modo, brechas,
#' semáforo, iteración) no tienen equivalente y salen.
#' @keywords internal
.hm_cruce_args_desde_dim_heatmap <- function(args) {
  args <- .graficos_unwrap_scalar_refs(args %||% list())
  ref <- function(x) {
    x <- as.character(unlist(x %||% character(0)))
    if (length(x) != 1L || is.na(x) || !nzchar(trimws(x))) NULL else trimws(x)
  }
  obj <- ref(args$objetivo); cr <- ref(args$cruce)
  if (is.null(obj) || is.null(cr)) return(NULL)
  out <- list(var = obj, cruce = cr)
  for (k in c("filtros", "titulo", "overrides", "base")) if (!is.null(args[[k]])) out[[k]] <- args[[k]]
  out
}

#' ¿El objetivo y el cruce son preguntas de respuesta única del instrumento de su base?
#'
#' Para validar y migrar, donde hay instrumentos pero no el render. Las referencias pueden venir calificadas
#' (`base$variable`); sin calificar, valen si hay una sola base.
#' @keywords internal
.hm_cruce_objetivo_es_pregunta_inst <- function(objetivo, cruce, inst_sources) {
  if (is.null(inst_sources) || !length(inst_sources)) return(FALSE)
  if (is.list(inst_sources) && !is.null(inst_sources$survey)) inst_sources <- list(.unica = inst_sources)
  partes <- function(x) {
    x <- as.character(unlist(x %||% character(0)))
    if (length(x) != 1L || is.na(x) || !nzchar(trimws(x))) return(NULL)
    x <- trimws(x)
    if (grepl("$", x, fixed = TRUE)) list(base = sub("\\$.*$", "", x), var = sub("^.*\\$", "", x)) else list(base = NA_character_, var = x)
  }
  o <- partes(objetivo); c0 <- partes(cruce)
  if (is.null(o) || is.null(c0)) return(FALSE)
  base <- c(o$base, c0$base); base <- unique(base[!is.na(base)])
  if (length(base) > 1L) return(FALSE)
  if (!length(base)) {
    if (length(inst_sources) != 1L) return(FALSE)
    nm <- names(inst_sources)
    base <- if (length(nm) && !is.na(nm[1]) && nzchar(nm[1])) nm[1] else 1L
  }
  inst <- tryCatch(inst_sources[[base]], error = function(e) NULL)
  sv <- (inst %||% list())$survey
  if (!is.data.frame(sv) || !all(c("name", "type") %in% names(sv))) return(FALSE)
  tipo <- function(v) trimws(as.character(sv$type[which(sv$name == v)][1]))
  isTRUE(all(grepl("^select_one(\\s|$)", c(tipo(o$var), tipo(c0$var)))))
}

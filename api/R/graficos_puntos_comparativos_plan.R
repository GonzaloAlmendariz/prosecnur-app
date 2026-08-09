# Constructor y renderer dinamico de puntos comparativos
# ======================================================
#
# `reporte_plan_ppt.R` despacha por convencion `.render_<element_type>` y esta
# congelado a crecimiento. Este adaptador recupera fuentes y preset con
# `dynGet()`, igual que los tipos aditivos de la ola 4.

.puntos_comparativos_ref <- function(x, argumento) {
  if (!is.character(x) || length(x) != 1L || is.na(x) || !nzchar(trimws(x))) {
    .plan_spec_abort(
      "p_puntos_comparativos(): `", argumento,
      "` debe ser character(1) no vacio."
    )
  }
  trimws(x)
}

.puntos_comparativos_validar_refs <- function(var, cruces) {
  var_partes <- .graficos_ref_parts(var)
  cruces_partes <- .graficos_ref_parts(cruces)
  fuentes <- unique(c(var_partes$source, cruces_partes$source))
  fuentes <- fuentes[nzchar(fuentes)]
  if (length(fuentes) > 1L) {
    .plan_spec_abort(
      "p_puntos_comparativos(): `var` y `cruces` deben pertenecer a una sola base/fuente."
    )
  }
  if (identical(var_partes$name, cruces_partes$name)) {
    .plan_spec_abort(
      "p_puntos_comparativos(): `var` y `cruces` deben ser referencias distintas."
    )
  }
  invisible(TRUE)
}

#' Indicador descriptivo por grupos como puntos independientes
#'
#' @param var Referencia a una pregunta `select_one` plana.
#' @param cruces Referencia a la pregunta `select_one` que define los grupos.
#' @param corte Uno o mas codigos objetivo de la escala de `var`.
#' @param orden_grupos Permutacion exacta opcional de los grupos observados.
#' @param excluir_opciones Codigos o etiquetas que salen del denominador.
#' @export
p_puntos_comparativos <- function(
    var,
    cruces,
    corte,
    titulo = NULL,
    overrides = list(),
    base = list(),
    filtros = list(),
    orden_grupos = NULL,
    excluir_opciones = NULL
) {
  var <- .puntos_comparativos_ref(var, "var")
  cruces <- .puntos_comparativos_ref(cruces, "cruces")
  .puntos_comparativos_validar_refs(var, cruces)
  corte <- .puntos_comparativos_codigos(corte, "corte")
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  if (!is.list(base)) .plan_spec_abort("`base` debe ser lista.")

  orden <- if (is.null(orden_grupos)) {
    NULL
  } else {
    .puntos_comparativos_codigos(orden_grupos, "orden_grupos")
  }
  exclusiones <- if (is.null(excluir_opciones)) {
    NULL
  } else {
    .puntos_comparativos_codigos(excluir_opciones, "excluir_opciones")
  }

  el <- list(
    .element_type = "puntos_comparativos",
    var = var,
    cruces = cruces,
    corte = corte,
    title_slide = titulo,
    overrides = overrides,
    base = base,
    filtros = .ppt_norm_filters(filtros),
    orden_grupos = orden,
    excluir_opciones = exclusiones
  )
  class(el) <- c("ppt_element", "list")
  el
}

.puntos_comparativos_contextos <- function(
    el,
    data_sources,
    instrument_sources
) {
  var_partes <- .graficos_ref_parts(el$var)
  cruces_partes <- .graficos_ref_parts(el$cruces)
  fuentes_explicitas <- unique(c(var_partes$source, cruces_partes$source))
  fuentes_explicitas <- fuentes_explicitas[nzchar(fuentes_explicitas)]
  if (length(fuentes_explicitas) > 1L) {
    stop(
      "puntos_comparativos: `var` y `cruces` deben resolver una sola fuente.",
      call. = FALSE
    )
  }

  fuente <- if (length(fuentes_explicitas) == 1L) {
    fuentes_explicitas[[1]]
  } else if (length(data_sources) == 1L) {
    names(data_sources)[[1]]
  } else {
    stop(
      "puntos_comparativos: las referencias requieren prefijo `fuente$` cuando hay varias bases.",
      call. = FALSE
    )
  }
  if (is.null(fuente) || is.na(fuente) || !nzchar(trimws(fuente)) ||
      !(fuente %in% names(data_sources)) ||
      !(fuente %in% names(instrument_sources))) {
    stop(
      "puntos_comparativos: la fuente `", fuente,
      "` no existe completa en data e instrumento.",
      call. = FALSE
    )
  }

  var_ref <- paste0(fuente, "$", var_partes$name)
  cruces_ref <- paste0(fuente, "$", cruces_partes$name)
  sources <- list(data_sources = data_sources, inst_sources = instrument_sources)
  var_ctx <- .graficos_consolidado_ref_context(var_ref, sources)
  cruces_ctx <- .graficos_consolidado_ref_context(cruces_ref, sources)
  contextos <- list(indicador = var_ctx, cruces = cruces_ctx)
  for (rol in names(contextos)) {
    ctx <- contextos[[rol]]
    if (!isTRUE(ctx$exists)) {
      stop(
        "puntos_comparativos: `", rol, "` no existe completa en data e instrumento.",
        call. = FALSE
      )
    }
  }
  if (identical(var_ctx$resolved_variable, cruces_ctx$resolved_variable)) {
    stop(
      "puntos_comparativos: `var` y `cruces` deben resolver variables distintas.",
      call. = FALSE
    )
  }

  list(
    fuente = fuente,
    data = data_sources[[fuente]],
    instrumento = instrument_sources[[fuente]],
    var = var_ctx$resolved_variable,
    cruces = cruces_ctx$resolved_variable
  )
}

.puntos_comparativos_preset <- function() {
  presets <- dynGet("presets", ifnotfound = NULL)
  if (!is.list(presets)) return(list())
  presets$puntos_comparativos$args %||% list()
}

#' @keywords internal
.render_puntos_comparativos <- function(el, preset_args = list()) {
  data_sources <- dynGet("data_sources", ifnotfound = NULL)
  instrument_sources <- dynGet("instrument_sources", ifnotfound = NULL)
  if (!length(data_sources) || !length(instrument_sources)) {
    stop(
      "puntos_comparativos: el render no expone las fuentes del estudio.",
      call. = FALSE
    )
  }
  ctx <- .puntos_comparativos_contextos(el, data_sources, instrument_sources)
  datos <- .puntos_comparativos_calcular(
    data = ctx$data,
    instrumento = ctx$instrumento,
    var = ctx$var,
    cruces = ctx$cruces,
    corte = el$corte,
    filtros = el$filtros %||% list(),
    orden_grupos = el$orden_grupos %||% NULL,
    excluir_opciones = el$excluir_opciones %||% NULL
  )

  pregunta <- attr(datos, "puntos_comparativos_pregunta", exact = TRUE)
  etiqueta_corte <- attr(datos, "puntos_comparativos_corte_etiqueta", exact = TRUE)
  ponderado <- isTRUE(attr(datos, "puntos_comparativos_ponderado", exact = TRUE))
  subtitulo <- paste0("Indicador: ", pregunta, " — ", etiqueta_corte)
  nota <- if (ponderado) {
    paste0(
      "Porcentajes ponderados. n = casos válidos sin ponderar con peso positivo, ",
      "después de filtros y exclusiones."
    )
  } else {
    "Porcentajes no ponderados. n = casos válidos después de filtros y exclusiones."
  }

  base_preset <- if (length(preset_args)) {
    preset_args
  } else {
    .puntos_comparativos_preset()
  }
  args_usuario <- utils::modifyList(
    as.list(base_preset %||% list()),
    as.list(el$overrides %||% list())
  )
  nota_usuario <- as.character(args_usuario$nota_pie %||% character(0))
  nota_usuario <- trimws(nota_usuario[!is.na(nota_usuario)])
  nota_usuario <- nota_usuario[nzchar(nota_usuario)]
  if (length(nota_usuario)) {
    nota <- paste(c(nota, nota_usuario), collapse = "\n")
  }
  titulo <- args_usuario$titulo %||% el$title_slide %||% NULL
  args_usuario$titulo <- titulo
  # Datos, escala y copy son parte del contrato metodologico congelado: un
  # preset u override visual no puede reemplazarlos.
  args_usuario$data <- datos
  args_usuario$var_grupo <- "grupo"
  args_usuario$var_valor <- "porcentaje"
  args_usuario$var_n <- "n"
  args_usuario$subtitulo <- subtitulo
  args_usuario$nota_pie <- nota
  args <- .keep_formals(
    graficar_puntos_comparativos,
    args_usuario,
    contexto = "graficar_puntos_comparativos"
  )
  out <- do.call(graficar_puntos_comparativos, args)
  attr(out, "pulso_puntos_comparativos_datos") <- datos
  out
}

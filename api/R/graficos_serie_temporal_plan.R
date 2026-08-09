# Render de la serie temporal dentro del plan PPT
# ===============================================
#
# El dispatcher del motor resuelve por convencion de nombre
# (`get(paste0(".render_", etype))`, `reporte_plan_ppt.R`), asi que este archivo
# alcanza para que el tipo exista: `reporte_plan_ppt.R` esta congelado a
# crecimiento y no se le agrega ni una linea. El preset del tipo tampoco se
# cablea alli —el `switch` de presets caeria a `list()` para un etype nuevo—:
# se lee con `dynGet`, igual que `.render_radar_publicos` lee las fuentes.
#
# Los datos son los MISMOS que consume el radar comparativo: el df tidy
# `(eje, grupo, valor, n)` de `.radar_mb_datos()`. Aqui se leen girados —el eje
# X son las bases (las olas) y cada linea es un tema—, de modo que declarar una
# serie temporal no exige declarar nada nuevo: es el mismo corte, mirado como
# evolucion en vez de como comparacion.

# Valida y devuelve el orden que realmente consumiran la matriz y el grafico.
# `NULL` conserva el contrato historico: todas las lineas deben declarar la
# misma secuencia y manda la primera. Un orden explicito debe ser una
# permutacion exacta y completa para cada tema.
.serie_temporal_orden_efectivo <- function(vars, orden_periodos = NULL,
                                           contexto = "serie_temporal") {
  orden_declarado <- if (is.null(orden_periodos)) {
    NULL
  } else {
    trimws(as.character(orden_periodos))
  }
  if (!is.null(orden_declarado) &&
      (!length(orden_declarado) || anyNA(orden_declarado) ||
       any(!nzchar(orden_declarado)))) {
    .plan_spec_abort(
      contexto,
      ": `orden_periodos` debe ser una permutación exacta y completa de las fuentes."
    )
  }
  if (!is.null(orden_declarado) && anyDuplicated(orden_declarado)) {
    .plan_spec_abort(
      contexto,
      ": `orden_periodos` contiene duplicados; debe ser una permutación exacta."
    )
  }

  secuencia_base <- NULL
  tema_base <- NULL
  for (tema in names(vars)) {
    fuentes <- .ola4_fuentes_de_refs(vars[[tema]], contexto, tema)
    if (anyDuplicated(fuentes)) {
      .plan_spec_abort(
        contexto, ": el tema `", tema,
        "` repite periodos; cada fuente debe aparecer exactamente una vez."
      )
    }

    if (is.null(orden_declarado)) {
      if (is.null(secuencia_base)) {
        secuencia_base <- fuentes
        tema_base <- tema
      } else if (!identical(fuentes, secuencia_base)) {
        faltan <- setdiff(secuencia_base, fuentes)
        sobran <- setdiff(fuentes, secuencia_base)
        detalle <- c(
          if (length(faltan)) paste0("faltan ", paste(faltan, collapse = ", ")) else NULL,
          if (length(sobran)) paste0("sobran ", paste(sobran, collapse = ", ")) else NULL
        )
        .plan_spec_abort(
          contexto, ": el tema `", tema,
          "` no conserva la secuencia completa de periodos de `", tema_base, "`",
          if (length(detalle)) paste0(" (", paste(detalle, collapse = "; "), ")") else
            " (mismas fuentes, distinto orden)",
          "."
        )
      }
    } else if (!setequal(fuentes, orden_declarado) ||
               length(fuentes) != length(orden_declarado)) {
      faltan <- setdiff(orden_declarado, fuentes)
      sobran <- setdiff(fuentes, orden_declarado)
      .plan_spec_abort(
        contexto, ": `orden_periodos` no es una permutación exacta para el tema `",
        tema, "`; faltan [", paste(faltan, collapse = ", "), "] y sobran [",
        paste(sobran, collapse = ", "), "]."
      )
    }
  }

  orden_declarado %||% secuencia_base
}

#' Serie temporal de un indicador a lo largo de las olas del estudio
#'
#' Declara lo mismo que `p_radar(modo = "publicos")` —los ejes de la matriz de
#' equivalencias y el corte que define el indicador— y lo dibuja como evolucion:
#' una linea por tema, un punto por base.
#'
#' @param vars Lista nombrada: cada nombre es un tema (una linea) y cada valor
#'   las referencias `base$variable` que lo miden en cada ola.
#' @param corte Codigos de la escala que suman el indicador. Se DECLARA y no se
#'   deduce: cual es el corte es una decision metodologica del estudio.
#' @param corte_etiqueta Nombre del indicador; se muestra como subtitulo.
#' @param orden_periodos Orden explicito del eje X. Sin el, manda el orden de
#'   declaracion de las fuentes.
#' @export
p_serie_temporal <- function(
    vars,
    corte,
    corte_etiqueta = NULL,
    orden_periodos = NULL,
    mostrar_valores = TRUE,
    valores_decimales = 0L,
    destacar_ultimo = TRUE,
    colores_series = NULL,
    limite_y = NULL,
    titulo = NULL,
    overrides = list(),
    base = list(),
    filtros = list(),
    max_series_con_cifras = 5L,
    mostrar_puntos = TRUE,
    mostrar_grid_y = TRUE
) {
  if (!is.list(vars) || !length(vars)) {
    .plan_spec_abort("p_serie_temporal(): `vars` debe ser una lista nombrada no vacia.")
  }
  if (is.null(names(vars)) || any(!nzchar(trimws(names(vars))))) {
    .plan_spec_abort("p_serie_temporal(): cada tema necesita nombre — es la etiqueta de la linea.")
  }
  if (!length(.radar_mb_codigos(corte))) {
    .plan_spec_abort("p_serie_temporal(): `corte` debe traer al menos un codigo de la escala.")
  }
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  if (!is.list(base)) .plan_spec_abort("`base` debe ser lista.")

  vars_norm <- lapply(vars, function(x) as.character(unlist(x)))
  orden_solicitado <- if (!is.null(orden_periodos)) {
    orden_periodos
  } else {
    overrides$orden_periodos %||% NULL
  }
  orden_declarado <- if (is.null(orden_solicitado)) {
    NULL
  } else {
    trimws(as.character(orden_solicitado))
  }
  .serie_temporal_orden_efectivo(
    vars_norm,
    orden_periodos = orden_declarado,
    contexto = "p_serie_temporal()"
  )

  # Los knobs del elemento viajan por `overrides` porque el render los pasa tal
  # cual al graficador; declararlos ademas como campos sueltos obligaria a
  # mantener dos listas sincronizadas.
  ov <- overrides
  if (!is.null(orden_declarado)) ov$orden_periodos <- orden_declarado
  if (!is.null(colores_series)) ov$colores_series <- colores_series
  if (!is.null(limite_y)) ov$limite_y <- limite_y
  ov$mostrar_valores <- isTRUE(mostrar_valores)
  ov$max_series_con_cifras <- suppressWarnings(as.integer(max_series_con_cifras)[1])
  ov$destacar_ultimo <- isTRUE(destacar_ultimo)
  ov$mostrar_puntos <- isTRUE(mostrar_puntos)
  ov$mostrar_grid_y <- isTRUE(mostrar_grid_y)
  ov$valores_decimales <- .radar_mb_decimales(valores_decimales)

  el <- list(
    .element_type  = "serie_temporal",
    # `var = NULL` explicito: el `$` de R hace MATCH PARCIAL, y sin este campo
    # `el$var` devolveria `vars` —una lista nombrada— que el resolvedor
    # deparsea y tumba el mazo entero. Misma trampa que documenta
    # `p_radar_publicos`.
    var            = NULL,
    vars           = vars_norm,
    corte          = as.character(corte)[1],
    corte_etiqueta = as.character(corte_etiqueta %||% "")[1],
    title_slide    = titulo,
    overrides      = ov,
    base           = base,
    filtros        = .ppt_norm_filters(filtros)
  )
  class(el) <- c("ppt_element", "list")
  el
}

# Preset del tipo, leido del scope del motor sin tocar el archivo congelado.
.serie_temporal_preset <- function() {
  presets <- dynGet("presets", ifnotfound = NULL)
  if (!is.list(presets)) return(list())
  presets$serie_temporal$args %||% list()
}

#' @keywords internal
.render_serie_temporal <- function(el, preset_args = list()) {
  data_sources <- dynGet("data_sources", ifnotfound = NULL)
  inst_sources <- dynGet("instrument_sources", ifnotfound = NULL)
  if (!length(data_sources) || !length(inst_sources)) {
    stop("serie_temporal: el render no expone las fuentes del estudio.", call. = FALSE)
  }
  sources <- list(data_sources = data_sources, inst_sources = inst_sources)

  # `preset_args` llega vacio para un etype que el switch del motor no conoce;
  # el preset real se recupera del scope. Los overrides del elemento mandan.
  # La validacion usa esta mezcla efectiva: validar antes solo el argumento
  # formal permitiria que preset u overrides reintrodujeran un orden invalido.
  base_preset <- if (length(preset_args)) preset_args else .serie_temporal_preset()
  args_usuario <- utils::modifyList(
    as.list(base_preset %||% list()),
    as.list(el$overrides %||% list())
  )
  orden_efectivo <- .serie_temporal_orden_efectivo(
    el$vars,
    orden_periodos = args_usuario$orden_periodos %||% NULL,
    contexto = "serie_temporal"
  )
  args_usuario$orden_periodos <- orden_efectivo

  # Mismo calculo que el radar comparativo: un porcentaje por (tema, base) sobre
  # los codigos declarados como indicador. El indicador se DECLARA y no se
  # deduce (ADR 0064).
  datos <- .radar_mb_datos(
    el$vars,
    el$corte,
    sources,
    filtros = el$filtros %||% list()
  )
  .ola4_validar_matriz_multibase(
    datos,
    names(el$vars),
    orden_efectivo,
    "serie_temporal"
  )

  base_args <- list(
    data      = datos,
    var_eje   = "eje",
    var_grupo = "grupo",
    var_valor = "valor",
    escala_valor = "proporcion_100",
    titulo    = el$title_slide %||% NULL,
    subtitulo = el$corte_etiqueta %||% NULL,
    # El orden del eje X es el de declaracion de las fuentes, que `.radar_mb_datos`
    # ya dejo en los niveles del factor. Un orden alfabetico pondria "Ola 10"
    # antes que "Ola 2" y la evolucion se leeria al reves.
    orden_periodos = orden_efectivo,
    orden_series   = levels(datos$eje)
  )

  args <- utils::modifyList(base_args, args_usuario)
  args <- .keep_formals(graficar_serie_temporal, args, contexto = "graficar_serie_temporal")
  do.call(graficar_serie_temporal, args)
}

# Disposiciones de composición: repartos de dos y tres gráficos sin icono.
#
# Todas comparten renderer porque todas son lo mismo visto de distinta forma: N
# huecos de gráfico colocados por el layout, más título y base. Lo que cambia
# entre ellas —dónde cae cada hueco y cuánto mide— vive en la plantilla, no aquí:
# es la definición de una disposición.
#
# Por eso no hay un archivo por disposición ni una rama por tipo en el motor. Si
# la próxima necesita código propio, es que no es una disposición nueva sino un
# graficador nuevo.
#
# Vive fuera de `reporte_plan_ppt.R`, que está congelado a crecimiento: allí solo
# queda el despacho.

# Cada entrada declara sus slots EN EL ORDEN de los huecos del layout. El orden
# importa: `.ph_with_strict` resuelve el hueco por `type_idx`, así que el primer
# slot va al primer `pic` del layout.
.SLIDES_COMPOSICION <- list(
  graficos_3_2mas1 = c("superior_izquierda", "inferior_izquierda", "derecha"),
  graficos_3_1mas2 = c("izquierda", "superior_derecha", "inferior_derecha"),
  graficos_3_fila = c("izquierda", "centro", "derecha"),
  graficos_3_1arriba = c("superior", "inferior_izquierda", "inferior_derecha"),
  graficos_2_vertical = c("superior", "inferior"),
  graficos_2_asimetrico = c("principal", "apoyo"),
  poblacion_3_tira = c("superior", "medio", "inferior"),
  poblacion_3_corona = c("superior_izquierda", "superior_derecha", "inferior"),
  poblacion_3_cifras = c("superior_izquierda", "derecha", "cifra_superior", "inferior_izquierda", "cifra_inferior"),
  cifras_y_graficos = c("cifra_izquierda", "cifra_centro", "cifra_derecha", "grafico_izquierda", "grafico_derecha")
)

#' Renderiza una lámina de composición
#'
#' @param doc Documento `rpptx` en curso.
#' @param slide La lámina del plan.
#' @param contract Entrada de `.PPT_CONTRACT` para esta disposición.
#' @param helpers Closures del motor (ver `.poblacion_3_render`).
#' @param presets Presets efectivos.
#' @param solo_lista Si `TRUE`, no dibuja.
#'
#' @return Lista con `doc` y `rendered`.
#' @keywords internal
.composicion_render <- function(doc, slide, contract, helpers, presets,
                                solo_lista = FALSE) {
  slots <- slide$slots %||% list()
  stype <- as.character(slide$.slide_type %||% "")[1]
  nombres <- .SLIDES_COMPOSICION[[stype]]
  if (is.null(nombres)) {
    nombres <- setdiff(names(contract$slots), c("title", "base", "icon"))
  }

  els <- list()
  for (nm in nombres) {
    el <- slots[[nm]] %||% NULL
    if (!inherits(el, "ppt_element")) {
      el <- helpers$elemento_degradado(
        sprintf("%s: `%s` debe ser `ppt_element`.", stype, nm)
      )
    }
    el <- helpers$inject_var_titulo(el)
    el <- helpers$base_por_grafico(el, presets, helpers$base_auto_from_element)
    els[[nm]] <- el
  }

  # El ancho de slot se toma del layout, que es quien sabe cuánto mide cada
  # hueco: pasarlo fijo aquí volvería a acoplar la disposición al código.
  anchos <- vapply(nombres, function(nm) {
    loc <- contract$slots[[nm]]$loc %||% NULL
    as.numeric(loc$width %||% 5.2)
  }, numeric(1))

  rendered <- list()
  for (i in seq_along(nombres)) {
    nm <- nombres[[i]]
    p <- helpers$render_element(helpers$inject_title_override(els[[nm]]),
                                ancho_slot = anchos[[i]])
    if (is.null(p)) {
      p <- helpers$canvas_render_nulo(
        stype, ": no se pudo renderizar ", nm,
        " (", els[[nm]]$.element_type %||% "<NA>", ")."
      )
    }
    rendered[[nm]] <- p
  }

  if (isTRUE(solo_lista)) {
    return(list(doc = doc, rendered = unname(rendered), elementos = els))
  }

  doc <- helpers$add_slide_strict(doc, contract$layout)

  title_slide <- slots$title %||% slide$title %||% NULL
  if (!is.null(title_slide) && nzchar(trimws(title_slide))) {
    doc <- helpers$ph_with_strict(doc, title_slide, contract$slots$title)
  }

  for (nm in nombres) {
    doc <- helpers$ph_with_strict(doc, helpers$dml_o_tabla(rendered[[nm]]),
                                  contract$slots[[nm]])
  }

  icono <- slots$icon %||% NULL
  if (!is.null(icono) && !is.null(contract$slots$icon)) {
    p_icon <- helpers$render_element(icono, ancho_slot = 1.9)
    if (!is.null(p_icon)) {
      doc <- helpers$ph_with_strict(doc, helpers$dml_o_tabla(p_icon), contract$slots$icon)
    }
  }

  base <- slots$base %||% NULL
  if (!is.null(base) && !is.null(contract$slots$base)) {
    valor <- if (inherits(base, "ppt_element")) {
      helpers$dml_o_tabla(helpers$render_element(base, ancho_slot = 6.4))
    } else {
      base
    }
    if (!is.null(valor)) {
      doc <- helpers$ph_with_strict(doc, valor, contract$slots$base)
    }
  }

  list(doc = doc, rendered = unname(rendered), elementos = els)
}

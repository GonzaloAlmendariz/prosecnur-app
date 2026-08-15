# Render de la lámina `poblacion_3` — dos paneles apilados y uno alto.
#
# Vive fuera de `reporte_plan_ppt.R` porque ese archivo está congelado a
# crecimiento: en el archivo grande queda solo la rama de despacho, y toda la
# lógica de la disposición nueva está aquí. Mismo patrón que
# `reporte_slide_redondeo.R`.
#
# Los helpers de estilo que en `reporte_plan_ppt.R` son closures internas
# —`.add_slide_strict`, `.ph_with_strict`, `.render_element`…— llegan por
# parámetro en vez de duplicarse: son las que saben resolver un placeholder
# contra el layout real y no tiene sentido tener dos versiones.

#' Renderiza una lámina de perfil de tres gráficos
#'
#' @param doc Documento `rpptx` en curso.
#' @param slide La lámina del plan, con sus `slots`.
#' @param contract Entrada de `.PPT_CONTRACT$poblacion_3`.
#' @param helpers Lista con las closures del motor: `add_slide_strict`,
#'   `ph_with_strict`, `render_element`, `dml_o_tabla`, `elemento_degradado`,
#'   `canvas_render_nulo`, `inject_var_titulo`, `inject_title_override`,
#'   `base_por_grafico`, `base_auto_from_element`.
#' @param presets Presets efectivos del mazo.
#' @param solo_lista Si `TRUE`, no dibuja: solo devuelve los elementos.
#'
#' @return Lista con `doc` (el documento) y `rendered` (los tres paneles).
#' @keywords internal
.poblacion_3_render <- function(doc, slide, contract, helpers, presets,
                                solo_lista = FALSE) {
  slots <- slide$slots %||% list()
  title_slide <- slots$title %||% slide$title %||% NULL

  # Los tres paneles, en el orden en que se leen: la columna izquierda de arriba
  # abajo y después el alto de la derecha.
  campos <- c(up_left = "up_left", bottom_left = "bottom_left", right = "right")
  els <- list()
  for (nm in names(campos)) {
    el <- slots[[campos[[nm]]]] %||% NULL
    if (!inherits(el, "ppt_element")) {
      el <- helpers$elemento_degradado(
        sprintf("poblacion_3: `%s` debe ser `ppt_element`.", campos[[nm]])
      )
    }
    el <- helpers$inject_var_titulo(el)
    # La base es del gráfico, no de la lámina (reporte_plan_base_por_grafico.R).
    el <- helpers$base_por_grafico(el, presets, helpers$base_auto_from_element)
    els[[nm]] <- el
  }

  # El panel derecho dispone del doble de alto, así que se le pasa su ancho de
  # slot igual que a los otros: lo que cambia es el alto del placeholder, y eso
  # ya lo resuelve el layout.
  rendered <- list()
  for (nm in names(els)) {
    p <- helpers$render_element(helpers$inject_title_override(els[[nm]]),
                                ancho_slot = 5.2)
    if (is.null(p)) {
      p <- helpers$canvas_render_nulo(
        "poblacion_3: no se pudo renderizar ", nm,
        " (", els[[nm]]$.element_type %||% "<NA>", ")."
      )
    }
    rendered[[nm]] <- p
  }

  if (isTRUE(solo_lista)) {
    return(list(doc = doc, rendered = unname(rendered), elementos = els))
  }

  doc <- helpers$add_slide_strict(doc, contract$layout)

  if (!is.null(title_slide) && nzchar(trimws(title_slide))) {
    doc <- helpers$ph_with_strict(doc, title_slide, contract$slots$title)
  }

  doc <- helpers$ph_with_strict(doc, helpers$dml_o_tabla(rendered$up_left),
                                contract$slots$up_left)
  doc <- helpers$ph_with_strict(doc, helpers$dml_o_tabla(rendered$bottom_left),
                                contract$slots$bottom_left)
  doc <- helpers$ph_with_strict(doc, helpers$dml_o_tabla(rendered$right),
                                contract$slots$right)

  icono <- slots$icon %||% NULL
  if (!is.null(icono) && !is.null(contract$slots$icon)) {
    p_icon <- helpers$render_element(icono, ancho_slot = 1.9)
    if (!is.null(p_icon)) {
      doc <- helpers$ph_with_strict(doc, helpers$dml_o_tabla(p_icon),
                                    contract$slots$icon)
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

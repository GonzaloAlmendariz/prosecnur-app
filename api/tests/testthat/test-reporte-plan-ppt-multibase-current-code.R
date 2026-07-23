source("setup-load-all.R")

# =============================================================================
# Regresion: render PPT de un plan multibase (madre + repeat) no debe reventar
# por el `current_code` fantasma que el parseo JSON (simplifyDataFrame) filtra de
# las laminas por-servicio de la hija repeat hacia las laminas de la base madre.
# Bug vivo ACNUR PDM: el `stop()` crudo mataba las 85 laminas del reporte.
# =============================================================================

.mb_cc_fixture <- function() {
  # Base MADRE (default): NO tiene `current_code`.
  madre <- data.frame(
    testreal = c("si", "no", "si", "si"),
    stringsAsFactors = FALSE
  )
  attr(madre$testreal, "label") <- "Test real"
  inst_madre <- list(
    survey = data.frame(
      name = "testreal",
      type = "select_one lst_sino",
      list_name = "lst_sino",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_sino", "lst_sino"),
      name = c("si", "no"),
      label = c("Sí", "No"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )

  # Base HIJA repeat (rep_servicios): SI tiene `current_code`.
  # salud: 2 filas con srv_claridad no-NA -> N del servicio = 2.
  hija <- data.frame(
    current_code = c("salud", "salud", "legal", "cepr"),
    srv_claridad = c("muy", "poco", "muy", "nada"),
    stringsAsFactors = FALSE
  )
  attr(hija$srv_claridad, "label") <- "Claridad de la información"
  inst_hija <- list(
    survey = data.frame(
      name = c("current_code", "srv_claridad"),
      type = c("calculate", "select_one lst_clar"),
      list_name = c(NA_character_, "lst_clar"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_clar", "lst_clar", "lst_clar"),
      name = c("muy", "poco", "nada"),
      label = c("Muy clara", "Poco clara", "Nada clara"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )

  list(
    data = list(default = madre, rep_servicios = hija),
    instrumento = list(default = inst_madre, rep_servicios = inst_hija),
    presets = p_presets(
      barras_agrupadas = list(usar_canvas = TRUE, mostrar_leyenda = FALSE)
    )
  )
}

.mb_labels <- function(p) {
  gb <- ggplot2::ggplot_build(p)
  unique(unlist(lapply(gb$data, function(x) {
    hits <- character(0)
    for (nm in c("label", "lab", "text")) {
      if (nm %in% names(x)) hits <- c(hits, as.character(x[[nm]]))
    }
    hits
  })))
}

.mb_is_blank_canvas <- function(p) {
  gb <- ggplot2::ggplot_build(p)
  # Canvas en blanco: una sola capa, sin etiquetas de barras.
  length(gb$data) == 1L &&
    !any(vapply(gb$data, function(x) "label" %in% names(x), logical(1)))
}

test_that("el current_code fantasma (NA) en una lamina de la madre NO revienta el reporte", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")
  fx <- .mb_cc_fixture()

  # `phantom`: replica EXACTA de lo que produce plumber::fromJSON con
  # simplifyDataFrame sobre un arreglo de slides donde unas laminas llevan
  # filtros=current_code y otras no. La lamina de la madre hereda un
  # current_code = NA como columna de un data.frame.
  phantom <- structure(list(current_code = NA_character_),
                       row.names = 1L, class = "data.frame")

  plan <- p_plan(slides = list(
    # Lamina MADRE con filtro fantasma (NA) -> debe ignorarse (no-op).
    p_slide_1_grafico(
      titulo = "Madre con fantasma",
      grafico = p_barras_agrupadas("testreal", filtros = phantom)
    ),
    # Lamina POR SERVICIO de la hija repeat con filtro real -> filtra la hija.
    p_slide_1_grafico(
      titulo = "Servicio Salud",
      grafico = p_barras_agrupadas("rep_servicios$srv_claridad",
                                   filtros = list(current_code = "salud"))
    )
  ))

  # El filtro fantasma degrada a no-op CON rastro (warning de
  # reporte_filter_helpers.R); aqui el objeto bajo prueba es que el render no
  # aborte, asi que el warning esperado se suprime explicitamente.
  out <- expect_no_error(
    suppressWarnings(reporte_ppt_plan(
      data = fx$data,
      instrumento = fx$instrumento,
      plan = plan,
      presets = fx$presets,
      solo_lista = TRUE,
      mensajes_progreso = FALSE
    ))
  )

  expect_length(out$rendered, 2L)

  # Madre: filtro fantasma ignorado -> base completa (4 respuestas).
  madre_labels <- .mb_labels(out$rendered[[1]])
  expect_true(any(grepl("Base: 4 respuestas", madre_labels)))

  # Servicio: filtro real aplicado sobre la hija -> N del servicio salud (2).
  svc_labels <- .mb_labels(out$rendered[[2]])
  expect_true(any(grepl("Base: 2 respuestas", svc_labels)))
})

test_that("un filtro con valor real sobre columna ausente degrada ESA lamina, no mata el reporte", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")
  fx <- .mb_cc_fixture()

  plan <- p_plan(slides = list(
    # Lamina con filtro REAL sobre columna que la madre no tiene -> degrada.
    p_slide_1_grafico(
      titulo = "Filtro mal configurado",
      grafico = p_barras_agrupadas("testreal", filtros = list(current_code = "salud"))
    ),
    # Lamina sana posterior: debe renderizar igual (el reporte no muere).
    p_slide_1_grafico(
      titulo = "Servicio Salud",
      grafico = p_barras_agrupadas("rep_servicios$srv_claridad",
                                   filtros = list(current_code = "salud"))
    )
  ))

  out <- suppressWarnings(expect_no_error(
    reporte_ppt_plan(
      data = fx$data,
      instrumento = fx$instrumento,
      plan = plan,
      presets = fx$presets,
      solo_lista = TRUE,
      mensajes_progreso = FALSE
    )
  ))

  expect_length(out$rendered, 2L)
  # Lamina 1 degradada a canvas en blanco (Sin datos).
  expect_true(.mb_is_blank_canvas(out$rendered[[1]]))
  # Lamina 2 sana renderiza normal.
  expect_false(.mb_is_blank_canvas(out$rendered[[2]]))
})

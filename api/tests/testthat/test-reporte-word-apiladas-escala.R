source("setup-load-all.R")

# B52/W-1: el plot_word de una apilada se calibra al lienzo REAL del docx
# (w_presets()$image, 6.1x2.95in), no al slot PPT (~12.2x5.9in) que el slot
# adapter inyecta en overrides$ancho/alto. Sin la calibracion, la leyenda
# estimaba sus filas contra un ancho fantasma (items solapados al render) y
# el estiramiento B46 inflaba una barra sola hasta ~6in de vacio; ademas el
# fallback `size_texto_barras_peq %||% size_texto_barras` dejaba el preset
# editorial PPT (5.6 mm) al mando de las etiquetas de segmentos chicos.

.word_escala_inst <- function() {
  codes <- c("1", "2", "3", "4", "5")
  labels <- c(
    "Totalmente en desacuerdo", "En desacuerdo",
    "Ni de acuerdo ni en desacuerdo", "De acuerdo", "Totalmente de acuerdo"
  )
  list(
    survey = data.frame(
      name = "acuerdo",
      type = "select_one likert5",
      list_name = "likert5",
      label = "¿Qué tan de acuerdo está con la gestión?",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = "likert5", name = codes, label = labels,
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )
}

.word_escala_data <- function(counts) {
  data.frame(
    acuerdo = rep(names(counts), times = unname(counts)),
    stringsAsFactors = FALSE
  )
}

test_that("los w_presets gobiernan valor y leyenda de apiladas en Word", {
  presets_word <- .apply_word_chart_presets(NULL, w_presets())

  args_apiladas <- presets_word$barras_apiladas$args
  # La etiqueta chica hereda el MISMO tamano que la normal: sin el espejo,
  # el 5.6 editorial del preset PPT gobernaba el «2%» (doble de tamano).
  expect_identical(args_apiladas$size_texto_barras_peq, args_apiladas$size_texto_barras)
  expect_lte(args_apiladas$size_texto_barras, 3.2)
  # Leyenda en banda legible para 6.1in (ni 6 pt microscopica ni 16 editorial).
  expect_gte(args_apiladas$size_leyenda, 7)
  expect_lte(args_apiladas$size_leyenda, 10)

  # Paridad multiapiladas: el bloque multiactor ya no hereda el 16 pt editorial.
  args_multi <- presets_word$multi_apiladas$args
  expect_identical(args_multi$size_texto_barras_peq, args_multi$size_texto_barras)
  expect_gte(args_multi$size_leyenda, 7)
  expect_lte(args_multi$size_leyenda, 10)
  expect_lte(args_multi$size_ejes, 10)

  # El lienzo del docx viaja sellado para .word_ajustar_el().
  wi <- presets_word$base$args$word_image
  expect_equal(wi$width_in, 6.1)
  expect_equal(wi$height_in, 2.95)
})

test_that("el plot_word de una apilada de 1 fila queda calibrado al lienzo Word", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")
  skip_if_not_installed("cowplot")

  data <- list(docentes = .word_escala_data(c(`1` = 1, `2` = 5, `3` = 9, `4` = 21, `5` = 16)))
  instrumento <- list(docentes = .word_escala_inst())
  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_barras_apiladas(var = "docentes$acuerdo")
    )
  )
  presets <- .apply_word_chart_presets(
    do.call(p_presets, .PRESETS_DEFAULT_PULSO),
    w_presets()
  )

  meta <- reporte_ppt_plan(
    data = data,
    instrumento = instrumento,
    plan = plan,
    presets = presets,
    solo_lista = TRUE,
    build_render_meta = TRUE,
    mensajes_progreso = FALSE
  )$render_meta

  charts <- Filter(function(m) identical(m$kind %||% "chart", "chart"), meta)
  expect_length(charts, 1L)
  p <- charts[[1]]$plot_word

  # Sin estiramiento B46 al alto del slot PPT: una fila queda compacta.
  alto <- attr(p, "alto_word_sugerido", exact = TRUE)
  expect_true(is.finite(alto))
  expect_lte(alto, 3.4)

  layout <- attr(p, "pulso_barras_apiladas_layout", exact = TRUE)
  expect_true(is.list(layout))
  leg <- layout$legend_manual
  expect_true(is.data.frame(leg) && nrow(leg) >= 2L)

  # La leyenda se estimo contra el ancho fisico del docx (6.1in), no el PPT.
  ancho_usado <- leg$key_width_physical_in[[1]] / leg$key_width[[1]]
  expect_equal(ancho_usado, 6.1, tolerance = 1e-6)

  # Nada desborda el lienzo y los items de cada fila no se solapan.
  expect_lte(max(leg$x_item_right), 1)
  expect_gte(min(leg$x_left), 0)
  for (r in unique(leg$row)) {
    fila <- leg[leg$row == r, , drop = FALSE]
    fila <- fila[order(fila$x_left), , drop = FALSE]
    if (nrow(fila) < 2L) next
    expect_true(all(fila$x_left[-1L] >= fila$x_item_right[-nrow(fila)] - 1e-6))
  }
})

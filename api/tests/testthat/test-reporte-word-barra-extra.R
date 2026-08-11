source("setup-load-all.R")

# B54/W-5: el chart_preset Word default apaga la columna extra
# (mostrar_barra_extra=FALSE + canvas_w_extra=0) porque la marca N implicita
# del preset editorial PPT no aporta en el lienzo de 6.1in. Pero cuando la
# columna fue PEDIDA — override de lamina con barra_extra_preset/titulo, o
# preset del usuario con barra_extra_preset explicito — el default Word no
# puede pisar el pedido: Word solo re-escala su geometria. La no pedida
# sigue apagada, y un mostrar_barra_extra=FALSE explicito sigue mandando.

.we_inst_likert <- function() {
  list(
    survey = data.frame(
      name = "p12", type = "select_one likert5", list_name = "likert5",
      label = "La gestión del decanato es adecuada",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = "likert5", name = as.character(1:5),
      label = c(
        "Totalmente en desacuerdo", "En desacuerdo",
        "Ni de acuerdo ni en desacuerdo", "De acuerdo", "Totalmente de acuerdo"
      ),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )
}

.we_canvas_labels <- function(p) {
  built <- ggplot2::ggplot_build(p)
  unlist(lapply(built$data, function(d) {
    if ("label" %in% names(d)) as.character(d$label) else NULL
  }))
}

test_that("la barra extra pedida en overrides sobrevive; la no pedida sigue apagada", {
  ov_pedida <- .word_conservar_barra_extra_pedida(
    list(barra_extra_preset = "top2box", titulo_barra_extra = "TOP2BOX")
  )
  expect_true(isTRUE(ov_pedida$mostrar_barra_extra))
  expect_gt(ov_pedida$canvas_w_extra, 0)
  expect_gt(ov_pedida$canvas_w_buf_bars_extra, 0)

  # La geometria que la lamina fijo NO se pisa.
  ov_geom <- .word_conservar_barra_extra_pedida(
    list(barra_extra_preset = "top2box", canvas_w_extra = 0.12, canvas_w_bars = 0.488)
  )
  expect_equal(ov_geom$canvas_w_extra, 0.12)
  expect_equal(ov_geom$canvas_w_bars, 0.488)

  # Sin pedido, los overrides quedan intactos (el default Word gobierna).
  ov_sin <- .word_conservar_barra_extra_pedida(list(canvas_h_legend_in = 0.2))
  expect_null(ov_sin$mostrar_barra_extra)
  expect_null(ov_sin$canvas_w_extra)

  # Apagado explicito de la lamina: manda siempre.
  ov_off <- .word_conservar_barra_extra_pedida(
    list(mostrar_barra_extra = FALSE, barra_extra_preset = "top2box")
  )
  expect_false(isTRUE(ov_off$mostrar_barra_extra))
  expect_null(ov_off$canvas_w_extra)
})

test_that("un preset PPT con barra_extra_preset explicito sobrevive al patch Word", {
  # «Explicito» ya no puede significar «presente»: desde que
  # `barra_extra_preset` es DEFECTO de fabrica, todo preset lo trae y un valor
  # igual al de fabrica no distingue un pedido de una herencia. La eleccion
  # deliberada se expresa con un valor DISTINTO al suelo de Pulso.
  presets_ppt <- do.call(p_presets, .PRESETS_DEFAULT_PULSO)
  presets_ppt$barras_apiladas$args$barra_extra_preset <- "totales"
  presets_ppt$barras_apiladas$args$canvas_w_extra <- 0.12

  merged <- .apply_word_chart_presets(presets_ppt, w_presets())
  args <- merged$barras_apiladas$args
  expect_identical(args$barra_extra_preset, "totales")
  expect_true(isTRUE(args$mostrar_barra_extra))
  expect_equal(args$canvas_w_extra, 0.12)
  # El resto del patch Word (tipografia/leyenda) si re-escala.
  expect_lte(args$size_leyenda, 10)
  expect_lte(args$size_barra_extra, 10)

  # Sin pedido de preset: el default Word la apaga como siempre (W-1/B52).
  base <- .apply_word_chart_presets(do.call(p_presets, .PRESETS_DEFAULT_PULSO), w_presets())
  args_base <- base$barras_apiladas$args
  expect_false(isTRUE(args_base$mostrar_barra_extra))
  expect_identical(args_base$barra_extra_preset, "ninguno")
  expect_equal(args_base$canvas_w_extra, 0)
})

test_that("heredar el defecto de fabrica NO cuenta como pedirlo en Word", {
  # Regresion de `8e783a95`: al volverse `top2box` defecto global, todo preset
  # lo traia y Word dejo de poder aplicar su piso —el que existe porque el
  # lienzo de 6,1" no da para esa columna—. El resultado era una columna
  # Top 2 Box en TODO informe Word, contra el contrato B54/W-5.
  suelo <- .PRESETS_DEFAULT_PULSO$barras_apiladas$barra_extra_preset
  expect_identical(suelo, "top2box")   # si esto cambia, el resto de este test también

  presets_ppt <- do.call(p_presets, .PRESETS_DEFAULT_PULSO)
  presets_ppt$barras_apiladas$args$barra_extra_preset <- suelo

  args <- .apply_word_chart_presets(presets_ppt, w_presets())$barras_apiladas$args
  expect_false(isTRUE(args$mostrar_barra_extra))
  expect_identical(args$barra_extra_preset, "ninguno")
})

test_that("el plot_word de una apilada con top2box pedido muestra la columna extra", {
  skip_if_not_installed("cowplot")
  skip_if_not_installed("stringr")

  data <- list(docentes = data.frame(
    p12 = c("1", rep("4", 17), rep("5", 32)),
    stringsAsFactors = FALSE
  ))
  instrumento <- list(docentes = .we_inst_likert())
  presets <- .apply_word_chart_presets(
    do.call(p_presets, .PRESETS_DEFAULT_PULSO),
    w_presets()
  )
  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_barras_apiladas(
        var = "docentes$p12",
        overrides = list(
          barra_extra_preset = "top2box",
          titulo_barra_extra = "TOP2BOX",
          textos_negrita = c("titulo", "barra_extra")
        )
      )
    ),
    diapo_002 = p_slide_1_grafico(
      grafico = p_barras_apiladas(var = "docentes$p12")
    )
  )

  meta <- reporte_ppt_plan(
    data = data, instrumento = instrumento, plan = plan, presets = presets,
    solo_lista = TRUE, build_render_meta = TRUE, mensajes_progreso = FALSE
  )$render_meta
  charts <- Filter(function(m) identical(m$kind %||% "chart", "chart"), meta)
  expect_length(charts, 2L)

  labs_pedida <- .we_canvas_labels(charts[[1]]$plot_word)
  # Titulo de la columna y su valor (17+32 de 50 = 98%).
  expect_true(any(grepl("TOP2BOX", labs_pedida, fixed = TRUE)))
  expect_true(any(grepl("^98%$", labs_pedida)))

  # La lamina vecina sin pedido conserva el default Word: sin columna extra.
  labs_sin <- .we_canvas_labels(charts[[2]]$plot_word)
  expect_false(any(grepl("TOP2BOX", labs_sin, fixed = TRUE)))
  expect_false(any(grepl("^98%$", labs_sin)))
})

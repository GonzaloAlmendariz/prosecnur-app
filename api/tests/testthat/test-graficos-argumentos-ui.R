.fixture_apiladas_args_ui <- function() {
  data.frame(
    categoria = "Disena y construye la infraestructura fisica que requiere la sociedad, mediante el uso de herramientas y tecnicas modernas con alto contenido cientifico",
    N = 4,
    pct_1 = 0.25,
    pct_2 = 0.25,
    pct_3 = 0.50,
    stringsAsFactors = FALSE
  )
}

.render_apiladas_args_ui <- function(df, path, ..., mostrar_leyenda = FALSE, color_ejes = "#111111", size_ejes = 9) {
  graficar_barras_apiladas(
    data = df,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2", "pct_3"),
    etiquetas_grupos = c(pct_1 = "Nada util 1", pct_2 = "2", pct_3 = "3"),
    colores_grupos = c("Nada util 1" = "#5E97F6", "2" = "#00B839", "3" = "#F8766D"),
    usar_canvas = TRUE,
    mostrar_leyenda = mostrar_leyenda,
    mostrar_valores = FALSE,
    mostrar_barra_extra = FALSE,
    canvas_w_bars = 0.60,
    canvas_w_extra = 0,
    color_ejes = color_ejes,
    size_ejes = size_ejes,
    ancho = 8,
    alto = 4,
    dpi = 150,
    exportar = "png",
    path_salida = path,
    ...
  )
}

.first_blue_bar_x <- function(img) {
  rgb <- img[, , 1:3, drop = FALSE]
  blue_mask <-
    rgb[, , 1] > 0.25 & rgb[, , 1] < 0.50 &
    rgb[, , 2] > 0.45 & rgb[, , 2] < 0.70 &
    rgb[, , 3] > 0.80
  xs <- which(colSums(blue_mask) > 5)
  min(xs)
}

test_that("metadata de graficadores expone controles claros y sin duplicados", {
  payload <- .presets_metadata_payload()
  presets <- stats::setNames(payload$presets, vapply(payload$presets, `[[`, character(1), "name"))

  apiladas <- presets$barras_apiladas$args
  names_apiladas <- vapply(apiladas, `[[`, character(1), "name")
  by_name <- stats::setNames(apiladas, names_apiladas)

  expect_false("exportar" %in% names_apiladas)
  expect_false("wrap_y" %in% names_apiladas)
  expect_equal(by_name$canvas_w_etiquetas$grupo, "espacio")
  expect_equal(by_name$canvas_w_etiquetas$label, "Espacio para etiquetas")
  expect_equal(by_name$ancho_max_eje_y$label, "Ancho de texto de etiquetas")
  expect_equal(by_name$leyenda_posicion$grupo, "leyenda")
  expect_match(by_name$leyenda_posicion$label, "leyenda")
})

test_that("Word mantiene un grosor apilado mayor por defecto y respeta overrides", {
  wp <- w_presets()
  applied <- .apply_word_chart_presets(NULL, wp)
  expect_equal(as.numeric(applied$barras_apiladas$args$grosor_barras_mult), 1.2)

  applied_with_override <- .apply_word_chart_presets(
    presets_ppt = list(
      barras_apiladas = list(
        args = list(
          grosor_barras_mult = 0.72,
          grosor_modo = "manual"
        )
      )
    ),
    presets_word = wp
  )
  expect_equal(applied_with_override$barras_apiladas$args$grosor_barras_mult, 0.72)
  expect_equal(applied_with_override$barras_apiladas$args$grosor_modo, "manual")

  applied_with_chart_preset <- .apply_word_chart_presets(
    presets_ppt = NULL,
    presets_word = w_presets(chart_presets = list(
      barras_apiladas = list(grosor_barras_mult = 1.25)
    ))
  )
  expect_equal(
    applied_with_chart_preset$barras_apiladas$args$grosor_barras_mult,
    1.25
  )
})

test_that("preset Pulso deja la barra extra configurable y con defaults neutros", {
  payload <- .presets_metadata_payload()
  presets <- stats::setNames(payload$presets, vapply(payload$presets, `[[`, character(1), "name"))

  apiladas_names <- vapply(presets$barras_apiladas$args, `[[`, character(1), "name")
  multi_names <- vapply(presets$multi_apiladas$args, `[[`, character(1), "name")
  agrupadas_names <- vapply(presets$barras_agrupadas$args, `[[`, character(1), "name")

  expect_true("barra_extra_preset" %in% apiladas_names)
  expect_true("titulo_barra_extra" %in% apiladas_names)
  expect_true("prefijo_barra_extra" %in% apiladas_names)
  expect_true("barra_extra_preset" %in% multi_names)
  expect_true("titulo_barra_extra" %in% multi_names)
  expect_true("titulo_barra_extra" %in% agrupadas_names)

  expect_identical(.PRESETS_DEFAULT_PULSO$barras_apiladas$prefijo_barra_extra, "")
  expect_identical(.PRESETS_DEFAULT_PULSO$barras_agrupadas$prefijo_barra_extra, "")
  expect_equal(.PRESETS_DEFAULT_PULSO$barras_agrupadas$canvas_w_etiquetas, 0.22)
  expect_equal(.PRESETS_DEFAULT_PULSO$radar_tabla$titulo_tabla, "TOP 2 BOX")
})

test_that("metadata principal no expone editores tecnicos JSON", {
  registry <- .graficos_registry_payload()
  exposed <- unlist(lapply(registry$graficadores, function(g) {
    vapply(g$args, function(a) as.character(a$tipo_input %||% ""), character(1))
  }), use.names = FALSE)

  expect_false(any(exposed %in% c("overrides", "filtros", "base_config", "meta")))
})

test_that("controles expuestos de leyenda llegan a los renderizadores canvas", {
  expect_true("leyenda_posicion" %in% names(formals(graficar_barras_apiladas)))
  expect_true("leyenda_posicion" %in% names(formals(graficar_barras_agrupadas)))
  expect_true("leyenda_posicion" %in% names(formals(graficar_barras_numericas)))
})

test_that("canvas_w_etiquetas desplaza visualmente el inicio de barras", {
  skip_if_not_installed("png")

  df <- .fixture_apiladas_args_ui()
  f_small <- tempfile(fileext = ".png")
  f_large <- tempfile(fileext = ".png")

  .render_apiladas_args_ui(df, f_small, canvas_w_etiquetas = 0.12, ancho_max_eje_y = 20)
  .render_apiladas_args_ui(df, f_large, canvas_w_etiquetas = 0.35, ancho_max_eje_y = 20)

  x_small <- .first_blue_bar_x(png::readPNG(f_small))
  x_large <- .first_blue_bar_x(png::readPNG(f_large))

  expect_gt(x_large - x_small, 150)
})

test_that("ancho_max_eje_y recompone visualmente etiquetas largas", {
  skip_if_not_installed("png")

  df <- .fixture_apiladas_args_ui()
  f_narrow <- tempfile(fileext = ".png")
  f_wide <- tempfile(fileext = ".png")

  .render_apiladas_args_ui(df, f_narrow, canvas_w_etiquetas = 0.35, ancho_max_eje_y = 14, color_ejes = "#004B8D", size_ejes = 12)
  .render_apiladas_args_ui(df, f_wide, canvas_w_etiquetas = 0.35, ancho_max_eje_y = 70, color_ejes = "#004B8D", size_ejes = 12)

  i_narrow <- png::readPNG(f_narrow)
  i_wide <- png::readPNG(f_wide)
  expect_gt(sum(abs(i_narrow - i_wide)), 10000)
})

test_that("leyenda_posicion cambia el placeholder de leyenda en canvas", {
  skip_if_not_installed("png")

  df <- .fixture_apiladas_args_ui()
  f_bottom <- tempfile(fileext = ".png")
  f_top <- tempfile(fileext = ".png")

  .render_apiladas_args_ui(df, f_bottom, canvas_w_etiquetas = 0.28, ancho_max_eje_y = 25, mostrar_leyenda = TRUE, leyenda_posicion = "abajo")
  .render_apiladas_args_ui(df, f_top, canvas_w_etiquetas = 0.28, ancho_max_eje_y = 25, mostrar_leyenda = TRUE, leyenda_posicion = "arriba")

  i_bottom <- png::readPNG(f_bottom)
  i_top <- png::readPNG(f_top)
  expect_gt(sum(abs(i_bottom - i_top)), 10000)
})

test_that("PPT usa textos pulidos para selección múltiple y Top 2 Box", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  dat <- data.frame(
    x1 = c(1, 2, 3, 4, 4, 3),
    x2 = c(2, 3, 3, 4, 4, 4),
    m1 = c("1", "1 2", "2", "1", "2", "1 2"),
    stringsAsFactors = FALSE
  )
  inst <- list(
    survey = data.frame(
      name = c("x1", "x2", "m1"),
      type = c("select_one", "select_one", "select_multiple"),
      list_name = c("lst_likert", "lst_likert", "lst_multi"),
      label = c("Indicador 1", "Indicador 2", "Pregunta múltiple"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c(rep("lst_likert", 4), rep("lst_multi", 2)),
      name = c("1", "2", "3", "4", "1", "2"),
      label = c("Nada", "Bajo", "Alto", "Muy alto", "Opción A", "Opción B"),
      stringsAsFactors = FALSE
    ),
    orders_list = list(
      lst_likert = c("1", "2", "3", "4"),
      lst_multi = c("1", "2")
    )
  )

  plan <- p_plan(slides = list(
    p_slide_1_grafico(
      titulo = "Top 2",
      grafico = p_barras_multiapiladas(
        modo = "var",
        vars = c("x1", "x2"),
        top2box = TRUE,
        top2box_labels = c("Alto", "Muy alto")
      )
    ),
    p_slide_1_grafico(
      titulo = "Múltiple",
      grafico = p_barras_agrupadas("m1")
    )
  ))

  out <- tempfile(fileext = ".pptx")
  reporte_ppt_plan(
    data = dat,
    instrumento = inst,
    plan = plan,
    presets = do.call(p_presets, .PRESETS_DEFAULT_PULSO),
    path_ppt = out,
    mensajes_progreso = FALSE
  )

  slide_files <- grep("^ppt/slides/slide[0-9]+\\.xml$", unzip(out, list = TRUE)$Name, value = TRUE)
  xml <- paste(unlist(lapply(unzip(out, files = slide_files, exdir = tempdir()), readLines, warn = FALSE)), collapse = " ")

  expect_true(grepl("TOP 2 BOX", xml, fixed = TRUE))
  expect_false(grepl("N =", xml, fixed = TRUE))
  expect_true(grepl("Pregunta de opción múltiple", xml, fixed = TRUE))
})

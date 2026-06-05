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

.render_apiladas_args_ui <- function(
    df,
    path,
    ...,
    mostrar_leyenda = FALSE,
    color_ejes = "#111111",
    size_ejes = 9,
    colores_grupos = c("Nada util 1" = "#5E97F6", "2" = "#00B839", "3" = "#F8766D")) {
  graficar_barras_apiladas(
    data = df,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2", "pct_3"),
    etiquetas_grupos = c(pct_1 = "Nada util 1", pct_2 = "2", pct_3 = "3"),
    colores_grupos = colores_grupos,
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

.fixture_agrupadas_args_ui <- function() {
  data.frame(
    categoria = c("Nada util 1", "2", "3"),
    N = c(4, 4, 4),
    pct = c(0.25, 0.25, 0.50),
    stringsAsFactors = FALSE
  )
}

.render_agrupadas_args_ui <- function(df, path, ..., colores_categorias = NULL) {
  graficar_barras_agrupadas(
    data = df,
    var_categoria = "categoria",
    var_n = "N",
    cols_porcentaje = "pct",
    etiquetas_series = c(pct = "Porcentaje"),
    colores_categorias = colores_categorias,
    usar_canvas = TRUE,
    mostrar_leyenda = FALSE,
    mostrar_valores = FALSE,
    mostrar_barra_extra = FALSE,
    canvas_w_bars = 0.60,
    canvas_w_extra = 0,
    ancho = 8,
    alto = 4,
    dpi = 150,
    exportar = "png",
    path_salida = path,
    ...
  )
}

.fixture_numericas_args_ui <- function() {
  data.frame(
    categoria = c("Grupo A", "Grupo B", "Grupo C"),
    N = c(10, 12, 9),
    media = c(1.5, 2.4, 3.2),
    stringsAsFactors = FALSE
  )
}

.render_numericas_args_ui <- function(df, path, ..., colores_categorias = NULL) {
  graficar_barras_numericas(
    data = df,
    var_categoria = "categoria",
    var_n = "N",
    vars_valor = "media",
    etiquetas_series = c(media = "Media"),
    colores_categorias = colores_categorias,
    usar_canvas = FALSE,
    mostrar_leyenda = FALSE,
    mostrar_valores = FALSE,
    mostrar_n_sobre_barras = FALSE,
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

.count_near_color_pixels <- function(img, hex, tolerance = 0.035) {
  rgb <- img[, , 1:3, drop = FALSE]
  target <- as.numeric(grDevices::col2rgb(hex)) / 255
  mask <-
    abs(rgb[, , 1] - target[1]) <= tolerance &
    abs(rgb[, , 2] - target[2]) <= tolerance &
    abs(rgb[, , 3] - target[3]) <= tolerance
  sum(mask)
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

test_that("paletas configuradas llegan al ambiente y pintan barras apiladas", {
  skip_if_not_installed("png")

  palette_env <- .graficos_palette_env(list(
    lst_respuesta = list(
      "Nada util 1" = "#C1121F",
      "2" = "#2A9D8F",
      "3" = "#F4A261"
    ),
    lst_vacia = list("Sin color" = "")
  ), parent = emptyenv())

  expect_true(exists("paleta_lst_respuesta", envir = palette_env, inherits = FALSE))
  expect_false(exists("paleta_lst_vacia", envir = palette_env, inherits = FALSE))

  paleta <- get("paleta_lst_respuesta", envir = palette_env, inherits = FALSE)
  expect_equal(names(paleta), c("Nada util 1", "2", "3"))
  expect_equal(unname(paleta), c("#C1121F", "#2A9D8F", "#F4A261"))

  out <- tempfile(fileext = ".png")
  .render_apiladas_args_ui(
    .fixture_apiladas_args_ui(),
    out,
    colores_grupos = paleta,
    canvas_w_etiquetas = 0.28
  )

  img <- png::readPNG(out)
  expect_gt(.count_near_color_pixels(img, "#C1121F"), 100)
  expect_gt(.count_near_color_pixels(img, "#2A9D8F"), 100)
  expect_gt(.count_near_color_pixels(img, "#F4A261"), 100)
})

test_that("paletas sugeridas incluyen listas de todas las fuentes", {
  inst_a <- list(
    choices = data.frame(
      list_name = c("lst_a", "lst_a", "lst_compartida"),
      name = c("1", "2", "1"),
      label = c("A uno", "A dos", "Compartida uno"),
      stringsAsFactors = FALSE
    )
  )
  inst_b <- list(
    choices = data.frame(
      list_name = c("lst_b", "lst_b", "lst_compartida"),
      name = c("1", "2", "1"),
      label = c("B uno", "B dos", "Compartida uno"),
      stringsAsFactors = FALSE
    )
  )

  listas <- .graficos_collect_palette_lists(list(base_a = inst_a, base_b = inst_b))
  by_name <- stats::setNames(listas, vapply(listas, `[[`, character(1), "list_name"))

  expect_true(all(c("lst_a", "lst_b", "lst_compartida") %in% names(by_name)))
  expect_equal(vapply(by_name$lst_b$choices, `[[`, character(1), "label"), c("B uno", "B dos"))
  expect_equal(length(by_name$lst_compartida$choices), 1L)
})

test_that("paletas configuradas pintan barras agrupadas simples por categoria", {
  skip_if_not_installed("png")

  paleta <- c(
    "Nada util 1" = "#C1121F",
    "2" = "#2A9D8F",
    "3" = "#F4A261"
  )

  out <- tempfile(fileext = ".png")
  .render_agrupadas_args_ui(
    .fixture_agrupadas_args_ui(),
    out,
    colores_categorias = paleta,
    canvas_w_etiquetas = 0.28
  )

  img <- png::readPNG(out)
  expect_gt(.count_near_color_pixels(img, "#C1121F"), 100)
  expect_gt(.count_near_color_pixels(img, "#2A9D8F"), 100)
  expect_gt(.count_near_color_pixels(img, "#F4A261"), 100)
})

test_that("paletas configuradas pintan barras numericas simples por categoria", {
  skip_if_not_installed("png")

  paleta <- c(
    "Grupo A" = "#C1121F",
    "Grupo B" = "#2A9D8F",
    "Grupo C" = "#F4A261"
  )

  out <- tempfile(fileext = ".png")
  .render_numericas_args_ui(
    .fixture_numericas_args_ui(),
    out,
    colores_categorias = paleta
  )

  img <- png::readPNG(out)
  expect_gt(.count_near_color_pixels(img, "#C1121F"), 100)
  expect_gt(.count_near_color_pixels(img, "#2A9D8F"), 100)
  expect_gt(.count_near_color_pixels(img, "#F4A261"), 100)
})

test_that("Word aplica el preset apilado institucional por defecto", {
  wp <- w_presets()
  applied <- .apply_word_chart_presets(NULL, wp)
  apiladas <- applied$barras_apiladas$args

  expect_equal(as.numeric(apiladas$grosor_barras_mult), 1.5)
  expect_false(isTRUE(apiladas$mostrar_barra_extra))
  expect_equal(as.numeric(apiladas$canvas_w_extra), 0)
  expect_equal(as.numeric(apiladas$canvas_w_bars), 0.82)
  expect_equal(as.numeric(apiladas$legend_key_cm), 0.15)
  expect_equal(as.integer(apiladas$legend_n_por_fila), 10L)
  expect_equal(as.numeric(apiladas$legend_espaciado), 0)
  expect_equal(as.numeric(apiladas$size_leyenda), 6)
  expect_equal(as.numeric(apiladas$canvas_h_legend_in), 0.42)
  expect_equal(as.numeric(apiladas$centro_cowplot), 0.5)

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
  expect_equal(applied_with_override$barras_apiladas$args$grosor_barras_mult, 1.5)
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
  expect_equal(
    applied_with_chart_preset$barras_apiladas$args$legend_n_por_fila,
    10
  )
})

test_that("build_w_presets resuelve la funcion aunque exista un objeto con el mismo nombre", {
  w_presets <- list(image = list(width_in = 9))
  built <- .build_w_presets(list(image = list(width_in = 7.25)))

  expect_s3_class(built, "word_presets")
  expect_equal(built$image$width_in, 7.25)
  expect_equal(built$image$height_in, 3.9)
  expect_equal(built$chart_presets$barras_apiladas$legend_n_por_fila, 10)
})

test_that("config de graficos expone defaults Word aunque w_presets venga vacio", {
  cfg <- .graficos_normalize_config(list(w_presets = list()))

  expect_equal(cfg$w_presets$chart_options$ocultar_etiqueta_si_titulo, TRUE)
  expect_equal(cfg$w_presets$chart_presets$barras_apiladas$legend_n_por_fila, 10)
  expect_equal(cfg$w_presets$chart_presets$barras_apiladas$canvas_w_bars, 0.82)
  expect_equal(cfg$w_presets$chart_presets$barras_apiladas$legend_key_cm, 0.15)
  expect_false(isTRUE(cfg$w_presets$chart_presets$barras_apiladas$mostrar_barra_extra))

  custom <- .graficos_normalize_config(list(
    w_presets = list(chart_presets = list(
      barras_apiladas = list(size_leyenda = 7.5)
    ))
  ))
  expect_equal(custom$w_presets$chart_presets$barras_apiladas$size_leyenda, 7.5)
  expect_equal(custom$w_presets$chart_presets$barras_apiladas$legend_n_por_fila, 10)
})

test_that("config de graficos serializa paletas como mapas por etiqueta", {
  cfg <- .graficos_normalize_config(list(
    paletas = list(
      acuerdo = c(
        "Totalmente en desacuerdo" = "#C0392B",
        "En desacuerdo" = "#E67E22"
      )
    )
  ))

  expect_type(cfg$paletas$acuerdo, "list")
  expect_equal(cfg$paletas$acuerdo[["Totalmente en desacuerdo"]], "#C0392B")
  json <- jsonlite::toJSON(list(paletas = cfg$paletas), auto_unbox = TRUE)
  expect_match(as.character(json), '"Totalmente en desacuerdo":"#C0392B"', fixed = TRUE)
})

test_that("p_presets acepta media_rango y Word preserva sus overrides", {
  expect_warning(
    presets <- p_presets(media_rango = list(size_media = 4)),
    NA
  )
  expect_equal(presets$media_rango$args$size_media, 4)

  applied <- .apply_word_chart_presets(
    presets_ppt = presets,
    presets_word = w_presets(chart_presets = list(
      media_rango = list(size_delta = 2.5)
    ))
  )

  expect_equal(applied$media_rango$args$size_media, 4)
  expect_equal(applied$media_rango$args$size_delta, 2.5)
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

test_that("metadata numerica expone limites seguros para la UI", {
  collect_args <- function(items) {
    do.call(c, lapply(items, function(item) item$args %||% list()))
  }
  all_args <- c(
    collect_args(.presets_metadata_payload()$presets),
    collect_args(.graficos_registry_payload()$graficadores)
  )
  numeric_args <- Filter(function(arg) identical(as.character(arg$tipo_input %||% ""), "number"), all_args)

  expect_true(length(numeric_args) > 0)
  expect_false(any(vapply(numeric_args, function(arg) is.null(arg$step), logical(1))))

  decimals <- Filter(function(arg) as.character(arg$name %||% "") %in% c("decimales", "tabla_digits"), numeric_args)
  expect_true(length(decimals) > 0)
  for (arg in decimals) {
    expect_equal(arg$min, 0)
    expect_equal(arg$max, 4)
    expect_equal(arg$step, 1)
  }

  avg_decimals <- Filter(function(arg) identical(as.character(arg$name %||% ""), "decimales_promedio"), numeric_args)
  expect_true(length(avg_decimals) > 0)
  for (arg in avg_decimals) {
    expect_equal(arg$min, 0)
    expect_equal(arg$max, 2)
    expect_equal(arg$step, 1)
  }
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

source("setup-load-all.R")

# G15 (Gonzalo, 2026-10-13): «Ancho de los temas» por lámina en las multiapiladas que comparan públicos.

test_that("el ancho del tema pedido por la lámina pisa el del informe; «auto» lo deja", {
  presets <- list(multi_apiladas_multiactor = list(args = list(canvas_w_grupo = 0.22, canvas_w_etiquetas = 0.12)))
  ancho <- .multiactor_preset_de(presets, list(overrides = list(ancho_tema = "ancho")))
  expect_identical(ancho$canvas_w_grupo, 0.28)
  expect_identical(ancho$canvas_w_etiquetas, 0.12)
  expect_identical(.multiactor_preset_de(presets, list(overrides = list(ancho_tema = "angosto")))$canvas_w_grupo, 0.14)
  expect_identical(.multiactor_preset_de(presets, list(overrides = list(ancho_tema = "auto")))$canvas_w_grupo, 0.22)
  expect_identical(.multiactor_preset_de(presets, list())$canvas_w_grupo, 0.22)
})

test_that("«Más ancho» con barra extra deja a las barras sobre el piso: el motor no vuelve al reparto por defecto", {
  r <- .multiactor_canvas_resolver(.multiactor_preset_de(list(), list(overrides = list(ancho_tema = "ancho"))), show_extra = TRUE)
  expect_identical(r$canvas_w_grupo, 0.28)
  expect_gte(r$canvas_w_bars, .MULTIACTOR_W_BARS_MIN)
})

test_that("p_barras_multiapiladas guarda el ancho en overrides y rechaza un valor que no existe", {
  g <- p_barras_multiapiladas(modo = "var", vars = c("a", "b"), ancho_tema = "ancho")
  expect_identical(g$overrides$ancho_tema, "ancho")
  expect_error(p_barras_multiapiladas(modo = "var", vars = c("a", "b"), ancho_tema = "enorme"), "ancho_tema")
  meta <- Filter(function(a) identical(a$name, "ancho_tema"), .GRAFICADORES_META$p_barras_multiapiladas$args %||% list())
  expect_length(meta, 1L)
  expect_setequal(vapply(meta[[1]]$choices, `[[`, "", "value"), names(.MULTIACTOR_ANCHO_TEMA))
})

test_that("una lámina con «Más ancho» se arma entera: el ajuste no llega al graficador como argumento ajeno", {
  set.seed(3); n <- 60
  df <- data.frame(e = sample(c("1", "2", "3", "4"), n, TRUE), e2 = sample(c("1", "2", "3", "4"), n, TRUE), stringsAsFactors = FALSE)
  inst <- list(
    survey = data.frame(name = c("e", "e2"), type = "select_one esc", list_name = "esc", label = c("Escala E", "Escala E2"),
                        stringsAsFactors = FALSE),
    choices = data.frame(list_name = "esc", name = c("1", "2", "3", "4"),
                         label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo"), stringsAsFactors = FALSE),
    orders_list = NULL)
  out <- tempfile(fileext = ".pptx")
  plan <- p_plan(slides = list(p_slide_1_grafico(p_barras_multiapiladas(modo = "var", vars = c("e", "e2"), ancho_tema = "ancho"), titulo = "Ancho")))
  expect_no_error(suppressMessages(suppressWarnings(
    reporte_ppt_plan(data = df, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE))))
  expect_true(file.exists(out))
})

test_that("en las láminas de la matriz (0.22 propio) «Más ancho» manda y «Automático» parte del 0.22", {
  el <- list(overrides = list(canvas_w_grupo = 0.22, ancho_tema = "ancho"))
  expect_identical(.multiactor_preset_de(list(), el)$canvas_w_grupo, 0.28)
  expect_null(.multiactor_overrides_de(el$overrides)$canvas_w_grupo)       # no vuelve a pisar el reparto al final
  auto <- list(overrides = list(canvas_w_grupo = 0.22, ancho_tema = "auto"))
  expect_identical(.multiactor_preset_de(list(), auto)$canvas_w_grupo, 0.22)
  expect_identical(.multiactor_overrides_de(auto$overrides)$canvas_w_grupo, 0.22)
  r <- .multiactor_canvas_resolver(.multiactor_preset_de(list(), auto), show_extra = TRUE)
  expect_equal(r$canvas_w_grupo + r$canvas_w_buf_grupo_etq + r$canvas_w_etiquetas + r$canvas_w_buf_etq_bars +
                 r$canvas_w_bars + r$canvas_w_buf_bars_extra + r$canvas_w_extra, 1)
})

# G10 (Gonzalo, 2026-10-13): la dicotómica del recetario (lámina 76, cifras grandes en los polos) como tipo de gráfico
# elegible. Por dentro es la categórica; la lámina sale con la pieza `.lam_laminas_dicotomia`.

test_that("«Dicotómica» está en el registro, en Categorías y sale nativa", {
  expect_identical(.GRAFICADORES_META$p_dicotomica$titulo_humano, "Dicotómica")
  expect_identical(.GRAFICOS_SALIDA_EDITOR$p_dicotomica[[1]], "categorias")
  expect_identical(.GRAFICOS_SALIDA_EDITOR$p_dicotomica[[2]], "nativa")
  expect_true(inherits(p_dicotomica("p1"), "ppt_element"))
})

test_that("una pregunta Sí/No con p_dicotomica sale como la dicotómica del recetario, cifras en los polos", {
  skip_if_not_installed("officer")
  dat <- data.frame(p1 = rep(c("1", "2"), c(172, 4)), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = "p1", type = "select_one sn", list_name = "sn", label = "¿Está trabajando actualmente?", stringsAsFactors = FALSE),
               choices = data.frame(list_name = "sn", name = c("1", "2"), label = c("Sí", "No"), stringsAsFactors = FALSE), orders_list = NULL)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, plan = list(p_slide_1_grafico(p_dicotomica("p1"), titulo = "Situación laboral")),
                                                     path_ppt = out, mensajes_progreso = FALSE)))
  xml <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  cifras <- xml2::xml_text(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='dicotomia:cifra']]"))
  expect_identical(cifras, c("98%", "2%"))
})

source("setup-load-all.R")

# H38 (docs/qa/checklist-motor-ppt-diagnostico-2026-10-06.md): cuando la variable numerica tiene una hermana `_recod`
# (edad y edad_recod con rangos 1 a 4), el motor redirige automaticamente a la recodificada y p_numerico, p_boxplot y
# p_media_rango promediaban los CODIGOS de los rangos (2.3 «años») en vez de la edad. En ACRD CONTA toda numerica
# tiene `_recod`. Las metricas numericas usan la columna original; los graficos de categorias siguen usando la recod.

fixture_edad <- function() {
  edad <- c(19, 20, 21, 22, 23, 24, 25, 30, 35, 40, 20, 21, 22, 23, 24, 26, 28, 31, 33, 38)
  rec <- as.character(cut(edad, c(0, 21, 25, 30, 99), labels = FALSE))
  dat <- data.frame(edad = edad, edad_recod = rec, sexo = rep(c("1", "2"), each = 10), stringsAsFactors = FALSE)
  inst <- list(
    survey = data.frame(name = c("edad", "edad_recod", "sexo"), type = c("integer", "select_one lst_rango", "select_one lst_sexo"),
                        list_name = c(NA, "lst_rango", "lst_sexo"), label = c("Edad", "Edad (rangos)", "Sexo"), stringsAsFactors = FALSE),
    choices = data.frame(list_name = c(rep("lst_rango", 4), rep("lst_sexo", 2)), name = c("1", "2", "3", "4", "1", "2"),
                         label = c("Hasta 21", "22 a 25", "26 a 30", "31 a más", "Hombres", "Mujeres"), stringsAsFactors = FALSE),
    orders_list = NULL)
  list(data = dat, instrumento = inst)
}
render_uno <- function(grafico, presets = p_presets()) {
  fx <- fixture_edad()
  reporte_ppt_plan(data = fx$data, instrumento = fx$instrumento, plan = list(d1 = p_slide_1_grafico(grafico = grafico)),
                   presets = presets, solo_lista = TRUE, mensajes_progreso = FALSE)$rendered[[1]]
}

test_that("p_numerico promedia la edad, no los códigos de sus rangos (H38)", {
  skip_if_not_installed("ggplot2")
  d <- attr(render_uno(p_numerico(var = "edad", cruce = "sexo", metrica = "mean")), "pulso_numerico_data")
  v <- stats::setNames(as.numeric(d$valor), as.character(d$categoria))
  expect_equal(unname(v[["Hombres"]]), mean(c(19, 20, 21, 22, 23, 24, 25, 30, 35, 40)))
  expect_gt(min(v), 10)
})

test_that("p_boxplot y p_media_rango dibujan la edad, no los códigos (H38)", {
  skip_if_not_installed("ggplot2")
  sin_lienzo <- p_presets(boxplot = list(usar_canvas = FALSE, mostrar_puntos = FALSE), media_rango = list(usar_canvas = FALSE))
  for (g in list(p_boxplot(var = "edad", cruce = "sexo"), p_media_rango(var = "edad", cruce = "sexo"))) {
    d <- render_uno(g, sin_lienzo)$data
    nums <- unlist(d[vapply(d, is.numeric, logical(1))])
    expect_gt(max(nums, na.rm = TRUE), 10)
  }
})

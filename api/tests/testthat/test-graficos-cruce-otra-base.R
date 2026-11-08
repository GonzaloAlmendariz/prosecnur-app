source("setup-load-all.R")

# Un cruce escrito con otra base (`b1$sexo` en un gráfico de `b2$q1`) se dibuja con la columna de la base de la pregunta:
# el render lo resuelve con `.resolve_ref(cruce, source = ctx_var$source)`. Antes lo hacía en silencio; ahora avisa
# (graficos_cruce_otra_base.R, B8).

test_that("el cruce que nombra otra base avisa; el de la misma base o sin calificar, no", {
  el <- p_barras_apiladas("b2$q1", cruces = "b1$sexo")
  expect_message(.cruce_otra_base_avisar(el, NA_character_), "el cruce nombra la base \"b1\", pero el gráfico lee la base \"b2\"")
  expect_silent(.cruce_otra_base_avisar(p_barras_apiladas("b2$q1", cruces = "b2$sexo"), NA_character_))
  expect_silent(.cruce_otra_base_avisar(p_barras_apiladas("b2$q1", cruces = "sexo"), NA_character_))
  expect_silent(.cruce_otra_base_avisar(p_barras_apiladas("b2$q1", cruces = "B2$sexo"), NA_character_))   # sin mayúsculas
  expect_silent(.cruce_otra_base_avisar(p_barras_apiladas("b2$q1"), NA_character_))
  # La pregunta sin calificar lee la base por defecto.
  expect_message(.cruce_otra_base_avisar(p_barras_apiladas("q1", cruces = "b1$sexo"), "b2"), "lee la base \"b2\"")
  expect_silent(.cruce_otra_base_avisar(p_barras_apiladas("q1", cruces = "b1$sexo"), NA_character_))   # base desconocida
  # Agrupada (también con el cruce heredado del preset), multiapilada por cruce y boxplot.
  expect_message(.cruce_otra_base_avisar(p_barras_agrupadas("b2$q1", cruces = "b1$sexo"), NA_character_), "nombra la base \"b1\"")
  expect_message(.cruce_otra_base_avisar(p_barras_agrupadas("b2$q1"), NA_character_,
                                         list(barras_agrupadas = list(args = list(cruces = "b1$sexo")))), "nombra la base \"b1\"")
  expect_message(.cruce_otra_base_avisar(.rebuild_graf(list(graficador = "p_barras_multiapiladas", args = list(modo = "cruce", var = "b2$q1", cruces = "b1$sexo"))), NA_character_),
                 "nombra la base \"b1\"")
  expect_message(.cruce_otra_base_avisar(p_boxplot("b2$edad", cruce = "b1$sexo"), NA_character_), "nombra la base \"b1\"")
})

test_that("el paso del plan avisa una vez por gráfico, también anidado, y no cambia el plan", {
  plan <- p_plan(slides = list(
    p_slide_2_graficos(p_barras_apiladas("b2$q1", cruces = "b1$sexo"), p_barras_apiladas("b2$q1", cruces = "b2$sexo"),
                       titulo = "Dos")))
  msgs <- testthat::capture_messages(out <- .plan_avisar_cruce_otra_base(plan, NA_character_, NULL))
  expect_length(grep("nombra la base", msgs, value = TRUE), 1L)
  expect_identical(out, plan)
})

test_that("reporte_ppt_plan avisa del cruce de otra base y dibuja el de la base de la pregunta", {
  skip_if_not_installed("openxlsx"); skip_if_not_installed("ggplot2")
  inst <- local({
    survey <- data.frame(type = c("select_one lk", "select_one sx"), name = c("q1", "sexo"), label = c("Reglamentos", "Sexo"),
                         stringsAsFactors = FALSE)
    choices <- data.frame(list_name = c(rep("lk", 3), rep("sx", 2)), name = c("1", "2", "3", "1", "2"),
                          label = c("Poco", "Algo", "Mucho", "Hombre", "Mujer"), stringsAsFactors = FALSE)
    x <- tempfile(fileext = ".xlsx")
    openxlsx::write.xlsx(list(survey = survey, choices = choices), x)
    suppressMessages(reporte_instrumento(x))
  })
  set.seed(4)
  b1 <- data.frame(q1 = sample(c("1", "2", "3"), 30, TRUE), sexo = rep("1", 30), stringsAsFactors = FALSE)
  b2 <- data.frame(q1 = sample(c("1", "2", "3"), 50, TRUE), sexo = sample(c("1", "2"), 50, TRUE), stringsAsFactors = FALSE)
  el <- .rebuild_graf(list(graficador = "p_barras_agrupadas", args = list(var = "b2$q1", cruces = "b1$sexo")))
  msgs <- testthat::capture_messages(out <- suppressWarnings(reporte_ppt_plan(
    data = list(b1 = b1, b2 = b2), instrumento = list(b1 = inst, b2 = inst), solo_lista = TRUE, mensajes_progreso = FALSE,
    plan = p_plan(slides = list(p_slide_1_grafico(el, titulo = "Grupos"))))))
  expect_true(any(grepl("nombra la base \"b1\", pero el gráfico lee la base \"b2\"", msgs, fixed = TRUE)), info = paste(msgs, collapse = " | "))
  # Lo que dibuja: los grupos de `sexo` en b2 (b1 sólo tiene hombres).
  expect_identical(attr(out$rendered[[1]], "pulso_barras_series", exact = TRUE), c("Hombre", "Mujer"))
})

source("setup-load-all.R")

# H29 (GOAL motor PPT, P19): el arg `cruces` de p_barras_apiladas era inerte —
# la UI promete "cada barra es un grupo de la variable de cruce" pero
# .render_barras_apiladas construia la tabla solo con `var`. Con el fix, el
# cruce delega en la maquinaria de multiapiladas modo="cruce" (una fila
# apilada por grupo). El dml del slide debe contener las etiquetas de los
# grupos del cruce.

.h29_fixture <- function() {
  set.seed(11)
  lik <- c("Bajo", "Medio", "Alto")
  df <- data.frame(
    p1 = sample(lik, 120, replace = TRUE),
    zona = sample(c("Lima Norte", "Lima Sur", "Callao"), 120, replace = TRUE)
  )
  attr(df$p1, "label") <- "Nivel de satisfacción"
  inst <- list(
    survey = data.frame(
      name = c("p1", "zona"),
      type = c("select_one l1", "select_one l2"),
      list_name = c("l1", "l2"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c(rep("l1", 3), rep("l2", 3)),
      name = c(lik, "Lima Norte", "Lima Sur", "Callao"),
      label = c(lik, "Lima Norte", "Lima Sur", "Callao"),
      stringsAsFactors = FALSE
    ),
    orders_list = list(p1 = list(names = lik, labels = lik))
  )
  list(df = df, inst = inst)
}

test_that("apiladas con cruce rinde una fila apilada por grupo (H29)", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  fx <- .h29_fixture()
  out_ppt <- tempfile(fileext = ".pptx")
  reporte_ppt_plan(
    data = fx$df, instrumento = fx$inst,
    plan = list(d1 = p_slide_1_grafico(
      p_barras_apiladas(var = "p1", cruces = "zona"), titulo = "Cruce"
    )),
    presets = p_presets(), path_ppt = out_ppt, mensajes_progreso = FALSE
  )
  xml <- paste(readLines(unz(out_ppt, "ppt/slides/slide1.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  # una fila por grupo: las etiquetas de los grupos del cruce estan en la lamina
  expect_match(xml, "Lima Norte", fixed = TRUE)
  expect_match(xml, "Callao", fixed = TRUE)
})

test_that("apiladas sin cruce sigue rindiendo la barra unica de siempre", {
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")

  fx <- .h29_fixture()
  out_ppt <- tempfile(fileext = ".pptx")
  reporte_ppt_plan(
    data = fx$df, instrumento = fx$inst,
    plan = list(d1 = p_slide_1_grafico(p_barras_apiladas(var = "p1"), titulo = "Simple")),
    presets = p_presets(), path_ppt = out_ppt, mensajes_progreso = FALSE
  )
  xml <- paste(readLines(unz(out_ppt, "ppt/slides/slide1.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_false(grepl("Lima Norte", xml, fixed = TRUE))
  expect_match(xml, "Medio", fixed = TRUE)
})

# Una multiapilada `var` de una sola pregunta no repite como encabezado la pregunta que ya es el título de la lámina
# (CCSS 2026: calidad de la educación en escala de 7). Fixture sintético.

test_that("la comparación ignora tildes, mayúsculas, signos y espacios", {
  expect_true(.lam_mismo_texto("¿Cómo calificas la calidad de la educación?", "como calificas la  calidad de la educacion"))
  expect_false(.lam_mismo_texto("Calidad de la educación", "Calidad de la infraestructura"))
  expect_false(.lam_mismo_texto("", ""))
  expect_false(.lam_mismo_texto("Algo", NULL))
})

test_that("con una sola premisa igual al título, la lámina no la repite como encabezado; si difiere, sí la escribe", {
  niv <- c("Muy mala", "Mala", "Regular", "Buena", "Muy buena")
  set.seed(2)
  d <- data.frame(calidad = sample(niv, 120, TRUE), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = "calidad", type = "select_one l_c", list_name = "l_c",
                                   label = "¿Cómo calificas la calidad de la educación?"),
               choices = data.frame(list_name = "l_c", name = niv, label = niv), orders_list = NULL)
  textos_pregunta <- function(titulo) {
    out <- tempfile(fileext = ".pptx")
    suppressMessages(suppressWarnings(reporte_ppt_plan(data = d, instrumento = inst, path_ppt = out, mensajes_progreso = FALSE,
      plan = p_plan(slides = list(p_slide_1_grafico(titulo = titulo, grafico = p_barras_multiapiladas(modo = "var", vars = "calidad")))))))
    x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
    xml2::xml_text(xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='pregunta']]"))
  }
  expect_length(textos_pregunta("¿Cómo calificas la calidad de la educación?"), 0L)
  expect_identical(textos_pregunta("Calidad de la educación en la Facultad"), "¿Cómo calificas la calidad de la educación?")
})

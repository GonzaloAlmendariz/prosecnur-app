# G11 (Gonzalo, 2026-10-13: «aún hay gráficos sin motor como el de puntos comparativos»): la lámina sale con las piezas
# del ranking con puntos del recetario (lámina 72), editables, en el orden de los grupos y con el encabezado del corte.

test_that("puntos comparativos sale nativo, con un punto por grupo en su orden y «% que responde Sí»", {
  skip_if_not_installed("officer")
  inst <- list(survey = data.frame(type = c("select_one respuesta", "select_one grupos"), name = c("indicador", "grupo"),
                                   list_name = c("respuesta", "grupos"), label = c("Conoce la misión", "Público"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = c("respuesta", "respuesta", "grupos", "grupos", "grupos"), name = c("1", "2", "D", "E", "A"),
                                    label = c("Sí", "No", "Docentes", "Estudiantes", "Administrativos"), stringsAsFactors = FALSE), orders_list = NULL)
  dat <- data.frame(indicador = rep(c("1", "2", "1", "2", "1", "2"), c(98, 2, 77, 23, 0, 10)),
                    grupo = rep(c("D", "E", "A"), c(100, 100, 10)), stringsAsFactors = FALSE)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst,
    plan = list(p_slide_1_grafico(p_puntos_comparativos("indicador", "grupo", "1"), titulo = "Conoce la misión")), path_ppt = out, mensajes_progreso = FALSE)))
  x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  txt <- function(n) xml2::xml_text(xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
  expect_identical(txt("lollipop:rotulo"), c("Docentes", "Estudiantes", "Administrativos"))
  expect_identical(txt("lollipop:cifra"), c("98%", "77%", "0%"))   # el grupo en 0 % no desaparece
  expect_identical(txt("lollipop:encabezado"), "% que responde Sí")
})

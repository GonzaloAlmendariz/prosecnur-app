# ADR 0093 (N3) — la pregunta categórica sale en columnas como la lámina 68 del recetario.

test_that("las columnas ocupan la geometría del recetario y miden la cifra rotulada", {
  e <- preparar_categorica(c("Quinto", "Sexto", "Séptimo"), c(.32, .28, .40), c("32%", "28%", "40%"), c(32, 28, 40))
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  o <- .lam_laminas_categorica(doc, e, "Nivel", ante = "Barras categóricas", base = "Base: 100", folio = 68, unidad_n = "estudiantes")
  x <- o$doc$slide$get_slide(o$doc$cursor)$get()
  col <- xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='columna']]")
  alto <- as.numeric(xml2::xml_attr(xml2::xml_find_first(col, "p:spPr/a:xfrm/a:ext"), "cy")) / 914400
  expect_equal(alto / max(alto), c(.32, .28, .40) / .40, tolerance = 0.01)
  expect_equal(max(alto), 3.4 / 1.1, tolerance = 0.01)   # la mayor llega a hmax / 1.1
  n <- xml2::xml_text(xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='n']]"))
  expect_identical(n, c("32 estudiantes", "28 estudiantes", "40 estudiantes"))
})

test_that("en la ruta real p_barras_categoricas sale nativa en columnas, con el público de la base y su folio", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  niveles <- c("Quinto", "Sexto", "Otros")
  dat <- data.frame(p1 = rep(niveles, c(22, 19, 3)), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = "p1", type = "select_one cic", list_name = "cic", label = "Ciclo", stringsAsFactors = FALSE),
               choices = data.frame(list_name = "cic", name = niveles, label = niveles, stringsAsFactors = FALSE), orders_list = NULL)
  plan <- list(a = p_slide_texto(titulo = "Antes", texto = "x"),
               b = p_slide_1_grafico(grafico = p_barras_categoricas("p1"), titulo = "Nivel curricular"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  doc <- officer::read_pptx(out)
  xml <- xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc))))
  expect_false(inherits(xml2::xml_find_first(xml, "//p:grpSp[p:nvGrpSpPr/p:cNvPr[@name='prosecnur:grafico:categorica']]"), "xml_missing"))
  txt <- function(n) xml2::xml_text(xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
  expect_identical(txt("Folio lamina"), as.character(length(doc)))
  expect_identical(txt("rotulo"), c("Quinto", "Sexto", "Otros"))
  expect_false(any(grepl("NA", txt("Antetitulo lamina"))))
})

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

test_that("la agrupada de una serie adjunta su especificación en el orden del graficador; con dos series no", {
  d <- data.frame(categoria = c("A", "B", "Otros", "C"), N = 100, s1 = c(.2, .5, .05, .25), s2 = c(.3, .3, .1, .3))
  g1 <- suppressWarnings(graficar_barras_agrupadas(d, "categoria", "N", "s1", c(s1 = "Serie"), orden_barras = "mayor_menor",
                                                   exportar = "rplot", decimales = 0))
  e <- attr(g1, "pulso_espec")
  expect_identical(e$tipo, "categorica")
  expect_identical(e$rotulos, c("B", "C", "A", "Otros"))
  expect_identical(e$cifras, c("50%", "25%", "20%", "5%"))
  g2 <- suppressWarnings(graficar_barras_agrupadas(d, "categoria", "N", c("s1", "s2"), c(s1 = "Uno", s2 = "Dos"), exportar = "rplot"))
  expect_null(attr(g2, "pulso_espec"))
})

test_that("la espec de la agrupada lleva las cifras que rotula el gráfico: su redondeo y su «(n)»", {
  # Con decimales = 1 el gráfico escribe «60%» (entero sin «.0») y con mostrar_n_en_etiquetas «60% (3)»; la espec
  # reformateaba por su cuenta y la lámina nativa decía «60.0%» y perdía la frecuencia.
  d <- data.frame(categoria = c("No", "Sí"), N = 5, s1 = c(.4, .6))
  e1 <- attr(suppressWarnings(graficar_barras_agrupadas(d, "categoria", "N", "s1", c(s1 = "S"), exportar = "rplot", decimales = 1)), "pulso_espec")
  expect_setequal(e1$cifras, c("40%", "60%"))
  e2 <- attr(suppressWarnings(graficar_barras_agrupadas(d, "categoria", "N", "s1", c(s1 = "S"), exportar = "rplot", decimales = 1,
                                                        mostrar_n_en_etiquetas = TRUE)), "pulso_espec")
  expect_setequal(e2$cifras, c("40% (2)", "60% (3)"))
  expect_equal(sort(e2$largos), c(.4, .6))
  # Una cifra que el gráfico calla por umbral la lámina igual la escribe (el recetario rotula todas).
  d3 <- data.frame(categoria = c("A", "B", "C"), N = 100, s1 = c(.02, .5, .48))
  e3 <- attr(suppressWarnings(graficar_barras_agrupadas(d3, "categoria", "N", "s1", c(s1 = "S"), exportar = "rplot", decimales = 0,
                                                        umbral_etiqueta = 0.05)), "pulso_espec")
  expect_true("2%" %in% e3$cifras)
})

test_that("en la ruta real p_barras_agrupadas de una serie sale nativa en barras horizontales con la mayor realzada", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  niveles <- c("Alimentos", "Salud", "Educación", "Otros")
  dat <- data.frame(p1 = rep(niveles, c(40, 20, 30, 10)), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = "p1", type = "select_one gas", list_name = "gas", label = "Gasto", stringsAsFactors = FALSE),
               choices = data.frame(list_name = "gas", name = niveles, label = niveles, stringsAsFactors = FALSE), orders_list = NULL)
  plan <- list(b = p_slide_1_grafico(grafico = p_barras_agrupadas("p1"), titulo = "Gasto"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  xml <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  expect_false(inherits(xml2::xml_find_first(xml, "//p:grpSp[p:nvGrpSpPr/p:cNvPr[@name='prosecnur:grafico:categorica']]"), "xml_missing"))
  barras <- xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='barra']]")
  expect_length(barras, 4L)
  rot <- xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='rotulo']]")
  expect_identical(tail(xml2::xml_text(rot), 1), "Otros")    # la residual al final
  negrita <- xml2::xml_attr(xml2::xml_find_first(rot, ".//a:rPr"), "b")
  expect_identical(xml2::xml_text(rot)[negrita == "1"], "Alimentos")   # la mayor, en negrita
})

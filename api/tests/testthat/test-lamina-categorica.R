# Estas pruebas miran orden y forma, no los casos: «Casos junto al porcentaje» en «nunca» (sus fixtures tienen base chica).
withr::local_options(prosecnur.casos_junto = list(cuando = "nunca"))

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

test_that("la agrupada de una serie adjunta su especificación en el orden en que se lee el gráfico; con dos series no", {
  d <- data.frame(categoria = c("A", "B", "Otros", "C"), N = 100, s1 = c(.2, .5, .05, .25), s2 = c(.3, .3, .1, .3))
  # Con la inversión del preset de la casa, de arriba hacia abajo: mayor a menor y «Otros» al final.
  g1 <- suppressWarnings(graficar_barras_agrupadas(d, "categoria", "N", "s1", c(s1 = "Serie"), orden_barras = "mayor_menor",
                                                   invertir_barras = TRUE, exportar = "rplot", decimales = 0))
  e <- attr(g1, "pulso_espec")
  expect_identical(e$tipo, "categorica")
  expect_identical(e$rotulos, c("B", "C", "A", "Otros"))
  expect_identical(e$cifras, c("50%", "25%", "20%", "5%"))
  # Sin invertir, coord_flip pone el primer nivel abajo y la espec lo sigue (paridad con la ruta ggplot; F6.1 decide).
  g0 <- suppressWarnings(graficar_barras_agrupadas(d, "categoria", "N", "s1", c(s1 = "Serie"), orden_barras = "mayor_menor",
                                                   exportar = "rplot", decimales = 0))
  e0 <- attr(g0, "pulso_espec")
  expect_identical(e0$rotulos, rev(ggplot2::ggplot_build(g0)$layout$panel_params[[1]]$y$get_labels()))
  expect_identical(e0$cifras[match(c("A", "B", "Otros", "C"), e0$rotulos)], c("20%", "50%", "5%", "25%"))
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
  # Con la inversión del preset de la casa: el ggplot se lee de mayor a menor con la residual abajo y la nativa lo sigue
  # (sin ella, coord_flip pone el primer nivel abajo y la nativa también; paridad, F6.1 decide).
  plan <- list(b = p_slide_1_grafico(grafico = p_barras_agrupadas("p1", overrides = list(invertir_barras = TRUE)), titulo = "Gasto"))
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

test_that("la dicotomía se reconoce en las dos especificaciones y sólo cuando reparte el 100 % en dos", {
  expect_true(.lam_es_dicotomia(preparar_categorica(c("Sí", "No"), c(.62, .38), c("62%", "38%"), c(109, 67))))
  expect_false(.lam_es_dicotomia(preparar_categorica(c("A", "B"), c(.62, .58), c("62%", "58%"))))          # múltiple
  expect_false(.lam_es_dicotomia(preparar_categorica(c("A", "B", "C"), c(.5, .3, .2), c("50%", "30%", "20%"))))
  df <- data.frame(cat = "p11", n = 176, Si = .62, No = .38)
  e <- preparar_escala(df, var_categoria = "cat", var_n = "n", cols_porcentaje = c("Si", "No"), etiquetas_grupos = c("Sí", "No"))
  expect_true(.lam_es_dicotomia(e))
  d <- .lam_dicotomia_datos(e)
  expect_identical(d$cifras, c("62%", "38%")); expect_equal(d$largos, c(.62, .38))
  df2 <- rbind(df, data.frame(cat = "p12", n = 176, Si = .5, No = .5))
  expect_false(.lam_es_dicotomia(preparar_escala(df2, var_categoria = "cat", var_n = "n", cols_porcentaje = c("Si", "No"),
                                                 etiquetas_grupos = c("Sí", "No"))))
})

test_that("la lámina de dicotomía tiene la geometría de la 74: barra de 0.7 in partida por la cifra rotulada", {
  withr::local_options(prosecnur.casos_junto = list(cuando = "siempre"))   # la dicotomía con «(n)» es el modo «siempre» del ajuste
  e <- preparar_categorica(c("Sí", "No"), c(.98, .02), c("98%", "2%"), c(172, 4))
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  o <- .lam_laminas_dicotomia(doc, e, "Situación laboral del egresado", ante = "Dicotómica", pregunta = "¿Está trabajando actualmente?",
                              publico = "176 egresados", base = "Base: 176 egresados", folio = 74)
  expect_identical(o$partes, 1L)
  out <- tempfile(fileext = ".pptx"); print(o$doc, target = out)
  xml <- xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(o$doc))))
  txt <- function(n) xml2::xml_text(xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
  expect_identical(txt("dicotomia:cifra"), c("98%", "2%"))
  expect_identical(txt("dicotomia:rotulo"), c("Sí (172)", "No (4)"))
  expect_identical(txt("panel:pregunta"), "¿Está trabajando actualmente?")
  expect_identical(txt("panel:base"), "176 egresados")
  ext <- xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='dicotomia:segmento']]/p:spPr/a:xfrm/a:ext")
  cx <- as.numeric(xml2::xml_attr(ext, "cx")) / 914400; cy <- as.numeric(xml2::xml_attr(ext, "cy")) / 914400
  expect_equal(cy, c(0.7, 0.7), tolerance = 1e-3)
  ancho <- .std_geom("ancho") - .std_geom("margen_izq") - .std_geom("margen_der")
  expect_equal(max(cx), ancho * .98 + 0.004, tolerance = 1e-3)   # el Sí mide su 98 % rotulado
})

test_that("en la ruta real una categórica de dos opciones que suman 100 sale como dicotomía partida", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  dat <- data.frame(p1 = rep(c("1", "2"), c(172, 4)), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = "p1", type = "select_one sn", list_name = "sn", label = "¿Está trabajando actualmente?", stringsAsFactors = FALSE),
               choices = data.frame(list_name = "sn", name = c("1", "2"), label = c("Sí", "No"), stringsAsFactors = FALSE), orders_list = NULL)
  plan <- list(b = p_slide_1_grafico(grafico = p_barras_categoricas("p1"), titulo = "Situación laboral"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  xml <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  expect_false(inherits(xml2::xml_find_first(xml, "//p:grpSp[p:nvGrpSpPr/p:cNvPr[@name='prosecnur:grafico:dicotomia']]"), "xml_missing"))
  txt <- function(n) xml2::xml_text(xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
  expect_identical(txt("dicotomia:cifra"), c("98%", "2%"))
  expect_identical(txt("panel:pregunta"), "¿Está trabajando actualmente?")
})

test_that("las barras agrupadas van de 0 a 100 % por defecto y con eje libre escalan al máximo (Gonzalo, 2026-10-09)", {
  largo <- function(e) { lz <- .lam_lienzo(); .lam_barras_h(lz, e, 0.5, 2, 12, wlab = 2, g = 0.3, fila = 0.5)
    bb <- do.call(rbind, lz$cajas); (bb[, 3] - bb[, 1])[c(2, 5)] }
  e <- preparar_categorica(c("A", "B"), c(0.5, 0.25), c("50%", "25%"))
  expect_equal(largo(e)[1] / 9.2, 0.5 / 0.56, tolerance = 1e-6)          # sin marca: al máximo con aire (recetario)
  e$escala_completa <- TRUE
  expect_equal(largo(e), c(4.6, 2.3), tolerance = 1e-6)                 # 50 % es la mitad del ancho de la barra
  d <- data.frame(categoria = c("Sí", "No"), N = c(30, 10), pct = c(0.75, 0.25), stringsAsFactors = FALSE)
  esp <- function(...) attr(suppressWarnings(graficar_barras_agrupadas(data = d, var_categoria = "categoria", var_n = "N", cols_porcentaje = "pct", etiquetas_series = c(pct = "Total"), ...)), "pulso_espec")
  e1 <- esp()
  expect_identical(e1$tipo, "categorica")
  expect_true(isTRUE(e1$escala_completa))
  expect_false(isTRUE(esp(usar_eje_libre = TRUE)$escala_completa))
})

test_that("la lámina nativa escribe las marcas 0-100 % sólo si se piden y con escala completa (Gonzalo, 2026-10-09)", {
  marcas <- function(e) { lz <- .lam_lienzo(); .lam_barras_h(lz, e, 0.5, 2, 12, wlab = 2, g = 0.3, fila = 0.5)
    sum(vapply(lz$formas, function(f) grepl('name="eje:marca"', f, fixed = TRUE), TRUE)) }
  e <- preparar_categorica(c("A", "B"), c(0.5, 0.25), c("50%", "25%")); e$escala_completa <- TRUE
  expect_equal(marcas(e), 0L)
  e$marcas_eje <- TRUE
  expect_equal(marcas(e), 5L)
  e$escala_completa <- FALSE
  expect_equal(marcas(e), 0L)
})

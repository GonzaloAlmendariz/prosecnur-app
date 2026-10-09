# Torta (lámina 69) y dona (lámina 70) con formas nativas (ADR 0093, N6).

.ci_xml <- function(doc) { out <- tempfile(fileext = ".pptx"); print(doc, target = out); xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc)))) }
.ci_txt <- function(xml, n) xml2::xml_text(xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
.ci_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))

test_that("los ángulos de PowerPoint arrancan a las 12 y giran en sentido horario", {
  expect_identical(.lam_angulo_ppt(0), 270L * 60000L)                         # las 12
  expect_identical(.lam_angulo_ppt(0.25), 0L)                                  # las 3
  expect_identical(.lam_angulo_ppt(0.5), 90L * 60000L)                         # las 6
})

test_that("graficar_pie adjunta su espec con las cifras del redondeo del gráfico", {
  e <- attr(graficar_pie(data.frame(c = c("Sí", "No"), p = c(56, 122) / 178, n = c(56, 122)), "c", "p", var_n = "n", tipo_pie = "pie"), "pulso_espec")
  expect_identical(e$tipo, "pie"); expect_identical(e$forma, "pie")
  expect_identical(e$cifras, c("31%", "69%")); expect_equal(e$total_n, 178)
})

test_that("la torta nativa dibuja un sector por porción, la cifra dentro o fuera y la leyenda de cifras", {
  e <- attr(graficar_pie(data.frame(c = c("Sí", "No", "NS"), p = c(.6, .33, .07), n = c(60, 33, 7)), "c", "p", var_n = "n", tipo_pie = "pie"), "pulso_espec")
  o <- .lam_laminas_torta(.ci_doc(), e, "Torta", folio = 69, unidad_n = "egresados")
  xml <- .ci_xml(o$doc)
  sec <- xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='torta:porcion']]")
  expect_length(sec, 3L)
  expect_identical(unique(xml2::xml_attr(xml2::xml_find_first(sec, ".//a:prstGeom"), "prst")), "pie")
  expect_identical(.ci_txt(xml, "torta:cifra_leyenda"), c("60%", "33%", "7%"))
  expect_identical(.ci_txt(xml, "torta:casos"), c("60 de 100 egresados", "33 de 100 egresados", "7 de 100 egresados"))
  sz <- xml2::xml_attr(xml2::xml_find_first(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='torta:cifra']]"), ".//a:rPr"), "sz")
  expect_identical(sz[3], as.character(.std_pt("cifra_fuera") * 100))         # el 7 % va fuera, en la cifra de fuera
})

test_that("la dona nativa usa arcos, la cifra clave al centro y la lectura con las cifras en negrita", {
  e <- attr(graficar_pie(data.frame(c = c("Sí", "No"), p = c(133, 39) / 172, n = c(133, 39)), "c", "p", var_n = "n", tipo_pie = "donut"), "pulso_espec")
  o <- .lam_laminas_dona(.ci_doc(), e, "Dona", folio = 70, unidad_n = "estudiantes", rotulo_centro = "conoce la misión")
  xml <- .ci_xml(o$doc)
  arc <- xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='dona:porcion']]//a:prstGeom")
  expect_identical(unique(xml2::xml_attr(arc, "prst")), "blockArc")
  expect_identical(.ci_txt(xml, "dona:cifra"), "77%")
  b <- xml2::xml_attr(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='dona:lectura']]//a:rPr"), "b")
  expect_true(any(b == "1") && any(b == "0"))
  expect_match(paste(.ci_txt(xml, "dona:lectura"), collapse = ""), "172 estudiantes")
})

test_that("en la ruta real p_pie y p_donut salen nativos; con muchas porciones la torta sigue por la ruta anterior", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  dat <- data.frame(s = rep(c("1", "2"), c(56, 122)), c5 = rep(c("a", "b", "c", "d", "e"), c(54, 44, 36, 26, 18)), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("s", "c5"), type = c("select_one sn", "select_one l5"), list_name = c("sn", "l5"), label = c("¿Tiene título?", "Cinco"),
                                   stringsAsFactors = FALSE),
               choices = data.frame(list_name = c("sn", "sn", rep("l5", 5)), name = c("1", "2", letters[1:5]), label = c("Sí", "No", toupper(letters[1:5])),
                                    stringsAsFactors = FALSE), orders_list = NULL)
  plan <- list(a = p_slide_1_grafico(grafico = p_pie("s"), titulo = "Torta"), b = p_slide_1_grafico(grafico = p_donut("s"), titulo = "Dona"),
               c = p_slide_1_grafico(grafico = p_pie("c5"), titulo = "Cinco porciones"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  g <- function(k) xml2::xml_attr(xml2::xml_find_all(xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k))), "//p:grpSp/p:nvGrpSpPr/p:cNvPr"), "name")
  expect_true("prosecnur:grafico:torta" %in% g(1))
  expect_true("prosecnur:grafico:dona" %in% g(2))
  expect_false(any(grepl("prosecnur:grafico", g(3))))
})

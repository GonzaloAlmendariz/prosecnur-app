source("setup-load-all.R")

# .docx_conformar() deja el XML de los .docx conforme al esquema de Word: officer
# 0.7.1 y flextable escriben texto suelto en <w:tr>, atributos propios y
# propiedades fuera de orden, y Word puede ofrecer reparar el archivo.

.docx_xml <- function(path, parte) {
  paste(readLines(unz(path, parte), warn = FALSE, encoding = "UTF-8"), collapse = "\n")
}
.docx_partes <- function(path) utils::unzip(path, list = TRUE)$Name
.docx_en_orden <- function(path, parte, tag) {
  doc <- xml2::read_xml(.docx_xml(path, parte))
  ns <- c(w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
  nodos <- xml2::xml_find_all(doc, sprintf("//w:%s", tag), ns)
  all(vapply(nodos, function(n) {
    pos <- match(xml2::xml_name(xml2::xml_children(n)), .DOCX_ORDEN[[tag]])
    !is.unsorted(pos[!is.na(pos)])
  }, logical(1)))
}
.docx_conforme <- function(path) {
  doc_xml <- .docx_xml(path, "word/document.xml")
  expect_false(grepl("</w:trPr>[^<[:space:]]", doc_xml), info = "texto suelto en una fila")
  expect_false(grepl("w:officer=", doc_xml, fixed = TRUE))
  expect_identical(lengths(regmatches(doc_xml, gregexpr("xmlns:w=", doc_xml, fixed = TRUE))), 1L)   # sólo en la raíz
  expect_false(any(c("word/comments.xml", "word/footnotes.xml") %in% .docx_partes(path)))
  expect_false(grepl("comments.xml|footnotes.xml", .docx_xml(path, "[Content_Types].xml")))
  for (tag in c("pPr", "tblPr", "sectPr")) expect_true(.docx_en_orden(path, "word/document.xml", tag), info = tag)
  sett <- xml2::read_xml(.docx_xml(path, "word/settings.xml"))
  pos <- match(xml2::xml_name(xml2::xml_children(sett)), .DOCX_ORDEN$settings)
  expect_false(is.unsorted(pos[!is.na(pos)]))
}

test_that("corrige el docx mínimo de officer y flextable sin cambiar su texto", {
  skip_if_not_installed("officer")
  skip_if_not_installed("flextable")
  path <- tempfile(fileext = ".docx")
  on.exit(unlink(path), add = TRUE)
  doc <- officer::read_docx()
  doc <- officer::body_add_fpar(doc, officer::fpar(officer::ftext("Título"), fp_p = officer::fp_par(keep_with_next = TRUE, border.bottom = officer::fp_border())))
  doc <- flextable::body_add_flextable(doc, flextable::flextable(data.frame(a = c("x", "y"), b = 1:2)))
  print(doc, target = path)
  antes <- officer::docx_summary(officer::read_docx(path))$text

  # el defecto existe antes del posproceso
  expect_true(grepl("</w:trPr>body1", .docx_xml(path, "word/document.xml"), fixed = TRUE))

  .docx_conformar(path)
  .docx_conforme(path)
  expect_identical(officer::docx_summary(officer::read_docx(path))$text, antes)
})

test_that("es idempotente y no falla con un archivo que no existe", {
  skip_if_not_installed("officer")
  path <- tempfile(fileext = ".docx")
  on.exit(unlink(path), add = TRUE)
  print(officer::body_add_par(officer::read_docx(), "Hola"), target = path)
  .docx_conformar(path)
  primero <- .docx_xml(path, "word/document.xml")
  .docx_conformar(path)
  expect_identical(.docx_xml(path, "word/document.xml"), primero)
  expect_silent(.docx_conformar(tempfile(fileext = ".docx")))
})

test_that("los motores Word de la app entregan el docx conforme", {
  skip_if_not_installed("officer")
  skip_if_not_installed("flextable")
  survey <- data.frame(type = c("select_one esc", "text"), name = c("p1", "p2"), label = c("Conoce la misión", "¿Qué mejoraría?"), stringsAsFactors = FALSE)
  choices <- data.frame(list_name = "esc", name = c("1", "2"), label = c("Sí", "No"), stringsAsFactors = FALSE)

  cuestionario <- tempfile(fileext = ".docx")
  reporte_formulario_word(survey = survey, choices = choices, settings = list(form_title = "Prueba"), output_file = cuestionario)
  .docx_conforme(cuestionario)

  ficha <- tempfile(fileext = ".docx")
  .analitica_write_ficha_tecnica_docx(path_docx = ficha, data = list(docentes = data.frame(p1 = c("1", "2", "1"))),
                                      instrumento = list(docentes = list(survey = survey, choices = choices)))
  .docx_conforme(ficha)

  decisiones <- tempfile(fileext = ".docx")
  audit <- list(origin_key_name = "pais", n_origins = 2, origins = list(list(key_value = "A"), list(key_value = "B")),
                diffs = list(list(id = "b::p1::wording", kind = "surveymonkey_wording", variable = "p1", suggested_name = "p1",
                                  ref_origin_key = "A", ref = "Texto de referencia", origin_key = "B", current = "Texto distinto")))
  .mi_decisions_docx(audit, list(), decisiones)
  .docx_conforme(decisiones)

  skip_if_not_installed("rvg")
  skip_if_not_installed("cowplot")
  informe <- tempfile(fileext = ".docx")
  inst <- list(survey = data.frame(name = "conoce", type = "select_one sino", list_name = "sino", label = "¿Conoce el servicio?", stringsAsFactors = FALSE),
               choices = data.frame(list_name = "sino", name = c("Si", "No"), label = c("Sí", "No"), stringsAsFactors = FALSE), orders_list = NULL)
  reporte_word_plan(data = list(docentes = data.frame(conoce = rep(c("Si", "No"), times = c(40, 12)), stringsAsFactors = FALSE)),
                    instrumento = list(docentes = inst), path_docx = informe, presets_ppt = do.call(p_presets, .PRESETS_DEFAULT_PULSO),
                    plan = list(diapo_001 = p_slide_1_grafico(grafico = p_barras_apiladas(var = "docentes$conoce"))), mensajes_progreso = FALSE)
  .docx_conforme(informe)
})

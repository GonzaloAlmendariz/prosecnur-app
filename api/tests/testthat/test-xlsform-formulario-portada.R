# L36 · D-L36-5 — portada completa (reporte_formulario_portada.R): subtítulo con institución y periodo, y bloque
# de control con línea para escribir. Sin opciones, la portada no cambia (el golden de docentes lo cuida).

.portada_instrumento <- function() {
  list(
    survey = data.frame(type = c("text", "integer"), name = c("p1", "p2"), label = c("Nombre", "Edad"),
                        stringsAsFactors = FALSE),
    choices = data.frame(list_name = character(0), name = character(0), label = character(0),
                         stringsAsFactors = FALSE)
  )
}

.portada_cover <- function(options) {
  ins <- .portada_instrumento()
  model <- formulario_pdf_build_model(survey = ins$survey, choices = ins$choices,
                                      settings = list(form_title = "Docentes"), options = options)
  Filter(function(b) identical(b$kind, "cover"), model$blocks)[[1]]
}

test_that("las opciones arman el subtítulo y el bloque de control; vacías, no hay nada", {
  vacia <- .portada_cover(list())
  expect_identical(vacia$subtitle, "")
  expect_length(vacia$control, 0L)

  solo_periodo <- .portada_cover(list(period = "  2026-2 "))
  expect_identical(solo_periodo$subtitle, "2026-2")

  completa <- .portada_cover(list(institution = "Universidad de Arequipa", period = "2026-2", control_block = TRUE))
  expect_identical(completa$subtitle, "Universidad de Arequipa · 2026-2")
  expect_identical(completa$control, c("Encuestador", "Fecha", "Supervisor"))
  expect_length(.portada_cover(list(control_block = "false"))$control, 0L)
})

test_that("el Word lleva el subtítulo y una casilla con línea por rótulo", {
  ins <- .portada_instrumento()
  out <- tempfile(fileext = ".docx")
  reporte_formulario_word(ins$survey, ins$choices, list(form_title = "Docentes"), output_file = out,
                          options = list(institution = "Universidad de Arequipa", period = "2026-2", control_block = TRUE))
  expect_docx_ooxml_valid(out)
  dir <- tempfile(); utils::unzip(out, files = "word/document.xml", exdir = dir)
  doc <- xml2::read_xml(file.path(dir, "word", "document.xml"))
  textos <- xml2::xml_text(xml2::xml_find_all(doc, "//w:p", xml2::xml_ns(doc)))
  expect_true("Universidad de Arequipa · 2026-2" %in% textos)
  expect_true(all(c("Encuestador:", "Fecha:", "Supervisor:") %in% textos))
  # Tres casillas con borde inferior; los dos separadores, sin él.
  celdas <- xml2::xml_find_all(doc, "//w:tc[.//w:t[contains(., 'Encuestador:')]]/ancestor::w:tr[1]/w:tc", xml2::xml_ns(doc))
  expect_length(celdas, 5L)
  con_linea <- vapply(celdas, function(c) {
    b <- xml2::xml_find_first(c, ".//w:tcBorders/w:bottom", xml2::xml_ns(doc))
    !inherits(b, "xml_missing") && !identical(xml2::xml_attr(b, "val"), "none")
  }, logical(1))
  expect_identical(con_linea, c(TRUE, FALSE, TRUE, FALSE, TRUE))
})

test_that("el PDF reserva para la portada lo mismo que dibuja", {
  completa <- .portada_cover(list(institution = "UNSA", period = "2026-2", control_block = TRUE))
  vacia <- .portada_cover(list())
  expect_equal(.form_pdf_block_height(completa, 0.8) - .form_pdf_block_height(vacia, 0.8), 0.016 + 0.030)

  f <- tempfile(fileext = ".pdf")
  grDevices::pdf(f, width = 8.27, height = 11.69)
  grid::grid.newpage()
  y_vacia <- .form_pdf_draw_cover(vacia, 0.1, 0.9, 0.8)
  y_completa <- .form_pdf_draw_cover(completa, 0.1, 0.9, 0.8)
  grDevices::dev.off()
  expect_equal(y_vacia - y_completa, 0.016 + 0.030)

  ins <- .portada_instrumento()
  out <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(ins$survey, ins$choices, list(form_title = "Docentes"), output_file = out,
                         options = list(institution = "UNSA", period = "2026-2", control_block = TRUE))
  texto <- paste(pdftools::pdf_text(out), collapse = "\n")
  expect_match(texto, "UNSA · 2026-2", fixed = TRUE)
  expect_match(texto, "Supervisor:", fixed = TRUE)
})

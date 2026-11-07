# L36 · DOC.5 — golden de estructura del Word del cuestionario.
#
# Congela la forma del .docx del instrumento de docentes (tablas, párrafos,
# secciones, fuentes, cuerpos, rellenos y la secuencia de números impresos),
# leída del XML: es determinista y no depende de LibreOffice. Un cambio del
# motor que mueva cualquiera de esas cifras se ve como diff legible. Si el
# cambio es deliberado, se regenera con:
#   PROSECNUR_ACTUALIZAR_GOLDEN=1 Rscript -e 'pkgload::load_all("api"); testthat::test_file("api/tests/testthat/test-xlsform-formulario-golden.R")'

.golden_docx_estructura <- function(path) {
  dir <- tempfile(); utils::unzip(path, files = "word/document.xml", exdir = dir)
  doc <- xml2::read_xml(file.path(dir, "word", "document.xml"))
  ns <- xml2::xml_ns(doc)
  atr <- function(xpath, attr) sort(unique(xml2::xml_attr(xml2::xml_find_all(doc, xpath, ns), attr)))
  textos <- xml2::xml_text(xml2::xml_find_all(doc, "//w:p", ns))
  numeros <- regmatches(textos, regexpr("^[0-9]+(\\.[0-9]+)?(?=\\.?\\s)", textos, perl = TRUE))
  list(
    tablas = length(xml2::xml_find_all(doc, "//w:tbl", ns)),
    parrafos = length(xml2::xml_find_all(doc, "//w:p", ns)),
    secciones = length(xml2::xml_find_all(doc, "//w:sectPr", ns)),
    fuentes = atr("//w:rFonts", "ascii"),
    cuerpos = atr("//w:sz", "val"),
    rellenos = atr("//w:shd", "fill"),
    numeros = unique(numeros)
  )
}

test_that("el Word del cuestionario de docentes conserva su estructura (golden)", {
  f <- test_path("..", "..", "inst", "samples", "acreditacion", "docentes_inst.xlsx")
  skip_if_not(file.exists(f))
  out <- tempfile(fileext = ".docx")
  reporte_formulario_word(
    as.data.frame(readxl::read_excel(f, sheet = "survey")),
    as.data.frame(readxl::read_excel(f, sheet = "choices")),
    list(form_title = "Docentes"),
    output_file = out
  )
  expect_docx_ooxml_valid(out)
  actual <- .golden_docx_estructura(out)
  golden <- test_path("golden", "cuestionario_docentes_estructura.json")
  if (nzchar(Sys.getenv("PROSECNUR_ACTUALIZAR_GOLDEN"))) {
    dir.create(dirname(golden), showWarnings = FALSE, recursive = TRUE)
    jsonlite::write_json(actual, golden, auto_unbox = TRUE, pretty = TRUE)
  }
  skip_if_not(file.exists(golden), "falta el golden: regenerarlo con PROSECNUR_ACTUALIZAR_GOLDEN=1")
  esperado <- jsonlite::read_json(golden, simplifyVector = TRUE)
  for (k in names(actual)) {
    expect_identical(as.character(unlist(actual[[k]])), as.character(unlist(esperado[[k]])), info = k)
  }
  # Lo que DOC.0b a DOC.1 decidieron, dicho en voz alta además del golden.
  expect_identical(actual$fuentes, "Arial Narrow")
  expect_false(any(grepl("respondent_id", unlist(actual))))
})

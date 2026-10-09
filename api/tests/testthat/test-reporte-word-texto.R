source("setup-load-all.R")

.wx_xml <- function(doc) { f <- tempfile(fileext = ".docx"); print(doc, target = f); d <- tempfile(); utils::unzip(f, exdir = d)
  paste(readLines(file.path(d, "word", "document.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "") }

test_that("cuerpo, entrada y sección escriben el formato del recetario (10.5 pt; cuerpo justificado en el gris del texto, entrada en el suave)", {
  x <- .wx_xml(.word_cuerpo(.word_entrada(.word_seccion(.word_documento_nuevo(), "Estructura", "1.1"), "Lo que sigue."), "El texto corre."))
  expect_match(x, "1.1. Estructura", fixed = TRUE)
  expect_match(x, 'w:jc w:val="both"', fixed = TRUE)                                   # justificado
  expect_match(x, 'w:color w:val="26303F"', fixed = TRUE); expect_match(x, 'w:color w:val="5A6480"', fixed = TRUE)
  expect_match(x, 'w:sz w:val="21"', fixed = TRUE)                                       # 10.5 pt
  expect_identical(.word_cuerpo(officer::read_docx(), "  ") |> class(), class(officer::read_docx()))
})

test_that("la apertura B lleva el número de 60 pt en azul claro y las secciones entre filetes; la A, «CAPÍTULO N» en su estilo", {
  b <- .wx_xml(.word_apertura(.word_documento_nuevo(), 4, "Propósitos", "Este capítulo...", secciones = c("4.1. Misión", "4.2. Gestión")))
  expect_match(b, 'w:sz w:val="120"', fixed = TRUE); expect_match(b, 'w:color w:val="C9D3E6"', fixed = TRUE)
  expect_match(b, "4.2. Gestión", fixed = TRUE)
  a <- .wx_xml(.word_apertura(.word_documento_nuevo(), 4, "Propósitos", "Este capítulo...", variante = "A"))
  expect_match(a, "CAPÍTULO 4", fixed = TRUE); expect_false(grepl('w:sz w:val="120"', a, fixed = TRUE))
})

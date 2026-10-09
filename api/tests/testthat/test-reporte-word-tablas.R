source("setup-load-all.R")

.wt_xml <- function(doc) { f <- tempfile(fileext = ".docx"); print(doc, target = f); d <- tempfile(); utils::unzip(f, exdir = d)
  paste(readLines(file.path(d, "word", "document.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "") }

test_that("la tabla del recetario mide el ancho útil, numera con SEQ Tabla, repite la cabecera y lleva los filetes de la casa", {
  df <- data.frame(Competencia = c("Auditoría", "Finanzas"), Docentes = c("96%", "96%"), check.names = FALSE)
  ft <- .word_ft_base(df, c(2, 1))
  doc <- .word_tabla(.word_documento_nuevo(), 4, "Cifras del radar", ft, base = "Base: 51 docentes.")
  x <- .wt_xml(doc)
  expect_match(x, "SEQ Tabla", fixed = TRUE)
  expect_match(x, "<w:tblHeader", fixed = TRUE)                                         # la cabecera se repite al paginar
  expect_match(x, 'w:color="002060"', fixed = TRUE)                                     # filete navy
  expect_match(x, 'w:color="D5D9DF"', fixed = TRUE)                                     # filete gris entre filas
  anchos <- as.numeric(regmatches(x, gregexpr('(?<=<w:gridCol w:w=")[0-9]+', x, perl = TRUE))[[1]])
  expect_equal(sum(anchos) / 1440, .std_word("pagina", "ancho_util"), tolerance = 0.01)   # twips → in
  expect_match(x, "Base: 51 docentes.", fixed = TRUE)
})

test_that("la tabla del radar sale de su espec: eje por fila, grupo por columna, las cifras de la espec", {
  e <- list(ejes = c("A", "B"), grupos = c("D", "E"), cifras = matrix(c("99%", "92%", "96%", "93%"), 2), encabezado = "Competencia")
  df <- .word_df_radar(e)
  expect_identical(names(df), c("Competencia", "D", "E"))
  expect_identical(df$D, c("99%", "92%"))
})

test_that("la franja escribe cada cifra grande con su rótulo y un filete entre ellas", {
  x <- .wt_xml(.word_franja(.word_documento_nuevo(), c("1,184", "22 años"), c("personas encuestadas", "edad mediana")))
  expect_match(x, "1,184", fixed = TRUE); expect_match(x, "edad mediana", fixed = TRUE)
  expect_match(x, 'w:val="48"', fixed = TRUE)                                           # 24 pt = 48 medios puntos
})

test_that("la tabla técnica del plan llega al Word con sus filas y su base (antes render_meta sólo traía título y nrow)", {
  e <- list(kind = "technical_table", title = "Ficha técnica del estudio",
            table = data.frame(Aspecto = c("Técnica", "Actores"), Detalle = c("Encuesta en línea", NA)), base = "Fuente: PULSO PUCP 2026.")
  x <- .wt_xml(.word_tabla_tecnica(.word_documento_nuevo(), 7, e))
  expect_match(x, "Encuesta en línea", fixed = TRUE); expect_match(x, "SEQ Tabla", fixed = TRUE)
  expect_false(grepl(">NA<", x, fixed = TRUE))
  expect_identical(.word_tabla_tecnica(officer::read_docx(), 1, list(table = NULL)) |> class(), class(officer::read_docx()))
  src <- paste(readLines(test_path("..", "..", "R", "reporte_plan_ppt.R"), warn = FALSE), collapse = "\n")
  expect_match(src, 'kind = "technical_table",\\s*title = [^\\n]*\\s*nrow = nrow\\(table_data\\), table = table_data', perl = TRUE)          # render_meta lleva las filas
})

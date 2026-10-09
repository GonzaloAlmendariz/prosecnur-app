source("setup-load-all.R")

.wp_xml <- function(doc) { f <- tempfile(fileext = ".docx"); print(doc, target = f); d <- tempfile(); utils::unzip(f, exdir = d)
  paste(readLines(file.path(d, "word", "document.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "") }
.wp_meta <- list(ante = "INFORME FINAL", titulo = "Estudio de opinión", sub = "Docentes y estudiantes", para = "Facultad", por = "PULSO PUCP",
                 fecha = "Octubre de 2026", version = "Versión final")

test_that("las tres portadas del recetario escriben su título, su filete coral y, la C, la ficha del encargo", {
  a <- .wp_xml(.word_portada(.word_documento_nuevo(), .wp_meta, "A"))
  expect_match(a, "Estudio de opinión", fixed = TRUE); expect_match(a, 'w:sz w:val="56"', fixed = TRUE)          # título de 28 pt
  expect_match(a, 'w:color="CA5651"', fixed = TRUE)                                                             # filete coral
  expect_false(grepl("Elaborado para", a, fixed = TRUE))
  b <- .wp_xml(.word_portada(.word_documento_nuevo(), .wp_meta, "B"))
  expect_match(b, 'w:fill="002060"', fixed = TRUE)                                                              # banda navy
  c <- .wp_xml(.word_portada(.word_documento_nuevo(), .wp_meta, "C"))
  expect_true(all(vapply(c("Elaborado para", "Facultad", "Versión final"), function(t) grepl(t, c, fixed = TRUE), TRUE)))
  sin_para <- .wp_xml(.word_portada(.word_documento_nuevo(), modifyList(.wp_meta, list(para = "")), "C"))
  expect_false(grepl("Elaborado para", sin_para, fixed = TRUE))                                               # lo que falta se omite
})

test_that("los índices son campos TOC de Word: contenido de títulos 1-2, gráficos y tablas por su SEQ", {
  x <- .wp_xml(.word_indices(.word_documento_nuevo()))
  expect_match(x, 'TOC \\o "1-2"', fixed = TRUE)
  expect_match(x, 'TOC \\h \\z \\c "Gráfico"', fixed = TRUE)
  expect_match(x, '\\c "Tabla"', fixed = TRUE)
  expect_false(grepl('\\c "Tabla"', .wp_xml(.word_indices(.word_documento_nuevo(), con_tablas = FALSE)), fixed = TRUE))
})

test_that("la primera página lleva los dos logos del estándar en su encabezado, con su proporción", {
  expect_true(file.exists(.word_logo("pucp"))); expect_true(file.exists(.word_logo("pulso")))
  expect_equal(.word_png_aspecto(.word_logo("pucp")), 562 / 186, tolerance = 1e-6)
  doc <- .word_portada(.word_documento_nuevo(), .wp_meta, "A")
  doc <- .word_cerrar_capitulo(doc, "", "Informe", primera = .word_logos())
  f <- tempfile(fileext = ".docx"); print(doc, target = f); d <- tempfile(); utils::unzip(f, exdir = d)
  cab <- list.files(file.path(d, "word"), pattern = "^header.*\\.xml$", full.names = TRUE)
  con_imagen <- vapply(cab, function(x) sum(gregexpr("<pic:pic", paste(readLines(x, warn = FALSE), collapse = ""), fixed = TRUE)[[1]] > 0), 0)
  expect_true(any(con_imagen == 2))                                                        # un encabezado con los dos logos
})

test_that("la contraportada lleva el logo y el contacto del cierre del PPT, con los datos que el plan reemplace", {
  x <- .wp_xml(.word_contraportada(.word_documento_nuevo()))
  expect_match(x, "pulsopucp@pucp.edu.pe", fixed = TRUE); expect_match(x, "pulso.pucp.edu.pe", fixed = TRUE)
  expect_match(x, "<w:drawing>", fixed = TRUE)
  y <- .wp_xml(.word_contraportada(.word_documento_nuevo(), list(correo = "otro@pucp.edu.pe", direccion = "")))
  expect_match(y, "otro@pucp.edu.pe", fixed = TRUE); expect_false(grepl("Universitaria", y, fixed = TRUE))
})

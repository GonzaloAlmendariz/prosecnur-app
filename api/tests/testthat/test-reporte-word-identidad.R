source("setup-load-all.R")

.wi_xml <- function(doc, parte) {
  out <- tempfile(fileext = ".docx"); print(doc, target = out)
  xml2::read_xml(unz(out, parte))
}

test_that("el documento Word nace con la página A4 y los márgenes del recetario", {
  doc <- officer::body_add_par(.word_documento_nuevo(), "x")
  x <- .wi_xml(doc, "word/document.xml")
  sp <- xml2::xml_find_first(x, "//w:body/w:sectPr")
  pg <- xml2::xml_find_first(sp, "w:pgSz"); mar <- xml2::xml_find_first(sp, "w:pgMar")
  at <- function(n, a) as.integer(xml2::xml_attr(n, a, ns = xml2::xml_ns(x)))
  expect_identical(c(at(pg, "w:w"), at(pg, "w:h")), c(11909L, 16834L))
  expect_identical(c(at(mar, "w:top"), at(mar, "w:bottom"), at(mar, "w:left"), at(mar, "w:right"), at(mar, "w:header"), at(mar, "w:footer")),
                   c(1584L, 1296L, 1440L, 1440L, 576L, 576L))
})

test_that("los estilos del recetario existen con su tamaño, color y keepNext, sin duplicar heading 1", {
  x <- .wi_xml(.word_documento_nuevo(), "word/styles.xml")
  st <- function(nombre) xml2::xml_find_first(x, sprintf("//w:style[w:name[@w:val='%s']]", nombre))
  sz <- function(nombre) as.numeric(xml2::xml_attr(xml2::xml_find_first(st(nombre), ".//w:rPr/w:sz"), "val")) / 2
  esperado <- c("heading 1" = 18, "heading 2" = 12.5, "Rótulo de gráfico" = 10, "Base y fuente" = 8.5, "Lectura" = 10.5,
                "Número de capítulo" = 9, "toc 1" = 10.5, "toc 2" = 10, "Número de rótulo" = 10)
  for (n in names(esperado)) expect_equal(sz(n), esperado[[n]], label = n)
  expect_length(xml2::xml_find_all(x, "//w:style[w:name[@w:val='heading 1']]"), 1L)
  expect_false(inherits(xml2::xml_find_first(st("Rótulo de gráfico"), ".//w:keepNext"), "xml_missing"))
  expect_identical(toupper(xml2::xml_attr(xml2::xml_find_first(st("heading 1"), ".//w:rPr/w:color"), "val")), "002060")
  expect_identical(xml2::xml_attr(xml2::xml_find_first(st("Base y fuente"), ".//w:jc"), "val"), "center")
})

test_that("el encabezado interior lleva el título corto, el capítulo a la derecha y el folio es un campo PAGE", {
  doc <- officer::body_add_par(.word_documento_nuevo(), "x")
  doc <- officer::body_end_block_section(doc, officer::block_section(.word_props_pagina(.word_cabecera("1. Perfil", "Informe"), .word_pie())))
  out <- tempfile(fileext = ".docx"); print(doc, target = out)
  nombres <- utils::unzip(out, list = TRUE)$Name
  hdr <- paste(vapply(grep("^word/header", nombres, value = TRUE), function(p) .leer_parte_zip(out, p, colapsar = ""), ""), collapse = "")
  ftr <- paste(vapply(grep("^word/footer", nombres, value = TRUE), function(p) .leer_parte_zip(out, p, colapsar = ""), ""), collapse = "")
  expect_match(hdr, "1. Perfil", fixed = TRUE); expect_match(hdr, "Informe", fixed = TRUE)
  expect_match(ftr, "PAGE", fixed = TRUE)
})

test_that("el informe conformado en modo revista lleva es-PE, viudas, sangría francesa en «Referencia» y updateFields", {
  doc <- officer::body_add_par(.word_documento_nuevo(), "Autor, A. (2026). Un título largo de referencia.", style = "Referencia")
  out <- tempfile(fileext = ".docx"); print(doc, target = out)
  .docx_conformar(out, revista = TRUE)
  st <- xml2::read_xml(unz(out, "word/styles.xml")); se <- xml2::read_xml(unz(out, "word/settings.xml"))
  ns <- c(w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
  a <- function(x, xp, at) xml2::xml_attr(xml2::xml_find_first(x, xp, ns), at, ns = ns)
  expect_identical(a(st, "//w:docDefaults/w:rPrDefault/w:rPr/w:lang", "w:val"), "es-PE")
  expect_false(inherits(xml2::xml_find_first(st, "//w:docDefaults/w:pPrDefault/w:pPr/w:widowControl", ns), "xml_missing"))
  ind <- xml2::xml_find_first(st, "//w:style[w:name[@w:val='Referencia']]/w:pPr/w:ind", ns)
  expect_identical(c(xml2::xml_attr(ind, "w:left", ns = ns), xml2::xml_attr(ind, "w:hanging", ns = ns)), c("567", "567"))
  expect_true(is.na(xml2::xml_attr(ind, "w:firstLine", ns = ns)))
  expect_identical(a(se, "/w:settings/w:updateFields", "w:val"), "true")
  expect_length(xml2::xml_find_all(se, "/w:settings/w:autoHyphenation", ns), 0L)
  # Sin revista no se toca: los formularios y las fichas no llevan campos que actualizar.
  out2 <- tempfile(fileext = ".docx"); print(officer::body_add_par(.word_documento_nuevo(), "x"), target = out2); .docx_conformar(out2)
  expect_length(xml2::xml_find_all(xml2::read_xml(unz(out2, "word/settings.xml")), "/w:settings/w:updateFields", ns), 0L)
  # El validador OOXML del skill docx, cuando está en la máquina (no en CI).
  val <- Sys.glob(file.path(Sys.getenv("HOME"), "Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/*/*/skills/docx/scripts/office/validate.py"))
  skip_if(!length(val) || !nzchar(Sys.which("python3")), "sin validate.py local")
  res <- suppressWarnings(system2("python3", c(shQuote(val[1]), shQuote(out)), stdout = TRUE, stderr = TRUE))
  expect_true(any(grepl("PASSED", res)), info = paste(res, collapse = "\n"))
})

test_that("cada capítulo cierra su sección con su propio encabezado escrito y el folio, y la última va sin encabezado", {
  doc <- .word_documento_nuevo()
  doc <- officer::body_add_par(doc, "Capítulo uno", style = "heading 1")
  doc <- .word_cerrar_capitulo(doc, "1. Perfil del encuestado", "Informe de prueba")
  doc <- officer::body_add_par(doc, "Capítulo dos", style = "heading 1")
  doc <- .word_cerrar_capitulo(doc, "2. Satisfacción", "Informe de prueba")
  doc <- officer::body_add_par(doc, "Contraportada")
  out <- tempfile(fileext = ".docx"); print(doc, target = out); .docx_conformar(out, revista = TRUE)
  x <- xml2::read_xml(unz(out, "word/document.xml")); ns <- c(w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
  expect_length(xml2::xml_find_all(x, "//w:sectPr", ns), 3L)
  ns2 <- c(ns, r = "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
  tipos <- xml2::xml_attr(xml2::xml_find_all(x, "//w:sectPr/w:type", ns2), "w:val", ns = ns2)
  expect_true(length(tipos) >= 2L && all(tipos == "nextPage"))
  rels <- xml2::read_xml(unz(out, "word/_rels/document.xml.rels")); xml2::xml_ns_strip(rels)
  texto_cab <- function(sp) {
    rid <- xml2::xml_attr(xml2::xml_find_first(sp, "w:headerReference[@w:type='default']", ns2), "r:id", ns = ns2)
    destino <- xml2::xml_attr(xml2::xml_find_first(rels, sprintf("//Relationship[@Id='%s']", rid)), "Target")
    paste(xml2::xml_text(xml2::xml_find_all(xml2::read_xml(unz(out, file.path("word", destino))), "//w:t", ns2)), collapse = "")
  }
  cabs <- vapply(xml2::xml_find_all(x, "//w:sectPr", ns2), texto_cab, "")
  expect_match(cabs[1], "1. Perfil del encuestado", fixed = TRUE); expect_match(cabs[2], "2. Satisfacción", fixed = TRUE)
  expect_false(grepl("Perfil|Satisfacci", cabs[3]))   # la última sección (la contraportada) no lleva capítulo
})

test_that("la figura lleva el rótulo con SEQ, la imagen pegada a la base y la lectura con las cifras en negrita", {
  png <- tempfile(fileext = ".png"); grDevices::png(png, 600, 300); graphics::par(mar = c(0, 0, 0, 0)); graphics::plot.new(); grDevices::dev.off()
  doc <- .word_figura(.word_documento_nuevo(), 3, "¿Qué tan satisfecho está?", png, alto = 1.34, base = "Base: 120 estudiantes. Fuente: PULSO PUCP 2026.",
                      lectura = "El 72 % está satisfecho, 8 pts más que en 2025.")
  out <- tempfile(fileext = ".docx"); print(doc, target = out); .docx_conformar(out, revista = TRUE)
  x <- xml2::read_xml(unz(out, "word/document.xml")); ns <- c(w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
  st <- xml2::read_xml(unz(out, "word/styles.xml"))
  nombre_de <- function(id) xml2::xml_attr(xml2::xml_find_first(st, sprintf("//w:style[@w:styleId='%s']/w:name", id), ns), "w:val", ns = ns)
  estilos <- vapply(xml2::xml_attr(xml2::xml_find_all(x, "//w:body/w:p/w:pPr/w:pStyle", ns), "w:val", ns = ns), nombre_de, "")
  expect_identical(unname(estilos), c("Rótulo de gráfico", "Normal", "Base y fuente con lectura", "Lectura"))   # la imagen va en un párrafo «Normal», como en el recetario
  expect_match(paste(xml2::xml_text(xml2::xml_find_all(x, "//w:instrText", ns)), collapse = ""), "SEQ Gráfico \\* ARABIC", fixed = TRUE)
  expect_identical(nombre_de(xml2::xml_attr(xml2::xml_find_first(x, "//w:r/w:rPr/w:rStyle", ns), "w:val", ns = ns)), "Número de rótulo")
  expect_false(inherits(xml2::xml_find_first(x, "//w:p[.//w:drawing]/w:pPr/w:keepNext", ns), "xml_missing"))
  negritas <- xml2::xml_text(xml2::xml_find_all(x, "//w:p[last()]/w:r[w:rPr/w:b]", ns))
  expect_identical(negritas, c("72 %", "8 pts", "2025"))
})

test_that("N4b: el rótulo es UNA línea «Gráfico N° N: título» en el estilo azul y negrita, centrado, con el campo SEQ", {
  png <- tempfile(fileext = ".png"); grDevices::png(png, 600, 300); graphics::par(mar = c(0, 0, 0, 0)); graphics::plot.new(); grDevices::dev.off()
  rotulo <- function(titulo, etiqueta = "Gráfico") {
    doc <- .word_rotulo(.word_documento_nuevo(), 7, titulo, etiqueta = etiqueta)
    out <- tempfile(fileext = ".docx"); print(doc, target = out); .docx_conformar(out, revista = TRUE)
    ns <- c(w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
    list(x = xml2::read_xml(unz(out, "word/document.xml")), st = xml2::read_xml(unz(out, "word/styles.xml")), ns = ns)
  }
  r <- rotulo("¿Qué tan satisfecho está?")
  ps <- xml2::xml_find_all(r$x, "//w:body/w:p", r$ns)
  expect_length(ps, 1L)
  expect_length(xml2::xml_find_all(ps[[1]], ".//w:br", r$ns), 0L)                           # una sola línea
  expect_identical(paste(xml2::xml_text(xml2::xml_find_all(ps[[1]], ".//w:t", r$ns)), collapse = ""), "Gráfico N\u00b0 7: ¿Qué tan satisfecho está?")   # R1: «N°» (test-word-rotulo-grafico-numero.R)
  expect_length(xml2::xml_find_all(ps[[1]], ".//w:i", r$ns), 0L)                            # sin cursiva DIRECTA: la lleva el estilo (R1)
  expect_match(paste(xml2::xml_text(xml2::xml_find_all(ps[[1]], ".//w:instrText", r$ns)), collapse = ""), "SEQ Gráfico", fixed = TRUE)
  nombre_de <- function(id) xml2::xml_attr(xml2::xml_find_first(r$st, sprintf("//w:style[@w:styleId='%s']/w:name", id), r$ns), "w:val", ns = r$ns)
  # todo el texto visible (número, separador y título) lleva el estilo de carácter azul/negrita
  runs_t <- xml2::xml_find_all(ps[[1]], ".//w:r[w:t]", r$ns)
  estilos <- vapply(runs_t, function(n) nombre_de(xml2::xml_attr(xml2::xml_find_first(n, "w:rPr/w:rStyle", r$ns), "w:val", ns = r$ns)), "")
  expect_true(all(estilos == "Número de rótulo"))
  # centrado: el párrafo (directo) o su estilo
  est_p <- xml2::xml_attr(xml2::xml_find_first(ps[[1]], "w:pPr/w:pStyle", r$ns), "w:val", ns = r$ns)
  jc <- xml2::xml_attr(xml2::xml_find_first(r$st, sprintf("//w:style[@w:styleId='%s']//w:jc", est_p), r$ns), "w:val", ns = r$ns)
  expect_identical(jc, "center")
  # título largo: sigue siendo un párrafo (el centrado lo parte en líneas, no se corta texto)
  largo <- paste(rep("palabra", 40), collapse = " ")
  expect_identical(paste(xml2::xml_text(xml2::xml_find_all(rotulo(largo)$x, "//w:t", r$ns)), collapse = ""), paste0("Gráfico N\u00b0 7: ", largo))
  # título vacío (también el espacio duro de D-b): solo «Gráfico N», sin separador ni salto
  for (vacio in list("", "\u00A0", NULL)) {
    rv <- rotulo(vacio)
    expect_identical(paste(xml2::xml_text(xml2::xml_find_all(rv$x, "//w:t", r$ns)), collapse = ""), "Gráfico N\u00b0 7")
    expect_length(xml2::xml_find_all(rv$x, "//w:br", r$ns), 0L)
  }
  expect_identical(paste(xml2::xml_text(xml2::xml_find_all(rotulo("Resumen", "Tabla")$x, "//w:t", r$ns)), collapse = ""), "Tabla N\u00b0 7: Resumen")
})

test_that("el alto de la figura sigue las filas del recetario y ningún texto baja de 8 pt", {
  expect_equal(.word_alto_figura("escala", 1), 1.34); expect_equal(.word_alto_figura("escala", 3), 2.06)
  expect_equal(.word_alto_figura("barras", 4), 1.61)
  expect_equal(.word_filas(c("Docentes", "Estudiantes")), 2)
  expect_gt(.word_filas("Un rótulo bastante largo que se parte en dos líneas"), 1)
  p <- ggplot2::ggplot(data.frame(x = 1, y = 1, l = "a"), ggplot2::aes(x, y, label = l)) + ggplot2::geom_text(size = 2) +
    ggplot2::theme(axis.text = ggplot2::element_text(size = 6))
  q <- .word_piso_texto(p)
  expect_equal(q$layers[[1]]$aes_params$size, 8 / ggplot2::.pt)
  expect_equal(q$theme$axis.text$size, 8)
  png <- .word_png(p, alto = 1.34)
  expect_true(file.exists(png))
  img <- png::readPNG(png); expect_identical(dim(img)[3], 4L)   # canal alfa: fondo transparente
  expect_equal(dim(img)[2], round(6.27 * 300), tolerance = 2)
})

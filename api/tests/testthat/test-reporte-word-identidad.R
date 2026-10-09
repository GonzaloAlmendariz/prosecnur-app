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
  hdr <- paste(vapply(grep("^word/header", nombres, value = TRUE), function(p) paste(readLines(unz(out, p), warn = FALSE), collapse = ""), ""), collapse = "")
  ftr <- paste(vapply(grep("^word/footer", nombres, value = TRUE), function(p) paste(readLines(unz(out, p), warn = FALSE), collapse = ""), ""), collapse = "")
  expect_match(hdr, "1. Perfil", fixed = TRUE); expect_match(hdr, "Informe", fixed = TRUE)
  expect_match(ftr, "PAGE", fixed = TRUE)
})

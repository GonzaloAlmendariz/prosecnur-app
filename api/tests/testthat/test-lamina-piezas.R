# ADR 0093 (decisión 7) — las piezas nativas de una ranura entran como un grupo:
# transformación identidad, ids únicos en la lámina y la letra que no encoge.

.lam_doc <- function() {
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  officer::add_slide(doc, layout = "Graficos2", master = "Office Theme")
}

test_that("el lienzo entra como un p:grpSp con transformación identidad y el tamaño de su contenido", {
  doc <- .lam_doc()
  lz <- .lam_lienzo()
  .lam_caja(lz, 1, 2, 3, 0.5, "#70AD47")
  .lam_txt(lz, "53% & más", 1.2, 2.1, 1, 0.3, size = 14, bold = TRUE, align = "center")
  .lam_caja(lz, 4, 2.6, 0.5, 0.2, "#BFBFBF")
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:escala")
  x <- doc$slide$get_slide(doc$cursor)$get()
  g <- xml2::xml_find_first(x, "//p:grpSp[p:nvGrpSpPr/p:cNvPr[@name='prosecnur:grafico:escala']]")
  expect_false(inherits(g, "xml_missing"))
  off <- xml2::xml_find_first(g, "p:grpSpPr/a:xfrm/a:off"); choff <- xml2::xml_find_first(g, "p:grpSpPr/a:xfrm/a:chOff")
  ext <- xml2::xml_find_first(g, "p:grpSpPr/a:xfrm/a:ext"); chext <- xml2::xml_find_first(g, "p:grpSpPr/a:xfrm/a:chExt")
  expect_identical(xml2::xml_attr(off, "x"), xml2::xml_attr(choff, "x"))
  expect_identical(xml2::xml_attr(ext, "cx"), xml2::xml_attr(chext, "cx"))
  expect_equal(as.numeric(xml2::xml_attr(off, "x")) / 914400, 1)
  expect_equal(as.numeric(xml2::xml_attr(ext, "cx")) / 914400, 3.5)   # de 1 a 4.5 in
  expect_equal(as.numeric(xml2::xml_attr(ext, "cy")) / 914400, 0.8)   # de 2 a 2.8 in
  expect_length(xml2::xml_find_all(g, "p:sp"), 3L)
  # el texto se escapa y lleva la letra fija
  expect_identical(xml2::xml_text(xml2::xml_find_first(g, ".//a:t")), "53% & más")
  expect_length(xml2::xml_find_all(g, ".//a:bodyPr/a:noAutofit"), 1L)
})

test_that("los ids de las formas del grupo no chocan con los de la lámina", {
  doc <- .lam_doc()
  for (k in 1:2) {
    lz <- .lam_lienzo(); .lam_caja(lz, k, 1, 1, 1, "#081F5C"); .lam_txt(lz, "x", k, 1, 1, 0.3)
    doc <- .lam_agrupar(doc, lz, nombre = paste0("g", k))
  }
  ids <- xml2::xml_attr(xml2::xml_find_all(doc$slide$get_slide(doc$cursor)$get(), "//p:cNvPr"), "id")
  expect_false(any(duplicated(ids)))
})

test_that("la medición de tinta usa systemfonts, no el estimado por caracteres (decisión 9)", {
  w <- .lam_ancho_tinta("Totalmente de acuerdo", 12)
  expect_true(is.finite(w) && w > 0)
  # Arial a 12 pt: la estimación por caracteres sobrestima; la medida real es menor.
  expect_lt(w, .lam_ancho_txt("Totalmente de acuerdo", 12))
})

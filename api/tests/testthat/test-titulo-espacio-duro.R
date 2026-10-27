# C6 (CCSS Perfil 2026, lámina 13): el título «… y 38 % es primera generación universitaria» se partía con «38» al final
# de una línea y «%» al comienzo de la siguiente. La cifra y su «%» (y «N°»/«N.°» y su número) van unidos por un espacio
# duro (U+00A0) en el título de la lámina y en el rótulo del Word (texto_espacio_duro.R).

test_that("el espacio entre la cifra y su % y entre «N°» y su número se vuelve duro; lo demás no cambia", {
  nb <- " "
  expect_identical(.texto_espacio_duro("y 38 % es primera"), paste0("y 38", nb, "% es primera"))
  expect_identical(.texto_espacio_duro("el 12,5 % y el 3.4  %"), paste0("el 12,5", nb, "% y el 3.4", nb, "%"))
  expect_identical(.texto_espacio_duro("Lámina N° 5 y N.° 12 y Nº 3"), paste0("Lámina N°", nb, "5 y N.°", nb, "12 y Nº", nb, "3"))
  expect_identical(.texto_espacio_duro("28% sin espacio"), "28% sin espacio")
  expect_identical(.texto_espacio_duro("Gráfico N° "), paste0("Gráfico N°", nb))   # el prefijo del rótulo, antes del SEQ
  expect_identical(.texto_espacio_duro("Sin cifras aquí"), "Sin cifras aquí")
  expect_identical(.texto_espacio_duro(character(0)), character(0))
  expect_identical(.texto_espacio_duro(NULL), NULL)
  expect_true(is.na(.texto_espacio_duro(NA_character_)))
})

test_that("el título de la lámina lleva el espacio duro entre la cifra y su %", {
  skip_if_not_installed("officer")
  doc <- officer::read_pptx(.graficos_resolve_template_pptx(config = list(), profile_id = NULL, template_id = NULL))
  doc <- officer::add_slide(doc, layout = "Graficos2", master = "Office Theme")
  doc <- .lam_titulo(doc, "Dos de cada tres fueron criados por su madre y su padre, y 38 % es primera generación universitaria",
                     sub = "Un 4 % no responde", avisar = FALSE)
  out <- tempfile(fileext = ".pptx"); print(doc, target = out)
  x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  t <- function(nm) paste(xml2::xml_text(xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]//a:t", nm))), collapse = "")
  expect_match(t("Titulo lamina"), "38 % es primera", fixed = TRUE)
  expect_match(t("Subtitulo lamina"), "4 % no responde", fixed = TRUE)
})

test_that("el rótulo del Word une «N°» con su número y la cifra del título con su %", {
  skip_if_not_installed("officer")
  out <- tempfile(fileext = ".docx")
  print(.word_rotulo(.word_documento_nuevo(), 7, "El 38 % es primera generación"), target = out)
  x <- xml2::read_xml(unz(out, "word/document.xml"))
  ns <- c(w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
  texto <- paste(xml2::xml_text(xml2::xml_find_all(x, "//w:body/w:p[1]//w:t", ns)), collapse = "")
  expect_identical(texto, "Gráfico N° 7: El 38 % es primera generación")
})

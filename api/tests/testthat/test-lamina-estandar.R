source("setup-load-all.R")

# Reglas de la identidad (checklist-recetario-desfase-2026-10-26.md, P5): la lámina dibuja estandar_pulso.json tal cual.

.le_pptx <- function(parte) {
  tpl <- system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp")
  skip_if_not(file.exists(tpl), "plantilla estándar ausente")
  doc <- officer::read_pptx(tpl)
  doc <- .lam_laminas_estandar(doc, list(parte = parte), folio = 1L, layout = "Title and Content")$doc
  out <- tempfile(fileext = ".pptx"); print(doc, target = out)
  s <- officer::pptx_summary(officer::read_pptx(out))
  s[s$slide_id == max(s$slide_id), ]
}

test_that("cada color de las paletas de las respuestas sale con su código, leído del JSON", {
  s <- .le_pptx("respuestas")
  pal <- .std_valor("ppt", "paletas")
  esperados <- toupper(unique(c(unlist(pal$likert$colores), unlist(pal$likert_neutro$colores), unlist(pal$dicotomica$colores),
                                unlist(pal$categorica$colores))))
  expect_true(all(esperados %in% s$text))
  expect_true(pal$dicotomica$uso %in% s$text)                     # la regla de uso viaja con la paleta
  expect_false("#CA5651" %in% s$text)                              # el coral no es un color de respuesta
})

test_that("la parte de colores lista todos los colores con nombre y la tipográfica todos los roles", {
  cols <- .std_valor("ppt", "colores")
  expect_true(all(toupper(unlist(cols)) %in% .le_pptx("colores")$text))
  tip <- .std_valor("ppt", "tipografia")
  t <- .le_pptx("tipografia")$text
  expect_true(all(sprintf("%s pt", c(tip$titulo, tip$cifra_destacada, tip$base)) %in% t))
})

test_that("el constructor normaliza la parte y el título por defecto es el de la parte", {
  s <- p_slide_estandar(parte = "nada")
  expect_identical(s$slots$parte, "respuestas")
  expect_identical(s$title, "Los colores de las respuestas")
  expect_identical(p_slide_estandar(parte = "tipografia")$title, "La escala tipográfica")
})

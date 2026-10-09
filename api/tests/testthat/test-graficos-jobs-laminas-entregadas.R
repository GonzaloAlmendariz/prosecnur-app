# ADR 0093 — el job informa las láminas que el pptx trae, no las entradas del plan:
# la partición en «(cont.)» agrega láminas.

test_that("se cuentan las láminas del archivo, y sin archivo legible el conteo del plan", {
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  base <- length(doc)
  for (k in 1:3) doc <- officer::add_slide(doc, layout = "Graficos2", master = "Office Theme")
  f <- tempfile(fileext = ".pptx"); print(doc, target = f)
  expect_identical(.graficos_laminas_entregadas(f, respaldo = 2L), base + 3L)
  expect_identical(.graficos_laminas_entregadas(tempfile(fileext = ".pptx"), respaldo = 2L), 2L)
})

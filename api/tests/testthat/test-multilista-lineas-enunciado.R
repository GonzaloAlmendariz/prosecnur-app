# P45. El estimador que reparte la altura de una lámina entre sus bloques
# contaba las líneas del ENUNCIADO con el mismo ancho que las etiquetas del EJE
# —`ancho_max_eje_y` / `wrap_y`, con 50 de reserva y un 0.8 encima—, y son dos
# magnitudes distintas: el enunciado vive en el canal lateral, mucho más
# estrecho. Aquí se mide con el mismo envoltorio que usa el graficador al
# dibujarlo.

test_that("el canal real da más líneas que el ancho del eje", {
  # LA MEDICIÓN QUE ABRIÓ P45, sobre el enunciado de la lámina 41 del mazo de
  # Contabilidad. El estimador contaba 5 líneas con su wrap de 40; el canal
  # declarado de esa lámina —0.24 del ancho— da 34 caracteres y 6 líneas.
  texto <- paste(
    "La Unidad facilita los medios necesarios para que los estudiantes",
    "realicen actividades extracurriculares de apoyo a su formación",
    "(seminarios, voluntariados, talleres, etc.)."
  )
  medido <- .multilista_lineas_medidas(texto, 0.24, 12.5, 14)
  estimado <- length(strsplit(
    stringr::str_wrap(texto, width = max(12, floor(50 * 0.8))), "\n", fixed = TRUE
  )[[1]])
  expect_equal(medido, 6L)
  expect_gt(medido, estimado)
})


test_that("un canal más estrecho nunca cuenta menos líneas", {
  texto <- paste(rep("palabra", 30), collapse = " ")
  ns <- vapply(c(0.14, 0.18, 0.24, 0.30, 0.40),
               function(w) .multilista_lineas_medidas(texto, w, 12.5, 14),
               integer(1))
  expect_true(all(diff(ns) <= 0))
  expect_gt(ns[1], ns[length(ns)])
})


test_that("un cuerpo más grande tampoco cuenta menos", {
  texto <- paste(rep("palabra", 30), collapse = " ")
  ns <- vapply(c(9, 11, 14, 18),
               function(s) .multilista_lineas_medidas(texto, 0.24, 12.5, s),
               integer(1))
  expect_true(all(diff(ns) >= 0))
})


test_that("varios enunciados suman sus líneas", {
  a <- paste(rep("uno", 20), collapse = " ")
  b <- paste(rep("dos", 12), collapse = " ")
  expect_equal(
    .multilista_lineas_medidas(c(a, b), 0.24, 12.5, 14),
    .multilista_lineas_medidas(a, 0.24, 12.5, 14) +
      .multilista_lineas_medidas(b, 0.24, 12.5, 14)
  )
})


test_that("sin texto no hay líneas, y sin canal no hay medición", {
  expect_equal(.multilista_lineas_medidas(character(0), 0.24, 12.5, 14), 0L)
  expect_equal(.multilista_lineas_medidas(c(NA, "  "), 0.24, 12.5, 14), 0L)
  # Devolver 0 aquí sería peor que no medir: el bloque se quedaría sin alto.
  expect_true(is.na(.multilista_lineas_medidas("hola", NA, 12.5, 14)))
  expect_true(is.na(.multilista_lineas_medidas("hola", 0.24, NA, 14)))
  expect_true(is.na(.multilista_lineas_medidas("hola", 0.24, 12.5, 0)))
  expect_true(is.na(.multilista_lineas_medidas("hola", -1, 12.5, 14)))
})


test_that("un salto de línea escrito no infla la cuenta por su cuenta", {
  # `str_wrap()` respeta los `\n` del texto; el canal es quien manda.
  con <- .multilista_lineas_medidas("hola\nmundo", 0.24, 12.5, 14)
  sin <- .multilista_lineas_medidas("hola mundo", 0.24, 12.5, 14)
  expect_equal(con, sin)
})


test_that("el estimador de altura consume la medición, no el ancho del eje", {
  # Un `grepl` del nombre lo encontraría en el comentario que lo explica: hay
  # que buscar las LLAMADAS, y que ya no quede ninguna de las dos que pasaban
  # el wrap del eje al enunciado.
  ruta <- testthat::test_path("..", "..", "R", "reporte_plan_ppt.R")
  skip_if_not(file.exists(ruta))
  src <- paste(readLines(ruta, warn = FALSE), collapse = "\n")
  expect_true(grepl("n <- .multilista_lineas_medidas(x, w, a, s, fam)", src, fixed = TRUE))
  expect_true(grepl(".multilista_lineas_enunciado(ttl, block_wrap, block_overrides)", src, fixed = TRUE))
  expect_false(grepl("max(12, floor(block_wrap * 0.8))", src, fixed = TRUE))
})


test_that("el respaldo del estimador sigue en pie para las etiquetas del eje", {
  # Las ramas `var` y `cruce` cuentan etiquetas de fila, que SÍ viven en el
  # ancho del eje: ahí `block_wrap` es la magnitud correcta y no se toca.
  ruta <- testthat::test_path("..", "..", "R", "reporte_plan_ppt.R")
  skip_if_not(file.exists(ruta))
  src <- paste(readLines(ruta, warn = FALSE), collapse = "\n")
  expect_true(grepl("title_lines <- .multilista_wrap_lines(lvls$labels, block_wrap)",
                    src, fixed = TRUE))
})

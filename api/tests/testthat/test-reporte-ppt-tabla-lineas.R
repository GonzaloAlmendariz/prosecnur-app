test_that("un texto corto ocupa una linea", {
  expect_equal(.tabla_lineas_celda("Muestreo"), 1L)
  expect_equal(.tabla_lineas_celda(""), 1L)
  expect_equal(.tabla_lineas_celda(NULL), 1L)
  expect_equal(.tabla_lineas_celda(NA), 1L)
})


test_that("cada salto explicito suma una linea aunque el texto sea corto", {
  # El caso real: cuatro publicos, uno por linea. Pesar por caracteres daba
  # menos alto que a un parrafo corrido, y la celda no cabia.
  muestra <- paste(
    "172 estudiantes (96 %)",
    "52 docentes (92 %)",
    "178 egresados/as (66 %)",
    "15 administrativos/as (94 %)",
    sep = "\n"
  )
  expect_equal(.tabla_lineas_celda(muestra), 4L)
  # Sin los saltos el mismo contenido son 94 caracteres: dos lineas, no cuatro.
  # Esa es la diferencia que el peso por caracteres no veia.
  expect_equal(.tabla_lineas_celda(gsub("\n", " ", muestra)), 2L)
})


test_that("un parrafo largo se parte en las lineas que necesita", {
  largo <- strrep("a", 92 * 3 + 5)
  expect_equal(.tabla_lineas_celda(largo), 4L)
  expect_equal(.tabla_lineas_celda(strrep("a", 92)), 1L)
  expect_equal(.tabla_lineas_celda(strrep("a", 93)), 2L)
})


test_that("saltos y parrafos largos se suman", {
  x <- paste(strrep("a", 200), "corto", sep = "\n")
  # 200 caracteres son 3 lineas (ceiling), mas la linea del segundo parrafo.
  expect_equal(.tabla_lineas_celda(x), 4L)
})


test_that("una linea vacia sigue ocupando su alto", {
  expect_equal(.tabla_lineas_celda("uno\n\ndos"), 3L)
})


test_that("el peso de la fila toma la columna que mas lineas necesita", {
  # Criterio corto, detalle de cuatro lineas -> manda el detalle.
  expect_equal(.tabla_peso_fila("Muestra", "a\nb\nc\nd"), 4L)
  # Criterio largo en columna estrecha -> manda el criterio.
  expect_gte(.tabla_peso_fila(strrep("x", 40), "corto"), 2L)
  expect_equal(.tabla_peso_fila("Muestreo", "corto"), 1L)
})


test_that("la ficha real reparte mas alto a Muestra que a Muestreo", {
  # Lo que fallaba: ambas recibian 1.24 cm porque tenian pocos caracteres, y
  # una de las dos lleva cuatro lineas.
  muestreo <- .tabla_peso_fila("Muestreo", "No probabilistico por conveniencia, con intencion censal.")
  muestra <- .tabla_peso_fila("Muestra", "172 estudiantes\n52 docentes\n178 egresados/as\n15 administrativos/as")
  expect_gt(muestra, muestreo)
})

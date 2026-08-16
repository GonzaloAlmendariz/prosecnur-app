# El rótulo de la columna se escribe como lo escribe el entregable aprobado.
#
# El motor ponía «Top 2 Box» y el aprobado escribe «TOP TWO BOX» en sus 41
# láminas. Además de coherencia, la forma importa para medir: buscando
# «Top 2 Box» el conteo sobre el aprobado devolvía 0 columnas cuando tiene 40.

test_that("el rotulo es el del entregable aprobado", {
  expect_identical(.PPT_ROTULO_TOP_TWO_BOX, "TOP TWO BOX")
})

test_that("no queda el literal viejo en el motor", {
  # Estaba escrito a mano en `reporte_plan_ppt.R`, que gana sobre el default del
  # graficador: cambiar sólo el default no movía ni una lámina.
  motor <- readLines("../../R/reporte_plan_ppt.R", warn = FALSE)
  linea <- grep("titulo_barra_extra <- ", motor, value = TRUE)
  expect_true(length(linea) > 0)
  expect_false(any(grepl('"Top 2 Box"', linea, fixed = TRUE)))
})

# P53. El motor rotulaba «0%» ocho veces en el mazo de Contabilidad y el
# entregable aprobado no rotula NINGUNA (0 de 1.019 etiquetas de porcentaje).
#
# La causa, medida con traza en la fuente sobre los 232 renders: el CIERRE
# EXACTO A 1 de `graficador_barras_apiladas.R` suma `delta = 1 - suma` al
# ultimo nivel del stack, y cuando ese nivel es uno de los que se aplanaron
# por rotularse 0 % le devuelve el residuo de coma flotante. Las 24 fugas
# traian TODAS exactamente `.valor_plot = 1,11022e-16` con `.pct_units = 0`.
# Con eso cruzaban la guarda `.valor_plot > umbral` (umbral 0 por defecto) y
# salia el rotulo sobre un segmento de ancho 0 EMU.

test_that("el residuo del cierre exacto no resucita una cifra cero", {
  # El caso REAL, con el valor literal que traia la traza.
  v <- c(1.11022e-16, 0.0192308, 0.365385, 0.519231, 0.0961538)
  u <- c(0L, 2L, 37L, 52L, 10L)
  out <- .barras_reaplanar_cifras_cero(v, u)
  expect_identical(out[1], 0)
  # Y no toca a nadie mas: los cuatro que si tienen cifra quedan intactos.
  expect_equal(out[-1], v[-1])
})


test_that("aplana TODAS las cifras cero, no solo la primera", {
  v <- c(1.11022e-16, 0.5, 1.11022e-16, 0.5)
  u <- c(0L, 50L, 0L, 50L)
  expect_identical(.barras_reaplanar_cifras_cero(v, u), c(0, 0.5, 0, 0.5))
})


test_that("un cero que ya venia en cero se queda igual", {
  expect_identical(
    .barras_reaplanar_cifras_cero(c(0, 0.4, 0.6), c(0L, 40L, 60L)),
    c(0, 0.4, 0.6)
  )
})


test_that("mostrar_categorias_en_cero es el escape y respeta el piso", {
  # Encendido, el analista PIDIO ver los ceros con su piso: no se tocan.
  v <- c(0.02, 0.48, 0.5)
  expect_identical(
    .barras_reaplanar_cifras_cero(v, c(0L, 48L, 50L), mostrar_ceros = TRUE),
    v
  )
})


test_that("una cifra distinta de cero nunca se aplana, por pequena que sea", {
  # 1 % sobre una base grande es un ancho diminuto y una cifra legitima.
  v <- c(0.004, 0.996)
  expect_identical(.barras_reaplanar_cifras_cero(v, c(1L, 99L)), v)
})


test_that("entradas degeneradas no rompen ni inventan", {
  expect_identical(.barras_reaplanar_cifras_cero(numeric(0), integer(0)), numeric(0))
  # Longitudes que no casan: devolver el vector tal cual es mas seguro que
  # reciclar y aplanar el segmento equivocado.
  expect_identical(.barras_reaplanar_cifras_cero(c(0.5, 0.5), 0L), c(0.5, 0.5))
  # Un NA en la cifra no autoriza a aplanar.
  expect_identical(
    .barras_reaplanar_cifras_cero(c(0.3, 0.7), c(NA_integer_, 70L)),
    c(0.3, 0.7)
  )
})


test_that("el graficador reafirma la invariante DESPUES del cierre exacto", {
  # Los tests de arriba pasan con y sin el cableado: si el graficador dejara
  # de llamar al helper, el defecto volveria y ninguno rojearia. Aqui se
  # comprueba la llamada, y que este DESPUES del cierre —que es lo unico que
  # la hace util: puesta antes, el cierre volveria a resucitar el segmento.
  ruta <- testthat::test_path("..", "..", "R", "graficador_barras_apiladas.R")
  skip_if_not(file.exists(ruta))
  src <- readLines(ruta, warn = FALSE)
  i_cierre <- grep("dplyr::select(-.sum1, -.delta, -.sum2)", src, fixed = TRUE)
  i_llamada <- grep("df_long$.valor_plot <- .barras_reaplanar_cifras_cero(",
                    src, fixed = TRUE)
  expect_length(i_cierre, 1L)
  expect_length(i_llamada, 1L)
  expect_true(i_llamada > i_cierre)
})

# La memoria de un paso de `.monitoreo_aulas_df()`: se llama trece veces por
# build sobre los mismos insumos, y convertir cuesta 3 000 veces mas que
# comparar.

test_that("devuelve lo mismo que convertir a pelo", {
  .mad_olvida()
  filas <- lapply(1:5, function(i) list(a = as.character(i), b = "x"))
  esperado <- .monitoreo_aulas_df_calcula(filas)
  expect_equal(.monitoreo_aulas_df(filas), esperado)
})

test_that("la segunda llamada con el MISMO insumo no vuelve a convertir", {
  .mad_olvida()
  n <- 0L
  filas <- lapply(1:5, function(i) list(a = as.character(i)))
  espia <- function(x) { n <<- n + 1L; .monitoreo_aulas_df_calcula(x) }
  .mad_recuerda(filas, espia)
  .mad_recuerda(filas, espia)
  .mad_recuerda(filas, espia)
  expect_equal(n, 1L)
})

test_that("un insumo DISTINTO con la misma forma no devuelve el del anterior", {
  # La trampa que descarta una huella barata: mismas filas, mismas columnas y
  # otros valores. Una huella por tamaño y nombres los daria por iguales y el
  # motor publicaria el dashboard de otro corte.
  .mad_olvida()
  a <- lapply(1:3, function(i) list(cod = as.character(i), n = "10"))
  b <- lapply(1:3, function(i) list(cod = as.character(i), n = "99"))
  expect_equal(.monitoreo_aulas_df(a)$n, c("10", "10", "10"))
  expect_equal(.monitoreo_aulas_df(b)$n, c("99", "99", "99"))
})

test_that("un data.frame no entra al cache: convertirlo ya es barato", {
  .mad_olvida()
  n <- 0L
  df <- data.frame(a = 1:3, stringsAsFactors = FALSE)
  espia <- function(x) { n <<- n + 1L; .monitoreo_aulas_df_calcula(x) }
  .mad_recuerda(df, espia)
  .mad_recuerda(df, espia)
  expect_equal(n, 2L)
})

test_that("el cache no crece sin limite", {
  .mad_olvida()
  for (k in 1:10) .monitoreo_aulas_df(lapply(1:3, function(i) list(a = paste0(k, i))))
  expect_lte(length(.mad_cache$entradas), 4L)
})

test_that("con mas insumos que huecos, el mas viejo se olvida y se recalcula", {
  .mad_olvida()
  n <- 0L
  espia <- function(x) { n <<- n + 1L; .monitoreo_aulas_df_calcula(x) }
  insumos <- lapply(1:5, function(k) lapply(1:3, function(i) list(a = paste0(k, i))))
  for (x in insumos) .mad_recuerda(x, espia)
  expect_equal(n, 5L)
  # El primero ya no esta: vuelve a convertir.
  .mad_recuerda(insumos[[1]], espia)
  expect_equal(n, 6L)
  # El ultimo si esta.
  .mad_recuerda(insumos[[5]], espia)
  expect_equal(n, 6L)
})

test_that("una lista vacia o un NULL no pasan por el cache", {
  .mad_olvida()
  expect_equal(nrow(.monitoreo_aulas_df(NULL)), 0L)
  expect_equal(nrow(.monitoreo_aulas_df(list())), 0L)
  expect_equal(length(.mad_cache$entradas), 0L)
})

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

# --- la memoria del plan normalizado -----------------------------------------

test_that("normalizar dos veces el mismo plan no cuesta dos veces", {
  .mad_olvida()
  n <- 0L
  plan <- lapply(1:4, function(i) list(classroom_id = paste0("CH ", i), operational_code = paste0("CH ", i), faculty = "DERECHO"))
  espia <- function(p) { n <<- n + 1L; .monitoreo_aulas_normalize_plan_calcula(p) }
  a <- .mad_plan_normalizado(plan, espia)
  b <- .mad_plan_normalizado(plan, espia)
  expect_equal(n, 1L)
  expect_identical(a, b)
})

test_that("y el resultado es el mismo que sin memoria", {
  .mad_olvida()
  plan <- lapply(1:4, function(i) list(classroom_id = paste0("CH ", i), operational_code = paste0("CH ", i), faculty = "DERECHO"))
  esperado <- .monitoreo_aulas_normalize_plan_calcula(plan)
  expect_equal(monitoreo_aulas_normalize_plan(plan), esperado)
})

test_that("dos planes distintos no se confunden", {
  # Mismo tamaño y mismas columnas, distinta facultad: es el caso que descarta
  # cualquier huella barata.
  #
  # `classroom_id` no es decoración del fixture: `normalize_plan` descarta las
  # filas que no lo traen (`out[nzchar(out$classroom_id), ]`), y sin él las tres
  # comparaciones se hacían entre dos listas vacías —verdes y sin ejercitar
  # nada—. Lo leí en la función en vez de suponerlo.
  .mad_olvida()
  a <- lapply(1:3, function(i) list(classroom_id = paste0("CH ", i), operational_code = paste0("CH ", i), faculty = "DERECHO"))
  b <- lapply(1:3, function(i) list(classroom_id = paste0("CH ", i), operational_code = paste0("CH ", i), faculty = "PSICOLOGÍA"))
  fa <- monitoreo_aulas_normalize_plan(a)
  fb <- monitoreo_aulas_normalize_plan(b)
  expect_equal(unique(vapply(fa, function(x) x$faculty, character(1))), "DERECHO")
  expect_equal(unique(vapply(fb, function(x) x$faculty, character(1))), "PSICOLOGÍA")
})

test_that("el plan y las tablas usan almacenes distintos", {
  # Si compartieran hueco, convertir cuatro tablas desalojaría el plan justo
  # cuando el build vuelve a pedirlo.
  .mad_olvida()
  plan <- lapply(1:3, function(i) list(classroom_id = paste0("CH ", i)))
  monitoreo_aulas_normalize_plan(plan)
  for (k in 1:5) .monitoreo_aulas_df(lapply(1:3, function(i) list(a = paste0(k, i))))
  n <- 0L
  espia <- function(p) { n <<- n + 1L; .monitoreo_aulas_normalize_plan_calcula(p) }
  .mad_plan_normalizado(plan, espia)
  expect_equal(n, 0L)
})

# --- la conversion inversa: data.frame -> lista de filas ----------------------

test_that("`.monitoreo_aulas_records` da lo mismo que indexar fila a fila", {
  # La version anterior era `as.list(df[i, , drop = FALSE])` por fila. Se
  # sustituyo por una que extrae las columnas UNA vez —diez veces mas rapida— y
  # esto fija que el resultado no cambia. Las seis formas son las que aparecen
  # en el plan y en los partes.
  por_filas <- function(df) lapply(seq_len(nrow(df)), function(i) as.list(df[i, , drop = FALSE]))
  mixta <- data.frame(f = factor(c("a", "b")), n = c(1.5, 2.5), stringsAsFactors = FALSE)
  # **La columna-lista es el caso que obliga a distinguir**: `df[i, ]` conserva
  # la envoltura de la celda y `col[[i]]` la quita.
  mixta$lst <- list(list(1), list(2, 3))
  casos <- list(
    simple = data.frame(a = c("x", "y"), n = c(1, 2), stringsAsFactors = FALSE),
    factores = data.frame(f = factor(c("a", "b")), stringsAsFactors = FALSE),
    logicos = data.frame(l = c(TRUE, NA)),
    fechas = data.frame(d = as.Date(c("2026-09-10", "2026-09-11"))),
    faltantes = data.frame(a = c(NA_character_, "z"), n = c(NA_real_, 2), stringsAsFactors = FALSE),
    mixta = mixta
  )
  for (nm in names(casos)) {
    expect_identical(
      .monitoreo_aulas_records(casos[[nm]]), por_filas(casos[[nm]]),
      info = nm
    )
  }
})

test_that("respeta el tope de filas y el vacio", {
  df <- data.frame(a = as.character(1:10), stringsAsFactors = FALSE)
  expect_equal(length(.monitoreo_aulas_records(df, max_rows = 3)), 3L)
  expect_equal(.monitoreo_aulas_records(data.frame()), list())
  expect_equal(.monitoreo_aulas_records(NULL), list())
})

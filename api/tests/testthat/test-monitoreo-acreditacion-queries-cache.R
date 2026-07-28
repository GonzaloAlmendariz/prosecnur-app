test_that("un cache de consultas persistido vacio cuenta como ausente", {
  expect_true(.monitoreo_acreditacion_queries_cache_vacio(NULL))
  expect_true(.monitoreo_acreditacion_queries_cache_vacio(list()))
  # Asi es EXACTAMENTE como el .pulso persiste el cache: la clave existe pero
  # no trae casos. `%||%` no cae con esto, y por eso Consultas quedaba muda.
  expect_true(.monitoreo_acreditacion_queries_cache_vacio(list(cases = list(), totals = list())))
})

test_that("un cache con casos se respeta y no se recalcula", {
  cached <- list(cases = list(list(response_id = "r1")), totals = list(list(label = "Total", value = 1)))
  expect_false(.monitoreo_acreditacion_queries_cache_vacio(cached))

  data <- data.frame(a = 1:3)
  hidratado <- .monitoreo_acreditacion_queries_hidratadas(data, list(), cached)
  expect_identical(hidratado, cached)
})

test_that("sin snapshot utilizable no se inventa un corte", {
  expect_identical(.monitoreo_acreditacion_queries_hidratadas(NULL, list(), list()), list())
  expect_identical(
    .monitoreo_acreditacion_queries_hidratadas(data.frame(), list(), list(cases = list())),
    list(cases = list())
  )
})

test_that("un cache vacio se reconstruye desde el snapshot sin red", {
  data <- data.frame(
    .source_id = c("universo", "universo", "respuestas", "respuestas"),
    .source_role = c("universo", "universo", "respuestas", "respuestas"),
    .source_label = c("Base", "Base", "Encuesta", "Encuesta"),
    .source_kind = c("google_sheets", "google_sheets", "surveymonkey", "surveymonkey"),
    dim_actor = c("Docentes", "Docentes", "Docentes", "Docentes"),
    codigo = c("A1", "A2", "A1", "A9"),
    response_id = c("", "", "r-1", "r-2"),
    response_status = c("", "", "completed", "completed"),
    stringsAsFactors = FALSE
  )
  profile <- monitoreo_normalize_profile(list(family = "acreditacion"))

  hidratado <- .monitoreo_acreditacion_queries_hidratadas(data, profile, list())

  # No se afirma un conteo exacto: lo que el gate protege es que un cache vacio
  # DEJE de propagarse cuando el snapshot si trae filas. Tampoco se afirma una
  # bandera de procedencia: la forma de `internal_queries` es contrato.
  expect_false(.monitoreo_acreditacion_queries_cache_vacio(hidratado))
  expect_true(length(hidratado$cases %||% list()) > 0L)
})

test_that("una reconstruccion que falla conserva el cache y no rompe la apertura", {
  # Un corte viejo sin las columnas de reconciliacion no puede tumbar el
  # proyecto: la rehidratacion es oportunista, no obligatoria.
  roto <- data.frame(cualquier_cosa = 1:2, stringsAsFactors = FALSE)
  esperado <- list(cases = list())
  expect_silent(salida <- .monitoreo_acreditacion_queries_hidratadas(roto, list(), esperado))
  expect_true(is.list(salida))
})

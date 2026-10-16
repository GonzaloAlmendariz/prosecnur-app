# Analítica dice cuántos casos cuentan según el criterio de Validación.

.au_data <- data.frame(`_uuid` = 1:10, seleccionado = c(rep(1, 7), rep(0, 3)), check.names = FALSE)
.au_cfg <- function(valores) list(caso_valido = list(enabled = TRUE, condiciones = list(
  list(variable = "seleccionado", operador = "==", valores = valores))))

test_that("con criterio dice cuántos cuentan y con qué condición", {
  u <- analitica_universo_de_base(.au_data, .au_cfg(list("1")))
  expect_true(u$declarado)
  expect_true(u$aplicado)
  expect_identical(c(u$n_total, u$n_validos), c(10L, 7L))
  expect_identical(u$condiciones[[1]]$variable, "seleccionado")
})

test_that("sin criterio cuentan todos, y un criterio que vaciaría la base no se aplica", {
  sin <- analitica_universo_de_base(.au_data, list())
  expect_false(sin$declarado)
  expect_identical(sin$n_validos, 10L)
  vacio <- analitica_universo_de_base(.au_data, .au_cfg(list("9")))
  expect_true(vacio$declarado)
  expect_false(vacio$aplicado)
  expect_identical(vacio$n_validos, 10L)
  expect_true(nzchar(vacio$motivo_no_aplicado))
})

test_that("Gráficos filtra cada base con su criterio y conserva los atributos", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  caso_valido_guardar(sid, "2026", TRUE, list(list(variable = "q1", operador = "==", valores = list("1"))))
  dat <- estudio_data_sources(sid)[["2026"]]
  attr(dat, "marca_prueba") <- "x"
  src <- .graficos_aplicar_caso_valido(sid, list(data_sources = list(`2026` = dat, `2024` = estudio_data_sources(sid)[["2024"]])))
  esperados <- sum(as.character(dat$q1) %in% "1")
  expect_identical(nrow(src$data_sources[["2026"]]), esperados)
  expect_identical(attr(src$data_sources[["2026"]], "marca_prueba"), "x")
  # La base sin criterio no cambia.
  expect_identical(nrow(src$data_sources[["2024"]]), nrow(estudio_data_sources(sid)[["2024"]]))
})

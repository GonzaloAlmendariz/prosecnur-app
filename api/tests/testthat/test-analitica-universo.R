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

test_that("declarar o apagar «qué casos cuentan» cambia la clave del caché de la base preparada", {
  # HSyVbG 2026-10-21: con el universo de 2026 apagado, la BD exportada seguía
  # con 2.500 casos en vez de 3.318 porque la base preparada no se invalidaba.
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$estudio <- list(bases = list(b2024 = list(nombre = "b2024"), b2026 = list(nombre = "b2026")),
                    processing_mode = "multibase", active_base = "b2026")
  .session_env[[sid]] <- s
  k0 <- .analitica_source_cache_key(sid, "estudio:base_1")
  cond <- list(list(variable = "seleccionado", operador = "==", valores = list("1")))
  s <- session_get(sid)
  s$estudio$bases$b2026$validacion <- list(operational_config = list(caso_valido = list(enabled = TRUE, condiciones = cond)))
  .session_env[[sid]] <- s
  k1 <- .analitica_source_cache_key(sid, "estudio:base_1")
  expect_false(identical(k0, k1))
  s <- session_get(sid)
  s$estudio$bases$b2026$validacion$operational_config$caso_valido$enabled <- FALSE
  .session_env[[sid]] <- s
  expect_identical(.analitica_source_cache_key(sid, "estudio:base_1"), k0)
})

test_that("con universo declarado la clave sigue terminando en «:<base activa>» e invalidar esa base borra su caché", {
  # El verificador del 2026-10-21 mostró que, con la firma al final de la
  # clave, `.invalidate_processing_state` dejaba vivo el caché de la base
  # invalidada (lo reconoce por el sufijo «:<base>»).
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  cond <- list(list(variable = "seleccionado", operador = "==", valores = list("1")))
  s <- session_get(sid)
  s$estudio <- list(bases = list(A = list(nombre = "A"), B = list(nombre = "B",
                    validacion = list(operational_config = list(caso_valido = list(enabled = TRUE, condiciones = cond))))),
                    processing_mode = "multibase", active_base = "A")
  .session_env[[sid]] <- s
  key_a <- .analitica_source_cache_key(sid, "originales")
  expect_true(endsWith(key_a, ":A"))
  s <- session_get(sid)
  s$analitica_fuente <- key_a
  s$analitica_rp_data <- data.frame(x = 1)
  s$estudio$active_base <- "B"
  s <- .invalidate_processing_state(s, base_nombre = "A")
  expect_null(s$analitica_rp_data)
})

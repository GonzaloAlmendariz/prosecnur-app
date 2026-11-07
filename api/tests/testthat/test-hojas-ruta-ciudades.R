# Ciudades del estudio (plan docs/qa/plan-territorio-por-regiones-2026-10-29.md, R3): la clave
# `integrated_config$ciudades` sale del registro de territorios, se deriva de los distritos de un
# .pulso viejo y conserva una ciudad que todavía no tiene distritos.

ciudades_de <- function(cfg) as.character(unlist(cfg$ciudades))

test_that("la ciudad de un distrito sale del registro: Lima Metropolitana y Callao son «lima»", {
  expect_identical(.hojas_ruta_ciudad_de_ubigeo("150101"), "lima")
  expect_identical(.hojas_ruta_ciudad_de_ubigeo("070101"), "lima")
  expect_identical(.hojas_ruta_ciudad_de_ubigeo("040103"), "0401")
  expect_true(is.na(.hojas_ruta_ciudad_de_ubigeo("999999")))
})

test_that("sin la clave se deriva de los distritos; los códigos de provincia de Lima y Callao pasan a «lima»", {
  cfg <- hojas_ruta_integrada_normalize_config(list(territorios = list("150101", "070101")))
  expect_identical(ciudades_de(cfg), "lima")
  cfg <- hojas_ruta_integrada_normalize_config(list(territorios = list(), ciudades = list("1501", "0701", "0401")))
  expect_identical(ciudades_de(cfg), c("0401", "lima"))
})

test_that("una ciudad sin distritos se conserva; la de un distrito elegido se agrega sola", {
  cfg <- hojas_ruta_integrada_normalize_config(list(territorios = list("150101"), ciudades = list("0401")))
  expect_identical(ciudades_de(cfg), c("0401", "lima"))
})

test_that("vacía explícita con territorios vacío queda vacía", {
  cfg <- hojas_ruta_integrada_normalize_config(list(territorios = list(), ciudades = list()))
  expect_length(cfg$ciudades, 0L)
})

test_that("lo que no está en el registro se descarta y se puede nombrar", {
  raw <- list("0401", "9999", "lima", "0401")
  cfg <- hojas_ruta_integrada_normalize_config(list(territorios = list(), ciudades = raw))
  expect_identical(ciudades_de(cfg), c("0401", "lima"))
  expect_identical(.hojas_ruta_ciudades_descartadas(raw, cfg), "9999")
})

test_that("una sola ciudad viaja como arreglo en el JSON", {
  cfg <- hojas_ruta_integrada_normalize_config(list(territorios = list(), ciudades = list("0401")))
  expect_match(as.character(jsonlite::toJSON(cfg, auto_unbox = TRUE, null = "null")), '"ciudades":\\["0401"\\]')
})

test_that("las ciudades válidas son las del índice del atlas", {
  f <- testthat::test_path("..", "..", "..", "frontend", "src", "features", "hojasRuta", "ciudadesIndice.json")
  skip_if_not(file.exists(f))
  indice <- vapply(jsonlite::fromJSON(f, simplifyVector = FALSE)$ciudades, function(x) x$codigo, "")
  expect_setequal(.hojas_ruta_ciudades_validas(), indice)
})

test_that("el borrador de ciudades sobrevive a la normalización del ui_state", {
  cfg <- hojas_ruta_integrada_normalize_config(list())
  ui <- .hojas_ruta_ui_state_normalize(list(draft_ciudades = list("0401", "9999")), cfg)
  expect_identical(as.character(unlist(ui$draft_ciudades)), "0401")
  expect_null(.hojas_ruta_ui_state_normalize(list(), cfg)$draft_ciudades)
})

test_that("POST /workspace conserva una ciudad sin distritos y avisa la que no existe", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  pr <- mount_hojas_ruta(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  body <- .hre_json(list(config = list(territorios = list(), ciudades = list("0401", "9999"))))
  r <- .hre_call(pr, sid, "POST", "/api/hojas-ruta/workspace", body)
  expect_identical(r$status, 200L, info = substr(r$raw, 1, 300))
  expect_true("0401" %in% unlist(r$body$integrated_config$ciudades))
  expect_identical(r$body$alerts[[1]]$code, "W_HOJAS_RUTA_CIUDAD_DESCARTADA")
  expect_true("0401" %in% unlist(.hojas_ruta_active_run(sid)$run$config$ciudades))
})

test_that("POST /workspace ligero sin ui_state conserva el historial y responde sólo la config (checklist F1)", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  pr <- mount_hojas_ruta(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  foto <- list(id = "r1", label = "Ruteo 1", sample = list(blocks = list()))
  r0 <- .hre_call(pr, sid, "POST", "/api/hojas-ruta/workspace", .hre_json(list(config = list(territorios = list()), ui_state = list(route_history = list(foto)))))
  expect_identical(r0$status, 200L)
  expect_length(.hojas_ruta_active_run(sid)$run$ui_state$route_history, 1L)
  r <- .hre_call(pr, sid, "POST", "/api/hojas-ruta/workspace", .hre_json(list(config = list(territorios = list(), ciudades = list("0401")), ligero = TRUE)))
  expect_identical(r$status, 200L)
  expect_null(r$body$runs)
  expect_null(r$body$ui_state)
  expect_true("0401" %in% unlist(r$body$integrated_config$ciudades))
  expect_length(.hojas_ruta_active_run(sid)$run$ui_state$route_history, 1L)
})

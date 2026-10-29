# Plan de campo y costo (U14).

pc_bloque <- function(id, ubigeo, lon, lat, visitas = 10, entrevistas = 8) list(id_manzana = id, ubigeo = ubigeo, distrito = "D", entrevistas = entrevistas, visitas_esperadas = visitas, viviendas = 50)

test_that("sin muestra el plan está vacío y con ceros", {
  p <- hojas_ruta_plan_campo(list(), list(), puntos = data.frame(id_manzana = character(0), lon = numeric(0), lat = numeric(0)))
  expect_length(p$jornadas, 0)
  expect_identical(p$resumen$dias, 0L)
})

test_that("las jornadas respetan la capacidad de visitas y siguen la cercanía dentro de cada distrito", {
  ids <- c("a", "b", "c", "d", "e")
  bloques <- lapply(ids, function(i) pc_bloque(i, "150101", 0, 0, visitas = 10))
  bloques[[6]] <- pc_bloque("z", "150102", 0, 0, visitas = 10)
  puntos <- data.frame(id_manzana = c(ids, "z"), lon = c(-77.00, -77.03, -77.01, -77.02, -77.04, -77.10), lat = -12.05, nse_nivel = "S/D")
  p <- hojas_ruta_plan_campo(bloques, list(visitas_por_jornada = 30, encuestadores = 2), puntos = puntos)
  # Distrito 150101: 5 rutas × 10 visitas con 30 por jornada → 2 jornadas; 150102 → 1.
  expect_identical(p$resumen$jornadas, 3L)
  expect_identical(p$resumen$dias, 2L)
  expect_true(all(vapply(p$jornadas, `[[`, integer(1), "visitas") <= 30L))
  # Desde la más al oeste (e, −77,04) por vecino más cercano: e, b, d | c, a.
  expect_identical(unlist(p$jornadas[[1]]$rutas), c("e", "b", "d"))
  expect_identical(unlist(p$jornadas[[2]]$rutas), c("c", "a"))
  expect_identical(p$jornadas[[3]]$ubigeo, "150102")
  expect_gt(p$resumen$km, 0)
})

test_that("una ruta que no cabe en una jornada va entera, cuenta como varias y pide días seguidos (revisión U15)", {
  bloques <- list(pc_bloque("a", "150101", 0, 0, visitas = 70, entrevistas = 8))
  puntos <- data.frame(id_manzana = "a", lon = -77, lat = -12, nse_nivel = "S/D")
  p <- hojas_ruta_plan_campo(bloques, list(visitas_por_jornada = 30, encuestadores = 4, costo_por_entrevista = 10, costo_por_jornada = 100), puntos = puntos)
  expect_length(p$jornadas, 1)
  expect_true(p$jornadas[[1]]$excede_jornada)
  expect_identical(p$jornadas[[1]]$jornadas_equivalentes, 3L)
  expect_identical(p$jornadas[[1]]$visitas, 70L)
  expect_identical(p$resumen$jornadas, 3L)
  # Con 4 encuestadores bastaría 1 día, pero la ruta es de una sola persona: 3 días.
  expect_identical(p$resumen$dias, 3L)
  expect_equal(p$resumen$costo, 8 * 10 + 3 * 100)
  expect_identical(p$alertas[[1]]$code, "W_PLAN_RUTA_EXCEDE_JORNADA")
  expect_match(p$alertas[[1]]$message, "ruta a")
})

test_that("una ruta justo en la capacidad no excede, y sin rutas el resumen es cero", {
  bloques <- list(pc_bloque("a", "150101", 0, 0, visitas = 30, entrevistas = 8))
  puntos <- data.frame(id_manzana = "a", lon = -77, lat = -12, nse_nivel = "S/D")
  p <- hojas_ruta_plan_campo(bloques, list(visitas_por_jornada = 30), puntos = puntos)
  expect_false(p$jornadas[[1]]$excede_jornada)
  expect_length(p$alertas, 0)
  v <- hojas_ruta_plan_campo(list(), list())
  expect_identical(v$resumen$jornadas, 0L)
  expect_length(v$alertas, 0)
})

test_that("es determinista y los supuestos se acotan", {
  bloques <- lapply(c("a", "b"), function(i) pc_bloque(i, "150101", 0, 0))
  puntos <- data.frame(id_manzana = c("a", "b"), lon = c(-77, -77.01), lat = -12, nse_nivel = "S/D")
  expect_identical(hojas_ruta_plan_campo(bloques, list(), puntos), hojas_ruta_plan_campo(bloques, list(), puntos))
  s <- hojas_ruta_plan_campo_supuestos(list(encuestadores = 0, visitas_por_jornada = -3, costo_por_km = "x"))
  expect_identical(s$encuestadores, 1L)
  expect_identical(s$visitas_por_jornada, 1L)
  expect_identical(s$costo_por_km, 0)
})

test_that("HTTP: el plan pide una muestra, está montado y no guarda nada", {
  expect_true(grepl("mount_hojas_ruta_plan_campo(pr)", paste(deparse(body(build_plumber_app)), collapse = " "), fixed = TRUE))
  pr <- mount_hojas_ruta_plan_campo(plumber::pr())
  ep <- Find(function(e) identical(e$verbs, "POST"), unlist(pr$endpoints, recursive = FALSE))
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  llamar <- function(body) ep$getFunc()(
    req = list(HTTP_X_PULSO_SESSION = sid, bodyRaw = charToRaw(enc2utf8(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null")))),
    res = plumber:::PlumberResponse$new()
  )
  sin <- llamar(list(supuestos = list()))
  expect_identical(sin$error$code %||% sin$code %||% "", "E_NO_SAMPLE")
})

test_that("los supuestos del plan sobreviven a la normalización del ui_state", {
  ui <- .hojas_ruta_ui_state_normalize(list(plan_campo = list(encuestadores = 6, costo_por_jornada = 120)))
  expect_identical(ui$plan_campo$encuestadores, 6L)
  expect_equal(ui$plan_campo$costo_por_jornada, 120)
  expect_identical(.hojas_ruta_ui_state_normalize(list())$plan_campo$encuestadores, 4L)
})

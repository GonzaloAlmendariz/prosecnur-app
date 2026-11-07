# Canales por público en acreditación (ADR 0125 §5): Monitoreo los declara y
# conserva; el Planner los lee para decirle a Material qué campañas abrir.

test_that("los canales sobreviven a la normalización, ida y vuelta", {
  units <- list(list(id = "egresados", label = "Egresados", origin = "declarado",
                     canales = list(list(ronda = 1L, canal = "correo"), list(ronda = 2L, canal = "telefonico"),
                                    list(ronda = 3L, canal = "correo"))))
  una <- .monitoreo_normalize_model_units(units)
  dos <- .monitoreo_normalize_model_units(una)
  expect_identical(una[[1]]$canales, dos[[1]]$canales)
  expect_identical(vapply(dos[[1]]$canales, `[[`, "", "canal"), c("correo", "telefonico", "correo"))
  expect_identical(vapply(dos[[1]]$canales, `[[`, 1L, "ronda"), 1:3)
  # Con telefónico declarado, el switch se lee de los canales.
  expect_true(dos[[1]]$phone$enabled)
})

test_that("un público ya marcado como telefónico migra a [correo, telefónico] sin perder nada", {
  u <- .monitoreo_normalize_model_units(list(list(id = "docentes", phone = list(enabled = TRUE))))
  expect_identical(vapply(u[[1]]$canales, `[[`, "", "canal"), c("correo", "telefonico"))
  expect_true(u[[1]]$phone$enabled)
  sin <- .monitoreo_normalize_model_units(list(list(id = "alumnos")))
  expect_length(sin[[1]]$canales, 0L)
  expect_false(sin[[1]]$phone$enabled)
})

test_that("alias, rondas repetidas y canales desconocidos se ordenan sin inventar", {
  c1 <- .monitoreo_normalize_canales(list(
    list(ronda = 2, canal = "Llamadas"), list(ronda = 1, canal = "Email"),
    list(ronda = 2, canal = "aula"), list(canal = "fax"), list(canal = "QR")
  ))
  expect_identical(vapply(c1, `[[`, "", "canal"), c("correo", "telefonico", "presencial"))
  expect_identical(vapply(c1, `[[`, 1L, "ronda"), 1:3)
  # Quitar el telefónico de los canales apaga el switch aunque viniera encendido.
  u <- .monitoreo_normalize_model_units(list(list(id = "x", phone = list(enabled = TRUE),
                                                  canales = list(list(ronda = 1L, canal = "correo")))))
  expect_false(u[[1]]$phone$enabled)
})

test_that("el Planner lee los canales declarados para abrir campañas", {
  s <- list(monitoreo_config = list(monitoreo_profile = list(units = .monitoreo_normalize_model_units(list(
    list(id = "egresados", canales = list(list(ronda = 1L, canal = "correo"), list(ronda = 2L, canal = "telefonico")))
  )))))
  expect_setequal(.planner_canales_del_modelo(s), c("correo", "telefonica"))
})

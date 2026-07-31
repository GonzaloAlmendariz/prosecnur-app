# Decisión 7 del goal visual: la autodetección debe avisar cuando no mapea.
#
# El defecto que estos tests fijan no es el fallback vacío —ese al menos se ve
# vacío— sino el silencioso: `pick()` cae a un nombre real de instrumento y la
# config queda con una columna que la base no tiene. Se ve completa y produce
# «S/D» en todas las filas.

test_that("una base que usa los alias previstos no deja pendientes", {
  data <- data.frame(
    `Core/M5_district` = "ATE", `Core/M8_ump` = "UMP 1", codigo_pulso = "P1",
    `_geolocation` = "0 0", consent = "si", `Core/E1_age` = 30,
    `Core/E2_sex` = "F", `_status` = "submitted", `_uuid` = "u1",
    `_submitted_by` = "enc1", `_submission_time` = "2026-07-31", total_time = 600,
    check.names = FALSE, stringsAsFactors = FALSE
  )
  cfg <- monitoreo_territorial_default_config(data)
  expect_equal(length(monitoreo_territorial_mapeo_pendiente(cfg, data)), 0L)
  expect_true(monitoreo_territorial_mapeo_aviso(cfg, data)$ok)
})

test_that("una variable sin ningún alias reconocible se reporta como sin mapear", {
  # Instrumento que escribe el sexo con un nombre que no casa con ningún alias.
  # OJO con elegir el fixture: `pick()` busca por subcadena, así que
  # «condicion_sexual» SÍ habría casado con el alias «sex».
  data <- data.frame(
    `Core/M5_district` = "ATE", `Core/E1_age` = 30, p_identidad = "F",
    check.names = FALSE, stringsAsFactors = FALSE
  )
  cfg <- monitoreo_territorial_default_config(data)
  pendientes <- monitoreo_territorial_mapeo_pendiente(cfg, data)
  sexo <- Filter(function(p) p$campo == "sex_var", pendientes)
  expect_equal(length(sexo), 1L)
  expect_equal(sexo[[1]]$motivo, "sin_mapear")
  expect_equal(sexo[[1]]$etiqueta, "Sexo")
})

test_that("el caso silencioso se reporta: la config apunta a una columna que no existe", {
  # `age_var` cae a `Core/E1_age` aunque la base no lo tenga. La config se ve
  # completa y la columna sale S/D en todas las filas: es el defecto que el
  # fallback vacío NO habría delatado.
  # «anios_cumplidos» no contiene «edad» ni «age», así que ningún alias casa.
  data <- data.frame(
    `Core/M5_district` = "ATE", anios_cumplidos = 30,
    check.names = FALSE, stringsAsFactors = FALSE
  )
  cfg <- monitoreo_territorial_default_config(data)
  expect_equal(cfg$age_var, "Core/E1_age")
  pendientes <- monitoreo_territorial_mapeo_pendiente(cfg, data)
  edad <- Filter(function(p) p$campo == "age_var", pendientes)
  expect_equal(length(edad), 1L)
  expect_equal(edad[[1]]$motivo, "columna_ausente")
  expect_equal(edad[[1]]$apunta_a, "Core/E1_age")
})

test_that("el aviso nombra cuántas y cuáles, no solo que hay problemas", {
  data <- data.frame(cualquier_columna = 1, check.names = FALSE)
  cfg <- monitoreo_territorial_default_config(data)
  aviso <- monitoreo_territorial_mapeo_aviso(cfg, data)
  expect_false(aviso$ok)
  expect_gt(aviso$n_pendientes, 0L)
  expect_match(aviso$mensaje, "variables de interés sin columna en la base")
  expect_match(aviso$mensaje, "Sexo")
})

test_that("sin base no acusa a nadie", {
  cfg <- monitoreo_territorial_default_config(NULL)
  expect_equal(length(monitoreo_territorial_mapeo_pendiente(cfg, NULL)), 0L)
  expect_true(monitoreo_territorial_mapeo_aviso(cfg, NULL)$ok)
  expect_equal(length(monitoreo_territorial_mapeo_pendiente(cfg, data.frame())), 0L)
})

test_that("pick() casa por subcadena, y eso mapea a columnas que no son la variable", {
  # Tercer modo de fallo, peor que los dos anteriores porque NO deja rastro:
  # el alias «sex» casa con «condicion_sexual» y el mapeo queda apuntando a una
  # columna real que no es la variable buscada. El diagnóstico no puede
  # detectarlo —la columna existe— y por eso este test no exige que avise: fija
  # el comportamiento para que quede visible y documentado.
  data <- data.frame(
    `Core/M5_district` = "ATE", condicion_sexual = "soltero",
    check.names = FALSE, stringsAsFactors = FALSE
  )
  cfg <- monitoreo_territorial_default_config(data)
  expect_equal(cfg$sex_var, "condicion_sexual")
  # Lo que importa no es cuántas quedan pendientes sino que «Sexo» NO esté entre
  # ellas: mapeó a una columna real, así que el diagnóstico la da por buena.
  pendientes <- monitoreo_territorial_mapeo_pendiente(cfg, data)
  expect_equal(length(Filter(function(p) p$campo == "sex_var", pendientes)), 0L)
})

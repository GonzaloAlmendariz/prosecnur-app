test_that("los colores de público se guardan como hex de seis dígitos en minúscula", {
  colores <- prosecnurapp:::.monitoreo_publico_colores(list(
    "Profesores" = "#A1B2C3",
    "Administrativos" = "#0f0",
    "Egresados" = "rojo",
    " " = "#123456",
    "Estudiantes" = NA_character_
  ))
  expect_identical(colores, list(Profesores = "#a1b2c3", Administrativos = "#00ff00"))
})

test_that("sin colores la lista sale vacía y con nombres, para que el JSON sea un objeto", {
  vacio <- prosecnurapp:::.monitoreo_publico_colores(NULL)
  expect_length(vacio, 0L)
  expect_identical(names(vacio), character(0))
  expect_identical(as.character(jsonlite::toJSON(vacio, auto_unbox = TRUE)), "{}")
  expect_length(prosecnurapp:::.monitoreo_publico_colores(list("#fff")), 0L)
})

test_that("la configuración de monitoreo conserva los colores elegidos", {
  config <- prosecnurapp:::monitoreo_normalize_config(list(publico_colores = list("Profesores" = "#B45309")))
  expect_identical(config$publico_colores, list(Profesores = "#b45309"))
  expect_length(prosecnurapp:::monitoreo_normalize_config(list())$publico_colores, 0L)
})

test_that("los colores sobreviven la ida y vuelta por JSON y se pueden borrar", {
  # Lo que hace la API: normaliza, sirve con serializer_unboxed_json y el cliente
  # devuelve la config entera, que .monitoreo_parse_body lee con simplifyVector = FALSE.
  ida_y_vuelta <- function(cfg) {
    jsonlite::fromJSON(as.character(jsonlite::toJSON(cfg, auto_unbox = TRUE, null = "null")), simplifyVector = FALSE)
  }
  cfg <- prosecnurapp:::monitoreo_normalize_config(list(publico_colores = list("Estudiantes de pregrado" = "#1F6F8B")))
  vuelta <- ida_y_vuelta(cfg)
  otra <- prosecnurapp:::monitoreo_normalize_config(vuelta, previous_config = cfg)
  expect_identical(otra$publico_colores, list("Estudiantes de pregrado" = "#1f6f8b"))

  # Borrar el último color: el cliente manda {} y no vuelve el color anterior.
  vuelta$publico_colores <- stats::setNames(list(), character(0))
  vacia <- prosecnurapp:::monitoreo_normalize_config(ida_y_vuelta(vuelta), previous_config = cfg)
  expect_length(vacia$publico_colores, 0L)

  # Sin la clave en el cuerpo, se conservan los colores guardados.
  vuelta$publico_colores <- NULL
  sin_clave <- prosecnurapp:::monitoreo_normalize_config(vuelta, previous_config = cfg)
  expect_identical(sin_clave$publico_colores, list("Estudiantes de pregrado" = "#1f6f8b"))

  # Y el .pulso guarda la config en state.rds: lo que entra, sale.
  ruta <- tempfile(fileext = ".rds")
  saveRDS(list(config = otra), ruta)
  expect_identical(readRDS(ruta)$config$publico_colores, otra$publico_colores)
})

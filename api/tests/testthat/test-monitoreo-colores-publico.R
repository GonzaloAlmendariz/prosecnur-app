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

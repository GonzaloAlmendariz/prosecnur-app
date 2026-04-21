test_that("resolver_modalidad_enumeradores respeta precedencia fn > columna > reglas > default", {
  df <- tibble::tibble(
    enumerador = c("Ana", "Luis", "Mia", "Omar"),
    servicio = c("ULE", "UPSEP", "ULE", "CIAM"),
    distrito = c("Ate", "Ate", "Rimac", "Lima"),
    modalidad_col = c("Presencial", "Telefónica", NA, "Presencial")
  )

  reglas <- list(
    list(modalidad = "Telefónica", servicio = "ULE", distrito = c("Ate", "Rimac")),
    list(modalidad = "Telefónica", servicio = "UPSEP", distrito = "Ate")
  )

  out_fn <- prosecnur:::resolver_modalidad_enumeradores(
    data = df,
    col_modalidad = "modalidad_col",
    modalidad_reglas = reglas,
    modalidad_fn = function(x) rep("Custom", nrow(x)),
    modalidad_default = "Presencial"
  )
  expect_identical(unique(out_fn), "Custom")

  out_col <- prosecnur:::resolver_modalidad_enumeradores(
    data = df,
    col_modalidad = "modalidad_col",
    modalidad_reglas = reglas,
    modalidad_default = "Presencial"
  )
  expect_identical(out_col, c("Presencial", "Telefónica", "Presencial", "Presencial"))

  out_reglas <- prosecnur:::resolver_modalidad_enumeradores(
    data = df,
    modalidad_reglas = reglas,
    modalidad_default = "Presencial"
  )
  expect_identical(out_reglas, c("Telefónica", "Telefónica", "Telefónica", "Presencial"))
})

test_that("resolver_modalidad_enumeradores cubre escenarios de una o dos modalidades", {
  df <- tibble::tibble(
    enumerador = c("A", "B", "C"),
    servicio = c("ULE", "ULE", "CIAM"),
    distrito = c("Ate", "Rimac", "Lima")
  )

  reglas_dos <- list(
    list(modalidad = "Telefónica", servicio = "ULE", distrito = c("Ate", "Rimac"))
  )
  out_dos <- prosecnur:::resolver_modalidad_enumeradores(
    data = df,
    modalidad_reglas = reglas_dos,
    modalidad_default = "Presencial"
  )
  expect_setequal(unique(out_dos), c("Telefónica", "Presencial"))

  out_una <- prosecnur:::resolver_modalidad_enumeradores(
    data = df,
    modalidad_reglas = NULL,
    modalidad_default = "Presencial"
  )
  expect_identical(unique(out_una), "Presencial")
})


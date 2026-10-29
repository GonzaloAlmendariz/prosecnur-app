# ADR 0119 §3: cada capa declara el año de su dato, separado de la fecha en que se obtuvo.

test_that("el NSE GeoPeru declara 2017 como año del dato, no la fecha de descarga", {
  manifest <- jsonlite::read_json(hojas_ruta_nse_inei_manifest_path(), simplifyVector = TRUE)
  expect_identical(as.integer(manifest$anio_dato), 2017L)
  expect_match(manifest$descargado, "^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
  expect_true(as.integer(substr(manifest$descargado, 1L, 4L)) >= manifest$anio_dato)

  meta <- .hojas_ruta_nse_meta(load_data = FALSE)
  expect_identical(meta$year, 2017L)
})

test_that("un manifiesto sin anio_dato no cae en un año de descarga", {
  path <- withr::local_tempfile(fileext = ".json")
  jsonlite::write_json(list(source = "x"), path, auto_unbox = TRUE)
  local_mocked_bindings(hojas_ruta_nse_inei_manifest_path = function() path)
  expect_identical(.hojas_ruta_nse_meta(load_data = FALSE)$year, 2017L)
})

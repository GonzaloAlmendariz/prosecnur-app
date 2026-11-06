# La cartografía de manzanas se dice por ciudad, no la de Lima para todos (checklist de coordinación, 2 nov 2026).

test_that("cada provincia trae su cartografía, una vez, y la que no tiene se dice", {
  c <- hojas_ruta_cartografia_de_ciudad(c("040101", "040102", "150101", "070101", "x"))
  expect_identical(vapply(c, `[[`, "", "provincia"), c("0401", "1501", "0701"))
  aqp <- c[[1]]
  expect_true(aqp$disponible)
  expect_identical(aqp$anio, 2017L)
  expect_match(aqp$cobertura, "AREQUIPA")
  expect_identical(c[[3]]$anio, 2019L)  # Callao
  expect_length(hojas_ruta_cartografia_de_ciudad(character(0)), 0L)
  local_mocked_bindings(.hojas_ruta_cartografia_profile_for_ubigeo = function(u) NULL)
  expect_false(hojas_ruta_cartografia_de_ciudad("250101")[[1]]$disponible)
})

# =============================================================================
# Una fijada adoptada del Sheets es del MISMO aplicador que la oferta
# =============================================================================
#
# Medido en CCSS Perfil 2026-II el 2026-09-23: la disponibilidad guarda
# «CHAMORRO RODRIGUEZ, ROSA ALEJANDRINA» y la fijada adoptada del Sheets de
# distribución vuelve como «Chamorro Rodriguez, Rosa Alejandrina». La equidad del
# reparto listaba diez aplicadores para cinco personas y no podía balancear.

test_that("la clave de comparación ignora mayúsculas, tildes y espacios", {
  expect_identical(.ana_clave("CHÁVEZ ESPINOZA , ALONDRA CRISTINA"),
                   .ana_clave("Chavez Espinoza, Alondra Cristina"))
  expect_false(identical(.ana_clave("Simon Cosme, Jhonny"), .ana_clave("Uribe Olaechea, Jesus")))
})

test_that("la fijada pasa a llevar el nombre de la oferta, y un externo queda como viene", {
  oferta <- c("CHAMORRO RODRIGUEZ, ROSA ALEJANDRINA", "URIBE OLAECHEA, JESÚS RAMIRO")
  fij <- list(`CH 1` = "Chamorro Rodriguez, Rosa Alejandrina",
              `CH 2` = "Uribe Olaechea, Jesus Ramiro",
              `CH 3` = "Persona Externa, Otra")
  out <- .marep_fijadas_a_la_oferta(fij, oferta)
  expect_identical(out[["CH 1"]], oferta[[1]])
  expect_identical(out[["CH 2"]], oferta[[2]])
  expect_identical(out[["CH 3"]], "Persona Externa, Otra")
})

test_that("un nombre vacío no empareja con nada", {
  expect_identical(.ana_clave(""), "")
  out <- .marep_fijadas_a_la_oferta(list(`CH 1` = "  "), c("", "URIBE, JESUS"))
  expect_identical(out[["CH 1"]], "  ")
})

test_that("el aviso de fijaciones cambiadas no confunde una tilde con un cambio", {
  out <- monitoreo_aulas_fijaciones_desfasadas(
    list(`CH 1` = "URIBE OLAECHEA, JESÚS RAMIRO"),
    list(`CH 1` = "Uribe Olaechea, Jesus Ramiro"))
  expect_length(out$cambiadas, 0L)
})

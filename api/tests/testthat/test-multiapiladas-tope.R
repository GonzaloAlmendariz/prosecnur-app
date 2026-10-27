# M1 (checklist-histograma-serie-antetitulo-2026-10-14.md): una multiapilada lleva a lo más seis barras.

test_that("el tope es seis y el techo del plan es el mismo", {
  expect_identical(.MULTIAPILADAS_MAX_BARRAS, 6L)
  expect_identical(.PARTICION_MAX_BARRAS, .MULTIAPILADAS_MAX_BARRAS)
})

test_that("una multiapilada de siete barras avisa con la cifra y lo que hay que hacer; una de seis no", {
  avisos <- character()
  withCallingHandlers(.multiapiladas_aviso_tope(18L),
                      message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") })
  expect_length(avisos, 1L)
  expect_match(avisos, "18 barras y el máximo es 6: divídela en láminas de hasta 6 barras", fixed = TRUE)
  expect_silent(expect_false(.multiapiladas_aviso_tope(6L)))
})

test_that("seis barras que se pasan por poco del alto útil no se parten en «(cont.)»", {
  withr::local_options(prosecnur.grosor_piso_cm = 0)   # la tolerancia 1,15 es del camino sin piso (con piso, E3: se parte)
  premisas <- lapply(1:3, function(k) list(texto = paste("Tema", k), filas = list(list(i = 1L), list(i = 2L))))
  alto <- function(ps) 1.6 * length(ps)                                  # 4.8 in para seis barras: 6 % más que 4.52
  expect_length(.lam_escala_partir(premisas, disponible = 4.52, alto_fn = alto), 1L)
  # Siete barras sí se parten.
  premisas7 <- c(premisas, list(list(texto = "Tema 4", filas = list(list(i = 1L)))))
  expect_gt(length(.lam_escala_partir(premisas7, disponible = 4.52, alto_fn = alto)), 1L)
})

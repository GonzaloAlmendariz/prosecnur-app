# EL META-GUARD del backend: un guard que deja de encontrar su objeto se queda
# en verde para siempre.
#
# El gemelo de `frontend/src/app/guardsQueGuardan.contract.test.ts`. La forma es
# la misma: el guard enumera `api/R` con `list.files()`, recorre lo que encuentra
# y afirma una vez por archivo —o afirma que la lista de culpables está vacía—.
# Si el patrón deja de casar, el bucle no itera, **no se ejecuta una sola
# aserción** y el test pasa. No hay rojo, no hay aviso: sólo deja de proteger.
#
# Medido el 2026-09-12: de los 9 guards de R que enumeran `api/R`, 6 ya llevaban
# centinela y 1 no lo necesitaba —`surveymonkey-family` enumera dentro de un
# XLSX y su `if (!length(files))` es deliberado—. El único real,
# `test-graficos-negrita-render.R`, se arregló en el mismo commit. El tope es
# CERO y no se sube: en R la clase está cerrada y así se queda.

test_that("ningun guard de R enumera api/R sin comprobar que encontro algo", {
  dir_tests <- testthat::test_path(".")
  suites <- list.files(dir_tests, pattern = "^test-.*\\.R$", full.names = TRUE)
  # Si el barrido del propio meta-guard enmudece, el meta-guard no guarda nada.
  expect_gt(length(suites), 50L)

  culpables <- character(0)
  for (ruta in suites) {
    src <- paste(readLines(ruta, warn = FALSE), collapse = "\n")
    # Enumera las fuentes del paquete Y las lee.
    enumera <- grepl('list.files(file.path("..", "..", "R")', src, fixed = TRUE) ||
      grepl('list.files(testthat::test_path("..", "..", "R")', src, fixed = TRUE)
    if (!enumera || !grepl("readLines", src, fixed = TRUE)) next
    # El centinela, en cualquiera de sus formas.
    tiene <- grepl("expect_gt\\(|expect_gte\\(|expect_true\\(length\\(", src)
    if (!tiene) culpables <- c(culpables, basename(ruta))
  }

  expect_identical(
    culpables, character(0),
    info = paste0(
      "Estos guards enumeran api/R y afirman dentro del bucle, pero no comprueban ",
      "haber encontrado nada: si el patron deja de casar, no se ejecuta una sola ",
      "asercion y pasan en verde. La vacuna es una linea —expect_gt(length(x), N)—: ",
      paste(culpables, collapse = ", ")
    )
  )
})

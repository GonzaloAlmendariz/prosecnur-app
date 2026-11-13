# Ubigeos y zonas con ceros a la izquierda, iguales en macOS, Linux y Windows.
# sprintf("%06s", x) rellena con ceros sólo en macOS; en Linux (CI de 0.10.0) "70101" quedaba " 70101" y Callao
# salía del marco, de las cuotas y del tamaño de muestra.

test_that(".pulso_ceros_izq rellena con ceros sin depender de la libc", {
  expect_identical(.pulso_ceros_izq(6L, "70101"), "070101")
  expect_identical(.pulso_ceros_izq(6L, 70101L), "070101")
  expect_identical(.pulso_ceros_izq(5L, c("1", "00012", "123456")), c("00001", "00012", "123456"))
  expect_identical(.pulso_ceros_izq(6L, ""), "000000")
  expect_identical(.pulso_ceros_izq(6L, NA), "0000NA")
  expect_identical(.pulso_ceros_izq(6L, character()), character())
})

test_that("el paquete no rellena códigos con sprintf('%0Ns'), que en Linux y Windows pone espacios", {
  raiz <- testthat::test_path("..", "..", "R")
  skip_if_not(dir.exists(raiz), "sin las fuentes del paquete junto a los tests")
  hallazgos <- character()
  for (f in list.files(raiz, pattern = "[.]R$", full.names = TRUE)) {
    lineas <- readLines(f, warn = FALSE, encoding = "UTF-8")
    codigo <- sub("#.*$", "", lineas)
    hit <- grep('sprintf\\(\\s*"[^"]*%0[0-9]+s', codigo, perl = TRUE)
    if (length(hit)) hallazgos <- c(hallazgos, paste0(basename(f), ":", hit))
  }
  expect_identical(hallazgos, character(), info = "usa .pulso_ceros_izq(ancho, x)")
})

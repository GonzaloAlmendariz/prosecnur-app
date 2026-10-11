cats_de <- function(etq, cod = as.character(seq_along(etq))) {
  data.frame(codigo = cod, etiqueta = etq, residual = grepl(.CATEGORIAS_RESIDUALES, etq, ignore.case = TRUE), stringsAsFactors = FALSE)
}

test_that("un rango de edades recodificado en el orden de aparición sale de menor a mayor", {
  cats <- cats_de(c("De 30 a 35 años", "De 22 a 25 años", "De 26 a 29 años", "De 36 años a más"), c("3", "1", "2", "4"))
  expect_identical(.goc_orden_codigos(cats, "instrumento")$codigos, c("1", "2", "3", "4"))
})

test_that("un orden decreciente deliberado y los rótulos sin cifra se respetan", {
  desc <- cats_de(c("De 51 años a más", "De 41 a 50 años", "De 31 a 40 años", "De 18 a 30 años"))
  expect_identical(.goc_orden_codigos(desc, "instrumento")$codigos, c("1", "2", "3", "4"))
  mixto <- cats_de(c("0 meses", "Menos de 2 meses", "No he encontrado trabajo", "Entre 2 y 6 meses"))
  expect_identical(.goc_orden_codigos(mixto, "instrumento")$codigos, c("1", "2", "3", "4"))
  # Frecuencia no se toca.
  expect_identical(.goc_orden_codigos(cats_de(c("De 30 a 35", "De 22 a 25", "De 26 a 29")), "frecuencia", n = c(5, 9, 1))$codigos, c("2", "1", "3"))
})

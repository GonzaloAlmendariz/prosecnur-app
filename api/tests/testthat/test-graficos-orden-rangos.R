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

test_that("rangos con unidades distintas (minutos y horas) no se reordenan por su primer número (G5, CCSS 2026)", {
  # B2 `tiempo_llegada`: el primer número es 30, 30, 1, 1, 2; ordenarlo daba 3, 4, 5, 1, 2.
  b2 <- cats_de(c("Menos de 30 minutos", "Entre 30 minutos y 1 hora", "Entre 1 hora y 1 hora y media",
                  "Entre 1 hora y media y 2 horas", "Más de 2 horas"))
  expect_identical(.goc_orden_codigos(b2, "instrumento")$codigos, c("1", "2", "3", "4", "5"))
  # La misma unidad en singular y plural no cuenta como otra unidad.
  meses <- cats_de(c("De 7 a 12 meses", "1 mes", "De 2 a 6 meses"), c("3", "1", "2"))
  expect_identical(.goc_orden_codigos(meses, "instrumento")$codigos, c("1", "2", "3"))
})

test_that("un rótulo sin unidad («36 a más») no apaga la heurística entre rótulos con «años»", {
  cats <- cats_de(c("De 30 a 35 años", "De 22 a 25 años", "De 26 a 29 años", "36 a más"), c("3", "1", "2", "4"))
  expect_identical(.goc_orden_codigos(cats, "instrumento")$codigos, c("1", "2", "3", "4"))
})

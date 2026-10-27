source("setup-load-all.R")

# Trinquete de colores (checklist-recetario-desfase-2026-10-26.md, P8; ADR 0092, «manda el JSON»). En el código del motor
# de entregables cada literal hex es un token de estandar_pulso.json o una excepción declarada, con su motivo, en
# fixtures/hex_fuera_del_estandar.csv. Un color nuevo fuera del estándar falla aquí: o se lee del JSON (.std_color,
# .std_paleta) o se agrega a la lista diciendo por qué. Una excepción que ya no existe también falla: se borra de la lista.

test_that("ningún color nuevo fuera del estándar en el motor de entregables, y la lista de excepciones está al día", {
  dir_r <- testthat::test_path("..", "..", "R")
  json <- testthat::test_path("..", "..", "inst", "estandar", "estandar_pulso.json")
  skip_if_not(dir.exists(dir_r) && file.exists(json), "fuentes fuera del árbol (paquete instalado)")
  actual <- .hex_fuera_del_estandar(dir_r, json)
  lista <- utils::read.csv(testthat::test_path("fixtures", "hex_fuera_del_estandar.csv"), stringsAsFactors = FALSE, encoding = "UTF-8")
  expect_true(all(nzchar(lista$motivo)))
  clave <- function(d) paste(d$archivo, d$hex)
  expect_identical(setdiff(clave(actual), clave(lista)), character(0), label = "colores nuevos fuera del estándar")
  expect_identical(setdiff(clave(lista), clave(actual)), character(0), label = "excepciones que ya no existen")
})

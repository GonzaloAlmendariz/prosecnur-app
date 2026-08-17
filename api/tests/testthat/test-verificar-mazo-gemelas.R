.gem <- function(lamina, firma, grosor) {
  list(lamina = as.integer(lamina), firma = firma, grosor = grosor)
}


test_that("dos laminas de la misma firma con distinto grosor se marcan", {
  # Es el eje de P16 —«dos laminas del mismo tipo no salen iguales»— y ninguna
  # regla lo medía: B3 mira DENTRO de una lamina y no ve que la de al lado saque
  # otro grosor.
  out <- .verif_gemelas_desiguales(list(
    .gem(1, "6", 1.057),
    .gem(2, "6", 1.354)
  ))
  expect_equal(nrow(out), 1L)
  expect_equal(out$dif, 0.297, tolerance = 1e-6)
  expect_equal(out$laminas, "1, 2")
})


test_that("una lamina sin gemela no se compara con nadie", {
  # Sin otra de su firma no hay nada que decir: marcarla seria inventarse un
  # patron a partir de un solo caso.
  out <- .verif_gemelas_desiguales(list(
    .gem(1, "6", 1.05),
    .gem(2, "3", 2.49)
  ))
  expect_equal(nrow(out), 0L)
})


test_that("la firma distingue el reparto, no solo el total", {
  # Una lamina con un grafico de cinco barras y otra con dos graficos de dos y
  # tres NO son gemelas aunque sumen parecido: el reparto de alto es otro.
  out <- .verif_gemelas_desiguales(list(
    .gem(1, "5", 1.00),
    .gem(2, "2-3", 1.90)
  ))
  expect_equal(nrow(out), 0L)
})


test_that("la firma sale ordenada para que dos laminas iguales coincidan", {
  # `.verif_grosores_de_lamina()` ordena las barras antes de pegar la firma: sin
  # eso, «2-3» y «3-2» serian grupos distintos y dos laminas gemelas no se
  # encontrarian nunca.
  formas <- list()
  g1 <- list(list(n = 3L, grosor = 0.5), list(n = 2L, grosor = 0.5))
  g2 <- list(list(n = 2L, grosor = 0.5), list(n = 3L, grosor = 0.5))
  firma <- function(gr) paste(sort(vapply(gr, function(g) g$n, integer(1))),
                              collapse = "-")
  expect_equal(firma(g1), firma(g2))
})


test_that("una lamina sin barras no entra en ningun grupo", {
  # Portadas, indices y fichas tecnicas no tienen grosor del que hablar.
  expect_equal(nrow(.verif_gemelas_desiguales(list(NULL, NULL))), 0L)
  expect_equal(nrow(.verif_gemelas_desiguales(list())), 0L)
})


test_that("tres gemelas se juzgan por el rango, no por pares", {
  # Lo que importa es cuanto se separan la mayor y la menor del grupo entero.
  out <- .verif_gemelas_desiguales(list(
    .gem(1, "3", 1.654),
    .gem(2, "3", 2.017),
    .gem(3, "3", 2.492)
  ))
  expect_equal(nrow(out), 1L)
  expect_equal(out$dif, 0.838, tolerance = 1e-6)
})


test_that("la firma separa paletas: un radar no es gemelo de una apilada", {
  # Cada familia declara su propio alto de fila —el preset da 0.54 in a
  # apiladas, 0.58 a multi-apiladas y 0.64 a agrupadas— y la barra es una
  # fraccion de ese alto, asi que dos familias tienen distinto grosor POR
  # DISENO. La primera version de la firma contaba solo barras y metia cinco
  # multi-apiladas junto a un radar en el grupo de «6», marcando como defecto
  # esa diferencia.
  out <- .verif_gemelas_desiguales(list(
    .gem(1, "rampa:6", 1.057),
    .gem(2, "azul:6",  1.354)
  ))
  expect_equal(nrow(out), 0L)
})


test_that("dentro de la misma paleta si se comparan", {
  out <- .verif_gemelas_desiguales(list(
    .gem(1, "rampa:4", 1.05),
    .gem(2, "rampa:4", 1.90)
  ))
  expect_equal(nrow(out), 1L)
})

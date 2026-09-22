# El aviso de huérfanas dice la CAUSA, no sólo el hecho.
#
# Medido el 2026-09-22 (primer día de campo de CCSS Perfil 2026-II): 19
# huérfanas de 29 respuestas, y eran dos averías distintas —11 abiertas por
# enlace, sin recopilador, y 8 del QR de «CAPACITACION»/«PRUEBA»— metidas en un
# solo número. Cada una se arregla en un sitio distinto, así que el número solo
# no sirve para actuar.

test_that("sin huerfanas la frase afirma lo que se comprobo", {
  c0 <- monitoreo_aulas_huerfanas_causa(c(FALSE, FALSE), c("a1", "a2"))
  expect_identical(c0$total, 0L)
  expect_match(c0$frase, "Todas las respuestas válidas se atribuyeron")
})

test_that("las dos causas se cuentan por separado y los valores ajenos se nombran", {
  h <- c(TRUE, TRUE, TRUE, FALSE)
  ids <- c("", "CAPACITACION", "PRUEBA", "a1")
  d <- monitoreo_aulas_huerfanas_causa(h, ids)
  expect_identical(d$total, 3L)
  expect_identical(d$sin_recopilador, 1L)
  expect_identical(d$ajenas, 2L)
  expect_identical(d$valores, c("CAPACITACION", "PRUEBA"))
  expect_match(d$frase, "1 no trae recopilador")
  expect_match(d$frase, "2 traen uno que no es de ninguna aula del plan")
  # El valor concreto es lo que hace accionable el aviso: con él se declara en
  # `descartes` en un minuto, sin él se manda a revisar el plan, que está bien.
  expect_match(d$frase, "CAPACITACION, PRUEBA", fixed = TRUE)
})

test_that("una sola causa no arrastra la otra en cero", {
  solo_sin <- monitoreo_aulas_huerfanas_causa(c(TRUE, TRUE), c("", ""))
  expect_match(solo_sin$frase, "2 no traen recopilador")
  expect_false(grepl("no es de ninguna aula", solo_sin$frase))
  solo_ajenas <- monitoreo_aulas_huerfanas_causa(c(TRUE), c("ZZ"))
  expect_match(solo_ajenas$frase, "1 trae uno que no es de ninguna aula")
  expect_false(grepl("no trae recopilador", solo_ajenas$frase))
})

test_that("con muchos valores ajenos se nombran unos pocos y se dice cuantos faltan", {
  d <- monitoreo_aulas_huerfanas_causa(rep(TRUE, 5), c("a", "b", "c", "d", "e"))
  expect_match(d$frase, "y 2 más", fixed = TRUE)
})

test_that("sin identificadores alineados NO se inventa el reparto", {
  # La regla es la del bloque de avance: lo que no se midió no se publica como
  # cero. Un reparto inventado manda a arreglar la avería equivocada.
  d <- monitoreo_aulas_huerfanas_causa(c(TRUE, TRUE), character(0))
  expect_identical(d$total, 2L)
  expect_true(is.na(d$sin_recopilador))
  expect_match(d$frase, "^2 respuestas válidas no corresponden")
  expect_false(grepl("recopilador:", d$frase))
})

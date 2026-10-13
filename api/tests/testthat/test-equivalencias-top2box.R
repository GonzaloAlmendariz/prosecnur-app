# D3 (mazo de Arte y Diseño, 2026-10-12): la matriz encendía el Top Two Box en «¿Cuál es su género?» y en escalas sin
# categorías declaradas; el motor omitía la columna con un aviso en siete láminas.

test_that("una escala de acuerdo o satisfacción declara sus dos categorías más favorables", {
  acuerdo <- "1=Totalmente en desacuerdo|2=En desacuerdo|3=De acuerdo|4=Totalmente de acuerdo|99=SIN INF"
  expect_identical(.gpe_top2box_etiquetas(acuerdo), c("De acuerdo", "Totalmente de acuerdo"))
  satis <- "1=Muy insatisfecho|2=Insatisfecho|3=Satisfecho|4=Muy satisfecho|99=SIN INF"
  expect_identical(.gpe_top2box_etiquetas(satis), c("Satisfecho", "Muy satisfecho"))
})

test_that("una pregunta nominal de cuatro opciones no tiene Top Two Box", {
  genero <- "1=Masculino|2=Femenino|3=Prefiero no responder|4=Otro (especifique)"
  expect_identical(.gpe_top2box_etiquetas(genero), character(0))
  expect_false(.gpe_admite_top2box(genero))
})

test_that("Sí/No y escalas de siete no tienen Top Two Box", {
  expect_identical(.gpe_top2box_etiquetas("1=Sí|2=No"), character(0))
  siete <- paste0(1:7, "=", c("Nada", "Muy poco", "Poco", "Algo", "Bastante", "Mucho", "Muchísimo"), collapse = "|")
  expect_identical(.gpe_top2box_etiquetas(siete), character(0))
})

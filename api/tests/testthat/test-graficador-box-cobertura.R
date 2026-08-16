# Un box que abarca la escala entera no informa: 100 % por construcción.

.eg <- c(pct_1 = "En desacuerdo", pct_2 = "De acuerdo", pct_3 = "Muy de acuerdo")
.cp <- c("pct_1", "pct_2", "pct_3")

test_that("selecciona las columnas ignorando mayusculas y tildes", {
  expect_setequal(
    .box_cols_desde_etiquetas(c("de acuerdo", "MUY DE ACUERDO"), .eg, .cp),
    c("pct_2", "pct_3")
  )
  # «Sí» declarado sin tilde debe seguir emparejando. En macOS
  # `iconv(to = "ASCII//TRANSLIT")` devuelve `S'I` y esto fallaba en silencio
  # mientras pasaba en el Linux del CI.
  eg <- c(a = "Sí", b = "No")
  expect_identical(.box_cols_desde_etiquetas("SI", eg, c("a", "b")), "a")
  expect_identical(.box_norm_etiqueta("Educación"), "EDUCACION")
  expect_identical(.box_norm_etiqueta("Sí"), "SI")
})

test_that("un box que suma dos de tres no cubre la escala", {
  expect_false(.box_cubre_escala_completa(c("De acuerdo", "Muy de acuerdo"), .eg, .cp))
})

test_that("un box que suma las dos de una escala de dos la cubre", {
  eg <- c(pct_1 = "Sí", pct_2 = "No")
  cp <- c("pct_1", "pct_2")
  expect_true(.box_cubre_escala_completa(c("Sí", "No"), eg, cp))
})

test_that("una escala de dos donde solo se declara una NO se apaga", {
  # `c("Sí")` sobre Sí/No es un subconjunto legítimo: mide algo real.
  eg <- c(pct_1 = "Sí", pct_2 = "No")
  expect_false(.box_cubre_escala_completa("Sí", eg, c("pct_1", "pct_2")))
})

test_that("etiquetas que no emparejan con nada no cuentan como cobertura", {
  # Sin coincidencias el box no suma nada; apagarlo aquí escondería el
  # problema real, que es que las etiquetas están mal escritas.
  expect_false(.box_cubre_escala_completa(c("Satisfecho"), .eg, .cp))
  expect_false(.box_cubre_escala_completa(NULL, .eg, .cp))
  expect_false(.box_cubre_escala_completa(character(0), .eg, .cp))
})

test_that("sin columnas de porcentaje no hay cobertura que evaluar", {
  expect_false(.box_cubre_escala_completa("Sí", .eg, character(0)))
})

# --- la decisión completa -----------------------------------------------------

test_that("con declaracion que empareja parte de la escala, se dibuja", {
  d <- .box_decidir(c("De acuerdo", "Muy de acuerdo"), .eg, .cp, 3L)
  expect_true(d$dibujar)
  expect_setequal(d$cols, c("pct_2", "pct_3"))
  expect_identical(d$motivo, "declarado")
})

test_that("una declaracion que no empareja nada NO cae al reparto posicional", {
  # El caso de la herencia: «De acuerdo / Muy de acuerdo» sobre una pregunta
  # Sí/No. Antes caía a «las dos últimas», que sobre una escala de dos son las
  # dos, y la columna salía al 100 % en todas las filas.
  eg <- c(pct_1 = "Sí", pct_2 = "No")
  d <- .box_decidir(c("De acuerdo", "Muy de acuerdo"), eg, c("pct_1", "pct_2"), 3L)
  expect_false(d$dibujar)
  expect_identical(d$motivo, "no_empareja")
})

test_that("una declaracion que cubre la escala entera no se dibuja", {
  eg <- c(pct_1 = "Sí", pct_2 = "No")
  d <- .box_decidir(c("Sí", "No"), eg, c("pct_1", "pct_2"), 3L)
  expect_false(d$dibujar)
  expect_identical(d$motivo, "cubre_escala")
})

test_that("sin declaracion no se dibuja, y el motivo dice si hay algo que hacer", {
  # Escala larga: falta declarar, y eso es accionable.
  expect_identical(.box_decidir(NULL, .eg, .cp, 3L)$motivo, "sin_declaracion")
  # Escala de dos: no hay nada que declarar que informe.
  eg <- c(pct_1 = "Sí", pct_2 = "No")
  expect_identical(.box_decidir(NULL, eg, c("pct_1", "pct_2"), 3L)$motivo, "escala_corta")
  expect_false(.box_decidir(NULL, .eg, .cp, 3L)$dibujar)
})

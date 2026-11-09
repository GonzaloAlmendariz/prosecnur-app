source("setup-load-all.R")

# P14 (lead, 2026-11-09): el motor no crea láminas y el pie no promete una que no existe. `continuar_desde` (entero,
# desde 1, en el orden de la regla) hace que la lámina muestre las filas desde esa posición. Fixture: helper-tope-espacio-arte.R.

.cd_el <- function(desde = NULL) p_barras_divergentes(vars = c("estudiantes$*", "docentes$*"), n_negativas = 2, incluir_neutro = FALSE,
                                                      estilo = "resumen", regla = list(tipo = "bajo_umbral", umbral = 60), continuar_desde = desde)

test_that("sin continuar_desde el pie dice cuántas siguen, sin prometer otra lámina", {
  r <- .regla_preguntas_de_elemento(.cd_el(), .tea_fuentes())
  expect_match(r$evaluacion$texto, "^Se muestran las 20 más bajas de las 22 bajo 60%, de 23 preguntas de escala; las 2 siguientes no caben en esta lámina\\.")
  expect_false(grepl("otra lámina", r$evaluacion$texto, fixed = TRUE))
  expect_identical(.tope_espacio_siguientes(1L), "; la siguiente no cabe en esta lámina.")
  expect_identical(.tope_espacio_siguientes(0L), ".")
})

test_that("con continuar_desde la escala muestra desde esa posición, en el orden de la regla, y el pie lo dice", {
  src <- .tea_fuentes()
  r1 <- .regla_preguntas_de_elemento(.cd_el(), src)
  r <- .regla_preguntas_de_elemento(.cd_el(21), src)
  # Las dos que la primera lámina dejó fuera (las 21.ª y 22.ª más bajas), y ninguna de las que ya mostró.
  expect_length(r$vars, 2L)
  expect_setequal(r$vars, c("estudiantes$p24_2", "docentes$p30_3"))
  expect_length(intersect(r$vars, r1$vars), 0L)
  expect_match(r$evaluacion$texto, "^Se muestran de la 21 a la 22 de las 22 bajo 60%, de 23 preguntas de escala\\.")
  # Desde la 11: de la 11 a la 22 (caben las 12).
  r11 <- .regla_preguntas_de_elemento(.cd_el(11), src)
  expect_length(r11$vars, 12L)
  expect_match(r11$evaluacion$texto, "^Se muestran de la 11 a la 22 de las 22 bajo 60%")
  # El conteo dice lo mismo.
  k <- .regla_preguntas_conteo("p_barras_divergentes", list(vars = list("estudiantes$*", "docentes$*"), n_negativas = 2, incluir_neutro = FALSE,
                                                            estilo = "resumen", regla = list(tipo = "bajo_umbral", umbral = 60), continuar_desde = 21), src)
  expect_setequal(unlist(k$seleccionadas), c("estudiantes$p24_2", "docentes$p30_3"))
})

test_that("el contraste continúa por la mayor diferencia absoluta y el arg se valida", {
  temas <- sprintf("Tema %02d", 1:40)
  dif <- c(seq(40, 2, length.out = 39), -50)
  d <- data.frame(eje = factor(rep(temas, 2), levels = temas), grupo = factor(rep(c("A", "B"), each = 40), levels = c("A", "B")),
                  valor = c(50 + dif / 2, 50 - dif / 2), stringsAsFactors = FALSE)
  r <- suppressMessages(.contraste_tope_espacio(d, desde = 15L))
  expect_length(unique(as.character(r$datos$eje)), 14L)
  expect_false("Tema 40" %in% r$datos$eje)                       # la de mayor diferencia ya salió en la primera
  expect_identical(r$texto, "Se muestran de la 15 a la 28 de mayor diferencia de 40; las 12 siguientes no caben en esta lámina.")
  expect_null(p_dumbbell(vars = list(T = c("a$p", "b$p")), corte = "4", continuar_desde = 1)$continuar_desde)
  expect_identical(p_dumbbell(vars = list(T = c("a$p", "b$p")), corte = "4", continuar_desde = 15)$continuar_desde, 15L)
  for (malo in list(0, -2, 2.5, "x")) expect_error(p_barras_divergentes(vars = "a$p", continuar_desde = malo), "continuar_desde")
  expect_error(.regla_preguntas_de_elemento(.cd_el(30), .tea_fuentes()), "continuar_desde")
})

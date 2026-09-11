# «OBTENIDAS POR SEXO» decía el código crudo de la plataforma.
#
# Gonzalo, 2026-09-10, con el Sheets vivo delante: la misma fila del Plan del día
# decía «ESPERADAS POR SEXO: F 11 · M 11» y al lado «OBTENIDAS POR SEXO:
# 1 20 · 2 14». Las esperadas las reparte el motor de cuotas, que ya habla en
# letras; las obtenidas las cuenta `monitoreo_aulas_efectivas_por_sexo()`, que
# nombra sus grupos con los valores TAL COMO LLEGAN —lo correcto para un motor,
# que no debe inventar etiquetas—. La traducción es cosa de quien pinta.

cfg_sexo <- list(source_mapping = list(
  sex_female_values = list("1"), sex_male_values = list("2")))

test_that("el código de la plataforma se dice con la letra del resto del libro", {
  v <- c(`1` = 20, `2` = 14)
  expect_identical(prosecnurapp:::.capd_por_sexo(v, cfg_sexo), "F 20 · M 14")
})

test_that("sin mapeo declarado se muestra el valor tal cual, no una letra inventada", {
  # Adivinar que «1» es mujer porque suele serlo es exactamente cómo se cuela un
  # dato al revés en un informe.
  v <- c(`1` = 20, `2` = 14)
  expect_identical(prosecnurapp:::.capd_por_sexo(v), "1 20 · 2 14")
  expect_identical(prosecnurapp:::.capd_por_sexo(v, list(source_mapping = list())),
                   "1 20 · 2 14")
})

test_that("un valor fuera del mapeo se respeta, y «Sin declarar» también", {
  # Una respuesta sin sexo es un dato del campo, no un hueco a esconder.
  v <- c(`1` = 3, `Sin declarar` = 2, `9` = 1)
  expect_identical(prosecnurapp:::.capd_por_sexo(v, cfg_sexo),
                   "F 3 · Sin declarar 2 · 9 1")
})

test_that("el mapeo no distingue mayúsculas ni espacios", {
  # El estudio pudo declarar «f» minúscula o con un espacio pegado.
  cfg <- list(source_mapping = list(
    sex_female_values = list(" f "), sex_male_values = list("M")))
  expect_identical(prosecnurapp:::.capd_por_sexo(c(`F` = 4, `m` = 6), cfg), "F 4 · M 6")
})

test_that("la hoja del Plan del día recibe el mapeo y lo usa", {
  # La guarda de la cadena entera: que el parámetro llegue hasta la celda.
  u <- list(list(operational_code = "CH 1", faculty = "DERECHO",
                 scheduled_date = "2026-09-10", scheduled_time = "10:00",
                 course_name = "X", teacher = "Y", eligible_n = 40,
                 sample_status = "agendada"))
  hoja <- aulas_libro_hoja_plan_dia(
    u, efectivas_sexo = list(`CH 1` = c(`1` = 7, `2` = 5)), cfg = cfg_sexo)
  celdas <- unlist(lapply(hoja, function(r) as.character(unlist(r))), use.names = FALSE)
  expect_true(any(celdas == "F 7 · M 5"))
  expect_false(any(celdas == "1 7 · 2 5"))
})

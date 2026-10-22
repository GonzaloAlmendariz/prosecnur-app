# La edad declarada `text` con regex de dígitos y los `calculate` 0/1 salen numéricos
# en el SPSS (HSyVbG 2026, decisión de Gonzalo 2026-10-22).

test_that("regex de sólo dígitos se reconoce y uno con letras no", {
  expect_true(.bases_regex_solo_digitos("regex(., '^(1[89]|[2-9][0-9])$')"))
  expect_true(.bases_regex_solo_digitos("regex(.,'^\\d{8}$')"))
  expect_false(.bases_regex_solo_digitos("regex(., '^[A-Z]{2}[0-9]+$')"))
  expect_false(.bases_regex_solo_digitos(". > 17"))
  expect_false(.bases_regex_solo_digitos(NA))
})

test_that("edad text con regex de dígitos y calculate 0/1 pasan a numéricos; un text libre no", {
  inst <- list(survey = data.frame(
    name = c("P1", "indice", "nombre", "codigo"),
    type = c("text", "calculate", "text", "calculate"),
    constraint = c("regex(., '^(1[89]|[2-9][0-9])$')", "", "", ""),
    stringsAsFactors = FALSE))
  df <- data.frame(P1 = c("18", "21", NA), indice = c("1", "0", "1"),
                   nombre = c("12", "30", "41"), codigo = c("A1", "2", "3"), stringsAsFactors = FALSE)
  out <- .bases_coerce_spss_types(df, inst)
  expect_true(is.numeric(out$P1)); expect_identical(out$P1, c(18, 21, NA))
  expect_true(is.numeric(out$indice))
  expect_true(is.character(out$nombre))   # text sin regex numérica: se respeta
  expect_true(is.character(out$codigo))   # calculate con un valor no numérico: no se toca
})

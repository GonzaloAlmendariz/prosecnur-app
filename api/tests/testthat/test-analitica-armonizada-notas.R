# La base de cada pregunta del comparativo sale de la variable de la medición
# dueña de las notas, no de un código homónimo de otro año (HSyVbG 2026-10-22).

test_that("un código de otro año no toma la base de la pregunta homónima de la base activa", {
  fila <- function(id, vars) list(fila = list(id = id, variables = vars), claves = c(id, unlist(vars)))
  ap <- list(preguntas = list(
    fila("VR-01", list(`2024` = "P11", `2025` = "P11", `2026` = "P12")),   # VbG alguna vez
    fila("S-11", list(`2024` = "tipo_disc", `2025` = "P10", `2026` = "P11")),  # tipo de discapacidad
    fila("HR-02", list(`2024` = "P34", `2025` = "P34", `2026` = "P35"))))
  notas <- list(base_defecto = "total de encuestados", base_por_pregunta = list(
    P11 = "quienes cuentan con un certificado oficial",
    P35 = "quienes declararon haber experimentado hostigamiento sexual",
    `HR-09` = "declarada por id"))
  out <- .armz_notas_de_la_base(notas, ap, "2026")$base_por_pregunta
  expect_identical(out[["S-11"]], "quienes cuentan con un certificado oficial")
  expect_null(out[["VR-01"]])
  expect_identical(out[["HR-02"]], "quienes declararon haber experimentado hostigamiento sexual")
  expect_identical(out[["HR-09"]], "declarada por id")
  expect_false(any(c("P11", "P35") %in% names(out)))
  # El pie del comparativo, con las notas ya resueltas: VR-01 cae en la base por defecto.
  q <- list(claves = ap$preguntas[[1]]$claves, base_texto = "")
  expect_identical(.comparativo_base(c(notas[c("base_defecto")], list(base_por_pregunta = out)), q),
                   "total de encuestados")
  expect_identical(.comparativo_base(notas, q), "quienes cuentan con un certificado oficial")  # el defecto
})

test_that("sin base activa o sin bases por pregunta las notas pasan intactas", {
  notas <- list(base_por_pregunta = list(P1 = "x"))
  expect_identical(.armz_notas_de_la_base(notas, list(preguntas = list()), "2026"), notas)
  expect_identical(.armz_notas_de_la_base(notas, list(preguntas = list(list(claves = "A"))), NULL), notas)
})

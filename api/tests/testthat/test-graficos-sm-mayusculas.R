# Regresión G1 (CCSS Perfil 2026-II): Gráficos perdía toda select_multiple graficada por su madre original.
#
# `reporte_data` deja las dummies en minúscula (`a9.1`) y Gráficos sólo realineaba las de `_recod`, así que A9 y B1
# salían del mazo con «no se encuentra en data ni se detectaron dummies». Analítica las recasea con
# `.analitica_restore_survey_case`; Gráficos tiene que ver las mismas columnas.

inst_sm <- list(
  survey = data.frame(
    type = c("select_multiple lst_a9", "select_one lst_b2", "select_multiple lst_a12_recod"),
    name = c("A9", "B2", "A12_recod"),
    stringsAsFactors = FALSE
  )
)
data_sm <- data.frame(
  a9.1 = c(1, 0, 1), a9.2 = c(0, 1, 1), b2 = c(1, 2, 3), a12_recod.3 = c(1, 1, 0),
  check.names = FALSE
)

test_that("Gráficos recasea las dummies de una SM original como Analítica", {
  src <- prosecnurapp:::.graficos_align_recoded_dummy_sources(
    list(data_sources = list(default = data_sm), inst_sources = list(default = inst_sm))
  )
  got <- names(src$data_sources$default)
  expect_true(all(c("A9.1", "A9.2", "B2", "A12_recod.3") %in% got))
  # Contrato: para la misma base, Analítica y Gráficos ven las mismas columnas.
  expect_identical(got, names(prosecnurapp:::.analitica_restore_survey_case(data_sm, inst_sm)))
})

test_that("con las dummies recaseadas, la frecuencia de la SM madre se calcula", {
  src <- prosecnurapp:::.graficos_align_recoded_dummy_sources(
    list(data_sources = list(default = data_sm), inst_sources = list(default = inst_sm))
  )
  d <- src$data_sources$default
  expect_equal(colSums(d[, c("A9.1", "A9.2")]), c(A9.1 = 2, A9.2 = 2))
})

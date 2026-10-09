# =============================================================================
# Un guardado parcial del mapeo no se lleva por delante lo que no nombra
# =============================================================================
#
# `monitoreo_aulas_normalize_config()` siembra sus `defaults` con el mapeo
# ANTERIOR, así que un `POST` que trae sólo parte del mapeo conserva el resto.
# Los escalares ya lo hacían; `descartes` caía a `list()` pelada —la misma
# trampa que la línea de arriba describe para los valores de sexo, dejada viva—.
#
# Medido el 2026-09-22 en CCSS Perfil 2026-II: al declarar el criterio de
# encuesta efectiva, `descartes` pasó de dos valores a cero sin que nada lo
# dijera, y con ellos los QR de «CAPACITACION» y «PRUEBA» volvían a contar como
# operativo. La UI no lo sufría porque envía el mapeo entero; cualquier otro
# llamador sí, y el silencio es el problema.

.mmp_previo <- function() monitoreo_aulas_normalize_config(list(
  enabled = TRUE,
  source_mapping = list(
    collector_var = "collectorID",
    student_code_var = "cod_pucp",
    sex_var = "A3",
    sex_female_values = list("1"),
    sex_male_values = list("2"),
    consent_var = "consentimiento_informado/acepta_participar",
    descartes = list(list(var = "collectorID", values = list("CAPACITACION", "PRUEBA"))),
    valid_filters = list(list(var = "A9", values = list("1")))
  )
))

test_that("declarar SOLO el criterio conserva los descartes", {
  antes <- .mmp_previo()
  despues <- monitoreo_aulas_normalize_config(
    list(source_mapping = list(
      valid_filters = list(list(var = "acepta", values = list("1"))))),
    previous = antes)
  expect_identical(length(despues$source_mapping$descartes), 1L)
  expect_identical(despues$source_mapping$descartes[[1]]$var, "collectorID")
  expect_identical(
    unlist(despues$source_mapping$descartes[[1]]$values),
    c("CAPACITACION", "PRUEBA"))
  # Y lo que SÍ venía en el body manda, claro.
  expect_identical(despues$source_mapping$valid_filters[[1]]$var, "acepta")
})

test_that("declarar SOLO los descartes conserva el criterio", {
  # La simetría: `valid_filters` tenía el mismo agujero por el otro lado.
  antes <- .mmp_previo()
  despues <- monitoreo_aulas_normalize_config(
    list(source_mapping = list(
      descartes = list(list(var = "collectorID", values = list("INTERNO"))))),
    previous = antes)
  expect_identical(despues$source_mapping$valid_filters[[1]]$var, "A9")
  expect_identical(unlist(despues$source_mapping$descartes[[1]]$values), "INTERNO")
})

test_that("un body sin mapeo no toca nada del mapeo", {
  antes <- .mmp_previo()
  despues <- monitoreo_aulas_normalize_config(list(enabled = TRUE), previous = antes)
  expect_identical(despues$source_mapping, antes$source_mapping)
})

test_that("`consent_var` esta en la whitelist: sin eso, declararlo no persiste", {
  antes <- .mmp_previo()
  expect_identical(antes$source_mapping$consent_var,
                   "consentimiento_informado/acepta_participar")
  despues <- monitoreo_aulas_normalize_config(
    list(source_mapping = list(sex_var = "A3")), previous = antes)
  expect_identical(despues$source_mapping$consent_var,
                   "consentimiento_informado/acepta_participar")
})

test_that("sin previo los campos nacen vacios, no con valores de otro estudio", {
  limpio <- monitoreo_aulas_normalize_config(list(enabled = TRUE))
  expect_identical(limpio$source_mapping$descartes, list())
  expect_identical(limpio$source_mapping$valid_filters, list())
  expect_identical(limpio$source_mapping$consent_var, "")
})

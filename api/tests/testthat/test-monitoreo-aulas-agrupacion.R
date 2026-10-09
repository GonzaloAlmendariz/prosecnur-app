# =============================================================================
# Por qué dimensión se agrupa el resumen operativo
# =============================================================================
#
# Gonzalo, 2026-09-22, mirando el primer bloque de Avance en el día uno de campo
# de CCSS Perfil 2026-II —una sola fila, «CIENCIAS SOCIALES · 10 efectivas»—:
# «¿no sería por carrera en vez de por facultad para este caso?». El estudio
# vive dentro de una facultad, así que ese bloque cae en el mismo caso
# degenerado que motivó el eje declarable.
#
# **No es el eje de cuotas.** La cuota de CCSS es por NIVEL y se resuelve por
# PERSONA; este bloque cuenta AULAS planificadas y aplicadas, así que su valor
# tiene que salir de la fila del plan. Las dos declaraciones conviven.

.maag_plan <- function() list(
  list(operational_code = "CH 1", classroom_id = "a1", faculty = "CIENCIAS SOCIALES",
       program = "ECONOMÍA", level = "6", sample_role = "titular"),
  list(operational_code = "CH 2", classroom_id = "a2", faculty = "CIENCIAS SOCIALES",
       program = "ECONOMÍA", level = "7", sample_role = "titular"),
  list(operational_code = "CH 3", classroom_id = "a3", faculty = "CIENCIAS SOCIALES",
       program = "SOCIOLOGÍA", level = "6", sample_role = "titular")
)

test_that("sin declaracion se agrupa por facultad, byte a byte como antes", {
  agr <- monitoreo_aulas_agrupacion(list())
  expect_identical(agr$clave, "facultad")
  expect_identical(agr$columna, "faculty")
  expect_identical(agr$motivo_degradacion, "")
  out <- monitoreo_aulas_aulas_por_facultad(.maag_plan(), cfg = list())
  expect_identical(length(out), 1L)
  expect_identical(out[[1]]$facultad, "CIENCIAS SOCIALES")
  expect_identical(out[[1]]$planificadas, 3L)
})

test_that("declarada carrera, el mismo plan se reparte en sus carreras", {
  cfg <- list(aulas_universitarias = list(agrupacion_operativa = "carrera"))
  agr <- monitoreo_aulas_agrupacion(cfg)
  expect_identical(agr$clave, "carrera")
  expect_identical(agr$columna, "program")
  out <- monitoreo_aulas_aulas_por_facultad(.maag_plan(), cfg = cfg)
  nombres <- vapply(out, function(x) x$facultad, character(1))
  expect_identical(nombres, c("ECONOMÍA", "SOCIOLOGÍA"))
  planificadas <- stats::setNames(vapply(out, function(x) x$planificadas, integer(1)), nombres)
  expect_identical(unname(planificadas[["ECONOMÍA"]]), 2L)
  expect_identical(unname(planificadas[["SOCIOLOGÍA"]]), 1L)
})

test_that("el desglose de respuestas agrupa por lo MISMO: los dos se cruzan en pantalla", {
  cfg <- list(aulas_universitarias = list(agrupacion_operativa = "carrera"))
  resp <- data.frame(collectorID = c("CH 1", "CH 3"), stringsAsFactors = FALSE)
  local_mocked_bindings(
    .monitoreo_aulas_valid_response = function(...) c(TRUE, TRUE),
    .monitoreo_aulas_descartada = function(...) c(FALSE, FALSE),
    .monitoreo_aulas_response_classroom = function(...) c("CH 1", "CH 3"),
    .package = "prosecnurapp"
  )
  d <- monitoreo_aulas_respuestas_desglose(.maag_plan(), resp, cfg)
  expect_identical(
    vapply(d$facultades, function(f) f$facultad, character(1)),
    c("ECONOMÍA", "SOCIOLOGÍA"))
  # Y la declaración viaja con el bloque: quien publica una cifra dice de qué es.
  expect_identical(d$agrupacion$clave, "carrera")
  expect_identical(d$agrupacion$etiqueta, "Carrera")
  expect_identical(d$agrupacion$etiqueta_plural, "Carreras")
})

test_that("una agrupacion por PERSONA se degrada a facultad, y dice por que", {
  # El bloque cuenta aulas: agruparlo por nivel publicaría el nivel MODAL del
  # aula bajo un rótulo que promete el de cada quien. Se degrada y se declara;
  # no se publica una cifra que no significa lo que su rótulo dice.
  agr <- monitoreo_aulas_agrupacion(list(aulas_universitarias = list(agrupacion_operativa = "nivel")))
  expect_identical(agr$clave, "facultad")
  expect_match(agr$motivo_degradacion, "se resuelve por persona")
})

test_that("una dimension que no existe se degrada nombrandola, no en silencio", {
  agr <- monitoreo_aulas_agrupacion(list(aulas_universitarias = list(agrupacion_operativa = "sede")))
  expect_identical(agr$clave, "facultad")
  expect_match(agr$motivo_degradacion, "sede")
})

test_that("el eje de cuotas y la agrupacion son decisiones separadas", {
  # CCSS: cuota por nivel, resumen por carrera. Declarar una no mueve la otra.
  cfg <- list(aulas_universitarias = list(
    eje_cuota = "nivel", agrupacion_operativa = "carrera"))
  expect_identical(monitoreo_aulas_eje(cfg)$clave, "nivel")
  expect_identical(monitoreo_aulas_eje(cfg)$atribucion, "persona")
  expect_identical(monitoreo_aulas_agrupacion(cfg)$clave, "carrera")
  expect_identical(monitoreo_aulas_agrupacion(cfg)$atribucion, "aula")
})

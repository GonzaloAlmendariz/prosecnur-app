# La reparación de caché del perfil acreditación reclasifica como «Fuera de
# base» una efectiva cacheada que cruzó contra la base de OTRO actor. Con
# actores de nombre compuesto («Estudiantes de pregrado») la comparación contra
# cuatro familias fijas daba falso positivo: al reabrir un .pulso, Consultas
# marcaba 449 de 617 efectivas como fuera de base mientras Avance las contaba
# (diagnóstico 2026-10-22, B8).

caso_cache <- function(actor, base_source, id = actor) {
  list(
    response_id = id,
    actor = actor,
    base_source = base_source,
    base_result = "Cruzó",
    base_record = "Fila base 1",
    decision = "Incluido en avance",
    advancement = "effective",
    issue_type = "efectiva_real",
    date = "2026-10-27",
    channel = "Correo",
    source_label = "SurveyMonkey",
    collector_name = "web"
  )
}

test_that("un actor compuesto que cruzó con su propia base no se reclasifica", {
  iq <- list(cases = list(
    caso_cache("Estudiantes de pregrado", "Universo · Estudiantes de pregrado", "r1"),
    caso_cache("Estudiantes de posgrado CENTRUM", "Universo · Estudiantes de posgrado CENTRUM", "r2"),
    caso_cache("Docentes Campus", "Universo · Docentes Campus", "r3"),
    caso_cache("Administrativos", "Universo · Administrativos", "r4")
  ))
  out <- .monitoreo_acreditacion_repair_internal_queries(iq)
  expect_identical(vapply(out$cases, function(x) x$base_result, ""), rep("Cruzó", 4))
  expect_null(out$cache_repair)
})

test_that("una efectiva que cruzó contra la base de otro actor compuesto sí se reclasifica", {
  iq <- list(cases = list(
    caso_cache("Estudiantes de pregrado", "Universo · Estudiantes de posgrado Campus", "r1"),
    caso_cache("Estudiantes de posgrado Campus", "Universo · Estudiantes de posgrado Campus", "r2")
  ))
  out <- .monitoreo_acreditacion_repair_internal_queries(iq)
  expect_identical(out$cases[[1]]$base_result, "Fuera de base")
  expect_identical(out$cases[[1]]$advancement, "excluded")
  expect_identical(out$cases[[2]]$base_result, "Cruzó")
  expect_identical(out$cache_repair$cross_actor_effectives_reclassified, 1L)
})

test_that("sin actor conocido en la etiqueta, la familia sigue delatando otro actor", {
  iq <- list(cases = list(
    caso_cache("Egresados", "Universo · Estudiantes", "r1")
  ))
  out <- .monitoreo_acreditacion_repair_internal_queries(iq)
  expect_identical(out$cases[[1]]$base_result, "Fuera de base")

  iq_mismo <- list(cases = list(caso_cache("Estudiantes de pregrado", "Hoja estudiantes 2026", "r1")))
  out_mismo <- .monitoreo_acreditacion_repair_internal_queries(iq_mismo)
  expect_identical(out_mismo$cases[[1]]$base_result, "Cruzó")
})

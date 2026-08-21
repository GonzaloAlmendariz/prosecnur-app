# El payload del expediente (ADR 0027) se retiro el 2026-08-16. Los dos helpers
# que componia siguen vivos -los usan project_overview.R y project_pulso.R- y es
# a ellos a quienes apuntan ahora estos tests, en vez de a la composicion.

test_that("el resumen del protocolo lee el estudio sin mutar otros modulos", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "calc_muestra_estudio", list(
    titulo = "Acreditacion profesional",
    contexto = list(cliente = "Facultad"),
    componentes = list(
      list(
        actor = "estudiantes",
        resultado = list(n_objetivo = 120L, n_operativo = 144L)
      )
    )
  ))
  session_set(sid, "monitoreo_sources", list(list(id = "kobo-field", kind = "kobo")))

  protocol <- .diseno_protocol_summary(session_get(sid))

  expect_equal(protocol$title, "Acreditacion profesional")
  expect_equal(protocol$client, "Facultad")
  expect_equal(protocol$sample_target_n, 120L)
  expect_equal(protocol$sample_operational_n, 144L)
  expect_equal(protocol$monitoring_sources_count, 1L)

  statuses <- .diseno_module_statuses(session_get(sid), protocol)
  expect_true(any(vapply(statuses, function(item) item$id == "calc-muestra" && item$state == "ready", logical(1))))
})

test_that("bitacora del diseno se guarda como estado propio del proyecto", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "project_dirty", FALSE)

  entries <- .diseno_bitacora_upsert(sid, list(
    module_id = "validacion",
    tone = "decision",
    title = "Se aprueba regla de consistencia",
    body = "El equipo decide mantener la regla activa para el corte final.",
    tags = list("corte", "calidad")
  ))

  saved <- session_get(sid)
  expect_true(isTRUE(saved$project_dirty))
  expect_equal(length(entries), 1L)
  expect_equal(saved$diseno_estudio_bitacora[[1]]$module_id, "validacion")
  expect_equal(saved$diseno_estudio_bitacora[[1]]$tone, "decision")

  # La lectura vive en el alias canonico /api/bitacora, que devuelve solo las
  # entradas: es lo que consume el modulo.
  expect_equal(length(.diseno_bitacora_entries(saved)), 1L)
})

test_that("el total muestral suma solo el escenario ACTIVO, no las alternativas", {
  # Medido en dos proyectos reales de opinion universitaria: cada uno tiene DOS
  # componentes que son propuestas ALTERNATIVAS del mismo publico —universidad
  # con conglomerado multietapico y facultades con estratificado
  # independiente— y la interfaz hace elegir una. Sumarlas hacia que el home
  # anunciara «n objetivo 7.000» cuando la muestra es 2.500 o 4.500.
  estudio <- list(
    componentes = list(
      list(id = "cmp-a", resultado = list(n_objetivo = 2500, n_operativo = 3750)),
      list(id = "cmp-a-fac", resultado = list(n_objetivo = 4500, n_operativo = 5400))
    ),
    workspace = list(escenarios = list(
      list(id = "total-universidad", component_id = "cmp-a", activo = TRUE),
      list(id = "facultades", component_id = "cmp-a-fac", activo = FALSE)
    ))
  )
  expect_equal(.diseno_calc_total(estudio, "n_objetivo"), 2500L)
  expect_equal(.diseno_calc_total(estudio, "n_operativo"), 3750L)
  expect_equal(.diseno_componentes_activos(estudio), "cmp-a")

  # Cambiar el activo cambia el total: no hay preferencia por el primero.
  estudio$workspace$escenarios[[1]]$activo <- FALSE
  estudio$workspace$escenarios[[2]]$activo <- TRUE
  expect_equal(.diseno_calc_total(estudio, "n_objetivo"), 4500L)
})

test_that("un estudio multiactor SIGUE sumando sus componentes", {
  # Aqui cada componente es un publico distinto y la muestra total si es la
  # suma. Sin escenarios declarados, la conducta de siempre.
  estudio <- list(componentes = list(
    list(id = "est", resultado = list(n_objetivo = 300)),
    list(id = "doc", resultado = list(n_objetivo = 120)),
    list(id = "egr", resultado = list(n_objetivo = 80))
  ))
  expect_equal(.diseno_calc_total(estudio, "n_objetivo"), 500L)
  expect_null(.diseno_componentes_activos(estudio))

  # Y con VARIOS escenarios activos se suman todos ellos.
  estudio$workspace <- list(escenarios = list(
    list(component_id = "est", activo = TRUE),
    list(component_id = "doc", activo = TRUE),
    list(component_id = "egr", activo = FALSE)
  ))
  expect_equal(.diseno_calc_total(estudio, "n_objetivo"), 420L)
})

test_that("sin ningun escenario activo no se anuncia un proyecto sin muestra", {
  # Devolver 0 dejaria el home diciendo que no hay muestra calculada cuando si
  # la hay: ante la duda, la conducta de siempre.
  estudio <- list(
    componentes = list(list(id = "cmp-a", resultado = list(n_objetivo = 2500))),
    workspace = list(escenarios = list(list(component_id = "cmp-a", activo = FALSE)))
  )
  expect_equal(.diseno_calc_total(estudio, "n_objetivo"), 2500L)
  expect_null(.diseno_componentes_activos(estudio))

  # Escenarios sin el campo `activo` (formato anterior): tampoco filtran.
  estudio$workspace$escenarios <- list(list(component_id = "cmp-a"))
  expect_null(.diseno_componentes_activos(estudio))
  expect_equal(.diseno_calc_total(estudio, "n_objetivo"), 2500L)
})

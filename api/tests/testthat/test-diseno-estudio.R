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

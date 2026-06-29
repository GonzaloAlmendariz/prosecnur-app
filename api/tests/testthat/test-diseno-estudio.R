test_that("diseno del estudio compone estado vivo sin mutar otros modulos", {
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

  state <- .diseno_estudio_state_payload(sid)

  expect_true(isTRUE(state$ok))
  expect_equal(state$schema, "diseno_estudio_state_v1")
  expect_equal(state$protocol$title, "Acreditacion profesional")
  expect_equal(state$protocol$client, "Facultad")
  expect_equal(state$protocol$sample_target_n, 120L)
  expect_equal(state$protocol$sample_operational_n, 144L)
  expect_equal(state$protocol$monitoring_sources_count, 1L)
  expect_true(any(vapply(state$sources, function(item) item$id == "calc-muestra" && item$state == "ready", logical(1))))
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

  state <- .diseno_estudio_state_payload(sid)
  expect_equal(length(state$bitacora), 1L)
  expect_true(any(vapply(state$timeline, function(item) item$kind == "manual", logical(1))))
})

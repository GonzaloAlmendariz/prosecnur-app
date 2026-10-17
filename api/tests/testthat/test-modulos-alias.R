# ADR 0108 §1 «Slug persistido» y §5 «Selección»: el módulo Recopiladores pasa a
# `material-campo` y la etapa «entrega» de Hojas de ruta pasa a `seleccion`.
# Ambos viven en estado persistido leído por listas cerradas; estos tests fijan
# que el valor viejo se migra en lectura y no se descarta ni se reasigna.

test_that("el alias resuelve recopiladores y deja intacto lo demás", {
  expect_equal(
    .modulos_alias_aplicar(c("recopiladores", "monitoreo", "inexistente")),
    c("material-campo", "monitoreo", "inexistente")
  )
  expect_equal(.modulos_alias_aplicar(list()), character(0))
  expect_equal(.modulos_alias_aplicar(NULL), character(0))
})

test_that("project_modules persistido con recopiladores conserva material-campo", {
  out <- .project_normalize_modules(list("recopiladores", "monitoreo"))
  expect_equal(unlist(out), c("material-campo", "monitoreo"))
  # Viejo y nuevo juntos no duplican.
  out2 <- .project_normalize_modules(list("recopiladores", "material-campo"))
  expect_equal(unlist(out2), "material-campo")
  expect_true("material-campo" %in% .PROJECT_PRIMARY_SLUGS)
  expect_false("recopiladores" %in% .PROJECT_PRIMARY_SLUGS)

  # Round-trip por la sesión: lo que lee el overview es el slug vigente.
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "project_modules", list("recopiladores", "monitoreo"))
  overview <- .project_overview_payload(sid)
  expect_equal(sort(unlist(overview$added_modules)), c("material-campo", "monitoreo"))
})

test_that("una entrada de bitácora con module_id recopiladores pasa a material-campo", {
  entry <- .diseno_bitacora_entry(list(id = "e1", title = "Fichas", module_id = "recopiladores"))
  expect_equal(entry$module_id, "material-campo")
  # Un módulo desconocido sigue cayendo a diseno-estudio.
  otra <- .diseno_bitacora_entry(list(id = "e2", title = "X", module_id = "no-existe"))
  expect_equal(otra$module_id, "diseno-estudio")
  # El filtro por módulo acepta el slug viejo.
  expect_true(.bit_entrada_calza(entry, list(modulos = list("recopiladores"))))
  expect_true(.bit_entrada_calza(entry, list(modulos = list("material-campo"))))
})

test_that("el status del módulo y el resumen del manifest usan material-campo", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  protocol <- .diseno_protocol_summary(s)
  statuses <- .diseno_module_statuses(s, protocol)
  ids <- vapply(statuses, function(item) item$id, character(1))
  expect_true("material-campo" %in% ids)
  expect_false("recopiladores" %in% ids)
  item <- statuses[[which(ids == "material-campo")]]
  expect_equal(item$label, "Material de campo")
  expect_equal(item$route, "/material-campo")

  summary <- .pulso_manifest_modules_summary(s)
  expect_true("material-campo" %in% names(summary$states))
  expect_false("recopiladores" %in% names(summary$states))
})

test_that("la fase Campo lee evidencia de material-campo y el target viejo sigue mapeando", {
  campo <- Filter(function(f) f$id == "campo", .bit_fases_catalogo())[[1]]
  expect_true("material-campo" %in% campo$evidencia)
  expect_false("recopiladores" %in% campo$evidencia)
  expect_equal(unname(.BIT_TARGET_A_FASE[["material-campo"]]), "campo")
  expect_equal(unname(.BIT_TARGET_A_FASE[["recopiladores"]]), "campo")
  expect_true(.bit_modulo_tiene_evidencia(list(calc_muestra_aulas_export = list(x = 1)), "material-campo"))
})

test_that("hojas de ruta migra active_stage entrega a seleccion", {
  vacio <- list(territories = list())
  ui <- .hojas_ruta_ui_state_normalize(list(active_stage = "entrega"), frame_summary = vacio)
  expect_equal(ui$active_stage, "seleccion")
  ui2 <- .hojas_ruta_ui_state_normalize(list(activeStage = "seleccion"), frame_summary = vacio)
  expect_equal(ui2$active_stage, "seleccion")
  # Un stage desconocido sigue cayendo a territorio.
  ui3 <- .hojas_ruta_ui_state_normalize(list(active_stage = "no-existe"), frame_summary = vacio)
  expect_equal(ui3$active_stage, "territorio")
})

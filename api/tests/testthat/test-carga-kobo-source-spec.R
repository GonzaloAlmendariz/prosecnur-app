test_that("KoboSourceSpec conserva metadatos no sensibles de importacion", {
  imported_at <- "2026-06-25T05:00:00Z"
  spec <- .carga_kobo_source_spec(
    asset_uid = "aT5qpJ937NmUro9AzgBXaA",
    base_url = "https://kobo.unhcr.org/",
    profile_id = "unhcr-main",
    detail = list(
      version_id = "v7",
      date_modified = "2026-06-24T12:00:00Z",
      deployment = list(active = TRUE)
    ),
    payload = list(total = 1553L, results = list()),
    inst_meta = list(file_id = "xls-1", path = "/tmp/form.xlsx"),
    data_meta = list(file_id = "data-1", path = "/tmp/data.xlsx"),
    imported_at = imported_at
  )

  expect_equal(spec$asset_uid, "aT5qpJ937NmUro9AzgBXaA")
  expect_equal(spec$base_url, "https://kobo.unhcr.org")
  expect_equal(spec$connection_profile_id, "unhcr-main")
  expect_equal(spec$version_id, "v7")
  expect_true(spec$deployment_active)
  expect_equal(spec$total_remote, 1553L)
  expect_equal(spec$imported_at, imported_at)
  expect_equal(spec$xlsform_file_id, "xls-1")
  expect_equal(spec$data_file_id, "data-1")
  expect_false(any(grepl("token|secret|password", names(spec), ignore.case = TRUE)))
})

test_that("Carga detecta fuente Kobo heredada desde Monitoreo territorial", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$monitoreo_config <- list(
    territorial = list(
      active_route_phase = "field",
      phase_sources = list(
        field = list(
          asset_uid = "aT5qpJ937NmUro9AzgBXaA",
          base_url = "https://kobo.unhcr.org",
          connection_profile_id = "unhcr-main"
        )
      )
    )
  )
  s$monitoreo_kobo_schemas <- list(
    field = list(
      name = "Encuesta de Percepcion de Comunidad de Acogida - Peru 2026 - VF",
      version_id = "v7",
      deployment_active = TRUE
    )
  )
  .session_env[[sid]] <- s

  detected <- .carga_kobo_detected_source(sid)

  expect_true(detected$ok)
  expect_true(detected$detected)
  expect_equal(detected$provider, "kobo")
  expect_equal(detected$phase, "field")
  expect_equal(detected$asset_uid, "aT5qpJ937NmUro9AzgBXaA")
  expect_equal(detected$base_url, "https://kobo.unhcr.org")
  expect_equal(detected$connection_profile_id, "unhcr-main")
  expect_true(detected$deployment_active)
})

test_that("XLSForm de Kobo bilingue elige el label en espanol y no concatena idiomas", {
  detail <- list(
    name = "Encuesta ACNUR",
    content = list(
      translations = list("Spanish (es)", "English (en)"),
      translated = list("label", "hint"),
      survey = list(
        list(type = "select_one", select_from_list_name = "yesno", name = "consent",
             label = list("Si esta de acuerdo, confirmar", "If you agree, confirm")),
        list(type = "text", name = "comentario",
             label = list("Comentario del encuestador", "Interviewer comment"))
      ),
      choices = list(
        list(list_name = "yesno", name = "1", label = list("Si", "Yes")),
        list(list_name = "yesno", name = "0", label = list("No", "No"))
      ),
      settings = list(list(form_title = "ACNUR", form_id = "acnur"))
    )
  )
  m <- .carga_kobo_xlsform_model(detail)
  expect_true(all(grepl("esta de acuerdo|Comentario", m$survey$label)))
  expect_false(any(grepl("If you agree|Interviewer comment", m$survey$label)))
  expect_equal(m$choices$label[m$choices$name == "1"], "Si")
  expect_false(any(grepl("Yes", m$choices$label)))
})

test_that("XLSForm de Kobo monolingue conserva el label sin cambios", {
  detail <- list(content = list(
    translations = list(NULL),
    survey = list(list(type = "text", name = "q1", label = "Solo espanol")),
    choices = list(),
    settings = list(list(form_title = "x", form_id = "x"))
  ))
  m <- .carga_kobo_xlsform_model(detail)
  expect_equal(m$survey$label, "Solo espanol")
})

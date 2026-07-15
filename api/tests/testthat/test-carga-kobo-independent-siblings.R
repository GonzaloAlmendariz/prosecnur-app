library(testthat)

.with_mocked_carga_binding <- function(name, value) {
  target_env <- environment(.carga_import_kobo_independent)
  had_previous <- exists(name, envir = target_env, inherits = FALSE)
  previous <- if (had_previous) get(name, envir = target_env) else NULL
  was_locked <- had_previous && bindingIsLocked(name, target_env)
  if (was_locked) unlockBinding(name, target_env)
  assign(name, value, envir = target_env)
  if (was_locked) lockBinding(name, target_env)

  function() {
    exists_now <- exists(name, envir = target_env, inherits = FALSE)
    is_locked <- exists_now && bindingIsLocked(name, target_env)
    if (is_locked) unlockBinding(name, target_env)
    if (had_previous) {
      assign(name, previous, envir = target_env)
    } else if (exists_now) {
      rm(list = name, envir = target_env)
    }
    if (was_locked && exists(name, envir = target_env, inherits = FALSE)) {
      lockBinding(name, target_env)
    }
  }
}

.kobo_independent_detail <- function(asset_uid) {
  list(
    uid = asset_uid,
    name = paste("Kobo", asset_uid),
    version_id = paste0("v-", asset_uid),
    date_modified = "2026-07-01T12:00:00Z",
    deployment = list(active = TRUE),
    content = list(
      survey = list(
        list(type = "text", name = "codigo_pulso", label = "Código Pulso"),
        list(type = "text", name = "q1", label = "Pregunta 1")
      ),
      choices = list(),
      settings = list(
        list(form_title = paste("Kobo", asset_uid), form_id = paste0("form_", asset_uid), version = "20260701")
      )
    )
  )
}

.kobo_independent_repeat_detail <- function(asset_uid) {
  list(
    uid = asset_uid,
    name = paste("Kobo repeat", asset_uid),
    version_id = paste0("v-repeat-", asset_uid),
    date_modified = "2026-07-01T12:00:00Z",
    deployment = list(active = TRUE),
    content = list(
      survey = list(
        list(type = "text", name = "codigo_pulso", label = "Código Pulso"),
        list(type = "text", name = "testreal", label = "Tipo de entrevista"),
        list(type = "begin_repeat", name = "rep_items", label = "Ítems"),
        list(type = "text", name = "item", label = "Ítem"),
        list(type = "end_repeat", name = "rep_items", label = ""),
        list(type = "text", name = "q1", label = "Pregunta 1")
      ),
      choices = list(),
      settings = list(
        list(form_title = paste("Kobo repeat", asset_uid),
             form_id = paste0("form_repeat_", asset_uid), version = "20260701")
      )
    )
  )
}

test_that("Kobo independent import creates sibling bases without persisting secrets", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  restores <- list(
    .with_mocked_carga_binding(".connections_token_require", function(provider, sid = NULL, profile_id = NULL, base_url = NULL) {
      expect_equal(provider, "kobo")
      expect_match(base_url, "kobo.unhcr.org", fixed = TRUE)
      "local-test-token"
    }),
    .with_mocked_carga_binding(".kobo_api_fetch_json", function(url, token) {
      expect_equal(token, "local-test-token")
      asset_uid <- sub("^.*/assets/([^/]+)/.*$", "\\1", url)
      .kobo_independent_detail(utils::URLdecode(asset_uid))
    }),
    .with_mocked_carga_binding("kobo_api_fetch_all_asset_data", function(asset_uid, token, base_url = NULL) {
      expect_equal(token, "local-test-token")
      list(
        total = 2L,
        results = list(
          list(codigo_pulso = paste0(asset_uid, "-001"), q1 = "Si"),
          list(codigo_pulso = paste0(asset_uid, "-002"), q1 = "No")
        )
      )
    }),
    .with_mocked_carga_binding("kobo_api_flatten_results", function(results) {
      data.frame(
        codigo_pulso = vapply(results, `[[`, character(1), "codigo_pulso"),
        q1 = vapply(results, `[[`, character(1), "q1"),
        stringsAsFactors = FALSE,
        check.names = FALSE
      )
    })
  )
  on.exit(lapply(rev(restores), function(restore) restore()), add = TRUE)

  result <- .carga_import_kobo_independent(sid, list(
    assets = list(
      list(
        asset_uid = "asset_docentes",
        source_alias = "Docentes",
        source_title = "Encuesta Docentes",
        base_url = "https://kobo.unhcr.org",
        connection_profile_id = "kobo-acreditacion"
      ),
      list(
        asset_uid = "asset_estudiantes",
        source_alias = "Estudiantes",
        source_title = "Encuesta Estudiantes",
        base_url = "https://kobo.unhcr.org",
        connection_profile_id = "kobo-acreditacion"
      )
    )
  ))

  expect_true(result$ok)
  expect_equal(result$provider, "kobo")
  expect_equal(result$processing_mode, "independent_siblings")
  expect_equal(result$n_bases, 2L)
  expect_equal(sort(names(result$estudio$bases)), c("docentes", "estudiantes"))
  expect_equal(result$estudio$independent_siblings$status, "kobo_imported_siblings")

  docentes <- result$estudio$bases$docentes
  expect_equal(docentes$source_kind, "kobo_api")
  expect_equal(docentes$survey_id, "asset_docentes")
  expect_equal(docentes$kobo_source_spec$asset_uid, "asset_docentes")
  expect_equal(docentes$kobo_source_spec$connection_profile_id, "kobo-acreditacion")
  expect_equal(docentes$kobo_source_spec$total_remote, 2L)
  expect_false(any(grepl("token|secret|password", names(unlist(docentes$kobo_source_spec, recursive = TRUE)), ignore.case = TRUE)))
})

test_that("Kobo independent refresh replaces saved data without persisting credentials", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  fetch_calls <- 0L
  restores <- list(
    .with_mocked_carga_binding(".connections_token_require", function(provider, sid = NULL, profile_id = NULL, base_url = NULL) {
      expect_equal(provider, "kobo")
      expect_equal(profile_id, "kobo-acreditacion")
      "local-test-token"
    }),
    .with_mocked_carga_binding(".kobo_api_fetch_json", function(url, token) {
      expect_equal(token, "local-test-token")
      .kobo_independent_detail("asset_docentes")
    }),
    .with_mocked_carga_binding("kobo_api_fetch_all_asset_data", function(asset_uid, token, base_url = NULL) {
      expect_equal(asset_uid, "asset_docentes")
      expect_equal(token, "local-test-token")
      fetch_calls <<- fetch_calls + 1L
      rows <- if (fetch_calls == 1L) {
        list(
          list(codigo_pulso = "doc-001", q1 = "Si"),
          list(codigo_pulso = "doc-002", q1 = "No")
        )
      } else {
        list(
          list(codigo_pulso = "doc-001", q1 = "Si"),
          list(codigo_pulso = "doc-002", q1 = "No"),
          list(codigo_pulso = "doc-003", q1 = "Si")
        )
      }
      list(total = length(rows), results = rows)
    }),
    .with_mocked_carga_binding("kobo_api_flatten_results", function(results) {
      data.frame(
        codigo_pulso = vapply(results, `[[`, character(1), "codigo_pulso"),
        q1 = vapply(results, `[[`, character(1), "q1"),
        stringsAsFactors = FALSE,
        check.names = FALSE
      )
    })
  )
  on.exit(lapply(rev(restores), function(restore) restore()), add = TRUE)

  imported <- .carga_import_kobo_independent(sid, list(
    assets = list(list(
      asset_uid = "asset_docentes",
      source_alias = "Docentes",
      source_title = "Encuesta Docentes",
      base_url = "https://kobo.unhcr.org",
      connection_profile_id = "kobo-acreditacion"
    ))
  ))
  expect_true(imported$ok)
  old_base <- session_get(sid)$estudio$bases$docentes
  old_data_file_id <- old_base$data_file_id

  refreshed <- .carga_refresh_kobo_independent(sid, list(base_names = list("docentes")))

  expect_true(refreshed$ok)
  expect_equal(refreshed$n_updated_bases, 1L)
  expect_equal(refreshed$updated_bases, list("docentes"))
  expect_equal(refreshed$results[[1]]$rows_before, 2L)
  expect_equal(refreshed$results[[1]]$rows_after, 3L)

  base <- session_get(sid)$estudio$bases$docentes
  expect_equal(base$n_filas, 3L)
  expect_false(identical(base$data_file_id, old_data_file_id))
  expect_equal(base$kobo_effective_data_file_id, base$data_file_id)
  expect_true(nzchar(base$kobo_refreshed_at))
  expect_equal(base$kobo_last_refresh$rows_before, 2L)
  expect_equal(base$kobo_last_refresh$rows_after, 3L)
  expect_equal(base$kobo_source_spec$total_remote, 3L)
  expect_equal(base$kobo_source_spec$previous_data_file_id, old_data_file_id)
  expect_false(any(grepl("local-test-token", paste(unlist(base, recursive = TRUE, use.names = FALSE), collapse = " "), fixed = TRUE)))

  scoped <- estudio_processing_filter_sources(sid)
  expect_equal(nrow(scoped$data_sources$docentes), 3L)
})

test_that("Kobo refresh reemplaza fuentes repeat antes de reaplicar el filtro de universo", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  fetch_calls <- 0L
  fail_refresh <- FALSE
  blobs <- function(values) {
    vapply(values, function(value) {
      jsonlite::toJSON(list(list(`Grupo/rep_items/item` = value)), auto_unbox = TRUE)
    }, character(1))
  }
  restores <- list(
    .with_mocked_carga_binding(".connections_token_require", function(...) "local-test-token"),
    .with_mocked_carga_binding(".kobo_api_fetch_json", function(url, token) {
      expect_equal(token, "local-test-token")
      .kobo_independent_repeat_detail("asset_repeat")
    }),
    .with_mocked_carga_binding("kobo_api_fetch_all_asset_data", function(asset_uid, token, base_url = NULL) {
      fetch_calls <<- fetch_calls + 1L
      rows <- if (isTRUE(fail_refresh)) {
        list(
          list(codigo_pulso = "doc-004", testreal = "test", q1 = "D", item = "t4")
        )
      } else if (fetch_calls == 1L) {
        list(
          list(codigo_pulso = "doc-001", testreal = "real", q1 = "A", item = "r1"),
          list(codigo_pulso = "doc-002", testreal = "test", q1 = "B", item = "t1")
        )
      } else {
        list(
          list(codigo_pulso = "doc-001", testreal = "real", q1 = "A", item = "r1"),
          list(codigo_pulso = "doc-002", testreal = "test", q1 = "B", item = "t2"),
          list(codigo_pulso = "doc-003", testreal = "real", q1 = "C", item = "r2")
        )
      }
      list(total = length(rows), results = rows)
    }),
    .with_mocked_carga_binding("kobo_api_flatten_results", function(results) {
      data.frame(
        `_id` = seq_along(results),
        codigo_pulso = vapply(results, `[[`, character(1), "codigo_pulso"),
        testreal = vapply(results, `[[`, character(1), "testreal"),
        q1 = vapply(results, `[[`, character(1), "q1"),
        `Grupo/rep_items` = blobs(vapply(results, `[[`, character(1), "item")),
        stringsAsFactors = FALSE,
        check.names = FALSE
      )
    })
  )
  on.exit(lapply(rev(restores), function(restore) restore()), add = TRUE)

  imported <- .carga_import_kobo_independent(sid, list(assets = list(list(
    asset_uid = "asset_repeat",
    source_alias = "Docentes",
    source_title = "Encuesta Docentes",
    base_url = "https://kobo.unhcr.org",
    connection_profile_id = "kobo-acreditacion"
  ))))
  expect_true(imported$ok)
  bases_before <- estudio_list_bases(sid)
  repeat_name <- names(Filter(function(base) {
    identical(base$parent_base %||% "", "docentes") &&
      identical(base$repeat_group %||% "", "rep_items")
  }, bases_before))
  expect_length(repeat_name, 1L)

  carga_universe_filter_apply(sid, "docentes", list(
    version = 1L,
    enabled = TRUE,
    variable = "testreal",
    real_values = list("real"),
    test_values = list("test"),
    missing_policy = "exclude",
    unassigned_policy = "unclassified"
  ))
  filtered_before <- estudio_list_bases(sid)
  old_repeat_source <- filtered_before[[repeat_name]]$universe_filter$source_data_file_id
  old_repeat_effective <- filtered_before[[repeat_name]]$universe_filter$effective_data_file_id
  expect_equal(filtered_before$docentes$n_filas, 1L)
  expect_equal(filtered_before[[repeat_name]]$n_filas, 1L)

  refreshed <- .carga_refresh_kobo_independent(sid, list(base_names = list("docentes")))
  expect_true(refreshed$ok)
  expect_length(refreshed$results[[1]]$repeat_bases, 1L)

  bases_after <- estudio_list_bases(sid)
  parent <- bases_after$docentes
  child <- bases_after[[repeat_name]]
  expect_equal(parent$n_filas, 2L)
  expect_equal(child$n_filas, 2L)
  expect_false(identical(child$universe_filter$source_data_file_id, old_repeat_source))
  expect_false(identical(child$universe_filter$effective_data_file_id, old_repeat_effective))
  expect_false(identical(child$universe_filter$source_data_file_id,
                         child$universe_filter$effective_data_file_id))

  s <- session_get(sid)
  repeat_source <- .cuf_file_df(s, child$universe_filter$source_data_file_id)$data
  repeat_effective <- .cuf_file_df(s, child$universe_filter$effective_data_file_id)$data
  expect_equal(nrow(repeat_source), 3L)
  expect_equal(nrow(repeat_effective), 2L)
  expect_setequal(as.character(repeat_effective$item), c("r1", "r2"))
  expect_false("t2" %in% as.character(repeat_effective$item))

  # Un refresh posterior sin ninguna entrevista real alcanza a generar nuevos
  # uploads, pero la reaplicación debe fallar y restaurar atómicamente padre,
  # repeat, auditoría y caches efectivos anteriores.
  fail_refresh <- TRUE
  before_failure <- session_get(sid)
  expect_error(
    .carga_refresh_kobo_independent(sid, list(base_names = list("docentes"))),
    "no incluye ninguna entrevista real",
    fixed = TRUE
  )
  after_failure <- session_get(sid)
  scoped_names <- c("docentes", repeat_name)
  expect_identical(
    after_failure$estudio$bases[scoped_names],
    before_failure$estudio$bases[scoped_names]
  )
  expect_identical(
    after_failure$rp_data_sources[scoped_names],
    before_failure$rp_data_sources[scoped_names]
  )
  expect_identical(after_failure$rp_data, before_failure$rp_data)
  expect_identical(names(after_failure$files), names(before_failure$files))
})

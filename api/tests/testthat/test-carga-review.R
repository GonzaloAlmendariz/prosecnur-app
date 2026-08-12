# Contrato autoritativo de Carga > Revisión, scopeado por `base_nombre`.
#
# Esta suite fija la frontera de helpers que consumen los endpoints del router:
# el payload agrega compatibilidad, mapeo de alternativas y reconciliación, y
# guardar la reconciliación convierte toda extra en una decisión explícita.

library(testthat)

.cr_xlsform_model <- function() {
  list(
    survey = data.frame(
      type = c("text", "integer"),
      name = c("id", "edad"),
      label = c("Identificador", "Edad"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = character(0),
      name = character(0),
      label = character(0),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    settings = data.frame(
      form_title = "Carga review",
      form_id = "carga_review",
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
}

.cr_data <- function(...) {
  out <- data.frame(
    id = c("r1", "r2", "r3"),
    edad = c(21L, 35L, 42L),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  extras <- list(...)
  for (nm in names(extras)) out[[nm]] <- extras[[nm]]
  out
}

.cr_choice_xlsform_model <- function() {
  list(
    survey = data.frame(
      type = "select_one yesno",
      name = "p1",
      label = "Pregunta",
      list_name = "yesno",
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("yesno", "yesno"),
      name = c("1", "2"),
      label = c("Uno", "Dos"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    settings = data.frame(
      form_title = "Carga review mapping",
      form_id = "carga_review_mapping",
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
}

.cr_choice_maps <- function(first = "1", second = "2") {
  list(list(
    variable = "p1",
    label = "Pregunta",
    type = "select_one",
    list_name = "yesno",
    status = "manual_confirmed",
    high_confidence = TRUE,
    requires_confirmation = FALSE,
    mappings = list(
      list(
        source_code = "C1", source_column = "p1", source_label = "Uno",
        xls_code = first, xls_label = if (identical(first, "1")) "Uno" else "Dos",
        match = "manual_confirmed"
      ),
      list(
        source_code = "C2", source_column = "p1", source_label = "Dos",
        xls_code = second, xls_label = if (identical(second, "2")) "Dos" else "Uno",
        match = "manual_confirmed"
      )
    )
  ))
}

.cr_upload_pair <- function(sid, data, base_nombre = NULL,
                            model = .cr_xlsform_model()) {
  xls_path <- tempfile("carga-review-form-", fileext = ".xlsx")
  data_path <- tempfile("carga-review-data-", fileext = ".xlsx")
  .carga_write_xlsform_model(model, xls_path)
  openxlsx::write.xlsx(data, data_path, overwrite = TRUE)

  xls_meta <- save_upload(
    sid, "xlsform", paste0(base_nombre %||% "legacy", "-form.xlsx"),
    readBin(xls_path, "raw", n = file.info(xls_path)$size)
  )
  data_meta <- save_upload(
    sid, "data", paste0(base_nombre %||% "legacy", "-data.xlsx"),
    readBin(data_path, "raw", n = file.info(data_path)$size)
  )
  inst <- reporte_instrumento(xls_meta$path)
  rp_data <- reporte_data(data, instrumento = inst)

  list(xlsform = xls_meta, data = data_meta, inst = inst, rp_data = rp_data)
}

.cr_store_pair <- function(sid, data, base_nombre = NULL,
                           model = .cr_xlsform_model()) {
  pair <- .cr_upload_pair(sid, data, base_nombre, model)

  if (is.null(base_nombre)) {
    session_set(sid, "rp_inst", pair$inst)
    session_set(sid, "rp_data", pair$rp_data)
  } else {
    estudio_add_base(
      sid = sid,
      nombre = base_nombre,
      xlsform_file_id = pair$xlsform$file_id,
      data_file_id = pair$data$file_id,
      data_ext = "xlsx",
      rp_data = pair$rp_data,
      rp_inst = pair$inst,
      n_filas = nrow(data),
      n_columnas = ncol(data)
    )
  }
  invisible(pair)
}

.cr_store_pending_choice_pair <- function(sid, base_nombre) {
  xls_path <- tempfile("carga-review-map-form-", fileext = ".xlsx")
  data_path <- tempfile("carga-review-map-data-", fileext = ".sav")
  .carga_write_xlsform_model(.cr_choice_xlsform_model(), xls_path)
  raw <- data.frame(
    q0001 = haven::labelled(c(10, 20), labels = c(Uno = 10, Dos = 20)),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  haven::write_sav(raw, data_path)

  xls_meta <- save_upload(
    sid, "xlsform", paste0(base_nombre, "-form.xlsx"),
    readBin(xls_path, "raw", n = file.info(xls_path)$size)
  )
  data_meta <- save_upload(
    sid, "sav", paste0(base_nombre, "-data.sav"),
    readBin(data_path, "raw", n = file.info(data_path)$size)
  )
  inst <- reporte_instrumento(xls_meta$path)
  normalized <- normalize_data_for_xlsform(raw, inst)
  rp_data <- reporte_data(normalized, instrumento = inst)
  estudio_add_base(
    sid,
    base_nombre,
    xls_meta$file_id,
    data_meta$file_id,
    "sav",
    rp_data,
    inst,
    nrow(rp_data),
    ncol(rp_data)
  )
  invisible(list(xlsform = xls_meta, data = data_meta, inst = inst, rp_data = rp_data))
}

.cr_materialize_choice_mapping <- function(sid, base_nombre, maps) {
  s <- session_get(sid)
  s$estudio$bases[[base_nombre]]$choice_code_mapping <- list(
    version = 1L,
    confirmed = TRUE,
    confirmed_at = "2026-07-26T12:00:00Z",
    n_questions = as.integer(length(maps)),
    maps = maps
  )
  .session_env[[sid]] <- s
  invisible(s$estudio$bases[[base_nombre]]$choice_code_mapping)
}

.cr_expect_payload_shape <- function(payload) {
  expect_setequal(
    names(payload),
    # `procedencia` entra con L11 del GOAL de validación extrínseca: avisa que
    # la base trae más de una versión del formulario. Es NULL cuando no hay nada
    # que decir, pero la clave siempre viaja para que el front no adivine.
    c("base_nombre", "compatibility", "choice_mapping", "reconciliation",
      "procedencia", "ready")
  )
  expect_setequal(
    names(payload$reconciliation),
    c(
      "extra", "n_extra", "n_incluidas", "n_excluidas", "n_pendientes",
      "reviewed"
    )
  )
  expect_true(is.list(payload$reconciliation$extra))
  if (length(payload$reconciliation$extra)) {
    expect_setequal(
      names(payload$reconciliation$extra[[1]]),
      c("name", "fill_pct", "n_fill", "kind", "decision")
    )
  }
}

.cr_decisions <- function(payload) {
  stats::setNames(
    vapply(payload$reconciliation$extra, `[[`, character(1), "decision"),
    vapply(payload$reconciliation$extra, `[[`, character(1), "name")
  )
}

test_that("legacy sin estudio exige revisar extras y guardar decide todas", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  .cr_store_pair(
    sid,
    .cr_data(
      extra_keep = c("a", "b", "c"),
      extra_drop = c("x", "y", "z")
    )
  )

  pending <- .carga_review_payload(sid, base_nombre = NULL)

  .cr_expect_payload_shape(pending)
  expect_null(pending$base_nombre)
  expect_true(isTRUE(pending$compatibility$applied))
  expect_true(isTRUE(pending$compatibility$ok))
  expect_identical(pending$compatibility$status, "compatible")
  expect_false(isTRUE(pending$choice_mapping$requires_confirmation))
  expect_equal(pending$reconciliation$n_extra, 2L)
  expect_equal(pending$reconciliation$n_incluidas, 0L)
  expect_equal(pending$reconciliation$n_excluidas, 0L)
  expect_equal(pending$reconciliation$n_pendientes, 2L)
  expect_false(isTRUE(pending$reconciliation$reviewed))
  expect_setequal(unname(.cr_decisions(pending)), rep("pending", 2L))
  expect_false(isTRUE(pending$ready))

  reviewed <- .carga_review_set_reconciliation(
    sid,
    base_nombre = NULL,
    incluidas = "extra_keep"
  )

  expect_equal(.cr_decisions(reviewed)[["extra_keep"]], "include")
  expect_equal(.cr_decisions(reviewed)[["extra_drop"]], "exclude")
  expect_equal(reviewed$reconciliation$n_incluidas, 1L)
  expect_equal(reviewed$reconciliation$n_excluidas, 1L)
  expect_equal(reviewed$reconciliation$n_pendientes, 0L)
  expect_true(isTRUE(reviewed$reconciliation$reviewed))
  expect_true(isTRUE(reviewed$ready))

  cfg <- session_get(sid)$analitica_config
  expect_setequal(unlist(cfg$variables_extra_incluidas), "extra_keep")
  expect_setequal(
    unlist(cfg$variables_extra_revisadas),
    c("extra_keep", "extra_drop")
  )
})

test_that("base pedida gobierna payload y decisión sin cambiar active_base", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_ensure(sid)
  .cr_store_pair(sid, .cr_data(extra_a = c("A1", "A2", "A3")), "A")
  .cr_store_pair(sid, .cr_data(extra_b = c("B1", "B2", "B3")), "B")
  estudio_active_base_set(sid, "B")

  s_before <- session_get(sid)
  s_before$analitica_config_por_base <- list(B = list(marker = "intacta"))
  .session_env[[sid]] <- s_before

  payload_a <- .carga_review_payload(sid, base_nombre = "A")

  expect_identical(payload_a$base_nombre, "A")
  expect_setequal(names(.cr_decisions(payload_a)), "extra_a")
  expect_identical(estudio_active_base(sid), "B")

  reviewed_a <- .carga_review_set_reconciliation(
    sid,
    base_nombre = "A",
    incluidas = "extra_a"
  )

  expect_identical(reviewed_a$base_nombre, "A")
  expect_equal(.cr_decisions(reviewed_a)[["extra_a"]], "include")
  expect_identical(estudio_active_base(sid), "B")

  s_after <- session_get(sid)
  expect_setequal(
    unlist(s_after$estudio$bases$A$variables_extra_incluidas),
    "extra_a"
  )
  expect_setequal(
    unlist(s_after$estudio$bases$A$variables_extra_revisadas),
    "extra_a"
  )
  expect_equal(s_after$analitica_config_por_base$A$variables_extra_incluidas, list("extra_a"))
  expect_equal(s_after$analitica_config_por_base$A$variables_extra_revisadas, list("extra_a"))
  expect_equal(s_after$analitica_config_por_base$B, list(marker = "intacta"))
  expect_null(s_after$estudio$bases$B$variables_extra_incluidas)
  expect_null(s_after$estudio$bases$B$variables_extra_revisadas)
})

test_that("inclusión previa sigue include y las demás extras siguen pending", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  .cr_store_pair(
    sid,
    .cr_data(
      extra_incluida = c("sí", "sí", "sí"),
      extra_nueva = c("n1", "n2", "n3")
    )
  )
  cfg <- .analitica_default_config()
  cfg$variables_extra_incluidas <- list("extra_incluida")
  cfg$variables_extra_revisadas <- NULL
  session_set(sid, "analitica_config", cfg)

  payload <- .carga_review_payload(sid, base_nombre = NULL)
  decisions <- .cr_decisions(payload)

  expect_equal(decisions[["extra_incluida"]], "include")
  expect_equal(decisions[["extra_nueva"]], "pending")
  expect_equal(payload$reconciliation$n_incluidas, 1L)
  expect_equal(payload$reconciliation$n_excluidas, 0L)
  expect_equal(payload$reconciliation$n_pendientes, 1L)
  expect_false(isTRUE(payload$reconciliation$reviewed))
  expect_false(isTRUE(payload$ready))
})

test_that("payload y decisión rechazan una base desconocida", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_ensure(sid)
  .cr_store_pair(sid, .cr_data(extra_a = c("a", "b", "c")), "A")

  payload_error <- tryCatch(
    .carga_review_payload(sid, base_nombre = "desconocida"),
    api_error = function(e) e
  )
  decision_error <- tryCatch(
    .carga_review_set_reconciliation(
      sid,
      base_nombre = "desconocida",
      incluidas = character(0)
    ),
    api_error = function(e) e
  )

  expect_s3_class(payload_error, "api_error")
  expect_equal(payload_error$status, 404)
  expect_equal(payload_error$code, "E_BASE_NOT_FOUND")
  expect_s3_class(decision_error, "api_error")
  expect_equal(decision_error$status, 404)
  expect_equal(decision_error$code, "E_BASE_NOT_FOUND")
})

test_that("normalización explícita aplica el mapping confirmado de cada base", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_ensure(sid)
  raw <- data.frame(p1 = c("C1", "C2"), stringsAsFactors = FALSE)
  .cr_store_pair(sid, raw, "A", .cr_choice_xlsform_model())
  .cr_store_pair(sid, raw, "B", .cr_choice_xlsform_model())
  maps_a <- .cr_choice_maps("1", "2")
  maps_b <- .cr_choice_maps("2", "1")
  .cr_materialize_choice_mapping(sid, "A", maps_a)
  .cr_materialize_choice_mapping(sid, "B", maps_b)
  estudio_active_base_set(sid, "B")

  # Un global incompatible hace observable cualquier cruce accidental.
  session_set(sid, "choice_code_maps_confirmed", list(
    confirmed = TRUE,
    confirmed_at = "2026-07-26T11:00:00Z",
    n_questions = 1L,
    maps = .cr_choice_maps("2", "2")
  ))

  normalized_a <- .carga_normalized_data_for_export(sid, "A")$data
  normalized_b <- .carga_normalized_data_for_export(sid, "B")$data

  expect_identical(as.character(normalized_a$p1), c("1", "2"))
  expect_identical(as.character(normalized_b$p1), c("2", "1"))
  expect_identical(estudio_active_base(sid), "B")
})

test_that("loader de mappings conserva legacy sin estudio", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  legacy_maps <- .cr_choice_maps("2", "1")
  session_set(sid, "choice_code_maps_confirmed", list(
    confirmed = TRUE,
    confirmed_at = "2026-07-26T11:00:00Z",
    n_questions = 1L,
    maps = legacy_maps
  ))

  expect_identical(.pulso_load_choice_maps(sid, base_name = NULL), legacy_maps)
})

test_that("fallback global se materializa solo para una primaria inequívoca", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_ensure(sid)
  .cr_store_pair(sid, .cr_data(), "A")
  legacy_maps <- .cr_choice_maps("1", "2")
  session_set(sid, "choice_code_maps_confirmed", list(
    confirmed = TRUE,
    confirmed_at = "2026-07-26T11:00:00Z",
    n_questions = 1L,
    maps = legacy_maps
  ))

  expect_identical(.pulso_load_choice_maps(sid, base_name = "A"), legacy_maps)
  materialized <- session_get(sid)$estudio$bases$A$choice_code_mapping
  expect_identical(materialized$version, 1L)
  expect_true(isTRUE(materialized$confirmed))
  expect_identical(materialized$maps, legacy_maps)
})

test_that("reabrir un proyecto legacy de una primaria conserva el fallback materializado", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_ensure(sid)
  raw <- data.frame(p1 = c("C1", "C2"), stringsAsFactors = FALSE)
  .cr_store_pair(sid, raw, "A", .cr_choice_xlsform_model())
  legacy_maps <- .cr_choice_maps("1", "2")
  session_set(sid, "choice_code_maps_confirmed", list(
    confirmed = TRUE,
    confirmed_at = "2026-07-26T11:00:00Z",
    n_questions = 1L,
    maps = legacy_maps
  ))

  project_path <- tempfile("carga-review-legacy-mapping-", fileext = ".pulso")
  on.exit(unlink(project_path, force = TRUE), add = TRUE)
  build_pulso(sid, project_path, project_name = "Carga review legacy mapping")
  loaded <- load_pulso(project_path)
  on.exit(session_delete(loaded$session_id), add = TRUE)
  restored <- session_get(loaded$session_id)

  expect_true(isTRUE(restored$project_dirty))
  expect_true(isTRUE(restored$estudio$bases$A$choice_code_mapping$confirmed))
  expect_identical(restored$estudio$bases$A$choice_code_mapping$maps, legacy_maps)
  expect_identical(as.character(restored$rp_data_sources$A$p1), c("1", "2"))
})

test_that("dos primarias sin mapping anidado ignoran el global legacy", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_ensure(sid)
  .cr_store_pair(sid, .cr_data(), "A")
  .cr_store_pair(sid, .cr_data(), "B")
  session_set(sid, "choice_code_maps_confirmed", list(
    confirmed = TRUE,
    confirmed_at = "2026-07-26T11:00:00Z",
    n_questions = 1L,
    maps = .cr_choice_maps("1", "2")
  ))

  expect_length(.pulso_load_choice_maps(sid, base_name = "A"), 0L)
  expect_null(session_get(sid)$estudio$bases$A$choice_code_mapping)
  expect_null(session_get(sid)$estudio$bases$B$choice_code_mapping)
})

test_that("confirmar A materializa su mapping sin mutar B ni active_base", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_ensure(sid)
  .cr_store_pending_choice_pair(sid, "A")
  .cr_store_pending_choice_pair(sid, "B")
  estudio_active_base_set(sid, "B")

  pending_a <- .carga_review_payload(sid, "A")
  pending_b <- .carga_review_payload(sid, "B")
  expect_true(isTRUE(pending_a$choice_mapping$requires_confirmation))
  expect_true(isTRUE(pending_b$choice_mapping$requires_confirmation))
  expect_null(session_get(sid)$estudio$bases$A$choice_code_mapping)
  expect_null(session_get(sid)$estudio$bases$B$choice_code_mapping)

  .carga_review_confirm_choice_mapping(sid, base_nombre = "A")

  s_after <- session_get(sid)
  confirmed_a <- s_after$estudio$bases$A$choice_code_mapping
  expect_identical(confirmed_a$version, 1L)
  expect_true(isTRUE(confirmed_a$confirmed))
  expect_true(is.character(confirmed_a$confirmed_at) && nzchar(confirmed_a$confirmed_at))
  expect_identical(confirmed_a$n_questions, 1L)
  expect_length(confirmed_a$maps, 1L)
  expect_null(s_after$estudio$bases$B$choice_code_mapping)
  expect_identical(estudio_active_base(sid), "B")

  reviewed_a <- .carga_review_payload(sid, "A")
  reviewed_b <- .carga_review_payload(sid, "B")
  expect_false(isTRUE(reviewed_a$choice_mapping$requires_confirmation))
  expect_true(isTRUE(reviewed_b$choice_mapping$requires_confirmation))
})

test_that("confirmación multibase exige base y distingue una desconocida", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_ensure(sid)
  .cr_store_pending_choice_pair(sid, "A")
  .cr_store_pending_choice_pair(sid, "B")

  missing <- tryCatch(
    .carga_review_confirm_choice_mapping(sid, base_nombre = NULL),
    api_error = function(e) e
  )
  unknown <- tryCatch(
    .carga_review_confirm_choice_mapping(sid, base_nombre = "desconocida"),
    api_error = function(e) e
  )

  expect_s3_class(missing, "api_error")
  expect_identical(missing$status, 400)
  expect_identical(missing$code, "E_BASE_REQUIRED")
  expect_s3_class(unknown, "api_error")
  expect_identical(unknown$status, 404)
  expect_identical(unknown$code, "E_BASE_NOT_FOUND")
})

test_that("reemplazar el par invalida solo el mapping de esa base", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_ensure(sid)
  .cr_store_pair(sid, .cr_data(), "A")
  .cr_store_pair(sid, .cr_data(), "B")
  maps_a <- .cr_choice_maps("1", "2")
  maps_b <- .cr_choice_maps("2", "1")
  .cr_materialize_choice_mapping(sid, "A", maps_a)
  .cr_materialize_choice_mapping(sid, "B", maps_b)
  replacement <- .cr_upload_pair(sid, .cr_data(), "A-replacement")

  estudio_replace_base_files(
    sid,
    "A",
    xlsform_file_id = replacement$xlsform$file_id,
    data_file_id = replacement$data$file_id,
    data_ext = "xlsx",
    rp_data = replacement$rp_data,
    rp_inst = replacement$inst,
    n_filas = nrow(replacement$rp_data),
    n_columnas = ncol(replacement$rp_data)
  )

  s_after <- session_get(sid)
  expect_null(s_after$estudio$bases$A$choice_code_mapping)
  expect_identical(s_after$estudio$bases$B$choice_code_mapping$maps, maps_b)
})

test_that("summary agrega solo primarias y bloquea si una base sigue pendiente", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_ensure(sid)
  .cr_store_pair(sid, .cr_data(), "A")
  .cr_store_pair(sid, .cr_data(extra_b = c("x", "y", "z")), "B")
  .cr_store_pair(sid, .cr_data(extra_repeat = c("u", "v", "w")), "rep_items")
  s <- session_get(sid)
  s$estudio$bases$rep_items$parent_base <- "A"
  s$estudio$bases$rep_items$source_kind <- "kobo_repeat"
  .session_env[[sid]] <- s

  summary <- .carga_review_summary_payload(sid)

  expect_setequal(
    names(summary),
    c("bases", "n_bases", "n_ready", "n_blocked", "all_ready")
  )
  expect_identical(summary$n_bases, 2L)
  expect_identical(summary$n_ready, 1L)
  expect_identical(summary$n_blocked, 1L)
  expect_false(isTRUE(summary$all_ready))
  expect_setequal(
    vapply(summary$bases, `[[`, character(1), "base_nombre"),
    c("A", "B")
  )
  expect_true(all(vapply(summary$bases, function(item) {
    setequal(names(item), c("base_nombre", "ready", "blockers"))
  }, logical(1))))
  by_base <- stats::setNames(summary$bases, vapply(
    summary$bases, `[[`, character(1), "base_nombre"
  ))
  expect_true(isTRUE(by_base$A$ready))
  expect_length(by_base$A$blockers, 0L)
  expect_false(isTRUE(by_base$B$ready))
  expect_gt(length(by_base$B$blockers), 0L)
})

test_that("summary vacío nunca declara all_ready", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  summary <- .carga_review_summary_payload(sid)

  expect_identical(summary$n_bases, 0L)
  expect_identical(summary$n_ready, 0L)
  expect_identical(summary$n_blocked, 0L)
  expect_length(summary$bases, 0L)
  expect_false(isTRUE(summary$all_ready))
})

test_that("round-trip y rebuild conservan mappings distintos por base", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_ensure(sid)
  raw <- data.frame(p1 = c("C1", "C2"), stringsAsFactors = FALSE)
  .cr_store_pair(sid, raw, "A", .cr_choice_xlsform_model())
  .cr_store_pair(sid, raw, "B", .cr_choice_xlsform_model())
  maps_a <- .cr_choice_maps("1", "2")
  maps_b <- .cr_choice_maps("2", "1")
  .cr_materialize_choice_mapping(sid, "A", maps_a)
  .cr_materialize_choice_mapping(sid, "B", maps_b)
  session_set(sid, "choice_code_maps_confirmed", list(
    confirmed = TRUE,
    confirmed_at = "2026-07-26T11:00:00Z",
    n_questions = 1L,
    maps = .cr_choice_maps("2", "2")
  ))

  project_path <- tempfile("carga-review-mapping-", fileext = ".pulso")
  on.exit(unlink(project_path, force = TRUE), add = TRUE)
  build_pulso(sid, project_path, project_name = "Carga review mapping")
  loaded <- load_pulso(project_path)
  on.exit(session_delete(loaded$session_id), add = TRUE)
  restored <- session_get(loaded$session_id)

  expect_identical(
    restored$estudio$bases$A$choice_code_mapping$maps,
    maps_a
  )
  expect_identical(
    restored$estudio$bases$B$choice_code_mapping$maps,
    maps_b
  )
  expect_identical(as.character(restored$rp_data_sources$A$p1), c("1", "2"))
  expect_identical(as.character(restored$rp_data_sources$B$p1), c("2", "1"))
})

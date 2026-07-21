library(testthat)

.pr_test_file <- function(s, base, kind, suffix) {
  file_id <- paste(base, kind, sep = "-")
  path <- file.path(s$dir, "uploads", paste0(file_id, ".", suffix))
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)
  writeBin(charToRaw(paste(base, kind, "contenido", sep = "\r")), path)
  s$files[[file_id]] <- list(
    file_id = file_id,
    kind = kind,
    original_name = basename(path),
    path = path,
    size = file.info(path)$size,
    ext = suffix
  )
  list(state = s, file_id = file_id)
}

.pr_test_setup <- function() {
  sid <- session_create()
  s <- session_get(sid)
  bases <- c("administrativos", "docentes")
  s$estudio <- list(
    nombre = "ACRDCONTA",
    processing_mode = "independent_siblings",
    sibling_family_id = "family-acrdconta",
    active_base = bases[[1]],
    bases = list()
  )
  s$files <- list()
  s$codif_por_base <- list()
  s$analitica_config_por_base <- list()
  s$analitica_status_por_base <- list()

  for (base in bases) {
    data <- .pr_test_file(s, base, "data_adaptada", "xlsx")
    s <- data$state
    inst <- .pr_test_file(s, base, "instrumento_adaptado", "xlsx")
    s <- inst$state
    s$estudio$bases[[base]] <- list(
      nombre = base,
      data_file_id = data$file_id,
      xlsform_file_id = inst$file_id,
      n_filas = if (base == "administrativos") 15L else 52L,
      source_alias = tools::toTitleCase(base),
      source_title = tools::toTitleCase(base),
      processing_intake_entry_id = paste0("entry-", base),
      sibling_family_id = "family-acrdconta",
      instrument_revision_id = paste0("revision-", base),
      batch_fingerprint = "batch-1",
      variables_extra_checksum = paste(rep("a", 64), collapse = ""),
      variables_extra_incluidas = list(),
      response_filter = list(advancement = "effective"),
      traceability = list(selection_sha256 = paste(rep("b", 64), collapse = "")),
      validacion = list(
        plan_result = list(plan = data.frame(rule = "required")),
        evaluacion = list(resumen = data.frame(rule = "required", n = 0L)),
        reglas_custom = list(),
        operational_config = list(mode = "strict"),
        variables_excluidas = character(0),
        limpieza_draft = list(),
        limpieza_preview = list(
          data_final = data.frame(response_id = paste0(base, "-1"), q1 = "ok"),
          impact = list(cells_changed = 0L)
        ),
        limpieza_artifacts = list(finalized_at = "2026-07-20T10:00:00Z")
      )
    )
    s$codif_por_base[[base]] <- list(
      aplicado = TRUE,
      familias_generated = TRUE,
      familias_draft = list(rows = list()),
      grupos_recod = list(),
      respuestas_recod = list()
    )
    s$analitica_config_por_base[[base]] <- list(
      fuente_preferida = "adaptados",
      ponderacion = list(enabled = FALSE),
      cruces = list(orden = "original")
    )
    s$analitica_status_por_base[[base]] <- list(
      analitica_prep_ok = TRUE,
      analitica_frecuencias_ok = TRUE,
      analitica_cruces_ok = TRUE
    )
  }
  s$analitica_prep_ok <- TRUE
  s$analitica_frecuencias_ok <- TRUE
  s$analitica_cruces_ok <- TRUE
  .session_env[[sid]] <- s
  list(sid = sid, bases = bases)
}

.pr_test_error <- function(expr) {
  tryCatch(expr, api_error = function(e) e)
}

test_that("catalogo deriva readiness por base sin cambiar la base activa", {
  setup <- .pr_test_setup()
  on.exit(session_delete(setup$sid), add = TRUE)
  before <- session_get(setup$sid)

  catalog <- processing_release_get(setup$sid)

  expect_true(catalog$detected)
  expect_false(catalog$all_approved)
  expect_equal(vapply(catalog$entries, `[[`, character(1), "status"), c("ready", "ready"))
  expect_true(all(vapply(catalog$entries, `[[`, logical(1), "ready")))
  expect_true(all(vapply(catalog$entries, function(entry) {
    grepl("^[0-9a-f]{64}$", entry$input_fingerprint)
  }, logical(1))))
  expect_identical(session_get(setup$sid), before)
})

test_that("aprobar es independiente, idempotente y conserva identidad estable", {
  setup <- .pr_test_setup()
  on.exit(session_delete(setup$sid), add = TRUE)
  catalog <- processing_release_get(setup$sid)
  admin <- catalog$entries[[1]]
  docentes <- catalog$entries[[2]]

  one <- processing_release_approve(setup$sid, admin$base, admin$input_fingerprint)
  expect_equal(vapply(one$entries, `[[`, character(1), "status"), c("approved", "ready"))
  release <- session_get(setup$sid)$processing_releases[[admin$entry_id]]
  expect_equal(release$schema, "processing_release/v1")
  expect_equal(release$processing_intake_entry_id, admin$entry_id)
  expect_equal(release$input_fingerprint, admin$input_fingerprint)

  state_before_retry <- session_get(setup$sid)
  retried <- processing_release_approve(setup$sid, admin$base, admin$input_fingerprint)
  expect_equal(retried$entries[[1]]$status, "approved")
  expect_identical(session_get(setup$sid), state_before_retry)

  all <- processing_release_approve(setup$sid, docentes$base, docentes$input_fingerprint)
  expect_true(all$all_approved)
  expect_true(all(vapply(all$entries, `[[`, logical(1), "approved")))
})

test_that("cambiar una configuracion vuelve stale solo su release", {
  setup <- .pr_test_setup()
  on.exit(session_delete(setup$sid), add = TRUE)
  catalog <- processing_release_get(setup$sid)
  for (entry in catalog$entries) {
    processing_release_approve(setup$sid, entry$base, entry$input_fingerprint)
  }
  s <- session_get(setup$sid)
  active_before <- s$estudio$active_base
  s$analitica_config_por_base$administrativos$ponderacion <- list(enabled = TRUE, trim = list(cap = 3))
  .session_env[[setup$sid]] <- s

  changed <- processing_release_get(setup$sid)

  statuses <- stats::setNames(
    vapply(changed$entries, `[[`, character(1), "status"),
    vapply(changed$entries, `[[`, character(1), "base")
  )
  expect_equal(statuses[["administrativos"]], "stale")
  expect_equal(statuses[["docentes"]], "approved")
  expect_equal(session_get(setup$sid)$estudio$active_base, active_before)
})

test_that("un entregable analitico opcional no invalida la release", {
  setup <- .pr_test_setup()
  on.exit(session_delete(setup$sid), add = TRUE)
  entry <- processing_release_get(setup$sid)$entries[[1]]
  processing_release_approve(setup$sid, entry$base, entry$input_fingerprint)
  s <- session_get(setup$sid)
  s$analitica_status_por_base$administrativos$analitica_spss_ok <- TRUE
  .session_env[[setup$sid]] <- s

  current <- processing_release_get(setup$sid)$entries[[1]]

  expect_equal(current$status, "approved")
  expect_equal(current$input_fingerprint, entry$input_fingerprint)
})

test_that("fingerprint stale y readiness incompleto no mutan", {
  setup <- .pr_test_setup()
  on.exit(session_delete(setup$sid), add = TRUE)
  catalog <- processing_release_get(setup$sid)
  before <- session_get(setup$sid)
  stale <- .pr_test_error(processing_release_approve(
    setup$sid, "administrativos", paste(rep("0", 64), collapse = "")
  ))
  expect_equal(stale$code, "E_PROCESSING_RELEASE_STALE")
  expect_identical(session_get(setup$sid), before)

  s <- session_get(setup$sid)
  s$estudio$bases$administrativos$validacion$limpieza_artifacts <- list()
  .session_env[[setup$sid]] <- s
  pending <- processing_release_get(setup$sid)$entries[[1]]
  expect_equal(pending$status, "pending")
  expect_false(pending$ready)
  before_pending <- session_get(setup$sid)
  err <- .pr_test_error(processing_release_approve(
    setup$sid, pending$base, pending$input_fingerprint
  ))
  expect_equal(err$code, "E_PROCESSING_RELEASE_NOT_READY")
  expect_identical(session_get(setup$sid), before_pending)
})

test_that("processing_releases viaja en state.rds sin incluir caches", {
  setup <- .pr_test_setup()
  on.exit(session_delete(setup$sid), add = TRUE)
  entry <- processing_release_get(setup$sid)$entries[[1]]
  processing_release_approve(setup$sid, entry$base, entry$input_fingerprint)

  stripped <- .pulso_strip_caches(session_get(setup$sid))

  expect_equal(
    stripped$processing_releases[[entry$entry_id]]$input_fingerprint,
    entry$input_fingerprint
  )
})

test_that("release fija la politica metodologica de la revision publicada", {
  setup <- .pr_test_setup()
  on.exit(session_delete(setup$sid), add = TRUE)
  s <- session_get(setup$sid)
  revision_id <- "revision-administrativos"
  s$instrument_revisions <- list()
  s$instrument_revisions[[revision_id]] <- list(
    schema = "instrument_revision/v1",
    revision_id = revision_id,
    xlsform_file_id = s$estudio$bases$administrativos$xlsform_file_id,
    logic_audit = list(source_sha256 = paste(rep("c", 64), collapse = "")),
    source = list(provenance = list(
      proposal_schema = "acrdconta_logic_proposal/v3",
      analysis_excluded_codes = list(p12 = list("99")),
      denominator_rules = list(p12 = list(
        eligible_if = "${p10} = '1'",
        exclude_codes = list("99"),
        exclude_empty = TRUE,
        zero_denominator = "report_na_with_warning"
      )),
      ppt_plan_defaults = list(p12 = list(
        excluir_opciones = list("99", "Prefiero no responder"),
        base = "valid_after_exclusions"
      )),
      special_values = list(p12 = list(list(
        code = "99",
        label = "Prefiero no responder",
        role = "nonresponse",
        include_in_valid_denominator = FALSE
      )))
    ))
  )
  .session_env[[setup$sid]] <- s

  entry <- processing_release_get(setup$sid)$entries[[1]]

  expect_true(entry$pins$methodology$configured)
  expect_equal(entry$pins$methodology$instrument_revision_id, revision_id)
  expect_equal(entry$pins$methodology$source_sha256, paste(rep("c", 64), collapse = ""))
  expect_equal(entry$pins$methodology$analysis_excluded_codes$p12, list("99"))
  expect_equal(entry$pins$methodology$ppt_plan_defaults$p12$excluir_opciones, list("99", "Prefiero no responder"))
  expect_match(entry$pins$methodology$policy_sha256, "^[0-9a-f]{64}$")

  approved <- processing_release_approve(setup$sid, entry$base, entry$input_fingerprint)
  expect_equal(approved$entries[[1]]$status, "approved")
  changed <- session_get(setup$sid)
  changed$instrument_revisions[[revision_id]]$source$provenance$ppt_plan_defaults$p12$excluir_opciones <- list("98")
  .session_env[[setup$sid]] <- changed

  expect_equal(processing_release_get(setup$sid)$entries[[1]]$status, "stale")
})

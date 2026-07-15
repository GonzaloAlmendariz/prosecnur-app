test_that("operational config final solo contiene fechas de campo y duplicados", {
  cfg <- normalize_validation_operational_config(NULL)
  expect_equal(cfg$version, 2L)
  expect_identical(cfg$field_period$timezone, "America/Lima")
  expect_identical(cfg$duplicates$matching_method, "response_similarity")
  expect_equal(cfg$duplicates$similarity_threshold, 0.90)
  expect_equal(cfg$duplicates$minimum_coverage, 0.80)
  expect_false("universe_filter" %in% names(cfg))

  legacy <- normalize_validation_operational_config(list(
    universe_filter = list(
      enabled = TRUE, variable = "testreal", real_values = list("real")
    )
  ))
  expect_false("universe_filter" %in% names(legacy))

  expect_error(
    normalize_validation_operational_config(list(
      field_period = list(
        enabled = TRUE, variable = "fecha",
        start_date = "2026-07-10", end_date = "2026-07-01"
      )
    )),
    class = "api_error"
  )
  expect_error(
    normalize_validation_operational_config(list(
      duplicates = list(enabled = TRUE, variables = list("desconocida"))
    ), available_variables = c("id", "fecha")),
    class = "api_error"
  )
  expect_error(
    normalize_validation_operational_config(list(
      version = 2L,
      duplicates = list(
        enabled = TRUE,
        variables = as.list(paste0("q", seq_len(10L))),
        matching_method = "response_similarity",
        similarity_threshold = 1.01,
        minimum_coverage = 0.80
      )
    )),
    class = "api_error"
  )
})

test_that("controles habilitados materializan reglas AST y disabled no genera", {
  expect_length(validation_operational_rules(NULL), 0L)
  response_vars <- paste0("q", seq_len(10L))
  cfg <- normalize_validation_operational_config(list(
    version = 2L,
    field_period = list(
      enabled = TRUE, variable = "fecha",
      start_date = "2026-06-01", end_date = "2026-06-30",
      timezone = "America/Lima"
    ),
    duplicates = list(
      enabled = TRUE,
      variables = as.list(response_vars),
      matching_method = "response_similarity",
      similarity_threshold = 0.90,
      minimum_coverage = 0.80
    )
  ))
  rules <- validation_operational_rules(cfg)
  expect_equal(vapply(rules, `[[`, character(1), "id"),
               c("OP_field_period", "OP_duplicates"))
  expect_equal(rules[[1]]$predicate$timezone, "America/Lima")
  expect_equal(ast_op(rules[[2]]$predicate), "duplicate_similarity")
  expect_equal(rules[[2]]$predicate$threshold, 0.90)
  expect_equal(rules[[2]]$predicate$minimum_coverage, 0.80)
})

test_that("duplicados ignora claves incompletas y marca filas completas repetidas", {
  rule <- rule_duplicate(c("id", "sede"), missing_key_policy = "ignore_missing")
  data <- data.frame(
    id = c("A", "A", NA, NA, "", ""),
    sede = c("L", "L", "X", "X", "Y", "Y"),
    stringsAsFactors = FALSE
  )
  ev <- evaluate_rules(list(rule), data)
  expect_identical(ev$data[[rule$flag_name]], c(TRUE, TRUE, FALSE, FALSE, FALSE, FALSE))
})

test_that("control operativo señala pares con 90 por ciento de respuestas coincidentes", {
  vars <- paste0("q", seq_len(10L))
  cfg <- normalize_validation_operational_config(list(
    version = 2L,
    duplicates = list(
      enabled = TRUE,
      variables = as.list(vars),
      matching_method = "response_similarity",
      similarity_threshold = 0.90,
      minimum_coverage = 0.80
    )
  ))
  rule <- validation_operational_rules(cfg)[[1L]]
  data <- as.data.frame(matrix("A", nrow = 3L, ncol = 10L), stringsAsFactors = FALSE)
  names(data) <- vars
  data$q10[[2L]] <- "B"
  data$q9[[3L]] <- "C"
  data$q10[[3L]] <- "C"

  evaluated <- evaluate_rules(list(rule), data)$data[[rule$flag_name]]
  expect_identical(evaluated, c(TRUE, TRUE, FALSE))
})

test_that("rango datetime respeta la fecha civil de la zona operativa", {
  lima <- rule_range(
    "fecha", min = "2026-06-30", max = "2026-06-30",
    type = "date", timezone = "America/Lima"
  )
  utc <- rule_range(
    "fecha", min = "2026-06-30", max = "2026-06-30",
    type = "date", timezone = "UTC"
  )
  data <- data.frame(fecha = "2026-07-01T00:30:00Z")
  expect_false(evaluate_rules(list(lima), data)$data[[lima$flag_name]][1])
  expect_true(evaluate_rules(list(utc), data)$data[[utc$flag_name]][1])
})

test_that("operational config persiste por base logica", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "rp_data", data.frame(id = 1))
  cfg <- normalize_validation_operational_config(list(
    field_period = list(
      enabled = TRUE, variable = "fecha",
      start_date = "2026-06-01", end_date = "2026-06-30"
    )
  ))
  validacion_scope_set(sid, NULL, "operational_config", cfg)
  got <- validacion_scope_get(sid, NULL, "operational_config")
  expect_true(got$field_period$enabled)
  expect_false("universe_filter" %in% names(got))
})

test_that("invalidacion conserva config operativa final", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  cfg <- normalize_validation_operational_config(list(
    version = 2L,
    duplicates = list(
      enabled = TRUE,
      variables = as.list(paste0("q", seq_len(10L))),
      matching_method = "response_similarity",
      similarity_threshold = 0.90,
      minimum_coverage = 0.80
    )
  ))
  session_set(sid, "validacion_operational_config", cfg)

  invalidated <- .invalidate_processing_state(session_get(sid))
  expect_true(invalidated$validacion_operational_config$duplicates$enabled)
  expect_false("validacion_operational_universe" %in% names(invalidated))
})

test_that("estado de Validacion expone el filtro aplicado en Carga", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_ensure(sid)
  s <- session_get(sid)
  s$estudio$active_base <- "principal"
  s$estudio$bases$principal <- list(
    nombre = "principal",
    universe_filter = list(
      enabled = TRUE,
      variable = "testreal",
      real_values = "real",
      test_values = "test",
      applied_at = "2026-07-14T20:00:00Z",
      audit = list(total = 430L, included = 427L,
                   excluded_test = 3L, excluded_unclassified = 0L)
    )
  )
  .session_env[[sid]] <- s

  upstream <- .validacion_upstream_universe(sid, "principal")
  expect_equal(upstream$variable, "testreal")
  expect_equal(upstream$included, 427L)
  expect_equal(upstream$excluded_test, 3L)
  expect_equal(unlist(upstream$real_values, use.names = FALSE), "real")
  expect_equal(unlist(upstream$test_values, use.names = FALSE), "test")
})

test_that("operational config hace round-trip .pulso por base", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_ensure(sid)
  s <- session_get(sid)
  s$estudio$active_base <- "base_a"
  s$estudio$bases$base_a <- list(nombre = "base_a")
  s$estudio$bases$base_b <- list(nombre = "base_b")
  .session_env[[sid]] <- s

  cfg_a <- normalize_validation_operational_config(list(
    field_period = list(
      enabled = TRUE, variable = "fecha",
      start_date = "2026-06-01", end_date = "2026-06-30"
    )
  ))
  cfg_b <- normalize_validation_operational_config(list(
    version = 2L,
    duplicates = list(
      enabled = TRUE,
      variables = as.list(paste0("q", seq_len(10L))),
      matching_method = "response_similarity",
      similarity_threshold = 0.90,
      minimum_coverage = 0.80
    )
  ))
  validacion_scope_set(sid, "base_a", "operational_config", cfg_a)
  validacion_scope_set(sid, "base_b", "operational_config", cfg_b)

  path <- tempfile(fileext = ".pulso")
  on.exit(unlink(path, force = TRUE), add = TRUE)
  build_pulso(sid, path, project_name = "Operational roundtrip")
  loaded <- load_pulso(path)
  on.exit(session_delete(loaded$session_id), add = TRUE)

  got_a <- validacion_scope_get(loaded$session_id, "base_a", "operational_config")
  got_b <- validacion_scope_get(loaded$session_id, "base_b", "operational_config")
  expect_true(got_a$field_period$enabled)
  expect_true(got_b$duplicates$enabled)
  expect_equal(got_b$duplicates$variables, paste0("q", seq_len(10L)))
  expect_equal(got_b$duplicates$similarity_threshold, 0.90)
  expect_false("universe_filter" %in% names(got_a))
})

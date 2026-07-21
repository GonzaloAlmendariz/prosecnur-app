library(testthat)

test_that("la revision materializa una coherencia tipada estable sin duplicarla", {
  instrumento <- list(
    survey = data.frame(
      type = c("integer", "select_one si_no", "integer"),
      name = c("p5", "p7", "p8"),
      label = c("Anio de egreso", "Tiene titulo", "Anio del titulo"),
      list_name = c(NA_character_, "si_no", NA_character_),
      required = "",
      relevant = "",
      constraint = "",
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("si_no", "si_no"),
      name = c("1", "2"),
      label = c("Si", "No"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  state <- list(instrument_revisions = list(
    `revision-egresados` = list(
      schema = "instrument_revision/v1",
      revision_id = "revision-egresados",
      logic_audit = list(source_sha256 = paste(rep("a", 64L), collapse = "")),
      source = list(provenance = list(
        degree_year_rule = list(
          title_has_year_if = "${p7} = '1'",
          title_year_not_before_graduation = TRUE,
          enforcement = "validation_coherence_rule_after_materialization"
        )
      ))
    ),
    `revision-sin-contrato` = list(
      schema = "instrument_revision/v1",
      revision_id = "revision-sin-contrato",
      source = list(provenance = list())
    )
  ))

  contract <- instrument_validation_contract(state, "revision-egresados")
  contract_again <- instrument_validation_contract(state, "revision-egresados")

  expect_equal(contract$schema, "instrument_validation_contract/v1")
  expect_true(contract$configured)
  expect_match(contract$contract_sha256, "^[0-9a-f]{64}$")
  expect_length(contract$rules, 1L)
  expect_identical(contract$rules[[1]]$id, contract_again$rules[[1]]$id)

  rule <- contract$rules[[1]]
  expect_s3_class(rule, "vd_rule")
  expect_equal(rule$tipo_regla, "coherence")
  expect_equal(ast_op(rule$predicate), "if_then")
  expect_setequal(rule$variables, c("p5", "p7", "p8"))
  expect_true(validate_rule(rule, instrumento)$ok)
  expect_s3_class(compile_rule(rule), "tbl_df")

  bundle <- build_validation_bundle(instrumento)
  bundle_before <- unserialize(serialize(bundle, NULL))
  appended <- instrument_validation_append_rules(bundle, contract)
  appended_twice <- instrument_validation_append_rules(appended, contract)

  expect_identical(bundle, bundle_before)
  expect_equal(length(appended$rules), length(bundle$rules) + 1L)
  expect_identical(
    vapply(appended_twice$rules, `[[`, character(1), "id"),
    vapply(appended$rules, `[[`, character(1), "id")
  )
  expect_false(anyDuplicated(vapply(appended_twice$rules, `[[`, character(1), "id")) > 0L)

  datos <- data.frame(
    p5 = c(2020L, 2020L, 2020L),
    p7 = c("1", "2", "1"),
    p8 = c(2019L, 2019L, 2021L),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  evaluated <- evaluate_validation_bundle(
    bundle = appended,
    data_input = list(
      principal = datos,
      tables = list(principal = datos),
      data_multi = list(),
      rc_checks = list()
    )
  )

  expect_identical(as.logical(evaluated$datos[[rule$flag_name]]), c(TRUE, FALSE, FALSE))
  expect_equal(
    evaluated$resumen$n_inconsistencias[evaluated$resumen$id_regla == rule$id],
    1L
  )

  empty_contract <- instrument_validation_contract(state, "revision-sin-contrato")
  expect_false(empty_contract$configured)
  expect_length(empty_contract$rules, 0L)
  expect_identical(instrument_validation_append_rules(bundle, empty_contract), bundle)
})

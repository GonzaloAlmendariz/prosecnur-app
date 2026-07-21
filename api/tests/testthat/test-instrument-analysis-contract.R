library(testthat)

.iac_revision <- function() {
  list(
    schema = "instrument_revision/v1",
    revision_id = "revision-egresados",
    logic_audit = list(source_sha256 = paste(rep("a", 64), collapse = "")),
    source = list(provenance = list(
      proposal_schema = "acrdconta_logic_proposal/v3",
      analysis_excluded_fields = list("p34", "p35", "p36"),
      analysis_excluded_codes = list(p12 = list("99")),
      denominator_rules = list(p12 = list(
        eligible_if = "${p10} = '1'",
        exclude_codes = list("99"),
        exclude_empty = TRUE,
        zero_denominator = "report_na_with_warning"
      )),
      ppt_plan_defaults = list(p12 = list(
        excluir_opciones = list("99", "Prefiero no responder")
      )),
      special_values = list(p12 = list(list(
        code = "99",
        label = "Prefiero no responder",
        role = "nonresponse",
        include_in_valid_denominator = FALSE,
        report_separately = TRUE
      )))
    ))
  )
}

test_that("resolver proyecta un contrato compacto ligado a la revision", {
  s <- list(instrument_revisions = list("revision-egresados" = .iac_revision()))

  contract <- instrument_analysis_contract(s, "revision-egresados")

  expect_equal(contract$schema, "instrument_analysis_contract/v1")
  expect_true(contract$configured)
  expect_equal(contract$instrument_revision_id, "revision-egresados")
  expect_match(contract$source_sha256, "^[a-f0-9]{64}$")
  expect_match(contract$contract_sha256, "^[a-f0-9]{64}$")
  expect_equal(contract$analysis_excluded_codes$p12, list("99"))
  expect_equal(contract$denominator_rules$p12$eligible_if, "${p10} = '1'")
})

test_that("aplicacion es por celda, variable y revision sin filtrar otras respuestas", {
  s <- list(instrument_revisions = list("revision-egresados" = .iac_revision()))
  contract <- instrument_analysis_contract(s, "revision-egresados")
  data <- data.frame(
    p10 = c("1", "1", "2", "1"),
    p12 = c("1", "99", "2", ""),
    indicador_ajeno = c("A", "B", "C", "D"),
    stringsAsFactors = FALSE
  )

  applied <- instrument_analysis_apply_data(data, contract)

  expect_equal(nrow(applied$data), 4L)
  expect_equal(applied$data$indicador_ajeno, data$indicador_ajeno)
  expect_equal(applied$data$p12, c("1", NA, NA, ""))
  expect_equal(applied$audit$p12$n_eligible, 3L)
  expect_equal(applied$audit$p12$n_excluded_codes, 1L)
  expect_equal(applied$audit$p12$n_ineligible_nonempty, 1L)
  expect_equal(applied$audit$p12$n_valid, 1L)
  expect_false(applied$audit$p12$zero_denominator)
})

test_that("denominador cero produce NA analitico y advertencia auditable", {
  s <- list(instrument_revisions = list("revision-egresados" = .iac_revision()))
  contract <- instrument_analysis_contract(s, "revision-egresados")
  data <- data.frame(
    p10 = c("1", "1", "2"),
    p12 = c("99", "", "1"),
    stringsAsFactors = FALSE
  )

  applied <- instrument_analysis_apply_data(data, contract)

  expect_equal(applied$audit$p12$n_valid, 0L)
  expect_true(applied$audit$p12$zero_denominator)
  expect_true(any(grepl("instrument_contract_zero_denominator: p12", applied$warnings, fixed = TRUE)))
  expect_true(all(is.na(applied$data$p12[c(1, 3)])))
})

test_that("aplicacion multibase usa el contrato exacto de cada revision", {
  s <- list(
    instrument_revisions = list("revision-egresados" = .iac_revision()),
    estudio = list(bases = list(
      egresados = list(instrument_revision_id = "revision-egresados"),
      docentes = list(instrument_revision_id = "revision-docentes-legacy")
    ))
  )
  sources <- instrument_analysis_apply_sources(
    s,
    data_sources = list(
      egresados = data.frame(p10 = "1", p12 = "99", stringsAsFactors = FALSE),
      docentes = data.frame(p12 = "99", stringsAsFactors = FALSE)
    ),
    inst_sources = list(
      egresados = list(
        survey = data.frame(
          name = "p12", type = "select_one income", list_name = "income",
          stringsAsFactors = FALSE
        ),
        choices = data.frame(
          list_name = rep("income", 3),
          name = c("1", "2", "99"),
          label = c("Tramo 1", "Tramo 2", "Prefiero no responder"),
          stringsAsFactors = FALSE
        )
      ),
      docentes = list()
    )
  )

  expect_true(is.na(sources$data_sources$egresados$p12[[1]]))
  expect_equal(sources$data_sources$docentes$p12[[1]], "99")
  expect_true(attr(sources$inst_sources$egresados, "instrument_analysis_contract")$configured)
  expect_false(attr(sources$inst_sources$docentes, "instrument_analysis_contract")$configured)
  expect_equal(sources$inst_sources$egresados$orders_list$p12$names, c("1", "2"))
  categories <- get_categorias(
    "p12",
    sources$data_sources$egresados,
    survey = sources$inst_sources$egresados$survey,
    orders_list = sources$inst_sources$egresados$orders_list
  )
  expect_false("99" %in% categories$codes)
})

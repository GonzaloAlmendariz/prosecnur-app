# =============================================================================
# Surfacing del plan relacional (Fase 4): filtro estructural de columnas,
# supresión de la inferencia legacy redundante con RC5, y anotaciones
# relacionales del payload del plan.
# =============================================================================

# Survey sintético tipo PDM: select_multiple conductor + begin_repeat
# condicionado por count-selected + calculate de identidad del roster.
.rel_test_survey <- function() {
  data.frame(
    type = c(
      "begin_group",
      "select_one lst_yn",       # Consent
      "select_multiple lst_srv", # services (conductor)
      "begin_repeat",            # rep_servicios
      "calculate",               # current_code (selected-at)
      "calculate",               # current_label (jr:choice-name)
      "select_one lst_sat",      # srv_satisfaccion
      "end_repeat",
      "end_group"
    ),
    name = c(
      "Assistance", "Consent", "services", "rep_servicios",
      "current_code", "current_label", "srv_satisfaccion",
      "rep_servicios", "Assistance"
    ),
    label = c("Asistencia", "Consentimiento", "Servicios", "Roster",
              "cod", "etiqueta", "Satisfacción", "Roster", "Asistencia"),
    relevant = c("${Consent} = 'Yes'", "", "", "", "", "", "", "", ""),
    calculation = c(
      "", "", "", "",
      "selected-at(${services}, position(..)-1)",
      "jr:choice-name(${current_code}, '${services}')",
      "", "", ""
    ),
    repeat_count = c("", "", "", "count-selected(${services})", "", "", "", "", ""),
    stringsAsFactors = FALSE, check.names = FALSE
  )
}

# ---------------------------------------------------------------------------
# A1 — nombres estructurales fuera del set de columnas requeridas
# ---------------------------------------------------------------------------
test_that(".survey_structural_names devuelve grupos/repeats/notas, no data-calculates", {
  survey <- data.frame(
    type = c("begin_group", "note", "calculate", "integer", "begin_repeat", "end_repeat", "end_group"),
    name = c("G1", "nota1", "calc1", "q1", "rep1", "rep1", "G1"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  structural <- .survey_structural_names(survey)
  expect_true(all(c("G1", "nota1", "rep1") %in% structural))
  # Un calculate que produce columna de dato NO es estructural.
  expect_false("calc1" %in% structural)
  expect_false("q1" %in% structural)
})

test_that("una regla cuyo gate referencia un begin_group NO reporta missing_columns por el grupo", {
  survey <- .rel_test_survey()
  # Gate pathológico que referencia el nombre del begin_group `Assistance`.
  gate_ast <- odk_parse_to_ast("${Assistance} = '1' and ${Consent} = 'Yes'",
                               context = "relevant")$ast
  expect_true("Assistance" %in% ast_variables(gate_ast))  # el AST sí lo referencia

  rr <- rule_skip(var = "srv_satisfaccion", gate = gate_ast,
                  direction = "must_be_empty_when_false",
                  nombre = "salto test", seccion = "Assistance", tabla = "principal")
  rr <- .enrich_ast_rule_from_survey(
    rr, survey = survey, target_var = "srv_satisfaccion", gate_ast = gate_ast,
    nombre_humano = "salto", objetivo = "obj", subtipo_semantico = "nodebe",
    detalle_ast = ast_normalize(ast_not(gate_ast))
  )
  # El nombre del grupo NO debe estar en los roles ni en variables.
  expect_false("Assistance" %in% rr$variable_roles$gate)
  expect_false("Assistance" %in% rr$variable_roles$drivers)
  expect_false("Assistance" %in% (rr$variables %||% character(0)))
  # Consent (una pregunta real) SÍ se conserva.
  expect_true("Consent" %in% rr$variable_roles$gate)

  # La data tiene las preguntas hoja pero no una columna `Assistance`.
  mc <- .rule_missing_columns(rr, c("Consent", "srv_satisfaccion"))
  expect_false("Assistance" %in% mc$all)
  expect_length(mc$all, 0L)
})

test_that(".rule_missing_columns filtra los identificadores estructurales de la propia regla", {
  # Regla legacy simulada que arrastra su sección (begin_group) en el gate.
  gate_ast <- odk_parse_to_ast("${Assistance} = '1'", context = "relevant")$ast
  rr <- make_rule(nombre = "legacy", tipo_regla = "constraint", fuente = "instrumento",
                  predicate = ast_compare_const("srv_satisfaccion", "==", "No"),
                  gate = gate_ast, seccion = "Assistance", tabla = "rep_servicios",
                  repeat_context = "rep_servicios")
  # Metadata sin el filtro de introspección: el grupo queda en gate/variables.
  rr <- .rule_apply_metadata(rr, primary_var = "srv_satisfaccion",
                             variable_roles = list(target = "srv_satisfaccion",
                                                   gate = c("Assistance"),
                                                   drivers = c("Assistance")))
  mc <- .rule_missing_columns(rr, c("srv_satisfaccion"))
  # tabla/repeat_context/seccion son estructurales → nunca "faltan".
  expect_false("Assistance" %in% mc$all)
  expect_false("rep_servicios" %in% mc$all)
})

# ---------------------------------------------------------------------------
# A2 — supresión de la inferencia legacy redundante con RC5
# ---------------------------------------------------------------------------
test_that(".roster_identity_vars detecta las calculate de identidad del roster", {
  ident <- .roster_identity_vars(.rel_test_survey())
  expect_true("current_code" %in% ident)    # identity_var (selected-at)
  expect_true("current_label" %in% ident)    # jr:choice-name derivada
  expect_false("srv_satisfaccion" %in% ident)
})

test_that(".suppress_redundant_roster_legacy quita el calculate_check redundante SOLO si RC5 está presente", {
  survey <- .rel_test_survey()
  # calculate_check legacy sobre current_label (la regla «current_label coincide…»).
  calc_rule <- make_rule(
    nombre = "«current_label» coincide con el cálculo",
    tipo_regla = "calculate_check", fuente = "instrumento",
    predicate = ast_odk_raw("current_label == choice_label_map(current_code)", origin = "legacy_r_expr"),
    tabla = "rep_servicios", repeat_context = "rep_servicios"
  )
  calc_rule <- .rule_apply_metadata(calc_rule, primary_var = "current_label",
                                    variable_roles = list(target = "current_label",
                                                          compare = "current_code"))
  calc_rule$id <- "EVAL_001"
  rc5 <- rule_roster_correspondence(host_sm_var = "services", source_table = "rep_servicios",
                                    source_var = "current_code")
  plain <- rule_required(var = "Consent")

  # Con RC5 presente → se suprime la legacy.
  out <- .suppress_redundant_roster_legacy(list(calc_rule, rc5, plain), survey)
  ids <- vapply(out$rules, function(r) as.character(r$id), character(1))
  expect_false("EVAL_001" %in% ids)
  expect_true("EVAL_001" %in% out$suppressed_ids)
  expect_equal(length(out$rules), 2L)

  # Sin RC5 → NO se suprime (no hay reemplazo relacional).
  out2 <- .suppress_redundant_roster_legacy(list(calc_rule, plain), survey)
  ids2 <- vapply(out2$rules, function(r) as.character(r$id), character(1))
  expect_true("EVAL_001" %in% ids2)
  expect_length(out2$suppressed_ids, 0L)
})

# ---------------------------------------------------------------------------
# B — anotaciones relacionales del payload del plan
# ---------------------------------------------------------------------------
test_that("validacion_relational_plan_annotations marca relational/repeat_group y requires_external_dataset", {
  survey <- .rel_test_survey()
  rc5 <- rule_roster_correspondence(host_sm_var = "services", source_table = "rep_servicios",
                                    source_var = "current_code")
  rc3 <- rule_referential_parent_exists(repeat_table = "rep_servicios")
  rc1 <- rule_repeat_length(repeat_name = "rep_servicios", expected = "count-selected(${services})")
  pull <- rule_odk_raw(
    odk_expression = "pulldata('listadoedp', 'Sede', 'Telefono', ${telephone})",
    variables = "sede_ppl", nombre = "sede_ppl requiere roster externo",
    tabla = "principal", origin = "pulldata"
  )
  plain <- rule_required(var = "Consent")
  rules <- list(rc5, rc3, rc1, pull, plain)

  ann <- validacion_relational_plan_annotations(rules, survey)

  m_rc5 <- ann$per_rule[[as.character(rc5$id)]]
  expect_true(m_rc5$relational)
  expect_equal(m_rc5$repeat_group, "rep_servicios")   # sale del source_table del predicate
  expect_true(m_rc5$depends_on_child_base)
  expect_false(m_rc5$requires_external_dataset)

  m_rc3 <- ann$per_rule[[as.character(rc3$id)]]
  expect_true(m_rc3$relational)
  expect_equal(m_rc3$repeat_group, "rep_servicios")

  m_rc1 <- ann$per_rule[[as.character(rc1$id)]]
  expect_true(m_rc1$relational)
  expect_equal(m_rc1$repeat_group, "rep_servicios")

  m_pull <- ann$per_rule[[as.character(pull$id)]]
  expect_true(m_pull$requires_external_dataset)
  expect_true("listadoedp" %in% m_pull$external_datasets)
  expect_false(m_pull$relational)

  m_plain <- ann$per_rule[[as.character(plain$id)]]
  expect_false(m_plain$relational)
  expect_false(m_plain$requires_external_dataset)
  expect_true(is.na(m_plain$repeat_group))

  # Resumen para el encabezado de la familia.
  expect_equal(ann$summary$n_relational, 3L)         # RC1 + RC3 + RC5
  expect_equal(ann$summary$n_requires_external_dataset, 1L)
  expect_true("rep_servicios" %in% unlist(ann$summary$repeat_groups))
  expect_true("listadoedp" %in% unlist(ann$summary$external_datasets))
  rp <- ann$summary$repeats[[1]]
  expect_equal(rp$repeat_group, "rep_servicios")
  expect_equal(rp$sm_conductor, "services")
  expect_equal(rp$identity_var, "current_code")
})

test_that("validacion_relational_annotate_preview fusiona los campos relacionales por ID", {
  survey <- .rel_test_survey()
  rc5 <- rule_roster_correspondence(host_sm_var = "services", source_table = "rep_servicios",
                                    source_var = "current_code")
  plain <- rule_required(var = "Consent")
  rules <- list(rc5, plain)
  ann <- validacion_relational_plan_annotations(rules, survey)

  plan <- compile_rules_to_plan(rules)
  preview <- .plan_rows_preview(plan, n = 50)
  enriched <- validacion_relational_annotate_preview(preview, ann$per_rule)

  by_id <- stats::setNames(enriched, vapply(enriched, function(r) as.character(r$ID), character(1)))
  expect_true(isTRUE(by_id[[as.character(rc5$id)]]$relational))
  expect_equal(by_id[[as.character(rc5$id)]]$repeat_group, "rep_servicios")
  expect_true(isTRUE(by_id[[as.character(rc5$id)]]$depends_on_child_base))
  expect_false(isTRUE(by_id[[as.character(plain$id)]]$relational))
})

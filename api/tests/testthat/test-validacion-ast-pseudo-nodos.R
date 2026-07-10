# =============================================================================
# Contrato de pseudo-nodos del parser AST + resiliencia por-regla del plan
# =============================================================================
# Regresión del crash del PDM ACNUR: un `count-selected(...)` que NO se compara
# contra un número (self-ref en contexto booleano, o valor numérico suelto en
# un repeat_count) dejaba fugar el pseudo-nodo interno `__count_selected`, que
# reventaba ast_is_valid en make_rule con
#   [E_INTERNAL] make_rule(): predicate AST inválido: op '__count_selected'
# Aquí fijamos: (B) el parser nunca emite pseudo-nodos `__*` en un AST no
# degradado, y (A) una regla que no compila se salta y se marca sin tumbar el
# resto del plan.

library(testthat)

# -----------------------------------------------------------------------------
# (a) La restricción exacta de `obstacle` compila sin dejar `__count_selected`
# -----------------------------------------------------------------------------
test_that("obstacle: count-selected(.) anidado en and/not pliega a AST válido", {
  expr <- "count-selected(.) <= 3 and not(selected(., 'none') and count-selected(.) > 1)"
  res <- odk_parse_to_ast(expr, context = "constraint", self_var = "obstacle")

  expect_false(res$degraded_to_raw)
  expect_equal(ast_op(res$ast), "and")

  # No debe quedar NINGÚN pseudo-nodo interno en el árbol.
  expect_false(.ast_has_pseudo_nodes(res$ast))

  # El AST es estructuralmente válido: make_rule no reventaría.
  v <- ast_is_valid(res$ast)
  expect_true(v$ok)

  # Contiene las tres piezas esperadas, ninguna cruda.
  ops <- character(0)
  ast_walk(res$ast, function(node, path) ops <<- c(ops, ast_op(node)))
  expect_true("count_selected_cmp" %in% ops)
  expect_true("selected" %in% ops)
  expect_false(any(grepl("^__", ops)))

  # Y compila sin error a través del constructor de reglas (make_rule).
  predicate <- ast_normalize(ast_and(ast_not(ast_is_missing("obstacle")), ast_not(res$ast)))
  expect_error(
    make_rule(nombre = "obstacle cardinalidad", tipo_regla = "constraint",
              fuente = "instrumento", predicate = predicate),
    NA
  )
})

# -----------------------------------------------------------------------------
# (b) Una regla que no compila no tumba el plan: las demás sobreviven, la mala
#     queda marcada en `unsupported`.
# -----------------------------------------------------------------------------
test_that("resiliencia: una regla no compilable se salta y queda marcada", {
  survey <- data.frame(
    type = c("integer", "integer"),
    name = c("ok_var", "boom_var"),
    label = c("Var OK", "Var Boom"),
    required = c("", ""),
    relevant = c("", ""),
    constraint = c(". > 0", ". > 0"),
    stringsAsFactors = FALSE
  )
  inst <- list(survey = survey, choices = NULL)

  # Forzamos que la construcción de la regla de `boom_var` explote (simulando
  # una expresión que el motor aún no soporta), dejando `ok_var` intacta.
  local_mocked_bindings(
    .enrich_ast_rule_from_survey = function(rule, survey, target_var, ...) {
      if (identical(target_var, "boom_var")) stop("fallo sintético de compilación")
      rule
    }
  )

  res <- infer_rules_from_xlsform(inst, include = "constraint")

  target_vars <- vapply(res$rules, function(r) as.character(r$primary_var %||% NA_character_), character(1))
  expect_true("ok_var" %in% target_vars)   # la buena sobrevive
  expect_false("boom_var" %in% target_vars) # la mala no está en el plan

  expect_equal(length(res$unsupported), 1L)
  bad <- res$unsupported[[1]]
  expect_equal(bad$row_name, "boom_var")
  expect_equal(bad$field, "constraint")
  expect_equal(bad$reason, "no_compilable")
  expect_match(bad$error, "fallo sintético", fixed = TRUE)
})

test_that("resiliencia: sin fallos, unsupported queda vacío", {
  survey <- data.frame(
    type = c("integer", "integer"),
    name = c("a", "b"),
    label = c("A", "B"),
    required = c("", ""),
    relevant = c("", ""),
    constraint = c(". > 0", ". < 100"),
    stringsAsFactors = FALSE
  )
  res <- infer_rules_from_xlsform(list(survey = survey, choices = NULL), include = "constraint")
  expect_length(res$unsupported, 0L)
  expect_gte(length(res$rules), 2L)
})

# -----------------------------------------------------------------------------
# (b') El repeat_count con count-selected(${var}) — el caso que crasheaba de
#      verdad en el PDM — construye la regla sin reventar (expected = string).
# -----------------------------------------------------------------------------
test_that("repeat_count count-selected(${var}) construye repeat_length sin crash", {
  survey <- data.frame(
    type = c("select_multiple servicios", "begin_repeat", "text", "end_repeat"),
    name = c("services", "rep_serv", "detalle", ""),
    label = c("Servicios", "Por servicio", "Detalle", ""),
    required = c("", "", "", ""),
    relevant = c("", "", "", ""),
    constraint = c("", "", "", ""),
    repeat_count = c("", "count-selected(${services})", "", ""),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c("servicios", "servicios"),
    name = c("1", "2"),
    label = c("Salud", "Educación"),
    stringsAsFactors = FALSE
  )

  res <- expect_error(
    infer_rules_from_xlsform(list(survey = survey, choices = choices),
                             include = "repeat_length"),
    NA
  )
  rl <- Filter(function(r) r$tipo_regla == "repeat_length", res$rules)
  expect_length(rl, 1L)
  # expected cae al string crudo (no evaluable, solo mostrado): sin pseudo-nodo.
  expect_true(is.character(rl[[1]]$predicate$expected))
  expect_match(rl[[1]]$predicate$expected, "count-selected", fixed = TRUE)
  expect_length(res$unsupported, 0L)
})

# -----------------------------------------------------------------------------
# (c) Regresiones: los caminos que ya funcionaban siguen igual.
# -----------------------------------------------------------------------------
test_that("regresión: count-selected(var) > 3 con variable normal sigue plegando", {
  res <- odk_parse_to_ast("count-selected(${p39}) > 3", context = "constraint",
                          self_var = "otra")
  expect_false(res$degraded_to_raw)
  expect_equal(ast_op(res$ast), "count_selected_cmp")
  expect_equal(res$ast$var, "p39")
  expect_equal(res$ast$op, ">")
  expect_equal(res$ast$n, 3L)
})

test_that("regresión: selected(., 'none') con self_var sigue funcionando", {
  res <- odk_parse_to_ast("selected(., 'none')", context = "constraint",
                          self_var = "obstacle")
  expect_false(res$degraded_to_raw)
  expect_equal(ast_op(res$ast), "selected")
  expect_equal(res$ast$var, "obstacle")
  expect_equal(res$ast$value, "none")
})

test_that("count-selected(.) suelto (truthy) baja a count_selected_cmp(>0) en booleano", {
  # Un count-selected(.) sin comparar es "hay al menos una selección".
  res <- odk_parse_to_ast("count-selected(.) and selected(., '1')",
                          context = "constraint", self_var = "q")
  expect_false(res$degraded_to_raw)
  expect_false(.ast_has_pseudo_nodes(res$ast))
  ops <- character(0)
  ast_walk(res$ast, function(node, path) ops <<- c(ops, ast_op(node)))
  expect_true("count_selected_cmp" %in% ops)
  # el nodo truthy debe ser (>, 0)
  csc <- NULL
  ast_walk(res$ast, function(node, path) {
    if (ast_op(node) == "count_selected_cmp" && node$op == ">" && node$n == 0L) csc <<- node
  })
  expect_false(is.null(csc))
  expect_equal(csc$var, "q")
})

test_that("count-selected como VALOR numérico en calculate degrada, no revienta", {
  res <- odk_parse_to_ast("count-selected(${services})", context = "calculate")
  expect_true(res$degraded_to_raw)
  expect_equal(ast_op(res$ast), "odk_raw")
  # nunca un pseudo-nodo suelto
  expect_false(.ast_has_pseudo_nodes(res$ast))
})

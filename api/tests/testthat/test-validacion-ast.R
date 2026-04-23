# =============================================================================
# Tests del motor de validación AST
# =============================================================================
# Cubre las 7 capas del motor: lex, primitives, canonicalizer, compiler,
# parser, rules + constructors, introspection, evaluator. Los fixtures
# usan patrones reales extraídos de los 4 XLSForms ACNUR/HST/GIZ para que
# cualquier regresión afecte la validación de surveys de verdad.

# ---- Source helpers (si el paquete no está cargado) --------------------------
# Cargamos directamente en el global env para que los tests tengan visibilidad.
if (!exists("ast", mode = "function", envir = globalenv())) {
  .base_dir_ast <- "../../R"
  if (!dir.exists(.base_dir_ast)) .base_dir_ast <- "api/R"
  .files_ast <- c(
    "validacion_ast_primitives.R",
    "validacion_ast_lex.R",
    "validacion_ast_normalize.R",
    "validacion_ast_compiler_r.R",
    "validacion_ast_rules.R",
    "validacion_ast_registry.R",
    "validacion_ast_parser.R",
    "validacion_ast_introspect.R",
    "validacion_ast_evaluator.R"
  )
  for (.f in .files_ast) {
    .p <- file.path(.base_dir_ast, .f)
    if (file.exists(.p)) sys.source(.p, envir = globalenv())
  }
}

# =============================================================================
# Capa -1: lex normalizer
# =============================================================================
test_that("lex: smart quotes singles y dobles se normalizan a ASCII", {
  expr <- paste0(intToUtf8(0x2018), "hola", intToUtf8(0x2019))
  out <- odk_normalize_lex(expr, report = TRUE)
  expect_equal(out$text, "'hola'")
  expect_gte(length(out$findings), 2L)
})

test_that("lex: expr limpia no reporta findings", {
  out <- odk_normalize_lex("selected(${var}, '1')", report = TRUE)
  expect_equal(length(out$findings), 0L)
})

test_that("lex: es idempotente", {
  original <- paste0(intToUtf8(0x2018), "x", intToUtf8(0x2019),
                     " and ", intToUtf8(0x2014), " y")
  pass1 <- odk_normalize_lex(original)
  pass2 <- odk_normalize_lex(pass1)
  expect_equal(pass1, pass2)
})

# =============================================================================
# Capa 0: AST primitives + hash determinístico
# =============================================================================
test_that("ast_hash es invariante al orden en AND/OR y values", {
  a <- ast_or(ast_selected("v", "1"),
              ast_selected("v", "2"),
              ast_selected("v", "3"))
  b <- ast_or(ast_selected("v", "3"),
              ast_selected("v", "1"),
              ast_selected("v", "2"))
  expect_equal(ast_hash(a), ast_hash(b))
})

test_that("ast_in_set con values en orden distinto produce mismo hash", {
  expect_equal(
    ast_hash(ast_in_set("pais", c("PE", "CO", "VE"))),
    ast_hash(ast_in_set("pais", c("VE", "PE", "CO")))
  )
})

test_that("ast_is_valid detecta AST bien formado vs malformado", {
  good <- ast_range_numeric("edad", 0, 120)
  expect_true(ast_is_valid(good)$ok)

  # Nodo sin 'var' — malformado
  bad <- ast("range_numeric", min = 0, max = 120)
  expect_false(ast_is_valid(bad)$ok)
})

test_that("ast_variables extrae todas las vars referenciadas", {
  x <- ast_and(
    ast_range_numeric("edad", 0, 120),
    ast_compare_vars("edad", ">", "edad_minima"),
    ast_in_set("pais", c("PE","CO"))
  )
  vars <- ast_variables(x)
  expect_setequal(vars, c("edad", "edad_minima", "pais"))
})

# =============================================================================
# Capa 1: canonicalizer
# =============================================================================
test_that("canonicalizer: OR de selected(v,x) misma var → any_selected", {
  expr <- ast_or(
    ast_selected("IDP01", "1"),
    ast_selected("IDP01", "2"),
    ast_selected("IDP01", "3")
  )
  norm <- ast_normalize(expr)
  expect_equal(ast_op(norm), "any_selected")
  expect_equal(norm$var, "IDP01")
  expect_setequal(norm$values, c("1","2","3"))
})

test_that("canonicalizer: OR de ${v}='x', ${v}='y' misma var → in_set", {
  expr <- ast_or(
    ast_compare_const("attempt1", "==", "1"),
    ast_compare_const("attempt1", "==", "2"),
    ast_compare_const("attempt1", "==", "3")
  )
  norm <- ast_normalize(expr)
  expect_equal(ast_op(norm), "in_set")
  expect_setequal(norm$values, c("1","2","3"))
})

test_that("canonicalizer: OR de ${v1}='x', ${v2}='x' → any_column_equals", {
  expr <- ast_or(
    ast_compare_const("P28_2", "==", "1"),
    ast_compare_const("P28_3", "==", "1"),
    ast_compare_const("P28_4", "==", "1")
  )
  norm <- ast_normalize(expr)
  expect_equal(ast_op(norm), "any_column_equals")
  expect_setequal(norm$cols, c("P28_2","P28_3","P28_4"))
})

test_that("canonicalizer: AND de gte+lte → not(range_numeric) preserva semántica", {
  # AND(gte, lte) significa "en rango" (válido).
  # range_numeric significa "fuera de rango" (violación).
  # El colapso debe preservar la semántica original vía not().
  expr <- ast_and(
    ast_compare_const("edad", ">=", 0),
    ast_compare_const("edad", "<=", 120)
  )
  norm <- ast_normalize(expr)
  # Debe ser not(range_numeric(...))
  expect_equal(ast_op(norm), "not")
  inner <- norm$arg
  expect_equal(ast_op(inner), "range_numeric")
  expect_equal(inner$var, "edad")
})

test_that("canonicalizer: not(not(x)) colapsa a x", {
  x <- ast_is_missing("v")
  expect_equal(ast_hash(ast_normalize(ast_not(ast_not(x)))), ast_hash(x))
})

# =============================================================================
# Capa 2: compilador AST → R
# =============================================================================
test_that("compiler: range_numeric compila y evalúa correctamente", {
  rhs <- ast_to_r(ast_range_numeric("edad", 0, 120))
  edad <- c(5, 25, 150, NA, -3)
  res <- eval(parse(text = rhs))
  expect_equal(res, c(FALSE, FALSE, TRUE, FALSE, TRUE))
})

test_that("compiler: any_selected se corresponde con selected(var, x) OR ...", {
  rhs <- ast_to_r(ast_any_selected("IDP01", c("1","2")))
  IDP01 <- c("1", "2 3", "4", "", NA)
  res <- eval(parse(text = rhs))
  expect_equal(res, c(TRUE, TRUE, FALSE, FALSE, FALSE))
})

test_that("compiler: is_missing detecta NA, empty string y 'NA' string", {
  rhs <- ast_to_r(ast_is_missing("v"))
  v <- c(NA, "", "NA", "ok", "   ")
  res <- eval(parse(text = rhs))
  # "   " (spaces) no es missing con nuestra definición actual
  expect_equal(res, c(TRUE, TRUE, TRUE, FALSE, FALSE))
})

test_that("compiler: collection_date_cmp usa __today__ inyectado", {
  rhs <- ast_to_r(ast_collection_date_cmp("fecha", "<="))
  fecha <- as.Date(c("2025-10-01", "2025-10-05", "2026-01-15", NA))
  `__today__` <- as.Date(c("2025-10-02", "2025-10-05", "2025-10-06", "2025-10-07"))
  res <- eval(parse(text = rhs))
  # TRUE = constraint fulfilled (fecha <= today)
  expect_equal(res, c(TRUE, TRUE, FALSE, FALSE))
})

# =============================================================================
# Capa 2b: parser ODK → AST
# =============================================================================
test_that("parser: ${v} = 'x' → compare_const(v, ==, x)", {
  res <- odk_parse_to_ast("${pais} = 'PE'", context = "relevant")
  expect_false(res$degraded_to_raw)
  expect_equal(ast_op(res$ast), "compare_const")
  expect_equal(res$ast$var, "pais")
  expect_equal(res$ast$op, "==")
  expect_equal(res$ast$value, "PE")
})

test_that("parser: selected() sobre mismo var en OR → any_selected", {
  expr <- "selected(${IDP01}, '1') or selected(${IDP01}, '2')"
  res <- odk_parse_to_ast(expr, context = "relevant")
  expect_false(res$degraded_to_raw)
  expect_equal(ast_op(res$ast), "any_selected")
  expect_setequal(res$ast$values, c("1","2"))
})

test_that("parser: decomposed select_multiple (P28_* = '1') → any_column_equals", {
  expr <- "${P28_2} = '1' or ${P28_3} = '1' or ${P28_4} = '1'"
  res <- odk_parse_to_ast(expr, context = "relevant")
  expect_equal(ast_op(res$ast), "any_column_equals")
  expect_setequal(res$ast$cols, c("P28_2","P28_3","P28_4"))
})

test_that("parser: ${v} != '' → not(is_missing)", {
  res <- odk_parse_to_ast("${collectorID} != ''", context = "relevant")
  expect_equal(ast_op(res$ast), "not")
  expect_equal(ast_op(res$ast$arg), "is_missing")
})

test_that("parser: pulldata() devuelve raw con origin='pulldata'", {
  res <- odk_parse_to_ast("pulldata('catalog','col','key',${v}) != ''",
                           context = "constraint", self_var = "v")
  expect_true(res$degraded_to_raw)
  expect_equal(res$ast$origin, "pulldata")
})

test_that("parser: today() en comparación → collection_date_cmp", {
  res <- odk_parse_to_ast(". <= today()", context = "constraint",
                           self_var = "fecha")
  expect_false(res$degraded_to_raw)
  expect_equal(ast_op(res$ast), "collection_date_cmp")
  expect_equal(res$ast$var, "fecha")
  expect_equal(res$ast$op, "<=")
})

test_that("parser: regex(., 'pat') con self_var → matches_regex", {
  res <- odk_parse_to_ast("regex(., '^\\\\d+$')", context = "constraint",
                           self_var = "codigo")
  expect_false(res$degraded_to_raw)
  expect_equal(ast_op(res$ast), "matches_regex")
  expect_equal(res$ast$var, "codigo")
})

test_that("parser: smart quotes en expresión ODK se normalizan y parsean", {
  # Patrón real encontrado en RMS IDP01
  expr <- paste0("selected(., ", intToUtf8(0x2018), "6", intToUtf8(0x2019), ")")
  res <- odk_parse_to_ast(expr, context = "constraint", self_var = "v")
  expect_gte(length(res$findings), 1L)  # findings del lex normalizer
  expect_false(res$degraded_to_raw)
  expect_equal(ast_op(res$ast), "selected")
})

# =============================================================================
# Capa 4-5: make_rule + constructores
# =============================================================================
test_that("make_rule: dedup por hash — misma lógica produce mismo id", {
  r1 <- rule_catalog("pais", c("PE", "CO", "VE"))
  r2 <- rule_catalog("pais", c("VE", "PE", "CO"))
  expect_equal(r1$id, r2$id)
  expect_equal(r1$predicate_hash, r2$predicate_hash)
})

test_that("make_rule: variables se derivan del predicate", {
  r <- rule_range("edad", 0, 120,
                  gate = ast_compare_const("tiene_hijos", "==", "1"))
  expect_setequal(r$variables, c("edad", "tiene_hijos"))
})

test_that("rule_skip: genera predicado correcto para must_answer_when_true", {
  r <- rule_skip("P29",
                 gate = ast_compare_const("P28", "==", "1"),
                 direction = "must_answer_when_true")
  # Evaluamos: violación cuando P28=='1' Y P29 missing
  row <- compile_rule(r)
  rhs <- sub("^[^<]+<-\\s*", "", row$Procesamiento)
  P28 <- c("1", "1", "0", "0")
  P29 <- c("", "foo", "", "foo")
  res <- eval(parse(text = rhs))
  expect_equal(res, c(TRUE, FALSE, FALSE, FALSE))
})

test_that("validate_rule: detecta variables no existentes", {
  inst <- list(survey = data.frame(name = c("edad"), type = c("integer"),
                                    stringsAsFactors = FALSE))
  r <- rule_range("variable_fantasma", 0, 100)
  v <- validate_rule(r, inst)
  expect_false(v$ok)
  expect_true(any(grepl("variable_fantasma", v$errors)))
})

test_that("validate_rule: warning cuando tipo incoherente", {
  inst <- list(survey = data.frame(name = c("pais"), type = c("select_one country"),
                                    stringsAsFactors = FALSE))
  r <- rule_range("pais", 0, 100)
  v <- validate_rule(r, inst)
  expect_true(v$ok)
  expect_true(any(grepl("select_one", v$warnings)))
})

# =============================================================================
# Capa 6: introspection
# =============================================================================
test_that("infer_rules_from_xlsform: survey mínimo produce required + constraint", {
  survey <- data.frame(
    type = c("integer", "text"),
    name = c("edad", "nombre"),
    label = c("Edad", "Nombre"),
    required = c("yes", "yes"),
    relevant = c("", ""),
    constraint = c("(. >= 0 and . <= 120)", ""),
    stringsAsFactors = FALSE
  )
  res <- infer_rules_from_xlsform(list(survey = survey))
  tipos <- vapply(res$rules, function(r) r$tipo_regla, character(1))
  expect_equal(sum(tipos == "required"), 2L)
  expect_equal(sum(tipos == "constraint"), 1L)
})

test_that("infer_rules_from_xlsform: descarta reglas con pulldata", {
  survey <- data.frame(
    type = c("text", "text"),
    name = c("codigo", "nombre"),
    label = c("Código", "Nombre"),
    required = c("yes", "no"),
    relevant = c("", ""),
    constraint = c("pulldata('catalog','nombre','key',.) != ''", ""),
    stringsAsFactors = FALSE
  )
  res <- infer_rules_from_xlsform(list(survey = survey))
  # Ninguna regla de tipo constraint — la de pulldata se descartó
  tipos <- vapply(res$rules, function(r) r$tipo_regla, character(1))
  expect_equal(sum(tipos == "constraint"), 0L)
})

test_that("build_group_gate_map: gate acumulativo de grupos anidados", {
  survey <- data.frame(
    type = c("begin_group", "begin_group", "integer", "end_group", "end_group"),
    name = c("outer", "inner", "edad", "inner", "outer"),
    relevant = c("${consent} = '1'", "${adulto} = '1'", "", "", ""),
    required = c("", "", "yes", "", ""),
    stringsAsFactors = FALSE
  )
  res <- build_group_gate_map(survey)
  # Solo la fila 'edad' produce entrada (los begin/end no)
  expect_equal(length(res), 1L)
  vars <- ast_variables(res[[1]]$gate)
  expect_setequal(vars, c("consent", "adulto"))
})

# =============================================================================
# Capa 5b: evaluator end-to-end
# =============================================================================
test_that("evaluate_rules: detecta inconsistencias de required + range + constraint", {
  survey <- data.frame(
    type = c("integer", "integer"),
    name = c("edad", "hijos"),
    label = c("Edad", "Hijos"),
    required = c("yes", "no"),
    relevant = c("", "${edad} >= 18"),
    constraint = c("(. >= 0 and . <= 120)", ""),
    stringsAsFactors = FALSE
  )
  rules <- infer_rules_from_xlsform(list(survey = survey))$rules

  data <- data.frame(
    `_uuid` = c("U1", "U2", "U3", "U4"),
    edad = c(30, 150, 17, NA),
    hijos = c(2, NA, NA, 1),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )

  ev <- evaluate_rules(rules, data)
  required_rules <- ev$resumen[ev$resumen$tipo_regla == "required", ]
  expect_equal(
    required_rules$n_inconsistencias[required_rules$flag == rules[[1]]$flag_name],
    1L  # solo U4 tiene edad NA
  )

  constraint_rules <- ev$resumen[ev$resumen$tipo_regla == "constraint", ]
  expect_equal(constraint_rules$n_inconsistencias[1], 1L)  # solo U2 edad=150
})

test_that("evaluate_rules: __today__ se resuelve desde columna 'end'", {
  survey <- data.frame(
    type = c("date"),
    name = c("fecha"),
    label = c("Fecha"),
    required = c("no"),
    relevant = c(""),
    constraint = c(". <= today()"),
    stringsAsFactors = FALSE
  )
  rules <- infer_rules_from_xlsform(list(survey = survey))$rules

  data <- data.frame(
    fecha = as.Date(c("2025-10-01", "2026-01-15", "2025-09-20")),
    end = as.Date(c("2025-10-02", "2025-10-06", "2025-10-07"))
  )
  ev <- evaluate_rules(rules, data)
  expect_equal(ev$collection_date_col, "end")
  # Solo fila 2 (2026-01-15 > 2025-10-06) es violación
  expect_equal(ev$resumen$n_inconsistencias[ev$resumen$tipo_regla == "constraint"], 1L)
})

test_that("evaluate_rules: reglas odk_raw quedan como no_evaluada con issue_code correcto", {
  # Construimos una regla raw manualmente
  rules <- list(rule_odk_raw(
    odk_expression = "indexed-repeat(${v}, ${repeat_x}, position(..))",
    variables = "v",
    nombre = "regla experta"
  ))
  data <- data.frame(v = 1:3)
  ev <- evaluate_rules(rules, data)
  expect_equal(ev$resumen$estado[1], "no_evaluada")
  expect_equal(ev$resumen$issue_code[1], "odk_raw")
})

test_that("observations_for_rule: extrae filas con UUID y variables", {
  rule <- rule_range("edad", 0, 120)
  data <- data.frame(
    `_uuid` = c("U1", "U2"),
    edad = c(30, 150),
    check.names = FALSE
  )
  ev <- evaluate_rules(list(rule), data)
  obs <- observations_for_rule(ev$data, rule)
  expect_equal(nrow(obs), 1L)
  expect_true("_uuid" %in% names(obs))
  expect_true("edad" %in% names(obs))
})

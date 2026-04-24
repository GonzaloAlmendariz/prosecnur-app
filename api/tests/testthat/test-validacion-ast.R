# =============================================================================
# Tests del motor de validación AST
# =============================================================================
# Cubre las 7 capas del motor: lex, primitives, canonicalizer, compiler,
# parser, rules + constructors, introspection, evaluator. Los fixtures
# usan patrones reales extraídos de los 4 XLSForms ACNUR/HST/GIZ para que
# cualquier regresión afecte la validación de surveys de verdad.

# Forzar UTF-8 para que las columnas con acentos (p.ej. "Nombre técnico",
# "Sección", "Categoría") se comparen correctamente. Sin esto, en locales
# C o no-UTF-8 los caracteres no-ASCII se representan como secuencias de
# escape y el `%in%` falla.
tryCatch(Sys.setlocale("LC_CTYPE", "en_US.UTF-8"),
         error = function(e) tryCatch(Sys.setlocale("LC_CTYPE", "UTF-8"),
                                      error = function(e2) NULL))
options(encoding = "UTF-8")

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
    "validacion_ast_evaluator.R",
    "validacion_ast_bridge.R",
    "validacion_lector_limpieza.R",
    "validacion_ast_runtime.R"
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

test_that("parser: today() con offset en días → collection_date_offset_cmp", {
  res <- odk_parse_to_ast(". >= today() - 396 and . <= today()",
                          context = "constraint", self_var = "fecha")
  expect_false(res$degraded_to_raw)
  expect_equal(ast_op(res$ast), "and")
  ops <- vapply(res$ast$args, ast_op, character(1))
  expect_true("collection_date_offset_cmp" %in% ops)
  off <- res$ast$args[[which(ops == "collection_date_offset_cmp")[1]]]
  expect_equal(off$var, "fecha")
  expect_equal(off$op, ">=")
  expect_equal(off$offset_days, -396L)
})

test_that("parser: count-selected(.) en comparación → count_selected_cmp", {
  res <- odk_parse_to_ast("count-selected(.) > 1", context = "constraint",
                          self_var = "p39")
  expect_false(res$degraded_to_raw)
  expect_equal(ast_op(res$ast), "count_selected_cmp")
  expect_equal(res$ast$var, "p39")
  expect_equal(res$ast$op, ">")
  expect_equal(res$ast$n, 1L)
})

test_that("parser: exclusividad select_multiple con selected + count-selected parsea tipado", {
  expr <- "not(selected(., '96') and count-selected(.) > 1) and not(selected(., '90') and count-selected(.) > 1)"
  res <- odk_parse_to_ast(expr, context = "constraint", self_var = "p39")
  expect_false(res$degraded_to_raw)
  expect_false(any(vapply(res$ast$args, function(x) ast_op(x) == "odk_raw", logical(1))))
  expect_true("p39" %in% ast_variables(res$ast))
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

test_that("compile_rule usa nombre humano, nombre tecnico y target semantico", {
  r <- rule_skip(
    "P29",
    gate = ast_compare_const("P28", "==", "1"),
    direction = "must_answer_when_true"
  )
  row <- compile_rule(r)
  expect_true("Nombre técnico" %in% names(row))
  expect_match(row$`Nombre de regla`, "debe responderse", fixed = TRUE)
  expect_match(row$`Nombre técnico`, "^salto_p29_debe$")
  expect_equal(row$`Variable 1`, "P29")
  expect_equal(row$`Variable 2`, "P28")
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

test_that("evaluate_rules: today() tolera fechas de captura ISO con hora y zona", {
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
    fecha = c("2026-02-17", "2026-02-20"),
    end = c("2026-02-17T12:21:42.575-05:00", "2026-02-18T10:37:01.848-05:00"),
    stringsAsFactors = FALSE
  )
  ev <- evaluate_rules(rules, data)

  expect_equal(ev$collection_date_col, "end")
  expect_equal(ev$resumen$estado[ev$resumen$tipo_regla == "constraint"], "correcta")
  expect_equal(ev$resumen$n_inconsistencias[ev$resumen$tipo_regla == "constraint"], 1L)
})

test_that("constraint de fecha no marca vacios como inconsistencia", {
  survey <- data.frame(
    type = c("date"),
    name = c("fecha"),
    label = c("Fecha"),
    required = c("yes"),
    relevant = c(""),
    constraint = c(". <= today()"),
    stringsAsFactors = FALSE
  )
  rules <- infer_rules_from_xlsform(list(survey = survey))$rules

  data <- data.frame(
    fecha = c("", "2026-01-15", NA),
    end = c("2025-10-02", "2025-10-06", "2025-10-07"),
    stringsAsFactors = FALSE
  )
  ev <- evaluate_rules(rules, data)

  expect_equal(ev$resumen$n_inconsistencias[ev$resumen$tipo_regla == "required"], 2L)
  expect_equal(ev$resumen$n_inconsistencias[ev$resumen$tipo_regla == "constraint"], 1L)
})

test_that("evaluate_rules: reglas con today() quedan no_evaluadas si falta fecha de captura", {
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
    fecha = c("2025-10-01", "2026-01-15"),
    stringsAsFactors = FALSE
  )
  ev <- evaluate_rules(rules, data)

  expect_true(is.null(ev$collection_date_col))
  expect_equal(ev$resumen$estado[ev$resumen$tipo_regla == "constraint"], "no_evaluada")
  expect_equal(ev$resumen$issue_code[ev$resumen$tipo_regla == "constraint"], "missing_collection_date")
  expect_match(
    ev$resumen$detalle[ev$resumen$tipo_regla == "constraint"],
    "requiere fecha de captura",
    ignore.case = TRUE
  )
  expect_true(is.na(ev$resumen$n_inconsistencias[ev$resumen$tipo_regla == "constraint"]))
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

# =============================================================================
# Runtime AST-first: import/export, bridge legacy y compatibilidad
# =============================================================================
test_that("rule_to_json / rule_from_json preservan identidad AST", {
  rule <- rule_required("edad", gate = ast_compare_const("consent", "==", "1"))
  json <- rule_to_json(rule)
  roundtrip <- rule_from_json(json)
  expect_true(is_rule(roundtrip))
  expect_equal(roundtrip$id, rule$id)
  expect_equal(ast_hash(roundtrip$predicate), ast_hash(rule$predicate))
  expect_equal(ast_hash(roundtrip$gate), ast_hash(rule$gate))
  expect_equal(roundtrip$presentation$nombre_tecnico, rule$presentation$nombre_tecnico)
  expect_equal(roundtrip$variable_roles$target, "edad")
})

test_that("bridge_legacy_plan_rows_to_rules permite evaluar expresiones R heredadas", {
  plan <- tibble::tibble(
    ID = "LEG_001",
    Tabla = "principal",
    `Sección` = "hogar",
    `Categoría` = "Valores calculados",
    Tipo = "calculate",
    `Nombre de regla` = "calc_edad_eq",
    Objetivo = "Edad coherente",
    `Variable 1` = "edad",
    `Variable 1 - Etiqueta` = NA_character_,
    `Variable 2` = NA_character_,
    `Variable 2 - Etiqueta` = NA_character_,
    `Variable 3` = NA_character_,
    `Variable 3 - Etiqueta` = NA_character_,
    Procesamiento = "calc_edad_eq <- (!is.na(edad) & suppressWarnings(as.numeric(edad)) > 120)"
  )
  rules <- bridge_legacy_plan_rows_to_rules(plan)
  expect_length(rules, 1L)
  ev <- evaluate_rules(
    rules = rules,
    data = data.frame(edad = c(20, 150))
  )
  expect_equal(ev$resumen$estado[1], "correcta")
  expect_equal(ev$resumen$n_inconsistencias[1], 1L)
})

test_that("bridge_legacy_plan_rows_to_rules degrada pulldata legado a no_evaluada", {
  plan <- tibble::tibble(
    ID = "LEG_002",
    Tabla = "principal",
    `Sección` = "hogar",
    `Categoría` = "Valores calculados",
    Tipo = "calculate",
    `Nombre de regla` = "calc_enum_eq",
    Objetivo = "Enumerador consistente",
    `Variable 1` = "Enumerator_name",
    `Variable 2` = "Pulso_code",
    `Variable 3` = NA_character_,
    Procesamiento = "calc_enum_eq <- (!eq_chr_na(Enumerator_name, pulldata('pulso_lookup','encuestador','codigo_pulso',Pulso_code)))"
  )
  rules <- bridge_legacy_plan_rows_to_rules(plan)
  expect_length(rules, 1L)
  expect_equal(rules[[1]]$predicate$origin, "pulldata")

  ev <- evaluate_rules(
    rules = rules,
    data = data.frame(Enumerator_name = "Ana", Pulso_code = "X1", stringsAsFactors = FALSE)
  )
  expect_equal(ev$resumen$estado[1], "no_evaluada")
  expect_equal(ev$resumen$issue_code[1], "odk_raw")
})

test_that("validation_bundle_from_plan_df reconstituye reglas desde _ast_rule_json", {
  rules <- list(
    rule_required("edad"),
    rule_range("edad", min = 0, max = 120, type = "numeric")
  )
  plan <- compile_rules_to_plan(rules)
  bundle <- validation_bundle_from_plan_df(plan)
  expect_length(bundle$rules, 2L)
  expect_equal(sort(vapply(bundle$rules, function(r) r$id, character(1))),
               sort(vapply(rules, function(r) r$id, character(1))))
})

test_that("validation_bundle_from_plan_df preserva nombre tecnico canonico aunque el Excel lo edite", {
  rule <- rule_required("edad")
  plan <- compile_rules_to_plan(list(rule))
  plan$`Nombre técnico`[1] <- "slug_editado_manual"
  bundle <- validation_bundle_from_plan_df(plan)
  expect_equal(bundle$rules[[1]]$presentation$nombre_tecnico, rule$presentation$nombre_tecnico)
  expect_true(length(bundle$import_warnings) >= 1L)
})

test_that("evaluate_validation_bundle respeta perfiles de compatibilidad declarativa", {
  rule <- rule_required("p17.1")
  bundle <- list(
    rules = list(rule),
    plan = compile_rules_to_plan(list(rule)),
    compatibility = make_validation_compatibility_profile(
      optional_var_patterns = c("\\.1$")
    )
  )
  ev <- evaluate_validation_bundle(
    bundle = bundle,
    data_input = list(
      principal = data.frame(`_uuid` = "U1", check.names = FALSE),
      tables = list(principal = data.frame(`_uuid` = "U1", check.names = FALSE)),
      data_multi = list(),
      rc_checks = list()
    )
  )
  expect_equal(ev$resumen$issue_code[1], "compatible_missing_columns")
  expect_equal(ev$resumen$estado_dinamico[1], "correcta")
  expect_equal(ev$resumen$n_inconsistencias[1], 0L)
})

test_that("validation_profile_for_base deja GIZ en paridad estricta", {
  profile <- validation_profile_for_base("GIZ")
  expect_length(profile$optional_vars, 0L)
  expect_length(profile$optional_var_patterns, 0L)
  expect_length(profile$equivalent_vars, 0L)
})

test_that("evaluate_validation_bundle reporta missing_columns para p9 faltante en GIZ", {
  survey <- data.frame(
    type = c("integer", "integer", "date"),
    name = c("filtro", "consent", "p9"),
    label = c("Filtro", "Consentimiento", "Fecha de atencion"),
    required = c("", "", "yes"),
    relevant = c("", "", "${filtro} = 1 and ${consent} = 1"),
    constraint = c("", "", ". >= today() - 396 and . <= today()"),
    stringsAsFactors = FALSE
  )
  rules_all <- infer_rules_from_xlsform(list(survey = survey))$rules
  rules <- Filter(function(r) r$tipo_regla %in% c("required", "constraint"), rules_all)
  bundle <- list(
    rules = rules,
    plan = compile_rules_to_plan(rules),
    compatibility = validation_profile_for_base("GIZ")
  )
  main <- data.frame(
    filtro = "1",
    consent = "1",
    end = "2025-10-02",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  ev <- evaluate_validation_bundle(
    bundle = bundle,
    data_input = list(
      principal = main,
      tables = list(principal = main),
      data_multi = list(),
      rc_checks = list()
    )
  )

  expect_true(all(ev$resumen$issue_code %in% "missing_columns"))
  # Nueva semántica (post-audit GIZ): columna ausente del export de datos
  # no es un error del motor — es un caso "no aplicable" (la regla existe
  # en el instrumento pero no hay nada que evaluar en la base real).
  # Esto evita falsos positivos cuando ODK no exporta columnas de ramas
  # condicionales no activadas.
  expect_true(all(ev$resumen$estado_dinamico %in% "no_aplicable"))
  expect_true(all(ev$resumen$n_inconsistencias %in% 0L))
})

test_that("evaluate_validation_bundle no tolera faltantes GIZ de p10 ni sufijos .1", {
  rules <- list(
    rule_required("p10_ule"),
    rule_required("p17.1")
  )
  bundle <- list(
    rules = rules,
    plan = compile_rules_to_plan(rules),
    compatibility = validation_profile_for_base("GIZ")
  )

  ev <- evaluate_validation_bundle(
    bundle = bundle,
    data_input = list(
      principal = data.frame(`_uuid` = "U1", check.names = FALSE),
      tables = list(principal = data.frame(`_uuid` = "U1", check.names = FALSE)),
      data_multi = list(),
      rc_checks = list()
    )
  )

  expect_true(all(ev$resumen$issue_code %in% "missing_columns"))
  expect_false(any(ev$resumen$issue_code %in% "compatible_missing_columns"))
})

test_that("evaluate_validation_bundle distingue required y constraint de p9 cuando la columna existe", {
  survey <- data.frame(
    type = c("integer", "integer", "date"),
    name = c("filtro", "consent", "p9"),
    label = c("Filtro", "Consentimiento", "Fecha de atencion"),
    required = c("", "", "yes"),
    relevant = c("", "", "${filtro} = 1 and ${consent} = 1"),
    constraint = c("", "", ". >= today() - 396 and . <= today()"),
    stringsAsFactors = FALSE
  )
  rules_all <- infer_rules_from_xlsform(list(survey = survey))$rules
  rules <- Filter(function(r) r$tipo_regla %in% c("required", "constraint"), rules_all)
  bundle <- list(
    rules = rules,
    plan = compile_rules_to_plan(rules),
    compatibility = validation_profile_for_base("GIZ")
  )
  main <- data.frame(
    filtro = c("1", "1", "1"),
    consent = c("1", "1", "1"),
    p9 = c("", "2026-01-15", "2025-10-01"),
    end = c("2025-10-02", "2025-10-06", "2025-10-02"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  ev <- evaluate_validation_bundle(
    bundle = bundle,
    data_input = list(
      principal = main,
      tables = list(principal = main),
      data_multi = list(),
      rc_checks = list()
    )
  )

  resumen_por_tipo <- setNames(ev$resumen$n_inconsistencias, ev$resumen$tipo_regla)
  expect_equal(unname(resumen_por_tipo["required"]), 1L)
  expect_equal(unname(resumen_por_tipo["constraint"]), 1L)
})

test_that("evaluate_validation_bundle deja constraint de p9 como no_evaluada sin fecha de captura", {
  survey <- data.frame(
    type = c("integer", "integer", "date"),
    name = c("filtro", "consent", "p9"),
    label = c("Filtro", "Consentimiento", "Fecha de atencion"),
    required = c("", "", "yes"),
    relevant = c("", "", "${filtro} = 1 and ${consent} = 1"),
    constraint = c("", "", ". >= today() - 396 and . <= today()"),
    stringsAsFactors = FALSE
  )
  rules_all <- infer_rules_from_xlsform(list(survey = survey))$rules
  rules <- Filter(function(r) r$tipo_regla %in% c("required", "constraint"), rules_all)
  bundle <- list(
    rules = rules,
    plan = compile_rules_to_plan(rules),
    compatibility = validation_profile_for_base("GIZ")
  )
  main <- data.frame(
    filtro = c("1", "1"),
    consent = c("1", "1"),
    p9 = c("", "2026-01-15"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  ev <- evaluate_validation_bundle(
    bundle = bundle,
    data_input = list(
      principal = main,
      tables = list(principal = main),
      data_multi = list(),
      rc_checks = list()
    )
  )

  resumen_req <- ev$resumen[ev$resumen$tipo_regla == "required", , drop = FALSE]
  resumen_cons <- ev$resumen[ev$resumen$tipo_regla == "constraint", , drop = FALSE]

  expect_equal(resumen_req$n_inconsistencias[[1]], 1L)
  expect_equal(resumen_req$estado_dinamico[[1]], "correcta")
  expect_true(is.na(resumen_req$issue_code[[1]]))

  expect_equal(resumen_cons$estado_dinamico[[1]], "no_evaluada")
  expect_equal(resumen_cons$issue_code[[1]], "missing_collection_date")
  expect_match(resumen_cons$detalle[[1]], "today\\(\\)")
  expect_true(is.na(resumen_cons$n_inconsistencias[[1]]))
})

test_that("evaluate_validation_bundle usa fechas de captura ISO sucias cuando existen", {
  survey <- data.frame(
    type = c("integer", "integer", "date"),
    name = c("filtro", "consent", "p9"),
    label = c("Filtro", "Consentimiento", "Fecha de atencion"),
    required = c("", "", "yes"),
    relevant = c("", "", "${filtro} = 1 and ${consent} = 1"),
    constraint = c("", "", ". >= today() - 396 and . <= today()"),
    stringsAsFactors = FALSE
  )
  rules_all <- infer_rules_from_xlsform(list(survey = survey))$rules
  rules <- Filter(function(r) r$tipo_regla %in% c("required", "constraint"), rules_all)
  bundle <- list(
    rules = rules,
    plan = compile_rules_to_plan(rules),
    compatibility = validation_profile_for_base("GIZ")
  )
  main <- data.frame(
    filtro = c("1", "1"),
    consent = c("1", "1"),
    p9 = c("2025-10-01", "2024-09-01"),
    end = c("2026-02-17T12:21:42.575-05:00", "2026-02-18T10:37:01.848-05:00"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  ev <- evaluate_validation_bundle(
    bundle = bundle,
    data_input = list(
      principal = main,
      tables = list(principal = main),
      data_multi = list(),
      rc_checks = list()
    )
  )

  resumen_req <- ev$resumen[ev$resumen$tipo_regla == "required", , drop = FALSE]
  resumen_cons <- ev$resumen[ev$resumen$tipo_regla == "constraint", , drop = FALSE]

  expect_equal(resumen_req$n_inconsistencias[[1]], 0L)
  expect_equal(resumen_cons$estado_dinamico[[1]], "correcta")
  expect_true(is.na(resumen_cons$issue_code[[1]]))
  expect_equal(resumen_cons$n_inconsistencias[[1]], 1L)
})

test_that("evaluate_validation_bundle evalúa repeat_length con rc_checks", {
  rule <- rule_repeat_length("hh_repeat", expected = 2)
  bundle <- list(
    rules = list(rule),
    plan = compile_rules_to_plan(list(rule)),
    compatibility = make_validation_compatibility_profile()
  )
  main <- data.frame(`_uuid` = c("U1", "U2"), check.names = FALSE)
  ev <- evaluate_validation_bundle(
    bundle = bundle,
    data_input = list(
      principal = main,
      tables = list(principal = main),
      data_multi = list(),
      rc_checks = list(
        hh_repeat = list(
          by_parent = data.frame(status = c("ok", "faltan"), stringsAsFactors = FALSE)
        )
      )
    )
  )
  expect_equal(ev$resumen$n_inconsistencias[1], 1L)
  expect_true(rule$flag_name %in% names(ev$datos))
  expect_equal(sum(ev$datos[[rule$flag_name]], na.rm = TRUE), 1L)
})

test_that("ll_eval_repeats_count_expr tolera variables ausentes en repeat_count", {
  parent_row <- tibble::tibble(`_index` = "U1", n_hijos = 2L)
  expect_true(is.na(ll_eval_repeats_count_expr("${n_selected_child_edu_calcul_nc}", parent_row)))
})

test_that("legacy_safe_sum coerces character numerics before aggregating", {
  expect_equal(.legacy_safe_sum(c("1", "2", "3"), na.rm = TRUE), 6)
})

test_that("evaluate_rules detalla faltantes por rol semantico", {
  rule <- rule_required("edad", gate = ast_compare_const("consent", "==", "1"))
  ev <- evaluate_rules(list(rule), data.frame(x = 1))
  expect_equal(ev$resumen$issue_code[1], "missing_columns")
  expect_match(ev$resumen$detalle[1], "objetivo: edad")
  expect_match(ev$resumen$detalle[1], "gate: consent")
})

test_that("read_validation_data_ast fija la hoja principal como primera hoja del Excel", {
  path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path), add = TRUE)

  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "MAIN")
  openxlsx::writeData(wb, "MAIN", data.frame(
    `_index` = c("P1", "P2"),
    edad = c(20, 30),
    check.names = FALSE,
    stringsAsFactors = FALSE
  ))
  openxlsx::addWorksheet(wb, "REP")
  openxlsx::writeData(wb, "REP", data.frame(
    `_parent_index` = c("P1", "P1", "P2"),
    valor = c("a", "b", "c"),
    check.names = FALSE,
    stringsAsFactors = FALSE
  ))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)

  data_ctx <- read_validation_data_ast(path, "xlsx")
  expect_equal(nrow(data_ctx$principal), 2L)
  expect_true("edad" %in% names(data_ctx$principal))
  expect_true("MAIN" %in% names(data_ctx$tables))
  expect_true("edad" %in% names(data_ctx$tables$REP))
  expect_equal(data_ctx$tables$REP$edad, c(20, 20, 30))
})

test_that("restore_instrument_case_aliases repone nombres del instrumento tras normalizacion", {
  instrumento <- list(
    survey = data.frame(
      name = c("PERprofile", "Country"),
      stringsAsFactors = FALSE
    )
  )
  tables <- list(
    principal = data.frame(
      perprofile = "A",
      country = "PE",
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )

  aliased <- .restore_instrument_case_aliases(tables, instrumento)
  expect_true(all(c("PERprofile", "Country") %in% names(aliased$principal)))
  expect_equal(aliased$principal$PERprofile, aliased$principal$perprofile)
  expect_equal(aliased$principal$Country, aliased$principal$country)
})

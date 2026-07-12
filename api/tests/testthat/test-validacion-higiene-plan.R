# =============================================================================
# Fase 1 — Higiene del plan de validación relacional (mata el ruido)
# =============================================================================
# Cubre los tres saneamientos del motor AST validados contra el estudio PDM real:
#   A. Código/label en la inferencia → deja de marcar "desalineada" espuria una
#      regla cuyo select tiene opciones de nombre (Si/No) y la data calza con la
#      lista, aunque la regla del formulario compare contra un código posicional.
#   B. Bug del compilador `COMPARE[<=`: una comparación intraducible
#      (`int(format-date(.),'%Y') <= 2025`) degrada a modo experto sin reventar
#      el eval con R inválido (`incorrecta_ejecucion` / `parse_error`).
#   C. Reclasificar pulldata: las calculate que jalan de un roster externo
#      (`pulldata('listadoedp', …)`) se etiquetan `requires_external_dataset`,
#      distinto de "modo experto", con el nombre del roster en el detalle.

library(testthat)

`%||%` <- function(a, b) if (is.null(a) || !length(a)) b else a

# -----------------------------------------------------------------------------
# A. Código/label — el guardrail de dominio es consciente de la lista de opciones
# -----------------------------------------------------------------------------
test_that("A1 · domain_mismatch: data que calza con la lista NO se marca desalineada", {
  # Réplica del PDM: el relevant del formulario compara `${sc} = '1'` (código
  # posicional heredado) pero la lista tiene opciones de nombre Si/No/NoTell y la
  # data trae 'Si'/'No'. Sin choices → se detecta el desfase (texto vs numérico).
  # Con choices y data consistente → NO es desfase de versión: hay que evaluarla.
  rule <- list(
    id = "r_sc", nombre = "detalle si escuchó", tipo_regla = "skip",
    categoria_ux = "saltos", severidad = "media", fuente = "test",
    tabla = "principal", seccion = NA_character_, flag_name = "flag_r_sc",
    variable_roles = list(target = "f", gate = "sc"),
    gate = ast_compare_const("sc", "==", "1"),
    predicate = ast_not(ast_is_missing("f"))
  )
  data <- data.frame(
    sc = c(rep("Si", 30), rep("No", 10)),
    f  = c(rep("x", 20), rep(NA_character_, 20)),
    stringsAsFactors = FALSE
  )

  # Sin mapa de opciones → guardrail histórico: detecta desfase (valor '1'
  # numérico contra dominio de texto).
  expect_false(is.null(.rule_domain_mismatch(rule, data, choices_map = list())))

  # Con la lista real y data consistente → NO marca desfase (evalúa de verdad).
  choices_map <- list(sc = list(Si = "Sí Yes", No = "No No", NoTell = "Prefiere no responder"))
  expect_null(.rule_domain_mismatch(rule, data, choices_map = choices_map))
})

test_that("A2 · domain_mismatch: valor que ES código/etiqueta de la lista no marca desfase", {
  # `${sc} = 'Descartado'` es texto que no está en la data (dominio numérico),
  # pero SÍ es un código válido de la lista → no es desfase, no se marca.
  rule <- list(
    id = "r2", nombre = "n", tipo_regla = "skip", categoria_ux = "saltos",
    severidad = "media", fuente = "test", tabla = "principal",
    seccion = NA_character_, flag_name = "flag_r2",
    variable_roles = list(target = "f", gate = "sc"),
    gate = ast_compare_const("sc", "==", "Descartado"),
    predicate = ast_not(ast_is_missing("f"))
  )
  data <- data.frame(
    sc = c(rep("1", 30), rep("2", 10)),
    f  = rep("x", 40),
    stringsAsFactors = FALSE
  )
  cm <- list(sc = list(`1` = "Vigente", `2` = "En trámite", Descartado = "Descartado"))
  expect_null(.rule_domain_mismatch(rule, data, choices_map = cm))
})

test_that("A3 · el bundle del instrumento evalúa (no desalineada) las reglas del quirk código/label", {
  survey <- data.frame(
    type       = c("select_one yn", "text"),
    name       = c("sc", "f"),
    label      = c("Escucha activa", "Detalle"),
    required   = c("", ""),
    relevant   = c("", "${sc}='1'"),
    constraint = c("", ""),
    calculation = c("", ""),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("yn", "yn", "yn"),
    name      = c("Si", "No", "NoTell"),
    label     = c("Sí Yes", "No No", "Prefiere no responder"),
    stringsAsFactors = FALSE
  )
  inst <- list(survey = survey, choices = choices, meta = list())
  bundle <- build_validation_bundle(
    inst,
    incluir = list(required = FALSE, relevant = TRUE, constraint = FALSE,
                   calculate = FALSE, choice_filter = FALSE, other = FALSE)
  )
  expect_true(length(bundle$choices_map) >= 1L)

  data <- data.frame(
    sc = c(rep("Si", 30), rep("No", 10)),
    f  = c(rep("x", 20), rep(NA_character_, 20)),
    stringsAsFactors = FALSE
  )
  ev <- evaluate_validation_bundle(bundle, data,
                                   compatibility = make_validation_compatibility_profile())
  f_rules <- ev$resumen[ev$resumen$variable_1 == "f", , drop = FALSE]
  expect_true(nrow(f_rules) >= 1L)
  expect_false(any(f_rules$estado_dinamico == "desalineada"))
  # y quedan efectivamente evaluadas (no en un limbo)
  expect_true(all(f_rules$estado_dinamico %in% c("correcta", "no_aplicable")))
})

test_that("A4 · compare_const es agnóstico code/label cuando la data trae la etiqueta", {
  # La regla compara contra el CÓDIGO 'Si'; la data trae la ETIQUETA 'Sí Yes'.
  rhs <- ast_to_r(ast_compare_const("sc", "==", "Si"))
  sc <- c("Sí Yes", "No No", "Sí Yes", NA)
  .__choices_map__ <- list(sc = list(Si = "Sí Yes", No = "No No"))
  res <- eval(parse(text = rhs))
  expect_equal(res, c(TRUE, FALSE, TRUE, FALSE))

  # Sin mapa en el entorno → igualdad de string directa (no matchea la etiqueta).
  rm(.__choices_map__)
  res2 <- eval(parse(text = rhs))
  expect_equal(res2, c(FALSE, FALSE, FALSE, FALSE))
})

# -----------------------------------------------------------------------------
# B. Bug del compilador COMPARE[<= — degradación limpia, sin reventar
# -----------------------------------------------------------------------------
test_that("B1 · comparación intraducible degrada a odk_raw (no AST 'exitoso' inválido)", {
  res <- odk_parse_to_ast("int(format-date(${date_residing}, '%Y')) <= 2025",
                          context = "relevant")
  expect_true(res$degraded_to_raw)
  expect_equal(ast_op(res$ast), "odk_raw")
  expect_match(as.character(res$ast$origin), "^complex_expr:")
  # el escape hatch preserva la expresión ODK original, no el marcador sintético
  expect_false(grepl("COMPARE\\[", as.character(res$ast$expression)))
})

test_that("B2 · .build_compare sigue marcando el fallback con origin reconocible", {
  # Regresión del contrato: un compare que no cabe en el enum emite un odk_raw
  # con origin build_compare_complex, que el parser degrada.
  node <- .build_compare(ast_odk_raw("int(...)", origin = "int"), "<=",
                         .__num(2025), context = "relevant")
  expect_equal(ast_op(node), "odk_raw")
  expect_equal(as.character(node$origin), "build_compare_complex")
  expect_true(.ast_has_untranslatable_raw(node))
})

test_that("B3 · una regla con la comparación intraducible NO revienta el eval", {
  survey <- data.frame(
    type       = c("date", "select_one yn"),
    name       = c("date_residing", "censo"),
    label      = c("Fecha de residencia", "Participó en censo"),
    required   = c("", "yes"),
    relevant   = c("", "int(format-date(${date_residing}, '%Y')) <= 2025"),
    constraint = c("", ""),
    calculation = c("", ""),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("yn", "yn"), name = c("Yes", "No"),
    label = c("Sí", "No"), stringsAsFactors = FALSE
  )
  inst <- list(survey = survey, choices = choices, meta = list())
  bundle <- build_validation_bundle(
    inst,
    incluir = list(required = TRUE, relevant = TRUE, constraint = FALSE,
                   calculate = FALSE, choice_filter = FALSE, other = FALSE)
  )
  # el plan no debe contener el marcador sintético
  expect_false(any(grepl("COMPARE\\[|ARITH\\[", as.character(bundle$plan$Procesamiento %||% ""))))

  data <- data.frame(
    date_residing = rep("2024-05-01", 40),
    censo = c(rep("Yes", 30), rep(NA_character_, 10)),
    stringsAsFactors = FALSE
  )
  ev <- evaluate_validation_bundle(bundle, data,
                                   compatibility = make_validation_compatibility_profile())
  censo_rules <- ev$resumen[ev$resumen$variable_1 == "censo" |
                            grepl("censo", ev$resumen$flag), , drop = FALSE]
  expect_true(nrow(censo_rules) >= 1L)
  # nunca incorrecta_ejecucion ni error de compilación/parseo
  expect_false(any(censo_rules$estado_dinamico == "incorrecta_ejecucion"))
  expect_false(any(censo_rules$issue_code %in%
                     c("parse_error", "compile_error", "runtime_error"), na.rm = TRUE))
})

test_that("B4 · un gate con odk_raw intraducible cae en resiliencia (modo experto), no error", {
  rule <- list(
    id = "rg", nombre = "req bajo gate raro", tipo_regla = "required",
    categoria_ux = "completitud", severidad = "media", fuente = "test",
    tabla = "principal", seccion = NA_character_, flag_name = "flag_rg",
    variable_roles = list(target = "q", gate = "d"),
    gate = ast_odk_raw("COMPARE[<=]", origin = "build_compare_complex"),
    predicate = ast_is_missing("q")
  )
  data <- data.frame(q = c("a", NA, "b"), d = c("x", "y", "z"), stringsAsFactors = FALSE)
  ev <- evaluate_rules(list(rule), data)
  expect_equal(ev$resumen$estado[1], "no_evaluada")
  expect_equal(ev$resumen$issue_code[1], "odk_raw")
})

# -----------------------------------------------------------------------------
# C. Reclasificar pulldata → requires_external_dataset (no "modo experto")
# -----------------------------------------------------------------------------
test_that("C1 · una calculate pulldata se infiere como regla con origin pulldata", {
  survey <- data.frame(
    type        = c("text", "calculate"),
    name        = c("telephone", "sede_ppl"),
    label       = c("Teléfono", "Sede (roster)"),
    required    = c("", ""),
    relevant    = c("", ""),
    constraint  = c("", ""),
    calculation = c("", "pulldata('listadoedp', 'Sede', 'Telefono', ${telephone})"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  res <- infer_rules_from_xlsform(list(survey = survey, choices = NULL))
  ppl <- Filter(function(r) identical(as.character(r$primary_var %||% ""), "sede_ppl"), res$rules)
  expect_length(ppl, 1L)
  expect_equal(as.character(ppl[[1]]$predicate$origin), "pulldata")
})

test_that("C2 · la regla pulldata se evalúa como requires_external_dataset con el roster en el detalle", {
  survey <- data.frame(
    type        = c("text", "calculate"),
    name        = c("telephone", "sede_ppl"),
    label       = c("Teléfono", "Sede (roster)"),
    required    = c("", ""),
    relevant    = c("", ""),
    constraint  = c("", ""),
    calculation = c("", "pulldata('listadoedp', 'Sede', 'Telefono', ${telephone})"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  inst <- list(survey = survey, choices = NULL, meta = list())
  bundle <- build_validation_bundle(inst)
  data <- data.frame(telephone = c("999", "888"), sede_ppl = c("A", "B"), stringsAsFactors = FALSE)
  ev <- evaluate_validation_bundle(bundle, data,
                                   compatibility = make_validation_compatibility_profile())
  row <- ev$resumen[ev$resumen$variable_1 == "sede_ppl", , drop = FALSE]
  expect_true(nrow(row) >= 1L)
  expect_equal(row$estado_dinamico[1], "no_evaluada")
  expect_equal(row$issue_code[1], "requires_external_dataset")
  expect_match(row$detalle[1], "listadoedp", fixed = TRUE)
})

test_that("C3 · requires_external_dataset es distinto de 'modo experto' (odk_raw)", {
  # Dos reglas raw: una pulldata (roster externo) y una expresión experta pura.
  r_pull <- rule_odk_raw(
    odk_expression = "pulldata('roster_x', 'a', 'k', v)",
    variables = "v", nombre = "pull", origin = "pulldata"
  )
  r_exp <- rule_odk_raw(
    odk_expression = "indexed-repeat(${x}, ${rep}, position(..))",
    variables = "x", nombre = "experto", origin = "indexed_repeat"
  )
  data <- data.frame(v = 1:2, x = 1:2, stringsAsFactors = FALSE)
  ev <- evaluate_rules(list(r_pull, r_exp), data)
  pull <- ev$resumen[ev$resumen$flag == r_pull$flag_name, ]
  exp  <- ev$resumen[ev$resumen$flag == r_exp$flag_name, ]
  expect_equal(pull$issue_code[1], "requires_external_dataset")
  expect_equal(exp$issue_code[1], "odk_raw")
})

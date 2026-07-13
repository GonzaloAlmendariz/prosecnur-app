# =============================================================================
# Tests: builtins ODK de valor number()/int() en calculate_check
# =============================================================================
# Cubre el fix del bug ACNUR_PDM: las calculate del tipo
#   p_spaceNN = if(${SPACENN} != '99' and ${SPACENN} != '', number(${SPACENN}), 0)
# se recompilan (path legacy) a R que llama `number(...)`/`int(...)`. Sin esos
# builtins en el entorno de evaluación, el eval reventaba con
# "could not find function 'number'". Ahora `.vd_odk_number`/`.vd_odk_int` viven
# en la capa runtime compartida y el evaluador los inyecta en `eval_env`.

tryCatch(Sys.setlocale("LC_CTYPE", "en_US.UTF-8"),
         error = function(e) tryCatch(Sys.setlocale("LC_CTYPE", "UTF-8"),
                                      error = function(e2) NULL))
options(encoding = "UTF-8")

# ---- (a) Semántica de los builtins de valor -------------------------------

test_that("number(): coerción a numérico con vacío/no-numérico → NA", {
  expect_identical(.vd_odk_number("5"), 5)
  expect_identical(.vd_odk_number("2.7"), 2.7)
  expect_true(is.na(.vd_odk_number("")))
  expect_true(is.na(.vd_odk_number("abc")))
  # Vectorizado: preserva el largo y mapea cada valor.
  expect_equal(.vd_odk_number(c("5", "", "99", "0")),
               c(5, NA, 99, 0))
})

test_that("int(): trunca hacia cero (no redondea ni va a -Inf)", {
  expect_identical(.vd_odk_int("2.7"), 2)
  expect_identical(.vd_odk_int("-2.7"), -2)   # hacia cero, no floor (-3)
  expect_identical(.vd_odk_int("3"), 3)
  expect_identical(.vd_odk_int(2.7), 2)
  expect_identical(.vd_odk_int(-2.7), -2)
  expect_true(is.na(.vd_odk_int("")))
})

test_that("ifelse selecciona la rama correcta y el NA de la rama no elegida no ensucia", {
  # Réplica del patrón ODK if(cond, number(x), 0): cuando cond=TRUE y x es
  # vacío en OTRA fila, el NA de la rama number no debe filtrarse a la rama 0.
  x <- c("5", "", "99", "3")
  cond <- !is.na(x) & x != "99" & x != ""
  out <- ifelse(cond, .vd_odk_number(x), 0)
  expect_equal(out, c(5, 0, 0, 3))
  # La fila 2 (x="") tomó la rama 0 (cond=FALSE); number("")=NA se descartó.
  expect_false(is.na(out[2]))
})

# ---- (b) calculate_check end-to-end con number()/int() --------------------
# Se construye la regla con el MISMO shape que produce el bridge legacy
# (origin="legacy_r_expr", predicate = expresión R recompilada) y se evalúa
# sobre un data.frame chico. Antes del fix esto reventaba en eval con
# "could not find function 'number'".

test_that("calculate_check con number() evalúa y marca el flag correcto", {
  data <- data.frame(
    X   = c("5", "99", "", "3", "abc"),
    p_x = c(5,    0,    0,   9,   0),   # fila 4: data=9 ≠ recompute(3) → inconsistente
    stringsAsFactors = FALSE
  )
  rhs <- "!eq_num_na(p_x, ifelse(X != 99 & X != '', number(X), 0))"
  regla <- rule_odk_raw(
    odk_expression = rhs,
    variables = c("p_x", "X"),
    nombre = "p_x calculada coincide",
    origin = "legacy_r_expr"
  )
  res <- evaluate_rules(list(regla), data)
  fila <- res$resumen[1, ]
  expect_identical(as.character(fila$estado), "correcta")
  expect_true(is.na(fila$issue_code))
  # Solo la fila 4 (data=9 vs recompute=3) es inconsistente.
  flag <- res$data[[regla$flag_name]]
  expect_equal(which(flag), 4L)
  expect_identical(as.integer(fila$n_inconsistencias), 1L)
})

test_that("calculate_check con int() evalúa sin 'could not find function'", {
  data <- data.frame(
    Y   = c("2.7", "-2.7", "", "99"),
    p_y = c(2,      -2,      0,   0),
    stringsAsFactors = FALSE
  )
  rhs <- "!eq_num_na(p_y, ifelse(Y != 99 & Y != '', int(Y), 0))"
  regla <- rule_odk_raw(
    odk_expression = rhs,
    variables = c("p_y", "Y"),
    nombre = "p_y truncada coincide",
    origin = "legacy_r_expr"
  )
  res <- evaluate_rules(list(regla), data)
  fila <- res$resumen[1, ]
  expect_identical(as.character(fila$estado), "correcta")
  expect_true(is.na(fila$issue_code))
  # Todas coinciden (truncamiento hacia cero) → 0 inconsistencias.
  expect_identical(as.integer(fila$n_inconsistencias), 0L)
})

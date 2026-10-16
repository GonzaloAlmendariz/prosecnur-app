# ADR 0106, regla `formula`: una variable calculada como expresión aritmética
# sobre columnas de su base, interpretada sin evaluar código R.

test_that("el parser respeta precedencia, paréntesis y el signo menos", {
  df <- data.frame(a = c(2, 4), b = c(3, 1))
  ev <- function(x) base_variables_formula_evaluar(base_variables_formula_parsear(x), df)
  expect_identical(ev("a + b * 2"), c(8, 6))
  expect_identical(ev("(a + b) * 2"), c(10, 10))
  expect_identical(ev("-a + 10"), c(8, 6))
  expect_identical(ev("10 - a - b"), c(5, 5))
  expect_identical(ev("a / b"), round(c(2 / 3, 4), 10))
  expect_identical(ev("2026 - a"), c(2024, 2022))
  expect_identical(ev("a × b − 1"), c(5, 3))
  expect_identical(base_variables_formula_variables(base_variables_formula_parsear("(P5 + P6) / P5 * 100")),
                   c("P5", "P6"))
  # Comillas invertidas para un nombre con guion.
  df2 <- data.frame(`x-1` = 5, check.names = FALSE)
  expect_identical(base_variables_formula_evaluar(base_variables_formula_parsear("`x-1` * 2"), df2), 10)
})

test_that("una expresión que no es aritmética se rechaza con su código y sin ejecutar nada", {
  err <- function(x) tryCatch(base_variables_formula_parsear(x), api_error = function(e) e$code)
  for (x in c("", "a +", "(a + b", "a b", "a + )", "system('ls')", "a ^ 2", "a; b", "2,5 * a", "a == 1")) {
    expect_identical(err(x), "E_BASE_VARIABLE_FORMULA_INVALIDA", info = x)
  }
})

test_that("vacíos, texto, división por cero y especiales de una lista dan sin dato", {
  df <- data.frame(p8 = c("2024", "88", NA, "x", "2026"), n = c(2, 0, 1, 1, 1), stringsAsFactors = FALSE)
  arbol <- base_variables_formula_parsear("2026 - p8")
  expect_identical(base_variables_formula_evaluar(arbol, df, especiales_na = "p8"), c(2, NA, NA, NA, 0))
  # Sin lista de respuestas, un 88 es un número.
  expect_identical(base_variables_formula_evaluar(arbol, df), c(2, 1938, NA, NA, 0))
  expect_identical(base_variables_formula_evaluar(base_variables_formula_parsear("1 / n"), df),
                   c(0.5, NA, 1, 1, 1))
})

test_that("validar: una fórmula guarda sus variables, la expresión y qué variables tienen lista", {
  cols <- c("q1", "q3", "m")
  ok <- base_variables_validar_calculada(
    list(nombre = "f", regla = "formula", expresion = "  q3 * 2 + q1 "), cols, cols,
    con_lista = c("q1"), multiples = "m")
  expect_identical(ok$expresion, "q3 * 2 + q1")
  expect_identical(unlist(ok$variables), c("q3", "q1"))
  expect_identical(unlist(ok$especiales_na), "q1")
  expect_length(ok$escala, 0L)
  err <- function(cv) tryCatch(base_variables_validar_calculada(cv, cols, cols, multiples = "m"),
                               api_error = function(e) e$code)
  expect_identical(err(list(nombre = "f", regla = "formula", expresion = "zz + 1")), "E_BASE_VARIABLE_INEXISTENTE")
  expect_identical(err(list(nombre = "f", regla = "formula", expresion = "2026")), "E_BASE_VARIABLE_REGLA_INCOMPLETA")
  expect_identical(err(list(nombre = "f", regla = "formula", expresion = "f + 1")), "E_BASE_VARIABLE_REGLA_INCOMPLETA")
  expect_identical(err(list(nombre = "f", regla = "formula", expresion = "m + 1")), "E_BASE_VARIABLE_FORMULA_INVALIDA")
  expect_identical(err(list(nombre = "f", regla = "formula", expresion = "q3 +")), "E_BASE_VARIABLE_FORMULA_INVALIDA")
})

test_that("una fórmula entra como decimal, se encadena con una recodificación y no se borra si otra depende", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  out <- base_variables_guardar_calculada(sid, "2026", list(
    nombre = "q3_doble", etiqueta = "Edad por dos", regla = "formula", expresion = "q3 * 2"))
  expect_identical(out$resumen$n_validos, 40L)
  expect_identical(out$resumen$minimo, 36)
  expect_identical(out$resumen$maximo, 54)
  # q1 es select_one: su 99 cuenta como sin dato.
  out2 <- base_variables_guardar_calculada(sid, "2026", list(
    nombre = "q1_mas", regla = "formula", expresion = "q1 + 10"))
  expect_identical(unlist(out2$calculada$especiales_na), "q1")
  expect_identical(out2$resumen$n_sin_dato, 16L)

  # Recodificar a partir de la fórmula: tramos sobre una calculada anterior.
  mapa <- stats::setNames(as.list(ifelse(seq(36, 54, 2) < 46, "1", "2")), seq(36, 54, 2))
  out3 <- base_variables_guardar_calculada(sid, "2026", list(
    nombre = "q3_tramo", regla = "recodificar", variables = list("q3_doble"),
    mapa = mapa, escala = list(list(codigo = "1", etiqueta = "Menos de 46"), list(codigo = "2", etiqueta = "46 o más"))))
  n <- vapply(out3$resumen$por_codigo, `[[`, 0L, "n")
  expect_identical(sum(n), 40L)

  s <- session_get(sid)
  sv <- s$rp_inst_sources[["2026"]]$survey
  expect_identical(sv$type[sv$name == "q3_doble"], "decimal")
  expect_identical(as.numeric(s$rp_data_sources[["2026"]]$q3_doble[1:2]), c(38, 40))
  expect_true(all(!is.na(s$rp_data_sources[["2026"]]$q3_tramo)))

  # Reemplazar la fórmula conserva su lugar (antes que su recodificación).
  base_variables_guardar_calculada(sid, "2026", list(nombre = "q3_doble", regla = "formula", expresion = "q3 * 2"))
  orden <- vapply(session_get(sid)$estudio$bases[["2026"]]$variables_calculadas, `[[`, "", "nombre")
  expect_identical(orden, c("q3_doble", "q1_mas", "q3_tramo"))

  expect_identical(tryCatch(base_variables_quitar_calculada(sid, "2026", "q3_doble"),
                            api_error = function(e) e$code), "E_BASE_VARIABLE_EN_USO")
  base_variables_quitar_calculada(sid, "2026", "q3_tramo")
  base_variables_quitar_calculada(sid, "2026", "q3_doble")
  expect_identical(vapply(session_get(sid)$estudio$bases[["2026"]]$variables_calculadas, `[[`, "", "nombre"), "q1_mas")
})

# Respuestas casi iguales: con qué otro caso coincide cada una
# (validacion_operational_controls.R).
#
# La regla OP_duplicates marca las dos entrevistas de cada pareja, pero no
# guardaba la pareja. Las parejas se arman sobre las filas que la regla ya
# marcó, con el mismo criterio, y una fila marcada siempre tiene compañera.

.m2_datos_parecidos <- function() {
  set.seed(11)
  vars <- sprintf("q%02d", 1:12)
  df <- as.data.frame(matrix(sample(1:5, 8 * 12, replace = TRUE), nrow = 8,
                             dimnames = list(NULL, vars)))
  df$id <- sprintf("e%d", 1:8)
  df[3, vars] <- df[1, vars]; df[3, "q12"] <- (df[1, "q12"] %% 5) + 1  # 11 de 12
  df[6, vars] <- df[5, vars]                                           # idénticas
  df[8, vars[1:3]] <- NA                                               # poca cobertura
  list(df = df, vars = vars)
}

test_that("cada fila marcada tiene su pareja y las parejas no marcan filas nuevas", {
  x <- .m2_datos_parecidos()
  marcadas <- .vd_duplicate_similarity(x$df, x$vars, threshold = 0.9, minimum_coverage = 0.8)
  expect_identical(which(marcadas), c(1L, 3L, 5L, 6L))
  parejas <- validacion_parejas_casi_iguales(x$df, x$vars, marcadas, 0.9, 0.8)
  expect_identical(nrow(parejas), 2L)
  expect_identical(sort(unique(c(parejas$fila_a, parejas$fila_b))), which(marcadas))
  p13 <- parejas[parejas$fila_a == 1L, ]
  expect_identical(p13$fila_b, 3L)
  expect_identical(p13$n_coincidencias, 11L)
  expect_equal(p13$similitud, 11 / 12)
  expect_equal(parejas$similitud[parejas$fila_a == 5L], 1)
})

test_that("una evaluación con la regla de respuestas casi iguales publica la pareja por id de caso", {
  x <- .m2_datos_parecidos()
  config <- list(version = 2L, duplicates = list(enabled = TRUE, variables = as.list(x$vars),
                                                 similarity_threshold = 0.9, minimum_coverage = 0.8))
  reglas <- validation_operational_rules(config)
  bundle <- list(rules = reglas, plan = compile_rules_to_plan(reglas))
  ev <- suppressWarnings(evaluate_validation_bundle(bundle, list(principal = x$df, tables = list(principal = x$df)),
                                                    strict = FALSE))
  parejas <- validacion_parejas_de_evaluacion(ev, "OP_duplicates")
  expect_identical(nrow(parejas), 2L)
  # Sin columna candidata ni llave: número de fila.
  co <- validacion_coincidencias_de_caso(parejas, "principal::row::3")
  expect_identical(co[[1]]$id_caso, "principal::row::1")
  expect_identical(co[[1]]$n_coincidencias, 11L)
  # Con la llave declarada, el id de la llave.
  parejas_llave <- validacion_parejas_de_evaluacion(ev, "OP_duplicates", identidad = "id")
  expect_identical(validacion_coincidencias_de_caso(parejas_llave, "e6")[[1]]$id_caso, "e5")
  # Sin pareja: NULL, nunca una lista vacía.
  expect_null(validacion_coincidencias_de_caso(parejas_llave, "e2"))
})

test_that("una fila marcada sin pareja publica null, no una lista vacía", {
  x <- .m2_datos_parecidos()
  config <- list(version = 2L, duplicates = list(enabled = TRUE, variables = as.list(x$vars),
                                                 similarity_threshold = 0.9, minimum_coverage = 0.8))
  reglas <- validation_operational_rules(config)
  bundle <- list(rules = reglas, plan = compile_rules_to_plan(reglas))
  ev <- suppressWarnings(evaluate_validation_bundle(bundle, list(principal = x$df, tables = list(principal = x$df)),
                                                    strict = FALSE))
  completas <- validacion_parejas_de_evaluacion(ev, "OP_duplicates")
  # Se quita la pareja (1, 3): las filas 1 y 3 siguen marcadas sin compañera.
  local_mocked_bindings(validacion_parejas_de_evaluacion = function(...) completas[completas$fila_a != 1L, ])
  scope <- list(evaluacion = ev)
  casos_df <- x$df[c(1, 3, 5, 6), "id", drop = FALSE]
  det <- .validacion_drill_detalle_casos(scope, "OP_duplicates", casos_df, list(), NULL)
  expect_identical(det$case_ids, sprintf("principal::row::%d", c(1, 3, 5, 6)))
  expect_true(is.na(det$coincide_con[[1]]))
  expect_true(is.na(det$coincide_con[[2]]))
  expect_identical(det$coincide_con[[3]][[1]]$id_caso, "principal::row::6")
})

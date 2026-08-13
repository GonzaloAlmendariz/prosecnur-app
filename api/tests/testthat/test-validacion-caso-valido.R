# L14 del GOAL de validación extrínseca: el criterio de caso válido se declara
# una vez en vez de vivir repetido en el `relevant` de cada pregunta.
#
# Nada acá nombra una variable de un proyecto: el sugeridor descubre el criterio
# midiendo cuántas reglas gobierna cada variable de gate.

source("setup-load-all.R")

.cv_resumen <- function(gates_por_regla) {
  data.frame(id_regla = sprintf("R%03d", seq_along(gates_por_regla))) |>
    (\(df) { df$variable_roles <- lapply(gates_por_regla, function(g) list(gate = g)); df })()
}

test_that("propone como criterio la variable que gobierna casi todas las reglas", {
  # 9 de 10 reglas la tienen en su gate: quien armó el formulario ya la usaba
  # como condición para que una pregunta aplique.
  # `otra` aparece en 4 de 10: no llega al umbral y sirve de contraste.
  resumen <- .cv_resumen(c(rep(list(c("consentimiento", "otra")), 4),
                           rep(list("consentimiento"), 5), list("otra")))
  data <- data.frame(consentimiento = rep("si", 50), otra = rep("x", 50),
                     stringsAsFactors = FALSE)

  cands <- caso_valido_candidatas(resumen, data)
  expect_length(cands, 1L)
  expect_identical(cands[[1]]$variable, "consentimiento")
  expect_identical(unlist(cands[[1]]$valores), "si")
  expect_identical(cands[[1]]$n_reglas_gobernadas, 9L)
})

test_that("no propone una variable que aparece en pocas reglas", {
  # Control: sin dominancia no es un criterio de universo, es una condición más.
  resumen <- .cv_resumen(c(rep(list("marginal"), 2), rep(list("otra"), 5),
                           rep(list("tercera"), 3)))
  data <- data.frame(marginal = rep("si", 20), otra = rep("x", 20),
                     tercera = rep("y", 20), stringsAsFactors = FALSE)
  expect_length(caso_valido_candidatas(resumen, data), 0L)
})

test_that("no propone si el valor dominante no concentra la base", {
  # Gobierna todas las reglas pero la base se parte 50/50: declararla como
  # criterio dejaría fuera a media muestra sin que nadie lo haya decidido.
  resumen <- .cv_resumen(rep(list("mitad"), 10))
  data <- data.frame(mitad = rep(c("a", "b"), each = 25), stringsAsFactors = FALSE)
  expect_length(caso_valido_candidatas(resumen, data), 0L)
})

test_that("sin criterio declarado la base entera es el universo", {
  # Es lo que pasaba antes de que esto existiera, y debe seguir pasando para los
  # proyectos que no lo declaren.
  data <- data.frame(a = c("1", "2", "3"), stringsAsFactors = FALSE)
  expect_true(all(caso_valido_marcar(data, NULL)))
  expect_true(all(caso_valido_marcar(data, list(caso_valido = list(enabled = FALSE)))))
})

test_that("todas las condiciones deben cumplirse", {
  data <- data.frame(
    consent = c("si", "si", "no", "si"),
    prueba  = c("real", "test", "real", "real"),
    stringsAsFactors = FALSE
  )
  cfg <- list(caso_valido = list(enabled = TRUE, condiciones = list(
    list(variable = "consent", operador = "==", valores = "si"),
    list(variable = "prueba", operador = "==", valores = "real")
  )))
  # Solo 1 y 4: el 2 es prueba y el 3 no consintió.
  expect_identical(which(caso_valido_marcar(data, cfg)), c(1L, 4L))
})

test_that("una variable ausente no descarta casos", {
  # Si la base no trae la columna declarada, excluir todo sería peor que no
  # filtrar: dejaría el universo en cero sin que nadie lo note.
  data <- data.frame(a = c("1", "2"), stringsAsFactors = FALSE)
  cfg <- list(caso_valido = list(enabled = TRUE, condiciones = list(
    list(variable = "no_existe", operador = "==", valores = "x")
  )))
  expect_true(all(caso_valido_marcar(data, cfg)))
})

test_that("el resumen del universo dice cuántos entran y cuántos no", {
  data <- data.frame(prueba = c("real", "test", "real"), stringsAsFactors = FALSE)
  cfg <- list(caso_valido = list(enabled = TRUE, condiciones = list(
    list(variable = "prueba", operador = "==", valores = "real")
  )))
  out <- caso_valido_resumen(data, cfg)
  expect_true(out$declarado)
  expect_identical(out$n_total, 3L)
  expect_identical(out$n_validos, 2L)
  expect_identical(out$n_excluidos, 1L)

  sin <- caso_valido_resumen(data, NULL)
  expect_false(sin$declarado)
  expect_identical(sin$n_validos, 3L)
})

test_that("los cuatro operadores hacen lo que dicen", {
  data <- data.frame(x = c("a", "b", "c", "d"), stringsAsFactors = FALSE)
  mk <- function(op, vals) list(caso_valido = list(enabled = TRUE, condiciones = list(
    list(variable = "x", operador = op, valores = vals))))
  expect_identical(which(caso_valido_marcar(data, mk("==", "a"))), 1L)
  expect_identical(which(caso_valido_marcar(data, mk("!=", "a"))), 2:4)
  expect_identical(which(caso_valido_marcar(data, mk("in", c("a", "c")))), c(1L, 3L))
  expect_identical(which(caso_valido_marcar(data, mk("not_in", c("a", "c")))), c(2L, 4L))
})

test_that("operational_config valida las condiciones declaradas", {
  ok <- normalize_validation_operational_config(
    list(version = 2L, caso_valido = list(enabled = TRUE, condiciones = list(
      list(variable = "consent", operador = "==", valores = list("si"))))),
    available_variables = "consent"
  )
  expect_true(ok$caso_valido$enabled)
  expect_identical(ok$caso_valido$condiciones[[1]]$variable, "consent")

  # Activado sin condiciones: incompleto.
  e1 <- tryCatch(normalize_validation_operational_config(
    list(version = 2L, caso_valido = list(enabled = TRUE, condiciones = list()))
  ), error = function(e) e)
  expect_identical(e1$code, "E_OPERATIONAL_VALIDEZ_INCOMPLETA")

  # Operador inventado.
  e2 <- tryCatch(normalize_validation_operational_config(
    list(version = 2L, caso_valido = list(enabled = TRUE, condiciones = list(
      list(variable = "c", operador = "≈", valores = list("si")))))
  ), error = function(e) e)
  expect_identical(e2$code, "E_OPERATIONAL_VALIDEZ_OPERADOR")

  # Variable que no está en la base.
  e3 <- tryCatch(normalize_validation_operational_config(
    list(version = 2L, caso_valido = list(enabled = TRUE, condiciones = list(
      list(variable = "fantasma", operador = "==", valores = list("si"))))),
    available_variables = "consent"
  ), error = function(e) e)
  expect_identical(e3$code, "E_OPERATIONAL_VARIABLE_UNKNOWN")
})

test_that("la config sin caso_valido sigue siendo válida", {
  cfg <- normalize_validation_operational_config(list(version = 2L))
  expect_false(cfg$caso_valido$enabled)
  expect_length(cfg$caso_valido$condiciones, 0L)
})

test_that("advierte cuando una candidata parece una ruta del estudio", {
  # Caso real: en un estudio con dos rutas, la variable de ruta gobernaba 377 de
  # 425 reglas —las preguntas de cada rama dependen de ella— y el sugeridor la
  # proponía como criterio de validez. Adoptarla habría sacado del universo a
  # los 16 casos de la otra ruta, que son perfectamente válidos.
  #
  # No se puede distinguir por semántica sin nombrar variables. Se distingue por
  # su efecto: se mide cuántos casos sacaría y se advierte.
  resumen <- .cv_resumen(rep(list(c("consent", "ruta")), 10))
  data <- data.frame(
    consent = rep("si", 100),                       # lo cumplen todos
    ruta = c(rep("A", 85), rep("B", 15)),           # parte la muestra
    stringsAsFactors = FALSE
  )
  cands <- caso_valido_candidatas(resumen, data)
  expect_length(cands, 2L)

  # La que no saca a nadie va primero.
  expect_identical(cands[[1]]$variable, "consent")
  expect_identical(cands[[1]]$n_casos_excluiria, 0L)
  expect_false(cands[[1]]$probable_rama)

  expect_identical(cands[[2]]$variable, "ruta")
  expect_identical(cands[[2]]$n_casos_excluiria, 15L)
  expect_true(cands[[2]]$probable_rama)
  expect_true(grepl("ruta del estudio", cands[[2]]$porque, fixed = TRUE))
})

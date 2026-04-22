# =============================================================================
# Tests para compile_reglas_custom y .validar_regla_custom (Sprint 4)
# =============================================================================
# Motor de reglas personalizadas de Validación v2. Los 8 tipos soportados se
# compilan a filas del plan de limpieza estándar con `Procesamiento` como
# expresión R que debe evaluar TRUE cuando hay inconsistencia.
#
# Estos tests son unitarios y auto-contenidos (no requieren xlsform ni data
# externos) para poder correrse rápido en CI.

# ----- Helpers de test --------------------------------------------------------

# Parsea y evalúa el Procesamiento de una fila de plan sobre un data.frame
# dado. Devuelve el vector lógico que el evaluador generaría.
eval_procesamiento <- function(row, df) {
  env <- list2env(as.list(df), parent = globalenv())
  expr <- parse(text = as.character(row$Procesamiento))
  eval(expr, envir = env)
  # El Procesamiento asigna `rc_<id> <-` dentro de env; extraemos ese binding.
  nombres <- ls(env)
  rc <- nombres[startsWith(nombres, "rc_")]
  expect_length(rc, 1)
  env[[rc]]
}

# ----- no_nulo ----------------------------------------------------------------

test_that("no_nulo marca NA, '' y 'NA' como violación", {
  r <- list(id = "t1", tipo = "no_nulo", variables = list("p1"), activa = TRUE)
  plan <- compile_reglas_custom(list(r))
  expect_equal(nrow(plan), 1L)
  expect_equal(plan$Tipo, "custom:no_nulo")

  df <- data.frame(p1 = c("a", "", NA, "NA", "b"), stringsAsFactors = FALSE)
  viol <- eval_procesamiento(plan[1, ], df)
  expect_identical(viol, c(FALSE, TRUE, TRUE, TRUE, FALSE))
})

# ----- rango_num --------------------------------------------------------------

test_that("rango_num marca valores fuera del rango inclusivo", {
  r <- list(
    id = "t2", tipo = "rango_num", variables = list("edad"),
    params = list(min = 0, max = 120), activa = TRUE
  )
  plan <- compile_reglas_custom(list(r))
  df <- data.frame(edad = c(-1, 0, 50, 120, 121, NA))
  viol <- eval_procesamiento(plan[1, ], df)
  expect_identical(viol, c(TRUE, FALSE, FALSE, FALSE, TRUE, FALSE))
})

test_that("rango_num rechaza rango invertido y vacío", {
  expect_error(
    compile_reglas_custom(list(list(
      id = "t", tipo = "rango_num", variables = list("x"),
      params = list(min = 10, max = 5), activa = TRUE
    ))),
    class = "api_error"
  )
  expect_error(
    compile_reglas_custom(list(list(
      id = "t", tipo = "rango_num", variables = list("x"),
      params = list(), activa = TRUE
    ))),
    class = "api_error"
  )
})

# ----- rango_fecha ------------------------------------------------------------

test_that("rango_fecha marca fuera del rango", {
  r <- list(
    id = "t3", tipo = "rango_fecha", variables = list("f"),
    params = list(min = "2024-01-01", max = "2024-12-31"), activa = TRUE
  )
  plan <- compile_reglas_custom(list(r))
  df <- data.frame(f = c("2023-12-31", "2024-06-15", "2025-01-01", NA), stringsAsFactors = FALSE)
  viol <- eval_procesamiento(plan[1, ], df)
  expect_identical(viol, c(TRUE, FALSE, TRUE, FALSE))
})

# ----- outliers_iqr -----------------------------------------------------------

test_that("outliers_iqr marca valores fuera de Q1-k*IQR, Q3+k*IQR", {
  r <- list(
    id = "t4", tipo = "outliers_iqr", variables = list("x"),
    params = list(k = 1.5), activa = TRUE
  )
  plan <- compile_reglas_custom(list(r))
  df <- data.frame(x = c(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100))  # 100 es outlier claro
  viol <- eval_procesamiento(plan[1, ], df)
  expect_true(viol[length(viol)])           # 100 es outlier
  expect_false(any(viol[1:10]))             # 1-10 no
})

test_that("outliers_iqr exige k > 0", {
  expect_error(
    compile_reglas_custom(list(list(
      id = "t", tipo = "outliers_iqr", variables = list("x"),
      params = list(k = 0), activa = TRUE
    ))),
    class = "api_error"
  )
})

# ----- outliers_z -------------------------------------------------------------

test_that("outliers_z marca |z| > k", {
  r <- list(
    id = "t5", tipo = "outliers_z", variables = list("x"),
    params = list(k = 2), activa = TRUE
  )
  plan <- compile_reglas_custom(list(r))
  # 10 valores alrededor de 0 con un outlier grande.
  df <- data.frame(x = c(rep(0, 20), 100))
  viol <- eval_procesamiento(plan[1, ], df)
  expect_true(viol[length(viol)])
  expect_false(any(viol[1:20]))
})

# ----- duplicados -------------------------------------------------------------

test_that("duplicados marca filas cuya tupla aparece >1 vez", {
  r <- list(
    id = "t6", tipo = "duplicados", variables = list("dni"), activa = TRUE
  )
  plan <- compile_reglas_custom(list(r))
  df <- data.frame(dni = c("A1", "B2", "A1", "C3", "B2"), stringsAsFactors = FALSE)
  viol <- eval_procesamiento(plan[1, ], df)
  expect_identical(viol, c(TRUE, TRUE, TRUE, FALSE, TRUE))
})

test_that("duplicados con 2+ variables usa la tupla completa", {
  r <- list(
    id = "t6b", tipo = "duplicados", variables = list("a", "b"), activa = TRUE
  )
  plan <- compile_reglas_custom(list(r))
  df <- data.frame(
    a = c("x", "x", "y", "y"),
    b = c("1", "2", "1", "1"),
    stringsAsFactors = FALSE
  )
  viol <- eval_procesamiento(plan[1, ], df)
  # (y,1) aparece dos veces; (x,1) y (x,2) una; => F F T T
  expect_identical(viol, c(FALSE, FALSE, TRUE, TRUE))
})

# ----- fuera_catalogo ---------------------------------------------------------

test_that("fuera_catalogo marca valores fuera de la lista", {
  r <- list(
    id = "t7", tipo = "fuera_catalogo", variables = list("estado"),
    params = list(valores = list("A", "B", "C")), activa = TRUE
  )
  plan <- compile_reglas_custom(list(r))
  df <- data.frame(estado = c("A", "Z", "B", "", NA), stringsAsFactors = FALSE)
  viol <- eval_procesamiento(plan[1, ], df)
  # NA → no marca (sólo marca valores presentes fuera del catálogo).
  # "" → presente, no en catálogo → TRUE.
  expect_identical(viol, c(FALSE, TRUE, FALSE, TRUE, FALSE))
})

test_that("fuera_catalogo exige lista no vacía", {
  expect_error(
    compile_reglas_custom(list(list(
      id = "t", tipo = "fuera_catalogo", variables = list("x"),
      params = list(valores = list()), activa = TRUE
    ))),
    class = "api_error"
  )
})

# ----- coherencia_2v ----------------------------------------------------------

test_that("coherencia_2v marca cuando cond_x TRUE y cond_y FALSE", {
  # Regla: si edad >= 18, entonces vota == 'si'.
  r <- list(
    id = "t8", tipo = "coherencia_2v", variables = list("edad", "vota"),
    params = list(
      op_x = ">=", valor_x = 18,
      op_y = "==", valor_y = "si"
    ),
    activa = TRUE
  )
  plan <- compile_reglas_custom(list(r))
  df <- data.frame(
    edad = c(20, 17, 25, 30),
    vota = c("si", "no", "no", "si"),
    stringsAsFactors = FALSE
  )
  viol <- eval_procesamiento(plan[1, ], df)
  # Fila 1: >=18 Y vota=si   → OK (cond_x TRUE, cond_y TRUE)
  # Fila 2: <18              → cond_x FALSE, no marca
  # Fila 3: >=18 Y vota!=si  → cond_x TRUE, cond_y FALSE → violación
  # Fila 4: >=18 Y vota=si   → OK
  expect_identical(viol, c(FALSE, FALSE, TRUE, FALSE))
})

test_that("coherencia_2v con op 'in' acepta lista de valores", {
  r <- list(
    id = "t8b", tipo = "coherencia_2v", variables = list("pais", "region"),
    params = list(
      op_x = "in", valor_x = list("PE", "CO"),
      op_y = "not_in", valor_y = list("Europa", "Asia")
    ),
    activa = TRUE
  )
  plan <- compile_reglas_custom(list(r))
  df <- data.frame(
    pais = c("PE", "ES", "CO", "PE"),
    region = c("America", "Europa", "Asia", "Europa"),
    stringsAsFactors = FALSE
  )
  viol <- eval_procesamiento(plan[1, ], df)
  # Fila 1: pais in {PE,CO}=T, region not_in {Europa,Asia}=T → OK
  # Fila 2: pais in {PE,CO}=F → no marca
  # Fila 3: pais in {PE,CO}=T, region not_in {Europa,Asia}=F (es Asia) → viol
  # Fila 4: pais in {PE,CO}=T, region not_in {Europa,Asia}=F (es Europa) → viol
  expect_identical(viol, c(FALSE, FALSE, TRUE, TRUE))
})

# ----- Filtro de reglas inactivas --------------------------------------------

test_that("compile_reglas_custom omite las reglas con activa=FALSE", {
  r1 <- list(id = "a", tipo = "no_nulo", variables = list("x"), activa = TRUE)
  r2 <- list(id = "b", tipo = "no_nulo", variables = list("y"), activa = FALSE)
  r3 <- list(id = "c", tipo = "no_nulo", variables = list("z"))  # activa NULL → activa por default
  plan <- compile_reglas_custom(list(r1, r2, r3))
  expect_equal(nrow(plan), 2L)
  expect_true(all(c("a", "c") %in% plan$ID))
  expect_false("b" %in% plan$ID)
})

test_that("compile_reglas_custom devuelve NULL para lista vacía o toda inactiva", {
  expect_null(compile_reglas_custom(list()))
  expect_null(compile_reglas_custom(NULL))
  expect_null(compile_reglas_custom(list(
    list(id = "x", tipo = "no_nulo", variables = list("a"), activa = FALSE)
  )))
})

# ----- Validaciones de schema básicas -----------------------------------------

test_that(".validar_regla_custom exige tipo y variables", {
  expect_error(.validar_regla_custom(list(tipo = "no_nulo")), class = "api_error")
  expect_error(.validar_regla_custom(list(variables = list("x"))), class = "api_error")
  expect_error(
    .validar_regla_custom(list(tipo = "inventado", variables = list("x"))),
    class = "api_error"
  )
})

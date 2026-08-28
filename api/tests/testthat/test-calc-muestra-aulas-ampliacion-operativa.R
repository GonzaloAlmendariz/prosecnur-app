test_that("solo admite las aulas cuyo UNICO incumplimiento es el criterio exceptuado", {
  universo <- data.frame(
    classroom_id = paste0("A", 1:6),
    faculty = "ARQUITECTURA Y URBANISMO",
    session_type = c("TALLER", "TALLER", "TALLER", "TALLER", "TALLER", "TALLER"),
    eligible_n = c(20, 30, 40, 10, 25, 15),
    exclude_reason = c(
      "session_type",                          # admisible
      "session_type",                          # admisible
      "session_type|min_eligible",             # NO: incumple algo mas
      "min_eligible",                          # NO: ni siquiera es por sesion
      "",                                      # NO: ya esta en el marco
      "c7_prevalencia|session_type"            # NO: incumple algo mas
    ),
    stringsAsFactors = FALSE
  )

  r <- calc_muestra_aulas_ampliacion_operativa(
    universo, "ARQUITECTURA Y URBANISMO", "session_type"
  )

  expect_equal(nrow(r$aulas), 2L)
  expect_setequal(r$aulas$classroom_id, c("A1", "A2"))
  expect_equal(r$acta$aulas, 2L)
  expect_equal(r$acta$elegibles, 50)
  expect_equal(r$acta$estado, "aplicada")
})

test_that("el orden dentro de exclude_reason no cuela un incumplimiento extra", {
  # `session_type|min_eligible` y `min_eligible|session_type` son la misma aula
  # con la lista escrita al reves. Una comparacion por `grepl` las admitiria a
  # las dos; la comparacion exacta no admite ninguna.
  universo <- data.frame(
    classroom_id = c("A1", "A2"),
    faculty = "X",
    session_type = "TALLER",
    eligible_n = c(10, 10),
    exclude_reason = c("session_type|min_eligible", "min_eligible|session_type"),
    stringsAsFactors = FALSE
  )
  r <- calc_muestra_aulas_ampliacion_operativa(universo, "X", "session_type")
  expect_equal(nrow(r$aulas), 0L)
  expect_equal(r$acta$estado, "ninguna_admisible")
})

test_that("las categorias acotan al tipo de sesion que se autorizo", {
  # Gonzalo autorizo «las aulas de taller». Un laboratorio que tambien cae solo
  # por `session_type` NO entra: la excepcion es de una categoria, no del
  # criterio entero.
  universo <- data.frame(
    classroom_id = c("A1", "A2", "A3"),
    faculty = "ARQUITECTURA Y URBANISMO",
    session_type = c("TALLER", "LABORATORIO", "PRACTICA SUPERVISADA PREPROFESIONAL"),
    eligible_n = c(20, 30, 5),
    exclude_reason = "session_type",
    stringsAsFactors = FALSE
  )
  r <- calc_muestra_aulas_ampliacion_operativa(
    universo, "ARQUITECTURA Y URBANISMO", "session_type", categorias = "taller"
  )
  expect_equal(nrow(r$aulas), 1L)
  expect_equal(r$aulas$classroom_id, "A1")
  expect_equal(r$acta$categorias_admitidas, "taller")
})

test_that("cada aula anadida viaja marcada como ampliacion, no como extra sorteada", {
  universo <- data.frame(
    classroom_id = "A1", faculty = "X", session_type = "TALLER",
    eligible_n = 20, exclude_reason = "session_type", stringsAsFactors = FALSE
  )
  r <- calc_muestra_aulas_ampliacion_operativa(universo, "X", "session_type")
  expect_equal(r$aulas$sample_role, "extra_reserve_pool")
  expect_equal(r$aulas$origen_operativo, "ampliacion_declarada")
  expect_equal(r$aulas$criterio_exceptuado, "session_type")
  # La advertencia de peso tiene que decir POR QUE, no solo que no se use.
  expect_match(r$aulas$analysis_weight_warning, "ampliacion operativa declarada")
  expect_match(r$aulas$analysis_weight_warning, "session_type", fixed = TRUE)
})

test_that("una facultad sin candidatas devuelve acta, no NULL", {
  universo <- data.frame(
    classroom_id = "A1", faculty = "OTRA", session_type = "TALLER",
    eligible_n = 20, exclude_reason = "session_type", stringsAsFactors = FALSE
  )
  r <- calc_muestra_aulas_ampliacion_operativa(universo, "ARQUITECTURA", "session_type")
  expect_equal(nrow(r$aulas), 0L)
  expect_equal(r$acta$estado, "ninguna_admisible")
  expect_equal(r$acta$facultad, "ARQUITECTURA")
})

test_that("un universo sin exclude_reason se declara, no se adivina", {
  universo <- data.frame(classroom_id = "A1", faculty = "X", stringsAsFactors = FALSE)
  r <- calc_muestra_aulas_ampliacion_operativa(universo, "X", "session_type")
  expect_equal(nrow(r$aulas), 0L)
  expect_equal(r$acta$estado, "universo_sin_exclude_reason")
})

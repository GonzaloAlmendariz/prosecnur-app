# La clave canonica del identificador de colector.
#
# El QR viaja con el codigo del sorteo (`CH 1`, `R 6.1`) y ese camino ya
# empareja literal; el hueco era el identificador TECLEADO (`ch1`, `R6_1`,
# `R 6,1`): entraba a la plataforma y el avance de su aula quedaba en 0 sin
# aviso. El emparejamiento vive en TRES capas (numerador del tablero, celdas
# de sexo, facultad por respuesta) y las tres tienen que leer la misma clave.

test_that("la clave canonica absorbe mayusculas, espacios y _ o , como punto", {
  norm <- prosecnurapp:::.monitoreo_aulas_clave_colector
  expect_identical(norm(c("CH 1", "ch1", " Ch  1 ")), c("CH1", "CH1", "CH1"))
  expect_identical(norm(c("R 6.1", "r6_1", "R 6,1")), c("R6.1", "R6.1", "R6.1"))
  expect_identical(norm(c(NA, "", "   ")), c("", "", ""))
})

test_that("el numerador suma las variantes tecleadas del mismo codigo", {
  rows <- data.frame(classroom_id = c("CH 1", "R 6.1"), stringsAsFactors = FALSE)
  counts <- table(c("CH 1", "CH 1", "ch1", "R6_1"))
  expect_identical(
    prosecnurapp:::.monitoreo_aulas_contar_por_fila(rows, counts),
    c(3L, 1L)
  )
})

test_that("con claves del plan en colision se compara literal, sin repartir", {
  # Dos AULAS distintas cuyos ids canonicalizan igual: agregar repartiria
  # respuestas ajenas, asi que el comparador cae al literal de siempre.
  rows <- data.frame(classroom_id = c("CH 1", "ch1"), stringsAsFactors = FALSE)
  counts <- table(c("CH 1", "ch1", "ch1"))
  expect_identical(
    prosecnurapp:::.monitoreo_aulas_contar_por_fila(rows, counts),
    c(1L, 2L)
  )
})

test_that("el rescate tambien corre por collection_unit_id", {
  rows <- data.frame(
    classroom_id = c("", ""),
    collection_unit_id = c("unit-a", "unit-b"),
    stringsAsFactors = FALSE
  )
  counts <- table(c("UNIT-A", "unit-a", "unit-b"))
  expect_identical(
    prosecnurapp:::.monitoreo_aulas_contar_por_fila(rows, counts),
    c(2L, 1L)
  )
})

test_that("las celdas de sexo atribuyen la respuesta tecleada a su fila", {
  plan_df <- data.frame(
    classroom_id = c("CH 1", "R 6.1"),
    collection_unit_id = c("unit-a", "unit-b"),
    faculty = c("DERECHO", "EDUCACION"),
    replacement_reason = c("", ""),
    stringsAsFactors = FALSE
  )
  atrib <- prosecnurapp:::.maac_atribucion(
    plan_df, c(TRUE, TRUE, TRUE), c("ch1", "R6_1", "quien sabe")
  )
  expect_identical(atrib$matched, c(TRUE, TRUE, FALSE))
  expect_identical(atrib$facultad, c("DERECHO", "EDUCACION", ""))
})

test_that("la facultad por respuesta sobrevive al tipeo del identificador", {
  responses <- data.frame(x = c(1, 2), stringsAsFactors = FALSE)
  plan_df <- data.frame(
    classroom_id = "CH 1",
    faculty = "DERECHO",
    stringsAsFactors = FALSE
  )
  fac <- prosecnurapp:::.monitoreo_aulas_response_faculty_values(
    responses, plan_df, c("ch 1", "CH 1")
  )
  expect_identical(fac, c("DERECHO", "DERECHO"))
})

test_that("el QR nuevo (codigo operativo) atribuye contra un plan sin handoff", {
  # El plan armado antes del handoff de Recopiladores solo tiene el
  # curso-horario en `classroom_id`; el codigo del QR de 2026 vive en
  # `operational_code`. Medido 2026-09-01: sin el tercer intento, `CH 1`
  # atribuia 0 y el tablero abria el campo entero en cero.
  rows <- data.frame(
    classroom_id = c("2civ09_0703", "1ing15_0902"),
    operational_code = c("CH 1", "R 6.1"),
    stringsAsFactors = FALSE
  )
  counts <- table(c("CH 1", "ch1", "2civ09_0703", "R6_1"))
  expect_identical(
    prosecnurapp:::.monitoreo_aulas_contar_por_fila(rows, counts),
    c(3L, 1L)
  )
})

test_that("las celdas de sexo tambien resuelven por codigo operativo", {
  plan_df <- data.frame(
    classroom_id = c("2civ09_0703", "1ing15_0902"),
    collection_unit_id = c("", ""),
    operational_code = c("CH 1", "R 6.1"),
    faculty = c("DERECHO", "EDUCACION"),
    replacement_reason = c("", ""),
    stringsAsFactors = FALSE
  )
  atrib <- prosecnurapp:::.maac_atribucion(
    plan_df, c(TRUE, TRUE), c("CH 1", "r6_1")
  )
  expect_identical(atrib$matched, c(TRUE, TRUE))
  expect_identical(atrib$facultad, c("DERECHO", "EDUCACION"))
})

test_that("la facultad por respuesta tambien resuelve por codigo operativo", {
  responses <- data.frame(x = 1, stringsAsFactors = FALSE)
  plan_df <- data.frame(
    classroom_id = "2civ09_0703",
    operational_code = "CH 1",
    faculty = "DERECHO",
    stringsAsFactors = FALSE
  )
  fac <- prosecnurapp:::.monitoreo_aulas_response_faculty_values(
    responses, plan_df, "ch 1"
  )
  expect_identical(fac, "DERECHO")
})

# Toda fila excluida del marco declara su causa.
#
# El defecto que estos tests fijan: `eligible_row` incluye los criterios de
# alumno de capa "marco" (alumno_sel$marco_ok), pero `reason_rows` se armaba
# solo con los siete flags legacy (student_id, age, condition, level, modality,
# session_type, classroom_id). Una fila que caía ÚNICAMENTE por un criterio de
# alumno salía publicada en `frame$exclusions` con exclude_reason vacío: el
# motor acertaba al excluirla y no podía decir por qué.
#
# Medido sobre el proyecto de referencia: 136.284 exclusiones, 0 con causa.
# Una pantalla que solo puede decir "se cayeron 136.284" es indistinguible de
# un bug de mapeo que tiró la base entera, y eso es justo lo que hay que poder
# defender ante un comité.

.razon_bloque <- function(aula, sids, formacion = "pregrado", edad = 20,
                          condicion = "regular", nivel = "1") {
  n <- length(sids)
  data.frame(
    student_id = sids,
    aula_id = aula,
    curso_id = paste0("C_", aula),
    curso = paste("Curso", aula),
    horario = "H1",
    facultad = "FAC1",
    programa = "P1",
    sexo = rep(c("F", "M"), length.out = n),
    edad = rep(edad, length.out = n),
    condicion = rep(condicion, length.out = n),
    nivel = rep(nivel, length.out = n),
    modalidad = "presencial",
    formacion = rep(formacion, length.out = n),
    stringsAsFactors = FALSE
  )
}

.razon_cfg <- function(criterios = NULL, filtros = list()) {
  calc_muestra_aulas_normalize_config(list(
    filters = c(list(min_eligible_per_class = 1L), filtros),
    criterios_seleccion = criterios
  ))
}

# Criterio de alumno de capa marco: "solo pregrado entra a la población".
.razon_solo_pregrado <- function(layer = "marco") {
  list(byVariable = list(
    formation = list(mode = "include", categories = list("pregrado"), layer = layer)
  ))
}

test_that("una fila que solo cae por un criterio de alumno declara ese criterio", {
  base <- rbind(
    .razon_bloque("A1", c("s1", "s2"), formacion = c("pregrado", "maestria")),
    .razon_bloque("A2", c("s3", "s4"), formacion = c("pregrado", "maestria"))
  )

  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = .razon_cfg(.razon_solo_pregrado())
  )
  ex <- frame$exclusions

  # Los dos de maestría se caen: el motor acierta.
  expect_identical(sort(ex$student_id), c("s2", "s4"))
  # Y ahora dicen por qué, nombrando el criterio (no un genérico).
  expect_identical(unique(ex$exclude_reason), "formation")
})

test_that("ninguna exclusión del marco queda muda, con suite y sin suite", {
  # Invariante general: la propiedad que el defecto rompía. Se mide en los DOS
  # caminos del motor, porque son excluyentes por diseño: con suite activa los
  # filtros legacy de alumno quedan en TRUE a propósito («suite manda»,
  # calc_muestra_aulas.R:1124), así que edad y criterio de alumno no pueden ser
  # causa a la vez. Medir solo uno de los caminos dejaría la mitad sin guard.
  base <- rbind(
    .razon_bloque("A1", c("s1", "s2"), formacion = c("pregrado", "maestria"), edad = c(20, 15)),
    .razon_bloque("A2", c("s3", "s4"), formacion = c("pregrado", "maestria"), edad = c(15, 20))
  )

  sin_mudas <- function(frame) {
    ex <- frame$exclusions
    expect_gt(nrow(ex), 0L)
    expect_identical(ex$student_id[!nzchar(trimws(ex$exclude_reason))], character(0))
    ex
  }

  # Camino con suite: la causa son los criterios de alumno.
  ex_suite <- sin_mudas(calc_muestra_aulas_construir(
    base_madre = base,
    config = .razon_cfg(.razon_solo_pregrado())
  ))
  expect_identical(unique(ex_suite$exclude_reason), "formation")

  # Camino legacy: sin suite, la causa son los filtros del motor, que también se
  # acumulan cuando una fila incumple más de uno (s2 es de maestría Y menor).
  ex_legacy <- sin_mudas(calc_muestra_aulas_construir(
    base_madre = base,
    config = .razon_cfg(filtros = list(require_adult = TRUE))
  ))
  razon_legacy <- setNames(ex_legacy$exclude_reason, ex_legacy$student_id)
  expect_identical(razon_legacy[["s2"]], "age|level")  # maestría + 15 años
  expect_identical(razon_legacy[["s3"]], "age")        # pregrado + 15 años
  expect_identical(razon_legacy[["s4"]], "level")      # maestría + 20 años
})

test_that("una fila que cae por dos criterios de alumno los declara ambos", {
  # s2 es de maestría Y de ciclo 1: la razón no puede perder ninguna de las dos,
  # o quien lee el marco corrige una y la fila sigue fuera sin explicación.
  # Ambas causas son criterios de la suite, que es como se acumulan de verdad.
  base <- .razon_bloque("A1", c("s1", "s2"),
                        formacion = c("pregrado", "maestria"),
                        nivel = c("3", "1"))

  cfg <- .razon_cfg(list(byVariable = list(
    formation = list(mode = "include", categories = list("pregrado"), layer = "marco"),
    level = list(mode = "include", fromValue = 2, layer = "marco")
  )))

  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
  ex <- frame$exclusions
  razon <- ex$exclude_reason[ex$student_id == "s2"]

  expect_length(razon, 1L)
  expect_true(grepl("formation", razon, fixed = TRUE))
  expect_true(grepl("level", razon, fixed = TRUE))
})

test_that("un criterio de alumno de capa instrumento no excluye ni inventa razón", {
  # Retro-compat de la regla de capas: instrumento/procesamiento se reportan
  # pero NO recortan el marco. Si este test se pone rojo, el arreglo de la
  # razón se llevó por delante la semántica de capa.
  base <- rbind(
    .razon_bloque("A1", c("s1", "s2"), formacion = c("pregrado", "maestria")),
    .razon_bloque("A2", c("s3", "s4"), formacion = c("pregrado", "maestria"))
  )

  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = .razon_cfg(.razon_solo_pregrado(layer = "instrumento"))
  )

  expect_identical(nrow(frame$exclusions), 0L)
})

test_that("sin criterios de alumno activos las razones legacy no cambian", {
  # Guard de no-regresión del camino viejo: el motor sin selección activa tiene
  # que publicar exactamente las mismas razones que antes del cambio.
  base <- .razon_bloque("A1", c("s1", "s2"), edad = c(20, 15))

  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = .razon_cfg(filtros = list(require_adult = TRUE))
  )
  ex <- frame$exclusions

  expect_identical(ex$student_id, "s2")
  expect_identical(ex$exclude_reason, "age")
})

# La facultad seleccionada filtra estudiantes, NO cursos-horario.
#
# El estudio de 2026 declara 15 de 18 facultades —las mismas 15 que la tabla de
# cuotas del diseño, que deja fuera Escuela de Posgrado, Escuela de Estudios
# Especiales y Consorcio de Universidades—. Esa seleccion recorta la POBLACION,
# pero no toca el marco de aulas: un curso catalogado bajo una facultad excluida
# entra igual mientras sus alumnos pasen los criterios de estudiante.
#
# Medido sobre el proyecto real: dos cursos-horario de Civil catalogados bajo
# Escuela de Posgrado (`1civ15_0001` y `1civ26_0001`) sobreviven en el marco, y
# son los que hacen fallar `/calcular` con `facultades_incompletas`, porque el
# contrato de alumnos por CH pide una facultad que el estudio no declara.
#
# La causa, medida a base de mutantes: manda el REGISTRO. `scope` no es un
# campo que el llamador pueda fijar —`.cm_criterios_normalize_seleccion` lo
# reescribe desde `.cm_criterios_var_registry()`—, asi que pedir la facultad con
# `scope = "aula"` la devuelve igualmente como "alumno", y el guard del lado
# aula (`if (!identical(crit$scope, "aula")) next`) la descarta. Anadirla al
# recorrido del bucle tampoco basta por lo mismo. Lo unico que conecta las dos
# puntas es cambiar su scope en el registro, que es justo lo que este archivo
# vigila.
#
# Este archivo no conecta las dos puntas —cual es el arreglo correcto es una
# decision metodologica— sino que fija el hueco, para que conectarlo se vea en
# el diff y no ocurra de callado.

test_that("el registro declara la facultad como criterio de ALUMNO", {
  reg <- .cm_criterios_var_registry()
  expect_identical(reg$faculty$scope, "alumno")
  expect_true(isTRUE(reg$faculty$estratifica))
  expect_identical(reg$faculty$defaultLayer, "marco")
})

test_that("ninguna variable de scope aula apunta a la facultad del curso", {
  # Si mañana se agrega una —que es justo el arreglo candidato—, este test cae
  # y obliga a decirlo. Las de scope aula hoy son estas siete, y ninguna habla
  # de facultad.
  reg <- .cm_criterios_var_registry()
  de_aula <- names(Filter(function(m) identical(m$scope, "aula"), reg))
  expect_setequal(de_aula, c(
    "modality", "session_type", "teacher_type", "course_level",
    "condicion_curso", "enrolled_total", "campus"
  ))
  expect_false(any(grepl("facult", de_aula, ignore.case = TRUE)))
})

test_that("seleccionar facultades NO recorta el marco de aulas", {
  # EL hueco. Tres cursos-horario, uno de ellos de una facultad que la seleccion
  # excluye; los tres siguen pasando la evaluacion de aula. Y da igual con que
  # scope se declare: el bucle no mira `faculty` en ninguno de los dos casos,
  # que es la diferencia entre «esta apagado» y «no esta cableado».
  aula_frame <- data.frame(
    classroom_id = c("A1", "A2", "POS1"),
    faculty = c("DERECHO", "PSICOLOGIA", "ESCUELA DE POSGRADO"),
    modality = c("Presencial", "Presencial", "Presencial"),
    eligible_n = c(30L, 25L, 17L),
    stringsAsFactors = FALSE
  )
  seleccion <- .cm_criterios_normalize_seleccion(list(
    byVariable = list(
      faculty = list(scope = "alumno", kind = "flat", categories = list("derecho", "psicologia"))
    )
  ))
  ev <- .cm_criterios_evaluar_aula(aula_frame, list(), seleccion, rep(NA_real_, 3), min_eligible_fallback = 1L)
  expect_true(all(ev$ok))
  # Y el aula de posgrado no queda marcada por ningun paso: el criterio de
  # facultad ni siquiera se evalua de este lado (los pasos publicados no lo
  # incluyen).
  ids <- vapply(ev$pasos %||% list(), function(p) p$id, character(1))
  expect_false("faculty" %in% ids)

  # Pedirla como de aula tampoco sirve: el normalizador reescribe el scope
  # desde el registro, asi que vuelve a llegar como "alumno". El scope no es
  # del llamador.
  como_aula <- .cm_criterios_normalize_seleccion(list(
    byVariable = list(
      faculty = list(scope = "aula", kind = "flat", categories = list("derecho", "psicologia"))
    )
  ))
  ev2 <- .cm_criterios_evaluar_aula(aula_frame, list(), como_aula, rep(NA_real_, 3), min_eligible_fallback = 1L)
  expect_true(all(ev2$ok))
})

test_that("una variable de scope aula SI recorta, para que se vea la diferencia", {
  # Control: el mecanismo funciona; lo que falta es la variable, no el motor.
  # La misma seleccion sobre `modality` deja fuera el aula que no cumple.
  aula_frame <- data.frame(
    classroom_id = c("A1", "A2"),
    faculty = c("DERECHO", "DERECHO"),
    modality = c("Presencial", "Virtual"),
    eligible_n = c(30L, 25L),
    stringsAsFactors = FALSE
  )
  seleccion <- .cm_criterios_normalize_seleccion(list(
    byVariable = list(
      modality = list(scope = "aula", kind = "flat", categories = list("presencial"))
    )
  ))
  ev <- .cm_criterios_evaluar_aula(aula_frame, list(), seleccion, rep(NA_real_, 2), min_eligible_fallback = 1L)
  expect_identical(unname(ev$ok), c(TRUE, FALSE))
  ids <- vapply(ev$pasos %||% list(), function(p) p$id, character(1))
  expect_true("modality" %in% ids)
})

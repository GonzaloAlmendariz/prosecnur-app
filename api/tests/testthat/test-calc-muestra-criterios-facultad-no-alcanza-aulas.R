# La facultad que el estudio declara recorta estudiantes Y cursos-horario.
#
# Este archivo fijaba lo contrario. Hasta 2026-08-16 la seleccion de facultades
# solo recortaba la POBLACION: el criterio `faculty` nace con `scope = "alumno"`
# en el registro y el lado aula descarta todo lo que no sea de su scope, asi que
# un curso catalogado bajo una facultad que el estudio no cubre entraba al marco
# igual. Sobre el estudio real eso dejaba dos cursos de Civil catalogados bajo
# Escuela de Posgrado (`1civ15_0001` y `1civ26_0001`, 33 matriculas elegibles
# entre los dos) y hacia fallar `/calcular` con `facultades_incompletas`.
#
# No hubo decision metodologica que tomar: el estudio ya declaraba 15 de 18
# facultades —las mismas de la tabla de cuotas del diseno, que deja fuera
# Escuela de Posgrado, Escuela de Estudios Especiales y Consorcio de
# Universidades—. Lo que faltaba era honrarla del lado de las aulas. Un aula
# cuya facultad no es un estrato del estudio no puede recibir cuota, asi que
# conservarla solo servia para romper el contrato.
#
# Lo que NO cambia, y por eso los dos primeros tests siguen igual: el `scope` del
# registro. Moverlo a "aula" conectaria este lado y desconectaria el de
# estudiantes, porque el scope es uno solo; el recorte de aulas reutiliza la
# seleccion sin moverla de sitio.

test_that("el registro sigue declarando la facultad como criterio de ALUMNO", {
  reg <- .cm_criterios_var_registry()
  expect_identical(reg$faculty$scope, "alumno")
  expect_true(isTRUE(reg$faculty$estratifica))
  expect_identical(reg$faculty$defaultLayer, "marco")
})

test_that("ninguna variable de scope aula apunta a la facultad del curso", {
  # El recorte nuevo NO se hace inventando una variable de registro: si alguien
  # la agrega, este test cae y obliga a decirlo.
  reg <- .cm_criterios_var_registry()
  de_aula <- names(Filter(function(m) identical(m$scope, "aula"), reg))
  expect_setequal(de_aula, c(
    "modality", "session_type", "teacher_type", "course_level",
    "condicion_curso", "enrolled_total", "campus"
  ))
  expect_false(any(grepl("facult", de_aula, ignore.case = TRUE)))
})

.fac_frame <- function() data.frame(
  classroom_id = c("A1", "A2", "POS1"),
  faculty = c("DERECHO", "PSICOLOGIA", "ESCUELA DE POSGRADO"),
  modality = c("Presencial", "Presencial", "Presencial"),
  eligible_n = c(30L, 25L, 17L),
  stringsAsFactors = FALSE
)

.fac_sel <- function(cats, mode = NULL) {
  crit <- list(scope = "alumno", kind = "flat", categories = as.list(cats))
  if (!is.null(mode)) crit$mode <- mode
  .cm_criterios_normalize_seleccion(list(byVariable = list(faculty = crit)))
}

.fac_eval <- function(af, sel) {
  .cm_criterios_evaluar_aula(af, list(), sel, rep(NA_real_, nrow(af)), min_eligible_fallback = 1L)
}

test_that("seleccionar facultades SI recorta el marco de aulas", {
  # EL cambio. El aula de una facultad que el estudio no declara se cae, y el
  # paso publicado la nombra, para que el embudo diga QUE recorto y no solo
  # cuanto.
  ev <- .fac_eval(.fac_frame(), .fac_sel(c("derecho", "psicologia")))
  expect_identical(unname(ev$ok), c(TRUE, TRUE, FALSE))
  ids <- vapply(ev$pasos %||% list(), function(p) p$id, character(1))
  expect_true("faculty_curso" %in% ids)
})

test_that("sin restriccion de facultad el marco queda intacto", {
  # Un estudio que no acota facultades no debe perder ni un aula por esto.
  sin <- .cm_criterios_normalize_seleccion(list(byVariable = list()))
  ev <- .fac_eval(.fac_frame(), sin)
  expect_true(all(ev$ok))
  ids <- vapply(ev$pasos %||% list(), function(p) p$id, character(1))
  expect_false("faculty_curso" %in% ids)

  # Y con las tres declaradas, tampoco cae ninguna.
  todas <- .fac_sel(c("derecho", "psicologia", "escuela_de_posgrado"))
  expect_true(all(.fac_eval(.fac_frame(), todas)$ok))
})

test_that("un aula sin facultad no se cae por falta de senal", {
  # Misma regla que el resto de criterios planos: sin valor no se restringe.
  af <- .fac_frame(); af$faculty[[3]] <- ""
  expect_true(all(.fac_eval(af, .fac_sel(c("derecho", "psicologia")))$ok))
})

test_that("el modo excluir invierte el set", {
  ev <- .fac_eval(.fac_frame(), .fac_sel("escuela_de_posgrado", mode = "exclude"))
  expect_identical(unname(ev$ok), c(TRUE, TRUE, FALSE))
})

test_that("las excepciones por facultad NO reabren el marco de aulas", {
  # `exceptions` sirve para «en Derecho acepta ademas estas modalidades». Sobre
  # el propio criterio de facultad seria una regla que se habla a si misma, y
  # leerla aqui dejaria entrar aulas que el estudio no cubre por una excepcion
  # pensada para los estudiantes.
  crit <- list(
    scope = "alumno", kind = "flat", categories = list("derecho"),
    exceptions = list(escuela_de_posgrado = list(op = "add", categories = list("escuela_de_posgrado")))
  )
  sel <- .cm_criterios_normalize_seleccion(list(byVariable = list(faculty = crit)))
  ev <- .fac_eval(.fac_frame(), sel)
  expect_identical(unname(ev$ok), c(TRUE, FALSE, FALSE))
})

test_that("una variable de scope aula sigue recortando como siempre", {
  # Control del mecanismo viejo: lo nuevo no lo pisa.
  af <- data.frame(
    classroom_id = c("A1", "A2"), faculty = c("DERECHO", "DERECHO"),
    modality = c("Presencial", "Virtual"), eligible_n = c(30L, 25L),
    stringsAsFactors = FALSE
  )
  sel <- .cm_criterios_normalize_seleccion(list(
    byVariable = list(modality = list(scope = "aula", kind = "flat", categories = list("presencial")))
  ))
  expect_identical(unname(.fac_eval(af, sel)$ok), c(TRUE, FALSE))
})

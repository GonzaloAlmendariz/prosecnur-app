# Regresión ADR 0035 §2 (guard de condicion_curso vs. fuzzy de condition). El
# guard .cm_criterios_col_condicion_curso anula la señal base de condicion_curso
# solo ante colisión GENUINA de homónimo con la columna de condition. El bug:
# en una base de UNA hoja con "Condición del curso" real pero SIN columna de
# condición del alumno, el candidato default `condicion` de condition hacía
# fuzzy-match ("condicion" ⊂ "condicion_del_curso") contra la MISMA columna, y el
# guard anulaba la señal de curso — rompiendo condicion_curso para un proyecto
# single-sheet válido. La colisión debe medirse con el resolver EXACTO, que solo
# calza cuando condition tiene columna propia por nombre/clave exacta.

# UNA sola hoja: trae "Condición del curso" (OBLIGATORIO/ELECTIVO) y NO trae
# columna de condición del alumno. condicion_curso se mapea a mano; condition NO
# se mapea (cae a sus candidatos default, entre ellos "condicion").
.css_base <- function() {
  data.frame(
    `Código` = sprintf("A%02d", 1:8),
    Facultad = "CIENCIAS SOCIALES",
    Carrera = "SOCIOLOGIA",
    `Formación` = "PREGRADO",
    Sexo = rep(c("Femenino", "Masculino"), 4),
    Edad = 20,
    `Nivel curricular` = "5",
    `Curso-Horario` = rep(sprintf("C%d-H1", 1:4), each = 2),
    Curso = rep(sprintf("C%d", 1:4), each = 2),
    `Nombre del curso` = rep(c("Algebra", "Estadistica", "Fisica", "Historia"), each = 2),
    Horario = "H1",
    Modalidad = "Presencial",
    `Condición del curso` = rep(c("OBLIGATORIO", "ELECTIVO", "OBLIGATORIO", "ELECTIVO"), each = 2),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

# Mapping SIN condition (el usuario no mapeó la condición del alumno porque no
# existe en esta base). condicion_curso apunta a su columna propia.
.css_mapping <- function() {
  list(
    student_id = "Código", faculty = "Facultad", program = "Carrera",
    sex = "Sexo", level = "Nivel.curricular", age = "Edad",
    course_id = "Curso", classroom_id = "Curso-Horario",
    course_name = "Nombre.del.curso", schedule = "Horario",
    modality = "Modalidad",
    condicion_curso = "Condición del curso",
    formation = "Formación"
  )
}

.css_var <- function(frame, id = "condicion_curso", scope = "aula") {
  for (v in frame$criterios_catalogo$variables) {
    if (identical(v$id, id) && identical(v$scope, scope)) return(v)
  }
  NULL
}

test_that("guard: single-sheet con solo 'Condición del curso' conserva su columna (no anula por fuzzy de condition)", {
  base <- .css_base()
  resolved <- .cm_aulas_config_mapping(.css_mapping())
  # condition cayó a sus candidatos default; el resolver EXACTO NO calza contra
  # "Condición del curso" (los defaults no matchean por clave exacta con
  # "condicion_del_curso"), así que NO hay colisión genuina.
  expect_identical(.cm_criterios_col_condicion_curso(base, resolved), "Condición del curso")
})

test_that("single-sheet: condicion_curso conserva su señal (obligatorio/electivo enumerados)", {
  frame <- calc_muestra_aulas_construir(
    base_madre = .css_base(),
    config = list(mapping = .css_mapping(), filters = list(min_eligible_per_class = 1L))
  )
  # La señal de curso NO queda vacía.
  cc <- frame$aula_frame$condicion_curso
  expect_true(any(grepl("OBLIGATORIO|ELECTIVO", cc, ignore.case = TRUE)))

  # La variable se enumera con las categorías reales del curso.
  var <- .css_var(frame)
  expect_false(is.null(var))
  keys <- vapply(var$categories, function(c) c$key %||% "", character(1))
  expect_true(all(c("obligatorio", "electivo") %in% keys))
  # Y nunca aparece condición del alumno (aquí no existe columna de alumno).
  expect_false(any(c("regular", "movilidad") %in% keys))
})

test_that("guard intacto: colisión GENUINA (condition mapeada a la MISMA columna) sí anula la señal base", {
  base <- .css_base()
  # El usuario mapea condition a la MISMA columna homónima: colisión genuina por
  # clave exacta → la señal base se anula (fuente real quedaría en el catálogo).
  mapping <- .css_mapping()
  mapping$condition <- "Condición del curso"
  resolved <- .cm_aulas_config_mapping(mapping)
  expect_identical(.cm_criterios_col_condicion_curso(base, resolved), "")
})

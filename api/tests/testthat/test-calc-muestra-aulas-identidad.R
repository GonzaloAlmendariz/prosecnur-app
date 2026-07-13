# Tests de la identidad del aula en el marco universitario
# (calc_muestra_aulas.R / .cm_aulas_classroom_id): la identidad canónica es
# curso × horario (o el id directo curso_horario cuando existe). Regresión del
# hallazgo E2E H4: con columnas genéricas `cod_curso` + `horario`, el matcher
# difuso de columnas tomaba `horario` como id DIRECTO del aula (porque
# "horario" es substring del sinónimo "curso_horario") y la identidad
# colapsaba al horario: 18 pseudo-aulas H01..H18 con 210 curso-horario reales.

# Base sintética alumno×curso al estilo del dataset E2E (UAN): 2 cursos que
# COMPARTEN 2 horarios → 4 aulas reales, pero solo 2 horarios distintos.
.ident_bloque <- function(curso, horario, sids, facultad) {
  data.frame(
    cod_alumno = sids,
    facultad = facultad,
    condicion = "Regular",
    sexo = rep(c("Mujer", "Hombre"), length.out = length(sids)),
    edad = 20,
    cod_curso = curso,
    nombre_curso = paste("Curso", curso),
    horario = horario,
    modalidad = "Presencial",
    stringsAsFactors = FALSE
  )
}

.ident_base <- function() {
  rbind(
    .ident_bloque("C1", "H01", sprintf("s%02d", 1:5), "FAC1"),
    .ident_bloque("C1", "H02", sprintf("s%02d", 6:10), "FAC1"),
    .ident_bloque("C2", "H01", sprintf("s%02d", 6:10), "FAC2"),
    .ident_bloque("C2", "H02", sprintf("s%02d", 1:5), "FAC2")
  )
}

# Mapping tal como lo envía el frontend (universityWorkspaceMappingPayload):
# listas de una columna por rol, SIN classroom_id (el matcher TS de
# course_schedule_id devuelve "" con estas columnas).
.ident_cfg <- function() {
  list(
    mapping = list(
      student_id = list("cod_alumno"),
      course_id = list("cod_curso"),
      schedule = list("horario"),
      faculty = list("facultad"),
      sex = list("sexo"),
      condition = list("condicion")
    ),
    filters = list(min_eligible_per_class = 1L)
  )
}

test_that("identidad: curso x horario compartido produce 4 aulas, no colapsa a los horarios", {
  frame <- calc_muestra_aulas_construir(base_madre = .ident_base(), config = .ident_cfg())
  af <- frame$aula_frame

  # La columna `horario` NO puede quedar como id directo del aula.
  expect_false(any(af$classroom_id %in% c("H01", "H02")))
  # Identidad compuesta curso × horario: 4 aulas reales.
  expect_identical(nrow(af), 4L)
  expect_identical(
    sort(af$classroom_id),
    c("c1_h01", "c1_h02", "c2_h01", "c2_h02")
  )
  # Cada aula conserva sus 5 elegibles (no ~10 por pseudo-aula de horario).
  expect_identical(unique(af$eligible_n), 5L)
  # Las facetas siguen legibles en el frame.
  expect_setequal(af$course_id, c("C1", "C2"))
  expect_setequal(af$schedule, c("H01", "H02"))
})

test_that("identidad: una columna curso_horario explícita sí es id directo", {
  base <- .ident_base()
  base$curso_horario <- paste(base$cod_curso, base$horario, sep = "-")
  frame <- calc_muestra_aulas_construir(base_madre = base, config = .ident_cfg())
  af <- frame$aula_frame
  # El id directo se respeta tal cual (sin pasar por la clave compuesta).
  expect_identical(
    sort(af$classroom_id),
    c("C1-H01", "C1-H02", "C2-H01", "C2-H02")
  )
})

test_that("identidad: una columna `aula` de salón físico tampoco secuestra el id", {
  base <- .ident_base()
  # Salón compartido entre aulas distintas (caso típico: mismo ambiente).
  base$aula <- ifelse(base$horario == "H01", "A-101", "A-202")
  frame <- calc_muestra_aulas_construir(base_madre = base, config = .ident_cfg())
  af <- frame$aula_frame
  expect_identical(nrow(af), 4L)
  expect_false(any(af$classroom_id %in% c("A-101", "A-202")))
})

test_that("identidad: el catálogo curso×horario enriquece docente con la clave compuesta", {
  catalogo <- data.frame(
    cod_curso = c("C1", "C1", "C2", "C2"),
    horario = c("H01", "H02", "H01", "H02"),
    docente = c("Ana", "Beto", "Carla", "Dario"),
    stringsAsFactors = FALSE
  )
  frame <- calc_muestra_aulas_construir(
    base_madre = .ident_base(),
    catalogo_curso_horario = catalogo,
    config = .ident_cfg()
  )
  af <- frame$aula_frame
  expect_identical(nrow(af), 4L)
  # Cada aula recibe SU docente (con el colapso al horario, dos aulas del
  # mismo horario compartían el docente modal del grupo).
  docentes <- af$teacher[order(af$classroom_id)]
  expect_identical(docentes, c("Ana", "Beto", "Carla", "Dario"))
})

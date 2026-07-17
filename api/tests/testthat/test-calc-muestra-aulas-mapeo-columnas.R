# Mapeo/detección de columnas de curso-horario a roles (teacher_type,
# course_level, condicion_curso) con columnas HOMÓNIMAS. Repro del bug real de
# la base PUCP "BD estudiantes y curso-horario": la MATRICULADO trae "Condición"
# (del estudiante) y "Condición del curso", además de "Curso" (CÓDIGO) — sin
# "Tipo de docente" ni "Nivel del curso" (que viven en el catálogo). El fuzzy
# bidireccional secuestraba teacher_type<-"Condición" y course_level<-"Curso".

# Base madre calcada del layout real (6 filas x 3 aulas). SIN "Tipo de docente"
# ni "Nivel del curso" (viven en el catálogo). CON los homónimos peligrosos.
.mapcol_matriculado <- function() {
  data.frame(
    `Código PUCP` = sprintf("A%02d", 1:6),
    Facultad = "CIENCIAS",
    Carrera = "FISICA",
    `Formación` = "PREGRADO",
    `Condición` = rep(c("REGULAR", "POR REINCORPORACION", "MOVILIDAD ESTUDIANTIL"), 2),
    Sexo = rep(c("Femenino", "Masculino"), 3),
    Edad = 20,
    `Nivel curricular` = "5",
    `Nivel según créditos` = "5",
    Curso = rep(c("FIS101", "FIS202", "FIS303"), 2),  # CÓDIGO, no nivel
    `Nombre del curso` = rep(c("Mecanica", "Termo", "Optica"), 2),
    Horario = "H1",
    Modalidad = "Presencial",
    `Tipo Curso` = "TEORICO",
    `Condición del curso` = "OBLIGATORIO",  # criterio propio, != Condición
    `Curso-Horario` = rep(c("FIS101-H1", "FIS202-H1", "FIS303-H1"), 2),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

# Catálogo de curso-horario: aquí viven "Tipo de docente" (categorías docentes),
# "Nivel del curso" (niveles reales) y "Condición" (del curso).
.mapcol_catalogo <- function() {
  data.frame(
    `Curso-Horario` = c("FIS101-H1", "FIS202-H1", "FIS303-H1"),
    Curso = c("FIS101", "FIS202", "FIS303"),
    `Nombre del curso` = c("Mecanica", "Termo", "Optica"),
    `Nivel del curso` = c(1, 5, 9),         # niveles reales
    Horario = "H1",
    Modalidad = "Presencial",
    `Tipo de curso` = "TEORICO",
    `Condición` = c("OBLIGATORIO", "ELECTIVO", "OBLIGATORIO"),
    `Tipo de docente` = c("ORDINARIO", "CONTRATADO", "ORDINARIO"),  # categorías docentes
    `Nombre de docente` = sprintf("DOC %d", 1:3),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

# Mapping SIN teacher_type/course_level/condicion_curso: se prueba la
# auto-detección (el bug era justamente en los defaults).
.mapcol_mapping <- function() {
  list(
    student_id = "Código PUCP", faculty = "Facultad", program = "Carrera",
    sex = "Sexo", age = "Edad", course_id = "Curso",
    classroom_id = "Curso-Horario", course_name = "Nombre del curso",
    schedule = "Horario", modality = "Modalidad",
    condition = "Condición", formation = "Formación"
  )
}

test_that("guardas anti-colisión: teacher_type y course_level no capturan la columna equivocada", {
  raw <- .mapcol_matriculado()
  mp <- prosecnurapp:::.cm_aulas_config_mapping(list())

  # teacher_type NO cae en "Condición" (del estudiante): sin columna propia en
  # la base la guarda declara sin señal ("").
  expect_identical(prosecnurapp:::.cm_criterios_col_teacher_type(raw, mp), "")

  # course_level NO cae en "Curso" (CÓDIGO): la guarda lo rechaza -> "" (fallback
  # benigno al level modal del aula, no el rango de códigos 1..N).
  expect_identical(prosecnurapp:::.cm_criterios_col_course_level(raw, mp), "")

  # condicion_curso es su PROPIO rol: resuelve a "Condición del curso", nunca a
  # "Condición" del estudiante.
  expect_identical(
    prosecnurapp:::.cm_criterios_col_exacta(raw, mp$condicion_curso),
    "Condición del curso"
  )
  # Y la condición del estudiante sigue siendo "Condición" (no la del curso).
  expect_identical(prosecnurapp:::.cm_aulas_col(raw, mp$condition), "Condición")
})

test_that("dual base: la enumeración mapea cada rol a su columna real del catálogo", {
  frame <- calc_muestra_aulas_construir(
    base_madre = .mapcol_matriculado(),
    catalogo_curso_horario = .mapcol_catalogo(),
    config = list(mapping = .mapcol_mapping(), filters = list(min_eligible_per_class = 1L))
  )
  cc <- frame$criterios_catalogo
  by_id <- stats::setNames(cc$variables, vapply(cc$variables, function(v) v$id, character(1)))

  # teacher_type <- "Tipo de docente" (NO "Condición"), categorías = tipos
  # docentes reales, no condiciones del estudiante.
  expect_identical(by_id$teacher_type$mappedColumn, "Tipo de docente")
  tt_labels <- toupper(unlist(lapply(
    by_id$teacher_type$categories %||% by_id$teacher_type$groups, function(c) c$label
  )))
  expect_true(any(grepl("ORDINARIO", tt_labels)) || any(grepl("CONTRATADO", tt_labels)))
  expect_false(any(grepl("REINCORPORACION|MOVILIDAD|REGULAR", tt_labels)))

  # course_level <- "Nivel del curso" (NO "Curso"), niveles reales (<= 10), sin
  # códigos de curso (que serían cientos).
  expect_identical(by_id$course_level$mappedColumn, "Nivel del curso")
  niveles <- unlist(by_id$course_level$values)
  expect_true(all(niveles %in% c(1, 5, 9)))
  expect_true(max(niveles) <= 10)

  # condicion_curso <- "Condición" del catálogo, criterio propio.
  expect_false(is.null(by_id$condicion_curso))
  expect_identical(by_id$condicion_curso$mappedColumn, "Condición")
  cc_labels <- toupper(unlist(lapply(by_id$condicion_curso$categories, function(c) c$label)))
  expect_true(all(cc_labels %in% c("OBLIGATORIO", "ELECTIVO")))

  # La condición del ESTUDIANTE sigue siendo su propio criterio (scope alumno).
  expect_identical(by_id$condition$scope, "alumno")
  cond_labels <- toupper(unlist(lapply(by_id$condition$categories, function(c) c$label)))
  expect_true(any(grepl("REINCORPORACION|MOVILIDAD|REGULAR", cond_labels)))
})

test_that("prioridad de columnas: el nivel curricular manda sobre créditos y el total administrativo sobre la población", {
  mp <- prosecnurapp:::.cm_aulas_config_mapping(list())
  base <- data.frame(
    student_id = c("s1", "s2"),
    aula_id = "A1",
    `Nivel según créditos` = c("7", "7"),
    `Nivel curricular` = c("5", "5"),
    `Matriculados población` = c(10, 10),
    `Matriculados total` = c(40, 40),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  # Acuerdo 2026-07-15: "el nivel curricular manda; créditos es apoyo".
  expect_identical(prosecnurapp:::.cm_aulas_col(base, mp$level), "Nivel curricular")
  # enrolled_total = TOTAL administrativo del aula, no la población elegible.
  expect_identical(prosecnurapp:::.cm_aulas_col(base, mp$enrolled_total), "Matriculados total")

  # De punta a punta: el marco lee esas columnas (nivel 5 y matrícula 40).
  frame <- calc_muestra_aulas_construir(
    base_madre = cbind(base, data.frame(
      facultad = "FAC1", sexo = c("F", "M"), edad = 20,
      condicion = "regular", modalidad = "presencial",
      stringsAsFactors = FALSE
    )),
    config = list(filters = list(min_eligible_per_class = 1L))
  )
  af <- frame$aula_frame
  expect_identical(af$level, "5")
  expect_identical(af$enrolled_total, 40L)
})

test_that("dual base: la señal per-fila del nivel del curso no queda contaminada por el código", {
  frame <- calc_muestra_aulas_construir(
    base_madre = .mapcol_matriculado(),
    catalogo_curso_horario = .mapcol_catalogo(),
    config = list(mapping = .mapcol_mapping(), filters = list(min_eligible_per_class = 1L))
  )
  af <- frame$aula_frame
  # course_level_num por aula proviene del catálogo (1/5/9), no de FIS101/202/303.
  expect_true(all(af$course_level_num %in% c(1, 5, 9)))
  # La columna informativa de condición del curso quedó poblada por aula.
  expect_true("condicion_curso" %in% names(af))
  expect_true(all(nzchar(af$condicion_curso)))
})

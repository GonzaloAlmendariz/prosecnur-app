# Regresión CROSS-HOJA INVERSA del homónimo "Condición" (bug ADR 0035 §2, caso
# HSTVG26). Complementa test-calc-muestra-aulas-condicion-curso-homonimo.R, que
# asume el catálogo LIMPIO: aquí la limpieza está al revés.
#
# Base MATRICULADO (alumno) trae la columna LIMPIA "Condición del curso" (solo
# OBLIGATORIO/ELECTIVO) y el usuario la mapeó A MANO a condicion_curso. El
# catálogo CURSO Y HORARIO NO tiene esa columna, pero sí una "Condición"
# HOMÓNIMA SUCIA (OBLIGATORIO/ELECTIVO mezclados con ruido de otra dimensión:
# ARTES, FILOSOFIA). Antes del fix, el candidato genérico "condicion" que
# .cm_catalogo_signal_candidates inyectaba SIEMPRE calzaba por clave contra esa
# "Condición" sucia y la señal del catálogo (precedencia catálogo > base) pisaba
# la columna limpia que el usuario eligió. Honrando el mapeo exclusivo (ADR
# 0035), con condicion_curso mapeado el genérico ya NO se inyecta: el catálogo no
# calza, la señal cae a la base limpia y mappedColumn reporta la columna real.

# Base del ALUMNO: "Condición del curso" LIMPIA (mapeo del usuario) + "Condición"
# del estudiante (condición de matrícula, otro rol). 4 aulas x 2 estudiantes.
.chcs_base <- function() {
  data.frame(
    `Código` = sprintf("A%02d", 1:8),
    Facultad = "CIENCIAS SOCIALES",
    Carrera = "SOCIOLOGIA",
    `Formación` = "PREGRADO",
    # Condición del ESTUDIANTE (matrícula): otro rol (condition), nunca curso.
    `Condición` = c("REGULAR", "REGULAR", "MOVILIDAD", "REGULAR",
                    "REGULAR", "MOVILIDAD", "REGULAR", "REGULAR"),
    # Condición del CURSO LIMPIA: la que el usuario mapeó a mano.
    `Condición del curso` = rep(c("OBLIGATORIO", "ELECTIVO", "OBLIGATORIO", "ELECTIVO"), each = 2),
    Sexo = rep(c("Femenino", "Masculino"), 4),
    Edad = 20,
    `Nivel curricular` = "5",
    `Curso-Horario` = rep(sprintf("C%d-H1", 1:4), each = 2),
    Curso = rep(sprintf("C%d", 1:4), each = 2),
    `Nombre del curso` = rep(c("Algebra", "Estadistica", "Fisica", "Historia"), each = 2),
    Horario = "H1",
    Modalidad = "Presencial",
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

# Catálogo curso-horario con la homónima "Condición" SUCIA: OBLIGATORIO/ELECTIVO
# reales mezclados con ruido de otra columna (ARTES, FILOSOFIA), como el marco
# real de 53 valores. NO existe "Condición del curso" aquí (vive en la base).
.chcs_catalogo <- function() {
  data.frame(
    `Curso-Horario` = sprintf("C%d-H1", 1:4),
    Curso = sprintf("C%d", 1:4),
    Horario = "H1",
    Modalidad = "Presencial",
    `Condición` = c("OBLIGATORIO", "ELECTIVO", "ARTES", "FILOSOFIA"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

# Mapping PLANO real: condition (matrícula) → "Condición"; condicion_curso mapeado
# A MANO → "Condición del curso" (LIMPIA, en la base). Ambas columnas coexisten,
# solo la del curso está mapeada al rol de curso.
.chcs_mapping <- function() {
  list(
    student_id = "Código", faculty = "Facultad", program = "Carrera",
    sex = "Sexo", level = "Nivel.curricular", age = "Edad",
    course_id = "Curso", classroom_id = "Curso-Horario",
    course_name = "Nombre.del.curso", schedule = "Horario",
    modality = "Modalidad",
    condition = "Condición", condicion_curso = "Condición del curso",
    formation = "Formación"
  )
}

.chcs_var <- function(frame, id, scope) {
  vars <- frame$criterios_catalogo$variables
  for (v in vars) if (identical(v$id, id) && identical(v$scope, scope)) return(v)
  NULL
}

.chcs_cat_keys <- function(var) {
  if (is.null(var) || is.null(var$categories)) return(character(0))
  vapply(var$categories, function(c) c$key %||% "", character(1))
}

test_that("con mapeo manual, condicion_curso lee la columna LIMPIA de la base y no la homónima sucia del catálogo", {
  frame <- calc_muestra_aulas_construir(
    base_madre = .chcs_base(),
    catalogo_curso_horario = .chcs_catalogo(),
    config = list(mapping = .chcs_mapping(), filters = list(min_eligible_per_class = 1L))
  )

  var <- .chcs_var(frame, "condicion_curso", "aula")
  expect_false(is.null(var))

  # La columna reportada es la que el usuario mapeó (base), no la del catálogo.
  expect_identical(var$mappedColumn, "Condición del curso")

  # Las categorías son las de la condición LIMPIA del curso; NADA de ruido de la
  # homónima sucia del catálogo (ARTES/FILOSOFIA) ni de la matrícula del alumno.
  keys <- .chcs_cat_keys(var)
  expect_true(all(keys %in% c("obligatorio", "electivo")))
  expect_false("artes" %in% keys)
  expect_false("filosofia" %in% keys)
  expect_false("regular" %in% keys)
  expect_false("movilidad" %in% keys)
  expect_setequal(keys, c("obligatorio", "electivo"))
})

test_that("aula_frame$condicion_curso arrastra la condición LIMPIA del curso, sin el ruido del catálogo", {
  frame <- calc_muestra_aulas_construir(
    base_madre = .chcs_base(),
    catalogo_curso_horario = .chcs_catalogo(),
    config = list(mapping = .chcs_mapping(), filters = list(min_eligible_per_class = 1L))
  )
  cc <- frame$aula_frame$condicion_curso
  expect_false(any(grepl("ARTES|FILOSOFIA", cc, ignore.case = TRUE)))
  expect_true(all(toupper(trimws(cc[nzchar(cc)])) %in% c("OBLIGATORIO", "ELECTIVO")))
})

test_that("sin mapeo de condicion_curso, el fallback genérico \"condicion\" del catálogo sigue operando", {
  # Catálogo legacy: condición del curso viene como "Condición" a secas y el
  # usuario NO mapeó condicion_curso. El genérico debe seguir recuperándola.
  mapping <- .chcs_mapping()
  mapping$condicion_curso <- NULL
  # Catálogo mono-señal LIMPIO (sin ruido) para el path legacy sin ambigüedad.
  catalogo <- .chcs_catalogo()
  catalogo$`Condición` <- c("OBLIGATORIO", "ELECTIVO", "OBLIGATORIO", "ELECTIVO")
  # Base sin la columna propia de condición del curso: el catálogo es la fuente.
  base <- .chcs_base()
  base[["Condición del curso"]] <- NULL

  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    catalogo_curso_horario = catalogo,
    config = list(mapping = mapping, filters = list(min_eligible_per_class = 1L))
  )
  var <- .chcs_var(frame, "condicion_curso", "aula")
  expect_false(is.null(var))
  keys <- .chcs_cat_keys(var)
  expect_setequal(keys, c("obligatorio", "electivo"))
})

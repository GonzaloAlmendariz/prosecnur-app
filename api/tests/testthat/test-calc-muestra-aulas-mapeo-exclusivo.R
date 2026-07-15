# ADR 0035 — Fase 1: mapeo manual EXCLUSIVO en calc-muestra de aulas.
#
# Antes, `.cm_aulas_config_mapping` PREPENDÍA la columna mapeada a mano a los
# candidatos fuzzy por defecto (unión). El fuzzy podía secuestrar el rol: p. ej.
# course_level = ["Nivel del curso", ...defaults] y, si la columna mapeada no
# calzaba exacto, el resolver caía en un default equivocado (el CÓDIGO del curso
# o la condición del estudiante). El ADR exige que un rol MAPEADO a mano se
# resuelva SOLO por su columna, sin fuzzy-fallback. Los roles NO mapeados
# conservan los defaults (retrocompat: goldens y proyecto de referencia siguen
# resolviendo por fuzzy).

# --- Exclusividad al nivel del merge (.cm_aulas_config_mapping) ---

test_that("course_level mapeado a mano queda EXCLUSIVO (solo la columna, sin defaults)", {
  out <- prosecnurapp:::.cm_aulas_config_mapping(list(course_level = "Nivel del curso"))
  # Candidatos = SOLO la columna mapeada; nada de "nivel_curso"/"ciclo_curso"/etc.
  expect_identical(out$course_level, "Nivel del curso")
  expect_length(out$course_level, 1L)
})

test_that("course_level exclusivo: el resolver base-scope toma 'Nivel del curso', nunca el código 'Curso'", {
  base <- data.frame(
    Curso = sprintf("C%d", 1:4),                 # CÓDIGO del curso
    `Nivel del curso` = as.character(1:4),        # NIVEL real
    check.names = FALSE, stringsAsFactors = FALSE
  )
  out <- prosecnurapp:::.cm_aulas_config_mapping(list(course_level = "Nivel del curso"))
  col <- prosecnurapp:::.cm_criterios_col_course_level(base, out)
  expect_identical(col, "Nivel del curso")
  expect_false(identical(col, "Curso"))
})

test_that("teacher_type mapeado a mano queda EXCLUSIVO y resuelve exacto, no 'Condición'", {
  out <- prosecnurapp:::.cm_aulas_config_mapping(list(teacher_type = "Tipo de docente"))
  expect_identical(out$teacher_type, "Tipo de docente")
  expect_length(out$teacher_type, 1L)

  base <- data.frame(
    `Tipo de docente` = "DOCENTE CONTRATADO",
    `Condición` = "Regular",
    `Nombre de docente` = "Juan Perez",
    check.names = FALSE, stringsAsFactors = FALSE
  )
  col <- prosecnurapp:::.cm_criterios_col_teacher_type(base, out)
  expect_identical(col, "Tipo de docente")
  expect_false(identical(col, "Condición"))
})

test_that("rol NO mapeado conserva los defaults fuzzy (retrocompat)", {
  out <- prosecnurapp:::.cm_aulas_config_mapping(list(course_level = "Nivel del curso"))
  # modality no vino en el mapping → mantiene la lista de defaults íntegra.
  defaults <- prosecnurapp:::.cm_aulas_config_mapping(list())
  expect_identical(out$modality, defaults$modality)
  expect_true(all(c("modality", "modalidad", "tipo_modalidad") %in% out$modality))

  # Y el fuzzy sigue resolviendo una columna real de modalidad.
  base <- data.frame(Modalidad = "Presencial", check.names = FALSE, stringsAsFactors = FALSE)
  expect_identical(prosecnurapp:::.cm_aulas_col(base, out$modality), "Modalidad")
})

test_that("rol mapeado a una columna AUSENTE queda sin señal, NO cae a otra por fuzzy", {
  # Base sin columna propia de tipo de docente pero CON 'Condición': el peligro
  # clásico del fuzzy (condicion ⊂ condicion_docente por reverse-match).
  base <- data.frame(
    Curso = "C1",
    `Condición` = "Regular",
    `Nombre de docente` = "Juan Perez",
    check.names = FALSE, stringsAsFactors = FALSE
  )
  defaults <- prosecnurapp:::.cm_aulas_config_mapping(list())

  # Contraste: la UNIÓN con defaults (comportamiento viejo) SÍ contaminaba a
  # 'Condición' vía el default "condicion_docente".
  contaminado <- prosecnurapp:::.cm_aulas_col(
    base, unique(c("Tipo de docente", defaults$teacher_type))
  )
  expect_identical(contaminado, "Condición")

  # Exclusivo: la columna mapeada no existe → sin señal, jamás 'Condición'.
  out <- prosecnurapp:::.cm_aulas_config_mapping(list(teacher_type = "Tipo de docente"))
  col <- prosecnurapp:::.cm_criterios_col_teacher_type(base, out)
  expect_identical(col, "")
})

# --- Integración: criterios_catalogo con mapeo manual limpio (single-column) ---

.cme_catalogo <- function() {
  data.frame(
    `Curso-Horario` = sprintf("C%d-H1", 1:6),
    Curso = sprintf("C%d", 1:6),                 # CÓDIGO del curso
    `Nombre del curso` = c("Algebra", "Historia", "Estadistica", "Fisica", "Quimica", "Biologia"),
    Horario = "H1",
    Modalidad = "Presencial",
    Tipo = "TEORICO",
    `Tipo de docente` = "DOCENTE CONTRATADO - CONTRATADO",
    `Condición` = "Regular",
    `Nombre de docente` = sprintf("DOC %d", 1:6),
    `Nivel del curso` = as.character(1:6),        # NIVEL real, distinto del código
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

.cme_base_madre <- function() {
  data.frame(
    `Código` = sprintf("A%02d", 1:12),
    Facultad = "CIENCIAS SOCIALES",
    Carrera = "SOCIOLOGIA",
    `Formación` = "PREGRADO",
    `Condición` = "Regular",
    Sexo = rep(c("Femenino", "Masculino"), 6),
    Edad = 20,
    `Nivel curricular` = "5",
    `Curso-Horario` = rep(sprintf("C%d-H1", 1:6), each = 2),
    Curso = rep(sprintf("C%d", 1:6), each = 2),
    `Nombre del curso` = rep(c("Algebra", "Historia", "Estadistica", "Fisica", "Quimica", "Biologia"), each = 2),
    Horario = "H1",
    Modalidad = "Presencial",
    Tipo = "TEORICO",
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

# Mapeo manual limpio de la Fase 1: una sola columna por rol.
.cme_mapping_limpio <- function() {
  list(
    student_id = "Código", faculty = "Facultad", program = "Carrera",
    sex = "Sexo", level = "Nivel curricular", age = "Edad",
    course_id = "Curso",
    course_level = "Nivel del curso",
    classroom_id = "Curso-Horario", course_name = "Nombre del curso",
    teacher = "Nombre de docente", teacher_type = "Tipo de docente",
    schedule = "Horario", modality = "Modalidad", session_type = "Tipo",
    condition = "Condición", condicion_curso = "Condición",
    formation = "Formación"
  )
}

test_that("integración: criterios_catalogo con mapeo exclusivo mapea course_level → 'Nivel del curso' y teacher_type → 'Tipo de docente'", {
  frame <- calc_muestra_aulas_construir(
    base_madre = .cme_base_madre(),
    catalogo_curso_horario = .cme_catalogo(),
    config = list(mapping = .cme_mapping_limpio(), filters = list(min_eligible_per_class = 1L))
  )
  vars <- frame$criterios_catalogo$variables
  ids <- vapply(vars, function(v) v$id %||% "", character(1))

  cl <- vars[[which(ids == "course_level")[[1]]]]
  expect_identical(cl$mappedColumn, "Nivel del curso")
  expect_false(identical(cl$mappedColumn, "Curso"))

  tt <- vars[[which(ids == "teacher_type")[[1]]]]
  expect_identical(tt$mappedColumn, "Tipo de docente")
})

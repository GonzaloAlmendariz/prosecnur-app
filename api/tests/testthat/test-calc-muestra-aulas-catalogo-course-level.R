# Fix de correctitud: el resolver de course_level DEL CATÁLOGO debe tener la
# misma guarda anti-colisión que el resolver base-scope
# (.cm_criterios_col_course_level). El catálogo curso-horario trae "Curso"
# (CÓDIGO del curso) y a veces "Nivel del curso" como columnas DISTINTAS. Un
# config viejo del .pulso puede prepender "Curso" a los candidatos de
# course_level; sin la guarda, el resolver exacto tomaba el código como si fuera
# nivel ("Nivel del curso · columna: Curso") y el filtro nivel-por-unidad
# operaba sobre basura.

# Catálogo curso-horario con AMBAS columnas: "Curso" (código) y "Nivel del
# curso" (nivel real). Una fila por curso-horario.
.clv_catalogo <- function(con_nivel = TRUE) {
  base <- data.frame(
    `Curso-Horario` = sprintf("C%d-H1", 1:6),
    Curso = sprintf("C%d", 1:6),          # CÓDIGO del curso
    `Nombre del curso` = c("Algebra", "Historia", "Estadistica", "Fisica", "Quimica", "Biologia"),
    Horario = "H1",
    Modalidad = "Presencial",
    Tipo = "TEORICO",
    `Tipo de docente` = "DOCENTE CONTRATADO - CONTRATADO",
    `Condición` = "Regular",
    `Nombre de docente` = sprintf("DOC %d", 1:6),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  if (con_nivel) base[["Nivel del curso"]] <- as.character(1:6)  # NIVEL real
  base
}

# Mapping con la contaminación del config viejo: "Curso" prependido a los
# candidatos de course_level, y course_id resolviendo también a "Curso".
.clv_mapping_contaminado <- function() {
  list(
    student_id = "Código", faculty = "Facultad", program = "Carrera",
    sex = "Sexo", level = "Nivel curricular", age = "Edad",
    course_id = "Curso",
    course_level = list("Curso", "course_level", "nivel_curso", "nivel del curso"),
    classroom_id = "Curso-Horario", course_name = "Nombre del curso",
    teacher = "Nombre de docente", teacher_type = "Tipo de docente",
    schedule = "Horario", modality = "Modalidad", session_type = "Tipo",
    condition = "Condición", condicion_curso = "Condición",
    formation = "Formación"
  )
}

test_that("catálogo: course_level cae en 'Nivel del curso' aunque el mapping tenga 'Curso' prependido", {
  sig <- .cm_aulas_catalog_aula_signals(.clv_catalogo(con_nivel = TRUE), .clv_mapping_contaminado())
  # El fix: NO usa el código del curso como nivel; resuelve la columna propia.
  expect_identical(sig$columns$course_level, "Nivel del curso")
  # No secuestró el código: la columna de course_level != la columna de course_id.
  expect_false(identical(sig$columns$course_level, "Curso"))
})

test_that("catálogo: sin columna propia de nivel, course_level queda SIN señal (no cae en el código)", {
  sig <- .cm_aulas_catalog_aula_signals(.clv_catalogo(con_nivel = FALSE), .clv_mapping_contaminado())
  # Degradación benigna documentada: "" (el nivel real llega por la sintética
  # del catálogo o el fallback modal del aula), NUNCA el código del curso.
  expect_identical(sig$columns$course_level, "")
})

test_that("catálogo: la guarda de course_level no rompe teacher_type ni condicion_curso", {
  sig <- .cm_aulas_catalog_aula_signals(.clv_catalogo(con_nivel = TRUE), .clv_mapping_contaminado())
  expect_identical(sig$columns$teacher_type, "Tipo de docente")
  expect_identical(sig$columns$condicion_curso, "Condición")
})

test_that("catálogo: mapping limpio (course_level='Nivel del curso' primero) sigue resolviendo", {
  mapping <- .clv_mapping_contaminado()
  mapping$course_level <- list("nivel del curso", "course_level")  # sin "Curso"
  sig <- .cm_aulas_catalog_aula_signals(.clv_catalogo(con_nivel = TRUE), mapping)
  expect_identical(sig$columns$course_level, "Nivel del curso")
})

test_that("helper .cm_criterios_col_exacta_excl salta las columnas excluidas respetando el orden", {
  df <- data.frame(Curso = "C1", `Nivel del curso` = "5", check.names = FALSE, stringsAsFactors = FALSE)
  candidates <- c("Curso", "nivel del curso")
  # Sin exclusión: gana el primer candidato exacto ("Curso").
  expect_identical(.cm_criterios_col_exacta_excl(df, candidates, character(0)), "Curso")
  # Excluyendo "Curso": cae en la columna propia por clave exacta.
  expect_identical(.cm_criterios_col_exacta_excl(df, candidates, "Curso"), "Nivel del curso")
  # Excluyendo todo lo que hay: sin señal.
  expect_identical(.cm_criterios_col_exacta_excl(df, candidates, c("Curso", "Nivel del curso")), "")
})

# --- Integración: el mappedColumn del criterio course_level de criterios_catalogo ---

.clv_base_madre <- function() {
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

test_that("integración: criterios_catalogo expone course_level con mappedColumn='Nivel del curso'", {
  frame <- calc_muestra_aulas_construir(
    base_madre = .clv_base_madre(),
    catalogo_curso_horario = .clv_catalogo(con_nivel = TRUE),
    config = list(mapping = .clv_mapping_contaminado(), filters = list(min_eligible_per_class = 1L))
  )
  vars <- frame$criterios_catalogo$variables
  ids <- vapply(vars, function(v) v$id %||% "", character(1))
  cl <- vars[[which(ids == "course_level")[[1]]]]
  expect_identical(cl$mappedColumn, "Nivel del curso")

  # Y teacher_type / condicion_curso siguen apuntando a sus columnas propias.
  tt <- vars[[which(ids == "teacher_type")[[1]]]]
  expect_identical(tt$mappedColumn, "Tipo de docente")
  cc <- vars[[which(ids == "condicion_curso")[[1]]]]
  expect_identical(cc$mappedColumn, "Condición")
})

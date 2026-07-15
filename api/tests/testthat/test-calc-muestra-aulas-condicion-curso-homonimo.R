# Regresión del homónimo cross-hoja "Condición" (bug ADR 0035 §2). En modo
# base_madre el mapping llega PLANO (rol→columna, sin hoja): el usuario mapea
# condicion_curso a "Condición", pero esa columna EXISTE con el mismo nombre en
# la hoja del ALUMNO (condición de matrícula: REGULAR/MOVILIDAD…) y en la del
# CATÁLOGO (condición del curso: OBLIGATORIO/ELECTIVO). El resolver exacto de la
# base calzaba condicion_curso contra la MISMA columna que condition y, cuando el
# catálogo venía casi vacío (el 98.3% del caso HST-UNSA), el fallback consumía la
# condición del ESTUDIANTE como si fuera la del curso. La guarda anti-homónimo
# (.cm_criterios_col_condicion_curso) anula la señal base cuando colisiona con
# condition, dejando el catálogo como única fuente.

# Fixture mínima: 4 aulas x 2 estudiantes, dos hojas homónimas.
.chom_base <- function() {
  data.frame(
    `Código` = sprintf("A%02d", 1:8),
    Facultad = "CIENCIAS SOCIALES",
    Carrera = "SOCIOLOGIA",
    `Formación` = "PREGRADO",
    # Condición del ESTUDIANTE (matrícula): esto NUNCA debe aparecer como
    # categoría de condicion_curso.
    `Condición` = c("REGULAR", "REGULAR", "MOVILIDAD", "REGULAR",
                    "REGULAR", "MOVILIDAD", "REGULAR", "REGULAR"),
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

# Catálogo curso-horario con columna homónima "Condición" = condición DEL CURSO,
# mayormente VACÍA (como el caso real): solo C1/C2 traen valor.
.chom_catalogo <- function() {
  data.frame(
    `Curso-Horario` = sprintf("C%d-H1", 1:4),
    Curso = sprintf("C%d", 1:4),
    Horario = "H1",
    Modalidad = "Presencial",
    `Condición` = c("OBLIGATORIO", "ELECTIVO", "", ""),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

# Mapping PLANO como el payload real: condition y condicion_curso apuntan al
# MISMO nombre de columna ("Condición"), sin hoja/source que los desambigüe.
.chom_mapping <- function() {
  list(
    student_id = "Código", faculty = "Facultad", program = "Carrera",
    sex = "Sexo", level = "Nivel.curricular", age = "Edad",
    course_id = "Curso", classroom_id = "Curso-Horario",
    course_name = "Nombre.del.curso", schedule = "Horario",
    modality = "Modalidad",
    condition = "Condición", condicion_curso = "Condición",
    formation = "Formación"
  )
}

# Extrae la variable de la enumeración por id y scope.
.chom_var <- function(frame, id, scope) {
  vars <- frame$criterios_catalogo$variables
  for (v in vars) if (identical(v$id, id) && identical(v$scope, scope)) return(v)
  NULL
}

# Claves de categoría (kind flat) de una variable enumerada.
.chom_cat_keys <- function(var) {
  if (is.null(var) || is.null(var$categories)) return(character(0))
  vapply(var$categories, function(c) c$key %||% "", character(1))
}

test_that("la enumeración de condicion_curso solo trae condición DE CURSO, nunca del alumno", {
  frame <- calc_muestra_aulas_construir(
    base_madre = .chom_base(),
    catalogo_curso_horario = .chom_catalogo(),
    config = list(mapping = .chom_mapping(), filters = list(min_eligible_per_class = 1L))
  )

  var <- .chom_var(frame, "condicion_curso", "aula")
  expect_false(is.null(var))
  keys <- .chom_cat_keys(var)

  # Categorías de condición del CURSO (obligatorio/electivo) del catálogo, más el
  # bucket sintético "sin_condicion" por las aulas C3/C4 con condición vacía
  # (feature: el vacío es una categoría explícita, no se descarta).
  expect_true(all(keys %in% c("obligatorio", "electivo", "sin_condicion")))
  # NUNCA condición del estudiante (el valor leaked de la hoja del alumno).
  expect_false("regular" %in% keys)
  expect_false("movilidad" %in% keys)
  expect_setequal(keys, c("obligatorio", "electivo", "sin_condicion"))
})

test_that("aula_frame$condicion_curso no arrastra la condición del estudiante (señal base anulada por colisión)", {
  frame <- calc_muestra_aulas_construir(
    base_madre = .chom_base(),
    catalogo_curso_horario = .chom_catalogo(),
    config = list(mapping = .chom_mapping(), filters = list(min_eligible_per_class = 1L))
  )
  cc <- frame$aula_frame$condicion_curso
  # La señal base se anula (colisión con condition): sin REGULAR/MOVILIDAD.
  expect_false(any(grepl("REGULAR|MOVILIDAD", cc, ignore.case = TRUE)))
})

test_that("guarda: sin colisión, condicion_curso conserva su columna propia", {
  # Base donde condicion_curso mapea a una columna PROPIA (distinta de condition):
  # la guarda no interviene y la señal base se conserva.
  base <- .chom_base()
  base[["Condición del curso"]] <- rep(c("OBLIGATORIO", "ELECTIVO", "OBLIGATORIO", "ELECTIVO"), each = 2)
  raw <- base
  mapping <- .chom_mapping()
  mapping$condicion_curso <- "Condición del curso"

  # La columna propia se resuelve y NO se anula (no colisiona con condition).
  expect_identical(.cm_criterios_col_condicion_curso(raw, mapping), "Condición del curso")

  # Con el mapping en colisión (ambos a "Condición") sí se anula.
  mapping_col <- .chom_mapping()
  expect_identical(.cm_criterios_col_condicion_curso(raw, mapping_col), "")
})

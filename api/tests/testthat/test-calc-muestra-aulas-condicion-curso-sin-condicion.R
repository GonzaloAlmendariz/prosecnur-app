# Bucket sintético "Sin condición" para condicion_curso (pedido PUCP + ADR 0035
# §5). En la data real "CURSO Y HORARIO"·"Condición" viene ~98% vacía; el usuario
# quiere que ese vacío sea una CATEGORÍA explícita ("sin_condicion") que pueda
# INCLUIR o excluir como cualquier otra, en vez de que los cursos sin condición
# se caigan del marco al filtrar. Cubre tres invariantes:
#   1. Enumeración: aparece la categoría "sin_condicion" con conteo = nº de aulas
#      con condición vacía, junto a las categorías reales (etiquetas crudas).
#   2. Evaluación: {obligatorio, sin_condicion} incluye las aulas vacías;
#      {obligatorio} las excluye — simétrico con las categorías reales.
#   3. Graceful: base SIN columna de condicion_curso → no hay categoría fantasma
#      ni el criterio fuerza recorte.

# 6 curso-horarios × 2 estudiantes. El catálogo trae la condición DEL CURSO:
# C1/C2 OBLIGATORIO, C3 ELECTIVO, C4/C5/C6 VACÍA (3 aulas "sin condición").
.scc_base <- function() {
  data.frame(
    `Código` = sprintf("A%02d", 1:12),
    Facultad = "CIENCIAS SOCIALES",
    Carrera = "SOCIOLOGIA",
    `Formación` = "PREGRADO",
    # Condición del ESTUDIANTE (matrícula): jamás debe aparecer como categoría de
    # condicion_curso ni contaminar el bucket sintético.
    `Condición` = "REGULAR",
    Sexo = rep(c("Femenino", "Masculino"), 6),
    Edad = 20,
    `Nivel curricular` = "5",
    `Curso-Horario` = rep(sprintf("C%d-H1", 1:6), each = 2),
    Curso = rep(sprintf("C%d", 1:6), each = 2),
    `Nombre del curso` = rep(c("Algebra", "Historia", "Fisica", "Quimica", "Biologia", "Arte"), each = 2),
    Horario = "H1",
    Modalidad = "Presencial",
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

# Catálogo con la condición DEL CURSO en columna propia (nombre distinto de la
# "Condición" del estudiante en la base → sin colisión de homónimo).
.scc_catalogo <- function() {
  data.frame(
    `Curso-Horario` = sprintf("C%d-H1", 1:6),
    Curso = sprintf("C%d", 1:6),
    Horario = "H1",
    Modalidad = "Presencial",
    `Condición del curso` = c("OBLIGATORIO", "OBLIGATORIO", "ELECTIVO", "", "", ""),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

.scc_mapping <- function() {
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

.scc_construir <- function(base = .scc_base(), catalogo = .scc_catalogo(),
                           mapping = .scc_mapping(), suite = NULL) {
  cfg <- list(mapping = mapping, filters = list(min_eligible_per_class = 1L))
  if (!is.null(suite)) cfg$criterios_seleccion <- suite
  calc_muestra_aulas_construir(base_madre = base, catalogo_curso_horario = catalogo, config = cfg)
}

.scc_var <- function(frame, id = "condicion_curso", scope = "aula") {
  for (v in frame$criterios_catalogo$variables) {
    if (identical(v$id, id) && identical(v$scope, scope)) return(v)
  }
  NULL
}

.scc_cat <- function(var, key) {
  for (c in (var$categories %||% list())) if (identical(c$key, key)) return(c)
  NULL
}

.scc_included <- function(frame) {
  af <- frame$aula_frame
  stats::setNames(af$included %in% TRUE, af$classroom_id)
}

# ---- 1. Enumeración -----------------------------------------------------------

test_that("la enumeración de condicion_curso trae 'sin_condicion' con el conteo de aulas vacías", {
  frame <- .scc_construir()
  var <- .scc_var(frame)
  expect_false(is.null(var))

  keys <- vapply(var$categories, function(c) c$key %||% "", character(1))
  expect_setequal(keys, c("obligatorio", "electivo", "sin_condicion"))

  # Conteos: 2 obligatorio (C1,C2), 1 electivo (C3), 3 sin condición (C4,C5,C6).
  expect_equal(.scc_cat(var, "obligatorio")$aulas, 2L)
  expect_equal(.scc_cat(var, "electivo")$aulas, 1L)
  bucket <- .scc_cat(var, "sin_condicion")
  expect_equal(bucket$aulas, 3L)
  # Bucket sintético: label fijo "Sin condición", sin variantes crudas.
  expect_identical(bucket$label, "Sin condición")
  expect_true(isTRUE(bucket$synthetic))
  expect_length(bucket$variants, 0L)

  # Los valores REALES conservan su etiqueta cruda (no se renombran).
  expect_identical(toupper(.scc_cat(var, "obligatorio")$label), "OBLIGATORIO")
})

# ---- 2. Evaluación / filtro ---------------------------------------------------

test_that("selección {obligatorio, sin_condicion} INCLUYE las aulas con condición vacía", {
  suite <- list(byVariable = list(
    condicion_curso = list(mode = "include", categories = list("obligatorio", "sin_condicion"))
  ))
  inc <- .scc_included(.scc_construir(suite = suite))
  # Obligatorio (C1,C2) + sin condición (C4,C5,C6) incluidas; electivo (C3) fuera.
  expect_true(all(inc[c("C1-H1", "C2-H1", "C4-H1", "C5-H1", "C6-H1")]))
  expect_false(inc[["C3-H1"]])
})

test_that("selección {obligatorio} EXCLUYE las aulas con condición vacía (el bucket es una categoría normal)", {
  suite <- list(byVariable = list(
    condicion_curso = list(mode = "include", categories = list("obligatorio"))
  ))
  inc <- .scc_included(.scc_construir(suite = suite))
  # Solo obligatorio (C1,C2). Vacías (C4,C5,C6) y electivo (C3) EXCLUIDAS.
  expect_true(all(inc[c("C1-H1", "C2-H1")]))
  expect_false(any(inc[c("C3-H1", "C4-H1", "C5-H1", "C6-H1")]))
})

test_that("selección {sin_condicion} incluye SOLO las aulas con condición vacía", {
  suite <- list(byVariable = list(
    condicion_curso = list(mode = "include", categories = list("sin_condicion"))
  ))
  inc <- .scc_included(.scc_construir(suite = suite))
  expect_true(all(inc[c("C4-H1", "C5-H1", "C6-H1")]))
  expect_false(any(inc[c("C1-H1", "C2-H1", "C3-H1")]))
})

# ---- 3. Graceful cuando la variable NO existe ---------------------------------

test_that("base SIN columna de condicion_curso: no hay categoría 'Sin condición' ni el criterio filtra", {
  # Catálogo sin la columna de condición del curso → condicion_curso no resuelve
  # ninguna columna en base ni catálogo.
  catalogo_sin_cc <- .scc_catalogo()
  catalogo_sin_cc[["Condición del curso"]] <- NULL

  frame <- .scc_construir(catalogo = catalogo_sin_cc)
  # La variable no se enumera (no hay columna, no hay bucket fantasma).
  expect_null(.scc_var(frame))

  # Y una selección stale de condicion_curso NO fuerza recorte: todas pasan.
  suite <- list(byVariable = list(
    condicion_curso = list(mode = "include", categories = list("obligatorio"))
  ))
  inc <- .scc_included(.scc_construir(catalogo = catalogo_sin_cc, suite = suite))
  expect_true(all(inc))
})

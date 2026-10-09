# Criterio de marco «Aula asignada», con bucket sintético «Sin aula asignada».
#
# Gonzalo, 2026-08-28: «el criterio de sin aula asignada debería ser un criterio
# para definir el marco». Sale del segundo sorteo de HSVG 2026, donde el recorte
# se hizo FUERA de la app: el reporte de la DTI declara presenciales
# cursos-horario con día y hora pero SIN indicar el aula, y a esos no se puede
# ir. Medido en su Excel de descuento: **61 de 1.573**. Al no existir el
# criterio, el marco del sorteo no se reproducía desde el proyecto.
#
# Cubre las mismas tres invariantes que el bucket de condicion_curso:
#   1. Enumeración: aparece «sin_aula» con el conteo de aulas sin salón.
#   2. Evaluación: incluirlo las conserva; omitirlo las recorta.
#   3. Graceful: sin columna de aula no hay categoría fantasma ni recorte.

# 6 curso-horarios × 2 estudiantes. El catálogo trae el salón: C1..C4 con aula,
# C5 y C6 SIN aula (una vacía y otra con espacios, que es como llega).
.sinaula_base <- function() {
  data.frame(
    `Código` = sprintf("A%02d", 1:12),
    Facultad = "CIENCIAS SOCIALES",
    Carrera = "SOCIOLOGIA",
    `Formación` = "PREGRADO",
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

.sinaula_catalogo <- function(con_columna = TRUE) {
  d <- data.frame(
    `Curso-Horario` = sprintf("C%d-H1", 1:6),
    Curso = sprintf("C%d", 1:6),
    Horario = "H1",
    Modalidad = "Presencial",
    check.names = FALSE, stringsAsFactors = FALSE
  )
  if (con_columna) d[["SESIONES"]] <- c(
    "LUN 10:00-12:00 C A101", "MAR 08:00-10:00 C A101", "MIE 14:00-16:00 H B202",
    "JUE 16:00-18:00 C C303", "VIE 09:00-11:00 C", "LUN 18:00-20:00 H"
  )
  d
}

.sinaula_mapping <- function(con_columna = TRUE) {
  m <- list(
    student_id = "Código", faculty = "Facultad", program = "Carrera",
    sex = "Sexo", level = "Nivel.curricular", age = "Edad",
    course_id = "Curso", classroom_id = "Curso-Horario",
    course_name = "Nombre.del.curso", schedule = "Horario",
    modality = "Modalidad", condition = "Condición", formation = "Formación"
  )
  if (con_columna) m$classroom_label <- "SESIONES"
  m
}

.sinaula_construir <- function(con_columna = TRUE, suite = NULL) {
  cfg <- list(
    mapping = .sinaula_mapping(con_columna),
    filters = list(min_eligible_per_class = 1L)
  )
  if (!is.null(suite)) cfg$criterios_seleccion <- suite
  calc_muestra_aulas_construir(
    base_madre = .sinaula_base(),
    catalogo_curso_horario = .sinaula_catalogo(con_columna),
    config = cfg
  )
}

.sinaula_var <- function(frame) {
  for (v in frame$criterios_catalogo$variables) {
    if (identical(v$id, "venue") && identical(v$scope, "aula")) return(v)
  }
  NULL
}

.sinaula_cat <- function(var, key) {
  for (c in (var$categories %||% list())) if (identical(c$key, key)) return(c)
  NULL
}

.sinaula_included <- function(frame) {
  af <- frame$aula_frame
  stats::setNames(af$included %in% TRUE, af$classroom_id)
}

# ---- 1. Enumeración -----------------------------------------------------------

test_that("la enumeración del aula trae 'sin_aula' con el conteo de las que no la tienen", {
  var <- .sinaula_var(.sinaula_construir())
  expect_false(is.null(var))
  expect_identical(var$label, "Aula asignada")

  bucket <- .sinaula_cat(var, "sin_aula")
  expect_false(is.null(bucket))
  # C5 (vacía) y C6 (solo espacios): las dos cuentan como sin aula.
  expect_equal(bucket$aulas, 2L)
  expect_identical(bucket$label, "Sin aula asignada")
  expect_true(isTRUE(bucket$synthetic))

  # PRESENCIA, no identidad: exactamente DOS categorias. El nombre del salon no
  # es criterio de nadie y enumerarlo daba una tarjeta con ~1.000 fichas.
  keys <- sort(vapply(var$categories, function(c) c$key %||% "", character(1)))
  expect_length(keys, 2L)
  expect_true("sin_aula" %in% keys)
  # La otra categoria se muestra legible, no con su clave cruda.
  con <- Filter(function(c) !identical(c$key, "sin_aula"), var$categories)[[1]]
  expect_identical(con$label, "Con aula asignada")
  expect_equal(con$aulas, 4L)
})

# ---- 2. Evaluación / filtro ---------------------------------------------------

test_that("omitir 'sin_aula' recorta del marco los cursos-horario sin salón", {
  # El caso de HSVG 2026: se incluyen todas las aulas reales y NO el bucket.
  suite <- list(byVariable = list(
    venue = list(mode = "include", categories = list("con_aula_asignada"))
  ))
  inc <- .sinaula_included(.sinaula_construir(suite = suite))
  expect_true(all(inc[c("C1-H1", "C2-H1", "C3-H1", "C4-H1")]))
  expect_false(any(inc[c("C5-H1", "C6-H1")]))
})

test_that("incluir 'sin_aula' las conserva, como cualquier otra categoría", {
  suite <- list(byVariable = list(
    venue = list(mode = "include", categories = list("con_aula_asignada", "sin_aula"))
  ))
  inc <- .sinaula_included(.sinaula_construir(suite = suite))
  expect_true(all(inc[sprintf("C%d-H1", 1:6)]))
})

test_that("seleccionar SOLO 'sin_aula' deja unicamente las que no tienen salon", {
  suite <- list(byVariable = list(
    venue = list(mode = "include", categories = list("sin_aula"))
  ))
  inc <- .sinaula_included(.sinaula_construir(suite = suite))
  expect_true(all(inc[c("C5-H1", "C6-H1")]))
  expect_false(any(inc[c("C1-H1", "C2-H1", "C3-H1", "C4-H1")]))
})

# ---- 3. Graceful cuando la columna NO existe ----------------------------------

test_that("sin columna de aula no hay categoria fantasma ni recorte", {
  frame <- .sinaula_construir(con_columna = FALSE)
  var <- .sinaula_var(frame)
  # O no se enumera, o se enumera sin el bucket sintetico: lo que NO puede pasar
  # es que el vacio de una columna inexistente recorte el marco.
  if (!is.null(var)) expect_true(is.null(.sinaula_cat(var, "sin_aula")))
  inc <- .sinaula_included(frame)
  expect_true(all(inc[sprintf("C%d-H1", 1:6)]))
})

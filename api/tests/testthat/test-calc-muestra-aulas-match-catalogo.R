# La clave del aula es curso x seccion x horario; el label no es identidad.
#
# Medido el 2026-08-19 con la base DTI 2026 real: el fuzzy resolvia
# classroom_label -> SESIONES en el catalogo (dia/hora/salon) y la clave
# compuesta del catalogo arrastraba ese texto mientras la de la base no.
# Overlap: 397/5.269 aulas; sin label en la composicion: 5.269/5.269. El
# sintoma visible era teacher_type vacio en 4.872 aulas y un marco 2026 con
# CERO aulas incluidas (toda razon de exclusion contenia teacher_type).

test_that("el catalogo con SESIONES matchea igual la base sin esa columna", {
  base <- data.frame(
    ALUMNO = c("a1", "a2", "a3"),
    CLAVECURSO = c("ACT131", "ACT131", "LIT105"),
    HORARIO = c("0201", "0201", "0204"),
    stringsAsFactors = FALSE
  )
  catalogo <- data.frame(
    CLAVECURSO = c("ACT131", "LIT105"),
    HORARIO = c("0201", "0204"),
    SESIONES = c("MAR 10:00-12:00 C", "MIE 08:00-10:00 C L401"),
    stringsAsFactors = FALSE
  )
  mapping <- list(
    student_id = "ALUMNO",
    course_id = "CLAVECURSO",
    schedule = "HORARIO",
    classroom_label = c("classroom_label", "sesiones_y_aula", "aula", "salon")
  )
  kb <- .cm_aulas_catalog_keys(base, mapping)
  kc <- .cm_aulas_catalog_keys(catalogo, mapping)
  expect_setequal(unique(kb), unique(kc))
  expect_true(all(nzchar(kb)))
})

test_that("si las tres facetas de identidad vienen vacias, el label entra de ultimo recurso", {
  df <- data.frame(
    AULA_LABEL = c("Aula Magna", "Lab 3"),
    stringsAsFactors = FALSE
  )
  mapping <- list(classroom_label = "AULA_LABEL")
  keys <- .cm_aulas_classroom_id(df, mapping)
  expect_identical(keys, c("aula_magna", "lab_3"))
})

test_that("de punta a punta: el catalogo con SESIONES rellena teacher_type y el aula entra", {
  base <- data.frame(
    ALUMNO = sprintf("s%02d", 1:40),
    CLAVECURSO = rep(c("ACT131", "LIT105"), each = 20),
    HORARIO = rep(c("0201", "0204"), each = 20),
    NOMBREFAC = "FAC1",
    NOMBRESPECI = "P1",
    SEXO = "F",
    EDAD = 20,
    CONDI = "regular",
    NIVELCURR = "3",
    MODLIDAD = "presencial",
    stringsAsFactors = FALSE
  )
  catalogo <- data.frame(
    CLAVECURSO = c("ACT131", "LIT105"),
    HORARIO = c("0201", "0204"),
    SESIONES = c("MAR 10:00-12:00 C", "MIE 08:00-10:00 C L401"),
    TIPODOCENTE = c("DOCENTE CONTRATADO - A", "DOCENTE ORDINARIO"),
    NOMBREDOCENTE = c("PEREZ", "QUISPE"),
    stringsAsFactors = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(
    mapping = list(
      student_id = "ALUMNO", course_id = "CLAVECURSO", schedule = "HORARIO",
      faculty = "NOMBREFAC", program = "NOMBRESPECI", sex = "SEXO",
      age = "EDAD", condition = "CONDI", level = "NIVELCURR",
      modality = "MODLIDAD", teacher = "NOMBREDOCENTE", teacher_type = "TIPODOCENTE"
    ),
    filters = list(min_eligible_per_class = 1L)
  ))
  frame <- calc_muestra_aulas_construir(base_madre = base, catalogo_curso_horario = catalogo, config = cfg)
  af <- frame$aula_frame
  expect_identical(nrow(af), 2L)
  expect_true(all(nzchar(af$teacher_type)))
  expect_true(all(af$included))
  expect_identical(frame$catalog_audit$matched_classrooms, 2L)
})

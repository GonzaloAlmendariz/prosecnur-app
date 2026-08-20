# M9 · El frame publica que columna resolvio cada rol.
#
# Antes la resolucion vivia solo dentro del build: la pestaña de Variables
# decia «Sin asignar» con el marco construido (medido 2026-08-20 con el
# mapping 2026 sellado). La ausencia de un rol dice «no hay columna» — jamas
# se publica "" ni se inventa.

test_that("resuelve base y catalogo por separado con el mapping dado", {
  base <- data.frame(
    ALUMNO = c("a1", "a2"), NOMBREFAC = c("F1", "F2"), SEXO = c("F", "M"),
    CLAVECURSO = c("C1", "C2"), HORARIO = c("01", "02"),
    stringsAsFactors = FALSE
  )
  catalogo <- data.frame(
    CLAVECURSO = "C1", HORARIO = "01", TIPODOCENTE = "CONTRATADO",
    NOMBREDOCENTE = "PEREZ", stringsAsFactors = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(mapping = list(
    student_id = "ALUMNO", faculty = "NOMBREFAC", sex = "SEXO",
    course_id = "CLAVECURSO", schedule = "HORARIO",
    teacher = "NOMBREDOCENTE", teacher_type = "TIPODOCENTE"
  )))
  out <- calc_muestra_aulas_mapeo_resuelto(base, catalogo, cfg$mapping)
  expect_identical(out$base$student_id, "ALUMNO")
  expect_identical(out$base$faculty, "NOMBREFAC")
  expect_identical(out$base$sex, "SEXO")
  expect_null(out$base$teacher_type)          # no esta en la base
  expect_identical(out$catalogo$teacher_type, "TIPODOCENTE")
  expect_null(out$catalogo$student_id)        # no esta en el catalogo
  expect_null(out$base$campus)                # sin columna: AUSENTE, no ""
})

test_that("el frame construido lo publica (el hook real)", {
  base <- data.frame(
    ALUMNO = sprintf("s%02d", 1:20), CLAVECURSO = "CUR1", HORARIO = "0101",
    NOMBREFAC = "FAC1", NOMBRESPECI = "P1", SEXO = "F", EDAD = 20,
    CONDI = "regular", NIVELCURR = "3", MODLIDAD = "presencial",
    stringsAsFactors = FALSE
  )
  cfg <- calc_muestra_aulas_normalize_config(list(
    mapping = list(
      student_id = "ALUMNO", course_id = "CLAVECURSO", schedule = "HORARIO",
      faculty = "NOMBREFAC", program = "NOMBRESPECI", sex = "SEXO",
      age = "EDAD", condition = "CONDI", level = "NIVELCURR", modality = "MODLIDAD"
    ),
    filters = list(min_eligible_per_class = 1L)
  ))
  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
  expect_identical(frame$mapeo_resuelto$schema, "cm_mapeo_resuelto_v1")
  expect_identical(frame$mapeo_resuelto$base$faculty, "NOMBREFAC")
  expect_identical(frame$mapeo_resuelto$base$student_id, "ALUMNO")
})

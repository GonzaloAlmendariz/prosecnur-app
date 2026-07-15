# ADR 0035 — el frame expone el orden EFECTIVO de jerarquía docente
# (teacher_type_orden) con el que se construyó, para que el frontend detecte
# staleness (marco desactualizado) al reordenar. Debe ser el orden RESUELTO por
# el normalizador (.cm_criterios_normalize_teacher_orden), no el crudo: NULL/
# vacío colapsa al default académico y un orden custom se canoniza.

.tof_base <- function() {
  data.frame(
    student_id = sprintf("S%02d", 1:8),
    classroom_id = rep(sprintf("C%d", 1:4), each = 2),
    course_id = rep(sprintf("CUR%d", 1:4), each = 2),
    course_name = rep(c("Algebra", "Historia", "Fisica", "Arte"), each = 2),
    faculty = "CIENCIAS",
    program = "MATE",
    level = "5",
    sex = rep(c("F", "M"), 4),
    age = 20,
    condition = "REGULAR",
    formation = "PREGRADO",
    modality = "Presencial",
    stringsAsFactors = FALSE, check.names = FALSE
  )
}

.tof_mapping <- function() {
  list(
    student_id = "student_id", classroom_id = "classroom_id",
    course_id = "course_id", course_name = "course_name",
    faculty = "faculty", program = "program", level = "level",
    sex = "sex", age = "age", condition = "condition",
    formation = "formation", modality = "modality"
  )
}

test_that("sin orden en config: frame$teacher_type_orden trae el default académico efectivo", {
  frame <- calc_muestra_aulas_construir(
    base_madre = .tof_base(),
    config = list(mapping = .tof_mapping(), filters = list(min_eligible_per_class = 1L))
  )
  expect_false(is.null(frame$teacher_type_orden))
  expect_identical(frame$teacher_type_orden, as.list(.cm_criterios_teacher_orden_default()))
})

test_that("con orden custom (labels crudos): frame$teacher_type_orden trae el orden canonizado efectivo", {
  orden_crudo <- list("DOCENTE CONTRATADO", "DOCENTE ORDINARIO - PRINCIPAL")
  frame <- calc_muestra_aulas_construir(
    base_madre = .tof_base(),
    config = list(
      mapping = .tof_mapping(),
      filters = list(min_eligible_per_class = 1L),
      teacher_type_orden = orden_crudo
    )
  )
  esperado <- as.list(.cm_criterios_normalize_teacher_orden(orden_crudo))
  expect_identical(frame$teacher_type_orden, esperado)
  # Efectivamente canonizado (no el crudo).
  expect_identical(frame$teacher_type_orden[[1]], "docente_contratado")
  expect_identical(frame$teacher_type_orden[[2]], "docente_ordinario_principal")
})

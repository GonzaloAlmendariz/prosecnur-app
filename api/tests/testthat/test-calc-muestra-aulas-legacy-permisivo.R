# ADR 0035 — "ningún criterio asumido". Cuando la suite de criterios por
# categoría está INACTIVA, el frontend envía un bloque `filters` PERMISIVO (todos
# los require_* en FALSE y todas las listas de patrones vacías) para que el marco
# NO recorte a nadie en silencio por los filtros legacy. Esta regresión congela
# esa invariante en el path legacy (.cm_criterios_seleccion_activa == FALSE):
#   (1) bloque permisivo  → population_n == universo único total de la base;
#   (2) require_undergraduate=TRUE + accepted_formation_patterns=["pregrado"] SÍ
#       filtra (no se rompe el filtrado legacy real).
# El riesgo cubierto: que una lista vacía (accepted_conditions/formation/
# teacher_type) se interprete como "excluir a todos" en vez de "sin filtro".

# 12 estudiantes únicos en 4 aulas. A propósito la base mezcla señales que los
# filtros legacy recortarían si estuvieran activos: menores de edad (17),
# condición no regular (MOVILIDAD), formación de posgrado (MAESTRIA) y modalidad
# virtual. En modo permisivo NINGUNA debe restar población.
.lpm_base <- function() {
  data.frame(
    student_id = sprintf("S%02d", 1:12),
    classroom_id = rep(sprintf("C%d", 1:4), each = 3),
    course_id = rep(sprintf("CUR%d", 1:4), each = 3),
    course_name = rep(c("Algebra", "Historia", "Fisica", "Arte"), each = 3),
    faculty = "CIENCIAS",
    program = "MATE",
    level = "5",
    sex = rep(c("F", "M", "F"), 4),
    age = rep(c(20, 17, 30), 4),
    condition = rep(c("REGULAR", "MOVILIDAD", "REGULAR"), 4),
    formation = rep(c("PREGRADO", "MAESTRIA", "PREGRADO"), 4),
    modality = rep(c("Presencial", "Virtual", "Presencial"), 4),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.lpm_mapping <- function() {
  list(
    student_id = "student_id", classroom_id = "classroom_id",
    course_id = "course_id", course_name = "course_name",
    faculty = "faculty", program = "program", level = "level",
    sex = "sex", age = "age", condition = "condition",
    formation = "formation", modality = "modality"
  )
}

# Bloque permisivo tal como lo arma el frontend con la suite inactiva: cada
# lista vacía y cada require_* en FALSE, conservando min_eligible_per_class.
.lpm_filters_permisivos <- function() {
  list(
    require_undergraduate = FALSE,
    require_adult = FALSE,
    require_in_person = FALSE,
    require_stable_teacher = FALSE,
    accepted_conditions = list(),
    accepted_formation_patterns = list(),
    accepted_teacher_type_patterns = list(),
    exclude_session_patterns = list(),
    exclude_modality_patterns = list(),
    exclude_level_patterns = list(),
    accepted_campuses = list(),
    nivel_por_unidad = list(),
    require_min_prevalence = FALSE,
    require_cycle_homogeneity = FALSE,
    min_eligible_per_class = 1L
  )
}

.lpm_population_n <- function(frame) {
  as.integer(nrow(frame$population))
}

test_that("bloque permisivo (suite inactiva): population_n == universo único total, sin recorte silencioso", {
  base <- .lpm_base()
  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = list(mapping = .lpm_mapping(), filters = .lpm_filters_permisivos())
  )
  # La suite NO está activa: es el path legacy.
  expect_false(.cm_criterios_seleccion_activa(frame$config$criterios_seleccion))
  # Universo único total = estudiantes distintos de la base. Nadie cae.
  universo <- length(unique(base$student_id))
  expect_equal(universo, 12L)
  expect_equal(.lpm_population_n(frame), universo)
  # Las listas vacías se conservan vacías (no reviven a un default): "sin filtro".
  expect_length(frame$config$filters$accepted_conditions, 0L)
  expect_length(frame$config$filters$accepted_formation_patterns, 0L)
  expect_length(frame$config$filters$accepted_teacher_type_patterns, 0L)
})

test_that("el path legacy real sigue filtrando: require_undergraduate + accepted_formation_patterns=['pregrado']", {
  base <- .lpm_base()
  filtros <- .lpm_filters_permisivos()
  filtros$require_undergraduate <- TRUE
  filtros$accepted_formation_patterns <- list("pregrado")
  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = list(mapping = .lpm_mapping(), filters = filtros)
  )
  expect_false(.cm_criterios_seleccion_activa(frame$config$criterios_seleccion))
  # Solo PREGRADO sobrevive: 8 de 12 (los 4 MAESTRIA caen por formación).
  pregrado <- length(unique(base$student_id[base$formation == "PREGRADO"]))
  expect_equal(pregrado, 8L)
  expect_equal(.lpm_population_n(frame), pregrado)
})

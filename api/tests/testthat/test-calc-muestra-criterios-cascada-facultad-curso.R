# La cascada debe replicar TODOS los pasos que el constructor ejecuto —
# incluidos los que no tienen gate en la radiografia. `faculty_curso` (las
# facultades declaradas recortan las aulas, ec1d5446) se aplicaba en el
# constructor pero no tenia spec en la cascada: la validacion final
# `current == included` fallaba y la cascada ENTERA se anulaba EN SILENCIO.
# Medido en HSVG2026: 101 CH cortadas por ese paso, cascada NULL, y la UI sin
# barras de «llegan N de M» ni matriz, diciendo «reconstruye el marco» — que
# no arregla nada porque el defecto es del motor.

.cc_fc_frame <- function() {
  # FAC C existe en la base pero el estudio declara solo FAC A y FAC B: el
  # constructor corta sus aulas con el paso `faculty_curso`.
  ch <- rep(paste0("CH", 1:6), each = 2L)
  base <- data.frame(
    estudiante = paste0("E", 1:12),
    curso_horario = ch,
    formacion = "PREGRADO",
    condicion_alumno = "REGULAR",
    edad = rep(c(18, 22), 6L),
    facultad_alumno = rep(c("FAC A", "FAC B", "FAC C"), each = 4L),
    nivel_alumno = "3",
    modalidad = "PRESENCIAL",
    tipo_sesion = "TEORICO",
    matriculados = 20,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  categorias <- as.list(prosecnurapp:::.cm_aulas_text_key(c("FAC A", "FAC B")))
  calc_muestra_aulas_construir(
    base_madre = base,
    config = list(
      mapping = list(
        student_id = "estudiante", classroom_id = "curso_horario",
        formation = "formacion", condition = "condicion_alumno", age = "edad",
        faculty = "facultad_alumno", level = "nivel_alumno",
        modality = "modalidad", session_type = "tipo_sesion",
        enrolled_total = "matriculados"
      ),
      filters = list(
        require_adult = FALSE, require_undergraduate = FALSE,
        require_in_person = FALSE, accepted_conditions = list(),
        exclude_session_patterns = list(), min_eligible_per_class = 1L
      ),
      criterios_seleccion = list(
        minEligible = list(threshold = 1),
        byVariable = list(
          faculty = list(mode = "include", categories = categorias)
        )
      )
    )
  )
}

test_that("la cascada sobrevive al paso faculty_curso y lo declara", {
  frame <- .cc_fc_frame()

  # Sanidad del fixture: el paso tiene que estar CORTANDO algo.
  aulas <- frame$aula_frame
  fac_c <- grepl("FAC C", aulas$faculty, fixed = TRUE)
  expect_true(any(fac_c))
  expect_false(any(aulas$included[fac_c]))

  cascada <- frame$criterios_cascada
  expect_true(is.list(cascada))
  ids <- vapply(cascada$steps, function(s) s$criterion_id, character(1))
  expect_true("faculty_curso" %in% ids)

  paso <- cascada$steps[[match("faculty_curso", ids)]]
  expect_identical(paso$scope, "aula")
  expect_true(isTRUE(paso$applies))
  # gate = FALSE como manual_excluded: el frontend acredita que los gates sean
  # EXACTAMENTE el inventario de la radiografia; un gate extra invalida el
  # bundle i18b entero y la UI esconde cascada y barras.
  expect_false(isTRUE(paso$gate))
  # El paso corta las 2 aulas de FAC C y el embudo termina en las incluidas.
  ultimo <- cascada$steps[[length(cascada$steps)]]
  expect_identical(ultimo$total$after_ch, sum(aulas$included %in% TRUE))
})

test_that("una divergencia real se declara con cifra y sospechoso, no en silencio", {
  frame <- .cc_fc_frame()
  context <- attr(frame, prosecnurapp:::.cm_criterios_contexto_attr, exact = TRUE)
  expect_true(is.list(context))
  # Forzamos la divergencia: un aula del marco cambia de opinion.
  context$aula_frame$included[[1]] <- !isTRUE(context$aula_frame$included[[1]])
  diag <- new.env(parent = emptyenv())
  res <- prosecnurapp:::.cm_criterios_cascada_ejecutada(context, diag)
  expect_null(res)
  div <- diag$divergencia
  expect_true(is.list(div))
  expect_identical(div$filas_divergentes, 1L)
  expect_true(is.numeric(div$marco) || is.integer(div$marco))
})

test_that("el preview reevalua faculty_curso con la seleccion nueva", {
  frame <- .cc_fc_frame()
  context <- attr(frame, prosecnurapp:::.cm_criterios_contexto_attr, exact = TRUE)
  seleccion_nueva <- frame$config$criterios_seleccion
  preview <- calc_muestra_aulas_criterios_preview(
    context = context,
    config = frame$config,
    source_frame_hash = context$source_frame_hash,
    criteria_hash = context$current_criteria_hash
  )
  ids <- vapply(preview$steps, function(s) s$criterion_id, character(1))
  expect_true("faculty_curso" %in% ids)
  paso <- preview$steps[[match("faculty_curso", ids)]]
  expect_true(isTRUE(paso$applies))
})

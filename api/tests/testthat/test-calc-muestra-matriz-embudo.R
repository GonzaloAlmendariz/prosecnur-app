.me_cell <- function(row, criterion_id) {
  hit <- Filter(
    function(cell) identical(cell$criterion_id, criterion_id),
    row$cells
  )
  expect_length(hit, 1L)
  hit[[1]]
}

.me_row <- function(matrix, faculty_key) {
  hit <- Filter(
    function(row) identical(row$faculty_key, faculty_key),
    matrix$rows
  )
  expect_length(hit, 1L)
  hit[[1]]
}

.me_frame <- function() {
  base <- data.frame(
    estudiante = c("IA", "X", "IB", "X"),
    curso_horario = c("A1", "A2", "B1", "B2"),
    facultad = c("FAC A", "FAC A", "FAC B", "FAC B"),
    modalidad = c("PRESENCIAL", "VIRTUAL", "PRESENCIAL", "VIRTUAL"),
    tipo_sesion = "TALLER",
    nivel = "3",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  calc_muestra_aulas_construir(
    base_madre = base,
    config = list(
      mapping = list(
        student_id = "estudiante",
        classroom_id = "curso_horario",
        faculty = "facultad",
        modality = "modalidad",
        session_type = "tipo_sesion",
        level = "nivel"
      ),
      filters = list(
        require_adult = FALSE,
        require_undergraduate = FALSE,
        require_in_person = FALSE,
        accepted_conditions = list(),
        exclude_session_patterns = list(),
        min_eligible_per_class = 1L
      ),
      criterios_seleccion = list(
        byVariable = list(
          modality = list(mode = "include", categories = list("presencial"))
        ),
        minEligible = list(threshold = 1L)
      )
    )
  )
}

test_that("matriz embudo publica shape M1, hash y solo gates de CH/facultad", {
  frame <- .me_frame()
  matrix <- frame$criterios_radiografia$matriz_embudo

  expect_named(matrix, c(
    "schema", "owner", "source_schema", "frame_hash", "momento", "grain",
    "unit", "faculty_dimension", "columns", "rows"
  ))
  expect_identical(
    matrix$schema,
    "calc_muestra_aulas_criterios_matriz_embudo_v1"
  )
  expect_identical(
    matrix$owner,
    "calc_muestra_aulas_frame_v1.criterios_radiografia.matriz_embudo"
  )
  expect_identical(
    matrix$source_schema,
    "calc_muestra_aulas_criterios_radiografia_v2"
  )
  expect_identical(matrix$frame_hash, frame$frame_hash)
  expect_identical(matrix$momento, "marco_ejecutado")
  expect_identical(matrix$grain, "facultad_efectiva_x_criterio")
  expect_identical(matrix$unit, "curso_horario_unico")
  expect_identical(matrix$faculty_dimension, "curso_horario_efectiva")

  expect_true(length(matrix$columns) > 0L)
  expect_true(all(vapply(matrix$columns, function(column) {
    identical(names(column), c(
      "criterion_id", "card_id", "label", "status", "order"
    ))
  }, logical(1))))
  expect_identical(
    vapply(matrix$columns, `[[`, integer(1), "order"),
    seq_along(matrix$columns)
  )
  ids <- vapply(matrix$columns, `[[`, character(1), "criterion_id")
  expect_true(all(c("modality", "session_type", "minEligible", "c7") %in% ids))
  expect_false(any(c("faculty", "formation", "condition", "age", "level") %in% ids))

  for (row in matrix$rows) {
    expect_length(row$cells, length(matrix$columns))
    expect_identical(
      vapply(row$cells, `[[`, character(1), "criterion_id"),
      ids
    )
    expect_true(all(vapply(row$cells, function(cell) {
      identical(names(cell), c(
        "criterion_id", "reference", "action", "reconstruccion_valida",
        "delta_ch", "delta_matriculas", "delta_estudiantes_unicos"
      ))
    }, logical(1))))
  }
})

test_that("cada celda es regla completa y Total se recomputa sin sumar facultades", {
  frame <- .me_frame()
  matrix <- frame$criterios_radiografia$matriz_embudo
  fac_a <- .me_row(matrix, "fac_a")
  fac_b <- .me_row(matrix, "fac_b")
  total <- .me_row(matrix, "__total__")

  expect_identical(fac_a$n_ch_bruto, 2L)
  expect_identical(fac_b$n_ch_bruto, 2L)
  expect_identical(total$n_ch_bruto, nrow(frame$aula_frame))
  expect_identical(
    total$n_ch_elegibles,
    as.integer(sum(frame$aula_frame$included %in% TRUE))
  )
  expect_identical(total$n_ch_elegibles, 2L)

  a <- .me_cell(fac_a, "modality")
  b <- .me_cell(fac_b, "modality")
  direct <- .me_cell(total, "modality")
  expect_identical(a$action, "quitar_restriccion")
  expect_identical(b$action, "quitar_restriccion")
  expect_identical(direct$action, "quitar_restriccion")
  expect_true(all(c(
    a$reconstruccion_valida,
    b$reconstruccion_valida,
    direct$reconstruccion_valida
  )))
  expect_identical(a$delta_ch, 1L)
  expect_identical(b$delta_ch, 1L)
  expect_identical(direct$delta_ch, 2L)
  # X aparece en el CH excluido de ambas facultades: cada marginal facultad
  # lo introduce una vez, pero el contrafactual Total directo lo deduplica.
  expect_identical(a$delta_estudiantes_unicos, 1L)
  expect_identical(b$delta_estudiantes_unicos, 1L)
  expect_identical(direct$delta_estudiantes_unicos, 1L)
  expect_false(identical(
    direct$delta_estudiantes_unicos,
    a$delta_estudiantes_unicos + b$delta_estudiantes_unicos
  ))

  # No se agregan las filas-segmento de M1: la matriz tiene una sola celda de
  # regla completa por facultad y criterio.
  modality <- Filter(
    function(entry) identical(entry$id, "modality"),
    frame$criterios_radiografia$criterios
  )[[1]]
  expect_gt(length(modality$rows), 2L)
  expect_length(Filter(
    function(cell) identical(cell$criterion_id, "modality"),
    fac_a$cells
  ), 1L)
})

test_that("matriz degrada deltas si el final N9 no reconcilia included", {
  frame <- .me_frame()
  broken <- frame$aula_frame
  broken$included[[1]] <- !broken$included[[1]]
  matrix <- calc_muestra_aulas_matriz_embudo(
    aula_frame = broken,
    radiografia = frame$criterios_radiografia,
    criterios = list(
      flags = data.frame(
        classroom_id = frame$aula_frame$classroom_id,
        min_eligible_ok = TRUE,
        teacher_ok = TRUE,
        course_level_ok = TRUE,
        campus_ok = TRUE,
        c7_ok = TRUE,
        c8_facultad_ok = TRUE,
        c8_ok = TRUE,
        stringsAsFactors = FALSE
      ),
      seleccion_aula = list(pasos = list(
        list(id = "modality", flag = c(TRUE, FALSE, TRUE, FALSE)),
        list(id = "minEligible", flag = rep(TRUE, 4L))
      ))
    ),
    particularidades = frame$particularidades
  )
  cell <- .me_cell(.me_row(matrix, "fac_a"), "modality")
  expect_false(cell$reconstruccion_valida)
  expect_true(all(is.na(unlist(cell[c(
    "delta_ch", "delta_matriculas", "delta_estudiantes_unicos"
  )]))))
})

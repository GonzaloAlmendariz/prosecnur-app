.i18b_criterios_fixture <- function() {
  data.frame(
    estudiante = c("IA", "X", "IB", "X", "A3", "B3"),
    curso_horario = c("A1", "A2", "B1", "B2", "A3", "B3"),
    facultad = c("FAC A", "FAC A", "FAC B", "FAC B", "FAC A", "FAC B"),
    formacion = "PREGRADO",
    condicion_alumno = "REGULAR",
    edad = c(18, 19, 20, 21, 22, 23),
    nivel_alumno = c("2", "3", "2", "3", "4", "4"),
    modalidad = c("PRESENCIAL", "PRESENCIAL", "PRESENCIAL", "PRESENCIAL", "VIRTUAL", "VIRTUAL"),
    tipo_sesion = "TALLER",
    tipo_docente = "DOCENTE ORDINARIO - PRINCIPAL",
    nivel_curso = c("2", "3", "2", "3", "4", "4"),
    condicion_curso = "OBLIGATORIO",
    matriculados = c(20, 20, 20, 20, 30, 30),
    sede = "CENTRAL",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.i18b_criterios_config <- function() {
  list(
    mapping = list(
      student_id = "estudiante", classroom_id = "curso_horario",
      faculty = "facultad", formation = "formacion",
      condition = "condicion_alumno", age = "edad", level = "nivel_alumno",
      modality = "modalidad", session_type = "tipo_sesion",
      teacher_type = "tipo_docente", course_level = "nivel_curso",
      condicion_curso = "condicion_curso", enrolled_total = "matriculados",
      campus = "sede"
    ),
    filters = list(
      require_adult = FALSE, require_undergraduate = FALSE,
      require_in_person = FALSE, accepted_conditions = list(),
      exclude_session_patterns = list(), min_eligible_per_class = 1L
    ),
    criterios_seleccion = list(
      byVariable = list(
        modality = list(mode = "include", categories = list("presencial"))
      ),
      minEligible = list(threshold = 1L)
    )
  )
}

.i18b_criterios_frame <- function() {
  calc_muestra_aulas_construir(
    base_madre = .i18b_criterios_fixture(),
    config = .i18b_criterios_config()
  )
}

.i18b_total_row <- function(frame, criterion_id, segment_key) {
  rows <- frame$criterios_totales$rows
  hit <- Filter(function(row) {
    identical(row$criterion_id, criterion_id) &&
      identical(row$segment_key, segment_key)
  }, rows)
  expect_length(hit, 1L)
  hit[[1L]]
}

test_that("totales R-owned recomputan uniones atomicas y cuantiles", {
  frame <- .i18b_criterios_frame()
  totals <- frame$criterios_totales

  expect_named(totals, c(
    "schema", "owner", "source_schema", "source_frame_hash", "momento",
    "grain", "unit", "rows"
  ))
  expect_identical(totals$schema, "calc_muestra_aulas_criterios_totales_v1")
  expect_identical(totals$owner, "calc_muestra_aulas_frame_v1.criterios_totales")
  expect_identical(totals$source_frame_hash, frame$frame_hash)
  expect_identical(totals$momento, "marco_ejecutado")
  expect_identical(totals$grain, "criterio_x_segmento")
  expect_identical(totals$unit, "curso_horario_unico")

  expected <- sum(vapply(frame$criterios_radiografia$criterios, function(entry) {
    length(unique(vapply(entry$rows, `[[`, character(1), "segment_key")))
  }, integer(1)))
  expect_length(totals$rows, expected)

  taller <- .i18b_total_row(frame, "session_type", "taller")
  expect_named(taller, c(
    "criterion_id", "card_id", "label", "segment_key", "segment_label",
    "segment_kind", "actual", "contraste_total"
  ))
  expect_identical(taller$actual$n_ch, 4L)
  expect_identical(taller$actual$n_matriculas, 4L)
  # X pertenece a dos CH de facultades distintas: Total deduplica sobre la
  # union atomica en R; sumar los unicos por facultad daria 4, no 3.
  expect_identical(taller$actual$n_estudiantes_unicos, 3L)
  expect_identical(taller$contraste_total$n_ch, 6L)
  expect_identical(taller$contraste_total$n_estudiantes_unicos, 5L)
  expect_identical(taller$actual$distribution, list(
    media = 1, p10 = 1, p25 = 1, p50 = 1, p75 = 1, p90 = 1
  ))

  entry <- Filter(
    function(x) identical(x$id, "session_type"),
    frame$criterios_radiografia$criterios
  )[[1L]]
  por_facultad <- Filter(
    function(row) identical(row$segment_key, "taller"),
    entry$rows
  )
  expect_identical(
    sum(vapply(por_facultad, function(row) row$actual$n_estudiantes_unicos, integer(1))),
    4L
  )
  expect_false(identical(
    taller$actual$n_estudiantes_unicos,
    sum(vapply(por_facultad, function(row) row$actual$n_estudiantes_unicos, integer(1)))
  ))
})

test_that("cascada ejecutada usa inventario dinamico y reconcilia el ultimo paso", {
  frame <- .i18b_criterios_frame()
  cascade <- frame$criterios_cascada

  expect_named(cascade, c(
    "schema", "owner", "source_frame_hash", "criteria_hash", "momento",
    "grain", "unit", "order_source", "steps"
  ))
  expect_identical(cascade$schema, "calc_muestra_aulas_criterios_cascada_v1")
  expect_identical(cascade$owner, "calc_muestra_aulas_frame_v1.criterios_cascada")
  expect_identical(cascade$source_frame_hash, frame$frame_hash)
  expect_identical(cascade$momento, "marco_ejecutado")
  expect_identical(cascade$grain, "paso_x_facultad_efectiva")
  expect_identical(cascade$unit, "curso_horario_unico")
  expect_identical(cascade$order_source, "motor_r")
  expect_true(is.character(cascade$criteria_hash) && nzchar(cascade$criteria_hash))

  gate_steps <- Filter(function(step) isTRUE(step$gate), cascade$steps)
  inventory_ids <- vapply(
    frame$criterios_radiografia$criterios, `[[`, character(1), "id"
  )
  expect_setequal(
    vapply(gate_steps, `[[`, character(1), "criterion_id"),
    inventory_ids
  )
  expect_identical(length(gate_steps), length(inventory_ids))
  expect_identical(
    vapply(cascade$steps, `[[`, integer(1), "order"),
    seq_along(cascade$steps)
  )
  expect_true(all(vapply(cascade$steps, function(step) {
    identical(names(step), c(
      "order", "criterion_id", "card_id", "label", "scope", "gate",
      "applies", "status", "faculties", "total"
    ))
  }, logical(1))))

  manual <- tail(cascade$steps, 1L)[[1L]]
  expect_identical(manual$criterion_id, "manual_excluded")
  expect_false(manual$gate)
  expect_identical(
    manual$total$after_ch,
    as.integer(sum(frame$aula_frame$included %in% TRUE))
  )
  expect_identical(manual$total$excluded_ch, manual$total$before_ch - manual$total$after_ch)

  payload <- jsonlite::toJSON(
    list(totals = frame$criterios_totales, cascade = cascade),
    auto_unbox = TRUE, null = "null", na = "null"
  )
  expect_false(grepl("\"IA\"|\"IB\"|student_id|classroom_id", payload))
})

test_that("preview usa cache atomico, no reconstruye ni persiste el borrador", {
  frame <- .i18b_criterios_frame()
  context <- attr(frame, "calc_muestra_aulas_criterios_contexto", exact = TRUE)
  expect_true(is.list(context))
  expect_identical(context$source_frame_hash, frame$frame_hash)

  draft <- frame$config
  draft$criterios_seleccion$byVariable$modality$categories <- list()
  trace(
    "calc_muestra_aulas_construir",
    tracer = quote(stop("preview_reconstruyo_el_frame", call. = FALSE)),
    print = FALSE
  )
  on.exit(untrace("calc_muestra_aulas_construir"), add = TRUE)
  timing <- system.time({
    preview <- calc_muestra_aulas_criterios_preview(
      context = context,
      config = draft,
      source_frame_hash = frame$frame_hash,
      criteria_hash = frame$criterios_cascada$criteria_hash
    )
  })

  expect_identical(preview$momento, "borrador_no_persistido")
  expect_identical(preview$source_frame_hash, frame$frame_hash)
  expect_false(identical(preview$criteria_hash, frame$criterios_cascada$criteria_hash))
  expect_gt(tail(preview$steps, 1L)[[1L]]$total$after_ch, 4L)
  expect_lt(unname(timing[["elapsed"]]), 1)
  expect_identical(frame$config$criterios_seleccion$byVariable$modality$categories, "presencial")

  serialized <- jsonlite::toJSON(preview, auto_unbox = TRUE, null = "null", na = "null")
  expect_false(grepl("IA|IB|student_id|classroom_id|unique_student", serialized))
})

test_that("criteria_hash firma el minimo elegible efectivo que cambia la cascada", {
  frame <- .i18b_criterios_frame()
  context <- attr(frame, "calc_muestra_aulas_criterios_contexto", exact = TRUE)
  draft_one <- frame$config
  draft_one$criterios_seleccion$minEligible <- NULL
  draft_one$filters$min_eligible_per_class <- 1L
  draft_two <- draft_one
  draft_two$filters$min_eligible_per_class <- 2L

  preview_one <- calc_muestra_aulas_criterios_preview(
    context, draft_one, frame$frame_hash, frame$criterios_cascada$criteria_hash
  )
  preview_two <- calc_muestra_aulas_criterios_preview(
    context, draft_two, frame$frame_hash, frame$criterios_cascada$criteria_hash
  )

  expect_false(identical(preview_one$criteria_hash, preview_two$criteria_hash))
  expect_false(identical(
    tail(preview_one$steps, 1L)[[1L]]$total$after_ch,
    tail(preview_two$steps, 1L)[[1L]]$total$after_ch
  ))
})

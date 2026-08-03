.i18b_asistencia_fixture <- function() {
  grid <- expand.grid(
    facultad = c("FAC A", "FAC B"),
    tipo_sesion = c("TALLER", "TEORICA"),
    replica = seq_len(12L),
    stringsAsFactors = FALSE
  )
  taller <- grid$tipo_sesion == "TALLER"
  matriculados <- ifelse(taller, 20L, 50L)
  asistentes <- ifelse(taller, 16L, 35L)
  data.frame(
    curso_horario = sprintf("HIST-%03d", seq_len(nrow(grid))),
    estado_aplicacion = "APLICADA",
    matriculados = matriculados,
    asistieron = asistentes,
    enviadas = asistentes - 2L,
    validas = asistentes - 3L,
    no_respondieron = 2L,
    rango_horario = ifelse(taller, "MANANA", "TARDE"),
    facultad = grid$facultad,
    tipo_sesion = grid$tipo_sesion,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.i18b_asistencia_referencia <- function(datos = .i18b_asistencia_fixture()) {
  calc_muestra_asistencia_referencia(
    datos,
    estudio = list(
      id = "hist-i18b", label = "Historico I18b",
      periodo = "2025-II", fuente = "fixture_sintetico"
    ),
    bootstrap_n = 50L
  )
}

.i18b_anclas_frame <- function(tipo_sesion = "TALLER") {
  base <- data.frame(
    estudiante = paste0("CURRENT-SECRET-", 1:4),
    curso_horario = paste0("CUR-SECRET-", 1:4),
    facultad = rep(c("FAC A", "FAC B"), each = 2L),
    modalidad = "PRESENCIAL",
    tipo_sesion = tipo_sesion,
    matriculados = 30L,
    nivel = "3",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  calc_muestra_aulas_construir(
    base_madre = base,
    config = list(
      mapping = list(
        student_id = "estudiante", classroom_id = "curso_horario",
        faculty = "facultad", modality = "modalidad",
        session_type = "tipo_sesion", enrolled_total = "matriculados",
        level = "nivel"
      ),
      filters = list(
        require_adult = FALSE, require_undergraduate = FALSE,
        require_in_person = FALSE, accepted_conditions = list(),
        exclude_session_patterns = list(), min_eligible_per_class = 1L
      ),
      criterios_seleccion = list(minEligible = list(threshold = 1L))
    )
  )
}

.i18b_anchor <- function(anchors, criterion_id, faculty_key) {
  hit <- Filter(function(row) {
    identical(row$criterion_id, criterion_id) &&
      identical(row$faculty_key, faculty_key)
  }, anchors$rows)
  expect_length(hit, 1L)
  hit[[1L]]
}

test_that("referencia agrega celdas directas facultad por caracteristica", {
  reference <- .i18b_asistencia_referencia()
  cells <- reference$celdas_criterios

  expect_named(cells, c(
    "schema", "owner", "momento", "combinable", "unit", "denominator",
    "faculty_dimension", "reference_hash", "estudio", "rows"
  ))
  expect_identical(cells$schema, "calc_muestra_referencia_asistencia_celdas_v1")
  expect_identical(cells$owner, "estudio_historico_externo.celdas_criterios")
  expect_identical(cells$momento, "post_hoc_estudio_previo")
  expect_false(cells$combinable)
  expect_identical(cells$unit, "curso_horario_aplicado")
  expect_identical(cells$denominator, "matriculados_totales")
  expect_identical(cells$faculty_dimension, "facultad_historica")
  expect_true(is.character(cells$reference_hash) && nzchar(cells$reference_hash))
  expect_true(length(cells$rows) > 0L)

  exact <- Filter(function(row) {
    identical(row$faculty_key, "fac_a") &&
      identical(row$dimension_key, "tipo_sesion") &&
      identical(row$cell_key, "taller")
  }, cells$rows)
  expect_length(exact, 1L)
  exact <- exact[[1L]]
  expect_named(exact, c(
    "faculty_key", "faculty_label", "dimension_key", "dimension_label",
    "cell_key", "cell_label", "order", "k", "matriculados", "asistentes",
    "tasa", "media_ch", "sd_ch", "ic_low", "ic_high", "metodo_ic",
    "suficiencia", "tasa_publicada", "k_publicada", "fuente_publicada"
  ))
  expect_identical(exact$k, 12L)
  expect_identical(exact$matriculados, 240)
  expect_identical(exact$asistentes, 192)
  expect_equal(exact$tasa, 0.8)
  expect_identical(exact$suficiencia, "delgada")
  expect_identical(exact$fuente_publicada, "celda")

  shuffled <- .i18b_asistencia_fixture()[48:1, , drop = FALSE]
  expect_identical(
    .i18b_asistencia_referencia(shuffled)$celdas_criterios$reference_hash,
    cells$reference_hash
  )
  serialized <- jsonlite::toJSON(cells, auto_unbox = TRUE, null = "null", na = "null")
  expect_false(grepl("HIST-", serialized))
  expect_false(grepl("HIST-[0-9]", serialized))
})

test_that("anclas hacen matching exacto, cercano solo en tamano y degradan rotulado", {
  frame <- .i18b_anclas_frame()
  reference <- .i18b_asistencia_referencia()
  anchors <- calc_muestra_criterios_anclas_historicas(frame, reference)

  expect_named(anchors, c(
    "schema", "owner", "source_frame_hash", "reference_hash",
    "reference_schema", "periodo", "grain", "faculty_dimensions",
    "reference_faculty_dimension", "rows"
  ))
  expect_identical(anchors$schema, "calc_muestra_criterios_anclas_historicas_v1")
  expect_identical(anchors$owner, "calc_muestra_aulas_frame_v1.criterios_anclas_historicas")
  expect_identical(anchors$source_frame_hash, frame$frame_hash)
  expect_identical(anchors$reference_hash, reference$celdas_criterios$reference_hash)
  expect_identical(anchors$reference_schema, "calc_muestra_referencia_asistencia_celdas_v1")
  expect_identical(anchors$periodo, "2025-II")
  expect_identical(anchors$grain, "criterio_x_facultad_efectiva")
  expect_setequal(
    unlist(anchors$faculty_dimensions, use.names = FALSE),
    c("alumno", "curso_horario_efectiva")
  )
  expect_identical(anchors$reference_faculty_dimension, "facultad_historica")

  exact <- .i18b_anchor(anchors, "session_type", "fac_a")
  expect_named(exact, c(
    "criterion_id", "card_id", "faculty_key", "faculty_label",
    "faculty_dimension", "reference_faculty_dimension",
    "requested_dimension", "requested_key",
    "requested_label", "matched_dimension", "matched_key", "matched_label",
    "match_level", "k", "tasa", "ic_low", "ic_high", "metodo_ic",
    "suficiencia", "periodo", "warning"
  ))
  expect_identical(exact$requested_dimension, "tipo_sesion")
  expect_identical(exact$faculty_dimension, "curso_horario_efectiva")
  expect_identical(exact$reference_faculty_dimension, "facultad_historica")
  expect_identical(exact$requested_key, "taller")
  expect_identical(exact$matched_dimension, "tipo_sesion")
  expect_identical(exact$matched_key, "taller")
  expect_identical(exact$match_level, "exacta")
  expect_identical(exact$k, 12L)
  expect_equal(exact$tasa, 0.8)

  nearest <- .i18b_anchor(anchors, "enrolled_total", "fac_a")
  expect_identical(nearest$requested_dimension, "tamano")
  expect_identical(nearest$requested_key, "T3")
  expect_identical(nearest$matched_dimension, "tamano")
  expect_identical(nearest$matched_key, "T2")
  expect_identical(nearest$match_level, "tamano_cercano")
  expect_match(nearest$warning, "tamano", ignore.case = TRUE)

  incompatible <- .i18b_anchor(anchors, "modality", "fac_a")
  expect_identical(incompatible$match_level, "incompatible")
  expect_true(is.na(incompatible$tasa))
  expect_match(incompatible$warning, "compatible", ignore.case = TRUE)

  for (id in c("minEligible", "c7", "c8_facultad", "c8")) {
    proxy <- .i18b_anchor(anchors, id, "fac_a")
    expect_identical(proxy$match_level, "incompatible", info = id)
    expect_true(is.na(proxy$requested_dimension), info = id)
    expect_true(is.na(proxy$tasa), info = id)
  }

  serialized <- jsonlite::toJSON(anchors, auto_unbox = TRUE, null = "null", na = "null")
  expect_false(grepl("CURRENT-SECRET|CUR-SECRET|classroom_id|student_id", serialized))
})

test_that("sin referencia publica degradacion por gate sin fabricar estimaciones", {
  anchors <- calc_muestra_criterios_anclas_historicas(
    .i18b_anclas_frame(),
    NULL
  )

  expect_identical(anchors$reference_schema, "sin_referencia")
  expect_identical(anchors$reference_hash, "sin_referencia")
  expect_identical(anchors$reference_faculty_dimension, "no_disponible")
  expect_true(length(anchors$rows) > 0L)
  expect_true(all(vapply(anchors$rows, function(row) {
    identical(row$match_level, "sin_publicacion") &&
      is.na(row$k) && is.na(row$tasa) && is.na(row$ic_low) &&
      is.na(row$ic_high) && identical(row$metodo_ic, "no_aplica") &&
      identical(row$reference_faculty_dimension, "no_disponible")
  }, logical(1))))
})

test_that("anclas cubren las facultades declaradas en ambas dimensiones", {
  frame <- .i18b_anclas_frame()
  entries <- frame$criterios_radiografia$criterios
  session_idx <- which(vapply(
    entries, function(entry) identical(entry$id, "session_type"), logical(1)
  ))[[1L]]
  extra <- entries[[session_idx]]$rows[[1L]]
  extra$faculty_key <- "solo_alumnos"
  extra$faculty_label <- "Solo alumnos"
  entries[[session_idx]]$rows[[length(entries[[session_idx]]$rows) + 1L]] <- extra
  frame$criterios_radiografia$criterios <- entries

  anchors <- calc_muestra_criterios_anclas_historicas(frame, NULL)
  expected <- unique(vapply(entries[[session_idx]]$rows, function(row) {
    paste("session_type", row$faculty_key, sep = "::")
  }, character(1)))
  actual <- unique(vapply(Filter(
    function(row) identical(row$criterion_id, "session_type"), anchors$rows
  ), function(row) paste(row$criterion_id, row$faculty_key, sep = "::"), character(1)))

  expect_setequal(actual, expected)
  extra_anchor <- .i18b_anchor(anchors, "session_type", "solo_alumnos")
  expect_identical(extra_anchor$faculty_dimension, "curso_horario_efectiva")
  expect_identical(extra_anchor$match_level, "sin_publicacion")

  student_idx <- which(vapply(entries, function(entry) {
    identical(entry$faculty_dimension, "alumno") && length(entry$rows) > 0L
  }, logical(1)))[[1L]]
  student_id <- entries[[student_idx]]$id
  student_extra <- entries[[student_idx]]$rows[[1L]]
  student_extra$faculty_key <- "facultad_solo_alumno"
  student_extra$faculty_label <- "Facultad solo alumno"
  entries[[student_idx]]$rows[[length(entries[[student_idx]]$rows) + 1L]] <- student_extra
  frame$criterios_radiografia$criterios <- entries

  student_anchors <- calc_muestra_criterios_anclas_historicas(frame, NULL)
  student_anchor <- .i18b_anchor(
    student_anchors, student_id, "facultad_solo_alumno"
  )
  expect_identical(student_anchor$faculty_dimension, "alumno")
  expect_identical(student_anchor$match_level, "sin_publicacion")
})

test_that("categorias nominales ausentes degradan a facultad, nunca a vecino", {
  frame <- .i18b_anclas_frame(tipo_sesion = "SEMINARIO")
  anchors <- calc_muestra_criterios_anclas_historicas(
    frame,
    .i18b_asistencia_referencia()
  )
  anchor <- .i18b_anchor(anchors, "session_type", "fac_a")

  expect_identical(anchor$requested_dimension, "tipo_sesion")
  expect_identical(anchor$requested_key, "seminario")
  expect_identical(anchor$match_level, "facultad")
  expect_identical(anchor$matched_dimension, "facultad")
  expect_false(anchor$match_level %in% c("tamano_cercano", "exacta"))
  expect_match(anchor$warning, "facultad", ignore.case = TRUE)
})

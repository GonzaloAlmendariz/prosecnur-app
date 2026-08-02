.i18b_http_rows <- function() {
  frame <- data.frame(
    estudiante = c("HTTP-SECRET-A", "HTTP-SECRET-X", "HTTP-SECRET-B", "HTTP-SECRET-X", "HTTP-SECRET-A3", "HTTP-SECRET-B3"),
    curso_horario = c("HTTP-CH-A1", "HTTP-CH-A2", "HTTP-CH-B1", "HTTP-CH-B2", "HTTP-CH-A3", "HTTP-CH-B3"),
    facultad = c("FAC A", "FAC A", "FAC B", "FAC B", "FAC A", "FAC B"),
    modalidad = c("PRESENCIAL", "PRESENCIAL", "PRESENCIAL", "PRESENCIAL", "VIRTUAL", "VIRTUAL"),
    tipo_sesion = "TALLER",
    nivel = "3",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  lapply(seq_len(nrow(frame)), function(i) as.list(frame[i, , drop = FALSE]))
}

.i18b_http_config <- function() {
  list(
    mapping = list(
      student_id = "estudiante", classroom_id = "curso_horario",
      faculty = "facultad", modality = "modalidad",
      session_type = "tipo_sesion", level = "nivel"
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

.i18b_http_reference_rows <- function() {
  lapply(seq_len(24L), function(i) {
    list(
      curso_horario = sprintf("HIST-I18B-%02d", i),
      estado_aplicacion = "APLICADA",
      matriculados = 20L,
      asistieron = 16L,
      enviadas = 14L,
      validas = 13L,
      no_respondieron = 2L,
      rango_horario = "MANANA",
      facultad = if (i <= 12L) "FAC A" else "FAC B",
      tipo_sesion = "TALLER"
    )
  })
}

test_that("POST preview es stale-safe, agregado y no persistente por el wire", {
  srv <- http_contract_server()
  creada <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))
  expect_identical(creada$status, 200L)
  sid <- creada$json$session_id

  built <- http_post_json(
    srv,
    "/api/calc-muestra/marco/construir",
    body = list(
      base_madre = .i18b_http_rows(),
      config = .i18b_http_config()
    ),
    sid = sid,
    timeout = 60
  )
  expect_identical(built$status, 200L)
  frame <- built$json$frame
  expect_identical(frame$criterios_cascada$schema, "calc_muestra_aulas_criterios_cascada_v1")
  before <- http_get(srv, "/api/calc-muestra/state", sid = sid)
  expect_identical(before$status, 200L)

  draft <- .i18b_http_config()
  draft$criterios_seleccion$byVariable$modality$categories <- list()
  response <- http_post_json(
    srv,
    "/api/calc-muestra/marco/criterios/preview",
    body = list(
      source_frame_hash = frame$frame_hash,
      criteria_hash = frame$criterios_cascada$criteria_hash,
      config = draft
    ),
    sid = sid,
    timeout = 30
  )

  expect_identical(response$status, 200L)
  expect_true(isTRUE(response$json$ok))
  preview <- response$json$preview
  expect_identical(preview$schema, "calc_muestra_aulas_criterios_cascada_v1")
  expect_identical(preview$momento, "borrador_no_persistido")
  expect_identical(preview$source_frame_hash, frame$frame_hash)
  expect_false(identical(preview$criteria_hash, frame$criterios_cascada$criteria_hash))
  expect_gt(
    as.numeric(tail(preview$steps, 1L)[[1L]]$total$after_ch),
    as.numeric(tail(frame$criterios_cascada$steps, 1L)[[1L]]$total$after_ch)
  )

  serialized <- jsonlite::toJSON(response$json, auto_unbox = TRUE, null = "null", na = "null")
  expect_false(grepl("HTTP-SECRET|HTTP-CH", serialized))
  expect_false(grepl("student_id|classroom_id|unique_student", serialized))

  after <- http_get(srv, "/api/calc-muestra/state", sid = sid)
  expect_identical(after$status, 200L)
  expect_identical(after$json$aulas$config, before$json$aulas$config)
  expect_identical(after$json$aulas$frame, before$json$aulas$frame)

  stale_frame <- http_post_json(
    srv,
    "/api/calc-muestra/marco/criterios/preview",
    body = list(
      source_frame_hash = "frame-viejo",
      criteria_hash = frame$criterios_cascada$criteria_hash,
      config = draft
    ),
    sid = sid
  )
  expect_identical(stale_frame$status, 409L)
  expect_identical(
    stale_frame$json$error$code,
    "E_CALC_MUESTRA_CRITERIOS_PREVIEW_STALE"
  )

  stale_criteria <- http_post_json(
    srv,
    "/api/calc-muestra/marco/criterios/preview",
    body = list(
      source_frame_hash = frame$frame_hash,
      criteria_hash = "criterios-viejos",
      config = draft
    ),
    sid = sid
  )
  expect_identical(stale_criteria$status, 409L)
  expect_identical(
    stale_criteria$json$error$code,
    "E_CALC_MUESTRA_CRITERIOS_PREVIEW_STALE"
  )
})

test_that("preview sin contexto transitorio falla 409", {
  srv <- http_contract_server()
  creada <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))
  sid <- creada$json$session_id

  response <- http_post_json(
    srv,
    "/api/calc-muestra/marco/criterios/preview",
    body = list(
      source_frame_hash = "sin-frame",
      criteria_hash = "sin-criterios",
      config = .i18b_http_config()
    ),
    sid = sid
  )
  expect_identical(response$status, 409L)
  expect_identical(
    response$json$error$code,
    "E_CALC_MUESTRA_CRITERIOS_PREVIEW_STALE"
  )
})

test_that("referencia y marco adjuntan anclas sin importar el orden HTTP", {
  srv <- http_contract_server()
  reference_body <- list(
    referencia_asistencia = .i18b_http_reference_rows(),
    estudio = list(
      id = "hist-i18b", label = "Historico I18b",
      periodo = "2025-II", fuente = "fixture_sintetico"
    )
  )

  assert_anchors <- function(frame) {
    anchors <- frame$criterios_anclas_historicas
    expect_identical(anchors$schema, "calc_muestra_criterios_anclas_historicas_v1")
    exact <- Filter(function(row) {
      identical(row$criterion_id, "session_type") &&
        identical(row$faculty_key, "fac_a")
    }, anchors$rows)
    expect_length(exact, 1L)
    expect_identical(exact[[1L]]$match_level, "exacta")
    expect_equal(as.numeric(exact[[1L]]$tasa), 0.8)
  }

  sid_after <- http_post_json(
    srv, "/api/session", body = list(fresh = TRUE)
  )$json$session_id
  built_after <- http_post_json(
    srv, "/api/calc-muestra/marco/construir",
    body = list(base_madre = .i18b_http_rows(), config = .i18b_http_config()),
    sid = sid_after, timeout = 60
  )
  expect_identical(built_after$status, 200L)
  posted_after <- http_post_json(
    srv, "/api/calc-muestra/asistencia/referencia",
    body = reference_body, sid = sid_after, timeout = 180
  )
  expect_identical(posted_after$status, 200L)
  assert_anchors(posted_after$json$state$aulas$frame)

  sid_before <- http_post_json(
    srv, "/api/session", body = list(fresh = TRUE)
  )$json$session_id
  posted_before <- http_post_json(
    srv, "/api/calc-muestra/asistencia/referencia",
    body = reference_body, sid = sid_before, timeout = 180
  )
  expect_identical(posted_before$status, 200L)
  built_before <- http_post_json(
    srv, "/api/calc-muestra/marco/construir",
    body = list(base_madre = .i18b_http_rows(), config = .i18b_http_config()),
    sid = sid_before, timeout = 60
  )
  expect_identical(built_before$status, 200L)
  assert_anchors(built_before$json$frame)
})

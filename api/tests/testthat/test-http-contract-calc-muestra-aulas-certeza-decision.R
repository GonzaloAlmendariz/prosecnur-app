# AD2 (checklist calc-muestra patrón aulas 2026-09-24): «¿Alcanza?» devolvía
# 409 E_CALC_MUESTRA_ALUMNOS_CH_DECISION después de confirmar Alumnos por CH.
# `POST /estudio` invalidaba los derivados de Aulas pero dejaba la config de
# sesión firmada con la decisión anterior, y la certeza valida contra ella.
# Sólo comparar/seleccionar la reescribían, así que el 409 no tenía salida
# desde la sección Cálculo.

.http_cad_base <- function() {
  specs <- list(
    c("FAC A", "A1", 2L), c("FAC A", "A2", 4L), c("FAC A", "A3", 3L),
    c("FAC B", "B1", 3L), c("FAC B", "B2", 5L), c("FAC B", "B3", 4L)
  )
  rows <- list()
  for (spec in specs) {
    for (i in seq_len(as.integer(spec[[3]]))) {
      rows[[length(rows) + 1L]] <- list(
        estudiante = paste(spec[[1]], spec[[2]], i, sep = "-"),
        curso_horario = spec[[2]],
        facultad = spec[[1]],
        sexo = if (i %% 2L) "F" else "M",
        nivel = "3"
      )
    }
  }
  rows
}

.http_cad_config <- list(
  mapping = list(
    student_id = "estudiante", classroom_id = "curso_horario",
    faculty = "facultad", sex = "sexo", level = "nivel"
  ),
  filters = list(
    require_adult = FALSE, require_undergraduate = FALSE,
    require_in_person = FALSE, accepted_conditions = list(),
    exclude_session_patterns = list(), min_eligible_per_class = 1L
  )
)

.http_cad_study <- function(frame_hash, estadistico) {
  list(
    titulo = "HTTP certeza decision",
    macro_familia = "encuesta_estudiantes",
    workspace = list(
      frame_mode = "opinion_universitaria",
      aulas_config = list(alumnos_por_ch_decision = list(
        schema = "calc_muestra_alumnos_por_ch_decision_v1",
        frame_hash = frame_hash,
        denominador = "elegible",
        estadistico_default = estadistico,
        por_facultad = list(),
        confirmado_at = "2026-09-24T12:00:00Z"
      ))
    ),
    componentes = list()
  )
}

.http_cad_estratos <- list(
  list(label = "FAC A", cuota = 4, tau = 1, aulas_formula = 1L),
  list(label = "FAC B", cuota = 5, tau = 1, aulas_formula = 1L)
)

test_that("¿Alcanza? mide tras confirmar y tras cambiar la decisión de alumnos por CH", {
  srv <- http_contract_server()
  creada <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))
  expect_identical(creada$status, 200L)
  sid <- creada$json$session_id

  build <- http_post_json(
    srv, "/api/calc-muestra/marco/construir",
    body = list(base_madre = .http_cad_base(), config = .http_cad_config),
    sid = sid, timeout = 180
  )
  expect_identical(build$status, 200L)
  frame_hash <- build$json$frame$frame_hash

  medir <- function() {
    http_post_json(
      srv, "/api/calc-muestra/aulas/certeza",
      body = list(estratos = .http_cad_estratos, corridas = 20L),
      sid = sid, timeout = 180
    )
  }

  # Decisión A: la primera confirmación.
  saved_a <- http_post_json(
    srv, "/api/calc-muestra/estudio",
    body = list(estudio = .http_cad_study(frame_hash, "media")), sid = sid
  )
  expect_identical(saved_a$status, 200L)
  certeza_a <- medir()
  expect_identical(
    certeza_a$status, 200L,
    info = paste(certeza_a$json$error$code, certeza_a$json$error$message)
  )

  # Decisión B: cambia el estadístico.
  saved_b <- http_post_json(
    srv, "/api/calc-muestra/estudio",
    body = list(estudio = .http_cad_study(frame_hash, "p25")), sid = sid
  )
  expect_identical(saved_b$status, 200L)
  certeza_b <- medir()
  expect_identical(
    certeza_b$status, 200L,
    info = paste(certeza_b$json$error$code, certeza_b$json$error$message)
  )
  expect_identical(certeza_b$json$mode, "sync")

  # Un cliente que manda una config con la decisión A sigue rebotando —ésa
  # sí es una corrida vieja— y el mensaje dice qué hacer, no «Recalcula».
  config_vieja <- list(alumnos_por_ch_decision = .http_cad_study(frame_hash, "media")$workspace$aulas_config$alumnos_por_ch_decision)
  stale <- http_post_json(
    srv, "/api/calc-muestra/aulas/certeza",
    body = list(estratos = .http_cad_estratos, corridas = 20L, config = config_vieja),
    sid = sid
  )
  expect_identical(stale$status, 409L)
  expect_identical(stale$json$error$code, "E_CALC_MUESTRA_ALUMNOS_CH_DECISION")
  expect_identical(stale$json$error$details$reason, "decision_stale")
  expect_false(grepl("Recalcula", stale$json$error$message, fixed = TRUE))
  # El frontend reconoce el caso por texto cuando pierde el código.
  expect_match(stale$json$error$message, "alumnos por CH", fixed = TRUE)
  expect_match(stale$json$error$message, "cambi|caduc|stale", ignore.case = TRUE)
})

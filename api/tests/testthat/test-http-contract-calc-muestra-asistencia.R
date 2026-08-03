# Contrato HTTP real de la referencia historica de asistencia.
# El fixture es sintetico y viaja como tabla directa por JSON.

.http_asistencia_fixture <- function() {
  lapply(seq_len(12L), function(i) {
    asistentes <- 24L + (i %% 2L)
    enviadas <- asistentes - 2L
    list(
      curso_horario = sprintf("CH-%03d", i),
      estado_aplicacion = "APLICADA",
      matriculados = 30L + (i %% 3L),
      asistieron = asistentes,
      enviadas = enviadas,
      validas = enviadas - 1L,
      no_respondieron = 2L,
      rango_horario = "Manana",
      facultad = "Facultad sintetica",
      tipo_sesion = "Teorica"
    )
  })
}

.http_asistencia_estudio <- list(
  id = "estudio-http-sintetico",
  label = "Estudio HTTP sintetico",
  periodo = "2026-I",
  fuente = "fixture_inline_sintetico"
)

.http_asistencia_workspace_anterior <- list(
  frame_mode = "marco_disponible",
  notas_diseno = "workspace sintetico anterior",
  etapa = "propuesta"
)

.http_asistencia_workspace_propuesto <- list(
  frame_mode = "opinion_universitaria",
  notas_diseno = "workspace sintetico atomico",
  etapa = "campo"
)

.http_asistencia_workspace_claves <- function(state) {
  workspace <- state$estudio$workspace
  list(
    frame_mode = workspace$frame_mode,
    notas_diseno = workspace$notas_diseno,
    etapa = workspace$etapa
  )
}

test_that("POST asistencia/referencia conserva el contrato y los api_error por el wire", {
  srv <- http_contract_server()

  creada <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))
  expect_identical(creada$status, 200L)
  sid <- creada$json$session_id
  expect_true(is.character(sid) && nzchar(sid))

  before <- http_get(srv, "/api/calc-muestra/state", sid = sid)
  expect_identical(before$status, 200L)

  respuesta <- http_post_json(
    srv,
    "/api/calc-muestra/asistencia/referencia",
    body = list(
      referencia_asistencia = .http_asistencia_fixture(),
      estudio = .http_asistencia_estudio
    ),
    sid = sid,
    timeout = 180
  )

  expect_identical(respuesta$status, 200L)
  expect_true(isTRUE(respuesta$json$ok))
  referencia <- respuesta$json$referencia_asistencia
  expect_true(is.list(referencia))
  expect_identical(referencia$schema, "calc_muestra_referencia_asistencia_v1")
  expect_identical(referencia$owner, "estudio_historico_externo")
  expect_equal(as.numeric(referencia$cobertura$agendados), 12)
  expect_equal(as.numeric(referencia$cobertura$aplicados), 12)
  expect_equal(as.numeric(referencia$cobertura$observados), 12)
  expect_identical(referencia, respuesta$json$state$referencia_asistencia)
  expect_identical(respuesta$json$state$aulas$config, before$json$aulas$config)
  expect_identical(respuesta$json$state$aulas$frame, before$json$aulas$frame)

  after <- http_get(srv, "/api/calc-muestra/state", sid = sid)
  expect_identical(after$status, 200L)
  expect_identical(after$json$referencia_asistencia, referencia)
  expect_identical(after$json$aulas$config, before$json$aulas$config)
  expect_identical(after$json$aulas$frame, before$json$aulas$frame)

  incompleta <- http_post_json(
    srv,
    "/api/calc-muestra/asistencia/referencia",
    body = list(
      referencia_asistencia = list(list(curso_horario = "CH-incompleto")),
      estudio = .http_asistencia_estudio
    ),
    sid = sid
  )
  expect_identical(incompleta$status, 400L)
  expect_true(is.list(incompleta$json$error))
  expect_identical(
    incompleta$json$error$code,
    "E_CALC_MUESTRA_ASISTENCIA_COLUMNS"
  )
})

test_that("workspace y referencia se escriben juntos o no se escriben por el wire", {
  srv <- http_contract_server()

  creada <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))
  expect_identical(creada$status, 200L)
  sid <- creada$json$session_id

  estudio_inicial <- http_post_json(
    srv,
    "/api/calc-muestra/estudio",
    body = list(estudio = list(
      titulo = "Estudio atomico sintetico",
      workspace = .http_asistencia_workspace_anterior
    )),
    sid = sid
  )
  expect_identical(estudio_inicial$status, 200L)

  referencia_inicial <- http_post_json(
    srv,
    "/api/calc-muestra/asistencia/referencia",
    body = list(
      referencia_asistencia = .http_asistencia_fixture(),
      estudio = .http_asistencia_estudio
    ),
    sid = sid,
    timeout = 180
  )
  expect_identical(referencia_inicial$status, 200L)

  before <- http_get(srv, "/api/calc-muestra/state", sid = sid)
  expect_identical(before$status, 200L)
  workspace_previo <- before$json$estudio$workspace
  referencia_previa <- before$json$referencia_asistencia

  invalida <- http_post_json(
    srv,
    "/api/calc-muestra/asistencia/referencia",
    body = list(
      referencia_asistencia = list(list(curso_horario = "CH-incompleto")),
      estudio = .http_asistencia_estudio,
      workspace = .http_asistencia_workspace_propuesto
    ),
    sid = sid
  )
  expect_identical(invalida$status, 400L)

  after_invalid <- http_get(srv, "/api/calc-muestra/state", sid = sid)
  expect_identical(after_invalid$status, 200L)
  expect_identical(after_invalid$json$estudio$workspace, workspace_previo)
  expect_identical(after_invalid$json$referencia_asistencia, referencia_previa)

  fixture_nuevo <- .http_asistencia_fixture()
  fixture_nuevo <- lapply(fixture_nuevo, function(fila) {
    fila$asistieron <- 22L
    fila$enviadas <- 20L
    fila$validas <- 18L
    fila$no_respondieron <- 2L
    fila
  })
  exitosa <- http_post_json(
    srv,
    "/api/calc-muestra/asistencia/referencia",
    body = list(
      referencia_asistencia = fixture_nuevo,
      estudio = modifyList(
        .http_asistencia_estudio,
        list(id = "estudio-http-sintetico-nuevo", periodo = "2026-II")
      ),
      workspace = .http_asistencia_workspace_propuesto
    ),
    sid = sid,
    timeout = 180
  )
  expect_identical(exitosa$status, 200L)
  expect_false(identical(exitosa$json$referencia_asistencia, referencia_previa))
  expect_identical(
    exitosa$json$state$referencia_asistencia,
    exitosa$json$referencia_asistencia
  )

  after_success <- http_get(srv, "/api/calc-muestra/state", sid = sid)
  expect_identical(after_success$status, 200L)
  expect_identical(
    after_success$json$referencia_asistencia,
    exitosa$json$referencia_asistencia
  )
  expect_identical(
    list(
      response = .http_asistencia_workspace_claves(exitosa$json$state),
      get = .http_asistencia_workspace_claves(after_success$json)
    ),
    list(
      response = .http_asistencia_workspace_propuesto,
      get = .http_asistencia_workspace_propuesto
    )
  )
})

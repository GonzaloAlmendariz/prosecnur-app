.http_apch_base <- function() {
  specs <- list(
    c("FAC A", "A1", 2L),
    c("FAC A", "A2", 4L),
    c("FAC B", "B1", 3L),
    c("FAC B", "B2", 5L)
  )
  rows <- list()
  for (spec in specs) {
    faculty <- spec[[1]]
    classroom <- spec[[2]]
    n <- as.integer(spec[[3]])
    for (i in seq_len(n)) {
      rows[[length(rows) + 1L]] <- list(
        estudiante = paste(faculty, classroom, i, sep = "-"),
        curso_horario = classroom,
        facultad = faculty,
        sexo = if (i %% 2L) "F" else "M",
        nivel = "3"
      )
    }
  }
  rows
}

.http_apch_config <- list(
  mapping = list(
    student_id = "estudiante",
    classroom_id = "curso_horario",
    faculty = "facultad",
    sex = "sexo",
    level = "nivel"
  ),
  filters = list(
    require_adult = FALSE,
    require_undergraduate = FALSE,
    require_in_person = FALSE,
    accepted_conditions = list(),
    exclude_session_patterns = list(),
    min_eligible_per_class = 1L
  )
)

.http_apch_component <- function(actor_id, tecnica) {
  list(
    id = paste0("http-", actor_id),
    actor = actor_id,
    actor_id = actor_id,
    actor_categoria = "otros",
    canal_recojo = "aula_qr",
    tecnica = tecnica,
    marco = list(
      estado = "validado",
      estratos = list(
        list(label = "FAC A", N = 100, N_a = 50, N_b = 50,
             sub_a_label = "F", sub_b_label = "M",
             promedio_conglomerado = 999, aulas_base_fijas = 999L, tau = 1),
        list(label = "FAC B", N = 80, N_a = 40, N_b = 40,
             sub_a_label = "F", sub_b_label = "M",
             promedio_conglomerado = 999, aulas_base_fijas = 999L, tau = 1)
      )
    ),
    parametros = list(
      p = 0.5, z = 1.96, e = 0.05, deff = 1,
      promedio_conglomerado = 25, tau = 1, oversample_pct = 0
    )
  )
}

.http_apch_study <- function(frame_hash) {
  list(
    titulo = "HTTP APCH",
    macro_familia = "encuesta_estudiantes",
    workspace = list(
      frame_mode = "opinion_universitaria",
      aulas_config = list(alumnos_por_ch_decision = list(
        schema = "calc_muestra_alumnos_por_ch_decision_v1",
        frame_hash = frame_hash,
        denominador = "elegible",
        estadistico_default = "media",
        por_facultad = list(fac_b = "p25"),
        confirmado_at = "2026-08-02T12:00:00Z"
      ))
    ),
    componentes = list(
      .http_apch_component(
        "estudiantes_universidad",
        "prob_conglomerado_multietapico"
      ),
      .http_apch_component(
        "estudiantes_facultad",
        "prob_estratificado_independiente"
      )
    )
  )
}

test_that("POST /calcular resuelve la firma vigente y rechaza la stale", {
  srv <- http_contract_server()
  creada <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))
  expect_identical(creada$status, 200L)
  sid <- creada$json$session_id

  build <- http_post_json(
    srv,
    "/api/calc-muestra/marco/construir",
    body = list(base_madre = .http_apch_base(), config = .http_apch_config),
    sid = sid,
    timeout = 180
  )
  expect_identical(build$status, 200L)
  frame <- build$json$frame
  expect_identical(frame$alumnos_por_ch$schema, "calc_muestra_alumnos_por_ch_v1")
  expect_identical(frame$alumnos_por_ch$frame_hash, frame$frame_hash)

  study <- .http_apch_study(frame$frame_hash)
  saved <- http_post_json(
    srv,
    "/api/calc-muestra/estudio",
    body = list(estudio = study),
    sid = sid
  )
  expect_identical(saved$status, 200L)
  expect_identical(
    saved$json$estudio$workspace$aulas_config$alumnos_por_ch_decision$frame_hash,
    frame$frame_hash
  )

  calculated <- http_post_json(
    srv,
    "/api/calc-muestra/calcular",
    body = list(),
    sid = sid
  )
  expect_identical(calculated$status, 200L)
  components <- calculated$json$estudio$componentes
  expect_length(components, 2L)
  for (component in components) {
    result <- component$resultado
    distribution <- result$distribucion_universitaria
    expect_identical(
      distribution$schema,
      "calc_muestra_distribucion_universitaria_v1"
    )
    expect_identical(distribution$owner, "engine_r")
    expect_identical(distribution$status, "ready")
    expect_identical(distribution$source_frame_hash, frame$frame_hash)
    expect_true(distribution$reconciliation$ok)
    expect_identical(
      as.integer(distribution$reconciliation$sample_sum),
      as.integer(distribution$totals$sample_n)
    )
    # Golden de transporte: diseño - frame = 180 - 14.
    expect_identical(
      as.integer(distribution$reconciliation$frame_design_delta),
      166L
    )
    expect_length(distribution$faculties, 2L)
    expect_true(all(vapply(distribution$faculties, function(faculty) {
      identical(
        sum(vapply(
          faculty$cells,
          function(cell) as.integer(cell$sample_n),
          integer(1)
        )),
        as.integer(faculty$sample_n)
      )
    }, logical(1))))
    expect_identical(
      result$alumnos_por_ch_decision$frame_hash,
      frame$frame_hash
    )
    expect_identical(result$alumnos_por_ch_decision$denominador, "elegible")
    expect_length(result$aulas_por_estrato, 2L)
    expect_true(all(vapply(result$aulas_por_estrato, function(row) {
      identical(row$alumnos_por_ch$frame_hash, frame$frame_hash) &&
        as.numeric(row$avg_conglomerado) < 999
    }, logical(1))))
    expect_equal(
      as.integer(result$aulas_base_total),
      sum(vapply(
        result$aulas_por_estrato,
        function(row) as.integer(row$aulas_base),
        integer(1)
      ))
    )
  }

  stale_study <- study
  stale_study$workspace$aulas_config$alumnos_por_ch_decision$frame_hash <-
    "frame-anterior"
  stale_study$workspace$aulas_config$n_aulas <- 17L
  stale_study$componentes <- lapply(stale_study$componentes, function(component) {
    component$resultado <- list(aulas_base_total = 999L)
    component
  })
  stale_saved <- http_post_json(
    srv,
    "/api/calc-muestra/estudio",
    body = list(estudio = stale_study),
    sid = sid
  )
  expect_identical(stale_saved$status, 200L)
  expect_null(stale_saved$json$estudio$workspace$aulas_config$n_aulas)
  results_cleared <- all(vapply(
    stale_saved$json$estudio$componentes,
    function(component) is.null(component$resultado),
    logical(1)
  ))
  expect_true(
    results_cleared,
    info = as.character(jsonlite::toJSON(
      lapply(stale_saved$json$estudio$componentes, `[[`, "resultado"),
      auto_unbox = TRUE,
      null = "null"
    ))
  )
  report_stale <- http_post_json(
    srv,
    "/api/calc-muestra/reporte",
    body = list(formato = "html"),
    sid = sid
  )
  expect_identical(report_stale$status, 409L)
  expect_identical(report_stale$json$error$code, "E_SIN_RESULTADOS")
  stale <- http_post_json(
    srv,
    "/api/calc-muestra/calcular",
    body = list(),
    sid = sid
  )
  expect_identical(stale$status, 409L)
  expect_identical(
    stale$json$error$code,
    "E_CALC_MUESTRA_ALUMNOS_CH_DECISION"
  )
  expect_identical(stale$json$error$details$reason, "frame_stale")
})

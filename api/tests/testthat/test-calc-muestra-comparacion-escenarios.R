# Contrato I20 — el emisor R del snapshot de comparación P1↔P2.
#
# La spec es el normalizador TS (frontend/src/api/calcMuestraComparacionI20.ts):
# claves EXACTAS, snapshot byte-igual en ambos carriers, deltas P2−P1
# verificables y razones estructuradas cuando no se puede comparar. La
# serialización de referencia replica el serializer del router
# (plumber::serializer_unboxed_json == jsonlite::toJSON(auto_unbox = TRUE)).

.i20_serializar <- function(x) {
  as.character(jsonlite::toJSON(x, auto_unbox = TRUE))
}

.i20_parsear <- function(json) {
  jsonlite::fromJSON(json, simplifyVector = FALSE)
}

.i20_top_keys <- c(
  "schema", "owner", "status", "reasons", "source_frame_hash",
  "population_hash", "comparison_hash", "computed_at", "sample_unit",
  "sample_stage", "ch_unit", "scenarios", "deltas_p2_minus_p1",
  "reconciliation"
)

.i20_scenario_keys <- c(
  "component_id", "actor_id", "scenario", "technique", "design_hash",
  "ch_basis_hash", "sample_n", "ch", "formal_precision"
)

.i20_reconciliation_keys <- c(
  "ok", "p1_ready", "p2_ready", "same_source_frame", "same_population",
  "same_faculty_inventory", "same_ch_basis", "sample_sums", "ch_sums",
  "delta_sums"
)

# Misma frontera de bandas que el TS (precisionBand + BAND_LABELS).
.i20_banda <- function(e) {
  if (e <= 0.03) return(list(key = "le_3pp", label = "≤ 3 pp"))
  if (e <= 0.05) return(list(key = "3_5pp", label = "3–5 pp"))
  if (e <= 0.07) return(list(key = "5_7pp", label = "5–7 pp"))
  list(key = "gt_7pp", label = "> 7 pp")
}

.i20_cross <- function(rows) {
  do.call(rbind, lapply(rows, function(row) {
    data.frame(
      primary_role = "faculty",
      primary_label = "Facultad",
      primary_raw = row[[1]],
      secondary_role = "sex",
      secondary_label = "Sexo",
      secondary_raw = row[[2]],
      source_role = "base_madre",
      count = row[[3]],
      unit_label = "estudiantes",
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  }))
}

.i20_frame <- function(hash = "frame-i20-1") {
  aula_frame <- data.frame(
    classroom_id = c("A-1", "A-2", "B-1", "B-2"),
    faculty = c("FAC A", "FAC A", "FAC B", "FAC B"),
    included = TRUE,
    eligible_n = c(20, 30, 16, 24),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  list(
    schema = "calc_muestra_aulas_frame_v1",
    frame_hash = hash,
    aula_frame = aula_frame,
    alumnos_por_ch = calc_muestra_alumnos_por_ch(aula_frame, hash),
    population_cross_profiles = .i20_cross(list(
      list("FAC A", "Mujeres", 60L),
      list("FAC A", "Hombres", 40L),
      list("FAC B", "Mujeres", 45L),
      list("FAC B", "Hombres", 35L)
    )),
    audit = data.frame(
      metric = "population_n",
      value = "180",
      stringsAsFactors = FALSE
    )
  )
}

.i20_component <- function(actor_id, technique, oversample_pct = 0) {
  list(
    id = paste0("cmp-", actor_id),
    actor = actor_id,
    actor_id = actor_id,
    actor_categoria = "otros",
    canal_recojo = "aula_qr",
    tecnica = technique,
    marco = list(
      estado = "validado",
      estratos = list(
        list(
          label = "FAC A", N = 100L, N_a = 60L, N_b = 40L,
          sub_a_label = "Mujeres", sub_b_label = "Hombres",
          e_facultad = 0.10, p_facultad = 0.30,
          confianza_facultad = 0.90, promedio_conglomerado = 999,
          aulas_base_fijas = 999L, tau = 1
        ),
        list(
          label = "FAC B", N = 80L, N_a = 45L, N_b = 35L,
          sub_a_label = "Mujeres", sub_b_label = "Hombres",
          e_facultad = 0.20, p_facultad = 0.50,
          confianza_facultad = 0.99, promedio_conglomerado = 999,
          aulas_base_fijas = 999L, tau = 1
        )
      )
    ),
    parametros = list(
      p = 0.30, z = 1.96, e = 0.10, deff = 1.5,
      tau = 1, promedio_conglomerado = 25, oversample_pct = oversample_pct
    ),
    meta = list(valor = if (identical(actor_id, "estudiantes_universidad")) 50L else 0L)
  )
}

.i20_study <- function(hash = "frame-i20-1") {
  list(
    macro_familia = "encuesta_estudiantes",
    workspace = list(
      frame_mode = "opinion_universitaria",
      aulas_config = list(alumnos_por_ch_decision = list(
        schema = "calc_muestra_alumnos_por_ch_decision_v1",
        frame_hash = hash,
        denominador = "elegible",
        estadistico_default = "media",
        por_facultad = list(),
        confirmado_at = "2026-08-02T12:00:00Z"
      ))
    ),
    componentes = list(
      .i20_component(
        "estudiantes_universidad",
        "prob_conglomerado_multietapico",
        oversample_pct = 0.5
      ),
      .i20_component(
        "estudiantes_facultad",
        "prob_estratificado_independiente"
      )
    )
  )
}

.i20_calculated <- function(study = .i20_study(), frame = .i20_frame()) {
  calc_muestra_alumnos_por_ch_calcular_estudio(study, frame)
}

.i20_snapshot <- function(calculated, index = 1L) {
  calculated$componentes[[index]]$resultado$comparacion_escenarios
}

.i20_reason_codes <- function(snapshot) {
  vapply(snapshot$reasons, `[[`, character(1), "code")
}

test_that("el snapshot ready respeta las claves y valores exactos del schema I20", {
  frame <- .i20_frame()
  calculated <- .i20_calculated(frame = frame)
  p1_comp <- calculated$componentes[[1L]]
  p2_comp <- calculated$componentes[[2L]]
  snap <- .i20_snapshot(calculated)

  expect_identical(sort(names(snap)), sort(.i20_top_keys))
  expect_identical(snap$schema, "calc_muestra_comparacion_escenarios_v1")
  expect_identical(snap$owner, "engine_r")
  expect_identical(snap$status, "ready")
  expect_identical(snap$reasons, list())
  expect_identical(snap$sample_unit, "cuota_objetivo_estudiante")
  expect_identical(snap$sample_stage, "planificada")
  expect_identical(snap$ch_unit, "curso_horario")
  expect_identical(snap$source_frame_hash, frame$frame_hash)
  expect_match(snap$computed_at, "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$")
  expect_true(nzchar(snap$comparison_hash))
  expect_identical(
    snap$population_hash,
    p1_comp$resultado$distribucion_universitaria$population_hash
  )

  expect_identical(
    sort(names(snap$scenarios)),
    c("p1_universidad", "p2_facultades")
  )
  p1 <- snap$scenarios$p1_universidad
  p2 <- snap$scenarios$p2_facultades
  for (scenario in list(p1, p2)) {
    expect_identical(sort(names(scenario)), sort(.i20_scenario_keys))
    expect_identical(sort(names(scenario$ch)), sort(c(
      "base_required", "reserve_required", "total_operational",
      "reserve_policy_code"
    )))
    expect_identical(
      scenario$ch$total_operational,
      as.integer(scenario$ch$base_required + scenario$ch$reserve_required)
    )
  }

  expect_identical(p1$component_id, p1_comp$id)
  expect_identical(p1$actor_id, "estudiantes_universidad")
  expect_identical(p1$scenario, "p1_universidad")
  expect_identical(p1$technique, "prob_conglomerado_multietapico")
  expect_identical(p1$design_hash, p1_comp$resultado$distribucion_universitaria$design_hash)
  expect_identical(p1$sample_n, p1_comp$resultado$n_objetivo)
  expect_identical(p1$ch$base_required, p1_comp$resultado$aulas_base_total)
  expect_identical(p1$ch$reserve_required, p1_comp$resultado$aulas_extra_total)
  expect_identical(p1$ch$total_operational, p1_comp$resultado$aulas_total)
  expect_identical(p1$ch$reserve_policy_code, "explicit_or_faculty_oversample_pct")
  expect_gt(p1$ch$reserve_required, 0L)

  expect_identical(p2$component_id, p2_comp$id)
  expect_identical(p2$actor_id, "estudiantes_facultad")
  expect_identical(p2$scenario, "p2_facultades")
  expect_identical(p2$technique, "prob_estratificado_independiente")
  expect_identical(p2$sample_n, p2_comp$resultado$n_objetivo)
  expect_identical(p2$ch$base_required, p2_comp$resultado$aulas_base_total)
  expect_identical(p2$ch$reserve_required, p2_comp$resultado$aulas_extra_total)
  expect_identical(p2$ch$total_operational, p2_comp$resultado$aulas_total)
  expect_identical(p2$ch$reserve_policy_code, "explicit_or_zero")

  # La base CH firmada (divisor + tau por facultad) es la misma en ambos.
  expect_true(nzchar(p1$ch_basis_hash))
  expect_identical(p1$ch_basis_hash, p2$ch_basis_hash)

  # Alcance formal P1: unidad global reconciliada con banda exacta.
  fp1 <- p1$formal_precision
  expect_identical(sort(names(fp1)), sort(c("scope", "formal_units", "global")))
  expect_identical(fp1$scope, "global_university_formal")
  expect_identical(fp1$formal_units, 1L)
  expect_identical(sort(names(fp1$global)), sort(c(
    "population_n", "sample_n", "achieved_e", "band"
  )))
  expect_identical(fp1$global$population_n, 180L)
  expect_identical(fp1$global$sample_n, p1$sample_n)
  expect_identical(fp1$global$achieved_e, p1_comp$resultado$precision_alcanzada)
  expected_band <- .i20_banda(fp1$global$achieved_e)
  expect_identical(sort(names(fp1$global$band)), c("key", "label"))
  expect_identical(fp1$global$band$key, expected_band$key)
  expect_identical(fp1$global$band$label, expected_band$label)

  # Alcance formal P2: unidades independientes y global == null.
  fp2 <- p2$formal_precision
  expect_identical(sort(names(fp2)), sort(c("scope", "formal_units", "global")))
  expect_identical(fp2$scope, "independent_faculty_formal")
  expect_identical(fp2$formal_units, 2L)
  expect_true(is.na(fp2$global))

  expect_identical(sort(names(snap$reconciliation)), sort(.i20_reconciliation_keys))
  expect_true(all(vapply(snap$reconciliation, isTRUE, logical(1))))

  # Serializado por el mismo camino que el router: claves intactas,
  # reasons como [] y el global de P2 como null literal.
  json <- .i20_serializar(snap)
  parsed <- .i20_parsear(json)
  expect_identical(sort(names(parsed)), sort(.i20_top_keys))
  expect_true(grepl("\"reasons\":[]", json, fixed = TRUE))
  expect_true(grepl("\"global\":null", json, fixed = TRUE))
  expect_false(grepl("\"global\":{}", json, fixed = TRUE))
  parsed_fp2 <- parsed$scenarios$p2_facultades$formal_precision
  expect_identical(sort(names(parsed_fp2)), sort(c("scope", "formal_units", "global")))
  expect_null(parsed_fp2$global)
})

test_that("los deltas publicados son exactamente P2 menos P1 y cierran entre sí", {
  calculated <- .i20_calculated()
  snap <- .i20_snapshot(calculated)
  p1 <- snap$scenarios$p1_universidad
  p2 <- snap$scenarios$p2_facultades
  deltas <- snap$deltas_p2_minus_p1

  expect_identical(sort(names(deltas)), sort(c("direction", "values", "semantics")))
  expect_identical(deltas$direction, "p2_minus_p1")
  expect_identical(sort(names(deltas$values)), sort(c(
    "sample_n", "ch_base_required", "ch_reserve_policy_dependent",
    "ch_total_operational"
  )))
  expect_identical(deltas$values$sample_n, as.integer(p2$sample_n - p1$sample_n))
  expect_identical(
    deltas$values$ch_base_required,
    as.integer(p2$ch$base_required - p1$ch$base_required)
  )
  expect_identical(
    deltas$values$ch_reserve_policy_dependent,
    as.integer(p2$ch$reserve_required - p1$ch$reserve_required)
  )
  expect_identical(
    deltas$values$ch_total_operational,
    as.integer(p2$ch$total_operational - p1$ch$total_operational)
  )
  expect_identical(
    deltas$values$ch_total_operational,
    as.integer(
      deltas$values$ch_base_required + deltas$values$ch_reserve_policy_dependent
    )
  )

  expect_identical(sort(names(deltas$semantics)), sort(names(deltas$values)))
  expect_identical(
    deltas$semantics$sample_n,
    list(kind = "planned_sample_load", precision_claim = FALSE)
  )
  expect_identical(
    deltas$semantics$ch_base_required,
    list(
      kind = "signed_classroom_requirement",
      causal = TRUE,
      guard = "same_divisor_tau_by_faculty"
    )
  )
  expect_identical(
    deltas$semantics$ch_reserve_policy_dependent,
    list(kind = "reserve_policy", precision_claim = FALSE)
  )
  expect_identical(
    deltas$semantics$ch_total_operational,
    list(kind = "operational_balance", precision_claim = FALSE)
  )
})

test_that("ambos carriers llevan el snapshot idéntico byte a byte", {
  calculated <- .i20_calculated()
  snap_p1 <- .i20_snapshot(calculated, 1L)
  snap_p2 <- .i20_snapshot(calculated, 2L)

  expect_identical(snap_p1, snap_p2)
  expect_identical(.i20_serializar(snap_p1), .i20_serializar(snap_p2))
})

test_that("marco distinto, resultado de uno solo o base CH divergente son incompatibles", {
  frame <- .i20_frame()
  calculated <- .i20_calculated(frame = frame)

  # Marco vigente distinto del marco fuente de los resultados.
  stale_frame <- frame
  stale_frame$frame_hash <- "frame-i20-2"
  stale <- calc_muestra_comparacion_adjuntar_estudio(calculated, stale_frame)
  for (index in 1:2) {
    snap <- .i20_snapshot(stale, index)
    expect_identical(sort(names(snap)), sort(.i20_top_keys))
    expect_identical(snap$status, "incompatible")
    expect_false(snap$reconciliation$ok)
    expect_gt(length(snap$reasons), 0L)
    for (reason in snap$reasons) {
      expect_identical(sort(names(reason)), c("code", "details", "message"))
      expect_true(nzchar(reason$code))
      expect_true(nzchar(reason$message))
    }
    expect_contains(.i20_reason_codes(snap), "source_frame_stale")
    json <- .i20_serializar(snap)
    parsed <- .i20_parsear(json)
    expect_identical(sort(names(parsed)), sort(.i20_top_keys))
    expect_true(grepl("\"scenarios\":null", json, fixed = TRUE))
  }
  expect_identical(.i20_snapshot(stale, 1L), .i20_snapshot(stale, 2L))

  # Resultado de un solo componente: el carrier restante declara la falta.
  solo <- calculated
  solo$componentes[[2L]]$resultado <- NULL
  solo <- calc_muestra_comparacion_adjuntar_estudio(solo, frame)
  expect_null(solo$componentes[[2L]]$resultado)
  snap_solo <- .i20_snapshot(solo, 1L)
  expect_identical(snap_solo$status, "incompatible")
  expect_contains(.i20_reason_codes(snap_solo), "scenario_result_missing")
  expect_false(snap_solo$reconciliation$p2_ready)

  # Base CH no compartida: tau divergente rompe el guard del delta causal.
  divergent <- calculated
  divergent$componentes[[2L]]$resultado$aulas_por_estrato <- lapply(
    divergent$componentes[[2L]]$resultado$aulas_por_estrato,
    function(row) {
      row$tau <- 0.9
      row
    }
  )
  divergent <- calc_muestra_comparacion_adjuntar_estudio(divergent, frame)
  snap_divergent <- .i20_snapshot(divergent, 1L)
  expect_identical(snap_divergent$status, "incompatible")
  expect_contains(.i20_reason_codes(snap_divergent), "ch_basis_mismatch")
  expect_false(snap_divergent$reconciliation$same_ch_basis)
})

test_that("el carrier sobrevive el round-trip JSON del autosave sin degradar global", {
  calculated <- .i20_calculated()

  # Ida: el server serializa el estudio; vuelta: el cliente lo reenvía y el
  # router lo parsea (fromJSON simplifyVector = FALSE) y lo normaliza.
  wire <- .i20_serializar(list(estudio = calculated))
  client_estudio <- .i20_parsear(wire)$estudio
  normalized <- calc_muestra_normalize_estudio(client_estudio)

  snap_p1_json <- .i20_serializar(
    normalized$componentes[[1L]]$resultado$comparacion_escenarios
  )
  snap_p2_json <- .i20_serializar(
    normalized$componentes[[2L]]$resultado$comparacion_escenarios
  )
  expect_identical(snap_p1_json, snap_p2_json)
  expect_true(grepl("\"global\":null", snap_p2_json, fixed = TRUE))
  expect_false(grepl("\"global\":{}", snap_p2_json, fixed = TRUE))
  parsed <- .i20_parsear(snap_p2_json)
  expect_identical(sort(names(parsed)), sort(.i20_top_keys))
  expect_identical(parsed$status, "ready")

  # Segundo round-trip: estable (el repair es idempotente).
  second <- calc_muestra_normalize_estudio(
    .i20_parsear(.i20_serializar(list(estudio = normalized)))$estudio
  )
  expect_identical(
    .i20_serializar(second$componentes[[2L]]$resultado$comparacion_escenarios),
    snap_p2_json
  )
})

test_that("los placeholders del snapshot incompatible sobreviven el autosave como null", {
  frame <- .i20_frame()
  calculated <- .i20_calculated(frame = frame)
  stale_frame <- frame
  stale_frame$frame_hash <- "frame-i20-2"
  stale <- calc_muestra_comparacion_adjuntar_estudio(calculated, stale_frame)
  expect_identical(.i20_snapshot(stale, 1L)$status, "incompatible")

  # Ida y vuelta del autosave: serializar el estudio, parsearlo como el
  # router y normalizarlo. Los placeholders deben seguir siendo null, no {}.
  wire <- .i20_serializar(list(estudio = stale))
  normalized <- calc_muestra_normalize_estudio(.i20_parsear(wire)$estudio)

  snap_p1_json <- .i20_serializar(
    normalized$componentes[[1L]]$resultado$comparacion_escenarios
  )
  snap_p2_json <- .i20_serializar(
    normalized$componentes[[2L]]$resultado$comparacion_escenarios
  )
  expect_identical(snap_p1_json, snap_p2_json)
  expect_true(grepl("\"scenarios\":null", snap_p1_json, fixed = TRUE))
  expect_true(grepl("\"deltas_p2_minus_p1\":null", snap_p1_json, fixed = TRUE))
  expect_false(grepl("\"scenarios\":{}", snap_p1_json, fixed = TRUE))
  expect_false(grepl("\"deltas_p2_minus_p1\":{}", snap_p1_json, fixed = TRUE))
  parsed <- .i20_parsear(snap_p1_json)
  expect_identical(sort(names(parsed)), sort(.i20_top_keys))
  expect_identical(parsed$status, "incompatible")

  # Segundo round-trip: estable (el repair es idempotente también aquí).
  second <- calc_muestra_normalize_estudio(
    .i20_parsear(.i20_serializar(list(estudio = normalized)))$estudio
  )
  expect_identical(
    .i20_serializar(second$componentes[[1L]]$resultado$comparacion_escenarios),
    snap_p1_json
  )
})

# --- Smoke por HTTP real: el wire completo calcula, autosavea y relee -------

.i20_http_base <- function() {
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

.i20_http_config <- list(
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

.i20_http_study <- function(frame_hash) {
  study <- .i20_study(frame_hash)
  study$titulo <- "HTTP I20"
  # El marco real construido por HTTP registra el sexo como F/M; el diseño
  # debe cubrir exactamente ese mismo set para que I19 acredite ready.
  study$componentes <- lapply(study$componentes, function(component) {
    component$marco$estratos <- lapply(component$marco$estratos, function(estrato) {
      estrato$sub_a_label <- "F"
      estrato$sub_b_label <- "M"
      estrato
    })
    component
  })
  study
}

test_that("HTTP: /calcular estampa el mismo snapshot y el autosave no lo degrada", {
  srv <- http_contract_server()
  creada <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))
  expect_identical(creada$status, 200L)
  sid <- creada$json$session_id

  build <- http_post_json(
    srv,
    "/api/calc-muestra/marco/construir",
    body = list(base_madre = .i20_http_base(), config = .i20_http_config),
    sid = sid,
    timeout = 180
  )
  expect_identical(build$status, 200L)
  frame_hash <- build$json$frame$frame_hash

  saved <- http_post_json(
    srv,
    "/api/calc-muestra/estudio",
    body = list(estudio = .i20_http_study(frame_hash)),
    sid = sid
  )
  expect_identical(saved$status, 200L)

  calculated <- http_post_json(
    srv,
    "/api/calc-muestra/calcular",
    body = list(),
    sid = sid
  )
  expect_identical(calculated$status, 200L)
  components <- calculated$json$estudio$componentes
  expect_length(components, 2L)
  snaps <- lapply(components, function(component) {
    component$resultado$comparacion_escenarios
  })
  expect_identical(snaps[[1L]], snaps[[2L]])
  snap <- snaps[[1L]]
  expect_identical(sort(names(snap)), sort(.i20_top_keys))
  expect_identical(snap$status, "ready")
  expect_identical(snap$source_frame_hash, frame_hash)
  expect_identical(snap$reasons, list())
  raw_body <- rawToChar(calculated$raw)
  expect_true(grepl("\"global\":null", raw_body, fixed = TRUE))
  expect_false(grepl("\"global\":{}", raw_body, fixed = TRUE))

  # Autosave real: el frontend reenvía el estudio calculado tal cual y el
  # estado releído debe conservar el contrato (global sigue siendo null).
  resaved <- http_post_json(
    srv,
    "/api/calc-muestra/estudio",
    body = list(estudio = calculated$json$estudio),
    sid = sid
  )
  expect_identical(resaved$status, 200L)
  state <- http_get(srv, "/api/calc-muestra/state", sid = sid)
  expect_identical(state$status, 200L)
  state_snaps <- lapply(state$json$estudio$componentes, function(component) {
    component$resultado$comparacion_escenarios
  })
  expect_identical(state_snaps[[1L]], state_snaps[[2L]])
  expect_identical(state_snaps[[1L]]$status, "ready")
  expect_identical(sort(names(state_snaps[[1L]])), sort(.i20_top_keys))
  state_raw <- rawToChar(state$raw)
  expect_true(grepl("\"global\":null", state_raw, fixed = TRUE))
  expect_false(grepl("\"global\":{}", state_raw, fixed = TRUE))
})

test_that("round-trip .pulso conserva el snapshot idéntico en ambos carriers", {
  skip_if_not_installed("zip")
  frame <- .i20_frame()
  calculated <- .i20_calculated(frame = frame)
  sid <- session_create()
  dest <- tempfile(fileext = ".pulso")
  stage <- tempfile("i20_pulso_")
  on.exit({
    session_delete(sid)
    unlink(dest, force = TRUE)
    unlink(stage, recursive = TRUE, force = TRUE)
  }, add = TRUE)
  session_set(sid, "calc_muestra_estudio", calculated)
  session_set(sid, "calc_muestra_aulas_frame", frame)

  build_pulso(sid, dest, project_name = "Comparación I20")
  loaded <- load_pulso(dest)
  on.exit(session_delete(loaded$session_id), add = TRUE)
  restored <- session_get(loaded$session_id)

  snap_original <- .i20_snapshot(calculated, 1L)
  snap_p1 <- restored$calc_muestra_estudio$componentes[[1L]]$resultado$
    comparacion_escenarios
  snap_p2 <- restored$calc_muestra_estudio$componentes[[2L]]$resultado$
    comparacion_escenarios
  expect_identical(snap_p1, snap_original)
  expect_identical(snap_p2, snap_original)
  expect_identical(snap_p1$status, "ready")
  expect_true(is.na(
    snap_p1$scenarios$p2_facultades$formal_precision$global
  ))
})

library(testthat)

test_that("el draft consolidado es global y usa revision optimista", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$estudio <- list(active_base = "docentes")
  .session_env[[sid]] <- s

  initial <- graficos_consolidado_draft_get(sid)
  authored_plan <- list(slides = list(list(
    id = "slide-autorado",
    tipo = "p_slide_titulo",
    payload = list(titulo = "Informe conjunto autorado")
  )))
  authored_config <- list(plan = authored_plan, paletas = list())

  graficos_consolidado_draft_set(
    sid,
    authored_config,
    expected_revision = initial$revision
  )
  saved <- graficos_consolidado_draft_get(sid)

  expect_equal(initial$schema, "graficos_consolidado_draft/v1")
  expect_equal(saved$schema, "graficos_consolidado_draft/v1")
  expect_gt(saved$revision, initial$revision)
  expect_equal(saved$config$plan, authored_plan)

  stale_config <- list(plan = list(slides = list()), paletas = list())
  expect_error(
    graficos_consolidado_draft_set(
      sid,
      stale_config,
      expected_revision = initial$revision
    ),
    class = "api_error"
  )
  expect_equal(graficos_consolidado_draft_get(sid), saved)

  s <- session_get(sid)
  s$estudio$active_base <- "estudiantes"
  .session_env[[sid]] <- s
  expect_equal(graficos_consolidado_draft_get(sid), saved)
})

test_that("preflight prefiere el plan autorado de config al plan sugerido", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$estudio <- list(active_base = "docentes")
  .session_env[[sid]] <- s

  authored_plan <- list(slides = list(list(
    id = "slide-autorado",
    tipo = "p_slide_titulo",
    payload = list(titulo = "Decidido por el analista")
  )))
  suggested_plan <- list(slides = list(list(
    id = "slide-sugerido",
    tipo = "p_slide_titulo",
    payload = list(titulo = "Sugerencia automatica")
  )))
  sources <- list(
    data_sources = list(docentes = data.frame(), estudiantes = data.frame()),
    inst_sources = list(docentes = list(), estudiantes = list())
  )
  catalog <- list(
    detected = TRUE,
    entries = list(
      list(base = "docentes", approved = TRUE),
      list(base = "estudiantes", approved = TRUE)
    )
  )

  preflight <- testthat::with_mocked_bindings(
    graficos_consolidado_preflight(sid, config = list(plan = authored_plan)),
    .processing_release_catalog = function(...) catalog,
    .graficos_consolidado_sources = function(...) sources,
    .graficos_suggested_plan = function(...) list(plan = suggested_plan, warnings = list()),
    .graficos_consolidado_methodology_rules = function(...) list(),
    .graficos_consolidado_apply_methodology = function(plan, ...) list(plan = plan, warnings = character()),
    .normalize_plan = function(plan) plan,
    .validar_plan_json = function(...) list(ok = TRUE, errors = character()),
    .graficos_consolidado_validate_refs = function(...) list(),
    .graficos_consolidado_release_pins = function(...) list(),
    .processing_release_hash = function(...) paste(rep("a", 64), collapse = ""),
    .graficos_consolidado_denominator_warnings = function(...) character(),
    .package = "prosecnurapp"
  )

  expect_equal(preflight$plan, authored_plan)
  expect_false(identical(preflight$plan, suggested_plan))
})

test_that("la exportacion rechaza una revision obsoleta antes del preflight", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$estudio <- list(active_base = "docentes")
  .session_env[[sid]] <- s

  initial <- graficos_consolidado_draft_get(sid)
  graficos_consolidado_draft_set(
    sid,
    list(plan = list(slides = list()), paletas = list()),
    expected_revision = initial$revision
  )

  err <- tryCatch(
    graficos_consolidado_start(sid, expected_revision = initial$revision),
    error = identity
  )
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_GRAFICOS_CONSOLIDADO_DRAFT_STALE")
})

test_that("el plan sugerido narrativo no repite una base global", {
  graphs <- list(
    list(title = "Pregunta 1", graf = list(graficador = "p_pie", args = list(var = "p1"))),
    list(title = "Pregunta 2", graf = list(graficador = "p_pie", args = list(var = "p2"))),
    list(title = "Pregunta 3", graf = list(graficador = "p_pie", args = list(var = "p3")))
  )

  slides <- .graficos_pack_simple_graphs(
    graphs,
    section_title = "Resultados por pregunta",
    base_label = "Base: 178 encuestas"
  )

  expect_length(slides, 2)
  expect_true(slides[[1]]$payload$meta$suppress_base_placeholder)
  expect_true(slides[[2]]$payload$meta$suppress_base_placeholder)
})

test_that("monitoreo calcula KPIs, metas e inconsistencias", {
  data <- data.frame(
    id = c("a", "b", "b", "d"),
    enumerador = c("Ana", "Ana", "Luis", "Luis"),
    distrito = c("Norte", "Norte", "Sur", "Sur"),
    estado = c("completed", "completed", "rejected", "completed"),
    fecha = c("2026-05-01T10:00:00Z", "2026-05-01T11:00:00Z", "2026-05-02T10:00:00Z", "2026-05-02T10:30:00Z"),
    duracion = c(120, 20, 500, 8000),
    telefono = c("1", "", "3", "4"),
    stringsAsFactors = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    id_var = "id",
    enumerator_var = "enumerador",
    date_var = "fecha",
    duration_var = "duracion",
    status_var = "estado",
    valid_statuses = c("completed"),
    control_vars = c("distrito"),
    critical_vars = c("telefono"),
    goals = list(
      list(filters = list(distrito = "Norte"), meta = 5L),
      list(filters = list(distrito = "Sur"), meta = 5L)
    ),
    min_duration_seconds = 60,
    max_duration_seconds = 7200
  ), data)

  dash <- monitoreo_build_dashboard(data, cfg)
  expect_equal(dash$kpis$total, 4L)
  expect_equal(dash$kpis$valid, 3L)
  expect_equal(dash$kpis$target, 10L)
  expect_equal(dash$progress$observado[dash$progress$distrito == "Norte"], 2L)
  expect_true(any(dash$inconsistencies$tipo == "estado_invalido"))
  expect_true(any(dash$inconsistencies$tipo == "campo_critico_vacio"))
  expect_true(any(dash$inconsistencies$tipo == "id_duplicado"))
  expect_true(any(dash$inconsistencies$tipo == "duracion_muy_corta"))
  expect_true(any(dash$inconsistencies$tipo == "duracion_muy_larga"))
})

test_that("monitoreo supervision es reproducible", {
  data <- data.frame(
    id = sprintf("id_%02d", 1:10),
    estado = rep("completed", 10),
    duracion = c(10, rep(200, 9)),
    stringsAsFactors = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    id_var = "id",
    status_var = "estado",
    duration_var = "duracion",
    valid_statuses = "completed",
    min_duration_seconds = 60
  ), data)
  a <- monitoreo_supervision_sample(data, cfg, n = 4, seed = 7)
  b <- monitoreo_supervision_sample(data, cfg, n = 4, seed = 7)
  expect_equal(a$id, b$id)
  expect_equal(nrow(a), 4L)
})

test_that("monitoreo demo carga snapshot sin credenciales", {
  demo <- monitoreo_demo_payload(seed = 7L, n = 24L)
  expect_true(isTRUE(demo$ok))
  expect_equal(nrow(demo$snapshot$data), 24L)
  expect_equal(demo$config$id_var, "response_id")
  expect_true(all(!vapply(demo$sources, `[[`, logical(1), "enabled")))
  expect_true(demo$snapshot$dashboard$kpis$total >= 24L)
  expect_false(any(vapply(demo$sources, function(src) "token" %in% names(src), logical(1))))
})

test_that("SurveyMonkey flatten convierte respuestas bulk a tabla", {
  details <- list(
    title = "Demo",
    pages = list(list(questions = list(list(
      id = "101",
      family = "single_choice",
      headings = list(list(heading = "Distrito")),
      answers = list(choices = list(
        list(id = "1", text = "Norte"),
        list(id = "2", text = "Sur")
      ))
    ))))
  )
  responses <- list(list(
    id = "r1",
    response_status = "completed",
    date_modified = "2026-05-01T10:00:00Z",
    custom_variables = list(enumerador = "Ana"),
    pages = list(list(questions = list(list(
      id = "101",
      answers = list(list(choice_id = "1"))
    ))))
  ))
  out <- sm_api_flatten_responses(details, responses)
  expect_equal(nrow(out), 1L)
  expect_equal(out$response_id, "r1")
  expect_equal(out$q0001, "Norte")
  expect_equal(out$cv_enumerador, "Ana")
})

test_that("Kobo flatten tolera resultados anidados", {
  rows <- list(
    list(`_id` = 1, name = "Ana", group = list(district = "Norte")),
    list(`_id` = 2, name = "Luis", group = list(district = "Sur"))
  )
  out <- kobo_api_flatten_results(rows)
  expect_equal(nrow(out), 2L)
  expect_true("_id" %in% names(out))
  expect_true("group.district" %in% names(out))
})

test_that("pulso persiste monitoreo sin tokens", {
  sid <- session_create()
  session_set(sid, "monitoreo_sources", monitoreo_normalize_sources(list(list(
    kind = "kobo",
    label = "Campo",
    asset_uid = "asset123",
    token = "no-debe-persistir"
  ))))
  session_set(sid, "monitoreo_config", monitoreo_normalize_config(list(objetivo_total = 10L)))
  dest <- tempfile(fileext = ".pulso")
  build_pulso(sid, dest, project_name = "Monitoreo")
  td <- tempfile("pulso_test_")
  dir.create(td)
  on.exit(unlink(td, recursive = TRUE, force = TRUE), add = TRUE)
  zip::unzip(dest, exdir = td)
  saved <- readRDS(file.path(td, "state.rds"))
  expect_false("token" %in% names(saved$monitoreo_sources[[1]]))
  expect_equal(saved$monitoreo_sources[[1]]$asset_uid, "asset123")
})

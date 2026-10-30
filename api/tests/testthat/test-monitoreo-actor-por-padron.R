# CENTRUM y Campus: dos públicos de un mismo padrón, una sola encuesta (30/10).

.perfil_profesores <- function() {
  monitoreo_normalize_profile(list(
    family = "acreditacion",
    variant = "multi_actor",
    units = list(list(id = "Docentes CENTRUM", label = "Docentes CENTRUM"), list(id = "Docentes Campus", label = "Docentes Campus")),
    key_rules = list(universe_fields = c("CodPulso"), response_fields = c("cv_id"), automatic_detection = FALSE)
  ))
}

.casos_df <- function(records) {
  if (!length(records)) return(data.frame())
  do.call(rbind, lapply(records, function(record) {
    record[] <- lapply(record, function(value) if (is.list(value)) I(list(value)) else value)
    as.data.frame(record, check.names = FALSE, stringsAsFactors = FALSE)
  }))
}

.padron_profesores <- function() {
  data.frame(
    CodPulso = c("1001", "1002", "1003", "", ""),
    `Modalidad docente` = c("CENTRUM", "TPA", "", "", ""),
    cv_id = c("", "", "", "1001", "1002"),
    response_id = c("", "", "", "r-centrum", "r-campus"),
    response_status = c("", "", "", "completed", "completed"),
    date_modified = c("", "", "", "2026-10-29T10:00:00+00:00", "2026-10-29T11:00:00+00:00"),
    .source_role = c("universo", "universo", "universo", "respuestas", "respuestas"),
    .source_label = c("Universo · Profesores", "Universo · Profesores", "Universo · Profesores", "SurveyMonkey · Profesores", "SurveyMonkey · Profesores"),
    dim_actor = c("Docentes Campus", "Docentes Campus", "Docentes Campus", "Profesores", "Profesores"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

test_that("el mapa reparte el padrón: CENTRUM a su público, el resto y las vacías al de la fuente", {
  data <- .padron_profesores()[1:3, ]
  fuente <- list(actor_var = "Modalidad docente", actor_map = list(centrum = "Docentes CENTRUM"))
  out <- monitoreo_apply_source_dimension_vars(data, fuente)
  expect_identical(out$dim_actor, c("Docentes CENTRUM", "Docentes Campus", "Docentes Campus"))
})

test_that("sin mapa, actor_var sigue copiando la columna como antes", {
  data <- .padron_profesores()[1:2, ]
  out <- monitoreo_apply_source_dimension_vars(data, list(actor_var = "Modalidad docente"))
  expect_identical(out$dim_actor, c("CENTRUM", "TPA"))
})

test_that("la respuesta toma el público de su fila en el padrón y cruza", {
  data <- .padron_profesores()
  data$dim_actor[[1]] <- "Docentes CENTRUM"
  data$.actor_por_padron <- c(NA, NA, NA, TRUE, TRUE)
  profile <- .perfil_profesores()

  heredada <- monitoreo_heredar_actor_del_padron(data, profile)
  expect_identical(heredada$dim_actor[4:5], c("Docentes CENTRUM", "Docentes Campus"))

  casos <- .casos_df(.monitoreo_acreditacion_internal_queries(data, profile)$cases)
  centrum <- casos[casos$response_id == "r-centrum", , drop = FALSE]
  expect_equal(centrum$actor, "Docentes CENTRUM")
  expect_equal(centrum$advancement, "effective")
})

test_that("sin la marca de la fuente, la guarda entre públicos sigue: no cruza", {
  data <- .padron_profesores()
  data$dim_actor[[1]] <- "Docentes CENTRUM"
  profile <- .perfil_profesores()
  casos <- .casos_df(.monitoreo_acreditacion_internal_queries(data, profile)$cases)
  centrum <- casos[casos$response_id == "r-centrum", , drop = FALSE]
  expect_equal(centrum$base_result, "Sin cruce")
})

test_that("una fuente con actor_por_padron marca sus filas aunque no declare columnas", {
  out <- monitoreo_apply_source_dimension_vars(.padron_profesores()[4:5, ], list(actor_por_padron = TRUE))
  expect_true(all(out$.actor_por_padron))
})

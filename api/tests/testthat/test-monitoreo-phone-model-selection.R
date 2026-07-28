# Selección explícita Modelo -> Teléfono (ADR 0045).
#
# La frontera probada es el reporte público `phone_summary`: no basta con
# filtrar la tarjeta de resumen si cuotas, conciliación o alertas siguen viendo
# actores deshabilitados. El producto telefónico autónomo conserva su universo.

.iter66_phone_unit <- function(id, actor, enabled, label = actor) {
  list(
    id = id,
    type = "actor",
    actor = actor,
    label = label,
    phone = list(enabled = enabled, role = if (enabled) "target" else "none")
  )
}

.iter66_phone_fixture <- function(source_phone_actors = character(0)) {
  actor_values <- c("Egresados", "Egresados", "Docentes", "Docentes", "", "Egresados", "Docentes", "")
  data.frame(
    CodPulso = c("E1", "E2", "D1", "D1", "X1", "E1", "D1", "X1"),
    cv_id = c("", "", "", "", "", "E1", "D1", "X1"),
    Status = c("Efectivo", "No contesta", "Efectivo", "No barrido", "Efectivo", "", "", ""),
    response_status = c("", "", "", "", "", "completed", "completed", "completed"),
    Responsable = c("Ana", "Ana", "Luis", "Luis", "Fantasma", "", "", ""),
    Fecha = c(
      "2026-07-01", "2026-07-02", "2026-07-01", "2026-07-02",
      "2026-07-03", "2026-07-01", "2026-07-01", "2026-07-03"
    ),
    Intentos = c(1, 3, 1, 0, 1, NA, NA, NA),
    Distrito = c("Lima", "Callao", "Centro", "Centro", "Norte", "Lima", "Centro", "Norte"),
    telefono = c("900000001", "900000002", "900000003", "900000003", "900000005", "", "", ""),
    total_time = c(NA, NA, NA, NA, NA, 360, 420, 480),
    dim_actor = actor_values,
    dim_canal = ifelse(
      actor_values %in% source_phone_actors,
      "Telefonico",
      ifelse(nzchar(actor_values), "Correo", "Telefonico")
    ),
    .source_role = c(rep("barrido", 5), rep("respuestas", 3)),
    .source_label = c(
      "Barrido telefónico - Egresados",
      "Barrido telefónico - Egresados",
      "Barrido telefónico - Docentes",
      "Barrido telefónico - Docentes",
      "Barrido telefónico con teléfono pero sin actor",
      "Encuesta Egresados",
      "Encuesta Docentes",
      "Encuesta telefónica sin actor"
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.iter68_source_phone_fixture <- function() {
  data.frame(
    CodPulso = c("S1", "S2", "E1", "E2", "A1", "A2", "D1", "D2"),
    cv_id = "",
    Status = c(
      "Efectivo", "Efectivo", "Efectivo", "No contesta",
      "Efectivo", "Efectivo", "Efectivo", "Efectivo"
    ),
    response_status = "",
    Responsable = c("Sara", "Sara", "Elena", "Elena", "Ana", "Ana", "Diego", "Diego"),
    Fecha = "2026-07-01",
    Intentos = c(1, 1, 1, 3, 1, 1, 1, 1),
    Distrito = "Lima",
    telefono = sprintf("90000000%d", seq_len(8)),
    total_time = NA_real_,
    dim_actor = c(
      "Estudiantes", "Estudiantes", "Egresados", "Egresados",
      "Administrativos", "Administrativos", "Docentes", "Docentes"
    ),
    dim_canal = c(
      "Ficha QR", "Ficha QR", "Telefónico", "Telefonico",
      "Correo", "Correo", "Enlace", "Enlace personalizado"
    ),
    .source_role = "barrido",
    .source_label = c(
      rep("Encuesta Estudiantes QR", 2),
      rep("Barrido telefónico Egresados", 2),
      rep("Encuesta Administrativos Correo", 2),
      rep("Encuesta Docentes Enlace", 2)
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.iter68_source_phone_reports <- function(profile) {
  data <- .iter68_source_phone_fixture()
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = profile,
    control_vars = "dim_actor",
    duration_var = "total_time",
    valid_statuses = "completed"
  ), data)
  monitoreo_acreditacion_reportes(
    data,
    cfg,
    report_scope = "phone_summary",
    cached_reports = list()
  )
}

.iter66_phone_reports <- function(source_phone_actors = character(0),
                                  family = "acreditacion",
                                  egresados_label = "Graduados visibles",
                                  include_units = TRUE,
                                  cached_queries = NULL,
                                  model_enabled = source_phone_actors) {
  data <- .iter66_phone_fixture(source_phone_actors)
  units <- list(
    .iter66_phone_unit("egresados", "Egresados", "Egresados" %in% model_enabled, egresados_label),
    .iter66_phone_unit("docentes", "Docentes", "Docentes" %in% model_enabled, "Docentes visibles"),
    .iter66_phone_unit("campo", "Campo", "Campo" %in% model_enabled, "Campo visible")
  )
  profile <- list(
    family = family,
    variant = "multi_actor",
    key_rules = list(
      universe_fields = "CodPulso",
      response_fields = "cv_id",
      automatic_detection = FALSE
    ),
    alerts = list(unassigned_cases_min = 1L, no_sweep_min_cases = 1L, no_sweep_pct = 0)
  )
  if (isTRUE(include_units)) profile$units <- units
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = profile,
    control_vars = "Distrito",
    goals = list(
      list(filters = list(Actor = "Egresados", Distrito = "Lima"), meta = 1L),
      list(filters = list(Actor = "Docentes", Distrito = "Centro"), meta = 2L)
    ),
    duration_var = "total_time",
    valid_statuses = "completed"
  ), data)
  cached_reports <- if (is.null(cached_queries)) list() else list(internal_queries = cached_queries)
  monitoreo_acreditacion_reportes(
    data,
    cfg,
    report_scope = "phone_summary",
    cached_reports = cached_reports
  )
}

.iter66_sheet <- function(reports, id) {
  matches <- Filter(function(sheet) identical(sheet$id %||% "", id), reports$sheets %||% list())
  if (length(matches)) matches[[1L]] else list(blocks = list())
}

.iter66_blocks <- function(reports, sheet_id = "monitoreo_telefonico") {
  blocks <- .iter66_sheet(reports, sheet_id)$blocks %||% list()
  stats::setNames(blocks, vapply(blocks, function(block) block$id %||% "", character(1)))
}

.iter66_rows <- function(blocks, id) {
  block <- blocks[[id]] %||% list(rows = list())
  .monitoreo_internal_records_to_df(block$rows %||% list())
}

.iter66_total <- function(reports) {
  rows <- .iter66_rows(.iter66_blocks(reports), "resumen_telefonico")
  as.integer(rows$Casos[rows$Indicador == "Total telefónico"][[1L]])
}

.iter66_actor_values <- function(reports) {
  blocks <- .iter66_blocks(reports)
  ids <- intersect(
    names(blocks),
    c(
      "cuotas_variable", "control_tiempo_kobo", "avance_efectivo_actor_dia",
      "operacion_responsable", "campo_vs_plataforma_responsable",
      "estatus_responsable", "no_barridos_responsable"
    )
  )
  unique(as.character(unlist(lapply(ids, function(id) {
    rows <- .iter66_rows(blocks, id)
    if ("Actor" %in% names(rows)) as.character(rows$Actor) else character(0)
  }), use.names = FALSE)))
}

test_that("Fuentes gobierna Teléfono con units ausente o vacío en perfiles legacy y v2", {
  profiles <- list(
    legacy = list(family = "acreditacion", units = list()),
    v2_vacio = list(
      schema_version = "monitoreo_profile_v2",
      family = "acreditacion",
      units = list()
    )
  )

  for (case in profiles) {
    reports <- .iter68_source_phone_reports(case)

    expect_identical(.iter66_total(reports), 2L)
    expect_setequal(.iter66_actor_values(reports), "Egresados")
  }
})

test_that("Correo, Ficha QR y Enlace no entran al alcance telefónico acreditación", {
  reports <- .iter68_source_phone_reports(list(
    schema_version = "monitoreo_profile_v2",
    family = "acreditacion",
    units = list(.iter66_phone_unit("graduados", "Graduados", TRUE))
  ))

  expect_identical(.iter66_total(reports), 2L)
  expect_setequal(.iter66_actor_values(reports), "Egresados")
})

test_that("Acreditación sin canal telefónico en Fuentes queda factual y completamente vacía", {
  reports <- .iter66_phone_reports(character(0))
  blocks <- .iter66_blocks(reports)
  alerts <- .iter66_rows(.iter66_blocks(reports, "alertas"), "alertas")

  expect_identical(.iter66_total(reports), 0L)
  expect_equal(nrow(.iter66_rows(blocks, "estatus_telefonico")), 0L)
  expect_equal(nrow(.iter66_rows(blocks, "cuotas_variable")), 0L)
  expect_false(any(.monitoreo_report_nonempty(alerts$CodPulso %||% "")))
  expect_false(any(.monitoreo_report_nonempty(alerts$Responsable %||% "")))
})

test_that("Acreditación filtra por canal de Fuentes y no por units, label ni apariencia", {
  selected <- .iter66_phone_reports(
    "Egresados",
    egresados_label = "Nombre visible renombrado",
    model_enabled = c("Docentes", "Campo")
  )
  renamed <- .iter66_phone_reports(
    "Egresados",
    egresados_label = "Otra etiqueta editable",
    model_enabled = character(0)
  )
  blocks <- .iter66_blocks(selected)
  ops <- .iter66_rows(blocks, "operacion_responsable")
  assigned <- .iter66_rows(blocks, "responsables_barrido")
  alerts <- .iter66_rows(.iter66_blocks(selected, "alertas"), "alertas")

  expect_identical(.iter66_total(selected), 2L)
  expect_identical(.iter66_total(renamed), 2L)
  expect_setequal(.iter66_actor_values(selected), "Egresados")
  expect_setequal(.iter66_actor_values(renamed), "Egresados")
  expect_equal(sum(ops$`Casos asignados`), 2L)
  expect_false(any(grepl("D1|X1", assigned$`CodPulso asignados` %||% "")))
  expect_false(any((alerts$CodPulso %||% "") %in% c("D1", "X1")))
  expect_false(any((alerts$Responsable %||% "") %in% c("Luis", "Fantasma")))
})

test_that("actor estable Campo no captura filas sin actor por normalización vacía", {
  reports <- .iter66_phone_reports(character(0), model_enabled = "Campo")

  expect_identical(.iter66_total(reports), 0L)
  expect_length(.iter66_actor_values(reports), 0L)
})

test_that("Acreditación no reexpone consultas internas globales desde caché telefónico", {
  cached_queries <- list(cases = list(
    list(Actor = "Docentes", CodPulso = "D1"),
    list(Actor = "Sin actor", CodPulso = "X1")
  ))

  expect_identical(
    .iter66_phone_reports(character(0), cached_queries = cached_queries)$internal_queries,
    list()
  )
  expect_identical(
    .iter66_phone_reports("Egresados", cached_queries = cached_queries)$internal_queries,
    list()
  )
})

test_that("Acreditación con N canales telefónicos en Fuentes produce la unión exacta", {
  reports <- .iter66_phone_reports(
    c("Egresados", "Docentes"),
    model_enabled = character(0)
  )
  blocks <- .iter66_blocks(reports)
  ops <- .iter66_rows(blocks, "operacion_responsable")
  quotas <- .iter66_rows(blocks, "cuotas_variable")
  alerts <- .iter66_rows(.iter66_blocks(reports, "alertas"), "alertas")

  expect_identical(.iter66_total(reports), 4L)
  expect_setequal(.iter66_actor_values(reports), c("Egresados", "Docentes"))
  expect_equal(sum(ops$`Casos asignados`), 4L)
  expect_true(all(quotas$Actor %in% c("Egresados", "Docentes")))
  expect_true(any((alerts$CodPulso %||% "") == "D1"))
  expect_false(any((alerts$CodPulso %||% "") == "X1"))
  expect_false(any((alerts$Responsable %||% "") == "Fantasma"))
})

test_that("producto Telefónico autónomo conserva el universo legacy", {
  no_units <- .iter66_phone_reports(character(0), family = "telefonico", include_units = FALSE)
  disabled_units <- .iter66_phone_reports(c("ninguno"), family = "telefonico")

  expect_identical(.iter66_total(no_units), 5L)
  expect_identical(.iter66_total(disabled_units), 5L)
})

test_that("producto Telefónico autónomo conserva consultas internas cacheadas", {
  cached_queries <- list(cases = list(list(Actor = "Legacy", CodPulso = "L1")))
  reports <- .iter66_phone_reports(
    character(0),
    family = "telefonico",
    include_units = FALSE,
    cached_queries = cached_queries
  )

  expect_identical(reports$internal_queries, cached_queries)
})

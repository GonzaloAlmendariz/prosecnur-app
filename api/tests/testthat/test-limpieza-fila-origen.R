# Identidad de los casos fijada sobre el archivo recibido, antes del filtro de
# caso válido (E1 y E8 de la revisión metodológica de M2).
#
# La auditoría lee la base con el criterio de caso válido y la limpieza la
# relee sin él (los casos fuera del universo siguen en la base limpia). Con
# casos identificados por número de fila, la fila N de una no era la fila N de
# la otra y la exclusión caía en otra persona. Ahora cada fila conserva su
# número en el archivo recibido y los dos lados cruzan por él.

.fo_cfg_sin_c02 <- function() {
  # p21 != 2 deja fuera solo a C02 (fila 2).
  normalize_validation_operational_config(list(version = 2L,
    caso_valido = list(enabled = TRUE, condiciones = list(
      list(variable = "p21", operador = "!=", valores = list("2"))))))
}

# Sesión con la base de M1 sin columna candidata (casos por número de fila),
# caso válido declarado y la regla de edad 16 a 25 auditada.
.fo_sesion_por_fila <- function(dir, datos = NULL, caso_valido = TRUE) {
  d <- datos %||% { x <- .m1_datos(); x$respondent_id <- NULL; x }
  sid <- .m1_sesion(dir, datos_personas = d)
  if (caso_valido) validacion_scope_set(sid, "Personas", "operational_config", .fo_cfg_sin_c02())
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_edad()))
  .m2_auditar(sid, "Personas")
  list(sid = sid, datos = d)
}

.fo_excluir_regla <- function(sid, base = "Personas", source_id = "RC_001") {
  scope <- validacion_scope_get(sid, base)
  up <- .limpieza_upsert_decision(list(), list(source_id = source_id, action_type = "exclude_cases",
                                               status = "ready", rationale = "x"), scope = scope)
  validacion_scope_set(sid, base, "limpieza_draft", up$decisions)
  up$decisions
}

test_that("E1: la exclusión de la regla entera sale del caso que marcó la auditoría", {
  dir <- withr::local_tempdir()
  ctx <- .fo_sesion_por_fila(dir)
  withr::defer(session_delete(ctx$sid))
  scope <- validacion_scope_get(ctx$sid, "Personas")
  mapa <- .limpieza_rule_case_map(scope$evaluacion, "RC_001")
  aud <- scope$evaluacion$datos_tablas$principal
  marcados <- aud$caso[mapa$row_idx]
  expect_identical(marcados, c("C01", "C04", "C08"))
  # El id es la fila en el archivo recibido, no la posición tras el filtro.
  expect_identical(mapa$case_ids, c("principal::row::1", "principal::row::4", "principal::row::8"))

  decs <- .fo_excluir_regla(ctx$sid)
  sim <- .limpieza_simulate(ctx$sid, "Personas", validacion_scope_get(ctx$sid, "Personas"), decs)
  expect_setequal(setdiff(ctx$datos$caso, sim$data_final$caso), marcados)
  expect_false(".__fila_origen__" %in% names(sim$data_final))
})

test_that("E1: una exclusión explícita por número de fila sale de esa misma fila", {
  dir <- withr::local_tempdir()
  ctx <- .fo_sesion_por_fila(dir)
  withr::defer(session_delete(ctx$sid))
  scope <- validacion_scope_get(ctx$sid, "Personas")
  up <- .limpieza_upsert_decision(list(), list(source_id = "RC_001", action_type = "exclude_cases",
          target_case_ids = list("principal::row::4"), status = "ready", rationale = "x"), scope = scope)
  expect_identical(up$decision$identificacion_casos$numeracion, "fila_de_origen")
  validacion_scope_set(ctx$sid, "Personas", "limpieza_draft", up$decisions)
  sim <- .limpieza_simulate(ctx$sid, "Personas", validacion_scope_get(ctx$sid, "Personas"), up$decisions)
  expect_identical(setdiff(ctx$datos$caso, sim$data_final$caso), "C04")
  a <- .limpieza_decisiones_con_aplicabilidad(up$decisions, validacion_scope_get(ctx$sid, "Personas"))
  expect_true(a[[1]]$aplicable)
})

test_that("E1: el id de la cola, del detalle de la regla y de GET /caso es el mismo para la misma fila", {
  dir <- withr::local_tempdir()
  ctx <- .fo_sesion_por_fila(dir)
  withr::defer(session_delete(ctx$sid))
  pr <- .m1_router()
  r <- .m1_http(pr, ctx$sid, "POST", "/api/validacion/v2/instrumento/regla",
                body = '{"id_regla":"RC_001","base_nombre":"Personas"}')
  expect_identical(r$status, 200L)
  ids_detalle <- unlist(r$body$case_ids)
  ids_cola <- .m2_ids_marcados(ctx$sid, "Personas", "RC_001")
  expect_identical(ids_detalle, ids_cola)
  for (k in seq_along(ids_cola)) {
    rc <- .m1_http(pr, ctx$sid, "GET", "/api/validacion/v2/caso",
                   query = paste0("base_nombre=Personas&id=", utils::URLencode(ids_cola[k], reserved = TRUE)))
    expect_identical(rc$status, 200L)
    vars <- unlist(lapply(rc$body$secciones, `[[`, "variables"), recursive = FALSE)
    caso <- Filter(function(v) identical(v$variable, "caso"), vars)[[1]]$valor
    expect_identical(caso, c("C01", "C04", "C08")[k])
  }
})

test_that("el detalle de la regla da el id de la cola aunque la columna candidata tenga vacíos", {
  dir <- withr::local_tempdir()
  d <- .m1_datos(); d$respondent_id[4] <- ""   # C04, marcado por la edad
  sid <- .m1_sesion(dir, datos_personas = d)
  withr::defer(session_delete(sid))
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_edad()))
  .m2_auditar(sid, "Personas")
  ids_cola <- .m2_ids_marcados(sid, "Personas", "RC_001")
  expect_true("principal::row::4" %in% ids_cola)
  r <- .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/instrumento/regla",
                body = '{"id_regla":"RC_001","base_nombre":"Personas"}')
  expect_identical(unlist(r$body$case_ids), ids_cola)
})

test_that("E8: antes, excluidos y después se cuentan sobre la misma base y cuadran", {
  dir <- withr::local_tempdir()
  ctx <- .fo_sesion_por_fila(dir, datos = .m1_datos())   # con respondent_id
  withr::defer(session_delete(ctx$sid))
  scope0 <- validacion_scope_get(ctx$sid, "Personas")
  # Sin decisiones listas la vista previa no relee el archivo y la cuenta es la misma.
  sim0 <- .limpieza_simulate(ctx$sid, "Personas", scope0, list())
  expect_identical(sim0$before$filas_base, 10L)
  expect_identical(sim0$before$filas_evaluadas, 9L)
  expect_identical(sim0$before$filas_fuera_universo, 1L)

  decs <- .fo_excluir_regla(ctx$sid)
  sim <- .limpieza_simulate(ctx$sid, "Personas", validacion_scope_get(ctx$sid, "Personas"), decs)
  expect_identical(sim$before$filas_base, 10L)
  expect_identical(sim$before$filas_evaluadas, 9L)
  expect_identical(sim$before$filas_fuera_universo, 1L)
  expect_identical(sim$impact$cases_excluded, 3L)
  expect_identical(sim$before$filas_base - sim$impact$cases_excluded, sim$after$filas_base)
  # ADR 0075: el caso fuera del universo sigue en la base limpia.
  expect_true("C02" %in% sim$data_final$caso)
  # El después se evalúa sobre el mismo universo que el antes.
  expect_identical(sim$after$filas_evaluadas, 6L)
})

# --- Compatibilidad: decisiones guardadas con la numeración anterior ---------

.fo_decision_vieja <- function(ids, marca = list(metodo = "anterior", columna = "posicion")) {
  d <- list(id = "PD_001", source_id = "RC_001", action_type = "exclude_cases",
            target_case_ids = as.list(ids), status = "ready", rationale = "Vieja",
            created_at = "2026-11-01T00:00:00Z", updated_at = "2026-11-01T00:00:00Z")
  if (!is.null(marca)) d$identificacion_casos <- marca
  d
}

test_that("una decisión por número de fila de la numeración anterior no se redirige: queda no aplicable", {
  dir <- withr::local_tempdir()
  ctx <- .fo_sesion_por_fila(dir)
  withr::defer(session_delete(ctx$sid))
  # Guardada cuando la fila 3 de la auditoría (filtrada) era C04; en el archivo
  # recibido la fila 3 es C03. No se sabe a quién apunta.
  for (marca in list(list(metodo = "anterior", columna = "posicion"), NULL)) {
    d <- .fo_decision_vieja("principal::row::3", marca)
    validacion_scope_set(ctx$sid, "Personas", "limpieza_draft", list(d))
    scope <- validacion_scope_get(ctx$sid, "Personas")
    a <- .limpieza_decisiones_con_aplicabilidad(list(d), scope)
    expect_false(a[[1]]$aplicable)
    expect_identical(a[[1]]$motivo_no_aplicable, "numeracion_anterior")
    sim <- .limpieza_simulate(ctx$sid, "Personas", scope, list(d))
    expect_identical(sim$impact$cases_excluded, 0L)
    expect_identical(nrow(sim$data_final), 10L)
    expect_true(any(grepl("PD_001 no se aplica", sim$logs$warnings, fixed = TRUE)))
  }

  # Lo mismo después de guardar y abrir el .pulso.
  validacion_scope_set(ctx$sid, "Personas", "limpieza_draft", list(.fo_decision_vieja("principal::row::3")))
  ruta <- file.path(dir, "vieja.pulso")
  build_pulso(ctx$sid, ruta)
  sid2 <- suppressMessages(load_pulso(ruta))$session_id
  withr::defer(session_delete(sid2))
  b <- build_limpieza(validacion_scope_get(sid2, "Personas"), sid = sid2, base_nombre = "Personas")
  expect_false(b$decision_draft[[1]]$aplicable)
  expect_identical(b$decision_draft[[1]]$motivo_no_aplicable, "numeracion_anterior")
  expect_identical(b$before_after_preview$impact$cases_excluded, 0L)
})

test_that("sin filas filtradas, una decisión por número de fila de antes afecta a la misma fila", {
  dir <- withr::local_tempdir()
  ctx <- .fo_sesion_por_fila(dir, caso_valido = FALSE)
  withr::defer(session_delete(ctx$sid))
  for (marca in list(list(metodo = "anterior", columna = "posicion"), NULL)) {
    d <- .fo_decision_vieja("principal::row::4", marca)
    scope <- validacion_scope_get(ctx$sid, "Personas")
    expect_true(.limpieza_decisiones_con_aplicabilidad(list(d), scope)[[1]]$aplicable)
    sim <- .limpieza_simulate(ctx$sid, "Personas", scope, list(d))
    expect_identical(setdiff(ctx$datos$caso, sim$data_final$caso), "C04")
  }
})

test_that("una auditoría guardada antes de la fila de origen no lleva la regla entera a otra fila", {
  dir <- withr::local_tempdir()
  ctx <- .fo_sesion_por_fila(dir)
  withr::defer(session_delete(ctx$sid))
  scope <- validacion_scope_get(ctx$sid, "Personas")
  # La auditoría de antes no traía la columna de la fila de origen.
  ev <- scope$evaluacion
  ev$datos_tablas <- lapply(ev$datos_tablas, function(t) { t$`.__fila_origen__` <- NULL; t })
  ev$datos <- ev$datos_tablas$principal
  ev$caso_valido_filter <- NULL
  validacion_scope_set(ctx$sid, "Personas", "evaluacion", ev)
  decs <- .fo_excluir_regla(ctx$sid)
  scope <- validacion_scope_get(ctx$sid, "Personas")
  a <- .limpieza_decisiones_con_aplicabilidad(decs, scope)
  expect_false(a[[1]]$aplicable)
  expect_identical(a[[1]]$motivo_no_aplicable, "auditoria_sin_fila_de_origen")
  sim <- .limpieza_simulate(ctx$sid, "Personas", scope, decs)
  expect_identical(sim$impact$cases_excluded, 0L)
  expect_true(any(grepl("vuelve a correr la auditoría", sim$logs$warnings, fixed = TRUE)))
})

test_that("la lectura numera las filas antes de filtrar y solo en la tabla principal", {
  dir <- withr::local_tempdir()
  xls <- file.path(dir, "formulario.xlsx")
  openxlsx::write.xlsx(list(survey = .m1_survey(),
                            choices = data.frame(list_name = "p4", name = c("1", "2"), label = c("Sí", "No"))), xls)
  inst <- leer_xlsform_limpieza(xls, verbose = FALSE)
  datos <- file.path(dir, "base.xlsx")
  openxlsx::write.xlsx(list(datos = .m1_datos()), datos)
  ctx <- read_validation_data_ast(datos, "xlsx", instrumento = inst,
                                  operational_config = .fo_cfg_sin_c02())
  expect_identical(ctx$principal$`.__fila_origen__`, c(1L, 3:10))
  expect_identical(ctx$caso_valido_filter$excluded_rows, 1L)
  # La hoja original queda como copia sin filtrar de la principal.
  expect_identical(ctx$tables$datos$`.__fila_origen__`, 1:10)
})

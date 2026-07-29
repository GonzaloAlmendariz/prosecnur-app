# =============================================================================
# Fuente del Dashboard diferida (unidad 3.2 del plan de performance 2026-07)
# =============================================================================
# Cubre el contrato completo del cambio:
#   1. load_pulso ya NO reconstruye los caches inline (el open no paga 1-5 s).
#   2. El paso "dashboard" del warmup los reconstruye y el merge del
#      session_patch deja la sesión viva tan caliente como el open de antes.
#   3. Fallback lazy: sin warmup (cliente viejo/headless), el primer uso del
#      dashboard reconstruye sobre la sesión viva.
#   4. Ventana de carrera: un GET del dashboard con caches fríos y fuente
#      irrecuperable responde el estado tolerante de siempre, nunca error;
#      y el merge descarta patches desactualizados.

.dfw_xlsx_bytes <- function(sheets) {
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  for (sheet_name in names(sheets)) {
    openxlsx::addWorksheet(wb, sheet_name)
    openxlsx::writeData(wb, sheet_name, sheets[[sheet_name]])
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  on.exit(unlink(path, force = TRUE), add = TRUE)
  readBin(path, "raw", n = file.info(path)$size)
}

# Sesión con fuente REAL del dashboard (XLSForm parseable + data compatible),
# importada por el camino oficial y guardada a un .pulso. Devuelve el path
# listo para load_pulso.
.dfw_proyecto_con_fuente <- function() {
  sid <- session_create()
  survey <- data.frame(
    type = c("select_one lst_sexo", "integer"),
    name = c("sexo", "edad"),
    label = c("Sexo", "Edad"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("lst_sexo", "lst_sexo"),
    name = c("1", "2"),
    label = c("Hombre", "Mujer"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  data_df <- data.frame(
    sexo = c("1", "2", "1", "2"),
    edad = c(31L, 42L, 27L, 55L),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  xm <- save_upload(sid, "xlsform", "inst_dashboard.xlsx",
                    .dfw_xlsx_bytes(list(survey = survey, choices = choices)))
  dm <- save_upload(sid, "data", "data_dashboard.xlsx",
                    .dfw_xlsx_bytes(list(data = data_df)))
  src <- .dashboard_import_source(
    sid,
    list(xlsform_file_id = xm$file_id, data_file_id = dm$file_id)
  )
  stopifnot(isTRUE(src$ready))
  tmp <- tempfile(fileext = ".pulso")
  build_pulso(sid, tmp)
  session_delete(sid)
  tmp
}

test_that("load_pulso ya no reconstruye la fuente del dashboard inline", {
  pulso <- .dfw_proyecto_con_fuente()
  on.exit(unlink(pulso, force = TRUE), add = TRUE)

  res <- load_pulso(pulso)
  on.exit(session_delete(res$session_id), add = TRUE)

  # El contrato del payload del open no cambia (frontend: bootClient.ts /
  # workspace.ts consumen ok + session_id + project_path + manifest).
  expect_true(isTRUE(res$ok))
  expect_true(is.character(res$session_id) && nzchar(res$session_id))
  expect_true(is.character(res$project_path) && nzchar(res$project_path))
  expect_true(is.list(res$manifest))

  s <- session_get(res$session_id)
  # Los caches quedan fríos y la reconstrucción queda declarada pendiente.
  expect_null(s$dashboard_rp_inst)
  expect_null(s$dashboard_rp_data)
  expect_true(.dashboard_fuente_pendiente(s))
  expect_true(isTRUE(s$dashboard_source$ready))
  # Abrir no ensucia el proyecto (el rebuild inline de antes dejaba
  # dirty=TRUE por accidente vía session_set).
  expect_false(isTRUE(s$project_dirty))
})

test_that("el paso dashboard del warmup reconstruye y el merge deja la sesión caliente", {
  pulso <- .dfw_proyecto_con_fuente()
  on.exit(unlink(pulso, force = TRUE), add = TRUE)
  res <- load_pulso(pulso)
  sid <- res$session_id
  on.exit(session_delete(sid), add = TRUE)
  s_cold <- session_get(sid)

  result <- .project_warmup_run(sid, budget_ms = 60000, modules = "dashboard")
  task <- Filter(function(t) identical(t$id, "dashboard"), result$tasks)[[1]]
  expect_identical(task$status, "ready")
  expect_true(isTRUE(task$details$fuente_pending))
  expect_true(isTRUE(task$details$fuente_rebuilt))
  # Timing observable: el costo del rebuild queda citable en el item.
  expect_true(is.numeric(task$details$fuente_elapsed_ms))

  patch <- result$session_patch$dashboard
  expect_true(is.list(patch$dashboard_rp_inst))
  expect_true(is.data.frame(patch$dashboard_rp_data))
  expect_true(is.list(patch$dashboard_source))

  # En producción el run ocurre en un worker callr sobre una COPIA de la
  # sesión: la sesión viva sigue fría hasta el on_complete. Emularlo.
  .session_env[[sid]] <- s_cold
  expect_true(.dashboard_fuente_pendiente(session_get(sid)))

  out <- .project_warmup_on_complete(list(sid = sid, result_data = result))
  expect_null(out$session_patch)

  s_warm <- session_get(sid)
  expect_false(.dashboard_fuente_pendiente(s_warm))
  expect_true(is.data.frame(s_warm$dashboard_rp_data))
  expect_true(is.list(s_warm$dashboard_rp_inst))
  # El merge del warmup no marca el proyecto como editado.
  expect_false(isTRUE(s_warm$project_dirty))
  # Y el dashboard queda tan caliente como con el open de antes.
  manifest <- .dashboard_manifest(s_warm)
  expect_true(isTRUE(manifest$estado$tiene_data))
})

test_that("fallback lazy: sin warmup, el primer uso del dashboard reconstruye", {
  pulso <- .dfw_proyecto_con_fuente()
  on.exit(unlink(pulso, force = TRUE), add = TRUE)
  res <- load_pulso(pulso)
  sid <- res$session_id
  on.exit(session_delete(sid), add = TRUE)

  expect_true(.dashboard_fuente_pendiente(session_get(sid)))

  # Primer uso real (GET /api/dashboard/manifest pasa por .dashboard_ctx).
  manifest <- .dashboard_manifest(session_get(sid))
  expect_true(isTRUE(manifest$estado$tiene_data))
  resumen <- Filter(function(t) identical(t$id, "resumen"), manifest$tabs)[[1]]
  expect_true(isTRUE(resumen$available))

  s_after <- session_get(sid)
  expect_false(.dashboard_fuente_pendiente(s_after))
  expect_true(is.data.frame(s_after$dashboard_rp_data))
  # Un GET no ensucia el proyecto.
  expect_false(isTRUE(s_after$project_dirty))

  # Con la sesión caliente, los payloads responden con datos.
  kpis <- .dashboard_resumen_kpis(session_get(sid), list())
  expect_true(is.list(kpis))
})

test_that("ventana de carrera: caches fríos con fuente irrecuperable responden tolerable, nunca error", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  # Bytes basura: la fuente existe como referencia pero no es parseable
  # (mismo escenario que un fixture anonimizado sin files/ del dashboard).
  zip_stub <- as.raw(c(0x50, 0x4B, 0x03, 0x04, 0x00, 0x00, 0x00))
  xm <- save_upload(sid, "xlsform", "inst_rota.xlsx", zip_stub)
  dm <- save_upload(sid, "data", "data_rota.xlsx", zip_stub)
  s <- session_get(sid)
  s$dashboard_source <- list(
    ready = TRUE,
    xlsform_file_id = xm$file_id,
    data_file_id = dm$file_id
  )
  .session_env[[sid]] <- s

  s <- session_get(sid)
  expect_true(.dashboard_fuente_pendiente(s))

  # Los tres GET típicos del dashboard: el estado tolerante de siempre.
  expect_no_error({
    kpis <- .dashboard_resumen_kpis(session_get(sid), list())
    seccion <- .dashboard_resumen_payload(session_get(sid), "cualquiera", list())
    manifest <- .dashboard_manifest(session_get(sid))
  })
  expect_identical(kpis, list())
  expect_identical(seccion$rows, list())
  expect_false(isTRUE(manifest$estado$tiene_data))
  resumen <- Filter(function(t) identical(t$id, "resumen"), manifest$tabs)[[1]]
  expect_false(isTRUE(resumen$available))
  expect_identical(resumen$reason, "Carga la base y el instrumento primero.")

  # La memoria de fallos evita reimportar en cada request: la segunda pasada
  # no vuelve a invocar .dashboard_import_source.
  env <- environment(.dashboard_fuente_rebuild)
  original <- get(".dashboard_import_source", envir = env)
  was_locked <- bindingIsLocked(".dashboard_import_source", env)
  if (was_locked) unlockBinding(".dashboard_import_source", env)
  llamadas <- 0L
  assign(".dashboard_import_source", function(...) {
    llamadas <<- llamadas + 1L
    original(...)
  }, envir = env)
  on.exit({
    if (bindingIsLocked(".dashboard_import_source", env)) {
      unlockBinding(".dashboard_import_source", env)
    }
    assign(".dashboard_import_source", original, envir = env)
    if (was_locked) lockBinding(".dashboard_import_source", env)
  }, add = TRUE)
  invisible(.dashboard_manifest(session_get(sid)))
  expect_identical(llamadas, 0L)
})

test_that("el merge del warmup descarta el patch si la fuente cambió y aplica si coincide", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$project_path <- tempfile(fileext = ".pulso")
  s$project_dirty <- FALSE
  s$dashboard_source <- list(
    ready = TRUE,
    xlsform_file_id = "fid-xls-a",
    data_file_id = "fid-data-a"
  )
  .session_env[[sid]] <- s

  patch <- list(dashboard = list(
    dashboard_rp_inst = list(survey = data.frame(name = "x", type = "text")),
    dashboard_rp_data = data.frame(x = 1),
    dashboard_source = list(
      ready = TRUE,
      xlsform_file_id = "fid-xls-OTRA",
      data_file_id = "fid-data-a"
    )
  ))

  # Fuente distinta (el usuario re-importó durante el warmup): descartado.
  expect_false(.project_warmup_merge_session_patch(sid, patch))
  expect_null(session_get(sid)$dashboard_rp_data)

  # Misma fuente y sesión fría: aplica sin ensuciar el proyecto.
  patch$dashboard$dashboard_source$xlsform_file_id <- "fid-xls-a"
  expect_true(.project_warmup_merge_session_patch(sid, patch))
  expect_true(is.data.frame(session_get(sid)$dashboard_rp_data))
  expect_false(isTRUE(session_get(sid)$project_dirty))

  # Sesión ya caliente (ganó el fallback lazy): el patch tardío se descarta
  # sin pisar lo vigente.
  s_hot <- session_get(sid)
  s_hot$dashboard_rp_data <- data.frame(x = 99)
  .session_env[[sid]] <- s_hot
  patch$dashboard$dashboard_rp_data <- data.frame(x = 1)
  expect_false(.project_warmup_merge_session_patch(sid, patch))
  expect_identical(session_get(sid)$dashboard_rp_data$x, 99)
})

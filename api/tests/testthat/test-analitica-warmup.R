# Lectura de Analítica en segundo plano tras abrir (2026-10-15, HSyVbG de tres
# bases): la primera `GET /api/analitica/variables` tras abrir el proyecto leía y
# normalizaba las tres bases (~8–12 s). Meterlo en el warm start bloqueante
# cobraba ~18 s a TODA apertura, así que corre como job aparte que arranca al
# cosecharse el warmup y se cosecha solo en el siguiente fallo del memo de
# lectura (analitica_warmup.R). Aquí se fija: (1) el warmup bloqueante no lee
# bases y arranca el job; (2) cosechado, el memo tiene TODAS las bases y ninguna
# lectura posterior relee archivos ni renormaliza; (3) si el job sigue vivo se
# lee sin esperar y lo cosechado después no pisa lo leído; (4) no se instala lo
# de otro código ni lo de otro proyecto; (5) un archivo cambiado se relee, sólo
# esa base.

.aw_write_xlsform <- function(path, survey, choices) {
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", survey)
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", choices)
  openxlsx::addWorksheet(wb, "settings")
  openxlsx::writeData(wb, "settings", data.frame(form_title = "Warmup", stringsAsFactors = FALSE))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
}

.aw_upload <- function(sid, path, kind) {
  save_upload(sid, kind, basename(path), readBin(path, "raw", n = file.info(path)$size))
}

.aw_make_session <- function(bases = c("b2024", "b2025")) {
  sid <- session_create()
  dir <- tempfile("analitica_warmup_")
  dir.create(dir, recursive = TRUE)
  survey <- data.frame(
    type = c("select_one sexo", "select_one acuerdo"),
    name = c("sexo", "p1"),
    label = c("Sexo", "Acuerdo"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c("sexo", "sexo", "acuerdo", "acuerdo", "acuerdo"),
    name = c("1", "2", "1", "2", "3"),
    label = c("Hombre", "Mujer", "Bajo", "Medio", "Alto"),
    stringsAsFactors = FALSE
  )
  data_paths <- list()
  for (i in seq_along(bases)) {
    nombre <- bases[[i]]
    xls <- file.path(dir, paste0(nombre, "_form.xlsx"))
    dat <- file.path(dir, paste0(nombre, "_data.xlsx"))
    .aw_write_xlsform(xls, survey, choices)
    df <- data.frame(
      sexo = rep(c("1", "2"), length.out = 3L + i),
      p1 = rep(c("1", "2", "3"), length.out = 3L + i),
      stringsAsFactors = FALSE
    )
    openxlsx::write.xlsx(list(data = df), file = dat, overwrite = TRUE)
    xu <- .aw_upload(sid, xls, "xlsform")
    du <- .aw_upload(sid, dat, "data")
    inst <- reporte_instrumento(xu$path)
    estudio_add_base(
      sid,
      nombre = nombre,
      xlsform_file_id = xu$file_id,
      data_file_id = du$file_id,
      data_ext = "xlsx",
      rp_data = reporte_data(df, instrumento = inst),
      rp_inst = inst,
      n_filas = nrow(df),
      n_columnas = ncol(df)
    )
    data_paths[[nombre]] <- du$path
  }
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  estudio_active_base_set(sid, bases[[1]])
  list(sid = sid, dir = dir, data_paths = data_paths)
}

# Cuenta lecturas y normalizaciones reales sin cambiar lo que producen.
.aw_count_calls <- function(env = parent.frame()) {
  counts <- new.env(parent = emptyenv())
  counts$read <- 0L
  counts$norm <- 0L
  read_real <- prosecnurapp:::.analitica_read_pair_uncached
  norm_real <- prosecnurapp:::.bases_normalize_report_context
  testthat::local_mocked_bindings(
    .analitica_read_pair_uncached = function(pair, base_meta = NULL) {
      counts$read <- counts$read + 1L
      read_real(pair, base_meta)
    },
    .bases_normalize_report_context = function(data, inst, normalize_other = TRUE) {
      counts$norm <- counts$norm + 1L
      norm_real(data, inst, normalize_other = normalize_other)
    },
    .package = "prosecnurapp",
    .env = env
  )
  counts
}

# Job de lectura simulado: el resultado se produce en este proceso con la misma
# función que corre el worker, y el job se registra como lo haría job_submit.
# El worker deja las bases en un archivo y devuelve su ruta; para los tests que
# manipulan lo leído se trae a `result$payload` (la vía de respaldo de on_complete).
.aw_run_job <- function(sid, por_archivo = FALSE) {
  path <- job_save_rds(sid, "aw_lectura", session_get(sid))
  result <- prosecnurapp:::.analitica_lectura_job(path)
  if (por_archivo) return(result)
  result$payload <- readRDS(result$payload_path)
  unlink(result$payload_path)
  result$payload_path <- NULL
  result
}

.aw_fake_job <- function(sid, result, alive = FALSE) {
  state <- new.env(parent = emptyenv())
  state$alive <- alive
  id <- paste0("aw-", uuid::UUIDgenerate())
  .jobs[[id]] <- list(
    id = id, sid = sid, kind = "analitica.lectura",
    rx = list(is_alive = function() isTRUE(state$alive), get_result = function() result),
    started_at = Sys.time(), finished_at = NULL, status = "running",
    result_path = NULL, progress_path = NULL, result_data = NULL, result_public = NULL,
    on_complete = prosecnurapp:::.analitica_lectura_bg_on_complete,
    on_cleanup = NULL, cleaned = FALSE, error = NULL
  )
  assign(sid, list(job_id = id, project_path = session_get(sid)$project_path),
         envir = prosecnurapp:::.analitica_lectura_bg)
  list(id = id, state = state)
}

.aw_reset <- function(env = parent.frame()) {
  prosecnurapp:::.analitica_lectura_cache_clear()
  bg <- prosecnurapp:::.analitica_lectura_bg
  rm(list = ls(bg, all.names = TRUE), envir = bg)
  withr::defer({
    prosecnurapp:::.analitica_lectura_cache_clear()
    rm(list = ls(bg, all.names = TRUE), envir = bg)
  }, envir = env)
}

test_that("el warmup bloqueante no lee bases y deja arrancado el job de lectura", {
  skip_if_not_installed("openxlsx")
  .aw_reset()
  fx <- .aw_make_session()
  sid <- fx$sid
  withr::defer(session_delete(sid))
  counts <- .aw_count_calls()
  submitted <- list()
  testthat::local_mocked_bindings(
    job_submit = function(sid, kind, func, args = list(), ...) {
      submitted[[length(submitted) + 1L]] <<- list(sid = sid, kind = kind, args = args)
      "job-lectura"
    },
    .package = "prosecnurapp"
  )

  result <- .project_warmup_run(sid, mode = "full", budget_ms = 60000, modules = "analitica")
  expect_equal(counts$read, 0L)
  public <- .project_warmup_on_complete(list(sid = sid, result_data = result))
  expect_identical(public$analitica_lectura_job, "job-lectura")
  expect_length(submitted, 1L)
  expect_identical(submitted[[1]]$kind, "analitica.lectura")
  expect_true(file.exists(submitted[[1]]$args$session_path))
  # Un segundo warmup de la misma sesión no duplica el job pendiente.
  .jobs[["job-lectura"]] <- list(id = "job-lectura", status = "running")
  withr::defer(rm(list = "job-lectura", envir = prosecnurapp:::.jobs))
  expect_identical(prosecnurapp:::.analitica_lectura_bg_start(sid), "job-lectura")
  expect_length(submitted, 1L)

  # Sin el paso de Analítica en el plan, no arranca nada.
  sin <- .project_warmup_run(sid, mode = "full", budget_ms = 60000, modules = "project")
  expect_null(.project_warmup_on_complete(list(sid = sid, result_data = sin))$analitica_lectura_job)
})

test_that("cosechado el job, ninguna base activa relee archivos ni renormaliza", {
  skip_if_not_installed("openxlsx")
  .aw_reset()
  fx <- .aw_make_session()
  sid <- fx$sid
  withr::defer(session_delete(sid))
  counts <- .aw_count_calls()

  result <- .aw_run_job(sid)
  expect_equal(result$n_ready, 2L)
  expect_setequal(vapply(result$bases, `[[`, character(1), "base"), c("b2024", "b2025"))
  # El memo del worker muere con su proceso: el backend parte vacío.
  prosecnurapp:::.analitica_lectura_cache_clear()
  job <- .aw_fake_job(sid, result)
  counts$read <- 0L
  counts$norm <- 0L

  # Nadie consultó el job: lo cosecha el primer fallo del memo.
  for (activa in c("b2025", "b2024")) {
    estudio_active_base_set(sid, activa)
    ctx <- .analitica_prepare_and_cache(sid)
    expect_setequal(names(ctx$data_sources), c("b2024", "b2025"))
    expect_equal(nrow(as.data.frame(ctx$rp_data)), if (activa == "b2025") 5L else 4L)
  }
  expect_equal(counts$read, 0L)
  expect_equal(counts$norm, 0L)
  keys <- ls(prosecnurapp:::.analitica_lectura_cache, all.names = TRUE)
  expect_length(keys, 4L)
  expect_equal(sum(endsWith(keys, "::norm")), 2L)
  # Cosechado: sale de pendientes y el registro de jobs no retiene las bases.
  expect_length(ls(prosecnurapp:::.analitica_lectura_bg), 0L)
  expect_identical(prosecnurapp:::.jobs[[job$id]]$status, "done")
  expect_null(prosecnurapp:::.jobs[[job$id]]$result_data)
  expect_equal(prosecnurapp:::.jobs[[job$id]]$result_public$installed, 2L)
  rm(list = job$id, envir = prosecnurapp:::.jobs)
})

test_that("con el job vivo se lee sin esperar y lo cosechado después no pisa lo leído", {
  skip_if_not_installed("openxlsx")
  .aw_reset()
  fx <- .aw_make_session()
  sid <- fx$sid
  withr::defer(session_delete(sid))
  counts <- .aw_count_calls()

  result <- .aw_run_job(sid)
  prosecnurapp:::.analitica_lectura_cache_clear()
  # Marca en lo que trae el job para distinguirlo de lo que lee el backend.
  for (nm in names(result$payload$entries)) {
    attr(result$payload$entries[[nm]]$value, "aw_origen") <- "job"
  }
  job <- .aw_fake_job(sid, result, alive = TRUE)
  withr::defer(rm(list = job$id, envir = prosecnurapp:::.jobs))
  counts$read <- 0L

  ctx <- .analitica_prepare_and_cache(sid)
  expect_equal(counts$read, 2L)
  expect_identical(prosecnurapp:::.jobs[[job$id]]$status, "running")
  expect_length(ls(prosecnurapp:::.analitica_lectura_bg), 1L)

  job$state$alive <- FALSE
  expect_equal(prosecnurapp:::.analitica_lectura_bg_harvest(), 2L)
  sig <- result$payload$entries[[1]]$signature
  en_memo <- prosecnurapp:::.analitica_lectura_cache_get(sig)
  expect_null(attr(en_memo, "aw_origen"))
})

test_that("lo instalado desde el job es idéntico a leer en el backend", {
  skip_if_not_installed("openxlsx")
  .aw_reset()
  fx <- .aw_make_session()
  sid <- fx$sid
  withr::defer(session_delete(sid))

  result <- .aw_run_job(sid)
  prosecnurapp:::.analitica_lectura_cache_clear()
  expect_equal(prosecnurapp:::.analitica_warmup_install(result$payload), 2L)
  desde_job <- .analitica_prepare_and_cache(sid)
  prosecnurapp:::.analitica_lectura_cache_clear()
  desde_backend <- .analitica_prepare_and_cache(sid)
  expect_identical(desde_job$data_sources, desde_backend$data_sources)
  expect_identical(desde_job$inst_sources, desde_backend$inst_sources)
})

test_that("no se instala lo de otro código ni lo de otro proyecto", {
  skip_if_not_installed("openxlsx")
  .aw_reset()
  fx <- .aw_make_session()
  sid <- fx$sid
  withr::defer(session_delete(sid))

  result <- .aw_run_job(sid)
  prosecnurapp:::.analitica_lectura_cache_clear()
  otro <- result$payload
  otro$code_stamp <- "otro-codigo"
  expect_equal(prosecnurapp:::.analitica_warmup_install(otro), 0L)
  expect_equal(prosecnurapp:::.analitica_warmup_install(NULL), 0L)

  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  public <- prosecnurapp:::.analitica_lectura_bg_on_complete(list(sid = sid, result_data = result))
  expect_equal(public$installed, 0L)
  expect_null(public$payload)
  expect_length(ls(prosecnurapp:::.analitica_lectura_cache, all.names = TRUE), 0L)
})

test_that("un archivo cambiado después del job se relee, sólo esa base", {
  skip_if_not_installed("openxlsx")
  .aw_reset()
  fx <- .aw_make_session()
  sid <- fx$sid
  withr::defer(session_delete(sid))
  counts <- .aw_count_calls()

  result <- .aw_run_job(sid)
  prosecnurapp:::.analitica_lectura_cache_clear()
  prosecnurapp:::.analitica_warmup_install(result$payload)
  counts$read <- 0L

  Sys.sleep(1.1)
  df <- data.frame(sexo = c("1", "2", "1", "2", "1", "2", "2"),
                   p1 = c("1", "2", "3", "1", "2", "3", "3"), stringsAsFactors = FALSE)
  openxlsx::write.xlsx(list(data = df), file = fx$data_paths[["b2025"]], overwrite = TRUE)
  ctx <- .analitica_prepare_and_cache(sid)
  expect_equal(counts$read, 1L)
  expect_equal(nrow(as.data.frame(ctx$data_sources[["b2025"]])), 7L)
  expect_equal(nrow(as.data.frame(ctx$data_sources[["b2024"]])), 4L)
})

test_that("con plazo vencido la lectura no instala nada", {
  skip_if_not_installed("openxlsx")
  .aw_reset()
  fx <- .aw_make_session()
  sid <- fx$sid
  withr::defer(session_delete(sid))

  lectura <- prosecnurapp:::.analitica_warmup_collect(sid, deadline = Sys.time() - 1)
  expect_equal(lectura$n_bases, 2L)
  expect_equal(lectura$n_ready, 0L)
  expect_true(all(lectura$statuses == "timeout"))
  expect_null(lectura$payload)
})

test_that("un proyecto sin bases no arranca lectura en segundo plano", {
  .aw_reset()
  sid <- session_create()
  withr::defer(session_delete(sid))
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  expect_null(prosecnurapp:::.analitica_lectura_bg_start(sid))
  expect_false(isTRUE(prosecnurapp:::.analitica_warmup_prerepair(sid)))
  expect_equal(prosecnurapp:::.analitica_lectura_bg_harvest(), 0L)
})

test_that("las bases leídas viajan por archivo: el job no las retiene y la cosecha borra el archivo", {
  skip_if_not_installed("openxlsx")
  .aw_reset()
  fx <- .aw_make_session()
  sid <- fx$sid
  withr::defer(session_delete(sid))

  result <- .aw_run_job(sid, por_archivo = TRUE)
  expect_null(result[["payload"]])
  expect_true(file.exists(result$payload_path))
  prosecnurapp:::.analitica_lectura_cache_clear()
  public <- prosecnurapp:::.analitica_lectura_bg_on_complete(list(id = "aw-x", sid = sid, result_data = result))
  expect_equal(public$installed, 2L)
  expect_false(file.exists(result$payload_path))
  expect_length(ls(prosecnurapp:::.analitica_lectura_bg, all.names = TRUE), 0L)
})

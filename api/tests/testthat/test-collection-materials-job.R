.cmj_test_seed <- function() {
  sid <- session_create()
  session_set(sid, "project_name", "Estudio Materiales")
  session_set(sid, "monitoreo_aulas_plan", list(
    list(
      selection_run_id = "render-1", operational_code = "MAT-01", label = "Aula 1",
      wave = "M1", faculty = "Ingenieria", course_id = "Calculo",
      schedule = "08:00", venue = "A-201", teacher = "Docente 1", eligible_n = 30,
      link = "https://kf.kobotoolbox.org/x/form?d%5BcollectorID%5D=MAT-01"
    ),
    list(
      selection_run_id = "render-1", operational_code = "MAT-02", label = "Aula 2",
      wave = "M1", faculty = "Derecho", course_id = "Derecho",
      schedule = "10:00", venue = "B-101", teacher = "Docente 2", eligible_n = 25,
      link = "https://kf.kobotoolbox.org/x/form?d%5BcollectorID%5D=MAT-02"
    )
  ))
  seeded <- collection_state_seed(sid)
  created <- collection_material_instance_create(sid, seeded$state_revision)
  snapshot <- collection_material_render_snapshot(sid, created$instance$instance_id)
  snapshot$output_filename <- "fichas_recopiladores.pdf"
  snapshot$audience <- "field_team"
  snapshot_path <- job_save_rds(sid, "materials-test", snapshot)
  list(sid = sid, instance = created$instance, snapshot = snapshot, snapshot_path = snapshot_path)
}

test_that("worker top-level esta marcado y reporta progreso", {
  expect_identical(
    attr(collection_material_render_job, "prosecnur_job_function_name", exact = TRUE),
    "collection_material_render_job"
  )
  expect_true("progress_path" %in% names(formals(collection_material_render_job)))
  source_text <- paste(readLines(test_path("..", "..", "R", "collection_materials_job.R"), warn = FALSE), collapse = "\n")
  expect_match(source_text, "job_progress_writer\\(progress_path\\)")
  expect_match(source_text, "job_submit\\(")
  expect_match(source_text, "on_complete = collection_material_render_on_complete")
})

test_that("worker directo produce PDF multipagina y PNG de una pagina por el mismo layout", {
  fx <- .cmj_test_seed()
  on.exit(session_delete(fx$sid), add = TRUE)
  dir <- withr::local_tempdir()
  progress <- file.path(dir, "render.progress")
  pdf_path <- file.path(dir, "fichas.pdf")
  png_path <- file.path(dir, "preview.png")

  pdf <- collection_material_render_job(
    fx$snapshot_path, "pdf", pdf_path, progress_path = progress
  )
  fx$snapshot$output_filename <- "preview.png"
  preview_snapshot <- file.path(dir, "preview.rds")
  saveRDS(fx$snapshot, preview_snapshot)
  png <- collection_material_render_job(
    preview_snapshot, "png", png_path, page = 2L, dpi = 300, progress_path = progress
  )

  expect_true(file.exists(pdf_path))
  expect_true(file.exists(png_path))
  expect_identical(qpdf::pdf_length(pdf_path), 2L)
  expect_identical(pdf$page_count, 2L)
  expect_identical(length(pdf$page_map), 2L)
  expect_identical(png$page_count, 1L)
  expect_identical(png$page_map[[1]]$page, 2L)
  expect_identical(pdf$layout_fingerprint, png$layout_fingerprint)
  expect_match(pdf$sha256, "^sha256:[0-9a-f]{64}$")
  expect_match(png$sha256, "^sha256:[0-9a-f]{64}$")
  expect_gt(pdf$size_bytes, 1000L)
  expect_gt(png$size_bytes, 1000L)

  progress_payload <- jsonlite::fromJSON(progress, simplifyVector = FALSE)
  expect_identical(progress_payload$phase, "done")
  expect_identical(progress_payload$percent, 100L)

  # El worker no devuelve los links que si necesita el dibujo.
  public_text <- paste(capture.output(str(pdf)), collapse = "\n")
  expect_false(grepl("kf.kobotoolbox.org", public_text, fixed = TRUE))
})

test_that("job asincrono renderiza y registra el recibo desde un worker limpio", {
  skip_if_not_installed("callr")
  api_dir <- normalizePath(test_path("..", ".."), mustWork = TRUE)
  repo_root <- normalizePath(file.path(api_dir, ".."), mustWork = TRUE)
  old_api_dir <- Sys.getenv("PULSO_API_DIR", unset = NA_character_)
  old_repo_root <- Sys.getenv("PULSO_REPO_ROOT", unset = NA_character_)
  Sys.setenv(PULSO_API_DIR = api_dir, PULSO_REPO_ROOT = repo_root)
  on.exit({
    if (is.na(old_api_dir)) Sys.unsetenv("PULSO_API_DIR") else Sys.setenv(PULSO_API_DIR = old_api_dir)
    if (is.na(old_repo_root)) Sys.unsetenv("PULSO_REPO_ROOT") else Sys.setenv(PULSO_REPO_ROOT = old_repo_root)
    jobs_kill_all()
  }, add = TRUE)

  fx <- .cmj_test_seed()
  on.exit(session_delete(fx$sid), add = TRUE)
  started <- collection_material_render_start(
    fx$sid, fx$instance$instance_id, format = "png", page = 2L
  )
  expect_match(started$job_id, "^[0-9a-f-]+$")

  deadline <- Sys.time() + 90
  repeat {
    job <- job_poll(started$job_id)
    if (!identical(job$status, "running")) break
    if (Sys.time() > deadline) fail("El job asincrono de materiales no termino a tiempo.")
    Sys.sleep(0.2)
  }

  expect_identical(job$status, "done", info = job$error %||% "")
  expect_identical(job$result_public$media_type, "image/png")
  expect_identical(job$result_public$page_count, 1L)
  expect_true(collection_artifact_receipt_validate(job$result_public$manifest)$ok)
  expect_true(file.exists(session_get(fx$sid)$files[[job$result_public$file_id]]$path))
})

test_that("bundle separa un PDF por unidad en Fichas/<facultad>/, sin manifest JSON paralelo", {
  # El prototipo Python de Gonzalo (docs/Generador_fichasQR.ipynb, sin
  # trackear) organizaba su salida en carpetas -por seleccion/muestra alla,
  # por facultad aca, que es el dato que de verdad identifica donde entregar
  # cada ficha impresa-. Un solo PDF con todas las paginas seguidas no deja
  # encontrar la ficha de un aula sin recorrer el archivo entero.
  fx <- .cmj_test_seed()
  on.exit(session_delete(fx$sid), add = TRUE)
  dir <- withr::local_tempdir()
  path <- file.path(dir, "materiales.zip")
  fx$snapshot$output_filename <- "materiales.zip"
  snapshot_path <- file.path(dir, "bundle.rds")
  saveRDS(fx$snapshot, snapshot_path)

  result <- collection_material_render_job(snapshot_path, "bundle", path)
  listing <- utils::unzip(path, list = TRUE)$Name
  # Fixture: "Aula 1" en Ingenieria, "Aula 2" en Derecho (facultades
  # distintas) -> dos carpetas, un PDF cada una.
  expect_setequal(listing, c(
    "Fichas/Ingenieria/Aula 1.pdf", "Fichas/Derecho/Aula 2.pdf", "accesos.tsv"
  ))
  expect_false(any(grepl("manifest[.]json$", listing, ignore.case = TRUE)))
  expect_identical(result$media_type, "application/zip")
  expect_identical(result$page_count, 2L)
  expect_match(result$sha256, "^sha256:[0-9a-f]{64}$")

  unpack <- file.path(dir, "unpack")
  dir.create(unpack)
  utils::unzip(path, exdir = unpack)
  # Cada PDF por unidad tiene una sola pagina -ya no es un PDF combinado.
  expect_identical(qpdf::pdf_length(file.path(unpack, "Fichas/Ingenieria/Aula 1.pdf")), 1L)
  expect_identical(qpdf::pdf_length(file.path(unpack, "Fichas/Derecho/Aula 2.pdf")), 1L)
  tsv <- utils::read.delim(file.path(unpack, "accesos.tsv"), stringsAsFactors = FALSE)
  expect_identical(tsv$unit_id, vapply(result$page_map, `[[`, character(1), "unit_id"))
  expect_true(all(grepl("^https://", tsv$qr_payload)))
})

test_that("dos unidades de la misma facultad con el mismo label no se pisan", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_name", "Estudio Materiales")
  session_set(sid, "monitoreo_aulas_plan", list(
    list(
      selection_run_id = "render-1", operational_code = "MAT-01", label = "Aula 1",
      wave = "M1", faculty = "Ingenieria", course_id = "Calculo",
      schedule = "08:00", venue = "A-201", teacher = "Docente 1", eligible_n = 30,
      link = "https://kf.kobotoolbox.org/x/form?d%5BcollectorID%5D=MAT-01"
    ),
    list(
      selection_run_id = "render-1", operational_code = "MAT-02", label = "Aula 1",
      wave = "M1", faculty = "Ingenieria", course_id = "Fisica",
      schedule = "10:00", venue = "B-101", teacher = "Docente 2", eligible_n = 25,
      link = "https://kf.kobotoolbox.org/x/form?d%5BcollectorID%5D=MAT-02"
    )
  ))
  seeded <- collection_state_seed(sid)
  created <- collection_material_instance_create(sid, seeded$state_revision)
  snapshot <- collection_material_render_snapshot(sid, created$instance$instance_id)
  snapshot$output_filename <- "materiales.zip"
  dir <- withr::local_tempdir()
  snapshot_path <- file.path(dir, "bundle.rds")
  saveRDS(snapshot, snapshot_path)
  path <- file.path(dir, "materiales.zip")

  collection_material_render_job(snapshot_path, "bundle", path)
  listing <- utils::unzip(path, list = TRUE)$Name
  expect_setequal(listing, c(
    "Fichas/Ingenieria/Aula 1.pdf", "Fichas/Ingenieria/Aula 1 (2).pdf", "accesos.tsv"
  ))
})

test_that("on_complete registra output y persiste un solo receipt sin resolved_access", {
  fx <- .cmj_test_seed()
  on.exit(session_delete(fx$sid), add = TRUE)
  dir <- withr::local_tempdir()
  path <- file.path(dir, "fichas.pdf")
  result <- collection_material_render_job(fx$snapshot_path, "pdf", path)
  before_revision <- session_get(fx$sid)$collection_state$state_revision
  before_state <- paste(capture.output(str(session_get(fx$sid)$collection_state)), collapse = "\n")

  public <- collection_material_render_on_complete(list(
    sid = fx$sid, status = "done", result_path = path, result_data = result
  ))
  expect_identical(names(public), c(
    "file_id", "media_type", "filename", "sha256", "size_bytes", "page_count",
    "page_map", "generator", "audience", "sensitivity", "manifest"
  ))
  expect_identical(public$manifest$file_id, public$file_id)
  expect_identical(public$manifest$sha256, public$sha256)
  expect_true(collection_artifact_receipt_validate(public$manifest)$ok)

  session <- session_get(fx$sid)
  expect_true(file.exists(session$files[[public$file_id]]$path))
  expect_identical(session$files[[public$file_id]]$role, "deliverable")
  expect_identical(session$files[[public$file_id]]$media_type, "application/pdf")
  expect_identical(session$collection_state$state_revision, before_revision + 1L)
  expect_length(session$collection_state$artifact_receipts, 1L)
  expect_identical(session$collection_state$artifact_receipts[[1]], public$manifest)

  receipts_text <- paste(capture.output(str(session$collection_state$artifact_receipts)), collapse = "\n")
  after_state <- paste(capture.output(str(session$collection_state)), collapse = "\n")
  # El deployment core ya contiene links operacionales; completar el job no
  # agrega ninguno al receipt ni aumenta su presencia en el estado.
  expect_false(grepl("kf.kobotoolbox.org", receipts_text, fixed = TRUE))
  expect_identical(
    lengths(regmatches(after_state, gregexpr("kf[.]kobotoolbox[.]org", after_state))),
    lengths(regmatches(before_state, gregexpr("kf[.]kobotoolbox[.]org", before_state)))
  )
  expect_false(grepl("data:(image|application)/", receipts_text, ignore.case = TRUE))
  expect_true(collection_state_validate(session$collection_state)$ok)
})

test_that("worker maneja texto extremo sin overflow y conserva QR de URL larga", {
  fx <- .cmj_test_seed()
  on.exit(session_delete(fx$sid), add = TRUE)
  long_text <- paste(rep("Nombre de curso extraordinariamente largo", 80), collapse = " ")
  fx$snapshot$plan$units[[1]]$dimensions$course_name <- long_text
  long_url <- paste0(
    "https://example.test/respond?",
    paste0("v", seq_len(80), "=", paste(rep("x", 12), collapse = ""), collapse = "&")
  )
  access_id <- fx$snapshot$instance$access_refs[[1]]
  fx$snapshot$deployment$sensitivity$access_urls <- "restricted"
  fx$snapshot$deployment$bindings[[1]]$access_ref <- "external-ref:1"
  fx$snapshot$resolved_access <- setNames(list(long_url), access_id)
  dir <- withr::local_tempdir()
  snapshot_path <- file.path(dir, "extreme.rds")
  png_path <- file.path(dir, "extreme.png")
  saveRDS(fx$snapshot, snapshot_path)

  result <- collection_material_render_job(snapshot_path, "png", png_path, dpi = 300)
  expect_true(file.exists(png_path))
  expect_true(any(vapply(result$warnings, function(x) identical(x$code, "text_truncated"), logical(1))))
  expected <- collection_qr_matrix(long_url)
  observed <- collection_qr_matrix_from_png(png_path, nrow(expected), dpi = 300)
  expect_identical(observed, expected)
})

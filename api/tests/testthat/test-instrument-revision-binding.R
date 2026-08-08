library(testthat)

# Enlace base ↔ revisión publicada fuera de acreditación multiactor.
#
# El defecto que cubre esta suite: `instrument_revision_id` solo lo escribían
# las vías de acreditación y el bundle SAV de SurveyMonkey, así que en un
# estudio de una sola base publicar una revisión no tenía ningún consumidor —
# los contratos de Validación y Analítica resuelven leyendo justamente ese
# campo de la base.

.irb_workbook <- function(label = "Pregunta uno", form_id = "instrumento") {
  list(
    survey = list(
      columns = list("type", "name", "label"),
      rows = list(list("text", "q1", label))
    ),
    choices = list(
      columns = list("list_name", "name", "label"),
      rows = list()
    ),
    settings = list(
      columns = list("form_title", "form_id", "version", "default_language"),
      rows = list(list("Instrumento", form_id, "1", "es"))
    )
  )
}

# Materializa el workbook como XLSForm físico y lo registra en la sesión.
.irb_register_xlsform <- function(sid, file_id, workbook) {
  s <- session_get(sid)
  path <- file.path(s$dir, "uploads", paste0(file_id, ".xlsx"))
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)
  writeBin(.xlsform_revision_materialize(workbook), path)
  s$files <- s$files %||% list()
  s$files[[file_id]] <- list(
    file_id = file_id,
    kind = "xlsform",
    original_name = paste0(file_id, ".xlsx"),
    path = path,
    size = file.info(path)$size,
    ext = "xlsx"
  )
  .session_env[[sid]] <- s
  invisible(path)
}

.irb_publish_revision <- function(sid, revision_id, workbook,
                                  form_id = "form-1", revision_no = 1L) {
  .irb_register_xlsform(sid, paste0("file-", revision_id), workbook)
  s <- session_get(sid)
  s$instrument_revisions <- s$instrument_revisions %||% list()
  s$instrument_revisions[[revision_id]] <- list(
    schema = "instrument_revision/v1",
    revision_id = revision_id,
    form_id = form_id,
    revision_no = as.integer(revision_no),
    content_sha256 = .xlsform_revision_hash(workbook),
    xlsform_file_id = paste0("file-", revision_id),
    source = list(kind = "xlsform"),
    published_at = sprintf("2026-08-%02dT12:00:00Z", as.integer(revision_no))
  )
  .session_env[[sid]] <- s
  invisible(s$instrument_revisions[[revision_id]])
}

# Registra una base mínima apuntando a un XLSForm ya subido. No usamos
# `estudio_add_base` porque exige reportes completos de data/instrumento y acá
# lo único bajo prueba es el enlace con la revisión.
.irb_seed_base <- function(sid, nombre = "default", xlsform_file_id = "file-carga",
                           extra = list()) {
  estudio_ensure(sid)
  s <- session_get(sid)
  meta <- list(
    nombre = nombre,
    xlsform_file_id = xlsform_file_id,
    data_file_id = "file-data",
    data_ext = "xlsx",
    n_filas = 10L,
    n_columnas = 3L,
    added_at = "2026-08-08T12:00:00Z"
  )
  for (key in names(extra)) meta[[key]] <- extra[[key]]
  s$estudio$bases[[nombre]] <- meta
  .session_env[[sid]] <- s
  invisible(meta)
}

.irb_base <- function(sid, nombre = "default") {
  session_get(sid)$estudio$bases[[nombre]]
}

test_that("una base con el XLSForm de una revisión publicada queda ligada a ella", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  workbook <- .irb_workbook()
  .irb_publish_revision(sid, "rev-1", workbook)
  # El usuario exportó el instrumento del editor y lo cargó en Procesamiento:
  # es otro archivo en disco, con el mismo contenido canónico.
  .irb_register_xlsform(sid, "file-carga", workbook)
  .irb_seed_base(sid)

  instrument_revision_bind_base(sid, "default")

  base <- .irb_base(sid)
  expect_equal(base$instrument_revision_binding, "matched")
  expect_equal(base$instrument_revision_id, "rev-1")
  expect_equal(base$instrument_revision_hash, .xlsform_revision_hash(workbook))
  expect_match(base$instrument_revision_bound_at, "^\\d{4}-\\d{2}-\\d{2}T")
})

test_that("el enlace ignora las columnas de la capa de edición", {
  # El export "Prosecnur" arrastra la hoja paper y columnas paper_*; el export
  # Kobo/ODK no. Los dos son el mismo instrumento y deben ligar igual.
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  publicado <- .irb_workbook()
  .irb_publish_revision(sid, "rev-1", publicado)

  con_capa_app <- publicado
  con_capa_app$survey$columns <- c(con_capa_app$survey$columns, "paper_hint")
  con_capa_app$survey$rows[[1]] <- c(con_capa_app$survey$rows[[1]], "solo para el impreso")
  .irb_register_xlsform(sid, "file-carga", con_capa_app)
  .irb_seed_base(sid)

  instrument_revision_bind_base(sid, "default")

  expect_equal(.irb_base(sid)$instrument_revision_id, "rev-1")
})

test_that("un instrumento distinto no se liga a ninguna revisión", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  .irb_publish_revision(sid, "rev-1", .irb_workbook("Pregunta uno"))
  .irb_register_xlsform(sid, "file-carga", .irb_workbook("Pregunta editada a mano"))
  .irb_seed_base(sid)

  instrument_revision_bind_base(sid, "default")

  base <- .irb_base(sid)
  expect_equal(base$instrument_revision_binding, "no_match")
  expect_equal(base$instrument_revision_id, "")
  expect_match(base$instrument_revision_binding_detail, "no coincide")
})

test_that("sin revisiones publicadas el estado lo dice en vez de fallar", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  .irb_register_xlsform(sid, "file-carga", .irb_workbook())
  .irb_seed_base(sid)

  expect_no_error(instrument_revision_bind_base(sid, "default"))
  expect_equal(.irb_base(sid)$instrument_revision_binding, "none_published")
})

test_that("un XLSForm ausente no rompe la carga", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  .irb_publish_revision(sid, "rev-1", .irb_workbook())
  .irb_seed_base(sid, xlsform_file_id = "file-que-no-existe")

  expect_no_error(instrument_revision_bind_base(sid, "default"))
  base <- .irb_base(sid)
  expect_equal(base$instrument_revision_binding, "unreadable")
  expect_equal(base$instrument_revision_id, "")
})

test_that("el enlace del plan de ingreso de acreditación tiene precedencia", {
  # Una base materializada por el plan multiactor ya declaró su revisión con
  # su propia regla; recalcular por hash acá la pisaría.
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  .irb_publish_revision(sid, "rev-1", .irb_workbook())
  .irb_register_xlsform(sid, "file-carga", .irb_workbook())
  .irb_seed_base(sid, extra = list(
    processing_intake_entry_id = "entry-docentes",
    instrument_revision_id = "rev-acreditacion"
  ))

  instrument_revision_bind_base(sid, "default")

  base <- .irb_base(sid)
  expect_equal(base$instrument_revision_id, "rev-acreditacion")
  expect_null(base$instrument_revision_binding)
})

test_that("cambiar el XLSForm por uno ajeno suelta el enlace anterior", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  workbook <- .irb_workbook()
  .irb_publish_revision(sid, "rev-1", workbook)
  .irb_register_xlsform(sid, "file-carga", workbook)
  .irb_seed_base(sid)
  instrument_revision_bind_base(sid, "default")
  expect_equal(.irb_base(sid)$instrument_revision_id, "rev-1")

  # Segunda carga con otro instrumento sobre la misma base.
  .irb_register_xlsform(sid, "file-carga", .irb_workbook("Otro instrumento"))
  instrument_revision_bind_base(sid, "default")

  base <- .irb_base(sid)
  expect_equal(base$instrument_revision_binding, "no_match")
  expect_equal(base$instrument_revision_id, "")
})

test_that("gana la revisión más reciente cuando dos comparten contenido", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  workbook <- .irb_workbook()
  .irb_publish_revision(sid, "rev-1", workbook, form_id = "form-1", revision_no = 1L)
  .irb_publish_revision(sid, "rev-2", workbook, form_id = "form-2", revision_no = 3L)
  .irb_register_xlsform(sid, "file-carga", workbook)
  .irb_seed_base(sid)

  instrument_revision_bind_base(sid, "default")

  expect_equal(.irb_base(sid)$instrument_revision_id, "rev-2")
})

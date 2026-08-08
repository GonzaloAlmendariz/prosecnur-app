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

test_that("cualquier vía que registre una base liga sin llamada propia", {
  # La regresión que esto previene: el enlace vivía en `estudio_init_default_
  # base()`, por donde pasa la carga manual pero NO la importación de Kobo, el
  # bundle de SurveyMonkey ni el handoff de Monitoreo — todas registran su base
  # con `estudio_add_base()` directo. Sembrar la llamada ruta por ruta es lo que
  # dejó el enlace disponible solo en una parte del producto.
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  workbook <- .irb_workbook()
  .irb_publish_revision(sid, "rev-1", workbook)
  .irb_register_xlsform(sid, "file-kobo", workbook)
  estudio_ensure(sid)

  meta <- estudio_add_base(
    sid,
    nombre = "kobo_docentes",
    xlsform_file_id = "file-kobo",
    data_file_id = "file-data",
    data_ext = "xlsx",
    rp_data = NULL,
    rp_inst = NULL,
    n_filas = 10L,
    n_columnas = 3L,
    extra_meta = list(source_kind = "kobo_api")
  )

  # El retorno de add_base ya trae el enlace: los routers lo serializan directo.
  expect_equal(meta$instrument_revision_id, "rev-1")
  expect_equal(meta$instrument_revision_binding, "matched")
  expect_equal(.irb_base(sid, "kobo_docentes")$instrument_revision_id, "rev-1")
})

test_that("reemplazar el XLSForm de una base recalcula su enlace", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  publicado <- .irb_workbook("Instrumento publicado")
  .irb_publish_revision(sid, "rev-1", publicado)
  .irb_register_xlsform(sid, "file-uno", .irb_workbook("Otro instrumento"))
  estudio_ensure(sid)
  estudio_add_base(
    sid, nombre = "default", xlsform_file_id = "file-uno",
    data_file_id = "file-data", data_ext = "xlsx",
    rp_data = NULL, rp_inst = NULL, n_filas = 5L, n_columnas = 2L
  )
  expect_equal(.irb_base(sid)$instrument_revision_binding, "no_match")

  # El usuario reemplaza el formulario por el que sí publicó.
  .irb_register_xlsform(sid, "file-dos", publicado)
  meta <- estudio_replace_base_files(
    sid, nombre = "default", xlsform_file_id = "file-dos",
    rp_inst = NULL, n_filas = 5L, n_columnas = 2L
  )

  expect_equal(meta$instrument_revision_binding, "matched")
  expect_equal(meta$instrument_revision_id, "rev-1")
})

test_that("registrar una base sin revisiones publicadas no lee el XLSForm", {
  # El enlace corre en toda alta de base, así que no puede costar una lectura
  # de disco en los proyectos que nunca usan el Editor.
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_ensure(sid)

  leidos <- 0L
  testthat::local_mocked_bindings(
    instrument_revision_workbook_from_xlsx = function(path) {
      leidos <<- leidos + 1L
      list()
    },
    .package = "prosecnurapp"
  )

  estudio_add_base(
    sid, nombre = "default", xlsform_file_id = "file-x",
    data_file_id = "file-data", data_ext = "xlsx",
    rp_data = NULL, rp_inst = NULL, n_filas = 1L, n_columnas = 1L
  )

  expect_equal(leidos, 0L)
  expect_equal(.irb_base(sid)$instrument_revision_binding, "none_published")
})

test_that("la publicación reporta qué bases están usando el formulario", {
  # El lazo de vuelta: sin esto el hub decía "Disponible" aunque ninguna base
  # estuviera usando la revisión, y publicar no tenía consecuencia observable.
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  workbook <- .irb_workbook()
  .irb_publish_revision(sid, "rev-1", workbook, form_id = "form-1", revision_no = 1L)
  .irb_register_xlsform(sid, "file-carga", workbook)
  .irb_seed_base(sid, nombre = "default")
  instrument_revision_bind_base(sid, "default")

  s <- session_get(sid)
  latest <- .xlsform_revision_latest(s, "form-1")
  ligadas <- .xlsform_revision_bound_bases(s, "form-1", latest)

  expect_length(ligadas, 1L)
  expect_equal(ligadas[[1]]$base, "default")
  expect_equal(ligadas[[1]]$revision_no, 1L)
  expect_true(ligadas[[1]]$is_latest)
})

test_that("una base pegada a una revisión anterior se reporta como no vigente", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  vieja <- .irb_workbook("Versión uno")
  nueva <- .irb_workbook("Versión dos")
  .irb_publish_revision(sid, "rev-1", vieja, form_id = "form-1", revision_no = 1L)
  .irb_register_xlsform(sid, "file-carga", vieja)
  .irb_seed_base(sid, nombre = "default")
  instrument_revision_bind_base(sid, "default")

  # El editor publica una revisión posterior; la base sigue con la anterior.
  .irb_publish_revision(sid, "rev-2", nueva, form_id = "form-1", revision_no = 2L)

  s <- session_get(sid)
  latest <- .xlsform_revision_latest(s, "form-1")
  ligadas <- .xlsform_revision_bound_bases(s, "form-1", latest)

  expect_length(ligadas, 1L)
  expect_equal(ligadas[[1]]$revision_no, 1L)
  expect_false(ligadas[[1]]$is_latest)
})

test_that("las bases de otros formularios no se cuentan como propias", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  propio <- .irb_workbook("Del formulario uno")
  ajeno <- .irb_workbook("Del formulario dos")
  .irb_publish_revision(sid, "rev-1", propio, form_id = "form-1", revision_no = 1L)
  .irb_publish_revision(sid, "rev-2", ajeno, form_id = "form-2", revision_no = 1L)
  .irb_register_xlsform(sid, "file-carga", ajeno)
  .irb_seed_base(sid, nombre = "default")
  instrument_revision_bind_base(sid, "default")

  s <- session_get(sid)
  expect_length(
    .xlsform_revision_bound_bases(s, "form-1", .xlsform_revision_latest(s, "form-1")),
    0L
  )
  expect_length(
    .xlsform_revision_bound_bases(s, "form-2", .xlsform_revision_latest(s, "form-2")),
    1L
  )
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

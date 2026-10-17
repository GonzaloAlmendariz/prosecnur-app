# H23 — El recibo de Entrega promete una descarga que tras reabrir no existe.
#
# Un material renderizado deja dos cosas: el archivo, registrado en el file store
# de la sesion (`s$files`, fuera del .pulso), y su recibo, persistido en
# `collection_state$artifact_receipts`. `build_pulso` solo copia inputs, asi que
# al reabrir el proyecto el recibo sigue ahi y el archivo no: GET
# /api/files/<id>/download responde 404 E_NO_FILE y Entrega pinta igual un
# enlace de descarga por cada recibo.
#
# Contrato: el payload de collection_state marca cada recibo con
# `file_available` —derivado de si su `file_id` sigue en el file store de ESTA
# sesion—, y ese campo NO se persiste: es un hecho de la sesion, no del recibo.

.recibo_seed <- function() {
  sid <- session_create()
  session_set(sid, "project_name", "Recibo disponible")
  session_set(sid, "monitoreo_aulas_plan", list(
    list(
      selection_run_id = "render-1", operational_code = "MAT-01", label = "Aula 1",
      wave = "M1", faculty = "Ingenieria", course_id = "Calculo", sample_role = "titular",
      schedule = "08:00", venue = "A-201", teacher = "Docente 1", eligible_n = 30,
      link = "https://kf.kobotoolbox.org/x/form?d%5BcollectorID%5D=MAT-01"
    )
  ))
  seeded <- collection_state_seed(sid)
  created <- collection_material_instance_create(sid, seeded$state_revision)
  snapshot <- collection_material_render_snapshot(sid, created$instance$instance_id)
  snapshot$output_filename <- "ficha_recibo.png"
  snapshot$audience <- "field_team"
  snapshot_path <- job_save_rds(sid, "recibo-test", snapshot)
  dir <- tempfile("recibo-")
  dir.create(dir)
  path <- file.path(dir, "ficha.png")
  result <- collection_material_render_job(snapshot_path, "png", path)
  public <- collection_material_render_on_complete(list(
    sid = sid, status = "done", result_path = path, result_data = result
  ))
  list(sid = sid, public = public, dir = dir)
}

test_that("en la sesion que lo genero, el recibo se marca disponible y el campo no se persiste", {
  fx <- .recibo_seed()
  on.exit({
    session_delete(fx$sid)
    unlink(fx$dir, recursive = TRUE, force = TRUE)
  }, add = TRUE)

  payload <- collection_state_get(fx$sid)
  expect_length(payload$state$artifact_receipts, 1L)
  expect_identical(payload$state$artifact_receipts[[1]]$file_id, fx$public$file_id)
  expect_identical(payload$state$artifact_receipts[[1]]$file_available, TRUE)

  # Derivado, no persistido: el estado guardado no lo lleva.
  stored <- session_get(fx$sid)$collection_state$artifact_receipts[[1]]
  expect_false("file_available" %in% names(stored))
})

test_that("tras build_pulso y load_pulso, el recibo sobrevive pero su archivo no y se marca no disponible", {
  skip_if_not_installed("zip")
  fx <- .recibo_seed()
  tmp <- tempfile(fileext = ".pulso")
  on.exit({
    session_delete(fx$sid)
    unlink(fx$dir, recursive = TRUE, force = TRUE)
    unlink(tmp, force = TRUE)
  }, add = TRUE)

  build_pulso(fx$sid, tmp, project_name = "Recibo disponible")
  loaded <- load_pulso(tmp)
  on.exit(session_delete(loaded$session_id), add = TRUE)

  restored <- session_get(loaded$session_id)
  # Precondicion del defecto: el recibo viaja y el archivo no.
  expect_length(restored$collection_state$artifact_receipts, 1L)
  expect_null(restored$files[[fx$public$file_id]])

  payload <- collection_state_get(loaded$session_id)
  expect_length(payload$state$artifact_receipts, 1L)
  expect_identical(payload$state$artifact_receipts[[1]]$receipt_id, fx$public$manifest$receipt_id)
  expect_identical(payload$state$artifact_receipts[[1]]$file_available, FALSE)
  expect_false("file_available" %in% names(restored$collection_state$artifact_receipts[[1]]))
})

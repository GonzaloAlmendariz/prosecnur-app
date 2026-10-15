# Contrato HTTP de /api/xlsform-editor/export-word y /export-pdf: el handler
# Plumber acepta `...`, asi que un parametro mal leido no rompe nada en la
# llamada directa. Aqui se prueba POR EL WIRE que (item 4) el titulo impreso
# sale de `form_title` y no del nombre del archivo, (item 6) `paper_subgroup` y
# `paper_subletter` llegan al documento, y (B2) `summary$n_questions` viaja
# con su grano. Checklist docs/qa/checklist-exportacion-formulario-2026-10-15.md.
#
# La exportacion es un JOB: POST -> { ok, job_id, kind }; GET /api/jobs/<id>
# hasta `done`; el objeto de siempre llega en `result_data`. El worker callr
# deserializa el runner contra prosecnurapp INSTALADO (y luego lo re-resuelve
# en el arbol dev via PULSO_API_DIR): sin paquete instalado se skipea.

.hxe_workbook <- function() {
  list(
    survey = list(
      columns = c("type", "name", "label", "paper_subgroup", "paper_subletter", "paper_number"),
      rows = list(
        c("note", "instr", "Lea las afirmaciones.", "", "", ""),
        c("select_one sn", "comp", "Competencias:", "D.4. Sobre tu familia", "@", ""),
        c("select_one sn", "comp_a", "Liderazgo", "D.4. Sobre tu familia", "a", "-"),
        c("select_one sn", "comp_b", "Trabajo en equipo", "D.4. Sobre tu familia", "b", "-"),
        c("text", "fin", "Comentario final", "", "", "")
      )
    ),
    choices = list(columns = c("list_name", "name", "label"),
                   rows = list(c("sn", "1", "Si"), c("sn", "2", "No"))),
    settings = list(columns = c("form_title", "form_id"),
                    rows = list(c("Encuesta declarada en settings", "f1")))
  )
}

# Submit -> poll (registrando las fases vistas) -> snapshot final.
.hxe_exportar <- function(srv, ruta, body) {
  creada <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))
  sid <- creada$json$session_id
  r <- http_post_json(srv, ruta, sid = sid, body = body)
  expect_identical(r$status, 200L)
  expect_true(isTRUE(r$json$ok))
  expect_true(is.character(r$json$job_id) && nzchar(r$json$job_id))
  fases <- character(0)
  deadline <- Sys.time() + 300
  snap <- NULL
  while (Sys.time() < deadline) {
    p <- http_get(srv, paste0("/api/jobs/", r$json$job_id), sid = sid)
    snap <- p$json
    fases <- c(fases, as.character(snap$progress$phase %||% ""))
    if (as.character(snap$status) %in% c("done", "error", "cancelled")) break
    Sys.sleep(0.2)
  }
  list(sid = sid, arranque = r$json, snap = snap, fases = unique(fases[nzchar(fases)]))
}

test_that("export-word por el wire: job, titulo de form_title, subgrupo, sub-letras y n_questions", {
  skip_if_not_installed("officer")
  skip_if_not_installed("flextable")
  srv <- http_contract_server()
  http_contract_skip_if_no_jobs_runtime()

  x <- .hxe_exportar(srv, "/api/xlsform-editor/export-word", list(
    filename = "nombre_de_archivo_editado",
    workbook = .hxe_workbook(),
    options = list(columns = 1L, matrix_groups = list(list(
      members = c("comp", "comp_a", "comp_b"), tenor = "", special = "auto")))
  ))
  expect_identical(x$arranque$kind, "xlsform_editor.formulario_word")
  expect_identical(x$snap$status, "done")
  # Las fases que alcancen a verse respetan el orden del contrato.
  orden <- c("queued", "running", "modelo", "dibujando", "guardando", "done")
  expect_true(all(x$fases %in% orden))
  expect_false(is.unsorted(match(x$fases, orden)))
  expect_identical(x$fases[length(x$fases)], "done")

  res <- x$snap$result_data
  expect_identical(names(res), c("ok", "file_id", "original_name", "size", "summary", "warnings"))
  expect_true(isTRUE(res$ok))
  expect_identical(res$original_name, "nombre_de_archivo_editado.docx")
  # Madre (imprime su numero) + la abierta; la nota y las letras no cuentan.
  expect_identical(res$summary$n_questions, 2L)
  expect_false(isTRUE(x$snap$has_file_result))

  dl <- .http_contract_request(srv, sprintf("/api/files/%s/download", res$file_id), sid = x$sid)
  expect_identical(dl$status, 200L)
  tmp <- tempfile(fileext = ".docx")
  writeBin(dl$raw, tmp)
  txt <- paste(officer::docx_summary(officer::read_docx(tmp))$text, collapse = "\n")
  expect_true(grepl("Encuesta declarada en settings", txt, fixed = TRUE))
  expect_false(grepl("nombre de archivo", txt, fixed = TRUE))
  expect_true(grepl("D.4. SOBRE TU FAMILIA", txt, fixed = TRUE))
  expect_true(grepl("Trabajo en equipo", txt, fixed = TRUE))
})

test_that("export-pdf por el wire responde el mismo contrato de job", {
  srv <- http_contract_server()
  http_contract_skip_if_no_jobs_runtime()
  x <- .hxe_exportar(srv, "/api/xlsform-editor/export-pdf", list(
    filename = "otro", workbook = .hxe_workbook()))
  expect_identical(x$arranque$kind, "xlsform_editor.formulario_pdf")
  expect_identical(x$snap$status, "done")
  res <- x$snap$result_data
  expect_true(isTRUE(res$ok))
  expect_identical(res$original_name, "otro.pdf")
  expect_gt(res$size, 1000L)
  dl <- .http_contract_request(srv, sprintf("/api/files/%s/download", res$file_id), sid = x$sid)
  expect_identical(dl$status, 200L)
  expect_identical(rawToChar(dl$raw[1:4]), "%PDF")
})

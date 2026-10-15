# Exportacion del formulario desde el editor (api/R/xlsform_editor_export.R).
# Items 4, 5, 6 y 11 del checklist docs/qa/checklist-exportacion-formulario-2026-10-15.md.
#
# La exportacion es un job (callr). Aqui se prueba sin subproceso: el submit se
# intercepta (`local_mocked_bindings(job_submit = ...)`), el runner se corre en
# proceso con los mismos args que recibiria el worker y `on_complete` se aplica
# a un job falso. El circuito real (submit -> poll -> resultado) lo cubre
# test-http-contract-xlsform-editor-export.R.

.xef_req <- function(body, sid = NULL) {
  json <- as.character(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null"))
  list(bodyRaw = charToRaw(enc2utf8(json)), HTTP_X_PULSO_SESSION = sid)
}
.xef_res <- function() {
  env <- new.env()
  env$headers <- list()
  env$setHeader <- function(name, value) env$headers[[name]] <- value
  env
}
.xef_sheet <- function(columns, rows) list(columns = columns, rows = rows)
.xef_spec <- function(ext = "pdf") {
  if (identical(ext, "docx")) {
    list(ext = "docx", output_kind = "formulario_word", fail_code = "E_WORD_EXPORT_FAILED",
         fail_message = "No pude generar el Word del formulario")
  } else {
    list(ext = "pdf", output_kind = "formulario_pdf", fail_code = "E_PDF_EXPORT_FAILED",
         fail_message = "No pude generar el PDF del formulario")
  }
}

# Envia el request por el handler, captura lo que iria al worker, corre el
# runner en proceso y aplica on_complete. Devuelve todo para asertar.
.xef_correr <- function(body, spec = .xef_spec(), sid = session_create()) {
  cap <- new.env()
  testthat::local_mocked_bindings(
    job_submit = function(sid, kind, func, args, result_filename, on_complete, on_cleanup, ...) {
      cap$kind <- kind; cap$func <- func; cap$args <- args
      cap$result_filename <- result_filename
      cap$on_complete <- on_complete; cap$on_cleanup <- on_cleanup
      "job-falso"
    }
  )
  arranque <- .xlsform_editor_export_formulario(.xef_req(body, sid), .xef_res(), spec)
  cap$arranque <- arranque
  cap$payload <- readRDS(cap$args$input_path)
  cap$result_path <- tempfile(fileext = paste0(".", spec$ext))
  cap$worker <- do.call(cap$func, c(cap$args, list(result_path = cap$result_path)))
  cap$publico <- cap$on_complete(list(result_data = cap$worker, result_path = cap$result_path))
  cap$sid <- sid
  cap
}

.xef_body_simple <- function(filename = "archivo_cualquiera") {
  list(
    filename = filename,
    workbook = list(
      survey = .xef_sheet(c("type", "name", "label"), list(c("text", "p1", "Nombre"))),
      choices = .xef_sheet(c("list_name", "name", "label"), list()),
      settings = .xef_sheet(c("form_title", "form_id"), list(c("Encuesta declarada", "f1")))
    )
  )
}

test_that("item 4: el titulo sale de options, luego de form_title y solo al final del archivo", {
  settings <- data.frame(form_title = "Encuesta de egresados 2026", stringsAsFactors = FALSE)
  vacio <- data.frame(form_title = "", stringsAsFactors = FALSE)

  o <- .xlsform_editor_export_titulo(list(), settings, "egresados_v3_editado.pdf")
  expect_identical(o$title, "Encuesta de egresados 2026")
  expect_identical(o$footer_title, "Encuesta de egresados 2026")

  o <- .xlsform_editor_export_titulo(list(title = "Titulo del dialogo"), settings, "x.pdf")
  expect_identical(o$title, "Titulo del dialogo")
  expect_identical(o$footer_title, "Titulo del dialogo")

  o <- .xlsform_editor_export_titulo(list(title = "  ", footer_title = "Pie propio"), vacio,
                                     "egresados_v3_editado.pdf")
  expect_identical(o$title, "egresados v3")
  expect_identical(o$footer_title, "Pie propio")

  o <- .xlsform_editor_export_titulo(list(), .xlsform_editor_empty_df(c("form_title")), "mi-form_papel.docx")
  expect_identical(o$title, "mi form")
})

test_that("B: el POST encola un job y devuelve { ok, job_id, kind } sin renderizar", {
  cap <- .xef_correr(.xef_body_simple())
  expect_identical(cap$arranque, list(ok = TRUE, job_id = "job-falso",
                                      kind = "xlsform_editor.formulario_pdf"))
  # Al worker solo viajan paths y escalares (nada de data frames en el closure).
  expect_setequal(names(cap$args), c("input_path", "formato", "fail_code", "fail_message"))
  expect_true(all(vapply(cap$args, function(a) is.character(a) && length(a) == 1L, logical(1))))
  # El runner es top-level: el bootstrap lo re-resuelve por nombre.
  expect_identical(attr(cap$func, "prosecnur_job_function_name"), "xlsform_editor_export_job_runner")
  # on_cleanup borra el RDS de entrada.
  expect_true(file.exists(cap$args$input_path))
  cap$on_cleanup(list())
  expect_false(file.exists(cap$args$input_path))
})

test_that("B: el resultado publico es el objeto de la ruta sincrona y el archivo queda registrado", {
  cap <- .xef_correr(.xef_body_simple())
  pub <- cap$publico
  expect_identical(names(pub), c("ok", "file_id", "original_name", "size", "summary", "warnings"))
  expect_true(isTRUE(pub$ok))
  expect_identical(pub$original_name, "archivo_cualquiera.pdf")
  expect_gt(pub$size, 1000L)
  expect_identical(pub$summary$n_questions, 1L)
  meta <- session_get(cap$sid)$files[[pub$file_id]]
  expect_identical(meta$kind, "formulario_pdf")
  expect_true(file.exists(meta$path))
  expect_identical(basename(dirname(meta$path)), "downloads")
  # El archivo del job se movio: /api/jobs/<id>/result no es la via.
  expect_false(file.exists(cap$result_path))
})

test_that("item 4: el worker recibe el form_title como titulo, no el nombre del archivo", {
  cap <- .xef_correr(.xef_body_simple())
  expect_identical(cap$payload$options$title, "Encuesta declarada")
  expect_identical(cap$payload$options$footer_title, "Encuesta declarada")
})

test_that("B: el progreso pasa por modelo, dibujando y guardando, en ese orden", {
  fases <- character(0)
  testthat::local_mocked_bindings(
    job_progress_writer = function(progress_path) {
      function(phase = "running", current = NULL, total = NULL, percent = NULL, message = NULL) {
        fases <<- c(fases, phase)
      }
    }
  )
  path <- job_save_rds(session_create(), "xef", list(
    survey = data.frame(type = "text", name = "p1", label = "Nombre", stringsAsFactors = FALSE),
    choices = data.frame(list_name = character(0), name = character(0), label = character(0)),
    settings = data.frame(form_title = "T"), paper = NULL, options = list()))
  out <- xlsform_editor_export_job_runner(path, "pdf", "E_PDF_EXPORT_FAILED", "No pude",
                                          result_path = tempfile(fileext = ".pdf"))
  expect_true(isTRUE(out$ok))
  expect_identical(fases, c("modelo", "dibujando", "guardando"))
})

test_that("item 5: un stop_api del motor viaja con su codigo y mensaje", {
  testthat::local_mocked_bindings(
    formulario_word_render = function(model, output_file) {
      stop_api(500, "E_WORD_DEPS", "Faltan officer/flextable.")
    }
  )
  cap <- .xef_correr(.xef_body_simple(), spec = .xef_spec("docx"))
  expect_false(isTRUE(cap$publico$ok))
  expect_identical(cap$publico$error$code, "E_WORD_DEPS")
  expect_identical(cap$publico$error$status, 500L)
  expect_identical(cap$publico$error$message, "Faltan officer/flextable.")
  expect_length(session_get(cap$sid)$files %||% list(), 0L)
})

test_that("item 5: un error interno no publica el mensaje crudo y lleva error_id", {
  testthat::local_mocked_bindings(
    formulario_pdf_render = function(model, output_file) {
      stop("no existe /Users/alguien/secreto/plantilla.pdf")
    }
  )
  # El crudo SI llega a stderr: en el worker y, de nuevo, en el server al cosechar.
  expect_message(
    cap <- .xef_correr(.xef_body_simple()),
    "E_PDF_EXPORT_FAILED [0-9A-F]{8}: no existe /Users/alguien"
  )
  err <- cap$publico$error
  expect_false(isTRUE(cap$publico$ok))
  expect_identical(err$code, "E_PDF_EXPORT_FAILED")
  expect_identical(err$status, 500L)
  expect_match(err$details$error_id, "^[0-9A-F]{8}$")
  expect_match(err$message, err$details$error_id, fixed = TRUE)
  publicado <- paste(unlist(cap$publico), collapse = " ")
  expect_false(grepl("secreto", publicado, fixed = TRUE))
  expect_false(grepl("/Users", publicado, fixed = TRUE))
  expect_null(cap$publico$.detalle_interno)
})

test_that("item 6: paper_subgroup y paper_subletter viajan del payload al modelo", {
  cols <- c("type", "name", "label", "paper_subgroup", "paper_subletter", "paper_number")
  rows <- list(
    c("select_one sn", "comp", "Competencias:", "D.4. Apoyo de tu familia", "@", ""),
    c("select_one sn", "comp_a", "Liderazgo", "D.4. Apoyo de tu familia", "a", "-"),
    c("select_one sn", "comp_b", "Trabajo en equipo", "D.4. Apoyo de tu familia", "b", "-")
  )
  body <- list(
    workbook = list(
      survey = .xef_sheet(cols, rows),
      choices = .xef_sheet(c("list_name", "name", "label"),
                           list(c("sn", "1", "Si"), c("sn", "2", "No"))),
      settings = .xef_sheet(c("form_title"), list(I("Subgrupos")))
    ),
    options = list(matrix_groups = list(list(
      members = c("comp", "comp_a", "comp_b"), tenor = "", special = "auto")))
  )
  cap <- .xef_correr(body)
  survey <- cap$payload$survey
  expect_identical(survey$paper_subgroup[1], "D.4. Apoyo de tu familia")
  expect_identical(survey$paper_subletter, c("@", "a", "b"))

  model <- formulario_pdf_build_model(survey, cap$payload$choices, cap$payload$settings,
                                      cap$payload$paper, cap$payload$options)
  sub <- Filter(function(b) identical(b$kind, "subsection"), model$blocks)
  expect_length(sub, 1L)
  expect_identical(sub[[1]]$title, "D.4. Apoyo de tu familia")
  mat <- Filter(function(b) identical(b$kind, "matrix"), model$blocks)[[1]]
  expect_identical(vapply(mat$items, function(it) it$subletter, character(1)), c("", "a", "b"))
  expect_true(isTRUE(mat$items[[1]]$is_parent))
  # Madre con numero = 1 pregunta de primer nivel (B2).
  expect_identical(cap$publico$summary$n_questions, 1L)
})

test_that("item 6: sin `columns` en el payload la hoja survey trae la capa paper_* por defecto", {
  df <- .xlsform_editor_payload_to_df(list(rows = list()), "survey")
  expect_true(all(c("paper_subgroup", "paper_subletter", "paper_number", "paper_skip") %in% names(df)))
})

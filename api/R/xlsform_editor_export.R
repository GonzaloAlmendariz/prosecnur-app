# Exportacion del formulario en papel desde el editor XLSForm (PDF y Word).
#
# Las rutas `/api/xlsform-editor/export-pdf` y `/export-word` hacian lo mismo
# con ~60 lineas copiadas: sesion, parseo del workbook, titulo, llamada al
# motor, registro del artefacto. Aqui vive UNA vez; el router solo declara que
# formato pide y con que codigo falla (los literales E_* se quedan en el router,
# que es su modulo en errors_registry.R).
#
# ES UN JOB (decision del lead, 2026-10-15). Medido: el Word de ops_salud (361
# filas) tarda 62 s y el de hsvg2026 15 s; el PDF de ops_salud, 10 s. Un
# endpoint sincrono asi cuelga la UI. Contrato:
#   POST export-pdf | export-word (mismo body de siempre)
#     -> { ok: true, job_id, kind }       kind = "xlsform_editor.formulario_pdf|word"
#   GET /api/jobs/<job_id>  (job_snapshot)
#     progress.phase: "modelo" -> "dibujando" -> "guardando" (y "done" al final)
#     status "done" + result_data = { ok: true, file_id, original_name, size,
#       summary, warnings }  — el mismo objeto que devolvia la ruta sincrona;
#       el archivo queda registrado en la sesion como antes (descarga por
#       /api/files/<file_id>/download). has_file_result = false: /result no aplica.
#     status "done" + result_data = { ok: false, error: { code, status, message,
#       details } } si el motor fallo: un stop_api del motor conserva su codigo
#       y mensaje; cualquier otro error sale como E_PDF_EXPORT_FAILED /
#       E_WORD_EXPORT_FAILED con `details.error_id` y sin el mensaje crudo
#       (patron de error de dominio de los jobs, `jobResultDomainError()`).
#     status "error" solo si el worker mismo murio (infraestructura).

# Titulo impreso (item 4 del checklist 2026-10-15). Orden de prioridad:
#   1. `options$title` si el dialogo lo trae;
#   2. `form_title` de la hoja settings (el titulo que el instrumento declara);
#   3. el nombre del archivo, limpio (`_papel`/`_editado` fuera, `_`/`-` -> " ").
# Antes la ruta rellenaba SIEMPRE el titulo con el nombre del archivo, y el
# fallback del motor a `form_title` (formulario_pdf_build_model) quedaba muerto.
# `footer_title` sigue al titulo salvo que venga explicito.
.xlsform_editor_export_titulo <- function(options, settings, filename, sid = NULL) {
  options <- options %||% list()
  titulo <- trimws(.form_pdf_chr(options$title))
  if (!nzchar(titulo)) {
    titulo <- trimws(.form_pdf_setting(settings, "form_title", ""))
  }
  if (!nzchar(titulo)) {
    titulo <- gsub("[_-]+", " ", .xlsform_editor_nombre_formulario(sid, filename))
  }
  options$title <- titulo
  if (!nzchar(trimws(.form_pdf_chr(options$footer_title)))) options$footer_title <- titulo
  options
}

# Nombre del formulario a partir del archivo que manda el front. El front lo
# deriva del XLSForm abierto (`<nombre>_editado.xlsx` -> `<nombre>_papel.pdf`), y
# ese XLSForm puede ser un entregable con el nombre del ADR 0133 §3
# (`acnur_acg_Instrumento_adaptado_10_11_26.xlsx`). Si el nombre tiene esa forma
# (lo reconoce `.entregable_nombre_heredado()`), se le quitan el código del
# estudio y la fecha: van una sola vez, los pone `entregable_nombre()`. Antes salía
# `acnur_acg_Cuestionario_acnur_acg_Instrumento_adaptado_10_11_26_10_11_26.pdf`.
# No se respeta el nombre tal cual porque es el de otro entregable: el PDF se
# llamaría "Instrumento adaptado" y llevaría la fecha del XLSForm, no la de hoy.
# El código del estudio solo se quita cuando es el de la Ficha; la fecha final se
# quita siempre (QA del 2026-11-10: `ACNURCG_instrumento_adaptado_10_07_26` salía
# con dos fechas porque no tiene la forma completa del §3).
.xlsform_editor_nombre_formulario <- function(sid, filename) {
  stem <- tools::file_path_sans_ext(basename(as.character(filename %||% "")[1]))
  stem <- gsub("(_papel|_editado)+$", "", stem, ignore.case = TRUE)
  s <- if (is.null(sid)) NULL else session_get(sid, required = FALSE)
  if (!is.null(.entregable_nombre_heredado(s, paste0(stem, ".x")))) {
    stem <- substring(stem, nchar(.entregable_estudio(s)) + 2L)
  }
  .xlsform_editor_sin_fecha_final(stem)
}

# Quita un `_dd_mm_yy` final cuando es una fecha válida y queda nombre delante.
.xlsform_editor_sin_fecha_final <- function(stem) {
  fecha <- regmatches(stem, regexpr("_[0-9]{2}_[0-9]{2}_[0-9]{2}$", stem))
  if (!length(fecha)) return(stem)
  if (is.na(as.Date(substring(fecha, 2L), format = "%d_%m_%y"))) return(stem)
  resto <- substring(stem, 1L, nchar(stem) - nchar(fecha))
  if (nzchar(resto)) resto else stem
}

# Traduce un fallo del motor al error de dominio que viaja en `result_data`.
# Un `stop_api` (E_WORD_DEPS, por ejemplo) ya es contrato y viaja tal cual.
# Cualquier otro error es interno: al cliente solo el codigo del formato y la
# referencia; el mensaje crudo de R (suele traer paths del usuario) va aparte en
# `.detalle_interno`, que `on_complete` escribe en el stderr del server y retira
# antes de publicar. Mismo contrato que `stop_internal()` en errors.R.
.xlsform_editor_export_error <- function(e, fail_code, fail_message) {
  if (inherits(e, "api_error")) {
    return(list(ok = FALSE, error = list(
      code = e$code, status = as.integer(e$status %||% 500L),
      message = conditionMessage(e), details = e$details)))
  }
  error_id <- .api_error_id()
  message(sprintf("[prosecnur-app] %s %s: %s", fail_code, error_id, conditionMessage(e)))
  list(
    ok = FALSE,
    error = list(code = fail_code, status = 500L,
                 message = sprintf("%s (ref. %s).", fail_message, error_id),
                 details = list(error_id = error_id)),
    .detalle_interno = conditionMessage(e)
  )
}

# Worker del job (corre en el subproceso callr). Top-level a proposito: el
# bootstrap de jobs.R lo re-resuelve por nombre en el namespace fresco. Recibe
# solo paths y escalares; el workbook viaja en un RDS (`job_save_rds`).
xlsform_editor_export_job_runner <- function(input_path, formato, fail_code, fail_message,
                                             result_path, progress_path = NULL) {
  progreso <- job_progress_writer(progress_path)
  tryCatch({
    p <- readRDS(input_path)
    progreso("modelo", percent = 10, message = "Armando el modelo")
    model <- formulario_pdf_build_model(
      survey = p$survey, choices = p$choices, settings = p$settings,
      paper = p$paper, options = p$options
    )
    progreso("dibujando", percent = 35, message = "Dibujando")
    if (identical(formato, "docx")) {
      formulario_word_render(model, result_path)
    } else {
      formulario_pdf_render(model, result_path)
    }
    progreso("guardando", percent = 90, message = "Guardando")
    list(ok = TRUE, summary = model$summary, warnings = model$warnings)
  }, error = function(e) .xlsform_editor_export_error(e, fail_code, fail_message))
}

# `on_complete` (proceso principal). Registra el artefacto en la sesion igual que
# la ruta sincrona —en downloads/, con el nombre publico— y devuelve el objeto
# publico. Nunca lanza: un fallo aqui se publica como error de dominio.
.xlsform_editor_export_on_complete <- function(sid, spec, filename) {
  force(sid); force(spec); force(filename)
  function(j) {
    data <- j$result_data %||% list()
    tryCatch({
      if (!isTRUE(data$ok)) {
        if (!is.null(data$.detalle_interno)) {
          message(sprintf("[prosecnur-app] %s %s: %s", data$error$code %||% spec$fail_code,
                          data$error$details$error_id %||% "?", data$.detalle_interno))
        }
        if (!is.null(j$result_path)) unlink(j$result_path)
        data$.detalle_interno <- NULL
        if (!is.list(data$error)) {
          data <- .xlsform_editor_export_error(simpleError("el worker no devolvio resultado"),
                                               spec$fail_code, spec$fail_message)
          data$.detalle_interno <- NULL
        }
        return(data)
      }
      if (is.null(j$result_path) || !file.exists(j$result_path)) {
        stop("el worker termino sin escribir el archivo")
      }
      s <- session_get(sid)
      out_path <- file.path(s$dir, "downloads", paste0(uuid::UUIDgenerate(), ".", spec$ext))
      dir.create(dirname(out_path), recursive = TRUE, showWarnings = FALSE)
      if (!file.rename(j$result_path, out_path)) {
        file.copy(j$result_path, out_path, overwrite = TRUE)
        unlink(j$result_path)
      }
      meta <- .register_output_file(sid, .xlsform_editor_registro_kind(spec), out_path, original_name = filename)
      # ADR 0133 (fase 5): los cuatro campos del registro, para el kit de entregables.
      entregable_respuesta(list(
        ok = TRUE,
        file_id = meta$file_id,
        original_name = meta$original_name,
        size = meta$size,
        summary = data$summary,
        warnings = data$warnings %||% character(0)
      ), meta)
    }, error = function(e) {
      out <- .xlsform_editor_export_error(e, spec$fail_code, spec$fail_message)
      out$.detalle_interno <- NULL
      out
    })
  }
}

# Kind con que se registra el archivo: el de la salida, o el propio de una vista
# previa (`spec$registro_kind`). El kind del JOB no cambia: lo leen el front y los
# contratos HTTP.
.xlsform_editor_registro_kind <- function(spec) spec$registro_kind %||% spec$output_kind

.xlsform_editor_es_previa <- function(parsed) {
  isTRUE(as.logical((parsed$previa %||% FALSE)[1])) ||
    identical(as.character((parsed$proposito %||% "")[1]), "previa")
}

# Handler compartido de las dos rutas: valida y prepara en el request (barato)
# y encola el render. `spec`:
#   ext          "pdf" | "docx"
#   output_kind  kind con que se registra el artefacto ("formulario_pdf"...)
#   fail_code    E_* del formato (literal en el router)
#   fail_message frase para el cliente, sin detalle tecnico
.xlsform_editor_export_formulario <- function(req, res, spec) {
  sid <- session_header(req)
  if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
    sid <- session_create()
    res$setHeader("X-Pulso-Session", sid)
  }

  parsed <- .xlsform_editor_parse_body(req)
  workbook <- parsed$workbook %||% list()
  ext <- spec$ext
  filename <- as.character(parsed$filename %||% paste0("formulario_impreso.", ext))[1]
  if (!grepl(paste0("\\.", ext, "$"), filename, ignore.case = TRUE)) {
    filename <- paste0(filename, ".", ext)
  }

  survey <- .xlsform_editor_payload_to_df(workbook$survey, "survey")
  choices <- .xlsform_editor_payload_to_df(workbook$choices, "choices")
  settings <- .xlsform_editor_payload_to_df(workbook$settings, "settings")
  paper <- if (!is.null(workbook$paper)) {
    .xlsform_editor_payload_to_df(workbook$paper, "paper")
  } else {
    .xlsform_editor_empty_df(.xlsform_editor_default_columns("paper"))
  }
  options <- .xlsform_editor_export_titulo(parsed$options %||% list(), settings, filename, sid = sid)
  # ADR 0133 (fase 5): una vista previa (`previa: true` en el cuerpo, o el visor de
  # Word) se registra con su propio kind, sin copia junto al proyecto.
  if (is.null(spec$registro_kind) && .xlsform_editor_es_previa(parsed)) {
    spec$registro_kind <- if (identical(ext, "pdf")) "formulario_pdf_previa" else "formulario_word_visor"
  }
  # ADR 0133 §3: el rótulo del catálogo con el título impreso de detalle; el
  # nombre que manda el front sólo sirve para deducir ese título.
  filename <- .export_filename(sid, .xlsform_editor_registro_kind(spec), ext, detalle = options$title)

  input_path <- job_save_rds(sid, "xlsform_export", list(
    survey = survey, choices = choices, settings = settings, paper = paper, options = options))
  # El visor del Word (L36 · DOC.2) comparte este handler con su propio worker
  # y su propio on_complete; los exports usan los de este archivo.
  runner <- spec$runner %||% xlsform_editor_export_job_runner
  if (is.null(attr(runner, "prosecnur_job_function_name"))) {
    attr(runner, "prosecnur_job_function_name") <- "xlsform_editor_export_job_runner"
  }
  armar_on_complete <- spec$on_complete %||% .xlsform_editor_export_on_complete
  kind <- paste0("xlsform_editor.", spec$output_kind)
  job_id <- tryCatch(
    job_submit(
      sid = sid,
      kind = kind,
      func = runner,
      args = list(input_path = input_path, formato = ext,
                  fail_code = spec$fail_code, fail_message = spec$fail_message),
      result_filename = filename,
      on_complete = armar_on_complete(sid, spec, filename),
      on_cleanup = function(j) job_unlink_inputs(input_path)
    ),
    error = function(e) {
      job_unlink_inputs(input_path)
      stop(e)
    }
  )
  list(ok = TRUE, job_id = job_id, kind = kind)
}

# Export .xlsx del editor como entregable (ADR 0133, fase 5). Antes se guardaba
# con `save_upload(kind = "xlsform")`, como un insumo: entraba a la lista de
# XLSForm de la sesión (el fallback de Carga, los candidatos del traspaso de
# Monitoreo, el XLSForm que viaja dentro del .pulso) aunque sólo era una
# descarga. Ahora es el kind `xlsform_editor_export` (Formularios, se copia),
# con el título del formulario de detalle. `tmp` lo borra el handler al salir:
# aquí se copia a las descargas de la sesión antes de registrarlo.
.xlsform_editor_registrar_xlsx <- function(sid, tmp, settings) {
  destino <- file.path(.session_downloads_dir(sid), paste0(uuid::UUIDgenerate(), ".xlsx"))
  if (!isTRUE(file.copy(tmp, destino, overwrite = TRUE))) {
    stop_internal("no se pudo copiar el XLSForm exportado a las descargas de la sesión")
  }
  titulo <- trimws(.form_pdf_setting(settings, "form_title", ""))
  .register_output_file(sid, "xlsform_editor_export", destino, detalle = if (nzchar(titulo)) titulo else NULL)
}

# Usar en Carga el formulario hecho en el editor del mismo proyecto.
#
# Ítem 23 del checklist de validación del practicante: un proyecto con el
# formulario hecho en Formularios obligaba a exportarlo y volver a subirlo en
# Carga. Aquí se toma el borrador del editor (`s$xlsform_forms`, elegido por
# su id), se escribe como XLSForm con el mismo motor que publica revisiones
# (`.xlsform_revision_materialize`, que deja fuera las columnas `paper_*` de
# la edición) y se registra como el formulario subido de la base única: el
# mismo camino que `POST /api/carga/instrumento` con un archivo.
#
# Escritura: el formulario de la sesión (base única, `s$instrumento`) y, si ya
# hay respuestas, la base "default" que arma `estudio_init_default_base()`. Es
# una copia del borrador en ese momento: lo que se edite después en
# Formularios no cambia la base hasta volver a usarlo.

#' Registra un XLSForm subido como el formulario de la base única.
#'
#' Lo comparten la subida de un archivo y el formulario del editor. Un
#' formulario que no se puede leer no queda como el último subido.
#' @keywords internal
.carga_procesar_instrumento <- function(sid, meta) {
  inst <- .carga_sin_rastro_si_falla(sid, meta$file_id, leer_instrumento_xlsform(meta$path))
  session_set(sid, "instrumento", inst)
  session_set(sid, "inst_limpieza", NULL)
  # Si ya hay data subida, esto auto-crea/refresca la base "default" del
  # estudio para que Validación y Codificación encuentren el par
  # formulario+respuestas. No-op si todavía falta la data.
  tryCatch(estudio_init_default_base(sid),
           error = function(e) {
             message("[carga] estudio_init_default_base falló: ", conditionMessage(e))
           })
  list(ok = TRUE, resumen = summarize_instrumento(inst))
}

#' El formulario del editor, escrito como XLSForm y registrado en la sesión.
#'
#' @param sid sesión.
#' @param form_id id del formulario en `s$xlsform_forms`.
#' @return `meta` del archivo subido (kind "xlsform").
#' @keywords internal
.carga_subir_formulario_del_editor <- function(sid, form_id) {
  form_id <- trimws(as.character(form_id %||% "")[1])
  if (is.na(form_id) || !nzchar(form_id)) {
    stop_api(400, "E_FORM_NOT_FOUND", "Elige el formulario del editor que usa esta base.")
  }
  s <- .xlsform_forms_seed_from_legacy(session_get(sid))
  entry <- .xlsform_forms_get(s, form_id)
  if (is.null(entry)) {
    stop_api(404, "E_FORM_NOT_FOUND",
             sprintf("El proyecto no tiene un formulario en el editor con el id \"%s\".", form_id))
  }
  conteo <- .xlsform_forms_survey_counts(entry$workbook %||% list())
  if (!isTRUE(conteo$n_questions > 0L)) {
    stop_api(400, "E_FORM_MISSING_WORKBOOK",
             sprintf("El formulario \"%s\" del editor no tiene preguntas que reciban respuesta.",
                     as.character(entry$name %||% form_id)[1]))
  }
  bytes <- .xlsform_revision_materialize(entry$workbook)
  nombre <- as.character(entry$name %||% "")[1]
  if (is.na(nombre) || !nzchar(nombre)) nombre <- "formulario"
  # El nombre del archivo lleva el del formulario: así se reconoce en Carga y en el `.pulso`.
  save_upload(sid, "xlsform", sprintf("%s.xlsx", .slug_code(nombre)), bytes)
}

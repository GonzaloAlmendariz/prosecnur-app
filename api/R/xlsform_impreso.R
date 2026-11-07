# =============================================================================
# Editor XLSForm — opciones de Impreso guardadas en el .pulso (L36 · DOC.4)
# =============================================================================
# Las opciones del papel (columnas, lógica, matrices, título…) vivían sólo en
# localStorage: otra máquina abría el mismo .pulso con el papel por defecto.
# Ahora cada formulario de `s$xlsform_forms` lleva
# `impreso = {opciones, guardado_en, versiones}`. `opciones` es el
# `PdfDialogState` del front serializado como texto JSON: R no lo interpreta, el
# front lo valida campo a campo al leerlo. Diseño:
# docs/qa/l36-doc0-direccion-cuestionario-2026-11-01.md (D-L36-15 a 18).
# =============================================================================

.XLSFORM_IMPRESO_MAX_BYTES <- 200000L
.XLSFORM_IMPRESO_MAX_VERSIONES <- 10L

#' Valida las opciones serializadas: un objeto JSON de tamaño razonable
#' @keywords internal
.xlsform_impreso_opciones <- function(opciones) {
  texto <- if (is.character(opciones)) opciones[1] else NA_character_
  valido <- !is.na(texto) && nzchar(texto) && nchar(texto, type = "bytes") <= .XLSFORM_IMPRESO_MAX_BYTES
  if (valido) {
    parsed <- tryCatch(jsonlite::fromJSON(texto, simplifyVector = FALSE), error = function(e) NULL)
    valido <- is.list(parsed) && (length(parsed) == 0L || !is.null(names(parsed)))
  }
  if (!valido) {
    stop_api(400, "E_IMPRESO_OPCIONES_INVALIDAS",
             "Las opciones de Impreso deben ser un objeto JSON de hasta 200 KB.")
  }
  texto
}

#' Estado de Impreso de una entrada, siempre con la misma forma
#' @keywords internal
.xlsform_impreso_de <- function(entry) {
  imp <- entry$impreso %||% list()
  versiones <- Filter(function(v) is.list(v) && nzchar(as.character(v$nombre %||% "")[1]), imp$versiones %||% list())
  list(
    opciones = as.character(imp$opciones %||% "")[1],
    guardado_en = as.character(imp$guardado_en %||% "")[1],
    versiones = unname(lapply(versiones, function(v) list(
      nombre = as.character(v$nombre)[1],
      opciones = as.character(v$opciones %||% "")[1],
      guardado_en = as.character(v$guardado_en %||% "")[1]
    )))
  )
}

.xlsform_impreso_entrada <- function(s, form_id) {
  form_id <- as.character(form_id %||% "")[1]
  entry <- if (is.null(s)) NULL else .xlsform_forms_get(s, form_id)
  if (is.null(entry)) {
    stop_api(404, "E_FORM_NOT_FOUND", sprintf("No existe el formulario '%s'.", form_id))
  }
  entry
}

# Escribe `impreso` sin pasar por el upsert: no cambia el workbook ni su
# `saved_at`, así que la publicación y el espejo legacy no se tocan.
.xlsform_impreso_escribir <- function(sid, s, form_id, impreso) {
  s$xlsform_forms[[form_id]]$impreso <- impreso
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  list(ok = TRUE, impreso = impreso)
}

#' Lee las opciones de Impreso de un formulario
#' @keywords internal
xlsform_impreso_leer <- function(sid, form_id) {
  s <- session_get(sid, required = FALSE)
  list(ok = TRUE, impreso = .xlsform_impreso_de(.xlsform_impreso_entrada(s, form_id)))
}

#' Guarda las opciones actuales de Impreso (D-L36-16)
#' @keywords internal
xlsform_impreso_guardar <- function(sid, form_id, opciones) {
  s <- session_get(sid, required = FALSE)
  entry <- .xlsform_impreso_entrada(s, form_id)
  impreso <- .xlsform_impreso_de(entry)
  impreso$opciones <- .xlsform_impreso_opciones(opciones)
  impreso$guardado_en <- .xlsform_forms_now()
  .xlsform_impreso_escribir(sid, s, entry$id, impreso)
}

#' Guarda una versión con nombre (D-L36-17): la más nueva primero, hasta 10
#'
#' Repetir un nombre reemplaza esa versión. Las opciones de la versión pasan a
#' ser también las actuales: lo que se guarda es lo que se está viendo.
#' @keywords internal
xlsform_impreso_guardar_version <- function(sid, form_id, nombre, opciones) {
  s <- session_get(sid, required = FALSE)
  entry <- .xlsform_impreso_entrada(s, form_id)
  nombre <- trimws(as.character(nombre %||% "")[1])
  if (is.na(nombre) || !nzchar(nombre)) {
    stop_api(400, "E_IMPRESO_VERSION_SIN_NOMBRE", "La versión necesita un nombre.")
  }
  nombre <- substr(nombre, 1L, 80L)
  texto <- .xlsform_impreso_opciones(opciones)
  ahora <- .xlsform_forms_now()
  impreso <- .xlsform_impreso_de(entry)
  otras <- Filter(function(v) !identical(v$nombre, nombre), impreso$versiones)
  impreso$versiones <- utils::head(
    c(list(list(nombre = nombre, opciones = texto, guardado_en = ahora)), otras),
    .XLSFORM_IMPRESO_MAX_VERSIONES
  )
  impreso$opciones <- texto
  impreso$guardado_en <- ahora
  .xlsform_impreso_escribir(sid, s, entry$id, impreso)
}

mount_xlsform_impreso <- function(pr) {
  pr |>
    plumber::pr_get("/api/xlsform-editor/forms/<id>/impreso", wrap_endpoint(function(req, res, id = "", ...) {
      xlsform_impreso_leer(session_header(req), id)
    })) |>
    plumber::pr_post("/api/xlsform-editor/forms/<id>/impreso", wrap_endpoint(function(req, res, id = "", ...) {
      parsed <- .xlsform_editor_parse_body(req)
      xlsform_impreso_guardar(session_header(req), id, parsed$opciones)
    })) |>
    plumber::pr_post("/api/xlsform-editor/forms/<id>/impreso/versiones", wrap_endpoint(function(req, res, id = "", ...) {
      parsed <- .xlsform_editor_parse_body(req)
      xlsform_impreso_guardar_version(session_header(req), id, parsed$nombre, parsed$opciones)
    }))
}

# =============================================================================
# Editor XLSForm — lógica y limpieza hechas fuera de Prosecnur
# =============================================================================
# Caso frecuente (Gonzalo, 2026-10-14): el analista ya aplicó la lógica y limpió
# la base en otro programa (SPSS, un script de R). Sólo quiere el instrumento en
# XLSForm para cargar su base limpia y llegar a Gráficos. Exigirle confirmar en
# la app una lógica que no se va a usar es fricción, no control.
#
# La declaración es por formulario y queda trazada: `logic_status =
# "external_declared"` más `logic_external = {herramienta, nota, declarada_en}`.
# Con ese estado `.xlsform_revision_logic_blockers` no bloquea la publicación
# (sólo bloquea `pending_manual_confirmation` y una confirmación vencida), y la
# auditoría de la revisión publicada guarda el método. Deshacerla devuelve el
# formulario a «pendiente de confirmación». La base limpia entra después por
# Carga como base de partida declarada (ADR 0100).
# =============================================================================

.XLSFORM_LOGICA_EXTERNA <- "external_declared"

#' Declara (o retira) que la lógica y la limpieza se hicieron fuera de Prosecnur
#' @keywords internal
xlsform_logica_externa_declarar <- function(sid, form_id, declarada = TRUE, herramienta = NULL, nota = NULL) {
  s <- session_get(sid, required = FALSE)
  form_id <- as.character(form_id %||% "")[1]
  entry <- if (is.null(s)) NULL else .xlsform_forms_get(s, form_id)
  if (is.null(entry)) {
    stop_api(404, "E_FORM_NOT_FOUND", sprintf("No existe el formulario '%s'.", form_id))
  }
  source <- .xlsform_forms_sanitize_source(entry$source %||% list())
  now <- .xlsform_forms_now()
  if (isTRUE(declarada)) {
    herramienta <- trimws(as.character(herramienta %||% "")[1])
    nota <- trimws(as.character(nota %||% "")[1])
    source$logic_status <- .XLSFORM_LOGICA_EXTERNA
    source$logic_confirmation_method <- "external_declared"
    source$logic_confirmed_at <- now
    source$logic_external <- list(
      herramienta = if (is.na(herramienta) || !nzchar(herramienta)) "otro programa" else herramienta,
      nota = if (is.na(nota)) "" else nota,
      declarada_en = now
    )
  } else {
    if (!identical(as.character(source$logic_status %||% "")[1], .XLSFORM_LOGICA_EXTERNA)) {
      stop_api(409, "E_LOGICA_EXTERNA_NO_DECLARADA",
               "Este formulario no tiene declarada la lógica hecha fuera de Prosecnur.")
    }
    # La procedencia se fusiona (`.xlsform_forms_merge_source`): asignar NULL no
    # borra la clave guardada, así que se vacía explícitamente.
    source$logic_status <- "pending_manual_confirmation"
    source$logic_confirmation_method <- ""
    source$logic_confirmed_at <- ""
    source$logic_external <- list()
  }
  entry$source <- source
  entry$saved_at <- now
  s <- .xlsform_forms_upsert(s, entry)
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  fresh <- .xlsform_forms_get(s, form_id)
  list(
    ok = TRUE,
    source = fresh$source,
    publication = .xlsform_revision_publication(s, fresh)
  )
}

mount_xlsform_logica_externa <- function(pr) {
  pr |>
    plumber::pr_post("/api/xlsform-editor/forms/<id>/logica-externa", wrap_endpoint(function(req, res, id = "", ...) {
      parsed <- .xlsform_editor_parse_body(req)
      xlsform_logica_externa_declarar(
        session_header(req), id,
        declarada = !isFALSE(parsed$declarada),
        herramienta = parsed$herramienta,
        nota = parsed$nota
      )
    }))
}

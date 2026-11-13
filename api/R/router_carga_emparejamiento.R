# Carga: emparejar las columnas de la base por el texto de la pregunta (ítem 4).
#
# POST /api/carga/data/emparejamiento-texto          { file_id }
#   Propuesta para el archivo subido (carga_emparejar_por_texto.R). No carga
#   nada y retira la subida del registro: la propuesta se revisa y, si se
#   acepta, la base se vuelve a subir para aplicarla.
# POST /api/carga/data/emparejamiento-texto/aplicar  { file_id, parejas: [{columna, encabezado, name}] }
#   Carga la base con los encabezados renombrados
#   (carga_emparejar_por_texto_aplicar.R). Si falla, la sesión queda como antes.

.cet_meta_de_respuestas <- function(sid, file_id) {
  file_id <- as.character(file_id %||% "")[1]
  if (is.na(file_id) || !nzchar(file_id)) stop_api(400, "E_MISSING_FILE_ID", "Body must include file_id")
  meta <- get_file(sid, file_id)
  if (!(meta$kind %in% c("data"))) {
    stop_api(400, "E_WRONG_KIND", "El emparejamiento por texto recibe un archivo de respuestas (.xlsx, .xls o .csv).")
  }
  meta
}

#' @keywords internal
mount_carga_emparejamiento <- function(pr) {
  pr |>
    plumber::pr_post("/api/carga/data/emparejamiento-texto", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .carga_parse_json_body(req)
      meta <- .cet_meta_de_respuestas(sid, body$file_id)
      on.exit({
        s <- session_get(sid, required = FALSE)
        if (!is.null(s) && is.list(s$files)) {
          s$files[[as.character(meta$file_id)]] <- NULL
          session_set(sid, "files", s$files)
        }
      }, add = TRUE)
      c(list(ok = TRUE), carga_emparejar_por_texto_propuesta(sid, meta))
    })) |>
    plumber::pr_post("/api/carga/data/emparejamiento-texto/aplicar", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .carga_parse_json_body(req)
      meta <- .cet_meta_de_respuestas(sid, body$file_id)
      .carga_sin_rastro_si_falla(sid, meta$file_id,
                                 carga_emparejar_por_texto_aplicar(sid, meta, body$parejas %||% list()))
    }))
}

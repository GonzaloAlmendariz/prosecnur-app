# Router de gestión del estudio y sus bases (v0.2+, multi-base).
#
# Un "estudio" es el contenedor de 1..8 bases (pares instrumento+data).
# La Fase 1 de la UI lo usa para armar el estudio base por base antes
# de analizar.
#
# Endpoints:
#   GET    /api/estudio                     → metadata del estudio + lista de bases
#   PATCH  /api/estudio                     → renombrar el estudio
#   POST   /api/estudio/base                → agregar una base (body: nombre, xlsform_file_id, data_file_id)
#   DELETE /api/estudio/base/<nombre>       → quitar una base
#   PATCH  /api/estudio/base/<nombre>       → renombrar una base (body: nombre_nuevo)
#
# El flujo típico del frontend:
#   1) Sube XLSForm y data con /api/files/upload (ya existente).
#   2) POST /api/estudio/base con los file_ids y un nombre → el router
#      lee ambos archivos, construye rp_inst + rp_data y los guarda en
#      la sesión bajo el nombre dado.
#   3) Repetir 1-2 por cada base del estudio (hasta 8).

# Convierte el metadata de una base en un payload serializable. Excluye
# los rp_data / rp_inst que son objetos R pesados.
.estudio_base_payload <- function(meta) {
  list(
    nombre          = meta$nombre,
    xlsform_file_id = meta$xlsform_file_id,
    data_file_id    = meta$data_file_id,
    data_ext        = meta$data_ext,
    n_filas         = meta$n_filas,
    n_columnas      = meta$n_columnas,
    added_at        = meta$added_at
  )
}

# Payload completo del estudio para GET /api/estudio y session/state.
.estudio_payload <- function(sid) {
  bases <- estudio_list_bases(sid)
  s <- session_get(sid, required = FALSE)
  list(
    nombre   = if (is.null(s) || is.null(s$estudio)) NULL else s$estudio$nombre,
    n_bases  = length(bases),
    bases    = lapply(bases, .estudio_base_payload),
    max_bases = .ESTUDIO_MAX_BASES
  )
}

mount_estudio <- function(pr) {
  pr |>
    plumber::pr_get("/api/estudio", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      if (is.null(session_get(sid, required = FALSE))) {
        # Sin sesión todavía: devolvemos un estudio vacío (mejor que 404).
        return(list(nombre = NULL, n_bases = 0L, bases = list(), max_bases = .ESTUDIO_MAX_BASES))
      }
      .estudio_payload(sid)
    })) |>
    plumber::pr_handle("PATCH", "/api/estudio", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(session_get(sid, required = FALSE))) stop_api(404, "E_NO_SESSION", "Sin sesión.")
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      nombre <- parsed$nombre
      estudio_set_nombre(sid, nombre)
      .estudio_payload(sid)
    })) |>
    plumber::pr_post("/api/estudio/base", wrap_endpoint(function(req, res, ...) {
      # Agrega una base al estudio actual. Lee xlsform y data del file
      # store usando los file_ids que el frontend subió previamente.
      sid <- session_header(req)
      if (is.null(session_get(sid, required = FALSE))) {
        # Si no hay sesión aún, creamos una para arrancar el estudio.
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      nombre          <- as.character(parsed$nombre %||% "")
      xlsform_file_id <- as.character(parsed$xlsform_file_id %||% "")
      data_file_id    <- as.character(parsed$data_file_id %||% "")
      if (!nzchar(nombre))          stop_api(400, "E_MISSING_NOMBRE", "Falta 'nombre' de la base.")
      if (!nzchar(xlsform_file_id)) stop_api(400, "E_MISSING_XLSFORM", "Falta 'xlsform_file_id'.")
      if (!nzchar(data_file_id))    stop_api(400, "E_MISSING_DATA",    "Falta 'data_file_id'.")

      # Resolver los archivos del file store de la sesión.
      xls_meta <- get_file(sid, xlsform_file_id)
      dat_meta <- get_file(sid, data_file_id)
      data_ext <- tolower(tools::file_ext(dat_meta$original_name))
      if (!nzchar(data_ext)) data_ext <- tolower(tools::file_ext(dat_meta$path))

      # Parsear instrumento + data igual que hace /api/system/demo.
      rp_inst <- reporte_instrumento(path = xls_meta$path)
      data_df <- .read_data_from_path(dat_meta$path)
      rp_data <- reporte_data(data_df, instrumento = rp_inst)

      base_meta <- estudio_add_base(
        sid,
        nombre          = nombre,
        xlsform_file_id = xlsform_file_id,
        data_file_id    = data_file_id,
        data_ext        = data_ext,
        rp_data         = rp_data,
        rp_inst         = rp_inst,
        n_filas         = as.integer(nrow(data_df)),
        n_columnas      = as.integer(ncol(data_df))
      )

      # Si es la primera base, también seteamos analitica_prep_ok y
      # analitica_fuente para preservar el contrato legacy con el frontend.
      if (length(estudio_list_bases(sid)) == 1L) {
        session_set(sid, "analitica_prep_ok", TRUE)
        session_set(sid, "analitica_fuente", sprintf("estudio:%s", nombre))
      }

      list(
        ok        = TRUE,
        base      = .estudio_base_payload(base_meta),
        n_bases   = length(estudio_list_bases(sid)),
        max_bases = .ESTUDIO_MAX_BASES
      )
    })) |>
    plumber::pr_delete("/api/estudio/base/<nombre>", wrap_endpoint(function(req, res, nombre) {
      sid <- session_header(req)
      if (is.null(session_get(sid, required = FALSE))) stop_api(404, "E_NO_SESSION", "Sin sesión.")
      estudio_remove_base(sid, as.character(nombre))
      list(ok = TRUE, n_bases = length(estudio_list_bases(sid)))
    })) |>
    plumber::pr_handle("PATCH", "/api/estudio/base/<nombre>", wrap_endpoint(function(req, res, nombre, ...) {
      sid <- session_header(req)
      if (is.null(session_get(sid, required = FALSE))) stop_api(404, "E_NO_SESSION", "Sin sesión.")
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      nombre_nuevo <- as.character(parsed$nombre_nuevo %||% "")
      if (!nzchar(nombre_nuevo)) stop_api(400, "E_MISSING_NOMBRE", "Falta 'nombre_nuevo'.")
      estudio_rename_base(sid, as.character(nombre), nombre_nuevo)
      .estudio_payload(sid)
    }))
}

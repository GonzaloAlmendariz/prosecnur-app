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

    # Convierte un single-base legacy (XLSForm + data cargados via
    # /api/carga/instrumento + /api/carga/data) en un estudio multi-base
    # con UNA base inicial con el nombre que el usuario elija. Reutiliza
    # los archivos ya subidos al file store — el usuario no vuelve a
    # subir. Body: { nombre: "docentes" }.
    plumber::pr_post("/api/estudio/from-session", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      s <- session_get(sid)

      # Si ya hay un estudio inicializado con bases, esto es no-op — el
      # endpoint solo convierte single-base legacy.
      if (!is.null(s$estudio) && length(s$estudio$bases) > 0L) {
        stop_api(409, "E_ALREADY_MULTIBASE",
                 "Este estudio ya tiene bases. Usa POST /api/estudio/base para agregar otras.")
      }

      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      nombre <- as.character(parsed$nombre %||% "")
      if (!nzchar(nombre)) stop_api(400, "E_MISSING_NOMBRE", "Falta 'nombre' de la base.")
      if (grepl("\\$|\\s", nombre)) {
        stop_api(400, "E_BASE_NOMBRE_INVALIDO",
                 "El nombre no puede contener '$' ni espacios.")
      }

      # Tomar los últimos files del session store con kind correcto.
      files <- s$files %||% list()
      xls_meta <- NULL
      dat_meta <- NULL
      for (fid in names(files)) {
        f <- files[[fid]]
        if (identical(f$kind, "xlsform")) xls_meta <- f
        if (f$kind %in% c("data", "sav"))  dat_meta <- f
      }
      if (is.null(xls_meta)) stop_api(409, "E_NO_XLSFORM", "No hay XLSForm cargado en la sesión.")
      if (is.null(dat_meta)) stop_api(409, "E_NO_DATA",    "No hay base de datos cargada en la sesión.")

      # Re-parsear con reporte_instrumento + reporte_data (el single-base
      # legacy usaba `leer_instrumento_xlsform` que es más ligero y no
      # produce el objeto rp_inst que el estudio multi-base necesita).
      rp_inst <- reporte_instrumento(path = xls_meta$path)
      data_df <- .read_data_from_path(dat_meta$path)
      rp_data <- reporte_data(data_df, instrumento = rp_inst)

      data_ext <- tolower(tools::file_ext(dat_meta$original_name %||% dat_meta$path))

      base_meta <- estudio_add_base(
        sid,
        nombre          = nombre,
        xlsform_file_id = xls_meta$file_id,
        data_file_id    = dat_meta$file_id,
        data_ext        = data_ext,
        rp_data         = rp_data,
        rp_inst         = rp_inst,
        n_filas         = as.integer(nrow(data_df)),
        n_columnas      = as.integer(ncol(data_df))
      )

      # Limpiar artefactos single-base que ya quedaron obsoletos tras la
      # promoción a multi-base (rp_data_sources ya tiene el mirror).
      session_set(sid, "instrumento",   NULL)
      session_set(sid, "inst_limpieza", NULL)
      session_set(sid, "data_raw_meta", NULL)
      # analitica_prep_ok ya lo setea estudio_add_base cuando es primera.
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
    plumber::pr_get("/api/estudio/codif-source", wrap_endpoint(function(req, res) {
      # Devuelve la base actualmente activa para codificación + las
      # opciones disponibles (todas las bases del estudio).
      sid <- session_header(req)
      if (is.null(session_get(sid, required = FALSE))) {
        return(list(active = NULL, options = list()))
      }
      bases <- names(estudio_list_bases(sid))
      list(
        active = codif_source_active(sid),
        options = as.list(bases)
      )
    })) |>
    plumber::pr_post("/api/estudio/codif-source", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      if (is.null(session_get(sid, required = FALSE))) stop_api(404, "E_NO_SESSION", "Sin sesión.")
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      source <- as.character(parsed$source %||% "")
      if (!nzchar(source)) stop_api(400, "E_MISSING_SOURCE", "Falta 'source' en el body.")
      codif_source_set(sid, source)
      list(ok = TRUE, active = codif_source_active(sid))
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

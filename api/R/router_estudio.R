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
# IMPORTANTE: jsonlite serializa NULL dentro de un named list como `{}`
# (objeto vacío), lo que rompe el frontend cuando React intenta
# renderizarlo. Usamos NA_character_ para que salga como `null` JSON.
.estudio_payload <- function(sid) {
  bases <- estudio_list_bases(sid)
  s <- session_get(sid, required = FALSE)
  nombre_raw <- if (is.null(s) || is.null(s$estudio)) NULL else s$estudio$nombre
  list(
    nombre   = if (is.null(nombre_raw) || !nzchar(nombre_raw)) NA_character_ else nombre_raw,
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
      # Si el frontend no manda nombre, generamos uno automático libre
      # (base_1, base_2, …). Esto habilita el flujo de "+ Agregar otra
      # base" sin fricción — el usuario renombra después.
      if (!nzchar(nombre)) nombre <- estudio_next_auto_name(sid)
      if (!nzchar(xlsform_file_id)) stop_api(400, "E_MISSING_XLSFORM", "Falta 'xlsform_file_id'.")
      if (!nzchar(data_file_id))    stop_api(400, "E_MISSING_DATA",    "Falta 'data_file_id'.")

      # Resolver los archivos del file store de la sesión.
      xls_meta <- get_file(sid, xlsform_file_id)
      dat_meta <- get_file(sid, data_file_id)
      data_ext <- tolower(dat_meta$ext %||% tools::file_ext(dat_meta$original_name))
      if (!nzchar(data_ext)) data_ext <- tolower(tools::file_ext(dat_meta$path))

      # Parsear instrumento + data igual que hace /api/system/demo.
      rp_inst <- reporte_instrumento(path = xls_meta$path)
      data_df <- .read_data_from_path(dat_meta$path, dat_meta$ext)
      data_df <- normalize_data_for_xlsform(data_df, rp_inst)
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
      # Auto-generar nombre si el frontend no lo manda — esto es el
      # caso cuando se convierte silenciosamente single → multi desde
      # el botón "+ Agregar otra base".
      if (!nzchar(nombre)) nombre <- estudio_next_auto_name(sid)
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
      data_df <- .read_data_from_path(dat_meta$path, dat_meta$ext)
      data_df <- normalize_data_for_xlsform(data_df, rp_inst)
      rp_data <- reporte_data(data_df, instrumento = rp_inst)

      data_ext <- tolower(dat_meta$ext %||% tools::file_ext(dat_meta$original_name %||% dat_meta$path))

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
    })) |>

    # PATCH /api/estudio/base/<nombre>/files
    # Reemplaza el XLSForm y/o la data de una base existente. El usuario
    # puede enviar xlsform_file_id, data_file_id o ambos. Re-parsea lo que
    # cambia y actualiza los maps internos. Invalida artefactos derivados
    # (evaluación, plan_result, analítica preparada) porque la base
    # cambió.
    plumber::pr_handle("PATCH", "/api/estudio/base/<nombre>/files",
      wrap_endpoint(function(req, res, nombre, ...) {
      sid <- session_header(req)
      if (is.null(session_get(sid, required = FALSE))) stop_api(404, "E_NO_SESSION", "Sin sesión.")
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      xls_fid <- as.character(parsed$xlsform_file_id %||% "")
      dat_fid <- as.character(parsed$data_file_id    %||% "")
      if (!nzchar(xls_fid) && !nzchar(dat_fid)) {
        stop_api(400, "E_NOTHING_TO_REPLACE",
                 "Envia al menos xlsform_file_id o data_file_id.")
      }

      # Necesitamos el instrumento (nuevo o actual) para re-parsear la
      # data, porque reporte_data depende de rp_inst.
      s <- session_get(sid)
      base_actual <- s$estudio$bases[[as.character(nombre)]]
      if (is.null(base_actual)) stop_api(404, "E_BASE_NOT_FOUND",
                                         sprintf("Base '%s' no existe.", nombre))

      new_rp_inst <- NULL
      if (nzchar(xls_fid)) {
        xls_meta <- get_file(sid, xls_fid)
        new_rp_inst <- reporte_instrumento(path = xls_meta$path)
      }
      # Si no se reemplaza XLSForm, uso el que ya estaba para re-parsear
      # data (si es que se reemplaza).
      rp_inst_efectivo <- new_rp_inst %||% s$rp_inst_sources[[as.character(nombre)]]

      new_rp_data <- NULL
      new_data_ext <- NULL
      n_filas_new <- NA_integer_
      n_cols_new  <- NA_integer_
      if (nzchar(dat_fid)) {
        dat_meta <- get_file(sid, dat_fid)
        new_data_ext <- tolower(dat_meta$ext %||% tools::file_ext(dat_meta$original_name %||% dat_meta$path))
        data_df <- .read_data_from_path(dat_meta$path, dat_meta$ext)
        data_df <- normalize_data_for_xlsform(data_df, rp_inst_efectivo)
        new_rp_data <- reporte_data(data_df, instrumento = rp_inst_efectivo)
        n_filas_new <- as.integer(nrow(data_df))
        n_cols_new  <- as.integer(ncol(data_df))
      } else if (nzchar(xls_fid)) {
        # Reemplazo solo de XLSForm: re-parsear la data actual con el
        # nuevo instrumento para mantener consistencia.
        dat_meta <- get_file(sid, base_actual$data_file_id)
        data_df <- .read_data_from_path(dat_meta$path, dat_meta$ext)
        data_df <- normalize_data_for_xlsform(data_df, new_rp_inst)
        new_rp_data <- reporte_data(data_df, instrumento = new_rp_inst)
        n_filas_new <- as.integer(nrow(data_df))
        n_cols_new  <- as.integer(ncol(data_df))
      }

      estudio_replace_base_files(
        sid, as.character(nombre),
        xlsform_file_id = if (nzchar(xls_fid)) xls_fid else NULL,
        data_file_id    = if (nzchar(dat_fid)) dat_fid else NULL,
        data_ext        = new_data_ext,
        rp_data         = new_rp_data,
        rp_inst         = new_rp_inst,
        n_filas         = n_filas_new,
        n_columnas      = n_cols_new
      )

      # Invalidar artefactos que dependían de la versión anterior.
      session_set(sid, "evaluacion",  NULL)
      session_set(sid, "plan_result", NULL)
      session_set(sid, "analitica_prep_ok", FALSE)

      .estudio_payload(sid)
    })) |>

    # POST /api/estudio/init
    # Marca la sesión como "va a ser multi-base" creando un estudio
    # vacío (sin bases todavía). Habilita que el usuario active el
    # toggle antes de subir archivos — la UI muestra el BasesPanel en
    # estado vacío con el form de "Agregar base" listo. Si ya existe
    # un estudio con bases, no hace nada (idempotente).
    plumber::pr_post("/api/estudio/init", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      if (is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      estudio_ensure(sid)
      .estudio_payload(sid)
    })) |>

    # POST /api/estudio/downgrade-to-single
    # Si el estudio tiene exactamente 1 base, la "baja" al estado
    # single-base legacy (s$instrumento, s$data_raw_meta, s$rp_data,
    # s$rp_inst) y destruye el estudio. Permite al usuario volver al
    # flujo de carga simple sin perder los archivos cargados. Rechaza
    # si hay 0 bases (nada que degradar) o >1 bases (no es reversible
    # sin pérdida).
    plumber::pr_post("/api/estudio/downgrade-to-single", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      if (is.null(s$estudio)) {
        stop_api(409, "E_NOT_MULTIBASE", "No hay estudio activo para degradar.")
      }
      # Caso especial: estudio vacío (init sin haber subido bases).
      # Apagar el toggle solo destruye el estudio — no hay archivos que
      # restaurar porque nunca se crearon bases.
      if (length(s$estudio$bases) == 0L) {
        session_set(sid, "estudio", NULL)
        session_set(sid, "rp_data_sources", list())
        session_set(sid, "rp_inst_sources", list())
        return(list(ok = TRUE))
      }
      if (length(s$estudio$bases) > 1L) {
        stop_api(409, "E_MULTIPLE_BASES",
                 "El estudio tiene varias bases. Quita las extras antes de volver al modo simple.")
      }

      base <- s$estudio$bases[[1]]
      xls_meta <- get_file(sid, base$xlsform_file_id)
      dat_meta <- get_file(sid, base$data_file_id)

      # Restaurar single-base state que el frontend consume desde
      # /session/state para renderizar los dos boxes como "cargados".
      inst_light <- leer_instrumento_xlsform(xls_meta$path)
      session_set(sid, "instrumento", inst_light)
      session_set(sid, "data_raw_meta", list(
        file_id = base$data_file_id,
        path    = dat_meta$path,
        ext     = base$data_ext %||% dat_meta$ext %||% tolower(tools::file_ext(dat_meta$original_name %||% dat_meta$path))
      ))
      # rp_data / rp_inst ya están en s (mirror de la primera base). Los
      # dejamos intactos: la analítica sigue operando como legacy single.

      # Destruir el estudio (y los maps _sources).
      session_set(sid, "estudio",         NULL)
      session_set(sid, "rp_data_sources", list())
      session_set(sid, "rp_inst_sources", list())
      session_set(sid, "analitica_fuente", "legacy:single")

      list(ok = TRUE)
    }))
}

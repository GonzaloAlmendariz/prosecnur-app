.shutdown_flag <- new.env(parent = emptyenv())
.shutdown_flag$value <- FALSE

shutdown_requested <- function() isTRUE(.shutdown_flag$value)

# ===========================================================================
# Catálogo de datasets de prueba
# ===========================================================================
#
# Cada entrada describe un par (instrumento, data) listo para cargar con
# /api/system/demo?name=<X>. El frontend pide /api/system/demos para ver
# cuáles están disponibles.
#
# Reglas de ubicación:
#   - `instrumento_file` y `data_file` son rutas RELATIVAS a la carpeta de
#     samples (`api/inst/samples/` en dev, o `system.file("samples", ...)`
#     cuando el paquete está instalado).
#   - Solo se sirven los demos cuyos archivos EXISTEN en disco. Los que
#     faltan se filtran silenciosamente.
#
# Para añadir un dataset nuevo:
#   1. Copia los archivos a `api/inst/samples/<subdir>/`.
#   2. Añade una entrada acá.
#   3. Reinicia el backend — aparece automático en la UI si los archivos
#      están, no requiere tocar frontend.
.DEMOS_META <- list(
  generic = list(
    name             = "generic",
    titulo_humano    = "Demo genérica (prosecnur)",
    descripcion      = "Dataset compacto de ejemplo, ideal para explorar la app sin datos reales. Pocas preguntas, variadas (Likert, select_one, integer).",
    icono_ui         = "FileText",
    etiqueta_estudio = "Exploratorio",
    instrumento_file = "demo_instrumento.xlsx",
    data_file        = "demo_data.xlsx"
  ),
  ops_salud = list(
    name             = "ops_salud",
    titulo_humano    = "OPS — Establecimientos de Salud",
    descripcion      = "Encuesta a ~120 establecimientos de salud del Perú en 5 regiones (Callao, La Libertad, SJL, Tacna, Tumbes). Incluye escalas Likert, multi-select y ejemplos de categorización jerárquica.",
    icono_ui         = "Activity",
    etiqueta_estudio = "Salud pública",
    instrumento_file = "ops_salud/instrumento.xlsx",
    data_file        = "ops_salud/data.xlsx"
  ),
  acreditacion_docentes = list(
    name             = "acreditacion_docentes",
    titulo_humano    = "Acreditación PUCP — Docentes",
    descripcion      = "Encuesta a docentes en el marco de acreditación de la carrera AMDT (Arte, Moda y Diseño Textil). Escalas de acuerdo 4 niveles + satisfacción. Import desde SurveyMonkey.",
    icono_ui         = "GraduationCap",
    etiqueta_estudio = "Acreditación",
    instrumento_file = "acreditacion/docentes_inst.xlsx",
    data_file        = "acreditacion/docentes_data.sav"
  ),
  acreditacion_estudiantes = list(
    name             = "acreditacion_estudiantes",
    titulo_humano    = "Acreditación PUCP — Estudiantes",
    descripcion      = "Complementaria de la anterior: respuestas de estudiantes de AMDT. Usa el mismo instrumento base pero con la bloques propios del rol 'estudiante'.",
    icono_ui         = "Users",
    etiqueta_estudio = "Acreditación",
    instrumento_file = "acreditacion/estudiantes_inst.xlsx",
    data_file        = "acreditacion/estudiantes_data.sav"
  ),
  acreditacion_administrativos = list(
    name             = "acreditacion_administrativos",
    titulo_humano    = "Acreditación PUCP — Administrativos",
    descripcion      = "Complementaria del bloque AMDT: respuestas del personal administrativo. Muestra pequeña (~20 respuestas) — útil para probar edge cases con N bajo.",
    icono_ui         = "Briefcase",
    etiqueta_estudio = "Acreditación",
    instrumento_file = "acreditacion/administrativos_inst.xlsx",
    data_file        = "acreditacion/administrativos_data.sav"
  )
)

.samples_dir <- function() {
  # Busca primero el samples instalado (modo paquete), cae al del repo en
  # dev. Si ninguno existe, devuelve NULL.
  d <- system.file("samples", package = "prosecnurapp")
  if (nzchar(d) && dir.exists(d)) return(d)
  d <- file.path(Sys.getenv("PULSO_REPO_ROOT", "."), "api", "inst", "samples")
  if (dir.exists(d)) return(d)
  NULL
}

.demo_meta <- function(name) {
  meta <- .DEMOS_META[[name]]
  if (is.null(meta)) return(NULL)
  samples_dir <- .samples_dir()
  if (is.null(samples_dir)) return(NULL)
  inst_path <- file.path(samples_dir, meta$instrumento_file)
  data_path <- file.path(samples_dir, meta$data_file)
  meta$instrumento_path <- inst_path
  meta$data_path        <- data_path
  meta$available        <- file.exists(inst_path) && file.exists(data_path)
  meta
}

# Lista de demos disponibles (filtrando los que faltan archivos).
.demos_payload <- function() {
  demos <- list()
  for (nm in names(.DEMOS_META)) {
    m <- .demo_meta(nm)
    if (!is.null(m) && isTRUE(m$available)) {
      demos[[length(demos) + 1]] <- list(
        name             = m$name,
        titulo_humano    = m$titulo_humano,
        descripcion      = m$descripcion,
        icono_ui         = m$icono_ui,
        etiqueta_estudio = m$etiqueta_estudio
      )
    }
  }
  list(demos = demos)
}

# Lee un archivo de datos según extensión (.xlsx, .sav, .csv).
.read_data_any <- function(path) {
  ext <- tolower(tools::file_ext(path))
  if (ext %in% c("xlsx", "xls")) {
    return(readxl::read_excel(path))
  }
  if (ext == "sav") {
    if (!requireNamespace("haven", quietly = TRUE)) {
      stop_api(500, "E_NO_HAVEN", "haven no está disponible para leer .sav")
    }
    return(haven::read_sav(path))
  }
  if (ext == "csv") {
    return(utils::read.csv(path, stringsAsFactors = FALSE, fileEncoding = "UTF-8"))
  }
  stop_api(400, "E_BAD_DATA_EXT", sprintf("Extensión no soportada: %s", ext))
}

mount_sistema <- function(pr) {
  pr |>
    plumber::pr_get("/api/system/health", wrap_endpoint(function(req, res) {
      list(
        ok = TRUE,
        version = as.character(utils::packageVersion("prosecnurapp")),
        prosecnur_version = as.character(utils::packageVersion("prosecnur")),
        time = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
      )
    })) |>
    plumber::pr_post("/api/system/shutdown", wrap_endpoint(function(req, res) {
      .shutdown_flag$value <- TRUE
      list(ok = TRUE, message = "Shutdown requested")
    })) |>
    plumber::pr_get("/api/system/demos", wrap_endpoint(function(req, res) {
      # Catálogo de demos disponibles. Filtrados por existencia en disco —
      # si faltan archivos, el demo no se ofrece. El frontend pide esto
      # al entrar a Fase 1 para mostrar el picker.
      .demos_payload()
    })) |>
    plumber::pr_post("/api/system/demo", wrap_endpoint(function(req, res, name = NULL) {
      # Carga un dataset de prueba. Si `name` no viene, default a "generic"
      # para compat con versiones viejas del frontend.
      demo_name <- if (is.character(name) && length(name) >= 1 && nzchar(name[[1]])) {
        as.character(name[[1]])
      } else {
        q <- req$args %||% list()
        as.character(q$name %||% "generic")
      }
      meta <- .demo_meta(demo_name)
      if (is.null(meta)) {
        stop_api(404, "E_DEMO_UNKNOWN", sprintf("Demo desconocido: '%s'. Revisa /api/system/demos para ver los disponibles.", demo_name))
      }
      if (!isTRUE(meta$available)) {
        stop_api(404, "E_DEMO_MISSING", sprintf(
          "Demo '%s' registrado pero faltan archivos en disco. Esperados:\n  - %s\n  - %s",
          demo_name, meta$instrumento_path, meta$data_path
        ))
      }

      sid <- session_create()
      res$setHeader("X-Pulso-Session", sid)

      # Nombres "humanos" para los files cargados (aparecen en Fase 1).
      inst_basename <- basename(meta$instrumento_path)
      data_basename <- basename(meta$data_path)
      data_ext <- tolower(tools::file_ext(data_basename))
      data_kind <- if (data_ext == "sav") "sav" else "data"

      xls_meta <- save_upload(sid, "xlsform", inst_basename,
                              readBin(meta$instrumento_path, "raw", n = file.info(meta$instrumento_path)$size))
      dat_meta <- save_upload(sid, data_kind, data_basename,
                              readBin(meta$data_path, "raw", n = file.info(meta$data_path)$size))

      inst <- prosecnur::leer_instrumento_xlsform(xls_meta$path)
      session_set(sid, "instrumento", inst)

      data_df <- .read_data_any(dat_meta$path)
      session_set(sid, "data_raw_meta", list(file_id = dat_meta$file_id, path = dat_meta$path, ext = data_ext))

      rp_inst <- prosecnur::reporte_instrumento(path = xls_meta$path)
      rp_data <- prosecnur::reporte_data(data_df, instrumento = rp_inst)
      session_set(sid, "rp_inst", rp_inst)
      session_set(sid, "rp_data", rp_data)
      session_set(sid, "analitica_prep_ok", TRUE)
      session_set(sid, "analitica_fuente", paste0("demo:", demo_name))

      resumen <- summarize_instrumento(inst)
      list(
        ok = TRUE,
        session_id = sid,
        demo_name = demo_name,
        demo_titulo = meta$titulo_humano,
        resumen_instrumento = resumen,
        n_filas = nrow(data_df),
        n_columnas = ncol(data_df)
      )
    })) |>
    plumber::pr_post("/api/session", wrap_endpoint(function(req, res) {
      existing <- session_header(req)
      if (!is.null(existing) && !is.null(session_get(existing, required = FALSE))) {
        return(list(session_id = existing, reused = TRUE))
      }
      sid <- session_create()
      res$setHeader("X-Pulso-Session", sid)
      list(session_id = sid, reused = FALSE)
    })) |>
    plumber::pr_delete("/api/session", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      ok <- session_delete(sid)
      list(ok = ok)
    })) |>
    plumber::pr_get("/api/session/state", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid, required = FALSE)
      if (is.null(s)) {
        res$status <- 404
        return(list(error = list(code = "E_NO_SESSION", message = "Session not found")))
      }
      files_by_kind <- split(
        unname(s$files),
        vapply(s$files, function(f) f$kind, character(1))
      )
      list(
        session_id = s$id,
        created_at = format(s$created_at, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
        xlsform = !is.null(files_by_kind$xlsform) && length(files_by_kind$xlsform) > 0,
        data = (!is.null(files_by_kind$data) || !is.null(files_by_kind$sav)),
        instrumento_parsed = !is.null(s$instrumento),
        data_previewed = !is.null(s$data_raw_meta),
        plan_built = !is.null(s$plan_result),
        auditoria_run = !is.null(s$evaluacion),
        codif_familias_generated = isTRUE(s$codif_familias_generated),
        codif_familias_loaded = !is.null(s$codif_familias_file_id),
        codif_plantilla_template = isTRUE(s$codif_plantilla_template),
        codif_plantilla_codigos_loaded = !is.null(s$codif_plantilla_codigos_file_id),
        codif_aplicado = isTRUE(s$codif_aplicado),
        analitica_prep_ok = isTRUE(s$analitica_prep_ok),
        analitica_codebook_ok = isTRUE(s$analitica_codebook_ok),
        analitica_frecuencias_ok = isTRUE(s$analitica_frecuencias_ok),
        analitica_cruces_ok = isTRUE(s$analitica_cruces_ok),
        analitica_spss_ok = isTRUE(s$analitica_spss_ok),
        analitica_enumeradores_ok = isTRUE(s$analitica_enumeradores_ok),
        analitica_fuente = s$analitica_fuente %||% NA_character_,
        graficos_ppt_ok = isTRUE(s$graficos_ppt_ok),
        graficos_word_ok = isTRUE(s$graficos_word_ok)
      )
    })) |>
    plumber::pr_post("/api/files/upload", wrap_endpoint(function(req, res, file = NULL, kind = NULL) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      if (is.null(file)) stop_api(400, "E_NO_FILE_FIELD", "Missing 'file' field in multipart body")

      extracted <- if (is.raw(file)) {
        list(bytes = file, original = "upload.bin")
      } else if (is.list(file) && length(file) >= 1 && is.raw(file[[1]])) {
        list(bytes = file[[1]], original = names(file)[1] %||% "upload.bin")
      } else if (is.list(file) && is.raw(file$value)) {
        list(bytes = file$value, original = file$filename %||% "upload.bin")
      } else {
        stop_api(400, "E_BAD_FILE", "Could not extract file bytes from multipart payload")
      }

      kind_str <- if (is.character(kind) && length(kind) >= 1 && nzchar(kind[[1]])) {
        as.character(kind[[1]])
      } else {
        q <- req$args %||% list()
        as.character(q$kind %||% req$QUERY_STRING %||% "")
      }
      if (!nzchar(kind_str)) {
        stop_api(400, "E_NO_KIND_FIELD",
          "Missing 'kind'. Pass it as query param (?kind=xlsform) or form field with Content-Type: text/plain.")
      }
      meta <- save_upload(sid, kind_str, extracted$original, extracted$bytes)
      res$status <- 201
      meta
    })) |>
    plumber::pr_get("/api/files/<file_id>/download", wrap_endpoint(function(req, res, file_id) {
      sid <- session_header(req)
      meta <- get_file(sid, file_id)
      n <- file.info(meta$path)$size
      bytes <- readBin(meta$path, what = "raw", n = n)
      res$setHeader("Content-Type", mime::guess_type(meta$path))
      res$setHeader("Content-Length", as.character(n))
      res$setHeader("Content-Disposition", sprintf('attachment; filename="%s"', meta$original_name))
      res$body <- bytes
      res
    }))
}

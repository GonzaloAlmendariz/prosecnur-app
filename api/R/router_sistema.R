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
# Formato por demo:
#  - Single-base (legacy, igual que en v0.1): `instrumento_file` +
#    `data_file` directamente en el meta. El loader crea un estudio con
#    UNA sola base llamada "default".
#  - Multi-base (v0.2+): un campo `bases` con lista nombrada. Cada entrada
#    define su propio par (instrumento, data). El loader crea el estudio
#    con N bases con esos nombres.
#
# Ejemplo multi-base: acreditacion tiene 3 bases (docentes, estudiantes,
# administrativos) que se analizan juntas — igual que hace el QMD
# `ejecutar_surveymonkey_prosecnur.qmd`.

.DEMOS_META <- list(
  giz = list(
    name             = "giz",
    titulo_humano    = "Estudio GIZ",
    descripcion      = "Dataset de un estudio real con GIZ — compacto, con preguntas variadas (Likert, select_one, integer, texto abierto) de una sola base. Útil para explorar el flujo completo con datos representativos.",
    icono_ui         = "Globe2",
    etiqueta_estudio = "Cooperación internacional",
    instrumento_file = "demo_instrumento.xlsx",
    data_file        = "demo_data.xlsx"
  ),
  ops_salud = list(
    name             = "ops_salud",
    titulo_humano    = "OPS — Establecimientos de Salud",
    descripcion      = "Encuesta a ~120 establecimientos de salud del Perú en 5 regiones (Callao, La Libertad, SJL, Tacna, Tumbes). Likert, multi-select, categorización jerárquica. Una sola base.",
    icono_ui         = "Activity",
    etiqueta_estudio = "Salud pública",
    instrumento_file = "ops_salud/instrumento.xlsx",
    data_file        = "ops_salud/data.xlsx"
  ),
  acreditacion = list(
    name             = "acreditacion",
    titulo_humano    = "Acreditación PUCP — AMDT",
    descripcion      = "Estudio con TRES bases (docentes, estudiantes, administrativos) del proceso de acreditación de la carrera de Arte, Moda y Diseño Textil. Los slides del reporte usan variables de las 3 fuentes simultáneamente (ej. 'docentes$p6_1', 'estudiantes$p6_1').",
    icono_ui         = "GraduationCap",
    etiqueta_estudio = "Acreditación · multi-base",
    bases = list(
      docentes = list(
        nombre           = "docentes",
        instrumento_file = "acreditacion/docentes_inst.xlsx",
        data_file        = "acreditacion/docentes_data.sav"
      ),
      estudiantes = list(
        nombre           = "estudiantes",
        instrumento_file = "acreditacion/estudiantes_inst.xlsx",
        data_file        = "acreditacion/estudiantes_data.sav"
      ),
      administrativos = list(
        nombre           = "administrativos",
        instrumento_file = "acreditacion/administrativos_inst.xlsx",
        data_file        = "acreditacion/administrativos_data.sav"
      )
    )
  )
)

.samples_dir <- function() {
  # Busca primero el samples instalado (modo paquete), cae al del repo en
  # dev. Si ninguno existe, devuelve NULL.
  d <- system.file("samples", package = "prosecnurapp")
  if (nzchar(d) && dir.exists(d)) return(d)
  d <- file.path(.app_api_dir(), "inst", "samples")
  if (dir.exists(d)) return(d)
  NULL
}

.demo_meta <- function(name) {
  meta <- .DEMOS_META[[name]]
  if (is.null(meta)) return(NULL)
  samples_dir <- .samples_dir()
  if (is.null(samples_dir)) return(NULL)

  # Resolver paths y availability según sea single-base o multi-base.
  if (is.list(meta$bases) && length(meta$bases) > 0L) {
    # Multi-base
    resolved <- list()
    all_ok <- TRUE
    for (bn in names(meta$bases)) {
      b <- meta$bases[[bn]]
      inst_path <- file.path(samples_dir, b$instrumento_file)
      data_path <- file.path(samples_dir, b$data_file)
      ok <- file.exists(inst_path) && file.exists(data_path)
      if (!ok) all_ok <- FALSE
      resolved[[bn]] <- list(
        nombre           = b$nombre %||% bn,
        instrumento_path = inst_path,
        data_path        = data_path,
        available        = ok
      )
    }
    meta$bases_resolved <- resolved
    meta$available      <- all_ok
    meta$n_bases        <- length(resolved)
  } else {
    # Single-base (legacy)
    inst_path <- file.path(samples_dir, meta$instrumento_file)
    data_path <- file.path(samples_dir, meta$data_file)
    meta$instrumento_path <- inst_path
    meta$data_path        <- data_path
    meta$available        <- file.exists(inst_path) && file.exists(data_path)
    meta$n_bases          <- 1L
  }
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
        etiqueta_estudio = m$etiqueta_estudio,
        n_bases          = as.integer(m$n_bases %||% 1L)
      )
    }
  }
  list(demos = demos)
}

# Lee un archivo de datos según extensión (.xlsx, .sav, .csv) dado su
# PATH absoluto. `router_codificacion.R` tiene una función homónima
# `.read_data_any(meta)` que acepta un file-meta — no nos pisamos con
# este nombre distinto para evitar ambigüedad dentro del paquete cargado
# por pkgload::load_all.
.read_data_from_path <- function(path) {
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
      # `prosecnur_version` se mantiene en la respuesta por compat con el
      # frontend (SessionContext lo muestra en el header). Ahora refleja
      # la versión de `prosecnurapp` porque el motor vive acá.
      v <- as.character(utils::packageVersion("prosecnurapp"))
      list(
        ok = TRUE,
        version = v,
        prosecnur_version = v,
        time = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
      )
    })) |>
    # Bootstrap session: si el launcher arrancó con PULSO_BOOTSTRAP_PROJECT,
    # devuelve el sid de la sesión pre-cargada para que el frontend la use
    # en vez de crear una efímera. Se "consume" una vez para que recargas
    # posteriores no fuercen el mismo proyecto. Devuelve {sid: null} si no
    # hay bootstrap pendiente.
    plumber::pr_get("/api/system/bootstrap", wrap_endpoint(function(req, res) {
      sid <- Sys.getenv("PULSO_BOOTSTRAP_SID", "")
      if (!nzchar(sid)) return(list(sid = NULL))
      Sys.setenv(PULSO_BOOTSTRAP_SID = "")
      list(sid = sid)
    })) |>
    # Reporta el estado de las dependencias opcionales del sistema (Quarto,
    # paquetes R secundarios). El frontend usa esto para deshabilitar
    # acciones que dependen de toolchain ausente y mostrar instrucciones
    # de instalación claras antes de que el user las dispare y se choque
    # con un error críptico.
    plumber::pr_get("/api/system/diagnostic", wrap_endpoint(function(req, res) {
      quarto_pkg <- requireNamespace("quarto", quietly = TRUE)
      quarto_bin_path <- as.character(Sys.which("quarto"))
      quarto_bin <- nzchar(quarto_bin_path)
      quarto_version <- if (quarto_bin) {
        tryCatch(
          system2(quarto_bin_path, "--version", stdout = TRUE, stderr = FALSE)[1],
          error = function(e) NA_character_
        )
      } else NA_character_
      list(
        ok = TRUE,
        quarto = list(
          available     = quarto_pkg && quarto_bin,
          r_package     = quarto_pkg,
          cli_path      = if (quarto_bin) quarto_bin_path else NA_character_,
          cli_version   = quarto_version,
          install_url   = "https://quarto.org/docs/get-started/",
          required_for  = "Reporte de enumeradores en PDF (Fase 4 → Enumeradores)"
        )
      )
    })) |>
    plumber::pr_post("/api/system/shutdown", wrap_endpoint(function(req, res) {
      # Si el proceso fue arrancado con PULSO_SHUTDOWN_TOKEN (caso
      # Electron desktop), exigir el mismo token en el header
      # X-Pulso-Shutdown-Token. Esto cierra el CSRF local: otra
      # pestaña/proceso del mismo equipo no puede tumbar el backend
      # adivinando el puerto.
      #
      # Si la env var NO está seteada (arranque manual vía launch.R o
      # Rscript directo), el endpoint queda libre igual que antes —
      # backward-compat para dev y scripts.
      expected <- Sys.getenv("PULSO_SHUTDOWN_TOKEN", "")
      if (nzchar(expected)) {
        got <- tryCatch(
          req$HTTP_X_PULSO_SHUTDOWN_TOKEN %||% req$HEADERS[["X-Pulso-Shutdown-Token"]],
          error = function(e) NULL
        )
        if (!is.character(got) || !nzchar(got) || !identical(as.character(got), expected)) {
          stop_api(403, "E_FORBIDDEN_SHUTDOWN",
                   "Token de shutdown ausente o inválido.")
        }
      }
      .shutdown_flag$value <- TRUE
      list(ok = TRUE, message = "Shutdown requested")
    })) |>
    plumber::pr_post("/api/system/reload-engine", wrap_endpoint(function(req, res) {
      # Hot reload de los .R del paquete sin reiniciar el proceso.
      # Útil cuando se editan archivos como graficos_metadata.R o los
      # graficadores, que quedan cacheados en el namespace al arranque
      # (`.PRESETS_META`, `.SLIDES_META`, `.DEMOS_META`, etc.).
      #
      # Usa pkgload::load_all() que re-evalúa los .R dentro del namespace
      # existente sin destruir la sesión (config de estudio, data cargada,
      # workers). Toma ~2-3s típicamente.
      #
      # Solo debería exponerse en dev. En producción quedaría detrás de
      # un flag; por ahora lo dejamos siempre ON porque la app es local
      # y de un solo usuario.
      api_dir <- Sys.getenv("PULSO_API_DIR", "")
      if (!nzchar(api_dir)) {
        api_dir <- Sys.getenv("PULSO_REPO_ROOT", "")
      }
      if (!nzchar(api_dir)) {
        api_dir <- normalizePath(file.path(dirname(getwd()), "api"), mustWork = FALSE)
      } else {
        if (!identical(basename(api_dir), "api")) {
          api_dir <- file.path(api_dir, "api")
        }
      }
      if (!dir.exists(api_dir)) {
        stop_api(500, "E_RELOAD_NO_DIR",
                 sprintf("No encontré el directorio del paquete: %s", api_dir))
      }
      t0 <- Sys.time()
      ok <- tryCatch({
        if (requireNamespace("pkgload", quietly = TRUE)) {
          pkgload::load_all(api_dir, quiet = TRUE)
          TRUE
        } else if (requireNamespace("devtools", quietly = TRUE)) {
          devtools::load_all(api_dir, quiet = TRUE)
          TRUE
        } else FALSE
      }, error = function(e) {
        stop_api(500, "E_RELOAD_FAILED",
                 sprintf("load_all falló: %s", conditionMessage(e)))
      })
      if (!isTRUE(ok)) {
        stop_api(500, "E_RELOAD_NO_TOOL",
                 "Falta pkgload o devtools para hacer hot reload.")
      }
      dt <- as.numeric(difftime(Sys.time(), t0, units = "secs"))
      list(
        ok = TRUE,
        message = "Engine recargado. Recarga la pestaña del frontend para invalidar caches.",
        elapsed_sec = round(dt, 2),
        api_dir = api_dir
      )
    })) |>
    plumber::pr_get("/api/system/demos", wrap_endpoint(function(req, res) {
      # Catálogo de demos disponibles. Filtrados por existencia en disco —
      # si faltan archivos, el demo no se ofrece. El frontend pide esto
      # al entrar a Fase 1 para mostrar el picker.
      .demos_payload()
    })) |>
    plumber::pr_post("/api/system/demo", wrap_endpoint(function(req, res, name = NULL) {
      # Carga un dataset de prueba (1+ bases). Si `name` no viene, default
      # a "giz". Si el demo es multi-base, carga TODAS las bases
      # declaradas en el catálogo como parte del mismo estudio.
      demo_name <- if (is.character(name) && length(name) >= 1 && nzchar(name[[1]])) {
        as.character(name[[1]])
      } else {
        q <- req$args %||% list()
        as.character(q$name %||% "giz")
      }
      meta <- .demo_meta(demo_name)
      if (is.null(meta)) {
        stop_api(404, "E_DEMO_UNKNOWN",
                 sprintf("Demo desconocido: '%s'. Revisa /api/system/demos.", demo_name))
      }
      if (!isTRUE(meta$available)) {
        faltan <- if (is.list(meta$bases_resolved)) {
          paste(vapply(meta$bases_resolved, function(b) {
            if (isTRUE(b$available)) "" else sprintf("  - %s\n  - %s", b$instrumento_path, b$data_path)
          }, character(1)), collapse = "\n")
        } else {
          sprintf("  - %s\n  - %s", meta$instrumento_path %||% "", meta$data_path %||% "")
        }
        stop_api(404, "E_DEMO_MISSING",
                 sprintf("Demo '%s' registrado pero faltan archivos.\n%s", demo_name, faltan))
      }

      # Helper para añadir UNA base al estudio. Sube los archivos al file
      # store de la sesión y llama a estudio_add_base.
      add_base_from_files <- function(sid, nombre, inst_path, data_path) {
        inst_basename <- basename(inst_path)
        data_basename <- basename(data_path)
        data_ext <- tolower(tools::file_ext(data_basename))
        data_kind <- if (data_ext == "sav") "sav" else "data"

        xls_meta <- save_upload(sid, "xlsform", inst_basename,
                                readBin(inst_path, "raw", n = file.info(inst_path)$size))
        dat_meta <- save_upload(sid, data_kind, data_basename,
                                readBin(data_path, "raw", n = file.info(data_path)$size))
        rp_inst <- reporte_instrumento(path = xls_meta$path)
        data_df <- .read_data_from_path(dat_meta$path)
        rp_data <- reporte_data(data_df, instrumento = rp_inst)

        # Compatibilidad con el flujo single-base de Fase 1. Aunque el demo
        # ya se registra como estudio, varias pantallas leen estos slots para
        # saber que la sesión quedó completamente cargada.
        if (is.null(session_get(sid)$instrumento)) {
          inst_limpieza <- leer_xlsform_limpieza(xls_meta$path, verbose = FALSE)
          session_set(sid, "instrumento", inst_limpieza)
          session_set(sid, "inst_limpieza", inst_limpieza)
          session_set(sid, "data_raw_meta", list(
            file_id = dat_meta$file_id,
            path = dat_meta$path,
            ext = data_ext
          ))
          session_set(sid, "rp_inst", rp_inst)
          session_set(sid, "rp_data", rp_data)
        }

        estudio_add_base(
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
        list(
          nombre = nombre,
          n_filas = nrow(data_df),
          n_columnas = ncol(data_df),
          resumen_instrumento = summarize_instrumento(leer_instrumento_xlsform(xls_meta$path))
        )
      }

      sid <- session_create()
      res$setHeader("X-Pulso-Session", sid)
      estudio_ensure(sid)
      estudio_set_nombre(sid, meta$titulo_humano)

      # Cargar bases según shape del demo.
      bases_loaded <- if (is.list(meta$bases_resolved) && length(meta$bases_resolved) > 0L) {
        # Multi-base: iterar por todas las bases declaradas.
        lapply(names(meta$bases_resolved), function(bn) {
          b <- meta$bases_resolved[[bn]]
          add_base_from_files(sid, bn, b$instrumento_path, b$data_path)
        })
      } else {
        # Single-base legacy: una sola base llamada "default".
        list(add_base_from_files(sid, "default", meta$instrumento_path, meta$data_path))
      }

      session_set(sid, "analitica_prep_ok", TRUE)
      session_set(sid, "analitica_fuente", paste0("demo:", demo_name))

      # Respuesta: preservamos los campos legacy (`resumen_instrumento`,
      # `n_filas`, `n_columnas`) apuntando a la PRIMERA base, para que
      # el frontend v0.1 siga funcionando mientras migramos a la lectura
      # de `bases`.
      primera <- bases_loaded[[1]]
      list(
        ok = TRUE,
        session_id = sid,
        demo_name = demo_name,
        demo_titulo = meta$titulo_humano,
        n_bases = length(bases_loaded),
        bases = lapply(bases_loaded, function(b) list(
          nombre = b$nombre, n_filas = b$n_filas, n_columnas = b$n_columnas
        )),
        # Campos legacy (primera base):
        resumen_instrumento = primera$resumen_instrumento,
        n_filas = primera$n_filas,
        n_columnas = primera$n_columnas
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
      # Migración legacy: si la sesión NO tiene `estudio` pero tiene
      # `rp_data` (cargado antes de v0.2), lo exponemos como un estudio
      # virtual con 1 base "default" para que la UI no lo vea vacío.
      # Si `estudio` existe (aunque esté vacío por init reciente), sus
      # bases mandan — no mezclamos con el mirror legacy.
      bases <- if (!is.null(s$estudio)) {
        s$estudio$bases
      } else if (!is.null(s$rp_data)) {
        list(default = list(nombre = "default"))
      } else list()
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
        analitica_dim_ok = isTRUE(s$analitica_dim_ok),
        analitica_fuente = s$analitica_fuente %||% NA_character_,
        graficos_ppt_ok = isTRUE(s$graficos_ppt_ok),
        graficos_word_ok = isTRUE(s$graficos_word_ok),
        # --- Estudio (multi-base, v0.2+) ---
        estudio_nombre = if (is.null(s$estudio)) NA_character_ else (s$estudio$nombre %||% NA_character_),
        # Flag de intención: TRUE si el usuario activó explícitamente el
        # modo "varias bases" (aunque aún no haya subido ninguna). El
        # frontend usa esto para renderizar el BasesPanel desde vacío.
        has_estudio = !is.null(s$estudio),
        n_bases = length(bases),
        bases_nombres = as.list(names(bases))
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
    plumber::pr_get("/api/files/<file_id>/download", wrap_endpoint(function(req, res, file_id, sid = NULL) {
      # Este endpoint acepta el session id tanto en el header
      # X-Pulso-Session (patrón estándar del resto del API) como en el
      # query param `?sid=...`. La razón es que los <a href> nativos del
      # frontend no pueden mandar headers custom — si el usuario clickea
      # un link de descarga, el browser hace el GET sin header y queda
      # como E_NO_SESSION. El query param es el escape hatch para
      # descargas directas. El header sigue teniendo prioridad.
      effective_sid <- session_header(req)
      if (is.null(effective_sid) && is.character(sid) && length(sid) >= 1 && nzchar(sid[[1]])) {
        effective_sid <- as.character(sid[[1]])
      }
      meta <- get_file(effective_sid, file_id)
      n <- file.info(meta$path)$size
      bytes <- readBin(meta$path, what = "raw", n = n)
      res$setHeader("Content-Type", mime::guess_type(meta$path))
      res$setHeader("Content-Length", as.character(n))
      res$setHeader("Content-Disposition", sprintf('attachment; filename="%s"', meta$original_name))
      res$body <- bytes
      res
    }))
}

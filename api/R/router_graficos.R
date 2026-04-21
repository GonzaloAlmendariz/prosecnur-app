# La fuente de verdad de slides + graficadores vive en
# `graficos_metadata.R` (mismo directorio). Ese archivo define:
#   - .SLIDES_META / .GRAFICADORES_META: catálogo humano con copy, iconos,
#     tipos de input por arg, agrupación semántica.
#   - .slide_names() / .graf_names() / .slide_slots() / .slide_categoria()
#     como API pública para el router.
# Acá solo exponemos aliases cortos para mantener compatibilidad con el
# código preexistente (`.SLIDE_REGISTRY`, `.GRAFICADOR_REGISTRY`).

.SLIDE_REGISTRY <- setNames(
  lapply(.slide_names(), function(nm) list(
    cat   = .slide_categoria(nm),
    grafs = setdiff(.slide_slots(nm), "icono")  # el slot `icono` va por catálogo PNG, no por graficador
  )),
  .slide_names()
)

.GRAFICADOR_REGISTRY <- .graf_names()

.normalize_plan <- function(plan) {
  if (is.null(plan)) return(list(slides = list()))
  if (is.data.frame(plan)) plan <- as.list(plan)
  slides <- plan$slides %||% list()
  if (is.data.frame(slides)) {
    slides <- lapply(seq_len(nrow(slides)), function(i) {
      row <- as.list(slides[i, , drop = FALSE])
      row <- lapply(row, function(v) if (is.list(v) && length(v) == 1) v[[1]] else v)
      row
    })
  } else if (is.list(slides) && !is.null(names(slides))) {
    slides <- list(slides)
  }
  slides <- lapply(slides, function(s) {
    s <- as.list(s)
    if (!is.null(s$payload)) {
      s$payload <- if (is.data.frame(s$payload)) as.list(s$payload) else as.list(s$payload)
    }
    s
  })
  plan$slides <- slides
  plan
}

.as_json_list <- function(x) {
  if (is.null(x)) return(NULL)
  if (is.data.frame(x)) return(as.list(x))
  if (is.list(x)) return(x)
  as.list(x)
}

.require_rp_data <- function(sid) {
  s <- session_get(sid)
  if (is.null(s$rp_data) || is.null(s$rp_inst)) {
    stop_api(409, "E_NO_RP_DATA", "Primero corre Fase 4 — Preparar datos para reporte.")
  }
  s
}

.rebuild_graf <- function(g) {
  if (is.null(g)) return(NULL)
  if (is.null(g$graficador) || !nzchar(g$graficador)) return(NULL)
  if (!(g$graficador %in% .GRAFICADOR_REGISTRY)) {
    stop_api(400, "E_UNKNOWN_GRAF", sprintf("Graficador no registrado: %s", g$graficador))
  }
  fn <- getExportedValue("prosecnur", g$graficador)
  do.call(fn, as.list(g$args %||% list()))
}

.rebuild_slide <- function(s) {
  s <- as.list(s)
  tipo <- as.character(s$tipo %||% "")
  if (!nzchar(tipo)) stop_api(400, "E_MISSING_TIPO", "Slide sin tipo")
  if (!(tipo %in% names(.SLIDE_REGISTRY))) {
    stop_api(400, "E_UNKNOWN_TIPO", sprintf("Tipo de slide no registrado: %s", tipo))
  }
  fn <- getExportedValue("prosecnur", tipo)
  payload <- .as_json_list(s$payload) %||% list()
  payload <- lapply(payload, function(v) if (is.list(v) && length(v) == 1 && is.null(names(v))) v[[1]] else v)
  graf_slots <- .SLIDE_REGISTRY[[tipo]]$grafs
  for (slot_name in graf_slots) {
    if (!is.null(payload[[slot_name]])) {
      payload[[slot_name]] <- .rebuild_graf(.as_json_list(payload[[slot_name]]))
    }
  }
  allowed_args <- names(formals(fn))
  payload <- payload[names(payload) %in% allowed_args]
  do.call(fn, payload)
}

.build_presets <- function(presets_json) {
  if (is.null(presets_json) || length(presets_json) == 0) return(NULL)
  args <- lapply(presets_json, as.list)
  do.call(prosecnur::p_presets, args)
}

.build_w_presets <- function(w_json) {
  if (is.null(w_json) || length(w_json) == 0) return(NULL)
  args <- lapply(w_json, as.list)
  do.call(prosecnur::w_presets, args)
}

.validar_plan_json <- function(plan_json) {
  errs <- character(0); warns <- character(0)
  plan_json <- .normalize_plan(plan_json)
  slides <- plan_json$slides
  if (length(slides) == 0) errs <- c(errs, "El plan no tiene slides.")
  for (i in seq_along(slides)) {
    s <- as.list(slides[[i]])
    tipo <- as.character(s$tipo %||% "")
    tag <- sprintf("slide[%d]", i)
    if (!nzchar(tipo)) { errs <- c(errs, sprintf("%s: falta tipo", tag)); next }
    if (!(tipo %in% names(.SLIDE_REGISTRY))) {
      errs <- c(errs, sprintf("%s: tipo desconocido '%s'", tag, tipo)); next
    }
    payload <- .as_json_list(s$payload) %||% list()
    graf_slots <- .SLIDE_REGISTRY[[tipo]]$grafs
    for (slot_name in graf_slots) {
      slot <- .as_json_list(payload[[slot_name]])
      graf_name <- as.character(slot$graficador %||% "")
      if (!nzchar(graf_name)) {
        warns <- c(warns, sprintf("%s (%s): slot '%s' sin graficador", tag, tipo, slot_name))
      } else if (!(graf_name %in% .GRAFICADOR_REGISTRY)) {
        errs <- c(errs, sprintf("%s: graficador desconocido '%s'", tag, graf_name))
      }
    }
  }
  list(ok = length(errs) == 0, errors = errs, warnings = warns, n_slides = length(slides))
}

# Config por defecto del plan de gráficos. Los `presets` vienen
# pre-poblados con `.PRESETS_DEFAULT_PULSO` (estilo institucional
# extraído de los QMDs de referencia) — así una sesión nueva ya
# produce gráficos con aspecto profesional y el analista solo ajusta
# lo que necesita cambiar, en vez de partir de un canvas vacío.
.graficos_default_config <- function() {
  list(
    version = 2L,
    plan = list(slides = list()),
    presets = .PRESETS_DEFAULT_PULSO,
    w_presets = list(),
    selected_slide_id = NULL,
    paletas = list(),
    iconos = list(),
    overrides_reusables = list(),
    debug_ph = list(activo = FALSE, color = "#FF00FF", lwd = 0.6)
  )
}

# Enriquece la config de presets JSON antes de pasarla a prosecnur con:
# 1. `usar_canvas = TRUE` en todos los tipos (invariante de Pulso — todos
#    los reportes usan canvas/cowplot).
# 2. Flags `debug_ph_*` en el preset `base`, que prosecnur aplica a todos
#    los graficadores. Así el analista tiene UN solo toggle global en
#    vez de tener que pisar los tres args por cada slide.
#
# Ambos comportamientos son opinados y se hacen server-side para que la
# UI no tenga que recordarlo en cada export.
.enriquecer_presets <- function(presets_json, debug_ph = NULL) {
  if (is.null(presets_json)) presets_json <- list()
  if (!is.list(presets_json)) return(presets_json)

  # 1) Canvas siempre activo en cada tipo de preset (excepto `base`,
  # que no usa canvas).
  tipos_canvas <- c(
    "barras_apiladas", "barras_agrupadas", "multi_apiladas",
    "barras_numericas", "pie", "donut", "radar_tabla",
    "numerico", "media_rango", "boxplot"
  )
  for (t in tipos_canvas) {
    if (is.null(presets_json[[t]])) presets_json[[t]] <- list()
    presets_json[[t]]$usar_canvas <- TRUE
  }

  # 2) Debug placeholder: inyectar al preset base.
  if (is.null(presets_json$base)) presets_json$base <- list()
  if (is.list(debug_ph) && isTRUE(debug_ph$activo)) {
    presets_json$base$debug_ph_bordes <- TRUE
    if (!is.null(debug_ph$color) && nzchar(as.character(debug_ph$color))) {
      presets_json$base$debug_ph_col <- as.character(debug_ph$color)
    }
    if (!is.null(debug_ph$lwd) && is.finite(suppressWarnings(as.numeric(debug_ph$lwd)))) {
      presets_json$base$debug_ph_lwd <- as.numeric(debug_ph$lwd)
    }
  } else {
    # Si no está activo, forzar FALSE por si el analista había dejado
    # debug_ph_bordes=TRUE en algún preset legacy.
    presets_json$base$debug_ph_bordes <- FALSE
  }

  presets_json
}

# Extrae las imágenes PNG embebidas en un .pptx (ubicadas en
# `ppt/media/image*.png` dentro del ZIP) y las devuelve como lista de
# `{filename, png_base64, width_px?, height_px?}`. Ignora cualquier media
# que no sea PNG (ej. vectoriales EMF) — no queremos devolverle al
# frontend algo que no pueda renderizar como <img>.
#
# El orden se conserva por nombre (image1.png, image2.png, …) que
# corresponde al orden en que officer las fue añadiendo al slide.
# Si el .pptx no tiene medias, retorna lista vacía.
.extract_pptx_images <- function(pptx_path) {
  if (!file.exists(pptx_path)) return(list())
  if (!requireNamespace("zip", quietly = TRUE)) return(list())

  tmpdir <- tempfile("pptx_extract_")
  dir.create(tmpdir, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(tmpdir, recursive = TRUE, force = TRUE), add = TRUE)

  entries <- tryCatch(
    zip::zip_list(pptx_path),
    error = function(e) NULL
  )
  if (is.null(entries) || !nrow(entries)) return(list())

  media_rows <- entries[grepl("^ppt/media/.*\\.png$", entries$filename, ignore.case = TRUE), , drop = FALSE]
  if (!nrow(media_rows)) return(list())

  # Ordenar por numero natural (image1, image2, … image10)
  nums <- suppressWarnings(as.integer(regmatches(
    media_rows$filename,
    regexpr("[0-9]+", media_rows$filename)
  )))
  nums[is.na(nums)] <- 999L
  media_rows <- media_rows[order(nums), , drop = FALSE]

  tryCatch(
    zip::unzip(pptx_path, files = media_rows$filename, exdir = tmpdir),
    error = function(e) NULL
  )

  lapply(seq_len(nrow(media_rows)), function(i) {
    fname <- media_rows$filename[i]
    full <- file.path(tmpdir, fname)
    if (!file.exists(full)) return(NULL)
    bytes <- tryCatch(readBin(full, "raw", file.info(full)$size), error = function(e) NULL)
    if (is.null(bytes)) return(NULL)
    b64 <- jsonlite::base64_enc(bytes)
    list(
      filename = basename(fname),
      png_base64 = paste0("data:image/png;base64,", b64),
      size = length(bytes)
    )
  }) |> Filter(f = Negate(is.null))
}

mount_graficos <- function(pr) {
  pr |>
    plumber::pr_get("/api/graficos/config", wrap_endpoint(function(req, res) {
      # Devuelve la config persistida (o defaults). El frontend la hidrata
      # en su store al montar GraficosPage y escribe cambios vía autosave
      # contra POST /config (debounce 2s).
      sid <- session_header(req)
      s <- session_get(sid)
      cfg <- s$graficos_config %||% .graficos_default_config()
      list(ok = TRUE, config = cfg)
    })) |>
    plumber::pr_post("/api/graficos/config", wrap_endpoint(function(req, res, ...) {
      # Recibe el estado completo (plan + presets + wPresets + selected)
      # desde el autosave. No validamos schema acá: el frontend ya lo
      # garantiza; el backend es un kv-store por sid.
      sid <- session_header(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      cfg <- parsed$config
      if (is.null(cfg)) stop_api(400, "E_NO_CONFIG", "Body debe incluir 'config'.")
      session_set(sid, "graficos_config", cfg)
      list(ok = TRUE, saved_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
    })) |>
    plumber::pr_get("/api/graficos/config/export", wrap_endpoint(function(req, res) {
      # Export del estado completo para que el analista lo guarde a disco
      # o lo comparta. Mismo patrón que Analítica.
      sid <- session_header(req)
      s <- session_get(sid)
      list(
        ok = TRUE,
        version = "graficos/1.0",
        exported_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
        config = s$graficos_config %||% .graficos_default_config()
      )
    })) |>
    plumber::pr_post("/api/graficos/config/import", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      v <- as.character(parsed$version %||% "")
      if (!startsWith(v, "graficos/")) {
        stop_api(400, "E_BAD_VERSION",
          sprintf("JSON no es de gráficos (version='%s'). Se espera 'graficos/1.x'.", v))
      }
      cfg <- parsed$config
      if (is.null(cfg)) stop_api(400, "E_NO_CONFIG", "El JSON no trae 'config'.")
      session_set(sid, "graficos_config", cfg)
      list(ok = TRUE, imported_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
    })) |>
    plumber::pr_get("/api/graficos/registry", wrap_endpoint(function(req, res) {
      # Devuelve el catálogo humano completo: cada slide y cada graficador
      # con titulo_humano, descripcion, icono_ui, categoria y args (cada
      # uno con label, tipo_input, grupo, descripcion, choices si aplica).
      # El frontend construye toda la UI de edición a partir de esto.
      .graficos_registry_payload()
    })) |>
    plumber::pr_get("/api/graficos/templates", wrap_endpoint(function(req, res) {
      # Catálogo de planes pre-armados (plan mínimo, reporte ejecutivo,
      # análisis poblacional, FODA dimensional). El frontend los muestra
      # en un modal cuando el analista quiere arrancar desde un template.
      # Los `plan.slides[*].id` son placeholder — el frontend los regenera
      # al aplicar el template para evitar colisiones con slides existentes.
      .templates_payload()
    })) |>
    plumber::pr_get("/api/graficos/presets-metadata", wrap_endpoint(function(req, res) {
      # Catálogo humano de los presets globales (p_presets): cada tipo
      # (base, barras_apiladas, pie, dim_radar, …) con titulo_humano,
      # descripción, y args curados para el editor (tipografía, tamaños,
      # canvas, leyendas). El PresetsEditor del frontend usa este
      # metadata + `ArgField` para construir la UI.
      #
      # Igual que /registry, el frontend pinta solo lo que está curado;
      # args técnicos raros quedan fuera del UI y se setean vía overrides
      # por-slot o JSON avanzado.
      .presets_metadata_payload()
    })) |>
    plumber::pr_get("/api/graficos/variables", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      if (is.null(s$rp_inst)) return(list(variables = list()))
      survey <- s$rp_inst$survey
      if (is.null(survey)) return(list(variables = list()))
      skip <- c("begin_group","end_group","begin_repeat","end_repeat","start","end","today","deviceid","note","calculate")
      vars <- list()
      for (i in seq_len(nrow(survey))) {
        tb <- as.character(survey$type_base[i] %||% survey$type[i] %||% "")
        if (tb %in% skip) next
        nm <- as.character(survey$name[i] %||% "")
        if (!nzchar(nm)) next
        vars[[length(vars) + 1]] <- list(
          name = nm,
          label = as.character(survey$label[i] %||% nm),
          tipo = tb,
          seccion = as.character(survey$group_name[i] %||% "")
        )
      }
      list(variables = vars)
    })) |>
    plumber::pr_get("/api/graficos/paletas-sugeridas", wrap_endpoint(function(req, res) {
      # Devuelve todas las listas de choices del instrumento con sus
      # value-labels, para que la UI del editor de paletas sepa qué
      # rellenar. Formato:
      #   [{list_name, choices: [{name, label}]}]
      # Si ya hay una paleta guardada para un list_name en el config, el
      # frontend la mergea por encima. Si no, muestra los labels sin
      # color asignado (placeholder gris).
      sid <- session_header(req)
      s <- session_get(sid)
      if (is.null(s$rp_inst)) return(list(listas = list()))
      choices <- s$rp_inst$choices
      if (is.null(choices) || nrow(choices) == 0L) return(list(listas = list()))

      list_names <- unique(as.character(choices$list_name %||% ""))
      list_names <- list_names[nzchar(list_names)]

      listas <- lapply(list_names, function(ln) {
        rows <- choices[as.character(choices$list_name) == ln, , drop = FALSE]
        if (nrow(rows) == 0L) return(NULL)
        items <- lapply(seq_len(nrow(rows)), function(i) {
          list(
            name  = as.character(rows$name[i]  %||% ""),
            label = as.character(rows$label[i] %||% rows$name[i])
          )
        })
        list(list_name = ln, choices = items)
      })
      listas <- Filter(Negate(is.null), listas)
      list(listas = listas)
    })) |>
    plumber::pr_post("/api/graficos/icons/upload", wrap_endpoint(function(req, res, ...) {
      # Recibe un PNG codificado en base64 (plus nombre humano) y lo
      # persiste en sesión como archivo descargable. Devuelve
      # {ok, id, file_id, nombre}. El store del frontend luego guarda
      # esta referencia en `iconos` y la envía al exportar slides de
      # población (el backend la resuelve a path al construir el slide).
      sid <- session_header(req)
      s <- session_get(sid)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      nombre <- as.character(parsed$nombre %||% "")
      data_b64 <- as.character(parsed$data_base64 %||% "")
      if (!nzchar(nombre))  stop_api(400, "E_NO_NOMBRE", "Falta 'nombre'.")
      if (!nzchar(data_b64)) stop_api(400, "E_NO_DATA",   "Falta 'data_base64'.")

      # Quitar prefijo "data:image/png;base64," si viene
      data_b64 <- sub("^data:[^;]*;base64,", "", data_b64)
      bytes <- tryCatch(
        jsonlite::base64_dec(data_b64),
        error = function(e) stop_api(400, "E_BAD_BASE64", conditionMessage(e))
      )
      # Validación mínima: chequear firma PNG (89 50 4E 47 0D 0A 1A 0A)
      png_sig <- as.raw(c(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
      if (length(bytes) < 8L || !identical(bytes[1:8], png_sig)) {
        stop_api(400, "E_BAD_PNG", "El archivo no parece ser un PNG válido.")
      }

      icons_dir <- file.path(s$dir, "icons")
      dir.create(icons_dir, showWarnings = FALSE, recursive = TRUE)
      file_id <- uuid::UUIDgenerate()
      path <- file.path(icons_dir, paste0(file_id, ".png"))
      writeBin(bytes, path)

      # Registrar en el file store para que /files/:id/download sirva.
      meta <- .register_output_file(sid, "graficos_icon", path)

      list(
        ok = TRUE,
        id = file_id,
        file_id = meta$file_id,
        nombre = nombre,
        uploaded_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
      )
    })) |>
    plumber::pr_post("/api/graficos/validar", wrap_endpoint(function(req, res, plan = NULL) {
      if (is.null(plan)) stop_api(400, "E_NO_PLAN", "Falta 'plan' en el body")
      .validar_plan_json(plan)
    })) |>
    plumber::pr_post("/api/graficos/preview-slide", wrap_endpoint(function(req, res, ...) {
      # Genera un .pptx mini con UN solo slide, para que el analista vea
      # cómo queda su slide específico sin tener que correr el reporte
      # completo. Fiel al output final (usa el mismo pipeline de export)
      # pero rápido (2-3s típico para 1 slide).
      #
      # Sincrónico (no callr) porque el tamaño es chico. Si en el futuro
      # vemos timeouts con dimensiones/FODA, migramos a job_submit.
      sid <- session_header(req)
      s <- .require_rp_data(sid)

      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      slide <- parsed$slide
      if (is.null(slide)) stop_api(400, "E_NO_SLIDE", "Body debe incluir 'slide'.")

      # Validación mínima: tiene tipo y payload.
      tipo <- as.character(slide$tipo %||% "")
      if (!nzchar(tipo) || !(tipo %in% .slide_names())) {
        stop_api(400, "E_BAD_SLIDE", sprintf("Tipo de slide inválido: '%s'", tipo))
      }

      # Presets desde la config del store (si los hay), para que el preview
      # respete el estilo global ya configurado en Configuración Global.
      # Enriquecemos con usar_canvas=TRUE + debug_ph (invariantes globales
      # que el backend aplica antes de cada export).
      cfg <- session_get(sid)$graficos_config %||% list()
      presets_json <- .enriquecer_presets(cfg$presets %||% list(), cfg$debug_ph)

      # Plan mini con un solo slide.
      mini_plan <- list(slides = list(slide))

      dir.create(file.path(s$dir, "downloads"), showWarnings = FALSE, recursive = TRUE)
      out_path <- file.path(s$dir, "downloads", sprintf("preview_%s.pptx", uuid::UUIDgenerate()))

      # Construir slide con las mismas funciones que usa el worker de /ppt.
      slide_registry <- setNames(
        lapply(.slide_names(), function(nm) list(grafs = setdiff(.slide_slots(nm), "icono"))),
        .slide_names()
      )
      graficador_registry <- .graf_names()

      rebuild_graf <- function(g) {
        if (is.null(g) || is.null(g$graficador) || !nzchar(g$graficador)) return(NULL)
        if (!(g$graficador %in% graficador_registry)) stop(sprintf("Graficador no registrado: %s", g$graficador))
        fn <- getExportedValue("prosecnur", g$graficador)
        do.call(fn, as.list(g$args %||% list()))
      }
      as_list_shallow <- function(x) {
        if (is.null(x)) return(NULL)
        if (is.list(x)) return(x)
        as.list(x)
      }
      rebuild_slide <- function(s0) {
        s0 <- as.list(s0)
        payload <- as_list_shallow(s0$payload) %||% list()
        payload <- lapply(payload, function(v) if (is.list(v) && length(v) == 1 && is.null(names(v))) v[[1]] else v)
        for (slot_name in slide_registry[[tipo]]$grafs) {
          if (!is.null(payload[[slot_name]])) {
            payload[[slot_name]] <- rebuild_graf(as_list_shallow(payload[[slot_name]]))
          }
        }
        fn <- getExportedValue("prosecnur", tipo)
        allowed_args <- names(formals(fn))
        payload <- payload[names(payload) %in% allowed_args]
        do.call(fn, payload)
      }

      build_presets <- function(pj) {
        if (is.null(pj) || length(pj) == 0) return(NULL)
        do.call(prosecnur::p_presets, lapply(pj, as.list))
      }

      # Ejecución del preview. Envuelvo en tryCatch para devolver un
      # error legible si algún arg falta o invalida.
      tryCatch({
        slide_r <- rebuild_slide(slide)
        prosecnur::reporte_ppt_plan(
          data = s$rp_data,
          instrumento = s$rp_inst,
          path_ppt = out_path,
          presets = build_presets(presets_json),
          plan = do.call(prosecnur::p_plan, list(slides = list(slide_r))),
          mensajes_progreso = FALSE
        )
      }, error = function(e) {
        stop_api(400, "E_PREVIEW_FAILED", sprintf("No se pudo generar el preview: %s", conditionMessage(e)))
      })

      # Extraemos las imágenes PNG embebidas en el .pptx para devolverlas
      # inline al frontend. Los graficadores de prosecnur con
      # `usar_canvas=TRUE` (invariante global) renderizan cada slot como
      # un PNG dentro de `ppt/media/` del .pptx. Leerlos es más barato que
      # convertir el pptx a png con libreoffice/magick y no requiere
      # dependencias externas — solo descomprimir un ZIP (el pkg `zip`
      # ya es dep del launcher).
      #
      # Si hay 1 slot, `images` tiene 1 PNG (el del gráfico). Si hay N
      # slots, N PNGs. El frontend los puede mostrar lado a lado. Los
      # layouts puros (p_slide_portada, p_slide_indice) devuelven 0.
      images <- .extract_pptx_images(out_path)

      meta <- .register_output_file(sid, "graficos_preview", out_path)
      list(
        ok = TRUE,
        file_id = meta$file_id,
        size = meta$size,
        type = "pptx",
        images = images
      )
    })) |>
    plumber::pr_post("/api/graficos/ppt", wrap_endpoint(function(req, res, plan = NULL, presets = NULL, w_presets = NULL) {
      sid <- session_header(req)
      s <- .require_rp_data(sid)
      if (is.null(plan)) stop_api(400, "E_NO_PLAN", "Falta 'plan' en el body")
      plan <- .normalize_plan(plan)
      validation <- .validar_plan_json(plan)
      if (!validation$ok) stop_api(400, "E_INVALID_PLAN", paste(validation$errors, collapse = "; "))
      # Enriquecer presets con canvas-always + debug_ph global antes de
      # pasarlos al worker (invariantes Pulso).
      cfg <- session_get(sid)$graficos_config %||% list()
      presets <- .enriquecer_presets(presets, cfg$debug_ph)
      rp_data_path <- job_save_rds(sid, "rp_data", s$rp_data)
      rp_inst_path <- job_save_rds(sid, "rp_inst", s$rp_inst)
      # El worker recibe el registry como argumento (serializado desde el
       # main process) — así una única fuente de verdad vive en
       # graficos_metadata.R, y el worker callr no necesita duplicarla.
      slide_registry_arg <- setNames(
        lapply(.slide_names(), function(nm) list(grafs = setdiff(.slide_slots(nm), "icono"))),
        .slide_names()
      )
      graficador_registry_arg <- .graf_names()

      # El worker hereda nada del main process (callr::r_bg). Si estamos
      # corriendo con PULSO_PROSECNUR_DEV seteado (paquete cargado vía
      # pkgload en el launcher), hay que repetir la carga acá para que el
      # subproceso resuelva prosecnur::* a la versión dev y no a la
      # instalada (que puede estar desactualizada).
      prosecnur_dev_path <- Sys.getenv("PULSO_PROSECNUR_DEV", "")

      job_id <- job_submit(
        sid = sid,
        kind = "graficos.ppt",
        func = function(rp_data_path, rp_inst_path, plan, presets,
                        slide_registry, graficador_registry,
                        prosecnur_dev_path, result_path) {
          if (nzchar(prosecnur_dev_path) && dir.exists(prosecnur_dev_path)) {
            if (requireNamespace("pkgload", quietly = TRUE)) {
              pkgload::load_all(prosecnur_dev_path, quiet = TRUE)
            } else if (requireNamespace("devtools", quietly = TRUE)) {
              devtools::load_all(prosecnur_dev_path, quiet = TRUE)
            }
          }
          `%||%` <- function(a, b) if (is.null(a)) b else a
          as_json_list <- function(x) {
            if (is.null(x)) return(NULL)
            if (is.data.frame(x)) return(as.list(x))
            if (is.list(x)) return(x)
            as.list(x)
          }
          rebuild_graf <- function(g) {
            if (is.null(g) || is.null(g$graficador) || !nzchar(g$graficador)) return(NULL)
            if (!(g$graficador %in% graficador_registry)) stop(sprintf("Graficador no registrado: %s", g$graficador))
            fn <- getExportedValue("prosecnur", g$graficador)
            do.call(fn, as.list(g$args %||% list()))
          }
          rebuild_slide <- function(s) {
            s <- as.list(s)
            tipo <- as.character(s$tipo %||% "")
            if (!nzchar(tipo)) stop("Slide sin tipo")
            if (!(tipo %in% names(slide_registry))) stop(sprintf("Tipo de slide no registrado: %s", tipo))
            fn <- getExportedValue("prosecnur", tipo)
            payload <- as_json_list(s$payload) %||% list()
            payload <- lapply(payload, function(v) if (is.list(v) && length(v) == 1 && is.null(names(v))) v[[1]] else v)
            for (slot_name in slide_registry[[tipo]]$grafs) {
              if (!is.null(payload[[slot_name]])) {
                payload[[slot_name]] <- rebuild_graf(as_json_list(payload[[slot_name]]))
              }
            }
            allowed_args <- names(formals(fn))
            payload <- payload[names(payload) %in% allowed_args]
            do.call(fn, payload)
          }
          build_presets <- function(presets_json) {
            if (is.null(presets_json) || length(presets_json) == 0) return(NULL)
            do.call(prosecnur::p_presets, lapply(presets_json, as.list))
          }
          slides_r <- lapply(plan$slides, rebuild_slide)
          prosecnur::reporte_ppt_plan(
            data = readRDS(rp_data_path),
            instrumento = readRDS(rp_inst_path),
            path_ppt = result_path,
            presets = build_presets(presets),
            plan = do.call(prosecnur::p_plan, list(slides = slides_r)),
            mensajes_progreso = FALSE
          )
          list(path = result_path, n_slides = length(slides_r))
        },
        args = list(
          rp_data_path = rp_data_path,
          rp_inst_path = rp_inst_path,
          plan = plan,
          presets = presets,
          slide_registry = slide_registry_arg,
          graficador_registry = graficador_registry_arg,
          prosecnur_dev_path = prosecnur_dev_path
        ),
        result_filename = sprintf("reporte_%s.pptx", uuid::UUIDgenerate()),
        on_complete = function(j) {
          meta <- .register_output_file(j$sid, "reporte_ppt", j$result_path)
          session_set(j$sid, "graficos_ppt_ok", TRUE)
          list(ok = TRUE, file_id = meta$file_id, size = meta$size, n_slides = j$result_data$n_slides)
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "graficos.ppt")
    })) |>
    plumber::pr_post("/api/graficos/word", wrap_endpoint(function(req, res, plan = NULL, presets = NULL, w_presets = NULL) {
      sid <- session_header(req)
      s <- .require_rp_data(sid)
      if (is.null(plan)) stop_api(400, "E_NO_PLAN", "Falta 'plan' en el body")
      plan <- .normalize_plan(plan)
      validation <- .validar_plan_json(plan)
      if (!validation$ok) stop_api(400, "E_INVALID_PLAN", paste(validation$errors, collapse = "; "))
      # Mismas invariantes que en /ppt.
      cfg <- session_get(sid)$graficos_config %||% list()
      presets <- .enriquecer_presets(presets, cfg$debug_ph)
      rp_data_path <- job_save_rds(sid, "rp_data", s$rp_data)
      rp_inst_path <- job_save_rds(sid, "rp_inst", s$rp_inst)
      slide_registry_arg <- setNames(
        lapply(.slide_names(), function(nm) list(grafs = setdiff(.slide_slots(nm), "icono"))),
        .slide_names()
      )
      graficador_registry_arg <- .graf_names()

      # Ver comentario en /ppt: el worker necesita recargar el prosecnur
      # dev si corresponde.
      prosecnur_dev_path <- Sys.getenv("PULSO_PROSECNUR_DEV", "")

      job_id <- job_submit(
        sid = sid,
        kind = "graficos.word",
        func = function(rp_data_path, rp_inst_path, plan, presets, w_presets,
                        slide_registry, graficador_registry,
                        prosecnur_dev_path, result_path) {
          if (nzchar(prosecnur_dev_path) && dir.exists(prosecnur_dev_path)) {
            if (requireNamespace("pkgload", quietly = TRUE)) {
              pkgload::load_all(prosecnur_dev_path, quiet = TRUE)
            } else if (requireNamespace("devtools", quietly = TRUE)) {
              devtools::load_all(prosecnur_dev_path, quiet = TRUE)
            }
          }
          `%||%` <- function(a, b) if (is.null(a)) b else a
          # slide_registry / graficador_registry vienen del main process
          # (fuente única de verdad en graficos_metadata.R).
          as_json_list <- function(x) {
            if (is.null(x)) return(NULL)
            if (is.data.frame(x)) return(as.list(x))
            if (is.list(x)) return(x)
            as.list(x)
          }
          rebuild_graf <- function(g) {
            if (is.null(g) || is.null(g$graficador) || !nzchar(g$graficador)) return(NULL)
            if (!(g$graficador %in% graficador_registry)) stop(sprintf("Graficador no registrado: %s", g$graficador))
            fn <- getExportedValue("prosecnur", g$graficador)
            do.call(fn, as.list(g$args %||% list()))
          }
          rebuild_slide <- function(s) {
            s <- as.list(s)
            tipo <- as.character(s$tipo %||% "")
            if (!nzchar(tipo)) stop("Slide sin tipo")
            if (!(tipo %in% names(slide_registry))) stop(sprintf("Tipo de slide no registrado: %s", tipo))
            fn <- getExportedValue("prosecnur", tipo)
            payload <- as_json_list(s$payload) %||% list()
            payload <- lapply(payload, function(v) if (is.list(v) && length(v) == 1 && is.null(names(v))) v[[1]] else v)
            for (slot_name in slide_registry[[tipo]]$grafs) {
              if (!is.null(payload[[slot_name]])) {
                payload[[slot_name]] <- rebuild_graf(as_json_list(payload[[slot_name]]))
              }
            }
            allowed_args <- names(formals(fn))
            payload <- payload[names(payload) %in% allowed_args]
            do.call(fn, payload)
          }
          build_presets <- function(presets_json) {
            if (is.null(presets_json) || length(presets_json) == 0) return(NULL)
            do.call(prosecnur::p_presets, lapply(presets_json, as.list))
          }
          build_w_presets <- function(w_json) {
            if (is.null(w_json) || length(w_json) == 0) return(NULL)
            do.call(prosecnur::w_presets, lapply(w_json, as.list))
          }
          slides_r <- lapply(plan$slides, rebuild_slide)
          prosecnur::reporte_word_plan(
            data = readRDS(rp_data_path),
            instrumento = readRDS(rp_inst_path),
            path_docx = result_path,
            presets_ppt = build_presets(presets),
            presets_word = build_w_presets(w_presets),
            plan = do.call(prosecnur::p_plan, list(slides = slides_r)),
            mensajes_progreso = FALSE
          )
          list(path = result_path, n_slides = length(slides_r))
        },
        args = list(
          rp_data_path = rp_data_path,
          rp_inst_path = rp_inst_path,
          plan = plan,
          presets = presets,
          w_presets = w_presets,
          slide_registry = slide_registry_arg,
          graficador_registry = graficador_registry_arg,
          prosecnur_dev_path = prosecnur_dev_path
        ),
        result_filename = sprintf("reporte_%s.docx", uuid::UUIDgenerate()),
        on_complete = function(j) {
          meta <- .register_output_file(j$sid, "reporte_word", j$result_path)
          session_set(j$sid, "graficos_word_ok", TRUE)
          list(ok = TRUE, file_id = meta$file_id, size = meta$size, n_slides = j$result_data$n_slides)
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "graficos.word")
    }))
}

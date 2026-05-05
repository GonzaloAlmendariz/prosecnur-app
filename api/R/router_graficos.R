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

.clean_rebuild_args <- function(args, fn) {
  args <- as.list(args %||% list())
  args <- args[names(args) %in% names(formals(fn))]
  args[!vapply(args, function(v) {
    is.null(v) ||
      length(v) == 0L ||
      (length(v) == 1L && is.list(v) && is.null(v[[1]])) ||
      (length(v) == 1L && is.atomic(v) && is.na(v))
  }, logical(1))]
}

.require_rp_data <- function(sid) {
  s <- session_get(sid)
  ds <- estudio_data_sources(sid)
  is_ <- estudio_inst_sources(sid)
  if (length(ds) == 0L || length(is_) == 0L) {
    stop_api(409, "E_NO_RP_DATA",
             "Primero agrega al menos una base al estudio (Fase 1).")
  }
  s
}

.rebuild_graf <- function(g) {
  if (is.null(g)) return(NULL)
  if (is.null(g$graficador) || !nzchar(g$graficador)) return(NULL)
  if (!(g$graficador %in% .GRAFICADOR_REGISTRY)) {
    stop_api(400, "E_UNKNOWN_GRAF", sprintf("Graficador no registrado: %s", g$graficador))
  }
  fn <- getExportedValue("prosecnurapp", g$graficador)
  do.call(fn, .clean_rebuild_args(g$args, fn))
}

.rebuild_slide <- function(s) {
  s <- as.list(s)
  tipo <- as.character(s$tipo %||% "")
  if (!nzchar(tipo)) stop_api(400, "E_MISSING_TIPO", "Slide sin tipo")
  if (!(tipo %in% names(.SLIDE_REGISTRY))) {
    stop_api(400, "E_UNKNOWN_TIPO", sprintf("Tipo de slide no registrado: %s", tipo))
  }
  fn <- getExportedValue("prosecnurapp", tipo)
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
  do.call(p_presets, args)
}

.build_w_presets <- function(w_json) {
  if (is.null(w_json) || length(w_json) == 0) return(NULL)
  args <- lapply(w_json, as.list)
  do.call(w_presets, args)
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

# Config por defecto del plan de gráficos.
#
# Los `presets` vienen pre-poblados con los defaults de Pulso (por sesión
# el analista puede sobrescribirlos con "Guardar como default" — se
# guardan en s$graficos_presets_defaults y tienen prioridad sobre los
# de fábrica). Idem para `overrides_reusables`.
.graficos_default_config <- function(sid = NULL) {
  user_presets   <- if (!is.null(sid)) session_get(sid, required = FALSE)$graficos_presets_defaults else NULL
  user_overrides <- if (!is.null(sid)) session_get(sid, required = FALSE)$graficos_overrides_defaults else NULL
  list(
    version = 2L,
    plan = list(slides = list()),
    presets = user_presets %||% .PRESETS_DEFAULT_PULSO,
    w_presets = list(),
    selected_slide_id = NULL,
    paletas = list(),
    iconos = list(),
    overrides_reusables = user_overrides %||% .OVERRIDES_DEFAULT_PULSO,
    debug_ph = list(activo = FALSE, color = "#FF00FF", lwd = 0.6)
  )
}

# Enriquece la config de presets JSON antes de pasarla a prosecnur con:
# 1. `usar_canvas = TRUE` en todos los tipos (invariante de Prosecnur — todos
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

# Resuelve un Target relativo de un .rels a su path absoluto dentro del
# .pptx (el "zip"). Los Targets de rels son relativos al FILE que el
# .rels describe, no al .rels en sí. Ej.:
#   rel_file = "ppt/slides/_rels/slide1.xml.rels"
#   owner    = "ppt/slides/slide1.xml"     (strip `_rels/` y `.rels`)
#   target   = "../media/image1.png"
#   =>         "ppt/media/image1.png"      (tras resolver `..`)
.resolve_rel_target <- function(rel_file, target) {
  if (startsWith(target, "/")) return(sub("^/+", "", target))
  owner_file <- sub("_rels/([^/]+)\\.rels$", "\\1", rel_file)
  base_dir <- dirname(owner_file)
  combined <- if (nzchar(base_dir) && base_dir != ".") {
    paste0(base_dir, "/", target)
  } else {
    target
  }
  parts <- strsplit(combined, "/", fixed = TRUE)[[1]]
  out <- character(0)
  for (p in parts) {
    if (p == "" || p == ".") next
    if (p == "..") {
      if (length(out) > 0L) out <- out[-length(out)]
    } else {
      out <- c(out, p)
    }
  }
  paste(out, collapse = "/")
}

# Extrae las imágenes PNG que los slides de un .pptx realmente
# referencian (vía `ppt/slides/_rels/slideN.xml.rels`). Excluye
# intencionalmente las imágenes que aparecen SOLO en layouts, masters
# o themes — si no, los logos del template se colaban como si fueran
# gráficos generados por el graficador.
#
# Los graficadores de prosecnur con `usar_canvas=TRUE` renderizan cada
# slot como un PNG que officer inserta con una relación tipo image en
# el .rels del slide. Ese es exactamente el set que queremos mostrar
# en el preview.
#
# Fallback: si por algún motivo no se encuentra ninguna referencia en
# los rels (pptx con estructura atípica), devolvemos todas las
# imágenes como antes — mejor mostrar algo que nada.
#
# El orden se conserva por número natural (image1, image2, …) que
# corresponde al orden en que officer las fue añadiendo.
.extract_pptx_images <- function(pptx_path) {
  if (!file.exists(pptx_path)) return(list())
  if (!requireNamespace("zip", quietly = TRUE)) return(list())

  tmpdir <- tempfile("pptx_extract_")
  dir.create(tmpdir, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(tmpdir, recursive = TRUE, force = TRUE), add = TRUE)

  entries <- tryCatch(zip::zip_list(pptx_path), error = function(e) NULL)
  if (is.null(entries) || !nrow(entries)) return(list())

  # PNGs candidatos en ppt/media/
  media_rows <- entries[grepl("^ppt/media/.*\\.png$", entries$filename, ignore.case = TRUE), , drop = FALSE]
  if (!nrow(media_rows)) return(list())

  # .rels de slides únicamente (NO layouts/masters/theme)
  slide_rels <- entries$filename[
    grepl("^ppt/slides/_rels/slide\\d+\\.xml\\.rels$", entries$filename, ignore.case = TRUE)
  ]

  # Extraer rels + media en una sola llamada
  to_extract <- unique(c(slide_rels, media_rows$filename))
  tryCatch(
    zip::unzip(pptx_path, files = to_extract, exdir = tmpdir),
    error = function(e) NULL
  )

  # Parsear cada .rels para coleccionar los Targets de relaciones Image.
  # Los Relationships XML usan namespace default:
  # http://schemas.openxmlformats.org/package/2006/relationships
  # Usamos local-name() en el XPath para evitar binding de namespaces.
  referenced <- character(0)
  for (rel_file in slide_rels) {
    full_rel <- file.path(tmpdir, rel_file)
    if (!file.exists(full_rel)) next
    doc <- tryCatch(xml2::read_xml(full_rel), error = function(e) NULL)
    if (is.null(doc)) next
    nodes <- tryCatch(
      xml2::xml_find_all(
        doc,
        ".//*[local-name()='Relationship' and contains(@Type, '/image')]"
      ),
      error = function(e) NULL
    )
    if (is.null(nodes) || length(nodes) == 0L) next
    for (n in nodes) {
      tgt <- xml2::xml_attr(n, "Target")
      if (is.null(tgt) || is.na(tgt) || !nzchar(tgt)) next
      referenced <- c(referenced, .resolve_rel_target(rel_file, tgt))
    }
  }
  referenced <- unique(referenced)

  # Filtrar a solo las referenciadas por los slides. Fallback conservador
  # si no se detectó ninguna (pptx atípico): devolver todas.
  if (length(referenced) > 0L) {
    media_rows <- media_rows[media_rows$filename %in% referenced, , drop = FALSE]
  }
  if (!nrow(media_rows)) return(list())

  # Ordenar por número natural (image1, image2, … image10). Usamos vapply
  # para garantizar que `nums` tenga la misma longitud que `media_rows`:
  # regmatches con regexpr devuelve vector VACÍO (no NA) cuando el
  # filename no tiene dígitos, lo que colapsaba `order()` y borraba todas
  # las filas. Sentinel 999L ⇒ los sin dígito van al final en orden estable.
  nums <- vapply(
    media_rows$filename,
    function(f) {
      m <- regmatches(f, regexpr("[0-9]+", f))
      if (length(m) == 0L) return(999L)
      suppressWarnings(as.integer(m[[1]]))
    },
    integer(1),
    USE.NAMES = FALSE
  )
  nums[is.na(nums)] <- 999L
  media_rows <- media_rows[order(nums), , drop = FALSE]

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
      cfg <- s$graficos_config %||% .graficos_default_config(sid)
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
        config = s$graficos_config %||% .graficos_default_config(sid)
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
    plumber::pr_post("/api/graficos/presets-defaults", wrap_endpoint(function(req, res, ...) {
      # "Guardar como default": toma los `presets` actuales del store de
      # la sesión (lo que el analista tiene configurado) y los guarda
      # como el nuevo default. Próximas sesiones o reset del plan van
      # a usar estos en vez de .PRESETS_DEFAULT_PULSO (de fábrica).
      #
      # Body opcional: { "presets": {...} }. Si viene, usa ese; si no,
      # usa el s$graficos_config$presets actual.
      sid <- session_header(req)
      s <- session_get(sid)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      presets_new <- NULL
      if (nzchar(body_raw)) {
        Encoding(body_raw) <- "UTF-8"
        parsed <- tryCatch(
          jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
          error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
        )
        presets_new <- parsed$presets
      }
      if (is.null(presets_new)) {
        presets_new <- s$graficos_config$presets
      }
      if (is.null(presets_new)) {
        stop_api(400, "E_NO_PRESETS", "No hay presets en la config actual para guardar como default.")
      }
      session_set(sid, "graficos_presets_defaults", presets_new)
      list(ok = TRUE, saved_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
    })) |>
    plumber::pr_delete("/api/graficos/presets-defaults", wrap_endpoint(function(req, res) {
      # Resetea los "defaults del usuario" a los de fábrica (.PRESETS_DEFAULT_PULSO).
      # No toca el estado actual del store — solo el "factory default"
      # que usan los reset futuros.
      sid <- session_header(req)
      session_set(sid, "graficos_presets_defaults", NULL)
      list(ok = TRUE)
    })) |>
    plumber::pr_get("/api/graficos/presets-defaults", wrap_endpoint(function(req, res) {
      # Devuelve los presets default EFECTIVOS (los del usuario si los
      # hay, sino los de fábrica). El frontend los usa para el "Restaurar
      # default" — en vez de borrar el arg (que cae implícitamente al
      # default), el frontend puede pre-llenar con el default actual.
      sid <- session_header(req)
      s <- session_get(sid, required = FALSE)
      user <- if (!is.null(s)) s$graficos_presets_defaults else NULL
      list(
        ok = TRUE,
        presets = user %||% .PRESETS_DEFAULT_PULSO,
        es_custom = !is.null(user)
      )
    })) |>

    # ---- Overrides defaults ------------------------------------------
    # Mismo patrón que presets-defaults. Los "defaults" son la lista
    # de overrides reusables con la que arranca CUALQUIER estudio nuevo.
    # El modal "Defaults de overrides" edita esta lista → se persiste
    # en `s$graficos_overrides_defaults` (por-sesión-de-usuario, no
    # por-estudio). Si no hay custom, el fallback es `.OVERRIDES_DEFAULT_PULSO`.
    plumber::pr_get("/api/graficos/overrides-defaults", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid, required = FALSE)
      user <- if (!is.null(s)) s$graficos_overrides_defaults else NULL
      list(
        ok = TRUE,
        overrides = user %||% .OVERRIDES_DEFAULT_PULSO,
        es_custom = !is.null(user)
      )
    })) |>
    plumber::pr_post("/api/graficos/overrides-defaults", wrap_endpoint(function(req, res, ...) {
      # Body: { "overrides": [ {id, nombre, tipo_preset, args}, ... ] }.
      # Si no viene body, toma la lista actual del store del estudio
      # (`s$graficos_config$overrides_reusables`) — equivalente al
      # "Guardar como default" de presets.
      sid <- session_header(req)
      s <- session_get(sid)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      overrides_new <- NULL
      if (nzchar(body_raw)) {
        Encoding(body_raw) <- "UTF-8"
        parsed <- tryCatch(
          jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
          error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
        )
        overrides_new <- parsed$overrides
      }
      if (is.null(overrides_new)) {
        overrides_new <- s$graficos_config$overrides_reusables
      }
      if (is.null(overrides_new)) {
        stop_api(400, "E_NO_OVERRIDES",
                 "No hay overrides en la config actual para guardar como default.")
      }
      # Sanity check liviano: debe ser una lista (array) — no un dict.
      if (!is.list(overrides_new) || !is.null(names(overrides_new))) {
        stop_api(400, "E_BAD_OVERRIDES",
                 "Formato inválido: se esperaba un array de overrides.")
      }
      session_set(sid, "graficos_overrides_defaults", overrides_new)
      list(ok = TRUE, saved_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
    })) |>
    plumber::pr_delete("/api/graficos/overrides-defaults", wrap_endpoint(function(req, res) {
      # Resetea al set de fábrica (.OVERRIDES_DEFAULT_PULSO).
      sid <- session_header(req)
      session_set(sid, "graficos_overrides_defaults", NULL)
      list(ok = TRUE)
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
      # Devuelve las variables agrupadas por fuente (multi-base, v0.2+).
      # Respuesta:
      #   {
      #     sources: [
      #       { name: "docentes", variables: [{ name, label, tipo, seccion }, ...] },
      #       { name: "estudiantes", variables: [...] },
      #       ...
      #     ],
      #     multi: true|false   (si hay >1 fuente)
      #   }
      # El frontend usa `sources[0].variables` directamente si multi=false
      # (back-compat visual: sin dropdown de fuente), o el dropdown cuando
      # multi=true.
      sid <- session_header(req)
      inst_sources <- estudio_inst_sources(sid)
      skip <- c("begin_group","end_group","begin_repeat","end_repeat",
                "start","end","today","deviceid","note","calculate")
      .choices_label_col <- function(choices_tbl) {
        if (is.null(choices_tbl) || !is.data.frame(choices_tbl)) return(NA_character_)
        candidates <- c("label", "label::es")
        hit <- candidates[candidates %in% names(choices_tbl)][1]
        if (!length(hit) || is.na(hit)) {
          extras <- setdiff(names(choices_tbl), c("list_name", "name", "value"))
          hit <- extras[1]
        }
        if (!length(hit) || is.na(hit)) NA_character_ else hit
      }
      .list_name_for_row <- function(survey, i) {
        for (col in c("list_name", "list_norm")) {
          if (col %in% names(survey)) {
            x <- as.character(survey[[col]][i] %||% "")
            if (nzchar(x)) return(x)
          }
        }
        tp <- as.character(survey$type[i] %||% "")
        parts <- strsplit(tp, "\\s+")[[1]]
        if (length(parts) >= 2L && parts[1] %in% c("select_one", "select_multiple")) {
          return(parts[2])
        }
        ""
      }
      .choices_for_list <- function(choices, list_name) {
        if (is.null(choices) || !is.data.frame(choices) || !nzchar(list_name) ||
            !"list_name" %in% names(choices) || !"name" %in% names(choices)) {
          return(list(items = list(), signature = ""))
        }
        rows <- choices[as.character(choices$list_name) == list_name, , drop = FALSE]
        if (!nrow(rows)) return(list(items = list(), signature = ""))
        lab_col <- .choices_label_col(rows)
        items <- lapply(seq_len(nrow(rows)), function(j) {
          nm <- as.character(rows$name[j] %||% "")
          lab <- if (!is.na(lab_col) && lab_col %in% names(rows)) {
            as.character(rows[[lab_col]][j] %||% nm)
          } else {
            nm
          }
          list(name = nm, label = lab)
        })
        signature <- paste(vapply(items, function(it) {
          paste0(as.character(it$name %||% ""), "=", as.character(it$label %||% ""))
        }, character(1)), collapse = "|")
        list(items = items, signature = signature)
      }
      extract_vars <- function(rp_inst) {
        if (is.null(rp_inst)) return(list())
        survey <- rp_inst$survey
        if (is.null(survey)) return(list())
        choices <- rp_inst$choices %||% rp_inst$choices_raw %||% NULL
        vs <- list()
        for (i in seq_len(nrow(survey))) {
          tb <- as.character(survey$type_base[i] %||% survey$type[i] %||% "")
          if (tb %in% skip) next
          nm <- as.character(survey$name[i] %||% "")
          if (!nzchar(nm)) next
          list_name <- .list_name_for_row(survey, i)
          choice_meta <- .choices_for_list(choices, list_name)
          vs[[length(vs) + 1]] <- list(
            name = nm,
            label = as.character(survey$label[i] %||% nm),
            tipo = tb,
            seccion = as.character(survey$group_name[i] %||% ""),
            list_name = list_name,
            choices = choice_meta$items,
            scale_signature = choice_meta$signature
          )
        }
        vs
      }
      sources <- lapply(names(inst_sources), function(nm) {
        list(name = nm, variables = extract_vars(inst_sources[[nm]]))
      })
      list(sources = sources, multi = length(sources) > 1L)
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
        fn <- getExportedValue("prosecnurapp", g$graficador)
        args <- as.list(g$args %||% list())
        args <- args[names(args) %in% names(formals(fn))]
        args <- args[!vapply(args, function(v) {
          is.null(v) ||
            length(v) == 0L ||
            (length(v) == 1L && is.list(v) && is.null(v[[1]])) ||
            (length(v) == 1L && is.atomic(v) && is.na(v))
        }, logical(1))]
        do.call(fn, args)
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
        fn <- getExportedValue("prosecnurapp", tipo)
        allowed_args <- names(formals(fn))
        payload <- payload[names(payload) %in% allowed_args]
        do.call(fn, payload)
      }

      build_presets <- function(pj) {
        if (is.null(pj) || length(pj) == 0) return(NULL)
        do.call(p_presets, lapply(pj, as.list))
      }

      # Ejecución del preview. Envuelvo en tryCatch para devolver un
      # error legible si algún arg falta o invalida.
      #
      # `data` e `instrumento` se pasan como listas nombradas (multi-base).
      # Cuando hay 1 sola base, estudio_data_sources devuelve
      # `list(<nombre> = df)` y el motor maneja ese caso como single-base.
      tryCatch({
        slide_r <- rebuild_slide(slide)
        reporte_ppt_plan(
          data = estudio_data_sources(sid),
          instrumento = estudio_inst_sources(sid),
          path_ppt = out_path,
          presets = build_presets(presets_json),
          plan = do.call(p_plan, list(slides = list(slide_r))),
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
      # Serializamos las LISTAS NOMBRADAS (multi-base) a RDS para el
      # worker. Cuando hay 1 sola base, la lista tiene 1 sola entrada
      # y el motor la maneja como single-base automáticamente.
      rp_data_path <- job_save_rds(sid, "rp_data_sources", estudio_data_sources(sid))
      rp_inst_path <- job_save_rds(sid, "rp_inst_sources", estudio_inst_sources(sid))
      # El worker recibe el registry como argumento (serializado desde el
       # main process) — así una única fuente de verdad vive en
       # graficos_metadata.R, y el worker callr no necesita duplicarla.
      slide_registry_arg <- setNames(
        lapply(.slide_names(), function(nm) list(grafs = setdiff(.slide_slots(nm), "icono"))),
        .slide_names()
      )
      graficador_registry_arg <- .graf_names()

      # El worker hereda nada del main process (callr::r_bg). Necesitamos
      # cargar el paquete prosecnurapp en el subproceso para que resuelva
      # los p_slide_*/p_barras_*/reporte_ppt_plan (ahora todos viven en
      # prosecnurapp, no en un paquete externo).
      api_path <- .app_api_dir()

      job_id <- job_submit(
        sid = sid,
        kind = "graficos.ppt",
        func = function(rp_data_path, rp_inst_path, plan, presets,
                        slide_registry, graficador_registry,
                        api_path, result_path, progress_path = NULL) {
          if (requireNamespace("pkgload", quietly = TRUE)) {
            pkgload::load_all(api_path, quiet = TRUE)
          } else if (requireNamespace("devtools", quietly = TRUE)) {
            devtools::load_all(api_path, quiet = TRUE)
          } else {
            stop("Worker requiere 'pkgload' o 'devtools' instalados.")
          }
          `%||%` <- function(a, b) if (is.null(a)) b else a
          report <- if (exists("job_progress_writer", mode = "function")) {
            job_progress_writer(progress_path)
          } else {
            function(...) invisible(NULL)
          }
          report("loading", percent = 2, message = "Cargando datos y plantilla...")
          as_json_list <- function(x) {
            if (is.null(x)) return(NULL)
            if (is.data.frame(x)) return(as.list(x))
            if (is.list(x)) return(x)
            as.list(x)
          }
          rebuild_graf <- function(g) {
            if (is.null(g) || is.null(g$graficador) || !nzchar(g$graficador)) return(NULL)
            if (!(g$graficador %in% graficador_registry)) stop(sprintf("Graficador no registrado: %s", g$graficador))
            fn <- getExportedValue("prosecnurapp", g$graficador)
            args <- as.list(g$args %||% list())
            args <- args[names(args) %in% names(formals(fn))]
            args <- args[!vapply(args, function(v) {
              is.null(v) ||
                length(v) == 0L ||
                (length(v) == 1L && is.list(v) && is.null(v[[1]])) ||
                (length(v) == 1L && is.atomic(v) && is.na(v))
            }, logical(1))]
            do.call(fn, args)
          }
          rebuild_slide <- function(s) {
            s <- as.list(s)
            tipo <- as.character(s$tipo %||% "")
            if (!nzchar(tipo)) stop("Slide sin tipo")
            if (!(tipo %in% names(slide_registry))) stop(sprintf("Tipo de slide no registrado: %s", tipo))
            fn <- getExportedValue("prosecnurapp", tipo)
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
            do.call(p_presets, lapply(presets_json, as.list))
          }
          total_slides <- length(plan$slides)
          slides_r <- vector("list", total_slides)
          for (i in seq_len(total_slides)) {
            report(
              "rebuild",
              current = i,
              total = total_slides,
              percent = 5 + round(45 * (i - 1) / max(1, total_slides)),
              message = sprintf("Armando slide %s de %s...", i, total_slides)
            )
            slides_r[[i]] <- rebuild_slide(plan$slides[[i]])
          }
          report("render", percent = 60, message = "Renderizando presentación...")
          reporte_ppt_plan(
            data = readRDS(rp_data_path),
            instrumento = readRDS(rp_inst_path),
            path_ppt = result_path,
            presets = build_presets(presets),
            plan = do.call(p_plan, list(slides = slides_r)),
            mensajes_progreso = FALSE
          )
          report("export", percent = 96, message = "Guardando PPTX...")
          list(path = result_path, n_slides = length(slides_r))
        },
        args = list(
          rp_data_path = rp_data_path,
          rp_inst_path = rp_inst_path,
          plan = plan,
          presets = presets,
          slide_registry = slide_registry_arg,
          graficador_registry = graficador_registry_arg,
          api_path = api_path
        ),
        result_filename = .export_filename(sid, "reporte_ppt", "pptx"),
        on_complete = function(j) {
          meta <- .register_output_file(j$sid, "reporte_ppt", j$result_path)
          session_set(j$sid, "graficos_ppt_ok", TRUE)
          list(ok = TRUE, file_id = meta$file_id, filename = meta$original_name, size = meta$size, n_slides = j$result_data$n_slides)
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
      # Serializamos las LISTAS NOMBRADAS (multi-base) a RDS para el
      # worker. Cuando hay 1 sola base, la lista tiene 1 sola entrada
      # y el motor la maneja como single-base automáticamente.
      rp_data_path <- job_save_rds(sid, "rp_data_sources", estudio_data_sources(sid))
      rp_inst_path <- job_save_rds(sid, "rp_inst_sources", estudio_inst_sources(sid))
      slide_registry_arg <- setNames(
        lapply(.slide_names(), function(nm) list(grafs = setdiff(.slide_slots(nm), "icono"))),
        .slide_names()
      )
      graficador_registry_arg <- .graf_names()

      # Ver comentario en /ppt: el worker necesita cargar prosecnurapp
      # (el motor ya vive dentro del paquete de la app).
      api_path <- .app_api_dir()

      job_id <- job_submit(
        sid = sid,
        kind = "graficos.word",
        func = function(rp_data_path, rp_inst_path, plan, presets, w_presets,
                        slide_registry, graficador_registry,
                        api_path, result_path, progress_path = NULL) {
          if (requireNamespace("pkgload", quietly = TRUE)) {
            pkgload::load_all(api_path, quiet = TRUE)
          } else if (requireNamespace("devtools", quietly = TRUE)) {
            devtools::load_all(api_path, quiet = TRUE)
          } else {
            stop("Worker requiere 'pkgload' o 'devtools' instalados.")
          }
          `%||%` <- function(a, b) if (is.null(a)) b else a
          report <- if (exists("job_progress_writer", mode = "function")) {
            job_progress_writer(progress_path)
          } else {
            function(...) invisible(NULL)
          }
          report("loading", percent = 2, message = "Cargando datos y plantilla...")
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
            fn <- getExportedValue("prosecnurapp", g$graficador)
            args <- as.list(g$args %||% list())
            args <- args[names(args) %in% names(formals(fn))]
            args <- args[!vapply(args, function(v) {
              is.null(v) ||
                length(v) == 0L ||
                (length(v) == 1L && is.list(v) && is.null(v[[1]])) ||
                (length(v) == 1L && is.atomic(v) && is.na(v))
            }, logical(1))]
            do.call(fn, args)
          }
          rebuild_slide <- function(s) {
            s <- as.list(s)
            tipo <- as.character(s$tipo %||% "")
            if (!nzchar(tipo)) stop("Slide sin tipo")
            if (!(tipo %in% names(slide_registry))) stop(sprintf("Tipo de slide no registrado: %s", tipo))
            fn <- getExportedValue("prosecnurapp", tipo)
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
            do.call(p_presets, lapply(presets_json, as.list))
          }
          build_w_presets <- function(w_json) {
            if (is.null(w_json) || length(w_json) == 0) return(NULL)
            do.call(w_presets, lapply(w_json, as.list))
          }
          total_slides <- length(plan$slides)
          slides_r <- vector("list", total_slides)
          for (i in seq_len(total_slides)) {
            report(
              "rebuild",
              current = i,
              total = total_slides,
              percent = 5 + round(45 * (i - 1) / max(1, total_slides)),
              message = sprintf("Armando seccion %s de %s...", i, total_slides)
            )
            slides_r[[i]] <- rebuild_slide(plan$slides[[i]])
          }
          report("render", percent = 60, message = "Renderizando documento...")
          reporte_word_plan(
            data = readRDS(rp_data_path),
            instrumento = readRDS(rp_inst_path),
            path_docx = result_path,
            presets_ppt = build_presets(presets),
            presets_word = build_w_presets(w_presets),
            plan = do.call(p_plan, list(slides = slides_r)),
            mensajes_progreso = FALSE
          )
          report("export", percent = 96, message = "Guardando DOCX...")
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
          api_path = api_path
        ),
        result_filename = .export_filename(sid, "reporte_word", "docx"),
        on_complete = function(j) {
          meta <- .register_output_file(j$sid, "reporte_word", j$result_path)
          session_set(j$sid, "graficos_word_ok", TRUE)
          list(ok = TRUE, file_id = meta$file_id, filename = meta$original_name, size = meta$size, n_slides = j$result_data$n_slides)
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "graficos.word")
    }))
}

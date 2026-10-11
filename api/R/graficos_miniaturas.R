# graficos_miniaturas.R — vista previa de lámina con caché por huella, miniaturas en lote y vista previa asíncrona
# (F6 §5.3 «Punto de estado y miniaturas de 60 láminas», riesgo 7 «render sólo de la lámina activa, cola cancelable,
# caché por hash»). Contrato congelado: docs/qa/contrato-miniaturas-preview-f6-2026-10-11.md.
#
# `/api/graficos/preview-slide` armaba el mini-PPTX dentro del proceso de plumber (hasta ~2 min con cargas grandes) y lo
# cacheaba en sesión con una llave que no miraba los datos: cambiar una etiqueta o una ponderación devolvía, durante cinco
# minutos, la lámina vieja. Aquí:
#   - el motor de la vista previa (mismo pipeline del export: `reporte_ppt_plan` con un mini-plan) se separa del router
#     para que lo llamen igual el endpoint síncrono y el worker `callr` de los jobs;
#   - la caché vive en disco, en `<sesión>/cache/miniaturas/<huella>/` (artefacto DERIVADO de sesión: nunca entra al .pulso
#     ni a state.rds, no se exporta al lado del proyecto), con la huella de graficos_miniaturas_hash.R;
#   - el PPTX es la entrada; el raster (por calidad, partes y renderer) y la miniatura PNG son productos derivados de esa
#     entrada, de modo que la miniatura del lote y la vista previa de la lámina activa comparten el render.
# Audiencia: interna del editor. Las guías de depuración (`debug_ph`) se dibujan en la vista previa como hasta hoy; el
# entregable no pasa por aquí (D17 lo cuida `/ppt`).

# ---- Contexto: todo lo que el render lee ------------------------------------------------------------------------------

#' Contexto de una lámina para la vista previa
#'
#' Función pura: recibe lo ya resuelto y devuelve el contexto con su huella (`hash`). Es lo que viaja al worker.
#' @keywords internal
.mini_contexto <- function(slide, folio = 1L, scope = "active_base", base = "", data_sources, inst_sources,
                           presets_json = list(), paletas = list(), icon_registry = list(), template_pptx = NA_character_,
                           template_id = "generic_16_9", profile_id = "", auto_otros_slides = FALSE,
                           opciones_motor = .mini_opciones_motor(), huella_fuentes = NULL, huella_estandar = NULL,
                           version_paquete = NULL) {
  ctx <- list(
    slide = slide,
    slide_id = as.character(slide$id %||% "")[1],
    tipo = as.character(slide$tipo %||% "")[1],
    folio = as.integer(folio %||% 1L),
    scope = scope,
    base = as.character(base %||% "")[1],
    bases = names(data_sources) %||% character(),
    data_sources = data_sources,
    inst_sources = inst_sources,
    presets_json = presets_json %||% list(),
    paletas = paletas %||% list(),
    icon_registry = icon_registry %||% list(),
    template_pptx = template_pptx,
    template_id = template_id,
    profile_id = profile_id,
    auto_otros_slides = isTRUE(auto_otros_slides),
    opciones_motor = opciones_motor,
    huella_fuentes = huella_fuentes %||% .mini_huella_fuentes(data_sources, inst_sources),
    huella_estandar = huella_estandar %||% .mini_huella_estandar(),
    version_paquete = version_paquete %||% .mini_version_paquete()
  )
  ctx$hash <- as.character(.mini_hash_lamina(ctx))
  ctx
}

#' Fuentes que lee la vista previa según el scope, o 409 si no sirven
#' @keywords internal
.graficos_preview_fuentes <- function(sid, parsed) {
  scope <- tolower(trimws(as.character(parsed$scope %||% "")[1]))
  consolidado <- identical(scope, "consolidated")
  fuentes <- if (isTRUE(consolidado)) .graficos_consolidado_sources(sid) else .graficos_processing_sources(sid)
  if (!.graficos_sources_usable(fuentes$data_sources, fuentes$inst_sources)) {
    stop_api(
      409,
      "E_NO_VALID_RP_DATA",
      if (isTRUE(consolidado)) {
        "Las fuentes procesadas del consolidado no estan disponibles o quedaron incompletas."
      } else {
        .graficos_base_error(
          sid,
          paste(
            "La fuente procesada para Graficos no esta disponible o quedo incompleta.",
            "Vuelve a aplicar la codificacion o recarga la base desde Fase 1."
          )
        )
      }
    )
  }
  fuentes$consolidado <- isTRUE(consolidado)
  fuentes
}

#' Lo común a todas las láminas de un pedido: fuentes, config efectiva, plantilla, presets, íconos y paletas
#'
#' Se calcula una sola vez por pedido (un lote de 60 láminas no resuelve 60 veces las fuentes ni su huella).
#' @keywords internal
.graficos_preview_comun <- function(sid, parsed, fuentes) {
  cfg <- .graficos_effective_config(sid, parsed$config %||% parsed$graficos_config)
  delivery <- .graficos_delivery_options(
    cfg,
    profile_id = parsed$profile_id %||% parsed$profileId,
    template_id = parsed$template_id %||% parsed$templateId
  )
  template_pptx <- .graficos_resolve_template_pptx(config = cfg, profile_id = delivery$profile_id,
                                                   template_id = delivery$template_id)
  list(
    plan_slides = cfg$plan$slides %||% list(),
    scope = if (isTRUE(fuentes$consolidado)) "consolidated" else "active_base",
    base = if (isTRUE(fuentes$consolidado)) "" else .graficos_active_base_name(sid),
    data_sources = fuentes$data_sources,
    inst_sources = fuentes$inst_sources,
    huella_fuentes = .mini_huella_fuentes(fuentes$data_sources, fuentes$inst_sources),
    huella_estandar = .mini_huella_estandar(),
    version_paquete = .mini_version_paquete(),
    opciones_motor = .mini_opciones_motor(),
    # Presets con canvas + guías globales: la vista previa del editor sí dibuja las guías (D17 rige el entregable).
    presets_json = .enriquecer_presets(cfg$presets %||% list(), cfg$debug_ph),
    paletas = cfg$paletas %||% list(),
    icon_registry = .graficos_icon_registry(sid, cfg),
    template_pptx = template_pptx,
    template_id = delivery$template_id,
    profile_id = delivery$profile_id,
    auto_otros_slides = delivery$auto_otros_slides
  )
}

#' Contexto de una lámina dentro de un pedido: antetítulo heredado, folio real y refs calificadas con la base activa
#' @keywords internal
.graficos_preview_lamina_ctx <- function(comun, slide, folio_pedido = NULL) {
  # El mini-plan no tiene el separador vigente: sin esto la lámina salía sin antetítulo (F6.0b.2, inventario parte C).
  slide <- .preview_con_antetitulo(slide, comun$plan_slides)
  # K2: el folio real de la lámina en el plan (o el que mande el cliente); el mini-plan la numeraba «1».
  folio <- .preview_folio(comun$plan_slides, slide$id, folio_pedido)
  slide <- .graficos_calificar_refs_plan(list(slides = list(slide)), comun$base)$slides[[1]]
  .mini_contexto(
    slide = slide, folio = folio, scope = comun$scope, base = comun$base,
    data_sources = comun$data_sources, inst_sources = comun$inst_sources,
    presets_json = comun$presets_json, paletas = comun$paletas, icon_registry = comun$icon_registry,
    template_pptx = comun$template_pptx, template_id = comun$template_id, profile_id = comun$profile_id,
    auto_otros_slides = comun$auto_otros_slides, opciones_motor = comun$opciones_motor,
    huella_fuentes = comun$huella_fuentes, huella_estandar = comun$huella_estandar,
    version_paquete = comun$version_paquete
  )
}

# ---- Motor: el mini-PPTX de una lámina --------------------------------------------------------------------------------

#' ¿Un argumento vacío (NULL, largo 0, lista de un NULL, NA escalar)?
#' @keywords internal
.mini_vacio <- function(v) {
  is.null(v) ||
    length(v) == 0L ||
    (length(v) == 1L && is.list(v) && is.null(v[[1]])) ||
    (length(v) == 1L && is.atomic(v) && is.na(v))
}

#' Reconstruye la lámina del editor como objeto del DSL (`p_slide_*`), contando los gráficos que quedaron vacíos
#'
#' Es el rebuild que vivía inline en `/preview-slide` (promueve el título del gráfico a `overrides$titulo`), movido aquí
#' sin cambios para que el worker lo use igual. `conteo` (environment) acumula `pedidos` y `vacios`: una lámina cuyos
#' gráficos pedidos salieron todos vacíos es `sin_datos`.
#' @keywords internal
.mini_rebuild_slide <- function(s0, icon_registry = list(), conteo = NULL) {
  slide_registry <- stats::setNames(
    lapply(.slide_names(), function(nm) list(grafs = setdiff(.slide_slots(nm), "icono"))),
    .slide_names()
  )
  graficador_registry <- .graf_names()
  as_list_shallow <- function(x) {
    if (is.null(x)) return(NULL)
    if (is.list(x)) return(x)
    as.list(x)
  }
  contar <- function(campo) if (is.environment(conteo)) conteo[[campo]] <- (conteo[[campo]] %||% 0L) + 1L
  promote_graph_title <- function(args, fn) {
    args <- .graficos_normalize_rebuild_aliases(args, fn)
    if (!("titulo" %in% names(args)) || !("overrides" %in% names(formals(fn)))) return(args)
    title_value <- args$titulo
    has_title <- !(.mini_vacio(title_value) ||
                     (length(title_value) == 1L && is.character(title_value) && !nzchar(trimws(title_value))))
    if (!isTRUE(has_title)) return(args)
    overrides <- as_list_shallow(args$overrides) %||% list()
    override_title <- overrides$titulo %||% NULL
    has_override_title <- !(.mini_vacio(override_title) ||
                              (length(override_title) == 1L && is.character(override_title) &&
                                 !nzchar(trimws(override_title))))
    if (!isTRUE(has_override_title)) overrides$titulo <- as.character(title_value)[1]
    args$overrides <- overrides
    args$titulo <- NULL
    args
  }
  rebuild_graf <- function(g) {
    if (is.null(g)) return(NULL)
    # NA = lamina borrador rectangularizada (nzchar(NA) es TRUE): sin este
    # guard el export completo moria con "Graficador no registrado: NA".
    graf_ref <- as.character(g$graficador %||% NA_character_)[1]
    if (is.na(graf_ref) || !nzchar(trimws(graf_ref))) return(NULL)
    contar("pedidos")
    graficador_name <- .graficos_resolve_graficador_name(g$graficador, graficador_registry)
    if (!(graficador_name %in% graficador_registry)) stop(sprintf("Graficador no registrado: %s", g$graficador))
    fn <- getExportedValue("prosecnurapp", graficador_name)
    args <- .graficos_unwrap_scalar_refs(g$args %||% list())
    args <- .graficos_drop_blank_optional_refs(args)
    if (.graficos_args_missing_required_ref(args, graficador_name)) {
      contar("vacios")
      return(.graficos_blank_graph_element())
    }
    args <- promote_graph_title(args, fn)
    args <- args[names(args) %in% names(formals(fn))]
    args <- args[!vapply(args, .mini_vacio, logical(1))]
    if (.graficos_args_faltan_requeridos(fn, args)) {
      contar("vacios")
      return(.graficos_blank_graph_element())
    }
    do.call(fn, args)
  }
  s0 <- as.list(s0)
  tipo0 <- as.character(s0$tipo %||% "")
  if (!nzchar(tipo0) || !(tipo0 %in% names(slide_registry))) stop(sprintf("Tipo de slide inválido: %s", tipo0))
  payload <- as_list_shallow(s0$payload) %||% list()
  payload <- lapply(payload, function(v) if (is.list(v) && length(v) == 1 && is.null(names(v))) v[[1]] else v)
  for (slot_name in slide_registry[[tipo0]]$grafs) {
    if (!is.null(payload[[slot_name]])) payload[[slot_name]] <- rebuild_graf(as_list_shallow(payload[[slot_name]]))
  }
  fn <- getExportedValue("prosecnurapp", tipo0)
  payload <- .graficos_normalize_payload_icon(payload, fn, tipo0, icon_registry = icon_registry)
  payload <- .graficos_payload_con_meta(payload)
  payload <- payload[names(payload) %in% names(formals(fn))]
  payload <- payload[!vapply(payload, .mini_vacio, logical(1))]
  payload <- .graficos_fill_blank_graf_slots(payload, fn, slide_registry[[tipo0]]$grafs)
  do.call(fn, payload)
}

#' Arma el mini-PPTX de una lámina con el motor del export
#'
#' @return `list(avisos, graficos_pedidos, graficos_vacios)`. Los `[PULSO-AVISO]` del motor vuelven con la vista previa en
#'   vez de perderse en stderr (F6.0b.1).
#' @keywords internal
.mini_render_pptx <- function(ctx, out_path) {
  presets <- if (length(ctx$presets_json)) .build_presets(ctx$presets_json) else NULL
  palette_env <- .graficos_palette_env(ctx$paletas %||% list(), parent = environment())
  conteo <- new.env(parent = emptyenv())
  slide_r <- .mini_rebuild_slide(ctx$slide, icon_registry = ctx$icon_registry, conteo = conteo)
  # Un gráfico que el motor degrada al canvas «Sin datos» (variable que no está en la base, filtro sin casos) avisa con
  # un `[PULSO-AVISO]` por gráfico; se cuentan aquí, antes de que `.preview_con_avisos` los deduplique.
  degradados <- 0L
  r <- .preview_con_avisos(.preview_con_folio(withCallingHandlers(reporte_ppt_plan(
    data = ctx$data_sources,
    instrumento = ctx$inst_sources,
    path_ppt = out_path,
    presets = presets,
    plan = do.call(p_plan, list(slides = list(slide_r))),
    env_diapos = palette_env,
    template_pptx = ctx$template_pptx,
    template_id = ctx$template_id,
    auto_otros_slides = ctx$auto_otros_slides,
    mensajes_progreso = FALSE
  ), message = function(m) {
    texto <- conditionMessage(m)
    if (grepl(.PULSO_AVISO_SELLO, texto, fixed = TRUE) && grepl("canvas 'Sin datos'", texto, fixed = TRUE)) {
      degradados <<- degradados + 1L
    }
  }), ctx$folio))
  list(avisos = r$avisos, graficos_pedidos = conteo$pedidos %||% 0L,
       graficos_vacios = (conteo$vacios %||% 0L) + degradados)
}

# ---- Caché en disco -------------------------------------------------------------------------------------------------

#' Raíz de la caché de miniaturas de una sesión (`<tempdir>/prosecnur/<sid>/cache/miniaturas`)
#' @keywords internal
.mini_cache_raiz <- function(sid) {
  s <- session_get(sid)
  raiz <- file.path(s$dir, "cache", "miniaturas")
  dir.create(raiz, recursive = TRUE, showWarnings = FALSE)
  raiz
}

#' Escribe `path` de forma atómica: `escribir(tmp)` y luego rename (un lector concurrente o un job cancelado nunca dejan
#' una entrada a medias)
#' @keywords internal
.mini_escribir_atomico <- function(path, escribir) {
  tmp <- paste0(path, ".tmp-", Sys.getpid(), "-", paste(sample(c(letters, 0:9), 8, TRUE), collapse = ""))
  on.exit(if (file.exists(tmp)) unlink(tmp, force = TRUE), add = TRUE)
  escribir(tmp)
  if (!file.exists(tmp)) return(invisible(FALSE))
  ok <- file.rename(tmp, path)
  if (!isTRUE(ok)) ok <- file.copy(tmp, path, overwrite = TRUE)
  invisible(isTRUE(ok))
}

#' Rutas de una entrada de caché
#' @keywords internal
.mini_entrada <- function(raiz, hash) {
  dir <- file.path(raiz, hash)
  list(dir = dir, pptx = file.path(dir, sprintf("preview_%s.pptx", hash)), meta = file.path(dir, "meta.rds"))
}

#' Metadatos de una entrada si su PPTX y su meta existen; `NULL` si no
#' @keywords internal
.mini_entrada_leer <- function(raiz, hash) {
  e <- .mini_entrada(raiz, hash)
  if (!file.exists(e$pptx) || !file.exists(e$meta)) return(NULL)
  meta <- tryCatch(readRDS(e$meta), error = function(err) NULL)
  if (!is.list(meta) || !identical(meta$hash, hash)) return(NULL)
  meta
}

#' Id del renderer con que se rasteriza (la llave del raster: otro renderer, otros píxeles)
#' @keywords internal
.mini_renderer_id <- function() {
  st <- tryCatch(.preview_renderer_status(), error = function(e) list(available = FALSE))
  if (!isTRUE(st$available)) return(NA_character_)
  gsub("[^A-Za-z0-9_-]", "-", paste(st$renderer %||% "x", st$rasterizer %||% "x", sep = "_"))
}

#' Asegura el mini-PPTX de la entrada (render si falta)
#' @return `list(meta, cache = "hit"|"miss")`.
#' @keywords internal
.mini_asegurar_pptx <- function(ctx, raiz) {
  meta <- .mini_entrada_leer(raiz, ctx$hash)
  if (!is.null(meta)) return(list(meta = meta, cache = "hit"))
  e <- .mini_entrada(raiz, ctx$hash)
  dir.create(e$dir, recursive = TRUE, showWarnings = FALSE)
  out <- NULL
  .mini_escribir_atomico(e$pptx, function(tmp) {
    tmp_pptx <- paste0(tmp, ".pptx")
    on.exit(unlink(tmp_pptx, force = TRUE), add = TRUE)
    out <<- .mini_render_pptx(ctx, tmp_pptx)
    file.rename(tmp_pptx, tmp)
  })
  if (!file.exists(e$pptx)) stop("El motor no escribió el mini-PPTX de la vista previa.", call. = FALSE)
  partes <- .preview_partes(e$pptx)
  meta <- list(
    hash = ctx$hash, slide_id = ctx$slide_id, tipo = ctx$tipo, folio = ctx$folio,
    avisos = out$avisos %||% character(0), partes = partes,
    graficos_pedidos = out$graficos_pedidos, graficos_vacios = out$graficos_vacios,
    sha256_pptx = .mini_sha256_archivo(e$pptx),
    creado = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  )
  .mini_escribir_atomico(e$meta, function(tmp) saveRDS(meta, tmp, version = 3))
  list(meta = meta, cache = "miss")
}

#' Raster de las partes de una entrada, compartido entre la vista previa y la miniatura
#'
#' Llave: calidad, número máximo de partes y renderer. Una miniatura (1 parte) reutiliza el raster de 6 partes que ya armó
#' la vista previa de la lámina activa. Un raster incompleto (renderer caído, timeout) no se guarda: se reintenta.
#' @return `list(slide_previews, cache = "hit"|"miss"|"sin_renderer")`; `slide_previews` lleva el atributo `truncado`.
#' @keywords internal
.mini_asegurar_raster <- function(raiz, hash, meta, quality = "quick", max_partes = 1L, renderer_id = .mini_renderer_id()) {
  vacio <- structure(list(), truncado = FALSE)
  if (is.na(renderer_id)) return(list(slide_previews = vacio, cache = "sin_renderer"))
  e <- .mini_entrada(raiz, hash)
  ruta <- function(m) file.path(e$dir, sprintf("raster_%s_%d_%s.rds", quality, as.integer(m), renderer_id))
  n_partes <- as.integer(meta$partes$n %||% 1L)
  candidatos <- if (as.integer(max_partes) == 1L) c(1L, 6L) else as.integer(max_partes)
  for (m in candidatos) {
    p <- ruta(m)
    if (!file.exists(p)) next
    sp <- tryCatch(readRDS(p), error = function(err) NULL)
    if (!is.list(sp) || !length(sp)) next
    if (m != as.integer(max_partes)) {
      truncado <- n_partes > as.integer(max_partes)
      sp <- sp[seq_len(min(length(sp), as.integer(max_partes)))]
      attr(sp, "truncado") <- truncado
    }
    return(list(slide_previews = sp, cache = "hit"))
  }
  sp <- .render_pptx_preview_partes(e$pptx, n_partes, preview_quality = quality, max_partes = as.integer(max_partes))
  completo <- length(sp) > 0L && !any(vapply(sp, is.null, logical(1)))
  if (isTRUE(completo)) .mini_escribir_atomico(ruta(max_partes), function(tmp) saveRDS(sp, tmp, version = 3))
  list(slide_previews = sp, cache = "miss")
}

#' PNG de la miniatura (parte 1) escrito junto a la entrada; decodifica el raster, así sus bytes son los del raster
#' @return Ruta del PNG o `NA` si no hay raster.
#' @keywords internal
.mini_miniatura_png <- function(raiz, hash, slide_previews, quality = "quick", renderer_id = .mini_renderer_id()) {
  if (is.na(renderer_id) || !length(slide_previews) || is.null(slide_previews[[1]])) return(NA_character_)
  e <- .mini_entrada(raiz, hash)
  png <- file.path(e$dir, sprintf("miniatura_%s_%s.png", quality, renderer_id))
  if (file.exists(png)) return(png)
  b64 <- sub("^data:image/png;base64,", "", slide_previews[[1]]$png_base64 %||% "")
  if (!nzchar(b64)) return(NA_character_)
  .mini_escribir_atomico(png, function(tmp) writeBin(jsonlite::base64_dec(b64), tmp))
  if (file.exists(png)) png else NA_character_
}

#' Resuelve una lámina contra la caché: PPTX y, si se pidió, raster
#'
#' Es lo que llaman el endpoint síncrono y el worker. Con la entrada ya en caché no toca el motor.
#' @param opts `list(preview_quality, render_slide_preview, preview_partes)`.
#' @keywords internal
.mini_resolver <- function(ctx, raiz, opts) {
  pptx <- .mini_asegurar_pptx(ctx, raiz)
  # La poda va por mtime del directorio: tocarlo en cada uso la vuelve LRU.
  try(Sys.setFileTime(.mini_entrada(raiz, ctx$hash)$dir, Sys.time()), silent = TRUE)  # best effort: sin mtime sólo poda antes
  raster <- if (isTRUE(opts$render_slide_preview)) {
    .mini_asegurar_raster(raiz, ctx$hash, pptx$meta, quality = opts$preview_quality %||% "quick",
                          max_partes = if (isTRUE(opts$preview_partes)) 6L else 1L)
  } else {
    list(slide_previews = structure(list(), truncado = FALSE), cache = "no_pedido")
  }
  list(hash = ctx$hash, pptx = .mini_entrada(raiz, ctx$hash)$pptx, meta = pptx$meta,
       slide_previews = raster$slide_previews, cache = list(pptx = pptx$cache, raster = raster$cache))
}

#' Poda la caché a las `max` entradas usadas más recientemente
#' @keywords internal
.mini_cache_podar <- function(raiz, max = 400L) {
  dirs <- list.dirs(raiz, full.names = TRUE, recursive = FALSE)
  if (length(dirs) <= max) return(invisible(0L))
  mt <- file.info(dirs)$mtime
  viejas <- dirs[order(mt, decreasing = TRUE)][-seq_len(max)]
  unlink(viejas, recursive = TRUE, force = TRUE)
  invisible(length(viejas))
}

# ---- Artefactos registrados (file store de la sesión) ------------------------------------------------------------------

#' Registra un archivo de la caché en el file store, reutilizando el `file_id` si la misma llave ya se registró
#'
#' El índice llave → file_id vive en `graficos_preview_cache` (caché runtime, strippeada al guardar el .pulso): pedir dos
#' veces la misma lámina devuelve el mismo `file_id`, como hasta hoy.
#' @keywords internal
.mini_registrar <- function(sid, clave, path, kind, original_name = NULL) {
  indice <- session_get(sid)$graficos_preview_cache %||% list()
  if (!is.list(indice)) indice <- list()
  previo <- indice[[clave]]
  if (is.list(previo) && is.character(previo$file_id)) {
    meta <- tryCatch(get_file(sid, previo$file_id), error = function(e) NULL)
    if (!is.null(meta) && identical(meta$path, path) && file.exists(path)) {
      indice[[clave]]$cached_at <- as.numeric(Sys.time())
      session_set(sid, "graficos_preview_cache", indice)
      return(meta)
    }
  }
  meta <- .register_output_file(sid, kind, path, original_name = original_name)
  indice[[clave]] <- list(file_id = meta$file_id, size = meta$size, cached_at = as.numeric(Sys.time()))
  if (length(indice) > 512L) {
    t <- vapply(indice, function(v) if (is.list(v) && is.numeric(v$cached_at)) v$cached_at else 0, numeric(1))
    indice <- indice[order(t, decreasing = TRUE)][seq_len(512L)]
  }
  session_set(sid, "graficos_preview_cache", indice)
  meta
}

#' Respuesta de `/preview-slide` (misma forma de siempre, más `hash` y `cache`)
#' @param r Resultado de `.mini_resolver()`.
#' @param opts Opciones del pedido (`include_images`, `render_slide_preview`, `preview_formas`…).
#' @keywords internal
.graficos_preview_respuesta <- function(sid, r, opts, tipo, folio) {
  meta_file <- .mini_registrar(sid, r$hash, r$pptx, "graficos_preview",
                               original_name = .export_filename(sid, "graficos_preview", "pptx"))
  slide_previews <- r$slide_previews
  partes <- r$meta$partes
  partes$truncado <- isTRUE(attr(slide_previews, "truncado"))
  slide_preview <- if (length(slide_previews) && !is.null(slide_previews[[1]])) {
    slide_previews[[1]][setdiff(names(slide_previews[[1]]), "indice")]
  } else {
    NULL
  }
  attr(slide_previews, "truncado") <- NULL
  .preview_con_formas(list(
    ok = TRUE,
    file_id = meta_file$file_id,
    size = meta_file$size,
    type = "pptx",
    images = if (isTRUE(opts$include_images)) .extract_pptx_images(r$pptx) else list(),
    slide_preview = slide_preview %||% NA,
    partes = partes,
    slide_previews = slide_previews,
    avisos = r$meta$avisos %||% character(0),
    folio = folio,
    hash = r$hash,
    cache = r$cache
  ), r$pptx, tipo, isTRUE(opts$preview_formas))
}

#' Vista previa síncrona de una lámina (lo que corre `/preview-slide`)
#' @keywords internal
.graficos_preview_sincrona <- function(sid, parsed, fuentes, opts) {
  force(opts)  # validado ANTES del render: un E_BAD_* no puede volverse E_PREVIEW_FAILED dentro del tryCatch
  comun <- .graficos_preview_comun(sid, parsed, fuentes)
  ctx <- .graficos_preview_lamina_ctx(comun, parsed$slide, parsed$folio)
  raiz <- .mini_cache_raiz(sid)
  r <- tryCatch(.mini_resolver(ctx, raiz, opts), error = function(e) {
    stop_api(400, "E_PREVIEW_FAILED",
             sprintf("No se pudo generar el preview: %s", .graficos_base_error(sid, conditionMessage(e))))
  })
  .mini_cache_podar(raiz)
  .graficos_preview_respuesta(sid, r, opts, ctx$tipo, ctx$folio)
}

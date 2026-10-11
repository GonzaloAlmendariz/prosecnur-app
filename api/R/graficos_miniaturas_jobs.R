# graficos_miniaturas_jobs.R — jobs `callr` de la vista previa: miniaturas en lote y vista previa asíncrona de una lámina.
# Contrato: docs/qa/contrato-miniaturas-preview-f6-2026-10-11.md. Motor y caché: graficos_miniaturas.R.
#
# Las dos trampas de jobs-asincronos:
#   1. Namespace: el worker NO recibe un closure del paquete (su environment `namespace:prosecnurapp` obligaría a
#      deserializarlo contra el paquete INSTALADO, que puede estar viejo o no estar). Recibe un thunk con environment
#      global que, ya hecho el bootstrap de `job_submit()` (load_all en dev, library en prod), busca el worker por nombre
#      en el namespace recién cargado. Los args son rutas y listas planas.
#   2. Locale: el bootstrap de `job_submit()` fija UTF-8 antes de cargar el paquete; aquí no se toca.
# Payload grande (las fuentes) por RDS, una vez por huella de fuentes: 60 láminas no escriben 60 copias de la base.

.mini_lotes <- new.env(parent = emptyenv())

#' Thunk del job: resuelve el worker en el namespace fresco del subproceso
#' @keywords internal
.mini_job_thunk <- function() {
  f <- function(entrada_path, progress_path = NULL) {
    worker <- get(".graficos_miniaturas_worker", envir = asNamespace("prosecnurapp"), inherits = FALSE)
    worker(entrada_path = entrada_path, progress_path = progress_path)
  }
  environment(f) <- globalenv()
  f
}

#' Resultado de una lámina del lote (lo que el worker escribe por lámina)
#'
#' Estados: `ok` (miniatura PNG lista), `sin_imagen` (PPTX y partes listos, sin renderer o raster fallido),
#' `sin_datos` (el motor armó la lámina pero todos los gráficos pedidos quedaron vacíos), `error` (el motor falló).
#' @keywords internal
.mini_lote_item <- function(ctx, raiz, opts, con_previews = FALSE) {
  base <- list(slide_id = ctx$slide_id, hash = ctx$hash, tipo = ctx$tipo, folio = ctx$folio)
  if (!nzchar(ctx$tipo %||% "") || !(ctx$tipo %in% .slide_names())) {
    return(c(base, list(estado = "error", error = list(code = "E_MINIATURA_TIPO_INVALIDO",
                                                       message = sprintf("Tipo de lámina inválido: '%s'", ctx$tipo %||% "")))))
  }
  r <- tryCatch(.mini_resolver(ctx, raiz, opts), error = function(e) e)
  if (inherits(r, "error")) {
    return(c(base, list(estado = "error", error = list(code = "E_MINIATURA_FALLIDA", message = conditionMessage(r)))))
  }
  q <- opts$preview_quality %||% "quick"
  png <- if (isTRUE(opts$render_slide_preview)) .mini_miniatura_png(raiz, ctx$hash, r$slide_previews, quality = q) else NA_character_
  pedidos <- as.integer(r$meta$graficos_pedidos %||% 0L)
  vacios <- as.integer(r$meta$graficos_vacios %||% 0L)
  estado <- if (pedidos > 0L && vacios >= pedidos) "sin_datos" else if (!is.na(png)) "ok" else "sin_imagen"
  out <- c(base, list(estado = estado, cache = r$cache, png = png, pptx = r$pptx))
  if (isTRUE(con_previews)) out$slide_previews <- r$slide_previews
  out
}

#' ¿La lámina ya está entera en la caché (PPTX y, si se pide raster, raster)? No renderiza nada.
#' @keywords internal
.mini_en_cache <- function(ctx, raiz, opts) {
  meta <- .mini_entrada_leer(raiz, ctx$hash)
  if (is.null(meta)) return(FALSE)
  if (!isTRUE(opts$render_slide_preview)) return(TRUE)
  rid <- .mini_renderer_id()
  # Sin renderer no hay raster que servir: un raster ausente no se cachea y se reintenta (contrato §4,
  # docs/qa/contrato-miniaturas-preview-f6-2026-10-11.md). El reintento vuelve a hit en el PPTX; sólo falta la imagen.
  if (is.na(rid)) return(FALSE)
  e <- .mini_entrada(raiz, ctx$hash)
  m <- if (isTRUE(opts$preview_partes)) 6L else c(1L, 6L)
  any(file.exists(file.path(e$dir, sprintf("raster_%s_%d_%s.rds", opts$preview_quality %||% "quick", m, rid))))
}

#' Worker del job (corre en el subproceso `callr`)
#'
#' Lee la entrada por RDS, fija las opciones `prosecnur.*` del proceso padre (son parte de la huella) y resuelve cada
#' lámina contra la caché compartida, escribiendo su resultado apenas termina para que el lote se pueda consultar a medias.
#' @keywords internal
.graficos_miniaturas_worker <- function(entrada_path, progress_path = NULL) {
  entrada <- readRDS(entrada_path)
  fuentes <- readRDS(entrada$fuentes_path)
  if (length(entrada$opciones_motor)) options(entrada$opciones_motor)
  progreso <- job_progress_writer(progress_path)
  n <- length(entrada$laminas)
  items <- vector("list", n)
  for (k in seq_len(n)) {
    ctx <- entrada$laminas[[k]]
    ctx$data_sources <- fuentes$data_sources
    ctx$inst_sources <- fuentes$inst_sources
    progreso("running", current = k - 1L, total = n, message = sprintf("Lámina %s (%d de %d)", ctx$slide_id, k, n))
    item <- .mini_lote_item(ctx, entrada$raiz, entrada$opts, con_previews = identical(entrada$modo, "preview"))
    item$orden <- entrada$ordenes[[k]]
    .mini_escribir_atomico(file.path(entrada$lote_dir, sprintf("item_%04d.rds", item$orden)),
                           function(tmp) saveRDS(item[setdiff(names(item), "slide_previews")], tmp, version = 3))
    items[[k]] <- item
  }
  progreso("done", current = n, total = n, percent = 100, message = "Láminas listas.")
  list(lote_id = entrada$lote_id, items = items)
}

#' Fuentes del lote en RDS, reutilizadas por huella
#' @keywords internal
.mini_fuentes_rds <- function(sid, ctx0) {
  s <- session_get(sid)
  dir <- file.path(s$dir, "jobs", "inputs")
  dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  llave <- .mini_digest(list(ctx0$huella_fuentes, ctx0$bases), algo = "xxhash64")
  path <- file.path(dir, sprintf("miniaturas_fuentes_%s.rds", llave))
  if (!file.exists(path)) {
    .mini_escribir_atomico(path, function(tmp) {
      saveRDS(list(data_sources = ctx0$data_sources, inst_sources = ctx0$inst_sources), tmp, version = 3)
    })
  }
  path
}

#' Ancho y alto de un PNG leídos de su cabecera IHDR (decodificar 67 PNG con `png::readPNG` costaba 18 s medidos)
#' @keywords internal
.mini_png_dims <- function(path) {
  b <- tryCatch(readBin(path, "raw", 24L), error = function(e) raw(0))
  if (length(b) < 24L || !identical(b[13:16], charToRaw("IHDR"))) return(c(width = NA_integer_, height = NA_integer_))
  entero <- function(x) sum(as.numeric(x) * 256^(3:0))
  c(width = as.integer(entero(b[17:20])), height = as.integer(entero(b[21:24])))
}

#' Miniatura publicada de una lámina: PNG registrado en el file store (servido por `/api/files/<id>/download`)
#' @keywords internal
.mini_item_publico <- function(sid, raiz, item) {
  meta <- if (!identical(item$estado, "error")) .mini_entrada_leer(raiz, item$hash) else NULL
  miniatura <- NA
  png <- item$png %||% NA_character_
  if (!is.na(png) && file.exists(png)) {
    f <- .mini_registrar(sid, paste0(item$hash, ":", basename(png)), png, "graficos_miniatura",
                         original_name = sprintf("miniatura_%s.png", .export_slug(item$slide_id %||% "lamina", fallback = "lamina")))
    dims <- .mini_png_dims(png)
    miniatura <- list(
      file_id = f$file_id,
      url = sprintf("/api/files/%s/download", f$file_id),
      mime = "image/png",
      width = dims[["width"]],
      height = dims[["height"]],
      sha256 = .mini_sha256_archivo(png)
    )
  }
  list(
    slide_id = item$slide_id,
    orden = as.integer(item$orden %||% NA_integer_),
    hash = item$hash,
    estado = item$estado,
    cache = item$cache %||% NA,
    folio = as.integer(item$folio %||% NA_integer_),
    partes = if (is.list(meta)) meta$partes else list(n = 0L, partes = list()),
    avisos = if (is.list(meta)) meta$avisos %||% character(0) else character(0),
    graficos = .mini_graficos_publico(meta),
    miniatura = miniatura,
    error = item$error %||% NA
  )
}

#' Campo aditivo `graficos` de una lámina: cuántos gráficos pidió, cuántos quedaron vacíos y por qué
#' @return `list(pedidos, vacios, motivo)`; `motivo` es un arreglo con «borrador_incompleto», «variable_fuera_de_base»,
#'   «n0» y/o «degradado» (vacío si todos dibujan). `NA` si no hay meta (lámina pendiente o con error).
#' @keywords internal
.mini_graficos_publico <- function(meta) {
  if (!is.list(meta)) return(NA)
  list(pedidos = as.integer(meta$graficos_pedidos %||% 0L), vacios = as.integer(meta$graficos_vacios %||% 0L),
       motivo = I(as.character(meta$graficos_motivos %||% character(0))))
}

#' Estado público de un lote: una entrada por lámina pedida, en el orden del pedido
#' @param status Estado del job si quien llama ya lo sabe (al publicar el resultado); si no, se consulta el job.
#' @keywords internal
.graficos_miniaturas_estado <- function(sid, lote_id, status = NULL) {
  lote <- .mini_lotes[[lote_id]]
  if (is.null(lote) || !identical(lote$sid, sid)) {
    stop_api(404, "E_MINIATURAS_LOTE_NO_EXISTE", sprintf("No existe el lote de miniaturas '%s' en esta sesión.", lote_id))
  }
  if (is.null(status)) {
    j <- tryCatch(job_poll(lote$job_id), error = function(e) NULL)
    status <- if (is.null(j)) "error" else j$status
  }
  laminas <- lapply(seq_along(lote$laminas), function(k) {
    p <- file.path(lote$dir, sprintf("item_%04d.rds", k))
    item <- if (file.exists(p)) tryCatch(readRDS(p), error = function(e) NULL) else NULL
    if (is.null(item)) {
      return(list(slide_id = lote$laminas[[k]]$slide_id, orden = k, hash = lote$laminas[[k]]$hash,
                  estado = "pendiente", cache = NA, folio = lote$laminas[[k]]$folio,
                  partes = list(n = 0L, partes = list()), avisos = character(0), graficos = NA, miniatura = NA, error = NA))
    }
    .mini_item_publico(sid, lote$raiz, item)
  })
  estados <- vapply(laminas, function(x) x$estado, character(1))
  cuenta <- function(e) sum(estados == e)
  list(
    ok = TRUE,
    lote_id = lote_id,
    job_id = lote$job_id,
    status = status,
    total = length(laminas),
    conteo = list(ok = cuenta("ok"), sin_datos = cuenta("sin_datos"), sin_imagen = cuenta("sin_imagen"),
                  error = cuenta("error"), pendiente = cuenta("pendiente")),
    laminas = laminas
  )
}

#' Cancela los jobs vivos de la sesión que el pedido nuevo reemplaza (misma sesión y modo; en preview, misma lámina)
#' @keywords internal
.mini_cancelar_previos <- function(sid, modo, slide_id = NULL) {
  for (id in ls(.mini_lotes)) {
    l <- .mini_lotes[[id]]
    if (!identical(l$sid, sid) || !identical(l$modo, modo)) next
    if (identical(modo, "preview") && !identical(l$slide_id, slide_id)) next
    j <- tryCatch(job_get(l$job_id), error = function(e) NULL)
    if (!is.null(j) && identical(j$status, "running")) job_cancel(l$job_id)
  }
  invisible(NULL)
}

#' Lanza el job de un lote (o de una vista previa) sobre contextos ya resueltos
#'
#' Las láminas que ya están enteras en la caché no viajan al worker: su resultado se escribe en el lote al instante. Si
#' todas están, el job nace terminado (`job_submit_completed`) y el polling corta en la primera consulta.
#' @param ctxs Lista de contextos (`.graficos_preview_lamina_ctx()`).
#' @param modo «lote» (`graficos.miniaturas`) o «preview» (`graficos.preview_slide`).
#' @param publicar `function(sid, lote_id, items)` que arma `result_data` al terminar (en el proceso principal).
#' @return `list(job_id, lote_id, kind, total, en_cache, pendientes)`.
#' @keywords internal
.graficos_miniaturas_lanzar <- function(sid, ctxs, opts, modo = "lote", publicar, reemplazar = TRUE) {
  s <- session_get(sid)
  raiz <- .mini_cache_raiz(sid)
  kind <- if (identical(modo, "preview")) "graficos.preview_slide" else "graficos.miniaturas"
  lote_id <- uuid::UUIDgenerate()
  lote_dir <- file.path(s$dir, "jobs", paste0("miniaturas_", lote_id))
  dir.create(lote_dir, recursive = TRUE, showWarnings = FALSE)
  slide_id <- if (length(ctxs)) ctxs[[1]]$slide_id else NULL
  if (isTRUE(reemplazar)) .mini_cancelar_previos(sid, modo, slide_id)

  listos <- vapply(ctxs, function(ctx) .mini_en_cache(ctx, raiz, opts), logical(1))
  items_listos <- list()
  for (k in which(listos)) {
    item <- .mini_lote_item(ctxs[[k]], raiz, opts, con_previews = identical(modo, "preview"))
    item$orden <- k
    saveRDS(item[setdiff(names(item), "slide_previews")], file.path(lote_dir, sprintf("item_%04d.rds", k)), version = 3)
    items_listos[[length(items_listos) + 1L]] <- item
  }
  registro <- list(sid = sid, modo = modo, slide_id = slide_id, raiz = raiz, dir = lote_dir, opts = opts,
                   laminas = lapply(ctxs, function(ctx) list(slide_id = ctx$slide_id, hash = ctx$hash, folio = ctx$folio)))
  pendientes <- which(!listos)

  if (!length(pendientes)) {
    registro$job_id <- NA_character_
    .mini_lotes[[lote_id]] <- registro
    job_id <- job_submit_completed(sid, kind, result_data = publicar(sid, lote_id, items_listos))
    .mini_cache_podar(raiz)
  } else {
    sin_fuentes <- function(ctx) ctx[setdiff(names(ctx), c("data_sources", "inst_sources"))]
    entrada <- list(
      lote_id = lote_id, modo = modo, raiz = raiz, lote_dir = lote_dir, opts = opts,
      fuentes_path = .mini_fuentes_rds(sid, ctxs[[pendientes[[1]]]]),
      opciones_motor = ctxs[[pendientes[[1]]]]$opciones_motor,
      laminas = lapply(ctxs[pendientes], sin_fuentes),
      ordenes = as.list(pendientes)
    )
    entrada_path <- job_save_rds(sid, "miniaturas_entrada", entrada)
    job_id <- job_submit(
      sid, kind, .mini_job_thunk(), args = list(entrada_path = entrada_path),
      on_complete = function(j) {
        items <- c(items_listos, (j$result_data %||% list())$items %||% list())
        out <- publicar(sid, lote_id, items)
        .mini_cache_podar(raiz)
        out
      }
    )
  }
  registro$job_id <- job_id
  .mini_lotes[[lote_id]] <- registro
  list(ok = TRUE, job_id = job_id, lote_id = lote_id, kind = kind, total = length(ctxs),
       en_cache = sum(listos), pendientes = length(pendientes))
}

#' Lee y valida el pedido del lote (slides explícitas, `slide_ids` del plan guardado, o todo el plan)
#' @keywords internal
.graficos_miniaturas_pedido <- function(parsed, plan_slides) {
  slides <- parsed$slides
  if (!is.null(slides) && !is.list(slides)) {
    stop_api(400, "E_BAD_MINIATURAS_SLIDES", "'slides' debe ser un arreglo de láminas ({id, tipo, payload}).")
  }
  if (is.null(slides)) {
    ids <- as.character(unlist(parsed$slide_ids %||% list()))
    slides <- plan_slides
    if (length(ids)) {
      plan_ids <- vapply(plan_slides, function(x) as.character(x$id %||% "")[1], character(1))
      slides <- plan_slides[plan_ids %in% ids]
    }
  }
  slides <- Filter(is.list, slides)
  if (!length(slides)) stop_api(400, "E_MINIATURAS_SIN_LAMINAS", "No hay láminas que miniaturizar: manda 'slides' o 'slide_ids', o guarda el plan.")
  if (length(slides) > 200L) stop_api(400, "E_MINIATURAS_DEMASIADAS", sprintf("Un lote admite hasta 200 láminas (llegaron %d).", length(slides)))
  quality <- tolower(as.character(parsed$preview_quality %||% "quick")[1])
  if (!quality %in% c("quick", "normal")) stop_api(400, "E_BAD_MINIATURAS_QUALITY", "preview_quality debe ser 'quick' o 'normal'.")
  reemplazar <- parsed$reemplazar %||% TRUE
  if (!is.logical(reemplazar) || length(reemplazar) != 1L || is.na(reemplazar)) {
    stop_api(400, "E_BAD_MINIATURAS_REEMPLAZAR", "reemplazar debe ser booleano.")
  }
  list(slides = slides, reemplazar = reemplazar,
       opts = list(preview_quality = quality, render_slide_preview = TRUE, preview_partes = FALSE, include_images = FALSE))
}

#' Publica el resultado de un lote
#' @keywords internal
.mini_publicar_lote <- function(sid, lote_id, items) .graficos_miniaturas_estado(sid, lote_id, status = "done")

#' Publicador de la vista previa asíncrona: la misma respuesta de `/preview-slide`, o un error de dominio estructurado
#' @keywords internal
.mini_publicador_preview <- function(opts) {
  force(opts)
  function(sid, lote_id, items) {
    item <- items[[1]] %||% list(estado = "error", error = list(code = "E_PREVIEW_FAILED", message = "Sin resultado."))
    if (identical(item$estado, "error")) {
      msg <- (item$error %||% list())$message %||% "error desconocido"
      return(list(ok = FALSE, error = list(code = "E_PREVIEW_FAILED", status = 400L,
                                           message = sprintf("No se pudo generar el preview: %s", .graficos_base_error(sid, msg)))))
    }
    lote <- .mini_lotes[[lote_id]]
    meta <- .mini_entrada_leer(lote$raiz, item$hash)
    r <- list(hash = item$hash, pptx = .mini_entrada(lote$raiz, item$hash)$pptx, meta = meta,
              slide_previews = item$slide_previews %||% structure(list(), truncado = FALSE), cache = item$cache)
    .graficos_preview_respuesta(sid, r, opts, item$tipo, item$folio)
  }
}

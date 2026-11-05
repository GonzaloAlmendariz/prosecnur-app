# =============================================================================
# graficos_propuesta_job.R — la propuesta del motor por job y con caché por firma
# =============================================================================
#
# La propuesta de los resúmenes (graficos_propuesta_resumen.R) tardaba 6 a 13 s aislada y 25 a 60 s en vivo, síncrona:
# Plumber es mono-hilo y quedaba bloqueado. Aquí:
#
#   - `.propuesta_pedido` resuelve en el proceso principal lo que la propuesta lee (fuentes, plan, regla, preguntas clave)
#     y su FIRMA: lámina + plan + opciones del motor (regla, familia y preguntas clave) + rótulos cortos + base + huella
#     de los datos (los convertidos y los crudos) + íconos + versión del paquete. Cambiar una pregunta clave, un cruce,
#     la regla o los datos cambia la firma.
#   - `.propuesta_resumen_sesion` (endpoints síncronos de siempre) y `.propuesta_resumen_job_lanzar` (job
#     `graficos.propuesta_resumen`) leen y escriben la misma caché en memoria por firma: la segunda llamada con la misma
#     firma no recalcula.
#   - El worker corre `.propuesta_resumen_calcular` con las opciones del motor del pedido y devuelve EXACTAMENTE la
#     respuesta síncrona; un error de dominio vuelve como `{ok: false, error: {code, status, message, details}}` (el
#     patrón de `/preview-slide-job`), y uno inesperado como E_INTERNAL con `error_id`.
#
# Las dos trampas de jobs-asincronos: el worker se resuelve por nombre en el namespace recién cargado (thunk con
# environment global, sin closures del paquete) y el bootstrap UTF-8 lo pone `job_submit()`. Las fuentes viajan por RDS,
# una vez por huella.

.propuesta_estado <- new.env(parent = emptyenv())

#' Tope de entradas de la caché de propuestas (por proceso)
#' @keywords internal
.PROPUESTA_CACHE_MAX <- 32L

#' Versión manual de la caché de propuestas: subirla invalida todas las entradas
#' @keywords internal
.PROPUESTA_VERSION_CACHE <- "1"

#' Lo que lee la propuesta de una lámina de la sesión, y su firma
#'
#' @param slide_id Id de la lámina en el plan guardado (GET), o NULL si la lámina viene en `parsed$slide` (POST).
#' @param parsed Pedido de la vista previa: `slide` (lámina sin guardar), `config` (plan sin guardar) y `scope`.
#' @return `list(args, data_sources, inst_sources, crudas, opciones_motor, huellas, firma)`; `args` son los argumentos
#'   de `.propuesta_resumen_calcular` sin las fuentes.
#' @keywords internal
.propuesta_pedido <- function(sid, slide_id = NULL, parsed = list()) {
  fuentes <- .graficos_preview_fuentes(sid, parsed)
  comun <- .graficos_preview_comun(sid, parsed, fuentes)
  plan_slides <- comun$plan_slides
  slide <- parsed[["slide"]]   # `[[`: `$slide` casaría por prefijo con otro campo
  if (is.null(slide)) {
    slide <- .propuesta_slide_por_id(plan_slides, slide_id)
    if (is.null(slide)) stop_api(404, "E_PROPUESTA_SIN_LAMINA", sprintf("No existe la lámina «%s» en el plan.", slide_id))
  } else {
    # La lámina sin guardar reemplaza a la guardada: sus textos y cruces son los que se están editando.
    id <- as.character(slide$id %||% "")[1]
    plan_slides <- lapply(plan_slides, function(s) if (identical(as.character(s$id %||% "")[1], id)) slide else s)
  }
  # La regla del estudio y las preguntas clave de la config efectiva (la sin guardar, si viene): graficos_preguntas_clave.R
  args <- list(slide = slide, plan_slides = plan_slides, sig_informe = comun$opciones_motor[["prosecnur.sig_informe"]],
               mapa = comun$rotulos_cortos_mapa %||% character(0), inclusivo = isTRUE(comun$inclusivo), base = comun$base,
               icon_registry = comun$icon_registry)
  crudas <- list(data_sources = fuentes$data_sources, inst_sources = fuentes$inst_sources)
  huellas <- list(convertidas = comun$huella_fuentes, crudas = .mini_huella_fuentes(crudas$data_sources, crudas$inst_sources))
  firma <- .mini_digest(list(version = .PROPUESTA_VERSION_CACHE, paquete = comun$version_paquete, sid = sid,
                             args = args, opciones_motor = comun$opciones_motor, huellas = huellas), algo = "xxhash64")
  list(args = args, data_sources = comun$data_sources, inst_sources = comun$inst_sources, crudas = crudas,
       opciones_motor = comun$opciones_motor, huellas = huellas, firma = firma)
}

#' Calcula la propuesta de un pedido ya resuelto (en el proceso que llama)
#' @keywords internal
.propuesta_calcular_pedido <- function(pedido) {
  do.call(.propuesta_resumen_calcular, c(pedido$args, list(data_sources = pedido$data_sources, inst_sources = pedido$inst_sources,
                                                          crudas = pedido$crudas)))
}

# ---- Caché por firma ---------------------------------------------------------------------------------------------------

#' Propuesta guardada para una firma, o NULL
#' @keywords internal
.propuesta_cache_leer <- function(firma) {
  e <- .propuesta_estado$cache %||% list()
  if (is.null(e[[firma]])) return(NULL)
  # La más reciente al final: el recorte saca las más viejas.
  v <- e[[firma]]
  e[[firma]] <- NULL
  e[[firma]] <- v
  .propuesta_estado$cache <- e
  v
}

#' Guarda una propuesta lograda (`ok = TRUE`) bajo su firma; los errores no se guardan
#' @keywords internal
.propuesta_cache_guardar <- function(firma, valor) {
  if (!is.list(valor) || !isTRUE(valor$ok)) return(invisible(FALSE))
  e <- .propuesta_estado$cache %||% list()
  e[[firma]] <- NULL
  e[[firma]] <- valor
  if (length(e) > .PROPUESTA_CACHE_MAX) e <- utils::tail(e, .PROPUESTA_CACHE_MAX)
  .propuesta_estado$cache <- e
  invisible(TRUE)
}

#' Vacía la caché de propuestas (tests)
#' @keywords internal
.propuesta_cache_vaciar <- function() {
  .propuesta_estado$cache <- list()
  invisible(NULL)
}

#' Propuesta de una lámina de la sesión (endpoints síncronos): de la caché si la firma ya se calculó
#' @keywords internal
.propuesta_resumen_sesion <- function(sid, slide_id = NULL, parsed = list()) {
  pedido <- .propuesta_pedido(sid, slide_id = slide_id, parsed = parsed)
  hit <- .propuesta_cache_leer(pedido$firma)
  if (!is.null(hit)) return(hit)
  out <- .propuesta_calcular_pedido(pedido)
  .propuesta_cache_guardar(pedido$firma, out)
  out
}

# ---- Job ---------------------------------------------------------------------------------------------------------------

#' Thunk del job: resuelve el worker en el namespace fresco del subproceso
#' @keywords internal
.propuesta_job_thunk <- function() {
  f <- function(entrada_path, progress_path = NULL) {
    worker <- get(".propuesta_resumen_worker", envir = asNamespace("prosecnurapp"), inherits = FALSE)
    worker(entrada_path = entrada_path, progress_path = progress_path)
  }
  environment(f) <- globalenv()
  f
}

#' Error de la propuesta como resultado del job (el patrón de `/preview-slide-job`)
#' @keywords internal
.propuesta_error_resultado <- function(e) {
  if (inherits(e, "api_error")) {
    return(list(ok = FALSE, error = .propuesta_compacto(list(code = e$code, status = as.integer(e$status), message = conditionMessage(e),
                                                             details = e$details))))
  }
  # Un error inesperado no viaja con su mensaje crudo (puede traer rutas): va un error_id que se busca en el stderr.
  error_id <- .api_error_id()
  message(sprintf("[prosecnur-app] E_INTERNAL %s: %s", error_id, conditionMessage(e)))
  list(ok = FALSE, error = list(code = "E_INTERNAL", status = 500L, message = sprintf("Error interno del servidor (ref. %s).", error_id),
                                details = list(error_id = error_id)))
}

#' Worker del job (corre en el subproceso `callr`)
#'
#' Lee la entrada por RDS, fija las opciones `prosecnur.*` del pedido y calcula la propuesta. Devuelve la respuesta
#' síncrona más `tiempos_ms` (que el log del job lee y `on_complete` quita), o el error como resultado.
#' @keywords internal
.propuesta_resumen_worker <- function(entrada_path, progress_path = NULL) {
  progreso <- job_progress_writer(progress_path)
  progreso("running", current = 0L, total = 1L, message = "Calculando la propuesta del motor")
  t0 <- proc.time()[["elapsed"]]
  entrada <- readRDS(entrada_path)
  fuentes <- readRDS(entrada$fuentes_path)
  if (length(entrada$opciones_motor)) {
    previa <- options(entrada$opciones_motor)
    on.exit(options(previa), add = TRUE)
  }
  t1 <- proc.time()[["elapsed"]]
  pedido <- list(args = entrada$args, data_sources = fuentes$data_sources, inst_sources = fuentes$inst_sources, crudas = fuentes$crudas)
  r <- tryCatch(.propuesta_calcular_pedido(pedido), error = function(e) .propuesta_error_resultado(e))
  progreso("done", current = 1L, total = 1L, percent = 100, message = "Propuesta lista.")
  if (isTRUE(r$ok)) {
    r$tiempos_ms <- list(entrada = as.integer(round(1000 * (t1 - t0))), calculo = as.integer(round(1000 * (proc.time()[["elapsed"]] - t1))))
  }
  r
}

#' Fuentes del job en RDS (convertidas y crudas), reutilizadas por huella
#' @keywords internal
.propuesta_fuentes_rds <- function(sid, pedido) {
  dir <- file.path(session_get(sid)$dir, "jobs", "inputs")
  dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  path <- file.path(dir, sprintf("propuesta_fuentes_%s.rds", .mini_digest(pedido$huellas, algo = "xxhash64")))
  if (!file.exists(path)) {
    .mini_escribir_atomico(path, function(tmp) {
      saveRDS(list(data_sources = pedido$data_sources, inst_sources = pedido$inst_sources, crudas = pedido$crudas), tmp, version = 3)
    })
  }
  path
}

#' Cancela el job de propuesta anterior de la misma lámina en la sesión, si sigue corriendo
#' @keywords internal
.propuesta_cancelar_previo <- function(llave) {
  previo <- (.propuesta_estado$jobs %||% list())[[llave]]
  if (is.null(previo)) return(invisible(NULL))
  j <- tryCatch(job_get(previo), error = function(e) NULL)
  if (!is.null(j) && identical(j$status, "running")) job_cancel(previo)
  invisible(NULL)
}

#' Lanza la propuesta como job `graficos.propuesta_resumen`
#'
#' Con la firma en caché el job nace terminado (`job_submit_completed`) y el primer poll ya trae el resultado. Si no, el
#' worker calcula y `on_complete` guarda el resultado bajo la firma. Un pedido nuevo de la misma lámina cancela el
#' anterior que siga corriendo.
#' @return `list(ok, job_id, kind, slide_id, cache)`.
#' @keywords internal
.propuesta_resumen_job_lanzar <- function(sid, slide_id = NULL, parsed = list()) {
  pedido <- .propuesta_pedido(sid, slide_id = slide_id, parsed = parsed)
  .propuesta_validar_lamina(pedido$args$slide)   # el 422 de tipo sale aquí, no dentro del job
  kind <- "graficos.propuesta_resumen"
  sl <- as.character(pedido$args$slide$id %||% "")[1]
  llave <- paste(sid, sl, sep = "\r")
  .propuesta_cancelar_previo(llave)
  hit <- .propuesta_cache_leer(pedido$firma)
  if (!is.null(hit)) {
    job_id <- job_submit_completed(sid, kind, result_data = hit)
    return(list(ok = TRUE, job_id = job_id, kind = kind, slide_id = sl, cache = TRUE))
  }
  entrada <- list(args = pedido$args, opciones_motor = pedido$opciones_motor, fuentes_path = .propuesta_fuentes_rds(sid, pedido))
  entrada_path <- job_save_rds(sid, "propuesta_entrada", entrada)
  firma <- pedido$firma
  job_id <- job_submit(
    sid, kind, .propuesta_job_thunk(), args = list(entrada_path = entrada_path),
    on_complete = function(j) {
      r <- j$result_data
      if (is.list(r)) r$tiempos_ms <- NULL
      .propuesta_cache_guardar(firma, r)
      r
    },
    on_cleanup = function(j) job_unlink_inputs(entrada_path)
  )
  jobs <- .propuesta_estado$jobs %||% list()
  jobs[[llave]] <- job_id
  .propuesta_estado$jobs <- jobs
  list(ok = TRUE, job_id = job_id, kind = kind, slide_id = sl, cache = FALSE)
}

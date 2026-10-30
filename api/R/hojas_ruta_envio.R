# hojas_ruta_envio.R — «Enviar a Material» (ADR 0118 §3, fase F1).
#
# El envío es una FOTO con huella: copia la muestra vigente del run de una fase
# (la que tiene el servidor, nunca la que mande el cliente) con su config
# completa, y la guarda en `runs[[fase]]$envio`. Material de campo
# (`ump_territorial_v1`) lee esa foto, no la muestra viva; si la muestra cambia,
# la huella deja de coincidir y ambos lados lo dicen (`desactualizado` / `stale`).
#
# La huella NO se calcula sobre la muestra entera: el GET de estado le inserta
# avisos v1 (hojas_ruta_sorteo_aviso_v1) y el ida y vuelta por el cliente cambia
# tipos. Se calcula sobre la proyección de identidad de cada bloque (manzana,
# rol, titular, rango y viviendas) más la semilla y el algoritmo del sorteo.
# Material y Monitoreo usan esta misma función (enmienda al ADR 0108 §1).

.HOJAS_RUTA_ENVIO_KEYS <- c("sample", "config", "sample_fingerprint", "enviado_at", "n_titulares", "n_reemplazos")

# Filas de un bloque de la muestra como lista de listas (llega como data.frame
# desde el motor o como lista de filas desde el cliente / el .pulso).
.hojas_ruta_envio_rows <- function(x) {
  if (is.null(x)) return(list())
  if (is.data.frame(x)) {
    if (!nrow(x)) return(list())
    return(lapply(seq_len(nrow(x)), function(i) as.list(x[i, , drop = FALSE])))
  }
  if (is.list(x)) return(Filter(is.list, unname(x)))
  list()
}

.hojas_ruta_envio_chr <- function(x) {
  if (is.null(x) || !length(x)) return("")
  v <- as.character(unlist(x, use.names = FALSE)[[1]])
  if (is.na(v)) "" else trimws(v)
}

.hojas_ruta_envio_int <- function(x) {
  if (is.null(x) || !length(x)) return(NA_integer_)
  suppressWarnings(as.integer(round(as.numeric(unlist(x, use.names = FALSE)[[1]]))))
}

.hojas_ruta_envio_identidad_bloque <- function(block, rol) {
  list(
    id_manzana = .hojas_ruta_envio_chr(block[["id_manzana"]]),
    rol = rol,
    titular_id_manzana = .hojas_ruta_envio_chr(block[["titular_id_manzana"]]),
    rango_inicio = .hojas_ruta_envio_int(block[["rango_inicio"]]),
    rango_fin = .hojas_ruta_envio_int(block[["rango_fin"]]),
    viviendas = .hojas_ruta_envio_int(block[["viviendas"]])
  )
}

.hojas_ruta_envio_tiene_bloques <- function(sample) {
  is.list(sample) && length(.hojas_ruta_envio_rows(sample$blocks)) > 0L
}

#' Huella de identidad de una muestra (ADR 0118 §3). NA si no hay bloques.
#' @keywords internal
.hojas_ruta_sample_fingerprint <- function(sample) {
  if (!.hojas_ruta_envio_tiene_bloques(sample)) return(NA_character_)
  seed <- .hojas_ruta_envio_int(sample$seed %||% sample$config$seed)
  # Sin firma = v1 (misma regla que hojas_ruta_sorteo_aviso_v1, que la escribe en el GET).
  algoritmo <- .hojas_ruta_envio_chr(sample$algoritmo_sorteo)
  if (!nzchar(algoritmo)) algoritmo <- HOJAS_RUTA_ALGORITMO_SORTEO_V1
  identidad <- list(
    seed = seed,
    algoritmo_sorteo = algoritmo,
    blocks = lapply(.hojas_ruta_envio_rows(sample$blocks), .hojas_ruta_envio_identidad_bloque, rol = "titular"),
    replacement_blocks = lapply(.hojas_ruta_envio_rows(sample$replacement_blocks),
                                .hojas_ruta_envio_identidad_bloque, rol = "reemplazo")
  )
  collection_fingerprint(identidad)
}

#' Normaliza la foto del envío; NULL si no tiene forma de envío.
#' @keywords internal
.hojas_ruta_envio_normalize <- function(x) {
  if (is.null(x) || !is.list(x) || !.hojas_ruta_envio_tiene_bloques(x$sample)) return(NULL)
  fp <- .hojas_ruta_envio_chr(x$sample_fingerprint)
  if (!grepl("^sha256:[0-9a-f]{64}$", fp)) fp <- .hojas_ruta_sample_fingerprint(x$sample)
  n_tit <- .hojas_ruta_envio_int(x$n_titulares)
  n_rem <- .hojas_ruta_envio_int(x$n_reemplazos)
  list(
    sample = x$sample,
    config = hojas_ruta_integrada_normalize_config(if (is.list(x$config)) x$config else list()),
    sample_fingerprint = fp,
    enviado_at = .hojas_ruta_envio_chr(x$enviado_at),
    n_titulares = if (is.na(n_tit)) length(.hojas_ruta_envio_rows(x$sample$blocks)) else n_tit,
    n_reemplazos = if (is.na(n_rem)) length(.hojas_ruta_envio_rows(x$sample$replacement_blocks)) else n_rem
  )
}

#' Metadatos públicos del envío de un run (sin la foto). NULL si no hay envío.
#' @keywords internal
hojas_ruta_envio_meta <- function(run) {
  if (!is.list(run)) return(NULL)
  envio <- .hojas_ruta_envio_normalize(run[["envio"]])
  if (is.null(envio)) return(NULL)
  vigente <- .hojas_ruta_sample_fingerprint(.hojas_ruta_list_get(run$workspace_outputs, "sample"))
  list(
    enviado_at = envio$enviado_at,
    sample_fingerprint = envio$sample_fingerprint,
    n_titulares = as.integer(envio$n_titulares),
    n_reemplazos = as.integer(envio$n_reemplazos),
    desactualizado = is.na(vigente) || !identical(vigente, envio$sample_fingerprint)
  )
}

# Las corridas tal como salen por HTTP: sin la foto (muestra y config enviadas),
# con sus metadatos.
.hojas_ruta_runs_publicos <- function(runs) {
  if (!is.list(runs) || !length(runs)) return(list())
  lapply(runs, function(run) {
    if (!is.list(run)) return(run)
    run$envio_meta <- hojas_ruta_envio_meta(run)
    run$envio <- NULL
    run
  })
}

.hojas_ruta_envio_fase_arg <- function(fase, sid) {
  if (is.null(fase) || !length(fase)) {
    return(.hojas_ruta_phase_normalize(session_get(sid)$hojas_ruta_active_phase %||% "field", default = "field"))
  }
  value <- .hojas_ruta_phase_normalize(fase, default = "")
  if (!nzchar(value)) {
    stop_api(422, "E_HOJAS_RUTA_ENVIO_FASE", "La fase del envío es «pilot» o «field».",
             details = list(fases = list("pilot", "field")))
  }
  value
}

#' Envía a Material la muestra vigente de una fase (POST /api/hojas-ruta/envio).
#'
#' Escribe `runs[[fase]]$envio` por `.hojas_ruta_store_runs` (marca el proyecto
#' modificado por la vía existente) sin cambiar la fase activa. El piloto
#' bloqueado se puede enviar: el envío no edita el diseño.
#' @keywords internal
hojas_ruta_enviar <- function(sid, fase = NULL) {
  s <- .hojas_ruta_ensure_runs(sid)
  fase <- .hojas_ruta_envio_fase_arg(fase, sid)
  runs <- s$hojas_ruta_runs
  run <- runs[[fase]]
  sample <- if (is.list(run)) .hojas_ruta_list_get(run$workspace_outputs, "sample") else NULL
  if (!.hojas_ruta_envio_tiene_bloques(sample)) {
    stop_api(409, "E_HOJAS_RUTA_ENVIO_SIN_MUESTRA",
             "Todavía no hay una muestra sorteada en esta fase para enviar a Material de campo.",
             details = list(fase = fase))
  }
  # Checklist F13: una muestra sorteada con el reparto por zonas v1 (ADR 0117) deja manzanas sin
  # probabilidad de salir; no va a campo hasta volver a sortear.
  avisos_v1 <- Filter(function(a) identical(as.character(a$code %||% ""), "W_SAMPLE_DRAWN_WITH_V1"),
                      tryCatch(hojas_ruta_sorteo_aviso_v1(sample)$alerts, error = function(e) list()) %||% list())
  if (length(avisos_v1)) {
    stop_api(409, "E_HOJAS_RUTA_ENVIO_SORTEO_V1",
             "Esta muestra se sorteó con el reparto por zonas anterior, que dejó viviendas sin probabilidad de salir: vuelve a sortear en Manzanas antes de enviarla a Material de campo.",
             details = list(fase = fase, distritos = length(avisos_v1)))
  }
  envio <- list(
    sample = sample,
    config = hojas_ruta_integrada_normalize_config(run$config %||% list()),
    sample_fingerprint = .hojas_ruta_sample_fingerprint(sample),
    enviado_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    n_titulares = length(.hojas_ruta_envio_rows(sample$blocks)),
    n_reemplazos = length(.hojas_ruta_envio_rows(sample$replacement_blocks))
  )
  runs[[fase]]$envio <- envio
  activa <- .hojas_ruta_phase_normalize(s$hojas_ruta_active_phase %||% "field", default = "field")
  .hojas_ruta_store_runs(sid, runs, activa)
  list(ok = TRUE, fase = fase, envio_meta = hojas_ruta_envio_meta(runs[[fase]]))
}

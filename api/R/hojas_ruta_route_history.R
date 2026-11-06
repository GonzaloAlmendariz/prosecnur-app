# Historial de ruteos de Hojas de ruta (`ui_state$route_history`), propuesta
# docs/qa/propuesta-route-history-2026-10-30.md revisada por guardian-contratos.
#
# Cada instantánea guarda el resumen del ruteo, su config y la huella de su muestra
# (`.hojas_ruta_sample_fingerprint`, ADR 0118 §3), no la muestra: en acnur_acg la
# muestra era el 99 % de cada entrada (0,9–2,7 MB) y viajaba en cada guardado.
# Restaurar es volver a sortear y comparar huellas; las firmas del motor, del marco
# y de la piloto dicen por qué una huella distinta no coincide.
#
# Las muestras que importan no se pierden: la vigente vive en
# `workspace_outputs$sample` y la enviada a campo en `envio`.

.HOJAS_RUTA_ROUTE_HISTORY_TOPE <- 12L
.HOJAS_RUTA_HUELLA_RX <- "^sha256:[0-9a-f]{64}$"

.hojas_ruta_rh_chr <- function(x) {
  v <- as.character(unlist(x %||% NA_character_, use.names = FALSE))[1]
  if (is.na(v) || !nzchar(v)) NA_character_ else v
}

# Huella que llega del cliente: sólo informativa, y sólo si tiene forma de huella.
.hojas_ruta_rh_huella_valida <- function(x) {
  v <- .hojas_ruta_rh_chr(x)
  if (!is.na(v) && grepl(.HOJAS_RUTA_HUELLA_RX, v)) v else NA_character_
}

#' Una instantánea sin su muestra. La huella y las firmas se calculan ANTES de
#' recortar, y sólo si la muestra tiene bloques; sin ella quedan NA («sin huella:
#' no se puede comprobar», nunca «coincide»).
#' @keywords internal
.hojas_ruta_route_snapshot_normalizar <- function(h) {
  if (!is.list(h)) return(NULL)
  sample <- h[["sample"]]
  if (is.list(sample) && .hojas_ruta_envio_tiene_bloques(sample)) {
    me <- sample$marco_elegible %||% list()
    h$sample_fingerprint <- .hojas_ruta_sample_fingerprint(sample)
    # Sin firma = v1, la misma regla de la huella.
    algoritmo <- .hojas_ruta_rh_chr(sample$algoritmo_sorteo)
    h$algoritmo_sorteo <- if (is.na(algoritmo)) HOJAS_RUTA_ALGORITMO_SORTEO_V1 else algoritmo
    h$frame_version <- .hojas_ruta_rh_chr(sample$frame_meta$version)
    h$hash_marco <- .hojas_ruta_rh_chr(me$hash_marco)
    h$hash_criterios <- .hojas_ruta_rh_chr(me$hash_criterios)
    ex <- sample$config$excluded_titular_ids %||% h$config$excluded_titular_ids %||% list()
    h$excluded_titular_ids <- as.list(unique(as.character(unlist(ex, use.names = FALSE))))
  } else {
    h$sample_fingerprint <- .hojas_ruta_rh_huella_valida(h$sample_fingerprint)
    for (k in c("algoritmo_sorteo", "frame_version", "hash_marco", "hash_criterios")) h[[k]] <- .hojas_ruta_rh_chr(h[[k]])
  }
  h[["sample"]] <- NULL
  h
}

#' Normaliza la lista del historial: instantáneas sin muestra y tope de 12 (el front
#' inserta con tope 8; 12 al leer no descarta entradas de historiales existentes).
#' @keywords internal
.hojas_ruta_route_history_normalizar <- function(raw) {
  lista <- raw %||% list()
  if (!is.list(lista)) return(list())
  if (is.data.frame(lista)) lista <- lapply(seq_len(nrow(lista)), function(i) as.list(lista[i, , drop = FALSE]))
  lista <- Filter(Negate(is.null), lapply(Filter(is.list, lista), .hojas_ruta_route_snapshot_normalizar))
  if (length(lista) > .HOJAS_RUTA_ROUTE_HISTORY_TOPE) lista <- lista[seq_len(.HOJAS_RUTA_ROUTE_HISTORY_TOPE)]
  lista
}

#' ¿Alguna instantánea guardada en sesión trae todavía la muestra entera? Decide si
#' la lectura migra (escribe las corridas normalizadas). No marca dirty: la huella
#' de las corridas excluye `ui_state`, así que el `.pulso` adelgaza en el siguiente
#' guardado que el usuario haga por otro motivo.
#' @keywords internal
.hojas_ruta_route_history_por_migrar <- function(s) {
  con_muestra <- function(ui) {
    if (!is.list(ui)) return(FALSE)
    rh <- ui$route_history %||% ui$routeHistory
    is.list(rh) && any(vapply(rh, function(h) is.list(h) && !is.null(h[["sample"]]), logical(1)))
  }
  runs <- s$hojas_ruta_runs %||% list()
  con_muestra(s$hojas_ruta_ui_state) ||
    any(vapply(runs, function(r) is.list(r) && con_muestra(r$ui_state %||% r$uiState), logical(1)))
}

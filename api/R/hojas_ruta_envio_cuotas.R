# hojas_ruta_envio_cuotas.R — el envío a Material de un territorial por cuotas (ADR 0125 §2).
#
# Gonzalo: «Hojas de ruta deja todo listo y definido para que Material de campo elabora las fichas de
# seguimiento y el excel de asignación». En cuotas no hay sorteo de manzanas: lo que se deja definido es la
# ZONA (hoy el distrito) con su N y su cuota por celda (sexo × rango de edad, la misma matriz de Población).
#
# Contrato (contratos-material-por-tipo-2026-11-02.md §1, aceptado por coordinación):
#   runs[[fase]]$envio = list(kind = "cuotas", zonas, config, sample_fingerprint, enviado_at, n_zonas,
#                              n_entrevistas)
#   zonas = list(list(id_zona, ubigeo, nombre, n, cuotas = list(list(sexo, rango_id, rango_edad, n))))
# La huella es de las zonas: si cambia una cuota, Material ve el envío desactualizado.
#
# No pasa por `hojas_ruta_quota_preview_integrado()`: esa vista previa exige que el N sea múltiplo de las
# encuestas por ruta, y en cuotas no hay rutas.

HOJAS_RUTA_ENVIO_KINDS <- c("ump", "cuotas")

#' Zonas del envío por cuotas desde las celdas de cuota. Pura.
#' @param cells data.frame de `.hojas_ruta_quota_cells()` (ubigeo, territorio, rango_id, rango_edad, sexo, cuota).
#' @param territorios filas de `.hojas_ruta_territories()` (ubigeo, distrito), para el nombre.
#' @keywords internal
.hojas_ruta_zonas_de_cuotas <- function(cells, territorios = list()) {
  if (!is.data.frame(cells) || !nrow(cells)) return(list())
  nombres <- stats::setNames(
    vapply(territorios, function(t) .hojas_ruta_envio_chr(t$distrito), ""),
    vapply(territorios, function(t) .hojas_ruta_envio_chr(t$ubigeo), "")
  )
  ubigeos <- unique(as.character(cells$ubigeo))
  lapply(ubigeos, function(u) {
    filas <- cells[as.character(cells$ubigeo) == u, , drop = FALSE]
    # Por sexo y, dentro, en el orden de los rangos tal como los arma la matriz (su id no siempre es un número).
    rangos <- unique(as.character(cells$rango_id %||% character(0)))
    filas <- filas[order(as.character(filas$sexo), match(as.character(filas$rango_id), rangos)), , drop = FALSE]
    cuotas <- lapply(seq_len(nrow(filas)), function(i) list(
      sexo = as.character(filas$sexo[[i]]),
      rango_id = as.character(filas$rango_id[[i]] %||% ""),
      rango_edad = as.character(filas$rango_edad[[i]] %||% ""),
      n = as.integer(filas$cuota[[i]])
    ))
    nombre <- if (!is.na(nombres[u]) && nzchar(nombres[u])) nombres[[u]] else as.character(filas$territorio[[1]] %||% u)
    list(id_zona = u, ubigeo = u, nombre = nombre, n = as.integer(sum(filas$cuota, na.rm = TRUE)), cuotas = cuotas)
  })
}

#' Huella de un envío por cuotas: de sus zonas y cuotas, no de cuándo se envió.
#' @keywords internal
.hojas_ruta_cuotas_fingerprint <- function(zonas) {
  if (!length(zonas)) return(NA_character_)
  collection_fingerprint(list(kind = "cuotas", zonas = zonas))
}

#' Las zonas que hoy saldrían de la configuración de una fase.
#' @keywords internal
.hojas_ruta_zonas_vigentes <- function(config) {
  cfg <- hojas_ruta_integrada_normalize_config(config %||% list())
  ubigeos <- unlist(cfg$territorios, use.names = FALSE)
  if (!length(ubigeos)) return(list())
  frame <- hojas_ruta_inei_frame(cfg$frame_source)
  frame <- frame[frame$ubigeo %in% ubigeos, , drop = FALSE]
  if (!nrow(frame)) return(list())
  .hojas_ruta_zonas_de_cuotas(.hojas_ruta_quota_cells(frame, cfg), .hojas_ruta_territories(frame))
}

#' Envía a Material las zonas y cuotas de una fase (POST /api/hojas-ruta/envio con kind = "cuotas").
#' @keywords internal
hojas_ruta_enviar_cuotas <- function(sid, fase = NULL) {
  s <- .hojas_ruta_ensure_runs(sid)
  fase <- .hojas_ruta_envio_fase_arg(fase, sid)
  runs <- s$hojas_ruta_runs
  run <- runs[[fase]]
  config <- hojas_ruta_integrada_normalize_config(if (is.list(run)) run$config %||% list() else list())
  zonas <- .hojas_ruta_zonas_vigentes(config)
  if (!length(zonas) || sum(vapply(zonas, function(z) z$n, 0L)) <= 0L) {
    stop_api(409, "E_HOJAS_RUTA_ENVIO_SIN_CUOTAS",
             "Todavía no hay zonas con cuota para enviar a Material de campo: elige los distritos y fija el N en Muestra.",
             details = list(fase = fase))
  }
  envio <- list(
    kind = "cuotas",
    zonas = zonas,
    config = config,
    sample_fingerprint = .hojas_ruta_cuotas_fingerprint(zonas),
    enviado_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    n_zonas = length(zonas),
    n_entrevistas = as.integer(sum(vapply(zonas, function(z) z$n, 0L)))
  )
  runs[[fase]]$envio <- envio
  activa <- .hojas_ruta_phase_normalize(s$hojas_ruta_active_phase %||% "field", default = "field")
  .hojas_ruta_store_runs(sid, runs, activa)
  list(ok = TRUE, fase = fase, envio_meta = hojas_ruta_envio_meta(runs[[fase]]))
}

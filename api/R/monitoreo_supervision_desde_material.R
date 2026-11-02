# Los resultados de la supervisión se leen de la base que arma Material
# (ADR 0125 A3; decisión de coordinación del 2 nov 2026: Monitoreo deja de
# publicar sus pestañas «Ronda N»).
#
# Material arma una campaña `supervision.<lote_id>` por lote y la escribe en un
# documento propio de supervisión, distinto del barrido, en la pestaña
# «Supervisión <lote_id>» (contrato acordado con Hojas). Monitoreo sólo lee, por
# «Código», las tres columnas fijas: «Observaciones del supervisor», «Estatus de
# la llamada de supervisión» y «Veredicto». Nombre y teléfono llegan por
# fórmula desde el barrido y pueden dar #REF! hasta que se dé acceso: no se leen.
#
# Una campaña sin documento no aparece en `collection_supervision_documentos()`
# y su ronda cae a la «Ronda N» vieja, para los proyectos que ya publicaron.

.MSDM_COLUMNAS <- c("Código", "Observaciones del supervisor", "Estatus de la llamada de supervisión", "Veredicto")

#' Los documentos de supervisión que Material ya construyó, por lote_id.
#' @keywords internal
.msdm_documentos <- function(s) {
  docs <- tryCatch(collection_supervision_documentos(s), error = function(e) list())
  docs <- Filter(function(d) is.list(d) && nzchar(.monitoreo_scalar(d$lote_id, "")) &&
                   nzchar(.monitoreo_scalar(d$spreadsheet_id, "")), docs %||% list())
  stats::setNames(docs, vapply(docs, function(d) .monitoreo_scalar(d$lote_id, ""), character(1)))
}

#' Lee de la base de Material las rondas que tienen documento.
#'
#' @param rondas rondas normalizadas.
#' @param documentos `.msdm_documentos(s)`.
#' @param valores_de función (spreadsheet_id, pestana) → values de la API;
#'   inyectable para los tests.
#' @return list(rondas, avisos, leidas, pendientes): `pendientes` son los
#'   índices de las rondas sin documento en Material, que caen a «Ronda N».
#' @keywords internal
monitoreo_supervision_leer_material <- function(rondas, documentos, valores_de, ahora = .monitoreo_now_iso()) {
  avisos <- character(0)
  leidas <- 0L
  pendientes <- integer(0)
  for (i in seq_along(rondas)) {
    lote <- paste0("ronda-", rondas[[i]]$numero)
    d <- documentos[[lote]]
    if (is.null(d)) {
      pendientes <- c(pendientes, i)
      next
    }
    pestana <- .monitoreo_scalar(d$pestana, paste("Supervisión", lote))
    valores <- tryCatch(valores_de(d$spreadsheet_id, pestana), error = function(e) NULL)
    if (is.null(valores)) {
      rondas[[i]]$resultados <- list(estado = "pestana_borrada", leido_el = ahora, pestana = pestana, filas = data.frame())
      avisos <- c(avisos, sprintf("No se pudo leer «%s» en la base de supervisión de Material.", pestana))
      next
    }
    tabla <- .monitoreo_supervision_tabla_pestana(valores)
    faltan <- setdiff(.MSDM_COLUMNAS, names(tabla))
    if (length(faltan)) {
      avisos <- c(avisos, sprintf("A «%s» le faltan las columnas %s; se leyó lo que trae.", pestana,
                                  paste0("«", faltan, "»", collapse = ", ")))
    }
    tabla <- tabla[, intersect(.MSDM_COLUMNAS, names(tabla)), drop = FALSE]
    rondas[[i]]$resultados <- .monitoreo_supervision_resultados_normalizar(list(
      estado = "leida", leido_el = ahora, pestana = pestana, filas = tabla
    ))
    rondas[[i]]$resultados$fuente <- "material"
    leidas <- leidas + 1L
  }
  list(rondas = rondas, avisos = avisos, leidas = leidas, pendientes = pendientes)
}

#' Lee los resultados de todas las rondas: primero de Material y, para las que
#' no tienen documento allí, de la «Ronda N» vieja de la hoja de supervisión.
#' @keywords internal
monitoreo_supervision_leer_resultados <- function(s, rondas, ahora = .monitoreo_now_iso()) {
  valores_de <- function(id, pestana) {
    rango <- utils::URLencode(paste0(.monitoreo_sheets_quote_sheet(pestana), "!A1:ZZ"), reserved = TRUE)
    .monitoreo_google_api(paste0(.monitoreo_sheets_api_base(id), "/values/", rango))$values
  }
  m <- monitoreo_supervision_leer_material(rondas, .msdm_documentos(s), valores_de, ahora)
  if (!length(m$pendientes)) return(m[c("rondas", "avisos", "leidas")])
  fuente <- tryCatch(.monitoreo_supervision_fuente_hoja(monitoreo_normalize_sources(s$monitoreo_sources %||% list())),
                     api_error = function(e) NULL)
  if (is.null(fuente)) {
    if (!m$leidas) {
      stop_api(409, "E_MONITOREO_SUPERVISION_SIN_BASE",
               "Todavía no hay base de supervisión: Material la arma por lote en su campaña de supervisión.")
    }
    return(m[c("rondas", "avisos", "leidas")])
  }
  vieja <- .monitoreo_supervision_leer_pestanas(fuente$sheet_binding$spreadsheet_id, m$rondas[m$pendientes], ahora)
  m$rondas[m$pendientes] <- vieja$rondas
  list(rondas = m$rondas, avisos = c(m$avisos, vieja$avisos), leidas = m$leidas + vieja$leidas)
}

# collection_campaigns_telefonica.R — la campaña telefónica de Material (P10, etapa 4 del
# plan conjunto; aprobada por Gonzalo el 31 oct). Un tipo de campaña más, junto a aulas,
# territorial y correo: el barrido telefónico de un listado de casos.
#
# Material NO guarda datos personales del listado: nombres y teléfonos viven sólo en el
# archivo del operativo (el Sheets o Excel del barrido). Aquí se guarda la configuración
# con que se arma la plantilla (collection_barrido_plantilla.R):
#   llave del caso, estratos declarados, teléfonos por caso, reemplazo, casos de muestra y
#   de backup (números), responsables y el catálogo de Status.
# Monitoreo telefónico sigue leyendo el Sheets como hoy: la plantilla conserva los
# nombres de columna que lee (llave, estrato, Status, Responsable, Intentos, Fecha).

.MCAMP_TELEFONICA_ID <- "telefonica.principal"
MATERIAL_TELEFONICA_CONFIG_SCHEMA <- "material_telefonica_config/v1"

.mcamp_telefonica_entry <- function(reg) {
  stored <- Filter(function(e) identical(e$tipo, "telefonica"), reg$campaigns)
  if (length(stored)) list(entry = stored[[1]], persisted = TRUE) else NULL
}

# La configuración guardada, normalizada al leer; sin clave, los valores por defecto.
.mtel_config <- function(s, campaign_id) {
  x <- s$material_telefonica_config
  base <- list(llave = "Código", estratos = list(), telefonos = 2L, reemplazo = FALSE, muestra = 0L, backup = 0L,
               responsables = list(), status = NULL, observacion = .MBP_OBSERVACION, sensibles = list(), revision = 0L)
  if (!is.list(x) || !identical(.mtf_txt(x$schema), MATERIAL_TELEFONICA_CONFIG_SCHEMA) ||
      !identical(.mtf_txt(x$campaign_id), campaign_id)) return(.mtel_responsables_del_padron(s, base))
  entero <- function(v, defecto) { n <- suppressWarnings(as.integer(.mtf_txt(v))); if (is.na(n) || n < 0L) defecto else n }
  list(llave = if (nzchar(.mtf_txt(x$llave))) .mtf_txt(x$llave) else "Código",
       estratos = as.list(.mbp_textos(x$estratos)), telefonos = entero(x$telefonos, 2L),
       reemplazo = isTRUE(x$reemplazo), muestra = entero(x$muestra, 0L), backup = entero(x$backup, 0L),
       responsables = as.list(.mbp_textos(x$responsables)),
       status = if (is.list(x$status) && length(x$status)) x$status else NULL,
       observacion = if (nzchar(.mtf_txt(x$observacion))) .mtf_txt(x$observacion) else .MBP_OBSERVACION,
       sensibles = as.list(intersect(.mbp_textos(x$sensibles), .mbp_textos(x$estratos))),
       revision = entero(x$revision, 0L)) |> (\(cfg) .mtel_responsables_del_padron(s, cfg))()
}

# Sin responsables tecleados, los del padrón de Monitoreo (cola de coordinación, punto 4): se siembran,
# no se guardan; en cuanto el analista guarda su lista, manda la suya.
.mtel_responsables_del_padron <- function(s, cfg) {
  cfg$responsables_del_padron <- FALSE
  if (length(cfg$responsables)) return(cfg)
  p <- tryCatch(monitoreo_equipo_padron(s), error = function(e) NULL)
  if (!is.list(p) || !p$familia %in% c("telefonico", "acreditacion")) return(cfg)
  nombres <- .mbp_textos(lapply(Filter(function(x) isTRUE(x$activo), p$personas %||% list()), function(x) x$nombre))
  if (!length(nombres)) return(cfg)
  cfg$responsables <- as.list(nombres)
  cfg$responsables_del_padron <- TRUE
  cfg
}

.mcamp_telefonica_estado <- function(s, entry) {
  cfg <- .mtel_config(s, entry$id)
  list(muestra = cfg$muestra, backup = cfg$backup, casos = cfg$muestra + cfg$backup,
       llave = cfg$llave, configurada = cfg$revision > 0L)
}

.mcamp_telefonica_public <- function(s, hit) {
  e <- hit$entry
  list(id = e$id, tipo = "telefonica", name = e$name, created_at = e$created_at %||% NA_character_,
       archived = isTRUE(e$archived), persisted = TRUE, ref = list(store = "material_telefonica_config"),
       proposito = e$proposito %||% NULL, estado = .mcamp_telefonica_estado(s, e))
}

.mcamp_telefonica_tipo <- function(hit) {
  if (is.null(hit)) return(list(tipo = "telefonica", disponible = TRUE))
  list(tipo = "telefonica", disponible = FALSE,
       motivo = if (isTRUE(hit$entry$archived)) "El proyecto ya tiene su campaña telefónica (archivada): reábrela."
                else "El proyecto ya tiene su campaña telefónica.")
}

.mcamp_telefonica_create <- function(sid, name, extras, expected_registry_revision) {
  l <- .mcamp_list(session_get(sid))
  .mcamp_assert_registry_revision(l$reg, expected_registry_revision)
  if (!is.null(l$telefonica)) {
    stop_api(409, "E_COLLECTION_CAMPAIGN_TELEFONICA_UNICA", "El proyecto ya tiene su campaña telefónica.",
             details = list(id = l$telefonica$entry$id, archived = isTRUE(l$telefonica$entry$archived)))
  }
  sobran <- names(Filter(Negate(is.null), extras))
  if (length(sobran)) {
    stop_api(422, "E_COLLECTION_CAMPAIGN_INVALID",
             sprintf("%s solo aplica a campañas de correo.", paste0("`", sobran, "`", collapse = ", ")))
  }
  name <- .cmail_campaign_text(name, "name", 1L, 80L)
  entry <- list(id = .MCAMP_TELEFONICA_ID, tipo = "telefonica", name = name, created_at = .collection_now_iso(),
                archived = FALSE, ref = list(store = "material_telefonica_config"))
  entry$proposito <- .mcamp_proposito(session_get(sid))  # ADR 0125 A4; NULL no deja la clave
  .mcamp_registry_commit(sid, l$reg, c(l$reg$campaigns, list(entry)))
  .mcamp_response(sid, .MCAMP_TELEFONICA_ID)
}

.mtel_campana <- function(s, campaign_id) {
  id <- .mtf_txt(campaign_id); if (!nzchar(id)) id <- .MCAMP_TELEFONICA_ID
  hit <- .mcamp_list(s)$telefonica
  if (is.null(hit) || !identical(hit$entry$id, id)) {
    stop_api(404, "E_COLLECTION_CAMPAIGN_NOT_FOUND", "La campaña no existe en este proyecto.", details = list(id = id))
  }
  hit
}

.mtel_publica <- function(cfg, campaign_id) {
  catalogo <- if (is.null(cfg$status)) .MBP_STATUS else cfg$status
  list(ok = TRUE, campaign_id = campaign_id, schema = MATERIAL_TELEFONICA_CONFIG_SCHEMA,
       llave = cfg$llave, estratos = cfg$estratos, telefonos = cfg$telefonos, reemplazo = cfg$reemplazo,
       muestra = cfg$muestra, backup = cfg$backup, responsables = cfg$responsables,
       responsables_del_padron = isTRUE(cfg$responsables_del_padron),
       status = catalogo, status_propio = !is.null(cfg$status), revision = cfg$revision,
       observacion = cfg$observacion, sensibles = cfg$sensibles, telefonos_max = .MBP_TELEFONOS_MAX,
       # Lo que Monitoreo telefónico lee del Sheets: no se cambia de nombre. Con reemplazo, la cola y los
       # no barridos separan muestra de backup por «Origen» (monitoreo_telefonico_cola.R).
       lee_monitoreo = c(list(cfg$llave, "Status", "Responsable", "Intentos", "Fecha"),
                         if (isTRUE(cfg$reemplazo)) list("Origen")))
}

#' Configuración de la campaña telefónica (lectura pura).
#' @keywords internal
collection_telefonica_config_get <- function(sid, campaign_id = NULL) {
  s <- session_get(sid)
  hit <- .mtel_campana(s, campaign_id)
  .mtel_publica(.mtel_config(s, hit$entry$id), hit$entry$id)
}

#' Guarda la configuración: se valida con las mismas reglas de la plantilla, de modo que
#' lo guardado siempre arma un libro.
#' @keywords internal
collection_telefonica_config_put <- function(sid, campaign_id = NULL, llave = NULL, estratos = NULL, telefonos = NULL,
                                             reemplazo = NULL, muestra = NULL, backup = NULL, responsables = NULL,
                                             status = NULL, expected_revision = NULL, observacion = NULL, sensibles = NULL) {
  s <- session_get(sid)
  hit <- .mtel_campana(s, campaign_id)
  cfg <- .mtel_config(s, hit$entry$id)
  if (!is.null(expected_revision) && length(expected_revision)) {
    esperada <- suppressWarnings(as.integer(unlist(expected_revision)[1]))
    if (is.na(esperada) || !identical(esperada, cfg$revision)) {
      stop_api(409, "E_COLLECTION_TELEFONICA_CONFIG_STALE", "La configuración cambió desde que se abrió la pantalla.",
               details = list(expected = if (is.na(esperada)) NULL else esperada, current = cfg$revision))
    }
  }
  casos <- function(v, actual, que) {
    if (is.null(v)) return(actual)
    n <- suppressWarnings(as.numeric(.mtf_txt(v)))
    if (is.na(n) || n < 0 || n != floor(n) || n > .MBP_FILAS_MAX) {
      stop_api(422, "E_COLLECTION_TELEFONICA_CONFIG_INVALIDA", sprintf("Los casos de %s van de 0 a %d.", que, .MBP_FILAS_MAX))
    }
    as.integer(n)
  }
  pedida <- cfg
  # Lo sembrado del padrón no se guarda como si el analista lo hubiera tecleado: sigue al padrón.
  if (isTRUE(cfg$responsables_del_padron)) pedida$responsables <- list()
  if (!is.null(llave)) pedida$llave <- .mtf_txt(llave)
  if (!is.null(estratos)) pedida$estratos <- as.list(.mbp_textos(estratos))
  if (!is.null(telefonos)) pedida$telefonos <- suppressWarnings(as.integer(.mtf_txt(telefonos)))
  if (!is.null(reemplazo)) pedida$reemplazo <- isTRUE(as.logical(.mtf_txt(reemplazo)))
  pedida$muestra <- casos(muestra, cfg$muestra, "muestra"); pedida$backup <- casos(backup, cfg$backup, "backup")
  # La pantalla reenvía la lista que muestra: si es la misma sembrada del padrón, no es una lista propia.
  sembrada <- isTRUE(cfg$responsables_del_padron) && identical(.mbp_textos(responsables), .mbp_textos(cfg$responsables))
  if (!is.null(responsables) && !sembrada) pedida$responsables <- as.list(.mbp_textos(responsables))
  if (!is.null(status)) pedida$status <- if (length(status)) status else NULL
  if (!is.null(observacion)) pedida$observacion <- .mtf_txt(observacion)
  if (!is.null(sensibles)) pedida$sensibles <- as.list(.mbp_textos(sensibles))
  # Las reglas de la plantilla deciden: lo que no arma un libro no se guarda.
  p <- tryCatch(.mbp_parametros("", pedida$llave, pedida$estratos, pedida$telefonos, pedida$reemplazo, pedida$responsables,
                                pedida$status, max(1L, pedida$muestra + pedida$backup), pedida$observacion, pedida$sensibles),
                api_error = function(e) stop_api(422, "E_COLLECTION_TELEFONICA_CONFIG_INVALIDA", conditionMessage(e),
                                                 details = e$details))
  guardado <- list(schema = MATERIAL_TELEFONICA_CONFIG_SCHEMA, campaign_id = hit$entry$id, llave = p$llave,
                   estratos = as.list(p$estratos), telefonos = p$telefonos, reemplazo = p$reemplazo,
                   muestra = pedida$muestra, backup = pedida$backup, responsables = as.list(p$responsables),
                   status = if (is.null(pedida$status)) NULL else p$status,
                   observacion = p$observacion, sensibles = as.list(p$sensibles),
                   revision = cfg$revision + 1L, updated_at = .collection_now_iso())
  session_set(sid, "material_telefonica_config", guardado)
  collection_telefonica_config_get(sid, hit$entry$id)
}

#' La plantilla del barrido armada con la configuración de la campaña.
#' @keywords internal
collection_telefonica_plantilla <- function(sid, campaign_id = NULL) {
  s <- session_get(sid)
  hit <- .mtel_campana(s, campaign_id)
  cfg <- .mtel_config(s, hit$entry$id)
  filas <- cfg$muestra + cfg$backup
  collection_barrido_plantilla(sid, estudio = hit$entry$name, llave = cfg$llave, estratos = cfg$estratos,
                               telefonos = cfg$telefonos, reemplazo = cfg$reemplazo, responsables = cfg$responsables,
                               status = cfg$status, filas = if (filas > 0L) filas else 2000L,
                               observacion = cfg$observacion, sensibles = cfg$sensibles,
                               muestra = cfg$muestra, backup = cfg$backup)
}

# collection_campaigns_territorial.R — campaña `territorial` de Material de campo
# (ADR 0118 §1 y §3, F1; ADR 0108 §1 fuente `ump_territorial_v1`).
#
# La campaña territorial lee la FOTO que Hojas de ruta envió
# (`hojas_ruta_runs[[fase]]$envio`, hojas_ruta_envio.R), nunca la muestra viva ni
# la fase activa: la fase queda fijada en `ref$fase` al crearla. Si la muestra
# viva de esa fase ya no tiene la huella de la foto, la lista sale `stale`.
#
# `.MCAMP_TERRITORIAL_HABILITADA` quedó en TRUE en F2 (el frontend ya pinta la
# campaña). En FALSE el tipo vuelve a no disponible y crear responde como antes;
# se lee por función para que los tests puedan forzar los dos lados.

.MCAMP_TERRITORIAL_HABILITADA <- TRUE
.MCAMP_TERRITORIAL_ID <- "territorial.principal"
.MCAMP_TERRITORIAL_SIN_ENVIO <- "Primero envía la muestra desde Hojas de ruta"
.MCAMP_TERRITORIAL_SOURCE <- "ump_territorial_v1"
.MCAMP_TERRITORIAL_UNIT_TYPE <- "territorial_ump"

.mcamp_territorial_habilitada <- function() isTRUE(.MCAMP_TERRITORIAL_HABILITADA)

# Foto normalizada del envío de una fase; NULL si no hay.
.mcamp_territorial_envio <- function(s, fase) {
  runs <- s$hojas_ruta_runs
  if (!is.list(runs) || !is.character(fase) || length(fase) != 1L || !fase %in% names(runs)) return(NULL)
  run <- runs[[fase]]
  if (!is.list(run)) return(NULL)
  .hojas_ruta_envio_normalize(run[["envio"]])
}

# Fases con envío (para el motivo del tipo).
.mcamp_territorial_fases_con_envio <- function(s) {
  runs <- s$hojas_ruta_runs
  if (!is.list(runs)) return(character(0))
  Filter(function(f) !is.null(.mcamp_territorial_envio(s, f)), names(runs))
}

# Huella de la muestra viva de la fase frente a la de la foto.
.mcamp_territorial_stale <- function(s, fase, envio) {
  run <- s$hojas_ruta_runs[[fase]]
  sample <- if (is.list(run)) .hojas_ruta_list_get(run$workspace_outputs, "sample") else NULL
  vigente <- .hojas_ruta_sample_fingerprint(sample)
  is.na(vigente) || !identical(vigente, envio$sample_fingerprint)
}

# La entrada territorial del registro (no se proyecta: sólo existe si se creó).
.mcamp_territorial_entry <- function(reg) {
  stored <- Filter(function(e) identical(e$tipo, "territorial"), reg$campaigns)
  if (length(stored)) list(entry = stored[[1]], persisted = TRUE) else NULL
}

.mcamp_territorial_fase_of <- function(entry) {
  fase <- entry$ref$fase
  if (is.character(fase) && length(fase) == 1L && fase %in% c("pilot", "field")) fase else "field"
}

.mcamp_territorial_estado <- function(s, entry) {
  fase <- .mcamp_territorial_fase_of(entry)
  envio <- .mcamp_territorial_envio(s, fase)
  if (is.null(envio)) {
    return(list(titulares = 0L, reemplazos = 0L, stale = TRUE, enviado_at = NA_character_))
  }
  list(titulares = as.integer(envio$n_titulares), reemplazos = as.integer(envio$n_reemplazos),
       stale = .mcamp_territorial_stale(s, fase, envio), enviado_at = envio$enviado_at)
}

.mcamp_territorial_public <- function(s, hit) {
  e <- hit$entry
  list(id = e$id, tipo = "territorial", name = e$name, created_at = e$created_at %||% NA_character_,
       archived = isTRUE(e$archived), persisted = TRUE,
       ref = list(store = "hojas_ruta_envio", fase = .mcamp_territorial_fase_of(e)),
       estado = .mcamp_territorial_estado(s, e))
}

.mcamp_territorial_tipo <- function(s, territorial_hit) {
  con_envio <- length(.mcamp_territorial_fases_con_envio(s)) > 0L
  if (!.mcamp_territorial_habilitada()) {
    return(list(tipo = "territorial", disponible = FALSE,
                motivo = if (con_envio) .MCAMP_TERRITORIAL_MOTIVO else .MCAMP_TERRITORIAL_SIN_ENVIO))
  }
  if (!is.null(territorial_hit)) {
    return(list(tipo = "territorial", disponible = FALSE,
                motivo = if (isTRUE(territorial_hit$entry$archived)) "El proyecto ya tiene su campaña territorial (archivada): reábrela."
                         else "El proyecto ya tiene su campaña territorial."))
  }
  if (!con_envio) return(list(tipo = "territorial", disponible = FALSE, motivo = .MCAMP_TERRITORIAL_SIN_ENVIO))
  list(tipo = "territorial", disponible = TRUE)
}

.mcamp_territorial_fase_arg <- function(s, fase) {
  if (is.null(fase) || !length(fase)) {
    return(.hojas_ruta_phase_normalize(s$hojas_ruta_active_phase %||% "field", default = "field"))
  }
  value <- .hojas_ruta_phase_normalize(fase, default = "")
  if (!nzchar(value)) {
    stop_api(422, "E_COLLECTION_CAMPAIGN_INVALID", "fase es «pilot» o «field».")
  }
  value
}

# Crea `territorial.principal` (una por proyecto) con la fase fijada.
.mcamp_territorial_create <- function(sid, name, fase, extras, expected_registry_revision) {
  s <- session_get(sid)
  l <- .mcamp_list(s)
  .mcamp_assert_registry_revision(l$reg, expected_registry_revision)
  if (!is.null(l$territorial)) {
    stop_api(409, "E_COLLECTION_CAMPAIGN_TERRITORIAL_UNICA",
             "El proyecto ya tiene su campaña territorial.",
             details = list(id = l$territorial$entry$id, archived = isTRUE(l$territorial$entry$archived)))
  }
  sobran <- names(Filter(Negate(is.null), extras))
  if (length(sobran)) {
    stop_api(422, "E_COLLECTION_CAMPAIGN_INVALID",
             sprintf("%s solo aplica a campañas de correo.", paste0("`", sobran, "`", collapse = ", ")))
  }
  fase <- .mcamp_territorial_fase_arg(s, fase)
  if (is.null(.mcamp_territorial_envio(s, fase))) {
    stop_api(409, "E_COLLECTION_CAMPAIGN_TERRITORIAL_SIN_ENVIO", .MCAMP_TERRITORIAL_SIN_ENVIO,
             details = list(fase = fase))
  }
  name <- .cmail_campaign_text(name, "name", 1L, 80L)
  entry <- list(id = .MCAMP_TERRITORIAL_ID, tipo = "territorial", name = name, created_at = .collection_now_iso(),
                archived = FALSE, ref = list(store = "hojas_ruta_envio", fase = fase))
  .mcamp_registry_commit(sid, l$reg, c(l$reg$campaigns, list(entry)))
  .mcamp_response(sid, .MCAMP_TERRITORIAL_ID)
}

.mcamp_territorial_unidad <- function(block, role) {
  chr <- function(x) { v <- .hojas_ruta_envio_chr(x); if (nzchar(v)) v else NA_character_ }
  titular_id <- if (identical(role, "reemplazo")) chr(block[["titular_id_manzana"]]) else NA_character_
  list(
    unit_id = .hojas_ruta_envio_chr(block[["id_manzana"]]),
    unit_type = .MCAMP_TERRITORIAL_UNIT_TYPE,
    label = .hojas_ruta_operational_code(block, role),
    role = role,
    titular_id = titular_id,
    distrito = chr(block[["distrito"]]),
    ubigeo = chr(block[["ubigeo"]]),
    zona = chr(block[["zona"]]),
    manzana = chr(block[["manzana"]]),
    rango_inicio = .hojas_ruta_envio_int(block[["rango_inicio"]]),
    rango_fin = .hojas_ruta_envio_int(block[["rango_fin"]]),
    viviendas = .hojas_ruta_envio_int(block[["viviendas"]])
  )
}

#' Unidades de la campaña territorial (`ump_territorial_v1`, ADR 0118 §3).
#'
#' Proyección pura de la foto enviada en la fase de la campaña: no escribe ni
#' marca el proyecto. Sin foto (p. ej. `field/from-pilot` recreó el run de campo)
#' responde 409, no una lista vacía.
#' @keywords internal
collection_territorial_unidades <- function(sid, campaign_id) {
  id <- .mcamp_id_arg(campaign_id)
  s <- session_get(sid)
  l <- .mcamp_list(s)
  hit <- if (startsWith(id, "territorial.")) l$territorial else NULL
  if (is.null(hit) || !identical(hit$entry$id, id)) {
    stop_api(404, "E_COLLECTION_CAMPAIGN_NOT_FOUND", "La campaña no existe en este proyecto.",
             details = list(id = id))
  }
  fase <- .mcamp_territorial_fase_of(hit$entry)
  envio <- .mcamp_territorial_envio(s, fase)
  if (is.null(envio)) {
    stop_api(409, "E_COLLECTION_TERRITORIAL_SIN_FUENTE",
             "La muestra enviada desde Hojas de ruta ya no está: vuelve a enviarla.",
             details = list(id = id, fase = fase))
  }
  units <- c(
    lapply(.hojas_ruta_envio_rows(envio$sample$blocks), .mcamp_territorial_unidad, role = "titular"),
    lapply(.hojas_ruta_envio_rows(envio$sample$replacement_blocks), .mcamp_territorial_unidad, role = "reemplazo")
  )
  list(ok = TRUE, campaign_id = id, fase = fase, source = .MCAMP_TERRITORIAL_SOURCE,
       unit_type = .MCAMP_TERRITORIAL_UNIT_TYPE, units = units,
       n_titulares = as.integer(envio$n_titulares), n_reemplazos = as.integer(envio$n_reemplazos),
       enviado_at = envio$enviado_at, sample_fingerprint = envio$sample_fingerprint,
       stale = .mcamp_territorial_stale(s, fase, envio))
}

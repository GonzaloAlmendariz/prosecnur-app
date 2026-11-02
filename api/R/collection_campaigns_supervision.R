# collection_campaigns_supervision.R — la campaña de supervisión del telefónico (ADR 0125, anexo A3:
# «Monitoreo → Material → Monitoreo»).
#
# Gonzalo (2 nov 2026): «monitoreo sabe el avance entonces al querer armar la base de supervisión calcula
# a quiénes se les supervisa y cuándo de su producción por lote de avance y eso lo manda a Material,
# material sabe que esta supervisión viene del anterior campo y lo que hace es coger las columnas
# relevantes de la base de barrido y las columnas relevantes de los resultados […] además le añade sus
# propias columnas de la supervisión […] arma todo eso pero quien lo lee es el Monitoreo».
#
# Una campaña por lote: id `supervision.<lote_id>`, con `relacion$viene_de = "telefonica.principal"`. El
# lote lo decide Monitoreo (`monitoreo_supervision_lotes()`, la misma función que sirve
# GET /api/monitoreo/telefonico/supervision/lotes); Material no recalcula a quién ni cuándo. Si Monitoreo
# rehace un lote, la campaña lee el lote vigente; si lo borra, la campaña dice que su lote ya no está.

.MCAMP_SUPERVISION_SIN_TELEFONICA <- "Primero crea la campaña telefónica: la supervisión sale de su barrido"
.MCAMP_SUPERVISION_SIN_LOTES <- "Monitoreo todavía no armó un lote de supervisión"
.MCAMP_SUPERVISION_VIENE_DE <- "telefonica.principal"

# Las tres columnas que lee Monitoreo, con nombre fijo, y el catálogo del Veredicto (ADR 0125 A3; revisable
# por Gonzalo: el catálogo es la propuesta de la coordinación del 2 nov 2026).
MATERIAL_SUPERVISION_COLUMNAS_FIJAS <- c("Observaciones del supervisor", "Estatus de la llamada de supervisión", "Veredicto")
MATERIAL_SUPERVISION_VEREDICTOS <- c("Confirmada", "No confirmada", "No contactado")

# Lotes vigentes de Monitoreo, en la forma del anexo A3. Nunca falla hacia arriba: sin rondas, vacío.
.msup_lotes <- function(s) {
  rondas <- tryCatch(.monitoreo_supervision_rondas_normalizar(s[["monitoreo_supervision_rondas"]]), error = function(e) list())
  tryCatch(monitoreo_supervision_lotes(rondas), error = function(e) list())
}

.msup_lote <- function(s, lote_id) Find(function(l) identical(l$lote_id, lote_id), .msup_lotes(s))

.mcamp_supervision_entries <- function(reg) {
  lapply(Filter(function(e) identical(e$tipo, "supervision"), reg$campaigns), function(e) list(entry = e, persisted = TRUE))
}

.mcamp_supervision_lote_id <- function(entry) .mtf_txt((entry$ref %||% list())$lote_id)

.mcamp_supervision_estado <- function(s, entry) {
  lote <- .msup_lote(s, .mcamp_supervision_lote_id(entry))
  list(lote_id = .mcamp_supervision_lote_id(entry), sin_lote = is.null(lote),
       casos = if (is.null(lote)) 0L else length(lote$casos), criterio = if (is.null(lote)) NA_character_ else lote$criterio)
}

.mcamp_supervision_public <- function(s, hit) {
  e <- hit$entry
  list(id = e$id, tipo = "supervision", name = e$name, created_at = e$created_at %||% NA_character_,
       archived = isTRUE(e$archived), persisted = TRUE, ref = e$ref,
       relacion = e$relacion %||% list(publico = NULL, ronda = NULL, viene_de = .MCAMP_SUPERVISION_VIENE_DE),
       estado = .mcamp_supervision_estado(s, e))
}

# Disponible mientras haya un lote de Monitoreo sin su campaña; `lotes_libres` dice cuáles.
.mcamp_supervision_tipo <- function(s, telefonica_hit, supervision_hits) {
  if (is.null(telefonica_hit)) return(list(tipo = "supervision", disponible = FALSE, motivo = .MCAMP_SUPERVISION_SIN_TELEFONICA))
  lotes <- .msup_lotes(s)
  if (!length(lotes)) return(list(tipo = "supervision", disponible = FALSE, motivo = .MCAMP_SUPERVISION_SIN_LOTES))
  tomados <- vapply(supervision_hits, function(h) .mcamp_supervision_lote_id(h$entry), "")
  libres <- Filter(function(l) !l$lote_id %in% tomados, lotes)
  if (!length(libres)) {
    return(list(tipo = "supervision", disponible = FALSE, motivo = "Cada lote de Monitoreo ya tiene su campaña de supervisión."))
  }
  list(tipo = "supervision", disponible = TRUE,
       lotes_libres = lapply(libres, function(l) list(lote_id = l$lote_id, creado_en = l$creado_en, criterio = l$criterio,
                                                     casos = length(l$casos))))
}

.mcamp_supervision_create <- function(sid, name, lote, extras, expected_registry_revision) {
  s <- session_get(sid)
  l <- .mcamp_list(s)
  .mcamp_assert_registry_revision(l$reg, expected_registry_revision)
  sobran <- names(Filter(Negate(is.null), extras))
  if (length(sobran)) {
    stop_api(422, "E_COLLECTION_CAMPAIGN_INVALID",
             sprintf("%s no aplica a una campaña de supervisión.", paste0("`", sobran, "`", collapse = ", ")))
  }
  if (is.null(l$telefonica)) {
    stop_api(409, "E_COLLECTION_SUPERVISION_SIN_LOTE", .MCAMP_SUPERVISION_SIN_TELEFONICA)
  }
  lote_id <- .mtf_txt(lote)
  hit <- if (nzchar(lote_id)) .msup_lote(s, lote_id) else NULL
  if (is.null(hit)) {
    stop_api(409, "E_COLLECTION_SUPERVISION_SIN_LOTE",
             if (nzchar(lote_id)) "Ese lote no está entre los que armó Monitoreo." else "Elige el lote de Monitoreo que se va a supervisar.",
             details = list(lote = lote_id, lotes = lapply(.msup_lotes(s), `[[`, "lote_id")))
  }
  id <- paste0("supervision.", lote_id)
  if (!.mcamp_id_ok(id)) {
    stop_api(422, "E_COLLECTION_CAMPAIGN_INVALID", "El lote de Monitoreo no tiene un identificador que sirva de campaña.",
             details = list(lote = lote_id))
  }
  if (any(vapply(l$supervision, function(h) identical(h$entry$id, id), TRUE))) {
    stop_api(409, "E_COLLECTION_SUPERVISION_UNICA", "Ese lote ya tiene su campaña de supervisión.", details = list(id = id))
  }
  # Viene de su campaña telefónica concreta: la que nombra el lote si existe, la única si hay una sola
  # (en acreditación hay una por público y ronda), y si no, la principal.
  telefonicas <- vapply(.mcamp_telefonica_entries(l$reg), function(h) h$entry$id, "")
  viene_de <- if (.mtf_txt(hit$campana_origen) %in% telefonicas) .mtf_txt(hit$campana_origen)
              else if (length(telefonicas) == 1L) telefonicas[[1]] else .MCAMP_SUPERVISION_VIENE_DE
  name <- .cmail_campaign_text(name, "name", 1L, 80L)
  entry <- list(id = id, tipo = "supervision", name = name, created_at = .collection_now_iso(), archived = FALSE,
                ref = list(store = "monitoreo_supervision_lotes", lote_id = lote_id),
                relacion = list(publico = NULL, ronda = NULL, viene_de = viene_de))
  .mcamp_registry_commit(sid, l$reg, c(l$reg$campaigns, list(entry)))
  .mcamp_response(sid, id)
}

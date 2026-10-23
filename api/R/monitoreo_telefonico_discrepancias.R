# =============================================================================
# monitoreo_telefonico_discrepancias.R — Kobo y la hoja no dicen lo mismo
# =============================================================================
#
# Revamp de Monitoreo › Telefónico, T9 (Control › Discrepancias). Decisiones en
# `docs/qa/revamp-monitoreo/procedimientos-respondidos.md`, P1–P4:
#   - P2: lo primero es la ALERTA en los dos sentidos, con responsable, CodPulso
#     y código proGres, para avisar al equipo antes de decidir.
#   - P1: mientras no se decide, la efectiva de Kobo cuenta (manda Kobo).
#   - P3: «la hoja dice Efectivo y Kobo no tiene envío» va a Avisos.
#   - La decisión «Cuenta / No cuenta» reutiliza
#     `monitoreo_profile.reconciliation_decisions`: «No cuenta» es
#     `keep_excluded` y suma el `response_id` a `exclude_response_ids` (el
#     avance lo descuenta); «Cuenta» es `include_with_caveat` con el CodPulso
#     como caso asignado y deja el envío fuera de la lista de excluidos.
#
# Bloque `discrepancias_telefonicas` (solo lectura), una fila por caso:
#   Sentido (`kobo_sin_hoja` | `hoja_sin_kobo`) · CodPulso · proGres ·
#   Responsable · La hoja dice · Fecha hoja · Fecha Kobo
# proGres sale de la columna del barrido que `monitoreo_llave_progres.R`
# reconoce (RMS «Código proGres», MEDVID «COD.proGres»); sin columna, "".
# =============================================================================

.MONITOREO_DISCREPANCIAS_MAX_FILAS <- 5000L

.monitoreo_discrepancias_vacio <- function() {
  data.frame(
    Sentido = character(0), CodPulso = character(0), proGres = character(0), Responsable = character(0),
    `La hoja dice` = character(0), `Fecha hoja` = character(0), `Fecha Kobo` = character(0),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

# proGres por fila del barrido, con la misma detección que la llave de respaldo.
.monitoreo_discrepancias_progres <- function(phone) {
  if (is.null(phone) || !is.data.frame(phone) || !nrow(phone)) return(character(0))
  candidatas <- which(.monitoreo_progres_columnas(
    phone, .monitoreo_variable_label_map(phone), .monitoreo_source_variable_label_map(phone)
  ))
  if (!length(candidatas)) return(rep("", nrow(phone)))
  valores <- trimws(as.character(phone[[candidatas[[1]]]]))
  valores[is.na(valores)] <- ""
  valores
}

#' Filas del bloque `discrepancias_telefonicas`.
#'
#' `detalle` es `comparacion_codpulso` (una fila por caso del barrido y, al
#' final, las efectivas de Kobo fuera de base); `claves` es el CodPulso de cada
#' fila del barrido, en el orden de `phone`.
#' @noRd
.monitoreo_telefonico_discrepancias_df <- function(phone, claves, detalle) {
  if (is.null(detalle) || !is.data.frame(detalle) || !nrow(detalle)) return(.monitoreo_discrepancias_vacio())
  si <- function(col) if (col %in% names(detalle)) as.character(detalle[[col]]) == "Sí" else rep(FALSE, nrow(detalle))
  kobo <- si("Efectiva Kobo")
  hoja <- si("Efectiva telefónica")
  sentido <- ifelse(kobo & !hoja, "kobo_sin_hoja", ifelse(hoja & !kobo, "hoja_sin_kobo", ""))
  filas <- which(nzchar(sentido))
  if (!length(filas)) return(.monitoreo_discrepancias_vacio())
  progres <- .monitoreo_discrepancias_progres(phone)
  mapa <- stats::setNames(progres, as.character(claves %||% character(0)))
  mapa <- mapa[nzchar(names(mapa))]
  texto <- function(col) {
    v <- if (col %in% names(detalle)) as.character(detalle[[col]][filas]) else rep("", length(filas))
    v[is.na(v)] <- ""
    v
  }
  cod <- texto("CodPulso")
  out <- data.frame(
    Sentido = sentido[filas],
    CodPulso = cod,
    proGres = unname(ifelse(cod %in% names(mapa), mapa[cod], "")),
    Responsable = texto("Responsable"),
    `La hoja dice` = texto("Estado telefónico"),
    `Fecha hoja` = texto("Fecha"),
    `Fecha Kobo` = texto("Fecha Kobo"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  out$proGres[is.na(out$proGres)] <- ""
  out <- out[order(out$Sentido, out$Responsable, out$CodPulso), , drop = FALSE]
  rownames(out) <- NULL
  utils::head(out, .MONITOREO_DISCREPANCIAS_MAX_FILAS)
}

#' Bloque `discrepancias_telefonicas`.
#' @noRd
.monitoreo_telefonico_discrepancias_blocks <- function(phone, claves, detalle) {
  filas <- .monitoreo_telefonico_discrepancias_df(phone, claves, detalle)
  list(.monitoreo_report_block(
    "discrepancias_telefonicas",
    "Discrepancias entre Kobo y la hoja de barrido",
    filas,
    "Efectivas de Kobo que la hoja no marca «Efectivo» y casos que la hoja marca «Efectivo» sin envío de Kobo."
  ))
}

# --- Decisión «Cuenta / No cuenta» ------------------------------------------

#' Aplica la decisión del supervisor sobre una efectiva de Kobo en
#' discrepancia. Devuelve la config con `reconciliation_decisions` al día.
#' @noRd
.monitoreo_telefonico_decidir_discrepancia <- function(config, payload) {
  if (!is.list(payload)) payload <- list()
  response_id <- trimws(.monitoreo_scalar(payload$response_id %||% payload$responseId, ""))
  codigo <- trimws(.monitoreo_scalar(payload$codpulso %||% payload$CodPulso %||% payload$codigo, ""))
  decision <- .monitoreo_scalar(payload$decision %||% payload$action, "")
  nota <- trimws(.monitoreo_scalar(payload$note %||% payload$nota, ""))
  if (!nzchar(response_id)) stop_api(400, "E_MONITOREO_RESPONSE_ID", "Falta response_id para guardar la decision.")
  if (!decision %in% c("cuenta", "no_cuenta")) {
    stop_api(400, "E_MONITOREO_DECISION_ACTION", "La decision debe ser «cuenta» o «no_cuenta».")
  }
  if (!nzchar(nota)) {
    stop_api(400, "E_MONITOREO_NOTE_REQUIRED", "Agrega una nota: la decision queda en el proyecto con quien decidio y por que.")
  }
  cfg <- if (is.list(config)) config else list()
  profile <- cfg$monitoreo_profile %||% list()
  recon <- profile$reconciliation_decisions %||% list()
  incluir <- unique(.monitoreo_chr_vec(recon$include_response_ids))
  excluir <- unique(.monitoreo_chr_vec(recon$exclude_response_ids))
  manual <- .monitoreo_normalize_manual_case_reconciliations(recon$manual_case_reconciliations %||% list())
  anterior <- manual[[response_id]]
  cuenta <- identical(decision, "cuenta")
  excluir <- if (cuenta) setdiff(excluir, response_id) else unique(c(excluir, response_id))
  incluir <- setdiff(incluir, response_id)
  manual[[response_id]] <- list(
    response_id = response_id,
    actor = "",
    action = if (cuenta) "include_with_caveat" else "keep_excluded",
    declared_code = codigo,
    declared_email = "",
    assigned_person_label = if (cuenta) codigo else "",
    assigned_case_key = if (cuenta) codigo else "",
    assigned_base_source = "",
    assigned_base_row = 0L,
    match_type = "telefonico_discrepancia",
    previous_status = if (is.list(anterior)) .monitoreo_scalar(anterior$new_status, "cuenta_mientras_tanto") else "cuenta_mientras_tanto",
    new_status = if (cuenta) "cuenta" else "no_cuenta",
    note = nota,
    decided_at = .monitoreo_now_iso()
  )
  profile$reconciliation_decisions <- list(
    include_response_ids = as.list(incluir),
    exclude_response_ids = as.list(excluir),
    manual_case_reconciliations = manual
  )
  cfg$monitoreo_profile <- profile
  list(config = cfg, decision = manual[[response_id]])
}

mount_monitoreo_telefonico_discrepancias <- function(pr) {
  pr |>
    plumber::pr_post("/api/monitoreo/telefonico/discrepancia/decision", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      applied <- .monitoreo_telefonico_decidir_discrepancia(cfg, parsed$decision %||% parsed)
      cfg <- .monitoreo_store_config(sid, monitoreo_normalize_config(applied$config, data))
      saved_project <- .monitoreo_mark_project_dirty_if_open(sid)
      list(ok = TRUE, decision = applied$decision, state = .monitoreo_state_payload(sid), saved_project = !is.null(saved_project))
    }))
}

# --- «No cuenta» sale del avance ---------------------------------------------

#' Envíos que el supervisor decidió que no cuentan desde Discrepancias. Solo
#' las decisiones de este modo (`match_type = "telefonico_discrepancia"`): una
#' exclusión heredada de otra pantalla no mueve el avance telefónico.
#' @noRd
.monitoreo_telefonico_no_cuentan <- function(profile) {
  manual <- (profile$reconciliation_decisions %||% list())$manual_case_reconciliations %||% list()
  ids <- vapply(manual, function(item) {
    if (!is.list(item)) return("")
    propia <- identical(.monitoreo_scalar(item$match_type, ""), "telefonico_discrepancia")
    fuera <- identical(.monitoreo_scalar(item$action, ""), "keep_excluded")
    if (propia && fuera) .monitoreo_scalar(item$response_id, "") else ""
  }, character(1))
  unique(ids[nzchar(ids)])
}

#' Las respuestas sin los envíos que «no cuentan». Mismo identificador que la
#' columna «Response ID» que ve el supervisor.
#' @noRd
.monitoreo_telefonico_sin_excluidas <- function(responses, profile) {
  fuera <- .monitoreo_telefonico_no_cuentan(profile)
  if (!length(fuera) || is.null(responses) || !is.data.frame(responses) || !nrow(responses)) return(responses)
  ids <- trimws(.monitoreo_report_first_values(responses, c("_uuid", "uuid", "response_id", "id_respuesta", "id respuesta", "_id", "id")))
  ids[is.na(ids)] <- ""
  responses[!(nzchar(ids) & ids %in% fuera), , drop = FALSE]
}

# --- P4: equivalencia de nombres entre Kobo y la hoja --------------------------

#' `enumerator_equivalences`: lista de {kobo, hoja} que el equipo confirma en
#' Insumos › Llave y filtros. El enumerador de Kobo y el responsable de la hoja
#' son la misma persona escrita de dos formas (P4). Se llama desde
#' `monitoreo_normalize_profile`; sin pares la clave no aparece.
#' @noRd
.monitoreo_profile_equivalencias <- function(out, profile) {
  raw <- profile[["enumerator_equivalences"]]
  if (is.data.frame(raw)) raw <- lapply(seq_len(nrow(raw)), function(i) as.list(raw[i, , drop = FALSE]))
  if (!is.list(raw) || !length(raw)) return(out)
  pares <- list()
  vistos <- character(0)
  for (item in raw) {
    if (!is.list(item)) next
    kobo <- trimws(.monitoreo_scalar(item$kobo, ""))
    hoja <- trimws(.monitoreo_scalar(item$hoja, ""))
    if (!nzchar(kobo) || !nzchar(hoja) || kobo %in% vistos) next
    vistos <- c(vistos, kobo)
    pares[[length(pares) + 1L]] <- list(kobo = kobo, hoja = hoja)
  }
  if (length(pares)) out[["enumerator_equivalences"]] <- pares
  out
}

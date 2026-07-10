# Puente Monitoreo -> Procesamiento, lado Carga.
#
# El motor pesado del handoff vive en router_monitoreo.R (archivo congelado):
# `.monitoreo_processing_handoff_promote` extrae el XLSForm fidedigno + la data
# filtrada al universo valido y persiste la base activa del estudio, de modo que
# Codificacion abra directo. Aca solo exponemos ese puente desde el modulo de
# Carga con:
#   1. un STATUS barato (sin stagear archivos ni tocar red) para que la UI de
#      Carga sepa si hay un corte de monitoreo promovible y de que fuente saldria
#      el instrumento, y
#   2. un promote delgado que reusa el helper congelado tal cual.
#
# PREFERENCIA DE INSTRUMENTO: la data es local, pero el instrumento se prefiere
# desde la API de Kobo (version desplegada, fidedigna). Esa preferencia la decide
# el propio helper congelado `.monitoreo_processing_handoff_xlsform`: puntua los
# candidatos por columnas emparejadas y desempata por `priority` (Kobo API = 5,
# base del estudio = 10, file store = 40; menor gana). No hay flag en `parsed`
# para forzar la API: es automatica. El STATUS reporta `instrument_source` solo
# para transparencia de que fuente saldria el instrumento.

# Detecta el XLSForm local disponible (base activa del estudio o cualquier
# archivo xlsform en el file store) sin leerlo. Barato: solo mira metadatos.
.carga_monitoreo_handoff_has_local_xlsform <- function(sid, s) {
  base <- NULL
  active_base <- tryCatch(estudio_active_base(sid), error = function(e) "")
  if (nzchar(.carga_chr1(active_base, ""))) {
    base <- (s$estudio$bases %||% list())[[active_base]] %||% NULL
  }
  if (is.null(base) && length(s$estudio$bases %||% list())) {
    base <- (s$estudio$bases %||% list())[[1]]
  }
  xlsform_id <- .carga_chr1(base$xlsform_file_id %||% base$original_xlsform_file_id, "")
  if (nzchar(xlsform_id)) {
    meta <- (s$files %||% list())[[xlsform_id]]
    if (!is.null(meta) && file.exists(.carga_chr1(meta$path, ""))) return(TRUE)
  }
  file_candidates <- Filter(function(meta) {
    identical(.carga_chr1(meta$kind, ""), "xlsform") && file.exists(.carga_chr1(meta$path, ""))
  }, s$files %||% list())
  length(file_candidates) > 0L
}

# Cuenta por universo a partir de `s$monitoreo_snapshot$data$validation_status`,
# detecta el asset Kobo heredado de Monitoreo territorial y arma el contrato de
# STATUS. No stagea archivos, no jala Kobo ni valida XLSForm: solo lecturas de
# metadatos en memoria y una lectura local del secreto (sin red).
.carga_monitoreo_handoff_status <- function(sid) {
  empty_counts <- list(processable = 0L, validada = 0L, revision = 0L,
                       no_defendible = 0L, total = 0L)
  empty_source <- list(label = "", phase = "", kobo_asset_uid = "",
                       instrument_source = "none", instrument_available = FALSE)
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) {
    return(list(
      ok = TRUE, detected = FALSE, universe = "processable",
      counts = empty_counts, source = empty_source,
      already_promoted = FALSE, base_nombre_sugerido = "Monitoreo territorial"
    ))
  }

  snapshot <- s$monitoreo_snapshot %||% NULL
  data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  status <- if (nrow(data) && "validation_status" %in% names(data)) {
    tolower(trimws(as.character(data$validation_status)))
  } else {
    character(0)
  }
  validada <- sum(status == "validada", na.rm = TRUE)
  revision <- sum(status == "revision", na.rm = TRUE)
  no_defendible <- sum(status == "no_defendible", na.rm = TRUE)
  processable <- validada + revision
  counts <- list(
    processable = as.integer(processable),
    validada = as.integer(validada),
    revision = as.integer(revision),
    no_defendible = as.integer(no_defendible),
    total = as.integer(nrow(data))
  )

  # Fuente del instrumento: reusa el detector de Kobo heredado de Monitoreo
  # (mismo patron que /platform/kobo/detected-source) y complementa con el
  # chequeo LOCAL de token (lectura de secreto, sin red).
  detected_kobo <- tryCatch(.carga_kobo_detected_source(sid), error = function(e) list(ok = FALSE, detected = FALSE))
  has_asset <- isTRUE(detected_kobo$detected) && nzchar(.carga_chr1(detected_kobo$asset_uid, ""))
  has_token <- FALSE
  if (has_asset) {
    has_token <- tryCatch(
      isTRUE(.connections_token_status(
        "kobo", sid,
        profile_id = detected_kobo$connection_profile_id %||% NULL,
        base_url = detected_kobo$base_url %||% NULL
      )$has_token),
      error = function(e) FALSE
    )
  }
  has_local_xlsform <- .carga_monitoreo_handoff_has_local_xlsform(sid, s)
  instrument_source <- if (has_asset && has_token) {
    "kobo_api"
  } else if (has_local_xlsform) {
    "local"
  } else {
    "none"
  }
  source <- list(
    label = .carga_chr1(detected_kobo$name %||% detected_kobo$source_title, ""),
    phase = .carga_chr1(detected_kobo$phase, ""),
    kobo_asset_uid = .carga_chr1(detected_kobo$asset_uid, ""),
    instrument_source = instrument_source,
    instrument_available = !identical(instrument_source, "none")
  )

  # already_promoted: existe una base con source_kind monitoreo_territorial, o
  # simplemente hay una base activa (Codificacion ya abriria con ese par).
  bases <- s$estudio$bases %||% list()
  has_territorial_base <- length(bases) > 0L && any(vapply(
    bases,
    function(b) identical(.carga_chr1(b$source_kind, ""), "monitoreo_territorial"),
    logical(1)
  ))
  active_base <- tryCatch(estudio_active_base(sid), error = function(e) "")
  already_promoted <- has_territorial_base ||
    (length(bases) > 0L && nzchar(.carga_chr1(active_base, "")))

  list(
    ok = TRUE,
    detected = processable > 0L,
    universe = "processable",
    counts = counts,
    source = source,
    already_promoted = already_promoted,
    base_nombre_sugerido = "Monitoreo territorial"
  )
}

# Promote delgado: delega en el helper congelado (que hace todo el trabajo de
# extraer instrumento fidedigno + data filtrada y persistir la base activa) y
# garantiza el flag `ok` en la respuesta.
.carga_monitoreo_handoff_promote <- function(sid, parsed = list()) {
  if (!is.list(parsed)) parsed <- list()
  result <- .monitoreo_processing_handoff_promote(sid, parsed)
  if (is.list(result) && is.null(result$ok)) result$ok <- TRUE
  result
}

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
      already_promoted = FALSE, existing_base = list(present = FALSE),
      base_nombre_sugerido = "Monitoreo territorial"
    ))
  }

  snapshot <- s$monitoreo_snapshot %||% NULL
  int0 <- function(x) {
    x <- suppressWarnings(as.integer(x %||% 0L))
    if (length(x) != 1L || is.na(x)) 0L else x
  }
  # El estado de validacion NO vive por fila en snapshot$data; lo calcula el motor
  # territorial. Los conteos ya resueltos estan cacheados en
  # `territorial_overview_facts` (espejo de la vista viva de Avance) y, en su
  # defecto, en los KPIs del ultimo tablero completo. Contar sobre snapshot$data
  # daria 0 (la columna no existe) y la tarjeta nunca apareceria.
  facts <- (snapshot %||% list())$territorial_overview_facts %||%
    (((snapshot %||% list())$dashboard %||% list())$territorial_reports %||% list())$kpis %||%
    list()
  validada <- int0(facts$validas)
  revision <- int0(facts$revision)
  no_defendible <- int0(facts$geo_no_defendible %||% facts$no_defendible)
  total_rows <- int0(facts$total_respuestas %||%
    (if (is.data.frame(snapshot$data)) nrow(snapshot$data) else 0L))
  processable <- validada + revision
  counts <- list(
    processable = as.integer(processable),
    validada = as.integer(validada),
    revision = as.integer(revision),
    no_defendible = as.integer(no_defendible),
    total = as.integer(total_rows)
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

  # already_promoted = el handoff YA se hizo (existe una base con source_kind
  # monitoreo_territorial). Un import crudo previo (source_kind != territorial) NO
  # cuenta: queremos seguir ofreciendo traer la version filtrada y reemplazarlo.
  bases <- s$estudio$bases %||% list()
  has_territorial_base <- length(bases) > 0L && any(vapply(
    bases,
    function(b) identical(.carga_chr1(b$source_kind, ""), "monitoreo_territorial"),
    logical(1)
  ))
  already_promoted <- has_territorial_base

  # existing_base: si ya hay una base (p.ej. un import crudo de 1697), la
  # reportamos para que la UI enmarque el traer como "reemplazar por la validada".
  active_base <- .carga_chr1(tryCatch(estudio_active_base(sid), error = function(e) ""), "")
  existing_base <- list(present = FALSE)
  if (length(bases) > 0L) {
    nm <- if (nzchar(active_base) && !is.null(bases[[active_base]])) active_base else names(bases)[[1]]
    b <- bases[[nm]]
    existing_base <- list(
      present = TRUE,
      nombre = nm,
      source_kind = .carga_chr1(b$source_kind, ""),
      is_territorial = identical(.carga_chr1(b$source_kind, ""), "monitoreo_territorial"),
      n_filas = int0(b$n_filas)
    )
  }

  list(
    ok = TRUE,
    detected = processable > 0L,
    universe = "processable",
    counts = counts,
    source = source,
    already_promoted = already_promoted,
    existing_base = existing_base,
    base_nombre_sugerido = "Monitoreo territorial"
  )
}

# Expande los repeat groups de la base madre recién promovida a bases hija
# vinculadas (ADR 0030 Fase 1). El promote vive en router_monitoreo.R (congelado),
# así que la expansión se engancha AQUÍ, después. El snapshot de Monitoreo
# preserva la columna blob del repeat (snapshot$data -> data_out -> base
# persistida, sin dropearla), así que la base madre trae el JSON del repeat como
# columna extra. Reusamos el mismo helper del path Kobo (carga_kobo_repeats.R)
# con las llaves canónicas ODK/Kobo.
#
# LIMITACIÓN (documentada): el promote congelado NO fija `_index` en la base
# madre, así que la hija enlaza al padre por su fallback canónico
# `_submission__id`↔`_id` (la base madre conserva `_id` de Kobo). El enlace
# preferente `_parent_index`↔`_index` se resolverá cuando la Fase 2 ensamble
# padre+hija; la hija ya porta ambas llaves.
.carga_monitoreo_handoff_register_repeats <- function(sid, base_nombre) {
  base_nombre <- .carga_chr1(base_nombre, "")
  if (!nzchar(base_nombre)) return(list())
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(list())
  base <- (s$estudio$bases %||% list())[[base_nombre]]
  if (is.null(base)) return(list())

  rp_inst <- (s$rp_inst_sources %||% list())[[base_nombre]] %||% NULL
  if (is.null(rp_inst)) {
    xls_meta <- (s$files %||% list())[[.carga_chr1(base$xlsform_file_id, "")]]
    if (is.null(xls_meta) || !file.exists(.carga_chr1(xls_meta$path, ""))) return(list())
    rp_inst <- tryCatch(reporte_instrumento(path = xls_meta$path), error = function(e) NULL)
  }
  if (is.null(rp_inst) || !length(.kobo_repeat_specs(rp_inst))) return(list())

  data_meta <- (s$files %||% list())[[.carga_chr1(base$data_file_id, "")]]
  if (is.null(data_meta) || !file.exists(.carga_chr1(data_meta$path, ""))) return(list())
  parent_df <- tryCatch(
    .read_data_any_path(data_meta$path, .carga_chr1(data_meta$ext, base$data_ext)),
    error = function(e) NULL
  )
  if (!is.data.frame(parent_df) || !nrow(parent_df)) return(list())

  # Sin ninguna columna blob de repeat presente en la data promovida no hay nada
  # que expandir (p.ej. si un export intermedio la hubiera dropeado).
  has_blob <- any(vapply(.kobo_repeat_specs(rp_inst), function(sp) {
    !is.null(.kobo_repeat_blob_column(parent_df, sp$name))
  }, logical(1)))
  if (!has_blob) return(list())

  downloads_dir <- file.path(s$dir, "downloads")
  dir.create(downloads_dir, recursive = TRUE, showWarnings = FALSE)
  .carga_kobo_register_repeat_bases(
    sid,
    data_df = parent_df,
    rp_inst = rp_inst,
    parent_base_name = base_nombre,
    title = base_nombre,
    downloads_dir = downloads_dir
  )
}

# Promote delgado: delega en el helper congelado (que hace todo el trabajo de
# extraer instrumento fidedigno + data filtrada y persistir la base activa) y
# garantiza el flag `ok` en la respuesta.
.carga_monitoreo_handoff_promote <- function(sid, parsed = list()) {
  if (!is.list(parsed)) parsed <- list()
  # Si no se especifica base y el estudio tiene UNA sola base (caso tipico: un
  # import crudo previo que quedo mal, p.ej. 1697 sin filtrar), reemplazamos ESA
  # base en sitio en vez de crear una "Monitoreo territorial" nueva y dejar la
  # cruda de basura. En multibase (>1) no clobbereamos: se agrega aparte.
  if (is.null(parsed$base_nombre %||% parsed$nombre)) {
    bases <- tryCatch(session_get(sid)$estudio$bases, error = function(e) NULL) %||% list()
    if (length(bases) == 1L) parsed$base_nombre <- names(bases)[[1]]
  }
  result <- .monitoreo_processing_handoff_promote(sid, parsed)
  if (is.list(result) && is.null(result$ok)) result$ok <- TRUE
  # ADR 0030 Fase 1: expandir repeats de la base madre promovida a bases hija.
  # tryCatch justificado: la base madre YA se promovió con éxito; un fallo al
  # expandir un repeat (asset raro, blob corrupto) no debe revertir el handoff
  # principal ni dejar el estudio sin su base validada. Se omite en silencio y la
  # base madre queda utilizable; la hija se reintenta en un próximo promote.
  result$child_bases <- tryCatch(
    .carga_monitoreo_handoff_register_repeats(sid, result$base_nombre %||% ""),
    error = function(e) list()
  )
  result
}

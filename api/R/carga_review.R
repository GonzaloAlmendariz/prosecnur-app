# Contrato autoritativo de Carga > Revisión.
#
# La revisión se recompone siempre desde el par instrumento-data persistido. Si
# el caller declara `base_nombre`, esa base gobierna lectura y escritura sin
# cambiar `active_base`; sin nombre se conserva el comportamiento legacy.

.carga_review_scope_state <- function(s, base_nombre = NULL) {
  if (is.null(base_nombre) || !nzchar(base_nombre)) {
    cfg <- s$analitica_config %||% list()
    return(list(
      incluidas = unique(.as_chr_vec(cfg$variables_extra_incluidas)),
      revisadas = unique(.as_chr_vec(cfg$variables_extra_revisadas))
    ))
  }

  base <- ((s$estudio %||% list())$bases %||% list())[[base_nombre]] %||% list()
  cfg <- (s$analitica_config_por_base %||% list())[[base_nombre]] %||% list()
  list(
    incluidas = unique(c(
      .as_chr_vec(base$variables_extra_incluidas),
      .as_chr_vec(cfg$variables_extra_incluidas)
    )),
    revisadas = unique(c(
      .as_chr_vec(base$variables_extra_revisadas),
      .as_chr_vec(cfg$variables_extra_revisadas)
    ))
  )
}

.carga_review_handoff_flag <- function(s, base_nombre = NULL) {
  if (is.null(base_nombre) || !nzchar(base_nombre)) return(FALSE)
  base <- ((s$estudio %||% list())$bases %||% list())[[base_nombre]] %||% list()
  source_kind <- as.character(base$source_kind %||% "")[1]
  !is.na(source_kind) && nzchar(source_kind) &&
    .base_hygiene_is_monitoreo_kind(source_kind)
}

.carga_review_primary_base_names <- function(s) {
  bases <- ((s %||% list())$estudio %||% list())$bases %||% list()
  names(bases)[vapply(bases, function(base) {
    parent_base <- as.character(base$parent_base %||% "")[1]
    source_kind <- tolower(as.character(base$source_kind %||% "")[1])
    (is.na(parent_base) || !nzchar(parent_base)) &&
      (is.na(source_kind) || !identical(source_kind, "kobo_repeat"))
  }, logical(1))]
}

.carga_review_compatibility <- function(data, instrumento) {
  raw <- .carga_compatibility_payload(data, instrumento)
  list(
    applied = isTRUE(raw$applied),
    ok = isTRUE(raw$ok),
    status = as.character(raw$status %||% "incompatible")[1],
    missing_columns = as.character(raw$missing_columns %||% character(0)),
    extra_columns = as.character(raw$extra_columns %||% character(0)),
    matched_columns = as.integer(raw$matched_columns %||% 0L),
    expected_columns = as.integer(raw$expected_columns %||% 0L),
    n_missing = as.integer(raw$n_missing %||% length(raw$missing_columns %||% character(0))),
    n_extra = as.integer(raw$n_extra %||% length(raw$extra_columns %||% character(0))),
    message = as.character(raw$message %||% "")[1]
  )
}

.carga_review_choice_mapping <- function(sid, data, base_nombre = NULL) {
  s <- session_get(sid)
  confirmed_state <- if (!is.null(base_nombre) && nzchar(base_nombre)) {
    (((s$estudio %||% list())$bases %||% list())[[base_nombre]] %||% list())$choice_code_mapping %||%
      list()
  } else {
    s$choice_code_maps_confirmed %||% list()
  }
  pending_state <- if (is.null(base_nombre) || !nzchar(base_nombre)) {
    s$choice_code_maps_pending %||% list()
  } else {
    list()
  }
  normalized <- .carga_choice_code_maps_payload(attr(data, "xlsform_normalized") %||% list())

  has_pending <- length(pending_state$maps %||% list()) > 0L &&
    !isTRUE(pending_state$confirmed)
  is_confirmed <- isTRUE(confirmed_state$confirmed) &&
    length(confirmed_state$maps %||% list()) > 0L
  requires_confirmation <- !is_confirmed &&
    (isTRUE(normalized$requires_confirmation) || has_pending)
  maps <- if (is_confirmed) {
    confirmed_state$maps
  } else if (isTRUE(normalized$applied)) {
    normalized$maps %||% list()
  } else if (has_pending) {
    pending_state$maps
  } else {
    list()
  }
  n_questions <- if (is_confirmed) {
    confirmed_state$n_questions %||% length(maps)
  } else if (has_pending) {
    pending_state$n_questions %||% length(pending_state$maps)
  } else if (isTRUE(normalized$applied)) {
    normalized$n_questions %||% length(normalized$maps %||% list())
  } else {
    0L
  }

  list(
    applied = is_confirmed || isTRUE(normalized$applied) || has_pending,
    status = if (requires_confirmation) "pending" else if (is_confirmed) "confirmed" else "not_required",
    pending = requires_confirmation,
    requires_confirmation = requires_confirmation,
    n_questions = as.integer(n_questions),
    maps = maps
  )
}

.carga_review_reconciliation <- function(extra_df, incluidas, revisadas) {
  validas <- as.character(extra_df$name %||% character(0))
  incluidas <- intersect(validas, incluidas)
  revisadas <- intersect(validas, unique(c(revisadas, incluidas)))

  extra <- lapply(seq_len(nrow(extra_df)), function(i) {
    nombre <- extra_df$name[[i]]
    decision <- if (nombre %in% incluidas) {
      "include"
    } else if (nombre %in% revisadas) {
      "exclude"
    } else {
      "pending"
    }
    list(
      name = nombre,
      fill_pct = as.numeric(extra_df$fill_pct[[i]]),
      n_fill = as.integer(extra_df$n_fill[[i]]),
      kind = as.character(extra_df$kind[[i]]),
      decision = decision
    )
  })
  decisions <- if (length(extra)) {
    vapply(extra, `[[`, character(1), "decision")
  } else {
    character(0)
  }

  list(
    extra = extra,
    n_extra = as.integer(length(extra)),
    n_incluidas = as.integer(sum(decisions == "include")),
    n_excluidas = as.integer(sum(decisions == "exclude")),
    n_pendientes = as.integer(sum(decisions == "pending")),
    reviewed = !any(decisions == "pending")
  )
}

# Traduce el hecho crudo a lo que la vista necesita mostrar. Devuelve NULL
# cuando no hay nada que avisar, para que el front no tenga que decidirlo.
.carga_review_procedencia <- function(data) {
  det <- tryCatch(detectar_versiones_formulario(data), error = function(e) NULL)
  if (is.null(det)) return(NULL)
  list(
    columna = det$columna,
    n_versiones = as.integer(det$n_versiones),
    n_casos_afectados = as.integer(det$n_casos_afectados),
    n_casos = as.integer(det$n_casos),
    version_vigente = det$vigente,
    versiones = det$versiones,
    mensaje = sprintf(
      paste("%d de %d casos se recolectaron con una versión anterior del formulario.",
            "Sus saltos y catálogos eran otros, así que lo que Validación reporte",
            "sobre ellos puede ser un artefacto de versión. Si el campo sigue abierto,",
            "conviene confirmar que todos hayan actualizado el formulario."),
      det$n_casos_afectados, det$n_casos
    )
  )
}

.carga_review_payload <- function(sid, base_nombre = NULL) {
  pair <- .carga_normalized_data_for_export(sid, base_nombre = base_nombre)
  s <- session_get(sid)
  scoped <- .carga_review_scope_state(s, pair$base_nombre)
  compatibility <- .carga_review_compatibility(pair$data, pair$instrumento)
  choice_mapping <- .carga_review_choice_mapping(sid, pair$data, pair$base_nombre)
  extra_df <- .reconciliacion_variables_extra(
    pair$data,
    pair$instrumento,
    monitoreo_handoff = .carga_review_handoff_flag(s, pair$base_nombre)
  )
  reconciliation <- .carga_review_reconciliation(
    extra_df,
    scoped$incluidas,
    scoped$revisadas
  )

  # Procedencia: si la base se recolectó con más de una versión del formulario,
  # se avisa acá y no solo en Validación. En Validación la base ya está armada;
  # en Carga todavía se puede parar el campo y hacer que actualicen el
  # formulario antes de seguir encuestando. NO entra en `ready`: es una
  # advertencia sobre cómo se recolectó, no un impedimento para cargar.
  procedencia <- .carga_review_procedencia(pair$data)

  list(
    base_nombre = pair$base_nombre,
    compatibility = compatibility,
    choice_mapping = choice_mapping,
    reconciliation = reconciliation,
    procedencia = procedencia,
    ready = isTRUE(compatibility$ok) &&
      !isTRUE(choice_mapping$requires_confirmation) &&
      !isTRUE(choice_mapping$pending) &&
      identical(reconciliation$n_pendientes, 0L)
  )
}

.carga_review_set_reconciliation <- function(sid,
                                              base_nombre = NULL,
                                              incluidas = character()) {
  current <- .carga_review_payload(sid, base_nombre = base_nombre)
  validas <- vapply(
    current$reconciliation$extra,
    `[[`,
    character(1),
    "name"
  )
  pedidas <- unique(.as_chr_vec(incluidas))
  desconocidas <- setdiff(pedidas, validas)
  if (length(desconocidas)) {
    stop_api(
      400,
      "E_RECON_VAR_DESCONOCIDA",
      sprintf(
        "No se pueden incluir variables que no son extra reconciliables de la base: %s.",
        paste(desconocidas, collapse = ", ")
      ),
      details = list(
        desconocidas = as.list(desconocidas),
        validas = as.list(validas)
      )
    )
  }

  incluidas_scope <- intersect(validas, pedidas)
  revisadas_scope <- validas
  s <- session_get(sid)
  resolved_base <- current$base_nombre
  if (!is.null(resolved_base) && nzchar(resolved_base)) {
    base <- s$estudio$bases[[resolved_base]]
    base$variables_extra_incluidas <- as.list(incluidas_scope)
    base$variables_extra_revisadas <- as.list(revisadas_scope)
    s$estudio$bases[[resolved_base]] <- base

    configs <- s$analitica_config_por_base
    if (is.null(configs) || !is.list(configs)) configs <- list()
    cfg <- configs[[resolved_base]]
    if (is.null(cfg) || !is.list(cfg)) cfg <- .analitica_default_config()
    cfg$variables_extra_incluidas <- as.list(incluidas_scope)
    cfg$variables_extra_revisadas <- as.list(revisadas_scope)
    configs[[resolved_base]] <- cfg
    s$analitica_config_por_base <- configs
  } else {
    cfg <- s$analitica_config
    if (is.null(cfg) || !is.list(cfg)) cfg <- .analitica_default_config()
    cfg$variables_extra_incluidas <- as.list(incluidas_scope)
    cfg$variables_extra_revisadas <- as.list(revisadas_scope)
    s$analitica_config <- cfg
  }
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s

  .carga_review_payload(sid, base_nombre = resolved_base)
}

.carga_review_confirm_choice_mapping <- function(sid, base_nombre = NULL) {
  s <- session_get(sid)
  bases <- ((s$estudio %||% list())$bases %||% list())
  requested <- as.character(base_nombre %||% "")[1]
  if (is.na(requested)) requested <- ""

  if (nzchar(requested) && is.null(bases[[requested]])) {
    stop_api(404, "E_BASE_NOT_FOUND", sprintf("Base '%s' no existe en el estudio.", requested))
  }
  if (!nzchar(requested) && length(bases)) {
    primarias <- .carga_review_primary_base_names(s)
    if (length(primarias) != 1L) {
      stop_api(
        400,
        "E_BASE_REQUIRED",
        "Indica base_nombre para confirmar el mapeo en un estudio con varias bases primarias."
      )
    }
    requested <- primarias[[1]]
  }

  scope <- if (nzchar(requested)) requested else NULL
  current <- .carga_review_payload(sid, base_nombre = scope)
  if (identical(current$choice_mapping$status, "confirmed")) return(current)
  maps <- current$choice_mapping$maps %||% list()
  if (!length(maps)) return(current)

  confirmed_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  mapping <- list(
    version = 1L,
    confirmed = TRUE,
    confirmed_at = confirmed_at,
    n_questions = as.integer(current$choice_mapping$n_questions %||% length(maps)),
    maps = maps
  )
  s <- session_get(sid)
  if (!is.null(scope)) {
    s$estudio$bases[[scope]]$choice_code_mapping <- mapping
    s <- .mark_project_dirty(s)
    .session_env[[sid]] <- s
  } else {
    .carga_store_choice_code_maps(
      sid,
      list(
        applied = TRUE,
        requires_confirmation = FALSE,
        n_questions = mapping$n_questions,
        maps = maps
      ),
      confirmed = TRUE
    )
  }

  .carga_review_payload(sid, base_nombre = scope)
}

.carga_review_blockers <- function(review) {
  blockers <- character(0)
  if (!isTRUE(review$compatibility$applied)) blockers <- c(blockers, "pair_unavailable")
  if (isTRUE(review$compatibility$applied) && !isTRUE(review$compatibility$ok)) {
    blockers <- c(blockers, "incompatible")
  }
  if (isTRUE(review$choice_mapping$requires_confirmation) ||
      isTRUE(review$choice_mapping$pending)) {
    blockers <- c(blockers, "choice_mapping_pending")
  }
  if (as.integer(review$reconciliation$n_pendientes %||% 0L) > 0L) {
    blockers <- c(blockers, "extras_pending")
  }
  unique(blockers)
}

.carga_review_summary_payload <- function(sid) {
  s <- session_get(sid)
  primarias <- .carga_review_primary_base_names(s)
  items <- lapply(primarias, function(base_nombre) {
    review <- tryCatch(
      .carga_review_payload(sid, base_nombre = base_nombre),
      error = function(e) NULL
    )
    blockers <- if (is.null(review)) "pair_unavailable" else .carga_review_blockers(review)
    list(
      base_nombre = base_nombre,
      ready = !length(blockers),
      blockers = blockers
    )
  })
  n_ready <- as.integer(sum(vapply(items, function(item) isTRUE(item$ready), logical(1))))
  n_bases <- as.integer(length(items))
  list(
    bases = items,
    n_bases = n_bases,
    n_ready = n_ready,
    n_blocked = as.integer(n_bases - n_ready),
    all_ready = n_bases > 0L && identical(n_ready, n_bases)
  )
}

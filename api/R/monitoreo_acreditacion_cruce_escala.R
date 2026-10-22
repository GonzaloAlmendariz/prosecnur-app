# Cruce de Monitoreo (acreditación y telefónico) a escala de universos grandes.
#
# Extraído de `monitoreo_engine.R`, que está congelado a crecimiento. Estas
# funciones eran cuadráticas en el tamaño del universo y con 45 mil contactos
# (Acreditación Institucional PUCP 2026) el cruce tardaba media hora y el
# tablero, horas. Diagnóstico y medidas en
# `docs/qa/diagnostico-monitoreo-acred-institucional-2026-10-22.md`.
#
# El resultado es el mismo que antes, con un solo cambio de forma: la lista de
# personas del universo a las que se puede asignar a mano una respuesta ya no
# se copia en cada caso. Viaja una vez por actor en
# `internal_queries$assignment_pool` y cada caso la nombra con
# `assisted_review$assignment_pool_key`. El normalizador del front
# (`normalizeInternalQueries`) y la validación del servidor
# (`.monitoreo_acreditacion_apply_case_reconciliation`) la vuelven a unir.

# --- Revisión asistida -------------------------------------------------------

# Contexto que se arma una vez por cruce: índice llave → personas del universo,
# actor de cada persona y, a pedido, el candidato «sin evidencia» de cada una.
.monitoreo_revision_asistida_contexto <- function(base_records = list(), answered_base_keys = character(0)) {
  ctx <- new.env(parent = emptyenv())
  ctx$base_records <- base_records
  ctx$answered_base_keys <- answered_base_keys
  ctx$actor_keys <- vapply(base_records, function(base) .monitoreo_text_key(base$actor %||% ""), character(1))
  ctx$key_index <- new.env(hash = TRUE, parent = emptyenv())
  for (i in seq_along(base_records)) {
    keys <- unique(unlist(base_records[[i]]$all_keys %||% list(), use.names = FALSE))
    for (key in keys[nzchar(keys) & !is.na(keys)]) {
      ctx$key_index[[key]] <- c(ctx$key_index[[key]], i)
    }
  }
  ctx$genericos <- new.env(hash = TRUE, parent = emptyenv())
  ctx$pools <- new.env(hash = TRUE, parent = emptyenv())
  ctx
}

.monitoreo_revision_asistida_pool_key <- function(actor_key) {
  if (nzchar(actor_key)) actor_key else "_todos"
}

.monitoreo_revision_asistida_actor_idx <- function(ctx, actor_key) {
  if (!nzchar(actor_key)) return(seq_along(ctx$base_records))
  which(ctx$actor_keys == actor_key)
}

.monitoreo_revision_asistida_generico <- function(ctx, i) {
  slot <- as.character(i)
  hit <- ctx$genericos[[slot]]
  if (!is.null(hit)) return(hit)
  base <- ctx$base_records[[i]]
  evidence <- .monitoreo_internal_assignment_evidence(base)
  candidate <- .monitoreo_internal_base_candidate(
    base,
    ctx$answered_base_keys,
    match_type = evidence$match_type,
    match_label = evidence$match_label,
    suggested = FALSE,
    evidence_level = evidence$evidence_level,
    evidence_label = evidence$evidence_label,
    evidence_score = evidence$evidence_score,
    evidence_fields = evidence$evidence_fields
  )
  ctx$genericos[[slot]] <- candidate
  candidate
}

# Personas del universo del actor a las que se puede asignar una respuesta:
# las que no tienen ya una respuesta reconciliada, una por candidate_id, en el
# orden de la base. Se arma una vez por actor y la comparten todos sus casos.
.monitoreo_revision_asistida_pool_actor <- function(ctx, actor_key) {
  pool_key <- .monitoreo_revision_asistida_pool_key(actor_key)
  hit <- ctx$pools[[pool_key]]
  if (!is.null(hit)) return(hit)
  out <- list()
  seen <- new.env(hash = TRUE, parent = emptyenv())
  for (i in .monitoreo_revision_asistida_actor_idx(ctx, actor_key)) {
    candidate <- .monitoreo_revision_asistida_generico(ctx, i)
    candidate_id <- .monitoreo_scalar(candidate$candidate_id, "")
    if (!nzchar(candidate_id) || !is.null(seen[[candidate_id]])) next
    seen[[candidate_id]] <- TRUE
    if (isTRUE(candidate$already_effective)) next
    out[[length(out) + 1L]] <- candidate
  }
  ctx$pools[[pool_key]] <- out
  out
}

.monitoreo_revision_asistida_pool <- function(ctx) {
  if (is.null(ctx)) return(list())
  keys <- sort(ls(ctx$pools, all.names = TRUE))
  stats::setNames(lapply(keys, function(key) ctx$pools[[key]]), keys)
}

.monitoreo_internal_assisted_review <- function(evidence = list(),
                                                response_actor = "",
                                                response_id = "",
                                                response_state = "",
                                                result = "",
                                                base_records = list(),
                                                answered_base_keys = character(0),
                                                current_base = NULL,
                                                profile = list(),
                                                contexto = NULL) {
  manual <- .monitoreo_reconciliation_manual_decision(profile, response_id)
  state_key <- .monitoreo_text_key(response_state)
  result_key <- .monitoreo_text_key(result)
  eligible_state <- state_key %in% c("completa", "parcial", "rechazo")
  current_partial_base <- !is.null(current_base) &&
    identical(state_key, "parcial") &&
    grepl("^cruzo", result_key)
  eligible <- isTRUE(eligible_state) &&
    (!identical(result, "Cruzó") || !is.null(manual) || isTRUE(current_partial_base))
  declared_code <- .monitoreo_scalar(evidence$declared_code, "")
  declared_email <- .monitoreo_scalar(evidence$declared_email, "")
  declared_name <- .monitoreo_scalar(evidence$declared_name, "")
  primary_key <- .monitoreo_scalar(evidence$primary_key, "")
  if (!isTRUE(eligible) && is.null(manual)) return(NULL)

  ctx <- contexto %||% .monitoreo_revision_asistida_contexto(base_records, answered_base_keys)
  email_key <- .monitoreo_email_key(declared_email)
  email_keys <- if (nzchar(email_key)) paste0("email:", email_key) else character(0)
  code_keys <- .monitoreo_code_keys(declared_code)
  actor_key <- .monitoreo_text_key(response_actor)
  actor_idx <- .monitoreo_revision_asistida_actor_idx(ctx, actor_key)
  # Las personas que comparten una llave con lo declarado, en el orden de la base.
  key_idx <- sort(unique(unlist(lapply(c(email_keys, code_keys), function(key) ctx$key_index[[key]]), use.names = FALSE)))
  key_idx <- key_idx[key_idx %in% actor_idx]

  candidates <- list()
  seen <- character(0)
  current_partial_candidate <- NULL
  if (isTRUE(current_partial_base)) {
    current_partial_candidate <- .monitoreo_internal_base_candidate(
      current_base,
      ctx$answered_base_keys,
      match_type = "partial_current_case",
      match_label = "Parcial cruzada a base oficial",
      suggested = TRUE,
      evidence_level = "manual",
      evidence_label = "Validación manual requerida",
      evidence_score = 80L,
      evidence_fields = c("platform_state", "case_key"),
      already_answered = FALSE
    )
    candidate_id <- .monitoreo_scalar(current_partial_candidate$candidate_id, "")
    if (nzchar(candidate_id)) {
      candidates[[length(candidates) + 1L]] <- current_partial_candidate
      seen <- c(seen, candidate_id)
    }
  }
  evidence_for <- function(base) {
    .monitoreo_internal_assignment_evidence(
      base,
      email_keys = email_keys,
      code_keys = code_keys,
      declared_email = declared_email,
      declared_code = declared_code,
      declared_name = declared_name
    )
  }
  for (i in key_idx) {
    base <- ctx$base_records[[i]]
    candidate_id <- .monitoreo_internal_candidate_id(base)
    if (candidate_id %in% seen) next
    seen <- c(seen, candidate_id)
    ev <- evidence_for(base)
    candidates[[length(candidates) + 1L]] <- .monitoreo_internal_base_candidate(
      base,
      ctx$answered_base_keys,
      match_type = ev$match_type,
      match_label = ev$match_label,
      suggested = TRUE,
      evidence_level = ev$evidence_level,
      evidence_label = ev$evidence_label,
      evidence_score = ev$evidence_score,
      evidence_fields = ev$evidence_fields
    )
  }

  # Candidatos de asignación propios del caso: la parcial en curso y quienes
  # tienen evidencia (llave exacta o, si se declaró correo o nombre, parecido).
  # El resto del universo del actor es igual para todos sus casos y va al pool.
  assignment_candidates <- list()
  assignment_seen <- character(0)
  if (!is.null(current_partial_candidate)) {
    candidate_id <- .monitoreo_scalar(current_partial_candidate$candidate_id, "")
    if (nzchar(candidate_id)) {
      assignment_candidates[[length(assignment_candidates) + 1L]] <- current_partial_candidate
      assignment_seen <- c(assignment_seen, candidate_id)
    }
  }
  fuzzy <- nzchar(email_key) || nzchar(.monitoreo_text_key(declared_name))
  evidence_idx <- if (isTRUE(fuzzy)) actor_idx else key_idx
  for (i in evidence_idx) {
    base <- ctx$base_records[[i]]
    ev <- evidence_for(base)
    if (identical(ev$evidence_level, "manual")) next
    candidate <- .monitoreo_internal_base_candidate(
      base,
      ctx$answered_base_keys,
      match_type = ev$match_type,
      match_label = ev$match_label,
      suggested = FALSE,
      evidence_level = ev$evidence_level,
      evidence_label = ev$evidence_label,
      evidence_score = ev$evidence_score,
      evidence_fields = ev$evidence_fields
    )
    candidate_id <- .monitoreo_scalar(candidate$candidate_id, "")
    if (!nzchar(candidate_id) || candidate_id %in% assignment_seen) next
    assignment_seen <- c(assignment_seen, candidate_id)
    if (isTRUE(candidate$already_effective)) next
    assignment_candidates[[length(assignment_candidates) + 1L]] <- candidate
  }
  pool_key <- .monitoreo_revision_asistida_pool_key(actor_key)
  .monitoreo_revision_asistida_pool_actor(ctx, actor_key)

  warnings <- character(0)
  has_email_candidate <- any(vapply(candidates, function(item) grepl("email", .monitoreo_scalar(item$match_type, ""), fixed = TRUE), logical(1)))
  has_name_candidate <- any(vapply(candidates, function(item) grepl("name", .monitoreo_scalar(item$match_type, ""), fixed = TRUE), logical(1)))
  if (has_email_candidate && grepl("sin cruce|sin llave", result_key)) {
    warnings <- c(warnings, "La llave principal no cruza con la base, pero el correo declarado sí cruza con una persona del universo.")
  }
  if (has_name_candidate && grepl("sin cruce|sin llave", result_key)) {
    warnings <- c(warnings, "La llave principal no cruza con la base, pero el nombre declarado es compatible con una persona del universo.")
  }
  for (candidate in candidates) {
    if (!grepl("email", .monitoreo_scalar(candidate$match_type, ""), fixed = TRUE) || !nzchar(declared_code)) next
    official_code <- .monitoreo_scalar(candidate$case_key, "")
    if (nzchar(official_code) && !any(.monitoreo_code_keys(declared_code) %in% .monitoreo_code_keys(official_code))) {
      warnings <- c(warnings, "El código declarado no coincide con el código de la persona encontrada por correo.")
      break
    }
  }
  has_pending_evidence <- any(vapply(assignment_candidates, function(item) {
    .monitoreo_scalar(item$evidence_level, "") %in% c("exact", "possible")
  }, logical(1)))
  if (!length(candidates) && !isTRUE(has_pending_evidence) && (nzchar(declared_code) || nzchar(declared_email) || nzchar(declared_name) || nzchar(primary_key))) {
    warnings <- c(warnings, "No se encontró coincidencia por código, correo ni nombre en el universo.")
  }
  if (isTRUE(has_pending_evidence)) {
    warnings <- c(warnings, "Hay personas pendientes del universo con correo, código o nombre compatible; revisa estos casos antes de publicar la lista de no respuesta.")
  }

  list(
    eligible = TRUE,
    primary_key = primary_key,
    declared_code = declared_code,
    declared_email = declared_email,
    declared_name = declared_name,
    candidates = candidates,
    assignment_candidates = assignment_candidates,
    assignment_pool_key = pool_key,
    warnings = as.list(unique(warnings)),
    manual_decision = manual %||% NULL
  )
}

# Candidatos de asignación completos de un caso: los propios y los del pool de
# su actor, sin repetir candidate_id (gana el propio, que trae la evidencia).
.monitoreo_revision_asistida_candidatos_caso <- function(assisted = list(), pool = list()) {
  own <- assisted$assignment_candidates %||% list()
  shared <- pool[[.monitoreo_scalar(assisted$assignment_pool_key, "")]] %||% list()
  if (!length(shared)) return(own)
  own_ids <- vapply(own, function(item) .monitoreo_scalar(item$candidate_id, ""), character(1))
  shared_ids <- vapply(shared, function(item) .monitoreo_scalar(item$candidate_id, ""), character(1))
  c(own, shared[!shared_ids %in% own_ids])
}

# --- Tablas de casos ---------------------------------------------------------

# Un caso del cruce: los mismos argumentos que llevaba `data.frame(...)`, sin
# pagar un data.frame por fila (con 45 mil personas en el universo era el 37 %
# del cruce). Si algún valor no es de largo 1 cae al data.frame, que falla
# igual que antes.
.monitoreo_internal_case_row <- function(..., check.names = FALSE, stringsAsFactors = FALSE) {
  row <- list(...)
  if (!all(lengths(row) == 1L)) return(data.frame(..., check.names = check.names, stringsAsFactors = stringsAsFactors))
  class(row) <- c("monitoreo_case_row", "list")
  row
}

# Misma salida que `do.call(rbind, <data.frames de una fila>)`, armada por
# columnas: el rbind de miles de filas sueltas era la mitad del costo del cruce.
.monitoreo_internal_records_to_df <- function(rows) {
  if (!length(rows)) return(data.frame())
  rows <- lapply(rows, function(row) {
    if (is.data.frame(row) || inherits(row, "monitoreo_case_row")) {
      return(lapply(stats::setNames(seq_along(row), names(row)), function(j) {
        value <- row[[j]]
        if (is.list(value)) I(value) else value
      }))
    }
    if (is.list(row) && length(row)) {
      row <- lapply(row, function(value) {
        if (is.null(value) || length(value) == 0L) return("")
        if (is.list(value) && !is.data.frame(value)) return(I(list(value)))
        if (length(value) != 1L) return(I(list(value)))
        value
      })
    }
    row
  })
  cols <- names(rows[[1L]])
  for (row in rows) {
    if (length(row) != length(cols) || !all(names(row) %in% cols)) {
      stop("names do not match previous names", call. = FALSE)
    }
  }
  out <- lapply(stats::setNames(cols, cols), function(col) {
    values <- lapply(rows, function(row) row[[col]])
    if (any(vapply(values, is.list, logical(1)))) {
      return(I(lapply(values, function(value) if (is.list(value)) value[[1L]] else value)))
    }
    unlist(values, use.names = FALSE)
  })
  out <- as.data.frame(out, check.names = FALSE, stringsAsFactors = FALSE)
  rownames(out) <- NULL
  out
}

# Tamaño del grupo de cada elemento (cuántas veces aparece su llave).
.monitoreo_internal_group_size <- function(keys) {
  keys <- as.character(keys)
  counts <- rep(1L, length(keys))
  valid <- nzchar(keys) & !is.na(keys)
  if (any(valid)) {
    tab <- table(keys[valid])
    counts[valid] <- as.integer(tab[keys[valid]])
  }
  counts
}

.monitoreo_internal_case_priorities <- function(cases_df) {
  n <- nrow(cases_df)
  if (!n) return(numeric(0))
  col <- function(name) {
    value <- cases_df[[name]]
    if (is.null(value)) return(rep("", n))
    value <- vapply(seq_len(n), function(i) .monitoreo_scalar(value[[i]], ""), character(1))
    value[is.na(value)] <- ""
    value
  }
  advancement <- col("advancement")
  state <- .monitoreo_text_key(col("platform_state"))
  base <- unname(c(effective = 50, included_review = 40, partial = 30, refusal = 20, pending = 8, excluded = 10)[advancement])
  base[is.na(base)] <- 1
  base[state == "completa"] <- pmax(base[state == "completa"], 45)
  base[state == "parcial"] <- pmax(base[state == "parcial"], 30)
  base[state == "rechazo"] <- pmax(base[state == "rechazo"], 20)
  dates <- col("date")
  unique_dates <- unique(dates)
  bonus <- vapply(unique_dates, function(value) {
    parsed <- suppressWarnings(tryCatch(as.Date(value), error = function(e) as.Date(NA)))
    if (!is.na(parsed)) -as.integer(parsed - as.Date("1970-01-01")) / 100000 else -1
  }, numeric(1))
  base + unname(bonus[match(dates, unique_dates)])
}

.monitoreo_internal_deduplicate_cases <- function(cases_df) {
  if (is.null(cases_df) || !is.data.frame(cases_df) || !nrow(cases_df)) return(cases_df)
  dedupe_key <- as.character(cases_df$case_key %||% "")
  actor_key <- vapply(as.character(cases_df$actor %||% ""), .monitoreo_report_unit_key, character(1))
  actor_key[!nzchar(actor_key) | is.na(actor_key)] <- "sin_actor"
  dedupe_key <- ifelse(nzchar(dedupe_key) & !is.na(dedupe_key), paste(actor_key, dedupe_key, sep = "\r"), dedupe_key)
  fallback <- as.character(cases_df$response_id %||% rep("", nrow(cases_df)))
  response_row <- as.character(cases_df$response_row %||% rep("", nrow(cases_df)))
  state_key <- vapply(as.character(cases_df$platform_state %||% ""), .monitoreo_text_key, character(1))
  missing <- !nzchar(dedupe_key) | is.na(dedupe_key)
  has_response_id <- missing & nzchar(fallback) & !is.na(fallback)
  dedupe_key[has_response_id] <- paste(actor_key[has_response_id], "response", fallback[has_response_id], sep = "\r")
  missing <- !nzchar(dedupe_key) | is.na(dedupe_key)
  has_response_row <- missing & nzchar(response_row) & !is.na(response_row)
  dedupe_key[has_response_row] <- paste(actor_key[has_response_row], "response_row", response_row[has_response_row], sep = "\r")
  missing <- !nzchar(dedupe_key) | is.na(dedupe_key)
  dedupe_key[missing] <- paste(actor_key[missing], "event", state_key[missing], seq_len(nrow(cases_df))[missing], sep = "\r")
  priorities <- .monitoreo_internal_case_priorities(cases_df)
  # Por llave gana la prioridad más alta y, a igual prioridad, la primera fila
  # (lo mismo que `which.max` dentro de cada grupo).
  ord <- order(dedupe_key, -priorities, seq_along(priorities), method = "radix")
  keep <- logical(nrow(cases_df))
  keep[ord[!duplicated(dedupe_key[ord])]] <- TRUE
  cases_df[keep, , drop = FALSE]
}

# --- Tablas para hojas y reportes -------------------------------------------

# Llave de unidad (actor) de una etiqueta. Se pide fila por fila sobre todos los
# casos y la base —decenas de miles de veces por tablero— para un puñado de
# valores distintos: se memoiza por valor, como `.monitoreo_safe_name`.
.monitoreo_report_unit_key_cache <- new.env(hash = TRUE, parent = emptyenv())

.monitoreo_report_unit_key <- function(x) {
  key <- as.character(x %||% "")
  if (length(key) != 1L || is.na(key) || !nzchar(key)) return(.monitoreo_safe_name(.monitoreo_report_source_unit(x)))
  hit <- .monitoreo_report_unit_key_cache[[key]]
  if (!is.null(hit)) return(hit)
  res <- .monitoreo_safe_name(.monitoreo_report_source_unit(key))
  assign(key, res, envir = .monitoreo_report_unit_key_cache)
  res
}

# Un data.frame como lista de registros, con NA convertido en "". Era fila por
# fila (`as.list(df[i, ])`) y con el universo completo costaba un cuarto del
# cruce. Los vectores simples se convierten de una vez; factores, fechas y
# columnas lista conservan la extracción original por fila.
.monitoreo_report_records <- function(df) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(list())
  n <- nrow(df)
  if (!ncol(df)) return(lapply(seq_len(n), function(i) as.list(df[i, , drop = FALSE])))
  por_columna <- lapply(df, function(col) {
    if (is.atomic(col) && is.null(attributes(col))) {
      out <- as.list(col)
      out[is.na(col)] <- list("")
      return(out)
    }
    lapply(seq_len(n), function(i) {
      x <- col[i]
      if (length(x) && !is.na(x[1])) x[[1]] else ""
    })
  })
  purrr::transpose(por_columna)
}


.monitoreo_workbook_df <- function(x) {
  if (is.null(x)) return(data.frame())
  if (is.data.frame(x)) {
    out <- x
    for (nm in names(out)) {
      if (is.list(out[[nm]])) {
        out[[nm]] <- vapply(out[[nm]], .monitoreo_workbook_cell_value, character(1))
      }
    }
    rownames(out) <- NULL
    return(out)
  }
  if (!is.list(x)) {
    return(data.frame(Valor = .monitoreo_workbook_cell_value(x), check.names = FALSE, stringsAsFactors = FALSE))
  }
  if (!length(x)) return(data.frame())
  if (!is.null(names(x)) && !all(vapply(x, is.list, logical(1)))) {
    return(data.frame(
      Campo = names(x),
      Valor = vapply(x, .monitoreo_workbook_cell_value, character(1)),
      check.names = FALSE,
      stringsAsFactors = FALSE
    ))
  }
  rows <- lapply(x, function(row) {
    if (is.data.frame(row)) row <- as.list(row[1, , drop = FALSE])
    if (!is.list(row)) row <- list(Valor = row)
    row
  })
  cols <- unique(unlist(lapply(rows, names), use.names = FALSE))
  cols <- cols[nzchar(cols)]
  if (!length(cols)) cols <- "Valor"
  # Por columnas en vez de un data.frame por fila y un rbind: misma tabla, de
  # caracteres, en tiempo lineal.
  out <- lapply(stats::setNames(cols, cols), function(col) {
    vapply(rows, function(row) .monitoreo_workbook_cell_value(row[[col]]), character(1), USE.NAMES = FALSE)
  })
  out <- as.data.frame(out, check.names = FALSE, stringsAsFactors = FALSE)
  names(out) <- cols
  rownames(out) <- NULL
  out
}

# --- Transporte al navegador -------------------------------------------------

# Una lista de registros en columnas. Los campos escalares van por diccionario
# (`niveles` + `codigos`, base 0): la mayoría de los casos son personas del
# universo aún pendientes, con los mismos textos de decisión y regla, y como
# objetos sueltos pesaban 1.7 KB cada uno (165 MB a 45 mil contactos). Los
# campos anidados (`assisted_review`, `phone_audit`) viajan tal cual.
.monitoreo_transporte_columnas <- function(records) {
  records <- Filter(is.list, records %||% list())
  n <- length(records)
  campos <- unique(unlist(lapply(records, names), use.names = FALSE))
  # `transpose` (C) pasa de n registros a un vector por campo de una vez.
  por_campo <- if (n) purrr::transpose(records, .names = campos) else list()
  columnas <- lapply(stats::setNames(campos, campos), function(campo) {
    valores <- por_campo[[campo]] %||% vector("list", n)
    largos <- lengths(valores)
    nulos <- largos == 0L & vapply(valores, is.null, logical(1))
    escalar <- nulos | (largos == 1L & vapply(valores, is.atomic, logical(1)))
    tipos <- unique(vapply(valores[!nulos], function(v) class(v)[[1L]], character(1)))
    if (all(escalar) && length(tipos) <= 1L && (!length(tipos) || tipos %in% c("character", "numeric", "integer", "logical"))) {
      if (any(nulos)) valores[nulos] <- list(NA)
      plano <- if (length(tipos)) unlist(valores, use.names = FALSE) else rep(NA, n)
      niveles <- unique(plano)
      return(list(niveles = I(niveles), codigos = I(match(plano, niveles) - 1L)))
    }
    list(valores = I(valores))
  })
  list(formato = "columnas_v1", n = n, campos = columnas)
}

# `case_rollup` son filas de `cases` (deduplicadas y en base): viajan como
# índices, base 0. Si alguna no calza idéntica, se manda en columnas.
.monitoreo_transporte_indices <- function(subset, records) {
  subset <- subset %||% list()
  if (!length(subset)) return(list(formato = "indices_v1", indices = I(integer(0))))
  llave <- function(rec) paste(rec$actor %||% "", rec$response_id %||% "", rec$case_key %||% "", rec$response_row %||% "", rec$base_record %||% "", sep = "\r")
  pos <- match(vapply(subset, llave, character(1)), vapply(records, llave, character(1)))
  if (anyNA(pos) || !all(vapply(seq_along(subset), function(i) identical(subset[[i]], records[[pos[[i]]]]), logical(1)))) {
    return(.monitoreo_transporte_columnas(subset))
  }
  list(formato = "indices_v1", indices = I(pos - 1L))
}

.monitoreo_internal_queries_para_cliente <- function(internal_queries) {
  if (!is.list(internal_queries) || !is.list(internal_queries$cases) || !length(internal_queries$cases)) return(internal_queries)
  out <- internal_queries
  out$case_rollup <- .monitoreo_transporte_indices(internal_queries$case_rollup, internal_queries$cases)
  out$cases <- .monitoreo_transporte_columnas(internal_queries$cases)
  if (length(internal_queries$assignment_pool)) {
    out$assignment_pool <- lapply(internal_queries$assignment_pool, .monitoreo_transporte_columnas)
  }
  out
}

# Lo que sale al navegador del tablero de acreditación o telefónico: la
# reparación de caché y el transporte compacto de las consultas internas. Sólo
# para la respuesta; la caché de sesión y los motores siguen con registros.
.monitoreo_acreditacion_dashboard_para_cliente <- function(dashboard) {
  dashboard <- .monitoreo_acreditacion_repair_cached_dashboard(dashboard)
  if (!is.list(dashboard) || !is.list(dashboard$acreditacion_reports)) return(dashboard)
  dashboard$acreditacion_reports$internal_queries <- .monitoreo_internal_queries_para_cliente(dashboard$acreditacion_reports$internal_queries)
  dashboard
}

# Celdas historicas conjuntas y vista de anclas para criterios. Solo trabaja
# con agregados; ninguna salida contiene la llave historica de curso-horario.

.cm_asist_criterios_schema <- "calc_muestra_referencia_asistencia_celdas_v1"
.cm_criterios_anclas_schema <- "calc_muestra_criterios_anclas_historicas_v1"

.cm_asist_size_definitions <- function(values) {
  list(
    list(key = "T1", label = "Menos de 15", order = 1L, mask = values < 15),
    list(key = "T2", label = "15 a 24", order = 2L, mask = values >= 15 & values <= 24),
    list(key = "T3", label = "25 a 39", order = 3L, mask = values >= 25 & values <= 39),
    list(key = "T4", label = "40 a 59", order = 4L, mask = values >= 40 & values <= 59),
    list(key = "T5", label = "60 o mas", order = 5L, mask = values >= 60)
  )
}

.cm_asist_joint_categories <- function(values) {
  raw <- trimws(as.character(values))
  raw[is.na(raw)] <- ""
  keys <- .cm_criterios_fac_key(raw)
  keys[!nzchar(keys)] <- "sin_dato"
  lapply(seq_along(unique(keys)), function(i) {
    key <- unique(keys)[[i]]
    idx <- which(keys == key)
    list(
      key = key,
      label = if (identical(key, "sin_dato")) "Sin dato" else .cm_aulas_mode(raw[idx], key),
      order = as.integer(i),
      mask = keys == key
    )
  })
}

.cm_asist_joint_dimensions <- function(model) {
  list(
    list(
      key = "tamano", label = "Tamano del curso-horario", order = 1L,
      cells = .cm_asist_size_definitions(model$matriculados)
    ),
    list(
      key = "rango_horario", label = "Rango horario", order = 2L,
      cells = .cm_asist_joint_categories(model$rango_horario)
    ),
    list(
      key = "tipo_sesion", label = "Tipo de sesion", order = 3L,
      cells = .cm_asist_joint_categories(model$tipo_sesion)
    )
  )
}

.cm_asist_joint_faculties <- function(model) {
  raw <- trimws(as.character(model$facultad))
  raw[is.na(raw)] <- ""
  keys <- .cm_criterios_fac_key(raw)
  keys[!nzchar(keys)] <- "sin_dato"
  lapply(unique(keys), function(key) {
    idx <- which(keys == key)
    list(
      key = key,
      label = if (identical(key, "sin_dato")) "Sin dato" else .cm_aulas_mode(raw[idx], key),
      mask = keys == key
    )
  })
}

.cm_asist_joint_row <- function(faculty, dimension, cell, model,
                                 bootstrap_n, global) {
  idx <- which(faculty$mask & cell$mask)
  stats <- .cm_asist_cell(
    cell$key, cell$label, cell$order,
    model$matriculados[idx], model$asistentes[idx], bootstrap_n, global
  )
  list(
    faculty_key = faculty$key,
    faculty_label = faculty$label,
    dimension_key = dimension$key,
    dimension_label = dimension$label,
    cell_key = stats$celda_key,
    cell_label = stats$celda_label,
    order = stats$orden,
    k = stats$k,
    matriculados = stats$matriculados,
    asistentes = stats$asistentes,
    tasa = stats$tasa,
    media_ch = stats$media_ch,
    sd_ch = stats$sd_ch,
    ic_low = stats$ic_low,
    ic_high = stats$ic_high,
    metodo_ic = stats$metodo_ic,
    suficiencia = stats$suficiencia,
    tasa_publicada = stats$tasa_publicada,
    k_publicada = stats$k_publicada,
    fuente_publicada = stats$fuente_publicada
  )
}

calc_muestra_asistencia_criterios_celdas <- function(
    model, estudio, bootstrap_n, global) {
  faculties <- .cm_asist_joint_faculties(model)
  dimensions <- .cm_asist_joint_dimensions(model)
  rows <- list()
  for (faculty in faculties) {
    for (dimension in dimensions) {
      for (cell in dimension$cells) {
        rows[[length(rows) + 1L]] <- .cm_asist_joint_row(
          faculty, dimension, cell, model, bootstrap_n, global
        )
      }
    }
  }
  root <- list(
    schema = .cm_asist_criterios_schema,
    owner = "estudio_historico_externo.celdas_criterios",
    momento = "post_hoc_estudio_previo",
    combinable = FALSE,
    unit = "curso_horario_aplicado",
    denominator = "matriculados_totales",
    faculty_dimension = "facultad_historica",
    reference_hash = "",
    estudio = .cm_asist_study(estudio),
    rows = rows
  )
  root$reference_hash <- .cm_aulas_hash(root[names(root) != "reference_hash"])
  root
}

.cm_criterios_anchor_faculties <- function(frame) {
  aula_frame <- frame$aula_frame
  if (!is.data.frame(aula_frame) || !nrow(aula_frame)) return(list())
  raw <- trimws(as.character(.cm_aulas_values(aula_frame, "faculty", "")))
  raw[is.na(raw)] <- ""
  keys <- .cm_criterios_fac_key(raw)
  lapply(unique(keys), function(key) {
    idx <- which(keys == key)
    list(
      key = if (nzchar(key)) key else .cm_criterio_radiografia_missing_faculty_key,
      history_key = if (nzchar(key)) key else "sin_dato",
      label = if (nzchar(key)) .cm_aulas_mode(raw[idx], key) else "Sin dato",
      idx = idx
    )
  })
}

.cm_criterios_anchor_faculties_entry <- function(frame, entry) {
  dimension <- .cm_aulas_scalar(
    entry$faculty_dimension,
    if (identical(.cm_aulas_scalar(entry$scope, ""), "alumno")) {
      "alumno"
    } else {
      "curso_horario_efectiva"
    }
  )
  rows <- entry$rows %||% list()
  keys <- vapply(
    rows,
    function(row) .cm_aulas_scalar(row$faculty_key, ""),
    character(1)
  )
  labels <- vapply(
    rows,
    function(row) .cm_aulas_scalar(row$faculty_label, ""),
    character(1)
  )
  keep <- nzchar(keys) & nzchar(labels) & !duplicated(keys)
  if (any(keep)) {
    frame_faculties <- .cm_criterios_anchor_faculties(frame)
    frame_by_key <- stats::setNames(frame_faculties, vapply(
      frame_faculties, function(faculty) faculty$key, character(1)
    ))
    return(lapply(which(keep), function(i) {
      faculty <- frame_by_key[[keys[[i]]]] %||% list(idx = integer(0))
      faculty$key <- keys[[i]]
      faculty$history_key <- if (identical(
        keys[[i]], .cm_criterio_radiografia_missing_faculty_key
      )) "sin_dato" else keys[[i]]
      faculty$label <- labels[[i]]
      faculty$dimension <- dimension
      faculty
    }))
  }

  # Una tarjeta sin filas no puede fabricar una faceta. Se conserva el
  # inventario efectivo del frame solo para publicar la degradación honesta.
  lapply(.cm_criterios_anchor_faculties(frame), function(faculty) {
    faculty$dimension <- dimension
    if (identical(dimension, "alumno")) faculty$idx <- integer(0)
    faculty
  })
}

.cm_criterios_anchor_mode <- function(values, idx) {
  values <- trimws(as.character(values))
  values[is.na(values)] <- ""
  idx <- idx[nzchar(values[idx])]
  if (!length(idx)) return(list(key = "", label = ""))
  keys <- .cm_criterios_fac_key(values[idx])
  counts <- sort(table(keys), decreasing = TRUE)
  key <- names(counts)[[1L]]
  hit <- idx[keys == key]
  list(key = key, label = .cm_aulas_mode(values[hit], key))
}

.cm_criterios_anchor_size <- function(values, idx) {
  values <- suppressWarnings(as.numeric(values))
  valid <- idx[is.finite(values[idx])]
  if (!length(valid)) return(list(key = "", label = ""))
  definitions <- .cm_asist_size_definitions(values)
  keys <- rep("", length(values))
  labels <- stats::setNames(character(0), character(0))
  for (definition in definitions) {
    keys[definition$mask %in% TRUE] <- definition$key
    labels[[definition$key]] <- definition$label
  }
  counts <- sort(table(keys[valid][nzchar(keys[valid])]), decreasing = TRUE)
  if (!length(counts)) return(list(key = "", label = ""))
  key <- names(counts)[[1L]]
  list(key = key, label = labels[[key]])
}

.cm_criterios_anchor_request <- function(entry, frame, faculty) {
  id <- .cm_aulas_scalar(entry$id, "")
  aula_frame <- frame$aula_frame
  idx <- faculty$idx
  included <- aula_frame$included %in% TRUE
  selected <- idx[included[idx]]
  if (!length(selected)) selected <- idx
  if (identical(id, "session_type")) {
    mode <- .cm_criterios_anchor_mode(
      .cm_aulas_values(aula_frame, "session_type", ""), selected
    )
    return(c(list(dimension = "tipo_sesion"), mode))
  }
  if (identical(id, "enrolled_total")) {
    enrolled <- .cm_aulas_num_values(aula_frame, "enrolled_total", NA_real_)
    if (!any(is.finite(enrolled[selected]))) {
      enrolled <- .cm_aulas_num_values(aula_frame, "eligible_n", NA_real_)
    }
    size <- .cm_criterios_anchor_size(enrolled, selected)
    return(c(list(dimension = "tamano"), size))
  }
  list(dimension = "", key = "", label = "")
}

.cm_criterios_anchor_estimate_valid <- function(cell) {
  if (!is.list(cell)) return(FALSE)
  k <- suppressWarnings(as.integer(cell$k))
  rate <- suppressWarnings(as.numeric(cell$tasa))
  low <- suppressWarnings(as.numeric(cell$ic_low))
  high <- suppressWarnings(as.numeric(cell$ic_high))
  is.finite(k) && k >= 12L &&
    .cm_asist_valid_probability(rate) &&
    .cm_asist_valid_probability(low) &&
    .cm_asist_valid_probability(high) && low <= high &&
    identical(.cm_aulas_scalar(cell$metodo_ic, ""), "bootstrap_percentil")
}

.cm_criterios_anchor_cell_valid <- function(cell) {
  .cm_criterios_anchor_estimate_valid(cell) &&
    identical(.cm_aulas_scalar(cell$fuente_publicada, ""), "celda")
}

.cm_criterios_anchor_exact <- function(cells, faculty_key, request) {
  hit <- Filter(function(cell) {
    identical(.cm_aulas_scalar(cell$faculty_key, ""), faculty_key) &&
      identical(.cm_aulas_scalar(cell$dimension_key, ""), request$dimension) &&
      identical(.cm_aulas_scalar(cell$cell_key, ""), request$key) &&
      .cm_criterios_anchor_cell_valid(cell)
  }, cells)
  if (length(hit)) hit[[1L]] else NULL
}

.cm_criterios_anchor_nearest_size <- function(cells, faculty_key, request) {
  if (!identical(request$dimension, "tamano") || !request$key %in% paste0("T", 1:5)) {
    return(NULL)
  }
  target <- match(request$key, paste0("T", 1:5))
  candidates <- Filter(function(cell) {
    identical(.cm_aulas_scalar(cell$faculty_key, ""), faculty_key) &&
      identical(.cm_aulas_scalar(cell$dimension_key, ""), "tamano") &&
      .cm_criterios_anchor_cell_valid(cell) &&
      .cm_aulas_scalar(cell$cell_key, "") %in% paste0("T", 1:5)
  }, cells)
  if (!length(candidates)) return(NULL)
  positions <- match(
    vapply(candidates, function(cell) cell$cell_key, character(1)),
    paste0("T", 1:5)
  )
  candidates[[order(abs(positions - target), positions)[[1L]]]]
}

.cm_criterios_reference_faculty <- function(reference, faculty_key) {
  dimensions <- reference$dimensiones %||% list()
  faculty <- Filter(
    function(dimension) identical(
      .cm_aulas_scalar(dimension$dimension_key, ""), "facultad"
    ),
    dimensions
  )
  if (!length(faculty)) return(NULL)
  hit <- Filter(function(cell) {
    identical(.cm_aulas_scalar(cell$celda_key, ""), faculty_key)
  }, faculty[[1L]]$filas %||% list())
  if (length(hit)) hit[[1L]] else NULL
}

.cm_criterios_anchor_stats <- function(cell, source = "cell") {
  if (identical(source, "global")) {
    return(list(
      k = as.integer(cell$k), tasa = as.numeric(cell$tasa),
      ic_low = as.numeric(cell$ic_low), ic_high = as.numeric(cell$ic_high),
      metodo_ic = .cm_aulas_scalar(cell$metodo_ic, "no_aplica"),
      suficiencia = .cm_asist_sufficiency(as.integer(cell$k))
    ))
  }
  list(
    k = as.integer(cell$k), tasa = as.numeric(cell$tasa),
    ic_low = as.numeric(cell$ic_low), ic_high = as.numeric(cell$ic_high),
    metodo_ic = .cm_aulas_scalar(cell$metodo_ic, "no_aplica"),
    suficiencia = .cm_aulas_scalar(cell$suficiencia, "vacia")
  )
}

.cm_criterios_anchor_empty_stats <- function() {
  list(
    k = NA_integer_, tasa = NA_real_, ic_low = NA_real_, ic_high = NA_real_,
    metodo_ic = "no_aplica", suficiencia = "vacia"
  )
}

.cm_criterios_anchor_match <- function(reference, faculty, request) {
  cells <- (reference$celdas_criterios %||% list())$rows %||% list()
  exact <- .cm_criterios_anchor_exact(cells, faculty$history_key, request)
  if (!is.null(exact)) return(list(
    level = "exacta", dimension = exact$dimension_key, key = exact$cell_key,
    label = exact$cell_label, stats = .cm_criterios_anchor_stats(exact),
    warning = "Coincidencia historica exacta."
  ))
  nearest <- .cm_criterios_anchor_nearest_size(cells, faculty$history_key, request)
  if (!is.null(nearest)) return(list(
    level = "tamano_cercano", dimension = nearest$dimension_key,
    key = nearest$cell_key, label = nearest$cell_label,
    stats = .cm_criterios_anchor_stats(nearest),
    warning = "La celda exacta no publica; se usa la banda de tamano cercana."
  ))
  faculty_cell <- .cm_criterios_reference_faculty(reference, faculty$history_key)
  if (.cm_criterios_anchor_cell_valid(faculty_cell)) {
    return(list(
      level = "facultad", dimension = "facultad", key = faculty_cell$celda_key,
      label = faculty_cell$celda_label,
      stats = .cm_criterios_anchor_stats(faculty_cell),
      warning = "Sin celda conjunta publicable; se degrada a la facultad historica."
    ))
  }
  global <- reference$global %||% list()
  if (.cm_criterios_anchor_estimate_valid(global)) {
    return(list(
      level = "global", dimension = "global", key = "global", label = "Global",
      stats = .cm_criterios_anchor_stats(global, "global"),
      warning = "Sin celda ni facultad publicable; se degrada al global historico."
    ))
  }
  list(
    level = "sin_publicacion", dimension = NA_character_, key = NA_character_,
    label = NA_character_, stats = .cm_criterios_anchor_empty_stats(),
    warning = "La referencia no tiene una tasa publicable."
  )
}

.cm_criterios_anchor_row <- function(entry, frame, reference, faculty) {
  request <- .cm_criterios_anchor_request(entry, frame, faculty)
  cells <- (reference %||% list())$celdas_criterios
  has_reference <- is.list(cells) && identical(
    .cm_aulas_scalar(cells$schema, ""), .cm_asist_criterios_schema
  )
  if (!has_reference) {
    matched <- list(
      level = "sin_publicacion", dimension = NA_character_, key = NA_character_,
      label = NA_character_, stats = .cm_criterios_anchor_empty_stats(),
      warning = "No hay una referencia historica conjunta publicada."
    )
  } else if (!nzchar(request$dimension) || !nzchar(request$key)) {
    matched <- list(
      level = "incompatible", dimension = NA_character_, key = NA_character_,
      label = NA_character_, stats = .cm_criterios_anchor_empty_stats(),
      warning = "El criterio no comparte una caracteristica compatible con la referencia."
    )
  } else {
    matched <- .cm_criterios_anchor_match(reference, faculty, request)
  }
  list(
    criterion_id = entry$id,
    card_id = entry$card_id,
    faculty_key = faculty$key,
    faculty_label = faculty$label,
    faculty_dimension = .cm_aulas_scalar(
      faculty$dimension, .cm_aulas_scalar(entry$faculty_dimension, "")
    ),
    reference_faculty_dimension = if (has_reference) {
      .cm_aulas_scalar(cells$faculty_dimension, "facultad_historica")
    } else {
      "no_disponible"
    },
    requested_dimension = if (nzchar(request$dimension)) request$dimension else NA_character_,
    requested_key = if (nzchar(request$key)) request$key else NA_character_,
    requested_label = if (nzchar(request$label)) request$label else NA_character_,
    matched_dimension = matched$dimension,
    matched_key = matched$key,
    matched_label = matched$label,
    match_level = matched$level,
    k = matched$stats$k,
    tasa = matched$stats$tasa,
    ic_low = matched$stats$ic_low,
    ic_high = matched$stats$ic_high,
    metodo_ic = matched$stats$metodo_ic,
    suficiencia = matched$stats$suficiencia,
    periodo = .cm_aulas_scalar(
      (reference$estudio %||% list())$periodo,
      if (has_reference) "sin_periodo" else "sin_referencia"
    ),
    warning = matched$warning
  )
}

calc_muestra_criterios_anclas_historicas <- function(frame, reference) {
  cells <- (reference %||% list())$celdas_criterios
  radiography <- (frame %||% list())$criterios_radiografia
  if (!is.list(frame) || !is.list(radiography)) {
    return(NULL)
  }
  has_reference <- is.list(cells) && identical(
    .cm_aulas_scalar(cells$schema, ""), .cm_asist_criterios_schema
  )
  entries <- radiography$criterios %||% list()
  rows <- unlist(lapply(entries, function(entry) {
    faculties <- .cm_criterios_anchor_faculties_entry(frame, entry)
    lapply(faculties, function(faculty) {
      .cm_criterios_anchor_row(entry, frame, reference, faculty)
    })
  }), recursive = FALSE)
  list(
    schema = .cm_criterios_anclas_schema,
    owner = "calc_muestra_aulas_frame_v1.criterios_anclas_historicas",
    source_frame_hash = .cm_aulas_scalar(frame$frame_hash, ""),
    reference_hash = if (has_reference) {
      .cm_aulas_scalar(cells$reference_hash, "sin_firma")
    } else {
      "sin_referencia"
    },
    reference_schema = if (has_reference) {
      .cm_aulas_scalar(cells$schema, .cm_asist_criterios_schema)
    } else {
      "sin_referencia"
    },
    periodo = .cm_aulas_scalar(
      (reference$estudio %||% list())$periodo,
      if (has_reference) "sin_periodo" else "sin_referencia"
    ),
    grain = "criterio_x_facultad_efectiva",
    faculty_dimensions = as.list(unique(vapply(
      rows,
      function(row) .cm_aulas_scalar(row$faculty_dimension, ""),
      character(1)
    ))),
    reference_faculty_dimension = if (has_reference) {
      .cm_aulas_scalar(cells$faculty_dimension, "facultad_historica")
    } else {
      "no_disponible"
    },
    rows = rows
  )
}

.cm_asist_criterios_adjuntar <- function(out, model, estudio, bootstrap_n, global) {
  out$celdas_criterios <- .cm_asist_with_seed(
    calc_muestra_asistencia_criterios_celdas(model, estudio, bootstrap_n, global)
  )
  out
}

.pulso_sanitize_calc_muestra_asistencia_criterion_cell <- function(value) {
  if (!is.list(value)) return(NULL)
  .pulso_whitelist_scalar_fields(value, c(
    "faculty_key", "faculty_label", "dimension_key", "dimension_label",
    "cell_key", "cell_label", "order", "k", "matriculados", "asistentes",
    "tasa", "media_ch", "sd_ch", "ic_low", "ic_high", "metodo_ic",
    "suficiencia", "tasa_publicada", "k_publicada", "fuente_publicada"
  ))
}

.pulso_sanitize_calc_muestra_asistencia_criteria <- function(value) {
  if (!is.list(value)) return(NULL)
  out <- .pulso_whitelist_scalar_fields(value, c(
    "schema", "owner", "momento", "combinable", "unit", "denominator",
    "faculty_dimension", "reference_hash"
  ))
  out["estudio"] <- list(.pulso_whitelist_scalar_fields(
    value$estudio, c("id", "label", "periodo", "fuente")
  ))
  rows <- lapply(
    .pulso_record_list(value$rows),
    .pulso_sanitize_calc_muestra_asistencia_criterion_cell
  )
  out["rows"] <- list(Filter(Negate(is.null), rows))
  out
}

.pulso_sanitize_calc_muestra_anchor_row <- function(value) {
  if (!is.list(value)) return(NULL)
  .pulso_whitelist_scalar_fields(value, c(
    "criterion_id", "card_id", "faculty_key", "faculty_label",
    "faculty_dimension", "reference_faculty_dimension",
    "requested_dimension", "requested_key", "requested_label",
    "matched_dimension", "matched_key", "matched_label", "match_level",
    "k", "tasa", "ic_low", "ic_high", "metodo_ic", "suficiencia",
    "periodo", "warning"
  ))
}

.pulso_sanitize_calc_muestra_anchors <- function(value) {
  if (!is.list(value)) return(NULL)
  out <- .pulso_whitelist_scalar_fields(value, c(
    "schema", "owner", "source_frame_hash", "reference_hash",
    "reference_schema", "periodo", "grain",
    "reference_faculty_dimension"
  ))
  dimensions <- value$faculty_dimensions
  if (is.atomic(dimensions)) dimensions <- as.list(dimensions)
  if (!is.list(dimensions)) dimensions <- list()
  dimensions <- lapply(dimensions, .pulso_safe_scalar)
  out["faculty_dimensions"] <- list(unname(Filter(Negate(is.null), dimensions)))
  rows <- lapply(
    .pulso_record_list(value$rows),
    .pulso_sanitize_calc_muestra_anchor_row
  )
  out["rows"] <- list(Filter(Negate(is.null), rows))
  out
}

# Referencia historica de asistencia por curso-horario.
#
# Este engine resume una fuente post hoc en marginales transferibles. Nunca
# devuelve filas por curso-horario ni mezcla estas tasas con el marco vigente.

.cm_asist_column_aliases <- function() {
  list(
    curso_horario = c("curso_horario", "CURSO-HORARIO"),
    estado_aplicacion = c(
      "estado_aplicacion", "status", "estado", "STATUS DE APLICACIÓN"
    ),
    matriculados = c(
      "matriculados", "matriculados_totales", "MATRICULADOS TOTALES"
    ),
    asistentes = c(
      "asistieron", "asistentes", "N° ASISTENTES EN AULA"
    ),
    enviadas = c("enviadas", "TOTAL ENVIADAS"),
    validas = c("validas", "TOTAL LARGAS", "TOTAL LARGAS (válidas)"),
    no_respondieron = c(
      "no_respondieron", "N° ASISTENTES QUE NO RESPONDIERON"
    ),
    rango_horario = c("rango_horario", "RANGO - HORARIO"),
    facultad = c("facultad"),
    tipo_sesion = c("tipo_sesion")
  )
}

.cm_asist_keep_material_rows <- function(datos) {
  if (!is.data.frame(datos) || !nrow(datos)) return(datos)
  material <- rep(FALSE, nrow(datos))
  for (column in datos) {
    value <- trimws(as.character(column))
    material <- material | (!is.na(value) & nzchar(value))
  }
  datos[material, , drop = FALSE]
}

.cm_asist_exact_header_index <- function(values, candidates) {
  value_keys <- .cm_aulas_text_key(values)
  candidate_keys <- .cm_aulas_text_key(candidates)
  hits <- match(candidate_keys, value_keys, nomatch = 0L)
  hits <- hits[hits > 0L]
  if (length(hits)) as.integer(hits[[1L]]) else 0L
}

.cm_asist_group_faculty_label <- function(parent_name, aliases) {
  label <- trimws(as.character(parent_name)[1L])
  if (is.na(label) || !nzchar(label) || grepl("^\\.\\.\\.[0-9]+$", label)) {
    return("")
  }
  reserved <- unique(c(
    .cm_aulas_text_key(unlist(aliases, use.names = FALSE)),
    "aplicacion", "encuestas", "asistencia", "horario", "muestra"
  ))
  if (.cm_aulas_text_key(label) %in% reserved) "" else label
}

.cm_asist_promote_grouped_header <- function(datos) {
  if (!is.data.frame(datos) || !nrow(datos) || !ncol(datos)) {
    return(list(datos = datos, promoted = FALSE))
  }
  aliases <- .cm_asist_column_aliases()
  first_row <- vapply(datos, function(column) {
    value <- trimws(as.character(column[[1L]]))
    if (is.na(value)) "" else value
  }, character(1))
  required <- c(
    "curso_horario", "estado_aplicacion", "matriculados", "asistentes",
    "enviadas", "validas", "no_respondieron", "rango_horario"
  )
  positions <- vapply(
    aliases[required],
    function(candidates) .cm_asist_exact_header_index(first_row, candidates),
    integer(1)
  )
  if (!all(positions > 0L) || anyDuplicated(positions)) {
    return(list(datos = datos, promoted = FALSE))
  }

  parent_names <- names(datos)
  promoted <- datos[-1L, , drop = FALSE]
  promoted_names <- first_row
  blank_header <- !nzchar(promoted_names)
  promoted_names[blank_header] <- sprintf(
    ".cm_asist_blank_%d",
    which(blank_header)
  )
  names(promoted) <- make.unique(promoted_names, sep = "__")

  if (!nzchar(.cm_criterios_col_exacta(promoted, aliases$facultad))) {
    faculty_label <- .cm_asist_group_faculty_label(
      parent_names[[positions[["curso_horario"]]]],
      aliases
    )
    if (nzchar(faculty_label)) {
      promoted$facultad <- rep(faculty_label, nrow(promoted))
    } else {
      attendance_position <- positions[["asistentes"]]
      faculty_position <- attendance_position - 1L
      if (faculty_position >= 1L && blank_header[[faculty_position]]) {
        names(promoted)[[faculty_position]] <- "facultad"
      }
    }
  }

  list(datos = promoted, promoted = TRUE)
}

.cm_asist_prepare_input <- function(datos) {
  datos <- .cm_asist_keep_material_rows(datos)
  promoted <- .cm_asist_promote_grouped_header(datos)
  datos <- .cm_asist_keep_material_rows(promoted$datos)
  warnings <- character(0)
  aliases <- .cm_asist_column_aliases()
  if (!nzchar(.cm_criterios_col_exacta(datos, aliases$tipo_sesion))) {
    datos$tipo_sesion <- rep("Sin dato", nrow(datos))
    warnings <- c(warnings, "tipo_sesion_ausente_rellenado_sin_dato")
  }
  list(datos = datos, advertencias = warnings)
}

.cm_asist_resolve_columns <- function(datos) {
  aliases <- .cm_asist_column_aliases()
  resolved <- vapply(
    aliases,
    function(candidates) .cm_criterios_col_exacta(datos, candidates),
    character(1)
  )
  missing <- names(resolved)[!nzchar(resolved)]
  if (length(missing)) {
    found <- names(datos)
    found_label <- if (length(found)) paste(found, collapse = ", ") else "<ninguna>"
    stop_api(
      400,
      "E_CALC_MUESTRA_ASISTENCIA_COLUMNS",
      sprintf(
        "La referencia de asistencia no contiene las columnas requeridas: %s. Columnas encontradas: %s.",
        paste(missing, collapse = ", "),
        found_label
      ),
      details = list(
        faltantes = as.list(missing),
        encontradas = as.list(found)
      )
    )
  }
  resolved
}

.cm_asist_numeric <- function(x) {
  suppressWarnings(as.numeric(as.character(x)))
}

.cm_asist_validate_counts <- function(frame) {
  count_fields <- c(
    "matriculados", "asistentes", "enviadas", "validas", "no_respondieron"
  )
  invalid <- vapply(count_fields, function(field) {
    value <- frame[[field]]
    finite <- is.finite(value)
    any(finite & (
      value < 0 |
        abs(value - round(value)) > sqrt(.Machine$double.eps)
    ))
  }, logical(1))
  if (any(invalid)) {
    fields <- count_fields[invalid]
    stop_api(
      400,
      "E_CALC_MUESTRA_ASISTENCIA_INPUT",
      sprintf(
        "Los conteos finitos deben ser enteros no negativos: %s.",
        paste(fields, collapse = ", ")
      ),
      details = list(campos = as.list(fields))
    )
  }
  invisible(frame)
}

.cm_asist_valid_probability <- function(value) {
  length(value) == 1L && is.finite(value) && value >= 0 && value <= 1
}

.cm_asist_strict_sum <- function(x) {
  if (!length(x) || any(!is.finite(x))) return(NA_real_)
  sum(x)
}

.cm_asist_ratio <- function(numerator, denominator) {
  if (!is.finite(numerator) || !is.finite(denominator) || denominator <= 0) {
    return(NA_real_)
  }
  numerator / denominator
}

.cm_asist_bootstrap_ratio <- function(numerator, denominator, bootstrap_n,
                                      level = 0.95) {
  k <- length(numerator)
  if (
    k < 12L || length(denominator) != k ||
      any(!is.finite(numerator)) || any(!is.finite(denominator)) ||
      sum(denominator) <= 0
  ) {
    return(c(low = NA_real_, high = NA_real_))
  }

  sampled <- matrix(
    sample.int(k, size = k * bootstrap_n, replace = TRUE),
    nrow = k,
    ncol = bootstrap_n
  )
  numerator_sum <- colSums(matrix(numerator[sampled], nrow = k))
  denominator_sum <- colSums(matrix(denominator[sampled], nrow = k))
  ratios <- numerator_sum / denominator_sum
  ratios <- ratios[is.finite(ratios)]
  if (!length(ratios)) return(c(low = NA_real_, high = NA_real_))

  alpha <- (1 - level) / 2
  unname(stats::quantile(
    ratios,
    probs = c(alpha, 1 - alpha),
    names = FALSE,
    type = 7L
  ))
}

.cm_asist_with_seed <- function(expr, seed = 20260731L) {
  had_seed <- exists(".Random.seed", envir = .GlobalEnv, inherits = FALSE)
  if (had_seed) {
    saved_seed <- get(".Random.seed", envir = .GlobalEnv, inherits = FALSE)
  }
  on.exit({
    if (had_seed) {
      assign(".Random.seed", saved_seed, envir = .GlobalEnv)
    } else if (exists(".Random.seed", envir = .GlobalEnv, inherits = FALSE)) {
      rm(".Random.seed", envir = .GlobalEnv)
    }
  }, add = TRUE)
  set.seed(seed)
  force(expr)
}

.cm_asist_sufficiency <- function(k) {
  if (k == 0L) return("vacia")
  if (k <= 11L) return("insuficiente")
  if (k <= 29L) return("delgada")
  "solida"
}

.cm_asist_cell_stats <- function(matriculados, asistentes, bootstrap_n) {
  k <- as.integer(length(matriculados))
  complete <- k > 0L &&
    length(asistentes) == k &&
    all(is.finite(matriculados)) &&
    all(is.finite(asistentes))

  if (!complete) {
    return(list(
      k = k,
      matriculados = NA_real_,
      asistentes = NA_real_,
      tasa = NA_real_,
      media_ch = NA_real_,
      sd_ch = NA_real_,
      ic_low = NA_real_,
      ic_high = NA_real_,
      metodo_ic = "no_aplica"
    ))
  }

  matriculados_total <- sum(matriculados)
  asistentes_total <- sum(asistentes)
  tasa <- .cm_asist_ratio(asistentes_total, matriculados_total)
  tasas_ch <- ifelse(matriculados > 0, asistentes / matriculados, NA_real_)
  tasas_complete <- all(is.finite(tasas_ch))
  interval <- .cm_asist_bootstrap_ratio(asistentes, matriculados, bootstrap_n)
  has_interval <- k >= 12L && all(is.finite(interval))

  list(
    k = k,
    matriculados = matriculados_total,
    asistentes = asistentes_total,
    tasa = tasa,
    media_ch = if (tasas_complete) mean(tasas_ch) else NA_real_,
    sd_ch = if (tasas_complete && k >= 2L) stats::sd(tasas_ch) else NA_real_,
    ic_low = unname(interval[[1L]]),
    ic_high = unname(interval[[2L]]),
    metodo_ic = if (has_interval) "bootstrap_percentil" else "no_aplica"
  )
}

.cm_asist_cell <- function(key, label, order, matriculados, asistentes,
                           bootstrap_n, global) {
  stats <- .cm_asist_cell_stats(matriculados, asistentes, bootstrap_n)
  sufficiency <- .cm_asist_sufficiency(stats$k)

  publish_global <- function() {
    if (.cm_asist_valid_probability(global$tasa)) {
      list(rate = global$tasa, k = global$k, source = "global")
    } else {
      list(rate = NA_real_, k = NA_integer_, source = "sin_publicacion")
    }
  }

  if (stats$k == 0L) {
    published_rate <- NA_real_
    published_k <- NA_integer_
    published_source <- "sin_publicacion"
  } else if (stats$k <= 11L) {
    publication <- publish_global()
    published_rate <- publication$rate
    published_k <- publication$k
    published_source <- publication$source
  } else if (.cm_asist_valid_probability(stats$tasa)) {
    published_rate <- stats$tasa
    published_k <- stats$k
    published_source <- "celda"
  } else {
    publication <- publish_global()
    published_rate <- publication$rate
    published_k <- publication$k
    published_source <- publication$source
  }

  list(
    celda_key = key,
    celda_label = label,
    orden = as.integer(order),
    k = stats$k,
    matriculados = stats$matriculados,
    asistentes = stats$asistentes,
    tasa = stats$tasa,
    estimador = "razon_agregada",
    media_ch = stats$media_ch,
    sd_ch = stats$sd_ch,
    ic_low = stats$ic_low,
    ic_high = stats$ic_high,
    metodo_ic = stats$metodo_ic,
    suficiencia = sufficiency,
    tasa_publicada = published_rate,
    k_publicada = published_k,
    fuente_publicada = published_source
  )
}

.cm_asist_size_dimension <- function(model, bootstrap_n, global) {
  definitions <- list(
    list(key = "T1", label = "Menos de 15", include = model$matriculados < 15),
    list(key = "T2", label = "15 a 24", include = model$matriculados >= 15 & model$matriculados <= 24),
    list(key = "T3", label = "25 a 39", include = model$matriculados >= 25 & model$matriculados <= 39),
    list(key = "T4", label = "40 a 59", include = model$matriculados >= 40 & model$matriculados <= 59),
    list(key = "T5", label = "60 o mas", include = model$matriculados >= 60)
  )

  rows <- lapply(seq_along(definitions), function(i) {
    definition <- definitions[[i]]
    idx <- which(!is.na(definition$include) & definition$include)
    .cm_asist_cell(
      definition$key,
      definition$label,
      i,
      model$matriculados[idx],
      model$asistentes[idx],
      bootstrap_n,
      global
    )
  })
  list(
    dimension_key = "tamano",
    dimension_label = "Tamano del curso-horario",
    orden = 1L,
    filas = rows
  )
}

.cm_asist_category_definitions <- function(values, declared_levels, key_fn) {
  values <- trimws(as.character(values))
  values[is.na(values)] <- ""
  value_keys <- key_fn(values)
  value_keys[!nzchar(value_keys)] <- "sin_dato"

  level_labels <- trimws(as.character(declared_levels))
  level_labels[is.na(level_labels)] <- ""
  level_keys <- key_fn(level_labels)
  level_keys[!nzchar(level_keys)] <- "sin_dato"

  keys <- unique(c(level_keys, value_keys))
  definitions <- lapply(keys, function(key) {
    level_hit <- which(level_keys == key)
    value_hit <- which(value_keys == key)
    label <- if (length(level_hit)) {
      level_labels[[level_hit[[1L]]]]
    } else if (length(value_hit)) {
      values[[value_hit[[1L]]]]
    } else {
      ""
    }
    if (!nzchar(label)) label <- "Sin dato"
    list(key = key, label = label, include = value_keys == key)
  })
  list(definitions = definitions, value_keys = value_keys)
}

.cm_asist_category_dimension <- function(model, column, declared_levels,
                                         dimension_key, dimension_label, order,
                                         bootstrap_n, global, key_fn) {
  categories <- .cm_asist_category_definitions(
    model[[column]],
    declared_levels,
    key_fn
  )$definitions
  rows <- lapply(seq_along(categories), function(i) {
    category <- categories[[i]]
    idx <- which(category$include)
    .cm_asist_cell(
      category$key,
      category$label,
      i,
      model$matriculados[idx],
      model$asistentes[idx],
      bootstrap_n,
      global
    )
  })
  list(
    dimension_key = dimension_key,
    dimension_label = dimension_label,
    orden = as.integer(order),
    filas = rows
  )
}

.cm_asist_chain_segment <- function(key, label, numerator, denominator,
                                    bootstrap_n) {
  k <- as.integer(length(numerator))
  numerator_total <- .cm_asist_strict_sum(numerator)
  denominator_total <- .cm_asist_strict_sum(denominator)
  rate <- .cm_asist_ratio(numerator_total, denominator_total)
  interval <- .cm_asist_bootstrap_ratio(numerator, denominator, bootstrap_n)
  has_interval <- k >= 12L && is.finite(rate) && all(is.finite(interval))
  list(
    key = key,
    label = label,
    k = k,
    numerador = numerator_total,
    denominador = denominator_total,
    tasa = rate,
    ic_low = unname(interval[[1L]]),
    ic_high = unname(interval[[2L]]),
    metodo_ic = if (has_interval) "bootstrap_percentil" else "no_aplica"
  )
}

.cm_asist_global <- function(model, bootstrap_n) {
  stats <- .cm_asist_cell_stats(model$matriculados, model$asistentes, bootstrap_n)
  m_complete <- stats$k > 0L && all(is.finite(model$matriculados))
  list(
    k = stats$k,
    matriculados = stats$matriculados,
    asistentes = stats$asistentes,
    enviadas = if (m_complete) .cm_asist_strict_sum(model$enviadas) else NA_real_,
    validas = if (m_complete) .cm_asist_strict_sum(model$validas) else NA_real_,
    no_respondieron = if (m_complete) .cm_asist_strict_sum(model$no_respondieron) else NA_real_,
    tasa = stats$tasa,
    media_ch = stats$media_ch,
    sd_ch = stats$sd_ch,
    ic_low = stats$ic_low,
    ic_high = stats$ic_high,
    metodo_ic = stats$metodo_ic
  )
}

.cm_asist_hierarchy_warnings <- function(model) {
  definitions <- list(
    asistentes_mayor_matriculados = c("asistentes", "matriculados"),
    enviadas_mayor_asistentes = c("enviadas", "asistentes"),
    validas_mayor_enviadas = c("validas", "enviadas")
  )
  warnings <- character(0)
  for (key in names(definitions)) {
    fields <- definitions[[key]]
    numerator <- model[[fields[[1L]]]]
    denominator <- model[[fields[[2L]]]]
    comparable <- is.finite(numerator) & is.finite(denominator)
    count <- sum(comparable & numerator > denominator)
    if (count > 0L) {
      warnings <- c(warnings, sprintf("%s:%d", key, as.integer(count)))
    }
  }
  warnings
}

.cm_asist_study <- function(estudio) {
  list(
    id = .cm_aulas_scalar(estudio$id, ""),
    label = .cm_aulas_scalar(estudio$label, ""),
    periodo = .cm_aulas_scalar(estudio$periodo, ""),
    fuente = .cm_aulas_scalar(estudio$fuente, "")
  )
}

# Senal estricta para el inspector de hojas. Una coincidencia parcial debe
# volver NULL para que el clasificador general conserve su precedencia.
.cm_asist_sheet_role_hint <- function(df) {
  if (!is.data.frame(df) || !ncol(df)) return(NULL)
  prepared <- .cm_asist_prepare_input(df)
  df <- prepared$datos
  aliases <- .cm_asist_column_aliases()
  required <- c("curso_horario", "matriculados", "asistentes", "enviadas")
  resolved <- vapply(
    aliases[required],
    function(candidates) .cm_criterios_col_exacta(df, candidates),
    character(1)
  )
  if (!all(nzchar(resolved))) return(NULL)
  list(
    role = "referencia_asistencia",
    label = "Referencia historica de asistencia",
    confidence = 0.92
  )
}

calc_muestra_asistencia_referencia <- function(datos, estudio = list(),
                                                bootstrap_n = 2000L) {
  if (!is.data.frame(datos) || !nrow(datos)) {
    stop_api(
      400,
      "E_CALC_MUESTRA_ASISTENCIA_INPUT",
      "La referencia de asistencia debe ser una tabla con al menos una fila."
    )
  }
  if (!is.list(estudio)) {
    stop_api(
      400,
      "E_CALC_MUESTRA_ASISTENCIA_INPUT",
      "El metadato estudio de la referencia de asistencia debe ser un objeto."
    )
  }
  bootstrap_value <- suppressWarnings(as.numeric(bootstrap_n)[1L])
  if (
    length(bootstrap_n) != 1L || !is.finite(bootstrap_value) ||
      bootstrap_value < 1 || bootstrap_value != floor(bootstrap_value) ||
      bootstrap_value > .Machine$integer.max
  ) {
    stop_api(
      400,
      "E_CALC_MUESTRA_ASISTENCIA_INPUT",
      "bootstrap_n debe ser un entero positivo."
    )
  }
  bootstrap_n <- as.integer(bootstrap_value)

  prepared <- .cm_asist_prepare_input(datos)
  datos <- prepared$datos
  if (!nrow(datos)) {
    stop_api(
      400,
      "E_CALC_MUESTRA_ASISTENCIA_INPUT",
      "La referencia de asistencia no contiene filas materiales."
    )
  }

  columns <- .cm_asist_resolve_columns(datos)
  factor_levels <- list(
    rango_horario = if (is.factor(datos[[columns[["rango_horario"]]]])) {
      levels(datos[[columns[["rango_horario"]]]])
    } else character(0),
    facultad = if (is.factor(datos[[columns[["facultad"]]]])) {
      levels(datos[[columns[["facultad"]]]])
    } else character(0),
    tipo_sesion = if (is.factor(datos[[columns[["tipo_sesion"]]]])) {
      levels(datos[[columns[["tipo_sesion"]]]])
    } else character(0)
  )

  frame <- data.frame(
    curso_horario = trimws(as.character(datos[[columns[["curso_horario"]]]])),
    estado = .cm_aulas_text_key(datos[[columns[["estado_aplicacion"]]]]),
    matriculados = .cm_asist_numeric(datos[[columns[["matriculados"]]]]),
    asistentes = .cm_asist_numeric(datos[[columns[["asistentes"]]]]),
    enviadas = .cm_asist_numeric(datos[[columns[["enviadas"]]]]),
    validas = .cm_asist_numeric(datos[[columns[["validas"]]]]),
    no_respondieron = .cm_asist_numeric(datos[[columns[["no_respondieron"]]]]),
    rango_horario = trimws(as.character(datos[[columns[["rango_horario"]]]])),
    facultad = trimws(as.character(datos[[columns[["facultad"]]]])),
    tipo_sesion = trimws(as.character(datos[[columns[["tipo_sesion"]]]])),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  frame$curso_horario[is.na(frame$curso_horario)] <- ""
  frame$rango_horario[is.na(frame$rango_horario)] <- ""
  frame$facultad[is.na(frame$facultad)] <- ""
  frame$tipo_sesion[is.na(frame$tipo_sesion)] <- ""

  material_without_key <- !nzchar(frame$curso_horario)
  if (any(material_without_key)) {
    stop_api(
      400,
      "E_CALC_MUESTRA_ASISTENCIA_INPUT",
      "Toda fila material debe declarar un curso_horario no vacío.",
      details = list(filas_sin_unidad = as.integer(sum(material_without_key)))
    )
  }
  unit_keys <- .cm_aulas_text_key(frame$curso_horario)
  duplicate_units <- duplicated(unit_keys) | duplicated(unit_keys, fromLast = TRUE)
  if (any(duplicate_units)) {
    stop_api(
      400,
      "E_CALC_MUESTRA_ASISTENCIA_INPUT",
      "curso_horario debe ser único: la fuente contiene unidades repetidas.",
      details = list(filas_duplicadas = as.integer(sum(duplicate_units)))
    )
  }
  .cm_asist_validate_counts(frame)

  # curso_horario es la llave de estabilidad. Los campos restantes solo
  # desempatan defensivamente una fuente que repita la llave.
  ordering <- order(
    frame$curso_horario,
    frame$estado,
    frame$matriculados,
    frame$asistentes,
    frame$enviadas,
    frame$validas,
    frame$no_respondieron,
    frame$rango_horario,
    frame$facultad,
    frame$tipo_sesion,
    na.last = TRUE,
    method = "radix"
  )
  frame <- frame[ordering, , drop = FALSE]
  applied <- frame$estado == "aplicada"
  observed <- applied & is.finite(frame$asistentes)
  model <- frame[observed, , drop = FALSE]
  rownames(model) <- NULL

  identity_rows <- is.finite(model$asistentes) &
    is.finite(model$enviadas) &
    is.finite(model$no_respondieron)
  inconsistent <- if (any(identity_rows)) {
    sum(abs(
      model$asistentes[identity_rows] -
        model$enviadas[identity_rows] -
        model$no_respondieron[identity_rows]
    ) > sqrt(.Machine$double.eps))
  } else {
    0L
  }
  verifiable <- as.integer(sum(identity_rows))

  calculated <- .cm_asist_with_seed({
    global <- .cm_asist_global(model, bootstrap_n)
    chain <- list(
      asistencia = .cm_asist_chain_segment(
        "asistencia", "Asistencia", model$asistentes, model$matriculados, bootstrap_n
      ),
      completitud = .cm_asist_chain_segment(
        "completitud", "Completitud", model$enviadas, model$asistentes, bootstrap_n
      ),
      validez = .cm_asist_chain_segment(
        "validez", "Validez", model$validas, model$enviadas, bootstrap_n
      ),
      producto = .cm_asist_chain_segment(
        "producto", "Producto", model$validas, model$matriculados, bootstrap_n
      )
    )
    dimensions <- list(
      .cm_asist_size_dimension(model, bootstrap_n, global),
      .cm_asist_category_dimension(
        model, "rango_horario", factor_levels$rango_horario,
        "rango_horario", "Rango horario", 2L, bootstrap_n, global,
        .cm_criterios_fac_key
      ),
      .cm_asist_category_dimension(
        model, "facultad", factor_levels$facultad,
        "facultad", "Facultad", 3L, bootstrap_n, global,
        .cm_criterios_fac_key
      ),
      .cm_asist_category_dimension(
        model, "tipo_sesion", factor_levels$tipo_sesion,
        "tipo_sesion", "Tipo de sesion", 4L, bootstrap_n, global,
        .cm_criterios_fac_key
      )
    )
    list(global = global, chain = chain, dimensions = dimensions)
  })

  .cm_asist_criterios_adjuntar(list(
    schema = "calc_muestra_referencia_asistencia_v1",
    owner = "estudio_historico_externo",
    momento = "post_hoc_estudio_previo",
    transferible = "modelo_por_celda",
    modelo = "marginales_independientes",
    combinable = FALSE,
    unidad = "curso_horario_aplicado",
    denominador = "matriculados_totales",
    estudio = .cm_asist_study(estudio),
    cobertura = list(
      agendados = as.integer(nrow(frame)),
      aplicados = as.integer(sum(applied)),
      observados = as.integer(sum(observed))
    ),
    identidad = list(
      regla = "A = E + no_respondieron",
      verificada = verifiable > 0L && inconsistent == 0L,
      verificables = verifiable,
      inconsistentes = as.integer(inconsistent)
    ),
    umbrales = list(
      insuficiente_max = 11L,
      delgada_min = 12L,
      solida_min = 30L,
      bootstrap_n = bootstrap_n,
      nivel_ic = 0.95,
      quantile_type = 7L
    ),
    cadena = calculated$chain,
    global = calculated$global,
    dimensiones = calculated$dimensions,
    advertencias = as.list(unique(c(
      "marginales_no_combinables",
      "celdas_con_k_1_a_11_degradan_a_global",
      "referencia_post_hoc_no_equivale_a_medicion_del_marco_vigente",
      prepared$advertencias,
      .cm_asist_hierarchy_warnings(model)
    )))
  ), model, estudio, bootstrap_n, calculated$global)
}

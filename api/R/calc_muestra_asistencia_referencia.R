# Referencia historica de asistencia por curso-horario.
#
# Este engine resume una fuente post hoc en marginales transferibles. Nunca
# devuelve filas por curso-horario ni mezcla estas tasas con el marco vigente.

.cm_asist_column_aliases <- function() {
  list(
    curso_horario = c("curso_horario", "CURSO-HORARIO"),
    estado_aplicacion = c(
      "estado_aplicacion", "status", "estado", "resultado",
      "STATUS DE APLICACIÓN"
    ),
    matriculados = c(
      "matriculados", "matriculados_totales", "MATRICULADOS TOTALES"
    ),
    asistentes = c(
      "asistieron", "asistentes", "N° ASISTENTES EN AULA"
    ),
    enviadas = c("registros", "enviadas", "TOTAL ENVIADAS"),
    validas = c(
      "efectivas", "validas", "TOTAL LARGAS", "TOTAL LARGAS (válidas)"
    ),
    no_respondieron = c(
      "no_respondieron", "N° ASISTENTES QUE NO RESPONDIERON"
    ),
    rango_horario = c("rango_horario", "bloque_horario", "RANGO - HORARIO"),
    facultad = c("facultad"),
    tipo_sesion = c("tipo_sesion", "tipo_curso")
  )
}

# ADR 0060. Columnas del glosario del encuentro. Son opcionales porque una base
# histórica anterior al ADR no las trae: cuando faltan, el motor degrada a la
# lectura v1 y lo declara en `cobertura$glosario`. Los nombres de entrada
# aceptan los encabezados heredados para que una base de 2025 cargue sin
# edición manual.
.cm_asist_optional_aliases <- function() {
  list(
    elegibles = c(
      "elegibles", "matriculados_poblacion", "MATRICULADOS POBLACIÓN"
    ),
    ya_medidas = c(
      "ya_medidas", "ya_medidos", "duplicados_ya_respondieron",
      "DUPLICADOS (YA RESPONDIERON)"
    ),
    no_elegibles = c("no_elegibles", "no_elegibles_formulario"),
    no_efectivas = c("no_efectivas", "cortas_total", "TOTAL CORTAS"),
    rechazos_en_aula = c(
      "rechazos_en_aula", "declinaron_sin_abrir", "CANTIDAD DE RECHAZOS"
    ),
    # ADR 0060 · criterios de curso-horario. Son los mismos ejes con los que el
    # marco decide qué aulas entran (Marco › Criterios por facultad), así que
    # tenerlos aquí permite preguntar lo que de verdad se pregunta al
    # dimensionar: si un aula de taller rinde distinto que una de teoría, o si
    # el docente contratado cambia la asistencia.
    condicion_curso = c(
      "condicion_curso", "condicion", "CONDICIÓN", "condicion_del_curso"
    ),
    nivel_curso = c("nivel_curso", "nivel_del_curso", "NIVEL DEL CURSO"),
    tipo_docente = c("tipo_docente", "tipo_de_docente"),
    modalidad = c("modalidad", "MODALIDAD"),
    # Con la hora de inicio del curso-horario, «Regular tarde» deja de ser un
    # rotulo interno y pasa a decir de que hora a que hora va. Sin ella la
    # dimension sigue funcionando, solo que muda.
    hora_inicio = c("hora_inicio", "horario", "hora", "HORARIO")
  )
}

# Las opcionales se dividen por naturaleza: los conteos del encuentro entran
# como números y los criterios de curso-horario como categorías. Pasar un
# criterio por `as.numeric` lo dejaría en NA y borraría la dimensión entera.
.cm_asist_optional_numeric_fields <- function() {
  c("elegibles", "ya_medidas", "no_elegibles", "no_efectivas", "rechazos_en_aula")
}

.cm_asist_resolve_optional <- function(datos) {
  vapply(
    .cm_asist_optional_aliases(),
    function(candidates) .cm_criterios_col_exacta(datos, candidates),
    character(1)
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

#' Grupos de tamano declarados por el estudio, normalizados.
#'
#' El modulo deja que cada estudio arme sus propios tramos de tamano en Marco
#' (`grupos_tamano` + `usar_grupos_tamano`). Esta dimension tiene que hablar en
#' esos tramos y no en una escala fija del motor: si el estudio parte en 30 y 80,
#' leer el historico en cortes de 15/25/40/60 obliga a traducir a mano justo
#' cuando se compara con el marco vigente.
#'
#' Devuelve NULL cuando el estudio no declara grupos o los desactiva; el llamador
#' omite la dimension en vez de inventar una escala.
.cm_asist_size_groups <- function(grupos) {
  if (is.null(grupos) || !length(grupos)) return(NULL)
  if (is.data.frame(grupos)) grupos <- split(grupos, seq_len(nrow(grupos)))

  parsed <- lapply(seq_along(grupos), function(i) {
    grupo <- grupos[[i]]
    if (!is.list(grupo)) return(NULL)
    min_value <- suppressWarnings(as.numeric(grupo$min %||% NA_real_))
    max_value <- suppressWarnings(as.numeric(grupo$max %||% NA_real_))
    if (!length(min_value) || is.na(min_value)) min_value <- 0
    if (!length(max_value) || is.na(max_value)) max_value <- Inf
    id <- .cm_aulas_scalar(grupo$id, sprintf("G%d", i))
    label <- .cm_aulas_scalar(grupo$label, id)
    if (!nzchar(label)) label <- id
    list(key = id, label = label, min = min_value, max = max_value)
  })
  parsed <- Filter(Negate(is.null), parsed)
  if (!length(parsed)) return(NULL)
  parsed[order(vapply(parsed, function(g) g$min, numeric(1)))]
}

.cm_asist_size_dimension <- function(model, bootstrap_n, global, grupos = NULL) {
  groups <- .cm_asist_size_groups(grupos)
  if (is.null(groups)) return(NULL)

  definitions <- lapply(groups, function(group) {
    list(
      key = group$key,
      label = group$label,
      include = model$matriculados >= group$min & model$matriculados <= group$max
    )
  })

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
    dimension_label = "Tamaño del curso-horario",
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
    # Una base exportada de Excel suele prefijar la categoria con su orden
    # («1. Especial manana») para que la hoja ordene sola. Ese numero es
    # tipografia de la hoja, no parte del nombre: se usa para ordenar y se
    # quita de la etiqueta.
    prefix <- suppressWarnings(as.numeric(sub("^\\s*([0-9]+)\\s*[.)-].*$", "\\1", label)))
    if (!is.na(prefix)) label <- trimws(sub("^\\s*[0-9]+\\s*[.)-]\\s*", "", label))
    if (!nzchar(label)) label <- "Sin dato"
    list(key = key, label = label, orden_declarado = prefix, include = value_keys == key)
  })
  # El prefijo de orden, cuando existe, manda sobre el orden de aparicion.
  declared <- vapply(definitions, function(d) d$orden_declarado %||% NA_real_, numeric(1))
  if (any(!is.na(declared))) {
    declared[is.na(declared)] <- max(declared, na.rm = TRUE) + seq_len(sum(is.na(declared)))
    definitions <- definitions[order(declared)]
  }
  list(definitions = definitions, value_keys = value_keys)
}

#' Rango de horas observado dentro de cada categoria, como «07:00 a 08:30».
#'
#' Se lee de la propia base, no de una tabla de cortes del motor: los tramos los
#' fija cada estudio y la unica fuente fiel de donde cae cada uno son las horas
#' que de verdad se aplicaron.
.cm_asist_franja_horaria <- function(horas, idx) {
  if (is.null(horas) || !length(idx)) return("")
  valores <- trimws(as.character(horas[idx]))
  valores <- valores[!is.na(valores) & nzchar(valores)]
  if (!length(valores)) return("")
  # Acepta «17:00-20:00» y «17:00»; solo importa el inicio.
  inicio <- sub("^\\s*([0-9]{1,2}):([0-9]{2}).*$", "\\1:\\2", valores)
  validas <- grepl("^[0-9]{1,2}:[0-9]{2}$", inicio)
  if (!any(validas)) return("")
  inicio <- inicio[validas]
  minutos <- as.integer(sub(":.*$", "", inicio)) * 60L +
    as.integer(sub("^.*:", "", inicio))
  formato <- function(m) sprintf("%02d:%02d", m %/% 60L, m %% 60L)
  desde <- formato(min(minutos))
  hasta <- formato(max(minutos))
  if (identical(desde, hasta)) desde else sprintf("%s a %s", desde, hasta)
}

.cm_asist_category_dimension <- function(model, column, declared_levels,
                                         dimension_key, dimension_label, order,
                                         bootstrap_n, global, key_fn,
                                         horas = NULL) {
  categories <- .cm_asist_category_definitions(
    model[[column]],
    declared_levels,
    key_fn
  )$definitions
  rows <- lapply(seq_along(categories), function(i) {
    category <- categories[[i]]
    idx <- which(category$include)
    franja <- .cm_asist_franja_horaria(horas, idx)
    etiqueta <- if (nzchar(franja)) {
      sprintf("%s (%s)", category$label, franja)
    } else {
      category$label
    }
    .cm_asist_cell(
      category$key,
      etiqueta,
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
# ADR 0060. El diseño del estudio previo es lo que permite leer sus tasas: sin
# saber sobre qué meta se trabajó, una tasa de campo es un número suelto. Todos
# los campos son opcionales —una base puede no traer su diseño documentado— y
# se emiten como NULL cuando faltan, nunca como cero.
.cm_asist_design_number <- function(value) {
  parsed <- suppressWarnings(as.numeric(value[1L]))
  if (length(parsed) != 1L || !is.finite(parsed)) return(NULL)
  parsed
}

.cm_asist_design <- function(diseno) {
  if (!is.list(diseno)) diseno <- list()
  num <- function(key) .cm_asist_design_number(diseno[[key]])
  out <- list(
    poblacion_objetivo = num("poblacion_objetivo"),
    nivel_confianza = num("nivel_confianza"),
    proporcion_esperada = num("proporcion_esperada"),
    margen_error = num("margen_error"),
    deff = num("deff"),
    muestra = num("muestra"),
    ratio_sobremuestra = num("ratio_sobremuestra"),
    sobremuestra = num("sobremuestra"),
    aulas_marco = num("aulas_marco"),
    aulas_dimensionadas = num("aulas_dimensionadas"),
    aulas_aplicadas = num("aulas_aplicadas"),
    tasa_respuesta_asumida = num("tasa_respuesta_asumida"),
    afijacion = .cm_aulas_scalar(diseno$afijacion, ""),
    metodo_seleccion = .cm_aulas_scalar(diseno$metodo_seleccion, ""),
    metodo_ajuste = .cm_aulas_scalar(diseno$metodo_ajuste, ""),
    ponderado = if (is.logical(diseno$ponderado) && length(diseno$ponderado) == 1L) {
      diseno$ponderado
    } else NULL
  )
  # La tasa asumida es reconstruible cuando el diseño trae sobremuestra y las
  # aulas dimensionadas con sus elegibles; si no viene declarada se deja NULL
  # antes que inventarla.
  out$declarado <- any(vapply(out, function(x) !is.null(x) && !identical(x, ""), logical(1)))
  out
}

# ADR 0060. Los filtros de corte se declaran por estudio; lo único cerrado es
# la clase, que decide el efecto sobre el denominador.
.cm_asist_filter_classes <- function() {
  c("rechazo", "abandono", "no_elegible", "ya_medido")
}

.cm_asist_filters <- function(filtros) {
  if (is.null(filtros)) return(list())
  if (!is.list(filtros)) {
    stop_api(
      400,
      "E_CALC_MUESTRA_ASISTENCIA_FILTROS",
      "El catálogo de filtros de corte debe ser una lista."
    )
  }
  valid <- .cm_asist_filter_classes()
  seen <- character(0)
  out <- lapply(seq_along(filtros), function(idx) {
    item <- filtros[[idx]]
    if (!is.list(item)) {
      stop_api(
        400,
        "E_CALC_MUESTRA_ASISTENCIA_FILTROS",
        sprintf("El filtro en la posición %d debe ser un objeto.", idx)
      )
    }
    clase <- .cm_aulas_scalar(item$clase, "")
    if (!nzchar(clase) || !(clase %in% valid)) {
      stop_api(
        400,
        "E_CALC_MUESTRA_ASISTENCIA_FILTROS",
        sprintf(
          "El filtro '%s' declara la clase '%s', que no pertenece a la taxonomía: %s.",
          .cm_aulas_scalar(item$id, sprintf("#%d", idx)),
          clase,
          paste(valid, collapse = ", ")
        ),
        details = list(clases_validas = as.list(valid))
      )
    }
    id <- .cm_aulas_scalar(item$id, "")
    if (!nzchar(id)) {
      stop_api(
        400,
        "E_CALC_MUESTRA_ASISTENCIA_FILTROS",
        sprintf("El filtro en la posición %d debe declarar un id.", idx)
      )
    }
    if (id %in% seen) {
      stop_api(
        400,
        "E_CALC_MUESTRA_ASISTENCIA_FILTROS",
        sprintf("El id de filtro '%s' está repetido.", id)
      )
    }
    seen <<- c(seen, id)
    origen <- .cm_aulas_scalar(item$origen, "formulario")
    if (!(origen %in% c("campo", "formulario"))) {
      stop_api(
        400,
        "E_CALC_MUESTRA_ASISTENCIA_FILTROS",
        sprintf(
          "El filtro '%s' declara origen '%s'; solo se admite campo o formulario.",
          id, origen
        )
      )
    }
    orden <- .cm_asist_design_number(item$orden)
    list(
      id = id,
      etiqueta = .cm_aulas_scalar(item$etiqueta, id),
      columna = .cm_aulas_scalar(item$columna, ""),
      condicion = .cm_aulas_scalar(item$condicion, ""),
      clase = clase,
      origen = origen,
      orden = if (is.null(orden)) as.numeric(idx) else orden,
      # El efecto sobre el denominador lo decide la clase, nunca el estudio.
      en_denominador = clase %in% c("rechazo", "abandono")
    )
  })
  out[order(vapply(out, function(x) x$orden, numeric(1)))]
}

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
    label = "Referencia histórica de asistencia",
    confidence = 0.92
  )
}

# ADR 0060. Taxonomía del encuentro. Se calcula sólo cuando la base trae las
# columnas del glosario; si no, el resultado es NULL y el contrato lo declara.
# `no_realizadas` es residual —sale de restar— y por eso se marca cuando queda
# negativa en vez de publicarse: un residual negativo no es un dato.
.cm_asist_encuentros <- function(model) {
  needed <- c("elegibles", "ya_medidas", "no_elegibles")
  if (!all(needed %in% names(model))) return(NULL)
  cero <- function(x) ifelse(is.finite(x), x, 0)
  asistentes <- model$asistentes
  ya <- cero(model$ya_medidas)
  noel <- cero(model$no_elegibles)
  efectivas <- model$validas
  no_efectivas <- if ("no_efectivas" %in% names(model)) {
    cero(model$no_efectivas)
  } else {
    pmax(cero(model$enviadas) - cero(efectivas) - noel, 0)
  }
  elegibles_presentes <- asistentes - ya - noel
  no_realizadas <- elegibles_presentes - efectivas - no_efectivas
  publicable <- is.finite(no_realizadas) & no_realizadas >= 0
  suma <- function(x, mask = NULL) {
    if (!is.null(mask)) x <- x[mask]
    .cm_asist_strict_sum(x)
  }
  list(
    elegibles = suma(model$elegibles),
    asistentes = suma(asistentes),
    ya_medidas = suma(ya),
    no_elegibles = suma(noel),
    elegibles_presentes = suma(elegibles_presentes),
    efectivas = suma(efectivas),
    no_efectivas = suma(no_efectivas),
    no_realizadas = suma(no_realizadas, publicable),
    unidades_publicables = as.integer(sum(publicable, na.rm = TRUE)),
    unidades_con_residual_negativo = as.integer(sum(!publicable, na.rm = TRUE))
  )
}

# ADR 0060 · el embudo no sólo agregado: el dimensionamiento reparte aulas por
# facultad, así que necesita saber DÓNDE se perdió la gente en cada una. Una
# facultad con mucha ausencia y otra con mucho traslape piden decisiones
# distintas aunque su rendimiento final coincida.
.cm_asist_embudo_por <- function(model, columna, etiqueta, orden) {
  if (!(columna %in% names(model))) return(NULL)
  needed <- c("elegibles", "ya_medidas", "no_elegibles")
  if (!all(needed %in% names(model))) return(NULL)
  cero <- function(x) ifelse(is.finite(x), x, 0)
  claves <- trimws(as.character(model[[columna]]))
  claves[!nzchar(claves) | is.na(claves)] <- "Sin dato"
  filas <- lapply(sort(unique(claves)), function(clave) {
    sel <- claves == clave
    elegibles <- .cm_asist_strict_sum(model$elegibles[sel])
    asistentes <- .cm_asist_strict_sum(model$asistentes[sel])
    ya <- .cm_asist_strict_sum(cero(model$ya_medidas)[sel])
    noel <- .cm_asist_strict_sum(cero(model$no_elegibles)[sel])
    efectivas <- .cm_asist_strict_sum(model$validas[sel])
    no_efectivas <- if ("no_efectivas" %in% names(model)) {
      .cm_asist_strict_sum(cero(model$no_efectivas)[sel])
    } else {
      NA_real_
    }
    presentes <- if (is.finite(asistentes)) asistentes - cero(ya) - cero(noel) else NA_real_
    list(
      celda_key = .cm_criterios_fac_key(clave),
      celda_label = clave,
      k = as.integer(sum(sel)),
      elegibles = elegibles,
      asistentes = asistentes,
      ya_medidas = ya,
      no_elegibles = noel,
      elegibles_presentes = presentes,
      efectivas = efectivas,
      no_efectivas = no_efectivas,
      # Las tres pérdidas expresadas sobre el universo de la celda, que es lo
      # que permite comparar facultades de tamaños muy distintos.
      pct_ausencia = .cm_asist_ratio(elegibles - asistentes, elegibles),
      pct_ya_medidas = .cm_asist_ratio(ya, asistentes),
      pct_rechazo = .cm_asist_ratio(no_efectivas, presentes),
      efectividad = .cm_asist_ratio(efectivas, presentes),
      rendimiento = .cm_asist_ratio(efectivas, elegibles)
    )
  })
  list(
    dimension_key = columna,
    dimension_label = etiqueta,
    orden = as.integer(orden),
    filas = filas
  )
}

calc_muestra_asistencia_referencia <- function(datos, estudio = list(),
                                                bootstrap_n = 2000L,
                                                diseno = list(),
                                                filtros_corte = NULL,
                                                grupos_tamano = NULL) {
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

  # ADR 0060: columnas del glosario del encuentro. Se adjuntan sólo si la base
  # las trae; su ausencia degrada la lectura, no la invalida.
  optional <- .cm_asist_resolve_optional(datos)
  glosario_columnas <- names(optional)[nzchar(optional)]
  # `glosario_completo` habla del embudo del encuentro; un criterio presente no
  # convierte una base heredada en una base con glosario.
  glosario_conteos <- intersect(glosario_columnas, .cm_asist_optional_numeric_fields())
  numericos <- .cm_asist_optional_numeric_fields()
  for (field in glosario_columnas) {
    frame[[field]] <- if (field %in% numericos) {
      .cm_asist_numeric(datos[[optional[[field]]]])
    } else {
      valores <- trimws(as.character(datos[[optional[[field]]]]))
      valores[is.na(valores)] <- ""
      valores
    }
  }

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
    # ADR 0060. Los tramos se renombran y su denominador cambia cuando la base
    # trae el glosario: `efectividad` se mide sobre los elegibles presentes, no
    # sobre los registros, y `rendimiento` sobre elegibles, no sobre matrícula.
    tiene_glosario <- all(c("elegibles", "ya_medidas", "no_elegibles") %in% names(model))
    cero <- function(x) ifelse(is.finite(x), x, 0)
    base_asistencia <- if (tiene_glosario) model$elegibles else model$matriculados
    # Apertura y efectividad NO comparten denominador. Con el glosario ambas se
    # miden sobre los elegibles presentes; sin él se conserva la cadena
    # heredada —registros sobre presentes, efectivas sobre registros— que es
    # multiplicativa y cierra en el rendimiento.
    base_apertura <- if (tiene_glosario) {
      model$asistentes - cero(model$ya_medidas) - cero(model$no_elegibles)
    } else {
      model$asistentes
    }
    base_efectividad <- if (tiene_glosario) base_apertura else model$enviadas
    chain <- list(
      asistencia = .cm_asist_chain_segment(
        "asistencia", "Asistencia", model$asistentes, base_asistencia, bootstrap_n
      ),
      apertura = .cm_asist_chain_segment(
        "apertura", "Apertura", model$enviadas, base_apertura, bootstrap_n
      ),
      efectividad = .cm_asist_chain_segment(
        "efectividad", "Efectividad", model$validas, base_efectividad, bootstrap_n
      ),
      rendimiento = .cm_asist_chain_segment(
        "rendimiento", "Rendimiento", model$validas, base_asistencia, bootstrap_n
      )
    )
    dimensions <- list(
      .cm_asist_size_dimension(model, bootstrap_n, global, grupos_tamano),
      .cm_asist_category_dimension(
        model, "rango_horario", factor_levels$rango_horario,
        "rango_horario", "Rango horario", 2L, bootstrap_n, global,
        .cm_criterios_fac_key, model$hora_inicio
      ),
      .cm_asist_category_dimension(
        model, "facultad", factor_levels$facultad,
        "facultad", "Facultad", 3L, bootstrap_n, global,
        .cm_criterios_fac_key
      ),
      .cm_asist_category_dimension(
        model, "tipo_sesion", factor_levels$tipo_sesion,
        "tipo_sesion", "Tipo de sesión", 4L, bootstrap_n, global,
        .cm_criterios_fac_key
      )
    )
    # Sin grupos declarados la dimension de tamano no se emite.
    list(global = global, chain = chain, dimensions = Filter(Negate(is.null), dimensions))
  })

  encuentros <- .cm_asist_encuentros(model)
  tiene_glosario <- !is.null(encuentros)

  .cm_asist_criterios_adjuntar(list(
    schema = "calc_muestra_referencia_asistencia_v2",
    owner = "estudio_historico_externo",
    momento = "post_hoc_estudio_previo",
    transferible = "modelo_por_celda",
    modelo = "marginales_independientes",
    combinable = FALSE,
    unidad = "encuentro_en_curso_horario_aplicado",
    denominador = if (tiene_glosario) "elegibles_presentes" else "matriculados_totales",
    estudio = .cm_asist_study(estudio),
    diseno = .cm_asist_design(diseno),
    filtros_corte = .cm_asist_filters(filtros_corte),
    cobertura = list(
      agendados = as.integer(nrow(frame)),
      aplicados = as.integer(sum(applied)),
      observados = as.integer(sum(observed)),
      # Declara si la base trae el vocabulario del ADR 0060 o si el motor tuvo
      # que degradar a la lectura heredada: sin esto, un consumidor no puede
      # saber sobre qué denominador está leyendo las tasas.
      glosario_completo = tiene_glosario,
      columnas_glosario = as.list(glosario_conteos),
      columnas_criterio = as.list(setdiff(glosario_columnas, glosario_conteos))
    ),
    encuentros = encuentros,
    # El mismo embudo, abierto por las dimensiones que el operativo puede
    # accionar. Vacío cuando la base no trae el glosario del encuentro.
    embudos = Filter(Negate(is.null), list(
      .cm_asist_embudo_por(model, "facultad", "Facultad", 1L),
      .cm_asist_embudo_por(model, "rango_horario", "Rango horario", 2L),
      .cm_asist_embudo_por(model, "tipo_sesion", "Tipo de sesión", 3L),
      .cm_asist_embudo_por(model, "condicion_curso", "Condicion del curso", 4L),
      .cm_asist_embudo_por(model, "nivel_curso", "Nivel del curso", 5L),
      .cm_asist_embudo_por(model, "tipo_docente", "Tipo de docente", 6L),
      .cm_asist_embudo_por(model, "modalidad", "Modalidad", 7L)
    )),
    identidad = list(
      regla = if (tiene_glosario) {
        "elegibles_presentes = efectivas + no_efectivas + no_realizadas"
      } else {
        "A = E + no_respondieron"
      },
      verificada = verifiable > 0L && inconsistent == 0L,
      verificables = verifiable,
      inconsistentes = as.integer(inconsistent),
      # El residual negativo es la señal de que el conteo de campo no cierra.
      residuales_negativos = if (tiene_glosario) {
        encuentros$unidades_con_residual_negativo
      } else NULL
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

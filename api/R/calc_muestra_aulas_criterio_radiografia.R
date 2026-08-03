# Radiografía estadística del criterio `session_type × facultad` sobre el marco
# EJECUTADO. Es un sibling aditivo de `frame$exploracion`: no reinterpreta el
# bloque legacy ni agrupa sus valores modales, sino las señales efectivas que
# produjo `.cm_criterios_valores_aula()` y conservó
# `criterios$seleccion_aula$valores`.
#
# Contrato público: `calc_muestra_aulas_criterios_radiografia_v1`. La unidad es
# un curso-horario único y `eligible_n` cuenta estudiantes únicos dentro del CH;
# al sumar CH representa matrículas/exposiciones elegibles, no personas únicas.
# Todo estadístico es estricto: si falta `eligible_n` en una unidad de su
# denominador, el valor agregado es NA. El serializer Plumber/jsonlite vigente
# lo transporta como `"NA"`; el normalizador React lo conserva como `null`.

.cm_criterio_radiografia_owner <- "calc_muestra_aulas_frame_v1.criterios_radiografia"
.cm_criterio_radiografia_grano <- "criterio_x_facultad_x_segmento"
.cm_criterio_radiografia_unidad <- "curso_horario_unico"
.cm_criterio_radiografia_filas_owner <- "calc_muestra_aulas_frame_v1.aula_frame"
.cm_criterio_radiografia_filas_grano <- "session_type_x_facultad_efectiva"
# Reservadas para AUSENCIA. Los guiones bajos exteriores no pueden salir de
# `.cm_aulas_text_key()`, así que un valor real "SIN DATO" conserva su clave
# `sin_dato` sin colisionar con el bucket sintético no accionable.
.cm_criterio_radiografia_missing_session_key <- "__missing_session_type__"
.cm_criterio_radiografia_missing_faculty_key <- "__missing_faculty__"

.cm_criterio_radiografia_entry <- function(id, meta, seleccion, rows = list(),
                                            status = "disponible") {
  scope <- .cm_aulas_scalar(meta$scope, "aula")
  kind <- .cm_aulas_scalar(meta$kind, "flat")
  es_alumno <- identical(scope, "alumno")
  family <- paste0(if (es_alumno) "student_" else "classroom_", kind)
  crit <- (seleccion$byVariable %||% list())[[id]]
  layer <- if (es_alumno) {
    .cm_aulas_scalar((crit %||% list())$layer, meta$defaultLayer %||% "marco")
  } else {
    NULL
  }
  list(
    id = id,
    card_id = id,
    label = .cm_aulas_scalar(meta$label, id),
    scope = scope,
    family = family,
    status = status,
    effective_layer = layer,
    overlap = isTRUE(!es_alumno && identical(kind, "hierarchical")),
    faculty_dimension = if (es_alumno) "alumno" else "curso_horario_efectiva",
    owner = if (es_alumno) {
      "calc_muestra_aulas_construir_v1.filas_alumno"
    } else {
      "calc_muestra_aulas_frame_v1.aula_frame"
    },
    kind = kind,
    grain = if (es_alumno) {
      "alumno_x_curso_horario_x_facultad"
    } else {
      "curso_horario_x_facultad_x_segmento"
    },
    unit = if (es_alumno) "alumno_unico_por_curso_horario" else "curso_horario_unico",
    gate = if (es_alumno && !identical(layer, "marco")) "informativo" else
      if (es_alumno) "poblacion" else "marco",
    rows = rows
  )
}

.cm_criterio_radiografia_gate_entry <- function(id, label, family, rows = list(),
                                                 status = "disponible") {
  list(
    id = id,
    card_id = if (id %in% c("c7", "c8_facultad", "c8")) "composition" else id,
    label = label,
    scope = "aula",
    family = family,
    status = status,
    effective_layer = NULL,
    overlap = FALSE,
    faculty_dimension = "curso_horario_efectiva",
    owner = "calc_muestra_aulas_criterios_v1",
    kind = "gate",
    grain = "curso_horario_x_facultad_x_segmento",
    unit = "curso_horario_unico",
    gate = "marco",
    rows = rows
  )
}

.cm_criterio_radiografia_inventario <- function(catalogo, seleccion, valores,
                                                 filas_session, criterios,
                                                 rows_by_id = list(),
                                                 status_by_id = list()) {
  registry <- .cm_criterios_var_registry()
  variables <- if (is.list(catalogo)) catalogo$variables else NULL
  if (!is.list(variables)) variables <- list()
  ids_all <- vapply(variables, function(v) .cm_aulas_scalar(v$id, ""), character(1))
  keep <- nzchar(ids_all) & ids_all %in% names(registry)
  variables <- variables[keep]
  ids <- ids_all[keep]
  # Compatibilidad con fixtures I11 directos: sin catálogo explícito, usa solo
  # los pasos efectivos del evaluador; nunca infiere `faculty` alumno desde la
  # facultad efectiva del CH.
  catalogo_explicito <- is.list(catalogo) && !is.null(catalogo$variables)
  if (!length(ids) && !catalogo_explicito) {
    pasos <- ((criterios$seleccion_aula %||% list())$pasos) %||% list()
    ids <- unique(vapply(pasos, function(p) .cm_aulas_scalar(p$id, ""), character(1)))
    ids <- ids[ids %in% names(registry)]
  }
  out <- lapply(seq_along(ids), function(i) {
    id <- ids[[i]]
    meta <- if (length(variables) >= i && is.list(variables[[i]])) {
      utils::modifyList(registry[[id]], variables[[i]])
    } else {
      registry[[id]]
    }
    rows <- rows_by_id[[id]]
    if (is.null(rows) && identical(id, "session_type")) rows <- filas_session
    if (is.null(rows)) rows <- list()
    status <- .cm_aulas_scalar(status_by_id[[id]], if (length(rows)) "disponible" else "invalido")
    .cm_criterio_radiografia_entry(
      id = id,
      meta = meta,
      seleccion = seleccion,
      rows = rows,
      status = status
    )
  })
  out <- c(out, list(
    .cm_criterio_radiografia_gate_entry(
      "minEligible", "Mínimo de alumnos elegibles", "threshold_gate",
      rows = rows_by_id$minEligible %||% list(),
      status = .cm_aulas_scalar(status_by_id$minEligible, "invalido")
    ),
    .cm_criterio_radiografia_gate_entry(
      "c7", "Composición · prevalencia elegible", "proportion_gate",
      rows = rows_by_id$c7 %||% list(),
      status = .cm_aulas_scalar(status_by_id$c7, "sin_senal")
    ),
    .cm_criterio_radiografia_gate_entry(
      "c8_facultad", "Composición · facultad del curso", "proportion_gate",
      rows = rows_by_id$c8_facultad %||% list(),
      status = .cm_aulas_scalar(status_by_id$c8_facultad, "sin_senal")
    ),
    .cm_criterio_radiografia_gate_entry(
      "c8", "Composición · nivel del curso", "proportion_gate",
      rows = rows_by_id$c8 %||% list(),
      status = .cm_aulas_scalar(status_by_id$c8, "sin_senal")
    )
  ))
  out
}

.cm_criterio_radiografia_resumen <- function(v, cuantiles = FALSE) {
  v <- suppressWarnings(as.numeric(v))
  n_dato <- as.integer(sum(is.finite(v)))
  completo <- length(v) > 0L && n_dato == length(v)
  media <- if (completo) as.numeric(mean(v)) else NA_real_
  if (!isTRUE(cuantiles)) {
    return(list(n_ch_con_dato = n_dato, media = media))
  }
  q <- if (completo) {
    as.numeric(stats::quantile(
      v, probs = c(0.10, 0.25, 0.50, 0.75, 0.90),
      type = 7, names = FALSE
    ))
  } else {
    rep(NA_real_, 5L)
  }
  list(
    n_ch_con_dato = n_dato,
    media = media,
    p10 = q[[1]],
    p25 = q[[2]],
    p50 = q[[3]],
    p75 = q[[4]],
    p90 = q[[5]]
  )
}

.cm_criterio_radiografia_suma_estricta <- function(v) {
  v <- suppressWarnings(as.numeric(v))
  if (!length(v)) return(0)
  if (any(!is.finite(v))) return(NA_real_)
  as.numeric(sum(v))
}

# -----------------------------------------------------------------------------
# Distribución publicada por segmento — contrato v2 (F111)
# -----------------------------------------------------------------------------
#
# La tarjeta de categoría apila tres lecturas de la MISMA variable sobre un solo
# eje: densidad arriba, boxplot en medio y cuantiles abajo. Las tres exigen datos
# que este motor no publicaba, y ninguna se puede derivar en el cliente:
#
#   - **Densidad**: entre P10 y P90 hay infinitas formas. Interpolar una es
#     inventarla, así que el histograma lo calcula R.
#   - **Boxplot estándar**: los bigotes de Tukey son el dato más extremo dentro
#     de 1,5 × RIC, no P10/P90. Sin ellos la caja no es la que el lector espera.
#   - **Mismos límites**: dos histogramas con cortes distintos no son
#     comparables, que es justo lo que la regla 3 del ADR 0057 prohíbe. Por eso
#     `breaks` entra por parámetro: el llamador los calcula UNA vez sobre el
#     universo del criterio y los pasa a todos sus segmentos.
#
# Campos (todos NA/vacío cuando la cobertura no es completa):
#   media, p10, p25, p50, p75, p90   — como antes
#   min, max                          — límites reales del segmento
#   bigote_inf, bigote_sup            — extremos de Tukey dentro de 1,5 × RIC
#   n_atipicos                        — cuántos quedan fuera de esos bigotes
#   n_atipicos_inf, n_atipicos_sup    — de qué lado (F114): sin esto la tarjeta
#                                       sólo puede decirlo en prosa, y una cifra
#                                       en prosa junto a un gráfico es metatexto
#   hist_breaks (k+1), hist_counts (k) — densidad empírica sobre cortes comunes
.cm_criterio_radiografia_distribucion <- function(v, breaks = NULL) {
  resumen <- .cm_criterio_radiografia_resumen(v, cuantiles = TRUE)
  out <- resumen[c("media", "p10", "p25", "p50", "p75", "p90")]

  vals <- suppressWarnings(as.numeric(v))
  vals <- vals[is.finite(vals)]
  if (!length(vals)) {
    return(c(out, list(
      min = NA_real_, max = NA_real_,
      bigote_inf = NA_real_, bigote_sup = NA_real_, n_atipicos = NA_integer_,
      n_atipicos_inf = NA_integer_, n_atipicos_sup = NA_integer_,
      hist_breaks = numeric(0), hist_counts = integer(0)
    )))
  }

  q1 <- as.numeric(stats::quantile(vals, 0.25, type = 7, names = FALSE))
  q3 <- as.numeric(stats::quantile(vals, 0.75, type = 7, names = FALSE))
  ric <- q3 - q1
  # Bigote = dato más extremo DENTRO de la valla, no la valla: un bigote que
  # llega a donde no hay observaciones dibuja un rango que no existe.
  dentro_inf <- vals[vals >= q1 - 1.5 * ric]
  dentro_sup <- vals[vals <= q3 + 1.5 * ric]
  bigote_inf <- if (length(dentro_inf)) min(dentro_inf) else min(vals)
  bigote_sup <- if (length(dentro_sup)) max(dentro_sup) else max(vals)

  hist_breaks <- numeric(0)
  hist_counts <- integer(0)
  if (is.numeric(breaks) && length(breaks) >= 2L) {
    b <- sort(unique(as.numeric(breaks[is.finite(breaks)])))
    if (length(b) >= 2L) {
      # `include.lowest` para que el mínimo no se pierda del primer intervalo.
      cortes <- cut(vals, breaks = b, include.lowest = TRUE, right = TRUE)
      hist_breaks <- b
      hist_counts <- as.integer(table(cortes))
    }
  }

  c(out, list(
    min = as.numeric(min(vals)),
    max = as.numeric(max(vals)),
    bigote_inf = as.numeric(bigote_inf),
    bigote_sup = as.numeric(bigote_sup),
    n_atipicos = as.integer(sum(vals < bigote_inf | vals > bigote_sup)),
    n_atipicos_inf = as.integer(sum(vals < bigote_inf)),
    n_atipicos_sup = as.integer(sum(vals > bigote_sup)),
    hist_breaks = hist_breaks,
    hist_counts = hist_counts
  ))
}

# Cortes comunes a todos los segmentos de un criterio.
#
# Se calculan sobre el universo del criterio —no por segmento— porque la tarjeta
# existe para comparar categorías entre sí. Regla de Sturges acotada a [8, 28]:
# con pocos CH un histograma de 30 barras es ruido, y con muchos más de 28 no
# añade forma legible al ancho que la tarjeta puede darle.
.cm_criterio_radiografia_breaks <- function(v, min_bins = 8L, max_bins = 28L) {
  vals <- suppressWarnings(as.numeric(v))
  vals <- vals[is.finite(vals)]
  if (length(vals) < 2L) return(numeric(0))
  lo <- min(vals); hi <- max(vals)
  if (!(hi > lo)) return(numeric(0))
  k <- ceiling(log2(length(vals)) + 1)
  k <- max(min_bins, min(max_bins, as.integer(k)))
  seq(lo, hi, length.out = k + 1L)
}

.cm_criterio_radiografia_ids_por_ch <- function(aula_frame, eligible_n) {
  n <- nrow(aula_frame)
  vacio <- list(sets = replicate(n, character(0), simplify = FALSE), valido = FALSE)
  if (!"unique_student_ids" %in% names(aula_frame)) return(vacio)
  raw <- .cm_aulas_values(aula_frame, "unique_student_ids", "")
  sets <- lapply(raw, function(x) {
    if (!nzchar(x)) return(character(0))
    ids <- trimws(strsplit(x, "|", fixed = TRUE)[[1]])
    unique(ids[nzchar(ids)])
  })
  esperado <- suppressWarnings(as.numeric(eligible_n))
  valido <- length(sets) == n && all(is.finite(esperado)) &&
    isTRUE(all(vapply(sets, length, integer(1)) == as.integer(esperado)))
  list(sets = sets, valido = valido)
}

.cm_criterio_radiografia_snapshot <- function(idx, eligible_n, ids_por_ch,
                                              breaks = NULL) {
  idx <- as.integer(idx)
  idx <- idx[is.finite(idx)]
  n_ch <- as.integer(length(idx))
  if (!n_ch) {
    return(list(
      n_ch = 0L,
      n_ch_con_dato = 0L,
      n_estudiantes_unicos = 0L,
      n_matriculas = 0L,
      distribution = .cm_criterio_radiografia_distribucion(numeric(0))
    ))
  }
  valores <- suppressWarnings(as.numeric(eligible_n[idx]))
  n_dato <- as.integer(sum(is.finite(valores)))
  cobertura_completa <- n_dato == n_ch && isTRUE(ids_por_ch$valido)
  matriculas <- if (cobertura_completa) as.integer(round(sum(valores))) else NA_integer_
  estudiantes <- if (cobertura_completa) {
    if (!is.null(ids_por_ch$pair_ch) && !is.null(ids_por_ch$pair_student)) {
      pair_idx <- ids_por_ch$pair_ch %in% idx
      as.integer(length(unique(ids_por_ch$pair_student[pair_idx])))
    } else {
      as.integer(length(unique(unlist(ids_por_ch$sets[idx], use.names = FALSE))))
    }
  } else {
    NA_integer_
  }
  distribucion <- .cm_criterio_radiografia_distribucion(valores, breaks)
  if (!cobertura_completa) {
    # F111 · Antes esto era `distribucion[] <- rep(NA_real_, length(...))`, que
    # con el contrato v2 machacaría `hist_breaks`/`hist_counts` convirtiendo dos
    # vectores en escalares NA. Sin cobertura completa no se publica NADA de la
    # distribución, y el vacío se construye con el mismo constructor que el
    # resto: así el contrato tiene una sola forma, con dato o sin él.
    distribucion <- .cm_criterio_radiografia_distribucion(numeric(0))
  }
  list(
    n_ch = n_ch,
    n_ch_con_dato = n_dato,
    n_estudiantes_unicos = estudiantes,
    n_matriculas = matriculas,
    distribution = distribucion
  )
}

.cm_criterio_radiografia_delta_atomico <- function(
    accion, reconstruccion_valida, included_actual, included_nuevo,
    eligible_n_actual, eligible_n_nuevo, ids_actual, ids_nuevo) {
  invalido <- list(
    reference = "marco_ejecutado",
    action = accion,
    reconstruccion_valida = FALSE,
    delta_ch = NA_integer_,
    delta_matriculas = NA_integer_,
    delta_estudiantes_unicos = NA_integer_
  )
  if (!isTRUE(reconstruccion_valida) ||
      length(included_nuevo) != length(included_actual)) {
    return(invalido)
  }
  actual <- .cm_criterio_radiografia_snapshot(
    which(included_actual), eligible_n_actual, ids_actual
  )
  nuevo <- .cm_criterio_radiografia_snapshot(
    which(included_nuevo), eligible_n_nuevo, ids_nuevo
  )
  if (anyNA(c(
    actual$n_matriculas, actual$n_estudiantes_unicos,
    nuevo$n_matriculas, nuevo$n_estudiantes_unicos
  ))) {
    return(invalido)
  }
  deltas <- if (identical(accion, "no_aplica")) {
    c(0L, 0L, 0L)
  } else {
    c(
      as.integer(sum(included_nuevo) - sum(included_actual)),
      as.integer(nuevo$n_matriculas - actual$n_matriculas),
      as.integer(nuevo$n_estudiantes_unicos - actual$n_estudiantes_unicos)
    )
  }
  if (anyNA(deltas)) return(invalido)
  list(
    reference = "marco_ejecutado",
    action = accion,
    reconstruccion_valida = TRUE,
    delta_ch = deltas[[1]],
    delta_matriculas = deltas[[2]],
    delta_estudiantes_unicos = deltas[[3]]
  )
}

# Alinea los flags previos al aula_frame por classroom_id. El motor los emite
# en el mismo orden, pero el match explícito evita atribuir un delta si un
# consumidor interno llegara a reordenarlos.
.cm_criterio_radiografia_flags_base <- function(aula_frame, flags,
                                                 excluir = character(0)) {
  n <- nrow(aula_frame)
  invalido <- list(ok = rep(FALSE, n), valido = FALSE)
  if (!is.data.frame(flags) || nrow(flags) != n || !n) return(invalido)
  idx <- seq_len(n)
  if ("classroom_id" %in% names(flags) && "classroom_id" %in% names(aula_frame)) {
    ids_frame <- .cm_aulas_values(aula_frame, "classroom_id", "")
    ids_flags <- .cm_aulas_values(flags, "classroom_id", "")
    if (any(!nzchar(ids_frame)) || anyDuplicated(ids_frame) || anyDuplicated(ids_flags)) {
      return(invalido)
    }
    idx <- match(ids_frame, ids_flags)
    if (anyNA(idx)) return(invalido)
  }
  columnas <- setdiff(setdiff(names(flags), "classroom_id"), excluir)
  if (!length(columnas)) return(invalido)
  ok <- rep(TRUE, n)
  for (col in columnas) {
    flag <- suppressWarnings(as.logical(flags[[col]][idx]))
    if (length(flag) != n || anyNA(flag)) return(invalido)
    ok <- ok & flag
  }
  list(ok = ok, valido = TRUE)
}

# Agrega todos los pasos de la suite salvo session_type. `minEligible` puede
# aparecer también en flags; conjugarlo dos veces es idempotente y conserva la
# fuente literal que produjo el evaluador.
.cm_criterio_radiografia_pasos_base <- function(pasos, n) {
  invalido <- list(ok = rep(FALSE, n), valido = FALSE)
  if (!is.list(pasos)) return(invalido)
  ok <- rep(TRUE, n)
  for (paso in pasos) {
    if (!is.list(paso)) return(invalido)
    id <- .cm_aulas_scalar(paso$id, "")
    if (identical(id, "session_type")) next
    flag <- suppressWarnings(as.logical(paso$flag))
    if (length(flag) != n || anyNA(flag)) return(invalido)
    ok <- ok & flag
  }
  list(ok = ok, valido = TRUE)
}

.cm_criterio_radiografia_session_paso_valido <- function(pasos, esperado, n) {
  if (!is.list(pasos)) return(FALSE)
  encontrados <- Filter(function(p) {
    is.list(p) && identical(.cm_aulas_scalar(p$id, ""), "session_type")
  }, pasos)
  if (!length(encontrados)) return(TRUE)
  all(vapply(encontrados, function(p) {
    flag <- suppressWarnings(as.logical(p$flag))
    length(flag) == n && !anyNA(flag) && isTRUE(all(flag == esperado))
  }, logical(1)))
}

.cm_criterio_radiografia_pasos_sin <- function(pasos, n, excluir_id) {
  invalido <- list(ok = rep(FALSE, n), valido = FALSE)
  if (!is.list(pasos)) return(invalido)
  ok <- rep(TRUE, n)
  for (paso in pasos) {
    if (!is.list(paso)) return(invalido)
    if (identical(.cm_aulas_scalar(paso$id, ""), excluir_id)) next
    flag <- suppressWarnings(as.logical(paso$flag))
    if (length(flag) != n || anyNA(flag)) return(invalido)
    ok <- ok & flag
  }
  list(ok = ok, valido = TRUE)
}

.cm_criterio_radiografia_paso_valido <- function(pasos, id, esperado, n) {
  if (!is.list(pasos)) return(FALSE)
  encontrados <- Filter(function(p) {
    is.list(p) && identical(.cm_aulas_scalar(p$id, ""), id)
  }, pasos)
  if (!length(encontrados)) return(isTRUE(all(esperado)))
  all(vapply(encontrados, function(p) {
    flag <- suppressWarnings(as.logical(p$flag))
    length(flag) == n && !anyNA(flag) && isTRUE(all(flag == esperado))
  }, logical(1)))
}

.cm_criterio_radiografia_manual_ok <- function(aula_frame, particularidades) {
  decisiones <- if (is.list(particularidades)) particularidades$decisiones else NULL
  decisiones <- .cm_particularidades_normalize_decisiones(decisiones)
  excluir <- names(decisiones)[vapply(
    decisiones, function(x) identical(x$decision, "excluir"), logical(1)
  )]
  !(.cm_aulas_values(aula_frame, "classroom_id", "") %in% excluir)
}

.cm_criterio_radiografia_label_modal <- function(values, idx, fallback = "") {
  if (!length(idx)) return(fallback)
  valor <- .cm_aulas_mode(values[idx], fallback)
  if (!nzchar(valor)) fallback else valor
}

.cm_criterio_radiografia_catalogos <- function(tipos, facultades) {
  tipo_keys <- .cm_aulas_text_key(tipos)
  tipo_vacios <- !nzchar(tipo_keys)
  categorias <- lapply(sort(unique(tipo_keys[!tipo_vacios])), function(k) {
    idx <- which(tipo_keys == k)
    list(
      key = k,
      label = .cm_criterio_radiografia_label_modal(tipos, idx, k),
      empty = FALSE
    )
  })
  if (any(tipo_vacios)) {
    categorias[[length(categorias) + 1L]] <- list(
      key = .cm_criterio_radiografia_missing_session_key,
      label = "Sin dato", empty = TRUE
    )
  }
  if (length(categorias)) {
    etiquetas <- vapply(categorias, function(x) x$label, character(1))
    categorias <- categorias[order(etiquetas)]
  }

  fac_eval_keys <- .cm_criterios_fac_key(facultades)
  facultad_keys <- unique(fac_eval_keys)
  facultad_catalogo <- lapply(facultad_keys, function(k) {
    idx <- which(fac_eval_keys == k)
    vacia <- !nzchar(k)
    list(
      eval_key = k,
      key = if (vacia) .cm_criterio_radiografia_missing_faculty_key else k,
      label = if (vacia) "Sin dato" else
        .cm_criterio_radiografia_label_modal(facultades, idx, k)
    )
  })
  if (length(facultad_catalogo)) {
    etiquetas <- vapply(facultad_catalogo, function(x) x$label, character(1))
    facultad_catalogo <- facultad_catalogo[order(etiquetas)]
  }
  list(
    tipo_keys = tipo_keys,
    fac_eval_keys = fac_eval_keys,
    categorias = categorias,
    facultades = facultad_catalogo
  )
}

.cm_criterio_radiografia_eval_set <- function(tipos, mode, categories) {
  claves <- .cm_aulas_text_key(tipos)
  vapply(claves, function(k) {
    if (!nzchar(k) || !length(categories)) return(TRUE)
    hit <- k %in% categories
    if (identical(mode, "exclude")) !hit else hit
  }, logical(1))
}

.cm_criterio_radiografia_accion <- function(category_key, categories, empty) {
  # Solo la AUSENCIA de tipo es no accionable: una categoría real con 0 CH en
  # esta facultad todavía puede cruzar set vacío↔no vacío y cambiar otros CH.
  if (isTRUE(empty)) return(list(accion = "no_aplica", categories = categories))
  seleccionada <- category_key %in% categories
  if (seleccionada) {
    nuevas <- setdiff(categories, category_key)
    accion <- if (!length(nuevas)) "quitar_restriccion" else "quitar_categoria"
  } else {
    accion <- if (!length(categories)) "restringir_a_categoria" else "agregar_categoria"
    nuevas <- unique(c(categories, category_key))
  }
  list(accion = accion, categories = nuevas)
}

.cm_criterio_radiografia_delta <- function(
    accion, nuevas_categories, fac_idx, tipos, mode, session_actual,
    base_ok, manual_ok, included_actual, eligible_n, reconstruccion_valida) {
  if (identical(accion, "no_aplica")) {
    return(list(
      delta_ch = 0L, delta_matriculas_elegibles = 0,
      included_nuevo = included_actual
    ))
  }
  if (!isTRUE(reconstruccion_valida)) {
    return(list(
      delta_ch = NA_integer_, delta_matriculas_elegibles = NA_real_,
      included_nuevo = logical(0)
    ))
  }
  session_nueva <- session_actual
  session_nueva[fac_idx] <- .cm_criterio_radiografia_eval_set(
    tipos[fac_idx], mode, nuevas_categories
  )
  included_nuevo <- base_ok & session_nueva & manual_ok
  cambiadas <- xor(included_actual, included_nuevo)
  delta_ch <- as.integer(sum(included_nuevo) - sum(included_actual))
  delta_matriculas <- if (any(cambiadas & !is.finite(eligible_n))) {
    NA_real_
  } else {
    as.numeric(sum(eligible_n[included_nuevo & !included_actual]) -
      sum(eligible_n[included_actual & !included_nuevo]))
  }
  list(
    delta_ch = delta_ch,
    delta_matriculas_elegibles = delta_matriculas,
    included_nuevo = included_nuevo
  )
}

# Devuelve NULL cuando no existe el output efectivo del evaluador (proyecto
# legacy/sin suite): el sibling es opcional y no proyecta columnas modales para
# fingir el grano. En mode include/exclude activo sí reconstruye el ejecutado;
# cualquier divergencia fila a fila conserva las estadísticas observadas pero
# degrada todos los deltas accionables a NA.
calc_muestra_aulas_criterios_radiografia <- function(
    aula_frame, criterios, criterios_seleccion = NULL,
    particularidades = NULL, frame_hash = NA_character_,
    criterios_catalogo = NULL) {
  if (!is.data.frame(aula_frame) || !nrow(aula_frame) || !is.list(criterios) ||
      !"included" %in% names(aula_frame)) {
    return(NULL)
  }
  seleccion_aula <- criterios$seleccion_aula
  valores <- if (is.list(seleccion_aula)) seleccion_aula$valores else NULL
  n <- nrow(aula_frame)
  if (!is.list(valores) || length(valores$session_type) != n ||
      length(valores$faculty) != n) {
    return(NULL)
  }
  tipos <- trimws(as.character(valores$session_type))
  facultades <- trimws(as.character(valores$faculty))
  tipos[is.na(tipos)] <- ""
  facultades[is.na(facultades)] <- ""

  seleccion <- .cm_criterios_normalize_seleccion(criterios_seleccion)
  criterio <- seleccion$byVariable$session_type
  if (is.null(criterio)) {
    criterio <- .cm_criterios_normalize_criterio(
      list(mode = "include", categories = list()),
      .cm_criterios_var_registry()$session_type
    )
  }
  catalogos <- .cm_criterio_radiografia_catalogos(tipos, facultades)
  included_actual <- suppressWarnings(as.logical(aula_frame$included))
  included_valido <- length(included_actual) == n && !anyNA(included_actual)
  if (!included_valido) included_actual <- rep(FALSE, n)
  eligible_n <- if ("eligible_n" %in% names(aula_frame)) {
    .cm_aulas_num_values(aula_frame, "eligible_n", NA_real_)
  } else {
    rep(NA_real_, n)
  }

  flags <- .cm_criterio_radiografia_flags_base(aula_frame, criterios$flags)
  pasos <- .cm_criterio_radiografia_pasos_base(seleccion_aula$pasos, n)
  base_ok <- flags$ok & pasos$ok
  manual_ok <- .cm_criterio_radiografia_manual_ok(aula_frame, particularidades)
  session_actual <- .cm_criterios_eval_flat_vec(
    tipos, criterio, catalogos$fac_eval_keys
  )
  paso_session_valido <- .cm_criterio_radiografia_session_paso_valido(
    seleccion_aula$pasos, session_actual, n
  )
  reconstruido <- base_ok & session_actual & manual_ok
  reconstruccion_valida <- flags$valido && pasos$valido && included_valido &&
    paso_session_valido && isTRUE(all(reconstruido == included_actual))
  ids_por_ch <- .cm_criterio_radiografia_ids_por_ch(aula_frame, eligible_n)

  filas <- list()
  filas_v2 <- list()
  for (fac in catalogos$facultades) {
    fac_idx <- which(catalogos$fac_eval_keys == fac$eval_key)
    categories_efectivas <- .cm_criterios_eff_cats(criterio, fac$eval_key)
    for (categoria in catalogos$categorias) {
      categoria_idx <- if (isTRUE(categoria$empty)) {
        fac_idx[!nzchar(catalogos$tipo_keys[fac_idx])]
      } else {
        fac_idx[catalogos$tipo_keys[fac_idx] == categoria$key]
      }
      elegibles_idx <- categoria_idx[included_actual[categoria_idx]]
      accion <- .cm_criterio_radiografia_accion(
        categoria$key, categories_efectivas, categoria$empty
      )
      delta <- .cm_criterio_radiografia_delta(
        accion = accion$accion,
        nuevas_categories = accion$categories,
        fac_idx = fac_idx,
        tipos = tipos,
        mode = criterio$mode,
        session_actual = session_actual,
        base_ok = base_ok,
        manual_ok = manual_ok,
        included_actual = included_actual,
        eligible_n = eligible_n,
        reconstruccion_valida = reconstruccion_valida
      )
      actual_v2 <- .cm_criterio_radiografia_snapshot(
        elegibles_idx, eligible_n, ids_por_ch
      )
      contraste_v2 <- .cm_criterio_radiografia_snapshot(
        categoria_idx, eligible_n, ids_por_ch
      )
      delta_v2 <- .cm_criterio_radiografia_delta_atomico(
        accion = accion$accion,
        reconstruccion_valida = reconstruccion_valida,
        included_actual = included_actual,
        included_nuevo = delta$included_nuevo,
        eligible_n_actual = eligible_n,
        eligible_n_nuevo = eligible_n,
        ids_actual = ids_por_ch,
        ids_nuevo = ids_por_ch
      )
      filas[[length(filas) + 1L]] <- list(
        criterio = "session_type",
        facultad_key = fac$key,
        facultad_label = fac$label,
        categoria_key = categoria$key,
        categoria_label = categoria$label,
        n_ch_total = as.integer(length(categoria_idx)),
        n_ch_elegibles = as.integer(length(elegibles_idx)),
        n_matriculas_elegibles = .cm_criterio_radiografia_suma_estricta(
          eligible_n[elegibles_idx]
        ),
        distribucion_elegible = .cm_criterio_radiografia_resumen(
          eligible_n[elegibles_idx], cuantiles = TRUE
        ),
        contraste_total = .cm_criterio_radiografia_resumen(
          eligible_n[categoria_idx], cuantiles = FALSE
        ),
        delta_marginal = list(
          referencia = "marco_ejecutado",
          accion = accion$accion,
          delta_ch = delta$delta_ch,
          delta_matriculas_elegibles = delta$delta_matriculas_elegibles
        )
      )
      filas_v2[[length(filas_v2) + 1L]] <- list(
        faculty_key = fac$key,
        faculty_label = fac$label,
        segment_key = categoria$key,
        segment_label = categoria$label,
        segment_kind = if (isTRUE(categoria$empty)) "sin_dato" else "categoria",
        actual = actual_v2,
        contraste_total = contraste_v2,
        delta = delta_v2
      )
    }
  }

  catalog_vars <- if (is.list(criterios_catalogo) && is.list(criterios_catalogo$variables)) {
    criterios_catalogo$variables
  } else {
    list()
  }
  catalog_ids <- vapply(catalog_vars, function(v) .cm_aulas_scalar(v$id, ""), character(1))
  inventario_ids <- catalog_ids[nzchar(catalog_ids)]
  catalogo_explicito <- is.list(criterios_catalogo) &&
    !is.null(criterios_catalogo$variables)
  if (!length(inventario_ids) && !catalogo_explicito) {
    inventario_ids <- unique(vapply(
      seleccion_aula$pasos %||% list(),
      function(p) .cm_aulas_scalar(p$id, ""),
      character(1)
    ))
  }
  rows_by_id <- list()
  status_by_id <- list()
  registry <- .cm_criterios_var_registry()
  contexto <- criterios$radiografia_contexto %||% list()
  indice_alumno <- .cm_criterio_radiografia_indice_alumno(
    aula_frame, contexto$filas %||% list()
  )
  estado_actual_alumno <- .cm_criterio_radiografia_estado_alumno(
    aula_frame, criterios, seleccion, particularidades, indice_alumno
  )
  for (id in intersect(
    inventario_ids,
    c("modality", "session_type", "condicion_curso", "campus")
  )) {
    crit <- seleccion$byVariable[[id]]
    if (is.null(crit)) {
      crit <- .cm_criterios_normalize_criterio(
        list(mode = "include", categories = list()), registry[[id]]
      )
    }
    empty_key <- NULL
    if (id %in% (contexto$empty_bucket_cols %||% character(0))) {
      empty_key <- registry[[id]]$emptyBucket$key %||% NULL
    }
    construido <- .cm_criterio_radiografia_rows_flat_aula(
      id = id,
      values = valores[[id]] %||% rep("", n),
      facultades = facultades,
      criterio = crit,
      aula_frame = aula_frame,
      criterios = criterios,
      particularidades = particularidades,
      empty_key = empty_key,
      empty_label = registry[[id]]$emptyBucket$label %||% "Sin dato"
    )
    rows_by_id[[id]] <- construido$rows
    status_by_id[[id]] <- construido$status
  }
  if ("teacher_type" %in% inventario_ids) {
    variable_teacher <- catalog_vars[[match("teacher_type", catalog_ids)]]
    crit <- seleccion$byVariable$teacher_type
    if (is.null(crit)) {
      crit <- .cm_criterios_normalize_criterio(
        list(mode = "include", categories = list()), registry$teacher_type
      )
    }
    construido <- .cm_criterio_radiografia_rows_teacher(
      variable = variable_teacher,
      values = valores$teacher %||% rep("", n),
      facultades = facultades,
      criterio = crit,
      aula_frame = aula_frame,
      criterios = criterios,
      particularidades = particularidades
    )
    rows_by_id$teacher_type <- construido$rows
    status_by_id$teacher_type <- construido$status
  }

  for (i in seq_along(catalog_vars)) {
    variable <- catalog_vars[[i]]
    id <- .cm_aulas_scalar(variable$id, "")
    if (!id %in% c("formation", "condition", "age", "faculty", "level")) next
    construido <- switch(.cm_aulas_scalar(variable$kind, ""),
      flat = .cm_criterio_radiografia_rows_flat_alumno(
        id, variable, aula_frame, criterios, seleccion, particularidades,
        indice_alumno, estado_actual_alumno
      ),
      numeric = .cm_criterio_radiografia_rows_numeric_alumno(
        id, aula_frame, criterios, seleccion, particularidades,
        indice_alumno, estado_actual_alumno
      ),
      ordinal = .cm_criterio_radiografia_rows_ordinal_alumno(
        id, variable, aula_frame, criterios, seleccion, particularidades,
        indice_alumno, estado_actual_alumno
      ),
      list(rows = list(), status = "invalido")
    )
    rows_by_id[[id]] <- construido$rows
    status_by_id[[id]] <- construido$status
  }

  # Familias de regla global: el snapshot se facetiza por facultad efectiva,
  # mientras el contrafactual sustituye/desactiva la regla solo en esa faceta.
  if ("enrolled_total" %in% inventario_ids) {
    crit <- seleccion$byVariable$enrolled_total
    signal <- suppressWarnings(as.numeric(valores$enrolled_total))
    activa <- !is.null(crit) && !is.null(crit$threshold)
    actual_flag <- if (activa) {
      .cm_criterios_eval_numeric(signal, crit$threshold)
    } else {
      rep(TRUE, n)
    }
    preparado <- .cm_criterio_radiografia_preparar_paso(
      "enrolled_total", actual_flag, aula_frame, criterios, particularidades
    )
    rows_by_id$enrolled_total <- .cm_criterio_radiografia_rows_global_aula(
      aula_frame, facultades, actual_flag,
      if (activa) rep(TRUE, n) else actual_flag,
      if (activa) "quitar_restriccion" else "no_aplica",
      preparado, signal = signal, signal_unit = "valor_criterio"
    )
    status_by_id$enrolled_total <- if (!any(is.finite(signal))) {
      "sin_senal"
    } else if (preparado$reconstruccion_valida) {
      "disponible"
    } else {
      "invalido"
    }
    if (identical(status_by_id$enrolled_total, "sin_senal")) {
      rows_by_id$enrolled_total <- list()
    }
  }

  if ("course_level" %in% inventario_ids) {
    ranges <- seleccion$courseLevelRanges %||% list()
    signal <- suppressWarnings(as.numeric(valores$course_level))
    activa <- length(ranges) > 0L
    actual_flag <- if (activa) {
      .cm_criterios_eval_course_ranges(valores$course_pairs, ranges)
    } else {
      rep(TRUE, n)
    }
    preparado <- .cm_criterio_radiografia_preparar_paso(
      "course_level", actual_flag, aula_frame, criterios, particularidades
    )
    rows_by_id$course_level <- .cm_criterio_radiografia_rows_global_aula(
      aula_frame, facultades, actual_flag,
      if (activa) rep(TRUE, n) else actual_flag,
      if (activa) "reemplazar_regla" else "no_aplica",
      preparado, signal = signal, signal_unit = "valor_criterio"
    )
    status_by_id$course_level <- if (!any(is.finite(signal))) {
      "sin_senal"
    } else if (preparado$reconstruccion_valida) {
      "disponible"
    } else {
      "invalido"
    }
    if (identical(status_by_id$course_level, "sin_senal")) {
      rows_by_id$course_level <- list()
    }
  }

  min_elig <- seleccion$minEligible
  if (is.null(min_elig) || !is.finite(min_elig$threshold)) {
    min_elig <- list(
      threshold = max(1L, .cm_aulas_int(contexto$min_eligible_fallback, 1L)),
      byFaculty = list()
    )
  }
  min_signal <- suppressWarnings(as.numeric(valores$eligible_n))
  fac_eval <- .cm_criterios_fac_key(facultades)
  min_actual <- .cm_criterios_eval_min_eligible(min_signal, fac_eval, min_elig)
  min_preparado <- .cm_criterio_radiografia_preparar_paso(
    "minEligible", min_actual, aula_frame, criterios, particularidades,
    flags_excluir = "min_eligible_ok"
  )
  rows_by_id$minEligible <- .cm_criterio_radiografia_rows_global_aula(
    aula_frame, facultades, min_actual, rep(TRUE, n), "desactivar",
    min_preparado, signal = min_signal, signal_unit = "valor_criterio"
  )
  status_by_id$minEligible <- if (!any(is.finite(min_signal))) {
    "sin_senal"
  } else if (min_preparado$reconstruccion_valida) {
    "disponible"
  } else {
    "invalido"
  }
  if (identical(status_by_id$minEligible, "sin_senal")) {
    rows_by_id$minEligible <- list()
  }

  composicion <- list(
    c7 = list(flag = "c7_ok", signal = .cm_aulas_num_values(aula_frame, "prevalence_ratio", NA_real_)),
    c8_facultad = list(flag = "c8_facultad_ok", signal = .cm_aulas_num_values(aula_frame, "faculty_match_share", NA_real_)),
    c8 = list(flag = "c8_ok", signal = .cm_aulas_num_values(aula_frame, "level_match_share", NA_real_))
  )
  for (id in names(composicion)) {
    spec <- composicion[[id]]
    eval_pura <- (contexto$evals %||% list())[[id]] %||% rep(TRUE, n)
    aplicada <- isTRUE((contexto$aplica %||% list())[[id]])
    actual_flag <- if (aplicada) as.logical(eval_pura) else rep(TRUE, n)
    counter_flag <- if (aplicada) rep(TRUE, n) else as.logical(eval_pura)
    preparado <- .cm_criterio_radiografia_preparar_flag(
      id, spec$flag, actual_flag, aula_frame, criterios, particularidades
    )
    rows_by_id[[id]] <- .cm_criterio_radiografia_rows_global_aula(
      aula_frame, facultades, actual_flag, counter_flag,
      if (aplicada) "desactivar" else "activar",
      preparado, signal = spec$signal, signal_unit = "proporcion"
    )
    status_by_id[[id]] <- if (!any(is.finite(spec$signal))) {
      "sin_senal"
    } else if (preparado$reconstruccion_valida) {
      "disponible"
    } else {
      "invalido"
    }
    if (identical(status_by_id[[id]], "sin_senal")) rows_by_id[[id]] <- list()
  }
  if (!is.null(rows_by_id$session_type)) filas_v2 <- rows_by_id$session_type
  filas_publicas <- if (catalogo_explicito && !"session_type" %in% catalog_ids) list() else filas

  criterios_out <- .cm_criterio_radiografia_inventario(
    catalogo = criterios_catalogo,
    seleccion = seleccion,
    valores = valores,
    filas_session = filas_v2,
    criterios = criterios,
    rows_by_id = rows_by_id,
    status_by_id = status_by_id
  )

  structure(list(
    schema = "calc_muestra_aulas_criterios_radiografia_v2",
    owner = .cm_criterio_radiografia_owner,
    frame_hash = .cm_aulas_scalar(frame_hash, NA_character_),
    momento = "marco_ejecutado",
    grano = .cm_criterio_radiografia_grano,
    unidad = .cm_criterio_radiografia_unidad,
    filas_owner = .cm_criterio_radiografia_filas_owner,
    filas_grano = .cm_criterio_radiografia_filas_grano,
    filas = filas_publicas,
    criterios = criterios_out
  ), calc_muestra_aulas_criterios_indice_alumno = indice_alumno)
}

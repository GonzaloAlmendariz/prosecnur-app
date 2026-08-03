.cm_criterio_radiografia_catalogos_flat <- function(id, values, facultades,
                                                     empty_key = NULL,
                                                     empty_label = "Sin dato") {
  raw <- trimws(as.character(values %||% character(0)))
  raw[is.na(raw)] <- ""
  keys <- .cm_aulas_text_key(raw)
  vacios <- !nzchar(keys)
  missing_key <- if (!is.null(empty_key) && nzchar(empty_key)) {
    empty_key
  } else {
    paste0("__missing_", id, "__")
  }
  keys[vacios] <- missing_key
  categorias <- lapply(sort(unique(keys[!vacios])), function(key) {
    idx <- which(keys == key)
    list(
      key = key,
      label = .cm_criterio_radiografia_label_modal(raw, idx, key),
      empty = FALSE,
      actionable = TRUE
    )
  })
  if (any(vacios)) {
    categorias[[length(categorias) + 1L]] <- list(
      key = missing_key,
      label = empty_label,
      empty = TRUE,
      actionable = !is.null(empty_key) && nzchar(empty_key)
    )
  }
  if (length(categorias)) {
    labels <- vapply(categorias, function(x) x$label, character(1))
    categorias <- categorias[order(labels)]
  }
  fac_raw <- trimws(as.character(facultades %||% character(0)))
  fac_raw[is.na(fac_raw)] <- ""
  fac_eval <- .cm_criterios_fac_key(fac_raw)
  facs <- lapply(unique(fac_eval), function(key) {
    idx <- which(fac_eval == key)
    list(
      eval_key = key,
      key = if (nzchar(key)) key else .cm_criterio_radiografia_missing_faculty_key,
      label = if (nzchar(key)) {
        .cm_criterio_radiografia_label_modal(fac_raw, idx, key)
      } else {
        "Sin dato"
      }
    )
  })
  if (length(facs)) {
    labels <- vapply(facs, function(x) x$label, character(1))
    facs <- facs[order(labels)]
  }
  list(keys = keys, fac_eval = fac_eval, categorias = categorias, facultades = facs)
}

.cm_criterio_radiografia_eval_flat_set <- function(values, mode, categories,
                                                    empty_key = NULL) {
  keys <- .cm_aulas_text_key(values)
  if (!is.null(empty_key) && nzchar(empty_key)) keys[!nzchar(keys)] <- empty_key
  vapply(keys, function(key) {
    if (!nzchar(key) || !length(categories)) return(TRUE)
    hit <- key %in% categories
    if (identical(mode, "exclude")) !hit else hit
  }, logical(1))
}

.cm_criterio_radiografia_rows_flat_aula <- function(
    id, values, facultades, criterio, aula_frame, criterios,
    particularidades, empty_key = NULL, empty_label = "Sin dato") {
  n <- nrow(aula_frame)
  vacio <- list(rows = list(), status = "invalido", reconstruccion_valida = FALSE)
  if (!n || length(values) != n || length(facultades) != n) return(vacio)
  catalogos <- .cm_criterio_radiografia_catalogos_flat(
    id, values, facultades, empty_key = empty_key, empty_label = empty_label
  )
  if (!length(catalogos$categorias) || !length(catalogos$facultades)) {
    return(list(rows = list(), status = "sin_senal", reconstruccion_valida = FALSE))
  }
  included_actual <- suppressWarnings(as.logical(aula_frame$included))
  included_valido <- length(included_actual) == n && !anyNA(included_actual)
  if (!included_valido) included_actual <- rep(FALSE, n)
  eligible_n <- .cm_aulas_num_values(aula_frame, "eligible_n", NA_real_)
  ids_por_ch <- .cm_criterio_radiografia_ids_por_ch(aula_frame, eligible_n)
  flags <- .cm_criterio_radiografia_flags_base(aula_frame, criterios$flags)
  pasos <- .cm_criterio_radiografia_pasos_sin(
    (criterios$seleccion_aula %||% list())$pasos, n, id
  )
  manual_ok <- .cm_criterio_radiografia_manual_ok(aula_frame, particularidades)
  actual_flag <- .cm_criterios_eval_flat_vec(
    values, criterio, catalogos$fac_eval, empty_key = empty_key
  )
  paso_valido <- .cm_criterio_radiografia_paso_valido(
    (criterios$seleccion_aula %||% list())$pasos, id, actual_flag, n
  )
  base_ok <- flags$ok & pasos$ok
  reconstruido <- base_ok & actual_flag & manual_ok
  reconstruccion_valida <- flags$valido && pasos$valido && included_valido &&
    paso_valido && isTRUE(all(reconstruido == included_actual))

  rows <- list()
  for (fac in catalogos$facultades) {
    fac_idx <- which(catalogos$fac_eval == fac$eval_key)
    # F111 · Cortes comunes a TODOS los segmentos de esta facultad. Se calculan
    # sobre su universo —no por segmento— porque la tarjeta existe para comparar
    # categorías entre sí, y dos histogramas con cortes distintos no comparan
    # nada (ADR 0057, regla 3).
    breaks_fac <- .cm_criterio_radiografia_breaks(eligible_n[fac_idx])
    cats_efectivas <- .cm_criterios_eff_cats(criterio, fac$eval_key)
    for (segmento in catalogos$categorias) {
      segment_idx <- fac_idx[catalogos$keys[fac_idx] == segmento$key]
      actual_idx <- segment_idx[included_actual[segment_idx]]
      accion <- .cm_criterio_radiografia_accion(
        segmento$key, cats_efectivas, !isTRUE(segmento$actionable)
      )
      nuevo_flag <- actual_flag
      nuevo_flag[fac_idx] <- .cm_criterio_radiografia_eval_flat_set(
        values[fac_idx], criterio$mode, accion$categories, empty_key = empty_key
      )
      included_nuevo <- if (isTRUE(reconstruccion_valida)) {
        base_ok & nuevo_flag & manual_ok
      } else {
        logical(0)
      }
      rows[[length(rows) + 1L]] <- list(
        faculty_key = fac$key,
        faculty_label = fac$label,
        segment_key = segmento$key,
        segment_label = segmento$label,
        segment_kind = if (isTRUE(segmento$empty)) "sin_dato" else "categoria",
        actual = .cm_criterio_radiografia_snapshot(actual_idx, eligible_n, ids_por_ch, breaks_fac),
        contraste_total = .cm_criterio_radiografia_snapshot(segment_idx, eligible_n, ids_por_ch, breaks_fac),
        delta = .cm_criterio_radiografia_delta_atomico(
          accion = accion$accion,
          reconstruccion_valida = reconstruccion_valida,
          included_actual = included_actual,
          included_nuevo = included_nuevo,
          eligible_n_actual = eligible_n,
          eligible_n_nuevo = eligible_n,
          ids_actual = ids_por_ch,
          ids_nuevo = ids_por_ch
        )
      )
    }
  }
  status <- if (!length(rows)) "sin_senal" else if (reconstruccion_valida) {
    "disponible"
  } else {
    "invalido"
  }
  list(rows = rows, status = status, reconstruccion_valida = reconstruccion_valida)
}

# -----------------------------------------------------------------------------
# Señal del criterio — contrato v2 (G38)
# -----------------------------------------------------------------------------
#
# Gonzalo: «la distribución y el boxplot no estaban mal pero debían hacer
# referencia al porcentaje de su composición, no a la cantidad de alumnos
# elegibles […] podemos hacer que la distribución tenga ejes del 0 al 100 porque
# es un porcentaje».
#
# G25 corrigió un error real —la tarjeta rotulaba conteos como porcentajes— pero
# por el lado equivocado: cambió la etiqueta en vez del dato. Los tres criterios
# de composición se deciden con un umbral en % mientras su gráfico describía otra
# variable. El dato correcto ya existía aquí; le faltaba contrato y unidad.
#
# Tres reglas:
#
# 1. **La señal viaja en la unidad del control.** `proporcion` sale en porcentaje
#    0–100, no en razón 0–1, porque el umbral se fija en %. Así la distribución,
#    los cuantiles, los cortes del histograma y el corte se leen en la misma
#    escala. Escalar en el cliente reintroduce la ambigüedad que causó G25.
# 2. **La escala la fija el dominio, no los datos.** Para una proporción es
#    0–100: un eje ajustado al rango observado hace que «85 %» parezca el extremo
#    de la escala cuando es el 85 % de un máximo posible de 100.
# 3. **`n_fuera` lo cuenta el motor.** Es la pregunta literal de Gonzalo —«no hay
#    forma de saber cuántos perdemos por el porcentaje que estamos aplicando»— y
#    es una cuenta sobre los datos, no una resta de dos cifras ya publicadas.
.cm_criterio_radiografia_signal_distribution <- function(v, unit, umbral = NULL) {
  v <- suppressWarnings(as.numeric(v))
  es_proporcion <- identical(unit, "proporcion")
  if (es_proporcion) v <- v * 100
  n_total <- as.integer(length(v))
  n_dato <- as.integer(sum(is.finite(v)))

  # El umbral llega en la misma unidad en que se fija el control: fracción para
  # composición (0,80). Se lleva a la escala publicada para que comparar sea
  # comparar, no convertir.
  umbral_pub <- if (is.null(umbral)) NA_real_ else {
    u <- suppressWarnings(as.numeric(umbral))[[1]]
    if (is.finite(u) && es_proporcion && u <= 1) u * 100 else u
  }
  n_fuera <- if (is.finite(umbral_pub)) {
    as.integer(sum(is.finite(v) & v < umbral_pub))
  } else {
    NA_integer_
  }

  breaks <- .cm_criterio_radiografia_breaks(v)
  dist <- .cm_criterio_radiografia_distribucion(v, breaks = breaks)
  c(
    list(unit = unit, n_total = n_total, n_con_dato = n_dato),
    dist,
    list(
      escala = if (es_proporcion) list(min = 0, max = 100) else NULL,
      umbral_aplicado = umbral_pub,
      n_fuera = n_fuera
    )
  )
}

.cm_criterio_radiografia_facultades <- function(facultades) {
  catalogos <- .cm_criterio_radiografia_catalogos_flat(
    "global", rep("global", length(facultades)), facultades
  )
  list(keys = catalogos$fac_eval, values = catalogos$facultades)
}

.cm_criterio_radiografia_preparar_paso <- function(
    id, actual_flag, aula_frame, criterios, particularidades,
    flags_excluir = character(0)) {
  n <- nrow(aula_frame)
  included <- suppressWarnings(as.logical(aula_frame$included))
  included_valido <- length(included) == n && !anyNA(included)
  if (!included_valido) included <- rep(FALSE, n)
  flags <- .cm_criterio_radiografia_flags_base(
    aula_frame, criterios$flags, excluir = flags_excluir
  )
  pasos <- .cm_criterio_radiografia_pasos_sin(
    (criterios$seleccion_aula %||% list())$pasos, n, id
  )
  manual <- .cm_criterio_radiografia_manual_ok(aula_frame, particularidades)
  paso_valido <- .cm_criterio_radiografia_paso_valido(
    (criterios$seleccion_aula %||% list())$pasos, id, actual_flag, n
  )
  base_ok <- flags$ok & pasos$ok
  reconstruccion <- flags$valido && pasos$valido && included_valido &&
    paso_valido && isTRUE(all((base_ok & actual_flag & manual) == included))
  list(
    base_ok = base_ok,
    manual_ok = manual,
    included_actual = included,
    reconstruccion_valida = reconstruccion
  )
}

.cm_criterio_radiografia_preparar_flag <- function(
    id, flag_col, actual_flag, aula_frame, criterios, particularidades) {
  n <- nrow(aula_frame)
  included <- suppressWarnings(as.logical(aula_frame$included))
  included_valido <- length(included) == n && !anyNA(included)
  if (!included_valido) included <- rep(FALSE, n)
  flags <- .cm_criterio_radiografia_flags_base(
    aula_frame, criterios$flags, excluir = flag_col
  )
  pasos <- .cm_criterio_radiografia_pasos_sin(
    (criterios$seleccion_aula %||% list())$pasos, n, "__ninguno__"
  )
  manual <- .cm_criterio_radiografia_manual_ok(aula_frame, particularidades)
  flag_guardado <- criterios$flags[[flag_col]] %||% logical(0)
  flag_valido <- length(flag_guardado) == n && !anyNA(flag_guardado) &&
    isTRUE(all(as.logical(flag_guardado) == actual_flag))
  base_ok <- flags$ok & pasos$ok
  reconstruccion <- flags$valido && pasos$valido && included_valido &&
    flag_valido && isTRUE(all((base_ok & actual_flag & manual) == included))
  list(
    base_ok = base_ok,
    manual_ok = manual,
    included_actual = included,
    reconstruccion_valida = reconstruccion
  )
}

.cm_criterio_radiografia_rows_global_aula <- function(
    aula_frame, facultades, actual_flag, counter_flag, action,
    preparado, signal = NULL, signal_unit = "valor_criterio",
    segment_key = "global", segment_label = "Cursos-horario que cumplen") {
  n <- nrow(aula_frame)
  if (!n || length(facultades) != n || length(actual_flag) != n ||
      length(counter_flag) != n) {
    return(list())
  }
  eligible_n <- .cm_aulas_num_values(aula_frame, "eligible_n", NA_real_)
  ids_por_ch <- .cm_criterio_radiografia_ids_por_ch(aula_frame, eligible_n)
  facs <- .cm_criterio_radiografia_facultades(facultades)
  rows <- list()
  for (fac in facs$values) {
    fac_idx <- which(facs$keys == fac$eval_key)
    # F111 · Cortes comunes a los segmentos de esta facultad (ADR 0057, regla 3).
    breaks_fac <- .cm_criterio_radiografia_breaks(eligible_n[fac_idx])
    actual_idx <- fac_idx[preparado$included_actual[fac_idx]]
    target_nuevo <- actual_flag
    target_nuevo[fac_idx] <- counter_flag[fac_idx]
    included_nuevo <- if (isTRUE(preparado$reconstruccion_valida)) {
      preparado$base_ok & target_nuevo & preparado$manual_ok
    } else {
      logical(0)
    }
    row <- list(
      faculty_key = fac$key,
      faculty_label = fac$label,
      segment_key = segment_key,
      segment_label = segment_label,
      segment_kind = "global",
      actual = .cm_criterio_radiografia_snapshot(actual_idx, eligible_n, ids_por_ch, breaks_fac),
      contraste_total = .cm_criterio_radiografia_snapshot(fac_idx, eligible_n, ids_por_ch, breaks_fac),
      delta = .cm_criterio_radiografia_delta_atomico(
        accion = action,
        reconstruccion_valida = preparado$reconstruccion_valida,
        included_actual = preparado$included_actual,
        included_nuevo = included_nuevo,
        eligible_n_actual = eligible_n,
        eligible_n_nuevo = eligible_n,
        ids_actual = ids_por_ch,
        ids_nuevo = ids_por_ch
      )
    )
    if (!is.null(signal)) {
      row$signal_distribution <- .cm_criterio_radiografia_signal_distribution(
        signal[fac_idx], signal_unit
      )
    }
    rows[[length(rows) + 1L]] <- row
  }
  rows
}

.cm_criterio_radiografia_teacher_segments <- function(variable, values) {
  values <- trimws(as.character(values %||% character(0)))
  piezas <- lapply(values, function(x) {
    if (!nzchar(x)) return(character(0))
    unique(trimws(strsplit(x, "\\s*\\|+\\s*")[[1]]))
  })
  child_keys <- lapply(piezas, function(x) vapply(x, .cm_aulas_text_key, character(1)))
  group_keys <- lapply(piezas, function(x) vapply(x, .cm_criterios_teacher_group, character(1)))
  out <- list()
  if (identical(.cm_aulas_scalar(variable$kind, ""), "hierarchical")) {
    for (group in variable$groups %||% list()) {
      key <- .cm_aulas_scalar(group$key, "")
      if (!nzchar(key)) next
      out[[length(out) + 1L]] <- list(
        key = key,
        label = .cm_aulas_scalar(group$label, key),
        kind = "grupo",
        mask = vapply(group_keys, function(x) key %in% x, logical(1))
      )
      for (child in group$children %||% list()) {
        child_key <- .cm_aulas_scalar(child$key, "")
        if (!nzchar(child_key)) next
        if (identical(child_key, key)) next
        out[[length(out) + 1L]] <- list(
          key = child_key,
          label = .cm_aulas_scalar(child$label, child_key),
          kind = "categoria",
          mask = vapply(child_keys, function(x) child_key %in% x, logical(1))
        )
      }
    }
  } else {
    for (category in variable$categories %||% list()) {
      key <- .cm_aulas_scalar(category$key, "")
      if (!nzchar(key)) next
      out[[length(out) + 1L]] <- list(
        key = key,
        label = .cm_aulas_scalar(category$label, key),
        kind = "categoria",
        mask = vapply(child_keys, function(x) key %in% x, logical(1))
      )
    }
  }
  out
}

.cm_criterio_radiografia_rows_teacher <- function(
    variable, values, facultades, criterio, aula_frame, criterios,
    particularidades) {
  n <- nrow(aula_frame)
  segmentos <- .cm_criterio_radiografia_teacher_segments(variable, values)
  if (!n || !length(segmentos)) {
    return(list(rows = list(), status = "sin_senal", reconstruccion_valida = FALSE))
  }
  facs <- .cm_criterio_radiografia_facultades(facultades)
  actual_flag <- .cm_criterios_eval_teacher(values, criterio, facs$keys)
  preparado <- .cm_criterio_radiografia_preparar_paso(
    "teacher_type", actual_flag, aula_frame, criterios, particularidades
  )
  eligible_n <- .cm_aulas_num_values(aula_frame, "eligible_n", NA_real_)
  ids_por_ch <- .cm_criterio_radiografia_ids_por_ch(aula_frame, eligible_n)
  rows <- list()
  for (fac in facs$values) {
    fac_idx <- which(facs$keys == fac$eval_key)
    # F111 · Cortes comunes a los segmentos de esta facultad (ADR 0057, regla 3).
    breaks_fac <- .cm_criterio_radiografia_breaks(eligible_n[fac_idx])
    cats_efectivas <- .cm_criterios_eff_cats(criterio, fac$eval_key)
    for (segmento in segmentos) {
      segment_idx <- fac_idx[segmento$mask[fac_idx]]
      actual_idx <- segment_idx[preparado$included_actual[segment_idx]]
      accion <- .cm_criterio_radiografia_accion(
        segmento$key, cats_efectivas, empty = FALSE
      )
      nuevo_criterio <- criterio
      nuevo_criterio$categories <- accion$categories
      nuevo_flag <- actual_flag
      nuevo_flag[fac_idx] <- .cm_criterios_eval_teacher(
        values[fac_idx], nuevo_criterio, rep(fac$eval_key, length(fac_idx))
      )
      included_nuevo <- if (isTRUE(preparado$reconstruccion_valida)) {
        preparado$base_ok & nuevo_flag & preparado$manual_ok
      } else {
        logical(0)
      }
      rows[[length(rows) + 1L]] <- list(
        faculty_key = fac$key,
        faculty_label = fac$label,
        segment_key = segmento$key,
        segment_label = segmento$label,
        segment_kind = segmento$kind,
        actual = .cm_criterio_radiografia_snapshot(actual_idx, eligible_n, ids_por_ch, breaks_fac),
        contraste_total = .cm_criterio_radiografia_snapshot(segment_idx, eligible_n, ids_por_ch, breaks_fac),
        delta = .cm_criterio_radiografia_delta_atomico(
          accion$accion,
          preparado$reconstruccion_valida,
          preparado$included_actual,
          included_nuevo,
          eligible_n, eligible_n, ids_por_ch, ids_por_ch
        )
      )
    }
  }
  list(
    rows = rows,
    status = if (preparado$reconstruccion_valida) "disponible" else "invalido",
    reconstruccion_valida = preparado$reconstruccion_valida
  )
}

.cm_criterio_radiografia_indice_alumno <- function(aula_frame, filas) {
  n_ch <- nrow(aula_frame)
  sid <- trimws(as.character(filas$student_id %||% character(0)))
  cid <- trimws(as.character(filas$classroom_id %||% character(0)))
  n_row <- length(sid)
  ch_ids <- .cm_aulas_values(aula_frame, "classroom_id", "")
  vacio <- list(
    valido = FALSE,
    n_row = n_row,
    n_ch = n_ch,
    row_ch = rep(NA_integer_, n_row),
    valid_row = rep(FALSE, n_row),
    pair_id = rep(NA_integer_, n_row),
    pair_ch = integer(0),
    pair_student = integer(0),
    numeric_values = list(age = numeric(0), level = numeric(0))
  )
  if (!n_ch || length(cid) != n_row || any(!nzchar(ch_ids)) ||
      anyDuplicated(ch_ids)) {
    return(vacio)
  }

  row_ch <- match(cid, ch_ids)
  valid_row <- nzchar(sid) & !is.na(row_ch)
  valid_idx <- which(valid_row)
  pair_id <- rep(NA_integer_, n_row)
  pair_ch <- integer(0)
  pair_sid <- character(0)
  if (length(valid_idx)) {
    rows_by_ch <- split(valid_idx, row_ch[valid_idx])
    for (key in names(rows_by_ch)) {
      idx <- rows_by_ch[[key]]
      ids <- sid[idx]
      unique_ids <- unique(ids)
      offset <- length(pair_sid)
      pair_id[idx] <- offset + match(ids, unique_ids)
      pair_ch <- c(pair_ch, rep.int(as.integer(key), length(unique_ids)))
      pair_sid <- c(pair_sid, unique_ids)
    }
  }
  student_levels <- unique(pair_sid)
  list(
    valido = TRUE,
    n_row = n_row,
    n_ch = n_ch,
    row_ch = row_ch,
    valid_row = valid_row,
    pair_id = pair_id,
    pair_ch = pair_ch,
    pair_student = match(pair_sid, student_levels),
    numeric_values = list(
      age = .cm_criterios_num_vec(filas$age %||% rep("", n_row)),
      level = .cm_criterios_num_vec(filas$level %||% rep("", n_row))
    )
  )
}

.cm_criterio_radiografia_num_values <- function(indice_alumno, filas, id, n) {
  cached <- (indice_alumno$numeric_values %||% list())[[id]]
  if (length(cached) == n) return(cached)
  .cm_criterios_num_vec(filas[[id]] %||% rep("", n))
}

.cm_criterio_radiografia_eval_alumno <- function(
    seleccion, filas, indice_alumno = NULL) {
  n <- length(filas$student_id %||% character(0))
  base <- suppressWarnings(as.logical(filas$row_base_ok %||% logical(0)))
  if (!n || length(base) != n || anyNA(base)) {
    return(list(ok = rep(FALSE, n), valido = FALSE))
  }
  fac_keys <- .cm_criterios_fac_key(filas$faculty %||% rep("", n))
  ok <- base
  for (id in names(seleccion$byVariable %||% list())) {
    crit <- seleccion$byVariable[[id]]
    if (!identical(crit$scope, "alumno") || !identical(crit$layer, "marco")) next
    flag <- switch(crit$kind,
      flat = .cm_criterios_eval_flat_vec(
        filas[[id]] %||% rep("", n), crit, fac_keys
      ),
      numeric = .cm_criterios_eval_numeric(
        .cm_criterio_radiografia_num_values(indice_alumno, filas, id, n),
        crit$threshold
      ),
      ordinal = .cm_criterios_eval_ordinal(
        .cm_criterio_radiografia_num_values(indice_alumno, filas, id, n), crit
      ),
      rep(TRUE, n)
    )
    if (length(flag) != n || anyNA(flag)) {
      return(list(ok = rep(FALSE, n), valido = FALSE))
    }
    ok <- ok & flag
  }
  list(ok = ok, valido = TRUE)
}

.cm_criterio_radiografia_membresias <- function(
    aula_frame, filas, row_ok, indice_alumno = NULL) {
  n_ch <- nrow(aula_frame)
  vacio <- list(
    eligible_n = rep(NA_real_, n_ch),
    ids = list(
      pair_ch = integer(0), pair_student = integer(0), valido = FALSE
    ),
    row_ok = rep(FALSE, length(row_ok)),
    row_ch = rep(NA_integer_, length(row_ok)),
    valido = FALSE
  )
  if (is.null(indice_alumno)) {
    indice_alumno <- .cm_criterio_radiografia_indice_alumno(aula_frame, filas)
  }
  if (!isTRUE(indice_alumno$valido) || indice_alumno$n_ch != n_ch ||
      indice_alumno$n_row != length(row_ok)) {
    return(vacio)
  }
  keep <- row_ok %in% TRUE & indice_alumno$valid_row
  n_pairs <- length(indice_alumno$pair_ch)
  pair_ok <- tabulate(indice_alumno$pair_id[keep], nbins = n_pairs) > 0L
  counts <- as.numeric(tabulate(
    indice_alumno$pair_ch[pair_ok], nbins = n_ch
  ))
  list(
    eligible_n = counts,
    ids = list(
      pair_ch = indice_alumno$pair_ch[pair_ok],
      pair_student = indice_alumno$pair_student[pair_ok],
      valido = TRUE
    ),
    row_ok = keep,
    row_ch = indice_alumno$row_ch,
    valido = TRUE
  )
}

.cm_criterio_radiografia_composicion <- function(
    aula_frame, filas, membresias, valores, contexto) {
  n <- nrow(aula_frame)
  faculty_share <- rep(NA_real_, n)
  level_share <- rep(NA_real_, n)
  row_ch <- membresias$row_ch
  row_ok <- membresias$row_ok
  sid <- trimws(as.character(filas$student_id %||% rep("", length(row_ok))))
  student_faculty <- trimws(as.character(filas$faculty %||% rep("", length(row_ok))))
  student_level <- trimws(as.character(filas$level %||% rep("", length(row_ok))))
  course_faculty <- trimws(as.character(valores$faculty %||% rep("", n)))
  level_reference <- as.character(contexto$level_reference %||% rep("", n))
  course_level <- suppressWarnings(as.numeric(
    contexto$course_level_num %||% valores$course_level %||% rep(NA_real_, n)
  ))
  for (i in seq_len(n)) {
    idx <- which(row_ok & row_ch == i & nzchar(sid))
    if (!length(idx)) next
    idx <- idx[!duplicated(sid[idx])]
    fac <- student_faculty[idx]
    keep_fac <- nzchar(fac)
    if (nzchar(course_faculty[[i]]) && any(keep_fac)) {
      faculty_share[[i]] <- round(mean(
        .cm_criterios_fac_key(fac[keep_fac]) ==
          .cm_criterios_fac_key(course_faculty[[i]])
      ), 4)
    }
    lvl <- student_level[idx]
    lvl <- lvl[nzchar(lvl)]
    if (!length(lvl)) next
    if (identical(level_reference[[i]], "curso") && is.finite(course_level[[i]])) {
      nums <- .cm_criterios_num_vec(lvl)
      level_share[[i]] <- round(mean(
        is.finite(nums) & nums == course_level[[i]]
      ), 4)
    } else {
      level_share[[i]] <- round(max(table(lvl)) / length(lvl), 4)
    }
  }
  enrolled <- suppressWarnings(as.numeric(valores$enrolled_total %||% rep(NA_real_, n)))
  ratio <- ifelse(
    is.finite(enrolled) & enrolled > 0,
    round(membresias$eligible_n / enrolled, 4),
    NA_real_
  )
  list(c7 = ratio, c8_facultad = faculty_share, c8 = level_share)
}

.cm_criterio_radiografia_estado_alumno <- function(
    aula_frame, criterios, seleccion, particularidades,
    indice_alumno = NULL) {
  contexto <- criterios$radiografia_contexto %||% list()
  filas <- contexto$filas %||% list()
  eval_alumno <- .cm_criterio_radiografia_eval_alumno(
    seleccion, filas, indice_alumno
  )
  membresias <- .cm_criterio_radiografia_membresias(
    aula_frame, filas, eval_alumno$ok, indice_alumno
  )
  n <- nrow(aula_frame)
  invalido <- list(
    valido = FALSE,
    row_ok = eval_alumno$ok,
    row_ch = membresias$row_ch,
    eligible_n = membresias$eligible_n,
    ids = membresias$ids,
    included = rep(FALSE, n),
    signals = list()
  )
  if (!eval_alumno$valido || !membresias$valido ||
      !is.list(criterios$seleccion_aula)) {
    return(invalido)
  }
  # I11/I16 miden efecto marginal DIRECTO: los outcomes CH de todos los gates
  # ajenos (incluidos minEligible, c7/c8, exclusión manual y particularidades)
  # permanecen exactamente como fueron ejecutados. Cambia la membresía y por
  # tanto las exposiciones/únicos dentro de esos CH; no se atribuye una cascada
  # de re-evaluación del marco al criterio alumno objetivo.
  included <- suppressWarnings(as.logical(aula_frame$included))
  included_valido <- length(included) == n && !anyNA(included)
  if (!included_valido) included <- rep(FALSE, n)
  list(
    valido = included_valido,
    row_ok = eval_alumno$ok,
    row_ch = membresias$row_ch,
    eligible_n = membresias$eligible_n,
    ids = membresias$ids,
    included = included,
    signals = list()
  )
}

.cm_criterio_radiografia_estado_actual_valido <- function(
    estado, aula_frame, contexto) {
  filas <- contexto$filas %||% list()
  esperado_row <- suppressWarnings(as.logical(filas$eligible_row %||% logical(0)))
  esperado_inc <- suppressWarnings(as.logical(aula_frame$included))
  esperado_n <- .cm_aulas_num_values(aula_frame, "eligible_n", NA_real_)
  isTRUE(estado$valido) && length(esperado_row) == length(estado$row_ok) &&
    !anyNA(esperado_row) && isTRUE(all(esperado_row == estado$row_ok)) &&
    length(esperado_inc) == length(estado$included) && !anyNA(esperado_inc) &&
    isTRUE(all(esperado_inc == estado$included)) &&
    length(esperado_n) == length(estado$eligible_n) &&
    isTRUE(all(esperado_n == estado$eligible_n))
}

.cm_criterio_radiografia_estado_alumno_local <- function(
    aula_frame, criterios, row_ok, indice_alumno = NULL) {
  contexto <- criterios$radiografia_contexto %||% list()
  filas <- contexto$filas %||% list()
  membresias <- .cm_criterio_radiografia_membresias(
    aula_frame, filas, row_ok, indice_alumno
  )
  included <- suppressWarnings(as.logical(aula_frame$included))
  valido <- membresias$valido && length(included) == nrow(aula_frame) && !anyNA(included)
  if (!valido) included <- rep(FALSE, nrow(aula_frame))
  list(
    valido = valido,
    row_ok = row_ok,
    row_ch = membresias$row_ch,
    eligible_n = membresias$eligible_n,
    ids = membresias$ids,
    included = included,
    signals = list()
  )
}

.cm_criterio_radiografia_snapshot_alumno_segmento <- function(
    estado, segment_mask, aula_frame, filas, solo_incluidos,
    indice_alumno = NULL) {
  membresias <- .cm_criterio_radiografia_membresias(
    aula_frame, filas, estado$row_ok & segment_mask, indice_alumno
  )
  if (!membresias$valido) {
    return(.cm_criterio_radiografia_snapshot(
      integer(0), rep(NA_real_, nrow(aula_frame)), membresias$ids
    ))
  }
  idx <- which(membresias$eligible_n > 0)
  if (isTRUE(solo_incluidos)) idx <- idx[estado$included[idx]]
  .cm_criterio_radiografia_snapshot(idx, membresias$eligible_n, membresias$ids)
}

.cm_criterio_radiografia_delta_alumno <- function(
    action, actual_valido, estado_actual, estado_nuevo) {
  .cm_criterio_radiografia_delta_atomico(
    accion = action,
    reconstruccion_valida = actual_valido && isTRUE(estado_nuevo$valido),
    included_actual = estado_actual$included,
    included_nuevo = estado_nuevo$included,
    eligible_n_actual = estado_actual$eligible_n,
    eligible_n_nuevo = estado_nuevo$eligible_n,
    ids_actual = estado_actual$ids,
    ids_nuevo = estado_nuevo$ids
  )
}

.cm_criterio_radiografia_eval_flat_faceta <- function(keys, mode, categories) {
  out <- rep(TRUE, length(keys))
  con_senal <- !is.na(keys) & nzchar(keys)
  if (!any(con_senal) || !length(categories)) return(out)
  inset <- keys[con_senal] %in% categories
  out[con_senal] <- if (identical(mode, "exclude")) !inset else inset
  out
}

.cm_criterio_radiografia_rows_flat_alumno <- function(
    id, variable, aula_frame, criterios, seleccion, particularidades,
    indice_alumno = NULL, estado_actual = NULL) {
  contexto <- criterios$radiografia_contexto %||% list()
  filas <- contexto$filas %||% list()
  n_row <- length(filas$student_id %||% character(0))
  values <- trimws(as.character(filas[[id]] %||% rep("", n_row)))
  student_faculty <- trimws(as.character(filas$faculty %||% rep("", n_row)))
  if (!n_row || length(values) != n_row || length(student_faculty) != n_row) {
    return(list(rows = list(), status = "invalido"))
  }
  categories <- variable$categories %||% list()
  if (!length(categories)) return(list(rows = list(), status = "sin_senal"))
  facs <- .cm_criterio_radiografia_facultades(student_faculty)
  registry <- .cm_criterios_var_registry()
  crit <- seleccion$byVariable[[id]]
  if (is.null(crit)) {
    crit <- .cm_criterios_normalize_criterio(
      list(mode = "include", categories = list()), registry[[id]]
    )
  }
  seleccion_base <- seleccion
  seleccion_base$byVariable[[id]] <- NULL
  if (!is.list(estado_actual)) {
    estado_actual <- .cm_criterio_radiografia_estado_alumno(
      aula_frame, criterios, seleccion, particularidades, indice_alumno
    )
  }
  estado_base <- .cm_criterio_radiografia_estado_alumno(
    aula_frame, criterios, seleccion_base, particularidades, indice_alumno
  )
  actual_valido <- .cm_criterio_radiografia_estado_actual_valido(
    estado_actual, aula_frame, contexto
  )
  value_keys <- .cm_aulas_text_key(values)
  rows <- list()
  informativo <- !identical(crit$layer, "marco")
  for (fac in facs$values) {
    fac_mask <- facs$keys == fac$eval_key
    cats_efectivas <- .cm_criterios_eff_cats(crit, fac$eval_key)
    for (category in categories) {
      key <- .cm_aulas_scalar(category$key, "")
      if (!nzchar(key)) next
      # `faculty` ya ES la dimensión de faceta: evita el cruce N×N de una
      # categoría de facultad con otra facultad de alumno.
      if (identical(id, "faculty") && !identical(key, fac$eval_key)) next
      segment_mask <- fac_mask & value_keys == key
      accion <- .cm_criterio_radiografia_accion(key, cats_efectivas, FALSE)
      delta <- if (informativo) {
        .cm_criterio_radiografia_delta_atomico(
          "no_aplica", FALSE,
          estado_actual$included, logical(0),
          estado_actual$eligible_n, numeric(0),
          estado_actual$ids, estado_actual$ids
        )
      } else {
        flag_faceta <- .cm_criterio_radiografia_eval_flat_faceta(
          value_keys[fac_mask], crit$mode, accion$categories
        )
        if (length(flag_faceta) != sum(fac_mask) || anyNA(flag_faceta)) {
          flag_faceta <- rep(FALSE, sum(fac_mask))
        }
        row_ok_nuevo <- estado_actual$row_ok
        row_ok_nuevo[fac_mask] <- estado_base$row_ok[fac_mask] & flag_faceta
        estado_nuevo <- .cm_criterio_radiografia_estado_alumno_local(
          aula_frame, criterios, row_ok_nuevo, indice_alumno
        )
        .cm_criterio_radiografia_delta_alumno(
          accion$accion, actual_valido, estado_actual, estado_nuevo
        )
      }
      rows[[length(rows) + 1L]] <- list(
        faculty_key = fac$key,
        faculty_label = fac$label,
        segment_key = key,
        segment_label = .cm_aulas_scalar(category$label, key),
        segment_kind = "categoria",
        actual = .cm_criterio_radiografia_snapshot_alumno_segmento(
          estado_actual, segment_mask, aula_frame, filas, TRUE, indice_alumno
        ),
        contraste_total = .cm_criterio_radiografia_snapshot_alumno_segmento(
          estado_base, segment_mask, aula_frame, filas, FALSE, indice_alumno
        ),
        delta = delta
      )
    }
  }
  list(
    rows = rows,
    status = if (!length(rows)) "sin_senal" else if (actual_valido) {
      "disponible"
    } else {
      "invalido"
    }
  )
}

.cm_criterio_radiografia_signal_alumno <- function(
    filas, row_ch, row_mask, values, indice_alumno = NULL) {
  sid <- trimws(as.character(filas$student_id %||% character(0)))
  if (!isTRUE(indice_alumno$valido) || indice_alumno$n_row != length(sid) ||
      length(values) != length(sid)) {
    return(numeric(0))
  }
  keep <- row_mask %in% TRUE & nzchar(sid) & !is.na(row_ch)
  idx <- which(keep)
  if (!length(idx)) return(numeric(0))
  pair_ids <- indice_alumno$pair_id[idx]
  present <- which(tabulate(
    pair_ids, nbins = length(indice_alumno$pair_ch)
  ) > 0L)
  first <- match(present, pair_ids)
  suppressWarnings(as.numeric(values[idx[first]]))
}

.cm_criterio_radiografia_rows_numeric_alumno <- function(
    id, aula_frame, criterios, seleccion, particularidades,
    indice_alumno = NULL, estado_actual = NULL) {
  contexto <- criterios$radiografia_contexto %||% list()
  filas <- contexto$filas %||% list()
  n_row <- length(filas$student_id %||% character(0))
  values <- .cm_criterio_radiografia_num_values(
    indice_alumno, filas, id, n_row
  )
  student_faculty <- trimws(as.character(filas$faculty %||% rep("", n_row)))
  if (!n_row || length(values) != n_row || !any(is.finite(values))) {
    return(list(rows = list(), status = "sin_senal"))
  }
  registry <- .cm_criterios_var_registry()
  crit <- seleccion$byVariable[[id]]
  if (is.null(crit)) {
    crit <- .cm_criterios_normalize_criterio(list(), registry[[id]])
  }
  activa <- !is.null(crit$threshold)
  seleccion_base <- seleccion
  seleccion_base$byVariable[[id]] <- NULL
  if (!is.list(estado_actual)) {
    estado_actual <- .cm_criterio_radiografia_estado_alumno(
      aula_frame, criterios, seleccion, particularidades, indice_alumno
    )
  }
  estado_base <- .cm_criterio_radiografia_estado_alumno(
    aula_frame, criterios, seleccion_base, particularidades, indice_alumno
  )
  actual_valido <- .cm_criterio_radiografia_estado_actual_valido(
    estado_actual, aula_frame, contexto
  )
  informativo <- !identical(crit$layer, "marco")
  action <- if (activa) "quitar_restriccion" else "no_aplica"
  facs <- .cm_criterio_radiografia_facultades(student_faculty)
  rows <- lapply(facs$values, function(fac) {
    fac_mask <- facs$keys == fac$eval_key
    delta <- if (informativo) {
      .cm_criterio_radiografia_delta_atomico(
        "no_aplica", FALSE, estado_actual$included, logical(0),
        estado_actual$eligible_n, numeric(0), estado_actual$ids, estado_actual$ids
      )
    } else {
      row_ok_nuevo <- estado_actual$row_ok
      if (activa) row_ok_nuevo[fac_mask] <- estado_base$row_ok[fac_mask]
      estado_nuevo <- .cm_criterio_radiografia_estado_alumno_local(
        aula_frame, criterios, row_ok_nuevo, indice_alumno
      )
      .cm_criterio_radiografia_delta_alumno(
        action, actual_valido, estado_actual, estado_nuevo
      )
    }
    signal <- .cm_criterio_radiografia_signal_alumno(
      filas, estado_base$row_ch, estado_base$row_ok & fac_mask, values,
      indice_alumno
    )
    list(
      faculty_key = fac$key,
      faculty_label = fac$label,
      segment_key = "global",
      segment_label = "Estudiantes que cumplen",
      segment_kind = "global",
      actual = .cm_criterio_radiografia_snapshot_alumno_segmento(
        estado_actual, fac_mask, aula_frame, filas, TRUE, indice_alumno
      ),
      contraste_total = .cm_criterio_radiografia_snapshot_alumno_segmento(
        estado_base, fac_mask, aula_frame, filas, FALSE, indice_alumno
      ),
      delta = delta,
      signal_distribution = .cm_criterio_radiografia_signal_distribution(
        signal, "valor_criterio"
      )
    )
  })
  list(rows = rows, status = if (actual_valido) "disponible" else "invalido")
}

.cm_criterio_radiografia_rows_ordinal_alumno <- function(
    id, variable, aula_frame, criterios, seleccion, particularidades,
    indice_alumno = NULL, estado_actual = NULL) {
  contexto <- criterios$radiografia_contexto %||% list()
  filas <- contexto$filas %||% list()
  n_row <- length(filas$student_id %||% character(0))
  values <- .cm_criterio_radiografia_num_values(
    indice_alumno, filas, id, n_row
  )
  observed <- suppressWarnings(as.numeric(unlist(variable$values %||% list())))
  observed <- sort(unique(observed[is.finite(observed)]))
  student_faculty <- trimws(as.character(filas$faculty %||% rep("", n_row)))
  if (!n_row || !length(observed)) return(list(rows = list(), status = "sin_senal"))
  registry <- .cm_criterios_var_registry()
  crit <- seleccion$byVariable[[id]]
  if (is.null(crit)) {
    crit <- .cm_criterios_normalize_criterio(list(), registry[[id]])
  }
  seleccion_base <- seleccion
  seleccion_base$byVariable[[id]] <- NULL
  if (!is.list(estado_actual)) {
    estado_actual <- .cm_criterio_radiografia_estado_alumno(
      aula_frame, criterios, seleccion, particularidades, indice_alumno
    )
  }
  estado_base <- .cm_criterio_radiografia_estado_alumno(
    aula_frame, criterios, seleccion_base, particularidades, indice_alumno
  )
  actual_valido <- .cm_criterio_radiografia_estado_actual_valido(
    estado_actual, aula_frame, contexto
  )
  informativo <- !identical(crit$layer, "marco")
  facs <- .cm_criterio_radiografia_facultades(student_faculty)
  rows <- list()
  for (fac in facs$values) {
    fac_mask <- facs$keys == fac$eval_key
    signal <- .cm_criterio_radiografia_signal_alumno(
      filas, estado_base$row_ch, estado_base$row_ok & fac_mask, values,
      indice_alumno
    )
    for (value in observed) {
      segment_mask <- fac_mask & is.finite(values) & values == value
      crit_nuevo <- crit
      if (is.finite(crit$fromValue)) {
        action <- "reemplazar_regla"
        crit_nuevo$fromValue <- value
        crit_nuevo$includeValues <- numeric(0)
      } else {
        keys <- as.character(crit$includeValues[is.finite(crit$includeValues)])
        accion <- .cm_criterio_radiografia_accion(
          as.character(value), keys, empty = FALSE
        )
        action <- accion$accion
        crit_nuevo$includeValues <- suppressWarnings(as.numeric(accion$categories))
      }
      delta <- if (informativo) {
        .cm_criterio_radiografia_delta_atomico(
          "no_aplica", FALSE, estado_actual$included, logical(0),
          estado_actual$eligible_n, numeric(0), estado_actual$ids, estado_actual$ids
        )
      } else {
        flag_regla <- .cm_criterios_eval_ordinal(values, crit_nuevo)
        if (length(flag_regla) != n_row || anyNA(flag_regla)) {
          flag_regla <- rep(FALSE, n_row)
        }
        row_ok_nuevo <- estado_actual$row_ok
        row_ok_nuevo[fac_mask] <- (
          estado_base$row_ok & flag_regla
        )[fac_mask]
        estado_nuevo <- .cm_criterio_radiografia_estado_alumno_local(
          aula_frame, criterios, row_ok_nuevo, indice_alumno
        )
        .cm_criterio_radiografia_delta_alumno(
          action, actual_valido, estado_actual, estado_nuevo
        )
      }
      rows[[length(rows) + 1L]] <- list(
        faculty_key = fac$key,
        faculty_label = fac$label,
        segment_key = .cm_aulas_text_key(as.character(value)),
        segment_label = format(value, trim = TRUE, scientific = FALSE),
        segment_kind = "categoria",
        actual = .cm_criterio_radiografia_snapshot_alumno_segmento(
          estado_actual, segment_mask, aula_frame, filas, TRUE, indice_alumno
        ),
        contraste_total = .cm_criterio_radiografia_snapshot_alumno_segmento(
          estado_base, segment_mask, aula_frame, filas, FALSE, indice_alumno
        ),
        delta = delta,
        signal_distribution = .cm_criterio_radiografia_signal_distribution(
          signal, "valor_criterio"
        )
      )
    }
  }
  list(
    rows = rows,
    status = if (!length(rows)) "sin_senal" else if (actual_valido) {
      "disponible"
    } else {
      "invalido"
    }
  )
}

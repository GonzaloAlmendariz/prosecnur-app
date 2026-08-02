# Matriz marginal facultad efectiva x criterio. Consume el contrato M1 ya
# calculado y sus flags efectivos; nunca suma segmentos para reconstruir una
# regla ni presenta los criterios como una secuencia aditiva.

.cm_matriz_embudo_schema <- "calc_muestra_aulas_criterios_matriz_embudo_v1"
.cm_matriz_embudo_owner <- paste0(
  "calc_muestra_aulas_frame_v1.criterios_radiografia.",
  "matriz_embudo"
)

.cm_matriz_embudo_flag_criterion <- c(
  min_eligible_ok = "minEligible",
  teacher_ok = "teacher_type",
  course_level_ok = "course_level",
  campus_ok = "campus",
  c7_ok = "c7",
  c8_facultad_ok = "c8_facultad",
  c8_ok = "c8"
)

.cm_matriz_embudo_columns <- function(radiografia) {
  criterios <- if (is.list(radiografia)) radiografia$criterios else NULL
  if (!is.list(criterios)) return(list())
  criterios <- Filter(function(entry) {
    is.list(entry) &&
      identical(.cm_aulas_scalar(entry$unit, ""), "curso_horario_unico") &&
      identical(
        .cm_aulas_scalar(entry$faculty_dimension, ""),
        "curso_horario_efectiva"
      )
  }, criterios)
  lapply(seq_along(criterios), function(i) {
    entry <- criterios[[i]]
    list(
      criterion_id = .cm_aulas_scalar(entry$id, ""),
      card_id = .cm_aulas_scalar(entry$card_id, entry$id),
      label = .cm_aulas_scalar(entry$label, entry$id),
      status = .cm_aulas_scalar(entry$status, "invalido"),
      order = as.integer(i)
    )
  })
}

.cm_matriz_embudo_align_flags <- function(aula_frame, flags) {
  n <- nrow(aula_frame)
  invalid <- list(components = list(), valido = FALSE)
  if (!is.data.frame(flags) || nrow(flags) != n || !n) return(invalid)
  idx <- seq_len(n)
  if ("classroom_id" %in% names(flags) && "classroom_id" %in% names(aula_frame)) {
    frame_ids <- .cm_aulas_values(aula_frame, "classroom_id", "")
    flag_ids <- .cm_aulas_values(flags, "classroom_id", "")
    if (any(!nzchar(frame_ids)) || anyDuplicated(frame_ids) ||
        any(!nzchar(flag_ids)) || anyDuplicated(flag_ids)) {
      return(invalid)
    }
    idx <- match(frame_ids, flag_ids)
    if (anyNA(idx)) return(invalid)
  }
  columns <- setdiff(names(flags), "classroom_id")
  if (!length(columns)) return(invalid)
  components <- list()
  for (column in columns) {
    flag <- suppressWarnings(as.logical(flags[[column]][idx]))
    if (length(flag) != n || anyNA(flag)) return(invalid)
    criterion_id <- unname(.cm_matriz_embudo_flag_criterion[[column]])
    if (is.null(criterion_id) || !nzchar(criterion_id)) criterion_id <- "__base__"
    components[[length(components) + 1L]] <- list(
      source = paste0("flag:", column),
      criterion_id = criterion_id,
      flag = flag
    )
  }
  list(components = components, valido = TRUE)
}

.cm_matriz_embudo_steps <- function(pasos, n) {
  if (!is.list(pasos)) return(list(components = list(), valido = FALSE))
  components <- list()
  for (i in seq_along(pasos)) {
    paso <- pasos[[i]]
    if (!is.list(paso)) return(list(components = list(), valido = FALSE))
    flag <- suppressWarnings(as.logical(paso$flag))
    if (length(flag) != n || anyNA(flag)) {
      return(list(components = list(), valido = FALSE))
    }
    id <- .cm_aulas_scalar(paso$id, "")
    if (!nzchar(id)) id <- "__base__"
    components[[length(components) + 1L]] <- list(
      source = paste0("step:", i, ":", id),
      criterion_id = id,
      flag = flag
    )
  }
  list(components = components, valido = TRUE)
}

.cm_matriz_embudo_and <- function(components, n) {
  if (!length(components)) return(rep(TRUE, n))
  Reduce(`&`, lapply(components, `[[`, "flag"), init = rep(TRUE, n))
}

.cm_matriz_embudo_context <- function(aula_frame, criterios, particularidades) {
  n <- nrow(aula_frame)
  flags <- .cm_matriz_embudo_align_flags(aula_frame, criterios$flags)
  steps <- .cm_matriz_embudo_steps(
    (criterios$seleccion_aula %||% list())$pasos,
    n
  )
  included <- if ("included" %in% names(aula_frame)) {
    suppressWarnings(as.logical(aula_frame$included))
  } else {
    rep(NA, n)
  }
  included_valido <- length(included) == n && !anyNA(included)
  if (!included_valido) included <- rep(FALSE, n)
  manual_ok <- .cm_criterio_radiografia_manual_ok(aula_frame, particularidades)
  manual_valido <- length(manual_ok) == n && !anyNA(manual_ok)
  if (!manual_valido) manual_ok <- rep(FALSE, n)
  components <- c(flags$components, steps$components)
  reconstruido <- .cm_matriz_embudo_and(components, n) & manual_ok
  list(
    components = components,
    included = included,
    manual_ok = manual_ok,
    valido = flags$valido && steps$valido && included_valido && manual_valido &&
      isTRUE(all(reconstruido == included))
  )
}

.cm_matriz_embudo_cell <- function(
    criterion_id, idx, context, eligible_n, ids_por_ch) {
  belongs <- vapply(
    context$components,
    function(component) identical(component$criterion_id, criterion_id),
    logical(1)
  )
  rule_components <- context$components[belongs]
  other_components <- context$components[!belongs]
  rule_flag <- .cm_matriz_embudo_and(rule_components, length(context$included))
  action <- if (length(rule_components) && any(!rule_flag[idx])) {
    "quitar_restriccion"
  } else {
    "no_aplica"
  }
  rule_new <- rule_flag
  if (identical(action, "quitar_restriccion")) rule_new[idx] <- TRUE
  included_new <- if (isTRUE(context$valido)) {
    .cm_matriz_embudo_and(other_components, length(context$included)) &
      rule_new & context$manual_ok
  } else {
    logical(0)
  }
  delta <- .cm_criterio_radiografia_delta_atomico(
    accion = action,
    reconstruccion_valida = context$valido,
    included_actual = context$included,
    included_nuevo = included_new,
    eligible_n_actual = eligible_n,
    eligible_n_nuevo = eligible_n,
    ids_actual = ids_por_ch,
    ids_nuevo = ids_por_ch
  )
  c(list(criterion_id = criterion_id), delta)
}

.cm_matriz_embudo_row <- function(
    faculty_key, faculty_label, row_kind, idx, columns, context,
    eligible_n, ids_por_ch) {
  list(
    faculty_key = faculty_key,
    faculty_label = faculty_label,
    row_kind = row_kind,
    n_ch_bruto = as.integer(length(idx)),
    n_ch_elegibles = as.integer(sum(context$included[idx] %in% TRUE)),
    cells = lapply(columns, function(column) {
      .cm_matriz_embudo_cell(
        criterion_id = column$criterion_id,
        idx = idx,
        context = context,
        eligible_n = eligible_n,
        ids_por_ch = ids_por_ch
      )
    })
  )
}

#' Construye la matriz marginal desde el frame y el contrato M1.
#'
#' Cada celda remueve la regla COMPLETA solo para su facultad. La fila Total
#' remueve esa misma regla en todo el marco y vuelve a medir el resultado; no
#' agrega deltas de filas ni de segmentos.
calc_muestra_aulas_matriz_embudo <- function(
    aula_frame, radiografia, criterios, particularidades = NULL) {
  if (!is.data.frame(aula_frame) || !nrow(aula_frame) ||
      !is.list(radiografia) || !is.list(criterios)) {
    return(NULL)
  }
  columns <- .cm_matriz_embudo_columns(radiografia)
  if (!length(columns)) return(NULL)
  context <- .cm_matriz_embudo_context(
    aula_frame,
    criterios,
    particularidades
  )
  eligible_n <- if ("eligible_n" %in% names(aula_frame)) {
    .cm_aulas_num_values(aula_frame, "eligible_n", NA_real_)
  } else {
    rep(NA_real_, nrow(aula_frame))
  }
  ids_por_ch <- .cm_criterio_radiografia_ids_por_ch(aula_frame, eligible_n)
  facultades <- .cm_alumnos_por_ch_facultades(aula_frame)
  rows <- lapply(facultades, function(fac) {
    .cm_matriz_embudo_row(
      faculty_key = fac$faculty_key,
      faculty_label = fac$faculty_label,
      row_kind = "faculty",
      idx = fac$idx,
      columns = columns,
      context = context,
      eligible_n = eligible_n,
      ids_por_ch = ids_por_ch
    )
  })
  rows[[length(rows) + 1L]] <- .cm_matriz_embudo_row(
    faculty_key = .cm_alumnos_por_ch_total_key,
    faculty_label = "Total",
    row_kind = "total",
    idx = seq_len(nrow(aula_frame)),
    columns = columns,
    context = context,
    eligible_n = eligible_n,
    ids_por_ch = ids_por_ch
  )
  list(
    schema = .cm_matriz_embudo_schema,
    owner = .cm_matriz_embudo_owner,
    source_schema = .cm_aulas_scalar(radiografia$schema, ""),
    frame_hash = .cm_aulas_scalar(radiografia$frame_hash, NA_character_),
    momento = .cm_aulas_scalar(radiografia$momento, "marco_ejecutado"),
    grain = "facultad_efectiva_x_criterio",
    unit = "curso_horario_unico",
    faculty_dimension = "curso_horario_efectiva",
    columns = columns,
    rows = rows
  )
}

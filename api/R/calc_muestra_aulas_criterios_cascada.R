# Contratos I18b de criterios. Este owner concentra el Total R-owned y la
# cascada secuencial; el contexto alumno x CH permanece como atributo privado
# hasta que el router lo extrae a una clave de sesion cache_stripped.

.cm_criterios_totales_schema <- "calc_muestra_aulas_criterios_totales_v1"
.cm_criterios_cascada_schema <- "calc_muestra_aulas_criterios_cascada_v1"
.cm_criterios_contexto_schema <- "calc_muestra_aulas_criterios_contexto_v1"
.cm_criterios_contexto_attr <- "calc_muestra_aulas_criterios_contexto"
.cm_criterios_indice_attr <- "calc_muestra_aulas_criterios_indice_alumno"

# Fuente unica del orden metodologico. La salida sigue siendo dinamica: solo
# publica ids presentes en el inventario R de la radiografia.
# G30 · El orden del embudo es el de la SUPERFICIE.
#
# Decision de Gonzalo: «debe ser el orden de la superficie el que tiene el orden
# correcto ahora».
#
# Hasta aqui habia DOS ordenes que no coincidian. Medido en la app: la pantalla
# presentaba el minimo primero y el motor lo aplicaba **undecimo**. Importa
# porque la cifra de cada tarjeta —«quitarla deja fuera N cursos-horario»— se
# calcula en este orden, y dos criterios que se solapan quitan distinto segun
# cual va antes: leer la lista de arriba abajo describia un embudo que no era el
# que corrio.
#
# El minimo de alumnos elegibles abre el embudo porque es el que mas recorta —en
# Gastronomia se lleva 36 de 45 cursos-horario— y aplicarlo el ultimo dejaba a
# los criterios anteriores decidiendo sobre un marco que el iba a cambiar.
#
# Los criterios de estudiante siguen delante: filtran alumnos, y el minimo se
# mide sobre los alumnos que sobreviven a ellos. Invertir eso si cambiaria el
# significado del minimo, no solo su cifra.
.cm_criterios_orden_motor <- c(
  "formation", "condition", "age", "faculty", "level",
  "minEligible",
  "modality", "condicion_curso", "course_level", "session_type",
  "teacher_type", "campus", "enrolled_total",
  "c7", "c8_facultad", "c8"
)

.cm_criterios_flag_id <- c(
  min_eligible_ok = "minEligible",
  teacher_ok = "teacher_type",
  course_level_ok = "course_level",
  campus_ok = "campus",
  c7_ok = "c7",
  c8_facultad_ok = "c8_facultad",
  c8_ok = "c8"
)

.cm_criterios_hash <- function(config) {
  cfg <- calc_muestra_aulas_normalize_config(config %||% list())
  filter_fields <- c(
    "require_min_prevalence", "min_prevalence_pct",
    "require_faculty_prevalence", "min_faculty_prevalence_pct",
    "require_cycle_homogeneity", "min_cycle_homogeneity_pct"
  )
  .cm_aulas_hash(list(
    criterios_seleccion = cfg$criterios_seleccion,
    min_eligible_efectivo = .cm_criterios_min_eligible_efectivo(cfg),
    filters = cfg$filters[intersect(filter_fields, names(cfg$filters))]
  ))
}

.cm_criterios_catalog_variable <- function(context, id) {
  variables <- (context$criterios_catalogo %||% list())$variables %||% list()
  hit <- Filter(
    function(variable) identical(.cm_aulas_scalar(variable$id, ""), id),
    variables
  )
  if (length(hit)) hit[[1L]] else NULL
}

.cm_criterios_unique_segments <- function(entry) {
  rows <- entry$rows %||% list()
  if (!length(rows)) return(list())
  keys <- vapply(rows, function(row) {
    paste(
      .cm_aulas_scalar(row$segment_key, ""),
      .cm_aulas_scalar(row$segment_kind, ""),
      sep = "\r"
    )
  }, character(1))
  rows[!duplicated(keys)]
}

.cm_criterios_total_signal <- function(id, context) {
  aula_frame <- context$aula_frame
  values <- context$values %||% list()
  switch(id,
    age = NULL,
    level = NULL,
    enrolled_total = suppressWarnings(as.numeric(values$enrolled_total)),
    course_level = suppressWarnings(as.numeric(values$course_level)),
    minEligible = .cm_aulas_num_values(aula_frame, "eligible_n", NA_real_),
    c7 = .cm_aulas_num_values(aula_frame, "prevalence_ratio", NA_real_),
    c8_facultad = .cm_aulas_num_values(aula_frame, "faculty_match_share", NA_real_),
    c8 = .cm_aulas_num_values(aula_frame, "level_match_share", NA_real_),
    NULL
  )
}

# G38 · El umbral con el que se está decidiendo, para que la señal lo publique.
#
# Sale de la misma configuración que evalúa el criterio (`.cm_criterios_flag`),
# no de una constante paralela: dos sitios donde vive el mismo umbral es la forma
# más barata de que la tarjeta enseñe un corte y el motor aplique otro.
.cm_criterios_umbral_composicion <- function(id, cfg) {
  campos <- c(
    c7 = "min_prevalence_pct",
    c8_facultad = "min_faculty_prevalence_pct",
    c8 = "min_cycle_homogeneity_pct"
  )
  aplica <- c(
    c7 = "require_min_prevalence",
    c8_facultad = "require_faculty_prevalence",
    c8 = "require_cycle_homogeneity"
  )
  if (!id %in% names(campos)) return(NULL)
  # Normaliza aunque el contexto ya traiga la config del build: un `filters` sin
  # normalizar devolvería el default en silencio, y un umbral por defecto que se
  # anuncia como el aplicado es peor que no anunciar ninguno.
  cfg <- calc_muestra_aulas_normalize_config(cfg %||% list())
  filtros <- cfg$filters %||% list()
  # Si el criterio no está activo no hay corte que anunciar: `n_fuera` sale NA,
  # que es «no aplica», no «cero se quedan fuera».
  if (!isTRUE(filtros[[aplica[[id]]]])) return(NULL)
  .cm_criterios_pct(filtros[[campos[[id]]]], 0.80)
}

.cm_criterios_total_aula_mask <- function(entry, segment, context) {
  n <- nrow(context$aula_frame)
  id <- .cm_aulas_scalar(entry$id, "")
  kind <- .cm_aulas_scalar(entry$kind, "")
  segment_key <- .cm_aulas_scalar(segment$segment_key, "")
  segment_kind <- .cm_aulas_scalar(segment$segment_kind, "")
  if (identical(segment_kind, "global") || identical(kind, "gate")) {
    return(rep(TRUE, n))
  }
  values <- (context$values %||% list())[[id]] %||% rep("", n)
  if (identical(kind, "hierarchical")) {
    # G41 · El jerarquico lee del docente, no de una columna con su id.
    #
    # `values[[id]]` no existe para `teacher_type` —el texto crudo del docente
    # vive en `values$teacher`, que es lo que evalua el propio criterio en
    # `.cm_criterios_preview_aula_flag`—, asi que aqui llegaba un vector de
    # cadenas vacias y TODA mascara jerarquica salia en FALSE. Los totales de
    # tipo de docente publicaban ceros sin que nada fallara.
    crudos <- (context$values %||% list())$teacher %||% rep("", n)
    if (!any(nzchar(trimws(as.character(values))))) values <- crudos
    variable <- .cm_criterios_catalog_variable(context, id)
    segments <- .cm_criterio_radiografia_teacher_segments(variable, values)
    hit <- Filter(function(x) identical(x$key, segment_key), segments)
    if (length(hit)) return(hit[[1L]]$mask %in% TRUE)
    return(rep(FALSE, n))
  }
  keys <- .cm_aulas_text_key(values)
  variable <- .cm_criterios_catalog_variable(context, id)
  categories <- variable$categories %||% list()
  category <- Filter(
    function(x) identical(.cm_aulas_scalar(x$key, ""), segment_key),
    categories
  )
  synthetic <- length(category) && isTRUE(category[[1L]]$synthetic)
  if (synthetic || grepl("^__missing_", segment_key)) {
    return(!nzchar(keys))
  }
  keys == segment_key
}

.cm_criterios_total_student_mask <- function(entry, segment, context, index) {
  filas <- (context$criterios$radiografia_contexto %||% list())$filas %||% list()
  n <- length(filas$student_id %||% character(0))
  id <- .cm_aulas_scalar(entry$id, "")
  kind <- .cm_aulas_scalar(entry$kind, "")
  key <- .cm_aulas_scalar(segment$segment_key, "")
  if (identical(kind, "numeric")) return(rep(TRUE, n))
  if (identical(kind, "ordinal")) {
    values <- .cm_criterio_radiografia_num_values(index, filas, id, n)
    target <- suppressWarnings(as.numeric(key))
    return(is.finite(values) & is.finite(target) & values == target)
  }
  .cm_aulas_text_key(filas[[id]] %||% rep("", n)) == key
}

.cm_criterios_total_student_signal <- function(entry, state_base, context, index) {
  id <- .cm_aulas_scalar(entry$id, "")
  if (!id %in% c("age", "level")) return(NULL)
  filas <- (context$criterios$radiografia_contexto %||% list())$filas %||% list()
  n <- length(filas$student_id %||% character(0))
  values <- .cm_criterio_radiografia_num_values(index, filas, id, n)
  .cm_criterio_radiografia_signal_alumno(
    filas, state_base$row_ch, state_base$row_ok, values, index
  )
}

.cm_criterios_total_student_rows <- function(entry, context, state_actual, index) {
  selection <- .cm_criterios_normalize_seleccion(
    (context$config %||% list())$criterios_seleccion
  )
  selection_base <- selection
  selection_base$byVariable[[entry$id]] <- NULL
  state_base <- .cm_criterio_radiografia_estado_alumno(
    context$aula_frame, context$criterios, selection_base,
    context$particularidades, index
  )
  filas <- (context$criterios$radiografia_contexto %||% list())$filas %||% list()
  signal <- .cm_criterios_total_student_signal(entry, state_base, context, index)
  lapply(.cm_criterios_unique_segments(entry), function(segment) {
    mask <- .cm_criterios_total_student_mask(entry, segment, context, index)
    row <- list(
      criterion_id = entry$id,
      card_id = entry$card_id,
      label = entry$label,
      segment_key = segment$segment_key,
      segment_label = segment$segment_label,
      segment_kind = segment$segment_kind,
      actual = .cm_criterio_radiografia_snapshot_alumno_segmento(
        state_actual, mask, context$aula_frame, filas, TRUE, index
      ),
      contraste_total = .cm_criterio_radiografia_snapshot_alumno_segmento(
        state_base, mask, context$aula_frame, filas, FALSE, index
      )
    )
    if (!is.null(signal)) {
      row$signal_distribution <- .cm_criterio_radiografia_signal_distribution(
        signal, "valor_criterio"
      )
    }
    row
  })
}

.cm_criterios_total_classroom_rows <- function(entry, context, ids_por_ch) {
  aula_frame <- context$aula_frame
  included <- aula_frame$included %in% TRUE
  eligible_n <- .cm_aulas_num_values(aula_frame, "eligible_n", NA_real_)
  signal <- .cm_criterios_total_signal(entry$id, context)
  lapply(.cm_criterios_unique_segments(entry), function(segment) {
    mask <- .cm_criterios_total_aula_mask(entry, segment, context)
    row <- list(
      criterion_id = entry$id,
      card_id = entry$card_id,
      label = entry$label,
      segment_key = segment$segment_key,
      segment_label = segment$segment_label,
      segment_kind = segment$segment_kind,
      actual = .cm_criterio_radiografia_snapshot(
        which(mask & included), eligible_n, ids_por_ch
      ),
      contraste_total = .cm_criterio_radiografia_snapshot(
        which(mask), eligible_n, ids_por_ch
      )
    )
    if (!is.null(signal)) {
      es_composicion <- entry$id %in% c("c7", "c8_facultad", "c8")
      row$signal_distribution <- .cm_criterio_radiografia_signal_distribution(
        signal[mask],
        if (es_composicion) "proporcion" else "valor_criterio",
        umbral = if (es_composicion) {
          .cm_criterios_umbral_composicion(entry$id, context$config)
        } else {
          NULL
        }
      )
    }
    row
  })
}

calc_muestra_aulas_criterios_totales <- function(context) {
  radiography <- context$criterios_radiografia
  entries <- radiography$criterios %||% list()
  aula_frame <- context$aula_frame
  eligible_n <- .cm_aulas_num_values(aula_frame, "eligible_n", NA_real_)
  ids_por_ch <- .cm_criterio_radiografia_ids_por_ch(aula_frame, eligible_n)
  index <- context$student_index
  if (!is.list(index)) {
    index <- .cm_criterio_radiografia_indice_alumno(
      aula_frame,
      (context$criterios$radiografia_contexto %||% list())$filas %||% list()
    )
  }
  selection <- .cm_criterios_normalize_seleccion(
    (context$config %||% list())$criterios_seleccion
  )
  state_actual <- .cm_criterio_radiografia_estado_alumno(
    aula_frame, context$criterios, selection, context$particularidades, index
  )
  rows <- unlist(lapply(entries, function(entry) {
    if (identical(.cm_aulas_scalar(entry$scope, ""), "alumno")) {
      .cm_criterios_total_student_rows(entry, context, state_actual, index)
    } else {
      .cm_criterios_total_classroom_rows(entry, context, ids_por_ch)
    }
  }), recursive = FALSE)
  list(
    schema = .cm_criterios_totales_schema,
    owner = "calc_muestra_aulas_frame_v1.criterios_totales",
    source_schema = .cm_aulas_scalar(radiography$schema, ""),
    source_frame_hash = context$source_frame_hash,
    momento = "marco_ejecutado",
    grain = "criterio_x_segmento",
    unit = "curso_horario_unico",
    rows = rows
  )
}

.cm_criterios_step_specs <- function(context) {
  entries <- (context$criterios_radiografia %||% list())$criterios %||% list()
  ids <- vapply(entries, function(entry) .cm_aulas_scalar(entry$id, ""), character(1))
  rank <- match(ids, .cm_criterios_orden_motor)
  rank[is.na(rank)] <- length(.cm_criterios_orden_motor) + seq_len(sum(is.na(rank)))
  entries <- entries[order(rank, seq_along(entries))]
  specs <- lapply(entries, function(entry) list(
    criterion_id = entry$id,
    card_id = entry$card_id,
    label = entry$label,
    scope = entry$scope,
    gate = TRUE,
    entry = entry
  ))
  specs[[length(specs) + 1L]] <- list(
    criterion_id = "manual_excluded",
    card_id = "manual_excluded",
    label = "Exclusiones manuales",
    scope = "aula",
    gate = FALSE,
    entry = NULL
  )
  specs
}

.cm_criterios_facultades <- function(context) {
  n <- nrow(context$aula_frame)
  labels <- trimws(as.character((context$values %||% list())$faculty %||%
    .cm_aulas_values(context$aula_frame, "faculty", "")))
  if (length(labels) != n) labels <- .cm_aulas_values(context$aula_frame, "faculty", "")
  labels[is.na(labels)] <- ""
  keys <- .cm_criterios_fac_key(labels)
  groups <- lapply(unique(keys), function(key) {
    idx <- which(keys == key)
    list(
      faculty_key = if (nzchar(key)) key else .cm_criterio_radiografia_missing_faculty_key,
      label = if (nzchar(key)) .cm_aulas_mode(labels[idx], key) else "Sin dato",
      idx = idx
    )
  })
  groups[order(vapply(groups, `[[`, character(1), "label"))]
}

# G41 · Las categorias del criterio, para repartir lo que LLEGA a el.
#
# Gonzalo: «si quedan 100 cursos-horario hasta un criterio, la suma de sus
# elegibles en cada categoria no deberia ser 100?». Debia serlo y no lo era: la
# tarjeta de cada categoria contaba su universo de partida (todos los CH de esa
# categoria, antes de que nadie filtrara) y los elegibles del marco COMPLETO
# (tras los criterios que vienen despues). Ninguna de las dos cifras describia
# el momento en que se decide, asi que ninguna sumaba la barra de arriba.
#
# El reparto se calcula aqui —donde el motor ya lleva el vector de vivos paso a
# paso— y no en la radiografia, que trabaja sobre el marco ya ejecutado y no
# conoce el estado intermedio.
#
# Criterios de aula con categorias. Un umbral numerico no tiene categorias que
# repartir y un criterio de estudiante filtra personas, no cursos-horario.
#
# El jerarquico (tipo de docente) publica sus hojas, no sus grupos: un grupo y
# sus hijos describen los mismos cursos-horario, asi que mezclarlos contaria dos
# veces. Aun asi puede no cerrar —un curso-horario con dos docentes de tipos
# distintos cae en dos hojas—, y para eso esta la comprobacion de mas abajo: si
# la suma no da lo que llega, no se publica nada.
#
# La etiqueta no viaja: la superficie ya conoce el nombre de la categoria que
# esta pintando y la busca por `segment_key`. Publicarla aqui solo engordaria
# la cascada con texto que el front ya tiene.
.cm_criterios_step_segments <- function(spec, context) {
  entry <- spec$entry
  if (!is.list(entry) || !identical(spec$scope, "aula")) return(NULL)
  kind <- .cm_aulas_scalar(entry$kind, "")
  if (!kind %in% c("flat", "hierarchical")) return(NULL)
  segments <- .cm_criterios_unique_segments(entry)
  if (identical(kind, "hierarchical")) {
    segments <- Filter(function(segment) {
      !identical(.cm_aulas_scalar(segment$segment_kind, ""), "grupo")
    }, segments)
  }
  if (!length(segments)) return(NULL)
  out <- lapply(segments, function(segment) {
    if (identical(.cm_aulas_scalar(segment$segment_kind, ""), "global")) return(NULL)
    key <- .cm_aulas_scalar(segment$segment_key, "")
    if (!nzchar(key)) return(NULL)
    list(
      segment_key = key,
      mask = .cm_criterios_total_aula_mask(entry, segment, context) %in% TRUE
    )
  })
  out <- Filter(Negate(is.null), out)
  if (!length(out)) NULL else out
}

.cm_criterios_step_counts <- function(before, after, faculties, segments = NULL) {
  faculty_rows <- lapply(faculties, function(faculty) {
    before_n <- as.integer(sum(before[faculty$idx] %in% TRUE))
    after_n <- as.integer(sum(after[faculty$idx] %in% TRUE))
    row <- list(
      faculty_key = faculty$faculty_key,
      label = faculty$label,
      before_ch = before_n,
      after_ch = after_n,
      excluded_ch = as.integer(before_n - after_n)
    )
    if (length(segments)) {
      reparto <- lapply(segments, function(segment) list(
        segment_key = segment$segment_key,
        before_ch = as.integer(sum(
          before[faculty$idx] %in% TRUE & segment$mask[faculty$idx]
        )),
        after_ch = as.integer(sum(
          after[faculty$idx] %in% TRUE & segment$mask[faculty$idx]
        ))
      ))
      # G41 · El reparto se publica siempre; lo que se declara es si PARTICIONA.
      #
      # La primera version lo callaba cuando la suma no daba el total, y eso
      # borro de la pantalla la cifra de «Tipo de docente» —Gonzalo: «pero ahora
      # aqui ya no salen»—. El dato por categoria es correcto y util: de los N
      # que llegan, cuantos tienen este tipo de docente. Lo que no se puede
      # prometer ahi es que las categorias sumen N, porque un curso-horario con
      # dos docentes de tipos distintos cuenta en dos.
      #
      # Asi que se publica el reparto y, junto a el, si las categorias son
      # excluyentes. La superficie enseña la cifra siempre y avisa cuando no
      # suman, en vez de dejar un hueco que nadie sabe leer.
      row$segments <- reparto
      row$segments_particionan <-
        sum(vapply(reparto, `[[`, integer(1), "before_ch")) == before_n &&
        sum(vapply(reparto, `[[`, integer(1), "after_ch")) == after_n
    }
    row
  })
  before_total <- as.integer(sum(before %in% TRUE))
  after_total <- as.integer(sum(after %in% TRUE))
  list(
    faculties = faculty_rows,
    total = list(
      before_ch = before_total,
      after_ch = after_total,
      excluded_ch = as.integer(before_total - after_total)
    )
  )
}

.cm_criterios_components_current <- function(context) {
  n <- nrow(context$aula_frame)
  flags <- context$criterios$flags
  components <- list()
  if (is.data.frame(flags) && nrow(flags) == n) {
    idx <- seq_len(n)
    if ("classroom_id" %in% names(flags)) {
      idx <- match(
        .cm_aulas_values(context$aula_frame, "classroom_id", ""),
        .cm_aulas_values(flags, "classroom_id", "")
      )
    }
    if (!anyNA(idx)) {
      for (column in intersect(names(.cm_criterios_flag_id), names(flags))) {
        flag <- suppressWarnings(as.logical(flags[[column]][idx]))
        if (length(flag) == n && !anyNA(flag)) {
          components[[length(components) + 1L]] <- list(
            id = unname(.cm_criterios_flag_id[[column]]), flag = flag,
            source = paste0("flag:", column)
          )
        }
      }
    }
  }
  for (i in seq_along((context$criterios$seleccion_aula %||% list())$pasos %||% list())) {
    step <- context$criterios$seleccion_aula$pasos[[i]]
    flag <- suppressWarnings(as.logical(step$flag))
    if (length(flag) == n && !anyNA(flag)) {
      components[[length(components) + 1L]] <- list(
        id = .cm_aulas_scalar(step$id, ""), flag = flag,
        source = paste0("step:", i)
      )
    }
  }
  components
}

.cm_criterios_reduce_components <- function(components, id, n) {
  selected <- Filter(function(component) identical(component$id, id), components)
  if (!length(selected)) return(rep(TRUE, n))
  Reduce(`&`, lapply(selected, `[[`, "flag"), init = rep(TRUE, n))
}

.cm_criterios_current_applies <- function(id, context, components) {
  if (identical(id, "minEligible")) return(TRUE)
  if (id %in% c("c7", "c8_facultad", "c8")) {
    return(isTRUE((context$criterios$aplica %||% list())[[id]]))
  }
  if (any(vapply(components, function(component) identical(component$id, id), logical(1)))) {
    return(TRUE)
  }
  selection <- .cm_criterios_normalize_seleccion(
    (context$config %||% list())$criterios_seleccion
  )
  criterion <- (selection$byVariable %||% list())[[id]]
  !is.null(criterion)
}

.cm_criterios_cascade_root <- function(context, criteria_hash, moment, steps) {
  list(
    schema = .cm_criterios_cascada_schema,
    owner = "calc_muestra_aulas_frame_v1.criterios_cascada",
    source_frame_hash = context$source_frame_hash,
    criteria_hash = criteria_hash,
    momento = moment,
    grain = "paso_x_facultad_efectiva",
    unit = "curso_horario_unico",
    order_source = "motor_r",
    steps = steps
  )
}

.cm_criterios_cascada_ejecutada <- function(context) {
  n <- nrow(context$aula_frame)
  specs <- .cm_criterios_step_specs(context)
  faculties <- .cm_criterios_facultades(context)
  components <- .cm_criterios_components_current(context)
  current <- rep(TRUE, n)
  steps <- vector("list", length(specs))
  selection <- .cm_criterios_normalize_seleccion(
    (context$config %||% list())$criterios_seleccion
  )
  for (i in seq_along(specs)) {
    spec <- specs[[i]]
    id <- spec$criterion_id
    before <- current
    if (identical(id, "manual_excluded")) {
      flag <- .cm_criterios_reduce_components(components, id, n) &
        .cm_criterio_radiografia_manual_ok(
          context$aula_frame, context$particularidades
        )
      applies <- any(!flag)
      status <- if (applies) "aplicado" else "inactivo"
    } else {
      flag <- .cm_criterios_reduce_components(components, id, n)
      applies <- .cm_criterios_current_applies(id, context, components)
      criterion <- (selection$byVariable %||% list())[[id]]
      informative <- !is.null(criterion) &&
        identical(.cm_aulas_scalar(criterion$layer, "marco"), "instrumento")
      status <- if (informative) "informativo" else if (applies) "aplicado" else "inactivo"
    }
    current <- current & flag
    counts <- .cm_criterios_step_counts(
      before, current, faculties, .cm_criterios_step_segments(spec, context)
    )
    steps[[i]] <- list(
      order = as.integer(i), criterion_id = id, card_id = spec$card_id,
      label = spec$label, scope = spec$scope, gate = spec$gate,
      applies = applies, status = status,
      faculties = counts$faculties, total = counts$total
    )
  }
  target <- context$aula_frame$included %in% TRUE
  if (length(current) != length(target) || !isTRUE(all(current == target))) {
    return(NULL)
  }
  .cm_criterios_cascade_root(
    context, context$current_criteria_hash, "marco_ejecutado", steps
  )
}

.cm_criterios_preview_student_flag <- function(id, criterion, context, index) {
  filas <- (context$criterios$radiografia_contexto %||% list())$filas %||% list()
  n <- length(filas$student_id %||% character(0))
  faculty_keys <- .cm_criterios_fac_key(filas$faculty %||% rep("", n))
  switch(.cm_aulas_scalar(criterion$kind, ""),
    flat = .cm_criterios_eval_flat_vec(
      filas[[id]] %||% rep("", n), criterion, faculty_keys
    ),
    numeric = .cm_criterios_eval_numeric(
      .cm_criterio_radiografia_num_values(index, filas, id, n), criterion$threshold
    ),
    ordinal = .cm_criterios_eval_ordinal(
      .cm_criterio_radiografia_num_values(index, filas, id, n), criterion
    ),
    rep(TRUE, n)
  )
}

.cm_criterios_preview_aula_flag <- function(id, selection, cfg, context,
                                             membership, composition) {
  n <- nrow(context$aula_frame)
  values <- context$values %||% list()
  faculty_keys <- .cm_criterios_fac_key(values$faculty %||% rep("", n))
  if (identical(id, "minEligible")) {
    rule <- selection$minEligible
    if (is.null(rule) || !is.finite(rule$threshold)) {
      rule <- list(
        threshold = .cm_criterios_min_eligible_efectivo(cfg), byFaculty = list()
      )
    }
    return(list(
      flag = .cm_criterios_eval_min_eligible(
        membership$eligible_n, faculty_keys, rule
      ),
      applies = TRUE
    ))
  }
  if (id %in% c("c7", "c8_facultad", "c8")) {
    apply_field <- c(
      c7 = "require_min_prevalence",
      c8_facultad = "require_faculty_prevalence",
      c8 = "require_cycle_homogeneity"
    )[[id]]
    threshold_field <- c(
      c7 = "min_prevalence_pct",
      c8_facultad = "min_faculty_prevalence_pct",
      c8 = "min_cycle_homogeneity_pct"
    )[[id]]
    default <- c(c7 = 0.80, c8_facultad = 0.80, c8 = 0.80)[[id]]
    applies <- isTRUE(cfg$filters[[apply_field]])
    threshold <- .cm_criterios_pct(cfg$filters[[threshold_field]], default)
    signal <- composition[[id]] %||% rep(NA_real_, n)
    return(list(
      flag = if (applies) is.na(signal) | signal >= threshold else rep(TRUE, n),
      applies = applies
    ))
  }
  if (identical(id, "course_level")) {
    applies <- length(selection$courseLevelRanges %||% list()) > 0L
    return(list(
      flag = if (applies) {
        .cm_criterios_eval_course_ranges(
          values$course_pairs, selection$courseLevelRanges
        )
      } else rep(TRUE, n),
      applies = applies
    ))
  }
  criterion <- (selection$byVariable %||% list())[[id]]
  applies <- !is.null(criterion) && identical(criterion$scope, "aula") &&
    .cm_criterios_regla_aula_accionable(criterion)
  if (!applies) return(list(flag = rep(TRUE, n), applies = FALSE))
  empty_key <- NULL
  if (id %in% ((context$criterios$radiografia_contexto %||% list())$empty_bucket_cols %||% character(0))) {
    empty_key <- (.cm_criterios_var_registry()[[id]]$emptyBucket %||% list())$key
  }
  flag <- switch(.cm_aulas_scalar(criterion$kind, ""),
    flat = .cm_criterios_eval_flat_vec(
      values[[id]] %||% rep("", n), criterion, faculty_keys,
      empty_key = empty_key
    ),
    hierarchical = .cm_criterios_eval_teacher(
      values$teacher %||% rep("", n), criterion, faculty_keys
    ),
    numeric = .cm_criterios_eval_numeric(
      values[[id]] %||% rep(NA_real_, n), criterion$threshold
    ),
    rep(TRUE, n)
  )
  list(flag = flag, applies = TRUE)
}

calc_muestra_aulas_criterios_preview <- function(
    context, config, source_frame_hash, criteria_hash) {
  if (!is.list(context) ||
      !identical(.cm_aulas_scalar(context$schema, ""), .cm_criterios_contexto_schema) ||
      !identical(.cm_aulas_scalar(source_frame_hash, ""), context$source_frame_hash) ||
      !identical(.cm_aulas_scalar(criteria_hash, ""), context$current_criteria_hash)) {
    stop_api(
      409, "E_CALC_MUESTRA_CRITERIOS_PREVIEW_STALE",
      "El contexto de criterios no existe o corresponde a otro marco/configuracion."
    )
  }
  if (!is.list(config)) {
    stop_api(
      400, "E_CALC_MUESTRA_CRITERIOS_PREVIEW_INPUT",
      "config debe ser un objeto de configuracion de aulas."
    )
  }
  cfg <- calc_muestra_aulas_normalize_config(config)
  selection <- .cm_criterios_normalize_seleccion(cfg$criterios_seleccion)
  specs <- .cm_criterios_step_specs(context)
  faculties <- .cm_criterios_facultades(context)
  n_ch <- nrow(context$aula_frame)
  filas <- (context$criterios$radiografia_contexto %||% list())$filas %||% list()
  n_rows <- length(filas$student_id %||% character(0))
  row_ok <- suppressWarnings(as.logical(filas$row_base_ok %||% logical(0)))
  if (length(row_ok) != n_rows || anyNA(row_ok)) row_ok <- rep(FALSE, n_rows)
  index <- context$student_index
  if (!is.list(index)) {
    index <- .cm_criterio_radiografia_indice_alumno(context$aula_frame, filas)
  }
  current <- rep(TRUE, n_ch)
  membership <- NULL
  composition <- NULL
  steps <- vector("list", length(specs))
  for (i in seq_along(specs)) {
    spec <- specs[[i]]
    id <- spec$criterion_id
    before <- current
    applies <- FALSE
    status <- "inactivo"
    flag <- rep(TRUE, n_ch)
    if (identical(id, "manual_excluded")) {
      excluded <- selection$manualExcludedClassrooms %||% character(0)
      ch_keys <- .cm_aulas_text_key(
        .cm_aulas_values(context$aula_frame, "classroom_id", "")
      )
      flag <- !(ch_keys %in% excluded) & .cm_criterio_radiografia_manual_ok(
        context$aula_frame, context$particularidades
      )
      applies <- any(!flag)
      status <- if (applies) "aplicado" else "inactivo"
    } else if (identical(spec$scope, "alumno")) {
      criterion <- (selection$byVariable %||% list())[[id]]
      applies <- !is.null(criterion)
      if (applies && identical(.cm_aulas_scalar(criterion$layer, "marco"), "marco")) {
        student_flag <- .cm_criterios_preview_student_flag(
          id, criterion, context, index
        )
        if (length(student_flag) == n_rows && !anyNA(student_flag)) {
          row_ok <- row_ok & student_flag
        } else {
          row_ok <- rep(FALSE, n_rows)
        }
        membership <- NULL
        composition <- NULL
        status <- "aplicado"
      } else if (applies) {
        status <- "informativo"
      }
    } else {
      if (is.null(membership)) {
        membership <- .cm_criterio_radiografia_membresias(
          context$aula_frame, filas, row_ok, index
        )
      }
      if (is.null(composition)) {
        composition <- .cm_criterio_radiografia_composicion(
          context$aula_frame, filas, membership, context$values,
          context$criterios$radiografia_contexto %||% list()
        )
      }
      evaluated <- .cm_criterios_preview_aula_flag(
        id, selection, cfg, context, membership, composition
      )
      flag <- evaluated$flag
      applies <- isTRUE(evaluated$applies)
      status <- if (applies) "aplicado" else "inactivo"
    }
    current <- current & flag
    counts <- .cm_criterios_step_counts(
      before, current, faculties, .cm_criterios_step_segments(spec, context)
    )
    steps[[i]] <- list(
      order = as.integer(i), criterion_id = id, card_id = spec$card_id,
      label = spec$label, scope = spec$scope, gate = spec$gate,
      applies = applies, status = status,
      faculties = counts$faculties, total = counts$total
    )
  }
  .cm_criterios_cascade_root(
    context, .cm_criterios_hash(cfg), "borrador_no_persistido", steps
  )
}

.cm_criterios_contexto_construir <- function(out, criterios) {
  values <- (criterios$seleccion_aula %||% list())$valores %||% list()
  list(
    schema = .cm_criterios_contexto_schema,
    source_frame_hash = .cm_aulas_scalar(out$frame_hash, ""),
    current_criteria_hash = .cm_criterios_hash(out$config),
    config = out$config,
    aula_frame = out$aula_frame,
    criterios_catalogo = out$criterios_catalogo,
    criterios_radiografia = out$criterios_radiografia,
    student_index = attr(
      out$criterios_radiografia, .cm_criterios_indice_attr, exact = TRUE
    ),
    particularidades = out$particularidades,
    criterios = criterios,
    values = values
  )
}

# Integracion unica en construir(): adjunta solo agregados al payload y deja el
# contexto raw en un atributo privado que el router extrae antes de responder.
.cm_criterios_i18b_adjuntar <- function(out, criterios) {
  if (!is.list(out) || !is.list(out$criterios_radiografia) ||
      !is.list(criterios)) return(out)
  context <- .cm_criterios_contexto_construir(out, criterios)
  attr(out$criterios_radiografia, .cm_criterios_indice_attr) <- NULL
  out$criterios_totales <- calc_muestra_aulas_criterios_totales(context)
  out$criterios_cascada <- .cm_criterios_cascada_ejecutada(context)
  attr(out, .cm_criterios_contexto_attr) <- context
  out
}

.pulso_sanitize_calc_muestra_criteria_distribution <- function(value) {
  if (!is.list(value)) return(NULL)
  .pulso_whitelist_scalar_fields(
    value,
    c("media", "p10", "p25", "p50", "p75", "p90")
  )
}

.pulso_sanitize_calc_muestra_criteria_snapshot <- function(value) {
  if (!is.list(value)) return(NULL)
  out <- .pulso_whitelist_scalar_fields(
    value,
    c("n_ch", "n_ch_con_dato", "n_estudiantes_unicos", "n_matriculas")
  )
  out["distribution"] <- list(
    .pulso_sanitize_calc_muestra_criteria_distribution(value$distribution)
  )
  out
}

.pulso_sanitize_calc_muestra_criteria_signal <- function(value) {
  if (!is.list(value)) return(NULL)
  # G38 · La whitelist es la que decide qué llega al cliente. Los campos nuevos
  # del contrato v2 se declaran aquí o se caen sin dejar rastro: el payload sale
  # bien formado, el front encuentra `undefined` y el defecto se lee como «el
  # motor no lo publica».
  out <- .pulso_whitelist_scalar_fields(value, c(
    "unit", "n_total", "n_con_dato",
    "min", "max", "bigote_inf", "bigote_sup",
    "n_atipicos", "n_atipicos_inf", "n_atipicos_sup",
    "umbral_aplicado", "n_fuera"
  ))
  distribution <- .pulso_sanitize_calc_muestra_criteria_distribution(value)
  for (field in c("media", "p10", "p25", "p50", "p75", "p90")) {
    out[field] <- list(distribution[[field]])
  }
  # Vectores: no son escalares y la whitelist de arriba los descartaría.
  for (field in c("hist_breaks", "hist_counts", "n_fuera_por_corte")) {
    v <- value[[field]]
    if (is.numeric(v)) out[field] <- list(v)
  }
  # La escala es del dominio, no del dato: viaja como par para que el eje no
  # tenga que decidirlo el cliente.
  if (is.list(value$escala)) {
    out["escala"] <- list(.pulso_whitelist_scalar_fields(value$escala, c("min", "max")))
  }
  out
}

.pulso_sanitize_calc_muestra_criteria_total_row <- function(value) {
  if (!is.list(value)) return(NULL)
  out <- .pulso_whitelist_scalar_fields(value, c(
    "criterion_id", "card_id", "label", "segment_key", "segment_label",
    "segment_kind"
  ))
  out["actual"] <- list(
    .pulso_sanitize_calc_muestra_criteria_snapshot(value$actual)
  )
  out["contraste_total"] <- list(
    .pulso_sanitize_calc_muestra_criteria_snapshot(value$contraste_total)
  )
  if (is.list(value$signal_distribution)) {
    out["signal_distribution"] <- list(
      .pulso_sanitize_calc_muestra_criteria_signal(value$signal_distribution)
    )
  }
  out
}

.pulso_sanitize_calc_muestra_criteria_totals <- function(value) {
  if (!is.list(value)) return(NULL)
  out <- .pulso_whitelist_scalar_fields(value, c(
    "schema", "owner", "source_schema", "source_frame_hash", "momento",
    "grain", "unit"
  ))
  rows <- lapply(
    .pulso_record_list(value$rows),
    .pulso_sanitize_calc_muestra_criteria_total_row
  )
  out["rows"] <- list(Filter(Negate(is.null), rows))
  out
}

.pulso_sanitize_calc_muestra_criteria_cascade_count <- function(value) {
  if (!is.list(value)) return(NULL)
  .pulso_whitelist_scalar_fields(value, c("before_ch", "after_ch", "excluded_ch"))
}

.pulso_sanitize_calc_muestra_criteria_cascade_segment <- function(value) {
  if (!is.list(value)) return(NULL)
  .pulso_whitelist_scalar_fields(
    value, c("segment_key", "before_ch", "after_ch")
  )
}

.pulso_sanitize_calc_muestra_criteria_cascade_faculty <- function(value) {
  if (!is.list(value)) return(NULL)
  out <- .pulso_whitelist_scalar_fields(value, c(
    "faculty_key", "label", "before_ch", "after_ch", "excluded_ch",
    "segments_particionan"
  ))
  # G41 · El reparto por categoria viaja en el `.pulso`. Un campo nuevo que no
  # se anade aqui se pierde al guardar y reaparece vacio al abrir: el proyecto
  # se veria distinto segun si la sesion lo construyo o lo cargo.
  if (length(value$segments)) {
    segments <- lapply(
      .pulso_record_list(value$segments),
      .pulso_sanitize_calc_muestra_criteria_cascade_segment
    )
    out["segments"] <- list(Filter(Negate(is.null), segments))
  }
  out
}

.pulso_sanitize_calc_muestra_criteria_cascade_step <- function(value) {
  if (!is.list(value)) return(NULL)
  out <- .pulso_whitelist_scalar_fields(value, c(
    "order", "criterion_id", "card_id", "label", "scope", "gate",
    "applies", "status"
  ))
  faculties <- lapply(
    .pulso_record_list(value$faculties),
    .pulso_sanitize_calc_muestra_criteria_cascade_faculty
  )
  out["faculties"] <- list(Filter(Negate(is.null), faculties))
  out["total"] <- list(
    .pulso_sanitize_calc_muestra_criteria_cascade_count(value$total)
  )
  out
}

.pulso_sanitize_calc_muestra_criteria_cascade <- function(value) {
  if (!is.list(value)) return(NULL)
  out <- .pulso_whitelist_scalar_fields(value, c(
    "schema", "owner", "source_frame_hash", "criteria_hash", "momento",
    "grain", "unit", "order_source"
  ))
  steps <- lapply(
    .pulso_record_list(value$steps),
    .pulso_sanitize_calc_muestra_criteria_cascade_step
  )
  out["steps"] <- list(Filter(Negate(is.null), steps))
  out
}

.pulso_sanitize_calc_muestra_criteria_frame <- function(frame) {
  if (!is.list(frame)) return(frame)
  attr(frame, .cm_criterios_contexto_attr) <- NULL
  frame$criterios_totales <-
    .pulso_sanitize_calc_muestra_criteria_totals(frame$criterios_totales)
  frame$criterios_cascada <-
    .pulso_sanitize_calc_muestra_criteria_cascade(frame$criterios_cascada)
  frame$criterios_anclas_historicas <-
    .pulso_sanitize_calc_muestra_anchors(frame$criterios_anclas_historicas)
  frame
}

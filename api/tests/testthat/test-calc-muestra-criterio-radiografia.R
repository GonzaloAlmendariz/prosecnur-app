# Contrato estadístico de `frame$criterios_radiografia` para el criterio
# session_type × facultad efectiva. El fixture separa deliberadamente las
# exclusiones del tipo de sesión de otros gates, otros pasos y una decisión
# manual aplicada sobre un CH que ya estaba fuera.

.cr_fixture <- function(mode = "include", con_excepcion = TRUE, mismatch = FALSE) {
  ids <- c(
    "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8",
    "B1", "B2", "B3", "B4"
  )
  tipos <- c(
    "TALLER", "TEORICO", "TEORICO", "TEORICO", "TALLER", "", "SEMINARIO", "TEORICO",
    "TALLER", "LABORATORIO", "LABORATORIO", "TEORICO"
  )
  facultades <- c(rep("FACULTAD A", 8L), rep("FACULTAD B", 4L))
  elegibles <- c(10, 20, 30, 40, NA, 5, NA, 50, 2, 4, 6, 8)

  seleccion_tipo <- list(
    mode = mode,
    categories = list("taller")
  )
  if (con_excepcion) {
    seleccion_tipo$exceptions <- list(
      "FACULTAD B" = list(op = "replace", categories = list())
    )
  }
  seleccion <- list(byVariable = list(session_type = seleccion_tipo))
  normalizada <- .cm_criterios_normalize_seleccion(seleccion)
  criterio_tipo <- normalizada$byVariable$session_type
  session_ok <- .cm_criterios_eval_flat_vec(
    tipos,
    criterio_tipo,
    .cm_criterios_fac_key(facultades)
  )

  # A3 falla otro gate previo. A8 falla otro paso de la suite. A4 tiene una
  # decisión manual "excluir" pero ya cae por session_type en el ejecutado.
  c7_ok <- ids != "A3"
  modalidad_ok <- ids != "A8"
  decisiones <- list(A4 = list(decision = "excluir", nota = "No ofertado"))
  manual_ok <- !(ids %in% names(decisiones))
  included <- c7_ok & modalidad_ok & session_ok & manual_ok
  if (mismatch) included[[1]] <- !included[[1]]

  list(
    aula_frame = data.frame(
      classroom_id = ids,
      eligible_n = elegibles,
      included = included,
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    criterios = list(
      flags = data.frame(
        classroom_id = ids,
        min_eligible_ok = TRUE,
        teacher_ok = TRUE,
        course_level_ok = TRUE,
        campus_ok = TRUE,
        c7_ok = c7_ok,
        c8_facultad_ok = TRUE,
        c8_ok = TRUE,
        stringsAsFactors = FALSE,
        check.names = FALSE
      ),
      seleccion_aula = list(
        ok = session_ok & modalidad_ok,
        reason = ifelse(session_ok & modalidad_ok, "", "criterio"),
        valores = list(session_type = tipos, faculty = facultades),
        pasos = list(
          list(id = "session_type", label = "Tipo de sesión", flag = session_ok),
          list(id = "modality", label = "Modalidad", flag = modalidad_ok),
          list(id = "minEligible", label = "Elegibles", flag = rep(TRUE, length(ids)))
        )
      )
    ),
    criterios_seleccion = seleccion,
    particularidades = list(decisiones = decisiones),
    frame_hash = "hash-fixture"
  )
}

.cr_run <- function(fx) {
  calc_muestra_aulas_criterios_radiografia(
    aula_frame = fx$aula_frame,
    criterios = fx$criterios,
    criterios_seleccion = fx$criterios_seleccion,
    particularidades = fx$particularidades,
    frame_hash = fx$frame_hash
  )
}

.cr_cero_ch_fixture <- function(categories) {
  ids <- c("A-TEO", "B-TAL")
  tipos <- c("TEORICO", "TALLER")
  facultades <- c("FACULTAD A", "FACULTAD B")
  seleccion <- list(byVariable = list(
    session_type = list(mode = "include", categories = as.list(categories))
  ))
  criterio <- .cm_criterios_normalize_seleccion(seleccion)$byVariable$session_type
  session_ok <- .cm_criterios_eval_flat_vec(
    tipos, criterio, .cm_criterios_fac_key(facultades)
  )
  list(
    aula_frame = data.frame(
      classroom_id = ids,
      eligible_n = c(7, 5),
      included = session_ok,
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    criterios = list(
      flags = data.frame(
        classroom_id = ids,
        min_eligible_ok = TRUE,
        teacher_ok = TRUE,
        course_level_ok = TRUE,
        campus_ok = TRUE,
        c7_ok = TRUE,
        c8_facultad_ok = TRUE,
        c8_ok = TRUE,
        stringsAsFactors = FALSE,
        check.names = FALSE
      ),
      seleccion_aula = list(
        ok = session_ok,
        reason = ifelse(session_ok, "", "session_type"),
        valores = list(session_type = tipos, faculty = facultades),
        pasos = list(
          list(id = "session_type", label = "Tipo de sesión", flag = session_ok),
          list(id = "minEligible", label = "Elegibles", flag = rep(TRUE, length(ids)))
        )
      )
    ),
    criterios_seleccion = seleccion,
    particularidades = list(decisiones = list()),
    frame_hash = "hash-cero-ch"
  )
}

.cr_colision_sin_dato_fixture <- function() {
  ids <- paste0("SD-", 1:4)
  tipos <- c("", "SIN DATO", "", "SIN DATO")
  facultades <- c("", "", "Sin dato", "Sin dato")
  seleccion <- list(byVariable = list(
    session_type = list(mode = "include", categories = list())
  ))
  criterio <- .cm_criterios_normalize_seleccion(seleccion)$byVariable$session_type
  session_ok <- .cm_criterios_eval_flat_vec(
    tipos, criterio, .cm_criterios_fac_key(facultades)
  )
  list(
    aula_frame = data.frame(
      classroom_id = ids,
      eligible_n = c(1, 2, 3, 4),
      included = session_ok,
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    criterios = list(
      flags = data.frame(
        classroom_id = ids,
        min_eligible_ok = TRUE,
        teacher_ok = TRUE,
        course_level_ok = TRUE,
        campus_ok = TRUE,
        c7_ok = TRUE,
        c8_facultad_ok = TRUE,
        c8_ok = TRUE,
        stringsAsFactors = FALSE,
        check.names = FALSE
      ),
      seleccion_aula = list(
        ok = session_ok,
        reason = rep("", length(ids)),
        valores = list(session_type = tipos, faculty = facultades),
        pasos = list(
          list(id = "session_type", label = "Tipo de sesión", flag = session_ok),
          list(id = "minEligible", label = "Elegibles", flag = rep(TRUE, length(ids)))
        )
      )
    ),
    criterios_seleccion = seleccion,
    particularidades = list(decisiones = list()),
    frame_hash = "hash-colision-sin-dato"
  )
}

.cr_row <- function(out, facultad_key, categoria_key) {
  hit <- Filter(function(x) {
    identical(x$facultad_key, facultad_key) &&
      identical(x$categoria_key, categoria_key)
  }, out$filas)
  expect_length(hit, 1L)
  hit[[1]]
}

.cr_entry <- function(out, id) {
  hit <- Filter(function(x) identical(x$id, id), out$criterios)
  expect_length(hit, 1L)
  hit[[1]]
}

.cr_v2_row <- function(entry, faculty_key, segment_key) {
  hit <- Filter(function(x) {
    identical(x$faculty_key, faculty_key) && identical(x$segment_key, segment_key)
  }, entry$rows)
  expect_length(hit, 1L)
  hit[[1]]
}

test_that("radiografía publica el contrato sibling con grano y owner explícitos", {
  out <- .cr_run(.cr_fixture())

  expect_named(out, c(
    "schema", "owner", "frame_hash", "momento", "grano", "unidad",
    "filas_owner", "filas_grano", "filas", "criterios"
  ))
  expect_identical(out$schema, "calc_muestra_aulas_criterios_radiografia_v2")
  expect_identical(out$owner, "calc_muestra_aulas_frame_v1.criterios_radiografia")
  expect_identical(out$frame_hash, "hash-fixture")
  expect_identical(out$momento, "marco_ejecutado")
  expect_identical(out$grano, "criterio_x_facultad_x_segmento")
  expect_identical(out$unidad, "curso_horario_unico")
  expect_identical(out$filas_owner, "calc_muestra_aulas_frame_v1.aula_frame")
  expect_identical(out$filas_grano, "session_type_x_facultad_efectiva")
  expect_length(out$filas, 10L) # 2 facultades × 5 categorías, incl. Sin dato.

  fila <- .cr_row(out, "facultad_a", "teorico")
  expect_named(fila, c(
    "criterio", "facultad_key", "facultad_label", "categoria_key", "categoria_label",
    "n_ch_total", "n_ch_elegibles", "n_matriculas_elegibles",
    "distribucion_elegible", "contraste_total", "delta_marginal"
  ))
  expect_identical(fila$criterio, "session_type")
  expect_identical(fila$facultad_label, "FACULTAD A")
  expect_identical(fila$categoria_label, "TEORICO")
})

test_that("inventario v2 no descarta modality cuando coexiste con session_type", {
  base <- data.frame(
    estudiante = c("E1", "E2", "E3"),
    curso_horario = c("CH-1", "CH-2", "CH-3"),
    facultad = c("FAC A", "FAC A", "FAC B"),
    modalidad = c("PRESENCIAL", "VIRTUAL", "PRESENCIAL"),
    tipo = c("TALLER", "TEORICO", "TALLER"),
    nivel = c("3", "4", "5"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = list(
      mapping = list(
        student_id = "estudiante", classroom_id = "curso_horario",
        faculty = "facultad", modality = "modalidad", session_type = "tipo",
        level = "nivel"
      ),
      filters = list(
        require_adult = FALSE, require_undergraduate = FALSE,
        require_in_person = FALSE, accepted_conditions = list(),
        exclude_session_patterns = list(), min_eligible_per_class = 1L
      ),
      criterios_seleccion = list(byVariable = list(
        modality = list(mode = "include", categories = list("presencial")),
        session_type = list(mode = "include", categories = list("taller"))
      ))
    )
  )

  ids <- vapply(frame$criterios_radiografia$criterios, `[[`, character(1), "id")
  expect_true(all(c("modality", "session_type") %in% ids))
  modalidad <- .cr_entry(frame$criterios_radiografia, "modality")
  expect_identical(modalidad$status, "disponible")
  virtual <- .cr_v2_row(modalidad, "fac_a", "virtual")
  expect_identical(virtual$delta$action, "agregar_categoria")
  expect_true(virtual$delta$reconstruccion_valida)
  # CH-2 sigue fuera por session_type: el delta no atribuye ese solape a
  # modalidad.
  expect_identical(virtual$delta$delta_ch, 0L)
  expect_identical(virtual$delta$delta_matriculas, 0L)
  expect_identical(virtual$delta$delta_estudiantes_unicos, 0L)
})

test_that("criterio alumno cambia membresías pero congela outcomes CH ajenos", {
  base <- data.frame(
    estudiante = c("E1", "E2"),
    curso_horario = c("CH-1", "CH-1"),
    facultad = c("FAC A", "FAC A"),
    formacion = c("PREGRADO", "MAESTRIA"),
    tipo = c("TALLER", "TALLER"),
    nivel = c("3", "3"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  config_base <- list(
    mapping = list(
      student_id = "estudiante", classroom_id = "curso_horario",
      faculty = "facultad", formation = "formacion",
      session_type = "tipo", level = "nivel"
    ),
    filters = list(
      require_adult = FALSE, require_undergraduate = FALSE,
      require_in_person = FALSE, accepted_conditions = list(),
      exclude_session_patterns = list(), min_eligible_per_class = 1L
    ),
    criterios_seleccion = list(
      byVariable = list(formation = list(
        mode = "include", categories = list("pregrado", "maestria"), layer = "marco"
      )),
      minEligible = list(threshold = 2)
    )
  )
  frame <- calc_muestra_aulas_construir(base_madre = base, config = config_base)
  formation <- .cr_entry(frame$criterios_radiografia, "formation")
  maestria <- .cr_v2_row(formation, "fac_a", "maestria")
  expect_identical(formation$gate, "poblacion")
  expect_identical(formation$effective_layer, "marco")
  expect_true(maestria$delta$reconstruccion_valida)
  expect_identical(maestria$delta$action, "quitar_categoria")
  # Quitar MAESTRIA lleva eligible_n 2→1 (cruza minEligible=2), pero el
  # outcome del gate CH queda fijo por contrato marginal directo.
  expect_identical(maestria$delta$delta_ch, 0L)
  expect_identical(maestria$delta$delta_matriculas, -1L)
  expect_identical(maestria$delta$delta_estudiantes_unicos, -1L)

  config_info <- config_base
  config_info$criterios_seleccion$byVariable$formation$layer <- "instrumento"
  frame_info <- calc_muestra_aulas_construir(base_madre = base, config = config_info)
  formation_info <- .cr_entry(frame_info$criterios_radiografia, "formation")
  info_row <- .cr_v2_row(formation_info, "fac_a", "maestria")
  expect_identical(formation_info$gate, "informativo")
  expect_identical(formation_info$status, "disponible")
  expect_identical(info_row$delta$action, "no_aplica")
  expect_false(info_row$delta$reconstruccion_valida)
  expect_true(all(is.na(unlist(info_row$delta[c(
    "delta_ch", "delta_matriculas", "delta_estudiantes_unicos"
  )]))))
})

test_that("teacher_type respeta el kind efectivo flat o hierarchical", {
  construir <- function(docentes, categories) {
    base <- data.frame(
      estudiante = paste0("E", seq_along(docentes)),
      curso_horario = paste0("CH", seq_along(docentes)),
      facultad = "FAC A",
      tipo_docente = docentes,
      tipo_sesion = "TALLER",
      nivel = "3",
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
    calc_muestra_aulas_construir(
      base_madre = base,
      config = list(
        mapping = list(
          student_id = "estudiante", classroom_id = "curso_horario",
          faculty = "facultad", teacher_type = "tipo_docente",
          session_type = "tipo_sesion", level = "nivel"
        ),
        filters = list(
          require_adult = FALSE, require_undergraduate = FALSE,
          require_in_person = FALSE, accepted_conditions = list(),
          exclude_session_patterns = list(), min_eligible_per_class = 1L
        ),
        criterios_seleccion = list(byVariable = list(
          teacher_type = list(mode = "include", categories = as.list(categories))
        ))
      )
    )
  }

  flat <- construir(c("CONTRATADO", "ORDINARIO"), "contratado")
  flat_entry <- .cr_entry(flat$criterios_radiografia, "teacher_type")
  expect_identical(flat_entry$kind, "flat")
  expect_identical(flat_entry$family, "classroom_flat")
  expect_false(flat_entry$overlap)
  expect_true(all(vapply(
    flat_entry$rows, function(x) identical(x$segment_kind, "categoria"), logical(1)
  )))

  hier <- construir(c(
    "DOCENTE ORDINARIO - PRINCIPAL",
    "DOCENTE ORDINARIO - ASOCIADO",
    "CONTRATADO"
  ), "docente_ordinario")
  hier_entry <- .cr_entry(hier$criterios_radiografia, "teacher_type")
  expect_identical(hier_entry$kind, "hierarchical")
  expect_identical(hier_entry$family, "classroom_hierarchical")
  expect_true(hier_entry$overlap)
  expect_true(any(vapply(
    hier_entry$rows, function(x) identical(x$segment_kind, "grupo"), logical(1)
  )))
  expect_true(any(vapply(
    hier_entry$rows, function(x) identical(x$segment_kind, "categoria"), logical(1)
  )))
  row_keys <- vapply(hier_entry$rows, function(x) {
    paste(x$faculty_key, x$segment_key, sep = "::")
  }, character(1))
  expect_identical(length(unique(row_keys)), length(row_keys))
})

test_that("teacher_type vacio no activa un filtro ausente en la radiografia", {
  base <- data.frame(
    estudiante = paste0("E", 1:3),
    curso_horario = paste0("CH", 1:3),
    facultad = "FAC A",
    tipo_docente = c(
      "DOCENTE ORDINARIO - PRINCIPAL",
      "DOCENTE ORDINARIO - ASOCIADO",
      ""
    ),
    tipo_sesion = "TALLER",
    nivel = "3",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  config <- list(
    mapping = list(
      student_id = "estudiante", classroom_id = "curso_horario",
      faculty = "facultad", teacher_type = "tipo_docente",
      session_type = "tipo_sesion", level = "nivel"
    ),
    filters = list(
      require_adult = FALSE, require_undergraduate = FALSE,
      require_in_person = FALSE, accepted_conditions = list(),
      exclude_session_patterns = list(), min_eligible_per_class = 1L
    ),
    criterios_seleccion = list(byVariable = list(
      teacher_type = list(mode = "include", categories = list())
    ))
  )

  inactive <- calc_muestra_aulas_construir(base_madre = base, config = config)
  inactive_entry <- .cr_entry(inactive$criterios_radiografia, "teacher_type")
  expect_identical(inactive_entry$family, "classroom_hierarchical")
  expect_identical(inactive_entry$status, "disponible")
  expect_true(all(inactive$aula_frame$included))

  config$criterios_seleccion <- list(byVariable = list(
    teacher_type = list(mode = "include", categories = list("docente_ordinario"))
  ))
  active <- calc_muestra_aulas_construir(base_madre = base, config = config)
  active_entry <- .cr_entry(active$criterios_radiografia, "teacher_type")
  expect_identical(active_entry$status, "disponible")
  expect_identical(active$aula_frame$included, c(TRUE, TRUE, FALSE))
})

test_that("teacher_type vacio respeta la excepcion efectiva por facultad", {
  criterion <- .cm_criterios_normalize_criterio(
    list(
      mode = "include",
      categories = list(),
      exceptions = list(
        "FAC A" = list(op = "replace", categories = list("docente_ordinario"))
      )
    ),
    .cm_criterios_var_registry()$teacher_type
  )

  expect_identical(
    .cm_criterios_eval_teacher(
      c("", ""), criterion, c("fac_a", "fac_b")
    ),
    c(FALSE, TRUE)
  )
})

.cr_full_frame <- function() {
  ch <- rep(paste0("CH-SECRET-", 1:4), each = 2L)
  base <- data.frame(
    estudiante = paste0("STUDENT-SECRET-", 1:8),
    curso_horario = ch,
    formacion = rep(c("PREGRADO", "MAESTRIA"), 4L),
    condicion_alumno = rep(c("REGULAR", "ESPECIAL"), 4L),
    edad = c(18, 19, 20, 21, 22, 23, 24, 25),
    facultad_alumno = rep(c("FAC A", "FAC B"), each = 4L),
    nivel_alumno = rep(c("2", "3", "4", "5"), each = 2L),
    modalidad = rep(c("PRESENCIAL", "VIRTUAL"), each = 4L),
    tipo_sesion = rep(c("TALLER", "TEORICO"), times = 4L),
    tipo_docente = rep(c(
      "DOCENTE ORDINARIO - PRINCIPAL", "DOCENTE ORDINARIO - ASOCIADO"
    ), each = 4L),
    nivel_curso = rep(c("2", "3", "4", "5"), each = 2L),
    condicion_curso = rep(c("OBLIGATORIO", ""), each = 2L, times = 2L),
    matriculados = rep(c(10, 20, 30, 40), each = 2L),
    sede = rep(c("CENTRAL", "NORTE"), each = 4L),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  calc_muestra_aulas_construir(
    base_madre = base,
    config = list(
      mapping = list(
        student_id = "estudiante", classroom_id = "curso_horario",
        formation = "formacion", condition = "condicion_alumno", age = "edad",
        faculty = "facultad_alumno", level = "nivel_alumno",
        modality = "modalidad", session_type = "tipo_sesion",
        teacher_type = "tipo_docente", course_level = "nivel_curso",
        condicion_curso = "condicion_curso", enrolled_total = "matriculados",
        campus = "sede"
      ),
      filters = list(
        require_adult = FALSE, require_undergraduate = FALSE,
        require_in_person = FALSE, accepted_conditions = list(),
        exclude_session_patterns = list(), min_eligible_per_class = 1L
      ),
      criterios_seleccion = list(minEligible = list(threshold = 1))
    )
  )
}

test_that("inventario dinámico cubre todas las familias sin huérfanos", {
  frame <- .cr_full_frame()
  radio <- frame$criterios_radiografia
  catalog_ids <- vapply(frame$criterios_catalogo$variables, `[[`, character(1), "id")
  ids <- vapply(radio$criterios, `[[`, character(1), "id")
  cards <- vapply(radio$criterios, `[[`, character(1), "card_id")

  expect_setequal(ids, c(catalog_ids, "minEligible", "c7", "c8_facultad", "c8"))
  expect_identical(length(ids), length(catalog_ids) + 4L)
  expect_identical(length(unique(ids)), length(ids))
  expect_identical(length(unique(cards)), length(catalog_ids) + 2L)
  expect_true(all(vapply(
    radio$criterios, function(x) identical(x$status, "disponible"), logical(1)
  )))
  expect_true(all(vapply(radio$criterios, function(x) length(x$rows) > 0L, logical(1))))
  expect_setequal(
    unique(vapply(radio$criterios, `[[`, character(1), "family")),
    c(
      "student_flat", "student_numeric", "student_ordinal",
      "classroom_flat", "classroom_hierarchical", "classroom_range",
      "classroom_numeric", "threshold_gate", "proportion_gate"
    )
  )

  requiere_signal <- c(
    "student_numeric", "student_ordinal", "classroom_numeric",
    "classroom_range", "threshold_gate", "proportion_gate"
  )
  for (entry in radio$criterios) {
    if (!entry$family %in% requiere_signal) next
    expect_true(all(vapply(
      entry$rows, function(row) is.list(row$signal_distribution), logical(1)
    )), info = entry$id)
  }
})

test_that("numeric y ordinal calculan el delta solo en su faceta alumno", {
  base <- data.frame(
    estudiante = paste0("E", 1:5),
    curso_horario = c("CHA", "CHA", "CHB", "CHB", "CHB"),
    facultad = c("FAC A", "FAC A", "FAC B", "FAC B", "FAC B"),
    edad = c(18, 22, 17, 19, 23),
    nivel = c("2", "3", "1", "2", "3"),
    tipo = "TALLER",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  construir <- function(by_variable) calc_muestra_aulas_construir(
    base_madre = base,
    config = list(
      mapping = list(
        student_id = "estudiante", classroom_id = "curso_horario",
        faculty = "facultad", age = "edad", level = "nivel",
        session_type = "tipo"
      ),
      filters = list(
        require_adult = FALSE, require_undergraduate = FALSE,
        require_in_person = FALSE, accepted_conditions = list(),
        exclude_session_patterns = list(), min_eligible_per_class = 1L
      ),
      criterios_seleccion = list(
        byVariable = by_variable,
        minEligible = list(threshold = 1)
      )
    )
  )

  age <- construir(list(age = list(
    threshold = list(op = ">=", min = 21), layer = "marco"
  )))
  age_entry <- .cr_entry(age$criterios_radiografia, "age")
  age_a <- .cr_v2_row(age_entry, "fac_a", "global")
  age_b <- .cr_v2_row(age_entry, "fac_b", "global")
  expect_identical(age_a$delta$delta_ch, 0L)
  expect_identical(age_b$delta$delta_ch, 0L)
  expect_identical(age_a$delta$delta_matriculas, 1L)
  expect_identical(age_b$delta$delta_matriculas, 2L)

  level <- construir(list(level = list(
    includeValues = list(3), layer = "marco"
  )))
  level_entry <- .cr_entry(level$criterios_radiografia, "level")
  level_a <- .cr_v2_row(level_entry, "fac_a", "3")
  level_b <- .cr_v2_row(level_entry, "fac_b", "3")
  expect_identical(level_a$delta$delta_ch, 0L)
  expect_identical(level_b$delta$delta_ch, 0L)
  expect_identical(level_a$delta$delta_matriculas, 1L)
  expect_identical(level_b$delta$delta_matriculas, 2L)
})

test_that("sibling v2 no filtra contexto alumno×CH y sobrevive strip/RDS", {
  frame <- .cr_full_frame()
  radio <- frame$criterios_radiografia
  nombres <- character(0)
  recolectar <- function(x) {
    if (!is.list(x)) return(invisible(NULL))
    nombres <<- c(nombres, names(x) %||% character(0))
    invisible(lapply(x, recolectar))
  }
  recolectar(radio)
  expect_false(any(nombres %in% c(
    "student_id", "classroom_id", "radiografia_contexto",
    "manualExcludedClassrooms", "filas_alumno", "raw_rows"
  )))
  serializado <- jsonlite::toJSON(radio, auto_unbox = TRUE, null = "null", na = "null")
  expect_false(grepl("STUDENT-SECRET|CH-SECRET", serializado))

  stripped <- .pulso_strip_caches(list(calc_muestra_aulas_frame = frame))
  path <- tempfile(fileext = ".rds")
  on.exit(unlink(path), add = TRUE)
  saveRDS(stripped, path)
  back <- readRDS(path)
  expect_identical(
    back$calc_muestra_aulas_frame$criterios_radiografia,
    radio
  )
  expect_identical(
    back$calc_muestra_aulas_frame$criterios_radiografia$schema,
    "calc_muestra_aulas_criterios_radiografia_v2"
  )
})

test_that("catálogo explícito vacío no inventa session_type", {
  fx <- .cr_fixture()
  out <- calc_muestra_aulas_criterios_radiografia(
    aula_frame = fx$aula_frame,
    criterios = fx$criterios,
    criterios_seleccion = fx$criterios_seleccion,
    particularidades = fx$particularidades,
    frame_hash = fx$frame_hash,
    criterios_catalogo = list(
      schema = "calc_muestra_aulas_criterios_catalogo_v1", variables = list()
    )
  )
  expect_length(out$filas, 0L)
  expect_setequal(
    vapply(out$criterios, `[[`, character(1), "id"),
    c("minEligible", "c7", "c8_facultad", "c8")
  )
})

test_that("segmento Sin dato de aula reconstruible conserva delta 0/0/0", {
  base <- data.frame(
    estudiante = c("E1", "E2"),
    curso_horario = c("CH1", "CH2"),
    facultad = "FAC A",
    tipo = c("", "SIN DATO"),
    nivel = "3",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = list(
      mapping = list(
        student_id = "estudiante", classroom_id = "curso_horario",
        faculty = "facultad", session_type = "tipo", level = "nivel"
      ),
      filters = list(
        require_adult = FALSE, require_undergraduate = FALSE,
        require_in_person = FALSE, accepted_conditions = list(),
        exclude_session_patterns = list(), min_eligible_per_class = 1L
      ),
      criterios_seleccion = list(minEligible = list(threshold = 1))
    )
  )
  missing <- .cr_v2_row(
    .cr_entry(frame$criterios_radiografia, "session_type"),
    "fac_a", "__missing_session_type__"
  )
  expect_identical(missing$segment_kind, "sin_dato")
  expect_identical(missing$delta$action, "no_aplica")
  expect_true(missing$delta$reconstruccion_valida)
  expect_identical(
    unlist(missing$delta[c("delta_ch", "delta_matriculas", "delta_estudiantes_unicos")]),
    c(delta_ch = 0L, delta_matriculas = 0L, delta_estudiantes_unicos = 0L)
  )
})

test_that("snapshots y señales degradan cobertura parcial sin aproximar", {
  ids <- list(sets = list("E1", "E2"), valido = TRUE)
  parcial <- .cm_criterio_radiografia_snapshot(1:2, c(1, NA), ids)
  expect_identical(parcial$n_ch, 2L)
  expect_identical(parcial$n_ch_con_dato, 1L)
  expect_true(is.na(parcial$n_matriculas))
  expect_true(is.na(parcial$n_estudiantes_unicos))
  expect_true(all(is.na(unlist(parcial$distribution))))

  vacio <- .cm_criterio_radiografia_snapshot(integer(0), numeric(0), ids)
  expect_identical(vacio$n_ch, 0L)
  expect_identical(vacio$n_matriculas, 0L)
  expect_identical(vacio$n_estudiantes_unicos, 0L)
  expect_true(all(is.na(unlist(vacio$distribution))))

  signal <- .cm_criterio_radiografia_signal_distribution(c(0.5, NA), "proporcion")
  expect_identical(signal$n_total, 2L)
  expect_identical(signal$n_con_dato, 1L)
  expect_true(all(is.na(unlist(signal[c(
    "media", "p10", "p25", "p50", "p75", "p90"
  )]))))
})

test_that("delta marginal reabre solo el CH que falla exclusivamente por tipo", {
  out <- .cr_run(.cr_fixture())

  teorico <- .cr_row(out, "facultad_a", "teorico")
  expect_identical(teorico$n_ch_total, 4L)
  expect_identical(teorico$n_ch_elegibles, 0L)
  expect_identical(teorico$n_matriculas_elegibles, 0)
  expect_identical(teorico$contraste_total$n_ch_con_dato, 4L)
  expect_equal(teorico$contraste_total$media, 35)
  expect_identical(teorico$delta_marginal$referencia, "marco_ejecutado")
  expect_identical(teorico$delta_marginal$accion, "agregar_categoria")
  expect_identical(teorico$delta_marginal$delta_ch, 1L)
  expect_equal(teorico$delta_marginal$delta_matriculas_elegibles, 20)

  # A3 sigue fuera por c7; A8, por modalidad; A4, por decisión manual aunque
  # esa decisión no fue la que lo sacó del marco ejecutado.
  expect_false(teorico$delta_marginal$delta_ch %in% c(2L, 3L, 4L))
})

test_that("cuantiles type 7, medias elegible/total y NA estricto nacen en R", {
  out <- .cr_run(.cr_fixture())

  lab <- .cr_row(out, "facultad_b", "laboratorio")
  expect_identical(lab$n_ch_total, 2L)
  expect_identical(lab$n_ch_elegibles, 2L)
  expect_equal(lab$n_matriculas_elegibles, 10)
  expect_named(lab$distribucion_elegible, c("n_ch_con_dato", "media", "p10", "p25", "p50", "p75", "p90"))
  expect_identical(lab$distribucion_elegible$n_ch_con_dato, 2L)
  expect_equal(lab$distribucion_elegible$media, 5)
  expect_equal(
    unlist(lab$distribucion_elegible[c("p10", "p25", "p50", "p75", "p90")]),
    c(p10 = 4.2, p25 = 4.5, p50 = 5, p75 = 5.5, p90 = 5.8)
  )
  expect_identical(lab$contraste_total$n_ch_con_dato, 2L)
  expect_equal(lab$contraste_total$media, 5)

  taller <- .cr_row(out, "facultad_a", "taller")
  expect_identical(taller$n_ch_elegibles, 2L)
  expect_identical(taller$distribucion_elegible$n_ch_con_dato, 1L)
  expect_true(is.na(taller$n_matriculas_elegibles))
  expect_true(is.na(taller$distribucion_elegible$media))
  expect_true(all(is.na(unlist(taller$distribucion_elegible[c("p10", "p25", "p50", "p75", "p90")]))))
  expect_identical(taller$contraste_total$n_ch_con_dato, 1L)
  expect_true(is.na(taller$contraste_total$media))

  seminario <- .cr_row(out, "facultad_a", "seminario")
  expect_identical(seminario$delta_marginal$delta_ch, 1L)
  expect_true(is.na(seminario$delta_marginal$delta_matriculas_elegibles))
  seminario_v2 <- .cr_v2_row(
    .cr_entry(out, "session_type"), "facultad_a", "seminario"
  )
  expect_false(seminario_v2$delta$reconstruccion_valida)
  expect_true(all(is.na(unlist(seminario_v2$delta[c(
    "delta_ch", "delta_matriculas", "delta_estudiantes_unicos"
  )]))))
})

test_that("cruce completo conserva 0 CH y el bucket Sin dato no es accionable", {
  out <- .cr_run(.cr_fixture())

  cero <- .cr_row(out, "facultad_a", "laboratorio")
  expect_identical(cero$n_ch_total, 0L)
  expect_identical(cero$n_ch_elegibles, 0L)
  expect_identical(cero$n_matriculas_elegibles, 0)
  expect_identical(cero$distribucion_elegible$n_ch_con_dato, 0L)
  expect_true(is.na(cero$distribucion_elegible$media))
  expect_true(is.na(cero$contraste_total$media))
  # Aunque LABORATORIO no exista en esta facultad, la categoría es real y el
  # toggle modifica el set efectivo; aquí no cambia CH porque ya hay TALLER.
  expect_identical(cero$delta_marginal$accion, "agregar_categoria")
  expect_identical(cero$delta_marginal$delta_ch, 0L)
  expect_identical(cero$delta_marginal$delta_matriculas_elegibles, 0)

  sin_dato <- .cr_row(out, "facultad_a", "__missing_session_type__")
  expect_identical(sin_dato$categoria_label, "Sin dato")
  expect_identical(sin_dato$n_ch_total, 1L)
  expect_identical(sin_dato$n_ch_elegibles, 1L)
  expect_equal(sin_dato$n_matriculas_elegibles, 5)
  expect_identical(sin_dato$delta_marginal$accion, "no_aplica")
  expect_identical(sin_dato$delta_marginal$delta_ch, 0L)
})

test_that("categoría real con 0 CH alterna el set completo de la facultad", {
  sin_restriccion <- .cr_run(.cr_cero_ch_fixture(character(0)))
  taller_cero <- .cr_row(sin_restriccion, "facultad_a", "taller")
  expect_identical(taller_cero$n_ch_total, 0L)
  expect_identical(taller_cero$delta_marginal$accion, "restringir_a_categoria")
  expect_identical(taller_cero$delta_marginal$delta_ch, -1L)
  expect_equal(taller_cero$delta_marginal$delta_matriculas_elegibles, -7)

  solo_taller <- .cr_run(.cr_cero_ch_fixture("taller"))
  quitar_ultimo <- .cr_row(solo_taller, "facultad_a", "taller")
  expect_identical(quitar_ultimo$n_ch_total, 0L)
  expect_identical(quitar_ultimo$delta_marginal$accion, "quitar_restriccion")
  expect_identical(quitar_ultimo$delta_marginal$delta_ch, 1L)
  expect_equal(quitar_ultimo$delta_marginal$delta_matriculas_elegibles, 7)
})

test_that("buckets ausentes no colisionan con valores reales Sin dato", {
  out <- .cr_run(.cr_colision_sin_dato_fixture())
  pares <- vapply(out$filas, function(fila) {
    paste(fila$facultad_key, fila$categoria_key, sep = "::")
  }, character(1))
  expect_length(pares, 4L)
  expect_length(unique(pares), length(pares))
  expect_setequal(
    unique(vapply(out$filas, function(fila) fila$facultad_key, character(1))),
    c("__missing_faculty__", "sin_dato")
  )
  expect_setequal(
    unique(vapply(out$filas, function(fila) fila$categoria_key, character(1))),
    c("__missing_session_type__", "sin_dato")
  )

  buckets_ausentes <- Filter(function(fila) {
    identical(fila$categoria_key, "__missing_session_type__")
  }, out$filas)
  valores_reales <- Filter(function(fila) {
    identical(fila$categoria_key, "sin_dato")
  }, out$filas)
  expect_length(buckets_ausentes, 2L)
  expect_true(all(vapply(
    buckets_ausentes,
    function(fila) identical(fila$delta_marginal$accion, "no_aplica"),
    logical(1)
  )))
  expect_length(valores_reales, 2L)
  expect_false(any(vapply(
    valores_reales,
    function(fila) identical(fila$delta_marginal$accion, "no_aplica"),
    logical(1)
  )))
})

test_that("set efectivo vacío por excepción restringe; último toggle quita restricción", {
  out <- .cr_run(.cr_fixture())

  fac_b <- .cr_row(out, "facultad_b", "taller")
  expect_identical(fac_b$delta_marginal$accion, "restringir_a_categoria")
  expect_identical(fac_b$delta_marginal$delta_ch, -3L)
  expect_equal(fac_b$delta_marginal$delta_matriculas_elegibles, -18)

  fac_a <- .cr_row(out, "facultad_a", "taller")
  expect_identical(fac_a$delta_marginal$accion, "quitar_restriccion")
  # Quitar la última categoría deja el set vacío (= sin restricción): vuelven
  # A2 y A7; no se interpreta como "ningún tipo".
  expect_identical(fac_a$delta_marginal$delta_ch, 2L)
  expect_true(is.na(fac_a$delta_marginal$delta_matriculas_elegibles))
})

test_that("modo exclude alterna el set efectivo sin atribuir pérdidas ajenas", {
  out <- .cr_run(.cr_fixture(mode = "exclude", con_excepcion = FALSE))

  taller <- .cr_row(out, "facultad_a", "taller")
  expect_identical(taller$delta_marginal$accion, "quitar_restriccion")
  expect_identical(taller$delta_marginal$delta_ch, 2L)
  expect_true(is.na(taller$delta_marginal$delta_matriculas_elegibles))

  teorico <- .cr_row(out, "facultad_a", "teorico")
  expect_identical(teorico$delta_marginal$accion, "agregar_categoria")
  expect_identical(teorico$delta_marginal$delta_ch, -1L)
  expect_equal(teorico$delta_marginal$delta_matriculas_elegibles, -20)
})

test_that("reconstrucción divergente degrada el delta a NA", {
  out <- .cr_run(.cr_fixture(mismatch = TRUE))
  fila <- .cr_row(out, "facultad_a", "teorico")
  expect_true(is.na(fila$delta_marginal$delta_ch))
  expect_true(is.na(fila$delta_marginal$delta_matriculas_elegibles))
})

test_that("integración es aditiva y conserva intacto exploracion v1", {
  base <- data.frame(
    codigo_alumno = c("1", "2", "3"),
    curso_horario = c("CH-1", "CH-2", "CH-3"),
    facultad = c("FACULTAD A", "FACULTAD A", "FACULTAD B"),
    tipo_de_curso = c("TALLER", "TEORICO", "TALLER"),
    nivel = "3",
    sexo = c("F", "M", "F"),
    stringsAsFactors = FALSE
  )
  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    config = list(
      mapping = list(
        student_id = "codigo_alumno", classroom_id = "curso_horario",
        faculty = "facultad", session_type = "tipo_de_curso",
        level = "nivel", sex = "sexo"
      ),
      filters = list(
        require_adult = FALSE, require_undergraduate = FALSE,
        require_in_person = FALSE, accepted_conditions = list(),
        exclude_session_patterns = list(), min_eligible_per_class = 1L
      ),
      criterios_seleccion = list(byVariable = list(
        session_type = list(mode = "include", categories = list("taller"))
      ))
    )
  )

  expect_named(frame$exploracion, c("schema", "totales", "por_facultad"))
  expect_identical(frame$exploracion$schema, "calc_muestra_aulas_exploracion_v1")
  expect_identical(frame$criterios_radiografia$frame_hash, frame$frame_hash)
  expect_identical(frame$criterios_radiografia$filas_owner, "calc_muestra_aulas_frame_v1.aula_frame")
  expect_true(length(frame$criterios_radiografia$filas) > 0L)
  teorico <- .cr_row(frame$criterios_radiografia, "facultad_a", "teorico")
  expect_identical(teorico$delta_marginal$accion, "agregar_categoria")
  expect_identical(teorico$delta_marginal$delta_ch, 1L)
  expect_equal(teorico$delta_marginal$delta_matriculas_elegibles, 1)

  session_v2 <- .cr_entry(frame$criterios_radiografia, "session_type")
  expect_named(session_v2, c(
    "id", "card_id", "label", "scope", "family", "status",
    "effective_layer", "overlap", "faculty_dimension", "owner", "kind",
    "grain", "unit", "gate", "rows"
  ))
  expect_identical(session_v2$family, "classroom_flat")
  expect_false(session_v2$overlap)
  fila_v2 <- .cr_v2_row(session_v2, "facultad_a", "teorico")
  expect_named(fila_v2, c(
    "faculty_key", "faculty_label", "segment_key", "segment_label",
    "segment_kind", "actual", "contraste_total", "delta"
  ))
  expect_named(fila_v2$actual, c(
    "n_ch", "n_ch_con_dato", "n_estudiantes_unicos", "n_matriculas",
    "distribution"
  ))
  # F111 · Contrato v2: la tarjeta apila densidad, boxplot y cuantiles sobre un
  # solo eje, y las tres lecturas exigen datos que el cliente no puede derivar.
  # El orden importa: es el que serializa el payload y el que fija el oráculo.
  expect_named(fila_v2$actual$distribution, c(
    "media", "p10", "p25", "p50", "p75", "p90",
    "min", "max", "bigote_inf", "bigote_sup", "n_atipicos",
    # F114 · De que lado quedan los atipicos. Sin esto la tarjeta solo podia
    # decirlo en prosa, y una cifra en prosa junto a un grafico es metatexto.
    "n_atipicos_inf", "n_atipicos_sup",
    "hist_breaks", "hist_counts"
  ))
  expect_named(fila_v2$delta, c(
    "reference", "action", "reconstruccion_valida", "delta_ch",
    "delta_matriculas", "delta_estudiantes_unicos"
  ))
  expect_true(fila_v2$delta$reconstruccion_valida)
  expect_identical(fila_v2$delta$delta_ch, teorico$delta_marginal$delta_ch)
  expect_identical(fila_v2$delta$delta_matriculas, as.integer(teorico$delta_marginal$delta_matriculas_elegibles))
  expect_identical(fila_v2$delta$delta_estudiantes_unicos, 1L)
  expect_lte(fila_v2$actual$n_ch, fila_v2$contraste_total$n_ch)
  expect_lte(fila_v2$actual$n_matriculas, fila_v2$contraste_total$n_matriculas)
  expect_lte(fila_v2$actual$n_estudiantes_unicos, fila_v2$contraste_total$n_estudiantes_unicos)

  for (gate_id in c("minEligible", "c7", "c8_facultad", "c8")) {
    gate <- .cr_entry(frame$criterios_radiografia, gate_id)
    expect_identical(gate$status, "disponible", info = gate_id)
    expect_true(length(gate$rows) > 0L, info = gate_id)
    # G38 · Contrato v2 de la señal. La lista sigue siendo exacta a propósito:
    # es la que el cliente consume, y un campo que aparece o desaparece sin que
    # nadie lo declare es la forma en que estos payloads se desalinean.
    expect_named(gate$rows[[1]]$signal_distribution, c(
      "unit", "n_total", "n_con_dato", "media", "p10", "p25", "p50", "p75", "p90",
      "min", "max", "bigote_inf", "bigote_sup",
      "n_atipicos", "n_atipicos_inf", "n_atipicos_sup",
      "hist_breaks", "hist_counts",
      "escala", "umbral_aplicado", "n_fuera", "n_fuera_por_corte"
    ), info = gate_id)
    expect_identical(gate$rows[[1]]$signal_distribution$n_total, 2L, info = gate_id)
    expect_identical(gate$rows[[1]]$signal_distribution$n_con_dato, 2L, info = gate_id)
  }

  # Sin output efectivo del evaluador (path legacy), el sibling es NULL: no
  # se proyectan las columnas modales del aula_frame como si fueran el grano.
  expect_null(calc_muestra_aulas_criterios_radiografia(
    aula_frame = frame$aula_frame,
    criterios = list(seleccion_aula = NULL),
    criterios_seleccion = NULL,
    particularidades = frame$particularidades,
    frame_hash = frame$frame_hash
  ))
})

test_that("integración I11-H10 usa tipo y facultad del catálogo, no los modales", {
  base <- data.frame(
    estudiante = c("E1", "E2"),
    curso_horario = "CH-OWNER-1",
    facultad_modal = "FACULTAD MODAL A",
    tipo_modal = "TIPO MODAL A",
    nivel = "3",
    sexo = c("F", "M"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  catalogo <- data.frame(
    curso_horario = "CH-OWNER-1",
    `Facultad del curso` = "FACULTAD CATALOGO B",
    Tipo = "TIPO CATALOGO B",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  frame <- calc_muestra_aulas_construir(
    base_madre = base,
    catalogo_curso_horario = catalogo,
    config = list(
      mapping = list(
        student_id = "estudiante", classroom_id = "curso_horario",
        faculty = "facultad_modal", session_type = "tipo_modal",
        level = "nivel", sex = "sexo"
      ),
      filters = list(
        require_adult = FALSE, require_undergraduate = FALSE,
        require_in_person = FALSE, accepted_conditions = list(),
        exclude_session_patterns = list(), min_eligible_per_class = 1L
      ),
      criterios_seleccion = list(byVariable = list(
        session_type = list(mode = "include", categories = list("tipo_catalogo_b"))
      ))
    )
  )

  # Premisa causal: las columnas modales del frame discrepan del catálogo.
  expect_identical(unique(frame$aula_frame$faculty), "FACULTAD MODAL A")
  expect_identical(unique(frame$aula_frame$session_type), "TIPO MODAL A")

  filas <- frame$criterios_radiografia$filas
  expect_length(filas, 1L)
  expect_identical(filas[[1]]$facultad_key, "facultad_catalogo_b")
  expect_identical(filas[[1]]$facultad_label, "FACULTAD CATALOGO B")
  expect_identical(filas[[1]]$categoria_key, "tipo_catalogo_b")
  expect_identical(filas[[1]]$categoria_label, "TIPO CATALOGO B")
  expect_identical(filas[[1]]$n_ch_total, 1L)
  expect_identical(filas[[1]]$n_ch_elegibles, 1L)
  expect_false(any(grepl("modal_a", vapply(
    filas,
    function(fila) paste(fila$facultad_key, fila$categoria_key),
    character(1)
  ), fixed = TRUE)))
})

test_that("índice alumno×CH se construye una vez por radiografía", {
  donde <- environment(calc_muestra_aulas_criterios_radiografia)
  nombre <- ".cm_criterio_radiografia_indice_alumno"
  expect_true(exists(nombre, envir = donde, mode = "function", inherits = FALSE))

  opcion <- "prosecnur.test.radiografia_indice_calls"
  anterior <- getOption(opcion)
  options(stats::setNames(list(0L), opcion))
  on.exit(options(stats::setNames(list(anterior), opcion)), add = TRUE)
  trace(
    nombre,
    tracer = quote(options(
      prosecnur.test.radiografia_indice_calls =
        getOption("prosecnur.test.radiografia_indice_calls", 0L) + 1L
    )),
    print = FALSE,
    where = donde
  )
  on.exit(untrace(nombre, where = donde), add = TRUE)

  simple <- calc_muestra_aulas_construir(
    base_madre = data.frame(
      estudiante = c("E1", "E2"),
      curso_horario = c("CH1", "CH2"),
      facultad = "FAC A",
      formacion = c("PREGRADO", "MAESTRIA"),
      nivel = c("2", "3"),
      tipo = "TALLER",
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    config = list(
      mapping = list(
        student_id = "estudiante", classroom_id = "curso_horario",
        faculty = "facultad", formation = "formacion",
        level = "nivel", session_type = "tipo"
      ),
      filters = list(
        require_adult = FALSE, require_undergraduate = FALSE,
        require_in_person = FALSE, accepted_conditions = list(),
        exclude_session_patterns = list(), min_eligible_per_class = 1L
      ),
      criterios_seleccion = list(minEligible = list(threshold = 1))
    )
  )
  amplio <- .cr_full_frame()

  expect_identical(getOption(opcion), 2L)
  n_simple <- sum(vapply(
    simple$criterios_radiografia$criterios,
    function(x) length(x$rows), integer(1)
  ))
  n_amplio <- sum(vapply(
    amplio$criterios_radiografia$criterios,
    function(x) length(x$rows), integer(1)
  ))
  expect_gt(n_amplio, n_simple)

  # Oráculo congelado antes de la optimización: detecta cualquier cambio de
  # orden, tipo, NA, snapshot, estado, delta o matriz marginal en el payload
  # completo del fixture.
  payload_json <- jsonlite::toJSON(
    amplio$criterios_radiografia,
    auto_unbox = TRUE, null = "null", na = "null", digits = NA
  )
  # Rebendecido dos veces, y las dos razones quedan escritas porque un oráculo
  # que se actualiza sin justificar deja de ser un oráculo:
  #
  #   1. F71 renombró `segment_label` de «Regla efectiva» a «Cursos-horario que
  #      cumplen». **Ese commit dejó este test en rojo y se subió así**: se
  #      cambió el motor corriendo sólo las pruebas del frontend. El oráculo
  #      hizo justo su trabajo —avisar— y nadie lo estaba mirando.
  #   2. F111 añadió los siete campos del contrato v2 de la distribución.
  #
  # El segundo cambio se probó CONFINADO antes de tocar el hash: podando esos
  # siete campos del payload reaparece exactamente el hash previo a F111
  # (fb817066ce0c805ff6f8196a7342bd7c8361af1812a3b555a66105b47b4304f4), así que
  # nada más se movió.
  expect_identical(
    digest::digest(payload_json, algo = "sha256", serialize = FALSE),
    #   3. F114 anadio `n_atipicos_inf` y `n_atipicos_sup`. **Ese commit dejo
    #      esta suite en rojo y se subio asi — otra vez**: cambie el motor R y
    #      corri solo las pruebas del frontend, el mismo fallo de F71 que ya
    #      estaba documentado. El oraculo volvio a hacer su trabajo y volvio a
    #      no haber nadie mirandolo.
    #   4. G38 subio `signal_distribution` al contrato v2 y publico la senal de
    #      composicion en porcentaje (0-100) en vez de razon (0-1), con su
    #      `escala`, su `umbral_aplicado` y su `n_fuera`.
    #
    #      Este si se probo CONFINADO antes de tocar el hash, y con dos podas:
    #      quitando los doce campos nuevos **y** devolviendo los momentos de la
    #      senal de proporcion a la escala 0-1, reaparece exactamente el hash de
    #      F114 (eec9d3f9...). Nada mas se movio.
    #
    #      La suite del area se corrio antes de commitear —la regla que salio de
    #      los puntos 1 y 3— y atrapo este oraculo y la lista de campos de
    #      arriba. Esta vez el aviso si tuvo a alguien mirandolo.
    #   5. G39 alineo los cortes del histograma de las proporciones con el paso
    #      del control (0-100 de 5 en 5) y anadio `n_fuera_por_corte`.
    #
    #      **Y este si volvio a pillarme**: el commit del motor decia que la
    #      suite del area estaba en verde y yo solo habia corrido el fichero de
    #      la senal. Tercera vez con la misma causa (F71, F114): un cambio de
    #      pocas lineas en R no se siente como tocar logica. La regla ya estaba
    #      escrita; lo que fallo fue cumplirla.
    #
    #      La prueba de confinamiento tambien mejoro. Podar campos y comparar
    #      hashes no servia aqui —los cortes no son un campo nuevo, son uno que
    #      CAMBIO—, asi que se reconstruyo el comportamiento previo en la misma
    #      sesion y se enumeraron las rutas distintas del payload: 34 rutas, y
    #      los unicos campos implicados `hist_breaks`, `hist_counts` y
    #      `n_fuera_por_corte`. El reconstruido reprodujo exactamente el hash de
    #      G38. Enumerar rutas dice QUE cambio; podar solo dice si algo cambio.
    #   6. ec1d5446 añadio `facultades_excluidas` declaradas al contrato del
    #      config, y eso mueve el `frame_hash` que la radiografia ECOA en su
    #      raiz y en `matriz_embudo`. **Cuarta vez del mismo fallo (F71, F114,
    #      G39): el commit del motor no corrio esta suite** y el rojo se
    #      descubrio veintinueve commits despues, al correrla por otro defecto.
    #      El confinamiento se probo por bisect en worktree (el culpable exacto)
    #      mas diff de rutas del payload completo entre el bless y el culpable:
    #      **cambian exactamente 2 rutas de todas — los dos ecos de
    #      `frame_hash` — y cero filas o campos de datos**; del culpable a HEAD
    #      el payload es identico byte a byte.
    "0a7a5b0162583d203982d08eebc0b7520333ff0039dc62f28cfbf98b2f4b6018"
  )
})

test_that("índice alumno×CH conserva ANY-row y no duplica estudiantes", {
  aula_frame <- data.frame(
    classroom_id = c("CH1", "CH2"),
    eligible_n = c(1, 1),
    included = TRUE,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  filas <- list(
    student_id = c("E1", "E1", "E2", "E2"),
    classroom_id = c("CH1", "CH1", "CH2", "CH2")
  )
  indice <- .cm_criterio_radiografia_indice_alumno(aula_frame, filas)
  expect_true(indice$valido)

  uno_por_cualquier_fila <- .cm_criterio_radiografia_membresias(
    aula_frame, filas, c(FALSE, TRUE, FALSE, FALSE), indice
  )
  expect_identical(uno_por_cualquier_fila$eligible_n, c(1, 0))
  expect_identical(uno_por_cualquier_fila$row_ok, c(FALSE, TRUE, FALSE, FALSE))
  expect_identical(
    .cm_criterio_radiografia_snapshot(
      1:2, uno_por_cualquier_fila$eligible_n, uno_por_cualquier_fila$ids
    )$n_estudiantes_unicos,
    1L
  )

  duplicadas_activas <- .cm_criterio_radiografia_membresias(
    aula_frame, filas, rep(TRUE, 4L), indice
  )
  expect_identical(duplicadas_activas$eligible_n, c(1, 1))
  expect_identical(
    .cm_criterio_radiografia_snapshot(
      1:2, duplicadas_activas$eligible_n, duplicadas_activas$ids
    )$n_estudiantes_unicos,
    2L
  )
})

test_that("flat alumno no reevalúa N filas dentro de cada segmento", {
  cuerpo <- paste(deparse(body(
    .cm_criterio_radiografia_rows_flat_alumno
  )), collapse = "\n")
  expect_false(grepl(
    ".cm_criterios_eval_flat_vec", cuerpo, fixed = TRUE
  ))

  keys <- c("pregrado", "", "maestria", "doctorado")
  for (mode in c("include", "exclude")) {
    esperado <- .cm_criterios_eval_flat_vec(
      keys,
      list(
        mode = mode, categories = c("pregrado", "maestria"),
        exceptions = list()
      ),
      rep("fac_a", length(keys))
    )
    observado <- .cm_criterio_radiografia_eval_flat_faceta(
      keys, mode, c("pregrado", "maestria")
    )
    expect_identical(observado, esperado, info = mode)
  }
  expect_identical(
    .cm_criterio_radiografia_eval_flat_faceta(
      keys, "include", character(0)
    ),
    rep(TRUE, length(keys))
  )
})

# ---------------------------------------------------------------------------
# F111 · Contrato v2 de la distribución: densidad, boxplot estándar y cuantiles
# sobre un solo eje.
#
# Las tres lecturas que la tarjeta apila exigen datos que el cliente NO puede
# derivar. Entre P10 y P90 hay infinitas formas: interpolar una densidad es
# inventarla. Y los bigotes de un boxplot estándar son el dato más extremo
# dentro de 1,5 × RIC, no P10/P90.
# ---------------------------------------------------------------------------

test_that("el histograma conserva todas las observaciones", {
  v <- c(1, 2, 2, 3, 5, 8, 8, 8, 13, 21)
  b <- .cm_criterio_radiografia_breaks(v)
  d <- .cm_criterio_radiografia_distribucion(v, b)
  # Un bin de más o de menos y la densidad dibuja una forma que no ocurrió.
  expect_identical(sum(d$hist_counts), length(v))
  expect_identical(length(d$hist_counts), length(d$hist_breaks) - 1L)
  # `include.lowest`: sin él el mínimo se cae del primer intervalo.
  expect_gte(d$hist_counts[[1]], 1L)
})

test_that("los cortes cubren el rango real y no lo recortan", {
  v <- c(3, 50)
  b <- .cm_criterio_radiografia_breaks(v)
  expect_identical(b[[1]], 3)
  expect_identical(b[[length(b)]], 50)
})

test_that("los bigotes son de Tukey, no los extremos", {
  # 100 es atípico: queda fuera de 1,5 x RIC y el bigote se queda en el dato
  # más extremo que sí entra. Un bigote que llega hasta 100 dibujaria un rango
  # continuo donde hay un salto.
  v <- c(10, 11, 12, 13, 14, 15, 16, 100)
  d <- .cm_criterio_radiografia_distribucion(v)
  expect_identical(d$max, 100)
  expect_lt(d$bigote_sup, 100)
  expect_identical(d$n_atipicos, 1L)
})

test_that("sin atipicos el bigote coincide con el extremo", {
  v <- c(10, 11, 12, 13, 14)
  d <- .cm_criterio_radiografia_distribucion(v)
  expect_identical(d$bigote_inf, 10)
  expect_identical(d$bigote_sup, 14)
  expect_identical(d$n_atipicos, 0L)
})

test_that("sin cortes publica los cuantiles pero no la densidad", {
  # El histograma es opcional: quien no pasa cortes comunes no obtiene una
  # densidad por segmento, que seria incomparable con la de sus hermanas.
  d <- .cm_criterio_radiografia_distribucion(c(1, 2, 3))
  expect_length(d$hist_counts, 0L)
  expect_false(is.na(d$p50))
})

test_that("una distribucion vacia tiene la MISMA forma que una con dato", {
  # F111 · El snapshot sin cobertura completa ya no machaca la lista con NA:
  # reconstruye el vacio con este mismo constructor. Si las formas divergen, el
  # cliente tiene que ramificar por tipo y ahi es donde entran los bugs.
  vacio <- .cm_criterio_radiografia_distribucion(numeric(0))
  lleno <- .cm_criterio_radiografia_distribucion(c(1, 2, 3), c(1, 2, 3))
  expect_setequal(names(vacio), names(lleno))
  expect_true(is.na(vacio$bigote_sup))
  expect_length(vacio$hist_breaks, 0L)
})

test_that("los segmentos de una facultad comparten cortes", {
  # Dos categorias con rangos distintos deben caer sobre la MISMA rejilla: es
  # lo unico que hace comparables sus densidades (ADR 0057, regla 3).
  universo <- c(5, 10, 15, 20, 40, 60)
  b <- .cm_criterio_radiografia_breaks(universo)
  a <- .cm_criterio_radiografia_distribucion(c(5, 10, 15), b)
  z <- .cm_criterio_radiografia_distribucion(c(40, 60), b)
  expect_identical(a$hist_breaks, z$hist_breaks)
  expect_identical(length(a$hist_counts), length(z$hist_counts))
})

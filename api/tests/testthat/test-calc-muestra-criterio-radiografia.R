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

test_that("radiografía publica el contrato sibling con grano y owner explícitos", {
  out <- .cr_run(.cr_fixture())

  expect_named(out, c("schema", "owner", "frame_hash", "momento", "grano", "unidad", "filas"))
  expect_identical(out$schema, "calc_muestra_aulas_criterios_radiografia_v1")
  expect_identical(out$owner, "calc_muestra_aulas_frame_v1.aula_frame")
  expect_identical(out$frame_hash, "hash-fixture")
  expect_identical(out$momento, "marco_ejecutado")
  expect_identical(out$grano, "session_type_x_facultad_efectiva")
  expect_identical(out$unidad, "curso_horario_unico")
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
  expect_identical(frame$criterios_radiografia$owner, "calc_muestra_aulas_frame_v1.aula_frame")
  expect_true(length(frame$criterios_radiografia$filas) > 0L)
  teorico <- .cr_row(frame$criterios_radiografia, "facultad_a", "teorico")
  expect_identical(teorico$delta_marginal$accion, "agregar_categoria")
  expect_identical(teorico$delta_marginal$delta_ch, 1L)
  expect_equal(teorico$delta_marginal$delta_matriculas_elegibles, 1)

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

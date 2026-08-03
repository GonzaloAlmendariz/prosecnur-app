.i18b_pulso_reference <- function() {
  list(
    schema = "calc_muestra_referencia_asistencia_v1",
    owner = "estudio_historico_externo",
    momento = "post_hoc_estudio_previo",
    transferible = "modelo_por_celda",
    modelo = "marginales_independientes",
    combinable = FALSE,
    unidad = "curso_horario_aplicado",
    denominador = "matriculados_totales",
    estudio = list(id = "hist", label = "Historico", periodo = "2025-II", fuente = "fixture"),
    cobertura = list(agendados = 12L, aplicados = 12L, observados = 12L),
    identidad = list(regla = "A = E + no_respondieron", verificada = TRUE, verificables = 12L, inconsistentes = 0L),
    umbrales = list(insuficiente_max = 11L, delgada_min = 12L, solida_min = 30L, bootstrap_n = 50L, nivel_ic = 0.95, quantile_type = 7L),
    cadena = list(),
    global = list(k = 12L, matriculados = 240, asistentes = 192, enviadas = 180, validas = 170, no_respondieron = 12, tasa = 0.8, media_ch = 0.8, sd_ch = 0, ic_low = 0.8, ic_high = 0.8, metodo_ic = "bootstrap_percentil"),
    dimensiones = list(),
    advertencias = list(),
    celdas_criterios = list(
      schema = "calc_muestra_referencia_asistencia_celdas_v1",
      owner = "estudio_historico_externo.celdas_criterios",
      momento = "post_hoc_estudio_previo",
      combinable = FALSE,
      unit = "curso_horario_aplicado",
      denominator = "matriculados_totales",
      faculty_dimension = "facultad_historica",
      reference_hash = "reference-hash",
      estudio = list(id = "hist", label = "Historico", periodo = "2025-II", fuente = "fixture"),
      rows = list(list(
        faculty_key = "fac_a", faculty_label = "FAC A",
        dimension_key = "tipo_sesion", dimension_label = "Tipo de sesion",
        cell_key = "taller", cell_label = "TALLER", order = 1L,
        k = 12L, matriculados = 240, asistentes = 192, tasa = 0.8,
        media_ch = 0.8, sd_ch = 0, ic_low = 0.8, ic_high = 0.8,
        metodo_ic = "bootstrap_percentil", suficiencia = "delgada",
        tasa_publicada = 0.8, k_publicada = 12L, fuente_publicada = "celda"
      ))
    )
  )
}

test_that("round-trip persistente conserva agregados y strippea contexto/raw", {
  anchor <- list(
    schema = "calc_muestra_criterios_anclas_historicas_v1",
    owner = "calc_muestra_aulas_frame_v1.criterios_anclas_historicas",
    source_frame_hash = "frame-hash", reference_hash = "reference-hash",
    reference_schema = "calc_muestra_referencia_asistencia_celdas_v1",
    periodo = "2025-II", grain = "criterio_x_facultad_efectiva",
    faculty_dimensions = list("curso_horario_efectiva"),
    reference_faculty_dimension = "facultad_historica",
    rows = list(list(
      criterion_id = "session_type", card_id = "session_type",
      faculty_key = "fac_a", faculty_label = "FAC A",
      faculty_dimension = "curso_horario_efectiva",
      reference_faculty_dimension = "facultad_historica",
      requested_dimension = "tipo_sesion", requested_key = "taller",
      requested_label = "TALLER", matched_dimension = "tipo_sesion",
      matched_key = "taller", matched_label = "TALLER",
      match_level = "exacta", k = 12L, tasa = 0.8, ic_low = 0.7,
      ic_high = 0.9, metodo_ic = "bootstrap_percentil",
      suficiencia = "delgada", periodo = "2025-II",
      warning = "Coincidencia exacta.", student_id = "PII-ANCHOR"
    ))
  )
  frame <- list(
    schema = "calc_muestra_aulas_frame_v1",
    frame_hash = "frame-hash",
    population = data.frame(student_id = "RAW-STUDENT", stringsAsFactors = FALSE),
    population_pool = data.frame(student_id = "RAW-POOL", stringsAsFactors = FALSE),
    exclusions = data.frame(student_id = "RAW-EXCLUDED", stringsAsFactors = FALSE),
    aula_frame = data.frame(
      classroom_id = "RAW-CH", unique_student_ids = "RAW-STUDENT",
      included = TRUE, stringsAsFactors = FALSE
    ),
    criterios_totales = list(
      schema = "calc_muestra_aulas_criterios_totales_v1",
      owner = "calc_muestra_aulas_frame_v1.criterios_totales",
      source_schema = "calc_muestra_aulas_criterios_radiografia_v2",
      source_frame_hash = "frame-hash", momento = "marco_ejecutado",
      grain = "criterio_x_segmento", unit = "curso_horario_unico",
      rows = list(list(
        criterion_id = "session_type", card_id = "session_type",
        label = "Tipo de sesion", segment_key = "taller",
        segment_label = "TALLER", segment_kind = "categoria",
        actual = list(
          n_ch = 1L, n_ch_con_dato = 1L, n_estudiantes_unicos = 10L,
          n_matriculas = 12L,
          distribution = list(media = 12, p10 = 12, p25 = 12, p50 = 12, p75 = 12, p90 = 12),
          student_id = "PII-SNAPSHOT"
        ),
        contraste_total = list(
          n_ch = 1L, n_ch_con_dato = 1L, n_estudiantes_unicos = 10L,
          n_matriculas = 12L,
          distribution = list(media = 12, p10 = 12, p25 = 12, p50 = 12, p75 = 12, p90 = 12)
        ),
        student_id = "PII-TOTAL"
      ))
    ),
    criterios_cascada = list(
      schema = "calc_muestra_aulas_criterios_cascada_v1",
      owner = "calc_muestra_aulas_frame_v1.criterios_cascada",
      source_frame_hash = "frame-hash", criteria_hash = "criteria-hash",
      momento = "marco_ejecutado", grain = "paso_x_facultad_efectiva",
      unit = "curso_horario_unico", order_source = "motor_r",
      steps = list(list(
        order = 1L, criterion_id = "manual_excluded",
        card_id = "manual_excluded", label = "Exclusiones manuales",
        scope = "aula", gate = FALSE, applies = FALSE, status = "inactivo",
        faculties = list(list(
          faculty_key = "fac_a", label = "FAC A", before_ch = 1L,
          after_ch = 1L, excluded_ch = 0L, student_id = "PII-FACULTY"
        )),
        total = list(before_ch = 1L, after_ch = 1L, excluded_ch = 0L),
        student_id = "PII-CASCADE"
      ))
    ),
    criterios_anclas_historicas = anchor
  )
  attr(frame, "calc_muestra_aulas_criterios_contexto") <- list(
    student_id = "PII-ATTR", classroom_id = "PII-ATTR-CH"
  )
  state <- list(
    calc_muestra_referencia_asistencia = .i18b_pulso_reference(),
    calc_muestra_aulas_frame = frame,
    calc_muestra_aulas_criterios_contexto = list(
      schema = "calc_muestra_aulas_criterios_contexto_v1",
      student_id = "CACHE-SECRET", classroom_id = "CACHE-CH"
    )
  )

  stripped <- .pulso_strip_caches(state)
  expect_null(stripped$calc_muestra_aulas_criterios_contexto)
  expect_null(stripped$calc_muestra_aulas_frame$population)
  expect_null(stripped$calc_muestra_aulas_frame$population_pool)
  expect_null(stripped$calc_muestra_aulas_frame$exclusions)
  expect_null(attr(
    stripped$calc_muestra_aulas_frame,
    "calc_muestra_aulas_criterios_contexto",
    exact = TRUE
  ))
  expect_false("unique_student_ids" %in% names(stripped$calc_muestra_aulas_frame$aula_frame))
  expect_identical(
    stripped$calc_muestra_referencia_asistencia$celdas_criterios$schema,
    "calc_muestra_referencia_asistencia_celdas_v1"
  )
  expect_identical(
    stripped$calc_muestra_referencia_asistencia$celdas_criterios$reference_hash,
    "reference-hash"
  )
  expect_identical(
    stripped$calc_muestra_aulas_frame$criterios_anclas_historicas$reference_hash,
    "reference-hash"
  )
  expect_identical(
    stripped$calc_muestra_aulas_frame$criterios_totales$rows[[1L]]$actual$n_ch,
    1L
  )
  expect_identical(
    stripped$calc_muestra_aulas_frame$criterios_cascada$steps[[1L]]$total$after_ch,
    1L
  )

  path <- tempfile(fileext = ".rds")
  on.exit(unlink(path), add = TRUE)
  saveRDS(stripped, path)
  back <- readRDS(path)
  payload <- jsonlite::toJSON(back, auto_unbox = TRUE, null = "null", na = "null")
  expect_false(grepl(
    "RAW-STUDENT|RAW-POOL|RAW-EXCLUDED|CACHE-|PII-",
    payload
  ))
  expect_match(payload, "calc_muestra_referencia_asistencia_celdas_v1", fixed = TRUE)
  expect_match(payload, "calc_muestra_criterios_anclas_historicas_v1", fixed = TRUE)
})

test_that("schema de sesion declara el contexto preview como cache_stripped", {
  schema <- session_schema()
  row <- schema[
    schema$clave == "calc_muestra_aulas_criterios_contexto" &
      schema$tipo == "literal",
    , drop = FALSE
  ]
  expect_equal(nrow(row), 1L)
  expect_identical(row$categoria, "cache_stripped")
  expect_identical(
    .session_schema_categorias("calc_muestra_aulas_criterios_contexto", schema),
    "cache_stripped"
  )
})

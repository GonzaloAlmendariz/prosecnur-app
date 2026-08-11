.dist_cross <- function(rows) {
  do.call(rbind, lapply(rows, function(row) {
    data.frame(
      primary_role = "faculty",
      primary_label = "Facultad",
      primary_raw = row[[1]],
      secondary_role = "sex",
      secondary_label = "Sexo",
      secondary_raw = row[[2]],
      source_role = "base_madre",
      count = row[[3]],
      unit_label = "estudiantes",
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  }))
}

.dist_frame <- function(hash = "frame-dist-1") {
  aula_frame <- data.frame(
    classroom_id = c("A-1", "A-2", "B-1", "B-2"),
    faculty = c("FAC A", "FAC A", "FAC B", "FAC B"),
    included = TRUE,
    eligible_n = c(20, 30, 16, 24),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  list(
    schema = "calc_muestra_aulas_frame_v1",
    frame_hash = hash,
    aula_frame = aula_frame,
    alumnos_por_ch = calc_muestra_alumnos_por_ch(aula_frame, hash),
    population_cross_profiles = .dist_cross(list(
      list("FAC A", "Mujeres", 60L),
      list("FAC A", "Hombres", 40L),
      list("FAC B", "Mujeres", 45L),
      list("FAC B", "Hombres", 35L)
    )),
    audit = data.frame(
      metric = "population_n",
      value = "180",
      stringsAsFactors = FALSE
    )
  )
}

.dist_decision <- function(hash = "frame-dist-1") {
  list(
    schema = "calc_muestra_alumnos_por_ch_decision_v1",
    frame_hash = hash,
    denominador = "elegible",
    estadistico_default = "media",
    por_facultad = list(),
    confirmado_at = "2026-08-02T12:00:00Z"
  )
}

.dist_component <- function(actor_id, technique) {
  list(
    id = paste0("cmp-", actor_id),
    actor = if (identical(actor_id, "estudiantes_universidad")) {
      "Estudiantes universidad"
    } else {
      "Estudiantes por facultad"
    },
    actor_id = actor_id,
    actor_categoria = "otros",
    canal_recojo = "aula_qr",
    tecnica = technique,
    marco = list(
      estado = "validado",
      estratos = list(
        list(
          label = "FAC A", N = 100L, N_a = 60L, N_b = 40L,
          sub_a_label = "Mujeres", sub_b_label = "Hombres",
          e_facultad = 0.10, p_facultad = 0.30,
          confianza_facultad = 0.90, promedio_conglomerado = 999,
          aulas_base_fijas = 999L, tau = 1
        ),
        list(
          label = "FAC B", N = 80L, N_a = 45L, N_b = 35L,
          sub_a_label = "Mujeres", sub_b_label = "Hombres",
          e_facultad = 0.20, p_facultad = 0.50,
          confianza_facultad = 0.99, promedio_conglomerado = 999,
          aulas_base_fijas = 999L, tau = 1
        )
      )
    ),
    parametros = list(
      p = 0.30, z = 1.96, e = 0.10, deff = 1.5,
      tau = 1, promedio_conglomerado = 25, oversample_pct = 0
    ),
    meta = list(valor = if (identical(actor_id, "estudiantes_universidad")) 50L else 0L)
  )
}

.dist_study <- function(hash = "frame-dist-1") {
  list(
    macro_familia = "encuesta_estudiantes",
    workspace = list(
      frame_mode = "opinion_universitaria",
      aulas_config = list(alumnos_por_ch_decision = .dist_decision(hash))
    ),
    componentes = list(
      .dist_component(
        "estudiantes_universidad",
        "prob_conglomerado_multietapico"
      ),
      .dist_component(
        "estudiantes_facultad",
        "prob_estratificado_independiente"
      )
    )
  )
}

.dist_by_scenario <- function(study) {
  stats::setNames(
    lapply(study$componentes, function(component) {
      component$resultado$distribucion_universitaria
    }),
    c("p1_universidad", "p2_facultades")
  )
}

.dist_calculated <- function(study = .dist_study(), frame = .dist_frame()) {
  calc_muestra_alumnos_por_ch_calcular_estudio(study, frame)
}

.dist_reason_codes <- function(bundle) {
  vapply(bundle$reasons, `[[`, character(1), "code")
}

.dist_axis <- function(bundle, parameter) {
  hit <- Filter(
    function(axis) identical(axis$parameter, parameter),
    bundle$sensitivity$axes
  )
  expect_length(hit, 1L)
  hit[[1L]]
}

test_that("round con residuo controlado conserva la celda canónica 87/39", {
  expect_identical(
    distribuir_proporcional_pesos(
      126L,
      c(744, 336),
      redondeo = "round_residuo_controlado"
    ),
    c(87L, 39L)
  )
})

test_that("P1 y P2 publican el contrato reconciliado exacto", {
  frame <- .dist_frame()
  calculated <- calc_muestra_alumnos_por_ch_calcular_estudio(
    .dist_study(),
    frame
  )
  bundles <- .dist_by_scenario(calculated)

  expect_named(bundles$p1_universidad, c(
    "schema", "owner", "component_id", "actor_id", "scenario",
    "technique", "source_frame_hash", "population_hash", "design_hash",
    "computed_at", "grain", "population_unit", "sample_unit",
    "sample_stage", "status", "reasons", "totals", "faculties",
    "sensitivity", "reconciliation"
  ))
  expect_identical(bundles$p1_universidad$scenario, "p1_universidad")
  expect_identical(bundles$p2_facultades$scenario, "p2_facultades")
  expect_true(all(vapply(bundles, function(bundle) {
    identical(bundle$schema, "calc_muestra_distribucion_universitaria_v1") &&
      identical(bundle$owner, "engine_r") &&
      identical(bundle$status, "ready") &&
      identical(bundle$source_frame_hash, frame$frame_hash) &&
      isTRUE(bundle$reconciliation$ok)
  }, logical(1))))

  for (bundle in bundles) {
    expect_named(bundle$totals, c(
      "population_frame_n", "population_design_n", "sample_n",
      "faculty_n", "sex_cell_n"
    ))
    expect_named(bundle$reconciliation, c(
      "ok", "population_frame_sum", "population_design_sum", "sample_sum",
      "cell_population_frame_sum", "cell_population_design_sum",
      "cell_sample_sum", "frame_design_delta", "reasons"
    ))
    expect_identical(bundle$totals$population_frame_n, 180L)
    expect_identical(
      sum(vapply(bundle$faculties, `[[`, integer(1), "population_frame_n")),
      bundle$totals$population_frame_n
    )
    expect_identical(
      sum(vapply(bundle$faculties, `[[`, integer(1), "population_design_n")),
      bundle$totals$population_design_n
    )
    expect_identical(
      sum(vapply(bundle$faculties, `[[`, integer(1), "sample_n")),
      bundle$totals$sample_n
    )
    for (faculty in bundle$faculties) {
      expect_named(faculty, c(
        "faculty_key", "faculty_label", "population_frame_n",
        "population_design_n", "sample_n", "precision", "cells"
      ))
      expect_named(faculty$precision, c(
        "scope", "target_e", "achieved_e", "confidence", "p", "deff",
        "band_key", "band_label", "meets_target"
      ))
      expect_identical(
        sum(vapply(faculty$cells, `[[`, integer(1), "population_frame_n")),
        faculty$population_frame_n
      )
      expect_identical(
        sum(vapply(faculty$cells, `[[`, integer(1), "population_design_n")),
        faculty$population_design_n
      )
      expect_identical(
        sum(vapply(faculty$cells, `[[`, integer(1), "sample_n")),
        faculty$sample_n
      )
      for (cell in faculty$cells) {
        expect_named(cell, c(
          "sex_key", "sex_label", "population_frame_n",
          "population_design_n", "sample_n", "allocation_raw",
          "rounding_delta"
        ))
      }
    }
  }

  expect_true(all(vapply(
    bundles$p1_universidad$faculties,
    function(faculty) identical(faculty$precision$scope, "global_diagnostic"),
    logical(1)
  )))
  p1_result <- calculated$componentes[[1L]]$resultado
  p1_achieved_by_faculty <- stats::setNames(
    vapply(
      p1_result$distribucion_estratos,
      `[[`,
      numeric(1),
      "precision_e"
    ),
    vapply(
      p1_result$distribucion_estratos,
      function(row) .cm_dist_faculty_key(row$estrato),
      character(1)
    )
  )
  expect_gt(length(unique(round(p1_achieved_by_faculty, 10))), 1L)
  for (faculty in bundles$p1_universidad$faculties) {
    expect_equal(
      faculty$precision$achieved_e,
      p1_achieved_by_faculty[[faculty$faculty_key]]
    )
    expect_false(isTRUE(all.equal(
      faculty$precision$achieved_e,
      p1_result$precision_alcanzada
    )))
  }
  expect_true(all(vapply(
    bundles$p2_facultades$faculties,
    function(faculty) identical(faculty$precision$scope, "faculty_formal"),
    logical(1)
  )))
})

test_that("facultad extra y artefacto antiguo se rechazan sin join parcial", {
  frame <- .dist_frame()
  frame$population_cross_profiles <- rbind(
    frame$population_cross_profiles,
    .dist_cross(list(
      list("CONSORCIO DE UNIVERSIDADES", "Mujeres", 26L),
      list("CONSORCIO DE UNIVERSIDADES", "Hombres", 14L)
    ))
  )
  frame$audit$value <- "220"
  bundles <- .dist_by_scenario(.dist_calculated(frame = frame))

  for (bundle in bundles) {
    expect_identical(bundle$status, "incompatible")
    expect_false(bundle$reconciliation$ok)
    expect_contains(.dist_reason_codes(bundle), "faculty_set_mismatch")
    consorcio <- Filter(
      function(faculty) identical(
        faculty$faculty_key,
        "consorcio_de_universidades"
      ),
      bundle$faculties
    )
    expect_length(consorcio, 1L)
    expect_identical(consorcio[[1L]]$population_frame_n, 40L)
    expect_true(is.na(consorcio[[1L]]$population_design_n))
    expect_true(is.na(consorcio[[1L]]$sample_n))
  }
})

test_that("tercer sexo y sexo vacío se preservan pero invalidan todo el bundle", {
  for (case in list(
    list(raw = "Otro", key = "otro", label = "Otro"),
    list(raw = "", key = "__blank__", label = "Sin dato")
  )) {
    frame <- .dist_frame()
    frame$population_cross_profiles <- rbind(
      frame$population_cross_profiles,
      .dist_cross(list(list("FAC A", case$raw, 3L)))
    )
    frame$audit$value <- "183"
    bundles <- .dist_by_scenario(.dist_calculated(frame = frame))

    for (bundle in bundles) {
      expect_identical(bundle$status, "incompatible")
      expect_contains(.dist_reason_codes(bundle), "sex_set_mismatch")
      fac_a <- Filter(
        function(faculty) identical(faculty$faculty_key, "fac_a"),
        bundle$faculties
      )[[1L]]
      cell <- Filter(
        function(item) identical(item$sex_key, case$key),
        fac_a$cells
      )
      expect_length(cell, 1L)
      expect_identical(cell[[1L]]$sex_label, case$label)
      expect_identical(cell[[1L]]$population_frame_n, 3L)
      expect_true(is.na(cell[[1L]]$population_design_n))
      expect_true(is.na(cell[[1L]]$sample_n))
    }
  }
})

test_that("el agregado del frame conserva explícitamente la categoría vacía", {
  cross <- .cm_aulas_cross_profile(
    "faculty", "Facultad", "sex", "Sexo", "base_madre",
    c("FAC A", "FAC A"), c("Mujeres", ""), "estudiantes",
    preserve_blank_secondary = TRUE
  )
  expect_equal(nrow(cross), 2L)
  expect_true(any(cross$secondary_raw == "" & cross$count == 1L))
})

test_that("source_frame_hash stale queda auditado como incompatible", {
  frame <- .dist_frame()
  calculated <- .dist_calculated(frame = frame)
  stale_frame <- frame
  stale_frame$frame_hash <- "frame-dist-2"
  stale <- calc_muestra_distribucion_adjuntar_estudio(calculated, stale_frame)

  for (bundle in .dist_by_scenario(stale)) {
    expect_identical(bundle$source_frame_hash, "frame-dist-1")
    expect_identical(bundle$status, "incompatible")
    expect_contains(.dist_reason_codes(bundle), "source_frame_stale")
  }
})

test_that("population_hash y design_hash cambian solo con su causa", {
  frame <- .dist_frame()
  original <- .dist_by_scenario(.dist_calculated(frame = frame))$p1_universidad

  population_changed <- frame
  hit <- population_changed$population_cross_profiles$primary_raw == "FAC A" &
    population_changed$population_cross_profiles$secondary_raw == "Mujeres"
  population_changed$population_cross_profiles$count[hit] <- 61L
  population_changed$audit$value <- "181"
  changed_population <- .dist_by_scenario(
    .dist_calculated(frame = population_changed)
  )$p1_universidad
  expect_identical(changed_population$status, "ready")
  expect_false(identical(
    changed_population$population_hash,
    original$population_hash
  ))
  expect_identical(changed_population$design_hash, original$design_hash)
  # Convención del contrato: diseño - frame = 180 - 181.
  expect_identical(
    changed_population$reconciliation$frame_design_delta,
    -1L
  )

  study_changed <- .dist_study()
  study_changed$componentes[[1L]]$parametros$p <- 0.40
  changed_design <- .dist_by_scenario(
    .dist_calculated(study_changed, frame)
  )$p1_universidad
  expect_identical(changed_design$population_hash, original$population_hash)
  expect_false(identical(changed_design$design_hash, original$design_hash))
})

test_that("sensibilidad OFAT conserva fórmula, meta y divisor firmado", {
  frame <- .dist_frame()
  bundles <- .dist_by_scenario(.dist_calculated(frame = frame))
  p1 <- bundles$p1_universidad
  p2 <- bundles$p2_facultades

  expect_identical(
    vapply(p1$sensitivity$axes, `[[`, character(1), "parameter"),
    c("p", "confidence", "deff", "e")
  )
  expect_identical(
    p1$sensitivity$baseline$n_formula,
    calc_n_muestra(N = 180, p = 0.30, z = 1.96, e = 0.10, deff = 1.5)
  )
  expect_identical(p1$sensitivity$baseline$n_target, 50L)
  p_fixed <- .dist_axis(p1, "p")$points[[2L]]
  expect_identical(
    p_fixed$n_required,
    calc_n_muestra(N = 180, p = 0.50, z = 1.96, e = 0.10, deff = 1.5)
  )
  expect_identical(
    p_fixed$delta_n,
    p_fixed$n_required - p1$sensitivity$baseline$n_formula
  )
  expect_true(all(vapply(
    p1$sensitivity$axes,
    function(axis) all(vapply(axis$points, function(point) {
      is.integer(point$n_required) && is.integer(point$delta_n) &&
        is.integer(point$ch_required)
    }, logical(1))),
    logical(1)
  )))

  expect_true(is.na(.dist_axis(p2, "p")$points[[1L]]$value))
  expect_true(is.na(.dist_axis(p2, "confidence")$points[[1L]]$value))
  expect_true(is.na(.dist_axis(p2, "e")$points[[1L]]$value))
  expect_equal(.dist_axis(p2, "deff")$points[[1L]]$value, 1.5)

  larger_divisor_frame <- frame
  larger_divisor_frame$aula_frame$eligible_n <-
    larger_divisor_frame$aula_frame$eligible_n * 2L
  larger_divisor_frame$alumnos_por_ch <- calc_muestra_alumnos_por_ch(
    larger_divisor_frame$aula_frame,
    larger_divisor_frame$frame_hash
  )
  larger_divisor <- .dist_by_scenario(
    .dist_calculated(frame = larger_divisor_frame)
  )$p1_universidad
  expect_identical(
    larger_divisor$sensitivity$baseline$n_formula,
    p1$sensitivity$baseline$n_formula
  )
  expect_lt(
    larger_divisor$sensitivity$baseline$ch_required,
    p1$sensitivity$baseline$ch_required
  )
  expect_false(identical(larger_divisor$design_hash, p1$design_hash))
})

test_that("el divisor operativo debe coincidir con el valor firmado", {
  frame <- .dist_frame()
  calculated <- .dist_calculated(frame = frame)
  component <- calculated$componentes[[1L]]
  divisor_row <- component$resultado$aulas_por_estrato[[1L]]

  expect_equal(divisor_row$avg_conglomerado, 25)
  expect_equal(divisor_row$alumnos_por_ch$valor, 25)
  expect_identical(
    calc_muestra_distribucion_construir(component, frame)$status,
    "ready"
  )

  component$resultado$aulas_por_estrato[[1L]]$alumnos_por_ch$valor <- 32
  broken <- calc_muestra_distribucion_construir(component, frame)

  expect_identical(broken$status, "incompatible")
  expect_false(broken$reconciliation$ok)
  expect_contains(.dist_reason_codes(broken), "signed_divisor_mismatch")
  mismatch <- Filter(
    function(reason) identical(reason$code, "signed_divisor_mismatch"),
    broken$reasons
  )
  expect_length(mismatch, 1L)
  expect_named(mismatch[[1L]]$details, c(
    "faculty_key", "operational_value", "signed_value", "tolerance"
  ))
  expect_equal(mismatch[[1L]]$details$operational_value, 25)
  expect_equal(mismatch[[1L]]$details$signed_value, 32)
  expect_equal(mismatch[[1L]]$details$tolerance, 1e-9)
})

test_that("una fila CH extra invalida el inventario exacto", {
  frame <- .dist_frame()
  calculated <- .dist_calculated(frame = frame)
  component <- calculated$componentes[[1L]]
  expect_identical(
    calc_muestra_distribucion_construir(component, frame)$status,
    "ready"
  )

  extra <- component$resultado$aulas_por_estrato[[1L]]
  extra$estrato <- "FAC EXTRA"
  extra$alumnos_por_ch$faculty_key <- "fac_extra"
  component$resultado$aulas_por_estrato[[3L]] <- extra
  broken <- calc_muestra_distribucion_construir(component, frame)

  expect_identical(broken$status, "incompatible")
  expect_false(broken$reconciliation$ok)
  expect_contains(.dist_reason_codes(broken), "design_divisor_extra")

  missing <- calculated$componentes[[1L]]
  missing$resultado$aulas_por_estrato <-
    missing$resultado$aulas_por_estrato[1L]
  missing_bundle <- calc_muestra_distribucion_construir(missing, frame)
  expect_identical(missing_bundle$status, "incompatible")
  expect_contains(
    .dist_reason_codes(missing_bundle),
    "design_divisor_missing"
  )

  duplicated <- calculated$componentes[[1L]]
  duplicated$resultado$aulas_por_estrato[[3L]] <-
    duplicated$resultado$aulas_por_estrato[[1L]]
  duplicated_bundle <- calc_muestra_distribucion_construir(duplicated, frame)
  expect_identical(duplicated_bundle$status, "incompatible")
  expect_contains(
    .dist_reason_codes(duplicated_bundle),
    "design_divisor_duplicate"
  )
})

test_that("cuotas CH balanceadas no pueden divergir de la distribución", {
  frame <- .dist_frame()
  calculated <- .dist_calculated(frame = frame)
  valid_component <- calculated$componentes[[1L]]
  component <- valid_component
  rows <- component$resultado$aulas_por_estrato
  rows[[1L]]$cuota <- rows[[1L]]$cuota + 1L
  rows[[2L]]$cuota <- rows[[2L]]$cuota - 1L
  component$resultado$aulas_por_estrato <- rows

  expect_identical(
    sum(vapply(rows, `[[`, integer(1), "cuota")),
    component$resultado$n_objetivo
  )
  expect_identical(
    sum(vapply(rows, `[[`, integer(1), "aulas_base")),
    component$resultado$aulas_base_total
  )
  expect_identical(
    sum(vapply(rows, `[[`, integer(1), "aulas_total")),
    component$resultado$aulas_total
  )

  broken <- calc_muestra_distribucion_construir(component, frame)
  expect_identical(broken$status, "incompatible")
  expect_false(broken$reconciliation$ok)
  expect_contains(
    .dist_reason_codes(broken),
    "design_divisor_quota_mismatch"
  )

  invalid_total <- valid_component
  invalid_total$resultado$aulas_base_total <-
    invalid_total$resultado$aulas_base_total + 1L
  invalid_total_bundle <- calc_muestra_distribucion_construir(
    invalid_total,
    frame
  )
  expect_identical(invalid_total_bundle$status, "incompatible")
  expect_contains(
    .dist_reason_codes(invalid_total_bundle),
    "design_divisor_total_mismatch"
  )

  invalid_row_total <- valid_component
  invalid_row_total$resultado$aulas_por_estrato[[1L]]$aulas_total <-
    invalid_row_total$resultado$aulas_por_estrato[[1L]]$aulas_total + 1L
  invalid_row_total$resultado$aulas_total <-
    invalid_row_total$resultado$aulas_total + 1L
  invalid_row_bundle <- calc_muestra_distribucion_construir(
    invalid_row_total,
    frame
  )
  expect_identical(invalid_row_bundle$status, "incompatible")
  expect_contains(
    .dist_reason_codes(invalid_row_bundle),
    "design_divisor_row_total_mismatch"
  )
})

test_that("aulas base CH se derivan de cuota, divisor y tau acreditados", {
  frame <- .dist_frame()
  calculated <- .dist_calculated(frame = frame)
  component <- calculated$componentes[[1L]]
  row <- component$resultado$aulas_por_estrato[[1L]]

  expect_identical(
    row$aulas_base,
    as.integer(ceiling(row$cuota / (row$avg_conglomerado * row$tau)))
  )
  component$resultado$aulas_por_estrato[[1L]]$aulas_base <- 3L
  component$resultado$aulas_por_estrato[[1L]]$aulas_total <- 3L
  component$resultado$aulas_base_total <- 5L
  component$resultado$aulas_total <- 5L
  broken <- calc_muestra_distribucion_construir(component, frame)

  expect_identical(broken$status, "incompatible")
  expect_false(broken$reconciliation$ok)
  expect_contains(
    .dist_reason_codes(broken),
    "design_divisor_ch_required_mismatch"
  )
})

test_that("CH baseline distingue meta vigente de fórmula vigente", {
  study <- .dist_study()
  study$componentes[[1L]]$meta$valor <- 10L
  calculated <- .dist_calculated(study, .dist_frame())
  component <- calculated$componentes[[1L]]
  bundle <- component$resultado$distribucion_universitaria
  formula_point <- .dist_axis(bundle, "p")$points[[1L]]

  expect_identical(bundle$sensitivity$baseline$n_target, 10L)
  expect_identical(
    bundle$sensitivity$baseline$ch_required,
    component$resultado$aulas_base_total
  )
  expect_identical(
    formula_point$n_required,
    bundle$sensitivity$baseline$n_formula
  )
  expect_identical(formula_point$label, "Fórmula vigente")
  expect_gt(
    formula_point$ch_required,
    bundle$sensitivity$baseline$ch_required
  )
})

test_that("fracción o suma divergente invalida sin redondear el defecto", {
  frame <- .dist_frame()
  calculated <- .dist_calculated(frame = frame)
  component <- calculated$componentes[[1L]]
  component$resultado$distribucion_sub[[1L]]$n <- 10.5
  broken <- calc_muestra_distribucion_construir(component, frame)

  expect_identical(broken$status, "incompatible")
  expect_contains(.dist_reason_codes(broken), "design_cell_count_invalid")
  expect_contains(.dist_reason_codes(broken), "cell_sample_sum_mismatch")
  expect_true(any(vapply(
    broken$faculties[[1L]]$cells,
    function(cell) is.na(cell$sample_n),
    logical(1)
  )))
})

test_that("precisión faltante impide publicar un bundle ready", {
  frame <- .dist_frame()
  calculated <- .dist_calculated(frame = frame)
  component <- calculated$componentes[[1L]]
  component$resultado$distribucion_estratos[[1L]]$precision_e <- NULL

  broken <- calc_muestra_distribucion_construir(component, frame)

  expect_identical(broken$status, "incompatible")
  expect_false(broken$reconciliation$ok)
  expect_contains(.dist_reason_codes(broken), "faculty_precision_invalid")
  expect_identical(
    broken$faculties[[1L]]$precision$band_key,
    "unavailable"
  )
  expect_true(is.na(broken$faculties[[1L]]$precision$meets_target))

  invalid_cases <- list(
    target_e = function(value) {
      value$parametros$e <- 1.01
      value
    },
    achieved_e = function(value) {
      value$resultado$distribucion_estratos[[1L]]$precision_e <- 1.01
      value
    }
  )
  for (mutate_component in invalid_cases) {
    out_of_range <- calc_muestra_distribucion_construir(
      mutate_component(calculated$componentes[[1L]]),
      frame
    )
    expect_identical(out_of_range$status, "incompatible")
    expect_contains(
      .dist_reason_codes(out_of_range),
      "faculty_precision_invalid"
    )
  }
})

test_that("round-trip .pulso conserva solo el contrato agregado sin PII", {
  skip_if_not_installed("zip")
  frame <- .dist_frame()
  frame$aula_frame$unique_student_ids <- "private-student-123"
  frame$population <- data.frame(
    student_id = "private-student-123",
    stringsAsFactors = FALSE
  )
  calculated <- .dist_calculated(frame = frame)
  sid <- session_create()
  dest <- tempfile(fileext = ".pulso")
  stage <- tempfile("dist_pulso_")
  on.exit({
    session_delete(sid)
    unlink(dest, force = TRUE)
    unlink(stage, recursive = TRUE, force = TRUE)
  }, add = TRUE)
  session_set(sid, "calc_muestra_estudio", calculated)
  session_set(sid, "calc_muestra_aulas_frame", frame)

  build_pulso(sid, dest, project_name = "Distribución agregada")
  dir.create(stage, recursive = TRUE)
  utils::unzip(dest, exdir = stage)
  persisted <- readRDS(file.path(stage, "state.rds"))
  payload <- jsonlite::toJSON(
    persisted[c("calc_muestra_estudio", "calc_muestra_aulas_frame")],
    auto_unbox = TRUE,
    null = "null",
    na = "null"
  )
  expect_false(grepl("private-student-123", payload, fixed = TRUE))
  expect_null(persisted$calc_muestra_aulas_frame[["population"]])
  # Desde a859b321 la columna SOBREVIVE subrogada: sin ella no hay traslape que
  # descontar y el descuento secuencial se apagaba solo al reabrir el proyecto.
  # Lo que no viaja es la identidad — cada id real es un entero denso por orden
  # de aparicion y el mapa no se guarda.
  ids_persistidos <- persisted$calc_muestra_aulas_frame$aula_frame$unique_student_ids
  expect_true("unique_student_ids" %in%
    names(persisted$calc_muestra_aulas_frame$aula_frame))
  subrogados <- unlist(ids_persistidos, use.names = FALSE)
  expect_true(length(subrogados) > 0L)
  expect_true(all(grepl("^[0-9]+$", as.character(subrogados))))
  expect_identical(
    persisted$calc_muestra_estudio$componentes[[1L]]$resultado$
      distribucion_universitaria$population_hash,
    calculated$componentes[[1L]]$resultado$distribucion_universitaria$
      population_hash
  )

  loaded <- load_pulso(dest)
  on.exit(session_delete(loaded$session_id), add = TRUE)
  restored <- session_get(loaded$session_id)
  restored_bundle <- restored$calc_muestra_estudio$componentes[[1L]]$resultado$
    distribucion_universitaria
  expect_identical(restored_bundle$status, "ready")
  expect_identical(
    restored_bundle$design_hash,
    calculated$componentes[[1L]]$resultado$distribucion_universitaria$
      design_hash
  )
  expect_true(is.data.frame(
    restored$calc_muestra_aulas_frame$population_cross_profiles
  ))
})

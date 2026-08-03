.apch_row <- function(contract, key) {
  hit <- Filter(
    function(row) identical(row$faculty_key, key),
    contract$filas
  )
  expect_length(hit, 1L)
  hit[[1]]
}

.apch_frame <- function(hash = "frame-apch-1") {
  aula_frame <- data.frame(
    classroom_id = paste0("CH-", 1:5),
    faculty = c("FAC A", "FAC A", "FAC A", "FAC B", "FAC B"),
    included = c(TRUE, TRUE, FALSE, TRUE, FALSE),
    eligible_n = c(10, 20, 30, NA, 40),
    # Señal deliberadamente distinta: jamás puede usarse como fallback.
    enrolled_total = rep(999, 5),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  list(
    schema = "calc_muestra_aulas_frame_v1",
    frame_hash = hash,
    aula_frame = aula_frame,
    alumnos_por_ch = calc_muestra_alumnos_por_ch(aula_frame, hash)
  )
}

.apch_decision <- function(hash = "frame-apch-1", overrides = list()) {
  utils::modifyList(list(
    schema = "calc_muestra_alumnos_por_ch_decision_v1",
    frame_hash = hash,
    denominador = "elegible",
    estadistico_default = "media",
    por_facultad = list("fac_b" = "p25"),
    confirmado_at = "2026-08-02T12:00:00Z"
  ), overrides)
}

.apch_component <- function(actor_id, tecnica) {
  list(
    id = paste0("cmp-", actor_id),
    actor = actor_id,
    actor_id = actor_id,
    actor_categoria = "otros",
    canal_recojo = "aula_qr",
    tecnica = tecnica,
    marco = list(
      estado = "validado",
      estratos = list(
        list(
          label = "FAC A", N = 1000, N_a = 500, N_b = 500,
          e_facultad = 0.05, p_facultad = 0.5,
          promedio_conglomerado = 777, aulas_base_fijas = 777L, tau = 1
        ),
        list(
          label = "FAC B", N = 800, N_a = 400, N_b = 400,
          e_facultad = 0.05, p_facultad = 0.5,
          promedio_conglomerado = 888, aulas_base_fijas = 888L, tau = 1
        )
      )
    ),
    parametros = list(
      p = 0.5, z = 1.96, e = 0.05, deff = 1,
      tau = 1, promedio_conglomerado = 25, oversample_pct = 0
    )
  )
}

.apch_study <- function(decision = .apch_decision(), frame_mode = "opinion_universitaria") {
  list(
    macro_familia = "encuesta_estudiantes",
    workspace = list(
      frame_mode = frame_mode,
      aulas_config = list(alumnos_por_ch_decision = decision)
    ),
    componentes = list(
      .apch_component("estudiantes_universidad", "prob_conglomerado_multietapico"),
      .apch_component("estudiantes_facultad", "prob_estratificado_independiente")
    )
  )
}

.apch_capture_error <- function(expr) {
  tryCatch(expr, api_error = function(error) error)
}

test_that("Alumnos por CH publica ambos denominadores con eligible_n estricto", {
  frame <- .apch_frame()
  out <- frame$alumnos_por_ch

  expect_named(out, c(
    "schema", "owner", "frame_hash", "referencia", "grano", "unidad",
    "metrica", "filas"
  ))
  expect_identical(out$schema, "calc_muestra_alumnos_por_ch_v1")
  expect_identical(out$owner, "calc_muestra_aulas_frame_v1.aula_frame")
  expect_identical(out$frame_hash, frame$frame_hash)
  expect_identical(out$referencia, "marco_ejecutado")
  expect_identical(out$grano, "facultad_efectiva")
  expect_identical(out$unidad, "curso_horario_unico")
  expect_identical(out$metrica, "eligible_n")

  fac_a <- .apch_row(out, "fac_a")
  expect_identical(fac_a$elegible$n_ch, 2L)
  expect_identical(fac_a$elegible$n_ch_con_dato, 2L)
  expect_equal(fac_a$elegible$n_matriculas_elegibles, 30)
  expect_equal(fac_a$elegible$distribution, list(media = 15, p25 = 12.5, p50 = 15))
  expect_identical(fac_a$contraste_total$n_ch, 3L)
  expect_equal(fac_a$contraste_total$n_matriculas_elegibles, 60)
  expect_equal(fac_a$contraste_total$distribution$media, 20)

  fac_b <- .apch_row(out, "fac_b")
  expect_identical(fac_b$elegible$n_ch, 1L)
  expect_identical(fac_b$elegible$n_ch_con_dato, 0L)
  expect_true(is.na(fac_b$elegible$n_matriculas_elegibles))
  expect_true(all(is.na(unlist(fac_b$elegible$distribution))))
  expect_true(is.na(fac_b$contraste_total$n_matriculas_elegibles))
  expect_true(all(is.na(unlist(fac_b$contraste_total$distribution))))
  # enrolled_total=999 no rescata el snapshot.
  expect_false(identical(fac_b$elegible$distribution$media, 999))

  total <- .apch_row(out, "__total__")
  expect_identical(total$row_kind, "total")
  expect_identical(total$elegible$n_ch, 3L)
  expect_identical(total$contraste_total$n_ch, 5L)
  expect_true(is.na(total$elegible$n_matriculas_elegibles))
})

test_that("decisión Alumnos por CH sobrevive whitelist sin fabricar defaults válidos", {
  estudio <- calc_muestra_normalize_estudio(.apch_study())
  decision <- estudio$workspace$aulas_config$alumnos_por_ch_decision
  expect_identical(decision, .cm_alumnos_por_ch_normalize_decision(.apch_decision()))
  expect_identical(decision$por_facultad$fac_b, "p25")

  invalid <- calc_muestra_normalize_estudio(.apch_study(decision = list(
    schema = "otro",
    por_facultad = list("FAC A" = "promedio_inventado")
  )))$workspace$aulas_config$alumnos_por_ch_decision
  expect_identical(invalid$schema, "")
  expect_identical(invalid$estadistico_default, "")
  expect_identical(invalid$por_facultad$fac_a, "")

  malformed_map <- calc_muestra_normalize_estudio(.apch_study(decision = list(
    schema = "calc_muestra_alumnos_por_ch_decision_v1",
    frame_hash = "frame-apch",
    denominador = "elegible",
    estadistico_default = "media",
    por_facultad = "fac_a=p25",
    confirmado_at = "2026-08-02T12:00:00Z"
  )))$workspace$aulas_config$alumnos_por_ch_decision
  expect_identical(malformed_map$schema, "")
  expect_error(
    calc_muestra_alumnos_por_ch_resolver_estudio(
      .apch_study(decision = malformed_map),
      .apch_frame()
    ),
    class = "api_error"
  )
})

test_that("P1 y P2 consumen la decisión R y anulan aulas_base_fijas legacy", {
  frame <- .apch_frame()
  # Reemplaza FAC B por un snapshot completo; el elegible decidido queda en 30.
  frame$aula_frame$eligible_n[[4]] <- 30
  frame$alumnos_por_ch <- calc_muestra_alumnos_por_ch(
    frame$aula_frame,
    frame$frame_hash
  )
  resolved <- calc_muestra_alumnos_por_ch_resolver_estudio(.apch_study(), frame)

  for (component in resolved$estudio$componentes) {
    expect_equal(
      vapply(component$marco$estratos, `[[`, numeric(1), "aulas_base_fijas"),
      c(0, 0)
    )
    expect_equal(
      vapply(component$marco$estratos, `[[`, numeric(1), "promedio_conglomerado"),
      c(15, 30)
    )
  }

  calculated <- calc_muestra_calcular_estudio(resolved$estudio)
  calculated <- calc_muestra_alumnos_por_ch_adjuntar_auditoria(
    calculated,
    resolved$auditoria
  )
  by_actor <- stats::setNames(
    calculated$componentes,
    vapply(calculated$componentes, `[[`, character(1), "actor_id")
  )
  for (actor_id in c("estudiantes_universidad", "estudiantes_facultad")) {
    result <- by_actor[[actor_id]]$resultado
    expect_identical(
      result$alumnos_por_ch_decision$frame_hash,
      frame$frame_hash
    )
    expect_identical(result$alumnos_por_ch_decision$denominador, "elegible")
    rows <- result$aulas_por_estrato
    expect_equal(vapply(rows, `[[`, numeric(1), "avg_conglomerado"), c(15, 30))
    expect_identical(
      vapply(rows, `[[`, character(1), "estadistico_usado"),
      c("media", "p25")
    )
    expect_true(all(vapply(
      rows,
      function(row) identical(row$alumnos_por_ch$frame_hash, frame$frame_hash),
      logical(1)
    )))
    expect_identical(
      result$aulas_base_total,
      as.integer(sum(vapply(rows, `[[`, integer(1), "aulas_base")))
    )
    expect_lt(result$aulas_base_total, 777L + 888L)
  }
})

test_that("cada componente P1/P2 cubre exactamente las facultades del contrato", {
  frame <- .apch_frame()
  study <- .apch_study()
  study$componentes <- lapply(study$componentes, function(component) {
    component$marco$estratos <- component$marco$estratos[1]
    component
  })

  incomplete <- .apch_capture_error(
    calc_muestra_alumnos_por_ch_resolver_estudio(study, frame)
  )
  expect_s3_class(incomplete, "api_error")
  expect_identical(incomplete$code, "E_CALC_MUESTRA_ALUMNOS_CH_DECISION")
  expect_identical(incomplete$details$reason, "facultades_incompletas")
  expect_identical(incomplete$details$actor, "estudiantes_universidad")
  expect_identical(unlist(incomplete$details$faltantes), "fac_b")
  expect_length(incomplete$details$sobrantes, 0L)
})

test_that("divisor decidido, usado y auditado conserva exactamente su valor", {
  frame <- .apch_frame()
  frame$aula_frame$eligible_n <- c(30, 45, 60, 40, 50)
  frame$alumnos_por_ch <- calc_muestra_alumnos_por_ch(
    frame$aula_frame,
    frame$frame_hash
  )
  expected <- c(37.5, 40)
  resolved <- calc_muestra_alumnos_por_ch_resolver_estudio(.apch_study(), frame)

  for (component in resolved$estudio$componentes) {
    expect_identical(
      vapply(component$marco$estratos, `[[`, numeric(1), "promedio_conglomerado"),
      expected
    )
  }

  calculated <- calc_muestra_calcular_estudio(resolved$estudio)
  for (component in calculated$componentes) {
    rows <- component$resultado$aulas_por_estrato
    expect_identical(
      vapply(rows, `[[`, numeric(1), "avg_conglomerado"),
      expected
    )
    expect_identical(
      vapply(rows, function(row) {
        as.integer(ceiling(row$cuota / (row$avg_conglomerado * row$tau)))
      }, integer(1)),
      vapply(rows, `[[`, integer(1), "aulas_base")
    )
  }

  audited <- calc_muestra_alumnos_por_ch_adjuntar_auditoria(
    calculated,
    resolved$auditoria
  )
  for (component in audited$componentes) {
    rows <- component$resultado$aulas_por_estrato
    expect_identical(
      vapply(rows, function(row) row$alumnos_por_ch$valor, numeric(1)),
      expected
    )
    expect_identical(
      vapply(rows, `[[`, numeric(1), "avg_conglomerado"),
      expected
    )
  }
})

test_that("decisión stale, no confirmada, incompleta o sin facultad falla cerrada", {
  frame <- .apch_frame()

  stale <- .apch_capture_error(
    calc_muestra_alumnos_por_ch_resolver_estudio(
      .apch_study(.apch_decision("otro-hash")),
      frame
    )
  )
  expect_s3_class(stale, "api_error")
  expect_identical(stale$code, "E_CALC_MUESTRA_ALUMNOS_CH_DECISION")
  expect_identical(stale$details$reason, "frame_stale")

  unconfirmed <- .apch_capture_error(
    calc_muestra_alumnos_por_ch_resolver_estudio(
      .apch_study(.apch_decision(overrides = list(confirmado_at = ""))),
      frame
    )
  )
  expect_identical(unconfirmed$details$reason, "sin_confirmacion")

  incomplete <- .apch_capture_error(
    calc_muestra_alumnos_por_ch_resolver_estudio(
      .apch_study(list(schema = "calc_muestra_alumnos_por_ch_decision_v1")),
      frame
    )
  )
  expect_identical(incomplete$details$reason, "sin_confirmacion")

  missing_faculty_study <- .apch_study()
  missing_faculty_study$componentes <- lapply(
    missing_faculty_study$componentes,
    function(component) {
      component$marco$estratos[[2]]$label <- "FAC C"
      component
    }
  )
  missing <- .apch_capture_error(
    calc_muestra_alumnos_por_ch_resolver_estudio(missing_faculty_study, frame)
  )
  expect_identical(missing$details$reason, "facultades_incompletas")
  expect_identical(unlist(missing$details$faltantes), "fac_b")
  expect_identical(unlist(missing$details$sobrantes), "fac_c")
})

test_that("valor decidido no positivo falla y ausencia del contrato conserva compatibilidad", {
  frame <- .apch_frame()
  frame$aula_frame$eligible_n[frame$aula_frame$faculty == "FAC B"] <- 0
  frame$alumnos_por_ch <- calc_muestra_alumnos_por_ch(
    frame$aula_frame,
    frame$frame_hash
  )
  bad <- .apch_capture_error(
    calc_muestra_alumnos_por_ch_resolver_estudio(.apch_study(), frame)
  )
  expect_identical(bad$details$reason, "valor_no_positivo")

  out_of_domain <- .apch_frame()
  fac_a_idx <- which(vapply(
    out_of_domain$alumnos_por_ch$filas,
    function(row) identical(row$faculty_key, "fac_a"),
    logical(1)
  ))
  out_of_domain$alumnos_por_ch$filas[[fac_a_idx]]$elegible$distribution$media <-
    5000
  invalid_domain <- .apch_capture_error(
    calc_muestra_alumnos_por_ch_resolver_estudio(.apch_study(), out_of_domain)
  )
  expect_s3_class(invalid_domain, "api_error")
  expect_identical(invalid_domain$details$reason, "valor_fuera_dominio")
  expect_identical(invalid_domain$details$valor, 5000)

  legacy <- .apch_study(decision = NULL)
  resolved_legacy <- calc_muestra_alumnos_por_ch_resolver_estudio(legacy, NULL)
  expect_null(resolved_legacy$auditoria)
  expect_equal(
    resolved_legacy$estudio$componentes[[1]]$marco$estratos[[1]]$aulas_base_fijas,
    777L
  )

  outside <- .apch_study(.apch_decision("stale"), frame_mode = "marco_disponible")
  expect_null(calc_muestra_alumnos_por_ch_resolver_estudio(outside, NULL)$auditoria)
})

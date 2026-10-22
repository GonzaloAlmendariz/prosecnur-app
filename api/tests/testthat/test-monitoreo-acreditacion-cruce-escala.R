# El cruce de acreditación a escala de universos grandes
# (`monitoreo_acreditacion_cruce_escala.R`): las versiones lineales devuelven
# lo mismo que las cuadráticas que reemplazan, y el universo asignable viaja
# una vez por actor en vez de copiarse en cada caso (diagnóstico 2026-10-22).

# Implementaciones previas, tal cual estaban en monitoreo_engine.R, como referencia.
ref_records_to_df <- function(rows) {
  if (!length(rows)) return(data.frame())
  out <- do.call(rbind, lapply(rows, function(row) {
    if (is.data.frame(row)) return(row)
    if (is.list(row) && length(row)) {
      row <- lapply(row, function(value) {
        if (is.null(value) || length(value) == 0L) return("")
        if (is.list(value) && !is.data.frame(value)) return(I(list(value)))
        if (length(value) != 1L) return(I(list(value)))
        value
      })
    }
    as.data.frame(row, check.names = FALSE, stringsAsFactors = FALSE)
  }))
  rownames(out) <- NULL
  out
}

ref_workbook_rows <- function(x) {
  rows <- lapply(x, function(row) {
    if (is.data.frame(row)) row <- as.list(row[1, , drop = FALSE])
    if (!is.list(row)) row <- list(Valor = row)
    row
  })
  cols <- unique(unlist(lapply(rows, names), use.names = FALSE))
  cols <- cols[nzchar(cols)]
  if (!length(cols)) cols <- "Valor"
  out <- do.call(rbind, lapply(rows, function(row) {
    values <- vapply(cols, function(col) .monitoreo_workbook_cell_value(row[[col]]), character(1))
    as.data.frame(as.list(values), check.names = FALSE, stringsAsFactors = FALSE)
  }))
  names(out) <- cols
  rownames(out) <- NULL
  out
}

ref_dedupe_keep <- function(dedupe_key, priorities) {
  keep <- logical(length(dedupe_key))
  for (key in unique(dedupe_key)) {
    idx <- which(dedupe_key == key)
    keep[idx[which.max(priorities[idx])]] <- TRUE
  }
  keep
}

test_that("las filas de casos se arman por columnas con el mismo resultado que el rbind", {
  rows <- list(
    data.frame(actor = "A", n = 1L, ok = TRUE, revision = I(list(list(x = 1))), stringsAsFactors = FALSE),
    list(actor = "B", n = 2L, ok = FALSE, revision = list(x = 2, y = list("a", "b"))),
    list(n = 3L, actor = "C", ok = NA, revision = NULL),
    list(actor = "D", n = 4L, ok = TRUE, revision = list())
  )
  expect_equal(.monitoreo_internal_records_to_df(rows), ref_records_to_df(rows))
})

test_that("la tabla para hojas de una lista de registros es la misma que antes", {
  x <- list(
    list(actor = "A", total = 3L, detalle = list(a = 1, b = "x")),
    list(total = 4L, actor = "B", extra = NA),
    data.frame(actor = "C", total = 5L, stringsAsFactors = FALSE)
  )
  expect_identical(.monitoreo_workbook_df(x), ref_workbook_rows(x))
})

test_that("la deduplicación conserva por llave la fila de mayor prioridad y, al empatar, la primera", {
  cases <- data.frame(
    actor = c("A", "A", "A", "B", "B", "A", ""),
    case_key = c("k1", "k1", "k2", "k1", "k1", "", ""),
    response_id = c("r1", "r2", "r3", "r4", "r5", "r6", "r7"),
    response_row = as.character(1:7),
    platform_state = c("Parcial", "Completa", "Completa", "Completa", "Completa", "Rechazo", "Completa"),
    advancement = c("partial", "effective", "effective", "effective", "effective", "refusal", "effective"),
    date = c("2026-10-27", "2026-10-28", "2026-10-27", "2026-10-29", "2026-10-29", "", "no es fecha"),
    stringsAsFactors = FALSE
  )
  out <- .monitoreo_internal_deduplicate_cases(cases)
  priorities <- vapply(seq_len(nrow(cases)), function(i) .monitoreo_internal_case_priority(as.list(cases[i, , drop = FALSE])), numeric(1))
  expect_equal(.monitoreo_internal_case_priorities(cases), priorities)
  expect_identical(out$response_id, c("r2", "r3", "r4", "r6", "r7"))
})

test_that("el tamaño de grupo cuenta cada llave sin tocar las vacías", {
  expect_identical(.monitoreo_internal_group_size(c("a", "b", "a", "", NA, "a")), c(3L, 1L, 3L, 1L, 1L, 3L))
})

universo_y_respuestas <- function(n_base = 40L) {
  tokens <- sprintf("tk%04d", seq_len(n_base))
  universo <- data.frame(
    Token = tokens,
    Facultad = rep(c("Derecho", "Ciencias"), length.out = n_base),
    .source_id = "universo-pregrado",
    .source_label = "Universo · Estudiantes de pregrado",
    .source_role = "universo",
    dim_actor = "Estudiantes de pregrado",
    stringsAsFactors = FALSE
  )
  respuestas <- data.frame(
    response_id = sprintf("r%02d", 1:6),
    response_status = c("completed", "completed", "partial", "completed", "completed", "partial"),
    date_modified = "2026-10-27T10:00:00+00:00",
    cv_t = c(tokens[1], tokens[2], tokens[3], "ajeno01", tokens[1], "ajeno02"),
    .source_id = "respuestas-pregrado",
    .source_label = "SurveyMonkey · Pregrado",
    .source_role = "respuestas",
    dim_actor = "Estudiantes de pregrado",
    stringsAsFactors = FALSE
  )
  cols <- union(names(universo), names(respuestas))
  for (col in setdiff(cols, names(universo))) universo[[col]] <- ""
  for (col in setdiff(cols, names(respuestas))) respuestas[[col]] <- ""
  list(
    data = rbind(universo[cols], respuestas[cols]),
    profile = monitoreo_normalize_profile(list(
      family = "acreditacion",
      key_rules = list(universe_fields = list("Token"), response_fields = list("cv_t"), automatic_detection = TRUE)
    ))
  )
}

test_that("el universo asignable viaja una vez por actor y cada caso lo nombra", {
  fx <- universo_y_respuestas(40L)
  iq <- .monitoreo_acreditacion_internal_queries_impl(fx$data, fx$profile)
  pool <- iq$assignment_pool
  expect_named(pool, "estudiantes de pregrado")
  # 40 personas menos las tres que ya tienen respuesta cruzada (dos completas
  # y una parcial): las mismas que antes se saltaban en cada caso.
  expect_length(pool[["estudiantes de pregrado"]], 37L)
  pool_ids <- vapply(pool[["estudiantes de pregrado"]], function(x) x$candidate_id, "")
  expect_false(any(c("codigo:TK0001", "codigo:TK0002", "codigo:TK0003") %in% pool_ids))

  revisables <- Filter(function(c) length(c$assisted_review) && isTRUE(c$assisted_review$eligible), iq$cases)
  expect_gt(length(revisables), 0L)
  for (caso in revisables) {
    ar <- caso$assisted_review
    expect_identical(ar$assignment_pool_key, "estudiantes de pregrado")
    # Lo propio del caso es sólo lo que trae evidencia o la parcial en curso.
    expect_lte(length(ar$assignment_candidates), 1L)
    completos <- .monitoreo_revision_asistida_candidatos_caso(ar, pool)
    ids <- vapply(completos, function(x) x$candidate_id, "")
    expect_false(anyDuplicated(ids) > 0)
    expect_true(all(pool_ids %in% ids))
  }
})

test_that("una asignación manual se valida contra el universo del pool", {
  fx <- universo_y_respuestas(12L)
  cfg <- list(monitoreo_profile = fx$profile)
  out <- .monitoreo_acreditacion_apply_case_reconciliation(fx$data, cfg, list(
    response_id = "r04",
    action = "include_with_caveat",
    candidate_id = "codigo:TK0009",
    note = "Token mal copiado; confirmado por correo."
  ))
  decisiones <- out$profile$reconciliation_decisions$manual_case_reconciliations %||%
    out$config$monitoreo_profile$reconciliation_decisions$manual_case_reconciliations
  expect_true(any(vapply(decisiones, function(d) identical(d$response_id, "r04"), logical(1))))
})

# Decodificador de referencia: lo mismo que `transportRecords` del front.
decodificar_columnas <- function(x) {
  lapply(seq_len(x$n), function(i) {
    rec <- lapply(x$campos, function(col) {
      if (!is.null(col$valores)) return(col$valores[[i]])
      v <- col$niveles[[col$codigos[[i]] + 1L]]
      if (length(v) == 1L && is.na(v)) NULL else v
    })
    Filter(Negate(is.null), rec)
  })
}

test_that("el transporte en columnas conserva cada registro y el rollup va por índices", {
  fx <- universo_y_respuestas(30L)
  iq <- .monitoreo_acreditacion_internal_queries_impl(fx$data, fx$profile)
  out <- .monitoreo_internal_queries_para_cliente(iq)

  expect_identical(out$cases$formato, "columnas_v1")
  sin_na <- function(recs) lapply(recs, function(r) Filter(function(v) !(is.atomic(v) && length(v) == 1L && is.na(v)), r))
  expect_equal(decodificar_columnas(out$cases), sin_na(iq$cases))

  expect_identical(out$case_rollup$formato, "indices_v1")
  expect_identical(lapply(as.integer(out$case_rollup$indices) + 1L, function(i) iq$cases[[i]]), iq$case_rollup)

  pool <- lapply(out$assignment_pool, decodificar_columnas)
  expect_equal(pool, lapply(iq$assignment_pool, sin_na))

  # Lo que llega al navegador pesa una fracción de los registros sueltos.
  bruto <- nchar(jsonlite::toJSON(iq, auto_unbox = TRUE, null = "null"))
  compacto <- nchar(jsonlite::toJSON(out, auto_unbox = TRUE, null = "null"))
  expect_lt(compacto, bruto / 2)
})

test_that("un rollup que no calza idéntico con los casos viaja en columnas", {
  casos <- list(list(actor = "A", response_id = "r1", case_key = "k1"), list(actor = "A", response_id = "r2", case_key = "k2"))
  otro <- list(list(actor = "A", response_id = "r1", case_key = "k1", extra = "x"))
  expect_identical(.monitoreo_transporte_indices(otro, casos)$formato, "columnas_v1")
  expect_identical(as.integer(.monitoreo_transporte_indices(casos[2], casos)$indices), 1L)
})

test_that("los registros de un data.frame salen iguales que fila por fila", {
  ref_records <- function(df) {
    if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(list())
    lapply(seq_len(nrow(df)), function(i) {
      row <- as.list(df[i, , drop = FALSE])
      row[] <- lapply(row, function(x) if (length(x) && !is.na(x[1])) x[[1]] else "")
      row
    })
  }
  df <- data.frame(
    texto = c("a", NA, "c"),
    entero = c(1L, NA, 3L),
    numero = c(1.5, 2, NA),
    logico = c(TRUE, NA, FALSE),
    factor = factor(c("x", NA, "y")),
    fecha = as.Date(c("2026-10-27", NA, "2026-10-29")),
    stringsAsFactors = FALSE
  )
  df$lista <- I(list(list(a = 1), list(), NULL))
  df$nombrado <- stats::setNames(c("p", "q", "r"), c("u", "v", "w"))
  expect_identical(.monitoreo_report_records(df), ref_records(df))
  expect_identical(.monitoreo_report_records(data.frame()), list())
  expect_identical(.monitoreo_report_records(df[, 0]), ref_records(df[, 0]))
})

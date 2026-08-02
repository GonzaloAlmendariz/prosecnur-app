# Contrato I19/M4 de distribución universitaria. Este owner reconcilia el
# agregado facultad x sexo del marco ejecutado con el diseño P1/P2 ya calculado.
# No recibe ni conserva población cruda, ids de estudiante ni atributos de
# contexto: su única fuente poblacional es frame$population_cross_profiles.

.cm_dist_schema <- "calc_muestra_distribucion_universitaria_v1"
.cm_dist_owner <- "engine_r"
.cm_dist_divisor_tolerance <- 1e-9
.cm_dist_components <- c(
  estudiantes_universidad = "p1_universidad",
  estudiantes_facultad = "p2_facultades"
)

.cm_redondeo_distribucion_universitaria <- function(comp) {
  if (comp$actor_id %in% c("estudiantes_universidad", "estudiantes_facultad")) {
    return("round_residuo_controlado")
  }
  "cuadratura"
}

.cm_dist_reason <- function(code, message, details = list()) {
  list(code = code, message = message, details = details)
}

.cm_dist_add_reason <- function(reasons, code, message, details = list()) {
  duplicate <- vapply(reasons, function(reason) {
    identical(reason$code, code) && identical(reason$details, details)
  }, logical(1))
  if (!any(duplicate)) {
    reasons[[length(reasons) + 1L]] <- .cm_dist_reason(
      code, message, details
    )
  }
  reasons
}

.cm_dist_exact_int <- function(value) {
  value <- suppressWarnings(as.numeric(unlist(value, use.names = FALSE)))
  if (length(value) != 1L || !is.finite(value) || value < 0 ||
      abs(value - round(value)) > 1e-9 || value > .Machine$integer.max) {
    return(NA_integer_)
  }
  as.integer(round(value))
}

.cm_dist_num <- function(value) {
  value <- suppressWarnings(as.numeric(unlist(value, use.names = FALSE)))
  if (length(value) != 1L || !is.finite(value)) return(NA_real_)
  value
}

.cm_dist_ch_required_one <- function(quota, divisor, tau) {
  quota <- .cm_dist_exact_int(quota)
  divisor <- .cm_dist_num(divisor)
  tau <- .cm_dist_num(tau)
  if (is.na(quota) || !is.finite(divisor) || divisor <= 0 ||
      !is.finite(tau) || tau <= 0) return(NA_integer_)
  required <- ceiling(quota / (divisor * tau))
  if (!is.finite(required) || required < 0 ||
      required > .Machine$integer.max) return(NA_integer_)
  as.integer(required)
}

.cm_dist_faculty_key <- function(value) {
  value <- trimws(as.character(value %||% ""))
  if (!nzchar(value)) return("")
  .cm_criterios_fac_key(value)
}

.cm_dist_sex_key <- function(value) {
  value <- trimws(as.character(value %||% ""))
  if (!nzchar(value)) return("__blank__")
  .cm_aulas_text_key(value)
}

.cm_dist_sex_label <- function(value) {
  value <- trimws(as.character(value %||% ""))
  if (nzchar(value)) value else "Sin dato"
}

.cm_dist_rows <- function(value) {
  if (is.data.frame(value)) {
    return(lapply(seq_len(nrow(value)), function(i) {
      as.list(value[i, , drop = FALSE])
    }))
  }
  if (!is.list(value)) return(list())
  Filter(is.list, unname(value))
}

.cm_dist_expected_population_n <- function(frame) {
  audit <- frame$audit
  if (!is.data.frame(audit) ||
      !all(c("metric", "value") %in% names(audit))) return(NA_integer_)
  hit <- which(as.character(audit$metric) == "population_n")
  if (length(hit) != 1L) return(NA_integer_)
  .cm_dist_exact_int(audit$value[[hit]])
}

.cm_dist_frame_records <- function(frame) {
  reasons <- list()
  cross <- frame$population_cross_profiles
  required <- c(
    "primary_role", "primary_raw", "secondary_role", "secondary_raw", "count"
  )
  if (!is.data.frame(cross) || !all(required %in% names(cross))) {
    reasons <- .cm_dist_add_reason(
      reasons,
      "population_cross_profiles_missing",
      "El marco no contiene el agregado facultad por sexo requerido."
    )
    return(list(
      records = list(),
      expected_n = .cm_dist_expected_population_n(frame),
      reasons = reasons
    ))
  }

  cross <- cross[
    as.character(cross$primary_role) == "faculty" &
      as.character(cross$secondary_role) == "sex",
    ,
    drop = FALSE
  ]
  if (!nrow(cross)) {
    reasons <- .cm_dist_add_reason(
      reasons,
      "population_cross_profiles_empty",
      "El agregado del marco no contiene celdas facultad por sexo."
    )
  }

  records <- list()
  for (i in seq_len(nrow(cross))) {
    faculty_label <- trimws(as.character(cross$primary_raw[[i]] %||% ""))
    sex_raw <- trimws(as.character(cross$secondary_raw[[i]] %||% ""))
    faculty_key <- .cm_dist_faculty_key(faculty_label)
    sex_key <- .cm_dist_sex_key(sex_raw)
    count <- .cm_dist_exact_int(cross$count[[i]])

    if (!nzchar(faculty_key)) {
      reasons <- .cm_dist_add_reason(
        reasons,
        "population_faculty_invalid",
        "El agregado poblacional contiene una facultad sin clave estable."
      )
      next
    }
    if (!nzchar(sex_key)) {
      reasons <- .cm_dist_add_reason(
        reasons,
        "population_sex_invalid",
        "El agregado poblacional contiene una categoría de sexo sin clave estable.",
        list(faculty_key = faculty_key)
      )
      next
    }
    if (is.na(count)) {
      reasons <- .cm_dist_add_reason(
        reasons,
        "population_count_invalid",
        "Los conteos del marco deben ser enteros no negativos.",
        list(faculty_key = faculty_key, sex_key = sex_key)
      )
    }

    record <- records[[faculty_key]]
    if (is.null(record)) {
      record <- list(
        faculty_key = faculty_key,
        faculty_label = faculty_label,
        raw_labels = faculty_label,
        cells = list()
      )
    } else if (!faculty_label %in% record$raw_labels) {
      record$raw_labels <- c(record$raw_labels, faculty_label)
      reasons <- .cm_dist_add_reason(
        reasons,
        "population_faculty_duplicate",
        "Más de una etiqueta del marco colapsa a la misma facultad.",
        list(faculty_key = faculty_key, labels = as.list(record$raw_labels))
      )
    }
    if (!is.null(record$cells[[sex_key]])) {
      reasons <- .cm_dist_add_reason(
        reasons,
        "population_cell_duplicate",
        "Cada celda facultad por sexo debe aparecer una sola vez en el marco.",
        list(faculty_key = faculty_key, sex_key = sex_key)
      )
    } else {
      record$cells[[sex_key]] <- list(
        sex_key = sex_key,
        sex_label = .cm_dist_sex_label(sex_raw),
        population_frame_n = count
      )
    }
    records[[faculty_key]] <- record
  }

  records <- records[sort(names(records))]
  for (faculty_key in names(records)) {
    record <- records[[faculty_key]]
    record$cells <- record$cells[sort(names(record$cells))]
    values <- vapply(
      record$cells,
      function(cell) cell$population_frame_n,
      integer(1)
    )
    record$population_frame_n <- if (anyNA(values)) {
      NA_integer_
    } else {
      as.integer(sum(values))
    }
    record$raw_labels <- NULL
    records[[faculty_key]] <- record
  }

  list(
    records = records,
    expected_n = .cm_dist_expected_population_n(frame),
    reasons = reasons
  )
}

.cm_dist_index_rows <- function(rows, key_fn, duplicate_code, duplicate_message) {
  indexed <- list()
  reasons <- list()
  for (row in .cm_dist_rows(rows)) {
    key <- key_fn(row)
    if (!nzchar(key)) next
    if (!is.null(indexed[[key]])) {
      reasons <- .cm_dist_add_reason(
        reasons, duplicate_code, duplicate_message, list(key = key)
      )
    } else {
      indexed[[key]] <- row
    }
  }
  list(rows = indexed, reasons = reasons)
}

.cm_dist_ch_totals_reasons <- function(result, rows) {
  reasons <- list()
  count_fields <- c(
    "cuota", "aulas_base", "aulas_reemplazo",
    "aulas_extra_operativas", "aulas_total"
  )
  parsed <- vector("list", length(rows))
  for (i in seq_along(rows)) {
    row <- rows[[i]]
    values <- lapply(count_fields, function(field) {
      .cm_dist_exact_int(row[[field]])
    })
    names(values) <- count_fields
    invalid <- names(values)[vapply(values, is.na, logical(1))]
    faculty_key <- .cm_dist_faculty_key(row$estrato)
    if (length(invalid)) {
      reasons <- .cm_dist_add_reason(
        reasons,
        "design_divisor_row_count_invalid",
        "Cada fila CH debe declarar conteos enteros no negativos.",
        list(
          row = as.integer(i),
          faculty_key = faculty_key,
          fields = as.list(invalid)
        )
      )
    } else {
      if (!identical(
          values$aulas_reemplazo,
          values$aulas_extra_operativas
      )) {
        reasons <- .cm_dist_add_reason(
          reasons,
          "design_divisor_row_total_mismatch",
          "Las aulas extra y de reemplazo deben coincidir dentro de cada fila CH.",
          list(faculty_key = faculty_key, metric = "aulas_extra")
        )
      }
      if (!identical(
          values$aulas_total,
          as.integer(values$aulas_base + values$aulas_reemplazo)
      )) {
        reasons <- .cm_dist_add_reason(
          reasons,
          "design_divisor_row_total_mismatch",
          "El total de aulas debe cuadrar dentro de cada fila CH.",
          list(faculty_key = faculty_key, metric = "aulas_total")
        )
      }
    }
    parsed[[i]] <- list(faculty_key = faculty_key, values = values)
  }

  total_specs <- list(
    list(row_field = "cuota", total_field = "n_objetivo"),
    list(row_field = "aulas_base", total_field = "aulas_base_total"),
    list(row_field = "aulas_reemplazo", total_field = "aulas_extra_total"),
    list(row_field = "aulas_total", total_field = "aulas_total")
  )
  for (spec in total_specs) {
    values <- vapply(parsed, function(item) {
      item$values[[spec$row_field]]
    }, integer(1))
    actual <- .cm_dist_sum_int(values)
    expected <- .cm_dist_exact_int(result[[spec$total_field]])
    if (is.na(actual) || is.na(expected) || !identical(actual, expected)) {
      reasons <- .cm_dist_add_reason(
        reasons,
        "design_divisor_total_mismatch",
        "Los totales CH deben cuadrar exactamente contra sus filas.",
        list(
          metric = spec$total_field,
          expected = expected,
          actual = actual
        )
      )
    }
  }
  reasons
}

.cm_dist_design_records <- function(component) {
  reasons <- list()
  result <- component$resultado %||% list()
  estratos <- component$marco$estratos %||% list()

  faculty_result <- .cm_dist_index_rows(
    result$distribucion_estratos,
    function(row) .cm_dist_faculty_key(row$estrato),
    "design_faculty_result_duplicate",
    "La distribución calculada repite una facultad."
  )
  reasons <- c(reasons, faculty_result$reasons)
  sub_result <- .cm_dist_index_rows(
    result$distribucion_sub,
    function(row) paste(
      .cm_dist_faculty_key(row$estrato),
      .cm_dist_sex_key(row$sub),
      sep = "::"
    ),
    "design_cell_result_duplicate",
    "La distribución calculada repite una celda facultad por sexo."
  )
  reasons <- c(reasons, sub_result$reasons)
  aulas_rows <- .cm_dist_rows(result$aulas_por_estrato)
  invalid_aulas_rows <- which(!vapply(aulas_rows, function(row) {
    nzchar(.cm_dist_faculty_key(row$estrato))
  }, logical(1)))
  if (length(invalid_aulas_rows)) {
    reasons <- .cm_dist_add_reason(
      reasons,
      "design_divisor_faculty_invalid",
      "Cada fila CH debe declarar una facultad con clave estable.",
      list(rows = as.list(as.integer(invalid_aulas_rows)))
    )
  }
  aulas_result <- .cm_dist_index_rows(
    aulas_rows,
    function(row) .cm_dist_faculty_key(row$estrato),
    "design_divisor_duplicate",
    "La auditoría de Alumnos/CH repite una facultad."
  )
  reasons <- c(reasons, aulas_result$reasons)
  reasons <- c(reasons, .cm_dist_ch_totals_reasons(result, aulas_rows))

  records <- list()
  for (estrato in estratos) {
    faculty_label <- trimws(as.character(estrato$label %||% ""))
    faculty_key <- .cm_dist_faculty_key(faculty_label)
    if (!nzchar(faculty_key)) {
      reasons <- .cm_dist_add_reason(
        reasons,
        "design_faculty_invalid",
        "El diseño contiene una facultad sin clave estable."
      )
      next
    }
    if (!is.null(records[[faculty_key]])) {
      reasons <- .cm_dist_add_reason(
        reasons,
        "design_faculty_duplicate",
        "Cada facultad debe aparecer una sola vez en el diseño.",
        list(faculty_key = faculty_key)
      )
      next
    }

    population_design_n <- .cm_dist_exact_int(estrato$N)
    sample_row <- faculty_result$rows[[faculty_key]]
    sample_n <- if (is.list(sample_row)) {
      .cm_dist_exact_int(sample_row$n)
    } else {
      NA_integer_
    }
    if (is.na(population_design_n)) {
      reasons <- .cm_dist_add_reason(
        reasons,
        "design_population_invalid",
        "Los tamaños de facultad del diseño deben ser enteros no negativos.",
        list(faculty_key = faculty_key)
      )
    }
    if (is.na(sample_n)) {
      reasons <- .cm_dist_add_reason(
        reasons,
        "design_sample_missing",
        "Cada facultad debe tener una cuota calculada entera.",
        list(faculty_key = faculty_key)
      )
    }

    cells <- list()
    sex_specs <- list(
      list(label = estrato$sub_a_label, n = estrato$N_a),
      list(label = estrato$sub_b_label, n = estrato$N_b)
    )
    for (sex_spec in sex_specs) {
      sex_label <- trimws(as.character(sex_spec$label %||% ""))
      sex_key <- .cm_dist_sex_key(sex_label)
      if (!nzchar(sex_key) || identical(sex_key, "__blank__")) {
        reasons <- .cm_dist_add_reason(
          reasons,
          "design_sex_invalid",
          "Las categorías de sexo del diseño deben tener etiquetas explícitas.",
          list(faculty_key = faculty_key)
        )
      }
      if (!is.null(cells[[sex_key]])) {
        reasons <- .cm_dist_add_reason(
          reasons,
          "design_cell_duplicate",
          "Cada categoría de sexo debe aparecer una sola vez por facultad.",
          list(faculty_key = faculty_key, sex_key = sex_key)
        )
        next
      }
      population_cell_n <- .cm_dist_exact_int(sex_spec$n)
      sample_cell_row <- sub_result$rows[[paste(faculty_key, sex_key, sep = "::")]]
      sample_cell_n <- if (is.list(sample_cell_row)) {
        .cm_dist_exact_int(sample_cell_row$n)
      } else {
        NA_integer_
      }
      if (is.na(population_cell_n) || is.na(sample_cell_n)) {
        reasons <- .cm_dist_add_reason(
          reasons,
          "design_cell_count_invalid",
          "Cada celda del diseño debe declarar población y cuota enteras.",
          list(faculty_key = faculty_key, sex_key = sex_key)
        )
      }
      cells[[sex_key]] <- list(
        sex_key = sex_key,
        sex_label = .cm_dist_sex_label(sex_label),
        population_design_n = population_cell_n,
        sample_n = sample_cell_n
      )
    }
    cells <- cells[sort(names(cells))]

    divisor_row <- aulas_result$rows[[faculty_key]]
    divisor <- if (is.list(divisor_row)) {
      .cm_dist_num(divisor_row$avg_conglomerado)
    } else {
      NA_real_
    }
    tau <- if (is.list(divisor_row)) .cm_dist_num(divisor_row$tau) else NA_real_
    divisor_audit <- if (is.list(divisor_row)) {
      divisor_row$alumnos_por_ch %||% list()
    } else {
      list()
    }
    signed_divisor <- .cm_dist_num(divisor_audit$valor)
    if (is.list(divisor_row)) {
      ch_population_n <- .cm_dist_exact_int(divisor_row$N)
      ch_sample_n <- .cm_dist_exact_int(divisor_row$cuota)
      if (is.na(ch_population_n) ||
          !identical(ch_population_n, population_design_n)) {
        reasons <- .cm_dist_add_reason(
          reasons,
          "design_divisor_population_mismatch",
          "La población de la fila CH debe coincidir con la facultad del diseño.",
          list(
            faculty_key = faculty_key,
            expected = population_design_n,
            actual = ch_population_n
          )
        )
      }
      if (is.na(ch_sample_n) || !identical(ch_sample_n, sample_n)) {
        reasons <- .cm_dist_add_reason(
          reasons,
          "design_divisor_quota_mismatch",
          "La cuota de la fila CH debe coincidir con la distribución calculada.",
          list(
            faculty_key = faculty_key,
            expected = sample_n,
            actual = ch_sample_n
          )
        )
      }
      ch_required <- .cm_dist_ch_required_one(ch_sample_n, divisor, tau)
      ch_base <- .cm_dist_exact_int(divisor_row$aulas_base)
      if (is.na(ch_required) || is.na(ch_base) ||
          !identical(ch_base, ch_required)) {
        reasons <- .cm_dist_add_reason(
          reasons,
          "design_divisor_ch_required_mismatch",
          "Las aulas base deben derivarse de cuota, divisor y tau acreditados.",
          list(
            faculty_key = faculty_key,
            expected = ch_required,
            actual = ch_base,
            quota = ch_sample_n,
            divisor = divisor,
            tau = tau
          )
        )
      }
      signed_faculty_key <- .cm_dist_faculty_key(divisor_audit$faculty_key)
      if (!identical(signed_faculty_key, faculty_key)) {
        reasons <- .cm_dist_add_reason(
          reasons,
          "signed_divisor_faculty_mismatch",
          "La firma Alumnos/CH debe acreditar la misma facultad que su fila.",
          list(
            faculty_key = faculty_key,
            signed_faculty_key = signed_faculty_key
          )
        )
      }
    }
    if (!is.finite(divisor) || divisor <= 0 || !is.finite(tau) || tau <= 0 ||
        !is.finite(signed_divisor) || signed_divisor <= 0 ||
        !nzchar(as.character(divisor_audit$frame_hash %||% ""))) {
      reasons <- .cm_dist_add_reason(
        reasons,
        "signed_divisor_missing",
        "La sensibilidad requiere el divisor Alumnos/CH firmado por facultad.",
        list(faculty_key = faculty_key)
      )
    }
    if (is.finite(divisor) && divisor > 0 &&
        is.finite(signed_divisor) && signed_divisor > 0 &&
        abs(divisor - signed_divisor) > .cm_dist_divisor_tolerance) {
      reasons <- .cm_dist_add_reason(
        reasons,
        "signed_divisor_mismatch",
        "El divisor operativo no coincide con el valor firmado por Alumnos/CH.",
        list(
          faculty_key = faculty_key,
          operational_value = divisor,
          signed_value = signed_divisor,
          tolerance = .cm_dist_divisor_tolerance
        )
      )
    }

    records[[faculty_key]] <- list(
      faculty_key = faculty_key,
      faculty_label = faculty_label,
      population_design_n = population_design_n,
      sample_n = sample_n,
      achieved_e = if (is.list(sample_row)) {
        .cm_dist_num(sample_row$precision_e)
      } else {
        NA_real_
      },
      estrato = estrato,
      cells = cells,
      divisor = divisor,
      tau = tau,
      divisor_audit = list(
        frame_hash = as.character(divisor_audit$frame_hash %||% ""),
        estadistico = as.character(divisor_audit$estadistico %||% ""),
        valor = signed_divisor
      )
    )
  }
  records <- records[sort(names(records))]

  expected_faculty_keys <- names(records)
  extra_divisor_rows <- setdiff(names(aulas_result$rows), expected_faculty_keys)
  if (length(extra_divisor_rows)) {
    reasons <- .cm_dist_add_reason(
      reasons,
      "design_divisor_extra",
      "La salida CH contiene facultades ajenas a la distribución.",
      list(faculty_keys = as.list(extra_divisor_rows))
    )
  }
  missing_divisor_rows <- setdiff(expected_faculty_keys, names(aulas_result$rows))
  if (length(missing_divisor_rows)) {
    reasons <- .cm_dist_add_reason(
      reasons,
      "design_divisor_missing",
      "La salida CH no cubre todas las facultades de la distribución.",
      list(faculty_keys = as.list(missing_divisor_rows))
    )
  }
  extra_faculty_rows <- setdiff(names(faculty_result$rows), expected_faculty_keys)
  if (length(extra_faculty_rows)) {
    reasons <- .cm_dist_add_reason(
      reasons,
      "design_faculty_result_extra",
      "La salida calculada contiene facultades ajenas al diseño.",
      list(faculty_keys = as.list(extra_faculty_rows))
    )
  }
  expected_cell_keys <- unlist(lapply(records, function(record) {
    paste(record$faculty_key, names(record$cells), sep = "::")
  }), use.names = FALSE)
  extra_cell_rows <- setdiff(names(sub_result$rows), expected_cell_keys)
  if (length(extra_cell_rows)) {
    reasons <- .cm_dist_add_reason(
      reasons,
      "design_cell_result_extra",
      "La salida calculada contiene celdas ajenas al diseño.",
      list(keys = as.list(extra_cell_rows))
    )
  }

  list(records = records, reasons = reasons)
}

.cm_dist_sum_int <- function(values) {
  values <- as.integer(values)
  if (!length(values) || anyNA(values)) return(NA_integer_)
  as.integer(sum(values))
}

.cm_dist_population_canonical <- function(parsed) {
  lapply(parsed$records, function(record) {
    list(
      faculty_key = record$faculty_key,
      faculty_label = record$faculty_label,
      population_frame_n = record$population_frame_n,
      cells = lapply(record$cells, function(cell) list(
        sex_key = cell$sex_key,
        sex_label = cell$sex_label,
        population_frame_n = cell$population_frame_n
      ))
    )
  })
}

.cm_dist_design_canonical <- function(component, parsed, source_frame_hash) {
  list(
    component_id = component$id,
    actor_id = component$actor_id,
    technique = component$tecnica,
    source_frame_hash = source_frame_hash,
    parameters = component$parametros,
    target = component$meta,
    n_target = component$resultado$n_objetivo,
    records = lapply(parsed$records, function(record) {
      list(
        faculty_key = record$faculty_key,
        population_design_n = record$population_design_n,
        sample_n = record$sample_n,
        cells = lapply(record$cells, function(cell) list(
          sex_key = cell$sex_key,
          population_design_n = cell$population_design_n,
          sample_n = cell$sample_n
        )),
        divisor = record$divisor,
        tau = record$tau,
        divisor_audit = record$divisor_audit
      )
    })
  )
}

.cm_dist_precision_band <- function(achieved_e) {
  if (!is.finite(achieved_e)) {
    return(list(key = "unavailable", label = "No disponible"))
  }
  if (achieved_e <= 0.03) return(list(key = "le_3pp", label = "≤ 3 pp"))
  if (achieved_e <= 0.05) return(list(key = "3_5pp", label = "3–5 pp"))
  if (achieved_e <= 0.07) return(list(key = "5_7pp", label = "5–7 pp"))
  list(key = "gt_7pp", label = "> 7 pp")
}

.cm_dist_confidence_from_z <- function(z) {
  if (!is.finite(z) || z <= 0) return(NA_real_)
  as.numeric(2 * stats::pnorm(z) - 1)
}

.cm_dist_precision <- function(component, record, scenario) {
  par <- component$parametros
  if (identical(scenario, "p1_universidad")) {
    target_e <- .cm_dist_num(par$e)
    # P1 promete formalmente solo el margen global que ya vive en
    # resultado$precision_alcanzada. Cada fila conserva aquí el diagnóstico
    # propio de su cuota; scope evita presentarlo como inferencia facultativa.
    achieved_e <- record$achieved_e
    z <- .cm_dist_num(par$z)
    p <- .cm_dist_num(par$p)
    scope <- "global_diagnostic"
  } else {
    target_e <- .cm_dist_num(record$estrato$e_facultad %||% par$e)
    achieved_e <- record$achieved_e
    z <- .cm_z_estrato(record$estrato, par$z)
    p <- .cm_dist_num(record$estrato$p_facultad)
    if (!is.finite(p)) p <- .cm_dist_num(par$p)
    scope <- "faculty_formal"
  }
  deff <- .cm_dist_num(par$deff)
  band <- .cm_dist_precision_band(achieved_e)
  list(
    scope = scope,
    target_e = target_e,
    achieved_e = achieved_e,
    confidence = .cm_dist_confidence_from_z(z),
    p = p,
    deff = deff,
    band_key = band$key,
    band_label = band$label,
    meets_target = if (is.finite(target_e) && is.finite(achieved_e)) {
      isTRUE(achieved_e <= target_e + 1e-12)
    } else {
      NA
    }
  )
}

.cm_dist_precision_issues <- function(precision, scenario) {
  issues <- character()
  expected_scope <- if (identical(scenario, "p1_universidad")) {
    "global_diagnostic"
  } else {
    "faculty_formal"
  }
  if (!identical(precision$scope, expected_scope)) {
    issues <- c(issues, "scope")
  }

  valid_nonnegative <- function(value) {
    is.numeric(value) && length(value) == 1L && is.finite(value) && value >= 0
  }
  valid_positive <- function(value) {
    is.numeric(value) && length(value) == 1L && is.finite(value) && value > 0
  }
  if (!valid_nonnegative(precision$target_e) || precision$target_e > 1) {
    issues <- c(issues, "target_e")
  }
  if (!valid_nonnegative(precision$achieved_e) || precision$achieved_e > 1) {
    issues <- c(issues, "achieved_e")
  }
  if (!valid_positive(precision$confidence) || precision$confidence > 1) {
    issues <- c(issues, "confidence")
  }
  if (!valid_nonnegative(precision$p) || precision$p > 1) {
    issues <- c(issues, "p")
  }
  if (!valid_positive(precision$deff)) {
    issues <- c(issues, "deff")
  }

  if (valid_nonnegative(precision$achieved_e)) {
    expected_band <- .cm_dist_precision_band(precision$achieved_e)
    if (!identical(precision$band_key, expected_band$key)) {
      issues <- c(issues, "band_key")
    }
    if (!identical(precision$band_label, expected_band$label)) {
      issues <- c(issues, "band_label")
    }
  } else if (!identical(precision$band_key, "unavailable") ||
      !identical(precision$band_label, "No disponible")) {
    issues <- c(issues, "band")
  }

  if (!is.logical(precision$meets_target) ||
      length(precision$meets_target) != 1L || is.na(precision$meets_target)) {
    issues <- c(issues, "meets_target")
  } else if (valid_nonnegative(precision$target_e) &&
      valid_nonnegative(precision$achieved_e) &&
      !identical(
        precision$meets_target,
        isTRUE(precision$achieved_e <= precision$target_e + 1e-12)
      )) {
    issues <- c(issues, "meets_target")
  }
  unique(issues)
}

.cm_dist_uniform_value <- function(values) {
  values <- suppressWarnings(as.numeric(values))
  if (!length(values) || any(!is.finite(values))) return(NA_real_)
  if (max(values) - min(values) > 1e-12) return(NA_real_)
  as.numeric(values[[1L]])
}

.cm_dist_formula_quotas <- function(component, scenario, parameter = NULL,
                                    value = NA_real_) {
  par <- component$parametros
  estratos <- component$marco$estratos %||% list()
  if (!length(estratos)) return(integer())

  if (identical(scenario, "p1_universidad")) {
    N <- .cm_dist_exact_int(component$marco$marco_validado)
    p <- par$p
    z <- par$z
    e <- par$e
    deff <- par$deff
    if (identical(parameter, "p")) p <- value
    if (identical(parameter, "confidence")) {
      z <- stats::qnorm(1 - (1 - value) / 2)
    }
    if (identical(parameter, "e")) e <- value
    if (identical(parameter, "deff")) deff <- value
    n <- tryCatch(
      calc_n_muestra(N = N, p = p, z = z, e = e, deff = deff),
      error = function(error) NA_integer_
    )
    if (is.na(n)) return(stats::setNames(rep(NA_integer_, length(estratos)),
                                        vapply(estratos, function(estrato) {
                                          .cm_dist_faculty_key(estrato$label)
                                        }, character(1))))
    weights <- vapply(estratos, function(estrato) {
      .cm_dist_exact_int(estrato$N)
    }, integer(1))
    quotas <- distribuir_proporcional_pesos(
      n,
      weights,
      redondeo = "round_residuo_controlado"
    )
    names(quotas) <- vapply(estratos, function(estrato) {
      .cm_dist_faculty_key(estrato$label)
    }, character(1))
    return(quotas)
  }

  quotas <- vapply(estratos, function(estrato) {
    p <- .cm_dist_num(estrato$p_facultad)
    if (!is.finite(p)) p <- par$p
    z <- .cm_z_estrato(estrato, par$z)
    e <- .cm_dist_num(estrato$e_facultad %||% par$e)
    deff <- par$deff
    if (identical(parameter, "p")) p <- value
    if (identical(parameter, "confidence")) {
      z <- stats::qnorm(1 - (1 - value) / 2)
    }
    if (identical(parameter, "e")) e <- value
    if (identical(parameter, "deff")) deff <- value
    tryCatch(
      calc_n_muestra(
        N = estrato$N,
        p = p,
        z = z,
        e = e,
        deff = deff
      ),
      error = function(error) NA_integer_
    )
  }, integer(1))
  names(quotas) <- vapply(estratos, function(estrato) {
    .cm_dist_faculty_key(estrato$label)
  }, character(1))
  quotas
}

.cm_dist_ch_required <- function(quotas, records) {
  if (!length(quotas) || anyNA(quotas)) return(NA_integer_)
  faculty_keys <- names(quotas)
  if (is.null(faculty_keys) || !setequal(faculty_keys, names(records))) {
    return(NA_integer_)
  }
  values <- vapply(faculty_keys, function(faculty_key) {
    record <- records[[faculty_key]]
    .cm_dist_ch_required_one(
      quotas[[faculty_key]],
      record$divisor,
      record$tau
    )
  }, integer(1))
  if (anyNA(values)) return(NA_integer_)
  as.integer(sum(values))
}

.cm_dist_sensitivity <- function(component, parsed, scenario) {
  estratos <- component$marco$estratos %||% list()
  par <- component$parametros
  baseline_quotas <- .cm_dist_formula_quotas(component, scenario)
  baseline_n <- .cm_dist_sum_int(baseline_quotas)
  target_quotas <- vapply(parsed$records, function(record) {
    record$sample_n
  }, integer(1))
  baseline_target <- .cm_dist_exact_int(component$resultado$n_objetivo)
  # Dos referencias deliberadas: el baseline del bloque resume la META
  # vigente (por eso sus CH usan target_quotas); el punto baseline de cada eje
  # representa la FÓRMULA vigente y permite comparar OFAT contra baseline_n.
  baseline_ch <- .cm_dist_ch_required(target_quotas, parsed$records)

  p_values <- vapply(estratos, function(estrato) {
    value <- .cm_dist_num(estrato$p_facultad)
    if (is.finite(value)) value else par$p
  }, numeric(1))
  confidence_values <- vapply(estratos, function(estrato) {
    .cm_dist_confidence_from_z(.cm_z_estrato(estrato, par$z))
  }, numeric(1))
  e_values <- vapply(estratos, function(estrato) {
    .cm_dist_num(estrato$e_facultad %||% par$e)
  }, numeric(1))
  deff_values <- rep(.cm_dist_num(par$deff), length(estratos))
  if (identical(scenario, "p1_universidad")) {
    p_values <- par$p
    confidence_values <- .cm_dist_confidence_from_z(par$z)
    e_values <- par$e
    deff_values <- par$deff
  }

  make_point <- function(parameter, key, label, value, baseline = FALSE) {
    quotas <- if (baseline) {
      baseline_quotas
    } else {
      .cm_dist_formula_quotas(component, scenario, parameter, value)
    }
    n_required <- .cm_dist_sum_int(quotas)
    list(
      key = key,
      label = label,
      value = as.numeric(value),
      n_required = n_required,
      delta_n = if (!is.na(n_required) && !is.na(baseline_n)) {
        as.integer(n_required - baseline_n)
      } else {
        NA_integer_
      },
      ch_required = .cm_dist_ch_required(quotas, parsed$records)
    )
  }
  make_axis <- function(parameter, label, baseline_value, fixed) {
    baseline_label <- if (is.finite(baseline_value)) {
      "Fórmula vigente"
    } else {
      "Fórmula vigente (mixto)"
    }
    points <- list(make_point(
      parameter,
      "baseline",
      baseline_label,
      baseline_value,
      baseline = TRUE
    ))
    for (spec in fixed) {
      points[[length(points) + 1L]] <- make_point(
        parameter,
        spec$key,
        spec$label,
        spec$value
      )
    }
    list(parameter = parameter, label = label, points = points)
  }

  list(
    kind = "one_factor_at_a_time",
    baseline = list(
      n_formula = baseline_n,
      n_target = baseline_target,
      ch_required = baseline_ch
    ),
    axes = list(
      make_axis(
        "p",
        "Proporción esperada",
        .cm_dist_uniform_value(p_values),
        list(list(key = "p_0_5", label = "p = 0,50", value = 0.5))
      ),
      make_axis(
        "confidence",
        "Nivel de confianza",
        .cm_dist_uniform_value(confidence_values),
        list(
          list(key = "confidence_0_90", label = "90 %", value = 0.90),
          list(key = "confidence_0_95", label = "95 %", value = 0.95),
          list(key = "confidence_0_99", label = "99 %", value = 0.99)
        )
      ),
      make_axis(
        "deff",
        "Efecto de diseño",
        .cm_dist_uniform_value(deff_values),
        list(list(key = "deff_1", label = "deff = 1", value = 1))
      ),
      make_axis(
        "e",
        "Margen de error",
        .cm_dist_uniform_value(e_values),
        list(
          list(key = "e_0_025", label = "2,5 pp", value = 0.025),
          list(key = "e_0_05", label = "5 pp", value = 0.05),
          list(key = "e_0_07", label = "7 pp", value = 0.07),
          list(key = "e_0_10", label = "10 pp", value = 0.10)
        )
      )
    )
  )
}

.cm_dist_sensitivity_complete <- function(sensitivity) {
  baseline <- sensitivity$baseline
  if (anyNA(c(baseline$n_formula, baseline$n_target, baseline$ch_required))) {
    return(FALSE)
  }
  points <- unlist(lapply(sensitivity$axes, `[[`, "points"), recursive = FALSE)
  all(vapply(points, function(point) {
    !anyNA(c(point$n_required, point$delta_n, point$ch_required))
  }, logical(1)))
}

.cm_dist_combine_faculties <- function(component, frame_parsed, design_parsed,
                                       scenario) {
  faculty_keys <- sort(union(
    names(frame_parsed$records),
    names(design_parsed$records)
  ))
  lapply(faculty_keys, function(faculty_key) {
    frame_record <- frame_parsed$records[[faculty_key]]
    design_record <- design_parsed$records[[faculty_key]]
    sex_keys <- sort(union(
      names(frame_record$cells %||% list()),
      names(design_record$cells %||% list())
    ))
    sample_faculty_n <- if (is.list(design_record)) {
      design_record$sample_n
    } else {
      NA_integer_
    }
    cells <- lapply(sex_keys, function(sex_key) {
      frame_cell <- frame_record$cells[[sex_key]]
      design_cell <- design_record$cells[[sex_key]]
      population_design_n <- if (is.list(design_cell)) {
        design_cell$population_design_n
      } else {
        NA_integer_
      }
      sample_n <- if (is.list(design_cell)) design_cell$sample_n else NA_integer_
      allocation_raw <- if (is.list(design_record) &&
          !is.na(sample_faculty_n) && !is.na(population_design_n) &&
          is.finite(design_record$population_design_n) &&
          design_record$population_design_n > 0) {
        sample_faculty_n * population_design_n /
          design_record$population_design_n
      } else {
        NA_real_
      }
      list(
        sex_key = sex_key,
        sex_label = if (is.list(frame_cell)) {
          frame_cell$sex_label
        } else if (is.list(design_cell)) {
          design_cell$sex_label
        } else {
          ""
        },
        population_frame_n = if (is.list(frame_cell)) {
          frame_cell$population_frame_n
        } else {
          NA_integer_
        },
        population_design_n = population_design_n,
        sample_n = sample_n,
        allocation_raw = allocation_raw,
        rounding_delta = if (!is.na(sample_n) && is.finite(allocation_raw)) {
          as.numeric(sample_n - allocation_raw)
        } else {
          NA_real_
        }
      )
    })
    names(cells) <- NULL
    list(
      faculty_key = faculty_key,
      faculty_label = if (is.list(frame_record)) {
        frame_record$faculty_label
      } else if (is.list(design_record)) {
        design_record$faculty_label
      } else {
        ""
      },
      population_frame_n = if (is.list(frame_record)) {
        frame_record$population_frame_n
      } else {
        NA_integer_
      },
      population_design_n = if (is.list(design_record)) {
        design_record$population_design_n
      } else {
        NA_integer_
      },
      sample_n = sample_faculty_n,
      precision = if (is.list(design_record)) {
        .cm_dist_precision(component, design_record, scenario)
      } else {
        list(
          scope = if (identical(scenario, "p1_universidad")) {
            "global_diagnostic"
          } else {
            "faculty_formal"
          },
          target_e = NA_real_, achieved_e = NA_real_, confidence = NA_real_,
          p = NA_real_, deff = NA_real_, band_key = "unavailable",
          band_label = "No disponible", meets_target = NA
        )
      },
      cells = cells
    )
  })
}

#' Construye el contrato agregado de distribución universitaria para P1/P2.
#'
#' El bundle siempre conserva auditoría. Solo `status = "ready"` habilita su
#' publicación: cualquier fuente stale, conjunto desigual, duplicado, fracción
#' o suma divergente vuelve incompatible al objeto completo.
calc_muestra_distribucion_construir <- function(component, frame) {
  scenario <- unname(.cm_dist_components[[component$actor_id]])
  if (is.null(scenario) || !nzchar(scenario)) return(NULL)

  result <- component$resultado %||% list()
  source_frame_hash <- as.character(
    (result$alumnos_por_ch_decision %||% list())$frame_hash %||% ""
  )
  current_frame_hash <- if (is.list(frame)) {
    as.character(frame$frame_hash %||% "")
  } else {
    ""
  }
  reasons <- list()
  if (!nzchar(source_frame_hash)) {
    reasons <- .cm_dist_add_reason(
      reasons,
      "source_frame_hash_missing",
      "El resultado no conserva la firma de la decisión Alumnos/CH."
    )
  }
  if (!nzchar(current_frame_hash)) {
    reasons <- .cm_dist_add_reason(
      reasons,
      "current_frame_hash_missing",
      "No existe un marco vigente con hash verificable."
    )
  } else if (nzchar(source_frame_hash) &&
      !identical(source_frame_hash, current_frame_hash)) {
    reasons <- .cm_dist_add_reason(
      reasons,
      "source_frame_stale",
      "La distribución fue calculada con una decisión de marco anterior.",
      list(
        source_frame_hash = source_frame_hash,
        current_frame_hash = current_frame_hash
      )
    )
  }

  frame_parsed <- .cm_dist_frame_records(frame %||% list())
  design_parsed <- .cm_dist_design_records(component)
  reasons <- c(reasons, frame_parsed$reasons, design_parsed$reasons)

  frame_faculty_keys <- names(frame_parsed$records)
  design_faculty_keys <- names(design_parsed$records)
  if (!setequal(frame_faculty_keys, design_faculty_keys)) {
    reasons <- .cm_dist_add_reason(
      reasons,
      "faculty_set_mismatch",
      "Marco y diseño deben cubrir exactamente las mismas facultades.",
      list(
        missing_in_design = as.list(setdiff(frame_faculty_keys, design_faculty_keys)),
        missing_in_frame = as.list(setdiff(design_faculty_keys, frame_faculty_keys))
      )
    )
  }
  for (faculty_key in intersect(frame_faculty_keys, design_faculty_keys)) {
    frame_sex_keys <- names(frame_parsed$records[[faculty_key]]$cells)
    design_sex_keys <- names(design_parsed$records[[faculty_key]]$cells)
    if (!setequal(frame_sex_keys, design_sex_keys)) {
      reasons <- .cm_dist_add_reason(
        reasons,
        "sex_set_mismatch",
        "Marco y diseño deben cubrir exactamente las mismas categorías de sexo.",
        list(
          faculty_key = faculty_key,
          missing_in_design = as.list(setdiff(frame_sex_keys, design_sex_keys)),
          missing_in_frame = as.list(setdiff(design_sex_keys, frame_sex_keys))
        )
      )
    }
  }

  frame_population_sum <- .cm_dist_sum_int(vapply(
    frame_parsed$records,
    `[[`,
    integer(1),
    "population_frame_n"
  ))
  design_population_sum <- .cm_dist_sum_int(vapply(
    design_parsed$records,
    `[[`,
    integer(1),
    "population_design_n"
  ))
  sample_sum <- .cm_dist_sum_int(vapply(
    design_parsed$records,
    `[[`,
    integer(1),
    "sample_n"
  ))
  frame_cell_sum <- .cm_dist_sum_int(unlist(lapply(
    frame_parsed$records,
    function(record) vapply(record$cells, `[[`, integer(1), "population_frame_n")
  ), use.names = FALSE))
  design_cell_sum <- .cm_dist_sum_int(unlist(lapply(
    design_parsed$records,
    function(record) vapply(record$cells, `[[`, integer(1), "population_design_n")
  ), use.names = FALSE))
  sample_cell_sum <- .cm_dist_sum_int(unlist(lapply(
    design_parsed$records,
    function(record) vapply(record$cells, `[[`, integer(1), "sample_n")
  ), use.names = FALSE))

  if (!is.na(frame_parsed$expected_n) &&
      !identical(frame_population_sum, frame_parsed$expected_n)) {
    reasons <- .cm_dist_add_reason(
      reasons,
      "population_frame_sum_mismatch",
      "Las celdas facultad por sexo no cubren toda la población agregada del marco.",
      list(
        cell_sum = frame_population_sum,
        expected = frame_parsed$expected_n
      )
    )
  }
  design_expected <- .cm_dist_exact_int(component$marco$marco_validado)
  if (is.na(design_expected) || !identical(design_population_sum, design_expected)) {
    reasons <- .cm_dist_add_reason(
      reasons,
      "population_design_sum_mismatch",
      "La suma de facultades no coincide con el marco validado del diseño.",
      list(sum = design_population_sum, expected = design_expected)
    )
  }
  sample_expected <- .cm_dist_exact_int(result$n_objetivo)
  if (is.na(sample_expected) || !identical(sample_sum, sample_expected)) {
    reasons <- .cm_dist_add_reason(
      reasons,
      "sample_sum_mismatch",
      "La suma de cuotas por facultad no coincide con el objetivo del diseño.",
      list(sum = sample_sum, expected = sample_expected)
    )
  }
  if (!identical(frame_cell_sum, frame_population_sum)) {
    reasons <- .cm_dist_add_reason(
      reasons,
      "cell_population_frame_sum_mismatch",
      "Las celdas del marco no cierran contra sus facultades."
    )
  }
  if (!identical(design_cell_sum, design_population_sum)) {
    reasons <- .cm_dist_add_reason(
      reasons,
      "cell_population_design_sum_mismatch",
      "Las celdas del diseño no cierran contra sus facultades."
    )
  }
  if (!identical(sample_cell_sum, sample_sum)) {
    reasons <- .cm_dist_add_reason(
      reasons,
      "cell_sample_sum_mismatch",
      "Las cuotas por sexo no cierran contra sus facultades."
    )
  }
  for (record in design_parsed$records) {
    design_row_sum <- .cm_dist_sum_int(vapply(
      record$cells, `[[`, integer(1), "population_design_n"
    ))
    sample_row_sum <- .cm_dist_sum_int(vapply(
      record$cells, `[[`, integer(1), "sample_n"
    ))
    if (!identical(design_row_sum, record$population_design_n)) {
      reasons <- .cm_dist_add_reason(
        reasons,
        "faculty_population_design_sum_mismatch",
        "La población por sexo no cierra dentro de una facultad.",
        list(faculty_key = record$faculty_key)
      )
    }
    if (!identical(sample_row_sum, record$sample_n)) {
      reasons <- .cm_dist_add_reason(
        reasons,
        "faculty_sample_sum_mismatch",
        "La cuota por sexo no cierra dentro de una facultad.",
        list(faculty_key = record$faculty_key)
      )
    }
    audit_hash <- as.character(record$divisor_audit$frame_hash %||% "")
    if (nzchar(source_frame_hash) && !identical(audit_hash, source_frame_hash)) {
      reasons <- .cm_dist_add_reason(
        reasons,
        "signed_divisor_stale",
        "El divisor Alumnos/CH no está firmado por el mismo marco fuente.",
        list(faculty_key = record$faculty_key)
      )
    }
  }

  sensitivity <- .cm_dist_sensitivity(component, design_parsed, scenario)
  if (!.cm_dist_sensitivity_complete(sensitivity)) {
    reasons <- .cm_dist_add_reason(
      reasons,
      "sensitivity_incomplete",
      "No se pudo calcular toda la sensibilidad con el divisor firmado."
    )
  }
  faculties <- .cm_dist_combine_faculties(
    component,
    frame_parsed,
    design_parsed,
    scenario
  )
  precision_invalid <- Filter(
    function(item) length(item$fields) > 0L,
    lapply(faculties, function(faculty) {
      list(
        faculty_key = faculty$faculty_key,
        fields = as.list(.cm_dist_precision_issues(faculty$precision, scenario))
      )
    })
  )
  if (length(precision_invalid)) {
    reasons <- .cm_dist_add_reason(
      reasons,
      "faculty_precision_invalid",
      "La precisión por facultad está incompleta o fuera del contrato.",
      list(faculties = unname(precision_invalid))
    )
  }
  sex_cell_n <- as.integer(sum(vapply(
    faculties,
    function(faculty) length(faculty$cells),
    integer(1)
  )))
  frame_design_delta <- if (!is.na(frame_population_sum) &&
      !is.na(design_population_sum)) {
    # Convención única del contrato y la UI: diseño menos frame.
    as.integer(design_population_sum - frame_population_sum)
  } else {
    NA_integer_
  }
  reconciliation <- list(
    ok = length(reasons) == 0L,
    population_frame_sum = frame_population_sum,
    population_design_sum = design_population_sum,
    sample_sum = sample_sum,
    cell_population_frame_sum = frame_cell_sum,
    cell_population_design_sum = design_cell_sum,
    cell_sample_sum = sample_cell_sum,
    frame_design_delta = frame_design_delta,
    reasons = reasons
  )

  list(
    schema = .cm_dist_schema,
    owner = .cm_dist_owner,
    component_id = component$id,
    actor_id = component$actor_id,
    scenario = scenario,
    technique = component$tecnica,
    source_frame_hash = source_frame_hash,
    population_hash = .cm_aulas_hash(list(
      expected_n = frame_parsed$expected_n,
      records = .cm_dist_population_canonical(frame_parsed)
    )),
    design_hash = .cm_aulas_hash(
      .cm_dist_design_canonical(component, design_parsed, source_frame_hash)
    ),
    computed_at = as.character(
      result$computado_at %||% format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
    ),
    grain = "facultad_efectiva_x_sexo",
    population_unit = "estudiante_unico_elegible",
    sample_unit = "cuota_objetivo_estudiante",
    sample_stage = "planificada",
    status = if (isTRUE(reconciliation$ok)) "ready" else "incompatible",
    reasons = reasons,
    totals = list(
      population_frame_n = frame_population_sum,
      population_design_n = design_population_sum,
      sample_n = sample_sum,
      faculty_n = as.integer(length(faculties)),
      sex_cell_n = sex_cell_n
    ),
    faculties = faculties,
    sensitivity = sensitivity,
    reconciliation = reconciliation
  )
}

#' Adjunta la distribución agregada a los resultados universitarios P1/P2.
calc_muestra_distribucion_adjuntar_estudio <- function(estudio, frame = NULL) {
  if (!is.list(estudio) || !is.list(estudio$componentes)) return(estudio)
  for (i in seq_along(estudio$componentes)) {
    component <- estudio$componentes[[i]]
    if (!component$actor_id %in% names(.cm_dist_components) ||
        !is.list(component$resultado)) next
    component$resultado$distribucion_universitaria <-
      calc_muestra_distribucion_construir(component, frame)
    estudio$componentes[[i]] <- component
  }
  estudio
}

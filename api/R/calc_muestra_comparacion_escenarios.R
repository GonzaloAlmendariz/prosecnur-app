# Contrato I20: comparación acreditada P1↔P2 (calc_muestra_comparacion_escenarios_v1).
#
# Owner único del snapshot que consume el normalizador estricto del frontend
# (frontend/src/api/calcMuestraComparacionI20.ts). El snapshot se construye UNA
# sola vez desde los resultados ya calculados de los componentes universitarios
# y se estampa IDÉNTICO en `resultado$comparacion_escenarios` de P1 y P2: el
# TS exige serializaciones byte-iguales en ambos carriers. Aquí no se
# recalcula ninguna fórmula muestral: sample_n, la carga CH y la precisión
# salen del engine y del bundle de distribución I19
# (`calc_muestra_distribucion.R`), que ya reconcilió sumas, divisores firmados
# y frescura del marco. Un resultado calculado antes de este contrato
# simplemente no lleva el carrier y el TS lo lee como legacy.

.cm_comp_i20_schema <- "calc_muestra_comparacion_escenarios_v1"
.cm_comp_i20_owner <- "engine_r"
.cm_comp_i20_scenarios <- c(
  estudiantes_universidad = "p1_universidad",
  estudiantes_facultad = "p2_facultades"
)

# Técnicas canónicas del modelo universitario. Los códigos de política de
# reserva publicados abajo describen la fórmula real de cada calculadora
# (conglomerado: extra explícita o ceiling(base * oversample_pct); dominios
# independientes: extra explícita o cero). Con otra técnica esos códigos
# serían una mentira, así que la comparación se declara incompatible.
.cm_comp_i20_tecnicas <- c(
  p1_universidad = "prob_conglomerado_multietapico",
  p2_facultades = "prob_estratificado_independiente"
)
.cm_comp_i20_reserve_policies <- c(
  p1_universidad = "explicit_or_faculty_oversample_pct",
  p2_facultades = "explicit_or_zero"
)

.cm_comp_i20_num <- function(value) {
  value <- suppressWarnings(as.numeric(unlist(value, use.names = FALSE)))
  if (length(value) != 1L || !is.finite(value)) return(NA_real_)
  value
}

# Extrae y valida el bloque de UN escenario desde el resultado ya calculado.
# Devuelve las razones estructuradas acumuladas y, solo si todo acredita, el
# bloque `scenario` con las claves EXACTAS que congela el normalizador TS.
.cm_comp_i20_scenario <- function(component, scenario) {
  reasons <- list()
  fail <- function(reasons, code, message, details = list()) {
    .cm_dist_add_reason(
      reasons, code, message, c(list(scenario = scenario), details)
    )
  }

  result <- component$resultado
  if (!is.list(result) || !length(result)) {
    return(list(
      ok = FALSE,
      reasons = fail(
        reasons,
        "scenario_result_missing",
        "Falta el resultado calculado de una de las dos propuestas."
      )
    ))
  }

  dist <- result$distribucion_universitaria
  dist_ok <- is.list(dist) &&
    identical(.cm_aulas_scalar(dist$schema, ""), .cm_dist_schema) &&
    identical(.cm_aulas_scalar(dist$scenario, ""), scenario)
  if (!dist_ok) {
    reasons <- fail(
      reasons,
      "scenario_distribution_missing",
      "El resultado no conserva el bundle de distribución I19 del escenario."
    )
  } else if (!identical(.cm_aulas_scalar(dist$status, ""), "ready")) {
    reasons <- fail(
      reasons,
      "scenario_distribution_not_ready",
      "La distribución I19 del escenario no está acreditada como ready.",
      list(distribution_reasons = lapply(
        dist$reasons %||% list(),
        function(reason) .cm_aulas_scalar(reason$code, "")
      ))
    )
  }

  tecnica <- .cm_aulas_scalar(component$tecnica, "")
  expected_tecnica <- unname(.cm_comp_i20_tecnicas[[scenario]])
  if (!identical(tecnica, expected_tecnica)) {
    reasons <- fail(
      reasons,
      "scenario_technique_unsupported",
      "La política de reserva publicada solo está firmada para la técnica canónica del escenario.",
      list(expected = expected_tecnica, actual = tecnica)
    )
  }

  component_id <- .cm_aulas_scalar(component$id, "")
  actor_id <- .cm_aulas_scalar(component$actor_id, "")
  design_hash <- if (dist_ok) .cm_aulas_scalar(dist$design_hash, "") else ""
  if (!nzchar(component_id) || !nzchar(actor_id) || !nzchar(design_hash)) {
    reasons <- fail(
      reasons,
      "scenario_identity_missing",
      "El escenario no publica identidad y firma de diseño verificables."
    )
  }

  sample_n <- .cm_dist_exact_int(result$n_objetivo)
  ch_base <- .cm_dist_exact_int(result$aulas_base_total)
  ch_reserve <- .cm_dist_exact_int(result$aulas_extra_total)
  ch_total <- .cm_dist_exact_int(result$aulas_total)
  if (anyNA(c(sample_n, ch_base, ch_reserve, ch_total)) ||
      !identical(ch_total, as.integer(ch_base + ch_reserve))) {
    reasons <- fail(
      reasons,
      "scenario_ch_load_unreconciled",
      "La carga CH del resultado no reconcilia titulares, reserva y saldo operativo."
    )
  }

  # Base CH firmada por facultad: divisor Alumnos/CH + tau. Es el guard
  # `same_divisor_tau_by_faculty` del delta causal de titulares.
  rows <- result$aulas_por_estrato
  rows <- if (is.list(rows)) Filter(is.list, rows) else list()
  basis <- list()
  basis_ok <- length(rows) > 0L
  cuota_sum <- 0L
  base_sum <- 0L
  reserve_sum <- 0L
  total_sum <- 0L
  for (row in rows) {
    audit <- if (is.list(row$alumnos_por_ch)) row$alumnos_por_ch else list()
    key <- .cm_aulas_scalar(audit$faculty_key, "")
    divisor <- .cm_comp_i20_num(audit$valor)
    tau <- .cm_comp_i20_num(row$tau)
    audit_hash <- .cm_aulas_scalar(audit$frame_hash, "")
    cuota <- .cm_dist_exact_int(row$cuota)
    row_base <- .cm_dist_exact_int(row$aulas_base)
    row_reserve <- .cm_dist_exact_int(row$aulas_reemplazo)
    row_total <- .cm_dist_exact_int(row$aulas_total)
    if (!nzchar(key) || !is.null(basis[[key]]) ||
        !is.finite(divisor) || divisor <= 0 ||
        !is.finite(tau) || tau <= 0 || !nzchar(audit_hash) ||
        anyNA(c(cuota, row_base, row_reserve, row_total))) {
      basis_ok <- FALSE
      next
    }
    cuota_sum <- cuota_sum + cuota
    base_sum <- base_sum + row_base
    reserve_sum <- reserve_sum + row_reserve
    total_sum <- total_sum + row_total
    basis[[key]] <- list(
      faculty_key = key,
      divisor = as.numeric(divisor),
      tau = as.numeric(tau),
      frame_hash = audit_hash
    )
  }
  if (!basis_ok || !length(basis)) {
    basis <- NULL
    reasons <- fail(
      reasons,
      "scenario_ch_basis_unavailable",
      "Cada facultad debe llevar su divisor Alumnos/CH firmado y su tau para poder comparar."
    )
  } else {
    basis <- basis[order(names(basis))]
    if (!anyNA(c(sample_n, ch_base, ch_reserve, ch_total)) && (
        !identical(as.integer(cuota_sum), sample_n) ||
        !identical(as.integer(base_sum), ch_base) ||
        !identical(as.integer(reserve_sum), ch_reserve) ||
        !identical(as.integer(total_sum), ch_total))) {
      reasons <- fail(
        reasons,
        "scenario_sums_mismatch",
        "Las filas CH del escenario no cierran contra los totales publicados."
      )
    }
  }

  formal <- NULL
  if (identical(scenario, "p1_universidad")) {
    population_n <- .cm_dist_exact_int((component$marco %||% list())$marco_validado)
    achieved_e <- .cm_comp_i20_num(result$precision_alcanzada)
    band <- .cm_dist_precision_band(achieved_e)
    if (is.na(population_n) || population_n <= 0L ||
        !is.finite(achieved_e) || achieved_e < 0 || achieved_e > 1 ||
        identical(band$key, "unavailable")) {
      reasons <- fail(
        reasons,
        "scenario_formal_precision_unavailable",
        "P1 no publica un margen global acreditado dentro de [0, 1]."
      )
    } else if (!is.na(sample_n)) {
      formal <- list(
        scope = "global_university_formal",
        formal_units = 1L,
        global = list(
          population_n = population_n,
          sample_n = sample_n,
          achieved_e = as.numeric(achieved_e),
          band = list(key = band$key, label = band$label)
        )
      )
    }
  } else {
    formal_units <- length(basis %||% list())
    if (formal_units > 0L) {
      formal <- list(
        scope = "independent_faculty_formal",
        formal_units = as.integer(formal_units),
        # NA serializa como `null` bajo el serializer unboxed; un NULL
        # nombrado emitiría `{}` y rompería el `global === null` del TS.
        global = NA
      )
    } else {
      reasons <- fail(
        reasons,
        "scenario_formal_precision_unavailable",
        "P2 no publica unidades formales independientes por facultad."
      )
    }
  }

  ok <- length(reasons) == 0L && !is.null(formal)
  list(
    ok = ok,
    reasons = reasons,
    source_frame_hash = if (dist_ok) .cm_aulas_scalar(dist$source_frame_hash, "") else "",
    population_hash = if (dist_ok) .cm_aulas_scalar(dist$population_hash, "") else "",
    basis = basis,
    scenario = if (ok) list(
      component_id = component_id,
      actor_id = actor_id,
      scenario = scenario,
      technique = tecnica,
      design_hash = design_hash,
      ch_basis_hash = .cm_aulas_hash(basis),
      sample_n = sample_n,
      ch = list(
        base_required = ch_base,
        reserve_required = ch_reserve,
        total_operational = ch_total,
        reserve_policy_code = unname(.cm_comp_i20_reserve_policies[[scenario]])
      ),
      formal_precision = formal
    ) else NULL
  )
}

#' Construye el snapshot único de comparación P1↔P2 (schema I20 v1).
#'
#' Siempre devuelve el objeto con las 14 claves congeladas del contrato. Solo
#' `status = "ready"` publica escenarios y deltas; cualquier defecto (marco
#' distinto, base CH no compartida, resultado de uno solo, distribución no
#' acreditada) produce `status = "incompatible"` con razones estructuradas
#' `{code, message, details}` que el frontend muestra tal cual.
calc_muestra_comparacion_construir <- function(componentes, frame = NULL) {
  reasons <- list()
  componentes <- if (is.list(componentes)) Filter(is.list, componentes) else list()
  actor_ids <- vapply(
    componentes,
    function(comp) .cm_aulas_scalar(comp$actor_id, ""),
    character(1)
  )
  current_frame_hash <- if (is.list(frame)) {
    .cm_aulas_scalar(frame$frame_hash, "")
  } else {
    ""
  }
  if (!nzchar(current_frame_hash)) {
    reasons <- .cm_dist_add_reason(
      reasons,
      "current_frame_missing",
      "No existe un marco vigente con hash verificable para acreditar la comparación."
    )
  }

  per_scenario <- list()
  for (actor_id in names(.cm_comp_i20_scenarios)) {
    scenario <- unname(.cm_comp_i20_scenarios[[actor_id]])
    hits <- which(actor_ids == actor_id)
    if (length(hits) != 1L) {
      reasons <- .cm_dist_add_reason(
        reasons,
        if (!length(hits)) "scenario_component_missing" else "scenario_component_ambiguous",
        "La comparación requiere exactamente un componente por escenario.",
        list(
          scenario = scenario,
          actor_id = actor_id,
          matches = as.integer(length(hits))
        )
      )
      next
    }
    snapshot <- .cm_comp_i20_scenario(componentes[[hits]], scenario)
    reasons <- c(reasons, snapshot$reasons)
    per_scenario[[scenario]] <- snapshot
  }
  p1 <- per_scenario$p1_universidad
  p2 <- per_scenario$p2_facultades
  p1_ready <- isTRUE(p1$ok)
  p2_ready <- isTRUE(p2$ok)

  same_source_frame <- FALSE
  same_population <- FALSE
  same_faculty_inventory <- FALSE
  same_ch_basis <- FALSE
  if (p1_ready && p2_ready) {
    same_source_frame <- nzchar(p1$source_frame_hash) &&
      identical(p1$source_frame_hash, p2$source_frame_hash) &&
      identical(p1$source_frame_hash, current_frame_hash)
    if (!same_source_frame) {
      reasons <- .cm_dist_add_reason(
        reasons,
        if (identical(p1$source_frame_hash, p2$source_frame_hash)) {
          "source_frame_stale"
        } else {
          "source_frame_mismatch"
        },
        "P1 y P2 deben estar calculados sobre el mismo marco vigente.",
        list(
          p1_source_frame_hash = p1$source_frame_hash,
          p2_source_frame_hash = p2$source_frame_hash,
          current_frame_hash = current_frame_hash
        )
      )
    }
    same_population <- nzchar(p1$population_hash) &&
      identical(p1$population_hash, p2$population_hash)
    if (!same_population) {
      reasons <- .cm_dist_add_reason(
        reasons,
        "population_mismatch",
        "P1 y P2 no reconcilian el mismo agregado poblacional del marco."
      )
    }
    same_faculty_inventory <- setequal(names(p1$basis), names(p2$basis))
    same_ch_basis <- same_faculty_inventory && identical(p1$basis, p2$basis)
    if (!same_ch_basis) {
      divergent <- if (same_faculty_inventory) {
        Filter(
          function(key) !identical(p1$basis[[key]], p2$basis[[key]]),
          names(p1$basis)
        )
      } else {
        union(
          setdiff(names(p1$basis), names(p2$basis)),
          setdiff(names(p2$basis), names(p1$basis))
        )
      }
      reasons <- .cm_dist_add_reason(
        reasons,
        if (same_faculty_inventory) "ch_basis_mismatch" else "faculty_inventory_mismatch",
        "P1 y P2 no comparten la misma base firmada de cursos-horario (divisor y tau por facultad).",
        list(faculty_keys = as.list(divergent))
      )
    }
  }

  deltas_values <- NULL
  delta_sums <- FALSE
  if (p1_ready && p2_ready) {
    deltas_values <- list(
      sample_n = as.integer(p2$scenario$sample_n - p1$scenario$sample_n),
      ch_base_required = as.integer(
        p2$scenario$ch$base_required - p1$scenario$ch$base_required
      ),
      ch_reserve_policy_dependent = as.integer(
        p2$scenario$ch$reserve_required - p1$scenario$ch$reserve_required
      ),
      ch_total_operational = as.integer(
        p2$scenario$ch$total_operational - p1$scenario$ch$total_operational
      )
    )
    delta_sums <- identical(
      deltas_values$ch_total_operational,
      as.integer(
        deltas_values$ch_base_required + deltas_values$ch_reserve_policy_dependent
      )
    )
    if (!delta_sums) {
      reasons <- .cm_dist_add_reason(
        reasons,
        "delta_sums_mismatch",
        "Los deltas P2−P1 de la carga CH no cierran entre titulares, reserva y saldo."
      )
    }
  }

  status <- if (length(reasons) == 0L) "ready" else "incompatible"
  ready <- identical(status, "ready")
  source_frame_hash <- if (ready) p1$source_frame_hash else current_frame_hash
  population_hash <- if (ready) p1$population_hash else ""
  scenarios <- if (ready) {
    list(p1_universidad = p1$scenario, p2_facultades = p2$scenario)
  } else {
    # Placeholder serializable: el TS exige la CLAVE presente en todo
    # snapshot, pero no lee su contenido cuando status = "incompatible".
    NA
  }
  deltas <- if (ready) {
    list(
      direction = "p2_minus_p1",
      values = deltas_values,
      semantics = list(
        sample_n = list(kind = "planned_sample_load", precision_claim = FALSE),
        ch_base_required = list(
          kind = "signed_classroom_requirement",
          causal = TRUE,
          guard = "same_divisor_tau_by_faculty"
        ),
        ch_reserve_policy_dependent = list(
          kind = "reserve_policy",
          precision_claim = FALSE
        ),
        ch_total_operational = list(
          kind = "operational_balance",
          precision_claim = FALSE
        )
      )
    )
  } else {
    NA
  }
  reconciliation <- list(
    ok = ready,
    p1_ready = p1_ready,
    p2_ready = p2_ready,
    same_source_frame = same_source_frame,
    same_population = same_population,
    same_faculty_inventory = same_faculty_inventory,
    same_ch_basis = same_ch_basis,
    sample_sums = p1_ready && p2_ready,
    ch_sums = p1_ready && p2_ready,
    delta_sums = delta_sums
  )

  list(
    schema = .cm_comp_i20_schema,
    owner = .cm_comp_i20_owner,
    status = status,
    reasons = reasons,
    source_frame_hash = source_frame_hash,
    population_hash = population_hash,
    comparison_hash = .cm_aulas_hash(list(
      schema = .cm_comp_i20_schema,
      status = status,
      source_frame_hash = source_frame_hash,
      population_hash = population_hash,
      scenarios = scenarios,
      deltas = if (ready) deltas_values else NA,
      reasons = reasons
    )),
    computed_at = .cm_aulas_now_iso(),
    sample_unit = "cuota_objetivo_estudiante",
    sample_stage = "planificada",
    ch_unit = "curso_horario",
    scenarios = scenarios,
    deltas_p2_minus_p1 = deltas,
    reconciliation = reconciliation
  )
}

#' Estampa el snapshot I20 idéntico en los carriers P1 y P2 del estudio.
#'
#' Solo toca componentes universitarios con resultado calculable; el resto del
#' estudio (y cualquier estudio sin P1/P2) queda intacto. Ambos carriers
#' reciben el MISMO objeto: la igualdad byte a byte al serializar es parte del
#' contrato con el frontend.
calc_muestra_comparacion_adjuntar_estudio <- function(estudio, frame = NULL) {
  if (!is.list(estudio) || !is.list(estudio$componentes)) return(estudio)
  targets <- which(vapply(estudio$componentes, function(comp) {
    is.list(comp) &&
      .cm_aulas_scalar(comp$actor_id, "") %in% names(.cm_comp_i20_scenarios) &&
      is.list(comp$resultado) && length(comp$resultado) > 0L
  }, logical(1)))
  if (!length(targets)) return(estudio)
  snapshot <- calc_muestra_comparacion_construir(estudio$componentes, frame)
  for (i in targets) {
    estudio$componentes[[i]]$resultado$comparacion_escenarios <- snapshot
  }
  estudio
}

#' Repara el carrier I20 tras un round-trip JSON (autosave POST /estudio).
#'
#' Todo `null` del snapshot se parsea en R como un NULL nombrado y el
#' serializer unboxed lo reemitiría como `{}` — drift de wire que rompe el
#' contrato. Este repair restituye el NA (que serializa como `null`) en los
#' dos lugares donde el snapshot publica null: `formal_precision$global` del
#' escenario P2 (caso ready) y los placeholders top-level `scenarios` /
#' `deltas_p2_minus_p1` (caso incompatible). El resto del resultado sigue
#' siendo opaco. Idempotente: un snapshot recién construido (NA) pasa igual.
calc_muestra_comparacion_reparar_resultado <- function(resultado) {
  if (!is.list(resultado)) return(resultado)
  snapshot <- resultado$comparacion_escenarios
  if (!is.list(snapshot)) return(resultado)
  for (key in c("scenarios", "deltas_p2_minus_p1")) {
    if (key %in% names(snapshot) && is.null(snapshot[[key]])) {
      snapshot[key] <- list(NA)
    }
  }
  scenarios <- snapshot$scenarios
  if (is.list(scenarios)) {
    for (name in names(scenarios)) {
      scenario <- scenarios[[name]]
      if (!is.list(scenario)) next
      precision <- scenario$formal_precision
      if (is.list(precision) && "global" %in% names(precision) &&
          is.null(precision$global)) {
        precision["global"] <- list(NA)
        scenario$formal_precision <- precision
        scenarios[[name]] <- scenario
      }
    }
    snapshot$scenarios <- scenarios
  }
  resultado$comparacion_escenarios <- snapshot
  resultado
}

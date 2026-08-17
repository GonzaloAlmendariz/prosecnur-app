# Contrato R de alumnos elegibles por curso-horario y resolución de la
# decisión firmada que consume Cálculo. El frame ejecutado es la única fuente:
# no se recomputan estadísticos desde population ni se acepta un fallback de
# `eligible_n` a otra columna.

.cm_alumnos_por_ch_schema <- "calc_muestra_alumnos_por_ch_v1"
.cm_alumnos_por_ch_owner <- "calc_muestra_aulas_frame_v1.aula_frame"
.cm_alumnos_por_ch_decision_schema <- "calc_muestra_alumnos_por_ch_decision_v1"
# `min_mediana_media` es el estadistico que aplico el diseno de 2025 —la hoja
# «TD Estudiantes» lo nombra «Minimo entre mediana y media»— y se resuelve de la
# misma distribucion que los otros tres: no agrega campo al snapshot ni cambia
# el schema, asi que un `.pulso` firmado con `p25` sigue siendo valido.
#
# OJO con el nombre: el estadistico de conglomerado del Recorrido llama
# `min_media_mediana` a lo mismo, con los dos terminos invertidos. Son contratos
# distintos y ninguno lee la whitelist del otro; aqui manda el orden del diseno.
.cm_alumnos_por_ch_methods <- c("media", "mediana", "p25", "min_mediana_media")
.cm_alumnos_por_ch_total_key <- "__total__"

.cm_alumnos_por_ch_snapshot <- function(values) {
  values <- suppressWarnings(as.numeric(values))
  n_ch <- as.integer(length(values))
  n_ch_con_dato <- as.integer(sum(is.finite(values)))
  completo <- n_ch > 0L && n_ch_con_dato == n_ch
  cuantiles <- if (completo) {
    as.numeric(stats::quantile(
      values,
      probs = c(0.25, 0.50),
      type = 7,
      names = FALSE
    ))
  } else {
    c(NA_real_, NA_real_)
  }
  list(
    n_ch = n_ch,
    n_ch_con_dato = n_ch_con_dato,
    n_matriculas_elegibles = if (!n_ch) 0 else if (completo) {
      as.numeric(sum(values))
    } else {
      NA_real_
    },
    distribution = list(
      media = if (completo) as.numeric(mean(values)) else NA_real_,
      p25 = cuantiles[[1]],
      p50 = cuantiles[[2]]
    )
  )
}

.cm_alumnos_por_ch_facultades <- function(aula_frame) {
  labels <- if ("faculty" %in% names(aula_frame)) {
    trimws(as.character(aula_frame$faculty))
  } else {
    rep("", nrow(aula_frame))
  }
  labels[is.na(labels)] <- ""
  keys <- .cm_criterios_fac_key(labels)
  unique_keys <- unique(keys)
  rows <- lapply(unique_keys, function(key) {
    idx <- which(keys == key)
    list(
      eval_key = key,
      faculty_key = if (nzchar(key)) key else .cm_criterio_radiografia_missing_faculty_key,
      faculty_label = if (nzchar(key)) {
        .cm_criterio_radiografia_label_modal(labels, idx, key)
      } else {
        "Sin dato"
      },
      idx = idx
    )
  })
  if (length(rows)) {
    order_idx <- order(vapply(rows, `[[`, character(1), "faculty_label"))
    rows <- rows[order_idx]
  }
  rows
}

#' Resume el tamaño de los CH por facultad efectiva.
#'
#' Tanto `elegible` como `contraste_total` usan exclusivamente `eligible_n`.
#' Si una sola unidad del denominador no trae dato, suma y distribución quedan
#' en NA; el conteo de CH y el conteo con dato siguen auditables.
calc_muestra_alumnos_por_ch <- function(aula_frame, frame_hash = NA_character_) {
  if (!is.data.frame(aula_frame)) return(NULL)
  n <- nrow(aula_frame)
  included <- if ("included" %in% names(aula_frame)) {
    suppressWarnings(as.logical(aula_frame$included))
  } else {
    rep(FALSE, n)
  }
  included[is.na(included)] <- FALSE
  eligible_n <- if ("eligible_n" %in% names(aula_frame)) {
    suppressWarnings(as.numeric(aula_frame$eligible_n))
  } else {
    rep(NA_real_, n)
  }
  facultades <- .cm_alumnos_por_ch_facultades(aula_frame)
  filas <- lapply(facultades, function(fac) {
    idx <- fac$idx
    list(
      faculty_key = fac$faculty_key,
      faculty_label = fac$faculty_label,
      row_kind = "faculty",
      elegible = .cm_alumnos_por_ch_snapshot(eligible_n[idx[included[idx]]]),
      contraste_total = .cm_alumnos_por_ch_snapshot(eligible_n[idx])
    )
  })
  filas[[length(filas) + 1L]] <- list(
    faculty_key = .cm_alumnos_por_ch_total_key,
    faculty_label = "Total",
    row_kind = "total",
    elegible = .cm_alumnos_por_ch_snapshot(eligible_n[which(included)]),
    contraste_total = .cm_alumnos_por_ch_snapshot(eligible_n)
  )
  list(
    schema = .cm_alumnos_por_ch_schema,
    owner = .cm_alumnos_por_ch_owner,
    frame_hash = .cm_aulas_scalar(frame_hash, NA_character_),
    referencia = "marco_ejecutado",
    grano = "facultad_efectiva",
    unidad = "curso_horario_unico",
    metrica = "eligible_n",
    filas = filas
  )
}

.cm_alumnos_por_ch_method <- function(value) {
  value <- .cm_aulas_scalar(value, "")
  if (value %in% .cm_alumnos_por_ch_methods) value else ""
}

# Whitelist persistible. Un payload presente pero inválido conserva un
# sentinela incompleto en vez de convertirse en NULL/default: así `/calcular`
# puede fallar cerrado y no reactivar cuotas históricas.
.cm_alumnos_por_ch_normalize_decision <- function(decision) {
  if (is.null(decision)) return(NULL)
  if (!is.list(decision)) decision <- list()
  raw_map <- decision$por_facultad
  out_map <- list()
  map_is_valid <- is.null(raw_map) ||
    (is.list(raw_map) && length(raw_map) == 0L) ||
    (is.list(raw_map) && !is.null(names(raw_map)))
  if (map_is_valid && is.list(raw_map) && !is.null(names(raw_map))) {
    for (name in names(raw_map)) {
      key <- .cm_aulas_scalar(name, "")
      if (!nzchar(key)) {
        map_is_valid <- FALSE
        next
      }
      normalized_key <- .cm_criterios_fac_key(key)
      normalized_key <- .cm_aulas_scalar(normalized_key, "")
      if (!nzchar(normalized_key) || !is.null(out_map[[normalized_key]])) {
        map_is_valid <- FALSE
        next
      }
      out_map[[normalized_key]] <- .cm_alumnos_por_ch_method(raw_map[[name]])
    }
  }
  list(
    schema = if (map_is_valid && identical(
      .cm_aulas_scalar(decision$schema, ""),
      .cm_alumnos_por_ch_decision_schema
    )) .cm_alumnos_por_ch_decision_schema else "",
    frame_hash = .cm_aulas_scalar(decision$frame_hash, ""),
    denominador = if (identical(
      .cm_aulas_scalar(decision$denominador, ""),
      "elegible"
    )) "elegible" else "",
    estadistico_default = .cm_alumnos_por_ch_method(decision$estadistico_default),
    por_facultad = out_map,
    confirmado_at = .cm_aulas_scalar(decision$confirmado_at, "")
  )
}

# Firma semántica estable de la decisión. El orden de las claves JSON no tiene
# significado; una forma ausente sí difiere de una decisión confirmada. Esta
# misma firma gobierna el autosave, los jobs de Aulas y la frescura en React.
.cm_alumnos_por_ch_decision_signature <- function(decision) {
  normalized <- .cm_alumnos_por_ch_normalize_decision(decision)
  if (is.null(normalized)) return(NULL)
  map <- normalized$por_facultad %||% list()
  if (length(map) && !is.null(names(map))) {
    map <- map[order(names(map))]
  }
  normalized$por_facultad <- map
  normalized
}

.cm_alumnos_por_ch_estudio_decision <- function(estudio) {
  if (!is.list(estudio)) return(NULL)
  workspace <- estudio$workspace
  if (!is.list(workspace)) return(NULL)
  config <- workspace$aulas_config
  if (!is.list(config)) return(NULL)
  .cm_alumnos_por_ch_decision_signature(config$alumnos_por_ch_decision)
}

.cm_alumnos_por_ch_decision_changed <- function(previous, current) {
  !identical(
    .cm_alumnos_por_ch_estudio_decision(previous),
    .cm_alumnos_por_ch_estudio_decision(current)
  )
}

.cm_alumnos_por_ch_decision_matches_config <- function(estudio, config) {
  config_decision <- if (is.list(config)) {
    config$alumnos_por_ch_decision
  } else {
    NULL
  }
  study_signature <- .cm_alumnos_por_ch_estudio_decision(estudio)
  config_signature <- .cm_alumnos_por_ch_decision_signature(config_decision)
  if (!is.null(study_signature) &&
      !identical(study_signature$schema, .cm_alumnos_por_ch_decision_schema)) {
    return(FALSE)
  }
  if (!is.null(config_signature) &&
      !identical(config_signature$schema, .cm_alumnos_por_ch_decision_schema)) {
    return(FALSE)
  }
  identical(study_signature, config_signature)
}

# Puente de frescura para los artefactos de Aulas. Vive junto al contrato que
# firma la corrida; el router solo lo invoca en sus fronteras HTTP/jobs.
.cm_aulas_decision_vigente <- function(s, config) {
  .cm_alumnos_por_ch_decision_matches_config(
    s$calc_muestra_estudio %||% NULL,
    config
  )
}

# Hash puro del marco vigente. Vive con la firma causal de la decisión para
# que el owner no dependa del seam HTTP que consume este guard en sus jobs.
.cm_aulas_frame_vigente_hash <- function(s) {
  frame <- s$calc_muestra_aulas_frame %||% NULL
  if (is.null(frame)) return("")
  .cm_aulas_scalar(frame$frame_hash %||% "", "")
}

.cm_aulas_run_vigente <- function(s, frame_hash, config) {
  identical(.cm_aulas_frame_vigente_hash(s), frame_hash) &&
    .cm_aulas_decision_vigente(s, config)
}

.cm_aulas_assert_decision_vigente <- function(s, config) {
  if (.cm_aulas_decision_vigente(s, config)) return(invisible(TRUE))
  stop_api(
    409,
    "E_CALC_MUESTRA_ALUMNOS_CH_DECISION",
    paste0(
      "La decisión de alumnos por CH cambió desde esta corrida. ",
      "Recalcula y vuelve a generar los artefactos de Aulas."
    ),
    details = list(reason = "decision_stale")
  )
}

.cm_aulas_invalidar_derivados_decision <- function(sid) {
  session_set(sid, "calc_muestra_aulas_selection", NULL)
  session_set(sid, "calc_muestra_aulas_method_comparison", NULL)
  # La certeza de cobertura se mide sobre el marco y la cuota vigentes; si
  # cualquiera cambia, el número deja de describir el diseño que hay en
  # pantalla y sobrevivir sería peor que faltar.
  session_set(sid, "calc_muestra_aulas_certeza", NULL)
  session_set(sid, "calc_muestra_aulas_replacement_simulation", NULL)
  session_set(sid, "calc_muestra_aulas_export", NULL)
  session_set(sid, "calc_muestra_aulas_stale_job_result", NULL)
  invisible(TRUE)
}

# El endpoint de autosave delega aquí la mutación causal. El router conserva
# únicamente el borde HTTP/sesión y no vuelve a conocer la forma interna de la
# decisión ni el sentinela JSON que invalida resultados previos.
.cm_alumnos_por_ch_preparar_estudio_guardado <- function(previous, current) {
  changed <- .cm_alumnos_por_ch_decision_changed(previous, current)
  if (changed && is.list(current$workspace$aulas_config)) {
    current$workspace$aulas_config$n_aulas <- NULL
  }
  if (changed && is.list(current$componentes)) {
    current$componentes <- lapply(current$componentes, function(component) {
      # El serializer unboxed de Plumber emite un NULL nombrado como `{}`;
      # NA_character_ conserva el contrato público `resultado: null`.
      component["resultado"] <- list(NA_character_)
      component
    })
  }
  list(estudio = current, changed = changed)
}

.cm_alumnos_por_ch_tiene_resultados_publicables <- function(estudio) {
  any(vapply(
    estudio$componentes %||% list(),
    function(component) is.list(component$resultado) && length(component$resultado) > 0L,
    logical(1)
  ))
}

.cm_alumnos_por_ch_fail <- function(reason, message, details = list()) {
  stop_api(
    409,
    "E_CALC_MUESTRA_ALUMNOS_CH_DECISION",
    message,
    details = c(list(reason = reason), details)
  )
}

.cm_alumnos_por_ch_stat_value <- function(row, method) {
  snapshot <- if (is.list(row)) row$elegible else NULL
  distribution <- if (is.list(snapshot)) snapshot$distribution else NULL
  value <- switch(method,
    media = if (is.list(distribution)) distribution$media else NULL,
    mediana = if (is.list(distribution)) distribution$p50 else NULL,
    p25 = if (is.list(distribution)) distribution$p25 else NULL,
    # Sin `na.rm` a proposito: si una de las dos falta, el minimo no esta
    # definido y la fila debe quedar sin valor. Con `na.rm = TRUE` una facultad
    # a la que le falta la media devolveria la mediana disfrazada de minimo, y
    # el guard de `valor_no_positivo` la dejaria pasar sin que nadie lo vea.
    min_mediana_media = if (is.list(distribution)) {
      pareja <- suppressWarnings(as.numeric(c(
        unlist(distribution$p50, use.names = FALSE)[1],
        unlist(distribution$media, use.names = FALSE)[1]
      )))
      if (length(pareja) == 2L) min(pareja) else NA_real_
    } else NULL,
    NULL
  )
  suppressWarnings(as.numeric(unlist(value, use.names = FALSE))[1])
}

# F112 · Una facultad SIN cursos-horario elegibles no entra al contrato.
#
# El contrato de alumnos por CH trae una fila por facultad del marco, y las que
# quedaron fuera por criterios viajan con `elegible$n_ch = 0` para poder
# mostrarse en la columna de contraste: son informativas, no muestreables.
# Tomarlas como facultades exigibles rompía el estudio real de HSVG, donde
# «Escuela de Estudios Especiales» y «Escuela de Posgrado» tienen 0 CH
# elegibles: el guard de cobertura pedía a P1/P2 declararles un estrato, y el
# analista no puede dárselo porque no hay unidades que muestrear. Peor, si lo
# declaraba igual, la validación de más abajo lo mataba con `valor_no_positivo`
# —el estadístico de una distribución vacía es NA—, así que el estrato no tenía
# ninguna forma válida de existir. El contrato pedía algo imposible.
#
# La cobertura se exige entonces sobre las facultades con unidades elegibles,
# que son exactamente las que el diseño puede repartir.
.cm_alumnos_por_ch_fila_es_muestreable <- function(row) {
  snapshot <- if (is.list(row)) row$elegible else NULL
  if (!is.list(snapshot)) return(FALSE)
  n_ch <- suppressWarnings(as.numeric(
    unlist(snapshot$n_ch, use.names = FALSE)
  )[1])
  isTRUE(is.finite(n_ch) && n_ch > 0)
}

.cm_alumnos_por_ch_rows_by_key <- function(contract) {
  filas <- if (is.list(contract)) contract$filas else NULL
  if (!is.list(filas)) return(list())
  out <- list()
  for (row in filas) {
    if (!is.list(row) || identical(row$row_kind, "total")) next
    if (!.cm_alumnos_por_ch_fila_es_muestreable(row)) next
    key <- .cm_aulas_scalar(row$faculty_key, "")
    if (!nzchar(key) || !is.null(out[[key]])) {
      .cm_alumnos_por_ch_fail(
        "faculty_rows_invalid",
        "El contrato de alumnos por CH no identifica cada facultad una sola vez."
      )
    }
    out[[key]] <- row
  }
  out
}

.cm_alumnos_por_ch_component_ids <- c(
  "estudiantes_universidad",
  "estudiantes_facultad"
)

# Resuelve y materializa el divisor por estrato ANTES del cálculo. Retorna la
# copia del estudio lista para `calc_muestra_calcular_estudio()` y una auditoría
# separada, porque la normalización deliberadamente descarta estado transitorio.
calc_muestra_alumnos_por_ch_resolver_estudio <- function(estudio, frame = NULL) {
  estudio <- calc_muestra_normalize_estudio(estudio)
  workspace <- estudio$workspace
  if (!is.list(workspace) ||
      !identical(workspace$frame_mode, "opinion_universitaria")) {
    return(list(estudio = estudio, auditoria = NULL))
  }
  decision <- (workspace$aulas_config %||% list())$alumnos_por_ch_decision
  # Compatibilidad explícita con proyectos previos al contrato v1, y con los que
  # guardan la estructura EN BLANCO sin haber decidido nada: una decisión con
  # los seis campos vacíos es indistinguible de una ausente, y tratarla como
  # corrupta dejaba el estudio sin poder calcularse.
  if (.cm_alumnos_por_ch_decision_en_blanco(decision)) {
    return(list(estudio = estudio, auditoria = NULL))
  }
  decision <- .cm_alumnos_por_ch_normalize_decision(decision)

  if (!identical(decision$schema, .cm_alumnos_por_ch_decision_schema)) {
    .cm_alumnos_por_ch_fail(
      "schema_invalido",
      "La decisión de alumnos por CH está incompleta o usa un schema desconocido."
    )
  }
  if (!nzchar(decision$confirmado_at)) {
    .cm_alumnos_por_ch_fail(
      "sin_confirmacion",
      "Confirma la decisión de alumnos por CH antes de calcular."
    )
  }
  if (!identical(decision$denominador, "elegible") ||
      !nzchar(decision$estadistico_default)) {
    .cm_alumnos_por_ch_fail(
      "decision_incompleta",
      "La decisión debe usar el denominador elegible y un estadístico permitido."
    )
  }
  if (!is.list(frame) ||
      !identical(.cm_aulas_scalar(frame$schema, ""), "calc_muestra_aulas_frame_v1")) {
    .cm_alumnos_por_ch_fail(
      "frame_ausente",
      "Construye el marco de cursos-horario antes de calcular."
    )
  }
  frame_hash <- .cm_aulas_scalar(frame$frame_hash, "")
  contract <- frame$alumnos_por_ch
  if (!is.list(contract) ||
      !identical(.cm_aulas_scalar(contract$schema, ""), .cm_alumnos_por_ch_schema)) {
    .cm_alumnos_por_ch_fail(
      "contrato_ausente",
      "El marco vigente no contiene el contrato de alumnos por CH."
    )
  }
  contract_hash <- .cm_aulas_scalar(contract$frame_hash, "")
  if (!nzchar(frame_hash) || !nzchar(decision$frame_hash) ||
      !identical(decision$frame_hash, frame_hash) ||
      !identical(contract_hash, frame_hash)) {
    .cm_alumnos_por_ch_fail(
      "frame_stale",
      "La decisión de alumnos por CH no corresponde al marco vigente.",
      details = list(
        decision_frame_hash = decision$frame_hash,
        current_frame_hash = frame_hash
      )
    )
  }

  component_actor_ids <- vapply(
    estudio$componentes,
    function(comp) .cm_aulas_scalar(comp$actor_id, ""),
    character(1)
  )
  missing_components <- setdiff(
    .cm_alumnos_por_ch_component_ids,
    component_actor_ids
  )
  if (length(missing_components)) {
    .cm_alumnos_por_ch_fail(
      "componentes_incompletos",
      "La decisión requiere los componentes P1 y P2 del diseño universitario.",
      details = list(actor_ids = as.list(missing_components))
    )
  }

  rows_by_key <- .cm_alumnos_por_ch_rows_by_key(contract)
  audit_components <- list()
  for (i in which(component_actor_ids %in% .cm_alumnos_por_ch_component_ids)) {
    comp <- estudio$componentes[[i]]
    estratos <- comp$marco$estratos %||% list()
    if (!length(estratos)) {
      .cm_alumnos_por_ch_fail(
        "estratos_ausentes",
        "Los componentes P1 y P2 deben declarar sus facultades antes de calcular.",
        details = list(actor_id = comp$actor_id)
      )
    }
    audit_rows <- list()
    seen <- character(0)
    faculty_keys <- character(length(estratos))
    for (j in seq_along(estratos)) {
      estrato <- estratos[[j]]
      faculty_key <- .cm_aulas_scalar(
        .cm_criterios_fac_key(.cm_aulas_scalar(estrato$label, "")),
        ""
      )
      if (!nzchar(faculty_key) || faculty_key %in% seen) {
        .cm_alumnos_por_ch_fail(
          "facultad_ambigua",
          "Cada estrato debe corresponder a una facultad efectiva única.",
          details = list(actor_id = comp$actor_id, estrato = estrato$label)
        )
      }
      seen <- c(seen, faculty_key)
      faculty_keys[[j]] <- faculty_key
    }
    contract_keys <- names(rows_by_key)
    if (!setequal(seen, contract_keys)) {
      # El mensaje nombra la facultad y su causa probable; el detalle
      # estructurado sigue completo. Ver calc_muestra_alumnos_por_ch_cobertura.R.
      faltantes <- setdiff(contract_keys, seen)
      sobrantes <- setdiff(seen, contract_keys)
      .cm_alumnos_por_ch_fail(
        "facultades_incompletas",
        .cm_alumnos_ch_mensaje_cobertura(faltantes, sobrantes),
        details = list(
          actor = comp$actor_id,
          faltantes = as.list(faltantes),
          sobrantes = as.list(sobrantes)
        )
      )
    }
    for (j in seq_along(estratos)) {
      estrato <- estratos[[j]]
      faculty_key <- faculty_keys[[j]]
      row <- rows_by_key[[faculty_key]]
      override <- decision$por_facultad[[faculty_key]]
      method <- if (is.null(override)) decision$estadistico_default else override
      if (!method %in% .cm_alumnos_por_ch_methods) {
        .cm_alumnos_por_ch_fail(
          "estadistico_invalido",
          "La decisión contiene un estadístico no permitido para una facultad.",
          details = list(faculty_key = faculty_key)
        )
      }
      value <- .cm_alumnos_por_ch_stat_value(row, method)
      if (length(value) != 1L || !is.finite(value) || value <= 0) {
        .cm_alumnos_por_ch_fail(
          "valor_no_positivo",
          "El estadístico decidido no produce un valor positivo para una facultad.",
          details = list(faculty_key = faculty_key, estadistico = method)
        )
      }
      normalized_value <- calc_num(
        value,
        NA_real_,
        min = 0,
        max = .CM_CONGLOMERADO_DIVISOR_MAX
      )
      if (!is.finite(normalized_value) ||
          normalized_value < .CM_CONGLOMERADO_DIVISOR_MIN ||
          !identical(normalized_value, value)) {
        .cm_alumnos_por_ch_fail(
          "valor_fuera_dominio",
          paste0(
            "El estadístico decidido no puede usarse como divisor sin ",
            "ser sustituido por el motor."
          ),
          details = list(
            faculty_key = faculty_key,
            estadistico = method,
            valor = value,
            minimo = .CM_CONGLOMERADO_DIVISOR_MIN,
            maximo = .CM_CONGLOMERADO_DIVISOR_MAX
          )
        )
      }
      # La decisión vigente prevalece sobre `aulas_base_fijas` y sobre los
      # estadísticos legacy que el frontend hubiese materializado antes.
      estrato$promedio_conglomerado <- normalized_value
      estrato$mediana_conglomerado <- 0
      estrato$aulas_base_fijas <- 0L
      estratos[[j]] <- estrato
      audit_rows[[length(audit_rows) + 1L]] <- list(
        estrato = estrato$label,
        faculty_key = faculty_key,
        estadistico = method,
        valor = normalized_value
      )
    }
    comp$marco$estratos <- estratos
    comp$parametros$estadistico_conglomerado <- "media"
    estudio$componentes[[i]] <- comp
    audit_components[[comp$actor_id]] <- list(
      component_id = comp$id,
      actor_id = comp$actor_id,
      estratos = audit_rows
    )
  }

  list(
    estudio = estudio,
    auditoria = list(
      schema = .cm_alumnos_por_ch_decision_schema,
      frame_hash = frame_hash,
      denominador = "elegible",
      estadistico_default = decision$estadistico_default,
      confirmado_at = decision$confirmado_at,
      componentes = audit_components
    )
  )
}

# Reincorpora la firma y el método efectivo a la respuesta calculada. No
# modifica cifras: `aulas_por_estrato` y `aulas_base_total` ya nacieron del
# engine con los valores resueltos arriba.
calc_muestra_alumnos_por_ch_adjuntar_auditoria <- function(estudio, auditoria) {
  # Sin auditoria el motor calculo con el promedio GLOBAL. Antes se salia en
  # silencio y el resultado no lo mencionaba en ninguna parte; ahora cada fila
  # de `aulas_por_estrato` dice que su cifra no sale de su facultad.
  if (!is.list(auditoria) || !is.list(auditoria$componentes)) {
    return(.cm_alumnos_por_ch_marcar_sin_decision(estudio))
  }
  for (i in seq_along(estudio$componentes)) {
    comp <- estudio$componentes[[i]]
    actor_id <- .cm_aulas_scalar(comp$actor_id, "")
    comp_audit <- auditoria$componentes[[actor_id]]
    if (is.null(comp_audit) || !is.list(comp$resultado)) next
    by_key <- list()
    for (row in comp_audit$estratos %||% list()) {
      by_key[[row$faculty_key]] <- row
    }
    aulas <- comp$resultado$aulas_por_estrato
    if (is.list(aulas)) {
      aulas <- lapply(aulas, function(row) {
        key <- .cm_aulas_scalar(
          .cm_criterios_fac_key(.cm_aulas_scalar(row$estrato, "")),
          ""
        )
        resolved <- by_key[[key]]
        if (is.null(resolved)) return(row)
        row$avg_conglomerado <- resolved$valor
        row$estadistico_usado <- resolved$estadistico
        row$alumnos_por_ch <- list(
          referencia = "marco_ejecutado",
          frame_hash = auditoria$frame_hash,
          denominador = auditoria$denominador,
          faculty_key = key,
          estadistico = resolved$estadistico,
          valor = resolved$valor
        )
        row
      })
      comp$resultado$aulas_por_estrato <- aulas
    }
    comp$resultado$alumnos_por_ch_decision <- list(
      schema = auditoria$schema,
      frame_hash = auditoria$frame_hash,
      denominador = auditoria$denominador,
      estadistico_default = auditoria$estadistico_default,
      confirmado_at = auditoria$confirmado_at
    )
    estudio$componentes[[i]] <- comp
  }
  estudio
}

# Composición única del consumo: resolver en R, calcular y reincorporar solo la
# auditoría. El router no deriva estadísticos ni manipula el resultado.
calc_muestra_alumnos_por_ch_calcular_estudio <- function(estudio, frame = NULL) {
  decision_resuelta <- calc_muestra_alumnos_por_ch_resolver_estudio(estudio, frame)
  calculado <- calc_muestra_calcular_estudio(decision_resuelta$estudio)
  auditado <- calc_muestra_alumnos_por_ch_adjuntar_auditoria(
    calculado,
    decision_resuelta$auditoria
  )
  con_distribucion <- calc_muestra_distribucion_adjuntar_estudio(auditado, frame)
  # I20: el snapshot de comparación P1↔P2 se construye una vez y se estampa
  # idéntico en ambos resultados (calc_muestra_comparacion_escenarios.R).
  calc_muestra_comparacion_adjuntar_estudio(con_distribucion, frame)
}

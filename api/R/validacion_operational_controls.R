# =============================================================================
# Validacion v2 — controles operativos del plan
# =============================================================================

.validation_operational_default_config <- function() {
  list(
    version = 2L,
    field_period = list(
      enabled = FALSE,
      variable = "",
      start_date = "",
      end_date = "",
      timezone = "America/Lima"
    ),
    duplicates = list(
      enabled = FALSE,
      variables = character(0),
      matching_method = "response_similarity",
      similarity_threshold = 0.90,
      minimum_coverage = 0.80
    ),
    # Quién es el sujeto de un caso y quién lo recolectó. Se declara una vez
    # por estudio para que ninguna verificación tenga que nombrar variables de
    # un proyecto: el motor pregunta por el rol, no por la columna. Mismo
    # contrato que `field_period`, que ya declara cuál es su variable de fecha.
    identity = list(
      enabled = FALSE,
      variables = character(0),
      agent_variable = "",
      # Solo para leer el caso en Hallazgos (buscar la ficha física): no son
      # la llave del caso ni cambian cómo se guardan las decisiones.
      survey_number_variable = "",
      typist_variable = ""
    ),
    # Qué hace que un caso cuente. Hoy este criterio existe pero repetido en el
    # `relevant` de cada pregunta: en un estudio real, una misma variable de
    # consentimiento aparecía en el gate de 403 de 425 reglas. La app lo heredaba
    # y nunca lo sabía — no podía decir cuál era el universo analizable porque
    # nadie se lo había declarado.
    caso_valido = list(
      enabled = FALSE,
      condiciones = list()
    ),
    # Qué preguntas abiertas se vigilan además de las que el instrumento ya
    # delata. Las de «otro, especifique» se detectan solas —dependen de una
    # pregunta anterior y son de contenido por construcción—; las
    # independientes no se pueden inferir sin destrozar la señal: un detector
    # aplicado a todo campo `text` marcó 103 de 104 teléfonos como basura,
    # porque no tienen letras. El código de caso, el teléfono y el nombre del
    # encuestador son captura operativa y el instrumento no los distingue del
    # texto de contenido. Por eso se declaran.
    abiertas = list(
      enabled = FALSE,
      variables = character(0)
    )
  )
}

# Una condición de validez es (variable, operador, valores). Nada de nombres de
# variables en el código: el estudio declara cuáles son las suyas.
.validation_operational_condicion <- function(x, idx) {
  if (!is.list(x)) {
    stop_api(400, "E_OPERATIONAL_VALIDEZ_CONDICION",
             sprintf("La condición %d de caso_valido debe ser un objeto.", idx))
  }
  var <- .validation_operational_scalar(x$variable)
  if (is.null(var)) {
    stop_api(400, "E_OPERATIONAL_VALIDEZ_VARIABLE",
             sprintf("La condición %d de caso_valido necesita 'variable'.", idx))
  }
  op <- as.character(x$operador %||% "==")[1]
  if (is.na(op) || !(op %in% c("==", "!=", "in", "not_in"))) {
    stop_api(400, "E_OPERATIONAL_VALIDEZ_OPERADOR",
             sprintf("Operador inválido en la condición %d: usa ==, !=, in o not_in.", idx))
  }
  vals <- .validation_operational_chr(x$valores)
  if (!length(vals)) {
    stop_api(400, "E_OPERATIONAL_VALIDEZ_VALORES",
             sprintf("La condición %d de caso_valido necesita al menos un valor.", idx))
  }
  list(variable = var, operador = op, valores = vals)
}

.validation_operational_chr <- function(x) {
  out <- as.character(unlist(x %||% list(), recursive = TRUE, use.names = FALSE))
  out <- trimws(out)
  unique(out[!is.na(out) & nzchar(out)])
}

.validation_operational_scalar <- function(x) {
  out <- as.character(x %||% NA_character_)[1]
  if (is.na(out) || !nzchar(trimws(out))) NULL else trimws(out)
}

.validation_operational_date <- function(x, field) {
  raw <- .validation_operational_scalar(x)
  if (is.null(raw)) return(NULL)
  parsed <- suppressWarnings(as.Date(raw))
  if (is.na(parsed)) {
    stop_api(400, "E_OPERATIONAL_DATE_INVALID",
             sprintf("'%s' debe usar formato YYYY-MM-DD.", field))
  }
  as.character(parsed)
}

.validation_operational_probability <- function(x, default, field) {
  raw <- suppressWarnings(as.numeric(x %||% default))[1]
  if (!is.finite(raw) || raw <= 0 || raw > 1) {
    stop_api(400, "E_OPERATIONAL_DUPLICATE_THRESHOLD",
             sprintf("'%s' debe ser un numero mayor que 0 y menor o igual que 1.", field))
  }
  raw
}

.validation_operational_date_label <- function(x) {
  value <- suppressWarnings(as.Date(x))
  if (is.na(value)) return(as.character(x %||% ""))
  months <- c("ene.", "feb.", "mar.", "abr.", "may.", "jun.",
              "jul.", "ago.", "set.", "oct.", "nov.", "dic.")
  sprintf("%d %s %d", as.integer(format(value, "%d")),
          months[[as.integer(format(value, "%m"))]],
          as.integer(format(value, "%Y")))
}

#' Normaliza y valida la configuracion operativa de una base.
#' @keywords internal
normalize_validation_operational_config <- function(config = NULL,
                                                     available_variables = NULL) {
  defaults <- .validation_operational_default_config()
  if (is.null(config)) return(defaults)
  if (!is.list(config)) {
    stop_api(400, "E_OPERATIONAL_CONFIG_INVALID",
             "'operational_config' debe ser un objeto.")
  }

  version <- suppressWarnings(as.integer(config$version %||% 2L))[1]
  if (is.na(version) || version != 2L) {
    stop_api(400, "E_OPERATIONAL_VERSION_UNSUPPORTED",
             "Solo se admite operational_config version 2.")
  }

  fp_in <- config$field_period %||% list()
  du_in <- config$duplicates %||% list()
  id_in <- config$identity %||% list()
  if (!is.list(id_in)) {
    stop_api(400, "E_OPERATIONAL_CONFIG_INVALID",
             "Los controles operativos deben ser objetos.")
  }
  if (!is.list(fp_in) || !is.list(du_in)) {
    stop_api(400, "E_OPERATIONAL_CONFIG_INVALID",
             "Los controles operativos deben ser objetos.")
  }

  tz <- as.character(fp_in$timezone %||% "America/Lima")[1]
  if (is.na(tz) || !nzchar(tz) || !(tz %in% OlsonNames())) {
    stop_api(400, "E_OPERATIONAL_TIMEZONE_INVALID",
             sprintf("Zona horaria no valida: '%s'.", tz %||% ""))
  }
  fp <- list(
    enabled = isTRUE(fp_in$enabled),
    variable = .validation_operational_scalar(fp_in$variable),
    start_date = .validation_operational_date(fp_in$start_date, "field_period.start_date"),
    end_date = .validation_operational_date(fp_in$end_date, "field_period.end_date"),
    timezone = tz
  )
  if (fp$enabled && (is.null(fp$variable) || is.null(fp$start_date) || is.null(fp$end_date))) {
    stop_api(400, "E_OPERATIONAL_PERIOD_INCOMPLETE",
             "El periodo de campo requiere variable, fecha de inicio y fecha de cierre.")
  }
  if (!is.null(fp$start_date) && !is.null(fp$end_date) &&
      as.Date(fp$start_date) > as.Date(fp$end_date)) {
    stop_api(400, "E_OPERATIONAL_PERIOD_INVERTED",
             "La fecha de inicio no puede ser posterior a la fecha de cierre.")
  }

  du <- list(
    enabled = isTRUE(du_in$enabled),
    variables = .validation_operational_chr(du_in$variables),
    matching_method = as.character(du_in$matching_method %||% "response_similarity")[1],
    similarity_threshold = .validation_operational_probability(
      du_in$similarity_threshold, 0.90, "duplicates.similarity_threshold"
    ),
    minimum_coverage = .validation_operational_probability(
      du_in$minimum_coverage, 0.80, "duplicates.minimum_coverage"
    )
  )
  if (is.na(du$matching_method) ||
      !identical(du$matching_method, "response_similarity")) {
    stop_api(400, "E_OPERATIONAL_DUPLICATE_METHOD",
             "duplicates.matching_method debe ser 'response_similarity'.")
  }
  if (du$enabled && length(du$variables) < 10L) {
    stop_api(400, "E_OPERATIONAL_DUPLICATES_INCOMPLETE",
             "La similitud de respuestas requiere seleccionar al menos 10 variables.")
  }

  cv_in <- config$caso_valido %||% list()
  if (!is.list(cv_in)) {
    stop_api(400, "E_OPERATIONAL_CONFIG_INVALID",
             "Los controles operativos deben ser objetos.")
  }
  cv_conds <- cv_in$condiciones %||% list()
  cv <- list(
    enabled = isTRUE(cv_in$enabled),
    condiciones = lapply(seq_along(cv_conds),
                         function(i) .validation_operational_condicion(cv_conds[[i]], i))
  )
  if (cv$enabled && !length(cv$condiciones)) {
    stop_api(400, "E_OPERATIONAL_VALIDEZ_INCOMPLETA",
             "El criterio de caso válido requiere al menos una condición.")
  }

  id <- list(
    enabled = isTRUE(id_in$enabled),
    variables = .validation_operational_chr(id_in$variables),
    agent_variable = .validation_operational_scalar(id_in$agent_variable),
    survey_number_variable = .validation_operational_scalar(id_in$survey_number_variable),
    typist_variable = .validation_operational_scalar(id_in$typist_variable)
  )
  if (id$enabled && !length(id$variables)) {
    stop_api(400, "E_OPERATIONAL_IDENTITY_INCOMPLETE",
             "La identidad del caso requiere al menos una variable llave.")
  }

  ab_in <- config$abiertas %||% list()
  if (!is.list(ab_in)) {
    stop_api(400, "E_OPERATIONAL_CONFIG_INVALID",
             "Los controles operativos deben ser objetos.")
  }
  ab <- list(
    enabled = isTRUE(ab_in$enabled),
    variables = .validation_operational_chr(ab_in$variables)
  )
  if (ab$enabled && !length(ab$variables)) {
    stop_api(400, "E_OPERATIONAL_ABIERTAS_INCOMPLETA",
             "Vigilar preguntas abiertas requiere declarar al menos una variable.")
  }

  available <- .validation_operational_chr(available_variables)
  if (length(available)) {
    selected <- c(
      if (fp$enabled) fp$variable else NULL,
      if (du$enabled) du$variables else NULL,
      if (id$enabled) id$variables else NULL,
      if (id$enabled) id$agent_variable else NULL,
      id$survey_number_variable, id$typist_variable,
      if (ab$enabled) ab$variables else NULL,
      if (cv$enabled) vapply(cv$condiciones, function(c1) c1$variable, character(1)) else NULL
    )
    missing <- setdiff(.validation_operational_chr(selected), available)
    if (length(missing)) {
      stop_api(400, "E_OPERATIONAL_VARIABLE_UNKNOWN",
               sprintf("Variables operativas no encontradas: %s.", paste(missing, collapse = ", ")))
    }
  }

  fp$variable <- fp$variable %||% ""
  fp$start_date <- fp$start_date %||% ""
  fp$end_date <- fp$end_date %||% ""
  # `universe_filter` legacy se ignora deliberadamente: el universo efectivo
  # se materializa en Carga y nunca vuelve a filtrarse dentro de Validacion.
  id$agent_variable <- id$agent_variable %||% ""
  id$survey_number_variable <- id$survey_number_variable %||% ""
  id$typist_variable <- id$typist_variable %||% ""
  list(version = 2L, field_period = fp, duplicates = du, identity = id,
       caso_valido = cv, abiertas = ab)
}

validation_operational_config_public <- function(config = NULL) {
  out <- normalize_validation_operational_config(config)
  out$duplicates$variables <- as.list(out$duplicates$variables)
  out$identity$variables <- as.list(out$identity$variables)
  out$abiertas$variables <- as.list(out$abiertas$variables)
  out$caso_valido$condiciones <- lapply(out$caso_valido$condiciones, function(c1) {
    c1$valores <- as.list(c1$valores); c1
  })
  out
}

#' Materializa controles operativos como reglas AST modernas.
#' @keywords internal
validation_operational_rules <- function(config = NULL) {
  config <- normalize_validation_operational_config(config)
  out <- list()

  fp <- config$field_period
  if (isTRUE(fp$enabled)) {
    r <- rule_range(
      var = fp$variable,
      min = fp$start_date,
      max = fp$end_date,
      inclusive = TRUE,
      type = "date",
      timezone = fp$timezone,
      fuente = "custom",
      severidad = "advertencia",
      nombre = "Fecha dentro del periodo de campo",
      objetivo = sprintf(
        "«%s» debe estar entre %s y %s en la zona %s.",
        fp$variable,
        .validation_operational_date_label(fp$start_date),
        .validation_operational_date_label(fp$end_date),
        fp$timezone
      )
    )
    r$id <- "OP_field_period"
    r$flag_name <- .derive_flag_name(r$id)
    r$presentation$nombre_tecnico <- r$flag_name
    out[[length(out) + 1L]] <- r
  }

  du <- config$duplicates
  if (isTRUE(du$enabled)) {
    r <- rule_duplicate(
      vars = du$variables,
      similarity_threshold = du$similarity_threshold,
      minimum_coverage = du$minimum_coverage,
      fuente = "custom",
      severidad = "advertencia",
      nombre = sprintf(
        "Entrevistas con al menos %.0f%% de respuestas coincidentes",
        100 * du$similarity_threshold
      ),
      objetivo = sprintf(
        paste0(
          "Compara %d preguntas seleccionadas y señala ambas entrevistas cuando ",
          "coinciden en al menos %.0f%% de las respuestas comparables, siempre que ",
          "estas cubran al menos %.0f%% de las preguntas."
        ),
        length(du$variables),
        100 * du$similarity_threshold,
        100 * du$minimum_coverage
      )
    )
    r$id <- "OP_duplicates"
    r$flag_name <- .derive_flag_name(r$id)
    r$presentation$nombre_tecnico <- r$flag_name
    # El hallazgo exige revision; esta regla nunca elimina registros de forma
    # automatica ni propone una transformacion irreversible.
    r$remediation_default <- "ignore"
    out[[length(out) + 1L]] <- r
  }
  out
}

# Respuestas casi iguales: con qué otro caso coincide cada una
# ---------------------------------------------------------------------------
# La regla `OP_duplicates` marca las dos entrevistas de cada pareja que
# coincide (`.vd_duplicate_similarity()`), pero solo guarda la marca: la
# pantalla no podía decir con quién coincide cada una. Esto arma las parejas
# sobre las filas que la regla YA marcó (el compañero de una fila marcada está
# marcado también), con el mismo criterio: de las preguntas que al menos uno
# de los dos respondió, coinciden en una proporción >= `threshold`, y esas
# comparables son al menos `minimum_coverage` del total de preguntas.
# Devuelve un data.frame con una fila por pareja ordenada (fila_a < fila_b):
# fila_a, fila_b (índices en `data`), n_comparables, n_coincidencias y
# similitud (n_coincidencias / n_comparables).
validacion_parejas_casi_iguales <- function(data, vars, marcadas,
                                            threshold = 0.90,
                                            minimum_coverage = 0.80) {
  vacio <- data.frame(fila_a = integer(), fila_b = integer(), n_comparables = integer(),
                      n_coincidencias = integer(), similitud = numeric())
  filas <- which(as.logical(marcadas) %in% TRUE)
  vars <- unique(as.character(vars))
  if (length(filas) < 2L || !is.data.frame(data) || !length(vars) ||
      !all(vars %in% names(data))) {
    return(vacio)
  }
  normalizar <- function(x) {
    v <- enc2utf8(as.character(x))
    v[is.na(v)] <- ""
    v <- tolower(gsub("[[:space:]]+", " ", trimws(v), perl = TRUE))
    v[is.na(v)] <- ""
    v
  }
  valores <- do.call(cbind, lapply(data[filas, vars, drop = FALSE], normalizar))
  if (is.null(dim(valores))) valores <- matrix(valores, nrow = length(filas))
  vacias <- valores == ""
  p <- length(vars)
  min_comparables <- ceiling(minimum_coverage * p - 1e-12)

  partes <- list()
  for (a in seq_len(length(filas) - 1L)) {
    otros <- seq.int(a + 1L, length(filas))
    comparables <- !(vacias[otros, , drop = FALSE] &
                       matrix(vacias[a, ], nrow = length(otros), ncol = p, byrow = TRUE))
    iguales <- comparables & (valores[otros, , drop = FALSE] ==
                                matrix(valores[a, ], nrow = length(otros), ncol = p, byrow = TRUE))
    n_comp <- rowSums(comparables)
    n_ig <- rowSums(iguales)
    ok <- n_comp >= min_comparables & n_comp > 0 & (n_ig / pmax(n_comp, 1)) + 1e-12 >= threshold
    if (any(ok)) {
      partes[[length(partes) + 1L]] <- data.frame(
        fila_a = filas[a], fila_b = filas[otros[ok]],
        n_comparables = as.integer(n_comp[ok]), n_coincidencias = as.integer(n_ig[ok]),
        similitud = n_ig[ok] / n_comp[ok]
      )
    }
  }
  if (!length(partes)) return(vacio)
  do.call(rbind, partes)
}

# Las parejas de la regla de respuestas casi iguales en una evaluación
# guardada, con los ids de caso. Lee las preguntas y los umbrales del predicado
# de la regla tal como se auditó (`evaluacion$bundle`), no de la configuración
# vigente: si alguien cambió el umbral después, la pareja tiene que ser la de
# la auditoría. NULL si la regla no está o no se puede reconstruir.
validacion_parejas_de_evaluacion <- function(evaluacion, id_regla = "OP_duplicates",
                                             identidad = NULL) {
  res <- evaluacion$resumen
  if (is.null(res) || !nrow(res) || !(id_regla %in% as.character(res$id_regla))) return(NULL)
  regla <- Find(function(r) identical(as.character(r$id %||% ""), id_regla),
                evaluacion$bundle$rules %||% list())
  nodo <- .validacion_nodo_similitud(regla$predicate)
  if (is.null(nodo)) return(NULL)
  vars <- as.character(unlist(nodo$vars %||% character(0)))
  thr <- suppressWarnings(as.numeric(nodo$threshold %||% NA))[1]
  cov <- suppressWarnings(as.numeric(nodo$minimum_coverage %||% NA))[1]
  if (!length(vars) || is.na(thr) || is.na(cov)) return(NULL)

  mapa <- .limpieza_rule_case_map(evaluacion, id_regla, identidad)
  df <- evaluacion$datos_tablas[[mapa$table]] %||% evaluacion$datos
  if (!is.data.frame(df)) return(NULL)
  marcadas <- seq_len(nrow(df)) %in% mapa$row_idx
  parejas <- validacion_parejas_casi_iguales(df, vars, marcadas, thr, cov)
  ids <- .limpieza_make_case_ids(df, mapa$table, identidad)
  parejas$id_caso_a <- ids[parejas$fila_a]
  parejas$id_caso_b <- ids[parejas$fila_b]
  parejas
}

# El nodo `duplicate_similarity` del predicado (puede venir dentro de un `and`
# con el filtro previo).
.validacion_nodo_similitud <- function(nodo) {
  if (!is.list(nodo)) return(NULL)
  if (all(c("vars", "threshold", "minimum_coverage") %in% names(nodo))) return(nodo)
  for (hijo in nodo) {
    hallado <- .validacion_nodo_similitud(hijo)
    if (!is.null(hallado)) return(hallado)
  }
  NULL
}

# Con qué casos coincide uno, en el formato que publican las rutas (NULL si no
# tiene pareja: quien publica decide cómo decirlo, nunca como lista vacía):
# [{ id_caso, similitud, n_comparables, n_coincidencias }].
validacion_coincidencias_de_caso <- function(parejas, id_caso) {
  if (is.null(parejas) || !nrow(parejas)) return(NULL)
  a <- parejas[parejas$id_caso_a == id_caso, , drop = FALSE]
  b <- parejas[parejas$id_caso_b == id_caso, , drop = FALSE]
  otros <- rbind(
    data.frame(id_caso = a$id_caso_b, similitud = a$similitud,
               n_comparables = a$n_comparables, n_coincidencias = a$n_coincidencias),
    data.frame(id_caso = b$id_caso_a, similitud = b$similitud,
               n_comparables = b$n_comparables, n_coincidencias = b$n_coincidencias)
  )
  if (!nrow(otros)) return(NULL)
  otros <- otros[order(-otros$similitud, otros$id_caso), , drop = FALSE]
  lapply(seq_len(nrow(otros)), function(k) list(
    id_caso = as.character(otros$id_caso[k]),
    similitud = as.numeric(otros$similitud[k]),
    n_comparables = as.integer(otros$n_comparables[k]),
    n_coincidencias = as.integer(otros$n_coincidencias[k])
  ))
}

validation_operational_append_rules <- function(bundle, config = NULL) {
  operational_ids <- c("OP_field_period", "OP_duplicates")
  existing <- Filter(function(rule) {
    !(as.character(rule$id %||% "") %in% operational_ids)
  }, bundle$rules %||% list())
  rules <- c(existing, validation_operational_rules(config))
  bundle$rules <- if (exists(".dedup_rules_exact", mode = "function")) {
    .dedup_rules_exact(rules)
  } else {
    rules
  }
  bundle$plan <- compile_rules_to_plan(bundle$rules)
  bundle$operational_config <- normalize_validation_operational_config(config)
  bundle
}

# Motor especifico para marcos y seleccion de aulas universitarias.

.cm_aulas_now_iso <- function() {
  format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
}

.cm_aulas_scalar <- function(x, default = "") {
  if (is.null(x) || length(x) == 0L) return(default)
  out <- as.character(x)[1]
  if (is.na(out)) default else trimws(out)
}

.cm_aulas_chr_vec <- function(x) {
  if (is.null(x)) return(character(0))
  if (is.data.frame(x)) x <- unlist(x, use.names = FALSE)
  if (is.list(x)) x <- unlist(x, use.names = FALSE)
  out <- trimws(as.character(x))
  out <- out[!is.na(out) & nzchar(out)]
  unique(out)
}

.cm_aulas_num <- function(x, default = NA_real_) {
  out <- suppressWarnings(as.numeric(x %||% default)[1])
  if (is.finite(out)) out else default
}

.cm_aulas_int <- function(x, default = 0L) {
  out <- suppressWarnings(as.integer(x %||% default)[1])
  if (is.finite(out)) out else default
}

.cm_aulas_bool <- function(x, default = FALSE) {
  if (is.null(x)) return(default)
  if (is.logical(x)) return(isTRUE(x[1]))
  key <- .cm_aulas_text_key(x)
  if (!nzchar(key)) return(default)
  key %in% c("1", "true", "t", "yes", "si", "s")
}

.cm_aulas_text_key <- function(x) {
  x <- trimws(tolower(as.character(x %||% "")))
  x[is.na(x)] <- ""
  x <- iconv(x, to = "ASCII//TRANSLIT", sub = "")
  x <- gsub("[`'´’]", "", x)
  x <- gsub("[^a-z0-9]+", "_", x)
  gsub("^_+|_+$", "", x)
}

.cm_aulas_hash <- function(x) {
  if (requireNamespace("digest", quietly = TRUE)) {
    return(as.character(digest::digest(x, algo = "sha256")))
  }
  raw <- charToRaw(paste(utils::capture.output(str(x)), collapse = "\n"))
  sprintf("sha256_unavailable_%s", as.integer(sum(as.integer(raw)) %% 1000000007L))
}

.cm_aulas_as_df <- function(x, label = "tabla") {
  if (is.null(x)) return(data.frame(stringsAsFactors = FALSE))
  if (is.data.frame(x)) return(as.data.frame(x, stringsAsFactors = FALSE, check.names = FALSE))
  if (!is.list(x)) {
    stop(sprintf("El insumo '%s' debe ser una tabla o una lista de filas.", label), call. = FALSE)
  }
  if (!length(x)) return(data.frame(stringsAsFactors = FALSE))
  row_like <- vapply(x, function(item) is.list(item) || is.data.frame(item), logical(1))
  if (all(row_like) && (is.null(names(x)) || !all(nzchar(names(x))))) {
    cols <- unique(unlist(lapply(x, names), use.names = FALSE))
    cols <- cols[!is.na(cols) & nzchar(cols)]
    out <- stats::setNames(lapply(cols, function(col) {
      vapply(x, function(row) .cm_aulas_scalar(row[[col]], ""), character(1))
    }), cols)
    return(as.data.frame(out, stringsAsFactors = FALSE, check.names = FALSE))
  }
  as.data.frame(x, stringsAsFactors = FALSE, check.names = FALSE)
}

.cm_aulas_records <- function(df, max_rows = Inf) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(list())
  if (is.finite(max_rows)) df <- utils::head(df, max_rows)
  lapply(seq_len(nrow(df)), function(i) as.list(df[i, , drop = FALSE]))
}

.cm_aulas_mode <- function(x, default = "") {
  x <- .cm_aulas_chr_vec(x)
  if (!length(x)) return(default)
  tab <- sort(table(x), decreasing = TRUE)
  names(tab)[1]
}

.cm_aulas_col <- function(df, candidates) {
  if (is.null(df) || !is.data.frame(df) || !ncol(df)) return("")
  candidates <- .cm_aulas_chr_vec(candidates)
  if (!length(candidates)) return("")
  nms <- names(df)
  exact <- intersect(candidates, nms)
  if (length(exact)) return(exact[[1]])
  nms_key <- .cm_aulas_text_key(nms)
  cand_key <- .cm_aulas_text_key(candidates)
  idx <- match(cand_key, nms_key, nomatch = 0L)
  idx <- idx[idx > 0L]
  if (length(idx)) return(nms[[idx[[1]]]])
  for (cand in cand_key[nzchar(cand_key)]) {
    reverse_hit <- vapply(
      nms_key,
      function(nm) nzchar(nm) && grepl(nm, cand, fixed = TRUE),
      logical(1)
    )
    hit <- which(grepl(cand, nms_key, fixed = TRUE) | reverse_hit)
    hit <- hit[nzchar(nms_key[hit])]
    if (length(hit)) return(nms[[hit[[1]]]])
  }
  ""
}

.cm_aulas_values <- function(df, col, default = "") {
  if (!is.data.frame(df) || !nrow(df)) return(character(0))
  col <- .cm_aulas_scalar(col, "")
  if (!nzchar(col) || !col %in% names(df)) return(rep(default, nrow(df)))
  out <- as.character(df[[col]])
  out[is.na(out)] <- default
  trimws(out)
}

.cm_aulas_num_values <- function(df, col, default = NA_real_) {
  if (!is.data.frame(df) || !nrow(df)) return(numeric(0))
  col <- .cm_aulas_scalar(col, "")
  if (!nzchar(col) || !col %in% names(df)) return(rep(default, nrow(df)))
  out <- suppressWarnings(as.numeric(df[[col]]))
  out[!is.finite(out)] <- default
  out
}

.cm_aulas_clean_table_names <- function(df) {
  if (!is.data.frame(df) || !length(names(df))) return(df)
  nms <- names(df)
  nms <- gsub("[\r\n]+", " ", nms)
  nms <- gsub("\\s+", " ", nms)
  nms <- gsub("\\.{3}[0-9]+$", "", nms)
  names(df) <- trimws(nms)
  df
}

.cm_aulas_contains_any <- function(x, patterns) {
  patterns <- .cm_aulas_text_key(.cm_aulas_chr_vec(patterns))
  patterns <- patterns[nzchar(patterns)]
  if (!length(patterns)) return(rep(FALSE, length(x)))
  key <- .cm_aulas_text_key(x)
  vapply(key, function(item) any(vapply(patterns, grepl, logical(1), x = item, fixed = TRUE)), logical(1))
}

.cm_aulas_config_mapping <- function(mapping = list()) {
  if (is.null(mapping) || !is.list(mapping)) mapping <- list()
  defaults <- list(
    student_id = c("student_id", "studentid", "codigo_pucp", "codigo_alumno", "cod_alumno", "codigo_estudiante", "id_estudiante", "alumno_id", "cod_pucp"),
    classroom_id = c("classroom_id", "aula_id", "curso_horario", "curso_horario_id", "course_schedule_id", "nrc", "crn", "seccion_horario"),
    course_id = c("course_id", "curso_id", "codigo_curso", "cod_curso", "clave_curso"),
    course_name = c("course_name", "nombre_del_curso", "nombre_curso", "nombre de curso", "nombre del curso", "asignatura", "curso_nombre", "curso"),
    section = c("section", "seccion", "grupo", "comision"),
    schedule = c("schedule", "horario", "dia_hora", "hora", "turno"),
    classroom_label = c("classroom_label", "sesiones_y_aula", "sesiones y aula", "aula", "salon", "ambiente", "local_aula"),
    modality = c("modality", "modalidad", "tipo_modalidad"),
    session_type = c("session_type", "tipo_sesion", "tipo_clase", "actividad"),
    teacher = c("teacher", "nombre_de_docente", "nombre_del_docente", "nombre de docente", "nombre del docente", "docente", "profesor", "profesora"),
    teacher_email = c("teacher_email", "correo_pucp_docente", "correo pucp docente", "correo_docente", "email_docente", "correo_pucp", "correo agora"),
    faculty = c("faculty", "facultad", "unidad", "escuela"),
    program = c("program", "programa", "carrera", "especialidad"),
    level = c("level", "nivel_del_curso", "nivel_curricular", "nivel_segun_creditos", "nivel", "nivel_estudios"),
    sex = c("sex", "sexo", "genero", "gender"),
    age = c("age", "edad"),
    condition = c("condition", "condicion_matricula", "condicion", "estado_matricula", "situacion", "condicion_del_curso"),
    enrolled_total = c("enrolled_total", "matriculados_poblacion", "matriculados_total", "matriculados población", "matriculados total", "matriculados", "inscritos", "vacantes_ocupadas")
  )
  out <- defaults
  for (nm in names(mapping)) {
    if (!nm %in% names(out)) next
    custom <- .cm_aulas_chr_vec(mapping[[nm]])
    if (length(custom)) out[[nm]] <- unique(c(custom, defaults[[nm]]))
  }
  out
}

.cm_aulas_objective_defaults <- function() {
  variables <- data.frame(
    dimension = c("faculty", "program", "level", "schedule", "modality", "size_group", "sex"),
    label = c("Facultad", "Programa", "Nivel/ciclo", "Horario", "Modalidad", "Tamaño de aula", "Sexo"),
    aula_col = c("faculty", "program", "level", "schedule", "modality", "size_group", "sex_top_1"),
    student_col = c("faculty", "program", "level", "", "", "", "sex"),
    weight = c(0.18, 0.14, 0.10, 0.10, 0.06, 0.08, 0.10),
    tolerance = c(0.025, 0.04, 0.05, 0.05, 0.03, 0.05, 0.025),
    source_preference = c("student", "student", "student", "aula", "aula", "aula", "student"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  list(
    schema = "calc_muestra_aulas_representativity_objective_v1",
    primary_unit = "estudiantes_unicos_elegibles",
    variables = variables,
    component_weights = list(
      balance = sum(variables$weight),
      unique_coverage = 0.10,
      duplicate_loss = 0.06,
      dispersion = 0.05,
      weight_stability = 0.02,
      reserve_depth = 0.01
    ),
    duplicate_loss_tolerance = 0.15,
    dispersion_tolerance = 0.15,
    weight_cv_warn = 0.50,
    weight_cv_critical = 1.00,
    reserve_depth_target = 1.00,
    missing_policy = "redistribute_active_weights"
  )
}

.cm_aulas_normalize_objective <- function(objective = list()) {
  if (is.null(objective) || !is.list(objective)) objective <- list()
  defaults <- .cm_aulas_objective_defaults()
  variables <- objective$variables %||% objective$variables_balance %||% defaults$variables
  variables <- .cm_aulas_as_df(variables, "objective.variables")
  if (!nrow(variables)) variables <- defaults$variables
  for (col in names(defaults$variables)) {
    if (!col %in% names(variables)) variables[[col]] <- defaults$variables[[col]][match(variables$dimension, defaults$variables$dimension)]
  }
  variables$dimension <- .cm_aulas_values(variables, "dimension", "")
  variables$label <- .cm_aulas_values(variables, "label", variables$dimension)
  variables$aula_col <- .cm_aulas_values(variables, "aula_col", variables$dimension)
  variables$student_col <- .cm_aulas_values(variables, "student_col", "")
  variables$source_preference <- .cm_aulas_values(variables, "source_preference", "aula")
  variables$weight <- suppressWarnings(as.numeric(variables$weight))
  variables$tolerance <- suppressWarnings(as.numeric(variables$tolerance))
  default_lookup <- defaults$variables
  for (i in seq_len(nrow(variables))) {
    hit <- match(variables$dimension[[i]], default_lookup$dimension)
    if (!is.finite(variables$weight[[i]]) || variables$weight[[i]] < 0) {
      variables$weight[[i]] <- if (!is.na(hit)) default_lookup$weight[[hit]] else 0.03
    }
    if (!is.finite(variables$tolerance[[i]]) || variables$tolerance[[i]] <= 0) {
      variables$tolerance[[i]] <- if (!is.na(hit)) default_lookup$tolerance[[hit]] else 0.05
    }
  }
  variables <- variables[nzchar(variables$dimension) & variables$weight > 0, , drop = FALSE]
  rownames(variables) <- NULL

  cw <- defaults$component_weights
  input_weights <- objective$component_weights %||% objective$pesos_componentes %||% list()
  if (!is.list(input_weights)) input_weights <- list()
  for (nm in names(cw)) cw[[nm]] <- max(0, .cm_aulas_num(input_weights[[nm]], cw[[nm]]))

  list(
    schema = "calc_muestra_aulas_representativity_objective_v1",
    primary_unit = .cm_aulas_scalar(objective$primary_unit %||% objective$unidad_primaria, defaults$primary_unit),
    variables = variables,
    component_weights = cw,
    duplicate_loss_tolerance = max(0.01, .cm_aulas_num(objective$duplicate_loss_tolerance %||% objective$tolerancia_repetidos, defaults$duplicate_loss_tolerance)),
    dispersion_tolerance = max(0.01, .cm_aulas_num(objective$dispersion_tolerance %||% objective$tolerancia_dispersion, defaults$dispersion_tolerance)),
    weight_cv_warn = max(0.01, .cm_aulas_num(objective$weight_cv_warn %||% objective$alerta_cv_pesos, defaults$weight_cv_warn)),
    weight_cv_critical = max(0.01, .cm_aulas_num(objective$weight_cv_critical %||% objective$critico_cv_pesos, defaults$weight_cv_critical)),
    reserve_depth_target = max(0.01, .cm_aulas_num(objective$reserve_depth_target %||% objective$profundidad_reserva_objetivo, defaults$reserve_depth_target)),
    missing_policy = .cm_aulas_scalar(objective$missing_policy %||% objective$politica_faltantes, defaults$missing_policy)
  )
}

calc_muestra_aulas_default_config <- function() {
  list(
    schema = "calc_muestra_aulas_config_v1",
    input_mode = "base_madre",
    mapping = .cm_aulas_config_mapping(),
    filters = list(
      require_adult = TRUE,
      min_age = 18L,
      require_undergraduate = TRUE,
      accepted_conditions = as.list(c("regular")),
      exclude_level_patterns = as.list(c("posgrado", "postgrado", "maestria", "master", "doctorado")),
      require_in_person = TRUE,
      exclude_modality_patterns = as.list(c("virtual", "remoto", "online", "distancia", "asincron")),
      exclude_session_patterns = list(),
      min_eligible_per_class = 15L
    ),
    selector = list(
      seed = 20260619L,
      n_aulas = 30L,
      replacement_waves = 11L,
      selector_engine = "cube_balanceado",
      method_family = "balanced_probability",
      strata_cols = as.list(c("faculty", "sex_top_1", "size_group")),
      balance_vars = as.list(c("faculty", "sex_top_1", "size_group", "program", "level")),
      spread_vars = as.list(c("program", "level", "schedule", "size_group")),
      candidate_pool_size = 500L,
      simulation_runs = 500L,
      mos_strategy = "eligible_yield_winsorized",
      coordination_mode = "permanent_random_number",
      duplicate_penalty = 1.35,
      pps_weight = 0.25,
      coverage_weight = 1,
      monte_carlo_n = 500L,
      nonresponse_policy = "disposition_codes_and_adjustments",
      replacement_policy = "reservas_coordinadas_sin_redisenar"
    ),
    objective = .cm_aulas_objective_defaults()
  )
}

.cm_aulas_engine_key <- function(x, default = "cube_balanceado") {
  key <- .cm_aulas_text_key(x)
  if (!nzchar(key)) key <- default
  if (key %in% c("pps_balanceado", "balanceado_pps", "balance_por_cuotas_y_tamano", "cube", "cube_method")) return("cube_balanceado")
  if (key %in% c("cube_balanceado", "muestreo_balanceado")) return("cube_balanceado")
  if (key %in% c("local_pivotal", "local_pivotal_balanceado", "local_cube", "lcube", "lpm2")) return("local_pivotal_balanceado")
  if (key %in% c("sistematico_pps", "pps_sistematico", "systematic_pps")) return("sistematico_pps")
  if (key %in% c("estratificado_aleatorio", "aleatorio_estratificado", "stratified_random")) return("estratificado_aleatorio")
  if (key %in% c("pool_controlado", "optimizacion_solape", "optimizacion_operativa", "candidate_pool")) return("pool_controlado")
  if (key %in% c("manual_auditable", "manual")) return("manual_auditable")
  default
}

.cm_aulas_method_family <- function(engine) {
  engine <- .cm_aulas_engine_key(engine)
  if (engine %in% c("cube_balanceado", "local_pivotal_balanceado")) return("balanced_probability")
  if (engine == "sistematico_pps") return("pps_probability")
  if (engine == "pool_controlado") return("probability_with_operational_optimization")
  if (engine == "estratificado_aleatorio") return("stratified_probability")
  "manual_auditable"
}

calc_muestra_aulas_normalize_config <- function(config = list()) {
  if (is.null(config) || !is.list(config)) config <- list()
  defaults <- calc_muestra_aulas_default_config()
  filters <- config$filters %||% config$filtros %||% list()
  if (!is.list(filters)) filters <- list()
  selector_input <- config$selector %||% config$seleccion %||% list()
  selector_label <- if (is.list(selector_input)) selector_input$selector %||% selector_input$selector_engine else selector_input
  selector <- selector_input
  if (!is.list(selector)) selector <- list()
  selector_engine <- .cm_aulas_engine_key(
    selector$selector_engine %||% selector$engine %||% selector_label %||% selector$metodo %||% config$selector_engine %||% config$engine %||% defaults$selector$selector_engine
  )
  method_family <- .cm_aulas_scalar(
    selector$method_family %||% selector$familia_metodo %||% config$method_family,
    .cm_aulas_method_family(selector_engine)
  )
  simulation_runs <- .cm_aulas_int(
    selector$simulation_runs %||% selector$monte_carlo_n %||% selector$simulaciones %||% config$simulation_runs %||% config$monte_carlo_n,
    defaults$selector$simulation_runs
  )
  objective_input <- config$objective %||% config$representativity_objective %||% config$objetivo_representatividad %||% list()
  list(
    schema = "calc_muestra_aulas_config_v1",
    input_mode = .cm_aulas_scalar(config$input_mode %||% config$modo_insumo, defaults$input_mode),
    mapping = .cm_aulas_config_mapping(config$mapping %||% config$mapeo %||% list()),
    filters = list(
      require_adult = .cm_aulas_bool(filters$require_adult %||% filters$solo_mayores, defaults$filters$require_adult),
      min_age = max(0L, .cm_aulas_int(filters$min_age %||% filters$edad_minima, defaults$filters$min_age)),
      require_undergraduate = .cm_aulas_bool(filters$require_undergraduate %||% filters$solo_pregrado, defaults$filters$require_undergraduate),
      accepted_conditions = as.list(.cm_aulas_chr_vec(filters$accepted_conditions %||% filters$condiciones_aceptadas %||% defaults$filters$accepted_conditions)),
      exclude_level_patterns = as.list(.cm_aulas_chr_vec(filters$exclude_level_patterns %||% defaults$filters$exclude_level_patterns)),
      require_in_person = .cm_aulas_bool(filters$require_in_person %||% filters$solo_presencial, defaults$filters$require_in_person),
      exclude_modality_patterns = as.list(.cm_aulas_chr_vec(filters$exclude_modality_patterns %||% defaults$filters$exclude_modality_patterns)),
      exclude_session_patterns = as.list(.cm_aulas_chr_vec(filters$exclude_session_patterns %||% filters$excluir_tipos_sesion %||% defaults$filters$exclude_session_patterns)),
      min_eligible_per_class = max(1L, .cm_aulas_int(filters$min_eligible_per_class %||% filters$min_elegibles_aula %||% config$min_elegibles_aula, defaults$filters$min_eligible_per_class))
    ),
    selector = list(
      seed = .cm_aulas_int(selector$seed %||% selector$semilla %||% config$semilla, defaults$selector$seed),
      n_aulas = max(1L, .cm_aulas_int(selector$n_aulas %||% selector$aulas_titulares %||% config$n_aulas, defaults$selector$n_aulas)),
      replacement_waves = max(0L, .cm_aulas_int(selector$replacement_waves %||% selector$bolsas_reemplazo %||% config$bolsas_reemplazo, defaults$selector$replacement_waves)),
      selector_engine = selector_engine,
      method_family = method_family,
      strata_cols = as.list(.cm_aulas_chr_vec(selector$strata_cols %||% selector$variables_estrato %||% config$estratos_selector %||% defaults$selector$strata_cols)),
      balance_vars = as.list(.cm_aulas_chr_vec(selector$balance_vars %||% selector$variables_balance %||% config$balance_vars %||% defaults$selector$balance_vars)),
      spread_vars = as.list(.cm_aulas_chr_vec(selector$spread_vars %||% selector$variables_dispersion %||% config$spread_vars %||% defaults$selector$spread_vars)),
      candidate_pool_size = max(1L, .cm_aulas_int(selector$candidate_pool_size %||% selector$muestras_candidatas %||% config$candidate_pool_size, defaults$selector$candidate_pool_size)),
      simulation_runs = max(0L, simulation_runs),
      mos_strategy = .cm_aulas_scalar(selector$mos_strategy %||% selector$estrategia_tamano %||% config$mos_strategy, defaults$selector$mos_strategy),
      coordination_mode = .cm_aulas_scalar(selector$coordination_mode %||% selector$modo_coordinacion %||% config$coordination_mode, defaults$selector$coordination_mode),
      duplicate_penalty = max(0, .cm_aulas_num(selector$duplicate_penalty %||% selector$penalizacion_repetidos %||% config$penalizacion_repetidos, defaults$selector$duplicate_penalty)),
      pps_weight = max(0, .cm_aulas_num(selector$pps_weight %||% config$pps_weight, defaults$selector$pps_weight)),
      coverage_weight = max(0, .cm_aulas_num(selector$coverage_weight %||% config$coverage_weight, defaults$selector$coverage_weight)),
      monte_carlo_n = max(0L, .cm_aulas_int(selector$monte_carlo_n %||% selector$simulaciones, simulation_runs)),
      nonresponse_policy = .cm_aulas_scalar(selector$nonresponse_policy %||% selector$politica_no_respuesta %||% config$nonresponse_policy, defaults$selector$nonresponse_policy),
      replacement_policy = .cm_aulas_scalar(selector$replacement_policy %||% selector$politica_reemplazos %||% config$replacement_policy, defaults$selector$replacement_policy)
    ),
    objective = .cm_aulas_normalize_objective(objective_input)
  )
}

.cm_aulas_read_table <- function(path, sheet = NULL) {
  ext <- tolower(tools::file_ext(path))
  if (ext %in% c("xlsx", "xls")) {
    if (!requireNamespace("readxl", quietly = TRUE)) {
      stop("El paquete R 'readxl' no esta instalado para leer Excel.", call. = FALSE)
    }
    sheet <- .cm_aulas_scalar(sheet, "")
    if (nzchar(sheet)) {
      return(.cm_aulas_clean_table_names(as.data.frame(readxl::read_excel(path, sheet = sheet), stringsAsFactors = FALSE, check.names = FALSE)))
    }
    return(.cm_aulas_clean_table_names(as.data.frame(readxl::read_excel(path), stringsAsFactors = FALSE, check.names = FALSE)))
  }
  if (ext %in% c("csv", "txt")) {
    return(.cm_aulas_clean_table_names(utils::read.csv(path, stringsAsFactors = FALSE, check.names = FALSE)))
  }
  stop(sprintf("Formato de marco no soportado: .%s", ext), call. = FALSE)
}

.cm_aulas_join_two_bases <- function(estudiantes, inscripciones, mapping) {
  estudiantes <- .cm_aulas_as_df(estudiantes, "estudiantes")
  inscripciones <- .cm_aulas_as_df(inscripciones, "inscripciones")
  if (!nrow(estudiantes) || !nrow(inscripciones)) {
    stop("Para el modo de dos bases se requieren estudiantes e inscripciones con filas.", call. = FALSE)
  }
  sid_est <- .cm_aulas_col(estudiantes, mapping$student_id)
  sid_ins <- .cm_aulas_col(inscripciones, mapping$student_id)
  if (!nzchar(sid_est) || !nzchar(sid_ins)) {
    stop("No se encontro identificador de estudiante en ambas bases.", call. = FALSE)
  }
  merge(
    inscripciones,
    estudiantes,
    by.x = sid_ins,
    by.y = sid_est,
    all.x = TRUE,
    sort = FALSE,
    suffixes = c("", "_estudiante")
  )
}

.cm_aulas_classroom_id <- function(raw, mapping) {
  direct_col <- .cm_aulas_col(raw, mapping$classroom_id)
  if (nzchar(direct_col) && .cm_aulas_text_key(direct_col) %in% c("curso", "course_id", "codigo_curso", "cod_curso", "clave_curso")) {
    direct_col <- ""
  }
  direct <- .cm_aulas_values(raw, direct_col, "")
  needs <- !nzchar(direct)
  if (!any(needs)) return(direct)
  course <- .cm_aulas_values(raw, .cm_aulas_col(raw, mapping$course_id), "")
  section <- .cm_aulas_values(raw, .cm_aulas_col(raw, mapping$section), "")
  schedule <- .cm_aulas_values(raw, .cm_aulas_col(raw, mapping$schedule), "")
  label <- .cm_aulas_values(raw, .cm_aulas_col(raw, mapping$classroom_label), "")
  fallback <- paste(course, section, schedule, label, sep = "::")
  fallback <- vapply(fallback, .cm_aulas_text_key, character(1))
  direct[needs] <- fallback[needs]
  direct
}

.cm_aulas_reason <- function(flags) {
  nms <- names(flags)
  hit <- nms[!flags]
  if (!length(hit)) return("")
  paste(hit, collapse = "|")
}

calc_muestra_aulas_construir <- function(base_madre = NULL, estudiantes = NULL, inscripciones = NULL, config = list()) {
  cfg <- calc_muestra_aulas_normalize_config(config)
  mapping <- cfg$mapping
  input_mode <- "base_madre"
  raw <- .cm_aulas_as_df(base_madre, "base_madre")
  if (!nrow(raw)) {
    input_mode <- "dos_bases"
    raw <- .cm_aulas_join_two_bases(estudiantes, inscripciones, mapping)
  }
  if (!nrow(raw)) {
    stop("No hay filas para construir el marco de aulas.", call. = FALSE)
  }

  sid_col <- .cm_aulas_col(raw, mapping$student_id)
  if (!nzchar(sid_col)) {
    stop("No se encontro columna de estudiante. Configura mapping$student_id.", call. = FALSE)
  }

  student_id <- .cm_aulas_values(raw, sid_col, "")
  classroom_id <- .cm_aulas_classroom_id(raw, mapping)
  course_id <- .cm_aulas_values(raw, .cm_aulas_col(raw, mapping$course_id), "")
  course_name <- .cm_aulas_values(raw, .cm_aulas_col(raw, mapping$course_name), "")
  section <- .cm_aulas_values(raw, .cm_aulas_col(raw, mapping$section), "")
  schedule <- .cm_aulas_values(raw, .cm_aulas_col(raw, mapping$schedule), "")
  classroom_label <- .cm_aulas_values(raw, .cm_aulas_col(raw, mapping$classroom_label), "")
  modality <- .cm_aulas_values(raw, .cm_aulas_col(raw, mapping$modality), "")
  session_type <- .cm_aulas_values(raw, .cm_aulas_col(raw, mapping$session_type), "")
  teacher <- .cm_aulas_values(raw, .cm_aulas_col(raw, mapping$teacher), "")
  teacher_email <- .cm_aulas_values(raw, .cm_aulas_col(raw, mapping$teacher_email), "")
  faculty <- .cm_aulas_values(raw, .cm_aulas_col(raw, mapping$faculty), "")
  program <- .cm_aulas_values(raw, .cm_aulas_col(raw, mapping$program), "")
  level <- .cm_aulas_values(raw, .cm_aulas_col(raw, mapping$level), "")
  sex <- .cm_aulas_values(raw, .cm_aulas_col(raw, mapping$sex), "")
  age <- .cm_aulas_num_values(raw, .cm_aulas_col(raw, mapping$age), NA_real_)
  condition <- .cm_aulas_values(raw, .cm_aulas_col(raw, mapping$condition), "")
  enrolled_total_row <- .cm_aulas_num_values(raw, .cm_aulas_col(raw, mapping$enrolled_total), NA_real_)

  sid_ok <- nzchar(student_id)
  age_ok <- rep(TRUE, length(student_id))
  if (isTRUE(cfg$filters$require_adult) && any(is.finite(age))) {
    age_ok <- is.finite(age) & age >= cfg$filters$min_age
  }
  condition_ok <- rep(TRUE, length(student_id))
  if (any(nzchar(condition)) && length(cfg$filters$accepted_conditions)) {
    condition_ok <- .cm_aulas_contains_any(condition, cfg$filters$accepted_conditions)
  }
  level_ok <- rep(TRUE, length(student_id))
  if (isTRUE(cfg$filters$require_undergraduate) && any(nzchar(level))) {
    level_ok <- !.cm_aulas_contains_any(level, cfg$filters$exclude_level_patterns)
  }
  modality_ok <- rep(TRUE, length(student_id))
  if (isTRUE(cfg$filters$require_in_person) && any(nzchar(modality))) {
    modality_ok <- !.cm_aulas_contains_any(modality, cfg$filters$exclude_modality_patterns)
  }
  session_ok <- rep(TRUE, length(student_id))
  if (length(cfg$filters$exclude_session_patterns) && any(nzchar(session_type))) {
    session_ok <- !.cm_aulas_contains_any(session_type, cfg$filters$exclude_session_patterns)
  }
  classroom_ok <- nzchar(classroom_id)
  eligible_student <- sid_ok & age_ok & condition_ok & level_ok
  eligible_row <- eligible_student & modality_ok & session_ok & classroom_ok

  reason_rows <- mapply(function(a, b, c, d, e, f, g) {
    .cm_aulas_reason(c(
      student_id = a,
      age = b,
      condition = c,
      level = d,
      modality = e,
      session_type = f,
      classroom_id = g
    ))
  }, sid_ok, age_ok, condition_ok, level_ok, modality_ok, session_ok, classroom_ok, USE.NAMES = FALSE)

  population_raw <- data.frame(
    student_id = student_id,
    faculty = faculty,
    program = program,
    level = level,
    sex = sex,
    eligible = eligible_student,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  population <- population_raw[population_raw$eligible & nzchar(population_raw$student_id), , drop = FALSE]
  population <- population[!duplicated(population$student_id), , drop = FALSE]
  rownames(population) <- NULL

  frame_base <- data.frame(
    row_id = seq_along(student_id),
    student_id = student_id,
    classroom_id = classroom_id,
    course_id = course_id,
    course_name = course_name,
    section = section,
    schedule = schedule,
    classroom_label = classroom_label,
    modality = modality,
    session_type = session_type,
    teacher = teacher,
    teacher_email = teacher_email,
    faculty = faculty,
    program = program,
    level = level,
    sex = sex,
    eligible_row = eligible_row,
    exclude_reason = reason_rows,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  group_ids <- unique(classroom_id[nzchar(classroom_id)])
  aula_rows <- lapply(group_ids, function(cid) {
    idx_all <- which(classroom_id == cid)
    idx <- idx_all[eligible_row[idx_all]]
    students <- unique(student_id[idx])
    students <- students[nzchar(students)]
    sex_values <- sex[idx]
    sex_tab <- sort(table(sex_values[nzchar(sex_values)]), decreasing = TRUE)
    enrolled_total <- suppressWarnings(max(enrolled_total_row[idx_all], na.rm = TRUE))
    if (!is.finite(enrolled_total)) enrolled_total <- length(unique(student_id[idx_all]))
    eligible_n <- length(students)
    included <- eligible_n >= cfg$filters$min_eligible_per_class
    data.frame(
      classroom_id = cid,
      label = .cm_aulas_mode(classroom_label[idx_all], cid),
      course_id = .cm_aulas_mode(course_id[idx_all], ""),
      course_name = .cm_aulas_mode(course_name[idx_all], ""),
      section = .cm_aulas_mode(section[idx_all], ""),
      schedule = .cm_aulas_mode(schedule[idx_all], ""),
      modality = .cm_aulas_mode(modality[idx_all], ""),
      session_type = .cm_aulas_mode(session_type[idx_all], ""),
      teacher = .cm_aulas_mode(teacher[idx_all], ""),
      teacher_email = .cm_aulas_mode(teacher_email[idx_all], ""),
      faculty = .cm_aulas_mode(faculty[idx_all], ""),
      program = .cm_aulas_mode(program[idx_all], ""),
      level = .cm_aulas_mode(level[idx_all], ""),
      eligible_n = as.integer(eligible_n),
      enrolled_total = as.integer(enrolled_total),
      unique_student_ids = paste(students, collapse = "|"),
      unique_student_hash = .cm_aulas_hash(students),
      sex_top_1 = if (length(sex_tab)) names(sex_tab)[1] else "",
      sex_top_1_n = if (length(sex_tab)) as.integer(sex_tab[[1]]) else 0L,
      sex_top_2 = if (length(sex_tab) >= 2L) names(sex_tab)[2] else "",
      sex_top_2_n = if (length(sex_tab) >= 2L) as.integer(sex_tab[[2]]) else 0L,
      eligible_ratio = if (enrolled_total > 0) round(eligible_n / enrolled_total, 4) else NA_real_,
      included = included,
      exclude_reason = if (included) "" else "min_eligible_per_class",
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  })
  aula_frame <- if (length(aula_rows)) do.call(rbind, aula_rows) else data.frame(stringsAsFactors = FALSE)
  rownames(aula_frame) <- NULL
  if (nrow(aula_frame)) {
    aula_frame$size_group <- cut(
      aula_frame$eligible_n,
      breaks = c(-Inf, 20, 30, 40, Inf),
      labels = c("G1", "G2", "G3", "G4"),
      right = TRUE
    )
    aula_frame$size_group <- as.character(aula_frame$size_group)
  }

  audit <- data.frame(
    metric = c(
      "input_mode", "input_rows", "eligible_student_rows", "population_n",
      "classroom_n", "classroom_included_n", "excluded_rows"
    ),
    value = c(
      input_mode,
      as.character(nrow(raw)),
      as.character(sum(eligible_student)),
      as.character(nrow(population)),
      as.character(nrow(aula_frame)),
      as.character(sum(aula_frame$included %in% TRUE)),
      as.character(sum(!eligible_row))
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  warnings <- character(0)
  if (!any(nzchar(modality))) warnings <- c(warnings, "No se encontro modalidad; no se pudo auditar presencialidad.")
  if (!any(nzchar(condition))) warnings <- c(warnings, "No se encontro condicion academica; no se pudo aplicar filtro regular.")
  if (!any(nzchar(level))) warnings <- c(warnings, "No se encontro nivel; no se pudo excluir posgrado de forma automatica.")

  out <- list(
    schema = "calc_muestra_aulas_frame_v1",
    generated_at = .cm_aulas_now_iso(),
    input_mode = input_mode,
    config = cfg,
    frame_hash = .cm_aulas_hash(list(aula_frame = aula_frame, cfg = cfg$filters)),
    population = population,
    aula_frame = aula_frame,
    exclusions = frame_base[!eligible_row, c("row_id", "student_id", "classroom_id", "exclude_reason"), drop = FALSE],
    audit = audit,
    warnings = as.list(warnings),
    methodology = list(
      unit_observation = "estudiante",
      sampling_unit = "curso_horario_aula",
      construction = "Base madre estudiante x curso_horario o join estudiantes + inscripciones; colapso a aula por curso_horario.",
      anonymity = "El marco puede contener identificadores internos para diseno; monitoreo no exige student_id en respuestas."
    )
  )
  out
}

.cm_aulas_student_ids <- function(x) {
  x <- .cm_aulas_scalar(x, "")
  if (!nzchar(x)) return(character(0))
  out <- unlist(strsplit(x, "[|]", perl = TRUE), use.names = FALSE)
  out <- trimws(out)
  out[!is.na(out) & nzchar(out)]
}

.cm_aulas_quota_by_stratum <- function(df, n_total) {
  strata <- unique(df$stratum)
  weights <- vapply(strata, function(st) sum(df$eligible_n[df$stratum == st], na.rm = TRUE), numeric(1))
  weights[!is.finite(weights) | weights <= 0] <- 1
  if (n_total <= 0L || !length(strata)) return(stats::setNames(integer(0), character(0)))
  if (n_total < length(strata)) {
    keep <- order(weights, decreasing = TRUE)[seq_len(n_total)]
    return(stats::setNames(rep(1L, n_total), strata[keep]))
  }
  raw <- n_total * weights / sum(weights)
  q <- floor(raw)
  q[q < 1L] <- 1L
  while (sum(q) > n_total) {
    idx <- which(q > 1L)
    if (!length(idx)) break
    drop <- idx[which.max(q[idx] - raw[idx])]
    q[drop] <- q[drop] - 1L
  }
  while (sum(q) < n_total) {
    add <- which.max(raw - q)
    q[add] <- q[add] + 1L
  }
  stats::setNames(as.integer(q), strata)
}

.cm_aulas_make_stratum <- function(aula_frame, strata_cols) {
  cols <- intersect(.cm_aulas_chr_vec(strata_cols), names(aula_frame))
  if (!length(cols)) return(rep("global", nrow(aula_frame)))
  parts <- aula_frame[, cols, drop = FALSE]
  out <- apply(parts, 1, function(row) {
    values <- trimws(as.character(row))
    values <- values[!is.na(values) & nzchar(values)]
    if (!length(values)) "sin_estrato" else paste(values, collapse = " / ")
  })
  out[!nzchar(out)] <- "sin_estrato"
  out
}

.cm_aulas_methodological_sources <- function() {
  data.frame(
    decision_id = c(
      "classroom_cluster",
      "pps_benchmark",
      "cube_balanced",
      "r_implementation",
      "local_pivotal",
      "weights",
      "nonresponse",
      "replacement_reserves",
      "quality_report"
    ),
    decision_metodologica = c(
      "Aula o curso-horario como unidad seleccionable",
      "Seleccion proporcional al tamano como benchmark",
      "Muestreo balanceado como motor recomendado",
      "Implementacion reproducible en R",
      "Balance con dispersion multidimensional",
      "Probabilidades y pesos de diseno",
      "No respuesta y codigos de disposicion",
      "Reservas coordinadas sin rediseno silencioso",
      "Reporte de calidad y trazabilidad"
    ),
    regla_app = c(
      "No seleccionar filas alumno-curso como unidad final.",
      "Mantener sistematico_pps como benchmark auditable y fallback.",
      "Usar cube_balanceado cuando hay auxiliares confiables.",
      "Preferir sampling::samplecube(); registrar version/fallback.",
      "Usar local_pivotal_balanceado solo si BalancedSampling esta disponible.",
      "Producir pi_base, pi_design, pi_final y pesos asociados.",
      "Registrar politica de no respuesta y ajustes posteriores.",
      "Activar M2...Mk como reservas equivalentes, no como sobremuestra.",
      "Exportar diagnosticos, errores, fuentes y advertencias."
    ),
    official_reference = c(
      "OECD PISA 2022 Technical Report; IEA TIMSS/PIRLS; NCES/NAEP",
      "OECD PISA 2022 Technical Report",
      "Statistics Canada Survey Methodology",
      "",
      "",
      "UN Statistics Division; Eurostat; NCES/NAEP",
      "AAPOR Standard Definitions; NCES/NAEP",
      "",
      "Eurostat Sampling Reference Guidelines"
    ),
    academic_reference = c(
      "",
      "",
      "Deville & Tille, Efficient balanced sampling: the cube method",
      "Deville & Tille; Tille balanced sampling literature",
      "Grafstrom & Tille; local pivotal/local cube literature",
      "",
      "",
      "Groves & Heeringa, responsive design",
      ""
    ),
    implementation_reference = c(
      "",
      "sampling::UPsystematic",
      "sampling::samplecube",
      "CRAN package sampling",
      "CRAN package BalancedSampling: lcube/lpm2",
      "",
      "",
      "",
      "openxlsx workbook export"
    ),
    official_url = c(
      "https://www.oecd.org/content/dam/oecd/en/publications/reports/2024/03/pisa-2022-technical-report_599753f0/01820d6d-en.pdf | https://timssandpirls.bc.edu/TIMSS2007/PDF/T07_TR_Chapter5.pdf | https://nces.ed.gov/nationsreportcard/tdw/weighting/",
      "https://www.oecd.org/content/dam/oecd/en/publications/reports/2024/03/pisa-2022-technical-report_599753f0/01820d6d-en.pdf",
      "https://www150.statcan.gc.ca/n1/pub/12-001-x/2011002/article/11609-eng.pdf",
      "",
      "",
      "https://unstats.un.org/unsd/demographic/sources/surveys/handbook23june05.pdf | https://ec.europa.eu/eurostat/documents/3859598/5901961/KS-RA-08-003-EN.PDF/833f7740-0589-47e1-99a5-c14878a2c1a8 | https://nces.ed.gov/nationsreportcard/tdw/weighting/",
      "https://aapor.org/wp-content/uploads/2023/05/Standards-Definitions-10th-edition.pdf | https://nces.ed.gov/nationsreportcard/tdw/weighting/",
      "",
      "https://ec.europa.eu/eurostat/documents/3859598/5901961/KS-RA-08-003-EN.PDF/833f7740-0589-47e1-99a5-c14878a2c1a8"
    ),
    academic_url = c(
      "",
      "",
      "https://academic.oup.com/biomet/article/91/4/893/459329",
      "https://academic.oup.com/biomet/article/91/4/893/459329",
      "https://cran.r-project.org/package=BalancedSampling",
      "",
      "",
      "https://srobp.isr.umich.edu/wp-content/uploads/2020/08/4-4-groves-heeringa-2006-responsive-design-0023.pdf",
      ""
    ),
    implementation_url = c(
      "",
      "https://rdrr.io/cran/sampling/",
      "https://rdrr.io/cran/sampling/man/samplecube.html",
      "https://rdrr.io/cran/sampling/man/samplecube.html",
      "https://cran.r-project.org/package=BalancedSampling",
      "",
      "",
      "",
      "https://ycphs.github.io/openxlsx/"
    ),
    implicancia_prosecnur = c(
      "El marco se colapsa por curso-horario y mantiene estudiantes solo para control interno.",
      "La app siempre puede comparar el selector avanzado contra una regla simple PPS.",
      "La seleccion busca reproducir cuotas y auxiliares del marco, no solo tamano.",
      "La bitacora guarda motor, semilla, fallback y advertencias.",
      "Modo avanzado para reducir concentracion por programa, nivel u horario.",
      "Las aulas seleccionadas salen con peso de aula y pesos estudiantiles agregados.",
      "Monitoreo mide caidas y sesgos sin exigir identificador personal en respuestas.",
      "Las reservas se trazan por ola y motivo, sin cambiar el marco base.",
      "El workbook permite auditoria metodologica y operativa."
    ),
    advertencia = c(
      "La encuesta puede ser anonima; no exportar PII estudiantil.",
      "PPS sobrerrepresenta tamanos grandes si no hay balance adicional.",
      "Si se optimiza entre candidatas, las probabilidades finales no son cube puro.",
      "Si falla el paquete, debe registrarse fallback.",
      "Si BalancedSampling no esta disponible, caer a cube o PPS.",
      "Los pesos finales deben usar pi_final, no una probabilidad intermedia.",
      "Los ajustes por no respuesta se documentan al cierre.",
      "Un reemplazo no debe confundirse con sobremuestra.",
      "La calidad se reporta incluso si hay fallback."
    ),
    technical_field = c(
      "sampling_unit",
      "selector_engine",
      "selector_engine",
      "implementation_reference",
      "selector_engine",
      "pi_final; weight_classroom; weight_student",
      "nonresponse_policy; nonresponse_adjustment_flag",
      "replacement_policy; wave; replacement_for",
      "diagnostics; methodological_warning"
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.cm_aulas_source_bundle <- function(engine) {
  engine <- .cm_aulas_engine_key(engine)
  sources <- .cm_aulas_methodological_sources()
  ids <- c("classroom_cluster", "pps_benchmark", "weights", "nonresponse", "replacement_reserves", "quality_report")
  if (engine %in% c("cube_balanceado", "pool_controlado")) ids <- unique(c(ids, "cube_balanced", "r_implementation"))
  if (engine == "local_pivotal_balanceado") ids <- unique(c(ids, "cube_balanced", "r_implementation", "local_pivotal"))
  if (engine == "sistematico_pps") ids <- unique(c(ids, "r_implementation"))
  active <- sources[sources$decision_id %in% ids, , drop = FALSE]
  list(
    method_source = paste(active$decision_metodologica, collapse = " | "),
    official_reference = paste(unique(active$official_reference[nzchar(active$official_reference)]), collapse = " | "),
    academic_reference = paste(unique(active$academic_reference[nzchar(active$academic_reference)]), collapse = " | "),
    implementation_reference = paste(unique(active$implementation_reference[nzchar(active$implementation_reference)]), collapse = " | "),
    active_sources = active
  )
}

.cm_aulas_measure_of_size <- function(df, selector) {
  eligible <- suppressWarnings(as.numeric(df$eligible_n))
  eligible[!is.finite(eligible) | eligible < 0] <- 0
  strategy <- .cm_aulas_text_key(selector$mos_strategy %||% "")
  if (strategy %in% c("uniforme", "equal", "igual")) return(rep(1, nrow(df)))
  if (strategy %in% c("eligible_yield_winsorized", "winsorized", "elegibles_winsorizados") && length(eligible)) {
    cap <- stats::quantile(eligible[eligible > 0], probs = 0.90, na.rm = TRUE, names = FALSE)
    if (is.finite(cap) && cap > 0) eligible <- pmin(eligible, cap)
  }
  eligible[eligible <= 0] <- 1
  eligible
}

.cm_aulas_inclusion_probabilities <- function(mos, n) {
  mos <- suppressWarnings(as.numeric(mos))
  mos[!is.finite(mos) | mos < 0] <- 0
  len <- length(mos)
  n <- min(max(0L, as.integer(n)), len)
  pik <- rep(0, len)
  if (!len || n <= 0L) return(pik)
  remaining <- seq_len(len)
  n_remaining <- n
  while (length(remaining) && n_remaining > 0L) {
    w <- mos[remaining]
    if (!(sum(w, na.rm = TRUE) > 0)) w <- rep(1, length(remaining))
    raw <- n_remaining * w / sum(w)
    certainty <- raw >= 1
    if (!any(certainty)) {
      pik[remaining] <- raw
      break
    }
    pik[remaining[certainty]] <- 1
    remaining <- remaining[!certainty]
    n_remaining <- n_remaining - sum(certainty)
  }
  pik <- pmin(1, pmax(0, pik))
  if (sum(pik) > 0 && abs(sum(pik) - n) > 1e-6) {
    adjustable <- which(pik > 0 & pik < 1)
    if (length(adjustable)) {
      pik[adjustable] <- pmin(1, pmax(0, pik[adjustable] * (n - sum(pik[-adjustable])) / sum(pik[adjustable])))
    }
  }
  pmin(1, pmax(0, pik))
}

.cm_aulas_balance_matrix <- function(df, vars) {
  vars <- intersect(.cm_aulas_chr_vec(vars), names(df))
  if (!length(vars)) return(matrix(1, nrow = nrow(df), ncol = 1, dimnames = list(NULL, "intercept")))
  data <- df[, vars, drop = FALSE]
  for (nm in names(data)) {
    if (is.numeric(data[[nm]])) {
      data[[nm]][!is.finite(data[[nm]])] <- 0
    } else {
      values <- .cm_aulas_values(data, nm, "sin_dato")
      values[!nzchar(values)] <- "sin_dato"
      data[[nm]] <- factor(values)
    }
  }
  mm <- tryCatch(stats::model.matrix(~ . - 1, data = data), error = function(e) NULL)
  if (is.null(mm) || !nrow(mm)) return(matrix(1, nrow = nrow(df), ncol = 1, dimnames = list(NULL, "intercept")))
  cbind(intercept = 1, mm)
}

.cm_aulas_fix_pick_count <- function(picked, pik, quota, seed = NULL) {
  if (!is.null(seed)) set.seed(seed)
  picked <- unique(as.integer(picked[is.finite(picked) & picked > 0]))
  quota <- as.integer(quota)
  universe <- seq_along(pik)
  if (length(picked) > quota) {
    keep <- sample(picked, quota, prob = pmax(pik[picked], 1e-9))
    return(sort(keep))
  }
  if (length(picked) < quota) {
    rest <- setdiff(universe, picked)
    add_n <- min(length(rest), quota - length(picked))
    if (add_n > 0L) {
      add <- sample(rest, add_n, prob = pmax(pik[rest], 1e-9))
      picked <- c(picked, add)
    }
  }
  sort(unique(picked))
}

.cm_aulas_pick_systematic <- function(pik, seed = NULL) {
  if (!is.null(seed)) set.seed(seed)
  if (requireNamespace("sampling", quietly = TRUE)) {
    out <- tryCatch(sampling::UPsystematic(pik), error = function(e) NULL)
    if (!is.null(out)) return(which(as.numeric(out) > 0))
  }
  quota <- as.integer(round(sum(pik)))
  if (quota <= 0L) return(integer(0))
  sample(seq_along(pik), min(quota, length(pik)), prob = pmax(pik, 1e-9))
}

.cm_aulas_pick_cube <- function(df, pik, selector, seed = NULL) {
  if (!is.null(seed)) set.seed(seed)
  if (!requireNamespace("sampling", quietly = TRUE)) return(NULL)
  x <- .cm_aulas_balance_matrix(df, selector$balance_vars)
  tryCatch(which(as.numeric(sampling::samplecube(x, pik, order = 1, comment = FALSE)) > 0), error = function(e) NULL)
}

.cm_aulas_pick_local <- function(df, pik, selector, seed = NULL) {
  if (!is.null(seed)) set.seed(seed)
  if (!requireNamespace("BalancedSampling", quietly = TRUE)) return(NULL)
  vars <- unique(c(.cm_aulas_chr_vec(selector$spread_vars), .cm_aulas_chr_vec(selector$balance_vars)))
  x <- .cm_aulas_balance_matrix(df, vars)
  out <- tryCatch({
    if (exists("lcube", where = asNamespace("BalancedSampling"), inherits = FALSE)) {
      get("lcube", envir = asNamespace("BalancedSampling"))(pik, x)
    } else if (exists("lpm2", where = asNamespace("BalancedSampling"), inherits = FALSE)) {
      get("lpm2", envir = asNamespace("BalancedSampling"))(pik, x)
    } else {
      NULL
    }
  }, error = function(e) NULL)
  if (is.null(out)) return(NULL)
  which(as.numeric(out) > 0)
}

.cm_aulas_pick_indices <- function(df, quota, selector, engine, seed = NULL) {
  quota <- min(nrow(df), max(0L, as.integer(quota)))
  if (quota <= 0L || !nrow(df)) {
    return(list(indices = integer(0), pik = numeric(nrow(df)), engine_used = engine, warning = character(0)))
  }
  if (quota >= nrow(df)) {
    return(list(indices = seq_len(nrow(df)), pik = rep(1, nrow(df)), engine_used = engine, warning = character(0)))
  }
  mos <- .cm_aulas_measure_of_size(df, selector)
  pik <- .cm_aulas_inclusion_probabilities(mos, quota)
  warnings <- character(0)
  engine_used <- engine
  picked <- NULL

  if (engine == "local_pivotal_balanceado") {
    picked <- .cm_aulas_pick_local(df, pik, selector, seed)
    if (is.null(picked)) {
      warnings <- c(warnings, "BalancedSampling::lcube/lpm2 no disponible o fallo; se uso sampling::samplecube().")
      engine_used <- "cube_balanceado"
    }
  }
  if (is.null(picked) && engine_used == "cube_balanceado") {
    picked <- .cm_aulas_pick_cube(df, pik, selector, seed)
    if (is.null(picked)) {
      warnings <- c(warnings, "sampling::samplecube() no disponible o fallo; se uso sistematico_pps.")
      engine_used <- "sistematico_pps"
    }
  }
  if (is.null(picked) && engine_used == "sistematico_pps") {
    picked <- .cm_aulas_pick_systematic(pik, seed)
  }
  if (is.null(picked) && engine_used == "estratificado_aleatorio") {
    if (!is.null(seed)) set.seed(seed)
    picked <- sample(seq_len(nrow(df)), quota)
  }
  if (is.null(picked) && engine_used == "manual_auditable") {
    warnings <- c(warnings, "manual_auditable no selecciona automaticamente; se uso sistematico_pps para producir una propuesta inicial.")
    engine_used <- "sistematico_pps"
    picked <- .cm_aulas_pick_systematic(pik, seed)
  }
  if (is.null(picked)) {
    warnings <- c(warnings, "No se pudo usar el motor solicitado; se uso muestreo aleatorio ponderado.")
    engine_used <- "weighted_random"
    if (!is.null(seed)) set.seed(seed)
    picked <- sample(seq_len(nrow(df)), quota, prob = pmax(pik, 1e-9))
  }
  picked <- .cm_aulas_fix_pick_count(picked, pik, quota, seed)
  list(indices = picked, pik = pik, engine_used = engine_used, warning = unique(warnings))
}

.cm_aulas_annotate_selection_metrics <- function(df, selector) {
  if (!nrow(df)) return(df)
  selected_students <- character(0)
  duplicate_penalty <- .cm_aulas_num(selector$duplicate_penalty, 1.25)
  coverage_weight <- .cm_aulas_num(selector$coverage_weight, 1)
  pps_weight <- .cm_aulas_num(selector$pps_weight, 0.15)
  unique_added <- numeric(nrow(df))
  duplicate_overlap <- numeric(nrow(df))
  score <- numeric(nrow(df))
  for (i in seq_len(nrow(df))) {
    ids <- .cm_aulas_student_ids(df$unique_student_ids[[i]])
    overlap <- length(intersect(ids, selected_students))
    added <- length(setdiff(ids, selected_students))
    duplicate_overlap[[i]] <- overlap
    unique_added[[i]] <- added
    score[[i]] <- coverage_weight * added -
      duplicate_penalty * overlap +
      pps_weight * log1p(.cm_aulas_num(df$eligible_n[[i]], 0))
    selected_students <- unique(c(selected_students, ids))
  }
  df$selector_score <- score
  df$unique_added <- unique_added
  df$duplicate_overlap <- duplicate_overlap
  df
}

.cm_aulas_select_once_engine <- function(aula_frame, selector, engine, seed = NULL) {
  if (!is.null(seed)) set.seed(seed)
  n_total <- min(nrow(aula_frame), max(1L, .cm_aulas_int(selector$n_aulas, 1L)))
  quotas <- .cm_aulas_quota_by_stratum(aula_frame, n_total)
  rows <- list()
  warnings <- character(0)
  engine_used <- character(0)
  for (st in names(quotas)) {
    quota <- quotas[[st]]
    cand <- aula_frame[aula_frame$stratum == st, , drop = FALSE]
    if (!nrow(cand)) next
    picked <- .cm_aulas_pick_indices(cand, quota, selector, engine, seed = if (is.null(seed)) NULL else seed + length(rows) + 13L)
    warnings <- c(warnings, picked$warning)
    engine_used <- c(engine_used, picked$engine_used)
    if (!length(picked$indices)) next
    row <- cand[picked$indices, , drop = FALSE]
    row$pi_design_candidate <- as.numeric(picked$pik[picked$indices])
    rows[[length(rows) + 1L]] <- row
  }
  out <- if (length(rows)) do.call(rbind, rows) else aula_frame[0, , drop = FALSE]
  rownames(out) <- NULL
  out <- .cm_aulas_annotate_selection_metrics(out, selector)
  attr(out, "engine_used") <- if (length(engine_used)) paste(unique(engine_used), collapse = "|") else engine
  attr(out, "warnings") <- unique(warnings)
  out
}

.cm_aulas_candidate_score <- function(df, aula_frame, selector, objective = NULL) {
  if (!nrow(df)) return(-Inf)
  frame_result <- list(
    schema = "calc_muestra_aulas_frame_candidate_v1",
    aula_frame = aula_frame,
    population = data.frame(stringsAsFactors = FALSE),
    config = list(selector = selector, objective = objective %||% .cm_aulas_objective_defaults())
  )
  obj <- tryCatch(
    calc_muestra_aulas_representativity_objective(frame_result, df, selector, objective),
    error = function(e) NULL
  )
  if (!is.null(obj) && is.finite(obj$representativity_score)) {
    return(obj$representativity_score - 2 * sum(df$duplicate_overlap, na.rm = TRUE))
  }
  duplicate_penalty <- .cm_aulas_num(selector$duplicate_penalty, 1.25)
  coverage_weight <- .cm_aulas_num(selector$coverage_weight, 1)
  pps_weight <- .cm_aulas_num(selector$pps_weight, 0.15)
  coverage_weight * sum(df$unique_added, na.rm = TRUE) -
    duplicate_penalty * sum(df$duplicate_overlap, na.rm = TRUE) +
    pps_weight * sum(log1p(suppressWarnings(as.numeric(df$eligible_n))), na.rm = TRUE)
}

.cm_aulas_select_once_pool <- function(aula_frame, selector, seed = NULL, objective = NULL) {
  pool <- max(1L, .cm_aulas_int(selector$candidate_pool_size, 100L))
  pool_engine <- .cm_aulas_engine_key(selector$pool_base_engine %||% "cube_balanceado")
  best <- NULL
  best_score <- -Inf
  warnings <- character(0)
  used <- character(0)
  for (i in seq_len(pool)) {
    cand <- .cm_aulas_select_once_engine(aula_frame, selector, pool_engine, seed = if (is.null(seed)) NULL else seed + i)
    score <- .cm_aulas_candidate_score(cand, aula_frame, selector, objective)
    warnings <- c(warnings, attr(cand, "warnings") %||% character(0))
    used <- c(used, attr(cand, "engine_used") %||% pool_engine)
    if (is.null(best) || score > best_score) {
      best <- cand
      best_score <- score
    }
  }
  if (is.null(best)) best <- aula_frame[0, , drop = FALSE]
  attr(best, "engine_used") <- paste(unique(c("pool_controlado", used)), collapse = "|")
  attr(best, "warnings") <- unique(warnings)
  best
}

.cm_aulas_select_once_dispatch <- function(aula_frame, selector, engine, seed = NULL, objective = NULL) {
  if (engine == "pool_controlado") return(.cm_aulas_select_once_pool(aula_frame, selector, seed, objective))
  .cm_aulas_select_once_engine(aula_frame, selector, engine, seed)
}

.cm_aulas_select_waves <- function(aula_frame, selector, engine, waves, seed = NULL, objective = NULL) {
  selected_global <- character(0)
  rows <- list()
  warnings <- character(0)
  used <- character(0)
  for (wave_idx in seq_along(waves)) {
    wave <- waves[[wave_idx]]
    candidates <- aula_frame[!aula_frame$classroom_id %in% selected_global, , drop = FALSE]
    if (!nrow(candidates)) break
    picked <- .cm_aulas_select_once_dispatch(candidates, selector, engine, seed = if (is.null(seed)) NULL else seed + wave_idx * 1009L, objective = objective)
    if (!nrow(picked)) next
    warnings <- c(warnings, attr(picked, "warnings") %||% character(0))
    used <- c(used, attr(picked, "engine_used") %||% engine)
    picked$wave <- wave
    selected_global <- unique(c(selected_global, picked$classroom_id))
    rows[[length(rows) + 1L]] <- picked
  }
  out <- if (length(rows)) do.call(rbind, rows) else aula_frame[0, , drop = FALSE]
  rownames(out) <- NULL
  attr(out, "engine_used") <- if (length(used)) paste(unique(used), collapse = "|") else engine
  attr(out, "warnings") <- unique(warnings)
  out
}

.cm_aulas_design_probabilities <- function(aula_frame, selector, engine) {
  n_total <- min(nrow(aula_frame), max(1L, .cm_aulas_int(selector$n_aulas, 1L)))
  quotas <- .cm_aulas_quota_by_stratum(aula_frame, n_total)
  out <- stats::setNames(rep(0, nrow(aula_frame)), aula_frame$classroom_id)
  for (st in names(quotas)) {
    idx <- which(aula_frame$stratum == st)
    if (!length(idx)) next
    mos <- .cm_aulas_measure_of_size(aula_frame[idx, , drop = FALSE], selector)
    out[idx] <- .cm_aulas_inclusion_probabilities(mos, quotas[[st]])
  }
  out
}

.cm_aulas_mc_probabilities <- function(aula_frame, selector, engine, waves, runs, objective = NULL) {
  runs <- max(0L, as.integer(runs))
  if (runs <= 0L) {
    return(list(pi = stats::setNames(rep(NA_real_, nrow(aula_frame)), aula_frame$classroom_id), note = "No ejecutada.", runs = 0L, error = NA_real_))
  }
  sim_selector <- selector
  if (.cm_aulas_engine_key(engine) == "pool_controlado") {
    sim_selector$candidate_pool_size <- min(max(5L, .cm_aulas_int(selector$mc_candidate_pool_size, 25L)), max(5L, .cm_aulas_int(selector$candidate_pool_size, 25L)))
  }
  counts <- stats::setNames(rep(0L, nrow(aula_frame)), aula_frame$classroom_id)
  for (i in seq_len(runs)) {
    sim <- .cm_aulas_select_waves(aula_frame, sim_selector, engine, waves, seed = selector$seed + i * 7919L, objective = objective)
    counts[unique(sim$classroom_id)] <- counts[unique(sim$classroom_id)] + 1L
  }
  pi <- counts / runs
  se <- sqrt(pmax(pi * (1 - pi), 0) / runs)
  list(
    pi = pi,
    note = sprintf("Simulacion ejecutada con %s corridas sobre el plan completo de olas%s.", runs, if (.cm_aulas_engine_key(engine) == "pool_controlado") sprintf(" y pool presupuestado de %s candidatas", sim_selector$candidate_pool_size) else ""),
    runs = runs,
    error = round(max(se, na.rm = TRUE), 6)
  )
}

.cm_aulas_student_probability_summary <- function(aula_frame, pi_final_lookup) {
  student_map <- list()
  for (i in seq_len(nrow(aula_frame))) {
    ids <- .cm_aulas_student_ids(aula_frame$unique_student_ids[[i]])
    if (!length(ids)) next
    cid <- aula_frame$classroom_id[[i]]
    for (sid in ids) student_map[[sid]] <- c(student_map[[sid]], cid)
  }
  student_pi <- vapply(student_map, function(cids) {
    probs <- as.numeric(pi_final_lookup[unique(cids)])
    probs <- probs[is.finite(probs) & probs >= 0]
    if (!length(probs)) return(NA_real_)
    1 - prod(1 - pmin(probs, 1))
  }, numeric(1))
  aula_pi <- vapply(seq_len(nrow(aula_frame)), function(i) {
    ids <- .cm_aulas_student_ids(aula_frame$unique_student_ids[[i]])
    vals <- student_pi[ids]
    vals <- vals[is.finite(vals)]
    if (!length(vals)) NA_real_ else mean(vals)
  }, numeric(1))
  stats::setNames(aula_pi, aula_frame$classroom_id)
}

.cm_aulas_selected_student_ids <- function(selection_df) {
  if (!is.data.frame(selection_df) || !nrow(selection_df)) return(character(0))
  col <- if ("unique_student_ids" %in% names(selection_df)) "unique_student_ids" else if ("unique_student_ids_frame" %in% names(selection_df)) "unique_student_ids_frame" else ""
  if (!nzchar(col)) return(character(0))
  unique(unlist(lapply(selection_df[[col]], .cm_aulas_student_ids), use.names = FALSE))
}

.cm_aulas_distribution_compare <- function(frame_values, selected_values, frame_weights = NULL, selected_weights = NULL,
                                           dimension = "", label = "", source = "", tolerance = 0.05) {
  frame_values <- trimws(as.character(frame_values %||% character(0)))
  selected_values <- trimws(as.character(selected_values %||% character(0)))
  frame_values[is.na(frame_values) | !nzchar(frame_values)] <- "sin_dato"
  selected_values[is.na(selected_values) | !nzchar(selected_values)] <- "sin_dato"
  frame_weights <- suppressWarnings(as.numeric(frame_weights %||% rep(1, length(frame_values))))
  selected_weights <- suppressWarnings(as.numeric(selected_weights %||% rep(1, length(selected_values))))
  if (length(frame_weights) != length(frame_values)) frame_weights <- rep(1, length(frame_values))
  if (length(selected_weights) != length(selected_values)) selected_weights <- rep(1, length(selected_values))
  frame_weights[!is.finite(frame_weights) | frame_weights < 0] <- 0
  selected_weights[!is.finite(selected_weights) | selected_weights < 0] <- 0
  cats <- sort(unique(c(frame_values, selected_values)))
  cats <- cats[nzchar(cats)]
  if (!length(cats) || !length(frame_values) || !length(selected_values)) {
    return(data.frame(stringsAsFactors = FALSE))
  }
  frame_total <- sum(frame_weights, na.rm = TRUE)
  selected_total <- sum(selected_weights, na.rm = TRUE)
  if (!(frame_total > 0) || !(selected_total > 0)) return(data.frame(stringsAsFactors = FALSE))
  rows <- lapply(cats, function(cat) {
    frame_n <- sum(frame_weights[frame_values == cat], na.rm = TRUE)
    selected_n <- sum(selected_weights[selected_values == cat], na.rm = TRUE)
    frame_prop <- frame_n / frame_total
    selected_prop <- selected_n / selected_total
    data.frame(
      dimension = dimension,
      variable = dimension,
      label = label,
      category = cat,
      source = source,
      frame_n = round(frame_n, 6),
      selected_n = round(selected_n, 6),
      frame_prop = round(frame_prop, 6),
      selected_prop = round(selected_prop, 6),
      error_balance = round(selected_prop - frame_prop, 6),
      abs_error = round(abs(selected_prop - frame_prop), 6),
      tolerance = tolerance,
      within_tolerance = abs(selected_prop - frame_prop) <= tolerance,
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  })
  do.call(rbind, rows)
}

.cm_aulas_dimension_distribution <- function(frame_result, aula_frame, selection_df, variable_cfg) {
  selected_m1 <- selection_df[selection_df$wave == "M1", , drop = FALSE]
  if (!nrow(selected_m1)) return(data.frame(stringsAsFactors = FALSE))
  dimension <- .cm_aulas_scalar(variable_cfg$dimension, "")
  label <- .cm_aulas_scalar(variable_cfg$label, dimension)
  tolerance <- .cm_aulas_num(variable_cfg$tolerance, 0.05)
  student_col <- .cm_aulas_scalar(variable_cfg$student_col, "")
  aula_col <- .cm_aulas_scalar(variable_cfg$aula_col, dimension)
  source_preference <- .cm_aulas_text_key(variable_cfg$source_preference)
  population <- .cm_aulas_as_df(frame_result$population %||% data.frame(stringsAsFactors = FALSE), "population")
  selected_ids <- .cm_aulas_selected_student_ids(selected_m1)

  if (source_preference == "student" && nzchar(student_col) && nrow(population) && student_col %in% names(population) &&
      "student_id" %in% names(population) && length(selected_ids)) {
    selected_pop <- population[population$student_id %in% selected_ids, , drop = FALSE]
    if (nrow(selected_pop)) {
      return(.cm_aulas_distribution_compare(
        frame_values = population[[student_col]],
        selected_values = selected_pop[[student_col]],
        frame_weights = rep(1, nrow(population)),
        selected_weights = rep(1, nrow(selected_pop)),
        dimension = dimension,
        label = label,
        source = "student_unique",
        tolerance = tolerance
      ))
    }
  }

  if (!nzchar(aula_col) || !aula_col %in% names(aula_frame) || !aula_col %in% names(selected_m1)) {
    return(data.frame(stringsAsFactors = FALSE))
  }
  .cm_aulas_distribution_compare(
    frame_values = aula_frame[[aula_col]],
    selected_values = selected_m1[[aula_col]],
    frame_weights = suppressWarnings(as.numeric(aula_frame$eligible_n %||% rep(1, nrow(aula_frame)))),
    selected_weights = suppressWarnings(as.numeric(selected_m1$eligible_n %||% rep(1, nrow(selected_m1)))),
    dimension = dimension,
    label = label,
    source = "classroom_weighted_by_eligible",
    tolerance = tolerance
  )
}

.cm_aulas_balance_metric_from_distribution <- function(dist, variable_cfg) {
  dimension <- .cm_aulas_scalar(variable_cfg$dimension, "")
  label <- .cm_aulas_scalar(variable_cfg$label, dimension)
  base_weight <- .cm_aulas_num(variable_cfg$weight, 0)
  tolerance <- .cm_aulas_num(variable_cfg$tolerance, 0.05)
  if (!nrow(dist)) {
    return(data.frame(
      metric_id = paste0("balance_", dimension),
      metric_group = "balance",
      label = label,
      base_weight = base_weight,
      active = FALSE,
      score = NA_real_,
      distance = NA_real_,
      avg_abs_error = NA_real_,
      max_abs_error = NA_real_,
      tolerance = tolerance,
      detail = "Variable no disponible en el marco o en la seleccion.",
      stringsAsFactors = FALSE,
      check.names = FALSE
    ))
  }
  avg_abs <- mean(dist$abs_error, na.rm = TRUE)
  max_abs <- max(dist$abs_error, na.rm = TRUE)
  penalty <- (avg_abs / tolerance) * 60 + (max_abs / (2 * tolerance)) * 40
  score <- round(max(0, 100 - min(100, penalty)), 1)
  data.frame(
    metric_id = paste0("balance_", dimension),
    metric_group = "balance",
    label = label,
    base_weight = base_weight,
    active = TRUE,
    score = score,
    distance = round(1 - score / 100, 6),
    avg_abs_error = round(avg_abs, 6),
    max_abs_error = round(max_abs, 6),
    tolerance = tolerance,
    detail = sprintf("Error medio %.1f pp; maximo %.1f pp.", 100 * avg_abs, 100 * max_abs),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.cm_aulas_weight_stability <- function(selection_df, selector = list()) {
  selected_m1 <- selection_df[selection_df$wave == "M1", , drop = FALSE]
  if (!nrow(selected_m1)) {
    return(list(cv = NA_real_, n_eff = NA_real_, n_eff_ratio = NA_real_, score = NA_real_, active = FALSE, detail = "Sin seleccion M1."))
  }
  weights <- suppressWarnings(as.numeric(selected_m1$weight_classroom %||% NA_real_))
  if (!length(weights) || all(!is.finite(weights))) {
    pi <- suppressWarnings(as.numeric(selected_m1$pi_design_candidate %||% selected_m1$pi_final %||% NA_real_))
    weights <- ifelse(is.finite(pi) & pi > 0, 1 / pi, NA_real_)
  }
  weights <- weights[is.finite(weights) & weights > 0]
  if (!length(weights)) {
    return(list(cv = NA_real_, n_eff = NA_real_, n_eff_ratio = NA_real_, score = NA_real_, active = FALSE, detail = "Sin probabilidades suficientes para pesos."))
  }
  cv <- if (mean(weights) > 0) stats::sd(weights) / mean(weights) else NA_real_
  n_eff <- if (sum(weights^2) > 0) (sum(weights)^2) / sum(weights^2) else NA_real_
  n_eff_ratio <- n_eff / length(weights)
  warn <- .cm_aulas_num(selector$weight_cv_warn, 0.5)
  critical <- .cm_aulas_num(selector$weight_cv_critical, 1.0)
  score <- if (!is.finite(cv)) {
    NA_real_
  } else if (cv <= warn) {
    100
  } else if (cv >= critical) {
    0
  } else {
    round(100 * (1 - (cv - warn) / (critical - warn)), 1)
  }
  list(
    cv = round(cv, 6),
    n_eff = round(n_eff, 6),
    n_eff_ratio = round(n_eff_ratio, 6),
    score = score,
    active = TRUE,
    detail = sprintf("CV pesos %.2f; n efectivo %.1f de %s.", cv, n_eff, length(weights))
  )
}

.cm_aulas_coverage_overlap <- function(aula_frame, selection_df, objective = list()) {
  selected_m1 <- selection_df[selection_df$wave == "M1", , drop = FALSE]
  selected_ids <- .cm_aulas_selected_student_ids(selected_m1)
  frame_n <- .cm_aulas_unique_students_n(aula_frame)
  exposure_n <- sum(suppressWarnings(as.numeric(selected_m1$eligible_n)), na.rm = TRUE)
  unique_covered <- length(selected_ids)
  if (!is.finite(exposure_n) || exposure_n <= 0) exposure_n <- unique_covered
  coverage_population_pct <- if (frame_n > 0) unique_covered / frame_n else NA_real_
  coverage_efficiency <- if (exposure_n > 0) unique_covered / exposure_n else NA_real_
  duplicate_loss <- if (exposure_n > 0) max(0, 1 - coverage_efficiency) else NA_real_
  dup_tol <- .cm_aulas_num(objective$duplicate_loss_tolerance, 0.15)
  coverage_score <- if (is.finite(coverage_efficiency)) round(100 * pmin(1, coverage_efficiency), 1) else NA_real_
  duplicate_score <- if (is.finite(duplicate_loss)) round(max(0, 100 * (1 - duplicate_loss / dup_tol)), 1) else NA_real_
  data.frame(
    metric = c("population_unique_students", "selected_unique_students", "selected_student_course_exposure", "coverage_population_pct", "coverage_efficiency", "duplicate_loss"),
    value = c(frame_n, unique_covered, exposure_n, round(coverage_population_pct, 6), round(coverage_efficiency, 6), round(duplicate_loss, 6)),
    score = c(NA, NA, NA, NA, coverage_score, duplicate_score),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.cm_aulas_dispersion_metric <- function(profile_distributions, objective) {
  if (!is.data.frame(profile_distributions) || !nrow(profile_distributions)) {
    return(list(score = NA_real_, max_excess = NA_real_, detail = "Sin distribuciones de perfil."))
  }
  vars <- profile_distributions[profile_distributions$dimension %in% c("program", "level", "schedule", "size_group"), , drop = FALSE]
  if (!nrow(vars)) return(list(score = NA_real_, max_excess = NA_real_, detail = "Sin variables de dispersion activas."))
  by_dim <- split(vars, vars$dimension)
  excess <- vapply(by_dim, function(df) {
    max(0, max(df$selected_prop, na.rm = TRUE) - max(df$frame_prop, na.rm = TRUE))
  }, numeric(1))
  max_excess <- max(excess, na.rm = TRUE)
  tol <- .cm_aulas_num(objective$dispersion_tolerance, 0.15)
  score <- round(max(0, 100 * (1 - max_excess / tol)), 1)
  list(score = score, max_excess = round(max_excess, 6), detail = sprintf("Concentracion adicional maxima %.1f pp.", 100 * max_excess))
}

.cm_aulas_metric_row <- function(metric_id, metric_group, label, base_weight, active, score, distance = NA_real_, detail = "") {
  data.frame(
    metric_id = metric_id,
    metric_group = metric_group,
    label = label,
    base_weight = base_weight,
    active = isTRUE(active),
    score = if (is.finite(score)) round(score, 1) else NA_real_,
    distance = if (is.finite(distance)) round(distance, 6) else if (is.finite(score)) round(1 - score / 100, 6) else NA_real_,
    avg_abs_error = NA_real_,
    max_abs_error = NA_real_,
    tolerance = NA_real_,
    detail = detail,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

calc_muestra_aulas_representativity_objective <- function(frame_result, selection_df, selector = list(), objective = NULL) {
  objective <- .cm_aulas_normalize_objective(objective %||% frame_result$config$objective %||% list())
  aula_frame <- .cm_aulas_prepare_frame(frame_result, list(selector = selector %||% frame_result$config$selector %||% list()))
  selection_df <- .cm_aulas_as_df(selection_df, "selection_df")
  if (!"wave" %in% names(selection_df)) selection_df$wave <- "M1"
  if (!nrow(selection_df)) stop("Se requiere una seleccion para calcular representatividad.", call. = FALSE)

  profile_rows <- list()
  metric_rows <- list()
  for (i in seq_len(nrow(objective$variables))) {
    variable_cfg <- objective$variables[i, , drop = FALSE]
    dist <- .cm_aulas_dimension_distribution(frame_result, aula_frame, selection_df, variable_cfg)
    if (nrow(dist)) profile_rows[[length(profile_rows) + 1L]] <- dist
    metric_rows[[length(metric_rows) + 1L]] <- .cm_aulas_balance_metric_from_distribution(dist, variable_cfg)
  }
  profile_distributions <- if (length(profile_rows)) do.call(rbind, profile_rows) else data.frame(stringsAsFactors = FALSE)
  balance_metrics <- if (length(metric_rows)) do.call(rbind, metric_rows) else data.frame(stringsAsFactors = FALSE)

  coverage <- .cm_aulas_coverage_overlap(aula_frame, selection_df, objective)
  cov_score <- suppressWarnings(as.numeric(coverage$score[coverage$metric == "coverage_efficiency"][[1]] %||% NA_real_))
  dup_score <- suppressWarnings(as.numeric(coverage$score[coverage$metric == "duplicate_loss"][[1]] %||% NA_real_))
  dup_loss <- suppressWarnings(as.numeric(coverage$value[coverage$metric == "duplicate_loss"][[1]] %||% NA_real_))
  dispersion <- .cm_aulas_dispersion_metric(profile_distributions, objective)
  weight_stability <- .cm_aulas_weight_stability(selection_df, c(selector, objective))
  depth <- .cm_aulas_reserve_depth(selection_df)
  has_reserve <- nrow(depth) && any(depth$reservas > 0)
  reserve_ratio <- if (nrow(depth)) mean(depth$depth_ratio, na.rm = TRUE) else NA_real_
  reserve_score <- if (has_reserve) {
    round(100 * min(1, reserve_ratio / objective$reserve_depth_target), 1)
  } else {
    NA_real_
  }

  component_weights <- objective$component_weights
  component_metrics <- rbind(
    .cm_aulas_metric_row("unique_coverage", "coverage", "Cobertura unica", component_weights$unique_coverage, is.finite(cov_score), cov_score, detail = "Estudiantes unicos cubiertos frente a exposicion alumno-curso seleccionada."),
    .cm_aulas_metric_row("duplicate_loss", "overlap", "Perdida por repetidos", component_weights$duplicate_loss, is.finite(dup_score), dup_score, detail = sprintf("Perdida por duplicacion %.1f%%.", 100 * dup_loss)),
    .cm_aulas_metric_row("dispersion", "dispersion", "Evitar concentracion", component_weights$dispersion, is.finite(dispersion$score), dispersion$score, detail = dispersion$detail),
    .cm_aulas_metric_row("weight_stability", "weights", "Estabilidad de pesos", component_weights$weight_stability, isTRUE(weight_stability$active), weight_stability$score, detail = weight_stability$detail),
    .cm_aulas_metric_row("reserve_depth", "reserves", "Profundidad de reservas", component_weights$reserve_depth, has_reserve, reserve_score, detail = if (has_reserve) sprintf("Reservas/titulares promedio %.2f.", reserve_ratio) else "Sin reservas configuradas o generadas.")
  )
  metrics <- rbind(balance_metrics, component_metrics)
  active <- metrics$active %in% TRUE & is.finite(metrics$score) & is.finite(metrics$base_weight) & metrics$base_weight > 0
  metrics$normalized_weight <- 0
  if (any(active)) metrics$normalized_weight[active] <- metrics$base_weight[active] / sum(metrics$base_weight[active], na.rm = TRUE)
  overall <- if (any(active)) sum(metrics$score[active] * metrics$normalized_weight[active], na.rm = TRUE) else NA_real_
  weighted_distance <- if (is.finite(overall)) 1 - overall / 100 else NA_real_

  warnings <- character(0)
  missing <- metrics[!(metrics$active %in% TRUE), , drop = FALSE]
  if (nrow(missing)) warnings <- c(warnings, sprintf("Se redistribuyo peso de %s dimension(es) sin datos activos.", nrow(missing)))
  severe <- metrics[metrics$metric_group == "balance" & is.finite(metrics$max_abs_error) & is.finite(metrics$tolerance) & metrics$max_abs_error > 2 * metrics$tolerance, , drop = FALSE]
  if (nrow(severe)) warnings <- c(warnings, sprintf("Balance fuera de tolerancia severa en: %s.", paste(severe$label, collapse = ", ")))
  if (is.finite(dup_loss) && dup_loss > objective$duplicate_loss_tolerance) warnings <- c(warnings, "La perdida por estudiantes repetidos supera la tolerancia configurada.")
  if (isTRUE(weight_stability$active) && is.finite(weight_stability$cv) && weight_stability$cv > objective$weight_cv_critical) warnings <- c(warnings, "CV de pesos critico; revisar probabilidades o postestratificacion.")
  if (has_reserve && is.finite(reserve_ratio) && reserve_ratio < objective$reserve_depth_target) warnings <- c(warnings, "Profundidad de reservas menor al objetivo.")
  if (!length(warnings)) warnings <- "Sin alertas de representatividad bajo los criterios activos."

  list(
    schema = "calc_muestra_aulas_representativity_objective_v1",
    generated_at = .cm_aulas_now_iso(),
    objective_config = list(
      schema = objective$schema,
      primary_unit = objective$primary_unit,
      variables = objective$variables,
      component_weights = objective$component_weights,
      duplicate_loss_tolerance = objective$duplicate_loss_tolerance,
      dispersion_tolerance = objective$dispersion_tolerance,
      weight_cv_warn = objective$weight_cv_warn,
      weight_cv_critical = objective$weight_cv_critical,
      reserve_depth_target = objective$reserve_depth_target,
      missing_policy = objective$missing_policy
    ),
    overall_score = round(overall, 1),
    representativity_score = round(overall, 1),
    weighted_distance = round(weighted_distance, 6),
    profile_distributions = profile_distributions,
    metrics = metrics,
    coverage_overlap = coverage,
    weight_stability = data.frame(
      cv = weight_stability$cv,
      n_eff = weight_stability$n_eff,
      n_eff_ratio = weight_stability$n_eff_ratio,
      score = weight_stability$score,
      detail = weight_stability$detail,
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    reserve_depth = depth,
    warnings = as.list(unique(warnings))
  )
}

.cm_aulas_balance_diagnostic <- function(aula_frame, selection_df, vars) {
  vars <- intersect(.cm_aulas_chr_vec(vars), names(aula_frame))
  if (!length(vars) || !nrow(selection_df)) return(data.frame(stringsAsFactors = FALSE))
  selected_m1 <- selection_df[selection_df$wave == "M1", , drop = FALSE]
  rows <- list()
  for (var in vars) {
    frame_values <- .cm_aulas_values(aula_frame, var, "sin_dato")
    selected_values <- .cm_aulas_values(selected_m1, var, "sin_dato")
    cats <- sort(unique(c(frame_values, selected_values)))
    cats <- cats[nzchar(cats)]
    for (cat in cats) {
      frame_n <- sum(frame_values == cat)
      selected_n <- sum(selected_values == cat)
      frame_share <- if (length(frame_values)) frame_n / length(frame_values) else NA_real_
      selected_share <- if (length(selected_values)) selected_n / length(selected_values) else NA_real_
      rows[[length(rows) + 1L]] <- data.frame(
        variable = var,
        categoria = cat,
        marco_n = frame_n,
        seleccion_m1_n = selected_n,
        marco_prop = round(frame_share, 6),
        seleccion_m1_prop = round(selected_share, 6),
        diferencia_abs = round(abs(selected_share - frame_share), 6),
        stringsAsFactors = FALSE,
        check.names = FALSE
      )
    }
  }
  if (length(rows)) do.call(rbind, rows) else data.frame(stringsAsFactors = FALSE)
}

.cm_aulas_wave_diagnostic <- function(selection_df) {
  if (!nrow(selection_df)) return(data.frame(stringsAsFactors = FALSE))
  out <- stats::aggregate(
    classroom_id ~ wave + stratum,
    data = selection_df,
    FUN = length
  )
  names(out)[names(out) == "classroom_id"] <- "aulas"
  out
}

.cm_aulas_nonresponse_template <- function(selector) {
  data.frame(
    campo = c("nonresponse_policy", "disposition_codes", "adjustment", "anonymous_responses"),
    regla = c(
      .cm_aulas_scalar(selector$nonresponse_policy, "disposition_codes_and_adjustments"),
      "Registrar aplicada, parcial, sin_acceso, cancelada, reemplazada y cerrada.",
      "Ajuste posterior por dominio si hay caidas diferenciales.",
      "No exigir student_id; agregar por aula, collector, link y fecha."
    ),
    fuente = c(
      "AAPOR Standard Definitions; NCES/NAEP",
      "AAPOR Standard Definitions",
      "UN Statistics Division; Eurostat; NCES/NAEP",
      "ADR 0019 y politica de privacidad operativa"
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.cm_aulas_systematic_comparison <- function(aula_frame, selector, selection_df) {
  if (!nrow(aula_frame) || !nrow(selection_df)) return(data.frame(stringsAsFactors = FALSE))
  sys <- .cm_aulas_select_waves(aula_frame, selector, "sistematico_pps", c("M1"), seed = selector$seed + 404L)
  actual_m1 <- selection_df[selection_df$wave == "M1", , drop = FALSE]
  data.frame(
    criterio = c("aulas_m1", "estudiantes_unicos", "solape_repetidos"),
    selector_activo = c(
      nrow(actual_m1),
      sum(actual_m1$unique_added, na.rm = TRUE),
      sum(actual_m1$duplicate_overlap, na.rm = TRUE)
    ),
    sistematico_pps = c(
      nrow(sys),
      sum(sys$unique_added, na.rm = TRUE),
      sum(sys$duplicate_overlap, na.rm = TRUE)
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.cm_aulas_prepare_frame <- function(frame_result, cfg) {
  selector <- cfg$selector
  aula_frame <- .cm_aulas_as_df(frame_result$aula_frame, "aula_frame")
  if (!nrow(aula_frame)) stop("El marco no contiene aulas.", call. = FALSE)
  if (!"included" %in% names(aula_frame)) aula_frame$included <- TRUE
  included <- .cm_aulas_text_key(aula_frame$included) %in% c("true", "t", "1", "si", "s")
  if (is.logical(aula_frame$included)) included <- aula_frame$included %in% TRUE
  aula_frame <- aula_frame[included, , drop = FALSE]
  if (!nrow(aula_frame)) stop("No hay aulas elegibles despues de filtros.", call. = FALSE)
  aula_frame$eligible_n <- suppressWarnings(as.numeric(aula_frame$eligible_n))
  aula_frame$eligible_n[!is.finite(aula_frame$eligible_n)] <- 0
  aula_frame$stratum <- .cm_aulas_make_stratum(aula_frame, selector$strata_cols)
  aula_frame
}

.cm_aulas_unique_students_n <- function(df) {
  if (!nrow(df) || !"unique_student_ids" %in% names(df)) return(0L)
  length(unique(unlist(lapply(df$unique_student_ids, .cm_aulas_student_ids), use.names = FALSE)))
}

.cm_aulas_method_label <- function(engine) {
  labels <- c(
    sistematico_pps = "Selección proporcional al tamaño",
    cube_balanceado = "Selección balanceada",
    local_pivotal_balanceado = "Balanceada y distribuida",
    pool_controlado = "Optimizada para evitar repetidos",
    estratificado_aleatorio = "Aleatoria estratificada",
    manual_auditable = "Manual auditable"
  )
  labels[[.cm_aulas_engine_key(engine)]] %||% as.character(engine)
}

.cm_aulas_method_explanation <- function(engine) {
  engine <- .cm_aulas_engine_key(engine)
  if (engine == "sistematico_pps") return("Da más probabilidad a aulas con más estudiantes elegibles y funciona como benchmark simple.")
  if (engine == "cube_balanceado") return("Busca que las aulas seleccionadas reproduzcan el marco en facultad, programa, nivel, horario y tamaño.")
  if (engine == "local_pivotal_balanceado") return("Además de balancear, intenta dispersar la muestra para evitar concentración académica u operativa.")
  if (engine == "pool_controlado") return("Compara muestras candidatas y elige la que reduce mejor el solape, registrando probabilidades por simulación.")
  if (engine == "estratificado_aleatorio") return("Selecciona dentro de cada estrato sin optimización adicional.")
  "Requiere decisión documentada por el equipo metodológico."
}

.cm_aulas_balance_quality <- function(aula_frame, selection_df, selector) {
  vars <- intersect(.cm_aulas_chr_vec(selector$balance_vars), names(aula_frame))
  if (!length(vars)) vars <- intersect(.cm_aulas_chr_vec(selector$strata_cols), names(aula_frame))
  balance <- .cm_aulas_balance_diagnostic(aula_frame, selection_df, vars)
  if (!nrow(balance)) {
    return(list(score = 100, max_abs = 0, avg_abs = 0, table = balance))
  }
  balance$esperado_aulas <- round(balance$marco_prop * max(1, sum(selection_df$wave == "M1")), 2)
  balance$diferencia_aulas <- round(balance$seleccion_m1_n - balance$esperado_aulas, 2)
  avg_abs <- mean(balance$diferencia_abs, na.rm = TRUE)
  max_abs <- max(balance$diferencia_abs, na.rm = TRUE)
  list(
    score = round(max(0, 100 - 220 * avg_abs), 1),
    max_abs = round(max_abs, 6),
    avg_abs = round(avg_abs, 6),
    table = balance
  )
}

.cm_aulas_concentration_summary <- function(aula_frame, selection_df, var = "schedule") {
  if (!var %in% names(aula_frame) || !var %in% names(selection_df)) {
    return(list(score = 100, delta = 0, category = "", selected_share = 0, frame_share = 0))
  }
  frame_values <- .cm_aulas_values(aula_frame, var, "sin_dato")
  selected <- selection_df[selection_df$wave == "M1", , drop = FALSE]
  selected_values <- .cm_aulas_values(selected, var, "sin_dato")
  cats <- unique(c(frame_values, selected_values))
  cats <- cats[nzchar(cats)]
  if (!length(cats) || !length(selected_values)) {
    return(list(score = 100, delta = 0, category = "", selected_share = 0, frame_share = 0))
  }
  shares <- lapply(cats, function(cat) {
    frame_share <- sum(frame_values == cat) / max(1, length(frame_values))
    selected_share <- sum(selected_values == cat) / max(1, length(selected_values))
    data.frame(category = cat, frame_share = frame_share, selected_share = selected_share, delta = selected_share - frame_share)
  })
  tab <- do.call(rbind, shares)
  row <- tab[which.max(abs(tab$delta)), , drop = FALSE]
  list(
    score = round(max(0, 100 - 180 * max(0, row$delta)), 1),
    delta = round(row$delta, 6),
    category = row$category[[1]],
    selected_share = round(row$selected_share, 6),
    frame_share = round(row$frame_share, 6)
  )
}

.cm_aulas_reserve_depth <- function(selection_df) {
  if (!nrow(selection_df)) return(data.frame(stringsAsFactors = FALSE))
  titular <- stats::aggregate(classroom_id ~ stratum, data = selection_df[selection_df$wave == "M1", , drop = FALSE], FUN = length)
  names(titular)[names(titular) == "classroom_id"] <- "titulares"
  reserves <- selection_df[selection_df$wave != "M1", , drop = FALSE]
  if (nrow(reserves)) {
    reserve <- stats::aggregate(classroom_id ~ stratum, data = reserves, FUN = length)
    names(reserve)[names(reserve) == "classroom_id"] <- "reservas"
  } else {
    reserve <- data.frame(stratum = titular$stratum, reservas = 0L, stringsAsFactors = FALSE)
  }
  out <- merge(titular, reserve, by = "stratum", all.x = TRUE, sort = FALSE)
  out$reservas[!is.finite(out$reservas)] <- 0
  out$depth_ratio <- round(out$reservas / pmax(1, out$titulares), 4)
  out
}

.cm_aulas_risk_flags <- function(aula_frame, selection_df, selector, engine, engine_used, warnings, balance, concentration) {
  rows <- list()
  add <- function(code, severity, title, detail, method = .cm_aulas_engine_key(engine)) {
    rows[[length(rows) + 1L]] <<- data.frame(
      code = code,
      severity = severity,
      title = title,
      detail = detail,
      method = method,
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  }
  quotas <- .cm_aulas_quota_by_stratum(aula_frame, selector$n_aulas)
  for (st in names(quotas)) {
    available <- sum(aula_frame$stratum == st)
    if (quotas[[st]] > available) {
      add("quota_not_feasible", "alta", "Cuota no factible", sprintf("%s solicita %s aulas, pero solo existen %s elegibles.", st, quotas[[st]], available))
    }
  }
  if (is.finite(concentration$delta) && concentration$delta > 0.15) {
    add("high_schedule_concentration", "media", "Alta concentración horaria", sprintf("La categoría %s queda en %.1f%% de M1 frente a %.1f%% del marco.", concentration$category, 100 * concentration$selected_share, 100 * concentration$frame_share))
  }
  depth <- .cm_aulas_reserve_depth(selection_df)
  low <- depth[depth$reservas < pmax(1, depth$titulares), , drop = FALSE]
  if (nrow(low)) {
    add("low_reserve_depth", "media", "Baja profundidad de reservas", sprintf("%s celda(s) tienen menos reservas que titulares.", nrow(low)))
  }
  if (.cm_aulas_engine_key(engine) == "pool_controlado" && .cm_aulas_int(selector$simulation_runs, 0L) < 100L) {
    add("low_simulation_runs", "media", "Simulación insuficiente", "La optimización por candidatas requiere al menos 100 corridas para una lectura preliminar.")
  }
  if (length(warnings)) {
    add("method_fallback", "media", "Fallback metodológico", paste(unique(warnings), collapse = " | "))
  }
  if (!nrow(balance$table) || is.na(balance$score)) {
    add("balance_not_audited", "baja", "Balance no auditado", "No se encontraron variables de balance suficientes para el diagnóstico.")
  }
  if (!length(rows)) {
    add("no_critical_risk", "ok", "Sin alertas críticas", "La selección no presenta riesgos metodológicos críticos bajo los controles configurados.")
  }
  do.call(rbind, rows)
}

.cm_aulas_method_simulation_summary <- function(frame_result, aula_frame, selector, engine, objective, requested_runs = 0L) {
  requested_runs <- max(0L, .cm_aulas_int(requested_runs, 0L))
  if (requested_runs <= 0L) {
    return(data.frame(
      method_id = .cm_aulas_engine_key(engine),
      requested_runs = 0L,
      executed_runs = 0L,
      score_mean = NA_real_,
      score_sd = NA_real_,
      score_p10 = NA_real_,
      score_p90 = NA_real_,
      coverage_mean = NA_real_,
      duplicate_loss_mean = NA_real_,
      note = "Simulacion no solicitada.",
      stringsAsFactors = FALSE,
      check.names = FALSE
    ))
  }
  budget_runs <- if (nrow(aula_frame) > 1200L) min(requested_runs, 50L) else requested_runs
  local_selector <- selector
  if (.cm_aulas_engine_key(engine) == "pool_controlado") {
    local_selector$candidate_pool_size <- min(.cm_aulas_int(selector$candidate_pool_size, 25L), 25L)
  }
  scores <- numeric(budget_runs)
  coverage <- numeric(budget_runs)
  duplicate_loss <- numeric(budget_runs)
  waves <- c("M1")
  for (i in seq_len(budget_runs)) {
    selected <- .cm_aulas_select_waves(aula_frame, local_selector, engine, waves, seed = local_selector$seed + i * 3571L, objective = objective)
    design_pi <- .cm_aulas_design_probabilities(aula_frame, local_selector, engine)
    selected$pi_final <- as.numeric(design_pi[selected$classroom_id])
    selected$weight_classroom <- ifelse(selected$pi_final > 0, 1 / selected$pi_final, NA_real_)
    obj <- tryCatch(calc_muestra_aulas_representativity_objective(frame_result, selected, local_selector, objective), error = function(e) NULL)
    scores[[i]] <- if (!is.null(obj)) obj$representativity_score else NA_real_
    cov <- if (!is.null(obj)) obj$coverage_overlap else data.frame(stringsAsFactors = FALSE)
    coverage[[i]] <- suppressWarnings(as.numeric(cov$value[cov$metric == "coverage_population_pct"][[1]] %||% NA_real_))
    duplicate_loss[[i]] <- suppressWarnings(as.numeric(cov$value[cov$metric == "duplicate_loss"][[1]] %||% NA_real_))
  }
  data.frame(
    method_id = .cm_aulas_engine_key(engine),
    requested_runs = requested_runs,
    executed_runs = budget_runs,
    score_mean = round(mean(scores, na.rm = TRUE), 3),
    score_sd = round(stats::sd(scores, na.rm = TRUE), 3),
    score_p10 = round(stats::quantile(scores, 0.10, na.rm = TRUE, names = FALSE), 3),
    score_p90 = round(stats::quantile(scores, 0.90, na.rm = TRUE, names = FALSE), 3),
    coverage_mean = round(mean(coverage, na.rm = TRUE), 6),
    duplicate_loss_mean = round(mean(duplicate_loss, na.rm = TRUE), 6),
    note = if (budget_runs < requested_runs) {
      sprintf("Marco grande: se ejecutaron %s de %s corridas presupuestadas para mantener interactividad.", budget_runs, requested_runs)
    } else {
      sprintf("Simulacion ejecutada con %s corridas.", budget_runs)
    },
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.cm_aulas_run_method_summary <- function(frame_result, aula_frame, selector, engine, simulation_runs = NULL, objective = NULL) {
  engine <- .cm_aulas_engine_key(engine)
  local_selector <- selector
  local_selector$selector_engine <- engine
  if (!is.null(simulation_runs)) {
    local_selector$simulation_runs <- max(0L, .cm_aulas_int(simulation_runs, local_selector$simulation_runs %||% 0L))
    local_selector$monte_carlo_n <- local_selector$simulation_runs
  }
  waves <- c("M1", if (local_selector$replacement_waves > 0L) paste0("M", seq_len(local_selector$replacement_waves) + 1L) else character(0))
  selected <- .cm_aulas_select_waves(aula_frame, local_selector, engine, waves, seed = local_selector$seed, objective = objective)
  engine_used <- .cm_aulas_scalar(attr(selected, "engine_used"), engine)
  warnings <- attr(selected, "warnings") %||% character(0)
  design_pi <- .cm_aulas_design_probabilities(aula_frame, local_selector, engine)
  selected$pi_final <- as.numeric(design_pi[selected$classroom_id])
  selected$weight_classroom <- ifelse(selected$pi_final > 0, 1 / selected$pi_final, NA_real_)
  representativity <- calc_muestra_aulas_representativity_objective(frame_result, selected, local_selector, objective)
  balance <- .cm_aulas_balance_quality(aula_frame, selected, local_selector)
  concentration <- .cm_aulas_concentration_summary(aula_frame, selected, "schedule")
  m1 <- selected[selected$wave == "M1", , drop = FALSE]
  population_n <- .cm_aulas_unique_students_n(aula_frame)
  unique_covered <- sum(m1$unique_added, na.rm = TRUE)
  duplicate_total <- sum(m1$duplicate_overlap, na.rm = TRUE)
  coverage_pct <- if (population_n > 0) unique_covered / population_n else NA_real_
  reserve_depth <- .cm_aulas_reserve_depth(selected)
  reserve_ratio <- if (nrow(reserve_depth)) mean(reserve_depth$depth_ratio, na.rm = TRUE) else 0
  repetition_score <- round(max(0, 100 - 4 * duplicate_total), 1)
  coverage_score <- if (is.finite(coverage_pct)) round(min(100, 100 * coverage_pct * 1.25), 1) else 0
  reserve_score <- round(max(0, min(100, 70 + 15 * reserve_ratio)), 1)
  overall <- representativity$representativity_score
  probability_source <- if (engine == "pool_controlado") "monte_carlo_after_optimization" else "prescribed_design"
  risk_flags <- .cm_aulas_risk_flags(aula_frame, selected, local_selector, engine, engine_used, warnings, balance, concentration)
  simulation_summary <- .cm_aulas_method_simulation_summary(frame_result, aula_frame, local_selector, engine, objective, requested_runs = local_selector$simulation_runs)
  balance_metric_rows <- representativity$metrics[representativity$metrics$metric_group == "balance" & representativity$metrics$active %in% TRUE, , drop = FALSE]
  balance_score <- if (nrow(balance_metric_rows)) {
    round(stats::weighted.mean(balance_metric_rows$score, balance_metric_rows$normalized_weight, na.rm = TRUE), 1)
  } else {
    balance$score
  }
  coverage_metric <- representativity$coverage_overlap
  duplicate_loss <- suppressWarnings(as.numeric(coverage_metric$value[coverage_metric$metric == "duplicate_loss"][[1]] %||% NA_real_))
  metrics <- data.frame(
    method_id = engine,
    method_label = .cm_aulas_method_label(engine),
    engine_used = engine_used,
    probability_source = probability_source,
    balance_score = balance_score,
    repeated_students = duplicate_total,
    duplicate_loss = round(duplicate_loss, 6),
    repetition_score = suppressWarnings(as.numeric(representativity$metrics$score[representativity$metrics$metric_id == "duplicate_loss"][[1]] %||% repetition_score)),
    unique_students_covered = unique_covered,
    coverage_unique_pct = round(coverage_pct %||% NA_real_, 6),
    coverage_score = suppressWarnings(as.numeric(representativity$metrics$score[representativity$metrics$metric_id == "unique_coverage"][[1]] %||% coverage_score)),
    schedule_concentration_delta = concentration$delta,
    concentration_score = suppressWarnings(as.numeric(representativity$metrics$score[representativity$metrics$metric_id == "dispersion"][[1]] %||% concentration$score)),
    reserve_depth_ratio = round(reserve_ratio, 4),
    reserve_score = suppressWarnings(as.numeric(representativity$metrics$score[representativity$metrics$metric_id == "reserve_depth"][[1]] %||% reserve_score)),
    weight_cv = suppressWarnings(as.numeric(representativity$weight_stability$cv[[1]] %||% NA_real_)),
    n_eff_ratio = suppressWarnings(as.numeric(representativity$weight_stability$n_eff_ratio[[1]] %||% NA_real_)),
    representativity_score = overall,
    representativity_distance = representativity$weighted_distance,
    overall_score = overall,
    warnings = paste(unique(warnings), collapse = " | "),
    operational_reason = .cm_aulas_method_explanation(engine),
    methodological_reason = if (engine == "pool_controlado") {
      "Optimización posterior: las probabilidades finales deben estimarse por simulación."
    } else if (engine == "sistematico_pps") {
      "Benchmark PPS con probabilidades prescritas."
    } else {
      "Diseño probabilístico balanceado con probabilidades prescritas y fuentes auditables."
    },
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  list(
    metrics = metrics,
    selection = selected,
    balance = balance$table,
    representativity = representativity,
    simulation_summary = simulation_summary,
    reserve_depth = reserve_depth,
    risk_flags = risk_flags
  )
}

calc_muestra_aulas_comparar_metodos <- function(frame_result, config = list(), methods = NULL, simulation_runs = NULL) {
  cfg <- calc_muestra_aulas_normalize_config(config %||% frame_result$config %||% list())
  selector <- cfg$selector
  objective <- cfg$objective
  if (!is.null(simulation_runs)) {
    selector$simulation_runs <- max(0L, .cm_aulas_int(simulation_runs, selector$simulation_runs %||% 0L))
    selector$monte_carlo_n <- selector$simulation_runs
  }
  aula_frame <- .cm_aulas_prepare_frame(frame_result, cfg)
  methods <- .cm_aulas_chr_vec(methods %||% c("sistematico_pps", "cube_balanceado", "local_pivotal_balanceado", "pool_controlado"))
  methods <- unique(vapply(methods, .cm_aulas_engine_key, character(1)))
  runs <- lapply(methods, function(engine) .cm_aulas_run_method_summary(frame_result, aula_frame, selector, engine, simulation_runs = selector$simulation_runs, objective = objective))
  metrics <- do.call(rbind, lapply(runs, `[[`, "metrics"))
  risk_flags <- do.call(rbind, Map(function(run, engine) {
    out <- run$risk_flags
    out$method <- engine
    out
  }, runs, methods))
  balance <- do.call(rbind, Map(function(run, engine) {
    out <- run$balance
    if (!nrow(out)) return(data.frame(stringsAsFactors = FALSE))
    out$method_id <- engine
    out
  }, runs, methods))
  reserve_depth <- do.call(rbind, Map(function(run, engine) {
    out <- run$reserve_depth
    if (!nrow(out)) return(data.frame(stringsAsFactors = FALSE))
    out$method_id <- engine
    out
  }, runs, methods))
  representativity_metrics <- do.call(rbind, Map(function(run, engine) {
    out <- run$representativity$metrics
    if (!nrow(out)) return(data.frame(stringsAsFactors = FALSE))
    out$method_id <- engine
    out
  }, runs, methods))
  method_profiles <- do.call(rbind, Map(function(run, engine) {
    out <- run$representativity$profile_distributions
    if (!nrow(out)) return(data.frame(stringsAsFactors = FALSE))
    out$method_id <- engine
    out
  }, runs, methods))
  frame_profiles <- if (nrow(method_profiles)) {
    unique(method_profiles[, intersect(c("dimension", "variable", "label", "category", "source", "frame_n", "frame_prop"), names(method_profiles)), drop = FALSE])
  } else {
    data.frame(stringsAsFactors = FALSE)
  }
  simulation_summary <- do.call(rbind, lapply(runs, `[[`, "simulation_summary"))
  recommended_idx <- order(
    -metrics$representativity_score,
    metrics$representativity_distance,
    metrics$repeated_students,
    -metrics$coverage_unique_pct,
    metrics$method_id == "pool_controlado"
  )[[1]]
  recommended <- metrics[recommended_idx, , drop = FALSE]
  list(
    schema = "calc_muestra_aulas_method_comparison_v1",
    generated_at = .cm_aulas_now_iso(),
    frame_hash = .cm_aulas_scalar(frame_result$frame_hash, ""),
    methods = .cm_aulas_records(metrics),
    recommendation = list(
      method_id = recommended$method_id[[1]],
      method_label = recommended$method_label[[1]],
      operational_reason = recommended$operational_reason[[1]],
      methodological_reason = recommended$methodological_reason[[1]],
      overall_score = recommended$overall_score[[1]],
      representativity_score = recommended$representativity_score[[1]],
      representativity_distance = recommended$representativity_distance[[1]]
    ),
    objective_config = objective,
    frame_profiles = frame_profiles,
    method_profiles = method_profiles,
    representativity_metrics = representativity_metrics,
    simulation_summary = simulation_summary,
    balance = balance,
    reserve_depth = reserve_depth,
    risk_flags = risk_flags,
    simulation_runs = selector$simulation_runs,
    notes = list(
      "PPS se conserva como benchmark auditable.",
      "La optimizacion por solape cambia probability_source a monte_carlo_after_optimization.",
      "La comparacion no activa campo ni rediseña Monitoreo."
    )
  )
}

.cm_aulas_selection_private <- function(selection_result, aula_frame) {
  public <- .cm_aulas_as_df(selection_result$selection, "selection")
  if (!nrow(public)) return(public)
  lookup_cols <- intersect(c("classroom_id", "unique_student_ids", "eligible_n", "faculty", "program", "level", "schedule", "size_group"), names(aula_frame))
  lookup <- aula_frame[, lookup_cols, drop = FALSE]
  merge(public, lookup, by = "classroom_id", all.x = TRUE, sort = FALSE, suffixes = c("", "_frame"))
}

.cm_aulas_replacement_score <- function(titular, reserve) {
  ids_t <- .cm_aulas_student_ids(titular$unique_student_ids[[1]] %||% titular$unique_student_ids_frame[[1]] %||% "")
  ids_r <- .cm_aulas_student_ids(reserve$unique_student_ids[[1]] %||% reserve$unique_student_ids_frame[[1]] %||% "")
  overlap <- length(intersect(ids_t, ids_r))
  eligible_t <- .cm_aulas_num(titular$eligible_n[[1]], 0)
  eligible_r <- .cm_aulas_num(reserve$eligible_n[[1]], 0)
  score <- 0
  if (identical(.cm_aulas_scalar(titular$faculty[[1]], ""), .cm_aulas_scalar(reserve$faculty[[1]], ""))) score <- score + 35
  if (identical(.cm_aulas_scalar(titular$program[[1]], ""), .cm_aulas_scalar(reserve$program[[1]], ""))) score <- score + 25
  if (identical(.cm_aulas_scalar(titular$level[[1]], ""), .cm_aulas_scalar(reserve$level[[1]], ""))) score <- score + 12
  if (identical(.cm_aulas_scalar(titular$size_group[[1]], ""), .cm_aulas_scalar(reserve$size_group[[1]], ""))) score <- score + 8
  if (identical(.cm_aulas_scalar(titular$schedule[[1]], ""), .cm_aulas_scalar(reserve$schedule[[1]], ""))) score <- score + 6
  score <- score + max(0, 12 - abs(eligible_t - eligible_r) / max(1, eligible_t) * 12)
  score <- score - min(20, overlap * 2)
  list(score = round(score, 2), overlap = overlap, eligible_delta = eligible_r - eligible_t)
}

calc_muestra_aulas_simular_reemplazos <- function(frame_result, selection_result, config = list()) {
  if (is.null(selection_result) || !is.list(selection_result)) {
    stop("Se requiere una seleccion de aulas antes de simular reemplazos.", call. = FALSE)
  }
  cfg <- calc_muestra_aulas_normalize_config(config %||% frame_result$config %||% selection_result$selector %||% list())
  objective <- cfg$objective
  aula_frame <- .cm_aulas_prepare_frame(frame_result, cfg)
  selection_df <- .cm_aulas_selection_private(selection_result, aula_frame)
  if (!nrow(selection_df)) stop("La seleccion no contiene aulas.", call. = FALSE)
  titulars <- selection_df[selection_df$wave == "M1", , drop = FALSE]
  reserves <- selection_df[selection_df$wave != "M1", , drop = FALSE]
  before_obj <- calc_muestra_aulas_representativity_objective(frame_result, selection_df, cfg$selector, objective)
  suggestions <- list()
  impact <- list()
  for (i in seq_len(nrow(titulars))) {
    titular <- titulars[i, , drop = FALSE]
    candidates <- reserves
    if (!nrow(candidates)) next
    scores <- lapply(seq_len(nrow(candidates)), function(j) {
      local_score <- .cm_aulas_replacement_score(titular, candidates[j, , drop = FALSE])
      after_selection <- selection_df
      old_idx <- which(after_selection$classroom_id == titular$classroom_id[[1]] & after_selection$wave == "M1")[1]
      if (is.finite(old_idx)) {
        reserve_row <- candidates[j, , drop = FALSE]
        reserve_row$wave <- "M1"
        reserve_row$replacement_for <- titular$classroom_id[[1]]
        common <- intersect(names(after_selection), names(reserve_row))
        after_selection[old_idx, common] <- reserve_row[1, common]
      }
      after_obj <- tryCatch(calc_muestra_aulas_representativity_objective(frame_result, after_selection, cfg$selector, objective), error = function(e) NULL)
      local_score$before_score <- before_obj$representativity_score
      local_score$after_score <- if (!is.null(after_obj)) after_obj$representativity_score else NA_real_
      local_score$score_delta <- if (is.finite(local_score$after_score)) local_score$after_score - before_obj$representativity_score else NA_real_
      local_score$representativity_warning <- if (is.finite(local_score$score_delta) && local_score$score_delta < -10) {
        "El reemplazo reduce el score de representatividad en mas de 10 puntos."
      } else {
        ""
      }
      local_score
    })
    score_values <- vapply(scores, function(x) if (is.finite(x$after_score)) x$after_score else x$score, numeric(1))
    ord <- order(score_values, decreasing = TRUE)
    ord <- ord[seq_len(min(3L, length(ord)))]
    for (rank in seq_along(ord)) {
      reserve <- candidates[ord[[rank]], , drop = FALSE]
      score <- scores[[ord[[rank]]]]
      match_level <- if (.cm_aulas_scalar(titular$faculty[[1]], "") == .cm_aulas_scalar(reserve$faculty[[1]], "") &&
        .cm_aulas_scalar(titular$program[[1]], "") == .cm_aulas_scalar(reserve$program[[1]], "")) {
        "misma_celda"
      } else if (.cm_aulas_scalar(titular$faculty[[1]], "") == .cm_aulas_scalar(reserve$faculty[[1]], "")) {
        "celda_equivalente"
      } else {
        "celda_cercana"
      }
      suggestions[[length(suggestions) + 1L]] <- data.frame(
        titular_classroom_id = titular$classroom_id[[1]],
        titular_label = titular$course_name[[1]] %||% titular$label[[1]] %||% "",
        reserve_classroom_id = reserve$classroom_id[[1]],
        reserve_label = reserve$course_name[[1]] %||% reserve$label[[1]] %||% "",
        rank = rank,
        wave = reserve$wave[[1]],
        match_level = match_level,
        score = score$score,
        before_score = score$before_score,
        after_score = score$after_score,
        score_delta = score$score_delta,
        overlap_delta = score$overlap,
        eligible_delta = score$eligible_delta,
        reason = sprintf("%s; score %.1f -> %.1f; solape adicional %s; diferencia de elegibles %+s.", match_level, score$before_score, score$after_score, score$overlap, score$eligible_delta),
        warning = score$representativity_warning,
        stringsAsFactors = FALSE,
        check.names = FALSE
      )
    }
    best <- candidates[ord[[1]], , drop = FALSE]
    best_score <- scores[[ord[[1]]]]
    impact[[length(impact) + 1L]] <- data.frame(
      titular_classroom_id = titular$classroom_id[[1]],
      suggested_replacement_id = best$classroom_id[[1]],
      before_faculty = titular$faculty[[1]] %||% "",
      after_faculty = best$faculty[[1]] %||% "",
      before_program = titular$program[[1]] %||% "",
      after_program = best$program[[1]] %||% "",
      before_score = best_score$before_score,
      after_score = best_score$after_score,
      score_delta = best_score$score_delta,
      eligible_delta = best_score$eligible_delta,
      overlap_delta = best_score$overlap,
      balance_effect = if (identical(titular$stratum[[1]], best$stratum[[1]])) "mantiene_estrato" else "altera_estrato",
      warning = paste(c(
        if (identical(titular$stratum[[1]], best$stratum[[1]])) "" else "El reemplazo sugerido cambia la celda metodologica.",
        best_score$representativity_warning
      )[nzchar(c(
        if (identical(titular$stratum[[1]], best$stratum[[1]])) "" else "El reemplazo sugerido cambia la celda metodologica.",
        best_score$representativity_warning
      ))], collapse = " | "),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  }
  suggestions_df <- if (length(suggestions)) do.call(rbind, suggestions) else data.frame(stringsAsFactors = FALSE)
  impact_df <- if (length(impact)) do.call(rbind, impact) else data.frame(stringsAsFactors = FALSE)
  list(
    schema = "calc_muestra_aulas_replacement_simulation_v1",
    generated_at = .cm_aulas_now_iso(),
    selection_run_id = selection_result$selection_run_id %||% "",
    frame_hash = .cm_aulas_scalar(frame_result$frame_hash, ""),
    objective_config = before_obj$objective_config,
    planned_representativity = before_obj,
    suggestions = suggestions_df,
    impact = impact_df,
    summary = data.frame(
      metric = c("titulares", "reservas", "titulares_con_sugerencia", "sugerencias"),
      value = c(nrow(titulars), nrow(reserves), length(unique(suggestions_df$titular_classroom_id %||% character(0))), nrow(suggestions_df)),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
}

.cm_aulas_select_once <- function(aula_frame, selector, seed = NULL) {
  if (!is.null(seed)) set.seed(seed)
  n_total <- min(nrow(aula_frame), max(1L, .cm_aulas_int(selector$n_aulas, 1L)))
  quotas <- .cm_aulas_quota_by_stratum(aula_frame, n_total)
  selected <- list()
  selected_ids <- character(0)
  selected_students <- character(0)
  duplicate_penalty <- .cm_aulas_num(selector$duplicate_penalty, 1.25)
  coverage_weight <- .cm_aulas_num(selector$coverage_weight, 1)
  pps_weight <- .cm_aulas_num(selector$pps_weight, 0.15)

  for (st in names(quotas)) {
    quota <- quotas[[st]]
    for (slot in seq_len(quota)) {
      cand <- aula_frame[aula_frame$stratum == st & !aula_frame$classroom_id %in% selected_ids, , drop = FALSE]
      if (!nrow(cand)) next
      scores <- vapply(seq_len(nrow(cand)), function(i) {
        ids <- .cm_aulas_student_ids(cand$unique_student_ids[[i]])
        overlap <- length(intersect(ids, selected_students))
        unique_added <- length(setdiff(ids, selected_students))
        jitter <- stats::runif(1, 0, 1e-6)
        coverage_weight * unique_added -
          duplicate_penalty * overlap +
          pps_weight * log1p(.cm_aulas_num(cand$eligible_n[[i]], 0)) +
          jitter
      }, numeric(1))
      pick <- which.max(scores)
      row <- cand[pick, , drop = FALSE]
      ids <- .cm_aulas_student_ids(row$unique_student_ids[[1]])
      row$selector_score <- scores[[pick]]
      row$unique_added <- length(setdiff(ids, selected_students))
      row$duplicate_overlap <- length(intersect(ids, selected_students))
      selected[[length(selected) + 1L]] <- row
      selected_ids <- c(selected_ids, row$classroom_id[[1]])
      selected_students <- unique(c(selected_students, ids))
    }
  }
  if (!length(selected)) return(aula_frame[0, , drop = FALSE])
  out <- do.call(rbind, selected)
  rownames(out) <- NULL
  out
}

calc_muestra_aulas_seleccionar <- function(frame_result, config = list()) {
  if (is.null(frame_result) || !is.list(frame_result)) {
    stop("Se requiere un marco construido por calc_muestra_aulas_construir().", call. = FALSE)
  }
  cfg <- calc_muestra_aulas_normalize_config(config %||% frame_result$config %||% list())
  selector <- cfg$selector
  objective <- cfg$objective
  engine <- .cm_aulas_engine_key(selector$selector_engine)
  aula_frame <- .cm_aulas_as_df(frame_result$aula_frame, "aula_frame")
  if (!nrow(aula_frame)) stop("El marco no contiene aulas.", call. = FALSE)
  if (!"included" %in% names(aula_frame)) aula_frame$included <- TRUE
  included <- .cm_aulas_text_key(aula_frame$included) %in% c("true", "t", "1", "si", "s")
  if (is.logical(aula_frame$included)) included <- aula_frame$included %in% TRUE
  aula_frame <- aula_frame[included, , drop = FALSE]
  if (!nrow(aula_frame)) stop("No hay aulas elegibles despues de filtros.", call. = FALSE)
  aula_frame$eligible_n <- suppressWarnings(as.numeric(aula_frame$eligible_n))
  aula_frame$eligible_n[!is.finite(aula_frame$eligible_n)] <- 0
  aula_frame$stratum <- .cm_aulas_make_stratum(aula_frame, selector$strata_cols)

  waves <- c("M1", if (selector$replacement_waves > 0L) paste0("M", seq_len(selector$replacement_waves) + 1L) else character(0))
  selection_df <- .cm_aulas_select_waves(aula_frame, selector, engine, waves, seed = selector$seed, objective = objective)
  engine_used <- .cm_aulas_scalar(attr(selection_df, "engine_used"), engine)
  fallback_warnings <- attr(selection_df, "warnings") %||% character(0)
  if (!nrow(selection_df)) stop("No se pudo seleccionar aulas con el marco actual.", call. = FALSE)
  rownames(selection_df) <- NULL

  selection_run_id <- paste0("sel_aulas_", format(Sys.time(), "%Y%m%d%H%M%S"), "_", substr(.cm_aulas_hash(list(frame_result$frame_hash, selector$seed)), 1, 8))
  total_by_stratum <- stats::aggregate(eligible_n ~ stratum, data = aula_frame, FUN = sum)
  names(total_by_stratum)[names(total_by_stratum) == "eligible_n"] <- "stratum_eligible_n"
  selection_df <- merge(selection_df, total_by_stratum, by = "stratum", all.x = TRUE, sort = FALSE)
  selected_counts <- stats::aggregate(classroom_id ~ stratum + wave, data = selection_df, FUN = length)
  names(selected_counts)[names(selected_counts) == "classroom_id"] <- "selected_in_stratum_wave"
  selection_df <- merge(selection_df, selected_counts, by = c("stratum", "wave"), all.x = TRUE, sort = FALSE)

  design_pi <- .cm_aulas_design_probabilities(aula_frame, selector, engine)
  probability_source <- if (engine == "pool_controlado") "monte_carlo_after_optimization" else "prescribed_design"
  mc_runs <- if (probability_source == "monte_carlo_after_optimization") {
    max(.cm_aulas_int(selector$simulation_runs, 0L), .cm_aulas_int(selector$monte_carlo_n, 0L))
  } else {
    max(0L, .cm_aulas_int(selector$monte_carlo_n, 0L))
  }
  mc <- .cm_aulas_mc_probabilities(aula_frame, selector, engine, waves, runs = mc_runs, objective = objective)
  pi_mc_lookup <- mc$pi
  pi_final_lookup <- if (probability_source == "monte_carlo_after_optimization") pi_mc_lookup else design_pi
  student_pi_lookup <- .cm_aulas_student_probability_summary(aula_frame, pi_final_lookup)

  selection_df$pi_base <- as.numeric(design_pi[selection_df$classroom_id])
  selection_df$pi_design <- as.numeric(design_pi[selection_df$classroom_id])
  selection_df$pi_mc <- as.numeric(pi_mc_lookup[selection_df$classroom_id])
  selection_df$pi_final <- if (probability_source == "monte_carlo_after_optimization") selection_df$pi_mc else selection_df$pi_design
  missing_final <- !is.finite(selection_df$pi_final) | selection_df$pi_final <= 0
  if (probability_source != "monte_carlo_after_optimization") {
    selection_df$pi_final[missing_final] <- selection_df$pi_design[missing_final]
  }
  selection_df$probability_source <- probability_source
  selection_df$mc_runs <- mc$runs
  selection_df$mc_error_summary <- if (is.finite(mc$error)) sprintf("max_se=%s", mc$error) else mc$note
  selection_df$weight_classroom <- ifelse(selection_df$pi_final > 0, round(1 / selection_df$pi_final, 6), NA_real_)
  selection_df$pi_student <- as.numeric(student_pi_lookup[selection_df$classroom_id])
  selection_df$weight_student <- ifelse(selection_df$pi_student > 0, round(1 / selection_df$pi_student, 6), NA_real_)
  selection_df$nonresponse_adjustment_flag <- FALSE
  selection_df$poststratification_flag <- FALSE
  selection_df$weight_warning <- ifelse(
    !is.finite(selection_df$pi_student) | selection_df$pi_student <= 0,
    "Peso estudiantil agregado pendiente: aula sin estudiantes trazables o pi_mc nula en marco.",
    ""
  )
  selection_df$peso_base <- selection_df$weight_classroom
  selection_df$selection_run_id <- selection_run_id
  selection_df$orden <- ave(seq_len(nrow(selection_df)), selection_df$wave, FUN = seq_along)
  selection_df$estado <- "planificada"
  selection_df$replacement_for <- ""
  selection_df$student_ids_hash <- vapply(selection_df$unique_student_ids, function(x) .cm_aulas_hash(.cm_aulas_student_ids(x)), character(1))
  selection_df$method_source <- .cm_aulas_source_bundle(engine)$method_source
  selection_df$official_reference <- .cm_aulas_source_bundle(engine)$official_reference
  selection_df$academic_reference <- .cm_aulas_source_bundle(engine)$academic_reference
  selection_df$implementation_reference <- .cm_aulas_source_bundle(engine)$implementation_reference
  selection_df$weight_source <- "pi_final con peso de aula 1/pi_final; probabilidad estudiantil agregada desde marco interno."
  selection_df$nonresponse_policy <- .cm_aulas_scalar(selector$nonresponse_policy, "disposition_codes_and_adjustments")
  selection_df$replacement_policy <- .cm_aulas_scalar(selector$replacement_policy, "reservas_coordinadas_sin_redisenar")

  source_bundle <- .cm_aulas_source_bundle(engine)
  methodological_warning <- unique(c(
    fallback_warnings,
    if (probability_source == "monte_carlo_after_optimization") {
      "Se eligio la mejor muestra entre candidatas; pi_final usa simulacion Monte Carlo posterior a la optimizacion."
    } else {
      character(0)
    },
    if (engine == "local_pivotal_balanceado" && !grepl("local_pivotal_balanceado", engine_used, fixed = TRUE)) {
      "Modo local pivotal solicitado, pero el motor final uso fallback."
    } else {
      character(0)
    }
  ))
  if (!length(methodological_warning)) methodological_warning <- "Sin advertencias metodologicas criticas."
  selection_df$methodological_warning <- paste(methodological_warning, collapse = " | ")

  representativity <- calc_muestra_aulas_representativity_objective(frame_result, selection_df, selector, objective)
  selection_df$representativity_score <- representativity$representativity_score
  selection_df$representativity_distance <- representativity$weighted_distance

  public_cols <- c(
    "selection_run_id", "wave", "orden", "classroom_id", "label", "course_id",
    "course_name", "section", "schedule", "modality", "session_type", "teacher",
    "teacher_email", "faculty", "program", "level", "eligible_n", "enrolled_total",
    "size_group", "sex_top_1", "sex_top_1_n", "sex_top_2", "sex_top_2_n",
    "stratum", "pi_base", "pi_design", "pi_mc", "pi_final", "probability_source",
    "mc_runs", "mc_error_summary", "weight_classroom", "pi_student", "weight_student",
    "nonresponse_adjustment_flag", "poststratification_flag", "weight_warning",
    "peso_base", "selector_score", "unique_added", "duplicate_overlap",
    "representativity_score", "representativity_distance",
    "student_ids_hash", "estado", "replacement_for", "method_source",
    "official_reference", "academic_reference", "implementation_reference",
    "weight_source", "nonresponse_policy", "replacement_policy", "methodological_warning"
  )
  public_cols <- intersect(public_cols, names(selection_df))
  selection_public <- selection_df[, public_cols, drop = FALSE]

  summary <- data.frame(
    metric = c(
      "selection_run_id", "frame_hash", "seed", "selector_engine_requested",
      "selector_engine_used", "method_family", "probability_source", "mc_runs",
      "n_aulas_m1", "replacement_waves", "aulas_total_plan",
      "unique_students_covered", "duplicate_overlap_total",
      "representativity_score", "representativity_distance"
    ),
    value = c(
      selection_run_id,
      .cm_aulas_scalar(frame_result$frame_hash, ""),
      as.character(selector$seed),
      engine,
      engine_used,
      .cm_aulas_scalar(selector$method_family, .cm_aulas_method_family(engine)),
      probability_source,
      as.character(mc$runs),
      as.character(sum(selection_public$wave == "M1")),
      as.character(selector$replacement_waves),
      as.character(nrow(selection_public)),
      as.character(sum(selection_public$unique_added, na.rm = TRUE)),
      as.character(sum(selection_public$duplicate_overlap, na.rm = TRUE)),
      as.character(representativity$representativity_score),
      as.character(representativity$weighted_distance)
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  probabilities <- selection_public[, intersect(c(
    "selection_run_id", "wave", "classroom_id", "stratum", "eligible_n",
    "pi_base", "pi_design", "pi_mc", "pi_final", "probability_source",
    "mc_runs", "mc_error_summary", "weight_classroom", "pi_student",
    "weight_student", "weight_warning"
  ), names(selection_public)), drop = FALSE]
  balance <- .cm_aulas_balance_diagnostic(aula_frame, selection_df, selector$balance_vars)
  waves_diag <- .cm_aulas_wave_diagnostic(selection_df)
  nonresponse <- .cm_aulas_nonresponse_template(selector)
  systematic_comparison <- .cm_aulas_systematic_comparison(aula_frame, selector, selection_df)
  coverage_overlap <- representativity$coverage_overlap
  weight_stability <- representativity$weight_stability

  list(
    schema = "calc_muestra_aulas_selection_v1",
    selection_run_id = selection_run_id,
    generated_at = .cm_aulas_now_iso(),
    frame_hash = .cm_aulas_scalar(frame_result$frame_hash, ""),
    seed = selector$seed,
    selector = selector,
    selector_engine = engine,
    selector_engine_used = engine_used,
    method_family = .cm_aulas_scalar(selector$method_family, .cm_aulas_method_family(engine)),
    method_source = source_bundle$method_source,
    official_reference = source_bundle$official_reference,
    academic_reference = source_bundle$academic_reference,
    implementation_reference = source_bundle$implementation_reference,
    probability_source = probability_source,
    weight_source = "pi_final con peso de aula 1/pi_final; pi_student interno agregado por aula.",
    nonresponse_policy = .cm_aulas_scalar(selector$nonresponse_policy, "disposition_codes_and_adjustments"),
    replacement_policy = .cm_aulas_scalar(selector$replacement_policy, "reservas_coordinadas_sin_redisenar"),
    methodological_warning = as.list(methodological_warning),
    methodological_sources = source_bundle$active_sources,
    objective_config = representativity$objective_config,
    representativity = representativity,
    representativity_score = representativity$representativity_score,
    representativity_distance = representativity$weighted_distance,
    selection = selection_public,
    quotas = .cm_aulas_records(data.frame(stratum = names(.cm_aulas_quota_by_stratum(aula_frame, selector$n_aulas)), n_aulas = as.integer(.cm_aulas_quota_by_stratum(aula_frame, selector$n_aulas)), stringsAsFactors = FALSE)),
    summary = summary,
    diagnostics = list(
      probabilities = probabilities,
      balance = balance,
      profile_distributions = representativity$profile_distributions,
      representativity_metrics = representativity$metrics,
      coverage_overlap = coverage_overlap,
      weight_stability = weight_stability,
      reserve_depth = representativity$reserve_depth,
      waves = waves_diag,
      nonresponse = nonresponse,
      systematic_comparison = systematic_comparison
    ),
    methodology = list(
      design = "Muestreo estratificado de conglomerados aula/curso_horario con PPS sobre elegibles efectivos y variables auxiliares de balance.",
      selector = sprintf("Motor solicitado: %s. Motor usado: %s.", engine, engine_used),
      probabilities = sprintf("pi_base y pi_design desde el diseno; pi_final segun %s.", probability_source),
      monte_carlo = mc$note,
      weights = "weight_classroom = 1/pi_final; weight_student se calcula como agregado interno desde pi_student.",
      representativity = sprintf("Score de representatividad %.1f; distancia ponderada %.4f.", representativity$representativity_score, representativity$weighted_distance),
      warning = paste(methodological_warning, collapse = " | ")
    )
  )
}

calc_muestra_aulas_exportar_workbook <- function(frame_result, selection_result, path, comparison = NULL, replacement_simulation = NULL) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop("El paquete R 'openxlsx' no esta instalado.", call. = FALSE)
  }
  wb <- openxlsx::createWorkbook()
  write_sheet <- function(name, data) {
    openxlsx::addWorksheet(wb, name)
    openxlsx::writeData(wb, name, .cm_aulas_as_df(data, name))
  }
  openxlsx::addWorksheet(wb, "Marco aulas")
  openxlsx::writeData(wb, "Marco aulas", .cm_aulas_as_df(frame_result$aula_frame, "aula_frame"))
  openxlsx::addWorksheet(wb, "Seleccion")
  openxlsx::writeData(wb, "Seleccion", .cm_aulas_as_df(selection_result$selection, "selection"))
  openxlsx::addWorksheet(wb, "Auditoria marco")
  openxlsx::writeData(wb, "Auditoria marco", .cm_aulas_as_df(frame_result$audit, "audit"))
  openxlsx::addWorksheet(wb, "Resumen seleccion")
  openxlsx::writeData(wb, "Resumen seleccion", .cm_aulas_as_df(selection_result$summary, "summary"))
  write_sheet("Sustento metodológico", selection_result$methodological_sources %||% .cm_aulas_methodological_sources())
  write_sheet("Probabilidades y pesos", selection_result$diagnostics$probabilities %||% data.frame(stringsAsFactors = FALSE))
  write_sheet("Diagnóstico de balance", selection_result$diagnostics$balance %||% data.frame(stringsAsFactors = FALSE))
  profile <- selection_result$diagnostics$profile_distributions %||% data.frame(stringsAsFactors = FALSE)
  frame_profile <- if (is.data.frame(profile) && nrow(profile)) {
    unique(profile[, intersect(c("dimension", "variable", "label", "category", "source", "frame_n", "frame_prop", "tolerance"), names(profile)), drop = FALSE])
  } else {
    data.frame(stringsAsFactors = FALSE)
  }
  selected_profile <- if (is.data.frame(profile) && nrow(profile)) {
    profile[, intersect(c("dimension", "variable", "label", "category", "source", "selected_n", "selected_prop", "error_balance", "abs_error", "within_tolerance"), names(profile)), drop = FALSE]
  } else {
    data.frame(stringsAsFactors = FALSE)
  }
  write_sheet("Perfil del marco", frame_profile)
  write_sheet("Perfil seleccionado", selected_profile)
  write_sheet("Score de representatividad", selection_result$diagnostics$representativity_metrics %||% data.frame(stringsAsFactors = FALSE))
  write_sheet("Cobertura y solape", selection_result$diagnostics$coverage_overlap %||% data.frame(stringsAsFactors = FALSE))
  write_sheet("Reservas por ola", selection_result$diagnostics$reserve_depth %||% data.frame(stringsAsFactors = FALSE))
  write_sheet("Olas coordinadas", selection_result$diagnostics$waves %||% data.frame(stringsAsFactors = FALSE))
  write_sheet("No respuesta", selection_result$diagnostics$nonresponse %||% data.frame(stringsAsFactors = FALSE))
  write_sheet("Comparación con sistemático", selection_result$diagnostics$systematic_comparison %||% data.frame(stringsAsFactors = FALSE))
  comparison <- comparison %||% selection_result$method_comparison %||% NULL
  replacement_simulation <- replacement_simulation %||% selection_result$replacement_simulation %||% NULL
  write_sheet("Comparador de métodos", comparison$methods %||% data.frame(stringsAsFactors = FALSE))
  write_sheet("Simulaciones", comparison$simulation_summary %||% data.frame(stringsAsFactors = FALSE))
  write_sheet("Riesgos metodológicos", comparison$risk_flags %||% data.frame(stringsAsFactors = FALSE))
  write_sheet("Reemplazos sugeridos", replacement_simulation$suggestions %||% data.frame(stringsAsFactors = FALSE))
  write_sheet("Impacto de reemplazos", replacement_simulation$impact %||% data.frame(stringsAsFactors = FALSE))
  openxlsx::addWorksheet(wb, "Bitacora metodologica")
  bitacora <- data.frame(
    campo = c(
      "selection_run_id", "frame_hash", "seed", "selector_engine",
      "selector_engine_used", "probability_source", "weight_source",
      "nonresponse_policy", "replacement_policy", "methodological_warning",
      "official_reference", "academic_reference", "implementation_reference",
      "representativity_score", "representativity_distance",
      "diseno", "selector", "probabilidades", "pesos", "representatividad"
    ),
    valor = c(
      selection_result$selection_run_id,
      selection_result$frame_hash,
      as.character(selection_result$seed),
      selection_result$selector_engine %||% "",
      selection_result$selector_engine_used %||% "",
      selection_result$probability_source %||% "",
      selection_result$weight_source %||% "",
      selection_result$nonresponse_policy %||% "",
      selection_result$replacement_policy %||% "",
      paste(.cm_aulas_chr_vec(selection_result$methodological_warning), collapse = " | "),
      selection_result$official_reference %||% "",
      selection_result$academic_reference %||% "",
      selection_result$implementation_reference %||% "",
      as.character(selection_result$representativity_score %||% ""),
      as.character(selection_result$representativity_distance %||% ""),
      selection_result$methodology$design,
      selection_result$methodology$selector,
      paste(selection_result$methodology$probabilities, selection_result$methodology$monte_carlo),
      selection_result$methodology$weights %||% "",
      selection_result$methodology$representativity %||% ""
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  openxlsx::writeData(wb, "Bitacora metodologica", bitacora)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

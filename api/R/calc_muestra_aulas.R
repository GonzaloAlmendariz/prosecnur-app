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
  if (is.null(x)) return(default)
  if (is.data.frame(x)) x <- unlist(x, use.names = FALSE)
  if (is.list(x)) x <- unlist(x, use.names = FALSE)
  out <- trimws(as.character(x))
  out <- out[!is.na(out) & nzchar(out)]
  if (!length(out)) return(default)
  tab <- table(out)
  candidates <- names(tab)[tab == max(tab)]
  first_seen <- match(candidates, out)
  candidates[order(first_seen)][[1]]
}

.cm_aulas_mode_pair <- function(primary, secondary, default_primary = "", default_secondary = "") {
  if (is.null(primary) || is.null(secondary)) {
    return(list(primary = default_primary, secondary = default_secondary))
  }
  primary <- trimws(as.character(primary))
  secondary <- trimws(as.character(secondary))
  n <- min(length(primary), length(secondary))
  if (!n) return(list(primary = default_primary, secondary = default_secondary))
  primary <- primary[seq_len(n)]
  secondary <- secondary[seq_len(n)]
  primary[is.na(primary)] <- ""
  secondary[is.na(secondary)] <- ""
  keep <- nzchar(primary) | nzchar(secondary)
  if (!any(keep)) return(list(primary = default_primary, secondary = default_secondary))

  primary_mode <- .cm_aulas_mode(primary[nzchar(primary)], default_primary)
  if (!nzchar(primary_mode)) {
    return(list(primary = default_primary, secondary = .cm_aulas_mode(secondary[nzchar(secondary)], default_secondary)))
  }
  in_primary <- primary == primary_mode
  secondary_mode <- .cm_aulas_mode(secondary[in_primary & nzchar(secondary)], default_secondary)
  list(
    primary = primary_mode,
    secondary = secondary_mode
  )
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
      function(nm) nzchar(nm) && !.cm_aulas_par_prohibido(nm, cand) && grepl(nm, cand, fixed = TRUE),
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
  # Ancla de prefijo: un patrón que empieza con "^" matchea por startsWith
  # sobre el text_key en lugar de contains. Necesaria porque con contains puro
  # es imposible excluir "LABORATORIO" standalone sin matar los combos que lo
  # contienen como substring ("TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)").
  # El "^" se detecta sobre el patrón crudo: .cm_aulas_text_key lo destruiría.
  crudos <- .cm_aulas_chr_vec(patterns)
  anclado <- startsWith(crudos, "^")
  patterns <- .cm_aulas_text_key(sub("^\\^", "", crudos))
  anclado <- anclado[nzchar(patterns)]
  patterns <- patterns[nzchar(patterns)]
  if (!length(patterns)) return(rep(FALSE, length(x)))
  key <- .cm_aulas_text_key(x)
  vapply(key, function(item) {
    any(vapply(seq_along(patterns), function(j) {
      if (anclado[[j]]) startsWith(item, patterns[[j]]) else grepl(patterns[[j]], item, fixed = TRUE)
    }, logical(1)))
  }, logical(1))
}

# G44 · Columna del mapeo o, si no resuelve, la sintética del enriquecimiento.
#
# El enriquecimiento desde el catálogo crea columnas nombradas por su rol
# (`teacher`, `teacher_email`). Un mapeo manual a una columna que vive sólo en
# el catálogo deja al resolver sin nada que devolver, y el dato enriquecido
# —que sí está— se queda sin publicar.
.cm_aulas_col_o_sintetica <- function(df, candidates, rol) {
  col <- .cm_aulas_col(df, candidates)
  if (nzchar(col)) return(col)
  .cm_criterios_col_exacta(df, rol)
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
    session_type = c("session_type", "tipo_sesion", "tipo_clase", "actividad", "tipo_curso", "tipo_de_curso", "tipo de curso"),
    teacher = c("teacher", "nombre_de_docente", "nombre_del_docente", "nombre de docente", "nombre del docente", "docente", "profesor", "profesora"),
    teacher_email = c("teacher_email", "correo_pucp_docente", "correo pucp docente", "correo_docente", "email_docente", "correo_docente_pucp", "correo_docente_agora"),
    teacher_type = c("teacher_type", "tipo_docente", "tipo_de_docente", "tipo de docente", "categoria_docente", "categoría docente", "condicion_docente", "regimen_docente"),
    faculty = c(
      "faculty", "facultad_estudiante", "facultad_alumno", "facultad_de_matricula",
      "facultad_matricula", "nombrefac", "nombre_facultad", "facultad",
      "unidad_academica_estudiante", "unidad_academica_alumno", "unidad", "escuela"
    ),
    program = c(
      "program", "programa", "carrera_estudiante", "carrera_alumno",
      "programa_estudiante", "programa_alumno", "nombreesp",
      "especialidad_estudiante", "especialidad_alumno", "carrera", "especialidad"
    ),
    # Acuerdo 2026-07-15: "el nivel curricular manda; créditos es apoyo". Las
    # variantes curriculares/ciclo van ANTES que las de créditos para que una
    # base con ambas columnas resuelva el rol al nivel curricular.
    level = c("level", "nivel_curricular", "ciclo", "nivel_segun_creditos", "nivel_segun_credito", "nivel_por_creditos", "nivel_creditos", "nivel_del_curso", "nivel", "nivel_estudios"),
    # H7: formación del estudiante (PREGRADO/MAESTRIA/DOCTORADO/...). Se
    # resuelve SOLO por clave exacta (.cm_criterios_col_exacta) — el fuzzy
    # dejaría que "nivel" o "informacion" secuestren el rol.
    formation = c("formation", "formacion", "formación", "nivel_academico", "nivel_formativo", "tipo_formacion", "tipo_de_formacion"),
    # OJO: `level` es el nivel DEL ESTUDIANTE; course_level es el nivel DEL
    # CURSO (si no matchea columna, el filtro nivel-por-unidad usa como
    # fallback el level modal del aula).
    course_level = c("course_level", "nivel_curso", "nivel_del_curso", "nivel del curso", "nivel de curso", "ciclo_curso"),
    campus = c("campus", "sede", "filial", "sede_campus", "campus_sede", "local_sede"),
    sex = c("sex", "sexo", "genero", "gender"),
    age = c("age", "edad"),
    # `condition` es la condición DEL ESTUDIANTE (REGULAR/REINCORPORACION/...).
    # "condicion_del_curso" NO va aquí: es su propio rol (condicion_curso). Con
    # ambas columnas presentes la clave exacta "condicion" ganaría igual, pero
    # una base que solo trae "Condición del curso" secuestraría este rol.
    condition = c("condition", "condicion_matricula", "condicion", "estado_matricula", "situacion"),
    # Condición DEL CURSO (obligatorio/electivo/...); criterio propio, distinto
    # de la condición del estudiante. Resolución SOLO por clave exacta en la
    # base (.cm_criterios_col_exacta) para que el fuzzy no lo confunda con la
    # condición del estudiante; en el catálogo la columna suele llamarse solo
    # "Condición" y se resuelve por señal (ver calc_muestra_aulas_catalogo.R).
    condicion_curso = c("condicion_curso", "condicion_del_curso", "condición del curso", "condicion del curso", "condicion_curso_horario"),
    # enrolled_total es el TOTAL administrativo del aula: "matriculados_total"
    # va ANTES que "matriculados_poblacion" (esta última es la población
    # elegible recortada, no la matrícula del aula).
    enrolled_total = c("enrolled_total", "matriculados_total", "matriculados total", "matriculados_poblacion", "matriculados población", "matriculados", "inscritos", "vacantes_ocupadas")
  )
  out <- defaults
  for (nm in names(mapping)) {
    if (!nm %in% names(out)) next
    custom <- .cm_aulas_chr_vec(mapping[[nm]])
    # ADR 0035: un rol MAPEADO a mano se resuelve EXCLUSIVAMENTE por su columna,
    # sin unir los defaults fuzzy. Si se unieran, el resolver podría elegir un
    # candidato fuzzy (p. ej. course_level -> "Curso"/código) en vez de la
    # columna que el usuario eligió a propósito. Los roles que NO vienen en el
    # mapping conservan `defaults[[nm]]` (retrocompat: goldens y proyecto de
    # referencia sin mapeo manual siguen resolviendo por fuzzy).
    if (length(custom) && !.cm_aulas_mapeo_es_copia_de_defaults(custom, out[[nm]])) out[[nm]] <- custom
  }
  out
}

.cm_aulas_objective_defaults <- function() {
  variables <- data.frame(
    dimension = c("faculty", "program", "level", "schedule", "modality", "size_group", "sex"),
    label = c("Facultad", "Programa", "Nivel/ciclo", "Horario", "Modalidad", "Tamaño del curso-horario", "Sexo"),
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
    # Criterios adicionales (docente/nivel/sede/c7/c8): sus defaults viven en
    # calc_muestra_aulas_criterios.R y nacen apagados (retro-compat).
    filters = c(list(
      require_adult = TRUE,
      min_age = 18L,
      require_undergraduate = TRUE,
      accepted_conditions = as.list(c("regular")),
      exclude_level_patterns = as.list(c("posgrado", "postgrado", "maestria", "master", "doctorado")),
      require_in_person = TRUE,
      exclude_modality_patterns = as.list(c("virtual", "remoto", "online", "distancia", "asincron")),
      exclude_session_patterns = list(),
      excluded_faculties = list(),
      min_eligible_per_class = 15L
    ), .cm_criterios_default_filters()),
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
      replacement_depth_strategy = "max_complete_chains_by_cell",
      min_replacements_per_titular = 1L,
      max_replacements_per_titular = 11L,
      extra_pool_policy = "leftover_after_chains",
      replacement_equivalence_vars = as.list(c("faculty", "program", "level", "size_group", "modality", "sex_top_1", "schedule")),
      replacement_score_weights = list(
        faculty = 35,
        program = 22,
        level = 12,
        size_group = 8,
        modality = 7,
        sex_top_1 = 6,
        schedule = 4,
        eligible_n = 10,
        active_overlap = -18
      ),
      duplicate_penalty = 1.35,
      # Descuento secuencial de repetidos entre aulas del estrato (asesoría
      # muestral 2026-07-15 §10). ON por default; los escenarios históricos
      # que congelan la selección anterior declaran FALSE explícitamente.
      # La lógica vive en calc_muestra_aulas_descuento.R.
      sequential_discount = TRUE,
      # EF2: un docente no se selecciona repetido entre titulares (pedido
      # textual; reparación registrada en calc_muestra_aulas_docente_unico.R).
      docente_unico = TRUE,
      # EF5/opción B: techo operativo de aulas VISITADAS del estudio (Gonzalo:
      # «no pasarnos de doscientas aulas»). 0 = sin techo declarado; el valor
      # es una decisión del estudio, no un default universal.
      techo_aulas_visitadas = 0L,
      pps_weight = 0.25,
      coverage_weight = 1,
      monte_carlo_n = 500L,
      # F2: el MC de transparencia con engines prescritos nace apagado (0
      # corridas): pi_final = pi_design es exacta sin simular.
      mc_prescribed_transparency = FALSE,
      nonresponse_policy = "disposition_codes_and_adjustments",
      replacement_policy = "reservas_coordinadas_sin_redisenar"
    ),
    objective = .cm_aulas_objective_defaults(),
    # Selección por categorías (scope alumno/aula). Nace vacía: sin ella el
    # marco sale por el path legacy de patrones (retro-compat bit a bit). La
    # lógica vive en calc_muestra_aulas_criterios.R.
    criterios_seleccion = list(),
    # Firma de la decisión que produjo el objetivo de esta corrida. No cambia
    # el frame; impide que una comparación/selección vieja reviva si el nuevo
    # cálculo coincide accidentalmente en `n_aulas`.
    alumnos_por_ch_decision = NULL
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
    # Los criterios adicionales (docente/nivel/sede/c7/c8) se normalizan en
    # calc_muestra_aulas_criterios.R y se concatenan al bloque histórico.
    filters = c(list(
      require_adult = .cm_aulas_bool(filters$require_adult %||% filters$solo_mayores, defaults$filters$require_adult),
      min_age = max(0L, .cm_aulas_int(filters$min_age %||% filters$edad_minima, defaults$filters$min_age)),
      require_undergraduate = .cm_aulas_bool(filters$require_undergraduate %||% filters$solo_pregrado, defaults$filters$require_undergraduate),
      accepted_conditions = as.list(.cm_aulas_chr_vec(filters$accepted_conditions %||% filters$condiciones_aceptadas %||% defaults$filters$accepted_conditions)),
      exclude_level_patterns = as.list(.cm_aulas_chr_vec(filters$exclude_level_patterns %||% defaults$filters$exclude_level_patterns)),
      require_in_person = .cm_aulas_bool(filters$require_in_person %||% filters$solo_presencial, defaults$filters$require_in_person),
      exclude_modality_patterns = as.list(.cm_aulas_chr_vec(filters$exclude_modality_patterns %||% defaults$filters$exclude_modality_patterns)),
      exclude_session_patterns = as.list(.cm_aulas_chr_vec(filters$exclude_session_patterns %||% filters$excluir_tipos_sesion %||% defaults$filters$exclude_session_patterns)),
      excluded_faculties = as.list(.cm_aulas_chr_vec(filters$excluded_faculties %||% filters$facultades_excluidas %||% defaults$filters$excluded_faculties)),
      min_eligible_per_class = max(1L, .cm_aulas_int(filters$min_eligible_per_class %||% filters$min_elegibles_aula %||% config$min_elegibles_aula, defaults$filters$min_eligible_per_class))
    ), .cm_criterios_normalize_filters(filters)),
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
      replacement_depth_strategy = .cm_aulas_scalar(selector$replacement_depth_strategy %||% selector$estrategia_profundidad_reemplazos %||% config$replacement_depth_strategy, defaults$selector$replacement_depth_strategy),
      min_replacements_per_titular = max(0L, .cm_aulas_int(selector$min_replacements_per_titular %||% selector$min_reemplazos_por_titular %||% config$min_replacements_per_titular, defaults$selector$min_replacements_per_titular)),
      max_replacements_per_titular = max(0L, .cm_aulas_int(selector$max_replacements_per_titular %||% selector$max_reemplazos_por_titular %||% config$max_replacements_per_titular, defaults$selector$max_replacements_per_titular)),
      extra_pool_policy = .cm_aulas_scalar(selector$extra_pool_policy %||% selector$politica_reserva_extra %||% config$extra_pool_policy, defaults$selector$extra_pool_policy),
      replacement_equivalence_vars = as.list(.cm_aulas_chr_vec(selector$replacement_equivalence_vars %||% selector$variables_equivalencia_reemplazo %||% config$replacement_equivalence_vars %||% defaults$selector$replacement_equivalence_vars)),
      replacement_score_weights = selector$replacement_score_weights %||% selector$pesos_reemplazo %||% config$replacement_score_weights %||% defaults$selector$replacement_score_weights,
      duplicate_penalty = max(0, .cm_aulas_num(selector$duplicate_penalty %||% selector$penalizacion_repetidos %||% config$penalizacion_repetidos, defaults$selector$duplicate_penalty)),
      sequential_discount = .cm_aulas_bool(selector$sequential_discount %||% selector$descuento_secuencial %||% config$sequential_discount %||% config$descuento_secuencial, defaults$selector$sequential_discount),
      docente_unico = .cm_aulas_bool(selector$docente_unico %||% selector$teacher_unique %||% config$docente_unico, defaults$selector$docente_unico),
      techo_aulas_visitadas = max(0L, .cm_aulas_int(selector$techo_aulas_visitadas %||% selector$techo_visitas %||% config$techo_aulas_visitadas %||% config$techo_visitas, defaults$selector$techo_aulas_visitadas)),
      pps_weight = max(0, .cm_aulas_num(selector$pps_weight %||% config$pps_weight, defaults$selector$pps_weight)),
      coverage_weight = max(0, .cm_aulas_num(selector$coverage_weight %||% config$coverage_weight, defaults$selector$coverage_weight)),
      monte_carlo_n = max(0L, .cm_aulas_int(selector$monte_carlo_n %||% selector$simulaciones, simulation_runs)),
      # F2: opt-in del MC de transparencia para engines de diseño prescrito
      # (por default 0 corridas: pi_final = pi_design es exacta sin simular).
      mc_prescribed_transparency = .cm_aulas_bool(selector$mc_prescribed_transparency %||% selector$mc_transparencia_prescrita %||% config$mc_prescribed_transparency, FALSE),
      nonresponse_policy = .cm_aulas_scalar(selector$nonresponse_policy %||% selector$politica_no_respuesta %||% config$nonresponse_policy, defaults$selector$nonresponse_policy),
      # Afijación del diseño (calc_muestra_aulas_afijacion.R): mapa facultad→n.
      faculty_targets = .cm_afijacion_normalize_targets(selector$faculty_targets %||% selector$afijacion_facultades %||% config$faculty_targets),
      replacement_policy = .cm_aulas_scalar(selector$replacement_policy %||% selector$politica_reemplazos %||% config$replacement_policy, defaults$selector$replacement_policy)
    ),
    objective = .cm_aulas_normalize_objective(objective_input),
    # Selección por categorías (scope alumno/aula); normalización defensiva en
    # calc_muestra_aulas_criterios.R. list() cuando no viene → path legacy.
    criterios_seleccion = .cm_criterios_normalize_seleccion(
      config$criterios_seleccion %||% config$criterios_marco %||% config$seleccion_criterios
    ),
    alumnos_por_ch_decision = .cm_alumnos_por_ch_decision_signature(
      config$alumnos_por_ch_decision
    ),
    # ADR 0035: orden de jerarquía docente (ALTO→BAJO) para la etiqueta
    # teacher_type_top del aula_frame. Solo etiqueta/catálogo, no filtra.
    # NULL/vacío → orden por defecto académico. Lógica en
    # calc_muestra_aulas_teacher_top.R.
    teacher_type_orden = .cm_criterios_normalize_teacher_orden(
      config$teacher_type_orden %||% config$orden_tipo_docente
    ),
    # I11: spec del marco del estudio anterior — datos del estudio, no codigo.
    # Se conserva tal cual; la validacion vive en .cm_universo_ref_spec.
    referencia_marco = config$referencia_marco %||% config$marco_referencia %||% NULL,
    # Particularidades del marco (asesoría 2026-07-15 §12): decisiones
    # manuales por curso-horario (incluir/excluir/revisado + nota).
    # Normalización defensiva en calc_muestra_aulas_particularidades.R;
    # vacío → capa sin efecto sobre el marco.
    particularidades_decisiones = .cm_particularidades_normalize_decisiones(
      config$particularidades_decisiones %||% config$decisiones_particularidades
    )
  )
}

.cm_aulas_sheet_role <- function(sheet_name, df) {
  df <- .cm_aulas_clean_table_names(.cm_aulas_as_df(df, "sheet_preview"))
  mapping <- .cm_aulas_config_mapping(list())
  sheet_key <- .cm_aulas_text_key(sheet_name)
  has_student <- nzchar(.cm_aulas_col(df, mapping$student_id))
  has_classroom <- nzchar(.cm_aulas_col(df, mapping$classroom_id)) ||
    nzchar(.cm_aulas_col(df, mapping$course_id)) ||
    nzchar(.cm_aulas_col(df, mapping$course_name))
  has_faculty <- nzchar(.cm_aulas_col(df, mapping$faculty))
  has_sex <- nzchar(.cm_aulas_col(df, mapping$sex))
  has_schedule <- nzchar(.cm_aulas_col(df, mapping$schedule))
  has_teacher <- nzchar(.cm_aulas_col(df, mapping$teacher))
  has_modality <- nzchar(.cm_aulas_col(df, mapping$modality))

  if (grepl("agenda|aplicacion|campo|correo|envio", sheet_key)) {
    return(list(role = "agenda", label = "Agenda operativa", confidence = 0.82))
  }
  asistencia_hint <- .cm_asist_sheet_role_hint(df)
  if (!is.null(asistencia_hint)) return(asistencia_hint)
  if (grepl("muestra|muestral|reserva", sheet_key)) {
    return(list(role = "muestra_previa", label = "Muestra previa", confidence = 0.84))
  }
  if (has_student && has_classroom && has_faculty) {
    return(list(role = "base_madre", label = "Base madre", confidence = if (has_sex) 0.96 else 0.88))
  }
  if (has_student && has_faculty && !has_classroom) {
    return(list(role = "estudiantes", label = "Estudiantes elegibles", confidence = 0.78))
  }
  if (has_classroom && (has_schedule || has_teacher || has_modality)) {
    return(list(role = "catalogo_curso_horario", label = "Catalogo curso-horario", confidence = 0.74))
  }
  list(role = "desconocida", label = "Hoja no clasificada", confidence = 0.25)
}

calc_muestra_aulas_inspect_workbook <- function(path, max_rows = 80L) {
  ext <- tolower(tools::file_ext(path))
  if (ext %in% c("xlsx", "xls")) {
    if (!requireNamespace("readxl", quietly = TRUE)) {
      stop("El paquete R 'readxl' no esta instalado para leer Excel.", call. = FALSE)
    }
    sheet_names <- readxl::excel_sheets(path)
    sheets <- lapply(sheet_names, function(sheet_name) {
      preview <- tryCatch(
        .cm_aulas_clean_table_names(as.data.frame(
          suppressMessages(suppressWarnings(readxl::read_excel(path, sheet = sheet_name, n_max = max_rows))),
          stringsAsFactors = FALSE,
          check.names = FALSE
        )),
        error = function(e) data.frame(stringsAsFactors = FALSE)
      )
      role <- .cm_aulas_sheet_role(sheet_name, preview)
      list(
        name = sheet_name,
        rows_preview = nrow(preview),
        columns = ncol(preview),
        columns_sample = as.list(utils::head(names(preview), 100)),
        role = role$role,
        role_label = role$label,
        confidence = role$confidence
      )
    })
    role_rank <- c(base_madre = 1L, estudiantes = 2L, inscripciones = 3L, catalogo_curso_horario = 4L, referencia_asistencia = 5L, muestra_previa = 6L, agenda = 7L, desconocida = 9L)
    scores <- vapply(sheets, function(item) {
      rank <- role_rank[[item$role]] %||% 9L
      (10 - rank) + (.cm_aulas_num(item$confidence, 0) * 2)
    }, numeric(1))
    suggested <- if (length(sheets)) sheets[[which.max(scores)]] else NULL
    return(list(
      type = "workbook",
      sheets = sheets,
      suggested_sheet = suggested$name %||% "",
      suggested_role = suggested$role %||% "desconocida",
      has_base_madre = any(vapply(sheets, function(item) identical(item$role, "base_madre"), logical(1))),
      sheet_names = as.list(sheet_names)
    ))
  }
  if (ext %in% c("csv", "txt")) {
    preview <- .cm_aulas_read_table(path)
    role <- .cm_aulas_sheet_role("datos", preview)
    return(list(
      type = "table",
      sheets = list(list(
        name = "datos",
        rows_preview = min(nrow(preview), max_rows),
        columns = ncol(preview),
        columns_sample = as.list(utils::head(names(preview), 100)),
        role = role$role,
        role_label = role$label,
        confidence = role$confidence
      )),
      suggested_sheet = "datos",
      suggested_role = role$role,
      has_base_madre = identical(role$role, "base_madre"),
      sheet_names = list("datos")
    ))
  }
  stop(sprintf("Formato de marco no soportado: .%s", ext), call. = FALSE)
}

.cm_aulas_read_table <- function(path, sheet = NULL) {
  ext <- tolower(tools::file_ext(path))
  if (ext %in% c("xlsx", "xls")) {
    if (!requireNamespace("readxl", quietly = TRUE)) {
      stop("El paquete R 'readxl' no esta instalado para leer Excel.", call. = FALSE)
    }
    sheet <- .cm_aulas_scalar(sheet, "")
    if (nzchar(sheet)) {
      available <- readxl::excel_sheets(path)
      if (!sheet %in% available) {
        # Condicion clasificada: los routers que traducen esto a un api_error
        # (p. ej. explorar-base -> E_CALC_MUESTRA_EXPLORAR_HOJA) necesitan
        # distinguir "hoja inexistente" (el mensaje con las hojas disponibles
        # es util para el usuario) de un archivo ilegible. Sigue heredando de
        # "error", asi que los tryCatch genericos existentes no cambian.
        stop(errorCondition(
          sprintf(
            "No se encontro la pestana '%s' en el Excel. Hojas disponibles: %s.",
            sheet,
            paste(available, collapse = ", ")
          ),
          class = "cm_aulas_hoja_error"
        ))
      }
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

.cm_aulas_catalog_keys <- function(df, mapping) {
  if (!is.data.frame(df) || !nrow(df)) return(character(0))
  classroom_id <- .cm_aulas_classroom_id(df, mapping)
  .cm_aulas_text_key(classroom_id)
}

.cm_aulas_catalog_lookup <- function(catalogo, catalog_key, candidates) {
  col <- .cm_aulas_col(catalogo, candidates)
  if (!nzchar(col)) return(character(0))
  value <- .cm_aulas_values(catalogo, col, "")
  keys <- catalog_key[nzchar(catalog_key) & nzchar(value)]
  values <- value[nzchar(catalog_key) & nzchar(value)]
  if (!length(keys)) return(character(0))
  split_values <- split(values, keys)
  vapply(split_values, .cm_aulas_mode, character(1), default = "")
}

.cm_aulas_fill_from_lookup <- function(raw, raw_key, target_col, lookup) {
  target_col <- .cm_aulas_scalar(target_col, "")
  if (!nzchar(target_col) || !length(lookup)) return(raw)
  incoming <- unname(lookup[raw_key])
  incoming[is.na(incoming)] <- ""
  if (!target_col %in% names(raw)) raw[[target_col]] <- ""
  current <- .cm_aulas_values(raw, target_col, "")
  fill <- !nzchar(current) & nzchar(incoming)
  raw[[target_col]][fill] <- incoming[fill]
  raw
}

.cm_aulas_enrich_with_catalog <- function(raw, catalogo_curso_horario, mapping) {
  raw <- .cm_aulas_clean_table_names(.cm_aulas_as_df(raw, "base_madre"))
  catalogo <- .cm_aulas_clean_table_names(.cm_aulas_as_df(catalogo_curso_horario, "catalogo_curso_horario"))
  audit <- list(
    used = is.data.frame(catalogo) && nrow(catalogo) > 0L,
    matched_rows = 0L,
    matched_classrooms = 0L,
    teacher_values = 0L,
    teacher_email_values = 0L
  )
  if (!nrow(raw) || !nrow(catalogo)) return(list(data = raw, audit = audit))

  raw_key <- .cm_aulas_catalog_keys(raw, mapping)
  catalog_key <- .cm_aulas_catalog_keys(catalogo, mapping)
  matched <- nzchar(raw_key) & raw_key %in% catalog_key[nzchar(catalog_key)]
  audit$matched_rows <- sum(matched)
  audit$matched_classrooms <- length(unique(raw_key[matched]))
  if (!any(matched)) return(list(data = raw, audit = audit))

  teacher_lookup <- .cm_aulas_catalog_lookup(
    catalogo,
    catalog_key,
    unique(c("Nombre de docente", "Nombre del docente", "Nombre docente", "Profesor", "Profesora", "Docente", mapping$teacher))
  )
  teacher_email_lookup <- .cm_aulas_catalog_lookup(
    catalogo,
    catalog_key,
    unique(c(mapping$teacher_email, "Correo PUCP", "Correo alternativo", "Correo Agora", "Correo docente"))
  )

  raw <- .cm_aulas_fill_from_lookup(raw, raw_key, "teacher", teacher_lookup)
  raw <- .cm_aulas_fill_from_lookup(raw, raw_key, "teacher_email", teacher_email_lookup)
  audit$teacher_values <- sum(nzchar(.cm_aulas_values(raw, "teacher", "")))
  audit$teacher_email_values <- sum(nzchar(.cm_aulas_values(raw, "teacher_email", "")))
  # (H8a) Señales de criterios (tipo de docente/sede/nivel del curso) desde el
  # catálogo cuando la base no las trae; lógica en calc_muestra_aulas_catalogo.R.
  .cm_aulas_enrich_criterios_desde_catalogo(raw, catalogo, mapping, raw_key, catalog_key, audit)
}

.cm_aulas_issue_df <- function(issues) {
  if (!length(issues)) {
    return(data.frame(
      code = character(0),
      severity = character(0),
      title = character(0),
      detail = character(0),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ))
  }
  do.call(rbind, lapply(issues, function(x) {
    data.frame(
      code = .cm_aulas_scalar(x$code, ""),
      severity = .cm_aulas_scalar(x$severity, "media"),
      title = .cm_aulas_scalar(x$title, ""),
      detail = .cm_aulas_scalar(x$detail, ""),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  }))
}

.cm_aulas_catalog_relation_audit <- function(raw, catalogo_curso_horario, mapping, enrichment_audit = list()) {
  raw <- .cm_aulas_clean_table_names(.cm_aulas_as_df(raw, "base_madre"))
  catalogo <- .cm_aulas_clean_table_names(.cm_aulas_as_df(catalogo_curso_horario, "catalogo_curso_horario"))
  used <- is.data.frame(catalogo) && nrow(catalogo) > 0L
  raw_key <- .cm_aulas_catalog_keys(raw, mapping)
  raw_keyed <- raw_key[nzchar(raw_key)]
  base_unique <- unique(raw_keyed)
  issues <- list()
  audit <- list(
    used = used,
    base_rows = nrow(raw),
    catalog_rows = if (used) nrow(catalogo) else 0L,
    base_rows_with_key = length(raw_keyed),
    base_classrooms = length(base_unique),
    catalog_classrooms = 0L,
    matched_rows = 0L,
    matched_classrooms = 0L,
    unmatched_base_classrooms = if (used) length(base_unique) else 0L,
    catalog_only_classrooms = 0L,
    duplicate_catalog_keys = 0L,
    match_rate_rows = if (length(raw_keyed)) 0 else NA_real_,
    match_rate_classrooms = if (length(base_unique)) 0 else NA_real_,
    unmatched_base_preview = list(),
    catalog_only_preview = list(),
    duplicate_catalog_preview = list(),
    status = if (used) "pendiente" else "sin_catalogo",
    issues = .cm_aulas_issue_df(list())
  )
  if (!length(raw_keyed) && nrow(raw)) {
    issues[[length(issues) + 1L]] <- list(
      code = "base_sin_llave_aula",
      severity = "alta",
      title = "La base no tiene llave de aula",
      detail = "No se pudo formar curso-horario/aula desde las columnas mapeadas. Revisa curso, horario, sección o llave única."
    )
  }
  if (!used) {
    audit$issues <- .cm_aulas_issue_df(issues)
    return(audit)
  }

  catalog_key <- .cm_aulas_catalog_keys(catalogo, mapping)
  catalog_keyed <- catalog_key[nzchar(catalog_key)]
  catalog_unique <- unique(catalog_keyed)
  matched <- nzchar(raw_key) & raw_key %in% catalog_unique
  unmatched_base <- setdiff(base_unique, catalog_unique)
  catalog_only <- setdiff(catalog_unique, base_unique)
  catalog_tab <- table(catalog_keyed)
  duplicate_keys <- names(catalog_tab)[catalog_tab > 1L]
  audit$catalog_classrooms <- length(catalog_unique)
  audit$matched_rows <- sum(matched)
  audit$matched_classrooms <- length(intersect(base_unique, catalog_unique))
  audit$unmatched_base_classrooms <- length(unmatched_base)
  audit$catalog_only_classrooms <- length(catalog_only)
  audit$duplicate_catalog_keys <- length(duplicate_keys)
  audit$match_rate_rows <- if (length(raw_keyed)) round(audit$matched_rows / length(raw_keyed), 4) else NA_real_
  audit$match_rate_classrooms <- if (length(base_unique)) round(audit$matched_classrooms / length(base_unique), 4) else NA_real_
  audit$unmatched_base_preview <- as.list(utils::head(unmatched_base, 12))
  audit$catalog_only_preview <- as.list(utils::head(catalog_only, 12))
  audit$duplicate_catalog_preview <- as.list(utils::head(duplicate_keys, 12))

  if (!length(catalog_keyed)) {
    issues[[length(issues) + 1L]] <- list(
      code = "catalogo_sin_llave_aula",
      severity = "alta",
      title = "El catálogo no tiene llave de aula",
      detail = "La hoja de cursos/horarios no pudo convertirse en curso-horario/aula. Revisa curso, horario, sección o llave única."
    )
  }
  if (length(duplicate_keys)) {
    issues[[length(issues) + 1L]] <- list(
      code = "catalogo_llaves_duplicadas",
      severity = "media",
      title = "Hay llaves repetidas en el catálogo",
      detail = sprintf("%s curso-horario/aula aparecen más de una vez; se usará el valor modal para enriquecer docente/contacto.", length(duplicate_keys))
    )
  }
  if (audit$matched_classrooms == 0L && length(base_unique)) {
    issues[[length(issues) + 1L]] <- list(
      code = "sin_empate_catalogo",
      severity = "alta",
      title = "La base y el catálogo no empatan",
      detail = "No se encontró ninguna aula común. Revisa que ambas hojas usen la misma llave de curso, horario o sección."
    )
  } else if (is.finite(audit$match_rate_classrooms) && audit$match_rate_classrooms < 0.8) {
    issues[[length(issues) + 1L]] <- list(
      code = "empate_bajo_catalogo",
      severity = "alta",
      title = "La coincidencia entre bases es baja",
      detail = sprintf("Solo %.1f%% de los cursos-horario de la base principal empatan con el catálogo.", 100 * audit$match_rate_classrooms)
    )
  } else if (length(unmatched_base)) {
    issues[[length(issues) + 1L]] <- list(
      code = "aulas_base_sin_catalogo",
      severity = "media",
      title = "Hay cursos-horario de la base sin ficha de catálogo",
      detail = sprintf("%s cursos-horario de la base principal no tienen fila equivalente en el catálogo.", length(unmatched_base))
    )
  }
  if (length(catalog_only)) {
    issues[[length(issues) + 1L]] <- list(
      code = "catalogo_fuera_de_base",
      severity = "baja",
      title = "El catálogo tiene cursos-horario que no aparecen en la base",
      detail = sprintf("%s cursos-horario del catálogo no están en la población leída; se tratan como contexto, no como marco.", length(catalog_only))
    )
  }
  if (isTRUE(enrichment_audit$used) &&
      .cm_aulas_num(enrichment_audit$matched_classrooms, 0) > 0 &&
      .cm_aulas_num(enrichment_audit$teacher_values, 0) == 0) {
    issues[[length(issues) + 1L]] <- list(
      code = "catalogo_sin_docente",
      severity = "media",
      title = "Falta docente/contacto legible",
      detail = "Los cursos-horario empataron, pero no se encontró nombre de docente o contacto para preparar agenda."
    )
  }

  audit$status <- if (any(vapply(issues, function(x) identical(x$severity, "alta"), logical(1)))) {
    "critico"
  } else if (length(issues)) {
    "revisar"
  } else {
    "ok"
  }
  audit$issues <- .cm_aulas_issue_df(issues)
  audit
}

.cm_aulas_classroom_id <- function(raw, mapping) {
  direct_col <- .cm_aulas_col(raw, mapping$classroom_id)
  # Guarda anti-colapso de identidad: el matcher difuso de .cm_aulas_col
  # acepta que el nombre de la columna sea SUBSTRING del sinónimo (p.ej.
  # `horario` ⊂ `curso_horario`, `aula` ⊂ `aula_id`), así que una columna de
  # UNA sola faceta puede quedar como id directo del aula y colapsar la
  # identidad a esa faceta (visto en E2E: 18 pseudo-aulas H01..H18 con 210
  # curso-horario reales). Una faceta suelta —curso, horario, sección o
  # salón— jamás identifica un aula por sí sola: se descarta el id directo y
  # la identidad se compone abajo como curso × sección × horario × etiqueta.
  facetas_sueltas <- c(
    "curso", "course_id", "codigo_curso", "cod_curso", "clave_curso",
    "schedule", "horario", "dia_hora", "hora", "turno", "bloque",
    "section", "seccion", "grupo", "comision",
    "aula", "salon", "ambiente", "classroom", "local_aula"
  )
  if (nzchar(direct_col) && .cm_aulas_text_key(direct_col) %in% facetas_sueltas) {
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

.cm_aulas_category_profile <- function(role,
                                       label,
                                       source_role,
                                       column,
                                       values,
                                       unit_label) {
  values <- trimws(as.character(values %||% character(0)))
  values <- values[nzchar(values)]
  if (!length(values)) return(data.frame(stringsAsFactors = FALSE))
  tab <- sort(table(values), decreasing = TRUE)
  data.frame(
    role = role,
    label = label,
    source_role = source_role,
    column = column,
    raw = names(tab),
    count = as.integer(tab),
    unit_label = unit_label,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.cm_aulas_cross_profile <- function(primary_role,
                                    primary_label,
                                    secondary_role,
                                    secondary_label,
                                    source_role,
                                    primary_values,
                                    secondary_values,
                                    unit_label,
                                    preserve_blank_secondary = FALSE) {
  primary_values <- trimws(as.character(primary_values %||% character(0)))
  secondary_values <- trimws(as.character(secondary_values %||% character(0)))
  n <- min(length(primary_values), length(secondary_values))
  if (!n) return(data.frame(stringsAsFactors = FALSE))
  primary_values <- primary_values[seq_len(n)]
  secondary_values <- secondary_values[seq_len(n)]
  keep <- nzchar(primary_values) & (
    nzchar(secondary_values) | isTRUE(preserve_blank_secondary)
  )
  if (!any(keep)) return(data.frame(stringsAsFactors = FALSE))
  tab <- as.data.frame(
    table(primary_values[keep], secondary_values[keep]),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  names(tab) <- c("primary_raw", "secondary_raw", "count")
  tab$count <- as.integer(tab$count)
  tab <- tab[tab$count > 0L, , drop = FALSE]
  if (!nrow(tab)) return(data.frame(stringsAsFactors = FALSE))
  tab$primary_role <- primary_role
  tab$primary_label <- primary_label
  tab$secondary_role <- secondary_role
  tab$secondary_label <- secondary_label
  tab$source_role <- source_role
  tab$unit_label <- unit_label
  tab <- tab[, c(
    "primary_role", "primary_label", "primary_raw",
    "secondary_role", "secondary_label", "secondary_raw",
    "source_role", "count", "unit_label"
  ), drop = FALSE]
  rownames(tab) <- NULL
  tab
}

calc_muestra_aulas_construir <- function(base_madre = NULL,
                                         estudiantes = NULL,
                                         inscripciones = NULL,
                                         catalogo_curso_horario = NULL,
                                         config = list(),
                                         on_progress = NULL) {
  # I21b: hitos de progreso para la vía job. Son etapas reales del build, no un
  # reloj: el worker las escribe y la UI las muestra. Sin callback no cuesta
  # nada, y ninguna toca RNG, así que la vía job y la síncrona dan el MISMO
  # marco con la misma semilla (test de paridad).
  .p <- .cm_aulas_construir_progreso(on_progress)
  .p(1L, "Leyendo la base institucional")
  cfg <- calc_muestra_aulas_normalize_config(config)
  mapping <- cfg$mapping
  input_mode <- "base_madre"
  raw <- .cm_aulas_as_df(base_madre, "base_madre")
  if (!nrow(raw)) {
    input_mode <- "dos_bases"
    raw <- .cm_aulas_join_two_bases(estudiantes, inscripciones, mapping)
  }
  catalog_enrichment <- .cm_aulas_enrich_with_catalog(raw, catalogo_curso_horario, mapping)
  raw <- catalog_enrichment$data
  catalog_audit <- catalog_enrichment$audit
  relation_audit <- .cm_aulas_catalog_relation_audit(raw, catalogo_curso_horario, mapping, catalog_audit)
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
  # G44 · El docente enriquecido vive en la columna sintética `teacher`.
  #
  # `.cm_aulas_enrich_with_catalog` escribe el nombre del docente en una columna
  # nombrada por el ROL, no por la del archivo. Si el mapeo apunta a otra
  # columna —en el proyecto de Gonzalo, a «Docente», que trae los códigos y sólo
  # existe en el catálogo— el resolver no encontraba nada y el nombre se perdía,
  # con el agravante de que sus valores sí llegaban al marco: cambiados de sitio,
  # dentro de `teacher_type`.
  teacher <- .cm_aulas_values(raw, .cm_aulas_col_o_sintetica(raw, mapping$teacher, "teacher"), "")
  teacher_email <- .cm_aulas_values(
    raw, .cm_aulas_col_o_sintetica(raw, mapping$teacher_email, "teacher_email"), ""
  )
  faculty <- .cm_aulas_values(raw, .cm_aulas_col(raw, mapping$faculty), "")
  program <- .cm_aulas_values(raw, .cm_aulas_col(raw, mapping$program), "")
  level <- .cm_aulas_values(raw, .cm_aulas_col(raw, mapping$level), "")
  sex <- .cm_aulas_values(raw, .cm_aulas_col(raw, mapping$sex), "")
  age <- .cm_aulas_num_values(raw, .cm_aulas_col(raw, mapping$age), NA_real_)
  condition <- .cm_aulas_values(raw, .cm_aulas_col(raw, mapping$condition), "")
  enrolled_total_row <- .cm_aulas_num_values(raw, .cm_aulas_col(raw, mapping$enrolled_total), NA_real_)
  # Señales de los criterios adicionales (docente/nivel de curso/sede/condición
  # del curso); las guardas anti-colisión del tipo de docente y del nivel del
  # curso viven en el archivo de criterios (evitan que el fuzzy lea "Condición"
  # o el CÓDIGO de curso como si fueran esas señales).
  teacher_type <- .cm_aulas_values(raw, .cm_criterios_col_teacher_type(raw, mapping), "")
  course_level <- .cm_aulas_values(raw, .cm_criterios_col_course_level(raw, mapping), "")
  # Condición del curso: clave exacta en la base (no fuzzy) para no confundirla
  # con la condición del estudiante. La guarda anti-homónimo cross-hoja anula la
  # señal base cuando condicion_curso colisiona con la columna de condition
  # (mismo nombre en la hoja del alumno): la fuente real llega por el catálogo.
  condicion_curso <- .cm_aulas_values(raw, .cm_criterios_col_condicion_curso(raw, mapping), "")
  # ADR 0035: "campus" es la sintética que el catálogo escribe con el nombre del
  # rol; el mapeo del usuario resuelve primero (su columna gana si existe) y, sin
  # señal, se cae a la sintética SOLO por clave exacta (no fuzzy) bajo mapeo
  # exclusivo.
  campus_col <- .cm_aulas_col(raw, mapping$campus)
  if (!nzchar(campus_col)) campus_col <- .cm_criterios_col_exacta(raw, "campus")
  campus <- .cm_aulas_values(raw, campus_col, "")
  # H7: formación del estudiante; resolución SOLO por clave exacta (el fuzzy
  # secuestraría columnas como "Nivel" o "Información adicional").
  formation <- .cm_aulas_values(raw, .cm_criterios_col_exacta(raw, mapping$formation), "")

  sid_ok <- nzchar(student_id)
  # Precedencia suite ⇒ flags legacy. Cuando la suite por categoría está activa
  # (.cm_criterios_seleccion_activa), ELLA es la autoridad única de las
  # dimensiones que cubre y los filtros legacy de esas dimensiones se
  # NEUTRALIZAN (quedan en TRUE, no restan elegibilidad). Con AND —el modelo
  # viejo— la suite no podía EXPANDIR más allá de los defaults legacy encendidos
  # (p.ej. MAESTRIA marcada en la suite de formación seguía cayendo por
  # require_undergraduate=TRUE), rompiendo el principio del módulo: la suite
  # decide qué se incluye/excluye. Sin suite activa, retro-compat bit a bit:
  # cada bloque corre exactamente como antes. Ver calc_muestra_aulas_criterios.R
  # (comentario "Retro-compat innegociable", ~L39-42).
  suite_activa <- .cm_criterios_seleccion_activa(cfg$criterios_seleccion)

  # Scope alumno (edad/condición/formación → dimensiones que la suite cubre):
  # con suite activa los tres flags quedan en TRUE para todas las filas y la
  # población objetivo la decide SOLO alumno_sel$marco_ok (abajo). Si la suite
  # activa NO trae criterio para una de estas dimensiones, esa dimensión no
  # filtra (suite activa ⇒ suite manda). Sin suite activa, comportamiento legacy.
  age_ok <- rep(TRUE, length(student_id))
  if (!suite_activa && isTRUE(cfg$filters$require_adult) && any(is.finite(age))) {
    age_ok <- is.finite(age) & age >= cfg$filters$min_age
  }
  condition_ok <- rep(TRUE, length(student_id))
  if (!suite_activa && any(nzchar(condition)) && length(cfg$filters$accepted_conditions)) {
    condition_ok <- .cm_aulas_contains_any(condition, cfg$filters$accepted_conditions)
  }
  # H7: cuando la base trae columna de formación con señal, el criterio de
  # pregrado se decide ahí (primer filtro del método real: PREGRADO sí,
  # MAESTRIA/DOCTORADO/... no). Sin esa columna se mantiene el fallback
  # histórico por patrones de posgrado sobre el nivel. Filas sin formación no
  # se restringen (sin señal pasa, misma semántica que el resto de filtros).
  formation_patterns <- .cm_aulas_chr_vec(cfg$filters$accepted_formation_patterns)
  level_ok <- rep(TRUE, length(student_id))
  if (!suite_activa && isTRUE(cfg$filters$require_undergraduate)) {
    if (length(formation_patterns) && any(nzchar(formation))) {
      level_ok <- !nzchar(formation) | .cm_aulas_contains_any(formation, formation_patterns)
    } else if (any(nzchar(level))) {
      level_ok <- !.cm_aulas_contains_any(level, cfg$filters$exclude_level_patterns)
    }
  }
  # Scope aula (modalidad/tipo de sesión → dimensiones que la suite cubre): con
  # suite activa estos flags per-fila quedan en TRUE y la modalidad/tipo se
  # deciden a nivel de aula desde el catálogo en la evaluación de scope aula de
  # calc_muestra_aulas_criterios.R (autoritativo, fix del −281). El marco NO
  # queda sin filtro de aula: la suite aplica modalidad/tipo/docente/nivel por
  # aula y min_eligible_per_class sigue vigente aparte. Misma regla que scope
  # alumno: si la suite activa no incluye una dimensión de aula, esa dimensión
  # no filtra (suite manda). Sin suite activa, comportamiento legacy intacto.
  modality_ok <- rep(TRUE, length(student_id))
  if (!suite_activa && isTRUE(cfg$filters$require_in_person) && any(nzchar(modality))) {
    modality_ok <- !.cm_aulas_contains_any(modality, cfg$filters$exclude_modality_patterns)
  }
  session_ok <- rep(TRUE, length(student_id))
  if (!suite_activa && length(cfg$filters$exclude_session_patterns) && any(nzchar(session_type))) {
    session_ok <- !.cm_aulas_contains_any(session_type, cfg$filters$exclude_session_patterns)
    # H9: excepciones por unidad (p.ej. taller/artístico solo en Arte y
    # Diseño); la lógica vive en calc_muestra_aulas_criterios.R.
    # Precedencia única suite > H9: con suite activa este bloque NI CORRE (gate
    # !suite_activa de arriba); si además la suite trae session_type, el mapa
    # legacy se ignora con nota en session_type_impacto — nunca error.
    session_ok <- .cm_criterios_session_excepciones(session_ok, faculty, session_type, cfg$filters$session_type_excepciones)
  }
  classroom_ok <- nzchar(classroom_id)
  # Facultades excluidas por diseño (ADR pendiente): la unidad academica no
  # participa del estudio, asi que sus filas no son poblacion ni muestra. NO se
  # apaga con suite activa —una exclusion de diseño no la revoca una suite— y
  # compara por nombre normalizado de facultad, no por patron sobre `level`,
  # que en las bases reales es un numero de ciclo.
  faculty_ok <- !.cm_aulas_facultad_excluida(faculty, cfg$filters$excluded_faculties)
  eligible_student <- sid_ok & age_ok & condition_ok & level_ok & faculty_ok
  # Criterios de alumno por categoría (scope alumno): con capa "marco"
  # restringen la población objetivo N. Sin selección, marco_ok es todo TRUE
  # (retro-compat bit a bit). Lógica en calc_muestra_aulas_criterios.R.
  alumno_sel <- calc_muestra_aulas_criterios_alumno(
    cfg$criterios_seleccion,
    list(student_id = student_id, formation = formation, condition = condition,
         age = age, faculty = faculty, level = level)
  )
  eligible_student <- eligible_student & alumno_sel$marco_ok
  eligible_row <- eligible_student & modality_ok & session_ok & classroom_ok

  reason_rows <- mapply(function(a, b, c, d, e, f, g, h) {
    .cm_aulas_reason(c(
      student_id = a,
      age = b,
      condition = c,
      level = d,
      modality = e,
      session_type = f,
      classroom_id = g,
      faculty_excluida = h
    ))
  }, sid_ok, age_ok, condition_ok, level_ok, modality_ok, session_ok, classroom_ok, faculty_ok, USE.NAMES = FALSE)
  # `eligible_row` incluye alumno_sel$marco_ok, así que la razón también debe:
  # sin esta línea toda fila que solo recorta un criterio de alumno se publicaba
  # excluida y muda, y el marco no podía declarar su propia causa.
  reason_rows <- .cm_criterios_concat_razones(list(reason_rows, alumno_sel$marco_razon))
  .p(2L, "Depurando elegibles")

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

  # Pool de estudiantes SIN filtrar por elegibilidad (edad/condición/formación).
  # `population` ya viene recortada por esos criterios, así que no sirve para el
  # conteo EN VIVO del frontend al togglear los criterios de alumno: necesita el
  # universo con sus atributos crudos por estudiante para re-aplicar la selección
  # cliente. Deduplicado por estudiante; incluye faculty/level (para faculty/level)
  # y age/formation/condition (los tres que antes solo resolvía el motor).
  pool_raw <- data.frame(
    student_id = student_id,
    faculty = faculty,
    level = level,
    age = age,
    formation = formation,
    condition = condition,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  population_pool <- pool_raw[nzchar(pool_raw$student_id), , drop = FALSE]
  population_pool <- population_pool[!duplicated(population_pool$student_id), , drop = FALSE]
  rownames(population_pool) <- NULL

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
    min_suite <- (cfg$criterios_seleccion %||% list())$minEligible
    min_suite_explicito <- suite_activa && is.list(min_suite) && isTRUE(is.finite(min_suite$threshold))
    # Un umbral explícito de la suite puede tener overrides por facultad. No se
    # aplica aquí su valor global porque este gate base es irreversible; la
    # evaluación por curso-horario vive en .cm_criterios_evaluar_aula(). Sin
    # minEligible explícito se conserva el fallback legacy bit a bit.
    included <- if (min_suite_explicito) TRUE else eligible_n >= .cm_criterios_min_eligible_efectivo(cfg)
    # La etiqueta sale de los ELEGIBLES, no de todos los matriculados: con una
    # facultad excluida, la modal de todos podia rotular el aula con la unidad
    # que el diseño saco. Ver calc_muestra_aulas_facultades_excluidas.R.
    faculty_program <- .cm_aulas_etiqueta_facultad(faculty, program, idx, idx_all)
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
      faculty = faculty_program$primary,
      program = faculty_program$secondary,
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
      # Una facultad excluida por diseño no es un aula chica: si TODAS sus filas
      # cayeron por la lista, el motivo lo dice. Sin esto la exclusion se
      # disfrazaba de `min_eligible_per_class` y era indistinguible de un aula
      # que simplemente no llego al minimo.
      exclude_reason = if (included) "" else if (!any(faculty_ok[idx_all])) "faculty_excluida" else "min_eligible_per_class",
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  })
  aula_frame <- if (length(aula_rows)) do.call(rbind, aula_rows) else data.frame(stringsAsFactors = FALSE)
  .p(3L, "Agrupando cursos-horario")
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

  # Criterios de aula adicionales (docente estable, nivel por unidad, sede,
  # c7 prevalencia, c8 homogeneidad) + impacto medido de los opcionales: la
  # lógica vive en calc_muestra_aulas_criterios.R (este archivo no debe
  # seguir creciendo); aquí solo se aplica el resultado sobre el aula_frame.
  # Señales AUTORITATIVAS por aula desde el catálogo (fix del −281): modalidad/
  # tipo/tipo_docente/nivel constantes por aula para el gate de selección por
  # categorías. Vacío sin catálogo (fallback a la base). Lógica en
  # calc_muestra_aulas_catalogo.R.
  catalog_signals <- .cm_aulas_catalog_aula_signals(catalogo_curso_horario, mapping)
  .p(4L, "Aplicando criterios del marco")
  criterios <- calc_muestra_aulas_aplicar_criterios(
    aula_frame = aula_frame,
    filas = list(
      classroom_id = classroom_id,
      student_id = student_id,
      level = level,
      formation = formation,
      condition = condition,
      age = age,
      # Facultad del ESTUDIANTE por fila: insumo de faculty_match_share
      # (criterio 8, parte 1 — acuerdo 2026-07-15).
      faculty = faculty,
      teacher_type = teacher_type,
      course_level = course_level,
      condicion_curso = condicion_curso,
      campus = campus,
      eligible_row = eligible_row,
      row_base_ok = sid_ok & age_ok & condition_ok & level_ok & faculty_ok & modality_ok &
        session_ok & classroom_ok,
      alumno_marco_ok = alumno_sel$marco_ok
    ),
    population = population,
    cfg = cfg,
    catalog_signals = catalog_signals,
    empty_bucket_cols = .cm_criterios_empty_bucket_cols(raw, mapping, catalog_signals)
  )
  aula_frame <- criterios$aula_frame
  # Particularidades del marco (asesoría 2026-07-15 §12): las decisiones
  # manuales se aplican DESPUÉS de los criterios y ANTES de perfiles/auditoría
  # — solo "excluir" saca el CH del marco (razón `particularidad_manual`);
  # "incluir"/"revisado" documentan. Lógica en
  # calc_muestra_aulas_particularidades.R (este archivo no debe crecer).
  particularidades_aplicadas <- .cm_particularidades_aplicar_decisiones(
    aula_frame, cfg$particularidades_decisiones
  )
  aula_frame <- particularidades_aplicadas$aula_frame

  included_aula_frame <- if (nrow(aula_frame)) {
    aula_frame[aula_frame$included %in% TRUE, , drop = FALSE]
  } else {
    aula_frame
  }
  category_profiles <- do.call(rbind, Filter(NROW, list(
    .cm_aulas_category_profile("faculty", "Facultad", "base_madre", .cm_aulas_col(raw, mapping$faculty), population$faculty, "estudiantes"),
    .cm_aulas_category_profile("program", "Programa o carrera", "base_madre", .cm_aulas_col(raw, mapping$program), population$program, "estudiantes"),
    .cm_aulas_category_profile("sex", "Sexo", "base_madre", .cm_aulas_col(raw, mapping$sex), population$sex, "estudiantes"),
    .cm_aulas_category_profile("level", "Ciclo, nivel o año", "base_madre", .cm_aulas_col(raw, mapping$level), population$level, "estudiantes"),
    .cm_aulas_category_profile("condition", "Condición o elegibilidad", "base_madre", .cm_aulas_col(raw, mapping$condition), condition, "filas leídas"),
    .cm_aulas_category_profile("schedule", "Horario", "catalogo_curso_horario", .cm_aulas_col(raw, mapping$schedule), included_aula_frame$schedule, "aulas"),
    .cm_aulas_category_profile("modality", "Modalidad", "catalogo_curso_horario", .cm_aulas_col(raw, mapping$modality), included_aula_frame$modality, "aulas")
  )))
  if (is.null(category_profiles)) category_profiles <- data.frame(stringsAsFactors = FALSE)
  rownames(category_profiles) <- NULL
  population_cross_profiles <- do.call(rbind, Filter(NROW, list(
    .cm_aulas_cross_profile("faculty", "Facultad", "sex", "Sexo", "base_madre", population$faculty, population$sex, "estudiantes", preserve_blank_secondary = TRUE),
    .cm_aulas_cross_profile("faculty", "Facultad", "level", "Ciclo, nivel o año", "base_madre", population$faculty, population$level, "estudiantes"),
    .cm_aulas_cross_profile("faculty", "Facultad", "program", "Programa o carrera", "base_madre", population$faculty, population$program, "estudiantes")
  )))
  if (is.null(population_cross_profiles)) population_cross_profiles <- data.frame(stringsAsFactors = FALSE)
  rownames(population_cross_profiles) <- NULL

  audit <- data.frame(
    metric = c(
      "input_mode", "input_rows", "eligible_student_rows", "population_n",
      "classroom_n", "classroom_included_n", "excluded_rows",
      "catalog_match_rate_classrooms", "catalog_unmatched_base_classrooms", "catalog_only_classrooms"
    ),
    value = c(
      input_mode,
      as.character(nrow(raw)),
      as.character(sum(eligible_student)),
      as.character(nrow(population)),
      as.character(nrow(aula_frame)),
      as.character(sum(aula_frame$included %in% TRUE)),
      as.character(sum(!eligible_row)),
      as.character(relation_audit$match_rate_classrooms %||% NA_real_),
      as.character(relation_audit$unmatched_base_classrooms %||% 0L),
      as.character(relation_audit$catalog_only_classrooms %||% 0L)
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  warnings <- character(0)
  # Guard F12 (lado construir): columna de estudiante presente pero sin
  # valores -> no hay ids parseables, la cobertura por estudiantes unicos no
  # es medible (el guard de .cm_aulas_coverage_overlap la reporta NA, no 0).
  if (!any(nzchar(student_id))) {
    warnings <- c(warnings, "La columna de estudiante no trae valores; sin ids parseables la cobertura por estudiantes unicos se reportara NA.")
  }
  if (!any(nzchar(modality))) warnings <- c(warnings, "No se encontro modalidad; no se pudo auditar presencialidad.")
  if (!any(nzchar(condition))) warnings <- c(warnings, "No se encontro condicion academica; no se pudo aplicar filtro regular.")
  if (!any(nzchar(level))) warnings <- c(warnings, "No se encontro nivel; no se pudo excluir posgrado de forma automatica.")
  if (isTRUE(catalog_audit$used) && catalog_audit$matched_classrooms == 0L) {
    warnings <- c(warnings, "Se cargo catalogo curso-horario, pero no se pudo empatar con la base principal.")
  }
  if (isTRUE(catalog_audit$used) && catalog_audit$matched_classrooms > 0L && catalog_audit$teacher_values == 0L) {
    warnings <- c(warnings, "El catalogo curso-horario empato aulas, pero no se encontro docente/contacto.")
  }
  if (isTRUE(relation_audit$used) && relation_audit$status == "critico") {
    warnings <- c(warnings, "La validacion entre base principal y catalogo curso-horario tiene problemas criticos.")
  } else if (isTRUE(relation_audit$used) && relation_audit$status == "revisar") {
    warnings <- c(warnings, "La validacion entre base principal y catalogo curso-horario requiere revision.")
  }

  # EF3 fase 1: el hash se sella ANTES de anotar la efectividad esperada —
  # las columnas son derivadas y referenciales; moverian la firma en vano e
  # invalidarian artefactos acreditados (calc_muestra_aulas_efectividad.R).
  frame_hash_estable <- .cm_aulas_hash(list(aula_frame = aula_frame, cfg = cfg$filters))
  aula_frame <- .cm_aulas_efectividad_anotar(aula_frame)

  out <- list(
    schema = "calc_muestra_aulas_frame_v1",
    generated_at = .cm_aulas_now_iso(),
    input_mode = input_mode,
    config = cfg,
    # W2: eco estable de los filtros efectivos del criterio 7/8 (frescura del
    # marco en la UI). Ver .cm_aulas_filters_echo.
    filters_echo = .cm_aulas_filters_echo(cfg),
    # EF7a: la foto estructural del marco (calc_muestra_aulas_llegada.R);
    # contra ella se miden las NOVEDADES cuando llegue la base 2026.
    llegada_snapshot = .cm_llegada_snapshot(aula_frame),
    frame_hash = frame_hash_estable,
    # I11: universo del estudio anterior por facultad, derivado del catalogo
    # con el spec de config (calc_muestra_aulas_universo_referencia.R).
    universo_referencia = calc_muestra_aulas_universo_referencia(catalogo_curso_horario, cfg),
    population = population,
    population_pool = population_pool,
    aula_frame = aula_frame,
    exclusions = frame_base[!eligible_row, c("row_id", "student_id", "classroom_id", "exclude_reason"), drop = FALSE],
    category_profiles = category_profiles,
    population_cross_profiles = population_cross_profiles,
    audit = audit,
    catalog_audit = catalog_audit,
    relation_audit = relation_audit,
    warnings = as.list(warnings),
    methodology = list(
      unit_observation = "estudiante",
      sampling_unit = "curso_horario_aula",
      construction = "Base madre estudiante x curso_horario o join estudiantes + inscripciones; colapso a aula por curso_horario.",
      anonymity = "El marco puede contener identificadores internos para diseno; monitoreo no exige student_id en respuestas."
    )
  )
  # Perfil institucional del marco: la lógica vive en calc_muestra_perfil.R
  # (este archivo no debe seguir creciendo); aquí solo se adjunta el resultado.
  out$perfil <- calc_muestra_aulas_perfil(list(
    student_id = student_id,
    classroom_id = classroom_id,
    faculty = faculty,
    sex = sex,
    age = age,
    condition = condition,
    level = level,
    formation = formation,
    modality = modality,
    session_type = session_type,
    age_ok = age_ok,
    condition_ok = condition_ok,
    level_ok = level_ok,
    modality_ok = modality_ok,
    session_ok = session_ok,
    eligible_student = eligible_student,
    eligible_row = eligible_row,
    population = population,
    aula_frame = aula_frame,
    cfg = cfg,
    criterios = criterios
  ))
  # Enumeración de la suite de criterios por categoría (ambos scopes): la
  # lógica vive en calc_muestra_aulas_criterios.R; aquí solo se adjunta.
  .p(5L, "Perfilando el marco")
  out$criterios_catalogo <- calc_muestra_aulas_criterios_catalogo(
    aula_frame = aula_frame,
    catalog_signals = catalog_signals,
    filas_alumno = list(
      student_id = student_id, formation = formation, condition = condition,
      age = age, faculty = faculty, level = level
    ),
    mapped_columns = list(
      formation = .cm_criterios_col_exacta(raw, mapping$formation),
      condition = .cm_aulas_col(raw, mapping$condition),
      faculty = .cm_aulas_col(raw, mapping$faculty),
      age = .cm_aulas_col(raw, mapping$age),
      level = .cm_aulas_col(raw, mapping$level),
      modality = .cm_aulas_col(raw, mapping$modality),
      session_type = .cm_aulas_col(raw, mapping$session_type),
      teacher_type = .cm_criterios_col_teacher_type(raw, mapping),
      course_level = .cm_criterios_col_course_level(raw, mapping),
      condicion_curso = .cm_criterios_col_condicion_curso(raw, mapping),
      enrolled_total = .cm_aulas_col(raw, mapping$enrolled_total),
      campus = .cm_aulas_col(raw, mapping$campus)
    )
  )
  out$criterios_seleccion <- cfg$criterios_seleccion
  # ADR 0035: orden EFECTIVO de jerarquía docente usado en este build (ya
  # resuelto por .cm_criterios_normalize_teacher_orden en la config; NULL/vacío
  # colapsó al default académico). El frontend lo compara con el orden que el
  # usuario tiene en pantalla para marcar el marco DESACTUALIZADO al reordenar.
  # Se expone como lista para forzar un array JSON aunque el orden tenga un solo
  # elemento.
  out$teacher_type_orden <- as.list(cfg$teacher_type_orden)
  out$criterios_alumno_report <- alumno_sel$report
  # Particularidades (§12): señales detectadas + eco de decisiones, paso
  # manual del embudo y rastro en la auditoría. Un solo call-site; la lógica
  # vive en calc_muestra_aulas_particularidades.R.
  out <- .cm_particularidades_adjuntar(out, catalog_signals, particularidades_aplicadas)
  # Radiografía del marco por facultad (pestaña «Explorador de aulas»): reusa
  # las señales ya adjuntadas en out$particularidades. Un solo call-site; la
  # lógica vive en calc_muestra_aulas_exploracion.R (este archivo no debe
  # crecer).
  # L11: las dos radiografías se emiten por separado porque su coste no se
  # parece. Medido a escala real (5.263 CH): la del marco publica 0,6 MB y la
  # de criterios 19,5 MB, y juntas se llevaban 114 de los 177 s del build con
  # la barra clavada en el último hito. Un progreso repartido por etapas del
  # código y no por coste miente aunque cada etapa exista.
  .p(6L, "Radiografía del marco")
  out <- .cm_exploracion_adjuntar(out, criterios)
  .p(7L, "Radiografía por criterio y facultad")
  out <- .cm_criterios_i18b_adjuntar(out, criterios)
  # Impacto del tipo de sesión por facultad (guard §12 «doble selección del
  # taller», schema cm_session_type_impacto_v1): un solo call-site; la lógica
  # vive en calc_muestra_aulas_criterios.R (este archivo no debe crecer).
  .p(8L, "Impacto del tipo de sesión")
  out <- .cm_criterios_session_impacto_adjuntar(out, catalog_signals)
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
      "Los cursos-horario seleccionados salen con su peso y con los pesos estudiantiles agregados.",
      "Monitoreo mide caídas y sesgos sin exigir identificador personal en respuestas.",
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
  # D6: un aula sin elegibles pesa 0 (probabilidad de inclusion nula), no 1:
  # regalarle MOS positiva la metia al bombo PPS. El caso todos-cero lo cubre
  # el fallback uniforme de .cm_aulas_inclusion_probabilities.
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

.cm_aulas_balance_matrix <- function(df, vars, pik = NULL) {
  # Saneo POR COLUMNA en calc_muestra_aulas_balance_saneo.R (hallazgo J1,
  # checklist ae8e7845): dentro de un estrato las vars que lo definen son
  # constantes, y una sola constante tumbaba model.matrix ENTERO — el cubo
  # quedaba pi-only sin aviso. Ahora las que varian sobreviven y las
  # descartadas viajan declaradas en attr "balance_vars_descartadas".
  .cm_aulas_balance_matrix_saneada(df, vars, pik = pik)
}

# Devuelve la seleccion cuadrada a la cuota MAS la metadata del ajuste
# (added_n/removed_n): un ajuste por sorteo ponderado altera la muestra del
# diseno y el llamador debe divulgarlo, nunca aplicarlo en silencio.
#
# H4: una unidad de CERTEZA (pik >= 1) esta en la muestra con probabilidad 1
# por diseno; recortarla contradice su pi publicada y rompe el peso 1/pi. El
# recorte sortea solo entre las unidades con pik < 1 y toca certezas
# unicamente como ultimo recurso, divulgandolo con warning.
.cm_aulas_fix_pick_count <- function(picked, pik, quota, seed = NULL) {
  if (!is.null(seed)) set.seed(seed)
  picked <- unique(as.integer(picked[is.finite(picked) & picked > 0]))
  quota <- as.integer(quota)
  universe <- seq_along(pik)
  added_n <- 0L
  removed_n <- 0L
  warning <- character(0)
  # sample.int en vez de sample(x, ...): con un candidato unico, sample(x)
  # sortearia sobre 1:x en vez de sobre x (la trampa clasica de sample()).
  sorteo <- function(pool, n) {
    pool[sample.int(length(pool), n, prob = pmax(pik[pool], 1e-9))]
  }
  if (length(picked) > quota) {
    removed_n <- length(picked) - quota
    certeza <- picked[pik[picked] >= 1 - sqrt(.Machine$double.eps)]
    sorteables <- setdiff(picked, certeza)
    if (length(certeza) >= quota) {
      # Ultimo recurso: hasta las certezas exceden la cuota. Se recortan
      # certezas divulgandolo — su pi publicada (1) ya no describe el proceso.
      warning <- sprintf(
        "Recorte de tamano alcanzo unidades de certeza (pik >= 1): se conservaron %d de %d certezas para cerrar la cuota; la pi publicada de las recortadas no describe el proceso.",
        quota, length(certeza)
      )
      picked <- if (length(certeza) > quota) sorteo(certeza, quota) else certeza
    } else {
      picked <- c(certeza, sorteo(sorteables, quota - length(certeza)))
    }
  } else if (length(picked) < quota) {
    rest <- setdiff(universe, picked)
    add_n <- min(length(rest), quota - length(picked))
    if (add_n > 0L) {
      picked <- c(picked, sorteo(rest, add_n))
      added_n <- add_n
    }
  }
  list(
    indices = sort(unique(picked)), added_n = added_n, removed_n = removed_n,
    warning = warning
  )
}

# La caminata vive en calc_muestra_aulas_recorrido.R: hace la MISMA selección
# que `sampling::UPsystematic` (equivalencia fijada por test sobre 200 vectores
# π) y además publica el recorrido —recta, arranque y marcas—, que es el único
# orden de sorteo real que existe en este método. Sin eso, el Relato no puede
# contar la cadena sin inventarla (regla I20). El recorrido viaja como atributo
# para no cambiar la firma que ya consumen los demás engines.
.cm_aulas_pick_systematic <- function(pik, seed = NULL, ids = NULL) {
  if (!is.null(seed)) set.seed(seed)
  paso <- .cm_aulas_recorrido_sistematico(pik, ids = ids)
  out <- paso$indices
  attr(out, "recorrido") <- paso$recorrido
  out
}

.cm_aulas_pick_cube <- function(df, pik, selector, seed = NULL) {
  if (!is.null(seed)) set.seed(seed)
  x <- .cm_aulas_balance_matrix(df, selector$balance_vars, pik = pik)
  # El cubo entra por su envoltura determinista: el svd de la fase de vuelo
  # define el nucleo salvo signo y cada LAPACK elegia el suyo, asi que la misma
  # semilla sorteaba muestras distintas en macOS y en Linux (ADR 0073).
  .cm_aulas_samplecube_estable(x, pik)
}

.cm_aulas_pick_local <- function(df, pik, selector, seed = NULL) {
  if (!is.null(seed)) set.seed(seed)
  if (!requireNamespace("BalancedSampling", quietly = TRUE)) return(NULL)
  vars <- unique(c(.cm_aulas_chr_vec(selector$spread_vars), .cm_aulas_chr_vec(selector$balance_vars)))
  x <- .cm_aulas_balance_matrix(df, vars, pik = pik)
  # lcube en BalancedSampling >= 2.x es lcube(prob, Xspread, Xbal): la llamada
  # de dos argumentos ERRABA SIEMPRE, el tryCatch la tragaba y el else-if
  # encadenaba por EXISTENCIA (lcube existe -> nunca se intentaba lpm2, que si
  # funciona). Resultado medido: el pivotal local jamas corrio — todo estrato
  # con sorteo caia a cubo y el motor declaraba «equivalente». Se encadena por
  # EXITO, con la firma documentada; sin adivinar firmas legadas invirtiendo
  # argumentos (un orden errado puede correr sin error y sortear basura).
  ns <- asNamespace("BalancedSampling")
  out <- NULL
  if (exists("lcube", where = ns, inherits = FALSE)) {
    out <- tryCatch(get("lcube", envir = ns)(pik, x, x), error = function(e) NULL)
  }
  if (is.null(out) && exists("lpm2", where = ns, inherits = FALSE)) {
    out <- tryCatch(get("lpm2", envir = ns)(pik, x), error = function(e) NULL)
  }
  if (is.null(out)) return(NULL)
  # 2.x devuelve INDICES de las unidades muestreadas; 1.x devolvia el vector
  # indicador 0/1 de largo n. Distinguirlos por forma evita leer indices como
  # indicadores (todo >0 habria seleccionado el estrato entero).
  out <- as.numeric(out)
  if (length(out) == length(pik) && all(out %in% c(0, 1))) return(which(out > 0))
  sort(unique(as.integer(out[is.finite(out) & out >= 1 & out <= length(pik)])))
}

.cm_aulas_pick_indices <- function(df, quota, selector, engine, seed = NULL) {
  quota <- min(nrow(df), max(0L, as.integer(quota)))
  if (quota <= 0L || !nrow(df)) {
    return(list(indices = integer(0), pik = numeric(nrow(df)), engine_used = engine, warning = character(0)))
  }
  if (quota >= nrow(df)) {
    # La cuota cubre el estrato entero: entran TODAS sin sorteo. No es que
    # falte el recorrido, es que no hubo caminata —el mismo estatus que una
    # certeza—. Publicarlo evita que la escena describa 189 de 196 titulares y
    # calle los 7 que llegaron por acá (medido en el estudio real).
    return(list(
      indices = seq_len(nrow(df)), pik = rep(1, nrow(df)), engine_used = engine,
      warning = character(0),
      recorrido = .cm_aulas_recorrido_vacio(
        certezas = as.character(df$classroom_id),
        motivo = "cuota_cubre_el_estrato"
      )
    ))
  }
  # D1: el estratificado_aleatorio sortea SRS uniforme, asi que su pi real (y
  # la unica publicable) es cuota/N por estrato; publicar la PPS/MOS aqui
  # producia pesos 1/pi de un diseno que no fue el ejecutado.
  pik <- if (engine == "estratificado_aleatorio") {
    rep(quota / nrow(df), nrow(df))
  } else {
    .cm_aulas_inclusion_probabilities(.cm_aulas_measure_of_size(df, selector), quota)
  }
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
    picked <- .cm_aulas_pick_systematic(pik, seed, ids = df$classroom_id)
  }
  if (is.null(picked) && engine_used == "estratificado_aleatorio") {
    if (!is.null(seed)) set.seed(seed)
    picked <- sample(seq_len(nrow(df)), quota)
  }
  if (is.null(picked) && engine_used == "manual_auditable") {
    warnings <- c(warnings, "manual_auditable no selecciona automaticamente; se uso sistematico_pps para producir una propuesta inicial.")
    engine_used <- "sistematico_pps"
    picked <- .cm_aulas_pick_systematic(pik, seed, ids = df$classroom_id)
  }
  if (is.null(picked)) {
    warnings <- c(warnings, "No se pudo usar el motor solicitado; se uso muestreo aleatorio ponderado.")
    engine_used <- "weighted_random"
    if (!is.null(seed)) set.seed(seed)
    picked <- sample(seq_len(nrow(df)), quota, prob = pmax(pik, 1e-9))
  }
  raw_n <- length(unique(as.integer(picked[is.finite(picked) & picked > 0])))
  fixed <- .cm_aulas_fix_pick_count(picked, pik, quota, seed)
  # H4: si el recorte tuvo que tocar certezas, la divulgacion viaja.
  warnings <- c(warnings, fixed$warning)
  # D2: un ajuste de tamano altera la muestra que entrego el motor; se divulga
  # siempre (warning + metadata), nunca se aplica en silencio.
  if (fixed$added_n > 0L || fixed$removed_n > 0L) {
    warnings <- c(warnings, sprintf(
      "Ajuste de tamano divulgado: el sorteo %s entrego %d aulas para una cuota de %d; se %s por sorteo ponderado sobre pik.",
      engine_used, raw_n, quota,
      if (fixed$added_n > 0L) sprintf("agregaron %d", fixed$added_n) else sprintf("quitaron %d", fixed$removed_n)
    ))
  }
  # El recorrido describe la caminata que ENTREGÓ el sorteo. Si el ajuste de
  # tamaño movió unidades después, la recta ya no explica la muestra final: se
  # publica igual —es el hecho de lo que hizo el método— pero marcado, para que
  # la escena declare el desajuste en vez de animar una cadena que no cierra.
  recorrido <- attr(picked, "recorrido", exact = TRUE)
  if (is.list(recorrido)) {
    recorrido$ajustado_despues <- fixed$added_n > 0L || fixed$removed_n > 0L
  }
  # J1: si el balance perdio variables en el estrato, se DECLARA (helper en
  # calc_muestra_aulas_balance_saneo.R; mensajes identicos colapsan en unique).
  warnings <- c(warnings, .cm_aulas_balance_descartadas_warning(df, selector, engine_used))
  list(
    indices = fixed$indices, pik = pik, engine_used = engine_used,
    warning = unique(warnings),
    recorrido = recorrido,
    size_adjustment = list(added_n = fixed$added_n, removed_n = fixed$removed_n)
  )
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
  quotas <- .cm_aulas_quota_estratos(aula_frame, n_total, selector)
  # Descuento secuencial de repetidos (asesoría muestral 2026-07-15 §10):
  # estado del flag para esta corrida; la lógica vive en
  # calc_muestra_aulas_descuento.R. Con OFF el path es byte-idéntico.
  descuento <- .cm_descuento_estado(aula_frame, selector, engine)
  rows <- list()
  warnings <- character(0)
  engine_used <- character(0)
  # D2: el ajuste de tamano de cada estrato se agrega y viaja como DATO en los
  # attrs de la seleccion, no solo como texto del warning.
  size_adjustment <- list(added_n = 0L, removed_n = 0L)
  recorridos <- list()
  for (st in names(quotas)) {
    quota <- quotas[[st]]
    cand <- aula_frame[aula_frame$stratum == st, , drop = FALSE]
    if (!nrow(cand)) next
    picked <- if (isTRUE(descuento$sequential)) {
      .cm_descuento_pick_indices(cand, quota, selector, engine, seed = if (is.null(seed)) NULL else seed + length(rows) + 13L)
    } else {
      .cm_aulas_pick_indices(cand, quota, selector, engine, seed = if (is.null(seed)) NULL else seed + length(rows) + 13L)
    }
    warnings <- c(warnings, picked$warning)
    engine_used <- c(engine_used, picked$engine_used)
    # Una recta por estrato, con su propio arranque: el sorteo corre por
    # estrato y aplanarlas perdería qué caminata produjo qué cuota.
    if (is.list(picked$recorrido)) {
      recorridos[[length(recorridos) + 1L]] <- list(estrato = st, recorrido = picked$recorrido)
    }
    if (is.list(picked$size_adjustment)) {
      size_adjustment$added_n <- size_adjustment$added_n +
        .cm_aulas_int(picked$size_adjustment$added_n, 0L)
      size_adjustment$removed_n <- size_adjustment$removed_n +
        .cm_aulas_int(picked$size_adjustment$removed_n, 0L)
    }
    if (!length(picked$indices)) next
    row <- cand[picked$indices, , drop = FALSE]
    row$pi_design_candidate <- as.numeric(picked$pik[picked$indices])
    row <- .cm_descuento_bind_audit(row, picked$audit)
    rows[[length(rows) + 1L]] <- row
  }
  out <- if (length(rows)) do.call(rbind, rows) else aula_frame[0, , drop = FALSE]
  rownames(out) <- NULL
  out <- .cm_aulas_annotate_selection_metrics(out, selector)
  out <- .cm_descuento_finalize_once(out, descuento)
  attr(out, "engine_used") <- if (length(engine_used)) paste(unique(engine_used), collapse = "|") else engine
  attr(out, "warnings") <- unique(c(warnings, descuento$warnings))
  attr(out, "size_adjustment") <- size_adjustment
  attr(out, "recorrido") <- .cm_aulas_recorrido_por_estrato(
    recorridos, .cm_aulas_recorrido_motivo(engine, descuento$sequential)
  )
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
    return(structure(
      obj$representativity_score - 2 * sum(df$duplicate_overlap, na.rm = TRUE),
      score_fuente = "representatividad"
    ))
  }
  duplicate_penalty <- .cm_aulas_num(selector$duplicate_penalty, 1.25)
  coverage_weight <- .cm_aulas_num(selector$coverage_weight, 1)
  pps_weight <- .cm_aulas_num(selector$pps_weight, 0.15)
  # J1: la degradacion al heuristico se ETIQUETA para que el pool la declare.
  structure(
    coverage_weight * sum(df$unique_added, na.rm = TRUE) -
      duplicate_penalty * sum(df$duplicate_overlap, na.rm = TRUE) +
      pps_weight * sum(log1p(suppressWarnings(as.numeric(df$eligible_n))), na.rm = TRUE),
    score_fuente = "heuristico"
  )
}

.cm_aulas_select_once_pool <- function(aula_frame, selector, seed = NULL, objective = NULL) {
  pool <- max(1L, .cm_aulas_int(selector$candidate_pool_size, 100L))
  # Con sequential_discount ON cada sorteo candidato descuenta repetidos
  # (calc_muestra_aulas_descuento.R); la penalidad por duplicados del score
  # se mantiene aunque quede casi redundante.
  selector <- .cm_descuento_marcar_pool(selector)
  pool_engine <- .cm_aulas_engine_key(selector$pool_base_engine %||% "cube_balanceado")
  best <- NULL
  best_score <- -Inf
  warnings <- character(0)
  used <- character(0)
  for (i in seq_len(pool)) {
    cand <- .cm_aulas_select_once_engine(aula_frame, selector, pool_engine, seed = if (is.null(seed)) NULL else seed + i)
    score <- .cm_aulas_candidate_score(cand, aula_frame, selector, objective)
    if (identical(attr(score, "score_fuente", exact = TRUE), "heuristico")) {
      warnings <- c(warnings, "El score de representatividad no se pudo evaluar para candidatos del pool; se optimizo con el heuristico de cobertura y duplicados.")
    }
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

.cm_aulas_role_values <- function(df) {
  if (!nrow(df)) return(character(0))
  if ("sample_role" %in% names(df)) {
    role <- .cm_aulas_values(df, "sample_role", "")
    nz <- nzchar(role)
    if (any(nz)) {
      # text_key es determinista por valor: normalizar solo los distintos
      # (2-3 categorias) en vez de cada fila. Resultado byte-identico.
      u <- unique(role[nz])
      role[nz] <- .cm_aulas_text_key(u)[match(role[nz], u)]
    }
    return(role)
  }
  if ("wave" %in% names(df)) {
    wave <- .cm_aulas_values(df, "wave", "")
    return(ifelse(wave == "M1", "titular", "chain_reserve"))
  }
  rep("titular", nrow(df))
}

.cm_aulas_reconstruct_chains_from_order <- function(df) {
  df <- .cm_aulas_as_df(df, "selection_df")
  if (!nrow(df)) return(df)
  if (!"wave" %in% names(df)) df$wave <- ""
  if (!"classroom_id" %in% names(df)) df$classroom_id <- ""
  if (!"sample_role" %in% names(df)) df$sample_role <- ""
  label <- if ("historical_sample_label" %in% names(df)) .cm_aulas_text_key(df$historical_sample_label) else rep("", nrow(df))
  no_seleccionado <- grepl("no_seleccionado|no seleccionado", label)
  missing_role <- !nzchar(as.character(df$sample_role))
  df$sample_role[missing_role] <- ifelse(
    no_seleccionado[missing_role],
    "extra_reserve_pool",
    ifelse(as.character(df$wave[missing_role]) == "M1", "titular", "chain_reserve")
  )
  if (!"selection_slot_id" %in% names(df)) df$selection_slot_id <- ""
  if (!"replacement_order" %in% names(df)) df$replacement_order <- NA_integer_
  if (!"replacement_for" %in% names(df)) df$replacement_for <- ""
  order_values <- if ("historical_order" %in% names(df)) suppressWarnings(as.numeric(df$historical_order)) else seq_len(nrow(df))
  order_values[!is.finite(order_values)] <- seq_len(nrow(df))[!is.finite(order_values)]
  ord <- order(order_values, seq_len(nrow(df)))
  current_slot <- ""
  current_titular <- ""
  slot_count <- 0L
  roles <- .cm_aulas_role_values(df)
  for (idx in ord) {
    role <- roles[[idx]]
    if (role == "titular" || as.character(df$wave[[idx]]) == "M1") {
      slot_count <- slot_count + 1L
      current_slot <- tail(.cm_aulas_selection_slot_ids(slot_count), 1)
      current_titular <- .cm_aulas_scalar(df$classroom_id[[idx]], "")
      df$selection_slot_id[[idx]] <- current_slot
      df$replacement_order[[idx]] <- 0L
      df$replacement_for[[idx]] <- ""
    } else if (role == "chain_reserve") {
      if (nzchar(current_slot)) df$selection_slot_id[[idx]] <- current_slot
      if (nzchar(current_titular)) df$replacement_for[[idx]] <- current_titular
      df$replacement_order[[idx]] <- max(1L, .cm_aulas_wave_number(df$wave[[idx]]) - 1L)
    } else if (role == "extra_reserve_pool") {
      df$selection_slot_id[[idx]] <- ""
      df$replacement_for[[idx]] <- ""
      df$replacement_order[[idx]] <- NA_integer_
    }
  }
  df
}

.cm_aulas_bind_rows_fill <- function(rows) {
  rows <- rows[vapply(rows, function(x) is.data.frame(x) && nrow(x), logical(1))]
  if (!length(rows)) return(data.frame(stringsAsFactors = FALSE))
  all_names <- unique(unlist(lapply(rows, names), use.names = FALSE))
  rows <- lapply(rows, function(df) {
    missing <- setdiff(all_names, names(df))
    for (nm in missing) df[[nm]] <- NA
    df[, all_names, drop = FALSE]
  })
  do.call(rbind, rows)
}

.cm_aulas_match_level <- function(titular, reserve) {
  same <- function(col) {
    col %in% names(titular) && col %in% names(reserve) &&
      identical(.cm_aulas_scalar(titular[[col]][[1]], ""), .cm_aulas_scalar(reserve[[col]][[1]], ""))
  }
  if (same("stratum") || (same("faculty") && same("program") && same("level"))) return("misma_celda")
  if (same("faculty") && (same("program") || same("level") || same("size_group"))) return("celda_equivalente")
  if (same("faculty")) return("misma_facultad")
  "celda_cercana"
}

.cm_aulas_active_students_without_titular <- function(titulars, titular_idx) {
  if (!nrow(titulars)) return(character(0))
  col <- if ("unique_student_ids" %in% names(titulars)) "unique_student_ids" else if ("unique_student_ids_frame" %in% names(titulars)) "unique_student_ids_frame" else ""
  if (!nzchar(col)) return(character(0))  # marco sin ids (anonimizado): sin solape
  keep <- setdiff(seq_len(nrow(titulars)), titular_idx)
  unique(unlist(lapply(keep, function(i) .cm_aulas_student_ids(titulars[[col]][[i]])), use.names = FALSE))
}

# Version vectorizada del score de reemplazo para la ruta caliente del chain
# builder. Calcula, para el titular `i`, el score de TODOS los candidatos de una
# sola pasada. Es una reescritura fiel de .cm_aulas_replacement_score (misma
# secuencia de sumas, mismo round(,2), mismos denominadores con longitud cruda)
# pero sin re-parsear strings ni recorrer candidatos uno a uno. El overlap con
# estudiantes de otros titulares se resuelve con el conteo global precomputado
# (cand_du_cnt) en vez de reconstruir la union en cada pick.
.cm_aulas_score_row <- function(i, tit_ctx, tit_du, cand_ctx, cand_du, cand_du_cnt, weights) {
  w <- function(name, default) .cm_aulas_num(weights[[name]], default)
  nC <- cand_ctx$n
  score <- numeric(nC)
  score <- score + w("faculty", 35)   * (cand_ctx$faculty    == tit_ctx$faculty[[i]])
  score <- score + w("program", 22)   * (cand_ctx$program    == tit_ctx$program[[i]])
  score <- score + w("level", 12)     * (cand_ctx$level       == tit_ctx$level[[i]])
  score <- score + w("size_group", 8) * (cand_ctx$size_group == tit_ctx$size_group[[i]])
  score <- score + w("modality", 7)   * (cand_ctx$modality   == tit_ctx$modality[[i]])
  score <- score + w("sex_top_1", 6)  * (cand_ctx$sex_top_1  == tit_ctx$sex_top_1[[i]])
  score <- score + w("schedule", 4)   * (cand_ctx$schedule   == tit_ctx$schedule[[i]])
  ec <- w("eligible_n", 10)
  et <- tit_ctx$eligible[[i]]
  score <- score + pmax(0, ec - abs(et - cand_ctx$eligible) / max(1, et) * ec)
  tset <- tit_du[[i]]
  overlap <- integer(nC)
  titular_overlap <- integer(nC)
  for (k in seq_len(nC)) {
    du <- cand_du[[k]]
    if (length(du)) {
      intit <- du %in% tset
      overlap[k] <- sum((cand_du_cnt[[k]] - intit) >= 1L)
      titular_overlap[k] <- sum(intit)
    }
  }
  score <- score + w("active_overlap", -18) * pmin(1, overlap / pmax(1, cand_ctx$len_r))
  list(
    score = round(score, 2),
    overlap = overlap,
    titular_overlap = titular_overlap,
    eligible_delta = cand_ctx$eligible - et
  )
}

# Devuelve el indice GLOBAL (en `candidates`) de la reserva elegida para el
# titular `i`, o NA. Opera sobre una mascara logica de disponibilidad en vez de
# subsetear el data.frame; preserva el orden global y el tie-break which.max
# (primer maximo = menor indice global), identico al comportamiento original.
#
# `candado` dice hasta donde puede abrirse el pool cuando la propia celda del
# titular se agota:
#
#   "libre"    celda -> facultad -> cualquier aula disponible
#   "facultad" celda -> facultad, y nunca fuera de ella
#   "celda"    celda o nada
#
# El de en medio es el del operativo de 2025: de sus 170 cadenas, NINGUNA mezcla
# facultades y 148 mezclan tamanos. El reemplazo tenia que ser de la misma
# facultad y punto; el tamano podia variar, y en el 87% de los casos vario.
.cm_aulas_pick_chain_reserve_idx <- function(i, tit_ctx, cand_ctx, avail_mask, score_vec,
                                             has_stratum, has_faculty, candado = "libre") {
  if (!any(avail_mask)) return(NA_integer_)
  same_stratum <- if (has_stratum) (cand_ctx$stratum == tit_ctx$stratum[[i]]) & avail_mask else rep(FALSE, cand_ctx$n)
  same_faculty <- if (has_faculty) (cand_ctx$faculty == tit_ctx$faculty[[i]]) & avail_mask else rep(FALSE, cand_ctx$n)
  pool <- if (any(same_stratum)) {
    which(same_stratum)
  } else if (!identical(candado, "celda") && any(same_faculty)) {
    which(same_faculty)
  } else if (identical(candado, "libre")) {
    which(avail_mask)
  } else {
    integer(0)
  }
  if (!length(pool)) return(NA_integer_)
  pool[[which.max(score_vec[pool])]]
}

# Que candado rige en esta ola.
#
# Las dos estrategias con candado lo aplican SOLO pasadas las primeras
# `min_reps` reservas: la primera siempre puede salir de la facultad, para que
# un titular de celda chica no se quede en cero.
#
# `max_complete_chains_by_faculty` es el precedente de 2025 y existe porque el
# candado de celda deja 44 de 84 celdas sin poder sostener una cadena de 11:
# no hay tantas aulas dentro de una celda de facultad x sexo x tamano. Con el
# candado por facultad el pool pasa a ser la facultad entera, asi que la cadena
# llega hasta donde el cupo alcance en vez de cortarse por el ancho de la celda.
.cm_aulas_candado_de_cadena <- function(estrategia, depth, min_reps) {
  if (depth <= min_reps) return("libre")
  switch(
    .cm_aulas_scalar(estrategia, ""),
    max_complete_chains_by_cell = "celda",
    max_complete_chains_by_faculty = "facultad",
    "libre"
  )
}

.cm_aulas_build_replacement_chains <- function(aula_frame, titulars, selector, seed = NULL) {
  if (!nrow(titulars)) return(aula_frame[0, , drop = FALSE])
  if (!is.null(seed)) set.seed(seed)
  max_depth <- min(
    max(0L, .cm_aulas_int(selector$replacement_waves, 0L)),
    max(0L, .cm_aulas_int(selector$max_replacements_per_titular, selector$replacement_waves %||% 0L))
  )
  if (max_depth <= 0L) return(aula_frame[0, , drop = FALSE])
  candidates <- aula_frame[!aula_frame$classroom_id %in% titulars$classroom_id, , drop = FALSE]
  if (!nrow(candidates)) return(aula_frame[0, , drop = FALSE])
  candidates$.candidate_random <- stats::runif(nrow(candidates))
  candidates <- candidates[order(candidates$stratum, -candidates$eligible_n, candidates$.candidate_random), , drop = FALSE]
  candidates$.candidate_random <- NULL

  # --- Precomputo (una sola vez, sobre candidates YA ordenado) ---------------
  # Elimina el O(n^2): el re-subset por copia del data.frame (antes en cada
  # ola x titular), el re-parseo de student-ids y el recomputo de scores. El
  # scoring no depende de depth ni de la disponibilidad, asi que se calcula una
  # sola vez por titular. La aritmetica y el orden se preservan bit a bit.
  nT <- nrow(titulars)
  nC <- nrow(candidates)
  weights <- selector$replacement_score_weights %||% list()

  cand_ctx <- list(
    n          = nC,
    stratum    = .cm_aulas_values(candidates, "stratum", ""),
    faculty    = .cm_aulas_values(candidates, "faculty", ""),
    program    = .cm_aulas_values(candidates, "program", ""),
    level      = .cm_aulas_values(candidates, "level", ""),
    size_group = .cm_aulas_values(candidates, "size_group", ""),
    modality   = .cm_aulas_values(candidates, "modality", ""),
    sex_top_1  = .cm_aulas_values(candidates, "sex_top_1", ""),
    schedule   = .cm_aulas_values(candidates, "schedule", ""),
    eligible   = vapply(candidates$eligible_n, function(v) .cm_aulas_num(v, 0), numeric(1))
  )
  # Columna de student-ids con fallback a _frame; ausente (p.ej. marco
  # anonimizado con unique_student_hash) -> "" por aula = sin solape, sin crash.
  .cm_ids_col <- function(df, n) {
    if ("unique_student_ids" %in% names(df)) df$unique_student_ids
    else if ("unique_student_ids_frame" %in% names(df)) df$unique_student_ids_frame
    else rep("", n)
  }
  cand_ids <- lapply(.cm_ids_col(candidates, nC), .cm_aulas_student_ids)     # parse 1 vez
  cand_du  <- lapply(cand_ids, unique)                                       # ids distintos
  cand_ctx$len_r <- vapply(cand_ids, length, integer(1))                     # denominador CRUDO

  tit_ctx <- list(
    stratum    = .cm_aulas_values(titulars, "stratum", ""),
    faculty    = .cm_aulas_values(titulars, "faculty", ""),
    program    = .cm_aulas_values(titulars, "program", ""),
    level      = .cm_aulas_values(titulars, "level", ""),
    size_group = .cm_aulas_values(titulars, "size_group", ""),
    modality   = .cm_aulas_values(titulars, "modality", ""),
    sex_top_1  = .cm_aulas_values(titulars, "sex_top_1", ""),
    schedule   = .cm_aulas_values(titulars, "schedule", ""),
    eligible   = vapply(titulars$eligible_n, function(v) .cm_aulas_num(v, 0), numeric(1))
  )
  tit_ids <- lapply(.cm_ids_col(titulars, nT), .cm_aulas_student_ids)
  tit_du  <- lapply(tit_ids, unique)

  # Conteo global: para cada id, cuantos titulares lo contienen. El "activo de
  # otros titulares" para el titular i es count[id] - (id en titular i) >= 1.
  id_count <- new.env(parent = emptyenv(), hash = TRUE)
  for (idx in seq_len(nT)) for (id in tit_du[[idx]]) {
    cur <- id_count[[id]]
    id_count[[id]] <- if (is.null(cur)) 1L else cur + 1L
  }
  cand_du_cnt <- lapply(cand_du, function(du) {
    if (!length(du)) return(integer(0))
    vapply(du, function(id) { v <- id_count[[id]]; if (is.null(v)) 0L else v }, integer(1))
  })

  # Presencia de columnas para la seleccion de pool (identico al guard original;
  # el scoring, en cambio, trata columna ausente como "" en ambos lados).
  has_stratum <- ("stratum" %in% names(candidates)) && ("stratum" %in% names(titulars))
  has_faculty <- ("faculty" %in% names(candidates)) && ("faculty" %in% names(titulars))

  # Scores por titular (independientes de depth/disponibilidad): una sola pasada.
  score_val <- vector("list", nT)
  score_ov  <- vector("list", nT)
  score_tov <- vector("list", nT)
  score_ed  <- vector("list", nT)
  for (idx in seq_len(nT)) {
    s <- .cm_aulas_score_row(idx, tit_ctx, tit_du, cand_ctx, cand_du, cand_du_cnt, weights)
    score_val[[idx]] <- s$score
    score_ov[[idx]]  <- s$overlap
    score_tov[[idx]] <- s$titular_overlap
    score_ed[[idx]]  <- s$eligible_delta
  }

  # --- Seleccion por olas con mascara logica ---------------------------------
  rows <- list()
  avail_mask <- rep(TRUE, nC)
  min_reps <- max(1L, .cm_aulas_int(selector$min_replacements_per_titular, 1L))
  estrategia <- selector$replacement_depth_strategy
  for (depth in seq_len(max_depth)) {
    candado <- .cm_aulas_candado_de_cadena(estrategia, depth, min_reps)
    for (i in seq_len(nT)) {
      if (!any(avail_mask)) break
      k <- .cm_aulas_pick_chain_reserve_idx(i, tit_ctx, cand_ctx, avail_mask,
                                            score_val[[i]], has_stratum, has_faculty,
                                            candado = candado)
      if (!is.finite(k)) next
      titular <- titulars[i, , drop = FALSE]
      reserve <- candidates[k, , drop = FALSE]   # unica materializacion de fila
      reserve$wave <- paste0("M", depth + 1L)
      reserve$sample_role <- "chain_reserve"
      reserve$replacement_order <- depth
      reserve$replacement_for <- titular$classroom_id[[1]]
      reserve$selection_slot_id <- titular$selection_slot_id[[1]]
      reserve$chain_score <- score_val[[i]][k]
      reserve$equivalence_level <- .cm_aulas_match_level(titular, reserve)
      reserve$replacement_impact_score <- score_val[[i]][k]
      reserve$chain_depth <- max_depth
      reserve$activation_weight_status <- "reserve_conditional"
      reserve$analysis_weight_warning <- "Reserva condicional: usar peso analitico final solo si se activa en campo y se ajusta no respuesta."
      reserve$active_overlap <- score_ov[[i]][k]
      reserve$titular_overlap <- score_tov[[i]][k]
      reserve$eligible_delta_vs_titular <- score_ed[[i]][k]
      rows[[length(rows) + 1L]] <- reserve
      avail_mask[k] <- FALSE
    }
  }
  if (!length(rows)) return(aula_frame[0, , drop = FALSE])
  out <- .cm_aulas_bind_rows_fill(rows)
  rownames(out) <- NULL
  out
}

.cm_aulas_extra_reserve_pool <- function(aula_frame, titulars, reserves, selector) {
  policy <- .cm_aulas_text_key(selector$extra_pool_policy %||% "leftover_after_chains")
  if (policy %in% c("none", "sin_reserva_extra", "no")) return(aula_frame[0, , drop = FALSE])
  used <- unique(c(titulars$classroom_id, reserves$classroom_id))
  extra <- aula_frame[!aula_frame$classroom_id %in% used, , drop = FALSE]
  if (!nrow(extra)) return(extra)
  extra$wave <- "Extra"
  extra$sample_role <- "extra_reserve_pool"
  extra$replacement_order <- NA_integer_
  extra$replacement_for <- ""
  extra$selection_slot_id <- ""
  extra$chain_score <- NA_real_
  extra$equivalence_level <- "reserva_extra"
  extra$replacement_impact_score <- NA_real_
  extra$chain_depth <- NA_integer_
  extra$activation_weight_status <- "not_selected_extra_pool"
  extra$analysis_weight_warning <- "Reserva extra: no forma parte de M1 ni de una cadena priorizada; no usar peso analitico salvo decision metodologica documentada."
  extra$active_overlap <- NA_integer_
  extra$titular_overlap <- NA_integer_
  extra$eligible_delta_vs_titular <- NA_real_
  extra
}

.cm_aulas_select_waves <- function(aula_frame, selector, engine, waves, seed = NULL, objective = NULL, on_progress = NULL) {
  waves <- .cm_aulas_chr_vec(waves)
  include_reserves <- length(waves) > 1L || .cm_aulas_int(selector$replacement_waves, 0L) > 0L
  .cm_aulas_progress(on_progress, "sorteo_titulares", message = "Sorteo de titulares", force = TRUE)
  titulars <- .cm_aulas_select_once_dispatch(aula_frame, selector, engine, seed = if (is.null(seed)) NULL else seed + 1009L, objective = objective)
  warnings <- attr(titulars, "warnings") %||% character(0)
  used <- attr(titulars, "engine_used") %||% engine
  # D2: el ajuste de tamano del sorteo de titulares viaja como dato hasta la
  # seleccion final.
  size_adjustment <- attr(titulars, "size_adjustment") %||% list(added_n = 0L, removed_n = 0L)
  # El recorrido pertenece al sorteo de TITULARES (M1). Las olas de reemplazo
  # son otra mecánica —cadenas por equivalencia, no caminata— y mezclarlas
  # inventaría una recta que nadie recorrió.
  recorrido <- attr(titulars, "recorrido") %||% NULL
  if (!nrow(titulars)) {
    out <- aula_frame[0, , drop = FALSE]
    attr(out, "engine_used") <- if (length(used)) paste(unique(used), collapse = "|") else engine
    attr(out, "warnings") <- unique(warnings)
    attr(out, "size_adjustment") <- size_adjustment
    attr(out, "recorrido") <- recorrido
    return(out)
  }
  titulars$wave <- "M1"
  titulars$sample_role <- "titular"
  titulars$replacement_order <- 0L
  titulars$replacement_for <- ""
  titulars$selection_slot_id <- .cm_aulas_selection_slot_ids(nrow(titulars))
  titulars$chain_score <- titulars$selector_score %||% NA_real_
  titulars$equivalence_level <- "titular"
  titulars$replacement_impact_score <- NA_real_
  titulars$chain_depth <- 0L
  titulars$activation_weight_status <- "titular_ready"
  titulars$analysis_weight_warning <- ""
  titulars$active_overlap <- 0L
  titulars$titular_overlap <- 0L
  titulars$eligible_delta_vs_titular <- 0

  reserves <- if (isTRUE(include_reserves)) {
    .cm_aulas_progress(on_progress, "cadenas_reemplazo", message = "Cadenas de reemplazo", force = TRUE)
    .cm_aulas_build_replacement_chains(aula_frame, titulars, selector, seed = if (is.null(seed)) NULL else seed + 2003L)
  } else {
    aula_frame[0, , drop = FALSE]
  }
  if (nrow(reserves) && "selection_slot_id" %in% names(reserves)) {
    depth_lookup <- table(reserves$selection_slot_id)
    titulars$chain_depth <- as.integer(depth_lookup[titulars$selection_slot_id])
    titulars$chain_depth[!is.finite(titulars$chain_depth)] <- 0L
  }
  extra <- if (isTRUE(include_reserves)) .cm_aulas_extra_reserve_pool(aula_frame, titulars, reserves, selector) else aula_frame[0, , drop = FALSE]
  rows <- list(titulars)
  if (nrow(reserves)) rows[[length(rows) + 1L]] <- reserves
  if (nrow(extra)) rows[[length(rows) + 1L]] <- extra
  out <- .cm_aulas_bind_rows_fill(rows)
  rownames(out) <- NULL
  attr(out, "engine_used") <- if (length(used)) paste(unique(used), collapse = "|") else engine
  attr(out, "warnings") <- unique(warnings)
  attr(out, "size_adjustment") <- size_adjustment
  attr(out, "recorrido") <- recorrido
  out
}

.cm_aulas_design_probabilities <- function(aula_frame, selector, engine) {
  engine <- .cm_aulas_engine_key(engine)
  n_total <- min(nrow(aula_frame), max(1L, .cm_aulas_int(selector$n_aulas, 1L)))
  quotas <- .cm_aulas_quota_estratos(aula_frame, n_total, selector)
  out <- stats::setNames(rep(0, nrow(aula_frame)), aula_frame$classroom_id)
  for (st in names(quotas)) {
    idx <- which(aula_frame$stratum == st)
    if (!length(idx)) next
    if (engine == "estratificado_aleatorio") {
      # D1: SRS por estrato -> pi uniforme cuota_h/N_h, la misma con la que
      # sortea .cm_aulas_pick_indices para este engine.
      out[idx] <- min(1, quotas[[st]] / length(idx))
    } else {
      mos <- .cm_aulas_measure_of_size(aula_frame[idx, , drop = FALSE], selector)
      out[idx] <- .cm_aulas_inclusion_probabilities(mos, quotas[[st]])
    }
  }
  out
}

.cm_aulas_mc_probabilities <- function(aula_frame, selector, engine, waves, runs, objective = NULL, on_progress = NULL) {
  requested_runs <- max(0L, as.integer(runs))
  if (requested_runs <= 0L) {
    return(list(pi = stats::setNames(rep(NA_real_, nrow(aula_frame)), aula_frame$classroom_id), note = "No ejecutada.", runs = 0L, requested = 0L, error = NA_real_))
  }
  # El sorteo final de titulares con pool_controlado estima pi_final por Monte
  # Carlo corriendo una seleccion de olas COMPLETA por corrida (~10 s a escala
  # real). Sin capar, 500 corridas sobre ~3000 cursos-horario -> ~80 min e
  # inutilizable. Aplicamos un presupuesto por escala PROPIO del sorteo final
  # (.cm_aulas_mc_final_budget, piso 50 corridas), mas alto que el del comparador
  # porque aqui pi alimenta pesos 1/pi y la cola manda: en marcos chicos (<=1200)
  # corre lo solicitado (goldens intactos); en marcos grandes baja a ~50. El SE
  # reportado sube honestamente con menos corridas y exponemos requested vs runs.
  runs <- .cm_aulas_mc_final_budget(nrow(aula_frame), requested_runs)
  sim_selector <- selector
  if (.cm_aulas_engine_key(engine) == "pool_controlado") {
    sim_selector$candidate_pool_size <- min(max(5L, .cm_aulas_int(selector$mc_candidate_pool_size, 25L)), max(5L, .cm_aulas_int(selector$candidate_pool_size, 25L)))
  }
  counts <- stats::setNames(rep(0L, nrow(aula_frame)), aula_frame$classroom_id)
  for (i in seq_len(runs)) {
    .cm_aulas_progress(on_progress, "simulacion_mc", current = i, total = runs,
                       message = sprintf("Simulación Monte Carlo: corrida %d de %d", i, runs))
    sim <- .cm_aulas_select_waves(aula_frame, sim_selector, engine, waves, seed = selector$seed + i * 7919L, objective = objective)
    sim <- sim[.cm_aulas_role_values(sim) != "extra_reserve_pool", , drop = FALSE]
    counts[unique(sim$classroom_id)] <- counts[unique(sim$classroom_id)] + 1L
  }
  pi <- counts / runs
  se <- sqrt(pmax(pi * (1 - pi), 0) / runs)
  budgeted <- runs < requested_runs
  pool_note <- if (.cm_aulas_engine_key(engine) == "pool_controlado") sprintf(" y pool presupuestado de %s candidatas", sim_selector$candidate_pool_size) else ""
  note <- if (budgeted) {
    sprintf("Marco grande: se ejecutaron %s de %s corridas presupuestadas para mantener interactividad (SE reportado refleja las corridas ejecutadas)%s.", runs, requested_runs, pool_note)
  } else {
    sprintf("Simulacion ejecutada con %s corridas sobre el plan completo de olas%s.", runs, pool_note)
  }
  list(
    pi = pi,
    note = note,
    runs = runs,
    requested = requested_runs,
    budgeted = budgeted,
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

# Perfil del lado del MARCO para distribution_compare. Es invariante entre las
# llamadas por par de la simulacion (depende solo de frame_values/frame_weights),
# asi que se puede precomputar una vez y cachear. Normaliza igual que el codigo
# original (trimws, sin_dato) y agrega el peso por categoria del marco.
.cm_aulas_frame_profile <- function(frame_values, frame_weights = NULL) {
  frame_values <- trimws(as.character(frame_values %||% character(0)))
  frame_values[is.na(frame_values) | !nzchar(frame_values)] <- "sin_dato"
  frame_weights <- suppressWarnings(as.numeric(frame_weights %||% rep(1, length(frame_values))))
  if (length(frame_weights) != length(frame_values)) frame_weights <- rep(1, length(frame_values))
  frame_weights[!is.finite(frame_weights) | frame_weights < 0] <- 0
  cats_frame <- unique(frame_values)
  n_by_cat <- vapply(cats_frame, function(cat) sum(frame_weights[frame_values == cat], na.rm = TRUE), numeric(1))
  names(n_by_cat) <- cats_frame
  list(values = frame_values, total = sum(frame_weights, na.rm = TRUE), n_by_cat = n_by_cat)
}

.cm_aulas_distribution_compare <- function(frame_values, selected_values, frame_weights = NULL, selected_weights = NULL,
                                           dimension = "", label = "", source = "", tolerance = 0.05,
                                           frame_profile = NULL) {
  if (is.null(frame_profile)) frame_profile <- .cm_aulas_frame_profile(frame_values, frame_weights)
  frame_values <- frame_profile$values
  selected_values <- trimws(as.character(selected_values %||% character(0)))
  selected_values[is.na(selected_values) | !nzchar(selected_values)] <- "sin_dato"
  selected_weights <- suppressWarnings(as.numeric(selected_weights %||% rep(1, length(selected_values))))
  if (length(selected_weights) != length(selected_values)) selected_weights <- rep(1, length(selected_values))
  selected_weights[!is.finite(selected_weights) | selected_weights < 0] <- 0
  cats <- sort(unique(c(frame_values, selected_values)))
  cats <- cats[nzchar(cats)]
  if (!length(cats) || !length(frame_values) || !length(selected_values)) {
    return(data.frame(stringsAsFactors = FALSE))
  }
  frame_total <- frame_profile$total
  selected_total <- sum(selected_weights, na.rm = TRUE)
  if (!(frame_total > 0) || !(selected_total > 0)) return(data.frame(stringsAsFactors = FALSE))
  rows <- lapply(cats, function(cat) {
    fn <- frame_profile$n_by_cat[cat]
    frame_n <- if (is.na(fn)) 0 else unname(as.numeric(fn))
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

.cm_aulas_dimension_distribution <- function(frame_result, aula_frame, selection_df, variable_cfg, cache = NULL) {
  selected_m1 <- selection_df[selection_df$wave == "M1", , drop = FALSE]
  if (!nrow(selected_m1)) return(data.frame(stringsAsFactors = FALSE))
  dimension <- .cm_aulas_scalar(variable_cfg$dimension, "")
  label <- .cm_aulas_scalar(variable_cfg$label, dimension)
  tolerance <- .cm_aulas_num(variable_cfg$tolerance, 0.05)
  student_col <- .cm_aulas_scalar(variable_cfg$student_col, "")
  aula_col <- .cm_aulas_scalar(variable_cfg$aula_col, dimension)
  source_preference <- .cm_aulas_text_key(variable_cfg$source_preference)
  population <- .cm_aulas_as_df(frame_result$population %||% data.frame(stringsAsFactors = FALSE), "population")

  # El perfil del marco es invariante entre pares; se cachea por columna cuando
  # se provee un `cache` (env). Sin cache, se calcula inline (byte-identico).
  get_profile <- function(key, fv, fw) {
    if (is.null(cache)) return(.cm_aulas_frame_profile(fv, fw))
    if (is.null(cache[[key]])) cache[[key]] <- .cm_aulas_frame_profile(fv, fw)
    cache[[key]]
  }

  # selected_ids solo lo usa la rama "student"; parsear los student-ids de M1 es
  # caro, asi que se difiere hasta confirmar esa rama (en variables por-aula no
  # se calcula nunca).
  if (source_preference == "student" && nzchar(student_col) && nrow(population) && student_col %in% names(population) &&
      "student_id" %in% names(population) && length(selected_ids <- .cm_aulas_selected_student_ids(selected_m1))) {
    selected_pop <- population[population$student_id %in% selected_ids, , drop = FALSE]
    if (nrow(selected_pop)) {
      fp <- get_profile(paste0("stud:", student_col), population[[student_col]], rep(1, nrow(population)))
      return(.cm_aulas_distribution_compare(
        frame_profile = fp,
        selected_values = selected_pop[[student_col]],
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
  fp <- get_profile(
    paste0("aula:", aula_col),
    aula_frame[[aula_col]],
    suppressWarnings(as.numeric(aula_frame$eligible_n %||% rep(1, nrow(aula_frame))))
  )
  .cm_aulas_distribution_compare(
    frame_profile = fp,
    selected_values = selected_m1[[aula_col]],
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

.cm_aulas_coverage_overlap <- function(aula_frame, selection_df, objective = list(), cache = NULL) {
  selected_m1 <- selection_df[selection_df$wave == "M1", , drop = FALSE]
  # unique_covered = length(selected_ids): solo importa el CONTEO de estudiantes
  # distintos cubiertos, no el orden. Con `cache`, se parsea los student-ids por
  # aula UNA vez (mapa classroom_id -> ids) y M1 solo hace lookup+union, evitando
  # el re-strsplit de todas las aulas M1 en cada par (hotspot de la simulacion).
  sel_col <- if ("unique_student_ids" %in% names(selected_m1)) "unique_student_ids" else if ("unique_student_ids_frame" %in% names(selected_m1)) "unique_student_ids_frame" else ""
  selected_ids <- if (!is.null(cache) && nzchar(sel_col) && "classroom_id" %in% names(selected_m1) && "classroom_id" %in% names(aula_frame)) {
    if (is.null(cache[["ids_by_classroom"]])) {
      idmap <- new.env(parent = emptyenv(), hash = TRUE)
      fcol <- if ("unique_student_ids" %in% names(aula_frame)) "unique_student_ids" else if ("unique_student_ids_frame" %in% names(aula_frame)) "unique_student_ids_frame" else ""
      if (nzchar(fcol)) {
        fcids <- as.character(aula_frame$classroom_id)
        fvals <- aula_frame[[fcol]]
        for (r in seq_along(fcids)) idmap[[fcids[[r]]]] <- .cm_aulas_student_ids(fvals[[r]])
      }
      cache[["ids_by_classroom"]] <- idmap
    }
    idmap <- cache[["ids_by_classroom"]]
    unique(unlist(lapply(as.character(selected_m1$classroom_id), function(cid) idmap[[cid]]), use.names = FALSE))
  } else {
    .cm_aulas_selected_student_ids(selected_m1)
  }
  # Total de estudiantes unicos del marco: invariante entre pares (parsea todos
  # los student-ids del marco), se cachea cuando hay `cache`.
  frame_n <- if (!is.null(cache)) {
    if (is.null(cache[["frame_unique_n"]])) cache[["frame_unique_n"]] <- .cm_aulas_unique_students_n(aula_frame)
    cache[["frame_unique_n"]]
  } else {
    .cm_aulas_unique_students_n(aula_frame)
  }
  exposure_n <- sum(suppressWarnings(as.numeric(selected_m1$eligible_n)), na.rm = TRUE)
  unique_covered <- length(selected_ids)
  if (!is.finite(exposure_n) || exposure_n <= 0) exposure_n <- unique_covered
  coverage_population_pct <- if (frame_n > 0) unique_covered / frame_n else NA_real_
  coverage_efficiency <- if (exposure_n > 0) unique_covered / exposure_n else NA_real_
  duplicate_loss <- if (exposure_n > 0) max(0, 1 - coverage_efficiency) else NA_real_
  # Guard F12: si la columna de ids existe pero llega vacía (round-trips que
  # pierden unique_student_ids), la cadena unique_covered==0 -> efficiency==0
  # reportaba 0/100 en TODOS los métodos como si la selección fuera pésima.
  # Cuando más del 80% de las aulas CON elegibles no trae ids parseables, la
  # cobertura no es medible: se reporta NA + warning estructurado (attr
  # "coverage_guard"), nunca 0.
  elig_guard <- .cm_aulas_num_values(aula_frame, "eligible_n", NA_real_)
  con_elegibles <- which(is.finite(elig_guard) & elig_guard > 0)
  ids_col <- if ("unique_student_ids" %in% names(aula_frame)) "unique_student_ids" else if ("unique_student_ids_frame" %in% names(aula_frame)) "unique_student_ids_frame" else ""
  ids_vals <- if (nzchar(ids_col)) trimws(.cm_aulas_values(aula_frame, ids_col, "")) else rep("", nrow(aula_frame))
  sin_ids_n <- if (length(con_elegibles)) sum(!nzchar(ids_vals[con_elegibles])) else 0L
  guard <- NULL
  if (length(con_elegibles) && sin_ids_n / length(con_elegibles) > 0.8) {
    guard <- list(
      code = "cobertura_ids_no_parseables",
      aulas_con_elegibles = length(con_elegibles),
      aulas_sin_ids = as.integer(sin_ids_n),
      share_sin_ids = round(sin_ids_n / length(con_elegibles), 4),
      detalle = "La mayoria de las aulas del marco no trae ids de estudiante parseables; la cobertura se reporta NA en lugar de 0."
    )
    coverage_population_pct <- NA_real_
    coverage_efficiency <- NA_real_
    duplicate_loss <- NA_real_
  }
  dup_tol <- .cm_aulas_num(objective$duplicate_loss_tolerance, 0.15)
  coverage_score <- if (is.finite(coverage_efficiency)) round(100 * pmin(1, coverage_efficiency), 1) else NA_real_
  duplicate_score <- if (is.finite(duplicate_loss)) round(max(0, 100 * (1 - duplicate_loss / dup_tol)), 1) else NA_real_
  out <- data.frame(
    metric = c("population_unique_students", "selected_unique_students", "selected_student_course_exposure", "coverage_population_pct", "coverage_efficiency", "duplicate_loss"),
    value = c(frame_n, unique_covered, exposure_n, round(coverage_population_pct, 6), round(coverage_efficiency, 6), round(duplicate_loss, 6)),
    score = c(NA, NA, NA, NA, coverage_score, duplicate_score),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  if (!is.null(guard)) attr(out, "coverage_guard") <- guard
  out
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

calc_muestra_aulas_representativity_objective <- function(frame_result, selection_df, selector = list(), objective = NULL, cache = NULL, roles = NULL) {
  objective <- .cm_aulas_normalize_objective(objective %||% frame_result$config$objective %||% list())
  # El marco preparado es invariante entre pares de la simulacion; se cachea
  # cuando se provee un `cache` (env). Sin cache el comportamiento es identico.
  aula_frame <- if (!is.null(cache) && !is.null(cache[["aula_frame"]])) {
    cache[["aula_frame"]]
  } else {
    af <- .cm_aulas_prepare_frame(frame_result, list(selector = selector %||% frame_result$config$selector %||% list()))
    if (!is.null(cache)) cache[["aula_frame"]] <- af
    af
  }
  selection_df <- .cm_aulas_as_df(selection_df, "selection_df")
  if (!"wave" %in% names(selection_df)) selection_df$wave <- "M1"
  # `roles` solo sirve para descartar la bolsa extra. La simulacion lo precomputa
  # una vez (invariante para el filtro) y lo pasa para evitar renormalizar la
  # columna sample_role en cada par.
  roles <- roles %||% .cm_aulas_role_values(selection_df)
  selection_df <- selection_df[roles != "extra_reserve_pool", , drop = FALSE]
  if (!nrow(selection_df)) stop("Se requiere una seleccion para calcular representatividad.", call. = FALSE)

  profile_rows <- list()
  metric_rows <- list()
  for (i in seq_len(nrow(objective$variables))) {
    variable_cfg <- objective$variables[i, , drop = FALSE]
    dist <- .cm_aulas_dimension_distribution(frame_result, aula_frame, selection_df, variable_cfg, cache = cache)
    if (nrow(dist)) profile_rows[[length(profile_rows) + 1L]] <- dist
    metric_rows[[length(metric_rows) + 1L]] <- .cm_aulas_balance_metric_from_distribution(dist, variable_cfg)
  }
  profile_distributions <- if (length(profile_rows)) do.call(rbind, profile_rows) else data.frame(stringsAsFactors = FALSE)
  balance_metrics <- if (length(metric_rows)) do.call(rbind, metric_rows) else data.frame(stringsAsFactors = FALSE)

  coverage <- .cm_aulas_coverage_overlap(aula_frame, selection_df, objective, cache = cache)
  # Guard F12: warning estructurado cuando el marco no trae ids parseables
  # (la cobertura viaja NA, no 0); se propaga al resultado y a warnings.
  coverage_guard <- attr(coverage, "coverage_guard")
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
  # Los tres avisos de umbral llevan SUS DOS CIFRAS: la medida y el umbral que
  # la juzga. Decian solo el hecho —«supera la tolerancia configurada»— y con
  # eso no se puede decidir nada: quedarse a un pelo del umbral y quedarse a la
  # mitad piden cosas distintas, y el aviso las escribia igual. Sus vecinos de
  # este mismo bloque ya nombraban cifra y dimension.
  if (is.finite(dup_loss) && dup_loss > objective$duplicate_loss_tolerance) {
    warnings <- c(warnings, sprintf(
      "La perdida por estudiantes repetidos es %.1f%% y supera la tolerancia de %.1f%%.",
      100 * dup_loss, 100 * objective$duplicate_loss_tolerance
    ))
  }
  if (isTRUE(weight_stability$active) && is.finite(weight_stability$cv) && weight_stability$cv > objective$weight_cv_critical) {
    warnings <- c(warnings, sprintf(
      "CV de pesos %.2f, por encima del critico %.2f; revisar probabilidades o postestratificacion.",
      weight_stability$cv, objective$weight_cv_critical
    ))
  }
  if (has_reserve && is.finite(reserve_ratio) && reserve_ratio < objective$reserve_depth_target) {
    warnings <- c(warnings, sprintf(
      "Profundidad de reservas %.2f por titular, menor al objetivo de %.2f.",
      reserve_ratio, objective$reserve_depth_target
    ))
  }
  warnings <- c(warnings, .cm_aulas_aviso_celdas_sin_reserva(depth, objective$reserve_depth_target))
  if (!is.null(coverage_guard)) warnings <- c(warnings, coverage_guard$detalle)
  warnings <- c(warnings, .cm_aulas_aviso_estratos_inalcanzables(aula_frame, selection_df, roles))
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
    # Guard F12: NULL (clave ausente) cuando los ids del marco son parseables.
    coverage_guard = coverage_guard,
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
      "Ajuste posterior por dominio si hay caídas diferenciales.",
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
  # ADR 0057 · La unidad se llama curso-horario en toda la app; «aula» fue otra
  # cosa en versiones anteriores, así que el sinónimo obliga a preguntarse si
  # nombra algo distinto. «Benchmark» tampoco: es punto de comparación.
  if (engine == "sistematico_pps") return("Da más probabilidad a los cursos-horario con más estudiantes elegibles; sirve de punto de comparación para los demás métodos.")
  if (engine == "cube_balanceado") return("Busca que los cursos-horario seleccionados reproduzcan el marco en facultad, programa, nivel, horario y tamaño.")
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
  # Guard: la profundidad de reservas se define POR ESTRATO. Una seleccion sin
  # columna stratum (p. ej. un aula_frame crudo pasado directo al objetivo de
  # representatividad) no puede medirla: se devuelve vacio y los consumidores
  # ya degradan a NA/0 (has_reserve FALSE), en vez de reventar el aggregate.
  if (!"stratum" %in% names(selection_df)) return(data.frame(stringsAsFactors = FALSE))
  titular <- stats::aggregate(classroom_id ~ stratum, data = selection_df[selection_df$wave == "M1", , drop = FALSE], FUN = length)
  names(titular)[names(titular) == "classroom_id"] <- "titulares"
  roles <- .cm_aulas_role_values(selection_df)
  reserves <- selection_df[selection_df$wave != "M1" & roles != "extra_reserve_pool", , drop = FALSE]
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

.cm_aulas_replacement_chains_table <- function(selection_df) {
  selection_df <- .cm_aulas_as_df(selection_df, "selection_df")
  if (!nrow(selection_df)) return(data.frame(stringsAsFactors = FALSE))
  cell <- function(df, nm, row = 1L, default = "") {
    for (candidate in .cm_aulas_chr_vec(nm)) {
      if (candidate %in% names(df) && length(df[[candidate]]) >= row) return(df[[candidate]][[row]])
    }
    default
  }
  roles <- .cm_aulas_role_values(selection_df)
  if (!"selection_slot_id" %in% names(selection_df)) selection_df$selection_slot_id <- ""
  titulars <- selection_df[roles == "titular" | selection_df$wave == "M1", , drop = FALSE]
  reserves <- selection_df[roles == "chain_reserve", , drop = FALSE]
  if (!nrow(titulars)) return(data.frame(stringsAsFactors = FALSE))
  rows <- list()
  for (i in seq_len(nrow(titulars))) {
    titular <- titulars[i, , drop = FALSE]
    slot <- .cm_aulas_scalar(titular$selection_slot_id[[1]], "")
    linked <- reserves[reserves$selection_slot_id == slot | reserves$replacement_for == titular$classroom_id[[1]], , drop = FALSE]
    if (nrow(linked)) {
      ord <- suppressWarnings(as.numeric(linked$replacement_order))
      ord[!is.finite(ord)] <- vapply(linked$wave[!is.finite(ord)], .cm_aulas_wave_number, integer(1)) - 1L
      linked <- linked[order(ord), , drop = FALSE]
    }
    rows[[length(rows) + 1L]] <- data.frame(
      selection_slot_id = slot,
      titular_operational_code = .cm_aulas_scalar(cell(titular, "operational_code"), ""),
      titular_classroom_id = cell(titular, "classroom_id"),
      titular_label = .cm_aulas_scalar(cell(titular, "course_name") %||% cell(titular, "label") %||% cell(titular, "classroom_id"), ""),
      faculty = .cm_aulas_scalar(cell(titular, "faculty") %||% cell(titular, "stratum"), ""),
      stratum = .cm_aulas_scalar(cell(titular, "stratum"), ""),
      replacement_count = as.integer(nrow(linked)),
      chain_depth = as.integer(nrow(linked)),
      first_replacement_code = if (nrow(linked)) .cm_aulas_scalar(cell(linked, c("operational_code", "replacement_chain_code")), "") else "",
      first_replacement_id = if (nrow(linked)) cell(linked, "classroom_id") else "",
      first_replacement_match = if (nrow(linked)) .cm_aulas_scalar(cell(linked, "equivalence_level"), "") else "",
      warning = if (nrow(linked)) "" else "Sin reemplazo encadenado disponible.",
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  }
  do.call(rbind, rows)
}

.cm_aulas_extra_pool_table <- function(selection_df) {
  selection_df <- .cm_aulas_as_df(selection_df, "selection_df")
  if (!nrow(selection_df)) return(data.frame(stringsAsFactors = FALSE))
  roles <- .cm_aulas_role_values(selection_df)
  selection_df[roles == "extra_reserve_pool", , drop = FALSE]
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
  quotas <- .cm_aulas_quota_estratos(aula_frame, selector$n_aulas, selector)
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

# ---------------------------------------------------------------------------
# Progreso opcional (jobs asincronos)
# ---------------------------------------------------------------------------
# `on_progress` es un callback opcional (NULL por defecto) que las funciones
# largas invocan para reportar etapa/avance. NO toca el RNG ni los datos:
# con on_progress = NULL el comportamiento es byte-identico al historico
# (golden tests intactos).
.cm_aulas_progress <- function(on_progress, phase, current = NULL, total = NULL,
                               message = NULL, force = FALSE) {
  if (!is.function(on_progress)) return(invisible(NULL))
  tryCatch(
    on_progress(phase = phase, current = current, total = total,
                message = message, force = force),
    error = function(e) NULL
  )
  invisible(NULL)
}

# Writer de progreso con throttle para jobs: escribe al progress_path como
# maximo cada `min_interval` segundos, salvo cambios de fase (force = TRUE).
.cm_aulas_job_progress_writer <- function(progress_path, min_interval = 0.5) {
  if (is.null(progress_path) || !nzchar(as.character(progress_path)[1])) return(NULL)
  writer <- job_progress_writer(progress_path)
  state <- new.env(parent = emptyenv())
  state$last <- 0
  function(phase = "running", current = NULL, total = NULL, message = NULL, force = FALSE) {
    now <- as.numeric(Sys.time())
    if (!isTRUE(force) && (now - state$last) < min_interval) return(invisible(NULL))
    state$last <- now
    writer(phase = phase, current = current, total = total, message = message)
    invisible(NULL)
  }
}

# Presupuesto de corridas Monte Carlo por COSTO estimado (F1).
# El costo de una corrida del comparador es ~O(n_aulas), asi que el costo total
# por metodo es n_aulas x corridas ("aula-corridas"). Historicamente el
# presupuesto solo se activaba con n > 1200 aulas, dejando una ventana
# (100-499 aulas, via sincrona) donde 500 corridas x 4 metodos congelaban
# plumber por minutos. Ahora el criterio es puramente de costo:
# - Costo chico (n x corridas <= 60,000): corre exactamente lo solicitado
#   (goldens historicos intactos: usan marcos <= 150 aulas con pocas corridas).
# - Costo grande: capa a ~60,000 aula-corridas por metodo con piso de 10
#   corridas. Para n > 1200 la formula es IDENTICA a la historica
#   (60000 %/% n); para la ventana media ahora tambien recorta.
# Deterministica (mismo marco -> mismo presupuesto); el resultado reporta
# requested_runs vs executed_runs para auditoria.
.cm_aulas_simulation_budget <- function(n_aulas, requested_runs) {
  requested_runs <- max(0L, as.integer(requested_runs))
  n_aulas <- max(1L, as.integer(n_aulas))
  if (requested_runs <= 0L) return(requested_runs)
  if (as.numeric(n_aulas) * requested_runs <= 60000) return(requested_runs)
  min(requested_runs, max(10L, as.integer(60000 %/% n_aulas)))
}

# Presupuesto del MC del SORTEO FINAL (no del comparador). El comparador solo
# PUNTUA con agregados robustos (medias/percentiles), asi que su piso de 10
# corridas es suficiente. El sorteo final, en cambio, PONDERA con 1/pi_mc: la
# cola de pi bajas domina el peso y un conteo Monte Carlo de 0 para un aula
# seleccionada (posible con pocas corridas) colapsa pi_mc a 0 -> peso NA/Inf.
# Por eso el path final usa un piso mas alto (50 corridas o 150000/n, lo que
# sea mayor): a n~=3000 da ~50 corridas y baja P(count=0 | p=0.08) de ~19% a
# ~1.5%. Aun asi el rescate a design_pi (.cm_aulas_pi_final_rescue) garantiza
# el invariante para cualquier presupuesto. Deliberadamente NO reusa
# .cm_aulas_simulation_budget para no alterar el piso del comparador.
# F1: igual que el comparador, el criterio es de COSTO (n x corridas), no de
# n de aulas: con costo > 150,000 aula-corridas el recorte aplica tambien en
# la ventana media (100-1200 aulas), no solo en marcos > 1200. Para n > 1200
# la formula es identica a la historica.
.cm_aulas_mc_final_budget <- function(n_aulas, requested_runs) {
  requested_runs <- max(0L, as.integer(requested_runs))
  n_aulas <- max(1L, as.integer(n_aulas))
  if (requested_runs <= 0L) return(requested_runs)
  if (as.numeric(n_aulas) * requested_runs <= 150000) return(requested_runs)
  min(requested_runs, max(50L, as.integer(150000 %/% n_aulas)))
}

# W2 (contrato UI): eco de los filtros de criterio 7/8 normalizados con los
# que se construyo ESTE marco. Clave estable `frame$filters_echo`: la UI la
# compara contra la config vigente para marcar "marco desactualizado" cuando
# el usuario cambia el criterio sin reconstruir. Solo escalares saneados —
# nunca passthrough del input crudo.
.cm_aulas_filters_echo <- function(cfg) {
  f <- cfg$filters %||% list()
  list(
    require_min_prevalence = isTRUE(f$require_min_prevalence),
    min_prevalence_pct = .cm_aulas_num(f$min_prevalence_pct, 0.8),
    require_faculty_prevalence = isTRUE(f$require_faculty_prevalence),
    min_faculty_prevalence_pct = .cm_aulas_num(f$min_faculty_prevalence_pct, 0.8),
    require_cycle_homogeneity = isTRUE(f$require_cycle_homogeneity),
    min_cycle_homogeneity_pct = .cm_aulas_num(f$min_cycle_homogeneity_pct, 0.8)
  )
}

# F2: corridas Monte Carlo del sorteo final segun la fuente de probabilidad.
# - pool_controlado: pi_final SOLO puede estimarse por simulacion (la
#   optimizacion posterior invalida las pi prescritas) -> corre el MC completo.
# - D3: descuento secuencial aplicado EN-SORTEO (sequential_discount ON con un
#   engine secuencial y marco con ids): la pi del proceso depende del orden de
#   extraccion y del traslape, asi que tampoco es prescrita -> MC encendido
#   por defecto (mismo presupuesto de escala .cm_aulas_mc_final_budget).
# - Engines de diseño prescrito (todo lo demas): pi_final = pi_design de forma
#   exacta y deterministica; el MC solo llenaba la columna pi_mc de
#   transparencia. Correr 500 selecciones completas para una columna
#   informativa congelaba la via sincrona sin aporte metodologico -> 0 por
#   default. La transparencia queda OPT-IN via selector$mc_prescribed_transparency.
.cm_aulas_seleccionar_mc_runs <- function(selector, engine, sequential_discount = FALSE) {
  engine <- .cm_aulas_engine_key(engine)
  if (engine == "pool_controlado" || isTRUE(sequential_discount)) {
    return(max(.cm_aulas_int(selector$simulation_runs, 0L), .cm_aulas_int(selector$monte_carlo_n, 0L)))
  }
  if (.cm_aulas_bool(selector$mc_prescribed_transparency, FALSE)) {
    return(max(0L, .cm_aulas_int(selector$monte_carlo_n, 0L)))
  }
  0L
}

# F1: costo estimado (en "aula-corridas") de una comparacion de metodos. Cada
# metodo corre 1 seleccion del plan completo de olas (~ n x olas) mas las
# corridas de simulacion presupuestadas (~ n c/u, solo M1). Es una cota de
# ORDEN para que el router decida sync vs job — no un cronometro.
.cm_aulas_comparar_estimated_cost <- function(frame_n, config, methods = NULL, simulation_runs = NULL) {
  frame_n <- max(0L, .cm_aulas_int(frame_n, 0L))
  selector <- config$selector %||% list()
  requested <- max(0L, .cm_aulas_int(simulation_runs %||% selector$simulation_runs, 0L))
  runs <- .cm_aulas_simulation_budget(frame_n, requested)
  methods <- .cm_aulas_chr_vec(methods %||% c("sistematico_pps", "cube_balanceado", "local_pivotal_balanceado", "pool_controlado"))
  n_methods <- max(1L, length(unique(vapply(methods, .cm_aulas_engine_key, character(1)))))
  waves_n <- 1L + max(0L, .cm_aulas_int(selector$replacement_waves, 0L))
  as.numeric(frame_n) * n_methods * (waves_n + runs)
}

# F1/F2: costo estimado del sorteo final: 1 seleccion del plan de olas mas el
# MC final presupuestado (cada corrida MC repite el plan completo de olas).
# Con engines prescritos (mc_runs = 0 por F2) el costo colapsa a una sola
# seleccion -> siempre sync bajo el umbral de aulas.
.cm_aulas_seleccionar_estimated_cost <- function(frame_n, config) {
  frame_n <- max(0L, .cm_aulas_int(frame_n, 0L))
  selector <- config$selector %||% list()
  engine <- .cm_aulas_engine_key(selector$selector_engine)
  # D3: el costo no puede ver si el marco trae ids parseables; asume que el
  # descuento secuencial aplicara (cota superior segura: manda a job, no
  # congela la via sync).
  descuento_secuencial <- engine != "pool_controlado" &&
    engine %in% .cm_descuento_engines_secuenciales() &&
    .cm_aulas_bool(selector$sequential_discount, TRUE)
  mc_runs <- .cm_aulas_mc_final_budget(frame_n, .cm_aulas_seleccionar_mc_runs(selector, engine, descuento_secuencial))
  waves_n <- 1L + max(0L, .cm_aulas_int(selector$replacement_waves, 0L))
  as.numeric(frame_n) * waves_n * (1 + mc_runs)
}

# Rescate del invariante de pesos: un aula SELECCIONADA tiene probabilidad de
# inclusion verdadera > 0, asi que un pi estimado no finito o <= 0 es error de
# estimacion (conteo Monte Carlo nulo por presupuesto recortado), no una pi
# real de cero. Cae al pi del diseno prescrito (deterministico, independiente
# del presupuesto y > 0 para toda aula de un estrato muestreado). Devuelve el
# vector rescatado; el llamador decide como divulgar el rescate.
.cm_aulas_pi_final_rescue <- function(pi_final, pi_design) {
  pi_final <- as.numeric(pi_final)
  pi_design <- as.numeric(pi_design)
  missing <- !is.finite(pi_final) | pi_final <= 0
  pi_final[missing] <- pi_design[missing]
  pi_final
}

.cm_aulas_method_simulation_summary <- function(frame_result, aula_frame, selector, engine, objective, requested_runs = 0L, on_progress = NULL) {
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
  budget_runs <- .cm_aulas_simulation_budget(nrow(aula_frame), requested_runs)
  local_selector <- selector
  if (.cm_aulas_engine_key(engine) == "pool_controlado") {
    local_selector$candidate_pool_size <- min(.cm_aulas_int(selector$candidate_pool_size, 25L), 25L)
  }
  scores <- numeric(budget_runs)
  coverage <- numeric(budget_runs)
  duplicate_loss <- numeric(budget_runs)
  waves <- c("M1")
  # El marco (frame_result + local_selector + objective) es invariante entre las
  # corridas Monte Carlo; compartir el cache del objetivo evita reparsear el
  # marco en cada corrida (dominante con monte_carlo_n alto en marcos grandes).
  mc_cache <- new.env(parent = emptyenv())
  # design_pi es deterministica (sin RNG): calcularla una sola vez fuera del
  # loop no cambia resultados y evita repetirla en cada corrida.
  design_pi <- .cm_aulas_design_probabilities(aula_frame, local_selector, engine)
  method_label <- .cm_aulas_method_label(.cm_aulas_engine_key(engine))
  for (i in seq_len(budget_runs)) {
    .cm_aulas_progress(on_progress, "simulacion", current = i, total = budget_runs,
                       message = sprintf("%s: corrida %d de %d", method_label, i, budget_runs))
    selected <- .cm_aulas_select_waves(aula_frame, local_selector, engine, waves, seed = local_selector$seed + i * 3571L, objective = objective)
    selected$pi_final <- as.numeric(design_pi[selected$classroom_id])
    selected$weight_classroom <- ifelse(selected$pi_final > 0, 1 / selected$pi_final, NA_real_)
    obj <- tryCatch(calc_muestra_aulas_representativity_objective(frame_result, selected, local_selector, objective, cache = mc_cache), error = function(e) NULL)
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

.cm_aulas_run_method_summary <- function(frame_result, aula_frame, selector, engine, simulation_runs = NULL, objective = NULL, on_progress = NULL) {
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
  # D3: si el sorteo de ESTA corrida aplico el descuento secuencial, las pi
  # que la tarjeta publica (design_pi estatica) no describen el proceso
  # ejecutado. El MC del proceso corre solo en la seleccion final (correrlo
  # por tarjeta multiplicaria el costo de la comparacion), asi que la tarjeta
  # lo declara: pi referenciales del diseno estatico, no del sorteo.
  descuento_estado <- .cm_descuento_estado(aula_frame, local_selector, engine)
  descuento_secuencial <- engine != "pool_controlado" &&
    isTRUE(descuento_estado$applied) && identical(descuento_estado$mode, "sequential")
  probability_source <- if (engine == "pool_controlado") {
    "monte_carlo_after_optimization"
  } else if (descuento_secuencial) {
    "prescribed_design_reference"
  } else {
    "prescribed_design"
  }
  if (descuento_secuencial) {
    warnings <- c(warnings, paste(
      "Comparacion de metodos con descuento secuencial aplicado al sorteo:",
      "las pi de esta tarjeta son referenciales del diseno estatico",
      "(pi_design); la pi del proceso secuencial solo se estima por Monte",
      "Carlo en la seleccion final, no en la comparacion."
    ))
  }
  risk_flags <- .cm_aulas_risk_flags(aula_frame, selected, local_selector, engine, engine_used, warnings, balance, concentration)
  simulation_summary <- .cm_aulas_method_simulation_summary(frame_result, aula_frame, local_selector, engine, objective, requested_runs = local_selector$simulation_runs, on_progress = on_progress)
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

calc_muestra_aulas_comparar_metodos <- function(frame_result, config = list(), methods = NULL, simulation_runs = NULL, on_progress = NULL) {
  .cm_aulas_progress(on_progress, "preparando", message = "Preparando marco de aulas", force = TRUE)
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
  runs <- lapply(seq_along(methods), function(idx) {
    engine <- methods[[idx]]
    .cm_aulas_progress(on_progress, "comparar", current = idx, total = length(methods),
                       message = sprintf("Método %d de %d (%s)", idx, length(methods), .cm_aulas_method_label(engine)),
                       force = TRUE)
    .cm_aulas_run_method_summary(frame_result, aula_frame, selector, engine, simulation_runs = selector$simulation_runs, objective = objective, on_progress = on_progress)
  })
  .cm_aulas_progress(on_progress, "consolidando", message = "Consolidando comparación de métodos", force = TRUE)
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
    selector = .cm_aulas_method_comparison_selector_snapshot(selector, objective),
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
    # Corridas efectivamente ejecutadas por metodo tras aplicar el presupuesto
    # sensible a escala (.cm_aulas_simulation_budget). En marcos chicos
    # coincide con simulation_runs; en marcos grandes puede ser menor y el
    # detalle por metodo queda en simulation_summary (requested vs executed).
    simulation_runs_executed = if (is.data.frame(simulation_summary) && nrow(simulation_summary) && "executed_runs" %in% names(simulation_summary)) {
      max(simulation_summary$executed_runs, na.rm = TRUE)
    } else {
      selector$simulation_runs
    },
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
  lookup_cols <- intersect(c("classroom_id", "unique_student_ids", "eligible_n", "faculty", "faculty_aula", "program", "level", "course_level_num", "schedule", "size_group"), names(aula_frame))
  lookup <- aula_frame[, lookup_cols, drop = FALSE]
  merge(public, lookup, by = "classroom_id", all.x = TRUE, sort = FALSE, suffixes = c("", "_frame"))
}

.cm_aulas_replacement_score <- function(titular, reserve, active_student_ids = character(0), selector = list()) {
  # Acceso robusto a columna ausente (marco anonimizado): evita NULL[[1]].
  .row_ids <- function(row) {
    u1 <- if ("unique_student_ids" %in% names(row)) row$unique_student_ids[[1]] else NULL
    u2 <- if ("unique_student_ids_frame" %in% names(row)) row$unique_student_ids_frame[[1]] else NULL
    u1 %||% u2 %||% ""
  }
  ids_t <- .cm_aulas_student_ids(.row_ids(titular))
  ids_r <- .cm_aulas_student_ids(.row_ids(reserve))
  overlap <- length(intersect(ids_r, .cm_aulas_chr_vec(active_student_ids)))
  titular_overlap <- length(intersect(ids_t, ids_r))
  eligible_t <- .cm_aulas_num(titular$eligible_n[[1]], 0)
  eligible_r <- .cm_aulas_num(reserve$eligible_n[[1]], 0)
  weights <- selector$replacement_score_weights %||% list()
  w <- function(name, default) .cm_aulas_num(weights[[name]], default)
  score <- 0
  if (identical(.cm_aulas_scalar(titular$faculty[[1]], ""), .cm_aulas_scalar(reserve$faculty[[1]], ""))) score <- score + w("faculty", 35)
  if (identical(.cm_aulas_scalar(titular$program[[1]], ""), .cm_aulas_scalar(reserve$program[[1]], ""))) score <- score + w("program", 22)
  if (identical(.cm_aulas_scalar(titular$level[[1]], ""), .cm_aulas_scalar(reserve$level[[1]], ""))) score <- score + w("level", 12)
  if (identical(.cm_aulas_scalar(titular$size_group[[1]], ""), .cm_aulas_scalar(reserve$size_group[[1]], ""))) score <- score + w("size_group", 8)
  if (identical(.cm_aulas_scalar(titular$modality[[1]], ""), .cm_aulas_scalar(reserve$modality[[1]], ""))) score <- score + w("modality", 7)
  if (identical(.cm_aulas_scalar(titular$sex_top_1[[1]], ""), .cm_aulas_scalar(reserve$sex_top_1[[1]], ""))) score <- score + w("sex_top_1", 6)
  if (identical(.cm_aulas_scalar(titular$schedule[[1]], ""), .cm_aulas_scalar(reserve$schedule[[1]], ""))) score <- score + w("schedule", 4)
  eligible_component <- w("eligible_n", 10)
  score <- score + max(0, eligible_component - abs(eligible_t - eligible_r) / max(1, eligible_t) * eligible_component)
  score <- score + w("active_overlap", -18) * min(1, overlap / max(1, length(ids_r)))
  list(
    score = round(score, 2),
    overlap = overlap,
    titular_overlap = titular_overlap,
    eligible_delta = eligible_r - eligible_t
  )
}

calc_muestra_aulas_simular_reemplazos <- function(frame_result, selection_result, config = list(), on_progress = NULL) {
  if (is.null(selection_result) || !is.list(selection_result)) {
    stop("Se requiere una seleccion de aulas antes de simular reemplazos.", call. = FALSE)
  }
  .cm_aulas_progress(on_progress, "preparando", message = "Preparando simulación de reemplazos", force = TRUE)
  cfg <- calc_muestra_aulas_normalize_config(config %||% frame_result$config %||% selection_result$selector %||% list())
  objective <- cfg$objective
  aula_frame <- .cm_aulas_prepare_frame(frame_result, cfg)
  selection_df <- .cm_aulas_selection_private(selection_result, aula_frame)
  if (!nrow(selection_df)) stop("La seleccion no contiene aulas.", call. = FALSE)
  if (!"selection_slot_id" %in% names(selection_df)) selection_df$selection_slot_id <- ""
  if (!"replacement_order" %in% names(selection_df)) selection_df$replacement_order <- vapply(selection_df$wave, .cm_aulas_wave_number, integer(1)) - 1L
  selection_df <- .cm_aulas_assign_operational_codes(selection_df)
  roles <- .cm_aulas_role_values(selection_df)
  titulars <- selection_df[roles == "titular" | selection_df$wave == "M1", , drop = FALSE]
  reserves <- selection_df[roles == "chain_reserve", , drop = FALSE]
  # El objetivo descarta la bolsa extra internamente; pre-filtrarla una vez evita
  # copiar ~N filas muertas en cada par titular-candidato (identico resultado).
  selection_core <- selection_df[roles != "extra_reserve_pool", , drop = FALSE]
  # Roles de selection_core: invariantes para el filtro de bolsa extra (ninguna
  # fila es extra). Se pasan al objetivo para no renormalizar por par.
  core_roles <- roles[roles != "extra_reserve_pool"]
  # Cache del lado invariante del marco (frame preparado, perfiles por columna,
  # unicos del marco): el objetivo se recomputa por cada par titular-candidato,
  # pero solo cambia el conjunto M1. Compartir el cache evita el reparseo O(n)
  # del marco en cada llamada y elimina la segunda O(n^2) de la simulacion.
  obj_cache <- new.env(parent = emptyenv())
  before_obj <- calc_muestra_aulas_representativity_objective(frame_result, selection_core, cfg$selector, objective, cache = obj_cache, roles = core_roles)
  suggestions <- list()
  impact <- list()
  for (i in seq_len(nrow(titulars))) {
    # F10: el par titular x candidatos domina el costo (~76 s a 3k aulas);
    # reportar por titular da progreso util sin tocar RNG ni datos.
    .cm_aulas_progress(on_progress, "simular_reemplazos", current = i, total = nrow(titulars),
                       message = sprintf("Simulando reemplazos: titular %d de %d", i, nrow(titulars)))
    titular <- titulars[i, , drop = FALSE]
    candidates <- reserves
    if ("selection_slot_id" %in% names(candidates) && "selection_slot_id" %in% names(titular)) {
      tied <- candidates[candidates$selection_slot_id == titular$selection_slot_id[[1]], , drop = FALSE]
      if (nrow(tied)) candidates <- tied
    } else if ("replacement_for" %in% names(candidates)) {
      tied <- candidates[candidates$replacement_for == titular$classroom_id[[1]], , drop = FALSE]
      if (nrow(tied)) candidates <- tied
    }
    if (!nrow(candidates)) next
    # Invariantes en j: los student-ids activos de otros titulares y el indice
    # del titular a reemplazar dependen solo de i. Se calculan una vez fuera del
    # lapply (antes se recomputaban por cada candidato).
    active_ids <- .cm_aulas_active_students_without_titular(titulars, i)
    old_idx <- which(selection_core$classroom_id == titular$classroom_id[[1]] & selection_core$wave == "M1")[1]
    scores <- lapply(seq_len(nrow(candidates)), function(j) {
      local_score <- .cm_aulas_replacement_score(titular, candidates[j, , drop = FALSE], active_ids, cfg$selector)
      after_selection <- selection_core
      if (is.finite(old_idx)) {
        reserve_row <- candidates[j, , drop = FALSE]
        reserve_row$wave <- "M1"
        reserve_row$replacement_for <- titular$classroom_id[[1]]
        common <- intersect(names(after_selection), names(reserve_row))
        after_selection[old_idx, common] <- reserve_row[1, common]
      }
      after_obj <- tryCatch(calc_muestra_aulas_representativity_objective(frame_result, after_selection, cfg$selector, objective, cache = obj_cache, roles = core_roles), error = function(e) NULL)
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
    replacement_order <- if ("replacement_order" %in% names(candidates)) suppressWarnings(as.numeric(candidates$replacement_order)) else rep(NA_real_, nrow(candidates))
    replacement_order[!is.finite(replacement_order)] <- vapply(candidates$wave[!is.finite(replacement_order)], .cm_aulas_wave_number, integer(1)) - 1L
    score_values <- vapply(scores, function(x) if (is.finite(x$after_score)) x$after_score else x$score, numeric(1))
    ord <- order(replacement_order, -score_values, na.last = TRUE)
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
        selection_slot_id = titular$selection_slot_id[[1]] %||% "",
        titular_operational_code = titular$operational_code[[1]] %||% "",
        titular_classroom_id = titular$classroom_id[[1]],
        titular_label = titular$course_name[[1]] %||% titular$label[[1]] %||% "",
        reserve_operational_code = reserve$operational_code[[1]] %||% "",
        replacement_chain_code = reserve$replacement_chain_code[[1]] %||% "",
        reserve_classroom_id = reserve$classroom_id[[1]],
        reserve_label = reserve$course_name[[1]] %||% reserve$label[[1]] %||% "",
        rank = rank,
        wave = reserve$wave[[1]],
        replacement_order = reserve$replacement_order[[1]] %||% rank,
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
      selection_slot_id = titular$selection_slot_id[[1]] %||% "",
      titular_operational_code = titular$operational_code[[1]] %||% "",
      titular_classroom_id = titular$classroom_id[[1]],
      replacement_operational_code = best$operational_code[[1]] %||% "",
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

calc_muestra_aulas_seleccionar <- function(frame_result, config = list(), on_progress = NULL) {
  if (is.null(frame_result) || !is.list(frame_result)) {
    stop("Se requiere un marco construido por calc_muestra_aulas_construir().", call. = FALSE)
  }
  .cm_aulas_progress(on_progress, "preparando", message = "Preparando marco", force = TRUE)
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
  selection_df <- .cm_aulas_select_waves(aula_frame, selector, engine, waves, seed = selector$seed, objective = objective, on_progress = on_progress)
  # EF2: docente unico entre titulares (calc_muestra_aulas_docente_unico.R);
  # corre ANTES de leer attrs para que su aviso viaje con los del sorteo.
  selection_df <- .cm_aulas_docente_unico_reparar(selection_df, aula_frame, selector)
  engine_used <- .cm_aulas_scalar(attr(selection_df, "engine_used"), engine)
  fallback_warnings <- attr(selection_df, "warnings") %||% character(0)
  # D2: el ajuste de tamano del sorteo viaja como DATO (attr de la seleccion),
  # no solo como texto de warning; merge() lo perderia, asi que se captura
  # aqui y se re-adjunta al final.
  size_adjustment <- attr(selection_df, "size_adjustment") %||% list(added_n = 0L, removed_n = 0L)
  # El recorrido se rescata ANTES de los merge: `merge()` descarta atributos.
  recorrido_sorteo <- attr(selection_df, "recorrido") %||% NULL
  docente_unico_registro <- attr(selection_df, "docente_unico") %||% NULL
  if (!nrow(selection_df)) stop("No se pudo seleccionar aulas con el marco actual.", call. = FALSE)
  rownames(selection_df) <- NULL

  selection_run_id <- paste0("sel_aulas_", format(Sys.time(), "%Y%m%d%H%M%S"), "_", substr(.cm_aulas_hash(list(frame_result$frame_hash, selector$seed)), 1, 8))
  total_by_stratum <- stats::aggregate(eligible_n ~ stratum, data = aula_frame, FUN = sum)
  names(total_by_stratum)[names(total_by_stratum) == "eligible_n"] <- "stratum_eligible_n"
  selection_df <- merge(selection_df, total_by_stratum, by = "stratum", all.x = TRUE, sort = FALSE)
  selected_counts <- stats::aggregate(classroom_id ~ stratum + wave, data = selection_df, FUN = length)
  names(selected_counts)[names(selected_counts) == "classroom_id"] <- "selected_in_stratum_wave"
  selection_df <- merge(selection_df, selected_counts, by = c("stratum", "wave"), all.x = TRUE, sort = FALSE)
  attr(selection_df, "size_adjustment") <- size_adjustment

  design_pi <- .cm_aulas_design_probabilities(aula_frame, selector, engine)
  # D3: el descuento secuencial EN-SORTEO invalida la pi estatica (la pi del
  # proceso depende del orden de extraccion y del traslape). El estado se
  # resuelve con el marco REAL (ids parseables), igual que en el sorteo.
  descuento_estado <- .cm_descuento_estado(aula_frame, selector, engine)
  descuento_secuencial <- engine != "pool_controlado" &&
    isTRUE(descuento_estado$applied) && identical(descuento_estado$mode, "sequential")
  probability_source <- if (engine == "pool_controlado") {
    "monte_carlo_after_optimization"
  } else if (descuento_secuencial) {
    "monte_carlo_sequential_discount"
  } else {
    "prescribed_design"
  }
  usa_mc <- probability_source %in% c("monte_carlo_after_optimization", "monte_carlo_sequential_discount")
  # F2: con diseño prescrito el MC era pura transparencia (pi_final = pi_design
  # exacta); 500 corridas por default congelaban la via sincrona. La semantica
  # (0 por default para prescritos, opt-in via mc_prescribed_transparency,
  # encendido con descuento secuencial) vive en .cm_aulas_seleccionar_mc_runs,
  # compartida con el estimador de costo del router.
  mc_runs <- .cm_aulas_seleccionar_mc_runs(selector, engine, descuento_secuencial)
  if (mc_runs > 0L) {
    .cm_aulas_progress(on_progress, "simulacion_mc", message = "Simulación Monte Carlo", force = TRUE)
  }
  mc <- .cm_aulas_mc_probabilities(aula_frame, selector, engine, waves, runs = mc_runs, objective = objective, on_progress = on_progress)
  if (probability_source == "prescribed_design" && mc$runs <= 0L) {
    mc$note <- "MC de transparencia omitido: pi prescritas por diseño (pi_final = pi_design). Activa selector$mc_prescribed_transparency para estimar pi_mc por simulacion."
  }
  pi_mc_lookup <- mc$pi
  pi_final_lookup <- if (usa_mc) pi_mc_lookup else design_pi
  student_pi_lookup <- .cm_aulas_student_probability_summary(aula_frame, pi_final_lookup)

  selection_df$pi_base <- as.numeric(design_pi[selection_df$classroom_id])
  selection_df$pi_design <- as.numeric(design_pi[selection_df$classroom_id])
  selection_df$pi_mc <- as.numeric(pi_mc_lookup[selection_df$classroom_id])
  selection_df$pi_final <- if (usa_mc) selection_df$pi_mc else selection_df$pi_design
  # Invariante innegociable: toda aula SELECCIONADA tiene pi_final > 0 (y por
  # ende peso finito), con cualquier presupuesto Monte Carlo. En el path MC un
  # conteo de 0 por corridas recortadas colapsaba pi_mc -> pi_final = 0 -> peso
  # NA. El path prescrito ya rescataba a design_pi; ahora AMBOS lo hacen. pi_mc
  # conserva el estimador crudo en su columna para transparencia; pi_final usa
  # el rescate para no romper los pesos.
  missing_final <- !is.finite(selection_df$pi_final) | selection_df$pi_final <= 0
  mc_rescued_n <- if (usa_mc) {
    sum(missing_final & .cm_aulas_role_values(selection_df) != "extra_reserve_pool")
  } else {
    0L
  }
  selection_df$pi_final <- .cm_aulas_pi_final_rescue(selection_df$pi_final, selection_df$pi_design)
  selection_df$probability_source <- probability_source
  selection_df$mc_runs <- mc$runs
  # mc$runs son las corridas EJECUTADAS (ya presupuestadas por escala del marco).
  # Cuando el marco es grande y se recorto el presupuesto, exponemos requested vs
  # ejecutadas junto al SE para que el usuario sepa que la precision es la de las
  # corridas realmente ejecutadas, no la de las solicitadas.
  selection_df$mc_error_summary <- if (is.finite(mc$error)) {
    if (isTRUE(mc$budgeted)) {
      sprintf("max_se=%s (%s de %s corridas presupuestadas)", mc$error, mc$runs, mc$requested)
    } else {
      sprintf("max_se=%s", mc$error)
    }
  } else {
    mc$note
  }
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
  if (!"sample_role" %in% names(selection_df)) {
    selection_df$sample_role <- ifelse(selection_df$wave == "M1", "titular", "chain_reserve")
  }
  selection_df$sample_role <- .cm_aulas_role_values(selection_df)
  if (!"selection_slot_id" %in% names(selection_df)) selection_df$selection_slot_id <- ""
  if (!"replacement_order" %in% names(selection_df)) selection_df$replacement_order <- ifelse(selection_df$wave == "M1", 0L, vapply(selection_df$wave, .cm_aulas_wave_number, integer(1)) - 1L)
  if (!"replacement_for" %in% names(selection_df)) selection_df$replacement_for <- ""
  if (!"chain_score" %in% names(selection_df)) selection_df$chain_score <- NA_real_
  if (!"equivalence_level" %in% names(selection_df)) selection_df$equivalence_level <- ifelse(selection_df$wave == "M1", "titular", "")
  if (!"replacement_impact_score" %in% names(selection_df)) selection_df$replacement_impact_score <- NA_real_
  if (!"chain_depth" %in% names(selection_df)) selection_df$chain_depth <- NA_integer_
  if (!"activation_weight_status" %in% names(selection_df)) selection_df$activation_weight_status <- ifelse(selection_df$wave == "M1", "titular_ready", "reserve_conditional")
  if (!"analysis_weight_warning" %in% names(selection_df)) selection_df$analysis_weight_warning <- ""
  extra_idx <- selection_df$sample_role == "extra_reserve_pool"
  if (any(extra_idx)) {
    selection_df$probability_source[extra_idx] <- "extra_pool_not_selected"
    selection_df$pi_final[extra_idx] <- 0
    selection_df$weight_classroom[extra_idx] <- NA_real_
    selection_df$pi_student[extra_idx] <- NA_real_
    selection_df$weight_student[extra_idx] <- NA_real_
    selection_df$peso_base[extra_idx] <- NA_real_
    selection_df$activation_weight_status[extra_idx] <- "not_selected_extra_pool"
    selection_df$analysis_weight_warning[extra_idx] <- "Reserva extra no seleccionada; solo usar si se documenta una activacion excepcional."
    selection_df$weight_warning[extra_idx] <- selection_df$analysis_weight_warning[extra_idx]
  }
  selection_df$student_ids_hash <- {
    ids_src <- if ("unique_student_ids" %in% names(selection_df)) selection_df$unique_student_ids
               else if ("unique_student_ids_frame" %in% names(selection_df)) selection_df$unique_student_ids_frame
               else NULL
    if (is.null(ids_src)) rep(.cm_aulas_hash(character(0)), nrow(selection_df))
    else vapply(ids_src, function(x) .cm_aulas_hash(.cm_aulas_student_ids(x)), character(1))
  }
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
    # D3: con descuento secuencial en-sorteo la pi publicada es la del PROCESO
    # (estimada por Monte Carlo del mismo sorteo secuencial), no la del diseno
    # estatico; se divulga siempre.
    if (probability_source == "monte_carlo_sequential_discount") {
      "Descuento secuencial aplicado en el sorteo: pi_final se estima por Monte Carlo del proceso secuencial (probability_source monte_carlo_sequential_discount); pi_design se conserva como referencia del diseno estatico y como rescate divulgado cuando el estimador MC es invalido."
    } else {
      character(0)
    },
    # Divulgacion del presupuesto recortado: cuando el marco es grande el MC
    # final corre menos corridas que las solicitadas, asi que el SE de pi_mc es
    # el de las corridas EJECUTADAS. Se expone a nivel de diseno, no solo en la
    # celda mc_error_summary.
    if (isTRUE(mc$budgeted)) {
      sprintf("Marco grande: el Monte Carlo final ejecuto %s de %s corridas presupuestadas para mantener interactividad; el SE reportado refleja las corridas ejecutadas.", mc$runs, mc$requested)
    } else {
      character(0)
    },
    # Divulgacion del rescate: aulas seleccionadas cuyo conteo Monte Carlo fue 0
    # por el presupuesto recortado recuperan pi_final desde el diseno prescrito.
    if (mc_rescued_n > 0L) {
      sprintf("%s aula(s) seleccionada(s) con conteo Monte Carlo nulo por presupuesto recortado; pi_final rescatada del diseno prescrito para preservar pesos finitos.", mc_rescued_n)
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

  .cm_aulas_progress(on_progress, "consolidando", message = "Consolidando selección y pesos", force = TRUE)
  representativity <- calc_muestra_aulas_representativity_objective(frame_result, selection_df, selector, objective)
  selection_df$representativity_score <- representativity$representativity_score
  selection_df$representativity_distance <- representativity$weighted_distance
  selection_df <- .cm_aulas_assign_operational_codes(selection_df)

  public_cols <- c(
    "selection_run_id", "operational_code", "titular_operational_code",
    "replacement_chain_code", "operational_sequence",
    "selection_slot_id", "sample_role", "wave", "replacement_order",
    "orden", "classroom_id", "label", "course_id",
    "course_name", "section", "schedule", "modality", "session_type", "teacher",
    "teacher_email", "faculty", "faculty_aula", "program", "level", "course_level_num", "eligible_n", "enrolled_total",
    "p_aplicada_ref", "rendimiento_ref", "efectivas_esperadas",
    "size_group", "sex_top_1", "sex_top_1_n", "sex_top_2", "sex_top_2_n",
    "stratum", "pi_base", "pi_design", "pi_mc", "pi_final", "probability_source",
    "mc_runs", "mc_error_summary", "weight_classroom", "pi_student", "weight_student",
    "nonresponse_adjustment_flag", "poststratification_flag", "weight_warning",
    "peso_base", "selector_score", "unique_added", "duplicate_overlap",
    # Auditoría del descuento secuencial de repetidos (solo presentes con
    # sequential_discount ON; el intersect las omite con OFF).
    .cm_descuento_audit_cols(),
    "active_overlap", "titular_overlap", "eligible_delta_vs_titular",
    "representativity_score", "representativity_distance", "chain_score",
    "equivalence_level", "replacement_impact_score", "chain_depth",
    "activation_weight_status", "analysis_weight_warning",
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
      "reemplazos_encadenados", "reserva_extra",
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
      as.character(sum(selection_public$sample_role == "chain_reserve", na.rm = TRUE)),
      as.character(sum(selection_public$sample_role == "extra_reserve_pool", na.rm = TRUE)),
      as.character(sum(selection_public$unique_added, na.rm = TRUE)),
      as.character(sum(selection_public$duplicate_overlap, na.rm = TRUE)),
      as.character(representativity$representativity_score),
      as.character(representativity$weighted_distance)
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  probabilities <- selection_public[, intersect(c(
    "selection_run_id", "operational_code", "titular_operational_code",
    "replacement_chain_code", "operational_sequence",
    "selection_slot_id", "sample_role", "wave", "replacement_order",
    "classroom_id", "replacement_for", "stratum", "eligible_n",
    "pi_base", "pi_design", "pi_mc", "pi_final", "probability_source",
    "mc_runs", "mc_error_summary", "weight_classroom", "pi_student",
    "weight_student", "activation_weight_status", "weight_warning", "analysis_weight_warning"
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
    # Contrato con el frontend del descuento secuencial de repetidos: siempre
    # presente (mode "off" con el flag apagado); resumen bruto vs neto por
    # estrato sobre los titulares M1. Lógica en calc_muestra_aulas_descuento.R.
    sequential_discount = .cm_descuento_resultado(selection_df, aula_frame, selector, engine),
    # Recorrido del sorteo: la recta, el arranque y las marcas del sistemático
    # PPS por estrato. Es el ÚNICO orden de selección real que existe en este
    # método —`orden`/`operational_sequence` son el orden de entrega al campo—,
    # y sin publicarlo el Relato no puede contar la cadena sin inventarla.
    # Con otros engines viaja `aplicable = FALSE`: no hubo caminata.
    recorrido_sorteo = recorrido_sorteo %||% .cm_aulas_recorrido_por_estrato(list()),
    quotas = .cm_aulas_records(data.frame(stratum = names(.cm_aulas_quota_estratos(aula_frame, selector$n_aulas, selector)), n_aulas = as.integer(.cm_aulas_quota_estratos(aula_frame, selector$n_aulas, selector)), stringsAsFactors = FALSE)),
    summary = summary,
    diagnostics = list(
      docente_unico = docente_unico_registro,
      probabilities = probabilities,
      balance = balance,
      profile_distributions = representativity$profile_distributions,
      representativity_metrics = representativity$metrics,
      coverage_overlap = coverage_overlap,
      weight_stability = weight_stability,
      reserve_depth = representativity$reserve_depth,
      replacement_chains = .cm_aulas_replacement_chains_table(selection_public),
      extra_reserve_pool = .cm_aulas_extra_pool_table(selection_public),
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

.cm_aulas_demo_path <- function() {
  if (exists(".cm_locate_catalog", mode = "function")) {
    return(.cm_locate_catalog("preset_hsvg_pucp_2025_aulas_demo.json"))
  }
  candidates <- c(
    file.path(getwd(), "api", "inst", "catalogos", "preset_hsvg_pucp_2025_aulas_demo.json"),
    file.path(getwd(), "inst", "catalogos", "preset_hsvg_pucp_2025_aulas_demo.json"),
    file.path(getwd(), "..", "api", "inst", "catalogos", "preset_hsvg_pucp_2025_aulas_demo.json")
  )
  hit <- candidates[file.exists(candidates)][1]
  if (is.na(hit)) stop("No se encontro el preset de aulas demo 2025.", call. = FALSE)
  hit
}

.cm_aulas_demo_wave_number <- function(x) {
  vapply(x, function(item) {
    key <- .cm_aulas_scalar(item, "")
    out <- suppressWarnings(as.integer(gsub("[^0-9]", "", key)))
    if (is.finite(out)) out else 999L
  }, integer(1))
}

.cm_aulas_demo_student_key <- function(x) {
  key <- .cm_aulas_text_key(x)
  if (!nzchar(key)) key <- "global"
  key
}

.cm_aulas_demo_with_synthetic_students <- function(aula_frame, population_n = 0L) {
  if (!nrow(aula_frame)) return(aula_frame)
  aula_frame$eligible_n <- suppressWarnings(as.numeric(aula_frame$eligible_n))
  aula_frame$eligible_n[!is.finite(aula_frame$eligible_n) | aula_frame$eligible_n < 0] <- 0
  population_n <- max(1L, .cm_aulas_int(population_n, sum(aula_frame$eligible_n, na.rm = TRUE)))
  exposure_by_faculty <- stats::aggregate(eligible_n ~ faculty, data = aula_frame, FUN = sum)
  total_exposure <- sum(exposure_by_faculty$eligible_n, na.rm = TRUE)
  if (!is.finite(total_exposure) || total_exposure <= 0) total_exposure <- nrow(aula_frame)
  pool_sizes <- pmax(1L, round(population_n * exposure_by_faculty$eligible_n / total_exposure))
  delta <- population_n - sum(pool_sizes)
  if (delta != 0L && length(pool_sizes)) {
    ord <- order(exposure_by_faculty$eligible_n, decreasing = TRUE)
    for (i in seq_len(abs(delta))) {
      idx <- ord[((i - 1L) %% length(ord)) + 1L]
      pool_sizes[[idx]] <- max(1L, pool_sizes[[idx]] + if (delta > 0L) 1L else -1L)
    }
  }
  pool_lookup <- stats::setNames(pool_sizes, exposure_by_faculty$faculty)
  cursor <- stats::setNames(rep(0L, length(pool_lookup)), names(pool_lookup))
  aula_frame <- aula_frame[order(.cm_aulas_demo_wave_number(aula_frame$wave), aula_frame$historical_order %||% seq_len(nrow(aula_frame))), , drop = FALSE]
  ids <- character(nrow(aula_frame))
  for (i in seq_len(nrow(aula_frame))) {
    faculty <- .cm_aulas_scalar(aula_frame$faculty[[i]], "sin_facultad")
    pool <- max(1L, .cm_aulas_int(pool_lookup[[faculty]], 1L))
    n <- max(1L, .cm_aulas_int(aula_frame$eligible_n[[i]], 1L))
    start <- cursor[[faculty]] %% pool
    local <- ((seq_len(n) + start - 1L) %% pool) + 1L
    prefix <- paste0("demo2025_", .cm_aulas_demo_student_key(faculty), "_")
    ids[[i]] <- paste0(prefix, sprintf("%05d", local), collapse = "|")
    cursor[[faculty]] <- cursor[[faculty]] + max(1L, round(n * 0.78))
  }
  aula_frame$unique_student_ids <- ids
  aula_frame$student_ids_policy <- "sinteticos_anonimos_para_demo"
  rownames(aula_frame) <- NULL
  aula_frame
}

.cm_aulas_demo_metric <- function(df, metric, column = "value", default = NA_real_) {
  if (!is.data.frame(df) || !nrow(df) || !"metric" %in% names(df) || !column %in% names(df)) return(default)
  out <- suppressWarnings(as.numeric(df[[column]][df$metric == metric][[1]] %||% default))
  if (is.finite(out)) out else default
}

.cm_aulas_demo_balance_score <- function(representativity) {
  metrics <- .cm_aulas_as_df(representativity$metrics %||% data.frame(stringsAsFactors = FALSE), "metrics")
  metrics <- metrics[metrics$metric_group == "balance" & metrics$active %in% TRUE, , drop = FALSE]
  if (!nrow(metrics)) return(NA_real_)
  weights <- suppressWarnings(as.numeric(metrics$normalized_weight))
  scores <- suppressWarnings(as.numeric(metrics$score))
  ok <- is.finite(weights) & weights > 0 & is.finite(scores)
  if (any(ok)) return(round(stats::weighted.mean(scores[ok], weights[ok]), 1))
  round(mean(scores[is.finite(scores)], na.rm = TRUE), 1)
}

.cm_aulas_demo_method_comparison <- function(frame_result, selection_result, config, representativity) {
  historical_score <- .cm_aulas_num(representativity$representativity_score, 82)
  balance_score <- .cm_aulas_demo_balance_score(representativity)
  if (!is.finite(balance_score)) balance_score <- historical_score
  coverage <- .cm_aulas_as_df(representativity$coverage_overlap %||% data.frame(stringsAsFactors = FALSE), "coverage")
  coverage_pct <- .cm_aulas_demo_metric(coverage, "coverage_population_pct", "value", NA_real_)
  duplicate_loss <- .cm_aulas_demo_metric(coverage, "duplicate_loss", "value", NA_real_)
  selection_df <- .cm_aulas_as_df(selection_result$selection, "selection")
  repeated <- sum(suppressWarnings(as.numeric(selection_df$duplicate_overlap)), na.rm = TRUE)
  reserve_depth <- .cm_aulas_as_df(representativity$reserve_depth %||% data.frame(stringsAsFactors = FALSE), "reserve_depth")
  reserve_ratio <- if (nrow(reserve_depth)) mean(suppressWarnings(as.numeric(reserve_depth$depth_ratio)), na.rm = TRUE) else NA_real_
  methods <- data.frame(
    method_id = c("sistematico_pps", "cube_balanceado", "local_pivotal_balanceado", "pool_controlado"),
    method_label = c("Seleccion proporcional historica", .cm_aulas_method_label("cube_balanceado"), .cm_aulas_method_label("local_pivotal_balanceado"), .cm_aulas_method_label("pool_controlado")),
    engine_used = c("historical_import_2025", "pendiente_de_recalculo", "pendiente_de_recalculo", "pendiente_de_recalculo"),
    probability_source = c("historical_systematic_pps_reconstructed_from_mos", "prescribed_design", "prescribed_design", "monte_carlo_after_optimization"),
    balance_score = c(balance_score, min(100, balance_score + 3), min(100, balance_score + 4), min(100, balance_score + 5)),
    repeated_students = c(repeated, max(0, round(repeated * 0.82)), max(0, round(repeated * 0.76)), max(0, round(repeated * 0.55))),
    duplicate_loss = c(duplicate_loss, max(0, duplicate_loss * 0.86), max(0, duplicate_loss * 0.80), max(0, duplicate_loss * 0.62)),
    repetition_score = c(NA_real_, NA_real_, NA_real_, NA_real_),
    unique_students_covered = c(
      sum(suppressWarnings(as.numeric(selection_df$unique_added[selection_df$wave == "M1"])), na.rm = TRUE),
      NA_real_,
      NA_real_,
      NA_real_
    ),
    coverage_unique_pct = c(coverage_pct, min(1, coverage_pct * 1.02), min(1, coverage_pct * 1.03), min(1, coverage_pct * 1.05)),
    coverage_score = c(NA_real_, NA_real_, NA_real_, NA_real_),
    schedule_concentration_delta = c(NA_real_, NA_real_, NA_real_, NA_real_),
    concentration_score = c(NA_real_, NA_real_, NA_real_, NA_real_),
    reserve_depth_ratio = c(reserve_ratio, reserve_ratio, reserve_ratio, reserve_ratio),
    reserve_score = c(NA_real_, NA_real_, NA_real_, NA_real_),
    weight_cv = c(.cm_aulas_demo_metric(.cm_aulas_as_df(representativity$weight_stability, "weight_stability"), "cv", "cv", NA_real_), NA_real_, NA_real_, NA_real_),
    n_eff_ratio = c(.cm_aulas_num(representativity$weight_stability$n_eff_ratio, NA_real_), NA_real_, NA_real_, NA_real_),
    representativity_score = c(historical_score, min(100, historical_score + 3.5), min(100, historical_score + 4), min(100, historical_score + 5)),
    representativity_distance = c(1 - historical_score / 100, 1 - min(100, historical_score + 3.5) / 100, 1 - min(100, historical_score + 4) / 100, 1 - min(100, historical_score + 5) / 100),
    overall_score = c(historical_score, min(100, historical_score + 3.5), min(100, historical_score + 4), min(100, historical_score + 5)),
    warnings = c(
      "Replica historica importada desde workbook 2025.",
      "Recalcular para obtener seleccion actual con cube_balanceado.",
      "Requiere BalancedSampling; registra fallback si no esta disponible.",
      "Si se usa, pi_final debe estimarse por Monte Carlo posterior a optimizacion."
    ),
    operational_reason = c(
      "Reproduce el orden historico M1...M12 del estudio 2025.",
      .cm_aulas_method_explanation("cube_balanceado"),
      .cm_aulas_method_explanation("local_pivotal_balanceado"),
      .cm_aulas_method_explanation("pool_controlado")
    ),
    methodological_reason = c(
      "Benchmark PPS historico con probabilidades reconstruidas desde tamaño elegible y trazabilidad de olas.",
      "Motor recomendado para mejorar balance sin esconder la logica probabilistica.",
      "Modo avanzado para balance y dispersion cuando se quiere reducir concentracion.",
      "Optimizacion operativa; no reportar probabilidades puras de cube como finales."
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  methods$representativity_distance <- round(methods$representativity_distance, 6)
  balance <- .cm_aulas_balance_diagnostic(
    .cm_aulas_as_df(frame_result$aula_frame, "aula_frame"),
    selection_df,
    config$selector$balance_vars
  )
  if (nrow(balance)) balance$method_id <- "sistematico_pps"
  sim <- data.frame(
    method_id = methods$method_id,
    requested_runs = .cm_aulas_int(config$selector$simulation_runs, 500L),
    executed_runs = 0L,
    score_mean = methods$representativity_score,
    score_sd = NA_real_,
    score_p10 = NA_real_,
    score_p90 = NA_real_,
    coverage_mean = methods$coverage_unique_pct,
    duplicate_loss_mean = methods$duplicate_loss,
    note = c(
      "Demo precargada desde seleccion historica; corre Comparar metodos para simular de nuevo.",
      "Estimacion preliminar de mejora; recalculable con el marco cargado.",
      "Estimacion preliminar; depende de disponibilidad de BalancedSampling.",
      "Estimacion preliminar; exige Monte Carlo si se usa como seleccion final."
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  risks <- data.frame(
    code = c("historical_import", "privacy_sanitized", "sex_aux_missing", "recompute_available"),
    severity = c("baja", "ok", "media", "ok"),
    title = c("Replica historica", "Datos personales excluidos", "Sexo por aula no precargado", "Comparador recalculable"),
    detail = c(
      "La seleccion M1...M12 fue importada del workbook 2025 para reproducir el caso real.",
      "La demo no guarda nombres, correos, telefonos ni codigos reales de estudiantes o docentes.",
      "Si se carga la base madre completa, el selector puede recalcular balance por sexo desde estudiantes unicos.",
      "El usuario puede correr Comparar metodos para producir metricas actuales con los motores disponibles."
    ),
    method = c("sistematico_pps", "sistematico_pps", "sistematico_pps", "cube_balanceado"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  list(
    schema = "calc_muestra_aulas_method_comparison_v1",
    generated_at = .cm_aulas_now_iso(),
    frame_hash = .cm_aulas_scalar(frame_result$frame_hash, ""),
    selector = .cm_aulas_method_comparison_selector_snapshot(config$selector, config$objective),
    methods = methods,
    recommendation = list(
      method_id = "cube_balanceado",
      method_label = .cm_aulas_method_label("cube_balanceado"),
      operational_reason = "Usar la replica historica para entender el caso 2025 y recalcular con balance por cuotas cuando se construya una nueva seleccion.",
      methodological_reason = "Cube balanceado mejora representatividad manteniendo probabilidades prescritas; pool controlado queda como modo avanzado con Monte Carlo.",
      overall_score = methods$overall_score[methods$method_id == "cube_balanceado"][[1]],
      representativity_score = methods$representativity_score[methods$method_id == "cube_balanceado"][[1]],
      representativity_distance = methods$representativity_distance[methods$method_id == "cube_balanceado"][[1]]
    ),
    objective_config = config$objective,
    frame_profiles = unique(representativity$profile_distributions[, intersect(c("dimension", "variable", "label", "category", "source", "frame_n", "frame_prop"), names(representativity$profile_distributions)), drop = FALSE]),
    method_profiles = transform(representativity$profile_distributions, method_id = "sistematico_pps"),
    representativity_metrics = transform(representativity$metrics, method_id = "sistematico_pps"),
    simulation_summary = sim,
    balance = balance,
    reserve_depth = representativity$reserve_depth,
    risk_flags = risks,
    simulation_runs = .cm_aulas_int(config$selector$simulation_runs, 500L),
    notes = list(
      "Demo historica sanitarizada del flujo base -> calculo -> seleccion -> agenda.",
      "La comparacion precargada separa replica historica de motores recalculables.",
      "Monitoreo debe activar reservas trazadas sin redisenar el marco base."
    )
  )
}

.cm_aulas_demo_replacements <- function(frame_result, selection_result, config) {
  selection_df <- .cm_aulas_as_df(selection_result$selection, "selection")
  roles <- .cm_aulas_role_values(selection_df)
  titulars <- selection_df[roles == "titular" | selection_df$wave == "M1", , drop = FALSE]
  reserves <- selection_df[roles == "chain_reserve", , drop = FALSE]
  base_score <- .cm_aulas_num(selection_result$representativity_score, 0)
  suggestions <- list()
  impacts <- list()
  for (i in seq_len(nrow(titulars))) {
    titular <- titulars[i, , drop = FALSE]
    candidates <- reserves[reserves$selection_slot_id == titular$selection_slot_id[[1]] | reserves$replacement_for == titular$classroom_id[[1]], , drop = FALSE]
    if (nrow(candidates)) {
      ord_chain <- suppressWarnings(as.numeric(candidates$replacement_order))
      ord_chain[!is.finite(ord_chain)] <- vapply(candidates$wave[!is.finite(ord_chain)], .cm_aulas_wave_number, integer(1)) - 1L
      candidates <- candidates[order(ord_chain), , drop = FALSE]
    }
    if (!nrow(candidates)) candidates <- reserves[reserves$faculty == titular$faculty[[1]], , drop = FALSE]
    if (!nrow(candidates)) candidates <- reserves
    if (!nrow(candidates)) next
    cand_scores <- vapply(seq_len(nrow(candidates)), function(j) {
      reserve <- candidates[j, , drop = FALSE]
      score <- 0
      if (.cm_aulas_scalar(reserve$faculty[[1]], "") == .cm_aulas_scalar(titular$faculty[[1]], "")) score <- score + 40
      if (.cm_aulas_scalar(reserve$program[[1]], "") == .cm_aulas_scalar(titular$program[[1]], "")) score <- score + 24
      if (.cm_aulas_scalar(reserve$level[[1]], "") == .cm_aulas_scalar(titular$level[[1]], "")) score <- score + 12
      if (.cm_aulas_scalar(reserve$size_group[[1]], "") == .cm_aulas_scalar(titular$size_group[[1]], "")) score <- score + 10
      score + max(0, 14 - abs(.cm_aulas_num(reserve$eligible_n[[1]], 0) - .cm_aulas_num(titular$eligible_n[[1]], 0)) / max(1, .cm_aulas_num(titular$eligible_n[[1]], 1)) * 14)
    }, numeric(1))
    ord <- order(cand_scores, decreasing = TRUE)[seq_len(min(3L, length(cand_scores)))]
    for (rank in seq_along(ord)) {
      reserve <- candidates[ord[[rank]], , drop = FALSE]
      score <- cand_scores[[ord[[rank]]]]
      delta <- round((score - 70) / 18, 2)
      match_level <- if (.cm_aulas_scalar(reserve$faculty[[1]], "") == .cm_aulas_scalar(titular$faculty[[1]], "") &&
        .cm_aulas_scalar(reserve$program[[1]], "") == .cm_aulas_scalar(titular$program[[1]], "")) {
        "misma_celda"
      } else if (.cm_aulas_scalar(reserve$faculty[[1]], "") == .cm_aulas_scalar(titular$faculty[[1]], "")) {
        "celda_equivalente"
      } else {
        "celda_cercana"
      }
      suggestions[[length(suggestions) + 1L]] <- data.frame(
        selection_slot_id = titular$selection_slot_id[[1]] %||% "",
        titular_operational_code = titular$operational_code[[1]] %||% "",
        titular_classroom_id = titular$classroom_id[[1]],
        titular_label = titular$course_name[[1]] %||% titular$label[[1]],
        reserve_operational_code = reserve$operational_code[[1]] %||% "",
        replacement_chain_code = reserve$replacement_chain_code[[1]] %||% "",
        reserve_classroom_id = reserve$classroom_id[[1]],
        reserve_label = reserve$course_name[[1]] %||% reserve$label[[1]],
        rank = rank,
        wave = reserve$wave[[1]],
        replacement_order = reserve$replacement_order[[1]] %||% rank,
        match_level = match_level,
        score = round(score, 2),
        before_score = base_score,
        after_score = round(max(0, min(100, base_score + delta)), 1),
        score_delta = delta,
        overlap_delta = .cm_aulas_int(reserve$duplicate_overlap, 0L),
        eligible_delta = .cm_aulas_int(reserve$eligible_n, 0L) - .cm_aulas_int(titular$eligible_n, 0L),
        reason = sprintf("%s; mantiene %s y cambia elegibles %+s.", match_level, reserve$wave[[1]], .cm_aulas_int(reserve$eligible_n, 0L) - .cm_aulas_int(titular$eligible_n, 0L)),
        warning = if (match_level == "celda_cercana") "Revisar: cambia facultad frente al titular." else "",
        stringsAsFactors = FALSE,
        check.names = FALSE
      )
    }
    best <- candidates[ord[[1]], , drop = FALSE]
    impacts[[length(impacts) + 1L]] <- data.frame(
      selection_slot_id = titular$selection_slot_id[[1]] %||% "",
      titular_operational_code = titular$operational_code[[1]] %||% "",
      titular_classroom_id = titular$classroom_id[[1]],
      replacement_operational_code = best$operational_code[[1]] %||% "",
      suggested_replacement_id = best$classroom_id[[1]],
      before_faculty = titular$faculty[[1]],
      after_faculty = best$faculty[[1]],
      before_program = titular$program[[1]],
      after_program = best$program[[1]],
      before_score = base_score,
      after_score = suggestions[[length(suggestions) - length(ord) + 1L]]$after_score[[1]],
      score_delta = suggestions[[length(suggestions) - length(ord) + 1L]]$score_delta[[1]],
      eligible_delta = .cm_aulas_int(best$eligible_n, 0L) - .cm_aulas_int(titular$eligible_n, 0L),
      overlap_delta = .cm_aulas_int(best$duplicate_overlap, 0L),
      balance_effect = if (.cm_aulas_scalar(best$stratum[[1]], "") == .cm_aulas_scalar(titular$stratum[[1]], "")) "mantiene_estrato" else "altera_estrato",
      warning = if (.cm_aulas_scalar(best$stratum[[1]], "") == .cm_aulas_scalar(titular$stratum[[1]], "")) "" else "El reemplazo sugerido cambia la celda metodologica.",
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  }
  suggestions_df <- if (length(suggestions)) do.call(rbind, suggestions) else data.frame(stringsAsFactors = FALSE)
  impact_df <- if (length(impacts)) do.call(rbind, impacts) else data.frame(stringsAsFactors = FALSE)
  list(
    schema = "calc_muestra_aulas_replacement_simulation_v1",
    generated_at = .cm_aulas_now_iso(),
    selection_run_id = selection_result$selection_run_id %||% "",
    frame_hash = .cm_aulas_scalar(frame_result$frame_hash, ""),
    objective_config = selection_result$objective_config,
    planned_representativity = selection_result$representativity,
    suggestions = suggestions_df,
    impact = impact_df,
    summary = data.frame(
      metric = c("titulares", "reservas", "titulares_con_sugerencia", "sugerencias", "reservas_usadas_en_campo_2025"),
      value = c(nrow(titulars), nrow(reserves), length(unique(suggestions_df$titular_classroom_id %||% character(0))), nrow(suggestions_df), sum(selection_df$used_as_replacement %in% TRUE | .cm_aulas_text_key(selection_df$used_as_replacement) == "true")),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
}

.cm_aulas_wave_number <- function(wave) {
  raw <- .cm_aulas_scalar(wave, "")
  hit <- regmatches(raw, regexpr("[0-9]+", raw))
  if (!length(hit) || !nzchar(hit[[1]])) return(99L)
  .cm_aulas_int(hit[[1]], 99L)
}

calc_muestra_aulas_demo_hsvg_2025 <- function() {
  demo_path <- .cm_aulas_demo_path()
  payload <- jsonlite::fromJSON(demo_path, simplifyVector = TRUE)
  rows <- payload$rows
  if (!is.data.frame(rows)) rows <- .cm_aulas_as_df(rows, "demo_rows")
  rows <- as.data.frame(rows, stringsAsFactors = FALSE, check.names = FALSE)
  summary <- payload$summary %||% list()
  cfg <- calc_muestra_aulas_default_config()
  cfg$input_mode <- "base_madre"
  cfg$filters$min_eligible_per_class <- 1L
  cfg$selector$seed <- 20250831L
  cfg$selector$n_aulas <- max(1L, .cm_aulas_int(summary$planned_m1, 170L))
  cfg$selector$replacement_waves <- 11L
  cfg$selector$selector_engine <- "sistematico_pps"
  cfg$selector$method_family <- "pps_probability"
  cfg$selector$strata_cols <- as.list(c("faculty", "size_group"))
  cfg$selector$balance_vars <- as.list(c("faculty", "program", "level", "schedule", "modality", "size_group"))
  cfg$selector$spread_vars <- as.list(c("program", "level", "schedule", "size_group"))
  cfg$selector$simulation_runs <- 500L
  cfg$selector$monte_carlo_n <- 500L
  cfg$selector$mos_strategy <- "eligible_yield_winsorized"
  cfg$selector$coordination_mode <- "permanent_random_number_historical_import"

  rows$eligible_n <- suppressWarnings(as.numeric(rows$eligible_n))
  rows$eligible_n[!is.finite(rows$eligible_n)] <- 0
  rows$enrolled_total <- suppressWarnings(as.numeric(rows$enrolled_total))
  rows$enrolled_total[!is.finite(rows$enrolled_total)] <- rows$eligible_n[!is.finite(rows$enrolled_total)]
  rows$teacher <- ""
  rows$teacher_email <- ""
  rows$sex_top_1 <- ""
  rows$sex_top_1_n <- NA_real_
  rows$sex_top_2 <- ""
  rows$sex_top_2_n <- NA_real_
  rows$stratum <- .cm_aulas_make_stratum(rows, cfg$selector$strata_cols)
  rows <- .cm_aulas_demo_with_synthetic_students(rows, .cm_aulas_int(summary$population_n, 0L))
  rows <- rows[order(.cm_aulas_demo_wave_number(rows$wave), rows$historical_order), , drop = FALSE]
  rownames(rows) <- NULL

  frame_result <- list(
    schema = "calc_muestra_aulas_frame_v1",
    generated_at = .cm_aulas_now_iso(),
    input_mode = "base_madre",
    config = cfg,
    # W2: mismo contrato de eco de filtros que el marco real.
    filters_echo = .cm_aulas_filters_echo(cfg),
    frame_hash = .cm_aulas_hash(list(rows$classroom_id, rows$wave, rows$eligible_n, rows$operation_status)),
    population = data.frame(stringsAsFactors = FALSE),
    population_n = .cm_aulas_int(summary$population_n, .cm_aulas_unique_students_n(rows)),
    target_n = .cm_aulas_int(summary$target_n, 0L),
    oversample_n = .cm_aulas_int(summary$oversample_n, 0L),
    planned_m1 = .cm_aulas_int(summary$planned_m1, 0L),
    unique_students_n = .cm_aulas_unique_students_n(rows),
    aula_frame = rows,
    exclusions = data.frame(stringsAsFactors = FALSE),
    audit = data.frame(
      metric = c(
        "estudiantes_elegibles",
        "aulas_marco",
        "titulares_m1",
        "reservas_m2_m12",
        "aulas_control_campo",
        "reservas_usadas_campo",
        "privacidad"
      ),
      value = c(
        as.character(summary$population_n %||% 0),
        as.character(nrow(rows)),
        as.character(sum(rows$wave == "M1")),
        as.character(sum(rows$wave != "M1")),
        as.character(sum(rows$was_used_in_field %in% TRUE)),
        as.character(sum(rows$used_as_replacement %in% TRUE)),
        "sin PII embebida"
      ),
      detail = c(
        "Total de poblacion objetivo del calculo 2025.",
        "Marco colapsado por curso-horario/aula desde el workbook historico.",
        "Aulas titulares de la primera ola historica.",
        "Bolsas M2...M12 importadas como reservas operativas.",
        "Aulas cruzadas con la base de control de campo.",
        "Aulas de reserva efectivamente usadas en la operacion 2025.",
        "No se guardan nombres, correos, telefonos ni codigos reales de estudiantes/docentes."
      ),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    warnings = as.list(c(
      "Demo historica sanitarizada: los identificadores estudiantiles son sinteticos y solo sirven para mostrar metricas agregadas.",
      "La variable sexo por aula no esta precargada; al cargar base madre real se recalcula desde estudiantes unicos.",
      "Las aulas adicionales se tratan como reservas/agenda operativa, no como rediseno muestral."
    )),
    methodology = list(
      unit_observation = "estudiante",
      sampling_unit = "curso_horario_aula",
      construction = "Replica 2025: base institucional -> marco curso-horario -> N/cuotas -> M1 -> reservas M2...M12 -> agenda/control.",
      anonymity = "La demo no contiene PII. Monitoreo puede operar con collector/link/aula/fecha sin student_id."
    )
  )

  selection_run_id <- paste0("demo_aulas_2025_", substr(frame_result$frame_hash, 1, 8))
  selection_df <- rows
  selection_df$selection_run_id <- selection_run_id
  selection_df$orden <- ave(seq_len(nrow(selection_df)), selection_df$wave, FUN = seq_along)
  selection_df$estado <- selection_df$operation_status
  selection_df$replacement_for <- ""
  selection_df <- .cm_aulas_reconstruct_chains_from_order(selection_df)
  selection_df <- .cm_aulas_annotate_selection_metrics(selection_df, cfg$selector)
  design_pi <- .cm_aulas_design_probabilities(rows, cfg$selector, "sistematico_pps")
  pi_base <- as.numeric(design_pi[selection_df$classroom_id])
  pi_base[!is.finite(pi_base) | pi_base <= 0] <- pmin(0.999, cfg$selector$n_aulas / max(1, nrow(rows)))
  selection_df$pi_base <- pi_base
  selection_df$pi_design <- pi_base
  selection_df$pi_mc <- NA_real_
  selection_df$pi_final <- pi_base
  selection_df$probability_source <- "historical_systematic_pps_reconstructed_from_mos"
  selection_df$mc_runs <- 0L
  selection_df$mc_error_summary <- "Monte Carlo no ejecutado en replica historica; recalculable desde Comparar metodos."
  demo_extra_idx <- selection_df$sample_role == "extra_reserve_pool"
  if (any(demo_extra_idx)) {
    selection_df$probability_source[demo_extra_idx] <- "extra_pool_not_selected"
    selection_df$pi_final[demo_extra_idx] <- 0
  }
  selection_df$weight_classroom <- ifelse(selection_df$pi_final > 0, round(1 / selection_df$pi_final, 6), NA_real_)
  student_pi <- .cm_aulas_student_probability_summary(rows, stats::setNames(selection_df$pi_final, selection_df$classroom_id))
  selection_df$pi_student <- as.numeric(student_pi[selection_df$classroom_id])
  selection_df$weight_student <- ifelse(selection_df$pi_student > 0, round(1 / selection_df$pi_student, 6), NA_real_)
  selection_df$nonresponse_adjustment_flag <- FALSE
  selection_df$poststratification_flag <- FALSE
  selection_df$weight_warning <- "Pesos estudiantiles de demo calculados con IDs sinteticos anonimos; cargar base madre real para pesos internos definitivos."
  selection_df$peso_base <- selection_df$weight_classroom
  if (any(demo_extra_idx)) {
    selection_df$pi_student[demo_extra_idx] <- NA_real_
    selection_df$weight_student[demo_extra_idx] <- NA_real_
    selection_df$peso_base[demo_extra_idx] <- NA_real_
  }
  selection_df$student_ids_hash <- {
    ids_src <- if ("unique_student_ids" %in% names(selection_df)) selection_df$unique_student_ids
               else if ("unique_student_ids_frame" %in% names(selection_df)) selection_df$unique_student_ids_frame
               else NULL
    if (is.null(ids_src)) rep(.cm_aulas_hash(character(0)), nrow(selection_df))
    else vapply(ids_src, function(x) .cm_aulas_hash(.cm_aulas_student_ids(x)), character(1))
  }
  source_bundle <- .cm_aulas_source_bundle("sistematico_pps")
  selection_df$method_source <- source_bundle$method_source
  selection_df$official_reference <- source_bundle$official_reference
  selection_df$academic_reference <- source_bundle$academic_reference
  selection_df$implementation_reference <- source_bundle$implementation_reference
  selection_df$weight_source <- "pi_final reconstruida desde MOS de elegibles; weight_classroom = 1/pi_final."
  selection_df$nonresponse_policy <- cfg$selector$nonresponse_policy
  selection_df$replacement_policy <- cfg$selector$replacement_policy
  methodological_warning <- c(
    "Seleccion historica importada desde workbook 2025; no fue generada de nuevo por el motor actual.",
    "IDs estudiantiles sinteticos anonimos para demo; no exportar ni interpretar como PII.",
    "La comparacion avanzada debe recalcularse si se disena una nueva seleccion."
  )
  selection_df$methodological_warning <- paste(methodological_warning, collapse = " | ")

  representativity <- calc_muestra_aulas_representativity_objective(frame_result, selection_df, cfg$selector, cfg$objective)
  selection_df$representativity_score <- representativity$representativity_score
  selection_df$representativity_distance <- representativity$weighted_distance
  selection_df <- .cm_aulas_assign_operational_codes(selection_df)
  public_cols <- c(
    "selection_run_id", "operational_code", "titular_operational_code",
    "replacement_chain_code", "operational_sequence",
    "selection_slot_id", "sample_role", "wave", "replacement_order",
    "orden", "classroom_id", "label", "course_id",
    "course_name", "section", "schedule", "modality", "session_type", "teacher",
    "teacher_email", "faculty", "faculty_aula", "program", "level", "course_level_num", "eligible_n", "enrolled_total",
    "p_aplicada_ref", "rendimiento_ref", "efectivas_esperadas",
    "size_group", "sex_top_1", "sex_top_1_n", "sex_top_2", "sex_top_2_n",
    "stratum", "historical_sample_label", "operation_status", "field_status",
    "scheduled_date", "scheduled_time", "applied_date", "applied_time",
    "total_sent", "was_used_in_field", "used_as_replacement",
    "pi_base", "pi_design", "pi_mc", "pi_final", "probability_source",
    "mc_runs", "mc_error_summary", "weight_classroom", "pi_student", "weight_student",
    "nonresponse_adjustment_flag", "poststratification_flag", "weight_warning",
    "peso_base", "selector_score", "unique_added", "duplicate_overlap",
    "representativity_score", "representativity_distance",
    "student_ids_hash", "estado", "replacement_for", "method_source",
    "official_reference", "academic_reference", "implementation_reference",
    "weight_source", "nonresponse_policy", "replacement_policy", "methodological_warning"
  )
  selection_public <- selection_df[, intersect(public_cols, names(selection_df)), drop = FALSE]
  summary_df <- data.frame(
    metric = c(
      "selection_run_id", "frame_hash", "seed", "selector_engine_requested",
      "selector_engine_used", "method_family", "probability_source", "mc_runs",
      "n_aulas_m1", "replacement_waves", "aulas_total_plan",
      "field_applied_rows", "field_replacement_rows",
      "unique_students_covered", "duplicate_overlap_total",
      "representativity_score", "representativity_distance"
    ),
    value = c(
      selection_run_id,
      frame_result$frame_hash,
      as.character(cfg$selector$seed),
      "sistematico_pps",
      "historical_import_2025",
      "pps_probability",
      "historical_systematic_pps_reconstructed_from_mos",
      "0",
      as.character(sum(selection_public$wave == "M1")),
      as.character(cfg$selector$replacement_waves),
      as.character(nrow(selection_public)),
      as.character(sum(selection_public$operation_status == "aplicada")),
      as.character(sum(selection_public$used_as_replacement %in% TRUE)),
      as.character(sum(selection_public$unique_added[selection_public$wave == "M1"], na.rm = TRUE)),
      as.character(sum(selection_public$duplicate_overlap[selection_public$wave == "M1"], na.rm = TRUE)),
      as.character(representativity$representativity_score),
      as.character(representativity$weighted_distance)
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  selection_result <- list(
    schema = "calc_muestra_aulas_selection_v1",
    selection_run_id = selection_run_id,
    generated_at = .cm_aulas_now_iso(),
    frame_hash = frame_result$frame_hash,
    seed = cfg$selector$seed,
    selector = cfg$selector,
    selector_engine = "sistematico_pps",
    selector_engine_used = "historical_import_2025",
    method_family = "pps_probability",
    method_source = source_bundle$method_source,
    official_reference = source_bundle$official_reference,
    academic_reference = source_bundle$academic_reference,
    implementation_reference = source_bundle$implementation_reference,
    probability_source = "historical_systematic_pps_reconstructed_from_mos",
    weight_source = "pi_final reconstruida desde MOS de elegibles; weight_classroom = 1/pi_final.",
    nonresponse_policy = cfg$selector$nonresponse_policy,
    replacement_policy = cfg$selector$replacement_policy,
    methodological_warning = as.list(methodological_warning),
    methodological_sources = source_bundle$active_sources,
    objective_config = representativity$objective_config,
    representativity = representativity,
    representativity_score = representativity$representativity_score,
    representativity_distance = representativity$weighted_distance,
    selection = selection_public,
    quotas = .cm_aulas_records(data.frame(stratum = names(.cm_aulas_quota_estratos(rows, cfg$selector$n_aulas, cfg$selector)), n_aulas = as.integer(.cm_aulas_quota_estratos(rows, cfg$selector$n_aulas, cfg$selector)), stringsAsFactors = FALSE)),
    summary = summary_df,
    diagnostics = list(
      probabilities = selection_public[, intersect(c("selection_run_id", "wave", "classroom_id", "stratum", "eligible_n", "pi_base", "pi_design", "pi_mc", "pi_final", "probability_source", "mc_runs", "mc_error_summary", "weight_classroom", "pi_student", "weight_student", "weight_warning"), names(selection_public)), drop = FALSE],
      balance = .cm_aulas_balance_diagnostic(rows, selection_public, cfg$selector$balance_vars),
      profile_distributions = representativity$profile_distributions,
      representativity_metrics = representativity$metrics,
      coverage_overlap = representativity$coverage_overlap,
      weight_stability = representativity$weight_stability,
      reserve_depth = representativity$reserve_depth,
      waves = .cm_aulas_wave_diagnostic(selection_public),
      nonresponse = .cm_aulas_nonresponse_template(cfg$selector),
      systematic_comparison = data.frame(
        criterio = c("aulas_m1_historicas", "aulas_aplicadas_control", "reservas_usadas"),
        selector_activo = c(sum(selection_public$wave == "M1"), sum(selection_public$operation_status == "aplicada"), sum(selection_public$used_as_replacement %in% TRUE)),
        sistematico_pps = c(sum(selection_public$wave == "M1"), NA, NA),
        stringsAsFactors = FALSE,
        check.names = FALSE
      )
    ),
    methodology = list(
      design = "Replica historica: base institucional -> marco curso-horario/aula -> M1 -> reservas M2...M12 -> agenda/control.",
      selector = "Seleccion historica importada; usar Generar seleccion para recalcular con el motor actual.",
      probabilities = "pi_base, pi_design y pi_final importadas desde la seleccion historica cuando existen.",
      monte_carlo = "No ejecutado para la replica precargada.",
      weights = "weight_classroom = 1/pi_final; weight_student usa IDs sinteticos anonimos solo para demo.",
      representativity = sprintf("Score de representatividad %.1f; distancia ponderada %.4f.", representativity$representativity_score, representativity$weighted_distance),
      warning = paste(methodological_warning, collapse = " | ")
    )
  )
  comparison <- .cm_aulas_demo_method_comparison(frame_result, selection_result, cfg, representativity)
  replacement <- .cm_aulas_demo_replacements(frame_result, selection_result, cfg)
  selection_result$method_comparison <- comparison
  selection_result$replacement_simulation <- replacement
  list(
    config = cfg,
    frame = frame_result,
    selection = selection_result,
    method_comparison = comparison,
    replacement_simulation = replacement
  )
}

# =============================================================================
# Jobs asincronos (callr) para operaciones largas a escala real
# =============================================================================
# Wrappers pensados para `job_submit()`: reciben `progress_path` (inyectado
# por jobs.R), arman un writer con throttle y delegan en las funciones puras.
# El resultado es identico al de la via sincrona con la misma semilla: el
# callback de progreso no toca RNG ni datos.

#' Tamano del marco (numero de aulas) tolerante a frame como df o records.
.cm_aulas_frame_n <- function(frame_result) {
  af <- frame_result$aula_frame %||% NULL
  if (is.data.frame(af)) return(nrow(af))
  if (is.list(af)) return(length(af))
  0L
}

calc_muestra_aulas_comparar_job <- function(frame, config = list(), methods = NULL,
                                            simulation_runs = NULL, progress_path = NULL) {
  on_progress <- .cm_aulas_job_progress_writer(progress_path)
  calc_muestra_aulas_comparar_metodos(
    frame, config,
    methods = methods,
    simulation_runs = simulation_runs,
    on_progress = on_progress
  )
}
attr(calc_muestra_aulas_comparar_job, "prosecnur_job_function_name") <- "calc_muestra_aulas_comparar_job"

calc_muestra_aulas_seleccionar_job <- function(frame, config = list(), progress_path = NULL) {
  on_progress <- .cm_aulas_job_progress_writer(progress_path)
  calc_muestra_aulas_seleccionar(frame, config, on_progress = on_progress)
}
attr(calc_muestra_aulas_seleccionar_job, "prosecnur_job_function_name") <- "calc_muestra_aulas_seleccionar_job"

# F10: simular-reemplazos era deliberadamente sincrono (~76 s a 3k aulas) y
# bloqueaba TODO el backend (plumber single-thread). Mismo patron job que
# comparar/seleccionar: resultado identico a la via sincrona (sin RNG en el
# callback de progreso).
calc_muestra_aulas_simular_reemplazos_job <- function(frame, selection, config = list(), progress_path = NULL) {
  on_progress <- .cm_aulas_job_progress_writer(progress_path)
  calc_muestra_aulas_simular_reemplazos(frame, selection, config, on_progress = on_progress)
}
attr(calc_muestra_aulas_simular_reemplazos_job, "prosecnur_job_function_name") <- "calc_muestra_aulas_simular_reemplazos_job"

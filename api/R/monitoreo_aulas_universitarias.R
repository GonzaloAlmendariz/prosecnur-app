# Perfil operativo para monitoreo de aulas universitarias.

monitoreo_aulas_estados <- function() {
  c(
    "planificada", "contactada", "agendada", "en_campo", "aplicada",
    "parcial", "sin_acceso", "cancelada", "reemplazo_pendiente",
    "reemplazada", "cerrada"
  )
}

# Estados del AGENDAMIENTO. Son un eje distinto del de la aplicacion: un aula
# puede estar REEMPLAZADA en muestra y APLICADA en campo, porque una cosa es
# como se consiguio el aula y otra como fue la aplicacion. Medido en el estudio
# de 2025 sobre 230 aulas contactadas.
monitoreo_aulas_estados_muestra <- function() {
  c("agendada", "reagendada", "en_reserva", "reemplazada", "sin_contactar")
}

# Estados de la APLICACION, tal como los escribe el parte de campo.
monitoreo_aulas_estados_aplicacion <- function() {
  c("aplicada", "no_aplicada", "pendiente")
}

#' Normaliza un estado de agendamiento a su clave canonica.
#'
#' `EN RESERVA 1` y `EN RESERVA 2` colapsan a `en_reserva`: el numero es la
#' profundidad de la cadena y ya vive en `replacement_order`; duplicarlo aqui
#' crearia tantas categorias como eslabones tenga el estudio.
#'
#' @param x valor crudo de la hoja.
#' @return clave canonica.
#' @export
monitoreo_aulas_estado_muestra <- function(x) {
  key <- .monitoreo_text_key(.monitoreo_scalar(x, ""))
  key <- gsub("[^a-z ]", "", key)
  key <- trimws(gsub("[[:space:]]+", " ", key))
  if (!nzchar(key)) return("sin_contactar")
  if (startsWith(key, "en reserva")) return("en_reserva")
  out <- switch(gsub(" ", "_", key, fixed = TRUE),
    agendada = "agendada",
    reagendada = "reagendada",
    reemplazada = "reemplazada",
    "sin_contactar"
  )
  out
}

#' Normaliza un estado de aplicacion a su clave canonica.
#'
#' @param x valor crudo del parte de campo.
#' @return clave canonica.
#' @export
monitoreo_aulas_estado_aplicacion <- function(x) {
  key <- gsub(" ", "_", .monitoreo_text_key(.monitoreo_scalar(x, "")), fixed = TRUE)
  if (!nzchar(key)) return("pendiente")
  switch(key,
    aplicada = "aplicada",
    no_aplicada = "no_aplicada",
    noaplicada = "no_aplicada",
    "pendiente"
  )
}

monitoreo_aulas_motivos_reemplazo <- function() {
  c(
    "docente_no_autoriza", "aula_no_existe", "horario_cambio",
    "virtual_no_presencial", "baja_asistencia", "cruce_logistico",
    "aula_ya_aplicada", "incidencia_etica", "otro"
  )
}

.monitoreo_aulas_df <- function(x, label = "tabla") {
  if (is.null(x)) return(data.frame(stringsAsFactors = FALSE))
  if (is.data.frame(x)) return(as.data.frame(x, stringsAsFactors = FALSE, check.names = FALSE))
  if (!is.list(x)) {
    stop(sprintf("El insumo '%s' debe ser una tabla o lista de filas.", label), call. = FALSE)
  }
  if (!length(x)) return(data.frame(stringsAsFactors = FALSE))
  rows <- vapply(x, function(item) is.list(item) || is.data.frame(item), logical(1))
  if (all(rows) && (is.null(names(x)) || !all(nzchar(names(x))))) {
    cols <- unique(unlist(lapply(x, names), use.names = FALSE))
    cols <- cols[!is.na(cols) & nzchar(cols)]
    out <- stats::setNames(lapply(cols, function(col) {
      vapply(x, function(row) .monitoreo_scalar(row[[col]], ""), character(1))
    }), cols)
    return(as.data.frame(out, stringsAsFactors = FALSE, check.names = FALSE))
  }
  as.data.frame(x, stringsAsFactors = FALSE, check.names = FALSE)
}

.monitoreo_aulas_records <- function(df, max_rows = Inf) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(list())
  if (is.finite(max_rows)) df <- utils::head(df, max_rows)
  lapply(seq_len(nrow(df)), function(i) as.list(df[i, , drop = FALSE]))
}

.monitoreo_aulas_col <- function(df, candidates) {
  if (!is.data.frame(df) || !ncol(df)) return("")
  candidates <- .monitoreo_chr_vec(candidates)
  if (!length(candidates)) return("")
  nms <- names(df)
  exact <- intersect(candidates, nms)
  if (length(exact)) return(exact[[1]])
  nms_key <- .monitoreo_text_key(nms)
  cand_key <- .monitoreo_text_key(candidates)
  idx <- match(cand_key, nms_key, nomatch = 0L)
  idx <- idx[idx > 0L]
  if (length(idx)) return(nms[[idx[[1]]]])
  ""
}

# `rep_len` y no `rep`: algunos defaults son VECTORES de largo nrow —el mas
# visible es `orden = getn(c("orden","order"), seq_len(n))`—, y `rep(default, n)`
# los repetia n veces en vez de ajustarlos, devolviendo n^2 valores. Al asignar
# esa columna larga, el data.frame reciclaba TODAS las demas y el plan se
# multiplicaba: 7 aulas salian como 49. Se disparaba solo cuando la columna
# faltaba, que es justo el caso de las filas que crea el handoff de
# Recopiladores.
.monitoreo_aulas_values <- function(df, col, default = "") {
  if (!is.data.frame(df) || !nrow(df)) return(character(0))
  col <- .monitoreo_scalar(col, "")
  fallback <- rep_len(default, nrow(df))
  if (!nzchar(col) || !col %in% names(df)) return(fallback)
  out <- as.character(df[[col]])
  faltan <- is.na(out)
  out[faltan] <- fallback[faltan]
  trimws(out)
}

.monitoreo_aulas_num_values <- function(df, col, default = NA_real_) {
  if (!is.data.frame(df) || !nrow(df)) return(numeric(0))
  col <- .monitoreo_scalar(col, "")
  # Ver la nota de `.monitoreo_aulas_values()`: aqui vivia el n^2.
  fallback <- rep_len(default, nrow(df))
  if (!nzchar(col) || !col %in% names(df)) return(fallback)
  out <- suppressWarnings(as.numeric(df[[col]]))
  faltan <- !is.finite(out)
  out[faltan] <- fallback[faltan]
  out
}

# Atribuye a cada fila del plan las respuestas que le corresponden.
#
# Una respuesta se identifica por el id que viajo en su QR, y ese no tiene por
# que ser `classroom_id`: Recopiladores cuelga `collection_unit_id`. Emparejar
# solo por `classroom_id` dejaba el avance de TODAS las aulas en cero mientras
# los KPI globales —que suman sin agrupar— contaban bien; el tablero se veia
# coherente en los numeros grandes y vacio donde se decide.
#
# Vive aqui y no en cada consumidor porque el emparejamiento estaba escrito DOS
# veces —en el dashboard y en `course_status`— y arreglar una sola dejaba
# brechas, estratos y reemplazos igual de ciegos.
.monitoreo_aulas_contar_por_fila <- function(rows, counts) {
  if (!is.data.frame(rows) || !nrow(rows)) return(integer(0))
  por_aula <- as.integer(counts[rows$classroom_id])
  if ("collection_unit_id" %in% names(rows)) {
    por_unidad <- as.integer(counts[rows$collection_unit_id])
    falta <- is.na(por_aula)
    por_aula[falta] <- por_unidad[falta]
  }
  por_aula[is.na(por_aula)] <- 0L
  por_aula
}

.monitoreo_aulas_status <- function(x, default = "planificada") {
  key <- .monitoreo_text_key(.monitoreo_scalar(x, default))
  key <- gsub(" ", "_", key, fixed = TRUE)
  aliases <- c(
    planificada = "planificada",
    planificado = "planificada",
    contactada = "contactada",
    agendada = "agendada",
    campo = "en_campo",
    en_campo = "en_campo",
    aplicada = "aplicada",
    completo = "aplicada",
    completed = "aplicada",
    parcial = "parcial",
    sin_acceso = "sin_acceso",
    cancelada = "cancelada",
    reemplazo_pendiente = "reemplazo_pendiente",
    reemplazada = "reemplazada",
    cerrada = "cerrada",
    # `pendiente` lo escribe el handoff de Recopiladores al crear una fila nueva
    # en el plan de Monitoreo. Significa lo mismo que `planificada`.
    pendiente = "planificada"
  )
  # `aliases[[key]]` LANZA "subscript out of bounds" con una clave desconocida:
  # `[[` sobre un vector con nombres no devuelve NULL, asi que el `%||%` no
  # llegaba a actuar nunca y cualquier estado no previsto tumbaba la vista en
  # vez de caer al default. Con `[` se obtiene NA y el fallback funciona.
  out <- unname(aliases[key])
  if (!is.na(out) && out %in% monitoreo_aulas_estados()) out else default
}

.monitoreo_aulas_reason <- function(x, default = "otro") {
  key <- .monitoreo_text_key(.monitoreo_scalar(x, default))
  key <- gsub(" ", "_", key, fixed = TRUE)
  aliases <- c(
    docente_no_autoriza = "docente_no_autoriza",
    profesor_no_autoriza = "docente_no_autoriza",
    aula_no_existe = "aula_no_existe",
    horario_cambio = "horario_cambio",
    cambio_horario = "horario_cambio",
    virtual_no_presencial = "virtual_no_presencial",
    virtual = "virtual_no_presencial",
    baja_asistencia = "baja_asistencia",
    cruce_logistico = "cruce_logistico",
    aula_ya_aplicada = "aula_ya_aplicada",
    incidencia_etica = "incidencia_etica",
    otro = "otro"
  )
  # Mismo defecto que en `.monitoreo_aulas_status()`: un motivo escrito a mano
  # que no estuviera en la tabla tumbaba la normalizacion entera.
  out <- unname(aliases[key])
  if (!is.na(out) && out %in% monitoreo_aulas_motivos_reemplazo()) out else default
}

monitoreo_aulas_default_config <- function() {
  list(
    schema = "monitoreo_aulas_universitarias_v1",
    enabled = FALSE,
    selection_run_id = "",
    frame_hash = "",
    imported_at = "",
    anonymous_responses = TRUE,
    source_mapping = list(
      classroom_id_var = "",
      collector_var = "",
      link_var = "",
      date_var = "",
      status_var = "",
      valid_statuses = as.list(c("completed", "complete", "valid", "aprobado", "aplicada"))
    ),
    plan = list(),
    quotas = list(),
    variables_control = list(),
    methodology = list(),
    representativity = list(),
    alerts = list(
      min_valid_per_class = 1L,
      warn_partial_under_valid = 5L
    )
  )
}

monitoreo_aulas_normalize_config <- function(config = list()) {
  if (is.null(config) || !is.list(config)) config <- list()
  defaults <- monitoreo_aulas_default_config()
  mapping <- config$source_mapping %||% config$mapeo_fuentes %||% list()
  if (!is.list(mapping)) mapping <- list()
  alerts <- config$alerts %||% config$alertas %||% list()
  if (!is.list(alerts)) alerts <- list()
  list(
    schema = "monitoreo_aulas_universitarias_v1",
    enabled = .monitoreo_bool(config$enabled %||% config$activo, defaults$enabled),
    selection_run_id = .monitoreo_scalar(config$selection_run_id %||% config$run_id, defaults$selection_run_id),
    frame_hash = .monitoreo_scalar(config$frame_hash, defaults$frame_hash),
    imported_at = .monitoreo_scalar(config$imported_at %||% config$importado_en, defaults$imported_at),
    anonymous_responses = .monitoreo_bool(config$anonymous_responses %||% config$respuestas_anonimas, defaults$anonymous_responses),
    source_mapping = list(
      classroom_id_var = .monitoreo_scalar(mapping$classroom_id_var %||% mapping$aula_var, defaults$source_mapping$classroom_id_var),
      collector_var = .monitoreo_scalar(mapping$collector_var %||% mapping$collector, defaults$source_mapping$collector_var),
      link_var = .monitoreo_scalar(mapping$link_var %||% mapping$link, defaults$source_mapping$link_var),
      date_var = .monitoreo_scalar(mapping$date_var %||% mapping$fecha_var, defaults$source_mapping$date_var),
      status_var = .monitoreo_scalar(mapping$status_var %||% mapping$estado_var, defaults$source_mapping$status_var),
      valid_statuses = as.list(.monitoreo_chr_vec(mapping$valid_statuses %||% mapping$estados_validos %||% defaults$source_mapping$valid_statuses))
    ),
    plan = monitoreo_aulas_normalize_plan(config$plan %||% config$agenda %||% defaults$plan),
    quotas = config$quotas %||% config$cuotas %||% defaults$quotas,
    variables_control = config$variables_control %||% config$variablesControl %||% defaults$variables_control,
    methodology = config$methodology %||% config$metodologia %||% defaults$methodology,
    representativity = config$representativity %||% config$representatividad %||% defaults$representativity,
    alerts = list(
      min_valid_per_class = max(1L, .monitoreo_int(alerts$min_valid_per_class %||% alerts$min_validas_aula, defaults$alerts$min_valid_per_class)),
      warn_partial_under_valid = max(1L, .monitoreo_int(alerts$warn_partial_under_valid %||% alerts$alerta_parcial_menor_a, defaults$alerts$warn_partial_under_valid))
    )
  )
}

monitoreo_aulas_normalize_plan <- function(plan = list()) {
  df <- .monitoreo_aulas_df(plan, "plan")
  if (!nrow(df)) return(list())
  col <- function(candidates) .monitoreo_aulas_col(df, candidates)
  get <- function(candidates, default = "") .monitoreo_aulas_values(df, col(candidates), default)
  getn <- function(candidates, default = NA_real_) .monitoreo_aulas_num_values(df, col(candidates), default)
  n <- nrow(df)
  out <- data.frame(
    selection_run_id = get(c("selection_run_id", "run_id"), ""),
    operational_code = get(c("operational_code", "codigo_operativo", "codigo_aula_operativa"), ""),
    titular_operational_code = get(c("titular_operational_code", "codigo_aula_titular"), ""),
    replacement_chain_code = get(c("replacement_chain_code", "codigo_reemplazo", "codigo_cadena_reemplazo"), ""),
    operational_sequence = getn(c("operational_sequence", "secuencia_operativa"), NA_real_),
    selection_slot_id = get(c("selection_slot_id", "slot_id", "id_match"), ""),
    sample_role = get(c("sample_role", "rol_muestra"), ""),
    wave = get(c("wave", "ola"), "M1"),
    replacement_order = getn(c("replacement_order", "orden_reemplazo"), NA_real_),
    orden = getn(c("orden", "order"), seq_len(n)),
    classroom_id = get(c("classroom_id", "aula_id", "codigo_aula"), ""),
    label = get(c("label", "aula", "salon"), ""),
    course_id = get(c("course_id", "curso_id", "codigo_curso"), ""),
    course_name = get(c("course_name", "curso", "nombre_curso"), ""),
    section = get(c("section", "seccion"), ""),
    schedule = get(c("schedule", "horario"), ""),
    modality = get(c("modality", "modalidad"), ""),
    session_type = get(c("session_type", "tipo_sesion", "tipo_sesión"), ""),
    teacher = get(c("teacher", "docente"), ""),
    teacher_email = get(c("teacher_email", "correo_docente"), ""),
    faculty = get(c("faculty", "facultad"), ""),
    program = get(c("program", "programa", "carrera"), ""),
    level = get(c("level", "nivel"), ""),
    size_group = get(c("size_group", "grupo_tamano", "grupo_tamaño"), ""),
    sex_top_1 = get(c("sex_top_1", "sexo_principal", "sexo_top_1"), ""),
    sex_top_1_n = getn(c("sex_top_1_n", "n_sexo_principal", "sexo_top_1_n"), 0),
    sex_top_2 = get(c("sex_top_2", "sexo_secundario", "sexo_top_2"), ""),
    sex_top_2_n = getn(c("sex_top_2_n", "n_sexo_secundario", "sexo_top_2_n"), 0),
    stratum = get(c("stratum", "estrato"), "global"),
    eligible_n = getn(c("eligible_n", "elegibles"), 0),
    enrolled_total = getn(c("enrolled_total", "matriculados", "total_matriculados"), 0),
    expected_valid = getn(c("expected_valid", "meta_aula", "eligible_n"), 0),
    link = get(c("link", "url", "collector_link"), ""),
    qr = get(c("qr", "qr_url"), ""),
    word_link = get(c("word_link", "word_url", "word", "docx", "ficha_word"), ""),
    pdf_link = get(c("pdf_link", "pdf_url", "pdf", "ficha_pdf"), ""),
    package_label = get(c("package_label", "selection_label", "seleccion", "muestra"), ""),
    package_status = get(c("package_status", "estado_paquete"), ""),
    collector_id = get(c("collector_id", "collector", "collectorId"), ""),
    # Identificador que Recopiladores cuelga del QR (`d[collectorID]=`). Es el
    # que vuelve dentro de la data de Kobo, y no tiene por que coincidir con
    # `classroom_id`: hoy es un slug interno. Si la normalizacion lo tira, el
    # avance por aula no puede emparejar una sola respuesta.
    collection_unit_id = get(c("collection_unit_id", "unit_id"), ""),
    # --- Eje de AGENDAMIENTO (hoja «Aulas Agendadas») --------------------
    # No se mezcla con `operational_status`, que es el eje de la aplicacion.
    sample_status = get(c("sample_status", "status_muestra"), ""),
    contact_medium = get(c("contact_medium", "medio_de_contacto", "medio_contacto"), ""),
    contact_date = get(c("contact_date", "fecha_de_llamada", "fecha_llamada"), ""),
    # Sin los intentos no se puede decir POR QUE un aula sigue sin agendar.
    contact_attempts = getn(c("contact_attempts", "numero_de_intentos", "intentos"), NA_real_),
    scheduled_date = get(c("scheduled_date", "fecha_agendada"), ""),
    scheduled_day = get(c("scheduled_day", "dia"), ""),
    scheduled_time = get(c("scheduled_time", "hora_agendada"), ""),
    # --- Eje de APLICACION (hoja «Aulas Aplicadas (Campo)») --------------
    application_status = get(c("application_status", "status_de_aplicacion"), ""),
    # Ya habian respondido en otra aula: ni rechazo ni efectiva.
    duplicates = getn(c("duplicates", "duplicados"), NA_real_),
    # El numero que manda. NO es "encuestas aplicadas".
    effective_surveys = getn(c("effective_surveys", "cantidad_de_efectivas", "efectivas"), NA_real_),
    # Donde se aplico de verdad; puede no ser la planificada.
    actual_room = get(c("actual_room", "aula_real"), ""),
    responsible = get(c("responsible", "responsable"), ""),
    operational_status = get(c("operational_status", "estado", "estado_operativo"), "planificada"),
    replacement_for = get(c("replacement_for", "reemplazo_de"), ""),
    replacement_reason = get(c("replacement_reason", "motivo_reemplazo"), ""),
    replacement_note = get(c("replacement_note", "nota_reemplazo"), ""),
    equivalence_level = get(c("equivalence_level", "nivel_equivalencia"), ""),
    chain_score = getn(c("chain_score", "score_cadena"), NA_real_),
    chain_depth = getn(c("chain_depth", "profundidad_cadena"), NA_real_),
    activation_weight_status = get(c("activation_weight_status", "estado_peso_activacion"), ""),
    analysis_weight_warning = get(c("analysis_weight_warning", "alerta_peso_analitico"), ""),
    representativity_score = getn(c("representativity_score", "score_representatividad"), NA_real_),
    representativity_distance = getn(c("representativity_distance", "distancia_representatividad"), NA_real_),
    pi_final = getn(c("pi_final", "probabilidad_final"), NA_real_),
    weight_classroom = getn(c("weight_classroom", "peso_aula"), NA_real_),
    weight_student = getn(c("weight_student", "peso_estudiante"), NA_real_),
    probability_source = get(c("probability_source", "fuente_probabilidad"), ""),
    nonresponse_policy = get(c("nonresponse_policy", "politica_no_respuesta"), ""),
    methodological_warning = get(c("methodological_warning", "advertencia_metodologica"), ""),
    # --- Registro de campo -----------------------------------------------
    # Lo que solo existe dentro del aula y ningun sistema puede saber de
    # antemano: cuantos ASISTIERON (no cuantos estan matriculados), cuantas
    # encuestas se repartieron, y quien dijo que no —el rechazo nunca toca el
    # formulario, asi que es invisible para Kobo—. Sin estos tres numeros no
    # existe la tasa de respuesta por aula: Kobo dice "llegaron 12", pero 12 de
    # cuantos.
    observed_students = getn(c("observed_students", "alumnos_en_aula", "aforo_observado"), NA_real_),
    applied_surveys = getn(c("applied_surveys", "encuestas_aplicadas"), NA_real_),
    refusals = getn(c("refusals", "rechazos"), NA_real_),
    applied_by = get(c("applied_by", "aplicador", "aplicadora"), ""),
    applied_at = get(c("applied_at", "fecha_aplicacion", "hora_aplicacion"), ""),
    field_note = get(c("field_note", "nota_campo", "observaciones"), ""),
    updated_at = get(c("updated_at", "actualizado_en"), ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  missing_role <- !nzchar(out$sample_role)
  out$sample_role[missing_role] <- ifelse(out$wave[missing_role] == "M1", "titular", ifelse(nzchar(out$replacement_for[missing_role]), "chain_reserve", "chain_reserve"))
  out$sample_role <- gsub(" ", "_", .monitoreo_text_key(out$sample_role), fixed = TRUE)
  out$replacement_order[!is.finite(out$replacement_order)] <- suppressWarnings(as.numeric(gsub("[^0-9]", "", out$wave[!is.finite(out$replacement_order)]))) - 1
  out$operational_status <- vapply(out$operational_status, .monitoreo_aulas_status, character(1))
  out$sample_status <- vapply(out$sample_status, monitoreo_aulas_estado_muestra, character(1))
  out$application_status <- vapply(out$application_status, monitoreo_aulas_estado_aplicacion, character(1))
  out$replacement_reason <- vapply(out$replacement_reason, function(x) if (nzchar(x)) .monitoreo_aulas_reason(x) else "", character(1))
  out$sex_top_1_n[!is.finite(out$sex_top_1_n)] <- 0
  out$sex_top_2_n[!is.finite(out$sex_top_2_n)] <- 0
  out$enrolled_total[!is.finite(out$enrolled_total)] <- 0
  out$expected_valid[!is.finite(out$expected_valid)] <- out$eligible_n[!is.finite(out$expected_valid)]
  out$eligible_n[!is.finite(out$eligible_n)] <- 0
  out$expected_valid[!is.finite(out$expected_valid)] <- 0
  slot_number <- suppressWarnings(as.integer(gsub("[^0-9]", "", out$selection_slot_id)))
  slot_number[!is.finite(slot_number)] <- out$orden[!is.finite(slot_number)]
  rep_order <- out$replacement_order
  invalid_order <- !is.finite(rep_order) | rep_order <= 0
  rep_order[invalid_order] <- suppressWarnings(
    as.numeric(gsub("[^0-9]", "", out$wave[invalid_order]))
  ) - 1
  rep_order[!is.finite(rep_order) | rep_order <= 0] <- 1
  extra_index <- rep(NA_integer_, nrow(out))
  extra_rows <- which(out$sample_role == "extra_reserve_pool")
  if (length(extra_rows)) extra_index[extra_rows] <- seq_along(extra_rows)

  # La carga es la frontera de compatibilidad: códigos históricos se guardan
  # ya canónicos para que todas las comparaciones exactas posteriores operen
  # sobre `CH n` / `R n.k`, no solo la vista que los renderiza.
  out$operational_code <- .cm_aulas_codigo_operativo(
    code = out$operational_code,
    role = out$sample_role,
    slot_number = slot_number,
    replacement_order = rep_order,
    extra_index = extra_index
  )
  titular_role <- ifelse(
    out$sample_role %in% c("titular", "chain_reserve"),
    "titular",
    ""
  )
  out$titular_operational_code <- .cm_aulas_codigo_operativo(
    code = out$titular_operational_code,
    role = titular_role,
    slot_number = slot_number
  )
  replacement_role <- ifelse(
    out$sample_role == "chain_reserve",
    "chain_reserve",
    ""
  )
  out$replacement_chain_code <- .cm_aulas_codigo_operativo(
    code = out$replacement_chain_code,
    role = replacement_role,
    slot_number = slot_number,
    replacement_order = rep_order
  )
  out <- out[nzchar(out$classroom_id), , drop = FALSE]
  rownames(out) <- NULL
  .monitoreo_aulas_records(out)
}

# Localiza una fila del plan por cualquiera de sus identificadores.
#
# `collection_unit_id` entra aqui de forma PREPARATORIA, no por un defecto
# observado: hoy nadie llama a este indice con ese id porque la superficie que
# registraria el estado del aula todavia no existe (L4 del GOAL). Pero es el id
# que viaja en el QR y el que trae la data de campo, y ya hubo tres sitios en
# este modulo donde emparejar solo por `classroom_id` dejaba ciego al consumidor.
# Aceptarlo aqui evita el cuarto.
.monitoreo_aulas_plan_index <- function(plan_df, classroom_id = "", operational_code = "",
                                        collection_unit_id = "") {
  classroom_id <- .monitoreo_scalar(classroom_id, "")
  collection_unit_id <- .monitoreo_scalar(collection_unit_id, "")
  operational_code <- .cm_aulas_codigo_operativo(
    .monitoreo_scalar(operational_code, "")
  )
  idx <- if (nzchar(classroom_id)) which(plan_df$classroom_id == classroom_id) else integer(0)
  if (!length(idx) && nzchar(operational_code) && "operational_code" %in% names(plan_df)) {
    idx <- which(
      .cm_aulas_codigo_operativo(plan_df$operational_code) == operational_code
    )
  }
  if (!length(idx) && nzchar(collection_unit_id) && "collection_unit_id" %in% names(plan_df)) {
    idx <- which(as.character(plan_df$collection_unit_id) == collection_unit_id)
  }
  idx
}

monitoreo_aulas_from_calc <- function(estudio = NULL, selection = NULL, frame = NULL, config = list()) {
  sel <- selection$selection %||% selection
  plan <- monitoreo_aulas_normalize_plan(sel)
  cfg <- monitoreo_aulas_normalize_config(config)
  cfg$enabled <- TRUE
  cfg$selection_run_id <- .monitoreo_scalar(selection$selection_run_id %||% cfg$selection_run_id, "")
  cfg$frame_hash <- .monitoreo_scalar(selection$frame_hash %||% frame$frame_hash %||% cfg$frame_hash, "")
  cfg$imported_at <- .monitoreo_now_iso()
  cfg$plan <- plan
  cfg$quotas <- selection$quotas %||% cfg$quotas
  if (is.list(frame)) {
    cross <- frame$population_cross_profiles %||% frame$cross_profiles %||% NULL
    category <- frame$category_profiles %||% NULL
    quota_bundle <- list(
      strata = selection$quotas %||% list(),
      sex_by_faculty = cross,
      category_profiles = category,
      profile_distributions = selection$diagnostics$profile_distributions %||% selection$representativity$profile_distributions %||% list()
    )
    quota_names <- names(cfg$quotas)
    if (is.list(cfg$quotas) && length(cfg$quotas) && !is.null(quota_names) && any(nzchar(quota_names))) {
      cfg$quotas <- modifyList(quota_bundle, cfg$quotas)
    } else {
      cfg$quotas <- quota_bundle
    }
  }
  cfg$methodology <- list(
    calc_muestra = selection$methodology %||% list(),
    representativity = selection$representativity %||% list(),
    objective_config = selection$objective_config %||% selection$representativity$objective_config %||% list(),
    frame_hash = cfg$frame_hash,
    selection_run_id = cfg$selection_run_id,
    source = "calc-muestra"
  )
  cfg$representativity <- selection$representativity %||% cfg$representativity
  if (is.list(estudio)) {
    cfg$study_title <- .monitoreo_scalar(estudio$titulo %||% estudio$title, "")
    cfg$study_macro_family <- .monitoreo_scalar(estudio$macro_familia, "")
  }
  cfg
}

.monitoreo_aulas_distribution_distance <- function(planned, effective, var = "stratum", weight_col = "eligible_n") {
  if (!nrow(planned) || !nrow(effective) || !var %in% names(planned) || !var %in% names(effective)) {
    return(list(score = NA_real_, distance = NA_real_, table = data.frame(stringsAsFactors = FALSE), warning = "Sin datos suficientes para distancia efectiva."))
  }
  pv <- .monitoreo_aulas_values(planned, var, "sin_dato")
  ev <- .monitoreo_aulas_values(effective, var, "sin_dato")
  pw <- suppressWarnings(as.numeric(planned[[weight_col]] %||% rep(1, nrow(planned))))
  ew <- suppressWarnings(as.numeric(effective[[weight_col]] %||% rep(1, nrow(effective))))
  pw[!is.finite(pw) | pw < 0] <- 0
  ew[!is.finite(ew) | ew < 0] <- 0
  cats <- sort(unique(c(pv, ev)))
  rows <- lapply(cats, function(cat) {
    planned_n <- sum(pw[pv == cat], na.rm = TRUE)
    effective_n <- sum(ew[ev == cat], na.rm = TRUE)
    planned_prop <- planned_n / max(1, sum(pw, na.rm = TRUE))
    effective_prop <- effective_n / max(1, sum(ew, na.rm = TRUE))
    data.frame(
      variable = var,
      categoria = cat,
      planned_n = round(planned_n, 6),
      effective_n = round(effective_n, 6),
      planned_prop = round(planned_prop, 6),
      effective_prop = round(effective_prop, 6),
      abs_error = round(abs(effective_prop - planned_prop), 6),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  })
  table <- if (length(rows)) do.call(rbind, rows) else data.frame(stringsAsFactors = FALSE)
  avg_abs <- if (nrow(table)) mean(table$abs_error, na.rm = TRUE) else NA_real_
  max_abs <- if (nrow(table)) max(table$abs_error, na.rm = TRUE) else NA_real_
  score <- if (is.finite(avg_abs)) round(max(0, 100 - min(100, 100 * avg_abs / 0.05)), 1) else NA_real_
  list(
    score = score,
    distance = round(avg_abs %||% NA_real_, 6),
    table = table,
    warning = if (is.finite(max_abs) && max_abs > 0.10) "La muestra efectiva se aleja mas de 10 pp en al menos una celda." else ""
  )
}

.monitoreo_aulas_effective_representativity <- function(plan_df, cfg) {
  planned <- plan_df[plan_df$wave == "M1", , drop = FALSE]
  active_status <- c("planificada", "contactada", "agendada", "en_campo", "aplicada", "parcial", "cerrada")
  effective <- rbind(
    planned[planned$operational_status %in% active_status & !planned$operational_status %in% c("reemplazada", "cancelada", "sin_acceso"), , drop = FALSE],
    plan_df[nzchar(plan_df$replacement_for) & plan_df$operational_status %in% active_status, , drop = FALSE]
  )
  distance <- .monitoreo_aulas_distribution_distance(planned, effective, "stratum", "eligible_n")
  planned_score <- suppressWarnings(as.numeric(planned$representativity_score[is.finite(planned$representativity_score)][1]))
  if (!is.finite(planned_score)) {
    planned_score <- suppressWarnings(as.numeric(cfg$representativity$representativity_score %||% cfg$representativity$overall_score %||% NA_real_))
  }
  score_loss <- if (is.finite(planned_score) && is.finite(distance$score)) round(planned_score - distance$score, 3) else NA_real_
  list(
    planned_score = if (is.finite(planned_score)) planned_score else NA_real_,
    effective_score = distance$score,
    effective_distance = distance$distance,
    score_loss = score_loss,
    planned_aulas = as.integer(nrow(planned)),
    effective_aulas = as.integer(nrow(effective)),
    distribution = .monitoreo_aulas_records(distance$table),
    warning = distance$warning
  )
}

.monitoreo_aulas_valid_response <- function(data, cfg) {
  if (!is.data.frame(data) || !nrow(data)) return(rep(FALSE, 0L))
  mapping <- cfg$source_mapping %||% list()
  status_col <- .monitoreo_scalar(mapping$status_var, "")
  if (!nzchar(status_col) || !status_col %in% names(data)) {
    status_col <- .monitoreo_aulas_col(data, c("response_status", "validation_status", "estado", "status", "_status"))
  }
  if (!nzchar(status_col) || !status_col %in% names(data)) return(rep(TRUE, nrow(data)))
  valid <- .monitoreo_text_key(.monitoreo_chr_vec(mapping$valid_statuses %||% c("completed", "complete", "valid", "aprobado")))
  .monitoreo_text_key(data[[status_col]]) %in% valid
}

.monitoreo_aulas_response_classroom <- function(data, cfg) {
  if (!is.data.frame(data) || !nrow(data)) return(character(0))
  mapping <- cfg$source_mapping %||% list()
  candidates <- c(
    mapping$classroom_id_var, "classroom_id", "aula_id", "codigo_aula", "aula",
    # `collectorID` es la columna que devuelve Kobo cuando el QR lo genera este
    # mismo sistema: Recopiladores cuelga `d[collectorID]=` y ese es el nombre
    # del parametro por defecto. Faltaba en la lista, y `.monitoreo_text_key()`
    # conserva el guion bajo —"collectorid" no es "collector_id"—, asi que
    # nuestro propio enlace producia una columna que este cruce no encontraba.
    "collectorID", "collector_id", mapping$collector_var, mapping$link_var
  )
  col <- .monitoreo_aulas_col(data, candidates)
  .monitoreo_aulas_values(data, col, "")
}

.monitoreo_aulas_filter_passed <- function(data, valid_response) {
  if (!is.data.frame(data) || !nrow(data)) return(logical(0))
  col <- .monitoreo_aulas_col(data, c(
    "filter_passed", "pasa_filtro", "apto", "elegible", "eligible",
    "screening_status", "estado_filtro", "consent", "consentimiento"
  ))
  if (!nzchar(col) || !col %in% names(data)) return(valid_response %in% TRUE)
  key <- .monitoreo_text_key(as.character(data[[col]] %||% ""))
  passed <- key %in% c(
    "1", "true", "t", "si", "sí", "yes", "y", "apto", "aprobado",
    "eligible", "elegible", "pasa", "passed", "valid", "valido", "válido",
    "acepta", "consiente", "consent"
  )
  rejected <- key %in% c(
    "0", "false", "f", "no", "n", "no_apto", "no elegible", "no_elegible",
    "rechazado", "rejected", "fail", "failed", "no pasa", "no_pasa"
  )
  passed[!passed & !rejected & valid_response %in% TRUE] <- TRUE
  passed
}

.monitoreo_aulas_named_counts <- function(keys, mask = NULL) {
  keys <- trimws(as.character(keys %||% character(0)))
  if (is.null(mask)) mask <- rep(TRUE, length(keys))
  mask <- mask %in% TRUE & nzchar(keys)
  if (!length(keys) || !any(mask)) return(integer(0))
  table(keys[mask])
}

.monitoreo_aulas_course_status <- function(plan_df, responses, cfg, valid_response, response_classroom) {
  if (!is.data.frame(plan_df) || !nrow(plan_df)) return(list())
  total_counts <- .monitoreo_aulas_named_counts(response_classroom)
  valid_counts <- .monitoreo_aulas_named_counts(response_classroom, valid_response)
  filter_passed <- .monitoreo_aulas_filter_passed(responses, valid_response)
  passed_counts <- .monitoreo_aulas_named_counts(response_classroom, filter_passed)
  rejected_counts <- .monitoreo_aulas_named_counts(response_classroom, !filter_passed & nzchar(response_classroom))

  rows <- plan_df
  rows$responses_total <- .monitoreo_aulas_contar_por_fila(rows, total_counts)
  rows$respuestas_validas <- .monitoreo_aulas_contar_por_fila(rows, valid_counts)
  rows$filter_passed <- .monitoreo_aulas_contar_por_fila(rows, passed_counts)
  rows$filter_rejected <- .monitoreo_aulas_contar_por_fila(rows, rejected_counts)
  # `expected_valid` puede llegar como TEXTO: `.monitoreo_aulas_df()` convierte
  # todas las columnas a character, y este plan hace ese viaje de ida y vuelta.
  # La linea de `brecha` ya lo coaccionaba; la de `application_state` no, asi
  # que comparaba lexicograficamente: "5" >= "30" es TRUE, y un aula con 5 de 30
  # se declaraba "cerrando". No se veia porque hasta ahora las validas eran
  # siempre 0 y "0" >= "30" da FALSE.
  meta <- suppressWarnings(as.numeric(rows$expected_valid))
  meta[!is.finite(meta)] <- 0
  rows$brecha <- pmax(0, meta - rows$respuestas_validas)
  rows$brecha[!is.finite(rows$brecha)] <- 0
  rows$application_state <- ifelse(
    rows$operational_status %in% c("aplicada", "cerrada") | (rows$respuestas_validas >= meta & meta > 0),
    "cerrando",
    ifelse(rows$responses_total > 0 | rows$operational_status %in% c("en_campo", "parcial"), "en_aplicacion",
           ifelse(rows$operational_status %in% c("agendada", "contactada"), "lista", "pendiente"))
  )
  cols <- intersect(c(
    "operational_code", "titular_operational_code", "wave", "classroom_id",
    "course_name", "section", "schedule", "faculty", "program", "level",
    "responsible", "collector_id", "operational_status", "application_state",
    "eligible_n", "expected_valid", "responses_total", "respuestas_validas",
    "filter_passed", "filter_rejected", "brecha", "link", "updated_at"
  ), names(rows))
  out <- rows[, cols, drop = FALSE]
  priority <- match(out$application_state, c("en_aplicacion", "lista", "pendiente", "cerrando"), nomatch = 5L)
  out <- out[order(priority, -out$brecha, out$faculty, out$schedule, out$operational_code), , drop = FALSE]
  .monitoreo_aulas_records(out, max_rows = 500L)
}

.monitoreo_aulas_quota_source_df <- function(cfg) {
  quotas <- cfg$quotas %||% list()
  if (!is.list(quotas)) return(data.frame(stringsAsFactors = FALSE))
  raw <- quotas$sex_by_faculty %||% quotas$sexo_facultad %||% quotas$population_cross_profiles %||% list()
  df <- tryCatch(.monitoreo_aulas_df(raw, "cuotas sexo facultad"), error = function(e) data.frame(stringsAsFactors = FALSE))
  if (!nrow(df)) return(df)
  primary_role <- .monitoreo_aulas_values(df, .monitoreo_aulas_col(df, c("primary_role", "rol_primario")), "")
  secondary_role <- .monitoreo_aulas_values(df, .monitoreo_aulas_col(df, c("secondary_role", "rol_secundario")), "")
  keep <- .monitoreo_text_key(primary_role) %in% c("faculty", "facultad") &
    .monitoreo_text_key(secondary_role) %in% c("sex", "sexo", "genero", "género")
  if (any(keep)) df <- df[keep, , drop = FALSE]
  df
}

.monitoreo_aulas_plan_sex_faculty_targets <- function(plan_df) {
  if (!is.data.frame(plan_df) || !nrow(plan_df)) return(data.frame(stringsAsFactors = FALSE))
  rows <- list()
  for (i in seq_len(nrow(plan_df))) {
    faculty <- .monitoreo_scalar(plan_df$faculty[[i]] %||% plan_df$stratum[[i]], "Sin facultad")
    expected <- .monitoreo_num(plan_df$expected_valid[[i]] %||% plan_df$eligible_n[[i]], 0)
    sex1 <- .monitoreo_scalar(plan_df$sex_top_1[[i]] %||% "", "")
    sex2 <- .monitoreo_scalar(plan_df$sex_top_2[[i]] %||% "", "")
    n1 <- .monitoreo_num(plan_df$sex_top_1_n[[i]] %||% 0, 0)
    n2 <- .monitoreo_num(plan_df$sex_top_2_n[[i]] %||% 0, 0)
    total <- n1 + n2
    if (!nzchar(sex1) || total <= 0 || expected <= 0) next
    rows[[length(rows) + 1L]] <- data.frame(faculty = faculty, sex = sex1, target = expected * n1 / total, stringsAsFactors = FALSE)
    if (nzchar(sex2) && n2 > 0) {
      rows[[length(rows) + 1L]] <- data.frame(faculty = faculty, sex = sex2, target = expected * n2 / total, stringsAsFactors = FALSE)
    }
  }
  if (!length(rows)) return(data.frame(stringsAsFactors = FALSE))
  df <- do.call(rbind, rows)
  agg <- stats::aggregate(target ~ faculty + sex, data = df, FUN = sum)
  agg$target <- as.integer(round(agg$target))
  agg$source <- "plan_sex_top"
  agg
}

.monitoreo_aulas_quota_targets <- function(plan_df, cfg) {
  quota_df <- .monitoreo_aulas_quota_source_df(cfg)
  if (nrow(quota_df)) {
    faculty_col <- .monitoreo_aulas_col(quota_df, c("primary_raw", "faculty", "facultad"))
    sex_col <- .monitoreo_aulas_col(quota_df, c("secondary_raw", "sex", "sexo", "genero"))
    count_col <- .monitoreo_aulas_col(quota_df, c("count", "n", "N", "conteo"))
    if (nzchar(faculty_col) && nzchar(sex_col) && nzchar(count_col)) {
      src <- data.frame(
        faculty = .monitoreo_aulas_values(quota_df, faculty_col, "Sin facultad"),
        sex = .monitoreo_aulas_values(quota_df, sex_col, "Sin dato"),
        frame_n = .monitoreo_aulas_num_values(quota_df, count_col, 0),
        stringsAsFactors = FALSE
      )
      src <- src[src$frame_n > 0 & nzchar(src$faculty) & nzchar(src$sex), , drop = FALSE]
      if (nrow(src)) {
        expected_df <- data.frame(
          faculty = as.character(plan_df$faculty %||% plan_df$stratum %||% "Sin facultad"),
          expected_valid = suppressWarnings(as.numeric(plan_df$expected_valid %||% 0)),
          stringsAsFactors = FALSE
        )
        expected_df$expected_valid[!is.finite(expected_df$expected_valid)] <- 0
        expected_by_faculty <- stats::aggregate(expected_valid ~ faculty, data = expected_df, FUN = sum)
        names(expected_by_faculty) <- c("faculty", "expected_total")
        totals <- stats::aggregate(frame_n ~ faculty, data = src, FUN = sum)
        names(totals) <- c("faculty", "frame_total")
        src <- merge(src, totals, by = "faculty", all.x = TRUE, sort = FALSE)
        src <- merge(src, expected_by_faculty, by = "faculty", all.x = TRUE, sort = FALSE)
        src$expected_total[!is.finite(src$expected_total)] <- 0
        src$target <- ifelse(src$frame_total > 0, round(src$expected_total * src$frame_n / src$frame_total), 0)
        src$source <- "calc_muestra_faculty_sex"
        return(src[, c("faculty", "sex", "target", "frame_n", "source"), drop = FALSE])
      }
    }
  }
  .monitoreo_aulas_plan_sex_faculty_targets(plan_df)
}

.monitoreo_aulas_response_faculty_values <- function(responses, plan_df, response_classroom) {
  if (!is.data.frame(responses) || !nrow(responses)) return(character(0))
  faculty_col <- .monitoreo_aulas_col(responses, c("faculty", "facultad", "unidad", "escuela"))
  faculty <- if (nzchar(faculty_col)) .monitoreo_aulas_values(responses, faculty_col, "") else rep("", nrow(responses))
  if (is.data.frame(plan_df) && nrow(plan_df) && length(response_classroom)) {
    # Tercera copia del mismo emparejamiento: la respuesta se identifica por el
    # id que viajo en su QR (`collection_unit_id`), no por `classroom_id`.
    # Indexar solo por aula dejaba sin facultad a toda respuesta que llegara con
    # el id del colector, y con ella el cruce de cuotas sexo x facultad ciego.
    valores <- as.character(plan_df$faculty %||% plan_df$stratum %||% "")
    lookup <- stats::setNames(valores, as.character(plan_df$classroom_id %||% ""))
    if ("collection_unit_id" %in% names(plan_df)) {
      por_unidad <- stats::setNames(valores, as.character(plan_df$collection_unit_id))
      por_unidad <- por_unidad[nzchar(names(por_unidad))]
      lookup <- c(lookup, por_unidad[!names(por_unidad) %in% names(lookup)])
    }
    missing <- !nzchar(faculty) & nzchar(response_classroom)
    faculty[missing] <- as.character(lookup[response_classroom[missing]] %||% "")
    faculty[is.na(faculty)] <- ""
  }
  faculty
}

.monitoreo_aulas_quota_sex_faculty <- function(plan_df, responses, cfg, valid_response, response_classroom) {
  targets <- .monitoreo_aulas_quota_targets(plan_df, cfg)
  if (!is.data.frame(targets) || !nrow(targets)) return(list())
  sex_col <- .monitoreo_aulas_col(responses, c("sex", "sexo", "genero", "género", "gender"))
  faculty <- .monitoreo_aulas_response_faculty_values(responses, plan_df, response_classroom)
  sex <- if (nzchar(sex_col)) .monitoreo_aulas_values(responses, sex_col, "") else character(0)
  if (!length(sex)) {
    observed <- data.frame(faculty = character(0), sex = character(0), observed = integer(0), stringsAsFactors = FALSE)
  } else {
    keep <- valid_response %in% TRUE & nzchar(faculty) & nzchar(sex)
    observed <- if (any(keep)) {
      stats::aggregate(rep(1L, sum(keep)), by = list(faculty = faculty[keep], sex = sex[keep]), FUN = sum)
    } else {
      data.frame(faculty = character(0), sex = character(0), x = integer(0), stringsAsFactors = FALSE)
    }
    if (nrow(observed)) names(observed)[names(observed) == "x"] <- "observed"
  }
  out <- merge(targets, observed, by = c("faculty", "sex"), all.x = TRUE, sort = FALSE)
  out$observed[is.na(out$observed)] <- 0L
  target_num <- suppressWarnings(as.numeric(out$target))
  target_num[!is.finite(target_num)] <- 0
  out$target <- as.integer(pmax(0L, round(target_num)))
  out$missing <- as.integer(pmax(0L, out$target - out$observed))
  out$progress_pct <- ifelse(out$target > 0L, round(100 * out$observed / out$target, 1), NA_real_)
  out$status <- ifelse(out$target <= 0L, "sin_meta", ifelse(out$observed >= out$target, "cumplida", ifelse(out$observed > 0L, "en_riesgo", "pendiente")))
  out <- out[order(out$status != "en_riesgo", out$status != "pendiente", -out$missing, out$faculty, out$sex), , drop = FALSE]
  .monitoreo_aulas_records(out, max_rows = 240L)
}

monitoreo_aulas_dashboard <- function(plan = list(), responses = data.frame(), config = list()) {
  cfg <- monitoreo_aulas_normalize_config(config)
  plan_df <- .monitoreo_aulas_df(plan %||% cfg$plan, "plan")
  if (!nrow(plan_df)) {
    return(list(
      schema = "monitoreo_aulas_dashboard_v1",
      generated_at = .monitoreo_now_iso(),
      kpis = list(total_aulas = 0L, aulas_aplicadas = 0L, respuestas_validas = 0L, brechas = 0L),
      agenda = list(),
      avance_por_estrato = list(),
      brechas = list(),
      reemplazos = list(),
      validation = list()
    ))
  }
  plan_df <- .monitoreo_aulas_df(monitoreo_aulas_normalize_plan(plan_df), "plan")
  tracked_df <- plan_df[plan_df$sample_role != "extra_reserve_pool", , drop = FALSE]
  if (!nrow(tracked_df)) tracked_df <- plan_df
  status <- plan_df$operational_status
  valid_response <- .monitoreo_aulas_valid_response(responses, cfg)
  response_classroom <- .monitoreo_aulas_response_classroom(responses, cfg)
  valid_counts <- if (length(valid_response)) {
    table(response_classroom[valid_response & nzchar(response_classroom)])
  } else {
    integer(0)
  }
  # Mismo emparejamiento que usa `course_status`: por eso es un helper y no dos
  # copias. Antes esta linea solo miraba `classroom_id`, asi que brechas,
  # estratos y reemplazos se calculaban sobre ceros.
  plan_df$respuestas_validas <- .monitoreo_aulas_contar_por_fila(plan_df, valid_counts)
  meta_plan <- suppressWarnings(as.numeric(plan_df$expected_valid))
  meta_plan[!is.finite(meta_plan)] <- 0
  plan_df$brecha <- pmax(0, meta_plan - plan_df$respuestas_validas)
  plan_df$brecha[!is.finite(plan_df$brecha)] <- 0
  tracked_df <- plan_df[plan_df$sample_role != "extra_reserve_pool", , drop = FALSE]
  if (!nrow(tracked_df)) tracked_df <- plan_df
  course_status <- .monitoreo_aulas_course_status(plan_df, responses, cfg, valid_response, response_classroom)
  quotas_sex_faculty <- .monitoreo_aulas_quota_sex_faculty(plan_df, responses, cfg, valid_response, response_classroom)

  advance <- stats::aggregate(
    cbind(aulas = rep(1L, nrow(tracked_df)), respuestas_validas = tracked_df$respuestas_validas, brecha = tracked_df$brecha) ~ stratum,
    data = tracked_df,
    FUN = sum
  )
  applied_by_stratum <- stats::aggregate(
    aplicada ~ stratum,
    data = data.frame(stratum = tracked_df$stratum, aplicada = tracked_df$operational_status %in% c("aplicada", "cerrada", "parcial"), stringsAsFactors = FALSE),
    FUN = sum
  )
  advance <- merge(advance, applied_by_stratum, by = "stratum", all.x = TRUE, sort = FALSE)
  names(advance)[names(advance) == "aplicada"] <- "aulas_aplicadas"
  advance$avance_aulas_pct <- ifelse(advance$aulas > 0, round(100 * advance$aulas_aplicadas / advance$aulas, 1), NA_real_)
  advance$avance_respuestas_pct <- ifelse((advance$respuestas_validas + advance$brecha) > 0, round(100 * advance$respuestas_validas / (advance$respuestas_validas + advance$brecha), 1), NA_real_)

  brechas <- tracked_df[tracked_df$brecha > 0 | tracked_df$operational_status %in% c("sin_acceso", "cancelada", "reemplazo_pendiente"), , drop = FALSE]
  replacements <- tracked_df[nzchar(tracked_df$replacement_for) | tracked_df$operational_status %in% c("reemplazada", "reemplazo_pendiente"), , drop = FALSE]
  representativity <- .monitoreo_aulas_effective_representativity(tracked_df, cfg)

  collector_col <- .monitoreo_aulas_col(responses, c(
    cfg$source_mapping$collector_var,
    # Ver la nota de `.monitoreo_aulas_response_classroom()`: `collectorID` es
    # el nombre que produce nuestro propio QR.
    "collectorID", "collector_id", "collector", "link", "aula_id", "classroom_id"
  ))
  collector_values <- if (nzchar(collector_col)) .monitoreo_aulas_values(responses, collector_col, "") else character(0)

  # Una respuesta huerfana es la que trae un colector que NO pertenece a ninguna
  # aula del plan: un QR de otro estudio, una ficha vieja, un id mal tecleado.
  # Antes este chequeo solo miraba si la respuesta TENIA valor de colector, no
  # si ese valor casaba con algo, asi que una respuesta de un aula inexistente
  # pasaba como buena. Comprobarlo solo es posible desde que el emparejamiento
  # conoce `collection_unit_id`.
  ids_del_plan <- unique(c(
    as.character(plan_df$classroom_id %||% character(0)),
    as.character(plan_df$collection_unit_id %||% character(0))
  ))
  ids_del_plan <- ids_del_plan[nzchar(ids_del_plan)]
  huerfanas <- if (length(valid_response)) {
    valid_response %in% TRUE & (!nzchar(response_classroom) | !(response_classroom %in% ids_del_plan))
  } else {
    logical(0)
  }

  # En un estudio de aulas el MISMO colector lo escanean todos los alumnos del
  # aula: el duplicado es el diseno, no una anomalia. Este chequeo miraba
  # duplicados de colector y por eso decia "review" en cuanto un aula tenia dos
  # respuestas — es decir, siempre. Lo que si es anomalo es la misma RESPUESTA
  # dos veces, y eso se mira por su identificador, no por el del colector.
  respuesta_id_col <- .monitoreo_aulas_col(responses, c(
    "_uuid", "uuid", "_id", "instanceID", "meta/instanceID", "response_id", "submission_uuid"
  ))
  respuesta_ids <- if (nzchar(respuesta_id_col)) {
    .monitoreo_aulas_values(responses, respuesta_id_col, "")
  } else {
    character(0)
  }
  respuestas_repetidas <- sum(duplicated(respuesta_ids[nzchar(respuesta_ids)]))

  quota_status <- vapply(quotas_sex_faculty, function(row) .monitoreo_scalar(row$status %||% "", ""), character(1))
  validation <- data.frame(
    check = c("anonymous_responses", "student_id_required", "unmapped_valid_responses", "duplicate_responses", "effective_representativity", "sex_faculty_quota"),
    status = c(
      if (isTRUE(cfg$anonymous_responses)) "ok" else "review",
      "ok",
      if (any(huerfanas)) "warning" else "ok",
      if (respuestas_repetidas > 0L) "review" else "ok",
      if (nzchar(representativity$warning %||% "")) "warning" else "ok",
      if (length(quota_status) && any(quota_status %in% c("pendiente", "en_riesgo"))) "warning" else "ok"
    ),
    detail = c(
      "El tablero agrega por aula/collector/link.",
      "No se exige identificador personal de estudiante.",
      if (any(huerfanas)) {
        sprintf("%d respuestas validas no corresponden a ninguna aula del plan.", sum(huerfanas))
      } else {
        "Todas las respuestas validas se atribuyeron a un aula del plan."
      },
      if (!nzchar(respuesta_id_col)) {
        "La fuente no trae identificador de respuesta; no se puede comprobar."
      } else {
        sprintf("%d respuestas repetidas.", respuestas_repetidas)
      },
      if (nzchar(representativity$warning %||% "")) representativity$warning else sprintf("Score efectivo %.1f.", representativity$effective_score %||% NA_real_),
      if (length(quota_status)) sprintf("%s celdas sexo x facultad con brecha.", sum(quota_status %in% c("pendiente", "en_riesgo"))) else "Sin cuota sexo x facultad detectable."
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  list(
    schema = "monitoreo_aulas_dashboard_v1",
    generated_at = .monitoreo_now_iso(),
    selection_run_id = cfg$selection_run_id,
    frame_hash = cfg$frame_hash,
    anonymous_responses = isTRUE(cfg$anonymous_responses),
    kpis = list(
      total_aulas = as.integer(nrow(tracked_df)),
      aulas_titulares = as.integer(sum(tracked_df$wave == "M1")),
      aulas_aplicadas = as.integer(sum(tracked_df$operational_status %in% c("aplicada", "cerrada"))),
      aulas_parciales = as.integer(sum(tracked_df$operational_status == "parcial")),
      reemplazos_usados = as.integer(sum(nzchar(tracked_df$replacement_for) & tracked_df$operational_status %in% c("agendada", "en_campo", "aplicada", "cerrada", "parcial"))),
      respuestas_validas = as.integer(sum(valid_response)),
      respuestas_total = as.integer(length(response_classroom)),
      filter_passed = as.integer(sum(.monitoreo_aulas_filter_passed(responses, valid_response), na.rm = TRUE)),
      filter_rejected = as.integer(max(0L, length(response_classroom) - sum(.monitoreo_aulas_filter_passed(responses, valid_response), na.rm = TRUE))),
      brechas = as.integer(sum(plan_df$brecha > 0)),
      quota_cells = as.integer(length(quotas_sex_faculty)),
      quota_cells_ok = as.integer(sum(quota_status == "cumplida")),
      quota_cells_pending = as.integer(sum(quota_status %in% c("pendiente", "en_riesgo"))),
      representativity_effective_score = representativity$effective_score,
      representativity_score_loss = representativity$score_loss
    ),
    agenda = .monitoreo_aulas_records(plan_df),
    course_status = course_status,
    avance_por_estrato = .monitoreo_aulas_records(advance),
    quotas_sex_faculty = quotas_sex_faculty,
    brechas = .monitoreo_aulas_records(brechas),
    reemplazos = .monitoreo_aulas_records(replacements),
    representativity = representativity,
    validation = .monitoreo_aulas_records(validation)
  )
}

monitoreo_aulas_update_agenda <- function(current, updates = list()) {
  plan_df <- .monitoreo_aulas_df(monitoreo_aulas_normalize_plan(current), "plan")
  upd_df <- .monitoreo_aulas_df(updates, "updates")
  if (!nrow(upd_df)) return(monitoreo_aulas_normalize_plan(plan_df))
  if (!"classroom_id" %in% names(upd_df)) {
    id_col <- .monitoreo_aulas_col(upd_df, c("aula_id", "codigo_aula", "id"))
    if (nzchar(id_col)) names(upd_df)[names(upd_df) == id_col] <- "classroom_id"
  }
  if (!"classroom_id" %in% names(upd_df)) upd_df$classroom_id <- ""
  if (!"operational_code" %in% names(upd_df)) {
    code_col <- .monitoreo_aulas_col(upd_df, c("codigo_operativo", "codigo_aula_operativa"))
    if (nzchar(code_col)) names(upd_df)[names(upd_df) == code_col] <- "operational_code"
  }
  if (!"operational_code" %in% names(upd_df)) upd_df$operational_code <- ""
  # Tercer identificador admitido: el que viaja en el QR. Ver la nota de
  # `.monitoreo_aulas_plan_index()` — es preparatorio para la superficie de
  # registro que todavia no existe, no un arreglo de un defecto observado.
  if (!"collection_unit_id" %in% names(upd_df)) {
    unit_col <- .monitoreo_aulas_col(upd_df, c("unit_id", "collectorID", "collector_id"))
    if (nzchar(unit_col)) names(upd_df)[names(upd_df) == unit_col] <- "collection_unit_id"
  }
  if (!"collection_unit_id" %in% names(upd_df)) upd_df$collection_unit_id <- ""
  if (!any(nzchar(upd_df$classroom_id) | nzchar(upd_df$operational_code) |
           nzchar(upd_df$collection_unit_id))) {
    stop("Las actualizaciones requieren classroom_id, operational_code o collection_unit_id.", call. = FALSE)
  }
  for (i in seq_len(nrow(upd_df))) {
    cid <- .monitoreo_scalar(upd_df$classroom_id[[i]], "")
    code <- .monitoreo_scalar(upd_df$operational_code[[i]], "")
    unit <- .monitoreo_scalar(upd_df$collection_unit_id[[i]], "")
    if (!nzchar(cid) && !nzchar(code) && !nzchar(unit)) next
    idx <- .monitoreo_aulas_plan_index(plan_df, cid, code, unit)
    if (!length(idx)) next
    row <- upd_df[i, , drop = FALSE]
    for (nm in names(row)) {
      if (!nm %in% names(plan_df)) next
      value <- .monitoreo_scalar(row[[nm]], "")
      if (!nzchar(value) && !nm %in% c("link", "qr", "word_link", "pdf_link", "package_label", "package_status", "collector_id", "responsible", "replacement_note",
                                    "applied_by", "applied_at", "field_note")) next
      # El enlace de aplicación es lo que termina impreso en el QR: una URL que
      # no puede recibir los parámetros de unidad se rechaza al guardar, no al
      # descubrir que las respuestas llegaron sin identificar el aula.
      if (identical(nm, "link") && nzchar(value)) {
        capture_url_require(value, context = .monitoreo_scalar(plan_df$classroom_id[[idx[[1]]]], "Enlace de aplicación"))
      }
      plan_df[idx, nm] <- value
    }
    plan_df$operational_status[idx] <- .monitoreo_aulas_status(plan_df$operational_status[idx], plan_df$operational_status[idx])
    plan_df$updated_at[idx] <- .monitoreo_now_iso()
  }
  monitoreo_aulas_normalize_plan(plan_df)
}

monitoreo_aulas_apply_replacement <- function(current, classroom_id, replacement_id, reason = "otro", note = "") {
  plan_df <- .monitoreo_aulas_df(monitoreo_aulas_normalize_plan(current), "plan")
  classroom_id <- .monitoreo_scalar(classroom_id, "")
  replacement_id <- .monitoreo_scalar(replacement_id, "")
  if (!nzchar(classroom_id) || !nzchar(replacement_id)) {
    stop("Se requiere aula caida y aula de reemplazo.", call. = FALSE)
  }
  idx_old <- .monitoreo_aulas_plan_index(plan_df, classroom_id, classroom_id)
  idx_new <- .monitoreo_aulas_plan_index(plan_df, replacement_id, replacement_id)
  if (!length(idx_old)) stop("No se encontro el aula caida en el plan.", call. = FALSE)
  if (!length(idx_new)) stop("No se encontro el aula de reemplazo en el plan.", call. = FALSE)
  old_classroom_id <- .monitoreo_scalar(plan_df$classroom_id[[idx_old[[1]]]], classroom_id)
  reason <- .monitoreo_aulas_reason(reason)
  plan_df$operational_status[idx_old] <- "reemplazada"
  plan_df$replacement_reason[idx_old] <- reason
  plan_df$replacement_note[idx_old] <- .monitoreo_scalar(note, "")
  plan_df$updated_at[idx_old] <- .monitoreo_now_iso()
  plan_df$operational_status[idx_new] <- "agendada"
  plan_df$replacement_for[idx_new] <- old_classroom_id
  plan_df$replacement_reason[idx_new] <- reason
  plan_df$replacement_note[idx_new] <- .monitoreo_scalar(note, "")
  plan_df$updated_at[idx_new] <- .monitoreo_now_iso()
  monitoreo_aulas_normalize_plan(plan_df)
}

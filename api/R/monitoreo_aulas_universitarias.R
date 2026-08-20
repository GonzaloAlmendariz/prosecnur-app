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
  # El guion bajo pasa a ESPACIO, no se borra. Borrandolo, `en_reserva` —el
  # valor canonico que devuelve esta misma funcion— quedaba en "enreserva" y no
  # casaba con "en reserva": la funcion no reconocia su propia salida y degradaba
  # la reserva a `sin_contactar` en cada vuelta de normalizacion.
  key <- gsub("_", " ", key, fixed = TRUE)
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

#' Columnas que viajan en el reporte de brechas.
#'
#' Union de lo que piden sus dos consumidores: la tabla de Consultas > Brechas
#' (`operational_code`, `label`, `respuestas_validas`, `expected_valid`,
#' `brecha`, `operational_status`) y la publicacion a Sheets
#' (`.monitoreo_publication_aulas_model_frames`, que ademas toma `classroom_id`,
#' `faculty`, `program`, `level`, `stratum` y `wave`).
#' @export
# Cuantas filas de `course_status` viajan al cliente. No es un numero magico:
# es el tope del payload, y lo que deja fuera se declara con `course_status_total`.
MONITOREO_AULAS_COURSE_STATUS_TOPE <- 500L

BRECHAS_COLUMNAS_PUBLICADAS <- c(
  "operational_code", "classroom_id", "label", "faculty", "program", "level",
  "stratum", "wave", "operational_status", "respuestas_validas",
  "expected_valid", "brecha"
)

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
      # De la constante, no de una copia. La lista viajaba por DOS sitios —aqui y
      # el default de `.monitoreo_aulas_valid_response()`— y el normalizador
      # siempre rellena desde este, asi que ampliar el otro no cambiaba nada:
      # el mismo patron de cadena de whitelists que ya mordio en Graficos.
      valid_statuses = as.list(MONITOREO_AULAS_ESTADOS_VALIDOS)
    ),
    plan = list(),
    # Partes de campo de la hoja «Aulas Aplicadas». Viven junto al plan y no
    # dentro de el: son otra medida del mismo aula. Sin declararlos aqui el
    # normalizador los descartaba y el control de reconciliacion nunca veia
    # nada que comprobar.
    partes_campo = list(),
    control_sin_nombre = 0L,
    control = list(),
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
      valid_statuses = as.list(.monitoreo_chr_vec(mapping$valid_statuses %||% mapping$estados_validos %||% defaults$source_mapping$valid_statuses)),
      # **Los filtros de encuesta efectiva, que si no se declaran AQUI se pierden
      # al guardar.** Este normalizador es la whitelist de la config: lo que no
      # nombra, no persiste, y el campo se habria caido en silencio dejando la UI
      # nueva sin efecto ninguno.
      #
      # Se limpian aqui y no en el cliente porque la config puede llegar de un
      # `.pulso` viejo o de otra sesion: **un filtro sin variable o sin valores
      # descartaria TODAS las respuestas**, y el tope de cuatro es el que Gonzalo
      # declaro —«puede tener hasta 4»—.
      valid_filters = local({
        crudos <- .monitoreo_aulas_filas_de_filtro(
          mapping$valid_filters %||% mapping$filtros_validez
        )
        limpios <- list()
        for (f in crudos) {
          if (!is.list(f)) next
          var <- .monitoreo_scalar(f$var %||% f$variable, "")
          vals <- .monitoreo_chr_vec(f$values %||% f$valores %||% character(0))
          if (nzchar(var) && length(vals)) {
            limpios[[length(limpios) + 1L]] <- list(var = var, values = as.list(vals))
          }
          if (length(limpios) >= 4L) break
        }
        limpios
      })
    ),
    plan = monitoreo_aulas_normalize_plan(config$plan %||% config$agenda %||% defaults$plan),
    # Ver la nota en `monitoreo_aulas_default_config()`: sin esta linea el
    # normalizador descartaba los partes y el control de reconciliacion no
    # tenia nada que comprobar.
    # Columnas de «Base de control» con datos que la cabecera del Excel no
    # bautiza. El lector las cuenta desde el principio y el dato viajaba en la
    # respuesta de la importacion sin que nadie lo mirara: una capacidad sin
    # consumidor. Aqui entra al tablero.
    control_sin_nombre = {
      v <- suppressWarnings(as.integer(config$control_sin_nombre %||% defaults$control_sin_nombre %||% 0L))
      if (length(v) != 1L || !is.finite(v) || v < 0L) 0L else v
    },
    partes_campo = {
      pc <- config$partes_campo %||% config$partes %||% defaults$partes_campo
      if (is.list(pc)) unname(Filter(is.list, pc)) else list()
    },
    # Las filas de «Base de control». Mismo tratamiento que los partes: se
    # conservan como vienen del lector y el motor las publica sin recalcular
    # nada, porque las formulas de control son del equipo, no de la app.
    control = {
      ct <- config$control %||% config$base_control %||% defaults$control
      if (is.list(ct)) unname(Filter(is.list, ct)) else list()
    },
    # El recibo de la importacion. Se conserva tal cual: no es configuracion
    # editable, es el sello de que libro se leyo y cuando.
    libro = if (is.list(config$libro)) config$libro else NULL,
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
    # El telefono viaja con el correo: es EL dato con el que se agenda. El
    # lector del Excel lo trae y el generador lo escribe, pero esta lista es
    # cerrada y no lo declaraba, asi que se caia entre los dos. El estudio de
    # 2025 no lo llenaba —por eso no se noto—, y uno que si lo llene lo perdia
    # en la primera vuelta.
    teacher_phone = get(c("teacher_phone", "telefono_docente", "celular_docente"), ""),
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
    # Se DERIVA mas abajo cuando el plan no lo trae. Nada lo escribia nunca:
    # medido, 196 de 196 vacio, y la vista lo pintaba como «Por revisar», que
    # invita a revisar una ficha que no existe.
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
    # `notes` es el alias con el que lo escribe el generador del libro; el lector
    # lo deja en `replacement_note`. Aceptar los dos evita que la observacion se
    # caiga segun por que puerta entre.
    replacement_note = get(c("replacement_note", "nota_reemplazo", "notes", "observaciones"), ""),
    equivalence_level = get(c("equivalence_level", "nivel_equivalencia"), ""),
    chain_score = getn(c("chain_score", "score_cadena"), NA_real_),
    chain_depth = getn(c("chain_depth", "profundidad_cadena"), NA_real_),
    activation_weight_status = get(c("activation_weight_status", "estado_peso_activacion"), ""),
    # Trazabilidad de la activacion. La lista de campos de este normalizador es
    # CERRADA: lo que no se declara aqui se cae, y por eso `monitoreo_aulas_activar_reemplazo()`
    # escribia estas tres marcas y el tablero las mostraba vacias.
    replaced_at = get(c("replaced_at", "reemplazada_en"), ""),
    activated_at = get(c("activated_at", "activada_en"), ""),
    activation_reason = get(c("activation_reason", "motivo_activacion"), ""),
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
  # El estado de la ficha del aula, DERIVADO de los materiales que existen.
  #
  # `package_status` es un campo que ningun proceso escribia —medido: vacio en
  # las 196 del operativo— y la vista lo rotulaba «Por revisar», que suena a que
  # hay una ficha esperando revision cuando lo que pasa es que no hay ninguna.
  # El vocabulario de estos estados ya existia en la capa de presentacion
  # (`pendiente_enlace`, `listo_para_pdf`, `pdf_preparado`); lo que faltaba era
  # que alguien los emitiera.
  #
  # Se deriva SOLO cuando el plan no trae valor: si un dia Recopiladores empieza
  # a escribirlo, ese valor manda.
  materiales <- !nzchar(out$package_status)
  if (any(materiales)) {
    tiene <- function(col) nzchar(out[[col]]) & materiales
    out$package_status[materiales] <- "pendiente_enlace"
    # El enlace es la condicion de todo lo demas: sin el, el QR no lleva a
    # ninguna parte y la ficha impresa no sirve.
    con_enlace <- (tiene("link") | tiene("qr"))
    out$package_status[con_enlace] <- "listo_para_pdf"
    out$package_status[tiene("pdf_link") | tiene("word_link")] <- "pdf_preparado"
  }
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
  # Ultimo recurso: la posicion DENTRO DE SU CADENA. Poner 1 a todas hacia que
  # dos reservas del mismo titular compartieran codigo —las dos de `CH 4` se
  # llamaban `R 4.1`—, que es peor que un vacio: son dos aulas distintas con el
  # mismo nombre en la tabla desde la que se decide a quien activar.
  sin_orden <- !is.finite(rep_order) | rep_order <= 0
  # Se cuenta SOLO entre reservas: incluir al titular en su propio grupo lo hacia
  # ocupar el puesto 1 y desplazaba a sus reservas a `R n.2` y `R n.3`.
  reservas_sin_orden <- which(sin_orden & out$sample_role == "chain_reserve" & nzchar(out$replacement_for))
  if (length(reservas_sin_orden)) {
    rep_order[reservas_sin_orden] <- stats::ave(
      seq_along(reservas_sin_orden),
      out$replacement_for[reservas_sin_orden],
      FUN = seq_along
    )
  }
  rep_order[!is.finite(rep_order) | rep_order <= 0] <- 1
  # El orden derivado VUELVE al campo, y no se queda en esta variable local.
  # Servia para numerar el codigo de cadena —`R n.k`— pero el campo seguia en 0,
  # asi que la tabla de reemplazos mostraba «Orden en la cadena: 0» en las seis
  # filas de una cadena de seis: justo la columna que dice cual entra ahora.
  # Solo para reservas: el orden de un titular es 0 por definicion.
  es_reserva <- out$sample_role == "chain_reserve"
  out$replacement_order[es_reserva] <- rep_order[es_reserva]
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
  # El titular de una reserva es SU titular, no el que le tocaria por posicion.
  # `slot_number` cae a `orden` cuando el plan no trae `selection_slot_id`, asi
  # que una reserva en la fila 6 se declaraba titular de `CH 6` aunque
  # `replacement_for` dijera `CH 4`. El codigo inventado no queda vacio: apunta a
  # OTRA aula real del estudio, y esa es la tabla que el equipo mira para decidir
  # a quien activar.
  reserva <- out$sample_role == "chain_reserve"
  hereda <- reserva & !nzchar(out$titular_operational_code) & nzchar(out$replacement_for)
  out$titular_operational_code[hereda] <- out$replacement_for[hereda]
  # Una reserva sin `replacement_for` no tiene de donde: vacio es mas honesto que
  # un `CH n` plausible. El titular de un titular si sale del slot: es el mismo.
  titular_role <- ifelse(out$sample_role == "titular", "titular", "")
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
  # El mismo defecto que arriba, en la linea de al lado: la cadena `R n.k`
  # tomaba su `n` de la posicion, asi que la reserva de `CH 4` en la fila 6 se
  # llamaba `R 6.1`. El `n` de la cadena es el del TITULAR, que ya quedo resuelto
  # en `titular_operational_code` unas lineas antes.
  slot_cadena <- slot_number
  n_titular <- suppressWarnings(as.integer(gsub("[^0-9]", "", out$titular_operational_code)))
  hereda_slot <- out$sample_role == "chain_reserve" & is.finite(n_titular)
  slot_cadena[hereda_slot] <- n_titular[hereda_slot]
  out$replacement_chain_code <- .cm_aulas_codigo_operativo(
    code = out$replacement_chain_code,
    role = replacement_role,
    slot_number = slot_cadena,
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

# Estado y frase de la representatividad efectiva.
#
# La escala: `score = 100 - 100 * desvio_medio / 0.05`. O sea 100 es una muestra
# efectiva identica a la planificada y 0 es un desvio medio de 5 pp o mas —el
# tope de la escala, no «sin dato»—. El estado se derivaba solo de `warning`,
# que exige 10 pp en UNA celda, asi que un 0 sobre 100 salia como «Correcto».
.monitoreo_aulas_representatividad_estado <- function(rep) {
  score <- suppressWarnings(as.numeric(rep$effective_score %||% NA_real_))
  # Sin muestra efectiva no hay nada que aprobar: decir «Correcto» cuando no hay
  # ni un curso-horario en campo es peor que no decir nada. Tampoco es una
  # alerta de representatividad —no hay desvio, hay ausencia—, asi que `review`.
  if (!is.finite(score)) return("review")
  if (nzchar(rep$warning %||% "")) return("warning")
  if (score < 70) "review" else "ok"
}

.monitoreo_aulas_representatividad_texto <- function(rep) {
  score <- suppressWarnings(as.numeric(rep$effective_score %||% NA_real_))
  dist <- suppressWarnings(as.numeric(rep$effective_distance %||% NA_real_))
  if (!is.finite(score)) {
    return(if (nzchar(rep$warning %||% "")) rep$warning else "Todavia no hay muestra efectiva que comparar con la planificada.")
  }
  base <- sprintf(
    "Puntaje %.1f de 100: la muestra efectiva se desvia %.1f pp en promedio de la planificada (100 = identica, 0 = 5 pp o mas).",
    score, 100 * (if (is.finite(dist)) dist else 0)
  )
  if (nzchar(rep$warning %||% "")) paste(base, rep$warning) else base
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

#' Normaliza `valid_filters` a una LISTA DE LISTAS, venga como venga.
#'
#' **`jsonlite` convierte un array de objetos en un `data.frame`**, no en una
#' lista: `[{"var":"sexo","values":["F"]}]` llega como un data.frame de una fila.
#' Iterando con `for (f in crudos)` se recorren entonces las COLUMNAS, `is.list(f)`
#' es falso y **se descarta todo en silencio**. El sintoma exacto: el POST
#' devuelve 200, la clave aparece en la config y su valor es `[]`.
#'
#' Es la misma trampa de `simplifyDataFrame` que este repo ya tiene fichada, y
#' solo salio haciendo el ciclo entero desde la pantalla: guardar y ver que el
#' numero no se movia.
.monitoreo_aulas_filas_de_filtro <- function(x) {
  if (is.null(x)) return(list())
  if (is.data.frame(x)) {
    if (!nrow(x)) return(list())
    return(lapply(seq_len(nrow(x)), function(i) as.list(x[i, , drop = FALSE])))
  }
  if (!is.list(x)) return(list())
  x
}

#' Los filtros que definen una encuesta EFECTIVA, tal como los declara el estudio.
#'
#' Gonzalo: «la seccion de fuentes no deja declarar las variables que definen a
#' una encuesta efectiva, que en algunos casos tiene mas de un filtro, puede
#' tener hasta 4».
#'
#' Hasta aqui el criterio era **una sola columna** —`status_var` contra una lista
#' de estados— y eso no alcanza para un estudio real: «efectiva» suele ser
#' completa **y** con consentimiento **y** del publico elegible. Con un unico
#' filtro, las otras condiciones no se podian declarar y el tablero contaba de
#' mas sin decirlo.
#'
#' `valid_filters` es una lista de `list(var = , values = )`; una respuesta vale
#' si **cumple TODOS**. `status_var` + `valid_statuses` siguen funcionando y se
#' leen como el primer filtro: un estudio ya configurado no cambia de numero.
#' @export
monitoreo_aulas_filtros_de_validez <- function(cfg = list()) {
  mapping <- cfg$source_mapping %||% list()
  declarados <- .monitoreo_aulas_filas_de_filtro(mapping$valid_filters)
  filtros <- list()
  for (f in declarados) {
    var <- .monitoreo_scalar(f$var %||% f$variable, "")
    vals <- .monitoreo_chr_vec(f$values %||% f$valores %||% character(0))
    # Un filtro sin variable o sin valores no filtra nada: dejarlo entrar
    # descartaria TODAS las respuestas en silencio.
    if (nzchar(var) && length(vals)) {
      filtros[[length(filtros) + 1L]] <- list(var = var, values = vals)
    }
  }
  if (!length(filtros)) {
    var <- .monitoreo_scalar(mapping$status_var, "")
    if (nzchar(var)) {
      filtros[[1L]] <- list(
        var = var,
        values = .monitoreo_chr_vec(mapping$valid_statuses %||% MONITOREO_AULAS_ESTADOS_VALIDOS)
      )
    }
  }
  filtros
}

.monitoreo_aulas_valid_response <- function(data, cfg) {
  if (!is.data.frame(data) || !nrow(data)) return(rep(FALSE, 0L))
  mapping <- cfg$source_mapping %||% list()
  # **Varios filtros, si el estudio los declara.** Se exige que se cumplan TODOS:
  # cada uno acota, ninguno amplia. Un filtro cuya columna no esta en la base NO
  # se aplica —y el criterio lo declara aparte—, porque descartarlo todo por una
  # columna ausente seria peor que contar de mas.
  # **Basta con UNO declarado.** Ponia `> 1L` y con un solo `valid_filters` la
  # respuesta se iba por el camino viejo de `status_var` —vacio en un estudio que
  # solo declaro filtros— y contaba TODO. Salio haciendo el ciclo entero desde la
  # pantalla: se guardaba «sexo = F» y las validas seguian siendo 3 700. Los tests
  # no lo veian porque el caso de un filtro se probaba con `status_var`.
  filtros <- monitoreo_aulas_filtros_de_validez(cfg)
  declarados <- (cfg$source_mapping %||% list())$valid_filters
  if (length(filtros) && length(declarados)) {
    ok <- rep(TRUE, nrow(data))
    for (f in filtros) {
      if (!f$var %in% names(data)) next
      ok <- ok & (.monitoreo_text_key(data[[f$var]]) %in% .monitoreo_text_key(f$values))
    }
    return(ok)
  }
  status_col <- .monitoreo_scalar(mapping$status_var, "")
  if (!nzchar(status_col) || !status_col %in% names(data)) {
    # `_status` NO entra. Kobo lo manda en TODAS las filas de su export con el
    # valor `submitted_via_web`, que dice como llego el formulario, no si la
    # respuesta vale. Como ese valor no esta en ninguna lista de validos, el
    # avance del estudio entero caia a CERO en silencio en cuanto alguien
    # sincronizaba un export completo de Kobo. Medido: 0 de 6.
    #
    # `_validation_status` SI es un estado de validacion y ahora se reconoce
    # —antes no, porque el guion bajo inicial no casaba y por eso «fallaba
    # abierto»: contaba todo—.
    status_col <- .monitoreo_aulas_col(data, c(
      "response_status", "_validation_status", "validation_status", "estado"
    ))
  }
  if (!nzchar(status_col) || !status_col %in% names(data)) return(rep(TRUE, nrow(data)))
  valid <- .monitoreo_text_key(.monitoreo_chr_vec(
    mapping$valid_statuses %||% MONITOREO_AULAS_ESTADOS_VALIDOS
  ))
  .monitoreo_text_key(data[[status_col]]) %in% valid
}

#' Estados que cuentan como respuesta valida cuando el estudio no declara los suyos.
#'
#' La lista traia solo vocabulario en ingles, asi que un estudio con su columna
#' `estado` en espanol —«completa»— daba CERO validas, y el propio vocabulario de
#' Kobo (`validation_status_approved`) tampoco entraba. Medido: 0 de 4 en los dos
#' casos. Un estudio puede seguir declarando `valid_statuses` y esta lista no se
#' usa; es el defecto por defecto, no una imposicion.
#' @export
MONITOREO_AULAS_ESTADOS_VALIDOS <- c(
  "completed", "complete", "valid", "aprobado",
  # Espanol, que es como lo escriben los estudios de la casa.
  "completa", "completo", "valida", "valido", "aprobada", "aplicada",
  # Vocabulario propio de Kobo en `_validation_status`.
  "validation_status_approved", "approved"
)

#' Que criterio de validez se aplico, para poder decirlo.
#'
#' El criterio se resolvia en silencio: nadie sabia si el tablero contaba TODO
#' —porque no habia columna de estado— o si estaba filtrando por una columna que
#' quiza no era la correcta. Las dos cosas producen numeros muy distintos y
#' ninguna se anunciaba.
#' @export
monitoreo_aulas_criterio_validez <- function(data, cfg = list()) {
  if (!is.data.frame(data) || !nrow(data)) {
    return(list(columna = "", modo = "sin_datos", validas = 0L, total = 0L))
  }
  mapping <- cfg$source_mapping %||% list()
  # Con varios filtros el criterio ya no es «una columna»: se declara cuantos se
  # aplicaron y cuales, y si alguno pedia una columna que la base no trae.
  filtros <- monitoreo_aulas_filtros_de_validez(cfg)
  declarados <- (cfg$source_mapping %||% list())$valid_filters
  if (length(filtros) && length(declarados)) {
    ausentes <- vapply(filtros, function(f) !f$var %in% names(data), logical(1))
    return(list(
      columna = "", modo = "por_filtros",
      filtros = vapply(filtros, function(f) f$var, character(1)),
      filtros_ausentes = vapply(filtros[ausentes], function(f) f$var, character(1)),
      validas = as.integer(sum(.monitoreo_aulas_valid_response(data, cfg))),
      total = as.integer(nrow(data))
    ))
  }
  declarada <- .monitoreo_scalar(mapping$status_var, "")
  col <- if (nzchar(declarada) && declarada %in% names(data)) declarada else
    .monitoreo_aulas_col(data, c("response_status", "_validation_status", "validation_status", "estado"))
  validas <- sum(.monitoreo_aulas_valid_response(data, cfg))
  modo <- if (nzchar(declarada) && !declarada %in% names(data)) {
    # El estudio declaro una columna que no existe. Antes se caia al detector
    # automatico sin decir nada, asi que un error de tipeo en la config pasaba
    # por criterio deliberado.
    "declarada_ausente"
  } else if (!nzchar(col)) "sin_columna" else "por_columna"
  list(columna = col, modo = modo, declarada = declarada,
       validas = as.integer(validas), total = as.integer(nrow(data)))
}

#' Frase que explica el criterio sin jerga.
#' @export
monitoreo_aulas_criterio_texto <- function(crit) {
  total <- as.integer(crit$total %||% 0L)
  validas <- as.integer(crit$validas %||% 0L)
  switch(crit$modo %||% "sin_datos",
    sin_datos = "Todavia no hay respuestas que contar.",
    declarada_ausente = sprintf(
      "El estudio declara la columna de estado '%s' y la base no la trae, asi que se conto por '%s': %d de %d respuestas.",
      crit$declarada %||% "", crit$columna %||% "(ninguna)", validas, total),
    sin_columna = sprintf(
      "La base no trae columna de estado, asi que cuentan las %d respuestas. Si el formulario marca incompletas, declara cual es esa columna.",
      total),
    por_columna = sprintf(
      "Cuentan las respuestas cuyo '%s' esta en la lista de estados validos: %d de %d.",
      crit$columna %||% "", validas, total),
    # **Los filtros se NOMBRAN.** Decir «se aplicaron 4 filtros» sin cuales
    # obligaria a abrir la config para saber que se esta contando, y una columna
    # declarada que la base no trae tiene que salir: es la diferencia entre un
    # criterio deliberado y un error de tipeo que pasa por criterio.
    por_filtros = {
      nombres <- crit$filtros %||% character(0)
      ausentes <- crit$filtros_ausentes %||% character(0)
      paste0(
        if (length(nombres) == 1L)
        sprintf("Una respuesta cuenta si su '%s' esta entre los valores declarados: %d de %d.",
                nombres[[1]], validas, total)
      else
        sprintf("Una respuesta cuenta si cumple %d condiciones a la vez (%s): %d de %d.",
                length(nombres), paste(nombres, collapse = ", "), validas, total),
        if (length(ausentes)) sprintf(
          " La base no trae %s, asi que %s no se aplico.",
          paste(sprintf("'%s'", ausentes), collapse = " ni "),
          if (length(ausentes) == 1L) "esa condicion" else "esas condiciones"
        ) else ""
      )
    }
  )
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
  # El escalon de agendamiento sale de STATUS MUESTRA, no del estado operativo.
  #
  # Antes solo miraba `operational_status`, y como ese lo llena el registro de
  # campo, un aula con `STATUS MUESTRA = AGENDADA` y fecha de aplicacion caia en
  # «pendiente», que la vista rotula «Sin agendar». Medido sobre el estudio de
  # 196: de las 48 que decian «Sin agendar», **22 estaban agendadas con fecha** y
  # las otras 26 estaban REEMPLAZADAS. Ni una sola estaba sin agendar.
  #
  # Las reemplazadas tampoco pertenecen a ese eje: no es que falte agendarlas, es
  # que cayeron y su reserva tomo el relevo. Tienen tramo propio.
  muestra <- tolower(trimws(as.character(rows$sample_status %||% "")))
  # `grepl("^en reserva", ...)` estaba aqui y NO PODIA CASAR NUNCA: el
  # normalizador convierte «EN RESERVA 1» en `en_reserva`, con guion bajo. Era
  # una regla escrita que no se aplicaba, y las reservas caian en «pendiente».
  #
  # Y tratarlas como agendadas tampoco era lo correcto: una reserva en el banco
  # NO esta agendada ni hay que agendarla. Contarla entre las pendientes le dice
  # al coordinador que salga a agendar ocho aulas que no debe tocar salvo que
  # caiga su titular. Medido: las 8 que decian «Sin agendar» eran las 8 reservas
  # libres, y ademas con fecha en la fila. Tramo propio, como las reemplazadas.
  agendada_en_muestra <- muestra %in% c("agendada", "reagendada")
  # MISMA definicion que `monitoreo_aulas_reservas_disponibles()`: una reserva
  # que el motor considera disponible es la que esta en el banco. Si las dos
  # divergen, el tramo dira que hay reservas que la activacion ya no ofrece.
  #
  # El rol es imprescindible: `sin_contactar` —que es a lo que el normalizador
  # manda el vacio— en un TITULAR si es «Sin agendar». Meterlo sin mirar el rol
  # mandaba al banco a todo titular sin estado, y el aserto de control lo cazo.
  rol <- tolower(trimws(as.character(rows$sample_role %||% "")))
  en_reserva <- muestra %in% "en_reserva" |
    (rol %in% "chain_reserve" & muestra %in% c("en_reserva", "sin_contactar", ""))
  rows$application_state <- ifelse(
    rows$operational_status %in% c("aplicada", "cerrada") | (rows$respuestas_validas >= meta & meta > 0),
    "cerrando",
    ifelse(rows$responses_total > 0 | rows$operational_status %in% c("en_campo", "parcial"), "en_aplicacion",
           ifelse(muestra == "reemplazada", "reemplazada",
                  ifelse(rows$operational_status %in% c("agendada", "contactada") | agendada_en_muestra,
                         "lista",
                         ifelse(en_reserva, "en_reserva", "pendiente"))))
  )
  # Si esta fila es el eslabon EN JUEGO de su cadena. Sin este campo la vista no
  # puede contar por slot y acaba sumando las reservas dormidas: el panel de
  # cumplimiento pedia 4 336 mientras el ritmo y la cuota —que salen de
  # `tracked_df`— decian 3 743. Se publica el dato en vez de duplicar la logica
  # de `monitoreo_aulas_en_juego()` en el frontend.
  # El banco fuera: `course_status` trae el plan ENTERO, y sin excluirlo cada
  # aula extra forma su propia «cadena» y sale en juego. Medido: 210 en juego de
  # 236 —170 titulares mas 40 del banco— y una meta de 4 684 donde el motor dice
  # 3 743. Es el mismo conjunto que `tracked_df`, dicho fila a fila.
  rows$en_juego <- monitoreo_aulas_en_juego(rows) &
    as.character(rows$sample_role %||% "") != "extra_reserve_pool"

  cols <- intersect(c(
    "en_juego",
    # `sample_role` viaja con el estado por la misma razon que `sample_status`:
    # sin el, la vista no puede distinguir un titular de una reserva del banco.
    # Y lo necesita: `course_status` trae las 202 filas del plan, banco incluido,
    # asi que el panel de cumplimiento sumaba una meta de 4 476 mientras el del
    # ritmo —que sale de `tracked_df`, donde el banco NO esta— decia 4 336. Dos
    # metas distintas en la misma pantalla, y la vista sin forma de saber cual
    # fila sobraba. El banco eran esos 140.
    "sample_role",
    "operational_code", "titular_operational_code", "wave", "classroom_id",
    "course_name", "section", "schedule", "faculty", "program", "level",
    # La fecha agendada viaja con el estado. `schedule` es el texto corto que se
    # imprime en la ficha —«Lun 08:00»—; para agrupar por dia hace falta la
    # FECHA, que es lo que trae `FECHA DE APLICACION` del libro. Sin ella la
    # vista de agenda tendria que unir dos listas por codigo para saber que dia
    # es cada aula.
    "scheduled_date", "scheduled_day", "scheduled_time",
    # `sample_status` viaja con el estado porque el escalon de agendamiento sale
    # de el: sin publicarlo, la vista no puede explicar por que un aula esta en
    # «Agendada» o en «Reemplazada».
    "responsible", "collector_id", "sample_status", "operational_status", "application_state",
    "eligible_n", "expected_valid", "responses_total", "respuestas_validas",
    "filter_passed", "filter_rejected", "brecha", "link", "updated_at"
  ), names(rows))
  out <- rows[, cols, drop = FALSE]
  priority <- match(out$application_state, c("en_aplicacion", "lista", "pendiente", "cerrando"), nomatch = 5L)
  out <- out[order(priority, -out$brecha, out$faculty, out$schedule,
                   monitoreo_aulas_rango_codigo(out$operational_code)), , drop = FALSE]
  # El tope existe por el tamaño del payload —1,3 MB ya hoy— pero DECLARA lo que
  # deja fuera. Recortaba 500 en silencio: sobre un plan de 2 615 filas eso son
  # 2 115 aulas que no llegaban a la pantalla, y con la vista por facultad que
  # el estudio necesita faltarian facultades enteras sin que nada lo dijera.
  # El total viaja como atributo para que la vista pueda decir «500 de 2 615».
  # LOS DOS REPARTOS, calculados ANTES del recorte.
  #
  # «Status de aplicacion» y «Cursos-horario por cobertura» los contaba la vista
  # sobre estas mismas filas YA RECORTADAS a 500. Y el recorte no es una muestra
  # al azar: el orden de arriba pone `en_aplicacion` primero, asi que sobre un
  # plan de 2 615 los dos graficos habrian salido SESGADOS HACIA LO AVANZADO y
  # se leerian como si el operativo fuera mejor de lo que es. Declarar «500 de
  # 2 615» avisa del tamaño, no del sesgo.
  estados_conteo <- table(factor(
    out$application_state,
    levels = c("pendiente", "lista", "en_aplicacion", "cerrando", "reemplazada", "en_reserva")
  ))
  estados <- lapply(names(estados_conteo), function(k) {
    list(clave = k, aulas = as.integer(estados_conteo[[k]]))
  })
  # Un estado que no este en la lista NO se traga: `factor()` lo dejaria en NA y
  # el reparto sumaria menos aulas de las que hay sin que nada lo dijera, que es
  # el defecto que esta serie lleva persiguiendo. Se cuenta aparte.
  estados_desconocidos <- as.integer(sum(!(out$application_state %in% names(estados_conteo))))
  # La cobertura, en los mismos tramos que la vista: sin respuestas, 1-25, 26-50,
  # 51-99 y meta cumplida. Un aula sin meta declarada NO entra en el reparto y se
  # cuenta aparte, igual que en el cumplimiento.
  meta_cs <- suppressWarnings(as.numeric(out$expected_valid))
  val_cs <- suppressWarnings(as.numeric(out$respuestas_validas))
  meta_cs[!is.finite(meta_cs)] <- 0
  val_cs[!is.finite(val_cs)] <- 0
  # **El banco NO entra en el reparto de cobertura**, por el mismo motivo por el
  # que ya no entra en `brechas`: son aulas adicionales que esperan en su
  # estrato, no aulas que alguien vaya a visitar, y contarlas como «sin
  # respuestas» convierte el banco en alarma. Medido sobre el fixture, de las
  # 121 que salian «Sin respuestas» —la barra mas larga y la primera que mira el
  # ojo— 73 eran del banco.
  #
  # Se cuentan aparte para que la vista pueda nombrarlas: sacarlas del reparto y
  # no decir donde fueron deja al lector con dos totales que no cuadran.
  en_juego_cs <- !(tolower(trimws(as.character(out$sample_role %||% ""))) %in% "extra_reserve_pool")
  con_meta <- meta_cs > 0 & en_juego_cs
  razon <- ifelse(con_meta, val_cs / pmax(meta_cs, 1), NA_real_)
  tramo <- ifelse(is.na(razon), NA_character_,
           ifelse(razon <= 0, "sin_respuestas",
           ifelse(razon <= 0.25, "hasta_25",
           ifelse(razon <= 0.5, "hasta_50",
           ifelse(razon < 1, "hasta_99", "cumplida")))))
  claves_cob <- c("sin_respuestas", "hasta_25", "hasta_50", "hasta_99", "cumplida")
  cobertura <- lapply(claves_cob, function(k) {
    list(clave = k, aulas = as.integer(sum(tramo == k, na.rm = TRUE)))
  })

  recortado <- .monitoreo_aulas_records(out, max_rows = MONITOREO_AULAS_COURSE_STATUS_TOPE)
  attr(recortado, "total") <- nrow(out)
  attr(recortado, "estados") <- estados
  attr(recortado, "estados_desconocidos") <- estados_desconocidos
  attr(recortado, "cobertura") <- cobertura
  # Las que no declaran meta, contadas SOLO entre las que estan en juego: una
  # reserva del banco sin meta no es un dato que falte, es que no le toca.
  attr(recortado, "sin_meta") <- as.integer(sum(en_juego_cs & !(meta_cs > 0)))
  attr(recortado, "banco") <- as.integer(sum(!en_juego_cs))
  recortado
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
      # La columna se llama `observed` DESDE AQUI. Nombrarla `x` y renombrarla
      # despues dejaba el caso vacio sin renombrar —el `if` de abajo pide filas—,
      # asi que el merge salia sin columna `observed` y la linea siguiente
      # asignaba `integer(0)` a un data.frame con filas: 500 al abrir Monitoreo.
      # Se veia el primer dia de campo, con envios que aun no pasan el filtro.
      data.frame(faculty = character(0), sex = character(0), observed = integer(0), stringsAsFactors = FALSE)
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
  # El plan SEGUIDO: un aula por slot, no una por fila.
  #
  # Fuera el banco —los extras no reemplazan a nadie, son aulas adicionales para
  # cerrar la cuota por facultad— y fuera los eslabones dormidos de cada cadena:
  # de `CH 5` -> `R 5.1` -> `R 5.2` solo una esta en juego a la vez. Contarlas
  # todas contaba el mismo slot tantas veces como respaldos tuviera. Medido sobre
  # HSVG2026: 2 615 filas -> 1 976 sin banco -> 202 en juego, y la meta pasa de
  # 84 110 a 6 901, que es lo que el estudio pide de verdad.
  seguidas <- plan_df[plan_df$sample_role != "extra_reserve_pool", , drop = FALSE]
  if (!nrow(seguidas)) seguidas <- plan_df
  tracked_df <- seguidas[monitoreo_aulas_en_juego(seguidas), , drop = FALSE]
  if (!nrow(tracked_df)) tracked_df <- seguidas
  course_status <- .monitoreo_aulas_course_status(plan_df, responses, cfg, valid_response, response_classroom)
  # Sobre `tracked_df`, no sobre el plan entero: la cuota cuenta las PERSONAS que
  # hay que recoger, y las del banco no se van a recoger —son respaldo del
  # estrato—. Con el plan entero, la tarjeta «Cuota por recoger» presidia Avance
  # con 4 476 mientras los dos paneles de debajo decian 4 336: los 140 del banco,
  # otra vez, y en la unica cifra que se lee sin bajar la vista.
  quotas_sex_faculty <- .monitoreo_aulas_quota_sex_faculty(tracked_df, responses, cfg, valid_response, response_classroom)

  # POR FACULTAD, en el motor y no en la vista.
  #
  # El perfil por facultad se calculaba en el frontend sobre `course_status`, que
  # viaja RECORTADO a 500 filas de 2 615 y ademas incluye las reservas dormidas:
  # el panel que contesta «¿como va Derecho?» estaba midiendo un subconjunto
  # arbitrario. Aqui sale del mismo `tracked_df` que las demas cifras de avance
  # —un aula por slot, sin banco—, asi que las cuatro cuentan lo mismo.
  #
  # Es la unidad con la que se dirige el operativo: «todo debe ser por facultad».
  # El estrato —facultad/sexo/tamaño— sigue publicandose aparte porque es la
  # unidad del DISEÑO, y no son la misma pregunta.
  avance_por_facultad <- stats::aggregate(
    cbind(aulas = rep(1L, nrow(tracked_df)),
          respuestas_validas = tracked_df$respuestas_validas,
          brecha = tracked_df$brecha,
          meta = suppressWarnings(as.numeric(tracked_df$expected_valid))) ~ faculty,
    data = tracked_df,
    FUN = function(x) sum(x, na.rm = TRUE)
  )
  # La que mas lejos esta de su meta primero: es a donde va el equipo mañana.
  avance_por_facultad <- avance_por_facultad[order(-avance_por_facultad$brecha,
                                                   avance_por_facultad$faculty), , drop = FALSE]

  # EL CUMPLIMIENTO EN RESPUESTAS, tambien en el motor.
  #
  # Lo sumaba el frontend sobre `course_status`, que viaja RECORTADO a 500 filas.
  # Sobre este fixture no se notaba —236 filas, ningun recorte— y sobre el
  # estudio real de 2 615 el panel habria enseñado la meta, lo cubierto y lo que
  # falta de un subconjunto arbitrario de 500, presentado como el total del
  # estudio. Es el MISMO defecto que ya obligo a mover el perfil por facultad
  # aqui arriba, y la misma reparacion.
  #
  # `cubierto` se satura por aula: recoger de mas en un aula no cubre la falta de
  # otra, que es la trampa que ya tenia la cuota. Un aula sin meta declarada no
  # entra en el denominador —su avance no esta definido— y se cuenta aparte para
  # que el descarte se vea.
  .aulas_num <- function(x) {
    v <- suppressWarnings(as.numeric(x))
    ifelse(is.finite(v), v, 0)
  }
  .meta_por_aula <- .aulas_num(tracked_df$expected_valid)
  .validas_por_aula <- .aulas_num(tracked_df$respuestas_validas)
  .con_meta <- .meta_por_aula > 0
  cumplimiento_respuestas <- list(
    meta = sum(.meta_por_aula[.con_meta]),
    validas = sum(.validas_por_aula),
    cubierto = sum(pmin(.validas_por_aula[.con_meta], .meta_por_aula[.con_meta])),
    excedente = sum(pmax(0, .validas_por_aula[.con_meta] - .meta_por_aula[.con_meta])),
    falta = sum(pmax(0, .meta_por_aula[.con_meta] - .validas_por_aula[.con_meta])),
    aulas_con_brecha = sum(.validas_por_aula[.con_meta] < .meta_por_aula[.con_meta]),
    sin_meta = sum(!.con_meta)
  )

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
  # POR BRECHA, igual que su grafico. `aggregate()` devuelve los estratos en
  # orden alfabetico, asi que el panel salia con el GRAFICO ordenado por lo que
  # falta —Ciencias 438, Letras 375, Gestion 336…— y la TABLA de debajo por
  # nombre —Arquitectura, Ciencias, Derecho…—. Dos ordenes para las mismas seis
  # filas en el mismo panel obligan a rebuscar cada estrato al pasar de uno a
  # otra. El grafico manda porque es lo que el panel promete: donde falta mas.
  advance <- advance[order(-advance$brecha, advance$stratum), , drop = FALSE]

  brechas <- tracked_df[tracked_df$brecha > 0 | tracked_df$operational_status %in% c("sin_acceso", "cancelada", "reemplazo_pendiente"), , drop = FALSE]
  # `brechas` es un REPORTE, no una tercera copia del plan. Salia con las ~40
  # columnas de `tracked_df`, asi que con 196 aulas —todas con brecha abierta el
  # primer dia— pesaba 337 KB de un payload de 1220: tanto como el plan entero,
  # que ademas ya viaja dos veces. Su tabla muestra ocho columnas y la
  # publicacion a Sheets toma diez.
  #
  # Las columnas son la UNION de lo que sus dos consumidores piden, y estan
  # cubiertas por test: un consumidor nuevo que necesite otra la añade aqui y lo
  # ve fallar, en vez de recibir NULL en silencio —que es el patron que ya costo
  # doce items de esta cola—.
  brechas <- brechas[, intersect(BRECHAS_COLUMNAS_PUBLICADAS, names(brechas)), drop = FALSE]
  # POR BRECHA, de mayor a menor. El filtro nunca ordenaba, asi que la lista
  # salia en el orden del plan —CH 1, CH 2, CH 3…— y el panel existe para decir
  # a quien ir primero. Medido sobre el operativo: abria con 15, 15, 16, 17 y la
  # mayor de todas, 31, estaba en la fila 24.
  #
  # `course_status` YA se ordena por `-brecha`: el mismo hecho estaba ordenado en
  # un bloque y sin ordenar en el otro.
  if (nrow(brechas)) {
    # Desempate por codigo NATURAL: como texto, «CH 10» iba antes que «CH 2».
    orden <- order(-brechas$brecha, monitoreo_aulas_rango_codigo(brechas$operational_code))
    brechas <- brechas[orden, , drop = FALSE]
  }
  # La cadena de reemplazos son las reservas Y las aulas que cayeron.
  #
  # Faltaba el eje de MUESTRA, que es donde vive el reemplazo. Con solo
  # `operational_status` —el eje de la aplicacion, que llena el registro de
  # campo— un aula marcada `REEMPLAZADA` en STATUS MUESTRA no entraba: medido
  # sobre el operativo, 24 titulares caidos y CERO de ellos en la tabla, que
  # mostraba 26 filas y las 26 eran reservas. La consulta se llama «cadena» y no
  # se podia ver junto a que reserva cayo cada aula. Mismo defecto que «Sin
  # agendar»: el rotulo promete un eje y el filtro lee el otro.
  # La lista de reemplazos sale de `seguidas` y NO de `tracked_df`: son dos
  # preguntas distintas sobre el mismo plan. Contar quiere UNA fila por slot —el
  # eslabon en juego—; contar la HISTORIA de un reemplazo quiere las dos, el
  # aula que cayo y la que entro. Al armar las dos desde `tracked_df`, el aula
  # caida desaparecia de su propia cadena y el guard lo cazo.
  replacements <- seguidas[
    nzchar(seguidas$replacement_for)
    | seguidas$operational_status %in% c("reemplazada", "reemplazo_pendiente")
    | seguidas$sample_status %in% "reemplazada", , drop = FALSE]
  # Por que esta cada fila en esta lista, en UNA columna.
  #
  # El motivo vive en un campo distinto segun el papel —`replacement_reason` en
  # la que cae, `activation_reason` en la que entra— y la tabla mostraba solo el
  # primero: sobre filas de reserva, una columna que NUNCA puede llenarse. Se
  # resuelve aqui y no en la vista para que las dos superficies que lo lean
  # digan lo mismo.
  if (nrow(replacements)) {
    cae <- replacements$sample_status %in% "reemplazada" |
      replacements$operational_status %in% c("reemplazada", "reemplazo_pendiente")
    replacements$motivo <- ifelse(
      cae,
      as.character(replacements$replacement_reason %||% ""),
      as.character(replacements$activation_reason %||% "")
    )
    replacements$motivo[is.na(replacements$motivo)] <- ""
  }
  # Sobre `seguidas`: la representatividad compara la muestra efectiva con la
  # planificada, y la planificada incluye las reservas que el diseño compro.
  representativity <- .monitoreo_aulas_effective_representativity(seguidas, cfg)

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

  # El parte de campo llega de su propia hoja, no del plan: vive aparte en la
  # sesion justo para no perder de cual medida viene cada numero.
  partes_campo <- cfg$partes_campo %||% list()
  descuadres <- monitoreo_aulas_reconciliacion_partes(partes_campo)

  # El criterio de validez se resolvia en silencio, y contar TODO o filtrar por
  # una columna equivocada dan numeros muy distintos.
  criterio <- monitoreo_aulas_criterio_validez(responses, cfg)
  quota_status <- vapply(quotas_sex_faculty, function(row) .monitoreo_scalar(row$status %||% "", ""), character(1))
  # Las dos hojas del libro cuentan la misma aula en dos momentos y nadie las
  # comparaba: el cuadre de arriba mira la aritmetica DENTRO del parte.
  cruce <- monitoreo_aulas_cruce_hojas(partes_campo, cfg$control %||% list())
  # Sobre el plan CRUDO a proposito: `monitoreo_aulas_estado_muestra()` ya
  # convirtio en `sin_contactar` todo lo que no reconoce, asi que preguntarselo
  # al plan normalizado devolveria cero siempre.
  estados_raros <- monitoreo_aulas_estados_no_reconocidos(plan %||% cfg$plan %||% list())
  validation <- data.frame(
    check = c("anonymous_responses", "student_id_required", "unmapped_valid_responses", "duplicate_responses", "effective_representativity", "sex_faculty_quota", "field_report_reconciliation", "book_sheets_cross_check", "unnamed_control_columns", "unknown_sample_status", "valid_response_criterion"),
    status = c(
      if (isTRUE(cfg$anonymous_responses)) "ok" else "review",
      "ok",
      if (any(huerfanas)) "warning" else "ok",
      # **«No se puede comprobar» NO es «correcto».**
      #
      # Sin columna de identificador de respuesta este control no mira nada, y
      # aun asi se contaba entre los correctos: la pantalla decia «6 correctos»
      # donde uno de los seis declaraba en su propio texto que no habia podido
      # comprobarse. Es el «verde por AUSENCIA» que el Contrato de Superficie
      # prohibe, cometido dentro de la propia lista de validacion.
      if (!nzchar(respuesta_id_col)) "sin_datos"
      else if (respuestas_repetidas > 0L) "review" else "ok",
      # El estado mira el PUNTAJE, no solo el aviso extremo. Antes solo se
      # miraba `warning`, que exige 10 pp de desvio en una sola celda, asi que
      # un puntaje de 0 sobre 100 —la peor representatividad que la escala puede
      # expresar— se mostraba como «Correcto».
      .monitoreo_aulas_representatividad_estado(representativity),
      if (length(quota_status) && any(quota_status %in% c("pendiente", "en_riesgo"))) "warning" else "ok",
      # El Excel no comprueba que asistentes - rechazos - duplicados cuadre con
      # las efectivas. Son pocos casos y por eso nadie los ve a ojo en una hoja
      # de 101 columnas.
      if (length(descuadres)) "review" else "ok",
      # El cruce entre las dos hojas. `ok` cuando coinciden Y cuando no hay con
      # que comparar no se finge que cuadran: eso se dice en el detalle.
      if (length(cruce$hallazgos)) "review" else "ok",
      # Columnas de «Base de control» con datos que la cabecera no bautiza. No
      # es un fallo del lector —adivinar seria peor— pero es informacion del
      # equipo que no entra, y hasta ahora nadie lo decia.
      if ((cfg$control_sin_nombre %||% 0L) > 0L) "review" else "ok",
      # STATUS MUESTRA con valores que el lector no reconoce. `review` y no
      # `warning` porque se arregla en la hoja o añadiendo el estado, no en
      # campo.
      if (estados_raros$total > 0L) "review" else "ok",
      # Que criterio de validez se aplico. `review` cuando el estudio declaro
      # una columna que la base no trae —un error de tipeo en la config pasaba
      # por criterio deliberado— y cuando no hay columna y por tanto cuenta
      # TODO, que es una decision que conviene tomar a sabiendas.
      switch(criterio$modo, declarada_ausente = "review", sin_columna = "review", "ok")
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
      .monitoreo_aulas_representatividad_texto(representativity),
      if (length(quota_status)) sprintf("%s celdas sexo x facultad con brecha.", sum(quota_status %in% c("pendiente", "en_riesgo"))) else "Sin cuota sexo x facultad detectable.",
      if (length(descuadres)) {
        paste(vapply(utils::head(descuadres, 3), monitoreo_aulas_descuadre_texto, character(1)), collapse = " ")
      } else if (length(partes_campo)) {
        "Los numeros de cada parte de campo cuadran."
      } else {
        "No hay partes de campo que comprobar."
      },
      if (length(cruce$hallazgos)) {
        sprintf(
          "%s%s",
          paste(vapply(utils::head(cruce$hallazgos, 3), monitoreo_aulas_cruce_texto, character(1)), collapse = " "),
          if (length(cruce$hallazgos) > 3L) {
            restantes <- length(cruce$hallazgos) - 3L
            sprintf(" Y %d discrepancia%s mas.", restantes, if (restantes == 1L) "" else "s")
          } else ""
        )
      } else if (cruce$comparables > 0L) {
        sprintf(
          "Las %d aulas que estan en las dos hojas dicen lo mismo en asistentes, %% de asistencia y quien aplico.",
          cruce$comparables
        )
      } else {
        "Ninguna aula esta en las dos hojas a la vez, asi que no hay nada que cruzar."
      },
      if ((cfg$control_sin_nombre %||% 0L) > 0L) {
        sprintf(
          "%d columnas de la Base de control tienen datos pero su cabecera esta vacia en el Excel, asi que no se leyeron. Ponles nombre en la hoja para que entren.",
          cfg$control_sin_nombre
        )
      } else {
        "Todas las columnas con datos de la Base de control tienen nombre."
      },
      monitoreo_aulas_estados_no_reconocidos_texto(estados_raros),
      monitoreo_aulas_criterio_texto(criterio)
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
      # INVENTARIO, no conteo de slots: la tarjeta dice «titulares y reservas del
      # plan» y eso es lo que cuenta. Un slot con once respaldos sigue siendo un
      # slot para la meta, pero el plan tiene doce aulas y decir 1 seria mentir
      # sobre lo que se compro. Las cifras que miden AVANCE —brechas, metas,
      # cuota, ritmo— si van por slot, sobre `tracked_df`.
      total_aulas = as.integer(nrow(seguidas)),
      aulas_titulares = as.integer(sum(seguidas$wave == "M1")),
      aulas_aplicadas = as.integer(sum(seguidas$operational_status %in% c("aplicada", "cerrada"))),
      aulas_parciales = as.integer(sum(seguidas$operational_status == "parcial")),
      # Reemplazos GASTADOS: cuenta reservas que entraron, asi que necesita ver
      # la cadena entera y no solo el eslabon en juego.
      reemplazos_usados = as.integer(sum(nzchar(seguidas$replacement_for) & seguidas$operational_status %in% c("agendada", "en_campo", "aplicada", "cerrada", "parcial"))),
      respuestas_validas = as.integer(sum(valid_response)),
      respuestas_total = as.integer(length(response_classroom)),
      filter_passed = as.integer(sum(.monitoreo_aulas_filter_passed(responses, valid_response), na.rm = TRUE)),
      filter_rejected = as.integer(max(0L, length(response_classroom) - sum(.monitoreo_aulas_filter_passed(responses, valid_response), na.rm = TRUE))),
      # Sobre `tracked_df` y no sobre `plan_df`, que es el plan ENTERO. Eran dos
      # denominadores para la misma palabra: este KPI contaba 2 615 sobre el
      # estudio real mientras la lista `brechas` que resume —construida unas
      # lineas mas abajo, sobre `tracked_df`— traia 1 976. La diferencia son las
      # 639 reservas del BANCO, que no cuelgan de ningun titular y son respaldo
      # del estrato, no aulas que alguien vaya a visitar: contarlas como aulas
      # por debajo de su meta convertia el banco en deuda.
      brechas = as.integer(sum(tracked_df$brecha > 0)),
      quota_cells = as.integer(length(quotas_sex_faculty)),
      quota_cells_ok = as.integer(sum(quota_status == "cumplida")),
      quota_cells_pending = as.integer(sum(quota_status %in% c("pendiente", "en_riesgo"))),
      representativity_effective_score = representativity$effective_score,
      representativity_score_loss = representativity$score_loss
    ),
    agenda = .monitoreo_aulas_records(plan_df),
    course_status = course_status,
    # Cuantas hay DE VERDAD. Sin esto, `course_status` de 500 sobre un plan de
    # 2 615 se leia como «el estudio tiene 500 aulas».
    course_status_total = as.integer(attr(course_status, "total") %||% length(course_status)),
    # Los dos repartos que la vista sumaba sobre el payload recortado.
    course_status_estados = attr(course_status, "estados") %||% list(),
    course_status_estados_desconocidos = as.integer(attr(course_status, "estados_desconocidos") %||% 0L),
    course_status_cobertura = attr(course_status, "cobertura") %||% list(),
    course_status_sin_meta = as.integer(attr(course_status, "sin_meta") %||% 0L),
    # Cuantas del reparto son banco. La vista las nombra en vez de dejar dos
    # totales que no cuadran entre la cabecera y el pie.
    course_status_banco = as.integer(attr(course_status, "banco") %||% 0L),
    # El BANCO de extras. No es una tercera copia del plan: es el segundo nivel
    # de respaldo —reservas que no cuelgan de ningun titular, repartidas por
    # estrato— y hasta ahora no se veia en ninguna pantalla, asi que cuando una
    # cadena se agotaba entera nadie sabia de donde sacar sin descuadrar la
    # composicion. Agregado por facultad porque esa es la pregunta que se hace
    # primero: «¿de esta facultad me queda algo, y con cuantas mujeres?».
    banco_extras = monitoreo_aulas_banco_extras(plan),
    avance_por_estrato = .monitoreo_aulas_records(advance),
    avance_por_facultad = .monitoreo_aulas_records(avance_por_facultad),
    # El denominador del avance, calculado sobre el conjunto EN JUEGO y entero:
    # la vista lo sumaba sobre un payload recortado a 500 filas.
    cumplimiento_respuestas = cumplimiento_respuestas,
    # El eje de TIEMPO, que aulas no tenia y los otros perfiles llevan desde
    # hace tiempo. La meta viaja con la serie para que la vista no tenga que
    # recomponerla desde otro bloque del payload.
    ritmo_diario = monitoreo_aulas_ritmo_diario(
      responses, valid_response,
      meta = sum(suppressWarnings(as.numeric(tracked_df$expected_valid)), na.rm = TRUE)
    ),
    quotas_sex_faculty = quotas_sex_faculty,
    brechas = .monitoreo_aulas_records(brechas),
    reemplazos = .monitoreo_aulas_records(replacements),
    # El parte de campo entero, no solo lo que no cuadra. El control de
    # Validacion nombraba las aulas descuadradas y no habia donde ir a mirarlas;
    # y lo que el equipo anota en la hoja «Aulas Aplicadas (Campo)» no se veia
    # en ninguna tabla. La resta la calcula el mismo helper que decide el
    # descuadre, asi que la tabla y el aviso no pueden discrepar.
    partes_campo = monitoreo_aulas_partes_publicados(partes_campo),
    # La tercera hoja del operativo. Viajaba de la importacion a la sesion y ahi
    # moria: sus 25 campos propios —validadores, cortas y largas, umbrales 70T y
    # 70P, cuota por sexo del aula, rango horario— no llegaban a ninguna
    # superficie. El resumen acompana a las filas para que la vista pueda decir
    # que grupo del control viene vacio en vez de pintar ceros medidos.
    # Con la facultad adosada desde el plan: la hoja del equipo no la trae y sin
    # ella la cola de trabajo solo puede ordenarse por aula suelta, cuando el
    # equipo sale por facultad. El cruce cuenta lo que cruza —`sin_cruce` viaja
    # en el resumen— porque un homonimo ya se hizo pasar por conexion en este
    # mismo perfil.
    control_calidad = monitoreo_aulas_control_con_facultad(
      monitoreo_aulas_control_publicado(cfg$control %||% list()),
      plan %||% cfg$plan %||% list()
    )$filas,
    control_calidad_resumen = monitoreo_aulas_control_resumen(cfg$control %||% list()),
    # De que libro salen estas cifras y que hojas trajo. `NULL` cuando el
    # estudio nunca importo uno, que es distinto de un libro sin hojas.
    libro = monitoreo_aulas_libro_recibo(cfg$libro, plan),
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

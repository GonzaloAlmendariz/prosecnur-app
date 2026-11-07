# Casos «Sin respuesta» del cruce de acreditación, armados por columnas.
#
# `.monitoreo_acreditacion_internal_queries_impl` arma un caso por persona del
# universo. Las que no respondieron —casi todo el universo al empezar el campo—
# llevaban cada una su propio registro de 46 campos, 36 de ellos constantes, y
# `.monitoreo_internal_records_to_df` volvía a recorrer los 46 campos de cada
# fila. Medido en Acreditación Institucional PUCP 2026 (29/10/2026, 45 120
# personas): la bandeja entera costaba 75 s de CPU y `advance_summary` ~200 s.
#
# Aquí la fila se arma una vez como prototipo con la misma llamada de antes y
# sólo los campos que cambian por persona se leen persona por persona. El
# `data.frame` resultante es idéntico al de antes (mismas columnas, tipos y
# orden: primero los casos con respuesta, luego la base sin respuesta en el
# orden de `base_records`). Si una persona trae un valor que no es un escalar,
# todo el bloque vuelve al camino fila por fila, que se comporta como siempre.

.monitoreo_internal_pending_case_row <- function(base, person) {
  .monitoreo_internal_case_row(
    actor = base$actor %||% "",
    person_label = person,
    case_key = base$key %||% "",
    response_id = "",
    date = base$date %||% "Sin fecha",
    response_datetime = "",
    source_id = base$source_id %||% "",
    source_label = base$source %||% "",
    channel = base$channel %||% "",
    collector_id = "",
    collector_name = base$responsible %||% "Sin responsable",
    collector_type = "",
    platform_state = "Sin respuesta",
    base_result = "Cruzó",
    base_record = base$identifier %||% "",
    base_source = base$source %||% "",
    base_status = base$status %||% "",
    decision = "Pendiente de respuesta",
    decision_reason = "Existe en la base del corte y no tiene respuesta de plataforma reconciliada.",
    advancement = "pending",
    issue_type = "sin_respuesta",
    rule = "Caso en base sin respuesta reconciliada; queda para seguimiento operativo.",
    pending_exit = FALSE,
    recovery_collector = FALSE,
    response_row = NA_integer_,
    partial_answered_questions = 0L,
    partial_total_questions = 0L,
    partial_completion_pct = 0L,
    partial_last_question = "",
    partial_next_question = "",
    duplicate_group_key = "",
    duplicate_group_size = 1L,
    counts_in_advance = FALSE,
    duplicate_counting_status = "",
    identity_status = "pendiente_base",
    identity_label = .monitoreo_internal_identity_label("pendiente_base"),
    channel_key_strategy = "base_sin_respuesta",
    channel_key_strategy_label = "Base sin respuesta",
    primary_identity_label = "Llave en base",
    primary_identity_value = base$key %||% "",
    secondary_identity_label = "Responsable",
    secondary_identity_value = base$responsible %||% "",
    review_priority = 10L,
    phone_audit = I(list(list())),
    assisted_review = I(list(list())),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
}

.monitoreo_internal_pending_person <- function(base) {
  person <- base$person %||% ""
  if (!nzchar(person)) person <- base$identifier %||% base$value %||% base$key %||% ""
  person
}

# Personas de la base que siguen sin respuesta reconciliada, en su orden.
.monitoreo_internal_pending_bases <- function(base_records, answered_base_rows, answered_base_keys) {
  unname(Filter(function(base) {
    base_row <- .monitoreo_scalar(base$row %||% "", "")
    if (nzchar(base_row)) return(!base_row %in% answered_base_rows)
    base_keys <- unlist(base$all_keys %||% list(base$key %||% ""), use.names = FALSE)
    base_keys <- unique(base_keys[nzchar(base_keys)])
    !(length(base_keys) && any(base_keys %in% answered_base_keys))
  }, base_records))
}

# Campos de la fila pendiente que cambian por persona, con el valor que les da
# la fila (mismas expresiones que `.monitoreo_internal_pending_case_row`).
.monitoreo_internal_pending_varying <- list(
  actor = function(base, person) base$actor %||% "",
  person_label = function(base, person) person,
  case_key = function(base, person) base$key %||% "",
  date = function(base, person) base$date %||% "Sin fecha",
  source_id = function(base, person) base$source_id %||% "",
  source_label = function(base, person) base$source %||% "",
  channel = function(base, person) base$channel %||% "",
  collector_name = function(base, person) base$responsible %||% "Sin responsable",
  base_record = function(base, person) base$identifier %||% "",
  base_source = function(base, person) base$source %||% "",
  base_status = function(base, person) base$status %||% "",
  primary_identity_value = function(base, person) base$key %||% "",
  secondary_identity_value = function(base, person) base$responsible %||% ""
)

#' Casos pendientes de la base: por columnas cuando todas las personas traen
#' escalares; si no, las filas de siempre.
#'
#' Devuelve `list(n, columnas)` (columnas = valores por fila, listos para
#' `.monitoreo_internal_columns_to_df`) o `list(n, filas)`.
.monitoreo_internal_pending_cases <- function(base_records, answered_base_rows, answered_base_keys) {
  bases <- .monitoreo_internal_pending_bases(base_records, answered_base_rows, answered_base_keys)
  n <- length(bases)
  if (!n) return(list(n = 0L, columnas = NULL))
  personas <- lapply(bases, .monitoreo_internal_pending_person)
  variables <- lapply(.monitoreo_internal_pending_varying, function(campo) {
    Map(campo, bases, personas)
  })
  escalar <- function(value) is.atomic(value) && length(value) == 1L && !is.list(value)
  if (!all(vapply(variables, function(valores) all(vapply(valores, escalar, logical(1))), logical(1)))) {
    return(list(n = n, filas = Map(.monitoreo_internal_pending_case_row, bases, personas)))
  }
  prototipo <- .monitoreo_internal_normalize_records(list(.monitoreo_internal_pending_case_row(bases[[1L]], personas[[1L]])))[[1L]]
  columnas <- lapply(stats::setNames(names(prototipo), names(prototipo)), function(col) {
    if (!is.null(variables[[col]])) return(unname(variables[[col]]))
    rep(list(prototipo[[col]]), n)
  })
  list(n = n, columnas = columnas)
}

#' `cases_df` del cruce: los casos con respuesta (filas) más los pendientes.
.monitoreo_internal_cases_df <- function(cases, pendientes) {
  if (!is.null(pendientes$filas)) return(.monitoreo_internal_records_to_df(c(cases, pendientes$filas)))
  if (is.null(pendientes$columnas)) return(.monitoreo_internal_records_to_df(cases))
  columnas <- pendientes$columnas
  if (length(cases)) {
    filas <- .monitoreo_internal_normalize_records(cases)
    cols <- names(filas[[1L]])
    for (fila in filas) {
      if (length(fila) != length(cols) || !all(names(fila) %in% cols)) stop("names do not match previous names", call. = FALSE)
    }
    if (length(columnas) != length(cols) || !all(names(columnas) %in% cols)) stop("names do not match previous names", call. = FALSE)
    columnas <- lapply(stats::setNames(cols, cols), function(col) c(lapply(filas, function(fila) fila[[col]]), columnas[[col]]))
  }
  .monitoreo_internal_columns_to_df(columnas)
}

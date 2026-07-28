.monitoreo_normalize_model_units <- function(units = list()) {
  items <- .monitoreo_normalize_profile_list(units)
  normalized <- list()
  used_ids <- character(0)

  for (i in seq_along(items)) {
    item <- items[[i]]
    if (!is.list(item)) next

    id <- trimws(.monitoreo_scalar(item$id %||% item$unidad, ""))
    label <- trimws(.monitoreo_scalar(item$label %||% item$etiqueta %||% item$unidad, ""))
    actor <- trimws(.monitoreo_scalar(item$actor, ""))
    if (!nzchar(actor)) actor <- if (nzchar(label)) label else id
    if (!nzchar(label)) label <- actor
    if (!nzchar(id)) id <- .monitoreo_safe_name(if (nzchar(actor)) actor else label)
    if (!nzchar(id)) id <- paste0("actor_", i)

    # La lectura legacy debe ser determinista incluso si el perfil antiguo
    # repitio una llave.
    base_id <- id
    suffix <- 2L
    while (id %in% used_ids) {
      id <- paste0(base_id, "_", suffix)
      suffix <- suffix + 1L
    }
    used_ids <- c(used_ids, id)

    phone <- item$phone %||% item$telefono %||% list()
    if (!is.list(phone)) phone <- list()
    phone_enabled <- .monitoreo_bool(phone$enabled %||% phone$activo, FALSE)
    unit_type <- trimws(.monitoreo_scalar(item$type %||% item$tipo, "actor"))
    if (!nzchar(unit_type)) unit_type <- "actor"

    normalized[[length(normalized) + 1L]] <- list(
      id = id,
      type = unit_type,
      actor = actor,
      label = label,
      segment = trimws(.monitoreo_scalar(item$segment %||% item$segmento, "")),
      group = trimws(.monitoreo_scalar(item$group %||% item$grupo, "")),
      phone = list(
        enabled = phone_enabled,
        role = if (isTRUE(phone_enabled)) "target" else "none"
      )
    )
  }

  normalized
}

.monitoreo_source_channel_is_phone <- function(channel = "") {
  identical(.monitoreo_text_key(.monitoreo_scalar(channel, "")), "telefonico")
}

.monitoreo_source_rows_enabled <- function(data = NULL, sources = list()) {
  if (is.null(data) || !is.data.frame(data)) return(logical(0))
  enabled <- rep(TRUE, nrow(data))
  if (!nrow(data) || !".source_id" %in% names(data)) return(enabled)

  enabled_by_id <- list()
  for (source in sources) {
    if (!is.list(source)) next
    source_id <- trimws(.monitoreo_scalar(source$id, ""))
    if (!nzchar(source_id)) next
    enabled_by_id[[source_id]] <- .monitoreo_bool(source$enabled %||% source$activo, TRUE)
  }
  source_ids <- trimws(as.character(data$.source_id %||% ""))
  for (i in which(nzchar(source_ids))) {
    source_id <- source_ids[[i]]
    if (source_id %in% names(enabled_by_id)) enabled[[i]] <- isTRUE(enabled_by_id[[source_id]])
  }
  enabled
}

.monitoreo_source_declared_actor_units <- function(data = NULL, strategy_units = list()) {
  if (is.null(data) || !is.data.frame(data)) data <- data.frame()
  declared <- list()

  add_declaration <- function(actor, channel = "") {
    actor <- trimws(.monitoreo_scalar(actor, ""))
    if (!nzchar(actor)) return(invisible(NULL))
    key <- .monitoreo_safe_name(actor)
    if (!nzchar(key)) return(invisible(NULL))
    current <- declared[[key]] %||% list(actor = actor, phone = FALSE)
    current$phone <- isTRUE(current$phone) || .monitoreo_source_channel_is_phone(channel)
    declared[[key]] <<- current
    invisible(NULL)
  }

  # La declaración original de Fuentes es la autoridad incluso cuando una
  # fuente todavía no aportó filas al snapshot. El atributo se adjunta al
  # aplicar metadata y evita convertir ausencia de datos en ausencia de actor.
  sources <- attr(data, "monitoreo_sources", exact = TRUE) %||% list()
  source_contract_present <- length(sources) > 0L || any(c(
    "dim_actor", ".dim_actor", ".source_actor", "source_actor"
  ) %in% names(data))
  for (source in sources) {
    if (!is.list(source)) next
    if (!.monitoreo_bool(source$enabled %||% source$activo, TRUE)) next
    dimensions <- source$dimensions %||% source$dimensiones %||% list()
    if (!is.list(dimensions)) dimensions <- list()
    add_declaration(
      dimensions$actor %||% dimensions$unidad,
      dimensions$canal %||% dimensions$channel
    )
  }

  # Snapshots anteriores no guardaban el atributo, pero sí las dimensiones
  # materializadas por fuente. Solo esos campos técnicos son válidos aquí:
  # columnas libres llamadas Actor/Canal no constituyen una declaración.
  first_values <- function(candidates) {
    matches <- intersect(candidates, names(data))
    if (!length(matches)) return(rep("", nrow(data)))
    out <- rep("", nrow(data))
    for (column in matches) {
      values <- trimws(as.character(data[[column]] %||% ""))
      values[is.na(values)] <- ""
      take <- !nzchar(out) & nzchar(values)
      out[take] <- values[take]
    }
    out
  }
  actors <- first_values(c("dim_actor", ".dim_actor", ".source_actor", "source_actor"))
  channels <- first_values(c("dim_canal", ".dim_canal", ".source_channel", "source_channel"))
  enabled_rows <- .monitoreo_source_rows_enabled(data, sources)
  if (length(actors)) {
    for (i in which(enabled_rows)) add_declaration(actors[[i]], channels[[i]])
  }

  strategies <- .monitoreo_normalize_model_units(strategy_units)
  strategy_by_actor <- list()
  for (unit in strategies) {
    actor_key <- .monitoreo_safe_name(.monitoreo_scalar(unit$actor, ""))
    if (nzchar(actor_key) && is.null(strategy_by_actor[[actor_key]])) {
      strategy_by_actor[[actor_key]] <- unit
    }
  }

  used_ids <- character(0)
  out <- lapply(names(declared), function(key) {
    item <- declared[[key]]
    strategy <- strategy_by_actor[[key]] %||% list()
    id <- .monitoreo_safe_name(item$actor)
    if (!nzchar(id)) id <- "actor"
    base_id <- id
    suffix <- 2L
    while (id %in% used_ids) {
      id <- paste0(base_id, "_", suffix)
      suffix <- suffix + 1L
    }
    used_ids <<- c(used_ids, id)
    phone_enabled <- isTRUE(item$phone)
    list(
      id = id,
      type = .monitoreo_scalar(strategy$type, "actor"),
      actor = item$actor,
      label = item$actor,
      segment = .monitoreo_scalar(strategy$segment, ""),
      group = .monitoreo_scalar(strategy$group, ""),
      phone = list(
        enabled = phone_enabled,
        role = if (phone_enabled) "target" else "none"
      )
    )
  })
  attr(out, "source_contract_present") <- source_contract_present
  out
}

.monitoreo_source_declared_actor_values <- function(data = NULL) {
  if (is.null(data) || !is.data.frame(data) || !nrow(data)) return(character(0))
  sources <- attr(data, "monitoreo_sources", exact = TRUE) %||% list()
  enabled_rows <- .monitoreo_source_rows_enabled(data, sources)
  out <- rep("", nrow(data))
  for (column in intersect(c("dim_actor", ".dim_actor", ".source_actor", "source_actor"), names(data))) {
    values <- trimws(as.character(data[[column]] %||% ""))
    values[is.na(values)] <- ""
    take <- !nzchar(out) & nzchar(values)
    out[take] <- values[take]
  }
  out[!enabled_rows] <- ""

  source_actor <- list()
  for (source in sources) {
    if (!is.list(source)) next
    if (!.monitoreo_bool(source$enabled %||% source$activo, TRUE)) next
    source_id <- trimws(.monitoreo_scalar(source$id, ""))
    dimensions <- source$dimensions %||% source$dimensiones %||% list()
    actor <- if (is.list(dimensions)) trimws(.monitoreo_scalar(dimensions$actor %||% dimensions$unidad, "")) else ""
    if (nzchar(source_id) && nzchar(actor)) source_actor[[source_id]] <- actor
  }
  if (length(source_actor) && ".source_id" %in% names(data)) {
    source_ids <- trimws(as.character(data$.source_id %||% ""))
    for (i in which(!nzchar(out))) out[[i]] <- source_actor[[source_ids[[i]]]] %||% ""
  }
  out
}

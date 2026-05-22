# Motor de Monitoreo Digital.

.monitoreo_now_iso <- function() {
  format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
}

.monitoreo_scalar <- function(x, default = "") {
  if (is.null(x) || length(x) == 0L) return(default)
  out <- as.character(x)[1]
  if (is.na(out)) default else out
}

.monitoreo_chr_vec <- function(x) {
  if (is.null(x)) return(character(0))
  if (is.data.frame(x)) x <- unlist(x, use.names = FALSE)
  if (is.list(x)) x <- unlist(x, use.names = FALSE)
  out <- as.character(x)
  out <- out[!is.na(out) & nzchar(trimws(out))]
  unique(trimws(out))
}

.monitoreo_num <- function(x, default = NA_real_) {
  out <- suppressWarnings(as.numeric(x %||% default)[1])
  if (is.finite(out)) out else default
}

.monitoreo_int <- function(x, default = 0L) {
  out <- suppressWarnings(as.integer(x %||% default)[1])
  if (is.finite(out)) out else default
}

.monitoreo_bool <- function(x, default = FALSE) {
  if (is.null(x)) return(default)
  if (is.logical(x)) return(isTRUE(x[1]))
  tolower(as.character(x)[1]) %in% c("1", "true", "t", "yes", "si", "sí")
}

.monitoreo_safe_name <- function(x) {
  x <- tolower(trimws(as.character(x %||% "")))
  x <- iconv(x, to = "ASCII//TRANSLIT", sub = "")
  x <- gsub("[^a-z0-9]+", "_", x)
  x <- gsub("^_+|_+$", "", x)
  if (!nzchar(x)) "campo" else x
}

monitoreo_estado_cumplimiento <- function(n_efectivo, n_objetivo) {
  n_efectivo <- .monitoreo_int(n_efectivo, 0L)
  n_objetivo <- .monitoreo_int(n_objetivo, NA_integer_)
  if (!is.finite(n_objetivo) || n_objetivo <= 0L) {
    return(list(
      estado = "sin_objetivo",
      brecha_absoluta = NA_integer_,
      brecha_porcentual = NA_real_
    ))
  }
  brecha_abs <- as.integer(n_objetivo - n_efectivo)
  brecha_pct <- brecha_abs / n_objetivo
  estado <- if (n_efectivo >= n_objetivo) {
    "cumple_meta"
  } else if (brecha_pct < 0.05) {
    "brecha_menor_documentada"
  } else {
    "brecha_relevante"
  }
  list(
    estado = estado,
    brecha_absoluta = brecha_abs,
    brecha_porcentual = brecha_pct
  )
}

.monitoreo_actor_id <- function(actor, actor_id = "") {
  raw <- .monitoreo_scalar(actor_id, "")
  if (!nzchar(raw)) raw <- .monitoreo_scalar(actor, "")
  id <- .monitoreo_safe_name(raw)
  if (grepl("admin", id)) return("administrativos")
  if (grepl("docent", id)) return("docentes")
  if (grepl("estudiant", id)) return("estudiantes")
  if (grepl("egresad", id)) return("egresados")
  id
}

.monitoreo_acreditacion_benchmark <- function(actor_id) {
  benchmarks <- list(
    estudiantes = list(rango = "58% a 97%", promedio_historico = 0.713, mediana_historica = 0.69),
    docentes = list(rango = "66% a 100%", promedio_historico = 0.893, mediana_historica = 0.985),
    egresados = list(rango = "62% a 75%", promedio_historico = 0.682, mediana_historica = 0.67),
    administrativos = list(rango = "64% a 100%", promedio_historico = 0.946, mediana_historica = 0.97)
  )
  benchmarks[[actor_id]] %||% NULL
}

.monitoreo_canal_intentos <- function(x = list()) {
  aliases <- list(
    email = c("email", "correo"),
    whatsapp = c("whatsapp", "wa"),
    sms = c("sms"),
    telefono = c("telefono", "phone", "llamada"),
    presencial = c("presencial")
  )
  if (is.null(x) || !is.list(x)) x <- list()
  out <- list(email = 0L, whatsapp = 0L, sms = 0L, telefono = 0L, presencial = 0L)
  for (nm in names(aliases)) {
    val <- NULL
    for (key in aliases[[nm]]) {
      if (!is.null(x[[key]])) {
        val <- x[[key]]
        break
      }
    }
    out[[nm]] <- max(0L, .monitoreo_int(val, 0L))
  }
  out
}

.monitoreo_acreditacion_subcuotas <- function(raw = NULL, cuotas = NULL) {
  if (is.null(raw)) raw <- list()
  if (is.data.frame(raw)) {
    raw <- lapply(seq_len(nrow(raw)), function(i) as.list(raw[i, , drop = FALSE]))
  }
  out <- list()
  if (is.list(raw) && length(raw)) {
    if (is.null(names(raw)) || any(!nzchar(names(raw)))) {
      for (item in raw) {
        if (!is.list(item)) next
        celda <- .monitoreo_scalar(item$celda %||% item$id %||% item$name, "")
        if (!nzchar(celda)) next
        cuota <- .monitoreo_int(item$cuota %||% item$meta, 0L)
        logrado <- .monitoreo_int(item$logrado %||% item$n, 0L)
        estado <- .monitoreo_scalar(item$estado, "")
        if (!estado %in% c("completa", "parcial", "vacia")) {
          estado <- if (logrado >= cuota && cuota > 0L) "completa" else if (logrado > 0L) "parcial" else "vacia"
        }
        out[[celda]] <- list(cuota = cuota, logrado = logrado, estado = estado)
      }
    } else {
      for (celda in names(raw)) {
        item <- raw[[celda]]
        if (is.list(item)) {
          cuota <- .monitoreo_int(item$cuota %||% item$meta, 0L)
          logrado <- .monitoreo_int(item$logrado %||% item$n, 0L)
          estado <- .monitoreo_scalar(item$estado, "")
        } else {
          cuota <- .monitoreo_int(item, 0L)
          logrado <- 0L
          estado <- "vacia"
        }
        if (!estado %in% c("completa", "parcial", "vacia")) {
          estado <- if (logrado >= cuota && cuota > 0L) "completa" else if (logrado > 0L) "parcial" else "vacia"
        }
        out[[celda]] <- list(cuota = cuota, logrado = logrado, estado = estado)
      }
    }
  }
  if (!length(out) && is.list(cuotas) && length(cuotas)) {
    for (celda in names(cuotas)) {
      out[[celda]] <- list(
        cuota = max(0L, .monitoreo_int(cuotas[[celda]], 0L)),
        logrado = 0L,
        estado = "vacia"
      )
    }
  }
  out
}

.monitoreo_acreditacion_bolsa <- function(raw = NULL) {
  if (is.null(raw)) return(list())
  if (is.data.frame(raw)) raw <- lapply(seq_len(nrow(raw)), function(i) as.list(raw[i, , drop = FALSE]))
  if (!is.list(raw)) return(list())
  out <- list()
  for (i in seq_along(raw)) {
    item <- raw[[i]]
    if (!is.list(item)) next
    tipo <- .monitoreo_scalar(item$tipo, "titular")
    if (!tipo %in% c("titular", "reemplazo")) tipo <- "titular"
    estado <- .monitoreo_scalar(item$estado, "pendiente")
    if (!estado %in% c("pendiente", "activado", "completado", "descartado")) estado <- "pendiente"
    out[[length(out) + 1L]] <- list(
      id = .monitoreo_scalar(item$id, paste0("unidad-", i)),
      tipo = tipo,
      prioridad = max(1L, .monitoreo_int(item$prioridad, if (tipo == "titular") 1L else i)),
      estado = estado,
      fecha_activacion = .monitoreo_scalar(item$fecha_activacion, ""),
      motivo_descarte = .monitoreo_scalar(item$motivo_descarte, "")
    )
  }
  out
}

.monitoreo_acreditacion_componente <- function(comp = list()) {
  if (is.null(comp) || !is.list(comp)) comp <- list()
  actor <- .monitoreo_scalar(comp$actor, "Componente")
  actor_id <- .monitoreo_actor_id(actor, comp$actor_id %||% "")
  resultado <- comp$resultado %||% list()
  meta_raw <- comp$meta %||% list()
  marco_raw <- comp$marco %||% list()
  n_objetivo <- .monitoreo_int(
    comp$n_objetivo %||% meta_raw$n_objetivo %||% comp$meta_efectiva %||%
      resultado$n_objetivo %||% resultado$n_operativo %||% meta_raw$valor,
    NA_integer_
  )
  tecnica <- .monitoreo_scalar(comp$tecnica %||% resultado$tecnica, "")
  variable_control <- .monitoreo_scalar(
    comp$variable_control %||% resultado$variable_control %||% meta_raw$variable_control,
    ""
  )
  tasa_respuesta_esperada <- .monitoreo_num(
    comp$tasa_respuesta_esperada %||% resultado$tasa_respuesta_esperada %||%
      comp$parametros$tasa_respuesta,
    NA_real_
  )

  seguimiento_raw <- comp$seguimiento %||% list()
  n_efectivo <- max(0L, .monitoreo_int(seguimiento_raw$n_efectivo %||% comp$n_efectivo, 0L))
  cumplimiento <- monitoreo_estado_cumplimiento(n_efectivo, n_objetivo)
  benchmark <- .monitoreo_acreditacion_benchmark(actor_id)
  benchmark_comparado <- NULL
  if (!is.null(benchmark) && is.finite(n_objetivo) && n_objetivo > 0L) {
    cobertura_actual <- n_efectivo / n_objetivo
    benchmark_comparado <- c(
      benchmark,
      list(
        cobertura_actual = cobertura_actual,
        desviacion_actual = cobertura_actual - benchmark$promedio_historico
      )
    )
  }
  cumplimiento$benchmark_comparado <- benchmark_comparado

  cuotas <- resultado$sub_cuotas %||% meta_raw$sub_cuotas %||% NULL
  subcuotas <- .monitoreo_acreditacion_subcuotas(
    seguimiento_raw$sub_cuotas_progreso %||% comp$sub_cuotas_progreso,
    cuotas
  )
  intentos <- .monitoreo_canal_intentos(seguimiento_raw$intentos_canal %||% comp$intentos_canal)

  list(
    id = .monitoreo_scalar(comp$id, paste0("cmp-", actor_id)),
    actor = actor,
    actor_id = actor_id,
    tecnica = tecnica,
    variable_control = variable_control,
    habilita_margen = .monitoreo_bool(comp$habilita_margen, identical(tecnica, "prob_conglomerado_multietapico")),
    marco = list(
      universo_bruto = .monitoreo_int(marco_raw$universo_bruto, NA_integer_),
      marco_actualizado = .monitoreo_int(marco_raw$marco_actualizado %||% marco_raw$marco_validado, NA_integer_),
      marco_contactable = .monitoreo_int(marco_raw$marco_contactable, NA_integer_),
      meta_efectiva = if (is.finite(n_objetivo)) as.integer(n_objetivo) else NA_integer_,
      tasa_respuesta_esperada = tasa_respuesta_esperada
    ),
    meta = list(
      n_objetivo = if (is.finite(n_objetivo)) as.integer(n_objetivo) else NA_integer_,
      tipo = .monitoreo_scalar(meta_raw$tipo, "objetivo"),
      variable_control = variable_control
    ),
    seguimiento = list(
      n_efectivo = as.integer(n_efectivo),
      fecha_actualizacion = .monitoreo_scalar(seguimiento_raw$fecha_actualizacion, ""),
      notas_campo = .monitoreo_scalar(seguimiento_raw$notas_campo, ""),
      intentos_canal = intentos,
      tasa_contacto_efectiva = .monitoreo_num(seguimiento_raw$tasa_contacto_efectiva, NA_real_),
      cumplimiento = cumplimiento,
      bolsa_operativa = .monitoreo_acreditacion_bolsa(seguimiento_raw$bolsa_operativa %||% comp$bolsa_operativa),
      sub_cuotas_progreso = subcuotas
    )
  )
}

monitoreo_acreditacion_dashboard <- function(acreditacion = list()) {
  comps <- acreditacion$componentes %||% list()
  cards <- list()
  alertas <- list()
  add_alerta <- function(severidad, componente_id, actor, tipo, mensaje) {
    alertas[[length(alertas) + 1L]] <<- list(
      severidad = severidad,
      componente_id = componente_id,
      actor = actor,
      tipo = tipo,
      mensaje = mensaje
    )
  }
  for (comp in comps) {
    seg <- comp$seguimiento %||% list()
    meta <- comp$meta %||% list()
    cum <- seg$cumplimiento %||% monitoreo_estado_cumplimiento(seg$n_efectivo, meta$n_objetivo)
    n_objetivo <- .monitoreo_int(meta$n_objetivo, NA_integer_)
    n_efectivo <- .monitoreo_int(seg$n_efectivo, 0L)
    avance_pct <- if (is.finite(n_objetivo) && n_objetivo > 0L) round(100 * n_efectivo / n_objetivo, 1) else NA_real_
    cards[[length(cards) + 1L]] <- list(
      id = comp$id,
      actor = comp$actor,
      actor_id = comp$actor_id,
      tecnica = comp$tecnica,
      n_efectivo = n_efectivo,
      n_objetivo = if (is.finite(n_objetivo)) as.integer(n_objetivo) else NA_integer_,
      avance_pct = avance_pct,
      estado = cum$estado,
      brecha_absoluta = cum$brecha_absoluta,
      brecha_porcentual = cum$brecha_porcentual,
      benchmark_comparado = cum$benchmark_comparado,
      ultima_actualizacion = seg$fecha_actualizacion %||% ""
    )
    if (identical(cum$estado, "brecha_relevante")) {
      add_alerta("bloqueante", comp$id, comp$actor, "brecha_relevante",
                 "Brecha relevante: requiere refuerzo o aprobacion metodologica.")
    } else if (identical(cum$estado, "brecha_menor_documentada")) {
      add_alerta("advertencia", comp$id, comp$actor, "brecha_menor",
                 "Brecha menor: documentar justificacion antes del cierre.")
    } else if (identical(cum$estado, "sin_objetivo")) {
      add_alerta("advertencia", comp$id, comp$actor, "sin_objetivo",
                 "Sin meta efectiva configurada.")
    }
    if (n_efectivo > 0L && n_efectivo < 30L) {
      add_alerta("advertencia", comp$id, comp$actor, "minimo_estadistico",
                 "Avance bajo n=30 para analisis estadistico.")
    }
    bench <- cum$benchmark_comparado
    if (!is.null(bench) && is.finite(bench$cobertura_actual) &&
        is.finite(bench$mediana_historica) &&
        (bench$cobertura_actual - bench$mediana_historica) <= -0.15) {
      add_alerta("advertencia", comp$id, comp$actor, "benchmark_bajo",
                 "Cobertura 15pp o mas por debajo de la mediana historica interna.")
    }
    subcuotas <- seg$sub_cuotas_progreso %||% list()
    if (length(subcuotas)) {
      estados <- vapply(subcuotas, function(x) .monitoreo_scalar(x$estado, ""), character(1))
      if (any(estados %in% c("vacia", "parcial"))) {
        add_alerta("advertencia", comp$id, comp$actor, "subcuotas_incompletas",
                   "Hay subcuotas vacias o parciales.")
      }
    }
    bolsa <- seg$bolsa_operativa %||% list()
    if (length(bolsa)) {
      sin_motivo <- vapply(bolsa, function(x) {
        identical(x$tipo, "reemplazo") &&
          x$estado %in% c("activado", "completado") &&
          !nzchar(.monitoreo_scalar(x$motivo_descarte, ""))
      }, logical(1))
      if (any(sin_motivo)) {
        add_alerta("advertencia", comp$id, comp$actor, "reemplazo_sin_motivo",
                   "Hay reemplazos activados sin motivo documentado.")
      }
    }
  }
  bloqueos <- vapply(alertas, function(a) identical(a$severidad, "bloqueante"), logical(1))
  list(
    cards = cards,
    alertas = alertas,
    cierre_habilitado = length(cards) > 0L && !any(bloqueos),
    bloqueos = as.integer(sum(bloqueos))
  )
}

monitoreo_normalize_acreditacion <- function(acreditacion = list()) {
  if (is.null(acreditacion) || !is.list(acreditacion)) acreditacion <- list()
  comps_raw <- acreditacion$componentes %||% list()
  if (is.data.frame(comps_raw)) {
    comps_raw <- lapply(seq_len(nrow(comps_raw)), function(i) as.list(comps_raw[i, , drop = FALSE]))
  }
  comps <- lapply(comps_raw, .monitoreo_acreditacion_componente)
  modo <- .monitoreo_scalar(acreditacion$modo_trabajo, "seguimiento_campo")
  if (!modo %in% c("seguimiento_campo", "cierre_campo")) modo <- "seguimiento_campo"
  estudio_raw <- acreditacion$estudio %||% list()
  out <- list(
    enabled = .monitoreo_bool(acreditacion$enabled, length(comps) > 0L),
    modo_trabajo = modo,
    estudio = list(
      id = .monitoreo_scalar(estudio_raw$id %||% acreditacion$estudio_id, ""),
      titulo = .monitoreo_scalar(estudio_raw$titulo %||% acreditacion$titulo, "Estudio de acreditacion"),
      cliente = .monitoreo_scalar(estudio_raw$cliente %||% estudio_raw$contexto$cliente, ""),
      macro_familia = .monitoreo_scalar(estudio_raw$macro_familia, "acreditacion"),
      creado_desde_calc_muestra = .monitoreo_bool(estudio_raw$creado_desde_calc_muestra, FALSE)
    ),
    componentes = comps,
    plan_refuerzo = .monitoreo_scalar(acreditacion$plan_refuerzo, ""),
    aprobacion_metodologica = .monitoreo_bool(acreditacion$aprobacion_metodologica, FALSE),
    cierre_at = .monitoreo_scalar(acreditacion$cierre_at, "")
  )
  out$dashboard <- monitoreo_acreditacion_dashboard(out)
  out
}

monitoreo_acreditacion_from_calc <- function(estudio) {
  if (is.null(estudio) || !is.list(estudio)) stop("No hay estudio de calculador para importar.", call. = FALSE)
  comps <- estudio$componentes %||% list()
  if (!length(comps)) stop("El estudio del calculador no tiene componentes.", call. = FALSE)
  acreditacion <- list(
    enabled = TRUE,
    modo_trabajo = "seguimiento_campo",
    estudio = list(
      id = .monitoreo_scalar(estudio$id, ""),
      titulo = .monitoreo_scalar(estudio$titulo, "Estudio de acreditacion"),
      cliente = .monitoreo_scalar(estudio$contexto$cliente, ""),
      macro_familia = .monitoreo_scalar(estudio$macro_familia, "acreditacion"),
      creado_desde_calc_muestra = TRUE
    ),
    componentes = comps
  )
  monitoreo_normalize_acreditacion(acreditacion)
}

monitoreo_acreditacion_update_seguimiento <- function(acreditacion, payload = list()) {
  acr <- monitoreo_normalize_acreditacion(acreditacion)
  id <- .monitoreo_scalar(payload$id %||% payload$componente_id, "")
  if (!nzchar(id)) stop("Falta id de componente.", call. = FALSE)
  ids <- vapply(acr$componentes, function(comp) comp$id, character(1))
  idx <- match(id, ids)
  if (is.na(idx)) stop("Componente no existe en el seguimiento.", call. = FALSE)
  comp <- acr$componentes[[idx]]
  seg <- comp$seguimiento %||% list()
  if ("n_efectivo" %in% names(payload)) seg$n_efectivo <- max(0L, .monitoreo_int(payload$n_efectivo, 0L))
  if ("notas_campo" %in% names(payload)) seg$notas_campo <- .monitoreo_scalar(payload$notas_campo, "")
  if ("intentos_canal" %in% names(payload)) {
    current <- seg$intentos_canal %||% list()
    incoming <- payload$intentos_canal %||% list()
    if (is.list(incoming)) {
      for (nm in names(incoming)) current[[nm]] <- incoming[[nm]]
    }
    seg$intentos_canal <- .monitoreo_canal_intentos(current)
  }
  if ("tasa_contacto_efectiva" %in% names(payload)) {
    seg$tasa_contacto_efectiva <- .monitoreo_num(payload$tasa_contacto_efectiva, NA_real_)
  }
  if ("sub_cuotas_progreso" %in% names(payload)) {
    seg$sub_cuotas_progreso <- payload$sub_cuotas_progreso
  }
  if ("bolsa_operativa" %in% names(payload)) {
    seg$bolsa_operativa <- payload$bolsa_operativa
  }
  seg$fecha_actualizacion <- .monitoreo_scalar(payload$fecha_actualizacion, .monitoreo_now_iso())
  comp$seguimiento <- seg
  acr$componentes[[idx]] <- .monitoreo_acreditacion_componente(comp)
  monitoreo_normalize_acreditacion(acr)
}

monitoreo_acreditacion_cerrar <- function(acreditacion, plan_refuerzo = "", aprobar_brechas = FALSE) {
  acr <- monitoreo_normalize_acreditacion(acreditacion)
  dashboard <- acr$dashboard %||% monitoreo_acreditacion_dashboard(acr)
  bloqueado <- !isTRUE(dashboard$cierre_habilitado)
  plan_refuerzo <- .monitoreo_scalar(plan_refuerzo, acr$plan_refuerzo %||% "")
  aprobar_brechas <- .monitoreo_bool(aprobar_brechas, acr$aprobacion_metodologica %||% FALSE)
  if (isTRUE(bloqueado) && !aprobar_brechas && !nzchar(plan_refuerzo)) {
    stop("Hay brechas relevantes sin plan de refuerzo o aprobacion metodologica.", call. = FALSE)
  }
  acr$modo_trabajo <- "cierre_campo"
  acr$plan_refuerzo <- plan_refuerzo
  acr$aprobacion_metodologica <- aprobar_brechas
  acr$cierre_at <- .monitoreo_now_iso()
  monitoreo_normalize_acreditacion(acr)
}

monitoreo_default_config <- function(data = NULL) {
  cols <- if (is.data.frame(data)) names(data) else character(0)
  pick <- function(patterns) {
    for (pat in patterns) {
      hit <- grep(pat, cols, ignore.case = TRUE, value = TRUE)
      if (length(hit)) return(hit[1])
    }
    ""
  }
  status_var <- pick(c("^response_status$", "validation_status", "estado", "status"))
  list(
    enumerator_var = pick(c("enumerador", "encuestador", "interviewer", "enumerator", "username", "submitted_by")),
    date_var = pick(c("_submission_time", "submission_time", "date_modified", "date_created", "fecha", "end$")),
    start_var = pick(c("^start$", "inicio", "start_time")),
    end_var = pick(c("^end$", "fin", "end_time")),
    duration_var = pick(c("^total_time$", "duration", "duracion", "tiempo")),
    status_var = status_var,
    valid_statuses = if (identical(status_var, "response_status")) c("completed") else c("completed", "complete", "valid", "approved", "aprobado"),
    id_var = pick(c("^_uuid$", "^_id$", "^response_id$", "submission_id", "uuid")),
    contact_var = pick(c("telefono", "phone", "celular", "contact")),
    control_vars = list(),
    critical_vars = list(),
    goals = list(),
    objetivo_total = NA_integer_,
    min_duration_seconds = 60,
    max_duration_seconds = 7200,
    supervision_n = 20,
    supervision_seed = 20260514,
    acreditacion = monitoreo_normalize_acreditacion(list())
  )
}

monitoreo_normalize_config <- function(config = list(), data = NULL) {
  if (is.null(config) || !is.list(config)) config <- list()
  defaults <- monitoreo_default_config(data)
  cols <- if (is.data.frame(data)) names(data) else character(0)
  keep_col <- function(x, default = "") {
    v <- .monitoreo_scalar(x, default)
    if (length(cols) && nzchar(v) && !v %in% cols) return("")
    v
  }
  keep_cols <- function(x) {
    v <- .monitoreo_chr_vec(x)
    if (length(cols)) v <- intersect(v, cols)
    as.list(v)
  }

  goals_raw <- config$goals %||% config$metas %||% list()
  if (is.data.frame(goals_raw)) {
    goals_raw <- lapply(seq_len(nrow(goals_raw)), function(i) as.list(goals_raw[i, , drop = FALSE]))
  }
  goals <- list()
  if (is.list(goals_raw) && length(goals_raw)) {
    for (g in goals_raw) {
      if (!is.list(g)) next
      filters <- g$filters %||% g$filtros %||% list()
      if (!is.list(filters)) filters <- list()
      filters <- filters[!vapply(filters, is.null, logical(1))]
      filters <- lapply(filters, function(v) .monitoreo_scalar(v, ""))
      filters <- filters[vapply(filters, nzchar, logical(1))]
      meta <- .monitoreo_int(g$meta %||% g$objetivo %||% g$n, NA_integer_)
      if (!is.finite(meta) || meta < 0L) next
      goals[[length(goals) + 1L]] <- list(filters = filters, meta = as.integer(meta))
    }
  }

  objetivo_total <- .monitoreo_int(config$objetivo_total %||% config$target_total, defaults$objetivo_total)
  if (!is.finite(objetivo_total) || objetivo_total < 0L) objetivo_total <- NA_integer_

  list(
    enumerator_var = keep_col(config$enumerator_var %||% config$col_enumerador, defaults$enumerator_var),
    date_var = keep_col(config$date_var %||% config$fecha_var, defaults$date_var),
    start_var = keep_col(config$start_var, defaults$start_var),
    end_var = keep_col(config$end_var, defaults$end_var),
    duration_var = keep_col(config$duration_var %||% config$tiempo_var, defaults$duration_var),
    status_var = keep_col(config$status_var %||% config$estado_var, defaults$status_var),
    valid_statuses = as.list(.monitoreo_chr_vec(config$valid_statuses %||% defaults$valid_statuses)),
    id_var = keep_col(config$id_var, defaults$id_var),
    contact_var = keep_col(config$contact_var, defaults$contact_var),
    control_vars = keep_cols(config$control_vars %||% config$variables_control),
    critical_vars = keep_cols(config$critical_vars %||% config$campos_criticos),
    goals = goals,
    objetivo_total = objetivo_total,
    min_duration_seconds = max(0, .monitoreo_num(config$min_duration_seconds, defaults$min_duration_seconds)),
    max_duration_seconds = max(0, .monitoreo_num(config$max_duration_seconds, defaults$max_duration_seconds)),
    supervision_n = max(1L, .monitoreo_int(config$supervision_n, defaults$supervision_n)),
    supervision_seed = .monitoreo_int(config$supervision_seed, defaults$supervision_seed),
    acreditacion = monitoreo_normalize_acreditacion(config$acreditacion %||% defaults$acreditacion)
  )
}

monitoreo_variables <- function(data) {
  if (is.null(data) || !is.data.frame(data)) return(list())
  lapply(names(data), function(nm) {
    x <- data[[nm]]
    list(
      name = nm,
      tipo = paste(class(x), collapse = "/"),
      n_missing = as.integer(sum(is.na(x) | !nzchar(trimws(as.character(x))))),
      n_unique = as.integer(length(unique(as.character(x))))
    )
  })
}

monitoreo_demo_dataset <- function(seed = 20260514L, n = 96L) {
  set.seed(.monitoreo_int(seed, 20260514L))
  n <- max(24L, .monitoreo_int(n, 96L))
  keep_idx <- function(idx) idx[idx <= n]
  enumeradores <- c("Ana Torres", "Luis Quispe", "Marta Rojas", "Diego Flores", "Rosa Medina")
  distritos <- c("Norte", "Centro", "Sur")
  zonas <- c("Urbano", "Periurbano")
  edades <- c("18-29", "30-44", "45-59", "60+")
  fuentes <- ifelse(seq_len(n) <= ceiling(n * 0.58), "demo_kobo", "demo_sm")
  fecha_base <- as.POSIXct("2026-05-01 08:00:00", tz = "UTC")
  inicio <- fecha_base + sample(0:(7 * 24 * 3600), n, replace = TRUE)
  duracion <- sample(seq(180, 1500, by = 30), n, replace = TRUE)
  duracion[keep_idx(c(4, 18))] <- c(35, 8400)[seq_along(keep_idx(c(4, 18)))]
  fin <- inicio + duracion
  estado <- sample(c("completed", "approved", "rejected", "incomplete"), n, replace = TRUE, prob = c(0.72, 0.12, 0.10, 0.06))
  idx_estado <- keep_idx(c(9, 33, 62))
  estado[idx_estado] <- c("rejected", "incomplete", "rejected")[seq_along(idx_estado)]
  telefono <- sprintf("9%08d", sample.int(90000000L, n, replace = TRUE) + 9999999L)
  telefono[keep_idx(c(6, 27, 71))] <- ""
  consentimiento <- sample(c("si", "no", ""), n, replace = TRUE, prob = c(0.91, 0.05, 0.04))
  consentimiento[keep_idx(c(12, 48))] <- ""
  response_id <- sprintf("demo_%03d", seq_len(n))
  if (n >= 22L) response_id[22] <- response_id[21]
  data.frame(
    response_id = response_id,
    enumerador = sample(enumeradores, n, replace = TRUE),
    distrito = sample(distritos, n, replace = TRUE, prob = c(0.36, 0.30, 0.34)),
    zona = sample(zonas, n, replace = TRUE, prob = c(0.68, 0.32)),
    edad_grupo = sample(edades, n, replace = TRUE),
    estado = estado,
    fecha = format(inicio, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    inicio = format(inicio, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    fin = format(fin, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    duracion = as.integer(duracion),
    telefono = telefono,
    consentimiento = consentimiento,
    comentario = sample(c("", "Revisar direccion", "Contacto pide llamada tarde", "Sin observacion"), n, replace = TRUE),
    .source_id = fuentes,
    .source_kind = ifelse(fuentes == "demo_kobo", "kobo", "surveymonkey"),
    .source_label = ifelse(fuentes == "demo_kobo", "Demo Kobo", "Demo SurveyMonkey"),
    stringsAsFactors = FALSE
  )
}

monitoreo_demo_acreditacion <- function() {
  monitoreo_normalize_acreditacion(list(
    enabled = TRUE,
    modo_trabajo = "seguimiento_campo",
    estudio = list(
      id = "demo-acreditacion",
      titulo = "Acreditacion multi-actor demo",
      cliente = "PUCP",
      macro_familia = "acreditacion",
      creado_desde_calc_muestra = FALSE
    ),
    componentes = list(
      list(
        id = "cmp-admin",
        actor = "Administrativos",
        actor_id = "administrativos",
        tecnica = "intencion_censal",
        marco = list(universo_bruto = 100L, marco_actualizado = 96L, marco_contactable = 92L),
        meta = list(tipo = "cobertura", valor = 80L, variable_control = "condicion_laboral"),
        seguimiento = list(
          n_efectivo = 78L,
          notas_campo = "Pendiente refuerzo con coordinacion de carrera.",
          intentos_canal = list(email = 96L, whatsapp = 44L, telefono = 12L)
        )
      ),
      list(
        id = "cmp-docentes",
        actor = "Docentes",
        actor_id = "docentes",
        tecnica = "no_prob_cuotas",
        marco = list(universo_bruto = 280L, marco_actualizado = 268L, marco_contactable = 260L),
        meta = list(
          tipo = "cuota",
          valor = 150L,
          variable_control = "dedicacion_docente",
          sub_cuotas = list(TC = 50L, TPA = 50L, TPC = 50L)
        ),
        seguimiento = list(
          n_efectivo = 135L,
          intentos_canal = list(email = 260L, whatsapp = 120L, telefono = 32L),
          sub_cuotas_progreso = list(
            TC = list(cuota = 50L, logrado = 48L, estado = "parcial"),
            TPA = list(cuota = 50L, logrado = 50L, estado = "completa"),
            TPC = list(cuota = 50L, logrado = 37L, estado = "parcial")
          )
        )
      ),
      list(
        id = "cmp-estudiantes",
        actor = "Estudiantes",
        actor_id = "estudiantes",
        tecnica = "prob_conglomerado_multietapico",
        marco = list(universo_bruto = 4200L, marco_actualizado = 4100L, marco_contactable = 3900L),
        meta = list(tipo = "objetivo", valor = 900L, variable_control = "nivel_curricular"),
        seguimiento = list(
          n_efectivo = 920L,
          intentos_canal = list(email = 3900L, whatsapp = 1800L, presencial = 22L),
          bolsa_operativa = list(
            list(id = "AULA-101", tipo = "titular", prioridad = 1L, estado = "completado"),
            list(id = "AULA-204", tipo = "reemplazo", prioridad = 2L, estado = "activado")
          )
        )
      ),
      list(
        id = "cmp-egresados",
        actor = "Egresados",
        actor_id = "egresados",
        tecnica = "no_prob_cuotas",
        marco = list(universo_bruto = 520L, marco_actualizado = 480L, marco_contactable = 420L),
        meta = list(tipo = "cuota", valor = 150L, variable_control = "ciclo_egreso"),
        seguimiento = list(
          n_efectivo = 110L,
          notas_campo = "Canal telefonico en refuerzo.",
          intentos_canal = list(email = 420L, whatsapp = 210L, telefono = 170L)
        )
      )
    )
  ))
}

monitoreo_demo_config <- function(data = NULL) {
  if (is.null(data) || !is.data.frame(data)) data <- monitoreo_demo_dataset()
  monitoreo_normalize_config(list(
    id_var = "response_id",
    enumerator_var = "enumerador",
    date_var = "fecha",
    start_var = "inicio",
    end_var = "fin",
    duration_var = "duracion",
    status_var = "estado",
    valid_statuses = c("completed", "approved"),
    contact_var = "telefono",
    control_vars = c("distrito", "zona"),
    critical_vars = c("telefono", "consentimiento"),
    objetivo_total = 120L,
    goals = list(
      list(filters = list(distrito = "Norte"), meta = 42L),
      list(filters = list(distrito = "Centro"), meta = 36L),
      list(filters = list(distrito = "Sur"), meta = 42L)
    ),
    min_duration_seconds = 90,
    max_duration_seconds = 5400,
    supervision_n = 12,
    supervision_seed = 20260514L,
    acreditacion = monitoreo_demo_acreditacion()
  ), data)
}

monitoreo_demo_payload <- function(seed = 20260514L, n = 96L) {
  data <- monitoreo_demo_dataset(seed = seed, n = n)
  cfg <- monitoreo_demo_config(data)
  synced_at <- .monitoreo_now_iso()
  sources <- monitoreo_normalize_sources(list(
    list(
      id = "demo_kobo",
      kind = "kobo",
      label = "Demo Kobo",
      enabled = FALSE,
      asset_uid = "demo_asset_uid",
      base_url = kobo_api_default_base_url(),
      created_at = synced_at,
      last_sync_at = synced_at
    ),
    list(
      id = "demo_sm",
      kind = "surveymonkey",
      label = "Demo SurveyMonkey",
      enabled = FALSE,
      survey_id = "demo_survey_id",
      base_url = "https://api.surveymonkey.com/v3",
      created_at = synced_at,
      last_sync_at = synced_at
    )
  ))
  dashboard <- monitoreo_build_dashboard(data, cfg)
  list(
    ok = TRUE,
    sources = sources,
    config = cfg,
    snapshot = list(
      synced_at = synced_at,
      data = data,
      config = cfg,
      dashboard = dashboard,
      variables = monitoreo_variables(data),
      errors = list()
    )
  )
}

monitoreo_normalize_sources <- function(sources = list()) {
  if (is.null(sources) || !is.list(sources)) return(list())
  if (is.data.frame(sources)) {
    sources <- lapply(seq_len(nrow(sources)), function(i) as.list(sources[i, , drop = FALSE]))
  }
  out <- list()
  for (src in sources) {
    if (!is.list(src)) next
    kind <- .monitoreo_scalar(src$kind, "")
    if (!kind %in% c("kobo", "surveymonkey")) next
    id <- .monitoreo_scalar(src$id, "")
    if (!nzchar(id)) {
      raw <- if (identical(kind, "kobo")) src$asset_uid %||% src$assetUid else src$survey_id %||% src$surveyId
      id <- paste(kind, .monitoreo_safe_name(raw), sep = "_")
    }
    item <- list(
      id = id,
      kind = kind,
      label = .monitoreo_scalar(src$label, if (identical(kind, "kobo")) "Kobo" else "SurveyMonkey"),
      enabled = .monitoreo_bool(src$enabled, TRUE),
      asset_uid = .monitoreo_scalar(src$asset_uid %||% src$assetUid, ""),
      survey_id = .monitoreo_scalar(src$survey_id %||% src$surveyId, ""),
      base_url = .monitoreo_scalar(src$base_url %||% src$baseUrl, if (identical(kind, "kobo")) kobo_api_default_base_url() else "https://api.surveymonkey.com/v3"),
      created_at = .monitoreo_scalar(src$created_at, .monitoreo_now_iso()),
      last_sync_at = .monitoreo_scalar(src$last_sync_at, "")
    )
    out[[item$id]] <- item
  }
  unname(out)
}

monitoreo_upsert_source <- function(sources, source) {
  current <- monitoreo_normalize_sources(sources)
  incoming <- monitoreo_normalize_sources(list(source))
  if (!length(incoming)) stop("Fuente de monitoreo invalida.", call. = FALSE)
  src <- incoming[[1]]
  ids <- vapply(current, `[[`, character(1), "id")
  idx <- match(src$id, ids)
  if (is.na(idx)) current[[length(current) + 1L]] <- src else current[[idx]] <- src
  current
}

.monitoreo_bind_rows <- function(dfs) {
  dfs <- Filter(function(x) is.data.frame(x) && nrow(x) > 0L, dfs)
  if (!length(dfs)) return(data.frame())
  cols <- unique(unlist(lapply(dfs, names), use.names = FALSE))
  aligned <- lapply(dfs, function(df) {
    for (nm in setdiff(cols, names(df))) df[[nm]] <- NA
    df[, cols, drop = FALSE]
  })
  out <- do.call(rbind, aligned)
  rownames(out) <- NULL
  as.data.frame(out, stringsAsFactors = FALSE, optional = TRUE)
}

monitoreo_sync_source <- function(source, since = NULL, progress = NULL) {
  kind <- .monitoreo_scalar(source$kind, "")
  if (identical(kind, "kobo")) {
    token <- prosecnur_secret_load("kobo_token")
    if (is.na(token) || !nzchar(token)) stop("Falta token Kobo guardado.", call. = FALSE)
    payload <- kobo_api_fetch_all_asset_data(
      asset_uid = source$asset_uid,
      token = token,
      base_url = source$base_url %||% kobo_api_default_base_url(),
      progress = progress
    )
    data <- kobo_api_flatten_results(payload$results)
  } else if (identical(kind, "surveymonkey")) {
    token <- prosecnur_secret_load("sm_token")
    if (is.na(token) || !nzchar(token)) stop("Falta token SurveyMonkey guardado.", call. = FALSE)
    details <- sm_api_fetch_survey_details(source$survey_id, token, base_url = source$base_url %||% "https://api.surveymonkey.com/v3")
    payload <- sm_api_fetch_all_responses_bulk(
      survey_id = source$survey_id,
      token = token,
      since = since,
      progress = progress,
      base_url = source$base_url %||% "https://api.surveymonkey.com/v3"
    )
    data <- sm_api_flatten_responses(details, payload$data)
  } else {
    stop("Tipo de fuente no soportado.", call. = FALSE)
  }
  if (!nrow(data)) data <- data.frame()
  data$.source_id <- source$id
  data$.source_kind <- source$kind
  data$.source_label <- source$label
  data
}

monitoreo_sync_sources <- function(sources, config = list(), since = NULL, progress_path = NULL) {
  sources <- Filter(function(s) isTRUE(s$enabled), monitoreo_normalize_sources(sources))
  if (!length(sources)) stop("Configura al menos una fuente activa de monitoreo.", call. = FALSE)
  report <- if (!is.null(progress_path)) job_progress_writer(progress_path) else function(...) invisible(NULL)
  dfs <- list()
  errors <- list()
  for (i in seq_along(sources)) {
    src <- sources[[i]]
    report("loading", current = i, total = length(sources),
           percent = round(80 * (i - 1) / max(1, length(sources))),
           message = sprintf("Sincronizando %s...", src$label))
    local_progress <- function(current, total, message) {
      pct <- if (is.finite(total) && total > 0) {
        round(80 * (i - 1) / length(sources) + 80 * (current / total) / length(sources))
      } else {
        round(80 * i / length(sources))
      }
      report("loading", current = current, total = total, percent = pct, message = message)
    }
    df <- tryCatch(monitoreo_sync_source(src, since = since, progress = local_progress), error = function(e) {
      errors[[length(errors) + 1L]] <<- list(source_id = src$id, source_label = src$label, message = conditionMessage(e))
      NULL
    })
    if (!is.null(df)) dfs[[length(dfs) + 1L]] <- df
  }
  if (!length(dfs)) {
    msg <- if (length(errors)) paste(vapply(errors, `[[`, character(1), "message"), collapse = " | ") else "No se obtuvieron datos."
    stop(msg, call. = FALSE)
  }
  data <- .monitoreo_bind_rows(dfs)
  cfg <- monitoreo_normalize_config(config, data)
  report("evaluate", percent = 88, message = "Calculando avance y calidad...")
  dashboard <- monitoreo_build_dashboard(data, cfg)
  list(
    ok = TRUE,
    synced_at = .monitoreo_now_iso(),
    n_rows = as.integer(nrow(data)),
    n_sources = as.integer(length(dfs)),
    errors = errors,
    data = data,
    config = cfg,
    dashboard = dashboard,
    variables = monitoreo_variables(data)
  )
}

.monitoreo_parse_time_vec <- function(x) {
  if (is.null(x)) return(as.POSIXct(rep(NA_real_, 0), origin = "1970-01-01", tz = "UTC"))
  if (inherits(x, "POSIXt")) return(as.POSIXct(x, tz = "UTC"))
  if (inherits(x, "Date")) return(as.POSIXct(x, tz = "UTC"))
  ch <- as.character(x)
  out <- as.POSIXct(rep(NA_real_, length(ch)), origin = "1970-01-01", tz = "UTC")
  fmts <- c("%Y-%m-%dT%H:%M:%OSZ", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d %H:%M:%OS", "%Y-%m-%d")
  for (fmt in fmts) {
    idx <- is.na(out) & !is.na(ch) & nzchar(ch)
    if (!any(idx)) break
    parsed <- suppressWarnings(as.POSIXct(ch[idx], format = fmt, tz = "UTC"))
    idx_pos <- which(idx)
    ok <- !is.na(parsed)
    if (any(ok)) out[idx_pos[ok]] <- parsed[ok]
  }
  idx <- is.na(out) & !is.na(ch) & nzchar(ch)
  if (any(idx)) out[idx] <- suppressWarnings(as.POSIXct(ch[idx], tz = "UTC"))
  out
}

.monitoreo_duration_seconds <- function(data, cfg) {
  n <- nrow(data)
  if (n == 0L) return(numeric(0))
  dur_var <- cfg$duration_var
  if (nzchar(dur_var) && dur_var %in% names(data)) {
    val <- suppressWarnings(as.numeric(data[[dur_var]]))
    return(val)
  }
  if (nzchar(cfg$start_var) && nzchar(cfg$end_var) &&
      cfg$start_var %in% names(data) && cfg$end_var %in% names(data)) {
    st <- .monitoreo_parse_time_vec(data[[cfg$start_var]])
    en <- .monitoreo_parse_time_vec(data[[cfg$end_var]])
    return(as.numeric(difftime(en, st, units = "secs")))
  }
  rep(NA_real_, n)
}

.monitoreo_valid_mask <- function(data, cfg) {
  if (!nrow(data)) return(logical(0))
  status_var <- cfg$status_var
  if (!nzchar(status_var) || !status_var %in% names(data)) return(rep(TRUE, nrow(data)))
  valid <- tolower(.monitoreo_chr_vec(cfg$valid_statuses))
  if (!length(valid)) return(rep(TRUE, nrow(data)))
  tolower(trimws(as.character(data[[status_var]]))) %in% valid
}

.monitoreo_empty_mask <- function(x) {
  is.na(x) | !nzchar(trimws(as.character(x)))
}

.monitoreo_goal_meta_for_row <- function(row, goals) {
  if (!length(goals)) return(NA_integer_)
  total <- 0L
  matched <- FALSE
  for (g in goals) {
    filters <- g$filters %||% list()
    ok <- TRUE
    for (nm in names(filters)) {
      if (!nm %in% names(row) || !identical(as.character(row[[nm]]), as.character(filters[[nm]]))) {
        ok <- FALSE
        break
      }
    }
    if (ok) {
      total <- total + as.integer(g$meta %||% 0L)
      matched <- TRUE
    }
  }
  if (matched) total else NA_integer_
}

monitoreo_build_dashboard <- function(data, config = list()) {
  if (is.null(data) || !is.data.frame(data)) data <- data.frame()
  cfg <- monitoreo_normalize_config(config, data)
  n <- nrow(data)
  valid <- .monitoreo_valid_mask(data, cfg)
  valid_n <- sum(valid, na.rm = TRUE)
  duration <- .monitoreo_duration_seconds(data, cfg)
  date_values <- if (nzchar(cfg$date_var) && cfg$date_var %in% names(data)) .monitoreo_parse_time_vec(data[[cfg$date_var]]) else rep(as.POSIXct(NA), n)
  n_days <- length(unique(as.Date(date_values[!is.na(date_values)])))
  if (n_days == 0L && n > 0L) n_days <- 1L
  target <- cfg$objetivo_total
  if (!is.finite(target) && length(cfg$goals)) {
    target <- sum(vapply(cfg$goals, function(g) as.integer(g$meta %||% 0L), integer(1)))
  }
  avance_pct <- if (is.finite(target) && target > 0L) round(100 * valid_n / target, 1) else NA_real_

  progress <- .monitoreo_progress_table(data, cfg, valid)
  production <- .monitoreo_production_table(data, cfg, valid, date_values)
  inconsistencies <- .monitoreo_inconsistencies(data, cfg, valid, duration)

  list(
    ok = TRUE,
    kpis = list(
      total = as.integer(n),
      valid = as.integer(valid_n),
      invalid = as.integer(n - valid_n),
      target = if (is.finite(target)) as.integer(target) else NA_integer_,
      avance_pct = avance_pct,
      ritmo_diario = if (n_days > 0L) round(valid_n / n_days, 1) else NA_real_,
      duration_median = if (any(is.finite(duration))) round(stats::median(duration, na.rm = TRUE), 1) else NA_real_,
      duration_p95 = if (sum(is.finite(duration)) > 1L) round(stats::quantile(duration, 0.95, na.rm = TRUE, names = FALSE), 1) else NA_real_,
      inconsistencies = as.integer(nrow(inconsistencies))
    ),
    progress = progress,
    production = production,
    inconsistencies = utils::head(inconsistencies, 500L)
  )
}

.monitoreo_progress_table <- function(data, cfg, valid) {
  ctrl <- unlist(cfg$control_vars, use.names = FALSE)
  if (!length(ctrl)) {
    meta <- cfg$objetivo_total
    return(data.frame(
      grupo = "Total",
      observado = as.integer(sum(valid)),
      meta = if (is.finite(meta)) as.integer(meta) else NA_integer_,
      faltante = if (is.finite(meta)) max(0L, as.integer(meta) - as.integer(sum(valid))) else NA_integer_,
      cumplimiento = if (is.finite(meta) && meta > 0L) round(100 * sum(valid) / meta, 1) else NA_real_,
      stringsAsFactors = FALSE
    ))
  }
  df <- data[, ctrl, drop = FALSE]
  for (nm in ctrl) {
    df[[nm]] <- as.character(df[[nm]])
    df[[nm]][.monitoreo_empty_mask(df[[nm]])] <- "Sin dato"
  }
  df$.valid <- valid
  agg <- stats::aggregate(.valid ~ ., data = df, FUN = function(x) sum(x, na.rm = TRUE))
  names(agg)[names(agg) == ".valid"] <- "observado"
  agg$grupo <- apply(agg[, ctrl, drop = FALSE], 1, paste, collapse = " / ")
  agg$meta <- vapply(seq_len(nrow(agg)), function(i) {
    .monitoreo_goal_meta_for_row(as.list(agg[i, ctrl, drop = FALSE]), cfg$goals)
  }, integer(1))
  agg$faltante <- ifelse(is.na(agg$meta), NA_integer_, pmax(0L, agg$meta - agg$observado))
  agg$cumplimiento <- ifelse(!is.na(agg$meta) & agg$meta > 0, round(100 * agg$observado / agg$meta, 1), NA_real_)
  agg[, c("grupo", ctrl, "observado", "meta", "faltante", "cumplimiento"), drop = FALSE]
}

.monitoreo_production_table <- function(data, cfg, valid, date_values) {
  n <- nrow(data)
  if (n == 0L) return(data.frame())
  enum <- if (nzchar(cfg$enumerator_var) && cfg$enumerator_var %in% names(data)) {
    as.character(data[[cfg$enumerator_var]])
  } else {
    rep("Sin enumerador", n)
  }
  enum[.monitoreo_empty_mask(enum)] <- "Sin enumerador"
  day <- as.character(as.Date(date_values))
  day[is.na(day)] <- "Sin fecha"
  df <- data.frame(enumerador = enum, fecha = day, valido = valid, stringsAsFactors = FALSE)
  agg <- stats::aggregate(valido ~ enumerador + fecha, data = df, FUN = function(x) sum(x, na.rm = TRUE))
  names(agg)[3] <- "entrevistas_validas"
  agg <- agg[order(agg$enumerador, agg$fecha), , drop = FALSE]
  rownames(agg) <- NULL
  agg
}

.monitoreo_inconsistencies <- function(data, cfg, valid, duration) {
  n <- nrow(data)
  if (n == 0L) return(data.frame())
  id <- if (nzchar(cfg$id_var) && cfg$id_var %in% names(data)) as.character(data[[cfg$id_var]]) else as.character(seq_len(n))
  enum <- if (nzchar(cfg$enumerator_var) && cfg$enumerator_var %in% names(data)) as.character(data[[cfg$enumerator_var]]) else rep(NA_character_, n)
  add <- function(idx, tipo, campo = "", valor = NA_character_) {
    if (!length(idx)) return(NULL)
    data.frame(
      row = as.integer(idx),
      id = id[idx],
      enumerador = enum[idx],
      tipo = tipo,
      campo = campo,
      valor = as.character(valor),
      stringsAsFactors = FALSE
    )
  }
  parts <- list()
  if (nzchar(cfg$status_var) && cfg$status_var %in% names(data)) {
    idx <- which(!valid)
    parts[[length(parts) + 1L]] <- add(idx, "estado_invalido", cfg$status_var, data[[cfg$status_var]][idx])
  }
  for (nm in unlist(cfg$critical_vars, use.names = FALSE)) {
    if (!nm %in% names(data)) next
    idx <- which(.monitoreo_empty_mask(data[[nm]]))
    parts[[length(parts) + 1L]] <- add(idx, "campo_critico_vacio", nm, "")
  }
  if (length(duration)) {
    idx <- which(is.finite(duration) & duration < cfg$min_duration_seconds)
    parts[[length(parts) + 1L]] <- add(idx, "duracion_muy_corta", cfg$duration_var, duration[idx])
    idx <- which(is.finite(duration) & duration > cfg$max_duration_seconds)
    parts[[length(parts) + 1L]] <- add(idx, "duracion_muy_larga", cfg$duration_var, duration[idx])
  }
  if (nzchar(cfg$id_var) && cfg$id_var %in% names(data)) {
    ids <- as.character(data[[cfg$id_var]])
    idx <- which(!.monitoreo_empty_mask(ids) & duplicated(ids))
    parts[[length(parts) + 1L]] <- add(idx, "id_duplicado", cfg$id_var, ids[idx])
  }
  parts <- Filter(Negate(is.null), parts)
  if (!length(parts)) return(data.frame(row = integer(), id = character(), enumerador = character(), tipo = character(), campo = character(), valor = character()))
  out <- do.call(rbind, parts)
  rownames(out) <- NULL
  out
}

monitoreo_supervision_sample <- function(data, config = list(), n = NULL, seed = NULL, only_risk = FALSE) {
  if (is.null(data) || !is.data.frame(data) || nrow(data) == 0L) return(data.frame())
  cfg <- monitoreo_normalize_config(config, data)
  n_take <- max(1L, .monitoreo_int(n, cfg$supervision_n))
  seed <- .monitoreo_int(seed, cfg$supervision_seed)
  valid <- .monitoreo_valid_mask(data, cfg)
  duration <- .monitoreo_duration_seconds(data, cfg)
  inc <- .monitoreo_inconsistencies(data, cfg, valid, duration)
  risk <- rep(0L, nrow(data))
  if (nrow(inc)) {
    tab <- table(inc$row)
    risk[as.integer(names(tab))] <- as.integer(tab)
  }
  candidates <- which(valid)
  if (isTRUE(only_risk)) candidates <- intersect(candidates, which(risk > 0L))
  if (!length(candidates)) candidates <- seq_len(nrow(data))
  set.seed(seed)
  prob <- risk[candidates] + 1
  pick <- sample(candidates, size = min(n_take, length(candidates)), replace = FALSE, prob = prob)
  id_var <- cfg$id_var
  enum_var <- cfg$enumerator_var
  contact_var <- cfg$contact_var
  out <- data.frame(
    row = as.integer(pick),
    id = if (nzchar(id_var) && id_var %in% names(data)) as.character(data[[id_var]][pick]) else as.character(pick),
    enumerador = if (nzchar(enum_var) && enum_var %in% names(data)) as.character(data[[enum_var]][pick]) else NA_character_,
    contacto = if (nzchar(contact_var) && contact_var %in% names(data)) as.character(data[[contact_var]][pick]) else NA_character_,
    riesgo = as.integer(risk[pick]),
    stringsAsFactors = FALSE
  )
  ctrl <- unlist(cfg$control_vars, use.names = FALSE)
  for (nm in ctrl) {
    if (nm %in% names(data)) out[[nm]] <- as.character(data[[nm]][pick])
  }
  out[order(-out$riesgo, out$row), , drop = FALSE]
}

monitoreo_export_workbook <- function(data, config = list(), path) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop("El paquete R 'openxlsx' no esta instalado.", call. = FALSE)
  }
  dashboard <- monitoreo_build_dashboard(data, config)
  cfg <- monitoreo_normalize_config(config, data)
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "KPIs")
  kpis <- data.frame(
    indicador = names(dashboard$kpis),
    valor = unlist(dashboard$kpis, use.names = FALSE),
    stringsAsFactors = FALSE
  )
  openxlsx::writeData(wb, "KPIs", kpis)
  openxlsx::addWorksheet(wb, "Avance")
  openxlsx::writeData(wb, "Avance", as.data.frame(dashboard$progress, stringsAsFactors = FALSE))
  openxlsx::addWorksheet(wb, "Produccion")
  openxlsx::writeData(wb, "Produccion", as.data.frame(dashboard$production, stringsAsFactors = FALSE))
  openxlsx::addWorksheet(wb, "Inconsistencias")
  openxlsx::writeData(wb, "Inconsistencias", as.data.frame(dashboard$inconsistencies, stringsAsFactors = FALSE))
  openxlsx::addWorksheet(wb, "Supervision")
  openxlsx::writeData(wb, "Supervision", monitoreo_supervision_sample(data, cfg))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  invisible(path)
}

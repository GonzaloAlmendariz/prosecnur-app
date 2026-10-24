# =============================================================================
# monitoreo_supervision_rondas.R — rondas de supervisión del telefónico
# =============================================================================
#
# Decisiones de Gonzalo en docs/qa/revamp-monitoreo/procedimientos-respondidos.md,
# «Telefónico: rondas de supervisión» (2026-10-24):
#   - Cada ronda sale SOLO de las efectivas nuevas: el universo de la ronda N
#     son las efectivas que ninguna ronda anterior tuvo en su universo (las
#     llegadas desde la ronda N−1). Nunca se repite un caso. Se cuenta por
#     llegada y no por la fecha de Kobo: una efectiva subida tarde con fecha
#     anterior al corte también entra, en vez de quedar sin supervisar nunca.
#   - Tamaño: un porcentaje del universo de la ronda, repartido por enumerador
#     con mínimo 1 (P5, mismo sorteo que `.monitoreo_supervision_sorteo`), más
#     los casos que el analista agrega a mano (Origen = "analista").
#   - La ronda queda guardada y numerada (Ronda 1, 2, 3…), con fecha, semilla,
#     universo, porcentaje y casos, en la clave de sesión
#     `monitoreo_supervision_rondas` (persistible: viaja en el .pulso). No se
#     recalcula: los casos quedan escritos.
#   - Se publica a la hoja de supervisión (fuente con rol `supervision`) en su
#     propia pestaña «Ronda N». Nunca toca otras pestañas ni reescribe una
#     ronda publicada.
#
# Migración: un proyecto sin rondas guardadas sigue mostrando la Ronda 1 sin
# guardar (`.monitoreo_supervision_ronda_virtual`: el sorteo de supervision_n
# sobre todas las efectivas, el mismo de antes). Generar la primera ronda sin
# porcentaje la guarda tal cual (misma semilla, mismos casos); con porcentaje,
# la Ronda 1 sale del porcentaje sobre todas las efectivas.
#
# Clave de sesión `monitoreo_supervision_rondas`:
#   list(schema = "monitoreo_supervision_rondas_v1", rondas = list(<ronda>…))
#   <ronda> = list(numero, generada_el, semilla, porcentaje, cantidad, universo,
#                  corte_anterior, corte, universo_claves, casos, reparto,
#                  publicada)
# =============================================================================

.MONITOREO_SUPERVISION_RONDAS_SCHEMA <- "monitoreo_supervision_rondas_v1"
.MONITOREO_SUPERVISION_CASO_COLS <- c("N", "CodPulso", "proGres", "Enumerador", "Categoría", "Fecha Kobo", "Response ID", "Origen")

.monitoreo_supervision_df <- function(x, cols) {
  if (is.data.frame(x)) df <- x
  else if (is.list(x) && length(x)) df <- do.call(rbind, lapply(x, function(r) as.data.frame(r, check.names = FALSE, stringsAsFactors = FALSE)))
  else df <- data.frame()
  out <- lapply(cols, function(c) if (c %in% names(df)) df[[c]] else rep(if (nrow(df)) "" else character(0), nrow(df)))
  as.data.frame(stats::setNames(out, cols), check.names = FALSE, stringsAsFactors = FALSE)
}

#' Rondas guardadas, normalizadas y en orden. Acepta la clave de sesión
#' entera o solo su lista de rondas. Descarta lo que no tiene número.
#' @noRd
.monitoreo_supervision_rondas_normalizar <- function(x) {
  rondas <- if (is.list(x) && !is.null(x$rondas)) x$rondas else x
  if (!is.list(rondas) || !length(rondas)) return(list())
  out <- lapply(rondas, function(r) {
    if (!is.list(r)) return(NULL)
    numero <- .monitoreo_int(r$numero, NA_integer_)
    if (is.na(numero) || numero < 1L) return(NULL)
    casos <- .monitoreo_supervision_df(r$casos, .MONITOREO_SUPERVISION_CASO_COLS)
    casos$N <- as.integer(casos$N)
    reparto <- .monitoreo_supervision_df(r$reparto, c("Enumerador", "Efectivas", "Casos", "Mínimo"))
    reparto$Efectivas <- as.integer(reparto$Efectivas)
    reparto$Casos <- as.integer(reparto$Casos)
    reparto$`Mínimo` <- as.logical(reparto$`Mínimo`)
    porcentaje <- suppressWarnings(as.numeric(.monitoreo_scalar(r$porcentaje, NA)))
    list(
      numero = numero, guardada = TRUE,
      generada_el = .monitoreo_scalar(r$generada_el, ""),
      semilla = .monitoreo_int(r$semilla, NA_integer_),
      porcentaje = porcentaje,
      cantidad = .monitoreo_int(r$cantidad, 0L),
      universo = .monitoreo_int(r$universo, 0L),
      corte_anterior = .monitoreo_scalar(r$corte_anterior, ""),
      corte = .monitoreo_scalar(r$corte, ""),
      universo_claves = unique(.monitoreo_chr_vec(r$universo_claves)),
      casos = casos, reparto = reparto,
      publicada = if (is.list(r$publicada) && length(r$publicada)) list(
        en = .monitoreo_scalar(r$publicada$en, ""),
        spreadsheet_id = .monitoreo_scalar(r$publicada$spreadsheet_id, ""),
        pestana = .monitoreo_scalar(r$publicada$pestana, ""),
        filas = .monitoreo_int(r$publicada$filas, 0L)
      ) else NULL
    )
  })
  out <- Filter(Negate(is.null), out)
  out[order(vapply(out, function(r) r$numero, integer(1)))]
}

#' El estado lee las rondas guardadas de la sesión para el reporte. La clave
#' de sesión es la fuente de verdad; se inyecta al derivar el estado en
#' `cfg$monitoreo_profile$supervision_rondas`, porque el dashboard vuelve a
#' normalizar el config y solo el perfil conserva la clave (ver
#' `.monitoreo_profile_supervision_rondas`). Siempre pisa: sin rondas en la
#' sesión, ninguna copia vieja del perfil sobrevive.
#' @noRd
.monitoreo_supervision_rondas_en_cfg <- function(cfg, s) {
  if (!is.list(cfg)) return(cfg)
  rondas <- .monitoreo_supervision_rondas_normalizar((s %||% list())[["monitoreo_supervision_rondas"]])
  perfil <- cfg$monitoreo_profile %||% list()
  perfil$supervision_rondas <- if (length(rondas)) rondas else NULL
  cfg$monitoreo_profile <- perfil
  cfg
}

#' Rondas que viajan en el perfil normalizado (solo de lectura, inyectadas
#' desde la sesión). Se llama desde `.monitoreo_profile_equivalencias`.
#' @noRd
.monitoreo_profile_supervision_rondas <- function(out, profile) {
  rondas <- .monitoreo_supervision_rondas_normalizar(profile[["supervision_rondas"]])
  if (length(rondas)) out[["supervision_rondas"]] <- rondas
  out
}

# Las rondas que lee el reporte, desde el config ya inyectado.
.monitoreo_supervision_rondas_de_cfg <- function(cfg) {
  .monitoreo_supervision_rondas_normalizar(((cfg %||% list())$monitoreo_profile %||% list())$supervision_rondas)
}

#' Bloque `supervision_rondas`, una fila por ronda.
#' @noRd
.monitoreo_supervision_rondas_df <- function(rondas) {
  if (!length(rondas)) {
    return(data.frame(Ronda = integer(0), Guardada = character(0), `Generada el` = character(0), Semilla = integer(0),
                      Porcentaje = numeric(0), Universo = integer(0), `Corte anterior` = character(0), Corte = character(0),
                      Sorteados = integer(0), Agregados = integer(0), Casos = integer(0), `Publicada en` = character(0),
                      `Publicada el` = character(0), check.names = FALSE, stringsAsFactors = FALSE))
  }
  do.call(rbind, lapply(rondas, function(r) {
    origen <- .monitoreo_supervision_texto(r$casos$Origen)
    data.frame(
      Ronda = as.integer(r$numero), Guardada = if (isTRUE(r$guardada)) "Sí" else "No",
      `Generada el` = r$generada_el %||% "", Semilla = as.integer(r$semilla %||% NA_integer_),
      Porcentaje = as.numeric(r$porcentaje %||% NA_real_), Universo = as.integer(r$universo %||% 0L),
      `Corte anterior` = r$corte_anterior %||% "", Corte = r$corte %||% "",
      Sorteados = sum(origen == "sorteo"), Agregados = sum(origen == "analista"), Casos = length(origen),
      `Publicada en` = if (is.list(r$publicada)) r$publicada$pestana else "",
      `Publicada el` = if (is.list(r$publicada)) r$publicada$en else "",
      check.names = FALSE, stringsAsFactors = FALSE
    )
  }))
}

# Fecha más reciente de un vector (ISO o dd/mm/aaaa), en ISO; "" si ninguna.
.monitoreo_supervision_fecha_max <- function(x) {
  x <- .monitoreo_supervision_texto(x)
  x <- x[nzchar(x)]
  if (!length(x)) return("")
  iso <- suppressWarnings(as.Date(substr(x, 1L, 10L), format = "%Y-%m-%d"))
  dmy <- suppressWarnings(as.Date(substr(x, 1L, 10L), format = "%d/%m/%Y"))
  fechas <- iso
  fechas[is.na(fechas)] <- dmy[is.na(fechas)]
  if (all(is.na(fechas))) return("")
  format(max(fechas, na.rm = TRUE), "%Y-%m-%d")
}

#' Efectivas que ninguna ronda guardada tuvo en su universo ni como caso.
#' @noRd
.monitoreo_supervision_universo_nuevo <- function(base, guardadas) {
  vistos <- unique(unlist(lapply(guardadas, function(r) c(r$universo_claves, .monitoreo_nombre_clave(r$casos$CodPulso)))))
  base[!.monitoreo_nombre_clave(base$CodPulso) %in% vistos, , drop = FALSE]
}

#' Arma la ronda siguiente (no la guarda).
#'
#' `base`: `.monitoreo_supervision_base`. `porcentaje`: 0–100, o NULL solo
#' cuando no hay rondas guardadas (guarda la Ronda 1 de supervision_n tal
#' cual). `agregados`: CodPulso o Response ID que el analista quiere.
#' @noRd
.monitoreo_supervision_ronda_nueva <- function(base, guardadas, cfg = list(), porcentaje = NULL, agregados = character(0),
                                               semilla = NULL, ahora = .monitoreo_now_iso()) {
  numero <- length(guardadas) + 1L
  agregados <- unique(trimws(.monitoreo_chr_vec(agregados)))
  agregados <- agregados[nzchar(agregados)]
  if (is.null(porcentaje) && !length(guardadas) && !length(agregados)) {
    # Migración: la Ronda 1 sin guardar pasa a guardada, idéntica.
    virtual <- .monitoreo_supervision_ronda_virtual(base, cfg)
    if (!nrow(virtual$casos)) {
      stop_api(409, "E_MONITOREO_SUPERVISION_SIN_NUEVAS", "No hay efectivas de Kobo para sortear la Ronda 1.")
    }
    virtual$guardada <- TRUE
    virtual$generada_el <- ahora
    virtual$corte <- .monitoreo_supervision_fecha_max(base[["Fecha Kobo"]])
    virtual$casos <- virtual$casos[, .MONITOREO_SUPERVISION_CASO_COLS[-1], drop = FALSE]
    virtual$casos <- cbind(N = seq_len(nrow(virtual$casos)), virtual$casos)
    return(virtual)
  }
  pct <- suppressWarnings(as.numeric(.monitoreo_scalar(porcentaje, NA)))
  if (is.na(pct) || pct < 0 || pct > 100) {
    stop_api(400, "E_MONITOREO_SUPERVISION_PORCENTAJE",
             "Declara el porcentaje de la ronda: un número entre 0 y 100 de las efectivas nuevas.",
             list(porcentaje = .monitoreo_scalar(porcentaje, "")))
  }
  universo <- .monitoreo_supervision_universo_nuevo(base, guardadas)
  n <- if (pct > 0 && nrow(universo)) as.integer(ceiling(nrow(universo) * pct / 100)) else 0L
  semilla <- .monitoreo_int(semilla, .monitoreo_int(cfg$supervision_seed, 20260514L) + numero - 1L)
  sorteo <- .monitoreo_supervision_sorteo(universo, n, semilla)
  casos <- universo[sorteo$elegidas, , drop = FALSE]
  casos$Origen <- rep("sorteo", nrow(casos))

  if (length(agregados)) {
    claves <- .monitoreo_nombre_clave(base$CodPulso)
    ids <- .monitoreo_supervision_texto(base[["Response ID"]])
    pos <- vapply(agregados, function(a) {
      i <- match(.monitoreo_nombre_clave(a), claves)
      if (is.na(i)) i <- match(a, ids)
      as.integer(i)
    }, integer(1))
    if (anyNA(pos)) {
      stop_api(400, "E_MONITOREO_SUPERVISION_AGREGADO",
               "Hay casos agregados que no son efectivas de Kobo: revisa el CodPulso o el Response ID.",
               list(no_encontrados = as.list(agregados[is.na(pos)])))
    }
    ya <- unique(unlist(lapply(guardadas, function(r) .monitoreo_nombre_clave(r$casos$CodPulso))))
    repetidos <- agregados[claves[pos] %in% ya]
    if (length(repetidos)) {
      stop_api(409, "E_MONITOREO_SUPERVISION_REPETIDO",
               "Hay casos agregados que ya se supervisaron en una ronda anterior: nunca se repite un caso.",
               list(repetidos = as.list(repetidos)))
    }
    extra <- base[pos[!claves[pos] %in% .monitoreo_nombre_clave(casos$CodPulso)], , drop = FALSE]
    extra <- extra[!duplicated(extra$CodPulso), , drop = FALSE]
    if (nrow(extra)) {
      extra$Origen <- rep("analista", nrow(extra))
      casos <- rbind(casos, extra)
    }
  }
  if (!nrow(casos)) {
    stop_api(409, "E_MONITOREO_SUPERVISION_SIN_NUEVAS",
             sprintf("No hay efectivas nuevas desde la Ronda %d ni casos agregados: la Ronda %d quedaría vacía.", numero - 1L, numero),
             list(universo = nrow(universo)))
  }
  casos <- casos[order(casos$Origen != "sorteo", casos$Enumerador, casos$CodPulso), , drop = FALSE]
  casos <- cbind(N = seq_len(nrow(casos)), casos[, .MONITOREO_SUPERVISION_CASO_COLS[-1], drop = FALSE])
  rownames(casos) <- NULL
  anterior <- if (length(guardadas)) guardadas[[length(guardadas)]] else NULL
  list(
    numero = numero, guardada = TRUE, generada_el = ahora, semilla = semilla, porcentaje = pct, cantidad = n,
    universo = nrow(universo), corte_anterior = if (is.null(anterior)) "" else anterior$corte,
    corte = .monitoreo_supervision_fecha_max(universo[["Fecha Kobo"]]) %||% "",
    universo_claves = .monitoreo_nombre_clave(universo$CodPulso), casos = casos, reparto = sorteo$reparto,
    publicada = NULL
  )
}

# --- Pestaña de la hoja de supervisión -----------------------------------------

#' Filas de la pestaña «Ronda N», con las columnas de «Supervisión_Ronda3».
#' Lo que llena el supervisor va vacío; Status es el del barrido.
#'
#' `phone`: filas del barrido. `respuestas`: filas de Kobo. `preguntas`:
#' columnas de Kobo (nombre o etiqueta) cuya respuesta se lleva a la hoja.
#' `contactos`: columnas de teléfono del barrido.
#' @noRd
.monitoreo_supervision_ronda_filas <- function(ronda, phone = NULL, respuestas = NULL, preguntas = character(0), contactos = character(0)) {
  casos <- ronda$casos
  n <- nrow(casos)
  vacio <- rep("", n)
  # Caso → fila del barrido: por la columna de código o por proGres.
  fila_bar <- rep(NA_integer_, n)
  if (is.data.frame(phone) && nrow(phone) && n) {
    col_cod <- .monitoreo_telefonico_columna_codigo(phone)
    k_cod <- if (nzchar(col_cod)) .monitoreo_nombre_clave(phone[[col_cod]]) else rep("", nrow(phone))
    k_pg <- .monitoreo_nombre_clave(.monitoreo_discrepancias_progres(phone))
    for (i in seq_len(n)) {
      kc <- .monitoreo_nombre_clave(casos$CodPulso[[i]])
      kp <- .monitoreo_nombre_clave(casos$proGres[[i]])
      j <- which(nzchar(k_cod) & k_cod == kc)
      if (!length(j)) j <- which(nzchar(k_pg) & (k_pg == kc | (nzchar(kp) & k_pg == kp)))
      if (length(j)) fila_bar[[i]] <- j[[1]]
    }
  }
  de_bar <- function(valores) {
    out <- vacio
    ok <- !is.na(fila_bar)
    if (any(ok) && length(valores)) out[ok] <- .monitoreo_supervision_texto(valores[fila_bar[ok]])
    out
  }
  nombre <- if (is.data.frame(phone) && nrow(phone)) de_bar(.monitoreo_report_person_values(phone)) else vacio
  status <- if (is.data.frame(phone) && nrow(phone)) de_bar(.monitoreo_report_status_values(phone)) else vacio
  contactos <- contactos[contactos %in% names(phone %||% data.frame())]
  tel <- lapply(contactos, function(c) de_bar(phone[[c]]))
  tel_n <- function(i) if (length(tel) >= i) tel[[i]] else vacio
  final <- tel_n(1L)
  for (i in seq_along(tel)[-1]) final[!nzchar(final)] <- tel[[i]][!nzchar(final)]

  out <- data.frame(
    N = as.integer(casos$N), Fecha = .monitoreo_supervision_texto(casos[["Fecha Kobo"]]),
    `COD.proGres` = .monitoreo_supervision_texto(casos$proGres), `Código PULSO` = .monitoreo_supervision_texto(casos$CodPulso),
    `Nombre del encuestador/a` = .monitoreo_supervision_texto(casos$Enumerador),
    Origen = ifelse(casos$Origen == "analista", "Elegido por el analista", "Sorteo"),
    Nombre = nombre, Telefono_final = final, Tef1 = tel_n(1L), Tef2 = tel_n(2L), Tef3 = tel_n(3L),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  if (length(preguntas)) {
    ids <- if (is.data.frame(respuestas) && nrow(respuestas)) .monitoreo_report_first_values(respuestas, .MONITOREO_KOBO_ID_ALIAS) else character(0)
    fila_kobo <- match(.monitoreo_supervision_texto(casos[["Response ID"]]), ids)
    etiquetas <- c(.monitoreo_variable_label_map(respuestas), .monitoreo_source_variable_label_map(respuestas))
    for (p in preguntas) {
      col <- .monitoreo_supervision_col_exacta(respuestas, p)
      if (!nzchar(col)) {
        hit <- names(etiquetas)[.monitoreo_text_key(etiquetas) == .monitoreo_text_key(p)]
        col <- if (length(hit)) hit[[1]] else ""
      }
      if (!nzchar(col)) {
        stop_api(400, "E_MONITOREO_SUPERVISION_PREGUNTA",
                 sprintf("La pregunta de control «%s» no está en las respuestas de Kobo.", p), list(pregunta = p))
      }
      titulo <- if (col %in% names(etiquetas)) unname(etiquetas[[col]]) else col
      v <- vacio
      ok <- !is.na(fila_kobo)
      v[ok] <- .monitoreo_supervision_texto(respuestas[[col]][fila_kobo[ok]])
      out[[titulo]] <- v
    }
  }
  for (c in c("Observaciones", "Responsable de la supervisión")) out[[c]] <- vacio
  out$Status <- status
  for (c in c("Status supervisión", "Intentos supervisión", "Observaciones re barrido", "Status final")) out[[c]] <- vacio
  out
}

#' Fuente de la hoja de supervisión (rol `supervision`) con su documento.
#' @noRd
.monitoreo_supervision_fuente_hoja <- function(sources) {
  fuentes <- Filter(function(f) {
    is.list(f) && !isFALSE(f$enabled) && identical(.monitoreo_scalar(f$role, ""), .MONITOREO_SUPERVISION_ROL) &&
      nzchar(.monitoreo_scalar((f$sheet_binding %||% list())$spreadsheet_id, ""))
  }, sources %||% list())
  if (!length(fuentes)) {
    stop_api(409, "E_MONITOREO_SUPERVISION_HOJA",
             "Conecta la hoja de supervisión como fuente con rol «supervisión» antes de publicar la ronda.")
  }
  fuentes[[1]]
}

#' Publica la ronda en su pestaña «Ronda N». Solo crea esa pestaña (si no
#' existe) y escribe sus valores; nunca toca otra ni sobrescribe datos.
#' Devuelve la marca `publicada`.
#' @noRd
.monitoreo_supervision_publicar_ronda <- function(ronda, filas, spreadsheet_id, ahora = .monitoreo_now_iso()) {
  if (is.list(ronda$publicada)) {
    stop_api(409, "E_MONITOREO_SUPERVISION_PUBLICADA",
             sprintf("La Ronda %d ya se publicó en «%s» el %s; una ronda publicada no se reescribe.",
                     ronda$numero, ronda$publicada$pestana, ronda$publicada$en))
  }
  pestana <- sprintf("Ronda %d", ronda$numero)
  rango_tab <- .monitoreo_sheets_quote_sheet(pestana)
  base_url <- .monitoreo_sheets_api_base(spreadsheet_id)
  google <- function(expr) tryCatch(expr, api_error = function(e) stop(e), error = .monitoreo_sheets_stop)
  meta <- google(.monitoreo_sheets_metadata(spreadsheet_id))
  tabs <- .monitoreo_sheets_tab_map(meta)
  if (pestana %in% names(tabs)) {
    actual <- google(.monitoreo_google_api(paste0(base_url, "/values/", utils::URLencode(paste0(rango_tab, "!A1:Z5"), reserved = TRUE))))
    if (length(unlist(actual$values %||% list()))) {
      stop_api(409, "E_MONITOREO_SUPERVISION_PESTANA_OCUPADA",
               sprintf("La pestaña «%s» ya tiene datos en la hoja de supervisión; no se sobrescribe.", pestana))
    }
  } else {
    google(.monitoreo_sheets_batch_update(spreadsheet_id, list(list(addSheet = list(properties = list(
      title = pestana,
      gridProperties = list(rowCount = max(1000L, nrow(filas) + 10L), columnCount = max(26L, ncol(filas)), frozenRowCount = 1L)
    ))))))
  }
  valores <- c(
    list(as.list(names(filas))),
    lapply(seq_len(nrow(filas)), function(i) lapply(filas[i, , drop = TRUE], function(v) .monitoreo_sheets_sanitize_cell(v)))
  )
  google(.monitoreo_google_api(
    paste0(base_url, "/values:batchUpdate"), method = "POST",
    # RAW: las fechas y códigos quedan como el texto que se lee.
    body = list(valueInputOption = "RAW", data = list(list(range = paste0(rango_tab, "!A1"), values = valores)))
  ))
  list(en = ahora, spreadsheet_id = .monitoreo_extract_spreadsheet_id(spreadsheet_id), pestana = pestana, filas = nrow(filas))
}

# --- Endpoints --------------------------------------------------------------------

# Data, config, fuentes y la base de la supervisión del corte actual. La base
# sale del mismo bloque del reporte (`supervision_base`), sin rondas en el cfg.
.monitoreo_supervision_contexto <- function(sid) {
  s <- session_get(sid)
  sources <- monitoreo_normalize_sources(s$monitoreo_sources %||% list())
  derived <- monitoreo_state_derived(sid, s, sources)
  data <- derived$data
  if (!is.data.frame(data) || !nrow(data)) {
    stop_api(409, "E_MONITOREO_NO_SNAPSHOT", "Sincroniza Kobo y la hoja de barrido antes de sortear una ronda.")
  }
  cfg <- derived$cfg
  cfg$monitoreo_profile$supervision_rondas <- NULL
  bloques <- .monitoreo_report_phone_blocks(data, cfg$monitoreo_profile %||% list(), cfg)
  base_bloque <- Filter(function(b) identical(b$id, "supervision_base"), bloques)
  base <- .monitoreo_supervision_df(if (length(base_bloque)) base_bloque[[1]]$rows else list(),
                                     c("CodPulso", "proGres", "Enumerador", "Categoría", "Fecha Kobo", "Response ID"))
  list(s = s, sources = sources, data = data, cfg = cfg, base = base,
       rondas = .monitoreo_supervision_rondas_normalizar(s[["monitoreo_supervision_rondas"]]))
}

.monitoreo_supervision_guardar_rondas <- function(sid, rondas) {
  session_set(sid, "monitoreo_supervision_rondas", list(schema = .MONITOREO_SUPERVISION_RONDAS_SCHEMA, rondas = rondas))
  .monitoreo_mark_project_dirty_if_open(sid)
  invisible(rondas)
}

# Ronda para el cliente: casos y reparto como filas.
.monitoreo_supervision_ronda_payload <- function(r) {
  r$universo_claves <- NULL
  r$casos <- .monitoreo_report_records(r$casos)
  r$reparto <- .monitoreo_report_records(r$reparto)
  r
}

mount_monitoreo_supervision_rondas <- function(pr) {
  pr |>
    plumber::pr_get("/api/monitoreo/telefonico/supervision/rondas", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      rondas <- .monitoreo_supervision_rondas_normalizar(session_get(sid)[["monitoreo_supervision_rondas"]])
      list(ok = TRUE, schema = .MONITOREO_SUPERVISION_RONDAS_SCHEMA, rondas = lapply(rondas, .monitoreo_supervision_ronda_payload))
    })) |>
    plumber::pr_post("/api/monitoreo/telefonico/supervision/ronda", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      ctx <- .monitoreo_supervision_contexto(sid)
      ronda <- .monitoreo_supervision_ronda_nueva(
        ctx$base, ctx$rondas, ctx$cfg,
        porcentaje = parsed$porcentaje, agregados = parsed$agregados %||% list(), semilla = parsed$semilla
      )
      rondas <- .monitoreo_supervision_guardar_rondas(sid, c(ctx$rondas, list(ronda)))
      list(ok = TRUE, ronda = .monitoreo_supervision_ronda_payload(ronda),
           rondas = lapply(rondas, .monitoreo_supervision_ronda_payload), state = .monitoreo_state_payload(sid))
    })) |>
    plumber::pr_post("/api/monitoreo/telefonico/supervision/ronda/publicar", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      ctx <- .monitoreo_supervision_contexto(sid)
      numero <- .monitoreo_int(parsed$numero %||% parsed$ronda, NA_integer_)
      i <- match(numero, vapply(ctx$rondas, function(r) r$numero, integer(1)))
      if (is.na(i)) {
        stop_api(404, "E_MONITOREO_SUPERVISION_RONDA", "Esa ronda no está guardada: genera la ronda antes de publicarla.",
                 list(numero = .monitoreo_scalar(parsed$numero %||% parsed$ronda, "")))
      }
      fuente <- .monitoreo_supervision_fuente_hoja(ctx$sources)
      data <- ctx$data
      phone <- .monitoreo_report_phone_data(.monitoreo_report_phone_scope_data(data, ctx$cfg$monitoreo_profile %||% list(), ctx$cfg))
      respuestas <- data[.monitoreo_report_role_mask(data, "respuestas"), , drop = FALSE]
      contactos <- .monitoreo_chr_vec(((ctx$cfg$operational_model %||% list())$cases %||% list())$contact_vars)
      filas <- .monitoreo_supervision_ronda_filas(ctx$rondas[[i]], phone, respuestas,
                                                  .monitoreo_chr_vec(parsed$preguntas), contactos)
      ctx$rondas[[i]]$publicada <- .monitoreo_supervision_publicar_ronda(ctx$rondas[[i]], filas, fuente$sheet_binding$spreadsheet_id)
      rondas <- .monitoreo_supervision_guardar_rondas(sid, ctx$rondas)
      list(ok = TRUE, ronda = .monitoreo_supervision_ronda_payload(rondas[[i]]),
           rondas = lapply(rondas, .monitoreo_supervision_ronda_payload), state = .monitoreo_state_payload(sid))
    }))
}

# collection_mail_contactos.R — pestaña Contactos de una campaña de correo
# (ADR 0112 §3 y §4): la lista con búsqueda, filtros y página, el tablero por
# variables de control y la marca de quién respondió.
#
# Aquí SÍ salen correos: la app es local y la lista es de la persona que la
# importó. El modo público no expone ninguna de estas rutas (el filtro de
# forbid_mutations.R las bloquea con 403 y, por si un día se montaran, el
# engine también: `.cmail_contactos_assert_local`).
#
# Unidad y partición (las de collection_mail_recipients.R): cada fila no vacía
# de la lista es exactamente una de
#   efectivo        correo válido y primera aparición del correo
#   sin_correo      sin correo
#   correo_invalido correo con forma inválida
#   repetido        correo válido ya visto en una fila anterior
#
# Tablero. Base = efectivos del corte (los filtros por categoría aplican al
# tablero entero y a la lista). Para cada variable de control:
#   sum(categorias$n) + sin_dato$n == base
# Valor vacío o marcador de vacío (NA, N/A, -, s/d) cuenta como «sin dato».
# Porcentajes y tasas en escala 0–100, con un decimal, siempre junto a su
# frecuencia. La tasa de respuesta es respondieron / n de esa categoría (los
# contactos sin enlace cuentan en el denominador: no pudieron cruzarse, y el
# tablero lo dice con `con_enlace`). Una variable con más de 30 valores
# distintos es «muchas»: no se agrega salvo que se elija, y elegida muestra los
# 30 más frecuentes y agrupa el resto en «Otros» (`otros: true`).
#
# Marca de respuesta (claves opcionales del store):
#   respondio     named logical  correo -> respondió (TRUE/FALSE) en la última
#                                lectura; solo contactos con token
#   respondio_en  named chr      correo -> cuándo se vio su respuesta por primera vez
#   lectura       list(leido_en, survey_id, respondieron)
# Sin lectura, `respondio` es null para todos; con lectura, null para quien no
# tiene token (no se pudo cruzar).
#
# Variables de control: nombres de columna en la campaña
# (`collection_state$mail_campaigns[[i]]$contact_control`). Clave de SERVIDOR
# como el registro de exportación (collection_mail_export_registro.R): escribirla
# no sube `state_revision` (no deja obsoleto el editor abierto) y sí marca
# `project_dirty`. Nunca guarda valores: solo nombres de columna, que la
# importación ya garantiza sin forma de correo.

.CMAIL_CONTACTS_PER_PAGE <- 50L
.CMAIL_CONTACTS_PER_PAGE_MAX <- 500L
.CMAIL_PERFIL_MUCHAS <- 30L
.CMAIL_CONTROL_MAX <- 12L
.CMAIL_CONTACT_ESTADOS <- c("efectivo", "sin_correo", "correo_invalido", "repetido")

# ---- resguardos y utilidades ------------------------------------------------

.cmail_contactos_assert_local <- function() {
  if (isTRUE(is_public_mode())) {
    stop_api(403, "E_PUBLIC_MODE", "Los contactos de una campaña no se exponen en modo público.")
  }
  invisible(TRUE)
}

# Toda mutación de los contactos marca el proyecto (ADR 0112 §1).
.cmail_contactos_touch <- function(sid) {
  s <- session_get(sid)
  .session_env[[sid]] <- .mark_project_dirty(s)
  invisible(TRUE)
}

.cmail_query_bad <- function(msg) stop_api(422, "E_COLLECTION_MAIL_CONTACTS_QUERY", msg)

.cmail_int_arg <- function(x, default, min, max, what) {
  if (is.null(x) || (length(x) == 1L && !is.na(x) && !nzchar(as.character(x)))) return(as.integer(default))
  v <- suppressWarnings(as.integer(as.character(unlist(x))[1]))
  if (is.na(v) || v < min || v > max) .cmail_query_bad(sprintf("%s va de %d a %d.", what, min, max))
  v
}

.cmail_choice_arg <- function(x, choices, default, what) {
  v <- .cmail_one(as.list(x %||% list(default))) %||% default
  if (!nzchar(v)) v <- default
  if (!(v %in% choices)) .cmail_query_bad(sprintf("%s es %s.", what, paste(choices, collapse = ", ")))
  v
}

.cmail_fold <- function(x) tolower(stringi::stri_trans_general(as.character(x), "Latin-ASCII"))

# ---- la lista como tabla de trabajo ------------------------------------------

# Columnas que se muestran como «valores» (todo menos correo y nombre).
.cmail_contact_columns <- function(store) {
  m <- store$mapping
  setdiff(names(store$rows), c(m$email_column, m$name_column))
}

# Columnas que pueden ser variable de control: además, sin el enlace generado.
.cmail_control_candidates <- function(store) setdiff(.cmail_contact_columns(store), .CMAIL_ENLACE_COLUMN)

# Columnas que la lista muestra en `columnas`/`valores`: sin el enlace generado
# (es una URL cruda por persona; la fila ya dice `tiene_enlace` y el resumen
# trae `enlace_url`). Decisión 2026-10-22: se EXCLUYE en vez de marcarla con
# `es_enlace`, para que la UI no tenga que saber esconderla. Los filtros siguen
# aceptando cualquier columna de `.cmail_contact_columns`.
.cmail_list_columns <- function(store) .cmail_control_candidates(store)

#' Tabla de trabajo de una campaña: estado, correo, enlace y respuesta por fila.
#' @keywords internal
.cmail_contact_frame <- function(store) {
  m <- store$mapping
  n <- nrow(store$rows)
  email <- if (!is.null(m$email_column)) .cmail_email_normalize(store$rows[[m$email_column]]) else rep("", n)
  has <- nzchar(email)
  valid <- has & .cmail_email_valid(email)
  key <- tolower(email)
  dup <- rep(FALSE, n)
  dup[valid] <- duplicated(key[valid])
  estado <- ifelse(!has, "sin_correo", ifelse(!valid, "correo_invalido", ifelse(dup, "repetido", "efectivo")))
  efectivo <- estado == "efectivo"
  tokens <- store$tokens %||% character(0)
  url <- (store$enlace %||% list())$url
  # Enlace y respuesta son de la fila efectiva de cada persona: la fila repetida
  # no está en la campaña (no sale en la audiencia) y no se cuenta dos veces.
  tiene_enlace <- !is.null(url) & efectivo & key %in% names(tokens)
  leidas <- !is.null(store$lectura)
  respondio <- rep(NA, n)
  if (leidas) {
    marks <- store$respondio %||% logical(0)
    hit <- efectivo & key %in% names(marks)
    respondio[hit] <- as.logical(marks[key[hit]])
  }
  nombre <- if (!is.null(m$name_column)) .cmail_value(store$rows[[m$name_column]]) else rep("", n)
  list(
    n = n, email = email, key = key, estado = estado, efectivo = efectivo,
    tiene_enlace = tiene_enlace, respondio = respondio, leidas = leidas, nombre = nombre,
    fila = as.integer(store$source_row %||% (seq_len(n) + 1L))
  )
}

# filtros = JSON {columna: [valores]}; "" o null = sin dato. Devuelve la máscara.
.cmail_contact_filter_mask <- function(store, filtros) {
  n <- nrow(store$rows)
  mask <- rep(TRUE, n)
  if (is.null(filtros)) return(mask)
  if (is.character(filtros)) {
    txt <- paste(filtros, collapse = "")
    if (!nzchar(trimws(txt))) return(mask)
    filtros <- tryCatch(jsonlite::fromJSON(txt, simplifyVector = FALSE),
                        error = function(e) .cmail_query_bad("filtros no es JSON válido ({columna: [valores]})."))
  }
  if (!is.list(filtros) || (length(filtros) && is.null(names(filtros)))) {
    .cmail_query_bad("filtros es un objeto {columna: [valores]}.")
  }
  cols <- .cmail_contact_columns(store)
  for (col in names(filtros)) {
    if (!(col %in% cols)) .cmail_query_bad(sprintf("filtros: «%s» no es una columna de la lista.", col))
    raw <- filtros[[col]]
    if (!is.list(raw)) raw <- as.list(raw)
    if (!length(raw)) next
    wanted <- vapply(raw, function(v) if (is.null(v) || (length(v) == 1L && is.na(v))) "" else as.character(v)[1], "")
    mask <- mask & (.cmail_value(store$rows[[col]]) %in% .cmail_value(wanted))
  }
  mask
}

.cmail_no_store_resumen <- function() {
  list(importados = 0L, efectivos = 0L, sin_correo = 0L, correo_invalido = 0L, repetidos = 0L,
       con_enlace = 0L, respondieron = NA_integer_, leido_en = NA_character_, enlace_url = NA_character_,
       enlace_variable = NA_character_)
}

.cmail_contact_resumen <- function(store, fr) {
  list(
    importados = as.integer(fr$n),
    efectivos = as.integer(sum(fr$efectivo)),
    sin_correo = as.integer(sum(fr$estado == "sin_correo")),
    correo_invalido = as.integer(sum(fr$estado == "correo_invalido")),
    repetidos = as.integer(sum(fr$estado == "repetido")),
    con_enlace = as.integer(sum(fr$efectivo & fr$tiene_enlace)),
    respondieron = if (fr$leidas) as.integer(sum(fr$efectivo & fr$respondio %in% TRUE)) else NA_integer_,
    leido_en = if (fr$leidas) as.character(store$lectura$leido_en %||% NA_character_) else NA_character_,
    # El enlace del recopilador y la variable de la encuesta con que se
    # generaron los enlaces (store$enlace, collection_mail_enlace.R); null si
    # aún no se generaron.
    enlace_url = .cmail_enlace_url_of(store),
    enlace_variable = .cmail_enlace_variable_saved(store)
  )
}

# ---- lista ---------------------------------------------------------------------

#' `GET /api/recopiladores/mail-contacts`: la lista con correos, filtrada y paginada.
#' @keywords internal
collection_mail_contacts_list <- function(sid, campaign_id = NULL, q = NULL, estado = NULL, filtros = NULL,
                                          respondio = NULL, page = NULL, per_page = NULL) {
  .cmail_contactos_assert_local()
  session <- session_get(sid)
  pick <- .cmail_campaign_for(session, .collection_current(session), campaign_id)
  estado <- .cmail_choice_arg(estado, c(.CMAIL_CONTACT_ESTADOS, "todos"), "todos", "estado")
  respondio <- .cmail_choice_arg(respondio, c("si", "no", "todos"), "todos", "respondio")
  page <- .cmail_int_arg(page, 1L, 1L, .Machine$integer.max, "page")
  per_page <- .cmail_int_arg(per_page, .CMAIL_CONTACTS_PER_PAGE, 1L, .CMAIL_CONTACTS_PER_PAGE_MAX, "per_page")
  store <- .cmail_recipients_load(session, pick$campaign$campaign_id)
  if (is.null(store)) {
    return(list(ok = TRUE, campaign_id = pick$campaign$campaign_id, cargados = FALSE, total = 0L, page = page,
                per_page = per_page, columnas = list(), rows = list(), resumen = .cmail_no_store_resumen()))
  }
  fr <- .cmail_contact_frame(store)
  cols <- .cmail_list_columns(store)
  labels <- .cmail_column_labels(store, .cmail_contactos_template(pick$campaign), cols)
  mask <- .cmail_contact_filter_mask(store, filtros)
  if (!identical(estado, "todos")) mask <- mask & fr$estado == estado
  if (identical(respondio, "si")) mask <- mask & fr$respondio %in% TRUE
  if (identical(respondio, "no")) mask <- mask & fr$respondio %in% FALSE
  query <- .cmail_one(as.list(q %||% list(NA_character_)))
  if (!is.null(query) && nzchar(trimws(query))) {
    needle <- .cmail_fold(trimws(query))
    parts <- c(list(fr$email, fr$nombre), lapply(cols, function(c) .cmail_value(store$rows[[c]])))
    hay <- .cmail_fold(do.call(paste, c(parts, sep = "\u001f")))
    mask <- mask & grepl(needle, hay, fixed = TRUE)
  }
  idx <- which(mask)
  from <- (page - 1L) * per_page
  take <- if (from >= length(idx)) integer(0) else idx[seq.int(from + 1L, min(length(idx), from + per_page))]
  values <- lapply(stats::setNames(cols, cols), function(c) .cmail_value(store$rows[[c]]))
  na_if_empty <- function(x) if (nzchar(x)) x else NA_character_
  rows <- lapply(take, function(i) {
    vals <- lapply(values, function(v) na_if_empty(v[[i]]))
    if (!length(vals)) vals <- structure(list(), names = character(0))
    list(fila = fr$fila[[i]], email = na_if_empty(fr$email[[i]]), nombre = na_if_empty(fr$nombre[[i]]),
         estado = fr$estado[[i]], tiene_enlace = isTRUE(fr$tiene_enlace[[i]]), respondio = fr$respondio[[i]],
         valores = vals)
  })
  list(
    ok = TRUE, campaign_id = pick$campaign$campaign_id, cargados = TRUE,
    total = length(idx), page = page, per_page = per_page,
    columnas = lapply(cols, function(c) list(key = c, label = labels[[c]])),
    rows = rows,
    resumen = .cmail_contact_resumen(store, fr)
  )
}

# ---- tablero por perfil ----------------------------------------------------------

.cmail_pct <- function(n, base) if (base > 0) round(100 * n / base, 1) else NA_real_

# Frecuencias de una columna en la base: ordenadas por n desc (y valor), con
# «Otros» si pasa de 30. Devuelve list(valores, n, otros) sin el vacío.
.cmail_freq <- function(v) {
  v <- v[nzchar(v)]
  if (!length(v)) return(list(valor = character(0), n = integer(0), otros = logical(0), miembros = list()))
  tab <- table(v)
  ord <- order(-as.integer(tab), names(tab))
  valor <- names(tab)[ord]
  n <- as.integer(tab)[ord]
  miembros <- as.list(valor)
  otros <- rep(FALSE, length(valor))
  if (length(valor) > .CMAIL_PERFIL_MUCHAS) {
    keep <- seq_len(.CMAIL_PERFIL_MUCHAS)
    rest <- setdiff(seq_along(valor), keep)
    miembros <- c(miembros[keep], list(valor[rest]))
    valor <- c(valor[keep], "Otros")
    n <- c(n[keep], sum(n[rest]))
    otros <- c(rep(FALSE, length(keep)), TRUE)
  }
  list(valor = valor, n = n, otros = otros, miembros = miembros)
}

.cmail_perfil_variable <- function(store, key, base_idx, fr, label = key) {
  v <- .cmail_value(store$rows[[key]])[base_idx]
  resp <- fr$respondio[base_idx]
  link <- fr$tiene_enlace[base_idx]
  base <- length(base_idx)
  f <- .cmail_freq(v)
  cats <- lapply(seq_along(f$valor), function(j) {
    in_cat <- v %in% f$miembros[[j]]
    n <- f$n[[j]]
    r <- if (fr$leidas) as.integer(sum(resp[in_cat] %in% TRUE)) else NA_integer_
    out <- list(valor = f$valor[[j]], n = as.integer(n), pct = .cmail_pct(n, base), respondieron = r,
                tasa = if (fr$leidas && n > 0) round(100 * r / n, 1) else NA_real_,
                con_enlace = as.integer(sum(link[in_cat])))
    if (isTRUE(f$otros[[j]])) out$otros <- TRUE
    out
  })
  empty <- !nzchar(v)
  n0 <- sum(empty)
  r0 <- if (fr$leidas) as.integer(sum(resp[empty] %in% TRUE)) else NA_integer_
  list(key = key, label = label, categorias = cats,
       sin_dato = list(n = as.integer(n0), pct = .cmail_pct(n0, base), respondieron = r0,
                       tasa = if (fr$leidas && n0 > 0) round(100 * r0 / n0, 1) else NA_real_))
}

# Cruce de dos variables en la base. Filas/columnas: categorías (top 30 +
# «Otros») y, si hay, el «sin dato» como null al final.
.cmail_perfil_cruce <- function(store, a, b, base_idx, labels = c()) {
  dim_of <- function(key) {
    v <- .cmail_value(store$rows[[key]])[base_idx]
    f <- .cmail_freq(v)
    labels <- as.list(f$valor)
    groups <- f$miembros
    if (any(!nzchar(v))) {
      labels <- c(labels, list(NA_character_))
      groups <- c(groups, list(""))
    }
    code <- rep(NA_integer_, length(v))
    for (j in seq_along(groups)) code[v %in% groups[[j]]] <- j
    list(labels = labels, code = code)
  }
  da <- dim_of(a)
  db <- dim_of(b)
  celdas <- lapply(seq_along(da$labels), function(i) {
    as.list(vapply(seq_along(db$labels), function(j) as.integer(sum(da$code == i & db$code == j)), integer(1)))
  })
  lab <- function(k) if (k %in% names(labels)) labels[[k]] else .cmail_rotulo_de_clave(k)
  list(a = a, b = b, a_label = lab(a), b_label = lab(b), filas = da$labels, columnas = db$labels, celdas = celdas)
}

.cmail_campaign_control <- function(campaign, store = NULL) {
  ctl <- unlist(campaign$contact_control %||% list(), use.names = FALSE)
  ctl <- as.character(ctl)
  if (!is.null(store)) ctl <- intersect(ctl, .cmail_control_candidates(store))
  ctl
}

#' `GET /api/recopiladores/mail-contacts/perfil`: el tablero por variables de control.
#' @param cruce "keyA,keyB" (opcional).
#' @keywords internal
collection_mail_contacts_perfil <- function(sid, campaign_id = NULL, filtros = NULL, cruce = NULL) {
  .cmail_contactos_assert_local()
  session <- session_get(sid)
  pick <- .cmail_campaign_for(session, .collection_current(session), campaign_id)
  store <- .cmail_recipients_load(session, pick$campaign$campaign_id)
  if (is.null(store)) {
    return(list(ok = TRUE, campaign_id = pick$campaign$campaign_id, cargados = FALSE, base = 0L,
                control = as.list(.cmail_campaign_control(pick$campaign)), candidatas = list(), variables = list(),
                cruce = NA, respuestas_leidas = FALSE, enlace_url = NA_character_,
                enlace_variable = NA_character_))
  }
  fr <- .cmail_contact_frame(store)
  mask <- .cmail_contact_filter_mask(store, filtros)
  base_idx <- which(mask & fr$efectivo)
  all_eff <- which(fr$efectivo)
  cands <- .cmail_control_candidates(store)
  labels <- .cmail_column_labels(store, .cmail_contactos_template(pick$campaign), cands)
  candidatas <- lapply(cands, function(k) {
    v <- .cmail_value(store$rows[[k]])[all_eff]
    d <- length(unique(v[nzchar(v)]))
    list(key = k, label = labels[[k]], distintos = as.integer(d),
         tipo = if (d > .CMAIL_PERFIL_MUCHAS) "muchas" else "categorica")
  })
  control <- .cmail_campaign_control(pick$campaign, store)
  cruce_out <- NA
  cr <- .cmail_one(as.list(cruce %||% list(NA_character_)))
  if (!is.null(cr) && nzchar(trimws(cr))) {
    ab <- trimws(strsplit(cr, ",", fixed = TRUE)[[1]])
    if (length(ab) != 2L || !all(ab %in% cands) || identical(ab[[1]], ab[[2]])) {
      .cmail_query_bad("cruce son dos columnas distintas de la lista: «columnaA,columnaB».")
    }
    cruce_out <- .cmail_perfil_cruce(store, ab[[1]], ab[[2]], base_idx, labels)
  }
  list(
    ok = TRUE, campaign_id = pick$campaign$campaign_id, cargados = TRUE,
    base = length(base_idx),
    control = as.list(control),
    candidatas = candidatas,
    variables = lapply(control, function(k) .cmail_perfil_variable(store, k, base_idx, fr, labels[[k]])),
    cruce = cruce_out,
    respuestas_leidas = isTRUE(fr$leidas),
    enlace_url = .cmail_enlace_url_of(store),
    enlace_variable = .cmail_enlace_variable_saved(store)
  )
}

#' `PUT /api/recopiladores/mail-contacts/control`: guarda las variables de control.
#' @keywords internal
collection_mail_contacts_control_put <- function(sid, campaign_id = NULL, variables = NULL) {
  .cmail_contactos_assert_local()
  session <- session_get(sid)
  state <- .collection_current(session)
  pick <- .cmail_campaign_for(session, state, campaign_id)
  if (isTRUE(pick$virtual)) {
    stop_api(409, "E_COLLECTION_MAIL_CONTACTS_CONTROL",
             "Guarda primero la campaña: las variables de control son de una campaña guardada.")
  }
  store <- .cmail_recipients_load(session, pick$campaign$campaign_id)
  if (is.null(store)) stop_api(409, "E_COLLECTION_MAIL_NO_RECIPIENTS", "Primero importa los contactos.")
  vars <- .cmail_strings(variables)
  if (is.null(vars)) {
    stop_api(422, "E_COLLECTION_MAIL_CONTACTS_CONTROL", "variables es una lista de nombres de columna.")
  }
  vars <- unique(unlist(vars, use.names = FALSE) %||% character(0))
  bad <- setdiff(vars, .cmail_control_candidates(store))
  if (length(bad)) {
    stop_api(422, "E_COLLECTION_MAIL_CONTACTS_CONTROL", "Hay variables que no son columnas de la lista.",
             details = list(variables = as.list(bad)))
  }
  if (length(vars) > .CMAIL_CONTROL_MAX) {
    stop_api(422, "E_COLLECTION_MAIL_CONTACTS_CONTROL",
             sprintf("Elige hasta %d variables de control.", .CMAIL_CONTROL_MAX))
  }
  campaigns <- pick$set$campaigns
  ids <- vapply(campaigns, function(c) as.character(c$campaign_id), "")
  at <- match(pick$campaign$campaign_id, ids)
  campaigns[[at]]$contact_control <- as.list(vars)
  fresh <- session_get(sid)
  st <- fresh$collection_state
  st$mail_campaigns <- list(schema = COLLECTION_MAIL_CAMPAIGNS_SCHEMA, campaigns = unname(campaigns))
  st$mail_template <- NULL  # una campaña migrada se persiste como lista, como al registrar un export
  fresh$collection_state <- st
  .session_env[[sid]] <- .mark_project_dirty(fresh)
  list(ok = TRUE, campaign_id = pick$campaign$campaign_id, control = as.list(vars))
}

# ---- marca de quién respondió ------------------------------------------------------

#' Guarda en el store la lectura de SurveyMonkey: respondió (TRUE/FALSE) para
#' cada contacto con token, la fecha de la lectura y cuándo se vio por primera
#' vez cada respuesta. Corre en el proceso de la API (on_complete del job o la
#' variante síncrona): el worker callr no toca la sesión.
#'
#' @param tokens tokens de las respuestas completas que traían `t`.
#' @return número de contactos marcados como respondidos, o NULL si no hay store.
#' @keywords internal
.cmail_respuestas_apply <- function(sid, campaign_id, tokens, survey_id = NULL, leido_en = NULL) {
  session <- session_get(sid, required = FALSE)
  if (is.null(session)) return(NULL)
  store <- .cmail_recipients_load(session, campaign_id)
  if (is.null(store)) return(NULL)
  idx <- .mc_token_index(store, NULL)$index
  now <- leido_en %||% format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  people <- unique(unname(idx))
  answered <- unique(unname(idx[intersect(as.character(tokens), names(idx))]))
  marks <- stats::setNames(people %in% answered, people)
  first <- store$respondio_en %||% stats::setNames(character(0), character(0))
  first <- first[names(first) %in% answered]
  nuevos <- setdiff(answered, names(first))
  if (length(nuevos)) first[nuevos] <- now
  store$respondio <- marks
  store$respondio_en <- first
  store$lectura <- list(leido_en = now, survey_id = survey_id, respondieron = length(answered))
  .cmail_recipients_save(session, campaign_id, store)
  .cmail_contactos_touch(sid)
  length(answered)
}

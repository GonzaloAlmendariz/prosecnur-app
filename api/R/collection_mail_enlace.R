# collection_mail_enlace.R — enlace personal a la encuesta (ADR 0112 §2).
#
# La campaña declara el enlace del recopilador (`https://`) y la app genera,
# para cada contacto con correo válido, un token aleatorio de 10 caracteres
# `[A-Za-z0-9]`, único en la campaña. El enlace personal es
# `<recopilador>?<variable>=<token>` (o `&<variable>=` si el recopilador ya trae
# consulta) y se
# materializa como la columna `enlace_encuesta` («Enlace a la encuesta») de la
# lista: así lo ven el mapeo, la vista previa, audiencia.csv y el cruce de
# «quién respondió» (`.mc_token_of`, collection_mail_mailchimp.R) sin cambio de
# formato.
#
# La variable es la variable personalizada de la encuesta de SurveyMonkey:
# SurveyMonkey guarda un parámetro del enlace solo si se llama igual que una
# variable declarada en la encuesta. Por eso el nombre se declara por campaña
# (`t` por defecto; la encuesta puede usar `id` u otro) y se valida contra la
# encuesta al sincronizar (`collection_mail_mailchimp_check`).
#
# Dónde vive (claves opcionales del store de la campaña, que viaja en
# `files/contactos/<campaign_id>.rds`, collection_mail_contactos_pulso.R):
#   tokens   named chr  correo normalizado (minúsculas) -> token
#   enlace   list(url, variable, generado_en)  (sin `variable`: `t`)
#
# El token es de la PERSONA: se indexa por correo normalizado. Reimportar la
# lista conserva el token de quien ya estaba y genera uno solo para quien entra
# (`.cmail_enlace_carry`); cambiar el enlace del recopilador conserva todos los
# tokens. Un token emitido nunca se reasigna: quien sale de la lista conserva el
# suyo en el store (si vuelve, vuelve con él), y ningún token nuevo puede
# repetirlo.
#
# Decisión sobre la forma del enlace: se acepta cualquier `https://` sin
# espacios ni la variable propia; si no es un recopilador web de SurveyMonkey
# (`…surveymonkey.<tld>/r/<id>`) se genera igual y se devuelve un `aviso` que
# dice la consecuencia (no se sabrá quién respondió) y el arreglo, sin jerga.

.CMAIL_ENLACE_COLUMN <- "enlace_encuesta"
.CMAIL_ENLACE_LABEL <- "Enlace a la encuesta"
.CMAIL_TOKEN_LEN <- 10L
.CMAIL_TOKEN_ALPHABET <- c(LETTERS, letters, 0:9)
.CMAIL_ENLACE_URL_MAX <- 500L
.CMAIL_SM_COLLECTOR_RE <- "^https://([a-z0-9-]+\\.)*surveymonkey\\.[a-z.]+/r/[A-Za-z0-9_-]+/?(\\?.*)?$"
.CMAIL_ENLACE_VARIABLE_DEFAULT <- "t"
.CMAIL_ENLACE_VARIABLE_RE <- "^[A-Za-z][A-Za-z0-9_]{0,29}$"

# Normaliza y valida el nombre de la variable. NULL o vacío = la de siempre.
.cmail_enlace_variable_check <- function(variable) {
  value <- .cmail_one(as.list(variable %||% list(NA_character_)))
  if (is.null(value) || is.na(value) || !nzchar(trimws(value))) return(.CMAIL_ENLACE_VARIABLE_DEFAULT)
  value <- trimws(value)
  if (!grepl(.CMAIL_ENLACE_VARIABLE_RE, value)) {
    stop_api(422, "E_COLLECTION_MAIL_ENLACE_VARIABLE",
             "La variable va como en SurveyMonkey: empieza con una letra y lleva solo letras, números o «_» (por ejemplo «t» o «id»).")
  }
  value
}

# Variable con que se generaron (o generarán) los enlaces de la campaña.
.cmail_enlace_variable_of <- function(store) {
  value <- .cmail_one(as.list((store$enlace %||% list())$variable %||% list(NA_character_)))
  if (is.null(value) || is.na(value) || !nzchar(value)) .CMAIL_ENLACE_VARIABLE_DEFAULT else value
}

# Normaliza y valida el enlace del recopilador. Devuelve list(url, aviso).
.cmail_enlace_url_check <- function(url, variable = .CMAIL_ENLACE_VARIABLE_DEFAULT) {
  value <- .cmail_one(as.list(url %||% list(NA_character_)))
  bad <- function(msg) stop_api(422, "E_COLLECTION_MAIL_ENLACE_URL", msg)
  if (is.null(value) || !nzchar(trimws(value))) bad("Pega el enlace del recopilador (https://…).")
  value <- trimws(value)
  if (nchar(value) > .CMAIL_ENLACE_URL_MAX) bad(sprintf("El enlace pasa de %d caracteres.", .CMAIL_ENLACE_URL_MAX))
  if (grepl("[[:space:]<>\"']", value)) bad("El enlace no puede llevar espacios ni comillas.")
  if (!grepl("^https://[^/?#]+\\.[^/?#]+", value, ignore.case = TRUE)) {
    bad("El enlace debe empezar con https:// y tener un dominio.")
  }
  if (grepl("#", value, fixed = TRUE)) bad("El enlace no puede llevar «#»: el token quedaría fuera de la consulta.")
  if (grepl(sprintf("[?&]%s=", variable), value)) {
    bad(sprintf("El enlace ya trae la variable «%s»: pega el enlace del recopilador tal como lo da SurveyMonkey; la app agrega la de cada persona.", variable))
  }
  if (grepl(.CMAIL_EMAIL_LIKE_RE, value)) bad("El enlace no puede llevar una dirección de correo.")
  aviso <- if (!grepl(.CMAIL_SM_COLLECTOR_RE, value, ignore.case = TRUE)) {
    "Este enlace no es de SurveyMonkey: los enlaces se generaron, pero la app no podrá saber quién respondió. Para eso, usa el enlace del recopilador web de SurveyMonkey."
  }
  list(url = value, aviso = aviso)
}

# Variable con que se generaron los enlaces (o NA si aún no se generaron).
.cmail_enlace_variable_saved <- function(store) {
  if (is.na(.cmail_enlace_url_of(store))) NA_character_ else .cmail_enlace_variable_of(store)
}

# URL del recopilador con que se generaron los enlaces (o NA si aún no).
.cmail_enlace_url_of <- function(store) {
  url <- .cmail_one(as.list((store$enlace %||% list())$url %||% list(NA_character_)))
  url %||% NA_character_
}

# `?<variable>=` o `&<variable>=` según la URL.
.cmail_enlace_join <- function(url, token, variable = .CMAIL_ENLACE_VARIABLE_DEFAULT) {
  sep <- if (grepl("?", url, fixed = TRUE)) (if (grepl("[?&]$", url)) "" else "&") else "?"
  paste0(url, sep, variable, "=", token)
}

# `n` tokens nuevos, distintos entre sí y de `taken`. Fuente criptográfica
# (openssl): el token es lo único que separa el enlace de una persona del de
# otra. Muestreo por rechazo para no sesgar el alfabeto (256 %% 62 != 0).
.cmail_token_new <- function(n, taken = character(0)) {
  out <- character(0)
  if (n <= 0L) return(out)
  limit <- 248L  # 4 * 62: el mayor múltiplo de 62 que cabe en un byte
  while (length(out) < n) {
    need <- (n - length(out)) * .CMAIL_TOKEN_LEN * 2L
    bytes <- as.integer(openssl::rand_bytes(need))
    bytes <- bytes[bytes < limit]
    k <- length(bytes) %/% .CMAIL_TOKEN_LEN
    if (!k) next
    idx <- matrix(bytes[seq_len(k * .CMAIL_TOKEN_LEN)] %% 62L + 1L, nrow = k, byrow = TRUE)
    cand <- apply(idx, 1L, function(r) paste(.CMAIL_TOKEN_ALPHABET[r], collapse = ""))
    cand <- cand[!duplicated(cand) & !(cand %in% taken) & !(cand %in% out)]
    out <- c(out, cand)
  }
  out[seq_len(n)]
}

# Claves (correo normalizado en minúsculas) de cada fila, y cuáles son válidas.
.cmail_contact_keys <- function(store) {
  col <- store$mapping$email_column
  n <- nrow(store$rows)
  email <- if (!is.null(col)) .cmail_email_normalize(store$rows[[col]]) else rep("", n)
  list(key = tolower(email), valid = nzchar(email) & .cmail_email_valid(email))
}

# Campos de la plantilla que llevan a la encuesta: ahí se asocia la columna.
.cmail_enlace_target_keys <- function(template) {
  keys <- character(0)
  for (f in template$fields %||% list()) {
    destino <- .cmail_one(f$destino)
    sm <- .cmail_one(f$sm)
    if (identical(destino, "encuesta") || (is.null(destino) && identical(sm, "SurveyLink"))) {
      keys <- c(keys, as.character(f$key))
    }
  }
  keys
}

#' Genera los tokens que falten y materializa `enlace_encuesta`.
#'
#' Pura sobre el store: no guarda. Con `map_template`, asocia la columna a los
#' campos de enlace a la encuesta de la plantilla (respeta `keep_mapped`: las
#' claves cuyo mapeo explícito no se toca).
#' @return list(store, generados, conservados, total, mapeado).
#' @keywords internal
.cmail_enlace_apply <- function(store, url, template = NULL, keep_mapped = character(0),
                                variable = .cmail_enlace_variable_of(store)) {
  ck <- .cmail_contact_keys(store)
  tokens <- store$tokens %||% stats::setNames(character(0), character(0))
  people <- unique(ck$key[ck$valid])
  had <- people[people %in% names(tokens)]
  missing <- setdiff(people, names(tokens))
  fresh <- .cmail_token_new(length(missing), taken = unname(tokens))
  if (length(missing)) tokens[missing] <- fresh
  links <- rep("", nrow(store$rows))
  has <- ck$valid & ck$key %in% names(tokens)
  links[has] <- vapply(unname(tokens[ck$key[has]]), function(t) .cmail_enlace_join(url, t, variable), "")
  store$rows[[.CMAIL_ENLACE_COLUMN]] <- links
  store$tokens <- tokens
  store$enlace <- list(url = url, variable = variable,
                       generado_en = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
  mapped <- character(0)
  if (!is.null(template)) {
    for (k in setdiff(.cmail_enlace_target_keys(template), keep_mapped)) {
      store$mapping$fields[[k]] <- .CMAIL_ENLACE_COLUMN
      mapped <- c(mapped, k)
    }
  }
  list(store = store, generados = length(missing), conservados = length(had), total = length(people),
       mapeado = mapped)
}

# Al reimportar: arrastra tokens, enlace y marcas de respuesta del store previo
# (por correo) y, si la campaña ya tenía enlace, lo regenera para la lista
# nueva. `explicit_mapping`: el mapeo vino en el pedido y se respeta.
.cmail_enlace_carry <- function(store, previous, template, explicit_mapping = FALSE) {
  if (is.null(previous)) return(store)
  for (k in c("tokens", "enlace", "respondio", "respondio_en", "lectura")) {
    if (!is.null(previous[[k]])) store[[k]] <- previous[[k]]
  }
  url <- (store$enlace %||% list())$url
  if (is.null(url)) return(store)
  keep <- if (isTRUE(explicit_mapping)) names(store$mapping$fields %||% list()) else character(0)
  .cmail_enlace_apply(store, url, template, keep_mapped = keep)$store
}

#' `PUT /api/recopiladores/mail-contacts/enlace`: declara el enlace del
#' recopilador (y la variable de la encuesta) y genera los enlaces personales.
#' Sin `variable`, conserva la que ya tenía la campaña (`t` la primera vez).
#' @return list(ok, campaign_id, generados, conservados, total, campo, url, variable, aviso, mapeado).
#' @keywords internal
collection_mail_enlace_put <- function(sid, campaign_id = NULL, url = NULL, variable = NULL) {
  .cmail_contactos_assert_local()
  session <- session_get(sid)
  ct <- .cmail_campaign_template_for_session(session, campaign_id)
  store <- .cmail_recipients_load(session, ct$campaign_id)
  variable <- if (is.null(variable)) .cmail_enlace_variable_of(store) else .cmail_enlace_variable_check(variable)
  checked <- .cmail_enlace_url_check(url, variable)
  if (is.null(store)) {
    stop_api(409, "E_COLLECTION_MAIL_NO_RECIPIENTS", "Primero importa los contactos: el enlace es uno por persona.")
  }
  res <- .cmail_enlace_apply(store, checked$url, ct$template, variable = variable)
  .cmail_recipients_save(session, ct$campaign_id, res$store)
  .cmail_contactos_touch(sid)
  .cmc_drop_nulls_deep(list(
    ok = TRUE, campaign_id = ct$campaign_id,
    generados = as.integer(res$generados), conservados = as.integer(res$conservados),
    total = as.integer(res$total), campo = .CMAIL_ENLACE_COLUMN, label = .CMAIL_ENLACE_LABEL,
    url = checked$url, variable = variable, aviso = checked$aviso, mapeado = I(res$mapeado)
  ))
}

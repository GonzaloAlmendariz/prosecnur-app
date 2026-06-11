# Router común para credenciales de conexiones externas.
#
# Las credenciales viven fuera del proyecto `.pulso` y se exponen al frontend
# solo como estado/máscara. SurveyMonkey mantiene compatibilidad con tokens
# efímeros por sesión porque el editor ya ofrecía esa opción.

.connections_parse_body <- function(req) {
  body_raw <- if (!is.null(req$bodyRaw) && length(req$bodyRaw) > 0L) {
    rawToChar(req$bodyRaw)
  } else {
    req$postBody %||% ""
  }
  if (!nzchar(body_raw)) return(list())
  Encoding(body_raw) <- "UTF-8"
  tryCatch(
    jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
    error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
  )
}

.connections_normalize_provider <- function(provider) {
  provider <- tolower(trimws(as.character(provider %||% "")[1]))
  provider <- gsub("[_-]+", "", provider)
  switch(
    provider,
    sm = "surveymonkey",
    surveymonkey = "surveymonkey",
    survey = "surveymonkey",
    kobo = "kobo",
    kobotoolbox = "kobo",
    googlesheets = "google_sheets",
    google = "google_sheets",
    sheets = "google_sheets",
    google_sheets = "google_sheets",
    stop_api(400, "E_CONNECTION_PROVIDER", "Proveedor de conexión no soportado.")
  )
}

.connections_provider_label <- function(provider) {
  provider <- .connections_normalize_provider(provider)
  switch(provider, surveymonkey = "SurveyMonkey", kobo = "KoboToolbox", google_sheets = "Google Sheets")
}

.connections_secret_name <- function(provider) {
  provider <- .connections_normalize_provider(provider)
  switch(provider, surveymonkey = "sm_token", kobo = "kobo_token")
}

.connections_profiles_supported <- function(provider) {
  .connections_normalize_provider(provider) %in% c("surveymonkey", "kobo")
}

.connections_supports_ephemeral <- function(provider) {
  identical(.connections_normalize_provider(provider), "surveymonkey")
}

.connections_mask_secret <- function(token) {
  token <- as.character(token %||% "")[1]
  if (is.na(token) || !nzchar(token)) return("")
  n <- nchar(token, type = "chars")
  if (n <= 8L) {
    return(paste0(strrep("*", max(0L, n - 2L)), substr(token, max(1L, n - 1L), n)))
  }
  paste0(substr(token, 1L, 4L), "...", substr(token, n - 5L, n))
}

.connections_now_iso <- function() {
  format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
}

.connections_profile_manifest_secret <- function(provider) {
  paste0(.connections_secret_name(provider), "_profiles")
}

.connections_profile_clean_id <- function(profile_id) {
  profile_id <- trimws(as.character(profile_id %||% "")[1])
  if (is.na(profile_id)) profile_id <- ""
  profile_id <- gsub("[^a-zA-Z0-9_-]+", "_", profile_id)
  gsub("^_+|_+$", "", profile_id)
}

.connections_profile_new_id <- function(alias) {
  base <- tolower(iconv(as.character(alias %||% "perfil"), from = "", to = "ASCII//TRANSLIT", sub = ""))
  base <- gsub("[^a-z0-9]+", "_", base)
  base <- gsub("^_+|_+$", "", base)
  if (!nzchar(base)) base <- "perfil"
  suffix <- if (requireNamespace("uuid", quietly = TRUE)) {
    substr(gsub("-", "", uuid::UUIDgenerate()), 1L, 8L)
  } else {
    substr(as.integer(runif(1L, 1e7, 9e7)), 1L, 8L)
  }
  substr(paste0(base, "_", suffix), 1L, 48L)
}

.connections_profile_secret_name <- function(provider, profile_id) {
  paste(.connections_secret_name(provider), "profile", .connections_profile_clean_id(profile_id), sep = "_")
}

.connections_kobo_base_url <- function(base_url = NULL) {
  .kobo_api_trim_base_url(base_url %||% kobo_api_default_base_url())
}

.connections_kobo_server_label <- function(base_url = NULL) {
  base <- .connections_kobo_base_url(base_url)
  switch(base,
    "https://eu.kobotoolbox.org" = "EU",
    "https://kobo.unhcr.org" = "UNHCR",
    "https://kf.kobotoolbox.org" = "Global",
    base
  )
}

.connections_profile_meta <- function(provider, profile) {
  provider <- .connections_normalize_provider(provider)
  if (!identical(provider, "kobo")) return(list())
  base_url <- .connections_kobo_base_url(profile$base_url %||% "")
  list(
    base_url = base_url,
    server_label = as.character(profile$server_label %||% .connections_kobo_server_label(base_url))
  )
}

.connections_load_profile_manifest <- function(provider) {
  provider <- .connections_normalize_provider(provider)
  if (!.connections_profiles_supported(provider)) {
    return(list(default_profile_id = "", profiles = list()))
  }
  raw <- prosecnur_secret_load(.connections_profile_manifest_secret(provider))
  manifest <- if (!is.na(raw) && nzchar(raw)) {
    tryCatch(jsonlite::fromJSON(raw, simplifyVector = FALSE), error = function(e) NULL)
  } else {
    NULL
  }
  profiles <- manifest$profiles %||% list()
  if (!is.list(profiles)) profiles <- list()
  default_id <- as.character(manifest$default_profile_id %||% "")[1]
  default_id <- .connections_profile_clean_id(default_id)

  # Compatibilidad: instalaciones anteriores guardaban un único token como
  # sm_token/kobo_token. Lo exponemos como perfil "Principal" sin migrar secretos.
  has_legacy <- isTRUE(prosecnur_secret_exists(.connections_secret_name(provider)))
  has_legacy_profile <- any(vapply(profiles, function(p) identical(as.character(p$id %||% ""), "default"), logical(1)))
  if (has_legacy && !has_legacy_profile) {
    profiles <- c(list(list(
      id = "default",
      alias = "Principal",
      secret_name = .connections_secret_name(provider),
      created_at = "",
      updated_at = "",
      base_url = if (identical(provider, "kobo")) kobo_api_default_base_url() else "",
      server_label = if (identical(provider, "kobo")) .connections_kobo_server_label(kobo_api_default_base_url()) else "",
      legacy = TRUE
    )), profiles)
    if (!nzchar(default_id)) default_id <- "default"
  }

  profiles <- Filter(function(p) {
    id <- .connections_profile_clean_id(p$id %||% "")
    nzchar(id) && nzchar(as.character(p$secret_name %||% ""))
  }, profiles)
  ids <- vapply(profiles, function(p) .connections_profile_clean_id(p$id %||% ""), character(1))
  if (!length(profiles)) default_id <- ""
  if (length(profiles) && (!nzchar(default_id) || !(default_id %in% ids))) {
    default_id <- ids[1]
  }
  list(default_profile_id = default_id, profiles = profiles)
}

.connections_save_profile_manifest <- function(provider, manifest) {
  provider <- .connections_normalize_provider(provider)
  if (!.connections_profiles_supported(provider)) return(invisible(FALSE))
  profiles <- manifest$profiles %||% list()
  profiles <- Filter(function(p) !isTRUE(p$legacy), profiles)
  if (!length(profiles)) {
    prosecnur_secret_clear(.connections_profile_manifest_secret(provider))
    return(invisible(TRUE))
  }
  ids <- vapply(profiles, function(p) .connections_profile_clean_id(p$id %||% ""), character(1))
  default_id <- .connections_profile_clean_id(manifest$default_profile_id %||% "")
  if (!nzchar(default_id) || !(default_id %in% ids)) default_id <- ids[1]
  clean <- list(
    default_profile_id = default_id,
    profiles = lapply(profiles, function(p) {
      item <- list(
        id = .connections_profile_clean_id(p$id %||% ""),
        alias = as.character(p$alias %||% "Principal"),
        secret_name = as.character(p$secret_name %||% ""),
        created_at = as.character(p$created_at %||% ""),
        updated_at = as.character(p$updated_at %||% "")
      )
      c(item, .connections_profile_meta(provider, p))
    })
  )
  prosecnur_secret_save(
    .connections_profile_manifest_secret(provider),
    jsonlite::toJSON(clean, auto_unbox = TRUE, null = "null")
  )
  invisible(TRUE)
}

.connections_profile_public <- function(provider, profile, default_id = "") {
  token <- prosecnur_secret_load(profile$secret_name)
  if (is.na(token)) token <- ""
  has_token <- nzchar(token)
  list(
    id = .connections_profile_clean_id(profile$id %||% ""),
    alias = as.character(profile$alias %||% "Principal"),
    is_default = identical(.connections_profile_clean_id(profile$id %||% ""), .connections_profile_clean_id(default_id)),
    has_token = has_token,
    masked_token = if (has_token) .connections_mask_secret(token) else "",
    updated_at = as.character(profile$updated_at %||% ""),
    legacy = isTRUE(profile$legacy)
  ) |> c(.connections_profile_meta(provider, profile))
}

.connections_profiles_status <- function(provider) {
  manifest <- .connections_load_profile_manifest(provider)
  profiles <- lapply(manifest$profiles %||% list(), function(p) {
    .connections_profile_public(provider, p, manifest$default_profile_id)
  })
  list(
    default_profile_id = manifest$default_profile_id %||% "",
    profiles = profiles
  )
}

.connections_active_profile <- function(provider, profile_id = NULL) {
  manifest <- .connections_load_profile_manifest(provider)
  default_id <- .connections_profile_clean_id(profile_id %||% manifest$default_profile_id %||% "")
  if (!length(manifest$profiles %||% list())) return(NULL)
  for (p in manifest$profiles) {
    if (identical(.connections_profile_clean_id(p$id %||% ""), default_id)) return(p)
  }
  if (nzchar(default_id)) return(NULL)
  manifest$profiles[[1L]]
}

.connections_profile_base_url <- function(provider, profile_id = NULL) {
  provider <- .connections_normalize_provider(provider)
  profile <- .connections_active_profile(provider, profile_id)
  if (identical(provider, "kobo")) {
    return(.connections_kobo_base_url(profile$base_url %||% kobo_api_default_base_url()))
  }
  ""
}

.connections_profile_save <- function(provider, token, alias = NULL, profile_id = NULL,
                                      make_default = TRUE, update_active = FALSE,
                                      base_url = NULL, server_label = NULL) {
  provider <- .connections_normalize_provider(provider)
  if (!.connections_profiles_supported(provider)) {
    stop_api(400, "E_CONNECTION_PROFILES", "Este proveedor no soporta perfiles de token.")
  }
  token <- trimws(as.character(token %||% "")[1])
  if (is.na(token) || !nzchar(token)) {
    stop_api(400, "E_TOKEN_EMPTY", "Pega una clave API para guardar el perfil.")
  }
  alias <- trimws(as.character(alias %||% "")[1])
  if (is.na(alias)) alias <- ""
  base_url_supplied <- !is.null(base_url) && nzchar(trimws(as.character(base_url %||% "")[1]))
  if (identical(provider, "kobo")) {
    base_url <- .connections_kobo_base_url(base_url %||% "")
    server_label <- trimws(as.character(server_label %||% .connections_kobo_server_label(base_url))[1])
    if (!nzchar(server_label)) server_label <- .connections_kobo_server_label(base_url)
  }
  manifest <- .connections_load_profile_manifest(provider)
  profiles <- manifest$profiles %||% list()
  requested_id <- .connections_profile_clean_id(profile_id %||% "")
  idx <- NA_integer_
  if (nzchar(requested_id)) {
    idx <- which(vapply(profiles, function(p) identical(.connections_profile_clean_id(p$id %||% ""), requested_id), logical(1)))[1]
  }
  if (isTRUE(update_active) && is.na(idx) && !nzchar(requested_id) && length(profiles)) {
    default_id <- .connections_profile_clean_id(manifest$default_profile_id %||% "")
    idx <- which(vapply(profiles, function(p) identical(.connections_profile_clean_id(p$id %||% ""), default_id), logical(1)))[1]
  }
  now <- .connections_now_iso()
  if (!is.na(idx) && length(idx) == 1L) {
    profile <- profiles[[idx]]
    if (!nzchar(alias)) alias <- as.character(profile$alias %||% "Principal")
    profile$alias <- alias
    profile$updated_at <- now
    if (identical(provider, "kobo")) {
      if (!base_url_supplied && nzchar(as.character(profile$base_url %||% ""))) {
        base_url <- .connections_kobo_base_url(profile$base_url)
        server_label <- as.character(profile$server_label %||% .connections_kobo_server_label(base_url))
      }
      profile$base_url <- base_url
      profile$server_label <- server_label
    }
    profiles[[idx]] <- profile
  } else {
    if (!nzchar(alias)) alias <- "Principal"
    requested_id <- if (nzchar(requested_id)) requested_id else .connections_profile_new_id(alias)
    profile <- list(
      id = requested_id,
      alias = alias,
      secret_name = .connections_profile_secret_name(provider, requested_id),
      created_at = now,
      updated_at = now
    )
    if (identical(provider, "kobo")) {
      profile$base_url <- base_url
      profile$server_label <- server_label
    }
    profiles[[length(profiles) + 1L]] <- profile
  }
  prosecnur_secret_save(profile$secret_name, token)
  manifest$profiles <- profiles
  if (isTRUE(make_default) || !nzchar(as.character(manifest$default_profile_id %||% ""))) {
    manifest$default_profile_id <- .connections_profile_clean_id(profile$id)
  }
  .connections_save_profile_manifest(provider, manifest)
  .connections_token_status(provider)
}

.connections_profile_set_default <- function(provider, profile_id) {
  provider <- .connections_normalize_provider(provider)
  manifest <- .connections_load_profile_manifest(provider)
  profile_id <- .connections_profile_clean_id(profile_id)
  ids <- vapply(manifest$profiles %||% list(), function(p) .connections_profile_clean_id(p$id %||% ""), character(1))
  if (!nzchar(profile_id) || !(profile_id %in% ids)) {
    stop_api(404, "E_PROFILE_NOT_FOUND", "No encontré ese perfil de conexión.")
  }
  manifest$default_profile_id <- profile_id
  .connections_save_profile_manifest(provider, manifest)
  .connections_token_status(provider)
}

.connections_profile_delete <- function(provider, profile_id) {
  provider <- .connections_normalize_provider(provider)
  manifest <- .connections_load_profile_manifest(provider)
  profile_id <- .connections_profile_clean_id(profile_id)
  profiles <- manifest$profiles %||% list()
  idx <- which(vapply(profiles, function(p) identical(.connections_profile_clean_id(p$id %||% ""), profile_id), logical(1)))[1]
  if (is.na(idx)) {
    stop_api(404, "E_PROFILE_NOT_FOUND", "No encontré ese perfil de conexión.")
  }
  profile <- profiles[[idx]]
  prosecnur_secret_clear(profile$secret_name)
  profiles <- profiles[-idx]
  manifest$profiles <- profiles
  if (identical(.connections_profile_clean_id(manifest$default_profile_id %||% ""), profile_id)) {
    manifest$default_profile_id <- if (length(profiles)) .connections_profile_clean_id(profiles[[1L]]$id %||% "") else ""
  }
  .connections_save_profile_manifest(provider, manifest)
  .connections_token_status(provider)
}

.connections_session_token_exists <- function(sid, provider) {
  provider <- .connections_normalize_provider(provider)
  .connections_supports_ephemeral(provider) &&
    !is.null(sid) && nzchar(sid) &&
    exists("prosecnur_session_secret_exists", mode = "function") &&
    isTRUE(tryCatch(
      prosecnur_session_secret_exists(sid, .connections_secret_name(provider)),
      error = function(e) FALSE
    ))
}

.connections_token_state <- function(provider, sid = NULL, profile_id = NULL) {
  provider <- .connections_normalize_provider(provider)
  secret_name <- .connections_secret_name(provider)
  use_session <- .connections_session_token_exists(sid, provider)
  profile_requested <- nzchar(.connections_profile_clean_id(profile_id %||% ""))
  profile_status <- if (.connections_profiles_supported(provider)) .connections_profiles_status(provider) else NULL
  active_profile <- if (.connections_profiles_supported(provider)) .connections_active_profile(provider, profile_id) else NULL
  token <- if (use_session) {
    prosecnur_session_secret_load(sid, secret_name)
  } else if (profile_requested && is.null(active_profile)) {
    ""
  } else if (!is.null(active_profile)) {
    prosecnur_secret_load(active_profile$secret_name)
  } else {
    prosecnur_secret_load(secret_name)
  }
  if (is.na(token)) token <- ""
  has_token <- nzchar(token)
  list(
    token = token,
    status = list(
      ok = TRUE,
      provider = provider,
      label = .connections_provider_label(provider),
      has_token = has_token,
      masked_token = if (has_token) .connections_mask_secret(token) else "",
      persisted = !use_session && has_token,
      ephemeral = use_session && has_token,
      active_profile_id = if (!is.null(active_profile)) .connections_profile_clean_id(active_profile$id %||% "") else "",
      active_profile_alias = if (!is.null(active_profile)) as.character(active_profile$alias %||% "") else "",
      active_profile_base_url = if (!is.null(active_profile)) (.connections_profile_meta(provider, active_profile)$base_url %||% "") else "",
      active_profile_server_label = if (!is.null(active_profile)) (.connections_profile_meta(provider, active_profile)$server_label %||% "") else "",
      profiles = profile_status$profiles %||% list(),
      profile_count = length(profile_status$profiles %||% list())
    )
  )
}

.connections_token_status <- function(provider, sid = NULL, profile_id = NULL) {
  provider <- .connections_normalize_provider(provider)
  if (identical(provider, "google_sheets")) {
    return(monitoreo_sheets_oauth_status())
  }
  .connections_token_state(provider, sid, profile_id = profile_id)$status
}

.connections_token_require <- function(provider, sid = NULL, profile_id = NULL) {
  provider <- .connections_normalize_provider(provider)
  state <- .connections_token_state(provider, sid, profile_id = profile_id)
  token <- as.character(state$token %||% "")[1]
  if (is.na(token) || !nzchar(token)) {
    code <- if (identical(provider, "kobo")) "E_KOBO_TOKEN" else "E_SM_TOKEN"
    stop_api(
      400,
      code,
      sprintf("Falta token %s guardado.", .connections_provider_label(provider))
    )
  }
  token
}

.connections_token_save <- function(provider, token, persist = TRUE, sid = NULL, res = NULL) {
  provider <- .connections_normalize_provider(provider)
  secret_name <- .connections_secret_name(provider)
  token <- as.character(token %||% "")[1]
  persist <- isTRUE(persist) || !.connections_supports_ephemeral(provider)
  if (persist) {
    if (.connections_profiles_supported(provider)) {
      return(.connections_profile_save(provider, token, alias = NULL, make_default = TRUE, update_active = TRUE))
    }
    prosecnur_secret_save(secret_name, token)
    if (.connections_supports_ephemeral(provider) &&
        !is.null(sid) && nzchar(sid) &&
        exists("prosecnur_session_secret_clear", mode = "function")) {
      prosecnur_session_secret_clear(sid, secret_name)
    }
  } else {
    if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
      sid <- session_create()
      if (!is.null(res)) res$setHeader("X-Pulso-Session", sid)
    }
    prosecnur_session_secret_save(sid, secret_name, token)
  }
  .connections_token_status(provider, sid)
}

.connections_token_clear <- function(provider, sid = NULL) {
  provider <- .connections_normalize_provider(provider)
  if (identical(provider, "google_sheets")) {
    prosecnur_secret_clear(.monitoreo_sheets_secret_name())
    prosecnur_secret_clear(.monitoreo_sheets_client_secret_name())
    prosecnur_secret_clear(.monitoreo_sheets_state_secret_name())
    return(monitoreo_sheets_oauth_status())
  }
  secret_name <- .connections_secret_name(provider)
  if (.connections_supports_ephemeral(provider) &&
      !is.null(sid) && nzchar(sid) &&
      isTRUE(.connections_session_token_exists(sid, provider)) &&
      exists("prosecnur_session_secret_clear", mode = "function")) {
    prosecnur_session_secret_clear(sid, secret_name)
    return(.connections_token_status(provider, sid))
  }
  if (.connections_profiles_supported(provider)) {
    active_profile <- .connections_active_profile(provider)
    if (!is.null(active_profile)) {
      return(.connections_profile_delete(provider, active_profile$id %||% ""))
    }
  }
  prosecnur_secret_clear(secret_name)
  if (.connections_supports_ephemeral(provider) &&
      !is.null(sid) && nzchar(sid) &&
      exists("prosecnur_session_secret_clear", mode = "function")) {
    prosecnur_session_secret_clear(sid, secret_name)
  }
  .connections_token_status(provider, sid)
}

.connections_check_surveymonkey <- function(sid = NULL) {
  token <- .connections_token_require("surveymonkey", sid)
  tryCatch(
    sm_api_check_token(token),
    error = function(e) list(ok = FALSE, provider = "surveymonkey", error = conditionMessage(e))
  )
}

.connections_check_kobo <- function(sid = NULL, base_url = NULL, profile_id = NULL) {
  token <- .connections_token_require("kobo", sid, profile_id = profile_id)
  base <- .connections_kobo_base_url(base_url %||% .connections_profile_base_url("kobo", profile_id))
  url <- paste0(base, "/api/v2/assets/?limit=1")
  probe <- tryCatch(
    .kobo_api_fetch_json(url, token),
    error = function(e) list(ok = FALSE, provider = "kobo", error = conditionMessage(e))
  )
  if (isFALSE(probe$ok)) return(probe)
  list(
    ok = TRUE,
    provider = "kobo",
    status_code = 200L,
    base_url = base,
    profile_id = .connections_token_status("kobo", sid, profile_id = profile_id)$active_profile_id %||% "",
    count = as.integer(probe$count %||% length(probe$results %||% list()))
  )
}

.connections_check <- function(provider, sid = NULL, base_url = NULL, profile_id = NULL) {
  provider <- .connections_normalize_provider(provider)
  if (identical(provider, "surveymonkey")) return(.connections_check_surveymonkey(sid))
  if (identical(provider, "google_sheets")) {
    probe <- tryCatch(
      monitoreo_sheets_list_spreadsheets(limit = 1L),
      error = function(e) list(ok = FALSE, provider = "google_sheets", error = conditionMessage(e))
    )
    if (isFALSE(probe$ok)) return(probe)
    return(list(
      ok = TRUE,
      provider = "google_sheets",
      status_code = 200L,
      count = length(probe$spreadsheets %||% list())
    ))
  }
  .connections_check_kobo(sid, base_url = base_url, profile_id = profile_id)
}

mount_connections <- function(pr) {
  pr |>
    plumber::pr_get("/api/connections", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      list(
        ok = TRUE,
        connections = list(
          .connections_token_status("surveymonkey", sid),
          .connections_token_status("kobo", sid),
          .connections_token_status("google_sheets", sid)
        )
      )
    })) |>
    plumber::pr_get("/api/connections/<provider>/token", wrap_endpoint(function(req, res, provider, ...) {
      .connections_token_status(provider, session_header(req))
    })) |>
    plumber::pr_post("/api/connections/<provider>/token", wrap_endpoint(function(req, res, provider, ...) {
      parsed <- .connections_parse_body(req)
      provider <- .connections_normalize_provider(provider)
      if (identical(provider, "google_sheets")) {
        payload <- parsed$oauth %||% parsed$client_config %||% parsed$token %||% parsed
        return(monitoreo_sheets_oauth_accept(payload, parsed$redirect_uri %||% ""))
      }
      .connections_token_save(
        provider,
        token = parsed$token %||% "",
        persist = parsed$persist %||% TRUE,
        sid = session_header(req),
        res = res
      )
    })) |>
    plumber::pr_delete("/api/connections/<provider>/token", wrap_endpoint(function(req, res, provider, ...) {
      .connections_token_clear(provider, session_header(req))
    })) |>
    plumber::pr_post("/api/connections/google_sheets/oauth", wrap_endpoint(function(req, res, ...) {
      parsed <- .connections_parse_body(req)
      payload <- parsed$oauth %||% parsed$client_config %||% parsed$token %||% parsed
      monitoreo_sheets_oauth_accept(payload, parsed$redirect_uri %||% "")
    })) |>
    plumber::pr_get("/api/connections/google_sheets/oauth/callback", function(req, res, code = NULL, state = NULL, error = NULL, ...) {
      if (!is.null(error) && nzchar(error)) {
        return(sprintf(
          "<!doctype html><meta charset='utf-8'><title>Prosecnur OAuth</title><body><h1>No se pudo autorizar Google Sheets</h1><p>%s</p><p>Vuelve a Configuracion en Prosecnur e inicia la autorizacion nuevamente.</p></body>",
          htmltools::htmlEscape(error)
        ))
      }
      ok <- tryCatch({
        monitoreo_sheets_oauth_exchange(code = code %||% "", state = state %||% "")
        TRUE
      }, error = function(e) conditionMessage(e))
      if (isTRUE(ok)) {
        return("<!doctype html><meta charset='utf-8'><title>Prosecnur OAuth</title><body><h1>Google Sheets autorizado</h1><p>Ya puedes cerrar esta pestana y volver a Prosecnur.</p></body>")
      }
      sprintf(
        "<!doctype html><meta charset='utf-8'><title>Prosecnur OAuth</title><body><h1>No se pudo autorizar Google Sheets</h1><p>%s</p><p>Vuelve a Configuracion en Prosecnur e inicia la autorizacion nuevamente.</p></body>",
        htmltools::htmlEscape(as.character(ok))
      )
    }) |>
    plumber::pr_post("/api/connections/<provider>/check", wrap_endpoint(function(req, res, provider, ...) {
      parsed <- .connections_parse_body(req)
      .connections_check(
        provider,
        session_header(req),
        base_url = parsed$base_url %||% parsed$baseUrl %||% NULL,
        profile_id = parsed$profile_id %||% parsed$profileId %||% parsed$connection_profile_id %||% parsed$connectionProfileId %||% NULL
      )
    })) |>
    plumber::pr_get("/api/connections/<provider>/profiles", wrap_endpoint(function(req, res, provider, ...) {
      provider <- .connections_normalize_provider(provider)
      if (!.connections_profiles_supported(provider)) {
        stop_api(400, "E_CONNECTION_PROFILES", "Este proveedor no soporta perfiles de token.")
      }
      status <- .connections_profiles_status(provider)
      list(ok = TRUE, provider = provider, default_profile_id = status$default_profile_id, profiles = status$profiles)
    })) |>
    plumber::pr_post("/api/connections/<provider>/profiles", wrap_endpoint(function(req, res, provider, ...) {
      parsed <- .connections_parse_body(req)
      .connections_profile_save(
        provider,
        token = parsed$token %||% "",
        alias = parsed$alias %||% parsed$name %||% NULL,
        profile_id = parsed$profile_id %||% parsed$id %||% NULL,
        make_default = parsed$make_default %||% TRUE,
        base_url = parsed$base_url %||% parsed$baseUrl %||% NULL,
        server_label = parsed$server_label %||% parsed$serverLabel %||% NULL
      )
    })) |>
    plumber::pr_post("/api/connections/<provider>/profiles/<profile_id>/default", wrap_endpoint(function(req, res, provider, profile_id, ...) {
      .connections_profile_set_default(provider, profile_id)
    })) |>
    plumber::pr_delete("/api/connections/<provider>/profiles/<profile_id>", wrap_endpoint(function(req, res, provider, profile_id, ...) {
      .connections_profile_delete(provider, profile_id)
    }))
}

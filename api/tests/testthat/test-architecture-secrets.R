contains_value_recursive <- function(x, needle) {
  if (is.null(x)) return(FALSE)
  if (is.atomic(x)) return(any(as.character(x) == needle, na.rm = TRUE))
  if (is.list(x)) {
    return(any(vapply(x, contains_value_recursive, logical(1), needle = needle)))
  }
  FALSE
}

with_temp_home <- function(code) {
  old_home <- Sys.getenv("HOME")
  tmp_home <- tempfile("prosecnur_home_")
  dir.create(tmp_home, recursive = TRUE, showWarnings = FALSE)
  on.exit({
    Sys.setenv(HOME = old_home)
    unlink(tmp_home, recursive = TRUE, force = TRUE)
  }, add = TRUE)
  Sys.setenv(HOME = tmp_home)
  force(code)
}

test_that("SurveyMonkey token status masks secrets and never returns plaintext", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  prosecnur_session_secret_save(sid, "sm_token", "sm_secret_abcdef")
  status <- .xlsform_editor_sm_token_status(sid)

  expect_true(status$has_token)
  expect_true(status$ephemeral)
  expect_false(status$persisted)
  expect_false("token" %in% names(status))
  expect_match(status$masked_token, "abcdef$")
  expect_false(identical(status$masked_token, "sm_secret_abcdef"))
})

test_that("common connection statuses mask SurveyMonkey and Kobo secrets", {
  with_temp_home({
    prosecnur_secret_save("sm_token", "sm_shared_abcdef")
    prosecnur_secret_save("kobo_token", "kobo_shared_123456")

    sm <- .connections_token_status("surveymonkey")
    kobo <- .connections_token_status("kobo")

    expect_true(sm$has_token)
    expect_true(kobo$has_token)
    expect_equal(sm$provider, "surveymonkey")
    expect_equal(kobo$provider, "kobo")
    expect_false("token" %in% names(sm))
    expect_false("token" %in% names(kobo))
    expect_match(sm$masked_token, "abcdef$")
    expect_match(kobo$masked_token, "123456$")
    expect_false(identical(sm$masked_token, "sm_shared_abcdef"))
    expect_false(identical(kobo$masked_token, "kobo_shared_123456"))
  })
})

test_that("Kobo supports multiple server profiles without exposing plaintext tokens", {
  with_temp_home({
    .connections_profile_save(
      "kobo",
      token = "kobo_eu_secret_abcdef",
      alias = "Kobo EU",
      profile_id = "kobo_eu",
      base_url = "https://eu.kobotoolbox.org",
      make_default = TRUE
    )
    .connections_profile_save(
      "kobo",
      token = "kobo_unhcr_secret_123456",
      alias = "Kobo UNHCR",
      profile_id = "kobo_unhcr",
      base_url = "https://kobo.unhcr.org",
      make_default = FALSE
    )

    status <- .connections_token_status("kobo")
    expect_true(status$has_token)
    expect_equal(status$active_profile_id, "kobo_eu")
    expect_equal(status$active_profile_base_url, "https://eu.kobotoolbox.org")
    expect_length(status$profiles, 2L)
    expect_equal(status$profiles[[2]]$base_url, "https://kobo.unhcr.org")
    expect_equal(.connections_token_require("kobo", profile_id = "kobo_eu"), "kobo_eu_secret_abcdef")
    expect_equal(.connections_token_require("kobo", profile_id = "kobo_unhcr"), "kobo_unhcr_secret_123456")
    expect_false(contains_value_recursive(status, "kobo_eu_secret_abcdef"))
    expect_false(contains_value_recursive(status, "kobo_unhcr_secret_123456"))

    next_status <- .connections_profile_set_default("kobo", "kobo_unhcr")
    expect_equal(next_status$active_profile_id, "kobo_unhcr")
    expect_equal(next_status$active_profile_server_label, "UNHCR")
  })
})

test_that("Kobo profile ids from another machine fall back to local profiles", {
  with_temp_home({
    .connections_profile_save(
      "kobo",
      token = "kobo_eu_secret_abcdef",
      alias = "Kobo EU",
      profile_id = "local_eu",
      base_url = "https://eu.kobotoolbox.org",
      make_default = TRUE
    )
    .connections_profile_save(
      "kobo",
      token = "kobo_unhcr_secret_123456",
      alias = "Kobo UNHCR",
      profile_id = "local_unhcr",
      base_url = "https://kobo.unhcr.org",
      make_default = FALSE
    )

    status <- .connections_token_status(
      "kobo",
      profile_id = "perfil_acnur_de_otra_maquina",
      base_url = "https://kobo.unhcr.org"
    )

    expect_true(status$has_token)
    expect_equal(status$active_profile_id, "local_unhcr")
    expect_equal(status$active_profile_base_url, "https://kobo.unhcr.org")
    expect_equal(
      .connections_token_require(
        "kobo",
        profile_id = "perfil_acnur_de_otra_maquina",
        base_url = "https://kobo.unhcr.org"
      ),
      "kobo_unhcr_secret_123456"
    )
    expect_equal(
      .connections_token_require("kobo", profile_id = "perfil_acnur_de_otra_maquina"),
      "kobo_eu_secret_abcdef"
    )
  })
})

test_that("Google Sheets OAuth is exposed as a global connection and can be cleared", {
  with_temp_home({
    monitoreo_sheets_oauth_save(list(access_token = "oauth_material_sentinel"))

    status <- .connections_token_status("google_sheets")
    expect_true(status$has_token)
    expect_equal(status$provider, "google_sheets")
    expect_false("token" %in% names(status))
    expect_false(identical(status$masked_token, "oauth_material_sentinel"))

    cleared <- .connections_token_clear("google_sheets")
    expect_false(cleared$has_token)
    expect_false(prosecnur_secret_exists("google_sheets_oauth"))
  })
})

test_that("SurveyMonkey endpoints fail with E_SM_TOKEN when backend has no token", {
  with_temp_home({
    sid <- session_create()
    on.exit(session_delete(sid), add = TRUE)

    err <- tryCatch(
      .xlsform_editor_sm_token_require(sid),
      error = function(e) e
    )

    expect_s3_class(err, "api_error")
    expect_equal(err$code, "E_SM_TOKEN")
  })
})

test_that("session SurveyMonkey tokens are usable but do not travel in .pulso", {
  testthat::skip_if_not_installed("zip")
  testthat::skip_if_not_installed("jsonlite")

  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  tmp <- tempfile(fileext = ".pulso")
  out_dir <- tempfile("pulso_unzip_")
  on.exit({
    unlink(tmp, force = TRUE)
    unlink(out_dir, recursive = TRUE, force = TRUE)
  }, add = TRUE)

  prosecnur_session_secret_save(sid, "sm_token", "sm_ephemeral_secret")
  expect_equal(prosecnur_session_secret_load(sid, "sm_token"), "sm_ephemeral_secret")

  session_set(sid, "xlsform_state", list(dummy = TRUE))
  build_pulso(sid, tmp, project_name = "Secretos efimeros")

  dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
  utils::unzip(tmp, files = "state.rds", exdir = out_dir)
  saved_state <- readRDS(file.path(out_dir, "state.rds"))

  expect_false(contains_value_recursive(saved_state, "sm_ephemeral_secret"))
})

test_that("Google Sheets OAuth material stays outside .pulso", {
  testthat::skip_if_not_installed("zip")
  testthat::skip_if_not_installed("jsonlite")

  with_temp_home({
    sid <- session_create()
    on.exit(session_delete(sid), add = TRUE)
    tmp <- tempfile(fileext = ".pulso")
    out_dir <- tempfile("pulso_unzip_")
    on.exit({
      unlink(tmp, force = TRUE)
      unlink(out_dir, recursive = TRUE, force = TRUE)
    }, add = TRUE)

    oauth_material <- "oauth_material_sentinel"
    monitoreo_sheets_oauth_save(oauth_material)
    session_set(sid, "monitoreo_sources", monitoreo_normalize_sources(list(list(
      kind = "google_sheets",
      label = "Barrido",
      role = "barrido",
      integration_mode = "connected_read",
      spreadsheet_id = "sheet_abc",
      sheet_name = "Barrido"
    ))))
    build_pulso(sid, tmp, project_name = "Sheets sin secretos")

    dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
    utils::unzip(tmp, files = "state.rds", exdir = out_dir)
    saved_state <- readRDS(file.path(out_dir, "state.rds"))

    expect_true(contains_value_recursive(saved_state, "sheet_abc"))
    expect_false(contains_value_recursive(saved_state, oauth_material))
  })
})

test_that("Google Sheets OAuth handles locked token payloads", {
  with_temp_home({
    payload <- new.env(parent = emptyenv())
    payload$access_token <- "oauth_material_sentinel"
    payload$refresh_token <- "oauth_refresh_sentinel"
    lockEnvironment(payload, bindings = TRUE)

    status <- monitoreo_sheets_oauth_save(payload)

    expect_true(status$has_token)
    saved <- prosecnur_secret_load("google_sheets_oauth")
    expect_false(is.na(saved))
    expect_match(saved, "google_sheets")
  })
})

test_that("Google Sheets OAuth completes prepare, exchange and local secret save", {
  with_temp_home({
    prepared <- monitoreo_sheets_oauth_prepare(
      list(installed = list(
        client_id = "client.apps.googleusercontent.com",
        client_secret = "client_secret_sentinel",
        auth_uri = "https://accounts.google.com/o/oauth2/v2/auth",
        token_uri = "https://oauth2.googleapis.com/token"
      )),
      "http://127.0.0.1:8787/api/monitoreo/sheets/oauth/callback"
    )
    state <- sub(".*[?&]state=([^&]+).*", "\\1", prepared$auth_url)
    token_payload <- new.env(parent = emptyenv())
    token_payload$access_token <- "oauth_access_sentinel"
    token_payload$refresh_token <- "oauth_refresh_sentinel"
    token_payload$expires_in <- 3600L
    token_payload$token_type <- "Bearer"
    lockEnvironment(token_payload, bindings = TRUE)

    status <- monitoreo_sheets_oauth_exchange("fake_code", state = state, token_response = token_payload)

    expect_true(status$has_token)
    saved <- prosecnur_secret_load("google_sheets_oauth")
    expect_false(contains_value_recursive(list(saved), "client_secret_sentinel"))
    expect_false(contains_value_recursive(list(saved), "oauth_access_sentinel"))
    expect_false(contains_value_recursive(list(saved), "oauth_refresh_sentinel"))

    decoded <- jsonlite::fromJSON(saved, simplifyVector = FALSE)
    expect_equal(decoded$provider, "google_sheets")
    expect_equal(decoded$token_type, "Bearer")
  })
})

test_that("Google Sheets OAuth refreshes expired access tokens without leaking client secret", {
  with_temp_home({
    prosecnur_secret_save(
      "google_sheets_oauth_client",
      jsonlite::toJSON(list(
        client_id = "client.apps.googleusercontent.com",
        client_secret = "client_secret_sentinel",
        token_uri = "https://oauth2.googleapis.com/token"
      ), auto_unbox = TRUE)
    )
    prosecnur_secret_save(
      "google_sheets_oauth",
      jsonlite::toJSON(list(
        access_token = "oauth_access_old",
        refresh_token = "oauth_refresh_sentinel",
        expires_in = 1L,
        saved_at = "2026-01-01T00:00:00Z",
        provider = "google_sheets"
      ), auto_unbox = TRUE)
    )

    token <- .monitoreo_sheets_refresh_access_token(
      token_response = list(access_token = "oauth_access_new", expires_in = 3600L, token_type = "Bearer")
    )

    expect_equal(token, "oauth_access_new")
    saved <- prosecnur_secret_load("google_sheets_oauth")
    decoded <- jsonlite::fromJSON(saved, simplifyVector = FALSE)
    expect_equal(decoded$access_token, "oauth_access_new")
    expect_equal(decoded$refresh_token, "oauth_refresh_sentinel")
    expect_false(contains_value_recursive(list(saved), "client_secret_sentinel"))
  })
})

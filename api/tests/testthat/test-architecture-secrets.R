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

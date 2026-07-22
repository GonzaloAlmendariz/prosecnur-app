library(testthat)

.session_state_endpoint <- function() {
  pr <- mount_sistema(plumber::pr())
  pr$routes$api$session$state$getFunc()
}

.session_state_call <- function(sid) {
  req <- new.env(parent = emptyenv())
  req$HTTP_X_PULSO_SESSION <- sid
  res <- new.env(parent = emptyenv())
  res$status <- 200L
  res$setHeader <- function(...) invisible(NULL)
  .session_state_endpoint()(req, res)
}

test_that("GET session state does not discover or cache analytic availability", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  s <- session_get(sid)
  s$project_path <- file.path(tempdir(), "readonly-state.pulso")
  s$project_dirty <- FALSE
  s$analitica_multibase_available <- FALSE
  .session_env[[sid]] <- s

  calls <- 0L
  local_mocked_bindings(
    .analitica_multibase_available = function(sid) {
      calls <<- calls + 1L
      session_set(sid, "analitica_prep_ok", TRUE)
      TRUE
    },
    .package = "prosecnurapp"
  )

  payload <- .session_state_call(sid)

  expect_false(payload$analitica_multibase_available)
  expect_equal(calls, 0L)
  expect_false(session_get(sid)$project_dirty)
  expect_false(isTRUE(session_get(sid)$analitica_prep_ok))
})

test_that("GET session state exposes the availability sealed by preparation", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  s <- session_get(sid)
  s$project_path <- file.path(tempdir(), "prepared-state.pulso")
  s$project_dirty <- FALSE
  s$analitica_multibase_available <- TRUE
  .session_env[[sid]] <- s

  payload <- .session_state_call(sid)

  expect_true(payload$analitica_multibase_available)
  expect_false(session_get(sid)$project_dirty)
})

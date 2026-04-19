.jobs <- new.env(parent = emptyenv())

job_submit <- function(sid,
                       kind,
                       func,
                       args = list(),
                       result_filename = NULL,
                       on_complete = NULL,
                       libpath = .libPaths()) {
  sess <- session_get(sid)
  jobs_dir <- file.path(sess$dir, "jobs")
  dir.create(jobs_dir, showWarnings = FALSE, recursive = TRUE)

  job_id <- uuid::UUIDgenerate()
  result_path <- if (!is.null(result_filename)) {
    file.path(jobs_dir, paste0(job_id, "__", result_filename))
  } else {
    NULL
  }

  if (!is.null(result_path)) {
    args$result_path <- result_path
  }

  rx <- callr::r_bg(
    func = func,
    args = args,
    stdout = file.path(jobs_dir, paste0(job_id, ".out")),
    stderr = file.path(jobs_dir, paste0(job_id, ".err")),
    supervise = TRUE,
    libpath = libpath
  )

  .jobs[[job_id]] <- list(
    id = job_id,
    sid = sid,
    kind = kind,
    rx = rx,
    started_at = Sys.time(),
    finished_at = NULL,
    status = "running",
    result_path = result_path,
    result_data = NULL,
    result_public = NULL,
    on_complete = on_complete,
    error = NULL
  )
  job_id
}

job_get <- function(job_id) {
  j <- .jobs[[job_id]]
  if (is.null(j)) stop_api(404, "E_JOB_NOT_FOUND", sprintf("Job %s not found", job_id))
  j
}

job_poll <- function(job_id) {
  j <- job_get(job_id)
  if (j$status %in% c("done", "error", "cancelled")) return(j)

  alive <- tryCatch(j$rx$is_alive(), error = function(e) FALSE)
  if (alive) return(j)

  result <- tryCatch(j$rx$get_result(), error = function(e) e)
  j$finished_at <- Sys.time()
  if (inherits(result, "error")) {
    j$status <- "error"
    j$error <- conditionMessage(result)
  } else {
    j$status <- "done"
    j$result_data <- result
    j$result_public <- result
    if (!is.null(j$on_complete)) {
      public <- tryCatch(j$on_complete(j), error = function(e) {
        j$status <- "error"
        j$error <- sprintf("on_complete failed: %s", conditionMessage(e))
        NULL
      })
      if (!is.null(public)) j$result_public <- public
    }
  }
  .jobs[[job_id]] <- j
  j
}

job_poll_all <- function() {
  for (id in ls(.jobs)) {
    tryCatch(job_poll(id), error = function(e) NULL)
  }
  invisible(NULL)
}

job_cancel <- function(job_id) {
  j <- .jobs[[job_id]]
  if (is.null(j)) return(FALSE)
  if (j$status == "running") {
    try(j$rx$kill(), silent = TRUE)
    j$status <- "cancelled"
    j$finished_at <- Sys.time()
    .jobs[[job_id]] <- j
  }
  TRUE
}

jobs_count_running <- function() {
  ids <- ls(.jobs)
  if (length(ids) == 0) return(0L)
  sum(vapply(ids, function(id) {
    j <- .jobs[[id]]
    alive <- tryCatch(j$rx$is_alive(), error = function(e) FALSE)
    j$status == "running" && isTRUE(alive)
  }, logical(1)))
}

jobs_kill_all <- function() {
  for (id in ls(.jobs)) {
    j <- .jobs[[id]]
    if (j$status == "running") {
      try(j$rx$kill(), silent = TRUE)
      j$status <- "cancelled"
      j$finished_at <- Sys.time()
      .jobs[[id]] <- j
    }
  }
  invisible(NULL)
}

job_snapshot <- function(j) {
  list(
    id = j$id,
    kind = j$kind,
    status = j$status,
    started_at = format(j$started_at, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    finished_at = if (!is.null(j$finished_at)) {
      format(j$finished_at, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
    } else {
      NA_character_
    },
    has_file_result = !is.null(j$result_path) && file.exists(j$result_path %||% ""),
    result_filename = if (!is.null(j$result_path)) {
      sub("^[^_]+__", "", basename(j$result_path))
    } else {
      NA_character_
    },
    result_data = j$result_public,
    error = j$error
  )
}

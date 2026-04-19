mount_jobs <- function(pr) {
  pr |>
    plumber::pr_get("/api/jobs/<job_id>", wrap_endpoint(function(req, res, job_id) {
      j <- job_poll(job_id)
      job_snapshot(j)
    })) |>
    plumber::pr_post("/api/jobs/<job_id>/cancel", wrap_endpoint(function(req, res, job_id) {
      ok <- job_cancel(job_id)
      list(ok = ok)
    })) |>
    plumber::pr_get("/api/jobs/<job_id>/result", wrap_endpoint(function(req, res, job_id) {
      j <- job_poll(job_id)
      if (j$status != "done") {
        stop_api(409, "E_JOB_NOT_DONE", sprintf("Job status: %s", j$status))
      }
      if (is.null(j$result_path) || !file.exists(j$result_path)) {
        stop_api(404, "E_NO_RESULT_FILE", "Job has no file result")
      }
      original <- sub("^[^_]+__", "", basename(j$result_path))
      n <- file.info(j$result_path)$size
      bytes <- readBin(j$result_path, what = "raw", n = n)
      res$setHeader("Content-Type", mime::guess_type(j$result_path))
      res$setHeader("Content-Length", as.character(n))
      res$setHeader("Content-Disposition", sprintf('attachment; filename="%s"', original))
      res$body <- bytes
      res
    })) |>
    plumber::pr_post("/api/jobs/_selftest", wrap_endpoint(function(req, res, seconds = 2) {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      secs <- suppressWarnings(as.numeric(seconds))
      if (is.na(secs) || secs < 0) secs <- 2
      job_id <- job_submit(
        sid = sid,
        kind = "selftest",
        func = function(seconds) {
          Sys.sleep(seconds)
          list(ok = TRUE, slept = seconds, pid = Sys.getpid())
        },
        args = list(seconds = secs)
      )
      list(job_id = job_id)
    }))
}

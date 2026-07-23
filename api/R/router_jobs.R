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
      res$setHeader("Content-Type", mime::guess_type(j$result_path))
      res$setHeader("Content-Disposition", sprintf('attachment; filename="%s"', original))
      # Body de archivo estilo Rook (`c(file = path)`): plumber lo pasa tal
      # cual en toResponse() y httpuv sirve el archivo desde disco por
      # streaming, con Content-Length derivado del tamaño real. Antes se hacía
      # readBin del resultado completo a RAM, lo que dolía con PPT/XLSX
      # grandes. El contrato del frontend (jobResultUrl como href de descarga)
      # no cambia: mismos status, headers y bytes.
      res$body <- c(file = normalizePath(j$result_path))
      res
    })) |>
    plumber::pr_post("/api/jobs/_selftest", wrap_endpoint(function(req, res, seconds = 2, file = "false") {
      sid <- session_header(req)
      if (is.null(sid) || is.null(session_get(sid, required = FALSE))) {
        sid <- session_create()
        res$setHeader("X-Pulso-Session", sid)
      }
      secs <- suppressWarnings(as.numeric(seconds))
      if (is.na(secs) || secs < 0) secs <- 2
      # file=true: variante con resultado de archivo, para ejercitar por el
      # wire la descarga de /result (body httpuv `c(file=...)`) sin necesitar
      # un proyecto cargado. Contenido determinista para asertar bytes.
      con_archivo <- isTRUE(as.logical(file))
      if (con_archivo) {
        job_id <- job_submit(
          sid = sid,
          kind = "selftest_file",
          func = function(seconds, result_path) {
            Sys.sleep(seconds)
            writeLines("selftest-file-ok", result_path)
            list(ok = TRUE, slept = seconds, pid = Sys.getpid())
          },
          args = list(seconds = secs),
          result_filename = "selftest.txt"
        )
      } else {
        job_id <- job_submit(
          sid = sid,
          kind = "selftest",
          func = function(seconds) {
            Sys.sleep(seconds)
            list(ok = TRUE, slept = seconds, pid = Sys.getpid())
          },
          args = list(seconds = secs)
        )
      }
      list(job_id = job_id)
    }))
}

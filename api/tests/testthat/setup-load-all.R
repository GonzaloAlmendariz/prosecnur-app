if (!exists("session_create", mode = "function")) {
  candidates <- c(".", "../..", "api")
  has_desc <- vapply(
    candidates,
    function(path) {
      desc <- file.path(path, "DESCRIPTION")
      file.exists(desc) && any(grepl("^Package:", readLines(desc, warn = FALSE)))
    },
    logical(1)
  )
  pkg_dir <- candidates[which(has_desc)[1]]
  test_env <- environment()
  r_files <- list.files(file.path(pkg_dir, "R"), "[.]R$", full.names = TRUE)
  first <- file.path(pkg_dir, "R", c("errors.R", "io.R", "session_store.R"))
  for (file in c(first, setdiff(r_files, first))) {
    sys.source(file, envir = test_env)
  }
}

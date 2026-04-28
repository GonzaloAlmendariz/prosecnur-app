.app_api_dir <- function() {
  api_dir <- Sys.getenv("PULSO_API_DIR", "")
  if (nzchar(api_dir) && dir.exists(api_dir)) {
    return(normalizePath(api_dir, mustWork = FALSE))
  }

  repo_root <- Sys.getenv("PULSO_REPO_ROOT", "")
  if (nzchar(repo_root)) {
    candidate <- file.path(repo_root, "api")
    if (dir.exists(candidate)) return(normalizePath(candidate, mustWork = FALSE))
  }

  if (file.exists("DESCRIPTION") && dir.exists("R")) {
    return(normalizePath(".", mustWork = FALSE))
  }

  normalizePath(file.path(".", "api"), mustWork = FALSE)
}

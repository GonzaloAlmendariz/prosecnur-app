# Entrypoint para publicar la app Plumber en shinyapps.io con:
# rsconnect::deployAPI(api = "api", appName = "prosecnur")
local({
  tryCatch(Sys.setlocale("LC_ALL", "en_US.UTF-8"),
           error = function(e) NULL, warning = function(w) NULL)
  if (!isTRUE(l10n_info()[["UTF-8"]])) {
    tryCatch(Sys.setlocale("LC_ALL", "C.UTF-8"),
             error = function(e) NULL, warning = function(w) NULL)
  }
  options(encoding = "UTF-8")

  api_dir <- normalizePath(".", mustWork = TRUE)
  Sys.setenv(PULSO_API_DIR = api_dir)

  if (requireNamespace("pkgload", quietly = TRUE)) {
    pkgload::load_all(api_dir, quiet = TRUE)
  } else if (requireNamespace("devtools", quietly = TRUE)) {
    devtools::load_all(api_dir, quiet = TRUE)
  } else {
    stop("Se requiere 'pkgload' o 'devtools' para cargar prosecnurapp en shinyapps.io.", call. = FALSE)
  }

  build_plumber_app(static_dir = file.path(api_dir, "inst", "www"))
})

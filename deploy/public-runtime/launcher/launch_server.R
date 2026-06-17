#!/usr/bin/env Rscript

local({
  tryCatch(Sys.setlocale("LC_ALL", "en_US.UTF-8"), error = function(e) NULL, warning = function(w) NULL)
  if (!isTRUE(l10n_info()[["UTF-8"]])) {
    tryCatch(Sys.setlocale("LC_ALL", "C.UTF-8"), error = function(e) NULL, warning = function(w) NULL)
  }
})
options(encoding = "UTF-8")

suppressPackageStartupMessages(library(prosecnurapp))
Sys.setenv(PULSO_PUBLIC_MODE = "1")

port <- as.integer(Sys.getenv("PORT", Sys.getenv("PULSO_PORT", "7860")))
host <- Sys.getenv("PULSO_HOST", "0.0.0.0")
bootstrap_path <- Sys.getenv("PULSO_BOOTSTRAP_PROJECT", "/data/proyecto.pulso")
if (!nzchar(bootstrap_path) || !file.exists(bootstrap_path)) {
  stop(sprintf("[launch_server] PULSO_BOOTSTRAP_PROJECT no existe: '%s'.", bootstrap_path))
}

bs <- tryCatch(prosecnurapp:::load_pulso(bootstrap_path), error = function(e) {
  stop(sprintf("[launch_server] error cargando .pulso: %s", conditionMessage(e)))
})
Sys.setenv(PULSO_BOOTSTRAP_SID = bs$session_id)

static_dir <- system.file("www", package = "prosecnurapp")
if (!nzchar(static_dir) || !dir.exists(static_dir)) {
  stop("[launch_server] frontend publico no encontrado.")
}

cat(sprintf("[launch_server] artefacto publico SID=%s, escuchando en %s:%d\n", bs$session_id, host, port))
run_app(host = host, port = port, static_dir = static_dir)

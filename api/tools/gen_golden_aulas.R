#!/usr/bin/env Rscript
# Genera los golden .rds de caracterizacion del motor de seleccion de aulas.
# CORRER CON EL CODIGO ACTUAL (pre-refactor) para congelar la salida esperada.
#
# Uso (desde la raiz del repo o desde api/):
#   Rscript api/tools/gen_golden_aulas.R
#
# Escribe api/tests/testthat/_snaps/golden-aulas/{cadenas,simulacion,escala}.rds
# El test test-calc-muestra-aulas.R vuelve a computar y exige identidad.

suppressWarnings(suppressMessages({
  # Localizar la raiz del paquete (dir con DESCRIPTION de prosecnurapp).
  find_api <- function() {
    for (p in c("api", ".", "..")) {
      d <- normalizePath(p, mustWork = FALSE)
      if (file.exists(file.path(d, "DESCRIPTION")) &&
          any(grepl("^Package: *prosecnurapp", readLines(file.path(d, "DESCRIPTION"), warn = FALSE)))) {
        return(d)
      }
    }
    stop("No encuentro la raiz del paquete (api/DESCRIPTION)")
  }
  api_dir <- find_api()
  # Cargar todas las fuentes del paquete (mismo mecanismo que setup-load-all).
  r_files <- list.files(file.path(api_dir, "R"), "[.]R$", full.names = TRUE)
  first <- file.path(api_dir, "R", c("errors.R", "io.R", "session_store.R"))
  for (f in c(first, setdiff(r_files, first))) sys.source(f, envir = globalenv())
  # Helper de captura/fixtures.
  sys.source(file.path(api_dir, "tests", "testthat", "helper-golden-aulas.R"), envir = globalenv())

  out_dir <- file.path(api_dir, "tests", "testthat", "_snaps", "golden-aulas")
  dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

  fx <- golden_fixtures()

  build_selection <- function(f) {
    frame <- calc_muestra_aulas_construir(base_madre = f$base, config = f$cfg)
    list(frame = frame, selection = calc_muestra_aulas_seleccionar(frame, f$cfg))
  }

  # Caso cadenas: solo seleccion.
  sc <- build_selection(fx$cadenas)
  saveRDS(golden_capture_selection(sc$selection), file.path(out_dir, "cadenas.rds"))

  # Caso simulacion: seleccion + simular reemplazos.
  ss <- build_selection(fx$simulacion)
  rep_sim <- calc_muestra_aulas_simular_reemplazos(ss$frame, ss$selection, fx$simulacion$cfg)
  saveRDS(golden_capture_sim(rep_sim), file.path(out_dir, "simulacion.rds"))

  # Caso escala: solo seleccion (tie-breaks).
  se <- build_selection(fx$escala)
  saveRDS(golden_capture_selection(se$selection), file.path(out_dir, "escala.rds"))

  cat("Golden generado en:", out_dir, "\n")
  cat("  cadenas.rds   reservas:", nrow(golden_capture_selection(sc$selection)$reserves), "\n")
  cat("  simulacion.rds sugerencias:", nrow(golden_capture_sim(rep_sim)), "\n")
  cat("  escala.rds    reservas:", nrow(golden_capture_selection(se$selection)$reserves), "\n")
}))

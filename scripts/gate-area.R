#!/usr/bin/env Rscript
# El gate de un ÁREA del backend: sus suites MÁS los contratos transversales.
#
# **Por qué existe.** La clase 6 del loop de robustez: un gate que no se corre.
# `test-errors-registry.R` llevó tres commits en rojo porque el gate del área de
# aulas era «las suites que toqué», y los contratos transversales no se tocan
# nunca — se rompen desde lejos. Lo mismo vale para el contrato de NAMESPACE y
# para los guards de campos y vocabulario, que existen justamente para caer
# cuando alguien cambia algo en OTRO archivo.
#
# Una lista en un documento no arregla eso: hay que acordarse de leerla. Un
# comando sí, porque el que tiene prisa escribe el comando.
#
#   Rscript scripts/gate-area.R aulas --patron "refuerzo|reemplazo|marcas"
#   Rscript scripts/gate-area.R aulas        # TODAS las de aulas: 250 suites, lento
#
# `--patron` es lo normal durante el trabajo: el área entera se reserva para el
# cierre. Los transversales entran SIEMPRE, se acote lo que se acote — que es
# justamente el punto.
#
# Devuelve código 1 si algo falla, para poder encadenarlo.

args <- commandArgs(trailingOnly = TRUE)
area <- if (length(args)) args[[1]] else "aulas"
patron_arg <- if (length(args) > 2 && identical(args[[2]], "--patron")) args[[3]] else NULL

# Los que se corren SIEMPRE, sea cual sea el área. No son «de aulas»: son del
# backend, y cada uno cae por un cambio hecho en otro sitio.
TRANSVERSALES <- c(
  "test-errors-registry.R",          # un E_* nuevo sin registrar
  "test-namespace-contract.R",       # un @export sin roxygenise, o uno ajeno colado
  "test-monitoreo-aulas-campos-declarados.R",   # un campo que el normalizador se traga
  "test-monitoreo-aulas-estado-normalizado.R",  # un motor que compara el estado en crudo
  "test-helpers-sin-duplicar.R",                # un micro-helper redefinido por módulo
  "test-guards-que-guardan.R"                   # un guard que dejó de encontrar su objeto
)

dir_tests <- file.path("api", "tests", "testthat")
if (!dir.exists(dir_tests)) stop("Ejecuta esto desde la raíz del repo.", call. = FALSE)

# Sin `%||%`: ese helper vive en el paquete y aquí todavía no está cargado.
patron <- if (is.null(patron_arg)) area else patron_arg
del_area <- list.files(dir_tests, pattern = paste0("^test-.*(", patron, ").*\\.R$"))
suites <- unique(c(del_area, TRANSVERSALES))
suites <- suites[file.exists(file.path(dir_tests, suites))]

cat(sprintf("Gate del área «%s»: %d suites (%d del área + %d transversales)\n\n",
            area, length(suites), length(del_area), length(TRANSVERSALES)))

suppressMessages(pkgload::load_all("api", quiet = TRUE))
total_ok <- 0L
total_ko <- 0L
rotas <- character(0)
for (suite in suites) {
  res <- try(testthat::test_file(file.path(dir_tests, suite), reporter = "silent"), silent = TRUE)
  if (inherits(res, "try-error")) {
    cat(sprintf("  %-58s ERROR AL CARGAR\n", suite))
    rotas <- c(rotas, suite)
    next
  }
  d <- as.data.frame(res)
  ok <- sum(d$passed)
  ko <- sum(d$failed) + sum(d$error)
  total_ok <- total_ok + ok
  total_ko <- total_ko + ko
  if (ko > 0) rotas <- c(rotas, suite)
  cat(sprintf("  %-58s %5d pass %s\n", suite, ok,
              if (ko > 0) sprintf("/ %d FALLA", ko) else ""))
}

cat(sprintf("\n%d pass · %d fail · %d suites rotas\n", total_ok, total_ko, length(rotas)))
if (length(rotas)) {
  cat("ROTAS: ", paste(rotas, collapse = ", "), "\n")
  quit(status = 1L)
}

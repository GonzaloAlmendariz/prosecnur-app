#!/usr/bin/env Rscript
# Reescribe los layouts de la ruta anterior de api/inst/plantillas/plantilla_16_9.pptx desde api/inst/estandar/estandar_pulso.json
# (K15: una sola fuente). La correspondencia placeholder ↔ ranura está en api/R/plantilla_layouts_estandar.R; la
# conformidad la verifica api/tests/testthat/test-plantilla-layouts-estandar.R.
# Uso, desde la raíz del repo:  Rscript api/scripts/plantilla_layouts_desde_estandar.R [salida.pptx]
args <- commandArgs(trailingOnly = TRUE)
suppressMessages(pkgload::load_all("api", quiet = TRUE))
entrada <- file.path("api", "inst", "plantillas", "plantilla_16_9.pptx")
salida <- if (length(args)) args[1] else entrada
.plantilla_layouts_desde_estandar(entrada, salida)
cat("plantilla escrita:", salida, "\n")

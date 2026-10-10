#!/usr/bin/env Rscript
# Regenera api/inst/catalogos/graficos_tipos.json desde el metadata del registro (K9, plan F6).
# Uso, desde la raíz del repo: Rscript api/scripts/generar_graficos_tipos.R
api <- if (dir.exists("api/R")) "api" else "."
suppressMessages(pkgload::load_all(api, quiet = TRUE, export_all = TRUE))
destino <- file.path(api, "inst", "catalogos", "graficos_tipos.json")
con <- file(destino, open = "w", encoding = "UTF-8")
writeLines(.graficos_tipos_catalogo_json(), con, sep = "")
close(con)
cat("Escrito", destino, "\n")

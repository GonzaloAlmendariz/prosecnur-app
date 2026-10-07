# Prueba final (M9d): lleva las bases limpias de un proyecto al formato del motor por la
# ruta de la app: editor de formularios (surveymonkey_leer + surveymonkey_xlsform) e
# importador .sav de Procesamiento (normalize_data_for_xlsform), luego reporte_data().
# Uso: W=<carpeta de trabajo> BASES="actor1=ruta1.sav;actor2=ruta2.sav" Rscript canon_bases.R
# Deja <W>/canon/<actor>_xlsform.xlsx, <W>/canon/bases.rds, data.rds e inst.rds, e imprime
# compatibilidad y las escalas encontradas (listas con 4 o 5 opciones) por actor.
Sys.setlocale("LC_ALL", "en_US.UTF-8")
suppressMessages({ pkgload::load_all("api", quiet = TRUE); library(openxlsx) })
W <- Sys.getenv("W"); dir.create(file.path(W, "canon"), showWarnings = FALSE, recursive = TRUE)
pares <- strsplit(strsplit(Sys.getenv("BASES"), ";")[[1]], "=")
res <- list()
for (pq in pares) {
  k <- trimws(pq[1]); p <- trimws(paste(pq[-1], collapse = "="))
  r <- tryCatch(surveymonkey_xlsform(surveymonkey_leer(p), lang = "es"), error = function(e) { cat("ERROR editor", k, conditionMessage(e), "\n"); NULL })
  if (is.null(r)) next
  xf <- file.path(W, "canon", paste0(k, "_xlsform.xlsx")); wb <- createWorkbook()
  for (sh in intersect(c("survey", "choices", "settings"), names(r))) { addWorksheet(wb, sh); writeData(wb, sh, r[[sh]]) }
  saveWorkbook(wb, xf, overwrite = TRUE)
  inst <- reporte_instrumento(xf)
  nd <- normalize_data_for_xlsform(haven::read_sav(p), inst)   # mismo lector que POST /api/carga/data (read_data_preview)
  cp <- validate_data_xlsform_compatibility(nd, inst)
  res[[k]] <- list(data = reporte_data(nd, inst), inst = inst)
  ch <- as.data.frame(inst$choices); lc <- intersect(c("label", grep("^label", names(ch), value = TRUE)), names(ch))[1]
  esc <- tapply(ch[[lc]], ch$list_name, function(x) paste(x, collapse = " / "))
  esc <- sort(table(esc[lengths(strsplit(esc, " / ")) %in% 4:6]), decreasing = TRUE)
  cat(sprintf("%s: filas %d | compat %s | faltan %d | casan %d\n", k, nrow(nd), format(cp$ok), length(cp$missing_columns), cp$matched_columns))
  for (e in head(names(esc), 4)) cat("   escala x", esc[[e]], ":", substr(e, 1, 140), "\n")
}
saveRDS(res, file.path(W, "canon", "bases.rds"))
saveRDS(lapply(res, `[[`, "data"), file.path(W, "canon", "data.rds")); saveRDS(lapply(res, `[[`, "inst"), file.path(W, "canon", "inst.rds"))

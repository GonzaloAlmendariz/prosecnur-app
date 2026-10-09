# OBSOLETO (H56 descartado: la app ya trae este camino, ver surveymonkey_xlsform()). Prueba final (M9d): convierte un .sav etiquetado (proyectos anteriores a la app, sin
# XLSForm) en instrumento y datos del motor, para reconstruir el informe entregado.
# La app no tiene este camino (H56): exige XLSForm. Aquí se arma un XLSForm mínimo con
# las etiquetas de SPSS: variable con etiquetas de valor -> select_one; numérica sin
# etiquetas -> integer; texto -> text. Luego pasa por reporte_instrumento() y reporte_data().
# Uso (dentro de un script con pkgload::load_all("api")):
#   source("docs/qa/motor-ppt-2026-10-06/herramientas/sav_a_motor.R")
#   b <- sav_a_motor("<ruta>.sav", "<dir de trabajo>")   # list(data, inst)
suppressMessages({ library(haven); library(openxlsx) })
sav_a_motor <- function(sav, dir_trabajo, nombre = tools::file_path_sans_ext(basename(sav))) {
  d <- read_sav(sav)
  nombres <- make.names(names(d), unique = TRUE); names(d) <- nombres
  lab <- function(x, def) { l <- attr(x, "label"); if (is.null(l) || !nzchar(l)) def else as.character(l) }
  survey <- list(); choices <- list()
  for (v in nombres) {
    x <- d[[v]]; vl <- attr(x, "labels")
    if (!is.null(vl) && length(vl) && is.numeric(x)) {
      ln <- paste0("lst_", v)
      survey[[v]] <- data.frame(type = paste("select_one", ln), name = v, label = lab(x, v))
      choices[[v]] <- data.frame(list_name = ln, name = as.character(unname(vl)), label = names(vl))
    } else if (is.numeric(x)) {
      survey[[v]] <- data.frame(type = "integer", name = v, label = lab(x, v))
    } else {
      survey[[v]] <- data.frame(type = "text", name = v, label = lab(x, v))
    }
  }
  wb <- createWorkbook()
  addWorksheet(wb, "survey"); writeData(wb, "survey", do.call(rbind, survey))
  addWorksheet(wb, "choices"); writeData(wb, "choices", do.call(rbind, choices))
  addWorksheet(wb, "settings"); writeData(wb, "settings", data.frame(form_title = nombre, default_language = "Spanish"))
  dir.create(dir_trabajo, showWarnings = FALSE, recursive = TRUE)
  xf <- file.path(dir_trabajo, paste0(nombre, "_xlsform.xlsx")); saveWorkbook(wb, xf, overwrite = TRUE)
  inst <- reporte_instrumento(xf)
  datos <- as.data.frame(lapply(d, function(x) if (is.numeric(x)) as.numeric(zap_labels(x)) else as.character(x)), check.names = FALSE)
  list(data = reporte_data(datos, inst), inst = inst, xlsform = xf, n = nrow(d))
}

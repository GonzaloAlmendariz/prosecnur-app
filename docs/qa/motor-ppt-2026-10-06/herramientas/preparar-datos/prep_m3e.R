# Prepara para el recetario (M3e): mapa de cobertura dibujado por el motor real
# (semilla territorial de los tests, sintética) y frecuencias de palabras de la
# abierta de ACRD ING (p35). Deja mapa_cobertura.rds y nube_ing.rds en SP.
Sys.setlocale("LC_ALL", "en_US.UTF-8")
suppressMessages(pkgload::load_all("api", quiet = TRUE))
SP <- Sys.getenv("SP")
sid2 <- session_create(); estudio_ensure(sid2)
survey <- data.frame(type = c("select_one district_list", "select_one yesno"), name = c("Core/M5_district", "p1"), label = c("Distrito", "Acceso"), stringsAsFactors = FALSE)
choices <- data.frame(list_name = c(rep("district_list", 3), "yesno", "yesno"), name = c("150132", "150103", "150117", "yes", "no"),
                      label = c("San Juan de Lurigancho", "Ate", "Los Olivos", "Si", "No"), stringsAsFactors = FALSE)
s2 <- session_get(sid2)
s2$estudio$bases <- list(default = list(nombre = "default", source_kind = "kobo"))
s2$rp_inst <- list(survey = survey, choices = choices)
s2$rp_data <- data.frame(`Core/M5_district` = c("150132", "150103", "150117"), p1 = c("yes", "no", "yes"), check.names = FALSE, stringsAsFactors = FALSE)
s2$hojas_ruta_ok <- TRUE
s2$hojas_ruta_workspace_outputs <- list(sample = list(blocks = list(list(ubigeo = "150132", zona = "Z01", manzanas = 12))))
s2$monitoreo_snapshot <- list(territorial_reports = list(response_audit = list(list(ubigeo = "150132", zona = "Z01", advance_valid = TRUE)),
  route_blocks = list(list(ubigeo = "150132", zona = "Z01", total_manzanas = 12))))
.session_env[[sid2]] <- s2
sug <- .graficos_suggested_plan(sid2, config = list(profile_id = "acnur_kobo_cruncher_plus", acnur_mode = "territorial", include_coverage_maps = TRUE, comparison_mode = "paired_district"))
m <- Filter(function(x) identical(((x$payload %||% list())$grafico %||% list())$graficador, "p_mapa_cobertura_territorial"), sug$plan$slides)
args <- m[[1]]$payload$grafico$args
g <- do.call(graficar_mapa_cobertura_territorial, args[intersect(names(args), names(formals(graficar_mapa_cobertura_territorial)))])
str(class(g)); saveRDS(g, file.path(SP, "mapa_cobertura.rds"))
# nube: abierta p35 de ING (texto libre), palabras sin vacías
x <- readRDS(file.path(SP, "ing_tmp.rds"))$src$data_sources[[1]]$p35
x <- tolower(x[!is.na(x) & nzchar(x)])
w <- unlist(strsplit(gsub("[^[:alpha:]áéíóúñü ]", " ", x), "\\s+")); w <- w[nchar(w) > 3]
vac <- c("para","como","más","mas","que","los","las","del","una","uno","sus","con","por","sobre","entre","esta","este","estos","estas","debe","deberían","debería","tener","mayor","mejor","carrera","sería","seria","también","tambien","hace","hacer","pueda","puedan","donde","cual","cuales","todo","todos","cada","muy","porque","desde","hasta","ellos","ella","pero","algunos","algunas","otros","otras","mucho","mucha","poco","solo","sólo","ingeniería","mecánica","egresados","alumnos","estudiantes")
w <- w[!w %in% vac]; f <- sort(table(w), decreasing = TRUE)
saveRDS(list(n_resp = length(x), freq = head(f, 45)), file.path(SP, "nube_ing.rds"))
cat("respuestas", length(x), "top:", paste(names(head(f, 12)), head(f, 12), collapse = ", "), "\n")

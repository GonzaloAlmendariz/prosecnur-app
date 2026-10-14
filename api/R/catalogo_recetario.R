# Proyecto catálogo del recetario (checklist-catalogo-recetario-2026-10-14.md, K2 y K6).
#
# Arma un .pulso con las bases sintéticas de `catalogo_recetario_datos.R` por la misma ruta que la carga de la app
# (formulario y datos subidos, normalizados contra el instrumento, `estudio_add_base`) y le pone el plan de
# `catalogo_recetario_plan.R`. Es un fixture de QA: no lleva datos de cliente y se regenera idéntico.

CATALOGO_RECETARIO_NOMBRE <- "Catálogo del recetario"

catalogo_recetario_dir <- function() {
  root <- Sys.getenv("PULSO_REPO_ROOT", "")
  if (nzchar(root)) return(file.path(root, "api", "inst", "recetario_catalogo"))
  file.path("api", "inst", "recetario_catalogo")
}

.cr_escribir_xlsx <- function(path, hojas) {
  wb <- openxlsx::createWorkbook()
  for (nm in names(hojas)) {
    openxlsx::addWorksheet(wb, nm)
    openxlsx::writeData(wb, nm, hojas[[nm]])
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

# Dimensiones de competencias sobre una base (Analítica › Dimensiones): r100_ por ítem, subíndices e índice. Van en la
# base como columnas, que es como Gráficos las lee (`p_dim_*` con `objetivo = "idx_comp"`).
.cr_dimensiones <- function(data, inst) {
  vars <- paste0("comp_", seq_along(.CR_COMPETENCIAS))
  d1 <- reporte_dimensiones(data = data, instrumento = inst, vars = vars, codigos_missing = "99",
                            prefijo = "r100_", reemplazar = FALSE, verbose = FALSE)
  reporte_dimensiones_indices(
    data = d1,
    subindices = list(
      subindice("tec", "Competencias técnicas", paste0("r100_comp_", 1:3)),
      subindice("fin", "Gestión financiera", paste0("r100_comp_", c(4, 6))),
      subindice("neg", "Visión empresarial", "r100_comp_5")
    ),
    indices = list(indice("comp", "Índice de competencias", c("tec", "fin", "neg")))
  )
}

#' Siembra la sesión del catálogo: bases, estudio y plan
#' @param dir Carpeta donde se escriben los formularios y datos de entrada.
#' @return `sid`.
#' @keywords internal
.catalogo_recetario_sesion <- function(dir) {
  dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  sid <- session_create()
  estudio_ensure(sid)
  estudio_set_nombre(sid, CATALOGO_RECETARIO_NOMBRE)
  choices <- .catalogo_recetario_choices()
  settings <- data.frame(form_title = CATALOGO_RECETARIO_NOMBRE, default_language = "Spanish (es)", stringsAsFactors = FALSE)
  bases <- .catalogo_recetario_bases()
  for (b in names(bases)) {
    xf <- .cr_escribir_xlsx(file.path(dir, paste0(b, "_xlsform.xlsx")),
                            list(survey = bases[[b]]$survey, choices = choices, settings = settings))
    inst <- reporte_instrumento(path = xf)
    data <- bases[[b]]$data
    if (identical(b, "estudiantes")) {
      norm0 <- normalize_data_for_xlsform(data, inst)
      dims <- .cr_dimensiones(reporte_data(norm0, instrumento = inst), inst)
      nuevas <- grep("^(r100_|sub_|idx_)", names(dims), value = TRUE)
      data <- cbind(data, as.data.frame(dims)[, nuevas, drop = FALSE])
    }
    df <- .cr_escribir_xlsx(file.path(dir, paste0(b, "_data.xlsx")), list(data = data))
    xmeta <- save_upload(sid, "xlsform", basename(xf), readBin(xf, "raw", n = file.info(xf)$size))
    dmeta <- save_upload(sid, "data", basename(df), readBin(df, "raw", n = file.info(df)$size))
    raw <- as.data.frame(readxl::read_excel(dmeta$path), stringsAsFactors = FALSE, check.names = FALSE)
    norm <- normalize_data_for_xlsform(raw, inst)
    .carga_assert_data_xlsform_compatible(norm, inst)
    rp_data <- reporte_data(norm, instrumento = inst)
    estudio_add_base(sid, nombre = b, xlsform_file_id = xmeta$file_id, data_file_id = dmeta$file_id, data_ext = dmeta$ext,
                     rp_data = rp_data, rp_inst = inst, n_filas = nrow(norm), n_columnas = ncol(norm))
    if (identical(b, "estudiantes")) {
      session_set(sid, "rp_inst", inst)
      session_set(sid, "rp_data", rp_data)
      session_set(sid, "instrumento", leer_xlsform_limpieza(xf, verbose = FALSE))
    }
  }
  estudio_active_base_set(sid, "estudiantes")
  cfg <- .graficos_default_config(sid)
  cfg$plan$slides <- .catalogo_recetario_plan()
  cfg$selected_slide_id <- cfg$plan$slides[[1]]$id
  .graficos_config_set(sid, cfg)
  sid
}

#' Construye el .pulso del catálogo del recetario
#' @param dir Carpeta de salida (por defecto `api/inst/reference_projects/recetario_catalogo`).
#' @return Lista con `project_path`, `n_laminas` y el resultado de `build_pulso()`.
#' @keywords internal
catalogo_recetario_build <- function(dir = catalogo_recetario_dir()) {
  dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  entradas <- file.path(tempdir(), "catalogo_recetario_entradas")
  sid <- .catalogo_recetario_sesion(entradas)
  on.exit(session_delete(sid), add = TRUE)
  path <- file.path(dir, "recetario_catalogo.pulso")
  if (file.exists(path)) Sys.chmod(path, mode = "0644")
  res <- build_pulso(sid, path, project_name = CATALOGO_RECETARIO_NOMBRE)
  Sys.chmod(path, mode = "0444")
  list(project_path = normalizePath(path, mustWork = FALSE), n_laminas = length(.catalogo_recetario_plan()), build = res)
}

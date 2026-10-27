# Proyecto catálogo del recetario (checklist-catalogo-recetario-2026-10-14.md, K2 y K6).
#
# Arma un .pulso con las bases sintéticas de `catalogo_recetario_datos.R` por la misma ruta que la carga de la app
# (formulario y datos subidos, normalizados contra el instrumento, `estudio_add_base`) y le pone el plan de
# `catalogo_recetario_plan.R`. Es un fixture de QA: no lleva datos de cliente y se regenera idéntico.

CATALOGO_RECETARIO_NOMBRE <- "Catálogo del recetario"

catalogo_recetario_dir <- function() {
  # Mismo patrón que `reference_project_install_dir()`: el instalado, o el inst/ del repo (load_all, tests, scripts).
  instalado <- system.file("recetario_catalogo", package = "prosecnurapp")
  if (nzchar(instalado) && dir.exists(instalado)) return(instalado)
  file.path(normalizePath(.app_api_dir(), mustWork = FALSE), "inst", "recetario_catalogo")
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

# Dimensiones de competencias como las arma un analista en Analítica › Dimensiones: r100_ por ítem, tres subíndices y el
# índice. Se construyen con `.dimensiones_construir()`, lo mismo que POST /api/analitica/dimensiones/build, y quedan en
# la sesión (`rp_dim`), de donde Gráficos las toma (graficos_dimensiones_fuente.R): el catálogo prueba esa ruta.
.cr_dimensiones_config <- function() {
  list(listas_objetivo = list("acuerdo"), vars_recodificar = as.list(paste0("comp_", seq_along(.CR_COMPETENCIAS))), excluir_vars = list(),
       orden_por_lista = list(acuerdo = as.list(as.character(1:4))), codigos_missing = list("99"), codigos_no_aplica = list(),
       prefijo = "r100_", subcriterios = list(),
       subindices = list(list(nombre = "tec", etiqueta = "Competencias técnicas", vars = as.list(paste0("r100_comp_", 1:3))),
                         list(nombre = "fin", etiqueta = "Gestión financiera", vars = as.list(paste0("r100_comp_", c(4, 6)))),
                         list(nombre = "neg", etiqueta = "Visión empresarial", vars = list("r100_comp_5"))),
       indices = list(list(nombre = "comp", etiqueta = "Índice de competencias", subindices = list("tec", "fin", "neg"))),
       semaforo = list(cortes = list(60L, 80L), colores = list(rojo = "#D84B55", ambar = "#E0B44C", verde = "#3A9A5B")),
       radar = list(paleta = "okabe_ito", min_ejes = 2L))
}

# Colores de las respuestas, como los dejaría el analista en Identidad › Colores de las respuestas. El catálogo es la
# constitución del motor (ADR 0092): ningún color sale de aquí, todos los dan las mismas funciones que usa el motor sin
# paleta propia, leídas del estándar. Las escalas, la rampa Likert (`.graficos_paleta_likert`, SIN INF en gris); las de
# dos opciones, la dicotómica (Sí en azul oscuro, No en celeste, como el mazo entregado de ACRD Conta); las demás, la
# rampa de azules de las porciones (`.lam_colores_pie`). Las residuales van en el gris de la Likert. Sin paletas la
# exportación desde la app se detiene en «Faltan colores», que no es lo que el catálogo viene a probar.
.cr_paletas <- function() {
  ch <- .catalogo_recetario_choices()
  gris <- unname(.std_paleta("likert"))[5]
  pintar <- function(lista) {
    rot <- ch$label[ch$list_name == lista]
    sust <- setdiff(rot, c("SIN INF", "Prefiero no responder"))
    cols <- .graficos_paleta_likert(rot)
    cols <- if (!is.null(cols)) cols[rot] else stats::setNames(c(.lam_colores_pie(length(sust)), rep(gris, length(rot) - length(sust))),
                                                             c(sust, setdiff(rot, sust)))
    as.list(cols)
  }
  lapply(stats::setNames(nm = c("acuerdo", "acuerdo_eg", "utilidad", "satisf", "acuerdo5", "relacion", "si_no", "sexo", "modalidad")), pintar)
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
    df <- .cr_escribir_xlsx(file.path(dir, paste0(b, "_data.xlsx")), list(data = data))
    xmeta <- save_upload(sid, "xlsform", basename(xf), readBin(xf, "raw", n = file.info(xf)$size))
    dmeta <- save_upload(sid, "data", basename(df), readBin(df, "raw", n = file.info(df)$size))
    raw <- as.data.frame(.read_excel_data(dmeta$path), stringsAsFactors = FALSE, check.names = FALSE)
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
  # Analítica › Dimensiones sobre estudiantes, como lo haría el analista.
  dim_cfg <- .cr_dimensiones_config()
  cfg_an <- .analitica_get_config(sid); cfg_an$dimensiones <- dim_cfg; .analitica_config_set(sid, cfg_an)
  ctx <- .load_rp_data(sid)
  dims <- .dimensiones_construir(ctx$rp_data, ctx$rp_inst, dim_cfg)
  session_set(sid, "rp_dim", dims$data_dim); session_set(sid, "rp_dim_config", dims$dim_cfg); session_set(sid, "rp_dim_base", "estudiantes")
  .analitica_status_set(sid, "analitica_dim_ok", TRUE)
  cfg <- .graficos_default_config(sid)
  cfg$plan$slides <- .catalogo_recetario_plan()
  cfg$paletas <- .cr_paletas()
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

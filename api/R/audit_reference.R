# =============================================================================
# Proyecto canonico de auditoria
# =============================================================================
#
# Este modulo genera un proyecto sintetico completo para diagnosticar Prosecnur
# sin depender de sesiones vivas, proyectos privados ni capturas sueltas. La
# semilla vive en inst/audit_reference/ y cada corrida copia esa semilla a
# outputs/audit-runs/<timestamp>/project/.

AUDIT_REFERENCE_NAME <- "Auditoria Canonica Prosecnur"
AUDIT_REFERENCE_BASE <- "auditoria"

audit_reference_dir <- function() {
  installed <- system.file("audit_reference", package = "prosecnurapp")
  if (nzchar(installed) && dir.exists(installed)) return(installed)
  file.path(.app_api_dir(), "inst", "audit_reference")
}

audit_reference_project_path <- function(dir = audit_reference_dir()) {
  file.path(dir, "prosecnur_audit_reference.pulso")
}

audit_reference_fixture_paths <- function(dir = audit_reference_dir()) {
  list(
    dir = dir,
    xlsform = file.path(dir, "auditoria_canonica_xlsform.xlsx"),
    data = file.path(dir, "auditoria_canonica_data.xlsx"),
    project = audit_reference_project_path(dir),
    metadata = file.path(dir, "auditoria_canonica_manifest.json")
  )
}

.audit_reference_now <- function() {
  format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
}

.audit_reference_sha256 <- function(path) {
  if (!file.exists(path)) return(NA_character_)
  if (requireNamespace("digest", quietly = TRUE)) {
    return(as.character(digest::digest(file = path, algo = "sha256")))
  }
  as.character(tools::md5sum(path)[[1]])
}

.audit_reference_git_sha <- function(root = Sys.getenv("PULSO_REPO_ROOT", "")) {
  if (!nzchar(root)) root <- normalizePath(file.path(.app_api_dir(), ".."), mustWork = FALSE)
  out <- tryCatch(
    suppressWarnings(
      system2("git", c("-C", root, "rev-parse", "--short", "HEAD"), stdout = TRUE, stderr = FALSE)
    ),
    error = function(e) character(0)
  )
  if (length(out) && nzchar(out[[1]])) out[[1]] else NA_character_
}

.audit_reference_app_version <- function() {
  tryCatch(as.character(utils::packageVersion("prosecnurapp")), error = function(e) "dev")
}

.audit_reference_survey <- function() {
  data.frame(
    type = c(
      "start",
      "end",
      "begin_group",
      "text",
      "text",
      "date",
      "select_one region",
      "select_one distrito",
      "text",
      "integer",
      "select_one sexo",
      "select_one si_no",
      "select_one likert5",
      "select_multiple servicios",
      "select_one area",
      "text",
      "decimal",
      "integer",
      "text",
      "select_one estado",
      "end_group",
      "begin_group",
      "select_one likert5",
      "integer",
      "select_multiple problemas",
      "text",
      "decimal",
      "decimal",
      "end_group"
    ),
    name = c(
      "start",
      "end",
      "identificacion",
      "response_id",
      "enumerador",
      "fecha",
      "region",
      "distrito",
      "zona",
      "edad",
      "sexo",
      "consentimiento",
      "satisfaccion",
      "servicios",
      "area",
      "area_other",
      "ingreso",
      "puntaje",
      "comentario_open",
      "estado",
      "",
      "evaluacion",
      "acuerdo",
      "n_hijos",
      "problemas",
      "recomendacion_open",
      "latitud",
      "longitud",
      ""
    ),
    label = c(
      "Inicio",
      "Fin",
      "Identificacion",
      "ID de respuesta",
      "Enumerador",
      "Fecha de entrevista",
      "Region",
      "Distrito",
      "Zona operativa",
      "Edad",
      "Sexo",
      "Consentimiento",
      "Satisfaccion general",
      "Servicios usados",
      "Area principal",
      "Otra area",
      "Ingreso mensual aproximado",
      "Puntaje de experiencia",
      "Comentario abierto",
      "Estado de encuesta",
      "",
      "Evaluacion",
      "Acuerdo con la propuesta",
      "Numero de hijos",
      "Problemas detectados",
      "Recomendacion abierta",
      "Latitud",
      "Longitud",
      ""
    ),
    hint = c(
      "", "", "",
      "Identificador sintetico estable.",
      "Codigo del encuestador.",
      "Fecha local de aplicacion.",
      "", "", "",
      "Debe estar entre 18 y 80.",
      "", "",
      "Escala de 1 a 5.",
      "Seleccion multiple para dashboard y reportes.",
      "",
      "Se muestra cuando Area principal es Otro.",
      "Valor no negativo.",
      "Debe estar entre 0 y 100.",
      "Pregunta abierta para codificacion.",
      "", "",
      "",
      "",
      "Solo aplica si edad es mayor a 25.",
      "",
      "Pregunta abierta para codificacion.",
      "Coordenada sintetica.",
      "Coordenada sintetica.",
      ""
    ),
    required = c(
      "", "", "",
      "yes", "yes", "yes", "yes", "yes", "yes", "yes", "yes", "yes",
      "yes", "", "yes", "", "", "yes", "", "yes", "",
      "", "yes", "", "", "", "", "", ""
    ),
    relevant = c(
      "", "", "",
      "", "", "", "", "", "", "", "", "", "", "", "",
      "${area} = '99'",
      "", "", "", "", "",
      "", "", "${edad} > 25", "", "", "", "", ""
    ),
    constraint = c(
      "", "", "",
      "", "", "", "", "", "",
      ". >= 18 and . <= 80",
      "", "", "", "", "", "",
      ". >= 0",
      ". >= 0 and . <= 100",
      "", "", "",
      "", "", ". >= 0 and . <= 12", "", "",
      ". >= -90 and . <= 90",
      ". >= -180 and . <= 180",
      ""
    ),
    constraint_message = c(
      "", "", "",
      "", "", "", "", "", "",
      "Edad fuera de rango.",
      "", "", "", "", "", "",
      "Ingreso no puede ser negativo.",
      "Puntaje debe estar entre 0 y 100.",
      "", "", "",
      "", "", "Numero fuera de rango.", "", "",
      "Latitud invalida.",
      "Longitud invalida.",
      ""
    ),
    appearance = c(rep("", 29)),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.audit_reference_choices <- function() {
  rows <- list(
    region = c("1" = "Lima", "2" = "Callao", "3" = "Provincia"),
    distrito = c("norte" = "Norte", "centro" = "Centro", "sur" = "Sur"),
    sexo = c("1" = "Mujer", "2" = "Hombre", "3" = "Otro / prefiere no decir"),
    si_no = c("1" = "Si", "0" = "No"),
    likert5 = c("1" = "Muy bajo", "2" = "Bajo", "3" = "Medio", "4" = "Alto", "5" = "Muy alto"),
    servicios = c("1" = "Atencion", "2" = "Informacion", "3" = "Seguimiento", "4" = "Soporte"),
    area = c("1" = "Academica", "2" = "Administrativa", "3" = "Campo", "99" = "Otro"),
    estado = c("completed" = "Completa", "approved" = "Aprobada", "rejected" = "Rechazada"),
    problemas = c("1" = "Tiempo", "2" = "Costo", "3" = "Claridad", "4" = "Acceso")
  )
  out <- do.call(rbind, lapply(names(rows), function(list_name) {
    vals <- rows[[list_name]]
    data.frame(
      list_name = list_name,
      name = names(vals),
      label = unname(vals),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  }))
  rownames(out) <- NULL
  out
}

.audit_reference_settings <- function() {
  data.frame(
    form_title = AUDIT_REFERENCE_NAME,
    form_id = "auditoria_canonica_prosecnur",
    version = "2026.05.31",
    default_language = "es",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.audit_reference_xlsform_editor_state <- function(paths) {
  payload <- .xlsform_editor_workbook_payload(
    list(
      survey = .audit_reference_survey(),
      choices = .audit_reference_choices(),
      settings = .audit_reference_settings()
    ),
    source_kind = "xlsform",
    source_name = basename(paths$xlsform)
  )
  list(
    workbook = payload$workbook,
    source = payload$source,
    hallazgos = list(),
    saved_at = as.numeric(Sys.time()) * 1000
  )
}

.audit_reference_pick <- function(values, n, offset = 0L) {
  values[((seq_len(n) + offset - 1L) %% length(values)) + 1L]
}

.audit_reference_data <- function(n = 72L) {
  idx <- seq_len(n)
  distrito <- .audit_reference_pick(c("norte", "centro", "sur"), n)
  area <- .audit_reference_pick(c("1", "2", "3", "99"), n, offset = 1L)
  edad <- 18L + ((idx * 7L) %% 58L)
  edad[c(9, 41)] <- c(17L, 84L)
  puntaje <- (idx * 13L) %% 101L
  puntaje[22] <- 108L
  consentimiento <- ifelse(idx %% 19L == 0L, "0", "1")
  servicios <- vapply(idx, function(i) {
    opts <- c("1", "2", "3", "4")
    paste(opts[((i + 0:1) %% length(opts)) + 1L], collapse = " ")
  }, character(1))
  problemas <- vapply(idx, function(i) {
    opts <- c("1", "2", "3", "4")
    paste(opts[((i + 1:2) %% length(opts)) + 1L], collapse = " ")
  }, character(1))
  data.frame(
    response_id = sprintf("AUD-%03d", idx),
    enumerador = sprintf("E%02d", ((idx - 1L) %% 8L) + 1L),
    fecha = as.Date("2026-05-01") + ((idx - 1L) %% 18L),
    region = .audit_reference_pick(c("1", "2", "1", "3"), n),
    distrito = distrito,
    zona = sprintf("Z%02d", ((idx - 1L) %% 12L) + 1L),
    edad = edad,
    sexo = .audit_reference_pick(c("1", "2", "1", "3"), n),
    consentimiento = consentimiento,
    satisfaccion = as.character(((idx - 1L) %% 5L) + 1L),
    servicios = servicios,
    area = area,
    area_other = ifelse(area == "99", ifelse(idx %% 8L == 0L, "", "Innovacion"), ""),
    ingreso = round(850 + (idx * 37.5), 2),
    puntaje = puntaje,
    comentario_open = ifelse(
      idx %% 5L == 0L,
      "Necesita seguimiento y comunicacion mas clara.",
      ifelse(idx %% 3L == 0L, "La experiencia fue positiva.", "Sin comentario adicional.")
    ),
    estado = .audit_reference_pick(c("completed", "approved", "completed", "rejected"), n),
    acuerdo = as.character(((idx + 1L) %% 5L) + 1L),
    n_hijos = ifelse(edad > 25L, idx %% 5L, NA_integer_),
    problemas = problemas,
    recomendacion_open = ifelse(
      idx %% 4L == 0L,
      "Mejorar tiempos de respuesta.",
      "Mantener canales actuales."
    ),
    latitud = -12.05 + idx / 10000,
    longitud = -77.03 - idx / 10000,
    telefono = sprintf("999%06d", idx),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.audit_reference_write_workbook <- function(path, sheets) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop("El paquete openxlsx es necesario para generar la auditoria canonica.", call. = FALSE)
  }
  wb <- openxlsx::createWorkbook()
  for (sheet in names(sheets)) {
    openxlsx::addWorksheet(wb, sheet)
    openxlsx::writeData(wb, sheet, sheets[[sheet]])
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  invisible(path)
}

audit_reference_write_inputs <- function(dir = audit_reference_dir()) {
  paths <- audit_reference_fixture_paths(dir)
  dir.create(paths$dir, recursive = TRUE, showWarnings = FALSE)
  .audit_reference_write_workbook(
    paths$xlsform,
    list(
      survey = .audit_reference_survey(),
      choices = .audit_reference_choices(),
      settings = .audit_reference_settings()
    )
  )
  .audit_reference_write_workbook(paths$data, list(data = .audit_reference_data()))
  meta <- list(
    name = AUDIT_REFERENCE_NAME,
    generated_at = .audit_reference_now(),
    xlsform = basename(paths$xlsform),
    data = basename(paths$data)
  )
  writeLines(
    jsonlite::toJSON(meta, auto_unbox = TRUE, pretty = TRUE),
    paths$metadata,
    useBytes = TRUE
  )
  paths
}

.audit_reference_calc_muestra <- function() {
  base <- calc_muestra_iniciar_estudio("acreditacion")
  comps <- base$componentes
  marcos <- list(
    administrativos = list(universo_bruto = 80L, marco_validado = 78L, marco_contactable = 72L, estado = "contactable"),
    docentes = list(universo_bruto = 210L, marco_validado = 205L, marco_contactable = 190L, estado = "contactable"),
    estudiantes = list(universo_bruto = 4200L, marco_validado = 4150L, marco_contactable = 4100L, estado = "validado"),
    egresados = list(universo_bruto = 640L, marco_validado = 600L, marco_contactable = 420L, estado = "contactable")
  )
  comps <- lapply(comps, function(comp) {
    key <- as.character(comp$actor_id %||% "")
    comp$marco <- marcos[[key]] %||% comp$marco
    comp
  })
  estudio <- calc_muestra_normalize_estudio(list(
    titulo = AUDIT_REFERENCE_NAME,
    modo_trabajo = "diseno_validado",
    macro_familia = base$macro_familia,
    contexto = list(
      cliente = "Pulso",
      tipo_cliente = "interno",
      descripcion_libre = "Fixture sintetico para auditoria local reproducible."
    ),
    componentes = comps
  ))
  calc_muestra_calcular_estudio(estudio)
}

.audit_reference_hojas_ruta_config <- function() {
  frame <- tryCatch(hojas_ruta_inei_frame(), error = function(e) data.frame())
  territorios <- if (is.data.frame(frame) && nrow(frame) && "ubigeo" %in% names(frame)) {
    as.list(head(unique(as.character(frame$ubigeo)), 2L))
  } else list()
  tryCatch(
    hojas_ruta_integrada_normalize_config(list(
      territorios = territorios,
      n_objetivo = 24L,
      entrevistas_por_manzana = 6L,
      seed = 20260531L
    )),
    error = function(e) list(territorios = territorios, n_objetivo = 24L)
  )
}

.audit_reference_dimensiones_config <- function() {
  list(
    listas_objetivo = as.list(c("likert5")),
    vars_recodificar = as.list(c("satisfaccion", "acuerdo")),
    excluir_vars = list(),
    orden_por_lista = list(likert5 = as.list(c("1", "2", "3", "4", "5"))),
    codigos_missing = list(),
    codigos_no_aplica = list(),
    prefijo = "r100_",
    subcriterios = list(),
    subindices = list(
      list(
        nombre = "experiencia",
        etiqueta = "Experiencia",
        vars = as.list(c("r100_satisfaccion"))
      ),
      list(
        nombre = "propuesta",
        etiqueta = "Propuesta",
        vars = as.list(c("r100_acuerdo"))
      )
    ),
    indices = list(
      list(
        nombre = "auditoria",
        etiqueta = "Indice de auditoria",
        subindices = as.list(c("experiencia", "propuesta"))
      )
    ),
    semaforo = list(
      cortes = as.list(c(60L, 80L)),
      colores = list(rojo = "#D84B55", ambar = "#E0B44C", verde = "#3A9A5B")
    ),
    radar = list(paleta = "okabe_ito", min_ejes = 2L),
    labels_indices = list(auditoria = "Indice de auditoria"),
    labels_subindices = list(
      experiencia = "Experiencia",
      propuesta = "Propuesta"
    ),
    labels_indicadores = list(
      r100_satisfaccion = "Satisfaccion general",
      r100_acuerdo = "Acuerdo con la propuesta"
    )
  )
}

.audit_reference_seed_session <- function(paths) {
  sid <- session_create()
  xmeta <- save_upload(
    sid,
    "xlsform",
    basename(paths$xlsform),
    readBin(paths$xlsform, "raw", n = file.info(paths$xlsform)$size)
  )
  dmeta <- save_upload(
    sid,
    "data",
    basename(paths$data),
    readBin(paths$data, "raw", n = file.info(paths$data)$size)
  )

  rp_inst <- reporte_instrumento(path = xmeta$path)
  data_raw <- as.data.frame(readxl::read_excel(dmeta$path), stringsAsFactors = FALSE, check.names = FALSE)
  data_norm <- normalize_data_for_xlsform(data_raw, rp_inst)
  .carga_assert_data_xlsform_compatible(data_norm, rp_inst)
  rp_data <- reporte_data(data_norm, instrumento = rp_inst)
  inst_limpieza <- leer_xlsform_limpieza(xmeta$path, verbose = FALSE)

  session_set(sid, "instrumento", inst_limpieza)
  session_set(sid, "inst_limpieza", inst_limpieza)
  session_set(sid, "data_raw_meta", list(file_id = dmeta$file_id, path = dmeta$path, ext = dmeta$ext))
  session_set(sid, "rp_inst", rp_inst)
  session_set(sid, "rp_data", rp_data)
  estudio_ensure(sid)
  estudio_set_nombre(sid, AUDIT_REFERENCE_NAME)
  estudio_add_base(
    sid,
    nombre = AUDIT_REFERENCE_BASE,
    xlsform_file_id = xmeta$file_id,
    data_file_id = dmeta$file_id,
    data_ext = dmeta$ext,
    rp_data = rp_data,
    rp_inst = rp_inst,
    n_filas = as.integer(nrow(data_norm)),
    n_columnas = as.integer(ncol(data_norm))
  )
  session_set(sid, "analitica_prep_ok", TRUE)
  session_set(sid, "analitica_fuente", "audit_reference:auditoria")
  session_set(sid, "xlsform_state", .audit_reference_xlsform_editor_state(paths))

  .dashboard_import_source(
    sid,
    list(xlsform_file_id = xmeta$file_id, data_file_id = dmeta$file_id),
    keep_curacion = TRUE
  )
  dash_cfg <- .dashboard_default_config()
  dash_cfg$titulo <- AUDIT_REFERENCE_NAME
  dash_cfg$subtitulo <- "Proyecto sintetico para revision y auditoria"
  dash_cfg$tabs_enabled <- list(resumen = TRUE, relaciones = TRUE, base_datos = TRUE, dimensiones = TRUE)
  session_set(sid, "dashboard_config", .dashboard_config_with_defaults(dash_cfg))
  session_set(sid, "dashboard_curacion", list(
    confirmed = TRUE,
    exclude_sections = list(),
    exclude_vars = list(),
    saved_at = .audit_reference_now()
  ))

  dim_out <- .dimensiones_construir(rp_data, rp_inst, .audit_reference_dimensiones_config())
  session_set(sid, "rp_dim", dim_out$data_dim)
  session_set(sid, "rp_dim_config", dim_out$dim_cfg)
  session_set(sid, "analitica_dim_ok", TRUE)

  session_set(sid, "calc_muestra_estudio", .audit_reference_calc_muestra())
  session_set(sid, "calc_muestra_reporte", list(disponible = FALSE))

  mon <- monitoreo_demo_payload(seed = 20260531L, n = 80L)
  session_set(sid, "monitoreo_sources", mon$sources)
  session_set(sid, "monitoreo_config", mon$config)
  session_set(sid, "monitoreo_snapshot", mon$snapshot)

  session_set(sid, "hojas_ruta_config", .audit_reference_hojas_ruta_config())
  session_set(sid, "hojas_ruta_ui_state", list(active_stage = "territorio"))
  session_set(sid, "audit_reference", list(
    name = AUDIT_REFERENCE_NAME,
    generated_at = .audit_reference_now(),
    base = AUDIT_REFERENCE_BASE,
    schema_version = 1L
  ))

  sid
}

audit_reference_build <- function(
  dir = audit_reference_dir(),
  project_path = audit_reference_project_path(dir),
  overwrite = TRUE
) {
  paths <- audit_reference_write_inputs(dir)
  if (file.exists(project_path) && !isTRUE(overwrite)) {
    stop(sprintf("Ya existe %s", project_path), call. = FALSE)
  }
  if (file.exists(project_path)) {
    Sys.chmod(project_path, mode = "0644")
  }

  sid <- .audit_reference_seed_session(paths)
  on.exit(session_delete(sid), add = TRUE)
  res <- build_pulso(sid, project_path, project_name = AUDIT_REFERENCE_NAME)
  Sys.chmod(project_path, mode = "0444")
  checksum <- .audit_reference_sha256(project_path)
  manifest <- list(
    ok = TRUE,
    name = AUDIT_REFERENCE_NAME,
    generated_at = .audit_reference_now(),
    project_path = normalizePath(project_path, mustWork = FALSE),
    project_sha256 = checksum,
    xlsform_path = normalizePath(paths$xlsform, mustWork = FALSE),
    data_path = normalizePath(paths$data, mustWork = FALSE),
    app_version = .audit_reference_app_version(),
    git_sha = .audit_reference_git_sha()
  )
  writeLines(
    jsonlite::toJSON(manifest, auto_unbox = TRUE, pretty = TRUE),
    paths$metadata,
    useBytes = TRUE
  )
  c(res, manifest)
}

audit_reference_prepare_run <- function(
  seed_project = audit_reference_project_path(),
  runs_root = file.path(normalizePath(file.path(.app_api_dir(), ".."), mustWork = FALSE), "outputs", "audit-runs"),
  run_id = format(Sys.time(), "%Y%m%dT%H%M%SZ", tz = "UTC")
) {
  if (!file.exists(seed_project)) {
    audit_reference_build(dir = dirname(seed_project), project_path = seed_project)
  }
  run_dir <- file.path(runs_root, run_id)
  project_dir <- file.path(run_dir, "project")
  dir.create(project_dir, recursive = TRUE, showWarnings = FALSE)
  project_path <- file.path(project_dir, sprintf("prosecnur_audit_reference_%s.pulso", run_id))
  ok <- file.copy(seed_project, project_path, overwrite = TRUE)
  if (!isTRUE(ok)) stop(sprintf("No se pudo copiar %s", seed_project), call. = FALSE)
  Sys.chmod(project_path, mode = "0644")

  manifest_path <- file.path(run_dir, "audit-run.json")
  manifest <- list(
    run_id = run_id,
    status = "prepared",
    created_at = .audit_reference_now(),
    seed_project_path = normalizePath(seed_project, mustWork = FALSE),
    project_path = normalizePath(project_path, mustWork = FALSE),
    project_sha256 = .audit_reference_sha256(project_path),
    app_version = .audit_reference_app_version(),
    git_sha = .audit_reference_git_sha(),
    screenshots = list()
  )
  dir.create(dirname(manifest_path), recursive = TRUE, showWarnings = FALSE)
  writeLines(
    jsonlite::toJSON(manifest, auto_unbox = TRUE, pretty = TRUE),
    manifest_path,
    useBytes = TRUE
  )
  normalizePath(manifest_path, mustWork = FALSE)
}

audit_reference_write_run_manifest <- function(manifest_path, patch = list(), project_path = NULL) {
  if (!nzchar(as.character(manifest_path %||% ""))) return(invisible(NULL))
  current <- if (file.exists(manifest_path)) {
    tryCatch(jsonlite::fromJSON(manifest_path, simplifyVector = FALSE), error = function(e) list())
  } else list()
  if (!is.null(project_path) && nzchar(as.character(project_path))) {
    patch$project_path <- normalizePath(project_path, mustWork = FALSE)
    patch$project_sha256 <- .audit_reference_sha256(project_path)
  }
  for (nm in names(patch)) current[[nm]] <- patch[[nm]]
  current$updated_at <- .audit_reference_now()
  dir.create(dirname(manifest_path), recursive = TRUE, showWarnings = FALSE)
  writeLines(
    jsonlite::toJSON(current, auto_unbox = TRUE, pretty = TRUE),
    manifest_path,
    useBytes = TRUE
  )
  invisible(current)
}

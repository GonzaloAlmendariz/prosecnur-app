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
AUDIT_REFERENCE_PANEL_BASE <- "auditoria_ola2"

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
    data_panel = file.path(dir, "auditoria_canonica_data_ola2.xlsx"),
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

.audit_reference_panel_data <- function(n = 72L) {
  out <- .audit_reference_data(n)
  idx <- seq_len(nrow(out))
  out$fecha <- as.Date(out$fecha) + 28L
  out$enumerador <- sprintf("E%02d", ((idx + 2L) %% 8L) + 1L)
  out$satisfaccion <- as.character(pmin(5L, as.integer(out$satisfaccion) + ifelse(idx %% 3L == 0L, 1L, 0L)))
  out$acuerdo <- as.character(pmax(1L, as.integer(out$acuerdo) - ifelse(idx %% 4L == 0L, 1L, 0L)))
  out$puntaje <- pmin(100L, suppressWarnings(as.integer(out$puntaje)) + ifelse(idx %% 2L == 0L, 4L, 1L))
  out$estado <- ifelse(idx %% 17L == 0L, "rejected", ifelse(idx %% 5L == 0L, "approved", "completed"))
  out$comentario_open <- ifelse(
    idx %% 6L == 0L,
    "Se observo mejora respecto a la primera ola.",
    out$comentario_open
  )
  out$recomendacion_open <- ifelse(
    idx %% 7L == 0L,
    "Reforzar recordatorios antes de la visita.",
    out$recomendacion_open
  )
  out
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
  .audit_reference_write_workbook(paths$data_panel, list(data = .audit_reference_panel_data()))
  meta <- list(
    name = AUDIT_REFERENCE_NAME,
    generated_at = .audit_reference_now(),
    xlsform = basename(paths$xlsform),
    data = basename(paths$data),
    data_panel = basename(paths$data_panel)
  )
  writeLines(
    jsonlite::toJSON(meta, auto_unbox = TRUE, pretty = TRUE),
    paths$metadata,
    useBytes = TRUE
  )
  paths
}

.audit_reference_aulas_base_madre <- function() {
  n_aulas <- 12L
  rows_por_aula <- 8L
  total <- n_aulas * rows_por_aula
  aula_idx <- rep(seq_len(n_aulas), each = rows_por_aula)
  student_idx <- seq_len(total)
  facultades <- c("FAC Ciencias Sociales", "FAC Ingenieria", "FAC Educacion")
  programas <- c("Sociologia", "Industrial", "Educacion", "Gestion", "Sistemas", "Psicologia")
  data.frame(
    student_id = sprintf("ALU%04d", student_idx),
    aula_id = sprintf("AUL%02d", aula_idx),
    curso_id = sprintf("CUR%02d", aula_idx),
    curso = paste("Curso auditoria", aula_idx),
    horario = .audit_reference_pick(c("L 08:00", "M 10:00", "J 14:00", "V 16:00"), total),
    seccion = sprintf("%02d", aula_idx),
    modalidad = "presencial",
    tipo_sesion = "teoria",
    docente = sprintf("Docente %02d", aula_idx),
    correo_docente = sprintf("docente%02d@example.test", aula_idx),
    facultad = .audit_reference_pick(facultades, total, offset = 1L),
    programa = .audit_reference_pick(programas, total, offset = 2L),
    sexo = .audit_reference_pick(c("F", "M"), total),
    edad = 18L + (student_idx %% 7L),
    condicion = "regular",
    nivel = "pregrado",
    matriculados = rows_por_aula,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.audit_reference_calc_muestra_aulas <- function() {
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(
      min_eligible_per_class = 4L,
      require_adult = TRUE,
      require_undergraduate = TRUE,
      require_in_person = TRUE
    ),
    selector = list(
      seed = 20260531L,
      n_aulas = 4L,
      replacement_waves = 1L,
      selector_engine = "cube_balanceado",
      strata_cols = list("faculty"),
      balance_vars = list("faculty", "program", "sex_top_1"),
      simulation_runs = 12L,
      monte_carlo_n = 12L
    )
  ))
  frame <- calc_muestra_aulas_construir(
    base_madre = .audit_reference_aulas_base_madre(),
    config = cfg
  )
  selection <- calc_muestra_aulas_seleccionar(frame, cfg)
  comparison <- tryCatch(
    calc_muestra_aulas_comparar_metodos(frame, cfg, simulation_runs = 12L),
    error = function(e) NULL
  )
  replacement <- tryCatch(
    calc_muestra_aulas_simular_reemplazos(frame, selection, cfg),
    error = function(e) NULL
  )
  list(
    config = cfg,
    frame = frame,
    selection = selection,
    method_comparison = comparison,
    replacement_simulation = replacement
  )
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
    workspace = list(
      frame_mode = "acreditacion",
      escenarios_auditados = as.list(c("acreditacion", "marco_propio", "opinion_universitaria"))
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

.audit_reference_hojas_ruta_state <- function() {
  cfg <- .audit_reference_hojas_ruta_config()
  population <- tryCatch(hojas_ruta_population_preview_integrado(cfg), error = function(e) NULL)
  sample_size <- tryCatch(hojas_ruta_sample_size_preview(cfg), error = function(e) NULL)
  quota <- tryCatch(hojas_ruta_quota_preview_integrado(cfg), error = function(e) NULL)
  sample <- tryCatch(hojas_ruta_sample_preview_integrado(cfg), error = function(e) NULL)
  outputs <- .hojas_ruta_workspace_outputs_normalize(list(
    population = population,
    sample_size_preview = sample_size,
    quota = quota,
    sample = sample
  ))
  ui_state <- .hojas_ruta_ui_state_normalize(
    list(active_stage = if (!is.null(sample) && isTRUE(sample$ok)) "entrega" else "territorio"),
    cfg
  )
  run <- .hojas_ruta_run_normalize(
    list(
      config = cfg,
      ui_state = ui_state,
      workspace_outputs = outputs,
      pilot_exclusion_mode = "ignore"
    ),
    "field"
  )
  list(
    config = run$config,
    ui_state = run$ui_state,
    workspace_outputs = run$workspace_outputs,
    runs = list(field = run),
    active_phase = "field"
  )
}

.audit_reference_codificacion_state <- function() {
  comentario_respuestas <- as.list(c(
    "Necesita seguimiento y comunicacion mas clara.",
    "La experiencia fue positiva.",
    "Sin comentario adicional."
  ))
  recomendacion_respuestas <- as.list(c(
    "Mejorar tiempos de respuesta.",
    "Mantener canales actuales."
  ))
  list(
    familias_draft = list(
      rows = list(
        list(
          tipo = "text",
          modo_so = "",
          parent = "comentario_open",
          parent_label = "Comentario abierto",
          list_norm = "",
          parent_col = "comentario_open",
          text_col = "comentario_open",
          use = TRUE,
          q_order = 19L
        ),
        list(
          tipo = "text",
          modo_so = "",
          parent = "recomendacion_open",
          parent_label = "Recomendacion abierta",
          list_norm = "",
          parent_col = "recomendacion_open",
          text_col = "recomendacion_open",
          use = TRUE,
          q_order = 26L
        )
      ),
      source = "audit_reference",
      updated_at = .audit_reference_now()
    ),
    familias_generated = TRUE,
    marcadas = list(comentario_open = TRUE, recomendacion_open = TRUE),
    respuestas_recod = list(
      comentario_open = comentario_respuestas,
      recomendacion_open = recomendacion_respuestas
    ),
    grupos_recod = list(
      comentario_open = list(
        list(
          codigo = "101",
          label = "Seguimiento y comunicacion",
          etiqueta = "Seguimiento y comunicacion",
          origen = "audit_reference",
          respuestas = as.list(c("Necesita seguimiento y comunicacion mas clara."))
        ),
        list(
          codigo = "102",
          label = "Experiencia positiva o neutra",
          etiqueta = "Experiencia positiva o neutra",
          origen = "audit_reference",
          respuestas = as.list(c("La experiencia fue positiva.", "Sin comentario adicional."))
        )
      ),
      recomendacion_open = list(
        list(
          codigo = "201",
          label = "Mejorar tiempos",
          etiqueta = "Mejorar tiempos",
          origen = "audit_reference",
          respuestas = as.list(c("Mejorar tiempos de respuesta."))
        ),
        list(
          codigo = "202",
          label = "Mantener canales",
          etiqueta = "Mantener canales",
          origen = "audit_reference",
          respuestas = as.list(c("Mantener canales actuales."))
        )
      )
    ),
    plantilla_template = TRUE
  )
}

.audit_reference_analitica_config <- function() {
  cfg <- .analitica_default_config()
  cfg$fuente_preferida <- "originales"
  cfg$panel$key <- "response_id"
  cfg$panel$waves <- list(
    list(base = AUDIT_REFERENCE_BASE, label = "Ola 1", suffix = "ola1", order = 1L),
    list(base = AUDIT_REFERENCE_PANEL_BASE, label = "Ola 2", suffix = "ola2", order = 2L)
  )
  cfg$panel$nse$enabled <- FALSE
  cfg$panel$outputs <- list(
    codebook = TRUE,
    frecuencias = TRUE,
    auditoria = TRUE,
    cobertura_nse = FALSE
  )
  cfg
}

.audit_reference_graficos_config <- function(sid) {
  cfg <- .graficos_default_config(sid)
  cfg$plan$slides <- list(
    list(
      id = "audit-cover",
      tipo = "p_slide_portada",
      payload = list(
        titulo = AUDIT_REFERENCE_NAME,
        subtitulo = "Auditoria reproducible de modulos Prosecnur"
      )
    ),
    list(
      id = "audit-section",
      tipo = "p_slide_seccion",
      payload = list(
        titulo = "Resultados sinteticos",
        subtitulo = "Base auditora"
      )
    ),
    list(
      id = "audit-satisfaccion",
      tipo = "p_slide_1_grafico",
      payload = list(
        titulo = "Satisfaccion general",
        grafico = list(
          graficador = "p_barras",
          args = list(var = paste0(AUDIT_REFERENCE_BASE, "$satisfaccion"))
        )
      )
    ),
    list(
      id = "audit-servicios",
      tipo = "p_slide_1_grafico",
      payload = list(
        titulo = "Servicios usados",
        grafico = list(
          graficador = "p_barras",
          args = list(var = paste0(AUDIT_REFERENCE_BASE, "$servicios"))
        )
      )
    )
  )
  cfg$selected_slide_id <- "audit-satisfaccion"
  cfg$view_mode <- "timeline"
  cfg
}

.audit_reference_monitoreo_state <- function(aulas, estudio) {
  cfg_aulas <- monitoreo_aulas_from_calc(estudio, aulas$selection, aulas$frame, list(
    source_mapping = list(
      classroom_id_var = "classroom_id",
      status_var = "response_status",
      collector_var = "collector_id",
      valid_statuses = as.list(c("completed", "valid", "aprobado"))
    )
  ))
  plan_df <- .monitoreo_aulas_df(cfg_aulas$plan, "plan")
  responses <- if (nrow(plan_df)) {
    data.frame(
      response_id = sprintf("AUL-RESP-%03d", seq_len(min(12L, nrow(plan_df) * 2L))),
      classroom_id = rep(plan_df$classroom_id, each = 2L)[seq_len(min(12L, nrow(plan_df) * 2L))],
      response_status = .audit_reference_pick(c("completed", "valid", "rejected"), min(12L, nrow(plan_df) * 2L)),
      collector_id = sprintf("COL-%02d", seq_len(min(12L, nrow(plan_df) * 2L))),
      synced_at = .audit_reference_now(),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  } else {
    data.frame()
  }
  dashboard_aulas <- monitoreo_aulas_dashboard(cfg_aulas$plan, responses, cfg_aulas)
  cfg <- monitoreo_normalize_config(
    list(
      project_name = AUDIT_REFERENCE_NAME,
      monitoreo_profile = list(
        family = "aulas_universitarias",
        status = "active",
        route_selected = TRUE
      ),
      aulas_universitarias = cfg_aulas
    ),
    responses
  )
  dashboard <- monitoreo_build_dashboard(responses, cfg, include_reports = TRUE)
  dashboard$aulas_universitarias_reports <- dashboard_aulas
  scenarios <- list(
    acreditacion = tryCatch(monitoreo_publish_qa_fixture("acreditacion"), error = function(e) NULL),
    territorial = tryCatch(monitoreo_publish_qa_fixture("territorial"), error = function(e) NULL),
    aulas_universitarias = list(
      family = "aulas_universitarias",
      data = responses,
      config = cfg,
      dashboard = dashboard_aulas,
      synced_at = .audit_reference_now()
    )
  )
  list(
    sources = list(
      list(
        id = "audit_aulas",
        kind = "survey",
        role = "aulas_universitarias",
        label = "Aplicacion en aulas - fixture auditoria",
        enabled = TRUE,
        updated_at = .audit_reference_now()
      )
    ),
    config = cfg,
    snapshot = list(
      synced_at = .audit_reference_now(),
      data = responses,
      config = cfg,
      dashboard = dashboard,
      variables = if (nrow(responses)) monitoreo_variables(responses) else list(),
      errors = list()
    ),
    aulas_config = cfg_aulas,
    aulas_plan = cfg_aulas$plan,
    aulas_dashboard = dashboard_aulas,
    aulas_snapshot = list(
      synced_at = .audit_reference_now(),
      dashboard = dashboard_aulas,
      response_rows = as.integer(nrow(responses))
    ),
    aulas_publication = list(
      publication_family = "university_classroom_fieldwork",
      imported_at = cfg_aulas$imported_at,
      selection_run_id = cfg_aulas$selection_run_id,
      frame_hash = cfg_aulas$frame_hash
    ),
    scenarios = Filter(Negate(is.null), scenarios)
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
  d2meta <- save_upload(
    sid,
    "data",
    basename(paths$data_panel),
    readBin(paths$data_panel, "raw", n = file.info(paths$data_panel)$size)
  )

  rp_inst <- reporte_instrumento(path = xmeta$path)
  data_raw <- as.data.frame(readxl::read_excel(dmeta$path), stringsAsFactors = FALSE, check.names = FALSE)
  data_norm <- normalize_data_for_xlsform(data_raw, rp_inst)
  .carga_assert_data_xlsform_compatible(data_norm, rp_inst)
  rp_data <- reporte_data(data_norm, instrumento = rp_inst)
  data_panel_raw <- as.data.frame(readxl::read_excel(d2meta$path), stringsAsFactors = FALSE, check.names = FALSE)
  data_panel_norm <- normalize_data_for_xlsform(data_panel_raw, rp_inst)
  .carga_assert_data_xlsform_compatible(data_panel_norm, rp_inst)
  rp_data_panel <- reporte_data(data_panel_norm, instrumento = rp_inst)
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
  estudio_add_base(
    sid,
    nombre = AUDIT_REFERENCE_PANEL_BASE,
    xlsform_file_id = xmeta$file_id,
    data_file_id = d2meta$file_id,
    data_ext = d2meta$ext,
    rp_data = rp_data_panel,
    rp_inst = rp_inst,
    n_filas = as.integer(nrow(data_panel_norm)),
    n_columnas = as.integer(ncol(data_panel_norm)),
    extra_meta = list(wave_label = "Ola 2", panel_role = "follow_up")
  )
  estudio_active_base_set(sid, AUDIT_REFERENCE_BASE)
  codif <- list()
  codif[[AUDIT_REFERENCE_BASE]] <- .audit_reference_codificacion_state()
  session_set(sid, "codif_por_base", codif)

  session_set(sid, "analitica_prep_ok", TRUE)
  session_set(sid, "analitica_fuente", "audit_reference:auditoria")
  .analitica_config_set(sid, .audit_reference_analitica_config())
  panel_preview <- tryCatch(
    .analitica_panel_preview(sid, .audit_reference_analitica_config()$panel, rows = 12L),
    error = function(e) NULL
  )
  if (is.list(panel_preview)) {
    session_set(sid, "analitica_panel_ok", TRUE)
    session_set(sid, "analitica_panel_preview", panel_preview)
  }
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

  calc_estudio <- .audit_reference_calc_muestra()
  aulas <- .audit_reference_calc_muestra_aulas()
  session_set(sid, "calc_muestra_estudio", calc_estudio)
  session_set(sid, "calc_muestra_reporte", list(disponible = FALSE))
  session_set(sid, "calc_muestra_aulas_config", aulas$config)
  session_set(sid, "calc_muestra_aulas_frame", aulas$frame)
  session_set(sid, "calc_muestra_aulas_selection", aulas$selection)
  session_set(sid, "calc_muestra_aulas_method_comparison", aulas$method_comparison)
  session_set(sid, "calc_muestra_aulas_replacement_simulation", aulas$replacement_simulation)

  .graficos_config_set(sid, .audit_reference_graficos_config(sid))
  .graficos_status_set(sid, "graficos_ppt_ok", FALSE)
  .graficos_status_set(sid, "graficos_word_ok", FALSE)

  mon <- .audit_reference_monitoreo_state(aulas, calc_estudio)
  session_set(sid, "monitoreo_sources", mon$sources)
  session_set(sid, "monitoreo_config", mon$config)
  session_set(sid, "monitoreo_snapshot", mon$snapshot)
  session_set(sid, "monitoreo_aulas_plan", mon$aulas_plan)
  session_set(sid, "monitoreo_aulas_snapshot", mon$aulas_snapshot)
  session_set(sid, "monitoreo_aulas_publication", mon$aulas_publication)

  hojas <- .audit_reference_hojas_ruta_state()
  session_set(sid, "hojas_ruta_config", hojas$config)
  session_set(sid, "hojas_ruta_ui_state", hojas$ui_state)
  session_set(sid, "hojas_ruta_workspace_outputs", hojas$workspace_outputs)
  session_set(sid, "hojas_ruta_runs", hojas$runs)
  session_set(sid, "hojas_ruta_active_phase", hojas$active_phase)
  session_set(sid, "audit_reference", list(
    name = AUDIT_REFERENCE_NAME,
    generated_at = .audit_reference_now(),
    base = AUDIT_REFERENCE_BASE,
    panel_base = AUDIT_REFERENCE_PANEL_BASE,
    schema_version = 2L,
    coverage = list(
      monitoreo_families = as.list(c("acreditacion", "territorial", "aulas_universitarias")),
      calc_muestra = list(
        macro_families = as.list(c("acreditacion", "marco_propio", "opinion_universitaria")),
        aulas_selection = TRUE
      ),
      hojas_ruta = list(has_sample = !is.null(hojas$workspace_outputs$sample)),
      dashboard = TRUE,
      xlsform_editor = TRUE,
      graficos_plan = TRUE,
      codificacion = TRUE,
      analitica_panel = is.list(panel_preview)
    ),
    monitoreo_scenarios = mon$scenarios
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
    data_panel_path = normalizePath(paths$data_panel, mustWork = FALSE),
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

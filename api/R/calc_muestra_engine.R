# =============================================================================
# Motor de Cálculo de Muestra — multi-componente, multi-metodología
# =============================================================================
#
# Implementación de la visión canónica del compendio metodológico PULSO PUCP
# (outputs/fuentes_metodologicas/00_COMPENDIO_METODOLOGICO_PULSO.md).
#
# Alcance: módulo de CÁLCULO MUESTRAL PARA PROPUESTAS. El seguimiento
# durante el levantamiento y el cierre de campo viven en el módulo de
# Monitoreo (/monitoreo).
#
# Estructura central:
#
#   Estudio = {
#     id, titulo, fecha_creacion,
#     modo_trabajo (estimacion_preliminar | diseno_validado),
#     macro_familia (acreditacion, hsvg_universitario, linea_base_servicios, ...),
#     consideraciones_eticas (TRUE/FALSE — flag interno para protocolos
#       éticos en estudios con población especial),
#     contexto = { cliente, tipo_cliente, descripcion_libre },
#     componentes = [Componente, ...]
#   }
#
#   Componente = {
#     id, actor (string libre o template), tecnica (metodología),
#     origen_tamano (formula | meta_contractual | cobertura_esperada | matriz_perfiles_cualitativa),
#     marco = { universo_bruto, marco_validado, marco_contactable, estado,
#       notas, estratos, matriz_operativa },
#     parametros = {z, p, e, deff, ...},
#     meta = { tipo: 'objetivo'|'cuota'|'cobertura'|'contractual', valor, variable_control },
#     resultado = { ... salida del cálculo ... }
#   }
#
# Cobertura Fase 1:
#   1. prob_aleatorio_simple           → fórmula clásica y matriz tipo GIZ
#   2. prob_conglomerado_multietapico  → permite margen de error
#   3. intencion_censal                → cobertura esperada
#   4. barrido                         → cobertura operativa
#   5. no_prob_cuotas                  → matriz de cuotas
#   6. no_prob_conveniencia            → cuotas por estrato con clamp
#   7. listado_externo_meta_fija       → compatibilidad legacy; no se ofrece
#      como flujo nuevo del calculador.
#
# Medición recurrente queda fuera de la Fase 1 y aún levanta
# `E_METODOLOGIA_NO_IMPLEMENTADA` desde el endpoint /calcular.

# ---------------------------------------------------------------------------
# Constantes y defaults canónicos
# ---------------------------------------------------------------------------

.CM_VERSION <- 1L

.CM_TECNICAS_FASE_1 <- c(
  "prob_aleatorio_simple",
  "prob_estratificado",
  "prob_estratificado_independiente",
  "prob_conglomerado_multietapico",
  "sistematico",
  "intencion_censal",
  "barrido",
  "no_prob_cuotas",
  "no_prob_conveniencia",
  "listado_externo_meta_fija"
)

.CM_TECNICAS_TODAS <- c(
  "prob_aleatorio_simple",
  "prob_estratificado",
  "prob_estratificado_independiente",
  "prob_conglomerado_multietapico",
  "sistematico",
  "medicion_recurrente",
  "barrido",
  "intencion_censal",
  "listado_externo_meta_fija",
  "no_prob_conveniencia",
  "no_prob_cuotas"
)

.CM_ORIGENES_TAMANO <- c(
  "formula",
  "meta_contractual",
  "cobertura_esperada",
  "matriz_perfiles_cualitativa"
)

.CM_MODOS_TRABAJO <- c(
  "estimacion_preliminar",
  "diseno_validado"
)

.CM_MACRO_FAMILIAS <- c(
  "acreditacion",
  "encuesta_estudiantes",
  "hsvg_universitario",
  "territorial",
  "listado_telefonico",
  "linea_base_servicios",
  "estudio_propio"
)

.CM_NATURALEZAS_POR_TECNICA <- list(
  prob_aleatorio_simple            = "prob",
  prob_estratificado               = "prob",
  prob_estratificado_independiente = "prob",
  prob_conglomerado_multietapico   = "prob",
  sistematico                      = "prob",
  medicion_recurrente              = "prob",
  barrido                          = "operativo",
  intencion_censal                 = "operativo",
  listado_externo_meta_fija        = "operativo",
  no_prob_conveniencia             = "no_prob",
  no_prob_cuotas                   = "no_prob"
)

.CM_PERMITE_MARGEN_POR_TECNICA <- list(
  prob_aleatorio_simple            = TRUE,
  prob_estratificado               = TRUE,
  prob_estratificado_independiente = TRUE,
  prob_conglomerado_multietapico   = TRUE,
  sistematico                      = TRUE,
  medicion_recurrente              = TRUE,
  barrido                          = FALSE,
  intencion_censal                 = FALSE,
  listado_externo_meta_fija        = FALSE,
  no_prob_conveniencia             = FALSE,
  no_prob_cuotas                   = FALSE
)

.CM_ESTADOS_MARCO <- c(
  "no_definido",
  "bruto",
  "validado",
  "contactable",
  "listado_externo",
  "operativo"
)

.CM_NIVELES_RESPALDO <- c(
  "representatividad_estadistica",
  "representatividad_operacional",
  "representatividad_teorica_controlada",
  "cobertura_balanceada",
  "evidencia_descriptiva"
)

# Categorías canónicas de actores en acreditaciones PUCP (compendio §4.1).
# El sistema usa esto para inferir técnica y mínimo a cumplir según
# actor × canal × N, sin que el usuario tenga que elegir la técnica.
.CM_ACTOR_CATEGORIAS <- c(
  "estudiantes",
  "docentes",
  "administrativos",
  "egresados",
  "empleadores",      # cualitativo, no entra al cálculo cuantitativo
  "comite_consultivo", # cualitativo, no entra al cálculo cuantitativo
  "otros"
)

# Canales de recojo de información canónicos en acreditación.
# El canal determina la técnica operativa apropiada para cada actor.
.CM_CANAL_RECOJO <- c(
  "aula_qr",        # estudiantes: barrido en aulas con QR
  "telefonico",     # egresados típicamente, con conveniencia y regla canónica
  "online_email",   # docentes/administrativos: intención censal o cuotas
  "presencial",     # talleres, sesiones (cualitativos en su mayoría)
  "mixto",          # ej. egresados telefónico + correo
  "sin_definir"
)

.CM_DEFAULTS_PARAMS <- list(
  z = 1.96,
  p = 0.5,
  e = 0.05,
  deff = 1.5,
  tau = 0.7,
  oversample_pct = 0.10,
  tasa_contacto = 0.5,
  tasa_elegibilidad = 0.9,
  tasa_respuesta = 0.6,
  cobertura_objetivo = 0.50,
  # Defaults canónicos PULSO PUCP para conveniencia estratificada (egresados
  # telefónicos de acreditación, documento Marzo 2026):
  #   - cobertura_objetivo = 0.50 (50% de cobertura por carrera)
  #   - n_minimo_estrato   = 30   (mínimo TCL para análisis válido)
  #   - tope_operativo     = 150  (cap por eficiencia/costos sobre N>300)
  # La regla aplicada por estrato es: cuota = clamp(ceil(N×0.50), 30, 150),
  # sin pedir más que el propio N del estrato. Aplica automáticamente cuando
  # la técnica del componente es no_prob_conveniencia y el marco tiene
  # estratos definidos.
  n_minimo_estrato = 30,
  tope_operativo = 150
)

# ---------------------------------------------------------------------------
# Normalización del Estudio
# ---------------------------------------------------------------------------

#' Normaliza un Estudio recibido del frontend a su forma canónica.
#'
#' @param estudio Lista (posiblemente parcial) con el estudio.
#' @return Lista normalizada con defaults aplicados y componentes validados.
calc_muestra_normalize_estudio <- function(estudio = list()) {
  if (is.null(estudio) || !is.list(estudio)) estudio <- list()

  list(
    version          = .CM_VERSION,
    id               = calc_str(estudio$id, ""),
    titulo           = calc_str(estudio$titulo, "Estudio sin título"),
    fecha_creacion   = calc_str(estudio$fecha_creacion,
                                format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")),
    modo_trabajo     = calc_enum(estudio$modo_trabajo, .CM_MODOS_TRABAJO,
                                 "estimacion_preliminar"),
    macro_familia    = calc_enum(estudio$macro_familia, .CM_MACRO_FAMILIAS,
                                 "estudio_propio"),
    modo_sensible    = calc_bool(estudio$modo_sensible, default = FALSE),
    contexto         = .cm_normalize_contexto(estudio$contexto),
    componentes      = .cm_normalize_componentes(estudio$componentes),
    workspace        = .cm_normalize_workspace(estudio$workspace)
  )
}

.cm_normalize_contexto <- function(ctx) {
  if (is.null(ctx) || !is.list(ctx)) ctx <- list()
  list(
    cliente            = calc_str(ctx$cliente, ""),
    tipo_cliente       = calc_str(ctx$tipo_cliente, ""),
    descripcion_libre  = calc_str(ctx$descripcion_libre, "")
  )
}

# F5: ¿cambió contenido del estudio que ALIMENTA el reporte? El workspace es
# estado de UI que el autosave pega cada ~2 s (paneles, borradores, motor/
# recorrido) y NO participa del render del reporte, así que se excluye de la
# comparación. Ambos lados deben venir normalizados (todas las escrituras a
# sesión pasan por calc_muestra_normalize_estudio). prev NULL => TRUE
# (conservador: sin baseline, asumir cambio).
calc_muestra_estudio_cambio_relevante <- function(prev, nuevo) {
  strip <- function(e) {
    if (is.null(e) || !is.list(e)) return(NULL)
    e[setdiff(names(e), "workspace")]
  }
  !identical(strip(prev), strip(nuevo))
}

# F5: meta del reporte tras un PUT de estudio. Antes cada PUT hacía
# session_set(reporte, list(disponible = FALSE)): el autosave borraba
# job_id/path y la descarga devolvía 404 (E_NO_REPORTE) aunque el archivo
# existiera. Ahora la meta se PRESERVA y solo se marca `stale = TRUE` cuando
# cambió contenido relevante; la descarga sigue funcionando mientras el
# archivo exista y la UI puede avisar "desactualizado" con el flag.
calc_muestra_reporte_meta_tras_estudio <- function(meta, prev, nuevo) {
  meta <- if (is.list(meta)) meta else list(disponible = FALSE)
  if (calc_muestra_estudio_cambio_relevante(prev, nuevo)) meta$stale <- TRUE
  meta
}

# F5: marca el reporte como desactualizado preservando la meta (job_id/path/
# disponible). Para mutaciones que SIEMPRE cambian contenido del reporte
# (componentes, cálculo, iniciar estudio).
calc_muestra_reporte_meta_marcar_stale <- function(meta) {
  meta <- if (is.list(meta)) meta else list(disponible = FALSE)
  meta$stale <- TRUE
  meta
}

.cm_normalize_workspace <- function(ws) {
  if (is.null(ws) || !is.list(ws)) return(NULL)
  frame_modes <- c(
    "sin_definir",
    "acreditacion",
    "opinion_universitaria",
    "marco_disponible",
    "territorial_handoff",
    "legacy"
  )
  list(
    version = 2L,
    frame_mode = calc_enum(ws$frame_mode, frame_modes, "sin_definir"),
    marco_disponible = calc_str(ws$marco_disponible, ""),
    fuente_marco = calc_str(ws$fuente_marco, ""),
    unidad_observacion = calc_str(ws$unidad_observacion, ""),
    unidad_muestreo = calc_str(ws$unidad_muestreo, ""),
    variables_control = .cm_normalize_workspace_variables(ws$variables_control),
    escenarios = .cm_normalize_workspace_escenarios(ws$escenarios),
    source_mode = calc_enum(ws$source_mode, c("base_madre", "dos_bases", "seleccion_existente"), "base_madre"),
    source_bindings = .cm_normalize_workspace_source_bindings(ws$source_bindings),
    variable_mappings = .cm_normalize_workspace_variable_mappings(ws$variable_mappings),
    # W1: mapeos manuales de categorías (etiqueta/include por valor crudo).
    # Declarados por el cliente TS (CalcMuestraWorkspaceCategoryMapping); el
    # workspace es whitelist-only y sin esta entrada el round-trip PUT→GET
    # los BORRABA en silencio (gotcha conocido del repo).
    category_mappings = .cm_normalize_workspace_category_mappings(ws$category_mappings),
    publication_config = .cm_normalize_workspace_publication_config(ws$publication_config),
    aulas_config = .cm_normalize_workspace_aulas_config(ws$aulas_config),
    notas_diseno = calc_str(ws$notas_diseno, ""),
    run_history = .cm_normalize_workspace_run_history(ws$run_history),
    motor_recorrido = .cm_normalize_workspace_motor_recorrido(ws$motor_recorrido),
    # Etapa canónica del método HSyVBG: propuesta (data del semestre anterior)
    # vs campo (base de DTI del semestre de aplicación). Default propuesta.
    etapa = calc_enum(ws$etapa, c("propuesta", "campo"), "propuesta")
  )
}

# Mini-historial de corridas (cálculo/selección) que el frontend registra en
# el workspace. Passthrough con dos garantías: solo entradas con id y cap de
# 12 (FIFO: se conservan las últimas). Proyectos viejos sin el campo -> list().
.cm_normalize_workspace_run_history <- function(items) {
  if (is.null(items) || !is.list(items) || length(items) == 0L) return(list())
  out <- Filter(function(item) {
    is.list(item) && nzchar(calc_str(item$id, ""))
  }, items)
  n <- length(out)
  if (n > 12L) out <- out[(n - 11L):n]
  out
}

# Estado persistido del Motor/Recorrido muestral que el frontend guarda en el
# workspace (perfil institucional editable + decisiones del usuario).
# Passthrough con garantías mínimas de tipo: `perfil` y `decisiones` son
# OPACOS para R — el normalizador defensivo real vive en el dominio TS del
# frontend. Proyectos viejos sin el campo -> NULL (retrocompat).
.cm_normalize_workspace_motor_recorrido <- function(mr) {
  if (is.null(mr) || !is.list(mr)) return(NULL)
  list(
    schema = calc_str(mr$schema, "calc_muestra_workspace_motor_v1"),
    fuente = calc_enum(mr$fuente, c("proyecto", "manual"), "proyecto"),
    perfil = if (is.list(mr$perfil)) mr$perfil else NULL,
    decisiones = if (is.list(mr$decisiones)) mr$decisiones else NULL,
    tocado = calc_bool(mr$tocado, default = FALSE),
    actualizado_at = calc_str(mr$actualizado_at, "")
  )
}

# W1: normalizador defensivo de los mapeos de categorías del workspace.
# Cada entrada exige `role` no vacío; sus `values` son pares {raw, label}
# con include (default TRUE: la categoría participa) y notas opcionales.
# El `raw` vacío se conserva: representa la categoría "sin dato" observada.
.cm_normalize_workspace_category_mappings <- function(items) {
  if (is.null(items) || !is.list(items) || length(items) == 0L) return(list())
  out <- lapply(items, function(item) {
    if (!is.list(item)) return(NULL)
    role <- calc_str(item$role, "")
    if (!nzchar(role)) return(NULL)
    values <- item$values %||% list()
    if (!is.list(values)) values <- list()
    values <- Filter(Negate(is.null), lapply(values, function(v) {
      if (!is.list(v)) return(NULL)
      list(
        raw = calc_str(v$raw, ""),
        label = calc_str(v$label, ""),
        include = calc_bool(v$include, TRUE),
        notes = calc_str(v$notes, "")
      )
    }))
    list(
      role = role,
      label = calc_str(item$label, ""),
      source_role = calc_str(item$source_role, ""),
      column = calc_str(item$column, ""),
      values = values
    )
  })
  Filter(Negate(is.null), out)
}

.cm_normalize_workspace_source_bindings <- function(items) {
  if (is.null(items) || !is.list(items) || length(items) == 0L) return(list())
  statuses <- c("pendiente", "declarada", "cargada", "validada", "revisar")
  out <- lapply(items, function(item) {
    if (!is.list(item)) return(NULL)
    role <- calc_str(item$role, "")
    label <- calc_str(item$label, "")
    if (!nzchar(role) && !nzchar(label)) return(NULL)
    list(
      id = calc_str(item$id, .cm_random_id()),
      role = role,
      label = label,
      status = calc_enum(item$status, statuses, "pendiente"),
      file_id = calc_str(item$file_id, ""),
      file_name = calc_str(item$file_name, ""),
      spreadsheet_id = calc_str(item$spreadsheet_id, ""),
      sheet_name = calc_str(item$sheet_name, ""),
      available_sheets = as.list(unique(stats::na.omit(as.character(unlist(item$available_sheets %||% list(), use.names = FALSE))))),
      suggested_sheet = calc_str(item$suggested_sheet, ""),
      detected_role = calc_str(item$detected_role, ""),
      compatibility_status = calc_str(item$compatibility_status, ""),
      sheet_diagnostics = item$sheet_diagnostics %||% list(),
      range = calc_str(item$range, ""),
      rows = calc_int(item$rows, 0L, min = 0L),
      columns = calc_int(item$columns, 0L, min = 0L),
      notes = calc_str(item$notes, "")
    )
  })
  Filter(Negate(is.null), out)
}

.cm_normalize_workspace_variable_mappings <- function(items) {
  if (is.null(items) || !is.list(items) || length(items) == 0L) return(list())
  out <- lapply(items, function(item) {
    if (!is.list(item)) return(NULL)
    role <- calc_str(item$role, "")
    label <- calc_str(item$label, "")
    if (!nzchar(role) && !nzchar(label)) return(NULL)
    list(
      role = role,
      label = label,
      required = calc_bool(item$required, FALSE),
      source_role = calc_str(item$source_role, ""),
      column = calc_str(item$column, ""),
      description = calc_str(item$description, "")
    )
  })
  Filter(Negate(is.null), out)
}

.cm_normalize_workspace_publication_config <- function(cfg) {
  if (is.null(cfg) || !is.list(cfg)) cfg <- list()
  list(
    google_sheets_enabled = calc_bool(cfg$google_sheets_enabled, FALSE),
    spreadsheet_id = calc_str(cfg$spreadsheet_id, ""),
    spreadsheet_url = calc_str(cfg$spreadsheet_url, ""),
    publication_mode = calc_str(cfg$publication_mode, "single_spreadsheet_multi_sheet"),
    internal_sheet_name = calc_str(cfg$internal_sheet_name, "CalcMuestra_Aulas_Interno"),
    client_sheet_name = calc_str(cfg$client_sheet_name, "CalcMuestra_Cliente"),
    frame_sheet_name = calc_str(cfg$frame_sheet_name, "Marco muestral"),
    sample_calculation_sheet_name = calc_str(cfg$sample_calculation_sheet_name, "Calculo muestral"),
    classroom_selection_sheet_name = calc_str(cfg$classroom_selection_sheet_name, "Seleccion de cursos-horario"),
    replacement_sheet_name = calc_str(cfg$replacement_sheet_name, "Aulas de reemplazo"),
    agenda_sheet_name = calc_str(cfg$agenda_sheet_name, "Agenda de aulas"),
    methodology_sheet_name = calc_str(cfg$methodology_sheet_name, "Sustento metodologico"),
    include_workbook = calc_bool(cfg$include_workbook, TRUE),
    include_methodology = calc_bool(cfg$include_methodology, TRUE),
    include_frame_audit = calc_bool(cfg$include_frame_audit, TRUE),
    include_sample_calculation = calc_bool(cfg$include_sample_calculation, TRUE),
    include_classroom_selection = calc_bool(cfg$include_classroom_selection, TRUE),
    include_replacements = calc_bool(cfg$include_replacements, TRUE),
    pii_policy = calc_str(cfg$pii_policy, "sin_pii_cliente")
  )
}

.cm_normalize_chr_list <- function(x) {
  as.list(unique(stats::na.omit(as.character(unlist(x %||% list(), use.names = FALSE)))))
}

# W1: pesos del score de reemplazo. Lista nombrada numerica; los pesos
# conocidos del motor son la base y el input del usuario los sobreescribe
# clave a clave (valores no numericos/no finitos se descartan). Claves
# custom se conservan: el motor las lee por nombre con default propio.
.cm_normalize_workspace_score_weights <- function(w) {
  defaults <- calc_muestra_aulas_default_config()$selector$replacement_score_weights
  if (is.null(w) || !is.list(w) || is.null(names(w))) return(defaults)
  out <- defaults
  for (nm in names(w)) {
    if (!nzchar(nm)) next
    val <- suppressWarnings(as.numeric(unlist(w[[nm]], use.names = FALSE))[1])
    if (length(val) == 1L && is.finite(val)) out[[nm]] <- val
  }
  out
}

.cm_normalize_workspace_aulas_config <- function(cfg) {
  if (is.null(cfg) || !is.list(cfg)) return(list())
  selector_values <- c(
    "cube_balanceado",
    "local_pivotal_balanceado",
    "pool_controlado",
    "sistematico_pps",
    "estratificado_aleatorio",
    "manual_auditable",
    "pps_balanceado"
  )
  modalidad_values <- c("presencial_aula", "mixto_aula", "online_controlado")
  # Fuente única de los defaults de patrones de exclusión: el propio motor de
  # aulas (no se duplican literales aquí).
  filtros_default <- calc_muestra_aulas_default_config()$filters
  out <- list(
    schema = calc_str(cfg$schema, "calc_muestra_workspace_aulas_v1"),
    modalidad = calc_enum(cfg$modalidad, modalidad_values, "presencial_aula"),
    selector = calc_enum(cfg$selector, selector_values, "cube_balanceado"),
    selector_engine = calc_enum(cfg$selector_engine %||% cfg$selector, selector_values, "cube_balanceado"),
    method_family = calc_str(cfg$method_family, "balanced_probability"),
    min_elegibles_aula = calc_int(cfg$min_elegibles_aula, 15L, min = 1L, max = 10000L),
    accepted_conditions = .cm_normalize_chr_list(cfg$accepted_conditions %||% list("regular")),
    require_undergraduate = calc_bool(cfg$require_undergraduate, TRUE),
    require_adult = calc_bool(cfg$require_adult, TRUE),
    min_age = calc_int(cfg$min_age, 18L, min = 0L, max = 120L),
    require_in_person = calc_bool(cfg$require_in_person, TRUE),
    # Patrones de exclusión históricos (nivel/modalidad/sesión). H8b: al no
    # estar en esta whitelist, cada PUT/GET del estudio los BORRABA y el build
    # recibía los defaults del frontend (filtro de tipo de sesión apagado).
    # Mismo contrato que accepted_teacher_type_patterns: ausente -> default
    # del motor; una list() vacía explícita se respeta.
    exclude_level_patterns = if (is.null(cfg$exclude_level_patterns)) {
      filtros_default$exclude_level_patterns
    } else {
      .cm_normalize_chr_list(cfg$exclude_level_patterns)
    },
    exclude_modality_patterns = if (is.null(cfg$exclude_modality_patterns)) {
      filtros_default$exclude_modality_patterns
    } else {
      .cm_normalize_chr_list(cfg$exclude_modality_patterns)
    },
    exclude_session_patterns = if (is.null(cfg$exclude_session_patterns)) {
      filtros_default$exclude_session_patterns
    } else {
      .cm_normalize_chr_list(cfg$exclude_session_patterns)
    },
    # Criterios adicionales del marco de aulas (docente/nivel/sede/c7/c8).
    # Sin estas entradas el round-trip de guardado del proyecto BORRA los
    # campos (el workspace es whitelist-only, gotcha conocido del repo).
    require_stable_teacher = calc_bool(cfg$require_stable_teacher, FALSE),
    # El default aplica SOLO cuando el campo viene ausente (NULL): una list()
    # vacía explícita se respeta (el usuario limpió los patrones a propósito).
    accepted_teacher_type_patterns = if (is.null(cfg$accepted_teacher_type_patterns)) {
      .cm_criterios_default_filters()$accepted_teacher_type_patterns
    } else {
      .cm_normalize_chr_list(cfg$accepted_teacher_type_patterns)
    },
    # ADR 0035: orden de jerarquía de tipos de docente. Cataloga cada CH con su
    # docente de mayor rango (aula_frame$teacher_type_top) SIN afectar la
    # inclusión. Whitelist-only: sin esta entrada el round-trip del proyecto
    # BORRA el orden y se pierde al reabrir. Ausente/vacío -> list() (el motor
    # aplica su orden académico por defecto).
    teacher_type_orden = .cm_normalize_chr_list(cfg$teacher_type_orden),
    # H7: patrones aceptados de formación (criterio de pregrado sobre la
    # columna real de la base); mismo contrato ausente->default / list()
    # explícita respetada.
    accepted_formation_patterns = if (is.null(cfg$accepted_formation_patterns)) {
      .cm_criterios_default_filters()$accepted_formation_patterns
    } else {
      .cm_normalize_chr_list(cfg$accepted_formation_patterns)
    },
    # H9: excepciones de tipo de sesión por unidad académica (passthrough con
    # el normalizador de calc_muestra_aulas_criterios.R).
    session_type_excepciones = .cm_criterios_normalize_session_excepciones(cfg$session_type_excepciones),
    # Passthrough defensivo: solo lista nombrada con rangos válidos; el
    # normalizador vive en calc_muestra_aulas_criterios.R.
    nivel_por_unidad = .cm_criterios_normalize_nivel_por_unidad(cfg$nivel_por_unidad),
    accepted_campuses = .cm_normalize_chr_list(cfg$accepted_campuses),
    require_min_prevalence = calc_bool(cfg$require_min_prevalence, FALSE),
    min_prevalence_pct = calc_num(cfg$min_prevalence_pct, 0.8, min = 0, max = 1),
    # Criterio 8, parte de FACULTAD del curso (acuerdo metodológico
    # 2026-07-15). Whitelist-only: sin estas entradas el round-trip del
    # proyecto BORRA el gate y no sobrevive reapertura.
    require_faculty_prevalence = calc_bool(cfg$require_faculty_prevalence, FALSE),
    min_faculty_prevalence_pct = calc_num(cfg$min_faculty_prevalence_pct, 0.8, min = 0, max = 1),
    require_cycle_homogeneity = calc_bool(cfg$require_cycle_homogeneity, FALSE),
    min_cycle_homogeneity_pct = calc_num(cfg$min_cycle_homogeneity_pct, 0.8, min = 0, max = 1),
    # Suite de criterios por categoría (scope alumno + aula). Whitelist-only:
    # sin esta entrada el round-trip del proyecto BORRA la selección y la suite
    # no sobrevive reapertura. Passthrough por el normalizador de criterios;
    # ausente/ inválido degrada a list() (sentinela de "sin selección" ->
    # marco por path legacy, retro-compat).
    criterios_seleccion = .cm_criterios_normalize_seleccion(cfg$criterios_seleccion),
    usar_grupos_tamano = calc_bool(cfg$usar_grupos_tamano, TRUE),
    grupos_tamano = cfg$grupos_tamano %||% list(),
    estratos_selector = .cm_normalize_chr_list(cfg$estratos_selector %||% c("faculty", "sex_top_1", "size_group")),
    balance_vars = .cm_normalize_chr_list(cfg$balance_vars %||% c("faculty", "sex_top_1", "size_group", "program", "level")),
    spread_vars = .cm_normalize_chr_list(cfg$spread_vars %||% c("program", "level", "schedule", "size_group")),
    candidate_pool_size = calc_int(cfg$candidate_pool_size, 500L, min = 1L, max = 100000L),
    simulation_runs = calc_int(cfg$simulation_runs, 500L, min = 0L, max = 100000L),
    mos_strategy = calc_str(cfg$mos_strategy, "eligible_yield_winsorized"),
    coordination_mode = calc_str(cfg$coordination_mode, "permanent_random_number"),
    # W1: campos de reemplazos del DEFAULT_UNIVERSITY_AULAS_CONFIG (TS,
    # shared/constants.ts). Whitelist-only: sin estas entradas el round-trip
    # PUT→GET del estudio los BORRABA en silencio y la config de cadenas de
    # reemplazo no sobrevivia reapertura. Defaults desde el propio motor de
    # aulas (fuente unica, sin duplicar literales; TS y R coinciden).
    replacement_depth_strategy = calc_str(
      cfg$replacement_depth_strategy,
      calc_muestra_aulas_default_config()$selector$replacement_depth_strategy
    ),
    min_replacements_per_titular = calc_int(cfg$min_replacements_per_titular, 1L, min = 0L, max = 1000L),
    max_replacements_per_titular = calc_int(cfg$max_replacements_per_titular, 11L, min = 0L, max = 1000L),
    extra_pool_policy = calc_str(
      cfg$extra_pool_policy,
      calc_muestra_aulas_default_config()$selector$extra_pool_policy
    ),
    # Ausente -> default del motor; una list() vacia explicita se respeta
    # (mismo contrato que los patrones de exclusion).
    replacement_equivalence_vars = if (is.null(cfg$replacement_equivalence_vars)) {
      calc_muestra_aulas_default_config()$selector$replacement_equivalence_vars
    } else {
      .cm_normalize_chr_list(cfg$replacement_equivalence_vars)
    },
    replacement_score_weights = .cm_normalize_workspace_score_weights(cfg$replacement_score_weights),
    bolsas_reemplazo = calc_int(cfg$bolsas_reemplazo, 11L, min = 0L, max = 1000L),
    aulas_extra_operativas_default = calc_int(cfg$aulas_extra_operativas_default, 1L, min = 0L, max = 1000L),
    penalizacion_repetidos = calc_num(cfg$penalizacion_repetidos, 1.35, min = 0, max = 100),
    # Descuento secuencial de repetidos entre aulas del estrato (asesoría
    # muestral 2026-07-15 §10). Whitelist-only: sin esta entrada el
    # round-trip PUT→GET del estudio BORRA el flag. Ausente adopta el default
    # del engine; un FALSE explícito se conserva para históricos reproducibles.
    sequential_discount = calc_bool(
      cfg$sequential_discount,
      calc_muestra_aulas_default_config()$selector$sequential_discount
    ),
    pps_weight = calc_num(cfg$pps_weight, 0.25, min = 0, max = 100),
    coverage_weight = calc_num(cfg$coverage_weight, 1, min = 0, max = 100),
    monte_carlo_n = calc_int(cfg$monte_carlo_n, 500L, min = 0L, max = 100000L),
    semilla = calc_int(cfg$semilla, 20260619L, min = 0L, max = .Machine$integer.max),
    objective = cfg$objective %||% list(),
    # Particularidades del marco (asesoría muestral 2026-07-15 §12): mapa de
    # decisiones manuales por curso-horario (incluir/excluir/revisado + nota).
    # Whitelist-only: sin esta entrada el round-trip PUT→GET del estudio BORRA
    # las decisiones al guardar/reabrir el proyecto. Normalizador defensivo en
    # calc_muestra_aulas_particularidades.R.
    particularidades_decisiones = .cm_particularidades_normalize_decisiones(
      cfg$particularidades_decisiones
    ),
    notas_metodologicas = calc_str(cfg$notas_metodologicas, "")
  )
  n_aulas <- calc_int(
    cfg$n_aulas %||% cfg$aulas_titulares,
    NA_integer_,
    min = 1L,
    max = .Machine$integer.max
  )
  if (!is.na(n_aulas)) out$n_aulas <- n_aulas
  out
}

.cm_normalize_workspace_variables <- function(vars) {
  if (is.null(vars) || !is.list(vars) || length(vars) == 0L) return(list())
  tipos <- c("estrato", "cuota", "filtro", "segmento", "otro")
  out <- lapply(vars, function(v) {
    if (!is.list(v)) return(NULL)
    label <- calc_str(v$label, "")
    if (!nzchar(label)) return(NULL)
    list(
      id = calc_str(v$id, .cm_random_id()),
      label = label,
      tipo = calc_enum(v$tipo, tipos, "otro"),
      disponible = calc_bool(v$disponible, TRUE),
      notas = calc_str(v$notas, "")
    )
  })
  Filter(Negate(is.null), out)
}

.cm_normalize_workspace_escenarios <- function(escenarios) {
  if (is.null(escenarios) || !is.list(escenarios) || length(escenarios) == 0L) {
    return(list())
  }
  productos <- c(
    "muestra_probabilistica",
    "cobertura_marco",
    "matriz_cuotas",
    "componentes_mixtos"
  )
  out <- lapply(escenarios, function(e) {
    if (!is.list(e)) return(NULL)
    label <- calc_str(e$label, "")
    if (!nzchar(label)) return(NULL)
    list(
      id = calc_str(e$id, .cm_random_id()),
      label = label,
      descripcion = calc_str(e$descripcion, ""),
      activo = calc_bool(e$activo, FALSE),
      tecnica = calc_enum(e$tecnica, .CM_TECNICAS_TODAS, "prob_aleatorio_simple"),
      producto = calc_enum(e$producto, productos, "muestra_probabilistica"),
      component_id = calc_str(e$component_id, ""),
      incluir_reporte = calc_bool(e$incluir_reporte, FALSE),
      redondeo_multiplo = calc_int(e$redondeo_multiplo, 0L, min = 0L),
      parametros = if (is.list(e$parametros)) e$parametros else list()
    )
  })
  Filter(Negate(is.null), out)
}

.cm_normalize_componentes <- function(comps) {
  if (is.null(comps) || !is.list(comps) || length(comps) == 0L) {
    return(list())
  }
  lapply(comps, calc_muestra_normalize_componente)
}

#' Normaliza un Componente.
calc_muestra_normalize_componente <- function(comp = list()) {
  if (is.null(comp) || !is.list(comp)) comp <- list()
  tecnica <- calc_enum(comp$tecnica, .CM_TECNICAS_TODAS, "intencion_censal")

  # actor_categoria + canal_recojo permiten al motor inferir técnica y
  # mínimo a cumplir automáticamente para acreditaciones (cuadro maestro
  # PULSO PUCP Marzo 2026). Si están definidos, sobrescriben la técnica.
  actor_categoria <- calc_enum(comp$actor_categoria, .CM_ACTOR_CATEGORIAS, "otros")
  canal_recojo <- calc_enum(comp$canal_recojo, .CM_CANAL_RECOJO, "sin_definir")
  marco_normalizado <- .cm_normalize_marco(comp$marco)

  # Si el componente es de acreditación (tiene actor_categoria definido distinto
  # de "otros" y canal definido), inferimos técnica + parámetros canónicos
  # del cuadro maestro PULSO Marzo 2026.
  inferencia <- list(tecnica = NULL, regla = "manual",
                     justificacion = "Configuración manual sin inferencia.")
  parametros_in <- comp$parametros
  meta_in <- comp$meta
  N <- marco_normalizado$marco_validado
  if (actor_categoria != "otros" && canal_recojo != "sin_definir" && N > 0L) {
    inferencia <- .cm_inferir_acreditacion(actor_categoria, canal_recojo, N)
    if (!is.null(inferencia$tecnica)) {
      tecnica <- inferencia$tecnica
      # La inferencia provee DEFAULTS canónicos; el preset/usuario puede
      # divergir. Solo aplicar la inferencia cuando el preset no especificó
      # el campo. Usamos `fill_default` que agrega solo si está ausente.
      # fill_default: usa el valor del cuadro maestro cuando el preset/usuario
      # NO especificó el campo. Para campos numéricos, 0 cuenta como "no
      # especificado" (el usuario no llenó N ni meta).
      fill_default <- function(lst, key, value) {
        lst <- lst %||% list()
        cur <- lst[[key]]
        if (is.null(cur)) { lst[[key]] <- value; return(lst) }
        if (is.numeric(value) && is.numeric(cur) && cur == 0) {
          lst[[key]] <- value
        } else if (key %in% names(.CM_DEFAULTS_PARAMS) &&
                   is.numeric(value) && is.numeric(cur) &&
                   identical(as.numeric(cur), as.numeric(.CM_DEFAULTS_PARAMS[[key]]))) {
          lst[[key]] <- value
        }
        lst
      }
      if (!is.null(inferencia$minimo_cobertura)) {
        parametros_in <- fill_default(parametros_in, "cobertura_objetivo", inferencia$minimo_cobertura)
      }
      if (!is.null(inferencia$piso_n_minimo)) {
        parametros_in <- fill_default(parametros_in, "n_minimo_estrato", inferencia$piso_n_minimo)
      }
      if (!is.null(inferencia$tope_operativo)) {
        parametros_in <- fill_default(parametros_in, "tope_operativo", inferencia$tope_operativo)
      }
      if (!is.null(inferencia$minimo_cuota)) {
        meta_in <- fill_default(meta_in, "valor", inferencia$minimo_cuota)
        meta_in <- fill_default(meta_in, "variable_control", inferencia$variable_control %||% "")
      }
      if (!is.null(inferencia$minimo_n)) {
        meta_in <- fill_default(meta_in, "valor", inferencia$minimo_n)
      }
      # Parámetros canónicos para estudiantes ≥3001: aplicar como defaults
      if (!is.null(inferencia$params_canonicos)) {
        for (key in names(inferencia$params_canonicos)) {
          parametros_in <- fill_default(parametros_in, key, inferencia$params_canonicos[[key]])
        }
      }
    }
  }

  list(
    id                = calc_str(comp$id, .cm_random_id()),
    actor             = calc_str(comp$actor, "Componente"),
    actor_id          = calc_str(comp$actor_id, ""),
    actor_categoria   = actor_categoria,
    canal_recojo      = canal_recojo,
    tecnica           = tecnica,
    naturaleza        = .CM_NATURALEZAS_POR_TECNICA[[tecnica]],
    origen_tamano     = calc_enum(comp$origen_tamano, .CM_ORIGENES_TAMANO,
                                  .cm_origen_default_para(tecnica)),
    nivel_respaldo    = calc_enum(comp$nivel_respaldo, .CM_NIVELES_RESPALDO,
                                  .cm_respaldo_default_para(tecnica)),
    marco             = marco_normalizado,
    parametros        = .cm_normalize_parametros(parametros_in, tecnica),
    meta              = .cm_normalize_meta(meta_in),
    inferencia_acreditacion = inferencia,
    resultado         = comp$resultado   # opaco, lo escribe calcular()
  )
}

# ---------------------------------------------------------------------------
# Cuadro maestro de inferencia para acreditaciones PUCP (compendio §4.1)
# ---------------------------------------------------------------------------

#' Infiere técnica y mínimo a cumplir según actor × canal × N.
#'
#' Aplica el cuadro maestro canónico de PULSO PUCP Marzo 2026. Devuelve
#' lista con técnica recomendada, mínimo, regla aplicada y justificación.
#' El usuario NO elige técnica directamente: la elige indirectamente al
#' declarar actor + canal + N.
.cm_inferir_acreditacion <- function(actor, canal, N) {
  if (actor == "administrativos") {
    return(list(
      tecnica = "intencion_censal",
      minimo_cobertura = 0.80,
      regla = "intencion_censal_80",
      justificacion = "Administrativos: intención censal con cobertura mínima 80% (alta disponibilidad y respuesta)."
    ))
  }
  if (actor == "docentes") {
    if (N <= 250L) {
      return(list(
        tecnica = "intencion_censal",
        minimo_cobertura = 0.60,
        regla = "intencion_censal_60_si_N_<=_250",
        justificacion = "Docentes con N ≤ 250: intención censal con cobertura mínima 60%."
      ))
    }
    return(list(
      tecnica = "no_prob_cuotas",
      minimo_cuota = 150L,
      variable_control = "dedicacion_docente",
      regla = "cuotas_min_150_si_N_>=_251",
      justificacion = "Docentes con N ≥ 251: cuotas no aleatorias, mínimo 150 con control por dedicación docente."
    ))
  }
  if (actor == "estudiantes") {
    if (canal == "aula_qr" && N >= 3001L) {
      # Parámetros canónicos PUCP para estudiantes en aulas:
      # z=1.96, p=0.5, e=2.5%, deff=2.0, sobremuestra 50%
      return(list(
        tecnica = "prob_conglomerado_multietapico",
        params_canonicos = list(z = 1.96, p = 0.5, e = 0.025, deff = 2.0,
                                oversample_pct = 0.50, tasa_respuesta = 0.70,
                                promedio_conglomerado = 25, tau = 0.50),
        aulas_referencia = 72L,
        regla = "conglomerados_z195_p050_e25_deff20_si_aula_y_N_>=_3001",
        justificacion = "Estudiantes con N ≥ 3001 y marco de cursos-horario: conglomerados multietápico con parámetros canónicos PUCP (95% confianza, ±2.5%, deff=2, p=0.5, sobremuestra 50%). Referencia operativa: 72 aulas × 25 estudiantes ≈ 1800 encuestas base."
      ))
    }
    return(list(
      tecnica = "intencion_censal",
      minimo_cobertura = 0.60,
      regla = "intencion_censal_60_si_N_<=_3000",
      justificacion = "Estudiantes con N ≤ 3000 (o sin marco de cursos-horario): intención censal con cobertura mínima 60%."
    ))
  }
  if (actor == "egresados") {
    if (N <= 300L) {
      return(list(
        tecnica = "intencion_censal",
        minimo_cobertura = 0.50,
        regla = "intencion_censal_50_si_N_<=_300",
        justificacion = "Egresados con N ≤ 300: intención censal con cobertura mínima 50%."
      ))
    }
    # Para N ≥ 301: regla canónica clamp(N×50%, 30, 150).
    # Si hay estratos por carrera, se aplica por carrera (sumar cuotas).
    # Si no hay estratos, se aplica al N total como meta directa.
    cuota_directa <- max(min(as.integer(ceiling(N * 0.50)), 150L), 30L)
    if (cuota_directa > N) cuota_directa <- as.integer(N)
    return(list(
      tecnica = "no_prob_conveniencia",
      minimo_cobertura = 0.50,
      piso_n_minimo = 30L,
      tope_operativo = 150L,
      minimo_n = cuota_directa,  # se usa como meta.valor cuando no hay estratos
      regla = "clamp_50pct_30_150_si_N_>=_301",
      justificacion = "Egresados con N ≥ 301: conveniencia con regla canónica clamp(N×50%, 30, 150). Si hay estratos por carrera, aplica por carrera y suma. Si no hay estratos, aplica al N total."
    ))
  }
  # Actores cualitativos o sin clasificación: no inferir.
  list(tecnica = NULL, regla = "sin_inferencia",
       justificacion = "Actor cualitativo o sin clasificación canónica.")
}

.cm_origen_default_para <- function(tecnica) {
  switch(tecnica,
    prob_conglomerado_multietapico = "formula",
    prob_aleatorio_simple          = "formula",
    prob_estratificado             = "formula",
    sistematico                    = "formula",
    medicion_recurrente            = "formula",
    intencion_censal               = "cobertura_esperada",
    barrido                        = "cobertura_esperada",
    listado_externo_meta_fija      = "meta_contractual",
    no_prob_cuotas                 = "matriz_perfiles_cualitativa",
    no_prob_conveniencia           = "matriz_perfiles_cualitativa",
    "cobertura_esperada"
  )
}

.cm_respaldo_default_para <- function(tecnica) {
  switch(tecnica,
    prob_conglomerado_multietapico = "representatividad_estadistica",
    prob_aleatorio_simple          = "representatividad_estadistica",
    prob_estratificado             = "representatividad_estadistica",
    sistematico                    = "representatividad_estadistica",
    medicion_recurrente            = "representatividad_estadistica",
    intencion_censal               = "representatividad_operacional",
    barrido                        = "representatividad_operacional",
    listado_externo_meta_fija      = "cobertura_balanceada",
    no_prob_cuotas                 = "representatividad_teorica_controlada",
    no_prob_conveniencia           = "evidencia_descriptiva",
    "evidencia_descriptiva"
  )
}

.cm_normalize_marco <- function(marco) {
  if (is.null(marco) || !is.list(marco)) marco <- list()
  universo_bruto    <- calc_int(marco$universo_bruto,    0L, min = 0L)
  marco_validado    <- calc_int(marco$marco_validado,    0L, min = 0L)
  marco_contactable <- calc_int(marco$marco_contactable, 0L, min = 0L)
  estratos          <- .cm_normalize_estratos(marco$estratos)
  matriz_operativa  <- .cm_normalize_matriz_operativa(marco$matriz_operativa)

  # Si hay estratos, derivar el marco_validado de la suma de estratos cuando
  # no se haya provisto explícitamente. Esto evita que el usuario tenga que
  # mantener dos números sincronizados a mano.
  if (length(estratos) > 0L && marco_validado == 0L) {
    marco_validado <- sum(vapply(estratos, function(e) e$N, integer(1)))
    if (universo_bruto == 0L) universo_bruto <- marco_validado
    if (marco_contactable == 0L) marco_contactable <- marco_validado
  }
  if (length(matriz_operativa) > 0L && marco_validado == 0L) {
    marco_validado <- sum(vapply(matriz_operativa, function(e) e$N, integer(1)))
    if (universo_bruto == 0L) universo_bruto <- marco_validado
    if (marco_contactable == 0L) marco_contactable <- marco_validado
  }

  list(
    universo_bruto    = universo_bruto,
    marco_validado    = marco_validado,
    marco_contactable = marco_contactable,
    estado            = calc_enum(marco$estado, .CM_ESTADOS_MARCO, "no_definido"),
    notas             = calc_str(marco$notas, ""),
    estratos          = estratos,
    matriz_operativa  = matriz_operativa
  )
}

#' Normaliza la lista de estratos del marco (opcional).
#'
#' Cada estrato representa un sub-grupo del universo (típicamente una
#' facultad para HSVG/acreditación, o un distrito para territorial).
#' Soporta sub-estratos por sexo (N_a/N_b con labels libres) y parámetros
#' estadísticos/operativos por estrato: e_facultad, p_facultad,
#' promedio_conglomerado y tau.
#'
#' @param estratos Lista (de listas) recibida del frontend o NULL.
#' @return Lista normalizada de estratos validados (puede ser vacía).
.cm_normalize_estratos <- function(estratos) {
  if (is.null(estratos) || !is.list(estratos) || length(estratos) == 0L) {
    return(list())
  }
  out <- lapply(estratos, function(e) {
    if (!is.list(e)) return(NULL)
    label <- calc_str(e$label, "")
    if (!nzchar(label)) return(NULL)
    N <- calc_int(e$N, 0L, min = 0L)
    if (N <= 0L) return(NULL)
    N_a <- calc_int(e$N_a, 0L, min = 0L)
    N_b <- calc_int(e$N_b, 0L, min = 0L)
    # Si los sub-estratos suman 0, asumir 50/50 sobre N.
    if (N_a + N_b == 0L) {
      N_a <- N %/% 2L
      N_b <- N - N_a
    }
    list(
      id                    = calc_str(e$id, .cm_random_id()),
      label                 = label,
      N                     = N,
      N_a                   = N_a,
      N_b                   = N_b,
      sub_a_label           = calc_str(e$sub_a_label, "Sub-estrato A"),
      sub_b_label           = calc_str(e$sub_b_label, "Sub-estrato B"),
      e_facultad            = calc_num(e$e_facultad, 0.05, min = 0.001, max = 0.99),
      p_facultad            = calc_num(e$p_facultad, NA_real_, min = 0, max = 1),
      confianza_facultad    = calc_num(e$confianza_facultad, NA_real_, min = 0.5, max = 0.999),
      z_facultad            = calc_num(e$z_facultad, NA_real_, min = 0.5, max = 5),
      cuota_fija            = calc_int(e$cuota_fija, 0L, min = 0L),
      sobremuestra_fija     = calc_int(e$sobremuestra_fija, 0L, min = 0L),
      aulas_base_fijas      = calc_int(e$aulas_base_fijas, 0L, min = 0L),
      aulas_extra_operativas = calc_int(e$aulas_extra_operativas, 0L, min = 0L),
      promedio_conglomerado = calc_num(e$promedio_conglomerado, 0, min = 0, max = 1000),
      # Mediana del tamaño de conglomerado del estrato (opcional, la aporta el
      # perfil del marco de aulas: est_aula_mediana por facultad). Solo se usa
      # cuando parametros$estadistico_conglomerado la pide; 0 = ausente.
      mediana_conglomerado  = calc_num(e$mediana_conglomerado, 0, min = 0, max = 1000),
      tau                   = calc_num(e$tau, 0, min = 0, max = 1)
    )
  })
  Filter(Negate(is.null), out)
}

#' Normaliza una matriz operativa territorio x servicio.
#'
#' Cada fila representa el volumen de marco usado para dimensionar una línea
#' de base ocasional, por ejemplo atenciones mensuales por municipalidad y
#' servicio. El cálculo de muestra puede estimar n por territorio y distribuir
#' cuotas por servicio con piso mínimo.
.cm_normalize_matriz_operativa <- function(matriz) {
  if (is.null(matriz) || !is.list(matriz) || length(matriz) == 0L) {
    return(list())
  }
  out <- lapply(matriz, function(e) {
    if (!is.list(e)) return(NULL)
    territorio <- calc_str(e$territorio, "")
    servicio <- calc_str(e$servicio, "")
    if (!nzchar(territorio) || !nzchar(servicio)) return(NULL)
    N <- calc_int(e$N %||% e$volumen, 0L, min = 0L)
    if (N <= 0L) return(NULL)
    list(
      id         = calc_str(e$id, .cm_random_id()),
      territorio = territorio,
      servicio   = servicio,
      N          = N,
      notas      = calc_str(e$notas, "")
    )
  })
  Filter(Negate(is.null), out)
}

.cm_normalize_parametros <- function(par, tecnica) {
  if (is.null(par) || !is.list(par)) par <- list()
  list(
    z                 = calc_num(par$z, .CM_DEFAULTS_PARAMS$z, min = 0.5, max = 5),
    p                 = calc_num(par$p, .CM_DEFAULTS_PARAMS$p, min = 0, max = 1),
    e                 = calc_num(par$e, .CM_DEFAULTS_PARAMS$e, min = 0.001, max = 0.5),
    deff              = calc_num(par$deff, .CM_DEFAULTS_PARAMS$deff, min = 1, max = 10),
    tau               = calc_num(par$tau, .CM_DEFAULTS_PARAMS$tau, min = 0, max = 1),
    oversample_pct    = calc_num(par$oversample_pct, .CM_DEFAULTS_PARAMS$oversample_pct,
                                 min = 0, max = 2),
    tasa_contacto     = calc_num(par$tasa_contacto, .CM_DEFAULTS_PARAMS$tasa_contacto,
                                 min = 0.01, max = 1),
    tasa_elegibilidad = calc_num(par$tasa_elegibilidad, .CM_DEFAULTS_PARAMS$tasa_elegibilidad,
                                 min = 0.01, max = 1),
    tasa_respuesta    = calc_num(par$tasa_respuesta, .CM_DEFAULTS_PARAMS$tasa_respuesta,
                                 min = 0.01, max = 1),
    cobertura_objetivo = calc_num(par$cobertura_objetivo, .CM_DEFAULTS_PARAMS$cobertura_objetivo,
                                  min = 0.01, max = 1),
    promedio_conglomerado = calc_num(par$promedio_conglomerado, 25, min = 1, max = 1000),
    # Estadístico del tamaño de conglomerado para las cuotas por estrato.
    # Default "media" = comportamiento histórico bit a bit (back-compat);
    # "mediana"/"min_media_mediana" usan la mediana_conglomerado del estrato
    # cuando el marco/perfil la aportó (declarativo si no hay mediana).
    estadistico_conglomerado = calc_enum(par$estadistico_conglomerado,
                                         c("media", "mediana", "min_media_mediana"), "media"),
    n_minimo_estrato  = calc_int(par$n_minimo_estrato, .CM_DEFAULTS_PARAMS$n_minimo_estrato,
                                 min = 0L, max = 10000L),
    tope_operativo    = calc_int(par$tope_operativo, .CM_DEFAULTS_PARAMS$tope_operativo,
                                 min = 0L, max = 100000L)
  )
}

.cm_normalize_meta <- function(meta) {
  if (is.null(meta) || !is.list(meta)) meta <- list()
  tipo_opts <- c("objetivo", "cuota", "cobertura", "contractual")
  list(
    tipo              = calc_enum(meta$tipo, tipo_opts, "objetivo"),
    valor             = calc_int(meta$valor, 0L, min = 0L),
    variable_control  = calc_str(meta$variable_control, ""),
    sub_cuotas        = if (is.list(meta$sub_cuotas)) meta$sub_cuotas else list()
  )
}

.cm_random_id <- function() {
  paste0("cmp-",
         paste(sample(c(0:9, letters), 8, replace = TRUE), collapse = ""))
}

# ---------------------------------------------------------------------------
# Validador de inferencia permitida (compendio §18.3)
# ---------------------------------------------------------------------------

#' Verifica si un componente puede reportar margen de error formalmente.
#'
#' Retorna lista con `permitido` (bool) y `motivos` (chr) si no permitido.
#' Bloquea cuando: no es técnica probabilística, falta marco completo,
#' falta probabilidad conocida documentada, conglomerados sin UPM/deff.
calc_muestra_validar_inferencia <- function(comp) {
  permite_por_tecnica <- isTRUE(.CM_PERMITE_MARGEN_POR_TECNICA[[comp$tecnica]])
  if (!permite_por_tecnica) {
    return(list(
      permitido = FALSE,
      motivos = sprintf(
        "La técnica '%s' no admite margen de error formal (naturaleza: %s).",
        comp$tecnica, comp$naturaleza
      )
    ))
  }
  motivos <- character()
  if (isTRUE(comp$marco$marco_validado <= 0L)) {
    motivos <- c(motivos, "Falta marco validado (cantidad de unidades elegibles).")
  }
  if (identical(comp$marco$estado, "no_definido") ||
      identical(comp$marco$estado, "operativo")) {
    motivos <- c(motivos, "El estado del marco debe ser 'validado' o superior.")
  }
  if (identical(comp$tecnica, "prob_conglomerado_multietapico")) {
    if (comp$parametros$deff < 1) {
      motivos <- c(motivos, "deff debe ser >= 1 para conglomerados.")
    }
    if (comp$parametros$tau <= 0 || comp$parametros$tau > 1) {
      motivos <- c(motivos, "Tasa de rendimiento τ debe estar en (0, 1].")
    }
  }
  list(
    permitido = length(motivos) == 0L,
    motivos = if (length(motivos) == 0L) NULL else paste(motivos, collapse = " ")
  )
}

# ---------------------------------------------------------------------------
# Cálculo por metodología (Fase 1: 4 técnicas)
# ---------------------------------------------------------------------------

#' Calcula el resultado de un componente según su técnica.
#'
#' Despacha a la función específica de la metodología. Retorna lista con
#' el bundle de resultados serializables.
calc_muestra_calcular_componente <- function(comp) {
  comp <- calc_muestra_normalize_componente(comp)

  if (!comp$tecnica %in% .CM_TECNICAS_FASE_1) {
    stop_api(501, "E_METODOLOGIA_NO_IMPLEMENTADA",
             sprintf("La técnica '%s' todavía no está implementada en el calculador.",
                     comp$tecnica))
  }

  inferencia <- calc_muestra_validar_inferencia(comp)

  resultado <- switch(comp$tecnica,
    prob_aleatorio_simple          = .cm_calc_mas(comp, inferencia),
    prob_estratificado             = .cm_calc_estratificado(comp, inferencia),
    prob_estratificado_independiente = .cm_calc_estratificado_independiente(comp, inferencia),
    prob_conglomerado_multietapico = .cm_calc_conglomerado(comp, inferencia),
    sistematico                    = .cm_calc_sistematico(comp, inferencia),
    intencion_censal               = .cm_calc_intencion_censal(comp),
    barrido                        = .cm_calc_barrido(comp),
    no_prob_cuotas                 = .cm_calc_cuotas(comp),
    no_prob_conveniencia           = .cm_calc_conveniencia(comp),
    listado_externo_meta_fija      = .cm_calc_listado_externo(comp)
  )

  resultado$inferencia <- inferencia
  resultado$computado_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  resultado$tecnica <- comp$tecnica
  resultado
}

# Estadístico efectivo del tamaño de conglomerado de UN estrato, según
# parametros$estadistico_conglomerado. Decisión (mínimo cambio coherente):
# el campo es DECLARATIVO cuando el estrato solo trae el promedio manual —
# "mediana"/"min_media_mediana" operan únicamente si el estrato aporta
# mediana_conglomerado (> 0, típicamente copiada del perfil del marco:
# est_aula_mediana por facultad); sin mediana degradan DECLARADAMENTE a la
# media. `usado` audita esa degradación por estrato en la salida de cuotas.
.cm_estadistico_conglomerado_estrato <- function(e, par) {
  media <- if ((e$promedio_conglomerado %||% 0) > 0) e$promedio_conglomerado else par$promedio_conglomerado
  mediana <- calc_num(e$mediana_conglomerado, 0, min = 0, max = 1000)
  modo <- calc_enum(par$estadistico_conglomerado, c("media", "mediana", "min_media_mediana"), "media")
  if (identical(modo, "mediana") && mediana > 0) {
    return(list(valor = mediana, usado = "mediana"))
  }
  if (identical(modo, "min_media_mediana") && mediana > 0) {
    return(list(valor = min(media, mediana), usado = "min_media_mediana"))
  }
  list(valor = media, usado = "media")
}

.cm_z_estrato <- function(e, z_default) {
  if (!is.null(e$z_facultad) && !is.na(e$z_facultad) && e$z_facultad > 0) {
    return(e$z_facultad)
  }
  if (!is.null(e$confianza_facultad) && !is.na(e$confianza_facultad) &&
      e$confianza_facultad > 0 && e$confianza_facultad < 1) {
    return(stats::qnorm(1 - (1 - e$confianza_facultad) / 2))
  }
  z_default
}

#' Calcula resultado para conglomerados multietápico.
#'
#' Si el marco tiene `estratos` definidos, además del n total devuelve:
#'   - `distribucion_estratos`: cuota por estrato (proporcional al N)
#'   - `distribucion_sub`: cuota por sub-estrato (sexo) dentro de cada estrato
#'   - `aulas_por_estrato`: unidades operativas necesarias por estrato
.cm_calc_conglomerado <- function(comp, inferencia) {
  N <- comp$marco$marco_validado
  par <- comp$parametros
  estratos <- comp$marco$estratos %||% list()
  tiene_estratos <- length(estratos) > 0L

  if (!inferencia$permitido) {
    n_teorico <- if (N > 0L) {
      calc_n_muestra(N = N, p = par$p, z = par$z, e = par$e, deff = par$deff)
    } else NA_integer_
    return(list(
      n_teorico              = n_teorico,
      n_objetivo             = n_teorico,
      n_operativo            = n_teorico,
      unidades_operativas    = NA_integer_,
      precision_alcanzada    = NA_real_,
      sobremuestra           = 0L,
      origen_tamano          = comp$origen_tamano,
      advertencia            = paste("Resultado calculado sin habilitar margen de error formal.",
                                     inferencia$motivos)
    ))
  }

  n_bruto    <- calc_n_muestra(N = N, p = par$p, z = par$z, e = par$e, deff = 1)
  n_teorico  <- calc_n_muestra(N = N, p = par$p, z = par$z, e = par$e, deff = par$deff)
  n_objetivo <- .cm_aplicar_ajuste_objetivo(n_teorico, comp)
  n_operativo <- as.integer(n_objetivo)
  sobremuestra <- as.integer(ceiling(n_operativo * par$oversample_pct))

  unidades_operativas_global <- as.integer(ceiling(
    n_objetivo / (max(par$promedio_conglomerado, 1) * max(par$tau, 0.01))
  ))

  precision_alcanzada <- calc_e_desde_n_muestra(
    n = n_objetivo, N = N, p = par$p, z = par$z, deff = par$deff
  )

  base_result <- list(
    n_bruto                = as.integer(n_bruto),
    n_teorico              = as.integer(n_teorico),
    n_objetivo             = as.integer(n_objetivo),
    n_operativo            = as.integer(n_operativo + sobremuestra),
    unidades_operativas    = unidades_operativas_global,
    precision_alcanzada    = precision_alcanzada,
    sobremuestra           = sobremuestra,
    origen_tamano          = comp$origen_tamano
  )

  if (!tiene_estratos) {
    return(base_result)
  }

  # --- Distribución estratificada ---------------------------------------
  # 1. Distribuir n_objetivo proporcional al N de cada estrato (con cuadratura).
  cuotas_fijas <- vapply(estratos, function(e) e$cuota_fija %||% 0L, integer(1))
  tiene_cuotas_fijas <- all(cuotas_fijas > 0L)
  pesos <- vapply(estratos, function(e) e$N, integer(1))
  labels <- vapply(estratos, function(e) e$label, character(1))
  cuotas_estrato <- if (tiene_cuotas_fijas) {
    cuotas_fijas
  } else {
    distribuir_proporcional_pesos(
      n_total = n_objetivo, pesos = pesos, redondeo = "cuadratura"
    )
  }
  if (sum(cuotas_estrato) != n_objetivo) {
    idx_max <- which.max(pesos)
    cuotas_estrato[idx_max] <- as.integer(max(0L, cuotas_estrato[idx_max] + n_objetivo - sum(cuotas_estrato)))
  }
  sobremuestras_fijas <- vapply(estratos, function(e) e$sobremuestra_fija %||% 0L, integer(1))
  if (all(sobremuestras_fijas > 0L)) {
    base_result$sobremuestra <- as.integer(sum(sobremuestras_fijas) - n_objetivo)
    base_result$n_operativo <- as.integer(sum(sobremuestras_fijas))
  }

  # 2. Sub-distribuir cada cuota por sub-estrato (sexo), proporcional a N_a/N_b.
  distribucion_sub <- vector("list", 0L)
  for (i in seq_along(estratos)) {
    e <- estratos[[i]]
    cuota <- cuotas_estrato[i]
    pesos_sub <- c(e$N_a, e$N_b)
    asignacion <- distribuir_proporcional_pesos(
      n_total = cuota, pesos = pesos_sub, redondeo = "cuadratura"
    )
    distribucion_sub[[length(distribucion_sub) + 1L]] <- list(
      estrato = e$label, sub = e$sub_a_label, N = e$N_a, n = as.integer(asignacion[1])
    )
    distribucion_sub[[length(distribucion_sub) + 1L]] <- list(
      estrato = e$label, sub = e$sub_b_label, N = e$N_b, n = as.integer(asignacion[2])
    )
  }

  # 3. Calcular aulas por estrato (avg_aula y tau locales si están, sino global).
  aulas_por_estrato <- vector("list", length(estratos))
  for (i in seq_along(estratos)) {
    e <- estratos[[i]]
    cuota <- cuotas_estrato[i]
    est_e <- .cm_estadistico_conglomerado_estrato(e, par)
    avg_e <- est_e$valor
    tau_e <- if (e$tau > 0) e$tau else par$tau
    aulas_base <- if ((e$aulas_base_fijas %||% 0L) > 0L) {
      as.integer(e$aulas_base_fijas)
    } else {
      as.integer(ceiling(cuota / (max(avg_e, 1) * max(tau_e, 0.01))))
    }
    aulas_reemplazo <- if ((e$aulas_extra_operativas %||% 0L) > 0L) {
      as.integer(e$aulas_extra_operativas)
    } else {
      as.integer(ceiling(aulas_base * par$oversample_pct))
    }
    aulas_total <- aulas_base + aulas_reemplazo
    precision_e <- calc_e_desde_n_muestra(
      n = cuota, N = e$N, p = par$p, z = par$z, deff = par$deff
    )
    tipo_aula <- .cm_clasificar_tipo_aula(avg_e, e$label)
    aulas_por_estrato[[i]] <- list(
      estrato         = e$label,
      N               = e$N,
      cuota           = as.integer(cuota),
      avg_conglomerado = avg_e,
      estadistico_usado = est_e$usado,
      tau             = tau_e,
      aulas_base      = aulas_base,
      aulas_reemplazo = aulas_reemplazo,
      aulas_extra_operativas = aulas_reemplazo,
      aulas_total     = aulas_total,
      tipo_aula       = tipo_aula,
      precision_e     = precision_e
    )
  }

  # 4. Distribución plana por estrato (sin desagregación de sub).
  distribucion_estratos <- lapply(seq_along(estratos), function(i) {
    e <- estratos[[i]]
    list(
      estrato     = e$label,
      N           = e$N,
      n           = as.integer(cuotas_estrato[i]),
      precision_e = calc_e_desde_n_muestra(
        n = cuotas_estrato[i], N = e$N, p = par$p, z = par$z, deff = par$deff
      )
    )
  })

  c(base_result, list(
    distribucion_estratos = distribucion_estratos,
    distribucion_sub      = distribucion_sub,
    aulas_por_estrato     = aulas_por_estrato,
    aulas_total           = as.integer(sum(vapply(aulas_por_estrato, function(a) a$aulas_total, integer(1)))),
    aulas_base_total      = as.integer(sum(vapply(aulas_por_estrato, function(a) a$aulas_base, integer(1)))),
    aulas_extra_total     = as.integer(sum(vapply(aulas_por_estrato, function(a) a$aulas_reemplazo, integer(1)))),
    # Metadato declarado de las cuotas: qué estadístico pidió el usuario (el
    # efectivo por estrato viaja en aulas_por_estrato$estadistico_usado).
    estadistico_conglomerado = par$estadistico_conglomerado
  ))
}

# Clasifica el tipo de aula según el promedio histórico.
# Replica los cortes operativos del compendio PUCP 2025-2026.
.cm_clasificar_tipo_aula <- function(avg, label = NULL) {
  if (!is.null(label) && grepl("estudios.generales.letras", tolower(label))) {
    return("EEGGL (masiva)")
  }
  if (is.na(avg) || avg <= 0) return("Sin dato")
  if (avg >= 40) return("G4 (40+)")
  if (avg >= 30) return("G3 (30-39)")
  if (avg >= 20) return("G2 (20-29)")
  "G1 (<20)"
}

#' Calcula resultado para intención censal.
.cm_calc_intencion_censal <- function(comp) {
  N <- if (comp$marco$marco_contactable > 0L) comp$marco$marco_contactable
       else comp$marco$marco_validado
  par <- comp$parametros
  cobertura_obj <- par$cobertura_objetivo
  if (cobertura_obj <= 0) cobertura_obj <- 0.6

  n_objetivo <- as.integer(ceiling(N * cobertura_obj))
  n_operativo <- N  # se intenta contactar a todos
  sobremuestra <- 0L  # no aplica
  tasa_respuesta_esperada <- if (par$tasa_respuesta > 0) par$tasa_respuesta else cobertura_obj

  list(
    n_teorico                = NA_integer_,
    n_objetivo               = as.integer(n_objetivo),
    n_operativo              = as.integer(n_operativo),
    cobertura_objetivo       = cobertura_obj,
    tasa_respuesta_esperada  = tasa_respuesta_esperada,
    universo_a_contactar     = as.integer(N),
    sobremuestra             = sobremuestra,
    precision_alcanzada      = NA_real_,
    origen_tamano            = comp$origen_tamano,
    advertencia              = paste("Intención censal: se reporta cobertura, no margen de error.",
                                     "Aplica TCL: con n >= 30 la lectura es estable.")
  )
}

#' Calcula resultado para cuotas no probabilísticas.
.cm_calc_cuotas <- function(comp) {
  meta_valor <- comp$meta$valor
  if (meta_valor <= 0L) meta_valor <- 150L
  par <- comp$parametros

  n_objetivo <- as.integer(meta_valor)
  n_operativo <- as.integer(ceiling(n_objetivo / max(par$tasa_respuesta, 0.01)))
  sobremuestra <- as.integer(ceiling(n_operativo * par$oversample_pct))

  list(
    n_teorico              = NA_integer_,
    n_objetivo             = n_objetivo,
    n_operativo            = as.integer(n_operativo + sobremuestra),
    sobremuestra           = sobremuestra,
    variable_control       = comp$meta$variable_control,
    sub_cuotas             = comp$meta$sub_cuotas,
    precision_alcanzada    = NA_real_,
    origen_tamano          = comp$origen_tamano,
    advertencia            = paste("Diseño no probabilístico por cuotas: no admite margen de error formal.",
                                   "Reportar como representatividad teórica/controlada.")
  )
}

#' Calcula resultado para MAS — Muestreo Aleatorio Simple.
.cm_calc_mas <- function(comp, inferencia) {
  N <- comp$marco$marco_validado
  par <- comp$parametros
  matriz_operativa <- comp$marco$matriz_operativa %||% list()

  if (length(matriz_operativa) > 0L) {
    return(.cm_calc_mas_matriz_servicios(comp, inferencia))
  }

  if (!inferencia$permitido) {
    n_teorico <- if (N > 0L) {
      calc_n_muestra(N = N, p = par$p, z = par$z, e = par$e, deff = 1)
    } else NA_integer_
    return(list(
      n_teorico              = n_teorico,
      n_objetivo             = n_teorico,
      n_operativo            = n_teorico,
      precision_alcanzada    = NA_real_,
      sobremuestra           = 0L,
      origen_tamano          = comp$origen_tamano,
      advertencia            = paste("Resultado calculado sin habilitar margen de error formal.",
                                     inferencia$motivos)
    ))
  }

  n_teorico <- calc_n_muestra(N = N, p = par$p, z = par$z, e = par$e, deff = 1)
  n_objetivo <- .cm_aplicar_ajuste_objetivo(n_teorico, comp)
  n_operativo_base <- as.integer(n_objetivo)
  sobremuestra <- as.integer(ceiling(n_operativo_base * par$oversample_pct))
  precision_alcanzada <- calc_e_desde_n_muestra(
    n = n_objetivo, N = N, p = par$p, z = par$z, deff = 1
  )

  list(
    n_teorico            = as.integer(n_teorico),
    n_objetivo           = as.integer(n_objetivo),
    n_operativo          = as.integer(n_operativo_base + sobremuestra),
    precision_alcanzada  = precision_alcanzada,
    sobremuestra         = sobremuestra,
    origen_tamano        = comp$origen_tamano
  )
}

.cm_aplicar_ajuste_objetivo <- function(n_teorico, comp) {
  meta_valor <- comp$meta$valor %||% 0L
  if (is.na(n_teorico) || n_teorico <= 0L) return(as.integer(meta_valor))
  if (is.numeric(meta_valor) && meta_valor > 0L) {
    return(as.integer(ceiling(meta_valor)))
  }
  as.integer(n_teorico)
}

#' Calcula resultado para muestreo estratificado proporcional.
#'
#' La UI lo usa cuando el usuario cuenta con un marco por capas o variables de
#' control. Calcula un n clásico total y lo reparte proporcionalmente por
#' estrato, con piso opcional si el tamaño lo permite.
.cm_calc_estratificado <- function(comp, inferencia) {
  N <- comp$marco$marco_validado
  par <- comp$parametros
  estratos <- comp$marco$estratos %||% list()

  if (!inferencia$permitido) {
    n_teorico <- if (N > 0L) {
      calc_n_muestra(N = N, p = par$p, z = par$z, e = par$e, deff = par$deff)
    } else NA_integer_
    return(list(
      n_teorico              = n_teorico,
      n_objetivo             = n_teorico,
      n_operativo            = n_teorico,
      precision_alcanzada    = NA_real_,
      sobremuestra           = 0L,
      origen_tamano          = comp$origen_tamano,
      advertencia            = paste("Resultado calculado sin habilitar margen de error formal.",
                                     inferencia$motivos)
    ))
  }

  n_teorico <- calc_n_muestra(N = N, p = par$p, z = par$z, e = par$e, deff = par$deff)
  n_objetivo <- .cm_aplicar_ajuste_objetivo(n_teorico, comp)
  n_operativo_base <- as.integer(n_objetivo)
  sobremuestra <- as.integer(ceiling(n_operativo_base * par$oversample_pct))
  precision_alcanzada <- calc_e_desde_n_muestra(
    n = n_objetivo, N = N, p = par$p, z = par$z, deff = par$deff
  )

  base_result <- list(
    n_teorico            = as.integer(n_teorico),
    n_objetivo           = as.integer(n_objetivo),
    n_operativo          = as.integer(n_operativo_base + sobremuestra),
    precision_alcanzada  = precision_alcanzada,
    sobremuestra         = sobremuestra,
    origen_tamano        = comp$origen_tamano
  )

  if (length(estratos) == 0L) {
    return(c(base_result, list(
      advertencia = "Muestreo estratificado sin tabla de estratos: se calculó n total, pero falta la distribución por capas."
    )))
  }

  pesos <- vapply(estratos, function(e) e$N, integer(1))
  piso <- if (par$n_minimo_estrato > 0L) par$n_minimo_estrato else 0L
  cuotas <- .cm_distribuir_con_piso(n_total = n_objetivo, pesos = pesos, piso = piso)
  distribucion_estratos <- lapply(seq_along(estratos), function(i) {
    e <- estratos[[i]]
    n_i <- as.integer(cuotas[[i]])
    list(
      estrato     = e$label,
      N           = e$N,
      n           = n_i,
      precision_e = if (n_i > 0L) calc_e_desde_n_muestra(
        n = n_i, N = e$N, p = par$p, z = par$z, deff = par$deff
      ) else NA_real_,
      regla       = if (piso > 0L && n_i <= piso) sprintf("piso_%d", piso) else "proporcional"
    )
  })

  c(base_result, list(
    distribucion_estratos = distribucion_estratos,
    advertencia = "Muestreo estratificado proporcional: el margen de error formal corresponde al diseño probabilístico documentado."
  ))
}

#' Calcula resultado para dominios independientes.
#'
#' Cada estrato/facultad se dimensiona con fórmula propia, margen de error
#' propio (`e_facultad`) y proporción de éxito propia (`p_facultad`). El
#' ajuste operativo extra se absorbe en el dominio de mayor marco para cerrar
#' exactamente el n final.
.cm_calc_estratificado_independiente <- function(comp, inferencia) {
  N <- comp$marco$marco_validado
  par <- comp$parametros
  estratos <- comp$marco$estratos %||% list()

  if (length(estratos) == 0L) {
    return(.cm_calc_estratificado(comp, inferencia))
  }

  if (!inferencia$permitido) {
    return(list(
      n_teorico              = NA_integer_,
      n_objetivo             = NA_integer_,
      n_operativo            = NA_integer_,
      precision_alcanzada    = NA_real_,
      sobremuestra           = 0L,
      origen_tamano          = comp$origen_tamano,
      advertencia            = paste("Resultado calculado sin habilitar margen de error formal.",
                                     inferencia$motivos)
    ))
  }

  cuotas_base <- vapply(estratos, function(e) {
    if ((e$cuota_fija %||% 0L) > 0L) return(as.integer(e$cuota_fija))
    p_e <- if (!is.null(e$p_facultad) && !is.na(e$p_facultad)) e$p_facultad else par$p
    z_e <- .cm_z_estrato(e, par$z)
    calc_n_muestra(N = e$N, p = p_e, z = z_e,
                   e = e$e_facultad %||% par$e, deff = par$deff)
  }, integer(1))
  n_teorico <- as.integer(sum(cuotas_base))
  meta_valor <- comp$meta$valor %||% 0L
  n_objetivo <- if (is.numeric(meta_valor) && meta_valor > n_teorico) {
    as.integer(ceiling(meta_valor))
  } else {
    n_teorico
  }
  cuotas <- as.integer(cuotas_base)
  diff <- as.integer(n_objetivo - sum(cuotas))
  if (diff != 0L) {
    pesos <- vapply(estratos, function(e) e$N, integer(1))
    idx_max <- which.max(pesos)
    cuotas[idx_max] <- as.integer(max(0L, cuotas[idx_max] + diff))
  }

  distribucion_sub <- vector("list", 0L)
  for (i in seq_along(estratos)) {
    e <- estratos[[i]]
    asignacion <- distribuir_proporcional_pesos(
      n_total = cuotas[i],
      pesos = c(e$N_a, e$N_b),
      redondeo = "cuadratura"
    )
    distribucion_sub[[length(distribucion_sub) + 1L]] <- list(
      estrato = e$label, sub = e$sub_a_label, N = e$N_a, n = as.integer(asignacion[1])
    )
    distribucion_sub[[length(distribucion_sub) + 1L]] <- list(
      estrato = e$label, sub = e$sub_b_label, N = e$N_b, n = as.integer(asignacion[2])
    )
  }

  distribucion_estratos <- lapply(seq_along(estratos), function(i) {
    e <- estratos[[i]]
    n_i <- as.integer(cuotas[i])
    p_e <- if (!is.null(e$p_facultad) && !is.na(e$p_facultad)) e$p_facultad else par$p
    z_e <- .cm_z_estrato(e, par$z)
    list(
      estrato     = e$label,
      N           = e$N,
      n           = n_i,
      p_e         = p_e,
      z_e         = z_e,
      confianza_e = e$confianza_facultad %||% NA_real_,
      precision_e = calc_e_desde_n_muestra(
        n = n_i, N = e$N, p = p_e, z = z_e, deff = par$deff
      ),
      regla       = sprintf(
        "e_facultad_%s_p_%s_z_%s",
        format(e$e_facultad %||% par$e, scientific = FALSE),
        format(p_e, scientific = FALSE),
        format(round(z_e, 3), scientific = FALSE)
      )
    )
  })

  sobremuestras_fijas <- vapply(estratos, function(e) e$sobremuestra_fija %||% 0L, integer(1))
  if (all(sobremuestras_fijas > 0L)) {
    n_operativo <- as.integer(sum(sobremuestras_fijas))
    sobremuestra <- as.integer(n_operativo - n_objetivo)
  } else {
    sobremuestra <- as.integer(ceiling(n_objetivo * par$oversample_pct))
    n_operativo <- as.integer(n_objetivo + sobremuestra)
  }

  aulas_por_estrato <- lapply(seq_along(estratos), function(i) {
    e <- estratos[[i]]
    cuota <- as.integer(cuotas[i])
    est_e <- .cm_estadistico_conglomerado_estrato(e, par)
    avg_e <- est_e$valor
    tau_e <- if (e$tau > 0) e$tau else par$tau
    aulas_base <- if ((e$aulas_base_fijas %||% 0L) > 0L) {
      as.integer(e$aulas_base_fijas)
    } else {
      as.integer(ceiling(cuota / (max(avg_e, 1) * max(tau_e, 0.01))))
    }
    aulas_extra <- if ((e$aulas_extra_operativas %||% 0L) > 0L) {
      as.integer(e$aulas_extra_operativas)
    } else {
      0L
    }
    list(
      estrato = e$label,
      N = e$N,
      cuota = cuota,
      avg_conglomerado = avg_e,
      estadistico_usado = est_e$usado,
      tau = tau_e,
      aulas_base = aulas_base,
      aulas_reemplazo = aulas_extra,
      aulas_extra_operativas = aulas_extra,
      aulas_total = aulas_base + aulas_extra,
      tipo_aula = .cm_clasificar_tipo_aula(avg_e, e$label),
      precision_e = distribucion_estratos[[i]]$precision_e
    )
  })

  c(list(
    n_teorico            = as.integer(n_teorico),
    n_objetivo           = as.integer(n_objetivo),
    n_operativo          = as.integer(n_operativo),
    precision_alcanzada  = NA_real_,
    sobremuestra         = sobremuestra,
    origen_tamano        = comp$origen_tamano,
    distribucion_estratos = distribucion_estratos,
    distribucion_sub      = distribucion_sub,
    aulas_por_estrato     = aulas_por_estrato,
    aulas_total           = as.integer(sum(vapply(aulas_por_estrato, function(a) a$aulas_total, integer(1)))),
    aulas_base_total      = as.integer(sum(vapply(aulas_por_estrato, function(a) a$aulas_base, integer(1)))),
    aulas_extra_total     = as.integer(sum(vapply(aulas_por_estrato, function(a) a$aulas_reemplazo, integer(1)))),
    estadistico_conglomerado = par$estadistico_conglomerado,
    advertencia = "Dominios independientes: cada facultad se dimensiona con su propio margen de error y proporción de éxito."
  ))
}

#' Calcula resultado para muestreo sistemático.
.cm_calc_sistematico <- function(comp, inferencia) {
  res <- .cm_calc_mas(comp, inferencia)
  N <- comp$marco$marco_validado
  n <- res$n_objetivo %||% 0L
  intervalo <- if (!is.na(n) && n > 0L && N > 0L) floor(N / n) else NA_integer_
  res$intervalo_sistematico <- as.integer(intervalo)
  res$advertencia <- paste(
    res$advertencia %||% "",
    "Muestreo sistemático: requiere marco ordenado y arranque aleatorio documentado."
  )
  res
}

#' Calcula muestra por territorio y cuotas por servicio.
#'
#' Este es el patrón de estudios ocasionales tipo GIZ: el marco no es un
#' listado nominal cerrado sino un volumen operativo por territorio y servicio
#' (p. ej. atenciones mensuales). Se calcula un n clásico por territorio y
#' luego se distribuye por servicio proporcionalmente, con piso analítico.
.cm_calc_mas_matriz_servicios <- function(comp, inferencia) {
  par <- comp$parametros
  matriz <- comp$marco$matriz_operativa %||% list()
  territorios <- unique(vapply(matriz, function(e) e$territorio, character(1)))
  piso <- max(par$n_minimo_estrato, 0L)

  distribucion_territorios <- vector("list", length(territorios))
  cuotas_matriz <- vector("list", 0L)
  n_total <- 0L
  N_total <- 0L

  for (i in seq_along(territorios)) {
    terr <- territorios[[i]]
    filas <- matriz[vapply(matriz, function(e) identical(e$territorio, terr), logical(1))]
    pesos <- vapply(filas, function(e) e$N, integer(1))
    servicios <- vapply(filas, function(e) e$servicio, character(1))
    N_terr <- as.integer(sum(pesos))
    n_terr <- .cm_calc_n_muestra_redondeado(
      N = N_terr, p = par$p, z = par$z, e = par$e, deff = par$deff
    )
    cuotas <- .cm_distribuir_con_piso(n_total = n_terr, pesos = pesos, piso = piso)
    precision_terr <- calc_e_desde_n_muestra(
      n = n_terr, N = N_terr, p = par$p, z = par$z, deff = par$deff
    )

    distribucion_territorios[[i]] <- list(
      estrato     = terr,
      N           = N_terr,
      n           = as.integer(n_terr),
      precision_e = precision_terr,
      regla       = sprintf("formula_clasica_y_cuotas_piso_%d", piso)
    )

    for (j in seq_along(filas)) {
      cuotas_matriz[[length(cuotas_matriz) + 1L]] <- list(
        territorio = terr,
        servicio   = servicios[[j]],
        N          = as.integer(pesos[[j]]),
        n          = as.integer(cuotas[[j]]),
        regla      = if (piso > 0L && cuotas[[j]] <= piso) sprintf("piso_%d", piso) else "proporcional"
      )
    }

    n_total <- as.integer(n_total + n_terr)
    N_total <- as.integer(N_total + N_terr)
  }

  precision_total <- calc_e_desde_n_muestra(
    n = n_total, N = N_total, p = par$p, z = par$z, deff = par$deff
  )

  list(
    n_teorico                = as.integer(n_total),
    n_objetivo               = as.integer(n_total),
    n_operativo              = as.integer(n_total),
    precision_alcanzada      = precision_total,
    sobremuestra             = 0L,
    origen_tamano            = comp$origen_tamano,
    distribucion_estratos    = distribucion_territorios,
    cuotas_matriz            = cuotas_matriz,
    advertencia              = paste(
      "Matriz operativa territorio x servicio: se calcula n clásico por territorio",
      "y se distribuyen cuotas por servicio según volumen del marco.",
      "Si la selección final no es probabilística, no reportar margen de error para esa selección."
    )
  )
}

.cm_calc_n_muestra_redondeado <- function(N, p = 0.5, z = 1.96, e, deff = 1) {
  if (any(is.na(c(N, p, z, e, deff)))) {
    stop_api(400, "E_CALC_PARAMS",
             "Parámetros del cálculo no pueden ser NA.")
  }
  if (e <= 0 || e >= 1) {
    stop_api(400, "E_CALC_ERROR_RANGO",
             sprintf("El margen de error debe estar en (0, 1), recibido: %s", e))
  }
  q <- 1 - p
  num <- z^2 * p * q * deff
  n <- if (is.infinite(N) || N <= 0) {
    num / e^2
  } else {
    (N * num) / ((N - 1) * e^2 + num)
  }
  as.integer(max(round(n), 1L))
}

.cm_distribuir_con_piso <- function(n_total, pesos, piso = 0L) {
  if (length(pesos) == 0L) return(integer())
  if (n_total <= 0L || sum(pesos, na.rm = TRUE) <= 0) return(rep(0L, length(pesos)))
  piso <- as.integer(max(piso, 0L))
  if (piso == 0L || n_total < piso * length(pesos)) {
    return(distribuir_proporcional_pesos(n_total, pesos, redondeo = "cuadratura"))
  }
  base <- rep(piso, length(pesos))
  remanente <- as.integer(n_total - sum(base))
  if (remanente <= 0L) return(as.integer(base))
  as.integer(base + distribuir_proporcional_pesos(remanente, pesos, redondeo = "cuadratura"))
}

#' Calcula resultado para barrido operativo de cobertura.
#'
#' El barrido busca cubrir un % objetivo del universo de unidades operativas
#' (típicamente cursos-horario para acreditaciones). Salida: número de
#' unidades a barrer + cobertura esperada en personas. NO produce margen de
#' error formal.
.cm_calc_barrido <- function(comp) {
  N <- if (comp$marco$marco_contactable > 0L) comp$marco$marco_contactable
       else comp$marco$marco_validado
  par <- comp$parametros
  cobertura <- par$cobertura_objetivo
  if (cobertura <= 0) cobertura <- 0.85

  # Personas objetivo = % del universo
  personas_objetivo <- as.integer(ceiling(N * cobertura))
  # Unidades operativas necesarias = personas_objetivo / (promedio * tau)
  promedio_aula <- max(par$promedio_conglomerado, 1)
  tau_efec <- max(par$tau, 0.01)
  unidades_operativas <- as.integer(ceiling(
    personas_objetivo / (promedio_aula * tau_efec)
  ))
  # Sobremuestra operativa (refuerzo)
  unidades_refuerzo <- as.integer(ceiling(unidades_operativas * par$oversample_pct))

  list(
    n_teorico               = NA_integer_,
    n_objetivo              = personas_objetivo,
    n_operativo             = personas_objetivo,
    unidades_operativas     = as.integer(unidades_operativas + unidades_refuerzo),
    unidades_base           = unidades_operativas,
    unidades_refuerzo       = unidades_refuerzo,
    cobertura_objetivo      = cobertura,
    universo_a_contactar    = as.integer(N),
    sobremuestra            = 0L,
    precision_alcanzada     = NA_real_,
    origen_tamano           = comp$origen_tamano,
    advertencia             = paste(
      "Barrido operativo: la meta se reporta como cobertura del universo,",
      "no como muestra inferencial. No produce margen de error formal."
    )
  )
}

#' Calcula resultado para conveniencia no probabilística.
#'
#' Sin marco probabilístico: la meta es fijada operativamente (presupuesto,
#' acuerdo con cliente). Se reporta como evidencia descriptiva del grupo
#' respondiente, no como inferencia poblacional.
#'
#' Si el marco tiene `estratos`, calcula además la regla operativa por
#' estrato según los parámetros del componente:
#'   - cobertura_objetivo · % a alcanzar en estratos medianos
#'   - n_minimo_estrato   · cota inferior (estratos pequeños van a censal)
#'   - tope_operativo     · cap para estratos grandes
#'
#' Patrón canónico Acreditación Ingeniería 2026:
#'   - N_estrato ≤ n_minimo_estrato → cuota = N (censal)
#'   - n_minimo_estrato < N ≤ tope_operativo / cobertura → cuota = ceil(N × cobertura)
#'   - N > umbral → cuota = tope_operativo (cap)
.cm_calc_conveniencia <- function(comp) {
  meta_valor <- comp$meta$valor
  par <- comp$parametros
  estratos <- comp$marco$estratos %||% list()
  tiene_estratos <- length(estratos) > 0L

  if (tiene_estratos) {
    n_min <- max(par$n_minimo_estrato, 1L)
    tope  <- max(par$tope_operativo, 1L)
    cobertura <- max(par$cobertura_objetivo, 0.01)
    # Umbrales operativos para clasificar la regla aplicada en cada estrato.
    umbral_inferior <- as.integer(ceiling(n_min / cobertura))  # debajo el min domina
    umbral_superior <- as.integer(ceiling(tope / cobertura))   # arriba el tope domina

    distribucion_estratos <- vector("list", length(estratos))
    cuotas <- integer(length(estratos))
    for (i in seq_along(estratos)) {
      e <- estratos[[i]]
      N_e <- e$N
      # Regla canónica: cuota = clamp(ceil(N × cobertura), n_min, tope),
      # nunca mayor a N (el universo es el límite duro).
      crudo <- as.integer(ceiling(N_e * cobertura))
      cuota_e <- max(min(crudo, tope), n_min)
      if (cuota_e > N_e) cuota_e <- N_e  # no pedir más que el universo
      regla <- if (N_e <= n_min) "censal"
               else if (N_e <= umbral_inferior) sprintf("piso_n_min_%d", n_min)
               else if (N_e <= umbral_superior) sprintf("cobertura_%.0f%%", cobertura * 100)
               else sprintf("tope_%d", tope)
      cuotas[i] <- as.integer(cuota_e)
      distribucion_estratos[[i]] <- list(
        estrato     = e$label,
        N           = N_e,
        n           = as.integer(cuota_e),
        regla       = regla,
        precision_e = NA_real_
      )
    }
    n_objetivo <- as.integer(sum(cuotas))
    n_operativo_base <- as.integer(ceiling(n_objetivo / max(par$tasa_respuesta, 0.01)))
    sobremuestra <- as.integer(ceiling(n_operativo_base * par$oversample_pct))

    return(list(
      n_teorico            = NA_integer_,
      n_objetivo           = n_objetivo,
      n_operativo          = as.integer(n_operativo_base + sobremuestra),
      sobremuestra         = sobremuestra,
      precision_alcanzada  = NA_real_,
      origen_tamano        = comp$origen_tamano,
      distribucion_estratos = distribucion_estratos,
      advertencia          = paste(
        sprintf("Conveniencia estratificada: %d estratos · cuota = clamp(N×%.0f%%, %d, %d).",
                length(estratos), cobertura * 100, n_min, tope),
        "Resultados son evidencia descriptiva del grupo respondiente,",
        "no inferencia poblacional."
      )
    ))
  }

  if (meta_valor <= 0L) meta_valor <- 400L
  n_objetivo <- as.integer(meta_valor)
  n_operativo_base <- as.integer(ceiling(n_objetivo / max(par$tasa_respuesta, 0.01)))
  sobremuestra <- as.integer(ceiling(n_operativo_base * par$oversample_pct))

  list(
    n_teorico            = NA_integer_,
    n_objetivo           = n_objetivo,
    n_operativo          = as.integer(n_operativo_base + sobremuestra),
    sobremuestra         = sobremuestra,
    precision_alcanzada  = NA_real_,
    origen_tamano        = comp$origen_tamano,
    advertencia          = paste(
      "Diseño no probabilístico por conveniencia: los resultados son evidencia",
      "del grupo respondiente, no inferencia poblacional."
    )
  )
}

#' Calcula resultado para listado externo con meta fija.
.cm_calc_listado_externo <- function(comp) {
  meta_efectiva <- comp$meta$valor
  if (meta_efectiva <= 0L) meta_efectiva <- 400L
  par <- comp$parametros

  tau_cont <- max(par$tasa_contacto, 0.01)
  tau_eleg <- max(par$tasa_elegibilidad, 0.01)
  tau_resp <- max(par$tasa_respuesta, 0.01)

  registros_a_contactar <- as.integer(ceiling(meta_efectiva / (tau_cont * tau_eleg * tau_resp)))
  n_objetivo <- as.integer(meta_efectiva)

  list(
    n_teorico              = NA_integer_,
    n_objetivo             = n_objetivo,
    n_operativo            = registros_a_contactar,
    sobremuestra           = as.integer(registros_a_contactar - n_objetivo),
    tasa_contacto          = tau_cont,
    tasa_elegibilidad      = tau_eleg,
    tasa_respuesta         = tau_resp,
    registros_a_contactar  = registros_a_contactar,
    precision_alcanzada    = NA_real_,
    origen_tamano          = comp$origen_tamano,
    advertencia            = paste("Listado externo: meta contractual.",
                                   "El diseño original del listado puede ser desconocido;",
                                   "no se reporta margen de error.")
  )
}

# ---------------------------------------------------------------------------
# Calcular todos los componentes del estudio
# ---------------------------------------------------------------------------

#' Calcula resultados para todos los componentes y devuelve el estudio actualizado.
calc_muestra_calcular_estudio <- function(estudio) {
  estudio <- calc_muestra_normalize_estudio(estudio)
  if (length(estudio$componentes) == 0L) {
    stop_api(409, "E_SIN_COMPONENTES",
             "El estudio no tiene componentes para calcular.")
  }
  estudio$componentes <- lapply(estudio$componentes, function(comp) {
    comp$resultado <- calc_muestra_calcular_componente(comp)
    comp
  })
  estudio$decision_log <- calc_muestra_build_decision_log(estudio)
  estudio$computado_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  estudio
}

# ---------------------------------------------------------------------------
# Recomendador automático (port simplificado de samplingCore.ts)
# ---------------------------------------------------------------------------

#' Recomienda una técnica para un componente dado su diagnóstico.
#'
#' Cascada de 9 condiciones según compendio §1. Devuelve lista con
#' `tecnica`, `naturaleza`, `nivel_respaldo`, `origen_tamano`, `razon`.
calc_muestra_recomendar <- function(diagnostico) {
  d <- diagnostico
  if (!is.list(d)) d <- list()

  busca_censo            <- calc_bool(d$buscaCenso, FALSE)
  universo_pequeno       <- calc_bool(d$universoPequeno, FALSE)
  poblacion_oculta       <- calc_bool(d$poblacionOculta, FALSE)
  marco_estado           <- calc_str(d$marcoEstado, "no_definido")
  probabilidad_conocida  <- calc_bool(d$probabilidadConocida, FALSE)
  busca_representativid  <- calc_bool(d$buscaRepresentatividad, FALSE)
  controla_cuotas        <- calc_bool(d$controlaCuotas, FALSE)
  necesita_margen        <- calc_bool(d$necesitaMargenError, FALSE)
  modo_campo             <- calc_str(d$modoCampo, "individual")
  tiene_conglomerados    <- calc_bool(d$tieneConglomerados, FALSE)
  marco_ordenado         <- calc_bool(d$marcoOrdenado, FALSE)
  tiene_estratos         <- calc_bool(d$tieneEstratos, FALSE)
  medicion_recurrente    <- calc_bool(d$medicionRecurrente, FALSE)
  N_marco                <- calc_int(d$N_marco, 0L, min = 0L)

  rec <- function(tec, razon) {
    list(
      tecnica = tec,
      naturaleza = .CM_NATURALEZAS_POR_TECNICA[[tec]],
      nivel_respaldo = .cm_respaldo_default_para(tec),
      origen_tamano = .cm_origen_default_para(tec),
      razon = razon
    )
  }

  if (universo_pequeno || busca_censo) {
    return(rec("intencion_censal",
               "Universo pequeño o búsqueda de cobertura censal."))
  }
  if (identical(marco_estado, "listado_externo") && !probabilidad_conocida) {
    return(rec("listado_externo_meta_fija",
               "Listado externo entregado por contraparte con meta contractual."))
  }
  if (busca_representativid && controla_cuotas && !probabilidad_conocida) {
    return(rec("no_prob_cuotas",
               "Control de composición por cuotas sin probabilidad conocida."))
  }
  if (identical(marco_estado, "no_definido") && !probabilidad_conocida) {
    return(rec("no_prob_conveniencia",
               "Sin marco probabilístico operativamente viable."))
  }
  if (!necesita_margen && identical(marco_estado, "operativo")) {
    return(rec("barrido",
               "Marco operativo sin necesidad de inferencia formal."))
  }
  if (medicion_recurrente && probabilidad_conocida) {
    return(rec("medicion_recurrente",
               "Aplicación periódica del mismo diseño en olas."))
  }
  if (tiene_conglomerados || identical(modo_campo, "por_grupos")) {
    return(rec("prob_conglomerado_multietapico",
               "Unidad operativa natural es el conglomerado (aulas, manzanas, EESS)."))
  }
  if (marco_ordenado && probabilidad_conocida) {
    return(rec("sistematico",
               "Marco ordenado con probabilidad conocida — selección sistemática."))
  }
  if (tiene_estratos && probabilidad_conocida) {
    return(rec("prob_estratificado",
               "Estratos bien definidos con marco completo por estrato."))
  }
  if (probabilidad_conocida && N_marco > 0L) {
    return(rec("prob_aleatorio_simple",
               "Marco completo enumerable, selección aleatoria simple."))
  }
  rec("intencion_censal",
      "Default conservador: intentar cobertura censal del universo elegible.")
}

# ---------------------------------------------------------------------------
# Locator de catálogos JSON (preset, etc.)
# ---------------------------------------------------------------------------

.cm_locate_catalog <- function(filename) {
  candidates <- c(
    system.file("catalogos", filename, package = "prosecnurapp"),
    system.file("catalogos", filename, package = "prosecnur"),
    file.path(getwd(), "api", "inst", "catalogos", filename),
    file.path(getwd(), "inst", "catalogos", filename),
    file.path(getwd(), "..", "inst", "catalogos", filename),
    file.path(getwd(), "..", "..", "inst", "catalogos", filename),
    file.path(getwd(), "..", "..", "api", "inst", "catalogos", filename)
  )
  hit <- candidates[nzchar(candidates) & file.exists(candidates)][1]
  if (is.na(hit)) {
    stop_api(500, "E_CATALOG_NOT_FOUND",
             sprintf("No se encontró el catálogo '%s'.", filename))
  }
  hit
}

# ---------------------------------------------------------------------------
# Iniciar estudio según tipo (macro_familia)
# ---------------------------------------------------------------------------

#' Inicia un estudio nuevo generando la estructura inicial según el tipo.
#'
#' Cada tipo de estudio tiene un patrón canónico de componentes. La estructura
#' es vacía (sin datos pre-cargados); el usuario completa N, parámetros y
#' estratos en la UI. El motor aplica el cuadro maestro automáticamente.
#'
#' @param tipo macro_familia: acreditacion, encuesta_estudiantes,
#'   hsvg_universitario, territorial,
#'   linea_base_servicios, listado_telefonico, estudio_propio.
#' @param variante Opcional: "vacio" (default), "plantilla_pucp" (alias legacy
#'   para estudios antiguos con estratos pre-poblados).
#' @return Lista con macro_familia y componentes iniciales.
calc_muestra_iniciar_estudio <- function(tipo, variante = "vacio") {
  tipo <- calc_enum(tipo, .CM_MACRO_FAMILIAS, "estudio_propio")
  variante <- calc_str(variante, "vacio")

  if (tipo == "acreditacion") {
    return(.cm_iniciar_acreditacion())
  }
  if (tipo %in% c("encuesta_estudiantes", "hsvg_universitario")) {
    return(.cm_iniciar_hsvg(variante, macro_familia = if (tipo == "hsvg_universitario") "hsvg_universitario" else "encuesta_estudiantes"))
  }
  if (tipo == "territorial") {
    return(.cm_iniciar_territorial())
  }
  if (tipo == "linea_base_servicios") {
    return(.cm_iniciar_linea_base())
  }
  if (tipo == "listado_telefonico") {
    return(.cm_iniciar_listado())
  }
  # estudio_propio: sin componentes pre-armados
  list(macro_familia = "estudio_propio", componentes = list())
}

# Acreditación universitaria: 4 actores canónicos vacíos.
.cm_iniciar_acreditacion <- function() {
  actores <- list(
    list(actor = "Personal administrativo", actor_id = "administrativos",
         actor_categoria = "administrativos", canal_recojo = "online_email"),
    list(actor = "Docentes", actor_id = "docentes",
         actor_categoria = "docentes", canal_recojo = "online_email"),
    list(actor = "Estudiantes pregrado", actor_id = "estudiantes",
         actor_categoria = "estudiantes", canal_recojo = "aula_qr"),
    list(actor = "Egresados", actor_id = "egresados",
         actor_categoria = "egresados", canal_recojo = "telefonico")
  )
  componentes <- lapply(actores, function(a) {
    calc_muestra_normalize_componente(c(a, list(
      tecnica = "intencion_censal",
      marco = list(universo_bruto = 0L, marco_validado = 0L, marco_contactable = 0L,
                   estado = "no_definido")
    )))
  })
  list(macro_familia = "acreditacion", componentes = componentes)
}

# Encuesta a estudiantes: 1 componente estudiantes en aulas. `hsvg_universitario`
# se mantiene solo como alias legacy para proyectos ya creados.
.cm_iniciar_hsvg <- function(variante, macro_familia = "encuesta_estudiantes") {
  if (identical(variante, "plantilla_pucp")) {
    res <- calc_muestra_aplicar_preset_hsvg()
    aulas_demo <- NULL
    if (exists("calc_muestra_aulas_demo_hsvg_2025", mode = "function")) {
      aulas_demo <- tryCatch(
        calc_muestra_aulas_demo_hsvg_2025(),
        error = function(e) list(error = conditionMessage(e))
      )
    }
    if (is.list(aulas_demo) && is.null(aulas_demo$error) && !is.null(aulas_demo$frame$population_n)) {
      demo_n <- calc_int(aulas_demo$frame$population_n, 0L, min = 0L)
      if (demo_n > 0L) {
        res$componente$marco$universo_bruto <- demo_n
        res$componente$marco$marco_validado <- demo_n
        res$componente$marco$marco_contactable <- demo_n
        res$componente$marco$notas <- "Marco institucional de referencia 2025-II, sincronizado con la demo de aulas."
      }
    }
    return(list(
      macro_familia = macro_familia,
      componentes = list(res$componente),
      aulas_demo = aulas_demo
    ))
  }
  comp <- calc_muestra_normalize_componente(list(
    actor = "Estudiantes pregrado",
    actor_id = "estudiantes",
    actor_categoria = "estudiantes",
    canal_recojo = "aula_qr",
    tecnica = "prob_conglomerado_multietapico",
    marco = list(universo_bruto = 0L, marco_validado = 0L, marco_contactable = 0L,
                 estado = "no_definido", estratos = list())
  ))
  list(macro_familia = macro_familia, componentes = list(comp))
}

# Territorial: 1 componente vacío con conglomerados.
.cm_iniciar_territorial <- function() {
  comp <- calc_muestra_normalize_componente(list(
    actor = "Hogares / personas",
    actor_id = "hogares",
    actor_categoria = "otros",
    canal_recojo = "presencial",
    tecnica = "prob_conglomerado_multietapico",
    marco = list(universo_bruto = 0L, marco_validado = 0L, marco_contactable = 0L,
                 estado = "no_definido", estratos = list())
  ))
  list(macro_familia = "territorial", componentes = list(comp))
}

# Línea de base: 1 componente para diseñar desde marco disponible. Soporta
# MAS simple si hay marco total, o matriz territorio x servicio si el estudio
# se dimensiona desde volúmenes operativos (patrón GIZ).
.cm_iniciar_linea_base <- function() {
  comp <- calc_muestra_normalize_componente(list(
    actor = "Usuarios / atenciones de servicios",
    actor_id = "usuarios",
    actor_categoria = "otros",
    canal_recojo = "presencial",
    tecnica = "prob_aleatorio_simple",
    origen_tamano = "formula",
    marco = list(universo_bruto = 0L, marco_validado = 0L, marco_contactable = 0L,
                 estado = "no_definido", matriz_operativa = list()),
    parametros = list(deff = 1, oversample_pct = 0, tasa_respuesta = 1,
                      n_minimo_estrato = 30)
  ))
  list(macro_familia = "linea_base_servicios", componentes = list(comp))
}

# Listado entregado: 1 componente listado externo meta fija.
.cm_iniciar_listado <- function() {
  comp <- calc_muestra_normalize_componente(list(
    actor = "Beneficiarios del listado",
    actor_id = "beneficiarios",
    actor_categoria = "otros",
    canal_recojo = "telefonico",
    tecnica = "listado_externo_meta_fija",
    marco = list(universo_bruto = 0L, marco_validado = 0L, marco_contactable = 0L,
                 estado = "listado_externo")
  ))
  list(macro_familia = "listado_telefonico", componentes = list(comp))
}

# ---------------------------------------------------------------------------
# Plantilla canónica universitaria — único caso donde tiene sentido pre-cargar
# datos estructurales de referencia (15 estratos de facultades 2025-II).
# Se usa solo como punto de partida editable cuando el usuario inicia el
# estudio de estudiantes con variante legacy "plantilla_pucp".
# ---------------------------------------------------------------------------

#' Aplica el preset HSVG PUCP: 1 componente "estudiantes" con técnica
#' conglomerados multietápico y 15 estratos por facultad pre-poblados.
#'
#' @return Lista con `componente` y `macro_familia`.
calc_muestra_aplicar_preset_hsvg <- function() {
  preset_path <- .cm_locate_catalog("preset_hsvg_pucp.json")
  if (!nzchar(preset_path) || !file.exists(preset_path)) {
    stop_api(500, "E_PRESET_NOT_FOUND",
             "No se encontró el preset preset_hsvg_pucp.json.")
  }
  preset <- jsonlite::fromJSON(preset_path, simplifyVector = FALSE)
  tpl <- preset$componente_template
  estratos_tpl <- preset$estratos_template
  sub_a_label <- calc_str(preset$sub_a_label, "Sub-estrato A")
  sub_b_label <- calc_str(preset$sub_b_label, "Sub-estrato B")

  estratos <- lapply(estratos_tpl, function(e) {
    list(
      id                    = .cm_random_id(),
      label                 = calc_str(e$label, ""),
      N                     = calc_int(e$N, 0L, min = 0L),
      N_a                   = calc_int(e$N_a, 0L, min = 0L),
      N_b                   = calc_int(e$N_b, 0L, min = 0L),
      sub_a_label           = sub_a_label,
      sub_b_label           = sub_b_label,
      e_facultad            = calc_num(e$e_facultad, 0.05, min = 0.001, max = 0.99),
      p_facultad            = calc_num(e$p_facultad, NA_real_, min = 0, max = 1),
      confianza_facultad    = calc_num(e$confianza_facultad, NA_real_, min = 0.5, max = 0.999),
      z_facultad            = calc_num(e$z_facultad, NA_real_, min = 0.5, max = 5),
      cuota_fija            = calc_int(e$cuota_fija, 0L, min = 0L),
      sobremuestra_fija     = calc_int(e$sobremuestra_fija, 0L, min = 0L),
      aulas_base_fijas      = calc_int(e$aulas_base_fijas, 0L, min = 0L),
      aulas_extra_operativas = calc_int(e$aulas_extra_operativas, 0L, min = 0L),
      promedio_conglomerado = calc_num(e$promedio_conglomerado, 0, min = 0, max = 1000),
      tau                   = calc_num(e$tau, 0, min = 0, max = 1)
    )
  })

  N_total <- sum(vapply(estratos, function(e) e$N, integer(1)))
  parametros <- .cm_normalize_parametros(tpl$parametros, "prob_conglomerado_multietapico")

  # Pasar por normalize para que aplique la inferencia del cuadro maestro
  # (estudiantes + aula_qr + N≥3001 → conglomerados con parámetros canónicos).
  raw <- list(
    actor           = calc_str(tpl$actor, "Estudiantes pregrado"),
    actor_id        = calc_str(tpl$actor_id, "estudiantes"),
    actor_categoria = calc_str(tpl$actor_categoria, "estudiantes"),
    canal_recojo    = calc_str(tpl$canal_recojo, "aula_qr"),
    tecnica         = "prob_conglomerado_multietapico",
    origen_tamano   = calc_enum(tpl$origen_tamano, .CM_ORIGENES_TAMANO, "formula"),
    nivel_respaldo  = calc_enum(tpl$nivel_respaldo, .CM_NIVELES_RESPALDO, "representatividad_estadistica"),
    marco           = list(
      universo_bruto    = as.integer(N_total),
      marco_validado    = as.integer(N_total),
      marco_contactable = as.integer(N_total),
      estado            = "validado",
      notas             = "Marco institucional de referencia 2025-II, 15 facultades.",
      estratos          = estratos
    ),
    parametros      = tpl$parametros,
    meta            = tpl$meta
  )
  componente <- calc_muestra_normalize_componente(raw)

  list(
    preset_id     = preset$id_preset,
    macro_familia = preset$macro_familia,
    componente    = componente
  )
}

# ---------------------------------------------------------------------------
# Decision log — documentado para reporte
# ---------------------------------------------------------------------------

#' Construye el log de decisiones del estudio.
calc_muestra_build_decision_log <- function(estudio) {
  list(
    estudio = list(
      titulo        = estudio$titulo,
      macro_familia = estudio$macro_familia,
      modo_trabajo  = estudio$modo_trabajo,
      modo_sensible = estudio$modo_sensible
    ),
    componentes = lapply(estudio$componentes, function(comp) {
      list(
        actor           = comp$actor,
        tecnica         = comp$tecnica,
        naturaleza      = comp$naturaleza,
        origen_tamano   = comp$origen_tamano,
        nivel_respaldo  = comp$nivel_respaldo,
        marco           = comp$marco,
        decisiones      = .cm_decisiones_componente(comp)
      )
    })
  )
}

.cm_decisiones_componente <- function(comp) {
  d <- list()
  d[[length(d) + 1L]] <- list(
    decision = "Técnica seleccionada",
    valor = comp$tecnica,
    justificacion = .cm_justificacion_tecnica(comp$tecnica)
  )
  d[[length(d) + 1L]] <- list(
    decision = "Origen del tamaño",
    valor = comp$origen_tamano,
    justificacion = .cm_justificacion_origen(comp$origen_tamano)
  )
  d[[length(d) + 1L]] <- list(
    decision = "Nivel de respaldo declarado",
    valor = comp$nivel_respaldo,
    justificacion = .cm_justificacion_respaldo(comp$nivel_respaldo)
  )
  if (identical(comp$tecnica, "prob_conglomerado_multietapico")) {
    d[[length(d) + 1L]] <- list(
      decision = "Efecto de diseño (deff)",
      valor = sprintf("%.2f", comp$parametros$deff),
      justificacion = "Refleja la pérdida de eficiencia esperada por correlación intra-conglomerado."
    )
    d[[length(d) + 1L]] <- list(
      decision = "Tasa de rendimiento (τ)",
      valor = sprintf("%.2f", comp$parametros$tau),
      justificacion = "Producto de asistencia × aceptación × validez histórica."
    )
  }
  d
}

.cm_justificacion_tecnica <- function(t) switch(t,
  prob_conglomerado_multietapico = paste("Diseño probabilístico por conglomerados; permite",
                                          "inferencia bajo supuestos declarados."),
  intencion_censal               = paste("Cobertura del universo elegible vía contacto multi-canal;",
                                          "reporta tasa de respuesta, no margen de error."),
  no_prob_cuotas                 = paste("Control de composición por cuotas; sostiene representatividad",
                                          "teórica/controlada sin probabilidad conocida."),
  listado_externo_meta_fija      = paste("Operación sobre listado entregado por contraparte;",
                                          "meta contractual sin diseño probabilístico propio."),
  paste("Técnica documentada en catálogo:", t)
)

.cm_justificacion_origen <- function(o) switch(o,
  formula                      = "Tamaño derivado de fórmula estadística con marco completo.",
  meta_contractual             = "Tamaño definido por acuerdo con la contraparte.",
  cobertura_esperada           = "Tamaño definido como % del universo a cubrir operativamente.",
  matriz_perfiles_cualitativa  = "Tamaño definido por matriz de perfiles/cuotas criteriales.",
  "Origen no clasificado."
)

.cm_justificacion_respaldo <- function(r) switch(r,
  representatividad_estadistica         = "Selección probabilística con marco completo y probabilidad conocida.",
  representatividad_operacional         = "Cobertura alta del universo contactable o intención censal.",
  representatividad_teorica_controlada  = "Cuotas por variables críticas sin selección aleatoria.",
  cobertura_balanceada                  = "Operación sobre listado o marco con seguimiento de cuotas.",
  evidencia_descriptiva                 = "Resultados describen al grupo respondiente, sin inferencia poblacional.",
  "Sin clasificación de respaldo."
)

# Nota: el cumplimiento de cuotas, las brechas y el cierre de campo son
# parte del módulo de Monitoreo (/monitoreo). Este motor termina su
# alcance en la generación del diseño validado para la propuesta.

# ---------------------------------------------------------------------------
# Memoria de cálculo explicada (/api/calc-muestra/explicar)
# ---------------------------------------------------------------------------

#' Construye la memoria de cálculo de un tamaño muestral con FPC y deff.
#'
#' Envoltorio delgado y sin estado sobre `calc_n_muestra` +
#' `calc_e_desde_n_muestra`: expone cada término intermedio de la fórmula y
#' un decision log en lenguaje llano para la capa didáctica del frontend.
#' No altera ningún cálculo existente; la cifra definitiva que muestra la UI
#' sale de aquí (misma aritmética que `.cm_calc_conglomerado`).
calc_muestra_explicar <- function(input) {
  if (is.null(input) || !is.list(input)) input <- list()

  N <- calc_num(input$N, NA_real_, min = 1)
  if (is.na(N)) {
    stop_api(400, "E_CALC_PARAMS", "Falta N (tamaño del universo, >= 1).")
  }
  p    <- calc_num(input$p, .CM_DEFAULTS_PARAMS$p, min = 0, max = 1)
  e    <- calc_num(input$e, .CM_DEFAULTS_PARAMS$e, min = 0.001, max = 0.5)
  deff <- calc_num(input$deff, .CM_DEFAULTS_PARAMS$deff, min = 1, max = 10)
  oversample_pct <- calc_num(input$oversample_pct, 0, min = 0, max = 2)
  meta_valor <- calc_int(input$meta_valor, 0L, min = 0L)
  promedio_conglomerado <- calc_num(input$promedio_conglomerado, 0, min = 0, max = 1000)
  tau <- calc_num(input$tau, .CM_DEFAULTS_PARAMS$tau, min = 0.01, max = 1)

  # z explícito manda; si no viene, se deriva de la confianza (two-sided).
  z_in <- calc_num(input$z, NA_real_, min = 0.5, max = 5)
  confianza_in <- calc_num(input$confianza, NA_real_, min = 0.5, max = 0.999)
  if (!is.na(z_in)) {
    z_usado <- z_in
    confianza <- 2 * stats::pnorm(z_in) - 1
    fuente_z <- "z provisto directamente"
  } else {
    confianza <- if (is.na(confianza_in)) 0.95 else confianza_in
    z_usado <- stats::qnorm(1 - (1 - confianza) / 2)
    fuente_z <- sprintf("qnorm(1 - (1 - %s) / 2)", format(confianza))
  }

  q <- 1 - p
  numerador <- z_usado^2 * p * q * deff
  n0_sin_fpc <- numerador / e^2
  fpc_denominador <- (N - 1) * e^2 + numerador

  n_bruto   <- calc_n_muestra(N = N, p = p, z = z_usado, e = e, deff = 1)
  n_teorico <- calc_n_muestra(N = N, p = p, z = z_usado, e = e, deff = deff)
  n_objetivo <- if (meta_valor > 0L) as.integer(ceiling(meta_valor)) else as.integer(n_teorico)
  sobremuestra <- as.integer(ceiling(n_objetivo * oversample_pct))
  n_operativo <- as.integer(n_objetivo + sobremuestra)

  precision_alcanzada <- calc_e_desde_n_muestra(
    n = n_objetivo, N = N, p = p, z = z_usado, deff = deff
  )

  # Solo se calcula si hay promedio por conglomerado; la clave se agrega al
  # final únicamente cuando existe (NULL serializa como {} y NA como "NA" con
  # el serializer unboxed de plumber — ninguno es un number|null válido).
  unidades_operativas <- if (promedio_conglomerado > 0) {
    as.integer(ceiling(n_objetivo / (max(promedio_conglomerado, 1) * max(tau, 0.01))))
  } else {
    NULL
  }

  decision_log <- list(
    list(
      paso = "modelo",
      decision = "Fórmula clásica de proporción con corrección por población finita (FPC) y efecto de diseño (deff).",
      motivo = "Es el estándar para encuestas por conglomerados (aulas) sobre un marco conocido de N unidades.",
      fuente = "Compendio metodológico PULSO §2"
    ),
    list(
      paso = "confianza",
      decision = sprintf("Nivel de confianza %.1f%% → z = %.4f.", confianza * 100, z_usado),
      motivo = paste("El z es el número de desviaciones estándar que cubre ese nivel de",
                     "confianza en la curva normal.", fuente_z),
      fuente = "Compendio metodológico PULSO §2"
    ),
    list(
      paso = "p",
      decision = sprintf("Proporción esperada p = %s (q = %s).", format(p), format(q)),
      motivo = if (p == 0.5) {
        "p = 0.5 es el escenario más exigente: maximiza la varianza p·q y por lo tanto el tamaño requerido."
      } else {
        "p calibrado con evidencia previa; reduce el n frente al escenario conservador p = 0.5."
      },
      fuente = "Estudios de referencia en universidades peruanas (2024-2026)"
    ),
    list(
      paso = "deff",
      decision = sprintf("Efecto de diseño deff = %s (n pasa de %d a %d).", format(deff), n_bruto, n_teorico),
      motivo = paste("Encuestar por aulas agrupa a estudiantes que se parecen entre sí;",
                     "el deff compensa esa pérdida de información aumentando el n."),
      fuente = "Estudios de referencia en universidades peruanas (2024-2026)"
    ),
    list(
      paso = "fpc",
      decision = sprintf("Corrección por población finita con N = %s.", format(N, big.mark = ",")),
      motivo = "Cuando la muestra es una fracción apreciable del universo, el n necesario baja.",
      fuente = "Compendio metodológico PULSO §2"
    )
  )
  if (meta_valor > 0L) {
    decision_log[[length(decision_log) + 1L]] <- list(
      paso = "objetivo",
      decision = sprintf("n objetivo fijado en %d por meta declarada (teórico: %d).", n_objetivo, n_teorico),
      motivo = "Existe una meta contractual u operativa que manda sobre el tamaño teórico.",
      fuente = "Configuración del estudio"
    )
  }
  if (sobremuestra > 0L) {
    decision_log[[length(decision_log) + 1L]] <- list(
      paso = "sobremuestra",
      decision = sprintf("Sobremuestra de %.0f%% → +%d casos (operativo: %d).",
                         oversample_pct * 100, sobremuestra, n_operativo),
      motivo = paste("Cubre ausencias, cuestionarios incompletos y aulas que rinden menos de lo",
                     "previsto sin sacrificar la precisión objetivo."),
      fuente = "Estudios de referencia en universidades peruanas (2024-2026)"
    )
  }
  decision_log[[length(decision_log) + 1L]] <- list(
    paso = "retrocalculo",
    decision = sprintf("Con n = %d el margen de error real es ±%.2f%% (objetivo: ±%.2f%%).",
                       n_objetivo, precision_alcanzada * 100, e * 100),
    motivo = "Verificación inversa: se despeja e de la misma fórmula para confirmar que el n elegido cumple.",
    fuente = "Compendio metodológico PULSO §2"
  )

  memoria <- list(
    modelo = "cochran_fpc_deff",
    parametros = list(
      confianza = confianza,
      z_usado   = z_usado,
      p         = p,
      q         = q,
      e         = e,
      deff      = deff,
      N         = N,
      oversample_pct = oversample_pct
    ),
    terminos = list(
      numerador       = numerador,
      n0_sin_fpc      = n0_sin_fpc,
      fpc_denominador = fpc_denominador,
      n_sin_deff      = as.integer(n_bruto)
    ),
    n_teorico    = as.integer(n_teorico),
    n_objetivo   = n_objetivo,
    n_operativo  = n_operativo,
    sobremuestra = sobremuestra,
    retrocalculo = list(
      precision_alcanzada = precision_alcanzada,
      e_objetivo          = e,
      cumple              = isTRUE(precision_alcanzada <= e + 1e-9)
    ),
    decision_log = decision_log,
    fuentes = list(
      "Compendio metodológico PULSO §2 (fórmula clásica con FPC y deff)",
      "Metodología de estudios HST en universidades peruanas (2024-2026)"
    )
  )
  if (!is.null(unidades_operativas)) {
    memoria$unidades_operativas <- unidades_operativas
  }
  memoria
}

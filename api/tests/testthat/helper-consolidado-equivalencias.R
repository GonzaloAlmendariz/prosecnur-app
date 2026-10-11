# =============================================================================
# Fixture sintético del informe compartido sembrado desde la matriz (ADR 0096)
# =============================================================================
#
# Tres públicos `independent_siblings` —docentes, estudiantes, administrativos—
# con las MISMAS etiquetas de pregunta entre públicos. Es a propósito: la
# heurística retirada por el ADR 0096 emparejaba variables de bases distintas
# por etiqueta normalizada + firma de escala, y con etiquetas idénticas la
# heurística siempre encuentra «pares». Si con este fixture y sin matriz sale
# una lámina que compare dos bases, la heurística sigue viva.
#
# Por defecto sólo dos públicos tienen release aprobada (docentes y
# estudiantes); administrativos queda sin aprobar para fijar que una base sin
# release no aparece en lo propuesto (ADR 0096 decisión 2).
#
# Sin datos de cliente: todo se fabrica aquí. Los nombres llevan prefijo
# `.hce_` porque testthat carga los helper-*.R para TODOS los archivos.

.HCE_BASES <- c(docentes = "Docentes", estudiantes = "Estudiantes", administrativos = "Administrativos")
.HCE_PREFIJO <- c(docentes = "p", estudiantes = "q", administrativos = "r")

.hce_archivo <- function(s, base, kind) {
  file_id <- paste(base, kind, sep = "-")
  path <- file.path(s$dir, "uploads", paste0(file_id, ".xlsx"))
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)
  writeBin(charToRaw(paste(base, kind, sep = "\r")), path)
  s$files[[file_id]] <- list(
    file_id = file_id, kind = kind, original_name = basename(path),
    path = path, size = file.info(path)$size, ext = "xlsx"
  )
  list(state = s, file_id = file_id)
}

# Escala Likert de 4 puntos. `variante`:
#   - "igual":  la canónica;
#   - "caja":   mismas opciones con otra caja/espacios (NO es otra escala);
#   - "codigo": mismos rótulos con códigos «01», «02»… (SÍ es otra escala).
.hce_likert <- function(variante = "igual") {
  codigos <- c("1", "2", "3", "4")
  etiquetas <- c("Muy en desacuerdo", "En desacuerdo", "De acuerdo", "Muy de acuerdo")
  if (identical(variante, "caja")) {
    etiquetas <- c("Muy En Desacuerdo", "EN DESACUERDO", "De  Acuerdo", "Muy de Acuerdo")
  } else if (identical(variante, "codigo")) {
    codigos <- c("01", "02", "03", "04")
  }
  list(codigos = codigos, etiquetas = etiquetas)
}

.hce_instrumento <- function(base, likert) {
  pre <- .HCE_PREFIJO[[base]]
  lk <- paste0("likert_", base)
  sn <- paste0("si_no_", base)
  list(
    survey = data.frame(
      type = c(paste("select_one", lk), paste("select_one", sn)),
      type_base = c("select_one", "select_one"),
      name = paste0(pre, c("_sat", "_con")),
      # Etiquetas IDÉNTICAS entre públicos: el cebo de la heurística retirada.
      label = c("Satisfaccion con el servicio", "Conoce el servicio"),
      list_name = c(lk, sn),
      section = c("Servicios", "Servicios"),
      stringsAsFactors = FALSE, check.names = FALSE
    ),
    choices = data.frame(
      list_name = c(rep(lk, 4), rep(sn, 2)),
      name = c(likert$codigos, "1", "2"),
      label = c(likert$etiquetas, "Si", "No"),
      stringsAsFactors = FALSE, check.names = FALSE
    )
  )
}

#' Sesión `independent_siblings` de tres públicos.
#'
#' @param aprobadas bases cuya release queda aprobada y vigente.
#' @param variante_estudiantes variante de la Likert de estudiantes (ver `.hce_likert`).
#' @noRd
.hce_setup <- function(aprobadas = c("docentes", "estudiantes"),
                       variante_estudiantes = "igual") {
  sid <- session_create()
  s <- session_get(sid)
  s$monitoreo_config <- list(monitoreo_profile = list(family = "acreditacion"))
  s$estudio <- list(
    nombre = "ESTUDIO_SINTETICO",
    processing_mode = "independent_siblings",
    sibling_family_id = "family-sintetica",
    active_base = "docentes",
    bases = list()
  )
  s$files <- list()
  s$rp_data_sources <- list()
  s$rp_inst_sources <- list()
  s$codif_por_base <- list()
  s$analitica_config_por_base <- list()
  s$analitica_status_por_base <- list()
  for (base in names(.HCE_BASES)) {
    data_file <- .hce_archivo(s, base, "data_adaptada")
    s <- data_file$state
    inst_file <- .hce_archivo(s, base, "instrumento_adaptado")
    s <- inst_file$state
    likert <- .hce_likert(if (identical(base, "estudiantes")) variante_estudiantes else "igual")
    inst <- .hce_instrumento(base, likert)
    pre <- .HCE_PREFIJO[[base]]
    dat <- data.frame(
      sat = likert$codigos[c(1, 2, 3, 4, 4)],
      con = c("1", "2", "1", "1", "2"),
      response_id = paste0(base, "-", seq_len(5)),
      stringsAsFactors = FALSE
    )
    names(dat)[1:2] <- paste0(pre, c("_sat", "_con"))
    s$rp_data_sources[[base]] <- dat
    s$rp_inst_sources[[base]] <- inst
    s$estudio$bases[[base]] <- list(
      nombre = base,
      data_file_id = data_file$file_id,
      xlsform_file_id = inst_file$file_id,
      n_filas = nrow(dat),
      source_alias = .HCE_BASES[[base]],
      source_title = .HCE_BASES[[base]],
      project_kind = "acreditacion",
      profile_family = "acreditacion",
      processing_intake_entry_id = paste0("entry-", base),
      sibling_family_id = "family-sintetica",
      instrument_revision_id = paste0("revision-", base),
      batch_fingerprint = "batch-1",
      response_filter = list(
        source = "persisted_case_rollup", counts_in_advance = TRUE,
        platform_state = "Completa", advancement = "effective",
        selected_rows = nrow(dat)
      ),
      traceability = list(
        snapshot_synced_at = "2026-07-20T10:00:00Z",
        snapshot_hash = paste(rep("b", 64), collapse = ""),
        cache_token_sha256 = paste(rep("c", 64), collapse = ""),
        selection_sha256 = paste(rep("d", 64), collapse = "")
      ),
      variables_extra_checksum = paste(rep("a", 64), collapse = ""),
      variables_extra_incluidas = list(),
      validacion = list(
        plan_result = list(plan = data.frame(rule = "required")),
        evaluacion = list(resumen = data.frame(rule = "required", n = 0L)),
        limpieza_draft = list(),
        limpieza_preview = list(data_final = dat, impact = list(cells_changed = 0L)),
        limpieza_artifacts = list(finalized_at = "2026-07-20T10:00:00Z")
      )
    )
    s$codif_por_base[[base]] <- list(aplicado = TRUE, familias_generated = TRUE)
    s$analitica_config_por_base[[base]] <- list(
      fuente_preferida = "adaptados", ponderacion = list(enabled = FALSE)
    )
    s$analitica_status_por_base[[base]] <- list(
      analitica_prep_ok = TRUE, analitica_frecuencias_ok = TRUE, analitica_cruces_ok = TRUE
    )
  }
  s$rp_data <- s$rp_data_sources$docentes
  s$rp_inst <- s$rp_inst_sources$docentes
  s$analitica_prep_ok <- TRUE
  s$analitica_frecuencias_ok <- TRUE
  s$analitica_cruces_ok <- TRUE
  .session_env[[sid]] <- s
  for (entry in processing_release_get(sid)$entries) {
    if (entry$base %in% aprobadas) {
      processing_release_approve(sid, entry$base, entry$input_fingerprint)
    }
  }
  sid
}

.hce_fila <- function(etiqueta, diapositiva, variables, ...) {
  c(list(etiqueta_estandar = etiqueta, diapositiva = diapositiva, variables = variables), list(...))
}

# Matriz canónica del fixture:
#   1. tres públicos declarados (con administrativos sin release → cobertura reducida 3 → 2);
#   2. docentes + administrativos (sólo queda uno con release → `fuera`, release_no_aprobada);
#   3. docentes + estudiantes, ambos con release.
.hce_filas_estandar <- function() {
  list(
    .hce_fila("Satisfaccion", "1",
              list(docentes = "p_sat", estudiantes = "q_sat", administrativos = "r_sat")),
    .hce_fila("Conoce (doc-adm)", "2",
              list(docentes = "p_con", administrativos = "r_con")),
    .hce_fila("Conoce (doc-est)", "3",
              list(docentes = "p_con", estudiantes = "q_con"))
  )
}

.hce_declarar <- function(sid, filas = .hce_filas_estandar(), ...) {
  session_set(sid, "equivalencias_publicos", c(list(
    schema = "equivalencias_publicos/v1",
    bases = names(.HCE_BASES),
    filas = filas,
    n_filas = length(filas)
  ), list(...)))
  invisible(sid)
}

# Propuesta del informe compartido por la misma entrada que usa el router
# (contrato congelado: `.graficos_plan_sugerido_por_fuente(sid, config, scope)`).
.hce_sugerido <- function(sid, config = list(), scope = "consolidado") {
  .graficos_plan_sugerido_por_fuente(sid, config = config, scope = scope)
}

# Referencias `base$variable` de un plan, recorriendo bloques de `multilista`.
.hce_refs_de_args <- function(args) {
  if (identical(as.character(args$modo %||% ""), "multilista")) {
    return(unlist(lapply(args$bloques %||% list(), .hce_refs_de_args), use.names = FALSE))
  }
  .graficos_collect_refs_from_args(args)
}

.hce_refs_por_lamina <- function(plan) {
  lapply((plan %||% list())$slides %||% list(), function(slide) {
    payload <- (slide %||% list())$payload %||% list()
    unique(unlist(lapply(payload, function(item) {
      if (!is.list(item) || is.null(item$graficador)) return(character(0))
      .hce_refs_de_args(item$args %||% list())
    }), use.names = FALSE))
  })
}

.hce_refs_plan <- function(plan) unique(unlist(.hce_refs_por_lamina(plan), use.names = FALSE))

# Láminas cuyas referencias tocan dos o más bases: lo que la heurística fabricaba.
.hce_laminas_multifuente <- function(plan) {
  por_lamina <- .hce_refs_por_lamina(plan)
  Filter(function(refs) {
    bases <- unique(sub("\\$.*$", "", refs[grepl("$", refs, fixed = TRUE)]))
    length(bases) >= 2L
  }, por_lamina)
}

# Proyección comparable de un plan: los ids son aleatorios (`.graficos_plan_slide_id`),
# lo que tiene que coincidir es qué se grafica, cómo y de dónde viene.
.hce_proyeccion_plan <- function(plan) {
  lapply((plan %||% list())$slides %||% list(), function(slide) {
    payload <- (slide %||% list())$payload %||% list()
    graf <- Filter(function(item) is.list(item) && !is.null(item$graficador), payload)
    list(
      tipo = as.character(slide$tipo %||% ""),
      origen = as.character(slide$origen %||% ""),
      titulo = as.character(payload$titulo %||% ""),
      graficos = unname(lapply(graf, function(g) list(
        graficador = as.character(g$graficador),
        modo = as.character((g$args %||% list())$modo %||% ""),
        refs = sort(.hce_refs_de_args(g$args %||% list()))
      )))
    )
  })
}

.hce_bloqueos_escala <- function(preflight) {
  Filter(function(b) identical(b$code, "incompatible_comparison_scale"), preflight$blockers %||% list())
}

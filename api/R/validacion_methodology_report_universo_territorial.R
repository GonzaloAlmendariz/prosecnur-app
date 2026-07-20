# =============================================================================
# Preparacion del universo — embudo territorial
# =============================================================================
#
# Extension minima e independiente del reporte metodologico de validacion
# (`validacion_methodology_report.R`). El modelo por defecto asume una unica
# variable real/prueba mas exclusiones simples; esto no expresa bien un embudo
# de varias etapas heterogeneas con etiquetas a medida (piloto, control de
# calidad de campo, casos no defendibles con subcriterios) como el que necesita
# el monitoreo territorial.
#
# Cuando `upstream_universe` declara `territorial = TRUE` (o trae `stages`), el
# engine delega en `vmr_territorial_universe_model()` y las funciones de render
# del PDF/.R toman las ramas territoriales. El comportamiento existente (p. ej.
# el reporte de PDM) no cambia: sin `territorial`/`stages` nunca se entra aqui.
#
# Forma esperada del universo territorial:
#   list(
#     applied = TRUE, territorial = TRUE,
#     total = 1732L, included = 1283L,
#     source_label = "sincronizados desde Kobo",
#     stage_variable = "etapa_exclusion",   # columna de la base auditada
#     keep_value = "incluido",              # valor conservado de esa columna
#     stages = list(list(
#       id = "piloto", label = "...", excluded = 39L, remaining = 1693L,
#       match_values = "excluido_piloto", subcriteria = c("...")
#     ), ...),
#     included_breakdown = list(list(label = "Validadas", count = 1028L), ...),
#     duplicates_count = 0L,
#     field_window_label = "mayo a 3 de julio de 2026"
#   )

.vmr_terr_int <- function(value, fallback = 0L) {
  out <- suppressWarnings(as.integer(value %||% fallback))[1L]
  if (is.na(out)) as.integer(fallback) else out
}

.vmr_terr_chr <- function(value, default = "") .vmr_text(value, default)

.vmr_terr_values <- function(x) {
  out <- as.character(unlist(x %||% character(0), use.names = FALSE))
  unique(out[!is.na(out) & nzchar(out)])
}

.vmr_terr_fmt <- function(value) .vmr_script_count(value, "-")

# --- Normalizacion de etapas -------------------------------------------------
.vmr_territorial_stages <- function(universe) {
  stages_raw <- universe$stages %||% list()
  if (is.data.frame(stages_raw)) {
    stages_raw <- lapply(seq_len(nrow(stages_raw)), function(i) as.list(stages_raw[i, , drop = FALSE]))
  }
  stages_raw <- Filter(is.list, stages_raw)
  running <- .vmr_terr_int(universe$total, 0L)
  out <- lapply(seq_along(stages_raw), function(i) {
    item <- stages_raw[[i]]
    excluded <- .vmr_terr_int(item$excluded, 0L)
    running <<- running - excluded
    remaining <- if (!is.null(item$remaining)) .vmr_terr_int(item$remaining, running) else running
    list(
      id = .vmr_terr_chr(item$id %||% paste0("stage_", i)),
      label = .vmr_terr_chr(item$label %||% paste0("Etapa ", i)),
      excluded = excluded,
      remaining = remaining,
      short_label = .vmr_terr_chr(item$short_label %||% item$label %||% paste0("Etapa ", i)),
      match_values = .vmr_terr_values(item$match_values),
      subcriteria = as.character(item$subcriteria %||% character(0))
    )
  })
  out
}

# --- Formula R reproducible ---------------------------------------------------
# Reproduce el embudo desde la base auditada de estados (una columna con la
# etapa de exclusion por caso). Termina asignando `base_validacion`.
vmr_territorial_universe_formula <- function(universe) {
  stages <- universe$stages %||% list()
  stage_variable <- .vmr_terr_chr(universe$stage_variable %||% "etapa_exclusion")
  keep_value <- .vmr_terr_chr(universe$keep_value %||% "incluido")
  if (!length(stages) || !nzchar(stage_variable)) return("")
  literal <- function(x) paste(deparse(x, width.cutoff = 500L), collapse = "\n")
  header <- c(
    "# Embudo de preparacion del universo sobre la base auditada de estados.",
    paste0("# Cada caso trae su etapa de exclusion en la columna '", stage_variable, "';"),
    paste0("# se conservan unicamente los registros con etapa '", keep_value, "'."),
    paste0(".stage_variable <- ", literal(stage_variable)),
    "if (!(.stage_variable %in% names(data))) {",
    "  stop(",
    "    sprintf(\"Falta la columna '%s' para reproducir el embudo del universo.\", .stage_variable),",
    "    call. = FALSE",
    "  )",
    "}",
    ".stage_values <- as.character(data[[.stage_variable]])",
    ".filter_keep <- rep(TRUE, length(.stage_values))",
    ""
  )
  stage_blocks <- unlist(lapply(seq_along(stages), function(i) {
    item <- stages[[i]]
    values <- .vmr_terr_values(item$match_values)
    if (!length(values)) return(character(0))
    match_name <- paste0(".stage_exclude_", i)
    c(
      paste0("# Etapa ", i, " — ", .vmr_terr_chr(item$label)),
      paste0(match_name, " <- .stage_values %in% ", literal(values)),
      paste0(".filter_keep <- .filter_keep & !", match_name),
      ""
    )
  }), use.names = FALSE)
  tail <- c(
    "# Verificacion de cuadre: los conservados deben tener la etapa de inclusion.",
    paste0(".filter_keep <- .filter_keep & .stage_values %in% ", literal(keep_value)),
    "base_validacion <- data[.filter_keep, , drop = FALSE]"
  )
  paste(c(header, stage_blocks, tail), collapse = "\n")
}

# --- Franja del embudo (pagina 2) --------------------------------------------
vmr_territorial_universe_funnel <- function(universe) {
  stages <- universe$stages %||% list()
  labels <- c(
    .vmr_terr_chr(universe$total_label %||% "Registros sincronizados"),
    vapply(stages, function(s) .vmr_terr_chr(s$short_label), character(1)),
    .vmr_terr_chr(universe$included_label %||% "Base valida final")
  )
  values <- c(
    .vmr_terr_int(universe$total, NA_integer_),
    vapply(stages, function(s) .vmr_terr_int(s$excluded, 0L), integer(1)),
    .vmr_terr_int(universe$included, NA_integer_)
  )
  list(labels = labels, values = values)
}

# --- Narrativa (pagina 3 del PDF) --------------------------------------------
vmr_territorial_universe_criterion <- function(universe) {
  stages <- universe$stages %||% list()
  total <- .vmr_terr_fmt(universe$total)
  source_label <- .vmr_terr_chr(universe$source_label %||% "sincronizados")
  stage_clauses <- vapply(stages, function(s) {
    excl <- .vmr_terr_fmt(s$excluded)
    rem <- .vmr_terr_fmt(s$remaining)
    detail <- if (length(s$subcriteria)) {
      paste0(" (", paste(s$subcriteria, collapse = "; "), ")")
    } else ""
    sprintf("%s %s%s, quedando %s", excl, .vmr_lower_first(.vmr_terr_chr(s$label)), detail, rem)
  }, character(1))
  intro <- sprintf(
    "De %s registros %s se retiraron, por etapas: %s.",
    total, source_label, paste(stage_clauses, collapse = "; ")
  )
  breakdown <- universe$included_breakdown %||% list()
  breakdown_txt <- if (length(breakdown)) {
    parts <- vapply(breakdown, function(b) {
      sprintf("%s %s", .vmr_terr_fmt(b$count), .vmr_lower_first(.vmr_terr_chr(b$label)))
    }, character(1))
    sprintf(" La base final de casos válidos reúne %s registros (%s).",
            .vmr_terr_fmt(universe$included), paste(parts, collapse = " y "))
  } else {
    sprintf(" La base final de casos válidos reúne %s registros.", .vmr_terr_fmt(universe$included))
  }
  dup <- .vmr_terr_int(universe$duplicates_count, NA_integer_)
  dup_txt <- if (!is.na(dup)) {
    if (dup == 0L) " No se detectaron duplicados." else sprintf(" Se detectaron %s duplicados.", .vmr_terr_fmt(dup))
  } else ""
  field_txt <- if (nzchar(.vmr_terr_chr(universe$field_window_label))) {
    sprintf(" El trabajo de campo se realizó de %s.", .vmr_terr_chr(universe$field_window_label))
  } else ""
  paste0(intro, breakdown_txt, dup_txt, field_txt)
}

.vmr_lower_first <- function(x) {
  x <- .vmr_terr_chr(x)
  if (!nzchar(x)) return(x)
  paste0(tolower(substring(x, 1L, 1L)), substring(x, 2L))
}

# --- Frases para el .R (comentarios) -----------------------------------------
vmr_territorial_universe_sentences <- function(universe) {
  stages <- universe$stages %||% list()
  lines <- vapply(stages, function(s) {
    detail <- if (length(s$subcriteria)) {
      paste0(" (", paste(s$subcriteria, collapse = "; "), ")")
    } else ""
    sprintf("Se retiraron %s registros: %s%s; quedaron %s.",
            .vmr_terr_fmt(s$excluded), .vmr_lower_first(.vmr_terr_chr(s$label)),
            detail, .vmr_terr_fmt(s$remaining))
  }, character(1))
  breakdown <- universe$included_breakdown %||% list()
  if (length(breakdown)) {
    parts <- vapply(breakdown, function(b) {
      sprintf("%s %s", .vmr_terr_fmt(b$count), .vmr_lower_first(.vmr_terr_chr(b$label)))
    }, character(1))
    lines <- c(lines, sprintf("Base final: %s registros validos (%s).",
                              .vmr_terr_fmt(universe$included), paste(parts, collapse = "; ")))
  }
  dup <- .vmr_terr_int(universe$duplicates_count, NA_integer_)
  if (!is.na(dup)) lines <- c(lines, if (dup == 0L) "No se detectaron duplicados." else sprintf("Duplicados detectados: %s.", .vmr_terr_fmt(dup)))
  if (nzchar(.vmr_terr_chr(universe$field_window_label))) {
    lines <- c(lines, sprintf("Trabajo de campo: %s.", .vmr_terr_chr(universe$field_window_label)))
  }
  lines
}

# --- Lineas de resumen para el encabezado del .R -----------------------------
vmr_territorial_universe_summary_lines <- function(universe) {
  stages <- universe$stages %||% list()
  lines <- c(paste0("# Registros sincronizados: ", .vmr_terr_fmt(universe$total)))
  for (s in stages) {
    lines <- c(lines, paste0("# (-) ", .vmr_terr_chr(s$label), ": ", .vmr_terr_fmt(s$excluded),
                             "  ->  ", .vmr_terr_fmt(s$remaining)))
  }
  lines <- c(lines, paste0("# = Base final de casos validos: ", .vmr_terr_fmt(universe$included)),
             "#", "# Preparacion del universo")
  sentences <- vmr_territorial_universe_sentences(universe)
  c(lines, unlist(lapply(sentences, .vmr_script_comment), use.names = FALSE))
}

# --- Reconciliacion plan (N) -> presentadas (M) ------------------------------
# Frase agregada, sin enumerar regla por regla (enumerarlas re-expondria la
# maquinaria de duracion que el cliente pidio no mostrar). Devuelve "" cuando
# todas las reglas del plan se presentan.
vmr_territorial_reconciliation_text <- function(plan_total, presented_total) {
  plan_total <- .vmr_terr_int(plan_total, 0L)
  presented_total <- .vmr_terr_int(presented_total, 0L)
  unpresented <- plan_total - presented_total
  if (unpresented <= 0L) return("")
  sprintf(
    paste0(
      "El plan derivó %s reglas del instrumento; %s aplican a la base final de análisis. ",
      "Las %s restantes no se evalúan porque sus variables no se materializan en esa base ",
      "(verificaciones de tiempos/duración, variables derivadas y el resumen de una pregunta ",
      "de opción múltiple cuyas categorías sí se validan de forma individual)."
    ),
    .vmr_terr_fmt(plan_total), .vmr_terr_fmt(presented_total), .vmr_terr_fmt(unpresented)
  )
}

# --- Modelo territorial (idempotente) ----------------------------------------
vmr_territorial_universe_model <- function(universe) {
  universe$applied <- TRUE
  universe$territorial <- TRUE
  universe$total <- .vmr_terr_int(universe$total, NA_integer_)
  universe$included <- .vmr_terr_int(universe$included, NA_integer_)
  universe$stages <- .vmr_territorial_stages(universe)
  # Campos de compatibilidad con el render por defecto (nunca usados en la rama
  # territorial, pero mantienen inertes las lecturas legacy).
  universe$corrections <- list()
  universe$exclusion_rules <- list()
  universe$corrected <- 0L
  universe$correction_changes <- 0L
  universe$excluded_test <- 0L
  universe$excluded_rules <- sum(vapply(universe$stages, function(s) .vmr_terr_int(s$excluded, 0L), integer(1)))
  universe$excluded_rejections <- 0L
  # Campos de render territorial.
  funnel <- vmr_territorial_universe_funnel(universe)
  universe$funnel_labels <- funnel$labels
  universe$funnel_values <- funnel$values
  universe$criterion_text <- vmr_territorial_universe_criterion(universe)
  universe$preparation_sentences <- vmr_territorial_universe_sentences(universe)
  universe$summary_comment_lines <- vmr_territorial_universe_summary_lines(universe)
  universe$formula_r <- vmr_territorial_universe_formula(universe)
  universe$formula_available <- nzchar(universe$formula_r)
  universe
}

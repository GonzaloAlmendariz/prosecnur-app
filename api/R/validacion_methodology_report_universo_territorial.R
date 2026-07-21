# =============================================================================
# Preparacion del universo — embudo territorial
# =============================================================================
#
# Extension minima e independiente del reporte metodologico de validacion
# (`validacion_methodology_report.R`). El modelo por defecto asume una unica
# variable real/prueba mas exclusiones simples; esto no expresa bien un embudo
# de varias etapas heterogeneas con etiquetas a medida (piloto, control de
# calidad de campo, exclusiones por criterios de validez con subcriterios) como el que necesita
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
#     included_breakdown = list(list(label = "...", count = 0L), ...),  # opcional
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
    sprintf(" La base final reúne %s casos válidos (%s).",
            .vmr_terr_fmt(universe$included), paste(parts, collapse = " y "))
  } else {
    sprintf(" La base final reúne %s casos válidos.", .vmr_terr_fmt(universe$included))
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
      "de opción múltiple cuyas categorías sí se validan de forma individual). ",
      "Nota: para las preguntas obligatorias con lógica de salto, la comprobación de completitud ",
      "y la de salto se cuentan en ambas familias; por eso el total por familia no representa ",
      "verificaciones mutuamente excluyentes."
    ),
    .vmr_terr_fmt(plan_total), .vmr_terr_fmt(presented_total), .vmr_terr_fmt(unpresented)
  )
}

# --- Bloque main autonomo para el .R exportado -------------------------------
# El .R por defecto termina con una receta COMENTADA de una sola base. El caso
# territorial tiene dos vistas distintas (estados auditados con la etapa de
# exclusion vs. base final con las variables del instrumento), por lo que su
# receta de una sola base no corre de punta a punta. Este helper emite, en su
# lugar, un bloque `main` ACTIVO y autonomo (base R + a lo sumo readxl) que:
#   1. lee la base auditada de estados y reproduce el embudo del universo,
#   2. lee la base final de analisis y corre las 80 reglas,
#   3. cuadra el "incluido" del embudo con la base final y escribe los CSV.
# Solo se usa en la rama territorial; la rama por defecto (PDM) conserva su
# receta comentada intacta.
vmr_territorial_runner_block <- function(universe, script_name = NULL) {
  audit_file <- .vmr_terr_chr(universe$audit_base_file %||% "base_auditada_estados.csv")
  analysis_file <- .vmr_terr_chr(universe$analysis_base_file %||% "base_final_analisis.csv")
  stage_variable <- .vmr_terr_chr(universe$stage_variable %||% "etapa_exclusion")
  key_column <- .vmr_terr_chr(universe$key_column %||% "")
  total <- .vmr_terr_fmt(universe$total)
  included <- .vmr_terr_fmt(universe$included)
  script_label <- if (!is.null(script_name) && nzchar(script_name)) script_name else "este_script.R"
  q <- function(x) paste0("'", x, "'")
  c(
    "# =============================================================================",
    "# EJECUCION AUTONOMA — reproduce la misma base y las mismas reglas sin la app",
    "# =============================================================================",
    "# Este bloque corre en R base (a lo sumo readxl para Excel); no necesita el",
    "# paquete de la aplicacion. Reproduce, a partir de dos insumos que viajan",
    "# junto a este script, exactamente la base final de analisis y sus reglas:",
    "#",
    paste0("#   1) EMBUDO DEL UNIVERSO (", total, " -> ", included, ")"),
    paste0("#      Insumo: '", audit_file, "' — una fila por registro sincronizado,"),
    paste0("#      con su etapa de exclusion en la columna '", stage_variable, "'."),
    "#      prepare_validation_universe() aplica el embudo y conserva los 'incluido'.",
    "#",
    paste0("#   2) LAS REGLAS SOBRE LA BASE FINAL (", included, ")"),
    paste0("#      Insumo: '", analysis_file, "' — las ", included, " encuestas validas con"),
    "#      las variables del instrumento. validate_data() corre las reglas.",
    "#",
    "# Como correrlo (desde una terminal, parado en la carpeta del script):",
    paste0("#   Rscript ", script_label),
    "# O indicando rutas explicitas (estados, base final, carpeta de salida):",
    paste0("#   Rscript ", script_label, " ", audit_file, " ", analysis_file, " resultados_validacion"),
    "#",
    paste0("# Resultado esperado: embudo ", total, " -> ", included, " impreso, base final de"),
    paste0("# ", included, " filas, las reglas evaluadas y los CSV de resultados en la salida."),
    "# =============================================================================",
    "",
    "if (sys.nframe() == 0L) {",
    "  .script_dir <- tryCatch({",
    "    .args <- commandArgs(trailingOnly = FALSE)",
    "    .file_arg <- sub('^--file=', '', .args[grepl('^--file=', .args)])",
    "    if (length(.file_arg)) dirname(normalizePath(.file_arg)) else getwd()",
    "  }, error = function(e) getwd())",
    "  .cli <- commandArgs(trailingOnly = TRUE)",
    paste0("  .audit_path <- if (length(.cli) >= 1L) .cli[[1L]] else file.path(.script_dir, ", q(audit_file), ")"),
    paste0("  .analysis_path <- if (length(.cli) >= 2L) .cli[[2L]] else file.path(.script_dir, ", q(analysis_file), ")"),
    "  .out_dir <- if (length(.cli) >= 3L) .cli[[3L]] else file.path(.script_dir, 'resultados_validacion')",
    "",
    "  # 1) Embudo del universo sobre la base auditada de estados.",
    "  .base_estados <- read_validation_data(.audit_path)",
    "  cat(sprintf('Base auditada de estados: %d filas\\n', nrow(.base_estados)))",
    paste0("  .stage_col <- ", q(stage_variable)),
    "  if (.stage_col %in% names(.base_estados)) {",
    "    cat('Conteo por etapa de exclusion:\\n')",
    "    print(table(.base_estados[[.stage_col]], useNA = 'ifany'))",
    "  }",
    "  .base_incluida <- prepare_validation_universe(.base_estados)",
    "  cat(sprintf('Embudo del universo: %d -> %d (se conservan los incluido)\\n',",
    "              nrow(.base_estados), nrow(.base_incluida)))",
    "",
    "  # 2) Reglas sobre la base final de analisis (variables del instrumento).",
    "  .base_final <- read_validation_data(.analysis_path)",
    "  cat(sprintf('Base final de analisis: %d filas\\n', nrow(.base_final)))",
    "",
    paste0("  .key_column <- ", q(key_column)),
    "  # Cuadre por IDENTIDAD cuando ambas bases comparten la llave: los registros",
    "  # 'incluido' del embudo deben ser exactamente los de la base final. Sin",
    "  # llave comun, se verifica solo la cantidad de registros.",
    "  if (nzchar(.key_column) && .key_column %in% names(.base_incluida) && .key_column %in% names(.base_final)) {",
    "    .keep_keys <- as.character(.base_incluida[[.key_column]])",
    "    .final_keys <- as.character(.base_final[[.key_column]])",
    "    .faltan <- setdiff(.keep_keys, .final_keys)",
    "    .sobran <- setdiff(.final_keys, .keep_keys)",
    "    if (length(.faltan) == 0L && length(.sobran) == 0L) {",
    "      cat(sprintf('Cuadre por identidad OK: los %d registros conservados son exactamente los %d de la base final.\\n',",
    "                  length(.keep_keys), length(.final_keys)))",
    "    } else {",
    "      warning(sprintf('Descuadre por identidad: %d solo en el embudo, %d solo en la base final.',",
    "                      length(.faltan), length(.sobran)), call. = FALSE)",
    "    }",
    "  } else if (nrow(.base_incluida) != nrow(.base_final)) {",
    "    warning(sprintf('El embudo conserva %d registros pero la base final tiene %d.',",
    "                    nrow(.base_incluida), nrow(.base_final)), call. = FALSE)",
    "  } else {",
    "    cat(sprintf('Cuadre por cantidad OK: %d registros conservados = %d filas de la base final.\\n',",
    "                nrow(.base_incluida), nrow(.base_final)))",
    "  }",
    "",
    "  .resultado <- validate_data(.base_final, output_dir = .out_dir)",
    "  .res <- .resultado$resumen_reglas",
    "  cat(sprintf('Reglas en el resumen: %d\\n', nrow(.res)))",
    "  cat(sprintf('Reglas evaluadas: %d\\n', sum(.res$estado == 'evaluada', na.rm = TRUE)))",
    "  cat(sprintf('Casos encontrados (total): %d\\n', sum(.res$casos_encontrados, na.rm = TRUE)))",
    "  cat(sprintf('Reglas con al menos un caso: %d\\n', sum(.res$casos_encontrados > 0, na.rm = TRUE)))",
    "  cat(sprintf('CSV de resultados escritos en: %s\\n', .out_dir))",
    "}"
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

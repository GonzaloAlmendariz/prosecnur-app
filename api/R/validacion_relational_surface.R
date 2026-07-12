# =============================================================================
# Surfacing del plan relacional (Fase 4, familia "coherencia relacional del
# repeat" RC1-RC5 + requires_external_dataset)
#
# El plan de validación se presenta POR BASE, pero madre + hija son UN
# instrumento con una tabla relacionada. Este módulo:
#   (A2) suprime la inferencia LEGACY redundante sobre las calculate de
#        identidad del roster (`current_code`/`current_label`) cuando RC5
#        (`roster_set_cmp`) ya valida esa correspondencia relacionalmente, para
#        no mostrar dos reglas del mismo hecho ("«current_label» coincide…"
#        duplicada de "Correspondencia roster↔selección").
#   (B)  anota cada regla del payload del plan con los campos que el frontend
#        necesita para agrupar y explicar (relational / repeat_group /
#        requires_external_dataset / depends_on_child_base) y expone un
#        `relational_summary` para el encabezado de la familia.
#
# No re-ensambla datos: la anotación es puramente estructural (deriva del
# subtipo/`repeat_context`/predicate de cada regla ya construida).
# =============================================================================

# -----------------------------------------------------------------------------
# op del predicate, robusto a reglas sin AST (odk_raw legacy, etc.).
# -----------------------------------------------------------------------------
.rel_ast_op <- function(x) {
  if (!is_ast(x)) return(NA_character_)
  tryCatch(ast_op(x), error = function(e) NA_character_)
}

# -----------------------------------------------------------------------------
# Nombres de las calculate de IDENTIDAD del roster en cada repeat con RC5.
#
# Un repeat condicionado tipo PDM declara dos calculate estructurales de
# identidad: `current_code` (= `selected-at(${sm}, position()-1)`) y
# `current_label` (= `jr:choice-name(${current_code}, '${sm}')`). RC4 (unicidad)
# + RC5 (correspondencia roster↔selección) ya cubren su coherencia
# RELACIONALMENTE; la inferencia legacy de "valores calculados" sobre ellas es
# (a) intraducible fielmente a R (jr:choice-name/selected-at/position) y
# (b) redundante con RC5. Devolvemos esos nombres para poder suprimir la legacy.
#
# Solo se consideran repeats donde RC5 aplica (tienen SM conductor + identidad),
# para no tocar calculate de repeats sin correspondencia.
# -----------------------------------------------------------------------------
.roster_identity_vars <- function(survey) {
  specs <- tryCatch(.relational_repeat_specs(survey), error = function(e) list())
  if (!length(specs)) return(character(0))
  has_calc <- is.data.frame(survey) && "calculation" %in% names(survey)
  out <- character(0)
  for (spec in specs) {
    if (is.null(spec$sm_conductor) || is.null(spec$identity_var)) next
    out <- c(out, spec$identity_var)
    # Calculate dentro del repeat que derivan de la identidad vía las funciones
    # ODK de roster (jr:choice-name / selected-at) — p.ej. current_label.
    if (has_calc && !is.null(spec$begin_i) && !is.null(spec$end_i) &&
        spec$end_i > spec$begin_i + 1L) {
      for (j in (spec$begin_i + 1L):(spec$end_i - 1L)) {
        if (!identical(.type_base(as.character(survey$type[j])), "calculate")) next
        calc_j <- as.character(survey$calculation[j])
        if (is.na(calc_j) || !nzchar(calc_j)) next
        if (grepl("jr:choice-name\\s*\\(|selected-at\\s*\\(", calc_j, perl = TRUE)) {
          nm_j <- as.character(survey$name[j])
          if (!is.na(nm_j) && nzchar(nm_j)) out <- c(out, nm_j)
        }
      }
    }
  }
  unique(out[!is.na(out) & nzchar(out)])
}

# -----------------------------------------------------------------------------
# A2 — suprime la inferencia legacy redundante con RC5.
#
# Quita las reglas `calculate_check` cuyo target es una calculate de identidad
# del roster, PERO solo si RC5 (`roster_set_cmp`) está presente en el bundle:
# sin RC5 no hay reemplazo, así que se conservan (degradación segura).
# Devuelve list(rules, suppressed_ids).
# -----------------------------------------------------------------------------
.suppress_redundant_roster_legacy <- function(rules, survey) {
  if (!length(rules)) return(list(rules = rules, suppressed_ids = character(0)))
  ident <- .roster_identity_vars(survey)
  if (!length(ident)) return(list(rules = rules, suppressed_ids = character(0)))
  has_rc5 <- any(vapply(rules, function(r) identical(.rel_ast_op(r$predicate), "roster_set_cmp"),
                        logical(1)))
  if (!isTRUE(has_rc5)) return(list(rules = rules, suppressed_ids = character(0)))

  suppressed <- character(0)
  keep <- vapply(rules, function(r) {
    if (!identical(r$tipo_regla, "calculate_check")) return(TRUE)
    tgt <- as.character(r$primary_var %||% (r$variable_roles$target %||% character(0))[1] %||% "")
    redundant <- nzchar(tgt) && tgt %in% ident
    if (redundant) suppressed <<- c(suppressed, as.character(r$id %||% tgt))
    !redundant
  }, logical(1))
  list(rules = rules[keep], suppressed_ids = suppressed)
}

# -----------------------------------------------------------------------------
# B — metadata relacional por regla (para el payload del plan).
#
# Deriva de la regla ya construida (subtipo/repeat_context/predicate). Campos:
#   relational                 TRUE si es de la familia RC1-RC5.
#   repeat_group               nombre del repeat al que pertenece (o NA).
#   depends_on_child_base      TRUE si la regla se evalúa con la base hija
#                              presente (reusa la semántica de sin_datos_repeat).
#   requires_external_dataset  TRUE si depende de un roster externo (pulldata).
#   external_datasets          nombres de esos rosters (character vector).
#   roster_subtype             subtipo de la familia relacional (p.ej.
#                              "relacional", "count") si aplica.
# -----------------------------------------------------------------------------
.rule_relational_meta <- function(rule) {
  op <- .rel_ast_op(rule$predicate)
  subtipo <- as.character(rule$presentation$subtipo_semantico %||% NA_character_)
  tabla <- as.character(rule$tabla %||% "principal")
  repeat_ctx <- rule$repeat_context %||% NA_character_
  repeat_ctx <- if (length(repeat_ctx) && !is.na(repeat_ctx) && nzchar(repeat_ctx)) as.character(repeat_ctx) else NA_character_

  is_rc5 <- identical(op, "roster_set_cmp")
  is_rc3 <- identical(op, "referential_parent_exists")
  is_repeat_len <- identical(rule$tipo_regla, "repeat_length")
  is_rel_subtype <- identical(subtipo, "relacional")

  relational <- is_rc5 || is_rc3 || is_repeat_len || is_rel_subtype

  # repeat_group: preferimos repeat_context; para RC5 (vive en principal) lo
  # sacamos del source_table del predicate; el resto usa la tabla no-principal.
  repeat_group <- NA_character_
  if (!is.na(repeat_ctx)) {
    repeat_group <- repeat_ctx
  } else if (is_rc5 && is_ast(rule$predicate)) {
    repeat_group <- as.character(rule$predicate$source_table %||% NA_character_)
  } else if (!identical(tabla, "principal") && nzchar(tabla)) {
    repeat_group <- tabla
  }
  if (length(repeat_group) != 1L || is.na(repeat_group) || !nzchar(repeat_group)) {
    repeat_group <- NA_character_
  }

  # requires_external_dataset: la regla depende de un roster precargado vía
  # pulldata (mismo hecho que el issue_code `requires_external_dataset` del
  # evaluador). Lo derivamos estáticamente para que fluya al plan, no solo a la
  # auditoría.
  datasets <- unique(c(
    .ast_pulldata_datasets(rule$predicate),
    .ast_pulldata_datasets(rule$gate)
  ))
  datasets <- datasets[!is.na(datasets) & nzchar(datasets)]
  requires_external <- length(datasets) > 0L ||
    identical(as.character(rule$categoria_ux %||% ""), "roster_externo")

  # depends_on_child_base: la regla necesita la base hija presente para
  # evaluarse (cruza a la tabla del repeat). Todas las RC1-RC5 lo hacen.
  depends_child <- relational && !is.na(repeat_group)

  list(
    relational = relational,
    repeat_group = repeat_group,
    depends_on_child_base = depends_child,
    requires_external_dataset = requires_external,
    external_datasets = datasets,
    roster_subtype = if (is.na(subtipo)) NA_character_ else subtipo
  )
}

# -----------------------------------------------------------------------------
# B — resumen relacional para el encabezado de la familia.
# -----------------------------------------------------------------------------
#' Anotaciones relacionales del plan (por regla + resumen).
#'
#' @param rules lista de vd_rule del bundle.
#' @param survey data.frame del instrumento (para sm_conductor/identity_var).
#' @return list(per_rule = named-by-id list de metadata, summary = list).
#' @export
validacion_relational_plan_annotations <- function(rules, survey = NULL) {
  rules <- rules %||% list()
  per_rule <- list()
  n_rel <- 0L
  n_ext <- 0L
  repeat_groups <- character(0)
  external_datasets <- character(0)
  for (r in rules) {
    meta <- .rule_relational_meta(r)
    rid <- as.character(r$id %||% NA_character_)
    if (!is.na(rid) && nzchar(rid)) per_rule[[rid]] <- meta
    if (isTRUE(meta$relational)) n_rel <- n_rel + 1L
    if (isTRUE(meta$requires_external_dataset)) n_ext <- n_ext + 1L
    if (!is.na(meta$repeat_group)) repeat_groups <- c(repeat_groups, meta$repeat_group)
    external_datasets <- c(external_datasets, meta$external_datasets)
  }
  repeat_groups <- unique(repeat_groups)
  external_datasets <- unique(external_datasets[!is.na(external_datasets) & nzchar(external_datasets)])

  # Por repeat: sm_conductor + identity_var (del instrumento) para el encabezado.
  repeats <- list()
  specs <- if (!is.null(survey)) tryCatch(.relational_repeat_specs(survey), error = function(e) list()) else list()
  for (spec in specs) {
    if (!(spec$name %in% repeat_groups)) next
    repeats[[length(repeats) + 1L]] <- list(
      repeat_group = as.character(spec$name),
      sm_conductor = if (is.null(spec$sm_conductor)) NA_character_ else as.character(spec$sm_conductor),
      identity_var = if (is.null(spec$identity_var)) NA_character_ else as.character(spec$identity_var),
      repeat_count = if (is.null(spec$repeat_count_raw) || is.na(spec$repeat_count_raw)) NA_character_ else as.character(spec$repeat_count_raw)
    )
  }

  summary <- list(
    n_relational = n_rel,
    n_requires_external_dataset = n_ext,
    repeat_groups = as.list(repeat_groups),
    external_datasets = as.list(external_datasets),
    repeats = repeats
  )
  list(per_rule = per_rule, summary = summary)
}

# -----------------------------------------------------------------------------
# B — fusiona la metadata relacional en las filas de preview del plan.
#
# Las filas de `.plan_rows_preview` traen `ID`; le agregamos los campos
# relacionales inline para que el frontend los tenga por regla sin un segundo
# cruce. No muta el data.frame del plan (ni el export a Excel).
# -----------------------------------------------------------------------------
validacion_relational_annotate_preview <- function(preview_rows, per_rule) {
  if (!length(preview_rows) || !length(per_rule)) return(preview_rows)
  lapply(preview_rows, function(row) {
    rid <- as.character(row$ID %||% row$id %||% "")
    meta <- if (nzchar(rid)) per_rule[[rid]] else NULL
    if (is.null(meta)) {
      meta <- list(
        relational = FALSE, repeat_group = NA_character_,
        depends_on_child_base = FALSE, requires_external_dataset = FALSE,
        external_datasets = character(0), roster_subtype = NA_character_
      )
    }
    row$relational <- isTRUE(meta$relational)
    row$repeat_group <- meta$repeat_group
    row$depends_on_child_base <- isTRUE(meta$depends_on_child_base)
    row$requires_external_dataset <- isTRUE(meta$requires_external_dataset)
    row$external_datasets <- as.list(meta$external_datasets %||% character(0))
    row$roster_subtype <- meta$roster_subtype
    row
  })
}

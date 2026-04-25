# =============================================================================
# ast_corpus_audit.R — smoke/audit del motor AST ODK contra corpus reales
# =============================================================================
# Uso:
#   Rscript api/scripts/ast_corpus_audit.R
#
# Salida:
#   api/outputs/ast_corpus_audit_<timestamp>/
#     - summary.csv
#     - rules_summary.csv
#     - missing_columns.csv
#     - lex_report.csv
#     - discarded.csv
#     - autoref_warnings.csv
#     - top_inconsistencies.csv
#
# =============================================================================

suppressPackageStartupMessages({
  library(readxl)
  library(dplyr)
  library(tibble)
})

`%||%` <- function(a, b) if (is.null(a) || (length(a) == 1L && is.na(a))) b else a

ROOT <- normalizePath(file.path(getwd()), mustWork = TRUE)
if (!dir.exists(file.path(ROOT, "api", "R"))) {
  ROOT <- normalizePath(file.path(getwd(), ".."), mustWork = TRUE)
}
R_DIR <- file.path(ROOT, "api", "R")

AST_FILES <- c(
  "validacion_ast_primitives.R",
  "validacion_ast_lex.R",
  "validacion_ast_normalize.R",
  "validacion_ast_compiler_r.R",
  "validacion_ast_rules.R",
  "validacion_ast_registry.R",
  "validacion_ast_parser.R",
  "validacion_ast_introspect.R",
  "validacion_ast_evaluator.R",
  "validacion_ast_bridge.R"
)
for (f in AST_FILES) source(file.path(R_DIR, f), local = FALSE)

FORMS <- list(
  ESPP = list(
    instrument = "/Users/gonzaloalmendariz/Documents/Pulso/ACNUR/ESPP/espp_instrumento.xlsx",
    data = "/Users/gonzaloalmendariz/Documents/Pulso/ACNUR/ESPP/datos_crudos_corregido.xlsx"
  ),
  RMS = list(
    instrument = "/Users/gonzaloalmendariz/Documents/Pulso/ACNUR/RMS/RMS_instrumento.xlsx",
    data = "/Users/gonzaloalmendariz/Documents/Pulso/ACNUR/RMS/datos_RMS.xlsx"
  ),
  HST = list(
    instrument = "/Users/gonzaloalmendariz/Documents/Pulso/HST/HST_Instrumento.xlsx",
    data = "/Users/gonzaloalmendariz/Documents/Pulso/HST/hst_data_cruda.xlsx"
  ),
  GIZ = list(
    instrument = "/Users/gonzaloalmendariz/Documents/Pulso/GIZ/GIZ_INST.xlsx",
    data = "/Users/gonzaloalmendariz/Documents/Pulso/GIZ/data_consolidada_posterior.xlsx"
  )
)

timestamp <- format(Sys.time(), "%Y%m%d_%H%M%S")
OUT_DIR <- file.path(ROOT, "api", "outputs", paste0("ast_corpus_audit_", timestamp))
dir.create(OUT_DIR, recursive = TRUE, showWarnings = FALSE)

clean_names_minimal <- function(df) {
  df <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
  cn <- trimws(names(df))
  cn[is.na(cn) | !nzchar(cn)] <- paste0("unnamed_", which(is.na(cn) | !nzchar(cn)))
  if (anyDuplicated(tolower(cn))) cn <- make.unique(cn, sep = "_")
  names(df) <- cn
  df
}

as_char_df <- function(df) {
  df <- clean_names_minimal(df)
  for (nm in names(df)) df[[nm]] <- as.character(df[[nm]])
  df[is.na(df)] <- ""
  df
}

read_xlsform_raw <- function(path) {
  sheets <- excel_sheets(path)
  read_optional <- function(sheet) {
    hit <- sheets[tolower(sheets) == tolower(sheet)][1]
    if (is.na(hit)) return(NULL)
    as_char_df(read_excel(path, sheet = hit, col_types = "text",
                          .name_repair = "minimal", guess_max = 10000))
  }

  survey <- read_optional("survey")
  if (is.null(survey)) stop("No se encontro hoja survey en: ", path)
  choices <- read_optional("choices") %||%
    data.frame(list_name = character(), name = character(), label = character())
  settings <- read_optional("settings") %||% data.frame()

  needed <- c("type", "name", "label", "required", "relevant", "constraint",
              "calculation", "choice_filter", "repeat_count", "appearance")
  for (cc in needed) if (!(cc %in% names(survey))) survey[[cc]] <- ""
  for (cc in c("list_name", "name", "label")) if (!(cc %in% names(choices))) choices[[cc]] <- ""

  list(survey = survey, choices = choices, settings = settings, meta = list())
}

read_data_tables <- function(path) {
  sheets <- excel_sheets(path)
  dfs <- lapply(sheets, function(sh) {
    clean_names_minimal(read_excel(path, sheet = sh, .name_repair = "minimal",
                                   guess_max = 10000))
  })
  names(dfs) <- sheets
  c(list(principal = dfs[[1]]), dfs[-1])
}

enrich_repeats_with_parent <- function(tables) {
  main <- tables$principal
  if (is.null(main) || !("_index" %in% names(main))) return(tables)
  parent_key <- as.character(main[["_index"]])

  for (nm in setdiff(names(tables), "principal")) {
    child <- tables[[nm]]
    if (!("_parent_index" %in% names(child))) next
    add_cols <- setdiff(names(main), names(child))
    if (!length(add_cols)) next
    pos <- match(as.character(child[["_parent_index"]]), parent_key)
    for (cc in add_cols) child[[cc]] <- main[[cc]][pos]
    tables[[nm]] <- child
  }
  tables
}

rule_table <- function(rule) as.character(rule$tabla %||% "principal")
rule_primary <- function(rule) {
  pv <- rule$primary_var %||% NA_character_
  if (!is.na(pv) && nzchar(pv)) return(as.character(pv))
  vars <- as.character(rule$variables %||% character())
  vars <- vars[!is.na(vars) & nzchar(vars)]
  if (length(vars)) vars[1] else NA_character_
}
rule_vars <- function(rule) paste(as.character(rule$variables %||% character()), collapse = ";")

rows_from_list <- function(items, form, kind) {
  if (!length(items)) return(tibble(form = character(), kind = character()))
  bind_rows(lapply(items, function(x) {
    as_tibble(as.data.frame(x, stringsAsFactors = FALSE))
  })) %>% mutate(form = form, kind = kind, .before = 1)
}

summary_rows <- list()
rules_rows <- list()
missing_rows <- list()
lex_rows <- list()
discarded_rows <- list()
autoref_rows <- list()
top_rows <- list()

for (form in names(FORMS)) {
  cfg <- FORMS[[form]]
  cat("\n== ", form, " ==\n", sep = "")

  inst <- read_xlsform_raw(cfg$instrument)
  tables <- enrich_repeats_with_parent(read_data_tables(cfg$data))
  main <- tables$principal
  data_multi <- tables[names(tables) != "principal"]

  inferred <- infer_rules_from_xlsform(inst, dedup = TRUE)
  rules <- inferred$rules
  table_names <- unique(vapply(rules, rule_table, character(1)))

  ev_by_table <- list()
  manual_no_table <- list()
  for (tbl in table_names) {
    tbl_rules <- rules[vapply(rules, rule_table, character(1)) == tbl]
    if (!tbl %in% names(tables)) {
      manual_no_table[[tbl]] <- tibble(
        id = vapply(tbl_rules, function(r) r$id, character(1)),
        nombre = vapply(tbl_rules, function(r) r$nombre, character(1)),
        tipo_regla = vapply(tbl_rules, function(r) r$tipo_regla, character(1)),
        categoria_ux = vapply(tbl_rules, function(r) r$categoria_ux, character(1)),
        severidad = vapply(tbl_rules, function(r) r$severidad, character(1)),
        fuente = vapply(tbl_rules, function(r) r$fuente, character(1)),
        tabla = tbl,
        seccion = vapply(tbl_rules, function(r) as.character(r$seccion %||% NA_character_), character(1)),
        flag = vapply(tbl_rules, function(r) r$flag_name, character(1)),
        n_filas = NA_integer_,
        n_inconsistencias = NA_integer_,
        porcentaje = NA_real_,
        estado = "incorrecta_ejecucion",
        issue_code = "missing_data_table",
        detalle = paste0("No existe hoja/tabla de datos para: ", tbl)
      )
      next
    }
    ev_by_table[[tbl]] <- evaluate_rules(
      tbl_rules,
      data = tables[[tbl]],
      data_multi = data_multi,
      strict = FALSE
    )
  }

  resumen <- bind_rows(c(
    lapply(ev_by_table, function(x) x$resumen),
    manual_no_table
  ))

  rule_meta <- tibble(
    id = vapply(rules, function(r) r$id, character(1)),
    primary_var = vapply(rules, rule_primary, character(1)),
    variables = vapply(rules, rule_vars, character(1))
  )

  rules_tbl <- resumen %>%
    left_join(rule_meta, by = "id") %>%
    mutate(form = form, .before = 1)

  adjusted_rules <- rules_tbl
  status_counts <- adjusted_rules %>%
    count(estado, issue_code, name = "n") %>%
    mutate(metric = paste(estado, issue_code %||% "", sep = ":"))

  summary_rows[[form]] <- tibble(
    form = form,
    instrument_rows = nrow(inst$survey),
    choices_rows = nrow(inst$choices),
    data_rows_main = nrow(main),
    data_cols_main = ncol(main),
    data_tables = paste(names(tables), collapse = ";"),
    rules_total = length(rules),
    rules_evaluated_adjusted = nrow(adjusted_rules),
    rules_correct = sum(adjusted_rules$estado == "correcta", na.rm = TRUE),
    rules_no_evaluada = sum(adjusted_rules$estado == "no_evaluada", na.rm = TRUE),
    rules_incorrecta = sum(adjusted_rules$estado == "incorrecta_ejecucion", na.rm = TRUE),
    total_inconsistencies_adjusted = sum(as.integer(adjusted_rules$n_inconsistencias), na.rm = TRUE),
    lex_findings = nrow(inferred$lex_report),
    discarded = length(inferred$discarded),
    odk_raw_rules = sum(vapply(rules, function(r) r$tipo_regla == "odk_raw", logical(1))),
    autoref_warnings = length(inferred$autoref_warnings %||% list())
  )

  by_type <- rules_tbl %>%
    count(form, tipo_regla, estado, issue_code, name = "n")
  rules_rows[[form]] <- rules_tbl
  missing_rows[[form]] <- rules_tbl %>%
    filter(issue_code %in% c("missing_columns", "missing_data_table")) %>%
    select(form, tabla, tipo_regla, nombre, primary_var, variables, estado,
           issue_code, detalle)
  lex_rows[[form]] <- as_tibble(inferred$lex_report) %>% mutate(form = form, .before = 1)
  discarded_rows[[form]] <- rows_from_list(inferred$discarded, form, "discarded")
  autoref_rows[[form]] <- rows_from_list(inferred$autoref_warnings %||% list(), form, "autoref")
  top_rows[[form]] <- rules_tbl %>%
    filter(estado == "correcta", n_inconsistencias > 0) %>%
    arrange(desc(n_inconsistencias)) %>%
    select(form, tabla, tipo_regla, nombre, primary_var, variables,
           n_filas, n_inconsistencias, porcentaje) %>%
    head(25)

  cat("reglas=", length(rules),
      " correctas=", summary_rows[[form]]$rules_correct,
      " incorrectas=", summary_rows[[form]]$rules_incorrecta,
      " no_eval=", summary_rows[[form]]$rules_no_evaluada,
      "\n", sep = "")
  print(by_type)
}

write.csv(bind_rows(summary_rows), file.path(OUT_DIR, "summary.csv"), row.names = FALSE)
write.csv(bind_rows(rules_rows), file.path(OUT_DIR, "rules_summary.csv"), row.names = FALSE)
write.csv(bind_rows(missing_rows), file.path(OUT_DIR, "missing_columns.csv"), row.names = FALSE)
write.csv(bind_rows(lex_rows), file.path(OUT_DIR, "lex_report.csv"), row.names = FALSE)
write.csv(bind_rows(discarded_rows), file.path(OUT_DIR, "discarded.csv"), row.names = FALSE)
write.csv(bind_rows(autoref_rows), file.path(OUT_DIR, "autoref_warnings.csv"), row.names = FALSE)
write.csv(bind_rows(top_rows), file.path(OUT_DIR, "top_inconsistencies.csv"), row.names = FALSE)

cat("\nOutput dir:\n", OUT_DIR, "\n", sep = "")

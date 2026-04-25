# =============================================================================
# ast_shadow_check.R — Validación del motor AST contra el motor legacy
# =============================================================================
# Corre ambos motores sobre los mismos datos y produce un reporte Excel con:
#   - Reglas inferidas por cada motor (N por tipo)
#   - Matching rule-by-rule (por variable + tipo)
#   - Discrepancias en n_inconsistencias
#   - Smart quotes detectadas
#   - Reglas que solo aparecen en un motor
#
# Uso:
#   Rscript api/scripts/ast_shadow_check.R <form_name>
#   donde form_name ∈ {ESPP, RMS, HST, GIZ}
#
# Output:
#   /tmp/ast_shadow_<form>_<timestamp>.xlsx
# =============================================================================

suppressMessages({
  library(readxl)
  library(openxlsx)
  library(dplyr)
})

# ---- Config: paths instrumento + data por form ------------------------------
FORMS <- list(
  ESPP = list(
    instrument = "/Users/gonzaloalmendariz/Documents/Pulso/ACNUR/ESPP/espp_instrumento.xlsx",
    data       = "/Users/gonzaloalmendariz/Documents/Pulso/ACNUR/ESPP/datos_crudos_corregido.xlsx",
    repeats    = list()
  ),
  RMS = list(
    instrument = "/Users/gonzaloalmendariz/Documents/Pulso/ACNUR/RMS/RMS_instrumento.xlsx",
    data       = "/Users/gonzaloalmendariz/Documents/Pulso/ACNUR/RMS/datos_RMS.xlsx",
    repeats    = list(rpt_hhmnames = "rpt_hhmnames",
                      S1 = "S1",
                      CHILDEDUPE = "CHILDEDUPE")
  ),
  HST = list(
    instrument = "/Users/gonzaloalmendariz/Documents/Pulso/HST/HST_Instrumento.xlsx",
    data       = "/Users/gonzaloalmendariz/Documents/Pulso/HST/hst_data_cruda.xlsx",
    repeats    = list()
  ),
  GIZ = list(
    instrument = "/Users/gonzaloalmendariz/Documents/Pulso/GIZ/GIZ_INST.xlsx",
    data       = "/Users/gonzaloalmendariz/Documents/Pulso/GIZ/data_consolidada_posterior.xlsx",
    repeats    = list()
  )
)

# ---- Arg parsing -------------------------------------------------------------
args <- commandArgs(trailingOnly = TRUE)
form_name <- args[1] %||% "GIZ"
if (!(form_name %in% names(FORMS))) {
  stop("Form '", form_name, "' no soportado. Opciones: ",
       paste(names(FORMS), collapse = ", "))
}
cfg <- FORMS[[form_name]]

cat(sprintf("\n══════════════════════════════════════════════════════════════\n"))
cat(sprintf("  AST SHADOW CHECK — %s\n", form_name))
cat(sprintf("══════════════════════════════════════════════════════════════\n"))

# ---- Cargar motor AST (nuevo) -----------------------------------------------
cat("\n[1/6] Cargando motor AST nuevo...\n")
base <- "api/R"
ast_files <- c(
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
for (f in ast_files) source(file.path(base, f))
cat("  OK (", length(ast_files), "archivos)\n")

# ---- Cargar motor legacy (paquete prosecnur) --------------------------------
cat("\n[2/6] Cargando motor legacy (paquete prosecnur)...\n")
suppressMessages(library(prosecnur))
cat("  OK\n")

# ---- Leer instrumento + datos -----------------------------------------------
cat("\n[3/6] Leyendo instrumento y datos...\n")
inst_raw <- leer_xlsform_limpieza(cfg$instrument, verbose = FALSE)
cat(sprintf("  instrumento: %d filas en survey, %d en choices\n",
            nrow(inst_raw$survey), nrow(inst_raw$choices)))

# Data principal
data_sheets <- excel_sheets(cfg$data)
df_main <- as.data.frame(read_excel(cfg$data, sheet = data_sheets[1], col_types = "text"))
cat(sprintf("  data principal: %d filas × %d columnas (hoja '%s')\n",
            nrow(df_main), ncol(df_main), data_sheets[1]))

# Repeats
df_repeats <- list()
if (length(cfg$repeats)) {
  for (rname in names(cfg$repeats)) {
    sh <- cfg$repeats[[rname]]
    if (sh %in% data_sheets) {
      df_repeats[[rname]] <- as.data.frame(read_excel(cfg$data, sheet = sh, col_types = "text"))
      cat(sprintf("  repeat '%s': %d filas × %d columnas\n",
                  rname, nrow(df_repeats[[rname]]), ncol(df_repeats[[rname]])))
    }
  }
}

# ---- Motor AST: inferir + evaluar -------------------------------------------
cat("\n[4/6] Motor AST: inferir reglas + evaluar...\n")
t0 <- Sys.time()
ast_bundle <- infer_rules_from_xlsform(inst_raw)
cat(sprintf("  reglas inferidas: %d\n", length(ast_bundle$rules)))
cat(sprintf("  smart quotes detectadas: %d\n", nrow(ast_bundle$lex_report)))
cat(sprintf("  reglas odk_raw: %d\n",
            sum(vapply(ast_bundle$rules, function(r) r$tipo_regla == "odk_raw", logical(1)))))
cat(sprintf("  autoref warnings: %d\n", length(ast_bundle$autoref_warnings %||% list())))

ev_ast <- evaluate_rules(ast_bundle$rules, df_main, data_multi = df_repeats)
dt_ast <- as.numeric(difftime(Sys.time(), t0, units = "secs"))
cat(sprintf("  evaluación: %.2fs (col captura: %s)\n",
            dt_ast, ev_ast$collection_date_col %||% "—"))

# ---- Motor legacy: generar plan + evaluar -----------------------------------
cat("\n[5/6] Motor legacy: generar plan + evaluar...\n")
t0 <- Sys.time()
plan_legacy <- tryCatch(
  generar_plan_limpieza(x = inst_raw,
                        incluir = list(
                          required = TRUE, relevant = TRUE,
                          constraint = TRUE, calculate = FALSE,
                          choice_filter = TRUE, repeat_min1 = FALSE,
                          tiempo_ventana = FALSE
                        )),
  error = function(e) { cat("  ERROR plan: ", conditionMessage(e), "\n"); NULL }
)
cat(sprintf("  plan legacy: %d reglas\n",
            if (is.null(plan_legacy)) 0L else nrow(plan_legacy)))

# Para evaluar legacy, necesitamos pasar datos en el shape esperado
datos_legacy <- if (length(df_repeats)) c(list(principal = df_main), df_repeats) else df_main

ev_legacy <- tryCatch(
  evaluar_consistencia(
    datos = datos_legacy,
    plan = plan_legacy,
    choices = inst_raw$choices,
    use_choice_labels = FALSE,
    contar_na = FALSE
  ),
  error = function(e) { cat("  ERROR eval: ", conditionMessage(e), "\n"); NULL }
)
dt_legacy <- as.numeric(difftime(Sys.time(), t0, units = "secs"))
if (!is.null(ev_legacy) && !is.null(ev_legacy$resumen)) {
  cat(sprintf("  resumen legacy: %d reglas evaluadas en %.2fs\n",
              nrow(ev_legacy$resumen), dt_legacy))
}

# ---- Matching rule-by-rule --------------------------------------------------
cat("\n[6/6] Matching AST ↔ legacy...\n")

# Normalizador de tipo: legacy tipo→ tipo_regla_normalizado
norm_tipo_legacy <- function(nombre, categoria) {
  nombre <- as.character(nombre %||% "")
  categoria <- as.character(categoria %||% "")
  if (startsWith(nombre, "req_")) return("required")
  if (startsWith(nombre, "salto_")) return("skip")
  if (startsWith(nombre, "calc_")) return("calculate_check")
  if (startsWith(nombre, "cons_") && grepl("_cf_", nombre, fixed=TRUE)) return("constraint")
  if (startsWith(nombre, "cons_") && grepl("_ventana_fecha", nombre, fixed=TRUE)) return("range")
  if (startsWith(nombre, "cons_") && grepl("_repeat", nombre, fixed=TRUE)) return("repeat_length")
  if (startsWith(nombre, "cons_")) return("constraint")
  switch(categoria,
    "Preguntas de control"="required",
    "Saltos de preguntas"="skip",
    "Consistencia"="constraint",
    "Filtro de opciones"="constraint",
    "Valores calculados"="calculate_check",
    "otros"
  )
}

# Primary variable extractor. Prefer rule$primary_var si existe.
primary_var <- function(rule_or_vars) {
  if (is.list(rule_or_vars) && !is.null(rule_or_vars$primary_var) &&
      !is.na(rule_or_vars$primary_var) && nzchar(rule_or_vars$primary_var)) {
    return(as.character(rule_or_vars$primary_var))
  }
  vars <- if (is.list(rule_or_vars) && !is.null(rule_or_vars$variables)) rule_or_vars$variables else rule_or_vars
  if (length(vars) == 0L) return(NA_character_)
  v <- as.character(unlist(vars))
  v <- v[!is.na(v) & nzchar(v) & v != "NA"]
  if (!length(v)) NA_character_ else v[1]
}

# ---- Matching por EQUIVALENCIA SEMÁNTICA ------------------------------------
# Legacy tiende a emitir 2-3 reglas por variable donde AST consolida en 1.
# Ejemplo:
#   legacy: req_X_req (sin gate) + salto_X_debe (con gate) + salto_X_nodebe
#   AST:    1 required (con gate: efectivamente salto_debe) + nada
# Para comparar bien, mapeamos cada regla a una clave semántica canónica:
#   "<primary_var>::<kind>" donde kind ∈ {req_plain, skip_debe, skip_nodebe,
#   constraint, range, catalog, outlier, duplicate, coherence, calc_check}
# Dos reglas con la misma clave son semánticamente equivalentes aunque
# vengan de motores distintos con nombres distintos.

ast_semantic_key <- function(rule) {
  pv <- primary_var(rule)
  if (is.na(pv)) pv <- "_none"
  tipo <- rule$tipo_regla
  # required de AST: si tiene gate, equivale a "skip_debe" de legacy;
  # si no, equivale a "req_plain".
  if (tipo == "required") {
    kind <- if (is.null(rule$gate)) "req_plain" else "skip_debe"
  } else if (tipo == "skip") {
    # direccion por nombre (emitimos _debe y _nodebe separados ahora)
    n <- rule$nombre
    if (grepl("no debe responderse", n, fixed=TRUE)) kind <- "skip_nodebe"
    else kind <- "skip_debe"
  } else {
    kind <- tipo
  }
  sprintf("%s::%s", pv, kind)
}

legacy_semantic_key <- function(nombre_regla, categoria, primary_var_val) {
  pv <- if (is.na(primary_var_val) || !nzchar(primary_var_val)) "_none" else primary_var_val
  nombre <- as.character(nombre_regla %||% "")
  cat_ <- as.character(categoria %||% "")
  kind <- if (startsWith(nombre, "req_")) "req_plain"
  else if (startsWith(nombre, "salto_") && endsWith(nombre, "_nodebe")) "skip_nodebe"
  else if (startsWith(nombre, "salto_")) "skip_debe"
  else if (startsWith(nombre, "calc_")) "calculate_check"
  else if (startsWith(nombre, "cons_") && grepl("_cf_", nombre, fixed=TRUE)) "constraint"
  else if (startsWith(nombre, "cons_") && grepl("_ventana_fecha", nombre, fixed=TRUE)) "range"
  else if (startsWith(nombre, "cons_") && grepl("_repeat", nombre, fixed=TRUE)) "repeat_length"
  else if (startsWith(nombre, "cons_")) "constraint"
  else switch(cat_,
    "Preguntas de control"="req_plain",
    "Saltos de preguntas"="skip_debe",
    "Consistencia"="constraint",
    "otros")
  sprintf("%s::%s", pv, kind)
}

# AST table con semantic_key
ast_rules_tbl <- tibble::tibble(
  engine = "ast",
  id = vapply(ast_bundle$rules, function(r) r$id, character(1)),
  nombre = vapply(ast_bundle$rules, function(r) r$nombre, character(1)),
  tipo_regla = vapply(ast_bundle$rules, function(r) r$tipo_regla, character(1)),
  primary_var = vapply(ast_bundle$rules, primary_var, character(1)),
  semantic_key = vapply(ast_bundle$rules, ast_semantic_key, character(1)),
  flag = vapply(ast_bundle$rules, function(r) r$flag_name, character(1))
) |> dplyr::left_join(
  ev_ast$resumen |> dplyr::select(id, n_inc_ast = n_inconsistencias,
                                   pct_ast = porcentaje, estado_ast = estado,
                                   issue_ast = issue_code),
  by = "id"
)

# Legacy table con semantic_key
if (!is.null(ev_legacy) && !is.null(ev_legacy$resumen) && nrow(ev_legacy$resumen) > 0) {
  legacy_rules_tbl <- ev_legacy$resumen |>
    dplyr::mutate(
      primary_var = vapply(seq_len(dplyr::n()),
                            function(i) as.character(plan_legacy$`Variable 1`[
                              match(id_regla[i], plan_legacy$ID)]), character(1)),
      semantic_key = vapply(seq_len(dplyr::n()),
                             function(i) legacy_semantic_key(
                               nombre_regla[i], categoria[i], primary_var[i]),
                             character(1))
    ) |>
    dplyr::select(id_legacy = id_regla, nombre_legacy = nombre_regla,
                  semantic_key, primary_var,
                  n_inc_legacy = n_inconsistencias, estado_legacy = estado_dinamico,
                  issue_legacy = issue_code)
} else {
  legacy_rules_tbl <- tibble::tibble(
    id_legacy = character(0), nombre_legacy = character(0),
    semantic_key = character(0), primary_var = character(0),
    n_inc_legacy = integer(0), estado_legacy = character(0),
    issue_legacy = character(0)
  )
}

# Join por semantic_key — dos reglas semánticamente equivalentes de
# motores distintos se emparejan aunque tengan nombres/tipos diferentes.
join_key_ast <- ast_rules_tbl |>
  dplyr::select(id_ast = id, nombre_ast = nombre, tipo_regla, semantic_key, primary_var,
                n_inc_ast, pct_ast, estado_ast, issue_ast)

matched <- dplyr::full_join(
  join_key_ast,
  legacy_rules_tbl |> dplyr::select(-primary_var),
  by = "semantic_key",
  relationship = "many-to-many"
) |>
  dplyr::mutate(
    category = dplyr::case_when(
      is.na(id_ast) ~ "solo_en_legacy",
      is.na(id_legacy) ~ "solo_en_ast",
      is.na(n_inc_ast) | is.na(n_inc_legacy) ~ "no_comparable",
      abs(as.integer(n_inc_ast) - as.integer(n_inc_legacy)) <= 2L ~ "concuerdan",
      as.integer(n_inc_ast) > as.integer(n_inc_legacy) ~ "ast_mas_estricto",
      TRUE ~ "legacy_mas_estricto"
    ),
    delta = as.integer(n_inc_ast) - as.integer(n_inc_legacy)
  )

# Summary table
summary_tbl <- matched |>
  dplyr::count(category, name = "n_reglas") |>
  dplyr::arrange(factor(category,
                        levels = c("concuerdan","ast_mas_estricto","legacy_mas_estricto",
                                    "solo_en_ast","solo_en_legacy","no_comparable")))

cat("\n=== RESUMEN ===\n")
print(summary_tbl)

# Métricas de totales — más robustas que rule-by-rule matching.
total_ast    <- sum(as.integer(ev_ast$resumen$n_inconsistencias), na.rm = TRUE)
total_legacy <- if (!is.null(ev_legacy)) sum(as.integer(ev_legacy$resumen$n_inconsistencias), na.rm = TRUE) else NA
cat(sprintf("\nTotal inconsistencias detectadas:\n  AST:    %d (sobre %d filas)\n  Legacy: %d\n",
            total_ast, nrow(df_main), total_legacy %||% 0L))

# ---- Write Excel report -----------------------------------------------------
ts <- format(Sys.time(), "%Y%m%d_%H%M%S")
out_path <- sprintf("/tmp/ast_shadow_%s_%s.xlsx", form_name, ts)

wb <- createWorkbook()
addWorksheet(wb, "resumen")
writeData(wb, "resumen", data.frame(
  Metric = c("Form", "Data rows", "AST rules", "Legacy rules", "Matched (concuerdan)",
              "AST more strict", "Legacy more strict", "Only in AST", "Only in legacy",
              "No comparable", "Smart quotes", "Autoref warnings",
              "AST odk_raw", "AST eval (s)", "Legacy eval (s)"),
  Value  = c(form_name, nrow(df_main), length(ast_bundle$rules),
              if (is.null(plan_legacy)) NA else nrow(plan_legacy),
              sum(matched$category == "concuerdan"),
              sum(matched$category == "ast_mas_estricto"),
              sum(matched$category == "legacy_mas_estricto"),
              sum(matched$category == "solo_en_ast"),
              sum(matched$category == "solo_en_legacy"),
              sum(matched$category == "no_comparable"),
              nrow(ast_bundle$lex_report),
              length(ast_bundle$autoref_warnings %||% list()),
              sum(vapply(ast_bundle$rules, function(r) r$tipo_regla == "odk_raw", logical(1))),
              round(dt_ast, 2), round(dt_legacy, 2))
))

addWorksheet(wb, "matched_rules")
writeData(wb, "matched_rules", matched)

if (!is.null(cfg$note)) {
  addWorksheet(wb, "nota")
  writeData(wb, "nota", data.frame(nota = cfg$note))
}

if (nrow(ast_bundle$lex_report) > 0) {
  addWorksheet(wb, "smart_quotes")
  writeData(wb, "smart_quotes", ast_bundle$lex_report)
}

if (length(ast_bundle$autoref_warnings %||% list()) > 0) {
  autoref_df <- do.call(rbind, lapply(ast_bundle$autoref_warnings, function(w) {
    data.frame(group = w$group_name, row = w$row, relevant = w$relevant,
               self_refs = paste(w$self_references, collapse = ";"),
               action = w$action)
  }))
  addWorksheet(wb, "autoref")
  writeData(wb, "autoref", autoref_df)
}

saveWorkbook(wb, out_path, overwrite = TRUE)
cat(sprintf("\n→ Reporte: %s\n", out_path))
cat(sprintf("══════════════════════════════════════════════════════════════\n\n"))

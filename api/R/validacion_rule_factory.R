# rule_factory.R ---------------------------------------------------------------
# Generador del Plan de Limpieza (G-aware y repeat-aware)
# Convención: TRUE en `Procesamiento` = hay inconsistencia


# =============================================================================
# Utilidades básicas
# =============================================================================
`%||%` <- function(a, b) if (is.null(a) || (length(a) == 1 && is.na(a))) b else a
as_chr1 <- function(x){ if (is.null(x) || length(x) == 0) return(""); x <- suppressWarnings(as.character(x)); if (!length(x) || is.na(x[1])) "" else x[1] }
nz1 <- function(x) is.character(x) && length(x) == 1 && !is.na(x) && nzchar(trimws(x))
regex_escape <- function(s) gsub("([\\^$.|?*+(){}\\[\\]\\\\])", "\\\\\\1", s, perl = TRUE)

# TRUE = inconsistencia → helpers
es_vacio   <- function(v) sprintf("(is.na(%s) | trimws(%s) == \"\")", v, v)
no_vacio   <- function(v) sprintf("(!is.na(%s) & trimws(%s) != \"\")", v, v)

# Conjunto de sí/verdadero
YES_SET_R <- "c('Yes','yes','Si','si','Sí','sí','true','true()','1')"

# ========= Helpers de redacción/sections requeridos por los builders =========

.hum_opening_with_section <- function(seccion_label, Gh, RELh) {
  Gh   <- as.character(Gh %||% "")
  RELh <- as.character(RELh %||% "")
  seccion_label <- as.character(seccion_label %||% "")
  if (!nzchar(Gh) && !nzchar(RELh)) return("")
  if (nzchar(Gh) && nzchar(RELh)) {
    if (identical(trimws(Gh), trimws(RELh))) {
      return(sprintf("Si la sección «%s» se abre (%s), entonces ", seccion_label, Gh))
    } else {
      return(sprintf("Si la sección «%s» se abre (%s) y además (%s), entonces ", seccion_label, Gh, RELh))
    }
  }
  if (nzchar(Gh))   return(sprintf("Si la sección «%s» se abre (%s), entonces ", seccion_label, Gh))
  if (nzchar(RELh)) return(sprintf("Si (%s), entonces ", RELh))
  ""
}

.is_repeat_group <- function(group_name, section_map) {
  if (is.null(section_map) || !nrow(section_map)) return(FALSE)
  idx <- match(as.character(group_name %||% ""), section_map$group_name)
  isTRUE(section_map$is_repeat[idx])
}

.section_label <- function(group_name, section_map) {
  if (is.null(section_map) || !nrow(section_map)) return(as.character(group_name %||% ""))
  i <- match(as.character(group_name %||% ""), section_map$group_name)
  lab <- section_map$group_label[i] %||% ""
  if (nzchar(lab)) lab else as.character(group_name %||% "")
}

# ========= Helpers de nombres/IDs requeridos por los builders ================

sanitize_id <- function(x){
  x <- as.character(x %||% "")
  x <- gsub("\\s+", "_", x)                 # espacios -> _
  x <- gsub("[^A-Za-z0-9_]", "_", x)        # no alfanumérico -> _
  x
}

# Fabricantes de nombres de regla
nombre_regla_simple  <- function(var, suf = "") paste0("req_",  sanitize_id(var), suf)
nombre_regla_salto   <- function(var, suf = "") paste0("salto_", sanitize_id(var), suf)
nombre_regla_cons    <- function(var, suf = "") paste0("cons_",  sanitize_id(var), suf)
nombre_regla_calc    <- function(var, suf = "") paste0("calc_",  sanitize_id(var), suf)

# Normalizador final del nombre (p. ej. si llega con puntos)
.norm_rule_name <- function(x) {
  x <- as.character(x %||% "")
  gsub("\\.", "_", x, perl = TRUE)
}

# --- Helpers para detección de cruce ambiguo principal→hijo ---
.var_tabla <- function(var, survey, section_map, main_name="(principal)"){
  if (!nzchar(as_chr1(var))) return(main_name)
  # group_name de la variable en survey
  gi <- match(as_chr1(var), as.character(survey$name))
  gname <- as_chr1(if (!is.na(gi)) survey$group_name[gi] else NA_character_)
  tabla_destino_de(gname, section_map, main_name = main_name)
}

.is_repeat_tabla <- function(tabla, main_name="(principal)"){
  nzchar(as_chr1(tabla)) && !identical(tabla, main_name)
}

.rhs_tiene_agregacion <- function(rhs_r){
  x <- as_chr1(rhs_r)
  if (!nzchar(x)) return(FALSE)
  # señales de agregación/colapso que resuelve la ambigüedad
  any(grepl("\\bsum\\s*\\(",              x)) ||
    any(grepl("\\bany\\s*\\(",              x)) ||
    any(grepl("\\ball\\s*\\(",              x)) ||
    any(grepl("\\bmin\\s*\\(",              x)) ||
    any(grepl("\\bmax\\s*\\(",              x)) ||
    any(grepl("\\bpaste\\s*\\(.*collapse\\s*=", x, perl=TRUE)) ||
    any(grepl("\\bn_[A-Za-z0-9_]+\\b",      x))  # contadores precomputados
}

.es_cruce_principal_hijo_sin_agg <- function(tabla_base, vars_implicadas, survey, section_map, rhs_r){
  # Sólo nos importa si la base es principal
  if (!identical(as_chr1(tabla_base), "(principal)")) return(FALSE)
  vtabs <- vapply(vars_implicadas, .var_tabla, character(1), survey=survey, section_map=section_map, main_name="(principal)")
  hay_hijos <- any(vtabs != "(principal)")
  if (!hay_hijos) return(FALSE)
  # ¿El RHS/cond tiene agregación clara?
  !.rhs_tiene_agregacion(rhs_r)
}

# =============================================================================
# Helpers ODK → R (runtime)
# =============================================================================

# selected(x, "val"): emula selected() para cadenas con códigos separados por espacios
selected <- function(x, val){
  x <- x %||% ""
  pat <- paste0("(^|\\s)", regex_escape(val), "(\\s|$)")
  grepl(pat, x, perl = TRUE)
}

# selected-at(list, i0) — i0 0-based (ODK); soporta strings "a b c" o vectores
selected_at <- function(x, i0, sep = "\\s+"){
  parts <- if (length(x) == 1L && is.character(x)) {
    xs <- trimws(x)
    if (xs == "") character(0) else if (grepl(sep, xs, perl = TRUE)) strsplit(xs, sep, perl = TRUE)[[1]] else xs
  } else x
  i <- suppressWarnings(as.integer(i0)) + 1L
  if (length(parts) == 0L || is.na(i) || i < 1L || i > length(parts)) return(NA_character_)
  parts[[i]]
}

# count-selected() para select_multiple (separado por espacios)
count_selected <- function(x){
  x <- trimws(x %||% "")
  if (x == "") 0L else length(strsplit(x, "\\s+")[[1L]])
}

# place-holders que marcan expresiones no ejecutables sin prepro
position_dot   <- function(...) stop("position_dot() requiere preprocesar repeats")
INDEXED_REPEAT <- function(...) stop("INDEXED_REPEAT() requiere preprocesar repeats")

# Rewriter: tokens ODK → helpers R (solo para el texto de 'Procesamiento')
rewrite_odk_tokens <- function(x){
  out <- x
  # today(), selected-at(), POSITION_DOT(), join(), count-selected(), concat()
  out <- gsub("\\btoday\\s*\\(\\)", "Sys.Date()", out)
  out <- gsub("\\bselected-at\\s*\\(", "selected_at(", out)
  out <- gsub("\\bPOSITION_DOT\\s*\\(\\)", "position_dot()", out)
  out <- gsub("join\\s*\\(\\s*([^,]+?)\\s*,\\s*([^\\)]+?)\\s*\\)", "paste(\\2, collapse = \\1)", out, perl = TRUE)
  out <- gsub("\\bcount\\s*-?\\s*selected\\s*\\(", "count_selected(", out, perl = TRUE)
  out <- gsub("\\bconcat\\s*\\(", "paste0(", out, perl = TRUE)

  # regex(x, 'pat') -> grepl('pat', x, perl = TRUE)
  out <- gsub("\\bregex\\s*\\(\\s*([^,]+?)\\s*,\\s*'([^']+)'\\s*\\)",
              "grepl('\\2', \\1, perl = TRUE)", out, perl = TRUE)
  out <- gsub("\\bregex\\s*\\(\\s*([^,]+?)\\s*,\\s*\"([^\"]+)\"\\s*\\)",
              "grepl(\"\\2\", \\1, perl = TRUE)", out, perl = TRUE)

  # selected(var, "k") -> grepl((^|\s)k(\s|$), var, perl = TRUE)
  out <- gsub(
    "\\bselected\\s*\\(\\s*([A-Za-z0-9_\\.]+)\\s*,\\s*'([^']+)'\\s*\\)",
    "grepl('(^|\\\\s)\\2(\\\\s|$)', \\1, perl = TRUE)", out, perl = TRUE
  )
  out <- gsub(
    "\\bselected\\s*\\(\\s*([A-Za-z0-9_\\.]+)\\s*,\\s*\"([^\"]+)\"\\s*\\)",
    "grepl(\"(^|\\\\s)\\2(\\\\s|$)\", \\1, perl = TRUE)", out, perl = TRUE
  )

  out
}

# Envuelve con as.numeric() todas las ocurrencias de variables numéricas
# (según 'type_base' del survey) dentro de una expresión RHS.
wrap_numeric_tokens <- function(rhs, survey){
  if (!nz1(rhs) || !is.data.frame(survey) || !"type" %in% names(survey) || !"name" %in% names(survey)) {
    return(rhs)
  }
  type_base <- tolower(trimws(sub("\\s.*$", "", as.character(survey$type))))
  num_like  <- survey$name[ type_base %in% c("integer","decimal","calculate") ]
  out <- rhs
  for (v in unique(na.omit(as.character(num_like)))) {
    # Evita tocar partes de otros nombres; doble envoltura no daña (as.numeric(as.numeric(x)) ok)
    pat <- paste0("(?<![A-Za-z0-9_])", regex_escape(v), "(?![A-Za-z0-9_])")
    out <- gsub(pat, paste0("as.numeric(", v, ")"), out, perl = TRUE)
  }
  out
}

# Envuelve con as.numeric() únicamente las variables que participan en comparaciones numéricas
wrap_numeric_in_comparisons <- function(rhs, survey){
  if (!nz1(rhs) || !is.data.frame(survey) || !"name" %in% names(survey) || !"type" %in% names(survey)) return(rhs)

  type_base <- tolower(trimws(sub("\\s.*$", "", as.character(survey$type))))
  vars <- unique(as.character(survey$name[type_base %in% c("integer", "decimal", "calculate")]))
  if (!length(vars)) return(rhs)

  # Construimos un OR de variables escapadas para regex
  v_or <- paste(vapply(vars, regex_escape, ""), collapse = "|")

  out <- rhs

  # Caso A: VAR op NUM  →  as.numeric(VAR) op NUM
  patA <- paste0("(?<![A-Za-z0-9_])(", v_or, ")\\s*(>=|<=|>|<|==|!=)\\s*(['\"]?\\d+(?:\\.\\d+)?['\"]?)")
  out  <- gsub(patA, "as.numeric(\\1) \\2 \\3", out, perl = TRUE)

  # Caso B: NUM op VAR  →  NUM op as.numeric(VAR)
  patB <- paste0("(['\"]?\\d+(?:\\.\\d+)?['\"]?)\\s*(>=|<=|>|<|==|!=)\\s*(", v_or, ")(?![A-Za-z0-9_])")
  out  <- gsub(patB, "\\1 \\2 as.numeric(\\3)", out, perl = TRUE)

  out
}

# -----------------------------------------------------------------------------
# Evitar autorreferencia en gates de grupo
# -----------------------------------------------------------------------------
# Si el relevant del grupo (G_r) menciona a la misma variable que se está
# auditando, se ignora ese gate para esa variable.
#
# Esto evita reglas circulares del tipo:
#   "Consent se evalúa solo si Consent == 'Yes'"
#
# Caso típico: variables ubicadas dentro de grupos cuyo relevant depende
# de la propia variable (edge case del constructor).
.gate_sin_autorreferencia <- function(G_r, var, survey_names) {

  G_r <- as_chr1(G_r %||% "")
  if (!nzchar(G_r)) return(G_r)

  deps <- .drivers_from_expr(G_r, survey_names)

  if (var %in% deps) {
    return("")
  }

  G_r
}

# =============================================================================
# Labels
# =============================================================================
force_label_columns <- function(inst){
  if (!is.null(inst$meta$label_col_survey)) {
    lc <- as.character(inst$meta$label_col_survey)
    if (!is.null(inst$survey) && nrow(inst$survey) && lc %in% names(inst$survey)) {
      inst$survey[[lc]] <- suppressWarnings(as.character(inst$survey[[lc]]))
    }
  }
  if (!is.null(inst$meta$label_col_choices)) {
    lc <- as.character(inst$meta$label_col_choices)
    if (!is.null(inst$choices) && nrow(inst$choices) && lc %in% names(inst$choices)) {
      inst$choices[[lc]] <- suppressWarnings(as.character(inst$choices[[lc]]))
    }
  }
  inst
}
lab_pregunta <- function(survey, meta, var){
  if (is.null(survey) || !nrow(survey)) return(as.character(var))
  lc <- as_chr1(meta$label_col_survey %||% "label")
  if (!nz1(lc) || !lc %in% names(survey)) return(as.character(var))
  i <- match(as.character(var), as.character(survey$name))
  if (is.na(i)) return(as.character(var))
  lab <- suppressWarnings(as.character(survey[[lc]][i]))
  if (length(lab) == 0 || is.na(lab) || !nzchar(lab)) as.character(var) else trimws(lab)
}
lab_choice <- function(choices, meta, type_txt, opt){
  if (is.null(choices) || !nrow(choices)) return(as.character(opt))
  lc <- as_chr1(meta$label_col_choices %||% meta$label_col_survey %||% "label")
  if (!nz1(lc) || !lc %in% names(choices)) return(as.character(opt))
  ln <- tolower(trimws(sub("^select_(one|multiple)\\s+","", as.character(type_txt %||% ""))))
  row <- choices[choices$list_name == ln & choices$name == opt, , drop = FALSE]
  if (!nrow(row)) return(as.character(opt))
  lab <- suppressWarnings(as.character(row[[lc]][1]))
  if (length(lab) == 0 || is.na(lab) || !nzchar(lab)) as.character(opt) else trimws(lab)
}

# =============================================================================
# Secciones / groups / repeats
# =============================================================================
sanitize_id <- function(x){
  x <- as.character(x %||% "")
  x <- gsub("\\s+", "_", x)
  x <- gsub("[^A-Za-z0-9_]", "_", x)
  x
}
tabla_destino_de <- function(group_name, section_map, main_name = "(principal)") {
  g <- as_chr1(group_name)
  if (!nz1(g)) return(main_name)
  if (is.null(section_map) || !nrow(section_map)) return(main_name)

  i <- match(g, section_map$group_name)

  # 1) Si el group es repeat (según section_map), su tabla es el propio nombre del grupo
  if (!is.na(i) && "is_repeat" %in% names(section_map) && isTRUE(section_map$is_repeat[i])) {
    return(g)
  }

  # 2) Si tenemos mapeo explícito a hoja/datos en section_map (opcional)
  if (!is.na(i) && "data_table" %in% names(section_map)) {
    dt <- as_chr1(section_map$data_table[i])
    if (nz1(dt)) return(dt)
  }

  # 3) Por defecto, principal
  main_name
}


# --- NUEVO: hoja de una variable (principal vs repeat) -----------------------
hoja_de_variable <- function(var, survey, section_map, main_name = "(principal)") {
  v <- as_chr1(var); if (!nz1(v)) return(NA_character_)
  i <- match(v, as.character(survey$name))
  if (is.na(i)) return(NA_character_)  # var no encontrada en survey
  gname <- as_chr1(survey$group_name[i])
  tabla_destino_de(gname, section_map, main_name = main_name)
}

# --- NUEVO: heurística mínima de agregación para cruces principal → hijo ----
inferir_agreg <- function(var1, varN, hoja_base, hoja_varN) {
  # La guía de agregación sólo debe venir del plan explícito, no de heurísticas.
  # Dejamos estas columnas vacías cuando el plan se genera automáticamente.
  NA_character_
}

nivel_scope <- function(tabla) if (identical(tabla, "(principal)")) 0L else 1L
.pref_de <- function(gname, section_map){
  pf <- section_map$prefix[ match(as_chr1(gname), section_map$group_name) ] %||% "GEN_"
  gsub("\\.", "", as_chr1(pf))
}
.section_label <- function(group_name, section_map){
  if (!nrow(section_map)) return(as_chr1(group_name %||% ""))
  i <- match(as_chr1(group_name), section_map$group_name)
  lab <- section_map$group_label[i] %||% ""
  as_chr1(if (nz1(lab)) lab else (group_name %||% ""))
}
.is_repeat_group <- function(group_name, section_map){
  if (!nrow(section_map)) return(FALSE)
  idx <- match(as_chr1(group_name), section_map$group_name)
  isTRUE(section_map$is_repeat[idx])
}

.recompute_group_name_from_meta <- function(survey, groups_detail){
  if (!nrow(survey) || is.null(groups_detail) || !nrow(groups_detail)) {
    if (!"group_name" %in% names(survey)) survey$group_name <- NA_character_
    return(survey)
  }

  # asegurar columna destino
  if (!"group_name" %in% names(survey)) survey$group_name <- NA_character_

  gd <- groups_detail %>% dplyr::transmute(
    gname     = as.character(gname),
    begin_row = as.integer(begin_row),
    end_row   = as.integer(end_row),
    depth     = as.integer(depth)
  )

  if (!"q_order" %in% names(survey)) survey$q_order <- seq_len(nrow(survey))

  idx <- integer(nrow(survey))
  for (i in seq_len(nrow(survey))) {
    qo <- suppressWarnings(as.integer(survey$q_order[i]))
    cand <- which(qo >= gd$begin_row & qo <= gd$end_row)
    if (length(cand)) cand <- cand[which.max(gd$depth[cand])] else cand <- 0L
    idx[i] <- cand
  }

  new_g <- ifelse(idx > 0L, gd$gname[idx], NA_character_)

  # solo rellenar si group_name está vacío/NA
  keep <- !is.na(survey$group_name) & nzchar(trimws(as.character(survey$group_name)))
  survey$group_name <- ifelse(keep, survey$group_name, new_g)

  survey
}

# =============================================================================
# Apertura de sección (G-map) a partir de group_relevant
# =============================================================================
relevant_a_r_y_humano <- function(rel_raw, survey, choices, meta){
  x <- as.character(rel_raw %||% ""); if (!nzchar(x)) return(list(expr_r="", human="", vars=character(0)))
  x <- gsub("[\u00A0\u2007\u202F]", " ", x)
  x <- gsub("\u201C|\u201D", "\"", x); x <- gsub("\u2018|\u2019", "'",  x)
  x <- gsub("\\s+", " ", trimws(x))
  original <- x

  expr_out  <- x; human_out <- x

  # selected(${var}, 'opt') → grepl(...)
  m <- stringr::str_match_all(x, "selected\\(\\$\\{([A-Za-z0-9_]+)\\},\\s*'([^']+)'\\)")
  if (length(m) && length(m[[1]]) > 0){
    mm <- m[[1]]
    for (k in seq_len(nrow(mm))) {
      var <- mm[k, 2]; opt <- mm[k, 3]
      opt_rx <- regex_escape(opt)
      pat <- paste0("(^|\\s)", opt_rx, "(\\s|$)")
      expr_r <- paste0('grepl("', pat, '", ', var, ', perl = TRUE)')
      lt <- survey$type[survey$name == var]
      ln <- if (length(lt) && !is.na(lt[1])) sub("^select_(one|multiple)\\s+","", tolower(trimws(lt[1]))) else ""
      var_lab <- lab_pregunta(survey, meta, var)
      opt_lab <- lab_choice(choices, meta, paste0("select_one ", ln), opt)
      human   <- paste0("marcó «", opt_lab, "» en «", var_lab, "»")
      token   <- paste0("selected(${", var, "}, '", opt, "')")
      expr_out  <- gsub(token, expr_r, expr_out,  fixed = TRUE)
      human_out <- gsub(token, human,  human_out, fixed = TRUE)
    }
  }

  # jr:choice-name(..) → as.character(var) (para condición humana basta)
  expr_out <- gsub(
    "jr:choice-name\\s*\\(\\s*([^,]+)\\s*,\\s*'[^']+'\\s*\\)",
    "as.character(\\1)",
    expr_out, perl = TRUE
  )

  # ${var} → var ; human con comillas
  expr_out <- gsub("\\$\\{([A-Za-z0-9_]+)\\}", "\\1", expr_out, perl = TRUE)
  human_out<- gsub("\\$\\{([A-Za-z0-9_]+)\\}", "«\\1»", human_out, perl = TRUE)

  # Operadores
  repl_bin <- function(s, from, to) gsub(from, to, s, perl = TRUE, ignore.case = TRUE)
  expr_out  <- repl_bin(expr_out, "\\band\\b", "&")
  expr_out  <- repl_bin(expr_out, "\\bor\\b",  "|")
  expr_out  <- repl_bin(expr_out, "\\bnot\\b", "!")
  human_out <- repl_bin(human_out,"\\band\\b", "y")
  human_out <- repl_bin(human_out,"\\bor\\b",  "o")
  human_out <- repl_bin(human_out,"\\bnot\\b", "no")

  expr_out <- gsub("(?<![!<>=])=(?!=)", "==", expr_out, perl = TRUE)
  expr_out <- wrap_numeric_in_comparisons(expr_out, survey)
  expr_out <- gsub("\\s+", " ", trimws(expr_out))
  human_out<- gsub("\\s+", " ", trimws(human_out))

  mdrv <- stringr::str_match_all(original, "\\$\\{([A-Za-z0-9_]+)\\}")
  drivers <- if (length(mdrv) && nrow(mdrv[[1]]) > 0) unique(mdrv[[1]][,2]) else character(0)

  list(expr_r = as_chr1(expr_out), human = as_chr1(human_out), vars = drivers)
}

.combine_gate_exprs <- function(parts) {
  parts <- unique(as.character(parts %||% character(0)))
  parts <- parts[nzchar(trimws(parts))]
  if (!length(parts)) return("")
  if (length(parts) == 1L) return(as_chr1(parts))
  paste(paste0("(", parts, ")"), collapse = " & ")
}

.combine_gate_humans <- function(parts) {
  parts <- unique(as.character(parts %||% character(0)))
  parts <- parts[nzchar(trimws(parts))]
  if (!length(parts)) return("")
  paste(parts, collapse = " y ")
}

.group_parent_lookup <- function(groups_detail) {
  if (is.null(groups_detail) || !nrow(groups_detail)) {
    return(stats::setNames(character(0), character(0)))
  }

  gd <- groups_detail %>%
    dplyr::transmute(
      gname = as.character(gname),
      begin_row = as.integer(begin_row),
      end_row = as.integer(end_row),
      depth = as.integer(depth)
    )

  parent <- rep(NA_character_, nrow(gd))

  for (i in seq_len(nrow(gd))) {
    cand <- which(
      gd$begin_row < gd$begin_row[i] &
        gd$end_row >= gd$end_row[i] &
        gd$depth == (gd$depth[i] - 1L)
    )
    if (length(cand)) {
      cand <- cand[which.max(gd$begin_row[cand])]
      parent[i] <- gd$gname[cand]
    }
  }

  stats::setNames(parent, gd$gname)
}

.group_lineage <- function(group_name, parent_lookup) {
  cur <- as_chr1(group_name)
  out <- character(0)
  seen <- character(0)

  while (nzchar(cur) && !cur %in% seen) {
    out <- c(cur, out)
    seen <- c(seen, cur)
    cur <- as_chr1(parent_lookup[[cur]] %||% "")
  }

  out
}

.make_gmap <- function(inst){
  survey <- inst$survey
  choices<- inst$choices %||% tibble()
  meta   <- inst$meta    %||% list()
  sm <- inst$meta$section_map %||% tibble()
  if (!nrow(sm)) return(tibble(group_name=character(), G_expr=character(), G_humano=character(), G_vars=list()))
  if (!"group_relevant" %in% names(sm)) sm$group_relevant <- ""
  sm$group_name     <- trimws(as.character(sm$group_name))
  sm$group_relevant <- as.character(sm$group_relevant); sm$group_relevant[is.na(sm$group_relevant)] <- ""
  parsed_direct <- purrr::map(sm$group_relevant, ~ relevant_a_r_y_humano(.x, survey, choices, meta))
  names(parsed_direct) <- sm$group_name
  parent_lookup <- .group_parent_lookup(meta$groups_detail %||% tibble())

  parsed <- purrr::map(sm$group_name, function(gname) {
    lineage <- .group_lineage(gname, parent_lookup)
    lineage <- lineage[lineage %in% names(parsed_direct)]
    parts <- parsed_direct[lineage]

    exprs <- vapply(parts, function(p) as_chr1(p$expr_r), "")
    humans <- vapply(parts, function(p) as_chr1(p$human), "")
    vars <- unique(unlist(lapply(parts, function(p) p$vars), use.names = FALSE))

    list(
      expr_r = .combine_gate_exprs(exprs),
      human = .combine_gate_humans(humans),
      vars = vars
    )
  })

  tibble(
    group_name = sm$group_name,
    G_expr     = vapply(parsed, function(p) as_chr1(p$expr_r), ""),
    G_humano   = vapply(parsed, function(p) as_chr1(p$human),  ""),
    G_vars     = lapply(parsed,  function(p) p$vars)
  )
}

# =============================================================================
# Detección de drivers en expresiones (para Variable 2/3)
# =============================================================================
.norm_rule_name <- function(x){ x <- as.character(x %||% ""); gsub("\\.", "_", x, perl = TRUE) }
.drivers_from_expr <- function(expr, survey_names){
  out <- character(0); if (!nz1(expr)) return(out)
  txt <- as_chr1(expr)
  m2 <- gregexpr("\\b[A-Za-z][A-Za-z0-9_]*\\b", txt, perl = TRUE)
  vars <- if (m2[[1]][1] != -1) regmatches(txt, m2)[[1]] else character(0)
  excl <- c("if","else","and","or","true","false","TRUE","FALSE","today","now","position","indexed","repeat",
            "selected","count","sum","regex","min","max","round","int","join","concat","paste","paste0",
            "selected_at","count_selected","INDEXED_REPEAT","position_dot","choice_label_map","as","character","numeric","Date","c")
  vars <- vars[!(tolower(vars) %in% tolower(excl))]
  vars[vars %in% as.character(survey_names)]
}
.take_var2_var3 <- function(cands){
  cands <- unique(as.character(cands %||% character(0)))
  list(v2 = cands[1] %||% NA_character_, v3 = cands[2] %||% NA_character_)
}

# =============================================================================
# BUILDERS
# =============================================================================

# ---- Required ---------------------------------------------------------------
build_required_g <- function(survey, section_map, meta, gmap){
  dat <- survey %>%
    filter(!is.na(.data$name)) %>%
    mutate(type_base = tolower(trimws(sub("\\s.*$", "", .data$type)))) %>%
    filter(.data$required %in% TRUE,
           .data$type_base %in% c("select_one","select_multiple","integer","decimal","text","date","datetime","string"),
           !.data$type_base %in% c("note","begin_group","end_group","acknowledge","calculate"))
  if (!nrow(dat)) return(tibble())

  purrr::pmap_dfr(dat, function(...){
    row <- list(...)
    var  <- row$name
    lab1 <- lab_pregunta(survey, meta, var)
    tipo <- as_chr1(row$type_base)
    gname<- as_chr1(row$group_name)
    tabla<- tabla_destino_de(gname, section_map, main_name = "(principal)")
    nivel<- nivel_scope(tabla)
    secc <- gname

    G_row <- gmap[gmap$group_name == gname, , drop = FALSE]
    G_r <- as_chr1(if (nrow(G_row)) G_row$G_expr[[1]] else "")
    G_h <- as_chr1(if (nrow(G_row)) G_row$G_humano[[1]] else "")

    rel_parsed <- relevant_a_r_y_humano(as_chr1(row$relevant %||% ""), survey, NULL, meta)
    REL_r <- as_chr1(rel_parsed$expr_r); REL_h <- as_chr1(rel_parsed$human)

    cond_r <- if (nz1(G_r) && nz1(REL_r)) paste0("(", G_r, ") & (", REL_r, ")") else if (nz1(G_r)) G_r else if (nz1(REL_r)) REL_r else ""

    drivers <- .drivers_from_expr(REL_r, survey$name); drs <- .take_var2_var3(drivers)

    secc_label <- .section_label(gname, section_map)
    apertura   <- if (nz1(G_h) || nz1(REL_h)) {
      if (nz1(G_h) && nz1(REL_h)) {
        if (identical(trimws(G_h), trimws(REL_h))) sprintf("Si la sección «%s» se abre (%s), ", secc_label, G_h)
        else sprintf("Si la sección «%s» se abre (%s) y además (%s), ", secc_label, G_h, REL_h)
      } else if (nz1(G_h)) sprintf("Si la sección «%s» se abre (%s), ", secc_label, G_h)
      else sprintf("Si (%s), ", REL_h)
    } else ""

    objetivo <- paste0(
      if (.is_repeat_group(gname, section_map)) sprintf("En la hoja de datos «%s» (sección repetida «%s»), ", tabla, secc) else "",
      apertura, "«", lab1, "» debe responderse."
    )

    nombre <- .norm_rule_name(paste0("req_", sanitize_id(var), "_req"))
    proc   <- if (nz1(cond_r)) paste0(nombre, " <- ( (", cond_r, ") & ", es_vacio(var), " )") else paste0(nombre, " <- ", es_vacio(var))

    tibble(
      ID = NA_character_, Tabla = tabla, `Sección` = secc,
      Categoría = "Preguntas de control", Tipo = tipo,
      `Nombre de regla` = nombre, Objetivo = objetivo,
      `Variable 1` = var, `Variable 1 - Etiqueta` = lab1,
      `Variable 2` = drs$v2, `Variable 2 - Etiqueta` = if (!is.na(drs$v2)) lab_pregunta(survey, meta, drs$v2) else NA_character_,
      `Variable 3` = drs$v3, `Variable 3 - Etiqueta` = if (!is.na(drs$v3)) lab_pregunta(survey, meta, drs$v3) else NA_character_,
      `Procesamiento` = proc,
      .grp = gname
    )
  })
}


# ---- Relevant (saltos) ------------------------------------------------------
build_relevant_g <- function(survey, section_map, meta, choices, gmap) {

  dat <- survey %>%
    dplyr::filter(!is.na(.data$name)) %>%
    dplyr::mutate(
      type_base = tolower(trimws(sub("\\s.*$", "", .data$type)))
    ) %>%
    # Solo tipos que tienen sentido para saltos
    dplyr::filter(
      type_base %in% c("select_one", "select_multiple", "integer",
                       "decimal", "text", "date", "datetime", "string"),
      !type_base %in% c("note", "begin_group", "end_group",
                        "acknowledge", "calculate")
    )

  if (!nrow(dat)) return(tibble::tibble())

  purrr::pmap_dfr(dat, function(...) {
    row  <- list(...)
    var  <- row$name
    lab1 <- lab_pregunta(survey, meta, var)
    tipo <- as_chr1(row$type_base)
    req_flag <- {
      s <- tolower(trimws(as.character(row$required %||% "")))
      s <- ifelse(is.na(s), "", s)
      s %in% c("true", "true()", "1", "t")
    }

    gname <- as_chr1(row$group_name)
    secc  <- gname
    tabla <- tabla_destino_de(gname, section_map, main_name = "(principal)")
    nivel <- nivel_scope(tabla)

    # Condición de apertura de grupo (G_expr, G_humano)
    G_row <- gmap[gmap$group_name == gname, , drop = FALSE]
    G_r   <- as_chr1(if (nrow(G_row)) G_row$G_expr[[1]]   else "")
    G_h   <- as_chr1(if (nrow(G_row)) G_row$G_humano[[1]] else "")

    # --- FIX (edge case): si el gate del grupo usa la misma variable, se ignora ---
    # Evita reglas circulares del tipo: "Consent se evalúa solo si Consent == 'Yes'".
    G_r <- .gate_sin_autorreferencia(G_r, var = var, survey_names = survey$name)
    # -----------------------------------------------------------------------------


    # Condición relevant específica de la pregunta
    rel_parsed <- relevant_a_r_y_humano(as_chr1(row$relevant %||% ""), survey, choices, meta)
    REL_r <- as_chr1(rel_parsed$expr_r)
    REL_h <- as_chr1(rel_parsed$human)

    # Condición total en R (grupo + relevant)
    cond_r <- dplyr::case_when(
      nz1(G_r)  && nz1(REL_r) ~ paste0("(", G_r, ") & (", REL_r, ")"),
      nz1(G_r)               ~ G_r,
      nz1(REL_r)             ~ REL_r,
      TRUE                   ~ ""
    )
    if (!nz1(cond_r)) return(tibble::tibble())

    # Variables "driver" del salto
    drivers <- .drivers_from_expr(REL_r, survey$name)
    drs     <- .take_var2_var3(drivers)

    secc_label <- .section_label(gname, section_map)

    # Texto humano para condición DEBE
    apertura_debe <- if (nz1(G_h) || nz1(REL_h)) {
      if (nz1(G_h) && nz1(REL_h)) {
        if (identical(trimws(G_h), trimws(REL_h))) {
          sprintf("Si la sección «%s» se abre (%s), entonces ", secc_label, G_h)
        } else {
          sprintf("Si la sección «%s» se abre (%s) y además (%s), entonces ",
                  secc_label, G_h, REL_h)
        }
      } else if (nz1(G_h)) {
        sprintf("Si la sección «%s» se abre (%s), entonces ", secc_label, G_h)
      } else {
        sprintf("Si (%s), entonces ", REL_h)
      }
    } else ""

    # Texto humano para la condición NODEBE (negación consistente)
    apertura_nodebe <- if (nz1(G_h) || nz1(REL_h)) {
      if (nz1(G_h) && nz1(REL_h)) {
        sprintf("Si la sección «%s» NO se abre o NO se cumple (%s), entonces ", secc_label, REL_h)
      } else if (nz1(G_h)) {
        sprintf("Si la sección «%s» NO se abre, entonces ", secc_label)
      } else {
        sprintf("Si NO se cumple (%s), entonces ", REL_h)
      }
    } else {
      "Si NO se cumple la condición de apertura, entonces "
    }

    # Objetivos
    obj1 <- paste0(
      if (.is_repeat_group(gname, section_map)) sprintf("En la hoja de datos «%s» (sección repetida «%s»), ", tabla, secc) else "",
      apertura_debe, "«", lab1, "» debe responderse."
    )

    obj2 <- paste0(
      if (.is_repeat_group(gname, section_map)) sprintf("En la hoja de datos «%s» (sección repetida «%s»), ", tabla, secc) else "",
      apertura_nodebe, "«", lab1, "» no debe responderse."
    )

    # Nombres de reglas y expresiones en R
    nom1  <- .norm_rule_name(paste0("salto_", sanitize_id(var), "_debe"))
    nom2  <- .norm_rule_name(paste0("salto_", sanitize_id(var), "_nodebe"))
    proc1 <- paste0(nom1, " <- ( (", cond_r, ") & ", es_vacio(var), " )")
    proc2 <- paste0(nom2, " <- ( !(", cond_r, ") & ", no_vacio(var), " )")

    nombres <- nom2
    objetivos <- obj2
    procesos <- proc2
    if (isTRUE(req_flag)) {
      nombres <- c(nom1, nombres)
      objetivos <- c(obj1, objetivos)
      procesos <- c(proc1, procesos)
    }

    n_rules <- length(nombres)

    tibble::tibble(
      ID = NA_character_,
      Tabla = tabla,
      `Sección` = secc,
      Categoría = "Saltos de preguntas",
      Tipo = tipo,
      `Nombre de regla` = nombres,
      Objetivo         = objetivos,
      `Variable 1` = rep(var, n_rules),
      `Variable 1 - Etiqueta` = rep(lab1, n_rules),
      `Variable 2` = rep(drs$v2, n_rules),
      `Variable 2 - Etiqueta` = rep(if (!is.na(drs$v2)) lab_pregunta(survey, meta, drs$v2) else NA_character_, n_rules),
      `Variable 3` = rep(drs$v3, n_rules),
      `Variable 3 - Etiqueta` = rep(if (!is.na(drs$v3)) lab_pregunta(survey, meta, drs$v3) else NA_character_, n_rules),
      `Procesamiento` = procesos,
      .grp = gname
    )
  })
}

# ---- Constraint --------------------------------------------------------------
constraint_a_r <- function(txt, var_name = NULL, survey = NULL){
  if (!nz1(txt %||% "")) return(list(expr = NA_character_))
  x <- as.character(txt)
  x <- gsub("\u201C|\u201D", "\"", x, perl = TRUE)
  x <- gsub("\u2018|\u2019", "'",  x, perl = TRUE)
  if (nz1(var_name)) x <- gsub("(?<![A-Za-z0-9_])\\.(?![A-Za-z0-9_])", var_name, x, perl = TRUE)
  x <- gsub("(?<!<|>|!|<-|=)=(?!=)", "==", x, perl = TRUE)
  x <- gsub("(?i)\\band\\b", "&", x, perl = TRUE)
  x <- gsub("(?i)\\bor\\b",  "|", x, perl = TRUE)
  x <- gsub("(?i)\\bnot\\b", "!", x,  perl = TRUE)
  x <- gsub("selected\\s*\\(\\s*([A-Za-z0-9_\\.]+)\\s*,\\s*'([^']+)'\\s*\\)",
            'grepl("(^|\\\\s)\\2(\\\\s|$)", \\1, perl = TRUE)', x, perl = TRUE)
  # jr:choice-name(...) en constraints no aporta: lo forzamos a as.character(var)
  x <- gsub("jr:choice-name\\s*\\(\\s*([^,]+)\\s*,\\s*'[^']+'\\s*\\)", "as.character(\\1)", x, perl = TRUE)
  x <- gsub("\\$\\{([A-Za-z0-9_]+)\\}", "\\1", x, perl = TRUE)
  x <- wrap_numeric_in_comparisons(x, survey)
  x <- gsub("\\s+", " ", trimws(x))
  list(expr = as_chr1(x))
}
build_constraint_g <- function(survey, section_map, meta, gmap){
  dat <- survey %>%
    filter(!is.na(.data$name)) %>%
    mutate(type_base = tolower(trimws(sub("\\s.*$", "", .data$type)))) %>%
    filter(!is.na(.data$constraint) & nzchar(.data$constraint),
           type_base %in% c("select_one","select_multiple","integer","decimal","text","date","datetime","string"),
           !.data$type_base %in% c("note","begin_group","end_group","acknowledge","calculate"))
  if (!nrow(dat)) return(tibble())

  purrr::pmap_dfr(dat, function(...){
    row <- list(...)
    var  <- row$name
    lab1 <- lab_pregunta(survey, meta, var)
    tipo <- as_chr1(row$type_base)
    gname<- as_chr1(row$group_name); secc <- gname
    tabla<- tabla_destino_de(gname, section_map, main_name = "(principal)"); nivel <- nivel_scope(tabla)

    G_row <- gmap[gmap$group_name == gname, , drop = FALSE]
    G_r <- as_chr1(if (nrow(G_row)) G_row$G_expr[[1]] else "")
    G_h <- as_chr1(if (nrow(G_row)) G_row$G_humano[[1]] else "")

    rel_parsed <- relevant_a_r_y_humano(as_chr1(row$relevant %||% ""), survey, NULL, meta)
    REL_r <- as_chr1(rel_parsed$expr_r); REL_h <- as_chr1(rel_parsed$human)
    cond_expr <- if (nz1(G_r) && nz1(REL_r)) paste0("(", G_r, ") & (", REL_r, ")") else if (nz1(G_r)) G_r else if (nz1(REL_r)) REL_r else ""

    ca <- constraint_a_r(as_chr1(row$constraint), var_name = var, survey = survey)
    rhs_r <- as_chr1(ca$expr); if (!nz1(rhs_r)) return(tibble())

    drivers <- unique(c(.drivers_from_expr(rhs_r, survey$name), .drivers_from_expr(REL_r, survey$name)))
    drs <- .take_var2_var3(drivers)

    secc_label <- .section_label(gname, section_map)
    apertura   <- if (nz1(G_h) || nz1(REL_h)) {
      if (nz1(G_h) && nz1(REL_h)) {
        if (identical(trimws(G_h), trimws(REL_h))) sprintf("Si la sección «%s» se abre (%s), ", secc_label, G_h)
        else sprintf("Si la sección «%s» se abre (%s) y además (%s), ", secc_label, G_h, REL_h)
      } else if (nz1(G_h)) sprintf("Si la sección «%s» se abre (%s), ", secc_label, G_h)
      else sprintf("Si (%s), ", REL_h)
    } else ""

    objetivo <- paste0(
      if (.is_repeat_group(gname, section_map)) sprintf("En la hoja de datos «%s» (sección repetida «%s»), ", tabla, secc) else "",
      apertura, "«", lab1, "» respeta la regla del formulario."
    )

    nom  <- .norm_rule_name(paste0("cons_", sanitize_id(var), "_form"))
    proc <- if (nz1(cond_expr)) paste0(nom, " <- ( (", cond_expr, ") & !(", rhs_r, ") )") else paste0(nom, " <- ( !(", rhs_r, ") )")

    tibble(
      ID = NA_character_, Tabla = tabla, `Sección` = secc,
      Categoría = "Consistencia", Tipo = tipo, `Nombre de regla` = nom, Objetivo = objetivo,
      `Variable 1` = var, `Variable 1 - Etiqueta` = lab1,
      `Variable 2` = drs$v2, `Variable 2 - Etiqueta` = if (!is.na(drs$v2)) lab_pregunta(survey, meta, drs$v2) else NA_character_,
      `Variable 3` = drs$v3, `Variable 3 - Etiqueta` = if (!is.na(drs$v3)) lab_pregunta(survey, meta, drs$v3) else NA_character_,
      `Procesamiento` = proc,
      .grp = gname
    )
  })
}


# ============================================
# Calculate: multi-builder G/Repeat-aware (OK)
# ============================================

# --- Helpers de igualdad NA-segura ---
eq_num_na <- function(a, b){
  aa <- suppressWarnings(as.numeric(a))
  bb <- suppressWarnings(as.numeric(b))
  ( (is.na(aa) & is.na(bb)) | (aa == bb) )
}
eq_chr_na <- function(a, b){
  aa <- ifelse(is.na(as.character(a)), NA_character_, trimws(as.character(a)))
  bb <- ifelse(is.na(as.character(b)), NA_character_, trimws(as.character(b)))
  aa[nchar(aa) == 0L] <- NA_character_
  bb[nchar(bb) == 0L] <- NA_character_
  ( (is.na(aa) & is.na(bb)) | (aa == bb) )
}

# --- Detectores de patrones ---
.calc_has_time    <- function(s) grepl("\\bonce\\s*\\(|\\bnow\\s*\\(|\\btoday\\s*\\(", s, ignore.case = TRUE)
.calc_has_random  <- function(s) grepl("\\brandom\\s*\\(", s, ignore.case = TRUE)
.calc_has_indexed <- function(s) grepl("indexed-?repeat\\s*\\(", s, ignore.case = TRUE)
.calc_has_posdot  <- function(s) grepl("position\\s*\\(\\s*\\.\\.?\\s*\\)", s, ignore.case = TRUE)

.calc_is_concat   <- function(s) grepl("\\bconcat\\s*\\(|\\bjoin\\s*\\(", s, ignore.case = TRUE)
.calc_is_choice   <- function(s) grepl("jr:choice-name\\s*\\(", s, ignore.case = TRUE)
.calc_is_countsel <- function(s) grepl("count\\s*-?\\s*selected\\s*\\(", s, ignore.case = TRUE)
.calc_is_sel_at   <- function(s) grepl("selected-at\\s*\\(", s, ignore.case = TRUE)
.calc_is_agg_sum  <- function(s) grepl("\\bsum\\s*\\(", s)
.calc_is_agg_cnt  <- function(s) grepl("\\bcount\\s*\\(", s) # OJO: distinto a count-selected

# ¿Se ve claramente “numérico” (solo operadores y variables)?
.calc_looks_numeric <- function(s){
  s0 <- gsub("\\$\\{[^}]+\\}", "X", s)
  s0 <- gsub("\\bif\\s*\\(", "", s0, ignore.case = TRUE)
  s0 <- gsub("\\bifelse\\s*\\(", "", s0, ignore.case = TRUE)  # <-- NUEVO
  s0 <- gsub("[[:space:]]+", "", s0)
  if (grepl("jr:choice-name|concat|join|selected-at|count\\s*-?\\s*selected", s0, ignore.case = TRUE)) return(FALSE)
  grepl("^[0-9X+*/()., <>!=&|\\-]*$", s0, perl = TRUE)
}

# --- Normalizador común ODK → R para RHS ---
.calc_normalize_common <- function(txt){
  x <- as.character(txt %||% "")
  # comillas tipográficas
  x <- gsub("\u201C|\u201D", "\"", x, perl = TRUE)
  x <- gsub("\u2018|\u2019", "'",  x, perl = TRUE)

  # ${var} → var ; lógicos; if() → ifelse()
  x <- gsub("\\$\\{([A-Za-z0-9_]+)\\}", "\\1", x, perl = TRUE)
  x <- gsub("(?i)\\band\\b", "&", x, perl = TRUE)
  x <- gsub("(?i)\\bor\\b",  "|", x, perl = TRUE)
  x <- gsub("(?i)\\bnot\\b", "!", x,  perl = TRUE)
  x <- gsub("(?i)\\bif\\s*\\(", "ifelse(", x, perl = TRUE)

  # jr:choice-name(var, 'LIST'|"LIST") → as.character(var)
  x <- gsub(
    "jr:choice-name\\s*\\(\\s*([^,]+)\\s*,\\s*(['\"])\\s*[^'\"]+\\s*\\2\\s*\\)",
    "as.character(\\1)", x, perl = TRUE
  )

  # count-selected(var) → número de opciones marcadas
  x <- gsub(
    "count\\s*-?\\s*selected\\s*\\(\\s*([A-Za-z0-9_\\.]+)\\s*\\)",
    "ifelse(is.na(\\1)|trimws(\\1)==\"\",0,1+stringr::str_count(\\1, \"\\\\s+\"))",
    x, perl = TRUE
  )

  # concat/join
  x <- gsub("\\bconcat\\s*\\(", "paste0(", x, perl = TRUE)
  x <- gsub("join\\s*\\(\\s*\"([^\"]*)\"\\s*,\\s*([^\\)]+)\\)", "paste(\\2, collapse = \"\\1\")", x, perl = TRUE)
  x <- gsub("join\\s*\\(\\s*'([^']*)'\\s*,\\s*([^\\)]+)\\)", "paste(\\2, collapse = '\\1')", x, perl = TRUE)

  # selected-at( → selected_at(
  x <- gsub("selected-at\\s*\\(", "selected_at(", x, perl = TRUE)

  # --- regex(texto, patron)  -->  grepl(patron, texto, perl = TRUE)
  x <- gsub(
    "\\bregex\\s*\\(\\s*([^,]+?)\\s*,\\s*([^\\)]+?)\\s*\\)",
    "grepl(\\2, \\1, perl = TRUE)",
    x, perl = TRUE
  )

  # descomillar literales numéricos en comparaciones
  x <- gsub("([<>]=?|==|!=)\\s*\"([0-9]+)\"", "\\1 \\2", x, perl = TRUE)
  x <- gsub("([<>]=?|==|!=)\\s*'([0-9]+)'", "\\1 \\2", x, perl = TRUE)

  x <- gsub("\\s+", " ", trimws(x))

  # --- selected(var, 'opt')  -->  grepl("(^|\\s)opt(\\s|$)", var, perl = TRUE)
  x <- gsub(
    "selected\\s*\\(\\s*([A-Za-z0-9_\\.]+)\\s*,\\s*'([^']+)'\\s*\\)",
    'grepl("(^|\\\\s)\\2(\\\\s|$)", \\1, perl = TRUE)',
    x, perl = TRUE
  )
  x <- gsub(
    'selected\\s*\\(\\s*([A-Za-z0-9_\\.]+)\\s*,\\s*"([^"]+)"\\s*\\)',
    'grepl("(^|\\\\s)\\2(\\\\s|$)", \\1, perl = TRUE)',
    x, perl = TRUE
  )
}

# --- Clasificador por “familias” ---
calc_detect_type <- function(txt){
  raw <- as.character(txt %||% "")
  res <- list(kind = NA_character_, rhs_raw = raw, rhs_r = NA_character_, ejecutable = FALSE)

  # No ejecutables por diseño
  if (.calc_has_time(raw) || .calc_has_random(raw) || .calc_has_indexed(raw) || .calc_has_posdot(raw)) {
    res$kind <- "no_ejecutable"; return(res)
  }

  rhs_r <- .calc_normalize_common(raw)
  res$rhs_r <- rhs_r

  # Prioridad de detección
  if (.calc_is_countsel(raw))               { res$kind <- "count_selected";      res$ejecutable <- TRUE; return(res) }
  if (.calc_is_sel_at(raw)) {
    # Sólo si el índice es literal numérico; si no, lo ignoramos por ahora
    if (grepl("selected-at\\s*\\(.*?,\\s*[0-9]+\\s*\\)", raw, perl = TRUE)) {
      res$kind <- "selected_at_literal";    res$ejecutable <- TRUE; return(res)
    } else { res$kind <- "no_ejecutable"; return(res) }
  }
  if (.calc_is_choice(raw))                 { res$kind <- "choice_label";        res$ejecutable <- TRUE; return(res) }
  if (.calc_is_concat(raw))                 { res$kind <- "concat_join";         res$ejecutable <- TRUE; return(res) }
  if (.calc_is_agg_sum(raw) || .calc_is_agg_cnt(raw)) {
    res$kind <- "agg_repeat";           res$ejecutable <- TRUE; return(res)
  }
  if (.calc_looks_numeric(raw))             { res$kind <- "numeric";             res$ejecutable <- TRUE; return(res) }

  # fallback: texto genérico
  res$kind <- "texto_generico"; res$ejecutable <- TRUE
  res
}

# --- Objetivo humano según familia ---
calc_objetivo_por_tipo <- function(kind, tabla, secc, secc_label, G_h, REL_h, lab1, section_map){
  apertura <- .hum_opening_with_section(secc_label, G_h, REL_h)
  scope <- if (.is_repeat_group(secc, section_map))
    sprintf("En la hoja de datos «%s» (sección repetida «%s»), ", tabla, secc) else ""

  base <- switch(kind,
                 "numeric"             = "coincide con el cálculo numérico definido.",
                 "concat_join"         = "coincide con el texto/combinación definido.",
                 "choice_label"        = "coincide con la etiqueta/valor esperado según la lista de opciones.",
                 "count_selected"      = "coincide con el número de opciones seleccionadas.",
                 "selected_at_literal" = "coincide con el elemento esperado para el índice indicado.",
                 "agg_repeat"          = "coincide con el agregado (suma/conteo) calculado a partir de los registros repetidos.",
                 "texto_generico"      = "coincide con el resultado del cálculo definido.",
                 "no_ejecutable"       = "requiere preprocesamiento y no se evalúa en esta etapa."
  )

  paste0(scope, apertura, "«", lab1, "» ", base)
}

# --- Generador de comparación (TRUE = inconsistencia) ---
calc_comparacion_por_tipo <- function(kind, var, rhs_r){
  is_text_rhs <- switch(kind,
                        "numeric"             = FALSE,
                        "concat_join"         = TRUE,
                        "choice_label"        = TRUE,
                        "count_selected"      = FALSE,
                        "selected_at_literal" = TRUE,
                        "agg_repeat"          = FALSE,
                        "texto_generico"      = TRUE,
                        TRUE
  )
  if (is_text_rhs) paste0("!eq_chr_na(", var, ", ", rhs_r, ")")
  else             paste0("!eq_num_na(", var, ", ", rhs_r, ")")
}

.calc_list_name_from_question <- function(var, survey) {
  if (!nz1(var) || !is.data.frame(survey) || !nrow(survey)) return(NA_character_)
  i <- match(var, as.character(survey$name))
  if (is.na(i)) return(NA_character_)

  if ("list_name" %in% names(survey) && nz1(as_chr1(survey$list_name[i] %||% ""))) {
    return(as_chr1(survey$list_name[i]))
  }

  type_txt <- as_chr1(survey$type[i] %||% "")
  if (!grepl("^select_(one|multiple)\\s+", type_txt)) return(NA_character_)
  trimws(sub("^select_(one|multiple)\\s+", "", type_txt))
}

.r_string_literal <- function(x) {
  x <- as.character(x %||% "")
  x <- gsub("\\\\", "\\\\\\\\", x, perl = TRUE)
  x <- gsub("\"", "\\\\\"", x, perl = TRUE)
  paste0("\"", x, "\"")
}

.r_named_char_vector <- function(keys, vals) {
  if (!length(keys)) return("c()")
  pairs <- paste0(.r_string_literal(keys), " = ", .r_string_literal(vals))
  paste0("c(", paste(pairs, collapse = ", "), ")")
}

.calc_choice_label_rhs <- function(raw, survey, choices, meta) {
  txt <- as_chr1(raw %||% "")
  if (!nz1(txt)) return(list(ok = FALSE))

  m <- regexec(
    "jr:choice-name\\s*\\(\\s*([^,]+?)\\s*,\\s*(['\"])(.*?)\\2\\s*\\)",
    txt,
    perl = TRUE
  )
  mm <- regmatches(txt, m)[[1]]
  if (!length(mm)) return(list(ok = FALSE))

  value_expr <- gsub("\\$\\{([A-Za-z0-9_]+)\\}", "\\1", mm[2], perl = TRUE)
  value_expr <- trimws(value_expr)
  value_var <- if (grepl("^[A-Za-z][A-Za-z0-9_]*$", value_expr)) value_expr else NA_character_

  ref_raw <- trimws(mm[4])
  ref_var <- if (grepl("^\\$\\{[A-Za-z0-9_]+\\}$", ref_raw)) {
    sub("^\\$\\{([A-Za-z0-9_]+)\\}$", "\\1", ref_raw)
  } else if (ref_raw %in% as.character(survey$name)) {
    ref_raw
  } else {
    NA_character_
  }

  list_name <- .calc_list_name_from_question(ref_var, survey)
  if (!nz1(list_name)) list_name <- .calc_list_name_from_question(value_var, survey)

  if (!nz1(list_name) && is.data.frame(choices) && nrow(choices)) {
    list_names <- tolower(trimws(as.character(choices$list_name %||% "")))
    list_norms <- if ("list_norm" %in% names(choices)) tolower(trimws(as.character(choices$list_norm %||% ""))) else rep("", nrow(choices))
    ref_norm <- tolower(trimws(ref_raw))
    if (ref_norm %in% c(list_names, list_norms)) list_name <- ref_raw
  }

  if (!nz1(list_name) || !is.data.frame(choices) || !nrow(choices)) {
    return(list(ok = FALSE))
  }

  label_col <- as_chr1(meta$label_col_choices %||% meta$label_col_survey %||% "label")
  if (!label_col %in% names(choices)) return(list(ok = FALSE))

  list_norm_target <- tolower(trimws(list_name))
  list_names <- tolower(trimws(as.character(choices$list_name %||% "")))
  list_norms <- if ("list_norm" %in% names(choices)) tolower(trimws(as.character(choices$list_norm %||% ""))) else rep("", nrow(choices))

  ch_ln <- choices[list_names == list_norm_target | list_norms == list_norm_target, , drop = FALSE]
  if (!nrow(ch_ln)) return(list(ok = FALSE))

  mapping <- ch_ln %>%
    dplyr::transmute(
      code = as.character(.data$name),
      label = as.character(.data[[label_col]])
    ) %>%
    dplyr::filter(!is.na(.data$code) & nzchar(trimws(.data$code))) %>%
    dplyr::group_by(.data$code) %>%
    dplyr::slice(1) %>%
    dplyr::ungroup()

  if (!nrow(mapping)) return(list(ok = FALSE))

  mapping$label[is.na(mapping$label) | !nzchar(trimws(mapping$label))] <- mapping$code[is.na(mapping$label) | !nzchar(trimws(mapping$label))]

  list(
    ok = TRUE,
    rhs_r = paste0("choice_label_map(", value_expr, ", ", .r_named_char_vector(mapping$code, mapping$label), ")")
  )
}

# --- Builder maestro de calculate ---
build_calculate_g <- function(survey, section_map, meta, gmap, choices = tibble()){
  dat <- survey %>%
    dplyr::filter(!is.na(.data$name)) %>%
    dplyr::mutate(type_base = tolower(trimws(sub("\\s.*$", "", .data$type)))) %>%
    dplyr::filter(type_base == "calculate", !is.na(.data$calculation) & nzchar(.data$calculation))
  if (!nrow(dat)) return(tibble::tibble())

  purrr::pmap_dfr(dat, function(...){
    row   <- list(...)
    var   <- row$name
    lab1  <- lab_pregunta(survey, meta, var)
    gname <- as_chr1(row$group_name); secc <- gname
    tipo  <- "calculate"
    tabla <- tabla_destino_de(gname, section_map, main_name = "(principal)"); nivel <- nivel_scope(tabla)

    # Apertura de sección (G) + relevant del ítem
    G_row <- gmap[gmap$group_name == gname, , drop = FALSE]
    G_r <- as_chr1(if (nrow(G_row)) G_row$G_expr[[1]] else "")
    G_h <- as_chr1(if (nrow(G_row)) G_row$G_humano[[1]] else "")

    rel_parsed <- relevant_a_r_y_humano(as_chr1(row$relevant %||% ""), survey, NULL, meta)
    REL_r <- as_chr1(rel_parsed$expr_r); REL_h <- as_chr1(rel_parsed$human)
    cond_expr <- if (nz1(G_r) && nz1(REL_r)) paste0("(", G_r, ") & (", REL_r, ")")
    else if (nz1(G_r)) G_r else if (nz1(REL_r)) REL_r else ""

    # Clasificación y normalización del RHS
    det   <- calc_detect_type(as_chr1(row$calculation))
    if (!isTRUE(det$ejecutable)) return(tibble::tibble())
    rhs_r <- as_chr1(det$rhs_r); if (!nz1(rhs_r)) return(tibble::tibble())

    if (identical(det$kind, "choice_label")) {
      choice_rhs <- .calc_choice_label_rhs(as_chr1(row$calculation), survey, choices, meta)
      if (!isTRUE(choice_rhs$ok)) return(tibble::tibble())
      rhs_r <- as_chr1(choice_rhs$rhs_r)
    }

    # (a) Corregir comparaciones numéricas incluso si el cálculo global es textual
    rhs_r <- wrap_numeric_in_comparisons(rhs_r, survey)

    # (b) Si el cálculo es numérico "puro", envolver tokens numéricos de forma amplia (tu wrapper actual)
    if (identical(det$kind, "numeric")) {
      rhs_r <- wrap_numeric_tokens(rhs_r, survey)
    }

    # (c) Agregados repeat: tu regla existente
    if (identical(det$kind, "agg_repeat")) {
      rhs_r <- gsub("\\bcount\\s*\\(\\s*([A-Za-z0-9_]+)\\s*\\)", "n_\\1", rhs_r, perl = TRUE)
    }

    # Drivers para Var2/Var3 (descriptivo)
    d_calc <- .drivers_from_expr(rhs_r, survey$name)
    d_rel  <- .drivers_from_expr(REL_r,  survey$name)
    drivers <- unique(c(d_calc, d_rel)); drs <- .take_var2_var3(drivers)

    # Objetivo humano específico
    secc_label <- .section_label(gname, section_map)
    objetivo   <- calc_objetivo_por_tipo(det$kind, tabla, secc, secc_label, G_h, REL_h, lab1, section_map)

    # Procesamiento (TRUE = inconsistencia)
    comp   <- calc_comparacion_por_tipo(det$kind, var, rhs_r)
    nombre <- paste0("calc_", sanitize_id(var), "_eq")
    nombre <- gsub("\\.", "_", nombre, perl = TRUE)
    proc   <- if (nz1(cond_expr)) paste0(nombre, " <- ( (", cond_expr, ") & ", comp, " )") else paste0(nombre, " <- ", comp)

    tibble::tibble(
      ID = NA_character_, Tabla = tabla, `Sección` = secc,
      Categoría = "Valores calculados", Tipo = tipo,
      `Nombre de regla` = nombre, Objetivo = objetivo,
      `Variable 1` = var, `Variable 1 - Etiqueta` = lab1,
      `Variable 2` = drs$v2, `Variable 2 - Etiqueta` = if (!is.na(drs$v2)) lab_pregunta(survey, meta, drs$v2) else NA_character_,
      `Variable 3` = drs$v3, `Variable 3 - Etiqueta` = if (!is.na(drs$v3)) lab_pregunta(survey, meta, drs$v3) else NA_character_,
      `Procesamiento` = proc,
      .grp = gname
    )
  })
}


# ---- Choice filter (select_one) — con "no aplica" y objetivo humanizado ----
build_choice_filter_g <- function(inst, gmap){
  survey      <- inst$survey
  choices     <- inst$choices %||% tibble()
  section_map <- inst$meta$section_map %||% tibble()
  ccols_map   <- inst$meta$choice_cols_by_list %||% tibble(list_name=character(), extra_cols=list())
  meta        <- inst$meta %||% list()
  if (!nrow(survey)) return(tibble())

  dat <- survey %>%
    dplyr::filter(!is.na(.data$name)) %>%
    dplyr::mutate(
      type_base     = tolower(trimws(sub("\\s.*$", "", .data$type))),
      choice_filter = ifelse(is.na(.data$choice_filter), "", .data$choice_filter)
    ) %>%
    dplyr::filter(type_base == "select_one", nzchar(choice_filter), nzchar(list_name))
  if (!nrow(dat)) return(tibble())

  purrr::pmap_dfr(dat, function(...){
    row   <- list(...)
    var   <- row$name
    lab   <- lab_pregunta(survey, meta, var)
    gname <- as_chr1(row$group_name)
    secc  <- gname
    tipo  <- as_chr1(row$type_base)
    ln    <- row$list_name

    # Apertura de grupo y relevant
    G_row <- gmap[gmap$group_name == gname, , drop = FALSE]
    G_r <- as_chr1(if (nrow(G_row)) G_row$G_expr[[1]]   else "")
    G_h <- as_chr1(if (nrow(G_row)) G_row$G_humano[[1]] else "")

    rel_parsed <- tryCatch(
      relevant_a_r_y_humano(as_chr1(row$relevant %||% ""), survey, choices, meta),
      error = function(e) list(expr_r = "", human = "")
    )
    rel_r <- as_chr1(rel_parsed$expr_r %||% "")
    rel_h <- as_chr1(rel_parsed$human  %||% "")

    cond_r <- if (nz1(G_r) && nz1(rel_r)) paste0("(", G_r, ") & (", rel_r, ")")
    else if (nz1(G_r)) G_r
    else if (nz1(rel_r)) rel_r
    else ""

    # Drivers declarados en meta como columnas filter_*
    extras      <- ccols_map$extra_cols[[ match(ln, ccols_map$list_name) ]] %||% character(0)
    cols_driver <- extras[grepl("^filter_", extras)]
    if (!length(cols_driver)) return(tibble())

    ch_ln <- choices[choices$list_name == ln, , drop = FALSE]
    if (!nrow(ch_ln)) return(tibble())

    # Metadatos de sección/tabla
    tabla      <- tabla_destino_de(gname, section_map, main_name = "(principal)")
    secc_label <- .section_label(gname, section_map)
    apertura   <- if (nz1(G_h) || nz1(rel_h)) {
      if (nz1(G_h) && nz1(rel_h)) {
        if (identical(trimws(G_h), trimws(rel_h))) sprintf("Si la sección «%s» se abre (%s), ", secc_label, G_h)
        else sprintf("Si la sección «%s» se abre (%s) y además (%s), ", secc_label, G_h, rel_h)
      } else if (nz1(G_h)) sprintf("Si la sección «%s» se abre (%s), ", secc_label, G_h)
      else sprintf("Si (%s), ", rel_h)
    } else ""

    purrr::map_dfr(cols_driver, function(colf){

      drv <- sub("^filter_", "", colf)
      if (!drv %in% survey$name) return(tibble())
      drv_lab <- lab_pregunta(survey, meta, drv)

      # Mapa: valor de la hija (var) -> conjunto permitido del driver (drv)
      ch_tmp <- ch_ln %>%
        dplyr::mutate(
          name_chr = as.character(.data$name),
          filter_v = as.character(.data[[colf]])
        )

      rows_ok <- split(ch_tmp$filter_v, ch_tmp$name_chr)  # "valor var" -> c('2','3','4','5', ...)
      rows_ok <- lapply(rows_ok, function(v){
        vv <- unique(na.omit(as.character(v)))
        vv[nzchar(vv)]
      })
      rows_ok <- Filter(function(v) length(v) > 0, rows_ok)
      if (!length(rows_ok)) return(tibble())

      # Casos OK mapeados: (var == 'k' & drv %in% {…})
      driver_cases <- lapply(names(rows_ok), function(k){
        allowed  <- rows_ok[[k]]
        allowed_q <- paste0("'", gsub("'", "\\\\'", allowed), "'", collapse = ",")
        sprintf("(%s == '%s' & trimws(as.character(%s)) %%in%% c(%s))",
                var, gsub("'", "\\\\'", k), drv, allowed_q)
      })
      driver_cases <- Filter(Negate(is.null), driver_cases)

      # Permisos NA/vacío (no marcar cuando no aplica por falta de info)
      permiso_na <- sprintf("is.na(%s) | !nzchar(trimws(as.character(%s))) | is.na(%s)", var, var, drv)

      # *** FIX CLAVE: NO APLICA si la hija no está entre las claves del filtro ***
      keys        <- names(rows_ok)
      keys_q      <- paste0("'", gsub("'", "\\\\'", keys), "'", collapse = ",")
      perm_noaplica <- sprintf("!(trimws(as.character(%s)) %%in%% c(%s))", var, keys_q)

      # OK final = (casos mapeados) OR (NA/vacío) OR (NO APLICA)
      ok_expr <- paste(c(unlist(driver_cases), permiso_na, perm_noaplica), collapse = " | ")

      # TRUE = violación (tu convención)
      nom  <- .norm_rule_name(paste0("cons_", sanitize_id(var), "_cf_", sanitize_id(drv)))
      base <- paste0("!(", ok_expr, ")")
      proc <- if (nz1(cond_r)) paste0(nom, " <- ( (", cond_r, ") & ", base, " )")
      else paste0(nom, " <- ", base)

      # Objetivo: claro, conciso y humano
      resumen_filtro <- purrr::imap_chr(rows_ok, function(v, k) {
        v_text <- paste(unique(v), collapse = ", ")
        sprintf("cuando «%s» = '%s', «%s» debe estar en {%s}", lab, k, drv_lab, v_text)
      }) |> paste(collapse = "; ")

      obj <- paste0(
        if (.is_repeat_group(gname, section_map))
          sprintf("En la hoja de datos «%s» (sección repetida «%s»), ", tabla, secc)
        else "",
        apertura,
        "de acuerdo con la lógica del cuestionario, las respuestas en «", lab, "» y «", drv_lab,
        "» deben guardar coherencia. En particular: ", resumen_filtro, "."
      )

      tibble::tibble(
        ID = NA_character_,
        Tabla = tabla,
        `Sección` = secc,
        Categoría = "Filtro de opciones",
        Tipo = tipo,
        `Nombre de regla` = nom,
        Objetivo = obj,
        `Variable 1` = var,
        `Variable 1 - Etiqueta` = lab,
        `Variable 2` = drv,
        `Variable 2 - Etiqueta` = drv_lab,
        `Variable 3` = NA_character_,
        `Variable 3 - Etiqueta` = NA_character_,
        `Procesamiento` = proc,
        .grp = gname
      )
    })
  })
}

# ---- REPEAT: existencia mínima (TRUE = inconsistencia) -----------------------
# Genera reglas para cada begin_repeat:
#   rep_<repeat>_min1 <- (Gate AND (is.na(n_<repeat>) OR n_<repeat> < 1))
# Hoja base: (principal)  — el runner debe inyectar n_<repeat> por _parent_index
build_repeat_min1 <- function(inst, na_es_inconsistencia = TRUE){
  survey      <- inst$survey
  section_map <- inst$meta$section_map %||% tibble()
  if (!nrow(survey) || !nrow(section_map)) return(tibble())

  # nombres de grupos repeat en survey
  reps <- survey %>%
    transmute(type_base = tolower(trimws(sub("\\s.*$", "", .data$type))),
              name = as.character(.data$name)) %>%
    filter(type_base == "begin_repeat") %>%
    distinct(name) %>% pull(name)

  if (!length(reps)) return(tibble())

  purrr::map_dfr(reps, function(gname){
    secc  <- gname
    tabla <- "(principal)"

    # Gate de apertura de sección (si existe)
    G_row <- (.make_gmap(list(survey=survey, choices=inst$choices, meta=inst$meta)))[,]
    G_r   <- as_chr1(G_row$G_expr[G_row$group_name==gname] %||% "")
    G_h   <- as_chr1(G_row$G_humano[G_row$group_name==gname] %||% "")

    secc_label <- .section_label(gname, section_map)
    apertura   <- if (nz1(G_h)) sprintf("Si la sección «%s» se abre (%s), ", secc_label, G_h) else ""
    objetivo   <- paste0(apertura, "debe existir al menos 1 registro en la hoja de datos «", secc, "».")

    nom <- .norm_rule_name(paste0("rep_", sanitize_id(gname), "_min1"))

    # === RHS (TRUE = inconsistencia) =========================================
    # base: (is.na(n_g) | n_g < 1)
    core <- sprintf("(is.na(n_%s) | n_%s < 1)", gname, gname)
    # permitir tratar NA como consistencia si se desea
    if (!isTRUE(na_es_inconsistencia)) {
      core <- sprintf("(n_%s < 1)", gname)
    }
    # envolver con gate si existe
    proc <- if (nz1(G_r)) {
      sprintf("%s <- ( (%s) & %s )", nom, G_r, core)
    } else {
      sprintf("%s <- %s", nom, core)
    }

    tibble::tibble(
      ID = NA_character_,
      Tabla = tabla,
      `Sección` = secc,
      Categoría = "Registros repetidos",
      Tipo = "repeat_min1",
      `Nombre de regla` = nom,
      Objetivo = objetivo,
      `Variable 1` = secc, `Variable 1 - Etiqueta` = secc,
      `Variable 2` = NA_character_, `Variable 2 - Etiqueta` = NA_character_,
      `Variable 3` = NA_character_, `Variable 3 - Etiqueta` = NA_character_,
      `Procesamiento` = proc,
      .grp = gname
    )
  })
}

# ---- Tiempo (opcional, una regla global) ------------------------------------
# rango_fecha: cadena "YYYY-MM-DD - YYYY-MM-DD"
# campo_fecha: nombre de la variable de fecha; si NULL, se intenta la primera de tipo date/datetime
build_time_window <- function(inst, rango_fecha = NULL, campo_fecha = NULL){
  if (!nz1(rango_fecha)) return(tibble())
  survey <- inst$survey; meta <- inst$meta %||% list()
  survey$date_base <- tolower(trimws(sub("\\s.*$", "", survey$type)))

  # Detecta campo si no se pasa
  if (!nz1(campo_fecha)){
    cand <- survey %>% filter(date_base %in% c("date","datetime")) %>% slice(1)
    if (!nrow(cand)) return(tibble())
    campo_fecha <- as_chr1(cand$name)
  }
  if (!campo_fecha %in% survey$name) return(tibble())

  # Parse rango
  m <- str_match(rango_fecha, "^\\s*(\\d{4}-\\d{2}-\\d{2})\\s*-\\s*(\\d{4}-\\d{2}-\\d{2})\\s*$")
  if (is.na(m[1,2]) || is.na(m[1,3])) return(tibble())
  f_ini <- m[1,2]; f_fin <- m[1,3]

  lab1 <- lab_pregunta(survey, meta, campo_fecha)
  objetivo <- paste0("La fecha «", lab1, "» debe estar dentro del periodo de campo (", f_ini, " a ", f_fin, ").")

  nom <- .norm_rule_name(paste0("cons_", sanitize_id(campo_fecha), "_ventana_fecha"))
  proc <- paste0(nom, " <- ( as.Date(", campo_fecha, ") < as.Date('", f_ini, "') | as.Date(", campo_fecha, ") > as.Date('", f_fin, "') )")

  tibble(
    ID = NA_character_, Tabla = "(principal)", `Sección` = "",
    Categoría = "Consistencia", Tipo = "date",
    `Nombre de regla` = nom, Objetivo = objetivo,
    `Variable 1` = campo_fecha, `Variable 1 - Etiqueta` = lab1,
    `Variable 2` = NA_character_, `Variable 2 - Etiqueta` = NA_character_,
    `Variable 3` = NA_character_, `Variable 3 - Etiqueta` = NA_character_,
    `Procesamiento` = proc,
    .grp = NA_character_
  )
}

# =============================================================================
# Normalización / limpieza de 'Procesamiento'
# =============================================================================
normalizar_proc <- function(x){
  if (is.null(x)) return(x)
  x <- as.character(x)
  x <- gsub("\u201C|\u201D", "\"", x, perl = TRUE)
  x <- gsub("\u2018|\u2019", "'",  x, perl = TRUE)
  x <- gsub("(?<!<|>|!|<-|=)=(?!=)", "==", x, perl = TRUE)
  x <- gsub("={3,}", "==", x, perl = TRUE)
  x <- gsub("[\u00A0\u2007\u202F]", " ", x, perl = TRUE)
  n_open  <- stringr::str_count(x, "\\(")
  n_close <- stringr::str_count(x, "\\)")
  need <- n_open > n_close
  x[need] <- paste0(x[need], strrep(")", n_open[need] - n_close[need]))
  x
}

# =============================================================================
# Export principal
# =============================================================================

.drop_today_rule_for_window <- function(plan, survey, incluir, rango_fecha, campo_fecha) {
  if (!is.data.frame(plan) || !nrow(plan)) return(plan)
  if (!isTRUE(incluir$tiempo_ventana) || !nz1(rango_fecha)) return(plan)

  campo_fecha_eff <- as_chr1(campo_fecha)
  if (!nz1(campo_fecha_eff)) {
    cand <- survey %>% filter(type_base %in% c("date", "datetime")) %>% slice(1)
    campo_fecha_eff <- as_chr1(if (nrow(cand)) cand$name else "")
  }
  if (!nz1(campo_fecha_eff)) return(plan)

  regla_form_fecha <- .norm_rule_name(paste0("cons_", sanitize_id(campo_fecha_eff), "_form"))
  mask <- plan$`Variable 1` == campo_fecha_eff &
    plan$`Nombre de regla` == regla_form_fecha &
    grepl("Sys\\.Date\\s*\\(", plan$Procesamiento, perl = TRUE)

  plan[!replace(mask, is.na(mask), FALSE), , drop = FALSE]
}

#' Generar plan de limpieza (G-aware) desde un XLSForm ya leído
#' @param x lista con $survey, $choices y $meta (de tu lector)
#' @param incluir lista de banderas lógicas para incluir bloques
#' @param rango_fecha NULL o cadena "YYYY-MM-DD - YYYY-MM-DD"
#' @param campo_fecha NULL o nombre de la variable de fecha a validar
#' @return tibble con plan. TRUE en Procesamiento = inconsistencia.
#'         Columnas exactamente las solicitadas.
#' @family validacion
#' @export
generar_plan_limpieza <- function(
    x,
    incluir = list(
      required       = TRUE,
      other          = TRUE,
      relevant       = TRUE,
      constraint     = TRUE,
      calculate      = TRUE,
      choice_filter  = TRUE,
      repeat_min1    = FALSE, # ya no tiene utilidad por el lector de repitentes
      tiempo_ventana = FALSE
    ),
    rango_fecha = NULL,
    campo_fecha = NULL
){
  stopifnot(all(c("survey","meta") %in% names(x)))
  x <- force_label_columns(x)

  if (!"q_order" %in% names(x$survey)) x$survey$q_order <- seq_len(nrow(x$survey))

  survey <- x$survey %>%
    mutate(
      across(any_of(c("type","name","relevant","constraint","calculation","group_name","required","list_name","choice_filter")),
             ~{ if (is.function(.x)) NA_character_ else suppressWarnings(as.character(.x)) }),
      .qord     = dplyr::row_number(),
      type_base = tolower(trimws(sub("\\s.*$", "", .data$type))),
      required  = {
        s <- tolower(trimws(as.character(.data$required)))
        s <- ifelse(is.na(s), "", s)
        s <- iconv(s, from = "", to = "ASCII//TRANSLIT")
        s %in% c("true()", "true", "yes", "si", "s")
      },
      relevant = gsub("\\s+", " ", trimws(dplyr::coalesce(.data$relevant, "")))
    )

  survey <- .recompute_group_name_from_meta(survey, x$meta$groups_detail)

  section_map <- (x$meta$section_map %||% tibble(group_name=character(), group_label=character(), prefix=character(), is_repeat=logical())) %>%
    mutate(group_name = as.character(group_name),
           prefix     = as.character(prefix %||% "GEN_"),
           is_repeat  = as.logical(is_repeat),
           .gord      = dplyr::row_number())

  inst2 <- list(survey = survey, choices = x$choices %||% tibble(), meta = x$meta %||% list())
  gmap  <- tryCatch(.make_gmap(inst2), error = function(e) tibble())

  bloques <- list()
  if (isTRUE(incluir$required))       bloques$required      <- build_required_g(survey, section_map, x$meta, gmap)
  if (isTRUE(incluir$relevant))       bloques$relevant      <- build_relevant_g(survey, section_map, x$meta, x$choices %||% tibble(), gmap)
  if (isTRUE(incluir$constraint))     bloques$constraint    <- build_constraint_g(survey, section_map, x$meta, gmap)
  if (isTRUE(incluir$calculate))      bloques$calculate     <- build_calculate_g(survey, section_map, x$meta, gmap, x$choices %||% tibble())
  if (isTRUE(incluir$choice_filter))  bloques$choicefilter  <- build_choice_filter_g(inst2, gmap)
  if (isTRUE(incluir$repeat_min1))    bloques$rep_min1      <- build_repeat_min1(inst2)
  if (isTRUE(incluir$tiempo_ventana)) bloques$tiempo        <- build_time_window(inst2, rango_fecha = rango_fecha, campo_fecha = campo_fecha)

  plan <- bind_rows(bloques)
  if (!nrow(plan)) {
    return(tibble(
      ID=character(), Tabla=character(), `Sección`=character(), Categoría=character(), Tipo=character(),
      `Nombre de regla`=character(), Objetivo=character(),
      `Variable 1`=character(), `Variable 1 - Etiqueta`=character(),
      `Variable 2`=character(), `Variable 2 - Etiqueta`=character(),
      `Variable 3`=character(), `Variable 3 - Etiqueta`=character(),
      `Procesamiento`=character()
    ))
  }

  plan <- .drop_today_rule_for_window(plan, survey, incluir, rango_fecha, campo_fecha)


  # === NUEVO: enriquecimiento con hojas por variable y agregación ============
  # Nombre "real" del principal si lo tuvieras en meta; si no, usamos "(principal)"
  main_name_real <- as_chr1(x$meta$main %||% "(principal)")

  # Hoja base = lo que ya llama "Tabla" (mantenemos "(principal)" por compatibilidad)
  plan$`Hoja base` <- as.character(plan$Tabla)

  # Resolver hoja por variable (Var1/2/3)
  plan$`Hoja Var1` <- vapply(plan$`Variable 1`, hoja_de_variable,
                             FUN.VALUE = character(1),
                             survey = survey, section_map = section_map, main_name = main_name_real)
  plan$`Hoja Var2` <- vapply(plan$`Variable 2`, hoja_de_variable,
                             FUN.VALUE = character(1),
                             survey = survey, section_map = section_map, main_name = main_name_real)
  plan$`Hoja Var3` <- vapply(plan$`Variable 3`, hoja_de_variable,
                             FUN.VALUE = character(1),
                             survey = survey, section_map = section_map, main_name = main_name_real)

  # Inferir agregación (sólo cuando Hoja base es principal y VarN está en hoja hija)
  plan$`Agreg Var2` <- mapply(
    inferir_agreg,
    var1 = plan$`Variable 1`,
    varN = plan$`Variable 2`,
    hoja_base = plan$`Hoja base`,
    hoja_varN = plan$`Hoja Var2`,
    USE.NAMES = FALSE
  )
  plan$`Agreg Var3` <- mapply(
    inferir_agreg,
    var1 = plan$`Variable 1`,
    varN = plan$`Variable 3`,
    hoja_base = plan$`Hoja base`,
    hoja_varN = plan$`Hoja Var3`,
    USE.NAMES = FALSE
  )

  # Normaliza 'Procesamiento' y aplica rewriter de tokens ODK
  plan <- plan %>% mutate(`Procesamiento` = normalizar_proc(`Procesamiento`))
  plan$Procesamiento <- vapply(plan$Procesamiento, rewrite_odk_tokens, character(1))
  plan$Procesamiento <- normalizar_proc(plan$Procesamiento)

  # --- Post-proceso específico para 'Valores calculados' ---
  # 1) Arreglar posibles 'collapse == ' heredados de join(...)
  plan$Procesamiento <- gsub("collapse\\s*==\\s*", "collapse = ", plan$Procesamiento, perl = TRUE)

  # 2) Asegurar el patrón correcto de str_count("\\s+")
  plan$Procesamiento <- gsub(
    'str_count\\(([^,]+),\\s*"\\\\s\\+"\\)',
    'str_count(\\1, "\\\\\\\\s+")',
    plan$Procesamiento, perl = TRUE
  )

  # 3) Limpiar cualquier ${var} residual
  plan$Procesamiento <- gsub("\\$\\{([A-Za-z0-9_]+)\\}", "\\1", plan$Procesamiento, perl = TRUE)

  # Orden, ID por prefijo de sección + índice
  plan <- plan %>%
    mutate(Nivel = ifelse(Tabla == "(principal)", 0L, 1L)) %>%
    arrange(Nivel,
            factor(`Sección`, levels = section_map$group_name),
            `Categoría`, `Nombre de regla`) %>%
    group_by(Tabla, `Sección`) %>%
    mutate(.row = dplyr::row_number(),
           .pref = .pref_de(`Sección`, section_map)) %>%
    ungroup() %>%
    mutate(ID = paste0(.pref, sprintf("%03d", .row))) %>%
    select(-.row, -.grp, -Nivel, -.pref)

  # --- Sanitizado final del RHS (tapones de fuga) ---
  plan$Procesamiento <- gsub(
    "jr:choice-name\\s*\\(",
    "as.character(",
    plan$Procesamiento, perl = TRUE
  )

  plan$Procesamiento <- gsub(
    "perl\\s*==\\s*TRUE",
    "perl = TRUE",
    plan$Procesamiento, perl = TRUE
  )

  plan$Procesamiento <- gsub(
    "selected\\s*\\(\\s*([A-Za-z0-9_\\.]+)\\s*,\\s*'([^']+)'\\s*\\)",
    'grepl("(^|\\\\s)\\2(\\\\s|$)", \\1, perl = TRUE)',
    plan$Procesamiento, perl = TRUE
  )

  plan <- .drop_today_rule_for_window(plan, survey, incluir, rango_fecha, campo_fecha)

  # --- SALIDA: exactas columnas solicitadas ----------------------------------
  plan %>%
    select(
      ID, Tabla, `Sección`, Categoría, Tipo, `Nombre de regla`, Objetivo,
      `Variable 1`, `Variable 1 - Etiqueta`,
      `Variable 2`, `Variable 2 - Etiqueta`,
      `Variable 3`, `Variable 3 - Etiqueta`,
      `Procesamiento`,
      # --- NUEVO: metadatos de cruce -----------------------------------------
      `Hoja base`, `Hoja Var1`, `Hoja Var2`, `Hoja Var3`, `Agreg Var2`, `Agreg Var3`
    )
}

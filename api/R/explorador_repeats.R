# =============================================================================
# Explorador de Validacion consciente de bases hija repeat (ADR 0030)
# =============================================================================

.explorar_repeat_chr1 <- function(x, default = "") {
  out <- as.character(x %||% default)
  if (!length(out) || is.na(out[[1]])) default else out[[1]]
}

.explorar_repeat_is_child <- function(base_meta) {
  nzchar(.explorar_repeat_chr1((base_meta %||% list())$parent_base)) &&
    nzchar(.explorar_repeat_chr1((base_meta %||% list())$repeat_group))
}

.explorar_repeat_nonblank <- function(x) {
  out <- as.character(x)
  !is.na(out) & nzchar(trimws(out)) & out != "NA"
}

.explorar_repeat_list_name <- function(row) {
  if (is.null(row) || !nrow(row)) return("")
  if ("list_name" %in% names(row)) {
    ln <- .explorar_repeat_chr1(row$list_name)
    if (nzchar(ln)) return(ln)
  }
  type <- .explorar_repeat_chr1(row$type)
  parts <- strsplit(trimws(type), "\\s+")[[1]]
  if (length(parts) >= 2L) parts[[2]] else ""
}

# Extrae la variable que conduce el roster desde el calculate de current_code:
# selected-at(${services}, position(..)-1) -> services.
.explorar_repeat_conductor <- function(inst, code_var = "current_code") {
  sv <- (inst %||% list())$survey
  if (!is.data.frame(sv) || !all(c("name", "calculation") %in% names(sv))) return("")
  idx <- which(as.character(sv$name) == code_var)[1]
  if (is.na(idx)) return("")
  calc <- .explorar_repeat_chr1(sv$calculation[idx])
  hits <- regmatches(calc, gregexpr("\\$\\{[^}]+\\}", calc, perl = TRUE))[[1]]
  if (!length(hits) || identical(hits, "")) return("")
  gsub("^\\$\\{|\\}$", "", hits[[1]])
}

.explorar_repeat_choice_labels <- function(parent_inst, conductor) {
  sv <- (parent_inst %||% list())$survey
  ch <- (parent_inst %||% list())$choices
  if (!nzchar(conductor) || !is.data.frame(sv) || !is.data.frame(ch) ||
      !all(c("name", "type") %in% names(sv)) ||
      !all(c("list_name", "name") %in% names(ch))) return(character(0))
  idx <- which(as.character(sv$name) == conductor)[1]
  if (is.na(idx)) return(character(0))
  list_name <- .explorar_repeat_list_name(sv[idx, , drop = FALSE])
  if (!nzchar(list_name)) return(character(0))
  rows <- ch[as.character(ch$list_name) == list_name, , drop = FALSE]
  if (!nrow(rows)) return(character(0))
  label_cols <- names(rows)[grepl("^label(::|$)", names(rows), ignore.case = TRUE)]
  spanish <- label_cols[grepl("spanish|espanol|español|::es($|[-_])", label_cols,
                              ignore.case = TRUE)]
  label_col <- c(spanish, intersect("label", label_cols), label_cols)[1]
  labels <- if (!is.na(label_col) && nzchar(label_col)) {
    as.character(rows[[label_col]])
  } else {
    as.character(rows$name)
  }
  codes <- as.character(rows$name)
  keep <- .explorar_repeat_nonblank(codes)
  stats::setNames(labels[keep], codes[keep])
}

.explorar_repeat_observed_label <- function(code, codes, labels) {
  hit <- labels[codes == code & .explorar_repeat_nonblank(labels)]
  if (!length(hit)) return(code)
  tab <- sort(table(hit), decreasing = TRUE)
  names(tab)[[1]]
}

.explorar_repeat_people_n <- function(data, rows, base_meta) {
  link_key <- .explorar_repeat_chr1((base_meta %||% list())$link_key, "_parent_index")
  fallback <- .explorar_repeat_chr1((base_meta %||% list())$link_key_fallback,
                                    "_submission__id")
  key <- if (link_key %in% names(data)) link_key else if (fallback %in% names(data)) fallback else ""
  if (!nzchar(key)) return(NA_integer_)
  vals <- as.character(data[[key]][rows])
  vals <- vals[.explorar_repeat_nonblank(vals)]
  as.integer(length(unique(vals)))
}

.explorar_repeat_options <- function(data, base_meta, canonical,
                                     code_var = "current_code",
                                     label_var = "current_label") {
  if (!(code_var %in% names(data))) return(list())
  codes_raw <- as.character(data[[code_var]])
  labels_raw <- if (label_var %in% names(data)) as.character(data[[label_var]]) else codes_raw
  present <- .explorar_repeat_nonblank(codes_raw)
  observed <- unique(codes_raw[present])
  canonical_order <- intersect(names(canonical), observed)
  codes <- c(canonical_order, setdiff(observed, canonical_order))

  out <- lapply(codes, function(code) {
    rows <- which(present & codes_raw == code)
    canonical_label <- if (code %in% names(canonical)) canonical[[code]] else ""
    label <- if (.explorar_repeat_nonblank(canonical_label)) {
      as.character(canonical_label)
    } else {
      .explorar_repeat_observed_label(code, codes_raw, labels_raw)
    }
    list(
      code = code,
      label = label,
      n_instancias = as.integer(length(rows)),
      n_personas = .explorar_repeat_people_n(data, rows, base_meta)
    )
  })

  out
}

# Interpreta el subconjunto del AST que restringe current_code. Las ramas que no
# mencionan current_code se consideran neutrales (universo completo), de modo
# que AND/OR produzcan interseccion/union conservadoras sin ocultar variables.
.explorar_repeat_ast_codes <- function(node, universe, code_var = "current_code") {
  neutral <- list(mentions = FALSE, codes = universe, supported = TRUE)
  if (is.null(node) || !is_ast(node)) return(neutral)
  op <- ast_op(node)
  if (identical(op, "compare_const") && identical(as.character(node$var), code_var)) {
    value <- as.character(node$value)
    cmp <- as.character(node$op)
    codes <- if (cmp == "==") value else if (cmp == "!=") setdiff(universe, value) else universe
    return(list(mentions = TRUE, codes = unique(codes), supported = cmp %in% c("==", "!=")))
  }
  if (op %in% c("selected", "any_selected", "in_set", "none_selected") &&
      identical(as.character(node$var), code_var)) {
    values <- as.character(node$values %||% node$value %||% character(0))
    codes <- if (identical(op, "none_selected")) setdiff(universe, values) else values
    return(list(mentions = TRUE, codes = unique(codes), supported = TRUE))
  }
  if (op %in% c("and", "or")) {
    parts <- lapply(node$args %||% list(), .explorar_repeat_ast_codes,
                    universe = universe, code_var = code_var)
    if (!length(parts)) return(neutral)
    codes <- if (identical(op, "and")) {
      Reduce(intersect, lapply(parts, `[[`, "codes"), init = universe)
    } else {
      Reduce(union, lapply(parts, `[[`, "codes"), init = character(0))
    }
    return(list(
      mentions = any(vapply(parts, `[[`, logical(1), "mentions")),
      codes = unique(codes),
      supported = all(vapply(parts, `[[`, logical(1), "supported"))
    ))
  }
  if (identical(op, "not")) {
    child <- .explorar_repeat_ast_codes(node$arg, universe, code_var)
    if (!isTRUE(child$mentions)) return(neutral)
    return(list(mentions = TRUE, codes = setdiff(universe, child$codes),
                supported = isTRUE(child$supported)))
  }
  vars <- tryCatch(ast_variables(node), error = function(e) character(0))
  if (code_var %in% vars ||
      (identical(op, "odk_raw") && grepl(code_var, .explorar_repeat_chr1(node$expression), fixed = TRUE))) {
    return(list(mentions = TRUE, codes = universe, supported = FALSE))
  }
  neutral
}

.explorar_repeat_var_relevant <- function(inst, var) {
  sv <- (inst %||% list())$survey
  if (!is.data.frame(sv) || !all(c("name", "relevant") %in% names(sv))) return("")
  idx <- which(as.character(sv$name) == var)[1]
  if (is.na(idx)) "" else .explorar_repeat_chr1(sv$relevant[idx])
}

# Evalua el `relevant` completo sobre las filas reales. La mascara gobierna el
# denominador de aplicables/nulos; extraer current_code solo gobierna en que
# servicios se muestra la variable. Si la expresion no es evaluable, conserva
# todas las filas (fallback conservador: no inventa faltantes ineligibles).
.explorar_repeat_relevant_mask <- function(data, relevant) {
  n <- nrow(data)
  if (!nzchar(relevant)) {
    return(list(mask = rep(TRUE, n), source = "instrument"))
  }
  fallback <- function() list(mask = rep(TRUE, n), source = "observed_fallback")
  parsed <- tryCatch(odk_parse_to_ast(relevant, context = "relevant"),
                     error = function(e) NULL)
  if (is.null(parsed) || isTRUE(parsed$degraded_to_raw)) return(fallback())
  node <- tryCatch(ast_normalize(parsed$ast), error = function(e) parsed$ast)
  needed <- tryCatch(ast_variables(node), error = function(e) character(0))
  if (length(setdiff(needed, names(data)))) return(fallback())
  rhs <- tryCatch(ast_to_r(node), error = function(e) NULL)
  if (is.null(rhs)) return(fallback())

  env <- new.env(parent = globalenv())
  for (name in names(data)) assign(name, data[[name]], envir = env)
  assign(".__eval_data__", data, envir = env)
  assign(".__choices_map__", list(), envir = env)
  result <- tryCatch(eval(parse(text = rhs), envir = env), error = function(e) NULL)
  if (is.null(result) || !is.atomic(result) || !length(result)) return(fallback())
  if (length(result) == 1L) result <- rep(result, n)
  if (length(result) != n) return(fallback())
  mask <- suppressWarnings(as.logical(result))
  if (length(mask) != n) return(fallback())
  mask[is.na(mask)] <- FALSE
  list(mask = mask, source = "relevant_ast")
}

.explorar_repeat_applicability <- function(data, inst, var, universe,
                                           code_var = "current_code",
                                           label_var = "current_label") {
  if (var %in% c(code_var, label_var)) {
    return(list(scope = "identity", codes = universe, source = "identity",
                mask = rep(TRUE, nrow(data))))
  }
  relevant <- .explorar_repeat_var_relevant(inst, var)
  eligibility <- .explorar_repeat_relevant_mask(data, relevant)
  if (!nzchar(relevant)) {
    return(list(scope = "shared", codes = universe, source = "instrument",
                mask = eligibility$mask))
  }
  parsed <- tryCatch(odk_parse_to_ast(relevant, context = "relevant"),
                     error = function(e) NULL)
  if (is.null(parsed)) {
    return(list(scope = "shared", codes = universe, source = "observed_fallback",
                mask = eligibility$mask))
  }
  ast <- tryCatch(ast_normalize(parsed$ast), error = function(e) parsed$ast)
  narrowed <- .explorar_repeat_ast_codes(ast, universe, code_var)
  if (!isTRUE(narrowed$mentions)) {
    return(list(scope = "shared", codes = universe, source = eligibility$source,
                mask = eligibility$mask))
  }
  list(
    scope = "conditional",
    codes = unique(as.character(narrowed$codes)),
    source = if (!isTRUE(parsed$degraded_to_raw) && isTRUE(narrowed$supported) &&
                 identical(eligibility$source, "relevant_ast")) {
      "relevant_ast"
    } else {
      "observed_fallback"
    },
    mask = eligibility$mask
  )
}

.explorar_repeat_valid_n <- function(data, var, rows) {
  if (!(var %in% names(data)) || !length(rows)) return(0L)
  vals <- data[[var]][rows]
  missing <- if (exists(".explorar_is_missing_value", mode = "function")) {
    .explorar_is_missing_value(vals)
  } else {
    !.explorar_repeat_nonblank(vals)
  }
  as.integer(sum(!missing))
}

.explorar_repeat_enrich_variable <- function(variable, data, inst, options,
                                              code_var = "current_code",
                                              label_var = "current_label") {
  var <- .explorar_repeat_chr1(variable$name)
  option_codes <- vapply(options, function(x) .explorar_repeat_chr1(x$code), character(1))
  universe <- option_codes
  app <- .explorar_repeat_applicability(data, inst, var, universe, code_var, label_var)
  raw_codes <- if (code_var %in% names(data)) as.character(data[[code_var]]) else rep("", nrow(data))

  counts <- lapply(options, function(opt) {
    code <- .explorar_repeat_chr1(opt$code)
    rows <- which(.explorar_repeat_nonblank(raw_codes) & raw_codes == code)
    applicable <- app$scope %in% c("shared", "identity") || code %in% app$codes
    eligible_rows <- if (applicable) rows[app$mask[rows]] else integer(0)
    n_app <- length(eligible_rows)
    n_valid <- .explorar_repeat_valid_n(data, var, eligible_rows)
    list(
      code = code,
      n_instancias = as.integer(length(rows)),
      n_aplicables = as.integer(n_app),
      n_validos = as.integer(n_valid),
      n_nulos = as.integer(max(0L, n_app - n_valid))
    )
  })
  variable$repeat_scope <- app$scope
  variable$applicable_codes <- as.list(app$codes)
  variable$applicability_source <- app$source
  variable$counts_by_code <- counts
  all_eligible <- which(app$mask)
  variable$n_aplicables <- as.integer(length(all_eligible))
  variable$n_validos <- .explorar_repeat_valid_n(data, var, all_eligible)
  variable$n_nulos <- as.integer(max(0L, variable$n_aplicables - variable$n_validos))
  variable
}

.explorar_repeat_enrich_sections <- function(secciones, data, inst, options) {
  lapply(secciones %||% list(), function(section) {
    section$variables <- lapply(section$variables %||% list(),
                                .explorar_repeat_enrich_variable,
                                data = data, inst = inst, options = options)
    section
  })
}

# Devuelve NULL para bases normales. Para una hija relacional, retorna el bloque
# `repeat_context` y las secciones enriquecidas sin modificar el shape legacy.
.explorar_repeat_build <- function(data, inst, inventario, base_meta,
                                   parent_inst = NULL,
                                   code_var = "current_code",
                                   label_var = "current_label") {
  if (!.explorar_repeat_is_child(base_meta) || !is.data.frame(data)) return(NULL)
  conductor <- .explorar_repeat_conductor(inst, code_var)
  canonical <- .explorar_repeat_choice_labels(parent_inst, conductor)
  options <- .explorar_repeat_options(data, base_meta, canonical, code_var, label_var)
  all_rows <- seq_len(nrow(data))
  context <- list(
    kind = "instancia",
    repeat_group = .explorar_repeat_chr1(base_meta$repeat_group),
    parent_base = .explorar_repeat_chr1(base_meta$parent_base),
    identity_var = code_var,
    label_var = label_var,
    conductor_var = conductor,
    n_instancias = as.integer(nrow(data)),
    n_personas = .explorar_repeat_people_n(data, all_rows, base_meta),
    unclassified_instances = if (code_var %in% names(data)) {
      as.integer(sum(!.explorar_repeat_nonblank(data[[code_var]])))
    } else {
      as.integer(nrow(data))
    },
    options = options
  )
  list(
    repeat_context = context,
    secciones = .explorar_repeat_enrich_sections(
      inventario$secciones %||% list(), data, inst, options
    )
  )
}

.explorar_repeat_for_base <- function(sid, base_name, data, inst, inventario) {
  s <- session_get(sid, required = FALSE)
  bases <- ((s %||% list())$estudio %||% list())$bases %||% list()
  base_meta <- bases[[base_name]] %||% list()
  if (!.explorar_repeat_is_child(base_meta)) return(NULL)
  parent_name <- .explorar_repeat_chr1(base_meta$parent_base)
  inst_sources <- tryCatch(estudio_inst_sources(sid), error = function(e) list())
  parent_inst <- inst_sources[[parent_name]] %||% NULL
  .explorar_repeat_build(data, inst, inventario, base_meta, parent_inst)
}

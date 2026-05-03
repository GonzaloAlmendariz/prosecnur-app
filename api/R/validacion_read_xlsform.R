# ============================================================
# LECTOR "SIN NORMALIZAR" PARA REGLAS / PLAN DE LIMPIEZA — ONE-FILE v2.5
# - Soporta begin_group/end_group y begin_repeat/end_repeat
# - Captura choice_filter y variables referenciadas
# - section_map: prefix, is_conditional, is_repeat, group_relevant
# - choice_cols_by_list: columnas no vacías y no "decorativas"
# - choice_filter_summary: columnas de choices y variables usadas
# - Resumen simple en consola: Secciones (condición / repeat -> hoja),
#   Listas choices normales (conteo y 'Otro'), Selects con listas dinámicas (origen y preview)
# - Compatible con builders / rule factory (nombres y estructura estable)
# ============================================================

# -------------------- Helpers básicos --------------------
`%||%` <- function(a, b) if (is.null(a)) b else a
.nz <- function(x) { !is.null(x) && length(x) > 0 && !is.na(x) && nzchar(x) }
.fmt_name_label <- function(name, label) {
  nm <- as.character(name %||% "")
  lb <- as.character(label %||% "")
  if (.nz(lb) && !identical(trimws(nm), trimws(lb))) sprintf("%s (%s)", nm, lb) else nm
}

.slugify_es <- function(x) {
  x <- as.character(x)
  x <- iconv(x, to = "ASCII//TRANSLIT")
  x <- gsub("[^A-Za-z0-9]+", "_", x)
  x <- gsub("_+", "_", x)
  gsub("^_|_$", "", x)
}

.abreviar_heuristico <- function(lbl, max_len = 4) {
  if (is.na(lbl) || !nzchar(lbl)) return("GEN")
  txt <- gsub("^\\s*(S\\d+\\s*[:.-]|Parte\\s*\\d+\\s*[:.-])\\s*", "", lbl, ignore.case = TRUE)
  toks <- unlist(strsplit(txt, "\\s+"))
  stopw <- c("de","del","la","el","los","las","y","en","para","por","a","al","lo","un","una","uno")
  toks <- toks[!tolower(toks) %in% stopw]
  base <- if (length(toks)) toks[1] else txt
  base <- gsub("[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]", "", base)
  if (!nzchar(base)) base <- "GEN"
  base <- .slugify_es(base)
  toupper(substr(base, 1, max(1, max_len)))
}

.transformar_según_modo <- function(x, modo = c("mayúsculas","tal_cual","simplificar")) {
  modo <- match.arg(modo)
  if (modo == "mayúsculas") return(toupper(x))
  if (modo == "simplificar") return(toupper(.slugify_es(x)))
  x
}

# -------------------- Normalización liviana --------------------
.trim <- function(x) {
  x <- as.character(x)
  x <- stringr::str_replace_all(x, "\\r\\n|\\r|\\n", " ")
  stringr::str_squish(x)
}

.fix_names <- function(df) {
  if (is.null(df) || nrow(df) == 0) return(df)
  cn <- names(df); cn[is.na(cn)] <- ""; cn <- .trim(cn)
  is_all_empty <- function(v) {
    vv <- as.character(v)
    all(is.na(vv) | !nzchar(.trim(vv)))
  }
  drop_cols <- which(!nzchar(cn) & vapply(df, is_all_empty, logical(1)))
  if (length(drop_cols)) {
    df <- df[, -drop_cols, drop = FALSE]
    cn <- names(df); cn[is.na(cn)] <- ""; cn <- .trim(cn)
    message(sprintf("Aviso: eliminadas %d columnas sin nombre y vacías (survey/choices).", length(drop_cols)))
  }
  if (any(!nzchar(cn))) {
    idx_empty <- which(!nzchar(cn))
    cn[idx_empty] <- paste0("generico_", seq_along(idx_empty))
  }
  low <- tolower(cn); dupl <- duplicated(low)
  if (any(dupl)) cn <- make.unique(cn, sep = "_")
  names(df) <- cn
  df
}

.to_char_trim_df <- function(df) {
  if (is.null(df) || nrow(df) == 0) return(df)
  dplyr::mutate(df, dplyr::across(dplyr::everything(), ~ .trim(.)))
}

.pick_label_col <- function(cols, lang = "es", prefer_label = NULL) {
  if (!is.null(prefer_label) && prefer_label %in% cols) return(prefer_label)
  low <- tolower(cols)
  exacts <- c(
    paste0("label::", lang),
    paste0("label::", lang, " (", toupper(lang), ")"),
    paste0("label::", toupper(lang), " (", toupper(lang), ")"),
    "label::spanish (es)", "label::spanish(es)", "label::spanish_es",
    "label_spanish_es", "label::spanish", "label::es",
    "label::español (es)", "label::espanol (es)",
    "label::español", "label::espanol",
    "label"
  )
  for (ex in exacts) {
    hit <- which(low == tolower(ex))
    if (length(hit)) return(cols[hit[1]])
  }
  hit <- grep(paste0("^label.*", lang), low)
  if (length(hit)) return(cols[hit[1]])
  hit <- grep("^label", low)
  if (length(hit)) return(cols[hit[1]])
  NA_character_
}

.parse_type_scalar <- function(type) {
  type <- .trim(type)
  if (!nzchar(type)) return(list(base = "", list_name = "", dyn_ref = ""))
  if (stringr::str_detect(type, "^begin_group"))  return(list(base = "begin_group",  list_name = "", dyn_ref = ""))
  if (stringr::str_detect(type, "^end_group"))    return(list(base = "end_group",    list_name = "", dyn_ref = ""))
  if (stringr::str_detect(type, "^begin_repeat")) return(list(base = "begin_repeat", list_name = "", dyn_ref = ""))
  if (stringr::str_detect(type, "^end_repeat"))   return(list(base = "end_repeat",   list_name = "", dyn_ref = ""))
  m1 <- stringr::str_match(type, "^(select_one|select_multiple)\\s+([^\\s]+)$")
  if (!any(is.na(m1))) {
    base <- m1[,2]; rhs <- .trim(m1[,3])
    m2 <- stringr::str_match(rhs, "^\\$\\{([^}]+)\\}$")
    if (!any(is.na(m2))) return(list(base = base, list_name = "", dyn_ref = .trim(m2[,2])))
    return(list(base = base, list_name = rhs, dyn_ref = ""))
  }
  list(base = type, list_name = "", dyn_ref = "")
}

.norm_list_name <- function(x){
  x <- tolower(trimws(as.character(x)))
  x <- gsub("\\s+", "_", x)
  gsub("[^a-z0-9_]", "_", x)
}

.xls_sm_q_to_p_name <- function(name) {
  name <- as.character(name %||% "")
  if (!nzchar(name)) return(NA_character_)
  m <- regmatches(name, regexec("^[qQ]0*([0-9]+)(.*)$", name, perl = TRUE))[[1]]
  if (length(m) < 3L) return(NA_character_)
  num <- suppressWarnings(as.integer(m[2]))
  if (is.na(num)) return(NA_character_)
  suffix <- m[3]
  if (grepl("^[_/.]0*[0-9]+$", suffix, perl = TRUE)) {
    sep <- substr(suffix, 1, 1)
    suffix_num <- suppressWarnings(as.integer(sub("^[_/.]0*([0-9]+)$", "\\1", suffix, perl = TRUE)))
    if (!is.na(suffix_num)) suffix <- paste0(sep, suffix_num)
  }
  paste0("p", num, suffix)
}

.xls_normalize_sm_expr_refs <- function(expr, valid_names) {
  expr <- as.character(expr)
  if (!length(expr)) return(expr)
  valid_names <- unique(as.character(valid_names %||% character()))
  rewrite_one <- function(x) {
    if (is.na(x) || !nzchar(x)) return(x)
    refs <- unique(regmatches(x, gregexpr("\\$\\{[qQ]0*[0-9]+(?:[_/.][A-Za-z0-9]+)?\\}", x, perl = TRUE))[[1]])
    if (!length(refs) || identical(refs, "-1")) return(x)
    for (ref in refs) {
      old <- sub("^\\$\\{([^}]+)\\}$", "\\1", ref, perl = TRUE)
      new <- .xls_sm_q_to_p_name(old)
      if (!is.na(new) && new %in% valid_names) {
        x <- gsub(ref, paste0("${", new, "}"), x, fixed = TRUE)
      }
    }
    x
  }
  vapply(expr, rewrite_one, character(1))
}

.xls_escape_regex <- function(x) {
  gsub("([][{}()+*^$|\\\\?.])", "\\\\\\1", as.character(x), perl = TRUE)
}

.xls_normalize_select_multiple_exprs <- function(expr, multi_names) {
  expr <- as.character(expr)
  if (!length(expr)) return(expr)
  multi_names <- unique(as.character(multi_names %||% character()))
  multi_names <- multi_names[!is.na(multi_names) & nzchar(multi_names)]
  if (!length(multi_names)) return(expr)

  rewrite_one <- function(x) {
    if (is.na(x) || !nzchar(x)) return(x)
    for (nm in multi_names) {
      ref <- paste0("\\$\\{", .xls_escape_regex(nm), "\\}")
      pat_ne <- paste0(ref, "\\s*!=\\s*(['\"])([^'\"]+)\\1")
      pat_eq <- paste0(ref, "\\s*=\\s*(['\"])([^'\"]+)\\1")
      x <- gsub(pat_ne, paste0("not(selected(${", nm, "}, '\\2'))"), x, perl = TRUE)
      x <- gsub(pat_eq, paste0("selected(${", nm, "}, '\\2')"), x, perl = TRUE)
    }
    x
  }

  vapply(expr, rewrite_one, character(1))
}

.lists_with_other <- function(choices_df) {
  if (is.null(choices_df) || !nrow(choices_df)) {
    return(tibble::tibble(list_name = character(), has_other = logical()))
  }
  nms <- tolower(names(choices_df))
  lab_col <- if ("label" %in% nms) names(choices_df)[which(nms=="label")[1]] else NA_character_
  has_other_vec <- purrr::map_lgl(unique(choices_df$list_name), function(ln){
    sub <- choices_df[choices_df$list_name == ln, , drop = FALSE]
    if (!nrow(sub)) return(FALSE)
    any(.trim(sub$name) %in% c("Other","Otro","Otra","Otro(a)")) ||
      (!is.na(lab_col) && any(.trim(sub[[lab_col]]) %in% c("Other","Otro","Otra","Otro(a)","Otro (especifique)")))
  })
  tibble::tibble(list_name = unique(choices_df$list_name), has_other = has_other_vec)
}

.vars_in_expr <- function(expr) {
  if (is.null(expr) || is.na(expr) || !nzchar(expr)) return(character(0))
  m <- stringr::str_match_all(expr, "\\$\\{([^}]+)\\}")
  unique(unlist(lapply(m, function(mm) mm[,2])))
}

.normalize_quotes <- function(x){
  x <- gsub("\u2018|\u2019", "'", x, perl = TRUE)
  x <- gsub("\u201C|\u201D", "\"", x, perl = TRUE)
  x
}

.nonempty_cols_by_list <- function(ch){
  core_cols   <- c("list_name","list_norm","name","label")
  ignore_like <- c("^label(::|:).*", "^media(::|:).*", "^name.*_label$", "^order$", "^choice.*_name$")
  by_list <- split(ch, ch$list_name)
  res <- lapply(by_list, function(df){
    cand <- setdiff(names(df), core_cols)
    if (!length(cand)) return(character(0))
    is_ignored <- Reduce(`|`, lapply(ignore_like, function(rx) grepl(rx, cand, ignore.case = TRUE)), init = FALSE)
    cand <- cand[!is_ignored]
    if (!length(cand)) return(character(0))
    keep <- vapply(cand, function(col){
      any(nchar(trimws(as.character(df[[col]]))) > 0, na.rm = TRUE)
    }, logical(1))
    cand[keep]
  })
  tibble::tibble(list_name = names(res), extra_cols = unname(res))
}

# -------------------- Estructura: repeats/árbol --------------------
.detect_repeats <- function(survey, section_map, label_col = "label") {
  n <- nrow(survey); if (!n) return(tibble::tibble())

  # base del tipo (begin_*, end_*, select_*, etc.)
  type_base <- tolower(trimws(sub("\\s.*$", "", as.character(survey$type))))
  nm        <- as.character(survey$name %||% "")
  labcol    <- if (label_col %in% names(survey)) label_col else "label"

  stack <- list()
  rows  <- vector("list", n)

  group_label_from_section <- function(gname) {
    if (is.null(section_map) || !nrow(section_map)) return(NA_character_)
    i <- match(gname, section_map$group_name)
    if (is.na(i)) return(NA_character_)
    pick <- function(col) {
      if (col %in% names(section_map)) {
        val <- section_map[[col]][i]
        if (.nz(val)) return(as.character(val))
      }
      NA_character_
    }
    lbl <- pick("group_label")
    if (is.na(lbl)) lbl <- pick("group_label_es")
    if (is.na(lbl)) lbl <- pick("etiqueta_grupo")
    if (is.na(lbl) || !nzchar(lbl)) lbl <- section_map$group_name[[i]]
    as.character(lbl)
  }

  for (i in seq_len(n)) {
    tb <- type_base[i]
    this_name <- if (!is.na(nm[i]) && nzchar(nm[i])) nm[i] else paste0("group_", i)
    this_lab  <- suppressWarnings(as.character(survey[[labcol]][i]))
    this_lab  <- if (!length(this_lab) || is.na(this_lab) || !nzchar(this_lab)) group_label_from_section(this_name) else this_lab

    if (identical(tb, "begin_group") || identical(tb, "begin") || identical(tb, "begin_repeat")) {
      is_rep <- grepl("begin\\s*_?repeat", tb)
      padre <- if (length(stack)) stack[[length(stack)]]$name else NA_character_
      padre_lab <- if (length(stack)) stack[[length(stack)]]$label else NA_character_
      profundidad <- length(stack)

      rows[[i]] <- list(
        group_name   = this_name,
        group_label  = this_lab,
        is_repeat    = is_rep,
        parent_group = padre,
        parent_label = padre_lab,
        profundidad  = profundidad,
        tabla_hija   = this_name,
        tabla_padre  = if (!is.na(padre)) padre else "(principal)",
        key_child    = "_index",
        key_parent   = if (!is.na(padre)) "_parent_index" else NA_character_
      )
      stack[[length(stack)+1]] <- list(name=this_name, is_repeat=is_rep, label=this_lab)

    } else if (identical(tb, "end_group") || identical(tb, "end") || identical(tb, "end_repeat")) {
      if (length(stack)) stack <- stack[-length(stack)]
    }
  }

  out <- rows |> purrr::compact() |> dplyr::bind_rows()
  if (!nrow(out)) {
    tibble::tibble(group_name=character(), group_label=character(), is_repeat=logical(),
                   parent_group=character(), parent_label=character(), profundidad=integer(),
                   tabla_hija=character(), tabla_padre=character(), key_child=character(), key_parent=character())
  } else out
}

.make_tabla_hojas <- function(repeat_links) {
  if (!nrow(repeat_links)) {
    return(tibble::tibble(
      nivel = 0L, tabla = "(principal)", descripcion = "Encuesta principal",
      vinculo_con_padre = NA_character_
    ))
  }
  dplyr::bind_rows(
    tibble::tibble(
      nivel = 0L, tabla = "(principal)", descripcion = "Encuesta principal", vinculo_con_padre = NA_character_
    ),
    repeat_links %>%
      dplyr::transmute(
        nivel = profundidad + 1L,
        tabla = tabla_hija,
        descripcion = ifelse(is_repeat, paste0(group_label, " (repeat)"), group_label),
        vinculo_con_padre = ifelse(is.na(parent_group),
                                   NA_character_,
                                   paste0("Se vincula por _parent_index → _index de «", tabla_padre, "»."))
      )
  ) %>%
    dplyr::distinct() %>%
    (\(z) z[order(z$nivel, z$tabla), , drop = FALSE])()
}

# -------------------- Listas dinámicas (select_* ${var}) --------------------
.detect_dynrefs <- function(survey, section_map, label_col = "label") {
  if (!nrow(survey)) return(tibble::tibble())
  labcol <- if (label_col %in% names(survey)) label_col else "label"

  m <- stringr::str_match(suppressWarnings(as.character(survey$type)),
                          "^\\s*select_(one|multiple)\\s*\\$\\{([A-Za-z0-9_]+)\\}\\s*$")
  tiene <- which(!is.na(m[,1]))
  if (!length(tiene)) {
    return(tibble::tibble(pregunta=character(), tipo=character(), dyn_ref=character(),
                          grupo_consumidor=character(), etiqueta_pregunta=character(),
                          origen_dyn=character(), etiqueta_origen=character(), es_de_repeat=logical(),
                          calc_preview=character()))
  }

  rep_idx <- .detect_repeats(survey, section_map, label_col)
  grupos_repeat <- unique(rep_idx$group_name[rep_idx$is_repeat %in% TRUE])

  purrr::map_dfr(tiene, function(i) {
    tipo <- paste0("select_", m[i,2])
    ref  <- m[i,3]
    prg  <- as.character(survey$name[i])
    grpC <- suppressWarnings(as.character(survey$group_name[i]))
    labP <- suppressWarnings(as.character(survey[[labcol]][i]))

    fila_ref <- which(survey$name == ref)[1]
    origen   <- if (length(fila_ref) && !is.na(fila_ref)) suppressWarnings(as.character(survey$group_name[fila_ref])) else NA_character_
    etq_org  <- if (length(fila_ref) && !is.na(fila_ref)) {
      v <- suppressWarnings(as.character(survey[[labcol]][fila_ref])); if (!length(v) || is.na(v) || !nzchar(v)) ref else v
    } else ref
    es_rep   <- !is.na(origen) && origen %in% grupos_repeat

    calc_prev <- if (length(fila_ref) && !is.na(fila_ref) && "calculation" %in% names(survey)) {
      cp <- survey$calculation[fila_ref]
      cp <- gsub("\\s+", " ", trimws(cp))
      substr(cp, 1, min(80, nchar(cp)))
    } else ""

    tibble::tibble(
      pregunta          = prg,
      tipo              = tipo,
      dyn_ref           = ref,
      grupo_consumidor  = grpC,
      etiqueta_pregunta = if (!length(labP) || is.na(labP) || !nzchar(labP)) prg else labP,
      origen_dyn        = origen,
      etiqueta_origen   = etq_org,
      es_de_repeat      = es_rep,
      calc_preview      = calc_prev
    )
  })
}

# -------------------- Resumen simple en consola --------------------
.print_resumen_simple <- function(x) {
  meta <- x$meta %||% list()
  section_map  <- meta$section_map  %||% tibble::tibble()
  repeat_links <- meta$repeat_links %||% tibble::tibble()

  if (is.null(section_map) || !nrow(section_map)) {
    cat("• Secciones: (no se detectaron grupos)\n")
    return(invisible())
  }

  cat("\n• Secciones:\n")

  rep_tbl <- if (nrow(repeat_links)) {
    repeat_links[, c("group_name","tabla_hija","tabla_padre","key_parent"), drop = FALSE]
  } else {
    tibble::tibble(group_name=character(), tabla_hija=character(),
                   tabla_padre=character(), key_parent=character())
  }

  ord <- if (".gord" %in% names(section_map)) order(section_map$.gord) else seq_len(nrow(section_map))
  apply(section_map[ord, , drop = FALSE], 1, function(r) {
    gname <- as.character(r[["group_name"]])
    glab  <- as.character(r[["group_label"]])
    rep   <- isTRUE(as.logical(r[["is_repeat"]]))
    cond  <- isTRUE(as.logical(r[["is_conditional"]]))
    relv  <- r[["group_relevant"]] %||% ""
    titulo <- .fmt_name_label(gname, glab)
    cat(sprintf("  - %s%s\n", titulo, if (rep) " [repeat]" else ""))
    if (cond && .nz(relv)) cat("      · se abre si: ", relv, "\n", sep = "")
    if (rep) {
      fila <- rep_tbl[rep_tbl$group_name == gname, , drop = FALSE]
      if (nrow(fila)) {
        cat(sprintf("      · hoja generada: %s (_parent_index → _index de «%s»)\n",
                    fila$tabla_hija[1], fila$tabla_padre[1]))
      }
      # // NEW: pinta repeat_count si viene
      rc <- tryCatch({ x$meta$section_map$repeat_count[x$meta$section_map$group_name == gname][1] }, error = function(e) NA_character_)
      if (.nz(rc)) cat("      · repeat_count: ", rc, "\n", sep = "")
    }

  })
}

print_resumen_instrumento <- function(x) {
  settings <- x$settings %||% tibble::tibble()
  meta     <- x$meta %||% list()

  titulo  <- settings$form_title %||% settings$title %||% "(no definido)"
  version <- settings$version %||% settings$form_version %||% "(no definido)"
  idioma  <- settings$default_language %||% "(no definido)"

  cat("\n================ Resumen del instrumento =================\n")
  cat("• Settings:\n")
  cat("  - Título: ", titulo,  "\n", sep = "")
  cat("  - Versión: ", version, "\n", sep = "")
  cat("  - Idioma por defecto: ", idioma, "\n", sep = "")

  .print_resumen_simple(x)

  # Listas choices normales
  ch <- x$choices %||% tibble::tibble()
  if (nrow(ch)) {
    cat("\n• Listas choices normales:\n")
    cnt <- ch |>
      dplyr::filter(nzchar(list_name)) |>
      dplyr::count(list_name, name = "nopts", sort = FALSE)

    has_other_tbl <- meta$lists_with_other %||% tibble::tibble(list_name=character(), has_other=logical())
    cnt <- cnt |>
      dplyr::left_join(has_other_tbl, by = "list_name") |>
      dplyr::mutate(has_other = ifelse(is.na(has_other), FALSE, has_other))

    apply(cnt, 1, function(r){
      ln <- as.character(r[["list_name"]])
      n  <- as.integer(r[["nopts"]])
      ot <- isTRUE(as.logical(r[["has_other"]]))
      cat(sprintf("  - %s [%d opciones]%s\n", ln, n, if (ot) " (incluye 'Otro')" else ""))
    })
  } else {
    cat("\n• Listas choices normales: (ninguna)\n")
  }

  # Selects con choices dinámicas
  dref <- meta$dynrefs_pretty %||% meta$dynrefs %||% tibble::tibble()
  if (nrow(dref)) {
    cat("\n• Selects con choices dinámicas:\n")
    apply(dref, 1, function(f) {
      cat(sprintf("  - %s (%s) ← ${%s}\n", f[["pregunta"]], f[["tipo"]], f[["dyn_ref"]]))
      origen <- if (.nz(f[["origen_dyn"]])) f[["origen_dyn"]] else "(indeterminado)"
      repflag <- if (isTRUE(as.logical(f[["es_de_repeat"]]))) " [repeat]" else ""
      cat(sprintf("      · origen: hoja/sección «%s»%s; variable: %s\n",
                  origen, repflag, f[["dyn_ref"]]))
      if (.nz(f[["calc_preview"]])) {
        cat("      · construcción (preview): ", f[["calc_preview"]], "\n", sep = "")
      }
    })
  } else {
    cat("\n• Selects con choices dinámicas: (ninguna)\n")
  }

  cat("==========================================================\n")
}

# ---------------------------------------------------------------
# Orquestador principal
# ---------------------------------------------------------------

#' Leer XLSForm para limpieza (sin normalizar valores/labels)
#' @param path Ruta al archivo .xlsx
#' @param lang Código de idioma para detección de columna label
#' @param prefer_label Nombre exacto de la columna de label a priorizar (opcional)
#' @param origen_prefijo "deducir" | "nombre_grupo" | "etiqueta_grupo"
#' @param transformar_prefijo "mayúsculas" | "tal_cual" | "simplificar"
#' @param sufijo_prefijo sufijo a añadir al prefijo (por defecto "_")
#' @param max_longitud_prefijo solo para origen_prefijo="deducir"
#' @param asegurar_unicidad asegurar prefijos únicos
#' @param verbose imprimir resumen simple en consola
#' @family validacion
#' @export
leer_xlsform_limpieza <- function(path,
                                  lang = "es",
                                  prefer_label = NULL,
                                  origen_prefijo = c("deducir", "nombre_grupo", "etiqueta_grupo"),
                                  transformar_prefijo = c("mayúsculas", "tal_cual", "simplificar"),
                                  sufijo_prefijo = "_",
                                  max_longitud_prefijo = 4,
                                  asegurar_unicidad = TRUE,
                                  verbose = TRUE) {

  origen_prefijo      <- match.arg(origen_prefijo)
  transformar_prefijo <- match.arg(transformar_prefijo)
  stopifnot(file.exists(path))

  suppressPackageStartupMessages({
    requireNamespace("readxl", quietly = TRUE)
    requireNamespace("dplyr",  quietly = TRUE)
    requireNamespace("stringr", quietly = TRUE)
    requireNamespace("tibble",  quietly = TRUE)
    requireNamespace("purrr",   quietly = TRUE)
  })

  # ---- leer hojas
  sheets <- readxl::excel_sheets(path)
  .get_sheet <- function(nm, guess_max = 10000L) {
    i <- which(tolower(sheets) == tolower(nm))
    if (!length(i)) return(NULL)
    readxl::read_excel(path, sheet = sheets[i[1]], .name_repair = "minimal",
                       guess_max = guess_max, col_types = "text")
  }
  survey_raw   <- .get_sheet("survey")
  choices_raw  <- .get_sheet("choices")
  settings_raw <- .get_sheet("settings")

  if (is.null(survey_raw)) stop("Hoja 'survey' no encontrada en el XLSForm.")
  if (is.null(choices_raw)) choices_raw <- tibble::tibble(list_name = character(), name = character(), label = character())
  survey_raw   <- .fix_names(survey_raw)   |> .to_char_trim_df()
  choices_raw  <- .fix_names(choices_raw)  |> .to_char_trim_df()
  settings_raw <- .fix_names(settings_raw) |> .to_char_trim_df()

  # === columnas mínimas (asegúralas primero) ===
  for (cc in c("type","name","required","relevant","constraint","calculation","appearance","hint","choice_filter")) {
    if (!cc %in% names(survey_raw)) survey_raw[[cc]] <- ""
  }

  # // NEW: repeat_count siempre presente (ya viene en tu XLS, pero blindamos)
  if (!"repeat_count" %in% names(survey_raw)) survey_raw$repeat_count <- ""
  survey_raw$repeat_count[is.na(survey_raw$repeat_count)] <- ""

  # === fuerza a character y sin NA en columnas de expresiones ===
  expr_cols <- c("relevant","constraint","choice_filter","calculation", "repeat_count")
  for (cc in expr_cols) {
    survey_raw[[cc]] <- as.character(survey_raw[[cc]])
    survey_raw[[cc]][is.na(survey_raw[[cc]])] <- ""
  }

  # === normalización mínima de expresiones (ya existen y son character) ===
  for (cc in expr_cols) {
    survey_raw[[cc]] <- .normalize_quotes(survey_raw[[cc]])
    survey_raw[[cc]] <- .trim(survey_raw[[cc]])   # opcional: limpia espacios y saltos de línea
  }
  valid_survey_names <- unique(as.character(survey_raw$name %||% character()))
  valid_survey_names <- valid_survey_names[!is.na(valid_survey_names) & nzchar(valid_survey_names)]
  multi_names <- survey_raw$name[grepl("^select_multiple\\b", survey_raw$type %||% "", perl = TRUE)]
  for (cc in expr_cols) {
    survey_raw[[cc]] <- .xls_normalize_sm_expr_refs(survey_raw[[cc]], valid_survey_names)
    survey_raw[[cc]] <- .xls_normalize_select_multiple_exprs(survey_raw[[cc]], multi_names)
  }

  # label columns
  survey_label_col  <- .pick_label_col(names(survey_raw),  lang = lang, prefer_label = prefer_label)
  choices_label_col <- .pick_label_col(names(choices_raw), lang = lang, prefer_label = prefer_label)

  parsed <- purrr::map(survey_raw$type, .parse_type_scalar)

  survey <- survey_raw |>
    dplyr::mutate(
      type_base = purrr::map_chr(parsed, "base"),
      list_name = purrr::map_chr(parsed, "list_name"),
      dyn_ref   = purrr::map_chr(parsed, "dyn_ref"),
      q_order   = dplyr::row_number(),
      list_norm = .norm_list_name(list_name),
      is_begin  = type_base %in% c("begin_group","begin_repeat"),
      is_end    = type_base %in% c("end_group","end_repeat")
    )

  survey$group_name  <- ""
  survey$group_label <- if (!is.null(survey_label_col) && survey_label_col %in% names(survey_raw)) survey_raw[[survey_label_col]] else survey_raw[["label"]]

  # ---- pila de grupos y detalle
  grp_stack <- list()
  label_by_gname <- list()
  groups_detail <- list()
  depth <- 0

  for (i in seq_len(nrow(survey))) {
    tb <- survey$type_base[i]
    nm <- survey$name[i]
    lb <- NA_character_
    if (!is.null(survey_label_col) && !is.na(survey_label_col) && survey_label_col %in% names(survey_raw)) {
      lb <- survey_raw[[survey_label_col]][i]
    }
    if ((is.na(lb) || !nzchar(lb)) && "label" %in% names(survey_raw)) lb <- survey_raw[["label"]][i]

    if (tb %in% c("begin_group","begin_repeat")) {
      depth <- depth + 1L
      gname <- if (nzchar(nm)) nm else paste0("group_", i)
      glabel <- if (isTRUE(nzchar(lb))) lb else gname
      grp_stack[[length(grp_stack)+1]] <- gname
      label_by_gname[[gname]] <- glabel

      groups_detail[[length(groups_detail)+1]] <- tibble::tibble(
        gname       = gname,
        glabel      = glabel,
        begin_row   = i,
        end_row     = NA_integer_,
        depth       = depth,
        is_repeat   = identical(tb, "begin_repeat"),
        relevant    = survey$relevant[i] %||% "",
        appearance  = survey$appearance[i] %||% "",
        relevant_vars = list(.vars_in_expr(survey$relevant[i] %||% ""))
      )
    } else if (tb %in% c("end_group","end_repeat")) {
      if (length(groups_detail)) {
        idx_open <- which(vapply(groups_detail, function(x) is.na(x$end_row)[1], logical(1)))
        if (length(idx_open)) groups_detail[[tail(idx_open,1)]]$end_row <- i
      }
      if (length(grp_stack)) grp_stack <- grp_stack[-length(grp_stack)]
      depth <- max(0L, depth - 1L)
    }

    survey$group_name[i]  <- if (length(grp_stack)) grp_stack[[length(grp_stack)]] else ""
    if (nzchar(survey$group_name[i]) && survey$group_name[i] %in% names(label_by_gname)) {
      survey$group_label[i] <- label_by_gname[[ survey$group_name[i] ]]
    }
  }
  if (length(groups_detail)) {
    open_idx <- which(vapply(groups_detail, function(x) is.na(x$end_row)[1], logical(1)))
    if (length(open_idx)) for (k in open_idx) groups_detail[[k]]$end_row <- nrow(survey)
  }

  groups_detail_df <- if (length(groups_detail)) dplyr::bind_rows(groups_detail) else
    tibble::tibble(gname=character(), glabel=character(), begin_row=integer(),
                   end_row=integer(), depth=integer(), is_repeat=logical(),
                   relevant=character(), appearance=character(), relevant_vars=list())

  # repeat_count (si existe)
  repeat_count_vec <- survey_raw$repeat_count  # // CHANGED: ya garantizada arriba

  if (nrow(groups_detail_df)) {
    groups_detail_df$repeat_count      <- NA_character_
    groups_detail_df$repeat_count_vars <- vector("list", nrow(groups_detail_df))

    for (i in seq_len(nrow(groups_detail_df))) {
      if (isTRUE(groups_detail_df$is_repeat[i])) {
        br <- groups_detail_df$begin_row[i]
        rc <- repeat_count_vec[br]
        rc <- ifelse(is.na(rc) || !nzchar(rc), NA_character_, rc)
        groups_detail_df$repeat_count[i]      <- rc
        groups_detail_df$repeat_count_vars[[i]] <- .vars_in_expr(rc %||% "")
      } else {
        groups_detail_df$repeat_count_vars[[i]] <- character(0)
      }
    }
  }

  # ---- preguntas "reales"
  survey_questions <- survey |>
    dplyr::filter(!(type_base %in% c("begin_group","end_group","begin_repeat","end_repeat"))) |>
    dplyr::mutate(
      vars_in_relevant     = lapply(relevant,     .vars_in_expr),
      vars_in_constraint   = lapply(constraint,   .vars_in_expr),
      vars_in_calc         = lapply(calculation,  .vars_in_expr),
      vars_in_choicefilter = lapply(choice_filter,.vars_in_expr)
    ) |>
    dplyr::select(
      type, type_base, list_name, list_norm, dyn_ref,
      name, dplyr::any_of(c("label")),
      required, relevant, constraint, calculation,
      choice_filter, appearance, hint,
      group_name, group_label,
      q_order,
      vars_in_relevant, vars_in_constraint, vars_in_calc, vars_in_choicefilter,
      dplyr::everything()
    )

  # ---- choices
  for (cc in c("list_name","name")) if (!cc %in% names(choices_raw)) choices_raw[[cc]] <- ""
  choices <- choices_raw |>
    dplyr::mutate(list_norm = .norm_list_name(.data$list_name)) |>
    dplyr::select(list_name, list_norm, name, dplyr::any_of("label"), dplyr::everything())

  # ---- validaciones suaves
  dup_ch <- choices |> dplyr::count(list_name, name) |> dplyr::filter(n > 1)
  if (nrow(dup_ch)) warning(sprintf(
    "Duplicados en choices por (list_name, name): %d filas. Ej.: %s",
    nrow(dup_ch), paste(utils::head(paste0(dup_ch$list_name, ":", dup_ch$name), 5), collapse=", ")
  ))
  vac_svy <- survey_questions |> dplyr::filter(!nzchar(name))
  if (nrow(vac_svy)) warning(sprintf("Preguntas en survey con 'name' vacío: %d", nrow(vac_svy)))
  vac_ch  <- choices |> dplyr::filter(!nzchar(list_name) | !nzchar(name))
  if (nrow(vac_ch)) warning(sprintf("Filas en choices con 'list_name' o 'name' vacío: %d", nrow(vac_ch)))

  # listas usadas por selects NO dinámicos y definidas en choices
  ln_needed <- survey_questions |>
    dplyr::filter(
      type_base %in% c("select_one","select_multiple"),
      (is.na(dyn_ref) | !nzchar(dyn_ref)),
      nzchar(list_name)
    ) |>
    dplyr::pull(list_name) |> unique()

  ln_have <- unique(choices$list_name)
  miss_ln <- setdiff(ln_needed, ln_have)
  if (length(miss_ln)) warning(sprintf("Listas referidas en survey sin definir en choices: %s", paste(miss_ln, collapse = ", ")))

  lists_with_other     <- .lists_with_other(choices)
  choice_cols_by_list  <- .nonempty_cols_by_list(choices)

  # ---- section_map (prefijo, condicionalidad, repeat)
  if (nrow(groups_detail_df)) {
    base_map <- tibble::tibble(
      group_name     = as.character(groups_detail_df$gname),
      group_label    = as.character(groups_detail_df$glabel),
      group_relevant = {
        r <- groups_detail_df$relevant; r <- ifelse(is.na(r), NA_character_, as.character(r))
        r <- gsub("\\s+", " ", trimws(r))
        ifelse(nzchar(r), r, NA_character_)
      },
      is_conditional = {
        r <- groups_detail_df$relevant
        nzchar(gsub("\\s+", " ", ifelse(is.na(r), "", as.character(r))))
      },
      is_repeat      = as.logical(groups_detail_df$is_repeat),
      # // NEW ↓↓↓
      repeat_count   = {
        rc <- groups_detail_df$repeat_count
        rc <- gsub("\\s+", " ", trimws(as.character(rc)))
        ifelse(nzchar(rc), rc, NA_character_)
      },
      repeat_count_vars = groups_detail_df$repeat_count_vars,
      # // NEW ↑↑↑
      .gord          = rank(groups_detail_df$begin_row, ties.method = "first") |> as.integer()
    )

    # prefijos
    pref <- character(nrow(base_map))
    if (origen_prefijo == "deducir") {
      fuente <- ifelse(is.na(base_map$group_label) | !nzchar(base_map$group_label),
                       base_map$group_name, base_map$group_label)
      pref <- vapply(fuente, .abreviar_heuristico, character(1), max_len = max_longitud_prefijo)
      pref <- .transformar_según_modo(pref, transformar_prefijo)
    }
    if (origen_prefijo == "nombre_grupo") {
      pref <- base_map$group_name
      pref <- .transformar_según_modo(pref, transformar_prefijo)
    }
    if (origen_prefijo == "etiqueta_grupo") {
      fuente <- ifelse(is.na(base_map$group_label) | !nzchar(base_map$group_label),
                       base_map$group_name, base_map$group_label)
      pref <- .transformar_según_modo(fuente, transformar_prefijo)
    }
    pref[!nzchar(pref)] <- "GEN"
    pref <- paste0(pref, sufijo_prefijo %||% "")

    if (isTRUE(asegurar_unicidad)) {
      tmp <- make.unique(pref, sep = "")
      if (!identical(tmp, pref)) {
        for (i in seq_along(tmp)) {
          if (grepl("\\.\\d+$", tmp[i])) {
            base <- sub("\\.\\d+$", "", tmp[i])
            num  <- sub("^.*\\.(\\d+)$", "\\1", tmp[i])
            if (endsWith(base, sufijo_prefijo)) tmp[i] <- paste0(base, num) else tmp[i] <- paste0(base, sufijo_prefijo, num)
          }
        }
        pref <- tmp
      }
    }

    base_map$prefix <- pref
    base_map <- dplyr::distinct(base_map, .data$group_name, .keep_all = TRUE)
    section_map <- base_map
  } else {
    section_map <- tibble::tibble(
      group_name     = character(),
      group_label    = character(),
      prefix         = character(),
      is_conditional = logical(),
      is_repeat      = logical(),
      group_relevant = character(),
      .gord          = integer()
    )
  }

  # ---- resumen de choice_filter (qué columnas/vars usa)
  has_label <- "label" %in% names(survey_questions)
  cols_for_list <- function(ln){
    # 1) Normaliza el argumento
    if (is.null(ln) || length(ln) != 1) return(character(0))
    ln1 <- suppressWarnings(as.character(ln)[1])
    if (is.na(ln1) || !nzchar(trimws(ln1))) return(character(0))

    # 2) Si la tabla de columnas extra está vacía o no tiene list_name, sal
    if (is.null(choice_cols_by_list) || !nrow(choice_cols_by_list) ||
        !"list_name" %in% names(choice_cols_by_list)) {
      return(character(0))
    }

    # 3) Indexa de forma segura (usa %in% y which); maneja list-col vacía
    idx <- which(choice_cols_by_list$list_name %in% ln1)
    if (!length(idx)) return(character(0))

    row <- choice_cols_by_list[idx, , drop = FALSE]
    ext <- row$extra_cols
    if (!length(ext)) return(character(0))

    out <- tryCatch(unlist(ext, use.names = FALSE), error = function(e) character(0))
    out[nzchar(out)]
  }
  tokens_in_cf <- function(cf){
    if (is.null(cf) || length(cf) == 0) return(character(0))
    cf1 <- suppressWarnings(as.character(cf)[1])
    if (is.na(cf1) || !nzchar(cf1)) return(character(0))
    toks <- unlist(strsplit(cf1, "[^A-Za-z0-9_]+"))
    toks[nzchar(toks)]
  }
  csum0 <- survey_questions |>
    dplyr::filter(nzchar(choice_filter)) |>
    dplyr::rowwise() |>
    dplyr::mutate(
      cf_tokens    = list(tokens_in_cf(choice_filter)),
      cf_uses_cols = list(intersect(cf_tokens, cols_for_list(list_name))),
      cf_vars      = list(vars_in_choicefilter)
    ) |>
    dplyr::ungroup()
  choice_filter_summary <- (if (has_label) {
    csum0 |>
      dplyr::transmute(
        q_order, name, label,
        list_name, choice_filter,
        cf_vars      = vapply(cf_vars,      function(v) paste(v, collapse=", "), character(1)),
        cf_uses_cols = vapply(cf_uses_cols, function(v) paste(v, collapse=", "), character(1))
      )
  } else {
    csum0 |>
      dplyr::transmute(
        q_order, name,
        label = NA_character_,
        list_name, choice_filter,
        cf_vars      = vapply(cf_vars,      function(v) paste(v, collapse=", "), character(1)),
        cf_uses_cols = vapply(cf_uses_cols, function(v) paste(v, collapse=", "), character(1))
      )
  })

  # === enriquecimiento: repeats, hojas, listas dinámicas ===
  repeat_links  <- .detect_repeats(survey, section_map, survey_label_col %||% "label")
  tabla_hojas   <- .make_tabla_hojas(repeat_links)
  dynrefs       <- .detect_dynrefs(survey, section_map, survey_label_col %||% "label")

  # ---- meta
  meta <- list(
    label_col_survey      = survey_label_col,
    label_col_choices     = choices_label_col,
    groups_detail         = groups_detail_df,
    lists_with_other      = lists_with_other,
    choice_cols_by_list   = choice_cols_by_list,
    section_map           = section_map,
    choice_filter_summary = choice_filter_summary,
    repeat_links          = repeat_links,
    tabla_hojas           = tabla_hojas,
    dynrefs               = dynrefs,
    dynrefs_pretty        = dynrefs
  )

  # ---- salida estable (no romper builders/rule factory)
  out <- list(
    survey_raw   = survey_raw,
    choices_raw  = choices_raw,
    settings     = settings_raw,         # << importante: presente como 'settings'
    survey       = tibble::as_tibble(survey),
    choices      = tibble::as_tibble(choices),
    meta         = meta
  )

  # advertencia de balance begin/end
  b <- sum(grepl("^begin_", survey$type_base))
  e <- sum(grepl("^end_",   survey$type_base))
  if (b != e) warning(sprintf("Desbalance begin/end: begin=%d, end=%d (revisa la hoja 'survey')", b, e))

  if (isTRUE(verbose)) print_resumen_instrumento(out)

  out
}


# ============================================================
# VISUALIZACIONES
# ============================================================


# ============================================================
# GRAFICACIÓN DE SECCIONES — paleta estilo Tableau + leyenda interna
# ============================================================

# --- Compatibilidad ggplot2: rectángulos con/es sin 'radius' ------------------
.geom_rect_round <- function(..., radius_pt = 6) {
  args <- list(...)
  # 'radius' sólo existe desde ggplot2 3.5.0
  has_radius <- tryCatch(utils::packageVersion("ggplot2") >= "3.5.0", error = function(e) FALSE)
  if (isTRUE(has_radius)) {
    args$radius <- ggplot2::unit(radius_pt, "pt")
  }
  do.call(ggplot2::geom_rect, args)
}

.nz1 <- function(x) is.character(x) && length(x) == 1 && !is.na(x) && nzchar(x)

.fmt_name_label_vec <- function(name, label) {
  nm <- as.character(name); lb <- as.character(label)
  nm[is.na(nm)] <- ""; lb[is.na(lb)] <- ""
  nm_trim <- trimws(nm); lb_trim <- trimws(lb)
  same <- (lb_trim == "") | (tolower(nm_trim) == tolower(lb_trim))
  same[is.na(same)] <- TRUE
  out <- nm_trim
  if (any(!same)) out[!same] <- sprintf("%s (%s)", nm_trim[!same], lb_trim[!same])
  idx_empty <- (!nzchar(nm_trim)) & nzchar(lb_trim)
  if (any(idx_empty)) out[idx_empty] <- lb_trim[idx_empty]
  out
}

.clean_cond_text <- function(x) {
  if (is.null(x) || all(is.na(x))) return("")
  x <- as.character(x)
  x <- gsub("\\s+", " ", trimws(x))
  x <- gsub("(?i)\\band\\b", "Y", x, perl = TRUE)
  x <- gsub("(?i)\\bor\\b", "O", x, perl = TRUE)
  x
}

.tipo_cond <- function(x) {
  if (is.null(x) || all(is.na(x))) return(NA_character_)
  gsub("\\s+", " ", trimws(as.character(x)))
}

.vars_en_cond <- function(x) {
  if (is.null(x) || is.na(x) || !nzchar(x)) return(character(0))
  m <- stringr::str_match_all(x, "\\$\\{([^}]+)\\}")
  unique(unlist(lapply(m, function(mm) mm[, 2])))
}

# Paleta tipo Tableau 10 (contraste alto, profesional)
.tableau10 <- function(n) {
  base <- c("#4E79A7","#F28E2B","#E15759","#76B7B2","#59A14F",
            "#EDC948","#B07AA1","#FF9DA7","#9C755F","#BAB0AC")
  if (n <= length(base)) base[seq_len(n)] else rep_len(base, n)
}


#' Graficar secciones, condiciones y repeats del XLSForm (sin inferir jerarquías)
#'
#' @param inst Lista devuelta por `leer_xlsform_limpieza()`.
#' @param titulo Título del gráfico.
#' @param altura_seccion,separacion_y Dimensiones verticales.
#' @param ancho_seccion,ancho_condicion,ancho_repeat Anchos de columnas.
#' @param gap_seccion_condicion,gap_condicion_repeat Separación horizontal entre columnas.
#' @param envolver_seccion,envolver_condicion,envolver_repeat Wrapping de texto (caracteres).
#' @param tam_seccion,tam_condicion,tam_repeat Tamaños de fuente.
#' @param largo_cabeza_flecha Longitud de punta de flecha (cm).
#' @param grosor_flecha Grosor de líneas/flechas.
#' @param margen_carril Margen interior para carriles entre columna sección y condición.
#' @param mostrar_leyenda ¿Mostrar leyenda de tipos de condición?
#' @param tam_texto_leyenda Tamaño del texto de la leyenda.
#' @param filas_leyenda Nº de filas en la leyenda (NULL = auto).
#' @param leyenda_por_filas Si TRUE, ordena la leyenda por filas (byrow).
#' @param posicion_leyenda "top" (default), "bottom", "left", "right" o "none".
#' @param color_texto_cond Color del texto dentro de las cajas de condición.
#' @param paleta_condiciones Vector con nombre para tipos de condición; si NULL usa Tableau 10.
#'
#' @return Un `ggplot`.
#' @family validacion
#' @export
GraficarSecciones <- function(inst,
                              titulo = "Mapeo de secciones",
                              altura_seccion = 0.9,
                              separacion_y   = 0.35,
                              ancho_seccion   = 5.6,
                              ancho_condicion = 6.6,
                              ancho_repeat    = 5.2,
                              gap_seccion_condicion = 1.6,
                              gap_condicion_repeat  = 1.4,
                              envolver_seccion   = 38,
                              envolver_condicion = 46,
                              envolver_repeat    = 36,
                              tam_seccion   = 3.4,
                              tam_condicion = 3.1,
                              tam_repeat    = 3.1,
                              largo_cabeza_flecha = 0.18,
                              grosor_flecha       = 0.8,
                              margen_carril = 0.25,
                              mostrar_leyenda = TRUE,
                              tam_texto_leyenda = 8,
                              filas_leyenda     = 2,
                              leyenda_por_filas = TRUE,
                              posicion_leyenda  = "top",
                              color_texto_cond  = "#262626",
                              paleta_condiciones = NULL) {

  req <- c("ggplot2","dplyr","tibble","stringr","purrr","grid","ggnewscale")
  for (p in req) if (!requireNamespace(p, quietly = TRUE)) {
    stop("Falta el paquete '", p, "'. Instálalo.", call. = FALSE)
  }
  `%||%` <- function(a,b) if (is.null(a)) b else a
  .wrap <- function(x, width=40) stringr::str_wrap(as.character(x %||% ""), width=width)

  sm <- inst$meta$section_map %||% tibble::tibble()
  survey <- inst$survey %||% tibble::tibble()
  if (!nrow(sm)) stop("inst$meta$section_map está vacío.")

  sm <- dplyr::arrange(sm, .data$.gord)

  tipo_seccion <- dplyr::case_when(
    !is.na(sm$is_repeat)      & sm$is_repeat      ~ "repeat_seccion",
    !is.na(sm$is_conditional) & sm$is_conditional ~ "condicional",
    TRUE ~ "normal"
  )

  etiqueta_sec <- .fmt_name_label_vec(sm$group_name, sm$group_label)
  texto_cond <- .clean_cond_text(sm$group_relevant)
  tipo_cond  <- .tipo_cond(sm$group_relevant)

  # Columnas X
  x_sec <- 0
  x_sec_der <- x_sec + ancho_seccion/2
  x_cond <- x_sec_der + gap_seccion_condicion + ancho_condicion/2
  x_cond_izq  <- x_cond - ancho_condicion/2
  x_cond_der  <- x_cond + ancho_condicion/2
  x_rep  <- x_cond_der + gap_condicion_repeat + ancho_repeat/2
  x_rep_izq <- x_rep - ancho_repeat/2

  # Filas Y
  n <- nrow(sm); y0 <- 0; dy <- altura_seccion + separacion_y
  y_fila <- y0 - (seq_len(n)-1)*dy

  # Cajas
  df_sec <- tibble::tibble(
    group_name  = sm$group_name,
    group_label = sm$group_label,
    label = .wrap(etiqueta_sec, envolver_seccion),
    tipo = factor(tipo_seccion, levels=c("normal","condicional","repeat_seccion")),
    x = x_sec, y = y_fila, w = ancho_seccion, h = altura_seccion
  )

  tiene_cond <- !is.na(tipo_cond) & nzchar(tipo_cond)
  niveles_cond <- unique(tipo_cond[tiene_cond])

  df_cond <- tibble::tibble(
    group_name = sm$group_name[tiene_cond],
    tipo_cond  = factor(tipo_cond[tiene_cond], levels = niveles_cond),
    texto_cond = .wrap(texto_cond[tiene_cond], envolver_condicion),
    x = x_cond, y = y_fila[tiene_cond], w = ancho_condicion, h = altura_seccion
  )

  tiene_rep <- !is.na(sm$is_repeat) & sm$is_repeat
  df_rep <- tibble::tibble(
    group_name = sm$group_name[tiene_rep],
    texto_rep  = .wrap(paste0("Hoja generada: ", sm$group_name[tiene_rep]), envolver_repeat),
    x = x_rep, y = y_fila[tiene_rep], w = ancho_repeat, h = altura_seccion
  )

  # Carriles por tipo de condición
  carriles_x <- NULL
  if (length(niveles_cond)) {
    if (length(niveles_cond) == 1L) {
      carriles_x <- setNames((x_sec_der + x_cond_izq)/2, niveles_cond)
    } else {
      carriles_seq <- seq(x_sec_der + margen_carril, x_cond_izq - margen_carril, length.out = length(niveles_cond))
      carriles_x <- setNames(carriles_seq, niveles_cond)
    }
  }

  # Flechas sección -> condición (L)
  edges_sec_cond <- if (nrow(df_cond)) {
    purrr::map_dfr(seq_len(nrow(df_cond)), function(i){
      gn <- df_cond$group_name[i]
      yS <- df_sec$y[df_sec$group_name==gn][1]
      tibble::tibble(
        clase="sec2cond", group_name=gn,
        x1=c(x_sec_der, x_cond_izq), y1=c(yS, yS),
        x2=c(x_cond_izq, x_cond_izq), y2=c(yS, df_cond$y[i]),
        es_final=c(FALSE, TRUE),
        tipo_cond = df_cond$tipo_cond[i]
      )
    })
  } else tibble::tibble()

  # Flechas condición -> sección (L con carril)
  edges_cond_sec <- if (nrow(df_cond) && nrow(survey)) {
    purrr::map_dfr(seq_len(nrow(df_cond)), function(i){
      gn <- df_cond$group_name[i]
      tcond <- as.character(df_cond$tipo_cond[i])
      yC <- df_cond$y[i]
      vars <- .vars_en_cond(sm$group_relevant[sm$group_name==gn][1])
      if (!length(vars)) return(tibble::tibble())
      x_mid <- carriles_x[tcond] %||% ((x_sec_der + x_cond_izq)/2)

      purrr::map_dfr(vars, function(vr){
        gsrc <- survey$group_name[which(survey$name==vr)[1]]
        if (!.nz1(gsrc)) return(tibble::tibble())
        yT <- df_sec$y[df_sec$group_name==gsrc][1]
        if (is.na(yT)) return(tibble::tibble())
        tibble::tibble(
          clase="cond2sec", group_name=gn, var=vr, tipo_cond=factor(tcond, levels=niveles_cond),
          x1=c(x_cond_izq, x_mid, x_mid), y1=c(yC, yC, yT),
          x2=c(x_mid,     x_mid, x_sec_der), y2=c(yC, yT, yT),
          es_final=c(FALSE, FALSE, TRUE),
          y_destino = yT
        )
      })
    })
  } else tibble::tibble()

  # Separación en destino SOLO si confluyen tipos distintos
  if (nrow(edges_cond_sec)) {
    tipos_por_destino <- edges_cond_sec |>
      dplyr::filter(.data$es_final) |>
      dplyr::distinct(.data$y_destino, .data$tipo_cond) |>
      dplyr::group_by(.data$y_destino) |>
      dplyr::summarise(tipos = list(as.character(.data$tipo_cond)), .groups = "drop")

    off_map <- purrr::map_dfr(seq_len(nrow(tipos_por_destino)), function(i){
      yD <- tipos_por_destino$y_destino[i]
      tipos <- tipos_por_destino$tipos[[i]]
      k <- length(tipos)
      if (k <= 1) return(tibble::tibble(y_destino=yD, tipo_cond=character(0), off=numeric(0)))
      d <- 0.05
      idx <- seq_len(k) - (k+1)/2
      tibble::tibble(y_destino = yD, tipo_cond = tipos, off = idx * d)
    })

    if (nrow(off_map)) {
      edges_cond_sec <- edges_cond_sec |>
        dplyr::left_join(off_map, by = c("y_destino","tipo_cond" = "tipo_cond")) |>
        dplyr::mutate(
          off = dplyr::coalesce(.data$off, 0),
          y2  = ifelse(.data$es_final, .data$y2 + .data$off, .data$y2),
          y1  = ifelse(.data$es_final, .data$y1 + .data$off, .data$y1)
        ) |>
        dplyr::select(-.data$off)
    }
  }

  # Flechas sección -> repeat (recta)
  edges_repeat <- if (nrow(df_rep)) {
    purrr::map_dfr(seq_len(nrow(df_rep)), function(i){
      gn <- df_rep$group_name[i]
      yS <- df_sec$y[df_sec$group_name==gn][1]
      tibble::tibble(clase="sec2rep", group_name=gn, x1=x_sec_der, y1=yS, x2=x_rep_izq, y2=yS, es_final=TRUE)
    })
  } else tibble::tibble()

  # Estilos
  fill_secciones <- c(normal="#ECECEC", condicional="#FFE6C2", repeat_seccion="#D6EEFF")
  col_borde <- "#777777"
  col_repeat <- "#4E79A7"   # tono Tableau para repeat (coherente)

  # Paleta por tipo de condición
  if (is.null(paleta_condiciones)) {
    paleta_condiciones <- setNames(.tableau10(length(niveles_cond)), niveles_cond)
  }

  g <- ggplot2::ggplot() +
    .geom_rect_round(
      data = df_sec,
      ggplot2::aes(
        xmin = x - w/2,
        xmax = x + w/2,
        ymin = y - h/2,
        ymax = y + h/2,
        fill = tipo
      ),
      color = col_borde,
      linewidth = 0.3,
      radius_pt = 6   # opcional: ajusta el radio de esquina en puntos
    ) +
    ggplot2::geom_text(
      data = df_sec,
      ggplot2::aes(x = x, y = y, label = label),
      size = tam_seccion
    ) +
    ggplot2::scale_fill_manual(
      name = NULL,
      values = fill_secciones,
      breaks = c("normal", "condicional", "repeat_seccion"),
      labels = c("Sección normal", "Sección condicional", "Sección reiterativa")
    ) +
    ggnewscale::new_scale_fill()

  if (nrow(df_cond)) {
    g <- g +
      ggplot2::geom_rect(
        data=df_cond,
        ggplot2::aes(xmin=x-w/2, xmax=x+w/2, ymin=y-h/2, ymax=y+h/2, fill=tipo_cond),
        color=col_borde, linewidth=0.3, radius=ggplot2::unit(6,"pt"), alpha=0.96
      ) +
      ggplot2::geom_text(
        data=df_cond,
        ggplot2::aes(x=x, y=y, label=texto_cond),
        size=tam_condicion, lineheight=0.98, color=color_texto_cond
      ) +
      ggplot2::scale_fill_manual(name=NULL, values=paleta_condiciones, guide="none")
  }

  if (nrow(df_rep)) {
    g <- g +
      ggplot2::geom_rect(
        data=df_rep,
        ggplot2::aes(xmin=x-w/2, xmax=x+w/2, ymin=y-h/2, ymax=y+h/2),
        fill="#E8EEF3", color=col_borde, linewidth=0.3, radius=ggplot2::unit(6,"pt")
      ) +
      ggplot2::geom_text(
        data=df_rep,
        ggplot2::aes(x=x, y=y, label=texto_rep),
        size=tam_repeat, color="#1F2D3D", lineheight=0.98
      )
  }

  # Flechas
  if (nrow(edges_sec_cond)) {
    g <- g +
      ggplot2::geom_segment(
        data=dplyr::filter(edges_sec_cond, !.data$es_final),
        ggplot2::aes(x=x1,y=y1,xend=x2,yend=y2, color=tipo_cond),
        linewidth=grosor_flecha
      ) +
      ggplot2::geom_segment(
        data=dplyr::filter(edges_sec_cond,  .data$es_final),
        ggplot2::aes(x=x1,y=y1,xend=x2,yend=y2, color=tipo_cond),
        linewidth=grosor_flecha,
        arrow=grid::arrow(length=grid::unit(largo_cabeza_flecha,"cm"), type="closed")
      )
  }

  if (nrow(edges_cond_sec)) {
    g <- g +
      ggplot2::geom_segment(
        data=dplyr::filter(edges_cond_sec, !.data$es_final),
        ggplot2::aes(x=x1,y=y1,xend=x2,yend=y2, color=tipo_cond),
        linewidth=grosor_flecha
      ) +
      ggplot2::geom_segment(
        data=dplyr::filter(edges_cond_sec,  .data$es_final),
        ggplot2::aes(x=x1,y=y1,xend=x2,yend=y2, color=tipo_cond),
        linewidth=grosor_flecha,
        arrow=grid::arrow(length=grid::unit(largo_cabeza_flecha,"cm"), type="closed")
      )
  }

  if (nrow(edges_repeat)) {
    g <- g +
      ggplot2::geom_segment(
        data=edges_repeat,
        ggplot2::aes(x=x1,y=y1,xend=x2,yend=y2),
        linewidth=grosor_flecha, color=col_repeat, linetype="solid",
        arrow=grid::arrow(length=grid::unit(largo_cabeza_flecha,"cm"), type="closed")
      )
  }

  # Escala de color para flechas (tipos)
  if (length(paleta_condiciones)) {
    g <- g + ggplot2::scale_color_manual(
      name = "Tipo de condición",
      values = paleta_condiciones,
      guide = if (mostrar_leyenda) ggplot2::guide_legend(nrow = filas_leyenda, byrow = leyenda_por_filas) else "none"
    )
  } else {
    g <- g + ggplot2::scale_color_discrete(
      name = "Tipo de condición",
      guide = if (mostrar_leyenda) ggplot2::guide_legend(nrow = filas_leyenda, byrow = leyenda_por_filas) else "none"
    )
  }

  # Tema + leyenda interna (sin añadir nada fuera)
  g +
    ggplot2::labs(title = titulo) +
    ggplot2::theme_minimal(base_size = 11) +
    ggplot2::theme(
      panel.grid = ggplot2::element_blank(),
      axis.title = ggplot2::element_blank(),
      axis.text = ggplot2::element_blank(),
      axis.ticks = ggplot2::element_blank(),
      legend.position = if (mostrar_leyenda && length(paleta_condiciones)) posicion_leyenda else "none",
      legend.justification = "center",
      legend.text  = ggplot2::element_text(size = tam_texto_leyenda),
      legend.title = ggplot2::element_text(size = max(7, tam_texto_leyenda - 1), face = "bold"),
      legend.key.height = ggplot2::unit(10, "pt"),
      plot.title = ggplot2::element_text(face = "bold", hjust = 0.5, margin = ggplot2::margin(b = 8)),
      plot.margin = ggplot2::margin(t = 12, r = 18, b = 12, l = 18)
    )
}




#' Waffle de preguntas y reglas (coloreado por sección + chips de reglas)
#'
#' @description
#' Cada celda representa una fila del `survey`. El **relleno** de la celda indica
#' la **sección** (`group_name`). El **borde** comunica estructura:
#' - Negro grueso (sólido): begin/end de grupos/repeats de nivel 1
#' - Negro más fino (segmentado): begin/end de grupos/repeats anidados (profundidad > 1)
#' - Gris oscuro fino: el resto.
#'
#' Dentro de cada celda se dibujan **chips** para reglas detectadas:
#' `calculation`, `required`, `constraint`, `relevant`, `choice_filter`.
#'
#' El texto muestra el `name` recortado a `max_caracteres` (sin “…”).
#' La **leyenda (arriba)** es **solo** para tipos de **regla**.
#'
#' @param inst Lista devuelta por `leer_xlsform_limpieza()`, con `inst$survey`.
#' @param titulo Título del gráfico.
#' @param incluir_genericos Si `TRUE`, incluye todas las filas (grupos, notas, cálculos, etc.).
#'   Si `FALSE`, solo muestra preguntas habituales (select_one/multiple, text, integer, decimal, date, etc.).
#' @param n_columnas Número de columnas del waffle.
#' @param ancho_celda,alto_celda Tamaño de cada celda (unidades de datos).
#' @param espacio_x,espacio_y Separaciones horizontal y vertical entre celdas.
#' @param tam_texto Tamaño de texto del nombre dentro de la celda.
#' @param max_caracteres Máximo de caracteres del nombre (se corta sin “…”).
#' @param tam_chip Tamaño (lado) de cada chip.
#' @param chip_gap_x Separación horizontal entre chips.
#' @param max_chips_por_fila Máximo de chips por fila dentro de la celda.
#' @param mostrar_leyenda Si `TRUE`, muestra la leyenda de tipos de regla (arriba).
#' @param paleta_secciones Vector de colores (opcional) para colorear secciones por `group_name`.
#'   Si es `NULL`, se usa una paleta profesional y clara distinta a la de chips.
#'
#' @return Un objeto `ggplot` con el waffle de preguntas y reglas.
#' @family validacion
#' @export
GraficarPreguntas <- function(inst,
                                       titulo = "Waffle de preguntas y reglas",
                                       incluir_genericos = TRUE,
                                       n_columnas  = 14,
                                       ancho_celda = 1.2,
                                       alto_celda  = 1.2,
                                       espacio_x   = 0.18,
                                       espacio_y   = 0.18,
                                       tam_texto   = 3.1,
                                       max_caracteres = 12,
                                       tam_chip    = 0.16,
                                       chip_gap_x  = 0.06,
                                       max_chips_por_fila = 4,
                                       mostrar_leyenda = TRUE,
                                       paleta_secciones = NULL) {

  req <- c("ggplot2","dplyr","tibble","stringr","tidyr","ggnewscale")
  for (p in req) if (!requireNamespace(p, quietly = TRUE))
    stop("Falta el paquete '", p, "'.", call. = FALSE)

  `%||%` <- function(a,b) if (is.null(a)) b else a
  .cut <- function(s, n = 12) {
    s <- as.character(s %||% "")
    ifelse(nchar(s) > n, substr(s, 1, n), s)  # cortar SIN “...”
  }
  .norm_empty <- function(x){
    x <- as.character(x); x[is.na(x)] <- ""
    bad <- tolower(trimws(x)) %in% c("na","n/a","none","null","nan")
    x[bad] <- ""; trimws(x)
  }
  .is_nonempty <- function(x) nzchar(.norm_empty(x))
  .to_bool_req <- function(x){
    x <- tolower(trimws(as.character(x)))
    x %in% c("true","true()","1","si","sí","yes","y","s")
  }

  svy <- inst$survey %||% tibble::tibble()
  need_cols <- c("name","type","type_base","group_name",
                 "relevant","constraint","required","choice_filter","calculation")
  for (cc in need_cols) if (!cc %in% names(svy)) svy[[cc]] <- ""

  # Profundidad por sección (para detectar anidamiento de grupos)
  depth_df <- inst$meta$groups_detail %||% tibble::tibble()
  if (!nrow(depth_df)) {
    # compat: si no existe, asumimos profundidad 1
    sec_depth <- setNames(rep(1L, length(unique(svy$group_name))), unique(svy$group_name))
  } else {
    sec_depth <- setNames(as.integer(depth_df$depth), as.character(depth_df$gname))
  }

  # Filtrar solo preguntas si se pide
  if (!isTRUE(incluir_genericos)) {
    tipos_validos <- c(
      "select_one","select_multiple","text","integer","decimal",
      "date","datetime","time","geopoint","image","audio","video",
      "barcode","acknowledge","note"
    )
    svy <- svy[tolower(svy$type_base) %in% tipos_validos, , drop = FALSE]
  }

  svy$group_name <- ifelse(.is_nonempty(svy$group_name), svy$group_name, "(sin_seccion)")

  # Determinar profundidad de la fila según su group_name
  fila_depth <- as.integer(sec_depth[svy$group_name])
  fila_depth[is.na(fila_depth)] <- 1L

  # Bordes por tipo de fila (azul/rojo para begin/end; grosor/linetype por profundidad)
  tb <- tolower(svy$type_base)

  col_borde <- dplyr::case_when(
    tb %in% c("begin_group", "begin_repeat") ~ "#1F78B4",  # azul
    tb %in% c("end_group", "end_repeat")     ~ "#E31A1C",  # rojo
    TRUE                                     ~ "#333333"   # gris oscuro
  )

  grosor_borde <- dplyr::case_when(
    tb %in% c("begin_group", "begin_repeat", "end_group", "end_repeat") & fila_depth > 1L ~ 0.7,
    tb %in% c("begin_group", "begin_repeat", "end_group", "end_repeat")                   ~ 1.1,
    TRUE                                                                                  ~ 0.4
  )

  linetype_borde <- dplyr::case_when(
    tb %in% c("begin_group", "begin_repeat", "end_group", "end_repeat") & fila_depth > 1L ~ "dashed",
    tb %in% c("begin_group", "begin_repeat", "end_group", "end_repeat")                   ~ "solid",
    TRUE                                                                                  ~ "solid"
  )

  # Paleta de secciones (relleno de celdas) — profesional y distinta a chips
  secciones <- unique(svy$group_name)
  if (is.null(paleta_secciones)) {
    # Paleta tipo “Tableau Light / Set3-like”, clara y contrastada
    base_sec <- c(
      "#A6CEE3","#B2DF8A","#FDBF6F","#CAB2D6","#FFFF99",
      "#1F78B4","#33A02C","#FB9A99","#E31A1C","#FF7F00",
      "#6A3D9A","#B15928","#B3E2CD","#FDCDAC","#F4CAE4",
      "#CCEBC5","#DECBE4","#E5D8BD","#FDDDE6","#FFFFCC"
    )
    pal <- rep_len(base_sec, length(secciones))
    names(pal) <- secciones
    paleta_secciones <- pal
  } else {
    # Completar colores faltantes si el usuario pasó algunos
    faltan <- setdiff(secciones, names(paleta_secciones))
    if (length(faltan)) {
      extras <- c("#D9D9D9","#CFE8F3","#FCE4D6","#E6F5C9","#F1E2FF")
      extras <- rep_len(extras, length(faltan))
      names(extras) <- faltan
      paleta_secciones <- c(paleta_secciones, extras)
    }
  }

  # Reglas (chips) a partir de columnas crudas del survey
  svy <- svy %>%
    dplyr::mutate(
      rule_calculation   = .is_nonempty(calculation),
      rule_required      = .to_bool_req(required),
      rule_constraint    = .is_nonempty(constraint),
      rule_relevant      = .is_nonempty(relevant),
      rule_choicefilter  = .is_nonempty(choice_filter)
    )

  # Layout tipo waffle
  n <- nrow(svy)
  fila  <- floor((seq_len(n)-1) / n_columnas)
  col   <- (seq_len(n)-1) %% n_columnas
  cx <- col * (ancho_celda + espacio_x)
  cy <- -fila * (alto_celda  + espacio_y)

  base_tiles <- tibble::tibble(
    name = svy$name,
    type_base = svy$type_base,
    group_name = svy$group_name,
    cx, cy,
    xmin = cx - ancho_celda/2, xmax = cx + ancho_celda/2,
    ymin = cy - alto_celda/2,  ymax = cy + alto_celda/2,
    etiqueta = .cut(svy$name, max_caracteres),
    fill_seccion = svy$group_name,
    col_borde = col_borde,
    grosor_borde = grosor_borde,
    linetype_borde = linetype_borde
  )

  # Chips (solo cuando la regla es TRUE)
  chips_long <- svy %>%
    dplyr::select(name, starts_with("rule_")) %>%
    tidyr::pivot_longer(
      cols = dplyr::starts_with("rule_"),
      names_to = "regla",
      values_to = "valor"
    ) %>%
    dplyr::filter(valor) %>%
    dplyr::mutate(
      regla = dplyr::recode(regla,
                            rule_calculation="calculation",
                            rule_required="required",
                            rule_constraint="constraint",
                            rule_relevant="relevant",
                            rule_choicefilter="choice_filter")
    ) %>%
    dplyr::left_join(base_tiles, by="name") %>%
    dplyr::group_by(name) %>%
    dplyr::mutate(
      idx_chip  = dplyr::row_number() - 1L,
      fila_chip = floor(idx_chip / max_chips_por_fila),
      col_chip  = idx_chip %% max_chips_por_fila,
      # chips ocupan el tercio inferior de la celda
      y_chip = ymin + 0.25*alto_celda + (fila_chip * (tam_chip + 0.04)),
      ancho_fila_chip = (tam_chip * max_chips_por_fila) + chip_gap_x * (max_chips_por_fila - 1),
      x_inicio = cx - ancho_fila_chip/2 + tam_chip/2,
      x_chip = x_inicio + col_chip * (tam_chip + chip_gap_x)
    ) %>%
    dplyr::ungroup()

  # Paleta de reglas (contraste alto, distinta a secciones)
  pal_reglas <- c(
    calculation   = "#9467BD",
    required      = "#D62728",
    constraint    = "#FF7F0E",
    relevant      = "#2CA02C",
    choice_filter = "#1F77B4"
  )

  # --- Gráfico principal ---
  g <- ggplot2::ggplot() +
    # Tiles coloreados por sección
    ggplot2::geom_rect(
      data = base_tiles,
      ggplot2::aes(xmin=xmin, xmax=xmax, ymin=ymin, ymax=ymax, fill = fill_seccion),
      color = base_tiles$col_borde,
      linewidth = base_tiles$grosor_borde,
      linetype = base_tiles$linetype_borde
    ) +
    ggplot2::scale_fill_manual(values = paleta_secciones, guide = "none") +
    # Texto (name recortado)
    ggtext::geom_textbox(
      data = base_tiles,
      ggplot2::aes(x=cx, y=cy, label=etiqueta),
      width = unit(ancho_celda * 0.9, "cm"),
      box.color = NA,
      size = tam_texto * 0.8,
      halign = 0.5,
      valign = 0.5,
      lineheight = 0.98,
      fill = NA
    ) +
    ggnewscale::new_scale_fill()

  # Chips de reglas
  if (nrow(chips_long)) {
    g <- g +
      ggplot2::geom_rect(
        data = chips_long,
        ggplot2::aes(
          xmin = x_chip - tam_chip/2,
          xmax = x_chip + tam_chip/2,
          ymin = y_chip - tam_chip/2,
          ymax = y_chip + tam_chip/2,
          fill = regla
        ),
        color = "black", linewidth = 0.15
      ) +
      ggplot2::scale_fill_manual(
        name = "Tipos de regla",
        values = pal_reglas
      )
  }

  g +
    ggplot2::coord_equal(expand = TRUE) +
    ggplot2::labs(title = titulo, x = NULL, y = NULL) +
    ggplot2::theme_minimal(base_size = 11) +
    ggplot2::theme(
      panel.grid = ggplot2::element_blank(),
      axis.text  = ggplot2::element_blank(),
      axis.title = ggplot2::element_blank(),
      plot.title = ggplot2::element_text(face = "bold", hjust = 0.5, margin = ggplot2::margin(b = 10)),
      legend.position = if (mostrar_leyenda && nrow(chips_long)) "top" else "none",
      legend.justification = "center",
      legend.direction = "horizontal",
      legend.text = ggplot2::element_text(size = 9),
      legend.title = ggplot2::element_text(size = 10, face = "bold"),
      plot.margin = ggplot2::margin(t = 10, r = 10, b = 10, l = 10)
    ) +
    ggplot2::guides(
      fill = ggplot2::guide_legend(nrow = 1, byrow = TRUE, title.position = "top")
    )
}


#' Auditar corpus de reglas de consistencia
#'
#' Ejecuta una auditoria estatica y dinamica sobre un corpus de instrumentos
#' XLSForm y sus datos asociados. El objetivo es identificar reglas correctas,
#' ambiguas, no ejecutables o incorrectas tanto en su generacion como en su
#' ejecucion.
#'
#' @param corpus `data.frame` o `tibble` con columnas `instrumento_id`,
#'   `path_xlsform` y `datos`. Opcionalmente puede incluir `hoja_principal`
#'   y `choices`.
#' @param use_choice_labels Si `TRUE`, la evaluacion final usa columnas `*_label`
#'   cuando sea posible.
#' @param contar_na_como_inconsistencia Si `TRUE`, los `NA` del flag cuentan como
#'   inconsistencia al resumir la evaluacion.
#' @param sample_n Numero maximo de reglas por instrumento para extraer casos
#'   muestra con `auditar_regla()`.
#' @param export_dir Ruta opcional donde se escriben `auditoria_consistencia.md`
#'   y `auditoria_reglas.xlsx`.
#'
#' @return Lista con `resumen_corpus`, `matriz_reglas`, `hallazgos`,
#'   `casos_muestra`, `benchmarks` y `artifacts`.
#' @family validacion
#' @export
auditar_consistencia_corpus <- function(corpus,
                                        use_choice_labels = FALSE,
                                        contar_na_como_inconsistencia = FALSE,
                                        sample_n = 5,
                                        export_dir = NULL) {
  corpus <- .audit_validate_corpus(corpus)

  per_inst <- lapply(seq_len(nrow(corpus)), function(i) {
    .audit_one_instrument(
      instrumento_id = corpus$instrumento_id[[i]],
      path_xlsform = corpus$path_xlsform[[i]],
      datos = corpus$datos[[i]],
      hoja_principal = corpus$hoja_principal[[i]],
      choices = corpus$choices[[i]],
      use_choice_labels = use_choice_labels,
      contar_na_como_inconsistencia = contar_na_como_inconsistencia,
      sample_n = sample_n
    )
  })

  matriz_reglas <- dplyr::bind_rows(lapply(per_inst, `[[`, "matriz_reglas"))
  hallazgos <- dplyr::bind_rows(lapply(per_inst, `[[`, "hallazgos"))
  casos_muestra <- dplyr::bind_rows(lapply(per_inst, `[[`, "casos_muestra"))
  benchmarks <- dplyr::bind_rows(lapply(per_inst, `[[`, "benchmarks"))

  resumen_corpus <- matriz_reglas %>%
    dplyr::group_by(.data$instrumento_id) %>%
    dplyr::summarise(
      n_reglas_auditadas = dplyr::n(),
      n_hallazgos = sum(!is.na(.data$issue_code)),
      n_correctas = sum(.data$estado_estatico == "correcta" & .data$estado_dinamico == "correcta", na.rm = TRUE),
      n_ambiguas = sum(.data$estado_estatico == "ambigua" | .data$estado_dinamico == "ambigua", na.rm = TRUE),
      n_incorrectas_generacion = sum(.data$estado_estatico == "incorrecta_generacion", na.rm = TRUE),
      n_incorrectas_ejecucion = sum(.data$estado_dinamico == "incorrecta_ejecucion", na.rm = TRUE),
      n_no_ejecutables = sum(.data$estado_estatico == "no_ejecutable" | .data$estado_dinamico == "no_ejecutable", na.rm = TRUE),
      .groups = "drop"
    ) %>%
    dplyr::left_join(benchmarks, by = "instrumento_id")

  artifacts <- list(markdown = NA_character_, xlsx = NA_character_)
  if (!is.null(export_dir) && nzchar(as.character(export_dir))) {
    dir.create(export_dir, recursive = TRUE, showWarnings = FALSE)
    md_path <- file.path(export_dir, "auditoria_consistencia.md")
    xlsx_path <- file.path(export_dir, "auditoria_reglas.xlsx")
    .audit_write_markdown(
      list(
        resumen_corpus = resumen_corpus,
        hallazgos = hallazgos,
        benchmarks = benchmarks
      ),
      md_path
    )
    .audit_write_xlsx(
      list(
        resumen_corpus = resumen_corpus,
        matriz_reglas = matriz_reglas,
        hallazgos = hallazgos,
        casos_muestra = casos_muestra,
        benchmarks = benchmarks
      ),
      xlsx_path
    )
    artifacts$markdown <- md_path
    artifacts$xlsx <- xlsx_path
  }

  list(
    resumen_corpus = resumen_corpus,
    matriz_reglas = matriz_reglas,
    hallazgos = hallazgos,
    casos_muestra = casos_muestra,
    benchmarks = benchmarks,
    artifacts = artifacts
  )
}

`%||%` <- function(a, b) if (is.null(a) || (length(a) == 1 && is.na(a))) b else a

.audit_validate_corpus <- function(corpus) {
  if (!is.data.frame(corpus)) {
    stop("`corpus` debe ser un data.frame o tibble.", call. = FALSE)
  }

  req <- c("instrumento_id", "path_xlsform", "datos")
  miss <- setdiff(req, names(corpus))
  if (length(miss)) {
    stop("`corpus` carece de columnas requeridas: ", paste(miss, collapse = ", "), call. = FALSE)
  }

  out <- tibble::as_tibble(corpus)
  if (!"hoja_principal" %in% names(out)) out$hoja_principal <- list(NULL)
  if (!"choices" %in% names(out)) out$choices <- list(NULL)
  if (!inherits(out$hoja_principal, "list")) out$hoja_principal <- as.list(out$hoja_principal)
  if (!inherits(out$choices, "list")) out$choices <- as.list(out$choices)
  out$instrumento_id <- as.character(out$instrumento_id)
  out$path_xlsform <- as.character(out$path_xlsform)
  out
}

.audit_one_instrument <- function(instrumento_id,
                                  path_xlsform,
                                  datos,
                                  hoja_principal = NULL,
                                  choices = NULL,
                                  use_choice_labels = FALSE,
                                  contar_na_como_inconsistencia = FALSE,
                                  sample_n = 5) {
  t_inst <- system.time(inst <- leer_xlsform_limpieza(path_xlsform, verbose = FALSE))
  t_plan <- system.time(plan <- generar_plan_limpieza(inst))

  choices_eval <- choices %||% .audit_choices_map_from_inst(inst)

  t_eval_plain <- system.time(
    ev_plain <- evaluar_consistencia(
      datos = datos,
      plan = plan,
      hoja_principal = hoja_principal %||% NULL,
      contar_na_como_inconsistencia = contar_na_como_inconsistencia,
      choices = choices_eval,
      use_choice_labels = FALSE
    )
  )

  t_eval_labels <- system.time(
    ev_labels <- evaluar_consistencia(
      datos = datos,
      plan = plan,
      hoja_principal = hoja_principal %||% NULL,
      contar_na_como_inconsistencia = contar_na_como_inconsistencia,
      choices = choices_eval,
      use_choice_labels = TRUE
    )
  )

  ev_final <- if (isTRUE(use_choice_labels)) ev_labels else ev_plain

  matriz_reglas <- .audit_build_matrix(
    instrumento_id = instrumento_id,
    inst = inst,
    plan = plan,
    evaluacion = ev_final
  )

  hallazgos <- matriz_reglas %>%
    dplyr::filter(!is.na(.data$issue_code)) %>%
    dplyr::arrange(dplyr::desc(.data$severidad_rank), dplyr::desc(.data$n_inconsistencias %||% -1))

  casos_muestra <- .audit_collect_cases(
    hallazgos = hallazgos,
    evaluacion = ev_final,
    inst = inst,
    instrumento_id = instrumento_id,
    sample_n = sample_n
  )

  benchmarks <- tibble::tibble(
    instrumento_id = instrumento_id,
    n_reglas_plan = nrow(plan),
    elapsed_leer_xlsform = unname(t_inst[["elapsed"]]),
    elapsed_generar_plan = unname(t_plan[["elapsed"]]),
    elapsed_evaluar_sin_labels = unname(t_eval_plain[["elapsed"]]),
    elapsed_evaluar_con_labels = unname(t_eval_labels[["elapsed"]]),
    use_choice_labels_final = isTRUE(use_choice_labels)
  )

  list(
    matriz_reglas = matriz_reglas,
    hallazgos = hallazgos,
    casos_muestra = casos_muestra,
    benchmarks = benchmarks
  )
}

.audit_choices_map_from_inst <- function(inst) {
  survey <- inst$survey %||% tibble::tibble()
  choices <- inst$choices %||% tibble::tibble()
  meta <- inst$meta %||% list()

  if (!nrow(survey) || !nrow(choices)) return(list())

  label_col <- as.character(meta$label_col_choices %||% "label")
  if (!label_col %in% names(choices)) label_col <- "label"

  dat <- survey %>%
    dplyr::mutate(type_base = tolower(trimws(sub("\\s.*$", "", .data$type)))) %>%
    dplyr::filter(.data$type_base %in% c("select_one", "select_multiple"), nzchar(.data$list_name))

  if (!nrow(dat)) return(list())

  out <- vector("list", nrow(dat))
  names(out) <- dat$name
  for (i in seq_len(nrow(dat))) {
    ln <- as.character(dat$list_name[[i]])
    ch <- choices[choices$list_name == ln, , drop = FALSE]
    if (!nrow(ch)) next
    labs <- as.character(ch[[label_col]])
    labs[is.na(labs)] <- ch$name[is.na(labs)]
    out[[dat$name[[i]]]] <- stats::setNames(labs, ch$name)
  }
  Filter(length, out)
}

.audit_finalize_expected_plan <- function(plan, inst) {
  if (!nrow(plan)) return(plan)

  survey <- inst$survey
  section_map <- inst$meta$section_map %||% tibble::tibble()
  main_name <- as.character(inst$meta$main %||% "(principal)")

  plan$`Hoja base` <- as.character(plan$Tabla)
  plan$`Hoja Var1` <- vapply(plan$`Variable 1`, hoja_de_variable, character(1),
                             survey = survey, section_map = section_map, main_name = main_name)
  plan$`Hoja Var2` <- vapply(plan$`Variable 2`, hoja_de_variable, character(1),
                             survey = survey, section_map = section_map, main_name = main_name)
  plan$`Hoja Var3` <- vapply(plan$`Variable 3`, hoja_de_variable, character(1),
                             survey = survey, section_map = section_map, main_name = main_name)
  plan$`Agreg Var2` <- NA_character_
  plan$`Agreg Var3` <- NA_character_

  plan <- plan %>% dplyr::mutate(`Procesamiento` = normalizar_proc(`Procesamiento`))
  plan$Procesamiento <- vapply(plan$Procesamiento, rewrite_odk_tokens, character(1))
  plan$Procesamiento <- normalizar_proc(plan$Procesamiento)
  plan$Procesamiento <- gsub("collapse\\s*==\\s*", "collapse = ", plan$Procesamiento, perl = TRUE)
  plan$Procesamiento <- gsub(
    'str_count\\(([^,]+),\\s*"\\\\s\\+"\\)',
    'str_count(\\1, "\\\\\\\\s+")',
    plan$Procesamiento,
    perl = TRUE
  )
  plan$Procesamiento <- gsub("\\$\\{([A-Za-z0-9_]+)\\}", "\\1", plan$Procesamiento, perl = TRUE)
  plan$Procesamiento <- gsub("jr:choice-name\\s*\\(", "as.character(", plan$Procesamiento, perl = TRUE)
  plan$Procesamiento <- gsub("perl\\s*==\\s*TRUE", "perl = TRUE", plan$Procesamiento, perl = TRUE)
  plan$Procesamiento <- gsub(
    "selected\\s*\\(\\s*([A-Za-z0-9_\\.]+)\\s*,\\s*'([^']+)'\\s*\\)",
    'grepl("(^|\\\\s)\\2(\\\\s|$)", \\1, perl = TRUE)',
    plan$Procesamiento,
    perl = TRUE
  )

  plan
}

.audit_expected_calculate_non_exec <- function(inst, gmap) {
  survey <- inst$survey
  meta <- inst$meta %||% list()
  section_map <- meta$section_map %||% tibble::tibble()

  dat <- survey %>%
    dplyr::mutate(type_base = tolower(trimws(sub("\\s.*$", "", .data$type)))) %>%
    dplyr::filter(.data$type_base == "calculate", !is.na(.data$calculation), nzchar(.data$calculation))

  if (!nrow(dat)) return(tibble::tibble())

  purrr::pmap_dfr(dat, function(...) {
    row <- list(...)
    det <- calc_detect_type(as_chr1(row$calculation))
    if (isTRUE(det$ejecutable)) return(tibble::tibble())

    var <- row$name
    gname <- as_chr1(row$group_name)
    tabla <- tabla_destino_de(gname, section_map, main_name = "(principal)")
    G_row <- gmap[gmap$group_name == gname, , drop = FALSE]
    G_h <- as_chr1(if (nrow(G_row)) G_row$G_humano[[1]] else "")
    rel_parsed <- relevant_a_r_y_humano(as_chr1(row$relevant %||% ""), survey, NULL, meta)
    REL_h <- as_chr1(rel_parsed$human)
    secc_label <- .section_label(gname, section_map)
    objetivo <- calc_objetivo_por_tipo(
      det$kind,
      tabla = tabla,
      secc = gname,
      secc_label = secc_label,
      G_h = G_h,
      REL_h = REL_h,
      lab1 = lab_pregunta(survey, meta, var),
      section_map = section_map
    )

    tibble::tibble(
      ID = NA_character_,
      Tabla = tabla,
      `Sección` = gname,
      Categoría = "Valores calculados",
      Tipo = "calculate",
      `Nombre de regla` = gsub("\\.", "_", paste0("calc_", sanitize_id(var), "_eq"), perl = TRUE),
      Objetivo = objetivo,
      `Variable 1` = var,
      `Variable 1 - Etiqueta` = lab_pregunta(survey, meta, var),
      `Variable 2` = NA_character_,
      `Variable 2 - Etiqueta` = NA_character_,
      `Variable 3` = NA_character_,
      `Variable 3 - Etiqueta` = NA_character_,
      `Procesamiento` = NA_character_,
      audit_expected_state = "no_ejecutable",
      audit_issue_code = "runtime_skip",
      audit_detail = paste0("Calculate no ejecutable detectado por tipo: ", det$kind)
    )
  })
}

.audit_expected_inventory <- function(inst) {
  inst2 <- force_label_columns(inst)

  survey <- inst2$survey %>%
    dplyr::mutate(
      dplyr::across(
        dplyr::any_of(c(
          "type", "name", "relevant", "constraint", "calculation",
          "group_name", "required", "list_name", "choice_filter"
        )),
        ~ suppressWarnings(as.character(.x))
      ),
      type_base = tolower(trimws(sub("\\s.*$", "", .data$type))),
      required = {
        s <- tolower(trimws(as.character(.data$required)))
        s <- ifelse(is.na(s), "", s)
        s <- iconv(s, from = "", to = "ASCII//TRANSLIT")
        s %in% c("true()", "true", "yes", "si", "s")
      },
      relevant = gsub("\\s+", " ", trimws(dplyr::coalesce(.data$relevant, "")))
    )

  survey <- .recompute_group_name_from_meta(survey, inst2$meta$groups_detail)
  inst2$survey <- survey

  section_map <- (inst2$meta$section_map %||% tibble::tibble(
    group_name = character(),
    group_label = character(),
    prefix = character(),
    is_repeat = logical()
  )) %>%
    dplyr::mutate(
      group_name = as.character(.data$group_name),
      prefix = as.character(.data$prefix %||% "GEN_"),
      is_repeat = as.logical(.data$is_repeat)
    )
  inst2$meta$section_map <- section_map

  gmap <- tryCatch(.make_gmap(inst2), error = function(e) tibble::tibble())

  expected <- dplyr::bind_rows(
    build_required_g(survey, section_map, inst2$meta, gmap),
    build_relevant_g(survey, section_map, inst2$meta, inst2$choices %||% tibble::tibble(), gmap),
    build_constraint_g(survey, section_map, inst2$meta, gmap),
    build_calculate_g(survey, section_map, inst2$meta, gmap),
    build_choice_filter_g(inst2, gmap),
    .audit_expected_calculate_non_exec(inst2, gmap)
  )

  if (!nrow(expected)) return(tibble::tibble())

  expected <- .audit_finalize_expected_plan(expected, inst2)
  if (!"audit_expected_state" %in% names(expected)) expected$audit_expected_state <- "correcta"
  if (!"audit_issue_code" %in% names(expected)) expected$audit_issue_code <- NA_character_
  if (!"audit_detail" %in% names(expected)) expected$audit_detail <- NA_character_

  idx_calc <- expected$Categoría == "Valores calculados" &
    expected$audit_expected_state == "correcta" &
    !is.na(expected$Procesamiento) &
    nzchar(expected$Procesamiento)

  if (any(idx_calc)) {
    for (i in which(idx_calc)) {
      pr <- .parsear_regla(expected$Procesamiento[[i]], expected$`Nombre de regla`[[i]])
      rhs <- pr$rhs %||% expected$Procesamiento[[i]]
      vars_imp <- unique(stats::na.omit(c(
        expected$`Variable 2`[[i]],
        expected$`Variable 3`[[i]],
        .drivers_from_expr(rhs, survey$name)
      )))
      if (.es_cruce_principal_hijo_sin_agg(expected$Tabla[[i]], vars_imp, survey, section_map, rhs)) {
        expected$audit_expected_state[[i]] <- "ambigua"
        expected$audit_issue_code[[i]] <- "cross_table_ambiguous"
        expected$audit_detail[[i]] <- "Calculate principal-hijo sin agregacion explicita."
      }
    }
  }

  expected
}

.audit_norm_proc <- function(x) {
  x <- as.character(x %||% "")
  if (!nzchar(x)) return(x)
  x <- normalizar_proc(x)
  x <- rewrite_odk_tokens(x)
  x <- normalizar_proc(x)
  x <- gsub("collapse\\s*==\\s*", "collapse = ", x, perl = TRUE)
  x <- gsub("\\$\\{([A-Za-z0-9_]+)\\}", "\\1", x, perl = TRUE)
  trimws(x)
}

.audit_has_self_gate <- function(expected_proc, actual_proc, var) {
  if (!nzchar(as.character(var %||% ""))) return(FALSE)
  pat <- paste0("(?<![A-Za-z0-9_])", gsub("([\\^$.|?*+(){}\\[\\]\\\\])", "\\\\\\1", var, perl = TRUE), "(?![A-Za-z0-9_])")
  exp_n <- stringr::str_count(expected_proc %||% "", pat)
  act_n <- stringr::str_count(actual_proc %||% "", pat)
  act_n > (exp_n + 1L)
}

.audit_same_core_signal <- function(expected_proc, actual_proc, var) {
  if (!nzchar(as.character(var %||% ""))) return(FALSE)
  core_patterns <- c(
    sprintf("\\(is\\.na\\(%s\\) \\| trimws\\(%s\\) == \"\"\\)", var, var),
    sprintf("\\(!is\\.na\\(%s\\) & trimws\\(%s\\) != \"\"\\)", var, var),
    sprintf("!eq_chr_na\\(%s,", var),
    sprintf("!eq_num_na\\(%s,", var)
  )
  any(vapply(core_patterns, function(p) {
    grepl(p, expected_proc %||% "", perl = TRUE) && grepl(p, actual_proc %||% "", perl = TRUE)
  }, logical(1)))
}

.audit_compare_expected_actual <- function(instrumento_id, exp_row = NULL, act_row = NULL) {
  if (is.null(exp_row) && is.null(act_row)) {
    return(tibble::tibble())
  }

  if (is.null(exp_row)) {
    return(tibble::tibble(
      instrumento_id = instrumento_id,
      categoria = act_row$categoria,
      tipo = act_row$tipo,
      id_regla = act_row$id_regla,
      nombre_regla = act_row$nombre_regla,
      variable_origen = act_row$variable_origen,
      tabla_esperada = NA_character_,
      tabla_generada = act_row$tabla_generada,
      estado_estatico = "incorrecta_generacion",
      estado_dinamico = NA_character_,
      severidad = "alta",
      severidad_rank = 3L,
      issue_code = "extra_rule",
      detalle = "La regla fue generada, pero no estaba en el inventario esperado.",
      expresion_esperada = NA_character_,
      expresion_generada = act_row$expresion_generada
    ))
  }

  exp_state <- exp_row$audit_expected_state %||% "correcta"
  exp_issue <- exp_row$audit_issue_code %||% NA_character_
  exp_detail <- exp_row$audit_detail %||% NA_character_

  if (is.null(act_row)) {
    issue <- if (identical(exp_state, "ambigua")) "silent_omission" else if (identical(exp_state, "no_ejecutable")) exp_issue else "missing_rule"
    estado <- if (identical(exp_state, "ambigua")) "ambigua" else if (identical(exp_state, "no_ejecutable")) "no_ejecutable" else "incorrecta_generacion"
    detalle <- if (identical(exp_state, "ambigua")) {
      "La regla esperada no fue generada y debio reportarse como ambigua."
    } else if (identical(exp_state, "no_ejecutable")) {
      exp_detail
    } else {
      "La regla esperada no fue generada."
    }
    sev <- .audit_issue_severity(issue)

    return(tibble::tibble(
      instrumento_id = instrumento_id,
      categoria = exp_row$categoria,
      tipo = exp_row$tipo,
      id_regla = NA_character_,
      nombre_regla = exp_row$nombre_regla,
      variable_origen = exp_row$variable_origen,
      tabla_esperada = exp_row$tabla_esperada,
      tabla_generada = NA_character_,
      estado_estatico = estado,
      estado_dinamico = if (identical(estado, "no_ejecutable")) "no_ejecutable" else NA_character_,
      severidad = sev$label,
      severidad_rank = sev$rank,
      issue_code = issue,
      detalle = detalle,
      expresion_esperada = exp_row$expresion_esperada,
      expresion_generada = NA_character_
    ))
  }

  estado <- exp_state
  issue <- exp_issue
  detalle <- exp_detail

  if (identical(exp_state, "no_ejecutable")) {
    estado <- "incorrecta_generacion"
    issue <- "extra_rule"
    detalle <- "Se genero una regla para un calculate marcado como no ejecutable."
  } else if (!identical(exp_row$tabla_esperada %||% "", act_row$tabla_generada %||% "")) {
    estado <- "incorrecta_generacion"
    issue <- "wrong_table"
    detalle <- "La tabla generada no coincide con la tabla esperada."
  } else {
    exp_proc <- .audit_norm_proc(exp_row$expresion_esperada)
    act_proc <- .audit_norm_proc(act_row$expresion_generada)

    if (identical(exp_state, "ambigua")) {
      estado <- "ambigua"
      issue <- "cross_table_ambiguous"
      detalle <- exp_detail %||% "La regla es ambigua y no debe evaluarse automaticamente."
    } else if (!identical(exp_proc, act_proc)) {
      if (.audit_has_self_gate(exp_proc, act_proc, exp_row$variable_origen)) {
        estado <- "incorrecta_generacion"
        issue <- "self_gate"
        detalle <- "La variable auditada aparece como gate de apertura dentro de la regla generada."
      } else if (.audit_same_core_signal(exp_proc, act_proc, exp_row$variable_origen)) {
        estado <- "incorrecta_generacion"
        issue <- "wrong_gate"
        detalle <- "La condicion de apertura generada no coincide con la esperada."
      } else {
        estado <- "incorrecta_generacion"
        issue <- "wrong_rhs"
        detalle <- "La expresion generada no coincide con la expresion esperada."
      }
    } else {
      estado <- "correcta"
      issue <- NA_character_
      detalle <- NA_character_
    }
  }

  sev <- .audit_issue_severity(issue)
  tibble::tibble(
    instrumento_id = instrumento_id,
    categoria = exp_row$categoria %||% act_row$categoria,
    tipo = exp_row$tipo %||% act_row$tipo,
    id_regla = act_row$id_regla,
    nombre_regla = exp_row$nombre_regla %||% act_row$nombre_regla,
    variable_origen = exp_row$variable_origen %||% act_row$variable_origen,
    tabla_esperada = exp_row$tabla_esperada,
    tabla_generada = act_row$tabla_generada,
    estado_estatico = estado,
    estado_dinamico = NA_character_,
    severidad = sev$label,
    severidad_rank = sev$rank,
    issue_code = issue,
    detalle = detalle,
    expresion_esperada = exp_row$expresion_esperada,
    expresion_generada = act_row$expresion_generada
  )
}

.audit_issue_severity <- function(issue_code) {
  issue_code <- as.character(issue_code %||% NA_character_)
  if (is.na(issue_code) || !nzchar(issue_code)) {
    return(list(label = NA_character_, rank = 0L))
  }

  alta <- c("missing_rule", "extra_rule", "wrong_gate", "wrong_table", "wrong_rhs", "parse_error", "silent_omission")
  media <- c("self_gate", "cross_table_ambiguous", "runtime_skip")
  baja <- c("suspicious_zero_hit", "suspicious_all_hit")

  if (issue_code %in% alta) return(list(label = "alta", rank = 3L))
  if (issue_code %in% media) return(list(label = "media", rank = 2L))
  if (issue_code %in% baja) return(list(label = "baja", rank = 1L))
  list(label = "media", rank = 2L)
}

.audit_actual_signature <- function(plan) {
  if (!nrow(plan)) return(tibble::tibble())
  tibble::tibble(
    id_regla = as.character(plan$ID %||% NA_character_),
    categoria = as.character(plan$`Categoría`),
    tipo = as.character(plan$Tipo),
    nombre_regla = as.character(plan$`Nombre de regla`),
    variable_origen = as.character(plan$`Variable 1`),
    tabla_generada = as.character(plan$Tabla),
    expresion_generada = as.character(plan$Procesamiento)
  )
}

.audit_build_matrix <- function(instrumento_id, inst, plan, evaluacion) {
  expected <- .audit_expected_inventory(inst) %>%
    dplyr::transmute(
      categoria = as.character(.data$Categoría),
      tipo = as.character(.data$Tipo),
      nombre_regla = as.character(.data$`Nombre de regla`),
      variable_origen = as.character(.data$`Variable 1`),
      tabla_esperada = as.character(.data$Tabla),
      expresion_esperada = as.character(.data$Procesamiento),
      audit_expected_state = as.character(.data$audit_expected_state %||% "correcta"),
      audit_issue_code = as.character(.data$audit_issue_code %||% NA_character_),
      audit_detail = as.character(.data$audit_detail %||% NA_character_)
    )

  actual <- .audit_actual_signature(plan)
  rule_names <- sort(unique(c(expected$nombre_regla, actual$nombre_regla)))

  base_rows <- lapply(rule_names, function(nm) {
    exp_row <- expected[expected$nombre_regla == nm, , drop = FALSE]
    act_row <- actual[actual$nombre_regla == nm, , drop = FALSE]
    exp_one <- if (nrow(exp_row)) exp_row[1, , drop = FALSE] else NULL
    act_one <- if (nrow(act_row)) act_row[1, , drop = FALSE] else NULL
    .audit_compare_expected_actual(instrumento_id, exp_one, act_one)
  })

  out <- dplyr::bind_rows(base_rows)
  if (!nrow(out)) return(out)

  dyn <- evaluacion$resumen %>%
    dplyr::transmute(
      id_regla = as.character(.data$id_regla %||% NA_character_),
      nombre_regla = as.character(.data$nombre_regla),
      estado_dinamico_eval = as.character(.data$estado_dinamico %||% NA_character_),
      issue_code_dinamico = as.character(.data$issue_code %||% NA_character_),
      detalle_dinamico = as.character(.data$detalle %||% NA_character_),
      n_inconsistencias = .data$n_inconsistencias,
      porcentaje = .data$porcentaje,
      n_base = .data$n,
      expresion_evaluada = as.character(.data$expresion_evaluada %||% NA_character_)
    )

  out <- out %>%
    dplyr::left_join(dyn, by = c("id_regla", "nombre_regla")) %>%
    dplyr::mutate(
      estado_dinamico = dplyr::coalesce(.data$estado_dinamico_eval, .data$estado_dinamico, ifelse(.data$estado_estatico == "no_ejecutable", "no_ejecutable", NA_character_)),
      detalle = dplyr::case_when(
        !is.na(.data$detalle) & !is.na(.data$detalle_dinamico) ~ paste(.data$detalle, .data$detalle_dinamico, sep = " | "),
        !is.na(.data$detalle) ~ .data$detalle,
        TRUE ~ .data$detalle_dinamico
      ),
      issue_code = dplyr::coalesce(.data$issue_code, .data$issue_code_dinamico),
      expresion_generada = dplyr::coalesce(.data$expresion_generada, .data$expresion_evaluada)
    )

  suspicious_zero <- is.na(out$issue_code) & !is.na(out$n_base) & out$n_base > 0 &
    !is.na(out$n_inconsistencias) & out$n_inconsistencias == 0
  suspicious_all <- is.na(out$issue_code) & !is.na(out$n_base) & out$n_base > 0 &
    !is.na(out$n_inconsistencias) & out$n_inconsistencias == out$n_base

  out$issue_code[suspicious_zero] <- "suspicious_zero_hit"
  out$detalle[suspicious_zero] <- "La regla no marca inconsistencias en ninguna fila de la base evaluada."
  out$issue_code[suspicious_all] <- "suspicious_all_hit"
  out$detalle[suspicious_all] <- "La regla marca inconsistencias en todas las filas de la base evaluada."

  sev <- lapply(out$issue_code, .audit_issue_severity)
  out$severidad <- vapply(sev, `[[`, character(1), "label")
  out$severidad_rank <- vapply(sev, `[[`, integer(1), "rank")

  out %>%
    dplyr::select(
      .data$instrumento_id,
      .data$categoria,
      .data$tipo,
      .data$id_regla,
      .data$nombre_regla,
      .data$variable_origen,
      .data$tabla_esperada,
      .data$tabla_generada,
      .data$estado_estatico,
      .data$estado_dinamico,
      .data$severidad,
      .data$severidad_rank,
      .data$issue_code,
      .data$detalle,
      .data$expresion_esperada,
      .data$expresion_generada,
      .data$n_inconsistencias,
      .data$porcentaje
    )
}

.audit_collect_cases <- function(hallazgos, evaluacion, inst, instrumento_id, sample_n = 5) {
  if (!nrow(hallazgos) || sample_n <= 0) return(tibble::tibble())

  cand <- hallazgos %>%
    dplyr::filter(!is.na(.data$id_regla), !is.na(.data$issue_code)) %>%
    dplyr::arrange(dplyr::desc(.data$severidad_rank), dplyr::desc(.data$n_inconsistencias %||% -1)) %>%
    dplyr::slice_head(n = sample_n)

  if (!nrow(cand)) return(tibble::tibble())

  rows <- lapply(seq_len(nrow(cand)), function(i) {
    aud <- tryCatch(
      auditar_regla(ev = evaluacion, ids = cand$id_regla[[i]], inst = inst, verbose = FALSE),
      error = function(e) NULL
    )

    casos <- aud$casos[[1]] %||% tibble::tibble()
    if (!is.data.frame(casos) || !nrow(casos)) return(NULL)

    out <- tibble::as_tibble(casos)
    out$instrumento_id <- instrumento_id
    out$id_regla <- cand$id_regla[[i]]
    out$nombre_regla <- cand$nombre_regla[[i]]
    out$issue_code <- cand$issue_code[[i]]
    out
  })

  dplyr::bind_rows(rows)
}

.audit_write_markdown <- function(x, path) {
  res <- x$resumen_corpus %||% tibble::tibble()
  hal <- x$hallazgos %||% tibble::tibble()
  bench <- x$benchmarks %||% tibble::tibble()

  lines <- c("# Auditoria de consistencia", "")
  if (nrow(res)) {
    lines <- c(lines, "## Resumen por instrumento", "")
    for (i in seq_len(nrow(res))) {
      lines <- c(
        lines,
        paste0(
          "- `", res$instrumento_id[[i]], "`: ",
          res$n_reglas_auditadas[[i]], " reglas, ",
          res$n_hallazgos[[i]], " hallazgos, ",
          "plan=", round(res$elapsed_generar_plan[[i]], 3), "s, ",
          "eval_sin_labels=", round(res$elapsed_evaluar_sin_labels[[i]], 3), "s, ",
          "eval_con_labels=", round(res$elapsed_evaluar_con_labels[[i]], 3), "s"
        )
      )
    }
    lines <- c(lines, "")
  }

  if (nrow(hal)) {
    top_hal <- utils::head(hal, 20)
    lines <- c(lines, "## Top hallazgos", "")
    for (i in seq_len(nrow(top_hal))) {
      lines <- c(
        lines,
        paste0(
          "- `", top_hal$instrumento_id[[i]], "` / `", top_hal$nombre_regla[[i]], "`: ",
          top_hal$issue_code[[i]], " [", top_hal$severidad[[i]], "]"
        )
      )
      if (!is.na(top_hal$detalle[[i]]) && nzchar(top_hal$detalle[[i]])) {
        lines <- c(lines, paste0("  - ", top_hal$detalle[[i]]))
      }
    }
    lines <- c(lines, "")
  }

  if (nrow(bench)) {
    lines <- c(lines, "## Benchmarks", "")
    for (i in seq_len(nrow(bench))) {
      lines <- c(
        lines,
        paste0(
          "- `", bench$instrumento_id[[i]], "`: leer=",
          round(bench$elapsed_leer_xlsform[[i]], 3), "s, generar=",
          round(bench$elapsed_generar_plan[[i]], 3), "s, evaluar_sin_labels=",
          round(bench$elapsed_evaluar_sin_labels[[i]], 3), "s, evaluar_con_labels=",
          round(bench$elapsed_evaluar_con_labels[[i]], 3), "s"
        )
      )
    }
  }

  writeLines(lines, con = path, useBytes = TRUE)
  invisible(path)
}

.audit_write_xlsx <- function(x, path) {
  wb <- openxlsx::createWorkbook(creator = "prosecnur")

  sheets <- list(
    resumen = x$resumen_corpus %||% tibble::tibble(),
    matriz_reglas = x$matriz_reglas %||% tibble::tibble(),
    hallazgos = x$hallazgos %||% tibble::tibble(),
    casos_muestra = x$casos_muestra %||% tibble::tibble(),
    benchmarks = x$benchmarks %||% tibble::tibble()
  )

  for (nm in names(sheets)) {
    df <- tibble::as_tibble(sheets[[nm]])
    if (!nrow(df) && !ncol(df)) df <- tibble::tibble(vacio = character())
    openxlsx::addWorksheet(wb, nm)
    openxlsx::writeData(wb, nm, df, withFilter = TRUE)
    openxlsx::freezePane(wb, nm, firstRow = TRUE)
    openxlsx::setColWidths(wb, nm, cols = seq_len(ncol(df)), widths = "auto")
  }

  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  invisible(path)
}

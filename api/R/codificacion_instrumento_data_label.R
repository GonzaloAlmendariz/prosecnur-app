#' Codificar y normalizar data de Excel al esquema XMS (XML) usando el instrumento
#'
#' Convierte una base cruda (headers en labels y dummies tipo "Pregunta/Opción")
#' a un esquema XMS basado en el instrumento:
#' - Headers finales = códigos (name) del instrumento y dummies `name/choice_code`
#' - Valores finales = códigos (choice `name`) para select_one y select_multiple
#' - Dummies = numeric 0/1 (cuando sea posible)
#'
#' No se usan labels en R (sin attributes, sin names(x)=labels).
#'
#' @param inst Lista del instrumento. Debe contener `inst$survey`, `inst$choices`,
#'   y `inst$meta$label_col_survey`, `inst$meta$label_col_choices`.
#' @param data_raw data.frame/tibble con headers crudos.
#' @param lang Columna de label del survey a usar. Default `inst$meta$label_col_survey`.
#' @param keep_unmapped Si `TRUE`, conserva columnas no mapeadas al final.
#' @param system_cols Columnas de sistema (orden final) si existen en `data_raw`.
#'
#' @return tibble con columnas y valores codificados a códigos (estilo XML/XMS).
#' @family codificacion
#' @export
instrumento_codificar_xms <- function(inst,
                                      data_raw,
                                      lang = NULL,
                                      keep_unmapped = FALSE,
                                      system_cols = c(
                                        "_id","_uuid","_submission_time","_validation_status","_notes",
                                        "_status","_submitted_by","__version__","_tags","_index"
                                      )) {

  # ---- checks
  if (is.null(lang)) {
    if (is.null(inst$meta$label_col_survey) || !nzchar(inst$meta$label_col_survey)) {
      stop("`lang` es NULL y `inst$meta$label_col_survey` no existe/no es válido.")
    }
    lang <- inst$meta$label_col_survey
  }

  if (is.null(inst$survey) || is.null(inst$choices)) {
    stop("`inst` debe contener `inst$survey` y `inst$choices`.")
  }
  if (!lang %in% names(inst$survey)) {
    stop("`lang` no existe en inst$survey. Recibido: ", lang)
  }
  if (is.null(inst$meta$label_col_choices) || !inst$meta$label_col_choices %in% names(inst$choices)) {
    stop("`inst$meta$label_col_choices` no existe en inst$choices.")
  }

  data_raw <- tibble::as_tibble(data_raw)

  lab_q <- lang
  lab_c <- inst$meta$label_col_choices

  # ---- helpers
  .px_norm <- function(x) {
    x <- as.character(x)
    x <- stringr::str_replace_all(x, "\u00A0", " ")
    x <- stringr::str_replace_all(x, "\u200B", "")
    x <- stringr::str_replace_all(x, "\uFEFF", "")
    x <- stringr::str_replace_all(x, "[\u201C\u201D]", '"')
    x <- stringr::str_replace_all(x, "[\u2018\u2019]", "'")
    x <- stringr::str_replace_all(x, "\\s+", " ")
    stringr::str_squish(trimws(x))
  }

  # key “agresiva” SOLO para matching headers (madre/opción) (fallback)
  .px_key <- function(x) {
    x <- .px_norm(x)
    x <- stringr::str_replace_all(x, "\\$\\{[^}]+\\}", "")
    x <- tolower(x)
    x <- stringr::str_replace_all(x, "[^[:alnum:]]+", " ")
    stringr::str_squish(trimws(x))
  }

  .px_is_blank_chr <- function(x) {
    x <- as.character(x)
    is.na(x) | !nzchar(trimws(x))
  }

  # ---- limpieza mínima headers (para SM posicional)
  .px_clean_hdr_min <- function(x) {
    x <- as.character(x)
    x <- stringr::str_replace_all(x, "\u00A0", " ")
    x <- stringr::str_replace_all(x, "\u200B", "")
    x <- stringr::str_replace_all(x, "\uFEFF", "")
    x <- stringr::str_replace_all(x, "\\.{3,}\\s*\\d+\\s*$", "")
    x
  }

  # colapsar espacios SIN cambiar letras/puntuación
  .px_soft_space <- function(x) {
    x <- .px_clean_hdr_min(x)
    x <- stringr::str_replace_all(x, "\\s+", " ")
    trimws(x)
  }

  .px_build_choice_dict <- function(choices_tbl) {
    choices_tbl |>
      dplyr::transmute(
        list_name  = as.character(.data$list_name),
        code       = as.character(.data$name),
        label_es   = as.character(.data[[lab_c]])
      ) |>
      dplyr::filter(!is.na(.data$list_name), .data$list_name != "",
                    !is.na(.data$code), .data$code != "") |>
      dplyr::mutate(
        label_norm = .px_norm(.data$label_es),
        code_norm  = .px_norm(.data$code),
        label_key  = .px_key(.data$label_es),
        code_key   = .px_key(.data$code)
      )
  }

  choice_dict <- .px_build_choice_dict(inst$choices)

  # ---- mapeo select_one más robusto (codes, labels, key fallback)
  .px_map_select_one <- function(x, list_name) {
    if (is.null(x)) return(x)
    x_chr <- as.character(x)
    x_chr[.px_is_blank_chr(x_chr)] <- NA_character_

    dict <- choice_dict |>
      dplyr::filter(.data$list_name == list_name) |>
      dplyr::select(code, label_norm, code_norm, label_key, code_key)

    if (nrow(dict) == 0) return(x_chr)

    x_norm <- .px_norm(x_chr)
    x_key  <- .px_key(x_chr)

    m_code_norm  <- dict$code[match(x_norm, dict$code_norm)]
    m_label_norm <- dict$code[match(x_norm, dict$label_norm)]
    m_code_key   <- dict$code[match(x_key,  dict$code_key)]
    m_label_key  <- dict$code[match(x_key,  dict$label_key)]

    out <- x_chr
    out <- ifelse(!is.na(m_code_norm),  m_code_norm,  out)
    out <- ifelse(!is.na(m_label_norm), m_label_norm, out)
    out <- ifelse(!is.na(m_code_key),   m_code_key,   out)
    out <- ifelse(!is.na(m_label_key),  m_label_key,  out)

    # si algo no mapeó, se deja tal cual (no se fuerza NA)
    out
  }

  .px_map_select_multiple_mother <- function(x, list_name) {
    if (is.null(x)) return(x)
    x_chr <- as.character(x)
    x_chr[.px_is_blank_chr(x_chr)] <- NA_character_

    dict <- choice_dict |>
      dplyr::filter(.data$list_name == list_name) |>
      dplyr::select(code, label_norm, code_norm)

    if (nrow(dict) == 0) return(x_chr)

    spl <- stringr::str_split(x_chr, "\\s+", simplify = FALSE)

    recoded <- lapply(spl, function(tokens) {
      tokens <- tokens[tokens != ""]
      if (length(tokens) == 0) return(NA_character_)

      t_norm <- .px_norm(tokens)
      m_code  <- dict$code[match(t_norm, dict$code_norm)]
      m_label <- dict$code[match(t_norm, dict$label_norm)]
      final <- ifelse(!is.na(m_code), m_code, m_label)
      final <- final[!is.na(final) & final != ""]
      if (length(final) == 0) return(NA_character_)
      paste(final, collapse = " ")
    })

    unlist(recoded, use.names = FALSE)
  }

  .px_as_dummy01 <- function(x) {
    if (is.null(x)) return(x)
    if (is.factor(x)) x <- as.character(x)
    if (is.logical(x)) return(as.integer(x))
    if (is.numeric(x)) return(as.integer(x))

    x_chr <- as.character(x)
    x_chr <- trimws(x_chr)
    x_chr[.px_is_blank_chr(x_chr)] <- NA_character_

    ok01 <- is.na(x_chr) | stringr::str_detect(x_chr, "^(0|1)(\\.0+)?$")
    if (all(ok01)) return(as.integer(as.numeric(x_chr)))

    okTF <- is.na(x_chr) | toupper(x_chr) %in% c("TRUE","FALSE")
    if (all(okTF)) return(as.integer(toupper(x_chr) == "TRUE"))

    x
  }

  # ---- survey usable
  survey_use <- inst$survey |>
    dplyr::transmute(
      type       = as.character(.data$type),
      name       = as.character(.data$name),
      list_name  = as.character(.data$list_name),
      label_es   = as.character(.data[[lab_q]])
    ) |>
    dplyr::mutate(
      label_norm = .px_norm(.data$label_es),
      label_key  = .px_key(.data$label_es),

      type_base = dplyr::case_when(
        stringr::str_starts(.data$type, "select_one") ~ "select_one",
        stringr::str_starts(.data$type, "select_multiple") ~ "select_multiple",
        TRUE ~ .data$type
      ),
      list_from_type = dplyr::case_when(
        .data$type_base %in% c("select_one","select_multiple") ~
          stringr::str_trim(stringr::str_remove(.data$type, "^(select_one|select_multiple)\\s+")),
        TRUE ~ ""
      ),
      list_final = dplyr::case_when(
        !is.na(.data$list_name) & .data$list_name != "" ~ .data$list_name,
        !is.na(.data$list_from_type) & .data$list_from_type != "" ~ .data$list_from_type,
        TRUE ~ ""
      )
    ) |>
    dplyr::filter(!is.na(.data$name), .data$name != "")

  # ---- modelo XMS (base + dummies + system)
  model_base <- survey_use |>
    dplyr::transmute(dest = .data$name, type_base = .data$type_base, list_name = .data$list_final)

  mult_q <- survey_use |>
    dplyr::filter(.data$type_base == "select_multiple", !is.na(.data$list_final), .data$list_final != "") |>
    dplyr::select(parent_name = .data$name,
                  list_name = .data$list_final,
                  parent_label_key = .data$label_key)

  mult_choices <- mult_q |>
    dplyr::left_join(
      choice_dict |>
        dplyr::select(list_name, choice_code = .data$code),
      by = "list_name"
    ) |>
    dplyr::filter(!is.na(.data$choice_code), .data$choice_code != "") |>
    dplyr::transmute(
      dest = paste0(.data$parent_name, "/", .data$choice_code),
      type_base = "dummy",
      list_name = .data$list_name
    )

  sys_present <- system_cols[system_cols %in% names(data_raw)]
  model_sys <- tibble::tibble(dest = sys_present, type_base = "system", list_name = "")

  modelo_xms <- dplyr::bind_rows(model_base, mult_choices, model_sys) |>
    dplyr::distinct(.data$dest, .keep_all = TRUE)

  # ============================================================
  # 0) DATA REN
  # ============================================================
  data_ren <- data_raw

  # ============================================================
  # 1) RENOMBRE “SEGURO” POR NORMALIZACIÓN: label_es header -> code name
  #    (y registro de provenance raw -> dest para diagnósticos)
  # ============================================================
  survey_labels_exact <- inst$survey %>%
    dplyr::transmute(
      name     = as.character(.data$name),
      label_es = as.character(.data[[lab_q]])
    ) %>%
    dplyr::filter(!is.na(.data$name), .data$name != "",
                  !is.na(.data$label_es), .data$label_es != "")

  hdrs <- names(data_ren)
  hdrs_norm <- vapply(hdrs, .px_norm, character(1))

  provenance <- tibble::tibble(raw = character(), dest = character(), how = character())

  for (i in seq_len(nrow(survey_labels_exact))) {
    nm <- survey_labels_exact$name[i]
    lb <- survey_labels_exact$label_es[i]
    if (is.na(nm) || !nzchar(nm) || is.na(lb) || !nzchar(lb)) next
    if (nm %in% names(data_ren)) next

    lb_norm <- .px_norm(lb)
    hit <- which(hdrs_norm == lb_norm)

    if (length(hit) >= 1) {
      raw_before <- names(data_ren)[hit[1]]

      # evitar pisar si el destino ya existe
      if (!(nm %in% names(data_ren))) {
        names(data_ren)[hit[1]] <- nm
        provenance <- dplyr::bind_rows(
          provenance,
          tibble::tibble(raw = raw_before, dest = nm, how = "label_norm_exact")
        )
      }

      hdrs <- names(data_ren)
      hdrs_norm <- vapply(hdrs, .px_norm, character(1))
    }
  }

  # ============================================================
  # 2) MAPEO adicional (no-slash) por normalización
  #    FIX: evitar ambigüedad -> SOLO labels únicos en survey_use
  # ============================================================
  map_label_to_name <- survey_use |>
    dplyr::filter(!is.na(.data$label_norm), .data$label_norm != "") |>
    dplyr::group_by(.data$label_norm) |>
    dplyr::summarise(
      n = dplyr::n_distinct(.data$name),
      name = dplyr::first(.data$name),
      .groups = "drop"
    ) |>
    dplyr::filter(.data$n == 1) |>
    dplyr::select(.data$label_norm, .data$name)

  raw_names <- names(data_ren)
  raw_norm  <- .px_norm(raw_names)

  raw_no_slash <- tibble::tibble(raw = raw_names, raw_norm = raw_norm) |>
    dplyr::filter(!stringr::str_detect(.data$raw, "/"))

  mapA <- raw_no_slash |>
    dplyr::left_join(map_label_to_name, by = c("raw_norm" = "label_norm")) |>
    dplyr::filter(!is.na(.data$name), .data$name != "") |>
    dplyr::transmute(raw = .data$raw, dest = .data$name)

  if (nrow(mapA) > 0) {
    for (i in seq_len(nrow(mapA))) {
      r <- mapA$raw[i]
      d <- mapA$dest[i]
      if (!is.na(r) && !is.na(d) && r %in% names(data_ren) && nzchar(d)) {
        if (d %in% names(data_ren)) next  # no pisar destinos existentes
        names(data_ren)[names(data_ren) == r] <- d
        provenance <- dplyr::bind_rows(
          provenance,
          tibble::tibble(raw = r, dest = d, how = "label_norm_unique")
        )
      }
    }
  }

  # ============================================================
  # 2B) DUMMIES (SM): MÉTODO PRINCIPAL = POSICIONAL (madre + k columnas)
  #     + fallback por KEY para complementar lo que falte
  # ============================================================

  .px_is_01_na <- function(x) {
    x <- x[!is.na(x)]
    if (length(x) == 0) return(TRUE)
    all(x %in% c(0,1,"0","1",0L,1L))
  }

  .px_score_window <- function(df, start_pos, k) {
    idx <- (start_pos + 1):(start_pos + k)
    idx <- idx[idx >= 1 & idx <= ncol(df)]
    if (length(idx) == 0) return(0)
    mean(vapply(idx, function(j) .px_is_01_na(df[[j]]), logical(1)))
  }

  choice_ord_tbl <- inst$choices %>%
    dplyr::transmute(
      list_name   = as.character(.data$list_name),
      choice_code = as.character(.data$name)
    ) %>%
    dplyr::filter(!is.na(.data$list_name), .data$list_name != "",
                  !is.na(.data$choice_code), .data$choice_code != "") %>%
    dplyr::group_by(.data$list_name) %>%
    dplyr::mutate(choice_ord = dplyr::row_number()) %>%
    dplyr::ungroup()

  sm_def <- inst$survey %>%
    dplyr::transmute(
      inst_pos  = dplyr::row_number(),
      name      = as.character(.data$name),
      type      = as.character(.data$type),
      list_name = as.character(.data$list_name),
      label_es  = as.character(.data[[lab_q]])
    ) %>%
    dplyr::mutate(
      type_base = dplyr::case_when(
        stringr::str_starts(.data$type, "select_multiple") ~ "select_multiple",
        stringr::str_starts(.data$type, "select_one")      ~ "select_one",
        TRUE ~ .data$type
      ),
      list_from_type = dplyr::case_when(
        .data$type_base %in% c("select_one","select_multiple") ~
          stringr::str_trim(stringr::str_remove(.data$type, "^(select_one|select_multiple)\\s+")),
        TRUE ~ ""
      ),
      list_final = dplyr::case_when(
        !is.na(.data$list_name) & .data$list_name != "" ~ .data$list_name,
        !is.na(.data$list_from_type) & .data$list_from_type != "" ~ .data$list_from_type,
        TRUE ~ ""
      ),
      hdr_base = dplyr::if_else(is.na(.data$label_es) | .data$label_es == "", .data$name, .data$label_es),
      hdr_base_soft = .px_soft_space(.data$hdr_base)
    ) %>%
    dplyr::filter(!is.na(.data$name), .data$name != "",
                  .data$type_base == "select_multiple",
                  !is.na(.data$list_final), .data$list_final != "") %>%
    dplyr::left_join(
      choice_ord_tbl,
      by = c("list_final" = "list_name")
    ) %>%
    dplyr::filter(!is.na(.data$choice_code), .data$choice_code != "") %>%
    dplyr::group_by(.data$name, .data$inst_pos, .data$hdr_base_soft, .data$list_final) %>%
    dplyr::summarise(
      k = dplyr::n(),
      choice_codes = list(.data$choice_code[order(.data$choice_ord)]),
      .groups = "drop"
    )

  dummy_map_pos <- tibble::tibble(raw_pos = integer(), dest = character())

  if (nrow(sm_def) > 0) {
    raw_hdr_soft <- .px_soft_space(names(data_raw))
    raw_tbl <- tibble::tibble(raw_pos = seq_along(raw_hdr_soft), raw_hdr_soft = raw_hdr_soft)

    mother_cand <- sm_def %>%
      dplyr::left_join(raw_tbl, by = c("hdr_base_soft" = "raw_hdr_soft")) %>%
      dplyr::mutate(found_mother = !is.na(.data$raw_pos))

    mother_hits_best <- mother_cand %>%
      dplyr::group_by(.data$name) %>%
      dplyr::mutate(
        win_score = dplyr::if_else(
          is.na(.data$raw_pos), -1,
          vapply(.data$raw_pos, function(p) .px_score_window(data_raw, p, .data$k[1]), numeric(1))
        )
      ) %>%
      dplyr::arrange(dplyr::desc(.data$win_score), .data$raw_pos) %>%
      dplyr::slice(1) %>%
      dplyr::ungroup()

    build_map_one <- function(parent_name, raw_pos, k, choice_codes) {
      if (is.na(raw_pos)) return(tibble::tibble(raw_pos = integer(), dest = character()))
      idx <- (raw_pos + 1):(raw_pos + k)
      idx <- idx[idx >= 1 & idx <= ncol(data_raw)]
      if (length(idx) == 0) return(tibble::tibble(raw_pos = integer(), dest = character()))
      if (length(idx) < length(choice_codes)) choice_codes <- choice_codes[seq_len(length(idx))]
      tibble::tibble(raw_pos = idx, dest = paste0(parent_name, "/", choice_codes))
    }

    dummy_map_pos <- dplyr::bind_rows(lapply(seq_len(nrow(mother_hits_best)), function(i) {
      build_map_one(
        parent_name  = mother_hits_best$name[i],
        raw_pos      = mother_hits_best$raw_pos[i],
        k            = mother_hits_best$k[i],
        choice_codes = mother_hits_best$choice_codes[[i]]
      )
    })) %>%
      dplyr::filter(!is.na(.data$dest), .data$dest != "") %>%
      dplyr::distinct(.data$dest, .keep_all = TRUE)
  }

  # --- fallback antiguo (por KEY) para complementar si algo quedara suelto
  dummy_map_key <- tibble::tibble(raw = character(), dest = character())

  raw_names2 <- names(data_ren)
  idx_slash <- which(stringr::str_detect(raw_names2, "/"))

  if (length(idx_slash) > 0 && nrow(mult_q) > 0) {
    slash_tbl <- tibble::tibble(raw = raw_names2[idx_slash]) %>%
      dplyr::mutate(
        parent_part = stringr::str_trim(stringr::str_remove(.data$raw, "/[^/]*$")),
        option_part = stringr::str_trim(stringr::str_replace(.data$raw, "^.*/", "")),
        parent_key  = .px_key(.data$parent_part),
        option_key  = .px_key(.data$option_part)
      )

    dict_choices <- choice_dict %>%
      dplyr::select(list_name, choice_code = .data$code, choice_key = .data$label_key)

    for (i in seq_len(nrow(mult_q))) {
      parent_name <- mult_q$parent_name[i]
      list_name   <- mult_q$list_name[i]
      pkey        <- mult_q$parent_label_key[i]

      if (is.na(parent_name) || !nzchar(parent_name)) next
      if (is.na(list_name) || !nzchar(list_name)) next
      if (is.na(pkey) || !nzchar(pkey)) next

      cand <- slash_tbl %>% dplyr::filter(.data$parent_key == pkey)
      if (nrow(cand) == 0) next

      dictL <- dict_choices %>% dplyr::filter(.data$list_name == list_name)
      if (nrow(dictL) == 0) next

      cand2 <- cand %>%
        dplyr::left_join(dictL, by = c("option_key" = "choice_key")) %>%
        dplyr::filter(!is.na(.data$choice_code), .data$choice_code != "") %>%
        dplyr::transmute(raw = .data$raw, dest = paste0(parent_name, "/", .data$choice_code))

      if (nrow(cand2) == 0) next
      dummy_map_key <- dplyr::bind_rows(dummy_map_key, cand2)
    }

    dummy_map_key <- dummy_map_key %>%
      dplyr::filter(!is.na(.data$raw), !is.na(.data$dest), .data$raw != "", .data$dest != "") %>%
      dplyr::distinct(.data$raw, .keep_all = TRUE)
  }

  # ============================================================
  # 3) SALIDA: copiar dummies (primero POSICIONAL, luego fallback KEY)
  # ============================================================
  out <- data_ren
  n <- nrow(out)

  # 3A) POSICIONAL
  if (nrow(dummy_map_pos) > 0) {
    for (i in seq_len(nrow(dummy_map_pos))) {
      rp <- dummy_map_pos$raw_pos[i]
      d  <- dummy_map_pos$dest[i]
      if (is.na(rp) || rp < 1 || rp > ncol(data_ren)) next

      if (!(d %in% names(out))) {
        out[[d]] <- data_ren[[rp]]
      } else {
        xd <- out[[d]]
        all_missing <- if (is.character(xd)) all(is.na(xd) | !nzchar(trimws(xd))) else all(is.na(xd))
        if (isTRUE(all_missing)) out[[d]] <- data_ren[[rp]]
      }
    }
  }

  # 3B) FALLBACK KEY (por nombre raw)
  if (nrow(dummy_map_key) > 0) {
    for (i in seq_len(nrow(dummy_map_key))) {
      r <- dummy_map_key$raw[i]
      d <- dummy_map_key$dest[i]
      if (!(r %in% names(out))) next

      if (!(d %in% names(out))) {
        out[[d]] <- out[[r]]
      } else {
        xd <- out[[d]]
        all_missing <- if (is.character(xd)) all(is.na(xd) | !nzchar(trimws(xd))) else all(is.na(xd))
        if (isTRUE(all_missing)) out[[d]] <- out[[r]]
      }
    }
  }

  # asegurar existencia de TODAS las columnas del modelo
  for (dest in modelo_xms$dest) {
    if (!(dest %in% names(out))) out[[dest]] <- rep(NA, n)
  }

  # ============================================================
  # PATCH ORDEN: padre SM + dummies inmediatamente a la derecha
  # ============================================================
  base_order2 <- character(0)

  for (i in seq_len(nrow(survey_use))) {
    nm <- survey_use$name[i]
    if (is.na(nm) || !nzchar(nm)) next
    base_order2 <- c(base_order2, nm)

    if (identical(survey_use$type_base[i], "select_multiple")) {
      ln <- survey_use$list_final[i]
      if (!is.na(ln) && nzchar(ln)) {
        codes <- choice_dict |>
          dplyr::filter(.data$list_name == ln) |>
          dplyr::pull(.data$code)
        if (length(codes) > 0) base_order2 <- c(base_order2, paste0(nm, "/", codes))
      }
    }
  }

  base_order2 <- c(base_order2, sys_present)
  base_order2 <- unique(base_order2)
  missing_from_base <- setdiff(modelo_xms$dest, base_order2)
  base_order2 <- c(base_order2, missing_from_base)

  if (isTRUE(keep_unmapped)) {
    extras <- setdiff(names(out), base_order2)
    final_order <- c(base_order2, extras)
  } else {
    final_order <- base_order2
  }

  out <- out[, final_order, drop = FALSE]

  # ============================================================
  # 4) CODIFICACIÓN: select_one / select_multiple + dummies 0/1
  # ============================================================
  so <- survey_use |>
    dplyr::filter(.data$type_base == "select_one",
                  !is.na(.data$list_final), .data$list_final != "") |>
    dplyr::select(name = .data$name, list_name = .data$list_final)

  if (nrow(so) > 0) {
    for (i in seq_len(nrow(so))) {
      nm <- so$name[i]
      ln <- so$list_name[i]
      if (!is.na(nm) && nm %in% names(out)) out[[nm]] <- .px_map_select_one(out[[nm]], ln)
    }
  }

  sm <- survey_use |>
    dplyr::filter(.data$type_base == "select_multiple",
                  !is.na(.data$list_final), .data$list_final != "") |>
    dplyr::select(name = .data$name, list_name = .data$list_final)

  if (nrow(sm) > 0) {
    for (i in seq_len(nrow(sm))) {
      nm <- sm$name[i]
      ln <- sm$list_name[i]
      if (!is.na(nm) && nm %in% names(out)) out[[nm]] <- .px_map_select_multiple_mother(out[[nm]], ln)
    }
  }

  dmy <- mult_choices$dest
  dmy <- dmy[dmy %in% names(out)]
  if (length(dmy) > 0) {
    for (nm in dmy) out[[nm]] <- .px_as_dummy01(out[[nm]])
  }

  # ============================================================
  # PATCH MADRE: reconstruir madres SM desde dummies (si hay 1s)
  # ============================================================
  .px_sm_rebuild_from_dummies <- function(out, survey_use, choice_dict) {

    sm_parents <- survey_use |>
      dplyr::filter(.data$type_base == "select_multiple",
                    !is.na(.data$list_final), .data$list_final != "") |>
      dplyr::select(parent = .data$name, listn = .data$list_final)

    if (nrow(sm_parents) == 0) return(out)

    for (i in seq_len(nrow(sm_parents))) {
      parent <- sm_parents$parent[i]
      listn  <- sm_parents$listn[i]

      codes <- choice_dict |>
        dplyr::filter(.data$list_name == listn) |>
        dplyr::pull(.data$code)

      if (length(codes) == 0) next

      dcols <- paste0(parent, "/", codes)
      dcols <- dcols[dcols %in% names(out)]
      if (length(dcols) == 0) next

      for (dc in dcols) out[[dc]] <- .px_as_dummy01(out[[dc]])

      mat <- as.data.frame(out[, dcols, drop = FALSE])
      for (dc in names(mat)) mat[[dc]] <- as.integer(mat[[dc]])

      rebuilt <- apply(mat, 1, function(r) {
        pick <- codes[seq_along(dcols)][which(r == 1L)]
        if (length(pick) == 0) return(NA_character_)
        paste(pick, collapse = " ")
      })

      if (!parent %in% names(out)) out[[parent]] <- NA_character_

      idx <- which(!is.na(rebuilt) & rebuilt != "")
      if (length(idx) > 0) out[[parent]][idx] <- rebuilt[idx]
    }

    out
  }

  out <- .px_sm_rebuild_from_dummies(out, survey_use, choice_dict)

  # ============================================================
  # CHECKS GENÉRICOS (no bloquean): detectar columnas SO “contaminadas”
  # ============================================================
  # Regla: si una variable select_one tiene lista L, se calcula % de valores
  # que pertenecen a (codes o labels) de L. Si es ~0, se avisa.
  .px_diag_select_one <- function(out, survey_use, choice_dict, thr_warn = 0.05) {
    so_tbl <- survey_use |>
      dplyr::filter(.data$type_base == "select_one",
                    !is.na(.data$list_final), .data$list_final != "") |>
      dplyr::select(name = .data$name, listn = .data$list_final)

    if (nrow(so_tbl) == 0) return(invisible(NULL))

    dict2 <- choice_dict |>
      dplyr::transmute(
        list_name = .data$list_name,
        code      = as.character(.data$code),
        label     = as.character(.data$label_es),
        code_norm = .px_norm(.data$code),
        lab_norm  = .px_norm(.data$label_es)
      )

    msgs <- character(0)

    for (i in seq_len(nrow(so_tbl))) {
      nm <- so_tbl$name[i]
      ln <- so_tbl$listn[i]
      if (!nm %in% names(out)) next

      x <- as.character(out[[nm]])
      x <- x[!is.na(x) & nzchar(trimws(x))]
      if (length(x) == 0) next

      dL <- dict2 |> dplyr::filter(.data$list_name == ln)
      if (nrow(dL) == 0) next

      set_codes <- unique(dL$code_norm)
      set_labs  <- unique(dL$lab_norm)

      x_norm <- .px_norm(x)
      pct <- mean(x_norm %in% set_codes | x_norm %in% set_labs)

      if (is.finite(pct) && pct < thr_warn) {
        msgs <- c(msgs, paste0(nm, " (list=", ln, "): pct_match=", sprintf("%.3f", pct)))
      }
    }

    if (length(msgs) > 0) {
      message(
        "instrumento_codificar_xms(): WARNING select_one con baja coincidencia a sus listas (posible mapeo/renombre cruzado):\n",
        paste0(" - ", msgs, collapse = "\n")
      )
    }

    invisible(NULL)
  }

  .px_diag_select_one(out, survey_use, choice_dict)

  out
}

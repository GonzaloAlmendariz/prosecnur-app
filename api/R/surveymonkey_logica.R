# =============================================================================
# Lógica condicional desde el constructor de SurveyMonkey → columna `relevant`
# del XLSForm.
#
# Formato textual aceptado (copiable desde el constructor de SurveyMonkey):
#
#   Q7 NOT IN [C4, C5, C6, C7] => Ocultar P8, Ocultar P9, Ocultar P10.
#   Q8 = C1 => Ocultar P10.
#   Q27 != C1 => Ocultar P31.
#
# Convenciones:
# - `Qn` o `Pn` referencia la pregunta cuya `name_final` (lowercase) es `pn`.
#   Si el dataset tiene una battery/multi `Pn_1, Pn_2, ...`, "Ocultar Pn" se
#   expande a todas sus children.
# - `Cm` referencia la m-ésima opción de la pregunta condicional, mapeada al
#   `name` del catálogo XLSForm (que coincide con el code numérico del .sav).
# - Operadores soportados: `=`, `!=`, `IN [...]`, `NOT IN [...]`.
# - "Ocultar Pág. N" NO está soportado en este corte; emite advertencia.
# - Las reglas se acumulan: si dos reglas afectan al mismo target, sus
#   condiciones se combinan con `and` (ambas deben permitirlo).
# =============================================================================

#' Parsea reglas de lógica condicional escritas al estilo SurveyMonkey.
#'
#' @param text Cadena con una o más líneas. Cada línea debe respetar el formato
#'   `Q{n} <op> <valor> => Ocultar <P{m}>[, Ocultar <P{k}>...]`. Líneas vacías
#'   y líneas que comienzan con `#` se ignoran.
#' @return Tibble con columnas `target` (chr), `when_var` (chr),
#'   `when_op` (chr: "eq"/"ne"/"in"/"not_in"), `when_codes` (list of chr).
#' @export
surveymonkey_parsear_logica <- function(text) {
  if (is.null(text) || !length(text)) {
    return(.sm_empty_reglas())
  }
  lines <- unlist(strsplit(paste(text, collapse = "\n"), "\n", fixed = TRUE))
  lines <- trimws(lines)
  lines <- lines[nzchar(lines) & !startsWith(lines, "#")]
  if (!length(lines)) return(.sm_empty_reglas())

  parsed <- lapply(lines, .sm_parse_rule_line)
  parsed <- parsed[!vapply(parsed, is.null, logical(1))]
  if (!length(parsed)) return(.sm_empty_reglas())
  do.call(rbind, parsed)
}

.sm_empty_reglas <- function() {
  tibble::tibble(
    target = character(0),
    when_var = character(0),
    when_op = character(0),
    when_codes = list()
  )
}

.sm_parse_rule_line <- function(line) {
  # Quita el punto final si lo hay y normaliza espacios
  line <- sub("\\.\\s*$", "", trimws(line))
  if (!grepl("=>", line, fixed = TRUE)) {
    warning(sprintf("Regla ignorada (sin '=>'): %s", line), call. = FALSE)
    return(NULL)
  }
  parts <- strsplit(line, "=>", fixed = TRUE)[[1]]
  if (length(parts) != 2L) {
    warning(sprintf("Regla con múltiples '=>' ignorada: %s", line), call. = FALSE)
    return(NULL)
  }
  cond <- trimws(parts[1])
  actions <- trimws(parts[2])

  # Parsea la condición
  parsed_cond <- .sm_parse_condition(cond)
  if (is.null(parsed_cond)) {
    warning(sprintf("No pude parsear la condición: %s", cond), call. = FALSE)
    return(NULL)
  }

  # Parsea las acciones: "Ocultar P8", "Ocultar Pág. 17", "Fin de encuesta"
  action_items <- trimws(unlist(strsplit(actions, ",", fixed = TRUE)))
  targets <- character(0)
  for (act in action_items) {
    # "Fin (de la encuesta)" / "Terminar (encuesta)" → target especial "END"
    # — equivale a ocultar todas las páginas estrictamente posteriores a la
    # página donde vive la variable condicional.
    if (grepl(perl = TRUE, "(?i)^(Fin(\\s+de(\\s+la)?(\\s+encuesta)?)?|Terminar(\\s+encuesta)?)\\s*$", act)) {
      targets <- c(targets, "END")
      next
    }
    # "Ocultar Pág. N" o "Ocultar Pag. N" → target especial "PAG:N"
    mp <- regmatches(act, regexec(perl = TRUE, "(?i)^Ocultar\\s+P[aá]g\\.?\\s+(\\d+)\\s*$", act))[[1]]
    if (length(mp) == 2L) {
      targets <- c(targets, paste0("PAG:", mp[2]))
      next
    }
    # "Ocultar Q{n}" o "Ocultar P{n}"
    m <- regmatches(act, regexec(perl = TRUE, "(?i)^Ocultar\\s+([QP][0-9]+(?:_[A-Za-z0-9]+)?)\\s*$", act))[[1]]
    if (length(m) == 2L) {
      targets <- c(targets, toupper(m[2]))
      next
    }
    warning(sprintf("Acción ignorada (formato no reconocido): %s", act), call. = FALSE)
  }
  if (!length(targets)) return(NULL)

  tibble::tibble(
    target = targets,
    when_var = parsed_cond$when_var,
    when_op = parsed_cond$when_op,
    when_codes = list(parsed_cond$when_codes)[rep(1L, length(targets))]
  )
}

.sm_parse_condition <- function(cond) {
  # NOT IN [a, b, c]
  m <- regmatches(cond, regexec(perl = TRUE, "(?i)^([QP][0-9]+(?:_[A-Za-z0-9]+)?)\\s+NOT\\s+IN\\s*\\[([^\\]]*)\\]\\s*$", cond))[[1]]
  if (length(m) == 3L) {
    return(list(
      when_var = toupper(m[2]),
      when_op = "not_in",
      when_codes = .sm_parse_code_list(m[3])
    ))
  }
  # IN [a, b, c]
  m <- regmatches(cond, regexec(perl = TRUE, "(?i)^([QP][0-9]+(?:_[A-Za-z0-9]+)?)\\s+IN\\s*\\[([^\\]]*)\\]\\s*$", cond))[[1]]
  if (length(m) == 3L) {
    return(list(
      when_var = toupper(m[2]),
      when_op = "in",
      when_codes = .sm_parse_code_list(m[3])
    ))
  }
  # = [X, Y, ...] (lista con brackets)
  m <- regmatches(cond, regexec(perl = TRUE, "^([QP][0-9]+(?:_[A-Za-z0-9]+)?)\\s*=\\s*\\[([^\\]]*)\\]\\s*$", cond))[[1]]
  if (length(m) == 3L) {
    codes <- .sm_parse_code_list(m[3])
    return(list(
      when_var = toupper(m[2]),
      when_op = if (length(codes) == 1L) "eq" else "in",
      when_codes = codes
    ))
  }
  # = X (valor único)
  m <- regmatches(cond, regexec(perl = TRUE, "^([QP][0-9]+(?:_[A-Za-z0-9]+)?)\\s*=\\s*([A-Za-z0-9_]+)\\s*$", cond))[[1]]
  if (length(m) == 3L) {
    return(list(
      when_var = toupper(m[2]),
      when_op = "eq",
      when_codes = .sm_parse_code_list(m[3])
    ))
  }
  # != [X, Y, ...]
  m <- regmatches(cond, regexec(perl = TRUE, "^([QP][0-9]+(?:_[A-Za-z0-9]+)?)\\s*!=\\s*\\[([^\\]]*)\\]\\s*$", cond))[[1]]
  if (length(m) == 3L) {
    codes <- .sm_parse_code_list(m[3])
    return(list(
      when_var = toupper(m[2]),
      when_op = if (length(codes) == 1L) "ne" else "not_in",
      when_codes = codes
    ))
  }
  # != X
  m <- regmatches(cond, regexec(perl = TRUE, "^([QP][0-9]+(?:_[A-Za-z0-9]+)?)\\s*!=\\s*([A-Za-z0-9_]+)\\s*$", cond))[[1]]
  if (length(m) == 3L) {
    return(list(
      when_var = toupper(m[2]),
      when_op = "ne",
      when_codes = .sm_parse_code_list(m[3])
    ))
  }
  NULL
}

.sm_parse_code_list <- function(s) {
  # Reconoce strings con comillas ("Consultará") y tokens sin comillas (C2,
  # 1, etc.). Las strings con comillas se preservan tal cual; los tokens
  # se uppercased para luego resolverlos como C{N} o literales.
  s <- trimws(s)
  items <- character(0)
  pos <- 1L
  n <- nchar(s)
  while (pos <= n) {
    ch <- substr(s, pos, pos)
    if (ch %in% c('"', "'")) {
      # Cadena entre comillas — busca el cierre
      end <- regexpr(paste0("(?<!\\\\)", ch), substr(s, pos + 1L, n), perl = TRUE)
      if (end > 0) {
        items <- c(items, substr(s, pos + 1L, pos + end - 1L))
        pos <- pos + end + 1L
      } else {
        items <- c(items, substr(s, pos + 1L, n))
        pos <- n + 1L
      }
    } else if (ch %in% c(",", " ", "\t")) {
      pos <- pos + 1L
    } else {
      # Token sin comillas hasta la próxima coma
      end <- regexpr(",", substr(s, pos, n), fixed = TRUE)
      if (end > 0) {
        items <- c(items, trimws(substr(s, pos, pos + end - 2L)))
        pos <- pos + end
      } else {
        items <- c(items, trimws(substr(s, pos, n)))
        pos <- n + 1L
      }
    }
  }
  items <- items[nzchar(items)]
  # Tokens C{N} o C2 se uppercasean; literales con comillas se preservan.
  ifelse(grepl("^C\\d+$", items, ignore.case = TRUE), toupper(items), items)
}

#' Aplica reglas de lógica al XLSForm de referencia.
#'
#' @param xlsform Objeto retornado por [surveymonkey_xlsform()].
#' @param reglas Tibble como el devuelto por [surveymonkey_parsear_logica()],
#'   o cadena de texto que se parsea automáticamente.
#' @param sm Objeto retornado por [surveymonkey_leer()] (necesario para
#'   resolver Qn → name_final y Cm → code real).
#' @param paginas Lista nombrada por número de página (chr o int) con vector
#'   de identificadores de pregunta (`c("Q17","Q28","Q29")`). Necesario para
#'   resolver acciones tipo "Ocultar Pág. N". Si una regla referencia una
#'   página no listada, se emite warning y se ignora.
#' @return El mismo `xlsform` con la columna `survey$relevant` actualizada.
#' @export
surveymonkey_aplicar_logica <- function(xlsform, reglas, sm, paginas = NULL,
                                          choice_order_overrides = NULL) {
  if (is.character(reglas)) {
    reglas <- surveymonkey_parsear_logica(reglas)
  }
  if (!nrow(reglas)) return(xlsform)

  vars_tbl <- sm$vars_tbl
  label_sets <- sm$label_sets
  survey <- as.data.frame(xlsform$survey, stringsAsFactors = FALSE)
  if (!"relevant" %in% names(survey)) survey$relevant <- NA_character_

  # Detectar estilo dominante para resolver Qn↔Pn↔q0007 sin ambigüedad cuando
  # el dataset tiene tanto custom variables (p0001-p0009) como preguntas reales
  # (q0007, q0008, ...).
  style <- .sm_detect_naming_style(survey)

  resolved <- list()  # target_name → exprs[]

  for (i in seq_len(nrow(reglas))) {
    r <- reglas[i, , drop = FALSE]
    target_names <- .sm_resolve_target_one(r$target[1], survey, vars_tbl, style, paginas, when_var = r$when_var[1])
    if (!length(target_names)) {
      warning(sprintf("Target '%s' no encontrado en el survey, regla ignorada.", r$target[1]), call. = FALSE)
      next
    }
    when_resolved <- .sm_resolve_when(r$when_var[1], r$when_codes[[1]], vars_tbl, label_sets, survey, style, xlsform$choices, choice_order_overrides)
    if (is.null(when_resolved)) {
      warning(sprintf("No pude resolver la variable condicional '%s', regla ignorada.", r$when_var[1]), call. = FALSE)
      next
    }
    # XLSForm relevant = "se muestra cuando" — invertimos el sentido de Ocultar.
    relevant_op <- switch(r$when_op[1],
      "eq" = "ne", "ne" = "eq",
      "in" = "not_in", "not_in" = "in",
      stop("op desconocido")
    )
    expr <- .sm_build_relevant_expr(
      var_ref = when_resolved$var_ref,
      is_multi = when_resolved$is_multi,
      op = relevant_op,
      codes = when_resolved$codes
    )
    for (tn in target_names) {
      resolved[[tn]] <- c(resolved[[tn]], expr)
    }
  }

  # Consolidación a nivel sección: si todas las preguntas de un
  # `section_pag_N` comparten exactamente el mismo conjunto de expresiones,
  # subir el relevant al begin_group y vaciar las entradas individuales.
  # Genera XLSForms idiomáticos en lugar de replicar la misma expresión
  # en cada fila.
  resolved <- .sm_consolidar_a_secciones(resolved, survey)

  # Combina múltiples expresiones para el mismo target con `and`.
  for (tn in names(resolved)) {
    exprs <- resolved[[tn]]
    combined <- if (length(exprs) == 1L) exprs[[1]] else paste0("(", paste(exprs, collapse = ") and ("), ")")
    idx <- which(survey$name == tn)
    if (length(idx)) survey$relevant[idx[1]] <- combined
  }

  xlsform$survey <- tibble::as_tibble(survey)
  xlsform
}

# Si todas las preguntas dentro de un `begin_group section_pag_N` reciben
# exactamente las mismas expresiones, las mueve al begin_group y limpia las
# entradas por-pregunta.
.sm_consolidar_a_secciones <- function(resolved, survey) {
  if (!length(resolved)) return(resolved)
  section_members <- .sm_collect_section_members(survey)
  if (!length(section_members)) return(resolved)

  for (sec_name in names(section_members)) {
    members <- section_members[[sec_name]]
    if (!length(members)) next
    if (!all(members %in% names(resolved))) next
    exprs_sets <- lapply(members, function(m) sort(unique(resolved[[m]])))
    # Todos los miembros con el mismo conjunto de expresiones?
    if (length(unique(exprs_sets)) != 1L) next
    resolved[[sec_name]] <- exprs_sets[[1]]
    for (m in members) resolved[[m]] <- NULL
  }
  resolved
}

# Para cada `begin_group section_pag_N` en el survey, devuelve los nombres de
# las preguntas que viven en su interior (incluyendo children de batteries
# y multi-selects internos). Útil para consolidar relevant a nivel sección.
.sm_collect_section_members <- function(survey) {
  out <- list()
  n <- nrow(survey)
  i <- 1L
  while (i <= n) {
    type_i <- survey$type[i]
    name_i <- survey$name[i]
    if (!is.na(type_i) && type_i == "begin_group" &&
        !is.na(name_i) && grepl("^section_pag_", name_i)) {
      sec_name <- name_i
      depth <- 1L
      members <- character(0)
      j <- i + 1L
      while (j <= n && depth > 0L) {
        t <- survey$type[j]
        nm <- survey$name[j]
        if (!is.na(t) && t == "begin_group") {
          depth <- depth + 1L
        } else if (!is.na(t) && t == "end_group") {
          depth <- depth - 1L
        } else if (!is.na(nm) && nzchar(nm)) {
          members <- c(members, nm)
        }
        j <- j + 1L
      }
      out[[sec_name]] <- members
      i <- j
    } else {
      i <- i + 1L
    }
  }
  out
}

# Detecta el estilo dominante del dataset: prefijo (q vs p) y padding del
# número (largo = 3+ dígitos vs corto = 1-2). Usa solo nombres que parecen
# preguntas (no metadata/custom). Devuelve list(prefix, pad).
.sm_detect_naming_style <- function(survey_or_names) {
  names_vec <- if (is.data.frame(survey_or_names)) survey_or_names$name else as.character(survey_or_names)
  names_vec <- names_vec[!is.na(names_vec) & nzchar(names_vec)]
  m <- regmatches(names_vec, regexec(perl = TRUE, "^([qp])([0-9]+)(?:_.*)?$", names_vec))
  parsed <- do.call(rbind, lapply(m, function(x) if (length(x) == 3L) x[2:3] else c(NA, NA)))
  parsed <- parsed[!is.na(parsed[, 1]), , drop = FALSE]
  if (!nrow(parsed)) return(list(prefix = "p", pad = 0L))
  prefix <- names(sort(table(parsed[, 1]), decreasing = TRUE))[1]
  num_lengths <- nchar(parsed[parsed[, 1] == prefix, 2])
  pad <- as.integer(names(sort(table(num_lengths), decreasing = TRUE))[1])
  list(prefix = prefix, pad = pad)
}

# Genera variantes de nombres para tolerar distintas convenciones de
# SurveyMonkey al exportar SPSS: Q↔P y padding con ceros (Q7 ↔ q0007).
# Si se pasa un `style` detectado del dataset, prioriza esa convención
# (resuelve la ambigüedad cuando p0008 y q0008 coexisten).
.sm_qp_variants <- function(name, style = NULL) {
  m <- regmatches(name, regexec(perl = TRUE, "^([QPqp])([0-9]+)(_.*)?$", name))[[1]]
  if (length(m) < 3L) return(tolower(name))
  num <- as.integer(m[3])
  rest <- if (length(m) >= 4L) m[4] else ""

  if (!is.null(style)) {
    # Construye orden priorizando la convención del dataset.
    primary <- paste0(style$prefix, formatC(num, width = style$pad, flag = "0", format = "d"), rest)
    other_prefixes <- c(tolower(m[2]), if (style$prefix == "q") "p" else "q")
    other_prefixes <- unique(setdiff(other_prefixes, style$prefix))
    other_pads <- setdiff(c(4L, 3L, 5L, 2L, 6L, 0L), style$pad)
    fallbacks <- character(0)
    for (p in c(style$prefix, other_prefixes)) {
      for (pad in other_pads) {
        fallbacks <- c(fallbacks, paste0(p, formatC(num, width = pad, flag = "0", format = "d"), rest))
      }
    }
    return(unique(tolower(c(primary, fallbacks))))
  }

  # Sin style: heurística genérica (padding largo primero, convención del usuario primero).
  user_prefix <- toupper(m[2])
  alt_prefix <- if (user_prefix == "Q") "P" else "Q"
  pads <- c(4L, 3L, 5L, 2L, 6L, 0L)
  variants <- character(0)
  for (p in c(user_prefix, alt_prefix)) {
    for (pad in pads) {
      variants <- c(variants, paste0(p, formatC(num, width = pad, flag = "0", format = "d"), rest))
    }
  }
  unique(tolower(variants))
}

# Resuelve "P8" → todos los `name` del survey que pertenecen a esa pregunta
# (incluyendo battery/multi children). Tolera Q↔P y padding con ceros.
# Wrapper que también resuelve targets tipo "PAG:17" (página específica) y
# "END" (todas las páginas estrictamente posteriores a la página donde vive
# la variable condicional).
.sm_resolve_target_one <- function(target, survey, vars_tbl, style = NULL, paginas = NULL, when_var = NULL) {
  if (target == "END") {
    if (is.null(paginas) || !length(paginas) || is.null(when_var)) {
      warning("Acción 'Fin de encuesta' ignorada: requiere mapeo `paginas` y variable condicional.", call. = FALSE)
      return(character(0))
    }
    cur_pag <- .sm_find_page_of(when_var, paginas)
    if (is.null(cur_pag)) {
      warning(sprintf("No pude ubicar '%s' en el mapeo `paginas`; 'Fin' ignorado.", when_var), call. = FALSE)
      return(character(0))
    }
    later_pags <- as.character(sort(as.integer(names(paginas))))
    later_pags <- later_pags[as.integer(later_pags) > as.integer(cur_pag)]
    qs <- unlist(lapply(later_pags, function(p) paginas[[p]]))
    if (!length(qs)) return(character(0))
    return(unique(unlist(lapply(qs, function(q) .sm_resolve_target_to_survey_names(q, survey, vars_tbl, style)))))
  }
  if (startsWith(target, "PAG:")) {
    pag <- sub("^PAG:", "", target)
    qs <- paginas[[pag]]
    if (is.null(qs)) qs <- paginas[[as.integer(pag)]]
    if (is.null(qs) || !length(qs)) {
      warning(sprintf("Página %s no está en el mapeo `paginas`, regla ignorada.", pag), call. = FALSE)
      return(character(0))
    }
    out <- unique(unlist(lapply(qs, function(q) .sm_resolve_target_to_survey_names(q, survey, vars_tbl, style))))
    return(out)
  }
  .sm_resolve_target_to_survey_names(target, survey, vars_tbl, style)
}

# Busca la página donde vive una variable condicional (Q4 → "16" si "16"
# en el mapeo contiene "Q4"). Tolera variantes Q↔P y padding.
.sm_find_page_of <- function(when_var, paginas) {
  variants <- toupper(.sm_qp_variants(when_var))
  for (p in names(paginas)) {
    qs_in_page <- toupper(paginas[[p]])
    if (any(qs_in_page %in% variants) || any(variants %in% qs_in_page)) return(p)
    # Match laxo: P4 vs Q4 (sin padding)
    for (q in qs_in_page) {
      if (any(toupper(.sm_qp_variants(q)) %in% variants)) return(p)
    }
  }
  NULL
}

.sm_resolve_target_to_survey_names <- function(target, survey, vars_tbl, style = NULL) {
  variants_low <- .sm_qp_variants(target, style)
  for (tlow in variants_low) {
    exact <- survey$name[!is.na(survey$name) & survey$name == tlow]
    if (length(exact)) return(exact)
  }
  for (tlow in variants_low) {
    pattern <- paste0("^", tlow, "_")
    matches <- survey$name[!is.na(survey$name) & grepl(pattern, survey$name)]
    if (length(matches)) return(unique(matches))
  }
  character(0)
}

# Resuelve la variable condicional. Devuelve list(var_ref, is_multi, codes)
# o NULL si la variable no existe.
.sm_resolve_when <- function(when_var, raw_codes, vars_tbl, label_sets, survey, style = NULL, choices = NULL,
                              choice_order_overrides = NULL) {
  # SurveyMonkey numera Q1, Q2... pero el .sav puede exportar P1 / q0007 /
  # P0007 según cómo se descargue. Generamos todas las variantes razonables.
  variants_low <- .sm_qp_variants(when_var, style)
  variants <- unique(c(when_var, toupper(variants_low), variants_low))

  raw_name <- NULL
  type_str <- NULL
  ref_name_low <- NULL

  for (v_low in variants_low) {
    idx <- which(!is.na(survey$name) & survey$name == v_low)
    if (length(idx)) {
      type_str <- survey$type[idx[1]]
      ref_name_low <- v_low
      vrow <- vars_tbl[!is.na(vars_tbl$name_clean) & vars_tbl$name_clean == v_low, , drop = FALSE]
      if (nrow(vrow)) raw_name <- vrow$name_raw[1]
      break
    }
  }
  if (is.null(raw_name)) {
    for (v in variants) {
      vrow <- vars_tbl[toupper(vars_tbl$name_raw) == toupper(v), , drop = FALSE]
      if (!nrow(vrow)) {
        vrow <- vars_tbl[grepl(paste0("^", v, "_"), vars_tbl$name_raw, ignore.case = TRUE), , drop = FALSE]
      }
      if (nrow(vrow)) {
        raw_name <- vrow$name_raw[1]
        if (is.null(ref_name_low)) ref_name_low <- tolower(v)
        break
      }
    }
    if (is.null(raw_name)) return(NULL)
  }
  if (is.null(type_str)) {
    idx <- which(!is.na(survey$name) & survey$name == ref_name_low)
    if (length(idx)) type_str <- survey$type[idx[1]]
  }
  is_multi <- !is.null(type_str) && grepl("^select_multiple", type_str)

  # Para resolver C{N} a su código real: si la pregunta es multi-select y
  # tenemos `choices`, los `name` ahí son la fuente de verdad (incluyen
  # padding de SurveyMonkey tipo "0001"). Para select_one usamos los value
  # labels del .sav, que son los códigos numéricos directos.
  list_name <- NULL
  if (!is.null(type_str)) {
    m <- regmatches(type_str, regexec(perl = TRUE, "^select_(?:one|multiple)\\s+(\\S+)", type_str))[[1]]
    if (length(m) == 2L) list_name <- m[2]
  }
  choice_names <- character(0)
  cdf_for_override <- NULL
  if (!is.null(choices) && !is.null(list_name)) {
    cdf <- as.data.frame(choices, stringsAsFactors = FALSE)
    if ("list_name" %in% names(cdf) && "name" %in% names(cdf)) {
      choice_names <- cdf$name[!is.na(cdf$list_name) & cdf$list_name == list_name]
      cdf_for_override <- cdf[!is.na(cdf$list_name) & cdf$list_name == list_name, , drop = FALSE]
    }
  }

  # Override del orden por el usuario: si para esta pregunta hay una lista
  # de labels reordenada, mapeamos cada label a su `name` real en el
  # XLSForm (`cdf_for_override`) para que `C{N}` resuelva al code que el
  # usuario espera. Sin override, `choice_names` queda en orden de la API.
  if (!is.null(choice_order_overrides) && !is.null(cdf_for_override) && nrow(cdf_for_override) > 0L) {
    when_var_idx <- suppressWarnings(as.integer(sub("^[QPqp]", "", when_var)))
    if (!is.na(when_var_idx)) {
      override_labels <- choice_order_overrides[[as.character(when_var_idx)]]
      if (!is.null(override_labels) && length(override_labels) > 0L) {
        override_labels <- as.character(unlist(override_labels))
        lbl_col <- intersect(c("label::es", "label", "label::en"), names(cdf_for_override))[1]
        if (!is.na(lbl_col)) {
          norm <- function(s) tolower(trimws(.sm_or(s, "")))
          override_codes <- character(0)
          for (lbl in override_labels) {
            hit <- which(norm(cdf_for_override[[lbl_col]]) == norm(lbl))
            if (length(hit)) override_codes <- c(override_codes, as.character(cdf_for_override$name[hit[1]]))
          }
          if (length(override_codes)) choice_names <- override_codes
        }
      }
    }
  }

  labs <- label_sets[[raw_name]]
  if (is.null(labs) || !length(labs)) labs <- numeric(0)

  # Translitera con la utilidad ya existente del paquete (Latin-ASCII +
  # lowercase) para hacer matching robusto a tildes.
  norm_tok <- function(s) .sm_ascii_lower(.sm_norm_ws(s))

  codes <- vapply(raw_codes, function(token) {
    # 1) C{N} — referencia por índice
    m <- regmatches(token, regexec("^C(\\d+)$", token, ignore.case = TRUE))[[1]]
    if (length(m) == 2L) {
      idx <- as.integer(m[2])
      if (length(choice_names) >= idx) return(choice_names[idx])
      if (length(labs) >= idx) {
        ord <- order(as.numeric(unname(labs)))
        return(as.character(unname(labs)[ord[idx]]))
      }
      return(as.character(idx))
    }
    # 2) Literal con etiqueta — resolver a code real por matching de label
    if (length(labs)) {
      labs_norm <- norm_tok(names(labs))
      hit <- which(labs_norm == norm_tok(token))
      if (length(hit)) return(as.character(unname(labs)[hit[1]]))
    }
    if (length(choice_names) && !is.null(choices)) {
      cdf <- as.data.frame(choices, stringsAsFactors = FALSE)
      lbl_col <- intersect(c("label::es", "label", "label::en"), names(cdf))[1]
      if (!is.na(lbl_col)) {
        sub <- cdf[!is.na(cdf$list_name) & cdf$list_name == list_name, , drop = FALSE]
        labs_norm <- norm_tok(sub[[lbl_col]])
        hit <- which(labs_norm == norm_tok(token))
        if (length(hit)) return(as.character(sub$name[hit[1]]))
      }
    }
    # 3) Sin match — fallback al token mismo
    tolower(token)
  }, character(1))

  list(var_ref = ref_name_low, is_multi = is_multi, codes = unname(codes))
}

#' Valida empíricamente las reglas de skip logic ya aplicadas.
#'
#' Para cada pregunta del survey con `relevant` aplicado, evalúa la expresión
#' XLSForm sobre los datos reales del `.sav` y la compara contra el patrón
#' de NA observado en la pregunta target. Una regla bien transcrita debería
#' tener coverage cercano a 1: el target tiene valor exactamente cuando la
#' expresión es TRUE.
#'
#' Sirve como complemento de [surveymonkey_aplicar_logica()] cuando las
#' reglas se ingresaron manualmente desde el constructor de SurveyMonkey:
#' confirma que la transcripción es correcta y que SurveyMonkey aplicó la
#' lógica como esperabas. Discrepancias pueden indicar (a) una regla mal
#' copiada, (b) una pregunta con NA por no-respuesta voluntaria (no por
#' skip logic), o (c) que SM no aplicó la lógica como suponías.
#'
#' @param xlsform Objeto retornado por [surveymonkey_aplicar_logica()].
#' @param sm Objeto retornado por [surveymonkey_leer()].
#' @param threshold Umbral mínimo de coverage para marcar una regla como `ok`
#'   (default `0.95`). Para datasets pequeños (n<30) considera subir a 1.0.
#' @return Tibble con `target`, `status` (ok / discrepancia / sin_datos / error),
#'   `coverage`, `n_consistente`, `n_total`, `relevant`.
#' @export
surveymonkey_validar_logica <- function(xlsform, sm, threshold = 0.95) {
  data <- surveymonkey_data(sm, keep_metadata = TRUE)
  survey <- as.data.frame(xlsform$survey, stringsAsFactors = FALSE)
  has_relevant <- !is.na(survey$relevant) & nzchar(survey$relevant)
  if (!any(has_relevant)) {
    return(.sm_empty_validacion())
  }

  rows <- survey[has_relevant, c("name", "relevant"), drop = FALSE]
  out <- vector("list", nrow(rows))
  for (i in seq_len(nrow(rows))) {
    target <- rows$name[i]
    expr <- rows$relevant[i]
    out[[i]] <- .sm_validate_one_relevant(target, expr, data, threshold)
  }
  do.call(rbind, lapply(out, function(r) {
    tibble::tibble(
      target = r$target,
      status = r$status,
      coverage_oculta = r$coverage_oculta,
      n_oculta_correcta = r$n_oculta_correcta,
      n_oculta_predicha = r$n_oculta_predicha,
      tasa_respuesta = r$tasa_respuesta,
      inconsistencias = list(r$inconsistencias %||% integer(0)),
      relevant = r$relevant
    )
  }))
}

`%||%` <- function(a, b) if (is.null(a)) b else a

.sm_empty_validacion <- function() {
  tibble::tibble(
    target = character(0),
    status = character(0),
    coverage_oculta = numeric(0),
    n_oculta_correcta = integer(0),
    n_oculta_predicha = integer(0),
    tasa_respuesta = numeric(0),
    inconsistencias = list(),
    relevant = character(0)
  )
}

.sm_validate_one_relevant <- function(target, expr, data, threshold) {
  base <- list(target = target, relevant = expr,
               coverage_oculta = NA_real_, n_oculta_correcta = NA_integer_,
               n_oculta_predicha = NA_integer_, tasa_respuesta = NA_real_,
               inconsistencias = integer(0))
  if (!target %in% names(data)) {
    return(c(base, list(status = "sin_datos")))
  }
  predicted_show <- tryCatch(
    .sm_eval_relevant_expr(expr, data),
    error = function(e) NULL
  )
  if (is.null(predicted_show) || !length(predicted_show)) {
    return(c(base, list(status = "error")))
  }
  predicted_show <- as.logical(predicted_show)
  target_value <- data[[target]]
  has_value <- !is.na(target_value) & nzchar(as.character(target_value))

  # Métrica principal (asimétrica): de las filas donde la regla dice OCULTAR
  # (predicted_show=FALSE), ¿cuántas tienen target NA? Estas filas son las
  # que validan rigurosamente la regla — si la regla está bien transcrita,
  # SurveyMonkey efectivamente ocultó la pregunta y el respondiente no pudo
  # contestarla.
  comparable <- !is.na(predicted_show)
  predicted_hide <- comparable & !predicted_show
  n_oculta_predicha <- sum(predicted_hide)
  n_oculta_correcta <- sum(predicted_hide & !has_value)
  coverage_oculta <- if (n_oculta_predicha > 0L) n_oculta_correcta / n_oculta_predicha else NA_real_

  # Métrica secundaria (informativa): de las filas donde la regla dice MOSTRAR,
  # ¿cuántas el respondiente efectivamente contestó? Tasa baja indica
  # no-respuesta voluntaria, no es señal de regla mal transcrita.
  predicted_show_idx <- comparable & predicted_show
  n_show_predicha <- sum(predicted_show_idx)
  tasa_respuesta <- if (n_show_predicha > 0L) sum(predicted_show_idx & has_value) / n_show_predicha else NA_real_

  # Inconsistencias críticas: filas donde la regla dice ocultar pero el target
  # SÍ tiene valor → o la regla está mal o el respondiente saltó la lógica.
  comp_idx <- which(comparable)
  inconsistencias <- comp_idx[!predicted_show[comp_idx] & has_value[comp_idx]]

  status <- if (is.na(coverage_oculta)) "sin_oculta" else
            if (coverage_oculta >= threshold) "ok" else "discrepancia"
  list(
    target = target, status = status,
    coverage_oculta = coverage_oculta,
    n_oculta_correcta = as.integer(n_oculta_correcta),
    n_oculta_predicha = as.integer(n_oculta_predicha),
    tasa_respuesta = tasa_respuesta,
    inconsistencias = as.integer(inconsistencias),
    relevant = expr
  )
}

# Convierte una expresión XLSForm a una expresión R y la evalúa sobre `data`.
# Soporta: ${var}, =, !=, or, and, not(...), selected(${var}, 'code').
.sm_eval_relevant_expr <- function(expr, data) {
  e <- expr
  # selected(${q0007}, '4') → .sm_selected(data[["q0007"]], '4')
  e <- gsub(
    "selected\\(\\s*\\$\\{([A-Za-z_][A-Za-z0-9_/]*)\\}\\s*,\\s*'([^']*)'\\s*\\)",
    ".sm_selected(data[['\\1']], '\\2')",
    e, perl = TRUE
  )
  # ${var} → as.character(data[["var"]])  — coerce a character para comparar
  # contra los códigos literales sin chocar con clase haven_labelled.
  e <- gsub("\\$\\{([A-Za-z_][A-Za-z0-9_/]*)\\}", "as.character(data[['\\1']])", e, perl = TRUE)
  # = (igualdad XLSForm) → == R, evitando != y ==.
  e <- gsub("(?<![!=])=(?!=)", "==", e, perl = TRUE)
  # not( → !(
  e <- gsub("\\bnot\\(", "!(", e, perl = TRUE)
  # `or`/`and` ya son operadores R `||`/`&&` para escalares; usamos vectorizados:
  e <- gsub("\\bor\\b", "|", e, perl = TRUE)
  e <- gsub("\\band\\b", "&", e, perl = TRUE)

  # Comparaciones generan NA cuando hay NA en el operando — los tratamos como
  # FALSE para no propagar NAs en la lógica combinada.
  expr_r <- sprintf("{ res <- (%s); ifelse(is.na(res), FALSE, res) }", e)
  eval(parse(text = expr_r), envir = list(data = data, .sm_selected = .sm_selected))
}

# Helper: emula la función selected() de XLSForm sobre la columna madre de
# un select_multiple, donde los códigos seleccionados aparecen como tokens
# separados por espacios (formato producido por surveymonkey_data()).
.sm_selected <- function(x, code) {
  x <- as.character(x)
  pat <- paste0("(^|\\s)", gsub("([\\^$.|?*+()\\[\\]{}\\\\])", "\\\\\\1", code, perl = TRUE), "(\\s|$)")
  out <- grepl(pat, x, perl = TRUE)
  out[is.na(x)] <- FALSE
  out
}

# Helper: convierte un map position→choice a array ordenado por position.
# Útil para vistas que iteran `choices[]` linealmente (mantiene compat).
.sort_choices_by_position <- function(choices_by_pos) {
  if (!length(choices_by_pos)) return(list())
  positions <- suppressWarnings(as.integer(names(choices_by_pos)))
  ord <- order(positions)
  unname(choices_by_pos[ord])
}

#' Interpreta una regla textual y devuelve una estructura amigable para UI:
#' resolución de variables/códigos a sus etiquetas reales, texto humano y
#' descriptor de diagrama. Pensada para el wizard "pega-regla → confirma" que
#' permite al usuario revisar cada regla antes de aplicarla.
#'
#' @param regla_text Texto de UNA regla (ej. "Q4 = C6 => Ocultar Pág. 16, 17.").
#' @param details Response de /surveys/{id}/details (fuente principal de
#'   prompts y choices reales).
#' @param paginas Lista nombrada page_id → vector de Q's (mapeo de páginas).
#' @param paginas_labels Lista nombrada page_id → label humano (opcional).
#' @return Lista con `ok`, `regla_parseada`, `resolucion`, `texto_humano`,
#'   `diagrama`, `warnings`.
#' @export
surveymonkey_interpretar_regla <- function(regla_text,
                                            details = NULL,
                                            paginas = NULL,
                                            paginas_labels = NULL,
                                            choice_order_overrides = NULL) {
  if (!nzchar(trimws(regla_text))) {
    return(list(ok = FALSE, error = "Regla vacía."))
  }
  parsed <- surveymonkey_parsear_logica(regla_text)
  if (!nrow(parsed)) {
    return(list(ok = FALSE, error = "No pude parsear la regla. Revisa la sintaxis (ej. 'Q4 = C6 => Ocultar Pág. 16.')."))
  }

  # Una regla puede expandirse a múltiples filas (una por target). Reagrupamos
  # por (when_var, when_op, when_codes) para renderizar como UNA regla con
  # múltiples acciones.
  first <- parsed[1, ]
  same_cond <- vapply(seq_len(nrow(parsed)), function(i) {
    identical(parsed$when_var[i], first$when_var) &&
      identical(parsed$when_op[i], first$when_op) &&
      identical(parsed$when_codes[[i]], first$when_codes[[1]])
  }, logical(1))
  parsed <- parsed[same_cond, , drop = FALSE]

  warnings <- character(0)

  # Build qref → info from details
  qref_info <- list()
  if (!is.null(details)) {
    pages <- .sm_or(details$pages, list())
    g_pos <- 0L
    for (p_idx in seq_along(pages)) {
      page <- pages[[p_idx]]
      page_num <- as.integer(.sm_or(page$position, p_idx))
      questions <- .sm_or(page$questions, list())
      for (q in questions) {
        fam <- .sm_or(q$family, "")
        if (identical(fam, "presentation")) next
        g_pos <- g_pos + 1L
        # Construimos un map `position → choice` para que el resolver de
        # C{N} use la posición VISIBLE en el constructor SM (1-indexed).
        # `.sm_api_position_offset` detecta si la API expuso positions
        # 0-indexed y normaliza al espacio Cn del constructor.
        regular_choices <- .sm_or(q$answers$choices, list())
        other <- q$answers$other
        none_top <- q$answers$none
        position_offset <- .sm_api_position_offset(q)

        choices_by_pos <- list()
        pending_none_labels <- character(0)  # "Ninguna" embebidos dentro de choices
        for (i in seq_along(regular_choices)) {
          ch <- regular_choices[[i]]
          ch_text <- .sm_or(ch$text, NA_character_)
          # SM embebe "Ninguna de las opciones anteriores" dentro de `choices`
          # con flag `is_none_of_the_above=TRUE` y `position=0`. Lo apartamos
          # para colocarlo al final (después de "Otros:") y mantener la
          # numeración Cn alineada con el constructor SM.
          if (.sm_api_is_none_choice(ch, regular_choices)) {
            if (!is.na(ch_text) && nzchar(ch_text)) {
              pending_none_labels <- c(pending_none_labels, ch_text)
            }
            next
          }
          raw_pos <- suppressWarnings(as.integer(.sm_or(ch$position, i - position_offset)))
          if (is.na(raw_pos)) raw_pos <- i - position_offset
          ui_pos <- raw_pos + position_offset
          choices_by_pos[[as.character(ui_pos)]] <- ch
        }
        # "Otros:" — siempre al final (la API suele exponer position=0 como
        # sentinela; usar esa posición rompe el orden visible del constructor).
        if (!is.null(other) && length(other) > 0L) {
          is_visible <- isTRUE(.sm_or(other$is_answer_choice, .sm_or(other$visible, TRUE)))
          if (is_visible) {
            existing_pos <- suppressWarnings(as.integer(names(choices_by_pos)))
            existing_pos <- existing_pos[!is.na(existing_pos)]
            ui_pos <- if (length(existing_pos)) max(existing_pos) + 1L else 1L
            choices_by_pos[[as.character(ui_pos)]] <- list(
              text = .sm_or(other$text, "Otros:"),
              position = ui_pos,
              is_other = TRUE
            )
          }
        }
        # "Ninguna de las opciones anteriores" — primero los embebidos en
        # `choices` (caso habitual), después `answers$none` si SM lo expone
        # como campo separado. Siempre van después de "Otros:".
        none_labels <- pending_none_labels
        if (!is.null(none_top) && length(none_top) > 0L) {
          is_visible <- isTRUE(.sm_or(none_top$is_answer_choice, .sm_or(none_top$visible, TRUE)))
          if (is_visible) {
            lbl <- .sm_or(none_top$text, NA_character_)
            if (!is.na(lbl) && nzchar(lbl)) none_labels <- c(none_labels, lbl)
          }
        }
        for (lbl in none_labels) {
          existing_pos <- suppressWarnings(as.integer(names(choices_by_pos)))
          existing_pos <- existing_pos[!is.na(existing_pos)]
          ui_pos <- if (length(existing_pos)) max(existing_pos) + 1L else 1L
          choices_by_pos[[as.character(ui_pos)]] <- list(
            text = lbl,
            position = ui_pos,
            is_none = TRUE
          )
        }

        # Override del orden por el usuario: si el frontend mandó una lista de
        # labels para esta pregunta, reemplazamos `choices_by_pos` respetando
        # ese orden. La heurística posicional de la API no siempre refleja el
        # orden visual del constructor (ej. "Otros"/"Ninguna" con position=0
        # como sentinela), así que el override es la fuente de verdad cuando
        # existe. Preservamos los flags is_other/is_none de la API matcheando
        # por label (case-insensitive trim).
        override_key <- as.character(g_pos)
        override_labels <- if (!is.null(choice_order_overrides))
          choice_order_overrides[[override_key]] else NULL
        if (!is.null(override_labels) && length(override_labels) > 0L) {
          override_labels <- as.character(unlist(override_labels))
          # Map label normalizado → choice info original (para preservar flags).
          norm <- function(x) tolower(trimws(.sm_or(x, "")))
          label_to_info <- list()
          for (k in names(choices_by_pos)) {
            ch <- choices_by_pos[[k]]
            label_to_info[[norm(.sm_or(ch$text, ""))]] <- ch
          }
          new_by_pos <- list()
          for (i in seq_along(override_labels)) {
            lbl <- override_labels[i]
            info <- label_to_info[[norm(lbl)]]
            if (is.null(info)) {
              info <- list(text = lbl)
            } else {
              info$text <- lbl
            }
            info$position <- i
            new_by_pos[[as.character(i)]] <- info
          }
          choices_by_pos <- new_by_pos
        }

        qref_info[[as.character(g_pos)]] <- list(
          family = fam,
          subtype = .sm_or(q$subtype, NA_character_),
          heading = .sm_or(q$headings[[1]]$heading, NA_character_),
          choices_by_pos = choices_by_pos,
          # Mantener `choices` como array secuencial para retrocompat (otras
          # rutas lo siguen usando), pero ordenado por position.
          choices = .sort_choices_by_position(choices_by_pos),
          page_id = page_num
        )
      }
    }
  }

  # Resolver when_var (Q4 → posición global → prompt + choices)
  when_var_str <- as.character(first$when_var[1])
  when_var_idx <- as.integer(sub("^[QPqp]", "", when_var_str))
  when_info <- qref_info[[as.character(when_var_idx)]]
  when_var_label <- if (!is.null(when_info)) .sm_or(when_info$heading, when_var_str) else when_var_str
  when_var_xlsform <- tolower(when_var_str)

  # Resolver when_codes (C6 → "No he encontrado trabajo"). Indexamos por
  # POSITION del choice en SurveyMonkey, no por orden secuencial — así
  # respetamos casos donde "Other" tiene una position intermedia y los
  # demás choices quedan numerados como en la UI del constructor.
  raw_codes <- first$when_codes[[1]]
  when_codes_resueltos <- list()
  choices_map <- if (!is.null(when_info)) when_info$choices_by_pos else NULL

  # Construir una lista plana de "choices_disponibles" para que el frontend
  # las renderice como referencia y el usuario vea exactamente qué expuso la
  # API (útil para diagnosticar discrepancias con el constructor SM).
  choices_disponibles <- list()
  if (!is.null(choices_map) && length(choices_map)) {
    positions_int <- suppressWarnings(as.integer(names(choices_map)))
    ord <- order(positions_int)
    for (i in ord) {
      pos <- positions_int[i]
      ch <- choices_map[[i]]
      choices_disponibles[[length(choices_disponibles) + 1L]] <- list(
        code = sprintf("C%d", pos),
        position = as.integer(pos),
        label = .sm_or(ch$text, sprintf("C%d", pos)),
        is_other = isTRUE(.sm_or(ch$is_other, FALSE)),
        is_none = isTRUE(.sm_or(ch$is_none, FALSE))
      )
    }
  }

  for (token in raw_codes) {
    m <- regmatches(token, regexec("^C(\\d+)$", token, ignore.case = TRUE))[[1]]
    if (length(m) == 2L && !is.null(choices_map) && length(choices_map)) {
      idx <- as.integer(m[2])
      ch <- choices_map[[as.character(idx)]]
      if (!is.null(ch)) {
        when_codes_resueltos[[length(when_codes_resueltos) + 1L]] <- list(
          code = as.character(idx),
          label = .sm_or(ch$text, token)
        )
        next
      } else if (!is.na(idx)) {
        positions_avail <- sort(suppressWarnings(as.integer(names(choices_map))))
        positions_avail <- positions_avail[!is.na(positions_avail)]
        warnings <- c(warnings, sprintf(
          "Código %s no encontrado en la API. La pregunta «%s» expone choices en posiciones: %s. Revisa más abajo «Opciones disponibles».",
          token, when_var_label,
          paste(sprintf("C%d", positions_avail), collapse = ", ")
        ))
      }
    }
    # Literal o sin info de API o no encontrado
    when_codes_resueltos[[length(when_codes_resueltos) + 1L]] <- list(
      code = token,
      label = token
    )
  }

  # Resolver targets
  targets_resueltos <- list()
  actions_summary <- list()
  for (i in seq_len(nrow(parsed))) {
    tgt <- as.character(parsed$target[i])
    if (startsWith(tgt, "PAG:")) {
      page_id <- sub("^PAG:", "", tgt)
      qs <- if (!is.null(paginas)) paginas[[page_id]] else NULL
      page_label <- if (!is.null(paginas_labels)) paginas_labels[[page_id]] else NULL
      if (is.null(page_label)) page_label <- sprintf("Pág. %s", page_id)
      if (is.null(qs) || !length(qs)) {
        warnings <- c(warnings, sprintf("Página %s sin preguntas en el mapeo.", page_id))
      }
      targets_resueltos[[length(targets_resueltos) + 1L]] <- list(
        kind = "hide_page",
        page_id = page_id,
        page_label = page_label,
        preguntas = if (is.null(qs)) character(0) else as.character(qs)
      )
      actions_summary[[length(actions_summary) + 1L]] <- list(
        type = "hide_page", id = page_id, label = page_label,
        n_preguntas = length(qs %||% character(0))
      )
    } else if (tgt == "END") {
      targets_resueltos[[length(targets_resueltos) + 1L]] <- list(
        kind = "end_survey"
      )
      actions_summary[[length(actions_summary) + 1L]] <- list(
        type = "end_survey", label = "Fin de la encuesta (oculta secciones siguientes)"
      )
    } else {
      # Pregunta individual (P8, Q8, etc.)
      tgt_idx <- as.integer(sub("^[QPqp]", "", tgt))
      tgt_info <- if (!is.na(tgt_idx)) qref_info[[as.character(tgt_idx)]] else NULL
      tgt_label <- if (!is.null(tgt_info)) .sm_or(tgt_info$heading, tgt) else tgt
      targets_resueltos[[length(targets_resueltos) + 1L]] <- list(
        kind = "hide_question",
        target = tolower(tgt),
        label = tgt_label
      )
      actions_summary[[length(actions_summary) + 1L]] <- list(
        type = "hide_question", id = tolower(tgt), label = tgt_label
      )
    }
  }

  # Texto humano
  op_text <- switch(
    first$when_op,
    "eq" = "es igual a", "ne" = "no es",
    "in" = "está en", "not_in" = "no está en",
    first$when_op
  )
  values_text <- if (length(when_codes_resueltos) == 1L) {
    sprintf("«%s»", when_codes_resueltos[[1]]$label)
  } else {
    sprintf("[%s]", paste0("«", vapply(when_codes_resueltos, `[[`, character(1), "label"), "»", collapse = ", "))
  }
  acts_text <- vapply(actions_summary, function(a) {
    if (a$type == "hide_question") sprintf("ocultar %s", a$label)
    else if (a$type == "hide_page") sprintf("ocultar %s (%d preguntas)", a$label, a$n_preguntas)
    else if (a$type == "end_survey") "fin de la encuesta (oculta todo lo siguiente)"
    else "(acción desconocida)"
  }, character(1))
  texto_humano <- sprintf(
    "Si «%s» %s %s, entonces se procede a %s.",
    when_var_label, op_text, values_text,
    paste(acts_text, collapse = "; ")
  )

  # Descriptor de diagrama (simple, frontend lo renderiza)
  diagrama <- list(
    origen = list(
      id = when_var_xlsform,
      label = sprintf("%s — %s", when_var_str, when_var_label),
      condicion = sprintf("%s %s", op_text, values_text)
    ),
    edges = lapply(targets_resueltos, function(t) {
      if (t$kind == "hide_question") list(target_id = t$target, target_label = t$label, action = "ocultar")
      else if (t$kind == "hide_page") list(target_id = sprintf("section_pag_%s", t$page_id), target_label = t$page_label, action = sprintf("ocultar (%d preguntas)", length(t$preguntas)))
      else if (t$kind == "end_survey") list(target_id = "__end__", target_label = "Fin de la encuesta", action = "ocultar todas las secciones siguientes")
      else NULL
    })
  )

  list(
    ok = TRUE,
    regla_parseada = list(
      when_var = when_var_str,
      when_op = first$when_op,
      when_codes = raw_codes,
      n_actions = length(targets_resueltos)
    ),
    resolucion = list(
      when_var_label = when_var_label,
      when_var_xlsform = when_var_xlsform,
      when_codes_resueltos = when_codes_resueltos,
      targets_resueltos = targets_resueltos,
      # Choices disponibles para la pregunta condicional según la API.
      # Se renderizan en el frontend como referencia visual cuando hay
      # códigos no resueltos o el usuario quiere comparar contra el SM.
      choices_disponibles = choices_disponibles
    ),
    texto_humano = texto_humano,
    diagrama = diagrama,
    warnings = warnings
  )
}

#' Construye lista de hallazgos amigable para UI a partir del validador.
#'
#' Transforma el output de `surveymonkey_validar_logica()` en una lista plana
#' de hallazgos que el frontend puede renderizar como sidebar/panel. Cada
#' hallazgo tiene: target, severity, mensaje, métricas. NO se incluye en el
#' .xlsx exportado — es feedback puro al usuario.
#'
#' @param validacion Tibble retornado por [surveymonkey_validar_logica()].
#' @return Lista de listas (cada una un hallazgo).
#' @export
surveymonkey_hallazgos <- function(validacion) {
  if (!nrow(validacion)) return(list())
  hallazgos <- list()
  for (i in seq_len(nrow(validacion))) {
    r <- validacion[i, ]
    target <- r$target
    status <- r$status
    coverage <- r$coverage_oculta
    tasa <- r$tasa_respuesta
    inc <- r$inconsistencias[[1]]

    if (status == "discrepancia") {
      hallazgos[[length(hallazgos) + 1L]] <- list(
        target = target,
        severity = "warn",
        kind = "regla_violada",
        mensaje = sprintf(
          "%d respondiente(s) saltaron la regla — la regla predice ocultar pero contestaron.",
          length(inc)
        ),
        coverage_oculta = coverage,
        tasa_respuesta = tasa,
        inconsistencias = as.integer(inc)
      )
    } else if (!is.na(tasa) && tasa < 0.5 && status == "ok") {
      # Regla validada pero baja completitud — sugiere lógica anidada
      hallazgos[[length(hallazgos) + 1L]] <- list(
        target = target,
        severity = "info",
        kind = "baja_completitud",
        mensaje = sprintf(
          "Tasa de respuesta = %.0f%%. La regla aplicada es correcta pero hay muchos respondientes que no contestaron — puede haber lógica anidada no transcrita.",
          tasa * 100
        ),
        coverage_oculta = coverage,
        tasa_respuesta = tasa,
        inconsistencias = integer(0)
      )
    }
  }
  hallazgos
}

# Construye expresión XLSForm para la columna relevant.
.sm_build_relevant_expr <- function(var_ref, is_multi, op, codes) {
  ref <- sprintf("${%s}", var_ref)
  q <- function(x) paste0("'", gsub("'", "\\\\'", x), "'")
  if (is_multi) {
    parts <- vapply(codes, function(c) sprintf("selected(%s, %s)", ref, q(c)), character(1))
    switch(op,
      "eq" = parts[1],
      "ne" = sprintf("not(%s)", parts[1]),
      "in" = paste(parts, collapse = " or "),
      "not_in" = sprintf("not(%s)", paste(parts, collapse = " or "))
    )
  } else {
    parts <- vapply(codes, function(c) sprintf("%s = %s", ref, q(c)), character(1))
    switch(op,
      "eq" = parts[1],
      "ne" = sprintf("%s != %s", ref, q(codes[1])),
      "in" = paste(parts, collapse = " or "),
      "not_in" = paste(vapply(codes, function(c) sprintf("%s != %s", ref, q(c)), character(1)), collapse = " and ")
    )
  }
}

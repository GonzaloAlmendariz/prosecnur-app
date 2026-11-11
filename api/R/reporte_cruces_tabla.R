# Cálculo de una tabla de cruces del archivo, sin escribirla (M13)
# ================================================================
#
# `exportar_cruces_multi()` (reporte_cruces.R) escribe cada tabla categórica con lo que devuelve
# `.cruces_tabla_archivo()`, y la vista previa (`analitica_cruces_preview.R`) devuelve como datos lo mismo. Así
# las cifras de la vista previa son las del archivo por construcción: hay un solo cálculo.
#
# Cifras de una tabla (definición única, la del archivo):
#   - `n` de una celda: suma de `weight_col` de los casos de la fila en esa columna; sin columna de peso, conteo.
#   - denominador de una columna (`N`): suma de pesos de los casos con respuesta válida entre las categorías de la
#     tabla (única) o que marcaron al menos una de ellas (múltiple), dentro de la columna.
#   - `pct`: `n / N`, proporción de 0 a 1 sin redondear; `NA` si `N` es 0.
#   - fila Total del archivo: `round(N, 0)` en las columnas n y 1 en las de porcentaje cuando `N > 0`.
#   - `casos` (solo si se pide): el mismo denominador contado en casos SIN ponderar y con peso mayor que cero.
#
# Alcance: variables categóricas (respuesta única y múltiple) del modo estándar. Las numéricas siguen en
# `write_one_numeric_cross()` y el modo dimensiones en `exportar_dimensiones_multi()`.

#' Contexto del instrumento que usa el archivo de cruces
#'
#' `survey`, `orders_list` completado con las listas de `choices` y el diccionario `name`/`label`, como los arma
#' `reporte_cruces()`.
#' @keywords internal
.cruces_contexto_instrumento <- function(instrumento) {
  survey <- NULL
  if (!is.null(instrumento) && "survey" %in% names(instrumento)) survey <- instrumento$survey
  orders_list <- NULL
  if (!is.null(instrumento) && "orders_list" %in% names(instrumento)) orders_list <- instrumento$orders_list
  choices <- NULL
  if (!is.null(instrumento) && "choices" %in% names(instrumento)) choices <- instrumento$choices
  orders_list <- .augment_orders_list_from_choices(orders_list = orders_list, survey = survey, choices = choices)
  dic_vars <- NULL
  if (!is.null(survey) && all(c("name", "label") %in% names(survey))) {
    dic_vars <- dplyr::select(survey, name, label)
    dic_vars <- dplyr::filter(dic_vars, !is.na(name) & name != "")
  }
  list(survey = survey, orders_list = orders_list, dic_vars = dic_vars)
}

#' Secciones y variables de cruce que entran al archivo
#'
#' Una variable de fila entra si existe como columna o tiene columnas por opción; una variable de cruce, solo si es
#' columna. El orden es el del archivo.
#' @keywords internal
.cruces_plan_archivo <- function(data, SECCIONES, CRUZAR_CON) {
  SECCIONES <- lapply(SECCIONES, function(v) {
    v[vapply(v, function(x) .has_var_or_dummies(data, x), logical(1))]
  })
  list(SECCIONES = SECCIONES, CRUZAR_CON = CRUZAR_CON[CRUZAR_CON %in% names(data)])
}

# Categorías de la fila tal como entran a la tabla, con las que se quedan fuera y por qué. El archivo quita la
# categoría que se llama "Total" o no tiene rótulo, la segunda de dos con el mismo rótulo (sus casos NO se suman a
# la primera) y el código especial sin casos.
.cruces_tabla_categorias <- function(data, var, tp, survey, orders_list, opciones_excluir,
                                     codigos_solo_si_presentes, weight_col) {
  cats_var <- get_categorias(var = var, data = data, survey = survey, orders_list = orders_list,
                             opciones_excluir = opciones_excluir)
  opciones <- cats_var$labels
  codes_row <- cats_var$codes
  omitidas <- list()
  omitir <- function(idx, motivo) {
    for (i in idx) omitidas[[length(omitidas) + 1L]] <<- list(
      codigo = as.character(codes_row[[i]]), etiqueta = as.character(opciones[[i]]), motivo = motivo
    )
  }

  op_chr <- trimws(tolower(as.character(opciones)))
  cd_chr <- trimws(tolower(as.character(codes_row)))
  drop_total <- (op_chr == "total") | (cd_chr == "total") | is.na(op_chr) | (op_chr == "")
  if (any(drop_total)) {
    omitir(which(drop_total), "rotulo_total_o_vacio")
    opciones <- opciones[!drop_total]
    codes_row <- codes_row[!drop_total]
  }

  dup <- duplicated(trimws(tolower(as.character(opciones))))
  if (any(dup)) omitir(which(dup), "rotulo_repetido")
  opciones <- opciones[!dup]
  codes_row <- codes_row[!dup]

  if (!is.null(codigos_solo_si_presentes) && length(codes_row)) {
    n_total_all <- contar_por_opcion(data = data, var = var, codes = codes_row, tp = tp,
                                     mask = rep(TRUE, nrow(data)), weight_col = weight_col)
    to_drop <- codes_row %in% as.character(codigos_solo_si_presentes) & n_total_all == 0
    if (any(to_drop)) {
      omitir(which(to_drop), "especial_sin_casos")
      codes_row <- codes_row[!to_drop]
      opciones <- opciones[!to_drop]
    }
  }
  list(opciones = opciones, codes_row = codes_row, omitidas = omitidas)
}

# Orden de las filas por frecuencia marginal: solo nominales y con orden desc/asc. Las ordinales y el modo
# "original" conservan el orden de get_categorias; las columnas nunca se reordenan.
.cruces_tabla_ordenar <- function(cats, data, var, tp, survey, orden, ordinal_lists, weight_col) {
  codes_row <- cats$codes_row
  if (!(orden %in% c("desc", "asc") && length(codes_row) > 1L)) return(cats)
  ln_row <- tryCatch(get_list_name(var, survey), error = function(e) NA_character_)
  es_ordinal <- !is.na(ln_row) && nzchar(ln_row) && ln_row %in% ordinal_lists
  if (es_ordinal) return(cats)
  marg <- contar_por_opcion(data = data, var = var, codes = codes_row, tp = tp,
                            mask = rep(TRUE, nrow(data)), weight_col = weight_col)
  # order(-x)/order(x) es estable: los empates conservan el orden original de get_categorias.
  ord_idx <- if (identical(orden, "desc")) order(-marg) else order(marg)
  cats$codes_row <- codes_row[ord_idx]
  cats$opciones <- cats$opciones[ord_idx]
  cats
}

# Columnas de una variable de cruce: por categoría, `n` y `pct` de cada fila y el denominador `N`.
.cruces_tabla_estrato <- function(data, var, s, codes_row, tp, survey, orders_list, opciones_excluir,
                                  dic_vars, labels_override, weight_col, n_sin_peso, col_sin_peso,
                                  casos_sin_ponderar) {
  cats_s <- get_categorias(var = s, data = data, survey = survey, orders_list = orders_list,
                           opciones_excluir = opciones_excluir)
  estr_codes <- cats_s$codes
  estr_labels <- cats_s$labels
  if (!length(estr_codes)) return(NULL)
  s_lbl <- label_variable(s, dic_vars, labels_override, data)
  # Si viene como "Region: Callao", queda solo "Callao".
  estr_labels <- .strip_prefijo_subindice(estr_labels, s_lbl)

  v_estr <- as.character(data[[s]])
  # El dato puede traer el código o el rótulo de la categoría de columna: se usa el que aparece.
  usa_codes <- any(v_estr %in% estr_codes)
  usa_labels <- any(v_estr %in% estr_labels)
  por_codigo <- usa_codes || !usa_labels
  keys_vec <- if (por_codigo) estr_codes else estr_labels
  con_peso <- if (isTRUE(casos_sin_ponderar)) get_pesos(data, weight_col) > 0 else NULL

  bloques <- lapply(seq_along(keys_vec), function(j) {
    mask_s <- !is.na(v_estr) & v_estr == keys_vec[j]
    n_vec <- contar_por_opcion(data = data, var = var, codes = codes_row, tp = tp, mask = mask_s,
                               weight_col = weight_col)
    N <- denominador_validos(data = data, var = var, codes = codes_row, tp = tp, mask = mask_s,
                             weight_col = weight_col)
    N_sin_peso <- if (isTRUE(n_sin_peso)) {
      denominador_validos(data = data, var = var, codes = codes_row, tp = tp, mask = mask_s,
                          weight_col = col_sin_peso)
    } else NA_real_
    casos <- if (isTRUE(casos_sin_ponderar)) {
      denominador_validos(data = data, var = var, codes = codes_row, tp = tp, mask = mask_s & con_peso,
                          weight_col = col_sin_peso)
    } else NA_real_
    pct <- if (N > 0) n_vec / N else rep(NA_real_, length(n_vec))
    list(n = as.numeric(n_vec), pct = as.numeric(pct), N = N, N_sin_peso = N_sin_peso, casos = casos)
  })

  list(
    variable = s, codes = estr_codes, labels = estr_labels, s_lbl = s_lbl,
    clave = if (por_codigo) "codigo" else "rotulo",
    n = do.call(cbind, lapply(bloques, `[[`, "n")),
    pct = do.call(cbind, lapply(bloques, `[[`, "pct")),
    N = vapply(bloques, `[[`, numeric(1), "N"),
    n_sin_peso = vapply(bloques, `[[`, numeric(1), "N_sin_peso"),
    casos = vapply(bloques, `[[`, numeric(1), "casos")
  )
}

# Cuerpo de la tabla tal como lo escribe el archivo: Opciones, Total n y %, y n y % por categoría de columna, más la
# fila Total con el denominador redondeado en las n y 1 en los porcentajes.
.cruces_tabla_cuerpo <- function(opciones, n_total, pct_total, N_total, estratos) {
  cuerpo <- tibble::tibble(Opciones = opciones)
  denom_map <- list()
  cuerpo <- dplyr::bind_cols(cuerpo, tibble::tibble(Total__n = as.numeric(n_total), Total__pct = as.numeric(pct_total)))
  denom_map[["Total__n"]] <- N_total
  for (e in estratos) {
    cols <- lapply(seq_along(e$labels), function(j) {
      nm_n <- paste0(e$variable, "__", make.names(e$labels[j]), "__n")
      nm_pct <- paste0(e$variable, "__", make.names(e$labels[j]), "__pct")
      tibble::tibble(!!nm_n := e$n[, j], !!nm_pct := e$pct[, j])
    })
    cols_df <- dplyr::bind_cols(cols)
    idx_n_cols <- grep("__n$", names(cols_df))
    if (length(idx_n_cols) == length(e$N) && length(e$N) > 0) {
      for (k in seq_along(idx_n_cols)) denom_map[[names(cols_df)[idx_n_cols[k]]]] <- e$N[k]
    }
    cuerpo <- dplyr::bind_cols(cuerpo, cols_df)
  }

  total_row <- as.list(rep(NA, ncol(cuerpo)))
  names(total_row) <- names(cuerpo)
  total_row[["Opciones"]] <- "Total"
  for (j in grep("__n$", names(cuerpo))) {
    Nj <- denom_map[[names(cuerpo)[j]]]
    total_row[[j]] <- if (is.null(Nj)) NA_real_ else round(as.numeric(Nj), 0)
  }
  for (j in grep("__pct$", names(cuerpo))) {
    Nj <- suppressWarnings(as.numeric(total_row[[sub("__pct$", "__n", names(cuerpo)[j])]]))
    total_row[[j]] <- if (!is.na(Nj) && Nj > 0) 1.0 else NA_real_
  }
  dplyr::bind_rows(cuerpo, tibble::as_tibble(total_row))
}

# Letras de la subtabla de significancia, por variable de cruce, y su nota al pie.
.cruces_tabla_letras <- function(data, var, tp, opciones, codes_row, estratos, CRUZAR_CON, sig_spec, alpha,
                                 weight_col, repeat_design, dic_vars, labels_override) {
  bloques_sig <- list()
  for (s in CRUZAR_CON) {
    info_s <- estratos[[s]]
    if (is.null(info_s) || !length(info_s$labels)) next
    cmp <- .cruces_sig_comparar(
      data = data, var = var, codes_row = codes_row,
      estratos = info_s$codes, var_estrato = s, tp = tp,
      spec = sig_spec, alpha = alpha, weight_col = weight_col,
      repeat_design = repeat_design, opciones = opciones   # ADR 0128: rótulos para "No sé" y afines
    )
    bloques_sig[[s]] <- list(
      opciones = opciones, estr_codes = info_s$codes, estr_labels = info_s$labels,
      letras = cmp$letras, sig = cmp$sig,
      method = cmp$method %||% "z_simple", reason = cmp$reason %||% "",
      solitario = isTRUE(cmp$solitario), regla = cmp$regla
    )
  }
  if (!length(bloques_sig)) return(list(bloques = bloques_sig, nota = NULL))

  metodos_sig <- vapply(bloques_sig, function(bl) as.character(bl$method %||% "descriptivo"), character(1))
  razones_sig <- unique(Filter(nzchar, vapply(bloques_sig, function(bl) as.character(bl$reason %||% ""), character(1))))
  nota <- if (is.list(repeat_design) && all(metodos_sig == "descriptivo")) {
    .repeat_nota_descriptiva(razones_sig)   # reporte_cruces_cluster.R
  } else if (is.list(bloques_sig[[1]]$regla)) {
    .cruces_nota_regla(bloques_sig[[1]]$regla, razones_sig)
  } else {
    .cruces_sig_nota(
      sig_spec, alpha = alpha, metodos = metodos_sig, razones = razones_sig,
      solitario = any(vapply(bloques_sig, function(bl) isTRUE(bl$solitario), logical(1))),
      etiquetas = function(x) label_variable(x, dic_vars, labels_override, data),
      ponderado = .cruces_sig_ponderado(data, weight_col)
    )
  }
  list(bloques = bloques_sig, nota = nota)
}

#' Una tabla categórica de cruces del archivo, como datos
#'
#' Hace todo lo que `exportar_cruces_multi()` calcula para una variable de fila categórica, sin escribir: categorías
#' de fila (por código), columna Total, por cada variable de cruce y cada categoría de columna el `n` y el `pct`, la
#' fila Total, las líneas del pie y, si `show_sig`, las letras con su método y su motivo.
#'
#' @param data Base de la tabla (ya con el grano de la fila en una hija repeat).
#' @param notas Notas al pie ya normalizadas con `.notas_pie_normalizar()`.
#' @param casos_sin_ponderar Calcula además, por columna y en el Total, los casos sin ponderar con peso mayor que
#'   cero del denominador (regla I1). El archivo no los pide; la vista previa sí.
#' @return Lista con `var`, `tp`, `etiqueta`, `sin_datos`, `opciones`, `codes_row`, `omitidas`, `total`
#'   (`n`, `pct`, `N`, `casos`), `estratos` (por variable de cruce), `cuerpo` (tibble del archivo, con fila Total),
#'   `pie` (líneas) y `sig` (`NULL` o `list(bloques, nota)`).
#' @keywords internal
.cruces_tabla_archivo <- function(data, var, CRUZAR_CON, survey = NULL, sm_vars_force = NULL,
                                  orders_list = NULL, opciones_excluir = NULL,
                                  codigos_solo_si_presentes = NULL, orden = "original",
                                  ordinal_lists = character(), weight_col = "peso",
                                  dic_vars = NULL, labels_override = NULL, notas = NULL,
                                  col_sin_peso = ".pulso_sin_peso",
                                  show_sig = FALSE, sig_spec = NULL, alpha = 0.05,
                                  repeat_design = NULL, casos_sin_ponderar = FALSE) {
  tp <- tipo_pregunta(var, survey = survey, sm_vars_force = sm_vars_force, data = data)
  cats <- .cruces_tabla_categorias(data, var, tp, survey, orders_list, opciones_excluir,
                                   codigos_solo_si_presentes, weight_col)
  qlab <- label_variable(var, dic_vars, labels_override, data)
  out <- list(var = var, tp = tp, etiqueta = qlab, sin_datos = !length(cats$opciones),
              opciones = cats$opciones, codes_row = cats$codes_row, omitidas = cats$omitidas,
              total = NULL, estratos = list(), cuerpo = NULL, pie = character(0), sig = NULL)
  if (out$sin_datos) return(out)

  cats <- .cruces_tabla_ordenar(cats, data, var, tp, survey, orden, ordinal_lists, weight_col)
  opciones <- cats$opciones
  codes_row <- cats$codes_row
  out$opciones <- opciones
  out$codes_row <- codes_row

  mask_total <- rep(TRUE, nrow(data))
  N_total <- denominador_validos(data = data, var = var, codes = codes_row, tp = tp, mask = mask_total,
                                 weight_col = weight_col)
  n_total <- contar_por_opcion(data = data, var = var, codes = codes_row, tp = tp, mask = mask_total,
                               weight_col = weight_col)
  pct_total <- if (N_total > 0) n_total / N_total else rep(NA_real_, length(n_total))
  casos_total <- if (isTRUE(casos_sin_ponderar)) {
    denominador_validos(data = data, var = var, codes = codes_row, tp = tp,
                        mask = get_pesos(data, weight_col) > 0, weight_col = col_sin_peso)
  } else NA_real_
  out$total <- list(n = as.numeric(n_total), pct = as.numeric(pct_total), N = N_total, casos = casos_total)

  # `notas` llega normalizada (`.notas_pie_normalizar()`), como en el archivo.
  for (s in CRUZAR_CON) {
    if (!(s %in% names(data)) || identical(s, var)) next
    e <- .cruces_tabla_estrato(data, var, s, codes_row, tp, survey, orders_list, opciones_excluir,
                               dic_vars, labels_override, weight_col,
                               n_sin_peso = isTRUE(notas$base_reducida$activo), col_sin_peso = col_sin_peso,
                               casos_sin_ponderar = casos_sin_ponderar)
    if (!is.null(e)) out$estratos[[s]] <- e
  }

  out$cuerpo <- .cruces_tabla_cuerpo(opciones, n_total, pct_total, N_total, out$estratos)
  # Primera línea "Fuente: X[. Base: Y. Porcentajes por columna.]"; debajo, las notas por variable de cruce y el
  # aviso de bases reducidas.
  out$pie <- .cruces_lineas_pie(notas, var, CRUZAR_CON, out$estratos)
  if (isTRUE(show_sig) && length(out$estratos)) {
    out$sig <- .cruces_tabla_letras(data, var, tp, opciones, codes_row, out$estratos, CRUZAR_CON, sig_spec, alpha,
                                    weight_col, repeat_design, dic_vars, labels_override)
  }
  out
}

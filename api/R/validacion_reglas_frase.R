# =============================================================================
# Catálogo de reglas (M3): nombre y frase de una regla, en fichas
# =============================================================================
# Una sola narrativa por regla. La frase es una lista de fichas que la pantalla
# concatena tal cual, sin agregar espacios:
#
#   {texto}                      texto corrido; los espacios van dentro.
#   {pregunta, etiqueta, tipo}   una pregunta del formulario, por su código, con
#                                su etiqueta y su tipo ("unica", "multiple",
#                                "numerica" o "texto").
#   {valor[, codigo]}            un valor; si la pregunta tiene opciones, el
#                                rótulo de la opción y su código.
#
# Las etiquetas salen del formulario de la base (con las etiquetas corregidas
# del proyecto); si no hay formulario, de los papeles que guardó la regla; y si
# tampoco, del código. Los datos se cruzan siempre por código.
#
# Una parte del árbol que este archivo no sabe escribir no se calla: la frase
# lleva "una condición que no se puede escribir en palabras" y la regla sale
# con `frase_completa = FALSE`.

.VRF_TEXTO_ILEGIBLE <- "una condición que no se puede escribir en palabras"

# Columnas que unen el registro de un grupo repetido con su encuesta.
.VRF_LLAVES_TECNICAS <- c("_parent_index", "_index", "_uuid", "_submission__uuid", "_parent_uuid")

# Contexto de redacción: etiquetas, tipos y opciones por código de pregunta.
.vrf_contexto <- function(inst = NULL) {
  survey <- if (is.list(inst)) inst$survey else NULL
  etiquetas <- character(0)
  tipos <- character(0)
  opciones <- list()
  aviso <- NULL
  if (is.data.frame(survey) && nrow(survey) && "name" %in% names(survey)) {
    etiquetas <- .survey_label_map(survey)
    base_tipo <- if ("type_base" %in% names(survey)) as.character(survey$type_base)
                 else vapply(as.character(survey$type), .type_base, character(1))
    tipos <- stats::setNames(vapply(base_tipo, .vrf_tipo_pregunta, character(1)),
                             as.character(survey$name))
    # Si las opciones no se pueden leer, los valores salen por su código y el
    # catálogo lo avisa (`aviso`), en vez de mostrarlos sin rótulo sin decirlo.
    opciones <- tryCatch(.survey_choices_map(survey, inst$choices), error = function(e) e)
    if (inherits(opciones, "error")) {
      aviso <- list(codigo = "opciones_ilegibles",
                    texto = "Las opciones del formulario no se pudieron leer: los valores salen por su código.")
      opciones <- list()
    }
  }
  condiciones <- .vrf_condiciones_de_preguntas(survey)
  estado <- new.env(parent = emptyenv())
  estado$incompleta <- FALSE
  estado$fuera_de_opciones <- list()
  list(etiquetas = etiquetas, tipos = tipos, opciones = opciones, condiciones = condiciones,
       roles = list(), estado = estado, aviso = aviso)
}

# Condición bajo la que el formulario muestra cada pregunta: la de sus grupos y
# su `relevant` propio, como árbol. Se usa para decir "Solo se revisa cuando" en
# los valores calculados, cuya expresión del plan ya la incluye pero no la
# guarda aparte. Si el formulario no se puede recorrer, no hay condiciones (y
# las frases de cálculo no la nombran).
.vrf_condiciones_de_preguntas <- function(survey) {
  if (!is.data.frame(survey) || !nrow(survey) || !("name" %in% names(survey))) return(list())
  mapa <- tryCatch(build_group_gate_map(survey), error = function(e) list())
  out <- list()
  for (e in mapa) {
    v <- as.character(e$name %||% "")
    if (!nzchar(v)) next
    g <- e$gate
    i <- e$row_index
    rel <- if ("relevant" %in% names(survey) && !is.null(i)) as.character(survey$relevant[i]) else ""
    if (length(rel) && !is.na(rel) && nzchar(trimws(rel))) {
      parsed <- tryCatch(odk_parse_to_ast(rel, context = "relevant"), error = function(e) NULL)
      if (!is.null(parsed) && !isTRUE(parsed$degraded_to_raw)) {
        g <- if (is.null(g)) parsed$ast else ast_normalize(ast_and(g, parsed$ast))
      }
    }
    if (!is.null(g)) out[[v]] <- g
  }
  out
}

.vrf_tipo_pregunta <- function(tipo_base) {
  t <- as.character(tipo_base %||% "")[1]
  if (is.na(t)) return("texto")
  if (identical(t, "select_one") || identical(t, "select_one_from_file")) return("unica")
  if (identical(t, "select_multiple") || identical(t, "select_multiple_from_file")) return("multiple")
  if (t %in% c("integer", "decimal", "range")) return("numerica")
  "texto"
}

# Copia del contexto para una regla: suma las etiquetas que la regla guardó en
# sus papeles (sirven cuando no hay formulario) y reinicia el aviso de frase
# incompleta.
.vrf_contexto_regla <- function(ctx, rule = NULL) {
  out <- ctx
  out$roles <- (rule$variable_roles %||% list())$labels %||% list()
  out$estado <- new.env(parent = emptyenv())
  out$estado$incompleta <- FALSE
  out$estado$fuera_de_opciones <- list()
  out
}

.vrf_marcar_incompleta <- function(ctx) {
  ctx$estado$incompleta <- TRUE
  invisible(NULL)
}

# --- Fichas -------------------------------------------------------------------

.vrf_t <- function(x) list(list(texto = as.character(x)))

# Rótulo propio de una pregunta (formulario, luego papeles de la regla), sin
# resolver marcadores; "" si no tiene.
.vrf_rotulo_crudo <- function(v, ctx) {
  # Una "etiqueta" igual al código no es etiqueta.
  if (v %in% names(ctx$etiquetas)) {
    lab <- as.character(ctx$etiquetas[[v]])
    if (length(lab) && !is.na(lab) && nzchar(trimws(lab)) && !identical(trimws(lab), v)) return(trimws(lab))
  }
  lab <- ctx$roles[[v]]
  if (!is.null(lab) && length(lab) && !is.na(lab[1]) && nzchar(trimws(as.character(lab[1]))) &&
      !identical(trimws(as.character(lab[1])), v)) {
    return(trimws(as.character(lab[1])))
  }
  ""
}

.vrf_palabras_colgantes <- c("de", "del", "la", "el", "los", "las", "en", "a", "al", "y", "o",
                             "con", "para", "por", "que", "su", "sus")

# Una etiqueta del formulario puede traer `${otra}` (etiqueta dinámica). Se
# cambia por el rótulo de la pregunta referida entre corchetes; si esa pregunta
# no tiene rótulo propio (un cálculo, por ejemplo), la etiqueta se recorta antes
# del primer marcador y se le quitan los conectores que quedan colgando, para que
# lo que se lee siga siendo cierto. Nunca sale "${...}" crudo.
.vrf_resolver_marcadores <- function(lab, ctx, profundidad = 0L) {
  patron <- "\\$\\{([^}]+)\\}"
  if (!grepl(patron, lab)) return(lab)
  refs <- regmatches(lab, gregexpr(patron, lab))[[1]]
  vars <- sub(patron, "\\1", refs)
  rotulos <- vapply(vars, function(r) {
    x <- .vrf_rotulo_crudo(trimws(r), ctx)
    if (nzchar(x) && profundidad < 1L) x <- .vrf_resolver_marcadores(x, ctx, profundidad + 1L)
    if (grepl(patron, x)) "" else x
  }, character(1))
  if (all(nzchar(rotulos))) {
    out <- lab
    for (i in seq_along(refs)) out <- sub(refs[i], paste0("[", rotulos[i], "]"), out, fixed = TRUE)
    return(trimws(gsub("\\s+", " ", out)))
  }
  corte <- regexpr(patron, lab)
  out <- substr(lab, 1L, corte - 1L)
  repeat {
    antes <- out
    out <- sub("[\\s,;:\\-]+$", "", out, perl = TRUE)
    palabras <- strsplit(out, "\\s+")[[1]]
    if (length(palabras) && tolower(palabras[length(palabras)]) %in% .vrf_palabras_colgantes) {
      out <- paste(palabras[-length(palabras)], collapse = " ")
    }
    if (identical(out, antes)) break
  }
  out <- trimws(out)
  if (!nzchar(out)) return("")
  if (startsWith(out, "\u00bf") && !endsWith(out, "?")) out <- paste0(out, "?")
  out
}

.vrf_etiqueta <- function(var, ctx) {
  v <- as.character(var %||% "")[1]
  if (is.na(v) || !nzchar(v)) return("")
  lab <- .vrf_rotulo_crudo(v, ctx)
  if (!nzchar(lab)) return(v)
  lab <- .vrf_resolver_marcadores(lab, ctx)
  if (nzchar(lab)) lab else v
}

.vrf_q <- function(var, ctx) {
  v <- as.character(var %||% "")[1]
  tipo <- if (v %in% names(ctx$tipos)) unname(ctx$tipos[[v]]) else "texto"
  et <- .vrf_etiqueta(v, ctx)
  # Sin etiqueta: el código una sola vez, como texto (una ficha repetiría el
  # código como código y como etiqueta).
  if (identical(et, v)) return(list(list(texto = v)))
  list(list(pregunta = v, etiqueta = et, tipo = tipo))
}

.vrf_v <- function(valor, var = NULL, ctx = NULL) {
  val <- as.character(unlist(valor %||% NA_character_))[1]
  if (is.na(val)) val <- ""
  v <- as.character(var %||% "")[1]
  if (!is.null(ctx) && !is.na(v) && nzchar(v)) {
    lab <- .resolve_choice_label(ctx$opciones, v, val)
    if (!is.null(lab)) return(list(list(valor = lab, codigo = val)))
    # Un valor que no es código ni rótulo de las opciones de la pregunta: el
    # formulario compara con algo que la lista no tiene. Se anota para avisar.
    ops <- ctx$opciones[[v]]
    if (!is.null(ops) && length(ops) && nzchar(val) &&
        !(val %in% c(names(ops), as.character(unlist(ops))))) {
      ctx$estado$fuera_de_opciones[[length(ctx$estado$fuera_de_opciones) + 1L]] <- list(pregunta = v, valor = val)
    }
  }
  list(list(valor = val))
}

# Varias fichas de valor separadas por coma y la última con el conector.
.vrf_lista_valores <- function(valores, var, ctx, conector = " o ") {
  valores <- as.character(unlist(valores %||% character(0)))
  out <- list()
  for (i in seq_along(valores)) {
    if (i > 1L) out <- c(out, .vrf_t(if (i == length(valores)) conector else ", "))
    out <- c(out, .vrf_v(valores[i], var, ctx))
  }
  out
}

.vrf_lista_preguntas <- function(vars, ctx, conector = " y ") {
  vars <- as.character(unlist(vars %||% character(0)))
  out <- list()
  for (i in seq_along(vars)) {
    if (i > 1L) out <- c(out, .vrf_t(if (i == length(vars)) conector else ", "))
    out <- c(out, .vrf_q(vars[i], ctx))
  }
  out
}

# Junta fichas de texto contiguas para que la frase no llegue partida.
.vrf_compactar <- function(fichas) {
  out <- list()
  for (f in fichas) {
    n <- length(out)
    if (n && !is.null(f$texto) && length(names(f)) == 1L &&
        !is.null(out[[n]]$texto) && length(names(out[[n]])) == 1L) {
      out[[n]]$texto <- paste0(out[[n]]$texto, f$texto)
    } else {
      out[[n + 1L]] <- f
    }
  }
  out
}

# Texto plano de una frase (para `limites$restriccion` y para las pruebas).
.vrf_texto_plano <- function(fichas) {
  partes <- vapply(fichas, function(f) {
    if (!is.null(f$texto)) return(f$texto)
    if (!is.null(f$pregunta)) return(f$etiqueta %||% f$pregunta)
    as.character(f$valor %||% "")
  }, character(1))
  paste(partes, collapse = "")
}

# --- Operadores -------------------------------------------------------------

.vrf_op <- function(op, negar = FALSE) {
  op <- as.character(op %||% "")
  if (isTRUE(negar)) {
    op <- switch(op, "==" = "!=", "!=" = "==", ">" = "<=", ">=" = "<",
                 "<" = ">=", "<=" = ">", op)
  }
  switch(op,
    "==" = "es", "!=" = "no es", ">" = "es mayor que",
    ">=" = "es mayor o igual a", "<" = "es menor que",
    "<=" = "es menor o igual a", op
  )
}

.vrf_porcentaje <- function(x) {
  x <- suppressWarnings(as.numeric(x))[1]
  if (!is.finite(x)) return("")
  paste0(format(round(x * 100, 1), nsmall = 0, trim = TRUE), " %")
}

# La cantidad esperada de un grupo repetido viene como expresión del
# formulario ("count-selected(${services})" o "${n_hijos}").
.vrf_esperado <- function(expr, ctx) {
  e <- as.character(expr %||% "")[1]
  m <- regmatches(e, regexec("^\\s*count-selected\\(\\s*\\$\\{([^}]+)\\}\\s*\\)\\s*$", e))[[1]]
  if (length(m) == 2L) return(c(.vrf_t("la cantidad de opciones marcadas en "), .vrf_q(m[2], ctx)))
  m <- regmatches(e, regexec("^\\s*\\$\\{([^}]+)\\}\\s*$", e))[[1]]
  if (length(m) == 2L) return(.vrf_q(m[2], ctx))
  .vrf_v(e)
}

# --- Condiciones --------------------------------------------------------------

.vrf_hijo <- function(x, op_padre, ctx) {
  fichas <- .vrf_cond(x, ctx)
  op <- if (is_ast(x)) ast_op(x) else ""
  if ((identical(op_padre, "and") && identical(op, "or")) ||
      (identical(op_padre, "or") && identical(op, "and"))) {
    return(c(.vrf_t("("), fichas, .vrf_t(")")))
  }
  fichas
}

.vrf_unir <- function(args, op_padre, ctx) {
  sep <- if (identical(op_padre, "and")) " y " else " o "
  out <- list()
  for (i in seq_along(args)) {
    if (i > 1L) out <- c(out, .vrf_t(sep))
    out <- c(out, .vrf_hijo(args[[i]], op_padre, ctx))
  }
  out
}

.vrf_negables <- c("is_missing", "is_empty_string", "compare_const", "compare_vars",
                   "selected", "any_selected", "none_selected", "in_set",
                   "not_in_set", "range_numeric", "range_date", "matches_regex",
                   "collection_date_cmp", "count_selected_cmp", "text_length_cmp",
                   "always_true", "always_false")

# Una condición se puede escribir negada en afirmativo si es una comparación
# simple, la negación de una, o un "y"/"o" de condiciones así (De Morgan: "no
# (A y B)" se escribe "no A o no B").
.vrf_se_niega <- function(x) {
  if (!is_ast(x)) return(FALSE)
  op <- ast_op(x)
  if (op %in% .vrf_negables) return(TRUE)
  if (identical(op, "not")) return(.vrf_se_niega(x$arg))
  if (op %in% c("and", "or")) return(all(vapply(x$args, .vrf_se_niega, logical(1))))
  FALSE
}

# "y"/"o" negado: cada parte negada y el conector cambiado.
.vrf_unir_negado <- function(args, op_padre, ctx) {
  op_nuevo <- if (identical(op_padre, "and")) "or" else "and"
  sep <- if (identical(op_nuevo, "and")) " y " else " o "
  out <- list()
  for (i in seq_along(args)) {
    if (i > 1L) out <- c(out, .vrf_t(sep))
    a <- args[[i]]
    f <- .vrf_cond(a, ctx, negar = TRUE)
    # Conector con que queda escrita la parte negada: un "y" negado se escribe
    # "o" y al revés; una negación negada queda como su interior. Paréntesis si
    # ese conector no es el de afuera.
    op_a <- if (is_ast(a)) ast_op(a) else ""
    queda <- if (identical(op_a, "not") && is_ast(a$arg)) ast_op(a$arg)
             else switch(op_a, and = "or", or = "and", op_a)
    if (queda %in% c("and", "or") && !identical(queda, op_nuevo)) f <- c(.vrf_t("("), f, .vrf_t(")"))
    out <- c(out, f)
  }
  out
}

# Fichas de una condición del árbol. `negar` escribe su negación.
.vrf_cond <- function(x, ctx, negar = FALSE) {
  if (is.null(x) || !is_ast(x)) {
    .vrf_marcar_incompleta(ctx)
    return(.vrf_t(.VRF_TEXTO_ILEGIBLE))
  }
  op <- ast_op(x)
  if (identical(op, "not")) {
    arg <- x$arg
    if (isTRUE(negar)) return(.vrf_cond(arg, ctx))
    if (.vrf_se_niega(arg)) return(.vrf_cond(arg, ctx, negar = TRUE))
    return(c(.vrf_t("no se cumple que ("), .vrf_cond(arg, ctx), .vrf_t(")")))
  }
  if (isTRUE(negar) && op %in% c("and", "or") && .vrf_se_niega(x)) {
    return(.vrf_unir_negado(x$args, op, ctx))
  }
  if (isTRUE(negar) && !(op %in% .vrf_negables)) {
    return(c(.vrf_t("no se cumple que ("), .vrf_cond(x, ctx), .vrf_t(")")))
  }
  q <- function(v) .vrf_q(v, ctx)
  switch(op,
    "is_missing" = , "is_empty_string" =
      c(q(x$var), .vrf_t(if (negar) " tiene respuesta" else " está vacía")),
    "compare_const" =
      c(q(x$var), .vrf_t(paste0(" ", .vrf_op(x$op, negar), " ")), .vrf_v(x$value, x$var, ctx)),
    "compare_vars" =
      c(q(x$var_a %||% x$left), .vrf_t(paste0(" ", .vrf_op(x$op, negar), " ")), q(x$var_b %||% x$right)),
    "selected" =
      c(q(x$var), .vrf_t(if (negar) " no incluye " else " incluye "), .vrf_v(x$value, x$var, ctx)),
    "any_selected" =
      c(q(x$var), .vrf_t(if (negar) " no incluye ninguna de estas opciones: " else " incluye alguna de estas opciones: "),
        .vrf_lista_valores(x$values, x$var, ctx)),
    "none_selected" =
      c(q(x$var), .vrf_t(if (negar) " incluye alguna de estas opciones: " else " no incluye ninguna de estas opciones: "),
        .vrf_lista_valores(x$values, x$var, ctx)),
    "in_set" =
      c(q(x$var), .vrf_t(if (negar) " no está entre " else " es "),
        .vrf_lista_valores(x$values, x$var, ctx, conector = if (negar) " y " else " o ")),
    "not_in_set" =
      c(q(x$var), .vrf_t(if (negar) " es " else " no está entre "),
        .vrf_lista_valores(x$values, x$var, ctx, conector = if (negar) " o " else " y ")),
    "range_numeric" = .vrf_rango(x, ctx, negar, fecha = FALSE),
    "range_date" = .vrf_rango(x, ctx, negar, fecha = TRUE),
    "matches_regex" =
      c(q(x$var), .vrf_t(if (negar) " no sigue el patrón " else " sigue el patrón "), .vrf_v(x$pattern)),
    "text_length_cmp" =
      c(.vrf_t("el largo de "), q(x$var), .vrf_t(paste0(" ", .vrf_op(x$op, negar), " ")), .vrf_v(x$n), .vrf_t(" caracteres")),
    "count_selected_cmp" =
      c(.vrf_t("la cantidad de opciones marcadas en "), q(x$var),
        .vrf_t(paste0(" ", .vrf_op(x$op, negar), " ")), .vrf_v(x$n)),
    "collection_date_cmp" =
      c(q(x$var), .vrf_t(paste0(" ", .vrf_op(x$op, negar), " la fecha de la encuesta"))),
    "collection_date_offset_cmp" = {
      dias <- suppressWarnings(as.integer(x$offset_days))[1]
      ref <- if (is.na(dias)) " la fecha de la encuesta" else if (dias < 0L) {
        sprintf(" %d %s antes de la fecha de la encuesta", abs(dias), if (abs(dias) == 1L) "día" else "días")
      } else {
        sprintf(" %d %s después de la fecha de la encuesta", dias, if (dias == 1L) "día" else "días")
      }
      c(q(x$var), .vrf_t(paste0(" ", .vrf_op(x$op), ref)))
    },
    "select_multiple_exclusive" =
      c(.vrf_t("en "), q(x$var), .vrf_t(", "), .vrf_lista_valores(x$exclusive_codes, x$var, ctx),
        .vrf_t(" se marca junto con otra opción")),
    "any_column_equals" =
      c(.vrf_t("alguna de "), .vrf_lista_preguntas(x$cols, ctx), .vrf_t(" es "), .vrf_v(x$value)),
    "all_columns_not_equals" =
      c(.vrf_t("ninguna de "), .vrf_lista_preguntas(x$cols, ctx), .vrf_t(" es "), .vrf_v(x$value)),
    "duplicate_tuple" = {
      # Las llaves técnicas que unen un registro con su encuesta no son
      # preguntas: "dentro de la misma encuesta" dice lo mismo en llano.
      vars <- as.character(unlist(x$vars))
      llaves <- vars %in% .VRF_LLAVES_TECNICAS
      vistas <- vars[!llaves]
      cola <- if (any(llaves)) " se repite dentro de la misma encuesta" else " se repite en otra fila"
      if (!length(vistas)) .vrf_t(paste0("el registro", cola))
      else c(.vrf_t(if (length(vistas) == 1L) "" else "la combinación de "), .vrf_lista_preguntas(vistas, ctx), .vrf_t(cola))
    },
    "duplicate_similarity" =
      c(.vrf_t("la encuesta coincide con otra en al menos "), .vrf_v(.vrf_porcentaje(x$threshold)),
        .vrf_t(" de las "), .vrf_v(length(x$vars)),
        .vrf_t(" preguntas comparadas, siempre que tengan respuesta al menos "),
        .vrf_v(.vrf_porcentaje(x$minimum_coverage)), .vrf_t(" de ellas")),
    "outlier_iqr" =
      c(q(x$var), .vrf_t(" queda a más de "), .vrf_v(x$k),
        .vrf_t(" rangos intercuartílicos por debajo del primer cuartil o por encima del tercero")),
    "outlier_zscore" =
      c(q(x$var), .vrf_t(" se aleja de la media más de "), .vrf_v(x$k), .vrf_t(" desviaciones estándar")),
    "straight_line" =
      c(.vrf_t("las respuestas a "), .vrf_lista_preguntas(x$vars, ctx), .vrf_t(" casi no varían")),
    "repeat_length_matches" =
      c(.vrf_t("la cantidad de registros de "), q(x$repeat_name), .vrf_t(" no coincide con "),
        .vrf_esperado(x$expected, ctx)),
    "referential_parent_exists" = .vrf_t("el registro no pertenece a ninguna encuesta de la base"),
    "aggregate_cmp" =
      c(q(x$host_var), .vrf_t(paste0(" ", .vrf_op(x$op), " lo que suman los registros de ")), q(x$source_var)),
    "roster_set_cmp" =
      c(.vrf_t("las opciones marcadas en "), q(x$host_sm_var), .vrf_t(" no coinciden con los registros de "),
        q(x$source_table)),
    # Marca la condición con la consecuencia incumplida (`.c_if_then`): "X y no Y".
    "if_then" = if (isTRUE(negar)) {
      c(.vrf_cond(x$condition, ctx, negar = TRUE), .vrf_t(" o "), .vrf_cond(x$consequence, ctx))
    } else {
      c(.vrf_cond(x$condition, ctx), .vrf_t(" y "), .vrf_cond(x$consequence, ctx, negar = TRUE))
    },
    "and" = .vrf_unir(x$args, "and", ctx),
    "or" = .vrf_unir(x$args, "or", ctx),
    "always_true" = .vrf_t(if (negar) "nunca" else "siempre"),
    "always_false" = .vrf_t(if (negar) "siempre" else "nunca"),
    {
      .vrf_marcar_incompleta(ctx)
      .vrf_t(.VRF_TEXTO_ILEGIBLE)
    }
  )
}

.vrf_rango <- function(x, ctx, negar, fecha) {
  mn <- x$min; mx <- x$max
  tiene_min <- !is.null(mn) && length(mn) && !is.na(mn[1])
  tiene_max <- !is.null(mx) && length(mx) && !is.na(mx[1])
  q <- .vrf_q(x$var, ctx)
  # El nodo vale TRUE cuando el valor queda fuera del rango.
  if (tiene_min && tiene_max) {
    if (negar) return(c(q, .vrf_t(if (fecha) " está en el periodo del " else " está entre "), .vrf_v(mn),
                        .vrf_t(if (fecha) " al " else " y "), .vrf_v(mx)))
    return(c(q, .vrf_t(if (fecha) " está fuera del periodo del " else " está fuera del rango de "), .vrf_v(mn),
             .vrf_t(if (fecha) " al " else " a "), .vrf_v(mx)))
  }
  if (tiene_min) {
    return(c(q, .vrf_t(if (negar) {
      if (fecha) " es del " else " es mayor o igual a "
    } else {
      if (fecha) " es anterior al " else " es menor que "
    }), .vrf_v(mn), .vrf_t(if (negar && fecha) " o posterior" else "")))
  }
  if (tiene_max) {
    return(c(q, .vrf_t(if (negar) {
      if (fecha) " es del " else " es menor o igual a "
    } else {
      if (fecha) " es posterior al " else " es mayor que "
    }), .vrf_v(mx), .vrf_t(if (negar && fecha) " o anterior" else "")))
  }
  .vrf_marcar_incompleta(ctx)
  .vrf_t(.VRF_TEXTO_ILEGIBLE)
}

# --- Rótulos por familia -----------------------------------------------------

.VRF_FAMILIAS <- list(
  formulario = c(obligatoria = "Obligatorias", salto = "Saltos", restriccion = "Restricciones",
                 filtro_opciones = "Filtros de opciones", calculo = "Valores calculados",
                 grupo_repetido = "Grupos repetidos"),
  operativo = c(periodo = "Periodo de campo", casi_iguales = "Respuestas casi iguales"),
  propia = c(no_nulo = "Respuesta obligatoria", rango_num = "Valor fuera de rango",
             rango_fecha = "Fecha fuera del operativo", outliers_iqr = "Valores atípicos por cuartiles",
             outliers_z = "Valores atípicos por desviación estándar", duplicados = "Respuestas repetidas",
             fuera_catalogo = "Respuesta fuera de lista", coherencia_2v = "Dos respuestas que deben cuadrar",
             condiciones = "Condiciones combinadas", select_multiple_hierarchy = "Opciones que van juntas",
             select_multiple_exclusive = "Opciones incompatibles",
             select_multiple_cardinality = "Cantidad de opciones marcadas",
             select_multiple_selection = "Opciones esperadas o prohibidas",
             continuidad_secuencia = "Huecos en la numeración",
             cruce_identidad = "Mismo caso en encuestas superpuestas",
             bateria = "Patrón en una batería",
             comparar_fechas = "Dos fechas u horas que deben cuadrar")
)

.vrf_nombre_familia <- function(origen, familia) {
  tabla <- .VRF_FAMILIAS[[origen]] %||% character(0)
  if (familia %in% names(tabla)) return(unname(tabla[[familia]]))
  # Un tipo que la lista no conoce se nombra por su código y se dice.
  "Otro tipo de regla"
}

# Causa en llano de una regla sin evaluar, por código.
.VRF_CAUSAS <- c(
  expresion_no_leida = "Expresión que no se pudo leer",
  expresion_no_traducida = "Expresión que la auditoría no admite",
  listado_externo = "Depende de un listado externo",
  sin_fecha_encuesta = "Falta la fecha de la encuesta",
  variable_excluida = "Pregunta fuera de la auditoría",
  pregunta_ausente = "La pregunta no está en la base",
  valor_desalineado = "El valor que compara no aparece en la base",
  grupo_sin_registros = "El grupo repetido no tiene registros",
  tabla_ausente = "Falta la tabla del grupo repetido",
  error_al_evaluar = "La regla falló al evaluarse",
  regla_no_traducible = "La regla propia no se puede evaluar",
  sin_auditar = "Creada después de la última auditoría",
  editada_tras_auditoria = "Cambió después de la última auditoría"
)

.vrf_causa <- function(codigo) {
  if (is.null(codigo) || is.na(codigo)) return(NA_character_)
  if (codigo %in% names(.VRF_CAUSAS)) return(unname(.VRF_CAUSAS[[codigo]]))
  # Una causa que la lista no conoce: texto genérico; el código va en
  # `causa_codigo`, aparte, nunca dentro del texto.
  "La regla no se pudo evaluar sobre esta base"
}

# --- Nombre y frase de una regla ---------------------------------------------

.vrf_comillas <- function(x) sprintf("\"%s\"", x)

# `info` trae: origen, familia, direccion, target, tabla, condicion (árbol de la
# condición de la base, en saltos), cuerpo (lo que marca, sin la parte de
# "tiene respuesta"), filtro (gate), limites, propia (la regla guardada) y
# sin_evaluar.
.vrf_nombre <- function(info, ctx) {
  if (identical(info$origen, "propia")) {
    nm <- trimws(as.character(info$propia$nombre %||% ""))
    return(if (nzchar(nm)) nm else .vrf_nombre_familia("propia", info$familia))
  }
  et <- .vrf_comillas(.vrf_etiqueta(info$target, ctx))
  switch(info$familia,
    "obligatoria" = sprintf("Respuesta obligatoria en %s", et),
    "salto" = if (identical(info$direccion, "nodebe")) {
      sprintf("Salto de %s: respondida cuando no le correspondía", et)
    } else if (identical(info$direccion, "debe")) {
      sprintf("Salto de %s: vacía cuando le correspondía", et)
    } else sprintf("Salto de %s", et),
    "restriccion" = {
      lim <- info$limites
      if (is.list(lim) && !is.na(lim$min %||% NA) && !is.na(lim$max %||% NA)) {
        sprintf("%s entre %s y %s", et, lim$min, lim$max)
      } else if (is.list(lim) && !is.na(lim$min %||% NA)) {
        sprintf("%s %s %s", et, if (isTRUE(lim$inclusive_min)) "mayor o igual a" else "mayor que", lim$min)
      } else if (is.list(lim) && !is.na(lim$max %||% NA)) {
        sprintf("%s %s %s", et, if (isTRUE(lim$inclusive_max)) "menor o igual a" else "menor que", lim$max)
      } else sprintf("Restricción de %s", et)
    },
    "filtro_opciones" = sprintf("Filtro de opciones de %s", et),
    "calculo" = sprintf("Valor calculado de %s", et),
    "grupo_repetido" = .vrf_nombre_grupo(info, ctx),
    "periodo" = "Periodo de campo",
    "casi_iguales" = "Respuestas casi iguales",
    sprintf("Regla de %s", et)
  )
}

# El grupo repetido de una regla relacional, por su rótulo en el formulario, y
# un nombre que dice qué revisa: hay varias reglas por grupo.
.vrf_grupo_de <- function(info) {
  c0 <- info$cuerpo
  op <- if (is_ast(c0)) ast_op(c0) else ""
  g <- switch(op,
    repeat_length_matches = c0$repeat_name,
    roster_set_cmp = , aggregate_cmp = c0$source_table,
    NULL)
  g <- as.character(g %||% info$tabla %||% "")[1]
  if (identical(g, "principal") && is_ast(c0) && !is.null(c0$source_table)) g <- as.character(c0$source_table)
  list(grupo = g, op = op)
}

.vrf_nombre_grupo <- function(info, ctx) {
  gi <- .vrf_grupo_de(info)
  g <- .vrf_comillas(.vrf_etiqueta(gi$grupo, ctx))
  c0 <- info$cuerpo
  switch(gi$op,
    repeat_length_matches = sprintf("Cantidad de registros en %s", g),
    referential_parent_exists = sprintf("Registros sin encuesta en %s", g),
    duplicate_tuple = sprintf("Registros repetidos en %s", g),
    roster_set_cmp = sprintf("Opciones de %s frente a los registros de %s",
                             .vrf_comillas(.vrf_etiqueta(c0$host_sm_var, ctx)), g),
    aggregate_cmp = sprintf("%s frente a la suma de los registros de %s",
                            .vrf_comillas(.vrf_etiqueta(c0$host_var, ctx)), g),
    sprintf("Grupo repetido %s", g)
  )
}

.vrf_frase <- function(info, ctx) {
  q <- .vrf_q(info$target, ctx)
  punto <- .vrf_t(".")
  filtro <- if (!is.null(info$filtro)) c(.vrf_t(" Solo se revisa cuando "), .vrf_cond(info$filtro, ctx), punto) else list()
  if (isTRUE(info$sin_evaluar_expresion)) {
    return(.vrf_compactar(c(q, .vrf_t(" tiene una condición del formulario que la auditoría no puede leer."))))
  }
  out <- switch(info$familia,
    "obligatoria" = c(q, .vrf_t(" es obligatoria"),
                      if (!is.null(info$filtro)) c(.vrf_t(" cuando "), .vrf_cond(info$filtro, ctx)) else list(),
                      punto),
    "salto" = if (!is.null(info$condicion)) {
      c(q, .vrf_t(if (identical(info$direccion, "nodebe")) " queda vacía cuando " else " se responde cuando "),
        .vrf_cond(info$condicion, ctx), punto)
    } else {
      .vrf_marcar_incompleta(ctx)
      c(q, .vrf_t(" sigue un salto que no se puede escribir en palabras."))
    },
    "calculo" = c(.vrf_t("El valor calculado de "), q, .vrf_t(" debe coincidir con su fórmula del formulario."),
                  filtro),
    "bateria" = c(.vrf_frase_bateria(info, ctx), filtro),
    "rango_fecha" = , "comparar_fechas" = c(.vrf_frase_fechas(info, ctx), filtro),
    c(.vrf_t("Se marca cuando "), .vrf_cond(info$cuerpo, ctx), punto, filtro)
  )
  .vrf_compactar(out)
}

# =============================================================================
# Regla propia "Patrón en una batería" (tipo `bateria`)
# =============================================================================
# Una batería es un conjunto de preguntas que se responden con la misma lista
# (P29.1 a P29.14, P9.1 a P9.20). La regla marca el caso por un patrón en el
# conjunto, que una regla de una pregunta o de un par no puede expresar:
#
#   iguales  todas las respuestas contadas son la misma ("misma respuesta en
#            todos los ítems"), con al menos `minimo` preguntas contadas. Una
#            pregunta vacía no cuenta, salvo `vacias_cuentan = TRUE`; los
#            códigos de `no_cuentan` (88 "No aplica") tampoco.
#   codigo   alguno de `codigos` aparece en al menos `minimo` preguntas
#            ("88 en 19 o más ítems").
#   vacias   al menos `minimo` preguntas vacías (todas, si `minimo` es el
#            total).
#
# Grano: fila de la tabla donde corre la regla (el caso en la principal). La
# cifra de la regla es la del motor: casos marcados sobre las filas que evalúa
# la auditoría (o las que cumplen el "Solo revisar cuando"); este archivo no
# cuenta casos, solo decide la marca de cada fila.
#
# Una sola función mide cada fila (`.regla_bateria_medir()`): el texto R que
# va al plan, a la auditoría y al script de limpieza es esa misma función
# escrita en línea (deparse), y las cifras de cada caso (preguntas contadas,
# vacías, valor común) que leen el conteo previo y Hallazgos salen de llamarla
# directamente. La función no lleva ningún "=" suelto (ni argumentos con
# nombre): `evaluar_consistencia()` normaliza el texto del plan y convierte "="
# en "==".

.REGLA_BATERIA_PATRONES <- c("iguales", "codigo", "vacias")

# Mínimo admitido por patrón: "iguales" con una sola pregunta contada marcaría
# cualquier caso que respondió una.
.REGLA_BATERIA_MINIMO_INFERIOR <- c(iguales = 2L, codigo = 1L, vacias = 1L)

#' Mide cada fila de una batería
#'
#' @param cols lista de columnas (una por pregunta, mismo largo).
#' @param patron "iguales", "codigo" o "vacias".
#' @param minimo entero: preguntas contadas (iguales), con el código (codigo)
#'   o vacías (vacias) que hacen falta para marcar.
#' @param codigos códigos que cuenta el patrón "codigo".
#' @param no_cuentan códigos que el patrón "iguales" no cuenta como respuesta.
#' @param vacias_cuentan si TRUE, en "iguales" una pregunta vacía es una
#'   respuesta más.
#' @return lista con, por fila, `n_contadas`, `n_vacias`, `n_codigo`,
#'   `n_distintas`, `valor_comun` y `marca`; `n_items`, y en `items` las
#'   matrices fila por pregunta `cuenta`, `vacia` y `codigo`.
#' @keywords internal
.regla_bateria_medir <- function(cols, patron, minimo, codigos, no_cuentan, vacias_cuentan) {
  norm <- function(x) {
    x <- if (is.factor(x)) as.character(x) else as.character(unclass(x))
    x <- trimws(x)
    x[x %in% c("", "NA")] <- NA
    sub("^(-?[0-9]+)[.]0+$", "\\1", x)
  }
  k <- length(cols)
  n <- if (k) length(cols[[1L]]) else 0L
  m <- matrix(NA_character_, n, k)
  for (j in seq_len(k)) m[, j] <- norm(cols[[j]])
  vacia <- is.na(m)
  codigos <- norm(codigos)
  no_cuentan <- norm(no_cuentan)
  en <- function(valores) matrix(m %in% valores, n, k)
  if (isTRUE(vacias_cuentan)) m[vacia] <- ""
  cuenta <- !en(no_cuentan)
  if (!isTRUE(vacias_cuentan)) cuenta <- cuenta & !vacia
  es_codigo <- en(codigos) & !vacia
  distintas <- lapply(seq_len(n), function(i) unique(m[i, cuenta[i, ]]))
  n_distintas <- vapply(distintas, length, integer(1))
  valor_comun <- vapply(distintas, function(u) if (length(u) == 1L) u else NA_character_, character(1))
  n_contadas <- as.integer(rowSums(cuenta))
  n_vacias <- as.integer(rowSums(vacia))
  n_codigo <- as.integer(rowSums(es_codigo))
  marca <- if (identical(patron, "iguales")) {
    n_contadas >= minimo & n_distintas == 1L
  } else if (identical(patron, "codigo")) {
    n_codigo >= minimo
  } else if (identical(patron, "vacias")) {
    n_vacias >= minimo
  } else {
    stop("patron de bateria desconocido: ", patron)
  }
  stats::setNames(
    list(k, n_contadas, n_vacias, n_codigo, n_distintas, valor_comun, marca,
         stats::setNames(list(cuenta, vacia, es_codigo), c("cuenta", "vacia", "codigo"))),
    c("n_items", "n_contadas", "n_vacias", "n_codigo", "n_distintas", "valor_comun", "marca", "items")
  )
}

# Los parámetros de la regla, normalizados, sin validar. `k` es el número de
# preguntas de la batería: "iguales" y "vacias" sin mínimo piden todas.
.regla_bateria_params <- function(params, k) {
  params <- params %||% list()
  patron <- trimws(calc_str(params$patron))
  minimo_crudo <- suppressWarnings(as.numeric(unlist(params$minimo, use.names = FALSE)[1]))
  minimo_dado <- length(minimo_crudo) == 1L && !is.na(minimo_crudo)
  minimo <- if (minimo_dado) minimo_crudo else if (patron %in% c("iguales", "vacias")) k else NA_real_
  list(
    patron = patron,
    minimo = minimo,
    codigos = .regla_chr_values(params$codigos),
    no_cuentan = .regla_chr_values(params$no_cuentan),
    vacias_cuentan = isTRUE(calc_bool(params$vacias_cuentan, FALSE))
  )
}

# Esquema: se llama desde `.validar_regla_custom()` con la regla entera.
.regla_bateria_validar <- function(r) {
  vars <- as.character(unlist(r$variables %||% list(), use.names = FALSE))
  vars <- trimws(vars[!is.na(vars)])
  if (length(vars) < 2L) {
    stop_api(400, "E_REGLA_BATERIA_PREGUNTAS",
             "Una batería necesita al menos 2 preguntas.")
  }
  repetidas <- unique(vars[duplicated(vars)])
  if (length(repetidas)) {
    stop_api(400, "E_REGLA_BATERIA_PREGUNTAS",
             sprintf("La pregunta %s está más de una vez en la batería.", repetidas[1]),
             details = list(repetidas = as.list(repetidas)))
  }
  k <- length(vars)
  p <- .regla_bateria_params(r$params, k)
  if (!(p$patron %in% .REGLA_BATERIA_PATRONES)) {
    stop_api(400, "E_REGLA_BATERIA_PATRON",
             sprintf("Patrón de batería '%s' no válido. Válidos: %s.",
                     p$patron, paste(.REGLA_BATERIA_PATRONES, collapse = ", ")))
  }
  if (identical(p$patron, "codigo") && !length(p$codigos)) {
    stop_api(400, "E_REGLA_BATERIA_CODIGOS",
             "El patrón 'codigo' necesita al menos un código en 'codigos'.")
  }
  inferior <- .REGLA_BATERIA_MINIMO_INFERIOR[[p$patron]]
  m <- p$minimo
  if (is.na(m) || m != round(m) || m < inferior || m > k) {
    stop_api(400, "E_REGLA_BATERIA_MINIMO",
             sprintf("El mínimo de la batería debe ser un número entero entre %d y %d (las preguntas de la batería).",
                     inferior, k),
             details = list(patron = p$patron, minimo = if (is.na(m)) NA else m, n_preguntas = k))
  }
  invisible(TRUE)
}

# El texto R de la marca: la función de medida en línea, aplicada a las
# columnas de la batería, por nombre (con comillas invertidas: un nombre de
# columna no siempre es sintáctico).
.regla_expr_bateria <- function(vars, params) {
  vars <- as.character(vars)
  p <- .regla_bateria_params(params, length(vars))
  fn <- paste(deparse(.regla_bateria_medir, width.cutoff = 500L), collapse = "\n")
  cols <- sprintf("list(%s)", paste(sprintf("`%s`", gsub("`", "\\\\`", vars)), collapse = ", "))
  args <- c(cols, deparse1(p$patron), sprintf("%dL", as.integer(p$minimo)),
            deparse1(p$codigos), deparse1(p$no_cuentan), if (p$vacias_cuentan) "TRUE" else "FALSE")
  sprintf("(%s)(%s)$marca", fn, paste(args, collapse = ", "))
}

# La regla del motor (puente de reglas propias). La primera pregunta es la
# revisada y las demás van de comparadas: el motor exige todas en la base y
# dice cuál falta.
.regla_bateria_rule <- function(vars, params, gate, nombre, objetivo, severidad) {
  p <- .regla_bateria_params(params, length(vars))
  out <- .rule_custom_raw_expr(
    vars = vars, expr = .regla_expr_bateria(vars, params),
    gate = gate, tipo_regla = "pattern",
    nombre = nombre, objetivo = objetivo, severidad = severidad
  )
  out$presentation <- utils::modifyList(out$presentation %||% list(),
                                        list(subtipo_semantico = paste0("bateria_", p$patron)))
  out
}

# Mide filas sueltas de una tabla (los ejemplos del conteo previo, un caso de
# Hallazgos) con la misma función que marca.
.regla_bateria_medir_filas <- function(df, filas, vars, params) {
  p <- .regla_bateria_params(params, length(vars))
  cols <- lapply(vars, function(v) if (v %in% names(df)) df[[v]][filas] else rep(NA, length(filas)))
  .regla_bateria_medir(cols, p$patron, p$minimo, p$codigos, p$no_cuentan, p$vacias_cuentan)
}

# Lo que dice una fila medida, para el conteo previo y el caso.
.regla_bateria_resumen <- function(med, i, patron) {
  list(
    patron = patron,
    n_items = as.integer(med$n_items),
    n_contadas = med$n_contadas[i],
    n_vacias = med$n_vacias[i],
    n_codigo = med$n_codigo[i],
    valor_comun = med$valor_comun[i]
  )
}

# Un ejemplo del conteo previo de una batería: cada pregunta resalta si es la
# que hace el patrón (contada en "iguales", con el código en "codigo", vacía en
# "vacias") y el ejemplo lleva su resumen.
.regla_bateria_ejemplo <- function(ejemplo, df, i, regla) {
  vars <- .regla_variables_efectivas(regla)
  p <- .regla_bateria_params(regla$params, length(vars))
  med <- .regla_bateria_medir_filas(df, i, vars, regla$params)
  matriz <- switch(p$patron, iguales = med$items$cuenta, codigo = med$items$codigo, med$items$vacia)
  ejemplo$valores <- lapply(ejemplo$valores, function(v) {
    j <- match(v$variable, vars)
    if (!is.na(j)) v$falla <- isTRUE(matriz[1L, j])
    v
  })
  ejemplo$bateria <- .regla_bateria_resumen(med, 1L, p$patron)
  ejemplo
}

# --- Frase del catálogo -------------------------------------------------------

# "de P29.1 a P29.14": la primera y la última pregunta, como fichas.
.vrf_bateria_tramo <- function(vars, ctx) {
  c(.vrf_t("de "), .vrf_q(vars[1], ctx), .vrf_t(" a "), .vrf_q(vars[length(vars)], ctx))
}

#' Frase de una regla de batería
#'
#' @param info lo que arma el catálogo (`propia` es la regla guardada).
#' @param ctx contexto de redacción.
#' @return fichas de la frase (sin el filtro).
#' @keywords internal
.vrf_frase_bateria <- function(info, ctx) {
  propia <- info$propia %||% list()
  vars <- .regla_variables_efectivas(propia)
  k <- length(vars)
  p <- .regla_bateria_params(propia$params, k)
  if (k < 2L || !(p$patron %in% .REGLA_BATERIA_PATRONES) || is.na(p$minimo)) {
    .vrf_marcar_incompleta(ctx)
    return(.vrf_t(.VRF_TEXTO_ILEGIBLE))
  }
  m <- as.integer(p$minimo)
  tramo <- .vrf_bateria_tramo(vars, ctx)
  out <- switch(p$patron,
    iguales = if (m == k) {
      c(.vrf_t(sprintf("Se marca cuando las %d preguntas de la batería, ", k)), tramo,
        .vrf_t(", tienen la misma respuesta."))
    } else {
      c(.vrf_t("Se marca cuando todas las respuestas de la batería, "), tramo,
        .vrf_t(sprintf(", son iguales y hay al menos %d de %d preguntas respondidas.", m, k)))
    },
    codigo = c(.vrf_t("Se marca cuando "), .vrf_lista_valores(p$codigos, vars[1], ctx),
               .vrf_t(if (m == k) sprintf(" aparece en las %d preguntas de la batería, ", k)
                      else sprintf(" aparece en al menos %d de las %d preguntas de la batería, ", m, k)),
               tramo, .vrf_t(".")),
    vacias = if (m == k) {
      c(.vrf_t(sprintf("Se marca cuando las %d preguntas de la batería, ", k)), tramo, .vrf_t(", están vacías."))
    } else {
      c(.vrf_t(sprintf("Se marca cuando al menos %d de las %d preguntas de la batería, ", m, k)), tramo,
        .vrf_t(", están vacías."))
    }
  )
  if (identical(p$patron, "iguales") && length(p$no_cuentan)) {
    out <- c(out, .vrf_t(" "), .vrf_lista_valores(p$no_cuentan, vars[1], ctx, conector = " y "),
             .vrf_t(if (length(p$no_cuentan) == 1L) " no cuenta como respuesta." else " no cuentan como respuesta."))
  }
  if (identical(p$patron, "iguales") && p$vacias_cuentan) {
    out <- c(out, .vrf_t(" Una pregunta vacía cuenta como una respuesta más."))
  }
  out
}

# --- Enunciado del hallazgo ---------------------------------------------------

# Contexto de la batería para el enunciado de un caso, o NULL si la regla no
# es de batería.
.regla_bateria_contexto <- function(propia) {
  if (is.null(propia) || !identical(as.character(propia$tipo %||% "")[1], "bateria")) return(NULL)
  vars <- .regla_variables_efectivas(propia)
  list(vars = vars, params = propia$params %||% list())
}

#' Enunciado del caso marcado por una batería
#'
#' @param bateria contexto (`.regla_bateria_contexto()`).
#' @param valores valores del caso por pregunta.
#' @param etiquetas_valor mapa código a rótulo por pregunta.
#' @return lista con `hecho` y `choque`.
#' @keywords internal
.regla_bateria_enunciado <- function(bateria, valores, etiquetas_valor = list()) {
  vars <- as.character(bateria$vars)
  k <- length(vars)
  p <- .regla_bateria_params(bateria$params, k)
  df <- as.data.frame(stats::setNames(lapply(vars, function(v) {
    x <- valores[[v]]
    if (is.null(x) || !length(x)) NA_character_ else as.character(x)[1]
  }), vars), stringsAsFactors = FALSE, check.names = FALSE)
  med <- .regla_bateria_medir_filas(df, 1L, vars, bateria$params)
  r <- .regla_bateria_resumen(med, 1L, p$patron)
  et <- etiquetas_valor[[vars[1]]]
  hecho <- switch(p$patron,
    iguales = if (is.na(r$valor_comun)) {
      sprintf("tiene %d de las %d preguntas de la batería con la misma respuesta", r$n_contadas, k)
    } else if (!nzchar(r$valor_comun)) {
      sprintf("dejó vacías las %d preguntas de la batería", k)
    } else if (r$n_contadas == k) {
      sprintf("respondió %s en las %d preguntas de la batería", .enun_valor(r$valor_comun, et), k)
    } else {
      sprintf("respondió %s en %d de las %d preguntas de la batería", .enun_valor(r$valor_comun, et),
              r$n_contadas, k)
    },
    codigo = sprintf("respondió %s en %d de las %d preguntas de la batería",
                     paste(vapply(p$codigos, .enun_valor, character(1), etiquetas = et), collapse = " o "),
                     r$n_codigo, k),
    vacias = if (r$n_vacias == k) sprintf("dejó vacías las %d preguntas de la batería", k)
             else sprintf("dejó vacías %d de las %d preguntas de la batería", r$n_vacias, k)
  )
  list(hecho = hecho, choque = "", resumen = r)
}

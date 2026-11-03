# Indicadores por caso para la prueba de diseño (ADR 0128 §2)
# ===========================================================
#
# La prueba z de siempre trabajaba con conteos agregados: el render ya sabía cuántos marcaron cada opción en cada
# grupo. La prueba de diseño necesita saber además en qué aula está cada caso, así que tiene que bajar al caso.
#
# Bajar al caso abre la puerta a que la lámina y la prueba cuenten distinto, que es el defecto que esta feature existe
# para cerrar. Por eso este archivo NO decide nada por su cuenta: reproduce el camino de `freq_table_spss()` paso a
# paso (tipo de pregunta, tokens de la múltiple, colapso de «Otro» con texto, códigos → rótulos con los mismos
# `.map_from_attr_labels` y `.map_to_labels`) y devuelve, por cada rótulo que la tabla de frecuencias mostraría, un 1/0
# por caso. Quien lo usa compara después sus sumas contra las del render (`.sig_indicadores_cuadran`) y, si no
# cuadran, no marca esa fila.

#' Rótulo de cada código, por el mismo camino que la tabla de frecuencias
#' @keywords internal
.sig_rotulos_de_codigos <- function(codigos, var, data, orders_list, desde_atributo = TRUE) {
  if (!length(codigos)) return(character(0))
  tab <- tibble::tibble(Opciones = as.character(codigos), n = seq_along(codigos), pct = 0)
  if (isTRUE(desde_atributo)) tab <- .map_from_attr_labels(tab, var, data)
  tab <- .map_to_labels(tab, var, orders_list)
  out <- as.character(codigos)
  out[tab$n] <- as.character(tab$Opciones)
  out
}

#' Matriz casos × rótulos (1/0, NA fuera de la base) de una pregunta
#'
#' @return `list(Y, codigos, tipo, w)`: `Y` con un rótulo por columna (los mismos de `freq_table_spss()$Opciones`),
#'   `codigos` la lista de códigos de cada rótulo, `tipo` `"sm"` o `"so"` y `w` el peso de cada caso (`.peso_vec`).
#' @keywords internal
.sig_indicadores <- function(data, var, survey = NULL, sm_vars_force = NULL, orders_list = NULL) {
  if (!is.data.frame(data) || !nrow(data)) return(NULL)
  n <- nrow(data)
  w <- .peso_vec(data)
  has_main <- var %in% names(data)
  var_escaped <- gsub("([\\W])", "\\\\\\1", var)
  subvars <- c(names(data)[grepl(paste0("^", var_escaped, "/"), names(data))],
               names(data)[grepl(paste0("^", var_escaped, "\\.[^.]+$"), names(data))])
  if (!has_main && !length(subvars)) return(NULL)

  tipo <- tipo_pregunta_spss(var, survey, sm_vars_force)
  if (tipo != "sm" && length(subvars)) tipo <- "sm"
  if (tipo != "sm" && .looks_like_select_multiple_main(data, var, orders_list)) tipo <- "sm"

  if (identical(tipo, "sm") && has_main && (is.character(data[[var]]) || is.factor(data[[var]]))) {
    tokens <- lapply(split_sm_tokens(as.character(data[[var]])), function(t) unique(trimws(t[nzchar(trimws(t))])))
    en_base <- lengths(tokens) > 0
    codigos <- unique(unlist(tokens))
    marcas <- function(cods) vapply(tokens, function(t) any(t %in% cods), logical(1))
    rotulos <- .sig_rotulos_de_codigos(codigos, var, data, orders_list, desde_atributo = TRUE)
  } else if (identical(tipo, "sm")) {
    mat <- vapply(subvars, function(sv) suppressWarnings(as.numeric(as.character(data[[sv]]))) == 1, logical(n))
    if (!is.matrix(mat)) mat <- matrix(mat, nrow = n)
    mat[is.na(mat)] <- FALSE
    en_base <- rowSums(mat) > 0
    codigos <- sub(paste0("^", var_escaped, "[/\\.]"), "", subvars)
    marcas <- function(cods) rowSums(mat[, codigos %in% cods, drop = FALSE]) > 0
    rotulos <- .sig_rotulos_de_codigos(codigos, var, data, orders_list, desde_atributo = FALSE)
  } else {
    if (!has_main) return(NULL)
    op <- .freq_collapse_select_one_other_text(data[[var]], data = data, var = var, survey = survey,
                                               orders_list = orders_list)
    op <- as.character(op)
    en_base <- !is.na(op) & nzchar(op) & op != "NA"
    codigos <- unique(op[en_base])
    marcas <- function(cods) !is.na(op) & op %in% cods
    rotulos <- .sig_rotulos_de_codigos(codigos, var, data, orders_list, desde_atributo = TRUE)
  }

  etiquetas <- unique(rotulos)
  Y <- matrix(NA_real_, nrow = n, ncol = length(etiquetas), dimnames = list(NULL, etiquetas))
  cods_por_rotulo <- list()
  for (lab in etiquetas) {
    cods <- codigos[rotulos == lab]
    cods_por_rotulo[[lab]] <- cods
    Y[en_base, lab] <- as.numeric(marcas(cods))[en_base]
  }
  list(Y = Y, codigos = cods_por_rotulo, tipo = tipo, w = w, en_base = en_base)
}

#' Agrega filas derivadas (p. ej., el *top two box*) como la unión de varios rótulos
#' @keywords internal
.sig_indicadores_derivar <- function(ind, nombre, rotulos) {
  if (is.null(ind) || !length(rotulos)) return(ind)
  cols <- intersect(as.character(rotulos), colnames(ind$Y))
  if (!length(cols)) return(ind)
  y <- ifelse(ind$en_base, as.numeric(rowSums(ind$Y[, cols, drop = FALSE] == 1, na.rm = TRUE) > 0), NA_real_)
  ind$Y <- cbind(ind$Y, y)
  colnames(ind$Y)[ncol(ind$Y)] <- nombre
  ind$codigos[[nombre]] <- unlist(ind$codigos[cols], use.names = FALSE)
  ind
}

#' ¿Las sumas por grupo de los indicadores son las del render?
#'
#' `n_render` es la matriz filas × grupos de conteos (ponderados) que dibujó el gráfico. Devuelve un lógico por fila:
#' TRUE si la prueba cuenta lo mismo que la lámina. Una fila que no cuadra no se marca: una letra calculada sobre otros
#' casos que los del gráfico sería una afirmación sobre otro gráfico.
#' @keywords internal
.sig_indicadores_cuadran <- function(Y, w, g, grupos, n_render, tol = 1e-6) {
  filas <- rownames(n_render)
  out <- stats::setNames(rep(FALSE, length(filas)), filas)
  for (f in filas) {
    if (!f %in% colnames(Y)) next
    y <- Y[, f]
    suma <- vapply(grupos, function(gr) sum(w[!is.na(y) & !is.na(g) & g == gr] * y[!is.na(y) & !is.na(g) & g == gr]),
                   numeric(1))
    ref <- suppressWarnings(as.numeric(n_render[f, ]))
    out[[f]] <- length(ref) == length(suma) && all(abs(suma - ref) <= tol * pmax(1, abs(ref)))
  }
  out
}

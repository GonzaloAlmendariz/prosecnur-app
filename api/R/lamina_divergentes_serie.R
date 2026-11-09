# =============================================================================
# lamina_divergentes_serie.R — dos láminas que se continúan comparten geometría (S6)
# =============================================================================
#
# Gonzalo, 2026-11-09, sobre «Preguntas con menos de 60 %» (22 filas): «esto puede ir en dos diapos para que se vea más
# uniforme». Con `hasta` en la primera (1 a 11) y `continuar_desde` en la segunda (12 a 22), cada lámina elegía su
# columna, su paso y su escala con sus filas, y las dos no se leían como una serie. Ahora la geometría se elige sobre
# todas las filas que elige la regla (`espec$serie`): la columna de rótulos y su letra (`.lam_rotulos_columna`, sobre los
# rótulos de la serie), el hueco entre filas (el menor de las ventanas de la serie) y la escala de las barras (el lado
# más largo de la serie y su mayor «Sin información»). Sólo con regla: sin regla la escala no sabe qué filas son la serie.

#' La serie de la escala en su especificación: rótulos, lados de la escala y mayor «Sin información» de todas las filas
#' @param vars_serie Refs de todas las filas que elige la regla, por tema (`.regla_preguntas_aplicar_render`).
#' @param args Args del graficador de la lámina. @param args_tabla Args de la tabla de la escala.
#' @keywords internal
.divergentes_serie_en_espec <- function(p, el, vars_serie, args, args_tabla) {
  espec <- attr(p, "pulso_espec", exact = TRUE)
  if (!is.list(espec) || (is.null(el$continuar_desde) && is.null(el$hasta)) || is.null(el$regla)) return(p)
  vs <- unname(unlist(vars_serie))
  if (length(vs) <= length(espec$filas)) return(p)
  es <- tryCatch({
    t2 <- .ola4_tabla_escala_tolerante(vs, args_tabla$filtros, excluir_opciones = args_tabla$excluir_opciones, n_negativas = args_tabla$n_negativas,
                                       incluir_neutro = args_tabla$incluir_neutro, direccion_escala = args_tabla$direccion_escala,
                                       firma_leyenda = args_tabla$firma_leyenda)
    refs <- t2$data$categoria
    t2$data$categoria <- .divergentes_rotulos_publicos(.ola4_rotulos_preguntas(vs, refs), refs, el$abreviaturas)
    a2 <- args; a2$data <- t2$data; a2$cols_porcentaje <- t2$cols_porcentaje; a2$etiquetas_grupos <- t2$etiquetas_grupos
    a2$codigos_grupos <- t2$codigos_grupos; a2$reparto <- t2$reparto
    attr(suppressMessages(do.call(graficar_barras_divergentes, a2)), "pulso_espec")
  }, error = function(e) NULL)
  if (!is.list(es) || !length(es$filas)) return(p)
  espec$serie <- c(list(filas = es$filas), .lam_div_lados(es))
  attr(p, "pulso_espec") <- espec
  p
}

#' Lados de la escala (lo que ocupa el desacuerdo, el acuerdo) y la mayor «Sin información» de una especificación
#' @keywords internal
.lam_div_lados <- function(espec) {
  C <- espec$categorias; U <- espec$unidades
  neu <- which(C$lado == "neu"); mitades <- if (length(neu)) rowSums(U[, neu, drop = FALSE]) / 2 else rep(0, nrow(U))
  neg <- espec$orden_neg %||% rev(which(C$lado == "neg")); pos <- espec$orden_pos %||% which(C$lado == "pos"); si <- which(C$lado == "sin_inf")
  list(izq = max(rowSums(U[, neg, drop = FALSE]) + mitades, 1), der = max(rowSums(U[, pos, drop = FALSE]) + mitades, 1),
       max_si = if (length(si)) max(1, max(U[, si[1]])) else 1)
}

#' En una serie, el hueco entre filas es el menor de las ventanas de la serie del tamaño de la lámina (S6)
#'
#' Con la columna y la letra comunes, cada ventana de `m` filas seguidas de la serie (m = las filas de la lámina) pide su
#' hueco; las dos láminas toman el menor, así que sus filas van al mismo paso.
#' @param w,size Columna y letra elegidas. @param disponible,hueco_min,hueco_max Los de la lámina.
#' @keywords internal
.lam_div_serie_hueco <- function(espec, hu, texto_h, w = NULL, size = NULL, disponible = NULL, hueco_min = 0.04, hueco_max = Inf) {
  filas <- espec$serie$filas
  m <- length(texto_h)
  if (!length(filas) || is.null(w) || is.null(disponible) || length(filas) < m) return(hu)
  th <- vapply(filas, .lam_rotulo_lineas, 0L, w = w, size = size) * size * 1.2 / 72
  libres <- vapply(seq_len(length(filas) - m + 1L), function(i) (disponible - sum(th[i:(i + m - 1L)])) / m, 0)
  hueco <- max(hueco_min, min(hueco_max, min(libres)))
  if (sum(texto_h) + m * hueco > disponible + 1e-9) return(hu)
  list(alturas = texto_h + hueco, hueco = hueco)
}

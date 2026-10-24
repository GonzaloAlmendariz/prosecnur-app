# graficos_no_sustantivos.R — las respuestas que no son parte de la escala, en gris y al final
#
# CCSS Perfil 2026: en las multiapiladas C1 (1-5 + 9 «No tengo información suficiente para responder») y B12 (1-5 + 77
# «No lo sé / No uso este recurso») el no sustantivo recibía el último paso de una rampa de seis, el verde más intenso,
# y se leía como «Totalmente de acuerdo». Los rótulos no casaban con `.DIVERGENTES_ESPECIAL` y la paleta se decidía sólo
# por rótulo: el código, que sí lo dice (9 o 77 fuera de una escala 1-5), ya se había perdido.
#
# Modelo: «SIN INF» en el mazo de Arte — gris (`likert[5]`), último segmento, con su entrada en la leyenda, y la escala
# con su propia rampa. Esto sólo decide COLOR y LUGAR: las cifras, la base y el Top Two Box no cambian (si el no
# sustantivo sale o no del denominador del T2B es la decisión D13, abierta).
#
# Detección, en este orden:
#   (a) metadata del instrumento: una columna de `choices` que marca la opción como especial;
#   (b) código fuera del rango de la escala (la corrida consecutiva más larga de códigos enteros de la lista);
#   (c) el rótulo (`.CATEGORIAS_RESIDUALES`, `.DIVERGENTES_ESPECIAL` y los «no lo sé / no tengo información»).
# Un código DENTRO del rango nunca es no sustantivo.

.NO_SUSTANTIVOS_ROTULO_EXTRA <- "^(no tengo informaci|no lo s[eé]|no s[eé]\\b|no uso|no utilic|no conozco|desconozco|no aplica|sin informaci|ns ?/ ?n[rco])"
.NO_SUSTANTIVOS_COLS_META <- c("especial", "no_sustantivo", "valor_especial", "special", "es_especial")

#' Códigos que la metadata del instrumento marca como especiales en una lista (regla a)
#'
#' Lee una columna de `choices` (`especial`, `no_sustantivo`, …) con un valor verdadero (1, true, sí, x).
#' @return Códigos marcados; `character(0)` si la lista no trae esa metadata.
#' @keywords internal
.graficos_no_sustantivos_especiales_meta <- function(list_name, choices) {
  if (!is.data.frame(choices) || !all(c("list_name", "name") %in% names(choices))) return(character(0))
  col <- intersect(.NO_SUSTANTIVOS_COLS_META, names(choices))
  if (!length(col)) return(character(0))
  sub <- choices[trimws(as.character(choices$list_name)) == trimws(as.character(list_name %||% "")[1]), , drop = FALSE]
  if (!nrow(sub)) return(character(0))
  v <- tolower(trimws(as.character(sub[[col[1]]])))
  marcado <- !is.na(v) & v %in% c("1", "true", "t", "si", "sí", "yes", "x", "especial")
  trimws(as.character(sub$name[marcado]))
}

#' Rango de la escala: la corrida consecutiva más larga de códigos enteros (al menos dos); `NULL` si no hay
#' @keywords internal
.graficos_no_sustantivos_rango <- function(codigos) {
  v <- suppressWarnings(as.numeric(codigos))
  v <- sort(unique(v[is.finite(v) & v == round(v)]))
  if (length(v) < 2L) return(NULL)
  corte <- cumsum(c(1L, diff(v) != 1))
  largo <- tabulate(corte)
  mejor <- which.max(largo)   # empate: la primera (la de códigos menores)
  if (largo[mejor] < 2L) return(NULL)
  range(v[corte == mejor])
}

#' ¿Qué categorías no son sustantivas?
#'
#' @param codigos Códigos de las categorías a decidir (alineados con `etiquetas`).
#' @param etiquetas Rótulos de esas categorías.
#' @param codigos_lista Todos los códigos de la lista (para el rango); por defecto `codigos`.
#' @param especiales Códigos que la metadata del instrumento declara especiales (regla a).
#' @return Lógico alineado con `codigos`.
#' @keywords internal
.graficos_no_sustantivos <- function(codigos, etiquetas, codigos_lista = codigos, especiales = character(0)) {
  codigos <- trimws(as.character(codigos)); etiquetas <- trimws(as.character(etiquetas))
  especiales <- trimws(as.character(especiales %||% character(0)))
  meta <- codigos %in% especiales
  # El rango se mide sin los que la metadata ya declaró: un 9 marcado especial no alarga una escala 1-8.
  rango <- .graficos_no_sustantivos_rango(setdiff(trimws(as.character(codigos_lista)), especiales))
  v <- suppressWarnings(as.numeric(codigos))
  dentro <- if (is.null(rango)) rep(FALSE, length(codigos)) else (is.finite(v) & v >= rango[1] & v <= rango[2])
  fuera <- if (is.null(rango)) rep(FALSE, length(codigos)) else (is.finite(v) & !dentro)
  norm <- tolower(.box_norm_etiqueta(etiquetas))
  rotulo <- grepl(.CATEGORIAS_RESIDUALES, etiquetas, ignore.case = TRUE) |
    grepl(.DIVERGENTES_ESPECIAL, etiquetas, ignore.case = TRUE) |
    grepl(.NO_SUSTANTIVOS_ROTULO_EXTRA, norm, perl = TRUE)
  (meta | fuera | rotulo) & !(dentro & !meta)
}

#' Código y rótulo de cada nivel (los niveles pueden llegar como códigos o como rótulos)
#' @keywords internal
.graficos_no_sustantivos_niveles <- function(list_name, levels, choices) {
  cl <- .reporte_plan_choice_levels_for_list(list_name, choices)
  levels <- trimws(as.character(levels))
  i <- match(levels, cl$code); j <- match(levels, cl$label); i[is.na(i)] <- j[is.na(i)]
  list(codigo = ifelse(is.na(i), levels, cl$code[i]), etiqueta = ifelse(is.na(i), levels, cl$label[i]),
       lista = cl$code, especiales = .graficos_no_sustantivos_especiales_meta(list_name, choices))
}

#' Lógico por nivel: ¿es no sustantivo?
#' @keywords internal
.graficos_no_sustantivos_de_niveles <- function(list_name, levels, choices) {
  nv <- .graficos_no_sustantivos_niveles(list_name, levels, choices)
  .graficos_no_sustantivos(nv$codigo, nv$etiqueta, codigos_lista = if (length(nv$lista)) nv$lista else nv$codigo,
                           especiales = nv$especiales)
}

#' Los niveles de una escala con los no sustantivos al final (el resto conserva su orden)
#' @keywords internal
.graficos_no_sustantivos_al_final <- function(levels, list_name, choices) {
  if (!length(levels)) return(levels)
  ns <- .graficos_no_sustantivos_de_niveles(list_name, levels, choices)
  c(levels[!ns], levels[ns])
}

#' Paleta de la escala por defecto (sin paleta del usuario), con los no sustantivos en gris
#'
#' La escala se colorea sin ellos (`.reporte_plan_pulso_palette_for_levels` sobre los sustantivos: la rampa de cinco
#' pasos de una 1-5) y el no sustantivo toma el gris de «SIN INF» (`likert[5]`). Sin no sustantivos devuelve
#' exactamente la paleta de antes.
#' @return Vector con nombres = rótulos de los niveles, en su orden.
#' @keywords internal
.graficos_no_sustantivos_paleta <- function(list_name, levels, choices) {
  etiquetas <- .reporte_plan_labels_for_levels(list_name, levels, choices_use = choices)
  ns <- .graficos_no_sustantivos_de_niveles(list_name, levels, choices)
  if (!any(ns) || all(ns)) return(.reporte_plan_pulso_palette_for_levels(etiquetas))
  escala <- .reporte_plan_pulso_palette_for_levels(etiquetas[!ns])
  out <- stats::setNames(character(length(etiquetas)), etiquetas)
  out[!ns] <- unname(escala)
  out[ns] <- unname(.std_paleta("likert"))[5]
  out
}

# =============================================================================
# graficos_dumbbell_tres_grupos.R — el dumbbell con tres o cuatro grupos o públicos
# =============================================================================
#
# Gonzalo, 2026-11-09, sobre el resumen de Arte y Diseño (aperturas por ciclo, tres grupos): con tres o cuatro grupos cada
# pregunta lleva una fila por grupo, cada una con su forma y su color, una línea fina desde el eje hasta el punto y la cifra
# al lado; la "Diferencia" es el mayor menos el menor, sin signo; la leyenda va arriba con el n de cada grupo; y la base de
# cada grupo va en la nota de la base, abajo a la izquierda ("la columna de base la tiene a la derecha cuando tranquilamente
# puede ir en la nota de la base en la esquina inferior"). Con dos grupos sigue el dumbbell clásico, con la diferencia con
# signo. El dibujo de las sub-filas y la nota de la base ya los tenía el contraste (graficos_espec_contraste.R,
# lamina_contraste.R, lamina_resumen_ranura.R); aquí está lo que faltaba para llegar a él:
#   - la leyenda con el n de cada grupo, opción del analista "N en la leyenda" (`leyenda_con_n`): sin declarar, con tres o
#     cuatro grupos va y con dos, como el dumbbell de siempre (`.contraste_leyenda_con_n`, `.dumbbell_leyenda_recetario`);
#   - el dumbbell entre públicos acepta de dos a cuatro bases: el analista elige cuáles (`bases` o las refs de cada tema);
#     sin elegir, con más de dos bases en el estudio, el motor sigue pidiendo que se elijan;
#   - el dumbbell del recetario no dibuja tres grupos (su segmento sería un rango): con tres o cuatro se dibuja como el
#     contraste (`.dumbbell_estilo_por_grupos`).

.DUMBBELL_GRUPOS_MAX <- 4L

#' Leyenda del contraste: cada grupo con su n ("2do ciclo (139)") si el analista lo pide (`leyenda_con_n`); sin declarar,
#' con tres o cuatro grupos sí y con dos no
#'
#' El n es el mayor de sus casos sin ponderar entre las preguntas (si la base cambia de pregunta en pregunta, la nota de la
#' base da su rango). Sin casos enteros (sólo suma de pesos) no se escribe y, si se pidió, la lámina lo dice.
#' @param N Matriz de casos (pregunta x grupo).
#' @param leyenda_con_n `TRUE`, `FALSE` o `NULL` (no opina).
#' @keywords internal
.contraste_leyenda_con_n <- function(grupos, N, leyenda_con_n = NULL) {
  k <- length(grupos)
  con_n <- if (is.null(leyenda_con_n) || is.na(leyenda_con_n[1])) k >= 3L else isTRUE(as.logical(leyenda_con_n[1]))
  if (!con_n) return(grupos)
  n <- if (is.matrix(N) && ncol(N) == k) apply(N, 2, function(v) if (any(is.finite(v))) max(v[is.finite(v)]) else NA_real_) else rep(NA_real_, k)
  if (isTRUE(leyenda_con_n) && !all(is.finite(n))) .dumbbell_leyenda_sin_n_aviso()
  ifelse(is.finite(n), sprintf("%s (%s)", grupos, vapply(n, .dumbbell_fmt_casos, "")), grupos)
}

#' Leyenda del dumbbell del recetario con "N en la leyenda" declarado: `TRUE` escribe el n de cada grupo (el mayor de sus
#' filas si cambia), `FALSE` sólo el nombre, `NULL` deja la leyenda de siempre (n sólo si la base del grupo no cambia)
#' @param col_casos Columna de casos sin ponderar (`.dumbbell_col_casos`) o `NULL` si sólo hay suma de pesos.
#' @keywords internal
.dumbbell_leyenda_recetario <- function(etiquetas, grupos, data, var_grupo, col_casos, leyenda_con_n = NULL) {
  if (is.null(leyenda_con_n) || is.na(leyenda_con_n[1])) return(etiquetas)
  if (!isTRUE(as.logical(leyenda_con_n[1]))) return(grupos)
  if (is.null(col_casos)) { .dumbbell_leyenda_sin_n_aviso(); return(grupos) }
  n <- vapply(grupos, function(g) {
    v <- suppressWarnings(as.numeric(data[[col_casos]][as.character(data[[var_grupo]]) == g])); v <- v[is.finite(v)]
    if (length(v)) max(v) else NA_real_
  }, numeric(1))
  if (!all(is.finite(n))) .dumbbell_leyenda_sin_n_aviso()
  unname(ifelse(is.finite(n), sprintf("%s (%s)", grupos, .dumbbell_fmt_casos(n)), grupos))
}

#' Aviso cuando se pidió el N en la leyenda y no hay casos enteros que escribir
#' @keywords internal
.dumbbell_leyenda_sin_n_aviso <- function() {
  .pulso_aviso(.aviso_en_lamina(paste0("La leyenda va sin N: los grupos sólo traen la suma de los pesos, no casos sin ponderar ",
                                       "que se puedan escribir.")))
}

#' Estilo con que se dibuja el dumbbell: el declarado; con tres o cuatro grupos, el del contraste
#'
#' El recetario (láminas 85 y 86) compara dos: con tres, el segmento dejaría de ser una brecha. Los grupos que se comparan
#' los eligió el analista; el motor sólo escoge el dibujo que los muestra.
#' @param args Args de `graficar_dumbbell` (con `data`, `var_grupo` y quizá `estilo`).
#' @return `args`, con `estilo = "resumen"` si hay de tres a cuatro grupos.
#' @keywords internal
.dumbbell_estilo_por_grupos <- function(args) {
  d <- args$data; col <- args$var_grupo %||% "grupo"
  if (!is.data.frame(d) || !col %in% names(d)) return(args)
  g <- as.character(d[[col]]); k <- length(unique(g[!is.na(g) & nzchar(g)]))
  if (k >= 3L && k <= .DUMBBELL_GRUPOS_MAX && !identical(args$estilo, "resumen")) args$estilo <- "resumen"
  args
}

#' ¿El contraste va nativo en una lámina de un gráfico? Si no cabe, sale como imagen (ADR 0134, punto 5) y se dice por qué
#'
#' Cuatro grupos por siete preguntas son 32 sub-filas y la lámina admite unas 27: la imagen muestra todas las preguntas
#' que eligió el analista, y el aviso le dice cómo volver a la lámina nativa.
#' @keywords internal
.lam_contraste_cabe_avisa <- function(espec) {
  ok <- isTRUE(.lam_contraste_cabe(espec))
  if (!ok && is.list(espec) && length(espec$rotulos)) {
    k <- length(espec$grupos); n <- length(espec$rotulos)
    .pulso_aviso(.aviso_en_lamina(sprintf(paste0("El contraste de %d preguntas y %d grupos no cabe en la lámina con piezas nativas y sale ",
                                                 "como imagen; para verlo nativo, elige menos preguntas o nombres más cortos."), n, k)))
  }
  ok
}

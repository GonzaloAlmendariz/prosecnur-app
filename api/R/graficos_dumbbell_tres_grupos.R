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
#   - la leyenda con el n de cada grupo cuando son tres o cuatro (`.contraste_leyenda_con_n`);
#   - el dumbbell entre públicos acepta de dos a cuatro bases: el analista elige cuáles (`bases` o las refs de cada tema);
#     sin elegir, con más de dos bases en el estudio, el motor sigue pidiendo que se elijan;
#   - el dumbbell del recetario no dibuja tres grupos (su segmento sería un rango): con tres o cuatro se dibuja como el
#     contraste (`.dumbbell_estilo_por_grupos`).

.DUMBBELL_GRUPOS_MAX <- 4L

#' Leyenda del contraste: con tres o cuatro grupos, cada grupo con su n ("2do ciclo (139)"); con dos, sólo el nombre
#'
#' El n es el mayor de sus casos sin ponderar entre las preguntas (si la base cambia de pregunta en pregunta, la nota de la
#' base da su rango).
#' @param N Matriz de casos (pregunta x grupo).
#' @keywords internal
.contraste_leyenda_con_n <- function(grupos, N) {
  k <- length(grupos)
  if (k < 3L || !is.matrix(N) || ncol(N) != k) return(grupos)
  n <- apply(N, 2, function(v) if (any(is.finite(v))) max(v[is.finite(v)]) else NA_real_)
  ifelse(is.finite(n), sprintf("%s (%s)", grupos, vapply(n, .dumbbell_fmt_casos, "")), grupos)
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

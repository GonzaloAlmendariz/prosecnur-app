# graficos_divergentes_direccion.R — la dirección declarada de una divergente que contradice su escala se avisa
#
# Ola 2, E1a (decisión del lead, 2026-11-08): con `direccion_escala` declarada al revés del sentido que se lee de los
# extremos de la escala (`.escala_arm_sentido()`), el motor respeta lo declarado —la inversión de la QA fue declarada, no
# un error— pero lo dice con nombre, para que el analista lo vea antes de entregar. Sólo avisa; no corrige.

.DIVERGENTES_DIRECCION_TXT <- c(negativo_positivo = "de negativo a positivo", positivo_negativo = "de positivo a negativo")

#' Avisa si la dirección declarada contradice el sentido de la escala
#' @param ref Pregunta de la escala. @param sustantivas Opciones sustantivas en el orden de la escala.
#' @param direccion Dirección declarada.
#' @return `TRUE` si avisó (invisible).
#' @keywords internal
.divergentes_avisar_direccion <- function(ref, sustantivas, direccion) {
  sentido <- tryCatch(.escala_arm_sentido(as.character(sustantivas)), error = function(e) NA_character_)
  if (is.na(sentido) || identical(sentido, direccion) || !direccion %in% names(.DIVERGENTES_DIRECCION_TXT)) return(invisible(FALSE))
  k <- length(sustantivas)
  .pulso_aviso(sprintf(
    "\"%s\": la dirección declarada de la escala (%s) contradice el sentido de sus extremos («%s» … «%s», %s); se dibuja como se declaró.",
    ref, .DIVERGENTES_DIRECCION_TXT[[direccion]], sustantivas[1], sustantivas[k], .DIVERGENTES_DIRECCION_TXT[[sentido]]))
  invisible(TRUE)
}

#' Orden de apilado de una divergente: del centro hacia afuera en cada lado, en cualquier dirección de la escala
#'
#' `geom_col` deja más lejos del cero el valor de orden menor. La distancia al centro se mide sobre la posición de cada
#' categoría en `cols`, con el centro entre el último nivel de un polo y el primero del otro (como la especificación,
#' graficos_espec_divergentes.R). El desempate por lado mantiene únicos los grupos.
#' @param cat Categoría de cada fila. @param lado `neg`, `pos`, `neu`, `neu2` o `sin_inf`. @param cols Orden de la escala.
#' @keywords internal
.divergentes_orden_apilado <- function(cat, lado, signo, cols) {
  idx <- match(as.character(cat), cols)
  ineg <- unique(idx[lado == "neg"]); ipos <- unique(idx[lado == "pos"]); ineu <- unique(idx[lado %in% c("neu", "neu2")])
  if (!length(ineg) || !length(ipos)) return(ifelse(signo < 0, idx, -idx))
  centro <- if (max(ineg) < min(ipos)) mean(c(max(ineg), min(ipos), ineu)) else mean(c(min(ineg), max(ipos), ineu))
  -round(abs(idx - centro) * 100) + ifelse(signo < 0, 0, 0.5)
}

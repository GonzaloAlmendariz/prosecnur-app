# =============================================================================
# graficos_dumbbell_auto.R — el contraste entre públicos arma sus temas solo (ADR 0135, punto 5)
# =============================================================================
#
# Prueba con Arte: un contraste «Docentes y estudiantes» sin preguntas elegidas caía a un gráfico vacío y el conteo
# respondía un 400 con un nombre interno. Ahora `p_dumbbell()` acepta, en vez de `vars`:
#   - `bases = c(A, B)`: los temas son los pares de A y B con el mismo nombre y la misma firma de escala
#     (`.regla_preguntas_pares_por_nombre`, lo mismo que `vars = list(T = c("A$*", "B$*"))`);
#   - nada, con una regla: el render toma las dos bases del estudio; con tres o más, pide elegir el par.
# Sin `vars` ni `bases` y sin regla, el borrador sigue siendo un gráfico vacío (`.dumbbell_borrador_sin_temas`).
# Sin regla, unas `bases` declaradas implican la regla `comunes` (la lámina de resumen de todos los pares).
# Aperturas internas (prueba con Arte, 2026-11-07): con `cruce` y una regla, sin `vars`, los temas son las preguntas de
# escala de la base del cruce (`base$*`), sin la propia pregunta del cruce. Sin regla, el borrador sigue vacío.

.DUMBBELL_AUTO_TEMA <- "Preguntas comunes"
.DUMBBELL_MSG_PAR <- "El contraste compara dos públicos: elige cuáles."

#' ¿`vars` viene vacío? (NULL, lista vacía o sólo cadenas en blanco)
#' @keywords internal
.dumbbell_sin_temas <- function(vars) {
  v <- trimws(as.character(unlist(vars %||% list(), use.names = FALSE)))
  !length(v[!is.na(v) & nzchar(v)])
}

#' Las dos bases del contraste declaradas en `bases`; `NULL` si no se declaran
#' @keywords internal
.dumbbell_bases_contraste <- function(bases) {
  b <- trimws(as.character(unlist(bases %||% character(0), use.names = FALSE)))
  b <- unique(b[!is.na(b) & nzchar(b)])
  if (!length(b)) return(NULL)
  if (length(b) != 2L) .regla_preguntas_falla(.DUMBBELL_MSG_PAR, list(bases = as.list(b)))
  b
}

#' Los temas de un par de bases: un tema `base$*` que la regla empareja por nombre y firma
#' @keywords internal
.dumbbell_vars_de_bases <- function(bases) stats::setNames(list(paste0(bases, "$*")), .DUMBBELL_AUTO_TEMA)

#' Los temas cuando el elemento no los trae: el par declarado o, si el estudio tiene dos bases, esas dos
#' @keywords internal
.dumbbell_vars_desde_fuentes <- function(el, sources) {
  b <- .dumbbell_bases_contraste(el$bases)
  if (is.null(b)) {
    todas <- names(sources$data_sources %||% list())
    if (length(todas) != 2L) .regla_preguntas_falla(.DUMBBELL_MSG_PAR, list(bases = as.list(todas)))
    b <- todas
  }
  .dumbbell_vars_de_bases(b)
}

#' Los temas de las aperturas internas cuando no se eligen: todas las preguntas de la base del cruce (`base$*`)
#'
#' El cruce se declara `base$variable` (`.dumbbell_grupos_datos` no resuelve uno sin base); sin base queda `$*` y el
#' conteo lo reporta como pregunta fuera, sin caer en la primera base.
#' @keywords internal
.dumbbell_vars_de_cruce <- function(cruce) {
  list(paste0(.graficos_ref_parts(trimws(as.character(cruce)[1]))$source, "$*"))
}

#' Un `vars: []` que la UI serializa junto a una regla no es una ref faltante: el contraste arma sus temas solo (desde
#' `bases`, el cruce o las dos bases del estudio). Se quita antes del chequeo de refs del rearmado.
#' @keywords internal
.dumbbell_quitar_vars_vacias <- function(args, graficador_name) {
  if (!identical(as.character(graficador_name %||% "")[1], "p_dumbbell") || !is.list(args) || is.null(args$vars)) return(args)
  if (!.dumbbell_sin_temas(args$vars)) return(args)
  if (is.null(tryCatch(.regla_preguntas_normalizar(args$regla), error = function(e) NULL))) return(args)
  args$vars <- NULL
  args
}

#' Un borrador de contraste sin temas, sin bases y sin regla se dibuja vacío (como antes de `bases`), tenga o no
#' `cruce`: la lámina pide elegir las preguntas en vez de abortar el preview
#' @keywords internal
.dumbbell_borrador_sin_temas <- function(args, graficador_name) {
  if (!identical(as.character(graficador_name %||% "")[1], "p_dumbbell")) return(FALSE)
  vacio <- function(x) .dumbbell_sin_temas(x)
  vacio(args$vars) && vacio(args$bases) && is.null(tryCatch(.regla_preguntas_normalizar(args$regla), error = function(e) NULL))
}

#' El mensaje para el inspector cuando el gráfico aún no se puede contar (nunca el nombre interno del elemento)
#' @keywords internal
.regla_preguntas_falta_dato <- function(graficador, args) {
  if (graficador %in% c("p_panorama", "p_dumbbell", "p_fortalezas") && !length(.radar_mb_codigos(args$corte))) {
    .regla_preguntas_falla("Falta el indicador: elige qué respuestas cuentan.")
  }
  .regla_preguntas_falla("Faltan datos del gráfico: elige sus preguntas.")
}

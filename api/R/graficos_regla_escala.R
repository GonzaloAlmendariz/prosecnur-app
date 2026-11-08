# =============================================================================
# graficos_regla_escala.R — qué es una pregunta de escala para una lámina de resumen (ADR 0135, punto 5)
# =============================================================================
#
# Una `select_one` con el corte y cuatro o más opciones sustantivas no basta: en Arte entraban «Rangos de edad»,
# «Mayor grado académico» y «Categoría académica» (3, 2 y 1 por público). Es de escala la pregunta cuya lista
# (firma de opciones, `.equiv_firma_escala`) comparten al menos tres preguntas de su base —una batería— o cuya lista el
# estudio declara ordinal en Analítica (override explícito `listas_ordinales[lista] = TRUE`; la auto-detección no
# cuenta, porque unos rangos de edad son ordinales y no son una escala de opinión). Una lista declarada nominal no es
# de escala aunque forme batería.
#
# Las declaraciones viajan en el instrumento (el render no tiene sesión): `.graficos_apply_orden_categorias_sources`
# estampa `inst$listas_ordinales_declaradas` y `inst$listas_nominales`.

.REGLA_ESCALA_BATERIA_MIN <- 3L

#' Lista de opciones de cada fila del instrumento (la columna `list_name` o la pegada en `type`)
#' @keywords internal
.regla_escala_listas_filas <- function(sv) {
  tipo <- trimws(as.character(sv$type %||% rep("", nrow(sv)))); tipo[is.na(tipo)] <- ""
  lista <- if ("list_name" %in% names(sv)) trimws(as.character(sv$list_name)) else rep("", nrow(sv))
  lista[is.na(lista)] <- ""
  pegada <- sub("^select_(?:one|multiple)\\s+(\\S+).*$", "\\1", tipo, perl = TRUE)
  pegada[pegada == tipo] <- ""
  ifelse(nzchar(lista), lista, pegada)
}

#' Cuántas preguntas `select_one` de la base comparten cada firma de opciones
#'
#' Una variable y su `_recod` cuentan una vez. La firma se calcula una vez por lista.
#' @return Entero con nombres = firma.
#' @keywords internal
.regla_escala_baterias <- function(inst) {
  sv <- (inst %||% list())$survey
  vacio <- stats::setNames(integer(0), character(0))
  if (!is.data.frame(sv) || !nrow(sv) || !"name" %in% names(sv)) return(vacio)
  tipo <- trimws(as.character(sv$type %||% "")); tipo[is.na(tipo)] <- ""
  es_uno <- grepl("^select_one(?:\\s|$)", tipo, perl = TRUE)
  if (!any(es_uno)) return(vacio)
  nombres <- sub("_recod$", "", as.character(sv$name)[es_uno])
  listas <- .regla_escala_listas_filas(sv)[es_uno]
  keep <- !is.na(nombres) & nzchar(nombres) & nzchar(listas) & !duplicated(nombres)
  nombres <- nombres[keep]; listas <- listas[keep]
  if (!length(nombres)) return(vacio)
  rep_var <- nombres[!duplicated(listas)]
  firma_lista <- stats::setNames(vapply(rep_var, function(v) .equiv_firma_escala(inst, v), character(1)), listas[!duplicated(listas)])
  firmas <- unname(firma_lista[listas])
  firmas <- firmas[!is.na(firmas) & nzchar(firmas)]
  tab <- table(firmas)
  stats::setNames(as.integer(tab), names(tab))
}

#' ¿La lista de la pregunta forma batería o la declara ordinal el estudio? (y no la declara nominal)
#'
#' @param baterias Resultado de `.regla_escala_baterias(inst)`; se calcula si no llega (pásalo al recorrer una base).
#' @keywords internal
.regla_escala_por_lista <- function(inst, var, baterias = NULL) {
  lista <- .equiv_lista_de(inst, var)$lista
  nominales <- as.character(unlist((inst %||% list())$listas_nominales %||% character(0)))
  if (nzchar(lista) && lista %in% nominales) return(FALSE)
  declaradas <- as.character(unlist((inst %||% list())$listas_ordinales_declaradas %||% character(0)))
  if (nzchar(lista) && lista %in% declaradas) return(TRUE)
  baterias <- baterias %||% .regla_escala_baterias(inst)
  firma <- .equiv_firma_escala(inst, var)
  n <- if (nzchar(firma) && firma %in% names(baterias)) baterias[[firma]] else 0L
  n >= .REGLA_ESCALA_BATERIA_MIN
}

#' ¿Es la `_recod` de una pregunta presente? Una variable y su `_recod` son la misma pregunta y cuentan una vez
#'
#' Criterio único de la regla de preguntas (`.regla_preguntas_de_base`) y del inventario (graficos_inventario.R): se
#' queda la original, que el render redirige a la recodificada (`.reporte_plan_resolve_recod_var`). Una `_recod` sin su
#' original sí cuenta.
#' @param nombres Nombres de variable.
#' @param presentes Las variables contra las que se busca la original (por defecto, las mismas).
#' @return Lógico del largo de `nombres`: `TRUE` = es una `_recod` repetida.
#' @keywords internal
.regla_es_recod_repetida <- function(nombres, presentes = nombres) {
  nombres <- as.character(nombres); nombres[is.na(nombres)] <- ""
  grepl("_recod$", nombres) & sub("_recod$", "", nombres) %in% as.character(presentes)
}

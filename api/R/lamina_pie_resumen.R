# =============================================================================
# lamina_pie_resumen.R — el pie de las láminas de resumen lleva sólo la base, como el resto del informe
# =============================================================================
#
# Gonzalo, 2026-11-09: «en las notas no sé por qué no pueden ir las notas de base simples que ya usamos en el resto del
# informe». El pie de la escala, el contraste, las aperturas, el panorama, las fortalezas y la cobertura por categorías
# decía la base, el denominador, cómo se eligieron las preguntas, cuántas no cabían y quién menos quién. El informe de
# Arte (Informe PPT Arte 2026_FINAL_v4) sólo dice «Base: 115 docentes y 279 estudiantes»; tampoco imprime «Grupo chico»
# en ninguna lámina, así que esa nota también va al analista.
#
# Regla: al pie va la base de la lámina (y la base por grupo cuando difieren, como hasta ahora); lo demás —la frase de la
# regla y del tope, el denominador, «Diferencia: …», «Grupo chico: …», «Cada marca es una pregunta…»— va como aviso al
# analista. El analista puede escribir su nota en el campo «pie» de la lámina.

#' Pie de una lámina de resumen: la base (y las bases por grupo) al pie; las demás notas, como aviso al analista
#' @param base Base de la lámina. @param ... Notas que van al analista. @param en_pie Partes que sí van al pie (la base
#'   por grupo de la espec).
#' @return El texto del pie (o `""`).
#' @keywords internal
.lam_pie_resumen <- function(base, ..., en_pie = NULL, valores = NULL) {
  .lam_pie_resumen_avisar(unlist(list(...)))
  .lam_unir_base(en_pie, base, valores)
}

#' Qué son las cifras de la lámina, tras la base
#'
#' Gonzalo, 2026-11-10: «la base debe especificar qué significan los valores porque en ningún lado se explica». La base
#' dice a quién se le preguntó; esta frase, qué es cada cifra: «Las cifras son el porcentaje que eligió las dos
#' respuestas más favorables de la escala (Top Two Box); la diferencia es estudiantes menos docentes, en puntos».
#' Un indicador propio del analista se nombra tal cual.
#' @param indicador Nombre del indicador (`corte_etiqueta`); vacío o «Top Two Box» da la frase del Top Two Box.
#' @param diferencia Quién menos quién («estudiantes menos docentes»), o `NULL` sin columna de diferencia.
#' @param tipo `puntos` (una cifra por punto o barra) o `panorama` (cada punto es una pregunta).
#' @keywords internal
.lam_pie_valores <- function(indicador = NULL, diferencia = NULL, tipo = c("puntos", "panorama")) {
  tipo <- match.arg(tipo)
  ind <- trimws(as.character(indicador %||% "")[1])
  if (is.na(ind) || !nzchar(ind)) ind <- "Top Two Box"
  que <- if (grepl("^top two box$", ind, ignore.case = TRUE)) {
    "el porcentaje que eligió las dos respuestas más favorables de la escala (Top Two Box)"
  } else paste0("el porcentaje de «", ind, "»")
  txt <- if (identical(tipo, "panorama")) paste0("Cada punto es una pregunta y su valor, ", que) else paste0("Las cifras son ", que)
  if (!is.null(diferencia) && !is.na(diferencia[1]) && nzchar(diferencia[1])) txt <- paste0(txt, "; la diferencia es ", diferencia[1], ", en puntos")
  txt
}

#' Quién menos quién en la frase de las cifras: «estudiantes menos docentes», «TC menos TPA» o, con tres grupos o más,
#' «el grupo mayor menos el menor»
#' @keywords internal
.lam_pie_diferencia <- function(grupos) {
  if (length(grupos) == 2L) paste(.base_rotulo(grupos[1]), "menos", .base_rotulo(grupos[2])) else "el grupo mayor menos el menor"
}

#' Las notas que no van al pie, como aviso al analista (una vez cada una)
#' @keywords internal
.lam_pie_resumen_avisar <- function(notas) {
  notas <- as.character(unlist(notas)); notas <- trimws(notas[!is.na(notas)])
  notas <- unique(notas[nzchar(sub("[.[:space:]]+$", "", notas))])
  for (nt in notas) .pulso_aviso(.aviso_en_lamina(paste0("Nota del gráfico (no va al pie): ", .lam_con_punto(nt))))
  invisible(notas)
}

#' ¿Una parte de la nota es una base («Base: …»)? Ésas sí van al pie
#' @keywords internal
.lam_pie_es_base <- function(p) grepl("^\\s*Base:", p)

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
.lam_pie_resumen <- function(base, ..., en_pie = NULL) {
  .lam_pie_resumen_avisar(unlist(list(...)))
  .lam_unir_base(en_pie, base)
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

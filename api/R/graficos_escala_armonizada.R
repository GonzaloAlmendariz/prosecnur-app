# =============================================================================
# graficos_escala_armonizada.R — escalas distintas en una misma escala del resumen (ADR 0135, oleada 9)
# =============================================================================
#
# El resumen ejecutivo de Arte (p. 4) junta en una lámina preguntas de acuerdo («Totalmente en desacuerdo … Totalmente
# de acuerdo») y de satisfacción («Muy insatisfecho … Muy satisfecho»), con la leyenda de acuerdo y el pie «en
# satisfacción, de muy insatisfecho a muy satisfecho». Exigir una sola firma de escala dejaba fuera 12 de las 157
# preguntas de escala del panorama.
#
# Dos escalas distintas se alinean POR POSICIÓN sólo si tienen (a) el mismo número de opciones sustantivas, (b) el mismo
# sentido (negativo primero o negativo al final, leído de sus extremos) y (c) el mismo reparto (niveles negativos y
# neutro). Lo no sustantivo («Sin información») va a la columna especial de la escala de la leyenda. Cada fila conserva
# sus cifras: el nivel i de su escala ocupa la columna i de la leyenda. La leyenda usa la escala más frecuente; el pie
# nombra cada escala alineada distinta de la de la leyenda.

#' Sentido de una escala leído de sus extremos sustantivos: el polo negativo primero o al final
#'
#' Usa el vocabulario del polo negativo de la paleta (`.PALETA_ESCALA_NEGATIVO`). Si ningún extremo o los dos lo
#' nombran, el sentido no se reconoce (`NA`) y la escala sólo se junta con su misma firma.
#' @keywords internal
.escala_arm_sentido <- function(sustantivas) {
  k <- length(sustantivas)
  if (k < 2L) return(NA_character_)
  n <- tolower(trimws(.box_norm_etiqueta(sustantivas[c(1L, k)])))
  neg <- grepl(.PALETA_ESCALA_NEGATIVO, n)
  if (neg[1] && !neg[2]) return("negativo_positivo")
  if (neg[2] && !neg[1]) return("positivo_negativo")
  NA_character_
}

#' Tema de una escala para el pie («satisfacción», «frecuencia»…), o `NA` si no se reconoce
#' @keywords internal
.escala_arm_tema <- function(sustantivas) {
  n <- tolower(paste(trimws(.box_norm_etiqueta(sustantivas)), collapse = " | "))
  temas <- c(satisf = "satisfacción", acuerdo = "acuerdo", importan = "importancia",
             "frecuen|nunca|siempre|a veces|rara vez" = "frecuencia", "\\butil" = "utilidad",
             "probab" = "probabilidad", "confi" = "confianza")
  for (p in names(temas)) if (grepl(p, n)) return(unname(temas[[p]]))
  NA_character_
}

#' Forma de una escala: sus opciones sustantivas en orden, su sentido, su reparto y si trae opción especial
#'
#' @param etiquetas Las opciones de la lista en su orden.
#' @param no_sustantivo Lógico alineado: lo que el detector único marca como no sustantivo.
#' @param n_negativas,incluir_neutro Los de la lámina (sin declarar, la mitad por lado).
#' @keywords internal
.escala_arm_forma <- function(etiquetas, no_sustantivo, n_negativas = NULL, incluir_neutro = TRUE) {
  etiquetas <- as.character(etiquetas); no_sustantivo <- as.logical(no_sustantivo)
  sust <- etiquetas[!no_sustantivo]
  k <- length(sust)
  neg <- suppressWarnings(as.integer(.ola4_n_negativas(n_negativas, k))[1])
  neutro <- isTRUE(incluir_neutro) && k > 2L * neg
  list(sustantivas = sust, especiales = etiquetas[no_sustantivo], k = k, sentido = .escala_arm_sentido(sust),
       n_negativas = neg, neutro = neutro)
}

#' ¿Se puede alinear `forma` con la escala de la leyenda? `NULL` si sí; si no, el motivo (en plural, para el aviso)
#' @keywords internal
.escala_arm_motivo <- function(forma_ref, forma) {
  if (!identical(forma$k, forma_ref$k)) return("tienen otro número de opciones que la escala de la mayoría")
  if (is.na(forma$sentido) || is.na(forma_ref$sentido)) return("tienen otra escala que la mayoría, de sentido no reconocido")
  if (!identical(forma$sentido, forma_ref$sentido)) return("van en sentido contrario a la escala de la mayoría")
  if (!identical(forma$n_negativas, forma_ref$n_negativas) || !identical(forma$neutro, forma_ref$neutro)) {
    return("reparten sus niveles distinto que la escala de la mayoría")
  }
  if (length(forma$especiales) && !length(forma_ref$especiales)) {
    return("traen una opción sin información que la escala de la mayoría no tiene")
  }
  NULL
}

#' Etiqueta de la escala de la leyenda que ocupa cada opción de una escala alineada (por posición)
#'
#' @param etiquetas Etiquetas de la escala alineada (las observadas, ya resueltas a su lista).
#' @return Carácter alineado con `etiquetas`; `NA` si una no es de la lista.
#' @keywords internal
.escala_arm_mapear <- function(etiquetas, forma, forma_ref) {
  norm <- .escala_etiqueta_normalizada
  i_sust <- match(norm(etiquetas), norm(forma$sustantivas))
  out <- forma_ref$sustantivas[i_sust]
  es_esp <- is.na(i_sust) & norm(etiquetas) %in% norm(forma$especiales)
  out[es_esp] <- forma_ref$especiales[1]
  out
}

#' Índice de la escala de la leyenda: la firma más frecuente (con empate, la que aparece primero)
#'
#' @param firma_leyenda La firma más frecuente del universo de la regla (todas las candidatas, no sólo las elegidas): la
#'   leyenda no cambia porque la regla elija más preguntas de la escala minoritaria. Manda si alguna fila la tiene.
#' @keywords internal
.escala_arm_referencia <- function(firmas, firma_leyenda = NULL) {
  firmas <- as.character(firmas)
  ok <- !is.na(firmas) & nzchar(firmas)
  if (!any(ok)) return(1L)
  fl <- as.character(firma_leyenda %||% NA_character_)[1]
  if (!is.na(fl) && fl %in% firmas[ok]) return(which(ok & firmas == fl)[1])
  tab <- table(firmas[ok])
  top <- names(tab)[tab == max(tab)]
  which(ok & firmas %in% top)[1]
}

#' Texto del pie para una escala alineada: «en satisfacción, de muy insatisfecho a muy satisfecho»
#' @keywords internal
.escala_arm_texto <- function(forma) {
  s <- forma$sustantivas
  if (identical(forma$sentido, "positivo_negativo")) s <- rev(s)
  tramo <- sprintf("de %s a %s", tolower(trimws(s[1])), tolower(trimws(s[length(s)])))
  tema <- .escala_arm_tema(forma$sustantivas)
  if (is.na(tema)) tramo else sprintf("en %s, %s", tema, tramo)
}

#' Pie del denominador con las escalas alineadas: «Porcentaje sobre el total de respondientes; en satisfacción, …»
#' @keywords internal
.escala_arm_nota <- function(nota, textos) {
  textos <- unique(as.character(textos)); textos <- textos[!is.na(textos) & nzchar(textos)]
  if (!length(textos)) return(nota)
  paste0(sub("[.[:space:]]+$", "", nota), "; ", paste(textos, collapse = "; "), ".")
}

#' Forma de la escala de una tabla de frecuencias (sus opciones E1 y sus especiales, con el detector único)
#' @param opciones Lista `{codigo, etiqueta}` de la lista de la pregunta (`ola4_opciones_e1`).
#' @param meta `ola4_meta_especiales` de la tabla.
#' @keywords internal
.escala_arm_forma_opciones <- function(opciones, meta = list(), direccion = "negativo_positivo", n_negativas = NULL,
                                       incluir_neutro = TRUE) {
  et <- vapply(opciones, function(x) as.character(x$etiqueta)[1], character(1))
  cd <- vapply(opciones, function(x) as.character(x$codigo)[1], character(1))
  ns <- .divergentes_especiales(et, cd, especiales = meta$especiales %||% character(0),
                                sustantivos = meta$sustantivos %||% character(0), direccion = direccion)
  .escala_arm_forma(et, ns, n_negativas, incluir_neutro)
}

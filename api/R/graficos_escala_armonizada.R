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
#
# Revisión metodológica de 095e70b66 (2026-11-07):
#   - H2: la escala alineada tiene que ser de un tema reconocido como bipolar de opinión (acuerdo, satisfacción,
#     importancia, confianza, utilidad, probabilidad). Frecuencia («Nunca … Siempre») y cualquier tema no reconocido
#     («Nada preocupado … Muy preocupado», «Muy grave … Nada grave») quedan fuera.
#   - H1: con neutro, los dos centros tienen que ser neutrales por vocabulario («Ni … ni …», neutral, indiferente) o las
#     dos escalas ser del mismo tema: «Algo importante» no es el «Ni de acuerdo ni en desacuerdo» de una de acuerdo.
#   - H3: si la leyenda trae más de una opción especial, las de la alineada tienen que ser las mismas (etiqueta
#     normalizada), cada una a su columna.
#   - H4: las opciones excluidas de la leyenda se traducen a la alineada (una sustantiva por posición, una especial por
#     ser especial), así todas las filas comparten denominador.

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
.ESCALA_ARM_TEMAS_ALINEABLES <- c("acuerdo", "satisfacción", "importancia", "confianza", "utilidad", "probabilidad")
.ESCALA_ARM_NEUTRO <- "\\bni\\b.*\\bni\\b|neutral|neutro|indiferente"

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
  centro <- if (neutro) sust[neg + 1L] else NA_character_
  list(sustantivas = sust, especiales = etiquetas[no_sustantivo], k = k, sentido = .escala_arm_sentido(sust),
       n_negativas = neg, neutro = neutro, tema = .escala_arm_tema(sust), centro = centro)
}

#' ¿El punto medio nombra un neutro? («Ni de acuerdo ni en desacuerdo», «Neutral», «Indiferente»)
#' @keywords internal
.escala_arm_centro_neutral <- function(centro) {
  !is.na(centro) && grepl(.ESCALA_ARM_NEUTRO, tolower(trimws(.box_norm_etiqueta(centro))))
}

#' ¿Se puede alinear `forma` con la escala de la leyenda? `NULL` si sí; si no, el motivo (en plural, para el aviso)
#' @keywords internal
.escala_arm_motivo <- function(forma_ref, forma) {
  if (!identical(forma$k, forma_ref$k)) return("tienen otro número de opciones que la escala de la mayoría")
  # H2: el tema va antes que el sentido: «Muy grave … Nada grave» no es «sentido contrario», es otra escala.
  # Re-revisión de bd32813f0 (C1): la leyenda también tiene que ser de un tema alineable; si es de frecuencia o de un
  # tema no reconocido, sólo se juntan las de su misma firma.
  alineable <- function(f) !is.na(f$tema) && f$tema %in% .ESCALA_ARM_TEMAS_ALINEABLES
  if (!alineable(forma) || !alineable(forma_ref)) {
    return("tienen otra escala que la mayoría, de tema no reconocido")
  }
  if (is.na(forma$sentido) || is.na(forma_ref$sentido)) return("tienen otra escala que la mayoría, de sentido no reconocido")
  if (!identical(forma$sentido, forma_ref$sentido)) return("van en sentido contrario a la escala de la mayoría")
  if (!identical(forma$n_negativas, forma_ref$n_negativas) || !identical(forma$neutro, forma_ref$neutro)) {
    return("reparten sus niveles distinto que la escala de la mayoría")
  }
  if (isTRUE(forma$neutro)) {   # H1
    mismo_tema <- !is.na(forma_ref$tema) && identical(forma$tema, forma_ref$tema)
    if (!mismo_tema && !(.escala_arm_centro_neutral(forma$centro) && .escala_arm_centro_neutral(forma_ref$centro))) {
      return("su punto medio no es neutral como el de la escala de la mayoría")
    }
  }
  if (length(forma$especiales) && !length(forma_ref$especiales)) {
    return("traen una opción sin información que la escala de la mayoría no tiene")
  }
  if (length(forma_ref$especiales) > 1L) {   # H3
    norm <- .escala_etiqueta_normalizada
    if (!setequal(norm(forma$especiales), norm(forma_ref$especiales))) {
      return("traen opciones sin información distintas de las de la escala de la mayoría")
    }
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
  # Una sola especial en la leyenda: todas las de la alineada van ahí (se suman). Varias: cada una a la suya (H3).
  out[es_esp] <- if (length(forma_ref$especiales) > 1L) {
    forma_ref$especiales[match(norm(etiquetas[es_esp]), norm(forma_ref$especiales))]
  } else forma_ref$especiales[1]
  out
}

#' Opciones de la leyenda que la lámina excluye (por etiqueta o por código, con el alias del motor)
#' @param opciones Lista `{codigo, etiqueta}` de la escala de la leyenda.
#' @param excluir Lo resuelto para la leyenda (`ola4_excluir_resuelto`).
#' @return Etiquetas de la leyenda excluidas.
#' @keywords internal
.escala_arm_excluidas <- function(opciones, excluir) {
  excluir <- as.character(unlist(excluir %||% character(0)))
  if (!length(excluir) || !length(opciones)) return(character(0))
  et <- vapply(opciones, function(x) as.character(x$etiqueta)[1], character(1))
  cd <- vapply(opciones, function(x) as.character(x$codigo)[1], character(1))
  bloq <- .reporte_plan_norm_option_alias(excluir)
  et[.reporte_plan_norm_option_alias(et) %in% bloq | .reporte_plan_norm_option_alias(cd) %in% bloq]
}

#' H4: las exclusiones de la leyenda en la escala alineada (una sustantiva por posición; una especial por ser especial)
#' @param excluidas_ley Etiquetas excluidas de la leyenda (`.escala_arm_excluidas`).
#' @return Etiquetas de la escala alineada que se excluyen.
#' @keywords internal
.escala_arm_traducir_exclusion <- function(excluidas_ley, forma, forma_ley) {
  if (!length(excluidas_ley)) return(character(0))
  norm <- .escala_etiqueta_normalizada
  pos <- match(norm(excluidas_ley), norm(forma_ley$sustantivas)); pos <- pos[!is.na(pos)]
  esp_ley <- excluidas_ley[norm(excluidas_ley) %in% norm(forma_ley$especiales)]
  esp <- if (!length(esp_ley)) character(0)
         else if (length(forma_ley$especiales) > 1L) forma$especiales[norm(forma$especiales) %in% norm(esp_ley)]
         else forma$especiales
  unique(c(forma$sustantivas[pos], esp))
}

#' Índice de la escala de la leyenda: la firma más frecuente (con empate, la que aparece primero)
#'
#' @param firma_leyenda La firma más frecuente del universo de la regla (todas las candidatas, no sólo las elegidas): la
#'   leyenda no cambia porque la regla elija más preguntas de la escala minoritaria. Manda si alguna fila la tiene; si
#'   la regla elige filas de una sola escala (ninguna con esta firma), la leyenda es la de esas filas.
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

#' Exclusiones declaradas en la lámina (preset, tarjeta y constructor), sin los códigos especiales que se expanden
#' @keywords internal
.escala_arm_excluir_declaradas <- function(preset, el) {
  .reporte_plan_excluir_opciones((preset %||% list())$excluir_opciones %||% NULL,
                                 (el$overrides %||% list())$excluir_opciones %||% NULL, el$excluir_opciones %||% NULL)
}

#' Re-revisión de bd32813f0 (C2): una exclusión que no está en la escala de la leyenda no se aplica a ninguna fila
#' (las alineadas heredan las de la leyenda, H4), y se avisa.
#' @param declaradas Lo que la lámina declara excluir (`.escala_arm_excluir_declaradas`).
#' @param opciones Lista `{codigo, etiqueta}` de la escala de la leyenda; sin ella (escala sin firma) no se avisa.
#' @return Los avisos, uno por exclusión sin efecto.
#' @keywords internal
.escala_arm_avisos_exclusion <- function(declaradas, opciones) {
  declaradas <- unique(trimws(as.character(unlist(declaradas %||% character(0)))))
  declaradas <- declaradas[!is.na(declaradas) & nzchar(declaradas)]
  if (!length(declaradas) || !length(opciones)) return(character(0))
  et <- vapply(opciones, function(x) as.character(x$etiqueta)[1], character(1))
  cd <- vapply(opciones, function(x) as.character(x$codigo)[1], character(1))
  conocidas <- .reporte_plan_norm_option_alias(c(et, cd))
  fuera <- declaradas[!.reporte_plan_norm_option_alias(declaradas) %in% conocidas]
  sprintf("La exclusión \"%s\" no está en la escala de la leyenda y no se aplica.", fuera)
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

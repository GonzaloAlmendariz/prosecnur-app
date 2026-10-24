# etiqueta_otros.R — qué etiqueta de opción es «otro» y se imprime como «Otros».
#
# Una sola regla para Frecuencias (`.freq_clean_other_label_es`) y el mazo (`.reporte_plan_clean_other_label_es`).
# Antes cada sitio marcaba como «otro» toda etiqueta que EMPEZARA por otro/otra, y CCSS 2026 imprimió «Otra persona
# responsable o tutor/a» como «Otros» (y la sumó con el «Otro (especifique)»). Ahora es «otro» sólo la etiqueta que,
# quitado el «especifique» / «¿cuál?» y la puntuación final, queda en other/otro/otra/otros/otras.

#' ¿Cada etiqueta es la opción «otro»?
#' @param x Etiquetas de opción.
#' @return `logical` del largo de `x`.
#' @noRd
.etiqueta_es_otros <- function(x) {
  y <- as.character(x)
  y[is.na(y)] <- ""
  # stringi y no iconv: el iconv de macOS translitera «cuál» como «cu'al».
  norm <- stringi::stri_trans_general(trimws(y), "Latin-ASCII")
  norm <- tolower(trimws(gsub("\\s+", " ", norm, perl = TRUE)))
  s <- gsub("\\s*\\([^)]*(especific|specif|please|cual)[^)]*\\)", "", norm, perl = TRUE)
  s <- gsub("\\s*,?\\s*(por favor\\s+)?(especificar|especifique|especifica|specify|please specify)\\b", "", s, perl = TRUE)
  s <- gsub("\\s*,?\\s*\\??\\s*(cual|cuales)\\s*\\??", "", s, perl = TRUE)
  s <- trimws(gsub("[[:space:][:punct:]]+$", "", s, perl = TRUE))
  s %in% c("other", "otro", "otra", "otros", "otras")
}

#' Etiquetas de opción como se imprimen: «Otros» para la opción que es «otro», y sin el «(especifique)» ni los dos puntos
#' finales de una opción para escribir («Otra institución:» → «Otra institución»). No se renombra por ser la disparadora del `_otro`: la opción
#' 3 de A9 («Otra persona responsable…») también lo es, y su rótulo es el del instrumento.
#' @noRd
.etiqueta_opcion_imprimible <- function(y) {
  y[.etiqueta_es_otros(y)] <- "Otros"
  # «(especifique)», «, especifique» o los dos puntos finales sólo piden escribir: no son parte del rótulo.
  y <- gsub("\\s*\\([^)]*(especifi|specif|please)[^)]*\\)", "", y, ignore.case = TRUE, perl = TRUE)
  y <- gsub("\\s*,?\\s*(por favor\\s+)?(especificar|especifique|especifica|please specify|specify)\\b", "", y, ignore.case = TRUE, perl = TRUE)
  sub("\\s*:\\s*$", "", y, perl = TRUE)
}

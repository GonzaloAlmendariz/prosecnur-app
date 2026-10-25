# Rótulo corto de un subtema (TXT-17/TXT-20): la misma regla que `rotuloCortoSubtema` del frontend
# (frontend/src/features/codificacion/sugerenciasModulo.ts). La sugerencia de módulo la devuelve como `etiqueta_corta`
# junto a la `etiqueta_completa`, y el gráfico de temas la usa para los subtemas. Si cambia una, cambia la otra: los
# casos de paridad están en test-codificacion-sugerir-etiquetas.R y en sugerenciasModulo.test.ts.
#
# Regla, en este orden: (1) «Tema: subtema» se queda con lo de después de los dos puntos; (2) sólo la primera oración,
# sin signos de pregunta ni «…»; (3) si hay «sobre», «acerca de», «respecto a» o «siguiente(s)», lo que sigue al último,
# salvo que quede una sola palabra (entonces lo de antes); (4) sin la apertura de la pregunta; (5) «X que <verbo> la Y»
# pasa a «X de la Y»; (6) hasta cuatro palabras, sin palabras vacías al final ni artículos al inicio (si queda más de una).

.CRC_VACIAS_BORDE <- c("de", "del", "la", "las", "el", "los", "un", "una", "unos", "unas", "y", "o", "en", "con", "para",
                       "por", "a", "al", "entre", "que", "sobre", "tu", "tus", "su", "sus", "mi", "mis", "como")
.CRC_ARTICULOS_INICIO <- c("la", "las", "el", "los", "un", "una", "unos", "unas", "tu", "tus", "su", "sus", "mi", "mis")
.CRC_PIVOTE <- "\\b(?:sobre|acerca de|respecto a|con respecto a|siguientes?)\\s+"
.CRC_APERTURA <- paste0(
  "^(?:con qu[eé] frecuencia|en qu[eé] medida|qu[eé] tan de acuerdo|qu[eé] tan|c[oó]mo|cu[aá]ntos?|cu[aá]ntas?|",
  "cu[aá]les|cu[aá]l|por qu[eé]|qu[eé]|d[oó]nde)\\s+(?:(?:te|se|le|les|me|nos)\\s+)?\\S+\\s*(?:(?:con|en|a|de)\\s+)?"
)

#' @keywords internal
.crc_palabras <- function(s) { w <- strsplit(s, "\\s+", perl = TRUE)[[1]]; w[nzchar(w)] }

#' @keywords internal
.crc_recortar_bordes <- function(ws, quitar_articulo) {
  while (length(ws) && tolower(ws[length(ws)]) %in% .CRC_VACIAS_BORDE) ws <- ws[-length(ws)]
  if (quitar_articulo && length(ws) > 2L && tolower(ws[1]) %in% .CRC_ARTICULOS_INICIO) ws <- ws[-1]
  ws
}

#' @keywords internal
.crc_mayuscula_inicial <- function(s) if (nzchar(s)) paste0(toupper(substr(s, 1L, 1L)), substr(s, 2L, nchar(s))) else s

#' @keywords internal
.crc_corto_de_uno <- function(enunciado) {
  t <- trimws(gsub("\\s+", " ", enunciado, perl = TRUE))
  if (!nzchar(t)) return("")
  dos <- regmatches(t, regexec("^[^¿?:]{2,60}:\\s*(.+)$", t, perl = TRUE))[[1]]
  if (length(dos) == 2L) t <- dos[2]
  t <- sub("^[¿¡\\s]+", "", t, perl = TRUE)
  fin <- regexpr("[?.!]", t, perl = TRUE)
  if (fin > 0L) t <- substr(t, 1L, fin - 1L)
  t <- trimws(gsub("…+|\\.{3}", " ", t, perl = TRUE))
  base <- t
  piv <- gregexpr(.CRC_PIVOTE, t, perl = TRUE, ignore.case = TRUE)[[1]]
  if (piv[1] > 0L) {
    k <- length(piv); ini <- piv[k]; len <- attr(piv, "match.length")[k]
    tras <- substr(t, ini + len, nchar(t))
    if (length(.crc_recortar_bordes(.crc_palabras(tras), TRUE)) >= 2L ||
        length(.crc_recortar_bordes(.crc_palabras(tras), FALSE)) >= 2L) {
      base <- tras
    } else {
      base <- paste(.crc_recortar_bordes(.crc_palabras(substr(t, 1L, ini - 1L)), FALSE), collapse = " ")
    }
  }
  if (grepl(.CRC_APERTURA, base, perl = TRUE, ignore.case = TRUE)) base <- sub(.CRC_APERTURA, "", base, perl = TRUE, ignore.case = TRUE)
  ws <- .crc_recortar_bordes(.crc_palabras(base), TRUE)
  rel <- regmatches(paste(ws, collapse = " "), regexec("^(\\S+) que \\S+ (la|las|los|el) (\\S+)$", paste(ws, collapse = " "),
                                                      perl = TRUE, ignore.case = TRUE))[[1]]
  if (length(rel) == 4L) {
    ws <- .crc_palabras(paste(rel[2], if (tolower(rel[3]) == "el") "del" else paste("de", rel[3]), rel[4]))
  }
  ws <- .crc_recortar_bordes(utils::head(ws, 4L), FALSE)
  out <- paste(ws, collapse = " ")
  if (nzchar(out) && identical(out, toupper(out))) out <- paste0(substr(out, 1L, 1L), tolower(substr(out, 2L, nchar(out))))
  .crc_mayuscula_inicial(out)
}

#' Rótulo corto (de 2 a 4 palabras) de un subtema a partir del enunciado de su batería; «a / b» acorta cada parte
#' @keywords internal
.codif_rotulo_corto_subtema <- function(enunciado) {
  x <- as.character(enunciado %||% "")[1]
  if (is.na(x)) return("")
  partes <- vapply(strsplit(x, " / ", fixed = TRUE)[[1]], .crc_corto_de_uno, character(1))
  paste(partes[nzchar(partes)], collapse = " / ")
}

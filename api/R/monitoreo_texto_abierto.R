# Señales de calidad en respuestas de texto abierto.
#
# **Es material para leer, no un veredicto.** Las señales ordenan por dónde
# empezar a mirar; quién invalida es una persona. Esa distincion manda sobre
# todo el diseño: por eso no hay una puntuacion agregada ni un «sospechoso
# si/no» por respuesta.
#
# La leccion que ordeno el archivo salio de medir `acnur_pdm` (1 610 respuestas
# abiertas en 15 preguntas): **una señal solo significa algo contra su propia
# pregunta**. En `Enumerator_name` el 99 % de las respuestas se repiten —es el
# nombre del encuestador— y en `telephone` el 100 % es una sola palabra. Las
# mismas dos señales que ahi no dicen nada, en `recomendation` marcan el 55 % y
# el 44 % sobre respuestas de contenido. Aplicarlas en absoluto llenaria la
# pantalla de falsos positivos en los campos donde repetir es lo correcto.
#
# **Señal descartada, con su cifra**: «teclado seguido» (asdf, qwer, 1234…)
# marca **0 de las 1 610** respuestas. No entra: una señal que no distingue
# nada solo añade ruido al lector.

# Relleno es lo que ocupa el campo SIN DECIR NADA. La distincion con la lista de
# abajo salio de medir: en `recomendation` de acnur_pdm, meter «no» y «ninguno»
# aqui daba un 33 % de «relleno» que en realidad era gente contestando que no
# tenia recomendaciones —«NO» repetido 38 veces—. Es la trampa de una palabra
# para dos cosas: un «no» en «¿algo que añadir?» es una respuesta, y un «.» en
# la misma pregunta es un campo obligatorio esquivado.
MONITOREO_TEXTO_RELLENO <- c(
  ".", "-", "_", "x", "xx", "xxx", "na", "n/a", "s/n", "0", "00"
)

# Decir que no hay nada que decir NO es mala calidad. Se cuenta aparte porque
# explica por que una pregunta abierta trae poco contenido, que es informacion
# distinta de que se la esten saltando.
MONITOREO_TEXTO_NEGATIVA <- c(
  "no", "ninguno", "ninguna", "nada", "no hay", "no tengo", "nunca",
  "sin comentario", "sin comentarios", "no aplica", "ns", "nc"
)

#' Señales por respuesta de una pregunta abierta
#'
#' @param respuestas Vector de texto de UNA pregunta.
#' @return `data.frame` con una fila por respuesta contestada.
monitoreo_texto_senales <- function(respuestas) {
  v <- trimws(as.character(respuestas))
  v[is.na(v)] <- ""
  idx <- which(nzchar(v))
  if (!length(idx)) {
    return(data.frame(
      fila = integer(0), texto = character(0), largo = integer(0),
      palabras = integer(0), relleno = logical(0), negativa = logical(0),
      repeticiones = integer(0),
      stringsAsFactors = FALSE
    ))
  }
  con <- v[idx]
  normal <- tolower(gsub("[[:space:]]+", " ", con))
  conteo <- table(normal)
  data.frame(
    fila = idx,
    texto = con,
    largo = nchar(con),
    palabras = lengths(strsplit(normal, " +")),
    # Relleno es lo que ocupa el campo sin decir nada. Se compara con la lista
    # y tambien con el texto sin puntuacion: «...» y «.» son lo mismo.
    relleno = normal %in% MONITOREO_TEXTO_RELLENO |
      !nzchar(gsub("[[:punct:][:space:]]", "", normal)),
    negativa = normal %in% MONITOREO_TEXTO_NEGATIVA,
    repeticiones = as.integer(conteo[normal]),
    stringsAsFactors = FALSE
  )
}

#' Como se comporta una pregunta abierta en conjunto
#'
#' Es lo que permite leer las señales de cada respuesta: una tasa de repeticion
#' del 55 % en una pregunta de contenido merece mirarse; en un campo de nombre
#' de encuestador es lo esperable.
monitoreo_texto_perfil <- function(respuestas, etiqueta = "") {
  s <- monitoreo_texto_senales(respuestas)
  n <- nrow(s)
  tasa <- function(x) if (n) round(100 * sum(x) / n, 1) else NA_real_
  list(
    etiqueta = etiqueta,
    contestadas = n,
    sin_contestar = length(respuestas) - n,
    distintas = if (n) length(unique(tolower(s$texto))) else 0L,
    largo_mediano = if (n) stats::median(s$largo) else NA_real_,
    pct_relleno = tasa(s$relleno),
    pct_negativa = tasa(s$negativa),
    pct_una_palabra = tasa(s$palabras <= 1),
    pct_repetida = tasa(s$repeticiones > 1),
    pct_muy_corta = tasa(s$largo < 4)
  )
}

#' Respuestas que conviene leer primero
#'
#' Ordena por lo que la propia pregunta hace raro: primero el relleno, despues
#' lo mas corto, y entre iguales lo que mas se repite. **No filtra nada**: el
#' lector ve todas y decide.
monitoreo_texto_orden_de_lectura <- function(respuestas) {
  s <- monitoreo_texto_senales(respuestas)
  if (!nrow(s)) return(s)
  s[order(!s$relleno, s$largo, -s$repeticiones), , drop = FALSE]
}

# =============================================================================
# monitoreo_aulas_columna_declarada.R — la columna que el estudio nombró
# =============================================================================
#
# **Kobo devuelve las columnas con el prefijo de su grupo, y el estudio las
# declara sin él.** El formulario pregunta `cod_pucp` dentro del grupo
# `modulo_a`, el coordinador escribe `cod_pucp` en Fuentes —que es como la ve en
# el XLSForm— y la plataforma entrega `modulo_a/cod_pucp`. El match exacto
# falla, el normalizado también (la barra no es un espacio ni una mayúscula), y
# la columna se da por ausente.
#
# Medido el 2026-09-21 sobre CCSS Perfil 2026-II, la víspera del campo,
# inyectando UNA respuesta con un código sacado del propio padrón:
#
#   modulo_a/cod_pucp (el nombre real)  ->  en_celdas=0  sin_eje=1
#   cod_pucp          (sin prefijo)     ->  en_celdas=1  sin_eje=0
#
# Es decir: **todas** las respuestas del campo habrían caído en «sin nivel» y el
# avance se habría quedado en cero mientras entraban encuestas, con el aviso
# «ninguno de los códigos declarados se encontró en el padrón» culpando al
# padrón. El padrón estaba bien; el código no se leía nunca.
#
# **Esto NO es adivinar la llave**, que es la línea que el perfil tiene trazada
# desde el cruce de facultad declarada. La hoja de un camino con grupos es el
# MISMO nombre que el estudio declaró, calificado por el grupo que lo contiene:
# reconocerlo es leer lo que ya se nombró. Por eso sólo se acepta cuando es
# **inequívoco**: si dos columnas comparten la hoja —`modulo_a/cod_pucp` y
# `modulo_b/cod_pucp`— elegir una sería justamente adivinar, y entonces se
# devuelve "" y salta el aviso de siempre, que es la conducta correcta.
# =============================================================================

# La hoja de un camino de Kobo: lo que queda tras la última barra.
.macd_hoja <- function(x) sub("^.*/", "", as.character(x %||% ""))

#' La columna de `responses` que corresponde a un nombre declarado.
#'
#' Tres pasos, del más literal al más tolerante, y ninguno adivina:
#' exacto → normalizado (caja y espacios) → hoja del camino de grupos, sólo si
#' una única columna la tiene.
#'
#' @param responses `data.frame` de respuestas.
#' @param declarada el nombre que el estudio escribió en Fuentes.
#' @return el nombre real de la columna, o `""` si no se puede afirmar cuál es.
#' @export
monitoreo_aulas_columna_declarada <- function(responses, declarada = "") {
  if (!is.data.frame(responses) || !ncol(responses)) return("")
  decl <- .monitoreo_scalar(declarada, "")
  if (!nzchar(decl)) return("")
  cols <- names(responses)
  if (decl %in% cols) return(decl)
  # Tolerancia mínima: el nombre declarado con otra caja o con espacios. No es
  # adivinar la columna, es reconocer la que el estudio ya nombró.
  idx <- match(.monitoreo_text_key(decl), .monitoreo_text_key(cols), nomatch = 0L)
  if (idx > 0L) return(cols[[idx]])
  # El prefijo de grupo de Kobo. Se compara hoja contra hoja para que también
  # calce al revés —el estudio declara `modulo_a/cod_pucp` y la plataforma
  # entrega `cod_pucp`, que pasa cuando el formulario pierde su grupo—.
  hoja <- .monitoreo_text_key(.macd_hoja(decl))
  if (!nzchar(hoja)) return("")
  candidatas <- cols[.monitoreo_text_key(.macd_hoja(cols)) == hoja]
  if (length(candidatas) == 1L) return(candidatas[[1L]])
  ""
}

# graficos_orden_romanos.R — números romanos como pista de orden, y el «instrumento» explícito de la torta/dona.
#
# CCSS Perfil 2026: «Nivel curricular» trae VI, VII, VIII, IX (códigos 6-9). Sin cifras ni ordinales en palabras,
# `.goc_pistas_orden` no la reconocía como ordinal y el recetario la dibujaba por frecuencia (VII, VI, VIII, IX) en
# barras y dona. Un nivel o ciclo en romanos es tan ordinal como «Quinto ciclo» (contrato D8 §2, p68).
#
# La torta y la dona no tienen un modo «instrumento» (`ordenar_categorias` ∈ ninguno/desc/asc/natural/manual): un
# `overrides.ordenar_categorias = "instrumento"` explícito hacía fallar el graficador y la lámina salía «Sin datos».
# Se lee como lo que dice: el orden del instrumento, que el motor traduce a `manual`.

#' ¿Todas las etiquetas no residuales son un número romano (I a XXX), solo o con «ciclo», «nivel», «grado»…?
#'
#' Pide al menos dos y la lectura completa de la etiqueta: «Mi casa» o «Vivo solo» no cuentan.
#' @keywords internal
.goc_pistas_romanos <- function(etiquetas) {
  e <- tolower(trimws(as.character(etiquetas %||% character())))
  e <- e[!is.na(e) & nzchar(e)]
  if (length(e) < 2L) return(FALSE)
  pref <- "(ciclo|nivel|grado|semestre|año|ano|curso|modulo|módulo)"
  num <- sub(sprintf("^(%s\\s+)?([ivx]+)(\\s+%s)?$", pref, pref), "\\3", e, perl = TRUE)
  ok <- grepl(sprintf("^(%s\\s+)?[ivx]+(\\s+%s)?$", pref, pref), e, perl = TRUE)
  if (!all(ok)) return(FALSE)
  v <- suppressWarnings(as.integer(utils::as.roman(toupper(num))))
  # Romano válido y bien escrito (as.roman acepta «IIII»; la ida y vuelta lo descarta).
  all(!is.na(v) & v >= 1L & v <= 30L & tolower(as.character(utils::as.roman(v))) == num)
}

#' ¿El gráfico circular trae `ordenar_categorias = "instrumento"` explícito?
#' @keywords internal
.goc_circular_instrumento_explicito <- function(el) {
  if (!(el$.element_type %||% "") %in% c("pie", "donut")) return(FALSE)
  identical(tolower(trimws(as.character((el$overrides %||% list())$ordenar_categorias %||% "")[1])), "instrumento")
}

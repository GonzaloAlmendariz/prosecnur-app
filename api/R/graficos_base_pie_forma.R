# graficos_base_pie_forma.R — CCSS-15: una sola forma del pie de base.
#
# CCSS Perfil 2026 alternaba en el mismo mazo «Base: 397» (barras y cruces, que componen con `.base_auto_from_var` y el
# sufijo del preset) y «Base: 397 respuestas» (columnas, donas, dicotomías y cifras nativas, que heredan la nota del
# gráfico armada por `.format_n_caption` con la unidad fija «respuestas»). DECIDIDO (lead, 2026-10-24): si el preset de
# base no declara sufijo, todas las rutas dicen «Base: N»; si lo declara, «Base: N <sufijo>» en todas. El sufijo no se
# rellena con el default de Pulso (comentario de `.enriquecer_presets`, router_graficos.R).
#
# Lo que NO es el pie y se queda: el «N respuestas» bajo el título de un panel o sobre una columna (el público o los casos
# de esa pieza), y el «n de N respuestas» de la leyenda de la dona. El número no cambia en ningún caso.

#' Núcleo del pie de base: «N», «N <sufijo>» o el rango «min-max <sufijo>» cuando las piezas tienen bases distintas
#'
#' @param n_values Casos válidos sin ponderar (uno o varios).
#' @param sufijo Sufijo declarado en el preset de base (`presets$base$args$sufijo_auto`); `NULL` o vacío, sin sufijo.
#' @return Texto, o `NULL` si no hay un número positivo.
#' @keywords internal
.base_pie_nucleo <- function(n_values, sufijo = NULL) {
  n <- suppressWarnings(as.numeric(n_values))
  n <- n[is.finite(n) & !is.na(n) & n > 0]
  if (!length(n)) return(NULL)
  n <- sort(unique(round(n)))
  fmt <- function(x) format(x, big.mark = ",", scientific = FALSE, trim = TRUE)
  num <- if (length(n) == 1L) fmt(n[[1]]) else paste0(fmt(min(n)), "-", fmt(max(n)))
  suf <- if (is.character(sufijo) && length(sufijo) == 1L && !is.na(sufijo)) trimws(sufijo) else ""
  if (nzchar(suf)) paste(num, suf) else num
}

#' El pie automático nombra al público de una base con nombre («Base: 242» → «Base: 242 estudiantes»)
#'
#' Reemplaza a la regla del compositor que sólo reconocía la forma vieja «Base: N respuestas»: con el pie ya sin sufijo,
#' sin esto la base con nombre se quedaba muda. Un pie con otro sufijo (el declarado) se respeta tal cual.
#' @keywords internal
.lam_base_con_publico <- function(base, publico) {
  b <- as.character(base %||% "")[1]; p <- trimws(as.character(publico %||% "")[1])
  if (is.na(b) || !nzchar(b) || is.na(p) || !nzchar(p)) return(base)
  sub("^(Base:\\s*[0-9][0-9.,]*)(\\s+respuestas)?$", paste0("\\1 ", p), b)
}

#' El sufijo de base que el proyecto DECLARÓ, o `NULL`
#'
#' `.build_presets` repone los defaults de fábrica bajo las decisiones (ADR 0074), así que en el worker el preset de base
#' trae siempre `sufijo_auto = "respuestas"` aunque el proyecto no lo haya tocado; y como el bag en disco sólo guarda
#' decisiones (`.graficos_presets_solo_decisiones` borra lo que iguala al default), un «respuestas» elegido a mano es
#' indistinguible del de fábrica. `.enriquecer_presets` deja `base` sin rellenar a propósito («no configurado» tiene
#' significado). Por eso el sufijo igual al de fábrica cuenta como no declarado: el pie dice «Base: N» (CCSS-15).
#' @keywords internal
.base_pie_sufijo_declarado <- function(sufijo) {
  s <- if (is.character(sufijo) && length(sufijo) == 1L && !is.na(sufijo)) trimws(sufijo) else ""
  fabrica <- tryCatch(as.character(.PRESETS_DEFAULT_PULSO$base$sufijo_auto %||% "")[1], error = function(e) "")
  if (!nzchar(s) || identical(s, trimws(fabrica %||% ""))) NULL else s
}

#' La parte de una base sin nombre propio («default») en el pie de un informe con varias bases: el número y, si el
#' proyecto lo declaró, su sufijo (antes el sufijo declarado se perdía en esta ruta y no en las demás)
#' @keywords internal
.base_pie_parte_default <- function(n_txt, sufijo = NULL) {
  s <- .base_pie_sufijo_declarado(sufijo)
  if (is.null(s)) n_txt else paste(n_txt, s)
}

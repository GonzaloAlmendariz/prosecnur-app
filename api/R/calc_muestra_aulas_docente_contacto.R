# calc_muestra_aulas_docente_contacto.R — a quién se llama para agendar un aula.
#
# **Un curso-horario puede tener varios docentes, y la agenda se hace con uno.**
#
# Regla del operativo, dictada por Gonzalo el 2026-08-25:
#
# > «un CH puede tener más de un docente, pero basta con que tenga un docente
# > que no sea jefe de práctica para que sea válido, y nos vamos a comunicar con
# > ese docente, no con el JP»
#
# El aula se elegía con `.cm_aulas_mode()`, que se queda con el valor MÁS
# FRECUENTE entre las filas del catálogo. Como el catálogo repite cada
# curso-horario una vez por especialidad, gana quien aparezca en más filas — que
# no tiene por qué ser el docente a cargo.
#
# Medido el 2026-08-25 sobre el estudio de 193 titulares: de las **180 unidades
# con docente ordinario Y jefe de práctica**, el contacto elegido era el jefe de
# práctica en **88** — prácticamente una moneda al aire. Entre ellas **6
# titulares**, 15 reservas de cadena y 67 del banco. Esas 6 son aulas donde el
# equipo iba a llamar a quien no dicta el curso, con su nombre y su correo
# impresos en la ficha.
#
# Vive aparte porque `calc_muestra_aulas.R` está congelado a crecimiento: el
# cambio ahí es de dos líneas por dos.

# Categorías de la PUCP que no son el docente a cargo del curso. Son las que el
# catálogo prefija con `PRE-DOCENTE`; se reconocen por el rol y no por el prefijo
# para que un cambio de nomenclatura no las deje pasar en silencio.
.CM_AULAS_NO_DOCENTE <- c("JEFE DE PR", "PRE-DOCENTE", "INSTRUCTOR")

#' Si este tipo de docente es el que dicta el curso.
#'
#' @param tipo valor de `TIPODOCENTE` de una fila.
#' @return `TRUE` si es docente a cargo; `FALSE` si es jefe de práctica o
#'   instructor. Un tipo vacío devuelve `TRUE`: no se puede afirmar que alguien
#'   NO sea el docente porque falte el dato, y descartarlo dejaría el aula sin
#'   contacto.
#' @export
calc_muestra_aulas_es_docente_a_cargo <- function(tipo) {
  t <- toupper(trimws(as.character(tipo %||% "")))
  if (!nzchar(t)) return(TRUE)
  !any(vapply(.CM_AULAS_NO_DOCENTE, function(p) grepl(p, t, fixed = TRUE), logical(1)))
}

#' El valor que corresponde al docente a cargo del aula.
#'
#' `valores` y `tipos` son columnas de las MISMAS filas del catálogo, así que
#' elegir por posición devuelve el nombre y el correo de la misma persona. Por
#' eso esta función se aplica por separado a cada columna en vez de resolver la
#' fila una vez: mantiene el cambio en dos líneas dentro del archivo congelado, y
#' el resultado es idéntico porque el criterio de desempate es determinista.
#'
#' Entre varios docentes a cargo se queda con el más frecuente, que es el
#' comportamiento anterior y no hay razón para cambiarlo. Si NINGUNO lo es —las
#' 46 aulas del estudio cuyo único docente es jefe de práctica— devuelve el más
#' frecuente de todos: esas aulas no entran al marco por el criterio de tipo de
#' docente, pero si alguien las mira debe ver un contacto y no un hueco.
#'
#' @param valores nombres (o correos) de las filas del aula.
#' @param tipos `TIPODOCENTE` de esas mismas filas.
#' @param default valor si no hay nada.
#' @return una cadena.
#' @export
calc_muestra_aulas_docente_contacto <- function(valores, tipos, default = "") {
  v <- trimws(as.character(valores %||% character(0)))
  t <- as.character(tipos %||% character(0))
  if (!length(v)) return(default)
  if (length(t) != length(v)) t <- rep_len(if (length(t)) t else "", length(v))
  ok <- !is.na(v) & nzchar(v)
  a_cargo <- ok & vapply(t, calc_muestra_aulas_es_docente_a_cargo, logical(1))
  elegibles <- if (any(a_cargo)) v[a_cargo] else v[ok]
  if (!length(elegibles)) return(default)
  tab <- table(elegibles)
  candidatos <- names(tab)[tab == max(tab)]
  # Desempate por orden de aparición, igual que `.cm_aulas_mode`: dos corridas
  # sobre el mismo catálogo tienen que dar el mismo contacto.
  candidatos[order(match(candidatos, elegibles))][[1]]
}

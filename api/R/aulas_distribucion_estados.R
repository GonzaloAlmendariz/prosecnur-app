# aulas_distribucion_estados.R — un estado se reconoce escrito como se escribe.
#
# La columna ESTADO de la hoja de los aplicadores la teclea el equipo, y la
# lista cerrada del desplegable no impide que un valor entre por otra vía: se
# pega una fila, se copia de otra hoja, o alguien escribe sin tilde. El
# 2026-09-10 el documento traía «APLICADA SIN AGENDACION» —la que Gonzalo puso
# esa manana— mientras la app declara «APLICADA SIN AGENDACIÓN» con tilde.
#
# La comparación era `TEXT_EQ` contra el valor canónico, así que esa celda se
# quedaba SIN COLOR y sin reconocer, sin que nada fallara. Es la misma familia
# del defecto que ya costó una sesión: una lista cerrada que traga en silencio
# lo que no encaja.
#
# Aquí vive el puente entre lo TECLEADO y lo CANÓNICO. Archivo propio porque el
# problema es del vocabulario, no del generador de la hoja: lo usan tanto quien
# pinta la hoja como quien la lee de vuelta.

#' El mismo texto sin tildes y en mayúsculas.
#'
#' `iconv` a ASCII//TRANSLIT depende del locale de la máquina y en algunas
#' devuelve `NA` o interrogantes; el reemplazo explícito no depende de nada. Son
#' las cinco vocales y la eñe, que es todo lo que aparece en el vocabulario del
#' operativo.
#' @keywords internal
.ade_sin_tildes <- function(x) {
  t <- toupper(trimws(as.character(x %||% "")))
  t <- chartr("ÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛ", "AEIOUAEIOUAEIOUAEIOU", t)
  gsub("\\s+", " ", t)
}

#' El estado canónico que corresponde a un texto tecleado, o `""`.
#'
#' Reconoce el valor escrito con o sin tildes y con espacios de más. NO adivina
#' más allá de eso: un texto que no case con ninguno de los declarados se
#' devuelve vacío para que quien pregunta lo trate como ajeno y lo declare, en
#' vez de asignarle el estado más parecido.
#'
#' @param texto lo que hay en la celda.
#' @return uno de `MONITOREO_AULAS_ESTADOS_DISTRIBUCION`, o `""`.
#' @export
aulas_distribucion_estado_canonico <- function(texto) {
  buscado <- .ade_sin_tildes(texto)
  if (!nzchar(buscado)) return("")
  llaves <- vapply(MONITOREO_AULAS_ESTADOS_DISTRIBUCION, .ade_sin_tildes, character(1))
  i <- which(llaves == buscado)
  if (length(i) == 1L) MONITOREO_AULAS_ESTADOS_DISTRIBUCION[[i]] else ""
}

#' Todas las formas en que un estado puede estar escrito en la hoja.
#'
#' El canónico primero y, cuando lleva tilde, su forma sin tildes. Sirve para
#' emitir UNA regla de color por forma: `TEXT_EQ` no normaliza nada, así que una
#' sola regla deja sin pintar justo la celda que alguien tecleó a mano — que es
#' la que más importa ver.
#'
#' @param estado el valor canónico.
#' @return las formas, sin repetir.
#' @export
aulas_distribucion_formas_de_estado <- function(estado) {
  canonico <- as.character(estado %||% "")[1]
  if (!nzchar(canonico)) return(character(0))
  unique(c(canonico, .ade_sin_tildes(canonico)))
}

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

#' Los estados que ya están escritos en el documento, por cita.
#'
#' La clave es el par curso-horario + fecha, la misma con la que el ciclo
#' identifica una fila: un mismo curso-horario aparece dos veces cuando se
#' reagenda, y sólo el par distingue la que salió de la que aterrizó.
#'
#' @param remoto los valores de la pestaña, cabecera incluida.
#' @return vector con nombre `codigo\\rfecha` -> estado tal como está escrito.
#' @export
aulas_distribucion_estados_publicados <- function(remoto) {
  filas <- remoto %||% list()
  if (length(filas) < 2L) return(stats::setNames(character(0), character(0)))
  n <- length(.alpa_CABECERA)
  cab <- .madc_valores(filas[[1L]], n)
  i_cod <- which(cab == "CURSO-HORARIO"); i_fec <- which(cab == "FECHA")
  i_est <- which(cab == "ESTADO")
  if (length(i_cod) != 1L || length(i_fec) != 1L || length(i_est) != 1L) {
    return(stats::setNames(character(0), character(0)))
  }
  claves <- character(0); valores <- character(0)
  for (f in filas[-1L]) {
    v <- .madc_valores(f, n)
    if (!nzchar(v[[i_cod]])) next
    claves <- c(claves, paste(v[[i_cod]], v[[i_fec]], sep = "\r"))
    valores <- c(valores, v[[i_est]])
  }
  stats::setNames(valores, claves)
}

#' Qué estado escribir en una cita: el deducido, o el que ya estaba.
#'
#' **El motor NUNCA degrada un estado que no escribió.** De los siete, el motor
#' deduce dos —«POR APLICAR» y «APLICADA»— y los demás los elige el equipo en el desplegable. Y
#' «APLICADA» también la puede poner el coordinador, eligiéndola en el CHIP
#' DESPLEGABLE de la columna (Gonzalo, 2026-09-10: «el estado aplicada también lo
#' pone el coordinador… o sea puede, no es que siempre lo ponga», «ojo, no es a
#' mano, es un chip desplegable»), normalmente ANTES de que llegue el parte o las
#' respuestas. Publicar entonces «POR APLICAR» encima borraría lo que él sabe y
#' la app todavía no.
#'
#' Que venga de un desplegable no hace innecesario el reconocimiento por
#' canónico: la lista del desplegable la edita él, y el 2026-09-10 tenía
#' «APLICADA SIN AGENDACION» sin tilde. El valor es cerrado, pero la lista no es
#' la de la app.
#'
#' La única escritura que el motor se permite es hacia ADELANTE:
#'
#' - sobre una casilla vacía o en «POR APLICAR», escribe lo que deduce;
#' - sobre «POR APLICAR SIN AGENDACIÓN», si las respuestas ya llegan, asciende a
#'   «APLICADA SIN AGENDACIÓN» — fueron sin cita y rindió, que es su desenlace,
#'   no un «APLICADA» a secas que perdería de dónde salió;
#' - sobre cualquier otro, no toca nada.
#'
#' @param deducido lo que el motor sabe: «APLICADA» o «POR APLICAR».
#' @param previo lo que hay escrito en el documento, tal cual.
#' @return el estado a publicar.
#' @export
aulas_distribucion_estado_a_publicar <- function(deducido, previo = "") {
  puesto <- aulas_distribucion_estado_canonico(previo)
  nuevo <- as.character(deducido %||% "")[1]
  if (!nzchar(puesto) || identical(puesto, "POR APLICAR")) return(nuevo)
  if (identical(puesto, "POR APLICAR SIN AGENDACIÓN") && identical(nuevo, "APLICADA")) {
    return("APLICADA SIN AGENDACIÓN")
  }
  puesto
}

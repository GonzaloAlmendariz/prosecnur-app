# ¿Dos cursos-horario distintos comparten el mismo enlace de recopilador?
#
# La atribucion de una respuesta a su curso-horario va por el enlace: si dos
# aulas comparten uno, sus respuestas entran por la misma puerta y **no hay forma
# de separarlas despues**. El estudio lo descubre al cuadrar, o no lo descubre.
#
# Medido sobre HSVG2026 «como 2025» el 2026-08-30: de 192 filas en campo salen
# **158 enlaces distintos**, y **25 estan compartidos por cadenas distintas**. El
# enlace lleva el `classroom_id` TRUNCADO, asi que dos aulas que solo difieren en
# el ultimo digito reciben el mismo formulario:
#
#     CH 11   classroom_id "1ind53_0833"   link ".../1ind53_0"
#     CH 35   classroom_id "1ind53_0832"   link ".../1ind53_0"
#
# Los `classroom_id` NO colisionan —192 distintos para 192 filas—, asi que el
# truncamiento pasa al construir el enlace, fuera de esta app: ni el anonimizador
# ni el motor escriben `link`. Lo que si faltaba aqui es **decirlo**: ninguna de
# las once reglas de `validation` miraba el enlace.
#
# Solo las filas EN JUEGO. Una reserva dormida comparte enlace con su titular por
# construccion —es su respaldo— y contarla seria una alarma permanente sobre algo
# que no puede pasar: la dormida no sale a campo.

#' Enlaces de recopilador compartidos por cursos-horario distintos.
#'
#' @param en_juego data.frame de las filas que salen a campo.
#' @return lista con `enlaces` (cuantos estan repetidos), `aulas` (cuantas filas
#'   los comparten), `comprobable` y `ejemplos`.
#' @export
monitoreo_aulas_enlaces_compartidos <- function(en_juego = data.frame()) {
  vacio <- list(enlaces = 0L, aulas = 0L, comprobable = FALSE, ejemplos = character(0))
  if (!is.data.frame(en_juego) || !nrow(en_juego) || !("link" %in% names(en_juego))) return(vacio)

  link <- trimws(as.character(en_juego$link))
  codigo <- if ("operational_code" %in% names(en_juego)) {
    trimws(as.character(en_juego$operational_code))
  } else rep("", length(link))
  con_link <- nzchar(link)
  if (!any(con_link)) return(vacio)

  link <- link[con_link]
  codigo <- codigo[con_link]
  repes <- names(which(table(link) > 1L))
  if (!length(repes)) {
    return(list(enlaces = 0L, aulas = 0L, comprobable = TRUE, ejemplos = character(0)))
  }

  cuantas <- sum(link %in% repes)
  # Un ejemplo por enlace repetido, con los codigos que lo comparten: sin eso el
  # aviso dice que hay un problema y no a donde ir.
  ejemplos <- vapply(utils::head(repes, 3L), function(l) {
    sprintf("%s", paste(utils::head(codigo[link == l], 4L), collapse = " y "))
  }, character(1), USE.NAMES = FALSE)

  list(enlaces = length(repes), aulas = as.integer(cuantas),
       comprobable = TRUE, ejemplos = ejemplos)
}

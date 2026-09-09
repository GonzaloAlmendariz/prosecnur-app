# monitoreo_aulas_publicar_adopcion.R — publicar lee la hoja de los aplicadores
# antes de rehacer «Asignación de aplicadores».
#
# **Por qué existe.** El Sheets de la distribución lo arma la app, pero en el
# camino el coordinador cambia a mano quién va a qué aula: alguien se enferma,
# dos se intercambian el turno, una reserva entra y hay que darle dueño. Esos
# cambios son la verdad del operativo —la gente ya salió a campo con ellos— y
# la app tiene que entenderlos, no reescribirlos.
#
# Publicar el libro ya leía el Sheets OPERATIVO antes de escribir. La hoja de la
# distribución es OTRO documento y no se leía, así que «Asignación de
# aplicadores» se rehacía desde un reparto sin fijar: el sorteo se recalcula
# entero, y un sorteo nuevo no tiene por qué caer donde cayó el que se comunicó.
#
# Medido el 2026-09-09 sobre HSVG2026: la hoja publicada la noche anterior
# contradecía a la de los 22 aplicadores en 38 de 85 aulas, 32 de ese día en
# adelante. Con las fijaciones de la hoja, el reparto coincide 86 de 86.
#
# **Adopta, no propone.** Quien está escrito manda y el sorteo sólo reparte lo
# que sobra. No escribe una celda en esa hoja —eso es `sincronizar-distribucion`,
# que además añade filas y refresca el ESTADO—: aquí sólo se lee.

#' El roster del equipo tal como lo arma el ciclo de la distribución.
#'
#' `monitoreo_aulas_disponibilidad` ES la lista de personas, no un objeto con un
#' campo `personas`: preguntarle por ese campo devuelve NULL, el roster sale
#' vacío y ENTONCES todos los nombres de la hoja caen como «no reconocidos» y no
#' se adopta ni uno. Pasó al escribir esto y el síntoma era «adoptaría 5 de 86».
#'
#' @param s la sesión.
#' @return vector de nombres normalizados.
#' @keywords internal
.malp_roster <- function(s) {
  vapply(s[["monitoreo_aulas_disponibilidad"]] %||% list(), function(x) {
    aulas_nombre_aplicador(x[["nombre"]] %||% x[["aplicador"]] %||% x)
  }, character(1))
}

#' Lee la hoja de los aplicadores y devuelve sus asignaciones como fijaciones.
#'
#' Nunca falla hacia arriba: un Sheets que hoy no se deja leer no puede impedir
#' que el operativo publique su libro. Cada camino dice POR QUÉ no adoptó, que
#' es lo que distingue «no había cambios manuales» de «no se miró».
#'
#' @param aulas_cfg la config de aulas, de donde sale el destino recordado.
#' @param plan filas del plan, para reconocer los curso-horario.
#' @param s la sesión, de donde sale el roster.
#' @return lista `{ok, omitida, motivo, error, hoja, fijadas, aplicadores_desconocidos}`.
#' @keywords internal
.malp_adoptar_distribucion <- function(aulas_cfg, plan, s) {
  vacio <- function(motivo, error = "") {
    list(ok = FALSE, omitida = TRUE, motivo = motivo, error = error, hoja = "",
         fijadas = list(), aplicadores_desconocidos = character(0))
  }
  id <- .monitoreo_scalar(
    (aulas_cfg[["distribucion_sheets"]] %||% list())[["spreadsheet_id"]], "")
  # Sin destino recordado no hay nada que leer, y eso NO es un fallo: hay
  # estudios de aulas que no reparten aplicadores.
  if (!nzchar(id)) return(vacio("sin_destino"))

  tryCatch({
    lec <- monitoreo_aulas_leer_distribucion(id)
    hoja <- .monitoreo_scalar(lec$hoja, "")
    if (!nzchar(hoja)) return(vacio("sin_hoja"))
    remoto <- .cads_valores_de_pestana(id, hoja)
    if (length(remoto) < 2L) return(vacio("hoja_vacia"))
    fij <- monitoreo_aulas_fijaciones_desde_distribucion(remoto, plan, .malp_roster(s))
    list(ok = TRUE, omitida = FALSE, motivo = "", error = "", hoja = hoja,
         fijadas = fij$fijadas %||% list(),
         aplicadores_desconocidos = fij$aplicadores_desconocidos %||% character(0))
  }, error = function(e) vacio("error", conditionMessage(e)))
}

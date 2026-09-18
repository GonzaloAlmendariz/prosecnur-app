# **Qué NO llegó a una hoja del equipo, dicho por su nombre.**
#
# «Aulas Agendadas», «Aulas Aplicadas (Campo)» y sus Extra son del equipo: en
# cuanto tienen contenido, republicar las declara `respetada` y no les llega ni
# una request —ni valores ni formato—. Es la protección correcta y no se toca:
# hay gente tecleando ahí mientras el motor corre.
#
# Lo que sí era un problema es el RECIBO. Publicaba `{hoja, accion, filas}`, así
# que una hoja al día y una a la que le falta una columna entera se leen igual:
# «respetada». Medido el 2026-09-18 sobre CCSS Perfil 2026-II, con el campo a
# cuatro días: el libro del motor ganó la columna CARRERA y creció de 76 a 79
# columnas en «Aulas Agendadas» —el bloque se repite en titular, R1 y R2—, de 25
# a 26 en su Extra y de 120 a 123 en «Aulas Aplicadas (Campo)». Las cuatro son
# del equipo. Quien publique recibe cuatro «respetada» y ninguna señal de que la
# columna con la que se distingue una carrera de otra se quedó fuera.
#
# **Se comparan los RÓTULOS, no los anchos.** La API recorta las celdas vacías
# del final, así que un ancho remoto más corto no prueba que falte nada; y una
# columna insertada a mano desplaza el resto sin perder ningún rótulo. El nombre,
# en cambio, está o no está.

# Los rótulos de las filas de cabecera de una hoja, normalizados para comparar.
# Sin tildes ni mayúsculas porque un rótulo retecleado a mano no tiene por qué
# coincidir byte a byte con el que escribe el motor.
.malp_rotulos_de <- function(filas, n_cabeceras) {
  filas <- filas %||% list()
  if (!length(filas)) return(character(0))
  cuantas <- max(1L, min(as.integer(n_cabeceras %||% 1L), length(filas)))
  crudos <- unlist(lapply(filas[seq_len(cuantas)], function(f) {
    vapply(f %||% list(), function(x) as.character(x %||% "")[1], character(1))
  }), use.names = FALSE)
  crudos <- trimws(crudos %||% character(0))
  crudos[nzchar(crudos)]
}

# El normalizador COMPARTIDO del perfil, no uno propio: `.cm_criterios_fac_key`
# tiene 92 llamadas en 32 archivos y ya arregla tildes, mayúsculas y la ñ. Mi
# primera versión usaba `iconv(to = "ASCII//TRANSLIT")` y en macOS eso escribe
# «TELE'FONO» —con apóstrofo— en vez de quitar la tilde, así que «TELÉFONO DE
# DOCENTE» y «telefono de docente» salían distintos y el test lo cazó.
.malp_clave_rotulo <- function(x) .cm_criterios_fac_key(x)

#' Los rótulos que el motor produce y la hoja remota no tiene.
#'
#' @param producidas filas que el generador produjo para esa hoja.
#' @param remotas filas leídas del documento vivo.
#' @param n_cabeceras cuántas filas de cabecera corona esa hoja.
#' @return vector de rótulos ausentes, en el orden en que el motor los escribe.
#'   Vacío cuando la hoja remota los tiene todos —que es el caso normal—.
#' @keywords internal
monitoreo_aulas_libro_rotulos_retenidos <- function(producidas, remotas, n_cabeceras = 1L) {
  nuestros <- .malp_rotulos_de(producidas, n_cabeceras)
  if (!length(nuestros)) return(character(0))
  suyos <- .malp_clave_rotulo(.malp_rotulos_de(remotas, n_cabeceras))
  faltan <- nuestros[!(.malp_clave_rotulo(nuestros) %in% suyos)]
  unique(faltan)
}

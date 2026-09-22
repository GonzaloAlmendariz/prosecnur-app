# monitoreo_aulas_huerfanas_causa.R — por qué una respuesta no tiene aula.
#
# El tablero decía «19 respuestas válidas no corresponden a ningún curso-horario
# del plan» y ahí se acababa. Son DOS averías distintas metidas en un número, y
# cada una se arregla en un sitio:
#
# - **No trae recopilador.** Alguien abrió el enlace del formulario en vez de
#   escanear el QR del aula. Se arregla hablando con el aplicador, hoy, antes de
#   la siguiente aula. No hay nada que reparar en los datos.
# - **Trae uno que no es de ninguna aula del plan.** Un QR de capacitación, una
#   ficha vieja, el de otro estudio. Se arregla declarándolo en `descartes` o
#   revisando qué ficha se repartió, y **el valor concreto es lo que lo hace
#   accionable**: sin él, «no corresponde a ningún curso-horario» manda a
#   revisar el plan, que está bien.
#
# Medido el 2026-09-22, primer día de campo de CCSS Perfil 2026-II: 19
# huérfanas de 29 respuestas —el 66 % de la base—, y eran 11 sin recopilador
# (pruebas del 15 y el 18 de setiembre, abiertas por enlace) más 8 del QR de
# «CAPACITACION» y «PRUEBA». Con el número junto, el coordinador ve dos tercios
# de su base en una bolsa sin nombre el día que arranca.

#' Por qué las respuestas huérfanas no tienen curso-horario.
#'
#' @param huerfanas máscara lógica de huérfanas, una por respuesta.
#' @param identificadores el identificador de aula YA resuelto de cada
#'   respuesta (`""` cuando la respuesta no trae ninguno). Se usa el mismo
#'   vector con el que se decidió la orfandad: derivarlo otra vez por otro
#'   camino daría dos lecturas de la misma respuesta.
#' @param muestra cuántos valores ajenos se nombran como máximo.
#' @return lista con `total`, `sin_recopilador`, `ajenas`, `valores` y `frase`.
#' @export
monitoreo_aulas_huerfanas_causa <- function(huerfanas, identificadores = character(0),
                                            muestra = 3L) {
  h <- huerfanas %in% TRUE
  total <- as.integer(sum(h))
  ids <- as.character(identificadores %||% character(0))
  # Sin identificadores alineados no se parte el número: se dice el total y ya.
  # Inventar el reparto sería peor que no darlo.
  alineado <- length(ids) == length(h)
  ids_h <- if (alineado) ids[h] else character(0)
  ids_h[is.na(ids_h)] <- ""
  sin_recopilador <- as.integer(sum(!nzchar(ids_h)))
  ajenas <- total - sin_recopilador
  valores <- sort(unique(ids_h[nzchar(ids_h)]))
  list(
    total = total,
    sin_recopilador = if (alineado) sin_recopilador else NA_integer_,
    ajenas = if (alineado) as.integer(ajenas) else NA_integer_,
    valores = valores,
    frase = .mahc_frase(total, if (alineado) sin_recopilador else NA_integer_,
                        if (alineado) ajenas else NA_integer_, valores, muestra)
  )
}

.mahc_frase <- function(total, sin_recopilador, ajenas, valores, muestra = 3L) {
  if (!is.finite(total) || total <= 0L) {
    return("Todas las respuestas válidas se atribuyeron a un curso-horario del plan.")
  }
  cabeza <- sprintf(
    if (total == 1L) "%d respuesta válida no corresponde a ningún curso-horario del plan."
    else "%d respuestas válidas no corresponden a ningún curso-horario del plan.",
    total
  )
  if (!is.finite(sin_recopilador)) return(cabeza)
  partes <- character(0)
  if (sin_recopilador > 0L) {
    partes <- c(partes, sprintf(
      if (sin_recopilador == 1L) "%d no trae recopilador: se abrió el enlace del formulario en vez del QR del aula"
      else "%d no traen recopilador: se abrió el enlace del formulario en vez del QR del aula",
      sin_recopilador))
  }
  if (ajenas > 0L) {
    # Los valores, nombrados. Es lo que convierte el aviso en algo que se puede
    # buscar: «CAPACITACION» se declara en descartes en un minuto.
    nombres <- utils::head(valores, max(1L, as.integer(muestra)))
    cola <- if (length(valores) > length(nombres)) {
      sprintf(" y %d más", length(valores) - length(nombres))
    } else ""
    partes <- c(partes, sprintf(
      if (ajenas == 1L) "%d trae uno que no es de ninguna aula del plan (%s%s)"
      else "%d traen uno que no es de ninguna aula del plan (%s%s)",
      ajenas, paste(nombres, collapse = ", "), cola))
  }
  if (!length(partes)) return(cabeza)
  paste0(cabeza, " ", paste(partes, collapse = "; "), ".")
}

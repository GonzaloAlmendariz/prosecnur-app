# monitoreo_aulas_fijaciones_desfasadas.R — cuándo la adopción se quedó atrás.
#
# El 2026-09-09 la app enseñaba su reparto como si fuera el de la hoja: llevaba
# **86 fijaciones** adoptadas en algún momento anterior, y desde entonces el
# coordinador había movido **11 citas** a otro aplicador. Medido contra la hoja
# real: 94 filas, 81 coinciden, 11 con otro nombre, 2 que la app no reparte.
#
# **Nada en pantalla lo decía.** Ni un aviso, ni un contador: la única forma de
# enterarse era abrir el Sheets y comparar a ojo, y quien mira la pestaña de
# Asignación no tiene por qué sospechar que lo que ve es una foto vieja.
#
# Esto no sale a la red: recibe las fijaciones GUARDADAS y las que la hoja
# implica HOY —que el ensayo de sincronizar ya lee para su propio recuento— y
# las compara. El aviso viaja con el recibo que ya existe, sin un request más.

.mafd_nombre <- function(x) {
  v <- trimws(as.character(x %||% "")[1])
  if (is.na(v)) "" else v
}

#' En qué se quedó atrás la adopción del reparto.
#'
#' Tres cosas distintas, y se dicen por separado porque piden acciones
#' distintas:
#'   - `cambiadas`: la app tiene fijado a alguien y la hoja dice OTRO. Es la que
#'     manda a la persona equivocada al aula, y por eso va con nombre y apellido
#'     de los dos lados.
#'   - `nuevas`: la hoja fija una cita que la app no tenía fijada. Adoptar la
#'     incorpora; no es un error, es trabajo del coordinador sin recoger.
#'   - `retiradas`: la app tiene fijada una cita que la hoja ya no menciona.
#'     Puede ser una fila borrada o una cita que salió de la semana; se declara y
#'     no se toca, porque borrar una fijación es decidir por él.
#'
#' La comparación es por NOMBRE NORMALIZADO (`aulas_nombre_aplicador`), no por
#' cadena cruda: la hoja trae «Castillo SOLORSANO , LEIDY VIVIANA» donde la app
#' guarda «Castillo Solorsano, Leidy Viviana», y contarlas como distintas
#' llenaría el aviso de once falsos y lo volvería ilegible en un día.
#'
#' @param guardadas fijaciones vigentes de la config (`cfg$reparto_fijado`):
#'   lista nombrada código → aplicador.
#' @param en_la_hoja las que la hoja implica hoy, misma forma
#'   (`monitoreo_aulas_fijaciones_desde_distribucion()$fijadas`).
#' @return lista `{cambiadas, nuevas, retiradas, hay}`. `hay` es `TRUE` sólo
#'   cuando hay CAMBIADAS: es la única de las tres que contradice a la app.
#' @export
monitoreo_aulas_fijaciones_desfasadas <- function(guardadas = list(), en_la_hoja = list()) {
  guardadas <- guardadas %||% list()
  en_la_hoja <- en_la_hoja %||% list()
  vacio <- list(cambiadas = list(), nuevas = list(), retiradas = list(), hay = FALSE)
  if (!length(guardadas) && !length(en_la_hoja)) return(vacio)

  codigos_g <- names(guardadas) %||% character(0)
  codigos_h <- names(en_la_hoja) %||% character(0)

  cambiadas <- list()
  for (cod in intersect(codigos_g, codigos_h)) {
    g <- .mafd_nombre(guardadas[[cod]])
    h <- .mafd_nombre(en_la_hoja[[cod]])
    if (!nzchar(g) || !nzchar(h)) next
    # Misma clave que resuelve las fijadas contra la oferta: sin mayúsculas ni
    # tildes, para que «JESÚS» y «Jesus» no se lean como un cambio.
    if (identical(.ana_clave(g), .ana_clave(h))) next
    cambiadas[[length(cambiadas) + 1L]] <- list(
      curso_horario = cod, guardado = g, en_la_hoja = h
    )
  }
  list(
    cambiadas = cambiadas,
    nuevas = as.list(setdiff(codigos_h, codigos_g)),
    retiradas = as.list(setdiff(codigos_g, codigos_h)),
    # **Sólo las cambiadas encienden el aviso.** Una cita nueva en la hoja no
    # contradice a la app —la app simplemente no la tenía— y una retirada
    # tampoco. Encender por las tres haría saltar el aviso cada día del
    # operativo y dejaría de leerse justo cuando importe.
    hay = length(cambiadas) > 0L
  )
}

#' El aviso en una frase, con la causa y el número.
#'
#' «Puede estar desactualizado» no mueve a nadie. Lo que mueve es cuántas y
#' cuáles: el recibo del operativo ya sigue esa regla y ésta es la misma.
#'
#' @param out salida de `monitoreo_aulas_fijaciones_desfasadas()`.
#' @param tope cuántas citas se enumeran antes de resumir.
#' @return una cadena; vacía cuando no hay nada que avisar.
#' @export
monitoreo_aulas_fijaciones_desfasadas_texto <- function(out, tope = 6L) {
  out <- out %||% list()
  cambiadas <- out$cambiadas %||% list()
  if (!length(cambiadas)) return("")
  n <- length(cambiadas)
  muestra <- utils::head(cambiadas, tope)
  detalle <- paste(vapply(muestra, function(c) {
    sprintf("%s (%s → %s)", .mafd_nombre(c$curso_horario),
            .mafd_nombre(c$guardado), .mafd_nombre(c$en_la_hoja))
  }, character(1)), collapse = "; ")
  resto <- n - length(muestra)
  sprintf(
    "El reparto de la app no es el de la hoja: %d cita%s tiene%s otro aplicador escrito (%s%s). Sincroniza para adoptarlas.",
    n, if (n == 1L) "" else "s", if (n == 1L) "" else "n", detalle,
    if (resto > 0L) sprintf(" y %d más", resto) else ""
  )
}

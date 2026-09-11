# Marcar un complemento (B) o un refuerzo (C) como REFUERZO POR CONTACTAR.
#
# Gonzalo, 2026-09-11: «el popover necesita operar sobre B y C porque A se aplica
# desde el mismo Sheets sin ayuda de la app, la app solo lo lee». Por eso esto no
# toca `monitoreo_aulas_activar_reemplazo()`, que es el camino de A: son dos
# circuitos y mezclarlos haria que la app escribiera donde el equipo ya escribe.
#
# DONDE SE VE, hoy: solo en la app. El morado de `.mafs_REGLAS_STATUS_MUESTRA`
# se pinta en «Aulas Agendadas» y «Aulas Aplicadas (Campo)», y las dos son del
# EQUIPO —`respetada`, ni una escritura con contenido remoto—. Para que el
# agendador lo vea en el Sheets hace falta una hoja de la APP, que es decision
# de Gonzalo y no se da por hecha aqui.
#
# Y por eso el estado NO es `agendada`. Gonzalo, el mismo dia: «un refuerzo
# tampoco es una aplicacion garantizada; tambien hay que contactarlo y recien se
# agenda previa su confirmacion». Dejarla en `agendada` la meteria en el aforo
# agendado sin que nadie haya llamado al docente, que es justo el error que este
# perfil lleva toda la jornada corrigiendo.

#' Marca un curso-horario como refuerzo o complemento por contactar.
#'
#' @param plan lista de filas del plan.
#' @param codigo el curso-horario que entra a ayudar.
#' @param para a quien ayuda: el codigo del curso-horario corto (B) o el nombre
#'   de la facultad (C). Queda escrito para que despues se sepa por que entro.
#' @param tipo `"complemento"` o `"refuerzo"`.
#' @param motivo texto libre de quien decide.
#' @param ahora sello de tiempo; por defecto el del sistema.
#' @return lista con `plan` y `marcada`.
#' @export
monitoreo_aulas_marcar_refuerzo <- function(plan = list(), codigo = "", para = "",
                                            tipo = "refuerzo", motivo = "",
                                            ahora = NULL) {
  codigo <- .mar_txt(codigo)
  if (!length(plan)) {
    stop_api(409, "E_AULAS_SIN_PLAN",
             "No hay plan de cursos-horario sobre el que marcar un refuerzo.")
  }
  if (!nzchar(codigo)) {
    stop_api(400, "E_AULA_SIN_CODIGO", "Falta el codigo del curso-horario que entra.")
  }
  tipo <- .mar_txt(tipo, "refuerzo")
  if (!tipo %in% c("refuerzo", "complemento")) {
    stop_api(400, "E_REFUERZO_TIPO",
             sprintf("'%s' no es un tipo de ayuda: son 'complemento' o 'refuerzo'.", tipo))
  }
  pos <- which(vapply(plan, function(r) identical(.mar_txt(r$operational_code), codigo), logical(1)))
  if (!length(pos)) {
    stop_api(404, "E_AULA_NO_ENCONTRADA",
             sprintf("No existe el curso-horario '%s' en el plan.", codigo))
  }
  pos <- pos[[1]]
  fila <- plan[[pos]]
  # **El estado se NORMALIZA antes de compararlo.** El plan que vive en la
  # sesion guarda `sample_status` tal como viene del libro —«SIN CONTACTAR», en
  # mayusculas y con espacio— mientras el vocabulario del motor es
  # `sin_contactar`. Comparar el crudo contra el normalizado hacia que TODAS las
  # reservas del plan real cayeran en «ya esta comprometida»: medido el
  # 2026-09-11 contra el operativo, 1.213 de 1.218 reservas, o sea el circuito
  # entero de refuerzos inalcanzable desde la app.
  estado <- monitoreo_aulas_estado_muestra(fila$sample_status)

  # Ya marcada: se avisa en vez de re-marcar. Volver a escribir el sello borraria
  # cuando se decidio de verdad, y el agendador lo usa para saber que lleva
  # esperando.
  if (identical(estado, "refuerzo_por_contactar")) {
    stop_api(409, "E_REFUERZO_YA_MARCADO",
             sprintf("'%s' ya esta marcada como refuerzo por contactar.", codigo))
  }
  # Comprometida con otra cosa: no se le puede cambiar el estado por debajo.
  if (!estado %in% c(MONITOREO_AULAS_ESTADOS_DORMIDOS, "sin_contactar")) {
    stop_api(409, "E_REFUERZO_NO_DISPONIBLE",
             sprintf("'%s' ya esta comprometida (%s): no se puede marcar para otra cosa.",
                     codigo, .mar_txt(fila$sample_status, "sin estado")))
  }

  ahora <- .mar_txt(ahora, format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
  plan[[pos]]$sample_status <- "refuerzo_por_contactar"
  plan[[pos]]$activated_at <- ahora
  plan[[pos]]$activation_origin <- tipo
  # A quien ayuda. En B es un curso-horario y en C una facultad, y se guarda tal
  # cual: el destino es lo que explica despues por que esta aula entro.
  if (nzchar(.mar_txt(para))) plan[[pos]]$activated_for <- .mar_txt(para)
  if (nzchar(.mar_txt(motivo))) plan[[pos]]$activation_reason <- .mar_txt(motivo)

  list(plan = plan, marcada = plan[[pos]])
}

#' La frase que la vista enseña tras marcar.
#' @param out salida de `monitoreo_aulas_marcar_refuerzo()`.
#' @return texto.
#' @export
monitoreo_aulas_marcar_refuerzo_texto <- function(out) {
  fila <- out$marcada %||% list()
  cod <- .mar_txt(fila$operational_code, "el curso-horario")
  tipo <- .mar_txt(fila$activation_origin, "refuerzo")
  para <- .mar_txt(fila$activated_for)
  # **Lo que se promete es lo que se puede cumplir.** El morado esta definido en
  # la paleta, pero las dos hojas donde se pinta STATUS MUESTRA —«Aulas
  # Agendadas» y «Aulas Aplicadas (Campo)»— son del EQUIPO: la app las declara
  # `respetada` y no emite una sola escritura sobre ellas mientras tengan
  # contenido. Asi que hoy esta marca vive SOLO en la app, y decir otra cosa
  # mandaria al agendador a buscar un color que nadie va a escribir.
  sprintf("%s queda como %s por contactar%s. Por ahora se ve en la app: las hojas de agenda son del equipo y la app no escribe en ellas.",
          cod, tipo, if (nzchar(para)) sprintf(" para %s", para) else "")
}

#' Retira una marca de refuerzo que puso la app.
#'
#' Gonzalo, 2026-09-11, al pedir el autopicker: marcar quince de golpe solo es
#' aceptable si se puede deshacer. Sin esto, un lote mal elegido deja quince
#' cursos-horario apartados y sin forma de devolverlos al inventario.
#'
#' **Solo retira lo que la app puso y nadie ha tocado todavia.** Si el estado ya
#' no es `refuerzo_por_contactar` —el agendador lo paso a EN CONTACTO, a
#' AGENDADA, o el equipo lo escribio en el libro— la marca dejo de ser una
#' decision pendiente y paso a ser una gestion en curso: retirarla borraria
#' trabajo de otra persona. Y si la fila no lleva el sello `activation_origin`
#' de la app, el estado lo escribio alguien mas y no es nuestro para deshacer.
#'
#' @param plan lista de filas del plan.
#' @param codigo el curso-horario cuya marca se retira.
#' @return lista con `plan` y `retirada`.
#' @export
monitoreo_aulas_desmarcar_refuerzo <- function(plan = list(), codigo = "") {
  codigo <- .mar_txt(codigo)
  if (!length(plan)) {
    stop_api(409, "E_AULAS_SIN_PLAN",
             "No hay plan de cursos-horario sobre el que retirar una marca.")
  }
  if (!nzchar(codigo)) {
    stop_api(400, "E_AULA_SIN_CODIGO", "Falta el codigo del curso-horario que se retira.")
  }
  pos <- which(vapply(plan, function(r) identical(.mar_txt(r$operational_code), codigo), logical(1)))
  if (!length(pos)) {
    stop_api(404, "E_AULA_NO_ENCONTRADA",
             sprintf("No existe el curso-horario '%s' en el plan.", codigo))
  }
  pos <- pos[[1]]
  fila <- plan[[pos]]
  # Normalizado por el mismo motivo que arriba: el plan de sesion guarda la
  # forma del libro y el vocabulario del motor es el snake_case.
  estado <- monitoreo_aulas_estado_muestra(fila$sample_status)
  origen <- .mar_txt(fila$activation_origin)

  if (!identical(estado, "refuerzo_por_contactar")) {
    stop_api(409, "E_REFUERZO_YA_EN_MARCHA",
             sprintf("'%s' ya no esta solo marcada (%s): su gestion empezo y retirarla borraria lo que otro anoto.",
                     codigo, .mar_txt(fila$sample_status, "sin estado")))
  }
  if (!origen %in% c("refuerzo", "complemento")) {
    stop_api(409, "E_REFUERZO_AJENO",
             sprintf("La marca de '%s' no la puso la app, asi que no es suya para retirar.", codigo))
  }

  # Vuelve al inventario, que es de donde salio: `sin_contactar` es el estado de
  # una reserva disponible. Los sellos se borran enteros —no se deja un origen
  # huerfano— porque son justo lo que distingue una marca de la app de una
  # casilla que alguien tecleo.
  plan[[pos]]$sample_status <- "sin_contactar"
  plan[[pos]]$activated_at <- NULL
  plan[[pos]]$activation_origin <- NULL
  plan[[pos]]$activated_for <- NULL
  plan[[pos]]$activation_reason <- NULL

  list(plan = plan, retirada = plan[[pos]])
}

#' La frase que la vista enseña tras retirar una marca.
#' @param out salida de `monitoreo_aulas_desmarcar_refuerzo()`.
#' @return texto.
#' @export
monitoreo_aulas_desmarcar_refuerzo_texto <- function(out) {
  cod <- .mar_txt((out$retirada %||% list())$operational_code, "el curso-horario")
  sprintf("%s vuelve al inventario de reservas sin contactar.", cod)
}

# **Qué de este plan ya lo tocó OTRO estudio.**
#
# El cruce DAA (`carga_daa_iagen.R`) contestaba esta pregunta para IAGEN y su
# razonamiento es bueno: dos niveles —el AULA está en el otro estudio, o no está
# pero su DOCENTE sí—, precedencia aula > docente porque el contacto directo pesa
# más que el indirecto, y **vacío cuando no hay traslape, nunca un default**: un
# «sin traslape» inventado habla con la voz de un dato.
#
# Lo que le faltaba era no ser de la DAA. CCSS Perfil 2026-II vive dentro de una
# facultad que HSVG2026 ya barrió, y Gonzalo lo pidió explícito el 2026-09-17:
# «que haga el cruce por solape si es docente ya contactado para la DAA o para
# HSVG o si el curso-horario ya fue seleccionado previamente por HSVG y/o
# aplicado».
#
# **El traslape INFORMA, no descuenta ni excluye.** Es la regla de la casa desde
# el traslape docente de 2025: sale en su columna, no toca el plan ni las cuotas.
# Saber que a este docente ya lo llamaron cambia cómo se le habla, no si se le
# llama.
#
# Dos cosas que este motor NO hace, a propósito:
#
# - **No adivina la clave.** Cruza por `classroom_id` y por correo del docente.
#   El código de docente sería mejor clave, pero el plan de HSVG2026 lo trae
#   VACÍO en sus 1.392 filas (medido), así que el correo es la clave que existe.
#   El nombre no se usa: «ADINS  , SEBASTIEN» trae dos espacios y eso ya rompió
#   un cruce por nombre antes.
# - **No confunde «está en el otro plan» con «ya lo contactaron».** Son dos
#   preguntas y se responden por separado, porque las respuestas difieren mucho:
#   en CCSS, 26 de los 50 titulares tienen su docente en el plan de HSVG y sólo
#   **6** lo tienen con contacto registrado. Publicar el primero como si fuera el
#   segundo mandaría a media muestra a disculparse por una llamada que nadie hizo.

#' El traslape de cada unidad del plan con otro estudio.
#'
#' @param unidades filas del plan (con `operational_code`, `classroom_id` y
#'   `teacher_email`).
#' @param aulas vector de `classroom_id` que el otro estudio tiene en su plan.
#' @param docentes vector de correos de docente que el otro estudio tiene.
#' @param contactados correos que el otro estudio ya CONTACTÓ (subconjunto de
#'   `docentes`, normalmente leído de su libro vivo). Vacío = no se sabe, y
#'   entonces el veredicto no lo afirma.
#' @param aulas_contactadas `classroom_id` del otro estudio con contacto o
#'   aplicación registrada.
#' @param etiqueta nombre corto del otro estudio para el texto de la celda.
#' @param leido_en marca ISO de CUÁNDO se leyó el otro estudio. **Sin ella el
#'   veredicto no dice de cuándo es**, y un traslape sin fecha se lee como si
#'   fuera de hoy: es la peor lectura posible, porque el operativo del otro
#'   estudio se mueve todos los días. Vacío = no se sabe, y se declara.
#' @param fuente de dónde se leyó, en una frase («plan de HSVG2026 + su libro
#'   vivo»). Es lo único que permite repetir la lectura sin adivinar.
#' @return character NOMBRADO por código operativo, con los atributos `rotulo`
#'   —puesto en `TRASLAPE <etiqueta>`, para que la columna del libro se titule
#'   sola—, `leido_en` y `fuente`. Las unidades sin traslape quedan con `""`.
#' @export
aulas_traslape_estudio <- function(unidades, aulas = character(0),
                                   docentes = character(0),
                                   contactados = character(0),
                                   aulas_contactadas = character(0),
                                   etiqueta = "OTRO ESTUDIO",
                                   leido_en = "", fuente = "") {
  nrm <- function(x) tolower(trimws(as.character(unlist(x %||% character(0), use.names = FALSE))))
  aulas <- unique(nrm(aulas)); docentes <- unique(nrm(docentes))
  contactados <- unique(nrm(contactados)); aulas_contactadas <- unique(nrm(aulas_contactadas))
  et <- toupper(trimws(as.character(etiqueta %||% "OTRO ESTUDIO")[1]))

  out <- stats::setNames(character(0), character(0))
  for (u in (unidades %||% list())) {
    if (!is.list(u)) next
    cod <- trimws(as.character(u$operational_code %||% ""))
    if (!nzchar(cod)) next
    aula <- nrm(u$classroom_id %||% "")[1] %||% ""
    correo <- nrm(u$teacher_email %||% "")[1] %||% ""
    # **La precedencia es por FUERZA DE LA EVIDENCIA, no por nivel.**
    #
    # El cruce DAA ponía el aula por delante del docente, y allí tenía sentido:
    # «el aula está en la DAA» significaba que a ese salón ya habían ido. Aquí
    # no: «el aula está en el PLAN de HSVG» puede ser una reserva de cadena que
    # nunca se activó, y eso es más débil que «a su docente ya lo llamaron».
    #
    # Con la precedencia por nivel, cuatro de los seis titulares de CCSS cuyo
    # docente HSVG ya agendó salían rotulados «AULA EN EL PLAN» —la noticia
    # floja tapando la fuerte— y el que llama no se enteraba de que esa persona
    # ya había hablado con nosotros. Medido: 2 en vez de 6.
    #
    # Así que el orden es: lo aplicado, lo contactado, y al final los dos
    # «está en el plan», que sólo dicen que podría pasar.
    veredicto <- ""
    if (nzchar(aula) && aula %in% aulas_contactadas) {
      veredicto <- sprintf("AULA YA APLICADA EN %s", et)
    } else if (nzchar(correo) && correo %in% contactados) {
      veredicto <- sprintf("DOCENTE YA CONTACTADO EN %s", et)
    } else if (nzchar(aula) && aula %in% aulas) {
      veredicto <- sprintf("AULA EN EL PLAN DE %s", et)
    } else if (nzchar(correo) && correo %in% docentes) {
      veredicto <- sprintf("DOCENTE EN EL PLAN DE %s", et)
    }
    out[[cod]] <- veredicto
  }
  # El rótulo viaja CON el veredicto: así la columna del libro se titula sola y
  # no hay que pasar el nombre del estudio por tres firmas.
  attr(out, "rotulo") <- sprintf("TRASLAPE %s", et)
  # La procedencia viaja CON el veredicto, igual que el rótulo: el veredicto se
  # persiste en el `.pulso` y sobrevive a la sesión que lo calculó, así que si la
  # fecha no viaja con él no hay dónde recuperarla.
  attr(out, "leido_en") <- .monitoreo_scalar(leido_en, "")
  attr(out, "fuente") <- .monitoreo_scalar(fuente, "")
  attr(out, "etiqueta") <- et
  out
}

#' Cuántas unidades caen en cada veredicto.
#'
#' El cruce sin su conteo es una columna que nadie sabe si funcionó: con 0 de 136
#' hay que sospechar de la clave antes que del solape.
#'
#' @param traslape salida de [aulas_traslape_estudio()].
#' @return lista con el total y el desglose por veredicto.
#' @export
aulas_traslape_resumen <- function(traslape) {
  v <- as.character(unlist(traslape %||% character(0), use.names = FALSE))
  con <- v[nzchar(v)]
  c(list(
    unidades = length(v),
    con_traslape = length(con),
    por_veredicto = if (length(con)) as.list(table(con)) else list()
  ), aulas_traslape_vigencia(traslape))
}

# Una marca de tiempo a instante, o `NA` — nunca una excepción.
#
# **`as.POSIXct(x, tryFormats = ...)` LANZA cuando ningún formato casa**, no
# devuelve `NA`, y `suppressWarnings()` no lo atrapa porque no es un warning.
# El test lo destapó con «ayer por la tarde»: la función entera reventaba en vez
# de declarar que la fecha no se entiende, que es justo lo que existe para
# hacer.
.cate_instante <- function(x) {
  v <- trimws(as.character(x %||% "")[1])
  if (!nzchar(v)) return(as.POSIXct(NA))
  tryCatch(
    suppressWarnings(as.POSIXct(v, tz = "UTC", tryFormats = c(
      "%Y-%m-%dT%H:%M:%OSZ", "%Y-%m-%dT%H:%M:%S",
      "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"))),
    error = function(e) as.POSIXct(NA)
  )
}

#' De cuándo es el veredicto, y cuánto hace que se leyó.
#'
#' **El traslape es una FOTO de otro operativo que se mueve todos los días.** Su
#' veredicto se persiste en el `.pulso` y sobrevive a la sesión que lo calculó,
#' así que sin fecha se lee como si fuera de hoy — y eso no es una imprecisión,
#' es la lectura equivocada: una unidad que HSVG agendó ayer sigue apareciendo
#' como libre.
#'
#' No hay umbral. La edad se dice y quien lee decide: no existe un número de
#' días medido que separe «vigente» de «caducado», y fabricarlo haría que la
#' pantalla afirmara algo que nadie midió.
#'
#' @param traslape salida de [aulas_traslape_estudio()].
#' @param ahora marca ISO con la que comparar; por defecto, el reloj.
#' @return lista `{etiqueta, leido_en, fuente, dias, aviso}`. `dias` es `NA`
#'   cuando no hay fecha, y `aviso` lo DICE en vez de callarlo.
#' @export
aulas_traslape_vigencia <- function(traslape, ahora = NULL) {
  leido <- .monitoreo_scalar(attr(traslape, "leido_en") %||% "", "")
  fuente <- .monitoreo_scalar(attr(traslape, "fuente") %||% "", "")
  etiqueta <- .monitoreo_scalar(attr(traslape, "etiqueta") %||% "", "")
  vacio <- list(etiqueta = etiqueta, leido_en = "", fuente = fuente,
                dias = NA_integer_, aviso = "")
  if (is.null(traslape) || !length(traslape)) return(vacio)
  if (!nzchar(leido)) {
    vacio$aviso <- paste(
      "El cruce no dice de cuándo es. Es una foto de otro operativo que se",
      "mueve todos los días, así que sin fecha no se puede saber si una unidad",
      "que aparece libre ya fue tomada."
    )
    return(vacio)
  }
  t1 <- .cate_instante(leido)
  t0 <- if (is.null(ahora)) Sys.time() else .cate_instante(.monitoreo_scalar(ahora, ""))
  if (!length(t1) || is.na(t1) || !length(t0) || is.na(t0)) {
    # La fecha está pero no se entiende. Se dice: leerla mal y publicar «hace 0
    # días» sería inventar vigencia.
    return(list(etiqueta = etiqueta, leido_en = leido, fuente = fuente,
                dias = NA_integer_,
                aviso = sprintf("El cruce trae una fecha que no se entiende («%s»).", leido)))
  }
  dias <- as.integer(floor(as.numeric(difftime(t0, t1, units = "days"))))
  list(
    etiqueta = etiqueta, leido_en = leido, fuente = fuente, dias = dias,
    aviso = if (dias <= 0L) "" else sprintf(
      "El cruce se leyó hace %d %s. El operativo del otro estudio se mueve todos los días.",
      dias, if (dias == 1L) "día" else "días")
  )
}

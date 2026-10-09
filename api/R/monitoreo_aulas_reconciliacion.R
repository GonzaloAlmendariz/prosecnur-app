# Reconciliacion del parte de campo de un aula.
#
# El parte declara cuatro numeros que no son independientes:
#
#   asistentes - rechazos - duplicados = efectivas
#
# El Excel NO comprueba esa identidad. Medido sobre el estudio de 2025: falla en
# 2 de 196 partes. Son pocos, y por eso mismo es el tipo de error que nadie
# encuentra a ojo revisando una hoja de 101 columnas.
#
# Este control no corrige nada ni decide cual de los cuatro numeros esta mal:
# senala la fila y muestra la resta. Quien sabe que paso en esa aula es el
# equipo, no la app.

#' Diferencia entre lo que el parte declara y lo que sus numeros implican.
#'
#' @param parte una fila de parte de campo.
#' @return lista con `esperado`, `declarado` y `diferencia`, o `NULL` si el
#'   parte no trae numeros suficientes para comprobar nada.
#' @export
monitoreo_aulas_parte_descuadre <- function(parte) {
  num <- function(claves) {
    v <- suppressWarnings(as.numeric(.monitoreo_aulas_parte_primero(parte, claves) %||% NA))
    if (length(v) != 1L || !is.finite(v)) NA_real_ else v
  }
  # **Las MISMAS listas de alias que usa la publicacion, y por eso viven en un
  # solo sitio.** Esta funcion leia unicamente la clave inglesa mientras
  # `monitoreo_aulas_partes_publicados()` ya leia las cuatro, asi que la tabla
  # enseñaba «45 asistentes · 28 efectivas» y la comprobacion de esa misma fila
  # devolvia NULL. Medido el 2026-08-30 sobre el estudio de 152 partes: **0 de
  # 152 traen `observed_students` y los 152 traen `asistentes`** —igual con
  # `effective_surveys` frente a `validas`—, asi que no se comprobo ni uno y el
  # control de Validacion publicaba «Los numeros de cada parte de campo
  # cuadran» en verde. Es el «verde por ausencia» que el Contrato de Superficie
  # prohibe, y lo cometia justo el control que existe para cazar descuadres.
  asistentes <- num(.MONITOREO_AULAS_PARTE_ALIAS$asistentes)
  efectivas <- num(.MONITOREO_AULAS_PARTE_ALIAS$efectivas)
  # Sin estos dos no hay identidad que comprobar. Suponer cero donde no hay
  # dato inventaria un descuadre que quiza no existe.
  if (!is.finite(asistentes) || !is.finite(efectivas)) return(NULL)
  rechazos <- num(.MONITOREO_AULAS_PARTE_ALIAS$rechazos)
  duplicados <- num(.MONITOREO_AULAS_PARTE_ALIAS$duplicados)
  # Rechazos y duplicados SI se asumen cero cuando faltan: son cantidades de
  # eventos que, de no haberse anotado, no ocurrieron.
  if (!is.finite(rechazos)) rechazos <- 0
  if (!is.finite(duplicados)) duplicados <- 0
  esperado <- asistentes - rechazos - duplicados
  list(
    esperado = esperado,
    declarado = efectivas,
    diferencia = efectivas - esperado
  )
}

#' Partes cuyos numeros no reconcilian.
#'
#' @param partes lista de partes de campo.
#' @param tolerancia diferencia absoluta que se considera cuadrada.
#' @return lista de hallazgos, uno por parte descuadrado.
#' @export
monitoreo_aulas_reconciliacion_partes <- function(partes = list(), tolerancia = 0.5) {
  if (!length(partes)) return(list())
  out <- list()
  for (p in partes) {
    if (!is.list(p)) next
    d <- monitoreo_aulas_parte_descuadre(p)
    if (is.null(d) || abs(d$diferencia) <= tolerancia) next
    out[[length(out) + 1L]] <- list(
      operational_code = as.character(p$operational_code %||% p$classroom_id %||% ""),
      # A QUIEN PREGUNTARLE, que es lo que el aviso no tenia. ADR 0077, clausula
      # 4: «toda alerta de calidad nombra a quien llamar y que preguntarle, o no
      # se emite». El descuadre decia el aula y su aritmetica y ahi paraba, asi
      # que quien lo leia tenia que ir a otra pantalla a averiguar quien estuvo
      # en esa aula. Los alias son los mismos que `monitoreo_aulas_universitarias.R`
      # ya acepta al componer el parte: un libro llenado en castellano trae
      # `aplicador`, no `applied_by`.
      aplicador = trimws(as.character(p$applied_by %||% p$aplicador %||% p$aplicadora %||% "")),
      intento = as.integer(p$intento %||% 1L),
      # Por alias, igual que la publicacion y que el propio descuadre: leyendo
      # solo la clave inglesa el aviso salia «45 asistentes menos NA rechazos».
      asistentes = suppressWarnings(as.numeric(
        .monitoreo_aulas_parte_primero(p, .MONITOREO_AULAS_PARTE_ALIAS$asistentes) %||% NA)),
      rechazos = suppressWarnings(as.numeric(
        .monitoreo_aulas_parte_primero(p, .MONITOREO_AULAS_PARTE_ALIAS$rechazos) %||% NA)),
      duplicados = suppressWarnings(as.numeric(
        .monitoreo_aulas_parte_primero(p, .MONITOREO_AULAS_PARTE_ALIAS$duplicados) %||% NA)),
      esperado = d$esperado,
      efectivas = d$declarado,
      diferencia = d$diferencia
    )
  }
  out
}

#' Los partes de campo, listos para publicarse en el tablero.
#'
#' Hasta ahora del parte solo salia del motor lo que NO cuadraba: el control de
#' Validacion nombraba `CH 31` y `CH 112` y no habia donde ir a mirarlos. Lo que
#' el equipo anota en la hoja «Aulas Aplicadas (Campo)» —asistentes, rechazos,
#' duplicados, efectivas, quien aplico, en que aula y cuando— no se veia en
#' ninguna tabla de la aplicacion.
#'
#' La resta se calcula AQUI, con la misma funcion que decide el descuadre. Si la
#' hiciera el frontend habria dos reglas para la misma identidad y bastaria con
#' que una cambiara para que la tabla y el aviso dijeran cosas distintas.
#'
#' @param partes lista de partes de campo.
#' @param tolerancia diferencia absoluta que se considera cuadrada.
#' @return lista de filas con los campos del parte mas `esperado`,
#'   `diferencia` y `cuadra`.
#' @export
monitoreo_aulas_partes_publicados <- function(partes = list(), tolerancia = 0.5) {
  if (!length(partes)) return(list())
  num <- function(x) {
    v <- suppressWarnings(as.numeric(x %||% NA))
    if (length(v) != 1L || !is.finite(v)) NA_real_ else v
  }
  txt <- function(x) as.character(x %||% "")
  # **El parte llega con las claves en español y salia vacio.**
  #
  # Medido el 2026-08-29 sobre el simulacro de campo malo: de los 14 campos que
  # publica esta funcion, **solo `operational_code` llegaba con valor; los otros
  # 13 vacios en los 152 partes**. El estado guarda cada parte como
  # `fecha · aplicador · asistentes · enviadas · validas`, todos llenos, y aqui
  # se pedian `applied_at`, `applied_by`, `observed_students`,
  # `applied_surveys`, `effective_surveys`. Ninguna coincidia, asi que el panel
  # «Partes de campo» enseñaba 152 filas con solo un codigo.
  #
  # Es el mismo patron que `monitoreo_aulas_normalize_plan()` ya resuelve con
  # sus listas de alias —`get(c("applied_by", "aplicador", "aplicadora"), "")`—
  # y de la que esta capa se quedo fuera. Se toma el PRIMERO que traiga valor:
  # si el libro real escribe la clave en ingles, esa manda.
  # El mismo lector que usa la comprobacion del descuadre: dos copias de esta
  # regla fue exactamente el defecto que se reparo aqui.
  primero <- .monitoreo_aulas_parte_primero
  out <- list()
  for (p in partes) {
    if (!is.list(p)) next
    d <- monitoreo_aulas_parte_descuadre(p)
    out[[length(out) + 1L]] <- list(
      operational_code = txt(p$operational_code %||% p$classroom_id),
      observed_students = num(primero(p, .MONITOREO_AULAS_PARTE_ALIAS$asistentes)),
      # El `% ASISTENCIA` que el equipo escribe a mano en la hoja. Se publica
      # tal cual —no se deriva de `observed_students`— porque el numerador y el
      # denominador que uso el equipo son suyos, y porque un porcentaje que no
      # cuadra con los asistentes que la misma fila declara es en si mismo un
      # hallazgo del cuadre.
      attendance_pct = num(primero(p, .MONITOREO_AULAS_PARTE_ALIAS$asistencia_pct)),
      refusals = num(primero(p, .MONITOREO_AULAS_PARTE_ALIAS$rechazos)),
      duplicates = num(primero(p, .MONITOREO_AULAS_PARTE_ALIAS$duplicados)),
      effective_surveys = num(primero(p, .MONITOREO_AULAS_PARTE_ALIAS$efectivas)),
      # `esperado` es la cuenta que implican los otros tres numeros; sin los dos
      # imprescindibles no hay identidad que comprobar y se publica vacio en vez
      # de un cero que parecerian datos.
      esperado = if (is.null(d)) NA_real_ else d$esperado,
      diferencia = if (is.null(d)) NA_real_ else d$diferencia,
      cuadra = if (is.null(d)) NA else abs(d$diferencia) <= tolerancia,
      # **El estado, que el lector leia y el publicador tiraba.**
      #
      # `application_status` viene de «STATUS DE APLICACION» del libro —«No
      # aplicada», «Aplicada»— y es lo que explica una fila de ceros. La tabla
      # de Consultas lo pide por nombre en sus `preferredColumns` desde que se
      # escribio, y nunca llego: visto en pantalla el 2026-08-23, un parte de un
      # aula que el docente cancelo salia como «0 asistentes · 0 % · 0
      # efectivas» junto a dos aplicadas, sin nada que distinguiera «no se
      # aplico» de «se aplico y no vino nadie».
      #
      # Son dos hechos MUY distintos para quien decide si reagendar.
      application_status = txt(primero(p, c("application_status", "status", "estado_aplicacion"))),
      applied_by = txt(primero(p, .MONITOREO_AULAS_PARTE_ALIAS$aplicador)),
      actual_room = txt(primero(p, c("actual_room", "aula_real", "salon_real"))),
      # `fecha` es la clave que usa el estado; la del libro llega como
      # `applied_date`. Se prueban todas y sólo se cae al `paste` cuando hay
      # fecha y hora sueltas.
      applied_at = local({
        directo <- primero(p, c("applied_at", "fecha", "fecha_aplicacion"))
        if (!is.null(directo)) txt(directo)
        else trimws(paste(txt(p$applied_date), txt(p$applied_time)))
      }),
      field_note = txt(primero(p, c("field_note", "nota_campo", "observaciones"))),
      # El enlace de la ficha QR ESCANEADA (B6c): columna manual de la hoja de
      # campo. Mismo precedente que `attendance_pct` y que `application_status`:
      # un lector que lo lee y un publicador que lo tira dejan el dato muerto
      # camino a la UI, y la ficha del registro (fase 2) lo busca aqui.
      scanned_sheet_link = txt(primero(p, .MONITOREO_AULAS_PARTE_ALIAS$enlace_escaneado))
    )
  }
  out
}

#' Frase que explica un descuadre sin jerga.
#'
#' @param hallazgo un elemento de `monitoreo_aulas_reconciliacion_partes()`.
#' @return texto en espanol.
#' @export
monitoreo_aulas_descuadre_texto <- function(hallazgo) {
  faltan <- hallazgo$diferencia < 0
  # **El aviso dice POR QUE, no solo cuanto** (ADR 0077, clausula 4). Cuando el
  # libro no trae columna de rechazos ni de duplicados, la resta se hace contra
  # cero y el descuadre es, casi siempre, justo lo que nadie anoto: decir «menos
  # 0 rechazos» lo presenta como si el equipo hubiera declarado que no hubo
  # ninguno. Medido el 2026-08-30: los 152 partes del estudio llegan sin esas
  # dos columnas, y 144 descuadran por eso.
  sin_declarar <- !is.finite(hallazgo$rechazos %||% NA_real_) &&
    !is.finite(hallazgo$duplicados %||% NA_real_)
  if (sin_declarar && !faltan) {
    # Mas efectivas que asistentes no es una anotacion que falte: es imposible,
    # y no anotar rechazos no lo explica. Se dice por su nombre.
    return(sprintf(
      "%s: el parte declara %s efectivas y sólo %s asistentes en el aula, %s más de las que cabrían.%s",
      hallazgo$operational_code,
      format(hallazgo$efectivas, trim = TRUE),
      format(hallazgo$asistentes, trim = TRUE),
      format(abs(hallazgo$diferencia), trim = TRUE),
      if (nzchar(hallazgo$aplicador %||% "")) sprintf(" Lo aplicó %s.", hallazgo$aplicador) else ""
    ))
  }
  if (sin_declarar) {
    return(sprintf(
      "%s: el parte declara %s asistentes y %s efectivas, y no anota rechazos ni duplicados, así que no explica %s.%s",
      hallazgo$operational_code,
      format(hallazgo$asistentes, trim = TRUE),
      format(hallazgo$efectivas, trim = TRUE),
      format(abs(hallazgo$diferencia), trim = TRUE),
      if (nzchar(hallazgo$aplicador %||% "")) sprintf(" Lo aplicó %s.", hallazgo$aplicador) else ""
    ))
  }
  sprintf(
    "%s: %s asistentes menos %s rechazos y %s duplicados dan %s, pero el parte declara %s efectivas (%s %s).%s",
    hallazgo$operational_code,
    format(hallazgo$asistentes, trim = TRUE),
    format(hallazgo$rechazos %||% 0, trim = TRUE),
    format(hallazgo$duplicados %||% 0, trim = TRUE),
    format(hallazgo$esperado, trim = TRUE),
    format(hallazgo$efectivas, trim = TRUE),
    if (faltan) "faltan" else "sobran",
    format(abs(hallazgo$diferencia), trim = TRUE),
    # Sin aplicador NO se inventa un destinatario: un parte sin `applied_by` es
    # comun al principio del campo, y un «—» sugeriria que hay alguien a quien
    # llamar. El aviso sale igual, porque la aritmetica no cuadra igual.
    if (nzchar(hallazgo$aplicador %||% "")) sprintf(" Lo aplicó %s.", hallazgo$aplicador) else ""
  )
}

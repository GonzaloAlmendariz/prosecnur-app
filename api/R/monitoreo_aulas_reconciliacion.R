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
  num <- function(campo) {
    v <- suppressWarnings(as.numeric(parte[[campo]] %||% NA))
    if (length(v) != 1L || !is.finite(v)) NA_real_ else v
  }
  asistentes <- num("observed_students")
  efectivas <- num("effective_surveys")
  # Sin estos dos no hay identidad que comprobar. Suponer cero donde no hay
  # dato inventaria un descuadre que quiza no existe.
  if (!is.finite(asistentes) || !is.finite(efectivas)) return(NULL)
  rechazos <- num("refusals")
  duplicados <- num("duplicates")
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
      asistentes = suppressWarnings(as.numeric(p$observed_students %||% NA)),
      rechazos = suppressWarnings(as.numeric(p$refusals %||% NA)),
      duplicados = suppressWarnings(as.numeric(p$duplicates %||% NA)),
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
  primero <- function(p, claves) {
    for (k in claves) {
      v <- p[[k]]
      if (!is.null(v) && length(v) == 1L && !is.na(v) &&
          (!is.character(v) || nzchar(trimws(v)))) return(v)
    }
    NULL
  }
  out <- list()
  for (p in partes) {
    if (!is.list(p)) next
    d <- monitoreo_aulas_parte_descuadre(p)
    out[[length(out) + 1L]] <- list(
      operational_code = txt(p$operational_code %||% p$classroom_id),
      observed_students = num(primero(p, c("observed_students", "asistentes", "alumnos_en_aula", "aforo_observado"))),
      # El `% ASISTENCIA` que el equipo escribe a mano en la hoja. Se publica
      # tal cual —no se deriva de `observed_students`— porque el numerador y el
      # denominador que uso el equipo son suyos, y porque un porcentaje que no
      # cuadra con los asistentes que la misma fila declara es en si mismo un
      # hallazgo del cuadre.
      attendance_pct = num(primero(p, c("attendance_pct", "pct_asistencia", "porcentaje_asistencia"))),
      refusals = num(primero(p, c("refusals", "rechazos"))),
      duplicates = num(primero(p, c("duplicates", "duplicados"))),
      effective_surveys = num(primero(p, c("effective_surveys", "validas", "efectivas"))),
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
      applied_by = txt(primero(p, c("applied_by", "aplicador", "aplicadora", "applicator"))),
      actual_room = txt(primero(p, c("actual_room", "aula_real", "salon_real"))),
      # `fecha` es la clave que usa el estado; la del libro llega como
      # `applied_date`. Se prueban todas y sólo se cae al `paste` cuando hay
      # fecha y hora sueltas.
      applied_at = local({
        directo <- primero(p, c("applied_at", "fecha", "fecha_aplicacion"))
        if (!is.null(directo)) txt(directo)
        else trimws(paste(txt(p$applied_date), txt(p$applied_time)))
      }),
      field_note = txt(primero(p, c("field_note", "nota_campo", "observaciones")))
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
    if (nzchar(hallazgo$aplicador %||% "")) sprintf(" Lo aplico %s.", hallazgo$aplicador) else ""
  )
}

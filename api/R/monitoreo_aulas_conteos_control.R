# Lo que la PLATAFORMA sabe de cada aula, para la «Base de control».
#
# Gonzalo, 2026-09-07, sobre el libro publicado a media jornada del primer día
# de campo: «y por qué todo esto está vacía». El bloque entero —total enviadas,
# los filtros de validación, cortas y largas— eran las fórmulas que el equipo
# tecleaba en su Excel de 2025 sobre un export descargado a mano. Desde que
# Monitoreo lee la plataforma, esas cuentas las tiene el motor y dejarlas en
# blanco es pedirle al equipo que rehaga a mano lo que la app ya sabe.
#
# Y en el mismo dictado: «cortas y largas ya no existe, es efectivas y no
# efectivas (en plataforma)». La partición por DURACIÓN existía porque en 2025
# no había criterio de validez con el que partir; hoy lo hay.
#
# Esto NO reimplementa el cruce: envuelve los mismos helpers que usa el resto
# del perfil —criterio de validez, identificador del aula, conteo por fila— por
# la misma razón que `monitoreo_aulas_efectivas.R`, que una segunda copia se
# separa de la primera en cuanto una cambie.

#' El nombre con el que se enseña un filtro de validez en la cabecera.
#'
#' Pendiente declarado en la spec desde que los «VALIDADOR n» se renombraron:
#' que la columna diga QUÉ filtro cuenta, no su número. Con el criterio
#' declarado, «FILTRO: inicio/consent_1» le dice al equipo dónde mirar cuando
#' un aula pierde respuestas; «FILTRO DE VALIDACIÓN 1» no.
#' @keywords internal
.macc_titulo_filtro <- function(filtro, i) {
  var <- .monitoreo_scalar(filtro$var %||% "", "")
  base <- sprintf("FILTRO DE VALIDACIÓN %d", i)
  # El nombre de la variable va entre paréntesis y NO sustituye al rótulo: la
  # hoja la abren la coordinación y la universidad, y «inicio/consent_1» a secas
  # es jerga de formulario en un documento formal. Con el rótulo delante, el
  # paréntesis dice dónde mirar sin quitarle registro a la cabecera.
  if (nzchar(var)) sprintf("%s (%s)", base, var) else base
}

#' Conteos por aula de las respuestas de la plataforma.
#'
#' @param plan filas del plan (formato largo de Monitoreo).
#' @param responses `data.frame` de respuestas de la plataforma.
#' @param cfg config de aulas universitarias, con sus filtros de validez.
#' @return `NULL` si no hay con qué contar; si no, una lista con
#'   `enviadas`, `efectivas`, `no_efectivas` y `ultimo_dia` (vectores con
#'   nombre por código operativo) y `filtros`, una lista de
#'   `list(titulo, conteo)` en el orden en que el estudio los declara.
#' @export
monitoreo_aulas_conteos_control <- function(plan, responses, cfg = list()) {
  if (!length(plan) || !is.data.frame(responses) || !nrow(responses)) return(NULL)
  plan_df <- .monitoreo_aulas_df(monitoreo_aulas_normalize_plan(plan), "plan")
  if (!nrow(plan_df)) return(NULL)

  aula <- .monitoreo_aulas_response_classroom(responses, cfg)
  valida <- .monitoreo_aulas_valid_response(responses, cfg)
  codigos <- plan_df$operational_code

  por_fila <- function(mask) stats::setNames(
    .monitoreo_aulas_contar_por_fila(plan_df, .monitoreo_aulas_named_counts(aula, mask)),
    codigos
  )
  enviadas <- por_fila(NULL)
  efectivas <- por_fila(valida)

  # **Cada filtro se cuenta POR SEPARADO, no acumulado.** La pregunta que
  # contesta la columna es «cuántas de las que llegaron pasan ESTE filtro», que
  # es lo que dice dónde se pierden: si consent_1 deja pasar 185 de 204 y el
  # filtro de elegibilidad 178, el equipo sabe que el recorte grande es el
  # segundo. Acumulándolos, la última columna repetiría a las efectivas y las
  # otras dos no dirían nada propio.
  filtros <- monitoreo_aulas_filtros_de_validez(cfg)
  por_filtro <- lapply(seq_along(filtros), function(i) {
    f <- filtros[[i]]
    # **Se cuentan las que CAEN, no las que pasan.** Gonzalo, 2026-09-08: «son
    # los que se quedan en el filtro, no los que los pasan». Es la lectura
    # accionable: «se cayeron 4 en el consentimiento» dice dónde se pierde;
    # «pasaron 27» obliga a restar contra las enviadas para saber lo mismo.
    #
    # Un filtro cuya columna no está en la base no se aplica —misma regla que
    # `.monitoreo_aulas_valid_response()`— y su columna sale vacía en vez de
    # contar cero, que se leería como «no cayó ninguna».
    conteo <- if (!f$var %in% names(responses)) NULL else por_fila(
      !(.monitoreo_text_key(responses[[f$var]]) %in% .monitoreo_text_key(f$values))
    )
    list(titulo = .macc_titulo_filtro(f, i), conteo = conteo)
  })

  # **Cuánto tardó cada encuesta EFECTIVA.** `start` y `end` traen su huso, así
  # que la resta es directa; las que no traigan las dos marcas no cuentan, y un
  # aula sin ninguna legible deja las tres columnas vacías en vez de en cero.
  duracion <- local({
    vacio <- stats::setNames(numeric(0), character(0))
    nada <- list(media = vacio, minimo = vacio, maximo = vacio)
    c_ini <- .monitoreo_aulas_col(responses, c("start", "_start", "inicio"))
    c_fin <- .monitoreo_aulas_col(responses, c("end", "_end", "fin"))
    if (!nzchar(c_ini) || !nzchar(c_fin)) return(nada)
    momento <- function(x) {
      # El desfase llega como «-05:00» y `%z` lo quiere sin los dos puntos.
      crudo <- sub("([+-][0-9]{2}):([0-9]{2})$", "\\1\\2", trimws(as.character(x)))
      suppressWarnings(as.POSIXct(crudo, format = "%Y-%m-%dT%H:%M:%OS%z", tz = "UTC"))
    }
    mins <- as.numeric(difftime(momento(responses[[c_fin]]), momento(responses[[c_ini]]),
                                units = "mins"))
    llave <- trimws(as.character(aula))
    ok <- valida %in% TRUE & nzchar(llave) & is.finite(mins) & mins >= 0
    if (!any(ok)) return(nada)
    agrega <- function(f) {
      v <- tapply(mins[ok], llave[ok], f, simplify = TRUE)
      stats::setNames(as.numeric(v), names(v))
    }
    list(media = agrega(mean), minimo = agrega(min), maximo = agrega(max))
  })

  # **Cuándo empezó y hasta cuándo siguió entrando gente.**
  #
  # El ÚLTIMO día contesta lo segundo. El PRIMERO es la fecha —y la hora— en que
  # ese curso-horario se aplicó según la plataforma: «tienes la información de
  # cuándo inicia la encuesta, cuándo finaliza… lo que a nosotros nos importa es
  # lo que sale en la plataforma». Se toma la primera respuesta y no la última:
  # la última puede ser un rezagado que contestó por la noche.
  sello <- local({
    # La columna que trae su HUSO, no la del servidor: ver
    # `monitoreo_aulas_hora_local.R`. Con UTC, un aula de las 19:30 de Lima cae
    # en la jornada del día siguiente.
    col <- .monitoreo_aulas_col(responses, MONITOREO_AULAS_COLUMNAS_TIEMPO)
    vacio <- stats::setNames(character(0), character(0))
    if (!nzchar(col)) return(list(primero = vacio, ultimo = vacio, hora = vacio))
    crudo <- trimws(as.character(responses[[col]]))
    fecha <- monitoreo_aulas_fecha_local(crudo)
    llave <- trimws(as.character(aula))
    ok <- nzchar(llave) & nzchar(fecha)
    if (!any(ok)) return(list(primero = vacio, ultimo = vacio, hora = vacio))
    # La hora de la PRIMERA respuesta del aula: se ordena por el sello completo,
    # que es ISO y por tanto ordena bien como texto.
    orden <- order(llave[ok], crudo[ok], method = "radix")
    k <- llave[ok][orden]; c_ord <- crudo[ok][orden]
    primeros <- !duplicated(k)
    hora <- monitoreo_aulas_hora_local(c_ord[primeros])
    names(hora) <- k[primeros]
    hora <- hora[nzchar(hora)]
    list(
      primero = tapply(fecha[ok], llave[ok], min, simplify = TRUE),
      ultimo = tapply(fecha[ok], llave[ok], max, simplify = TRUE),
      hora = hora
    )
  })

  list(
    enviadas = enviadas,
    efectivas = efectivas,
    no_efectivas = stats::setNames(
      pmax(0, as.numeric(enviadas) - as.numeric(efectivas)), codigos),
    filtros = por_filtro,
    duracion_media = duracion$media,
    duracion_min = duracion$minimo,
    duracion_max = duracion$maximo,
    primer_dia = sello$primero,
    primera_hora = sello$hora,
    ultimo_dia = sello$ultimo
  )
}

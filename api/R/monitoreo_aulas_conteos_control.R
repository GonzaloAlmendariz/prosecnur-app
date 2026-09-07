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
    # Un filtro cuya columna no está en la base no se aplica —misma regla que
    # `.monitoreo_aulas_valid_response()`— y su columna sale vacía en vez de
    # contar cero, que se leería como «ninguna pasó».
    conteo <- if (!f$var %in% names(responses)) NULL else por_fila(
      .monitoreo_text_key(responses[[f$var]]) %in% .monitoreo_text_key(f$values)
    )
    list(titulo = .macc_titulo_filtro(f, i), conteo = conteo)
  })

  # El ÚLTIMO día con respuesta, no el primero: la columna pregunta hasta cuándo
  # siguió entrando gente. El primero ya lo dice la fecha de aplicación.
  ultimo <- local({
    col <- .monitoreo_aulas_col(responses, c("_submission_time", "submission_time", "end", "start"))
    if (!nzchar(col)) return(stats::setNames(character(0), character(0)))
    fecha <- substr(trimws(as.character(responses[[col]])), 1, 10)
    ok <- nzchar(trimws(as.character(aula))) &
      grepl("^[0-9]{4}-[0-9]{2}-[0-9]{2}$", fecha)
    if (!any(ok)) return(stats::setNames(character(0), character(0)))
    tapply(fecha[ok], trimws(as.character(aula))[ok], max, simplify = TRUE)
  })

  list(
    enviadas = enviadas,
    efectivas = efectivas,
    no_efectivas = stats::setNames(
      pmax(0, as.numeric(enviadas) - as.numeric(efectivas)), codigos),
    filtros = por_filtro,
    ultimo_dia = ultimo
  )
}

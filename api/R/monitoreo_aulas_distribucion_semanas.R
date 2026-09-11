# monitoreo_aulas_distribucion_semanas.R — una pestaña por semana en el Sheets
# de los aplicadores.
#
# Dictado de Gonzalo, dos veces y con nueve días de diferencia:
#   · 2026-09-08, cuando la app leía cero citas de un documento con ochenta y
#     seis porque buscaba «Plan del día» y la pestaña se llamaba «Semana 1»:
#     «cada hoja va a ser por semana».
#   · 2026-09-11, al armar el reparto del 14 al 18: «ojo, el reparto va a una
#     segunda hoja llamada Semana 2» y «que la app aprenda a escribir una
#     pestaña por semana».
#
# La primera vez sólo se arregló la LECTURA —`.madc_pestana_de_la_distribucion`
# localiza la pestaña por su cabecera y no por su nombre—, y eso desbloqueó el
# día pero dejó la mitad que importa sin hacer: el publicador seguía escribiendo
# siempre en `«Plan del día»`. Con dos semanas en curso eso tiene una sola
# salida mala: la semana nueva encima de la vieja.
#
# **Por qué la semana y no el rango del reparto.** El rango es un filtro de la
# app y se mueve (hoy 14-18, mañana 14-20); la semana es del operativo y no se
# mueve: el aplicador abre «Semana 2» y ve su semana, esté el rango como esté.
# Por eso la partición se hace sobre las FECHAS de las citas y no sobre el
# rango: un reparto que cruce el domingo produce dos pestañas sin que nadie
# tenga que acordarse de partirlo.
#
# **El origen se ancla al plan, no a lo que se publica.** Si se contara desde la
# primera cita del reparto vigente, en cuanto la semana 1 saliera del rango la
# semana 2 pasaría a llamarse «Semana 1» y el documento se renumeraría solo
# encima de la gente. El origen es el lunes de la semana de la primera aula
# agendada del plan, que no cambia mientras el plan conserve su historia.

#' El lunes de la semana de una fecha ISO.
#'
#' Devuelve `NA` para lo ilegible en vez de adivinar: una fecha rota no debe
#' inventar una semana, debe caer al nombre de siempre.
#' @keywords internal
.mads_lunes_de <- function(fecha) {
  txt <- .monitoreo_scalar(fecha, "")
  # La forma ISO se exige ANTES de convertir: `as.Date("ayer")` no avisa, LANZA
  # («character string is not in a standard unambiguous format»), y un
  # `suppressWarnings` no lo atrapa. Una fecha tecleada a mano en la hoja
  # tumbaba la publicación entera desde aquí.
  if (!grepl("^\\d{4}-\\d{2}-\\d{2}$", txt)) return(as.Date(NA))
  f <- suppressWarnings(as.Date(txt))
  if (length(f) != 1L || is.na(f)) return(as.Date(NA))
  # `%u` es 1 el lunes y 7 el domingo (ISO 8601). Sin él, `weekdays()` depende
  # del locale y la semana empezaría en domingo la mitad de las máquinas.
  f - (as.integer(format(f, "%u")) - 1L)
}

#' El lunes desde el que se cuentan las semanas del operativo.
#'
#' Es el lunes de la semana de la PRIMERA aula agendada del plan. Se toma del
#' plan y no del reparto a propósito: ver la cabecera de este archivo.
#'
#' @param plan filas del plan (lista o data.frame).
#' @return un `Date` (el lunes) o `NA` si el plan no trae ninguna fecha.
#' @export
monitoreo_aulas_inicio_de_campo <- function(plan = list()) {
  filas <- if (is.data.frame(plan)) split(plan, seq_len(nrow(plan))) else (plan %||% list())
  fechas <- vapply(filas, function(u) .monitoreo_scalar(u[["scheduled_date"]], ""), character(1))
  fechas <- suppressWarnings(as.Date(fechas[nzchar(fechas)]))
  fechas <- fechas[!is.na(fechas)]
  if (!length(fechas)) return(as.Date(NA))
  .mads_lunes_de(format(min(fechas)))
}

#' ¿De qué semana del operativo es esta fecha?
#'
#' @param fecha fecha ISO de la cita.
#' @param inicio el lunes origen (`monitoreo_aulas_inicio_de_campo()`).
#' @return entero >= 1, o `NA` si alguna de las dos no es legible o la fecha
#'   cae ANTES del origen (que significa que el origen está mal, no que exista
#'   una semana cero).
#' @export
monitoreo_aulas_semana_de <- function(fecha, inicio) {
  lunes <- .mads_lunes_de(fecha)
  origen <- if (inherits(inicio, "Date")) inicio else .mads_lunes_de(inicio)
  if (is.na(lunes) || length(origen) != 1L || is.na(origen)) return(NA_integer_)
  n <- as.integer(as.numeric(lunes - origen) / 7) + 1L
  if (is.na(n) || n < 1L) return(NA_integer_)
  n
}

#' El nombre de la pestaña de una semana.
#'
#' «Semana 2», tal como Gonzalo la nombró y como el equipo ya había llamado a
#' la suya antes de que la app supiera escribirla.
#' @keywords internal
.mads_hoja_de_semana <- function(n) {
  n <- suppressWarnings(as.integer(n)[1])
  if (is.na(n) || n < 1L) return("")
  paste("Semana", n)
}

#' Parte un reparto en un reparto por semana.
#'
#' Conserva la forma del reparto entero —cada trozo es un reparto válido, con
#' su `dias` y el resto de sus claves— para que el constructor de filas no
#' tenga que saber nada de semanas.
#'
#' Los días cuya fecha no rinde semana (ilegible, o anterior al origen) van
#' TODOS juntos al trozo sin nombre `""`: el llamador decide qué hacer con
#' ellos, y lo que no se puede fechar no se pierde en silencio.
#'
#' @param rep un reparto (`monitoreo_aulas_reparto()`).
#' @param inicio el lunes origen.
#' @return lista con nombre `"Semana N"` (y `""` para lo no fechable), en orden
#'   de semana; cada valor es un reparto con sólo los días de esa semana.
#' @export
monitoreo_aulas_reparto_por_semana <- function(rep, inicio) {
  dias <- (rep %||% list())[["dias"]] %||% list()
  if (!length(dias)) return(list())
  n <- vapply(dias, function(d) {
    s <- monitoreo_aulas_semana_de(.monitoreo_scalar(d[["fecha"]], ""), inicio)
    if (is.na(s)) NA_integer_ else s
  }, integer(1))
  nombres <- vapply(n, function(x) if (is.na(x)) "" else .mads_hoja_de_semana(x), character(1))
  # Orden por número de semana; lo no fechable, al final.
  orden <- unique(nombres[order(ifelse(is.na(n), .Machine$integer.max, n))])
  out <- list()
  for (nm in orden) {
    trozo <- rep
    trozo[["dias"]] <- dias[nombres == nm]
    out[[nm]] <- trozo
  }
  out
}

#' Las fechas de una semana, como las escribe la hoja (`dd/mm`).
#'
#' Sirve para reconocer una pestaña heredada: sus filas traen la fecha corta y
#' sin año, que es lo único que el documento remoto tiene.
#' @keywords internal
.mads_fechas_cortas <- function(rep_semana) {
  f <- vapply((rep_semana %||% list())[["dias"]] %||% list(),
              function(d) .monitoreo_scalar(d[["fecha"]], ""), character(1))
  f <- f[grepl("^\\d{4}-\\d{2}-\\d{2}$", f)]
  unique(paste0(substr(f, 9L, 10L), "/", substr(f, 6L, 7L)))
}

#' ¿En qué pestaña vive esta semana?
#'
#' **El caso que obliga a que esto exista es la migración.** Los documentos que
#' ya están en la calle traen la semana 1 en la pestaña con la que la app la
#' publicó —«Plan del día»— o en la que el equipo creó a mano —«Semana 1»—.
#' Escribir «Semana 1» sin mirar duplicaría la semana en dos pestañas y el
#' aplicador tendría dos verdades abiertas al mismo tiempo.
#'
#' El orden es: el nombre exacto si existe; si no, una pestaña heredada cuyas
#' filas sean de ESTA semana; si no, el nombre nuevo, que se creará.
#'
#' @param titulos títulos de las pestañas del documento.
#' @param nombre el nombre canónico de la semana («Semana 2»).
#' @param fechas_cortas las fechas `dd/mm` de esa semana.
#' @param heredada la pestaña que el localizador por cabecera encontró, o `""`.
#' @param valores_de función que devuelve los `values` de una pestaña.
#' @return el título de la pestaña donde escribir esa semana.
#' @keywords internal
.mads_hoja_para_semana <- function(titulos, nombre, fechas_cortas, heredada, valores_de) {
  if (!nzchar(nombre)) return(heredada)
  if (nombre %in% titulos) return(nombre)
  if (!nzchar(heredada) || !length(fechas_cortas)) return(nombre)
  v <- tryCatch(valores_de(heredada), error = function(e) list())
  if (length(v) < 2L) return(nombre)
  cab <- as.character(unlist(v[[1L]], use.names = FALSE))
  col <- which(trimws(cab) == "FECHA")
  if (length(col) != 1L) return(nombre)
  suyas <- vapply(v[-1L], function(r) {
    x <- as.character(unlist(r, use.names = FALSE))
    if (length(x) < col) "" else trimws(x[[col]])
  }, character(1))
  if (any(suyas %in% fechas_cortas)) heredada else nombre
}

#' El reparto que dicta la config vigente.
#'
#' **Una sola traducción de config→reparto.** El mapeo de `reparto_fijado`,
#' `duracion_aplicacion_min`, `reparto_rango`, `reparto_semilla` y
#' `reparto_concentrado` estaba escrito tres veces (la hoja de asignación, el
#' código→aplicador del libro y las filas de los aplicadores); publicar por
#' semana habría escrito una cuarta. Un default que envejezca en una sola de
#' ellas produce dos repartos distintos sobre el mismo estudio, que es el
#' defecto que este módulo ya pagó con el `concentrado`.
#'
#' @param plan filas del plan.
#' @param disponibilidad oferta cargada.
#' @param cfg config vigente del reparto.
#' @return el reparto (`monitoreo_aulas_reparto()`).
#' @export
monitoreo_aulas_reparto_de_config <- function(plan, disponibilidad, cfg = list()) {
  cfg <- if (is.list(cfg)) cfg else list()
  monitoreo_aulas_reparto(
    plan, disponibilidad,
    fijadas = cfg[["reparto_fijado"]] %||% list(),
    duracion_min = cfg[["duracion_aplicacion_min"]] %||% 30L,
    rango = cfg[["reparto_rango"]],
    semilla = cfg[["reparto_semilla"]] %||% 0L,
    concentrado = if (is.null(cfg[["reparto_concentrado"]])) TRUE else isTRUE(cfg[["reparto_concentrado"]])
  )
}

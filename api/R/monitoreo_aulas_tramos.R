# Los TRAMOS del operativo: rangos de fecha con nombre propio.
#
# Dictado de Gonzalo (2026-09-15): «debería tener un mecanismo para poder ir
# recordando la aplicación de semana a semana y actualizándolas a lo que el
# excel diga también, y cuando se cree una nueva semana de aplicación la app ya
# las sabe». Y la corrección que fija el modelo: «más que semana en el estricto
# senso, con rango a los que llamamos de forma personalizada; en este caso
# seleccioné dos rangos semanales y les puse Semana 1 y Semana 2, pero puede
# ser otro rango con otros nombres».
#
# **Qué se guarda y qué se deriva.** El rango y su nombre son su decisión y no
# se deducen de ningún sitio: se guardan en la config. Todo lo demás —cuántas
# citas tiene el tramo, cuántas se aplicaron, cuántas van sin fecha— sale del
# plan en cada corrida, que es lo que él eligió. Un conteo guardado envejece en
# silencio; uno derivado no puede.
#
# **El problema que cierra.** Hasta hoy el filtro que decide qué filas se
# añaden a «Distribución de aplicadores» era `reparto_rango`, un valor ÚNICO
# que sólo se teclea a mano. El 2026-09-15, en plena semana 2, seguía en
# «07/09 → 12/09»: 70 citas agendadas quedaban fuera y el recibo decía «0 aulas
# por añadir». El nombre de la pestaña, en cambio, se derivaba de la semana de
# calendario — dos mecanismos para la misma idea y sólo uno se actualizaba.

#' Los tramos declarados por el estudio, normalizados y ordenados.
#'
#' Un tramo es `{nombre, desde, hasta}` con las dos fechas en ISO. Se descarta
#' el que no traiga las dos —un tramo a medias no puede contener a nadie— y el
#' que las traiga al revés se endereza, porque teclear el fin antes que el
#' inicio es un desliz, no una intención.
#'
#' @param tramos lo que venga de la config.
#' @return lista de tramos `{nombre, desde, hasta}`, ordenada por `desde`.
#' @keywords internal
.mat_normalizar <- function(tramos) {
  crudo <- if (is.data.frame(tramos)) split(tramos, seq_len(nrow(tramos))) else (tramos %||% list())
  out <- list()
  for (t in crudo) {
    if (!is.list(t) && !is.data.frame(t)) next
    d <- .mav_fecha(t[["desde"]] %||% t[["inicio"]] %||% t[["from"]])
    h <- .mav_fecha(t[["hasta"]] %||% t[["fin"]] %||% t[["to"]])
    if (!nzchar(d) || !nzchar(h)) next
    if (h < d) { tmp <- d; d <- h; h <- tmp }
    nombre <- .monitoreo_scalar(t[["nombre"]] %||% t[["name"]] %||% t[["titulo"]], "")
    out[[length(out) + 1L]] <- list(nombre = nombre, desde = d, hasta = h)
  }
  if (!length(out)) return(list())
  out[order(vapply(out, function(t) t$desde, character(1)))]
}

#' Los tramos del operativo: los declarados o, si no hay, las semanas del plan.
#'
#' **El respaldo no es un adorno.** Un estudio que todavía no ha nombrado sus
#' tramos tiene que seguir funcionando igual que ayer, y lo que hacía ayer era
#' partir por semanas de calendario desde el lunes de la primera aula agendada
#' (`monitoreo_aulas_inicio_de_campo`). Esas semanas se derivan aquí con el
#' mismo origen y el mismo nombre —«Semana N»— para que declarar tramos sea un
#' añadido y no un corte.
#'
#' @param cfg config de aulas universitarias.
#' @param plan filas del plan, para el respaldo por semanas.
#' @return lista de tramos `{nombre, desde, hasta, declarado}`.
#' @export
monitoreo_aulas_tramos <- function(cfg = list(), plan = list()) {
  declarados <- .mat_normalizar((cfg %||% list())[["tramos"]])
  if (length(declarados)) {
    return(lapply(seq_along(declarados), function(i) {
      t <- declarados[[i]]
      if (!nzchar(t$nombre)) t$nombre <- sprintf("Tramo %d", i)
      t$declarado <- TRUE
      t
    }))
  }
  .mat_semanas_del_plan(plan)
}

# Las semanas de calendario del plan, con el mismo origen y los mismos nombres
# que la pestaña de la distribución ya usaba.
.mat_semanas_del_plan <- function(plan) {
  unidades <- if (is.data.frame(plan)) split(plan, seq_len(nrow(plan))) else (plan %||% list())
  if (!length(unidades)) return(list())
  fechas <- vapply(unidades, function(u) .mav_fecha(u[["scheduled_date"]]), character(1))
  fechas <- sort(unique(fechas[nzchar(fechas)]))
  if (!length(fechas)) return(list())
  inicio <- monitoreo_aulas_inicio_de_campo(unidades)
  if (!length(inicio) || is.na(inicio)) return(list())
  n <- vapply(fechas, function(f) monitoreo_aulas_semana_de(f, inicio), integer(1))
  out <- list()
  for (k in sort(unique(n[!is.na(n)]))) {
    lunes <- inicio + (k - 1L) * 7L
    out[[length(out) + 1L]] <- list(
      nombre = sprintf("Semana %d", k),
      desde = format(lunes, "%Y-%m-%d"),
      hasta = format(lunes + 6L, "%Y-%m-%d"),
      declarado = FALSE
    )
  }
  out
}

#' Cuál tramo es el vigente.
#'
#' El que contiene la fecha dada. Si ninguno la contiene —un fin de semana
#' entre dos tramos, o el operativo todavía sin empezar— manda **el siguiente
#' que venga**, porque lo que se está preparando es el que viene; y si ya
#' pasaron todos, el último. Nunca devuelve `NULL` habiendo tramos: quien
#' pregunta necesita una respuesta con la que trabajar.
#'
#' @param tramos salida de `monitoreo_aulas_tramos()`.
#' @param hoy fecha ISO; por defecto, la de hoy.
#' @return el tramo, o `NULL` si no hay ninguno.
#' @export
monitoreo_aulas_tramo_vigente <- function(tramos, hoy = "") {
  tramos <- tramos %||% list()
  if (!length(tramos)) return(NULL)
  f <- .mav_fecha(hoy)
  if (!nzchar(f)) f <- format(Sys.Date(), "%Y-%m-%d")
  for (t in tramos) if (f >= t$desde && f <= t$hasta) return(t)
  siguientes <- Filter(function(t) t$desde > f, tramos)
  if (length(siguientes)) return(siguientes[[1]])
  tramos[[length(tramos)]]
}

#' El estado de cada tramo, derivado del plan.
#'
#' Ni un conteo se guarda: se cuenta aquí en cada corrida sobre el plan y los
#' partes que la sesión tenga. Es lo que Gonzalo pidió —«lo derivado del
#' plan»— y lo que impide que un tramo diga «12 aplicadas» tres días después de
#' que fueran catorce.
#'
#' `sin_fecha_legible` cuenta las citas de ese tramo que traen algo escrito en
#' la fecha y no se deja leer. No es un detalle: una de ellas es una aula que
#' alguien agendó a medias y que no le aparece a nadie.
#'
#' @param tramos salida de `monitoreo_aulas_tramos()`.
#' @param plan filas del plan.
#' @param partes partes de campo.
#' @param efectivas efectivas por código.
#' @param hoy fecha ISO para marcar el vigente.
#' @return lista de tramos con `{citas, aplicadas, por_aplicar, vigente, …}`.
#' @export
monitoreo_aulas_tramos_estado <- function(tramos, plan = list(), partes = list(),
                                          efectivas = NULL, hoy = "") {
  tramos <- tramos %||% list()
  if (!length(tramos)) return(list())
  unidades <- if (is.data.frame(plan)) split(plan, seq_len(nrow(plan))) else (plan %||% list())
  fechas <- vapply(unidades, function(u) .mav_fecha(u[["scheduled_date"]]), character(1))
  escritas <- vapply(unidades, function(u) .monitoreo_scalar(u[["scheduled_date"]], ""), character(1))
  aplicadas <- if (length(unidades)) {
    monitoreo_aulas_aula_aplicada(unidades, partes = partes, efectivas = efectivas)
  } else {
    logical(0)
  }
  vig <- monitoreo_aulas_tramo_vigente(tramos, hoy)
  lapply(tramos, function(t) {
    dentro <- nzchar(fechas) & fechas >= t$desde & fechas <= t$hasta
    n <- sum(dentro)
    apl <- sum(dentro & aplicadas)
    c(t, list(
      citas = as.integer(n),
      aplicadas = as.integer(apl),
      por_aplicar = as.integer(n - apl),
      # Escrita pero ilegible: no cae en ningún tramo y por eso se cuenta
      # aparte. Si se sumara al que le tocaría por su texto habría que
      # adivinar la fecha, que es justo lo que no se puede hacer.
      sin_fecha_legible = as.integer(sum(!nzchar(fechas) & nzchar(escritas))),
      vigente = !is.null(vig) && identical(vig$desde, t$desde) && identical(vig$hasta, t$hasta)
    ))
  })
}

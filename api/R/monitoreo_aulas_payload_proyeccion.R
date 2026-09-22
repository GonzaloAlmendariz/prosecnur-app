# monitoreo_aulas_payload_proyeccion.R — la proyección de metas, en el tablero.
#
# `monitoreo_aulas_proyeccion_metas()` vive en su propio motor y contesta «con
# lo que ya tengo agendado, ¿llego?». Esto es sólo la pata que la lleva al
# payload del perfil de aulas, con las cuatro combinaciones de los dos mandos
# que la pestaña «Metas» ofrece —meta contra muestra o sobremuestra, y lo
# agendado proyectado con la tasa del diseño o con la obtenida—.
#
# **Las cuatro se calculan aquí y no en la pantalla.** Es la misma disciplina
# que ya siguen las jornadas del «día a día»: el gráfico y la tabla del libro
# tienen que decir la misma cifra del mismo día, y eso sólo se garantiza si hay
# UN sitio donde se calcula. Cambiar de mando en la UI cambia de escenario, no
# de fórmula.
#
# Son cuatro pasadas sobre el mismo plan y no cuestan red: el tablero es una
# computación cacheada y sin salida a internet (ver `monitoreo_aulas_cache.R`),
# y esto se apoya sólo en el plan, el snapshot y las cuotas del diseño.

#' Las cuatro combinaciones de la proyección de metas, para el payload.
#'
#' @param plan filas del plan (las mismas que viajan al tablero).
#' @param responses respuestas de la plataforma.
#' @param partes partes de campo.
#' @param cuotas bloque `design_targets` de la config.
#' @param cfg config de aulas.
#' @return lista con `muestra_diseno`, `muestra_obtenida`, `sobremuestra_diseno`
#'   y `sobremuestra_obtenida`; `NULL` cuando no hay cuotas con las que medir,
#'   que es lo que distingue «no llega» de «no se sabe».
#' @export
monitoreo_aulas_proyeccion_payload <- function(plan, responses = NULL, partes = list(),
                                               cuotas = list(), cfg = list()) {
  plan <- plan %||% list()
  if (!length(plan)) return(NULL)
  if (!length((cuotas %||% list())$facultades %||% list())) return(NULL)
  ef <- tryCatch(monitoreo_aulas_efectivas_por_aula(plan, responses, cfg),
                 error = function(e) NULL)
  efs <- tryCatch(monitoreo_aulas_efectivas_por_sexo(plan, responses, cfg),
                  error = function(e) NULL)
  salida <- list()
  for (meta in c("muestra", "sobremuestra")) {
    for (tasa in c("diseno", "obtenida")) {
      salida[[paste(meta, tasa, sep = "_")]] <- tryCatch(
        monitoreo_aulas_proyeccion_metas(plan, efectivas = ef, efectivas_sexo = efs,
                                         partes = partes, cuotas = cuotas, cfg = cfg,
                                         tasa = tasa, meta = meta),
        error = function(e) list()
      )
    }
  }
  salida
}

#' Aulas planificadas y aplicadas por facultad.
#'
#' **«Planificadas» son los TITULARES del plan**, no titulares más reservas. Una
#' reserva no se planifica: se activa cuando una titular se cae, y contarlas
#' daría las 1 392 filas del sorteo, que no es el objetivo de nadie. Es la misma
#' unidad que «Aulas planificadas» de «Rendimiento por facultad» en el libro.
#'
#' Va por FACULTAD y no por sexo a propósito: un aula no se reparte entre
#' hombres y mujeres, la misma visita da de los dos. Repetirla en las dos filas
#' diría que hay aulas de hombres y aulas de mujeres.
#'
#' @param plan filas del plan.
#' @param responses respuestas, para saber cuáles se aplicaron.
#' @param partes partes de campo, el otro eje de aplicación.
#' @param cfg config de aulas.
#' @return lista de `{facultad, planificadas, aplicadas}`. El campo conserva su
#'   nombre —contrato congelado, ADR 0079— y su VALOR lo declara
#'   [monitoreo_aulas_agrupacion()]: puede ser una carrera.
#' @export
monitoreo_aulas_aulas_por_facultad <- function(plan, responses = NULL, partes = list(),
                                               cfg = list()) {
  plan <- plan %||% list()
  if (!length(plan)) return(list())
  txt <- function(x) trimws(as.character(x %||% ""))
  u <- if (is.data.frame(plan)) split(plan, seq_len(nrow(plan))) else plan
  # **La columna la dice la agrupación declarada**, no la constante. Un estudio
  # que vive dentro de UNA facultad recibe aquí una tabla de una fila, y por
  # carrera la misma tabla dice dónde está el trabajo. Sin declaración,
  # `faculty`: idéntico a lo de siempre. Ver `monitoreo_aulas_agrupacion.R`.
  columna <- .monitoreo_scalar(monitoreo_aulas_agrupacion(cfg)$columna, "faculty")
  fac <- vapply(u, function(x) txt(x[[columna]]), character(1))
  rol <- vapply(u, function(x) tolower(txt(x[["sample_role"]])), character(1))
  ef <- tryCatch(monitoreo_aulas_efectivas_por_aula(plan, responses, cfg),
                 error = function(e) NULL)
  apl <- tryCatch(monitoreo_aulas_aula_aplicada(u, partes = partes, efectivas = ef),
                  error = function(e) rep(FALSE, length(u)))
  lapply(sort(unique(fac[nzchar(fac)])), function(f) {
    i <- fac == f
    list(facultad = f,
         planificadas = sum(i & rol == "titular"),
         aplicadas = sum(i & apl))
  })
}

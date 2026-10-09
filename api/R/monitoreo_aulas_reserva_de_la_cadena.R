# monitoreo_aulas_reserva_de_la_cadena.R — qué titular tiene relevo, y cuál.
#
# La tabla «Cada curso-horario contra su propio margen» dice quién rindió por
# debajo de lo suyo y ahí se detiene. Medido el 2026-09-10 sobre el operativo:
# de los 14 que quedan por debajo de lo esperado, **13 tienen una reserva de
# cadena viva** —o sea, hay una decisión concreta que tomar hoy— y sólo uno no,
# porque él mismo ya es una reserva.
#
# Sin ese dato la tabla es un informe; con él es una lista de trabajo.
#
# **No es lo mismo que `reserva_dirigida`**, y por eso vive aparte: aquélla
# trabaja al grano de CELDA —facultad × sexo en déficit— y busca en el BANCO de
# extras a qué aula nueva ir. Ésta mira la CADENA del propio curso-horario: el
# relevo que el sorteo ya le asignó. Son dos preguntas y dos recorridos; unirlas
# daría un bloque que contesta a medias las dos.
#
# **El enlace es `titular_operational_code`, no `replacement_for`.** Los dos
# campos existen y el segundo guarda otra cosa; medir con él dio «0 de 14 tienen
# reserva», una alarma inventada. La lección quedó en el encargo del loop.

#' Los estados de una reserva que ya NO puede tomar el relevo.
#' @keywords internal
.marc_ESTADOS_MUERTOS <- c("aplicada", "retirada", "rechazo", "rechazada")

.marc_txt <- function(x) {
  v <- trimws(as.character(x %||% "")[1])
  if (is.na(v)) "" else v
}

#' Qué relevo le queda a cada curso-horario titular.
#'
#' @param plan filas del plan (titulares y reservas de cadena).
#' @return lista nombrada por código de titular: `{disponibles, siguiente}` —
#'   cuántas reservas vivas le quedan y el código de la primera por orden de
#'   reemplazo. Un titular sin entrada es un titular sin relevo, y el
#'   consumidor lo lee como tal en vez de recibir un cero que se confunde con
#'   «no lo he calculado».
#' @export
monitoreo_aulas_reserva_de_la_cadena <- function(plan = list()) {
  unidades <- if (is.data.frame(plan)) split(plan, seq_len(nrow(plan))) else (plan %||% list())
  if (!length(unidades)) return(list())

  por_titular <- list()
  for (u in unidades) {
    rol <- tolower(.marc_txt(u[["sample_role"]]))
    # `chain_reserve` es el relevo del sorteo. `extra_reserve_pool` es el banco
    # de extras y NO entra: ése es el material de `reserva_dirigida`, que se
    # elige por celda en déficit y no por cadena.
    if (!identical(rol, "chain_reserve")) next
    titular <- .marc_txt(u[["titular_operational_code"]])
    if (!nzchar(titular)) next
    if (tolower(.marc_txt(u[["sample_status"]])) %in% .marc_ESTADOS_MUERTOS) next
    codigo <- .marc_txt(u[["operational_code"]])
    orden <- suppressWarnings(as.numeric(u[["replacement_order"]] %||% NA))
    if (!length(orden) || is.na(orden)) orden <- Inf
    fila <- list(codigo = codigo, orden = orden)
    por_titular[[titular]] <- c(por_titular[[titular]] %||% list(), list(fila))
  }

  salida <- list()
  for (titular in names(por_titular)) {
    filas <- por_titular[[titular]]
    ordenadas <- filas[order(vapply(filas, function(f) f$orden, numeric(1)))]
    salida[[titular]] <- list(
      disponibles = length(ordenadas),
      # El SIGUIENTE por orden de reemplazo, que es el que la app activaría:
      # decir sólo «tiene 3» obliga a ir a buscar cuál, y el orden del sorteo
      # no es una preferencia, es parte del diseño.
      siguiente = .marc_txt(ordenadas[[1]]$codigo)
    )
  }
  salida
}

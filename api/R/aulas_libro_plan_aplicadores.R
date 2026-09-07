# aulas_libro_plan_aplicadores.R — la hoja que se comparte con el equipo.
#
# Dictado de Gonzalo (2026-09-07, tras ver la primera versión): «le estás dando
# a los aplicadores más información de la que necesitan, y documentación
# interna. Sólo debes darles el plan del día de forma más sencilla, en una sola
# hoja y sin nada de esperadas ni enlaces ni obtenidas: sólo lo que tiene que ir
# a aplicar. Lo que sí les puede ayudar es que cada uno tenga un color
# distintivo en su celda para que se ubique bien, incluyendo Interno Pulso».
#
# **Qué se cae respecto del Plan del día del libro operativo**: esperadas y
# esperadas por sexo, obtenidas y obtenidas por sexo, elegibles, matriculados,
# estado de aplicación y el enlace de la ficha QR. Son cifras de gestión y de
# control de la muestra; un aplicador que va a un aula no decide nada con ellas
# y en cambio tiene que buscar su fila entre veintiuna columnas.
#
# Queda lo que contesta las cuatro preguntas de quien sale a aplicar: cuándo
# estoy en oficina, cuándo salgo, a qué aula voy y de quién es la clase.

#' Los diez títulos de la hoja, en el orden en que se leen.
#'
#' `APLICADOR` primero porque el equipo se busca a sí mismo antes que nada: la
#' hoja se comparte entera y cada uno filtra o busca su nombre.
#' @keywords internal
.alpa_CABECERA <- c(
  "APLICADOR", "DÍA", "EN OFICINA", "SALE AL AULA", "APLICA",
  "CURSO-HORARIO", "AULA", "FACULTAD", "CURSO", "DOCENTE"
)

#' Paleta de fondos para las celdas de aplicador.
#'
#' Doce tonos claros con texto oscuro: bastan para que dos personas contiguas en
#' la tabla nunca compartan color, que es para lo que sirve. No se persigue que
#' los veintidós sean únicos —con esa cantidad los tonos se vuelven
#' indistinguibles— sino que cada uno encuentre su fila de un vistazo.
#' @keywords internal
.alpa_PALETA <- c(
  "#DCE7F7", "#DDF0E4", "#FBE4E8", "#FCEBD5", "#E6E0F6", "#D8EFF2",
  "#F3E8D0", "#E4EFD8", "#F7E0EF", "#DDE8E3", "#EFE6DA", "#E0E9F2"
)

#' El comodín no es una persona y no entra en la rotación.
#' @keywords internal
.alpa_COLOR_INTERNO <- "#002457"

#' @keywords internal
.alpa_txt <- function(x, default = "") {
  v <- suppressWarnings(as.character(x %||% default)[1])
  if (length(v) != 1L || is.na(v)) default else trimws(v)
}

#' Una celda pintada, para distinguir a cada aplicador.
#' @keywords internal
.alpa_celda <- function(sheet_id, fila, col, fondo, tinta = "#1F2937", bold = TRUE) {
  list(repeatCell = list(
    range = list(
      sheetId = sheet_id,
      startRowIndex = as.integer(fila - 1L), endRowIndex = as.integer(fila),
      startColumnIndex = as.integer(col - 1L), endColumnIndex = as.integer(col)
    ),
    cell = list(userEnteredFormat = list(
      backgroundColor = .monitoreo_sheets_rgb(fondo),
      textFormat = list(bold = isTRUE(bold), foregroundColor = .monitoreo_sheets_rgb(tinta))
    )),
    fields = "userEnteredFormat(backgroundColor,textFormat)"
  ))
}

#' Las filas de la hoja que ven los aplicadores.
#'
#' @param plan filas del plan.
#' @param disponibilidad oferta cargada; sin ella no hay reparto y devuelve NULL.
#' @param cfg config vigente del reparto (fijadas, rango, duración, semilla).
#' @return lista de filas (la primera es la cabecera) o `NULL`.
#' @export
aulas_libro_filas_plan_aplicadores <- function(plan, disponibilidad, cfg = list()) {
  if (is.null(disponibilidad) || !length(disponibilidad)) return(NULL)
  cfg <- if (is.list(cfg)) cfg else list()
  rep <- monitoreo_aulas_reparto(
    plan, disponibilidad,
    fijadas = cfg[["reparto_fijado"]] %||% list(),
    duracion_min = cfg[["duracion_aplicacion_min"]] %||% 30L,
    rango = cfg[["reparto_rango"]],
    semilla = cfg[["reparto_semilla"]] %||% 0L,
    concentrado = if (is.null(cfg[["reparto_concentrado"]])) TRUE else isTRUE(cfg[["reparto_concentrado"]])
  )
  # Del plan sólo se toma lo que la hoja enseña: aula, facultad, curso y
  # docente. Todo lo demás se queda fuera a propósito.
  meta <- new.env(parent = emptyenv())
  for (u in (if (is.data.frame(plan)) split(plan, seq_len(nrow(plan))) else (plan %||% list()))) {
    cod <- .alpa_txt(u[["operational_code"]])
    if (!nzchar(cod) || !is.null(meta[[cod]])) next
    meta[[cod]] <- list(
      aula = .alpa_txt(u[["scheduled_venue"]], .alpa_txt(u[["venue"]])),
      facultad = .alpa_txt(u[["faculty"]]),
      curso = .alpa_txt(u[["course_name"]]),
      docente = .alpa_txt(u[["teacher"]])
    )
  }

  filas <- list(as.list(.alpa_CABECERA))
  for (dia in (rep[["dias"]] %||% list())) {
    fecha <- .alpa_txt(dia[["fecha"]])
    etiqueta <- .alpa_txt(dia[["etiqueta"]], fecha)
    items <- dia[["asignaciones"]] %||% list()
    if (!length(items)) next
    orden <- order(vapply(items, function(it) .alpa_txt(it[["recojo"]]), character(1)),
                   vapply(items, function(it) .alpa_txt(it[["inicio"]]), character(1)),
                   method = "radix")
    for (it in items[orden]) {
      cod <- .alpa_txt(it[["codigo"]])
      m <- meta[[cod]] %||% list(aula = "", facultad = "", curso = "", docente = "")
      filas[[length(filas) + 1L]] <- list(
        aulas_nombre_aplicador(.alpa_txt(it[["aplicador"]])),
        etiqueta,
        .alpa_txt(it[["recojo"]]),
        .alpa_txt(it[["salida"]]),
        paste0(.alpa_txt(it[["inicio"]]), " a ", .alpa_txt(it[["fin"]])),
        cod, m$aula, m$facultad, m$curso, m$docente
      )
    }
  }
  filas
}

#' Formato de la hoja: cabecera y un color por aplicador.
#' @export
aulas_libro_plan_aplicadores_formato_requests <- function(sheet_id, rows) {
  rows <- rows %||% list()
  if (!length(rows)) return(list())
  n_cols <- length(.alpa_CABECERA)
  requests <- list()
  poner <- function(req) requests[[length(requests) + 1L]] <<- req
  poner(.maaf_banda(sheet_id, 1L, n_cols, "#002457", "#FFFFFF", size = 11L))
  poner(.maaf_alto_fila(sheet_id, 1L, 30L))

  nombres <- unique(vapply(rows[-1L], function(r) {
    .alpa_txt(unlist(r %||% list(), use.names = FALSE)[[1L]])
  }, character(1)))
  # Por posición en el orden ALFABÉTICO y no por hash ni por orden de
  # aparición: dos publicaciones del mismo reparto tienen que salir con los
  # mismos colores, o el equipo aprende el suyo y al día siguiente es otro.
  nombres <- sort(nombres[nzchar(nombres)], method = "radix")
  interno <- aulas_nombre_aplicador(MONITOREO_AULAS_INTERNO_PULSO)
  personas <- setdiff(nombres, interno)
  color_de <- stats::setNames(
    .alpa_PALETA[((seq_along(personas) - 1L) %% length(.alpa_PALETA)) + 1L],
    personas
  )

  for (i in seq_along(rows)) {
    if (i == 1L) next
    quien <- .alpa_txt(unlist(rows[[i]] %||% list(), use.names = FALSE)[[1L]])
    if (!nzchar(quien)) next
    if (identical(quien, interno)) {
      # El comodín en el navy del módulo con tinta clara: no es una persona del
      # equipo y tiene que verse que ahí se acaba la lista.
      poner(.alpa_celda(sheet_id, i, 1L, .alpa_COLOR_INTERNO, "#FFFFFF"))
    } else {
      poner(.alpa_celda(sheet_id, i, 1L, color_de[[quien]] %||% "#EEEEEE"))
    }
  }
  # Las tres horas y el código, centrados: son cifras y se leen en columna.
  poner(.maaf_centrar(sheet_id, 3L, 6L, length(rows)))
  for (a in list(list(desde = 0L, hasta = 1L, px = 230L),
                 list(desde = 1L, hasta = 2L, px = 120L),
                 list(desde = 2L, hasta = 5L, px = 90L),
                 list(desde = 5L, hasta = 6L, px = 100L),
                 list(desde = 6L, hasta = 7L, px = 90L),
                 list(desde = 7L, hasta = 8L, px = 190L),
                 list(desde = 8L, hasta = 9L, px = 280L),
                 list(desde = 9L, hasta = 10L, px = 230L))) {
    poner(.mafs_dim_request(sheet_id, a$desde, a$hasta, a$px))
  }
  requests
}

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
  "APLICADOR", "DÍA", "FECHA", "EN OFICINA", "SALE AL AULA", "APLICA",
  "CURSO-HORARIO", "AULA", "FACULTAD", "CURSO", "DOCENTE"
)

#' El día de la semana, escrito.
#'
#' La primera versión salía con la fecha ISO cruda —«2026-09-10»— porque el
#' reparto no publica etiqueta y el fallback era la fecha. Nadie organiza su
#' semana leyendo ISO: Gonzalo pidió el día de la semana en su propia columna.
#' Se deriva del token sin locale del motor (`.mav_dia_token`), que es el mismo
#' que usa el reparto para cruzar la disponibilidad, y no de `format()`, que
#' depende del locale de la máquina. El token viene en TRES LETRAS mayúsculas
#' («LUN», «JUE»): asumirlo en minúscula y completo dejaba la columna vacía sin
#' que nada fallara, que es como se cuela un dato muerto hasta la hoja.
#' @keywords internal
.alpa_DIA_ESCRITO <- c(
  LUN = "Lunes", MAR = "Martes", MIE = "Miércoles", JUE = "Jueves",
  VIE = "Viernes", SAB = "Sábado", DOM = "Domingo"
)

#' @keywords internal
.alpa_dia_y_fecha <- function(fecha) {
  token <- .mav_dia_token(fecha)
  # `[[` con un nombre ausente revienta con «subscript out of bounds», no
  # devuelve NULL: una fecha ilegible tumbaba la hoja entera.
  dia <- if (nzchar(token %||% "") && token %in% names(.alpa_DIA_ESCRITO)) {
    unname(.alpa_DIA_ESCRITO[[token]])
  } else {
    ""
  }
  corta <- if (grepl("^\\d{4}-\\d{2}-\\d{2}$", fecha)) {
    paste0(substr(fecha, 9L, 10L), "/", substr(fecha, 6L, 7L))
  } else {
    fecha
  }
  list(dia = dia %||% "", fecha = corta)
}

#' Veintidós tonos, uno por aplicador, sin repetir.
#'
#' La primera versión traía doce y rotaba: con veintidós personas cuatro filas
#' seguidas del jueves salieron del mismo beige y Gonzalo lo vio en pantalla,
#' «aquí no se nota la diferencia». Uno por persona, sin ciclo.
#'
#' **Veintidós tonos claros no pueden ser además muy suaves.** Medido en CIELAB
#' sobre el espacio de pasteles: con saturación baja (0,28–0,52) la mejor
#' separación mínima alcanzable entre 22 es 6,3, o sea indistinguibles —bajo 10
#' dos tonos claros se confunden—. Subiendo a saturación media (0,68–0,70) y
#' matiz repartido en dos bandas de luminosidad, la mínima sube a **9,0** con
#' luminancia mínima 71, que deja el texto oscuro legible. Ese es el punto donde
#' se queda: más separación exige colores más fuertes de lo que una hoja
#' operativa aguanta.
#' @keywords internal
.alpa_PALETA <- c(
  "#DFEFA4", "#DAF3C1", "#B6EFA4", "#C1F3C3", "#A4EFBB", "#C1F3DE",
  "#A4EFE4", "#C1EDF3", "#A4D1EF", "#C1D1F3", "#A4A8EF", "#CCC1F3",
  "#C9A4EF", "#E7C1F3", "#EFA4EC", "#F3C1E4", "#EFA4C3", "#F3C1C8",
  "#EFAEA4", "#F3D5C1", "#EFD7A4", "#F3F0C1"
)

#' El comodín: un gris cálido, no el navy del módulo.
#'
#' Iba en `#002457` con tinta blanca y Gonzalo lo corrigió: «es demasiado
#' llamativo y confuso, parece que fuera un encabezado». Y lo parecía: en una
#' hoja cuya cabecera es justo ese navy, una fila con el mismo fondo se lee como
#' un corte de sección. Un neutro fuera de la rueda de matices dice lo mismo —no
#' es una persona del equipo— sin gritarlo.
#' @keywords internal
.alpa_COLOR_INTERNO <- "#E3E0DA"

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
    cuando <- .alpa_dia_y_fecha(fecha)
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
        cuando$dia, cuando$fecha,
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
      # El comodín en gris cálido: se distingue de las veintidós personas sin
      # parecer una cabecera de sección.
      poner(.alpa_celda(sheet_id, i, 1L, .alpa_COLOR_INTERNO, "#4A453E"))
    } else {
      poner(.alpa_celda(sheet_id, i, 1L, color_de[[quien]] %||% "#EEEEEE"))
    }
  }
  # Las tres horas y el código, centrados: son cifras y se leen en columna.
  poner(.maaf_centrar(sheet_id, 2L, 7L, length(rows)))
  for (a in list(list(desde = 0L, hasta = 1L, px = 240L),
                 list(desde = 1L, hasta = 2L, px = 90L),
                 list(desde = 2L, hasta = 3L, px = 70L),
                 list(desde = 3L, hasta = 6L, px = 92L),
                 list(desde = 6L, hasta = 7L, px = 100L),
                 list(desde = 7L, hasta = 8L, px = 90L),
                 list(desde = 8L, hasta = 9L, px = 190L),
                 list(desde = 9L, hasta = 10L, px = 280L),
                 list(desde = 10L, hasta = 11L, px = 230L))) {
    poner(.mafs_dim_request(sheet_id, a$desde, a$hasta, a$px))
  }
  requests
}

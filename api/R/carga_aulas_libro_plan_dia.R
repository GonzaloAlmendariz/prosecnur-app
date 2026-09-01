# La hoja «Plan del día» del libro de aulas — unidad B2.1.
#
# En 2025 el equipo tecleaba SEIS hojas «aplicación del día N» a mano: el
# recorte de la fila agenda+campo por fecha, copiado celda a celda cada mañana.
# En 2026 la genera la app como UNA hoja del libro, ordenada por fecha y hora:
# el plan del día es de quien va al aula.
#
# Es hoja DE IDA: no tiene lector (`aulas_libro_importar()` la ignora por
# nombre) y en Sheets es hoja de la APP —se publica siempre, jamás
# `respetada`—. Su contrato vive en test-carga-aulas-libro-plan-dia.R.

# Los 13 títulos, en el orden del recorte que el equipo copiaba a mano.
.capd_CABECERA <- c(
  "FECHA AGENDADA", "DÍA", "HORA", "CURSO-HORARIO", "NOMBRE DEL CURSO",
  "FACULTAD", "SESIONES Y AULA", "NOMBRE DE DOCENTE", "TELÉFONO DE DOCENTE",
  "ELEGIBLES", "APLICADOR", "ESTADO", "ENLACE DE LA FICHA"
)

# El día de semana en castellano, SIN locale: `format(fecha, "%A")` depende del
# locale del proceso y en un worker `callr` con C-locale devolvería «Thursday».
# `as.POSIXlt()$wday` es 0 = domingo siempre.
.capd_DIAS <- c("Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes",
                "Sábado")

# DÍA: si la agenda ya lo declaró (`scheduled_day`), manda lo declarado —es lo
# que el equipo escribió y esta hoja es su recorte—; si no viene, se DERIVA de
# `scheduled_date`. La población de la hoja exige fecha, así que el derivado
# existe siempre que la fila exista.
.capd_dia <- function(unidad) {
  declarado <- .calg_txt(unidad$scheduled_day)
  if (nzchar(declarado)) return(declarado)
  fecha <- suppressWarnings(as.Date(.calg_txt(unidad$scheduled_date),
                                    format = "%Y-%m-%d"))
  if (!length(fecha) || is.na(fecha)) return("")
  .capd_DIAS[[as.POSIXlt(fecha)$wday + 1L]]
}

# ESTADO legible: guion bajo → espacio y MAYÚSCULAS («en_campo» → «EN CAMPO»).
# No es `.calg_status_excel` —ese habla el vocabulario del desplegable de
# `sample_status` y aquí el eje es `operational_status`— y no es una lista
# cerrada a propósito: un estado nuevo del vocabulario sale legible en vez de
# tragarse en un default (la lista cerrada es el patrón que ya costó pestañas).
# La ausencia sale vacía: un aula sin gestión todavía no declara estado.
.capd_estado_legible <- function(valor) {
  v <- trimws(.calg_txt(valor))
  if (!nzchar(v)) return("")
  toupper(gsub("[_ ]+", " ", v))
}

# SESIONES Y AULA: lo que el plan sepa de ambas —el horario de sesiones
# (`schedule`) y el ambiente (`label`)—, unidas cuando vienen las dos. No hay
# columna 1:1 en el plan para este rótulo de 2025; se declara lo que hay.
.capd_sesiones_y_aula <- function(unidad) {
  partes <- c(.calg_txt(unidad$schedule), .calg_txt(unidad$label))
  paste(partes[nzchar(partes)], collapse = " · ")
}

#' Arma la hoja «Plan del día» a partir del plan y los partes.
#'
#' Población: SOLO filas con `scheduled_date` no vacío, excluyendo los estados
#' retirados del eje `operational_status` — el balde `retirada` de
#' `.madt_balde()` (monitoreo_aulas_dos_tasas.R), que es UNA lista y no dos:
#' reemplazada/cancelada/sin_acceso/reemplazo_pendiente. La AUSENCIA de estado
#' no es un retiro (cae en `pendiente`), y titulares y reservas activadas con
#' fecha entran por igual: el plan del día es de quien va al aula, no del rol
#' de muestreo.
#'
#' Orden: `scheduled_date` ascendente (ISO es lexicográfico) y, dentro del
#' día, `scheduled_time`.
#'
#' @param unidades filas del plan (formato largo).
#' @param partes partes de campo ya registrados; el APLICADOR sale del intento
#'   1 por `.MONITOREO_AULAS_PARTE_ALIAS[["aplicador"]]` (mismo índice
#'   `codigo#intento` que el resto del libro).
#' @return data.frame de celdas SIN nombres, cabecera como primera fila.
aulas_libro_hoja_plan_dia <- function(unidades, partes = list()) {
  # Partes por código e intento, con el MISMO índice `%s#%d` del generador de
  # «Aulas Aplicadas (Campo)»: dos índices distintos para el mismo parte es la
  # clase de lista paralela que este libro ya pagó.
  por_aula <- list()
  for (pt in (partes %||% list())) {
    if (!is.list(pt)) next
    cod <- .calg_txt(pt$operational_code, .calg_txt(pt$classroom_id))
    if (!nzchar(cod)) next
    n <- suppressWarnings(as.integer(pt$intento %||% 1L))
    if (!length(n) || !is.finite(n) || n < 1L) n <- 1L
    por_aula[[sprintf("%s#%d", cod, n)]] <- pt
  }

  poblacion <- Filter(function(u) {
    if (!is.list(u)) return(FALSE)
    if (!nzchar(.calg_txt(u$scheduled_date))) return(FALSE)
    !identical(.madt_balde(.calg_txt(u$operational_status)), "retirada")
  }, unidades %||% list())

  fechas <- vapply(poblacion, function(u) .calg_txt(u$scheduled_date), character(1))
  horas <- vapply(poblacion, function(u) .calg_txt(u$scheduled_time), character(1))
  poblacion <- poblacion[order(fechas, horas)]

  filas <- lapply(poblacion, function(u) {
    parte1 <- por_aula[[sprintf("%s#1", .calg_txt(u$operational_code))]]
    aplicador <- if (is.null(parte1)) "" else .calg_txt(
      .monitoreo_aulas_parte_primero(parte1, .MONITOREO_AULAS_PARTE_ALIAS[["aplicador"]])
    )
    c(
      .calg_txt(u$scheduled_date),
      .capd_dia(u),
      .calg_txt(u$scheduled_time),
      .calg_txt(u$operational_code),
      .calg_txt(u$course_name),
      .calg_txt(u$faculty),
      .capd_sesiones_y_aula(u),
      .calg_txt(u$teacher),
      .calg_txt(u$teacher_phone),
      .calg_num_txt(u$eligible_n),
      aplicador,
      .capd_estado_legible(u$operational_status),
      .calg_txt(u$link)
    )
  })
  as.data.frame(do.call(rbind, c(list(.capd_CABECERA), filas)),
                stringsAsFactors = FALSE)
}

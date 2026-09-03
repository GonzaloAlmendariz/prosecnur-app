# monitoreo_aulas_ventanas.R — el mapa horario confirmado del operativo (B11).
#
# Dictado de Gonzalo (2026-09-01): «tenemos el traslape de los cursos, pero una
# vez que nos confirmen la hora de aplicación y sabiendo que la aplicación
# suele durar veinte minutos, ya podemos tener la fecha exacta de inicio y
# final una vez que se pacte con el docente, y eso podemos utilizarlo […] para
# confirmar los espacios confirmados donde vamos a necesitar personas, [y] para
# hacer el mapeo automático de todos los rangos horarios en los que se va a
# estar».
#
# Dos piezas, contrato en test-monitoreo-aulas-ventanas.R:
#
# - `monitoreo_aulas_hora_parse(x)`: hora tecleada → minutos desde la
#   medianoche. Gonzalo teclea con AM/PM («9:25am») y el libro trae 24 horas
#   («15:25»); el parser acepta ambas. La basura vuelve NA declarado.
# - `monitoreo_aulas_ventanas(plan)`: la ventana de cada aula (confirmada /
#   tentativa / sin_ventana) y el mapa por día con los picos de solape de las
#   ventanas CONFIRMADAS. Las tentativas no piden personas: van aparte en
#   `por_confirmar` de su día, y `personas_fuente = "confirmadas"` lo declara.
#
# La hora pactada YA viaja al plan: campo canónico `scheduled_time` (columna
# «HORA» del bloque de agenda, carga_aulas_agendadas.R:49; preservado por la
# fusión, carga_aulas_libro_fusion.R:51; alias `hora_agendada` en el
# normalizador, monitoreo_aulas_universitarias.R:615). Este motor no inventa
# eslabones: lee ese campo.
#
# Determinismo: sin reloj. El mapa del viernes se calcula igual el jueves que
# el sábado; si algún día hace falta una frontera de «hoy», vendrá de los
# datos (patrón de B2.1b(c)), no del sistema. Hay un grep-pin en el test.
#
# Cálculo puro sobre estado ya validado: degrada declarando (`sin_ventana`,
# NA), nunca lanza — por eso aquí no hay `stop_api()` ni `stop()`.

# La aplicación dura media hora (dictado de Gonzalo, 2026-09-03: «la
# aplicación dura media hora»; supersede el «suele durar veinte» del
# 2026-09-01). Este es el DEFAULT: la promoción a configuración que el
# comentario original anticipaba ya ocurrió — `duracion_aplicacion_min` del
# config de aulas (B70) viaja por el parámetro `duracion_min` de los motores.
.mav_DURACION_MIN <- 30L

# La media hora previa del aplicador (dictado 2026-09-03, B71): se apersona a
# recoger materiales 30 minutos antes de la hora pactada y sale hacia el aula
# 15 minutos antes. La OCUPACIÓN real de una cita es [hora - 30, hora +
# duración]; los solapes honestos se juzgan sobre ella, no sobre la
# aplicación sola. Constantes del protocolo operativo, no configurables por
# estudio (a diferencia de la duración): cambiarlas sería cambiar el
# protocolo de campo.
.mav_PREPARACION_MIN <- 30L
.mav_SALIDA_MIN <- 15L

# El día de semana SIN locale, mismo patrón que `.capd_DIAS` (plan del día):
# `format(fecha, "%a")` depende del locale del proceso y en un worker `callr`
# con C-locale devolvería «Fri». `as.POSIXlt()$wday` es 0 = domingo siempre,
# y los tokens son los del catálogo de sesiones (`.CM_AULAS_DIAS`).
.mav_DIAS <- c("DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB")

# Una hora tecleada, a minutos desde la medianoche. Escalar; el vectorizado
# público está abajo.
.mav_hora_una <- function(v) {
  if (is.na(v)) return(NA_real_)
  v <- tolower(trimws(v))
  # Los minutos son opcionales SOLO con sufijo am/pm: «8pm» aparecio en el
  # libro real y caia a NA. Con sufijo la intencion es inequivoca; un «8» a
  # secas sigue siendo NA — demasiado ambiguo para adivinarlo (A29).
  m <- regmatches(v, regexec("^([0-9]{1,2})(?::([0-9]{2}))?[[:space:]]*(a\\.?m\\.?|p\\.?m\\.?)?$", v, perl = TRUE))[[1]]
  if (length(m) < 3L) return(NA_real_)
  sufijo <- if (length(m) >= 4L) m[[4]] else ""
  if (!nzchar(m[[3]]) && !nzchar(sufijo)) return(NA_real_)
  h <- suppressWarnings(as.numeric(m[[2]]))
  mn <- if (nzchar(m[[3]])) suppressWarnings(as.numeric(m[[3]])) else 0
  if (!is.finite(h) || !is.finite(mn) || mn > 59) return(NA_real_)
  if (nzchar(sufijo)) {
    # Semántica am/pm de verdad: 12:00 pm es mediodía y 12:30 am es la
    # madrugada. El «+12 si pm» ingenuo revienta justo en la franja del
    # almuerzo, que en la jornada universitaria existe.
    if (h < 1 || h > 12) return(NA_real_)
    if (h == 12) h <- 0
    if (startsWith(sufijo, "p")) h <- h + 12
  } else if (h > 23) {
    return(NA_real_)
  }
  h * 60 + mn
}

#' Hora tecleada a minutos desde la medianoche.
#'
#' Acepta am/pm («9:25am», «3:25 pm») y 24 horas («15:25») por igual. La
#' basura vuelve como NA declarado: ni cero —el cero es una hora real, la
#' medianoche— ni error —una celda tecleada mal no tumba el plan entero.
#'
#' @param x vector de horas tecleadas.
#' @return vector numérico de minutos; NA donde no se pudo leer.
#' @keywords internal
monitoreo_aulas_hora_parse <- function(x) {
  vapply(as.character(x), .mav_hora_una, numeric(1), USE.NAMES = FALSE)
}

# Minutos desde la medianoche a «HH:MM» de 24 horas con cero a la izquierda:
# la forma canónica de salida, comparable y ordenable.
.mav_hhmm <- function(m) {
  m <- as.integer(m)
  sprintf("%02d:%02d", m %/% 60L, m %% 60L)
}

# La fecha agendada, normalizada a ISO — o "" si no se puede leer.
#
# Tolera ISO («2026-09-05», lo que escribe la app) y d/m/Y («05/09/2026», lo
# que teclea el equipo en el Sheets). No hay normalizador compartido que
# reusar con esta tolerancia: el del plan del día (`.capd_dia`) es ISO-only a
# propósito y `.caa_fecha` (agendadas) resuelve otro problema, el serial
# numérico de Excel. Se declara aquí, acotado al módulo.
.mav_fecha <- function(x) {
  v <- trimws(.monitoreo_scalar(x, ""))
  if (!nzchar(v)) return("")
  if (grepl("^[0-9]{4}-[0-9]{2}-[0-9]{2}$", v)) {
    f <- suppressWarnings(as.Date(v, format = "%Y-%m-%d"))
  } else if (grepl("^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$", v)) {
    f <- suppressWarnings(as.Date(v, format = "%d/%m/%Y"))
  } else {
    return("")
  }
  if (!length(f) || is.na(f)) return("")
  format(f, "%Y-%m-%d")
}

# El token de día (LUN…DOM) de una fecha ISO, o "" sin fecha.
.mav_dia_token <- function(fecha_iso) {
  if (!nzchar(fecha_iso)) return("")
  f <- suppressWarnings(as.Date(fecha_iso, format = "%Y-%m-%d"))
  if (!length(f) || is.na(f)) return("")
  .mav_DIAS[[as.POSIXlt(f)$wday + 1L]]
}

# Las sesiones de `sesiones_dia_hora`, parseadas. El campo llega en la forma
# agrupada del catálogo («VIE 17:00-20:00», «MAR 14:00-16:00 · MIE
# 16:00-18:00», «LUN y MIE 11:00-13:00» — `.cm_aulas_agrupar_horario`); se
# tolera también el separador crudo `<br />` del Sheets original. Cada sesión
# sale como {dias, ini, fin} en minutos; lo que no casa la gramática se
# descarta de la lista SIN inventarle una lectura — la fila sin sesiones
# legibles termina en `sin_ventana`, que es su declaración.
.mav_sesiones <- function(texto) {
  x <- trimws(.monitoreo_scalar(texto, ""))
  if (!nzchar(x)) return(list())
  trozos <- trimws(unlist(strsplit(x, "<br[[:space:]]*/?>|·", perl = TRUE)))
  trozos <- trozos[nzchar(trozos)]
  out <- list()
  for (tr in trozos) {
    m <- regmatches(tr, regexec("([0-9]{1,2}:[0-9]{2})[[:space:]]*-[[:space:]]*([0-9]{1,2}:[0-9]{2})", tr))[[1]]
    if (length(m) < 3L) next
    ini <- .mav_hora_una(m[[2]])
    fin <- .mav_hora_una(m[[3]])
    if (is.na(ini) || is.na(fin) || fin <= ini) next
    dias <- regmatches(toupper(tr), gregexpr("\\b(LUN|MAR|MIE|JUE|VIE|SAB|DOM)\\b", toupper(tr)))[[1]]
    out[[length(out) + 1L]] <- list(dias = unique(dias), ini = ini, fin = fin)
  }
  out
}

# El rango tentativo de un aula multi-sesión — DECISIÓN DEL LEAD (B11,
# 2026-09-01): con fecha agendada, la franja del DÍA agendado (el día se
# deriva de la fecha, sin locale); sin fecha, o si ninguna sesión cae en ese
# día, el rango completo del curso (del primer inicio al último fin). NULL si
# no hay ninguna sesión legible.
.mav_rango_curso <- function(texto, fecha_iso) {
  sesiones <- .mav_sesiones(texto)
  if (!length(sesiones)) return(NULL)
  token <- .mav_dia_token(fecha_iso)
  if (nzchar(token)) {
    for (s in sesiones) {
      if (token %in% s$dias) return(list(ini = s$ini, fin = s$fin))
    }
  }
  list(
    ini = min(vapply(sesiones, function(s) s$ini, numeric(1))),
    fin = max(vapply(sesiones, function(s) s$fin, numeric(1)))
  )
}

# Las franjas de un día a partir de sus ventanas confirmadas [ini, fin), por
# barrido de cortes: cada tramo entre dos cortes consecutivos cuenta cuántas
# ventanas lo cubren, y solo se emiten los tramos ocupados. Dos ventanas
# adyacentes (una termina 09:45, otra empieza 09:45) NO se solapan: a esa
# hora un equipo sale y el otro entra.
.mav_franjas <- function(ventanas) {
  if (!length(ventanas)) return(list())
  inis <- vapply(ventanas, function(v) v[[1L]], numeric(1))
  fins <- vapply(ventanas, function(v) v[[2L]], numeric(1))
  cortes <- sort(unique(c(inis, fins)))
  franjas <- list()
  for (i in seq_len(length(cortes) - 1L)) {
    a <- cortes[[i]]
    b <- cortes[[i + 1L]]
    n <- sum(inis < b & fins > a)
    if (n > 0L) {
      franjas[[length(franjas) + 1L]] <- list(
        inicio = .mav_hhmm(a),
        fin = .mav_hhmm(b),
        confirmadas = as.integer(n)
      )
    }
  }
  franjas
}

#' Ventanas de aplicación por aula y mapa horario por día.
#'
#' Por aula: `{codigo, ventana, fecha, inicio, fin}` con `ventana` en
#' {confirmada, tentativa, sin_ventana} — confirmada = fecha agendada + hora
#' pactada → [hora, hora + duración]; tentativa = agendada sin hora → la franja
#' del curso; sin_ventana = ni hora ni franja legible, con inicio y fin
#' vacíos (declarado, no inventado).
#'
#' Por día (`mapa`): `{fecha, franjas, por_confirmar}`. Las franjas cuentan
#' SOLO ventanas confirmadas —la cifra de personas del operativo, y
#' `personas_fuente = "confirmadas"` lo declara—; las tentativas del día se
#' listan aparte en `por_confirmar`, porque una cita que aún no existe no
#' pide gente todavía.
#'
#' Las aulas del balde `retirada` (reemplazada/cancelada/sin_acceso/
#' reemplazo_pendiente — `.madt_balde()`, el MISMO criterio que la población
#' del Plan del día) quedan fuera de aulas y mapa — DECISIÓN DEL LEAD (B11,
#' 2026-09-01): un aula cancelada no pide personas. También queda fuera el
#' RECHAZO tecleado en STATUS MUESTRA (`.madt_rechazada()`, B13b): cita
#' pactada y luego rechazo es una ventana que ya no pide gente. La ausencia
#' de estado no es un retiro: cae en `pendiente` y entra. EN CONTACTO es
#' gestión y se conserva: con rango de curso sale tentativa del día.
#'
#' @param plan plan normalizado: lista de filas o data.frame (mismo formato
#'   que `monitoreo_aulas_dos_tasas`).
#' @param duracion_min minutos que dura la aplicación (B70): default 30
#'   (dictado 2026-09-03); el config de aulas (`duracion_aplicacion_min`)
#'   manda cuando el estudio lo declara.
#' @return lista con `aulas`, `mapa` y `personas_fuente`.
#' @keywords internal
monitoreo_aulas_ventanas <- function(plan = list(),
                                     duracion_min = .mav_DURACION_MIN) {
  duracion_min <- suppressWarnings(as.integer(duracion_min %||% .mav_DURACION_MIN)[1])
  if (is.na(duracion_min) || duracion_min < 1L) duracion_min <- .mav_DURACION_MIN
  filas <- .madt_filas(plan)
  aulas <- list()
  confirmadas <- list() # fecha ISO -> lista de c(ini, fin) en minutos
  tentativas <- list() # fecha ISO -> códigos por confirmar

  for (fila in filas) {
    codigo <- trimws(.monitoreo_scalar(fila[["operational_code"]], ""))
    if (!nzchar(codigo)) next
    # Retiradas fuera de aulas y mapa (decisión del lead, B11): mismo balde
    # que el Plan del día. El barrido fino de estados lo pineará después.
    estado <- .monitoreo_scalar(fila[["operational_status"]], "")
    if (identical(.madt_balde(estado), "retirada")) next
    # B13b: el RECHAZO tecleado en STATUS MUESTRA también saca la ventana del
    # mapa — mismo helper que dos_tasas y el Plan del día.
    if (.madt_rechazada(fila)) next

    fecha <- .mav_fecha(fila[["scheduled_date"]])
    hora <- .mav_hora_una(.monitoreo_scalar(fila[["scheduled_time"]], ""))

    if (nzchar(fecha) && !is.na(hora)) {
      # Cita completa: fecha agendada + hora pactada. La duración configurada.
      ini <- hora
      fin <- hora + duracion_min
      aula <- list(
        codigo = codigo, ventana = "confirmada", fecha = fecha,
        inicio = .mav_hhmm(ini), fin = .mav_hhmm(fin)
      )
      # B71 (dictado 2026-09-03): el mapa del día —y su pico, que fija
      # cuántos aplicadores hacen falta— cuenta la OCUPACIÓN de la persona
      # ([recojo, fin]), no la aplicación sola: dos citas cuyas horas
      # completas se cruzan SON un cruce aunque las aulas no coincidan.
      confirmadas[[fecha]] <- c(confirmadas[[fecha]],
                                list(c(max(0, ini - .mav_PREPARACION_MIN), fin)))
    } else if (!is.na(hora)) {
      # Hueco del contrato, decidido aquí y documentado: hora pactada SIN
      # fecha legible. No es confirmada (la cita no tiene día) ni
      # sin_ventana (hora pactada hay): tentativa con la ventana de la hora
      # y fecha vacía. Sin día no hay dónde pintarla en el mapa.
      aula <- list(
        codigo = codigo, ventana = "tentativa", fecha = "",
        inicio = .mav_hhmm(hora), fin = .mav_hhmm(hora + duracion_min)
      )
    } else {
      rango <- .mav_rango_curso(fila[["sesiones_dia_hora"]], fecha)
      if (!is.null(rango)) {
        aula <- list(
          codigo = codigo, ventana = "tentativa", fecha = fecha,
          inicio = .mav_hhmm(rango$ini), fin = .mav_hhmm(rango$fin)
        )
        if (nzchar(fecha)) tentativas[[fecha]] <- c(tentativas[[fecha]], codigo)
      } else {
        aula <- list(
          codigo = codigo, ventana = "sin_ventana", fecha = fecha,
          inicio = "", fin = ""
        )
      }
    }
    aulas[[length(aulas) + 1L]] <- aula
  }

  # Días en orden ascendente (ISO es lexicográfico) — determinista.
  fechas_mapa <- sort(unique(c(names(confirmadas), names(tentativas))))
  mapa <- lapply(fechas_mapa, function(fecha) {
    list(
      fecha = fecha,
      franjas = .mav_franjas(confirmadas[[fecha]] %||% list()),
      por_confirmar = as.list(tentativas[[fecha]] %||% character(0))
    )
  })

  # B70: el eco de la duración YA saneada — los derivados (franjas, reparto)
  # la leen de aquí en vez de re-sanear cada uno la suya.
  list(aulas = aulas, mapa = mapa, personas_fuente = "confirmadas",
       duracion_min = duracion_min)
}

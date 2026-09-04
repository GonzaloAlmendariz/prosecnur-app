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

# Los 13 títulos de 2025 en el orden del recorte que el equipo copiaba a mano,
# más la ventana de B21: INICIO y FIN entran ADYACENTES tras HORA (la ventana
# se lee de un vistazo, no partida) sin alterar el orden relativo de los 13.
# Dictado 2026-09-04: «super importante: a qué hora deben estar en la oficina, a
# qué hora irse a aplicar y a qué hora terminan». Las dos horas nuevas abren la
# secuencia del día —oficina, salida, inicio, fin— porque asi es como se vive:
# primero se recogen materiales, despues se camina al aula y al final se aplica.
# El protocolo (T-30 y T-15) es el MISMO del motor, no una constante local.
#
# Y «ENLACE DE LA FICHA QR» dice de que ficha habla: la columna ya traia el
# enlace que la app genera (`link`), pero su nombre a secas se confundia con el
# de la ficha ESCANEADA que el equipo sube en la hoja de campo.
.capd_CABECERA <- c(
  "FECHA AGENDADA", "DÍA", "HORA", "EN OFICINA", "SALE AL AULA", "INICIO", "FIN",
  "CURSO-HORARIO",
  "NOMBRE DEL CURSO", "FACULTAD", "SESIONES Y AULA", "NOMBRE DE DOCENTE",
  "TELÉFONO DE DOCENTE", "ELEGIBLES",
  # Dictado 2026-09-04: «poder mapear fácilmente cuántas se esperaban en total y
  # en hombres y en mujeres, y cuánto obtuvimos».
  #
  # El reparto por sexo va en UNA celda de texto («F 12 · M 8») y no en dos
  # columnas fijas a proposito: las etiquetas de sexo salen del padron del
  # estudio y no siempre son las dos que uno espera. Poner «MUJERES» y
  # «HOMBRES» de cabecera obligaria a adivinar cual de `sex_top_1` /
  # `sex_top_2` es cual, y ese es exactamente el error que ya costo una lectura
  # (`sub_a` es el sexo MAS FRECUENTE, no las mujeres). La celda dice las
  # etiquetas que el dato trae.
  #
  # De donde sale el reparto tambien se declara, porque las dos fuentes no
  # valen lo mismo: la hoja de control lo trae directo, y si no, se deriva de la
  # composicion del aula suponiendo que la efectividad no depende del sexo — que
  # es justo el supuesto que la calibracion existe para poner a prueba.
  "ESPERADAS", "ESPERADAS POR SEXO", "OBTENIDAS", "OBTENIDAS POR SEXO",
  "APLICADOR", "ESTADO",
  "ENLACE DE LA FICHA QR"
)

# B21: la ventana de aplicación de una fila-aula. INICIO = la hora pactada
# parseada con el MISMO parser del motor B11 (`monitoreo_aulas_hora_parse`:
# am/pm y 24h por igual, basura = NA declarado); FIN = inicio +
# `.mav_DURACION_MIN` — la constante del motor, leída EN CADA llamada y jamás
# otro 20 suelto: el «configurable» del dictado es un solo sitio donde cambiar
# la duración. Sin hora legible no hay ventana que declarar: ambas vacías, ni
# inventadas ni «00:00».
.capd_ventana <- function(unidad) {
  hora <- monitoreo_aulas_hora_parse(.calg_txt(unidad$scheduled_time))[[1]]
  if (is.na(hora)) return(c("", "", "", ""))
  # Dictado 2026-09-04: la jornada completa, en el orden en que se vive.
  # Oficina y salida salen del MISMO protocolo del motor que usa el reparto
  # (T-30 y T-15); repetir aquí los números sería la segunda copia que un día
  # se queda vieja.
  c(.mav_hhmm(hora - .mav_PREPARACION_MIN), .mav_hhmm(hora - .mav_SALIDA_MIN),
    .mav_hhmm(hora), .mav_hhmm(hora + .mav_DURACION_MIN))
}

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

# SESIONES Y AULA: el lugar del día. Precedencia B30 (dictado 2026-09-02): el
# aula/pabellón CONFIRMADO (`scheduled_venue`, la columna LUGAR DE APLICACIÓN
# que el equipo teclea en el libro) MANDA cuando existe — es donde se pactó
# aplicar y puede diferir del aula de la clase. Sin él se cae a lo que el plan
# sepa del curso: el horario de sesiones (`schedule`) y el ambiente (`label`),
# unidos cuando vienen los dos — no hay columna 1:1 en el plan para este
# rótulo de 2025; se declara lo que hay.
.capd_sesiones_y_aula <- function(unidad) {
  confirmado <- trimws(.calg_txt(unidad$scheduled_venue))
  if (nzchar(confirmado)) return(confirmado)
  partes <- c(.calg_txt(unidad$schedule), .calg_txt(unidad$label))
  paste(partes[nzchar(partes)], collapse = " · ")
}

# Una fila ESTRUCTURAL de la hoja (totales, marcador o pendiente re-listada):
# solo se escriben las celdas proyectadas por título de cabecera; el resto
# (DÍA, HORA, FACULTAD, TELÉFONO, ELEGIBLES, SESIONES, ENLACE… y sobre todo
# CURSO-HORARIO) queda VACÍO — la fila no es un aula y un recorte por código
# no debe contarla.
.capd_fila_estructural <- function(...) {
  celdas <- list(...)
  fila <- rep("", length(.capd_CABECERA))
  for (titulo in names(celdas)) {
    fila[[match(titulo, .capd_CABECERA)]] <- as.character(celdas[[titulo]])
  }
  fila
}

# B2.1b(a): la fila de totales que cierra cada grupo de fecha agendada.
# Conteos ENTEROS de la población del día (las retiradas ya quedaron fuera al
# poblar la hoja) con la identidad agendadas = con parte + pendientes.
.capd_fila_totales <- function(agendadas, rendidos) {
  .capd_fila_estructural(
    `FECHA AGENDADA` = "Total de la jornada",
    `NOMBRE DEL CURSO` = sprintf("Aulas agendadas: %d", as.integer(agendadas)),
    `APLICADOR` = sprintf("Con parte rendido: %d", as.integer(rendidos)),
    `ESTADO` = sprintf("Pendientes: %d", as.integer(agendadas - rendidos))
  )
}

# B2.1b(c): la sección final de pendientes de jornadas anteriores.
#
# El generador NO tiene reloj (cero Sys.Date(): la hoja es determinista); la
# frontera del «hoy» es la ÚLTIMA fecha agendada de la población con algún
# parte rendido. Pendiente de jornada anterior = aula con fecha ESTRICTAMENTE
# anterior a esa frontera y sin parte; la comparación es sobre el ISO
# `YYYY-MM-DD`, donde el orden lexicográfico ES el cronológico. Sin partes no
# hay frontera y sin frontera no hay pendientes: sale el vacío declarado (C3),
# jamás la sección ausente en silencio.
#
# Cada pendiente se re-lista con su fecha ORIGINAL, curso, docente y estado
# legible pero con código VACÍO: la sección re-lista, no duplica aulas ante un
# recorte por código.
.capd_seccion_pendientes <- function(poblacion, fechas, codigos, con_parte) {
  rendidas <- fechas[codigos %in% con_parte]
  frontera <- if (length(rendidas)) max(rendidas) else ""
  pendientes <- if (nzchar(frontera)) {
    which(fechas < frontera & !(codigos %in% con_parte))
  } else {
    integer(0)
  }
  if (!length(pendientes)) {
    return(list(.capd_fila_estructural(
      `FECHA AGENDADA` = "Sin pendientes de jornadas anteriores"
    )))
  }
  c(
    list(.capd_fila_estructural(
      `FECHA AGENDADA` = "Pendientes de jornadas anteriores"
    )),
    lapply(pendientes, function(i) {
      u <- poblacion[[i]]
      .capd_fila_estructural(
        `FECHA AGENDADA` = fechas[[i]],
        `NOMBRE DEL CURSO` = .calg_txt(u$course_name),
        `NOMBRE DE DOCENTE` = .calg_txt(u$teacher),
        `ESTADO` = .capd_estado_legible(u$operational_status)
      )
    })
  )
}

#' Arma la hoja «Plan del día» a partir del plan y los partes.
#'
#' Población: SOLO filas con `scheduled_date` no vacío, excluyendo los estados
#' retirados del eje `operational_status` — el balde `retirada` de
#' `.madt_balde()` (monitoreo_aulas_dos_tasas.R), que es UNA lista y no dos:
#' reemplazada/cancelada/sin_acceso/reemplazo_pendiente — y el RECHAZO
#' tecleado en STATUS MUESTRA (`.madt_rechazada()`, B13b): un aula rechazada
#' no abre jornada ni suma al total, nadie va a ese salón. La AUSENCIA de
#' estado no es un retiro (cae en `pendiente`), y titulares y reservas
#' activadas con fecha entran por igual: el plan del día es de quien va al
#' aula, no del rol de muestreo.
#'
#' Orden: `scheduled_date` ascendente (ISO es lexicográfico) y, dentro del
#' día, `scheduled_time`.
#'
#' B2.1b: cada grupo de fecha cierra con una fila «Total de la jornada»
#' (agendadas = con parte rendido + pendientes) y la hoja termina con la
#' sección «Pendientes de jornadas anteriores» — o su vacío declarado. Las
#' filas estructurales llevan CURSO-HORARIO vacío: las filas-aula siguen
#' siendo exactamente las de siempre.
#'
#' @param unidades filas del plan (formato largo).
#' @param partes partes de campo ya registrados; el APLICADOR sale del intento
#'   1 por `.MONITOREO_AULAS_PARTE_ALIAS[["aplicador"]]` (mismo índice
#'   `codigo#intento` que el resto del libro).
#' @return data.frame de celdas SIN nombres, cabecera como primera fila.
# Las esperadas de un aula: el total y su reparto por sexo, con la etiqueta que
# el dato trae. Reusa `.mac_esperadas_por_sexo()` —el mismo reparto que la
# calibracion— para que no existan dos cuentas de lo mismo.
# **Las esperadas se escriben en PERSONAS, no en decimales.**
#
# El motor las calcula como un producto de tasas, así que salen `21.6` y
# `F 11.00377 · M 10.59623`. Eso al aplicador no le dice nada: no puede
# conseguir once coma cero cero encuestas de mujeres. Se redondea el total y el
# reparto por sexo se ajusta por RESTO MAYOR, para que las partes sumen
# exactamente el total escrito y la hoja no se contradiga a sí misma.
.capd_enteros_que_suman <- function(v, total) {
  if (!length(v)) return(v)
  if (!is.finite(total) || total <= 0) return(stats::setNames(rep(0L, length(v)), names(v)))
  suma <- sum(v)
  escala <- if (suma > 0) total / suma else 0
  exacto <- v * escala
  base <- floor(exacto)
  faltan <- as.integer(round(total - sum(base)))
  if (faltan > 0L) {
    # Al que le sobra más resto, primero; el empate lo rompe el orden de entrada,
    # que ya viene decidido por el contador de sexos.
    orden <- order(-(exacto - base), seq_along(v))
    base[orden[seq_len(min(faltan, length(v)))]] <-
      base[orden[seq_len(min(faltan, length(v)))]] + 1
  }
  stats::setNames(as.integer(base), names(v))
}

.capd_esperadas <- function(u) {
  esp <- suppressWarnings(as.numeric(
    .monitoreo_scalar(u$expected_valid %||% u$efectivas_esperadas %||% NA, NA))[1])
  esp_entero <- if (is.finite(esp)) as.integer(round(esp)) else NA_integer_
  total <- if (is.finite(esp)) .calg_num_txt(esp_entero) else ""
  reparto <- .mac_esperadas_por_sexo(u)
  v <- .capd_enteros_que_suman(reparto$valores, esp_entero)
  por_sexo <- if (!length(v)) "" else paste(
    vapply(seq_along(v), function(i)
      sprintf("%s %s", names(v)[[i]], .calg_num_txt(v[[i]])), character(1)),
    collapse = " · ")
  list(total = total, por_sexo = por_sexo)
}

# Un vector con nombre por sexo, escrito como la celda de esperadas: «M 8 · F 6».
# Vacio cuando no hay nada que decir; el «Sin declarar» del contador entra igual,
# porque una respuesta sin sexo es un dato del campo y no un hueco a esconder.
.capd_por_sexo <- function(v) {
  if (!length(v)) return("")
  paste(vapply(seq_along(v), function(i)
    sprintf("%s %s", names(v)[[i]], .calg_num_txt(v[[i]])), character(1)),
    collapse = " · ")
}

aulas_libro_hoja_plan_dia <- function(unidades, partes = list(), efectivas = NULL,
                                      efectivas_sexo = NULL, asignados = NULL) {
  # Partes por código e intento, con el MISMO índice `%s#%d` del generador de
  # «Aulas Aplicadas (Campo)»: dos índices distintos para el mismo parte es la
  # clase de lista paralela que este libro ya pagó.
  por_aula <- list()
  # B2.1b: «con parte rendido» pregunta si el aula YA rindió algún parte, no en
  # qué intento — un parte de intento >1 sin intento 1 cuenta igual (decisión
  # aceptada por el lead).
  con_parte <- character(0)
  for (pt in (partes %||% list())) {
    if (!is.list(pt)) next
    cod <- .calg_txt(pt$operational_code, .calg_txt(pt$classroom_id))
    if (!nzchar(cod)) next
    n <- suppressWarnings(as.integer(pt$intento %||% 1L))
    if (!length(n) || !is.finite(n) || n < 1L) n <- 1L
    por_aula[[sprintf("%s#%d", cod, n)]] <- pt
    con_parte <- unique(c(con_parte, cod))
  }

  poblacion <- Filter(function(u) {
    if (!is.list(u)) return(FALSE)
    if (!nzchar(.calg_txt(u$scheduled_date))) return(FALSE)
    if (identical(.madt_balde(.calg_txt(u$operational_status)), "retirada")) return(FALSE)
    # B13b: cita pactada y luego RECHAZO — la jornada ya no la incluye. Mismo
    # helper que dos_tasas y ventanas: un criterio, no tres copias.
    !.madt_rechazada(u)
  }, unidades %||% list())

  fechas <- vapply(poblacion, function(u) .calg_txt(u$scheduled_date), character(1))
  # **La jornada baja de más temprano a más tarde, y eso exige MINUTOS.**
  #
  # Ordenaba por el texto de `scheduled_time`, que es como el equipo lo teclea
  # («1:45 pm», «11:30 am»), y en texto «1:45 pm» va ANTES que «11:30 am». Visto
  # sobre el Sheets publicado el 2026-09-04: el lunes abría con la de la una y
  # media de la tarde y seguía con las de la mañana. El mismo parser del motor
  # que ya calcula INICIO da el número con el que sí se ordena; una hora
  # ilegible va al final en vez de colarse entre las buenas.
  horas <- vapply(poblacion, function(u) {
    m <- monitoreo_aulas_hora_parse(.calg_txt(u$scheduled_time))[[1]]
    if (is.na(m)) Inf else as.numeric(m)
  }, numeric(1))
  orden <- order(fechas, horas)
  poblacion <- poblacion[orden]
  fechas <- fechas[orden]
  codigos <- vapply(poblacion, function(u) .calg_txt(u$operational_code), character(1))

  fila_aula <- function(u) {
    parte1 <- por_aula[[sprintf("%s#1", .calg_txt(u$operational_code))]]
    # **El aplicador sale de la ASIGNACIÓN; el parte sólo lo corrige.**
    #
    # Antes salía únicamente del parte de campo, y como el parte se rinde
    # DESPUÉS de aplicar, la columna estaba vacía en toda la hoja: justo la que
    # el equipo abre la noche anterior para saber quién va a cada aula. Gonzalo
    # lo vio publicado el 2026-09-04: «no sale el aplicador que salió».
    #
    # El orden importa: si hay parte, manda el parte —quien fue de verdad puede
    # no ser quien estaba asignado, y la hoja debe contar lo ocurrido, no lo
    # planeado—; si no lo hay, manda el reparto.
    cod_u <- .calg_txt(u$operational_code)
    # `list()[["x"]]` no devuelve NULL: revienta con «subscript out of bounds».
    asignado <- if (nzchar(cod_u) && cod_u %in% names(asignados %||% list())) {
      .calg_txt(asignados[[cod_u]])
    } else ""
    aplicador <- if (is.null(parte1)) asignado else .calg_txt(
      .monitoreo_aulas_parte_primero(parte1, .MONITOREO_AULAS_PARTE_ALIAS[["aplicador"]])
    )
    ventana <- .capd_ventana(u)
    c(
      .calg_txt(u$scheduled_date),
      .capd_dia(u),
      .calg_txt(u$scheduled_time),
      ventana[[1L]],   # EN OFICINA
      ventana[[2L]],   # SALE AL AULA
      ventana[[3L]],   # INICIO
      ventana[[4L]],   # FIN
      .calg_txt(u$operational_code),
      .calg_txt(u$course_name),
      .calg_txt(u$faculty),
      .capd_sesiones_y_aula(u),
      .calg_txt(u$teacher),
      .calg_txt(u$teacher_phone),
      .calg_num_txt(u$eligible_n),
      .capd_esperadas(u)[["total"]],
      .capd_esperadas(u)[["por_sexo"]],
      .calg_num_txt(efectivas[[.calg_txt(u$operational_code)]] %||% NULL),
      .capd_por_sexo(efectivas_sexo[[.calg_txt(u$operational_code)]] %||% NULL),
      aplicador,
      .capd_estado_legible(u$operational_status),
      .calg_txt(u$link)
    )
  }

  # B2.1b(a): las aulas de cada fecha y, al cierre del grupo, sus totales. La
  # retirada no abre jornada: ya quedó fuera de la población.
  filas <- list()
  for (fecha in unique(fechas)) {
    del_dia <- which(fechas == fecha)
    filas <- c(
      filas,
      lapply(poblacion[del_dia], fila_aula),
      list(.capd_fila_totales(
        agendadas = length(del_dia),
        rendidos = sum(codigos[del_dia] %in% con_parte)
      ))
    )
  }
  filas <- c(filas, .capd_seccion_pendientes(poblacion, fechas, codigos, con_parte))
  as.data.frame(do.call(rbind, c(list(.capd_CABECERA), filas)),
                stringsAsFactors = FALSE)
}

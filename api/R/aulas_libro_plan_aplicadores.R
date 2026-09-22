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
  "CURSO-HORARIO", "AULA", "FACULTAD", "CURSO", "DOCENTE", "ESTADO"
)

#' Los SIETE estados de una cita en la hoja de los aplicadores.
#'
#' Dictado de Gonzalo (2026-09-08): «necesitamos una columna más que diga el
#' estatus que sea por aplicar, aplicada, reagendada, rechazada».
#'
#' Las dos primeras las sabe la app —el parte o las respuestas dicen si el aula
#' se aplicó—; las demás las elige el equipo en el chip desplegable de la
#' columna, y son la razón de que exista: una reagendación se anota aquí ANTES
#' de aplicarse, y así la app puede reconocerla.
#'
#' **«APLICADA» no es sólo de la app**: el coordinador también puede elegirla, y
#' normalmente antes de que llegue el parte. Por eso el motor nunca la degrada
#' —ver `aulas_distribucion_estado_a_publicar()`—.
#'
#' En MAYÚSCULAS y en el vocabulario del libro, que es donde el equipo ya los
#' lee («APLICADA» es el mismo valor que escribe la hoja de campo).
#'
#' **El orden es el de SU desplegable** (2026-09-10, con la validación de la
#' hoja delante: «deberían ser estas»), no el alfabético ni el de aparición: es
#' una lista que el equipo abre y recorre con la vista, y reordenarla les mueve
#' de sitio el que buscan.
#'
#' «NO APLICADA» NO está aquí aunque el libro del operativo la use en «STATUS DE
#' APLICACIÓN»: son dos vocabularios de dos hojas distintas, y meterla en este
#' desplegable le añadiría al equipo una opción que él no puso.
#'
#' **«APLICADA SIN AGENDACIÓN» es el sexto, y no es un matiz de los otros dos**
#' (Gonzalo, 2026-09-10, sobre una que aplicaron esa manana: «al final pudimos
#' ir al aula de la manana (...) le he puesto aplicada sin agendacion, la app
#' deberia ser capaz de reconocerlo como un estado posible»).
#'
#' Nombra el caso que el operativo empezo a usar cuando el campo va MAS RAPIDO
#' que la agenda: el aplicador se presenta a una clase que nadie habia agendado
#' y le dejan entrar. No es «APLICADA» a secas —esa supone que hubo cita y se
#' cumplio— ni «APLICADA POR REAGENDACIÓN» —esa tuvo cita y se movio—: aqui
#' nunca hubo cita. Separarlas es lo que permite medir cuanto del avance sale
#' de la agenda y cuanto de tocar puertas, que son dos operativos distintos con
#' costes distintos.
#'
#' **El `@export` va al FINAL del bloque, no en medio.** Estaba tras el primer
#' párrafo y con prosa detrás: roxygen no admite texto después de una etiqueta,
#' así que se comía la marca y la constante no llegaba a `NAMESPACE`. Nadie lo
#' vio porque el fichero conservaba la línea de una regeneración anterior; salió
#' al regenerar el 2026-09-10.
#' @export
MONITOREO_AULAS_ESTADOS_DISTRIBUCION <- c(
  "POR APLICAR", "APLICADA", "APLICADA POR REAGENDACIÓN",
  "REAGENDADA", "RECHAZADA",
  "APLICADA SIN AGENDACIÓN", "POR APLICAR SIN AGENDACIÓN"
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
#' El estado ya publicado de una cita, o `""` si esa cita no estaba.
#'
#' Con `[[` directo, una clave ausente en un vector con nombre LANZA en vez de
#' devolver `NULL`, así que el `%||%` de al lado nunca llega a actuar: el fallo
#' sale como «subscript out of bounds» tres capas más abajo, en un helper que no
#' tiene nada que ver. Se busca por posición, que sí devuelve vacío.
#' @keywords internal
.alpa_estado_previo <- function(previos, codigo, fecha) {
  nombres <- names(previos %||% character(0))
  if (!length(nombres)) return("")
  i <- match(paste(codigo, fecha, sep = "\r"), nombres)
  if (is.na(i)) "" else as.character(previos[[i]])
}

# **El respaldo entra con el hueco, no sólo con el NULL.**
#
# Estaba escrito `x %||% default`, y `%||%` sólo cae cuando el valor es NULL:
# un campo PRESENTE y vacío —que es como llega casi todo lo que el equipo no
# tecleó en el Sheets— ganaba, y el respaldo no se miraba nunca.
#
# Lo destapó la única llamada que pasa respaldo, la del aula
# (`scheduled_venue` con `venue` detrás). Medido el 2026-09-21 publicando la
# semana 1 de CCSS Perfil 2026-II: CH 9, CH 20 y CH 43 salieron a la hoja de
# los aplicadores SIN AULA teniendo el catálogo su 106B, su J305 y su
# «Z413 · Z203». Tres personas mañana con una fila que no dice a dónde ir.
#
# Las demás llamadas pasan el default vacío, donde vacío y respaldo son lo
# mismo: el cambio sólo puede mejorar, nunca tapar un valor real.
.alpa_txt <- function(x, default = "") {
  v <- suppressWarnings(as.character(x)[1])
  v <- if (length(v) != 1L || is.na(v)) "" else trimws(v)
  if (nzchar(v)) v else default
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


# =============================================================================
# Los titulares SIN AGENDAR, dentro de la misma hoja
# =============================================================================
#
# Gonzalo, 2026-09-21, después de ver la primera versión en una hoja aparte:
# «en vez de tener dos hojas separadas, en la hoja de reparto de la semana 1
# podemos poner integrados todos los cursos-horario titulares no confirmados
# […] que sigan la misma lógica, la misma estructura que la base original».
#
# **Por qué en la MISMA hoja y no al lado.** Él mismo lo dijo: «la ventaja de
# que esté en una misma hoja y que se repita en la siguiente semana es que
# tienes la misma posibilidad de asignarles estados, la misma posibilidad de
# asignarles responsables, y todo eso lo hacen manualmente: el coordinador de
# campo asigna». Una hoja de referencia aparte es de sólo mirar; una fila en la
# hoja del reparto tiene su desplegable de aplicador y su chip de estado, y se
# trabaja igual que las demás.
#
# **CUÁNDO DEJA DE APARECER.** No siempre: «si ya ha sido aplicada o ha sido
# rechazada, o en todo caso reagendada, tiene que adaptarse al contexto. Si ha
# sido aplicado o rechazada, ya no vuelven a aparecer. Y si ha sido reagendada,
# ya la podemos asumir como una agendación». Los cinco estados terminales de
# los siete: una fila con cualquiera de ellos sale de la lista y no vuelve la
# semana siguiente.
#
# Y el estado vive EN EL SHEETS, tecleado por el coordinador, así que la
# decisión se toma leyendo lo publicado —no el plan—, que es lo que
# `estados_previos` ya traía para no degradar lo que él puso.
.ALPA_TERMINALES <- c(
  "APLICADA", "APLICADA POR REAGENDACIÓN", "APLICADA SIN AGENDACIÓN",
  "REAGENDADA", "RECHAZADA"
)

# ¿El código tiene ya un estado terminal en lo publicado? Se mira por CÓDIGO y
# no por (código, fecha): una clase sin agendar se repite cada semana con otra
# fecha, así que atar la respuesta a la fecha la haría reaparecer el lunes
# siguiente como si nada hubiera pasado.
.alpa_cerrada_en_publicado <- function(previos, codigo) {
  nombres <- names(previos %||% character(0))
  if (!length(nombres) || !nzchar(codigo)) return(FALSE)
  suyas <- which(startsWith(nombres, paste0(codigo, "\r")))
  if (!length(suyas)) return(FALSE)
  estados <- vapply(suyas, function(i) aulas_distribucion_estado_canonico(previos[[i]]),
                    character(1))
  any(estados %in% .ALPA_TERMINALES)
}

# Las fechas de la semana que esta hoja cubre, por día de la semana. Salen del
# reparto que se está publicando: una hoja por semana trae los días de SU
# semana, y sin fechas legibles no hay dónde colgar una clase.
.alpa_semana_de <- function(rep) {
  f <- vapply((rep %||% list())[["dias"]] %||% list(),
              function(d) .alpa_txt(d[["fecha"]]), character(1))
  f <- f[grepl("^\\d{4}-\\d{2}-\\d{2}$", f)]
  if (!length(f)) return(character(0))
  lunes <- .mads_lunes_de(min(f))
  if (is.na(lunes)) return(character(0))
  fechas <- format(lunes + 0:5, "%Y-%m-%d")
  stats::setNames(fechas, vapply(fechas, .mav_dia_token, character(1)))
}

# El estado que el motor DEDUCE para una clase sin agendar. Sólo dos de los
# siete: lo demás lo elige el coordinador en el desplegable.
.alpa_estado_sin_agendar <- function(fila, aplicada) {
  # Dos fuentes de «ya se aplicó», y hacen falta las dos: la marca del operativo
  # —parte de campo o efectivas de plataforma— y la evidencia de la propia fila
  # (`respuestas_validas`), que es la que usa el resto del perfil para no
  # depender de un `operational_status` que nadie actualiza.
  if (isTRUE(aplicada) || .madt_aplicada_de_hecho(fila)) return("APLICADA SIN AGENDACIÓN")
  if (.madt_rechazada(fila)) return("RECHAZADA")
  "POR APLICAR SIN AGENDACIÓN"
}

#' Las filas de la hoja que ven los aplicadores.
#'
#' @param plan filas del plan.
#' @param disponibilidad oferta cargada; sin ella no hay reparto y devuelve NULL.
#' @param cfg config vigente del reparto (fijadas, rango, duración, semilla).
#' @param rep un reparto ya calculado con esa misma config (el del tablero);
#'   `NULL` lo calcula aquí.
#' @return lista de filas (la primera es la cabecera) o `NULL`.
#' @export
aulas_libro_filas_plan_aplicadores <- function(plan, disponibilidad, cfg = list(), rep = NULL,
                                              partes = list(), efectivas = NULL,
                                              estados_previos = character(0)) {
  if (is.null(disponibilidad) || !length(disponibilidad)) return(NULL)
  cfg <- if (is.list(cfg)) cfg else list()
  # S7: el tablero ya tiene el reparto calculado y lo pasa; sin él se calcula
  # aquí con la MISMA config, como siempre.
  if (!is.list(rep)) rep <- monitoreo_aulas_reparto_de_config(plan, disponibilidad, cfg)
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
      docente = .alpa_txt(u[["teacher"]]),
      # Lo que la app sabe de su agenda, para poder completar una fila que el
      # equipo añada con sólo el código y la hora.
      fecha = .alpa_txt(u[["scheduled_date"]]),
      hora = .alpa_txt(u[["scheduled_time"]])
    )
  }

  # Qué cursos-horario constan aplicados, con la MISMA definición que el resto
  # del operativo (`monitoreo_aulas_aula_aplicada()`): el parte, o que ya estén
  # llegando respuestas.
  aplicadas <- new.env(parent = emptyenv())
  local({
    unidades <- if (is.data.frame(plan)) split(plan, seq_len(nrow(plan))) else (plan %||% list())
    marca <- tryCatch(
      monitoreo_aulas_aula_aplicada(unidades, partes = partes, efectivas = efectivas),
      error = function(e) rep(FALSE, length(unidades))
    )
    for (i in seq_along(unidades)) {
      cod <- .alpa_txt(unidades[[i]][["operational_code"]])
      if (nzchar(cod) && isTRUE(marca[[i]])) aplicadas[[cod]] <- TRUE
    }
  })

  # Las filas se juntan POR FECHA antes de escribirse: las citas pactadas y las
  # clases sin agendar del mismo día se leen como una sola agenda, ordenadas
  # por hora, y no como dos listas pegadas.
  por_fecha <- list()
  anotar <- function(fecha, orden, fila) {
    por_fecha[[fecha]] <<- c(por_fecha[[fecha]] %||% list(),
                             list(list(orden = orden, fila = fila)))
  }

  for (dia in (rep[["dias"]] %||% list())) {
    fecha <- .alpa_txt(dia[["fecha"]])
    cuando <- .alpa_dia_y_fecha(fecha)
    for (it in (dia[["asignaciones"]] %||% list())) {
      cod <- .alpa_txt(it[["codigo"]])
      m <- meta[[cod]] %||% list(aula = "", facultad = "", curso = "", docente = "")
      anotar(fecha, paste(.alpa_txt(it[["recojo"]]), .alpa_txt(it[["inicio"]]), cod), list(
        aulas_nombre_aplicador(.alpa_txt(it[["aplicador"]])),
        cuando$dia, cuando$fecha,
        .alpa_txt(it[["recojo"]]),
        .alpa_txt(it[["salida"]]),
        paste0(.alpa_txt(it[["inicio"]]), " a ", .alpa_txt(it[["fin"]])),
        cod, m$aula, m$facultad, m$curso, m$docente,
        # POR APLICAR mientras no conste lo contrario — pero SIN DEGRADAR lo que
        # ya esté puesto: «APLICADA» también la elige el coordinador en el chip
        # desplegable, antes de que llegue el parte, y publicarle «POR APLICAR»
        # encima borraría lo que él sabe y la app todavía no.
        aulas_distribucion_estado_a_publicar(
          if (isTRUE(aplicadas[[cod]] %||% FALSE)) "APLICADA" else "POR APLICAR",
          .alpa_estado_previo(estados_previos, cod, cuando$fecha)
        )
      ))
    }
  }

  # **Y los TITULARES SIN AGENDAR de esa semana, con la misma estructura.**
  # Ver la cabecera de este bloque, arriba: van aquí y no en una hoja aparte
  # para que el coordinador pueda asignarles aplicador y estado igual que a las
  # demás. El APLICADOR va vacío a propósito: lo pone él.
  semana <- .alpa_semana_de(rep)
  if (length(semana)) {
    unidades <- if (is.data.frame(plan)) split(plan, seq_len(nrow(plan))) else (plan %||% list())
    for (u in unidades) {
      if (!identical(tolower(.alpa_txt(u[["sample_role"]])), "titular")) next
      if (nzchar(.alpa_txt(u[["scheduled_date"]]))) next
      cod <- .alpa_txt(u[["operational_code"]])
      if (!nzchar(cod)) next
      # Aplicada, rechazada o reagendada: se cierra y no vuelve la semana que
      # viene. Se mira lo PUBLICADO, que es donde el coordinador la cerró, y la
      # evidencia del propio operativo.
      if (.alpa_cerrada_en_publicado(estados_previos, cod)) next
      aplicada <- isTRUE(aplicadas[[cod]] %||% FALSE)
      deducido <- .alpa_estado_sin_agendar(u, aplicada)
      if (deducido %in% .ALPA_TERMINALES) next
      m <- meta[[cod]] %||% list(aula = "", facultad = "", curso = "", docente = "")
      for (ses in .mav_sesiones(.alpa_txt(u[["sesiones_dia_hora"]]))) {
        for (token in ses$dias) {
          fecha <- semana[[token]] %||% ""
          if (!nzchar(fecha)) next
          cuando <- .alpa_dia_y_fecha(fecha)
          anotar(fecha, paste(.mav_hhmm(max(0, ses$ini - .mav_PREPARACION_MIN)),
                              .mav_hhmm(ses$ini), cod), list(
            "",
            cuando$dia, cuando$fecha,
            .mav_hhmm(max(0, ses$ini - .mav_PREPARACION_MIN)),
            .mav_hhmm(max(0, ses$ini - .mav_SALIDA_MIN)),
            # La ventana de la CLASE, no una aplicación de media hora: quien
            # entra sin cita llega cuando puede dentro de ese rango.
            paste0(.mav_hhmm(ses$ini), " a ", .mav_hhmm(ses$fin)),
            cod, m$aula, m$facultad, m$curso, m$docente,
            aulas_distribucion_estado_a_publicar(
              deducido, .alpa_estado_previo(estados_previos, cod, cuando$fecha))
          ))
        }
      }
    }
  }

  filas <- list(as.list(.alpa_CABECERA))
  # `sort(character(0), method = "radix")` LANZA; una semana sin nada que
  # publicar es un caso normal —un plan sin fechas legibles— y devuelve la hoja
  # con su cabecera, que el llamador ya sabe descartar.
  fechas <- if (length(por_fecha)) sort(names(por_fecha), method = "radix") else character(0)
  for (fecha in fechas) {
    items <- por_fecha[[fecha]]
    orden <- order(vapply(items, function(x) x$orden, character(1)), method = "radix")
    for (x in items[orden]) filas[[length(filas) + 1L]] <- x$fila
  }
  filas
}

#' El color de cada aplicador, estable entre publicaciones.
#'
#' Por posición en el orden ALFABÉTICO y no por hash ni por orden de aparición:
#' dos publicaciones del mismo reparto tienen que salir con los mismos colores,
#' o el equipo aprende el suyo y al día siguiente es otro.
#'
#' El comodín va aparte, en gris cálido: no es una persona del equipo.
#' @keywords internal
.alpa_colores_de <- function(nombres) {
  nombres <- sort(unique(nombres[nzchar(nombres)]), method = "radix")
  personas <- setdiff(nombres, aulas_nombre_aplicador(MONITOREO_AULAS_INTERNO_PULSO))
  stats::setNames(
    .alpa_PALETA[((seq_along(personas) - 1L) %% length(.alpa_PALETA)) + 1L],
    personas
  )
}

#' El color de cada estado, dictado por Gonzalo el 2026-09-08 con el documento
#' del coordinador delante: «APLICADA (VERDE), POR APLICAR (AMARILLO) Y
#' REAGENDADA (NARANJA U OTRO COLOR)».
#'
#' «POR APLICAR» iba sin color, con el argumento de que es la mayoría y pintarla
#' toda sería ruido. Él lo pidió amarillo y tiene razón sobre este documento: lo
#' abre el coordinador para saber qué queda por hacer, y una celda sin pintar no
#' se distingue de una celda sin llenar. Amarillo claro para que el naranja de
#' la reagendación siga leyéndose distinto al lado.
#' @keywords internal
#' **«APLICADA POR REAGENDACIÓN» es un quinto estado y no un matiz** (Gonzalo,
#' 2026-09-08). Un aula que se aplicó después de moverla de día no es lo mismo
#' que una que salió a la primera: cuenta igual para la cuota, pero costó una
#' llamada más y un hueco en la agenda de alguien, y el operativo necesita poder
#' contarlas aparte para saber cuánto está costando reagendar. Va en verde
#' azulado: se lee como aplicada de un vistazo y se distingue al mirarla.
#' @keywords internal
.alpa_COLOR_ESTADO <- c(
  APLICADA = "#C8E6C9", `APLICADA POR REAGENDACIÓN` = "#B2DFDB",
  # Sin agendacion: verde de la familia de lo aplicado —porque lo esta— pero
  # con el tinte azulado que ya separa a su hermana por reagendacion. Las tres
  # se leen como «esto ya rindio» y siguen distinguiendose de un vistazo.
  `APLICADA SIN AGENDACIÓN` = "#D7E8F5",
  `POR APLICAR` = "#FFF4C2", REAGENDADA = "#FFCC80", RECHAZADA = "#FFCDD2",
  # **«POR APLICAR SIN AGENDACIÓN» es el séptimo** (Gonzalo, 2026-09-10, con su
  # desplegable delante: «deberían ser estas»). Es la hermana pendiente de
  # «APLICADA SIN AGENDACIÓN»: se va a ir al aula sin cita, a ver si dejan
  # entrar, y todavía no ha pasado. Sin ella, esa salida se anotaba como un
  # «POR APLICAR» normal y nadie distinguía una cita pactada de una apuesta.
  #
  # El color sigue la MISMA gramática que su hermana: el tono base dice en qué
  # fase está —amarillo lo pendiente, verde lo rendido— y el tinte azulado dice
  # «sin agendación». Así las dos parejas se leen por fase en vertical y por
  # procedencia en horizontal.
  `POR APLICAR SIN AGENDACIÓN` = "#E8EEF2"
)

#' La tinta de la raya que separa un día del siguiente.
#'
#' La misma del texto de la hoja: la raya organiza, no señala, y en negro puro
#' compite con los colores de estado que sí llevan información.
#' @keywords internal
.alpa_COLOR_SEPARADOR <- "#1F2937"

#' Una regla de color POR VALOR de la celda de aplicador.
#'
#' No un relleno fijo por fila: la columna lleva desplegable y quien la cambia
#' tiene que ver el color de la persona nueva al instante. Con relleno estático
#' el color se quedaba con el aplicador anterior, que es peor que no tener
#' color: dice quién va, y miente.
#' @keywords internal
.alpa_regla_color <- function(sheet_id, filas, nombre, fondo, tinta = "#1F2937") {
  .alpa_regla_color_col(sheet_id, filas, 1L, nombre, fondo, tinta)
}

#' La misma regla, sobre la columna que se le diga.
#' @keywords internal
.alpa_regla_color_col <- function(sheet_id, filas, col, valor, fondo, tinta = "#1F2937") {
  list(addConditionalFormatRule = list(
    rule = list(
      ranges = list(list(
        sheetId = sheet_id,
        startRowIndex = 1L, endRowIndex = as.integer(filas),
        startColumnIndex = as.integer(col - 1L), endColumnIndex = as.integer(col)
      )),
      booleanRule = list(
        condition = list(type = "TEXT_EQ",
                         values = list(list(userEnteredValue = valor))),
        format = list(
          backgroundColor = .monitoreo_sheets_rgb(fondo),
          textFormat = list(bold = TRUE, foregroundColor = .monitoreo_sheets_rgb(tinta))
        )
      )
    ),
    index = 0L
  ))
}

#' La línea que separa un día del siguiente, dibujada por la APP.
#'
#' **La dibujaba el equipo a mano y se desalineó en cuanto la app insertó una
#' fila.** El 2026-09-10 la sincronización metió CH 137 —sábado 12/09, 08:45, la
#' más temprana de su día— al principio del bloque del sábado, y la raya gruesa
#' se quedó en la fila de abajo: la cita nueva aparecía colgando del viernes.
#' Gonzalo: «pero ahora la línea negra del sábado quedó allí arriba de esa
#' aula».
#'
#' Una separación manual no puede sobrevivir a un motor que inserta filas, y el
#' equipo no tiene por qué recolocarla cada vez. Es estructura de la hoja, no
#' dato suyo: la pone quien mueve las filas.
#'
#' Se limpia el interior del rango ANTES de dibujar, o la raya vieja quedaria
#' además de la nueva. Sólo las horizontales interiores: los bordes exteriores
#' del bloque no son nuestros.
#'
#' @param sheet_id id de la pestaña.
#' @param rows las filas publicadas, la primera la cabecera.
#' @return lista de requests, vacía si no hay al menos dos días.
#' @keywords internal
.alpa_separadores_de_dia <- function(sheet_id, rows) {
  datos <- rows[-1L]
  if (length(datos) < 2L) return(list())
  # **Separa por DÍA, no por fecha.** La primera versión miraba la fecha y el
  # 2026-09-10 partió el jueves en tres: CH164 tiene la fecha tecleada «10/10»
  # en vez de «10/09» y quedó encajonada entre dos rayas, una al entrar y otra
  # al salir. Gonzalo lo fotografió.
  #
  # El día es lo que el lector agrupa —«lo mío del jueves»— y una errata de dedo
  # en una celda no puede partirle el bloque en dos. La pestaña es de UNA semana
  # («cada hoja va a ser por semana»), así que dentro de ella el nombre del día
  # identifica el bloque sin ambigüedad. La fecha mal escrita sigue viéndose en
  # su columna, que es donde se corrige.
  i_dia <- which(.alpa_CABECERA == "DÍA")[[1L]]
  n_col <- length(.alpa_CABECERA)
  dias <- vapply(datos, function(r) {
    v <- as.list(r)
    if (i_dia <= length(v)) .alpa_txt(v[[i_dia]]) else ""
  }, character(1))
  cortes <- which(dias[-1L] != dias[-length(dias)]) + 1L
  # Sin cortes se limpia IGUAL: si el reparto anterior dejó rayas y ahora todo
  # cae en un solo día, devolver `list()` las dejaría puestas para siempre.
  rango <- function(desde, hasta) list(
    sheetId = sheet_id, startRowIndex = as.integer(desde), endRowIndex = as.integer(hasta),
    startColumnIndex = 0L, endColumnIndex = as.integer(n_col))
  limpiar <- list(updateBorders = list(
    range = rango(1L, length(rows)),
    innerHorizontal = list(style = "NONE")))
  c(list(limpiar), lapply(cortes, function(j) list(updateBorders = list(
    # `j` cuenta filas de DATOS; +1 por la cabecera, y el índice del API es 0-based.
    range = rango(j, j + 1L),
    top = list(style = "SOLID_THICK", width = 2L,
               color = .monitoreo_sheets_rgb(.alpa_COLOR_SEPARADOR))))))
}

#' Formato de la hoja: cabecera, desplegable de aplicador y su color por valor.
#'
#' @param sheet_id id de la pestaña.
#' @param rows las filas publicadas (la primera es la cabecera).
#' @param roster todos los aplicadores que pueden asignarse —los de la
#'   disponibilidad, no sólo los que hoy tienen cita—: es lo que llena el
#'   desplegable y lo que decide los colores. Sin él se deducen de las filas.
#' @export
aulas_libro_plan_aplicadores_formato_requests <- function(sheet_id, rows, roster = NULL) {
  rows <- rows %||% list()
  if (!length(rows)) return(list())
  n_cols <- length(.alpa_CABECERA)
  requests <- list()
  poner <- function(req) requests[[length(requests) + 1L]] <<- req
  poner(.maaf_banda(sheet_id, 1L, n_cols, "#002457", "#FFFFFF", size = 11L))
  poner(.maaf_alto_fila(sheet_id, 1L, 30L))

  en_filas <- unique(vapply(rows[-1L], function(r) {
    .alpa_txt(unlist(r %||% list(), use.names = FALSE)[[1L]])
  }, character(1)))
  interno <- aulas_nombre_aplicador(MONITOREO_AULAS_INTERNO_PULSO)
  # **El desplegable ofrece a TODO el equipo, no sólo a quien hoy tiene cita.**
  # Reasignar es justamente mover a alguien que no estaba; una lista sacada de
  # las filas no dejaría elegirlo.
  nombres <- unique(c(
    vapply(roster %||% list(), function(x) aulas_nombre_aplicador(x), character(1)),
    en_filas
  ))
  nombres <- sort(nombres[nzchar(nombres)], method = "radix")
  color_de <- .alpa_colores_de(nombres)

  # El desplegable, sobre la columna del aplicador y desde la fila 2.
  poner(.mafs_validacion_request(
    sheet_id, 1L, 1L, length(rows),
    as.list(unique(c(names(color_de), interno)))
  ))
  # Y una regla por persona: el color sigue al VALOR de la celda, así que
  # cambiar el aplicador en el desplegable recolorea solo. Se emiten en orden
  # inverso porque cada `index = 0` empuja a las anteriores.
  for (quien in rev(names(color_de))) {
    poner(.alpa_regla_color(sheet_id, length(rows), quien, color_de[[quien]]))
  }
  # El comodín en gris cálido: se distingue de las veintidós personas sin
  # parecer una cabecera de sección.
  poner(.alpa_regla_color(sheet_id, length(rows), interno, .alpa_COLOR_INTERNO, "#4A453E"))

  # **El ESTADO también con desplegable**, y con su propio color por valor: es
  # una columna que el equipo teclea y una lista cerrada evita que «reagendado»,
  # «Reagendada» y «REAGENDADA» sean tres estados distintos para la app.
  col_estado <- which(.alpa_CABECERA == "ESTADO")[[1]]
  poner(.mafs_validacion_request(
    sheet_id, col_estado, 1L, length(rows),
    as.list(MONITOREO_AULAS_ESTADOS_DISTRIBUCION)
  ))
  # **Una regla por FORMA de escribirlo, no una por estado.** `TEXT_EQ` no
  # normaliza: con una sola regla, la celda que alguien tecleó sin tilde se
  # queda sin pintar — y es justo la tecleada a mano la que hay que ver. El
  # 2026-09-10 el documento traía «APLICADA SIN AGENDACION» contra la
  # «AGENDACIÓN» que la app declara.
  for (e in rev(names(.alpa_COLOR_ESTADO))) {
    for (forma in aulas_distribucion_formas_de_estado(e)) {
      poner(.alpa_regla_color_col(sheet_id, length(rows), col_estado, forma,
                                  .alpa_COLOR_ESTADO[[e]]))
    }
  }
  # La raya entre día y día, al final: se dibuja sobre el rango ya conocido y
  # limpia la del reparto anterior, que con filas insertadas queda corrida.
  for (req in .alpa_separadores_de_dia(sheet_id, rows)) poner(req)
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
                 list(desde = 10L, hasta = 11L, px = 230L),
                 # ESTADO a 240: en 120 px no cabía «APLICADA POR REAGENDACIÓN»
                 # —el rótulo más largo de los siete— y el chip salía cortado a
                 # media palabra. Gonzalo, 2026-09-10: «dale más ancho a la
                 # columna estado». Se le da el mismo que a APLICADOR, que es la
                 # otra columna que lleva un nombre entero.
                 list(desde = 11L, hasta = 12L, px = 240L))) {
    poner(.mafs_dim_request(sheet_id, a$desde, a$hasta, a$px))
  }
  requests
}

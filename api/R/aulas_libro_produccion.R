# La hoja «Producción de aplicadores» del libro y del Google Sheets.
#
# Dictado de Gonzalo (2026-09-12, textual): «más que asignación de aplicadores,
# que también está bien, necesitamos saber la producción de los aplicadores,
# quién está aplicando más, quién está aplicando menos, en qué rangos horarios
# están aplicando, quiénes están aplicando en horario regular, cuánto en horario
# especial de noche o horario especial de la mañana».
#
# Son dos hojas distintas y por eso ésta es nueva:
#
#   «Asignación de aplicadores»  → a quién le TOCA. Sale del reparto, y existe
#                                  antes de que nadie pise un aula.
#   «Producción de aplicadores»  → quién RINDIÓ. Sale de los partes de campo, y
#                                  sólo existe después.
#
# Mezclarlas sería el error clásico de este operativo: una palabra para dos
# cosas. La de asignación se lee para organizar el día; ésta, para decidir a
# quién se le carga más la semana entrante y a quién hay que acompañar.
#
# Es hoja de la APP —se reescribe entera en cada publicación— y CONDICIONAL:
# sin partes no se produce. Una hoja de producción vacía se leería como «nadie
# ha aplicado», que es distinto de «todavía no se ha cargado el campo».
#
# Mismo contrato de filas tipadas que sus dos hermanas: un solo constructor
# alimenta el `.xlsx` (estilos por tipo de fila) y Sheets (values planos).

# **Las tres franjas, y por qué esos cortes.**
#
# El dictado las nombra: «horario regular», «horario especial de noche» y
# «horario especial de la mañana». Los límites salen de la jornada del campus,
# no de un número redondo: antes de las 09:00 el aplicador entra cuando la
# universidad todavía no está en marcha, y desde las 18:00 se aplica de noche.
# Ambas son las que cuestan reclutar y las que hay que repartir con cuidado,
# que es justo para lo que se mira esta tabla.
.alp_FRANJAS <- list(
  list(clave = "manana", titulo = "Mañana temprano (antes de 09:00)", hasta = 9 * 60L),
  list(clave = "regular", titulo = "Regular (09:00 a 18:00)", hasta = 18 * 60L),
  list(clave = "noche", titulo = "Noche (desde 18:00)", hasta = 24 * 60L + 1L)
)

# **La clave de identidad de una persona, que NO es su nombre para mostrar.**
#
# `aulas_nombre_aplicador()` es presentación y lo dice en su propia cabecera:
# «sin coma se normaliza igual, en un solo bloque: no se reordena lo que no se
# sabe separar». Agrupar por esa salida parte a una persona en dos. Medido
# sobre el operativo el 2026-09-12: «Aquino Dulanto, Alejandro» tenía 2 aulas y
# «Aquino Dulanto Alejandro» otras 2; «Chavez Espinoza, Alondra» 5 y «Chavez
# Espinoza Alondra» 1. Cuatro personas donde hay dos, y la tabla que existe
# para decir quién aplica más las ponía a media carga cada una.
#
# La clave ignora lo que el tecleo cambia —coma, tildes, mayúsculas, espacios
# de más— y conserva el orden de las palabras, que es lo único que de verdad
# distingue a dos personas.
.alp_clave <- function(nombre) {
  k <- tolower(trimws(as.character(nombre %||% "")[1]))
  k <- iconv(k, to = "ASCII//TRANSLIT")
  if (is.na(k)) return("")
  k <- gsub("[^a-z ]", " ", k)
  trimws(gsub("[[:space:]]+", " ", k))
}

# Las celdas de una fila con su tipo: en las filas de DATO, lo que es un número
# viaja como número. Es la regla de la casa —la escribe «Avance de agendación»:
# «para que el Sheets pueda ordenarlas y sumarlas»— y la comparten las tres
# hojas de filas tipadas, que antes tenían tres copias de la misma conversión
# (o ninguna). Los títulos, bloques y notas son texto siempre.
#
# Se reusa `.cala_celda_num()` en vez de una conversión propia: redondea igual
# que el resto del libro, y dos formas de redondear es el defecto de fondo.
.alp_celdas <- function(tipo, celdas) {
  celdas <- as.list(celdas)
  # Las que NO son dato vuelven como VECTOR de caracteres, que es la forma que
  # tenían: convertirlas en lista cambiaba el tipo de las cabeceras y rompía a
  # quien las compara con un `c("TRAMO", ...)`. Sólo las de dato necesitan ser
  # lista, porque mezclan texto y número.
  if (!identical(tipo, "dato")) return(as.character(unlist(celdas)))
  lapply(celdas, function(v) {
    txt <- trimws(as.character(v %||% "")[1])
    x <- suppressWarnings(as.numeric(txt))
    if (nzchar(txt) && length(x) == 1L && is.finite(x)) .cala_celda_num(txt) else as.character(v)
  })
}

# El texto de una celda se lee con `.ald_txt()`, de la hoja de disponibilidad:
# es el MISMO cuerpo y la casa dice que los micro-helpers se comparten, no se
# redefinen por módulo. Redefinirlo aquí puso en rojo
# `test-helpers-sin-duplicar.R` el mismo día que nació esta hoja — el guard
# hizo su trabajo.

.alp_num <- function(x) {
  v <- suppressWarnings(as.numeric(.ald_txt(x)))
  if (length(v) != 1L || is.na(v)) NA_real_ else v
}

# En qué franja cae una hora en minutos. `NA` cuando no hay hora: una aplicación
# sin hora no se reparte entre franjas — inventaría un turno.
.alp_franja <- function(minutos) {
  if (is.na(minutos)) return(NA_character_)
  for (f in .alp_FRANJAS) if (minutos < f$hasta) return(f$clave)
  "noche"
}

# La hora a la que se aplicó, en minutos. Manda la del PARTE —es la que ocurrió—
# y la agendada es el respaldo: un aula aplicada sin hora en el parte sigue
# teniendo su franja pactada, y perderla dejaría la tabla contando de menos
# justo en las franjas raras.
.alp_minutos <- function(pt, agendada) {
  del_parte <- .monitoreo_aulas_parte_primero(pt, .MONITOREO_AULAS_PARTE_ALIAS[["hora"]])
  h <- monitoreo_aulas_hora_parse(.ald_txt(del_parte))[[1]]
  if (!is.na(h)) return(h)
  monitoreo_aulas_hora_parse(.ald_txt(agendada))[[1]]
}

#' Las filas de la hoja de producción, tipadas — el ÚNICO constructor.
#'
#' @param plan el plan COMPLETO de la sesión.
#' @param partes los partes de campo ya registrados.
#' @return `NULL` si ningún parte identifica a su aplicador; si no, lista de
#'   filas `{tipo, celdas}` con los tipos de sus hermanas.
#' @keywords internal
aulas_libro_filas_produccion <- function(plan = list(), partes = list()) {
  partes <- partes %||% list()
  unidades <- if (is.data.frame(plan)) split(plan, seq_len(nrow(plan))) else (plan %||% list())

  # Código → su fila del plan, para la hora pactada y la facultad.
  del_plan <- new.env(parent = emptyenv())
  for (u in unidades) {
    cod <- .ald_txt(u[["operational_code"]])
    if (nzchar(cod) && is.null(del_plan[[cod]])) del_plan[[cod]] <- u
  }

  # **Sólo cuenta lo aplicado, y lo decide la definición canónica.** Un parte
  # abierto —alguien tecleó el aula y nada más— no es producción; contarlo
  # inflaría a quien empieza muchas y cierra pocas, que es exactamente al revés
  # de lo que esta tabla existe para ver.
  aplicadas <- tryCatch(monitoreo_aulas_aula_aplicada(unidades, partes = partes),
                        error = function(e) logical(0))
  vale <- new.env(parent = emptyenv())
  if (length(aplicadas) == length(unidades)) {
    for (i in seq_along(unidades)) {
      cod <- .ald_txt(unidades[[i]][["operational_code"]])
      if (nzchar(cod)) assign(cod, isTRUE(aplicadas[[i]]), envir = vale)
    }
  }

  gente <- list()
  for (pt in partes) {
    if (!is.list(pt)) next
    cod <- .ald_txt(pt[["operational_code"]] %||% pt[["classroom_id"]])
    if (!nzchar(cod)) next
    if (!isTRUE(mget(cod, envir = vale, ifnotfound = list(FALSE))[[1]])) next
    crudo <- .ald_txt(
      .monitoreo_aulas_parte_primero(pt, .MONITOREO_AULAS_PARTE_ALIAS[["aplicador"]]))
    quien <- .alp_clave(crudo)
    if (!nzchar(quien)) next
    u <- del_plan[[cod]]
    fr <- .alp_franja(.alp_minutos(pt, if (is.null(u)) "" else u[["scheduled_time"]]))
    ef <- .alp_num(.monitoreo_aulas_parte_primero(pt, .MONITOREO_AULAS_PARTE_ALIAS[["efectivas"]]))
    as_ <- .alp_num(.monitoreo_aulas_parte_primero(pt, .MONITOREO_AULAS_PARTE_ALIAS[["asistentes"]]))
    g <- gente[[quien]] %||% list(aulas = 0L, efectivas = 0, asistentes = 0,
                                  manana = 0L, regular = 0L, noche = 0L,
                                  sin_hora = 0L, grafias = character(0))
    # Se guardan TODAS las grafías con que llegó: la que se muestra es la de la
    # casa —«Apellido, Nombre»— y las demás se declaran, porque son un error de
    # tecleo en el parte que alguien tiene que ir a arreglar.
    g$grafias <- unique(c(g$grafias, aulas_nombre_aplicador(crudo)))
    g$aulas <- g$aulas + 1L
    if (!is.na(ef)) g$efectivas <- g$efectivas + ef
    if (!is.na(as_)) g$asistentes <- g$asistentes + as_
    if (is.na(fr)) g$sin_hora <- g$sin_hora + 1L else g[[fr]] <- g[[fr]] + 1L
    gente[[quien]] <- g
  }
  if (!length(gente)) return(NULL)

  filas <- list()
  # **Las cifras viajan como NÚMEROS, no como texto.** Es la regla de la casa y
  # la escribe su hermana «Avance de agendación»: «para que el Sheets pueda
  # ordenarlas y sumarlas». Verificado en el documento publicado el 2026-09-12:
  # esta hoja las mandaba como texto («14» en vez de 14), así que en la hoja
  # que existe para contestar «quién aplica más» no se podía ordenar la columna
  # que lo dice. Se reusa `.cala_celda_num()`, que redondea igual que las demás,
  # en vez de una conversión propia — el defecto sería el mismo de siempre: dos
  # formas de hacer lo mismo.
  poner <- function(tipo, celdas) {
    filas[[length(filas) + 1L]] <<- list(tipo = tipo, celdas = .alp_celdas(tipo, celdas))
  }

  # El nombre que se muestra: la grafía con coma, que es el estándar de la casa
  # («apellido, coma, nombre»); si ninguna la trae, la primera que llegó.
  claves <- names(gente)
  rotulo <- vapply(claves, function(k) {
    g <- gente[[k]]$grafias
    con_coma <- g[grepl(",", g, fixed = TRUE)]
    if (length(con_coma)) con_coma[[1]] else g[[1]]
  }, character(1), USE.NAMES = FALSE)
  nombres <- rotulo
  aulas <- vapply(claves, function(k) gente[[k]]$aulas, integer(1), USE.NAMES = FALSE)
  # `gente` se reindexa por el rótulo para que el resto de la hoja —que lee por
  # nombre— no tenga que saber de claves.
  gente <- stats::setNames(lapply(claves, function(k) gente[[k]]), rotulo)
  # De MÁS a MENOS aulas, que es la pregunta literal: «quién está aplicando más,
  # quién está aplicando menos». El empate se rompe por alfabeto para que dos
  # publicaciones seguidas con los mismos datos den la misma hoja.
  orden <- order(-aulas, nombres)

  poner("titulo", "PRODUCCIÓN DE APLICADORES")
  total_aulas <- sum(aulas)
  total_ef <- sum(vapply(nombres, function(n) gente[[n]]$efectivas, numeric(1)))
  poner("nota", sprintf(
    paste("Lo que YA se aplicó, del parte de campo — no lo asignado, que vive en",
          "«Asignación de aplicadores» · %d aula%s aplicada%s por %d persona%s ·",
          "%s encuesta%s efectiva%s"),
    total_aulas, if (total_aulas == 1L) "" else "s", if (total_aulas == 1L) "" else "s",
    length(nombres), if (length(nombres) == 1L) "" else "s",
    format(total_ef, big.mark = " ", trim = TRUE),
    if (total_ef == 1) "" else "s", if (total_ef == 1) "" else "s"))
  poner("nota", "")

  poner("bloque", "QUIÉN HA APLICADO MÁS")
  poner("nota", paste(
    "«Por aula» es cuántas encuestas saca de media en cada aula que aplica:",
    "una carga alta con un promedio bajo es otra conversación que una carga",
    "baja con un promedio alto."))
  poner("cabecera", c("APLICADOR", "AULAS APLICADAS", "ENCUESTAS EFECTIVAS",
                      "POR AULA", "ASISTENTES VISTOS"))
  for (k in orden) {
    n <- nombres[[k]]; g <- gente[[n]]
    poner("dato", c(
      n, as.character(g$aulas),
      format(g$efectivas, big.mark = " ", trim = TRUE),
      if (g$aulas > 0L) formatC(g$efectivas / g$aulas, format = "f", digits = 1) else "",
      format(g$asistentes, big.mark = " ", trim = TRUE)
    ))
  }
  poner("nota", "")

  poner("bloque", "EN QUÉ FRANJA APLICA CADA UNO")
  poner("nota", paste(
    "La mañana temprano y la noche son las franjas que cuesta cubrir: esta",
    "tabla dice sobre quién están cayendo. Un aula sin hora en el parte usa la",
    "hora agendada; si no hay ninguna, cuenta aparte en vez de inventarle turno."))
  cab <- c("APLICADOR", vapply(.alp_FRANJAS, function(f) toupper(f$titulo), character(1)))
  hay_sin_hora <- any(vapply(nombres, function(n) gente[[n]]$sin_hora > 0L, logical(1)))
  if (hay_sin_hora) cab <- c(cab, "SIN HORA")
  poner("cabecera", cab)
  for (k in orden) {
    n <- nombres[[k]]; g <- gente[[n]]
    celdas <- c(n, as.character(c(g$manana, g$regular, g$noche)))
    if (hay_sin_hora) celdas <- c(celdas, as.character(g$sin_hora))
    poner("dato", celdas)
  }
  totales <- vapply(c("manana", "regular", "noche"),
                    function(f) sum(vapply(nombres, function(n) gente[[n]][[f]], integer(1))),
                    integer(1))
  celdas_tot <- c("TOTAL", as.character(totales))
  if (hay_sin_hora) {
    celdas_tot <- c(celdas_tot, as.character(
      sum(vapply(nombres, function(n) gente[[n]]$sin_hora, integer(1)))))
  }
  poner("dato", celdas_tot)
  # **Y si a alguien lo escribieron de dos maneras, se dice.** No es cosmética:
  # el parte es lo que alimenta esta tabla y la de avance, y un nombre tecleado
  # de dos formas parte a una persona en dos en cualquier cuenta que agrupe por
  # nombre. Aquí ya se juntan —la clave ignora coma y tildes— pero la celda del
  # libro sigue mal escrita y alguien tiene que arreglarla.
  con_varias <- Filter(function(n) length(gente[[n]]$grafias) > 1L, nombres)
  if (length(con_varias)) {
    poner("nota", sprintf(
      paste("%d aplicador%s el nombre escrito de más de una forma en el",
            "parte; aquí se cuentan como una sola persona, pero conviene",
            "uniformar la celda: %s."),
      length(con_varias), if (length(con_varias) == 1L) " llegó con" else "es llegaron con",
      paste(vapply(sort(con_varias), function(n) {
        sprintf("%s", paste(sprintf("«%s»", gente[[n]]$grafias), collapse = " = "))
      }, character(1)), collapse = "; ")))
  }

  # Quién sostiene las franjas raras: el nombre, no el número, porque lo que se
  # hace con esto es hablar con esa persona.
  for (f in c("manana", "noche")) {
    quienes <- nombres[vapply(nombres, function(n) gente[[n]][[f]] > 0L, logical(1))]
    titulo <- Filter(function(x) identical(x$clave, f), .alp_FRANJAS)[[1]]$titulo
    poner("nota", if (!length(quienes)) {
      sprintf("%s: nadie ha aplicado todavía en esa franja.", titulo)
    } else {
      sprintf("%s: %s.", titulo, paste(sort(quienes), collapse = ", "))
    })
  }
  filas
}

#' Los valores planos de la hoja de producción, para Sheets.
#'
#' @param plan el plan COMPLETO de la sesión.
#' @param partes los partes de campo.
#' @return `NULL` si no hay producción; si no, lista de listas de celdas.
#' @keywords internal
aulas_libro_valores_produccion <- function(plan = list(), partes = list()) {
  filas <- aulas_libro_filas_produccion(plan, partes)
  if (is.null(filas)) return(NULL)
  lapply(filas, function(f) as.list(f$celdas))
}

# Una fila de celdas como `data.frame` de una fila, conservando el tipo de cada
# una: `openxlsx` respeta los tipos de un data.frame y aplasta los de una
# matriz.
#
# Lo usan las TRES hojas de filas tipadas —producción, asignación y
# disponibilidad—: tenían el mismo `t(as.matrix(...))` copiado, que es la forma
# de que el arreglo de una no llegue a las otras.
.alp_fila_df <- function(celdas) {
  celdas <- as.list(celdas)
  if (!length(celdas)) return(data.frame(x = "", stringsAsFactors = FALSE))
  out <- stats::setNames(
    lapply(celdas, function(v) if (is.numeric(v)) v else as.character(v)),
    paste0("v", seq_along(celdas)))
  as.data.frame(out, stringsAsFactors = FALSE, check.names = FALSE)
}

#' Escribe la hoja «Producción de aplicadores» sobre el workbook del libro.
#'
#' @param wb workbook de openxlsx ya en construcción.
#' @param plan el plan COMPLETO de la sesión.
#' @param partes los partes de campo.
#' @return invisible `TRUE` si la escribió; `FALSE` si no había producción.
#' @keywords internal
aulas_libro_hoja_produccion <- function(wb, plan = list(), partes = list()) {
  filas <- aulas_libro_filas_produccion(plan, partes)
  if (is.null(filas)) return(invisible(FALSE))

  hoja <- "Producción de aplicadores"
  openxlsx::addWorksheet(wb, hoja)

  # Los MISMOS estilos por tipo de fila que sus dos hermanas: tres hojas que se
  # leen seguidas y con la misma retícula no pueden tener tres estéticas.
  estilos <- list(
    titulo = openxlsx::createStyle(fontSize = 14, textDecoration = "bold"),
    nota = openxlsx::createStyle(fontColour = "#6B6560", fontSize = 10),
    cabecera = openxlsx::createStyle(textDecoration = "bold", fgFill = "#F3EDEA",
                                     border = "bottom", borderColour = "#C9BEB8",
                                     fontSize = 10),
    bloque = openxlsx::createStyle(textDecoration = "bold", fontSize = 12)
  )
  for (i in seq_along(filas)) {
    f <- filas[[i]]
    # **`as.matrix` sobre una lista mixta lo convierte TODO a texto**, y ahí se
    # perdía en el `.xlsx` lo que ya se había arreglado en Sheets: las cifras
    # volvían a ser cadenas y la columna «AULAS APLICADAS» tampoco se podía
    # ordenar en el libro descargado. Un `data.frame` de una fila conserva el
    # tipo de cada celda. Es el mismo constructor para las dos salidas; lo que
    # divergía era el escritor.
    openxlsx::writeData(wb, hoja, .alp_fila_df(f$celdas), startRow = i, colNames = FALSE)
    est <- estilos[[f$tipo]]
    if (!is.null(est)) {
      openxlsx::addStyle(wb, hoja, est, rows = i,
                         cols = seq_along(f$celdas), gridExpand = TRUE)
    }
  }
  # La fila de TOTAL se separa de las personas: es otra cosa y leerla como una
  # más es lo que hace que alguien sume mal de un vistazo.
  total <- openxlsx::createStyle(textDecoration = "bold", border = "top",
                                 borderColour = "#C9BEB8")
  for (i in seq_along(filas)) {
    f <- filas[[i]]
    if (identical(f$tipo, "dato") && identical(f$celdas[[1]], "TOTAL")) {
      openxlsx::addStyle(wb, hoja, total, rows = i,
                         cols = seq_along(f$celdas), gridExpand = TRUE, stack = TRUE)
    }
  }
  anchos <- c(34L, rep(22L, max(0L, max(vapply(filas, function(f) length(f$celdas), integer(1))) - 1L)))
  openxlsx::setColWidths(wb, hoja, cols = seq_along(anchos), widths = anchos)
  openxlsx::freezePane(wb, hoja, firstActiveRow = 2L)
  invisible(TRUE)
}

# Los títulos de los bloques, declarados una vez: gobiernan el color de la
# banda en Sheets, y escritos a mano en dos sitios el renombrado de uno dejaría
# la tabla sin color sin que nada fallara (la lección de `.ALD_TITULO_*`).
.ALP_TITULO <- "PRODUCCIÓN DE APLICADORES"
.ALP_BLOQUES <- c("QUIÉN HA APLICADO MÁS", "EN QUÉ FRANJA APLICA CADA UNO")

#' Requests de formato de la hoja de producción en Sheets.
#'
#' La MISMA estética que sus dos hermanas —banda navy para el título y los
#' bloques, cabecera azul claro, notas en gris pequeño— reusando los mismos
#' constructores: tres hojas que se leen seguidas no pueden tener tres
#' gramáticas visuales.
#'
#' @param sheet_id id numérico de la pestaña.
#' @param rows los values ya producidos.
#' @return lista de requests para `batchUpdate`.
#' @keywords internal
aulas_libro_produccion_formato_requests <- function(sheet_id, rows) {
  rows <- rows %||% list()
  if (!length(rows)) return(list())
  n_cols <- max(1L, max(vapply(rows, function(row) length(row %||% list()), integer(1))))
  requests <- list()
  poner <- function(req) requests[[length(requests) + 1L]] <<- req
  for (i in seq_along(rows)) {
    celdas <- trimws(as.character(unlist(rows[[i]] %||% list(), use.names = FALSE)))
    primera <- if (length(celdas)) celdas[[1L]] else ""
    if (identical(primera, .ALP_TITULO)) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#002457", "#FFFFFF", size = 13L))
      poner(.maaf_alto_fila(sheet_id, i, 36L))
    } else if (primera %in% .ALP_BLOQUES) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#002457", "#FFFFFF", size = 11L))
      poner(.maaf_alto_fila(sheet_id, i, 28L))
    } else if (identical(primera, "APLICADOR") && length(celdas) > 1L) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#E7EEF9", "#1B4B8F", wrap = TRUE))
    } else if (identical(primera, "TOTAL")) {
      # El total no es una persona más: se separa o alguien suma mal de un
      # vistazo. Mismo gris de cierre que usan los totales del avance.
      poner(.maaf_banda(sheet_id, i, n_cols, "#F3EDEA", "#3A3532"))
    } else if (length(celdas) == 1L && nzchar(primera)) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#FFFFFF", "#6B6560",
                        size = 9L, italic = TRUE, bold = FALSE))
    }
  }
  requests
}

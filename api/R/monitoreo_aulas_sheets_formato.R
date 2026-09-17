# Formato y desplegables del libro de aulas publicado a Google Sheets — B8/W2.
#
# Dictado textual de Gonzalo tras ver la siembra real: «no hay nada del formato
# que el Excel tenía, los colores, se ve genuinamente fatal»; «el status de
# muestra está como sin contactar pero no hay ningún desplegable»; «la forma de
# contacto solo debería ser o por teléfono o por correo».
#
# La paleta NO se inventa aquí: es la del `.xlsx` (carga_aulas_libro_formato.R)
# — cabecera #002457 con texto blanco en negrita, bandas de eslabón de
# `aulas_libro_colores_eslabon()` y el semáforo de estados (#E3F3E8/#155E2E el
# verde de lo cerrado). Los vocabularios de los desplegables son los MISMOS de
# la hoja «Listas» del xlsx (`aulas_libro_status_muestra`,
# `AULAS_LIBRO_MEDIO_CONTACTO`, `AULAS_LIBRO_DIA`,
# `AULAS_LIBRO_STATUS_APLICACION`): una lista, no dos.
#
# Dos decisiones de forma que el motor genérico no toma
# (`.monitoreo_sheets_professional_format_requests`, monitoreo_engine.R:5685,
# que NO se usa aquí — congela 1 fila para todas las hojas y emite una request
# de ancho POR COLUMNA, 253 en la agenda real):
#
#   1. La cabecera entera —color de cada celda, banda de eslabón incluida— va
#      en UN `updateCells` con `fields = "userEnteredFormat(...)"`: no toca
#      values ni dataValidation y cuesta lo mismo con 3 bloques que con 12.
#   2. Los anchos van por RANGOS agrupados (≤4 por hoja), jamás uno por
#      columna: el presupuesto del libro completo queda muy por debajo de las
#      30 requests que pinea el contrato.
#
# Estas requests viajan en el batch-2 del motor de publicación (DESPUÉS de los
# values): el reset de una pestaña con dimensiones cambiadas
# (`.monitoreo_sheets_reset_tab_requests`) borra el rectángulo entero con
# `updateCells` — userEnteredFormat Y dataValidation incluidos — así que emitir
# validaciones antes de escribir sería regalarlas al borrado.

# --- geometría de las hojas de bloques ---------------------------------------

# Ancho de un bloque de la hoja de campo: ID MATCH + los 21 títulos de agenda
# que repite + los títulos propios del parte. Derivado de las specs, no un 35 a
# mano: si el bloque gana un campo, esto sigue midiendo bien.
.mafs_ancho_campo <- function() {
  1L + AULAS_AGENDADAS_ANCHO_BLOQUE + length(.calg_titulos_campo())
}

# El ancho del bloque de agendadas, con la columna condicional del cruce DAA
# cuando esta activo (B8h fase 2: «TRASLAPE DAA» cierra cada bloque). El flag
# viaja por parametro desde el publicador — nada de estado global.
.mafs_ancho_agenda <- function(con_daa = FALSE) {
  AULAS_AGENDADAS_ANCHO_BLOQUE + as.integer(isTRUE(con_daa))
}

# Cuántos bloques (eslabones o intentos) caben en el ancho publicado.
.mafs_bloques <- function(hoja, n_cols, con_daa = FALSE) {
  n_cols <- max(1L, .monitoreo_int(n_cols, 1L))
  if (identical(hoja, "Aulas Agendadas")) {
    return(max(1L, (n_cols - 1L) %/% .mafs_ancho_agenda(con_daa)))
  }
  if (identical(hoja, "Aulas Aplicadas (Campo)")) {
    return(max(1L, n_cols %/% .mafs_ancho_campo()))
  }
  1L
}

# Columna (1-based) de un campo del bloque de agenda en el bloque `b`. Por
# nombre de campo contra la spec, igual que las validaciones del xlsx. Con el
# cruce DAA activo, el paso entre bloques crece en 1: al paso viejo, todo
# bloque R1+ caeria una columna a la izquierda.
.mafs_col_agenda <- function(campo, b, con_daa = FALSE) {
  idx <- which(vapply(AULAS_AGENDADAS_BLOQUE, function(s) identical(s$campo, campo), logical(1)))
  1L + (b - 1L) * .mafs_ancho_agenda(con_daa) + idx[[1]]
}

# Columna (1-based) de un campo ESPEJADO de la agenda dentro del bloque `b` de
# «Aulas Aplicadas (Campo)». No es `.mafs_col_agenda()`: allá el paso entre
# bloques es el ancho de la agenda y aquí es el del campo, que además incluye
# los títulos del parte. Con el paso equivocado, el bloque R1 caería catorce
# columnas a la izquierda y la regla teñiría la columna de al lado.
.mafs_col_campo_agenda <- function(campo, b) {
  idx <- which(vapply(AULAS_AGENDADAS_BLOQUE, function(s) identical(s$campo, campo), logical(1)))
  (b - 1L) * .mafs_ancho_campo() + 1L + idx[[1]]
}

# El formato de número de una columna entera de datos.
#
# **Una fecha sin `numberFormat` es una bomba de relojería.** Sheets la enseña
# bien mientras nadie la reescriba: la primera vez que el valor vuelve a entrar
# como número —una reordenación, una migración— la celda pasa a enseñar el
# número de serie («46273») y no hay forma de saber, mirando la hoja, si se
# perdió el dato o sólo su cara. Pasó el 2026-09-08 en 243 celdas del libro del
# operativo. Declararlo cuesta una request por columna.
.mafs_formato_numero_request <- function(sheet_id, col, desde, hasta, nf) {
  list(repeatCell = list(
    range = list(
      sheetId = sheet_id,
      startRowIndex = as.integer(desde), endRowIndex = as.integer(hasta),
      startColumnIndex = as.integer(col - 1L), endColumnIndex = as.integer(col)
    ),
    cell = list(userEnteredFormat = list(numberFormat = nf)),
    fields = "userEnteredFormat.numberFormat"
  ))
}

.mafs_NF_FECHA <- list(type = "DATE", pattern = "dd/mm/yyyy")
.mafs_NF_PORCENTAJE <- list(type = "PERCENT", pattern = "0%")

# Los tonos de STATUS MUESTRA, en UN solo sitio.
#
# Se pintan en las dos hojas —donde se teclea y donde se espeja— y con dos
# listas separadas bastaba con tocar una para que el mismo estado saliera de dos
# colores en el mismo libro. El orden importa: `contains` sobre la celda, y el
# índice menor gana.
.mafs_REGLAS_STATUS_MUESTRA <- list(
  # **El morado va PRIMERO.** `contains` sobre la celda y gana el indice menor:
  # ninguna de las de abajo casa hoy con «REFUERZO POR CONTACTAR», pero si
  # manana alguien anade una regla con «CONTACT» se la comeria en silencio.
  #
  # Gonzalo, 2026-09-11: «que sea como de un morado especial». Es la cola del
  # agendador —lo que la app acaba de poner por delante— y no se parece a
  # ninguno de los otros cinco: no es una gestion en curso ni una reserva
  # dormida, es una llamada que hay que hacer hoy.
  list(texto = "REFUERZO POR CONTACTAR", fondo = "#F0E9F7", tinta = "#5B2E86"),
  list(texto = "AGENDADA", fondo = "#E3F3E8", tinta = "#155E2E"),
  list(texto = "EN CONTACTO", fondo = "#FDF3D8", tinta = "#7A5B12"),
  list(texto = "RECHAZO", fondo = "#FDE7E7", tinta = "#8A1C1C"),
  list(texto = "EN RESERVA", fondo = "#E7EEF9", tinta = "#1B4B8F"),
  list(texto = "REEMPLAZADA", fondo = "#EEF0F3", tinta = "#5B6472")
)

# **Las otras cuatro paletas NO se escriben aquí: se traducen de la del xlsx.**
#
# `STATUS MUESTRA` tiene su catálogo propio arriba y se queda —lleva el morado
# de «REFUERZO POR CONTACTAR», que el xlsx no tiene—, pero «MEDIO DE CONTACTO»,
# «DÍA», «STATUS DE LLAMADA» y «RECIBIÓ CORREO» son idénticas en las dos capas,
# y escribir sus hex una tercera vez es cómo se llega a que discrepen.
#
# **Y discrepaban.** Medido contra el Sheets publicado de CCSS el 2026-09-17:
# el `.xlsx` llevaba las cinco columnas con color y el documento vivo llevaba
# **sólo `STATUS MUESTRA`** —12 reglas, todas de esa columna—. El agendador
# trabaja en el Sheets, no en el xlsx, así que el color estaba donde nadie lo
# mira. Dos capas, dos lecturas de la misma regla.
#
# `aulas_libro_paletas_de_estado()` guarda estilos de openxlsx; de ahí salen el
# fondo (`fill$fillBg$rgb`) y la tinta (`fontColour$rgb`) en ARGB, y Sheets
# quiere `#RRGGBB`.
.mafs_hex <- function(argb, por_defecto) {
  v <- as.character(unlist(argb %||% "")[1] %||% "")
  if (!nzchar(v) || is.na(v)) return(por_defecto)
  v <- sub("^#", "", v)
  if (nchar(v) == 8L) v <- substring(v, 3L)   # ARGB -> RGB
  if (nchar(v) != 6L) return(por_defecto)
  paste0("#", toupper(v))
}

.mafs_reglas_de_paleta <- function(nombre) {
  pal <- tryCatch(aulas_libro_paletas_de_estado()[[nombre]], error = function(e) NULL)
  lapply(pal %||% list(), function(r) list(
    texto = as.character(r$texto),
    fondo = .mafs_hex(r$estilo$fill$fillBg$rgb, "#EEF0F3"),
    tinta = .mafs_hex(r$estilo$fontColour$rgb, "#5B6472")
  ))
}

# Qué columna del bloque de agenda lleva cada paleta. Por CAMPO, como todo lo
# demás: si el bloque gana una columna, esto no se descoloca.
.MAFS_PALETAS_POR_CAMPO <- list(
  contact_medium = "medio",
  scheduled_day  = "dia",
  call_status    = "llamada",
  email_received = "correo"
)

# Columna (1-based) de un título del parte de campo en el intento `b`.
.mafs_col_campo <- function(titulo, b) {
  (b - 1L) * .mafs_ancho_campo() + 1L + AULAS_AGENDADAS_ANCHO_BLOQUE +
    which(.calg_titulos_campo() == titulo)[[1]]
}

# --- colores de la fila de banda ---------------------------------------------

# El color hex de CADA columna de la fila de banda (la primera). Es la misma
# escala del xlsx: titular navy, reemplazos aclarándose por eslabón
# (`aulas_libro_colores_eslabon`), y en la «Base de control» los cuatro tramos
# temáticos con su propia escala. Lo que no cae en ningún bloque queda navy.
.mafs_colores_banda <- function(hoja, n_cols, con_daa = FALSE) {
  navy <- "#002457"
  colores <- rep(navy, n_cols)
  if (identical(hoja, "Aulas Agendadas")) {
    ancho <- .mafs_ancho_agenda(con_daa)
    bloques <- .mafs_bloques(hoja, n_cols, con_daa)
    tonos <- aulas_libro_colores_eslabon(bloques)
    for (b in seq_len(bloques)) {
      desde <- 1L + (b - 1L) * ancho + 1L
      hasta <- min(n_cols, 1L + b * ancho)
      if (desde <= hasta) colores[desde:hasta] <- tonos[[min(b, length(tonos))]]
    }
  } else if (identical(hoja, "Aulas Aplicadas (Campo)")) {
    bloques <- .mafs_bloques(hoja, n_cols)
    tonos <- aulas_libro_colores_eslabon(bloques)
    ancho <- .mafs_ancho_campo()
    for (b in seq_len(bloques)) {
      desde <- (b - 1L) * ancho + 1L
      hasta <- min(n_cols, b * ancho)
      if (desde <= hasta) colores[desde:hasta] <- tonos[[min(b, length(tonos))]]
    }
  } else if (identical(hoja, "Base de control")) {
    # La escala PROPIA de los tramos, la misma que el xlsx: salía de la paleta
    # de los eslabones de la cadena, que es de otra cosa. Ver
    # `AULAS_LIBRO_TRAMOS_BASE_CONTROL`.
    grupos <- aulas_libro_grupos_control()
    escala <- AULAS_LIBRO_TRAMOS_BASE_CONTROL[
      ((seq_along(grupos) - 1L) %% length(AULAS_LIBRO_TRAMOS_BASE_CONTROL)) + 1L]
    for (k in seq_along(grupos)) {
      desde <- max(1L, .monitoreo_int(grupos[[k]]$desde, 1L))
      hasta <- min(n_cols, .monitoreo_int(grupos[[k]]$hasta, 0L))
      if (desde <= hasta) colores[desde:hasta] <- escala[[min(k, length(escala))]]
    }
  }
  colores
}

# --- constructores de requests ------------------------------------------------

.mafs_celda_cabecera <- function(hex) {
  list(userEnteredFormat = list(
    backgroundColor = .monitoreo_sheets_rgb(hex),
    textFormat = list(bold = TRUE, foregroundColor = .monitoreo_sheets_rgb("#FFFFFF")),
    wrapStrategy = "WRAP",
    verticalAlignment = "MIDDLE"
  ))
}

.mafs_dim_request <- function(sheet_id, desde, hasta, pixeles) {
  list(updateDimensionProperties = list(
    range = list(
      sheetId = sheet_id, dimension = "COLUMNS",
      startIndex = as.integer(desde), endIndex = as.integer(hasta)
    ),
    properties = list(pixelSize = as.integer(pixeles)),
    fields = "pixelSize"
  ))
}

# Una regla condicional «contiene texto» sobre varias columnas NO contiguas:
# UNA request con un rango por columna (los eslabones están a 21 columnas de
# distancia y no pueden pedirse como rectángulo). `indice` es el orden de
# precedencia: el reset del motor ya borró las reglas previas de la pestaña,
# así que la numeración local es exacta.
.mafs_regla_contiene <- function(sheet_id, cols, desde, hasta, texto, fondo, tinta, indice) {
  list(addConditionalFormatRule = list(
    rule = list(
      ranges = lapply(cols, function(col) list(
        sheetId = sheet_id,
        startRowIndex = as.integer(desde), endRowIndex = as.integer(hasta),
        startColumnIndex = as.integer(col - 1L), endColumnIndex = as.integer(col)
      )),
      booleanRule = list(
        condition = list(
          type = "TEXT_CONTAINS",
          values = list(list(userEnteredValue = texto))
        ),
        format = list(
          backgroundColor = .monitoreo_sheets_rgb(fondo),
          textFormat = list(foregroundColor = .monitoreo_sheets_rgb(tinta), bold = TRUE)
        )
      )
    ),
    index = as.integer(indice)
  ))
}

# --- A. formato por hoja ------------------------------------------------------

#' Requests de formato de UNA hoja del libro de aulas en Sheets.
#'
#' Freeze de la(s) fila(s) de cabecera (el reparto de `.malp_cabeceras`: 1 en
#' «Aulas Agendadas» y «Plan del día», 2 en las demás), cabecera con la paleta
#' del xlsx (navy #002457 + blanco en negrita, bandas de eslabón), semáforo de
#' estados con los colores del xlsx y anchos de columna por rangos agrupados.
#'
#' @param hoja nombre de la hoja del libro.
#' @param sheet_id sheetId remoto de la pestaña.
#' @param n_filas filas publicadas (cabeceras incluidas).
#' @param n_cols columnas publicadas.
#' @param con_daa `TRUE` cuando la agenda se publicó con la columna
#'   condicional «TRASLAPE DAA» (B8h fase 2): el bloque mide una columna más
#'   y toda la geometría de esta capa se corre con él.
#' @return lista de requests de batchUpdate, todas sobre `sheet_id`.
#' @keywords internal
monitoreo_aulas_sheets_formato_requests <- function(hoja, sheet_id, n_filas, n_cols,
                                                    con_daa = FALSE) {
  hoja <- .monitoreo_scalar(hoja, "")
  n_filas <- max(0L, .monitoreo_int(n_filas, 0L))
  n_cols <- max(1L, .monitoreo_int(n_cols, 1L))
  cabeceras <- min(.malp_cabeceras(hoja), max(1L, n_filas))
  requests <- list()

  # Freeze: las filas de cabecera y la primera columna (en una hoja de 253
  # columnas, perder de vista el ID es perder la fila — mismo panel que el
  # xlsx). Congelarlo TODO lo rechaza Google («no se pueden inmovilizar todas
  # las filas visibles»), de ahí las guardas.
  #
  # **«Avance de campo» NO congela columna.** No es una tabla: es una pila de
  # tablas distintas con sus notas, y su columna A rotula unas veces la meta,
  # otras la facultad y otras el aplicador — congelarla enseña el rótulo
  # equivocado al desplazarse. Y además lo impide: sus notas se combinan de la
  # columna A hasta el final, y Google rechaza el batch entero con «no se pueden
  # combinar columnas inmovilizadas con columnas no inmovilizadas» (visto al
  # publicar el 2026-09-08, cuando la Base de control pasó de 43 a 55 columnas y
  # el formato volvió a enviarse).
  congela_columna <- !identical(hoja, .malp_hoja_avance())
  requests[[length(requests) + 1L]] <- list(updateSheetProperties = list(
    properties = list(
      sheetId = sheet_id,
      gridProperties = list(
        frozenRowCount = if (n_filas > cabeceras) as.integer(cabeceras) else 0L,
        frozenColumnCount = if (congela_columna && n_cols > 1L) 1L else 0L
      )
    ),
    fields = "gridProperties(frozenRowCount,frozenColumnCount)"
  ))

  # La cabecera entera en UN updateCells de solo-formato: fila de banda con el
  # color de su eslabón/tramo y fila de títulos navy. `fields` acotado a
  # userEnteredFormat — no toca values ni dataValidation.
  if (n_filas >= 1L) {
    banda <- .mafs_colores_banda(hoja, n_cols, con_daa)
    filas_formato <- lapply(seq_len(cabeceras), function(fila) {
      colores <- if (fila == 1L) banda else rep("#002457", n_cols)
      list(values = lapply(colores, .mafs_celda_cabecera))
    })
    requests[[length(requests) + 1L]] <- list(updateCells = list(
      range = list(
        sheetId = sheet_id,
        startRowIndex = 0L, endRowIndex = as.integer(cabeceras),
        startColumnIndex = 0L, endColumnIndex = as.integer(n_cols)
      ),
      rows = filas_formato,
      fields = "userEnteredFormat(backgroundColor,textFormat,wrapStrategy,verticalAlignment)"
    ))
  }

  # Semáforo de estados, con los MISMOS tonos del xlsx
  # (carga_aulas_libro_formato.R:384-389): verde lo cerrado, azul lo que
  # espera en cadena, gris lo que ya no se toca, ámbar lo que espera acción.
  # `contains` igual que allá: «REAGENDADA» cae en el verde de «AGENDADA» y un
  # estado nuevo simplemente no se tiñe.
  if (n_filas > cabeceras) {
    bloques <- .mafs_bloques(hoja, n_cols, con_daa)
    if (identical(hoja, "Aulas Agendadas")) {
      cols_status <- vapply(seq_len(bloques), function(b) .mafs_col_agenda("sample_status", b, con_daa), integer(1))
      cols_status <- cols_status[cols_status <= n_cols]
      if (length(cols_status)) {
        # B13b: «EN CONTACTO» y «RECHAZO» con los MISMOS tonos que su regla
        # del xlsx (carga_aulas_libro_formato.R, semaforo): ambar claro la
        # gestion en curso, el rojo suave del descuadre lo terminal. «EN
        # RESERVA» y «REEMPLAZADA» se quedan aunque el desplegable ya no las
        # ofrezca: los libros vivos v3 las traen escritas y la regla es
        # `contains` sobre la celda, no sobre la lista de hoy.
        reglas <- .mafs_REGLAS_STATUS_MUESTRA
        for (i in seq_along(reglas)) {
          requests[[length(requests) + 1L]] <- .mafs_regla_contiene(
            sheet_id, cols_status, cabeceras, n_filas,
            reglas[[i]]$texto, reglas[[i]]$fondo, reglas[[i]]$tinta, i - 1L
          )
        }
      }
      # Las otras cuatro columnas tecleables, cada una con SU paleta. Son las
      # que el agendador recorre en vertical durante la jornada de llamadas, y
      # hasta el 17/09 el Sheets las publicaba en blanco.
      for (campo in names(.MAFS_PALETAS_POR_CAMPO)) {
        reglas_c <- .mafs_reglas_de_paleta(.MAFS_PALETAS_POR_CAMPO[[campo]])
        if (!length(reglas_c)) next
        cols_c <- vapply(seq_len(bloques), function(b) .mafs_col_agenda(campo, b, con_daa), integer(1))
        cols_c <- cols_c[cols_c <= n_cols]
        if (!length(cols_c)) next
        for (i in seq_along(reglas_c)) {
          requests[[length(requests) + 1L]] <- .mafs_regla_contiene(
            sheet_id, cols_c, cabeceras, n_filas,
            reglas_c[[i]]$texto, reglas_c[[i]]$fondo, reglas_c[[i]]$tinta, i - 1L
          )
        }
      }
      # Las dos fechas de cada bloque, con su formato declarado.
      for (campo in c("contact_date", "scheduled_date")) {
        for (b in seq_len(bloques)) {
          col <- .mafs_col_agenda(campo, b, con_daa)
          if (col > n_cols) next
          requests[[length(requests) + 1L]] <- .mafs_formato_numero_request(
            sheet_id, col, cabeceras, n_filas, .mafs_NF_FECHA)
        }
      }
    } else if (identical(hoja, "Aulas Aplicadas (Campo)")) {
      cols_status <- vapply(seq_len(bloques), function(b) .mafs_col_campo("STATUS DE APLICACIÓN", b), integer(1))
      cols_status <- cols_status[cols_status <= n_cols]
      if (length(cols_status)) {
        # **El orden ES la regla**: gana el índice menor y la comparación es
        # «contiene», así que lo específico va PRIMERO. «NO APLICADA» contiene
        # «APLICADA» y al revés toda la columna saldría verde; lo mismo pasa
        # ahora con «APLICADA DE REFUERZO».
        #
        # Las cuatro de abajo faltaban: el vocabulario creció a seis valores el
        # 2026-09-04 (REEMPLAZADA POR, COMPLEMENTADA CON, APLICADA DE REFUERZO)
        # y este pintor se quedó con dos reglas, así que en el Sheets vivo del
        # operativo «REEMPLAZADA POR» salía SIN COLOR. Lo vio Gonzalo el
        # 2026-09-10. El xlsx sí la tenía —su semáforo lleva «REEMPLAZADA»—:
        # dos motores para la misma columna y sólo uno se actualizó.
        #
        # Los tonos son los del xlsx donde existen, para que la misma celda no
        # cambie de color según por dónde salga.
        # **UN COLOR POR CADA ESTADO, sin huecos** (Gonzalo, 2026-09-10: «esta
        # columna debería tener un color por cada estado»). «POR APLICAR» no
        # tenía regla y salía en blanco al lado de las verdes: en una columna que
        # se abre para saber qué queda por hacer, una celda sin pintar no se
        # distingue de una celda sin llenar. Es el mismo argumento con el que él
        # pidió el amarillo en la hoja de los aplicadores, y aquí lleva el mismo
        # amarillo: la misma palabra, el mismo color, mire donde mire.
        reglas <- list(
          list(texto = "NO APLICADA", fondo = "#FBEDE3", tinta = "#8A4B1B"),
          list(texto = "APLICADA DE REFUERZO", fondo = "#E7EEF9", tinta = "#1B4B8F"),
          # Antes de «APLICADA» a secas, que la contiene.
          list(texto = "APLICADA POR REAGENDACIÓN", fondo = "#B2DFDB", tinta = "#0F5F57"),
          list(texto = "REEMPLAZADA POR", fondo = "#EEF0F3", tinta = "#5B6472"),
          # Complementada NO es reemplazo: el titular no sale y los dos cuentan.
          # Por eso no comparte el gris de lo sustituido: lleva el violeta suave
          # que en esta hoja no usa ningún otro estado.
          list(texto = "COMPLEMENTADA CON", fondo = "#EFE7F7", tinta = "#5B3A8A"),
          list(texto = "POR APLICAR", fondo = "#FFF4C2", tinta = "#7A5B00"),
          list(texto = "APLICADA", fondo = "#E3F3E8", tinta = "#155E2E")
        )
        for (i in seq_along(reglas)) {
          requests[[length(requests) + 1L]] <- .mafs_regla_contiene(
            sheet_id, cols_status, cabeceras, n_filas,
            reglas[[i]]$texto, reglas[[i]]$fondo, reglas[[i]]$tinta, i - 1L
          )
        }
      }
      # **Lo que esta hoja ESPEJA de la agenda venía sin color** (Gonzalo,
      # 2026-09-08): «toda la información que Aulas Aplicadas jala de Aulas
      # Agendadas la jala sin formato de color, aunque sea para poder
      # distinguir bien». Y es cierto que se distinguía mal: en Agendadas el
      # estado se lee de un vistazo por el color, y al lado, en la hoja donde
      # de verdad se trabaja, la misma palabra salía en negro sobre blanco.
      #
      # `TO_TEXT` copia el valor, no el formato: el color no viaja con la
      # fórmula y hay que ponerlo aquí. Se pone con LAS MISMAS reglas, que por
      # eso viven en una constante y no en dos listas.
      # El porcentaje de asistencia es una PROPORCIÓN, y sin su formato sale
      # «0,7333333333» en una hoja que la gente lee de un vistazo.
      for (b in seq_len(bloques)) {
        col <- .mafs_col_campo("% ASISTENCIA", b)
        if (col > n_cols) next
        requests[[length(requests) + 1L]] <- .mafs_formato_numero_request(
          sheet_id, col, cabeceras, n_filas, .mafs_NF_PORCENTAJE)
      }
      cols_espejo <- vapply(seq_len(bloques),
                            function(b) .mafs_col_campo_agenda("sample_status", b),
                            integer(1))
      cols_espejo <- cols_espejo[cols_espejo <= n_cols]
      if (length(cols_espejo)) {
        for (i in seq_along(.mafs_REGLAS_STATUS_MUESTRA)) {
          r <- .mafs_REGLAS_STATUS_MUESTRA[[i]]
          requests[[length(requests) + 1L]] <- .mafs_regla_contiene(
            sheet_id, cols_espejo, cabeceras, n_filas, r$texto, r$fondo, r$tinta, i - 1L
          )
        }
      }
    }
  }

  # Anchos por RANGOS agrupados, jamás uno por columna. La columna sin ancho
  # queda en el defecto de 100px, así que entre todos cubren el rectángulo
  # entero. El detalle por contenido del xlsx no se replica: a 253 columnas la
  # cuota de batchUpdate manda, y tres anchos —identificador, titular, resto—
  # ya distinguen lo que se trabaja de lo que se consulta.
  if (identical(hoja, "Aulas Agendadas")) {
    requests[[length(requests) + 1L]] <- .mafs_dim_request(sheet_id, 0L, 1L, 64L)
    corte_titular <- min(n_cols, 1L + .mafs_ancho_agenda(con_daa))
    if (corte_titular > 1L) {
      requests[[length(requests) + 1L]] <- .mafs_dim_request(sheet_id, 1L, corte_titular, 160L)
    }
    if (n_cols > corte_titular) {
      requests[[length(requests) + 1L]] <- .mafs_dim_request(sheet_id, corte_titular, n_cols, 132L)
    }
  } else if (identical(hoja, "Base de control")) {
    requests[[length(requests) + 1L]] <- .mafs_dim_request(sheet_id, 0L, 1L, 72L)
    if (n_cols > 1L) {
      requests[[length(requests) + 1L]] <- .mafs_dim_request(sheet_id, 1L, n_cols, 132L)
    }
  } else {
    px <- if (identical(hoja, "Aulas Aplicadas (Campo)")) 140L else 150L
    requests[[length(requests) + 1L]] <- .mafs_dim_request(sheet_id, 0L, n_cols, px)
  }

  requests
}

# --- B. validaciones (desplegables) -------------------------------------------

.mafs_validacion_request <- function(sheet_id, col, desde, hasta, valores) {
  list(setDataValidation = list(
    range = list(
      sheetId = sheet_id,
      startRowIndex = as.integer(desde), endRowIndex = as.integer(hasta),
      startColumnIndex = as.integer(col - 1L), endColumnIndex = as.integer(col)
    ),
    rule = list(
      condition = list(
        type = "ONE_OF_LIST",
        values = lapply(valores, function(v) list(userEnteredValue = v))
      ),
      # El chip visible es la queja literal del dictado: sin showCustomUi no
      # hay desplegable que ver. `strict = FALSE` es el allowBlank +
      # showErrorMsg = FALSE del xlsx: los libros existentes traen valores
      # viejos («Llamada») y la validación no debe pelearse con ellos.
      showCustomUi = TRUE,
      strict = FALSE
    )
  ))
}

# El date picker de una columna de fecha (B12). En Sheets el calendario
# aparece cuando la celda lleva dataValidation `DATE_IS_VALID` — pedido
# literal de Gonzalo (2026-09-01): «apenas aprieto la celda me sale el
# calendario, ¿es posible?». Sin `values` (la condición no lleva lista) y
# `strict = FALSE` como las ONE_OF_LIST de esta capa: los libros existentes
# traen fechas tecleadas de todas las formas y la validación no debe pelearse
# con ellas. `showCustomUi = TRUE` por coherencia con el resto de la capa: es
# el «customized UI based on the kind of condition» de la API, que para una
# fecha es justamente el picker.
.mafs_fecha_request <- function(sheet_id, col, desde, hasta) {
  list(setDataValidation = list(
    range = list(
      sheetId = sheet_id,
      startRowIndex = as.integer(desde), endRowIndex = as.integer(hasta),
      startColumnIndex = as.integer(col - 1L), endColumnIndex = as.integer(col)
    ),
    rule = list(
      condition = list(type = "DATE_IS_VALID"),
      # **Sin chip de calendario.** `showCustomUi = TRUE` dibuja el mismo
      # triangulito que un desplegable, así que FECHA AGENDADA se veía como una
      # lista cerrada que no es: Gonzalo, 2026-09-15, «sale así, e incluso como
      # si fecha y hora fueran un desplegable». Las columnas con lista de
      # verdad —STATUS MUESTRA, DÍA, MOMENTO— sí lo llevan, y confundirlas con
      # una fecha de texto libre invita a buscar opciones que no existen.
      showCustomUi = FALSE,
      strict = FALSE
    )
  ))
}

#' Requests setDataValidation de UNA hoja del equipo del libro de aulas.
#'
#' Los vocabularios son los MISMOS de la hoja «Listas» del xlsx: STATUS
#' MUESTRA a la profundidad real de las cadenas, MEDIO DE CONTACTO
#' (`AULAS_LIBRO_MEDIO_CONTACTO`), DÍA (`AULAS_LIBRO_DIA`) y —en la hoja de
#' campo— STATUS DE APLICACIÓN. UNA columna por request: la lección del xlsx,
#' donde un sqref rectangular dejaba el desplegable de STATUS MUESTRA sobre el
#' nombre del docente. Las hojas de la app no llevan desplegables: nadie
#' escribe en ellas.
#'
#' Las columnas de FECHA llevan `DATE_IS_VALID` (date picker, B12): en la
#' agenda `contact_date` (FECHA DE LLAMADA) y `scheduled_date` (FECHA
#' AGENDADA) por eslabón; en la hoja de campo SOLO la fecha que el parte
#' teclea (FECHA DE APLICACIÓN por intento) — las columnas de agenda que esa
#' hoja repite son fórmulas de arrastre desde B9 y validarlas marcaría lo que
#' computa el arrastre.
#'
#' @param hoja nombre de la hoja del libro.
#' @param sheet_id sheetId remoto de la pestaña.
#' @param n_filas filas publicadas (cabeceras incluidas).
#' @param profundidad bloques de la hoja: eslabones de cadena en la agenda,
#'   intentos en la hoja de campo.
#' @param con_daa `TRUE` cuando la agenda lleva la columna condicional
#'   «TRASLAPE DAA» (B8h fase 2): los desplegables y calendarios de bloques
#'   R1+ se emiten a las columnas corridas.
#' @return lista de requests setDataValidation (vacía para hojas sin
#'   desplegables o sin filas de datos).
#' @keywords internal
monitoreo_aulas_sheets_validaciones_requests <- function(hoja, sheet_id, n_filas, profundidad,
                                                         con_daa = FALSE) {
  hoja <- .monitoreo_scalar(hoja, "")
  n_filas <- max(0L, .monitoreo_int(n_filas, 0L))
  profundidad <- max(1L, .monitoreo_int(profundidad, 1L))
  cabeceras <- .malp_cabeceras(hoja)
  if (n_filas <= cabeceras) return(list())

  requests <- list()
  if (identical(hoja, "Aulas Agendadas")) {
    specs <- list(
      list(campo = "sample_status", valores = aulas_libro_status_muestra(profundidad)),
      list(campo = "contact_medium", valores = AULAS_LIBRO_MEDIO_CONTACTO),
      list(campo = "scheduled_day", valores = AULAS_LIBRO_DIA),
      # B15: MOMENTO DE LA CLASE, desplegable NO absoluto — la misma lista de
      # la hoja «Listas» del xlsx, y el strict = FALSE del constructor deja
      # pasar el texto libre («a las 9:30, tras el control de lectura»).
      list(campo = "scheduled_moment", valores = AULAS_LIBRO_MOMENTO_CLASE),
      # B22: {Sí, No} de RECIBIÓ CORREO, uniforme en todos los bloques (el
      # titular hereda; su celda va vacia y strict = FALSE no obliga a nada).
      list(campo = "email_received", valores = AULAS_LIBRO_RECIBIO_CORREO),
      # B23: STATUS DE LLAMADA — «todos los CH», los siete del dictado.
      list(campo = "call_status", valores = AULAS_LIBRO_STATUS_LLAMADA)
    )
    for (spec in specs) {
      for (b in seq_len(profundidad)) {
        requests[[length(requests) + 1L]] <- .mafs_validacion_request(
          sheet_id, .mafs_col_agenda(spec$campo, b, con_daa), cabeceras, n_filas, spec$valores
        )
      }
    }
    # B12: el calendario en las dos fechas del bloque de agenda, una request
    # por columna-eslabón, igual que las ONE_OF_LIST de arriba.
    for (campo in c("contact_date", "scheduled_date")) {
      for (b in seq_len(profundidad)) {
        requests[[length(requests) + 1L]] <- .mafs_fecha_request(
          sheet_id, .mafs_col_agenda(campo, b, con_daa), cabeceras, n_filas
        )
      }
    }
  } else if (identical(hoja, "Aulas Aplicadas (Campo)")) {
    for (b in seq_len(profundidad)) {
      # El vocabulario depende del ESLABÓN: el bloque 1 es el titular y puede
      # haber sido reemplazado o complementado; del 2 al 12 son reservas, y a
      # una reserva no se le ofrece marcar que reemplazó a alguien desde su
      # propia fila. Ver `aulas_libro_status_aplicacion_de()`.
      requests[[length(requests) + 1L]] <- .mafs_validacion_request(
        sheet_id, .mafs_col_campo("STATUS DE APLICACIÓN", b), cabeceras, n_filas,
        aulas_libro_status_aplicacion_de(b)
      )
      # B12: SOLO la fecha que el parte TECLEA. Las columnas de agenda que
      # esta hoja repite (ID MATCH + bloque) son fórmulas de arrastre (B9):
      # una validación ahí marcaría lo que computa el arrastre y le diría al
      # equipo que teclee donde no debe.
      requests[[length(requests) + 1L]] <- .mafs_fecha_request(
        sheet_id, .mafs_col_campo("FECHA DE APLICACIÓN", b), cabeceras, n_filas
      )
    }
  }
  requests
}

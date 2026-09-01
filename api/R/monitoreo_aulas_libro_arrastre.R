# El arrastre por fórmula de la hoja de campo — unidad B9 (el M4 de 2025).
#
# El defecto del operativo (2026-08-31, libro EN USO): la siembra copiaba los
# datos de agenda de «Aulas Aplicadas (Campo)» como VALORES, así que un cambio
# en «Aulas Agendadas» (medio de contacto, status) jamás llegaba a la hoja de
# campo: las dos hojas quedaban congeladas cada una por su lado. En 2025 el
# libro arrastraba con fórmulas intra-Sheets y las hojas se hablaban solas.
#
# Mecanismo (decidido aquí, pineado conductualmente en
# test-monitoreo-aulas-libro-arrastre.R):
#   - La hoja de campo viaja ENTERA con valores en el único values:batchUpdate
#     RAW del motor, como siempre (test-monitoreo-aulas-publicar-libro.R pinea
#     «UN solo values:batchUpdate» en la siembra, y el hash del tab_state se
#     calcula sobre ese rectángulo).
#   - Después, SOLO en la siembra, esta capa sobreescribe los rangos de agenda
#     con fórmulas vía `values.update` (PUT) y `valueInputOption=USER_ENTERED`:
#     un PUT por bloque, porque ID MATCH + las 20 de agenda son las columnas
#     1..21 CONTIGUAS de cada bloque. Las 14 columnas de CAMPO (22..35) no se
#     tocan: siguen siendo los valores RAW tecleables del equipo. No se puede
#     meter la fórmula al batch RAW (quedaría como texto sin computar) ni subir
#     el batch entero a USER_ENTERED (Sheets parsearía «0205» a 205 y las
#     fechas por locale — la decisión round-trip de la cabecera del publicador).
#
# Geometría (verificada corriendo los generadores, pineada en el test):
#   - «Aulas Agendadas»: 1 fila de cabecera; datos desde la fila 2. Columna 1 =
#     ID MATCH; bloque b (titular, R1, R2…) = columnas 1+(b-1)*20+1 .. +20.
#   - Hoja de campo: 2 filas de cabecera; datos desde la fila 3. Bloque b de 35
#     columnas: ID MATCH en (b-1)*35+1, agenda en +2..+21, campo en +22..+35.
#   - Ancla POR FILA: la fila de un titular en la hoja de campo arrastra la
#     fila de SU cadena en agendadas (campo fila 3 ← agendadas fila 2), y el
#     bloque b arrastra el bloque b de agendadas de ESA MISMA fila: el bloque
#     «REEMPLAZO 1» enseña la agenda de la reserva 1 de la cadena, que es lo
#     que se aplica cuando el titular cae.
#
# La fila destino NO es fila_campo - 1 a ciegas: se resuelve por la CADENA del
# aula (`titular_operational_code`, la misma regla `.calg_titular` que agrupa
# agendadas). En el caso normal —una fila de campo por titular, mismo orden—
# coincide exactamente con N-1; cuando una reserva activada gana fila propia en
# la hoja de campo (26 de 196 partes en 2025), su fila arrastra la fila de su
# cadena en vez de descolocar por uno todas las siguientes.
#
# Los bloques se recortan a la PROFUNDIDAD de agendadas: la hoja de campo trae
# 3 bloques fijos (intentos) pero agendadas solo tiene columnas para su cadena
# más larga, y una referencia fuera del grid remoto pinta #REF! en todo el
# bloque. Un bloque sin contraparte se queda como hoy (valores/vacío).

# --- geometría compartida -----------------------------------------------------

# Entero -> letras A1 (1 = A, 27 = AA). openxlsx ya es dependencia declarada y
# `int2col` es lo que usa la capa hermana del xlsx (carga_aulas_libro_formato.R).
.malar_col_a1 <- function(col) openxlsx::int2col(as.integer(col))

# B8h fase 2: con el cruce DAA, «Aulas Agendadas» ensancha CADA bloque en 1
# («TRASLAPE DAA» lo cierra), asi que el PASO entre bloques del ORIGEN es
# condicional. El flag viaja por parametro en la cadena de llamadas — nada de
# estado global. La hoja de campo (el DESTINO) no gana la columna: sus usos
# con el default (`.malar_ancho_bloque`, `ancho_arrastre`, la mascara) siguen
# midiendo los 20 de siempre.
.malar_ancho_agenda <- function(con_daa = FALSE) {
  length(.calg_titulos_agenda()) + as.integer(isTRUE(con_daa))
}

.malar_ancho_bloque <- function() {
  1L + .malar_ancho_agenda() + length(.calg_titulos_campo())
}

# Cuántos bloques de la hoja de campo tienen contraparte en agendadas: los que
# el rectángulo de campo trae, recortados a la profundidad de la cadena (los
# mismos `.calg_*` con los que ambos generadores reparten columnas).
.malar_bloques_arrastre <- function(values, unidades) {
  if (length(values) < 2L) return(0L)
  n_bloques_campo <- length(values[[2L]] %||% list()) %/% .malar_ancho_bloque()
  min(n_bloques_campo, .calg_profundidad(unidades))
}

# La fila de «Aulas Agendadas» de cada código operativo. Reproduce el agrupado
# del generador de agendadas (una fila por cadena, en orden de aparición del
# plan, clave `.calg_titular`).
.malar_filas_agendadas <- function(unidades) {
  if (!length(unidades)) return(list())
  claves <- vapply(unidades, .calg_titular, character(1))
  orden <- unique(claves)
  out <- list()
  for (u in unidades) {
    cod <- .calg_txt(u$operational_code)
    if (!nzchar(cod)) next
    fila <- match(.calg_titular(u), orden)
    if (is.na(fila)) next
    # +1 por la fila de cabecera de agendadas (datos desde la fila 2).
    out[[cod]] <- fila + 1L
  }
  out
}

# La fórmula de una celda arrastrada. El `&""` es deliberado, dos razones:
#   1. Una referencia pelada a una celda VACÍA pinta 0 en Sheets; con `&""`
#      pinta "" — y las colas de bloque de las cadenas cortas son media hoja.
#   2. Sin funciones no hay separadores de argumento, así que la fórmula es
#      inmune al locale del documento (USER_ENTERED parsea «como si el usuario
#      tipeara», y coma / punto y coma dependen del locale del spreadsheet).
# El costo (todo se computa como texto) es cero aquí: la siembra RAW ya escribe
# el libro entero como texto y el lector normaliza desde texto.
.malar_formula <- function(hoja_agendadas, col, fila) {
  # TO_TEXT y no `&""`: la concatenacion convertia el VALOR crudo — la fecha
  # tecleada 01/09/2026 llegaba como «46266» y la hora 3:25 como «0,1423…»
  # (medido en vivo el 2026-09-01). TO_TEXT devuelve lo que la celda MUESTRA,
  # con un solo argumento (sin separadores dependientes del locale) y con
  # vacio → vacio, que era lo unico que el `&""` compraba.
  sprintf(
    "=TO_TEXT(%s!%s%d)",
    .monitoreo_sheets_quote_sheet(hoja_agendadas), .malar_col_a1(col), as.integer(fila)
  )
}

# Las 21 celdas de arrastre de un bloque (ID MATCH + agenda) para una fila de
# agendadas dada: ID MATCH ← columna 1 de la fila de la cadena; agenda j ←
# bloque b de agendadas, misma fila.
#
# `con_daa` corrige SOLO el paso del origen: se siguen arrastrando los 20
# campos de agenda (la hoja de campo no lleva «TRASLAPE DAA»), pero el bloque
# b de agendadas vive +(b-1) columnas mas alla cuando el cruce esta activo —
# con el paso viejo, la formula del bloque R1 arrastraria el ENLACE DE LA
# FICHA del titular disfrazado de curso.
.malar_celdas_bloque <- function(hoja_agendadas, bloque, fila_ag, con_daa = FALSE) {
  n_agenda <- .malar_ancho_agenda()
  paso <- .malar_ancho_agenda(con_daa)
  c(
    list(.malar_formula(hoja_agendadas, 1L, fila_ag)),
    lapply(seq_len(n_agenda), function(j) {
      .malar_formula(hoja_agendadas, 1L + (bloque - 1L) * paso + j, fila_ag)
    })
  )
}

# --- las escrituras de fórmulas (solo siembra) --------------------------------

#' Sobreescribe la agenda de la hoja de campo con fórmulas de arrastre.
#'
#' Emite un `values.update` (PUT, USER_ENTERED) por bloque arrastrable sobre el
#' rango contiguo ID MATCH + 20 de agenda (columnas 1..21 del bloque), filas de
#' datos completas. Una fila cuyo código no ancla en agendadas conserva sus
#' valores copiados: mejor una copia congelada que una fórmula a la fila
#' equivocada.
#'
#' Se llama SOLO tras sembrar la hoja (la regla de dueño hace el resto: una
#' hoja con contenido ni siquiera entra al motor).
#'
#' @param spreadsheet_id id pelado del documento.
#' @param hoja_campo título de la hoja de campo en el libro.
#' @param values el rectángulo de values YA sembrado (con valores).
#' @param unidades filas del plan con las que se produjeron las dos hojas.
#' @param hoja_agendadas título de la hoja de agendamiento.
#' @param con_daa `TRUE` cuando la hoja de agendadas se publicó CON la columna
#'   condicional «TRASLAPE DAA» (B8h fase 2): el paso entre bloques del origen
#'   crece en 1 y las fórmulas se emiten a las columnas corridas.
#' @return invisible: cuántos rangos de fórmulas se escribieron.
#' @keywords internal
monitoreo_aulas_libro_arrastre_publicar <- function(spreadsheet_id,
                                                    hoja_campo,
                                                    values,
                                                    unidades,
                                                    hoja_agendadas = "Aulas Agendadas",
                                                    con_daa = FALSE) {
  values <- values %||% list()
  bloques <- .malar_bloques_arrastre(values, unidades)
  n_datos <- length(values) - 2L
  if (bloques < 1L || n_datos < 1L) return(invisible(0L))

  filas_ag <- .malar_filas_agendadas(unidades)
  ancho_bloque <- .malar_ancho_bloque()
  ancho_arrastre <- 1L + .malar_ancho_agenda()

  for (b in seq_len(bloques)) {
    col0 <- (b - 1L) * ancho_bloque + 1L
    payload <- lapply(seq_len(n_datos), function(i) {
      fila <- as.list(values[[i + 2L]] %||% list())
      cod <- if (length(fila) >= 2L) .calg_txt(fila[[2L]]) else ""
      fila_ag <- if (nzchar(cod)) filas_ag[[cod]] else NULL
      if (is.null(fila_ag)) {
        # Sin ancla: se reescribe lo mismo que ya sembró el batch RAW.
        celdas <- fila[seq.int(col0, min(length(fila), col0 + ancho_arrastre - 1L))]
        length(celdas) <- ancho_arrastre
        lapply(celdas, function(c) if (is.null(c)) "" else c)
      } else {
        .malar_celdas_bloque(hoja_agendadas, b, fila_ag, con_daa = con_daa)
      }
    })
    rango <- sprintf(
      "%s!%s3:%s%d",
      .monitoreo_sheets_quote_sheet(hoja_campo),
      .malar_col_a1(col0), .malar_col_a1(col0 + ancho_arrastre - 1L), n_datos + 2L
    )
    .monitoreo_google_api(
      paste0(
        .monitoreo_sheets_api_base(spreadsheet_id),
        "/values/", utils::URLencode(rango, reserved = TRUE),
        "?valueInputOption=USER_ENTERED"
      ),
      method = "PUT",
      body = list(range = rango, majorDimension = "ROWS", values = payload)
    )
  }
  invisible(bloques)
}

# --- la máscara para comparar contra el remoto --------------------------------

# Blanquea las celdas de arrastre (ID MATCH + agenda de cada bloque
# arrastrable, filas de datos) para poder comparar lo producido con lo remoto.
# Esas celdas son DERIVADAS: en el remoto real la API devuelve su resultado
# COMPUTADO (que ya no coincide celda a celda con la copia de valores — el
# bloque REEMPLAZO 1 computa la agenda de la reserva donde la copia traía
# vacío), y su fuente («Aulas Agendadas») ya se compara directo. Compararlas
# además aquí declararía «cambió» en cada republicación y forzaría la
# reasserción de las hojas de la app en cada ciclo sin cambios.
#
# La máscara es GEOMÉTRICA (no mira el contenido): se aplica igual al lado
# local y al remoto, así que da lo mismo si el remoto trae fórmulas crudas (un
# mock), valores computados (la API real) o la copia vieja de valores.
.malar_mascara_arrastre <- function(values, bloques) {
  values <- values %||% list()
  if (bloques < 1L || length(values) < 3L) return(values)
  ancho_bloque <- .malar_ancho_bloque()
  ancho_arrastre <- 1L + .malar_ancho_agenda()
  for (i in seq.int(3L, length(values))) {
    fila <- as.list(values[[i]] %||% list())
    for (b in seq_len(bloques)) {
      col0 <- (b - 1L) * ancho_bloque + 1L
      for (col in seq.int(col0, min(length(fila), col0 + ancho_arrastre - 1L))) {
        fila[[col]] <- ""
      }
    }
    values[[i]] <- fila
  }
  values
}

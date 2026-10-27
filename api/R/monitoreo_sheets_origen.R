# =============================================================================
# monitoreo_sheets_origen.R — Origen de un barrido de un solo bloque
# =============================================================================
#
# El ACNUR RMS 2026 alternó dos formas de la hoja de barrido:
#   - lado a lado: un bloque de muestra y otro de backup en la misma fila
#     (`monitoreo_sheets_bloques.R` los apila y fabrica `Origen`);
#   - un solo bloque: muestra y backup comparten columnas y una columna dice,
#     fila a fila, de qué lista es cada caso. El 2026-10-27 esa columna se
#     titula literalmente «Muestra» y sus valores son «Muestra» o «Backup»;
#     antes se llamó «Origen».
# La fuente declara la dimensión `origen = "Origen"`. Con la columna titulada
# «Muestra», `dim_origen` no se derivaba (la dimensión se ignora en silencio si
# su columna no existe) y los 400 backups quedaban indistinguibles de la
# muestra en todo lo que lee el origen.
#
# Qué hace: si la hoja no trae `Origen`, busca la columna de origen POR
# CABECERA Y POR VALORES —no por posición— y añade `Origen` a su lado:
#   - cabecera: sugiere origen («Muestra», «Origen», «Backup», «Reserva»…) o,
#     sin pista en el nombre, la columna trae las dos listas;
#   - valores: casi todos los no vacíos son del vocabulario titular/reserva.
# La columna original se conserva (linaje). Ninguna fila se descarta: el valor
# vacío queda vacío y el no reconocido se copia tal cual, así el bloque
# «Origen de la muestra» los cuenta a la vista («Sin dato», o su propio
# rótulo). El atributo `monitoreo_origen` resume columna, conteos, vacíos y
# no reconocidos.
#
# Quién lo llama: `monitoreo_sheets_bloques_dataframe()` cuando la hoja es de
# un bloque. Gate: test-monitoreo-sheets-origen.R.
# =============================================================================

.MONITOREO_SHEETS_ORIGEN_TITULAR <- c("muestra", "titular", "titulares", "principal", "original")
.MONITOREO_SHEETS_ORIGEN_RESERVA <- c("backup", "backups", "reserva", "reservas", "reemplazo",
                                      "suplente", "suplentes", "sustituto", "sustituta")
.MONITOREO_SHEETS_ORIGEN_PISTA <- "origen|muestra|backup|back up|reserva|titular|suplente|sustitu"
# Con pista en la cabecera se tolera algún valor tecleado mal (se reporta).
.MONITOREO_SHEETS_ORIGEN_MIN_RECONOCIDOS <- 0.9

.monitoreo_sheets_origen_clave <- function(x) {
  gsub("[^a-z]", "", .monitoreo_text_key(trimws(as.character(x))))
}

# Rol de cada valor: "titular", "reserva", "" (vacío) o NA (no reconocido).
.monitoreo_sheets_origen_roles <- function(valores) {
  clave <- .monitoreo_sheets_origen_clave(valores)
  rol <- rep(NA_character_, length(clave))
  rol[!nzchar(clave)] <- ""
  rol[clave %in% .MONITOREO_SHEETS_ORIGEN_TITULAR] <- "titular"
  rol[clave %in% .MONITOREO_SHEETS_ORIGEN_RESERVA] <- "reserva"
  rol
}

#' Elige la columna de origen de una hoja de un bloque.
#'
#' @return nombre de la columna o "" si ninguna califica.
#' @noRd
.monitoreo_sheets_origen_columna <- function(df) {
  for (nm in names(df)) {
    if (!nzchar(nm) || startsWith(nm, ".")) next
    roles <- .monitoreo_sheets_origen_roles(df[[nm]])
    llenos <- roles[is.na(roles) | nzchar(roles)]
    if (!length(llenos)) next
    reconocidos <- llenos[!is.na(llenos)]
    if (!length(reconocidos)) next
    fraccion <- length(reconocidos) / length(llenos)
    pista <- grepl(.MONITOREO_SHEETS_ORIGEN_PISTA, .monitoreo_text_key(nm), perl = TRUE)
    if (pista && fraccion >= .MONITOREO_SHEETS_ORIGEN_MIN_RECONOCIDOS) return(nm)
    if (!pista && fraccion == 1 && all(c("titular", "reserva") %in% reconocidos)) return(nm)
  }
  ""
}

#' Añade `Origen` a una hoja de un bloque que lo trae con otro nombre.
#'
#' Sin columna de origen reconocible, o si la hoja ya trae `Origen`, devuelve
#' `df` intacto.
#' @noRd
.monitoreo_sheets_origen_un_bloque <- function(df) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(df)
  destino <- .MONITOREO_BLOQUES_COL_ORIGEN
  if (.monitoreo_text_key(destino) %in% .monitoreo_text_key(names(df))) return(df)
  columna <- .monitoreo_sheets_origen_columna(df)
  if (!nzchar(columna)) return(df)

  crudos <- trimws(as.character(df[[columna]]))
  crudos[is.na(crudos)] <- ""
  roles <- .monitoreo_sheets_origen_roles(crudos)
  # Una grafía por valor: «BACKUP» y «Backup» son la misma lista; gana la
  # grafía más frecuente en la hoja.
  clave <- .monitoreo_sheets_origen_clave(crudos)
  valores <- crudos
  for (k in unique(clave[!is.na(roles) & nzchar(roles)])) {
    en <- clave == k
    tabla <- sort(table(crudos[en]), decreasing = TRUE)
    valores[en] <- names(tabla)[[1]]
  }

  pos <- match(columna, names(df))
  out <- df
  out[[destino]] <- valores
  orden <- append(names(df), destino, after = pos)
  out <- out[, orden, drop = FALSE]
  no_reconocidos <- crudos[is.na(roles)]
  attr(out, "monitoreo_origen") <- list(
    columna = columna,
    derivada = destino,
    casos = as.list(table(valores[!is.na(roles) & nzchar(roles)])),
    titular = sum(roles == "titular", na.rm = TRUE),
    reserva = sum(roles == "reserva", na.rm = TRUE),
    sin_origen = sum(roles == "", na.rm = TRUE),
    no_reconocidos = length(no_reconocidos),
    valores_no_reconocidos = as.list(unique(no_reconocidos))
  )
  out
}

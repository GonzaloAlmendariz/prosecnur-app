# =============================================================================
# monitoreo_telefonico_origen.R — Origen de la muestra y marca de reemplazo
# =============================================================================
#
# Revamp de Monitoreo › Telefónico. Un barrido puede traer dos listas en la
# misma hoja —la muestra titular y su reserva (backup)— y una marca que dice si
# un caso de la reserva entró a reemplazar a un titular. Ninguna llave del
# motor las nombraba: cada estudio escribe su columna con su vocabulario
# («Origen: Muestra/Backup», «¿Se reemplaza con el Backup?: Sí/No»).
#
# Perfil (`monitoreo_profile`), declarado por el equipo en Insumos:
#   - `sample_origin`: {column, titular_values[], reserva_values[]}
#   - `replacement_flag`: {column, yes_values[]}
# Sin declarar, las claves no aparecen en el perfil normalizado.
#
# Bloque `origen_de_la_muestra` (solo lectura), una fila por columna y valor:
#   Columna · Valor · Rol · Casos
# Rol:
#   - columna de origen declarada: `titular`, `reserva` o `sin_rol`;
#   - marca de reemplazo declarada: `reemplazo` o `no_reemplazo`;
#   - columna candidata sin declarar (por su nombre): `sin_declarar`.
# El valor vacío se publica como «Sin dato» con su rol (`sin_rol` o
# `no_reemplazo`), para que los conteos sumen el total de la hoja.
#
# Quién lo lee: Insumos (la declaración) y, por contrato, Modelo › Reserva y
# Avance › Reemplazos de la sesión ACNUR RMS, que deben leer estas mismas
# claves y no una columna propia.
# =============================================================================

.MONITOREO_ORIGEN_PATRON <- "origen|backup|reserva|titular|reemplaz|suplente|sustitu"
.MONITOREO_ORIGEN_MAX_VALORES <- 12L
.MONITOREO_ORIGEN_SIN_DATO <- "Sin dato"

.monitoreo_origen_bloque <- function(raw, campos) {
  if (!is.list(raw)) return(NULL)
  columna <- trimws(.monitoreo_scalar(raw[["column"]] %||% raw[["columna"]], ""))
  if (!nzchar(columna)) return(NULL)
  out <- list(column = columna)
  for (campo in campos) {
    valores <- unique(trimws(.monitoreo_chr_vec(raw[[campo]])))
    out[[campo]] <- as.list(valores[nzchar(valores)])
  }
  out
}

# Se llama desde `monitoreo_normalize_profile` (monitoreo_engine.R): sin esto,
# la lista cerrada del normalizador se tragaría las dos claves al guardar.
.monitoreo_profile_origen <- function(out, profile) {
  origen <- .monitoreo_origen_bloque(profile[["sample_origin"]], c("titular_values", "reserva_values"))
  marca <- .monitoreo_origen_bloque(profile[["replacement_flag"]], "yes_values")
  if (!is.null(origen)) out[["sample_origin"]] <- origen
  if (!is.null(marca)) out[["replacement_flag"]] <- marca
  out
}

.monitoreo_origen_valores <- function(x) {
  valores <- trimws(as.character(x))
  valores[is.na(valores) | !nzchar(valores)] <- .MONITOREO_ORIGEN_SIN_DATO
  valores
}

.monitoreo_origen_conteo <- function(phone, columna, rol_de) {
  valores <- .monitoreo_origen_valores(phone[[columna]])
  tabla <- table(valores)
  data.frame(
    Columna = rep(columna, length(tabla)),
    Valor = names(tabla),
    Rol = vapply(names(tabla), rol_de, character(1), USE.NAMES = FALSE),
    Casos = as.integer(tabla),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.monitoreo_origen_casa <- function(valor, declarados) {
  .monitoreo_text_key(valor) %in% .monitoreo_text_key(.monitoreo_chr_vec(declarados))
}

#' Filas del bloque `origen_de_la_muestra`.
#' @noRd
.monitoreo_telefonico_origen_df <- function(phone, profile = list()) {
  vacio <- data.frame(Columna = character(0), Valor = character(0), Rol = character(0), Casos = integer(0),
                      stringsAsFactors = FALSE, check.names = FALSE)
  if (is.null(phone) || !is.data.frame(phone) || !nrow(phone)) return(vacio)
  origen <- profile[["sample_origin"]]
  marca <- profile[["replacement_flag"]]
  partes <- list()
  usadas <- character(0)

  col_origen <- if (is.list(origen)) .monitoreo_report_col(phone, origen[["column"]]) else ""
  if (nzchar(col_origen)) {
    partes[[length(partes) + 1L]] <- .monitoreo_origen_conteo(phone, col_origen, function(valor) {
      if (.monitoreo_origen_casa(valor, origen[["titular_values"]])) return("titular")
      if (.monitoreo_origen_casa(valor, origen[["reserva_values"]])) return("reserva")
      "sin_rol"
    })
    usadas <- c(usadas, col_origen)
  }

  col_marca <- if (is.list(marca)) .monitoreo_report_col(phone, marca[["column"]]) else ""
  if (nzchar(col_marca) && !col_marca %in% usadas) {
    partes[[length(partes) + 1L]] <- .monitoreo_origen_conteo(phone, col_marca, function(valor) {
      if (.monitoreo_origen_casa(valor, marca[["yes_values"]])) "reemplazo" else "no_reemplazo"
    })
    usadas <- c(usadas, col_marca)
  }

  # Candidatas por nombre, para que el equipo declare con los conteos a la
  # vista. Fuera las columnas internas (`.source_*`) y las dimensiones que el
  # motor deriva (`dim_*`), que repiten una columna de la hoja.
  nombres <- names(phone)
  candidatas <- nombres[
    grepl(.MONITOREO_ORIGEN_PATRON, .monitoreo_text_key(nombres), perl = TRUE) &
      !startsWith(nombres, ".") & !startsWith(nombres, "dim_") & !nombres %in% usadas
  ]
  for (columna in candidatas) {
    valores <- .monitoreo_origen_valores(phone[[columna]])
    if (length(unique(valores)) > .MONITOREO_ORIGEN_MAX_VALORES) next
    partes[[length(partes) + 1L]] <- .monitoreo_origen_conteo(phone, columna, function(valor) "sin_declarar")
  }

  if (!length(partes)) return(vacio)
  out <- do.call(rbind, partes)
  rownames(out) <- NULL
  out
}

#' Bloque `origen_de_la_muestra` del monitoreo telefónico.
#' @noRd
.monitoreo_telefonico_origen_blocks <- function(phone, profile = list()) {
  filas <- .monitoreo_telefonico_origen_df(phone, profile)
  declarado <- is.list(profile[["sample_origin"]]) || is.list(profile[["replacement_flag"]])
  nota <- if (declarado) {
    "Casos de la hoja de barrido por valor de la columna de origen y de la marca de reemplazo declaradas."
  } else {
    "Sin columnas declaradas: se muestran las columnas cuyo nombre sugiere origen o reemplazo."
  }
  list(.monitoreo_report_block("origen_de_la_muestra", "Origen de la muestra", filas, nota))
}

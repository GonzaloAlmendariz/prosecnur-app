# =============================================================================
# Limpieza: número de fila en el archivo recibido
# =============================================================================
# La auditoría lee la base con el criterio de caso válido (los casos fuera del
# universo no generan hallazgos) y la limpieza la relee sin él (esos casos
# siguen en la base limpia). Cuando los casos se identifican por número de
# fila, la fila N de una lectura no era la fila N de la otra y una exclusión
# caía en otra persona (E1 de la revisión metodológica de M2).
#
# Por eso la lectura numera cada fila de la tabla principal ANTES de cualquier
# filtro (filas parciales, caso válido) en una columna interna, y todo id por
# número de fila (`<tabla>::row::N`) usa ese número: el de la fila en el
# archivo recibido. La auditoría, la cola, el detalle de una regla, el caso
# completo y la aplicación cruzan por él.
#
# Compatibilidad. Una decisión guardada antes contaba las filas de la tabla
# auditada (ya filtrada). Su `::row::N` solo se puede leer con seguridad si la
# auditoría no filtró ninguna fila antes de la N; si filtró, la decisión no se
# aplica a nadie y lo dice (`numeracion_anterior`), nunca se lleva a otra fila.

.LIMPIEZA_COL_FILA_ORIGEN <- ".__fila_origen__"

# Valor de `identificacion_casos$numeracion` en una decisión cuyos ids por
# número de fila cuentan filas del archivo recibido.
.LIMPIEZA_NUMERACION_ORIGEN <- "fila_de_origen"

# Numera las filas de la tabla tal como se recibió. Se llama antes de filtrar.
.validacion_marcar_fila_origen <- function(df) {
  if (!is.data.frame(df) || !nrow(df)) return(df)
  df[[.LIMPIEZA_COL_FILA_ORIGEN]] <- seq_len(nrow(df))
  df
}

.limpieza_tiene_fila_origen <- function(df) {
  is.data.frame(df) && .LIMPIEZA_COL_FILA_ORIGEN %in% names(df)
}

# Número de cada fila en el archivo recibido; una tabla sin la columna (una
# auditoría anterior, una tabla hija, una tabla armada a mano) se numera por su
# posición, como antes.
.limpieza_filas_origen <- function(df) {
  n <- if (is.data.frame(df)) nrow(df) else 0L
  if (!n) return(integer(0))
  if (.limpieza_tiene_fila_origen(df)) {
    v <- suppressWarnings(as.integer(df[[.LIMPIEZA_COL_FILA_ORIGEN]]))
    if (length(v) == n && !anyNA(v)) return(v)
  }
  seq_len(n)
}

.limpieza_sin_columnas_internas <- function(df) {
  if (!.limpieza_tiene_fila_origen(df)) return(df)
  df[, setdiff(names(df), .LIMPIEZA_COL_FILA_ORIGEN), drop = FALSE]
}

.limpieza_ids_por_numero_de_fila <- function(ids, table_key = "principal") {
  ids <- as.character(ids)
  prefijo <- paste0(table_key, "::row::")
  !is.na(ids) & startsWith(ids, prefijo) &
    grepl("^[0-9]+$", substring(ids, nchar(prefijo) + 1L))
}

# ¿La numeración de la tabla principal auditada coincide con la del archivo
# recibido? Es la condición para leer un `::row::N` contado sobre la tabla
# auditada (decisiones de antes, auditorías de antes) como la fila N recibida.
#   TRUE   coinciden (no se filtró ninguna fila antes de la última auditada).
#   FALSE  no coinciden, o no se puede probar con lo que hay.
# `df_aplicar` es la tabla que se va a limpiar, si se tiene: con una auditoría
# anterior a la columna permite medirlo en vez de suponerlo.
.limpieza_numeracion_auditada_es_origen <- function(scope, df_aplicar = NULL) {
  aud <- .limpieza_tabla_auditada(scope, "principal")
  if (.limpieza_tiene_fila_origen(aud)) {
    return(identical(.limpieza_filas_origen(aud), seq_len(nrow(aud))))
  }
  if (is.data.frame(df_aplicar)) {
    sin_huecos <- identical(.limpieza_filas_origen(df_aplicar), seq_len(nrow(df_aplicar)))
    if (!is.data.frame(aud)) return(sin_huecos)
    return(sin_huecos && nrow(aud) == nrow(df_aplicar))
  }
  if (!is.data.frame(aud)) return(FALSE)
  # Auditoría anterior a la columna y sin la tabla que se limpia: solo se
  # acepta si ninguna lectura pudo quitar filas.
  ev <- scope$evaluacion
  filtro_parciales <- isTRUE((ev$row_filter %||% list())$applied)
  cv <- ((scope$operational_config %||% list())$caso_valido %||% list())
  caso_valido <- isTRUE(cv$enabled) && length(cv$condiciones %||% list()) > 0L
  !filtro_parciales && !caso_valido
}

# Una decisión con casos guardados por número de fila de la tabla principal y
# sin la marca de la numeración del archivo recibido: la contaron sobre la
# tabla auditada.
# Vale igual para la lista congelada de una decisión sobre la regla entera
# (D-F2): un registro hecho antes de la fila de origen contó la tabla auditada.
.limpieza_decision_numeracion_anterior <- function(d) {
  explicitos <- .limpieza_ids_explicitos(d)
  if (!length(explicitos)) explicitos <- .limpieza_casos_congelados(d) %||% character(0)
  if (!length(explicitos) || !any(.limpieza_ids_por_numero_de_fila(explicitos))) return(FALSE)
  !identical(as.character((d$identificacion_casos %||% list())$numeracion %||% "")[1],
             .LIMPIEZA_NUMERACION_ORIGEN)
}

# Filas que la lectura dejó fuera del universo (caso válido declarado), sobre
# la base que se limpia. NA si la auditoría no lo registró.
.limpieza_filas_fuera_universo <- function(ev, operational_config = NULL) {
  f <- (ev %||% list())$caso_valido_filter
  if (is.list(f) && length(f)) {
    return(if (isTRUE(f$applied)) as.integer(f$excluded_rows %||% 0L) else 0L)
  }
  cv <- ((operational_config %||% list())$caso_valido %||% list())
  if (!isTRUE(cv$enabled) || !length(cv$condiciones %||% list())) return(0L)
  NA_integer_
}

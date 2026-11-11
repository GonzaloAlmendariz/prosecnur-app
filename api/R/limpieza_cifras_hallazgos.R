# =============================================================================
# Limpieza: cifras de Hallazgos con su grano declarado
# =============================================================================
# `cifras_hallazgos` de `GET /limpieza`. Cada cifra dice qué cuenta y en qué
# nivel; ninguna mezcla registros de una tabla hija con encuestados.
#
# Cabecera (base: última auditoría de la base pedida; nivel: encuestado salvo
# `n_hallazgos`):
#   n_hallazgos                  pares (fila, regla) marcados, en todas las
#                                tablas: `.limpieza_total_hallazgos()`, la misma
#                                cifra de la tarjeta "Total inconsistencias".
#                                Es la suma de `por_tabla[].n_hallazgos`. 0 sin
#                                reglas evaluadas.
#   n_reglas_evaluadas           reglas con resultado (n_inconsistencias no NA).
#   n_reglas_con_casos           de esas, las que marcan al menos una fila.
#   n_casos_evaluados            filas de la tabla principal auditada (tras el
#                                caso válido y las filas parciales): denominador.
#   n_encuestados_con_hallazgos  filas de la tabla principal con un hallazgo
#                                propio o en alguno de sus registros hijos, sobre
#                                `n_casos_evaluados`.
#   n_registros_sin_encuestado   registros hijos con hallazgos que no se pueden
#                                llevar a una fila de la principal auditada (sin
#                                enlace, o de un encuestado fuera del universo).
#                                Aparte: nunca se suma a los encuestados.
#   n_casos_con_hallazgos        ids de caso distintos con hallazgos, unidos
#                                entre tablas (contrato anterior). Mezcla grano
#                                cuando hay hijas sin el id del envío; para la
#                                pantalla rige `n_encuestados_con_hallazgos`.
#
# `por_tabla[]`, una entrada por tabla de la auditoría, SIN las copias de la
# tabla principal (la hoja original de un Excel, `.limpieza_tablas_alias()`):
#   nivel                        "encuestado" en la principal, "registro" en las
#                                demás.
#   n_registros                  filas de la tabla.
#   n_hallazgos                  pares (registro, regla) de sus reglas.
#   n_registros_con_hallazgos    registros distintos con al menos un hallazgo,
#                                sobre `n_registros`.
#   n_encuestados_con_hallazgos  esos registros llevados a su encuestado de la
#                                principal (en la principal, igual al anterior).
#   n_registros_sin_encuestado   registros con hallazgos que no se llevan a uno.

.limpieza_cifras_hallazgos <- function(scope) {
  ev <- scope$evaluacion
  if (is.null(ev) || is.null(ev$resumen)) return(NULL)
  res <- ev$resumen
  alias <- .limpieza_tablas_alias(ev)
  tablas <- ev$datos_tablas %||% list(principal = ev$datos)
  tablas <- tablas[setdiff(names(tablas), alias)]
  principal <- tablas$principal %||% ev$datos
  identidad <- .limpieza_identidad_caso(scope)$variables
  cache <- new.env(parent = emptyenv())

  n_inc <- if (nrow(res)) suppressWarnings(as.integer(res$n_inconsistencias)) else integer(0)
  tabla_res <- if (nrow(res) && "tabla" %in% names(res)) as.character(res$tabla) else rep("principal", nrow(res))
  tabla_res[is.na(tabla_res) | !nzchar(tabla_res)] <- "principal"
  con_casos <- as.character(res$id_regla[!is.na(n_inc) & n_inc > 0L])
  mapas <- lapply(con_casos, function(rid) .limpieza_rule_case_map(ev, rid, identidad, cache))
  tabla_de <- vapply(mapas, function(m) as.character(m$table %||% "principal"), character(1))

  nombres <- unique(c(names(tablas), setdiff(tabla_res[!is.na(n_inc)], alias)))
  encuestados <- integer(0)
  sin_encuestado <- 0L
  por_tabla <- lapply(nombres, function(t) {
    df <- tablas[[t]]
    filas <- sort(unique(unlist(lapply(mapas[tabla_de == t], `[[`, "row_idx"), use.names = FALSE)))
    pos <- .limpieza_encuestado_de_registros(df, principal, t)[filas]
    if (identical(t, "principal")) pos <- filas
    encuestados <<- c(encuestados, pos[!is.na(pos)])
    sin_encuestado <<- sin_encuestado + as.integer(sum(is.na(pos)))
    list(
      tabla = t,
      nivel = if (identical(t, "principal")) "encuestado" else "registro",
      n_registros = if (is.data.frame(df)) nrow(df) else NA_integer_,
      n_hallazgos = as.integer(sum(n_inc[tabla_res == t], na.rm = TRUE)),
      n_registros_con_hallazgos = length(filas),
      n_encuestados_con_hallazgos = length(unique(pos[!is.na(pos)])),
      n_registros_sin_encuestado = as.integer(sum(is.na(pos)))
    )
  })
  ids_todos <- unique(as.character(unlist(lapply(mapas[tabla_de %in% names(tablas)], `[[`, "case_ids"),
                                          use.names = FALSE)))
  list(
    n_hallazgos = as.integer(sum(vapply(por_tabla, `[[`, 0L, "n_hallazgos"))),
    n_reglas_evaluadas = as.integer(sum(!is.na(n_inc))),
    n_reglas_con_casos = length(con_casos),
    n_casos_evaluados = if (is.data.frame(principal)) nrow(principal) else NA_integer_,
    n_encuestados_con_hallazgos = length(unique(encuestados)),
    n_registros_sin_encuestado = as.integer(sin_encuestado),
    n_casos_con_hallazgos = length(ids_todos),
    por_tabla = por_tabla
  )
}

# Fila de la tabla principal (auditada) a la que pertenece cada registro de
# `df`; NA si no se puede saber. Se cruza por identificador, nunca por
# posición: primero `_parent_index` con el `_index` de la principal, y para lo
# que quede, por el id del envío que la hija hereda (columna candidata).
.limpieza_encuestado_de_registros <- function(df, principal, table_key) {
  n <- if (is.data.frame(df)) nrow(df) else 0L
  if (!n || !is.data.frame(principal) || !nrow(principal)) return(rep(NA_integer_, n))
  if (identical(table_key, "principal")) return(seq_len(n))
  pos <- .dn_repeat_parent_row_positions(df, principal, link_key = "_parent_index",
                                         parent_index_key = "_index")
  if (length(pos) != n) pos <- rep(NA_integer_, n)
  falta <- is.na(pos)
  if (any(falta)) {
    m <- .limpieza_ids_metodo_anterior(df, table_key)
    if (identical(m$metodo, "columna_candidata")) {
      ids_p <- .limpieza_make_case_ids(principal, "principal")
      pos[falta] <- match(m$ids[falta], ids_p)
    }
  }
  as.integer(pos)
}

# Tablas de la auditoría que son copias de la tabla principal: la lectura de
# un Excel deja la hoja original (`data`, `datos`, `Sheet 1`...) al lado de
# `principal`, sin normalizar y sin el filtro de caso válido. No son otra tabla
# del estudio y no se publican como tal.
#
# La lectura numera la hoja original antes de copiarla, así que una copia es la
# tabla, distinta de la principal, que trae la columna de la fila de origen. En
# una auditoría anterior a esa columna se reconoce por sus ids: el mismo método
# y la misma columna que la principal, todos los ids de la principal presentes
# (sin el prefijo de tabla) y casi todas sus columnas en la principal. Una
# tabla identificada solo por posición no se puede reconocer así y se deja.
.limpieza_tablas_alias <- function(ev) {
  tablas <- (ev %||% list())$datos_tablas %||% list()
  otras <- setdiff(names(tablas), "principal")
  principal <- tablas$principal %||% ev$datos
  if (!length(otras) || !is.data.frame(principal)) return(character(0))
  if (.limpieza_tiene_fila_origen(principal)) {
    return(otras[vapply(otras, function(t) .limpieza_tiene_fila_origen(tablas[[t]]), logical(1))])
  }
  m_p <- .limpieza_ids_metodo_anterior(principal, "principal")
  if (identical(m_p$metodo, "numero_fila") && is.na(m_p$columna)) return(character(0))
  sin_tabla <- function(ids, t) substring(ids, ifelse(startsWith(ids, paste0(t, "::")), nchar(t) + 3L, 1L))
  ids_p <- sin_tabla(m_p$ids, "principal")
  otras[vapply(otras, function(t) {
    df <- tablas[[t]]
    if (!is.data.frame(df) || nrow(df) < nrow(principal) || "_parent_index" %in% names(df)) return(FALSE)
    m_t <- .limpieza_ids_metodo_anterior(df, t)
    if (!identical(m_t$metodo, m_p$metodo) || !identical(m_t$columna, m_p$columna)) return(FALSE)
    if (!all(ids_p %in% sin_tabla(m_t$ids, t))) return(FALSE)
    mean(names(df) %in% names(principal)) >= 0.9
  }, logical(1))]
}

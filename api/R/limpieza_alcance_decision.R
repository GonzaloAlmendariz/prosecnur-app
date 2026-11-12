# =============================================================================
# Limpieza (M4): a qué casos llega una decisión sobre la regla entera
# =============================================================================
# Decisión del coordinador D-F2 (revisión metodológica de M2, D1, opción c):
#   - "Ignorar la regla" (`ignore_rule`) sigue a la última auditoría: no toca
#     filas, solo saca la regla del residual.
#   - Excluir, corregir e imputar (toda acción que cambia datos) quedan
#     CONGELADAS a los casos que la regla marcaba cuando la decisión pasó a
#     lista (`target_case_ids_resueltos`, limpieza_casos_resueltos.R). Los casos
#     que una auditoría posterior marque de nuevo quedan pendientes de revisar:
#     no se aplican solos, y la cola los cuenta como pendientes.
#   - Una decisión anterior al registro (sin `target_case_ids_resueltos`) no
#     tiene lista que congelar y sigue a la auditoría como antes; lo publica con
#     `seguimiento = "sin_registro"`.
#
# Por decisión se publican (calculados al responder, no se guardan):
#   seguimiento            "casos_elegidos" (la decisión nombra sus casos),
#                          "congelada", "sigue_a_la_regla", "por_congelar"
#                          (borrador que cambia datos: se congela al pasar a
#                          lista) o "sin_registro".
#   n_casos_al_decidir     casos de la lista guardada (los elegidos o los que
#                          resolvía al pasar a lista); null si no hay lista.
#   casos_nuevos           casos que la regla marca en la última auditoría y no
#                          están en la lista (solo congeladas; null en las demás).
#   casos_que_ya_no_marca  casos de la lista que la regla ya no marca.
#   n_casos_aplicados      casos (ids distintos de la tabla principal auditada)
#                          a los que la decisión se aplica hoy; en "ignorar la
#                          regla", los casos que la regla marca y la decisión
#                          cubre. Nivel: caso; con una regla de grupo repetido
#                          que hereda el id del envío, encuestado.
#   alcance                "caso" o "encuestado" (D-F3: una decisión sobre una
#                          regla de grupo repetido se aplica al encuestado
#                          entero, con todos sus registros).
#
# Los ids de la lista se comparan con los de la auditoría con el método con
# que se guardaron (su marca, `identificacion_casos`), nunca con otro.

.LIMPIEZA_ACCIONES_QUE_SIGUEN_A_LA_REGLA <- c("ignore_rule")

# Lista congelada de una decisión sobre la regla entera: los ids resueltos al
# pasar a lista (character(0) si la regla no marcaba casos entonces), o NULL si
# la decisión sigue a la regla (ignorar, nombra casos, o no tiene registro).
.limpieza_casos_congelados <- function(d) {
  if (!is.list(d) || length(.limpieza_ids_explicitos(d))) return(NULL)
  if (as.character(d$action_type %||% "")[1] %in% .LIMPIEZA_ACCIONES_QUE_SIGUEN_A_LA_REGLA) return(NULL)
  if (is.null(d$target_case_ids_resueltos)) return(NULL)
  ids <- unique(as.character(unlist(d$target_case_ids_resueltos, use.names = FALSE)))
  ids[!is.na(ids) & nzchar(ids)]
}

.limpieza_seguimiento <- function(d) {
  if (length(.limpieza_ids_explicitos(d))) return("casos_elegidos")
  if (!is.null(.limpieza_casos_congelados(d))) return("congelada")
  if (as.character(d$action_type %||% "")[1] %in% .LIMPIEZA_ACCIONES_QUE_SIGUEN_A_LA_REGLA) return("sigue_a_la_regla")
  # Una acción que cambia datos se congela al pasar a lista: en borrador todavía
  # no tiene lista; lista y sin registro es una decisión anterior al registro.
  if (identical(as.character(d$status %||% ""), "ready")) "sin_registro" else "por_congelar"
}

# Ids que la regla marca hoy, leídos con la marca de la decisión en la tabla de
# su regla. NULL si la marca ya no sirve en esa tabla (no se puede comparar).
.limpieza_ids_marcados_con_marca <- function(d, scope) {
  mapa <- .limpieza_rule_case_map(scope$evaluacion, d$source_id)
  df <- .limpieza_tabla_auditada(scope, mapa$table)
  if (!is.data.frame(df)) return(character(0))
  r <- .limpieza_ids_por_marca(df, mapa$table, d$identificacion_casos)
  if (!isTRUE(r$aplicable)) return(NULL)
  unique(r$ids[mapa$row_idx])
}

#' Seguimiento de una decisión respecto de la última auditoría
#'
#' @param d decisión (lista).
#' @param scope scope de la base.
#' @return lista con `seguimiento`, `n_casos_al_decidir`, `casos_nuevos`,
#'   `casos_que_ya_no_marca`, `n_casos_aplicados` y `alcance`.
#' @keywords internal
limpieza_seguimiento_decision <- function(d, scope) {
  seg <- .limpieza_seguimiento(d)
  lista <- if (identical(seg, "casos_elegidos")) .limpieza_ids_explicitos(d) else .limpieza_casos_congelados(d)
  tabla <- .limpieza_tabla_de_regla(scope, d$source_id)
  out <- list(seguimiento = seg,
              n_casos_al_decidir = if (is.null(lista)) NA_integer_ else length(lista),
              casos_nuevos = NA, casos_que_ya_no_marca = NA, n_casos_aplicados = NA_integer_,
              alcance = if (identical(tabla, "principal")) "caso" else "encuestado")
  if (is.null(scope$evaluacion)) return(out)
  marcados <- if (is.null(lista)) {
    .limpieza_rule_case_map(scope$evaluacion, d$source_id, .limpieza_identidad_caso(scope)$variables)$case_ids
  } else .limpieza_ids_marcados_con_marca(d, scope)
  if (!is.null(lista) && !is.null(marcados)) {
    out$casos_que_ya_no_marca <- as.list(setdiff(lista, marcados))
    if (identical(seg, "congelada")) out$casos_nuevos <- as.list(setdiff(marcados, lista))
  }
  out$n_casos_aplicados <- .limpieza_n_casos_aplicados(d, scope, marcados)
  out
}

# Casos distintos a los que llega la decisión hoy en la tabla principal
# auditada (donde se aplica). Ignorar la regla no toca filas: cuenta los casos
# que la regla marca y que la decisión cubre.
.limpieza_n_casos_aplicados <- function(d, scope, marcados = NULL) {
  if (identical(as.character(d$action_type %||% "")[1], "ignore_rule")) {
    explicitos <- .limpieza_ids_explicitos(d)
    m <- unique(as.character(marcados %||% character(0)))
    return(as.integer(if (length(explicitos)) length(intersect(m, explicitos)) else length(m)))
  }
  principal <- .limpieza_tabla_auditada(scope, "principal")
  if (!is.data.frame(principal)) return(NA_integer_)
  r <- .limpieza_resolver_decision(d, scope, principal, "principal", es_auditada = TRUE)
  if (!isTRUE(r$aplicable)) return(0L)
  as.integer(length(unique(r$ids_filas[r$filas])))
}

# La decisión con su seguimiento, para `decision_draft`.
.limpieza_decision_con_seguimiento <- function(d, scope) {
  c(d, limpieza_seguimiento_decision(d, scope))
}

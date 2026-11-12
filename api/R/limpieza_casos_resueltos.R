# =============================================================================
# Limpieza: casos que guarda una decisión y con qué método se identificaron
# =============================================================================
# Una decisión "para todos los casos que marcó la regla" no guarda lista de
# casos elegidos. Aquí se registra QUÉ casos eran cuando el analista la dio por
# lista. Desde M4 (D-F2, limpieza_alcance_decision.R) esa lista es la que se
# aplica en las acciones que cambian datos (excluir, corregir, imputar);
# "ignorar la regla" sigue resolviéndose contra la última auditoría.
#
# Campos que agrega a la decisión:
#   target_case_ids_resueltos  ids de caso que resolvía al pasar a lista
#                              (lista vacía si la regla no marcaba casos o no
#                              había auditoría).
#   casos_resueltos_en         cuándo se registró (UTC).
#   identificacion_casos       con qué método se identificaron los casos que
#                              guarda (`.limpieza_marca_actual()`). La decisión
#                              se resuelve siempre con él, nunca con otro.
#
# La marca se fija UNA vez, al guardar los casos por primera vez, y no se
# reescribe mientras los casos guardados no cambien: volver a guardar la
# decisión (pasarla a lista, editar el motivo) conserva marca y casos, aunque
# el método ya no sirva (entonces la decisión sigue sin aplicarse y lo dice).
# Casos explícitos nuevos se validan contra el método vigente: si no sirve, o
# si algún id no está en la última auditoría, el guardado se rechaza en vez de
# guardar ids que no apuntan a nadie.

#
# Desde M4 (D-F2) la lista resuelta de una decisión que cambia datos es la que
# se aplica (limpieza_alcance_decision.R). Para sumar los casos nuevos que marca
# una auditoría posterior, el cliente vuelve a guardarla lista con
# `incluir_casos_nuevos: true`: a la lista se suman los casos que la regla
# marca hoy; los que ya no marca siguen en ella (lo congelado es congelado).
.limpieza_registrar_casos_resueltos <- function(decision, previa = NULL, scope = NULL,
                                                ahora = .limpieza_now_utc(),
                                                incluir_nuevos = FALSE) {
  explicitos <- .limpieza_ids_explicitos(decision)
  lista <- identical(as.character(decision$status %||% ""), "ready")
  decision$target_case_ids_resueltos <- NULL
  decision$casos_resueltos_en <- NULL
  decision$identificacion_casos <- NULL

  if (length(explicitos)) {
    previos <- if (is.list(previa)) .limpieza_ids_explicitos(previa) else character(0)
    # Misma regla: la marca se tomó en su tabla; con otra regla se valida otra vez.
    if (length(previos) && setequal(previos, explicitos) &&
        identical(as.character(previa$source_id %||% ""), as.character(decision$source_id %||% ""))) {
      # Los mismos casos: la marca se queda como se fijó (NULL en decisiones
      # anteriores a la marca, que se resuelven con el método anterior).
      decision$identificacion_casos <- previa$identificacion_casos
      return(decision)
    }
    decision$identificacion_casos <- .limpieza_validar_casos_nuevos(decision, explicitos, scope,
                                                                    previa)
    return(decision)
  }
  if (!lista) return(decision)

  # Ya estaba lista y con su registro: se conserva el del momento en que pasó
  # a lista, con su marca, aunque la auditoría haya cambiado después. Solo si
  # es la MISMA decisión: misma regla y misma acción. Con otra regla, la lista
  # era de otros casos; con otra acción (ignorar que pasa a excluir), la
  # decisión que cambia datos pasa a lista ahora y se congela con la auditoría
  # vigente.
  previa_lista <- is.list(previa) && identical(as.character(previa$status %||% ""), "ready")
  misma <- previa_lista && !is.null(previa$target_case_ids_resueltos) &&
    identical(as.character(previa$source_id %||% ""), as.character(decision$source_id %||% "")) &&
    identical(as.character(previa$action_type %||% ""), as.character(decision$action_type %||% ""))
  if (misma) {
    decision$target_case_ids_resueltos <- previa$target_case_ids_resueltos
    decision$casos_resueltos_en <- previa$casos_resueltos_en %||% ahora
    decision$identificacion_casos <- previa$identificacion_casos
    if (isTRUE(incluir_nuevos) && !is.null(scope$evaluacion)) {
      # Congelados más los nuevos, leídos con la marca de la decisión; los que
      # la regla ya no marca siguen en la lista (decisión del coordinador).
      hoy <- .limpieza_ids_marcados_con_marca(previa, scope)
      if (!is.null(hoy)) {
        previos <- as.character(unlist(previa$target_case_ids_resueltos, use.names = FALSE))
        decision$target_case_ids_resueltos <- as.list(unique(c(previos, hoy)))
        decision$casos_resueltos_en <- ahora
      }
    }
    return(decision)
  }

  ids <- if (!is.null(scope$evaluacion)) .limpieza_target_case_ids(decision, scope) else character(0)
  ids <- unique(as.character(ids %||% character(0)))
  decision$target_case_ids_resueltos <- as.list(ids[!is.na(ids) & nzchar(ids)])
  decision$casos_resueltos_en <- ahora
  decision$identificacion_casos <- .limpieza_marca_actual(scope, decision$source_id)
  decision
}

# Casos explícitos nuevos: se validan en la tabla de la regla de la decisión
# con el método que rige hoy, y se devuelve la marca de ese método. Sin
# auditoría no hay contra qué validar: se conserva la marca que la decisión ya
# tenía (con su columna) y, si no tenía, se anota el método anterior.
.limpieza_validar_casos_nuevos <- function(decision, explicitos, scope, previa = NULL) {
  if (is.null((scope %||% list())$evaluacion)) {
    previa_marca <- if (is.list(previa)) previa$identificacion_casos else NULL
    return(previa_marca %||%
             .limpieza_marca_de_identidad(.limpieza_identidad_caso(scope %||% list())$variables))
  }
  tabla <- .limpieza_tabla_de_regla(scope, decision$source_id)
  df <- .limpieza_tabla_auditada(scope, tabla)
  marca <- .limpieza_marca_actual(scope, decision$source_id)
  if (!is.data.frame(df)) return(marca)
  r <- .limpieza_ids_por_marca(df, tabla, marca)
  if (!isTRUE(r$aplicable)) {
    stop_api(409, "E_LIMPIEZA_CASOS_INVALIDOS",
             sprintf("No se pueden guardar los casos: %s.", .limpieza_texto_no_aplicable(r$motivo)),
             details = list(motivo = r$motivo, tabla = tabla))
  }
  faltan <- setdiff(explicitos, r$ids)
  if (length(faltan)) {
    stop_api(422, "E_LIMPIEZA_CASOS_INVALIDOS",
             sprintf("%d %s de la decisión no %s en la última auditoría: %s.",
                     length(faltan), if (length(faltan) == 1L) "caso" else "casos",
                     if (length(faltan) == 1L) "está" else "están",
                     paste(utils::head(faltan, 5L), collapse = ", ")),
             details = list(ids = as.list(faltan), tabla = tabla))
  }
  marca
}

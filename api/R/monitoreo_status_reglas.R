# =============================================================================
# monitoreo_status_reglas.R — Status del barrido gobernado por `state_rules`
# =============================================================================
#
# Checklist 2.1 y 2.2 (ACNUR RMS 2026). Hasta hoy solo «Efectivo» y «Rechazo»
# tenían estado propio y los otros Status del vocabulario caían en «Sin
# respuesta» sin aviso; `operational_model$state_rules` solo lo leía el
# frontend para colores.
#
# Opt-in por perfil: `monitoreo_profile$status_from_rules` (por defecto FALSE).
# Apagada, nada cambia. Encendida, el estado de las filas del BARRIDO sale de
# las reglas:
#   - se compara el Status normalizado (`.monitoreo_text_key`, `_` como espacio)
#     contra `outcome_values`;
#   - `final_state`: complete -> Completa, partial -> Parcial, refusal ->
#     Rechazo, pending y non_effective -> Sin respuesta;
#   - gana la primera regla por `priority` ascendente que casa;
#   - un Status sin regla cae en el vocabulario fijo de siempre
#     (`.monitoreo_report_state_from_status`).
# Las respuestas de plataforma no cambian.
#
# Plomería: las reglas viajan en el perfil normalizado (`profile$state_rules`),
# copiadas desde `operational_model` por `monitoreo_normalize_config`; así
# `.monitoreo_report_states(df, profile)` conserva su firma.
# =============================================================================

.monitoreo_estado_clave <- function(x) {
  clave <- .monitoreo_text_key(x)
  clave <- gsub("_", " ", clave, fixed = TRUE)
  trimws(gsub("\\s+", " ", clave))
}

# Estado de reporte para un `final_state`; NA si la regla no mapea a un estado
# (p. ej. `excluded`): el Status cae entonces en el vocabulario fijo.
.monitoreo_estado_de_final <- function(final_state) {
  switch(
    .monitoreo_scalar(final_state, ""),
    complete = "Completa",
    partial = "Parcial",
    refusal = "Rechazo",
    pending = "Sin respuesta",
    non_effective = "Sin respuesta",
    NA_character_
  )
}

# Tabla valor -> estado (vector con nombres = valor normalizado). La primera
# regla por prioridad ascendente que trae el valor gana; un valor declarado por
# una regla sin estado queda como NA (casó, pero no decide).
.monitoreo_status_reglas_tabla <- function(rules) {
  if (is.null(rules) || !length(rules)) return(character(0))
  rules <- Filter(is.list, rules)
  if (!length(rules)) return(character(0))
  prioridad <- vapply(rules, function(r) .monitoreo_int(r[["priority"]], 999L), integer(1))
  tabla <- character(0)
  for (regla in rules[order(prioridad, seq_along(rules))]) {
    estado <- .monitoreo_estado_de_final(regla[["final_state"]])
    for (valor in unique(.monitoreo_estado_clave(.monitoreo_chr_vec(regla[["outcome_values"]])))) {
      if (!nzchar(valor) || valor %in% names(tabla)) next
      tabla[[valor]] <- estado
    }
  }
  tabla
}

.monitoreo_status_desde_reglas_activo <- function(profile) {
  isTRUE(profile[["status_from_rules"]]) && length(profile[["state_rules"]]) > 0L
}

# Estado de las filas operativas (no respuestas). Reemplaza la llamada directa a
# `.monitoreo_report_state_from_status(platform = FALSE)` en `.monitoreo_report_states`.
.monitoreo_report_states_operativos <- function(status, profile = list()) {
  base <- .monitoreo_report_state_from_status(status, platform = FALSE)
  if (!.monitoreo_status_desde_reglas_activo(profile)) return(base)
  tabla <- .monitoreo_status_reglas_tabla(profile[["state_rules"]])
  if (!length(tabla)) return(base)
  clave <- .monitoreo_estado_clave(status)
  casa <- clave %in% names(tabla)
  if (!any(casa)) return(base)
  mapeado <- unname(tabla[clave[casa]])
  base[casa][!is.na(mapeado)] <- mapeado[!is.na(mapeado)]
  base
}

# --- Opt-in en el perfil -----------------------------------------------------

# Fin de `monitoreo_normalize_profile`: la normalización es una whitelist y
# descartaba `status_from_rules`. Se conserva (FALSE por defecto) y, encendida,
# también las reglas ya copiadas al perfil.
.monitoreo_profile_status_reglas <- function(out, profile) {
  encendida <- .monitoreo_bool(profile[["status_from_rules"]], FALSE)
  out[["status_from_rules"]] <- encendida
  if (encendida && !is.null(profile[["state_rules"]])) out[["state_rules"]] <- profile[["state_rules"]]
  out
}

# `monitoreo_normalize_config` ve el perfil y el modelo operativo a la vez: con
# la bandera encendida copia las reglas resueltas al perfil.
.monitoreo_profile_con_reglas <- function(profile, operational_model) {
  if (!isTRUE(profile[["status_from_rules"]])) return(profile)
  profile[["state_rules"]] <- operational_model[["state_rules"]] %||% list()
  profile
}

# Emparejamiento uno a uno entre los casos de la base telefónica y las respuestas de plataforma (reparo 4 del
# numerador, checklist de cuotas 2026-11-03). `.monitoreo_report_has_key` responde por fila «¿alguna respuesta
# completa trae una de mis llaves?», así que dos casos con la misma llave recibían la misma entrevista y la
# contaban dos veces. Aquí cada respuesta se asigna a un solo caso y las llaves repetidas se avisan con su
# conteo: nunca en silencio.

#' Llaves de tipo código (no teléfono ni correo): las que identifican a una persona.
.monitoreo_telefonico_es_llave_codigo <- function(llaves) {
  grepl("^(codpulso|cod pulso|codigo|código|id|cv_id|custom_value):", llaves, ignore.case = TRUE)
}

#' A qué respuesta completa corresponde cada caso de la base, asignando cada respuesta a un solo caso.
#'
#' Devuelve, por caso, el índice de su respuesta o `NA`. Dos pasadas: primero por llave código, después por
#' las demás (teléfono, correo), así un teléfono compartido no le quita a un caso la respuesta que trae su
#' propio código (revisión del reparo 4). Dentro de cada pasada, primero los casos que la hoja marca
#' «Completa» (`prioridad`) y después el resto en el orden de la base.
.monitoreo_telefonico_respuesta_asignada <- function(phone_keys, response_keys, response_mask, prioridad = NULL) {
  n <- length(phone_keys)
  asignada <- rep(NA_integer_, n)
  if (!n || !length(response_keys) || !any(response_mask, na.rm = TRUE)) return(asignada)
  indexar <- function(solo_codigo) {
    indice <- new.env(hash = TRUE, parent = emptyenv())
    for (j in which(response_mask %in% TRUE)) {
      llaves <- unique(response_keys[[j]])
      llaves <- llaves[nzchar(llaves) & (!solo_codigo | .monitoreo_telefonico_es_llave_codigo(llaves))]
      for (llave in llaves) assign(llave, c(get0(llave, envir = indice, inherits = FALSE), j), envir = indice)
    }
    indice
  }
  usada <- logical(length(response_keys))
  orden <- if (length(prioridad) == n) order(!(prioridad %in% TRUE), seq_len(n)) else seq_len(n)
  for (solo_codigo in c(TRUE, FALSE)) {
    indice <- indexar(solo_codigo)
    for (i in orden) {
      if (!is.na(asignada[[i]])) next
      llaves <- unique(phone_keys[[i]])
      llaves <- llaves[nzchar(llaves) & (!solo_codigo | .monitoreo_telefonico_es_llave_codigo(llaves))]
      if (!length(llaves)) next
      candidatas <- unique(unlist(lapply(llaves, function(llave) get0(llave, envir = indice, inherits = FALSE)), use.names = FALSE))
      candidatas <- candidatas[!usada[candidatas]]
      if (!length(candidatas)) next
      usada[[candidatas[[1L]]]] <- TRUE
      asignada[[i]] <- candidatas[[1L]]
    }
  }
  asignada
}

#' ¿Tiene cada caso una respuesta completa propia? (`respuesta_asignada` no `NA`).
.monitoreo_telefonico_emparejar_uno_a_uno <- function(phone_keys, response_keys, response_mask, prioridad = NULL) {
  !is.na(.monitoreo_telefonico_respuesta_asignada(phone_keys, response_keys, response_mask, prioridad))
}

#' Casos de la base que comparten su llave código con otro caso.
#'
#' Sólo la primera llave de tipo código de cada caso, esté donde esté en su lista: dos personas pueden
#' compartir un teléfono sin que eso sea un error de la base. Devuelve cuántos casos y cuántas llaves, y hasta
#' tres llaves de ejemplo.
.monitoreo_telefonico_llaves_repetidas <- function(phone_keys) {
  principal <- vapply(phone_keys, function(llaves) {
    llaves <- llaves[nzchar(llaves) & .monitoreo_telefonico_es_llave_codigo(llaves)]
    if (length(llaves)) llaves[[1L]] else ""
  }, character(1))
  principal <- principal[nzchar(principal)]
  conteo <- table(principal)
  repetidas <- names(conteo)[conteo > 1L]
  list(
    casos = as.integer(sum(conteo[repetidas])),
    llaves = length(repetidas),
    ejemplos = utils::head(.monitoreo_telefonico_llave_visible_vec(repetidas), 3L)
  )
}

.monitoreo_telefonico_llave_visible_vec <- function(llaves) {
  vapply(llaves, function(llave) .monitoreo_telefonico_llave_visible(llave), character(1), USE.NAMES = FALSE)
}

#' El aviso de llaves repetidas, con su causa y su conteo; vacío si no hay.
.monitoreo_telefonico_aviso_llaves_repetidas <- function(repetidas) {
  if (!length(repetidas$casos) || repetidas$casos < 2L) return("")
  sprintf(
    "%d casos de la base comparten llave (%d %s repetida%s, p. ej. %s): cada respuesta de Kobo se asigna a un solo caso y los demás quedan sin efectiva. Revisa la base.",
    repetidas$casos, repetidas$llaves, if (repetidas$llaves == 1L) "llave" else "llaves",
    if (repetidas$llaves == 1L) "" else "s", paste(repetidas$ejemplos, collapse = ", ")
  )
}

#' El aviso de completas de Kobo sin ninguna llave legible: no se pueden asignar ni declarar como «fuera de la
#' base» (`response_outside_phone_complete` exige una llave), así que antes se perdían en silencio.
.monitoreo_telefonico_aviso_sin_llave <- function(n) {
  if (!length(n) || n < 1L) return("")
  sprintf("%d %s de Kobo sin llave legible: no se pueden asignar a ningún caso ni se suman a Efectivas. Revisa el campo de código del formulario.",
          n, if (n == 1L) "completa" else "completas")
}

#' El aviso de completas de Kobo que repiten un caso que ya tiene su efectiva (un envío duplicado).
.monitoreo_telefonico_aviso_respuestas_repetidas <- function(n) {
  if (!length(n) || n < 1L) return("")
  sprintf("%d %s de Kobo %s un caso que ya tiene su efectiva: cada caso cuenta una vez. Revisa los envíos duplicados.",
          n, if (n == 1L) "completa" else "completas", if (n == 1L) "repite" else "repiten")
}

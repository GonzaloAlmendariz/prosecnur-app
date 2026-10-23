# =============================================================================
# monitoreo_telefonico_cola.R — Cola de insistencia del monitoreo telefónico
# =============================================================================
#
# Revamp de Monitoreo › Telefónico, fase T4 (Control › Insistencia). Diseño en
# `docs/qa/revamp-monitoreo/telefonico.md` §1c y ficha «Control, Insistencia»;
# procedimiento en `procedimientos-respondidos.md`.
#
# La hoja de barrido guarda UNA fila por caso que se sobrescribe: status,
# intentos acumulados, fecha del último intento y una observación libre. No hay
# historia de llamadas, ni próximo intento, ni número marcado, ni regla de
# agotado (decide el supervisor). La cola es eso, caso por caso, y nada más.
#
# Bloques:
#   - `cola_insistencia`: una fila por caso barrido que no es final.
#   - `cola_insistencia_responsables`: casos en cola y promedio de intentos por
#     responsable, con «Sin asignar» separado (no es atraso).
#
# Qué es «no final» (en este orden):
#   1. Efectiva de la hoja (estado «Completa») y «No barrido» quedan fuera: la
#      primera ya cerró y la segunda todavía no se llamó.
#   2. Si el Status casa con una regla del vocabulario del proyecto
#      (`operational_model$state_rules`, mismo emparejamiento que
#      `monitoreo_status_reglas.R`), manda la familia declarada: `stop_contact`
#      o `complete`/`refusal`/`excluded` cierran; `pending`/`non_effective`
#      siguen en cola.
#   3. Si no casa, o la familia no decide (`partial`, una familia propia), se
#      usa la clasificación que el motor ya tenía para «No efectivos
#      reintentables» (`reattempt_mask` de `.monitoreo_report_phone_blocks`).
# Cada fila publica cuál de los dos criterios la puso en la cola.
# =============================================================================

.MONITOREO_COLA_MAX_FILAS <- 5000L

.MONITOREO_COLA_CONDICIONALES <- list(
  OrdenTelefono = c("OrdenTelefono", "Orden telefono", "Orden teléfono"),
  TelefonosIntentados = c("TelefonosIntentados", "Telefonos intentados", "Teléfonos intentados"),
  NumTelefonos = c("NumTelefonos", "Num telefonos", "Número de teléfonos", "Numero de telefonos"),
  Origen = c("Origen")
)

# Familia declarada por valor de Status. Devuelve data.frame(clave, familia,
# cierra) con la primera regla por prioridad ascendente que trae el valor.
.monitoreo_cola_familias <- function(rules) {
  vacio <- data.frame(clave = character(0), familia = character(0), cierra = logical(0), stringsAsFactors = FALSE)
  rules <- Filter(is.list, rules %||% list())
  if (!length(rules)) return(vacio)
  prioridad <- vapply(rules, function(r) .monitoreo_int(r[["priority"]], 999L), integer(1))
  filas <- list()
  vistos <- character(0)
  for (regla in rules[order(prioridad, seq_along(rules))]) {
    familia <- .monitoreo_scalar(regla[["final_state"]], "")
    cierra <- .monitoreo_bool(regla[["stop_contact"]], FALSE)
    for (valor in unique(.monitoreo_estado_clave(.monitoreo_chr_vec(regla[["outcome_values"]])))) {
      if (!nzchar(valor) || valor %in% vistos) next
      vistos <- c(vistos, valor)
      filas[[length(filas) + 1L]] <- data.frame(clave = valor, familia = familia, cierra = cierra, stringsAsFactors = FALSE)
    }
  }
  if (!length(filas)) return(vacio)
  do.call(rbind, filas)
}

# Máscara de casos no finales y criterio que la decidió, por fila.
.monitoreo_cola_no_final <- function(status, barrido, efectivo, reintentable, rules) {
  n <- length(status)
  familias <- .monitoreo_cola_familias(rules)
  idx <- match(.monitoreo_estado_clave(status), familias$clave)
  familia <- ifelse(is.na(idx), "", familias$familia[idx])
  cierra <- !is.na(idx) & familias$cierra[ifelse(is.na(idx), 1L, idx)] %in% TRUE
  cierra_declarado <- cierra | familia %in% c("complete", "refusal", "excluded")
  abierto_declarado <- !cierra & familia %in% c("pending", "non_effective")
  decide_vocabulario <- cierra_declarado | abierto_declarado
  reintentable <- rep_len(as.logical(reintentable %||% FALSE), n)
  reintentable[is.na(reintentable)] <- FALSE
  candidata <- as.logical(barrido) & !as.logical(efectivo)
  candidata[is.na(candidata)] <- FALSE
  no_final <- candidata & ifelse(decide_vocabulario, abierto_declarado, reintentable)
  list(
    no_final = no_final,
    criterio = ifelse(decide_vocabulario, "Vocabulario del proyecto", "Clasificación del motor")
  )
}

.monitoreo_cola_texto_literal <- function(x) {
  out <- as.character(x)
  out[is.na(out) | !nzchar(trimws(out))] <- NA_character_
  out
}

# Entero si todo lo no vacío es un entero; si no, el texto literal.
.monitoreo_cola_entero_o_texto <- function(x) {
  raw <- .monitoreo_cola_texto_literal(x)
  presentes <- raw[!is.na(raw)]
  if (!length(presentes)) return(rep(NA_integer_, length(raw)))
  if (all(grepl("^\\s*[0-9]+\\s*$", presentes))) return(suppressWarnings(as.integer(trimws(raw))))
  raw
}

# Columnas condicionales: se toman de la hoja de barrido; `NumTelefonos` vive en
# el listado (universo) en Medios de Vida 2026, así que si la hoja no lo trae
# se lee del universo por la misma llave del caso.
.monitoreo_cola_condicionales <- function(phone, data, keys) {
  out <- list()
  universo <- if (is.data.frame(data) && ".source_role" %in% names(data)) {
    data[as.character(data$.source_role) == "universo", , drop = FALSE]
  } else {
    data.frame()
  }
  key_aliases <- c("CodPulso", "Cod Pulso", "Cód Pulso", "Codigo Pulso", "Código Pulso")
  for (nombre in names(.MONITOREO_COLA_CONDICIONALES)) {
    aliases <- .MONITOREO_COLA_CONDICIONALES[[nombre]]
    col <- .monitoreo_report_col(phone, aliases)
    valores <- if (nzchar(col)) phone[[col]] else rep(NA, nrow(phone))
    if (!any(.monitoreo_report_nonempty(valores)) && identical(nombre, "NumTelefonos") && nrow(universo)) {
      ucol <- .monitoreo_report_col(universo, aliases)
      ukey <- .monitoreo_report_col(universo, key_aliases)
      if (nzchar(ucol) && nzchar(ukey)) {
        ukeys <- trimws(as.character(universo[[ukey]]))
        valores <- universo[[ucol]][match(trimws(as.character(keys)), ukeys)]
      }
    }
    if (!any(.monitoreo_report_nonempty(valores))) next
    out[[nombre]] <- if (identical(nombre, "Origen")) .monitoreo_cola_texto_literal(valores) else .monitoreo_cola_entero_o_texto(valores)
  }
  out
}

# Corte contra el que se cuentan los días sin registro. El reporte se arma al
# sincronizar (el `generated_at` del snapshot es el `synced_at`), así que la
# fecha de armado es la del corte; un llamador puede fijarlo en `cfg$corte`.
.monitoreo_cola_corte <- function(cfg = list()) {
  declarado <- .monitoreo_daily_parse_date_vec(.monitoreo_scalar(cfg[["corte"]] %||% cfg[["synced_at"]], ""))
  if (length(declarado) && nzchar(declarado[[1]])) return(as.Date(declarado[[1]]))
  Sys.Date()
}

.monitoreo_cola_vacia <- function() {
  data.frame(
    CodPulso = character(0), Responsable = character(0), `Sin asignar` = logical(0),
    Status = character(0), Intentos = integer(0), Fecha = character(0),
    `Observación` = character(0), `Variable cuota` = character(0), Cuota = character(0),
    efectiva_kobo = logical(0), dias_sin_registro = integer(0), `Criterio cola` = character(0),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

#' Cola de insistencia (data.frame) desde los vectores del reporte telefónico.
#'
#' `ctx` trae los vectores por fila de `phone` que `.monitoreo_report_phone_blocks`
#' ya calculó: `status`, `responsables`, `attempts`, `dates`, `keys`,
#' `efectiva_kobo`, `no_barrido`, `efectivo`, `reintentable` y, si hay,
#' `quota_variable` + `quota_values`.
#' @noRd
.monitoreo_telefonico_cola_df <- function(phone, ctx, rules = list(), data = NULL, corte = Sys.Date()) {
  if (!is.data.frame(phone) || !nrow(phone)) return(.monitoreo_cola_vacia())
  n <- nrow(phone)
  vec <- function(x, default) {
    x <- x %||% rep(default, n)
    if (length(x) != n) x <- rep(default, n)
    x
  }
  status <- vec(ctx$status, "Sin status")
  clasif <- .monitoreo_cola_no_final(
    status = status,
    barrido = !vec(ctx$no_barrido, FALSE),
    efectivo = vec(ctx$efectivo, FALSE),
    reintentable = vec(ctx$reintentable, FALSE),
    rules = rules
  )
  idx <- which(clasif$no_final)
  if (!length(idx)) return(.monitoreo_cola_vacia())

  responsables <- vec(ctx$responsables, "Sin responsable")
  sin_asignar <- responsables %in% c("Sin responsable", "") | is.na(responsables)
  responsables[sin_asignar] <- "Sin asignar"
  intentos <- vec(ctx$attempts, NA_real_)
  fechas <- .monitoreo_daily_parse_date_vec(vec(ctx$dates, ""))
  fechas[!nzchar(fechas)] <- NA_character_
  corte <- as.Date(corte)
  dias <- as.integer(corte - as.Date(fechas))
  obs_col <- .monitoreo_report_col(phone, c("Observación", "Observacion", "Observaciones", "Observación del barrido"))
  observacion <- if (nzchar(obs_col)) .monitoreo_cola_texto_literal(phone[[obs_col]]) else rep(NA_character_, n)
  quota_variable <- .monitoreo_scalar(ctx$quota_variable, "")
  quota_values <- vec(ctx$quota_values, NA_character_)
  quota_values <- .monitoreo_cola_texto_literal(quota_values)
  quota_values[quota_values %in% "Sin dato"] <- NA_character_
  efectiva <- vec(ctx$efectiva_kobo, FALSE) %in% TRUE
  keys <- vec(ctx$keys, "")

  out <- data.frame(
    CodPulso = as.character(keys[idx]),
    Responsable = responsables[idx],
    `Sin asignar` = sin_asignar[idx],
    Status = status[idx],
    Intentos = as.integer(floor(intentos[idx])),
    Fecha = fechas[idx],
    `Observación` = observacion[idx],
    `Variable cuota` = rep(if (nzchar(quota_variable)) quota_variable else NA_character_, length(idx)),
    Cuota = quota_values[idx],
    efectiva_kobo = efectiva[idx],
    dias_sin_registro = dias[idx],
    `Criterio cola` = clasif$criterio[idx],
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  condicionales <- .monitoreo_cola_condicionales(phone, data, keys)
  for (nombre in names(condicionales)) out[[nombre]] <- condicionales[[nombre]][idx]
  # Orden neutro: P12 (orden por defecto) sigue abierta y lo decide el frente.
  out[order(out$`Sin asignar`, out$Responsable, out$CodPulso), , drop = FALSE]
}

#' Resumen por responsable de la cola: casos en cola, ya efectivas en Kobo,
#' promedio de intentos y «Por llamar» (No barrido asignado). La fila «Sin
#' asignar» va al final y suma los «No barrido» sin responsable.
#' @noRd
.monitoreo_telefonico_cola_responsables_df <- function(cola, responsables, no_barrido) {
  responsables <- as.character(responsables %||% character(0))
  no_barrido <- as.logical(no_barrido %||% logical(0))
  if (length(no_barrido) != length(responsables)) no_barrido <- rep(FALSE, length(responsables))
  sin_resp <- is.na(responsables) | responsables %in% c("Sin responsable", "")
  responsables[sin_resp] <- "Sin asignar"
  nombres <- unique(c(as.character(cola$Responsable), if (any(no_barrido & sin_resp, na.rm = TRUE)) "Sin asignar"))
  if (!length(nombres)) {
    return(data.frame(
      Responsable = character(0), `Sin asignar` = logical(0), `Casos en cola` = integer(0),
      `Ya efectivas en Kobo` = integer(0), `Promedio intentos` = numeric(0),
      `Sin dato de intentos` = integer(0), `Por llamar` = integer(0),
      check.names = FALSE, stringsAsFactors = FALSE
    ))
  }
  filas <- lapply(nombres, function(nombre) {
    en_cola <- cola$Responsable == nombre
    intentos <- cola$Intentos[en_cola]
    validos <- intentos[!is.na(intentos)]
    data.frame(
      Responsable = nombre,
      `Sin asignar` = identical(nombre, "Sin asignar"),
      `Casos en cola` = as.integer(sum(en_cola)),
      `Ya efectivas en Kobo` = as.integer(sum(cola$efectiva_kobo[en_cola] %in% TRUE)),
      `Promedio intentos` = if (length(validos)) round(mean(validos), 2) else NA_real_,
      `Sin dato de intentos` = as.integer(sum(is.na(intentos))),
      `Por llamar` = as.integer(sum(no_barrido & responsables == nombre, na.rm = TRUE)),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, filas)
  out[order(out$`Sin asignar`, -out$`Casos en cola`, out$Responsable), , drop = FALSE]
}

#' Bloques `cola_insistencia` y `cola_insistencia_responsables` del reporte
#' telefónico. Lo llama `.monitoreo_report_phone_blocks`.
#' @noRd
.monitoreo_telefonico_cola_blocks <- function(phone, ctx, cfg = list(), data = NULL, from_population = FALSE, corte = NULL) {
  if (isTRUE(from_population)) {
    nota <- "Sin hoja de barrido: la cola se arma con la hoja del equipo."
    return(list(
      .monitoreo_report_block("cola_insistencia", "Cola de insistencia", .monitoreo_cola_vacia(), nota),
      .monitoreo_report_block("cola_insistencia_responsables", "Cola de insistencia por responsable", data.frame(), nota)
    ))
  }
  corte <- if (is.null(corte)) .monitoreo_cola_corte(cfg) else as.Date(corte)
  rules <- (cfg$operational_model %||% list())$state_rules %||% list()
  cola <- .monitoreo_telefonico_cola_df(phone, ctx, rules = rules, data = data, corte = corte)
  resumen <- .monitoreo_telefonico_cola_responsables_df(cola, ctx$responsables, ctx$no_barrido)
  total <- nrow(cola)
  nota <- sprintf("Casos barridos que no son finales. Días sin registro al corte del %s.", format(corte, "%d/%m/%Y"))
  if (total > .MONITOREO_COLA_MAX_FILAS) {
    nota <- sprintf("%s Se muestran %s de %s casos.", nota, .MONITOREO_COLA_MAX_FILAS, total)
  }
  list(
    .monitoreo_report_block("cola_insistencia", "Cola de insistencia", utils::head(cola, .MONITOREO_COLA_MAX_FILAS), nota),
    .monitoreo_report_block("cola_insistencia_responsables", "Cola de insistencia por responsable", resumen)
  )
}

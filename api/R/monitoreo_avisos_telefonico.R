# =============================================================================
# monitoreo_avisos_telefonico.R — avisos fuertes del reporte telefónico
# =============================================================================
#
# Checklist 1.4, 1.5 y 2.3 (ACNUR RMS 2026). Tres alertas que antes no existían
# y que convertían un fallo de configuración en un «0 efectivas» mudo:
#
#   cruce_llave_bajo              casi ninguna respuesta cruza con el barrido
#   filtro_columna_no_encontrada  un filtro habilitado apunta a una columna que
#                                 no existe en las respuestas
#   status_desconocido            un Status del barrido sin regla ni vocabulario
#                                 (solo con `status_from_rules` encendida)
#
# Plomería: `.monitoreo_report_alerts_df` vive aquí como envoltura. El cuerpo
# histórico quedó en monitoreo_engine.R como `.monitoreo_report_alerts_df_base`
# (archivo congelado a crecimiento: solo cambia de nombre). La envoltura:
#   1. antepone los avisos nuevos (son los de mayor severidad);
#   2. si el barrido ya se cruza por proGres, quita `llave_no_detectada`: el
#      motor avisaba que no conocía la llave cuando sí la usa (una sola noción
#      de «cuál es la llave» para cruzar y para avisar).
# =============================================================================

.monitoreo_aviso_fila <- function(nivel, tipo, detalle) {
  data.frame(
    Nivel = nivel,
    `Tipo alerta` = tipo,
    `Detalle del tipo de alerta` = detalle,
    Responsable = "",
    CodPulso = "",
    Detalle = detalle,
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
}

# Fila «Sin alertas» (misma forma que la del cuerpo histórico).
.monitoreo_aviso_fila_ok <- function() {
  out <- .monitoreo_aviso_fila(
    "OK", "Sin alertas",
    "Barrido y respuestas conectadas no muestran diferencias criticas."
  )
  out$Detalle <- ""
  out
}

# --- C3 · el cruce con el barrido es bajo -------------------------------------

.monitoreo_aviso_columnas_llave <- function(detalles) {
  columnas <- unique(unlist(lapply(detalles, function(items) {
    vapply(items, function(i) as.character(i$column %||% ""), character(1))
  }), use.names = FALSE))
  columnas <- columnas[nzchar(columnas)]
  if (length(columnas)) paste(columnas, collapse = ", ") else "ninguna detectada"
}

.monitoreo_aviso_cruce_llave <- function(barrido, respuestas, profile) {
  if (!nrow(barrido) || !nrow(respuestas)) return(NULL)
  estados <- .monitoreo_report_states(respuestas, profile)
  cuentan <- estados %in% c("Completa", "Parcial", "Rechazo") &
    !.monitoreo_report_platform_test_mask(respuestas, profile)
  if (sum(cuentan) < 5L) return(NULL)

  detalles_resp <- .monitoreo_report_key_details(respuestas, profile, "respuesta")
  detalles_bar <- .monitoreo_report_key_details(barrido, profile, "universo")
  claves_barrido <- .monitoreo_report_key_set(lapply(detalles_bar, function(items) {
    vapply(items, function(i) as.character(i$key %||% ""), character(1))
  }))
  claves_resp <- lapply(detalles_resp[cuentan], function(items) {
    vapply(items, function(i) as.character(i$key %||% ""), character(1))
  })
  cruzan <- sum(vapply(claves_resp, .monitoreo_report_has_key, logical(1), key_set = claves_barrido))
  total <- length(claves_resp)
  pct <- cruzan / total
  if (pct >= 0.5) return(NULL)

  columnas <- sprintf(
    "Llave del barrido: %s. Llave de las respuestas: %s.",
    .monitoreo_aviso_columnas_llave(detalles_bar),
    .monitoreo_aviso_columnas_llave(detalles_resp[cuentan])
  )
  detalle <- if (cruzan == 0L) {
    sprintf(
      "De %d respuestas de plataforma, ninguna respuesta cruza con el barrido (0 %%). %s Revisa la llave declarada o el formato del código.",
      total, columnas
    )
  } else {
    sprintf(
      "De %d respuestas de plataforma, solo %d cruzan con el barrido (%.0f %%). %s Revisa la llave declarada o el formato del código.",
      total, cruzan, 100 * pct, columnas
    )
  }
  .monitoreo_aviso_fila("Alta", "cruce_llave_bajo", detalle)
}

# --- C4 · un filtro habilitado no encuentra su columna ------------------------

# Variables de los filtros HABILITADOS (efectividad y prueba).
.monitoreo_aviso_filtros_habilitados <- function(profile) {
  salida <- list()
  efectiva <- profile[["platform_effective_filter"]] %||% list()
  if (isTRUE(efectiva[["enabled"]])) {
    criterios <- efectiva[["filters"]] %||% list()
    variables <- vapply(criterios, function(c) .monitoreo_scalar(c[["variable"]], ""), character(1))
    if (!length(variables)) variables <- .monitoreo_scalar(efectiva[["variable"]], "")
    for (v in variables[nzchar(variables)]) salida[[length(salida) + 1L]] <- list(filtro = "efectividad", variable = v)
  }
  prueba <- profile[["platform_test_filter"]] %||% list()
  v <- .monitoreo_scalar(prueba[["variable"]], "")
  if (isTRUE(prueba[["enabled"]]) && nzchar(v)) salida[[length(salida) + 1L]] <- list(filtro = "prueba", variable = v)
  salida
}

# Columnas con datos cuya hoja (lo que sigue al último «/») es la de la variable.
.monitoreo_aviso_candidatas_filtro <- function(respuestas, variable) {
  hoja <- .monitoreo_text_key(sub("^.*/", "", variable))
  if (!nzchar(hoja)) return(character(0))
  nms <- names(respuestas)
  nms <- nms[!startsWith(nms, ".")]
  hojas <- .monitoreo_text_key(sub("^.*/", "", nms))
  candidatas <- nms[hojas == hoja]
  candidatas <- candidatas[vapply(candidatas, function(col) {
    v <- trimws(as.character(respuestas[[col]]))
    any(!is.na(v) & nzchar(v))
  }, logical(1))]
  utils::head(candidatas, 3L)
}

# ¿La columna resuelta coincide EXACTAMENTE con la variable declarada (nombre,
# hoja del nombre o etiqueta)? `.monitoreo_report_filter_column` tiene un último
# recurso por subcadena («Intro04» encuentra «group_consent/Intro04», pero
# también «x_intro04_b»): funciona, pero es una coincidencia que nadie declaró.
.monitoreo_aviso_filtro_exacto <- function(respuestas, variable, columna) {
  buscados <- unique(c(
    .monitoreo_text_key(variable),
    .monitoreo_text_key(sub("^.*/", "", variable))
  ))
  etiquetas <- .monitoreo_variable_label_map(respuestas)
  etiqueta <- if (columna %in% names(etiquetas)) .monitoreo_scalar(etiquetas[[columna]], "") else ""
  .monitoreo_text_key(columna) %in% buscados || .monitoreo_text_key(etiqueta) %in% buscados
}

.monitoreo_aviso_filtro_columna <- function(respuestas, profile) {
  if (!nrow(respuestas)) return(list())
  filas <- list()
  for (f in .monitoreo_aviso_filtros_habilitados(profile)) {
    columna <- .monitoreo_report_filter_column(respuestas, f$variable)
    if (nzchar(columna) && .monitoreo_aviso_filtro_exacto(respuestas, f$variable, columna)) next
    if (nzchar(columna)) {
      # Resuelta solo por coincidencia parcial: el filtro corre, pero con una
      # columna que el estudio no nombró.
      filas[[length(filas) + 1L]] <- .monitoreo_aviso_fila(
        "Media", "filtro_columna_no_encontrada",
        sprintf(
          "El filtro de %s declara la variable «%s», que no coincide exactamente con ninguna columna de las respuestas; se está resolviendo por coincidencia parcial con «%s». Declara el nombre completo para que no dependa de esa coincidencia.",
          f$filtro, f$variable, columna
        )
      )
      next
    }
    candidatas <- .monitoreo_aviso_candidatas_filtro(respuestas, f$variable)
    sugerencia <- if (length(candidatas)) {
      sprintf(" Columnas parecidas en las respuestas: %s.", paste(candidatas, collapse = ", "))
    } else {
      " No hay columnas parecidas en las respuestas."
    }
    filas[[length(filas) + 1L]] <- .monitoreo_aviso_fila(
      "Alta", "filtro_columna_no_encontrada",
      sprintf(
        "El filtro de %s apunta a la variable «%s», que no existe en las respuestas; sin esa columna ninguna respuesta cuenta como efectiva.%s",
        f$filtro, f$variable, sugerencia
      )
    )
  }
  filas
}

# --- C6 · Status sin regla ni vocabulario -------------------------------------

# Status que el vocabulario fijo reconoce como «Sin respuesta» a propósito.
.MONITOREO_STATUS_SIN_RESPUESTA <- c("sin respuesta", "no respuesta", "pendiente", "no barrido", "nobarrido", "not responded")

.monitoreo_aviso_status_desconocido <- function(barrido, profile) {
  if (!nrow(barrido) || !.monitoreo_status_desde_reglas_activo(profile)) return(list())
  status <- .monitoreo_report_first_values(barrido, c("Status", "Estado", "estado", "Estatus", "estatus", "Estado campo", "Estado avance", "response_status", "status"))
  status <- trimws(as.character(status))
  status <- status[!is.na(status) & nzchar(status)]
  if (!length(status)) return(list())
  clave <- .monitoreo_estado_clave(status)
  tabla <- .monitoreo_status_reglas_tabla(profile[["state_rules"]])
  conocido_fijo <- .monitoreo_report_state_from_status(status, platform = FALSE) != "Sin respuesta" |
    .monitoreo_text_key(status) %in% .MONITOREO_STATUS_SIN_RESPUESTA
  desconocido <- !(clave %in% names(tabla)) & !conocido_fijo
  if (!any(desconocido)) return(list())
  conteo <- table(status[desconocido])
  conteo <- conteo[order(-as.integer(conteo), names(conteo))]
  lapply(utils::head(seq_along(conteo), 25L), function(i) {
    .monitoreo_aviso_fila(
      "Media", "status_desconocido",
      sprintf(
        "%s: %d. Este Status no casa con ninguna regla de estado ni con el vocabulario conocido; se cuenta como «Sin respuesta». Corrige el dato o agrega una regla.",
        names(conteo)[[i]], as.integer(conteo[[i]])
      )
    )
  })
}

# Llaves proGres repetidas en el barrido (misma alerta que el cuerpo histórico,
# sobre la columna que de verdad se usa para cruzar).
.monitoreo_aviso_duplicadas_progres <- function(barrido) {
  items <- .monitoreo_progres_items(barrido, "universo")
  codigos <- vapply(items, function(x) if (length(x)) as.character(x[[1]]$value) else "", character(1))
  codigos <- codigos[nzchar(codigos)]
  repetidos <- unique(codigos[duplicated(codigos)])
  lapply(utils::head(repetidos, 25L), function(codigo) {
    fila <- .monitoreo_aviso_fila("Alta", "llave_duplicada_barrido", "La llave aparece mas de una vez en barrido.")
    fila$CodPulso <- codigo
    fila
  })
}

# --- Envoltura ------------------------------------------------------------------

.monitoreo_report_alerts_df <- function(data, profile) {
  base <- .monitoreo_report_alerts_df_base(data, profile)
  barrido <- data[.monitoreo_report_role_mask(data, "barrido"), , drop = FALSE]
  respuestas <- data[.monitoreo_report_role_mask(data, "respuestas"), , drop = FALSE]

  nuevas <- list()
  if (identical(profile$family %||% "", "telefonico")) {
    nuevas <- c(
      list(.monitoreo_aviso_cruce_llave(barrido, respuestas, profile)),
      .monitoreo_aviso_filtro_columna(respuestas, profile),
      .monitoreo_aviso_status_desconocido(barrido, profile)
    )
    nuevas <- Filter(Negate(is.null), nuevas)
  }
  tipos <- as.character(base[["Tipo alerta"]])
  quitar <- rep(FALSE, nrow(base))
  if (.monitoreo_progres_en_uso(barrido, "universo")) {
    # Con proGres como llave, las alertas de «la llave del barrido» del cuerpo
    # histórico miran otra columna (a veces `.source_id`): se retiran y las
    # duplicadas se recalculan sobre la llave que de verdad se usa.
    quitar <- tipos %in% c("llave_no_detectada", "llave_duplicada_barrido", "llave_faltante_barrido")
    nuevas <- c(nuevas, .monitoreo_aviso_duplicadas_progres(barrido))
  }
  if (!length(nuevas) && !any(quitar)) return(base)

  conservadas <- base[!quitar & base[["Nivel"]] != "OK", , drop = FALSE]
  filas <- c(nuevas, if (nrow(conservadas)) list(conservadas))
  if (!length(filas)) return(.monitoreo_aviso_fila_ok())
  out <- do.call(rbind, filas)
  rownames(out) <- NULL
  utils::head(out, 300L)
}

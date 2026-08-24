# =============================================================================
# Metas del diseño para el monitoreo de aulas universitarias
# =============================================================================
#
# La importación desde calc-muestra traía la SELECCIÓN pero no el DISEÑO:
# `cfg$quotas$strata` eran aulas por estrato del sorteo —no cuotas de
# alumnos—, y `expected_valid` por aula quedaba en `eligible_n` crudo, como si
# cada elegible fuera a responder. El diseño sí sabe las dos cosas: la cuota
# de alumnos por facultad (`aulas_por_estrato[[i]]$cuota`, con su split por
# sexo en `distribucion_sub`) y la tasa de rendimiento τ que dimensionó las
# aulas (`aulas_por_estrato[[i]]$tau`). Sin ese puente, Monitoreo medía el
# avance contra una meta inflada ~1/τ y las brechas nunca cerraban.
#
# Vive en archivo propio: `monitoreo_aulas_universitarias.R` solo lo invoca.
# Reusa los lectores de la certificación (`.cm_certificacion_*`) en vez de
# re-parsear el estudio: dos parsers del mismo componente ya divergieron una
# vez en este repo, y la certificación es la que Gonzalo dio por buena.

#' Metas del diseño trazadas en calc-muestra, por facultad.
#'
#' Devuelve `list()` cuando no hay diseño ni certificación adjunta de donde
#' leer: un bloque vacío es más honesto que uno con ceros que se leerían como
#' medidos. Las fuentes, en orden: (1) el componente del estudio —cuota y τ
#' por estrato, split por sexo de `distribucion_sub`—; (2) si el estudio no
#' viaja pero la selección trae `certificacion_facultad` adjunta (selección
#' servida), sus filas, con `tasa_fuente = "certificacion"`.
#'
#' @param estudio estudio de calc-muestra (o `NULL`).
#' @param plan_df plan NORMALIZADO como data.frame (faculty/eligible_n/
#'   sample_role/wave/sex_top_*): exactamente lo que la certificación lee.
#' @param selection selección completa importada (para hallar la
#'   certificación adjunta), o `NULL`.
#' @return bloque `monitoreo_aulas_design_targets_v1` o `list()`.
#' @keywords internal
.monitoreo_aulas_metas_diseno <- function(estudio, plan_df, selection = NULL) {
  filas_estudio <- .cm_certificacion_componente_facultad(estudio)
  # `selection` puede llegar como data.frame pelado (el llamador acepta ambas
  # formas); asignarle campos lo convertiria en columnas, asi que solo se trata
  # como sobre cuando es lista de verdad.
  sel_lista <- if (is.list(selection) && !is.data.frame(selection)) selection else list()
  adjunta <- sel_lista$certificacion_facultad
  if (!is.list(adjunta) || !length(adjunta$filas)) adjunta <- NULL

  facultades <- list()
  tasa_fuente <- "sin_tasa"
  if (length(filas_estudio)) {
    cuotas_sexo <- .cm_certificacion_cuotas_sexo(estudio)
    for (f in filas_estudio) {
      if (!is.list(f)) next
      etiqueta <- .cm_aulas_scalar(f$estrato, "")
      if (!nzchar(etiqueta)) next
      k <- .cm_aulas_scalar(.cm_criterios_fac_key(etiqueta), "")
      facultades[[length(facultades) + 1L]] <- list(
        facultad = etiqueta,
        faculty_key = k,
        cuota = .monitoreo_metas_round(f$cuota),
        cuota_sexo = .monitoreo_metas_cuota_sexo_disenio(cuotas_sexo[[k]]),
        tau = .monitoreo_metas_tau(f$tau)
      )
    }
    taus <- vapply(facultades, function(x) x$tau %||% NA_real_, numeric(1))
    if (any(is.finite(taus))) tasa_fuente <- "tau_disenio"
  } else if (is.list(adjunta)) {
    for (f in adjunta$filas) {
      if (!is.list(f)) next
      etiqueta <- .cm_aulas_scalar(f$facultad, "")
      if (!nzchar(etiqueta)) next
      k <- .cm_aulas_scalar(f$faculty_key %||% .cm_criterios_fac_key(etiqueta), "")
      facultades[[length(facultades) + 1L]] <- list(
        facultad = etiqueta,
        faculty_key = k,
        cuota = .monitoreo_metas_round(f$cuota),
        cuota_sexo = .monitoreo_metas_cuota_sexo_certificacion(f$sexo),
        tau = .monitoreo_metas_tau(f$tasa)
      )
    }
    if (length(facultades)) tasa_fuente <- "certificacion"
  }
  if (!length(facultades)) return(list())

  certificacion <- adjunta
  if (is.null(certificacion) && length(filas_estudio)) {
    # Sin certificación adjunta se deriva aquí mismo, sobre el plan que se está
    # importando: el plan normalizado tiene las columnas que la certificación
    # lee. OJO: esta puerta DIVERGE de la servida a propósito. Al servir la
    # selección (router_calc_muestra) sí viaja `referencia_asistencia`, así que
    # un estudio SIN τ declarada certifica ahí contra la tasa observada 2025;
    # aquí se pasa NULL y ese mismo estudio queda en `sin_tasa` con la meta
    # cruda. Porqué: la τ del diseño es la fuente canónica, la referencia 2025
    # no está disponible en este import sin crecer el router congelado, y los
    # diseños vigentes declaran τ — la divergencia solo alcanza estudios sin τ.
    sel_tmp <- sel_lista
    sel_tmp$selection <- plan_df
    con_cert <- calc_muestra_aulas_adjuntar_certificacion(sel_tmp, estudio, NULL)
    certificacion <- if (is.list(con_cert)) con_cert$certificacion_facultad else NULL
    if (is.list(certificacion)) {
      # Re-estampa de procedencia SOLO en la copia derivada: el payload hereda
      # `owner`/`momento` de la certificación al servir, y decir
      # `derivado_al_servir` aquí sería mentir sobre cuándo y quién la produjo.
      # Una certificación ADJUNTA se conserva tal cual llegó.
      certificacion$owner <- "monitoreo_aulas_config.design_targets"
      certificacion$momento <- "derivado_al_importar"
    }
  }

  taus <- vapply(facultades, function(x) x$tau %||% NA_real_, numeric(1))
  # Igual que el resumen de la certificación: una sola τ compartida se publica
  # redondeada; facultades con tasas distintas dejan NA para no promediar a
  # escondidas lo que el diseño trazó por separado.
  usadas <- unique(round(taus[is.finite(taus)], 4))
  cuotas <- vapply(facultades, function(x) x$cuota %||% NA_real_, numeric(1))
  list(
    schema = "monitoreo_aulas_design_targets_v1",
    source = "calc-muestra",
    tasa_esperada = if (length(usadas) == 1L) usadas else NA_real_,
    tasa_fuente = tasa_fuente,
    total_cuota = if (any(is.finite(cuotas))) round(sum(cuotas[is.finite(cuotas)])) else NA_real_,
    facultades = facultades,
    certificacion_facultad = certificacion
  )
}

#' Ajusta `expected_valid` del plan con la τ del diseño.
#'
#' Solo toca las filas donde `expected_valid == eligible_n`, que es el valor
#' de FALLBACK del normalizador (un plan sin meta propia cae ahí): un plan que
#' declare su propia meta distinta no se toca, porque lo declarado manda.
#' `eligible_n` queda intacto siempre —son los elegibles crudos del aula, otro
#' dato—; lo que cambia es cuántas válidas se esperan de ellos.
#'
#' @param plan plan como records (salida de `monitoreo_aulas_normalize_plan`).
#' @param metas bloque de `.monitoreo_aulas_metas_diseno()`.
#' @return el plan, con `expected_valid = round(eligible_n * tau)` donde aplica.
#' @keywords internal
.monitoreo_aulas_aplicar_meta_tau <- function(plan, metas) {
  if (!is.list(plan) || !length(plan)) return(plan)
  facs <- if (is.list(metas)) metas$facultades %||% list() else list()
  taus <- list()
  for (f in facs) {
    if (!is.list(f)) next
    k <- .cm_aulas_scalar(f$faculty_key, "")
    tau <- .monitoreo_metas_tau(f$tau)
    if (nzchar(k) && is.finite(tau)) taus[[k]] <- tau
  }
  if (!length(taus)) return(plan)
  lapply(plan, function(row) {
    if (!is.list(row)) return(row)
    k <- .cm_aulas_scalar(.cm_criterios_fac_key(.cm_aulas_scalar(row$faculty, "")), "")
    tau <- if (nzchar(k)) taus[[k]] %||% NA_real_ else NA_real_
    if (!is.finite(tau)) return(row)
    eligible <- suppressWarnings(as.numeric(.cm_aulas_scalar(row$eligible_n, NA)))
    expected <- suppressWarnings(as.numeric(.cm_aulas_scalar(row$expected_valid, NA)))
    if (!is.finite(eligible) || !is.finite(expected)) return(row)
    if (expected != eligible) return(row)
    row$expected_valid <- round(eligible * tau)
    row
  })
}

# --- helpers privados de lectura --------------------------------------------

# τ válida es la de la certificación: finita, en (0, 1]. Cualquier otra cosa
# —cero, texto, un porcentaje escrito como 53— degrada a NA y la fila queda
# con su meta cruda, que es el comportamiento previo a este bloque.
.monitoreo_metas_tau <- function(x) {
  tau <- suppressWarnings(as.numeric(.cm_aulas_scalar(x, NA)))
  if (length(tau) == 1L && is.finite(tau) && tau > 0 && tau <= 1) tau else NA_real_
}

.monitoreo_metas_round <- function(x) {
  v <- suppressWarnings(as.numeric(.cm_aulas_scalar(x, NA)))
  if (length(v) == 1L && is.finite(v)) round(v) else NA_real_
}

# Del diseño: `distribucion_sub` ya viene como fac_key -> list(F=, M=) por
# `.cm_certificacion_cuotas_sexo()`; aquí solo se redondea y filtra.
.monitoreo_metas_cuota_sexo_disenio <- function(cuotas_sx) {
  out <- list()
  if (!is.list(cuotas_sx)) return(out)
  for (sx in c("F", "M")) {
    v <- suppressWarnings(as.numeric(cuotas_sx[[sx]] %||% NA))
    if (length(v) == 1L && is.finite(v)) out[[sx]] <- round(v)
  }
  out
}

# De la certificación adjunta: sus filas de sexo son {sexo, cuota, ...}.
.monitoreo_metas_cuota_sexo_certificacion <- function(sexo_filas) {
  out <- list()
  if (!is.list(sexo_filas)) return(out)
  for (sf in sexo_filas) {
    if (!is.list(sf)) next
    sx <- toupper(.cm_aulas_scalar(sf$sexo, ""))
    v <- suppressWarnings(as.numeric(.cm_aulas_scalar(sf$cuota, NA)))
    if (sx %in% c("F", "M") && length(v) == 1L && is.finite(v)) out[[sx]] <- round(v)
  }
  out
}
